/**
 * PredictiveInsightsService.js
 *
 * Provides predictive insights for optimal learning:
 * - Scheduling: When and how long to study
 * - Content: What to study and in what order (prerequisite-aware)
 * - Strategy: Spacing, anti-cramming, consistency tips
 *
 * Uses data from:
 * - LearnerProfileInference (optimal timing, session preferences, forgetting curve)
 * - CrossConceptAnalyzer (prerequisites, interference, positive transfer)
 * - EpisodeCollector (learning history)
 * - SessionAnalyticsManager (performance data)
 * - LearningPlanManager (spaced repetition schedules)
 */

const LearnerProfileInference = require('./LearnerProfileInference');
const CrossConceptAnalyzer = require('./CrossConceptAnalyzer');

// Constants for prediction algorithms
const PREDICTION_CONSTANTS = {
  // Forgetting curve parameters (Ebbinghaus-inspired)
  DEFAULT_STABILITY: 1.0, // Initial memory stability (days)
  STABILITY_INCREASE_FACTOR: 2.0, // Factor for successful review
  STABILITY_DECREASE_FACTOR: 0.5, // Factor for failed review
  RETENTION_THRESHOLD: 0.85, // Target retention probability

  // Scheduling parameters
  MIN_SESSION_MINUTES: 5,
  MAX_SESSION_MINUTES: 60,
  OPTIMAL_BREAK_INTERVAL: 25, // Pomodoro-style

  // Anti-cramming parameters
  CRAMMING_THRESHOLD_HOURS: 2, // Reviews within 2 hours = cramming
  MIN_SPACING_HOURS: 4, // Minimum hours between reviews of same item
  OPTIMAL_DAILY_NEW_ITEMS: 10, // Max new items per day

  // Consistency parameters
  STREAK_BONUS_THRESHOLD: 7, // Days for streak bonus
  CONSISTENCY_WEIGHT: 0.3, // Weight of consistency in recommendations
};

// Recommendation types
const RECOMMENDATION_TYPES = {
  SCHEDULE: 'schedule',
  CONTENT: 'content',
  STRATEGY: 'strategy',
  WARNING: 'warning',
  ENCOURAGEMENT: 'encouragement',
};

// Priority levels
const PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

class PredictiveInsightsService {
  constructor(services = {}) {
    // Core services
    this.episodeCollector = services.episodeCollector;
    this.sessionAnalyticsManager = services.sessionAnalyticsManager;
    this.learningPlanManager = services.learningPlanManager;
    this.learnerProfileManager = services.learnerProfileManager;
    this.neo4jAdapter = services.neo4jAdapter;

    // Analysis services (instantiated with same dependencies)
    this.profileInference = new LearnerProfileInference({
      episodeCollector: this.episodeCollector,
      sessionAnalyticsManager: this.sessionAnalyticsManager,
      learnerProfileManager: this.learnerProfileManager,
    });

    this.crossConceptAnalyzer = new CrossConceptAnalyzer({
      episodeCollector: this.episodeCollector,
      sessionAnalyticsManager: this.sessionAnalyticsManager,
      graphInterface: services.graphInterface,
    });

    // Cached analysis results
    this.cachedProfile = null;
    this.cachedPatterns = null;
    this.lastAnalysisTime = null;

    // Configuration
    this.config = {
      cacheExpiryMinutes: 60,
      lookbackDays: 30,
      forecastDays: 7,
      maxRecommendations: 10,
    };
  }

  // =============================================================================
  // MAIN ENTRY POINTS
  // =============================================================================

  /**
   * Get comprehensive predictive insights
   * @param {number} userId
   * @param {string} token
   * @param {Object} options
   * @returns {Promise<Object>} Full insights object
   */
  async getPredictiveInsights(userId, token, options = {}) {
    const startTime = Date.now();

    try {
      // Refresh cached analysis if needed
      await this.refreshAnalysisCache(userId, token);

      // Generate all types of insights
      const [scheduling, content, strategy] = await Promise.all([
        this.getSchedulingInsights(userId, token, options),
        this.getContentInsights(userId, token, options),
        this.getStrategyInsights(userId, token, options),
      ]);

      // Combine and prioritize recommendations
      const allRecommendations = [
        ...scheduling.recommendations,
        ...content.recommendations,
        ...strategy.recommendations,
      ].sort((a, b) => a.priority - b.priority);

      return {
        success: true,
        userId,
        generatedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
        scheduling,
        content,
        strategy,
        recommendations: allRecommendations.slice(0, this.config.maxRecommendations),
        summary: this.generateSummary(scheduling, content, strategy),
      };
    } catch (error) {
      console.error('[PredictiveInsightsService] Error generating insights:', error);
      return {
        success: false,
        error: error.message,
        userId,
        generatedAt: new Date().toISOString(),
      };
    }
  }

  // =============================================================================
  // SCHEDULING INSIGHTS (When & How Long)
  // =============================================================================

  /**
   * Get scheduling recommendations
   */
  async getSchedulingInsights(userId, token, options = {}) {
    const recommendations = [];
    const profile = this.cachedProfile;

    // 1. Optimal review time prediction
    const optimalReviewTime = this.predictOptimalReviewTime(profile);
    recommendations.push({
      type: RECOMMENDATION_TYPES.SCHEDULE,
      category: 'timing',
      priority: PRIORITY.MEDIUM,
      title: 'Best time to study',
      message: `Your performance peaks during ${optimalReviewTime.preferredTimeOfDay}. ` +
               `Consider scheduling study sessions around ${optimalReviewTime.suggestedHours.join(', ')}:00.`,
      data: optimalReviewTime,
    });

    // 2. Session duration recommendation
    const sessionDuration = this.predictOptimalSessionDuration(profile);
    recommendations.push({
      type: RECOMMENDATION_TYPES.SCHEDULE,
      category: 'duration',
      priority: PRIORITY.MEDIUM,
      title: 'Optimal session length',
      message: `Based on your focus patterns, aim for ${sessionDuration.recommendedMinutes}-minute sessions ` +
               `with breaks every ${sessionDuration.breakInterval} minutes.`,
      data: sessionDuration,
    });

    // 3. Daily review forecast
    const dueItems = await this.getDueItemsForecast(userId, token, options);
    if (dueItems.todayCount > 0) {
      const urgency = dueItems.overdueCount > 10 ? PRIORITY.HIGH : PRIORITY.MEDIUM;
      recommendations.push({
        type: RECOMMENDATION_TYPES.SCHEDULE,
        category: 'workload',
        priority: urgency,
        title: 'Today\'s review load',
        message: `You have ${dueItems.todayCount} items due today` +
                 (dueItems.overdueCount > 0 ? ` (${dueItems.overdueCount} overdue)` : '') +
                 `. Estimated time: ${dueItems.estimatedMinutes} minutes.`,
        data: dueItems,
      });
    }

    // 4. Weekly workload distribution
    const weeklyDistribution = this.calculateWeeklyDistribution(dueItems, profile);
    if (weeklyDistribution.unevenLoad) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.SCHEDULE,
        category: 'distribution',
        priority: PRIORITY.LOW,
        title: 'Balance your week',
        message: weeklyDistribution.suggestion,
        data: weeklyDistribution,
      });
    }

    return {
      optimalReviewTime,
      sessionDuration,
      dueItems,
      weeklyDistribution,
      recommendations,
    };
  }

  /**
   * Predict optimal time of day for study
   */
  predictOptimalReviewTime(profile) {
    const timing = profile?.inferences?.optimalTiming || {};
    const preferredTimeOfDay = timing.preferredTimeOfDay || 'any';
    const optimalHours = timing.optimalHours || [];

    // Generate suggested hours based on preference
    let suggestedHours = optimalHours.length > 0 ? optimalHours : [9, 14, 19];

    if (preferredTimeOfDay === 'morning') {
      suggestedHours = [7, 8, 9];
    } else if (preferredTimeOfDay === 'afternoon') {
      suggestedHours = [13, 14, 15];
    } else if (preferredTimeOfDay === 'evening') {
      suggestedHours = [18, 19, 20];
    } else if (preferredTimeOfDay === 'night') {
      suggestedHours = [21, 22, 23];
    }

    return {
      preferredTimeOfDay,
      suggestedHours,
      confidence: timing.confidence || 0,
      hourlyPerformance: timing.hourlyPerformance || [],
      preferredDays: timing.preferredDays || [],
    };
  }

  /**
   * Predict optimal session duration
   */
  predictOptimalSessionDuration(profile) {
    const sessionPrefs = profile?.inferences?.sessionPreferences || {};
    const pacePrefs = profile?.inferences?.pacePreferences || {};

    const optimalMinutes = sessionPrefs.optimalMinutes || 20;
    const focusDecayPoint = sessionPrefs.focusDecayPoint || 25;

    // Recommend slightly shorter than decay point
    const recommendedMinutes = Math.min(
      Math.max(PREDICTION_CONSTANTS.MIN_SESSION_MINUTES, focusDecayPoint - 5),
      PREDICTION_CONSTANTS.MAX_SESSION_MINUTES
    );

    // Break interval based on focus decay
    const breakInterval = Math.min(
      focusDecayPoint,
      PREDICTION_CONSTANTS.OPTIMAL_BREAK_INTERVAL
    );

    return {
      recommendedMinutes,
      breakInterval,
      optimalBatchSize: pacePrefs.optimalBatchSize || 10,
      preference: sessionPrefs.preference || 'medium',
      confidence: sessionPrefs.confidence || 0,
    };
  }

  /**
   * Get forecast of due items
   */
  async getDueItemsForecast(userId, token, options = {}) {
    const forecastDays = options.forecastDays || this.config.forecastDays;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const forecast = {
      todayCount: 0,
      overdueCount: 0,
      estimatedMinutes: 0,
      byDay: [],
      totalWeek: 0,
    };

    try {
      if (this.learningPlanManager) {
        // Get all due items
        const dueItems = await this.learningPlanManager.getDueItems?.({
          userId,
          limit: 1000,
        }) || [];

        const now = new Date();

        for (const item of dueItems) {
          const dueDate = new Date(item.nextReviewDate);

          if (dueDate < today) {
            forecast.overdueCount++;
            forecast.todayCount++;
          } else if (dueDate.toDateString() === today.toDateString()) {
            forecast.todayCount++;
          }
        }

        // Group by day for next week
        for (let i = 0; i < forecastDays; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];

          const dayCount = dueItems.filter((item) => {
            const dueDate = new Date(item.nextReviewDate);
            return dueDate.toISOString().split('T')[0] === dateStr;
          }).length;

          forecast.byDay.push({
            date: dateStr,
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            count: dayCount + (i === 0 ? forecast.overdueCount : 0),
          });
          forecast.totalWeek += dayCount;
        }

        // Estimate time (2 minutes per item average)
        forecast.estimatedMinutes = Math.ceil(forecast.todayCount * 2);
      }
    } catch (error) {
      console.error('[PredictiveInsightsService] Error getting due items:', error);
    }

    return forecast;
  }

  /**
   * Calculate weekly workload distribution
   */
  calculateWeeklyDistribution(dueItems, profile) {
    const byDay = dueItems.byDay || [];
    if (byDay.length === 0) {
      return { unevenLoad: false, distribution: [], suggestion: '' };
    }

    const counts = byDay.map((d) => d.count);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const max = Math.max(...counts);
    const min = Math.min(...counts);

    // Check if load is uneven (max > 2x average or min < 0.5x average)
    const unevenLoad = max > avg * 2 || (avg > 0 && min < avg * 0.3);

    let suggestion = '';
    if (unevenLoad) {
      const heavyDays = byDay.filter((d) => d.count > avg * 1.5).map((d) => d.dayName);
      const lightDays = byDay.filter((d) => d.count < avg * 0.5).map((d) => d.dayName);

      if (heavyDays.length > 0 && lightDays.length > 0) {
        suggestion = `Consider moving some reviews from ${heavyDays.join(', ')} to ${lightDays.join(', ')} for a more balanced schedule.`;
      } else if (heavyDays.length > 0) {
        suggestion = `${heavyDays.join(' and ')} will be heavy. Plan extra time or start early.`;
      }
    }

    return {
      unevenLoad,
      distribution: byDay,
      average: Math.round(avg),
      max,
      min,
      suggestion,
      preferredDays: profile?.inferences?.optimalTiming?.preferredDays || [],
    };
  }

  // =============================================================================
  // CONTENT INSIGHTS (What & Order)
  // =============================================================================

  /**
   * Get content recommendations
   */
  async getContentInsights(userId, token, options = {}) {
    const recommendations = [];
    const patterns = this.cachedPatterns;

    // 1. Prerequisite-ordered learning
    const learningOrder = this.calculatePrerequisiteOrder(patterns);
    if (learningOrder.suggestedOrder.length > 0) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.CONTENT,
        category: 'order',
        priority: PRIORITY.HIGH,
        title: 'Learning sequence',
        message: `Based on concept dependencies, focus on: ${learningOrder.suggestedOrder.slice(0, 3).join(' → ')}`,
        data: learningOrder,
      });
    }

    // 2. Weak concepts to prioritize
    const weakConcepts = await this.getWeakConceptsToReview(userId, token);
    if (weakConcepts.length > 0) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.CONTENT,
        category: 'weakness',
        priority: PRIORITY.HIGH,
        title: 'Focus areas',
        message: `These concepts need attention: ${weakConcepts.slice(0, 3).map((c) => c.name).join(', ')}`,
        data: { weakConcepts },
      });
    }

    // 3. Positive transfer opportunities
    const transferOpportunities = this.findTransferOpportunities(patterns);
    if (transferOpportunities.length > 0) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.CONTENT,
        category: 'synergy',
        priority: PRIORITY.LOW,
        title: 'Learning synergies',
        message: `Learning ${transferOpportunities[0].from} helps with ${transferOpportunities[0].to}. ` +
                 `Consider studying them together.`,
        data: { transfers: transferOpportunities },
      });
    }

    // 4. Interference warnings
    const interferences = this.findInterferences(patterns);
    if (interferences.length > 0) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.WARNING,
        category: 'interference',
        priority: PRIORITY.MEDIUM,
        title: 'Avoid confusion',
        message: `Studying ${interferences[0].conceptA} and ${interferences[0].conceptB} together may cause confusion. ` +
                 `Space them apart.`,
        data: { interferences },
      });
    }

    // 5. Balanced topic coverage
    const coverage = await this.analyzeTopicCoverage(userId, token);
    if (coverage.neglectedTopics.length > 0) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.CONTENT,
        category: 'coverage',
        priority: PRIORITY.LOW,
        title: 'Neglected topics',
        message: `You haven't reviewed ${coverage.neglectedTopics.slice(0, 2).join(' or ')} recently. Consider adding them to your session.`,
        data: coverage,
      });
    }

    return {
      learningOrder,
      weakConcepts,
      transferOpportunities,
      interferences,
      coverage,
      recommendations,
    };
  }

  /**
   * Calculate prerequisite-based learning order
   */
  calculatePrerequisiteOrder(patterns) {
    const prerequisites = patterns?.patterns?.prerequisites || [];
    const suggestedOrder = [];
    const conceptDependencies = new Map();

    // Build dependency graph
    for (const prereq of prerequisites) {
      const from = prereq.fromConceptName || prereq.fromConceptId;
      const to = prereq.toConceptName || prereq.toConceptId;

      if (!conceptDependencies.has(to)) {
        conceptDependencies.set(to, []);
      }
      conceptDependencies.get(to).push(from);
    }

    // Topological sort (Kahn's algorithm)
    const inDegree = new Map();
    const allConcepts = new Set();

    for (const prereq of prerequisites) {
      const from = prereq.fromConceptName || prereq.fromConceptId;
      const to = prereq.toConceptName || prereq.toConceptId;
      allConcepts.add(from);
      allConcepts.add(to);
    }

    for (const concept of allConcepts) {
      inDegree.set(concept, 0);
    }

    for (const prereq of prerequisites) {
      const to = prereq.toConceptName || prereq.toConceptId;
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }

    // Find concepts with no prerequisites (starting points)
    const queue = [];
    for (const [concept, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(concept);
      }
    }

    // Process in order
    while (queue.length > 0) {
      const current = queue.shift();
      suggestedOrder.push(current);

      // Reduce in-degree of dependent concepts
      for (const prereq of prerequisites) {
        const from = prereq.fromConceptName || prereq.fromConceptId;
        const to = prereq.toConceptName || prereq.toConceptId;

        if (from === current) {
          const newDegree = (inDegree.get(to) || 1) - 1;
          inDegree.set(to, newDegree);
          if (newDegree === 0) {
            queue.push(to);
          }
        }
      }
    }

    return {
      suggestedOrder,
      prerequisites: prerequisites.slice(0, 10),
      totalConcepts: allConcepts.size,
    };
  }

  /**
   * Get weak concepts that need review
   */
  async getWeakConceptsToReview(userId, token) {
    const weakConcepts = [];

    try {
      // Try Neo4j first for graph-based weak concept detection
      if (this.neo4jAdapter?.checkConnection?.()) {
        const graphWeak = await this.neo4jAdapter.detectWeakConcepts?.(userId, token, { limit: 10 });
        if (graphWeak?.length > 0) {
          return graphWeak.map((c) => ({
            id: c.id,
            name: c.name,
            mastery: c.mastery || 0,
            reason: c.reason || 'low_mastery',
            lastReviewed: c.lastReviewed,
          }));
        }
      }

      // Fallback: analyze from episodes
      const patterns = this.cachedPatterns;
      const forgettingCorrelations = patterns?.patterns?.forgettingCorrelations || [];

      for (const fc of forgettingCorrelations) {
        if (fc.decayRate > 0.3) {
          // High decay rate
          weakConcepts.push({
            id: fc.conceptA,
            name: fc.conceptA,
            mastery: 1 - fc.decayRate,
            reason: 'high_forgetting_rate',
          });
        }
      }
    } catch (error) {
      console.error('[PredictiveInsightsService] Error getting weak concepts:', error);
    }

    return weakConcepts;
  }

  /**
   * Find positive transfer opportunities
   */
  findTransferOpportunities(patterns) {
    const transfers = patterns?.patterns?.positiveTransfers || [];

    return transfers
      .filter((t) => t.confidence >= 0.6)
      .map((t) => ({
        from: t.fromConceptName || t.fromConceptId,
        to: t.toConceptName || t.toConceptId,
        confidence: t.confidence,
        improvementPercent: t.improvement || 0,
      }))
      .slice(0, 5);
  }

  /**
   * Find interference patterns
   */
  findInterferences(patterns) {
    const interferences = patterns?.patterns?.interferences || [];

    return interferences
      .filter((i) => i.severityScore >= 0.5)
      .map((i) => ({
        conceptA: i.conceptA || i.fromConceptName,
        conceptB: i.conceptB || i.toConceptName,
        severity: i.severityScore,
        accuracyDrop: i.accuracyDrop || 0,
      }))
      .slice(0, 5);
  }

  /**
   * Analyze topic coverage
   */
  async analyzeTopicCoverage(userId, token) {
    const coverage = {
      totalTopics: 0,
      activeTopics: 0,
      neglectedTopics: [],
      topicActivity: [],
    };

    try {
      // Get topic activity from episodes
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 14); // Last 2 weeks

      const episodes = await this.episodeCollector?.getEpisodesInRange?.(startDate, endDate) || [];

      // Group by topic/concept
      const topicLastActive = new Map();
      for (const ep of episodes) {
        const payload = typeof ep.payload === 'string' ? JSON.parse(ep.payload) : ep.payload || {};
        const topic = payload.topicId || payload.conceptId || payload.planId;
        if (topic) {
          const timestamp = new Date(ep.timestamp || ep.t_valid);
          if (!topicLastActive.has(topic) || timestamp > topicLastActive.get(topic)) {
            topicLastActive.set(topic, timestamp);
          }
        }
      }

      coverage.totalTopics = topicLastActive.size;

      // Find neglected (not touched in 7+ days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      for (const [topic, lastActive] of topicLastActive.entries()) {
        if (lastActive < sevenDaysAgo) {
          coverage.neglectedTopics.push(topic);
        } else {
          coverage.activeTopics++;
        }
      }
    } catch (error) {
      console.error('[PredictiveInsightsService] Error analyzing coverage:', error);
    }

    return coverage;
  }

  // =============================================================================
  // STRATEGY INSIGHTS (Spacing, Anti-Cramming, Consistency)
  // =============================================================================

  /**
   * Get strategy recommendations
   */
  async getStrategyInsights(userId, token, options = {}) {
    const recommendations = [];
    const profile = this.cachedProfile;

    // 1. Cramming detection and warning
    const crammingAnalysis = await this.detectCramming(userId, token);
    if (crammingAnalysis.isCramming) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.WARNING,
        category: 'anti-cramming',
        priority: PRIORITY.CRITICAL,
        title: 'Slow down!',
        message: `You've reviewed ${crammingAnalysis.recentCount} items in ${crammingAnalysis.timeWindowHours} hours. ` +
                 `Spacing reviews improves retention by 40%. Take a break and come back later.`,
        data: crammingAnalysis,
      });
    }

    // 2. Spacing recommendations
    const spacingAdvice = this.calculateOptimalSpacing(profile);
    recommendations.push({
      type: RECOMMENDATION_TYPES.STRATEGY,
      category: 'spacing',
      priority: PRIORITY.MEDIUM,
      title: 'Optimal spacing',
      message: `Your memory works best with ${spacingAdvice.optimalInterval}-day gaps between reviews. ` +
               `Reviewing too soon wastes effort; too late risks forgetting.`,
      data: spacingAdvice,
    });

    // 3. Consistency tracking
    const consistency = await this.analyzeConsistency(userId, token);
    if (consistency.currentStreak > 0) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.ENCOURAGEMENT,
        category: 'consistency',
        priority: PRIORITY.LOW,
        title: `${consistency.currentStreak}-day streak!`,
        message: consistency.currentStreak >= 7
          ? `Amazing! You're on a ${consistency.currentStreak}-day streak. Keep it up!`
          : `You've studied ${consistency.currentStreak} days in a row. Just ${7 - consistency.currentStreak} more for a week streak!`,
        data: consistency,
      });
    } else if (consistency.daysSinceLastSession > 2) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.WARNING,
        category: 'consistency',
        priority: PRIORITY.HIGH,
        title: 'Getting rusty',
        message: `It's been ${consistency.daysSinceLastSession} days since your last session. ` +
                 `Even 5 minutes today helps maintain momentum.`,
        data: consistency,
      });
    }

    // 4. New item pacing
    const pacingAdvice = this.calculateNewItemPacing(profile);
    if (pacingAdvice.suggestion) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.STRATEGY,
        category: 'pacing',
        priority: PRIORITY.MEDIUM,
        title: 'New item pacing',
        message: pacingAdvice.suggestion,
        data: pacingAdvice,
      });
    }

    // 5. Break reminders based on session patterns
    const breakAdvice = this.calculateBreakStrategy(profile);
    if (breakAdvice.needsReminder) {
      recommendations.push({
        type: RECOMMENDATION_TYPES.STRATEGY,
        category: 'breaks',
        priority: PRIORITY.LOW,
        title: 'Take breaks',
        message: breakAdvice.message,
        data: breakAdvice,
      });
    }

    return {
      crammingAnalysis,
      spacingAdvice,
      consistency,
      pacingAdvice,
      breakAdvice,
      recommendations,
    };
  }

  /**
   * Detect cramming behavior
   */
  async detectCramming(userId, token) {
    const analysis = {
      isCramming: false,
      recentCount: 0,
      timeWindowHours: PREDICTION_CONSTANTS.CRAMMING_THRESHOLD_HOURS,
      conceptsRepeated: [],
    };

    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - PREDICTION_CONSTANTS.CRAMMING_THRESHOLD_HOURS * 60 * 60 * 1000);

      const episodes = await this.episodeCollector?.getEpisodesInRange?.(windowStart, now) || [];
      const reviewEpisodes = episodes.filter((ep) => ep.eventType === 'REVIEW_COMPLETED');

      analysis.recentCount = reviewEpisodes.length;

      // Check for repeated concepts
      const conceptCounts = new Map();
      for (const ep of reviewEpisodes) {
        const payload = typeof ep.payload === 'string' ? JSON.parse(ep.payload) : ep.payload || {};
        const concept = payload.conceptId || payload.conceptName || payload.word;
        if (concept) {
          conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
        }
      }

      // Concepts reviewed more than twice in the window
      for (const [concept, count] of conceptCounts.entries()) {
        if (count >= 3) {
          analysis.conceptsRepeated.push({ concept, count });
        }
      }

      // Cramming = many reviews OR repeated concepts
      analysis.isCramming = reviewEpisodes.length > 20 || analysis.conceptsRepeated.length > 3;
    } catch (error) {
      console.error('[PredictiveInsightsService] Error detecting cramming:', error);
    }

    return analysis;
  }

  /**
   * Calculate optimal spacing based on forgetting curve
   */
  calculateOptimalSpacing(profile) {
    const forgettingCurve = profile?.inferences?.forgettingCurve || {};

    const optimalInterval = forgettingCurve.optimalReviewInterval || 3;
    const retentionStrength = forgettingCurve.retentionStrength || 'moderate';
    const forgettingSlope = forgettingCurve.forgettingSlope || 0.5;

    // Adjust recommendation based on retention strength
    let multiplier = 1.0;
    if (retentionStrength === 'strong') multiplier = 1.3;
    if (retentionStrength === 'weak') multiplier = 0.7;

    const recommendedIntervals = [1, 3, 7, 14, 30].map((days) =>
      Math.round(days * multiplier)
    );

    return {
      optimalInterval,
      retentionStrength,
      forgettingSlope,
      recommendedIntervals,
      targetRetention: PREDICTION_CONSTANTS.RETENTION_THRESHOLD,
    };
  }

  /**
   * Analyze learning consistency
   */
  async analyzeConsistency(userId, token) {
    const consistency = {
      currentStreak: 0,
      longestStreak: 0,
      daysSinceLastSession: 0,
      sessionsLast7Days: 0,
      averageSessionsPerWeek: 0,
    };

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const episodes = await this.episodeCollector?.getEpisodesInRange?.(startDate, endDate) || [];

      // Group by date
      const activeDates = new Set();
      let lastActiveDate = null;

      for (const ep of episodes) {
        const date = new Date(ep.timestamp || ep.t_valid).toISOString().split('T')[0];
        activeDates.add(date);
        const epDate = new Date(ep.timestamp || ep.t_valid);
        if (!lastActiveDate || epDate > lastActiveDate) {
          lastActiveDate = epDate;
        }
      }

      // Calculate streak
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (lastActiveDate) {
        consistency.daysSinceLastSession = Math.floor(
          (today.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      // Count current streak (consecutive days ending today or yesterday)
      let checkDate = new Date(today);
      if (consistency.daysSinceLastSession === 1) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (activeDates.has(dateStr)) {
          consistency.currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Sessions in last 7 days
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      for (const date of activeDates) {
        if (date >= sevenDaysAgoStr) {
          consistency.sessionsLast7Days++;
        }
      }

      consistency.averageSessionsPerWeek = Math.round((activeDates.size / 30) * 7 * 10) / 10;
    } catch (error) {
      console.error('[PredictiveInsightsService] Error analyzing consistency:', error);
    }

    return consistency;
  }

  /**
   * Calculate new item pacing recommendations
   */
  calculateNewItemPacing(profile) {
    const pacePrefs = profile?.inferences?.pacePreferences || {};
    const avgItemsPerSession = pacePrefs.avgItemsPerSession || 15;
    const preferredPace = pacePrefs.preferredPace || 'steady';

    const maxNewItems = PREDICTION_CONSTANTS.OPTIMAL_DAILY_NEW_ITEMS;
    let recommendedNew = Math.min(Math.round(avgItemsPerSession * 0.3), maxNewItems);

    let suggestion = null;
    if (preferredPace === 'marathon') {
      suggestion = `You prefer longer sessions. Adding ${recommendedNew + 5} new items is fine, but ensure you complete reviews first.`;
    } else if (preferredPace === 'burst') {
      suggestion = `Your quick sessions work best with ${recommendedNew} new items max per session.`;
    } else if (recommendedNew > 0) {
      suggestion = `Balance reviews with ${recommendedNew} new items daily to avoid overwhelm.`;
    }

    return {
      recommendedNewItemsPerDay: recommendedNew,
      maxRecommended: maxNewItems,
      preferredPace,
      suggestion,
    };
  }

  /**
   * Calculate break strategy
   */
  calculateBreakStrategy(profile) {
    const sessionPrefs = profile?.inferences?.sessionPreferences || {};
    const focusDecayPoint = sessionPrefs.focusDecayPoint || 25;

    const needsReminder = focusDecayPoint < 20;
    const message = needsReminder
      ? `Your focus drops after ${focusDecayPoint} minutes. Use the Pomodoro technique: study ${focusDecayPoint} min, break 5 min.`
      : `You maintain focus well. Take a 5-minute break every ${Math.min(focusDecayPoint, 30)} minutes.`;

    return {
      needsReminder,
      focusDecayPoint,
      recommendedBreakInterval: Math.min(focusDecayPoint, 30),
      recommendedBreakDuration: 5,
      message,
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Refresh analysis cache if expired
   */
  async refreshAnalysisCache(userId, token) {
    const now = new Date();
    const cacheExpired = !this.lastAnalysisTime ||
      (now.getTime() - this.lastAnalysisTime.getTime()) > this.config.cacheExpiryMinutes * 60 * 1000;

    if (cacheExpired) {
      console.log('[PredictiveInsightsService] Refreshing analysis cache...');

      // Run both analyses in parallel
      const [profileResult, patternsResult] = await Promise.all([
        this.profileInference.inferProfile(userId, token, {
          lookbackDays: this.config.lookbackDays,
        }),
        this.crossConceptAnalyzer.analyze(userId, token, {
          lookbackDays: this.config.lookbackDays,
        }),
      ]);

      this.cachedProfile = profileResult;
      this.cachedPatterns = patternsResult;
      this.lastAnalysisTime = now;
    }
  }

  /**
   * Generate summary of all insights
   */
  generateSummary(scheduling, content, strategy) {
    const criticalCount = [
      ...scheduling.recommendations,
      ...content.recommendations,
      ...strategy.recommendations,
    ].filter((r) => r.priority === PRIORITY.CRITICAL).length;

    const hasOverdue = scheduling.dueItems?.overdueCount > 0;
    const hasWeakConcepts = content.weakConcepts?.length > 0;
    const isCramming = strategy.crammingAnalysis?.isCramming;

    let summaryMessage = '';

    if (criticalCount > 0) {
      summaryMessage = `⚠️ ${criticalCount} urgent issue${criticalCount > 1 ? 's' : ''} need attention.`;
    } else if (hasOverdue) {
      summaryMessage = `📚 ${scheduling.dueItems.overdueCount} overdue items waiting for review.`;
    } else if (hasWeakConcepts) {
      summaryMessage = `🎯 Focus on ${content.weakConcepts.length} concepts that need practice.`;
    } else if (strategy.consistency?.currentStreak >= 7) {
      summaryMessage = `🔥 Amazing ${strategy.consistency.currentStreak}-day streak! Keep it up!`;
    } else {
      summaryMessage = `✅ You're on track. ${scheduling.dueItems?.todayCount || 0} items due today.`;
    }

    return {
      message: summaryMessage,
      criticalIssues: criticalCount,
      overdueCount: scheduling.dueItems?.overdueCount || 0,
      todayCount: scheduling.dueItems?.todayCount || 0,
      weakConceptCount: content.weakConcepts?.length || 0,
      currentStreak: strategy.consistency?.currentStreak || 0,
      isCramming,
    };
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.cachedProfile = null;
    this.cachedPatterns = null;
    this.lastAnalysisTime = null;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

module.exports = PredictiveInsightsService;
module.exports.RECOMMENDATION_TYPES = RECOMMENDATION_TYPES;
module.exports.PRIORITY = PRIORITY;
module.exports.PREDICTION_CONSTANTS = PREDICTION_CONSTANTS;
