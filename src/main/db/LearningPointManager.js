/**
 * LearningPointManager.js
 *
 * Unified manager for all learning content types.
 * Combines vocabulary, notes, formulas, problems into a single table
 * with embedded Leitner 5-box spaced repetition.
 *
 * Content is stored as JSON for flexibility:
 * - front: { text, html?, image?, latex?, code? }
 * - back: { text, html?, image?, latex?, code? }
 * - extras: { quiz?, mindmap?, variables?, solution?, ... }
 *
 * Supports:
 * - CRUD operations with validation
 * - Leitner 5-box SR scheduling
 * - Domain and item type filtering
 * - Tag-based queries
 * - Source tracking for migration
 * - Statistics and analytics
 */

import { v4 as uuidv4 } from 'uuid';
import db, { getUserIdFromToken } from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

// =============================================================================
// CONSTANTS
// =============================================================================

// Leitner box intervals in days
const BOX_INTERVALS = {
  1: 1, // Box 1: review next day
  2: 2, // Box 2: review in 2 days
  3: 4, // Box 3: review in 4 days
  4: 7, // Box 4: review in 7 days
  5: 14, // Box 5: review in 14 days (graduated after stable)
};

// Valid item types
const ITEM_TYPES = [
  'word', // Vocabulary word
  'concept', // General concept/idea
  'formula', // Mathematical formula
  'rule', // Grammar rule, law, etc.
  'fact', // Factual information
  'problem', // Practice problem with solution
  'technique', // Method or procedure
  'pattern', // Design pattern, code pattern
  'definition', // Formal definition
  'example', // Example or case study
];

// Valid domain types
const DOMAIN_TYPES = [
  'vocabulary', // Language vocabulary
  'math', // Mathematics
  'physics', // Physics
  'chemistry', // Chemistry
  'biology', // Biology
  'language', // Language learning (grammar, etc.)
  'programming', // Programming/coding
  'knowledge', // General knowledge
  'skill', // Practical skills
  'history', // Historical facts
  'geography', // Geography
  'custom', // User-defined domain
];

// Valid difficulty levels
const DIFFICULTY_LEVELS = [
  'beginner',
  'elementary',
  'intermediate',
  'advanced',
  'expert',
];

// Valid formats
const FORMATS = ['card', 'mindmap', 'quiz', 'image', 'code'];

// Valid source types
const SOURCE_TYPES = [
  'vocabulary', // Migrated from vocabulary table
  'note', // Migrated from note table
  'book', // Extracted from a book
  'url', // Imported from URL
  'chat', // Created from chat
  'plan', // Part of learning plan
  'manual', // Manually created
];

// Valid statuses
const STATUSES = ['active', 'suspended', 'archived', 'deleted'];

// =============================================================================
// TABLE INITIALIZATION
// =============================================================================

/**
 * Initialize the learning_point table
 * Called on app startup to ensure table exists
 */
export const initLearningPointTable = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "learning_point" (
        "id" TEXT PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "title" TEXT NOT NULL,
        "front" TEXT NOT NULL,
        "back" TEXT NOT NULL,
        "extras" TEXT,
        "item_type" TEXT DEFAULT 'concept',
        "domain_type" TEXT DEFAULT 'knowledge',
        "difficulty" TEXT DEFAULT 'intermediate',
        "format" TEXT DEFAULT 'card',
        "tags" TEXT,
        "source_type" TEXT,
        "source_id" TEXT,
        "plan_id" TEXT,
        "book_id" INTEGER,
        "box" INTEGER DEFAULT 1,
        "next_review" TEXT,
        "last_reviewed_at" TEXT,
        "review_count" INTEGER DEFAULT 0,
        "correct_streak" INTEGER DEFAULT 0,
        "total_correct" INTEGER DEFAULT 0,
        "total_incorrect" INTEGER DEFAULT 0,
        "fully_learned" INTEGER DEFAULT 0,
        "sr_item_id" INTEGER,
        "status" TEXT DEFAULT 'active',
        "mastery_level" INTEGER DEFAULT 0,
        "ease_factor" REAL DEFAULT 2.5,
        "interval_days" INTEGER DEFAULT 1,
        "avg_response_time_ms" INTEGER,
        "last_response_time_ms" INTEGER,
        "created_at" TEXT NOT NULL,
        "updated_at" TEXT
      )
    `);

    // Create indexes for performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS "idx_lp_user_due"
      ON "learning_point"("user_id", "next_review", "fully_learned")
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS "idx_lp_user_box"
      ON "learning_point"("user_id", "box", "status")
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS "idx_lp_source"
      ON "learning_point"("source_type", "source_id")
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS "idx_lp_plan"
      ON "learning_point"("plan_id")
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS "idx_lp_domain_type"
      ON "learning_point"("user_id", "domain_type", "item_type")
    `);

    return true;
  } catch (err) {
    console.error('initLearningPointTable error:', err);
    return false;
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Serialize JSON content for storage
 */
const serializeContent = (content) => {
  if (typeof content === 'string') {
    // Already a string, try to validate as JSON
    try {
      JSON.parse(content);
      return content;
    } catch {
      // Wrap plain string in JSON format
      return JSON.stringify({ text: content });
    }
  }
  return JSON.stringify(content);
};

/**
 * Deserialize JSON content from storage
 */
const parseContent = (content) => {
  if (!content) return { text: '' };
  try {
    return JSON.parse(content);
  } catch {
    return { text: content };
  }
};

/**
 * Parse a learning point row from database
 */
const parseRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    front: parseContent(row.front),
    back: parseContent(row.back),
    extras: row.extras ? JSON.parse(row.extras) : null,
    tags: row.tags ? JSON.parse(row.tags) : [],
    fullyLearned: Boolean(row.fully_learned),
  };
};

/**
 * Calculate next review date based on box number
 */
const calculateNextReview = (box, easeFactor = 2.5) => {
  const baseInterval = BOX_INTERVALS[box] || 1;
  const adjustedInterval = Math.round(baseInterval * (easeFactor / 2.5));
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + adjustedInterval);
  return dateToSQLiteString(nextDate);
};

/**
 * Calculate mastery level (0-100) based on box and streaks
 */
const calculateMasteryLevel = (box, correctStreak, reviewCount) => {
  // Base mastery from box (each box represents ~20%)
  const boxMastery = (box - 1) * 20;
  // Bonus from streak (max 15%)
  const streakBonus = Math.min(correctStreak * 3, 15);
  // Experience bonus (max 5%)
  const expBonus = Math.min(reviewCount, 5);
  return Math.min(100, boxMastery + streakBonus + expBonus);
};

/**
 * Validate point data before insert/update
 */
const validatePoint = (point) => {
  const errors = [];

  if (!point.title || point.title.trim() === '') {
    errors.push('Title is required');
  }
  if (!point.front) {
    errors.push('Front content is required');
  }
  if (!point.back) {
    errors.push('Back content is required');
  }
  if (point.itemType && !ITEM_TYPES.includes(point.itemType)) {
    errors.push(`Invalid item type: ${point.itemType}`);
  }
  if (point.domainType && !DOMAIN_TYPES.includes(point.domainType)) {
    errors.push(`Invalid domain type: ${point.domainType}`);
  }
  if (point.difficulty && !DIFFICULTY_LEVELS.includes(point.difficulty)) {
    errors.push(`Invalid difficulty: ${point.difficulty}`);
  }
  if (point.format && !FORMATS.includes(point.format)) {
    errors.push(`Invalid format: ${point.format}`);
  }
  if (point.sourceType && !SOURCE_TYPES.includes(point.sourceType)) {
    errors.push(`Invalid source type: ${point.sourceType}`);
  }
  if (point.status && !STATUSES.includes(point.status)) {
    errors.push(`Invalid status: ${point.status}`);
  }

  return errors;
};

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Create a new learning point
 * @param {Object} point - Learning point data
 * @param {string} token - User authentication token
 * @returns {Object} Created learning point or error
 */
export const createLearningPoint = (point, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    return { error: 'Invalid session' };
  }

  const errors = validatePoint(point);
  if (errors.length > 0) {
    return { error: errors.join(', ') };
  }

  try {
    const id = point.id || uuidv4();
    const now = dateToSQLiteString(new Date());
    const nextReview = calculateNextReview(1);

    const stmt = db.prepare(`
      INSERT INTO learning_point (
        id, user_id, title, front, back, extras,
        item_type, domain_type, difficulty, format,
        tags, source_type, source_id, plan_id, book_id,
        box, next_review, mastery_level, ease_factor, interval_days,
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    stmt.run(
      id,
      userId,
      point.title.trim(),
      serializeContent(point.front),
      serializeContent(point.back),
      point.extras ? JSON.stringify(point.extras) : null,
      point.itemType || 'concept',
      point.domainType || 'knowledge',
      point.difficulty || 'intermediate',
      point.format || 'card',
      point.tags ? JSON.stringify(point.tags) : null,
      point.sourceType || 'manual',
      point.sourceId || null,
      point.planId || null,
      point.bookId || null,
      1, // Start in box 1
      nextReview,
      0, // Initial mastery
      2.5, // Default ease factor
      1, // Initial interval
      point.status || 'active',
      now,
      now,
    );

    return getLearningPointById(id, token);
  } catch (err) {
    console.error('createLearningPoint error:', err);
    return { error: err.message };
  }
};

/**
 * Create multiple learning points in a batch
 * @param {Array} points - Array of learning point data
 * @param {string} token - User authentication token
 * @returns {Object} Result with created count and errors
 */
export const createLearningPointsBatch = (points, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    return { error: 'Invalid session' };
  }

  const results = { created: 0, errors: [] };

  const insertMany = db.transaction((items) => {
    for (const point of items) {
      const errors = validatePoint(point);
      if (errors.length > 0) {
        results.errors.push({ point: point.title, errors });
        continue;
      }

      try {
        const id = point.id || uuidv4();
        const now = dateToSQLiteString(new Date());
        const nextReview = calculateNextReview(1);

        const stmt = db.prepare(`
          INSERT INTO learning_point (
            id, user_id, title, front, back, extras,
            item_type, domain_type, difficulty, format,
            tags, source_type, source_id, plan_id, book_id,
            box, next_review, mastery_level, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          id,
          userId,
          point.title.trim(),
          serializeContent(point.front),
          serializeContent(point.back),
          point.extras ? JSON.stringify(point.extras) : null,
          point.itemType || 'concept',
          point.domainType || 'knowledge',
          point.difficulty || 'intermediate',
          point.format || 'card',
          point.tags ? JSON.stringify(point.tags) : null,
          point.sourceType || 'manual',
          point.sourceId || null,
          point.planId || null,
          point.bookId || null,
          1,
          nextReview,
          0,
          point.status || 'active',
          now,
          now,
        );
        results.created++;
      } catch (err) {
        results.errors.push({ point: point.title, error: err.message });
      }
    }
  });

  try {
    insertMany(points);
  } catch (err) {
    console.error('createLearningPointsBatch error:', err);
    return { error: err.message };
  }

  return results;
};

/**
 * Get a learning point by ID
 * @param {string} id - Learning point ID
 * @param {string} token - User authentication token
 * @returns {Object|null} Learning point or null
 */
export const getLearningPointById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;

  try {
    const stmt = db.prepare(`
      SELECT * FROM learning_point
      WHERE id = ? AND user_id = ?
    `);
    const row = stmt.get(id, userId);
    return parseRow(row);
  } catch (err) {
    console.error('getLearningPointById error:', err);
    return null;
  }
};

/**
 * Update a learning point
 * @param {string} id - Learning point ID
 * @param {Object} updates - Fields to update
 * @param {string} token - User authentication token
 * @returns {Object} Updated learning point or error
 */
export const updateLearningPoint = (id, updates, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    return { error: 'Invalid session' };
  }

  // Build dynamic update query
  const allowedFields = [
    'title',
    'front',
    'back',
    'extras',
    'item_type',
    'domain_type',
    'difficulty',
    'format',
    'tags',
    'source_type',
    'source_id',
    'plan_id',
    'book_id',
    'status',
  ];

  const setClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(snakeKey)) {
      setClauses.push(`"${snakeKey}" = ?`);
      if (['front', 'back'].includes(snakeKey)) {
        values.push(serializeContent(value));
      } else if (['extras', 'tags'].includes(snakeKey)) {
        values.push(value ? JSON.stringify(value) : null);
      } else {
        values.push(value);
      }
    }
  }

  if (setClauses.length === 0) {
    return { error: 'No valid fields to update' };
  }

  setClauses.push('"updated_at" = ?');
  values.push(dateToSQLiteString(new Date()));
  values.push(id, userId);

  try {
    const stmt = db.prepare(`
      UPDATE learning_point
      SET ${setClauses.join(', ')}
      WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(...values);

    if (result.changes === 0) {
      return { error: 'Learning point not found' };
    }

    return getLearningPointById(id, token);
  } catch (err) {
    console.error('updateLearningPoint error:', err);
    return { error: err.message };
  }
};

/**
 * Phase 8 production loop write-back.
 *
 * Applies a "explain it in your own words" grade to a learning point's
 * SRS state. Production scores reveal passive-vs-active gaps that SRS
 * recognition can't detect, so we use them as ground-truth corrections
 * to mastery_level (and on hard failures, demote the SRS box too).
 *
 * Rules:
 *   score >= 75  → confirmed. mastery_level = max(current, score). No box change.
 *   score 50-74  → partial. mastery_level = score (lower than current). No box change.
 *   score < 50   → failed. mastery_level = score, box -= 1 (min 1),
 *                  next_review = tomorrow so SRS surfaces it again.
 *
 * Returns { changed, beforeMastery, afterMastery, beforeBox, afterBox, demoted }.
 *
 * @param {string} id              learning_point.id
 * @param {number} productionScore 0–100 score from ComprehensionGradingService
 * @param {string} token
 */
export const applyProductionGrade = (id, productionScore, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return { error: 'Invalid session' };

  const current = db
    .prepare(
      `SELECT id, mastery_level AS masteryLevel, box
         FROM learning_point WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId);
  if (!current) return { error: 'Learning point not found' };

  const score = Math.max(0, Math.min(100, Math.round(productionScore || 0)));
  let nextMastery = current.masteryLevel;
  let nextBox = current.box;
  let demoted = false;
  let nextReview = null;

  if (score >= 75) {
    nextMastery = Math.max(current.masteryLevel || 0, score);
  } else if (score >= 50) {
    nextMastery = score;
  } else {
    nextMastery = score;
    nextBox = Math.max(1, (current.box || 1) - 1);
    demoted = nextBox !== current.box;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    nextReview = dateToSQLiteString(tomorrow);
  }

  const updatedAt = dateToSQLiteString(new Date());
  try {
    if (nextReview !== null) {
      // Hard failure: also reset correct_streak so the SRS engine
      // treats the next review as a fresh attempt, not a continuation.
      db.prepare(
        `UPDATE learning_point
            SET mastery_level = ?, box = ?, next_review = ?,
                correct_streak = 0, updated_at = ?
          WHERE id = ? AND user_id = ?`,
      ).run(nextMastery, nextBox, nextReview, updatedAt, id, userId);
    } else {
      db.prepare(
        `UPDATE learning_point
            SET mastery_level = ?, box = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
      ).run(nextMastery, nextBox, updatedAt, id, userId);
    }
  } catch (err) {
    console.error('applyProductionGrade error:', err);
    return { error: err.message };
  }

  return {
    changed: nextMastery !== current.masteryLevel || nextBox !== current.box,
    beforeMastery: current.masteryLevel,
    afterMastery: nextMastery,
    beforeBox: current.box,
    afterBox: nextBox,
    demoted,
    nextReview,
  };
};

/**
 * Delete a learning point (soft delete)
 * @param {string} id - Learning point ID
 * @param {string} token - User authentication token
 * @param {boolean} hard - If true, permanently delete
 * @returns {boolean} Success status
 */
export const deleteLearningPoint = (id, token, hard = false) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return false;

  try {
    if (hard) {
      const stmt = db.prepare(`
        DELETE FROM learning_point
        WHERE id = ? AND user_id = ?
      `);
      stmt.run(id, userId);
    } else {
      const stmt = db.prepare(`
        UPDATE learning_point
        SET status = 'deleted', updated_at = ?
        WHERE id = ? AND user_id = ?
      `);
      stmt.run(dateToSQLiteString(new Date()), id, userId);
    }
    return true;
  } catch (err) {
    console.error('deleteLearningPoint error:', err);
    return false;
  }
};

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Get items due for review
 * @param {Object} options - Query options
 * @returns {Array} Due learning points
 */
export const getDueItems = ({
  token,
  date = null,
  limit = 50,
  offset = 0,
  itemTypes = null,
  domainTypes = null,
  tags = null,
  planId = null,
  includeNew = true,
}) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];

  const targetDate = date || dateToSQLiteString(new Date());
  const conditions = [
    'user_id = ?',
    'status = ?',
    'fully_learned = 0',
    '(next_review IS NULL OR next_review <= ?)',
  ];
  const params = [userId, 'active', targetDate];

  if (!includeNew) {
    conditions.push('review_count > 0');
  }

  if (itemTypes && itemTypes.length > 0) {
    conditions.push(`item_type IN (${itemTypes.map(() => '?').join(',')})`);
    params.push(...itemTypes);
  }

  if (domainTypes && domainTypes.length > 0) {
    conditions.push(`domain_type IN (${domainTypes.map(() => '?').join(',')})`);
    params.push(...domainTypes);
  }

  if (planId) {
    conditions.push('plan_id = ?');
    params.push(planId);
  }

  // Tag filtering using JSON contains (SQLite LIKE)
  if (tags && tags.length > 0) {
    const tagConditions = tags.map(() => 'tags LIKE ?');
    conditions.push(`(${tagConditions.join(' OR ')})`);
    params.push(...tags.map((tag) => `%"${tag}"%`));
  }

  params.push(limit, offset);

  try {
    const stmt = db.prepare(`
      SELECT * FROM learning_point
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE WHEN next_review IS NULL THEN 0 ELSE 1 END,
        box ASC,
        next_review ASC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params);
    return rows.map(parseRow);
  } catch (err) {
    console.error('getDueItems error:', err);
    return [];
  }
};

/**
 * Get learning points by source
 * @param {string} sourceType - Source type
 * @param {string} sourceId - Source ID
 * @param {string} token - User authentication token
 * @returns {Array} Learning points
 */
export const getBySource = (sourceType, sourceId, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];

  try {
    const stmt = db.prepare(`
      SELECT * FROM learning_point
      WHERE user_id = ? AND source_type = ? AND source_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(userId, sourceType, sourceId);
    return rows.map(parseRow);
  } catch (err) {
    console.error('getBySource error:', err);
    return [];
  }
};

/**
 * Get learning points by plan
 * @param {string} planId - Plan ID
 * @param {string} token - User authentication token
 * @returns {Array} Learning points
 */
export const getByPlan = (planId, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];

  try {
    const stmt = db.prepare(`
      SELECT * FROM learning_point
      WHERE user_id = ? AND plan_id = ? AND status != 'deleted'
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(userId, planId);
    return rows.map(parseRow);
  } catch (err) {
    console.error('getByPlan error:', err);
    return [];
  }
};

/**
 * Search learning points
 * @param {string} query - Search query
 * @param {string} token - User authentication token
 * @param {Object} options - Search options
 * @returns {Array} Matching learning points
 */
export const searchLearningPoints = (query, token, options = {}) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];

  const {
    limit = 50,
    offset = 0,
    domainType = null,
    itemType = null,
  } = options;

  const conditions = ['user_id = ?', 'status != ?'];
  const params = [userId, 'deleted'];

  // Full-text search on title and content
  conditions.push(
    '(title LIKE ? OR front LIKE ? OR back LIKE ? OR tags LIKE ?)',
  );
  const searchPattern = `%${query}%`;
  params.push(searchPattern, searchPattern, searchPattern, searchPattern);

  if (domainType) {
    conditions.push('domain_type = ?');
    params.push(domainType);
  }

  if (itemType) {
    conditions.push('item_type = ?');
    params.push(itemType);
  }

  params.push(limit, offset);

  try {
    const stmt = db.prepare(`
      SELECT * FROM learning_point
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT ? OFFSET ?
    `);

    // Add title match priority param
    const rows = stmt.all(...params.slice(0, -2), searchPattern, limit, offset);
    return rows.map(parseRow);
  } catch (err) {
    console.error('searchLearningPoints error:', err);
    return [];
  }
};

/**
 * Get all learning points for a user (paginated)
 * @param {string} token - User authentication token
 * @param {Object} options - Query options
 * @returns {Object} { items, total, page, pageSize }
 */
export const getAllLearningPoints = (token, options = {}) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return { items: [], total: 0, page: 1, pageSize: 50 };

  const {
    page = 1,
    pageSize = 50,
    domainType = null,
    itemType = null,
    status = 'active',
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = options;

  const offset = (page - 1) * pageSize;
  const conditions = ['user_id = ?'];
  const params = [userId];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (domainType) {
    conditions.push('domain_type = ?');
    params.push(domainType);
  }

  if (itemType) {
    conditions.push('item_type = ?');
    params.push(itemType);
  }

  try {
    // Get total count
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total FROM learning_point
      WHERE ${conditions.join(' AND ')}
    `);
    const { total } = countStmt.get(...params);

    // Get items
    const validSortColumns = [
      'created_at',
      'updated_at',
      'title',
      'box',
      'mastery_level',
      'next_review',
    ];
    const sortColumn = validSortColumns.includes(sortBy)
      ? sortBy
      : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const stmt = db.prepare(`
      SELECT * FROM learning_point
      WHERE ${conditions.join(' AND ')}
      ORDER BY "${sortColumn}" ${order}
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, pageSize, offset);

    return {
      items: rows.map(parseRow),
      total,
      page,
      pageSize,
    };
  } catch (err) {
    console.error('getAllLearningPoints error:', err);
    return { items: [], total: 0, page, pageSize };
  }
};

// =============================================================================
// SPACED REPETITION OPERATIONS
// =============================================================================

/**
 * Process a review and update SR state
 * @param {string} id - Learning point ID
 * @param {number} rating - Rating 1-4 (Again, Hard, Good, Easy)
 * @param {number} responseTimeMs - Response time in milliseconds
 * @param {string} token - User authentication token
 * @returns {Object} Updated SR state
 */
export const processReview = (id, rating, responseTimeMs, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    return { error: 'Invalid session' };
  }

  const point = getLearningPointById(id, token);
  if (!point) {
    return { error: 'Learning point not found' };
  }

  try {
    const now = dateToSQLiteString(new Date());
    let newBox = point.box;
    let newStreak = point.correct_streak || 0;
    let newCorrect = point.total_correct || 0;
    let newIncorrect = point.total_incorrect || 0;
    let newEaseFactor = point.ease_factor || 2.5;
    let fullyLearned = point.fully_learned;

    // Process rating
    if (rating === 1) {
      // Again: back to box 1
      newBox = 1;
      newStreak = 0;
      newIncorrect++;
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
    } else if (rating === 2) {
      // Hard: stay in current box, reduce ease
      newStreak = 0;
      newIncorrect++;
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.15);
    } else if (rating === 3) {
      // Good: advance to next box
      newBox = Math.min(5, newBox + 1);
      newStreak++;
      newCorrect++;
    } else if (rating === 4) {
      // Easy: skip a box, increase ease
      newBox = Math.min(5, newBox + 2);
      newStreak++;
      newCorrect++;
      newEaseFactor = Math.min(3.0, newEaseFactor + 0.1);
    }

    // Check if fully learned (box 5 with stable streak)
    if (newBox === 5 && newStreak >= 3) {
      fullyLearned = 1;
    }

    // Calculate next review
    const nextReview = calculateNextReview(newBox, newEaseFactor);
    const masteryLevel = calculateMasteryLevel(
      newBox,
      newStreak,
      point.review_count + 1,
    );

    // Calculate average response time
    const avgResponseTime = point.avg_response_time_ms
      ? Math.round((point.avg_response_time_ms + responseTimeMs) / 2)
      : responseTimeMs;

    // Update database
    const stmt = db.prepare(`
      UPDATE learning_point SET
        box = ?,
        next_review = ?,
        last_reviewed_at = ?,
        review_count = review_count + 1,
        correct_streak = ?,
        total_correct = ?,
        total_incorrect = ?,
        fully_learned = ?,
        mastery_level = ?,
        ease_factor = ?,
        interval_days = ?,
        avg_response_time_ms = ?,
        last_response_time_ms = ?,
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(
      newBox,
      nextReview,
      now,
      newStreak,
      newCorrect,
      newIncorrect,
      fullyLearned,
      masteryLevel,
      newEaseFactor,
      BOX_INTERVALS[newBox],
      avgResponseTime,
      responseTimeMs,
      now,
      id,
      userId,
    );

    return {
      success: true,
      previousBox: point.box,
      newBox,
      nextReview,
      masteryLevel,
      fullyLearned: fullyLearned === 1,
      correctStreak: newStreak,
      totalCorrect: newCorrect,
      totalIncorrect: newIncorrect,
    };
  } catch (err) {
    console.error('processReview error:', err);
    return { error: err.message };
  }
};

/**
 * Reset a learning point to box 1
 * @param {string} id - Learning point ID
 * @param {string} token - User authentication token
 * @returns {boolean} Success status
 */
export const resetLearningPoint = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return false;

  try {
    const now = dateToSQLiteString(new Date());
    const nextReview = calculateNextReview(1);

    const stmt = db.prepare(`
      UPDATE learning_point SET
        box = 1,
        next_review = ?,
        correct_streak = 0,
        fully_learned = 0,
        mastery_level = 0,
        ease_factor = 2.5,
        interval_days = 1,
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(nextReview, now, id, userId);
    return true;
  } catch (err) {
    console.error('resetLearningPoint error:', err);
    return false;
  }
};

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get learning statistics for a user
 * @param {string} token - User authentication token
 * @param {Object} options - Filter options
 * @returns {Object} Statistics
 */
export const getStats = (token, options = {}) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;

  const { planId = null, domainType = null } = options;

  const conditions = ['user_id = ?', "status != 'deleted'"];
  const params = [userId];

  if (planId) {
    conditions.push('plan_id = ?');
    params.push(planId);
  }

  if (domainType) {
    conditions.push('domain_type = ?');
    params.push(domainType);
  }

  try {
    // Overall stats
    const overallStmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN fully_learned = 1 THEN 1 ELSE 0 END) as mastered,
        SUM(CASE WHEN box = 1 THEN 1 ELSE 0 END) as box1,
        SUM(CASE WHEN box = 2 THEN 1 ELSE 0 END) as box2,
        SUM(CASE WHEN box = 3 THEN 1 ELSE 0 END) as box3,
        SUM(CASE WHEN box = 4 THEN 1 ELSE 0 END) as box4,
        SUM(CASE WHEN box = 5 THEN 1 ELSE 0 END) as box5,
        AVG(mastery_level) as avgMastery,
        SUM(review_count) as totalReviews,
        SUM(total_correct) as totalCorrect,
        SUM(total_incorrect) as totalIncorrect
      FROM learning_point
      WHERE ${conditions.join(' AND ')}
    `);

    const overall = overallStmt.get(...params);

    // Due today
    const today = dateToSQLiteString(new Date());
    const dueStmt = db.prepare(`
      SELECT COUNT(*) as dueCount
      FROM learning_point
      WHERE ${conditions.join(' AND ')} AND fully_learned = 0
        AND (next_review IS NULL OR next_review <= ?)
    `);
    const { dueCount } = dueStmt.get(...params, today);

    // By domain
    const domainStmt = db.prepare(`
      SELECT domain_type, COUNT(*) as count
      FROM learning_point
      WHERE ${conditions.join(' AND ')}
      GROUP BY domain_type
    `);
    const byDomain = domainStmt.all(...params);

    // By item type
    const typeStmt = db.prepare(`
      SELECT item_type, COUNT(*) as count
      FROM learning_point
      WHERE ${conditions.join(' AND ')}
      GROUP BY item_type
    `);
    const byType = typeStmt.all(...params);

    // Recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentStmt = db.prepare(`
      SELECT
        COUNT(*) as reviewedCount,
        SUM(CASE WHEN total_correct > 0 THEN 1 ELSE 0 END) as correctCount
      FROM learning_point
      WHERE ${conditions.join(' AND ')} AND last_reviewed_at >= ?
    `);
    const recent = recentStmt.get(...params, dateToSQLiteString(weekAgo));

    return {
      total: overall.total || 0,
      mastered: overall.mastered || 0,
      dueToday: dueCount || 0,
      boxes: {
        1: overall.box1 || 0,
        2: overall.box2 || 0,
        3: overall.box3 || 0,
        4: overall.box4 || 0,
        5: overall.box5 || 0,
      },
      avgMastery: Math.round(overall.avgMastery || 0),
      totalReviews: overall.totalReviews || 0,
      accuracy:
        overall.totalReviews > 0
          ? Math.round(
              (overall.totalCorrect /
                (overall.totalCorrect + overall.totalIncorrect)) *
                100,
            )
          : 0,
      byDomain: byDomain.reduce((acc, { domain_type, count }) => {
        acc[domain_type] = count;
        return acc;
      }, {}),
      byType: byType.reduce((acc, { item_type, count }) => {
        acc[item_type] = count;
        return acc;
      }, {}),
      recentWeek: {
        reviewed: recent.reviewedCount || 0,
        correct: recent.correctCount || 0,
      },
    };
  } catch (err) {
    console.error('getStats error:', err);
    return null;
  }
};

/**
 * Get daily review counts for calendar view
 * @param {string} token - User authentication token
 * @param {number} days - Number of days to look ahead
 * @returns {Object} Daily counts
 */
export const getDailyForecast = (token, days = 14) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return {};

  try {
    const forecast = {};
    const today = new Date();

    for (let i = 0; i <= days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = dateToSQLiteString(date).split('T')[0];

      const stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM learning_point
        WHERE user_id = ? AND status = 'active' AND fully_learned = 0
          AND DATE(next_review) = ?
      `);

      const { count } = stmt.get(userId, dateStr);
      forecast[dateStr] = count;
    }

    return forecast;
  } catch (err) {
    console.error('getDailyForecast error:', err);
    return {};
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

export {
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  FORMATS,
  SOURCE_TYPES,
  STATUSES,
  BOX_INTERVALS,
};
