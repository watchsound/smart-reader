jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});

const AttributionService = require('../../main/utils/AttributionService');

describe('AttributionService — contract', () => {
  it('exports a class with 3 async methods', () => {
    const svc = new AttributionService();
    expect(typeof svc.getBars).toBe('function');
    expect(typeof svc.getGroupDetail).toBe('function');
    expect(typeof svc.getDensityStrip).toBe('function');
  });
});

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbManager = require('../../main/db/dbManager');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  dbManager.__setDb(db);
  return db;
}
function insCall(db, intent, costUsd, ts, traceId = null) {
  return db.prepare(`INSERT INTO brain_call_ledger
    (intent, ts, provider, cost_usd, cache_hit, trace_id)
    VALUES (?, ?, 'deepseek', ?, 0, ?)`).run(intent, ts, costUsd, traceId).lastInsertRowid;
}
function insEv(db, lpId, ts, surface, callId = null) {
  // learning_point schema: (id, user_id, title, front, back, domain_type) — NOT 'term'
  db.prepare(`INSERT OR IGNORE INTO learning_point
    (id, user_id, title, front, back, domain_type, created_at)
    VALUES (?, 1, ?, '{}', '{}', 'vocabulary', datetime('now'))`).run(lpId, lpId);
  db.prepare(`INSERT INTO mastery_event
    (learning_point_id, user_id, ts, event_type, source, feature_surface, proximate_call_id)
    VALUES (?, 1, ?, 'review', 'test', ?, ?)`).run(lpId, ts, surface, callId);
}

describe('getBars', () => {
  it('lens=attention groups surfaces into 3 attention-state bars', async () => {
    const db = freshDb();
    const ts = 1000;
    const cA = insCall(db, 'director-session-step', 0.01, ts);
    insEv(db, 'lp-a', ts, 'director-session', cA);  // focused-session direct
    insEv(db, 'lp-b', ts, 'reading-microcard');     // while-reading amortized
    insEv(db, 'lp-c', ts, 'backfill');              // historical

    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'attention', from: 0, to: 9999, userId: 1,
    });
    const byKey = Object.fromEntries(bars.map((b) => [b.groupKey, b]));
    expect(byKey['focused-session'].eventCount).toBe(1);
    expect(byKey['focused-session'].totalCostUsd).toBeCloseTo(0.01);
    expect(byKey['while-reading'].eventCount).toBe(1);
    expect(byKey['historical'].eventCount).toBe(1);
    expect(byKey['historical'].totalCostUsd).toBe(0);
  });

  it('amortizes intent spend across surfaces with no proximate_call_id', async () => {
    const db = freshDb();
    const ts = 1000;
    insCall(db, 'extract-learning-points', 0.04, ts);
    insCall(db, 'extract-learning-points', 0.06, ts);
    insEv(db, 'lp-a', ts, 'reading-microcard');
    insEv(db, 'lp-b', ts, 'reading-microcard');
    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'phase', from: 0, to: 9999, userId: 1,
    });
    const readingLoop = bars.find((b) => b.groupKey === 'reading-loop');
    expect(readingLoop.totalCostUsd).toBeCloseTo(0.10);
    expect(readingLoop.costPerEvent).toBeCloseTo(0.05);
    expect(readingLoop.amortizedCount).toBe(2);
    expect(readingLoop.directlyAttributedCount).toBe(0);
  });

  it('filters by [from, to) window', async () => {
    const db = freshDb();
    insEv(db, 'lp-a', 1000, 'director-session');
    insEv(db, 'lp-b', 5000, 'director-session');
    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'attention', from: 2000, to: 6000, userId: 1,
    });
    expect(bars.find((b) => b.groupKey === 'focused-session').eventCount).toBe(1);
  });

  it('sorts bars by costPerEvent ascending (most-efficient first)', async () => {
    const db = freshDb();
    const c1 = insCall(db, 'director-session-step', 0.50, 1000);
    insEv(db, 'lp-1', 1000, 'director-session', c1);  // expensive
    const c2 = insCall(db, 'grade-comprehension', 0.05, 1000);
    insEv(db, 'lp-2', 1000, 'comprehension', c2);     // cheap
    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'phase', from: 0, to: 9999, userId: 1,
    });
    expect(bars[0].costPerEvent).toBeLessThan(bars[bars.length - 1].costPerEvent);
  });
});

describe('getGroupDetail', () => {
  it('returns events for a group with per-event cost (direct or amortized)', async () => {
    const db = freshDb();
    const ts = 2000;
    const cA = insCall(db, 'director-session-step', 0.012, ts);
    insEv(db, 'lp-a', ts, 'director-session', cA);
    insEv(db, 'lp-b', ts - 1000, 'director-session');

    const svc = new AttributionService();
    const detail = await svc.getGroupDetail({
      lens: 'attention', groupKey: 'focused-session',
      from: 0, to: 9999, userId: 1,
    });
    expect(detail.group.key).toBe('focused-session');
    expect(detail.events.length).toBe(2);
    expect(detail.events[0].learningPointId).toBe('lp-a');
    expect(detail.events[0].proximateCallId).toBe(cA);
    expect(detail.events[0].amortized).toBe(false);
    expect(detail.events[1].amortized).toBe(true);
  });
});
