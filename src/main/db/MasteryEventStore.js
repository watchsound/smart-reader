// src/main/db/MasteryEventStore.js
/**
 * MasteryEventStore — DAO over `mastery_event`.
 *
 * Provides idempotent insert, per-concept query, per-domain aggregate query,
 * and an emptiness check used by the Phase 12 backfill guard.
 *
 * Follows the same `require('./dbManager').getDb()` pattern as CallLedgerStore
 * and AISessionStore.
 */

const dbManager = require('./dbManager');

/**
 * Record one mastery event.  Duplicate (lp, ts, event_type, source_ref) rows
 * are silently ignored so callers can be retry-safe without pre-checking.
 *
 * @param {Object}      ev
 * @param {string}      ev.learningPointId
 * @param {number}      ev.userId
 * @param {number}      ev.ts             - epoch ms
 * @param {string}      ev.eventType      - 'review' | 'mastery_change' | 'imported' | …
 * @param {number|null} [ev.prevBox]
 * @param {number|null} [ev.newBox]
 * @param {number|null} [ev.prevMastery]
 * @param {number|null} [ev.newMastery]
 * @param {string|null} [ev.rating]       - 'again' | 'hard' | 'good' | 'easy'
 * @param {string}      ev.source         - originating system, e.g. 'user-review'
 * @param {string|null} [ev.sourceRef]    - FK to the source row (e.g. sr_item id)
 * @param {string|null} [ev.notes]
 */
function record(ev) {
  const db = dbManager.getDb();
  try {
    db.prepare(`
      INSERT INTO mastery_event
        (learning_point_id, user_id, ts, event_type,
         prev_box, new_box, prev_mastery, new_mastery,
         rating, source, source_ref, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ev.learningPointId, ev.userId, ev.ts, ev.eventType,
      ev.prevBox    ?? null, ev.newBox     ?? null,
      ev.prevMastery ?? null, ev.newMastery ?? null,
      ev.rating     ?? null, ev.source,
      ev.sourceRef  ?? null, ev.notes      ?? null,
    );
  } catch (e) {
    // Silently absorb duplicate-key violations on the dedup index.
    // The UNIQUE index is idx_mastery_event_dedup; better-sqlite3 surfaces
    // "UNIQUE constraint failed: ..." in e.message.
    if (/UNIQUE constraint failed/i.test(e.message)) return;
    throw e;
  }
}

/**
 * Return all mastery events for one learning point, oldest first.
 *
 * @param {string} learningPointId
 * @returns {{ id, learningPointId, userId, ts, eventType,
 *             prevBox, newBox, prevMastery, newMastery,
 *             rating, source, sourceRef, notes }[]}
 */
function queryByConcept(learningPointId) {
  const db = dbManager.getDb();
  return db.prepare(`
    SELECT
      id,
      learning_point_id AS learningPointId,
      user_id           AS userId,
      ts,
      event_type        AS eventType,
      prev_box          AS prevBox,
      new_box           AS newBox,
      prev_mastery      AS prevMastery,
      new_mastery       AS newMastery,
      rating,
      source,
      source_ref        AS sourceRef,
      notes
    FROM mastery_event
    WHERE learning_point_id = ?
    ORDER BY ts ASC
  `).all(learningPointId);
}

/**
 * Return per-day, per-domain average mastery for a user since a given ts.
 * Only rows with a non-null new_mastery contribute.
 *
 * @param {Object} opts
 * @param {number} opts.userId
 * @param {number} opts.since  - epoch ms (inclusive lower bound)
 * @returns {{ day: string, domain: string, avgMastery: number, eventCount: number }[]}
 */
function queryDomainAverages({ userId, since }) {
  const db = dbManager.getDb();
  return db.prepare(`
    SELECT
      date(me.ts / 1000, 'unixepoch') AS day,
      lp.domain_type                  AS domain,
      AVG(me.new_mastery)             AS avgMastery,
      COUNT(*)                        AS eventCount
    FROM mastery_event me
    JOIN learning_point lp ON lp.id = me.learning_point_id
    WHERE me.user_id = ?
      AND me.ts >= ?
      AND me.new_mastery IS NOT NULL
    GROUP BY day, domain
    ORDER BY day ASC, domain ASC
  `).all(userId, since);
}

/**
 * Return true when the mastery_event table contains no rows.
 * Used by the Phase 12 backfill guard to decide whether to seed historical events.
 *
 * @returns {boolean}
 */
function isEmpty() {
  const db = dbManager.getDb();
  const row = db.prepare(`SELECT COUNT(*) AS c FROM mastery_event`).get();
  return (row?.c || 0) === 0;
}

module.exports = { record, queryByConcept, queryDomainAverages, isEmpty };
