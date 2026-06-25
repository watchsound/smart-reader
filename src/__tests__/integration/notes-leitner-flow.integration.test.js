/**
 * notes-leitner-flow.integration.test.js
 *
 * End-to-end integration: add note → mirror → load via getDueItems →
 * processReview → next-state assertions. All against a REAL in-memory
 * SQLite with the real `learning_point`, `note`, and `leitner_item`
 * schemas — no DB mocks.
 *
 * Every bug that hit during the 2026-06-25 notes-leitner debug session
 * lived in the wiring between layers (the algorithm itself is well
 * unit-tested). The unit tests use mocked db.prepare and so couldn't
 * catch:
 *   - sync race between fire-and-forget mirror and the renderer's
 *     post-dispatch refresh
 *   - `next_review = today + 1 day` hiding fresh mirrors
 *   - tab-label / fetcher swap in NotesLeitnerListView
 *   - blank-card render because card.id ≠ note.id
 *   - missing backfill of pre-existing notes
 *
 * This file exercises the data path of the same flow so future
 * regressions surface in CI rather than the user's lap.
 *
 * Mocking policy:
 *   - electron       MOCK (app.getPath, ipcMain.handle stubs)
 *   - dbManager      REAL (better-sqlite3 :memory:)
 *   - LearningPointManager  REAL (init creates schema on import)
 *   - LeitnerItemManager    REAL
 *   - NoteJsonManager       REAL (subject under test)
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/tmp/test-userData') },
  ipcMain: { handle: jest.fn(), on: jest.fn() },
}));

// Probe better-sqlite3 inside the mock factory so we degrade to skip
// instead of failing if the binary isn't loadable in system Node ABI.
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
let NoteJsonManager;
let RATINGS;
if (testDB) {
  // Loading LearningPointManager runs initLearningPointTable() against
  // the test DB, creating the schema we need.
  // eslint-disable-next-line global-require
  LearningPointManager = require('../../main/db/LearningPointManager');
  // eslint-disable-next-line global-require
  NoteJsonManager = require('../../main/db/NoteJsonManager');
  RATINGS = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };
}

if (!testDB) {
  // eslint-disable-next-line no-console
  console.warn(
    `[notes-leitner-flow.integration] better-sqlite3 unavailable (${
      sqliteLoadError?.message || 'unknown'
    }); skipping. Run via 'npm run test:integration' which rebuilds the binary.`,
  );
}

// -----------------------------------------------------------------------------
// Schema bootstrap — note + leitner_item are not auto-initialized like
// learning_point. Mirror the db.sql definitions verbatim.
// -----------------------------------------------------------------------------

function initNoteAndLeitnerSchemas() {
  testDB.exec(`
    CREATE TABLE IF NOT EXISTS "note" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "data" TEXT,
      "leitner_item_id" INTEGER,
      "created_at" TEXT,
      "user_id" INTEGER
    );
    CREATE TABLE IF NOT EXISTS "leitner_item" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "type" INTEGER,
      "box" INTEGER,
      "skips" INTEGER,
      "flips" INTEGER,
      "next_review" TEXT,
      "fully_learned" INTEGER,
      "score" INTEGER
    );
  `);
}

function insertNote({ id, title, cards }) {
  const data = JSON.stringify({ title, cards });
  if (id != null) {
    testDB
      .prepare(
        `INSERT INTO note (id, data, leitner_item_id, created_at, user_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, data, 0, new Date().toISOString(), USER_ID);
    return id;
  }
  const r = testDB
    .prepare(
      `INSERT INTO note (data, leitner_item_id, created_at, user_id)
       VALUES (?, ?, ?, ?)`,
    )
    .run(data, 0, new Date().toISOString(), USER_ID);
  return r.lastInsertRowid;
}

function getMirrorRow(noteId) {
  return testDB
    .prepare(
      `SELECT * FROM learning_point
       WHERE user_id = ? AND source_type = 'note' AND source_id = ?`,
    )
    .get(USER_ID, String(noteId));
}

function countMirrors(noteId) {
  return testDB
    .prepare(
      `SELECT COUNT(*) AS n FROM learning_point
       WHERE user_id = ? AND source_type = 'note' AND source_id = ?`,
    )
    .get(USER_ID, String(noteId)).n;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// Lifecycle — reinit schemas between tests so each starts clean.
// -----------------------------------------------------------------------------

beforeAll(() => {
  if (!testDB) return;
  // learning_point schema was created when LearningPointManager was
  // required at the top of the file (it runs initLearningPointTable).
  // note + leitner_item we own.
  initNoteAndLeitnerSchemas();
});

beforeEach(() => {
  if (!testDB) return;
  // Cleanup AFTER schemas exist — first iteration was failing because
  // the DELETE ran before the CREATE.
  testDB.exec(`
    DELETE FROM learning_point;
    DELETE FROM note;
    DELETE FROM leitner_item;
  `);
});

afterAll(() => {
  if (testDB) testDB.close();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describeIfDB('notes → Leitner flow: end-to-end', () => {
  describe('mirror creates a due row', () => {
    test('addNoteToLeitnerStudy inserts a learning_point with next_review=today', () => {
      const noteId = insertNote({
        title: 'Closures',
        cards: [
          { text: 'What is a closure?' },
          { text: 'A function plus its lexical scope.' },
        ],
      });

      const result = NoteJsonManager.addNoteToLeitnerStudy(
        noteId,
        SESSION_TOKEN,
      );

      expect(result).toMatchObject({ wasAlreadyAdded: false });

      const mirror = getMirrorRow(noteId);
      expect(mirror).toBeDefined();
      expect(mirror.source_type).toBe('note');
      expect(mirror.source_id).toBe(String(noteId));
      expect(mirror.status).toBe('active');
      expect(mirror.box).toBe(1);
      // next_review must be today (or earlier) so the row is immediately
      // due — the original bug was today+1.
      expect(mirror.next_review.slice(0, 10) <= todayString()).toBe(true);
    });
  });

  describe('LearningPointManager.getDueItems surfaces the mirror', () => {
    test('a freshly added note appears in getDueItems', () => {
      const noteId = insertNote({
        title: 'Promises',
        cards: [{ text: 'What is a Promise?' }, { text: 'A future value.' }],
      });

      NoteJsonManager.addNoteToLeitnerStudy(noteId, SESSION_TOKEN);

      const due = LearningPointManager.getDueItems({
        token: SESSION_TOKEN,
        limit: 50,
      });
      const ours = due.find(
        (lp) => lp.source_type === 'note' && lp.source_id === String(noteId),
      );
      expect(ours).toBeDefined();
      expect(ours.title).toBe('Promises');
    });
  });

  describe('processReview drives state correctly', () => {
    test('GOOD review advances box and pushes next_review out', () => {
      const noteId = insertNote({
        title: 'Iterators',
        cards: [{ text: 'iterator?' }, { text: 'Stateful traversal.' }],
      });
      NoteJsonManager.addNoteToLeitnerStudy(noteId, SESSION_TOKEN);
      const lpId = getMirrorRow(noteId).id;

      const result = LearningPointManager.processReview(
        lpId,
        RATINGS.GOOD,
        1500,
        SESSION_TOKEN,
      );

      expect(result.success).toBe(true);
      expect(result.newBox).toBe(2);
      expect(result.correctStreak).toBe(1);

      const after = testDB
        .prepare(`SELECT box, next_review FROM learning_point WHERE id = ?`)
        .get(lpId);
      expect(after.box).toBe(2);
      // box-2 interval is 2 days — assert next_review is now strictly
      // in the future, regardless of exact day math.
      expect(after.next_review.slice(0, 10) > todayString()).toBe(true);
    });

    test('AGAIN review resets box to 1 and zeroes the streak', () => {
      const noteId = insertNote({
        title: 'Generators',
        cards: [{ text: 'g?' }, { text: 'pause/resume.' }],
      });
      NoteJsonManager.addNoteToLeitnerStudy(noteId, SESSION_TOKEN);
      const lpId = getMirrorRow(noteId).id;

      // Advance once so we have something to reset.
      LearningPointManager.processReview(
        lpId,
        RATINGS.GOOD,
        1000,
        SESSION_TOKEN,
      );
      // Now fail.
      const reset = LearningPointManager.processReview(
        lpId,
        RATINGS.AGAIN,
        1000,
        SESSION_TOKEN,
      );

      expect(reset.newBox).toBe(1);
      expect(reset.correctStreak).toBe(0);

      const after = testDB
        .prepare(`SELECT box, correct_streak FROM learning_point WHERE id = ?`)
        .get(lpId);
      expect(after.box).toBe(1);
      expect(after.correct_streak).toBe(0);
    });
  });

  describe('idempotency: re-add', () => {
    test('calling addNoteToLeitnerStudy twice yields exactly one learning_point', () => {
      const noteId = insertNote({
        title: 'Reflect',
        cards: [{ text: 'r?' }, { text: 'meta-programming API.' }],
      });

      const first = NoteJsonManager.addNoteToLeitnerStudy(
        noteId,
        SESSION_TOKEN,
      );
      const second = NoteJsonManager.addNoteToLeitnerStudy(
        noteId,
        SESSION_TOKEN,
      );

      expect(first).toMatchObject({ wasAlreadyAdded: false });
      expect(second).toMatchObject({ wasAlreadyAdded: true });
      expect(countMirrors(noteId)).toBe(1);
    });
  });

  describe('backfill: re-add fills the mirror for pre-existing notes', () => {
    test('note with leitner_item_id but no learning_point gets mirrored on re-add', () => {
      // Simulate a note added before the mirror landed: it has a
      // leitner_item_id but no learning_point row.
      const li = testDB
        .prepare(
          `INSERT INTO leitner_item (type, box, skips, flips, next_review, fully_learned, score)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(1, 1, 0, 0, '', 0, 0);
      const noteId = insertNote({
        title: 'Pre-mirror note',
        cards: [{ text: 'q' }, { text: 'a' }],
      });
      testDB
        .prepare(`UPDATE note SET leitner_item_id = ? WHERE id = ?`)
        .run(li.lastInsertRowid, noteId);

      expect(countMirrors(noteId)).toBe(0); // baseline: no mirror

      const result = NoteJsonManager.addNoteToLeitnerStudy(
        noteId,
        SESSION_TOKEN,
      );

      expect(result).toMatchObject({ wasAlreadyAdded: true });
      expect(countMirrors(noteId)).toBe(1);
    });
  });

  describe('two notes → two distinct rows', () => {
    test('separate notes mirror to separate learning_point rows', () => {
      const a = insertNote({ title: 'A', cards: [{ text: 'a' }] });
      const b = insertNote({ title: 'B', cards: [{ text: 'b' }] });

      NoteJsonManager.addNoteToLeitnerStudy(a, SESSION_TOKEN);
      NoteJsonManager.addNoteToLeitnerStudy(b, SESSION_TOKEN);

      const ma = getMirrorRow(a);
      const mb = getMirrorRow(b);
      expect(ma).toBeDefined();
      expect(mb).toBeDefined();
      expect(ma.id).not.toBe(mb.id);
      expect(ma.source_id).toBe(String(a));
      expect(mb.source_id).toBe(String(b));
    });
  });
});
