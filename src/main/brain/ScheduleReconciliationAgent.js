/**
 * ScheduleReconciliationAgent.js
 *
 * LLM-driven dynamic schedule management that integrates with the existing
 * Brain system (ConsolidationService, LearnerProfileInference, CrossConceptAnalyzer).
 *
 * Key responsibilities:
 * - Detect study gaps and estimate mastery decay using learner's personal forgetting curve
 * - Generate personalized catch-up plans via LLM reasoning
 * - Prioritize items considering cross-concept patterns (prerequisites, interference)
 * - Adapt scheduling based on learner profile (pace, session length, engagement)
 * - Handle same-day multiple sessions without duplicates
 *
 * Replaces hardcoded rules with LLM-driven decisions based on actual learner data.
 */

const { createScheduleReconciliationPrompt, createCatchUpPlanPrompt } = require('../../commons/utils/AIPrompts');
const learnerProfileManager = require('../db/LearnerProfileManager');
const consolidatedMemoryManager = require('../db/ConsolidatedMemoryManager');

class ScheduleReconciliationAgent {
  /**
   * @param {Object} services - Required services
   * @param {Object} services.aiProvider - AIProviderManager instance
   * @param {Object} services.learningPlanManager - Learning plan database manager
   * @param {Object} services.learningSessionManager - Session database manager
   * @param {Object} services.episodeCollector - Episode collector instance
   * @param {Object} services.consolidationService - Consolidation service (for patterns)
   * @param {Object} services.store - electron-store instance
   */
  constructor(services = {}) {
    this.aiProvider = services.aiProvider;
    this.learningPlanManager = services.learningPlanManager;
    this.learningSessionManager = services.learningSessionManager;
    this.episodeCollector = services.episodeCollector;
    this.consolidationService = services.consolidationService;
    this.store = services.store;

    // Configuration
    this.config = {
      maxItemsInPrompt: 30,        // Limit items sent to LLM to control token usage
      defaultDailyItems: 20,       // Fallback if no profile data
      maxDailyMultiplier: 1.5,     // Max increase for catch-up
      minDailyItems: 5,            // Always show at least this many
      useLLMForPriority: true,     // Use LLM for prioritization (vs basic scoring)
      cacheReconciliationMinutes: 5, // Cache reconciliation result for this long
    };

    // Cache for reconciliation results
    this.reconciliationCache = new Map();
  }

  // ===========================================================================
  // MAIN ENTRY POINTS
  // ===========================================================================

  /**
   * Main reconciliation method - call this when starting a study session
   *
   * @param {string} planId - Learning plan ID (or null for all plans)
   * @param {string} token - User token
   * @param {Object} options - Additional options
   * @returns {Object} Reconciliation result with items for today
   */
  async reconcileSchedule(planId, token, options = {}) {
    const cacheKey = `${planId || 'all'}_${token}`;

    // Check cache
    if (!options.forceRefresh) {
      const cached = this.getCachedReconciliation(cacheKey);
      if (cached) {
        console.log('[ScheduleReconciliationAgent] Returning cached reconciliation');
        return cached;
      }
    }

    console.log('[ScheduleReconciliationAgent] Starting reconciliation...');
    const startTime = Date.now();

    try {
      // 1. Gather all context
      const context = await this.gatherContext(planId, token);

      // 2. Detect gap and determine severity
      const gapAnalysis = this.analyzeGap(context);

      // 3. Check for same-day session
      const sameDayContext = await this.checkSameDaySession(planId, token, context);

      if (sameDayContext.isSubsequentSession) {
        // Return filtered items for subsequent same-day session
        return this.handleSubsequentSession(sameDayContext, context, gapAnalysis);
      }

      // 4. First session of the day - run full reconciliation
      let result;

      if (this.shouldUseLLM(context, gapAnalysis)) {
        // Use LLM for intelligent reconciliation
        result = await this.reconcileWithLLM(context, gapAnalysis, token);
      } else {
        // Use profile-based reconciliation (no LLM call)
        result = this.reconcileWithProfile(context, gapAnalysis);
      }

      // 5. Record reconciliation event
      await this.recordReconciliationEpisode(result, token);

      // 6. Cache result
      this.cacheReconciliation(cacheKey, result);

      result.duration = Date.now() - startTime;
      console.log(`[ScheduleReconciliationAgent] Reconciliation completed in ${result.duration}ms`);

      return result;
    } catch (error) {
      console.error('[ScheduleReconciliationAgent] Reconciliation failed:', error);
      return {
        success: false,
        error: error.message,
        itemsForToday: [],
        userMessage: 'Unable to load your study session. Please try again.',
      };
    }
  }

  /**
   * Get due items with reconciliation applied
   * This is the main method called by learningPlanHandlers
   *
   * @param {string} planId - Plan ID
   * @param {string} token - User token
   * @param {number} limit - Max items to return
   * @returns {Array} Prioritized due items
   */
  async getDueItemsReconciled(planId, token, limit = 20) {
    const reconciliation = await this.reconcileSchedule(planId, token);

    if (!reconciliation.success) {
      // Fallback to basic due items
      return this.getBasicDueItems(planId, token, limit);
    }

    return reconciliation.itemsForToday.slice(0, limit);
  }

  // ===========================================================================
  // CONTEXT GATHERING
  // ===========================================================================

  /**
   * Gather all context needed for reconciliation
   */
  async gatherContext(planId, token) {
    const [profile, overdueItems, crossPatterns, recentMemories, lastSession] = await Promise.all([
      this.getLearnerProfile(token),
      this.getAllDueItems(planId, token),
      this.getCrossConceptPatterns(token),
      this.getRecentConsolidatedMemories(token),
      this.getLastSession(planId, token),
    ]);

    return {
      profile,
      overdueItems,
      crossPatterns,
      recentMemories,
      lastSession,
      planId,
      token,
      now: new Date(),
    };
  }

  /**
   * Get learner profile with forgetting curve data
   */
  async getLearnerProfile(token) {
    try {
      const fullProfile = learnerProfileManager.getFullProfile(token);

      if (!fullProfile || fullProfile.error) {
        return this.getDefaultProfile();
      }

      const global = fullProfile.globalProfile || {};

      return {
        // Forgetting curve (from LearnerProfileInference)
        forgettingCurve: {
          optimalReviewInterval: global.optimalReviewInterval || 7,
          forgettingSlope: global.forgettingCurveSlope || 0.14,
          averageRetentionRate: global.averageRetentionRate || 0.7,
          retentionStrength: this.categorizeRetention(global.averageRetentionRate),
        },
        // Pace preferences
        pacePreferences: {
          avgItemsPerSession: global.averageLearningVelocity || 15,
          preferredPace: this.inferPacePreference(global),
          optimalBatchSize: Math.round((global.averageLearningVelocity || 15) * 0.6),
        },
        // Session preferences
        sessionPreferences: {
          optimalMinutes: global.optimalSessionLength || 20,
          focusDecayPoint: (global.optimalSessionLength || 20) + 5,
          preference: global.sessionLengthPreference || 'medium',
        },
        // Engagement patterns
        engagementPatterns: {
          consistencyScore: global.consistencyScore || 0.5,
          sessionsPerWeek: global.averageSessionsPerWeek || 3,
          trend: global.engagementTrend || 'stable',
        },
        // Weak/strong areas
        weakAreas: global.strugglesWidth || [],
        strongAreas: global.performsWellWith || [],
        // AI insights
        aiInsights: global.aiInsights || [],
        // Learning style
        learningStyle: global.learningStyle || 'mixed',
      };
    } catch (error) {
      console.error('[ScheduleReconciliationAgent] Error getting profile:', error);
      return this.getDefaultProfile();
    }
  }

  /**
   * Get default profile for new users
   */
  getDefaultProfile() {
    return {
      forgettingCurve: {
        optimalReviewInterval: 7,
        forgettingSlope: 0.14,
        averageRetentionRate: 0.7,
        retentionStrength: 'moderate',
      },
      pacePreferences: {
        avgItemsPerSession: 15,
        preferredPace: 'steady',
        optimalBatchSize: 10,
      },
      sessionPreferences: {
        optimalMinutes: 20,
        focusDecayPoint: 25,
        preference: 'medium',
      },
      engagementPatterns: {
        consistencyScore: 0.5,
        sessionsPerWeek: 3,
        trend: 'stable',
      },
      weakAreas: [],
      strongAreas: [],
      aiInsights: [],
      learningStyle: 'mixed',
    };
  }

  /**
   * Categorize retention strength based on rate
   */
  categorizeRetention(rate) {
    if (rate >= 0.85) return 'strong';
    if (rate >= 0.7) return 'moderate';
    if (rate >= 0.5) return 'weak';
    return 'very_weak';
  }

  /**
   * Infer pace preference from profile data
   */
  inferPacePreference(profile) {
    const velocity = profile.averageLearningVelocity || 15;
    const sessionLength = profile.optimalSessionLength || 20;

    const itemsPerMinute = velocity / sessionLength;

    if (itemsPerMinute > 1.5) return 'burst';
    if (itemsPerMinute < 0.5) return 'marathon';
    return 'steady';
  }

  /**
   * Get all due items (no limit)
   */
  async getAllDueItems(planId, token) {
    if (!this.learningPlanManager) {
      return [];
    }

    try {
      // Get due items without limit
      const items = await this.learningPlanManager.getDueItems({
        planId,
        limit: 1000, // High limit to get all
      });

      // Enrich with days overdue
      const now = new Date();
      return items.map(item => {
        const nextReview = item.nextReview ? new Date(item.nextReview) : now;
        const daysOverdue = Math.max(0, Math.floor((now - nextReview) / (1000 * 60 * 60 * 24)));

        return {
          ...item,
          daysOverdue,
        };
      });
    } catch (error) {
      console.error('[ScheduleReconciliationAgent] Error getting due items:', error);
      return [];
    }
  }

  /**
   * Get cross-concept patterns from consolidation service
   */
  async getCrossConceptPatterns(token) {
    if (!this.consolidationService) {
      return [];
    }

    try {
      const patterns = this.consolidationService.getRecentCrossConceptPatterns(token, 20);
      return patterns.flatMap(memory => {
        const p = memory.patterns || {};
        return [
          ...(p.crossConcept || []),
          ...(p.temporal || []).filter(t => t.type === 'CRAMMING'),
        ];
      });
    } catch (error) {
      console.error('[ScheduleReconciliationAgent] Error getting patterns:', error);
      return [];
    }
  }

  /**
   * Get recent consolidated memories for insights
   */
  async getRecentConsolidatedMemories(token) {
    try {
      const result = consolidatedMemoryManager.getConsolidatedMemories({
        token,
        limit: 10,
      });
      return result.data || [];
    } catch (error) {
      console.error('[ScheduleReconciliationAgent] Error getting memories:', error);
      return [];
    }
  }

  /**
   * Get last completed session
   */
  async getLastSession(planId, token) {
    if (!this.learningSessionManager) {
      return null;
    }

    try {
      const sessions = await this.learningSessionManager.getSessionHistory({
        planId,
        limit: 1,
      });
      return sessions[0] || null;
    } catch (error) {
      console.error('[ScheduleReconciliationAgent] Error getting last session:', error);
      return null;
    }
  }

  // ===========================================================================
  // GAP ANALYSIS
  // ===========================================================================

  /**
   * Analyze gap since last session using personal thresholds
   */
  analyzeGap(context) {
    const { profile, lastSession, overdueItems, now } = context;

    // Calculate days since last session
    let daysSinceLastSession = 0;
    if (lastSession?.completedAt) {
      const lastDate = new Date(lastSession.completedAt);
      daysSinceLastSession = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
    }

    // Use PERSONAL thresholds based on learner's forgetting curve
    const personalInterval = profile.forgettingCurve.optimalReviewInterval;

    const GAP_THRESHOLDS = {
      NONE: 0,
      MINOR: Math.round(personalInterval * 0.5),
      MODERATE: personalInterval,
      MAJOR: personalInterval * 2,
      SEVERE: personalInterval * 4,
    };

    // Determine gap type
    let gapType = 'NONE';
    if (daysSinceLastSession >= GAP_THRESHOLDS.SEVERE) {
      gapType = 'SEVERE';
    } else if (daysSinceLastSession >= GAP_THRESHOLDS.MAJOR) {
      gapType = 'MAJOR';
    } else if (daysSinceLastSession >= GAP_THRESHOLDS.MODERATE) {
      gapType = 'MODERATE';
    } else if (daysSinceLastSession >= GAP_THRESHOLDS.MINOR) {
      gapType = 'MINOR';
    }

    return {
      hasGap: gapType !== 'NONE',
      gapType,
      daysSinceLastSession,
      personalThresholds: GAP_THRESHOLDS,
      overdueCount: overdueItems.length,
      profileBased: true,
      recommendation: this.getGapRecommendation(gapType, daysSinceLastSession),
    };
  }

  /**
   * Get human-readable gap recommendation
   */
  getGapRecommendation(gapType, days) {
    const recommendations = {
      NONE: null,
      MINOR: `You missed ${days} days. A quick review session will get you back on track.`,
      MODERATE: `It's been ${days} days. Some memories may have faded - we'll prioritize the most important items.`,
      MAJOR: `It's been ${days} days! We'll spread your catch-up over several days to avoid overwhelm.`,
      SEVERE: `Welcome back after ${days} days! We've adjusted your schedule for a gentle, gradual return.`,
    };
    return recommendations[gapType];
  }

  // ===========================================================================
  // SAME-DAY SESSION HANDLING
  // ===========================================================================

  /**
   * Check if this is a subsequent session on the same day
   */
  async checkSameDaySession(planId, token, context) {
    const today = new Date().toISOString().split('T')[0];

    if (!this.learningSessionManager) {
      return { isSubsequentSession: false };
    }

    try {
      const todaysSessions = await this.learningSessionManager.getSessionsForDate(
        planId,
        today,
        token
      );

      if (!todaysSessions || todaysSessions.length === 0) {
        return { isSubsequentSession: false };
      }

      // Collect already-reviewed item IDs
      const reviewedToday = new Set();
      for (const session of todaysSessions) {
        const results = session.sessionData?.itemResults || [];
        results.forEach(r => reviewedToday.add(r.itemId));
      }

      return {
        isSubsequentSession: true,
        sessionNumber: todaysSessions.length + 1,
        reviewedToday,
        completedToday: reviewedToday.size,
      };
    } catch (error) {
      console.error('[ScheduleReconciliationAgent] Error checking same-day:', error);
      return { isSubsequentSession: false };
    }
  }

  /**
   * Handle subsequent session on the same day
   */
  handleSubsequentSession(sameDayContext, context, gapAnalysis) {
    const { reviewedToday, completedToday, sessionNumber } = sameDayContext;
    const { profile, overdueItems } = context;

    // Filter out already-reviewed items
    const remainingItems = overdueItems.filter(item => !reviewedToday.has(item.id));

    // Calculate remaining goal
    const dailyGoal = profile.pacePreferences.avgItemsPerSession || 20;
    const remainingGoal = Math.max(0, dailyGoal - completedToday);

    // Basic priority sort for remaining items
    const prioritized = this.basicPrioritySort(remainingItems);

    const reachedGoal = completedToday >= dailyGoal;

    return {
      success: true,
      isSubsequentSession: true,
      sessionNumber,
      completedToday,
      remainingGoal,
      totalOverdue: overdueItems.length,
      itemsForToday: prioritized.slice(0, remainingGoal || 10), // At least 10 if they want extra
      gapAnalysis,
      userMessage: reachedGoal
        ? `You've reached today's goal of ${dailyGoal} items! Extra practice is optional.`
        : `Session ${sessionNumber}: ${remainingGoal} items remaining for today's goal.`,
      recommendedLoad: {
        reviewCount: Math.min(remainingGoal, remainingItems.length),
        newCount: 0,
        reasoning: reachedGoal
          ? 'Daily goal reached - extra practice available'
          : `Continuing from session ${sessionNumber - 1}`,
      },
    };
  }

  // ===========================================================================
  // LLM-DRIVEN RECONCILIATION
  // ===========================================================================

  /**
   * Determine if we should use LLM for this reconciliation
   */
  shouldUseLLM(context, gapAnalysis) {
    // Use LLM if:
    // 1. AI provider is available
    // 2. There's a significant gap OR many overdue items OR cross-concept patterns
    // 3. Config allows it

    if (!this.aiProvider || !this.config.useLLMForPriority) {
      return false;
    }

    const hasSignificantGap = ['MODERATE', 'MAJOR', 'SEVERE'].includes(gapAnalysis.gapType);
    const hasBacklog = context.overdueItems.length > context.profile.pacePreferences.avgItemsPerSession;
    const hasPatterns = context.crossPatterns.length > 0;

    return hasSignificantGap || hasBacklog || hasPatterns;
  }

  /**
   * Reconcile using LLM for intelligent scheduling
   */
  async reconcileWithLLM(context, gapAnalysis, token) {
    console.log('[ScheduleReconciliationAgent] Using LLM for reconciliation...');

    try {
      // Build prompt context (limit items to control tokens)
      const promptContext = this.buildPromptContext(context, gapAnalysis);

      // Create and call LLM prompt
      const prompt = createScheduleReconciliationPrompt(promptContext);
      const llmResult = await this.aiProvider.generateContentWithJson(prompt, true);

      // Parse and validate LLM result
      const parsed = this.parseLLMResult(llmResult, context);

      // Apply LLM recommendations
      const result = {
        success: true,
        llmDriven: true,
        totalOverdue: context.overdueItems.length,
        gapAnalysis,

        // LLM-generated
        estimatedDecay: parsed.estimatedDecay || {},
        prioritizedItemIds: parsed.prioritizedItems || [],
        recommendedLoad: parsed.recommendedLoad || this.calculateDefaultLoad(context),
        catchUpPlan: parsed.catchUpPlan || null,
        userMessage: parsed.userMessage || this.getDefaultMessage(gapAnalysis),

        // Apply priority to items
        itemsForToday: this.applyPriorityOrder(
          context.overdueItems,
          parsed.prioritizedItems,
          parsed.recommendedLoad?.reviewCount || 20
        ),
      };

      // Apply mastery decay if significant
      if (Object.keys(result.estimatedDecay).length > 0) {
        await this.applyMasteryDecay(result.estimatedDecay, context.overdueItems, token);
      }

      return result;
    } catch (error) {
      console.error('[ScheduleReconciliationAgent] LLM reconciliation failed:', error);
      // Fallback to profile-based
      return this.reconcileWithProfile(context, gapAnalysis);
    }
  }

  /**
   * Build context object for LLM prompt
   */
  buildPromptContext(context, gapAnalysis) {
    const { profile, overdueItems, crossPatterns, recentMemories } = context;

    // Limit items for prompt
    const itemsForPrompt = overdueItems
      .slice(0, this.config.maxItemsInPrompt)
      .map(item => ({
        id: item.id,
        front: (item.front || '').substring(0, 50),
        mastery: item.masteryLevel || 50,
        box: item.box || 1,
        daysOverdue: item.daysOverdue || 0,
        correctStreak: item.correctStreak || 0,
      }));

    // Extract pattern info
    const patternsForPrompt = crossPatterns.slice(0, 10).map(p => ({
      type: p.type,
      concepts: [p.fromConceptName || p.conceptAName, p.toConceptName || p.conceptBName].filter(Boolean),
      insight: p.insight || p.recommendedGap,
    }));

    // Extract recent insights
    const recentInsights = recentMemories
      .flatMap(m => m.insights || [])
      .slice(0, 5);

    return {
      learnerProfile: {
        forgettingCurve: profile.forgettingCurve,
        pacePreferences: profile.pacePreferences,
        sessionPreferences: profile.sessionPreferences,
        engagementTrend: profile.engagementPatterns.trend,
        consistencyScore: profile.engagementPatterns.consistencyScore,
        weakAreas: profile.weakAreas,
        strongAreas: profile.strongAreas,
      },
      gapAnalysis: {
        daysSinceLastSession: gapAnalysis.daysSinceLastSession,
        gapType: gapAnalysis.gapType,
        personalThresholds: gapAnalysis.personalThresholds,
      },
      overdueItems: itemsForPrompt,
      totalOverdueCount: overdueItems.length,
      crossConceptPatterns: patternsForPrompt,
      recentInsights,
    };
  }

  /**
   * Parse and validate LLM result
   */
  parseLLMResult(llmResult, context) {
    // Handle string response
    if (typeof llmResult === 'string') {
      try {
        llmResult = JSON.parse(llmResult);
      } catch (e) {
        console.warn('[ScheduleReconciliationAgent] Could not parse LLM response as JSON');
        return {};
      }
    }

    // Validate and sanitize
    const result = {
      estimatedDecay: {},
      prioritizedItems: [],
      recommendedLoad: null,
      catchUpPlan: null,
      userMessage: null,
    };

    // Estimated decay
    if (llmResult.estimatedDecay && typeof llmResult.estimatedDecay === 'object') {
      result.estimatedDecay = llmResult.estimatedDecay;
    }

    // Prioritized items (validate IDs exist)
    if (Array.isArray(llmResult.prioritizedItems)) {
      const validIds = new Set(context.overdueItems.map(i => i.id));
      result.prioritizedItems = llmResult.prioritizedItems.filter(id => validIds.has(id));
    }

    // Recommended load
    if (llmResult.recommendedLoad) {
      result.recommendedLoad = {
        reviewCount: Math.min(
          llmResult.recommendedLoad.reviewCount || 20,
          Math.round(context.profile.pacePreferences.avgItemsPerSession * this.config.maxDailyMultiplier)
        ),
        newCount: llmResult.recommendedLoad.newCount || 0,
        reasoning: llmResult.recommendedLoad.reasoning || '',
      };
    }

    // Catch-up plan
    if (llmResult.catchUpPlan && llmResult.catchUpPlan.daysNeeded > 0) {
      result.catchUpPlan = llmResult.catchUpPlan;
    }

    // User message
    if (typeof llmResult.userMessage === 'string') {
      result.userMessage = llmResult.userMessage;
    }

    return result;
  }

  /**
   * Apply priority order from LLM to items
   */
  applyPriorityOrder(items, prioritizedIds, limit) {
    if (!prioritizedIds || prioritizedIds.length === 0) {
      // Fallback to basic sort
      return this.basicPrioritySort(items).slice(0, limit);
    }

    const itemMap = new Map(items.map(item => [item.id, item]));
    const result = [];

    // Add items in priority order
    for (const id of prioritizedIds) {
      const item = itemMap.get(id);
      if (item) {
        result.push(item);
        itemMap.delete(id);
      }
      if (result.length >= limit) break;
    }

    // Add remaining items if needed
    if (result.length < limit) {
      const remaining = Array.from(itemMap.values());
      result.push(...this.basicPrioritySort(remaining).slice(0, limit - result.length));
    }

    return result;
  }

  // ===========================================================================
  // PROFILE-BASED RECONCILIATION (No LLM)
  // ===========================================================================

  /**
   * Reconcile using profile data without LLM call
   */
  reconcileWithProfile(context, gapAnalysis) {
    console.log('[ScheduleReconciliationAgent] Using profile-based reconciliation...');

    const { profile, overdueItems } = context;

    // Calculate decay using personal forgetting curve
    const itemsWithDecay = overdueItems.map(item => {
      const decay = this.calculatePersonalDecay(
        item.masteryLevel || 50,
        item.daysOverdue || 0,
        item.box || 1,
        item.correctStreak || 0,
        profile.forgettingCurve
      );
      return {
        ...item,
        estimatedDecay: decay.decayAmount,
        adjustedMastery: decay.adjustedMastery,
      };
    });

    // Sort by priority
    const prioritized = this.basicPrioritySort(itemsWithDecay);

    // Calculate load
    const recommendedLoad = this.calculateDefaultLoad(context, gapAnalysis);

    return {
      success: true,
      llmDriven: false,
      totalOverdue: overdueItems.length,
      gapAnalysis,
      estimatedDecay: Object.fromEntries(
        itemsWithDecay
          .filter(i => i.estimatedDecay > 5)
          .map(i => [i.id, i.estimatedDecay])
      ),
      recommendedLoad,
      catchUpPlan: this.generateBasicCatchUpPlan(context, gapAnalysis),
      userMessage: this.getDefaultMessage(gapAnalysis),
      itemsForToday: prioritized.slice(0, recommendedLoad.reviewCount),
    };
  }

  /**
   * Calculate decay using learner's personal forgetting curve
   */
  calculatePersonalDecay(originalMastery, daysOverdue, boxLevel, correctStreak, forgettingCurve) {
    if (daysOverdue <= 0) {
      return { adjustedMastery: originalMastery, decayAmount: 0, retentionRate: 1.0 };
    }

    // Use personal forgetting slope (lower = slower forgetting)
    const slope = forgettingCurve.forgettingSlope || 0.14;

    // Stability factor increases with box level and streak
    const baseStability = forgettingCurve.optimalReviewInterval || 7;
    const boxBonus = (boxLevel - 1) * (baseStability * 0.5);
    const streakBonus = Math.min(correctStreak * 2, baseStability);
    const stabilityFactor = baseStability + boxBonus + streakBonus;

    // Exponential decay using personal slope
    const retentionRate = Math.exp(-slope * daysOverdue / (stabilityFactor / 7));

    // Apply decay with floor
    const decayAmount = originalMastery * (1 - retentionRate);
    const adjustedMastery = Math.max(
      originalMastery * 0.1,  // Never below 10% of original
      originalMastery - decayAmount
    );

    return {
      adjustedMastery: Math.round(adjustedMastery * 10) / 10,
      decayAmount: Math.round(decayAmount * 10) / 10,
      retentionRate: Math.round(retentionRate * 1000) / 1000,
    };
  }

  /**
   * Basic priority sort without LLM
   */
  basicPrioritySort(items) {
    return [...items].sort((a, b) => {
      // Priority factors: urgency, mastery, box level

      // 1. Days overdue (more overdue = higher priority)
      const urgencyA = Math.min(a.daysOverdue || 0, 30) * 10;
      const urgencyB = Math.min(b.daysOverdue || 0, 30) * 10;

      // 2. Lower mastery = higher priority
      const masteryA = 100 - (a.adjustedMastery || a.masteryLevel || 50);
      const masteryB = 100 - (b.adjustedMastery || b.masteryLevel || 50);

      // 3. Lower box = higher priority
      const boxA = (6 - (a.box || 1)) * 20;
      const boxB = (6 - (b.box || 1)) * 20;

      const scoreA = urgencyA + masteryA + boxA;
      const scoreB = urgencyB + masteryB + boxB;

      return scoreB - scoreA; // Higher score = higher priority
    });
  }

  /**
   * Calculate default load based on profile
   */
  calculateDefaultLoad(context, gapAnalysis = null) {
    const { profile, overdueItems } = context;

    const normalDailyItems = profile.pacePreferences.avgItemsPerSession || this.config.defaultDailyItems;
    const maxDaily = Math.round(normalDailyItems * this.config.maxDailyMultiplier);

    let reviewCount = normalDailyItems;
    let newCount = 0;
    let reasoning = 'Normal daily goal';

    if (overdueItems.length > normalDailyItems) {
      // Has backlog
      const backlogRatio = overdueItems.length / normalDailyItems;

      if (backlogRatio > 3) {
        // Heavy backlog - focus on reviews only
        reviewCount = maxDaily;
        newCount = 0;
        reasoning = 'Heavy backlog - focusing on reviews';
      } else if (backlogRatio > 1.5) {
        // Moderate backlog - increased reviews
        reviewCount = Math.round(maxDaily * 0.85);
        newCount = Math.round(maxDaily * 0.15);
        reasoning = 'Moderate backlog - increased review load';
      } else {
        // Light backlog
        reviewCount = Math.round(normalDailyItems * 0.7) + Math.min(10, overdueItems.length - normalDailyItems);
        newCount = Math.round(normalDailyItems * 0.3);
        reasoning = 'Light backlog - balanced approach';
      }
    } else {
      // No backlog
      reviewCount = Math.round(normalDailyItems * 0.6);
      newCount = Math.round(normalDailyItems * 0.4);
      reasoning = 'On schedule - normal mix of reviews and new items';
    }

    return {
      reviewCount: Math.max(this.config.minDailyItems, reviewCount),
      newCount,
      totalItems: reviewCount + newCount,
      reasoning,
    };
  }

  /**
   * Generate basic catch-up plan without LLM
   */
  generateBasicCatchUpPlan(context, gapAnalysis) {
    const { profile, overdueItems } = context;

    if (overdueItems.length <= profile.pacePreferences.avgItemsPerSession) {
      return null; // No catch-up needed
    }

    const maxDaily = Math.round(
      profile.pacePreferences.avgItemsPerSession * this.config.maxDailyMultiplier
    );
    const daysNeeded = Math.ceil(overdueItems.length / (maxDaily * 0.7));

    if (daysNeeded <= 1) {
      return null;
    }

    const dailyBreakdown = [];
    let remaining = overdueItems.length;

    for (let day = 1; day <= daysNeeded && remaining > 0; day++) {
      const reviewCount = Math.min(remaining, Math.round(maxDaily * 0.7));
      dailyBreakdown.push({
        day,
        reviewCount,
        focus: day === 1 ? 'Most overdue items' : day === daysNeeded ? 'Final catch-up' : 'Continued review',
        estimatedMinutes: Math.round(reviewCount * (profile.sessionPreferences.optimalMinutes / profile.pacePreferences.avgItemsPerSession)),
      });
      remaining -= reviewCount;
    }

    return {
      daysNeeded,
      dailyBreakdown,
      totalItems: overdueItems.length,
    };
  }

  /**
   * Get default message based on gap analysis
   */
  getDefaultMessage(gapAnalysis) {
    if (!gapAnalysis.hasGap) {
      return "Ready for today's study session!";
    }

    const messages = {
      MINOR: "Welcome back! Let's pick up where you left off.",
      MODERATE: "Good to see you! We've prioritized your most important items.",
      MAJOR: "Welcome back! We'll take it easy and spread your catch-up over a few days.",
      SEVERE: "Great to have you back! We've created a gentle plan to get you back on track.",
    };

    return messages[gapAnalysis.gapType] || "Let's get started!";
  }

  // ===========================================================================
  // MASTERY DECAY APPLICATION
  // ===========================================================================

  /**
   * Apply mastery decay to items in database
   */
  async applyMasteryDecay(decayMap, items, token) {
    if (!this.learningPlanManager) {
      return;
    }

    const significantDecay = Object.entries(decayMap).filter(([, decay]) => decay > 5);

    for (const [itemId, decayPercent] of significantDecay) {
      const item = items.find(i => i.id === itemId);
      if (!item) continue;

      const newMastery = Math.max(5, (item.masteryLevel || 50) - decayPercent);

      try {
        await this.learningPlanManager.updateLearningPoint(itemId, {
          masteryLevel: newMastery,
          decayAppliedAt: new Date().toISOString(),
          decayAmount: decayPercent,
        }, token);
      } catch (error) {
        console.warn(`[ScheduleReconciliationAgent] Failed to apply decay to ${itemId}:`, error.message);
      }
    }

    console.log(`[ScheduleReconciliationAgent] Applied decay to ${significantDecay.length} items`);
  }

  // ===========================================================================
  // EPISODE RECORDING
  // ===========================================================================

  /**
   * Record reconciliation as an episode for tracking
   */
  async recordReconciliationEpisode(result, token) {
    if (!this.episodeCollector) {
      return;
    }

    try {
      this.episodeCollector.record({
        eventType: 'SCHEDULE_RECONCILED',
        payload: {
          totalOverdue: result.totalOverdue,
          gapType: result.gapAnalysis?.gapType,
          daysSinceLastSession: result.gapAnalysis?.daysSinceLastSession,
          llmDriven: result.llmDriven,
          recommendedReviewCount: result.recommendedLoad?.reviewCount,
          catchUpDaysNeeded: result.catchUpPlan?.daysNeeded || 0,
          decayAppliedCount: Object.keys(result.estimatedDecay || {}).length,
        },
        sourceContext: { component: 'ScheduleReconciliationAgent' },
      });
    } catch (error) {
      console.warn('[ScheduleReconciliationAgent] Failed to record episode:', error.message);
    }
  }

  // ===========================================================================
  // CACHING
  // ===========================================================================

  /**
   * Get cached reconciliation if still valid
   */
  getCachedReconciliation(cacheKey) {
    const cached = this.reconciliationCache.get(cacheKey);
    if (!cached) return null;

    const ageMinutes = (Date.now() - cached.timestamp) / (1000 * 60);
    if (ageMinutes > this.config.cacheReconciliationMinutes) {
      this.reconciliationCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache reconciliation result
   */
  cacheReconciliation(cacheKey, result) {
    this.reconciliationCache.set(cacheKey, {
      timestamp: Date.now(),
      result,
    });
  }

  /**
   * Clear reconciliation cache
   */
  clearCache() {
    this.reconciliationCache.clear();
  }

  // ===========================================================================
  // HELPER: BASIC DUE ITEMS (FALLBACK)
  // ===========================================================================

  /**
   * Get basic due items without reconciliation (fallback)
   */
  async getBasicDueItems(planId, token, limit) {
    if (!this.learningPlanManager) {
      return [];
    }

    try {
      const items = await this.learningPlanManager.getDueItems({
        planId,
        limit,
      });
      return this.basicPrioritySort(items);
    } catch (error) {
      console.error('[ScheduleReconciliationAgent] Error getting basic due items:', error);
      return [];
    }
  }

  // ===========================================================================
  // PERSONALIZED INTERVAL CALCULATION
  // ===========================================================================

  /**
   * Calculate next review interval using learner's personal forgetting curve
   *
   * @param {number} rating - Review rating (1-4)
   * @param {number} correctStreak - Consecutive correct answers
   * @param {Object} profile - Learner profile with forgetting curve data
   * @returns {number} Interval in days
   */
  calculatePersonalizedInterval(rating, correctStreak, profile) {
    const forgettingCurve = profile?.forgettingCurve || {};

    // Get personal parameters
    const baseInterval = forgettingCurve.optimalReviewInterval || 7;
    const retentionRate = forgettingCurve.averageRetentionRate || 0.7;

    // Rating multipliers (relative, not absolute)
    const ratingMultipliers = {
      1: 0.1,   // Again: very short interval
      2: 0.5,   // Hard: half interval
      3: 1.0,   // Good: normal interval
      4: 1.5,   // Easy: extended interval
    };

    // Streak bonus (compounding, personalized by retention rate)
    const streakBonus = Math.pow(1 + (retentionRate * 0.2), Math.min(correctStreak, 5));

    // Calculate interval
    let interval = baseInterval * (ratingMultipliers[rating] || 1) * streakBonus;

    // Bounds
    const minInterval = rating === 1 ? 0.01 : 1;
    const maxInterval = baseInterval * 10;

    return Math.max(minInterval, Math.min(maxInterval, Math.round(interval * 10) / 10));
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Update configuration
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

module.exports = ScheduleReconciliationAgent;
