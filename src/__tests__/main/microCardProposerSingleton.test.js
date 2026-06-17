// src/__tests__/main/microCardProposerSingleton.test.js
/**
 * Tests for the real commit/delete implementation in microCardProposerSingleton.
 * Uses an in-memory SQLite database seeded from db.sql to verify actual writes.
 *
 * NOTE: better-sqlite3 is compiled against Electron's Node ABI. Running this
 * test suite requires the binary to be rebuilt against system Node first:
 *
 *   npm rebuild better-sqlite3 --build-from-source
 *
 * The `npm run test:integration` script does this automatically. Running via
 * plain `npx jest` on a dev machine that has only the Electron binary will
 * cause these tests to be skipped with a diagnostic message.
 */
const fs = require('fs');
const path = require('path');

// Probe for a working better-sqlite3 binary before running anything.
let Database = null;
let sqliteLoadError = null;
try {
  // eslint-disable-next-line global-require
  Database = require('better-sqlite3');
  // Verify the binary actually works at current Node ABI.
  const probe = new Database(':memory:');
  probe.close();
} catch (err) {
  sqliteLoadError = err;
  Database = null;
}

// Mock dbManager so the singleton uses our in-memory DB, not the Electron DB.
jest.mock('../../main/db/dbManager', () => {
  let db;
  return {
    getDb: () => db,
    __setDb: (next) => { db = next; },
    default: null,
  };
});

// Prevent MicroCardProposer (ES module, needs Electron context) from loading.
jest.mock('../../main/utils/MicroCardProposer', () => ({
  default: { getChapterState: null },
}));

const dbManager = require('../../main/db/dbManager');

// Re-require singleton AFTER mocks are in place.
let singleton;
beforeAll(() => {
  singleton = require('../../main/utils/microCardProposerSingleton');
});

const DB_SQL_PATH = path.join(__dirname, '..', '..', '..', 'db.sql');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(DB_SQL_PATH, 'utf8'));
  // Seed a user row so the NOT NULL FK is satisfied.
  db.prepare(
    "INSERT OR IGNORE INTO user (id, username, email) VALUES (1, 'test', 'test@example.com')",
  ).run();
  dbManager.__setDb(db);
  return db;
}

// Skip all tests if the SQLite binary isn't available for the current Node ABI.
const describeOrSkip = sqliteLoadError ? describe.skip : describe;

describeOrSkip('microCardProposerSingleton — real DB writes', () => {
  if (sqliteLoadError) {
    // Jest won't enter this block when using describe.skip, but the diagnostic
    // is useful when running with --verbose.
    test.skip(
      `skipped — better-sqlite3 not available for Node ABI: ${sqliteLoadError.message}`,
      () => {},
    );
  }

  test('commit inserts a learning_point row and returns its UUID id', () => {
    freshDb();
    const { id } = singleton.commit({
      userId: 1,
      paragraphHash: 'h-abc',
      draft: { title: 'parse', content: 'to analyze grammatically' },
      domain: 'vocabulary',
    });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const row = dbManager
      .getDb()
      .prepare(
        'SELECT id, title, domain_type, source_type, source_id FROM learning_point WHERE id = ?',
      )
      .get(id);
    expect(row).toBeDefined();
    expect(row.title).toBe('parse');
    expect(row.domain_type).toBe('vocabulary');
    expect(row.source_type).toBe('book');
    expect(row.source_id).toBe('h-abc');
  });

  test('commit stores front and back as JSON', () => {
    freshDb();
    const { id } = singleton.commit({
      userId: 1,
      paragraphHash: 'h-json',
      draft: { title: 'ephemeral', content: 'lasting for a very short time' },
      domain: 'vocabulary',
    });
    const row = dbManager
      .getDb()
      .prepare('SELECT front, back FROM learning_point WHERE id = ?')
      .get(id);
    const front = JSON.parse(row.front);
    const back = JSON.parse(row.back);
    expect(typeof front.text).toBe('string');
    expect(typeof back.text).toBe('string');
    expect(back.text).toBe('lasting for a very short time');
  });

  test('commit falls back to headword when title is absent', () => {
    freshDb();
    const { id } = singleton.commit({
      userId: 1,
      paragraphHash: 'h-hw',
      draft: { headword: 'laconic', definition: 'brief and concise' },
      domain: 'vocabulary',
    });
    const row = dbManager
      .getDb()
      .prepare('SELECT title FROM learning_point WHERE id = ?')
      .get(id);
    expect(row.title).toBe('laconic');
  });

  test('delete removes the row and returns true; false if not found', () => {
    freshDb();
    const { id } = singleton.commit({
      userId: 1,
      paragraphHash: 'h-xyz',
      draft: { title: 't', content: 'c' },
      domain: 'vocabulary',
    });

    expect(singleton.delete(id)).toBe(true);

    const after = dbManager
      .getDb()
      .prepare('SELECT id FROM learning_point WHERE id = ?')
      .get(id);
    expect(after).toBeUndefined();

    // Deleting a non-existent id returns false.
    expect(singleton.delete('00000000-0000-0000-0000-000000000000')).toBe(false);
  });

  test('delete returns false for falsy id', () => {
    freshDb();
    expect(singleton.delete(null)).toBe(false);
    expect(singleton.delete(undefined)).toBe(false);
    expect(singleton.delete('')).toBe(false);
  });
});
