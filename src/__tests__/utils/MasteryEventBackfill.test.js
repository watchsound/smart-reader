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

test('backfilled mastery_event rows have feature_surface="backfill"', async () => {
  const db = freshDb();
  // Insert an sr_item row (Pass 1) and a learning_point (Pass 3 catchall).
  // sr_item.item_id must match a learning_point.id for the FK constraint.
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-sr', 1, 'vocabulary', 'word', '{}', '{}', 'book', 1, 30, '2026-06-15', '2026-06-15')`).run();
  db.prepare(`INSERT INTO sr_item (user_id, item_id, item_type, last_review, review_count, created_at)
              VALUES (1, 'lp-sr', 'learning_point', '2026-06-10', 3, '2026-06-01')`).run();
  await backfill({ userId: 1 });
  const rows = db.prepare(
    `SELECT feature_surface FROM mastery_event WHERE learning_point_id = ?`
  ).all('lp-sr');
  expect(rows.length).toBeGreaterThanOrEqual(1);
  rows.forEach((row) => {
    expect(row.feature_surface).toBe('backfill');
  });
});
