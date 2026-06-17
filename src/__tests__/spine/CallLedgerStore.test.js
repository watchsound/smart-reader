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
