/**
 * SpacedRepetitionService.js
 *
 * Adaptive Spaced Repetition Algorithm based on FSRS (Free Spaced Repetition Scheduler)
 * with enhancements for personalized learning.
 *
 * This service provides a more sophisticated algorithm than the simple Leitner system,
 * suitable for general learning items (concepts, skills, notes) beyond vocabulary flashcards.
 *
 * Key Features:
 * - Adaptive intervals based on item difficulty and learner performance
 * - Memory stability and retrievability modeling
 * - Personalized forgetting curve estimation
 * - Integration with learner profiles
 *
 * Algorithm Overview:
 * - Each item has: stability (S), difficulty (D), and last review date
 * - Stability = how long until 90% retention drops to target retention (e.g., 90%)
 * - Difficulty = intrinsic difficulty of the item (1-10 scale)
 * - Retrievability = probability of recall at any given moment
 *
 * Based on: https://github.com/open-spaced-repetition/fsrs4anki
 */

import db, { getUserIdFromToken } from '../db/dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

// =============================================================================
// TABLE INITIALIZATION
// =============================================================================

/**
 * Initialize SR tables if they don't exist
 */
const initializeTables = () => {
  try {
    // Create sr_item table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "sr_item" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER NOT NULL,
        "item_id" TEXT NOT NULL,
        "item_type" TEXT NOT NULL,
        "topic_id" TEXT,
        "state" INTEGER DEFAULT 0,
        "difficulty" REAL DEFAULT 5.0,
        "stability" REAL DEFAULT 0,
        "last_review" TEXT,
        "next_review" TEXT,
        "review_count" INTEGER DEFAULT 0,
        "lapse_count" INTEGER DEFAULT 0,
        "created_at" TEXT NOT NULL,
        UNIQUE("user_id", "item_id", "item_type"),
        FOREIGN KEY ("user_id") REFERENCES "user"("id"),
        FOREIGN KEY ("topic_id") REFERENCES "learning_topic"("id")
      )
    `).run();

    // Create sr_review_history table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "sr_review_history" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER NOT NULL,
        "item_id" TEXT NOT NULL,
        "item_type" TEXT NOT NULL,
        "rating" INTEGER NOT NULL,
        "response_time_ms" INTEGER,
        "elapsed_days" REAL,
        "retrievability" REAL,
        "stability_before" REAL,
        "stability_after" REAL,
        "difficulty_before" REAL,
        "difficulty_after" REAL,
        "interval" INTEGER,
        "topic_id" TEXT,
        "reviewed_at" TEXT NOT NULL,
        FOREIGN KEY ("user_id") REFERENCES "user"("id"),
        FOREIGN KEY ("topic_id") REFERENCES "learning_topic"("id")
      )
    `).run();

    // Create sr_user_parameters table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "sr_user_parameters" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER NOT NULL UNIQUE,
        "parameters" TEXT NOT NULL,
        "optimized_at" TEXT,
        "review_count_at_optimization" INTEGER,
        "created_at" TEXT NOT NULL,
        "updated_at" TEXT,
        FOREIGN KEY ("user_id") REFERENCES "user"("id")
      )
    `).run();

    // Create indexes
    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_sr_item_user_due"
      ON "sr_item"("user_id", "next_review")
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_sr_item_user_type"
      ON "sr_item"("user_id", "item_type")
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_sr_item_topic"
      ON "sr_item"("topic_id")
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_sr_review_history_user"
      ON "sr_review_history"("user_id", "reviewed_at")
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_sr_review_history_item"
      ON "sr_review_history"("item_id", "item_type")
    `).run();
  } catch (error) {
    console.error('Error initializing SR tables:', error);
  }
};

// Initialize tables on module load
initializeTables();

// =============================================================================
// CONSTANTS & DEFAULT PARAMETERS
// =============================================================================

/**
 * FSRS-4.5 default parameters
 * These can be personalized per learner based on their performance history
 */
const DEFAULT_PARAMETERS = {
  // Initial stability for different ratings (in days)
  w: [
    0.4, // w[0]: initial stability for "again" (forgot)
    0.6, // w[1]: initial stability for "hard"
    2.4, // w[2]: initial stability for "good"
    5.8, // w[3]: initial stability for "easy"
    4.93, // w[4]: difficulty decay
    0.94, // w[5]: stability decay
    0.86, // w[6]: retrievability factor
    0.01, // w[7]: difficulty factor for stability
    1.49, // w[8]: stability factor for new stability
    0.14, // w[9]: difficulty delta for hard
    0.94, // w[10]: difficulty delta for good
    2.18, // w[11]: difficulty delta for easy
    0.05, // w[12]: stability short-term decay
    0.34, // w[13]: stability long-term growth
    1.26, // w[14]: difficulty short-term
    0.29, // w[15]: difficulty weight
    2.61, // w[16]: stability penalty for failure
  ],
  // Target retention rate (90% by default)
  requestRetention: 0.9,
  // Maximum interval in days
  maximumInterval: 365,
  // Minimum interval in days
  minimumInterval: 1,
};

/**
 * Rating values for review outcomes
 */
const Rating = {
  AGAIN: 1, // Complete failure to recall
  HARD: 2, // Recalled with significant difficulty
  GOOD: 3, // Recalled with some effort
  EASY: 4, // Recalled effortlessly
};

/**
 * State of a learning item
 */
const State = {
  NEW: 0, // Never reviewed
  LEARNING: 1, // In initial learning phase
  REVIEW: 2, // In regular review cycle
  RELEARNING: 3, // Failed and relearning
};

// =============================================================================
// CORE FSRS ALGORITHM
// =============================================================================

/**
 * Calculate the retrievability (probability of recall) at a given elapsed time
 * Based on the forgetting curve: R = e^(-t/S)
 *
 * @param {number} stability - Current stability in days
 * @param {number} elapsedDays - Days since last review
 * @returns {number} Retrievability (0-1)
 */
function calculateRetrievability(stability, elapsedDays) {
  if (stability <= 0) return 0;
  return Math.exp(-elapsedDays / stability);
}

/**
 * Calculate the next interval based on desired retention
 * Inverse of retrievability formula: t = -S * ln(R)
 *
 * @param {number} stability - Current stability in days
 * @param {number} requestRetention - Target retention rate (0-1)
 * @returns {number} Interval in days
 */
function calculateNextInterval(stability, requestRetention = 0.9) {
  if (stability <= 0) return 1;
  return Math.max(1, Math.round(-stability * Math.log(requestRetention)));
}

/**
 * Calculate initial difficulty for a new item
 * Based on first rating
 *
 * @param {number} rating - First rating (1-4)
 * @param {Array} w - Algorithm parameters
 * @returns {number} Initial difficulty (1-10)
 */
function calculateInitialDifficulty(rating, w = DEFAULT_PARAMETERS.w) {
  // D0 = w[4] - (rating - 3) * w[5]
  const d0 = w[4] - (rating - 3) * w[5];
  return Math.min(10, Math.max(1, d0));
}

/**
 * Calculate initial stability for a new item
 *
 * @param {number} rating - First rating (1-4)
 * @param {Array} w - Algorithm parameters
 * @returns {number} Initial stability in days
 */
function calculateInitialStability(rating, w = DEFAULT_PARAMETERS.w) {
  return w[rating - 1];
}

/**
 * Update difficulty after a review
 *
 * @param {number} currentDifficulty - Current difficulty (1-10)
 * @param {number} rating - Review rating (1-4)
 * @param {Array} w - Algorithm parameters
 * @returns {number} New difficulty (1-10)
 */
function updateDifficulty(currentDifficulty, rating, w = DEFAULT_PARAMETERS.w) {
  // Mean reversion towards initial difficulty
  const meanDifficulty = w[4];

  // Delta based on rating
  let delta;
  if (rating === Rating.AGAIN) {
    delta = w[9];
  } else if (rating === Rating.HARD) {
    delta = w[9] / 2;
  } else if (rating === Rating.GOOD) {
    delta = -w[10];
  } else {
    delta = -w[11];
  }

  // New difficulty with mean reversion
  const newD =
    currentDifficulty + delta * (currentDifficulty - meanDifficulty) * 0.1;

  return Math.min(10, Math.max(1, newD));
}

/**
 * Calculate new stability after a successful review
 *
 * @param {number} currentStability - Current stability in days
 * @param {number} difficulty - Current difficulty (1-10)
 * @param {number} retrievability - Retrievability at review time
 * @param {number} rating - Review rating (1-4)
 * @param {Array} w - Algorithm parameters
 * @returns {number} New stability in days
 */
function calculateNewStability(
  currentStability,
  difficulty,
  retrievability,
  rating,
  w = DEFAULT_PARAMETERS.w,
) {
  if (rating === Rating.AGAIN) {
    // Failed review - stability decreases significantly
    return (
      w[0] *
      Math.pow(difficulty, -w[16]) *
      Math.pow(currentStability + 1, w[12]) *
      Math.exp((1 - retrievability) * w[13]) *
      0.5
    );
  }

  // Successful review - stability increases
  const hardBonus = rating === Rating.HARD ? w[14] : 1;
  const easyBonus = rating === Rating.EASY ? w[11] : 1;

  const newStability =
    currentStability *
    (1 +
      Math.exp(w[8]) *
        (11 - difficulty) *
        Math.pow(currentStability, -w[9]) *
        (Math.exp((1 - retrievability) * w[10]) - 1) *
        hardBonus *
        easyBonus);

  return Math.max(0.1, newStability);
}

// =============================================================================
// SPACED REPETITION ITEM MANAGER
// =============================================================================

/**
 * Get or create a spaced repetition item
 *
 * @param {number} userId - User ID
 * @param {string} itemId - Item identifier
 * @param {string} itemType - Type of item (concept, note, skill, etc.)
 * @param {string} topicId - Optional topic ID
 * @returns {Object} SR item data
 */
function getOrCreateSRItem(userId, itemId, itemType, topicId = null) {
  try {
    // Check if item exists
    const stmt = db.prepare(`
      SELECT * FROM sr_item
      WHERE user_id = ? AND item_id = ? AND item_type = ?
    `);
    let row = stmt.get(userId, itemId, itemType);

    if (!row) {
      // Create new item
      const now = dateToSQLiteString(new Date());
      const insertStmt = db.prepare(`
        INSERT INTO sr_item (
          user_id, item_id, item_type, topic_id, state, difficulty, stability,
          last_review, next_review, review_count, lapse_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        userId,
        itemId,
        itemType,
        topicId,
        State.NEW,
        DEFAULT_PARAMETERS.w[4], // Initial difficulty
        0, // No stability yet
        null, // No review yet
        now, // Due immediately
        0,
        0,
        now,
      );

      row = stmt.get(userId, itemId, itemType);
    }

    return {
      id: row.id,
      userId: row.user_id,
      itemId: row.item_id,
      itemType: row.item_type,
      topicId: row.topic_id,
      state: row.state,
      difficulty: row.difficulty,
      stability: row.stability,
      lastReview: row.last_review ? new Date(row.last_review) : null,
      nextReview: row.next_review ? new Date(row.next_review) : null,
      reviewCount: row.review_count,
      lapseCount: row.lapse_count,
      createdAt: new Date(row.created_at),
    };
  } catch (err) {
    console.error('getOrCreateSRItem error:', err);
    return null;
  }
}

/**
 * Process a review and update the SR item
 *
 * @param {number} userId - User ID
 * @param {string} itemId - Item identifier
 * @param {string} itemType - Type of item
 * @param {number} rating - Review rating (1-4)
 * @param {Object} options - Additional options
 * @returns {Object} Updated SR item with scheduling info
 */
function processReview(userId, itemId, itemType, rating, options = {}) {
  const { topicId = null, responseTimeMs = null, parameters = null } = options;

  const w = parameters?.w || DEFAULT_PARAMETERS.w;
  const requestRetention =
    parameters?.requestRetention || DEFAULT_PARAMETERS.requestRetention;
  const maxInterval =
    parameters?.maximumInterval || DEFAULT_PARAMETERS.maximumInterval;

  try {
    const item = getOrCreateSRItem(userId, itemId, itemType, topicId);
    if (!item) {
      return { error: 'Failed to get/create SR item' };
    }

    const now = new Date();
    const nowStr = dateToSQLiteString(now);

    // Calculate elapsed time since last review
    let elapsedDays = 0;
    if (item.lastReview) {
      elapsedDays =
        (now.getTime() - item.lastReview.getTime()) / (1000 * 60 * 60 * 24);
    }

    // Calculate current retrievability
    const retrievability =
      item.stability > 0
        ? calculateRetrievability(item.stability, elapsedDays)
        : 0;

    // Update difficulty
    const newDifficulty = updateDifficulty(item.difficulty, rating, w);

    // Calculate new stability
    let newStability;
    let newState;
    let newLapseCount = item.lapseCount;

    if (item.state === State.NEW) {
      // First review
      newStability = calculateInitialStability(rating, w);
      newState =
        rating === Rating.AGAIN || rating === Rating.HARD
          ? State.LEARNING
          : State.REVIEW;
    } else if (rating === Rating.AGAIN) {
      // Failed - go to relearning
      newStability = calculateNewStability(
        item.stability,
        newDifficulty,
        retrievability,
        rating,
        w,
      );
      newState = State.RELEARNING;
      newLapseCount += 1;
    } else {
      // Successful review
      newStability = calculateNewStability(
        item.stability,
        newDifficulty,
        retrievability,
        rating,
        w,
      );
      newState = State.REVIEW;
    }

    // Calculate next interval
    let nextInterval = calculateNextInterval(newStability, requestRetention);
    nextInterval = Math.min(nextInterval, maxInterval);

    // Short interval for learning/relearning states
    if (newState === State.LEARNING || newState === State.RELEARNING) {
      nextInterval = Math.min(nextInterval, rating === Rating.AGAIN ? 1 : 3);
    }

    const nextReviewDate = new Date(
      now.getTime() + nextInterval * 24 * 60 * 60 * 1000,
    );
    const nextReviewStr = dateToSQLiteString(nextReviewDate);

    // Update the item
    const updateStmt = db.prepare(`
      UPDATE sr_item SET
        state = ?,
        difficulty = ?,
        stability = ?,
        last_review = ?,
        next_review = ?,
        review_count = review_count + 1,
        lapse_count = ?
      WHERE id = ?
    `);

    updateStmt.run(
      newState,
      newDifficulty,
      newStability,
      nowStr,
      nextReviewStr,
      newLapseCount,
      item.id,
    );

    // Record the review in history
    recordReviewHistory(userId, itemId, itemType, {
      rating,
      responseTimeMs,
      elapsedDays,
      retrievability,
      stabilityBefore: item.stability,
      stabilityAfter: newStability,
      difficultyBefore: item.difficulty,
      difficultyAfter: newDifficulty,
      interval: nextInterval,
      topicId,
    });

    return {
      success: true,
      itemId,
      itemType,
      state: newState,
      difficulty: newDifficulty,
      stability: newStability,
      retrievability,
      nextReview: nextReviewDate,
      nextInterval,
      reviewCount: item.reviewCount + 1,
      lapseCount: newLapseCount,
    };
  } catch (err) {
    console.error('processReview error:', err);
    return { error: err.message };
  }
}

/**
 * Record review in history for analytics and parameter optimization
 */
function recordReviewHistory(userId, itemId, itemType, data) {
  try {
    const stmt = db.prepare(`
      INSERT INTO sr_review_history (
        user_id, item_id, item_type, rating, response_time_ms,
        elapsed_days, retrievability, stability_before, stability_after,
        difficulty_before, difficulty_after, interval, topic_id, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      itemId,
      itemType,
      data.rating,
      data.responseTimeMs,
      data.elapsedDays,
      data.retrievability,
      data.stabilityBefore,
      data.stabilityAfter,
      data.difficultyBefore,
      data.difficultyAfter,
      data.interval,
      data.topicId,
      dateToSQLiteString(new Date()),
    );
  } catch (err) {
    console.error('recordReviewHistory error:', err);
  }
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get items due for review
 *
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @returns {Array} Items due for review
 */
function getDueItems(userId, options = {}) {
  const { itemType = null, topicId = null, limit = 50, includeNew = true } =
    options;

  try {
    let query = `
      SELECT * FROM sr_item
      WHERE user_id = ?
        AND (next_review <= datetime('now') OR (state = 0 AND ?))
    `;
    const params = [userId, includeNew ? 1 : 0];

    if (itemType) {
      query += ' AND item_type = ?';
      params.push(itemType);
    }

    if (topicId) {
      query += ' AND topic_id = ?';
      params.push(topicId);
    }

    query += `
      ORDER BY
        CASE WHEN state = 0 THEN 1 ELSE 0 END,
        next_review ASC
      LIMIT ?
    `;
    params.push(limit);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      itemType: row.item_type,
      topicId: row.topic_id,
      state: row.state,
      difficulty: row.difficulty,
      stability: row.stability,
      lastReview: row.last_review ? new Date(row.last_review) : null,
      nextReview: row.next_review ? new Date(row.next_review) : null,
      reviewCount: row.review_count,
      lapseCount: row.lapse_count,
      retrievability:
        row.stability > 0 && row.last_review
          ? calculateRetrievability(
              row.stability,
              (Date.now() - new Date(row.last_review).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 1,
    }));
  } catch (err) {
    console.error('getDueItems error:', err);
    return [];
  }
}

/**
 * Get review statistics for a user
 *
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Statistics
 */
function getReviewStatistics(userId, options = {}) {
  const { topicId = null, days = 30 } = options;

  try {
    let baseCondition = 'user_id = ?';
    const params = [userId];

    if (topicId) {
      baseCondition += ' AND topic_id = ?';
      params.push(topicId);
    }

    // Count items by state
    const stateStmt = db.prepare(`
      SELECT state, COUNT(*) as count
      FROM sr_item
      WHERE ${baseCondition}
      GROUP BY state
    `);
    const stateRows = stateStmt.all(...params);

    const stateCounts = {
      new: 0,
      learning: 0,
      review: 0,
      relearning: 0,
      total: 0,
    };

    stateRows.forEach((row) => {
      stateCounts.total += row.count;
      switch (row.state) {
        case State.NEW:
          stateCounts.new = row.count;
          break;
        case State.LEARNING:
          stateCounts.learning = row.count;
          break;
        case State.REVIEW:
          stateCounts.review = row.count;
          break;
        case State.RELEARNING:
          stateCounts.relearning = row.count;
          break;
      }
    });

    // Count due today
    const dueStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM sr_item
      WHERE ${baseCondition}
        AND next_review <= datetime('now')
    `);
    const dueRow = dueStmt.get(...params);
    stateCounts.dueToday = dueRow?.count || 0;

    // Review history stats
    const historyCondition = topicId
      ? 'user_id = ? AND topic_id = ?'
      : 'user_id = ?';
    const historyParams = topicId ? [userId, topicId] : [userId];

    const historyStmt = db.prepare(`
      SELECT
        COUNT(*) as total_reviews,
        SUM(CASE WHEN rating >= 3 THEN 1 ELSE 0 END) as successful_reviews,
        AVG(retrievability) as avg_retrievability,
        AVG(CASE WHEN rating >= 3 THEN interval ELSE NULL END) as avg_interval
      FROM sr_review_history
      WHERE ${historyCondition}
        AND reviewed_at >= datetime('now', '-${days} days')
    `);
    const historyRow = historyStmt.get(...historyParams);

    const retentionRate =
      historyRow?.total_reviews > 0
        ? historyRow.successful_reviews / historyRow.total_reviews
        : 0;

    return {
      ...stateCounts,
      totalReviews: historyRow?.total_reviews || 0,
      retentionRate,
      avgRetrievability: historyRow?.avg_retrievability || 0,
      avgInterval: historyRow?.avg_interval || 0,
    };
  } catch (err) {
    console.error('getReviewStatistics error:', err);
    return { error: err.message };
  }
}

/**
 * Get forecast of upcoming reviews
 *
 * @param {number} userId - User ID
 * @param {number} days - Number of days to forecast
 * @returns {Array} Daily review counts
 */
function getReviewForecast(userId, days = 14) {
  try {
    const forecast = [];

    for (let i = 0; i < days; i++) {
      const stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM sr_item
        WHERE user_id = ?
          AND date(next_review) = date('now', '+${i} days')
      `);
      const row = stmt.get(userId);
      forecast.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        dueCount: row?.count || 0,
      });
    }

    return forecast;
  } catch (err) {
    console.error('getReviewForecast error:', err);
    return [];
  }
}

/**
 * Calculate optimal review time based on target retention
 *
 * @param {number} stability - Item stability
 * @param {number} currentRetrievability - Current retrievability
 * @param {number} targetRetrievability - Target retention (default 0.9)
 * @returns {Object} Optimal review info
 */
function calculateOptimalReviewTime(
  stability,
  currentRetrievability,
  targetRetrievability = 0.9,
) {
  if (stability <= 0) {
    return {
      optimalInterval: 1,
      urgency: 'high',
      message: 'Review immediately',
    };
  }

  const optimalInterval = calculateNextInterval(stability, targetRetrievability);

  let urgency;
  let message;

  if (currentRetrievability < 0.7) {
    urgency = 'high';
    message = 'Overdue - memory fading rapidly';
  } else if (currentRetrievability < 0.85) {
    urgency = 'medium';
    message = 'Review soon to maintain memory';
  } else if (currentRetrievability < 0.95) {
    urgency = 'low';
    message = 'Good time to review';
  } else {
    urgency = 'none';
    message = 'Memory is fresh, review later';
  }

  return {
    optimalInterval,
    currentRetrievability,
    targetRetrievability,
    urgency,
    message,
  };
}

// =============================================================================
// REVIEW HISTORY
// =============================================================================

/**
 * Get review history for calendar/analytics
 *
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.days=365] - Number of days to fetch
 * @param {string} [options.topicId] - Filter by topic
 * @param {string} [options.itemType] - Filter by item type
 * @returns {Array} Review history records
 */
function getReviewHistory(userId, options = {}) {
  const { days = 365, topicId, itemType } = options;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    let query = `
      SELECT
        id,
        user_id,
        item_id,
        item_type,
        rating,
        response_time_ms,
        elapsed_days,
        retrievability,
        stability_before,
        stability_after,
        difficulty_before,
        difficulty_after,
        interval,
        topic_id,
        reviewed_at
      FROM sr_review_history
      WHERE user_id = ?
        AND reviewed_at >= ?
    `;
    const params = [userId, startDateStr];

    if (topicId) {
      query += ' AND topic_id = ?';
      params.push(topicId);
    }

    if (itemType) {
      query += ' AND item_type = ?';
      params.push(itemType);
    }

    query += ' ORDER BY reviewed_at DESC';

    const stmt = db.prepare(query);
    const reviews = stmt.all(...params);

    // Transform to camelCase for consistency
    return reviews.map((r) => ({
      id: r.id,
      userId: r.user_id,
      itemId: r.item_id,
      itemType: r.item_type,
      rating: r.rating,
      responseTimeMs: r.response_time_ms,
      elapsedDays: r.elapsed_days,
      retrievability: r.retrievability,
      stabilityBefore: r.stability_before,
      stabilityAfter: r.stability_after,
      difficultyBefore: r.difficulty_before,
      difficultyAfter: r.difficulty_after,
      interval: r.interval,
      topicId: r.topic_id,
      reviewedAt: r.reviewed_at,
    }));
  } catch (err) {
    console.error('getReviewHistory error:', err);
    return [];
  }
}

/**
 * Get daily aggregated review data for calendar view
 *
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.days=365] - Number of days to fetch
 * @param {string} [options.topicId] - Filter by topic
 * @returns {Object} Daily aggregated data keyed by date string
 */
function getDailyReviewData(userId, options = {}) {
  const { days = 365, topicId } = options;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    let query = `
      SELECT
        date(reviewed_at) as review_date,
        COUNT(*) as reviewed,
        SUM(CASE WHEN rating >= 3 THEN 1 ELSE 0 END) as correct,
        SUM(CASE WHEN rating < 3 THEN 1 ELSE 0 END) as incorrect,
        AVG(response_time_ms) as avg_response_time,
        COUNT(DISTINCT item_id) as unique_items
      FROM sr_review_history
      WHERE user_id = ?
        AND date(reviewed_at) >= ?
    `;
    const params = [userId, startDateStr];

    if (topicId) {
      query += ' AND topic_id = ?';
      params.push(topicId);
    }

    query += ' GROUP BY date(reviewed_at) ORDER BY review_date';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    // Convert to keyed object
    const dailyData = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    rows.forEach((row) => {
      const rowDate = new Date(row.review_date);
      rowDate.setHours(0, 0, 0, 0);

      dailyData[row.review_date] = {
        date: row.review_date,
        reviewed: row.reviewed,
        correct: row.correct,
        incorrect: row.incorrect,
        avgResponseTime: row.avg_response_time,
        uniqueItems: row.unique_items,
        isToday: rowDate.getTime() === today.getTime(),
        isPast: rowDate < today,
        isFuture: rowDate > today,
      };
    });

    return dailyData;
  } catch (err) {
    console.error('getDailyReviewData error:', err);
    return {};
  }
}

// =============================================================================
// PARAMETER OPTIMIZATION
// =============================================================================

/**
 * Optimize FSRS parameters based on user's review history
 * This creates personalized parameters for better predictions
 *
 * @param {number} userId - User ID
 * @returns {Object} Optimized parameters
 */
function optimizeParameters(userId) {
  try {
    // Get review history
    const stmt = db.prepare(`
      SELECT * FROM sr_review_history
      WHERE user_id = ?
      ORDER BY reviewed_at DESC
      LIMIT 1000
    `);
    const reviews = stmt.all(userId);

    if (reviews.length < 50) {
      // Not enough data for optimization
      return {
        optimized: false,
        parameters: DEFAULT_PARAMETERS,
        message: 'Not enough review history for optimization (need 50+)',
      };
    }

    // Calculate actual retention rate
    const successfulReviews = reviews.filter((r) => r.rating >= 3).length;
    const actualRetention = successfulReviews / reviews.length;

    // Calculate average stability growth
    const stabilityGrowths = reviews
      .filter((r) => r.stability_before > 0 && r.rating >= 3)
      .map((r) => r.stability_after / r.stability_before);

    const avgStabilityGrowth =
      stabilityGrowths.length > 0
        ? stabilityGrowths.reduce((a, b) => a + b, 0) / stabilityGrowths.length
        : 2.5;

    // Adjust parameters based on observed behavior
    const optimizedW = [...DEFAULT_PARAMETERS.w];

    // Adjust initial stabilities based on observed performance
    if (actualRetention > 0.92) {
      // User retains well, can use longer initial intervals
      optimizedW[0] *= 1.2;
      optimizedW[1] *= 1.2;
      optimizedW[2] *= 1.2;
      optimizedW[3] *= 1.2;
    } else if (actualRetention < 0.85) {
      // User needs more frequent reviews
      optimizedW[0] *= 0.8;
      optimizedW[1] *= 0.8;
      optimizedW[2] *= 0.8;
      optimizedW[3] *= 0.8;
    }

    // Adjust stability growth factor
    optimizedW[8] = Math.log(avgStabilityGrowth);

    return {
      optimized: true,
      parameters: {
        ...DEFAULT_PARAMETERS,
        w: optimizedW,
        requestRetention: Math.min(0.95, Math.max(0.8, actualRetention)),
      },
      stats: {
        reviewCount: reviews.length,
        actualRetention,
        avgStabilityGrowth,
      },
    };
  } catch (err) {
    console.error('optimizeParameters error:', err);
    return {
      optimized: false,
      parameters: DEFAULT_PARAMETERS,
      error: err.message,
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Constants
  Rating,
  State,
  DEFAULT_PARAMETERS,
  // Core functions
  calculateRetrievability,
  calculateNextInterval,
  calculateInitialDifficulty,
  calculateInitialStability,
  updateDifficulty,
  calculateNewStability,
  // Item management
  getOrCreateSRItem,
  processReview,
  // Query functions
  getDueItems,
  getReviewStatistics,
  getReviewForecast,
  calculateOptimalReviewTime,
  // History functions
  getReviewHistory,
  getDailyReviewData,
  // Parameter optimization
  optimizeParameters,
};

export default {
  Rating,
  State,
  DEFAULT_PARAMETERS,
  calculateRetrievability,
  calculateNextInterval,
  getOrCreateSRItem,
  processReview,
  getDueItems,
  getReviewStatistics,
  getReviewForecast,
  calculateOptimalReviewTime,
  getReviewHistory,
  getDailyReviewData,
  optimizeParameters,
};
