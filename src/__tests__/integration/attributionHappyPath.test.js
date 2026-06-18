const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});

const dbManager = require('../../main/db/dbManager');
const recorder = require('../../main/db/masteryEventRecorder');
const AttributionService = require('../../main/utils/AttributionService');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  // 3 learning_points to simulate the 3 sources
  ['lp-d', 'lp-c', 'lp-m'].forEach((lpId) => {
    db.prepare(`INSERT INTO learning_point
      (id, user_id, title, front, back, domain_type, created_at)
      VALUES (?, 1, ?, '{"text":"f"}', '{"text":"b"}', 'vocabulary', '2026-01-01')`
    ).run(lpId, lpId);
  });
  dbManager.__setDb(db);
  return db;
}

describe('Phase 13 attribution — end-to-end happy path', () => {
  it('multi-source mastery moves correctly attributed across lenses + group detail + density', async () => {
    const db = freshDb();
    const day1 = Date.UTC(2026, 5, 17, 12);

    // 1) Director session: ledger row + mastery_event with proximate_call_id
    const directorTraceId = 'trace-director-1';
    const directorCallId = db.prepare(`INSERT INTO brain_call_ledger
      (intent, ts, provider, cost_usd, cache_hit, trace_id)
      VALUES ('director-session-step', ?, 'deepseek', 0.012, 0, ?)`
    ).run(day1, directorTraceId).lastInsertRowid;
    recorder.recordWithProximateCall({
      traceId: directorTraceId,
      surface: 'director-session',
      learningPointId: 'lp-d',
      userId: 1,
      ts: day1,
      eventType: 'review',
      source: 'director-session',
      sourceRef: directorTraceId,
    });

    // 2) Comprehension grade: ledger row + mastery_event with explicit callId
    const comprehensionCallId = db.prepare(`INSERT INTO brain_call_ledger
      (intent, ts, provider, cost_usd, cache_hit)
      VALUES ('grade-comprehension', ?, 'deepseek', 0.008, 0)`
    ).run(day1).lastInsertRowid;
    recorder.recordWithProximateCall({
      traceId: null,
      explicitCallId: comprehensionCallId,
      surface: 'comprehension',
      learningPointId: 'lp-c',
      userId: 1,
      ts: day1,
      eventType: 'mastery_change',
      source: 'comprehension-grade',
    });

    // 3) Micro-card accept: mastery_event with NO proximate call (chained)
    //    Also seed some extract-learning-points spend in the window to amortize against
    db.prepare(`INSERT INTO brain_call_ledger
      (intent, ts, provider, cost_usd, cache_hit)
      VALUES ('extract-learning-points', ?, 'deepseek', 0.04, 0)`
    ).run(day1);
    db.prepare(`INSERT INTO brain_call_ledger
      (intent, ts, provider, cost_usd, cache_hit)
      VALUES ('propose-microcard', ?, 'deepseek', 0.02, 0)`
    ).run(day1);
    recorder.recordWithProximateCall({
      traceId: null,
      surface: 'reading-microcard',
      learningPointId: 'lp-m',
      userId: 1,
      ts: day1,
      eventType: 'mastery_change',
      source: 'microcard-accept',
    });

    // --- Assertions ---
    const svc = new AttributionService();

    // 1. getBars with attention lens
    const bars = await svc.getBars({
      lens: 'attention', from: 0, to: day1 + 1, userId: 1,
    });
    const byKey = Object.fromEntries(bars.map((b) => [b.groupKey, b]));

    // focused-session: director + comprehension
    expect(byKey['focused-session'].eventCount).toBe(2);
    expect(byKey['focused-session'].directlyAttributedCount).toBe(2);
    expect(byKey['focused-session'].totalCostUsd).toBeCloseTo(0.012 + 0.008, 5);

    // while-reading: micro-card amortized
    expect(byKey['while-reading'].eventCount).toBe(1);
    expect(byKey['while-reading'].amortizedCount).toBe(1);
    expect(byKey['while-reading'].totalCostUsd).toBeGreaterThan(0); // should pick up amortized share

    // 2. getGroupDetail for focused-session — 2 events, both directly attributed
    const detail = await svc.getGroupDetail({
      lens: 'attention', groupKey: 'focused-session',
      from: 0, to: day1 + 1, userId: 1,
    });
    expect(detail.events.length).toBe(2);
    expect(detail.events.every((ev) => ev.amortized === false)).toBe(true);
    expect(detail.events.map((ev) => ev.proximateCallId).sort()).toEqual(
      [directorCallId, comprehensionCallId].sort(),
    );

    // 3. getDensityStrip — single day with count 3
    const strip = await svc.getDensityStrip({ userId: 1 });
    expect(strip).toEqual([{ day: '2026-06-17', count: 3 }]);
  });
});
