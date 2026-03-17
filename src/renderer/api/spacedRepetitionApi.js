/**
 * spacedRepetitionApi.js
 *
 * Renderer-side API for the Adaptive Spaced Repetition system.
 * Provides a clean interface for components to interact with the SR service.
 */

// Rating values for review outcomes
export const Rating = {
  AGAIN: 1, // Complete failure to recall
  HARD: 2, // Recalled with significant difficulty
  GOOD: 3, // Recalled with some effort
  EASY: 4, // Recalled effortlessly
};

// State of a learning item
export const State = {
  NEW: 0, // Never reviewed
  LEARNING: 1, // In initial learning phase
  REVIEW: 2, // In regular review cycle
  RELEARNING: 3, // Failed and relearning
};

// State labels for UI
export const StateLabels = {
  [State.NEW]: 'New',
  [State.LEARNING]: 'Learning',
  [State.REVIEW]: 'Review',
  [State.RELEARNING]: 'Relearning',
};

// Rating labels for UI
export const RatingLabels = {
  [Rating.AGAIN]: 'Again',
  [Rating.HARD]: 'Hard',
  [Rating.GOOD]: 'Good',
  [Rating.EASY]: 'Easy',
};

// Rating colors for UI
export const RatingColors = {
  [Rating.AGAIN]: '#F44336', // Red
  [Rating.HARD]: '#FF9800', // Orange
  [Rating.GOOD]: '#4CAF50', // Green
  [Rating.EASY]: '#2196F3', // Blue
};

/**
 * Process a review for an item
 *
 * @param {string} itemId - Item identifier
 * @param {string} itemType - Type of item (concept, note, skill, etc.)
 * @param {number} rating - Review rating (1-4)
 * @param {string} token - User token
 * @param {Object} options - Additional options { topicId?, responseTimeMs? }
 * @returns {Promise<Object>} Updated item state and next review info
 */
export async function processReview(itemId, itemType, rating, token, options = {}) {
  return window.electron.ipcRenderer.invoke(
    'sr-process-review',
    {
      itemId,
      itemType,
      rating,
      ...options,
    },
    token,
  );
}

/**
 * Get or create an SR item
 *
 * @param {string} itemId - Item identifier
 * @param {string} itemType - Type of item
 * @param {string} token - User token
 * @param {string} topicId - Optional topic ID
 * @returns {Promise<Object>} SR item data
 */
export async function getItem(itemId, itemType, token, topicId = null) {
  return window.electron.ipcRenderer.invoke(
    'sr-get-item',
    { itemId, itemType, topicId },
    token,
  );
}

/**
 * Get items due for review
 *
 * @param {string} token - User token
 * @param {Object} options - Query options { itemType?, topicId?, limit?, includeNew? }
 * @returns {Promise<Array>} Due items
 */
export async function getDueItems(token, options = {}) {
  return window.electron.ipcRenderer.invoke('sr-get-due-items', options, token);
}

/**
 * Get review statistics
 *
 * @param {string} token - User token
 * @param {Object} options - Query options { topicId?, days? }
 * @returns {Promise<Object>} Statistics
 */
export async function getStatistics(token, options = {}) {
  return window.electron.ipcRenderer.invoke('sr-get-statistics', options, token);
}

/**
 * Get review forecast
 *
 * @param {string} token - User token
 * @param {number} days - Days to forecast (default 14)
 * @returns {Promise<Array>} Forecast data
 */
export async function getForecast(token, days = 14) {
  return window.electron.ipcRenderer.invoke('sr-get-forecast', days, token);
}

/**
 * Calculate optimal review time for an item
 *
 * @param {number} stability - Item stability
 * @param {number} currentRetrievability - Current retrievability
 * @param {number} targetRetrievability - Target retention (default 0.9)
 * @returns {Promise<Object>} Optimal review info
 */
export async function calculateOptimalTime(
  stability,
  currentRetrievability,
  targetRetrievability = 0.9,
) {
  return window.electron.ipcRenderer.invoke('sr-calculate-optimal-time', {
    stability,
    currentRetrievability,
    targetRetrievability,
  });
}

/**
 * Optimize FSRS parameters based on user's review history
 *
 * @param {string} token - User token
 * @returns {Promise<Object>} Optimized parameters
 */
export async function optimizeParameters(token) {
  return window.electron.ipcRenderer.invoke('sr-optimize-parameters', token);
}

/**
 * Get review history for analytics
 *
 * @param {string} token - User token
 * @param {Object} options - Query options { days?, topicId?, itemType? }
 * @returns {Promise<Array>} Review history records
 */
export async function getReviewHistory(token, options = {}) {
  return window.electron.ipcRenderer.invoke('sr-get-review-history', options, token);
}

/**
 * Get daily aggregated review data for calendar view
 *
 * @param {string} token - User token
 * @param {Object} options - Query options { days?, topicId? }
 * @returns {Promise<Object>} Daily aggregated data keyed by date string
 */
export async function getDailyReviewData(token, options = {}) {
  return window.electron.ipcRenderer.invoke('sr-get-daily-review-data', options, token);
}

/**
 * Calculate retrievability (sync, for quick UI updates)
 *
 * @param {number} stability - Item stability
 * @param {number} elapsedDays - Days since last review
 * @returns {number} Retrievability (0-1)
 */
export function calculateRetrievability(stability, elapsedDays) {
  return window.electron.ipcRenderer.sendSync(
    'sr-calculate-retrievability',
    stability,
    elapsedDays,
  );
}

/**
 * Format retrievability as percentage
 *
 * @param {number} retrievability - Retrievability value (0-1)
 * @returns {string} Formatted percentage
 */
export function formatRetrievability(retrievability) {
  return `${Math.round(retrievability * 100)}%`;
}

/**
 * Get urgency level based on retrievability
 *
 * @param {number} retrievability - Retrievability value (0-1)
 * @returns {Object} { level, color, label }
 */
export function getUrgencyLevel(retrievability) {
  if (retrievability < 0.7) {
    return {
      level: 'high',
      color: '#F44336',
      label: 'Overdue',
    };
  }
  if (retrievability < 0.85) {
    return {
      level: 'medium',
      color: '#FF9800',
      label: 'Review Soon',
    };
  }
  if (retrievability < 0.95) {
    return {
      level: 'low',
      color: '#4CAF50',
      label: 'Good Time',
    };
  }
  return {
    level: 'none',
    color: '#9E9E9E',
    label: 'Fresh',
  };
}

/**
 * Format interval in human-readable form
 *
 * @param {number} days - Interval in days
 * @returns {string} Formatted interval
 */
export function formatInterval(days) {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (days < 7) {
    return days === 1 ? '1 day' : `${Math.round(days)} days`;
  }
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? '1 month' : `${months} months`;
  }
  const years = Math.round(days / 365);
  return years === 1 ? '1 year' : `${years} years`;
}

/**
 * Get state color for UI
 *
 * @param {number} state - Item state
 * @returns {string} Color code
 */
export function getStateColor(state) {
  switch (state) {
    case State.NEW:
      return '#9E9E9E'; // Grey
    case State.LEARNING:
      return '#FF9800'; // Orange
    case State.REVIEW:
      return '#4CAF50'; // Green
    case State.RELEARNING:
      return '#F44336'; // Red
    default:
      return '#9E9E9E';
  }
}

/**
 * Calculate days until next review
 *
 * @param {Date|string} nextReview - Next review date
 * @returns {number} Days until review (negative if overdue)
 */
export function daysUntilReview(nextReview) {
  const reviewDate = new Date(nextReview);
  const now = new Date();
  return (reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

export default {
  // Constants
  Rating,
  State,
  StateLabels,
  RatingLabels,
  RatingColors,
  // API functions
  processReview,
  getItem,
  getDueItems,
  getStatistics,
  getForecast,
  calculateOptimalTime,
  optimizeParameters,
  calculateRetrievability,
  getReviewHistory,
  getDailyReviewData,
  // Utility functions
  formatRetrievability,
  getUrgencyLevel,
  formatInterval,
  getStateColor,
  daysUntilReview,
};
