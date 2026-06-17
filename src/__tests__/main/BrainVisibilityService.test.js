// src/__tests__/main/BrainVisibilityService.test.js
/**
 * Tests for BrainVisibilityService.getDashboard aggregation.
 * Uses an in-memory SQLite database seeded from db.sql.
 *
 * NOTE: better-sqlite3 must be built against the current Node ABI.
 * If tests fail with ERR_DLOPEN_FAILED, run:
 *   npm rebuild better-sqlite3 --build-from-source
 * or use `npm run test:integration` which does this automatically.
 */

const fs = require('fs');
const path = require('path');

// Probe for a working better-sqlite3 binary before running anything.
let Database = null;
let sqliteLoadError = null;
try {
  // eslint-disable-next-line global-require
  Database = require('better-sqlite3');
  const probe = new Database(':memory:');
  probe.close();
} catch (err) {
  sqliteLoadError = err;
  Database = null;
}

jest.mock('../../main/db/dbManager', () => {
  let db;
  return {
    getDb: () => db,
    __setDb: (next) => { db = next; },
    default: null,
  };
});

const dbManager = require('../../main/db/dbManager');
const BrainVisibilityService = require('../../main/utils/BrainVisibilityService');
const CallLedgerStore = require('../../main/db/CallLedgerStore');
const AISessionStore = require('../../main/db/AISessionStore');

const DB_SQL_PATH = path.join(__dirname, '..', '..', '..', 'db.sql');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(DB_SQL_PATH, 'utf8'));
  // Seed a user row so NOT NULL FKs are satisfied.
  db.prepare(
    "INSERT OR IGNORE INTO user (id, username, email) VALUES (1, 'test', 'test@example.com')",
  ).run();
  dbManager.__setDb(db);
  return db;
}

// Skip all tests if the SQLite binary isn't available for the current Node ABI.
const testFn = sqliteLoadError ? test.skip : test;

if (sqliteLoadError) {
  test.skip(
    `skipped — better-sqlite3 not available for Node ABI: ${sqliteLoadError && sqliteLoadError.message}`,
    () => {},
  );
}

testFn('getDashboard returns mastery + timeline + sessions + topConcepts', async () => {
  const db = freshDb();

  // Seed 2 learning points.
  // learning_point.id is TEXT PRIMARY KEY; front/back are the content columns (no "content" column).
  // created_at is NOT NULL with no default so must be provided explicitly.
  db.prepare(`
    INSERT INTO learning_point
      (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at)
    VALUES
      ('lp-1', 1, 'vocabulary', 'parse', '{"text":"p"}', '{"text":"p"}', 'book', 1, 25, datetime('now')),
      ('lp-2', 1, 'concept', 'lexer', '{"text":"l"}', '{"text":"l"}', 'book', 2, 60, datetime('now'))
  `).run();

  // Seed a ledger row within the 7d window.
  const now = Date.now();
  CallLedgerStore.record({
    intent: 'director-session-step',
    ts: now - 86400000,
    provider: 'deepseek',
    context_keys: [],
    prompt_tokens: 100,
    completion_tokens: 50,
    cost_usd: 0.001,
    cache_hit: false,
    cache_key: null,
    duration_ms: 200,
    trigger_id: null,
    output_summary: 's',
    output_json: null,
    trace_id: 'tr-1',
  });

  // learning_point.id is the TEXT literal we inserted above.
  const lp = { id: 'lp-1' };
  AISessionStore.persistCompleted({
    id: 'sess-1',
    userId: 1,
    questId: null,
    goal: 'Review weak',
    traceId: 'tr-1',
    status: 'completed',
    iteration: 3,
    budget: 12,
    startedAt: now - 86400000,
    endedAt: now - 86000000,
    errorReason: null,
    trace: [
      {
        iteration: 0,
        kind: 'tool',
        payload: { tool: 'openLeitnerCard', args: { learningPointId: lp.id } },
        ts: now - 86400000,
      },
    ],
  });

  const r = await BrainVisibilityService.getDashboard({ window: '7d', userId: 1 });

  expect(r.mastery.length).toBeGreaterThan(0);
  expect(r.mastery.some(m => m.domain === 'vocabulary' && m.box === 1)).toBe(true);
  expect(r.timeline.length).toBeGreaterThan(0);
  expect(r.sessions).toHaveLength(1);
  expect(r.sessions[0].id).toBe('sess-1');
  expect(r.sessions[0].totalCost).toBeCloseTo(0.001);
  expect(r.topConcepts[0].id).toBe('lp-1');
  expect(r.topConcepts[0].decisionCount).toBe(1);
});

testFn('window filters: 7d excludes a session from 30d ago', async () => {
  freshDb();

  const old = Date.now() - 30 * 86400000;
  AISessionStore.persistCompleted({
    id: 's-old',
    userId: 1,
    questId: null,
    goal: 'g',
    traceId: 't-old',
    status: 'completed',
    iteration: 1,
    budget: 12,
    startedAt: old,
    endedAt: old + 1000,
    errorReason: null,
    trace: [],
  });

  const r7 = await BrainVisibilityService.getDashboard({ window: '7d', userId: 1 });
  const r90 = await BrainVisibilityService.getDashboard({ window: '90d', userId: 1 });

  expect(r7.sessions).toHaveLength(0);
  expect(r90.sessions).toHaveLength(1);
});
