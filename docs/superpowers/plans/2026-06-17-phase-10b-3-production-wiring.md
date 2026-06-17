# Phase 10b-3 — Study-Session Director Production Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the gaps between Plan 10b-1's foundation and a session a real user can run end-to-end with persistent side effects. Today, soft-writes silently no-op at runtime (singletons un-init / stubs), active Quest never reaches the start dialog, sessions don't show in EconomicsPanel by trace_id, and the smoke harness can't verify boot.

**Architecture (no new layers):**
This plan is mostly wiring/glue across existing seams. No new modules. The five concrete moves:

1. Wire `rereadQueueSingleton.init(store)` at main.ts boot so `scheduleReread` actually persists.
2. Replace the `MicroCardProposer` and `ProductionPromptService` stubs with real DB-backed calls.
3. Plumb `activeQuest` from the Quest service through BrainShell to `SessionStartDialog`.
4. Standardize `sessionApi.getTrace` return shape to match the JSDoc (`{ traceId, events }`).
5. Add `CallLedgerStore.aggregateByTraceId` + a "By Session" tab in EconomicsPanel.
6. Fix the smoke harness so `npm run test:smoke` actually boots Electron's main process.

**Tech Stack:** Node + better-sqlite3 + Electron + React. No new deps.

**Conventions:**
- Run single test with `npx jest <path>`.
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit ...`.
- Don't write git config; don't skip pre-commit hooks.
- Stay on `main` branch; no destructive git ops.

**Foundation:**
- Spec: [`docs/superpowers/specs/2026-06-17-phase-10b-study-session-director-design.md`](../specs/2026-06-17-phase-10b-study-session-director-design.md)
- Plan 10b-1 (foundation): [`docs/superpowers/plans/2026-06-17-phase-10b-1-session-foundation.md`](2026-06-17-phase-10b-1-session-foundation.md)
- Plan 10b-2 (UI): [`docs/superpowers/plans/2026-06-17-phase-10b-2-session-ui.md`](2026-06-17-phase-10b-2-session-ui.md)

---

## File Map

**Modify**
- `src/main/main.ts` (wire rereadQueueSingleton.init at boot)
- `src/main/utils/microCardProposerSingleton.js` (real commit + delete)
- `src/main/brain/productionPromptSingleton.js` (real unschedule with userId)
- `src/main/brain/director/SessionRunner.js` (record userId in softWrite payload for Undo)
- `src/main/brain/director/tools/scheduleProductionPrompt.js` (record userId in undo payload)
- `src/main/brain/director/tools/createMicroCard.js` (record userId in undo payload)
- `src/main/db/CallLedgerStore.js` (new `aggregateByTraceId` + `listSessionTraces`)
- `src/main/ipc/sessionHandlers.js` (`session:getTrace` returns `{ traceId, events }`)
- `src/main/ipc/callLedgerHandlers.js` (new channels for session aggregation)
- `src/renderer/api/sessionApi.js` (no JSDoc drift)
- `src/renderer/api/callLedgerApi.js` (add session aggregation methods)
- `src/renderer/components/brainShell/BrainShell.jsx` (read active Quest; pass to dialog)
- `src/renderer/components/brainShell/EconomicsPanel.jsx` (or wherever it lives — add "By Session" tab)
- `src/renderer/views/aiSession/SessionSummaryView.jsx` (consume new shape)
- `.erb/scripts/test-smoke.js` (fix Electron entry-point invocation)

**Create**
- `src/__tests__/main/microCardProposerSingleton.test.js`
- `src/__tests__/main/productionPromptSingleton.test.js`
- `src/__tests__/db/callLedgerStoreSessions.test.js`
- `src/__tests__/renderer/brainShell/BrainShell.activeQuest.test.jsx`

---

### Task 1: Wire `rereadQueueSingleton.init(store)` at main.ts boot

**Files:**
- Modify: `src/main/main.ts`

- [ ] **Step 1: Locate the existing `RereadQueueService` wiring**

Run: `grep -n "registerRereadQueueHandlers\|RereadQueueService\|rereadQueueSingleton" src/main/main.ts`.

The handler registration is likely already wired (per CLAUDE.md, Phase 8a). The singleton needs to be initialized alongside it so the Director's `scheduleReread` tool reaches the same store.

- [ ] **Step 2: Add init call**

Near the existing rereadQueue handler registration, add:

```ts
const rereadQueueSingleton = require('./utils/rereadQueueSingleton');
rereadQueueSingleton.init(store);
```

Place it BEFORE `sessionHandlers.register()` (so any session that starts immediately has a working singleton). The exact location depends on where `store` (the electron-store instance) is defined in main.ts.

- [ ] **Step 3: Verify by smoke + tool roundtrip**

Run: `npx jest src/__tests__/director/sessionSoftWriteTools.test.js`
Expected: still passing (no regression).

Run: `npm run test:smoke` — even if smoke fails for unrelated reasons (Task 8), check stdout/stderr for any new error related to `rereadQueueSingleton`.

- [ ] **Step 4: Commit**

```bash
git add src/main/main.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "fix(phase-10b-3): wire rereadQueueSingleton.init(store) at boot"
```

**Critical notes:**
- If `rereadQueueSingleton.js` doesn't expose `init(store)` exactly that way, read its actual API and adapt. The existing API from Plan 10b-1 Task 7 should be `init(store)`.
- If main.ts uses `import` syntax for ESM modules, prefer `import rereadQueueSingleton from './utils/rereadQueueSingleton';` at the top alongside other imports.

---

### Task 2: Real `MicroCardProposer.commit` + `delete`

**Files:**
- Modify: `src/main/utils/microCardProposerSingleton.js`
- Modify: `src/main/brain/director/tools/createMicroCard.js` (record userId for Undo)
- Test: `src/__tests__/main/microCardProposerSingleton.test.js`

- [ ] **Step 1: Read existing acceptance path**

Run: `grep -n "microcard-accept\|createLearningPoint" src/main/ipc/microCardHandlers.js`. Read how the real micro-card-accept IPC creates a `learning_point` row. This is the canonical write path; our `commit()` should call into the same logic (or LearningPointManager directly).

- [ ] **Step 2: Write failing test**

```js
// src/__tests__/main/microCardProposerSingleton.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});

const dbManager = require('../../main/db/dbManager');
const singleton = require('../../main/utils/microCardProposerSingleton');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  dbManager.__setDb(db);
  return db;
}

test('commit inserts a learning_point row and returns its id', () => {
  freshDb();
  const { id } = singleton.commit({
    userId: 1,
    paragraphHash: 'h-abc',
    draft: { title: 'parse', content: 'to analyze' },
    domain: 'vocabulary',
  });
  expect(typeof id).toBe('number');
  const row = dbManager.getDb().prepare('SELECT id, title FROM learning_point WHERE id = ?').get(id);
  expect(row.title).toBe('parse');
});

test('delete removes the row and returns true; false if not found', () => {
  freshDb();
  const { id } = singleton.commit({
    userId: 1, paragraphHash: 'h-xyz', draft: { title: 't', content: 'c' }, domain: 'vocabulary',
  });
  expect(singleton.delete(id)).toBe(true);
  const after = dbManager.getDb().prepare('SELECT id FROM learning_point WHERE id = ?').get(id);
  expect(after).toBeUndefined();
  expect(singleton.delete(999999)).toBe(false);
});
```

- [ ] **Step 3: Implement**

Replace the stub `commit`/`delete` in `microCardProposerSingleton.js`:

```js
const dbManager = require('../db/dbManager');

function commit({ userId, paragraphHash, draft, domain }) {
  const db = dbManager.getDb();
  const result = db.prepare(`
    INSERT INTO learning_point
      (user_id, domain_type, title, content, source_type, source_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'book', ?, datetime('now'), datetime('now'))
  `).run(
    userId,
    domain || 'vocabulary',
    draft.title || draft.headword || '',
    draft.content || draft.definition || '',
    paragraphHash || null,
  );
  return { id: result.lastInsertRowid };
}

function delete_(id) {
  const db = dbManager.getDb();
  const result = db.prepare('DELETE FROM learning_point WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { commit, delete: delete_ };
```

(Adapt column names to the actual `learning_point` schema — verify by reading `db.sql` for the table definition. Phase 3 added domain-aware fields; honor them.)

- [ ] **Step 4: Verify Director tool still works**

In `src/main/brain/director/tools/createMicroCard.js`, ensure the Undo path captures userId for any future reference. Update the handler return:

```js
tools.registerHandler('createMicroCard', async (args, ctx = {}) => {
  const { callId } = await meteredCallJson(
    `Create micro-card from paragraph ${args.paragraphHash}, domain ${args.domain}`,
    null,
    { legacyLabel: 'session-soft-write:createMicroCard', traceId: ctx.traceId }
  );
  const { id: microCardId } = MicroCardProposer.commit({
    userId: args.userId, paragraphHash: args.paragraphHash, draft: args.draft, domain: args.domain,
  });
  return { callId, microCardId, userId: args.userId };
});
```

(The `userId` field in the return propagates into `state.softWrites[i].handlerResult` — SessionRunner already merges it into the Undo payload, so `UndoRegistry.run('createMicroCard', { microCardId, userId })` will work.)

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/main/microCardProposerSingleton.test.js src/__tests__/director/sessionSoftWriteTools.test.js`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/main/utils/microCardProposerSingleton.js src/main/brain/director/tools/createMicroCard.js src/__tests__/main/microCardProposerSingleton.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-3): real MicroCardProposer commit/delete via learning_point"
```

---

### Task 3: Real `ProductionPromptService.unschedule` with userId

**Files:**
- Modify: `src/main/brain/productionPromptSingleton.js`
- Modify: `src/main/brain/director/tools/scheduleProductionPrompt.js` (return userId for Undo)
- Test: `src/__tests__/main/productionPromptSingleton.test.js`

- [ ] **Step 1: Read existing `ProductionPromptService` API**

Run: `grep -n "schedulePrompt\|clearPrompt\|class ProductionPromptService" src/main/brain/ProductionPromptService.js`. Confirm `clearPrompt(userId, learningPointId)` exists.

The current singleton's `unschedule(id)` hardcodes `clearPrompt(1, id)` — that's the bug to fix.

- [ ] **Step 2: Write failing test**

```js
// src/__tests__/main/productionPromptSingleton.test.js
const ProductionPromptService = require('../../main/brain/ProductionPromptService');
const singleton = require('../../main/brain/productionPromptSingleton');

jest.mock('../../main/brain/ProductionPromptService', () => ({
  schedulePrompt: jest.fn().mockReturnValue({ id: 99 }),
  clearPrompt: jest.fn().mockReturnValue(true),
}));

test('schedulePrompt forwards userId + learningPointId', () => {
  const r = singleton.schedulePrompt({ userId: 7, learningPointId: 99, prompt: 'p' });
  expect(r.id).toBe(99);
  expect(ProductionPromptService.schedulePrompt).toHaveBeenCalledWith(7, expect.any(Object));
});

test('unschedule passes the userId from args, not hardcoded 1', () => {
  singleton.unschedule({ promptId: 99, userId: 7, learningPointId: 42 });
  expect(ProductionPromptService.clearPrompt).toHaveBeenCalledWith(7, 42);
});
```

- [ ] **Step 3: Implement**

```js
// src/main/brain/productionPromptSingleton.js
const ProductionPromptService = require('./ProductionPromptService');

function schedulePrompt({ userId, learningPointId, prompt }) {
  const token = ProductionPromptService.schedulePrompt(userId, { learningPointId, prompt });
  return { id: token?.id || token };
}

function unschedule({ userId, learningPointId }) {
  const ok = ProductionPromptService.clearPrompt(userId, learningPointId);
  return ok === true;
}

module.exports = { schedulePrompt, unschedule };
```

(Adapt to the actual `schedulePrompt` / `clearPrompt` signatures — verify by reading the class.)

- [ ] **Step 4: Update tool to return userId + learningPointId on Undo**

In `src/main/brain/director/tools/scheduleProductionPrompt.js`:

```js
tools.registerHandler('scheduleProductionPrompt', async (args, ctx = {}) => {
  const { callId } = await meteredCallJson(
    `Schedule production prompt for LP ${args.learningPointId}: ${args.prompt}`,
    null,
    { legacyLabel: 'session-soft-write:scheduleProductionPrompt', traceId: ctx.traceId }
  );
  const { id: promptId } = ProductionPromptService.schedulePrompt({
    userId: args.userId, learningPointId: args.learningPointId, prompt: args.prompt,
  });
  return { callId, promptId, userId: args.userId, learningPointId: args.learningPointId };
});

UndoRegistry.register('scheduleProductionPrompt', async ({ userId, learningPointId }) => {
  const undone = ProductionPromptService.unschedule({ userId, learningPointId });
  return { undone };
});
```

(`ProductionPromptService` is imported as the singleton, per Plan 10b-1 Task 8.)

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/main/productionPromptSingleton.test.js src/__tests__/director/sessionSoftWriteTools.test.js`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/main/brain/productionPromptSingleton.js src/main/brain/director/tools/scheduleProductionPrompt.js src/__tests__/main/productionPromptSingleton.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "fix(phase-10b-3): ProductionPromptService.unschedule uses real userId"
```

---

### Task 4: Plumb active Quest into BrainShell → `SessionStartDialog`

**Files:**
- Modify: `src/renderer/components/brainShell/BrainShell.jsx`
- Test: `src/__tests__/renderer/brainShell/BrainShell.activeQuest.test.jsx`

- [ ] **Step 1: Locate the Quest source**

Run: `grep -rn "quest-list\|questsApi\|listQuests\|activeQuest" src/renderer/`. Find the IPC channel + the API client that returns quests.

The OrbQuestMenu likely uses something like `questsApi.list()` or reads from Redux. Confirm the shape: `[{ id, title, isActive, ... }]`.

- [ ] **Step 2: Write failing test**

```jsx
// src/__tests__/renderer/brainShell/BrainShell.activeQuest.test.jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fakeQuestsApi = { list: jest.fn().mockResolvedValue([
  { id: 7, title: 'Master React', isActive: 1 },
  { id: 8, title: 'Learn Rust', isActive: 0 },
]) };
const fakeSessionApi = { loadActive: jest.fn().mockResolvedValue(null), start: jest.fn() };

jest.mock('../../../renderer/api/questsApi', () => ({ __esModule: true, default: fakeQuestsApi }), { virtual: true });
jest.mock('../../../renderer/api/sessionApi', () => ({ __esModule: true, default: fakeSessionApi }));

import BrainShell from '../../../renderer/components/brainShell/BrainShell';

test('on mount, BrainShell reads active Quest and passes to dialog', async () => {
  render(<MemoryRouter><BrainShell /></MemoryRouter>);
  // Open the session dialog by simulating the OrbQuestMenu action.
  // We can't easily right-click the orb in JSDOM, so verify the data fetch happened.
  await screen.findByText((t) => t.length >= 0); // just wait for render
  expect(fakeQuestsApi.list).toHaveBeenCalled();
});
```

(This is a smoke-level assertion. The full integration — right-clicking the orb, opening the menu, clicking Start AI Session, seeing the Quest title — is hard to assert in JSDOM. If the existing BrainShell.test.jsx covers right-click flows, model after it.)

- [ ] **Step 3: Implement**

In `BrainShell.jsx`:

```jsx
// Replace the hardcoded activeQuest={null} with real lookup.
import questsApi from '../../api/questsApi';
const [activeQuest, setActiveQuest] = useState(null);
useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      const quests = await questsApi.list();
      if (!mounted) return;
      const active = quests.find(q => q.isActive) || null;
      setActiveQuest(active);
    } catch (e) { /* fail silent */ }
  })();
  return () => { mounted = false; };
}, []);

// ... pass to SessionStartDialog
<SessionStartDialog open={sessionDialogOpen} onClose={...} activeQuest={activeQuest} userId={1} />
```

(Adapt `questsApi` import path + method name to the actual project module — Plan 10b-2 Task 8's subagent noted BrainShell already wires the Quest menu, so the data source is reachable.)

- [ ] **Step 4: Run tests**

Run: `npx jest src/__tests__/renderer/brainShell/BrainShell.activeQuest.test.jsx`
Expected: passing.

Run the full renderer suite to confirm no regression: `npx jest src/__tests__/renderer/`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/brainShell/BrainShell.jsx src/__tests__/renderer/brainShell/BrainShell.activeQuest.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-3): BrainShell reads active Quest for SessionStartDialog"
```

---

### Task 5: Standardize `sessionApi.getTrace` shape — `{ traceId, events }`

**Files:**
- Modify: `src/main/ipc/sessionHandlers.js`
- Modify: `src/renderer/api/sessionApi.js` (JSDoc)
- Modify: `src/renderer/views/aiSession/SessionSummaryView.jsx`
- Test: extend `src/__tests__/renderer/aiSession/SessionSummaryView.test.jsx`

- [ ] **Step 1: Read current `session:getTrace` handler**

Open `src/main/ipc/sessionHandlers.js`. The current handler returns the trace as a plain array. Change it to `{ traceId, events }`.

- [ ] **Step 2: Update the handler**

```js
ipcMain.handle('session:getTrace', async (_e, { sessionId }) => {
  const events = AISessionStore.getTrace(sessionId);
  // Find the trace_id for this session by querying ai_sessions
  const session = AISessionStore.findById?.(sessionId) || null;
  return {
    traceId: session?.trace_id || null,
    events: events || [],
  };
});
```

If `AISessionStore.findById` doesn't exist yet, add it:

```js
function findById(sessionId) {
  const db = dbManager.getDb();
  return db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(sessionId);
}
module.exports = { ...existing, findById };
```

- [ ] **Step 3: Update SessionSummaryView to consume new shape**

```jsx
useEffect(() => {
  (async () => {
    const result = await sessionApi.getTrace(id);
    // Normalize: handle both legacy array and new { traceId, events } shape.
    const events = Array.isArray(result) ? result : (result?.events || []);
    const traceId = Array.isArray(result) ? null : (result?.traceId || null);
    setTrace(events);
    setTraceId(traceId);
  })();
}, [id]);
```

Add `traceId` state. Show it in the recap if available.

- [ ] **Step 4: Update tests**

Update `SessionSummaryView.test.jsx`'s mock to return the new shape:

```js
const fakeApi = { getTrace: jest.fn().mockResolvedValue({ traceId: 'tr-1', events: sampleTrace }) };
```

The view should still render correctly because of the normalization.

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/renderer/aiSession/SessionSummaryView.test.jsx src/__tests__/ipc/sessionHandlers.test.js`
Expected: passing.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/sessionHandlers.js src/main/db/AISessionStore.js src/renderer/api/sessionApi.js src/renderer/views/aiSession/SessionSummaryView.jsx src/__tests__/renderer/aiSession/SessionSummaryView.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "fix(phase-10b-3): standardize sessionApi.getTrace → { traceId, events }"
```

---

### Task 6: `CallLedgerStore.aggregateByTraceId` + session list

**Files:**
- Modify: `src/main/db/CallLedgerStore.js`
- Modify: `src/main/ipc/callLedgerHandlers.js`
- Modify: `src/renderer/api/callLedgerApi.js`
- Test: `src/__tests__/db/callLedgerStoreSessions.test.js`

- [ ] **Step 1: Write failing test**

```js
// src/__tests__/db/callLedgerStoreSessions.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');
const CallLedgerStore = require('../../main/db/CallLedgerStore');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  dbManager.__setDb(db);
  return db;
}

test('aggregateByTraceId sums costs + counts by intent', () => {
  freshDb();
  for (let i = 0; i < 3; i++) {
    CallLedgerStore.record({
      intent: 'director-session-step', ts: 1000 + i, provider: 'deepseek',
      context_keys: [], prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.001,
      cache_hit: false, cache_key: null, duration_ms: 200, trigger_id: null,
      output_summary: 's', output_json: null, trace_id: 'sess-1',
    });
  }
  CallLedgerStore.record({
    intent: 'session-soft-write', ts: 2000, provider: 'deepseek',
    context_keys: [], prompt_tokens: 20, completion_tokens: 10, cost_usd: 0.0001,
    cache_hit: false, cache_key: null, duration_ms: 50, trigger_id: null,
    output_summary: 's', output_json: null, trace_id: 'sess-1',
  });
  const agg = CallLedgerStore.aggregateByTraceId('sess-1');
  expect(agg.totalCost).toBeCloseTo(0.0031);
  expect(agg.callCount).toBe(4);
  expect(agg.byIntent['director-session-step'].count).toBe(3);
  expect(agg.byIntent['session-soft-write'].count).toBe(1);
});

test('listSessionTraces returns distinct traceIds with summary', () => {
  freshDb();
  for (let i = 0; i < 2; i++) {
    CallLedgerStore.record({
      intent: 'director-session-step', ts: 1000 + i, provider: 'deepseek',
      context_keys: [], prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.001,
      cache_hit: false, cache_key: null, duration_ms: 200, trigger_id: null,
      output_summary: 's', output_json: null, trace_id: `sess-${i}`,
    });
  }
  const list = CallLedgerStore.listSessionTraces({ limit: 10 });
  expect(list).toHaveLength(2);
  expect(list[0].traceId).toMatch(/^sess-/);
  expect(list[0].totalCost).toBeCloseTo(0.001);
});
```

- [ ] **Step 2: Implement**

In `CallLedgerStore.js`, add:

```js
function aggregateByTraceId(traceId) {
  const db = dbManager.getDb();
  const rows = db.prepare(`
    SELECT intent, cost_usd, prompt_tokens, completion_tokens
    FROM brain_call_ledger
    WHERE trace_id = ?
  `).all(traceId);
  const byIntent = {};
  let totalCost = 0;
  let totalTokens = 0;
  for (const r of rows) {
    if (!byIntent[r.intent]) byIntent[r.intent] = { count: 0, cost: 0, tokens: 0 };
    byIntent[r.intent].count++;
    byIntent[r.intent].cost += r.cost_usd || 0;
    byIntent[r.intent].tokens += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
    totalCost += r.cost_usd || 0;
    totalTokens += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
  }
  return { traceId, totalCost, totalTokens, callCount: rows.length, byIntent };
}

function listSessionTraces({ limit = 20 } = {}) {
  const db = dbManager.getDb();
  const rows = db.prepare(`
    SELECT trace_id AS traceId,
           MIN(ts) AS startedAt,
           MAX(ts) AS endedAt,
           SUM(cost_usd) AS totalCost,
           COUNT(*) AS callCount
    FROM brain_call_ledger
    WHERE trace_id IS NOT NULL
    GROUP BY trace_id
    ORDER BY startedAt DESC
    LIMIT ?
  `).all(limit);
  return rows;
}

module.exports = { ...existing, aggregateByTraceId, listSessionTraces };
```

- [ ] **Step 3: Add IPC + API methods**

In `src/main/ipc/callLedgerHandlers.js`:

```js
ipcMain.handle('callLedger:aggregateByTraceId', async (_e, { traceId }) =>
  CallLedgerStore.aggregateByTraceId(traceId)
);
ipcMain.handle('callLedger:listSessionTraces', async (_e, { limit }) =>
  CallLedgerStore.listSessionTraces({ limit })
);
```

In `src/renderer/api/callLedgerApi.js`:

```js
aggregateByTraceId: (traceId) => ipcRenderer.invoke('callLedger:aggregateByTraceId', { traceId }),
listSessionTraces: (limit = 20) => ipcRenderer.invoke('callLedger:listSessionTraces', { limit }),
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/__tests__/db/callLedgerStoreSessions.test.js`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/main/db/CallLedgerStore.js src/main/ipc/callLedgerHandlers.js src/renderer/api/callLedgerApi.js src/__tests__/db/callLedgerStoreSessions.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-3): CallLedger aggregateByTraceId + listSessionTraces"
```

---

### Task 7: EconomicsPanel "By Session" tab

**Files:**
- Modify: `src/renderer/components/brainShell/EconomicsPanel.jsx` (or wherever it lives — find via grep)

- [ ] **Step 1: Locate EconomicsPanel**

Run: `grep -rn "EconomicsPanel\|aggregateByIntent\|aggregateByProvider" src/renderer/`. Find the component.

- [ ] **Step 2: Read its existing tab structure**

The panel likely has tabs for "By Intent" and "By Provider" (per Plan 9b spec). Add a new "By Session" tab.

- [ ] **Step 3: Implement**

```jsx
// Add a state for sessions list + an effect to load it
const [sessions, setSessions] = useState([]);
useEffect(() => {
  callLedgerApi.listSessionTraces(20).then(setSessions);
}, []);

// In the tab content (under "By Session"):
<table>
  <thead><tr><th>Trace ID</th><th>Started</th><th>Calls</th><th>Cost</th></tr></thead>
  <tbody>
    {sessions.map(s => (
      <tr key={s.traceId}>
        <td><code>{s.traceId.slice(0, 8)}</code></td>
        <td>{new Date(s.startedAt).toLocaleString()}</td>
        <td>{s.callCount}</td>
        <td>${s.totalCost.toFixed(4)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

(Adapt to the existing component's styling system — MUI, plain divs, etc.)

- [ ] **Step 4: Smoke test the panel**

If the existing EconomicsPanel test exists, extend it to assert the "By Session" tab renders. If not, write a minimal smoke test:

```jsx
import { render, screen } from '@testing-library/react';
const fakeApi = { aggregateByIntent: jest.fn().mockResolvedValue([]), aggregateByProvider: jest.fn().mockResolvedValue([]), listSessionTraces: jest.fn().mockResolvedValue([{ traceId: 'sess-1', startedAt: 1000, callCount: 5, totalCost: 0.0042 }]) };
jest.mock('../../../renderer/api/callLedgerApi', () => ({ __esModule: true, default: fakeApi }));
import EconomicsPanel from '../../../renderer/components/brainShell/EconomicsPanel';

test('shows session row in By Session tab', async () => {
  render(<EconomicsPanel />);
  // Click the By Session tab (if tabs exist) — else verify the table renders
  await screen.findByText(/sess-1/);
  expect(screen.getByText(/0\.0042/)).toBeInTheDocument();
});
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/renderer/brainShell/`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/brainShell/EconomicsPanel.jsx src/__tests__/renderer/brainShell/EconomicsPanel.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-3): EconomicsPanel By Session tab (per-trace cost)"
```

---

### Task 8: Fix smoke harness — Electron main-process invocation

**Files:**
- Modify: `.erb/scripts/test-smoke.js`

- [ ] **Step 1: Diagnose**

The current harness invokes:
```js
spawn(ELECTRON_BIN, ['-r', 'ts-node/register/transpile-only', APP_ENTRY], ...)
```
where `APP_ENTRY = src/main/main.ts`. Recent diagnosis revealed `require('electron')` returns a STRING (path to binary) when Electron is invoked with an explicit script file rather than a project directory. This means `import { app } from 'electron'` yields `app === undefined`, crashing at main.ts:265 `app.isPackaged`.

The fix: invoke Electron with the project root (which has `package.json`'s `main` field pointing at `./src/main/main.ts`). This switches Electron from "node script" mode to "main process" mode.

- [ ] **Step 2: Update the spawn call**

Replace `APP_ENTRY` with `PROJECT_ROOT`:

```js
const proc = spawn(
  ELECTRON_BIN,
  ['-r', 'ts-node/register/transpile-only', PROJECT_ROOT],
  {
    cwd: PROJECT_ROOT,
    env: { ...process.env, NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true' },
  },
);
```

(Keep all other harness logic — error patterns, timeout, kill — unchanged.)

- [ ] **Step 3: Update preflight**

The current preflight checks that `APP_ENTRY` exists. Replace with a check that `package.json` exists at PROJECT_ROOT:

```js
const PKG_JSON = path.join(PROJECT_ROOT, 'package.json');
if (!fs.existsSync(PKG_JSON)) {
  console.error(`[test-smoke] missing package.json at ${PROJECT_ROOT}`);
  process.exit(1);
}
```

Remove the `APP_ENTRY` constant if it's no longer used.

- [ ] **Step 4: Add a new error pattern**

Add a regex for the `Cannot read properties of undefined` pattern (which our previous diagnosis showed is missed by the current set):

```js
const ERROR_PATTERNS = [
  /TypeError:.*is not a function/i,
  /TypeError: Cannot read properties of undefined/i,  // ← new
  /SqliteError/,
  /Cannot find module/,
  /Uncaught Exception/i,
  /Failed to construct '.*': /i,
];
```

- [ ] **Step 5: Run smoke**

Run: `npm run test:smoke`
Expected: PASS (no flagged lines).

If it FAILS with a different error pattern, that pattern is a real bug to investigate. Don't silence it — fix the underlying issue. (Most likely candidate: a singleton init we haven't wired yet.)

- [ ] **Step 6: Commit**

```bash
git add .erb/scripts/test-smoke.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "fix(smoke): invoke Electron with project root for main-process mode"
```

---

## Success criteria (Plan 10b-3)

- All 8 tasks committed.
- New tests pass: `microCardProposerSingleton` (2), `productionPromptSingleton` (2), `BrainShell.activeQuest` (1), `SessionSummaryView` updated, `callLedgerStoreSessions` (2), EconomicsPanel session-tab (1). Total ≥ 8 new tests.
- Full `npx jest` green.
- `npm run test:smoke` green (Task 8 verifies).
- A session bound to an active Quest can be started from the orb, will produce real `learning_point` rows when `createMicroCard` fires, and will appear in the EconomicsPanel's "By Session" tab with its aggregated cost.

**Out of scope (deferred):**
- Canonical-surface integration (full StudyCardRouter / ComprehensionPanel embeds). Adapters stay purpose-built.
- Goal-proposal Director call when no Quest exists. Falls back to free-text input.
- MoodBoardSurface iframe replacement (still placeholder).
- SessionRunner memory pruning of completed sessions.
- Multi-session queue / cross-device sync.
