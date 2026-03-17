/**
 * LearningTopicManager.js
 *
 * Database manager for learning_topic table.
 * Handles CRUD operations for learning topics in the AI Learning Companion.
 *
 * Table Schema:
 * CREATE TABLE "learning_topic" (
 *   "id" TEXT PRIMARY KEY,
 *   "user_id" INTEGER NOT NULL,
 *   "name" TEXT NOT NULL,
 *   "description" TEXT,
 *   "domain_type" TEXT NOT NULL,
 *   "source_type" TEXT,
 *   "source_id" TEXT,
 *   "target_date" TEXT,
 *   "daily_time_minutes" INTEGER DEFAULT 15,
 *   "difficulty" TEXT DEFAULT 'auto',
 *   "status" TEXT DEFAULT 'planning',
 *   "progress_percent" REAL DEFAULT 0,
 *   "mastered_items" INTEGER DEFAULT 0,
 *   "total_items" INTEGER DEFAULT 0,
 *   "streak_days" INTEGER DEFAULT 0,
 *   "last_studied_at" TEXT,
 *   "created_at" TEXT NOT NULL,
 *   "updated_at" TEXT
 * );
 */

import db, { getUserIdFromToken } from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

/**
 * Initialize tables if they don't exist
 */
const initializeTables = () => {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "learning_topic" (
        "id" TEXT PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "domain_type" TEXT NOT NULL,
        "source_type" TEXT,
        "source_id" TEXT,
        "target_date" TEXT,
        "daily_time_minutes" INTEGER DEFAULT 15,
        "difficulty" TEXT DEFAULT 'auto',
        "status" TEXT DEFAULT 'planning',
        "progress_percent" REAL DEFAULT 0,
        "mastered_items" INTEGER DEFAULT 0,
        "total_items" INTEGER DEFAULT 0,
        "streak_days" INTEGER DEFAULT 0,
        "last_studied_at" TEXT,
        "created_at" TEXT NOT NULL,
        "updated_at" TEXT,
        FOREIGN KEY ("user_id") REFERENCES "user"("id")
      )
    `).run();

    // Create indexes
    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_learning_topic_user"
      ON "learning_topic"("user_id", "status")
    `).run();
  } catch (error) {
    console.error('Error initializing learning topic table:', error);
  }
};

// Initialize tables on module load
initializeTables();

/**
 * Generate a unique topic ID
 */
const generateTopicId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `topic_${timestamp}_${randomPart}`;
};

/**
 * Convert database row to topic object
 */
const rowToTopic = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description || null,
    domainType: row.domain_type,
    sourceType: row.source_type || null,
    sourceId: row.source_id || null,
    targetDate: row.target_date ? new Date(row.target_date) : null,
    dailyTimeMinutes: row.daily_time_minutes || 15,
    difficulty: row.difficulty || 'auto',
    status: row.status || 'planning',
    progressPercent: row.progress_percent || 0,
    masteredItems: row.mastered_items || 0,
    totalItems: row.total_items || 0,
    streakDays: row.streak_days || 0,
    lastStudiedAt: row.last_studied_at ? new Date(row.last_studied_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

/**
 * Get a learning topic by ID
 * @param {string} id - Topic ID
 * @param {string} token - User token
 * @returns {Object|null} Topic object or null
 */
export const getLearningTopicById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getLearningTopicById: invalid session');
    return null;
  }
  try {
    const stmt = db.prepare(
      'SELECT * FROM learning_topic WHERE id = ? AND user_id = ?',
    );
    const row = stmt.get(id, userId);
    return rowToTopic(row);
  } catch (err) {
    console.error('getLearningTopicById error:', err);
    return null;
  }
};

/**
 * Get all learning topics for a user
 * @param {string} token - User token
 * @param {Object} options - Query options
 * @returns {Array} Array of topic objects
 */
export const getLearningTopics = (token, options = {}) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getLearningTopics: invalid session');
    return [];
  }

  const { status, domainType, limit = 100, offset = 0 } = options;

  try {
    let query = 'SELECT * FROM learning_topic WHERE user_id = ?';
    const params = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (domainType) {
      query += ' AND domain_type = ?';
      params.push(domainType);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(rowToTopic);
  } catch (err) {
    console.error('getLearningTopics error:', err);
    return [];
  }
};

/**
 * Get active learning topics (for dashboard)
 * @param {string} token - User token
 * @returns {Array} Array of active topic objects
 */
export const getActiveTopics = (token) => {
  return getLearningTopics(token, { status: 'active' });
};

/**
 * Get topics by source (e.g., topics for a specific book)
 * @param {string} sourceType - Source type (book, vocabulary_set, url, etc.)
 * @param {string} sourceId - Source ID
 * @param {string} token - User token
 * @returns {Array} Array of topic objects
 */
export const getTopicsBySource = (sourceType, sourceId, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getTopicsBySource: invalid session');
    return [];
  }

  try {
    const stmt = db.prepare(
      'SELECT * FROM learning_topic WHERE user_id = ? AND source_type = ? AND source_id = ?',
    );
    const rows = stmt.all(userId, sourceType, sourceId);
    return rows.map(rowToTopic);
  } catch (err) {
    console.error('getTopicsBySource error:', err);
    return [];
  }
};

/**
 * Create a new learning topic
 * @param {Object} topic - Topic data
 * @param {string} token - User token
 * @returns {Object} Created topic with ID
 */
export const createLearningTopic = (topic, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('createLearningTopic: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const id = generateTopicId();
    const now = dateToSQLiteString(new Date());
    const targetDate = topic.targetDate
      ? dateToSQLiteString(new Date(topic.targetDate))
      : null;

    const stmt = db.prepare(`
      INSERT INTO learning_topic (
        id, user_id, name, description, domain_type,
        source_type, source_id, target_date, daily_time_minutes,
        difficulty, status, progress_percent, mastered_items,
        total_items, streak_days, last_studied_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      topic.name,
      topic.description || null,
      topic.domainType,
      topic.sourceType || null,
      topic.sourceId || null,
      targetDate,
      topic.dailyTimeMinutes || 15,
      topic.difficulty || 'auto',
      topic.status || 'planning',
      topic.progressPercent || 0,
      topic.masteredItems || 0,
      topic.totalItems || 0,
      topic.streakDays || 0,
      null, // lastStudiedAt
      now,
      null, // updatedAt
    );

    return getLearningTopicById(id, token);
  } catch (err) {
    console.error('createLearningTopic error:', err);
    return { error: err.message };
  }
};

/**
 * Update a learning topic
 * @param {string} id - Topic ID
 * @param {Object} updates - Fields to update
 * @param {string} token - User token
 * @returns {Object} Updated topic
 */
export const updateLearningTopic = (id, updates, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('updateLearningTopic: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    // Build dynamic update query
    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.targetDate !== undefined) {
      fields.push('target_date = ?');
      values.push(
        updates.targetDate
          ? dateToSQLiteString(new Date(updates.targetDate))
          : null,
      );
    }
    if (updates.dailyTimeMinutes !== undefined) {
      fields.push('daily_time_minutes = ?');
      values.push(updates.dailyTimeMinutes);
    }
    if (updates.difficulty !== undefined) {
      fields.push('difficulty = ?');
      values.push(updates.difficulty);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.progressPercent !== undefined) {
      fields.push('progress_percent = ?');
      values.push(updates.progressPercent);
    }
    if (updates.masteredItems !== undefined) {
      fields.push('mastered_items = ?');
      values.push(updates.masteredItems);
    }
    if (updates.totalItems !== undefined) {
      fields.push('total_items = ?');
      values.push(updates.totalItems);
    }
    if (updates.streakDays !== undefined) {
      fields.push('streak_days = ?');
      values.push(updates.streakDays);
    }
    if (updates.lastStudiedAt !== undefined) {
      fields.push('last_studied_at = ?');
      values.push(
        updates.lastStudiedAt
          ? dateToSQLiteString(new Date(updates.lastStudiedAt))
          : null,
      );
    }

    if (fields.length === 0) {
      return getLearningTopicById(id, token);
    }

    // Add updated_at
    fields.push('updated_at = ?');
    values.push(dateToSQLiteString(new Date()));

    // Add WHERE clause params
    values.push(id, userId);

    const query = `UPDATE learning_topic SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
    const stmt = db.prepare(query);
    stmt.run(...values);

    return getLearningTopicById(id, token);
  } catch (err) {
    console.error('updateLearningTopic error:', err);
    return { error: err.message };
  }
};

/**
 * Delete a learning topic
 * @param {string} id - Topic ID
 * @param {string} token - User token
 * @returns {Object} Success/error status
 */
export const deleteLearningTopic = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('deleteLearningTopic: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const stmt = db.prepare(
      'DELETE FROM learning_topic WHERE id = ? AND user_id = ?',
    );
    const result = stmt.run(id, userId);
    return { success: result.changes > 0 };
  } catch (err) {
    console.error('deleteLearningTopic error:', err);
    return { error: err.message };
  }
};

/**
 * Update topic progress after a study session
 * @param {string} id - Topic ID
 * @param {Object} sessionResult - Session results
 * @param {string} token - User token
 * @returns {Object} Updated topic
 */
export const updateTopicProgress = (id, sessionResult, token) => {
  const topic = getLearningTopicById(id, token);
  if (!topic || topic.error) {
    return { error: 'Topic not found' };
  }

  const now = new Date();
  const lastStudied = topic.lastStudiedAt;

  // Calculate streak
  let newStreak = topic.streakDays;
  if (lastStudied) {
    const daysSinceLastStudy = Math.floor(
      (now.getTime() - lastStudied.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceLastStudy === 0) {
      // Same day, no change to streak
    } else if (daysSinceLastStudy === 1) {
      // Consecutive day, increment streak
      newStreak += 1;
    } else {
      // Streak broken, reset
      newStreak = 1;
    }
  } else {
    // First study session
    newStreak = 1;
  }

  // Calculate new mastered items
  const newMastered = topic.masteredItems + (sessionResult.newlyMastered || 0);

  // Calculate progress percent
  const newProgress =
    topic.totalItems > 0 ? (newMastered / topic.totalItems) * 100 : 0;

  return updateLearningTopic(
    id,
    {
      masteredItems: newMastered,
      progressPercent: newProgress,
      streakDays: newStreak,
      lastStudiedAt: now,
    },
    token,
  );
};

/**
 * Get topic statistics
 * @param {string} id - Topic ID
 * @param {string} token - User token
 * @returns {Object} Topic statistics
 */
export const getTopicStatistics = (id, token) => {
  const topic = getLearningTopicById(id, token);
  if (!topic || topic.error) {
    return { error: 'Topic not found' };
  }

  const userId = getUserIdFromToken(token);

  try {
    // Get session stats
    const sessionStmt = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(duration_minutes) as total_minutes,
        AVG(duration_minutes) as avg_session_minutes,
        SUM(items_reviewed) as total_items_reviewed,
        SUM(items_correct) as total_items_correct
      FROM learning_session
      WHERE topic_id = ? AND user_id = ?
    `);
    const sessionStats = sessionStmt.get(id, userId) || {};

    // Get recent sessions (last 7 days)
    const recentStmt = db.prepare(`
      SELECT COUNT(*) as sessions_last_7_days
      FROM learning_session
      WHERE topic_id = ? AND user_id = ?
        AND started_at >= datetime('now', '-7 days')
    `);
    const recentStats = recentStmt.get(id, userId) || {};

    // Get items due for review
    const dueStmt = db.prepare(`
      SELECT
        SUM(CASE WHEN l.next_review <= datetime('now') THEN 1 ELSE 0 END) as items_due_today,
        SUM(CASE WHEN l.next_review < datetime('now', '-1 day') THEN 1 ELSE 0 END) as items_overdue
      FROM vocabulary v
      JOIN leitner_item l ON v.leitner_item_id = l.id
      WHERE v.user_id = ?
    `);
    // Note: This query is simplified - would need adjustment based on actual topic-item relationship

    const accuracy =
      sessionStats.total_items_reviewed > 0
        ? (sessionStats.total_items_correct / sessionStats.total_items_reviewed) *
          100
        : 0;

    return {
      topicId: id,
      totalItems: topic.totalItems,
      masteredItems: topic.masteredItems,
      inProgressItems: topic.totalItems - topic.masteredItems,
      pendingItems: 0, // Would need item-level tracking
      progressPercent: topic.progressPercent,
      totalTimeMinutes: sessionStats.total_minutes || 0,
      averageSessionMinutes: sessionStats.avg_session_minutes || 0,
      totalSessions: sessionStats.total_sessions || 0,
      overallAccuracy: accuracy,
      currentStreak: topic.streakDays,
      lastSessionAt: topic.lastStudiedAt,
      sessionsLast7Days: recentStats.sessions_last_7_days || 0,
    };
  } catch (err) {
    console.error('getTopicStatistics error:', err);
    return { error: err.message };
  }
};

/**
 * Count topics by status
 * @param {string} token - User token
 * @returns {Object} Count per status
 */
export const countTopicsByStatus = (token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    return { error: 'Invalid session' };
  }

  try {
    const stmt = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM learning_topic
      WHERE user_id = ?
      GROUP BY status
    `);
    const rows = stmt.all(userId);

    const counts = {
      planning: 0,
      active: 0,
      paused: 0,
      completed: 0,
      archived: 0,
      total: 0,
    };

    rows.forEach((row) => {
      counts[row.status] = row.count;
      counts.total += row.count;
    });

    return counts;
  } catch (err) {
    console.error('countTopicsByStatus error:', err);
    return { error: err.message };
  }
};

export default {
  getLearningTopicById,
  getLearningTopics,
  getActiveTopics,
  getTopicsBySource,
  createLearningTopic,
  updateLearningTopic,
  deleteLearningTopic,
  updateTopicProgress,
  getTopicStatistics,
  countTopicsByStatus,
};
