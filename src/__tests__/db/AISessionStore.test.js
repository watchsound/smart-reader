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
