/**
 * SessionAnalyticsManager.js
 *
 * Advanced analytics manager for study sessions.
 * Extends LearningSessionManager with:
 * - Performance trends over time
 * - Learning velocity tracking (% mastery change per period)
 * - Optimal study time analysis
 * - Session pattern detection
 * - Export functionality
 *
 * Table Schema (extends learning_session):
 *
 * CREATE TABLE IF NOT EXISTS "session_analytics" (
 *   "id" INTEGER PRIMARY KEY AUTOINCREMENT,
 *   "session_id" TEXT NOT NULL,
 *   "user_id" INTEGER NOT NULL,
 *   "hour_of_day" INTEGER,
 *   "day_of_week" INTEGER,
 *   "focus_score" REAL,
 *   "efficiency_score" REAL,
 *   "avg_response_time_ms" INTEGER,
 *   "retention_rate" REAL,
 *   "streak_length" INTEGER,
 *   "hints_used" INTEGER DEFAULT 0,
 *   "concepts_improved" TEXT,
 *   "created_at" TEXT NOT NULL
 * );
 */

import db, { getUserIdFromToken } from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

/**
 * Initialize analytics tables
 */
export const initAnalyticsTables = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "session_analytics" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "session_id" TEXT NOT NULL,
        "user_id" INTEGER NOT NULL,
        "hour_of_day" INTEGER,
        "day_of_week" INTEGER,
        "focus_score" REAL,
        "efficiency_score" REAL,
        "avg_response_time_ms" INTEGER,
        "retention_rate" REAL,
        "streak_length" INTEGER,
        "hints_used" INTEGER DEFAULT 0,
        "concepts_improved" TEXT,
        "created_at" TEXT NOT NULL,
        UNIQUE(session_id)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_analytics_user
      ON session_analytics(user_id, created_at)
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS "learning_velocity" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER NOT NULL,
        "topic_id" TEXT,
        "date" TEXT NOT NULL,
        "mastery_start" REAL,
        "mastery_end" REAL,
        "velocity" REAL,
        "items_studied" INTEGER,
        "time_spent_minutes" INTEGER,
        "created_at" TEXT NOT NULL
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_learning_velocity_user_date
      ON learning_velocity(user_id, date)
    `);

    return true;
  } catch (err) {
    console.error('initAnalyticsTables error:', err);
    return false;
  }
};

// =============================================================================
// SESSION ANALYTICS
// =============================================================================

/**
 * Record session analytics
 * @param {string} sessionId - Session ID
 * @param {Object} analytics - Analytics data
 * @param {string} token - User token
 */
export const recordSessionAnalytics = (sessionId, analytics, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    return { error: 'Invalid session' };
  }

  try {
    const now = new Date();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO session_analytics (
        session_id, user_id, hour_of_day, day_of_week,
        focus_score, efficiency_score, avg_response_time_ms,
        retention_rate, streak_length, hints_used,
        concepts_improved, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      userId,
      now.getHours(),
      now.getDay(),
      analytics.focusScore || null,
      analytics.efficiencyScore || null,
      analytics.avgResponseTimeMs || null,
      analytics.retentionRate || null,
      analytics.streakLength || 0,
      analytics.hintsUsed || 0,
      analytics.conceptsImproved
        ? JSON.stringify(analytics.conceptsImproved)
        : null,
      dateToSQLiteString(now),
    );

    return { success: true };
  } catch (err) {
    console.error('recordSessionAnalytics error:', err);
    return { error: err.message };
  }
};

/**
 * Get session analytics by ID
 * @param {string} sessionId - Session ID
 * @param {string} token - User token
 */
export const getSessionAnalytics = (sessionId, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;

  try {
    const stmt = db.prepare(`
      SELECT * FROM session_analytics
      WHERE session_id = ? AND user_id = ?
    `);
    const row = stmt.get(sessionId, userId);
    return row ? rowToAnalytics(row) : null;
  } catch (err) {
    console.error('getSessionAnalytics error:', err);
    return null;
  }
};

const rowToAnalytics = (row) => {
  let conceptsImproved = null;
  try {
    conceptsImproved = row.concepts_improved
      ? JSON.parse(row.concepts_improved)
      : null;
  } catch (e) {
    conceptsImproved = null;
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    hourOfDay: row.hour_of_day,
    dayOfWeek: row.day_of_week,
    focusScore: row.focus_score,
    efficiencyScore: row.efficiency_score,
    avgResponseTimeMs: row.avg_response_time_ms,
    retentionRate: row.retention_rate,
    streakLength: row.streak_length,
    hintsUsed: row.hints_used,
    conceptsImproved,
    createdAt: new Date(row.created_at),
  };
};

// =============================================================================
// PERFORMANCE TRENDS
// =============================================================================

/**
 * Get performance trends over time
 * @param {string} token - User token
 * @param {number} days - Number of days to analyze
 * @param {string} topicId - Optional topic filter
 */
export const getPerformanceTrends = (token, days = 30, topicId = null) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];

  try {
    let query = `
      SELECT
        date(ls.started_at) as date,
        COUNT(*) as sessions_count,
        SUM(ls.duration_minutes) as total_minutes,
        SUM(ls.items_reviewed) as total_items,
        SUM(ls.items_correct) as total_correct,
        AVG(sa.focus_score) as avg_focus,
        AVG(sa.efficiency_score) as avg_efficiency,
        AVG(sa.avg_response_time_ms) as avg_response_time,
        AVG(sa.retention_rate) as avg_retention
      FROM learning_session ls
      LEFT JOIN session_analytics sa ON ls.id = sa.session_id
      WHERE ls.user_id = ?
        AND ls.started_at >= datetime('now', '-' || ? || ' days')
        AND ls.completed_at IS NOT NULL
    `;

    const params = [userId, days];

    if (topicId) {
      query += ' AND ls.topic_id = ?';
      params.push(topicId);
    }

    query += `
      GROUP BY date(ls.started_at)
      ORDER BY date ASC
    `;

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map((row) => ({
      date: row.date,
      sessionsCount: row.sessions_count,
      totalMinutes: row.total_minutes || 0,
      totalItems: row.total_items || 0,
      totalCorrect: row.total_correct || 0,
      accuracy:
        row.total_items > 0 ? (row.total_correct / row.total_items) * 100 : 0,
      avgFocus: row.avg_focus,
      avgEfficiency: row.avg_efficiency,
      avgResponseTimeMs: row.avg_response_time,
      avgRetention: row.avg_retention,
    }));
  } catch (err) {
    console.error('getPerformanceTrends error:', err);
    return [];
  }
};

/**
 * Get weekly performance summary
 * @param {string} token - User token
 * @param {number} weeks - Number of weeks
 */
export const getWeeklyPerformance = (token, weeks = 8) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];

  try {
    const stmt = db.prepare(`
      SELECT
        strftime('%Y-%W', started_at) as week,
        MIN(date(started_at)) as week_start,
        COUNT(*) as sessions_count,
        SUM(duration_minutes) as total_minutes,
        SUM(items_reviewed) as total_items,
        SUM(items_correct) as total_correct,
        COUNT(DISTINCT topic_id) as topics_studied
      FROM learning_session
      WHERE user_id = ?
        AND started_at >= datetime('now', '-' || ? || ' weeks')
        AND completed_at IS NOT NULL
      GROUP BY strftime('%Y-%W', started_at)
      ORDER BY week ASC
    `);

    const rows = stmt.all(userId, weeks);

    return rows.map((row) => ({
      week: row.week,
      weekStart: row.week_start,
      sessionsCount: row.sessions_count,
      totalMinutes: row.total_minutes || 0,
      totalItems: row.total_items || 0,
      totalCorrect: row.total_correct || 0,
      accuracy:
        row.total_items > 0 ? (row.total_correct / row.total_items) * 100 : 0,
      topicsStudied: row.topics_studied,
      avgMinutesPerSession:
        row.sessions_count > 0
          ? (row.total_minutes || 0) / row.sessions_count
          : 0,
    }));
  } catch (err) {
    console.error('getWeeklyPerformance error:', err);
    return [];
  }
};

// =============================================================================
// LEARNING VELOCITY
// =============================================================================

/**
 * Record learning velocity for a date
 * @param {Object} data - Velocity data
 * @param {string} token - User token
 */
export const recordLearningVelocity = (data, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    return { error: 'Invalid session' };
  }

  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Calculate velocity (% change per day)
    const velocity =
      data.masteryStart !== null && data.masteryStart !== undefined
        ? data.masteryEnd - data.masteryStart
        : data.masteryEnd;

    const stmt = db.prepare(`
      INSERT INTO learning_velocity (
        user_id, topic_id, date, mastery_start, mastery_end,
        velocity, items_studied, time_spent_minutes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      data.topicId || null,
      dateStr,
      data.masteryStart || 0,
      data.masteryEnd || 0,
      velocity,
      data.itemsStudied || 0,
      data.timeSpentMinutes || 0,
      dateToSQLiteString(now),
    );

    return { success: true, velocity };
  } catch (err) {
    console.error('recordLearningVelocity error:', err);
    return { error: err.message };
  }
};

/**
 * Get learning velocity trend
 * @param {string} token - User token
 * @param {number} days - Number of days
 * @param {string} topicId - Optional topic filter
 */
export const getLearningVelocity = (token, days = 30, topicId = null) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];

  try {
    let query = `
      SELECT
        date,
        AVG(mastery_start) as avg_mastery_start,
        AVG(mastery_end) as avg_mastery_end,
        AVG(velocity) as avg_velocity,
        SUM(items_studied) as total_items,
        SUM(time_spent_minutes) as total_minutes
      FROM learning_velocity
      WHERE user_id = ?
        AND date >= date('now', '-' || ? || ' days')
    `;

    const params = [userId, days];

    if (topicId) {
      query += ' AND topic_id = ?';
      params.push(topicId);
    }

    query += `
      GROUP BY date
      ORDER BY date ASC
    `;

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map((row) => ({
      date: row.date,
      avgMasteryStart: row.avg_mastery_start,
      avgMasteryEnd: row.avg_mastery_end,
      avgVelocity: row.avg_velocity,
      totalItems: row.total_items,
      totalMinutes: row.total_minutes,
    }));
  } catch (err) {
    console.error('getLearningVelocity error:', err);
    return [];
  }
};

/**
 * Calculate aggregate velocity over a period
 * @param {string} token - User token
 * @param {number} days - Period in days
 */
export const getAggregateVelocity = (token, days = 7) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;

  try {
    const stmt = db.prepare(`
      SELECT
        AVG(velocity) as avg_velocity,
        MAX(velocity) as max_velocity,
        MIN(velocity) as min_velocity,
        SUM(items_studied) as total_items,
        SUM(time_spent_minutes) as total_minutes,
        COUNT(DISTINCT date) as active_days
      FROM learning_velocity
      WHERE user_id = ?
        AND date >= date('now', '-' || ? || ' days')
    `);

    const row = stmt.get(userId, days);

    if (!row || row.active_days === 0) {
      return {
        avgVelocity: 0,
        maxVelocity: 0,
        minVelocity: 0,
        totalItems: 0,
        totalMinutes: 0,
        activeDays: 0,
        velocityPerWeek: 0,
      };
    }

    return {
      avgVelocity: row.avg_velocity || 0,
      maxVelocity: row.max_velocity || 0,
      minVelocity: row.min_velocity || 0,
      totalItems: row.total_items || 0,
      totalMinutes: row.total_minutes || 0,
      activeDays: row.active_days,
      velocityPerWeek: ((row.avg_velocity || 0) * 7).toFixed(2),
    };
  } catch (err) {
    console.error('getAggregateVelocity error:', err);
    return null;
  }
};

// =============================================================================
// OPTIMAL STUDY TIME ANALYSIS
// =============================================================================

/**
 * Analyze best study times based on performance
 * @param {string} token - User token
 * @param {number} days - Days to analyze
 */
export const analyzeOptimalStudyTimes = (token, days = 90) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;

  try {
    // Analyze by hour of day
    const hourlyStmt = db.prepare(`
      SELECT
        sa.hour_of_day,
        COUNT(*) as session_count,
        AVG(sa.focus_score) as avg_focus,
        AVG(sa.efficiency_score) as avg_efficiency,
        AVG(sa.retention_rate) as avg_retention,
        AVG(ls.items_correct * 1.0 / NULLIF(ls.items_reviewed, 0)) as avg_accuracy
      FROM session_analytics sa
      JOIN learning_session ls ON sa.session_id = ls.id
      WHERE sa.user_id = ?
        AND sa.created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY sa.hour_of_day
      HAVING session_count >= 3
      ORDER BY sa.hour_of_day
    `);

    const hourlyData = hourlyStmt.all(userId, days);

    // Analyze by day of week
    const dailyStmt = db.prepare(`
      SELECT
        sa.day_of_week,
        COUNT(*) as session_count,
        AVG(sa.focus_score) as avg_focus,
        AVG(sa.efficiency_score) as avg_efficiency,
        AVG(sa.retention_rate) as avg_retention,
        SUM(ls.duration_minutes) as total_minutes
      FROM session_analytics sa
      JOIN learning_session ls ON sa.session_id = ls.id
      WHERE sa.user_id = ?
        AND sa.created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY sa.day_of_week
      ORDER BY sa.day_of_week
    `);

    const dailyData = dailyStmt.all(userId, days);

    // Find optimal times
    const optimalHours = hourlyData
      .map((row) => ({
        hour: row.hour_of_day,
        sessions: row.session_count,
        score:
          (row.avg_focus || 0) * 0.3 +
          (row.avg_efficiency || 0) * 0.3 +
          (row.avg_retention || 0) * 0.2 +
          (row.avg_accuracy || 0) * 100 * 0.2,
      }))
      .sort((a, b) => b.score - a.score);

    const optimalDays = dailyData
      .map((row) => ({
        day: row.day_of_week,
        sessions: row.session_count,
        avgMinutes: row.session_count > 0 ? row.total_minutes / row.session_count : 0,
        score:
          (row.avg_focus || 0) * 0.35 +
          (row.avg_efficiency || 0) * 0.35 +
          (row.avg_retention || 0) * 0.3,
      }))
      .sort((a, b) => b.score - a.score);

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    return {
      hourlyBreakdown: hourlyData.map((row) => ({
        hour: row.hour_of_day,
        hourLabel: formatHour(row.hour_of_day),
        sessionCount: row.session_count,
        avgFocus: row.avg_focus,
        avgEfficiency: row.avg_efficiency,
        avgRetention: row.avg_retention,
        avgAccuracy: (row.avg_accuracy || 0) * 100,
      })),
      dailyBreakdown: dailyData.map((row) => ({
        day: row.day_of_week,
        dayName: dayNames[row.day_of_week],
        sessionCount: row.session_count,
        avgFocus: row.avg_focus,
        avgEfficiency: row.avg_efficiency,
        avgRetention: row.avg_retention,
        totalMinutes: row.total_minutes,
      })),
      recommendations: {
        bestHours: optimalHours.slice(0, 3).map((h) => ({
          hour: h.hour,
          label: formatHour(h.hour),
          score: h.score.toFixed(1),
        })),
        bestDays: optimalDays.slice(0, 2).map((d) => ({
          day: d.day,
          name: dayNames[d.day],
          score: d.score.toFixed(1),
        })),
        suggestion: generateStudyTimeSuggestion(optimalHours, optimalDays, dayNames),
      },
    };
  } catch (err) {
    console.error('analyzeOptimalStudyTimes error:', err);
    return null;
  }
};

const formatHour = (hour) => {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

const generateStudyTimeSuggestion = (optimalHours, optimalDays, dayNames) => {
  if (optimalHours.length === 0 || optimalDays.length === 0) {
    return 'Not enough data yet. Keep studying to get personalized recommendations!';
  }

  const bestHour = optimalHours[0];
  const bestDay = optimalDays[0];

  const timeOfDay =
    bestHour.hour < 12 ? 'morning' : bestHour.hour < 17 ? 'afternoon' : 'evening';

  return `Your best study time appears to be ${timeOfDay} hours (around ${formatHour(bestHour.hour)}), especially on ${dayNames[bestDay.day]}s. You tend to focus better and retain more during these times.`;
};

// =============================================================================
// WEAK ITEMS IDENTIFICATION
// =============================================================================

/**
 * Identify items that need more practice
 * @param {string} token - User token
 * @param {string} topicId - Optional topic filter
 * @param {number} limit - Max items to return
 */
export const identifyWeakItems = (token, topicId = null, limit = 20) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];

  try {
    let query = `
      SELECT
        lip.item_id,
        lip.item_type,
        lip.topic_id,
        COUNT(*) as review_count,
        SUM(lip.was_correct) as correct_count,
        AVG(lip.response_time_ms) as avg_response_time,
        MAX(lip.mastery_after) as current_mastery,
        MAX(lip.reviewed_at) as last_reviewed,
        CAST(SUM(lip.was_correct) AS REAL) / COUNT(*) as accuracy
      FROM learning_item_performance lip
      WHERE lip.user_id = ?
    `;

    const params = [userId];

    if (topicId) {
      query += ' AND lip.topic_id = ?';
      params.push(topicId);
    }

    query += `
      GROUP BY lip.item_id, lip.item_type, lip.topic_id
      HAVING review_count >= 2
      ORDER BY accuracy ASC, current_mastery ASC
      LIMIT ?
    `;

    params.push(limit);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map((row) => ({
      itemId: row.item_id,
      itemType: row.item_type,
      topicId: row.topic_id,
      reviewCount: row.review_count,
      correctCount: row.correct_count,
      accuracy: (row.accuracy * 100).toFixed(1),
      avgResponseTimeMs: Math.round(row.avg_response_time || 0),
      currentMastery: row.current_mastery || 0,
      lastReviewed: row.last_reviewed,
      weaknessReason: getWeaknessReason(row),
    }));
  } catch (err) {
    console.error('identifyWeakItems error:', err);
    return [];
  }
};

const getWeaknessReason = (item) => {
  const reasons = [];

  if (item.accuracy < 0.5) {
    reasons.push('Low accuracy (<50%)');
  } else if (item.accuracy < 0.7) {
    reasons.push('Below target accuracy');
  }

  if (item.current_mastery < 30) {
    reasons.push('Very low mastery');
  }

  if (item.avg_response_time > 10000) {
    reasons.push('Slow response time');
  }

  return reasons.join('; ') || 'Needs more practice';
};

// =============================================================================
// SESSION HISTORY
// =============================================================================

/**
 * Get detailed session history with analytics
 * @param {string} token - User token
 * @param {Object} options - Query options
 */
export const getSessionHistory = (token, options = {}) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return { sessions: [], total: 0 };

  const { limit = 20, offset = 0, topicId = null, days = null } = options;

  try {
    let countQuery = `
      SELECT COUNT(*) as total
      FROM learning_session ls
      WHERE ls.user_id = ?
        AND ls.completed_at IS NOT NULL
    `;

    let query = `
      SELECT
        ls.*,
        sa.focus_score,
        sa.efficiency_score,
        sa.avg_response_time_ms,
        sa.retention_rate,
        sa.streak_length,
        sa.hints_used
      FROM learning_session ls
      LEFT JOIN session_analytics sa ON ls.id = sa.session_id
      WHERE ls.user_id = ?
        AND ls.completed_at IS NOT NULL
    `;

    const params = [userId];
    const countParams = [userId];

    if (topicId) {
      query += ' AND ls.topic_id = ?';
      countQuery += ' AND ls.topic_id = ?';
      params.push(topicId);
      countParams.push(topicId);
    }

    if (days) {
      query += " AND ls.started_at >= datetime('now', '-' || ? || ' days')";
      countQuery += " AND ls.started_at >= datetime('now', '-' || ? || ' days')";
      params.push(days);
      countParams.push(days);
    }

    query += `
      ORDER BY ls.started_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const countStmt = db.prepare(countQuery);
    const totalRow = countStmt.get(...countParams);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    const sessions = rows.map((row) => {
      let sessionData = null;
      try {
        sessionData = row.session_data ? JSON.parse(row.session_data) : null;
      } catch (e) {
        sessionData = null;
      }

      return {
        id: row.id,
        topicId: row.topic_id,
        sessionType: row.session_type,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        durationMinutes: row.duration_minutes,
        itemsReviewed: row.items_reviewed,
        itemsCorrect: row.items_correct,
        itemsNew: row.items_new,
        accuracy:
          row.items_reviewed > 0
            ? ((row.items_correct / row.items_reviewed) * 100).toFixed(1)
            : '0',
        focusScore: row.focus_score,
        efficiencyScore: row.efficiency_score,
        avgResponseTimeMs: row.avg_response_time_ms,
        retentionRate: row.retention_rate,
        streakLength: row.streak_length,
        hintsUsed: row.hints_used,
        sessionData,
      };
    });

    return {
      sessions,
      total: totalRow?.total || 0,
      hasMore: offset + sessions.length < (totalRow?.total || 0),
    };
  } catch (err) {
    console.error('getSessionHistory error:', err);
    return { sessions: [], total: 0 };
  }
};

// =============================================================================
// EXPORT FUNCTIONALITY
// =============================================================================

/**
 * Export session data for a date range
 * @param {string} token - User token
 * @param {Object} options - Export options
 */
export const exportSessionData = (token, options = {}) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;

  const {
    startDate = null,
    endDate = null,
    format = 'json',
    includeItems = false,
  } = options;

  try {
    let query = `
      SELECT
        ls.id,
        ls.topic_id,
        ls.session_type,
        ls.started_at,
        ls.completed_at,
        ls.duration_minutes,
        ls.items_reviewed,
        ls.items_correct,
        ls.items_new,
        sa.focus_score,
        sa.efficiency_score,
        sa.retention_rate,
        sa.streak_length,
        sa.hints_used
      FROM learning_session ls
      LEFT JOIN session_analytics sa ON ls.id = sa.session_id
      WHERE ls.user_id = ?
        AND ls.completed_at IS NOT NULL
    `;

    const params = [userId];

    if (startDate) {
      query += ' AND ls.started_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND ls.started_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY ls.started_at DESC';

    const stmt = db.prepare(query);
    const sessions = stmt.all(...params);

    let itemPerformance = [];
    if (includeItems && sessions.length > 0) {
      const sessionIds = sessions.map((s) => s.id);
      const placeholders = sessionIds.map(() => '?').join(',');

      const itemStmt = db.prepare(`
        SELECT * FROM learning_item_performance
        WHERE user_id = ? AND session_id IN (${placeholders})
        ORDER BY reviewed_at DESC
      `);

      itemPerformance = itemStmt.all(userId, ...sessionIds);
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      userId,
      totalSessions: sessions.length,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        topicId: s.topic_id,
        sessionType: s.session_type,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        durationMinutes: s.duration_minutes,
        itemsReviewed: s.items_reviewed,
        itemsCorrect: s.items_correct,
        itemsNew: s.items_new,
        accuracy:
          s.items_reviewed > 0
            ? ((s.items_correct / s.items_reviewed) * 100).toFixed(1)
            : '0',
        analytics: {
          focusScore: s.focus_score,
          efficiencyScore: s.efficiency_score,
          retentionRate: s.retention_rate,
          streakLength: s.streak_length,
          hintsUsed: s.hints_used,
        },
      })),
    };

    if (includeItems) {
      exportData.itemPerformance = itemPerformance.map((ip) => ({
        itemId: ip.item_id,
        itemType: ip.item_type,
        topicId: ip.topic_id,
        sessionId: ip.session_id,
        reviewedAt: ip.reviewed_at,
        wasCorrect: ip.was_correct === 1,
        responseTimeMs: ip.response_time_ms,
        masteryBefore: ip.mastery_before,
        masteryAfter: ip.mastery_after,
      }));
    }

    if (format === 'csv') {
      return convertToCSV(exportData);
    }

    return exportData;
  } catch (err) {
    console.error('exportSessionData error:', err);
    return null;
  }
};

const convertToCSV = (data) => {
  const headers = [
    'Session ID',
    'Topic ID',
    'Type',
    'Started At',
    'Completed At',
    'Duration (min)',
    'Items Reviewed',
    'Items Correct',
    'Accuracy %',
    'Focus Score',
    'Efficiency Score',
    'Retention Rate',
    'Streak Length',
    'Hints Used',
  ];

  const rows = data.sessions.map((s) => [
    s.id,
    s.topicId,
    s.sessionType,
    s.startedAt,
    s.completedAt,
    s.durationMinutes,
    s.itemsReviewed,
    s.itemsCorrect,
    s.accuracy,
    s.analytics.focusScore || '',
    s.analytics.efficiencyScore || '',
    s.analytics.retentionRate || '',
    s.analytics.streakLength || '',
    s.analytics.hintsUsed || '',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join(
    '\n',
  );

  return {
    content: csvContent,
    filename: `session_export_${new Date().toISOString().split('T')[0]}.csv`,
    mimeType: 'text/csv',
  };
};

// =============================================================================
// DASHBOARD SUMMARY
// =============================================================================

/**
 * Get comprehensive dashboard summary
 * @param {string} token - User token
 */
export const getDashboardSummary = (token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;

  try {
    // Today's stats
    const todayStmt = db.prepare(`
      SELECT
        COUNT(*) as sessions,
        SUM(duration_minutes) as minutes,
        SUM(items_reviewed) as items,
        SUM(items_correct) as correct
      FROM learning_session
      WHERE user_id = ?
        AND date(started_at) = date('now')
        AND completed_at IS NOT NULL
    `);
    const today = todayStmt.get(userId) || {};

    // This week stats
    const weekStmt = db.prepare(`
      SELECT
        COUNT(*) as sessions,
        SUM(duration_minutes) as minutes,
        SUM(items_reviewed) as items,
        SUM(items_correct) as correct,
        COUNT(DISTINCT date(started_at)) as active_days
      FROM learning_session
      WHERE user_id = ?
        AND started_at >= datetime('now', '-7 days')
        AND completed_at IS NOT NULL
    `);
    const week = weekStmt.get(userId) || {};

    // Current streak
    const streakStmt = db.prepare(`
      WITH RECURSIVE dates AS (
        SELECT date('now') as date
        UNION ALL
        SELECT date(date, '-1 day')
        FROM dates
        WHERE date > date('now', '-100 days')
      ),
      study_dates AS (
        SELECT DISTINCT date(started_at) as date
        FROM learning_session
        WHERE user_id = ? AND completed_at IS NOT NULL
      )
      SELECT COUNT(*) as streak
      FROM dates d
      WHERE EXISTS (SELECT 1 FROM study_dates s WHERE s.date = d.date)
        AND NOT EXISTS (
          SELECT 1 FROM dates d2
          WHERE d2.date > d.date
            AND NOT EXISTS (SELECT 1 FROM study_dates s2 WHERE s2.date = d2.date)
        )
    `);
    const streak = streakStmt.get(userId) || { streak: 0 };

    // Velocity (last 7 days)
    const velocity = getAggregateVelocity(token, 7);

    return {
      today: {
        sessions: today.sessions || 0,
        minutes: today.minutes || 0,
        items: today.items || 0,
        correct: today.correct || 0,
        accuracy:
          today.items > 0
            ? ((today.correct / today.items) * 100).toFixed(1)
            : '0',
      },
      thisWeek: {
        sessions: week.sessions || 0,
        minutes: week.minutes || 0,
        items: week.items || 0,
        correct: week.correct || 0,
        accuracy:
          week.items > 0 ? ((week.correct / week.items) * 100).toFixed(1) : '0',
        activeDays: week.active_days || 0,
      },
      currentStreak: streak.streak || 0,
      velocity: velocity || {
        avgVelocity: 0,
        velocityPerWeek: '0',
      },
    };
  } catch (err) {
    console.error('getDashboardSummary error:', err);
    return null;
  }
};

export default {
  initAnalyticsTables,
  recordSessionAnalytics,
  getSessionAnalytics,
  getPerformanceTrends,
  getWeeklyPerformance,
  recordLearningVelocity,
  getLearningVelocity,
  getAggregateVelocity,
  analyzeOptimalStudyTimes,
  identifyWeakItems,
  getSessionHistory,
  exportSessionData,
  getDashboardSummary,
};
