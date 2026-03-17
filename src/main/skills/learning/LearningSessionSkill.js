/**
 * LearningSessionSkill - Manage learning sessions
 *
 * This skill handles the complete lifecycle of learning sessions:
 * - Start new sessions
 * - Record item-level performance
 * - Update session progress
 * - Complete sessions
 * - Get session statistics and feedback
 *
 * Integrates with the LearningSessionManager for persistence.
 */

const BaseSkill = require('../BaseSkill');

// Session types aligned with domain types
const SESSION_TYPES = {
  REVIEW: 'review',
  LEARN_NEW: 'learn_new',
  MIXED: 'mixed',
  QUIZ: 'quiz',
  PRACTICE: 'practice',
  ASSESSMENT: 'assessment',
};

// Performance feedback thresholds
const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 0.9,
  GOOD: 0.75,
  FAIR: 0.6,
  NEEDS_WORK: 0.4,
};

class LearningSessionSkill extends BaseSkill {
  static get name() {
    return 'manage_learning_session';
  }

  static get description() {
    return 'Manage learning sessions: start, record item performance, update progress, complete, and get statistics. Handles the complete session lifecycle for all learning domain types.';
  }

  static get parameters() {
    return {
      action: {
        type: 'string',
        enum: [
          'start',
          'record_item',
          'update_progress',
          'complete',
          'get_session',
          'get_statistics',
          'get_feedback',
          'get_weak_items',
        ],
        description: 'The action to perform',
      },
      sessionId: {
        type: 'string',
        description: 'Session ID (required for most actions except start)',
      },
      topicId: {
        type: 'string',
        description: 'Learning topic ID (required for start)',
      },
      planId: {
        type: 'string',
        description: 'Optional learning plan ID',
      },
      sessionType: {
        type: 'string',
        enum: Object.values(SESSION_TYPES),
        default: SESSION_TYPES.MIXED,
        description: 'Type of learning session',
      },
      itemPerformance: {
        type: 'object',
        description: 'Item performance data: { itemId, itemType, wasCorrect, responseTimeMs, confidenceLevel, mistakeType, difficultyRating, masteryBefore, masteryAfter }',
      },
      progressUpdate: {
        type: 'object',
        description: 'Progress update: { itemsReviewedIncrement, itemsCorrectIncrement, itemsNewIncrement, sessionData }',
      },
      results: {
        type: 'object',
        description: 'Session results for completion: { itemsReviewed, itemsCorrect, itemsNew, sessionData }',
      },
      includeAIFeedback: {
        type: 'boolean',
        default: false,
        description: 'Include AI-generated personalized feedback',
      },
    };
  }

  static get requiredParams() {
    return ['action'];
  }

  static get category() {
    return 'learning';
  }

  async execute(params) {
    const { action } = params;

    switch (action) {
      case 'start':
        return this.startSession(params);
      case 'record_item':
        return this.recordItemPerformance(params);
      case 'update_progress':
        return this.updateProgress(params);
      case 'complete':
        return this.completeSession(params);
      case 'get_session':
        return this.getSession(params);
      case 'get_statistics':
        return this.getSessionStatistics(params);
      case 'get_feedback':
        return this.generateFeedback(params);
      case 'get_weak_items':
        return this.getWeakItems(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Start a new learning session
   */
  async startSession(params) {
    const { topicId, planId, sessionType = SESSION_TYPES.MIXED } = params;

    if (!topicId) {
      throw new Error('topicId is required for start action');
    }

    const sessionData = {
      planId,
      topicId,
      sessionType,
      startedAt: new Date().toISOString(),
      itemResults: [],
      performanceSnapshots: [],
    };

    // Generate session ID
    const sessionId = this.generateSessionId();

    // Calculate recommended items based on session type
    const recommendations = this.getSessionRecommendations(sessionType);

    this.logExecution(
      { action: 'start', topicId, sessionType },
      { sessionId }
    );

    return {
      success: true,
      session: {
        id: sessionId,
        ...sessionData,
        status: 'active',
      },
      recommendations,
      message: `Learning session started. ${recommendations.message}`,
    };
  }

  /**
   * Record individual item performance
   */
  async recordItemPerformance(params) {
    const { sessionId, topicId, itemPerformance } = params;

    if (!sessionId || !itemPerformance) {
      throw new Error('sessionId and itemPerformance are required for record_item action');
    }

    const {
      itemId,
      itemType = 'unknown',
      wasCorrect,
      responseTimeMs,
      confidenceLevel,
      mistakeType,
      difficultyRating,
      masteryBefore,
      masteryAfter,
    } = itemPerformance;

    if (!itemId || wasCorrect === undefined) {
      throw new Error('itemId and wasCorrect are required in itemPerformance');
    }

    // Calculate mastery change if not provided
    const calculatedMasteryAfter = masteryAfter !== undefined
      ? masteryAfter
      : this.calculateMasteryChange(masteryBefore || 0, wasCorrect, responseTimeMs);

    const performanceRecord = {
      itemId,
      itemType,
      wasCorrect,
      responseTimeMs: responseTimeMs || null,
      confidenceLevel: confidenceLevel || null,
      mistakeType: wasCorrect ? null : (mistakeType || 'unknown'),
      difficultyRating: difficultyRating || null,
      masteryBefore: masteryBefore || 0,
      masteryAfter: calculatedMasteryAfter,
      sessionId,
      topicId,
      recordedAt: new Date().toISOString(),
    };

    // Provide immediate feedback
    const immediateFeedback = this.generateImmediateFeedback(performanceRecord);

    this.logExecution(
      { action: 'record_item', sessionId, itemId },
      { wasCorrect, masteryChange: calculatedMasteryAfter - (masteryBefore || 0) }
    );

    return {
      success: true,
      performanceRecord,
      immediateFeedback,
      masteryChange: {
        before: masteryBefore || 0,
        after: calculatedMasteryAfter,
        change: calculatedMasteryAfter - (masteryBefore || 0),
      },
    };
  }

  /**
   * Update session progress incrementally
   */
  async updateProgress(params) {
    const { sessionId, progressUpdate } = params;

    if (!sessionId || !progressUpdate) {
      throw new Error('sessionId and progressUpdate are required for update_progress action');
    }

    const {
      itemsReviewedIncrement = 0,
      itemsCorrectIncrement = 0,
      itemsNewIncrement = 0,
      sessionData,
    } = progressUpdate;

    const update = {
      sessionId,
      timestamp: new Date().toISOString(),
      increments: {
        itemsReviewed: itemsReviewedIncrement,
        itemsCorrect: itemsCorrectIncrement,
        itemsNew: itemsNewIncrement,
      },
      additionalData: sessionData || {},
    };

    // Calculate running accuracy
    const runningAccuracy = itemsReviewedIncrement > 0
      ? itemsCorrectIncrement / itemsReviewedIncrement
      : null;

    this.logExecution(
      { action: 'update_progress', sessionId },
      { reviewed: itemsReviewedIncrement, accuracy: runningAccuracy }
    );

    return {
      success: true,
      update,
      runningAccuracy,
    };
  }

  /**
   * Complete a learning session
   */
  async completeSession(params) {
    const { sessionId, topicId, results, includeAIFeedback = false } = params;

    if (!sessionId) {
      throw new Error('sessionId is required for complete action');
    }

    const {
      itemsReviewed = 0,
      itemsCorrect = 0,
      itemsNew = 0,
      sessionData = {},
    } = results || {};

    const completedAt = new Date().toISOString();
    const startedAt = sessionData.startedAt || completedAt;
    const durationMinutes = this.calculateDuration(startedAt, completedAt);

    // Calculate session metrics
    const accuracy = itemsReviewed > 0 ? itemsCorrect / itemsReviewed : 0;
    const performance = this.classifyPerformance(accuracy);

    const sessionSummary = {
      sessionId,
      topicId,
      completedAt,
      durationMinutes,
      itemsReviewed,
      itemsCorrect,
      itemsNew,
      accuracy: Math.round(accuracy * 100) / 100,
      performance,
      sessionData,
    };

    // Check for achievements
    const achievements = this.checkSessionAchievements(sessionSummary);

    // Generate feedback
    let feedback = this.generateSessionFeedback(sessionSummary);

    // Add AI feedback if requested
    if (includeAIFeedback) {
      const aiFeedback = await this.generateAIFeedback(sessionSummary);
      if (aiFeedback) {
        feedback = { ...feedback, aiFeedback };
      }
    }

    // Generate next session suggestions
    const nextSessionSuggestions = this.suggestNextSession(sessionSummary);

    this.logExecution(
      { action: 'complete', sessionId },
      { accuracy, performance, achievements: achievements.length }
    );

    return {
      success: true,
      summary: sessionSummary,
      achievements,
      feedback,
      nextSessionSuggestions,
    };
  }

  /**
   * Get session details
   */
  async getSession(params) {
    const { sessionId } = params;

    if (!sessionId) {
      throw new Error('sessionId is required for get_session action');
    }

    // This would normally fetch from database
    // For skill execution, we return a structure that can be populated
    return {
      success: true,
      sessionId,
      message: 'Use LearningSessionManager.getLearningSessionById() for full session data',
    };
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(params) {
    const { sessionId, topicId } = params;

    // Build statistics query context
    const statsContext = {
      sessionId,
      topicId,
      requestedAt: new Date().toISOString(),
    };

    // If session data is provided in results, calculate stats
    const { results } = params;
    if (results) {
      const { itemsReviewed = 0, itemsCorrect = 0, itemsNew = 0 } = results;
      const accuracy = itemsReviewed > 0 ? itemsCorrect / itemsReviewed : 0;

      return {
        success: true,
        statistics: {
          itemsReviewed,
          itemsCorrect,
          itemsNew,
          accuracy: Math.round(accuracy * 100),
          performance: this.classifyPerformance(accuracy),
          metrics: {
            correctRate: Math.round(accuracy * 100),
            newItemsLearned: itemsNew,
            retentionEstimate: this.estimateRetention(accuracy, itemsReviewed),
          },
        },
        context: statsContext,
      };
    }

    return {
      success: true,
      context: statsContext,
      message: 'Provide results parameter for inline statistics, or use LearningSessionManager for database stats',
    };
  }

  /**
   * Generate session feedback
   */
  async generateFeedback(params) {
    const { sessionId, results, includeAIFeedback = false } = params;

    if (!results) {
      return {
        success: false,
        error: 'results are required for get_feedback action',
      };
    }

    const { itemsReviewed = 0, itemsCorrect = 0, itemsNew = 0 } = results;
    const accuracy = itemsReviewed > 0 ? itemsCorrect / itemsReviewed : 0;
    const performance = this.classifyPerformance(accuracy);

    const feedback = {
      performance,
      accuracy: Math.round(accuracy * 100),
      message: this.getPerformanceMessage(performance, itemsReviewed),
      tips: this.getImprovementTips(performance, accuracy, itemsNew),
      encouragement: this.getEncouragement(performance),
    };

    if (includeAIFeedback) {
      const sessionSummary = {
        itemsReviewed,
        itemsCorrect,
        itemsNew,
        accuracy,
        performance,
      };
      const aiFeedback = await this.generateAIFeedback(sessionSummary);
      if (aiFeedback) {
        feedback.aiFeedback = aiFeedback;
      }
    }

    return {
      success: true,
      feedback,
    };
  }

  /**
   * Get weak items that need more practice
   */
  async getWeakItems(params) {
    const { topicId } = params;

    if (!topicId) {
      throw new Error('topicId is required for get_weak_items action');
    }

    // This provides the query structure - actual data comes from database
    return {
      success: true,
      topicId,
      query: {
        type: 'weak_items',
        criteria: {
          minReviews: 2,
          maxAccuracy: 0.6,
          orderBy: ['accuracy ASC', 'mastery ASC'],
        },
      },
      message: 'Use LearningSessionManager.getWeakItems() for actual data',
    };
  }

  // =============================================================================
  // Helper methods
  // =============================================================================

  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${randomPart}`;
  }

  getSessionRecommendations(sessionType) {
    const recommendations = {
      [SESSION_TYPES.REVIEW]: {
        message: 'Focus on reviewing previously learned items.',
        targetItems: 20,
        newItemRatio: 0,
        focusAreas: ['retention', 'speed'],
      },
      [SESSION_TYPES.LEARN_NEW]: {
        message: 'Ready to learn new content!',
        targetItems: 15,
        newItemRatio: 1,
        focusAreas: ['comprehension', 'initial_encoding'],
      },
      [SESSION_TYPES.MIXED]: {
        message: 'Balanced session with review and new items.',
        targetItems: 20,
        newItemRatio: 0.3,
        focusAreas: ['balance', 'progression'],
      },
      [SESSION_TYPES.QUIZ]: {
        message: 'Quiz mode - test your knowledge!',
        targetItems: 10,
        newItemRatio: 0,
        focusAreas: ['accuracy', 'recall'],
      },
      [SESSION_TYPES.PRACTICE]: {
        message: 'Practice session for skill improvement.',
        targetItems: 25,
        newItemRatio: 0.2,
        focusAreas: ['fluency', 'application'],
      },
      [SESSION_TYPES.ASSESSMENT]: {
        message: 'Assessment session to measure progress.',
        targetItems: 15,
        newItemRatio: 0,
        focusAreas: ['accuracy', 'completeness'],
      },
    };

    return recommendations[sessionType] || recommendations[SESSION_TYPES.MIXED];
  }

  calculateMasteryChange(masteryBefore, wasCorrect, responseTimeMs) {
    let change = 0;

    if (wasCorrect) {
      // Correct: increase mastery
      change = 0.1;

      // Bonus for fast response (under 3 seconds)
      if (responseTimeMs && responseTimeMs < 3000) {
        change += 0.05;
      }

      // Reduced gains at high mastery (diminishing returns)
      if (masteryBefore > 0.8) {
        change *= 0.5;
      }
    } else {
      // Incorrect: decrease mastery
      change = -0.15;

      // Less penalty at low mastery
      if (masteryBefore < 0.3) {
        change *= 0.5;
      }
    }

    // Ensure mastery stays in [0, 1] range
    return Math.max(0, Math.min(1, masteryBefore + change));
  }

  generateImmediateFeedback(performanceRecord) {
    const { wasCorrect, responseTimeMs, masteryAfter, masteryBefore } = performanceRecord;
    const masteryChange = masteryAfter - masteryBefore;

    if (wasCorrect) {
      let message = 'Correct!';
      let emoji = '✓';

      if (responseTimeMs && responseTimeMs < 2000) {
        message = 'Excellent! Quick and correct!';
        emoji = '⚡';
      } else if (masteryChange > 0.1) {
        message = 'Great job! Good progress!';
        emoji = '🌟';
      }

      return { type: 'success', message, emoji, masteryChange };
    }

    let message = 'Not quite. Keep practicing!';
    let emoji = '○';

    if (masteryBefore > 0.7) {
      message = 'Missed this one. Review needed.';
      emoji = '⟳';
    }

    return { type: 'incorrect', message, emoji, masteryChange };
  }

  calculateDuration(startedAt, completedAt) {
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  classifyPerformance(accuracy) {
    if (accuracy >= PERFORMANCE_THRESHOLDS.EXCELLENT) return 'excellent';
    if (accuracy >= PERFORMANCE_THRESHOLDS.GOOD) return 'good';
    if (accuracy >= PERFORMANCE_THRESHOLDS.FAIR) return 'fair';
    if (accuracy >= PERFORMANCE_THRESHOLDS.NEEDS_WORK) return 'needs_work';
    return 'struggling';
  }

  checkSessionAchievements(summary) {
    const achievements = [];
    const { itemsReviewed, accuracy, itemsNew, durationMinutes } = summary;

    // Perfect session
    if (itemsReviewed >= 10 && accuracy >= 1) {
      achievements.push({
        type: 'perfect_session',
        title: 'Perfect Session!',
        description: 'All items correct',
        icon: '🌟',
        rarity: 'rare',
      });
    }

    // High volume
    if (itemsReviewed >= 50) {
      achievements.push({
        type: 'marathon',
        title: 'Marathon Learner',
        description: '50+ items reviewed',
        icon: '🏃',
        rarity: 'uncommon',
      });
    }

    // New content master
    if (itemsNew >= 20 && accuracy >= 0.8) {
      achievements.push({
        type: 'quick_learner',
        title: 'Quick Learner',
        description: 'Learned 20+ new items with high accuracy',
        icon: '🚀',
        rarity: 'rare',
      });
    }

    // Focused session
    if (durationMinutes >= 30 && accuracy >= 0.75) {
      achievements.push({
        type: 'focused',
        title: 'Deep Focus',
        description: '30+ minutes of effective learning',
        icon: '🎯',
        rarity: 'uncommon',
      });
    }

    // Early bird (before 8am - would need actual time checking)
    // Night owl (after 10pm - would need actual time checking)

    return achievements;
  }

  generateSessionFeedback(summary) {
    const { accuracy, performance, itemsReviewed, itemsNew, durationMinutes } = summary;

    return {
      summary: this.getPerformanceMessage(performance, itemsReviewed),
      stats: {
        accuracy: `${Math.round(accuracy * 100)}%`,
        reviewed: itemsReviewed,
        newLearned: itemsNew,
        duration: `${durationMinutes} min`,
      },
      highlights: this.getSessionHighlights(summary),
      areas_for_improvement: this.getAreasForImprovement(summary),
    };
  }

  getPerformanceMessage(performance, itemsReviewed) {
    const messages = {
      excellent: [
        'Outstanding performance! You\'re mastering this material.',
        'Excellent work! Your knowledge is solid.',
        'Amazing session! Keep up the great work!',
      ],
      good: [
        'Good job! You\'re making solid progress.',
        'Nice work! Keep building on this momentum.',
        'Well done! Your efforts are paying off.',
      ],
      fair: [
        'Decent session. Some areas need more practice.',
        'Making progress. Focus on the challenging items.',
        'Good effort! Review the items you missed.',
      ],
      needs_work: [
        'Keep practicing! Learning takes time.',
        'Don\'t give up! Each session builds understanding.',
        'Focus on fundamentals. You\'ll improve with practice.',
      ],
      struggling: [
        'This topic is challenging. Consider reviewing basics.',
        'Take it slow. Focus on understanding over speed.',
        'Break it down into smaller pieces. You can do this!',
      ],
    };

    const messageList = messages[performance] || messages.fair;
    return messageList[Math.floor(Math.random() * messageList.length)];
  }

  getSessionHighlights(summary) {
    const highlights = [];
    const { accuracy, itemsReviewed, itemsNew, durationMinutes } = summary;

    if (accuracy >= 0.9) {
      highlights.push('High accuracy - excellent retention!');
    }
    if (itemsNew >= 10) {
      highlights.push(`Learned ${itemsNew} new items`);
    }
    if (durationMinutes >= 20) {
      highlights.push('Sustained focus session');
    }
    if (itemsReviewed >= 30) {
      highlights.push('High volume review completed');
    }

    return highlights.length > 0 ? highlights : ['Session completed'];
  }

  getAreasForImprovement(summary) {
    const areas = [];
    const { accuracy, itemsReviewed, durationMinutes } = summary;

    if (accuracy < 0.7) {
      areas.push('Review items you got wrong');
    }
    if (itemsReviewed < 10 && durationMinutes < 10) {
      areas.push('Try longer sessions for better retention');
    }
    if (accuracy < 0.5) {
      areas.push('Consider reviewing foundational concepts');
    }

    return areas;
  }

  getImprovementTips(performance, accuracy, itemsNew) {
    const tips = [];

    if (performance === 'struggling' || performance === 'needs_work') {
      tips.push('Try using spaced repetition - review items just before you forget them');
      tips.push('Break complex topics into smaller, manageable pieces');
    }

    if (accuracy < 0.7) {
      tips.push('Focus on understanding why you got items wrong');
      tips.push('Consider creating associations or mnemonics');
    }

    if (itemsNew > 20 && accuracy < 0.8) {
      tips.push('Slow down on new items - quality over quantity');
    }

    if (tips.length === 0) {
      tips.push('Keep up the good work! Consistency is key.');
    }

    return tips;
  }

  getEncouragement(performance) {
    const encouragements = {
      excellent: '🌟 You\'re on fire! Keep this momentum going!',
      good: '💪 Great progress! You\'re getting better every day.',
      fair: '👍 Every session counts. You\'re building knowledge!',
      needs_work: '🌱 Learning is a journey. You\'re moving forward!',
      struggling: '❤️ Don\'t give up! Every expert was once a beginner.',
    };

    return encouragements[performance] || encouragements.fair;
  }

  suggestNextSession(summary) {
    const { accuracy, performance, itemsReviewed, itemsNew } = summary;

    const suggestions = {
      sessionType: SESSION_TYPES.MIXED,
      targetItems: 20,
      focus: [],
      waitTime: null,
    };

    if (accuracy < 0.6) {
      suggestions.sessionType = SESSION_TYPES.REVIEW;
      suggestions.focus.push('Review items from this session');
      suggestions.targetItems = Math.ceil(itemsReviewed * 0.5);
      suggestions.waitTime = 'Soon - within a few hours';
    } else if (accuracy >= 0.9 && performance === 'excellent') {
      suggestions.sessionType = SESSION_TYPES.LEARN_NEW;
      suggestions.focus.push('Ready for new content!');
      suggestions.targetItems = 15;
      suggestions.waitTime = 'Tomorrow';
    } else {
      suggestions.sessionType = SESSION_TYPES.MIXED;
      suggestions.focus.push('Balance review with new items');
      suggestions.targetItems = 20;
      suggestions.waitTime = 'Tomorrow';
    }

    // Add specific focus based on performance
    if (itemsNew > 15) {
      suggestions.focus.push('Reinforce newly learned items');
    }

    return suggestions;
  }

  estimateRetention(accuracy, itemsReviewed) {
    // Simple retention estimate based on accuracy
    // Higher accuracy = better encoding = better retention
    const baseRetention = accuracy * 0.8;
    const volumeBonus = Math.min(0.1, itemsReviewed / 100);
    return Math.round((baseRetention + volumeBonus) * 100);
  }

  async generateAIFeedback(sessionSummary) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) return null;

    try {
      const prompt = `Provide brief, encouraging feedback for this learning session:

Session Results:
- Items Reviewed: ${sessionSummary.itemsReviewed}
- Accuracy: ${Math.round(sessionSummary.accuracy * 100)}%
- New Items Learned: ${sessionSummary.itemsNew}
- Performance Level: ${sessionSummary.performance}

Provide feedback as JSON:
{
  "personalizedMessage": "2-3 sentences of encouraging, specific feedback",
  "learningTip": "One actionable tip for improvement",
  "motivationalNote": "Brief motivational message"
}`;

      const response = await aiProvider.generateContentWithJson(prompt);

      if (response?.personalizedMessage) {
        return response;
      }
    } catch (error) {
      console.error('[LearningSessionSkill] AI feedback generation failed:', error);
    }

    return null;
  }
}

module.exports = LearningSessionSkill;
