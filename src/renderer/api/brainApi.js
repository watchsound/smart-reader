/**
 * Brain API - Renderer-side API for Learning Brain operations
 *
 * Usage:
 *   import brainApi from '../api/brainApi';
 *
 *   // Get brain status
 *   const status = await brainApi.getStatus();
 *
 *   // Trigger heartbeat manually
 *   await brainApi.triggerHeartbeat();
 *
 *   // Record learning event
 *   brainApi.recordEpisode({
 *     eventType: 'REVIEW_COMPLETED',
 *     payload: { conceptId: '123', rating: 3 }
 *   });
 */

// Lazy IPC lookup via Proxy — tests inject window.electron in beforeEach,
// which can be AFTER module load time. Destructuring `const { ipcRenderer } =
// window.electron || {}` at module load freezes a stale undefined reference.
const ipcRenderer = new Proxy(
  {},
  {
    get(_t, prop) {
      const real = window.electron?.ipcRenderer;
      if (!real) return undefined;
      const v = real[prop];
      return typeof v === 'function' ? v.bind(real) : v;
    },
  },
);

/**
 * Brain API methods
 */
const brainApi = {
  // ==================== Status & Info ====================

  /**
   * Get brain status
   * @returns {Promise<Object>}
   */
  async getStatus() {
    return ipcRenderer?.invoke('brain-get-status');
  },

  /**
   * Get cached insights (quick, no re-analysis)
   * @returns {Promise<Object|null>}
   */
  async getInsights() {
    return ipcRenderer?.invoke('brain-get-insights');
  },

  /**
   * Check if brain is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return ipcRenderer?.sendSync('brain-is-enabled') ?? false;
  },

  // ==================== Heartbeat Control ====================

  /**
   * Trigger an immediate heartbeat
   * @returns {Promise<Object>}
   */
  async triggerHeartbeat() {
    return ipcRenderer?.invoke('brain-trigger-heartbeat');
  },

  /**
   * Get time until next heartbeat
   * @returns {Promise<Object|null>}
   */
  async getTimeUntilNext() {
    return ipcRenderer?.invoke('brain-time-until-next');
  },

  // ==================== Episode Collection ====================

  /**
   * Record a learning episode. Fire-and-forget telemetry — failures
   * (e.g. graph backend down) must never break the caller's UI flow,
   * so backend errors are swallowed with a console.warn instead of
   * propagating as an unhandled rejection.
   * @param {Object} episode
   * @param {string} episode.eventType - Event type
   * @param {Object} episode.payload - Event data
   * @param {Object} episode.sourceContext - Context info
   * @returns {Promise<Object|null>}
   */
  async recordEpisode(episode) {
    try {
      return await ipcRenderer?.invoke('brain-record-episode', episode);
    } catch (err) {
      console.warn('brainApi.recordEpisode failed:', err?.message || err);
      return null;
    }
  },

  /**
   * Get recent episodes
   * @param {Object} options
   * @param {number} options.limit - Max episodes to return
   * @returns {Promise<Array>}
   */
  async getEpisodes(options = {}) {
    return ipcRenderer?.invoke('brain-get-episodes', options);
  },

  /**
   * Get episodes by type
   * @param {string} eventType
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getEpisodesByType(eventType, limit = 50) {
    return ipcRenderer?.invoke('brain-get-episodes-by-type', eventType, limit);
  },

  // ==================== Configuration ====================

  /**
   * Get brain configuration
   * @returns {Promise<Object>}
   */
  async getConfig() {
    return ipcRenderer?.invoke('brain-get-config');
  },

  /**
   * Update brain configuration
   * @param {Object} config
   * @returns {Promise<Object>}
   */
  async setConfig(config) {
    return ipcRenderer?.invoke('brain-set-config', config);
  },

  /**
   * Enable/disable brain
   * @param {boolean} enabled
   * @returns {Promise<Object>}
   */
  async setEnabled(enabled) {
    return ipcRenderer?.invoke('brain-set-enabled', enabled);
  },

  // ==================== Service Management ====================

  /**
   * Get background service status
   * @returns {Promise<Object>}
   */
  async getServiceStatus() {
    return ipcRenderer?.invoke('brain-service-status');
  },

  /**
   * Install background service
   * @returns {Promise<Object>}
   */
  async installService() {
    return ipcRenderer?.invoke('brain-service-install');
  },

  /**
   * Uninstall background service
   * @returns {Promise<Object>}
   */
  async uninstallService() {
    return ipcRenderer?.invoke('brain-service-uninstall');
  },

  /**
   * Start background service
   * @returns {Promise<Object>}
   */
  async startService() {
    return ipcRenderer?.invoke('brain-service-start');
  },

  /**
   * Stop background service
   * @returns {Promise<Object>}
   */
  async stopService() {
    return ipcRenderer?.invoke('brain-service-stop');
  },

  // ==================== Heartbeat History ====================

  /**
   * Get heartbeat history
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getHeartbeatHistory(limit = 10) {
    return ipcRenderer?.invoke('brain-get-heartbeat-history', limit);
  },

  // ==================== Memory Consolidation ====================

  /**
   * Trigger manual memory consolidation
   * Consolidates recent learning episodes into higher-level memories using LLM
   * @param {Object} options
   * @param {string} options.token - User token
   * @param {number} options.periodDays - Look-back period (default: 7)
   * @param {number} options.minEpisodes - Min episodes to consolidate (default: 3)
   * @returns {Promise<Object>}
   */
  async consolidateNow(options = {}) {
    return ipcRenderer?.invoke('brain-consolidate-now', options);
  },

  /**
   * Get consolidated memories with filters
   * @param {Object} options
   * @param {string} options.token - User token
   * @param {string} options.conceptId - Filter by concept ID
   * @param {string} options.conceptName - Filter by concept name
   * @param {string} options.memoryType - Filter by memory type
   * @param {string} options.startDate - Filter by start date
   * @param {string} options.endDate - Filter by end date
   * @param {number} options.limit - Max results (default: 50)
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<Array>}
   */
  async getConsolidatedMemories(options = {}) {
    return ipcRenderer?.invoke('brain-get-memories', options);
  },

  /**
   * Get a single consolidated memory by ID
   * @param {string} id - Memory ID
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async getMemory(id, token) {
    return ipcRenderer?.invoke('brain-get-memory', id, token);
  },

  /**
   * Search consolidated memories
   * @param {string} query - Search text
   * @param {string} token - User token
   * @param {number} limit - Max results (default: 20)
   * @returns {Promise<Array>}
   */
  async searchMemories(query, token, limit = 20) {
    return ipcRenderer?.invoke('brain-search-memories', query, token, limit);
  },

  /**
   * Get consolidation statistics
   * @param {string} token - User token
   * @returns {Promise<Object>}
   */
  async getConsolidationStats(token) {
    return ipcRenderer?.invoke('brain-get-consolidation-stats', token);
  },

  /**
   * Delete a consolidated memory
   * @param {string} id - Memory ID
   * @param {string} token - User token
   * @returns {Promise<Object>}
   */
  async deleteMemory(id, token) {
    return ipcRenderer?.invoke('brain-delete-memory', id, token);
  },

  /**
   * Delete old memories (maintenance)
   * @param {number} olderThanDays - Delete memories older than this
   * @param {string} token - User token
   * @returns {Promise<Object>}
   */
  async deleteOldMemories(olderThanDays, token) {
    return ipcRenderer?.invoke(
      'brain-delete-old-memories',
      olderThanDays,
      token,
    );
  },

  /**
   * Get episode statistics (for consolidation UI)
   * @param {number} userId - User ID (default: 1)
   * @returns {Promise<Object>}
   */
  async getEpisodeStats(userId = 1) {
    return ipcRenderer?.invoke('brain-get-episode-stats', userId);
  },

  // ==================== Cross-Concept Analysis ====================

  /**
   * Run cross-concept pattern analysis
   * Detects relationships between concepts: prerequisites, interference, positive transfer
   * @param {Object} options
   * @param {number} options.userId - User ID (default: 1)
   * @param {string} options.token - User token
   * @param {number} options.lookbackDays - Look-back period (default: 30)
   * @param {number} options.minEpisodes - Min episodes required (default: 10)
   * @param {number} options.correlationThreshold - Min correlation for patterns (default: 0.6)
   * @param {number} options.confidenceThreshold - Min confidence to report (default: 0.7)
   * @param {Array<string>} options.enabledPatterns - Pattern categories to detect
   * @returns {Promise<Object>}
   */
  async analyzeCrossConcept(options = {}) {
    return ipcRenderer?.invoke('brain-analyze-cross-concept', options);
  },

  /**
   * Get recent cross-concept patterns
   * @param {string} token - User token
   * @param {number} limit - Max patterns to return (default: 10)
   * @returns {Promise<Array>}
   */
  async getCrossConceptPatterns(token, limit = 10) {
    return ipcRenderer?.invoke(
      'brain-get-cross-concept-patterns',
      token,
      limit,
    );
  },

  /**
   * Get pattern summary for a specific concept
   * @param {string} conceptId - Concept ID
   * @param {string} token - User token
   * @returns {Promise<Object>}
   */
  async getConceptPatterns(conceptId, token) {
    return ipcRenderer?.invoke('brain-get-concept-patterns', conceptId, token);
  },

  // ==================== Learner Profile Inference ====================

  /**
   * Run learner profile inference
   * Analyzes learning behavior to infer style, preferences, and patterns
   * @param {Object} options
   * @param {number} options.userId - User ID (default: 1)
   * @param {string} options.token - User token
   * @param {number} options.lookbackDays - Look-back period (default: 30)
   * @param {number} options.minSessions - Min sessions required (default: 3)
   * @returns {Promise<Object>}
   */
  async inferProfile(options = {}) {
    return ipcRenderer?.invoke('brain-infer-profile', options);
  },

  /**
   * Get current learner profile (global + all domains)
   * @param {string} token - User token
   * @returns {Promise<Object>} { global, domains }
   */
  async getLearnerProfile(token) {
    return ipcRenderer?.invoke('brain-get-learner-profile', token);
  },

  /**
   * Get learner profile for a specific domain
   * @param {string} domainType - Domain type (vocabulary, math, language, etc.)
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async getDomainProfile(domainType, token) {
    return ipcRenderer?.invoke('brain-get-domain-profile', domainType, token);
  },

  /**
   * Update learner profile manually
   * @param {Object} updates - Profile updates
   * @param {Object} updates.global - Global profile updates
   * @param {Array} updates.domains - Domain profile updates
   * @param {string} token - User token
   * @returns {Promise<Object>}
   */
  async updateProfile(updates, token) {
    return ipcRenderer?.invoke('brain-update-profile', updates, token);
  },

  // ==================== Learning Recommendations ====================

  /**
   * Get personalized learning recommendations based on patterns and profile
   * @param {Object} options
   * @param {number} options.userId - User ID (default: 1)
   * @param {string} options.token - User token
   * @returns {Promise<Object>} { scheduling, content, strategy }
   */
  async getRecommendations(options = {}) {
    return ipcRenderer?.invoke('brain-get-recommendations', options);
  },

  /**
   * Get optimal study times based on profile
   * @param {string} token - User token
   * @returns {Promise<Object>}
   */
  async getOptimalStudyTimes(token) {
    return ipcRenderer?.invoke('brain-get-optimal-study-times', token);
  },

  /**
   * Get concept relationship graph data for visualization
   * @param {string} token - User token
   * @param {number} limit - Max nodes/edges (default: 50)
   * @returns {Promise<Object>} { nodes, edges }
   */
  async getConceptRelationships(token, limit = 50) {
    return ipcRenderer?.invoke('brain-get-concept-relationships', token, limit);
  },

  // ==================== Predictive Insights ====================

  /**
   * Get full predictive insights (scheduling, content, strategy)
   * @param {string} token - User token
   * @param {Object} options
   * @param {number} options.forecastDays - Days to forecast (default: 7)
   * @returns {Promise<Object>} Full insights object
   */
  async getPredictiveInsights(token, options = {}) {
    return ipcRenderer?.invoke('brain-get-predictive-insights', token, options);
  },

  /**
   * Get scheduling insights only (when and how long to study)
   * @param {string} token - User token
   * @param {Object} options
   * @returns {Promise<Object>} { optimalReviewTime, sessionDuration, dueItems, weeklyDistribution }
   */
  async getSchedulingInsights(token, options = {}) {
    return ipcRenderer?.invoke('brain-get-scheduling-insights', token, options);
  },

  /**
   * Get content insights only (what to study and in what order)
   * @param {string} token - User token
   * @param {Object} options
   * @returns {Promise<Object>} { learningOrder, weakConcepts, transferOpportunities, interferences }
   */
  async getContentInsights(token, options = {}) {
    return ipcRenderer?.invoke('brain-get-content-insights', token, options);
  },

  /**
   * Get strategy insights only (spacing, anti-cramming, consistency)
   * @param {string} token - User token
   * @param {Object} options
   * @returns {Promise<Object>} { crammingAnalysis, spacingAdvice, consistency, pacingAdvice }
   */
  async getStrategyInsights(token, options = {}) {
    return ipcRenderer?.invoke('brain-get-strategy-insights', token, options);
  },

  /**
   * Predict optimal review time based on learner profile
   * @param {string} token - User token
   * @returns {Promise<Object>} { preferredTimeOfDay, suggestedHours, confidence }
   */
  async predictOptimalTime(token) {
    return ipcRenderer?.invoke('brain-predict-optimal-time', token);
  },

  /**
   * Get forecast of due items for upcoming days
   * @param {string} token - User token
   * @param {Object} options
   * @param {number} options.forecastDays - Days to forecast (default: 7)
   * @returns {Promise<Object>} { todayCount, overdueCount, estimatedMinutes, byDay }
   */
  async getDueForecast(token, options = {}) {
    return ipcRenderer?.invoke('brain-get-due-forecast', token, options);
  },

  /**
   * Check for cramming behavior
   * @param {string} token - User token
   * @returns {Promise<Object>} { isCramming, recentCount, conceptsRepeated }
   */
  async detectCramming(token) {
    return ipcRenderer?.invoke('brain-detect-cramming', token);
  },

  /**
   * Analyze learning consistency (streaks, sessions per week)
   * @param {string} token - User token
   * @returns {Promise<Object>} { currentStreak, longestStreak, daysSinceLastSession }
   */
  async analyzeConsistency(token) {
    return ipcRenderer?.invoke('brain-analyze-consistency', token);
  },

  /**
   * Clear predictive insights cache
   * @returns {Object} { success: boolean }
   */
  clearInsightsCache() {
    return ipcRenderer?.sendSync('brain-clear-insights-cache');
  },

  /**
   * Update predictive insights configuration
   * @param {Object} config - New configuration
   * @param {number} config.cacheExpiryMinutes - Cache expiry time
   * @param {number} config.lookbackDays - Analysis lookback period
   * @param {number} config.forecastDays - Forecast period
   * @param {number} config.maxRecommendations - Max recommendations to return
   * @returns {Object} { success: boolean }
   */
  updateInsightsConfig(config) {
    return ipcRenderer?.sendSync('brain-update-insights-config', config);
  },

  // ==================== Trigger Bus (AI-driven shell) ====================

  /**
   * Subscribe to incoming Triggers from the main-process Brain.
   * Used by the renderer-side TriggerBus to populate its Proposal Queue.
   * @param {(trigger: import('../../commons/brain/triggerTypes').Trigger) => void} cb
   * @returns {() => void} unsubscribe
   */
  subscribeTriggers(cb) {
    const handler = (_evt, trigger) => cb(trigger);
    ipcRenderer?.on('brain:trigger:push', handler);
    return () => ipcRenderer?.removeListener?.('brain:trigger:push', handler);
  },

  /**
   * Record renderer-side acceptance of a Proposal.
   * @param {string} proposalId
   */
  async acceptProposal(proposalId) {
    return ipcRenderer?.invoke('brain:trigger:accept', proposalId);
  },

  /**
   * Record renderer-side dismissal of a Proposal.
   * @param {string} proposalId
   */
  async dismissProposal(proposalId) {
    return ipcRenderer?.invoke('brain:trigger:dismiss', proposalId);
  },

  /**
   * Pull a synthesized "what's next?" proposal when the queue is empty.
   */
  async pullProposal() {
    return ipcRenderer?.invoke('brain:trigger:pull');
  },

  /**
   * Read per-source accept/dismiss tallies persisted by LearningBrainAgent.
   * Returns { bySource: { <source>: { accepted, dismissed, lastEvent, lastEventKind } } }.
   */
  async getTriggerTelemetry() {
    return ipcRenderer?.invoke('brain:trigger:telemetry');
  },
};

/**
 * Memory consolidation types
 */
export const MEMORY_TYPES = {
  CONCEPT_SESSION: 'concept_session',
  DAILY: 'daily',
  WEEKLY: 'weekly',
};

/**
 * Mastery assessment levels
 */
export const MASTERY_LEVELS = {
  BEGINNER: 'beginner',
  DEVELOPING: 'developing',
  PROFICIENT: 'proficient',
  MASTERED: 'mastered',
};

/**
 * Learning style classifications
 */
export const LEARNING_STYLES = {
  QUICK: 'quick',
  STEADY: 'steady',
  NEEDS_REPETITION: 'needs-repetition',
  VARIABLE: 'variable',
};

/**
 * Pattern types detected by cross-concept analysis
 */
export const PATTERN_TYPES = {
  // Temporal patterns
  OPTIMAL_TIME: 'OPTIMAL_TIME',
  SESSION_DURATION: 'SESSION_DURATION',
  VELOCITY_TREND: 'VELOCITY_TREND',
  CRAMMING: 'CRAMMING',
  SPACING: 'SPACING',

  // Performance patterns
  STRUGGLE: 'STRUGGLE',
  RESPONSE_TIME: 'RESPONSE_TIME',
  CONFIDENCE_CALIBRATION: 'CONFIDENCE_CALIBRATION',
  MISTAKE_CLUSTER: 'MISTAKE_CLUSTER',
  HINT_USAGE: 'HINT_USAGE',

  // Cross-concept patterns
  PREREQUISITE: 'PREREQUISITE',
  INTERFERENCE: 'INTERFERENCE',
  POSITIVE_TRANSFER: 'POSITIVE_TRANSFER',
  CONCEPT_CLUSTER: 'CONCEPT_CLUSTER',
  FORGETTING_CORRELATION: 'FORGETTING_CORRELATION',

  // Behavioral patterns
  SESSION_TRIGGER: 'SESSION_TRIGGER',
  QUIT_SIGNAL: 'QUIT_SIGNAL',
  CONTENT_PREFERENCE: 'CONTENT_PREFERENCE',
  PACE_PREFERENCE: 'PACE_PREFERENCE',
  GOAL_ORIENTATION: 'GOAL_ORIENTATION',
};

/**
 * Pattern categories
 */
export const PATTERN_CATEGORIES = {
  TEMPORAL: 'temporal',
  PERFORMANCE: 'performance',
  CROSS_CONCEPT: 'cross_concept',
  BEHAVIORAL: 'behavioral',
};

/**
 * Pattern priority levels
 */
export const PATTERN_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
};

/**
 * Domain types for learner profiles
 */
export const DOMAIN_TYPES = {
  VOCABULARY: 'vocabulary',
  MATH: 'math',
  LANGUAGE: 'language',
  KNOWLEDGE: 'knowledge',
  SKILL: 'skill',
  PROGRAMMING: 'programming',
  SCIENCE: 'science',
  HISTORY: 'history',
};

/**
 * Recommendation types
 */
export const RECOMMENDATION_TYPES = {
  SCHEDULE: 'schedule',
  CONTENT: 'content',
  STRATEGY: 'strategy',
  WARNING: 'warning',
  ENCOURAGEMENT: 'encouragement',
};

/**
 * Recommendation priority levels
 */
export const RECOMMENDATION_PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

/**
 * Recommendation categories
 */
export const RECOMMENDATION_CATEGORIES = {
  // Scheduling categories
  TIMING: 'timing',
  DURATION: 'duration',
  WORKLOAD: 'workload',
  DISTRIBUTION: 'distribution',

  // Content categories
  ORDER: 'order',
  WEAKNESS: 'weakness',
  SYNERGY: 'synergy',
  INTERFERENCE: 'interference',
  COVERAGE: 'coverage',

  // Strategy categories
  ANTI_CRAMMING: 'anti-cramming',
  SPACING: 'spacing',
  CONSISTENCY: 'consistency',
  PACING: 'pacing',
  BREAKS: 'breaks',
};

/**
 * Prediction constants (matches PredictiveInsightsService)
 */
export const PREDICTION_CONSTANTS = {
  // Forgetting curve parameters
  DEFAULT_STABILITY: 1.0,
  STABILITY_INCREASE_FACTOR: 2.0,
  STABILITY_DECREASE_FACTOR: 0.5,
  RETENTION_THRESHOLD: 0.85,

  // Scheduling parameters
  MIN_SESSION_MINUTES: 5,
  MAX_SESSION_MINUTES: 60,
  OPTIMAL_BREAK_INTERVAL: 25,

  // Anti-cramming parameters
  CRAMMING_THRESHOLD_HOURS: 2,
  MIN_SPACING_HOURS: 4,
  OPTIMAL_DAILY_NEW_ITEMS: 10,

  // Consistency parameters
  STREAK_BONUS_THRESHOLD: 7,
  CONSISTENCY_WEIGHT: 0.3,
};

/**
 * Episode event types
 */
export const EPISODE_TYPES = {
  // Study Session Events
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',

  // Review Events
  REVIEW_COMPLETED: 'REVIEW_COMPLETED',
  REVIEW_SKIPPED: 'REVIEW_SKIPPED',

  // Performance Events
  QUIZ_TAKEN: 'QUIZ_TAKEN',
  CONCEPT_STRUGGLED: 'CONCEPT_STRUGGLED',
  CONCEPT_MASTERED: 'CONCEPT_MASTERED',
  MASTERY_CHANGED: 'MASTERY_CHANGED',

  // Content Events
  BOOK_OPENED: 'BOOK_OPENED',
  BOOK_COMPLETED: 'BOOK_COMPLETED',
  NOTE_CREATED: 'NOTE_CREATED',
  HIGHLIGHT_CREATED: 'HIGHLIGHT_CREATED',

  // Goal Events
  GOAL_SET: 'GOAL_SET',
  GOAL_PROGRESS: 'GOAL_PROGRESS',
  GOAL_COMPLETED: 'GOAL_COMPLETED',

  // Streak Events
  STREAK_EXTENDED: 'STREAK_EXTENDED',
  STREAK_BROKEN: 'STREAK_BROKEN',

  // Reading Comprehension Events (Phase 2)
  // Silent reading-behavior signals. Mirror of EpisodeCollector.EVENT_TYPES.
  CHAPTER_ENTERED: 'CHAPTER_ENTERED',
  CHAPTER_LEFT: 'CHAPTER_LEFT',
  BACKTRACK: 'BACKTRACK',
  PARAGRAPH_DWELL: 'PARAGRAPH_DWELL',
  PARAGRAPH_REREAD: 'PARAGRAPH_REREAD',

  // Micro-card Proposal Events (Phase 4)
  // Mirror of EpisodeCollector.EVENT_TYPES.
  CARD_PROPOSED: 'CARD_PROPOSED',
  CARD_ACCEPTED: 'CARD_ACCEPTED',
  CARD_ACKNOWLEDGED: 'CARD_ACKNOWLEDGED',
  CARD_DISMISSED: 'CARD_DISMISSED',

  // Chapter-end Comprehension Events (Phase 6)
  // Mirror of EpisodeCollector.EVENT_TYPES.
  COMPREHENSION_OFFERED: 'COMPREHENSION_OFFERED',
  COMPREHENSION_SUBMITTED: 'COMPREHENSION_SUBMITTED',
  COMPREHENSION_SKIPPED: 'COMPREHENSION_SKIPPED',

  // Spaced Re-reading Events (Phase 8)
  // Mirror of EpisodeCollector.EVENT_TYPES.
  REREAD_SCHEDULED: 'REREAD_SCHEDULED',
  REREAD_COMPLETED: 'REREAD_COMPLETED',

  // Production Loop Events (Phase 8)
  // Mirror of EpisodeCollector.EVENT_TYPES.
  PRODUCTION_PROMPTED: 'PRODUCTION_PROMPTED',
  PRODUCTION_SUBMITTED: 'PRODUCTION_SUBMITTED',
  PRODUCTION_SKIPPED: 'PRODUCTION_SKIPPED',

  // Organize Loop Events (Phase 8)
  // Mirror of EpisodeCollector.EVENT_TYPES.
  ORGANIZE_SUGGESTED: 'ORGANIZE_SUGGESTED',
  ORGANIZE_ACCEPTED: 'ORGANIZE_ACCEPTED',
  ORGANIZE_DISMISSED: 'ORGANIZE_DISMISSED',
};

/**
 * Helper to record common events
 */
export const recordEvent = {
  /**
   * Record review completed
   * @param {Object} data
   */
  reviewCompleted(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.REVIEW_COMPLETED,
      payload: data,
    });
  },

  /**
   * Record session started
   * @param {Object} data
   */
  sessionStarted(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.SESSION_STARTED,
      payload: data,
    });
  },

  /**
   * Record session ended
   * @param {Object} data
   */
  sessionEnded(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.SESSION_ENDED,
      payload: data,
    });
  },

  /**
   * Record book opened
   * @param {Object} data
   */
  bookOpened(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.BOOK_OPENED,
      payload: data,
    });
  },

  /**
   * Record note created
   * @param {Object} data
   */
  noteCreated(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.NOTE_CREATED,
      payload: data,
    });
  },

  /**
   * Record mastery changed
   * @param {Object} data
   */
  masteryChanged(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.MASTERY_CHANGED,
      payload: data,
    });
  },

  /**
   * Record quiz taken
   * @param {Object} data
   */
  quizTaken(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.QUIZ_TAKEN,
      payload: data,
    });
  },

  // ==================== Reading Comprehension (Phase 2) ====================

  /**
   * Record entering a new chapter while reading.
   * @param {Object} data — { bookId, bookType, chapterId, chapterName, fromChapter, fromChapterDurationMs }
   */
  chapterEntered(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.CHAPTER_ENTERED,
      payload: data,
      sourceContext: { view: 'reading', bookType: data?.bookType },
    });
  },

  /**
   * Record leaving a chapter (immediately before chapter change or view close).
   * @param {Object} data — { bookId, bookType, chapterId, chapterName, durationMs, pagesVisited, lastPage, totalPages }
   */
  chapterLeft(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.CHAPTER_LEFT,
      payload: data,
      sourceContext: { view: 'reading', bookType: data?.bookType },
    });
  },

  /**
   * Record a backward navigation event (user scrolled back to earlier content).
   * @param {Object} data — { bookId, bookType, chapterId, fromPage, toPage, pagesBack }
   */
  backtrack(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.BACKTRACK,
      payload: data,
      sourceContext: { view: 'reading', bookType: data?.bookType },
    });
  },

  /**
   * Record abnormal dwell time on a single paragraph (signal of difficulty or interest).
   * @param {Object} data — { bookId, paragraphId, dwellMs, expectedMs }
   */
  paragraphDwell(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.PARAGRAPH_DWELL,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  /**
   * Record a paragraph being re-read (revisited after being scrolled past).
   * @param {Object} data — { bookId, paragraphId, rereadCount, secondsSinceFirstView }
   */
  paragraphReread(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.PARAGRAPH_REREAD,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  // ==================== Micro-card Proposals (Phase 4) ====================

  /**
   * AI proposed a card from the current reading context.
   * @param {Object} data — { proposalId, bookId, chapterId, paragraphHash, front, back, domain, confidence }
   */
  cardProposed(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.CARD_PROPOSED,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  /**
   * User accepted the proposed card → it enters the SRS at Box 1.
   * @param {Object} data — { proposalId, learningPointId, planId }
   */
  cardAccepted(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.CARD_ACCEPTED,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  /**
   * User accepted but flagged "I already know this" → card enters at a
   * higher Leitner box for a deep-decay refresher rather than fresh learning.
   * @param {Object} data — { proposalId, learningPointId, planId, startingBox }
   */
  cardAcknowledged(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.CARD_ACKNOWLEDGED,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  /**
   * User dismissed the proposed card → tuning signal for the proposer.
   * @param {Object} data — { proposalId, bookId, chapterId, paragraphHash, reason }
   */
  cardDismissed(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.CARD_DISMISSED,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  comprehensionOffered(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.COMPREHENSION_OFFERED,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  comprehensionSubmitted(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.COMPREHENSION_SUBMITTED,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  comprehensionSkipped(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.COMPREHENSION_SKIPPED,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  rereadScheduled(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.REREAD_SCHEDULED,
      payload: data,
      sourceContext: { view: 'reading' },
    });
  },

  rereadCompleted(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.REREAD_COMPLETED,
      payload: data,
      sourceContext: { view: 'knowledge' },
    });
  },

  productionSubmitted(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.PRODUCTION_SUBMITTED,
      payload: data,
      sourceContext: { view: 'knowledge' },
    });
  },

  productionSkipped(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.PRODUCTION_SKIPPED,
      payload: data,
      sourceContext: { view: 'knowledge' },
    });
  },

  organizeAccepted(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.ORGANIZE_ACCEPTED,
      payload: data,
      sourceContext: { view: 'moodboard' },
    });
  },

  organizeDismissed(data) {
    return brainApi.recordEpisode({
      eventType: EPISODE_TYPES.ORGANIZE_DISMISSED,
      payload: data,
      sourceContext: { view: 'moodboard' },
    });
  },
};

export default brainApi;
