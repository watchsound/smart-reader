/**
 * studyAnalyticsApi.js
 *
 * Renderer-side API for study session analytics and insights.
 * Provides methods for:
 * - Recording and retrieving session analytics
 * - Performance trends over time
 * - Learning velocity tracking
 * - Optimal study time analysis
 * - Weak items identification
 * - Session history and export
 */

// Lazy-load ipcRenderer to support testing environments
const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && window.electron && window.electron.ipcRenderer) {
    return window.electron.ipcRenderer;
  }
  throw new Error('ipcRenderer not available');
};

/**
 * Study Analytics API
 */
const studyAnalyticsApi = {
  // ===========================================================================
  // SESSION ANALYTICS
  // ===========================================================================

  /**
   * Record analytics for a completed session
   * @param {string} sessionId - Session ID
   * @param {Object} analytics - Analytics data
   * @param {number} analytics.focusScore - Focus score (0-100)
   * @param {number} analytics.efficiencyScore - Efficiency score (0-100)
   * @param {number} analytics.avgResponseTimeMs - Average response time in ms
   * @param {number} analytics.retentionRate - Retention rate (0-100)
   * @param {number} analytics.streakLength - Longest streak in session
   * @param {number} analytics.hintsUsed - Number of hints used
   * @param {Array} analytics.conceptsImproved - Concepts that improved
   * @param {string} token - User token
   */
  async recordSessionAnalytics(sessionId, analytics, token) {
    return getIpcRenderer().invoke('analytics-record-session', {
      sessionId,
      analytics,
      token,
    });
  },

  /**
   * Get analytics for a specific session
   * @param {string} sessionId - Session ID
   * @param {string} token - User token
   */
  async getSessionAnalytics(sessionId, token) {
    return getIpcRenderer().invoke('analytics-get-session', {
      sessionId,
      token,
    });
  },

  // ===========================================================================
  // PERFORMANCE TRENDS
  // ===========================================================================

  /**
   * Get performance trends over time
   * @param {string} token - User token
   * @param {number} days - Number of days (default 30)
   * @param {string} topicId - Optional topic filter
   */
  async getPerformanceTrends(token, days = 30, topicId = null) {
    return getIpcRenderer().invoke('analytics-get-trends', {
      token,
      days,
      topicId,
    });
  },

  /**
   * Get weekly performance summary
   * @param {string} token - User token
   * @param {number} weeks - Number of weeks (default 8)
   */
  async getWeeklyPerformance(token, weeks = 8) {
    return getIpcRenderer().invoke('analytics-get-weekly', {
      token,
      weeks,
    });
  },

  // ===========================================================================
  // LEARNING VELOCITY
  // ===========================================================================

  /**
   * Record learning velocity for a day
   * @param {Object} data - Velocity data
   * @param {string} data.topicId - Topic ID
   * @param {number} data.masteryStart - Mastery at start
   * @param {number} data.masteryEnd - Mastery at end
   * @param {number} data.itemsStudied - Items studied
   * @param {number} data.timeSpentMinutes - Time spent
   * @param {string} token - User token
   */
  async recordLearningVelocity(data, token) {
    return getIpcRenderer().invoke('analytics-record-velocity', {
      data,
      token,
    });
  },

  /**
   * Get learning velocity trend
   * @param {string} token - User token
   * @param {number} days - Number of days (default 30)
   * @param {string} topicId - Optional topic filter
   */
  async getLearningVelocity(token, days = 30, topicId = null) {
    return getIpcRenderer().invoke('analytics-get-velocity', {
      token,
      days,
      topicId,
    });
  },

  /**
   * Get aggregate velocity for a period
   * @param {string} token - User token
   * @param {number} days - Period in days (default 7)
   */
  async getAggregateVelocity(token, days = 7) {
    return getIpcRenderer().invoke('analytics-get-aggregate-velocity', {
      token,
      days,
    });
  },

  // ===========================================================================
  // OPTIMAL STUDY TIME
  // ===========================================================================

  /**
   * Analyze optimal study times based on performance
   * @param {string} token - User token
   * @param {number} days - Days to analyze (default 90)
   */
  async analyzeOptimalStudyTimes(token, days = 90) {
    return getIpcRenderer().invoke('analytics-optimal-times', {
      token,
      days,
    });
  },

  // ===========================================================================
  // WEAK ITEMS
  // ===========================================================================

  /**
   * Identify weak items needing practice
   * @param {string} token - User token
   * @param {string} topicId - Optional topic filter
   * @param {number} limit - Max items (default 20)
   */
  async identifyWeakItems(token, topicId = null, limit = 20) {
    return getIpcRenderer().invoke('analytics-weak-items', {
      token,
      topicId,
      limit,
    });
  },

  // ===========================================================================
  // SESSION HISTORY
  // ===========================================================================

  /**
   * Get detailed session history
   * @param {string} token - User token
   * @param {Object} options - Query options
   * @param {number} options.limit - Page size (default 20)
   * @param {number} options.offset - Page offset (default 0)
   * @param {string} options.topicId - Optional topic filter
   * @param {number} options.days - Optional days filter
   */
  async getSessionHistory(token, options = {}) {
    return getIpcRenderer().invoke('analytics-session-history', {
      token,
      ...options,
    });
  },

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  /**
   * Export session data
   * @param {string} token - User token
   * @param {Object} options - Export options
   * @param {string} options.startDate - Start date (ISO string)
   * @param {string} options.endDate - End date (ISO string)
   * @param {string} options.format - 'json' or 'csv' (default 'json')
   * @param {boolean} options.includeItems - Include item performance (default false)
   */
  async exportSessionData(token, options = {}) {
    return getIpcRenderer().invoke('analytics-export', {
      token,
      ...options,
    });
  },

  // ===========================================================================
  // DASHBOARD
  // ===========================================================================

  /**
   * Get comprehensive dashboard summary
   * @param {string} token - User token
   */
  async getDashboardSummary(token) {
    return getIpcRenderer().invoke('analytics-dashboard', {
      token,
    });
  },

  // ===========================================================================
  // GRAPH INTEGRATION
  // ===========================================================================

  /**
   * Sync mastery changes to knowledge graph
   * @param {string} conceptId - Concept ID
   * @param {string} outcome - 'correct', 'incorrect', or 'skipped'
   * @param {string} token - User token
   */
  async syncMasteryToGraph(conceptId, outcome, token) {
    return getIpcRenderer().invoke('analytics-sync-mastery', {
      conceptId,
      outcome,
      token,
    });
  },

  /**
   * Get knowledge graph analytics
   * @param {string} token - User token
   * @param {number} lookbackDays - Days to look back (default 30)
   */
  async getGraphInsights(token, lookbackDays = 30) {
    return getIpcRenderer().invoke('analytics-graph-insights', {
      token,
      lookbackDays,
    });
  },
};

// ===========================================================================
// ANALYTICS CALCULATION HELPERS
// ===========================================================================

/**
 * Calculate focus score based on session metrics
 * @param {Object} metrics - Session metrics
 * @returns {number} Focus score (0-100)
 */
export const calculateFocusScore = (metrics) => {
  const {
    avgResponseTimeMs = 5000,
    hintRatio = 0,
    pauseCount = 0,
    totalItems = 1,
  } = metrics;

  // Ideal response time is 2-4 seconds
  const responseScore = Math.max(
    0,
    Math.min(100, 100 - Math.abs(avgResponseTimeMs - 3000) / 100),
  );

  // Lower hint usage is better
  const hintScore = Math.max(0, 100 - hintRatio * 100 * 2);

  // Fewer pauses indicate better focus
  const pauseScore = Math.max(
    0,
    100 - (pauseCount / Math.max(totalItems, 1)) * 50,
  );

  return Math.round((responseScore * 0.4 + hintScore * 0.3 + pauseScore * 0.3));
};

/**
 * Calculate efficiency score
 * @param {Object} metrics - Session metrics
 * @returns {number} Efficiency score (0-100)
 */
export const calculateEfficiencyScore = (metrics) => {
  const {
    accuracy = 0,
    avgTimePerItem = 10000,
    targetTimePerItem = 5000,
    itemsReviewed = 0,
    durationMinutes = 1,
  } = metrics;

  // Accuracy contributes 50%
  const accuracyScore = accuracy;

  // Speed relative to target contributes 30%
  const speedRatio = targetTimePerItem / Math.max(avgTimePerItem, 1000);
  const speedScore = Math.min(100, speedRatio * 100);

  // Items per minute contributes 20%
  const itemsPerMinute = itemsReviewed / Math.max(durationMinutes, 1);
  const throughputScore = Math.min(100, itemsPerMinute * 10);

  return Math.round(
    accuracyScore * 0.5 + speedScore * 0.3 + throughputScore * 0.2,
  );
};

/**
 * Calculate retention rate based on review history
 * @param {Array} reviews - Array of review outcomes
 * @returns {number} Retention rate (0-100)
 */
export const calculateRetentionRate = (reviews) => {
  if (!reviews || reviews.length === 0) return 0;

  // Weight recent reviews more heavily
  let weightedCorrect = 0;
  let totalWeight = 0;

  reviews.forEach((review, index) => {
    const weight = 1 + index * 0.5; // More recent = higher weight
    totalWeight += weight;
    if (review.wasCorrect) {
      weightedCorrect += weight;
    }
  });

  return Math.round((weightedCorrect / totalWeight) * 100);
};

/**
 * Format duration in minutes to human readable string
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration
 */
export const formatDuration = (minutes) => {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/**
 * Format accuracy percentage
 * @param {number} accuracy - Accuracy (0-100)
 * @returns {string} Formatted accuracy
 */
export const formatAccuracy = (accuracy) => {
  return `${Math.round(accuracy)}%`;
};

/**
 * Get performance level label
 * @param {number} score - Score (0-100)
 * @returns {Object} Label and color
 */
export const getPerformanceLevel = (score) => {
  if (score >= 90) return { label: 'Excellent', color: '#4CAF50' };
  if (score >= 75) return { label: 'Good', color: '#8BC34A' };
  if (score >= 60) return { label: 'Average', color: '#FFC107' };
  if (score >= 40) return { label: 'Below Average', color: '#FF9800' };
  return { label: 'Needs Work', color: '#f44336' };
};

/**
 * Calculate streak from daily activity
 * @param {Array} dailyActivity - Array of daily activity objects
 * @returns {number} Current streak
 */
export const calculateStreak = (dailyActivity) => {
  if (!dailyActivity || dailyActivity.length === 0) return 0;

  // Sort by date descending
  const sorted = [...dailyActivity].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sorted.length; i++) {
    const activityDate = new Date(sorted[i].date);
    activityDate.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    if (activityDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};

export default studyAnalyticsApi;
