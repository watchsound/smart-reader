// src/__tests__/spine/CallLedgerStore.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Mock dbManager to point at an in-memory DB seeded from db.sql.
let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
}));

const CallLedgerStore = require('../../main/db/CallLedgerStore');

function freshDb() {
  const db = new Database(':memory:');
  const sql = fs
    .readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8')
    .split('\n')
    .filter((l) => !l.includes('"sqlite_sequence"'))
    .join('\n');
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
  test('inserts a row and returns its id', () => {
    const id = CallLedgerStore.record({
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

  test('missing optional numeric fields are stored as NULL', () => {
    const id = CallLedgerStore.record({
      intent: 'extract-learning-points',
      ts: 1718600000000,
      provider: 'deepseek-v3',
      // prompt_tokens, completion_tokens, cost_usd, duration_ms all omitted
      cache_hit: false,
    });
    const row = testDb.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(id);
    expect(row.prompt_tokens).toBeNull();
    expect(row.completion_tokens).toBeNull();
    expect(row.cost_usd).toBeNull();
    expect(row.duration_ms).toBeNull();
  });

  test('null output_json is stored as NULL (not the string "null")', () => {
    const id = CallLedgerStore.record({
      intent: 'x', ts: 1, provider: 'p', cache_hit: false,
      output_json: null,
    });
    const row = testDb.prepare('SELECT output_json FROM brain_call_ledger WHERE id = ?').get(id);
    expect(row.output_json).toBeNull();
  });

  test('missing context_keys defaults to "[]"', () => {
    const id = CallLedgerStore.record({
      intent: 'x', ts: 1, provider: 'p', cache_hit: false,
      // context_keys omitted
    });
    const row = testDb.prepare('SELECT context_keys FROM brain_call_ledger WHERE id = ?').get(id);
    expect(JSON.parse(row.context_keys)).toEqual([]);
  });
});

describe('CallLedgerStore cache lookup', () => {
  test('findCacheHit returns null when no row exists', () => {
    const hit = CallLedgerStore.findCacheHit('propose-microcard', 'nokey');
    expect(hit).toBeNull();
  });

  test('findCacheHit returns the most recent fresh row for (intent, cacheKey)', () => {
    CallLedgerStore.record({
      intent: 'propose-microcard',
      ts: 1000,
      provider: 'deepseek-v3',
      cache_key: 'k1',
      cache_hit: false,
      output_json: { v: 'old' },
    });
    CallLedgerStore.record({
      intent: 'propose-microcard',
      ts: 2000,
      provider: 'deepseek-v3',
      cache_key: 'k1',
      cache_hit: false,
      output_json: { v: 'new' },
    });
    const hit = CallLedgerStore.findCacheHit('propose-microcard', 'k1');
    expect(hit.output_json).toEqual({ v: 'new' });
  });

  test('findCacheHit ignores cache_hit rows', () => {
    CallLedgerStore.record({
      intent: 'x', ts: 1000, provider: 'p', cache_key: 'k', cache_hit: false, output_json: { v: 'fresh' },
    });
    CallLedgerStore.recordCacheHit({ intent: 'x', cacheKey: 'k', triggerId: null });
    const hit = CallLedgerStore.findCacheHit('x', 'k');
    expect(hit.output_json).toEqual({ v: 'fresh' });
    expect(hit.cache_hit).toBe(false);
  });
});

describe('CallLedgerStore.prune', () => {
  test('drops rows older than maxAgeMs', () => {
    const now = Date.now();
    CallLedgerStore.record({ intent: 'a', provider: 'p', ts: now - 100 * 24 * 3600 * 1000, cache_hit: false });
    CallLedgerStore.record({ intent: 'a', provider: 'p', ts: now - 10 * 24 * 3600 * 1000,  cache_hit: false });
    const dropped = CallLedgerStore.prune({ maxAgeMs: 90 * 24 * 3600 * 1000, maxRows: 10000 });
    expect(dropped).toBe(1);
    const remaining = testDb.prepare('SELECT COUNT(*) AS c FROM brain_call_ledger').get().c;
    expect(remaining).toBe(1);
  });

  test('drops oldest rows when count > maxRows', () => {
    // Use recent base timestamp so age-based eviction does not fire;
    // only the row-count path should prune here.
    const base = Date.now() - 5 * 24 * 3600 * 1000; // 5 days ago (within 90-day window)
    for (let i = 0; i < 15; i++) {
      CallLedgerStore.record({ intent: 'a', provider: 'p', ts: base + i, cache_hit: false });
    }
    const dropped = CallLedgerStore.prune({ maxAgeMs: 90 * 24 * 3600 * 1000, maxRows: 10 });
    expect(dropped).toBe(5);
    const remaining = testDb.prepare('SELECT COUNT(*) AS c FROM brain_call_ledger').get().c;
    expect(remaining).toBe(10);
    const minTs = testDb.prepare('SELECT MIN(ts) AS m FROM brain_call_ledger').get().m;
    expect(minTs).toBe(base + 5); // oldest 5 (base+0..base+4) dropped
  });
});

describe('CallLedgerStore aggregations', () => {
  beforeEach(() => {
    const seed = [
      { intent: 'a', provider: 'deepseek-v3', cost_usd: 0.01, cache_hit: false, ts: 1000 },
      { intent: 'a', provider: 'deepseek-v3', cost_usd: 0.02, cache_hit: false, ts: 2000 },
      { intent: 'a', provider: 'qwen', cost_usd: 0.03, cache_hit: false, ts: 3000 },
      { intent: 'b', provider: 'deepseek-v3', cost_usd: 0.04, cache_hit: false, ts: 4000 },
      { intent: 'a', provider: 'deepseek-v3', cost_usd: 0,    cache_hit: true,  ts: 5000 },
    ];
    for (const r of seed) CallLedgerStore.record(r);
  });

  test('aggregateByIntent sums cost and counts fresh calls', () => {
    const rows = CallLedgerStore.aggregateByIntent(0);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.a.call_count).toBe(3);
    expect(byKey.a.total_cost_usd).toBeCloseTo(0.06, 5);
    expect(byKey.a.cache_hits).toBe(1);
    expect(byKey.b.call_count).toBe(1);
  });

  test('aggregateByProvider sums per provider', () => {
    const rows = CallLedgerStore.aggregateByProvider(0);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey['deepseek-v3'].call_count).toBe(3);
    expect(byKey['qwen'].call_count).toBe(1);
  });

  test('cacheHitRateByIntent returns ratio per intent', () => {
    const map = CallLedgerStore.cacheHitRateByIntent(0);
    expect(map.get('a')).toBeCloseTo(0.25, 5); // 1 hit / 4 total for intent a
  });

  test('findByTriggerId returns the most recent row for that trigger', () => {
    CallLedgerStore.record({ intent: 'x', provider: 'p', ts: 100, cache_hit: false, trigger_id: 'T1', output_summary: 'first' });
    CallLedgerStore.record({ intent: 'x', provider: 'p', ts: 200, cache_hit: false, trigger_id: 'T1', output_summary: 'second' });
    const row = CallLedgerStore.findByTriggerId('T1');
    expect(row.output_summary).toBe('second');
  });
});
