/**
 * LearningPlanProgressSkill - Track and update learning plan progress
 *
 * This skill handles progress tracking, phase transitions, milestone
 * completion, and adaptive plan adjustments based on learner performance.
 *
 * Features:
 * - Update daily/session progress
 * - Check and trigger phase transitions
 * - Track milestone achievements
 * - Calculate statistics and projections
 * - Suggest plan adjustments based on performance
 */

const BaseSkill = require('../BaseSkill');

class LearningPlanProgressSkill extends BaseSkill {
  static get name() {
    return 'update_plan_progress';
  }

  static get description() {
    return 'Update learning plan progress, check milestone completion, handle phase transitions, and calculate statistics. Can also suggest plan adjustments based on performance.';
  }

  static get parameters() {
    return {
      action: {
        type: 'string',
        enum: ['record_session', 'check_progress', 'advance_phase', 'complete_milestone', 'get_statistics', 'suggest_adjustments'],
        description: 'The action to perform',
      },
      planId: {
        type: 'string',
        description: 'The learning plan ID',
      },
      topicId: {
        type: 'string',
        description: 'The learning topic ID',
      },
      sessionData: {
        type: 'object',
        description: 'Session data for record_session action: { itemsReviewed, itemsCorrect, itemsNew, durationMinutes, sessionType }',
      },
      milestoneId: {
        type: 'string',
        description: 'Milestone ID for complete_milestone action',
      },
      currentPlan: {
        type: 'object',
        description: 'Current plan data (if not fetching from database)',
      },
      performanceHistory: {
        type: 'array',
        description: 'Recent performance data for adjustments',
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
      case 'record_session':
        return this.recordSession(params);
      case 'check_progress':
        return this.checkProgress(params);
      case 'advance_phase':
        return this.advancePhase(params);
      case 'complete_milestone':
        return this.completeMilestone(params);
      case 'get_statistics':
        return this.getStatistics(params);
      case 'suggest_adjustments':
        return this.suggestAdjustments(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Record a learning session and update progress
   */
  async recordSession(params) {
    const { planId, topicId, sessionData, currentPlan } = params;

    if (!sessionData) {
      throw new Error('sessionData is required for record_session action');
    }

    const {
      itemsReviewed = 0,
      itemsCorrect = 0,
      itemsNew = 0,
      durationMinutes = 0,
      sessionType = 'review',
    } = sessionData;

    // Calculate session metrics
    const accuracy = itemsReviewed > 0 ? itemsCorrect / itemsReviewed : 0;
    const timestamp = new Date().toISOString();

    // Build progress update
    const progressUpdate = {
      planId,
      topicId,
      session: {
        timestamp,
        type: sessionType,
        itemsReviewed,
        itemsCorrect,
        itemsNew,
        durationMinutes,
        accuracy,
      },
      cumulativeUpdates: {
        totalSessionsCompleted: 1,  // Increment
        totalItemsReviewed: itemsReviewed,
        totalItemsCorrect: itemsCorrect,
        totalItemsNew: itemsNew,
        totalTimeMinutes: durationMinutes,
      },
    };

    // Check for achievements
    const achievements = this.checkAchievements(sessionData, currentPlan);

    // Check if phase completion criteria met
    const phaseCheck = currentPlan
      ? this.checkPhaseCompletion(currentPlan, progressUpdate)
      : null;

    // Check milestones
    const milestoneCheck = currentPlan
      ? this.checkMilestoneProgress(currentPlan, progressUpdate)
      : null;

    this.logExecution(
      { action: 'record_session', planId, sessionType },
      { accuracy, achievements: achievements.length }
    );

    return {
      success: true,
      progressUpdate,
      achievements,
      phaseCheck,
      milestoneCheck,
      nextSessionSuggestion: this.suggestNextSession(sessionData, currentPlan),
    };
  }

  /**
   * Check overall progress status
   */
  async checkProgress(params) {
    const { planId, topicId, currentPlan } = params;

    if (!currentPlan) {
      return {
        success: false,
        error: 'currentPlan is required for check_progress action',
      };
    }

    const { planData, currentPhase, currentDay } = currentPlan;
    const { phases, milestones, estimatedDuration } = planData;

    // Calculate overall progress
    const dayProgress = currentDay / estimatedDuration;
    const phaseProgress = currentPhase / phases.length;

    // Get current phase details
    const currentPhaseData = phases[currentPhase - 1];
    const phaseDay = currentDay - (currentPhaseData?.startDay || 1) + 1;
    const phaseDayProgress = phaseDay / (currentPhaseData?.durationDays || 1);

    // Check streak
    const streak = this.calculateStreak(currentPlan);

    // Check upcoming milestones
    const upcomingMilestones = milestones
      .filter(m => m.targetDay >= currentDay && !m.completed)
      .slice(0, 3);

    // Check if on track
    const onTrack = this.isOnTrack(currentPlan);

    return {
      success: true,
      progress: {
        currentDay,
        totalDays: estimatedDuration,
        dayProgress: Math.round(dayProgress * 100),
        currentPhase,
        totalPhases: phases.length,
        phaseProgress: Math.round(phaseProgress * 100),
        currentPhaseData: {
          name: currentPhaseData?.name,
          dayInPhase: phaseDay,
          phaseDuration: currentPhaseData?.durationDays,
          phaseCompletion: Math.round(phaseDayProgress * 100),
        },
      },
      streak,
      onTrack,
      upcomingMilestones,
      suggestions: onTrack.suggestions,
    };
  }

  /**
   * Advance to the next phase
   */
  async advancePhase(params) {
    const { planId, topicId, currentPlan } = params;

    if (!currentPlan) {
      return {
        success: false,
        error: 'currentPlan is required for advance_phase action',
      };
    }

    const { currentPhase } = currentPlan;
    const { phases } = currentPlan.planData;

    if (currentPhase >= phases.length) {
      return {
        success: false,
        error: 'Already at final phase',
        planComplete: true,
      };
    }

    const nextPhase = currentPhase + 1;
    const nextPhaseData = phases[nextPhase - 1];

    // Generate phase transition summary
    const transitionSummary = {
      previousPhase: {
        number: currentPhase,
        name: phases[currentPhase - 1]?.name,
      },
      newPhase: {
        number: nextPhase,
        name: nextPhaseData?.name,
        description: nextPhaseData?.description,
        goals: nextPhaseData?.goals,
        durationDays: nextPhaseData?.durationDays,
      },
      recommendedActions: this.getPhaseTransitionRecommendations(
        phases[currentPhase - 1],
        nextPhaseData
      ),
    };

    this.logExecution(
      { action: 'advance_phase', planId },
      { from: currentPhase, to: nextPhase }
    );

    return {
      success: true,
      newPhase: nextPhase,
      transitionSummary,
      update: {
        currentPhase: nextPhase,
        currentDay: nextPhaseData.startDay,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Mark a milestone as completed
   */
  async completeMilestone(params) {
    const { planId, milestoneId, currentPlan } = params;

    if (!milestoneId) {
      return {
        success: false,
        error: 'milestoneId is required for complete_milestone action',
      };
    }

    const milestone = currentPlan?.planData?.milestones?.find(
      m => m.id === milestoneId
    );

    if (!milestone) {
      return {
        success: false,
        error: `Milestone not found: ${milestoneId}`,
      };
    }

    const completion = {
      completedAt: new Date().toISOString(),
      reward: milestone.reward,
    };

    // Check for bonus rewards (early completion, high accuracy, etc.)
    const bonusRewards = this.checkBonusRewards(milestone, currentPlan);

    this.logExecution(
      { action: 'complete_milestone', planId, milestoneId },
      { reward: milestone.reward?.type, bonuses: bonusRewards.length }
    );

    return {
      success: true,
      milestone: {
        ...milestone,
        completed: true,
        ...completion,
      },
      bonusRewards,
      celebration: this.generateCelebration(milestone),
    };
  }

  /**
   * Get detailed statistics
   */
  async getStatistics(params) {
    const { planId, topicId, currentPlan, performanceHistory = [] } = params;

    if (!currentPlan) {
      return {
        success: false,
        error: 'currentPlan is required for get_statistics action',
      };
    }

    // Calculate various statistics
    const stats = {
      // Overall progress
      overallProgress: this.calculateOverallProgress(currentPlan),

      // Performance metrics
      performance: this.calculatePerformanceMetrics(performanceHistory),

      // Time statistics
      timeStats: this.calculateTimeStats(currentPlan, performanceHistory),

      // Streak and consistency
      streakStats: this.calculateStreakStats(currentPlan),

      // Phase breakdown
      phaseBreakdown: this.calculatePhaseBreakdown(currentPlan),

      // Projections
      projections: this.calculateProjections(currentPlan, performanceHistory),

      // Comparisons (to goals, to average)
      comparisons: this.calculateComparisons(currentPlan, performanceHistory),
    };

    return {
      success: true,
      statistics: stats,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Suggest plan adjustments based on performance
   */
  async suggestAdjustments(params) {
    const { planId, currentPlan, performanceHistory = [] } = params;

    if (!currentPlan || performanceHistory.length < 3) {
      return {
        success: true,
        suggestions: [],
        message: 'Need more performance data to make suggestions',
      };
    }

    const suggestions = [];

    // Analyze performance trends
    const recentAccuracy = this.calculateRecentAccuracy(performanceHistory);
    const recentPace = this.calculateRecentPace(performanceHistory);
    const consistency = this.calculateConsistency(performanceHistory);

    // Suggest pace adjustments
    if (recentPace.itemsPerDay < currentPlan.planData.dailySchedule.expectedItemsPerDay * 0.7) {
      suggestions.push({
        type: 'pace',
        priority: 'medium',
        title: 'Adjust Daily Goals',
        description: 'You might want to reduce daily item count to maintain quality',
        currentValue: currentPlan.planData.dailySchedule.expectedItemsPerDay,
        suggestedValue: Math.ceil(recentPace.itemsPerDay * 1.1),
        impact: 'May extend completion date but improve retention',
      });
    }

    // Suggest difficulty adjustments
    if (recentAccuracy.average < 0.6) {
      suggestions.push({
        type: 'difficulty',
        priority: 'high',
        title: 'Lower Difficulty Level',
        description: 'Accuracy is below target. Consider easier content.',
        currentValue: currentPlan.planData.difficulty,
        suggestedValue: this.getLowerDifficulty(currentPlan.planData.difficulty),
        impact: 'Improve accuracy and reduce frustration',
      });
    } else if (recentAccuracy.average > 0.95 && recentAccuracy.trend === 'stable') {
      suggestions.push({
        type: 'difficulty',
        priority: 'low',
        title: 'Increase Challenge',
        description: 'You\'re performing excellently! Consider harder content.',
        currentValue: currentPlan.planData.difficulty,
        suggestedValue: this.getHigherDifficulty(currentPlan.planData.difficulty),
        impact: 'Faster learning progression',
      });
    }

    // Suggest schedule adjustments
    if (consistency.missedDays > 3) {
      suggestions.push({
        type: 'schedule',
        priority: 'medium',
        title: 'Adjust Study Schedule',
        description: 'You\'ve missed several days. Consider shorter, more frequent sessions.',
        currentValue: currentPlan.planData.dailySchedule.sessionDurationMinutes,
        suggestedValue: Math.max(10, Math.floor(currentPlan.planData.dailySchedule.sessionDurationMinutes * 0.7)),
        impact: 'Better consistency and habit formation',
      });
    }

    // Suggest focus area adjustments
    const weakAreas = this.identifyWeakAreas(performanceHistory);
    if (weakAreas.length > 0) {
      suggestions.push({
        type: 'focus',
        priority: 'medium',
        title: 'Focus on Weak Areas',
        description: `Consider extra practice on: ${weakAreas.slice(0, 3).join(', ')}`,
        weakAreas,
        impact: 'Address knowledge gaps',
      });
    }

    // Use AI for more personalized suggestions
    if (suggestions.length > 0 && this.getAIProvider()) {
      const aiSuggestions = await this.getAISuggestions(
        currentPlan,
        performanceHistory,
        suggestions
      );
      if (aiSuggestions) {
        suggestions.push(...aiSuggestions);
      }
    }

    this.logExecution(
      { action: 'suggest_adjustments', planId },
      { suggestionsCount: suggestions.length }
    );

    return {
      success: true,
      suggestions: suggestions.sort((a, b) => {
        const priority = { high: 0, medium: 1, low: 2 };
        return priority[a.priority] - priority[b.priority];
      }),
      analysisData: {
        recentAccuracy,
        recentPace,
        consistency,
        weakAreas,
      },
    };
  }

  // =============================================================================
  // Helper methods
  // =============================================================================

  checkAchievements(sessionData, currentPlan) {
    const achievements = [];
    const { itemsCorrect = 0, itemsReviewed = 0 } = sessionData;
    // Calculate accuracy from sessionData if not provided directly
    const accuracy = sessionData.accuracy !== undefined
      ? sessionData.accuracy
      : (itemsReviewed > 0 ? itemsCorrect / itemsReviewed : 0);

    // Perfect session
    if (itemsReviewed >= 10 && accuracy === 1) {
      achievements.push({
        type: 'perfect_session',
        title: 'Perfect Session!',
        description: 'Answered all items correctly',
        icon: 'stars',
      });
    }

    // High volume
    if (itemsReviewed >= 50) {
      achievements.push({
        type: 'marathon_session',
        title: 'Marathon Learner',
        description: 'Reviewed 50+ items in one session',
        icon: 'fitness_center',
      });
    }

    // Quick learner (high accuracy on new items)
    if (sessionData.itemsNew >= 10 && accuracy >= 0.8) {
      achievements.push({
        type: 'quick_learner',
        title: 'Quick Learner',
        description: 'High accuracy on new items',
        icon: 'bolt',
      });
    }

    return achievements;
  }

  checkPhaseCompletion(currentPlan, progressUpdate) {
    const { currentPhase, currentDay } = currentPlan;
    const phase = currentPlan.planData.phases[currentPhase - 1];

    if (!phase) return null;

    const isLastDayOfPhase = currentDay >= phase.endDay;
    const criteria = phase.completionCriteria;

    return {
      isLastDayOfPhase,
      criteriaStatus: {
        day: currentDay,
        phaseEndDay: phase.endDay,
        // Would need actual accumulated stats to check criteria
        suggestAdvance: isLastDayOfPhase,
      },
    };
  }

  checkMilestoneProgress(currentPlan, progressUpdate) {
    const { milestones } = currentPlan.planData;
    const { currentDay } = currentPlan;

    const approaching = milestones.filter(
      m => !m.completed && m.targetDay - currentDay <= 3 && m.targetDay >= currentDay
    );

    const due = milestones.filter(
      m => !m.completed && m.targetDay <= currentDay
    );

    return {
      approaching,
      due,
      completed: milestones.filter(m => m.completed).length,
      total: milestones.length,
    };
  }

  suggestNextSession(sessionData, currentPlan) {
    // Calculate accuracy from sessionData if not provided directly
    const { itemsReviewed = 0, itemsCorrect = 0 } = sessionData;
    const accuracy = sessionData.accuracy !== undefined
      ? sessionData.accuracy
      : (itemsReviewed > 0 ? itemsCorrect / itemsReviewed : 0);

    if (accuracy < 0.6) {
      return {
        type: 'review',
        focus: 'Review items from this session',
        itemCount: Math.ceil(sessionData.itemsReviewed * 0.5),
      };
    }

    if (accuracy >= 0.9) {
      return {
        type: 'learn_new',
        focus: 'Ready for new content!',
        itemCount: 15,
      };
    }

    return {
      type: 'mixed',
      focus: 'Balance of review and new items',
      itemCount: 20,
    };
  }

  calculateStreak(currentPlan) {
    // Simplified - would need session history
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastSessionDate: null,
    };
  }

  isOnTrack(currentPlan) {
    const { currentDay } = currentPlan;
    const { estimatedDuration, phases } = currentPlan.planData;
    const expectedDay = Math.ceil((Date.now() - new Date(currentPlan.startedAt).getTime()) / (1000 * 60 * 60 * 24));

    const daysDiff = currentDay - expectedDay;

    return {
      isOnTrack: daysDiff >= -2,
      daysDiff,
      status: daysDiff >= 0 ? 'ahead' : daysDiff >= -2 ? 'on_track' : 'behind',
      suggestions: daysDiff < -2
        ? ['Consider catching up with extra sessions', 'Review phase goals']
        : [],
    };
  }

  getPhaseTransitionRecommendations(previousPhase, nextPhase) {
    return [
      'Review key concepts from the previous phase',
      `Focus on ${nextPhase?.focusAreas?.join(', ') || 'new material'}`,
      'Set fresh goals for the upcoming phase',
      'Take a short break before starting new content',
    ];
  }

  checkBonusRewards(milestone, currentPlan) {
    const bonuses = [];
    const { currentDay } = currentPlan;

    // Early completion bonus
    if (currentDay < milestone.targetDay) {
      bonuses.push({
        type: 'early_bird',
        title: 'Early Completion!',
        description: `Completed ${milestone.targetDay - currentDay} days early`,
      });
    }

    return bonuses;
  }

  generateCelebration(milestone) {
    const celebrations = {
      phase_complete: {
        emoji: '🎉',
        message: 'Phase Complete!',
        animation: 'confetti',
      },
      checkpoint: {
        emoji: '✅',
        message: 'Checkpoint Reached!',
        animation: 'pulse',
      },
      topic_complete: {
        emoji: '🏆',
        message: 'Topic Mastered!',
        animation: 'fireworks',
      },
    };

    return celebrations[milestone.type] || celebrations.checkpoint;
  }

  calculateOverallProgress(currentPlan) {
    const { currentDay, currentPhase } = currentPlan;
    const { estimatedDuration, phases } = currentPlan.planData;

    return {
      daysCompleted: currentDay,
      totalDays: estimatedDuration,
      percentComplete: Math.round((currentDay / estimatedDuration) * 100),
      phasesCompleted: currentPhase - 1,
      totalPhases: phases.length,
    };
  }

  calculatePerformanceMetrics(performanceHistory) {
    if (performanceHistory.length === 0) {
      return { average: 0, trend: 'stable', best: 0, recent: 0 };
    }

    const accuracies = performanceHistory.map(p => p.accuracy || 0);
    const average = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const recent = accuracies.slice(-5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;

    return {
      average: Math.round(average * 100) / 100,
      trend: recentAvg > average ? 'improving' : recentAvg < average ? 'declining' : 'stable',
      best: Math.max(...accuracies),
      recent: Math.round(recentAvg * 100) / 100,
    };
  }

  calculateTimeStats(currentPlan, performanceHistory) {
    const totalMinutes = performanceHistory.reduce(
      (sum, p) => sum + (p.durationMinutes || 0), 0
    );

    return {
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      averageSessionMinutes: performanceHistory.length > 0
        ? Math.round(totalMinutes / performanceHistory.length)
        : 0,
      sessionsCompleted: performanceHistory.length,
    };
  }

  calculateStreakStats(currentPlan) {
    // Simplified implementation
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
    };
  }

  calculatePhaseBreakdown(currentPlan) {
    const { phases } = currentPlan.planData;
    const { currentPhase } = currentPlan;

    return phases.map((phase, index) => ({
      phase: index + 1,
      name: phase.name,
      status: index + 1 < currentPhase ? 'completed' :
              index + 1 === currentPhase ? 'in_progress' : 'upcoming',
      durationDays: phase.durationDays,
    }));
  }

  calculateProjections(currentPlan, performanceHistory) {
    const { estimatedDuration } = currentPlan.planData;
    const { currentDay } = currentPlan;
    const daysRemaining = estimatedDuration - currentDay;

    return {
      daysRemaining,
      estimatedCompletionDate: new Date(
        Date.now() + daysRemaining * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0],
      onTrackForDeadline: true,
    };
  }

  calculateComparisons(currentPlan, performanceHistory) {
    return {
      vsGoal: {
        accuracy: { target: 0.8, actual: 0 },
        dailyTime: { target: 30, actual: 0 },
      },
    };
  }

  calculateRecentAccuracy(performanceHistory) {
    const recent = performanceHistory.slice(-10);
    if (recent.length === 0) return { average: 0, trend: 'stable' };

    const accuracies = recent.map(p => p.accuracy || 0);
    const average = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;

    const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2));
    const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);

    return {
      average,
      trend: secondAvg > firstAvg + 0.05 ? 'improving' :
             secondAvg < firstAvg - 0.05 ? 'declining' : 'stable',
    };
  }

  calculateRecentPace(performanceHistory) {
    const recent = performanceHistory.slice(-7);
    const totalItems = recent.reduce((sum, p) => sum + (p.itemsReviewed || 0), 0);

    return {
      itemsPerDay: totalItems / Math.max(1, recent.length),
      sessionsPerDay: recent.length / 7,
    };
  }

  calculateConsistency(performanceHistory) {
    // Simplified - would need actual dates
    return {
      missedDays: 0,
      consecutiveDays: 0,
    };
  }

  identifyWeakAreas(performanceHistory) {
    // Simplified - would need item-level data
    return [];
  }

  getLowerDifficulty(current) {
    const levels = ['beginner', 'elementary', 'intermediate', 'advanced', 'expert'];
    const index = levels.indexOf(current);
    return levels[Math.max(0, index - 1)];
  }

  getHigherDifficulty(current) {
    const levels = ['beginner', 'elementary', 'intermediate', 'advanced', 'expert'];
    const index = levels.indexOf(current);
    return levels[Math.min(levels.length - 1, index + 1)];
  }

  async getAISuggestions(currentPlan, performanceHistory, existingSuggestions) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) return null;

    try {
      const prompt = `Based on this learning plan performance, suggest improvements:

Plan: ${currentPlan.planData.overview}
Current Phase: ${currentPlan.currentPhase} of ${currentPlan.planData.totalPhases}
Current suggestions: ${JSON.stringify(existingSuggestions.slice(0, 2))}

Provide 1-2 additional personalized suggestions as JSON:
{
  "suggestions": [
    {
      "type": "motivational|strategy|resource",
      "priority": "low|medium|high",
      "title": "Short title",
      "description": "Actionable advice"
    }
  ]
}`;

      const response = await aiProvider.generateContentWithJson(prompt);

      if (response?.suggestions) {
        return response.suggestions;
      }
    } catch (error) {
      console.error('[LearningPlanProgressSkill] AI suggestions failed:', error);
    }

    return null;
  }
}

module.exports = LearningPlanProgressSkill;
