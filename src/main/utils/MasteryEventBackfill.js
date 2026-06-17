// src/main/utils/MasteryEventBackfill.js
/**
 * MasteryEventBackfill — one-shot idempotent seeder for mastery_event.
 *
 * Three passes in order:
 *   1. sr_item        → one `review` event per row (uses last_review timestamp)
 *   2. learning_item_performance → one `mastery_change` event per row when
 *      mastery_after is present (richer than learning_session which has no
 *      per-item FK; learning_session is feature-detected but skipped if it
 *      lacks a learning_point_id column)
 *   3. Catchall       → one `imported` event per learning_point that still
 *      has no mastery_event row after the two passes above
 *
 * All inserts go through MasteryEventStore.record() which absorbs duplicates
 * via the UNIQUE index on (learning_point_id, ts, event_type, COALESCE(source_ref,'')).
 * Running backfill() twice produces identical state.
 */

const dbManager = require('../db/dbManager');
const MasteryEventStore = require('../db/MasteryEventStore');

/**
 * Coerce a column value to epoch-ms.
 * Accepts: ISO string, epoch-ms number, or null/undefined → now.
 */
function parseTs(s) {
  if (!s) return Date.now();
  if (typeof s === 'number') return s;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

function tableExists(db, name) {
  return !!db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name);
}

function columnNames(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

async function backfill({ userId = 1 } = {}) {
  const db = dbManager.getDb();

  // ── Pass 1: sr_item ──────────────────────────────────────────────────────
  // Columns confirmed in db.sql: id, user_id, item_id, item_type, last_review,
  // review_count, created_at.  No ease_factor (FSRS uses `difficulty` on a
  // 1–10 scale, not 0–100 mastery), so newMastery is left null here.
  if (tableExists(db, 'sr_item')) {
    const cols = columnNames(db, 'sr_item');
    if (cols.includes('item_id') && cols.includes('user_id')) {
      const rows = db
        .prepare(`SELECT * FROM sr_item WHERE user_id = ?`)
        .all(userId);
      for (const r of rows) {
        MasteryEventStore.record({
          learningPointId: String(r.item_id),
          userId,
          ts: parseTs(r.last_review || r.created_at),
          eventType: 'review',
          newMastery: null,
          source: 'backfill',
          sourceRef: `sr-${r.id}`,
        });
      }
    }
  }

  // ── Pass 2a: learning_item_performance ───────────────────────────────────
  // Preferred over learning_session because it carries per-item item_id and
  // mastery_after.  learning_session only tracks session-level aggregates with
  // no per-item FK, so we skip it (feature-detect below still runs for safety).
  if (tableExists(db, 'learning_item_performance')) {
    const cols = columnNames(db, 'learning_item_performance');
    if (cols.includes('item_id') && cols.includes('reviewed_at')) {
      const rows = db
        .prepare(
          `SELECT * FROM learning_item_performance WHERE user_id = ?`
        )
        .all(userId);
      for (const r of rows) {
        MasteryEventStore.record({
          learningPointId: String(r.item_id),
          userId,
          ts: parseTs(r.reviewed_at),
          eventType: 'mastery_change',
          newMastery: r.mastery_after ?? null,
          source: 'backfill',
          sourceRef: `lip-${r.id}`,
        });
      }
    }
  }

  // ── Pass 2b: learning_session (guard — skipped if no learning_point_id) ──
  // The actual db.sql schema has no learning_point_id column on this table.
  // This block is left in for forward-compatibility in case a migration adds
  // it later, and to satisfy the plan's intent of feature-detecting it.
  if (tableExists(db, 'learning_session')) {
    const cols = columnNames(db, 'learning_session');
    if (cols.includes('learning_point_id') && cols.includes('end_time')) {
      const rows = db
        .prepare(
          `SELECT * FROM learning_session WHERE user_id = ? AND end_time IS NOT NULL`
        )
        .all(userId);
      for (const r of rows) {
        MasteryEventStore.record({
          learningPointId: String(r.learning_point_id),
          userId,
          ts: parseTs(r.end_time),
          eventType: 'mastery_change',
          source: 'backfill',
          sourceRef: `ls-${r.id}`,
        });
      }
    }
  }

  // ── Pass 3: Catchall — one `imported` per orphaned learning_point ─────────
  // Picks up every learning_point that still has no mastery_event row after
  // passes 1 and 2.  Captures snapshot box + mastery from the learning_point
  // row itself so the trajectory starts from known state.
  const orphans = db
    .prepare(
      `
      SELECT lp.id, lp.box, lp.mastery_level, lp.created_at
      FROM learning_point lp
      WHERE lp.user_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM mastery_event me WHERE me.learning_point_id = lp.id
        )
    `
    )
    .all(userId);

  for (const lp of orphans) {
    MasteryEventStore.record({
      learningPointId: lp.id,
      userId,
      ts: parseTs(lp.created_at),
      eventType: 'imported',
      newBox: lp.box,
      newMastery: lp.mastery_level,
      source: 'backfill',
      sourceRef: `imp-${lp.id}`,
    });
  }
}

module.exports = { backfill };
