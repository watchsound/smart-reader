// src/main/utils/BrainVisibilityService.js
/**
 * BrainVisibilityService — read-only aggregation layer for Phase 11 Brain Visibility.
 *
 * Consumes brain_call_ledger, ai_sessions, ai_session_trace, and learning_point
 * (no writes, no schema changes). Returns 4 data slices for the dashboard:
 *   - mastery: domain×box breakdown of learning points
 *   - timeline: per-day call counts and costs grouped by intent class
 *   - sessions: recent ai_sessions with per-session cost from ledger
 *   - topConcepts: most-touched learning points derived from trace payload JSON
 */

const dbManager = require('../db/dbManager');

const WINDOW_MS = {
  '7d': 7 * 86400000,
  '30d': 30 * 86400000,
  '90d': 90 * 86400000,
};

/**
 * Map a raw intent string to a broad display class.
 * Keeps the timeline chart readable without enumerating every intent.
 */
function classifyIntent(intent) {
  if (!intent) return 'other';
  if (intent.startsWith('director-')) return 'director';
  if (intent.startsWith('legacy:') || intent.startsWith('legacy-')) return 'legacy';
  if (intent.includes('concept-extraction') || intent.includes('enrichment')) return 'extraction';
  return 'other';
}

/**
 * Extract a learningPointId from a parsed payload object.
 * Handles both top-level `learningPointId` and nested `args.learningPointId`.
 * learning_point.id is TEXT in the schema, so ids may be strings or numbers;
 * both are accepted as long as they are truthy.
 */
function extractLearningPointId(payload) {
  if (!payload) return null;
  const top = payload.learningPointId;
  if (top !== undefined && top !== null && top !== '') return top;
  if (payload.args) {
    const nested = payload.args.learningPointId;
    if (nested !== undefined && nested !== null && nested !== '') return nested;
  }
  return null;
}

function safeParseJson(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

/**
 * Scan trace rows for a session and return the first learningPointId referenced.
 * Returns null when no trace row mentions a learning point.
 */
function firstTouchedConcept(db, sessionId) {
  const rows = db.prepare(`
    SELECT payload_json FROM ai_session_trace
    WHERE session_id = ?
    ORDER BY ts ASC
    LIMIT 50
  `).all(sessionId);
  for (const r of rows) {
    const id = extractLearningPointId(safeParseJson(r.payload_json));
    if (id != null) return id;
  }
  return null;
}

/**
 * Aggregate all learningPointId references across session traces within the
 * time window, rank by frequency, and enrich with learning_point metadata.
 */
function topTouchedConcepts(db, userId, since, limit) {
  const rows = db.prepare(`
    SELECT t.payload_json
    FROM ai_session_trace t
    JOIN ai_sessions s ON s.id = t.session_id
    WHERE s.user_id = ? AND s.started_at >= ?
  `).all(userId, since);

  const counts = new Map();
  for (const r of rows) {
    const id = extractLearningPointId(safeParseJson(r.payload_json));
    if (id != null) counts.set(id, (counts.get(id) || 0) + 1);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const result = [];
  for (const [id, decisionCount] of ranked) {
    const lp = db.prepare(`
      SELECT id, title, domain_type AS domain, box, mastery_level
      FROM learning_point
      WHERE id = ?
    `).get(id);
    if (lp) {
      result.push({
        id: lp.id,
        title: lp.title,
        domain: lp.domain,
        decisionCount,
        box: lp.box,
        masteryPct: lp.mastery_level,
      });
    }
  }
  return result;
}

/**
 * Return the 4 Brain Visibility data slices for the given window and user.
 *
 * @param {Object} opts
 * @param {'7d'|'30d'|'90d'} [opts.window='30d']
 * @param {number} [opts.userId=1]
 * @returns {Promise<{ mastery, timeline, sessions, topConcepts }>}
 */
async function getDashboard({ window = '30d', userId = 1 } = {}) {
  const db = dbManager.getDb();
  const since = Date.now() - (WINDOW_MS[window] || WINDOW_MS['30d']);

  // 1. Mastery snapshot — domain × box distribution, all time (not windowed,
  //    so the chart always shows the full SRS state of the user's collection).
  const mastery = db.prepare(`
    SELECT domain_type AS domain, box, COUNT(*) AS count
    FROM learning_point
    WHERE user_id = ?
    GROUP BY domain_type, box
    ORDER BY domain_type, box
  `).all(userId);

  // 2. Daily call timeline grouped by intent class.
  //    date() with 'unixepoch' modifier converts epoch-seconds to YYYY-MM-DD.
  const timelineRaw = db.prepare(`
    SELECT date(ts / 1000, 'unixepoch') AS day, intent,
           COUNT(*) AS count, SUM(cost_usd) AS cost
    FROM brain_call_ledger
    WHERE ts >= ?
    GROUP BY day, intent
    ORDER BY day ASC
  `).all(since);

  const timeline = timelineRaw.map(r => ({
    day: r.day,
    intentClass: classifyIntent(r.intent),
    count: r.count,
    cost: r.cost || 0,
  }));

  // 3. Recent sessions with per-session cost aggregated from the ledger via
  //    shared trace_id. A sub-select is used so we need only one query pass.
  const sessionRows = db.prepare(`
    SELECT s.id, s.goal, s.started_at AS startedAt, s.ended_at AS endedAt,
           s.iteration, s.budget, s.status, s.trace_id AS traceId,
           (
             SELECT COALESCE(SUM(cost_usd), 0)
             FROM brain_call_ledger
             WHERE trace_id = s.trace_id
           ) AS totalCost
    FROM ai_sessions s
    WHERE s.user_id = ? AND s.started_at >= ?
    ORDER BY s.started_at DESC
    LIMIT 20
  `).all(userId, since);

  const sessions = sessionRows.map(s => ({
    ...s,
    firstTouchedConceptId: firstTouchedConcept(db, s.id),
  }));

  // 4. Top-touched concepts derived from ai_session_trace payload JSON scan.
  const topConcepts = topTouchedConcepts(db, userId, since, 20);

  return { mastery, timeline, sessions, topConcepts };
}

module.exports = { getDashboard };
