/**
 * learningPointService-contract.integration.test.js
 *
 * Round-trip the LearningPointManager API against real :memory: SQLite to
 * guarantee values that the API claims to accept actually persist.
 *
 * Specifically defends the bug fixed earlier this session: the SQL layer
 * was silently dropping `point.nextReview` and always recomputing it via
 * calculateNextReview(1). The unit tests for that path mock db.prepare,
 * so they verify "we passed the right arg to .run()" — not "the row in
 * SQLite actually has the value." A future refactor (or a downstream
 * service migration) that re-introduces the override needs to fail here.
 *
 * Why "service-contract" in the name even though we exercise the manager:
 * the service layer (LearningPointService.createLearningPoint) is thin
 * normalization that delegates straight through graphInterface →
 * SqliteAdapter → LearningPointManager. Asserting against the manager
 * with real SQLite covers the bottom of the stack where the bug lived.
 * If we ever wire the service into integration here we just swap the
 * sut import.
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/tmp/test-userData') },
  ipcMain: { handle: jest.fn(), on: jest.fn() },
}));

let testDB = null;
let sqliteLoadError = null;
try {
  // eslint-disable-next-line global-require
  const Database = require('better-sqlite3');
  testDB = new Database(':memory:');
} catch (err) {
  sqliteLoadError = err;
}

const SESSION_TOKEN = 'test-session-token';
const USER_ID = 1;

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: testDB || { prepare: () => ({}), exec: () => {} },
  getUserIdFromToken: jest.fn((token) =>
    token === SESSION_TOKEN ? USER_ID : -1,
  ),
  addUserIdCreatedAt: (obj, userId) => {
    obj.userId = userId;
    obj.createdAt = new Date().toISOString();
    return obj;
  },
}));

const describeIfDB = testDB ? describe : describe.skip;

let LearningPointManager;
if (testDB) {
  // eslint-disable-next-line global-require
  LearningPointManager = require('../../main/db/LearningPointManager');
}

if (!testDB) {
  // eslint-disable-next-line no-console
  console.warn(
    `[learningPointService-contract.integration] better-sqlite3 unavailable (${
      sqliteLoadError?.message || 'unknown'
    }); skipping. Run via 'npm run test:integration'.`,
  );
}

beforeEach(() => {
  if (!testDB) return;
  testDB.exec(`DELETE FROM learning_point;`);
});

afterAll(() => {
  if (testDB) testDB.close();
});

function getRow(id) {
  return testDB
    .prepare(`SELECT * FROM learning_point WHERE id = ?`)
    .get(id);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describeIfDB('LearningPointManager contract (real SQLite)', () => {
  describe('createLearningPoint — nextReview override', () => {
    test('persists an explicit point.nextReview verbatim', () => {
      const created = LearningPointManager.createLearningPoint(
        {
          title: 'Honor my date',
          front: 'q',
          back: 'a',
          nextReview: '2026-06-25',
        },
        SESSION_TOKEN,
      );
      expect(created.error).toBeUndefined();

      const row = getRow(created.id);
      expect(row.next_review).toBe('2026-06-25');
    });

    test('falls back to the box-1 default when nextReview omitted', () => {
      const created = LearningPointManager.createLearningPoint(
        { title: 'Default', front: 'q', back: 'a' },
        SESSION_TOKEN,
      );
      expect(created.error).toBeUndefined();

      const row = getRow(created.id);
      // Default is today + BOX_INTERVALS[1] days. We don't pin the
      // exact value (interval table may evolve); just assert it's a
      // valid date string and not the today-immediate value (which the
      // override path produces).
      expect(row.next_review).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(row.next_review).not.toBe(todayString());
    });
  });

  describe('createLearningPointsBatch — per-item nextReview override', () => {
    test('persists per-item overrides while applying defaults to others', () => {
      const result = LearningPointManager.createLearningPointsBatch(
        [
          { title: 'A', front: 'qa', back: 'aa', nextReview: '2026-06-25' },
          { title: 'B', front: 'qb', back: 'ab' /* default */ },
        ],
        SESSION_TOKEN,
      );

      expect(result.created).toBe(2);
      expect(result.errors.length).toBe(0);

      const rows = testDB
        .prepare(`SELECT title, next_review FROM learning_point ORDER BY title`)
        .all();
      expect(rows).toHaveLength(2);
      const byTitle = Object.fromEntries(
        rows.map((r) => [r.title, r.next_review]),
      );
      expect(byTitle.A).toBe('2026-06-25');
      expect(byTitle.B).not.toBe('2026-06-25');
      expect(byTitle.B).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('getDueItems — date semantics', () => {
    test('includes rows with next_review = today (immediately due)', () => {
      const today = todayString();
      LearningPointManager.createLearningPoint(
        { title: 'due-today', front: 'q', back: 'a', nextReview: today },
        SESSION_TOKEN,
      );

      const due = LearningPointManager.getDueItems({
        token: SESSION_TOKEN,
        limit: 50,
      });
      expect(due.some((r) => r.title === 'due-today')).toBe(true);
    });

    test('excludes rows whose next_review is in the future', () => {
      LearningPointManager.createLearningPoint(
        {
          title: 'due-tomorrow',
          front: 'q',
          back: 'a',
          nextReview: tomorrowString(),
        },
        SESSION_TOKEN,
      );

      const due = LearningPointManager.getDueItems({
        token: SESSION_TOKEN,
        limit: 50,
      });
      expect(due.some((r) => r.title === 'due-tomorrow')).toBe(false);
    });
  });
});
