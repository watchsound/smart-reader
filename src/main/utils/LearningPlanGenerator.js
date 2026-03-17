/**
 * LearningPlanGenerator.js
 *
 * Service for generating learning plans based on user input.
 * Calculates daily schedules, phases, and milestones based on:
 * - Total learning points
 * - Daily time commitment
 * - Target deadline (optional)
 * - Domain configuration
 *
 * This service does NOT use AI - it performs pure algorithmic calculation.
 * AI is used separately for:
 * - Extracting key concepts from book metadata
 * - Generating learning point content (summaries, cards)
 */

import { DOMAIN_CONFIGS } from '../../commons/model/LearningDomains';

/**
 * Default spaced repetition intervals (days)
 */
const REVIEW_INTERVALS = [1, 1, 3, 7, 14, 30, 60];

/**
 * Phase configurations by domain
 */
const PHASE_CONFIGS = {
  vocabulary: [
    { name: 'Foundation', focusAreas: ['Basic definitions', 'Pronunciation'], newPercent: 60, reviewPercent: 40 },
    { name: 'Building', focusAreas: ['Usage examples', 'Context'], newPercent: 40, reviewPercent: 60 },
    { name: 'Mastery', focusAreas: ['Synonyms', 'Nuances', 'Advanced usage'], newPercent: 20, reviewPercent: 80 },
  ],
  math: [
    { name: 'Concepts', focusAreas: ['Definitions', 'Formulas'], newPercent: 50, reviewPercent: 30, practicePercent: 20 },
    { name: 'Application', focusAreas: ['Problem solving', 'Worked examples'], newPercent: 30, reviewPercent: 40, practicePercent: 30 },
    { name: 'Mastery', focusAreas: ['Complex problems', 'Integration'], newPercent: 20, reviewPercent: 40, practicePercent: 40 },
  ],
  language: [
    { name: 'Foundation', focusAreas: ['Grammar basics', 'Core vocabulary'], newPercent: 50, reviewPercent: 30, practicePercent: 20 },
    { name: 'Building', focusAreas: ['Sentence patterns', 'Reading'], newPercent: 40, reviewPercent: 40, practicePercent: 20 },
    { name: 'Fluency', focusAreas: ['Advanced grammar', 'Writing'], newPercent: 30, reviewPercent: 40, practicePercent: 30 },
  ],
  knowledge: [
    { name: 'Survey', focusAreas: ['Key concepts', 'Overview'], newPercent: 60, reviewPercent: 40 },
    { name: 'Deep Dive', focusAreas: ['Relationships', 'Details'], newPercent: 40, reviewPercent: 60 },
    { name: 'Synthesis', focusAreas: ['Integration', 'Application'], newPercent: 20, reviewPercent: 80 },
  ],
  skill: [
    { name: 'Learn', focusAreas: ['Techniques', 'Examples'], newPercent: 40, reviewPercent: 20, practicePercent: 40 },
    { name: 'Practice', focusAreas: ['Exercises', 'Projects'], newPercent: 20, reviewPercent: 30, practicePercent: 50 },
    { name: 'Master', focusAreas: ['Advanced techniques', 'Real projects'], newPercent: 10, reviewPercent: 30, practicePercent: 60 },
  ],
};

class LearningPlanGenerator {
  /**
   * Generate a learning plan
   *
   * @param {Object} params - Plan parameters
   * @param {number} params.totalItems - Total number of learning points
   * @param {number} params.dailyMinutes - Daily time commitment in minutes
   * @param {string} params.domainType - Domain type (vocabulary, math, etc.)
   * @param {Date} params.targetDate - Optional target completion date
   * @param {string} params.difficulty - Starting difficulty (beginner, intermediate, advanced)
   * @returns {Object} Generated plan data
   */
  generatePlan(params) {
    const {
      totalItems,
      dailyMinutes,
      domainType = 'vocabulary',
      targetDate = null,
      difficulty = 'intermediate',
    } = params;

    // Get domain configuration
    const domainConfig = DOMAIN_CONFIGS[domainType] || DOMAIN_CONFIGS.vocabulary;
    const phaseConfigs = PHASE_CONFIGS[domainType] || PHASE_CONFIGS.knowledge;

    // Calculate items per session based on domain defaults and time
    const baseItemsPerSession = domainConfig.defaultItemsPerSession || 10;
    const baseMinutes = domainConfig.defaultDailyMinutes || 30;
    const timeRatio = dailyMinutes / baseMinutes;

    // Adjust items per day based on time commitment
    const newItemsPerDay = Math.max(1, Math.floor(baseItemsPerSession * timeRatio * 0.4));
    const reviewsPerDay = Math.max(1, Math.floor(baseItemsPerSession * timeRatio * 0.6));

    // Calculate total days needed
    const daysToComplete = Math.ceil(totalItems / newItemsPerDay);

    // Check feasibility against target date
    let feasibility = this.checkFeasibility(daysToComplete, targetDate);

    // Adjust if deadline is too tight
    let adjustedNewItemsPerDay = newItemsPerDay;
    if (feasibility.needsAdjustment && targetDate) {
      const availableDays = feasibility.availableDays;
      adjustedNewItemsPerDay = Math.ceil(totalItems / availableDays);
      feasibility = {
        ...feasibility,
        adjustedNewItemsPerDay,
        adjustedDailyMinutes: Math.ceil(dailyMinutes * (adjustedNewItemsPerDay / newItemsPerDay)),
      };
    }

    // Generate phases
    const phases = this.generatePhases(totalItems, daysToComplete, phaseConfigs);

    // Generate daily schedule template
    const dailySchedule = this.generateDailySchedule(
      dailyMinutes,
      adjustedNewItemsPerDay,
      reviewsPerDay,
      domainType
    );

    // Generate milestones
    const milestones = this.generateMilestones(totalItems, phases);

    // Generate assessment checkpoints
    const assessmentCheckpoints = this.generateAssessmentCheckpoints(phases);

    // Calculate estimated completion date
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + daysToComplete);

    return {
      overview: this.generateOverview(totalItems, daysToComplete, domainType),
      estimatedDuration: daysToComplete,
      totalPhases: phases.length,
      phases,
      dailySchedule,
      milestones,
      assessmentCheckpoints,
      recommendations: this.generateRecommendations(params, feasibility),

      // Calculation details (for display)
      calculation: {
        totalItems,
        dailyMinutes,
        newItemsPerDay: adjustedNewItemsPerDay,
        reviewsPerDay,
        daysToComplete,
        estimatedCompletion: estimatedCompletion.toISOString(),
        feasibility,
      },
    };
  }

  /**
   * Check if the plan is feasible given the target date
   */
  checkFeasibility(daysNeeded, targetDate) {
    if (!targetDate) {
      return {
        isFeasible: true,
        needsAdjustment: false,
        daysNeeded,
      };
    }

    const now = new Date();
    const target = new Date(targetDate);
    const availableDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

    const isFeasible = daysNeeded <= availableDays;
    const needsAdjustment = !isFeasible;

    return {
      isFeasible,
      needsAdjustment,
      daysNeeded,
      availableDays,
      daysShort: needsAdjustment ? daysNeeded - availableDays : 0,
      percentageIncrease: needsAdjustment
        ? Math.round(((daysNeeded / availableDays) - 1) * 100)
        : 0,
    };
  }

  /**
   * Generate phases for the learning plan
   */
  generatePhases(totalItems, totalDays, phaseConfigs) {
    const numPhases = phaseConfigs.length;
    const itemsPerPhase = Math.ceil(totalItems / numPhases);
    const daysPerPhase = Math.ceil(totalDays / numPhases);

    let itemsAssigned = 0;
    let dayStart = 1;

    return phaseConfigs.map((config, index) => {
      const isLastPhase = index === numPhases - 1;
      const phaseItems = isLastPhase
        ? totalItems - itemsAssigned
        : Math.min(itemsPerPhase, totalItems - itemsAssigned);

      const phaseDays = isLastPhase
        ? totalDays - dayStart + 1
        : daysPerPhase;

      const phase = {
        phaseNumber: index + 1,
        name: config.name,
        description: `${config.name} phase focusing on ${config.focusAreas.join(', ')}`,
        durationDays: phaseDays,
        startDay: dayStart,
        endDay: dayStart + phaseDays - 1,
        itemCount: phaseItems,
        focusAreas: config.focusAreas,
        objectives: [
          `Learn ${phaseItems} new items`,
          `Achieve ${60 + index * 15}% retention on phase items`,
          ...config.focusAreas.map(area => `Master ${area.toLowerCase()}`),
        ],
        distribution: {
          newPercent: config.newPercent,
          reviewPercent: config.reviewPercent,
          practicePercent: config.practicePercent || 0,
        },
      };

      itemsAssigned += phaseItems;
      dayStart += phaseDays;

      return phase;
    });
  }

  /**
   * Generate daily schedule template
   */
  generateDailySchedule(dailyMinutes, newItemsPerDay, reviewsPerDay, domainType) {
    const domainConfig = DOMAIN_CONFIGS[domainType] || {};

    // Calculate time allocation
    const newItemsTime = Math.round(dailyMinutes * 0.4);
    const reviewTime = Math.round(dailyMinutes * 0.5);
    const practiceTime = dailyMinutes - newItemsTime - reviewTime;

    return {
      totalMinutes: dailyMinutes,
      recommendedSessions: dailyMinutes <= 30 ? 1 : dailyMinutes <= 60 ? 2 : 3,
      sessionDurationMinutes: Math.round(dailyMinutes / (dailyMinutes <= 30 ? 1 : 2)),

      // Time distribution
      newItemsMinutes: newItemsTime,
      reviewMinutes: reviewTime,
      practiceMinutes: practiceTime,

      // Item counts
      newItemsPerDay,
      reviewsPerDay,

      // Percentages
      newItemsPercent: 40,
      reviewPercent: 50,
      practicePercent: 10,

      // Suggested activities based on domain
      suggestedActivities: this.getSuggestedActivities(domainType),
    };
  }

  /**
   * Get suggested activities by domain
   */
  getSuggestedActivities(domainType) {
    const activities = {
      vocabulary: [
        'Study new word definitions',
        'Review flashcards',
        'Practice with example sentences',
        'Quiz yourself on synonyms/antonyms',
      ],
      math: [
        'Learn new formulas',
        'Review worked examples',
        'Solve practice problems',
        'Check understanding with quizzes',
      ],
      language: [
        'Study grammar rules',
        'Vocabulary review',
        'Reading practice',
        'Writing exercises',
      ],
      knowledge: [
        'Read new concepts',
        'Review key points',
        'Make connections between ideas',
        'Test recall with questions',
      ],
      skill: [
        'Learn new techniques',
        'Review examples',
        'Hands-on practice',
        'Build mini-projects',
      ],
    };

    return activities[domainType] || activities.knowledge;
  }

  /**
   * Generate milestones
   */
  generateMilestones(totalItems, phases) {
    const milestones = [];

    // Milestone for each phase completion
    phases.forEach((phase, index) => {
      milestones.push({
        id: `milestone_phase_${index + 1}`,
        name: `Complete ${phase.name} Phase`,
        description: `Finish all ${phase.name.toLowerCase()} phase objectives`,
        targetDay: phase.endDay,
        targetPhase: phase.phaseNumber,
        criteria: {
          itemsMastered: Math.round(phase.itemCount * 0.6),
          conceptsCovered: phase.itemCount,
        },
        reward: `🏆 ${phase.name} Champion`,
        completed: false,
      });
    });

    // Progress milestones
    const progressPoints = [25, 50, 75, 100];
    progressPoints.forEach(percent => {
      const itemCount = Math.round(totalItems * percent / 100);
      milestones.push({
        id: `milestone_progress_${percent}`,
        name: `${percent}% Complete`,
        description: `Master ${itemCount} learning points`,
        criteria: {
          itemsMastered: itemCount,
        },
        reward: percent === 100 ? '🎉 Course Complete!' : `⭐ ${percent}% Progress`,
        completed: false,
      });
    });

    // Streak milestones
    [7, 14, 30].forEach(days => {
      milestones.push({
        id: `milestone_streak_${days}`,
        name: `${days}-Day Streak`,
        description: `Study for ${days} consecutive days`,
        criteria: {
          streakDays: days,
        },
        reward: `🔥 ${days}-Day Streak`,
        completed: false,
      });
    });

    return milestones;
  }

  /**
   * Generate assessment checkpoints
   */
  generateAssessmentCheckpoints(phases) {
    const checkpoints = [];

    phases.forEach((phase, index) => {
      // Mid-phase review
      if (phase.durationDays > 7) {
        checkpoints.push({
          day: phase.startDay + Math.floor(phase.durationDays / 2),
          phase: phase.phaseNumber,
          type: 'review',
          assessmentMethods: ['flashcard_review', 'quick_quiz'],
          passingScore: 60,
          description: `Mid-phase review for ${phase.name}`,
        });
      }

      // End-of-phase quiz
      checkpoints.push({
        day: phase.endDay,
        phase: phase.phaseNumber,
        type: 'quiz',
        assessmentMethods: ['quiz', 'flashcard_review'],
        passingScore: 70,
        description: `${phase.name} phase completion assessment`,
      });
    });

    // Final comprehensive assessment
    const lastPhase = phases[phases.length - 1];
    checkpoints.push({
      day: lastPhase.endDay,
      phase: lastPhase.phaseNumber,
      type: 'comprehensive',
      assessmentMethods: ['quiz', 'review', 'application'],
      passingScore: 80,
      description: 'Final comprehensive assessment',
    });

    return checkpoints;
  }

  /**
   * Generate overview text
   */
  generateOverview(totalItems, daysToComplete, domainType) {
    const weeks = Math.ceil(daysToComplete / 7);
    const domainName = domainType.charAt(0).toUpperCase() + domainType.slice(1);

    return `A ${weeks}-week ${domainName.toLowerCase()} learning plan covering ${totalItems} learning points. ` +
      `The plan is structured in phases, progressing from foundational concepts to mastery. ` +
      `Daily practice sessions include new material, reviews, and reinforcement activities.`;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(params, feasibility) {
    const recommendations = [];

    // Time-based recommendations
    if (params.dailyMinutes < 15) {
      recommendations.push('Consider increasing daily study time to at least 15 minutes for better retention.');
    } else if (params.dailyMinutes > 120) {
      recommendations.push('Long study sessions may lead to fatigue. Consider splitting into multiple shorter sessions.');
    }

    // Feasibility recommendations
    if (feasibility.needsAdjustment) {
      recommendations.push(
        `Your deadline is ambitious. You\'ll need to study ${feasibility.percentageIncrease}% more intensively than the default pace.`
      );
      if (feasibility.adjustedDailyMinutes) {
        recommendations.push(
          `Consider increasing daily time to ${feasibility.adjustedDailyMinutes} minutes to meet your deadline.`
        );
      }
    }

    // Domain-specific recommendations
    const domainRecs = {
      vocabulary: [
        'Use spaced repetition consistently for best retention.',
        'Practice words in context, not just definitions.',
      ],
      math: [
        'Don\'t just read - solve problems actively.',
        'Review mistakes to understand where you went wrong.',
      ],
      language: [
        'Practice all four skills: reading, writing, listening, speaking.',
        'Immerse yourself in native content when possible.',
      ],
      knowledge: [
        'Connect new concepts to what you already know.',
        'Teach concepts to others to reinforce learning.',
      ],
      skill: [
        'Practice is more important than passive learning.',
        'Build real projects to apply what you learn.',
      ],
    };

    recommendations.push(...(domainRecs[params.domainType] || domainRecs.knowledge));

    // General recommendations
    recommendations.push('Consistent daily practice beats occasional intensive sessions.');

    return recommendations;
  }

  /**
   * Distribute learning points across phases and days
   *
   * @param {Array} learningPoints - Array of learning points to schedule
   * @param {Object} planData - Generated plan data
   * @returns {Array} Learning points with scheduledDay and phase assigned
   */
  distributeLearningPoints(learningPoints, planData) {
    const { phases, dailySchedule } = planData;
    const newItemsPerDay = dailySchedule.newItemsPerDay;

    let currentDay = 1;
    let currentPhase = 0;
    let itemsInCurrentDay = 0;

    return learningPoints.map((lp, index) => {
      // Move to next day if current day is full
      if (itemsInCurrentDay >= newItemsPerDay) {
        currentDay++;
        itemsInCurrentDay = 0;
      }

      // Move to next phase if we've passed the phase end day
      while (currentPhase < phases.length - 1 &&
             currentDay > phases[currentPhase].endDay) {
        currentPhase++;
      }

      itemsInCurrentDay++;

      return {
        ...lp,
        scheduledDay: currentDay,
        phase: phases[currentPhase].phaseNumber,
        status: 'pending',
        masteryLevel: 0,
        reviewCount: 0,
        correctStreak: 0,
      };
    });
  }

  /**
   * Calculate review schedule for a learning point based on spaced repetition
   *
   * @param {number} correctStreak - Number of consecutive correct answers
   * @param {boolean} wasCorrect - Whether the last answer was correct
   * @returns {Object} Next review info
   */
  calculateNextReview(correctStreak, wasCorrect) {
    let intervalDays;

    if (!wasCorrect) {
      // Reset to 1 day on incorrect
      intervalDays = 1;
    } else {
      // Use predefined intervals
      const intervalIndex = Math.min(correctStreak, REVIEW_INTERVALS.length - 1);
      intervalDays = REVIEW_INTERVALS[intervalIndex];
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);

    return {
      intervalDays,
      nextReviewAt: nextReview.toISOString(),
      newCorrectStreak: wasCorrect ? correctStreak + 1 : 0,
    };
  }

  /**
   * Get items due for review on a specific day
   *
   * @param {Array} learningPoints - All learning points
   * @param {number} day - Day number in the plan
   * @param {number} limit - Maximum items to return
   * @returns {Array} Items due for review
   */
  getItemsDueForReview(learningPoints, day, limit = 20) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return learningPoints
      .filter(lp => {
        // Include items that are due for review
        if (lp.nextReviewAt) {
          const reviewDate = new Date(lp.nextReviewAt);
          reviewDate.setHours(0, 0, 0, 0);
          return reviewDate <= today;
        }
        // Include new items scheduled for today
        return lp.scheduledDay === day && lp.status === 'pending';
      })
      .sort((a, b) => {
        // Prioritize overdue items
        if (a.nextReviewAt && b.nextReviewAt) {
          return new Date(a.nextReviewAt) - new Date(b.nextReviewAt);
        }
        // Then new items
        return (a.scheduledDay || 0) - (b.scheduledDay || 0);
      })
      .slice(0, limit);
  }

  /**
   * Process a review result and calculate next review interval
   * This is the main method called by IPC handlers after a user answers a flashcard
   *
   * @param {Object} params - Review parameters
   * @param {string} params.planId - Plan ID
   * @param {string} params.pointId - Learning point ID
   * @param {boolean} params.correct - Whether the answer was correct
   * @param {number} params.responseTime - Response time in milliseconds (optional)
   * @param {number} params.rating - Rating 1-4 (optional, 1=Again, 2=Hard, 3=Good, 4=Easy)
   * @param {Object} params.profile - Learner profile (optional, for personalized intervals)
   * @param {Object} params.currentPoint - Current learning point data (optional)
   * @returns {Object} Updated learning point data
   */
  processReview(params) {
    const {
      planId,
      pointId,
      correct,
      responseTime = null,
      rating = correct ? 3 : 1, // Default: Good if correct, Again if incorrect
      profile = null,
      currentPoint = null,
    } = params;

    // Get current box level (default to 1 if not provided)
    const currentBox = currentPoint?.box || currentPoint?.boxLevel || 1;
    const correctStreak = currentPoint?.correctStreak || 0;
    const reviewCount = (currentPoint?.reviewCount || 0) + 1;
    const correctCount = (currentPoint?.correctCount || 0) + (correct ? 1 : 0);

    // Calculate new box level using Leitner system
    let newBox;
    let newCorrectStreak;

    if (rating === 1) {
      // Again - reset to box 1
      newBox = 1;
      newCorrectStreak = 0;
    } else if (rating === 2) {
      // Hard - stay in current box
      newBox = currentBox;
      newCorrectStreak = 0;
    } else if (rating === 3) {
      // Good - advance one box
      newBox = Math.min(currentBox + 1, 5);
      newCorrectStreak = correctStreak + 1;
    } else if (rating === 4) {
      // Easy - advance two boxes
      newBox = Math.min(currentBox + 2, 5);
      newCorrectStreak = correctStreak + 2;
    } else {
      // Fallback for boolean correct
      newBox = correct ? Math.min(currentBox + 1, 5) : 1;
      newCorrectStreak = correct ? correctStreak + 1 : 0;
    }

    // Calculate next review interval
    let intervalDays;

    if (profile && profile.optimalReviewInterval) {
      // Use personalized interval based on learner profile
      intervalDays = this.calculatePersonalizedInterval(rating, newBox, newCorrectStreak, profile);
    } else {
      // Use standard Leitner intervals
      intervalDays = this.getBoxInterval(newBox, rating);
    }

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);

    return {
      pointId,
      planId,
      box: newBox,
      boxLevel: newBox, // Alias for compatibility
      previousBox: currentBox,
      lastReview: new Date().toISOString(),
      nextReview: nextReview.toISOString(),
      intervalDays,
      reviewCount,
      correctCount,
      correctStreak: newCorrectStreak,
      rating,
      responseTime,
      wasCorrect: correct,
    };
  }

  /**
   * Get standard Leitner box interval (days)
   *
   * @param {number} box - Box level (1-5)
   * @param {number} rating - Rating 1-4
   * @returns {number} Interval in days
   */
  getBoxInterval(box, rating) {
    // Base intervals by box level
    const boxIntervals = {
      1: 1,    // Box 1: 1 day
      2: 2,    // Box 2: 2 days
      3: 4,    // Box 3: 4 days
      4: 7,    // Box 4: 7 days (1 week)
      5: 14,   // Box 5: 14 days (2 weeks)
    };

    let interval = boxIntervals[box] || 1;

    // Apply rating multiplier
    if (rating === 1) {
      // Again - very short interval (review soon)
      interval = 0; // Same day (or next session)
    } else if (rating === 2) {
      // Hard - slightly shorter interval
      interval = Math.max(1, Math.floor(interval * 0.8));
    } else if (rating === 4) {
      // Easy - longer interval
      interval = Math.ceil(interval * 1.5);
    }
    // Good (3) uses base interval

    return interval;
  }

  /**
   * Calculate personalized interval based on learner profile
   *
   * @param {number} rating - Rating 1-4
   * @param {number} newBox - New box level
   * @param {number} correctStreak - Current correct streak
   * @param {Object} profile - Learner profile
   * @returns {number} Personalized interval in days
   */
  calculatePersonalizedInterval(rating, newBox, correctStreak, profile) {
    // Base interval from learner's optimal interval
    const optimalInterval = profile.optimalReviewInterval || 3;
    const forgettingSlope = profile.forgettingCurveSlope || 0.5;

    // Box multipliers (personalized)
    // Higher boxes get longer intervals, scaled by learner's retention characteristics
    const boxMultipliers = {
      1: 0.5,
      2: 1.0,
      3: 2.0,
      4: 4.0,
      5: 7.0,
    };

    let interval = optimalInterval * (boxMultipliers[newBox] || 1);

    // Apply rating modifiers
    if (rating === 1) {
      // Again - very short interval
      interval = Math.max(1, Math.floor(interval * 0.1));
    } else if (rating === 2) {
      // Hard - shorter interval
      interval = Math.max(1, Math.floor(interval * 0.6));
    } else if (rating === 4) {
      // Easy - longer interval, adjusted by forgetting slope
      // Learners with lower forgetting slopes (better retention) get longer intervals
      const easyMultiplier = 1.5 + (1 - forgettingSlope) * 0.5;
      interval = Math.ceil(interval * easyMultiplier);
    }
    // Good (3) uses base interval

    // Apply streak bonus (max 20% bonus)
    if (correctStreak > 3) {
      const streakBonus = Math.min(correctStreak - 3, 5) * 0.04;
      interval = Math.ceil(interval * (1 + streakBonus));
    }

    // Clamp to reasonable range
    interval = Math.max(1, Math.min(interval, 90));

    return interval;
  }

  /**
   * Calculate progress statistics
   *
   * @param {Array} learningPoints - All learning points
   * @returns {Object} Progress stats
   */
  calculateProgress(learningPoints) {
    const total = learningPoints.length;
    if (total === 0) {
      return {
        total: 0,
        pending: 0,
        learning: 0,
        reviewing: 0,
        mastered: 0,
        progressPercent: 0,
        averageMastery: 0,
      };
    }

    const byStatus = {
      pending: 0,
      learning: 0,
      reviewing: 0,
      mastered: 0,
    };

    let totalMastery = 0;

    learningPoints.forEach(lp => {
      byStatus[lp.status] = (byStatus[lp.status] || 0) + 1;
      totalMastery += lp.masteryLevel || 0;
    });

    return {
      total,
      ...byStatus,
      progressPercent: Math.round(((byStatus.reviewing + byStatus.mastered) / total) * 100),
      averageMastery: Math.round(totalMastery / total),
    };
  }
}

// Export singleton instance
const learningPlanGenerator = new LearningPlanGenerator();

export default learningPlanGenerator;
export { LearningPlanGenerator };
