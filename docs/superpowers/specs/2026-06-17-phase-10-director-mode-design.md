# Phase 10 — Director Mode v1 (Pull-Suggestion)

**Date:** 2026-06-17
**Status:** Spec — approved, in flight
**Predecessor:** Phase 9 Brain Spine (`brainCall`, `BrainContext`, Intent Registry, Tool Registry, Call Ledger)
**Successor:** Phase 11 / future Director configs (study-session, comprehension follow-up, onboarding)

## 1. Problem

Phase 9 ended with a question the user named explicitly: the AI should be *driving* the process, not being called spontaneously from many places. The spine made every LLM call coherent and visible — but the AI itself never selects what to do next; the surrounding code does. The user's stated final goal is **B (AI-as-driver with shared context)**.

Phase 10 introduces a Director runtime: an agentic ReAct loop that uses BrainContext as global state, picks tools from the Tool Registry, and decides one concrete action. The v1 demo upgrades `synthesizePullSuggestion` from a one-shot LLM call to a 1–3-iteration Director run.

## 2. Goals

- **G1** — Build an intent-agnostic Director runtime that drives a ReAct loop over the Tool Registry, with budget control and graceful failure.
- **G2** — Wire `tools.invoke(name, args)` so registered tool handlers run for real (Phase 9 left this dormant).
- **G3** — Replace `synthesizePullSuggestion()`'s single-shot LLM call with a Director run, preserving the existing deterministic fallback.
- **G4** — Make Director runs first-class on the Call Ledger via a new `trace_id` column so RationaleCard can show the full multi-iteration trace.

## 3. Non-goals

- **N1** — Other Director configs (study-session, comprehension follow-up, onboarding). Future work.
- **N2** — User-facing "Director Mode" toggle. Director is on for the Pull path; no opt-out in v1.
- **N3** — Streaming / partial-output Director responses. v1 returns the final answer in one shot.
- **N4** — Director-from-renderer (renderer dispatches a Director run via IPC). Pull lives in main; the IPC path isn't needed yet.
- **N5** — Director-Director composition. One Director cannot call another in v1.
- **N6** — Migrating any Brain-mediated `brainCall` site (e.g. Phase 4 micro-card, Phase 5 diagnostic) to the Director. Those are deterministic plans; promoting them to Director needs a separate use case.

## 4. Architecture

### 4.1 The Director loop

```
Director.run({ config, input, contextOverrides }) → { output, traceId, callIds[], usedFallback }

1.  traceId = generateTraceId()
2.  context = BrainContext.buildSlice(config.contextSlices, userId, contextOverrides)
3.  history = []  // accumulated tool calls + results
4.  for iteration in 0..config.budget:
       prompt = buildPrompt(config.systemPrompt, input, context, history)
       step = await brainCall(config.intent, prompt, { schema: REACT_STEP_SCHEMA, traceId })
       if step.action === 'tool':
         try:
           result = await tools.invoke(step.tool, step.args)
         except e:
           result = { error: e.message }
         history.append({ tool: step.tool, args: step.args, result })
         continue
       if step.action === 'answer':
         if validate(step.answer, config.outputSchema):
           return { output: step.answer, traceId, callIds: [...], usedFallback: false }
         else:
           history.append({ error: 'malformed final answer' })
           continue
5.  // budget exhausted or runtime failure → deterministic fallback
6.  return { output: config.deterministicFallback(input), traceId, callIds: [...], usedFallback: true }
```

### 4.2 ReAct step schema (sent to AI on every iteration)

```js
const REACT_STEP_SCHEMA = {
  type: 'object',
  properties: {
    action:    { type: 'string', enum: ['tool', 'answer'] },
    tool:      { type: 'string' },                                  // present if action='tool'
    args:      { type: 'object' },                                  // present if action='tool'
    answer:    { type: 'object' },                                  // present if action='answer'
    reasoning: { type: 'string' },                                  // optional, surfaced in RationaleCard
  },
  required: ['action'],
};
```

### 4.3 Director config shape

```js
type DirectorConfig = {
  intent:                string;         // intent name (must be registered in seedIntents)
  contextSlices:         string[];       // BrainContext slices to inject in the initial prompt
  systemPrompt:          string;         // role + goal + constraints
  tools:                 string[];       // subset of Tool Registry the AI may invoke
  outputSchema:          object;         // JSON schema for the final answer
  budget:                number;         // max iterations (≥1, ≤10)
  deterministicFallback: (input) => any; // mandatory; called on failure
};
```

## 5. Components

### 5.1 `Director` module — `src/main/brain/director/Director.js`

The runtime in section 4.1. ~150 lines. Pure orchestration over `brainCall` + `tools.invoke` + the config's fallback.

### 5.2 Tool handler registry

Phase 9's `tools.js` already has `register(name, decl)` + `invoke(name, args)` (which throws). Add:

```js
function registerHandler(name, fn) { HANDLERS[name] = fn; }

function invoke(name, args) {
  if (!TOOLS[name]) throw new Error(`unknown tool: ${name}`);
  const handler = HANDLERS[name];
  if (!handler) throw new Error(`tool ${name} has no handler`);
  return handler(args);
}
```

`tools.invoke` becomes synchronous-or-async depending on handler. Handlers return JSON-serializable values.

### 5.3 New read-only tools

| Tool | Args | Returns |
|---|---|---|
| `topUnmasteredConcepts` | `{ limit?: number }` (default 5) | `string[]` of concept names with `mastery_level < 60` |
| `recentEpisodeSummary` | `{ days?: number }` (default 7) | `string` — one-paragraph summary of last-N-days episodes |
| `currentQuestProgress` | `{}` | `{ name, goal, bookIds, createdAt, daysActive }` or `{ active: false }` |

Schemas declared in `tools.register(...)` (Phase 9 pattern). Handlers registered alongside via `tools.registerHandler(...)`.

### 5.4 Pull-Suggestion Director config

```js
// src/main/brain/director/configs/pullSuggestion.js
module.exports = {
  intent: 'director-pull-suggestion',   // new entry in seedIntents.js
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery', 'acceptDismissPatterns'],
  systemPrompt: `
You are deciding ONE concrete next action for the learner right now. Be specific.

You may call tools to gather more context, but you have a budget of 3 iterations total.
Prefer answering directly if the injected Learner Context is sufficient.

Final answer schema (mandatory shape on action='answer'):
{ title: string (≤ 80 chars), body: string (≤ 200 chars), navigate?: string }
`,
  tools: ['topUnmasteredConcepts', 'recentEpisodeSummary', 'currentQuestProgress'],
  outputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      navigate: { type: 'string' },
    },
    required: ['title', 'body'],
  },
  budget: 3,
  deterministicFallback: require('./deterministicPullFallback'),
};
```

The `deterministicPullFallback` is extracted from the current `LearningBrainAgent._deterministicFallback` so both Director and direct callers share the same fallback.

### 5.5 Migration of `synthesizePullSuggestion`

Replace the existing try/catch body in `LearningBrainAgent.synthesizePullSuggestion`:

```js
async synthesizePullSuggestion() {
  const Director = require('./director/Director');
  const pullConfig = require('./director/configs/pullSuggestion');
  try {
    const result = await Director.run({
      config: pullConfig,
      input: 'Decide one concrete next action for the learner.',
      contextOverrides: {},
      userId: 1,
    });
    return { ...result.output, source: result.usedFallback ? 'deterministic-fallback' : 'llm' };
  } catch (e) {
    console.warn('[Brain] Director failed catastrophically:', e?.message || e);
    return require('./director/configs/deterministicPullFallback')();
  }
}
```

The outer try/catch is a paranoia layer — Director.run shouldn't throw, but if it does (e.g. a bug in the runtime itself) the deterministic path still fires.

### 5.6 Call Ledger `trace_id` column

Schema addition to `db.sql`:

```sql
ALTER TABLE brain_call_ledger ADD COLUMN trace_id TEXT;
CREATE INDEX IF NOT EXISTS idx_brain_call_ledger_trace ON brain_call_ledger(trace_id);
```

`brainCall` accepts `options.traceId` and writes it to the row. The Director generates a UUID at start and passes it on every iteration. RationaleCard reconstructs the trace by:

```js
callLedgerApi.tracesByCallId(callId) → array of ledger rows sharing trace_id, ordered by ts
```

Render that as a numbered trace inside the existing expandable RationaleCard.

## 6. Failure handling matrix

| Failure | Detected by | Recovery |
|---|---|---|
| AI picks unknown tool | `tools.invoke` throws `unknown tool: X` | Append `{ tool: X, error: 'unknown tool' }` to history, loop |
| AI tool args wrong shape | Handler throws on bad args | Append `{ tool, args, error }`, loop |
| AI malformed final answer | `validate(answer, outputSchema)` returns false | Append `{ error: 'malformed final answer' }`, loop |
| Tool handler throws | Try/catch around `invoke` | Append `{ tool, error: e.message }`, loop |
| `brainCall` itself throws (no provider, etc.) | Try/catch around iteration | Break loop, run fallback |
| Budget exhausted with no `answer` | iteration > budget | Run fallback |
| Director runtime bug | Outer try/catch in `synthesizePullSuggestion` | Run fallback |

The Director NEVER propagates an error to the caller. Worst case: caller receives the deterministic fallback's output.

## 7. Telemetry

Each Director run produces:
- 1 to `budget` rows in `brain_call_ledger`, all sharing the same `trace_id`. Each row is one ReAct iteration.
- `intent` is `director-pull-suggestion` (or future configs' intent name).
- `output_summary` captures `step N: action=tool tool=X` or `step N: action=answer`.
- Tool invocations themselves do NOT produce ledger rows in v1 — only the LLM calls that decide them.
- `usedFallback=true` Director runs still produce a final ledger row tagged with `intent=director-pull-suggestion` and `output_summary=fallback`. This lets the Economics Panel see fallback rate as a percentage of total Director runs.

## 8. Success criteria

- All Phase 9a–9e tests still pass.
- New tests:
  - Director happy-path: mocked AI returns `{ action: 'tool' }` once then `{ action: 'answer' }`; output matches schema; result references both ledger rows.
  - Director budget-exhausted: mocked AI returns `{ action: 'tool' }` for all `budget` iterations; result is fallback; ledger has `budget` rows.
  - Director unknown-tool recovery: mocked AI returns `{ action: 'tool', tool: 'doesNotExist' }` then `{ action: 'answer' }`; history captures error; result is answer.
  - Director malformed-answer recovery: mocked AI returns `{ action: 'answer', answer: { wrong: 'shape' } }` then a valid `{ action: 'answer' }`; result is the valid one.
  - Director handler-throws recovery: mocked tool handler throws; history captures error; result is answer.
  - Director catastrophic recovery: `brainCall` throws on first iteration; result is fallback; `usedFallback=true`.
  - `tools.invoke` happy-path: registered handler runs and returns its value.
  - `tools.invoke` unknown-tool throws.
  - `tools.invoke` no-handler throws (tool declared but `registerHandler` not called).
  - Trace reconstruction: 3 ledger rows with shared `trace_id` are returned in `ts` order by `callLedgerApi.tracesByCallId`.
- Manual: boot the app; click the Orb on a clean install; observe a suggestion appears (Director or fallback). Inspect the Brain Dashboard's EconomicsPanel; see `director-pull-suggestion` rows for the run.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Director runs cost noticeably more than the single LLM call | Budget=3, content-hash cache on intermediate calls (the `director-pull-suggestion` intent uses `cachePolicy: 'content-hash'`), fallback on failure. p95 cost ≤ 3× the single-shot baseline. |
| `trace_id` migration disrupts existing aggregations | Schema change is additive; existing queries don't reference the column. |
| ReAct schema is rejected by provider's JSON mode | Inline JSON schema in the prompt; trust `getStructured`'s parse-with-retry polyfill. Existing intents already use this pattern. |
| Tools registry grows into a parallel architecture | Handlers stay thin (1–2 lines each, delegating to existing managers/services). No new domain logic in tools. |
| LLM chooses tools chaotically and exhausts budget on every run | Telemetry: if `usedFallback` rate > 50% in 7-day window, the system prompt needs refinement. Surfaced in EconomicsPanel via fallback-row count. |
| The Pull-Suggestion path becomes worse than the deterministic path | A/B-able later. v1 ships Director as default; if Brain Dashboard shows the LLM source rate dropping the user will notice. |
| Director runs are slow (3 LLM calls + tool latencies) | p95 budget: < 8s. Worse than the single-shot's < 2s. Acceptable for a Pull (user-initiated, not blocking another flow). Surfaced in `duration_ms` ledger column. |

## 10. Out of scope / follow-up phases

- **Phase 10b** — Comprehension follow-up Director (end of chapter, low score → Director picks reread / extract gaps / production prompt).
- **Phase 11 (Brain Visibility)** — A "what did the Brain learn / decide this week" surface that reads Director traces in aggregate.
- **Phase 12 (Director Surfaces)** — UI for inspecting Director traces in real time (currently only after the fact via RationaleCard).
- **Future** — Director-from-renderer via IPC, Director-Director composition, streaming/partial output, tool sandboxing.
