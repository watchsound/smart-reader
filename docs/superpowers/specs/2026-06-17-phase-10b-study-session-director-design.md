# Phase 10b — Study-Session Director

**Date:** 2026-06-17
**Status:** Spec — approved
**Predecessor:** Phase 10a (Pull-Suggestion Director — one-shot ReAct, budget 3, read-only)
**Successor:** Phase 11 (Brain Visibility) or a 10c expansion of session templates

## 1. Problem

Phase 10a proved the ReAct kernel for a one-shot AI decision (synthesize a pull suggestion). The user's stated end-state for Phase 10 is "AI-as-driver with shared context including a global goal." A single read-only AI call cannot reach that — the AI needs to:

1. Hold session-scoped state across multiple AI moves (not just one).
2. Invoke UI surfaces and consume the user's interaction as the next observation.
3. Execute reversible writes (schedule reread, create micro-card, schedule production prompt) without per-call confirmation.
4. Be transparent — every move visible in a live trace, every write reversible.

Phase 10b builds the **Study-Session Director**: a multi-minute, Quest-anchored, conductor-style AI session where the AI mixes reads, interactive surfaces, and soft writes to drive a learning episode.

## 2. Goals

- **G1** — A new `SessionRunner` orchestrator that loops Director decisions, dispatches by tool kind (read / surface / soft-write / control), and persists state.
- **G2** — Director.js kernel refactored to expose `step(state) → {tool, args, reason}` as the single-decision primitive; `run()` becomes a thin loop around `step()`.
- **G3** — Tool catalog: 5 read tools, 4 surface tools, 3 soft-write tools, 1 control tool. Surface tools pause the loop and resume on a renderer-emitted user-result event.
- **G4** — Full-window `/ai-session/:id` view with 30% TraceSidebar + 70% SurfaceFrame. Live trace shows thought, tool name, result summary, Undo for soft writes.
- **G5** — Session state persisted to electron-store on every event; crash-recoverable. Completed sessions persisted to new `ai_sessions` SQLite table.
- **G6** — Single `trace_id` per session, threaded through every Director step's brainCall, so EconomicsPanel can show per-session cost.
- **G7** — Quest-anchored when an active Quest exists; AI-picks-goal fallback (one-shot read-only Director call) when none.

## 3. Non-goals

- **N1** — Hard mutations as tools. `markMastered`, `advanceLeitnerBox`, `recordSession` are NOT exposed to the Director; they fire as downstream effects of `openLeitnerCard` returning a rating.
- **N2** — Time-based termination (e.g., "15-minute session"). v1 is iteration-bound (budget=12) because Conductor surface tools have unbounded user-time. AI can `endSession` early if goal met.
- **N3** — Multi-session queue, cross-device sync, session templates (rehearsal-only, production-only). v1 is one open session at a time.
- **N4** — Voice or chat-driven session start. v1 entry is BrainOrb right-click menu + "Start AI session."
- **N5** — Mid-session Quest switching. Session is bound to whatever Quest (or AI-picked goal) it was created with.
- **N6** — Director.js becoming session-aware. SessionRunner is the only session-aware unit; Director stays single-decision.

## 4. Architecture

### 4.1 Layered shape

```
SessionRunner (main process, new)
  ├── owns SessionState { id, questId|goal, traceId, iteration, budget, trace[], snapshot }
  ├── main loop:
  │     1. Director.step(state) → { tool, args, reason }
  │     2. dispatch by tool.kind:
  │          'read'    → execute handler, append observation to state, loop
  │          'surface' → emit IPC 'session:openSurface', await 'session:userResult', loop
  │          'soft-write' → execute handler, append trace + register Undo, loop
  │          'control' → endSession → finalize + persist + broadcast done
  │     3. broadcast `session:<id>:trace` event each step
  │     4. persist SessionState snapshot on every mutation
  └── IPC: session:start, session:userResult, session:cancel, session:get,
           session:undoSoftWrite

Director (refactor of 10a)
  ├── step(state) → { tool, args, reason }  ← extracted single-decision primitive
  └── run(config, input) → unchanged 10a behavior, now a loop around step()

Spine (9a–e, unchanged)
  └── all tool handlers register via Tool.registerHandler.
      Surface tool handlers emit IPC event + return pending promise SessionRunner awaits.
      Soft-write handlers execute and write a ledger row (intent='session-soft-write:<name>').
```

### 4.2 File layout

```
src/main/brain/director/
  Director.js                          ← refactor: extract step() from run()
  SessionRunner.js                     ← new — session orchestrator
  configs/
    pullSuggestion.js                  ← 10a, unchanged
    studySession.js                    ← new — Director config + SessionRunner config
  tools/
    topUnmasteredConcepts.js           ← 10a
    recentEpisodeSummary.js            ← 10a
    currentQuestProgress.js            ← 10a
    dueReviewsByDomain.js              ← new — read
    recentlyAcceptedMicroCards.js      ← new — read
    openLeitnerCard.js                 ← new — surface
    openComprehensionPanel.js          ← new — surface
    openMicroCardChip.js               ← new — surface
    openMoodBoard.js                   ← new — surface
    scheduleReread.js                  ← new — soft-write
    createMicroCard.js                 ← new — soft-write
    scheduleProductionPrompt.js        ← new — soft-write
    endSession.js                      ← new — control

src/main/db/
  AISessionStore.js                    ← new — ai_sessions table CRUD

src/main/brain/director/
  UndoRegistry.js                      ← new — soft-write reversal handlers

src/main/ipc/
  sessionHandlers.js                   ← new — session:* channels

src/renderer/api/
  sessionApi.js                        ← new — thin IPC client

src/renderer/views/aiSession/
  AISessionView.jsx                    ← new — /ai-session/:id full-window
  TraceSidebar.jsx                     ← new — live trace stream
  SurfaceFrame.jsx                     ← new — renders active surface
  SessionStartDialog.jsx               ← new — Quest pick / AI-pick confirmation
  SessionSummaryView.jsx               ← new — end-of-session recap

db.sql
  + ai_sessions table
  + ai_session_trace table (one row per Director step)
```

### 4.3 SessionState shape

```js
{
  id: string,                          // uuid
  userId: number,
  questId: number | null,              // null if AI-picked goal
  goal: string,                        // human-readable session goal
  traceId: string,                     // single uuid for whole session, threaded into every brainCall
  status: 'active' | 'paused' | 'completed' | 'errored',
  iteration: number,
  budget: 12,
  trace: TraceEvent[],                 // append-only log of every step
  pendingSurface: { tool, args } | null, // set when awaiting user result
  softWrites: SoftWrite[],             // for Undo
  startedAt: number,
  endedAt: number | null,
  errorReason: string | null,
}

TraceEvent =
  | { kind: 'thought',    iteration, reason, ts }
  | { kind: 'tool',       iteration, tool, args, ts }
  | { kind: 'observation',iteration, summary, ts }
  | { kind: 'surface',    iteration, tool, args, userResult, ts }
  | { kind: 'soft-write', iteration, tool, args, callId, undoable, ts }
  | { kind: 'error',      iteration, message, ts }
  | { kind: 'end',        iteration, reason, ts }

SoftWrite = { id, tool, args, callId, executedAt, undone: bool }
```

### 4.4 Tool kind contract

Each tool registers with `kind` so SessionRunner can dispatch:

```js
// tool registration
tools.register('openLeitnerCard', {
  description: '...',
  argsSchema: { ... },
  kind: 'surface',     // 'read' | 'surface' | 'soft-write' | 'control'
});
tools.registerHandler('openLeitnerCard', async (args, ctx) => {
  // Surface handlers:
  //   emit IPC 'session:openSurface' { sessionId, tool, args }
  //   return a Promise that resolves when 'session:userResult' fires for this sessionId
  return ctx.awaitUserResult(args);
});
```

`ctx` is injected by SessionRunner: `{ sessionId, userId, awaitUserResult(args) }`.

### 4.5 Lifecycle (happy path)

```
1. User: BrainOrb → "Start AI session"
2. SessionStartDialog:
   - if active Quest → "Start session for Quest: <title>"? [Start] [Pick different goal]
   - else → SessionRunner.proposeGoals(userId) (Director one-shot, read-only) → show 2-3 cards
3. session:start IPC → SessionRunner.start({ userId, questId|goal })
   - creates SessionState, persists, returns { sessionId, traceId }
4. Renderer navigates to /ai-session/:id
5. AISessionView subscribes to session:<id>:trace channel
6. SessionRunner loop begins:
   loop:
     event = Director.step(state) via brainCall(intent='director-session-step', { state, tools })
     broadcast 'thought' + 'tool' trace events
     switch (event.tool.kind):
       'read':
         result = await handler(args, ctx)
         state.observations.push({ tool, summary: summarize(result) })
         broadcast 'observation'
       'surface':
         state.pendingSurface = { tool, args }
         broadcast 'surface' (awaiting)
         persist; SurfaceFrame renders args.tool
         userResult = await ctx.awaitUserResult()
         state.pendingSurface = null
         state.observations.push({ tool, summary: summarizeUserResult(userResult) })
         broadcast 'surface' (resolved)
       'soft-write':
         result = await handler(args, ctx)  // executes, returns callId
         state.softWrites.push({ id, tool, args, callId, undoable: true })
         broadcast 'soft-write'
       'control' (endSession):
         broadcast 'end' { reason: args.reason }
         break loop
     iteration++
     if iteration >= budget: forced endSession reason='budget-exhausted'
     persist snapshot
7. SessionRunner.finalize: write to ai_sessions + ai_session_trace tables, clear active snapshot
8. Renderer routes to SessionSummaryView with trace + costs
```

### 4.6 IPC channels

```
main exposes:
  session:start                { userId, questId? | goal? } → { sessionId, traceId }
  session:proposeGoals         { userId } → [{ goal, reason }] (Director one-shot)
  session:userResult           { sessionId, result } → void   (renderer reports surface completion)
  session:cancel               { sessionId } → void
  session:get                  { sessionId } → SessionState
  session:undoSoftWrite        { sessionId, softWriteId } → { undone: bool }
  session:listCompleted        { userId, limit? } → [{ id, goal, endedAt, ... }]
  session:getTrace             { sessionId } → TraceEvent[]
main broadcasts (on event emitter, subscribed via renderer.on):
  session:<id>:trace           TraceEvent
  session:<id>:openSurface     { tool, args }   (renderer renders this in SurfaceFrame)
  session:<id>:status          { status, errorReason? }
```

### 4.7 Persistence

- **Active session snapshot** → electron-store key `aiSession.active`. Single active session at a time. Overwritten on every mutation. Cleared on completion.
- **Completed sessions** → SQLite `ai_sessions` (id, user_id, quest_id, goal, trace_id, status, iteration, started_at, ended_at, error_reason) + `ai_session_trace` (session_id, iteration, kind, payload_json, ts).
- **Crash recovery**: on app boot, BrainShell checks `aiSession.active`. If present + status='active', shows "Resume session?" pill in BrainOrb. Resume re-attaches SessionRunner to the persisted state.

### 4.8 Safety & failure recovery

| Failure | Recovery |
|---|---|
| Director.step returns unknown tool name | Trace 'error', retry once with refined context appending "<tool> is not registered, pick a valid tool." |
| Director.step returns malformed JSON | Deterministic fallback: pick `topUnmasteredConcepts` if iteration=0 else `openLeitnerCard` with top concept |
| Surface tool idle > 5 min (no userResult) | Status → 'paused'. Persist. User can resume from BrainOrb. |
| Soft-write handler throws | Trace 'error', continue loop. Soft-write NOT added to softWrites[]. |
| 3 consecutive errors | Forced endSession with reason='consecutive-errors'. Status='errored'. SummaryView shows what happened. |
| Iteration budget hit before endSession tool | Forced endSession reason='budget-exhausted'. |
| `brainCall` throws (no provider, network error) | Single retry. If retry fails, errored end. |
| User clicks "End session" mid-session | Cancel current step (if surface, no userResult cancel), forced endSession reason='user-cancel'. |

### 4.9 Intent registry additions

Two new intents register in `src/main/brain/spine/seedIntents.js`:

```js
'director-session-step': {
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery'],
  costCeilingTokens: 2000,        // per step; budget=12 caps total
  cachePolicy: 'none',            // each step is path-dependent
  schema: { tool: 'string', args: 'object', reason: 'string' },
},
'session-soft-write': {
  contextSlices: [],              // pure write — no LLM context needed
  costCeilingTokens: 200,         // acknowledgement only
  cachePolicy: 'none',
  schema: null,
},
```

Soft-write tools use `legacyLabel: 'session-soft-write:<toolName>'` so EconomicsPanel groups them.

### 4.10 Director config for sessions

```js
// configs/studySession.js
module.exports = {
  intent: 'director-session-step',
  tools: [
    'topUnmasteredConcepts', 'recentEpisodeSummary', 'currentQuestProgress',
    'dueReviewsByDomain', 'recentlyAcceptedMicroCards',
    'openLeitnerCard', 'openComprehensionPanel', 'openMicroCardChip', 'openMoodBoard',
    'scheduleReread', 'createMicroCard', 'scheduleProductionPrompt',
    'endSession',
  ],
  promptTemplate: ({ goal, observations, softWrites, iteration, budget }) => `
You are conducting a study session.

Goal: ${goal}
Iteration: ${iteration}/${budget}
Observations so far: ${JSON.stringify(observations)}
Soft writes so far: ${softWrites.map(w => w.tool).join(', ') || 'none'}

Pick ONE tool to invoke next, or call endSession if the goal is satisfied.
Return JSON: { "tool": "<name>", "args": {...}, "reason": "<one sentence>" }.
`,
  responseSchema: { /* { tool, args, reason } */ },
  fallback: { tool: 'topUnmasteredConcepts', args: { n: 5 } },
};
```

## 5. Components

### 5.1 SessionRunner (sketch)

```js
class SessionRunner {
  constructor({ store, director, tools, ipc, costEstimator }) { ... }

  async start({ userId, questId, goal }) {
    const state = newSessionState({ userId, questId, goal });
    await this.store.saveActive(state);
    this.runLoop(state).catch(err => this.handleFatal(state, err));
    return { sessionId: state.id, traceId: state.traceId };
  }

  async runLoop(state) {
    while (state.status === 'active') {
      const decision = await this.director.step({
        intent: 'director-session-step',
        state, traceId: state.traceId,
        tools: this.toolDescriptors(),
      });
      this.broadcast(state.id, { kind: 'thought', iteration: state.iteration, reason: decision.reason });
      this.broadcast(state.id, { kind: 'tool', iteration: state.iteration, tool: decision.tool, args: decision.args });

      const tool = tools.get(decision.tool);
      try {
        if (tool.kind === 'control') { await this.endSession(state, decision.args.reason); break; }
        if (tool.kind === 'read') {
          const result = await tool.handler(decision.args, this.ctx(state));
          state.observations.push({ tool: decision.tool, summary: summarize(result) });
          this.broadcast(state.id, { kind: 'observation', iteration: state.iteration, summary: summarize(result) });
        } else if (tool.kind === 'surface') {
          state.pendingSurface = { tool: decision.tool, args: decision.args };
          this.broadcast(state.id, { kind: 'surface', iteration: state.iteration, tool: decision.tool, args: decision.args });
          await this.store.saveActive(state);
          const userResult = await this.awaitUserResult(state.id, /*timeout*/ 5 * 60 * 1000);
          state.pendingSurface = null;
          state.observations.push({ tool: decision.tool, summary: summarizeUserResult(userResult) });
        } else if (tool.kind === 'soft-write') {
          const { callId } = await tool.handler(decision.args, this.ctx(state));
          const sw = { id: uuid(), tool: decision.tool, args: decision.args, callId, executedAt: Date.now(), undone: false };
          state.softWrites.push(sw);
          this.broadcast(state.id, { kind: 'soft-write', iteration: state.iteration, ...sw });
        }
        state.iteration++;
        await this.store.saveActive(state);
        if (state.iteration >= state.budget) { await this.endSession(state, 'budget-exhausted'); break; }
      } catch (e) {
        await this.handleStepError(state, e);
      }
    }
  }

  async endSession(state, reason) {
    state.status = reason === 'consecutive-errors' ? 'errored' : 'completed';
    state.errorReason = reason === 'consecutive-errors' ? state.lastError : null;
    state.endedAt = Date.now();
    this.broadcast(state.id, { kind: 'end', iteration: state.iteration, reason });
    await this.aiSessionStore.persistCompleted(state);
    await this.store.clearActive();
  }
}
```

### 5.2 Director.step extraction

Existing `Director.run(config, input)` becomes:

```js
async function run(config, input) {
  let state = { input, observations: [], iteration: 0 };
  while (state.iteration < config.budget) {
    const decision = await step({ config, state });
    if (decision.tool === '__answer__') return decision.answer;
    const result = await tools.invoke(decision.tool, decision.args);
    state.observations.push({ tool: decision.tool, result });
    state.iteration++;
  }
  return config.fallback;
}

async function step({ config, state, traceId }) {
  const prompt = config.promptTemplate(state);
  const decision = await brainCall(config.intent, {
    prompt, schema: config.responseSchema,
    traceId,  // ← propagate Phase 10a trace_id
  });
  return decision;
}
```

`step` is the new export — called by SessionRunner per iteration. `run` is unchanged 10a behavior (used by pull-suggestion).

### 5.3 Soft-write tool example: scheduleReread

```js
// tools/scheduleReread.js
tools.register('scheduleReread', {
  description: 'Schedule a chapter for spaced rereading. Reversible.',
  kind: 'soft-write',
  argsSchema: { bookId: 'number', chapterId: 'string', reason: 'string' },
});
tools.registerHandler('scheduleReread', async (args, ctx) => {
  const { callId } = await meteredCallJson(
    `Acknowledge schedule: ${args.reason}`, null,
    { legacyLabel: 'session-soft-write:scheduleReread', triggerId: null, traceId: ctx.traceId }
  );
  RereadQueueService.schedule(ctx.userId, args.bookId, args.chapterId, args.reason);
  return { callId };
});
```

Soft-write handlers route through `meteredCallJson` (or a no-LLM variant for write-only tools) so each write has a ledger row and Economics Panel sees it. Undo path:

```js
ipcMain.handle('session:undoSoftWrite', async (e, { sessionId, softWriteId }) => {
  const state = sessionRunner.getActive(sessionId);
  const sw = state.softWrites.find(s => s.id === softWriteId && !s.undone);
  if (!sw) return { undone: false };
  await UndoRegistry.run(sw.tool, sw.args);  // tool-specific reversal
  sw.undone = true;
  await store.saveActive(state);
  return { undone: true };
});
```

### 5.4 Surface tool example: openLeitnerCard

```js
tools.register('openLeitnerCard', {
  description: 'Open a Leitner-system card for the user to rate. Returns { rating, durationMs }.',
  kind: 'surface',
  argsSchema: { learningPointId: 'number' },
});
tools.registerHandler('openLeitnerCard', async (args, ctx) => {
  return ctx.awaitUserResult({ tool: 'openLeitnerCard', args });
});
```

The handler is trivial because the dispatcher (SessionRunner) handles surface await. The renderer's `AISessionView` listens for `session:<id>:openSurface` and renders the existing Leitner card UI inside `SurfaceFrame`. When the card resolves (rating submitted), renderer calls `session:userResult` with `{ rating, durationMs }`. That side-effects the SRS update (existing rating handler) and resolves the Director's observation.

### 5.5 UI layout

```
+---------------------------------------------------------------+
| AppBar: [Quest: <title>]  Iter: 4/12  Cost: $0.012  [End]     |
+---------------+-----------------------------------------------+
| TraceSidebar  | SurfaceFrame                                  |
| (30%)         | (70%)                                         |
|               |                                               |
| ▸ thought:    | [current surface — Leitner card / Compre /    |
|   "Review     |   MoodBoard / empty "Thinking..." state ]     |
|   the oldest  |                                               |
|   due card    |                                               |
|   first"      |                                               |
| ▸ openLeitner |                                               |
|   Card #142   |                                               |
| ▸ scheduleReread                                              |
|   Ch 3 [Undo] |                                               |
| ▸ ...         |                                               |
+---------------+-----------------------------------------------+
```

## 6. Success criteria

- All Phase 9a–10a tests pass (regression).
- New tests:
  - `Director.step` unit tests: returns `{tool, args, reason}` given mock brainCall response.
  - `SessionRunner` orchestration tests for each tool kind dispatch (read, surface, soft-write, control).
  - Surface await semantics: dispatcher pauses, resumes on userResult.
  - Persistence: snapshot rehydration after simulated crash.
  - Failure modes: unknown tool retry, malformed JSON fallback, consecutive-error termination, budget-exhausted termination.
  - `ai_sessions` table CRUD + completed-session persistence.
- Integration test: full happy-path session start → 3 read tools + 2 surfaces + 1 soft write + endSession → SessionSummaryView data.
- Manual: boot app, start session bound to active Quest, complete 3+ iterations, see live trace, undo a soft write, end session, see summary.
- EconomicsPanel shows a `director-session-step` row aggregated by `traceId` (per-session cost).
- Session resume after simulated crash works end-to-end.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Director picks endSession too eagerly | Prompt requires `reason` arg with rationale; if iteration < 3, ignore endSession and retry with refined prompt. |
| Surface handler blocks forever (user walks away) | 5-minute idle timeout → status='paused'. Resume from BrainOrb. |
| Soft-write Undo not reversible (e.g., createMicroCard was already reviewed) | UndoRegistry handler checks state; if not reversible, returns `{ undone: false, reason }` and trace marks as undo-unavailable. |
| Single active session race (user starts second session) | `aiSession.active` is single-slot. Starting a new session shows "An active session exists — resume or discard?" |
| Director loop costs explode | EconomicsPanel + ceiling. Each director-session-step has `costCeilingTokens` in intent registry. Budget=12 caps iterations. |
| `trace_id` propagation regression | Test: every ledger row in a session has the same `trace_id`. |
| Snapshot rehydration data shape drift | `SessionState.version` field; rehydrator migrates or discards stale shapes. |

## 8. Out of scope / follow-up

- **10c (potential)** — session templates ("rehearsal-only", "production-only", "exploration"), Director config selected at start.
- **10d (potential)** — concurrent sessions, multi-device sync.
- **Phase 11** — Brain Visibility (cross-session analytics; how Director choices changed mastery over time).
- **Voice / chat-driven start** — "Hey Brain, run a 20-minute rehearsal" → maps to studySession config.
