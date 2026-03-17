/**
 * LearningBrainAgent - The main brain logic orchestrator
 *
 * Coordinates with existing skills (AdaptiveLearningSkill, LearningGraphSkill)
 * to perform learning analysis during heartbeat.
 *
 * Key responsibilities:
 * - Run BRAIN_CHECKLIST tasks during heartbeat
 * - Coordinate with existing adaptive learning skills
 * - Generate insights and recommendations
 * - Trigger notifications based on patterns
 * - Consolidate episodic memories using LLM synthesis
 */

const ConsolidationService = require('../utils/ConsolidationService');

class LearningBrainAgent {
  constructor(services = {}) {
    this.services = services;
    this.store = services.store;
    this.aiProvider = services.aiProvider;

    // Existing skill instances (reuse, don't rebuild)
    this.adaptiveLearningSkill = services.adaptiveLearningSkill;
    this.learningGraphSkill = services.learningGraphSkill;

    // Database managers
    this.learningPlanManager = services.learningPlanManager;
    this.sessionAnalyticsManager = services.sessionAnalyticsManager;

    // Episode collector and Neo4j adapter
    this.episodeCollector = services.episodeCollector;
    this.neo4jAdapter = services.neo4jAdapter;

    // Consolidation service (LLM-powered memory synthesis)
    this.consolidationService = new ConsolidationService({
      aiProvider: this.aiProvider,
      episodeCollector: this.episodeCollector,
      neo4jAdapter: this.neo4jAdapter,
      store: this.store,
    });

    // Cached insights from last heartbeat
    this.cachedInsights = null;
    this.lastAnalysisTime = null;
  }

  /**
   * Run the heartbeat - main brain logic
   * @param {Object} options
   * @param {boolean} options.isCatchUp - Is this a catch-up run
   * @param {boolean} options.manual - Was this manually triggered
   * @param {string} options.mode - 'service' or 'hybrid'
   * @returns {Promise<Object>}
   */
  async runHeartbeat(options = {}) {
    const { isCatchUp = false, manual = false, mode = 'hybrid' } = options;
    const startTime = Date.now();

    console.log('[LearningBrainAgent] Running heartbeat...', { isCatchUp, manual, mode });

    const results = {
      success: true,
      checklistResults: [],
      insights: null,
      notifications: [],
      duration: 0,
    };

    try {
      // Get user context (single user mode for now)
      const userId = 1;
      const token = 'brain-heartbeat';

      // === BRAIN CHECKLIST ===

      // 1. Check items due for review
      const dueCheck = await this.checkDueItems(userId, token);
      results.checklistResults.push(dueCheck);

      // 2. Analyze recent performance (reuse AdaptiveLearningSkill)
      const perfAnalysis = await this.analyzePerformance(userId, token);
      results.checklistResults.push(perfAnalysis);

      // 3. Detect patterns (reuse AdaptiveLearningSkill)
      const patterns = await this.detectPatterns(userId, token);
      results.checklistResults.push(patterns);

      // 4. Check weak concepts (reuse LearningGraphSkill)
      const weakConcepts = await this.checkWeakConcepts(userId, token);
      results.checklistResults.push(weakConcepts);

      // 5. Update streak status
      const streakCheck = await this.checkStreak(userId, token);
      results.checklistResults.push(streakCheck);

      // 6. Calculate learning velocity
      const velocity = await this.calculateVelocity(userId, token);
      results.checklistResults.push(velocity);

      // === GENERATE INSIGHTS ===

      results.insights = this.generateInsights(results.checklistResults);
      this.cachedInsights = results.insights;
      this.lastAnalysisTime = new Date();

      // === DETERMINE NOTIFICATIONS ===

      results.notifications = this.determineNotifications(results.insights, { isCatchUp });

      // === MEMORY CONSOLIDATION (if not catch-up) ===

      if (!isCatchUp && !manual) {
        const consolidation = await this.runConsolidation(userId, token);
        results.checklistResults.push(consolidation);
      }

      results.duration = Date.now() - startTime;
      console.log('[LearningBrainAgent] Heartbeat completed in', results.duration, 'ms');

      return results;
    } catch (error) {
      console.error('[LearningBrainAgent] Heartbeat error:', error);
      results.success = false;
      results.error = error.message;
      results.duration = Date.now() - startTime;
      return results;
    }
  }

  /**
   * Check items due for review
   * @param {number} userId
   * @param {string} token
   */
  async checkDueItems(userId, token) {
    const taskName = 'check_due_items';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      let dueCount = 0;
      let overdueCount = 0;

      // Try learning plan manager first
      if (this.learningPlanManager) {
        const due = await this.learningPlanManager.getDueItems({
          userId,
          limit: 1000,
        });
        dueCount = due.length;

        // Count overdue (due date in past)
        const now = new Date();
        overdueCount = due.filter((item) => new Date(item.nextReviewDate) < now).length;
      }

      return {
        task: taskName,
        success: true,
        result: { dueCount, overdueCount },
      };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Analyze recent performance using AdaptiveLearningSkill
   * @param {number} userId
   * @param {string} token
   */
  async analyzePerformance(userId, token) {
    const taskName = 'analyze_performance';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (this.adaptiveLearningSkill) {
        // Reuse existing skill
        const context = { userId, token };
        const result = await this.adaptiveLearningSkill.analyzePerformance(context, {
          days: 7,
        });

        return {
          task: taskName,
          success: true,
          result: result,
        };
      }

      // Fallback: basic analysis from session analytics
      if (this.sessionAnalyticsManager) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const sessions = await this.sessionAnalyticsManager.getSessionHistory({
          userId,
          startDate: weekAgo.toISOString(),
        });

        const totalReviews = sessions.reduce((sum, s) => sum + (s.itemsReviewed || 0), 0);
        const avgAccuracy = sessions.length > 0
          ? sessions.reduce((sum, s) => sum + parseFloat(s.accuracy || 0), 0) / sessions.length
          : 0;

        return {
          task: taskName,
          success: true,
          result: {
            totalReviews,
            avgAccuracy: Math.round(avgAccuracy),
            sessionCount: sessions.length,
          },
        };
      }

      return { task: taskName, success: true, result: { noData: true } };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Detect learning patterns using AdaptiveLearningSkill
   * @param {number} userId
   * @param {string} token
   */
  async detectPatterns(userId, token) {
    const taskName = 'detect_patterns';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (this.adaptiveLearningSkill) {
        const context = { userId, token };
        const result = await this.adaptiveLearningSkill.detectPatterns(context, {
          days: 30,
        });

        return {
          task: taskName,
          success: true,
          result: result,
        };
      }

      // No skill available - return empty patterns
      return {
        task: taskName,
        success: true,
        result: { patterns: [], message: 'Pattern detection not available' },
      };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Check weak concepts using LearningGraphSkill
   * @param {number} userId
   * @param {string} token
   */
  async checkWeakConcepts(userId, token) {
    const taskName = 'check_weak_concepts';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (this.learningGraphSkill) {
        const context = { userId, token };
        const result = await this.learningGraphSkill.getWeakConcepts(context, {
          limit: 10,
        });

        return {
          task: taskName,
          success: true,
          result: result,
        };
      }

      // Fallback to simple query
      if (this.services.neo4jAdapter) {
        const weak = await this.services.neo4jAdapter.detectWeakConcepts(10, token);
        return {
          task: taskName,
          success: true,
          result: { weakConcepts: weak },
        };
      }

      return {
        task: taskName,
        success: true,
        result: { weakConcepts: [], message: 'Graph not available' },
      };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Check streak status
   * @param {number} userId
   * @param {string} token
   */
  async checkStreak(userId, token) {
    const taskName = 'check_streak';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      let streakDays = 0;
      let streakAtRisk = false;

      // Check learner profile for streak
      if (this.services.learnerProfileManager) {
        const profile = await this.services.learnerProfileManager.getProfile(userId);
        streakDays = profile?.currentStreak || 0;

        // Check if studied today
        const lastStudy = profile?.lastStudyDate;
        if (lastStudy) {
          const today = new Date().toDateString();
          const lastStudyDate = new Date(lastStudy).toDateString();

          if (lastStudyDate !== today && streakDays > 0) {
            // Haven't studied today - streak at risk
            const hourOfDay = new Date().getHours();
            streakAtRisk = hourOfDay >= 18; // Evening
          }
        }
      }

      return {
        task: taskName,
        success: true,
        result: { streakDays, streakAtRisk },
      };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Calculate learning velocity
   * @param {number} userId
   * @param {string} token
   */
  async calculateVelocity(userId, token) {
    const taskName = 'calculate_velocity';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      if (this.sessionAnalyticsManager) {
        const velocity = await this.sessionAnalyticsManager.getAggregateVelocity({
          userId,
        });

        return {
          task: taskName,
          success: true,
          result: velocity,
        };
      }

      return { task: taskName, success: true, result: { noData: true } };
    } catch (error) {
      return { task: taskName, success: false, error: error.message };
    }
  }

  /**
   * Run memory consolidation using LLM-powered episode synthesis
   * Groups episodes by concept, detects context shifts, and uses AI to create
   * higher-level consolidated memories.
   *
   * @param {number} userId
   * @param {string} token
   * @param {Object} options
   * @param {number} options.periodDays - Look-back period (default: 7)
   * @param {number} options.minEpisodes - Min episodes to consolidate (default: 3)
   */
  async runConsolidation(userId, token, options = {}) {
    const taskName = 'memory_consolidation';
    console.log(`[LearningBrainAgent] Running ${taskName}...`);

    try {
      // Check if consolidation service is ready
      if (!this.consolidationService) {
        console.warn('[LearningBrainAgent] Consolidation service not initialized');
        return {
          task: taskName,
          success: false,
          result: { error: 'Consolidation service not available' },
        };
      }

      // Check if AI provider is available
      if (!this.aiProvider) {
        console.warn('[LearningBrainAgent] AI provider not available for consolidation');
        // Still run consolidation - it will use fallback synthesis
      }

      // Run consolidation
      const result = await this.consolidationService.consolidateEpisodes(userId, token, {
        periodDays: options.periodDays || 7,
        minEpisodes: options.minEpisodes || 3,
        contextShiftHours: options.contextShiftHours || 24,
      });

      // If consolidation ran, also archive old episodes
      if (result.success && result.consolidated > 0) {
        const archiveResult = await this.consolidationService.archiveOldEpisodes(token);
        result.archived = archiveResult.archived || 0;
        result.deletedOld = archiveResult.deleted || 0;
      }

      return {
        task: taskName,
        success: result.success,
        result: {
          consolidated: result.consolidated || 0,
          totalEpisodes: result.totalEpisodes || 0,
          message: result.message || `Consolidated ${result.consolidated || 0} memory clusters`,
          archived: result.archived || 0,
          deletedOld: result.deletedOld || 0,
        },
      };
    } catch (error) {
      console.error('[LearningBrainAgent] Consolidation error:', error);
      return {
        task: taskName,
        success: false,
        result: { error: error.message },
      };
    }
  }

  /**
   * Manually trigger consolidation (can be called from Settings UI)
   * @param {string} token
   * @param {Object} options
   */
  async triggerManualConsolidation(token, options = {}) {
    const userId = 1; // Single user mode for now
    return this.runConsolidation(userId, token, {
      ...options,
      manual: true,
    });
  }

  /**
   * Get consolidation statistics
   * @param {string} token
   */
  getConsolidationStats(token) {
    if (!this.consolidationService) {
      return { error: 'Consolidation service not available' };
    }
    return this.consolidationService.getStats(token);
  }

  /**
   * Generate insights from checklist results
   * @param {Array} checklistResults
   * @returns {Object}
   */
  generateInsights(checklistResults) {
    const insights = {
      dueItemsCount: 0,
      overdueCount: 0,
      streakDays: 0,
      streakAtRisk: false,
      weeklyReviews: 0,
      weeklyAccuracy: 0,
      weakConcepts: [],
      patterns: [],
      velocity: null,
      lastUpdated: new Date().toISOString(),
    };

    for (const result of checklistResults) {
      if (!result.success || !result.result) continue;

      switch (result.task) {
        case 'check_due_items':
          insights.dueItemsCount = result.result.dueCount || 0;
          insights.overdueCount = result.result.overdueCount || 0;
          break;

        case 'analyze_performance':
          insights.weeklyReviews = result.result.totalReviews || 0;
          insights.weeklyAccuracy = result.result.avgAccuracy || 0;
          break;

        case 'detect_patterns':
          insights.patterns = result.result.patterns || [];
          break;

        case 'check_weak_concepts':
          insights.weakConcepts = result.result.weakConcepts || [];
          break;

        case 'check_streak':
          insights.streakDays = result.result.streakDays || 0;
          insights.streakAtRisk = result.result.streakAtRisk || false;
          break;

        case 'calculate_velocity':
          insights.velocity = result.result.noData ? null : result.result;
          break;
      }
    }

    return insights;
  }

  /**
   * Determine which notifications to send
   * @param {Object} insights
   * @param {Object} options
   * @returns {Array}
   */
  determineNotifications(insights, options = {}) {
    const { isCatchUp = false } = options;
    const notifications = [];
    const config = this.store?.get('learningBrain.notifications', {}) || {};

    // Streak at risk
    if (insights.streakAtRisk && insights.streakDays > 0 && config.streakAlert !== false) {
      notifications.push({
        type: 'streakAlert',
        title: `Your ${insights.streakDays}-day streak ends soon!`,
        message: `Just a quick review to keep it going.`,
        urgency: 'high',
      });
    }

    // Due items reminder
    if (insights.dueItemsCount > 0 && config.dailySummary !== false && !isCatchUp) {
      notifications.push({
        type: 'dailySummary',
        title: 'SmartReader',
        message: `${insights.dueItemsCount} items ready for review!${insights.streakDays > 0 ? ` Streak: ${insights.streakDays} days` : ''}`,
      });
    }

    // Welcome back (catch-up)
    if (isCatchUp && config.welcomeBack !== false) {
      notifications.push({
        type: 'welcomeBack',
        title: 'Welcome back to SmartReader!',
        message: `${insights.dueItemsCount} items are waiting for you.`,
      });
    }

    // Weak concepts alert
    if (insights.weakConcepts.length >= 3 && config.struggleAlert !== false) {
      notifications.push({
        type: 'struggleAlert',
        title: 'Focus Area Detected',
        message: `You might need extra practice with "${insights.weakConcepts[0]?.name || 'some concepts'}"`,
      });
    }

    return notifications;
  }

  /**
   * Get cached insights
   * @returns {Object|null}
   */
  getInsights() {
    return this.cachedInsights;
  }

  /**
   * Get the time of last analysis
   * @returns {Date|null}
   */
  getLastAnalysisTime() {
    return this.lastAnalysisTime;
  }
}

module.exports = LearningBrainAgent;
