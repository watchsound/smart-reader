/**
 * DatabaseBridge - SQLite access for the background service
 *
 * Provides read-only access to the main app's SQLite database
 * for querying learning data needed by the heartbeat analysis.
 *
 * Note: Uses the same database file as the main Electron app.
 * Writes should be minimal to avoid conflicts.
 */

const path = require('path');
const os = require('os');

class DatabaseBridge {
  constructor(options = {}) {
    this.db = null;
    this.dbPath = options.dbPath || this.getDefaultDbPath();
  }

  /**
   * Get the default database path
   * @returns {string}
   */
  getDefaultDbPath() {
    let appDataDir;

    switch (process.platform) {
      case 'win32':
        appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appDataDir, 'SmartReader', 'sqlite_tables.db');

      case 'darwin':
        return path.join(
          os.homedir(),
          'Library',
          'Application Support',
          'SmartReader',
          'sqlite_tables.db'
        );

      default: // Linux
        appDataDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
        return path.join(appDataDir, 'smartreader', 'sqlite_tables.db');
    }
  }

  /**
   * Connect to the database
   */
  async connect() {
    try {
      // better-sqlite3 must be installed
      const Database = require('better-sqlite3');

      this.db = new Database(this.dbPath, {
        readonly: true, // Safety: read-only to avoid conflicts
        fileMustExist: true,
      });

      console.log('[DatabaseBridge] Connected to', this.dbPath);
    } catch (error) {
      if (error.code === 'SQLITE_CANTOPEN') {
        console.warn('[DatabaseBridge] Database not found, service will use cached data');
        this.db = null;
      } else {
        console.error('[DatabaseBridge] Failed to connect:', error);
        throw error;
      }
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[DatabaseBridge] Disconnected');
    }
  }

  /**
   * Check if database is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.db !== null;
  }

  /**
   * Get learning data for heartbeat analysis
   * @param {number} userId - User ID (default: 1 for single-user mode)
   * @returns {Object}
   */
  async getLearningData(userId = 1) {
    if (!this.db) {
      return this.getEmptyLearningData();
    }

    try {
      const data = {
        dueItems: this.getDueItems(userId),
        recentReviews: this.getRecentReviews(userId),
        streakDays: this.getStreakDays(userId),
        weakConcepts: this.getWeakConcepts(userId),
        weeklyStats: this.getWeeklyStats(userId),
      };

      return data;
    } catch (error) {
      console.error('[DatabaseBridge] Failed to get learning data:', error);
      return this.getEmptyLearningData();
    }
  }

  /**
   * Get empty learning data structure
   * @returns {Object}
   */
  getEmptyLearningData() {
    return {
      dueItems: [],
      recentReviews: [],
      streakDays: 0,
      weakConcepts: [],
      weeklyStats: {},
    };
  }

  /**
   * Get items due for review (from learning_points table)
   * @param {number} userId
   * @returns {Array}
   */
  getDueItems(userId) {
    try {
      const now = new Date().toISOString();

      // Check if learning_points table exists
      const tableExists = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='learning_points'"
        )
        .get();

      if (!tableExists) {
        // Fallback to vocabulary table
        return this.getDueVocabulary(userId);
      }

      const stmt = this.db.prepare(`
        SELECT lp.id, lp.front, lp.back, lp.box, lp.next_review_date as nextReviewDate,
               lp.last_review_date as lastReviewDate, lp.topic_id as topicId
        FROM learning_points lp
        JOIN learning_plans plan ON lp.plan_id = plan.id
        WHERE plan.user_id = ? AND lp.next_review_date <= ?
        ORDER BY lp.next_review_date ASC
        LIMIT 100
      `);

      return stmt.all(userId, now);
    } catch (error) {
      console.warn('[DatabaseBridge] getDueItems failed:', error.message);
      return [];
    }
  }

  /**
   * Get due vocabulary items (fallback)
   * @param {number} userId
   * @returns {Array}
   */
  getDueVocabulary(userId) {
    try {
      const tableExists = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='vocabulary'"
        )
        .get();

      if (!tableExists) {
        return [];
      }

      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        SELECT id, word as front, definition as back, box,
               next_review_date as nextReviewDate, last_review_date as lastReviewDate
        FROM vocabulary
        WHERE user_id = ? AND (next_review_date <= ? OR next_review_date IS NULL)
        ORDER BY COALESCE(next_review_date, '1970-01-01') ASC
        LIMIT 100
      `);

      return stmt.all(userId, now);
    } catch (error) {
      console.warn('[DatabaseBridge] getDueVocabulary failed:', error.message);
      return [];
    }
  }

  /**
   * Get recent reviews (last 7 days)
   * @param {number} userId
   * @returns {Array}
   */
  getRecentReviews(userId) {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Check if session_analytics table exists
      const tableExists = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='session_analytics'"
        )
        .get();

      if (!tableExists) {
        // Try review_history table
        return this.getRecentReviewsFromHistory(userId, weekAgo);
      }

      const stmt = this.db.prepare(`
        SELECT sa.date, sa.items_reviewed as itemsReviewed,
               sa.correct_count as correctCount, sa.incorrect_count as incorrectCount,
               CAST(sa.accuracy AS REAL) as accuracy
        FROM session_analytics sa
        WHERE sa.user_id = ? AND sa.date >= ?
        ORDER BY sa.date DESC
        LIMIT 50
      `);

      const sessions = stmt.all(userId, weekAgo.toISOString());

      // Flatten to individual reviews (approximate)
      const reviews = [];
      for (const session of sessions) {
        const avgRating = session.accuracy > 80 ? 3.5 : session.accuracy > 60 ? 2.5 : 1.5;
        for (let i = 0; i < session.itemsReviewed; i++) {
          reviews.push({
            date: session.date,
            rating: i < session.correctCount ? 3 : 2,
            conceptName: `Item ${i + 1}`,
          });
        }
      }

      return reviews.slice(0, 100);
    } catch (error) {
      console.warn('[DatabaseBridge] getRecentReviews failed:', error.message);
      return [];
    }
  }

  /**
   * Get recent reviews from review_history table (fallback)
   * @param {number} userId
   * @param {Date} since
   * @returns {Array}
   */
  getRecentReviewsFromHistory(userId, since) {
    try {
      const tableExists = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='review_history'"
        )
        .get();

      if (!tableExists) {
        return [];
      }

      const stmt = this.db.prepare(`
        SELECT rh.*, v.word as conceptName
        FROM review_history rh
        LEFT JOIN vocabulary v ON rh.item_id = v.id
        WHERE rh.user_id = ? AND rh.review_date >= ?
        ORDER BY rh.review_date DESC
        LIMIT 100
      `);

      return stmt.all(userId, since.toISOString());
    } catch (error) {
      console.warn('[DatabaseBridge] getRecentReviewsFromHistory failed:', error.message);
      return [];
    }
  }

  /**
   * Get current streak days
   * @param {number} userId
   * @returns {number}
   */
  getStreakDays(userId) {
    try {
      // Check learner_profiles table
      const tableExists = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='learner_profiles'"
        )
        .get();

      if (!tableExists) {
        return this.calculateStreakFromReviews(userId);
      }

      const stmt = this.db.prepare(`
        SELECT current_streak as streak
        FROM learner_profiles
        WHERE user_id = ?
      `);

      const result = stmt.get(userId);
      return result?.streak || 0;
    } catch (error) {
      console.warn('[DatabaseBridge] getStreakDays failed:', error.message);
      return 0;
    }
  }

  /**
   * Calculate streak from review history
   * @param {number} userId
   * @returns {number}
   */
  calculateStreakFromReviews(userId) {
    try {
      // Get unique review dates
      const stmt = this.db.prepare(`
        SELECT DISTINCT date(review_date) as reviewDate
        FROM review_history
        WHERE user_id = ?
        ORDER BY reviewDate DESC
        LIMIT 365
      `);

      const dates = stmt.all(userId).map((r) => r.reviewDate);

      if (dates.length === 0) return 0;

      let streak = 0;
      const today = new Date();
      let checkDate = new Date(today.toISOString().split('T')[0]);

      for (const dateStr of dates) {
        const reviewDate = new Date(dateStr);
        const diffDays = Math.round((checkDate - reviewDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 0 || diffDays === 1) {
          streak++;
          checkDate = reviewDate;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      console.warn('[DatabaseBridge] calculateStreakFromReviews failed:', error.message);
      return 0;
    }
  }

  /**
   * Get weak concepts (low mastery or high error rate)
   * @param {number} userId
   * @returns {Array}
   */
  getWeakConcepts(userId) {
    try {
      // Try learning_points first
      const lpTable = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='learning_points'"
        )
        .get();

      if (lpTable) {
        const stmt = this.db.prepare(`
          SELECT lp.front as name, lp.box, lp.error_count as errorCount,
                 lp.review_count as reviewCount
          FROM learning_points lp
          JOIN learning_plans plan ON lp.plan_id = plan.id
          WHERE plan.user_id = ? AND (lp.box <= 2 OR lp.error_count > 3)
          ORDER BY lp.error_count DESC, lp.box ASC
          LIMIT 10
        `);

        return stmt.all(userId);
      }

      // Fallback to vocabulary
      const vocabTable = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='vocabulary'"
        )
        .get();

      if (vocabTable) {
        const stmt = this.db.prepare(`
          SELECT word as name, box, error_count as errorCount, review_count as reviewCount
          FROM vocabulary
          WHERE user_id = ? AND (box <= 2 OR error_count > 3)
          ORDER BY error_count DESC, box ASC
          LIMIT 10
        `);

        return stmt.all(userId);
      }

      return [];
    } catch (error) {
      console.warn('[DatabaseBridge] getWeakConcepts failed:', error.message);
      return [];
    }
  }

  /**
   * Get weekly statistics
   * @param {number} userId
   * @returns {Object}
   */
  getWeeklyStats(userId) {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Check session_analytics table
      const tableExists = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='session_analytics'"
        )
        .get();

      if (!tableExists) {
        return { totalReviews: 0, accuracy: 0, studyTime: 0 };
      }

      const stmt = this.db.prepare(`
        SELECT
          SUM(items_reviewed) as totalReviews,
          AVG(CAST(accuracy AS REAL)) as accuracy,
          SUM(duration_minutes) as studyTime
        FROM session_analytics
        WHERE user_id = ? AND date >= ?
      `);

      const result = stmt.get(userId, weekAgo.toISOString());

      return {
        totalReviews: result?.totalReviews || 0,
        accuracy: Math.round(result?.accuracy || 0),
        studyTime: result?.studyTime || 0,
      };
    } catch (error) {
      console.warn('[DatabaseBridge] getWeeklyStats failed:', error.message);
      return { totalReviews: 0, accuracy: 0, studyTime: 0 };
    }
  }

  /**
   * Execute a raw query (for advanced use)
   * @param {string} sql
   * @param {Array} params
   * @returns {Array}
   */
  query(sql, params = []) {
    if (!this.db) {
      return [];
    }

    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('[DatabaseBridge] Query failed:', error);
      return [];
    }
  }
}

module.exports = DatabaseBridge;
