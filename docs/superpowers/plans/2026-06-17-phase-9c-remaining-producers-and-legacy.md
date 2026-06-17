# Phase 9c — Remaining Producers + Legacy Metering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the remaining Phase 0–8 Trigger-producing services through `brainCall`, and instrument the legacy 21-route LLM call sites with `meteredCall` so the Economics Panel covers total LLM spend.

**Architecture:** Continues the Migration Recipe from Plan 9b. For Trigger-producing services (Phase 8a/8b/8c + Argument X-ray + Pull Suggestion + Tutor Context) the full recipe applies. For legacy sites (translate / grammar / writing / chat / browser) only `meteredCall` is wrapped — no context injection, no Rationale Card.

**Tech Stack:** Same as Plan B. Depends on Plans 9a + 9b being merged.

**Spec:** [docs/superpowers/specs/2026-06-17-phase-9-brain-spine-design.md](../specs/2026-06-17-phase-9-brain-spine-design.md)
**Predecessors:** [Phase 9a Foundation plan](./2026-06-17-phase-9a-brain-spine-foundation.md), [Phase 9b First Producers + Surfaces plan](./2026-06-17-phase-9b-first-producers-and-surfaces.md)

---

## Migration Recipe — same as Plan 9b

For Brain-mediated migrations (Tasks 1–6), apply the Migration Recipe from Plan 9b section "Migration Recipe (canonical procedure)":

1. Locate the LLM call (`grep getStructured\|generateContent`).
2. Identify the prompt input (the task-specific text).
3. Replace with `brainCall('<intent-name>', input, { userId, contextOverrides })`.
4. After trigger emit, `CallLedgerStore.bindTriggerId(callId, triggerId)`.
5. Update the service's integration test to mock `'../main/brain/spine'`.

For legacy `meteredCall` instrumentation (Tasks 7–11), the simpler recipe:

A. Locate the LLM call.
B. Import `{ meteredCall }` from the spine.
C. Replace `await provider.generateContent(prompt)` with `await meteredCall(provider, prompt, { legacyLabel: '<feature>' })` and extract `.output` from the result.
D. Smoke-run the feature end-to-end manually; confirm a row appears in `brain_call_ledger` with intent `legacy:<feature>`.

---

## File Structure

**Modified — Brain-mediated migrations:**
- `src/main/utils/RereadQueueService.js`
- `src/main/utils/MoodBoardOrganizerService.js`
- `src/main/brain/ProductionPromptService.js`
- `src/main/utils/ArgumentXrayService.js`
- `src/main/brain/LearningBrainAgent.js` — `synthesizePullSuggestion` method
- `src/renderer/utils/tutorContext.js`

**Modified — Legacy metering:**
- `src/renderer/views/translate/TranslateMainPage.js` (and any sibling LLM call site)
- `src/renderer/views/grammar/GrammarMainPage.js`, `src/renderer/views/grammar/CorrectionCard.js`
- `src/renderer/views/writing/WritingView.js`, `src/renderer/views/writing/ComparisonExercise.js`
- `src/renderer/components/chat/InContextChatPanel.js`, `src/renderer/views/chat/ChatDetailPanel.js`
- `src/renderer/views/browser/Browser.js`, `src/renderer/views/browser/RewriteHelper.js`, `src/renderer/components/web-based-search/`

**Verification:**
- Manual end-to-end pass over all migrated surfaces.

---

## Task 1: Migrate RereadQueueService (Phase 8a) — Migration Recipe

**Files:**
- Modify: `src/main/utils/RereadQueueService.js`
- Modify: Phase 8a integration test

- [ ] **Step 1: Locate the LLM call**

Run: `grep -n "getStructured\|generateContent" src/main/utils/RereadQueueService.js`

Note: RereadQueueService may not currently call an LLM — the spec assigns it the `schedule-reread` intent, but if the service simply pushes to electron-store with no LLM call, the migration is skipped here. Verify before continuing.

- [ ] **Step 2: If an LLM call exists, replace it**

```js
const { brainCall } = require('../brain/spine');
const CallLedgerStore = require('../db/CallLedgerStore');

const { output, callId } = await brainCall(
  'schedule-reread',
  `Decide whether to schedule a re-read for chapter ${chapterIndex} of book ${bookId} given comprehension score ${score}.`,
  { userId },
);
this._lastCallId = callId;
```

If no LLM call exists, mark the migration as N/A and proceed to Task 2. The reread queue still emits a trigger; Phase 9 just doesn't add a ledger row in that case.

- [ ] **Step 3: Bind triggerId (if applicable)**

In `src/main/ipc/rereadQueueHandlers.js`, after the trigger emit:
```js
if (queueService._lastCallId && trigger.id) {
  CallLedgerStore.bindTriggerId(queueService._lastCallId, trigger.id);
}
```

- [ ] **Step 4: Run Phase 8a integration test**

Run: `npx jest src/__tests__/integration/phase8a-*.test.js` (or the closest match — check `ls src/__tests__/integration/`)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/utils/RereadQueueService.js src/main/ipc/rereadQueueHandlers.js src/__tests__/integration/
git commit -m "refactor(phase8a): migrate RereadQueueService through brainCall (if applicable)"
```

---

## Task 2: Migrate MoodBoardOrganizerService (Phase 8b) — Migration Recipe

**Files:**
- Modify: `src/main/utils/MoodBoardOrganizerService.js`
- Modify: Phase 8b integration test

- [ ] **Step 1: Locate the LLM call**

Run: `grep -n "getStructured\|generateContent" src/main/utils/MoodBoardOrganizerService.js`

- [ ] **Step 2: Replace**

```js
const { brainCall } = require('../brain/spine');
const CallLedgerStore = require('../db/CallLedgerStore');

const clusterText = cluster.points.map((p) => `- ${p.concept}: ${p.summary}`).join('\n');
const { output, callId } = await brainCall(
  'suggest-organize',
  `Propose how to organize these related learning points on a MoodBoard:\n${clusterText}`,
  {
    userId,
    schema: ORGANIZE_SCHEMA,  // existing constant in MoodBoardOrganizerService
    contextOverrides: { currentBook: { bookId: cluster.bookId } },
  },
);
this._lastCallId = callId;
```

- [ ] **Step 3: Bind triggerId**

In `src/main/ipc/moodBoardOrganizerHandlers.js`, after the trigger emit:
```js
if (organizer._lastCallId && trigger.id) {
  CallLedgerStore.bindTriggerId(organizer._lastCallId, trigger.id);
}
```

- [ ] **Step 4: Run Phase 8b test**

Run: `npx jest src/__tests__/integration/phase8b-*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/utils/MoodBoardOrganizerService.js src/main/ipc/moodBoardOrganizerHandlers.js src/__tests__/integration/
git commit -m "refactor(phase8b): migrate MoodBoardOrganizerService through brainCall"
```

---

## Task 3: Migrate ProductionPromptService (Phase 8c) — Migration Recipe

**Files:**
- Modify: `src/main/brain/ProductionPromptService.js`
- Modify: Phase 8c integration test

- [ ] **Step 1: Locate the LLM call**

Run: `grep -n "getStructured\|generateContent" src/main/brain/ProductionPromptService.js`

- [ ] **Step 2: Replace**

```js
const { brainCall } = require('../spine');
const CallLedgerStore = require('../../db/CallLedgerStore');

const { output, callId } = await brainCall(
  'schedule-production-prompt',
  `Generate a production prompt that asks the learner to use the concept "${lp.concept}" in a novel context. Mastery level: ${lp.mastery_level}.`,
  { userId, schema: PRODUCTION_PROMPT_SCHEMA },  // existing constant in ProductionPromptService
);
this._lastCallId = callId;
```

Note: `ProductionPromptService` lives under `src/main/brain/`, so its import path for the spine is `'../spine'` (no `brain/` prefix).

- [ ] **Step 3: Bind triggerId**

In `src/main/ipc/productionPromptHandlers.js`, after the trigger emit:
```js
if (service._lastCallId && trigger.id) {
  CallLedgerStore.bindTriggerId(service._lastCallId, trigger.id);
}
```

- [ ] **Step 4: Run Phase 8c test**

Run: `npx jest src/__tests__/integration/phase8c-*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/ProductionPromptService.js src/main/ipc/productionPromptHandlers.js src/__tests__/integration/
git commit -m "refactor(phase8c): migrate ProductionPromptService through brainCall"
```

---

## Task 4: Migrate ArgumentXrayService — Migration Recipe

**Files:**
- Modify: `src/main/utils/ArgumentXrayService.js`
- Modify: `src/__tests__/brain/ArgumentXrayService.test.js`

- [ ] **Step 1: Locate the LLM call**

Run: `grep -n "getStructured\|generateContent" src/main/utils/ArgumentXrayService.js`

From the earlier survey, this service uses `getStructured` directly with a CLAIMS_EVIDENCE schema.

- [ ] **Step 2: Replace**

```js
const { brainCall } = require('../brain/spine');

async function detectClaimsAndEvidence(paragraph, { userId, bookId, chapterIndex }) {
  const cacheable = paragraph.text.length < 3000; // short paragraphs benefit from cache
  const { output, callId, cacheHit } = await brainCall(
    'argument-xray',
    `Identify claim phrases and evidence phrases in this paragraph:\n\n${paragraph.text}`,
    {
      userId,
      schema: SCHEMA,  // existing claims/evidence schema in ArgumentXrayService
      contextOverrides: { currentBook: { bookId, chapterIndex } },
    },
  );
  return { claims: output.claims || [], evidence: output.evidence || [], callId, cacheHit };
}
```

The Argument X-ray currently surfaces inline (not via Orb), so no trigger binding is needed; the `callId` is still recorded for the Economics Panel.

- [ ] **Step 3: Update the test**

```js
jest.mock('../../main/brain/spine', () => ({
  brainCall: jest.fn().mockResolvedValue({
    output: { claims: ['Bonds rise when rates fall'], evidence: ['Historical data shows'] },
    callId: 10,
    cacheHit: false,
  }),
}));
```

- [ ] **Step 4: Run the test**

Run: `npx jest src/__tests__/brain/ArgumentXrayService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/utils/ArgumentXrayService.js src/__tests__/brain/ArgumentXrayService.test.js
git commit -m "refactor(argument-xray): migrate ArgumentXrayService through brainCall"
```

---

## Task 5: Migrate synthesizePullSuggestion — Migration Recipe

**Files:**
- Modify: `src/main/brain/LearningBrainAgent.js`
- Modify: any existing test referencing `synthesizePullSuggestion`

- [ ] **Step 1: Locate the LLM call**

Run: `grep -n "synthesizePullSuggestion" src/main/brain/LearningBrainAgent.js`

- [ ] **Step 2: Replace the inner LLM call**

Inside `synthesizePullSuggestion(...)`, replace the existing direct provider call:

```js
const { brainCall } = require('./spine');

async function synthesizePullSuggestion({ userId } = { userId: 1 }) {
  try {
    const { output } = await brainCall(
      'synthesize-pull-suggestion',
      `Decide one concrete next action for the learner right now.`,
      {
        userId,
        schema: {
          type: 'object',
          properties: {
            title:    { type: 'string' },
            body:     { type: 'string' },
            navigate: { type: 'string' },
          },
          required: ['title', 'body'],
        },
      },
    );
    if (output && output.title) {
      return { ...output, source: 'llm' };
    }
  } catch (_e) {
    // fall through to deterministic
  }
  return this._deterministicFallback(userId);
}
```

Keep the deterministic fallback path intact. Move it into a private method if it isn't one already.

- [ ] **Step 3: Update tests**

Mock `'./spine'` similarly:
```js
jest.mock('../../main/brain/spine', () => ({
  brainCall: jest.fn().mockResolvedValue({
    output: { title: 'Try this', body: 'Read chapter 3', navigate: 'reading/1' },
    callId: 11,
  }),
}));
```

- [ ] **Step 4: Run tests**

Run: `npx jest -t "synthesizePullSuggestion|pullSuggestion|pull suggestion"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/LearningBrainAgent.js src/__tests__/
git commit -m "refactor(brain): synthesizePullSuggestion goes through brainCall"
```

---

## Task 6: Migrate tutorContext — Migration Recipe

**Files:**
- Modify: `src/renderer/utils/tutorContext.js`

- [ ] **Step 1: Locate the LLM call**

`tutorContext` builds a system prompt; if it has its own LLM call (some implementations call an LLM to summarize learner state) replace it. If not, the migration is N/A — tutorContext just builds prompt text that another caller dispatches.

Run: `grep -n "ipcRenderer\.invoke\|generateContent" src/renderer/utils/tutorContext.js`

- [ ] **Step 2: Decision**

- **If tutorContext only constructs a string:** no migration. The system-prompt construction already aligns with the spine's intent of explicit context. Add a one-line doc note that this file is the renderer-side equivalent of the `tutor-context` intent and that future Director Mode should consume `intents.resolve('tutor-context').contextSlices` for parity.
- **If tutorContext calls an LLM** (e.g. to compress recent episodes into a paragraph): migrate that call through an IPC handler that uses `brainCall('tutor-context', ...)`. Add the handler in `src/main/ipc/brainHandlers.js` and the renderer caller invokes `ipcRenderer.invoke('brain:buildTutorContext')`.

- [ ] **Step 3: Add the doc note (or implement migration per Step 2 decision)**

```js
// Renderer-side companion to the `tutor-context` Intent. When Director Mode
// (Phase 10) lands, this will read its slice list from
// intents.resolve('tutor-context').contextSlices instead of duplicating the list.
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/utils/tutorContext.js
git commit -m "docs(tutor-context): align renderer helper with tutor-context Intent"
```

---

## Task 7: meteredCall — translate routes

**Files:**
- Modify: `src/renderer/views/translate/TranslateMainPage.js`
- Modify: `src/renderer/views/translate/StepTwoVerbCard.js`
- Modify: `src/main/main.ts` or `src/main/ipc/` — wherever the IPC handler dispatching translate runs

- [ ] **Step 1: Locate the LLM call**

Translate calls are typically dispatched via IPC to the main process where the provider call happens. Run:
`grep -n "aiProviderManager\|generateContent" src/main/main.ts | head -20`

Identify the handler(s) that serve the translate flow.

- [ ] **Step 2: Wrap with meteredCall**

For each identified call site, replace:
```js
const result = await provider.generateContent(prompt);
```
with:
```js
const { meteredCall } = require('./brain/spine');
const { output: result } = await meteredCall(provider, prompt, { legacyLabel: 'translate' });
```

- [ ] **Step 3: Manual verification**

Run: `npm start`. Open Translate. Run a sample translation. Open the Brain Dashboard's Economics Panel. Confirm a row with intent `legacy:translate` appears.

- [ ] **Step 4: Commit**

```bash
git add src/main/main.ts src/main/ipc/
git commit -m "feat(spine): meter translate LLM calls via meteredCall"
```

---

## Task 8: meteredCall — grammar routes

**Files:**
- Modify: handlers serving `GrammarMainPage`, `CorrectionCard`

- [ ] **Step 1: Locate**

Run: `grep -rn "aiProviderManager\|generateContent" src/main/ src/renderer/views/grammar/ | head -20`

- [ ] **Step 2: Wrap**

Replace each main-process call site:
```js
const { meteredCall } = require('./brain/spine');
const { output: result } = await meteredCall(provider, prompt, { legacyLabel: 'grammar' });
```

- [ ] **Step 3: Manual verification**

Boot, run a grammar correction, confirm `legacy:grammar` row.

- [ ] **Step 4: Commit**

```bash
git add src/main/
git commit -m "feat(spine): meter grammar LLM calls via meteredCall"
```

---

## Task 9: meteredCall — writing routes

**Files:**
- Modify: handlers serving `WritingView`, `ComparisonExercise`

- [ ] **Step 1: Locate**

Run: `grep -rn "aiProviderManager\|generateContent" src/renderer/views/writing/ src/main/ | head -20`

- [ ] **Step 2: Wrap**

```js
const { meteredCall } = require('./brain/spine');
const { output: result } = await meteredCall(provider, prompt, { legacyLabel: 'writing' });
```

- [ ] **Step 3: Manual verification**

Boot, run a writing comparison, confirm `legacy:writing` row.

- [ ] **Step 4: Commit**

```bash
git add src/main/
git commit -m "feat(spine): meter writing LLM calls via meteredCall"
```

---

## Task 10: meteredCall — chat routes

**Files:**
- Modify: handlers serving `ChatDetailPanel`, `InContextChatPanel`

- [ ] **Step 1: Locate**

Run: `grep -rn "aiProviderManager\|generateContent" src/main/ipc/ src/main/main.ts | grep -i "chat" | head -10`

Note: chat may use streaming, in which case `meteredCall` needs a streaming-aware sibling. For Phase 9, wrap the non-streaming send path only and skip streaming sites with a TODO comment referencing this plan.

- [ ] **Step 2: Wrap non-streaming sends**

```js
const { meteredCall } = require('./brain/spine');
const { output: result } = await meteredCall(provider, prompt, { legacyLabel: 'chat' });
```

For streaming sites, add:
```js
// TODO(phase-9): wrap streaming send through meteredCall.streaming once added.
```

- [ ] **Step 3: Manual verification**

Boot, send a chat message, confirm `legacy:chat` row appears (or only on non-streaming).

- [ ] **Step 4: Commit**

```bash
git add src/main/
git commit -m "feat(spine): meter chat LLM calls via meteredCall (non-streaming)"
```

---

## Task 11: meteredCall — browser StudyEnhancer + RewriteHelper + smart-summary

**Files:**
- Modify: handlers serving `Browser`, `RewriteHelper`, `web-based-search`

- [ ] **Step 1: Locate**

Run: `grep -rn "aiProviderManager\|generateContent" src/renderer/views/browser/ src/renderer/components/web-based-search/ src/main/ | head -20`

- [ ] **Step 2: Wrap each**

Apply the same `meteredCall` wrap. Use distinct labels per surface so the Economics Panel breaks them down cleanly:
- `legacy:browser-summary`
- `legacy:browser-rewrite`
- `legacy:browser-search`

- [ ] **Step 3: Manual verification**

Boot, exercise each surface once, confirm three legacy rows.

- [ ] **Step 4: Commit**

```bash
git add src/main/
git commit -m "feat(spine): meter browser study-enhancer LLM calls via meteredCall"
```

---

## Task 12: Final verification + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md` (add Phase 9 section to "Brain-Driven Learning Loops" table)

- [ ] **Step 1: Final manual sweep**

Boot the app. Exercise each migrated surface at least once. Open Brain Dashboard → Economics Panel. Confirm:
- All 11 Brain-mediated intents (from Plan 9a Task 9 seed list) appear with ≥1 call each.
- All 6 legacy labels (`translate`, `grammar`, `writing`, `chat`, `browser-summary`, `browser-rewrite`, `browser-search`) appear with ≥1 call each.
- Cache hit-rate column shows non-zero for at least one content-hash intent (e.g. re-trigger the same diagnostic).

- [ ] **Step 2: Update CLAUDE.md**

In the "Brain-Driven Learning Loops (Phase 0–8)" section, add a new row beneath the Phase 8c row:

```
| Phase 9 — Brain Spine | every LLM call site | `brain/spine/brainCall` + `meteredCall` (BrainContext + Intent Registry + Tool Registry + Call Ledger) | `RationaleCard` + `EconomicsPanel` in `BrainDashboardPanel` |
```

Update the prose paragraph beneath the table to mention that all Phase 0–8 LLM calls now flow through the spine; legacy 21-route sites are metered via `meteredCall` for cost visibility.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md Phase 9 Brain Spine row + paragraph update"
```

- [ ] **Step 4: Tag Phase 9 complete**

```bash
git tag -a phase-9-complete -m "Phase 9 Brain Spine — all producers migrated, legacy metered"
```

---

## Self-Review Notes

- **Spec coverage:** Migration plan steps 2 (all 8 Trigger-producers — T1–T5 here pick up where Plan B left off), step 6 (argument-xray + synthesize-pull-suggestion + tutor-context — T4, T5, T6), step 7 (legacy meteredCall — T7–T11). Success criteria #1 (all 8 services route through brainCall) and economics coverage are verified manually in T12.
- **No placeholders.** Each migration task points at a concrete grep command. Where the LLM call may not exist (e.g. T1 RereadQueueService), an explicit "N/A — skip" branch is given.
- **Type consistency:** `callId` always number, `triggerId` always string, `legacyLabel` always lowercase-kebab. `meteredCall` always returns `{ output, callId }` (matches `brainCall` shape minus `cacheHit`).
- **Risks flagged:** T10 notes streaming-chat sites are not wrapped in Phase 9 — TODO comment links back here so Phase 10 picks them up.

**Done condition:** every Phase 0–8 LLM call site routes through `brainCall`, every legacy LLM site routes through `meteredCall`, Economics Panel covers full LLM spend, CLAUDE.md reflects the new architecture.
