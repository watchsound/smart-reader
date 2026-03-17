/**
 * UnifiedLearningPointManager.js
 *
 * Unified query interface for ALL learning content.
 * Now uses Neo4j as primary storage via LearningPointService.
 *
 * The learning_point system provides:
 * - Neo4j as primary storage (graph database)
 * - Single source of truth for all learning content
 * - Embedded Leitner SR (no JOIN required)
 * - Consistent schema across all content types
 *
 * NOTE: This file re-exports from LearningPointService for backward compatibility.
 * The underlying implementation has migrated from SQLite to Neo4j.
 */

import learningPointService, {
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  SOURCE_TYPES,
  RATINGS,
  BOX_INTERVALS,
} from '../utils/LearningPointService';

// Constants not in new service - provide fallbacks
const FORMATS = ['card', 'mindmap', 'quiz', 'image', 'code'];

/**
 * Convert Leitner box (1-5) to mastery level (0-100)
 */
const boxToMastery = (box) => {
  if (!box || box < 1) return 0;
  // Box 1: 0-20%, Box 2: 20-40%, Box 3: 40-60%, Box 4: 60-80%, Box 5: 80-100%
  return Math.min(100, (box - 1) * 20 + 10);
};

/**
 * Normalize learning point to UI format
 * Handles both Neo4j (camelCase) and SQLite (snake_case) formats
 */
const normalizeItem = (item) => {
  if (!item) return null;
  // Neo4j adapter returns camelCase, SQLite returns snake_case
  // Handle both for backward compatibility
  return {
    ...item,
    id: item.id,
    sourceType: item.sourceType || item.source_type,
    sourceId: item.sourceId || item.source_id,
    front: item.front,
    back: item.back,
    itemType: item.itemType || item.item_type,
    domainType: item.domainType || item.domain_type,
    nextReview: item.nextReview || item.next_review,
    masteryLevel: item.masteryLevel || item.mastery_level || boxToMastery(item.box),
    lastReviewedAt: item.lastReviewedAt || item.last_reviewed_at,
    reviewCount: item.reviewCount || item.review_count,
    correctStreak: item.correctStreak || item.correct_streak,
    totalCorrect: item.totalCorrect || item.total_correct,
    totalIncorrect: item.totalIncorrect || item.total_incorrect,
    fullyLearned: item.fullyLearned || item.fully_learned,
    easeFactor: item.easeFactor || item.ease_factor,
    intervalDays: item.intervalDays || item.interval_days,
    avgResponseTimeMs: item.avgResponseTimeMs || item.avg_response_time_ms,
    lastResponseTimeMs: item.lastResponseTimeMs || item.last_response_time_ms,
    createdAt: item.createdAt || item.created_at,
    updatedAt: item.updatedAt || item.updated_at,
  };
};

/**
 * Get due items for review
 *
 * @param {Object} options - Query options
 * @param {string} options.token - User token for authentication
 * @param {Date|string} options.date - Date to check due items against (default: now)
 * @param {number} options.limit - Maximum items to return (default: 50)
 * @param {string[]} options.itemTypes - Filter by item types (optional)
 * @param {string[]} options.domainTypes - Filter by domain types (optional)
 * @param {string[]} options.tags - Filter by tags (optional)
 * @param {string} options.planId - Filter by specific plan ID (optional)
 * @param {boolean} options.includeNew - Include items never reviewed (default: true)
 * @returns {Object} { data: LearningPoint[], total: number }
 */
const getDueItemsUnified = async (options = {}) => {
  const {
    token,
    date,
    limit = 50,
    offset = 0,
    itemTypes = null,
    domainTypes = null,
    tags = null,
    planId = null,
    includeNew = true,
  } = options;

  const items = await learningPointService.getDueForReview({
    token,
    date: date instanceof Date ? date.toISOString().split('T')[0] : date,
    limit,
    offset,
    itemTypes,
    domainTypes,
    tags,
    planId,
    includeNew,
  });

  return {
    data: (items || []).map(normalizeItem),
    total: items?.length || 0,
  };
};

/**
 * Process a review for a learning point
 *
 * @param {Object} options - Review options
 * @param {string} options.itemId - Learning point ID
 * @param {number} options.rating - Rating 1-4 (Again, Hard, Good, Easy)
 * @param {number} options.responseTime - Response time in milliseconds
 * @param {string} options.token - User token
 * @returns {Object} Result with updated item state
 */
const processReviewUnified = async (options = {}) => {
  const { itemId, rating, responseTime = 0, token } = options;

  if (!itemId || !rating) {
    return { success: false, error: 'Missing itemId or rating' };
  }

  const result = await learningPointService.processReview(itemId, rating, responseTime, token);

  if (result.error) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    newBox: result.newBox || result.box,
    nextReview: result.nextReview || result.next_review,
    masteryLevel: result.masteryLevel || result.mastery_level,
    correctStreak: result.correctStreak || result.correct_streak,
    reviewCount: result.reviewCount || result.review_count,
  };
};

/**
 * Get statistics for learning points
 *
 * @param {string} token - User token
 * @param {Object} options - Filter options
 * @returns {Object} Statistics
 */
const getStatsUnified = async (token, options = {}) => {
  const stats = await learningPointService.getStats(token, options);

  if (!stats || stats.error) {
    return { error: stats?.error || 'Failed to get stats' };
  }

  return {
    total: stats.total,
    dueToday: stats.dueToday,
    mastered: stats.mastered,
    learning: stats.learning,
    byBox: stats.byBox || stats.boxes,
    byDomain: stats.byDomain,
    byItemType: stats.byItemType || stats.byType,
    averageMastery: stats.averageMastery || stats.avgMastery,
    totalDue: stats.dueToday,
    totalItems: stats.total,
  };
};

/**
 * Get a single learning point by ID
 *
 * @param {string} itemId - Learning point ID
 * @param {string} token - User token
 * @returns {Object|null} Learning point or null
 */
const getItemByIdUnified = async (itemId, token) => {
  const item = await learningPointService.getLearningPointById(itemId, token);
  return normalizeItem(item);
};

/**
 * Create a new learning point
 *
 * @param {Object} point - Learning point data
 * @param {string} token - User token
 * @returns {Object} Created learning point or error
 */
const createItem = async (point, token) => {
  const result = await learningPointService.createLearningPoint(point, token);
  if (result.error) {
    return { success: false, error: result.error };
  }
  return { success: true, item: normalizeItem(result) };
};

/**
 * Create multiple learning points in batch
 *
 * @param {Array} points - Array of learning point data
 * @param {string} token - User token
 * @returns {Object} Result with created count and errors
 */
const createItemsBatch = async (points, token) => {
  return learningPointService.createLearningPointsBatch(points, token);
};

/**
 * Update a learning point
 *
 * @param {string} itemId - Learning point ID
 * @param {Object} updates - Fields to update
 * @param {string} token - User token
 * @returns {Object} Updated learning point or error
 */
const updateItem = async (itemId, updates, token) => {
  const result = await learningPointService.updateLearningPoint(itemId, updates, token);
  if (result.error) {
    return { success: false, error: result.error };
  }
  return { success: true, item: normalizeItem(result) };
};

/**
 * Delete a learning point
 *
 * @param {string} itemId - Learning point ID
 * @param {string} token - User token
 * @param {boolean} hard - Hard delete (permanent) vs soft delete
 * @returns {Object} Success status
 */
const deleteItem = async (itemId, token, hard = false) => {
  const result = await learningPointService.deleteLearningPoint(itemId, token, hard);
  return { success: result };
};

/**
 * Search learning points
 *
 * @param {string} query - Search query
 * @param {string} token - User token
 * @param {Object} options - Search options
 * @returns {Array} Matching learning points
 */
const searchItems = async (query, token, options = {}) => {
  const items = await learningPointService.search(query, token, options);
  return (items || []).map(normalizeItem);
};

/**
 * Get learning points by source
 *
 * @param {string} sourceType - Source type
 * @param {string} sourceId - Source ID
 * @param {string} token - User token
 * @returns {Array} Learning points
 */
const getItemsBySource = async (sourceType, sourceId, token) => {
  const items = await learningPointService.getBySource(sourceType, sourceId, token);
  return (items || []).map(normalizeItem);
};

/**
 * Get learning points by plan
 *
 * @param {string} planId - Plan ID
 * @param {string} token - User token
 * @returns {Array} Learning points
 */
const getItemsByPlan = async (planId, token) => {
  const items = await learningPointService.getByPlan(planId, token);
  return (items || []).map(normalizeItem);
};

/**
 * Get all learning points (paginated)
 *
 * @param {string} token - User token
 * @param {Object} options - Query options
 * @returns {Object} { items, total, page, pageSize }
 */
const getAllItems = async (token, options = {}) => {
  const result = await learningPointService.getAll(token, options);
  // Handle both array and object responses
  if (Array.isArray(result)) {
    return {
      items: result.map(normalizeItem),
      total: result.length,
      page: 1,
      pageSize: options.limit || 50,
    };
  }
  return {
    items: result.items?.map(normalizeItem) || [],
    total: result.total || 0,
    page: result.page || 1,
    pageSize: result.pageSize || 50,
  };
};

/**
 * Reset a learning point to box 1
 *
 * @param {string} itemId - Learning point ID
 * @param {string} token - User token
 * @returns {boolean} Success status
 */
const resetItem = async (itemId, token) => {
  return learningPointService.reset(itemId, token);
};

/**
 * Get daily review forecast
 *
 * @param {string} token - User token
 * @param {number} days - Number of days to forecast
 * @returns {Object} Daily counts by date
 */
const getForecast = async (token, days = 14) => {
  return learningPointService.getForecast(token, days);
};

/**
 * Check if the learning point service is available (Neo4j connected)
 * @returns {boolean}
 */
const isAvailable = () => {
  return learningPointService.isAvailable();
};

export {
  // Query functions
  getDueItemsUnified as getDueItems,
  getStatsUnified as getStats,
  getItemByIdUnified as getItemById,
  searchItems as search,
  getItemsBySource,
  getItemsByPlan,
  getAllItems,
  getForecast,

  // CRUD functions
  createItem,
  createItemsBatch,
  updateItem,
  deleteItem,
  resetItem,

  // Review function
  processReviewUnified as processReview,

  // Helper functions
  normalizeItem,
  boxToMastery,
  isAvailable,

  // Constants (re-exported)
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  SOURCE_TYPES,
  RATINGS,
  FORMATS,
  BOX_INTERVALS,
};

export default {
  getDueItems: getDueItemsUnified,
  processReview: processReviewUnified,
  getStats: getStatsUnified,
  getItemById: getItemByIdUnified,
  search: searchItems,
  getItemsBySource,
  getItemsByPlan,
  getAllItems,
  getForecast,
  createItem,
  createItemsBatch,
  updateItem,
  deleteItem,
  resetItem,
  normalizeItem,
  boxToMastery,
  isAvailable,
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  SOURCE_TYPES,
  RATINGS,
  FORMATS,
  BOX_INTERVALS,
};
