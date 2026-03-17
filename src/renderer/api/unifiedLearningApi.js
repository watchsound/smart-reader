/**
 * unifiedLearningApi.js
 *
 * Renderer-side API for the Unified Learning Point system.
 * Single entry point for all learning content (vocabulary, notes, learning plans).
 */

/**
 * Get the IPC renderer (lazy-loaded for test compatibility)
 */
const getIpcRenderer = () => {
  if (
    typeof window !== 'undefined' &&
    window.electron &&
    window.electron.ipcRenderer
  ) {
    return window.electron.ipcRenderer;
  }
  throw new Error('ipcRenderer not available');
};

/**
 * Item types that can be queried
 */
export const ITEM_TYPES = {
  ALL: 'all',
  VOCABULARY: 'vocabulary',
  NOTE: 'note',
  PLAN: 'plan',
};

/**
 * Rating constants (same as Leitner/FSRS)
 */
export const RATINGS = {
  AGAIN: 1, // Incorrect - reset to box 1
  HARD: 2, // Correct but difficult - stay in box
  GOOD: 3, // Correct - advance to next box
  EASY: 4, // Very easy - skip a box
};

/**
 * Check if unified learning API is available
 * @returns {boolean}
 */
export const isAvailable = () => {
  try {
    return getIpcRenderer().sendSync('unified-learning-available') === true;
  } catch {
    return false;
  }
};

/**
 * Get due items from all learning sources
 *
 * @param {Object} options - Query options
 * @param {string} options.token - User authentication token
 * @param {Date|string} [options.date] - Date to check due items against (default: now)
 * @param {number} [options.limit=50] - Maximum items to return
 * @param {string[]} [options.itemTypes=['all']] - Filter by types: ['vocabulary', 'note', 'plan', 'all']
 * @param {string[]} [options.tags] - Filter by tags (optional)
 * @param {string} [options.planId] - Filter by specific plan ID (optional)
 * @returns {Promise<{ data: UnifiedLearningPoint[], total: number, totalBySource: object }>}
 *
 * @example
 * // Get all due items
 * const result = await unifiedLearningApi.getDueItems({ token });
 *
 * // Get only vocabulary items
 * const vocab = await unifiedLearningApi.getDueItems({
 *   token,
 *   itemTypes: ['vocabulary'],
 *   limit: 20
 * });
 *
 * // Get items for a specific plan
 * const planItems = await unifiedLearningApi.getDueItems({
 *   token,
 *   itemTypes: ['plan'],
 *   planId: 'plan_123'
 * });
 */
export const getDueItems = async (options = {}) => {
  const {
    token,
    date = new Date(),
    limit = 50,
    itemTypes = [ITEM_TYPES.ALL],
    tags = null,
    planId = null,
  } = options;

  return getIpcRenderer().invoke('unified-learning-get-due', {
    token,
    date: date instanceof Date ? date.toISOString() : date,
    limit,
    itemTypes,
    tags,
    planId,
  });
};

/**
 * Process a review for any item type
 * Routes to correct handler (Leitner for vocab/notes, FSRS for plans)
 *
 * @param {Object} options - Review options
 * @param {string} options.itemId - Unified item ID (e.g., "vocab_123", "note_456", "lp_789")
 * @param {number} options.rating - Rating 1-4 (AGAIN, HARD, GOOD, EASY)
 * @param {number} [options.responseTime=0] - Response time in milliseconds
 * @param {string} options.token - User authentication token
 * @returns {Promise<{ success: boolean, sourceType: string, newBox?: number, nextReview?: string }>}
 *
 * @example
 * // Process a correct answer
 * const result = await unifiedLearningApi.processReview({
 *   itemId: 'vocab_123',
 *   rating: RATINGS.GOOD,
 *   responseTime: 2500,
 *   token
 * });
 */
export const processReview = async (options = {}) => {
  const { itemId, rating, responseTime = 0, token } = options;

  if (!itemId || !rating) {
    return { success: false, error: 'Missing itemId or rating' };
  }

  return getIpcRenderer().invoke('unified-learning-process-review', {
    itemId,
    rating,
    responseTime,
    token,
  });
};

/**
 * Get statistics across all learning sources
 *
 * @param {string} token - User authentication token
 * @returns {Promise<{
 *   vocabulary: { total, due, mastered, learning },
 *   notes: { total, due, mastered, learning },
 *   plans: { total, pointsTotal, pointsDue },
 *   totalDue: number,
 *   totalItems: number
 * }>}
 *
 * @example
 * const stats = await unifiedLearningApi.getStats(token);
 * console.log(`Total due: ${stats.totalDue}`);
 * console.log(`Vocabulary: ${stats.vocabulary.due} due of ${stats.vocabulary.total}`);
 */
export const getStats = async (token) => {
  return getIpcRenderer().invoke('unified-learning-get-stats', token);
};

/**
 * Get a single item by unified ID
 *
 * @param {string} itemId - Unified item ID
 * @param {string} token - User authentication token
 * @returns {Promise<UnifiedLearningPoint|null>}
 */
export const getItemById = async (itemId, token) => {
  return getIpcRenderer().invoke('unified-learning-get-item', itemId, token);
};

/**
 * Parse a unified item ID to get source type and source ID
 *
 * @param {string} itemId - Unified item ID (e.g., "vocab_123")
 * @returns {{ sourceType: string, sourceId: string }}
 */
export const parseItemId = (itemId) => {
  const parts = itemId.split('_');
  if (parts.length < 2) {
    return { sourceType: 'unknown', sourceId: itemId };
  }
  return {
    sourceType: parts[0],
    sourceId: parts.slice(1).join('_'),
  };
};

/**
 * Create a unified item ID from source type and source ID
 *
 * @param {string} sourceType - 'vocab', 'note', or 'lp'
 * @param {string|number} sourceId - Original ID
 * @returns {string} Unified item ID
 */
export const createItemId = (sourceType, sourceId) => {
  return `${sourceType}_${sourceId}`;
};

/**
 * Get the display label for an item type
 *
 * @param {string} itemType - Item type from UnifiedLearningPoint
 * @returns {string} Human-readable label
 */
export const getItemTypeLabel = (itemType) => {
  const labels = {
    word: 'Vocabulary',
    concept: 'Concept',
    formula: 'Formula',
    problem: 'Problem',
    quiz: 'Quiz',
    mindmap: 'Mind Map',
    image: 'Image',
    code: 'Code',
  };
  return labels[itemType] || itemType;
};

/**
 * Get color for source type (for UI styling)
 *
 * @param {string} sourceType - 'vocabulary', 'note', or 'plan'
 * @returns {{ primary: string, light: string }}
 */
export const getSourceTypeColor = (sourceType) => {
  const colors = {
    vocabulary: { primary: '#4CAF50', light: '#E8F5E9' },
    note: { primary: '#FF9800', light: '#FFF3E0' },
    plan: { primary: '#2196F3', light: '#E3F2FD' },
  };
  return colors[sourceType] || colors.plan;
};

/**
 * Calculate mastery percentage from box number
 *
 * @param {number} box - Leitner box (1-5)
 * @returns {number} Mastery percentage (0-100)
 */
export const boxToMastery = (box) => {
  if (!box || box < 1) return 0;
  return Math.min(100, (box - 1) * 20 + 10);
};

/**
 * Get box label from box number
 *
 * @param {number} box - Leitner box (1-5)
 * @returns {string} Label
 */
export const getBoxLabel = (box) => {
  const labels = ['New', 'Learning', 'Reviewing', 'Familiar', 'Mastered'];
  return labels[Math.min(Math.max(0, (box || 1) - 1), 4)];
};

export default {
  // Core API
  getDueItems,
  processReview,
  getStats,
  getItemById,
  isAvailable,

  // Utility functions
  parseItemId,
  createItemId,
  getItemTypeLabel,
  getSourceTypeColor,
  boxToMastery,
  getBoxLabel,

  // Constants
  ITEM_TYPES,
  RATINGS,
};
