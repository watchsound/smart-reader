# Phase 10b-1 — Study-Session Director Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the headlessly-testable backend for the Study-Session Director: schema, Director.step kernel extraction, tool kind contract, all 13 tools, UndoRegistry, SessionRunner runtime, IPC + sessionApi. No UI in this plan.

**Architecture:** New `SessionRunner` orchestrator loops `Director.step()` (extracted from 10a) and dispatches by tool kind (read | surface | soft-write | control). Surface tools pause via `awaitUserResult`; soft-writes execute through spine with Undo registered; all moves traced with one `trace_id` per session.

**Tech Stack:** Node + better-sqlite3 + electron-store + Jest. No renderer changes.

**Conventions:**
- Run a single test file with `npx jest <path>`.
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit ...`.
- Don't write git config; don't skip pre-commit hooks.
- Every commit reuses one Co-Authored-By line; no destructive git operations.

**Spec:** [`docs/superpowers/specs/2026-06-17-phase-10b-study-session-director-design.md`](../specs/2026-06-17-phase-10b-study-session-director-design.md)

---

## File Map

**Create**
- `src/main/db/AISessionStore.js`
- `src/main/brain/director/SessionRunner.js`
- `src/main/brain/director/UndoRegistry.js`
- `src/main/brain/director/configs/studySession.js`
- `src/main/brain/director/tools/dueReviewsByDomain.js`
- `src/main/brain/director/tools/recentlyAcceptedMicroCards.js`
- `src/main/brain/director/tools/openLeitnerCard.js`
- `src/main/brain/director/tools/openComprehensionPanel.js`
- `src/main/brain/director/tools/openMicroCardChip.js`
- `src/main/brain/director/tools/openMoodBoard.js`
- `src/main/brain/director/tools/scheduleReread.js`
- `src/main/brain/director/tools/createMicroCard.js`
- `src/main/brain/director/tools/scheduleProductionPrompt.js`
- `src/main/brain/director/tools/endSession.js`
- `src/main/ipc/sessionHandlers.js`
- `src/renderer/api/sessionApi.js`
- `src/__tests__/director/SessionRunner.test.js`
- `src/__tests__/director/UndoRegistry.test.js`
- `src/__tests__/director/sessionToolKinds.test.js`
- `src/__tests__/ipc/sessionHandlers.test.js`
- `src/__tests__/integration/sessionRunnerHappyPath.test.js`

**Modify**
- `db.sql` — add `ai_sessions` + `ai_session_trace` tables
- `src/main/brain/director/Director.js` — extract `step()` from `run()`
- `src/main/brain/spine/tools.js` — add `kind` field on registration; expose `descriptors()`
- `src/main/brain/spine/seedIntents.js` — add `director-session-step` + `session-soft-write`
- `src/main/main.ts` — register sessionHandlers
- `src/__tests__/director/Director.test.js` — extend with step() tests
- `src/__tests__/director/intents.test.js` — bump intent count
- `src/__tests__/integration/spine-end-to-end.test.js` — bump intent count if asserting

---

### Task 1: Schema — `ai_sessions` + `ai_session_trace`

**Files:**
- Modify: `db.sql` (add DROP + CREATE near other recent tables, e.g., after `brain_call_ledger`)

- [ ] **Step 1: Add DROPs to preamble**

In the preamble DROP block, after `DROP TABLE IF EXISTS "brain_call_ledger";`:

```sql
DROP TABLE IF EXISTS "ai_session_trace";
DROP TABLE IF EXISTS "ai_sessions";
```

(Child before parent; ai_session_trace references ai_sessions.)

- [ ] **Step 2: Add CREATE TABLEs**

After the `brain_call_ledger` CREATE block:

```sql
CREATE TABLE "ai_sessions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" INTEGER NOT NULL,
  "quest_id" INTEGER,
  "goal" TEXT NOT NULL,
  "trace_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "iteration" INTEGER NOT NULL DEFAULT 0,
  "budget" INTEGER NOT NULL DEFAULT 12,
  "started_at" INTEGER NOT NULL,
  "ended_at" INTEGER,
  "error_reason" TEXT
);
CREATE INDEX "idx_ai_sessions_user_id" ON "ai_sessions" ("user_id", "started_at" DESC);
CREATE INDEX "idx_ai_sessions_trace_id" ON "ai_sessions" ("trace_id");

CREATE TABLE "ai_session_trace" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "session_id" TEXT NOT NULL,
  "iteration" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "payload_json" TEXT NOT NULL,
  "ts" INTEGER NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "ai_sessions" ("id")
);
CREATE INDEX "idx_ai_session_trace_session_id" ON "ai_session_trace" ("session_id", "ts" ASC);
```

- [ ] **Step 3: Verify schema parses**

Run: `node -e "const fs=require('fs');const sql=fs.readFileSync('db.sql','utf8');const Database=require('better-sqlite3');const db=new Database(':memory:');db.exec(sql);console.log('schema OK', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ai_session%'\").all());"`

Expected: `schema OK [ { name: 'ai_sessions' }, { name: 'ai_session_trace' } ]`

- [ ] **Step 4: Commit**

```bash
git add db.sql
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): add ai_sessions + ai_session_trace tables"
```

---

### Task 2: `AISessionStore` — completed-session persistence

**Files:**
- Create: `src/main/db/AISessionStore.js`
- Test: `src/__tests__/db/AISessionStore.test.js`

- [ ] **Step 1: Write failing test**

```js
// src/__tests__/db/AISessionStore.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return {
    getDb: () => db,
    __setDb: (next) => { db = next; },
  };
});
const dbManager = require('../../main/db/dbManager');
const AISessionStore = require('../../main/db/AISessionStore');

function freshDb() {
  const db = new Database(':memory:');
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8');
  db.exec(sql);
  dbManager.__setDb(db);
  return db;
}

test('persistCompleted writes session row + trace rows', () => {
  freshDb();
  const sessionId = AISessionStore.persistCompleted({
    id: 'sess-1', userId: 1, questId: null, goal: 'Review weak concepts',
    traceId: 'trace-1', status: 'completed', iteration: 5, budget: 12,
    startedAt: 1000, endedAt: 2000, errorReason: null,
    trace: [
      { iteration: 0, kind: 'thought', payload: { reason: 'start' }, ts: 1001 },
      { iteration: 0, kind: 'tool', payload: { tool: 'topUnmasteredConcepts' }, ts: 1002 },
    ],
  });
  expect(sessionId).toBe('sess-1');
  const sessions = AISessionStore.listByUser(1);
  expect(sessions).toHaveLength(1);
  expect(sessions[0].goal).toBe('Review weak concepts');
  const trace = AISessionStore.getTrace('sess-1');
  expect(trace).toHaveLength(2);
  expect(trace[0].kind).toBe('thought');
});

test('listByUser returns most-recent first, limit honored', () => {
  freshDb();
  for (let i = 0; i < 3; i++) {
    AISessionStore.persistCompleted({
      id: `s${i}`, userId: 2, questId: null, goal: `g${i}`,
      traceId: `t${i}`, status: 'completed', iteration: 1, budget: 12,
      startedAt: 1000 + i, endedAt: 2000 + i, errorReason: null, trace: [],
    });
  }
  const rows = AISessionStore.listByUser(2, 2);
  expect(rows.map(r => r.id)).toEqual(['s2', 's1']);
});
```

- [ ] **Step 2: Run test (expect fail — module missing)**

Run: `npx jest src/__tests__/db/AISessionStore.test.js`
Expected: `Cannot find module '.../AISessionStore'`

- [ ] **Step 3: Implement**

```js
// src/main/db/AISessionStore.js
const dbManager = require('./dbManager');

function persistCompleted(session) {
  const db = dbManager.getDb();
  const tx = db.transaction((s) => {
    db.prepare(`
      INSERT INTO ai_sessions
        (id, user_id, quest_id, goal, trace_id, status, iteration, budget, started_at, ended_at, error_reason)
      VALUES (@id, @userId, @questId, @goal, @traceId, @status, @iteration, @budget, @startedAt, @endedAt, @errorReason)
    `).run({
      id: s.id, userId: s.userId, questId: s.questId ?? null,
      goal: s.goal, traceId: s.traceId, status: s.status,
      iteration: s.iteration, budget: s.budget,
      startedAt: s.startedAt, endedAt: s.endedAt ?? null,
      errorReason: s.errorReason ?? null,
    });
    const insertTrace = db.prepare(`
      INSERT INTO ai_session_trace (session_id, iteration, kind, payload_json, ts)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const ev of s.trace || []) {
      insertTrace.run(s.id, ev.iteration, ev.kind, JSON.stringify(ev.payload || {}), ev.ts);
    }
  });
  tx(session);
  return session.id;
}

function listByUser(userId, limit = 20) {
  const db = dbManager.getDb();
  return db.prepare(`
    SELECT * FROM ai_sessions
    WHERE user_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).all(userId, limit);
}

function getTrace(sessionId) {
  const db = dbManager.getDb();
  const rows = db.prepare(`
    SELECT iteration, kind, payload_json, ts FROM ai_session_trace
    WHERE session_id = ?
    ORDER BY ts ASC
  `).all(sessionId);
  return rows.map(r => ({ iteration: r.iteration, kind: r.kind, payload: JSON.parse(r.payload_json), ts: r.ts }));
}

module.exports = { persistCompleted, listByUser, getTrace };
```

- [ ] **Step 4: Run tests (expect pass)**

Run: `npx jest src/__tests__/db/AISessionStore.test.js`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/main/db/AISessionStore.js src/__tests__/db/AISessionStore.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): AISessionStore for completed session persistence"
```

---

### Task 3: Tool kind contract + descriptors

**Files:**
- Modify: `src/main/brain/spine/tools.js`
- Test: `src/__tests__/director/sessionToolKinds.test.js`

- [ ] **Step 1: Read current tools.js**

Open `src/main/brain/spine/tools.js`. The Phase 10a version already has `register`, `registerHandler`, `describe`, `list`, `invoke`. We need to:
- Accept and store `kind` on `register(name, def)` (default `'read'`).
- Add `descriptors()` returning `[{ name, description, argsSchema, kind }]`.

- [ ] **Step 2: Write failing test**

```js
// src/__tests__/director/sessionToolKinds.test.js
const tools = require('../../main/brain/spine/tools');

beforeEach(() => tools.__reset?.());

test('register stores kind; default is read', () => {
  tools.register('t1', { description: 'd', argsSchema: {} });
  tools.register('t2', { description: 'd', argsSchema: {}, kind: 'surface' });
  const desc = tools.descriptors();
  const t1 = desc.find(t => t.name === 't1');
  const t2 = desc.find(t => t.name === 't2');
  expect(t1.kind).toBe('read');
  expect(t2.kind).toBe('surface');
});

test('descriptors returns array with name+description+argsSchema+kind', () => {
  tools.register('alpha', { description: 'A', argsSchema: { x: 'number' }, kind: 'soft-write' });
  const desc = tools.descriptors();
  const a = desc.find(t => t.name === 'alpha');
  expect(a).toEqual({ name: 'alpha', description: 'A', argsSchema: { x: 'number' }, kind: 'soft-write' });
});

test('rejects unknown kind', () => {
  expect(() => tools.register('bad', { description: 'd', argsSchema: {}, kind: 'wonky' }))
    .toThrow(/kind/);
});
```

- [ ] **Step 3: Run test (expect fail)**

Run: `npx jest src/__tests__/director/sessionToolKinds.test.js`
Expected: failures around `descriptors is not a function` or kind not stored.

- [ ] **Step 4: Implement**

In `src/main/brain/spine/tools.js`, extend `register`:

```js
const VALID_KINDS = ['read', 'surface', 'soft-write', 'control'];

function register(name, def) {
  if (!name) throw new Error('[tools.register] name required');
  if (def.kind && !VALID_KINDS.includes(def.kind)) {
    throw new Error(`[tools.register] invalid kind: ${def.kind}`);
  }
  REGISTRY.set(name, {
    name,
    description: def.description || '',
    argsSchema: def.argsSchema || {},
    kind: def.kind || 'read',
  });
}

function descriptors() {
  return Array.from(REGISTRY.values()).map(t => ({
    name: t.name, description: t.description, argsSchema: t.argsSchema, kind: t.kind,
  }));
}

// expose for tests if not already
function __reset() { REGISTRY.clear(); HANDLERS.clear(); }

module.exports = { register, registerHandler, describe, descriptors, list, invoke, __reset };
```

(Adapt to current file's `REGISTRY` / `HANDLERS` variable names.)

- [ ] **Step 5: Run test (expect pass)**

Run: `npx jest src/__tests__/director/sessionToolKinds.test.js`
Expected: 3 passing.

- [ ] **Step 6: Run all existing tool/spine tests for regression**

Run: `npx jest src/__tests__/director src/__tests__/spine`
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/main/brain/spine/tools.js src/__tests__/director/sessionToolKinds.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): tool kind contract + descriptors()"
```

---

### Task 4: Intent registry — `director-session-step` + `session-soft-write`

**Files:**
- Modify: `src/main/brain/spine/seedIntents.js`
- Modify: `src/__tests__/director/intents.test.js`
- Modify: `src/__tests__/integration/spine-end-to-end.test.js` (if it asserts a count)

- [ ] **Step 1: Update seedIntents.js**

Add two entries:

```js
intents.register('director-session-step', {
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery'],
  costCeilingTokens: 2000,
  cachePolicy: 'none',
  schema: { tool: 'string', args: 'object', reason: 'string' },
});

intents.register('session-soft-write', {
  contextSlices: [],
  costCeilingTokens: 200,
  cachePolicy: 'none',
  schema: null,
});
```

- [ ] **Step 2: Bump intent count tests**

In `src/__tests__/director/intents.test.js` find the assertion currently expecting 12 intents and bump to 14. Same in `spine-end-to-end.test.js` if it asserts a count.

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/director/intents.test.js src/__tests__/integration/spine-end-to-end.test.js`
Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add src/main/brain/spine/seedIntents.js src/__tests__/director/intents.test.js src/__tests__/integration/spine-end-to-end.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): register director-session-step + session-soft-write intents"
```

---

### Task 5: Director.step extraction

**Files:**
- Modify: `src/main/brain/director/Director.js`
- Modify: `src/__tests__/director/Director.test.js`

- [ ] **Step 1: Write failing test**

In `src/__tests__/director/Director.test.js`, add:

```js
test('step returns {tool, args, reason} from one brainCall — does not loop', async () => {
  const fakeBrainCall = jest.fn().mockResolvedValueOnce({
    output: { tool: 'topUnmasteredConcepts', args: { n: 5 }, reason: 'starting with weak concepts' },
    callId: 999,
  });
  jest.doMock('../../main/brain/spine/brainCall', () => fakeBrainCall);
  jest.resetModules();
  const Director = require('../../main/brain/director/Director');

  const decision = await Director.step({
    config: { intent: 'director-session-step', promptTemplate: () => 'prompt' },
    state: { goal: 'g', observations: [], iteration: 0, budget: 12 },
    traceId: 'trace-x',
  });

  expect(decision).toEqual({
    tool: 'topUnmasteredConcepts',
    args: { n: 5 },
    reason: 'starting with weak concepts',
  });
  expect(fakeBrainCall).toHaveBeenCalledTimes(1);
  expect(fakeBrainCall.mock.calls[0][1]).toMatchObject({ traceId: 'trace-x' });
});
```

- [ ] **Step 2: Run test (expect fail — Director.step undefined)**

Run: `npx jest src/__tests__/director/Director.test.js -t "step returns"`
Expected: `Director.step is not a function`.

- [ ] **Step 3: Refactor Director.js — extract step()**

In `src/main/brain/director/Director.js`:

```js
async function step({ config, state, traceId, userId }) {
  const prompt = config.promptTemplate(state);
  const { output } = await brainCall(config.intent, {
    prompt,
    schema: config.responseSchema || null,
    traceId,
    userId,
  });
  return output;
}

async function run({ config, input, userId }) {
  const traceId = uuid();
  let state = { input, observations: [], iteration: 0, budget: config.budget || 3 };
  let usedFallback = false;
  let lastError = null;
  while (state.iteration < state.budget) {
    let decision;
    try {
      decision = await step({ config, state, traceId, userId });
    } catch (e) {
      lastError = e;
      break;
    }
    if (decision?.tool === '__answer__') {
      return { output: decision.answer, traceId, usedFallback };
    }
    try {
      const result = await tools.invoke(decision.tool, decision.args);
      state.observations.push({ tool: decision.tool, result });
    } catch (e) {
      lastError = e;
      break;
    }
    state.iteration++;
  }
  usedFallback = true;
  return { output: config.fallback({ state, error: lastError }), traceId, usedFallback };
}

module.exports = { run, step };
```

(Preserve existing 10a behavior: pull-suggestion config still works.)

- [ ] **Step 4: Run all Director tests**

Run: `npx jest src/__tests__/director/Director.test.js`
Expected: all passing including the new step test and existing run tests.

- [ ] **Step 5: Smoke-test pull-suggestion still works**

Run: `npx jest src/__tests__/director` (the whole director directory)
Expected: 100% green.

- [ ] **Step 6: Commit**

```bash
git add src/main/brain/director/Director.js src/__tests__/director/Director.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "refactor(phase-10b-1): extract Director.step() as single-decision primitive"
```

---

### Task 6: Read tools — `dueReviewsByDomain` + `recentlyAcceptedMicroCards`

**Files:**
- Create: `src/main/brain/director/tools/dueReviewsByDomain.js`
- Create: `src/main/brain/director/tools/recentlyAcceptedMicroCards.js`
- Test: `src/__tests__/director/sessionReadTools.test.js`

- [ ] **Step 1: Write failing test**

```js
// src/__tests__/director/sessionReadTools.test.js
const tools = require('../../main/brain/spine/tools');
require('../../main/brain/director/tools/dueReviewsByDomain');
require('../../main/brain/director/tools/recentlyAcceptedMicroCards');

jest.mock('../../main/db/LearningPointManager', () => ({
  dueByDomain: jest.fn(),
  recentlyAccepted: jest.fn(),
}));
const LPM = require('../../main/db/LearningPointManager');

test('dueReviewsByDomain returns domain buckets', async () => {
  LPM.dueByDomain.mockReturnValue([
    { domain: 'vocabulary', count: 5, sampleIds: [1, 2, 3] },
    { domain: 'concept', count: 2, sampleIds: [4, 5] },
  ]);
  const result = await tools.invoke('dueReviewsByDomain', { userId: 1 });
  expect(result).toEqual([
    { domain: 'vocabulary', count: 5, sampleIds: [1, 2, 3] },
    { domain: 'concept', count: 2, sampleIds: [4, 5] },
  ]);
});

test('recentlyAcceptedMicroCards returns last N cards', async () => {
  LPM.recentlyAccepted.mockReturnValue([
    { id: 10, headword: 'parse', acceptedAt: 1000 },
    { id: 11, headword: 'lex', acceptedAt: 1100 },
  ]);
  const result = await tools.invoke('recentlyAcceptedMicroCards', { userId: 1, n: 2 });
  expect(result).toHaveLength(2);
  expect(result[0].headword).toBe('parse');
});

test('both tools registered with kind=read', () => {
  const desc = tools.descriptors();
  expect(desc.find(t => t.name === 'dueReviewsByDomain').kind).toBe('read');
  expect(desc.find(t => t.name === 'recentlyAcceptedMicroCards').kind).toBe('read');
});
```

- [ ] **Step 2: Run test (expect fail — modules missing)**

Run: `npx jest src/__tests__/director/sessionReadTools.test.js`
Expected: module-not-found errors.

- [ ] **Step 3: Implement `dueReviewsByDomain.js`**

```js
const tools = require('../../spine/tools');
const LPM = require('../../../db/LearningPointManager');

tools.register('dueReviewsByDomain', {
  description: 'Get due-review counts bucketed by domain (vocabulary, concept, code, math). Use to pick which domain to focus on.',
  argsSchema: { userId: 'number' },
  kind: 'read',
});

tools.registerHandler('dueReviewsByDomain', async ({ userId }) => {
  return LPM.dueByDomain(userId);
});
```

- [ ] **Step 4: Implement `recentlyAcceptedMicroCards.js`**

```js
const tools = require('../../spine/tools');
const LPM = require('../../../db/LearningPointManager');

tools.register('recentlyAcceptedMicroCards', {
  description: 'Last N Phase-4 micro-cards the user accepted, newest first. Use to see what was just added.',
  argsSchema: { userId: 'number', n: 'number' },
  kind: 'read',
});

tools.registerHandler('recentlyAcceptedMicroCards', async ({ userId, n = 10 }) => {
  return LPM.recentlyAccepted(userId, n);
});
```

- [ ] **Step 5: Add `LearningPointManager.dueByDomain` + `recentlyAccepted`**

In `src/main/db/LearningPointManager.js`, add named exports:

```js
function dueByDomain(userId) {
  const db = dbManager.getDb();
  return db.prepare(`
    SELECT domain_type AS domain, COUNT(*) AS count,
           (SELECT json_group_array(id) FROM (
             SELECT id FROM learning_point
             WHERE user_id = ? AND domain_type = lp.domain_type
               AND next_review <= ? LIMIT 5)) AS sample_json
    FROM learning_point lp
    WHERE user_id = ? AND next_review <= ?
    GROUP BY domain_type
    ORDER BY count DESC
  `).all(userId, Date.now(), userId, Date.now()).map(r => ({
    domain: r.domain,
    count: r.count,
    sampleIds: JSON.parse(r.sample_json || '[]'),
  }));
}

function recentlyAccepted(userId, n = 10) {
  const db = dbManager.getDb();
  return db.prepare(`
    SELECT id, headword, accepted_at AS acceptedAt
    FROM learning_point
    WHERE user_id = ? AND accepted_at IS NOT NULL
    ORDER BY accepted_at DESC LIMIT ?
  `).all(userId, n);
}

module.exports = { ...module.exports, dueByDomain, recentlyAccepted };
```

(Adapt to current LearningPointManager export style — may be class-based or named exports.)

- [ ] **Step 6: Run test (expect pass)**

Run: `npx jest src/__tests__/director/sessionReadTools.test.js`
Expected: 3 passing.

- [ ] **Step 7: Commit**

```bash
git add src/main/brain/director/tools/dueReviewsByDomain.js src/main/brain/director/tools/recentlyAcceptedMicroCards.js src/main/db/LearningPointManager.js src/__tests__/director/sessionReadTools.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): read tools dueReviewsByDomain + recentlyAcceptedMicroCards"
```

---

### Task 7: UndoRegistry + `scheduleReread` soft-write tool

**Files:**
- Create: `src/main/brain/director/UndoRegistry.js`
- Create: `src/main/brain/director/tools/scheduleReread.js`
- Test: `src/__tests__/director/UndoRegistry.test.js`

- [ ] **Step 1: Write failing test for UndoRegistry**

```js
// src/__tests__/director/UndoRegistry.test.js
const UndoRegistry = require('../../main/brain/director/UndoRegistry');

beforeEach(() => UndoRegistry.__reset());

test('register + run reversal handler', async () => {
  const reverse = jest.fn().mockResolvedValue({ undone: true });
  UndoRegistry.register('myTool', reverse);
  const result = await UndoRegistry.run('myTool', { id: 42 });
  expect(reverse).toHaveBeenCalledWith({ id: 42 });
  expect(result).toEqual({ undone: true });
});

test('unknown tool returns undone:false', async () => {
  const result = await UndoRegistry.run('nonexistent', {});
  expect(result).toEqual({ undone: false, reason: 'no-handler' });
});

test('handler throwing returns undone:false with reason', async () => {
  UndoRegistry.register('boom', () => { throw new Error('busted'); });
  const result = await UndoRegistry.run('boom', {});
  expect(result.undone).toBe(false);
  expect(result.reason).toMatch(/busted/);
});
```

- [ ] **Step 2: Implement UndoRegistry**

```js
// src/main/brain/director/UndoRegistry.js
const HANDLERS = new Map();

function register(toolName, handler) { HANDLERS.set(toolName, handler); }

async function run(toolName, args) {
  const handler = HANDLERS.get(toolName);
  if (!handler) return { undone: false, reason: 'no-handler' };
  try {
    return await handler(args);
  } catch (e) {
    return { undone: false, reason: e.message };
  }
}

function __reset() { HANDLERS.clear(); }

module.exports = { register, run, __reset };
```

- [ ] **Step 3: Run UndoRegistry tests**

Run: `npx jest src/__tests__/director/UndoRegistry.test.js`
Expected: 3 passing.

- [ ] **Step 4: Write failing test for scheduleReread tool**

Add to `src/__tests__/director/sessionSoftWriteTools.test.js`:

```js
const tools = require('../../main/brain/spine/tools');
const UndoRegistry = require('../../main/brain/director/UndoRegistry');

jest.mock('../../main/utils/RereadQueueService', () => ({
  schedule: jest.fn().mockReturnValue({ id: 'rq-1' }),
  unschedule: jest.fn().mockReturnValue(true),
}));
jest.mock('../../main/brain/spine/meteredCallJson', () => jest.fn().mockResolvedValue({ output: 'ok', callId: 77 }));

require('../../main/brain/director/tools/scheduleReread');
const RQ = require('../../main/utils/RereadQueueService');

test('scheduleReread executes + returns callId + registers undo', async () => {
  const result = await tools.invoke('scheduleReread', {
    userId: 1, bookId: 5, chapterId: 'ch-3', reason: 'low comprehension'
  });
  expect(RQ.schedule).toHaveBeenCalledWith(1, 5, 'ch-3', 'low comprehension');
  expect(result.callId).toBe(77);
  expect(result.rescheduleId).toBe('rq-1');
});

test('scheduleReread undo reverses', async () => {
  const result = await UndoRegistry.run('scheduleReread', { rescheduleId: 'rq-1' });
  expect(RQ.unschedule).toHaveBeenCalledWith('rq-1');
  expect(result.undone).toBe(true);
});

test('scheduleReread registered with kind=soft-write', () => {
  const desc = tools.descriptors().find(t => t.name === 'scheduleReread');
  expect(desc.kind).toBe('soft-write');
});
```

- [ ] **Step 5: Implement `scheduleReread.js`**

```js
const tools = require('../../spine/tools');
const meteredCallJson = require('../../spine/meteredCallJson');
const RereadQueueService = require('../../../utils/RereadQueueService');
const UndoRegistry = require('../UndoRegistry');

tools.register('scheduleReread', {
  description: 'Schedule a chapter for spaced rereading. Reversible.',
  argsSchema: { userId: 'number', bookId: 'number', chapterId: 'string', reason: 'string' },
  kind: 'soft-write',
});

tools.registerHandler('scheduleReread', async ({ userId, bookId, chapterId, reason }, ctx = {}) => {
  const { callId } = await meteredCallJson(
    `Acknowledge schedule reread of book ${bookId} chapter ${chapterId}. Reason: ${reason}`,
    null,
    { legacyLabel: 'session-soft-write:scheduleReread', traceId: ctx.traceId }
  );
  const { id: rescheduleId } = RereadQueueService.schedule(userId, bookId, chapterId, reason);
  return { callId, rescheduleId };
});

UndoRegistry.register('scheduleReread', async ({ rescheduleId }) => {
  const undone = RereadQueueService.unschedule(rescheduleId);
  return { undone: !!undone };
});
```

- [ ] **Step 6: Check RereadQueueService has `unschedule`**

Run: `grep -n unschedule src/main/utils/RereadQueueService.js` — if missing, add a method that removes by id and returns boolean.

- [ ] **Step 7: Run all soft-write + undo tests**

Run: `npx jest src/__tests__/director/UndoRegistry.test.js src/__tests__/director/sessionSoftWriteTools.test.js`
Expected: 6 passing.

- [ ] **Step 8: Commit**

```bash
git add src/main/brain/director/UndoRegistry.js src/main/brain/director/tools/scheduleReread.js src/main/utils/RereadQueueService.js src/__tests__/director/UndoRegistry.test.js src/__tests__/director/sessionSoftWriteTools.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): UndoRegistry + scheduleReread soft-write tool"
```

---

### Task 8: `createMicroCard` + `scheduleProductionPrompt` soft-writes

**Files:**
- Create: `src/main/brain/director/tools/createMicroCard.js`
- Create: `src/main/brain/director/tools/scheduleProductionPrompt.js`
- Test: extend `src/__tests__/director/sessionSoftWriteTools.test.js`

- [ ] **Step 1: Extend test file**

```js
jest.mock('../../main/utils/MicroCardProposer', () => ({
  commit: jest.fn().mockReturnValue({ id: 'mc-1' }),
  delete: jest.fn().mockReturnValue(true),
}));
jest.mock('../../main/brain/ProductionPromptService', () => ({
  schedulePrompt: jest.fn().mockReturnValue({ id: 'pp-1' }),
  unschedule: jest.fn().mockReturnValue(true),
}));
require('../../main/brain/director/tools/createMicroCard');
require('../../main/brain/director/tools/scheduleProductionPrompt');
const MCP = require('../../main/utils/MicroCardProposer');
const PPS = require('../../main/brain/ProductionPromptService');

test('createMicroCard executes + undo reverses', async () => {
  const result = await tools.invoke('createMicroCard', {
    userId: 1, paragraphHash: 'h1', draft: { headword: 'parse', definition: 'd' }, domain: 'vocabulary'
  });
  expect(MCP.commit).toHaveBeenCalled();
  expect(result.microCardId).toBe('mc-1');
  const undo = await UndoRegistry.run('createMicroCard', { microCardId: 'mc-1' });
  expect(undo.undone).toBe(true);
});

test('scheduleProductionPrompt executes + undo reverses', async () => {
  const result = await tools.invoke('scheduleProductionPrompt', {
    userId: 1, learningPointId: 99, prompt: 'Write a sentence using "parse"'
  });
  expect(PPS.schedulePrompt).toHaveBeenCalled();
  expect(result.promptId).toBe('pp-1');
  const undo = await UndoRegistry.run('scheduleProductionPrompt', { promptId: 'pp-1' });
  expect(undo.undone).toBe(true);
});
```

- [ ] **Step 2: Implement `createMicroCard.js`**

```js
const tools = require('../../spine/tools');
const meteredCallJson = require('../../spine/meteredCallJson');
const MicroCardProposer = require('../../../utils/MicroCardProposer');
const UndoRegistry = require('../UndoRegistry');

tools.register('createMicroCard', {
  description: 'Create a micro-card from a paragraph the user just read. Reversible.',
  argsSchema: { userId: 'number', paragraphHash: 'string', draft: 'object', domain: 'string' },
  kind: 'soft-write',
});

tools.registerHandler('createMicroCard', async (args, ctx = {}) => {
  const { callId } = await meteredCallJson(
    `Create micro-card from paragraph ${args.paragraphHash}, domain ${args.domain}`,
    null,
    { legacyLabel: 'session-soft-write:createMicroCard', traceId: ctx.traceId }
  );
  const { id: microCardId } = MicroCardProposer.commit({
    userId: args.userId, paragraphHash: args.paragraphHash, draft: args.draft, domain: args.domain,
  });
  return { callId, microCardId };
});

UndoRegistry.register('createMicroCard', async ({ microCardId }) => {
  const undone = MicroCardProposer.delete(microCardId);
  return { undone: !!undone };
});
```

- [ ] **Step 3: Implement `scheduleProductionPrompt.js`**

```js
const tools = require('../../spine/tools');
const meteredCallJson = require('../../spine/meteredCallJson');
const ProductionPromptService = require('../../ProductionPromptService');
const UndoRegistry = require('../UndoRegistry');

tools.register('scheduleProductionPrompt', {
  description: 'Schedule a production-style prompt for a high-mastery concept. Reversible.',
  argsSchema: { userId: 'number', learningPointId: 'number', prompt: 'string' },
  kind: 'soft-write',
});

tools.registerHandler('scheduleProductionPrompt', async (args, ctx = {}) => {
  const { callId } = await meteredCallJson(
    `Schedule production prompt for LP ${args.learningPointId}: ${args.prompt}`,
    null,
    { legacyLabel: 'session-soft-write:scheduleProductionPrompt', traceId: ctx.traceId }
  );
  const { id: promptId } = ProductionPromptService.schedulePrompt({
    userId: args.userId, learningPointId: args.learningPointId, prompt: args.prompt,
  });
  return { callId, promptId };
});

UndoRegistry.register('scheduleProductionPrompt', async ({ promptId }) => {
  const undone = ProductionPromptService.unschedule(promptId);
  return { undone: !!undone };
});
```

- [ ] **Step 4: Verify `MicroCardProposer.commit` + `.delete` exist; add if missing**

Run: `grep -nE "commit|delete" src/main/utils/MicroCardProposer.js` — if absent, add the methods. `commit` should accept the args shape above; `delete(id)` removes a learning_point row.

- [ ] **Step 5: Verify `ProductionPromptService.unschedule` exists; add if missing**

Same pattern in `src/main/brain/ProductionPromptService.js`.

- [ ] **Step 6: Run tests**

Run: `npx jest src/__tests__/director/sessionSoftWriteTools.test.js`
Expected: all (now 5+) passing.

- [ ] **Step 7: Commit**

```bash
git add src/main/brain/director/tools/createMicroCard.js src/main/brain/director/tools/scheduleProductionPrompt.js src/main/utils/MicroCardProposer.js src/main/brain/ProductionPromptService.js src/__tests__/director/sessionSoftWriteTools.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): createMicroCard + scheduleProductionPrompt soft-writes"
```

---

### Task 9: Surface tools — all 4

**Files:**
- Create: `src/main/brain/director/tools/openLeitnerCard.js`
- Create: `src/main/brain/director/tools/openComprehensionPanel.js`
- Create: `src/main/brain/director/tools/openMicroCardChip.js`
- Create: `src/main/brain/director/tools/openMoodBoard.js`
- Test: `src/__tests__/director/sessionSurfaceTools.test.js`

- [ ] **Step 1: Write failing test**

```js
const tools = require('../../main/brain/spine/tools');
require('../../main/brain/director/tools/openLeitnerCard');
require('../../main/brain/director/tools/openComprehensionPanel');
require('../../main/brain/director/tools/openMicroCardChip');
require('../../main/brain/director/tools/openMoodBoard');

test('all 4 surface tools registered with kind=surface', () => {
  const desc = tools.descriptors();
  ['openLeitnerCard', 'openComprehensionPanel', 'openMicroCardChip', 'openMoodBoard']
    .forEach(name => {
      const t = desc.find(d => d.name === name);
      expect(t).toBeDefined();
      expect(t.kind).toBe('surface');
    });
});

test('surface handler delegates to ctx.awaitUserResult', async () => {
  const ctx = { awaitUserResult: jest.fn().mockResolvedValue({ rating: 'easy', durationMs: 1234 }) };
  const result = await tools.invoke('openLeitnerCard', { learningPointId: 99 }, ctx);
  expect(ctx.awaitUserResult).toHaveBeenCalledWith({ tool: 'openLeitnerCard', args: { learningPointId: 99 } });
  expect(result).toEqual({ rating: 'easy', durationMs: 1234 });
});
```

- [ ] **Step 2: Verify `tools.invoke` accepts ctx**

In `src/main/brain/spine/tools.js`, `invoke(name, args, ctx)` should pass `ctx` to handler. If not currently, extend:

```js
async function invoke(name, args, ctx = {}) {
  const handler = HANDLERS.get(name);
  if (!handler) throw new Error(`[tools.invoke] no handler for ${name}`);
  return handler(args, ctx);
}
```

- [ ] **Step 3: Implement all 4 surface tools**

```js
// openLeitnerCard.js
const tools = require('../../spine/tools');
tools.register('openLeitnerCard', {
  description: 'Open a Leitner-system card for the user to rate. Returns { rating, durationMs }.',
  argsSchema: { learningPointId: 'number' },
  kind: 'surface',
});
tools.registerHandler('openLeitnerCard', async (args, ctx) => {
  if (!ctx.awaitUserResult) throw new Error('openLeitnerCard requires session ctx');
  return ctx.awaitUserResult({ tool: 'openLeitnerCard', args });
});
```

```js
// openComprehensionPanel.js
const tools = require('../../spine/tools');
tools.register('openComprehensionPanel', {
  description: 'Open the chapter-end comprehension panel. Returns { score, answer }.',
  argsSchema: { bookId: 'number', chapterId: 'string' },
  kind: 'surface',
});
tools.registerHandler('openComprehensionPanel', async (args, ctx) => {
  if (!ctx.awaitUserResult) throw new Error('openComprehensionPanel requires session ctx');
  return ctx.awaitUserResult({ tool: 'openComprehensionPanel', args });
});
```

```js
// openMicroCardChip.js
const tools = require('../../spine/tools');
tools.register('openMicroCardChip', {
  description: 'Show a Phase 4 micro-card chip for a paragraph. Returns { accepted, durationMs }.',
  argsSchema: { paragraphHash: 'string', proposal: 'object' },
  kind: 'surface',
});
tools.registerHandler('openMicroCardChip', async (args, ctx) => {
  if (!ctx.awaitUserResult) throw new Error('openMicroCardChip requires session ctx');
  return ctx.awaitUserResult({ tool: 'openMicroCardChip', args });
});
```

```js
// openMoodBoard.js
const tools = require('../../spine/tools');
tools.register('openMoodBoard', {
  description: 'Open a MoodBoard for organize-style review. Returns { dwellMs, dismissed }.',
  argsSchema: { boardId: 'number' },
  kind: 'surface',
});
tools.registerHandler('openMoodBoard', async (args, ctx) => {
  if (!ctx.awaitUserResult) throw new Error('openMoodBoard requires session ctx');
  return ctx.awaitUserResult({ tool: 'openMoodBoard', args });
});
```

- [ ] **Step 4: Run test**

Run: `npx jest src/__tests__/director/sessionSurfaceTools.test.js`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/director/tools/openLeitnerCard.js src/main/brain/director/tools/openComprehensionPanel.js src/main/brain/director/tools/openMicroCardChip.js src/main/brain/director/tools/openMoodBoard.js src/main/brain/spine/tools.js src/__tests__/director/sessionSurfaceTools.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): 4 surface tools (Leitner/Comprehension/MicroCardChip/MoodBoard)"
```

---

### Task 10: `endSession` control tool

**Files:**
- Create: `src/main/brain/director/tools/endSession.js`
- Test: extend `src/__tests__/director/sessionToolKinds.test.js` or `sessionSurfaceTools.test.js`

- [ ] **Step 1: Write failing test**

In a new file `src/__tests__/director/sessionEndSession.test.js`:

```js
const tools = require('../../main/brain/spine/tools');
require('../../main/brain/director/tools/endSession');

test('endSession registered with kind=control', () => {
  const desc = tools.descriptors().find(t => t.name === 'endSession');
  expect(desc.kind).toBe('control');
});

test('endSession handler returns the reason', async () => {
  const result = await tools.invoke('endSession', { reason: 'goal-satisfied' });
  expect(result).toEqual({ reason: 'goal-satisfied' });
});
```

- [ ] **Step 2: Implement**

```js
// endSession.js
const tools = require('../../spine/tools');

tools.register('endSession', {
  description: 'End the session. Call when the goal is satisfied or no useful next action remains.',
  argsSchema: { reason: 'string' },
  kind: 'control',
});

tools.registerHandler('endSession', async ({ reason }) => ({ reason }));
```

- [ ] **Step 3: Run test**

Run: `npx jest src/__tests__/director/sessionEndSession.test.js`
Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add src/main/brain/director/tools/endSession.js src/__tests__/director/sessionEndSession.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): endSession control tool"
```

---

### Task 11: `studySession` Director config

**Files:**
- Create: `src/main/brain/director/configs/studySession.js`
- Test: `src/__tests__/director/studySessionConfig.test.js`

- [ ] **Step 1: Write failing test**

```js
const config = require('../../main/brain/director/configs/studySession');

test('config wires director-session-step intent + 13 tools', () => {
  expect(config.intent).toBe('director-session-step');
  expect(config.tools).toEqual(expect.arrayContaining([
    'topUnmasteredConcepts', 'recentEpisodeSummary', 'currentQuestProgress',
    'dueReviewsByDomain', 'recentlyAcceptedMicroCards',
    'openLeitnerCard', 'openComprehensionPanel', 'openMicroCardChip', 'openMoodBoard',
    'scheduleReread', 'createMicroCard', 'scheduleProductionPrompt',
    'endSession',
  ]));
  expect(config.tools).toHaveLength(13);
  expect(config.budget).toBe(12);
});

test('promptTemplate includes goal + iteration + observations', () => {
  const prompt = config.promptTemplate({
    goal: 'Review weak vocabulary', iteration: 2, budget: 12,
    observations: [{ tool: 'topUnmasteredConcepts', summary: '5 weak' }],
    softWrites: [],
  });
  expect(prompt).toMatch(/Review weak vocabulary/);
  expect(prompt).toMatch(/2\/12/);
  expect(prompt).toMatch(/topUnmasteredConcepts/);
});

test('fallback returns endSession with budget-exhausted reason', () => {
  const decision = config.fallback({ state: { iteration: 12 } });
  expect(decision.tool).toBe('endSession');
  expect(decision.args.reason).toMatch(/fallback/);
});
```

- [ ] **Step 2: Implement**

```js
// configs/studySession.js
module.exports = {
  intent: 'director-session-step',
  budget: 12,
  tools: [
    'topUnmasteredConcepts', 'recentEpisodeSummary', 'currentQuestProgress',
    'dueReviewsByDomain', 'recentlyAcceptedMicroCards',
    'openLeitnerCard', 'openComprehensionPanel', 'openMicroCardChip', 'openMoodBoard',
    'scheduleReread', 'createMicroCard', 'scheduleProductionPrompt',
    'endSession',
  ],
  promptTemplate: ({ goal, iteration, budget, observations, softWrites }) => `
You are conducting a study session.

Goal: ${goal}
Iteration: ${iteration}/${budget}
Observations so far: ${JSON.stringify(observations || [])}
Soft writes so far: ${(softWrites || []).map(w => w.tool).join(', ') || 'none'}

Pick ONE tool to invoke next. If the goal is satisfied or no useful action remains, call endSession.
Return JSON: { "tool": "<name>", "args": {...}, "reason": "<one sentence>" }.
`.trim(),
  responseSchema: {
    type: 'object',
    properties: { tool: { type: 'string' }, args: { type: 'object' }, reason: { type: 'string' } },
    required: ['tool', 'args', 'reason'],
  },
  fallback: ({ state }) => ({
    tool: 'endSession',
    args: { reason: 'fallback: director unavailable' },
    reason: 'fallback path',
  }),
};
```

- [ ] **Step 3: Run test**

Run: `npx jest src/__tests__/director/studySessionConfig.test.js`
Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add src/main/brain/director/configs/studySession.js src/__tests__/director/studySessionConfig.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): studySession Director config"
```

---

### Task 12: `SessionRunner` orchestrator — happy path

**Files:**
- Create: `src/main/brain/director/SessionRunner.js`
- Test: `src/__tests__/director/SessionRunner.test.js`

- [ ] **Step 1: Write failing test**

```js
// SessionRunner.test.js
jest.mock('../../main/brain/spine/tools', () => {
  const REG = new Map(), HND = new Map();
  return {
    register: (n, d) => REG.set(n, { ...d, name: n }),
    registerHandler: (n, h) => HND.set(n, h),
    invoke: (n, a, ctx) => HND.get(n)(a, ctx),
    descriptors: () => Array.from(REG.values()).map(t => ({ name: t.name, kind: t.kind, description: t.description, argsSchema: t.argsSchema })),
    get: (n) => REG.get(n),
    __reset: () => { REG.clear(); HND.clear(); },
  };
});
const tools = require('../../main/brain/spine/tools');
const Director = require('../../main/brain/director/Director');
const SessionRunner = require('../../main/brain/director/SessionRunner');

beforeEach(() => {
  tools.__reset();
  tools.register('readA', { kind: 'read', description: 'd', argsSchema: {} });
  tools.registerHandler('readA', async () => [{ x: 1 }]);
  tools.register('writeA', { kind: 'soft-write', description: 'd', argsSchema: {} });
  tools.registerHandler('writeA', async () => ({ callId: 11, swExtraId: 'sw-1' }));
  tools.register('surfaceA', { kind: 'surface', description: 'd', argsSchema: {} });
  tools.registerHandler('surfaceA', async (a, ctx) => ctx.awaitUserResult({ tool: 'surfaceA', args: a }));
  tools.register('endSession', { kind: 'control', description: 'd', argsSchema: {} });
  tools.registerHandler('endSession', async ({ reason }) => ({ reason }));
});

const stubStore = () => {
  const state = {};
  return {
    saveActive: jest.fn(s => { state.active = JSON.parse(JSON.stringify(s)); }),
    loadActive: jest.fn(() => state.active),
    clearActive: jest.fn(() => { delete state.active; }),
    persistCompleted: jest.fn(),
  };
};

test('happy path: read → surface → soft-write → endSession', async () => {
  const decisions = [
    { tool: 'readA', args: {}, reason: 'gather' },
    { tool: 'surfaceA', args: { x: 1 }, reason: 'show' },
    { tool: 'writeA', args: { y: 2 }, reason: 'schedule' },
    { tool: 'endSession', args: { reason: 'done' }, reason: 'wrap' },
  ];
  jest.spyOn(Director, 'step').mockImplementation(async () => decisions.shift());

  const store = stubStore();
  const broadcast = jest.fn();
  const runner = new SessionRunner({ store, director: Director, broadcast });

  const { sessionId } = await runner.start({ userId: 1, goal: 'Test session' });

  // simulate user result before the surface step's awaitUserResult resolves
  // need to wait for the runner to reach the surfaceA dispatch first
  setTimeout(() => runner.userResult(sessionId, { rating: 'easy', durationMs: 500 }), 50);

  await runner.waitForCompletion(sessionId);

  const completed = store.persistCompleted.mock.calls[0][0];
  expect(completed.status).toBe('completed');
  expect(completed.iteration).toBeGreaterThanOrEqual(3);
  const kinds = completed.trace.map(t => t.kind);
  expect(kinds).toContain('thought');
  expect(kinds).toContain('observation');
  expect(kinds).toContain('surface');
  expect(kinds).toContain('soft-write');
  expect(kinds).toContain('end');
});
```

- [ ] **Step 2: Implement `SessionRunner.js`**

```js
const { v4: uuid } = require('uuid');
const tools = require('../spine/tools');

class SessionRunner {
  constructor({ store, director, broadcast }) {
    this.store = store;
    this.director = director;
    this.broadcast = broadcast;
    this.active = new Map();           // sessionId → { state, pendingSurfaceResolver, completionPromise }
  }

  async start({ userId, questId = null, goal }) {
    const state = {
      id: uuid(),
      userId,
      questId,
      goal,
      traceId: uuid(),
      status: 'active',
      iteration: 0,
      budget: 12,
      trace: [],
      observations: [],
      softWrites: [],
      pendingSurface: null,
      startedAt: Date.now(),
      endedAt: null,
      errorReason: null,
      lastError: null,
      consecutiveErrors: 0,
    };
    await this.store.saveActive(state);
    let completionResolve;
    const completionPromise = new Promise(r => { completionResolve = r; });
    this.active.set(state.id, { state, pendingSurfaceResolver: null, completionResolve, completionPromise });
    this.runLoop(state.id).catch(err => this.handleFatal(state.id, err));
    return { sessionId: state.id, traceId: state.traceId };
  }

  ctx(state) {
    return {
      userId: state.userId,
      sessionId: state.id,
      traceId: state.traceId,
      awaitUserResult: (payload) => this.awaitUserResult(state.id, payload),
    };
  }

  awaitUserResult(sessionId, payload) {
    const entry = this.active.get(sessionId);
    return new Promise((resolve) => {
      entry.pendingSurfaceResolver = resolve;
      this.broadcast({ sessionId, kind: 'openSurface', payload });
    });
  }

  userResult(sessionId, result) {
    const entry = this.active.get(sessionId);
    if (!entry?.pendingSurfaceResolver) return false;
    const r = entry.pendingSurfaceResolver;
    entry.pendingSurfaceResolver = null;
    r(result);
    return true;
  }

  cancel(sessionId) {
    const entry = this.active.get(sessionId);
    if (!entry) return false;
    entry.state.userCancelled = true;
    if (entry.pendingSurfaceResolver) {
      const r = entry.pendingSurfaceResolver;
      entry.pendingSurfaceResolver = null;
      r({ cancelled: true });
    }
    return true;
  }

  waitForCompletion(sessionId) {
    return this.active.get(sessionId).completionPromise;
  }

  async runLoop(sessionId) {
    const entry = this.active.get(sessionId);
    const state = entry.state;
    const config = require('./configs/studySession');

    while (state.status === 'active') {
      let decision;
      try {
        decision = await this.director.step({
          config,
          state: {
            goal: state.goal, iteration: state.iteration, budget: state.budget,
            observations: state.observations, softWrites: state.softWrites,
          },
          traceId: state.traceId, userId: state.userId,
        });
        state.consecutiveErrors = 0;
      } catch (e) {
        state.lastError = e.message;
        state.consecutiveErrors++;
        this.appendTrace(state, { kind: 'error', iteration: state.iteration, payload: { message: e.message } });
        if (state.consecutiveErrors >= 3) { await this.finish(state, 'consecutive-errors'); break; }
        continue;
      }

      this.appendTrace(state, { kind: 'thought', iteration: state.iteration, payload: { reason: decision.reason } });
      this.appendTrace(state, { kind: 'tool', iteration: state.iteration, payload: { tool: decision.tool, args: decision.args } });

      const tool = tools.descriptors().find(t => t.name === decision.tool);
      if (!tool) {
        state.lastError = `unknown tool ${decision.tool}`;
        state.consecutiveErrors++;
        this.appendTrace(state, { kind: 'error', iteration: state.iteration, payload: { message: state.lastError } });
        if (state.consecutiveErrors >= 3) { await this.finish(state, 'consecutive-errors'); break; }
        continue;
      }

      try {
        if (tool.kind === 'control') {
          await this.finish(state, decision.args?.reason || 'control');
          break;
        }
        if (tool.kind === 'read') {
          const result = await tools.invoke(decision.tool, decision.args, this.ctx(state));
          const summary = JSON.stringify(result).slice(0, 200);
          state.observations.push({ tool: decision.tool, summary });
          this.appendTrace(state, { kind: 'observation', iteration: state.iteration, payload: { summary } });
        } else if (tool.kind === 'surface') {
          state.pendingSurface = { tool: decision.tool, args: decision.args };
          this.appendTrace(state, { kind: 'surface', iteration: state.iteration, payload: { tool: decision.tool, args: decision.args } });
          await this.store.saveActive(state);
          const userResult = await tools.invoke(decision.tool, decision.args, this.ctx(state));
          state.pendingSurface = null;
          const summary = JSON.stringify(userResult).slice(0, 200);
          state.observations.push({ tool: decision.tool, summary });
          this.appendTrace(state, { kind: 'observation', iteration: state.iteration, payload: { summary, userResult } });
        } else if (tool.kind === 'soft-write') {
          const result = await tools.invoke(decision.tool, decision.args, this.ctx(state));
          const sw = {
            id: uuid(), tool: decision.tool, args: decision.args,
            callId: result?.callId, executedAt: Date.now(), undone: false,
            handlerResult: result,
          };
          state.softWrites.push(sw);
          this.appendTrace(state, { kind: 'soft-write', iteration: state.iteration, payload: sw });
        }
        state.iteration++;
        await this.store.saveActive(state);
        if (state.iteration >= state.budget) { await this.finish(state, 'budget-exhausted'); break; }
      } catch (e) {
        state.lastError = e.message;
        state.consecutiveErrors++;
        this.appendTrace(state, { kind: 'error', iteration: state.iteration, payload: { message: e.message } });
        if (state.consecutiveErrors >= 3) { await this.finish(state, 'consecutive-errors'); break; }
      }
    }
  }

  appendTrace(state, event) {
    state.trace.push({ ...event, ts: Date.now() });
    this.broadcast({ sessionId: state.id, kind: event.kind, payload: event.payload, iteration: event.iteration });
  }

  async finish(state, reason) {
    state.status = reason === 'consecutive-errors' ? 'errored' : 'completed';
    state.errorReason = reason === 'consecutive-errors' ? state.lastError : null;
    state.endedAt = Date.now();
    this.appendTrace(state, { kind: 'end', iteration: state.iteration, payload: { reason } });
    await this.store.persistCompleted(state);
    await this.store.clearActive();
    const entry = this.active.get(state.id);
    entry.completionResolve(state);
  }

  async handleFatal(sessionId, err) {
    const entry = this.active.get(sessionId);
    const state = entry.state;
    state.lastError = err.message;
    await this.finish(state, 'consecutive-errors');
  }
}

module.exports = SessionRunner;
```

- [ ] **Step 3: Add `uuid` if not already**

Run: `grep -q '"uuid"' package.json && echo present || npm install uuid`

- [ ] **Step 4: Run test**

Run: `npx jest src/__tests__/director/SessionRunner.test.js`
Expected: passing.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/director/SessionRunner.js src/__tests__/director/SessionRunner.test.js package.json package-lock.json
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): SessionRunner orchestrator with state machine"
```

---

### Task 13: SessionRunner failure modes

**Files:**
- Extend: `src/__tests__/director/SessionRunner.test.js`

- [ ] **Step 1: Add failure-mode tests**

```js
test('unknown tool: counted as error; 3 consecutive end session', async () => {
  jest.spyOn(Director, 'step').mockResolvedValue({ tool: 'doesNotExist', args: {}, reason: 'oops' });
  const store = stubStore();
  const broadcast = jest.fn();
  const runner = new SessionRunner({ store, director: Director, broadcast });
  const { sessionId } = await runner.start({ userId: 1, goal: 'g' });
  await runner.waitForCompletion(sessionId);
  const final = store.persistCompleted.mock.calls[0][0];
  expect(final.status).toBe('errored');
  expect(final.errorReason).toMatch(/unknown tool/);
});

test('budget exhausted forces endSession', async () => {
  let i = 0;
  jest.spyOn(Director, 'step').mockImplementation(async () => ({
    tool: 'readA', args: {}, reason: `iter ${i++}`,
  }));
  const store = stubStore();
  const runner = new SessionRunner({ store, director: Director, broadcast: jest.fn() });
  const { sessionId } = await runner.start({ userId: 1, goal: 'g' });
  await runner.waitForCompletion(sessionId);
  const final = store.persistCompleted.mock.calls[0][0];
  expect(final.iteration).toBe(12);
  expect(final.status).toBe('completed');
  expect(final.trace.at(-1).kind).toBe('end');
  expect(final.trace.at(-1).payload.reason).toBe('budget-exhausted');
});

test('user cancel resolves pending surface and ends session', async () => {
  const decisions = [{ tool: 'surfaceA', args: {}, reason: 'show' }];
  jest.spyOn(Director, 'step').mockImplementation(async () => decisions.shift() || { tool: 'endSession', args: { reason: 'done' }, reason: '' });
  const store = stubStore();
  const runner = new SessionRunner({ store, director: Director, broadcast: jest.fn() });
  const { sessionId } = await runner.start({ userId: 1, goal: 'g' });
  setTimeout(() => runner.cancel(sessionId), 30);
  await runner.waitForCompletion(sessionId);
  const final = store.persistCompleted.mock.calls[0][0];
  expect(final.status).toBe('completed');
});
```

- [ ] **Step 2: Run tests**

Run: `npx jest src/__tests__/director/SessionRunner.test.js`
Expected: all (now 4+) passing.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/director/SessionRunner.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(phase-10b-1): SessionRunner failure-mode coverage"
```

---

### Task 14: Active-session electron-store wrapper

**Files:**
- Create: `src/main/brain/director/SessionActiveStore.js`
- Test: `src/__tests__/director/SessionActiveStore.test.js`

- [ ] **Step 1: Write failing test**

```js
// Mock electron-store
jest.mock('electron-store', () => {
  return class { constructor() { this.data = {}; } get(k) { return this.data[k]; } set(k, v) { this.data[k] = v; } delete(k) { delete this.data[k]; } };
});
const SessionActiveStore = require('../../main/brain/director/SessionActiveStore');

beforeEach(() => SessionActiveStore.__reset());

test('saveActive/loadActive roundtrip', () => {
  SessionActiveStore.saveActive({ id: 's1', goal: 'g' });
  expect(SessionActiveStore.loadActive()).toEqual({ id: 's1', goal: 'g' });
});

test('clearActive removes', () => {
  SessionActiveStore.saveActive({ id: 's1', goal: 'g' });
  SessionActiveStore.clearActive();
  expect(SessionActiveStore.loadActive()).toBeUndefined();
});

test('persistCompleted delegates to AISessionStore', () => {
  const AISessionStore = require('../../main/db/AISessionStore');
  jest.spyOn(AISessionStore, 'persistCompleted').mockImplementation(s => s.id);
  SessionActiveStore.persistCompleted({ id: 'sX', trace: [] });
  expect(AISessionStore.persistCompleted).toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement**

```js
// SessionActiveStore.js
const Store = require('electron-store');
const AISessionStore = require('../../db/AISessionStore');

let store = new Store({ name: 'aiSession' });

function saveActive(state) { store.set('active', state); }
function loadActive() { return store.get('active'); }
function clearActive() { store.delete('active'); }
function persistCompleted(state) { return AISessionStore.persistCompleted(state); }
function __reset() { store = new Store({ name: 'aiSession' }); store.clear?.(); }

module.exports = { saveActive, loadActive, clearActive, persistCompleted, __reset };
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/director/SessionActiveStore.test.js`
Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add src/main/brain/director/SessionActiveStore.js src/__tests__/director/SessionActiveStore.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): SessionActiveStore for crash-recoverable snapshots"
```

---

### Task 15: IPC handlers — `sessionHandlers.js`

**Files:**
- Create: `src/main/ipc/sessionHandlers.js`
- Modify: `src/main/main.ts` — register handlers
- Test: `src/__tests__/ipc/sessionHandlers.test.js`

- [ ] **Step 1: Write failing test**

```js
const { EventEmitter } = require('events');
const ipcMain = new EventEmitter();
ipcMain.handle = function (channel, fn) { this.on(channel, (e, ...a) => e.reply(channel, fn(e, ...a))); };
jest.mock('electron', () => ({ ipcMain, BrowserWindow: { getAllWindows: () => [] } }));

const SessionRunner = require('../../main/brain/director/SessionRunner');
const Director = require('../../main/brain/director/Director');
const SessionActiveStore = require('../../main/brain/director/SessionActiveStore');
const AISessionStore = require('../../main/db/AISessionStore');

jest.mock('../../main/brain/director/SessionActiveStore', () => ({
  saveActive: jest.fn(), loadActive: jest.fn(), clearActive: jest.fn(),
  persistCompleted: jest.fn(),
}));

const { register, runnerForTest } = require('../../main/ipc/sessionHandlers');

test('session:start instantiates a runner', async () => {
  jest.spyOn(Director, 'step').mockResolvedValue({ tool: 'endSession', args: { reason: 'done' }, reason: 'over' });
  register();
  const handlers = ipcMain.handlers || {};
  expect(typeof handlers['session:start']).toBe('function');
});
```

(This is more a wiring smoke than a full test — the IPC layer is thin.)

- [ ] **Step 2: Implement**

```js
// src/main/ipc/sessionHandlers.js
const { ipcMain, BrowserWindow } = require('electron');
const SessionRunner = require('../brain/director/SessionRunner');
const Director = require('../brain/director/Director');
const SessionActiveStore = require('../brain/director/SessionActiveStore');
const AISessionStore = require('../db/AISessionStore');
const UndoRegistry = require('../brain/director/UndoRegistry');

let runner = null;

function broadcast(event) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(`session:${event.sessionId}:trace`, event);
  }
}

function getRunner() {
  if (!runner) {
    runner = new SessionRunner({ store: SessionActiveStore, director: Director, broadcast });
  }
  return runner;
}

function register() {
  ipcMain.handle('session:start', async (_e, { userId, questId, goal }) => {
    return getRunner().start({ userId, questId, goal });
  });

  ipcMain.handle('session:userResult', async (_e, { sessionId, result }) => {
    return getRunner().userResult(sessionId, result);
  });

  ipcMain.handle('session:cancel', async (_e, { sessionId }) => {
    return getRunner().cancel(sessionId);
  });

  ipcMain.handle('session:get', async (_e, { sessionId }) => {
    const r = getRunner();
    const entry = r.active.get(sessionId);
    return entry ? entry.state : null;
  });

  ipcMain.handle('session:loadActive', async () => SessionActiveStore.loadActive());

  ipcMain.handle('session:undoSoftWrite', async (_e, { sessionId, softWriteId }) => {
    const r = getRunner();
    const entry = r.active.get(sessionId);
    const sw = entry?.state.softWrites.find(s => s.id === softWriteId && !s.undone);
    if (!sw) return { undone: false, reason: 'not-found' };
    const result = await UndoRegistry.run(sw.tool, { ...sw.args, ...sw.handlerResult });
    if (result.undone) sw.undone = true;
    await SessionActiveStore.saveActive(entry.state);
    return result;
  });

  ipcMain.handle('session:listCompleted', async (_e, { userId, limit }) =>
    AISessionStore.listByUser(userId, limit)
  );

  ipcMain.handle('session:getTrace', async (_e, { sessionId }) =>
    AISessionStore.getTrace(sessionId)
  );
}

module.exports = { register, runnerForTest: () => runner };
```

- [ ] **Step 3: Wire into `src/main/main.ts`**

Near other handler-registration calls (search for `register(` near top of `main.ts` or wherever `callLedgerHandlers` is registered):

```ts
const sessionHandlers = require('./ipc/sessionHandlers');
sessionHandlers.register();
```

- [ ] **Step 4: Run test**

Run: `npx jest src/__tests__/ipc/sessionHandlers.test.js`
Expected: passing.

- [ ] **Step 5: Smoke**

Run: `npm run test:smoke`
Expected: boot succeeds, no new error patterns.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/sessionHandlers.js src/main/main.ts src/__tests__/ipc/sessionHandlers.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): sessionHandlers IPC + main.ts registration"
```

---

### Task 16: Renderer client — `sessionApi.js`

**Files:**
- Create: `src/renderer/api/sessionApi.js`
- Test: `src/__tests__/renderer/sessionApi.test.js`

- [ ] **Step 1: Write failing test**

```js
const fakeInvoke = jest.fn().mockResolvedValue({ sessionId: 'sess-1', traceId: 'tr-1' });
const fakeOn = jest.fn();
jest.mock('electron', () => ({ ipcRenderer: { invoke: fakeInvoke, on: fakeOn, removeListener: jest.fn() } }));
const sessionApi = require('../../renderer/api/sessionApi').default;

test('start invokes session:start', async () => {
  const r = await sessionApi.start({ userId: 1, goal: 'g' });
  expect(r.sessionId).toBe('sess-1');
  expect(fakeInvoke).toHaveBeenCalledWith('session:start', { userId: 1, goal: 'g' });
});

test('subscribeTrace registers listener for session-scoped channel', () => {
  const handler = jest.fn();
  sessionApi.subscribeTrace('sess-1', handler);
  expect(fakeOn).toHaveBeenCalledWith('session:sess-1:trace', expect.any(Function));
});
```

- [ ] **Step 2: Implement**

```js
// src/renderer/api/sessionApi.js
const { ipcRenderer } = window.require ? window.require('electron') : require('electron');

const sessionApi = {
  start: ({ userId, questId, goal }) => ipcRenderer.invoke('session:start', { userId, questId, goal }),
  userResult: (sessionId, result) => ipcRenderer.invoke('session:userResult', { sessionId, result }),
  cancel: (sessionId) => ipcRenderer.invoke('session:cancel', { sessionId }),
  get: (sessionId) => ipcRenderer.invoke('session:get', { sessionId }),
  loadActive: () => ipcRenderer.invoke('session:loadActive'),
  undoSoftWrite: (sessionId, softWriteId) => ipcRenderer.invoke('session:undoSoftWrite', { sessionId, softWriteId }),
  listCompleted: (userId, limit = 20) => ipcRenderer.invoke('session:listCompleted', { userId, limit }),
  getTrace: (sessionId) => ipcRenderer.invoke('session:getTrace', { sessionId }),
  subscribeTrace: (sessionId, handler) => {
    const fn = (_e, event) => handler(event);
    ipcRenderer.on(`session:${sessionId}:trace`, fn);
    return () => ipcRenderer.removeListener(`session:${sessionId}:trace`, fn);
  },
};

export default sessionApi;
```

- [ ] **Step 3: Run test**

Run: `npx jest src/__tests__/renderer/sessionApi.test.js`
Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/api/sessionApi.js src/__tests__/renderer/sessionApi.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-1): sessionApi renderer client"
```

---

### Task 17: Integration test — full happy-path session

**Files:**
- Create: `src/__tests__/integration/sessionRunnerHappyPath.test.js`

- [ ] **Step 1: Write test**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});

const dbManager = require('../../main/db/dbManager');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  dbManager.__setDb(db);
  return db;
}

const tools = require('../../main/brain/spine/tools');
const Director = require('../../main/brain/director/Director');
const SessionRunner = require('../../main/brain/director/SessionRunner');
const AISessionStore = require('../../main/db/AISessionStore');

require('../../main/brain/director/tools/endSession');

test('full session: 1 read + 1 surface + 1 soft-write + endSession persists to ai_sessions', async () => {
  freshDb();

  tools.register('fakeRead', { kind: 'read', description: '', argsSchema: {} });
  tools.registerHandler('fakeRead', async () => ({ data: 'read-result' }));
  tools.register('fakeSurface', { kind: 'surface', description: '', argsSchema: {} });
  tools.registerHandler('fakeSurface', async (a, ctx) => ctx.awaitUserResult({ tool: 'fakeSurface', args: a }));
  tools.register('fakeWrite', { kind: 'soft-write', description: '', argsSchema: {} });
  tools.registerHandler('fakeWrite', async () => ({ callId: 1 }));

  const decisions = [
    { tool: 'fakeRead', args: {}, reason: 'read' },
    { tool: 'fakeSurface', args: { x: 1 }, reason: 'surface' },
    { tool: 'fakeWrite', args: {}, reason: 'write' },
    { tool: 'endSession', args: { reason: 'done' }, reason: 'end' },
  ];
  jest.spyOn(Director, 'step').mockImplementation(async () => decisions.shift());

  const persisted = jest.fn(state => AISessionStore.persistCompleted(state));
  const store = {
    saveActive: jest.fn(), loadActive: jest.fn(), clearActive: jest.fn(),
    persistCompleted: persisted,
  };
  const runner = new SessionRunner({ store, director: Director, broadcast: jest.fn() });
  const { sessionId } = await runner.start({ userId: 1, goal: 'Integration test' });

  setTimeout(() => runner.userResult(sessionId, { rating: 'good' }), 40);
  await runner.waitForCompletion(sessionId);

  expect(persisted).toHaveBeenCalled();
  const list = AISessionStore.listByUser(1);
  expect(list).toHaveLength(1);
  expect(list[0].goal).toBe('Integration test');
  const trace = AISessionStore.getTrace(sessionId);
  expect(trace.length).toBeGreaterThanOrEqual(6);  // thought+tool+observation+surface+soft-write+end at minimum
});
```

- [ ] **Step 2: Run**

Run: `npx jest src/__tests__/integration/sessionRunnerHappyPath.test.js`
Expected: passing.

- [ ] **Step 3: Run full regression**

Run: `npx jest`
Expected: full suite green.

- [ ] **Step 4: Smoke**

Run: `npm run test:smoke`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/integration/sessionRunnerHappyPath.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(phase-10b-1): integration test for full session happy path + persistence"
```

---

## Success criteria (Plan 10b-1)

- All 17 tasks committed.
- New tests added (per file): AISessionStore (2), sessionToolKinds (3), sessionReadTools (3), UndoRegistry (3), sessionSoftWriteTools (5+), sessionSurfaceTools (2), sessionEndSession (2), studySessionConfig (3), SessionRunner (4+), SessionActiveStore (3), sessionHandlers (1+), sessionApi (2), integration (1). Total ≥ 33 new tests.
- Existing Phase 9–10a tests unchanged-and-passing (only intent-count test bumped).
- `npm run test:smoke` green.
- `npx jest` 100% green.
- `db.sql` parses; ai_sessions + ai_session_trace tables exist.
- Director has `step()` and `run()` exports; pull-suggestion config still works via `run()`.
- Tool registry tracks `kind`; `descriptors()` returns kind for every tool.
- 13 director tools registered: 5 read, 4 surface, 3 soft-write, 1 control.
- SessionRunner handles: read dispatch, surface await/resume, soft-write execute, control termination, budget exhaustion, unknown tool, 3-error fatal, user cancel.
- IPC channels wired and registered in `main.ts`.
- sessionApi renderer client exists.

Plan 10b-2 (UI) starts from this foundation.
