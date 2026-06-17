# Phase 9a — Brain Spine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Brain Spine plumbing — `brainCall`, `meteredCall`, `BrainContext`, Intent Registry, Tool Registry (dormant), Cost Estimator, Call Ledger — with zero existing LLM call sites migrated and no user-visible surfaces. Foundation only.

**Architecture:** A new module tree under `src/main/brain/spine/` exposes two entry points that dispatch through the existing `AIProviderManager` + `getStructured` polyfill and persist every call to a new `brain_call_ledger` SQLite table. The spine is additive: nothing in Phase 0–8 services changes in this plan.

**Tech Stack:** Node.js (Electron main process), better-sqlite3, Jest. No new runtime dependencies.

**Spec:** [docs/superpowers/specs/2026-06-17-phase-9-brain-spine-design.md](../specs/2026-06-17-phase-9-brain-spine-design.md)

---

## File Structure

**Created:**
- `src/main/db/CallLedgerStore.js` — DAO over `brain_call_ledger`
- `src/main/brain/spine/intents.js` — Intent Registry
- `src/main/brain/spine/tools.js` — Tool Registry (dormant)
- `src/main/brain/spine/BrainContext.js` — learner-state slicer
- `src/main/brain/spine/costEstimator.js` — per-provider pricing
- `src/main/brain/spine/promptAssembler.js` — prompt + context + schema composer
- `src/main/brain/spine/brainCall.js` — primary entry
- `src/main/brain/spine/meteredCall.js` — passthrough entry
- `src/main/brain/spine/index.js` — barrel export
- `src/main/ipc/callLedgerHandlers.js` — IPC handlers for ledger reads
- `src/renderer/api/callLedgerApi.js` — renderer client
- `src/__tests__/spine/CallLedgerStore.test.js`
- `src/__tests__/spine/intents.test.js`
- `src/__tests__/spine/tools.test.js`
- `src/__tests__/spine/BrainContext.test.js`
- `src/__tests__/spine/costEstimator.test.js`
- `src/__tests__/spine/promptAssembler.test.js`
- `src/__tests__/spine/brainCall.test.js`
- `src/__tests__/spine/meteredCall.test.js`
- `src/__tests__/integration/spine-end-to-end.test.js`

**Modified:**
- `db.sql` — add `brain_call_ledger` table + indexes (append at end of file)
- `src/main/main.ts` — register `callLedgerHandlers` in IPC bootstrap
- `src/main/brain/LearningBrainAgent.js` — wire nightly prune into `runHeartbeat`

---

## Task 1: SQL schema migration for brain_call_ledger

**Files:**
- Modify: `db.sql` (append)

- [ ] **Step 1: Add the table + indexes**

Open `db.sql` and append at end of file:

```sql

-- Phase 9 Brain Spine — Call Ledger
CREATE TABLE IF NOT EXISTS "brain_call_ledger" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intent TEXT NOT NULL,
  ts INTEGER NOT NULL,
  provider TEXT NOT NULL,
  context_keys TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd REAL,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  cache_key TEXT,
  duration_ms INTEGER,
  trigger_id TEXT,
  output_summary TEXT,
  output_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_brain_call_ledger_ts ON brain_call_ledger(ts);
CREATE INDEX IF NOT EXISTS idx_brain_call_ledger_intent_ts ON brain_call_ledger(intent, ts);
CREATE INDEX IF NOT EXISTS idx_brain_call_ledger_trigger ON brain_call_ledger(trigger_id);
CREATE INDEX IF NOT EXISTS idx_brain_call_ledger_cache ON brain_call_ledger(intent, cache_key);
```

Note: `output_json` is added beyond the spec's column list — needed so the Rationale Card in Plan B can render the structured output. Truncated `output_summary` stays for fast listing.

- [ ] **Step 2: Verify schema by booting the app once**

Run: `npm run start:main` and wait ~10 seconds, then Ctrl+C.

Expected: no SQL errors in console; if `sqlite_tables.db` already exists the `CREATE TABLE IF NOT EXISTS` is a no-op.

If you need a clean DB: delete `sqlite_tables.db*` (the existing seed file plus `-shm`, `-wal`) before booting. Recreated from `db.sql` on next start.

- [ ] **Step 3: Commit**

```bash
git add db.sql
git commit -m "feat(spine): add brain_call_ledger table for Phase 9 Brain Spine"
```

---

## Task 2: CallLedgerStore — contract

**Files:**
- Create: `src/main/db/CallLedgerStore.js`

- [ ] **Step 1: Write the module skeleton with all method signatures (no implementation)**

```js
// src/main/db/CallLedgerStore.js
/**
 * CallLedgerStore — DAO over the `brain_call_ledger` table.
 *
 * Source of truth for Rationale Card and Economics Panel.
 * Used internally by the Brain Spine (`brainCall`, `meteredCall`).
 */

const DBManager = require('./dbManager');

/**
 * @typedef {Object} LedgerRow
 * @property {number} id
 * @property {string} intent
 * @property {number} ts          - epoch ms
 * @property {string} provider
 * @property {string[]} context_keys
 * @property {number} prompt_tokens
 * @property {number} completion_tokens
 * @property {number} cost_usd
 * @property {boolean} cache_hit
 * @property {string|null} cache_key
 * @property {number} duration_ms
 * @property {string|null} trigger_id
 * @property {string|null} output_summary
 * @property {object|null} output_json
 */

/**
 * @typedef {Object} AggregateRow
 * @property {string} key        - intent or provider name
 * @property {number} call_count
 * @property {number} total_cost_usd
 * @property {number} cache_hits
 */

/** Insert a fresh (non-cache-hit) call row. Returns the new id. */
async function record(row) {
  throw new Error('not implemented');
}

/** Record a cache hit referencing an existing fresh call. Returns the new id. */
async function recordCacheHit({ intent, cacheKey, triggerId }) {
  throw new Error('not implemented');
}

/** Find a usable cached output for (intent, cacheKey). Returns LedgerRow or null. */
async function findCacheHit(intent, cacheKey) {
  throw new Error('not implemented');
}

/** Fetch the most recent ledger row for a triggerId (for Rationale Card). */
async function findByTriggerId(triggerId) {
  throw new Error('not implemented');
}

/** Aggregate cost + call_count grouped by intent within [sinceMs, nowMs]. */
async function aggregateByIntent(sinceMs) {
  throw new Error('not implemented');
}

/** Aggregate cost + call_count grouped by provider within [sinceMs, nowMs]. */
async function aggregateByProvider(sinceMs) {
  throw new Error('not implemented');
}

/** Cache hit-rate per intent within [sinceMs, nowMs]. Returns Map<intent, ratio>. */
async function cacheHitRateByIntent(sinceMs) {
  throw new Error('not implemented');
}

/** Drop rows older than maxAgeMs OR oldest rows until count ≤ maxRows. Returns count pruned. */
async function prune({ maxAgeMs, maxRows }) {
  throw new Error('not implemented');
}

module.exports = {
  record,
  recordCacheHit,
  findCacheHit,
  findByTriggerId,
  aggregateByIntent,
  aggregateByProvider,
  cacheHitRateByIntent,
  prune,
};
```

- [ ] **Step 2: Verify the module loads**

Run: `node -e "require('./src/main/db/CallLedgerStore.js'); console.log('OK')"`
Expected: `OK` printed.

- [ ] **Step 3: Commit**

```bash
git add src/main/db/CallLedgerStore.js
git commit -m "feat(spine): CallLedgerStore contract — method signatures only"
```

---

## Task 3: CallLedgerStore — record() TDD

**Files:**
- Create: `src/__tests__/spine/CallLedgerStore.test.js`
- Modify: `src/main/db/CallLedgerStore.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/spine/CallLedgerStore.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Mock DBManager to point at an in-memory DB seeded from db.sql.
let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
}));

const CallLedgerStore = require('../../main/db/CallLedgerStore');

function freshDb() {
  const db = new Database(':memory:');
  const sql = fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8');
  db.exec(sql);
  return db;
}

beforeEach(() => {
  testDb = freshDb();
});
afterEach(() => {
  testDb.close();
});

describe('CallLedgerStore.record', () => {
  test('inserts a row and returns its id', async () => {
    const id = await CallLedgerStore.record({
      intent: 'propose-microcard',
      ts: 1718600000000,
      provider: 'deepseek-v3',
      context_keys: ['currentBook', 'mastery'],
      prompt_tokens: 420,
      completion_tokens: 80,
      cost_usd: 0.00014,
      cache_hit: false,
      cache_key: 'abc123',
      duration_ms: 850,
      trigger_id: 'trig_1',
      output_summary: 'proposed: bond duration',
      output_json: { proposed: 'bond duration' },
    });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
    const row = testDb.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(id);
    expect(row.intent).toBe('propose-microcard');
    expect(JSON.parse(row.context_keys)).toEqual(['currentBook', 'mastery']);
    expect(JSON.parse(row.output_json)).toEqual({ proposed: 'bond duration' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js -t "record"`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement record()**

Replace the `record` stub in `src/main/db/CallLedgerStore.js`:

```js
function record(row) {
  const db = DBManager.getDb();
  const stmt = db.prepare(`
    INSERT INTO brain_call_ledger
      (intent, ts, provider, context_keys, prompt_tokens, completion_tokens,
       cost_usd, cache_hit, cache_key, duration_ms, trigger_id,
       output_summary, output_json)
    VALUES
      (@intent, @ts, @provider, @context_keys, @prompt_tokens, @completion_tokens,
       @cost_usd, @cache_hit, @cache_key, @duration_ms, @trigger_id,
       @output_summary, @output_json)
  `);
  const info = stmt.run({
    intent: row.intent,
    ts: row.ts,
    provider: row.provider,
    context_keys: JSON.stringify(row.context_keys || []),
    prompt_tokens: row.prompt_tokens ?? 0,
    completion_tokens: row.completion_tokens ?? 0,
    cost_usd: row.cost_usd ?? 0,
    cache_hit: row.cache_hit ? 1 : 0,
    cache_key: row.cache_key ?? null,
    duration_ms: row.duration_ms ?? 0,
    trigger_id: row.trigger_id ?? null,
    output_summary: row.output_summary ?? null,
    output_json: row.output_json != null ? JSON.stringify(row.output_json) : null,
  });
  return info.lastInsertRowid;
}
```

Note: dropping `async` from `record`. The test awaits a sync function fine; downstream consumers can still `await`. Apply the same de-async pattern to the other ledger methods as you implement them.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js -t "record"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/db/CallLedgerStore.js src/__tests__/spine/CallLedgerStore.test.js
git commit -m "feat(spine): CallLedgerStore.record implementation + test"
```

---

## Task 4: CallLedgerStore — findCacheHit() + recordCacheHit() TDD

**Files:**
- Modify: `src/__tests__/spine/CallLedgerStore.test.js`
- Modify: `src/main/db/CallLedgerStore.js`

- [ ] **Step 1: Add failing tests**

Append to `CallLedgerStore.test.js`:

```js
describe('CallLedgerStore cache lookup', () => {
  test('findCacheHit returns null when no row exists', async () => {
    const hit = await CallLedgerStore.findCacheHit('propose-microcard', 'nokey');
    expect(hit).toBeNull();
  });

  test('findCacheHit returns the most recent fresh row for (intent, cacheKey)', async () => {
    await CallLedgerStore.record({
      intent: 'propose-microcard',
      ts: 1000,
      provider: 'deepseek-v3',
      cache_key: 'k1',
      cache_hit: false,
      output_json: { v: 'old' },
    });
    await CallLedgerStore.record({
      intent: 'propose-microcard',
      ts: 2000,
      provider: 'deepseek-v3',
      cache_key: 'k1',
      cache_hit: false,
      output_json: { v: 'new' },
    });
    const hit = await CallLedgerStore.findCacheHit('propose-microcard', 'k1');
    expect(hit.output_json).toEqual({ v: 'new' });
  });

  test('findCacheHit ignores cache_hit rows', async () => {
    await CallLedgerStore.record({
      intent: 'x', ts: 1000, provider: 'p', cache_key: 'k', cache_hit: false, output_json: { v: 'fresh' },
    });
    await CallLedgerStore.recordCacheHit({ intent: 'x', cacheKey: 'k', triggerId: null });
    const hit = await CallLedgerStore.findCacheHit('x', 'k');
    expect(hit.output_json).toEqual({ v: 'fresh' });
    expect(hit.cache_hit).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js -t "cache lookup"`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement findCacheHit + recordCacheHit**

Replace the two stubs in `CallLedgerStore.js`:

```js
function findCacheHit(intent, cacheKey) {
  if (!cacheKey) return null;
  const db = DBManager.getDb();
  const row = db.prepare(`
    SELECT * FROM brain_call_ledger
    WHERE intent = ? AND cache_key = ? AND cache_hit = 0
    ORDER BY ts DESC LIMIT 1
  `).get(intent, cacheKey);
  if (!row) return null;
  return hydrate(row);
}

function recordCacheHit({ intent, cacheKey, triggerId }) {
  const db = DBManager.getDb();
  const src = db.prepare(`
    SELECT * FROM brain_call_ledger
    WHERE intent = ? AND cache_key = ? AND cache_hit = 0
    ORDER BY ts DESC LIMIT 1
  `).get(intent, cacheKey);
  if (!src) {
    throw new Error(`recordCacheHit: no fresh row for ${intent}/${cacheKey}`);
  }
  const info = db.prepare(`
    INSERT INTO brain_call_ledger
      (intent, ts, provider, context_keys, prompt_tokens, completion_tokens,
       cost_usd, cache_hit, cache_key, duration_ms, trigger_id,
       output_summary, output_json)
    VALUES
      (?, ?, ?, ?, 0, 0, 0, 1, ?, 0, ?, ?, ?)
  `).run(
    src.intent, Date.now(), src.provider, src.context_keys,
    src.cache_key, triggerId || null, src.output_summary, src.output_json,
  );
  return info.lastInsertRowid;
}

function hydrate(row) {
  return {
    ...row,
    context_keys: row.context_keys ? JSON.parse(row.context_keys) : [],
    output_json: row.output_json ? JSON.parse(row.output_json) : null,
    cache_hit: !!row.cache_hit,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js -t "cache lookup"`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/db/CallLedgerStore.js src/__tests__/spine/CallLedgerStore.test.js
git commit -m "feat(spine): CallLedgerStore cache lookup + recordCacheHit"
```

---

## Task 5: CallLedgerStore — aggregations + cacheHitRateByIntent + findByTriggerId TDD

**Files:**
- Modify: `src/__tests__/spine/CallLedgerStore.test.js`
- Modify: `src/main/db/CallLedgerStore.js`

- [ ] **Step 1: Add failing tests**

Append:

```js
describe('CallLedgerStore aggregations', () => {
  beforeEach(async () => {
    const seed = [
      { intent: 'a', provider: 'deepseek-v3', cost_usd: 0.01, cache_hit: false, ts: 1000 },
      { intent: 'a', provider: 'deepseek-v3', cost_usd: 0.02, cache_hit: false, ts: 2000 },
      { intent: 'a', provider: 'qwen', cost_usd: 0.03, cache_hit: false, ts: 3000 },
      { intent: 'b', provider: 'deepseek-v3', cost_usd: 0.04, cache_hit: false, ts: 4000 },
      { intent: 'a', provider: 'deepseek-v3', cost_usd: 0,    cache_hit: true,  ts: 5000 },
    ];
    for (const r of seed) await CallLedgerStore.record(r);
  });

  test('aggregateByIntent sums cost and counts fresh calls', async () => {
    const rows = await CallLedgerStore.aggregateByIntent(0);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.a.call_count).toBe(3);
    expect(byKey.a.total_cost_usd).toBeCloseTo(0.06, 5);
    expect(byKey.a.cache_hits).toBe(1);
    expect(byKey.b.call_count).toBe(1);
  });

  test('aggregateByProvider sums per provider', async () => {
    const rows = await CallLedgerStore.aggregateByProvider(0);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey['deepseek-v3'].call_count).toBe(3);
    expect(byKey['qwen'].call_count).toBe(1);
  });

  test('cacheHitRateByIntent returns ratio per intent', async () => {
    const map = await CallLedgerStore.cacheHitRateByIntent(0);
    expect(map.get('a')).toBeCloseTo(0.25, 5); // 1 hit / 4 total for intent a
  });

  test('findByTriggerId returns the most recent row for that trigger', async () => {
    await CallLedgerStore.record({ intent: 'x', provider: 'p', ts: 100, cache_hit: false, trigger_id: 'T1', output_summary: 'first' });
    await CallLedgerStore.record({ intent: 'x', provider: 'p', ts: 200, cache_hit: false, trigger_id: 'T1', output_summary: 'second' });
    const row = await CallLedgerStore.findByTriggerId('T1');
    expect(row.output_summary).toBe('second');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js -t "aggregations"`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement the four methods**

Replace stubs in `CallLedgerStore.js`:

```js
function aggregateByIntent(sinceMs) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT intent AS key,
           SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) AS call_count,
           SUM(CASE WHEN cache_hit = 0 THEN cost_usd ELSE 0 END) AS total_cost_usd,
           SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) AS cache_hits
    FROM brain_call_ledger
    WHERE ts >= ?
    GROUP BY intent
    ORDER BY total_cost_usd DESC
  `).all(sinceMs);
  return rows;
}

function aggregateByProvider(sinceMs) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT provider AS key,
           SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) AS call_count,
           SUM(CASE WHEN cache_hit = 0 THEN cost_usd ELSE 0 END) AS total_cost_usd,
           SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) AS cache_hits
    FROM brain_call_ledger
    WHERE ts >= ?
    GROUP BY provider
    ORDER BY total_cost_usd DESC
  `).all(sinceMs);
  return rows;
}

function cacheHitRateByIntent(sinceMs) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT intent,
           SUM(cache_hit) AS hits,
           COUNT(*) AS total
    FROM brain_call_ledger
    WHERE ts >= ?
    GROUP BY intent
  `).all(sinceMs);
  const out = new Map();
  for (const r of rows) {
    out.set(r.intent, r.total > 0 ? r.hits / r.total : 0);
  }
  return out;
}

function findByTriggerId(triggerId) {
  if (!triggerId) return null;
  const db = DBManager.getDb();
  const row = db.prepare(`
    SELECT * FROM brain_call_ledger
    WHERE trigger_id = ?
    ORDER BY ts DESC LIMIT 1
  `).get(triggerId);
  return row ? hydrate(row) : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/db/CallLedgerStore.js src/__tests__/spine/CallLedgerStore.test.js
git commit -m "feat(spine): CallLedgerStore aggregations and trigger lookup"
```

---

## Task 6: CallLedgerStore — prune() TDD

**Files:**
- Modify: `src/__tests__/spine/CallLedgerStore.test.js`
- Modify: `src/main/db/CallLedgerStore.js`

- [ ] **Step 1: Add failing tests**

Append:

```js
describe('CallLedgerStore.prune', () => {
  test('drops rows older than maxAgeMs', async () => {
    const now = Date.now();
    await CallLedgerStore.record({ intent: 'a', provider: 'p', ts: now - 100 * 24 * 3600 * 1000, cache_hit: false });
    await CallLedgerStore.record({ intent: 'a', provider: 'p', ts: now - 10 * 24 * 3600 * 1000,  cache_hit: false });
    const dropped = await CallLedgerStore.prune({ maxAgeMs: 90 * 24 * 3600 * 1000, maxRows: 10000 });
    expect(dropped).toBe(1);
    const remaining = testDb.prepare('SELECT COUNT(*) AS c FROM brain_call_ledger').get().c;
    expect(remaining).toBe(1);
  });

  test('drops oldest rows when count > maxRows', async () => {
    for (let i = 0; i < 15; i++) {
      await CallLedgerStore.record({ intent: 'a', provider: 'p', ts: i, cache_hit: false });
    }
    const dropped = await CallLedgerStore.prune({ maxAgeMs: 90 * 24 * 3600 * 1000, maxRows: 10 });
    expect(dropped).toBe(5);
    const remaining = testDb.prepare('SELECT COUNT(*) AS c FROM brain_call_ledger').get().c;
    expect(remaining).toBe(10);
    const minTs = testDb.prepare('SELECT MIN(ts) AS m FROM brain_call_ledger').get().m;
    expect(minTs).toBe(5); // oldest 5 (ts 0..4) dropped
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js -t "prune"`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement prune**

Replace stub:

```js
function prune({ maxAgeMs, maxRows }) {
  const db = DBManager.getDb();
  let dropped = 0;
  if (maxAgeMs && maxAgeMs > 0) {
    const cutoff = Date.now() - maxAgeMs;
    const info = db.prepare('DELETE FROM brain_call_ledger WHERE ts < ?').run(cutoff);
    dropped += info.changes;
  }
  if (maxRows && maxRows > 0) {
    const count = db.prepare('SELECT COUNT(*) AS c FROM brain_call_ledger').get().c;
    if (count > maxRows) {
      const excess = count - maxRows;
      const info = db.prepare(`
        DELETE FROM brain_call_ledger
        WHERE id IN (
          SELECT id FROM brain_call_ledger ORDER BY ts ASC LIMIT ?
        )
      `).run(excess);
      dropped += info.changes;
    }
  }
  return dropped;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/spine/CallLedgerStore.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/db/CallLedgerStore.js src/__tests__/spine/CallLedgerStore.test.js
git commit -m "feat(spine): CallLedgerStore.prune with age and row-count limits"
```

---

## Task 7: Cost Estimator — pricing table + estimate function TDD

**Files:**
- Create: `src/main/brain/spine/costEstimator.js`
- Create: `src/__tests__/spine/costEstimator.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/spine/costEstimator.test.js
const costEstimator = require('../../main/brain/spine/costEstimator');

describe('costEstimator', () => {
  test('estimates DeepSeek-V3 cost from token counts', () => {
    // DeepSeek-V3 baseline: $0.27/MTok input, $1.10/MTok output (2026 pricing)
    const cost = costEstimator.estimate('deepseek-v3', { prompt_tokens: 1000, completion_tokens: 500 });
    expect(cost).toBeCloseTo(0.27e-3 + 0.55e-3, 6); // 1k * 0.27/MTok + 500 * 1.10/MTok
  });

  test('falls back to a default provider when unknown', () => {
    const cost = costEstimator.estimate('unknown-provider', { prompt_tokens: 1000, completion_tokens: 1000 });
    expect(cost).toBeGreaterThan(0);
  });

  test('estimateTokens approximates string length', () => {
    const t = costEstimator.estimateTokens('a'.repeat(400));
    expect(t).toBeGreaterThan(80);  // ~4 chars per token
    expect(t).toBeLessThan(150);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/spine/costEstimator.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
// src/main/brain/spine/costEstimator.js
/**
 * Cost estimator for Brain Spine LLM calls.
 *
 * Pricing in USD per 1M tokens (2026 baseline). Open-source-first:
 * DeepSeek / Qwen / Kimi defaults; frontier providers are opt-in upgrades.
 *
 * Refresh quarterly. Raw token counts are stored on the ledger so historical
 * costs can be recomputed when this table is updated.
 */

const PRICING = {
  'deepseek-v3':       { input: 0.27, output: 1.10 },
  'deepseek-chat':     { input: 0.14, output: 0.28 },
  'qwen-max':          { input: 1.60, output: 6.40 },
  'qwen-plus':         { input: 0.40, output: 1.20 },
  'kimi':              { input: 0.30, output: 1.50 },
  'baidu-qianfan':     { input: 0.50, output: 1.50 },
  'ollama-local':      { input: 0,    output: 0    },
  // Frontier (opt-in upgrades):
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00 },
  'gpt-4o':            { input: 2.50, output: 10.00 },
  'gemini-pro':        { input: 1.25, output: 5.00 },
};

const DEFAULT_PROVIDER_NAME = 'deepseek-v3';

function estimate(providerName, { prompt_tokens = 0, completion_tokens = 0 }) {
  const key = providerName?.toLowerCase?.() || DEFAULT_PROVIDER_NAME;
  const row = PRICING[key] || PRICING[DEFAULT_PROVIDER_NAME];
  return (prompt_tokens * row.input + completion_tokens * row.output) / 1e6;
}

function estimateTokens(text) {
  if (!text) return 0;
  const s = typeof text === 'string' ? text : JSON.stringify(text);
  return Math.ceil(s.length / 4);
}

module.exports = { estimate, estimateTokens, PRICING };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/spine/costEstimator.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/spine/costEstimator.js src/__tests__/spine/costEstimator.test.js
git commit -m "feat(spine): cost estimator with open-source-first pricing baseline"
```

---

## Task 8: Intent Registry — contract

**Files:**
- Create: `src/main/brain/spine/intents.js`

- [ ] **Step 1: Write module skeleton**

```js
// src/main/brain/spine/intents.js
/**
 * Intent Registry — maps a declared intent name to a profile used by `brainCall`.
 *
 * Profile shape:
 *   {
 *     label:              string,                              — human label for Rationale Card
 *     contextSlices:      string[],                            — slice names consumed from BrainContext
 *     costCeilingTokens:  number,                              — prompt-size soft ceiling
 *     cachePolicy:        'content-hash' | 'session' | 'none',
 *     schema?:            object                                — JSON schema for structured output
 *   }
 */

const INTENTS = {};

function register(name, profile) {
  if (!name || typeof name !== 'string') {
    throw new Error('intents.register: name required');
  }
  if (!profile || !Array.isArray(profile.contextSlices)) {
    throw new Error(`intents.register(${name}): profile.contextSlices required`);
  }
  if (!Number.isFinite(profile.costCeilingTokens)) {
    throw new Error(`intents.register(${name}): profile.costCeilingTokens required`);
  }
  if (!['content-hash', 'session', 'none'].includes(profile.cachePolicy)) {
    throw new Error(`intents.register(${name}): invalid cachePolicy`);
  }
  INTENTS[name] = Object.freeze({ ...profile });
}

function resolve(name) {
  const p = INTENTS[name];
  if (!p) throw new Error(`unknown intent: ${name}`);
  return p;
}

function list() {
  return Object.keys(INTENTS).sort();
}

module.exports = { register, resolve, list };
```

- [ ] **Step 2: Verify the module loads**

Run: `node -e "const i=require('./src/main/brain/spine/intents.js'); console.log(i.list())"`
Expected: `[]`.

- [ ] **Step 3: Commit**

```bash
git add src/main/brain/spine/intents.js
git commit -m "feat(spine): intent registry contract — register/resolve/list"
```

---

## Task 9: Intent Registry — seed intents TDD

**Files:**
- Create: `src/__tests__/spine/intents.test.js`
- Create: `src/main/brain/spine/seedIntents.js`
- Modify: `src/main/brain/spine/intents.js` (auto-load seeds)

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/spine/intents.test.js
const intents = require('../../main/brain/spine/intents');

describe('seed intents', () => {
  test('all 11 spec intents are registered', () => {
    const names = intents.list();
    const expected = [
      'argument-xray',
      'diagnose-book',
      'extract-learning-points',
      'grade-comprehension',
      'plan-cross-book-path',
      'propose-microcard',
      'schedule-production-prompt',
      'schedule-reread',
      'suggest-organize',
      'synthesize-pull-suggestion',
      'tutor-context',
    ];
    expect(names.sort()).toEqual(expected.sort());
  });

  test('each profile validates', () => {
    for (const name of intents.list()) {
      const p = intents.resolve(name);
      expect(Array.isArray(p.contextSlices)).toBe(true);
      expect(p.contextSlices.length).toBeGreaterThan(0);
      expect(typeof p.costCeilingTokens).toBe('number');
      expect(['content-hash', 'session', 'none']).toContain(p.cachePolicy);
    }
  });

  test('unknown intent throws', () => {
    expect(() => intents.resolve('does-not-exist')).toThrow(/unknown intent/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/spine/intents.test.js`
Expected: FAIL — list is `[]`.

- [ ] **Step 3: Create the seed module**

```js
// src/main/brain/spine/seedIntents.js
const intents = require('./intents');

intents.register('extract-learning-points', {
  label: 'Extract learning points',
  contextSlices: ['currentBook', 'mastery'],
  costCeilingTokens: 1200,
  cachePolicy: 'content-hash',
});

intents.register('propose-microcard', {
  label: 'Propose micro-card',
  contextSlices: ['currentBook', 'mastery', 'recentEpisodes'],
  costCeilingTokens: 800,
  cachePolicy: 'content-hash',
});

intents.register('diagnose-book', {
  label: 'Pre-reading book diagnostic',
  contextSlices: ['mastery', 'activeQuest'],
  costCeilingTokens: 1500,
  cachePolicy: 'content-hash',
});

intents.register('grade-comprehension', {
  label: 'Grade comprehension',
  contextSlices: ['currentBook', 'mastery', 'recentEpisodes'],
  costCeilingTokens: 1000,
  cachePolicy: 'none',
});

intents.register('plan-cross-book-path', {
  label: 'Plan cross-book learning path',
  contextSlices: ['activeQuest', 'mastery'],
  costCeilingTokens: 2000,
  cachePolicy: 'session',
});

intents.register('schedule-reread', {
  label: 'Schedule re-read',
  contextSlices: ['recentComprehension', 'recentEpisodes'],
  costCeilingTokens: 600,
  cachePolicy: 'none',
});

intents.register('suggest-organize', {
  label: 'Suggest MoodBoard organize',
  contextSlices: ['mastery', 'currentBook'],
  costCeilingTokens: 800,
  cachePolicy: 'content-hash',
});

intents.register('schedule-production-prompt', {
  label: 'Schedule production prompt',
  contextSlices: ['mastery', 'activeQuest'],
  costCeilingTokens: 800,
  cachePolicy: 'content-hash',
});

intents.register('argument-xray', {
  label: 'Argument X-ray',
  contextSlices: ['currentBook'],
  costCeilingTokens: 1200,
  cachePolicy: 'content-hash',
});

intents.register('synthesize-pull-suggestion', {
  label: 'Synthesize pull suggestion',
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery', 'acceptDismissPatterns'],
  costCeilingTokens: 1000,
  cachePolicy: 'session',
});

intents.register('tutor-context', {
  label: 'Tutor system prompt',
  contextSlices: ['activeQuest', 'currentBook', 'mastery', 'recentEpisodes'],
  costCeilingTokens: 1500,
  cachePolicy: 'session',
});

module.exports = {};
```

- [ ] **Step 4: Auto-load seeds in intents.js**

Add at top of `src/main/brain/spine/intents.js` (after the INTENTS declaration block, before module.exports):

```js
// Seed registration runs on first require of this module.
// Done as a side-effect import to keep the registry a single source of truth.
let seedsLoaded = false;
function ensureSeeds() {
  if (!seedsLoaded) {
    seedsLoaded = true;
    require('./seedIntents'); // eslint-disable-line global-require
  }
}
const origResolve = resolve;
function resolveWithSeeds(name) { ensureSeeds(); return origResolve(name); }
const origList = list;
function listWithSeeds() { ensureSeeds(); return origList(); }
module.exports = { register, resolve: resolveWithSeeds, list: listWithSeeds };
```

Replace the previous `module.exports = { register, resolve, list }` with the block above.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/__tests__/spine/intents.test.js`
Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/brain/spine/intents.js src/main/brain/spine/seedIntents.js src/__tests__/spine/intents.test.js
git commit -m "feat(spine): seed 11 spec intents and auto-load on first resolve"
```

---

## Task 10: Tool Registry — contract + dormant smoke

**Files:**
- Create: `src/main/brain/spine/tools.js`
- Create: `src/__tests__/spine/tools.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/spine/tools.test.js
const tools = require('../../main/brain/spine/tools');

describe('Tool registry (Phase 9 dormant)', () => {
  test('all 5 spec tools are declared with JSON schemas', () => {
    const names = tools.list();
    expect(names.sort()).toEqual([
      'createMicroCard',
      'markConceptMastered',
      'navigate',
      'openMoodBoard',
      'scheduleReread',
    ]);
    for (const n of names) {
      const decl = tools.describe(n);
      expect(decl.name).toBe(n);
      expect(decl.schema).toBeDefined();
      expect(typeof decl.schema).toBe('object');
    }
  });

  test('invoke throws in Phase 9 (dormant)', () => {
    expect(() => tools.invoke('navigate', { view: 'reading' }))
      .toThrow(/not yet wired/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/spine/tools.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
// src/main/brain/spine/tools.js
/**
 * Tool Registry — declarations of AI-invocable capabilities.
 *
 * Phase 9: registered + describable + listable, but invocation throws.
 * Phase 10 (Director Mode) wires invoke() to actual handlers.
 *
 * Schemas are JSON-schema-shaped property maps with type per property.
 */

const TOOLS = {};

function register(name, decl) {
  if (!name || !decl || !decl.schema) {
    throw new Error('tools.register: name and schema required');
  }
  TOOLS[name] = Object.freeze({ name, ...decl });
}

function describe(name) {
  return TOOLS[name] || null;
}

function list() {
  return Object.keys(TOOLS).sort();
}

function invoke(name, args) {
  if (!TOOLS[name]) throw new Error(`unknown tool: ${name}`);
  throw new Error(`tools.invoke(${name}): not yet wired — see Phase 10 Director Mode`);
}

register('navigate', {
  description: 'Navigate the renderer to a view.',
  schema: { properties: { view: { type: 'string' }, params: { type: 'object' } }, required: ['view'] },
});
register('createMicroCard', {
  description: 'Create a micro-card from a paragraph.',
  schema: {
    properties: {
      paragraphId: { type: 'string' },
      front: { type: 'string' },
      back: { type: 'string' },
    },
    required: ['paragraphId', 'front', 'back'],
  },
});
register('markConceptMastered', {
  description: 'Mark a concept as mastered in the learning point store.',
  schema: { properties: { conceptId: { type: 'string' } }, required: ['conceptId'] },
});
register('openMoodBoard', {
  description: 'Open a specific MoodBoard view.',
  schema: { properties: { boardId: { type: 'string' } }, required: ['boardId'] },
});
register('scheduleReread', {
  description: 'Schedule a chapter for re-reading.',
  schema: {
    properties: {
      bookId: { type: 'string' },
      chapterIndex: { type: 'number' },
      delayHours: { type: 'number' },
    },
    required: ['bookId', 'chapterIndex'],
  },
});

module.exports = { register, describe, list, invoke };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/spine/tools.test.js`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/spine/tools.js src/__tests__/spine/tools.test.js
git commit -m "feat(spine): tool registry — dormant declarations for Phase 10"
```

---

## Task 11: BrainContext — contract + buildSlice skeleton

**Files:**
- Create: `src/main/brain/spine/BrainContext.js`

- [ ] **Step 1: Write the skeleton with stub slices**

```js
// src/main/brain/spine/BrainContext.js
/**
 * BrainContext — canonical serializable snapshot of learner state.
 *
 * Each slice is a function `(userId, overrides) => Promise<object>` that
 * returns a small JSON-serializable object. Slices are composed by
 * `buildSlice(['activeQuest', 'mastery'], userId)`.
 *
 * Slices must be:
 *  - small (< 300 tokens each typical)
 *  - deterministic given inputs (sort + cap)
 *  - safe to call from main process
 */

const SLICES = {};

function registerSlice(name, fn) {
  SLICES[name] = fn;
}

async function buildSlice(sliceNames, userId, overrides = {}) {
  const out = {};
  for (const name of sliceNames) {
    const fn = SLICES[name];
    if (!fn) {
      out[name] = { error: `unknown slice: ${name}` };
      continue;
    }
    try {
      out[name] = await fn(userId, overrides[name]);
    } catch (e) {
      out[name] = { error: e.message };
    }
  }
  return out;
}

module.exports = { buildSlice, registerSlice, _slices: SLICES };
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "const c=require('./src/main/brain/spine/BrainContext.js'); console.log(Object.keys(c))"`
Expected: `[ 'buildSlice', 'registerSlice', '_slices' ]`.

- [ ] **Step 3: Commit**

```bash
git add src/main/brain/spine/BrainContext.js
git commit -m "feat(spine): BrainContext skeleton — slice registry and composer"
```

---

## Task 12: BrainContext — activeQuest slice TDD

**Files:**
- Create: `src/__tests__/spine/BrainContext.test.js`
- Create: `src/main/brain/spine/slices/activeQuest.js`
- Modify: `src/main/brain/spine/BrainContext.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/spine/BrainContext.test.js
jest.mock('../../main/db/QuestStore', () => ({
  getActive: jest.fn(),
}));
const QuestStore = require('../../main/db/QuestStore');
const BrainContext = require('../../main/brain/spine/BrainContext');
require('../../main/brain/spine/slices/activeQuest'); // self-registers

describe('BrainContext.activeQuest', () => {
  test('returns the active quest summary', async () => {
    QuestStore.getActive.mockResolvedValue({
      id: 'q1', title: 'Learn German B2', bookIds: [10, 11], createdAt: 1000,
    });
    const result = await BrainContext.buildSlice(['activeQuest'], 1);
    expect(result.activeQuest.title).toBe('Learn German B2');
    expect(result.activeQuest.bookIds).toEqual([10, 11]);
  });

  test('returns null shape when no active quest', async () => {
    QuestStore.getActive.mockResolvedValue(null);
    const result = await BrainContext.buildSlice(['activeQuest'], 1);
    expect(result.activeQuest).toEqual({ active: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/spine/BrainContext.test.js -t "activeQuest"`
Expected: FAIL (slice file doesn't exist).

- [ ] **Step 3: Implement the slice**

```js
// src/main/brain/spine/slices/activeQuest.js
const BrainContext = require('../BrainContext');
const QuestStore = require('../../../db/QuestStore');

BrainContext.registerSlice('activeQuest', async (userId) => {
  const q = await QuestStore.getActive(userId);
  if (!q) return { active: false };
  return {
    id: q.id,
    title: q.title,
    bookIds: q.bookIds || [],
    createdAt: q.createdAt,
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/spine/BrainContext.test.js -t "activeQuest"`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/spine/slices/activeQuest.js src/__tests__/spine/BrainContext.test.js
git commit -m "feat(spine): BrainContext activeQuest slice"
```

---

## Task 13: BrainContext — currentBook + recentEpisodes slices TDD

**Files:**
- Modify: `src/__tests__/spine/BrainContext.test.js`
- Create: `src/main/brain/spine/slices/currentBook.js`
- Create: `src/main/brain/spine/slices/recentEpisodes.js`

- [ ] **Step 1: Add failing tests**

Append to `BrainContext.test.js`:

```js
require('../../main/brain/spine/slices/currentBook');
require('../../main/brain/spine/slices/recentEpisodes');

jest.mock('../../main/brain/EpisodeCollector', () => ({
  recent: jest.fn(),
}));
const EpisodeCollector = require('../../main/brain/EpisodeCollector');

describe('BrainContext.currentBook', () => {
  test('takes book context from override (renderer-supplied)', async () => {
    const result = await BrainContext.buildSlice(['currentBook'], 1, {
      currentBook: { bookId: 42, chapterIndex: 3, chapterTitle: 'Bonds' },
    });
    expect(result.currentBook).toEqual({ bookId: 42, chapterIndex: 3, chapterTitle: 'Bonds' });
  });

  test('returns null shape when no override given', async () => {
    const result = await BrainContext.buildSlice(['currentBook'], 1);
    expect(result.currentBook).toEqual({ present: false });
  });
});

describe('BrainContext.recentEpisodes', () => {
  test('returns last-N episode summaries', async () => {
    EpisodeCollector.recent.mockResolvedValue([
      { eventType: 'PARAGRAPH_DWELL', bookId: 1, ts: 100 },
      { eventType: 'BACKTRACK',       bookId: 1, ts: 200 },
    ]);
    const result = await BrainContext.buildSlice(['recentEpisodes'], 1);
    expect(result.recentEpisodes.length).toBe(2);
    expect(EpisodeCollector.recent).toHaveBeenCalledWith(1, 20);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/spine/BrainContext.test.js -t "currentBook"` and `-t "recentEpisodes"`
Expected: FAIL — files do not exist.

- [ ] **Step 3: Implement the slices**

```js
// src/main/brain/spine/slices/currentBook.js
const BrainContext = require('../BrainContext');

BrainContext.registerSlice('currentBook', async (_userId, override) => {
  if (override && override.bookId != null) return override;
  return { present: false };
});
```

```js
// src/main/brain/spine/slices/recentEpisodes.js
const BrainContext = require('../BrainContext');
const EpisodeCollector = require('../../EpisodeCollector');

BrainContext.registerSlice('recentEpisodes', async (userId) => {
  const eps = await EpisodeCollector.recent(userId, 20);
  return eps.map((e) => ({ t: e.eventType, b: e.bookId, ts: e.ts }));
});
```

If `EpisodeCollector.recent(userId, n)` does not exist yet, add a thin method to that file that returns `episodes.slice(-n)` sorted desc by ts. Verify before proceeding by running: `grep -n "function recent\|recent =" src/main/brain/EpisodeCollector.js`. If absent, add:

```js
// in src/main/brain/EpisodeCollector.js — append method
async function recent(userId, n) {
  const all = await loadAllEpisodes();
  return all
    .filter((e) => (e.userId || 1) === userId)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, n);
}
module.exports.recent = recent;
```

Adapt `loadAllEpisodes` to whatever the existing collector uses (likely `episodes` array on the singleton).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/spine/BrainContext.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/spine/slices/currentBook.js src/main/brain/spine/slices/recentEpisodes.js src/__tests__/spine/BrainContext.test.js src/main/brain/EpisodeCollector.js
git commit -m "feat(spine): BrainContext currentBook + recentEpisodes slices"
```

---

## Task 14: BrainContext — mastery + recentComprehension slices TDD

**Files:**
- Modify: `src/__tests__/spine/BrainContext.test.js`
- Create: `src/main/brain/spine/slices/mastery.js`
- Create: `src/main/brain/spine/slices/recentComprehension.js`

- [ ] **Step 1: Add failing tests**

Append:

```js
jest.mock('../../main/db/LearningPointManager', () => ({
  topNByMastery: jest.fn(),
}));
const LearningPointManager = require('../../main/db/LearningPointManager');
require('../../main/brain/spine/slices/mastery');

jest.mock('../../main/utils/ComprehensionGradingService', () => ({
  recentScores: jest.fn(),
}));
const ComprehensionGradingService = require('../../main/utils/ComprehensionGradingService');
require('../../main/brain/spine/slices/recentComprehension');

describe('BrainContext.mastery', () => {
  test('returns top-N learning points with mastery levels', async () => {
    LearningPointManager.topNByMastery.mockResolvedValue([
      { concept: 'duration', mastery_level: 0.78 },
      { concept: 'convexity', mastery_level: 0.42 },
    ]);
    const result = await BrainContext.buildSlice(['mastery'], 1);
    expect(result.mastery).toEqual([
      { c: 'duration', m: 0.78 },
      { c: 'convexity', m: 0.42 },
    ]);
    expect(LearningPointManager.topNByMastery).toHaveBeenCalledWith(1, 15);
  });
});

describe('BrainContext.recentComprehension', () => {
  test('returns last-5 comprehension scores', async () => {
    ComprehensionGradingService.recentScores.mockResolvedValue([
      { bookId: 1, chapterIndex: 3, score: 0.4, ts: 1000 },
    ]);
    const result = await BrainContext.buildSlice(['recentComprehension'], 1);
    expect(result.recentComprehension.length).toBe(1);
    expect(ComprehensionGradingService.recentScores).toHaveBeenCalledWith(1, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/spine/BrainContext.test.js -t "mastery|recentComprehension"`
Expected: FAIL.

- [ ] **Step 3: Implement the slices**

```js
// src/main/brain/spine/slices/mastery.js
const BrainContext = require('../BrainContext');
const LearningPointManager = require('../../../db/LearningPointManager');

BrainContext.registerSlice('mastery', async (userId) => {
  const rows = await LearningPointManager.topNByMastery(userId, 15);
  return rows.map((r) => ({ c: r.concept, m: r.mastery_level }));
});
```

```js
// src/main/brain/spine/slices/recentComprehension.js
const BrainContext = require('../BrainContext');
const ComprehensionGradingService = require('../../../utils/ComprehensionGradingService');

BrainContext.registerSlice('recentComprehension', async (userId) => {
  const rows = await ComprehensionGradingService.recentScores(userId, 5);
  return rows;
});
```

Verify the upstream methods exist:
- `grep -n "topNByMastery" src/main/db/LearningPointManager.js`
- `grep -n "recentScores" src/main/utils/ComprehensionGradingService.js`

If absent, add minimal implementations that query existing tables:
- `topNByMastery(userId, n)` selects from `learning_point` ordering by `mastery_level DESC` limit n
- `recentScores(userId, n)` selects from comprehension result table ordering by ts desc limit n

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/spine/BrainContext.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/spine/slices/mastery.js src/main/brain/spine/slices/recentComprehension.js src/__tests__/spine/BrainContext.test.js src/main/db/LearningPointManager.js src/main/utils/ComprehensionGradingService.js
git commit -m "feat(spine): BrainContext mastery + recentComprehension slices"
```

---

## Task 15: BrainContext — acceptDismissPatterns slice TDD

**Files:**
- Modify: `src/__tests__/spine/BrainContext.test.js`
- Create: `src/main/brain/spine/slices/acceptDismissPatterns.js`

- [ ] **Step 1: Add failing test**

```js
jest.mock('../../main/brain/LearningBrainAgent', () => ({
  getTriggerTelemetry: jest.fn(),
}));
const LearningBrainAgent = require('../../main/brain/LearningBrainAgent');
require('../../main/brain/spine/slices/acceptDismissPatterns');

describe('BrainContext.acceptDismissPatterns', () => {
  test('returns per-source accept/dismiss ratios from last 14 days', async () => {
    LearningBrainAgent.getTriggerTelemetry.mockResolvedValue({
      bySource: {
        'reread-queue-schedule':       { accepted: 2, dismissed: 8 },
        'schedule-production-prompt':  { accepted: 5, dismissed: 1 },
      },
    });
    const result = await BrainContext.buildSlice(['acceptDismissPatterns'], 1);
    const p = result.acceptDismissPatterns;
    expect(p['reread-queue-schedule'].acceptRate).toBeCloseTo(0.2, 2);
    expect(p['schedule-production-prompt'].acceptRate).toBeCloseTo(0.83, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/spine/BrainContext.test.js -t "acceptDismissPatterns"`
Expected: FAIL.

- [ ] **Step 3: Implement the slice**

```js
// src/main/brain/spine/slices/acceptDismissPatterns.js
const BrainContext = require('../BrainContext');
const LearningBrainAgent = require('../../LearningBrainAgent');

BrainContext.registerSlice('acceptDismissPatterns', async () => {
  const tel = await LearningBrainAgent.getTriggerTelemetry();
  const out = {};
  for (const [src, t] of Object.entries(tel?.bySource || {})) {
    const total = (t.accepted || 0) + (t.dismissed || 0);
    out[src] = {
      accepted: t.accepted || 0,
      dismissed: t.dismissed || 0,
      acceptRate: total > 0 ? t.accepted / total : 0,
    };
  }
  return out;
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/spine/BrainContext.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/spine/slices/acceptDismissPatterns.js src/__tests__/spine/BrainContext.test.js
git commit -m "feat(spine): BrainContext acceptDismissPatterns slice from telemetry"
```

---

## Task 16: Prompt Assembler TDD

**Files:**
- Create: `src/main/brain/spine/promptAssembler.js`
- Create: `src/__tests__/spine/promptAssembler.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/spine/promptAssembler.test.js
const assemble = require('../../main/brain/spine/promptAssembler');

describe('promptAssembler', () => {
  test('combines input + context into a deterministic prompt', () => {
    const p = assemble({
      userInput: 'Propose a micro-card for: bonds price.',
      context: { mastery: [{ c: 'duration', m: 0.78 }] },
      profileLabel: 'Propose micro-card',
    });
    expect(p).toContain('Propose a micro-card');
    expect(p).toContain('mastery');
    expect(p).toContain('duration');
  });

  test('includes context section header when context is non-empty', () => {
    const p = assemble({ userInput: 'x', context: { mastery: [] }, profileLabel: 'X' });
    expect(p).toMatch(/Learner Context/);
  });

  test('omits context section when empty', () => {
    const p = assemble({ userInput: 'x', context: {}, profileLabel: 'X' });
    expect(p).not.toMatch(/Learner Context/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/spine/promptAssembler.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
// src/main/brain/spine/promptAssembler.js
/**
 * Assemble the final prompt string sent to the provider.
 * Order: [profile header] → [learner context block] → [user input].
 * Deterministic for the same inputs (used as cache key).
 */
function assemble({ userInput, context, profileLabel }) {
  const parts = [];
  if (profileLabel) parts.push(`# ${profileLabel}\n`);
  const keys = Object.keys(context || {});
  if (keys.length > 0) {
    parts.push('## Learner Context');
    const sortedKeys = [...keys].sort();
    for (const k of sortedKeys) {
      parts.push(`### ${k}`);
      parts.push(JSON.stringify(context[k]));
    }
    parts.push('');
  }
  parts.push('## Task');
  parts.push(userInput);
  return parts.join('\n');
}

module.exports = assemble;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/spine/promptAssembler.test.js`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/spine/promptAssembler.js src/__tests__/spine/promptAssembler.test.js
git commit -m "feat(spine): deterministic prompt assembler"
```

---

## Task 17: brainCall — contract

**Files:**
- Create: `src/main/brain/spine/brainCall.js`

- [ ] **Step 1: Write the signature with all dispatch paths stubbed**

```js
// src/main/brain/spine/brainCall.js
/**
 * brainCall — primary spine entry.
 *
 * @param {string} intent
 * @param {string} input            — task description / user-facing prompt
 * @param {Object} [options]
 * @param {number} [options.userId=1]
 * @param {string} [options.triggerId]
 * @param {Object} [options.contextOverrides]  — slice → override object
 *
 * Returns: { output, callId, cacheHit }
 */
async function brainCall(intent, input, options = {}) {
  throw new Error('brainCall: not implemented');
}

module.exports = brainCall;
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "require('./src/main/brain/spine/brainCall.js'); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/main/brain/spine/brainCall.js
git commit -m "feat(spine): brainCall contract stub"
```

---

## Task 18: brainCall — TDD with mocked provider + ledger

**Files:**
- Create: `src/__tests__/spine/brainCall.test.js`
- Modify: `src/main/brain/spine/brainCall.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/spine/brainCall.test.js
jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInMain: {
    currentProvider: {
      name: 'deepseek-v3',
      generateContent: jest.fn().mockResolvedValue('plain text output'),
    },
  },
}));

jest.mock('../../commons/service/polyfills/structuredOutput', () => ({
  getStructured: jest.fn().mockResolvedValue({ foo: 'bar' }),
}));

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
}));

function freshDb() {
  const db = new Database(':memory:');
  const sql = fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8');
  db.exec(sql);
  return db;
}

beforeEach(() => { testDb = freshDb(); });
afterEach(() => { testDb.close(); });

const intents = require('../../main/brain/spine/intents');
const BrainContext = require('../../main/brain/spine/BrainContext');
const brainCall = require('../../main/brain/spine/brainCall');

// register a simple test intent + slice
intents.register('test-intent', {
  label: 'Test',
  contextSlices: ['simple'],
  costCeilingTokens: 2000,
  cachePolicy: 'content-hash',
});
BrainContext.registerSlice('simple', async () => ({ k: 'v' }));

describe('brainCall', () => {
  test('builds context, dispatches via provider, records ledger row', async () => {
    const { output, callId, cacheHit } = await brainCall('test-intent', 'do thing', { userId: 1 });
    expect(output).toBeDefined();
    expect(typeof callId).toBe('number');
    expect(cacheHit).toBe(false);
    const row = testDb.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.intent).toBe('test-intent');
    expect(row.provider).toBe('deepseek-v3');
    expect(row.cache_hit).toBe(0);
    expect(JSON.parse(row.context_keys)).toEqual(['simple']);
  });

  test('second call with same input hits cache', async () => {
    await brainCall('test-intent', 'same input', { userId: 1 });
    const second = await brainCall('test-intent', 'same input', { userId: 1 });
    expect(second.cacheHit).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/spine/brainCall.test.js`
Expected: FAIL — `not implemented`.

- [ ] **Step 3: Implement brainCall**

Replace the stub in `brainCall.js`:

```js
const crypto = require('crypto');
const intents = require('./intents');
const BrainContext = require('./BrainContext');
const assemble = require('./promptAssembler');
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');
const {
  instanceInMain: aiProviderManager,
} = require('../../../commons/service/AIProviderManager');
const {
  getStructured,
} = require('../../../commons/service/polyfills/structuredOutput');

function hashContent(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
}

function summarize(out) {
  if (out == null) return null;
  const s = typeof out === 'string' ? out : JSON.stringify(out);
  return s.length > 500 ? s.slice(0, 500) : s;
}

async function brainCall(intent, input, options = {}) {
  const userId = options.userId || 1;
  const profile = intents.resolve(intent);
  const context = await BrainContext.buildSlice(
    profile.contextSlices, userId, options.contextOverrides,
  );
  const prompt = assemble({
    userInput: input, context, profileLabel: profile.label,
  });

  // Ceiling check (soft — log a warning if exceeded, do not throw)
  const promptTokens = costEstimator.estimateTokens(prompt);
  if (promptTokens > profile.costCeilingTokens) {
    console.warn(
      `[brainCall] ${intent}: prompt ${promptTokens} tok exceeds ceiling ${profile.costCeilingTokens}`,
    );
  }

  // Cache lookup
  let cacheKey = null;
  if (profile.cachePolicy === 'content-hash') {
    cacheKey = hashContent(prompt);
    const hit = CallLedgerStore.findCacheHit(intent, cacheKey);
    if (hit) {
      const callId = CallLedgerStore.recordCacheHit({
        intent, cacheKey, triggerId: options.triggerId,
      });
      return { output: hit.output_json, callId, cacheHit: true };
    }
  }

  // Live dispatch
  const provider = aiProviderManager.currentProvider;
  const t0 = Date.now();
  // Schema resolution order: options.schema > profile.schema > none (plain text).
  // Most call sites pass the schema at the migration point so the seed
  // intents stay small; declaring schema on the intent profile is preferred
  // when the schema is stable across all callers.
  const dispatchSchema = options.schema || profile.schema;
  const output = dispatchSchema
    ? await getStructured(provider, prompt, dispatchSchema)
    : await provider.generateContent(prompt);
  const duration_ms = Date.now() - t0;
  const completion_tokens = costEstimator.estimateTokens(output);
  const cost_usd = costEstimator.estimate(provider.name, {
    prompt_tokens: promptTokens, completion_tokens,
  });

  const callId = CallLedgerStore.record({
    intent,
    ts: Date.now(),
    provider: provider.name,
    context_keys: Object.keys(context),
    prompt_tokens: promptTokens,
    completion_tokens,
    cost_usd,
    cache_hit: false,
    cache_key: cacheKey,
    duration_ms,
    trigger_id: options.triggerId || null,
    output_summary: summarize(output),
    output_json: output,
  });
  return { output, callId, cacheHit: false };
}

module.exports = brainCall;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/spine/brainCall.test.js`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/spine/brainCall.js src/__tests__/spine/brainCall.test.js
git commit -m "feat(spine): brainCall — context build + dispatch + ledger + cache"
```

---

## Task 19: meteredCall TDD

**Files:**
- Create: `src/main/brain/spine/meteredCall.js`
- Create: `src/__tests__/spine/meteredCall.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/spine/meteredCall.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({ getDb: () => testDb }));

beforeEach(() => {
  testDb = new Database(':memory:');
  testDb.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));
});
afterEach(() => { testDb.close(); });

const meteredCall = require('../../main/brain/spine/meteredCall');

describe('meteredCall', () => {
  test('records a ledger row tagged with intent=legacy:<label>', async () => {
    const provider = {
      name: 'qwen-plus',
      generateContent: jest.fn().mockResolvedValue('hello world'),
    };
    const { output, callId } = await meteredCall(provider, 'translate this', {
      legacyLabel: 'translate',
    });
    expect(output).toBe('hello world');
    const row = testDb.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.intent).toBe('legacy:translate');
    expect(row.provider).toBe('qwen-plus');
    expect(row.cache_hit).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/spine/meteredCall.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
// src/main/brain/spine/meteredCall.js
/**
 * meteredCall — passthrough spine entry for legacy / non-Brain LLM calls.
 *
 * Records cost telemetry to the Call Ledger. Does NOT inject BrainContext.
 * Intent tag is `legacy:<label>` so Economics Panel can group legacy traffic.
 */
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');

function summarize(out) {
  if (out == null) return null;
  const s = typeof out === 'string' ? out : JSON.stringify(out);
  return s.length > 500 ? s.slice(0, 500) : s;
}

async function meteredCall(provider, prompt, options = {}) {
  const label = options.legacyLabel || 'unknown';
  const t0 = Date.now();
  const output = await provider.generateContent(prompt);
  const duration_ms = Date.now() - t0;
  const prompt_tokens = costEstimator.estimateTokens(prompt);
  const completion_tokens = costEstimator.estimateTokens(output);
  const cost_usd = costEstimator.estimate(provider.name, { prompt_tokens, completion_tokens });
  const callId = CallLedgerStore.record({
    intent: `legacy:${label}`,
    ts: Date.now(),
    provider: provider.name,
    context_keys: [],
    prompt_tokens,
    completion_tokens,
    cost_usd,
    cache_hit: false,
    cache_key: null,
    duration_ms,
    trigger_id: options.triggerId || null,
    output_summary: summarize(output),
    output_json: typeof output === 'object' ? output : null,
  });
  return { output, callId };
}

module.exports = meteredCall;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/spine/meteredCall.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/spine/meteredCall.js src/__tests__/spine/meteredCall.test.js
git commit -m "feat(spine): meteredCall — passthrough recording for legacy LLM sites"
```

---

## Task 20: IPC handlers — Call Ledger reads

**Files:**
- Create: `src/main/ipc/callLedgerHandlers.js`
- Modify: `src/main/main.ts` (register handlers)

- [ ] **Step 1: Implement IPC handlers**

```js
// src/main/ipc/callLedgerHandlers.js
const { ipcMain } = require('electron');
const CallLedgerStore = require('../db/CallLedgerStore');

function register() {
  ipcMain.handle('callLedger:rationaleByTrigger', async (_e, triggerId) => {
    return CallLedgerStore.findByTriggerId(triggerId);
  });

  ipcMain.handle('callLedger:aggregateByIntent', async (_e, sinceMs) => {
    return CallLedgerStore.aggregateByIntent(sinceMs || 0);
  });

  ipcMain.handle('callLedger:aggregateByProvider', async (_e, sinceMs) => {
    return CallLedgerStore.aggregateByProvider(sinceMs || 0);
  });

  ipcMain.handle('callLedger:cacheHitRateByIntent', async (_e, sinceMs) => {
    const map = CallLedgerStore.cacheHitRateByIntent(sinceMs || 0);
    return Object.fromEntries(map);
  });
}

module.exports = { register };
```

- [ ] **Step 2: Wire into main bootstrap**

Open `src/main/main.ts` and find the block where other IPC handlers are registered (search for `require('./ipc/`). Add:

```ts
const callLedgerHandlers = require('./ipc/callLedgerHandlers');
callLedgerHandlers.register();
```

Place it near the other `*Handlers.register()` calls.

- [ ] **Step 3: Verify boot does not regress**

Run: `npm run test:smoke`
Expected: smoke passes (no crash patterns matched). If `test:smoke` is unavailable, run `npm run start:main` for 10s and check stderr is clean.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/callLedgerHandlers.js src/main/main.ts
git commit -m "feat(spine): IPC handlers for Call Ledger reads"
```

---

## Task 21: Renderer API client

**Files:**
- Create: `src/renderer/api/callLedgerApi.js`

- [ ] **Step 1: Implement**

```js
// src/renderer/api/callLedgerApi.js
/**
 * Renderer-side IPC client for the Call Ledger.
 *
 * Methods mirror the main-side handlers in callLedgerHandlers.js.
 */
const { ipcRenderer } = window.require ? window.require('electron') : require('electron');

const callLedgerApi = {
  rationaleByTrigger(triggerId) {
    return ipcRenderer.invoke('callLedger:rationaleByTrigger', triggerId);
  },
  aggregateByIntent(sinceMs) {
    return ipcRenderer.invoke('callLedger:aggregateByIntent', sinceMs);
  },
  aggregateByProvider(sinceMs) {
    return ipcRenderer.invoke('callLedger:aggregateByProvider', sinceMs);
  },
  cacheHitRateByIntent(sinceMs) {
    return ipcRenderer.invoke('callLedger:cacheHitRateByIntent', sinceMs);
  },
};

export default callLedgerApi;
```

- [ ] **Step 2: Verify the file imports cleanly**

Run: `npx jest --passWithNoTests --findRelatedTests src/renderer/api/callLedgerApi.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/api/callLedgerApi.js
git commit -m "feat(spine): renderer API client for Call Ledger"
```

---

## Task 22: Heartbeat prune wiring

**Files:**
- Modify: `src/main/brain/LearningBrainAgent.js`

- [ ] **Step 1: Locate runHeartbeat and add prune step**

Find `runHeartbeat` in `LearningBrainAgent.js`. At the end of the heartbeat body (after existing work, before `return` if any), add:

```js
// Phase 9 Spine: prune the Call Ledger nightly (idempotent if no rows due).
try {
  const lastPrune = this._lastSpinePruneTs || 0;
  const oneDay = 24 * 3600 * 1000;
  if (Date.now() - lastPrune > oneDay) {
    const CallLedgerStore = require('../db/CallLedgerStore');
    const dropped = CallLedgerStore.prune({
      maxAgeMs: 90 * oneDay,
      maxRows: 10000,
    });
    this._lastSpinePruneTs = Date.now();
    if (dropped > 0) console.log(`[spine] pruned ${dropped} ledger rows`);
  }
} catch (e) {
  console.warn('[spine] prune failed:', e.message);
}
```

- [ ] **Step 2: Smoke**

Run: `npm run test:smoke`
Expected: no errors; if your heartbeat interval is fast enough you should see at most one `[spine] pruned` line per 24h boot cycle.

- [ ] **Step 3: Commit**

```bash
git add src/main/brain/LearningBrainAgent.js
git commit -m "feat(spine): wire nightly Call Ledger prune into Brain heartbeat"
```

---

## Task 23: Barrel export + index

**Files:**
- Create: `src/main/brain/spine/index.js`

- [ ] **Step 1: Implement**

```js
// src/main/brain/spine/index.js
/**
 * Brain Spine — public surface used by Phase 0–8 services in later plans.
 */
module.exports = {
  brainCall: require('./brainCall'),
  meteredCall: require('./meteredCall'),
  intents: require('./intents'),
  tools: require('./tools'),
  BrainContext: require('./BrainContext'),
  costEstimator: require('./costEstimator'),
  // Side-effect imports to ensure all slices are registered when consumers
  // import the spine.
  _slices: [
    require('./slices/activeQuest'),
    require('./slices/currentBook'),
    require('./slices/recentEpisodes'),
    require('./slices/mastery'),
    require('./slices/recentComprehension'),
    require('./slices/acceptDismissPatterns'),
  ],
};
```

- [ ] **Step 2: Verify import works**

Run: `node -e "const s=require('./src/main/brain/spine'); console.log(Object.keys(s))"`
Expected: keys list including `brainCall`, `meteredCall`, `intents`, `tools`, `BrainContext`, `costEstimator`, `_slices`.

- [ ] **Step 3: Commit**

```bash
git add src/main/brain/spine/index.js
git commit -m "feat(spine): barrel export with eager slice registration"
```

---

## Task 24: End-to-end smoke test

**Files:**
- Create: `src/__tests__/integration/spine-end-to-end.test.js`

- [ ] **Step 1: Write the test**

```js
// src/__tests__/integration/spine-end-to-end.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({ getDb: () => testDb }));

jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInMain: {
    currentProvider: {
      name: 'deepseek-v3',
      generateContent: jest.fn().mockResolvedValue('OK'),
    },
  },
}));

jest.mock('../../commons/service/polyfills/structuredOutput', () => ({
  getStructured: jest.fn().mockResolvedValue({ proposed: 'duration' }),
}));

jest.mock('../../main/db/QuestStore', () => ({ getActive: jest.fn().mockResolvedValue(null) }));
jest.mock('../../main/brain/EpisodeCollector', () => ({ recent: jest.fn().mockResolvedValue([]) }));
jest.mock('../../main/db/LearningPointManager', () => ({ topNByMastery: jest.fn().mockResolvedValue([]) }));
jest.mock('../../main/utils/ComprehensionGradingService', () => ({ recentScores: jest.fn().mockResolvedValue([]) }));
jest.mock('../../main/brain/LearningBrainAgent', () => ({ getTriggerTelemetry: jest.fn().mockResolvedValue({ bySource: {} }) }));

beforeEach(() => {
  testDb = new Database(':memory:');
  testDb.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));
});
afterEach(() => { testDb.close(); });

const { brainCall, intents, BrainContext } = require('../../main/brain/spine');

describe('Spine end-to-end', () => {
  test('all 11 seed intents resolve and dispatch successfully', async () => {
    const names = intents.list();
    expect(names.length).toBeGreaterThanOrEqual(11);
    for (const intent of names) {
      const result = await brainCall(intent, 'smoke', {
        userId: 1,
        contextOverrides: { currentBook: { bookId: 1, chapterIndex: 0 } },
      });
      expect(result.callId).toBeGreaterThan(0);
    }
    const total = testDb.prepare('SELECT COUNT(*) AS c FROM brain_call_ledger').get().c;
    expect(total).toBe(names.length);
  });

  test('p95 spine overhead under 50ms (excluding provider time)', async () => {
    const durations = [];
    for (let i = 0; i < 20; i++) {
      const t = Date.now();
      await brainCall('extract-learning-points', `input ${i}`, { userId: 1 });
      durations.push(Date.now() - t);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    expect(p95).toBeLessThan(50);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest src/__tests__/integration/spine-end-to-end.test.js`
Expected: 2 PASS.

If the p95 test is flaky on slow CI, raise the bound to 100ms — but log a TODO to investigate.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/spine-end-to-end.test.js
git commit -m "test(spine): end-to-end smoke covering all seed intents + p95 overhead"
```

---

## Self-Review Notes

- **Spec coverage check:** Section 4.1 module layout — all files present (T2,T7,T8,T10,T11,T16,T17,T19,T20,T21). Section 4.2 sequence — implemented in T18. Section 5 components — all 7 covered. Section 6 surfaces — deferred to Plan B as expected. Section 7 migration steps 1 (foundation) — fully covered. Section 8 success criteria — p95 overhead test in T24; ≥30% cache hit-rate validated downstream when real intents run.
- **No placeholders.** Every step has concrete code or commands.
- **Type consistency:** `LedgerRow.context_keys` is `string[]` everywhere; `cache_hit` always boolean externally, integer 0/1 in SQL; `intent` is always a string.
- **One risk noted in T13:** `EpisodeCollector.recent` may need to be added to the existing collector — the task instructs verifying and adding a minimal method if missing. Same for `LearningPointManager.topNByMastery` and `ComprehensionGradingService.recentScores` in T14. These are tiny stub additions if absent.

---

**Done condition:** all 24 tasks landed, `npm test` green, `npm run test:smoke` clean. Spine is callable from any main-process module via `require('./brain/spine').brainCall(...)`. No existing LLM call site has been migrated yet — that's Plan B.
