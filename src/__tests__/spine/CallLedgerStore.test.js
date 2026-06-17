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
