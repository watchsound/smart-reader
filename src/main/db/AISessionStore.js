// src/main/db/AISessionStore.js
/**
 * AISessionStore — DAO over `ai_sessions` + `ai_session_trace`.
 *
 * Persists completed Study-Session Director runs and makes them
 * queryable for the Knowledge Dashboard history view.
 *
 * Uses the same `require('./dbManager').getDb()` pattern as CallLedgerStore.
 */

const DBManager = require('./dbManager');

/**
 * Write a completed session and its trace events atomically.
 *
 * @param {Object} session
 * @param {string}      session.id
 * @param {number}      session.userId
 * @param {number|null} session.questId
 * @param {string}      session.goal
 * @param {string}      session.traceId
 * @param {string}      session.status        - 'completed' | 'error' | 'budget_exceeded'
 * @param {number}      session.iteration
 * @param {number}      session.budget
 * @param {number}      session.startedAt     - epoch ms
 * @param {number|null} session.endedAt       - epoch ms
 * @param {string|null} session.errorReason
 * @param {Array}       session.trace         - [{iteration, kind, payload, ts}]
 * @returns {string} the session id
 */
function persistCompleted(session) {
  const db = DBManager.getDb();
  const tx = db.transaction((s) => {
    db.prepare(`
      INSERT INTO ai_sessions
        (id, user_id, quest_id, goal, trace_id, status, iteration, budget, started_at, ended_at, error_reason)
      VALUES (@id, @userId, @questId, @goal, @traceId, @status, @iteration, @budget, @startedAt, @endedAt, @errorReason)
    `).run({
      id: s.id,
      userId: s.userId,
      questId: s.questId ?? null,
      goal: s.goal,
      traceId: s.traceId,
      status: s.status,
      iteration: s.iteration,
      budget: s.budget,
      startedAt: s.startedAt,
      endedAt: s.endedAt ?? null,
      errorReason: s.errorReason ?? null,
    });

    const insertTrace = db.prepare(`
      INSERT INTO ai_session_trace (session_id, iteration, kind, payload_json, ts)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const ev of s.trace || []) {
      insertTrace.run(s.id, ev.iteration, ev.kind, JSON.stringify(ev.payload || {}), ev.ts);
    }
  });
  tx(session);
  return session.id;
}

/**
 * Return sessions for a user, newest first.
 *
 * @param {number} userId
 * @param {number} [limit=20]
 * @returns {Object[]} raw ai_sessions rows
 */
function listByUser(userId, limit = 20) {
  const db = DBManager.getDb();
  return db.prepare(`
    SELECT * FROM ai_sessions
    WHERE user_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).all(userId, limit);
}

/**
 * Return all trace events for a session, ordered by ts ASC.
 *
 * @param {string} sessionId
 * @returns {{ iteration: number, kind: string, payload: object, ts: number }[]}
 */
function getTrace(sessionId) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT iteration, kind, payload_json, ts FROM ai_session_trace
    WHERE session_id = ?
    ORDER BY ts ASC
  `).all(sessionId);
  return rows.map(r => ({
    iteration: r.iteration,
    kind: r.kind,
    payload: JSON.parse(r.payload_json),
    ts: r.ts,
  }));
}

module.exports = { persistCompleted, listByUser, getTrace };
