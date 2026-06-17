# Phase 9b — First Producers + Trust Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate four Phase 0–8 Trigger-producing services through `brainCall`, then build the two user-facing trust surfaces (Rationale Card + Economics Panel) that consume the resulting Call Ledger.

**Architecture:** Each migration replaces the existing ad-hoc `getStructured(provider, prompt, schema, ...)` call with `brainCall(intent, input, { triggerId })`. After the trigger is emitted the service backfills the `triggerId` on the ledger row via a new `bindTriggerId` method. The Rationale Card renders ledger rows looked up by `trigger_id`; the Economics Panel aggregates the same table.

**Tech Stack:** React + MUI (renderer), Jest, electron IPC. Depends on Phase 9a foundation being committed.

**Spec:** [docs/superpowers/specs/2026-06-17-phase-9-brain-spine-design.md](../specs/2026-06-17-phase-9-brain-spine-design.md)
**Predecessor:** [Phase 9a Foundation plan](./2026-06-17-phase-9a-brain-spine-foundation.md)

---

## Migration Recipe (canonical procedure — referenced by Tasks 2–5)

Each Phase service migration follows the same 5-step recipe. Tasks 2–5 each apply this recipe with service-specific specifics filled in.

1. **Locate the LLM call.** Find the call to `getStructured(provider, prompt, schema, ...)` or `aiProviderManager.currentProvider.generateContent(...)` inside the service. Record line numbers.
2. **Identify the prompt input.** The user-facing "what is this call doing" content — typically the paragraph text, chapter contents, or goal description. Everything else (mastery data, quest goals, recent episodes) is context that the spine will inject automatically.
3. **Replace with brainCall.** Import `{ brainCall }` from `'../brain/spine'`. Convert the call site to:
   ```js
   const { output, callId } = await brainCall('<intent-name>', input, {
     userId,
     schema: SCHEMA,           // pass the existing schema constant from the service
     contextOverrides: { currentBook: {...} },
   });
   ```
   Capture `callId` for the bind step. The `schema` option is required when the original service used `getStructured` for structured output — pass the same `SCHEMA` constant that already exists at the top of the service file. Plain-text intents (rare) can omit it.
4. **Bind the triggerId after emit.** After the service emits the trigger, call:
   ```js
   await CallLedgerStore.bindTriggerId(callId, triggerId);
   ```
5. **Run the service's existing integration test** (under `src/__tests__/integration/phase<N>-*.test.js`) and confirm it still passes. The test setup may need to mock `'../main/brain/spine'` instead of mocking the polyfill directly.

The recipe assumes Phase 9a Task 24 end-to-end smoke passes, so the spine is known good.

---

## File Structure

**Created:**
- `src/renderer/components/brainShell/RationaleCard.jsx`
- `src/renderer/components/brainShell/EconomicsPanel.jsx`
- `src/__tests__/renderer/RationaleCard.test.jsx`
- `src/__tests__/renderer/EconomicsPanel.test.jsx`

**Modified:**
- `src/main/db/CallLedgerStore.js` — add `bindTriggerId`
- `src/__tests__/spine/CallLedgerStore.test.js` — add tests for `bindTriggerId`
- `src/main/utils/MicroCardProposer.js` — migrate to `brainCall`
- `src/main/utils/BookDiagnosticService.js` — migrate to `brainCall`
- `src/main/utils/ComprehensionGradingService.js` — migrate to `brainCall`
- `src/main/utils/LearningPathPlannerService.js` — migrate to `brainCall`
- `src/renderer/components/brainShell/AtomicChipHost.jsx` — embed RationaleCard
- `src/renderer/components/brainShell/InlineSequenceHost.jsx` — embed RationaleCard
- `src/renderer/components/brainShell/MultiSurfaceFlowHost.jsx` — embed RationaleCard
- `src/renderer/components/brainShell/BrainDashboardPanel.jsx` — embed EconomicsPanel
- `src/renderer/components/brainShell/TriggerTelemetryPanel.jsx` — add intent column

---

## Task 1: CallLedgerStore.bindTriggerId — TDD

**Files:**
- Modify: `src/main/db/CallLedgerStore.js`
- Modify: `src/__tests__/spine/CallLedgerStore.test.js`

- [ ] **Step 1: Add failing test**

Append to `CallLedgerStore.test.js`:

```js
describe('CallLedgerStore.bindTriggerId', () => {
  test('updates the trigger_id of the given call row', async () => {
    const id = await CallLedgerStore.record({
      intent: 'x', provider: 'p', ts: 100, cache_hit: false, output_summary: 'o',
    });
    await CallLedgerStore.bindTriggerId(id, 'trig_42');
    const row = testDb.prepare('SELECT trigger_id FROM brain_call_ledger WHERE id = ?').get(id);
    expect(row.trigger_id).toBe('trig_42');
  });

  test('throws on unknown callId', async () => {
    expect(() => CallLedgerStore.bindTriggerId(99999, 't'))
      .toThrow(/unknown callId/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js -t "bindTriggerId"`
Expected: FAIL.

- [ ] **Step 3: Implement and export**

In `src/main/db/CallLedgerStore.js`:

```js
function bindTriggerId(callId, triggerId) {
  const db = DBManager.getDb();
  const info = db.prepare(
    'UPDATE brain_call_ledger SET trigger_id = ? WHERE id = ?',
  ).run(triggerId, callId);
  if (info.changes === 0) throw new Error(`unknown callId: ${callId}`);
  return info.changes;
}
```

Add `bindTriggerId` to the `module.exports` object.

- [ ] **Step 4: Run to verify passes**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/db/CallLedgerStore.js src/__tests__/spine/CallLedgerStore.test.js
git commit -m "feat(spine): CallLedgerStore.bindTriggerId for post-emit backfill"
```

---

## Task 2: Migrate MicroCardProposer (Phase 4) — apply Migration Recipe

**Files:**
- Modify: `src/main/utils/MicroCardProposer.js`
- Modify: existing Phase 4 integration test under `src/__tests__/integration/`

- [ ] **Step 1: Locate the LLM call**

Run: `grep -n "getStructured\|generateContent" src/main/utils/MicroCardProposer.js`
Expected: one or more matches. Record the line range covering call site (typically inside a method like `proposeForParagraph`).

- [ ] **Step 2: Replace call site with brainCall**

Replace the existing `const raw = await getStructured(provider, prompt, SCHEMA, {...})` block with:

```js
const { brainCall } = require('../brain/spine');
const CallLedgerStore = require('../db/CallLedgerStore');

// ... inside proposeForParagraph(paragraph, { userId, bookId, chapterIndex }) ...
const { output, callId } = await brainCall(
  'propose-microcard',
  `Propose a single high-value micro-card for the following paragraph:\n\n${paragraph.text}`,
  {
    userId,
    schema: SCHEMA,  // existing constant at top of MicroCardProposer.js
    contextOverrides: {
      currentBook: { bookId, chapterIndex, chapterTitle: paragraph.chapterTitle },
    },
  },
);
this._lastCallId = callId;  // expose so the emit step can bind
```

Remove the now-unused `aiProviderManager` and `getStructured` imports at top of file if no other call site uses them.

- [ ] **Step 3: Bind triggerId after emit**

Find the place where `TriggerEmitter.emit(...)` is called in MicroCardProposer (or wherever the trigger is emitted for an accepted proposal). Right after the emit, add:

```js
if (this._lastCallId && trigger.id) {
  CallLedgerStore.bindTriggerId(this._lastCallId, trigger.id);
}
```

If MicroCardProposer does not directly emit the trigger but returns the proposal to a caller that emits, expose `callId` on the returned object and have the caller call `bindTriggerId(callId, triggerId)`.

- [ ] **Step 4: Update existing Phase 4 test mocks**

Locate the Phase 4 integration test (likely `src/__tests__/integration/phase4-microcard.test.js` or similar). Replace any `jest.mock('../../commons/service/polyfills/structuredOutput', ...)` with a mock of the spine:

```js
jest.mock('../../main/brain/spine', () => ({
  brainCall: jest.fn().mockResolvedValue({
    output: { front: 'q', back: 'a', concept: 'duration' },
    callId: 1,
    cacheHit: false,
  }),
}));
```

Keep the other mocks (DB, AIProviderManager) since the spine is also bypassed by this mock.

- [ ] **Step 5: Run the Phase 4 test**

Run: `npx jest src/__tests__/integration/phase4-microcard.test.js` (adjust filename to actual)
Expected: PASS.

If no Phase 4 integration test exists, add one minimal smoke that asserts `MicroCardProposer.proposeForParagraph(...)` returns a proposal with a `callId` field and that `brainCall` was called with intent `'propose-microcard'`.

- [ ] **Step 6: Commit**

```bash
git add src/main/utils/MicroCardProposer.js src/__tests__/integration/
git commit -m "refactor(phase4): migrate MicroCardProposer through brainCall"
```

---

## Task 3: Migrate BookDiagnosticService (Phase 5) — apply Migration Recipe

**Files:**
- Modify: `src/main/utils/BookDiagnosticService.js`
- Modify: existing Phase 5 integration test

- [ ] **Step 1: Locate the LLM call**

Run: `grep -n "getStructured\|generateContent" src/main/utils/BookDiagnosticService.js`

- [ ] **Step 2: Replace call site**

```js
const { brainCall } = require('../brain/spine');
const CallLedgerStore = require('../db/CallLedgerStore');

// inside diagnose(bookId, { userId }) ...
const { output, callId } = await brainCall(
  'diagnose-book',
  `Diagnose this book for the learner. Title: ${book.title}. TOC:\n${tocText}`,
  { userId, schema: DIAGNOSTIC_SCHEMA },  // existing schema constant in BookDiagnosticService
);
this._lastCallId = callId;
```

- [ ] **Step 3: Bind triggerId after emit**

After the trigger emit (likely emits `book-diagnostic-ready` or similar):

```js
if (this._lastCallId && trigger.id) {
  CallLedgerStore.bindTriggerId(this._lastCallId, trigger.id);
}
```

If BookDiagnosticService surfaces inline via `PreReadingPanel` rather than the Orb (it's marked in-context in CLAUDE.md), there may not be a trigger to bind. In that case, store `callId` on the diagnostic result row so the rationale can still be looked up by call id.

- [ ] **Step 4: Update mocks**

Replace polyfill mock with spine mock in the Phase 5 test:

```js
jest.mock('../../main/brain/spine', () => ({
  brainCall: jest.fn().mockResolvedValue({
    output: { primer: 'a primer', knownConcepts: [], gaps: [] },
    callId: 2,
    cacheHit: false,
  }),
}));
```

- [ ] **Step 5: Run Phase 5 test**

Run: `npx jest src/__tests__/integration/phase5-*.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/utils/BookDiagnosticService.js src/__tests__/integration/
git commit -m "refactor(phase5): migrate BookDiagnosticService through brainCall"
```

---

## Task 4: Migrate ComprehensionGradingService (Phase 6) — apply Migration Recipe

**Files:**
- Modify: `src/main/utils/ComprehensionGradingService.js`
- Modify: existing Phase 6 integration test

- [ ] **Step 1: Locate the LLM call**

Run: `grep -n "getStructured\|generateContent" src/main/utils/ComprehensionGradingService.js`

There are typically two calls in this service: `generateQuestion` and `gradeAnswer`. Migrate both.

- [ ] **Step 2: Replace generateQuestion call site**

```js
const { brainCall } = require('../brain/spine');
const CallLedgerStore = require('../db/CallLedgerStore');

// in generateQuestion(...)
const { output: question, callId: qCallId } = await brainCall(
  'grade-comprehension',
  `Generate one comprehension question for chapter:\n\n${chapterText}`,
  {
    userId,
    schema: QUESTION_SCHEMA,  // existing constant for the question schema
    contextOverrides: { currentBook: { bookId, chapterIndex, chapterTitle } },
  },
);
this._lastQuestionCallId = qCallId;
return question;
```

- [ ] **Step 3: Replace gradeAnswer call site**

```js
// in gradeAnswer(...)
const { output: grading, callId: gCallId } = await brainCall(
  'grade-comprehension',
  `Grade this answer.\nQuestion: ${question}\nAnswer: ${answer}`,
  {
    userId,
    schema: GRADING_SCHEMA,  // existing constant for the grading schema
    contextOverrides: { currentBook: { bookId, chapterIndex } },
  },
);
this._lastGradingCallId = gCallId;
return grading;
```

- [ ] **Step 4: Bind triggerId**

If a low-comprehension score emits a `reread-queue-schedule` trigger downstream, the binding belongs in the Phase 8a service (Plan C). In Phase 6 itself, no triggerId binding is needed — the callIds become discoverable via Economics Panel only.

- [ ] **Step 5: Update mocks + run test**

In Phase 6 test:

```js
jest.mock('../../main/brain/spine', () => ({
  brainCall: jest.fn()
    .mockResolvedValueOnce({ output: { question: 'q?' }, callId: 3 })
    .mockResolvedValueOnce({ output: { score: 0.6, gaps: [] }, callId: 4 }),
}));
```

Run: `npx jest src/__tests__/integration/phase6-*.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/utils/ComprehensionGradingService.js src/__tests__/integration/
git commit -m "refactor(phase6): migrate ComprehensionGradingService through brainCall"
```

---

## Task 5: Migrate LearningPathPlannerService (Phase 7) — apply Migration Recipe

**Files:**
- Modify: `src/main/utils/LearningPathPlannerService.js`
- Modify: existing Phase 7 integration test

- [ ] **Step 1: Locate the LLM call**

Run: `grep -n "getStructured\|generateContent" src/main/utils/LearningPathPlannerService.js`

- [ ] **Step 2: Replace call site**

```js
const { brainCall } = require('../brain/spine');
const CallLedgerStore = require('../db/CallLedgerStore');

// in plan(goal, books, { userId })
const bookSummaries = books.map((b) => `- ${b.title}: ${b.summary}`).join('\n');
const { output, callId } = await brainCall(
  'plan-cross-book-path',
  `Goal: ${goal}\n\nAvailable books:\n${bookSummaries}`,
  { userId, schema: PATH_SCHEMA },  // existing constant for the path schema
);
this._lastCallId = callId;
return output;
```

- [ ] **Step 3: Bind triggerId**

Phase 7 emits a `learning-path-plan` trigger that auto-creates a Quest (per CLAUDE.md Plan 2/3). After the trigger is emitted (look for the IPC handler that calls `planner.plan(...)` then emits — likely `src/main/ipc/learningPathPlannerHandlers.js`), backfill:

```js
const result = await planner.plan(goal, books, { userId });
const trigger = await emitTrigger(...);
if (planner._lastCallId && trigger.id) {
  CallLedgerStore.bindTriggerId(planner._lastCallId, trigger.id);
}
```

- [ ] **Step 4: Update mocks + run test**

```js
jest.mock('../../main/brain/spine', () => ({
  brainCall: jest.fn().mockResolvedValue({
    output: { steps: [{ bookId: 1, chapter: 'intro', why: '...' }] },
    callId: 5,
  }),
}));
```

Run: `npx jest src/__tests__/integration/phase7-*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/utils/LearningPathPlannerService.js src/main/ipc/learningPathPlannerHandlers.js src/__tests__/integration/
git commit -m "refactor(phase7): migrate LearningPathPlannerService through brainCall"
```

---

## Task 6: RationaleCard — component contract

**Files:**
- Create: `src/renderer/components/brainShell/RationaleCard.jsx`

- [ ] **Step 1: Write the skeleton (renders "no rationale" by default)**

```jsx
// src/renderer/components/brainShell/RationaleCard.jsx
import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, IconButton, Collapse, Stack } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import callLedgerApi from '../../api/callLedgerApi';

/**
 * RationaleCard — expandable "why this, why now" for a Proposal.
 *
 * Props:
 *   triggerId: string  — the trigger to look up in the Call Ledger.
 */
export default function RationaleCard({ triggerId }) {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState(null);

  useEffect(() => {
    if (!open || row || !triggerId) return;
    callLedgerApi.rationaleByTrigger(triggerId).then(setRow).catch(() => setRow(null));
  }, [open, triggerId, row]);

  if (!triggerId) return null;

  return (
    <Box sx={{ mt: 1, borderTop: '1px solid #eee', pt: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton size="small" onClick={() => setOpen((v) => !v)}>
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Typography variant="caption" color="text.secondary">
          Why the Brain proposed this
        </Typography>
      </Stack>
      <Collapse in={open}>
        {!row && <Typography variant="caption">Loading…</Typography>}
        {row && (
          <Box sx={{ pl: 2, pt: 1 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Chip size="small" label={`intent: ${row.intent}`} />
              <Chip size="small" label={`provider: ${row.provider}`} />
              <Chip size="small" label={`$${(row.cost_usd || 0).toFixed(5)}`} />
              <Chip size="small" label={row.cache_hit ? 'cached' : 'fresh'} />
            </Stack>
            <Typography variant="caption" component="div" sx={{ mb: 1 }}>
              Context used: {(row.context_keys || []).join(', ') || 'none'}
            </Typography>
            <Box sx={{ background: '#fafafa', p: 1, borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                {row.output_summary || JSON.stringify(row.output_json, null, 2)}
              </Typography>
            </Box>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}
```

- [ ] **Step 2: Verify the component imports cleanly**

Run: `npx jest --passWithNoTests --findRelatedTests src/renderer/components/brainShell/RationaleCard.jsx`
Expected: no module-load errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/brainShell/RationaleCard.jsx
git commit -m "feat(spine): RationaleCard component contract"
```

---

## Task 7: RationaleCard — TDD

**Files:**
- Create: `src/__tests__/renderer/RationaleCard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/renderer/RationaleCard.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: {
    rationaleByTrigger: jest.fn().mockResolvedValue({
      intent: 'propose-microcard',
      provider: 'deepseek-v3',
      context_keys: ['currentBook', 'mastery'],
      cost_usd: 0.00014,
      cache_hit: false,
      output_summary: 'card: duration',
      output_json: { front: 'q', back: 'a' },
    }),
  },
}));

import RationaleCard from '../../renderer/components/brainShell/RationaleCard';

describe('RationaleCard', () => {
  test('renders nothing when no triggerId given', () => {
    const { container } = render(<RationaleCard />);
    expect(container.firstChild).toBeNull();
  });

  test('expands and shows intent + provider + cost on click', async () => {
    render(<RationaleCard triggerId="trig_42" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText(/propose-microcard/)).toBeInTheDocument());
    expect(screen.getByText(/deepseek-v3/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.00014/)).toBeInTheDocument();
    expect(screen.getByText(/currentBook, mastery/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx jest src/__tests__/renderer/RationaleCard.test.jsx`
Expected: PASS (component was already implemented in Task 6 to satisfy the test).

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/renderer/RationaleCard.test.jsx
git commit -m "test(spine): RationaleCard expand + render assertions"
```

---

## Task 8: Embed RationaleCard in AtomicChipHost

**Files:**
- Modify: `src/renderer/components/brainShell/AtomicChipHost.jsx`

- [ ] **Step 1: Locate the chip body render**

Open the file. Find where the chip content (label, actions) is rendered. The host receives a `proposal` prop with shape `{ id, label, actions, payload }`.

- [ ] **Step 2: Import and embed**

At top of file:
```jsx
import RationaleCard from './RationaleCard';
```

Inside the JSX, after the chip body and before the wrapping close:
```jsx
<RationaleCard triggerId={proposal.id} />
```

- [ ] **Step 3: Smoke**

Run: `npm run lint -- src/renderer/components/brainShell/AtomicChipHost.jsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/brainShell/AtomicChipHost.jsx
git commit -m "feat(spine): embed RationaleCard in AtomicChipHost"
```

---

## Task 9: Embed RationaleCard in InlineSequenceHost

**Files:**
- Modify: `src/renderer/components/brainShell/InlineSequenceHost.jsx`

- [ ] **Step 1: Locate the sequence container**

Find the outer Paper / Box that wraps the inline sequence steps.

- [ ] **Step 2: Import and embed at the bottom of the container**

```jsx
import RationaleCard from './RationaleCard';
// ...
<RationaleCard triggerId={proposal.id} />
```

- [ ] **Step 3: Smoke**

Run: `npm run lint -- src/renderer/components/brainShell/InlineSequenceHost.jsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/brainShell/InlineSequenceHost.jsx
git commit -m "feat(spine): embed RationaleCard in InlineSequenceHost"
```

---

## Task 10: Embed RationaleCard in MultiSurfaceFlowHost

**Files:**
- Modify: `src/renderer/components/brainShell/MultiSurfaceFlowHost.jsx`

- [ ] **Step 1: Locate the flow header**

The multi-surface flow has a header indicator that persists across views. The rationale card belongs there.

- [ ] **Step 2: Import and embed**

```jsx
import RationaleCard from './RationaleCard';
// ...
<RationaleCard triggerId={activeFlow.proposalId} />
```

- [ ] **Step 3: Smoke**

Run: `npm run lint -- src/renderer/components/brainShell/MultiSurfaceFlowHost.jsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/brainShell/MultiSurfaceFlowHost.jsx
git commit -m "feat(spine): embed RationaleCard in MultiSurfaceFlowHost"
```

---

## Task 11: EconomicsPanel — component contract

**Files:**
- Create: `src/renderer/components/brainShell/EconomicsPanel.jsx`

- [ ] **Step 1: Write the skeleton**

```jsx
// src/renderer/components/brainShell/EconomicsPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Paper, Stack, Typography, Box, Tabs, Tab, Table, TableHead, TableBody,
  TableRow, TableCell, LinearProgress, IconButton, Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import callLedgerApi from '../../api/callLedgerApi';

const WINDOWS = {
  '7d':  7  * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
};

export default function EconomicsPanel() {
  const [windowKey, setWindowKey] = useState('7d');
  const [byIntent, setByIntent] = useState([]);
  const [byProvider, setByProvider] = useState([]);
  const [cacheRates, setCacheRates] = useState({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const sinceMs = Date.now() - WINDOWS[windowKey];
    const [intents, providers, rates] = await Promise.all([
      callLedgerApi.aggregateByIntent(sinceMs),
      callLedgerApi.aggregateByProvider(sinceMs),
      callLedgerApi.cacheHitRateByIntent(sinceMs),
    ]);
    setByIntent(intents || []);
    setByProvider(providers || []);
    setCacheRates(rates || {});
    setLoading(false);
  }, [windowKey]);

  useEffect(() => { refresh(); }, [refresh]);

  const totalCost = byIntent.reduce((s, r) => s + (r.total_cost_usd || 0), 0);
  const projectedMonthly = windowKey === '7d' ? totalCost * (30 / 7) : totalCost;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1">LLM Economics</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tabs value={windowKey} onChange={(_e, v) => setWindowKey(v)}>
            <Tab label="7 days"  value="7d" />
            <Tab label="30 days" value="30d" />
          </Tabs>
          <IconButton size="small" onClick={refresh} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      {loading && <LinearProgress />}
      <Stack direction="row" spacing={2} sx={{ my: 1 }}>
        <Chip label={`Total: $${totalCost.toFixed(4)}`} />
        <Chip label={`Projected/mo: $${projectedMonthly.toFixed(2)}`} color="primary" />
      </Stack>

      <Typography variant="caption" sx={{ display: 'block', mt: 1, mb: 0.5 }}>By Intent</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Intent</TableCell>
            <TableCell align="right">Calls</TableCell>
            <TableCell align="right">Cost USD</TableCell>
            <TableCell align="right">Cache hit</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {byIntent.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.key}</TableCell>
              <TableCell align="right">{r.call_count}</TableCell>
              <TableCell align="right">${(r.total_cost_usd || 0).toFixed(5)}</TableCell>
              <TableCell align="right">
                {cacheRates[r.key] != null
                  ? `${Math.round(cacheRates[r.key] * 100)}%`
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Typography variant="caption" sx={{ display: 'block', mt: 2, mb: 0.5 }}>By Provider</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Provider</TableCell>
            <TableCell align="right">Calls</TableCell>
            <TableCell align="right">Cost USD</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {byProvider.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.key}</TableCell>
              <TableCell align="right">{r.call_count}</TableCell>
              <TableCell align="right">${(r.total_cost_usd || 0).toFixed(5)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
```

- [ ] **Step 2: Verify imports cleanly**

Run: `npx jest --passWithNoTests --findRelatedTests src/renderer/components/brainShell/EconomicsPanel.jsx`
Expected: no module-load errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/brainShell/EconomicsPanel.jsx
git commit -m "feat(spine): EconomicsPanel — cost by intent/provider + projected monthly"
```

---

## Task 12: EconomicsPanel — TDD

**Files:**
- Create: `src/__tests__/renderer/EconomicsPanel.test.jsx`

- [ ] **Step 1: Write the test**

```jsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: {
    aggregateByIntent:    jest.fn().mockResolvedValue([
      { key: 'propose-microcard',  call_count: 12, total_cost_usd: 0.0042, cache_hits: 5 },
      { key: 'grade-comprehension', call_count: 3,  total_cost_usd: 0.0018, cache_hits: 0 },
    ]),
    aggregateByProvider:  jest.fn().mockResolvedValue([
      { key: 'deepseek-v3', call_count: 15, total_cost_usd: 0.0060, cache_hits: 5 },
    ]),
    cacheHitRateByIntent: jest.fn().mockResolvedValue({
      'propose-microcard': 0.4,
      'grade-comprehension': 0,
    }),
  },
}));

import EconomicsPanel from '../../renderer/components/brainShell/EconomicsPanel';

describe('EconomicsPanel', () => {
  test('renders intent + provider tables and projected monthly cost', async () => {
    render(<EconomicsPanel />);
    await waitFor(() => expect(screen.getByText('propose-microcard')).toBeInTheDocument());
    expect(screen.getByText('grade-comprehension')).toBeInTheDocument();
    expect(screen.getByText('deepseek-v3')).toBeInTheDocument();
    // total = 0.006, 7d window → projected ≈ 0.006 * 30/7 = 0.0257
    expect(screen.getByText(/Projected\/mo:/)).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument(); // cache rate for propose-microcard
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx jest src/__tests__/renderer/EconomicsPanel.test.jsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/renderer/EconomicsPanel.test.jsx
git commit -m "test(spine): EconomicsPanel renders aggregations + projection"
```

---

## Task 13: Embed EconomicsPanel in BrainDashboardPanel

**Files:**
- Modify: `src/renderer/components/brainShell/BrainDashboardPanel.jsx`

- [ ] **Step 1: Import + render**

Open `BrainDashboardPanel.jsx`. Find where `TriggerTelemetryPanel` is rendered. Add `EconomicsPanel` adjacent:

```jsx
import EconomicsPanel from './EconomicsPanel';
// ...
<Box sx={{ mt: 2 }}>
  <EconomicsPanel />
</Box>
<Box sx={{ mt: 2 }}>
  <TriggerTelemetryPanel />
</Box>
```

- [ ] **Step 2: Smoke**

Run: `npm run lint -- src/renderer/components/brainShell/BrainDashboardPanel.jsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/brainShell/BrainDashboardPanel.jsx
git commit -m "feat(spine): mount EconomicsPanel in BrainDashboardPanel"
```

---

## Task 14: Expand TriggerTelemetryPanel with intent column

**Files:**
- Modify: `src/renderer/components/brainShell/TriggerTelemetryPanel.jsx`
- Modify: `src/main/brain/LearningBrainAgent.js` (extend telemetry row with intent)

- [ ] **Step 1: Augment recorded telemetry with intent**

In `LearningBrainAgent.js`, find `recordProposalEvent`. When the source services emit a trigger that carries `payload.intent` (the spine knows which intent produced it), persist that intent on the telemetry row. Adjust the in-memory tally to include `byIntent: { [intent]: { accepted, dismissed } }`.

Concretely, if telemetry today is:
```js
this.triggerTelemetry.bySource[source] = { accepted, dismissed, lastAt };
```

Add (also keyed by `source + ':' + intent`):
```js
this.triggerTelemetry.byIntent[intent] = this.triggerTelemetry.byIntent[intent] ||
  { accepted: 0, dismissed: 0, lastAt: null };
this.triggerTelemetry.byIntent[intent][event]++;
this.triggerTelemetry.byIntent[intent].lastAt = now;
```

Persist via the existing electron-store key.

- [ ] **Step 2: Update the panel to show byIntent column**

In `TriggerTelemetryPanel.jsx`, add a third section "By Intent" below the existing "By Source" table, copying the layout but reading from `data.byIntent` instead of `data.bySource`.

- [ ] **Step 3: Run existing telemetry tests**

Run: `npx jest -t "TriggerTelemetry|recordProposalEvent"`
Expected: PASS (existing tests should not regress).

If existing tests break because of the new `byIntent` key, update them to assert the new shape.

- [ ] **Step 4: Commit**

```bash
git add src/main/brain/LearningBrainAgent.js src/renderer/components/brainShell/TriggerTelemetryPanel.jsx src/__tests__/
git commit -m "feat(spine): TriggerTelemetryPanel — add per-intent accept/dismiss view"
```

---

## Task 15: Manual end-to-end verification

**Files:**
- None (manual)

- [ ] **Step 1: Boot the app**

Run: `npm start`

- [ ] **Step 2: Generate at least 10 spine-mediated calls**

Open a book (Phase 5 diagnostic fires once). Read a few paragraphs (Phase 4 micro-card proposals). End a chapter (Phase 6 comprehension). Use the Knowledge Dashboard cross-book path planner (Phase 7).

- [ ] **Step 3: Inspect Rationale Card on a Proposal**

When the Orb shows a queued Proposal, accept or hover it. Confirm the "Why the Brain proposed this" chevron is present and expands to show intent, provider, cost, context keys, and output summary.

- [ ] **Step 4: Inspect Economics Panel**

Navigate to the Knowledge Dashboard / Brain Dashboard. Confirm the Economics Panel shows ≥3 intents with non-zero call counts, a non-zero total cost, and a projected monthly figure.

- [ ] **Step 5: Confirm cache hit rate**

If you can trigger the same diagnostic twice within the session, the second one should show as cached in its Rationale Card.

- [ ] **Step 6: Commit screenshots (optional but useful)**

If the project has a `docs/screenshots/` directory, save the Rationale Card + Economics Panel screenshots and commit. Otherwise skip.

```bash
# only if screenshots taken:
git add docs/screenshots/phase-9b-*.png
git commit -m "docs(spine): screenshots of Rationale Card + Economics Panel"
```

---

## Self-Review Notes

- **Spec coverage:** Migration plan steps 2–4 (T2–T5), step 4 Rationale wire-up (T6–T10), step 5 Economics panel (T11–T13), expansion of telemetry (T14). Step 7 (`meteredCall` for legacy sites) is deferred to Plan C.
- **No placeholders.** Each migration task points at a concrete grep command to locate the call site rather than naming a line number that may have shifted.
- **Type consistency:** `callId` (number) and `triggerId` (string) are used the same way across all migrations. `bindTriggerId(callId, triggerId)` signature consistent in T1.
- **Risks flagged:** T2 and T3 mention that `BookDiagnosticService` may not emit a trigger (Phase 5 is in-context per CLAUDE.md); the instruction is to fall back to storing `callId` on the diagnostic result for rationale lookup.

**Done condition:** Phase 4–7 services route through `brainCall`, Rationale Card visible on every Proposal, Economics Panel visible on Brain Dashboard, manual verification step 5 confirms a cache hit.
