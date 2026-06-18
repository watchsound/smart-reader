'use strict';
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
  db.prepare(`INSERT INTO learning_point (id, user_id, title, front, back, domain_type, created_at)
              VALUES ('lp-x', 1, 'x', '{"text":"f"}', '{"text":"b"}', 'vocabulary', '2026-01-01')`).run();
  dbManager.__setDb(db);
  return db;
}

describe('SessionRunner attribution', () => {
  it('Director Leitner rating writes mastery_event with director-session surface + proximate_call_id via the helper', () => {
    const db = freshDb();
    const traceId = 'trace-test-1';
    const callId = db.prepare(`INSERT INTO brain_call_ledger
      (intent, ts, provider, cost_usd, cache_hit, trace_id)
      VALUES ('director-session-step', ?, 'deepseek', 0.005, 0, ?)`
    ).run(Date.now(), traceId).lastInsertRowid;

    // Exercise the same code path SessionRunner executes after a Leitner rating
    recorder.recordWithProximateCall({
      traceId,
      surface: 'director-session',
      learningPointId: 'lp-x',
      userId: 1,
      ts: Date.now(),
      eventType: 'review',
      rating: '3',
      source: 'director-session',
      sourceRef: traceId,
    });

    const ev = db.prepare(
      `SELECT feature_surface, proximate_call_id FROM mastery_event WHERE learning_point_id='lp-x'`
    ).get();
    expect(ev.feature_surface).toBe('director-session');
    expect(ev.proximate_call_id).toBe(callId);
  });

  it('SessionRunner.js uses masteryEventRecorder.recordWithProximateCall (not direct MasteryEventStore.record) in the Leitner branch', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../main/brain/director/SessionRunner.js'),
      'utf8',
    );
    expect(src).toMatch(/masteryEventRecorder/);
    expect(src).toMatch(/recordWithProximateCall\s*\(/);
    // The old direct call must be gone in the Leitner branch
    expect(src).not.toMatch(/MasteryEventStore\.record\s*\(/);
  });
});
