# Phase 10 — Director Mode v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Ship the Director runtime + 3 read-only tools + Pull-Suggestion Director config + trace surfacing in RationaleCard. Migrate `synthesizePullSuggestion` to Director with deterministic fallback preserved.

**Spec:** [docs/superpowers/specs/2026-06-17-phase-10-director-mode-design.md](../specs/2026-06-17-phase-10-director-mode-design.md)
**Predecessors:** Plans 9a–9e.

---

## File Structure

**Created:**
- `src/main/brain/director/Director.js`
- `src/main/brain/director/configs/pullSuggestion.js`
- `src/main/brain/director/configs/deterministicPullFallback.js`
- `src/main/brain/director/tools/topUnmasteredConcepts.js`
- `src/main/brain/director/tools/recentEpisodeSummary.js`
- `src/main/brain/director/tools/currentQuestProgress.js`
- `src/__tests__/director/Director.test.js`
- `src/__tests__/director/tools.test.js`

**Modified:**
- `db.sql` — add `trace_id` column + index
- `src/main/db/CallLedgerStore.js` — accept `trace_id` in `record`; add `tracesByCallId(callId)`
- `src/main/brain/spine/brainCall.js` — propagate `options.traceId` to ledger
- `src/main/brain/spine/tools.js` — add `registerHandler`, wire `invoke`
- `src/main/brain/spine/seedIntents.js` — register `director-pull-suggestion` intent
- `src/main/brain/LearningBrainAgent.js` — migrate `synthesizePullSuggestion` to Director
- `src/main/ipc/callLedgerHandlers.js` — add `callLedger:tracesByCallId` channel
- `src/renderer/api/callLedgerApi.js` — add `tracesByCallId`
- `src/renderer/components/brainShell/RationaleCard.jsx` — render trace if present
- `src/__tests__/spine/CallLedgerStore.test.js` — new tests for trace_id + tracesByCallId
- `src/__tests__/spine/brainCall.test.js` — new test for traceId propagation
- `src/__tests__/spine/tools.test.js` — new tests for registerHandler / invoke
- `src/__tests__/renderer/RationaleCard.test.jsx` — new test for trace rendering

---

## Task 1: `trace_id` schema migration

**Files:** `db.sql`

### Edit

Append to the `brain_call_ledger` block — find the existing `CREATE TABLE` block in `db.sql` (added Plan 9a) and add the column. Since the table uses `CREATE TABLE IF NOT EXISTS`, the simplest migration is:

1. Add the column to the `CREATE TABLE IF NOT EXISTS "brain_call_ledger"` body, between `"trigger_id"` and `"output_summary"`:
   ```sql
   "trace_id" TEXT,
   ```
2. Append a new index after the existing indexes on this table:
   ```sql
   CREATE INDEX IF NOT EXISTS "idx_brain_call_ledger_trace" ON brain_call_ledger("trace_id");
   ```

For existing on-disk DBs that already have the table, manually run an `ALTER TABLE` once during `DatabaseInitializer.initLearningPointTable`-style migrations — but for fresh installs the new column is in the create. To keep this task scoped, add only the `CREATE TABLE` + `CREATE INDEX` edits. For dev environments rebuilding the DB from `db.sql`, this Just Works.

### Verify

```bash
node -e "const Database=require('better-sqlite3'); const fs=require('fs'); const db=new Database(':memory:'); const sql=fs.readFileSync('db.sql','utf8').split('\n').filter(l=>!l.includes('\"sqlite_sequence\"')).join('\n'); db.exec(sql); const cols=db.prepare(\"PRAGMA table_info(brain_call_ledger)\").all().map(r=>r.name); console.log(cols.includes('trace_id') ? 'OK' : 'MISSING')"
```

Expected: `OK`.

### Commit

```bash
git add db.sql
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): add trace_id column + index to brain_call_ledger"
```

---

## Task 2: `CallLedgerStore` — accept + read trace_id

**Files:** `src/main/db/CallLedgerStore.js`, `src/__tests__/spine/CallLedgerStore.test.js`

### Step 1: Add failing tests

Append to `src/__tests__/spine/CallLedgerStore.test.js`:

```js
describe('CallLedgerStore trace_id', () => {
  test('record persists trace_id when provided', () => {
    const id = CallLedgerStore.record({
      intent: 'director-pull-suggestion',
      provider: 'deepseek-v3', ts: 1000, cache_hit: false,
      trace_id: 'trace_abc',
    });
    const row = testDb.prepare('SELECT trace_id FROM brain_call_ledger WHERE id = ?').get(id);
    expect(row.trace_id).toBe('trace_abc');
  });

  test('tracesByCallId returns ordered rows sharing trace_id', () => {
    const id1 = CallLedgerStore.record({ intent: 'x', provider: 'p', ts: 100, cache_hit: false, trace_id: 't' });
    const id2 = CallLedgerStore.record({ intent: 'x', provider: 'p', ts: 200, cache_hit: false, trace_id: 't' });
    const id3 = CallLedgerStore.record({ intent: 'x', provider: 'p', ts: 300, cache_hit: false, trace_id: 'other' });
    const trace = CallLedgerStore.tracesByCallId(id2);
    expect(trace.map((r) => r.id)).toEqual([id1, id2]);
    expect(trace.every((r) => r.trace_id === 't')).toBe(true);
  });

  test('tracesByCallId returns just the row when trace_id is null', () => {
    const id = CallLedgerStore.record({ intent: 'x', provider: 'p', ts: 1, cache_hit: false });
    const trace = CallLedgerStore.tracesByCallId(id);
    expect(trace.length).toBe(1);
    expect(trace[0].id).toBe(id);
  });
});
```

### Step 2: Implement

In `src/main/db/CallLedgerStore.js`:

1. Add `trace_id` to the INSERT in `record(...)`. Find the INSERT statement and add `trace_id` to both the column list and the VALUES clause; bind `trace_id: row.trace_id ?? null` in the run() call.
2. Add a new function:

```js
function tracesByCallId(callId) {
  const db = DBManager.getDb();
  const row = db.prepare('SELECT trace_id FROM brain_call_ledger WHERE id = ?').get(callId);
  if (!row) return [];
  if (!row.trace_id) {
    const single = db.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(callId);
    return single ? [hydrate(single)] : [];
  }
  const rows = db.prepare(
    'SELECT * FROM brain_call_ledger WHERE trace_id = ? ORDER BY ts ASC',
  ).all(row.trace_id);
  return rows.map(hydrate);
}
```

Add `tracesByCallId` to the `module.exports` object.

### Step 3: Run + commit

```bash
npx jest src/__tests__/spine/CallLedgerStore.test.js
git add src/main/db/CallLedgerStore.js src/__tests__/spine/CallLedgerStore.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): CallLedgerStore.tracesByCallId + trace_id persistence"
```

---

## Task 3: `brainCall` propagates `options.traceId`

**Files:** `src/main/brain/spine/brainCall.js`, `src/__tests__/spine/brainCall.test.js`

### Step 1: Add failing test

Append to `src/__tests__/spine/brainCall.test.js`:

```js
  test('options.traceId flows into the ledger row', async () => {
    const { callId } = await brainCall('test-spine-intent', 'with trace', {
      userId: 1, traceId: 'trace_xyz',
    });
    const row = testDb.prepare('SELECT trace_id FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.trace_id).toBe('trace_xyz');
  });
```

### Step 2: Implement

In `src/main/brain/spine/brainCall.js`, find the `CallLedgerStore.record({...})` call. Add `trace_id: options.traceId || null` to the object. Also handle the cache-hit `recordCacheHit` path: extend the call signature to accept a `traceId` argument.

In `CallLedgerStore.recordCacheHit({ intent, cacheKey, triggerId, traceId })`: extend the destructure and persist `trace_id` on the new cache-hit row. Update the INSERT in `recordCacheHit` to include `trace_id`.

### Step 3: Run + commit

```bash
npx jest src/__tests__/spine/brainCall.test.js
git add src/main/brain/spine/brainCall.js src/main/db/CallLedgerStore.js src/__tests__/spine/brainCall.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): brainCall propagates options.traceId to ledger"
```

---

## Task 4: Tool Registry — `registerHandler` + working `invoke`

**Files:** `src/main/brain/spine/tools.js`, `src/__tests__/spine/tools.test.js`

### Step 1: Update tests

Replace the existing "Phase 9 dormant" test for `invoke` (which asserts it throws "not yet wired") with new tests:

```js
describe('Tool registry handlers (Phase 10)', () => {
  beforeEach(() => {
    // Clear any prior handler registrations between tests.
    tools._clearHandlers();
  });

  test('invoke throws on unknown tool', () => {
    expect(() => tools.invoke('doesNotExist', {})).toThrow(/unknown tool/);
  });

  test('invoke throws when tool has no handler', () => {
    expect(() => tools.invoke('navigate', { view: 'reading' })).toThrow(/no handler/);
  });

  test('registerHandler + invoke runs the handler', async () => {
    tools.registerHandler('navigate', async ({ view }) => `navigated to ${view}`);
    const result = await tools.invoke('navigate', { view: 'reading' });
    expect(result).toBe('navigated to reading');
  });
});
```

Keep the "all 5 spec tools are declared with JSON schemas" test from Phase 9.

### Step 2: Implement

In `src/main/brain/spine/tools.js`, add the handler registry alongside `TOOLS`:

```js
const HANDLERS = {};

function registerHandler(name, fn) {
  if (!TOOLS[name]) {
    throw new Error(`registerHandler: tool '${name}' is not registered`);
  }
  HANDLERS[name] = fn;
}

function _clearHandlers() { for (const k of Object.keys(HANDLERS)) delete HANDLERS[k]; }
```

Replace the existing `invoke`:

```js
async function invoke(name, args) {
  if (!TOOLS[name]) throw new Error(`unknown tool: ${name}`);
  const handler = HANDLERS[name];
  if (!handler) throw new Error(`tool ${name} has no handler — Phase 10 must register one`);
  return handler(args || {});
}
```

Export `registerHandler` and `_clearHandlers` alongside the others.

### Step 3: Run + commit

```bash
npx jest src/__tests__/spine/tools.test.js
git add src/main/brain/spine/tools.js src/__tests__/spine/tools.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): wire tools.invoke via registerHandler"
```

---

## Task 5: New tool — `topUnmasteredConcepts`

**Files:** `src/main/brain/director/tools/topUnmasteredConcepts.js`

### Implement

```js
// src/main/brain/director/tools/topUnmasteredConcepts.js
const tools = require('../../spine/tools');
const { topNByMastery } = require('../../../db/LearningPointManager');

tools.register('topUnmasteredConcepts', {
  description: 'Return the top concepts the learner has NOT yet mastered (mastery_level < 60).',
  schema: {
    properties: { limit: { type: 'number' } },
    required: [],
  },
});

tools.registerHandler('topUnmasteredConcepts', async ({ limit = 5 } = {}) => {
  const rows = topNByMastery(1, Math.max(limit, 15));
  const weak = (rows || [])
    .filter((r) => (r.mastery_level || 0) < 60)
    .slice(0, limit)
    .map((r) => r.concept);
  return { concepts: weak };
});
```

### Verify import

```bash
node -e "require('./src/main/brain/director/tools/topUnmasteredConcepts'); const t=require('./src/main/brain/spine/tools'); console.log(t.list().includes('topUnmasteredConcepts'))"
```

Expected: `true`.

### Commit

```bash
git add src/main/brain/director/tools/topUnmasteredConcepts.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): topUnmasteredConcepts tool"
```

---

## Task 6: New tool — `recentEpisodeSummary`

**Files:** `src/main/brain/director/tools/recentEpisodeSummary.js`

### Implement

```js
// src/main/brain/director/tools/recentEpisodeSummary.js
const tools = require('../../spine/tools');
const { getLearningBrain } = require('../..');

tools.register('recentEpisodeSummary', {
  description: 'One-paragraph summary of the learner\'s recent reading activity in the past N days.',
  schema: {
    properties: { days: { type: 'number' } },
    required: [],
  },
});

tools.registerHandler('recentEpisodeSummary', async ({ days = 7 } = {}) => {
  const brain = getLearningBrain();
  if (!brain || !brain.episodeCollector) return { summary: 'No brain initialized.' };
  const eps = await brain.episodeCollector.getRecentEpisodes(200);
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const recent = (eps || []).filter((e) => {
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : 0;
    return ts >= cutoff;
  });
  if (recent.length === 0) return { summary: `No episodes in the past ${days} days.` };
  const byType = {};
  for (const e of recent) { byType[e.eventType] = (byType[e.eventType] || 0) + 1; }
  const parts = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, n]) => `${n}× ${t}`);
  return { summary: `In the past ${days} days: ${parts.join(', ')}.`, count: recent.length };
});
```

### Commit

```bash
git add src/main/brain/director/tools/recentEpisodeSummary.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): recentEpisodeSummary tool"
```

---

## Task 7: New tool — `currentQuestProgress`

**Files:** `src/main/brain/director/tools/currentQuestProgress.js`

### Implement

```js
// src/main/brain/director/tools/currentQuestProgress.js
const tools = require('../../spine/tools');
const QuestService = require('../../../utils/QuestService');
const Store = require('electron-store');

tools.register('currentQuestProgress', {
  description: 'Return the active Quest with its goal, books, and days active.',
  schema: { properties: {}, required: [] },
});

let questService = null;
function getQuestService() {
  if (!questService) questService = new QuestService(new Store());
  return questService;
}

tools.registerHandler('currentQuestProgress', async () => {
  const svc = getQuestService();
  const actives = svc.list({ userId: 1, status: 'active' });
  if (!actives.length) return { active: false };
  const q = actives[0];
  const daysActive = q.createdAt
    ? Math.floor((Date.now() - new Date(q.createdAt).getTime()) / (24 * 3600 * 1000))
    : 0;
  return {
    active: true,
    name: q.name,
    goal: q.goal,
    bookIds: q.bookIds || [],
    createdAt: q.createdAt,
    daysActive,
  };
});
```

### Commit

```bash
git add src/main/brain/director/tools/currentQuestProgress.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): currentQuestProgress tool"
```

---

## Task 8: Tools — integration test

**Files:** `src/__tests__/director/tools.test.js`

### Test

```js
// src/__tests__/director/tools.test.js
const mockTopNByMastery = jest.fn();
jest.mock('../../main/db/LearningPointManager', () => ({
  topNByMastery: mockTopNByMastery,
}));

const mockGetRecentEpisodes = jest.fn();
jest.mock('../../main/brain', () => ({
  getLearningBrain: () => ({
    episodeCollector: { getRecentEpisodes: mockGetRecentEpisodes },
  }),
}));

jest.mock('../../main/utils/QuestService', () => {
  return jest.fn().mockImplementation(() => ({ list: jest.fn().mockReturnValue([]) }));
});
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({ get: () => [], set: () => {} }));
});

const tools = require('../../main/brain/spine/tools');
require('../../main/brain/director/tools/topUnmasteredConcepts');
require('../../main/brain/director/tools/recentEpisodeSummary');
require('../../main/brain/director/tools/currentQuestProgress');

describe('director tools', () => {
  test('topUnmasteredConcepts returns concepts under 60 mastery', async () => {
    mockTopNByMastery.mockReturnValue([
      { concept: 'duration', mastery_level: 40 },
      { concept: 'convexity', mastery_level: 75 },
      { concept: 'yield-curve', mastery_level: 30 },
    ]);
    const r = await tools.invoke('topUnmasteredConcepts', { limit: 5 });
    expect(r.concepts).toEqual(['duration', 'yield-curve']);
  });

  test('recentEpisodeSummary returns count + summary', async () => {
    const now = Date.now();
    mockGetRecentEpisodes.mockResolvedValue([
      { eventType: 'PARAGRAPH_DWELL', timestamp: new Date(now - 1 * 86400e3).toISOString() },
      { eventType: 'BACKTRACK', timestamp: new Date(now - 2 * 86400e3).toISOString() },
      { eventType: 'PARAGRAPH_DWELL', timestamp: new Date(now - 30 * 86400e3).toISOString() },
    ]);
    const r = await tools.invoke('recentEpisodeSummary', { days: 7 });
    expect(r.count).toBe(2);
    expect(r.summary).toMatch(/PARAGRAPH_DWELL/);
  });

  test('currentQuestProgress with no active quest', async () => {
    const r = await tools.invoke('currentQuestProgress', {});
    expect(r).toEqual({ active: false });
  });
});
```

### Run + commit

```bash
npx jest src/__tests__/director/tools.test.js
git add src/__tests__/director/tools.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(director): integration tests for 3 read-only tools"
```

---

## Task 9: Register `director-pull-suggestion` intent

**Files:** `src/main/brain/spine/seedIntents.js`

### Edit

Append in the seedIntents.js after the existing 11 intents:

```js
intents.register('director-pull-suggestion', {
  label: 'Director — pull suggestion ReAct loop',
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery', 'acceptDismissPatterns'],
  costCeilingTokens: 1500,
  cachePolicy: 'content-hash',
});
```

### Verify

```bash
node -e "const i=require('./src/main/brain/spine/intents.js'); console.log(i.list().includes('director-pull-suggestion'))"
```

Expected: `true`.

### Commit

```bash
git add src/main/brain/spine/seedIntents.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): register director-pull-suggestion intent"
```

---

## Task 10: Deterministic Pull fallback (extract from LearningBrainAgent)

**Files:** `src/main/brain/director/configs/deterministicPullFallback.js`

### Step 1: Locate the current fallback

In `src/main/brain/LearningBrainAgent.js`, `synthesizePullSuggestion` defines an inner `deterministicFallback` function. Find it.

### Step 2: Extract to its own module

```js
// src/main/brain/director/configs/deterministicPullFallback.js
/**
 * Deterministic fallback for the Pull-Suggestion Director.
 * Returns { title, body, navigate, source: 'deterministic-fallback' }.
 */
module.exports = function deterministicPullFallback() {
  return {
    title: 'Open a book',
    body: 'Pick a book from your shelf and dip into a chapter.',
    navigate: 'bookshelf',
    source: 'deterministic-fallback',
  };
};
```

Adapt to whatever the existing fallback returns (may have additional logic — preserve it). If the existing fallback reads from `this.aiProvider` or `this.store`, expose them via parameters (e.g. `deterministicPullFallback({ store })`) — for now keep it parameterless if the existing logic permits.

### Commit

```bash
git add src/main/brain/director/configs/deterministicPullFallback.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): extract deterministic pull fallback"
```

---

## Task 11: Director runtime (TDD)

**Files:** `src/main/brain/director/Director.js`, `src/__tests__/director/Director.test.js`

### Step 1: Tests

```js
// src/__tests__/director/Director.test.js
const mockBrainCall = jest.fn();
jest.mock('../../main/brain/spine/brainCall', () => (...args) => mockBrainCall(...args));

const tools = require('../../main/brain/spine/tools');
const Director = require('../../main/brain/director/Director');

// Minimal config for tests
function makeConfig(overrides = {}) {
  return {
    intent: 'director-pull-suggestion',
    contextSlices: [],
    systemPrompt: 'Decide one action.',
    tools: ['topUnmasteredConcepts'],
    outputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, body: { type: 'string' } },
      required: ['title', 'body'],
    },
    budget: 3,
    deterministicFallback: () => ({ title: 'fallback', body: 'used' }),
    ...overrides,
  };
}

beforeEach(() => {
  mockBrainCall.mockReset();
  tools._clearHandlers();
  tools.registerHandler('topUnmasteredConcepts', async () => ({ concepts: ['x'] }));
});

describe('Director.run', () => {
  test('happy path: tool then answer', async () => {
    mockBrainCall
      .mockResolvedValueOnce({ output: { action: 'tool', tool: 'topUnmasteredConcepts', args: {} }, callId: 1 })
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { title: 't', body: 'b' } }, callId: 2 });

    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(false);
    expect(result.output).toEqual({ title: 't', body: 'b' });
    expect(result.callIds).toEqual([1, 2]);
    expect(result.traceId).toBeTruthy();
  });

  test('budget exhausted falls through to deterministic', async () => {
    mockBrainCall.mockResolvedValue({
      output: { action: 'tool', tool: 'topUnmasteredConcepts', args: {} },
      callId: 1,
    });
    const result = await Director.run({ config: makeConfig({ budget: 2 }), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(true);
    expect(result.output).toEqual({ title: 'fallback', body: 'used' });
  });

  test('unknown tool recovers and continues', async () => {
    mockBrainCall
      .mockResolvedValueOnce({ output: { action: 'tool', tool: 'doesNotExist', args: {} }, callId: 1 })
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { title: 't', body: 'b' } }, callId: 2 });
    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(false);
    expect(result.output).toEqual({ title: 't', body: 'b' });
  });

  test('malformed answer recovers', async () => {
    mockBrainCall
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { wrong: 'shape' } }, callId: 1 })
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { title: 't', body: 'b' } }, callId: 2 });
    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(false);
  });

  test('handler throw recovers', async () => {
    tools.registerHandler('topUnmasteredConcepts', async () => { throw new Error('boom'); });
    mockBrainCall
      .mockResolvedValueOnce({ output: { action: 'tool', tool: 'topUnmasteredConcepts', args: {} }, callId: 1 })
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { title: 't', body: 'b' } }, callId: 2 });
    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(false);
  });

  test('brainCall throwing falls through to deterministic', async () => {
    mockBrainCall.mockRejectedValue(new Error('provider gone'));
    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(true);
  });
});
```

### Step 2: Implement

```js
// src/main/brain/director/Director.js
const brainCall = require('../spine/brainCall');
const tools = require('../spine/tools');
const crypto = require('crypto');

const REACT_STEP_SCHEMA = {
  type: 'object',
  properties: {
    action:    { type: 'string', enum: ['tool', 'answer'] },
    tool:      { type: 'string' },
    args:      { type: 'object' },
    answer:    { type: 'object' },
    reasoning: { type: 'string' },
  },
  required: ['action'],
};

function generateTraceId() {
  return `tr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function validateAnswer(answer, outputSchema) {
  if (!answer || typeof answer !== 'object') return false;
  const required = outputSchema?.required || [];
  for (const k of required) {
    if (!(k in answer)) return false;
  }
  return true;
}

function buildIterationPrompt(systemPrompt, input, history, availableTools) {
  const toolDescriptions = (availableTools || [])
    .map((name) => {
      const d = tools.describe(name);
      return d ? `- ${name}: ${d.description || 'no description'}` : null;
    })
    .filter(Boolean)
    .join('\n');
  const historyBlock = history.length === 0 ? '(no iterations yet)' : history
    .map((h, i) => `Step ${i + 1}: tool=${h.tool} args=${JSON.stringify(h.args || {})} result=${JSON.stringify(h.result)}`)
    .join('\n');
  return [
    systemPrompt,
    '',
    'Available tools:',
    toolDescriptions || '(none)',
    '',
    'Iteration history:',
    historyBlock,
    '',
    `Task: ${input}`,
    '',
    'Return a JSON object matching the ReAct step schema: { action: "tool"|"answer", ... }',
  ].join('\n');
}

async function run({ config, input, userId = 1, contextOverrides = {} }) {
  const traceId = generateTraceId();
  const history = [];
  const callIds = [];

  try {
    for (let iter = 0; iter < config.budget; iter++) {
      const prompt = buildIterationPrompt(config.systemPrompt, input, history, config.tools);
      let stepResult;
      try {
        stepResult = await brainCall(config.intent, prompt, {
          userId,
          traceId,
          schema: REACT_STEP_SCHEMA,
          contextOverrides,
        });
      } catch (e) {
        console.warn(`[Director] brainCall failed iter=${iter}:`, e?.message || e);
        return runFallback(config, traceId, callIds);
      }
      callIds.push(stepResult.callId);
      const step = stepResult.output || {};

      if (step.action === 'tool') {
        if (!config.tools.includes(step.tool)) {
          history.push({ tool: step.tool, args: step.args || {}, result: { error: 'tool not in director scope' } });
          continue;
        }
        try {
          const result = await tools.invoke(step.tool, step.args || {});
          history.push({ tool: step.tool, args: step.args || {}, result });
        } catch (e) {
          history.push({ tool: step.tool, args: step.args || {}, result: { error: e?.message || String(e) } });
        }
        continue;
      }

      if (step.action === 'answer') {
        if (validateAnswer(step.answer, config.outputSchema)) {
          return { output: step.answer, traceId, callIds, usedFallback: false };
        }
        history.push({ tool: null, args: null, result: { error: 'malformed final answer' } });
        continue;
      }

      // Unknown action — treat as a malformed step.
      history.push({ tool: null, args: null, result: { error: `unknown action: ${step.action}` } });
    }
    return runFallback(config, traceId, callIds);
  } catch (e) {
    console.warn('[Director] unexpected:', e?.message || e);
    return runFallback(config, traceId, callIds);
  }
}

function runFallback(config, traceId, callIds) {
  return {
    output: config.deterministicFallback(),
    traceId,
    callIds,
    usedFallback: true,
  };
}

module.exports = { run };
```

### Step 3: Run + commit

```bash
npx jest src/__tests__/director/Director.test.js
git add src/main/brain/director/Director.js src/__tests__/director/Director.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): Director runtime with ReAct loop + 6 failure-mode tests"
```

---

## Task 12: Pull-Suggestion config

**Files:** `src/main/brain/director/configs/pullSuggestion.js`

### Implement

```js
// src/main/brain/director/configs/pullSuggestion.js
const deterministicPullFallback = require('./deterministicPullFallback');

module.exports = {
  intent: 'director-pull-suggestion',
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery', 'acceptDismissPatterns'],
  systemPrompt: `
You are deciding ONE concrete next action for the learner right now. Be specific and brief.

You have a budget of 3 iterations total. Each iteration you must return EITHER:
- { action: "tool", tool: "<name>", args: { ... }, reasoning?: "..." } to gather more context
- { action: "answer", answer: { title, body, navigate? }, reasoning?: "..." } to conclude

Prefer answering directly if the injected Learner Context is sufficient. Only use tools when the
context truly lacks the signal you need.

Final answer schema:
- title:    string, ≤ 80 chars, imperative ("Review your weak yield-curve concept")
- body:     string, ≤ 200 chars, one-sentence why
- navigate: optional string, route path (e.g. "reading/3", "vocabulary", "knowledge") or omitted
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
  deterministicFallback: deterministicPullFallback,
};
```

### Commit

```bash
git add src/main/brain/director/configs/pullSuggestion.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): pull-suggestion Director config"
```

---

## Task 13: Migrate `synthesizePullSuggestion` to Director

**Files:** `src/main/brain/LearningBrainAgent.js`

### Step 1: Update tests if any exist

```bash
grep -rn "synthesizePullSuggestion\|synthesize-pull-suggestion" src/__tests__
```

If tests mock the old structured-output path, update them to mock `'../../main/brain/director/Director'` instead:

```js
jest.mock('../../main/brain/director/Director', () => ({
  run: jest.fn().mockResolvedValue({
    output: { title: 'Try this', body: 'Read chapter 3', navigate: 'reading/1' },
    traceId: 'tr_test',
    callIds: [42],
    usedFallback: false,
  }),
}));
```

### Step 2: Replace the method body

In `LearningBrainAgent.js`, replace the existing `synthesizePullSuggestion` (which was migrated to `brainCall` in Plan 9c-5) with:

```js
async synthesizePullSuggestion() {
  if (!this.aiProvider) {
    const deterministicFallback = require('./director/configs/deterministicPullFallback');
    return deterministicFallback();
  }
  const Director = require('./director/Director');
  const pullConfig = require('./director/configs/pullSuggestion');
  try {
    const result = await Director.run({
      config: pullConfig,
      input: 'Decide one concrete next action for the learner.',
      userId: 1,
    });
    return {
      ...result.output,
      source: result.usedFallback ? 'deterministic-fallback' : 'llm',
    };
  } catch (e) {
    console.warn('[LearningBrainAgent] Director crash, deterministic fallback:', e?.message || e);
    const deterministicFallback = require('./director/configs/deterministicPullFallback');
    return deterministicFallback();
  }
}
```

Also remove the now-unused `SUGGESTION_SCHEMA` constant and any imports that were only for the prior implementation.

### Step 3: Run tests

```bash
npx jest src/__tests__/brain/synthesizePullSuggestion
```

Expected: pass (after mock updates).

### Step 4: Commit

```bash
git add src/main/brain/LearningBrainAgent.js src/__tests__/brain/
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "refactor(brain): synthesizePullSuggestion uses Director"
```

---

## Task 14: IPC handler + renderer API for trace lookup

**Files:** `src/main/ipc/callLedgerHandlers.js`, `src/renderer/api/callLedgerApi.js`

### Step 1: Main handler

In `src/main/ipc/callLedgerHandlers.js`, add inside the `register()` function:

```js
ipcMain.handle('callLedger:tracesByCallId', async (_e, callId) => {
  return CallLedgerStore.tracesByCallId(callId);
});
```

### Step 2: Renderer API

In `src/renderer/api/callLedgerApi.js`, add to the exported object:

```js
tracesByCallId(callId) {
  return ipcRenderer.invoke('callLedger:tracesByCallId', callId);
},
```

### Step 3: Commit

```bash
git add src/main/ipc/callLedgerHandlers.js src/renderer/api/callLedgerApi.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): IPC + renderer API for tracesByCallId"
```

---

## Task 15: RationaleCard renders Director trace

**Files:** `src/renderer/components/brainShell/RationaleCard.jsx`, `src/__tests__/renderer/RationaleCard.test.jsx`

### Step 1: Update the component

Open `RationaleCard.jsx`. After fetching `row` via `callLedgerApi.rationaleByTrigger(triggerId)`, also fetch the trace if `row.trace_id` is present:

```jsx
const [trace, setTrace] = useState(null);

useEffect(() => {
  if (!open || !row || !row.trace_id) return undefined;
  let cancelled = false;
  callLedgerApi.tracesByCallId(row.id).then((t) => { if (!cancelled) setTrace(t); });
  return () => { cancelled = true; };
}, [open, row]);
```

In the expanded render, after the existing chip row + output block, conditionally render:

```jsx
{trace && trace.length > 1 && (
  <Box sx={{ mt: 1, p: 1, background: '#f8f8f8', borderRadius: 1 }}>
    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
      Director trace ({trace.length} steps)
    </Typography>
    {trace.map((r, i) => (
      <Typography key={r.id} variant="caption" component="div" sx={{ pl: 1 }}>
        Step {i + 1}: {r.output_summary || '(no summary)'}
      </Typography>
    ))}
  </Box>
)}
```

### Step 2: Test

Append to `src/__tests__/renderer/RationaleCard.test.jsx`:

```jsx
test('renders director trace when row has trace_id', async () => {
  const callLedgerApi = require('../../renderer/api/callLedgerApi').default;
  callLedgerApi.rationaleByTrigger = jest.fn().mockResolvedValue({
    id: 5, intent: 'director-pull-suggestion', provider: 'deepseek-v3',
    context_keys: [], cost_usd: 0.0001, cache_hit: false,
    output_summary: 'step 3: answer', output_json: { title: 't' },
    trace_id: 'tr_abc',
  });
  callLedgerApi.tracesByCallId = jest.fn().mockResolvedValue([
    { id: 3, output_summary: 'step 1: tool=topUnmasteredConcepts' },
    { id: 4, output_summary: 'step 2: tool=recentEpisodeSummary' },
    { id: 5, output_summary: 'step 3: answer' },
  ]);
  const { fireEvent, screen, waitFor } = require('@testing-library/react');
  const { render } = require('@testing-library/react');
  const React = require('react');
  const RationaleCard = require('../../renderer/components/brainShell/RationaleCard').default;
  render(React.createElement(RationaleCard, { triggerId: 'trig_director' }));
  fireEvent.click(screen.getByRole('button', { name: /toggle rationale/i }));
  await waitFor(() => expect(screen.getByText(/Director trace/)).toBeInTheDocument());
  expect(screen.getByText(/Step 1:.*topUnmasteredConcepts/)).toBeInTheDocument();
});
```

### Step 3: Run + commit

```bash
npx jest src/__tests__/renderer/RationaleCard
git add src/renderer/components/brainShell/RationaleCard.jsx src/__tests__/renderer/RationaleCard.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(director): RationaleCard renders Director trace"
```

---

## Task 16: Full regression

**Files:** none.

```bash
npx jest 2>&1 | tail -10
```

Expected: all tests pass.

No commit.

---

**Done condition:** 15 commits. Director runtime + 3 read tools + Pull config live. `synthesizePullSuggestion` routes through Director. RationaleCard shows trace. Full test suite green.
