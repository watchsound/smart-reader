/**
 * LearningSessionManager.js
 *
 * Database manager for learning_session and learning_item_performance tables.
 * Handles session tracking and per-item performance recording.
 *
 * Table Schemas:
 *
 * CREATE TABLE "learning_session" (
 *   "id" TEXT PRIMARY KEY,
 *   "plan_id" TEXT,
 *   "topic_id" TEXT NOT NULL,
 *   "user_id" INTEGER NOT NULL,
 *   "session_type" TEXT NOT NULL,
 *   "started_at" TEXT NOT NULL,
 *   "completed_at" TEXT,
 *   "duration_minutes" INTEGER,
 *   "items_reviewed" INTEGER DEFAULT 0,
 *   "items_correct" INTEGER DEFAULT 0,
 *   "items_new" INTEGER DEFAULT 0,
 *   "session_data" TEXT
 * );
 *
 * CREATE TABLE "learning_item_performance" (
 *   "id" INTEGER PRIMARY KEY AUTOINCREMENT,
 *   "user_id" INTEGER NOT NULL,
 *   "topic_id" TEXT NOT NULL,
 *   "item_id" TEXT NOT NULL,
 *   "item_type" TEXT NOT NULL,
 *   "reviewed_at" TEXT NOT NULL,
 *   "was_correct" INTEGER NOT NULL,
 *   "response_time_ms" INTEGER,
 *   "confidence_level" INTEGER,
 *   "mistake_type" TEXT,
 *   "difficulty_rating" INTEGER,
 *   "mastery_before" REAL,
 *   "mastery_after" REAL,
 *   "session_id" TEXT
 * );
 */

import db, { getUserIdFromToken } from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

/**
 * Initialize tables if they don't exist
 */
const initializeTables = () => {
  try {
    // Create learning_session table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "learning_session" (
        "id" TEXT PRIMARY KEY,
        "plan_id" TEXT,
        "topic_id" TEXT NOT NULL,
        "user_id" INTEGER NOT NULL,
        "session_type" TEXT NOT NULL,
        "started_at" TEXT NOT NULL,
        "completed_at" TEXT,
        "duration_minutes" INTEGER,
        "items_reviewed" INTEGER DEFAULT 0,
        "items_correct" INTEGER DEFAULT 0,
        "items_new" INTEGER DEFAULT 0,
        "session_data" TEXT,
        FOREIGN KEY ("plan_id") REFERENCES "learning_plan"("id"),
        FOREIGN KEY ("user_id") REFERENCES "user"("id")
      )
    `).run();

    // Create indexes if they don't exist
    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_learning_session_user"
      ON "learning_session"("user_id", "started_at")
    `).run();

    // Create learning_item_performance table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "learning_item_performance" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER NOT NULL,
        "topic_id" TEXT NOT NULL,
        "item_id" TEXT NOT NULL,
        "item_type" TEXT NOT NULL,
        "reviewed_at" TEXT NOT NULL,
        "was_correct" INTEGER NOT NULL,
        "response_time_ms" INTEGER,
        "confidence_level" INTEGER,
        "mistake_type" TEXT,
        "difficulty_rating" INTEGER,
        "mastery_before" REAL,
        "mastery_after" REAL,
        "session_id" TEXT,
        FOREIGN KEY ("session_id") REFERENCES "learning_session"("id"),
        FOREIGN KEY ("user_id") REFERENCES "user"("id")
      )
    `).run();
  } catch (error) {
    console.error('Error initializing learning session tables:', error);
  }
};

// Initialize tables on module load
initializeTables();

/**
 * Generate a unique session ID
 */
const generateSessionId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `session_${timestamp}_${randomPart}`;
};

/**
 * Convert database row to session object
 */
const rowToSession = (row) => {
  if (!row) return null;

  let sessionData = null;
  try {
    sessionData = row.session_data ? JSON.parse(row.session_data) : null;
  } catch (e) {
    console.error('Error parsing session_data:', e);
    sessionData = null;
  }

  return {
    id: row.id,
    planId: row.plan_id || null,
    topicId: row.topic_id,
    userId: row.user_id,
    sessionType: row.session_type,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    durationMinutes: row.duration_minutes || null,
    itemsReviewed: row.items_reviewed || 0,
    itemsCorrect: row.items_correct || 0,
    itemsNew: row.items_new || 0,
    sessionData,
  };
};

/**
 * Convert database row to performance object
 */
const rowToPerformance = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    topicId: row.topic_id,
    itemId: row.item_id,
    itemType: row.item_type,
    reviewedAt: new Date(row.reviewed_at),
    wasCorrect: row.was_correct === 1,
    responseTimeMs: row.response_time_ms || null,
    confidenceLevel: row.confidence_level || null,
    mistakeType: row.mistake_type || null,
    difficultyRating: row.difficulty_rating || null,
    masteryBefore: row.mastery_before || null,
    masteryAfter: row.mastery_after || null,
    sessionId: row.session_id || null,
  };
};

// =============================================================================
// SESSION OPERATIONS
// =============================================================================

/**
 * Get a learning session by ID
 * @param {string} id - Session ID
 * @param {string} token - User token
 * @returns {Object|null} Session object or null
 */
export const getLearningSessionById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getLearningSessionById: invalid session');
    return null;
  }
  try {
    const stmt = db.prepare(
      'SELECT * FROM learning_session WHERE id = ? AND user_id = ?',
    );
    const row = stmt.get(id, userId);
    return rowToSession(row);
  } catch (err) {
    console.error('getLearningSessionById error:', err);
    return null;
  }
};

/**
 * Get learning sessions for a topic
 * @param {string} topicId - Topic ID
 * @param {string} token - User token
 * @param {Object} options - Query options
 * @returns {Array} Array of session objects
 */
export const getSessionsByTopic = (topicId, token, options = {}) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getSessionsByTopic: invalid session');
    return [];
  }

  const { limit = 50, offset = 0 } = options;

  try {
    const stmt = db.prepare(`
      SELECT * FROM learning_session
      WHERE topic_id = ? AND user_id = ?
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(topicId, userId, limit, offset);
    return rows.map(rowToSession);
  } catch (err) {
    console.error('getSessionsByTopic error:', err);
    return [];
  }
};

/**
 * Get recent sessions for a user
 * @param {string} token - User token
 * @param {number} days - Number of days to look back
 * @returns {Array} Array of session objects
 */
export const getRecentSessions = (token, days = 7) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getRecentSessions: invalid session');
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT * FROM learning_session
      WHERE user_id = ?
        AND started_at >= datetime('now', '-' || ? || ' days')
      ORDER BY started_at DESC
    `);
    const rows = stmt.all(userId, days);
    return rows.map(rowToSession);
  } catch (err) {
    console.error('getRecentSessions error:', err);
    return [];
  }
};

/**
 * Start a new learning session
 * @param {Object} session - Session data
 * @param {string} token - User token
 * @returns {Object} Created session with ID
 */
export const startLearningSession = (session, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('startLearningSession: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const id = generateSessionId();
    const now = dateToSQLiteString(new Date());

    const stmt = db.prepare(`
      INSERT INTO learning_session (
        id, plan_id, topic_id, user_id, session_type,
        started_at, completed_at, duration_minutes,
        items_reviewed, items_correct, items_new, session_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      session.planId || null,
      session.topicId,
      userId,
      session.sessionType,
      now,
      null, // completedAt
      null, // durationMinutes
      0, // itemsReviewed
      0, // itemsCorrect
      0, // itemsNew
      null, // sessionData
    );

    return getLearningSessionById(id, token);
  } catch (err) {
    console.error('startLearningSession error:', err);
    return { error: err.message };
  }
};

/**
 * Complete a learning session
 * @param {string} id - Session ID
 * @param {Object} results - Session results
 * @param {string} token - User token
 * @returns {Object} Updated session
 */
export const completeLearningSession = (id, results, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('completeLearningSession: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const session = getLearningSessionById(id, token);
    if (!session) {
      return { error: 'Session not found' };
    }

    const now = new Date();
    const startedAt = new Date(session.startedAt);
    const durationMinutes = Math.round(
      (now.getTime() - startedAt.getTime()) / 60000,
    );

    const sessionDataJson = results.sessionData
      ? JSON.stringify(results.sessionData)
      : null;

    const stmt = db.prepare(`
      UPDATE learning_session SET
        completed_at = ?,
        duration_minutes = ?,
        items_reviewed = ?,
        items_correct = ?,
        items_new = ?,
        session_data = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(
      dateToSQLiteString(now),
      durationMinutes,
      results.itemsReviewed || 0,
      results.itemsCorrect || 0,
      results.itemsNew || 0,
      sessionDataJson,
      id,
      userId,
    );

    return getLearningSessionById(id, token);
  } catch (err) {
    console.error('completeLearningSession error:', err);
    return { error: err.message };
  }
};

/**
 * Update session in progress
 * @param {string} id - Session ID
 * @param {Object} updates - Incremental updates
 * @param {string} token - User token
 * @returns {Object} Updated session
 */
export const updateSessionProgress = (id, updates, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('updateSessionProgress: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const session = getLearningSessionById(id, token);
    if (!session) {
      return { error: 'Session not found' };
    }

    const newItemsReviewed =
      session.itemsReviewed + (updates.itemsReviewedIncrement || 0);
    const newItemsCorrect =
      session.itemsCorrect + (updates.itemsCorrectIncrement || 0);
    const newItemsNew = session.itemsNew + (updates.itemsNewIncrement || 0);

    // Merge session data
    let newSessionData = session.sessionData || {};
    if (updates.sessionData) {
      newSessionData = {
        ...newSessionData,
        ...updates.sessionData,
        itemResults: [
          ...(newSessionData.itemResults || []),
          ...(updates.sessionData.itemResults || []),
        ],
      };
    }

    const stmt = db.prepare(`
      UPDATE learning_session SET
        items_reviewed = ?,
        items_correct = ?,
        items_new = ?,
        session_data = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(
      newItemsReviewed,
      newItemsCorrect,
      newItemsNew,
      JSON.stringify(newSessionData),
      id,
      userId,
    );

    return getLearningSessionById(id, token);
  } catch (err) {
    console.error('updateSessionProgress error:', err);
    return { error: err.message };
  }
};

/**
 * Delete a learning session
 * @param {string} id - Session ID
 * @param {string} token - User token
 * @returns {Object} Success/error status
 */
export const deleteLearningSession = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('deleteLearningSession: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const stmt = db.prepare(
      'DELETE FROM learning_session WHERE id = ? AND user_id = ?',
    );
    const result = stmt.run(id, userId);
    return { success: result.changes > 0 };
  } catch (err) {
    console.error('deleteLearningSession error:', err);
    return { error: err.message };
  }
};

// =============================================================================
// ITEM PERFORMANCE OPERATIONS
// =============================================================================

/**
 * Record item performance
 * @param {Object} performance - Performance data
 * @param {string} token - User token
 * @returns {Object} Created performance record
 */
export const recordItemPerformance = (performance, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('recordItemPerformance: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const now = dateToSQLiteString(new Date());

    const stmt = db.prepare(`
      INSERT INTO learning_item_performance (
        user_id, topic_id, item_id, item_type, reviewed_at,
        was_correct, response_time_ms, confidence_level,
        mistake_type, difficulty_rating, mastery_before,
        mastery_after, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      performance.topicId,
      performance.itemId,
      performance.itemType,
      now,
      performance.wasCorrect ? 1 : 0,
      performance.responseTimeMs || null,
      performance.confidenceLevel || null,
      performance.mistakeType || null,
      performance.difficultyRating || null,
      performance.masteryBefore || null,
      performance.masteryAfter || null,
      performance.sessionId || null,
    );

    return {
      id: result.lastInsertRowid,
      ...performance,
      reviewedAt: new Date(),
    };
  } catch (err) {
    console.error('recordItemPerformance error:', err);
    return { error: err.message };
  }
};

/**
 * Get performance history for an item
 * @param {string} topicId - Topic ID
 * @param {string} itemId - Item ID
 * @param {string} token - User token
 * @param {Object} options - Query options
 * @returns {Array} Array of performance records
 */
export const getItemPerformanceHistory = (
  topicId,
  itemId,
  token,
  options = {},
) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getItemPerformanceHistory: invalid session');
    return [];
  }

  const { limit = 50 } = options;

  try {
    const stmt = db.prepare(`
      SELECT * FROM learning_item_performance
      WHERE user_id = ? AND topic_id = ? AND item_id = ?
      ORDER BY reviewed_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(userId, topicId, itemId, limit);
    return rows.map(rowToPerformance);
  } catch (err) {
    console.error('getItemPerformanceHistory error:', err);
    return [];
  }
};

/**
 * Get item performance summary
 * @param {string} topicId - Topic ID
 * @param {string} itemId - Item ID
 * @param {string} token - User token
 * @returns {Object} Performance summary
 */
export const getItemPerformanceSummary = (topicId, itemId, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getItemPerformanceSummary: invalid session');
    return null;
  }

  try {
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total_reviews,
        SUM(was_correct) as correct_count,
        AVG(response_time_ms) as avg_response_time,
        AVG(confidence_level) as avg_confidence,
        MAX(reviewed_at) as last_reviewed,
        MAX(mastery_after) as current_mastery
      FROM learning_item_performance
      WHERE user_id = ? AND topic_id = ? AND item_id = ?
    `);
    const row = stmt.get(userId, topicId, itemId);

    if (!row || row.total_reviews === 0) {
      return {
        itemId,
        topicId,
        totalReviews: 0,
        accuracy: 0,
        avgResponseTimeMs: null,
        avgConfidence: null,
        lastReviewed: null,
        currentMastery: 0,
      };
    }

    return {
      itemId,
      topicId,
      totalReviews: row.total_reviews,
      correctCount: row.correct_count,
      accuracy: (row.correct_count / row.total_reviews) * 100,
      avgResponseTimeMs: row.avg_response_time,
      avgConfidence: row.avg_confidence,
      lastReviewed: row.last_reviewed ? new Date(row.last_reviewed) : null,
      currentMastery: row.current_mastery || 0,
    };
  } catch (err) {
    console.error('getItemPerformanceSummary error:', err);
    return null;
  }
};

/**
 * Get weak items (low accuracy or mastery)
 * @param {string} topicId - Topic ID
 * @param {string} token - User token
 * @param {number} limit - Number of items to return
 * @returns {Array} Array of weak item summaries
 */
export const getWeakItems = (topicId, token, limit = 10) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getWeakItems: invalid session');
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT
        item_id,
        item_type,
        COUNT(*) as total_reviews,
        SUM(was_correct) as correct_count,
        CAST(SUM(was_correct) AS REAL) / COUNT(*) as accuracy,
        MAX(mastery_after) as current_mastery
      FROM learning_item_performance
      WHERE user_id = ? AND topic_id = ?
      GROUP BY item_id
      HAVING total_reviews >= 2
      ORDER BY accuracy ASC, current_mastery ASC
      LIMIT ?
    `);
    const rows = stmt.all(userId, topicId, limit);

    return rows.map((row) => ({
      itemId: row.item_id,
      itemType: row.item_type,
      totalReviews: row.total_reviews,
      correctCount: row.correct_count,
      accuracy: row.accuracy * 100,
      currentMastery: row.current_mastery || 0,
    }));
  } catch (err) {
    console.error('getWeakItems error:', err);
    return [];
  }
};

/**
 * Get common mistake types for a topic
 * @param {string} topicId - Topic ID
 * @param {string} token - User token
 * @returns {Array} Array of mistake type counts
 */
export const getMistakePatterns = (topicId, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getMistakePatterns: invalid session');
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT
        mistake_type,
        COUNT(*) as count
      FROM learning_item_performance
      WHERE user_id = ? AND topic_id = ?
        AND was_correct = 0
        AND mistake_type IS NOT NULL
      GROUP BY mistake_type
      ORDER BY count DESC
      LIMIT 10
    `);
    const rows = stmt.all(userId, topicId);

    return rows.map((row) => ({
      mistakeType: row.mistake_type,
      count: row.count,
    }));
  } catch (err) {
    console.error('getMistakePatterns error:', err);
    return [];
  }
};

// =============================================================================
// STATISTICS AND ANALYTICS
// =============================================================================

/**
 * Get daily activity summary
 * @param {string} token - User token
 * @param {number} days - Number of days to look back
 * @returns {Array} Array of daily activity objects
 */
export const getDailyActivity = (token, days = 30) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getDailyActivity: invalid session');
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT
        date(started_at) as date,
        topic_id,
        COUNT(*) as sessions_count,
        SUM(duration_minutes) as total_minutes,
        SUM(items_reviewed) as items_reviewed,
        SUM(items_correct) as items_correct,
        SUM(items_new) as new_items_learned
      FROM learning_session
      WHERE user_id = ?
        AND started_at >= datetime('now', '-' || ? || ' days')
        AND completed_at IS NOT NULL
      GROUP BY date(started_at), topic_id
      ORDER BY date DESC
    `);
    const rows = stmt.all(userId, days);

    return rows.map((row) => ({
      date: new Date(row.date),
      topicId: row.topic_id,
      sessionsCount: row.sessions_count,
      totalMinutes: row.total_minutes || 0,
      itemsReviewed: row.items_reviewed || 0,
      itemsCorrect: row.items_correct || 0,
      newItemsLearned: row.new_items_learned || 0,
      accuracy:
        row.items_reviewed > 0
          ? (row.items_correct / row.items_reviewed) * 100
          : 0,
    }));
  } catch (err) {
    console.error('getDailyActivity error:', err);
    return [];
  }
};

/**
 * Get overall learning statistics for a user
 * @param {string} token - User token
 * @returns {Object} Overall statistics
 */
export const getOverallStatistics = (token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getOverallStatistics: invalid session');
    return null;
  }

  try {
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(duration_minutes) as total_minutes,
        AVG(duration_minutes) as avg_session_minutes,
        SUM(items_reviewed) as total_items_reviewed,
        SUM(items_correct) as total_items_correct,
        SUM(items_new) as total_items_new
      FROM learning_session
      WHERE user_id = ? AND completed_at IS NOT NULL
    `);
    const stats = stmt.get(userId) || {};

    // Get sessions in last 7 days
    const recentStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM learning_session
      WHERE user_id = ?
        AND started_at >= datetime('now', '-7 days')
        AND completed_at IS NOT NULL
    `);
    const recent = recentStmt.get(userId) || {};

    // Get active topics count
    const topicsStmt = db.prepare(`
      SELECT COUNT(DISTINCT topic_id) as active_topics
      FROM learning_session
      WHERE user_id = ?
        AND started_at >= datetime('now', '-30 days')
    `);
    const topics = topicsStmt.get(userId) || {};

    return {
      totalSessions: stats.total_sessions || 0,
      totalMinutes: stats.total_minutes || 0,
      avgSessionMinutes: stats.avg_session_minutes || 0,
      totalItemsReviewed: stats.total_items_reviewed || 0,
      totalItemsCorrect: stats.total_items_correct || 0,
      totalItemsNew: stats.total_items_new || 0,
      overallAccuracy:
        stats.total_items_reviewed > 0
          ? (stats.total_items_correct / stats.total_items_reviewed) * 100
          : 0,
      sessionsLast7Days: recent.count || 0,
      activeTopics: topics.active_topics || 0,
    };
  } catch (err) {
    console.error('getOverallStatistics error:', err);
    return null;
  }
};

export default {
  // Session operations
  getLearningSessionById,
  getSessionsByTopic,
  getRecentSessions,
  startLearningSession,
  completeLearningSession,
  updateSessionProgress,
  deleteLearningSession,
  // Performance operations
  recordItemPerformance,
  getItemPerformanceHistory,
  getItemPerformanceSummary,
  getWeakItems,
  getMistakePatterns,
  // Statistics
  getDailyActivity,
  getOverallStatistics,
};
