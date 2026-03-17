/**
 * learningApi.js
 *
 * Renderer-side API for AI Learning Companion operations.
 * Provides a clean interface for components to interact with learning features.
 *
 * Usage:
 * import learningApi from '../api/learningApi';
 *
 * // Get active learning topics
 * const topics = await learningApi.getActiveTopics();
 *
 * // Create a new topic
 * const topic = await learningApi.createTopic({ name: 'GRE Vocabulary', domainType: 'vocabulary' });
 */

import customStorage from '../store/customStorage';

/**
 * Learning API - Renderer-side interface for AI Learning Companion
 */
class LearningApi {
  /**
   * Get default token from session storage
   */
  _getToken(token) {
    return token || customStorage.getSessionToken();
  }

  // ===========================================================================
  // TOPIC OPERATIONS
  // ===========================================================================

  /**
   * Get a learning topic by ID
   * @param {string} id - Topic ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Topic data
   */
  async getTopic(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-topic', id, t);
  }

  /**
   * Get all learning topics for the user
   * @param {Object} options - Query options (status, domainType, limit, offset)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Topics array
   */
  async getTopics(options = {}, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-topics', t, options);
  }

  /**
   * Get active learning topics (for dashboard)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Active topics array
   */
  async getActiveTopics(token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-active-topics', t);
  }

  /**
   * Get topics by source (e.g., for a specific book)
   * @param {string} sourceType - Source type (book, vocabulary_set, url, etc.)
   * @param {string} sourceId - Source ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Topics array
   */
  async getTopicsBySource(sourceType, sourceId, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-topics-by-source',
      sourceType,
      sourceId,
      t,
    );
  }

  /**
   * Create a new learning topic
   * @param {Object} topic - Topic data
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Created topic
   */
  async createTopic(topic, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-create-topic', topic, t);
  }

  /**
   * Update a learning topic
   * @param {string} id - Topic ID
   * @param {Object} updates - Fields to update
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated topic
   */
  async updateTopic(id, updates, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-update-topic',
      id,
      updates,
      t,
    );
  }

  /**
   * Delete a learning topic
   * @param {string} id - Topic ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Success/error status
   */
  async deleteTopic(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-delete-topic', id, t);
  }

  /**
   * Update topic progress after a study session
   * @param {string} id - Topic ID
   * @param {Object} sessionResult - Session results
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated topic
   */
  async updateTopicProgress(id, sessionResult, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-update-topic-progress',
      id,
      sessionResult,
      t,
    );
  }

  /**
   * Get topic statistics
   * @param {string} id - Topic ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Topic statistics
   */
  async getTopicStats(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-topic-stats', id, t);
  }

  /**
   * Count topics by status
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Counts per status
   */
  async countTopicsByStatus(token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-count-topics-by-status',
      t,
    );
  }

  // ===========================================================================
  // PLAN OPERATIONS
  // ===========================================================================

  /**
   * Get a learning plan by ID
   * @param {string} id - Plan ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Plan data
   */
  async getPlan(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-plan', id, t);
  }

  /**
   * Get learning plan for a topic
   * @param {string} topicId - Topic ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Plan data
   */
  async getPlanByTopic(topicId, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-plan-by-topic',
      topicId,
      t,
    );
  }

  /**
   * Get all learning plans
   * @param {Object} options - Query options (status, limit, offset)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Plans array
   */
  async getPlans(options = {}, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-plans', t, options);
  }

  /**
   * Create a learning plan
   * @param {Object} plan - Plan data
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Created plan
   */
  async createPlan(plan, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-create-plan', plan, t);
  }

  /**
   * Update a learning plan
   * @param {string} id - Plan ID
   * @param {Object} updates - Fields to update
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated plan
   */
  async updatePlan(id, updates, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-update-plan',
      id,
      updates,
      t,
    );
  }

  /**
   * Delete a learning plan
   * @param {string} id - Plan ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Success/error status
   */
  async deletePlan(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-delete-plan', id, t);
  }

  /**
   * Start a plan
   * @param {string} id - Plan ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated plan
   */
  async startPlan(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-start-plan', id, t);
  }

  /**
   * Pause a plan
   * @param {string} id - Plan ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated plan
   */
  async pausePlan(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-pause-plan', id, t);
  }

  /**
   * Resume a plan
   * @param {string} id - Plan ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated plan
   */
  async resumePlan(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-resume-plan', id, t);
  }

  /**
   * Advance plan to next day
   * @param {string} id - Plan ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated plan
   */
  async advancePlanDay(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-advance-plan-day', id, t);
  }

  /**
   * Get today's items from a plan
   * @param {string} id - Plan ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Today's items and schedule
   */
  async getTodaysItems(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-todays-items', id, t);
  }

  /**
   * Update an item in a plan
   * @param {string} planId - Plan ID
   * @param {string} itemId - Item ID
   * @param {Object} itemUpdate - Item updates
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated plan
   */
  async updatePlanItem(planId, itemId, itemUpdate, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-update-plan-item',
      planId,
      itemId,
      itemUpdate,
      t,
    );
  }

  // ===========================================================================
  // SESSION OPERATIONS
  // ===========================================================================

  /**
   * Get a learning session by ID
   * @param {string} id - Session ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Session data
   */
  async getSession(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-session', id, t);
  }

  /**
   * Get sessions for a topic
   * @param {string} topicId - Topic ID
   * @param {Object} options - Query options (limit, offset)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Sessions array
   */
  async getSessionsByTopic(topicId, options = {}, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-sessions-by-topic',
      topicId,
      t,
      options,
    );
  }

  /**
   * Get recent sessions
   * @param {number} days - Number of days to look back
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Sessions array
   */
  async getRecentSessions(days = 7, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-recent-sessions',
      t,
      days,
    );
  }

  /**
   * Start a learning session
   * @param {Object} session - Session data (topicId, planId, sessionType)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Created session
   */
  async startSession(session, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-start-session',
      session,
      t,
    );
  }

  /**
   * Complete a learning session
   * @param {string} id - Session ID
   * @param {Object} results - Session results
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated session
   */
  async completeSession(id, results, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-complete-session',
      id,
      results,
      t,
    );
  }

  /**
   * Update session progress
   * @param {string} id - Session ID
   * @param {Object} updates - Incremental updates
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated session
   */
  async updateSessionProgress(id, updates, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-update-session-progress',
      id,
      updates,
      t,
    );
  }

  /**
   * Delete a learning session
   * @param {string} id - Session ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Success/error status
   */
  async deleteSession(id, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-delete-session', id, t);
  }

  // ===========================================================================
  // PERFORMANCE OPERATIONS
  // ===========================================================================

  /**
   * Record item performance
   * @param {Object} performance - Performance data
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Created performance record
   */
  async recordPerformance(performance, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-record-performance',
      performance,
      t,
    );
  }

  /**
   * Get item performance history
   * @param {string} topicId - Topic ID
   * @param {string} itemId - Item ID
   * @param {Object} options - Query options (limit)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Performance history
   */
  async getItemHistory(topicId, itemId, options = {}, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-item-history',
      topicId,
      itemId,
      t,
      options,
    );
  }

  /**
   * Get item performance summary
   * @param {string} topicId - Topic ID
   * @param {string} itemId - Item ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Performance summary
   */
  async getItemSummary(topicId, itemId, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-item-summary',
      topicId,
      itemId,
      t,
    );
  }

  /**
   * Get weak items for a topic
   * @param {string} topicId - Topic ID
   * @param {number} limit - Number of items to return
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Weak items array
   */
  async getWeakItems(topicId, limit = 10, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-weak-items',
      topicId,
      t,
      limit,
    );
  }

  /**
   * Get mistake patterns for a topic
   * @param {string} topicId - Topic ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Mistake patterns
   */
  async getMistakePatterns(topicId, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-mistake-patterns',
      topicId,
      t,
    );
  }

  // ===========================================================================
  // STATISTICS OPERATIONS
  // ===========================================================================

  /**
   * Get daily activity
   * @param {number} days - Number of days to look back
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Daily activity array
   */
  async getDailyActivity(days = 30, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-daily-activity',
      t,
      days,
    );
  }

  /**
   * Get overall statistics
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Overall statistics
   */
  async getOverallStats(token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-overall-stats', t);
  }

  // ===========================================================================
  // PROFILE OPERATIONS
  // ===========================================================================

  /**
   * Get global learner profile
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Global profile
   */
  async getGlobalProfile(token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-global-profile', t);
  }

  /**
   * Update global learner profile
   * @param {Object} updates - Profile updates
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated profile
   */
  async updateGlobalProfile(updates, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-update-global-profile',
      updates,
      t,
    );
  }

  /**
   * Get domain profile
   * @param {string} domainType - Domain type
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Domain profile
   */
  async getDomainProfile(domainType, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-domain-profile',
      domainType,
      t,
    );
  }

  /**
   * Get all domain profiles
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} All domain profiles
   */
  async getAllDomainProfiles(token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-get-all-domain-profiles',
      t,
    );
  }

  /**
   * Update domain profile
   * @param {string} domainType - Domain type
   * @param {Object} updates - Profile updates
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated profile
   */
  async updateDomainProfile(domainType, updates, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-update-domain-profile',
      domainType,
      updates,
      t,
    );
  }

  /**
   * Get full profile (global + all domains)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Full profile
   */
  async getFullProfile(token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke('learning-get-full-profile', t);
  }

  /**
   * Update profile from session
   * @param {string} domainType - Domain type
   * @param {Object} sessionData - Session data
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated profiles
   */
  async updateProfileFromSession(domainType, sessionData, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-update-profile-from-session',
      domainType,
      sessionData,
      t,
    );
  }

  /**
   * Record a weak area
   * @param {string} domainType - Domain type
   * @param {Object} weakArea - Weak area data
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Updated domain profile
   */
  async recordWeakArea(domainType, weakArea, token = null) {
    const t = this._getToken(token);
    return window.electron.ipcRenderer.invoke(
      'learning-record-weak-area',
      domainType,
      weakArea,
      t,
    );
  }

  // ===========================================================================
  // CONVENIENCE METHODS
  // ===========================================================================

  /**
   * Get dashboard data (active topics with stats)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData(token = null) {
    const [topicsResult, statsResult, recentResult, countsResult] =
      await Promise.all([
        this.getActiveTopics(token),
        this.getOverallStats(token),
        this.getRecentSessions(7, token),
        this.countTopicsByStatus(token),
      ]);

    return {
      success:
        topicsResult.success &&
        statsResult.success &&
        recentResult.success &&
        countsResult.success,
      data: {
        activeTopics: topicsResult.data || [],
        overallStats: statsResult.data || {},
        recentSessions: recentResult.data || [],
        topicCounts: countsResult.data || {},
      },
    };
  }

  /**
   * Get full topic detail (topic + plan + recent sessions)
   * @param {string} topicId - Topic ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Full topic detail
   */
  async getTopicDetail(topicId, token = null) {
    const [topicResult, planResult, statsResult, sessionsResult] =
      await Promise.all([
        this.getTopic(topicId, token),
        this.getPlanByTopic(topicId, token),
        this.getTopicStats(topicId, token),
        this.getSessionsByTopic(topicId, { limit: 10 }, token),
      ]);

    return {
      success: topicResult.success,
      data: {
        topic: topicResult.data,
        plan: planResult.data,
        stats: statsResult.data,
        recentSessions: sessionsResult.data || [],
      },
    };
  }

  /**
   * Quick start a study session for a topic
   * @param {string} topicId - Topic ID
   * @param {string} sessionType - Session type (review, learn_new, practice, quiz)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} Session and items to study
   */
  async quickStartSession(topicId, sessionType = 'review', token = null) {
    // Get the plan for the topic
    const planResult = await this.getPlanByTopic(topicId, token);
    const plan = planResult.data;

    // Start a session
    const sessionResult = await this.startSession(
      {
        topicId,
        planId: plan?.id || null,
        sessionType,
      },
      token,
    );

    if (!sessionResult.success) {
      return sessionResult;
    }

    // Get today's items if there's a plan
    let items = [];
    if (plan) {
      const itemsResult = await this.getTodaysItems(plan.id, token);
      if (itemsResult.success) {
        items = itemsResult.data?.items || [];
      }
    }

    return {
      success: true,
      data: {
        session: sessionResult.data,
        items,
        plan,
      },
    };
  }
}

// Export singleton instance
const learningApi = new LearningApi();
export default learningApi;
