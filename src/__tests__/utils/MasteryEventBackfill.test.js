// src/__tests__/utils/MasteryEventBackfill.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');
const MasteryEventStore = require('../../main/db/MasteryEventStore');
const { backfill } = require('../../main/utils/MasteryEventBackfill');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  dbManager.__setDb(db);
  return db;
}

test('backfill emits one imported event per learning_point with no other events', async () => {
  const db = freshDb();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at) VALUES
    ('lp-1', 1, 'vocabulary', 'parse', '{}', '{}', 'book', 2, 40, '2026-06-15', '2026-06-15'),
    ('lp-2', 1, 'concept',    'lexer', '{}', '{}', 'book', 1, 25, '2026-06-15', '2026-06-15')`).run();
  await backfill({ userId: 1 });
  expect(MasteryEventStore.queryByConcept('lp-1').length).toBeGreaterThanOrEqual(1);
  expect(MasteryEventStore.queryByConcept('lp-2').length).toBeGreaterThanOrEqual(1);
});

test('backfill is idempotent: second run does not duplicate', async () => {
  const db = freshDb();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-1', 1, 'vocabulary', 'parse', '{}', '{}', 'book', 2, 40, '2026-06-15', '2026-06-15')`).run();
  await backfill({ userId: 1 });
  const c1 = MasteryEventStore.queryByConcept('lp-1').length;
  await backfill({ userId: 1 });
  expect(MasteryEventStore.queryByConcept('lp-1').length).toBe(c1);
});

test('backfill skips silently if no learning_point rows', async () => {
  freshDb();
  await expect(backfill({ userId: 1 })).resolves.not.toThrow();
});
