// src/__tests__/db/MasteryEventStore.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');
const MasteryEventStore = require('../../main/db/MasteryEventStore');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  // Seed user + lp for FK
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-1', 1, 'vocabulary', 'parse', '{}', '{}', 'book', 1, 25, datetime('now'), datetime('now'))`).run();
  dbManager.__setDb(db);
  return db;
}

test('record + queryByConcept', () => {
  freshDb();
  MasteryEventStore.record({
    learningPointId: 'lp-1', userId: 1, ts: 1000, eventType: 'review',
    rating: 'good', newBox: 2, prevBox: 1, source: 'user-review', sourceRef: 'sr-1',
  });
  const events = MasteryEventStore.queryByConcept('lp-1');
  expect(events).toHaveLength(1);
  expect(events[0].eventType).toBe('review');
  expect(events[0].rating).toBe('good');
});

test('record idempotency: duplicate (lp, ts, type, source_ref) ignored', () => {
  freshDb();
  const args = {
    learningPointId: 'lp-1', userId: 1, ts: 1000, eventType: 'review',
    rating: 'good', source: 'user-review', sourceRef: 'sr-1',
  };
  MasteryEventStore.record(args);
  MasteryEventStore.record(args);
  expect(MasteryEventStore.queryByConcept('lp-1')).toHaveLength(1);
});

test('queryDomainAverages returns per-day per-domain average mastery', () => {
  freshDb();
  const dayMs = 86400000;
  MasteryEventStore.record({ learningPointId: 'lp-1', userId: 1, ts: 1700000000000, eventType: 'mastery_change', newMastery: 40, source: 'backfill' });
  MasteryEventStore.record({ learningPointId: 'lp-1', userId: 1, ts: 1700000000000 + dayMs, eventType: 'mastery_change', newMastery: 60, source: 'user-review' });
  const rows = MasteryEventStore.queryDomainAverages({ userId: 1, since: 1700000000000 - dayMs });
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0].domain).toBe('vocabulary');
  expect(typeof rows[0].avgMastery).toBe('number');
});

test('isEmpty returns true on fresh DB, false after insert', () => {
  freshDb();
  expect(MasteryEventStore.isEmpty()).toBe(true);
  MasteryEventStore.record({ learningPointId: 'lp-1', userId: 1, ts: 1000, eventType: 'imported', newBox: 1, newMastery: 25, source: 'backfill' });
  expect(MasteryEventStore.isEmpty()).toBe(false);
});

describe('record() — Phase 13 attribution fields', () => {
  it('persists proximate_call_id + feature_surface when supplied', () => {
    const db = freshDb();
    const callId = db.prepare(`
      INSERT INTO brain_call_ledger (intent, ts, provider, cost_usd, cache_hit)
      VALUES ('director-session-step', ?, 'deepseek', 0.0042, 0)
    `).run(Date.now()).lastInsertRowid;

    MasteryEventStore.record({
      learningPointId: 'lp-1',
      userId: 1,
      ts: Date.now(),
      eventType: 'review',
      source: 'director-session',
      sourceRef: 'trace-xyz',
      featureSurface: 'director-session',
      proximateCallId: callId,
    });

    const row = db.prepare(
      `SELECT proximate_call_id, feature_surface FROM mastery_event WHERE learning_point_id='lp-1'`
    ).get();
    expect(row.feature_surface).toBe('director-session');
    expect(row.proximate_call_id).toBe(callId);
  });

  it('defaults feature_surface to "unknown" when omitted', () => {
    const db = freshDb();
    db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
                VALUES ('lp-2', 1, 'vocabulary', 'test', '{}', '{}', 'manual', 1, 0, datetime('now'), datetime('now'))`).run();

    MasteryEventStore.record({
      learningPointId: 'lp-2', userId: 1, ts: Date.now(),
      eventType: 'review', source: 'legacy',
    });
    const row = db.prepare(
      `SELECT feature_surface FROM mastery_event WHERE learning_point_id='lp-2'`
    ).get();
    expect(row.feature_surface).toBe('unknown');
  });
});
