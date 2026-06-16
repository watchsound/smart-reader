/**
 * learningPointApi.js
 *
 * Renderer-side API for unified learning points.
 * Provides clean interface to IPC channels for learning point operations.
 *
 * The backend now uses Neo4j as the primary storage via GraphInterface
 * abstraction layer, replacing the previous SQLite-based implementation.
 */

const { ipcRenderer } = window.electron || {};

// =============================================================================
// SERVICE STATUS
// =============================================================================

/**
 * Check if learning point service is available (Neo4j connected)
 * @returns {Object} { available: boolean, constants: Object }
 */
export const getStatus = () => {
  return ipcRenderer?.sendSync('lp-status') || { available: false, constants: {} };
};

/**
 * Check if the service is available
 * @returns {boolean}
 */
export const isAvailable = () => {
  const status = getStatus();
  return status?.available || false;
};

// =============================================================================
// CONSTANTS (cached from main process)
// =============================================================================

let _itemTypes = null;
let _domainTypes = null;
let _difficultyLevels = null;
let _formats = null;
let _sourceTypes = null;

/**
 * Get available item types
 */
export const getItemTypes = () => {
  if (!_itemTypes) {
    _itemTypes = ipcRenderer?.sendSync('lp-get-item-types') || [
      'word', 'concept', 'formula', 'rule', 'fact',
      'problem', 'technique', 'pattern', 'definition', 'example',
    ];
  }
  return _itemTypes;
};

/**
 * Get available domain types
 */
export const getDomainTypes = () => {
  if (!_domainTypes) {
    _domainTypes = ipcRenderer?.sendSync('lp-get-domain-types') || [
      'vocabulary', 'math', 'physics', 'chemistry', 'biology',
      'language', 'programming', 'knowledge', 'skill', 'history',
      'geography', 'custom',
    ];
  }
  return _domainTypes;
};

/**
 * Get available difficulty levels
 */
export const getDifficultyLevels = () => {
  if (!_difficultyLevels) {
    _difficultyLevels = ipcRenderer?.sendSync('lp-get-difficulty-levels') || [
      'beginner', 'elementary', 'intermediate', 'advanced', 'expert',
    ];
  }
  return _difficultyLevels;
};

/**
 * Get available formats
 */
export const getFormats = () => {
  if (!_formats) {
    _formats = ipcRenderer?.sendSync('lp-get-formats') || [
      'card', 'mindmap', 'quiz', 'image', 'code',
    ];
  }
  return _formats;
};

/**
 * Get available source types
 */
export const getSourceTypes = () => {
  if (!_sourceTypes) {
    _sourceTypes = ipcRenderer?.sendSync('lp-get-source-types') || [
      'book', 'url', 'chat', 'plan', 'manual',
    ];
  }
  return _sourceTypes;
};

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Create a new learning point
 * @param {Object} point - Learning point data
 * @param {string} token - User authentication token
 * @returns {Promise<Object>} Created learning point or error
 */
export const createLearningPoint = async (point, token) => {
  return ipcRenderer?.invoke('lp-create', point, token);
};

/**
 * Create multiple learning points in batch
 * @param {Array} points - Array of learning point data
 * @param {string} token - User authentication token
 * @returns {Promise<Object>} Result with created count and errors
 */
export const createLearningPointsBatch = async (points, token) => {
  return ipcRenderer?.invoke('lp-create-batch', points, token);
};

/**
 * Get a learning point by ID
 * @param {string} id - Learning point ID
 * @param {string} token - User authentication token
 * @returns {Promise<Object|null>} Learning point or null
 */
export const getLearningPoint = async (id, token) => {
  return ipcRenderer?.invoke('lp-get', id, token);
};

/**
 * Update a learning point
 * @param {string} id - Learning point ID
 * @param {Object} updates - Fields to update
 * @param {string} token - User authentication token
 * @returns {Promise<Object>} Updated learning point or error
 */
export const updateLearningPoint = async (id, updates, token) => {
  return ipcRenderer?.invoke('lp-update', id, updates, token);
};

/**
 * Delete a learning point
 * @param {string} id - Learning point ID
 * @param {string} token - User authentication token
 * @param {boolean} hard - If true, permanently delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteLearningPoint = async (id, token, hard = false) => {
  return ipcRenderer?.invoke('lp-delete', id, token, hard);
};

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Get items due for review
 * @param {Object} options - Query options
 * @param {string} options.token - User authentication token
 * @param {string} options.date - Target date (default: today)
 * @param {number} options.limit - Max items to return
 * @param {number} options.offset - Offset for pagination
 * @param {Array} options.itemTypes - Filter by item types
 * @param {Array} options.domainTypes - Filter by domain types
 * @param {Array} options.tags - Filter by tags
 * @param {string} options.planId - Filter by plan ID
 * @param {boolean} options.includeNew - Include items never reviewed
 * @returns {Promise<Array>} Due learning points
 */
export const getDueItems = async (options) => {
  return ipcRenderer?.invoke('lp-get-due', options);
};

/**
 * Get learning points by source
 * @param {string} sourceType - Source type (book, url, chat, etc.)
 * @param {string} sourceId - Source ID
 * @param {string} token - User authentication token
 * @returns {Promise<Array>} Learning points
 */
export const getBySource = async (sourceType, sourceId, token) => {
  return ipcRenderer?.invoke('lp-get-by-source', sourceType, sourceId, token);
};

/**
 * Get learning points by plan
 * @param {string} planId - Plan ID
 * @param {string} token - User authentication token
 * @returns {Promise<Array>} Learning points
 */
export const getByPlan = async (planId, token) => {
  return ipcRenderer?.invoke('lp-get-by-plan', planId, token);
};

/**
 * Search learning points
 * @param {string} query - Search query
 * @param {string} token - User authentication token
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Matching learning points
 */
export const searchLearningPoints = async (query, token, options = {}) => {
  return ipcRenderer?.invoke('lp-search', query, token, options);
};

/**
 * Get all learning points (paginated)
 * @param {string} token - User authentication token
 * @param {Object} options - Query options
 * @returns {Promise<Object>} { items, total, page, pageSize }
 */
export const getAllLearningPoints = async (token, options = {}) => {
  return ipcRenderer?.invoke('lp-get-all', token, options);
};

/**
 * One-shot backfill of legacy vocabulary rows into learning_point mirrors.
 * Idempotent: subsequent calls in the same session no-op.
 * @param {string} token
 * @returns {Promise<{ scanned, created, skipped, errors, cached? }>}
 */
export const ensureVocabBackfilled = async (token) => {
  return (
    ipcRenderer?.invoke('vocab-ensure-backfilled', token) ?? {
      scanned: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    }
  );
};

// =============================================================================
// SPACED REPETITION OPERATIONS
// =============================================================================

/**
 * Rating constants
 */
export const RATINGS = {
  AGAIN: 1,  // Back to box 1
  HARD: 2,   // Stay in box, reduce ease
  GOOD: 3,   // Advance one box
  EASY: 4,   // Skip a box, increase ease
};

/**
 * Process a review and update SR state
 * @param {string} id - Learning point ID
 * @param {number} rating - Rating 1-4 (AGAIN, HARD, GOOD, EASY)
 * @param {number} responseTimeMs - Response time in milliseconds
 * @param {string} token - User authentication token
 * @returns {Promise<Object>} Updated SR state
 */
export const processReview = async (id, rating, responseTimeMs, token) => {
  return ipcRenderer?.invoke('lp-process-review', id, rating, responseTimeMs, token);
};

/**
 * Reset a learning point to box 1
 * @param {string} id - Learning point ID
 * @param {string} token - User authentication token
 * @returns {Promise<boolean>} Success status
 */
export const resetLearningPoint = async (id, token) => {
  return ipcRenderer?.invoke('lp-reset', id, token);
};

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get learning statistics
 * @param {string} token - User authentication token
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Statistics
 */
export const getStats = async (token, options = {}) => {
  return ipcRenderer?.invoke('lp-get-stats', token, options);
};

/**
 * Get daily review forecast
 * @param {string} token - User authentication token
 * @param {number} days - Number of days to forecast
 * @returns {Promise<Object>} Daily counts by date
 */
export const getDailyForecast = async (token, days = 14) => {
  return ipcRenderer?.invoke('lp-get-forecast', token, days);
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get display text from content object
 * @param {Object|string} content - Front or back content
 * @returns {string} Text for display
 */
export const getContentText = (content) => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.text || content.html || '';
};

/**
 * Check if content has LaTeX
 * @param {Object|string} content - Content object
 * @returns {boolean}
 */
export const hasLatex = (content) => {
  if (!content) return false;
  if (typeof content === 'string') {
    return content.includes('$') || content.includes('\\[') || content.includes('\\(');
  }
  return Boolean(content.latex) || hasLatex(content.text);
};

/**
 * Check if content has code
 * @param {Object|string} content - Content object
 * @returns {boolean}
 */
export const hasCode = (content) => {
  if (!content) return false;
  if (typeof content === 'string') {
    return content.includes('```') || content.includes('<code>');
  }
  return Boolean(content.code);
};

/**
 * Get domain color
 * @param {string} domainType - Domain type
 * @returns {Object} { primary, light }
 */
export const getDomainColor = (domainType) => {
  const colors = {
    vocabulary: { primary: '#4CAF50', light: '#E8F5E9' },
    math: { primary: '#2196F3', light: '#E3F2FD' },
    physics: { primary: '#9C27B0', light: '#F3E5F5' },
    chemistry: { primary: '#FF5722', light: '#FBE9E7' },
    biology: { primary: '#8BC34A', light: '#F1F8E9' },
    language: { primary: '#673AB7', light: '#EDE7F6' },
    programming: { primary: '#607D8B', light: '#ECEFF1' },
    knowledge: { primary: '#FF9800', light: '#FFF3E0' },
    skill: { primary: '#00BCD4', light: '#E0F7FA' },
    history: { primary: '#795548', light: '#EFEBE9' },
    geography: { primary: '#009688', light: '#E0F2F1' },
    custom: { primary: '#9E9E9E', light: '#F5F5F5' },
  };
  return colors[domainType] || colors.custom;
};

/**
 * Get box level label
 * @param {number} box - Box number 1-5
 * @returns {string} Human-readable label
 */
export const getBoxLabel = (box) => {
  const labels = {
    1: 'New / Learning',
    2: 'Review',
    3: 'Growing',
    4: 'Familiar',
    5: 'Mastered',
  };
  return labels[box] || 'Unknown';
};

/**
 * Get mastery level label
 * @param {number} mastery - Mastery percentage 0-100
 * @returns {Object} { label, color }
 */
export const getMasteryLevel = (mastery) => {
  if (mastery >= 90) return { label: 'Mastered', color: '#4CAF50' };
  if (mastery >= 70) return { label: 'Proficient', color: '#8BC34A' };
  if (mastery >= 50) return { label: 'Developing', color: '#FFC107' };
  if (mastery >= 25) return { label: 'Learning', color: '#FF9800' };
  return { label: 'Beginner', color: '#F44336' };
};

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a learning point without saving
 * @param {Object} point - Learning point data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateLearningPoint = (point) => {
  return ipcRenderer?.sendSync('lp-validate', point) || { valid: false, errors: ['IPC unavailable'] };
};

// =============================================================================
// MIGRATION HELPERS
// =============================================================================

/**
 * Convert vocabulary item to learning point format (preview only)
 * @param {Object} vocab - Vocabulary record
 * @param {Object} leitnerItem - Associated leitner_item record
 * @returns {Object|null} Converted learning point
 */
export const convertFromVocabulary = (vocab, leitnerItem = null) => {
  return ipcRenderer?.sendSync('lp-convert-vocabulary', vocab, leitnerItem);
};

/**
 * Convert note to learning point format (preview only)
 * @param {Object} note - Note record
 * @param {Object} leitnerItem - Associated leitner_item record
 * @returns {Object|null} Converted learning point
 */
export const convertFromNote = (note, leitnerItem = null) => {
  return ipcRenderer?.sendSync('lp-convert-note', note, leitnerItem);
};

/**
 * Convert plan point to learning point format (preview only)
 * @param {Object} planPoint - Plan point from learning plan
 * @param {string} planId - Parent plan ID
 * @returns {Object|null} Converted learning point
 */
export const convertFromPlanPoint = (planPoint, planId) => {
  return ipcRenderer?.sendSync('lp-convert-plan-point', planPoint, planId);
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

const learningPointApi = {
  // Status
  getStatus,
  isAvailable,

  // Constants
  getItemTypes,
  getDomainTypes,
  getDifficultyLevels,
  getFormats,
  getSourceTypes,
  RATINGS,

  // CRUD
  createLearningPoint,
  createLearningPointsBatch,
  getLearningPoint,
  updateLearningPoint,
  deleteLearningPoint,

  // Queries
  getDueItems,
  getBySource,
  getByPlan,
  searchLearningPoints,
  getAllLearningPoints,
  ensureVocabBackfilled,

  // SR
  processReview,
  resetLearningPoint,

  // Stats
  getStats,
  getDailyForecast,

  // Validation
  validateLearningPoint,

  // Migration helpers
  convertFromVocabulary,
  convertFromNote,
  convertFromPlanPoint,

  // Helpers
  getContentText,
  hasLatex,
  hasCode,
  getDomainColor,
  getBoxLabel,
  getMasteryLevel,
};

export default learningPointApi;
