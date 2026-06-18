// src/__tests__/db/masteryEventRecorder.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');
const recorder = require('../../main/db/masteryEventRecorder');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, created_at, updated_at)
              VALUES ('lp-1', 1, 'vocabulary', 'word', '{}', '{}', 'manual', 1, datetime('now'), datetime('now'))`).run();
  dbManager.__setDb(db);
  return db;
}

describe('masteryEventRecorder', () => {
  it('looks up most recent ledger row for trace_id and stamps proximate_call_id', () => {
    const db = freshDb();
    const older = db.prepare(`INSERT INTO brain_call_ledger
      (intent, ts, provider, cost_usd, cache_hit, trace_id)
      VALUES ('director-session-step', 1000, 'deepseek', 0.01, 0, 'tr-A')`).run().lastInsertRowid;
    const newer = db.prepare(`INSERT INTO brain_call_ledger
      (intent, ts, provider, cost_usd, cache_hit, trace_id)
      VALUES ('director-session-step', 2000, 'deepseek', 0.02, 0, 'tr-A')`).run().lastInsertRowid;

    recorder.recordWithProximateCall({
      traceId: 'tr-A',
      surface: 'director-session',
      learningPointId: 'lp-1',
      userId: 1,
      ts: 3000,
      eventType: 'review',
      source: 'director-session',
      sourceRef: 'tr-A',
    });

    const row = db.prepare(
      `SELECT proximate_call_id, feature_surface FROM mastery_event WHERE learning_point_id='lp-1'`
    ).get();
    expect(row.proximate_call_id).toBe(newer);
    expect(row.feature_surface).toBe('director-session');
  });

  it('passes proximate_call_id=null when traceId is null/undefined', () => {
    freshDb();
    recorder.recordWithProximateCall({
      traceId: null,
      surface: 'reading-microcard',
      learningPointId: 'lp-1',
      userId: 1,
      ts: 1000,
      eventType: 'mastery_change',
      source: 'microcard-accept',
    });
    const row = dbManager.getDb().prepare(
      `SELECT proximate_call_id, feature_surface FROM mastery_event WHERE learning_point_id='lp-1'`
    ).get();
    expect(row.proximate_call_id).toBeNull();
    expect(row.feature_surface).toBe('reading-microcard');
  });

  it('passes proximate_call_id=null when no ledger row matches the trace', () => {
    freshDb();
    recorder.recordWithProximateCall({
      traceId: 'tr-nonexistent',
      surface: 'director-session',
      learningPointId: 'lp-1',
      userId: 1,
      ts: 1000,
      eventType: 'review',
      source: 'director-session',
    });
    const row = dbManager.getDb().prepare(
      `SELECT proximate_call_id FROM mastery_event WHERE learning_point_id='lp-1'`
    ).get();
    expect(row.proximate_call_id).toBeNull();
  });
});
