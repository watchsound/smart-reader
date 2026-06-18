const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});

const dbManager = require('../../main/db/dbManager');
const CallLedgerStore = require('../../main/db/CallLedgerStore');

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
  db.prepare(`INSERT OR IGNORE INTO learning_point (id, user_id, title, front, back, domain_type, created_at)
              VALUES (?, 1, ?, '{}', '{}', 'vocabulary', datetime('now'))`).run(lpId, lpId);
  db.prepare(`INSERT INTO mastery_event
    (learning_point_id, user_id, ts, event_type, source, feature_surface, proximate_call_id)
    VALUES (?, 1, ?, 'review', 'test', ?, ?)`).run(lpId, ts, surface, callId);
}

describe('CallLedgerStore — attribution aggregations', () => {
  describe('aggregateAttribution', () => {
    it('returns per-surface rows with direct + amortized cost components', () => {
      const db = freshDb();
      const ts = 1000;
      const callA = insCall(db, 'director-session-step', 0.01, ts);
      insEv(db, 'lp-1', ts, 'director-session', callA);  // direct
      insCall(db, 'extract-learning-points', 0.04, ts);  // amortizable
      insEv(db, 'lp-2', ts, 'reading-microcard');         // amortized
      insEv(db, 'lp-3', ts, 'reading-microcard');         // amortized

      const rows = CallLedgerStore.aggregateAttribution({
        userId: 1, fromMs: 0, toMs: 9999,
      });
      const bySurface = Object.fromEntries(rows.map((r) => [r.feature_surface, r]));
      expect(bySurface['director-session'].direct_cost_usd).toBeCloseTo(0.01);
      expect(bySurface['director-session'].direct_event_count).toBe(1);
      expect(bySurface['director-session'].amortized_event_count).toBe(0);
      expect(bySurface['reading-microcard'].direct_cost_usd).toBe(0);
      expect(bySurface['reading-microcard'].amortized_event_count).toBe(2);
    });

    it('exposes per-intent residual spend (for amortization denominator)', () => {
      const db = freshDb();
      insCall(db, 'extract-learning-points', 0.1, 1000);
      insCall(db, 'extract-learning-points', 0.2, 1500);
      const result = CallLedgerStore.intentSpendInWindow({ fromMs: 0, toMs: 9999 });
      expect(result['extract-learning-points']).toBeCloseTo(0.3);
    });
  });

  describe('attributionGroupDetail', () => {
    it('returns events filtered by feature_surface list, newest first', () => {
      const db = freshDb();
      const callA = insCall(db, 'director-session-step', 0.005, 2000);
      insEv(db, 'lp-a', 2000, 'director-session', callA);
      insEv(db, 'lp-b', 1000, 'director-session');

      const events = CallLedgerStore.attributionGroupDetail({
        userId: 1, fromMs: 0, toMs: 9999,
        surfaces: ['director-session'],
        limit: 50,
      });
      expect(events.length).toBe(2);
      expect(events[0].learning_point_id).toBe('lp-a');
      expect(events[0].proximate_call_id).toBe(callA);
      expect(events[0].intent).toBe('director-session-step');
      expect(events[1].proximate_call_id).toBeNull();
    });
  });

  describe('attributionDensityStrip', () => {
    it('returns one row per UTC day with count, oldest first', () => {
      const db = freshDb();
      const day1 = Date.UTC(2026, 5, 1, 12);
      const day2 = Date.UTC(2026, 5, 2, 12);
      insEv(db, 'lp-1', day1, 'director-session');
      insEv(db, 'lp-2', day1, 'director-session');
      insEv(db, 'lp-3', day2, 'reading-microcard');
      const strip = CallLedgerStore.attributionDensityStrip({ userId: 1 });
      expect(strip).toEqual([
        { day: '2026-06-01', count: 2 },
        { day: '2026-06-02', count: 1 },
      ]);
    });
  });
});
