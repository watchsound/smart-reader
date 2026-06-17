// src/__tests__/integration/sessionRunnerHappyPath.test.js
//
// Integration test: full happy-path Study Session.
// Exercises tool registration → SessionRunner orchestration →
// AISessionStore persistence on a real :memory: SQLite instance.

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Must mock brainCall BEFORE requiring Director — Director imports it at module
// level and would crash without a real Electron / DB bootstrap.
jest.mock('../../main/brain/spine/brainCall', () => jest.fn());

// dbManager mock with a swappable db instance (same pattern as spine-end-to-end).
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

const tools = require('../../main/brain/spine/tools');
const Director = require('../../main/brain/director/Director');
const SessionRunner = require('../../main/brain/director/SessionRunner');
const AISessionStore = require('../../main/db/AISessionStore');

// Load the real endSession tool registration (registers into the real tools module).
require('../../main/brain/director/tools/endSession');

let currentDb;
beforeEach(() => {
  currentDb = freshDb();
  // Clear any fake tools registered from a prior test run; keep the real ones.
  // We'll just re-register fakes — tools.register is idempotent (overwrites).
});
afterEach(() => {
  currentDb.close();
});

test('full session: 1 read + 1 surface + 1 soft-write + endSession persists to ai_sessions', async () => {
  // Register fake tools for this test
  tools.register('fakeRead', { kind: 'read', description: 'fake read', argsSchema: {} });
  tools.registerHandler('fakeRead', async () => ({ data: 'read-result' }));

  tools.register('fakeSurface', { kind: 'surface', description: 'fake surface', argsSchema: {} });
  tools.registerHandler('fakeSurface', async (a, ctx) => ctx.awaitUserResult({ tool: 'fakeSurface', args: a }));

  tools.register('fakeWrite', { kind: 'soft-write', description: 'fake write', argsSchema: {} });
  tools.registerHandler('fakeWrite', async () => ({ callId: 1 }));

  // Pre-queue Director decisions — one per iteration, ending with endSession.
  const decisions = [
    { tool: 'fakeRead',    args: {},           reasoning: 'read' },
    { tool: 'fakeSurface', args: { x: 1 },     reasoning: 'surface' },
    { tool: 'fakeWrite',   args: {},           reasoning: 'write' },
    { tool: 'endSession',  args: { reason: 'done' }, reasoning: 'end' },
  ];
  jest.spyOn(Director, 'step').mockImplementation(async () => decisions.shift());

  // Wrap AISessionStore.persistCompleted so we can assert it was called AND
  // still write through to the real :memory: DB.
  const persisted = jest.fn(state => AISessionStore.persistCompleted(state));

  const store = {
    saveActive:       jest.fn(),
    loadActive:       jest.fn(),
    clearActive:      jest.fn(),
    persistCompleted: persisted,
  };

  const runner = new SessionRunner({ store, director: Director, broadcast: jest.fn() });
  const { sessionId } = await runner.start({ userId: 1, goal: 'Integration test' });

  // Provide user response for the surface step after a short delay.
  setTimeout(() => runner.userResult(sessionId, { rating: 'good' }), 40);

  await runner.waitForCompletion(sessionId);

  // 1. persistCompleted wrapper was called
  expect(persisted).toHaveBeenCalled();

  // 2. Session row written to ai_sessions
  const list = AISessionStore.listByUser(1);
  expect(list).toHaveLength(1);
  expect(list[0].goal).toBe('Integration test');

  // 3. Trace events written — at minimum:
  //    thought + tool + observation (read)
  //    thought + tool + surface + observation (surface)
  //    thought + tool + soft-write (write)
  //    thought + tool + end
  const trace = AISessionStore.getTrace(sessionId);
  expect(trace.length).toBeGreaterThanOrEqual(6);

  // Sanity-check that each expected kind appears at least once.
  const kinds = trace.map(e => e.kind);
  expect(kinds).toContain('thought');
  expect(kinds).toContain('observation');
  expect(kinds).toContain('surface');
  expect(kinds).toContain('soft-write');
  expect(kinds).toContain('end');
});
