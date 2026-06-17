// src/__tests__/integration/brainVisibilityHappyPath.test.js
//
// Integration test: full seed → BrainVisibilityService query chain.
// Verifies the dashboard aggregation (sessions, topConcepts) and the
// concept inspector (meta, lineage, costToDate) against a real :memory: SQLite
// populated from db.sql.

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
  // Filter sqlite_sequence DDL — :memory: doesn't need it and it causes errors.
  const sql = fs
    .readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8')
    .split('\n')
    .filter((l) => !l.includes('"sqlite_sequence"'))
    .join('\n');
  db.exec(sql);
  dbManager.__setDb(db);
  return db;
}

const CallLedgerStore = require('../../main/db/CallLedgerStore');
const AISessionStore = require('../../main/db/AISessionStore');
const BrainVisibilityService = require('../../main/utils/BrainVisibilityService');

test('end-to-end: completed session shows in dashboard + concept inspector', async () => {
  freshDb();
  // Seed a learning point (text id; front/back JSON columns; created_at NOT NULL)
  const db = dbManager.getDb();
  // Seed a user row so the learning_point FK is satisfied when FK enforcement is on.
  db.prepare(`
    INSERT OR IGNORE INTO user (id, username, email, status) VALUES (1, 'tester', 'tester@example.com', 1)
  `).run();
  db.prepare(`
    INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, source_id, box, mastery_level, next_review, created_at, updated_at)
    VALUES ('lp-1', 1, 'vocabulary', 'parse', '{"text":"parse"}', '{"text":"analyze"}', 'book', 'p-1', 1, 25, '2026-06-25', datetime('now'), datetime('now'))
  `).run();
  // Record a session + ledger
  const now = Date.now();
  CallLedgerStore.record({
    intent: 'director-session-step', ts: now, provider: 'deepseek',
    context_keys: [], prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.002,
    cache_hit: false, cache_key: null, duration_ms: 200, trigger_id: null,
    output_summary: 's', output_json: null, trace_id: 'tr-ZZZ',
  });
  AISessionStore.persistCompleted({
    id: 'sess-ZZZ', userId: 1, questId: null, goal: 'Master parse',
    traceId: 'tr-ZZZ', status: 'completed', iteration: 1, budget: 12,
    startedAt: now, endedAt: now + 1000, errorReason: null,
    trace: [
      { iteration: 0, kind: 'tool', payload: { tool: 'openLeitnerCard', args: { learningPointId: 'lp-1' } }, ts: now },
    ],
  });

  const dash = await BrainVisibilityService.getDashboard({ window: '7d', userId: 1 });
  expect(dash.sessions[0].id).toBe('sess-ZZZ');
  expect(dash.topConcepts[0].id).toBe('lp-1');
  expect(dash.topConcepts[0].decisionCount).toBe(1);

  const concept = await BrainVisibilityService.getConcept({ learningPointId: 'lp-1', userId: 1 });
  expect(concept.meta.title).toBe('parse');
  expect(concept.lineage.some(e => e.kind === 'brain-decision' && e.sessionId === 'sess-ZZZ')).toBe(true);
  expect(concept.costToDate).toBeCloseTo(0.002);
});
