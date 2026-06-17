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
