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
const BrainVisibilityService = require('../../main/utils/BrainVisibilityService');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  dbManager.__setDb(db);
  return db;
}

test('backfill + forward event → BrainVisibilityService surfaces both', async () => {
  const db = freshDb();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-T', 1, 'vocabulary', 'parse', '{}', '{}', 'book', 1, 25, '2026-06-15', '2026-06-15')`).run();
  await backfill({ userId: 1 });
  // Simulate a forward write
  MasteryEventStore.record({
    learningPointId: 'lp-T', userId: 1, ts: Date.now(),
    eventType: 'mastery_change', prevMastery: 25, newMastery: 55,
    source: 'production-grade', sourceRef: 'pg-1',
  });
  const concept = await BrainVisibilityService.getConcept({ learningPointId: 'lp-T', userId: 1 });
  expect(concept.boxOverTime.length).toBeGreaterThanOrEqual(2);
  expect(concept.boxOverTime[concept.boxOverTime.length - 1].mastery).toBe(55);

  const dash = await BrainVisibilityService.getDashboard({ window: '90d', userId: 1 });
  expect(Array.isArray(dash.masteryTrajectory)).toBe(true);
});
