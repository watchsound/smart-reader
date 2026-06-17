# Phase 9 — Brain Spine

**Date:** 2026-06-17
**Status:** Spec — pending review
**Predecessors:** Phase 0 capability registry + structured-output polyfill; Plans 1–3 AI-driven shell (Orb / Trigger / Proposal / Quest)
**Successor:** Phase 10 — Director Mode (AI-as-Driver)

## 1. Problem

Phase 9 addresses three connected gaps surfaced in the 2026-06-17 honest-analysis conversation:

1. **Visibility** — the Brain runs invisibly. The user has no surface that answers "what did the Brain learn about me this week / today?" or "is this actually working?"
2. **Trust** — Plans 1–3 shipped a proactive surface (Orb + Triggers + Quests) with no per-Proposal "why this, why now" explanation. Acute risk that first-week users silence the Orb, wasting all of Plans 1–3.
3. **Economics** — every Phase 0–8 service hits LLMs ad-hoc. No per-user-month budget exists; user has no cost visibility; DeepSeek-baseline assumption is unstressed.

The root cause underlying all three: **every LLM call site builds its own prompt with its own ad-hoc context, with no shared learner-state spine.** Today there are ~33 ad-hoc call sites (per `polyfills/structuredOutput.js` header comment) plus the 8 Phase 0–8 Trigger-producing services. The AI cannot drive coherently — even when smart enough — because each call is context-blind.

Phase 9 introduces the missing spine and makes its byproducts (rationale, cost) visible.

## 2. Goals

- **G1** — Unify LLM access behind a single entry path so context, telemetry, and caching are owned in one place.
- **G2** — Surface per-Proposal rationale ("why this, why now") to address the trust failure mode.
- **G3** — Surface cost telemetry (per intent, per provider) to address economics.
- **G4** — Define forward-compatible seams (Intent declaration + Tool registry) that Phase 10 Director Mode plugs into without rework.

## 3. Non-goals

- **N1** — AI-as-Driver / Director Mode itself. That is Phase 10. Phase 9 only ships the seams.
- **N2** — Replacing `AIProviderManager` or the provider portability layer. The spine dispatches *through* them.
- **N3** — Replacing the `getStructured` polyfill. `brainCall` uses it internally.
- **N4** — Migrating the legacy 21-route LLM call sites (translate, grammar, writing, chat) to `brainCall` in this phase. Those get `meteredCall` for cost visibility; full migration is later.
- **N5** — Adopting LangChain / LangGraph / LlamaIndex. Rejected on provider-mismatch, token-economics, JS-stack-penalty, framework-churn, and abstraction-tax grounds. See section 9.
- **N6** — User-facing mute / per-source silence controls. Deferred; the bet is that rationale + adaptive Brain behavior (Phase 10) make explicit mute unnecessary.

## 4. Architecture

### 4.1 Module layout

```
src/main/brain/spine/
  brainCall.js           — primary entry, builds context + dispatches + records
  meteredCall.js         — passthrough entry for legacy sites, records cost only
  BrainContext.js        — canonical learner-state builder, sliceable by intent
  intents.js             — Intent Registry: name → { contextSlices, costCeilingTokens, cachePolicy, schema? }
  tools.js               — Tool Registry: name → JSON schema declaration (dormant in Phase 9)
  costEstimator.js       — per-provider token → USD pricing table + estimator
  callLedger.js          — wrapper around CallLedgerStore for spine use

src/main/db/
  CallLedgerStore.js     — DAO over brain_call_ledger table

src/renderer/components/brainShell/
  RationaleCard.jsx      — expandable "why this" card, embedded in each Proposal host
  EconomicsPanel.jsx     — cost dashboard, tab in BrainDashboardPanel

src/renderer/api/
  callLedgerApi.js       — IPC client for ledger reads (rationale by triggerId, aggregations)
```

### 4.2 Sequence

```
caller (e.g. ProductionPromptService)
  → brainCall('schedule-production-prompt', { learningPointId }, opts)
       → intents.resolve('schedule-production-prompt')
            returns { contextSlices: ['activeQuest','recentEpisodes','mastery'],
                      costCeilingTokens: 800,
                      cachePolicy: 'content-hash',
                      schema: PROMPT_SCHEMA }
       → BrainContext.buildSlice(['activeQuest','recentEpisodes','mastery'], learnerId)
       → assemblePrompt(input, context, schema)
       → check size ≤ costCeilingTokens; trim or warn
       → cache lookup by content hash; on hit return cached output + record cache_hit row
       → on miss: getStructured(provider, prompt, schema, ...) via existing polyfill
       → record ledger row { intent, ts, provider, context_keys, tokens, cost_usd,
                             cache_hit:false, duration_ms, output_summary }
       → return { output, callId }
```

### 4.3 Coexistence with existing call sites

Spine is **additive**. Legacy direct calls to `aiProviderManager.currentProvider.generateContent(...)` or `getStructured(provider, ...)` continue to work unchanged. Migration is per-file and reversible.

## 5. Components

### 5.1 `brainCall(intent, input, options)`

```js
async function brainCall(intent, input, options = {}) {
  const profile = intents.resolve(intent);                   // throws on unknown intent
  const learnerId = options.learnerId ?? defaultLearnerId();
  const context = await BrainContext.buildSlice(profile.contextSlices, learnerId, options.contextOverrides);
  const prompt = assemblePrompt(input, context, profile.schema, profile.promptTemplate);
  const sizeCheck = enforceCostCeiling(prompt, profile.costCeilingTokens);    // trim or warn
  const cacheKey = profile.cachePolicy === 'content-hash' ? hash(prompt) : null;
  if (cacheKey) {
    const hit = await callLedger.findCacheHit(intent, cacheKey);
    if (hit) {
      await callLedger.recordCacheHit({ intent, cacheKey, triggerId: options.triggerId });
      return { output: hit.output, callId: hit.id };
    }
  }
  const provider = aiProviderManager.currentProvider;
  const t0 = Date.now();
  const output = profile.schema
    ? await getStructured(provider, prompt, profile.schema)
    : await provider.generateContent(prompt);
  const duration_ms = Date.now() - t0;
  const callId = await callLedger.record({
    intent, ts: Date.now(), provider: provider.name, context_keys: Object.keys(context),
    prompt_tokens: estimateTokens(prompt), completion_tokens: estimateTokens(output),
    cost_usd: costEstimator.estimate(provider.name, prompt, output),
    cache_hit: false, cache_key: cacheKey, duration_ms,
    trigger_id: options.triggerId ?? null,
    output_summary: summarize(output),
  });
  return { output, callId };
}
```

### 5.2 `meteredCall(provider, prompt, options)`

Identical recording path, no context injection, no intent resolution. Caller passes the same prompt it would have passed to the provider directly.

### 5.3 `BrainContext`

Slice catalog (initial set):

| Slice | Source | Typical size |
|---|---|---|
| `activeQuest` | `QuestStore.getActive(learnerId)` | ~80 tokens |
| `currentBook` | renderer-supplied `{ bookId, chapterIndex }` | ~30 tokens |
| `recentEpisodes` | `EpisodeStore.lastN(learnerId, 20)` | ~200 tokens |
| `mastery` | `LearningPointManager.topN(learnerId, 15)` | ~250 tokens |
| `recentComprehension` | `ComprehensionGradingService.lastN(learnerId, 5)` | ~150 tokens |
| `acceptDismissPatterns` | `callLedger.acceptDismissByIntent(learnerId, 14days)` | ~120 tokens |

`buildSlice(sliceNames, learnerId)` returns an object keyed by slice name. Each slice has a deterministic compact JSON serialization (small keys, no whitespace) consumed by `assemblePrompt`.

### 5.4 Intent Registry

Initial intents (one per Phase 0–8 Trigger-producing site + a few cross-cutting):

| Intent | Slices | Ceiling | Cache | Migrates from |
|---|---|---|---|---|
| `extract-learning-points` | `currentBook, mastery` | 1200 | content-hash | extractors (Phase 3) |
| `propose-microcard` | `currentBook, mastery, recentEpisodes` | 800 | content-hash | MicroCardProposer (Phase 4) |
| `diagnose-book` | `mastery, activeQuest` | 1500 | content-hash | BookDiagnosticService (Phase 5) |
| `grade-comprehension` | `currentBook, mastery, recentEpisodes` | 1000 | none | ComprehensionGradingService (Phase 6) |
| `plan-cross-book-path` | `activeQuest, mastery` | 2000 | session | LearningPathPlannerService (Phase 7) |
| `schedule-reread` | `recentComprehension, recentEpisodes` | 600 | none | RereadQueueService (Phase 8a) |
| `suggest-organize` | `mastery, currentBook` | 800 | content-hash | MoodBoardOrganizerService (Phase 8b) |
| `schedule-production-prompt` | `mastery, activeQuest` | 800 | content-hash | ProductionPromptService (Phase 8c) |
| `argument-xray` | `currentBook` | 1200 | content-hash | ArgumentXrayService (in flight) |
| `synthesize-pull-suggestion` | `activeQuest, recentEpisodes, mastery, acceptDismissPatterns` | 1000 | session | LearningBrainAgent.synthesizePullSuggestion |
| `tutor-context` | `activeQuest, currentBook, mastery, recentEpisodes` | 1500 | session | tutorContext.js (Phase 1) |

### 5.5 Tool Registry (dormant in Phase 9)

```js
tools.register('navigate', { schema: { view: 'string', params: 'object?' } });
tools.register('createMicroCard', { schema: { paragraphId: 'string', front: 'string', back: 'string' } });
tools.register('markConceptMastered', { schema: { conceptId: 'string' } });
tools.register('openMoodBoard', { schema: { boardId: 'string' } });
tools.register('scheduleReread', { schema: { bookId: 'string', chapterIndex: 'number', delayHours: 'number' } });
```

Phase 9 exposes `tools.list()` and `tools.invoke(name, args)` (the latter dispatches to renderer via IPC or runs main-side). No code path calls these in Phase 9; they exist so Phase 10's graph runner has a stable target.

### 5.6 Call Ledger

Schema addition to `db.sql`:

```sql
CREATE TABLE IF NOT EXISTS brain_call_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intent TEXT NOT NULL,
  ts INTEGER NOT NULL,
  provider TEXT NOT NULL,
  context_keys TEXT,                -- JSON array of slice names actually included
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd REAL,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  cache_key TEXT,
  duration_ms INTEGER,
  trigger_id TEXT,                  -- nullable; FK shape only, no enforcement
  output_summary TEXT               -- truncated to 500 chars
);
CREATE INDEX idx_brain_call_ledger_ts ON brain_call_ledger(ts);
CREATE INDEX idx_brain_call_ledger_intent_ts ON brain_call_ledger(intent, ts);
CREATE INDEX idx_brain_call_ledger_trigger ON brain_call_ledger(trigger_id);
CREATE INDEX idx_brain_call_ledger_cache ON brain_call_ledger(intent, cache_key);
```

Pruning: nightly job in `LearningBrainAgent.runHeartbeat` evicts rows older than 90 days OR oldest rows when count > 10K (LRU by `ts`).

## 6. Surfaces

### 6.1 Rationale Card

Embedded in `AtomicChipHost`, `InlineSequenceHost`, `MultiSurfaceFlowHost` Proposal renderers. Default collapsed; chevron expands.

Renders:
- Intent name (human-readable label from intent registry)
- Slice summary table: per included slice, key facts (e.g. `mastery: top 3 — token_economics 0.42, vector_search 0.61, episodic_memory 0.78`)
- Provider used + cost (`$0.004 via deepseek-v3`)
- Cache status (`fresh` / `cached 2h ago`)
- "View raw" link → modal with the full prompt + output (for power users)

### 6.2 Economics Panel

New tab in `BrainDashboardPanel` alongside `TriggerTelemetryPanel`. Rows:

- **This week / last 30 days** toggles
- Cost-by-intent bar (top 10 intents)
- Cost-by-provider pie
- Cache hit-rate gauge per cacheable intent
- "Projected monthly burn" derived from last-7-day daily average × 30
- Provider switcher hint: "Switching `propose-microcard` to deepseek-chat-lite would save ~$X/mo at current volume"

### 6.3 Expanded `TriggerTelemetryPanel`

Adds an `intent` column to existing per-source rows; sortable by intent. Existing accept/dismiss tallies stay.

## 7. Migration plan

| Step | Scope | Verification |
|---|---|---|
| 1 | Ship spine + ledger + intent registry; **zero call sites migrated**. | All existing tests pass; ledger table created; `brainCall('test-intent', ...)` smoke succeeds. |
| 2 | Migrate Phase 4 `MicroCardProposer` → `brainCall('propose-microcard', ...)`. First real consumer. | Phase 4 integration test passes; ledger shows rows with `intent='propose-microcard'`. |
| 3 | Migrate Phase 5, 6, 7, 8a, 8b, 8c services in any order. | Per-phase integration tests pass. |
| 4 | Wire Rationale Card. Embedded in three Flow hosts. | Manual: open Proposal in dev, click rationale chevron, see slice summary. |
| 5 | Wire Economics Panel. | Manual: run app, generate ≥10 LLM calls across ≥3 intents, panel shows correct aggregations. |
| 6 | Migrate `argument-xray`, `synthesize-pull-suggestion`, `tutor-context`. | Their integration tests pass. |
| 7 | Add `meteredCall` to legacy 21-route LLM sites (translate, grammar, writing, chat). | Cost panel covers full LLM spend. |

Order may interleave 2–7 except step 1 (foundation) and step 4–5 (visibility surfaces) which depend on ≥4 producers being migrated.

## 8. Success criteria

- All 8 Phase 0–8 Trigger-producing services route through `brainCall`.
- Every Proposal in the Orb queue renders a Rationale Card showing its driving context.
- Economics Panel shows last-7-day cost broken down by intent and provider.
- Cache hit-rate ≥ 30% for cacheable intents (content-hash policy).
- Spine adds ≤ 50 ms p95 overhead per LLM call (ledger write + context build).
- Zero existing LLM call site breaks during migration (additive coexistence).

## 9. Framework rejection rationale (LangChain / LangGraph)

Considered and rejected. Reasons:

- **Provider mismatch.** SmartReader runs 7 providers (DeepSeek, Qwen, Kimi, Claude, GPT, Gemini, Baidu, Qianfan, Ollama). LangChain JS supports a strict subset and treats Chinese-stack providers as second-class. Adopting it means unwinding the portability layer in `AIProviderManager`.
- **Token economics.** Default agent templates (ReAct, scratchpads, verbose tool descriptions) carry 5–10× the prompt overhead of bespoke prompts. Directly conflicts with Phase 9's economics goal on a DeepSeek-baseline cost model.
- **JS port lag.** Python-first project; JS port consistently behind on agentic features. We are Electron.
- **Framework churn.** Multiple breaking redesigns in the last 18 months. Custom spine code at this scale (~600–900 lines) is cheaper to maintain than tracking releases.
- **Abstraction surface.** The spine we need is small. LangChain's surface is two orders of magnitude larger, most of which is unused.

The spine is modeled on LangGraph's *concepts* (intents-as-nodes, context-as-state, tools-as-edges) without taking the dependency. Phase 10 Director Mode adds the graph runner — also ~200 lines — completing the conceptual equivalent at a fraction of the footprint.

## 10. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Context bloat — slices grow over time, prompts balloon | Medium | Per-intent token ceiling enforced before dispatch; oversize triggers slice trim with logged warning to ledger. |
| Ledger growth past 10K rows | Medium | Nightly prune in heartbeat; LRU eviction. |
| Stale context — long-running call sees outdated state | Low (Phase 9) | Acceptable: Phase 9 calls are short-lived. Revisit in Phase 10 Director Mode where sessions span minutes. |
| Cost estimator drift — provider pricing changes | High over time | `costEstimator.js` table is data-driven, updated quarterly; ledger stores raw token counts so historical costs can be recomputed. |
| Naming collision — `Tool` overloaded with Skill Tool vocabulary | Low | Internal name only; UI never exposes it. Re-prefix if Phase 10 surfaces it externally. |
| Rationale Card overload — too much detail confuses users | Medium | Default collapsed; show one-line summary first, expand for detail, "View raw" gated as power-user. |
| Migration breaks a Phase 0–8 service | Low | Each migration is one file, additive coexistence, integration tests gate. |

## 11. Out of scope / follow-up phases

- **Phase 9.5 (optional)** — instrument legacy 21-route sites with `meteredCall` if Phase 9 ships without step 7.
- **Phase 10 — Director Mode** — state-graph runner consuming intents + tools + BrainContext. AI selects intent, invokes tools, transitions nodes, all reading/writing BrainContext.
- **Future** — per-user budget caps (auto-throttle when monthly budget hit), shared learner-context across devices (sync BrainContext), tenant-scoped pricing tables for org deployments.
