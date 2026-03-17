/**
 * Schedule Reconciliation Integration Tests
 *
 * Tests the full flow of LLM-driven schedule reconciliation from API calls
 * through the agent to database operations and back.
 *
 * @jest-environment node
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock AI Provider
const mockAIProvider = {
  generateContentWithJson: jest.fn(),
  generateContent: jest.fn(),
  isAvailable: jest.fn().mockReturnValue(true),
  supportsToolUse: jest.fn().mockReturnValue(true),
};

// Mock AI Provider Manager
const mockAIProviderManager = {
  getCurrentProvider: jest.fn().mockReturnValue(mockAIProvider),
  generateContentWithJson: jest.fn(),
};

// Mock database with learning points
const mockDB = {
  learningPoints: new Map(),
  profiles: new Map(),
  episodes: [],
  nextId: 1,

  reset() {
    this.learningPoints.clear();
    this.profiles.clear();
    this.episodes = [];
    this.nextId = 1;
  },

  // Learning point operations
  createLearningPoint(point, userId) {
    const id = `lp-${this.nextId++}`;
    const item = {
      id,
      ...point,
      user_id: userId,
      box: point.box || 1,
      next_review: point.next_review || new Date().toISOString().split('T')[0],
      review_count: point.review_count || 0,
      correct_streak: point.correct_streak || 0,
      mastery_level: point.mastery_level || 0,
      created_at: new Date().toISOString(),
    };
    this.learningPoints.set(id, item);
    return item;
  },

  getLearningPoint(id) {
    return this.learningPoints.get(id) || null;
  },

  updateLearningPoint(id, updates) {
    const item = this.learningPoints.get(id);
    if (!item) return null;
    const updated = { ...item, ...updates, updated_at: new Date().toISOString() };
    this.learningPoints.set(id, updated);
    return updated;
  },

  getDueItems(userId, limit = 50) {
    const today = new Date().toISOString().split('T')[0];
    return Array.from(this.learningPoints.values())
      .filter((item) =>
        item.user_id === userId &&
        !item.deleted_at &&
        item.next_review <= today
      )
      .slice(0, limit);
  },

  // Profile operations
  setProfile(userId, profile) {
    this.profiles.set(userId, profile);
  },

  getProfile(userId) {
    return this.profiles.get(userId) || null;
  },

  // Episode operations
  recordEpisode(episode) {
    this.episodes.push({
      ...episode,
      id: `ep-${this.nextId++}`,
      timestamp: new Date().toISOString(),
    });
  },

  getRecentEpisodes(userId, days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return this.episodes.filter(
      (ep) => ep.userId === userId && new Date(ep.timestamp) >= cutoff
    );
  },
};

// Mock LearningPlanManager
const mockLearningPlanManager = {
  getDueItems: jest.fn((planId, limit) => {
    return mockDB.getDueItems(1, limit);
  }),

  calculateDaysOverdue: jest.fn((item) => {
    if (!item.nextReview && !item.next_review) return 0;
    const reviewDate = new Date(item.nextReview || item.next_review);
    const now = new Date();
    const diff = now.getTime() - reviewDate.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }),

  getOverdueItemsByGap: jest.fn((planId, profile) => {
    const dueItems = mockDB.getDueItems(1, 100);
    const optimalInterval = profile?.optimalReviewInterval || 3;

    const critical = [];
    const important = [];
    const routine = [];

    dueItems.forEach((item) => {
      const daysOverdue = mockLearningPlanManager.calculateDaysOverdue(item);
      const enrichedItem = { ...item, daysOverdue };

      if (daysOverdue > optimalInterval * 2) {
        critical.push(enrichedItem);
      } else if (daysOverdue >= optimalInterval) {
        important.push(enrichedItem);
      } else {
        routine.push(enrichedItem);
      }
    });

    return {
      critical: critical.sort((a, b) => b.daysOverdue - a.daysOverdue),
      important: important.sort((a, b) => b.daysOverdue - a.daysOverdue),
      routine: routine.sort((a, b) => b.daysOverdue - a.daysOverdue),
      total: critical.length + important.length + routine.length,
    };
  }),

  getDueItemsReconciled: jest.fn(),
};

// Mock LearnerProfileManager
const mockLearnerProfileManager = {
  getProfile: jest.fn((userId) => mockDB.getProfile(userId)),
  updateProfile: jest.fn((userId, updates) => {
    const profile = mockDB.getProfile(userId) || {};
    const updated = { ...profile, ...updates };
    mockDB.setProfile(userId, updated);
    return updated;
  }),
};

// Mock EpisodeCollector
const mockEpisodeCollector = {
  recordEvent: jest.fn((eventType, payload, userId) => {
    mockDB.recordEpisode({ eventType, payload, userId });
  }),
  getRecentEpisodes: jest.fn((userId, days) => mockDB.getRecentEpisodes(userId, days)),
};

// =============================================================================
// SCHEDULE RECONCILIATION AGENT (Simplified for testing)
// =============================================================================

class MockScheduleReconciliationAgent {
  constructor(options = {}) {
    this.aiProvider = options.aiProvider || mockAIProvider;
    this.learningPlanManager = options.learningPlanManager || mockLearningPlanManager;
    this.profileManager = options.profileManager || mockLearnerProfileManager;
    this.episodeCollector = options.episodeCollector || mockEpisodeCollector;
    this.cache = new Map();
    this.reviewedToday = new Set();
  }

  // Analyze gap severity
  analyzeGap(profile, daysSinceLastReview) {
    const optimalInterval = profile?.optimalReviewInterval || 3;
    const ratio = daysSinceLastReview / optimalInterval;

    if (ratio <= 0.5) return { severity: 'NONE', ratio, daysSinceLastReview };
    if (ratio <= 1) return { severity: 'MINOR', ratio, daysSinceLastReview };
    if (ratio <= 2) return { severity: 'MODERATE', ratio, daysSinceLastReview };
    if (ratio <= 3) return { severity: 'MAJOR', ratio, daysSinceLastReview };
    return { severity: 'SEVERE', ratio, daysSinceLastReview };
  }

  // Calculate decay based on profile
  calculatePersonalDecay(profile, daysSinceLastReview, boxLevel = 1) {
    const slope = profile?.forgettingCurveSlope || 0.5;
    const baseRetention = profile?.averageRetentionRate || 0.7;
    const boxMultiplier = Math.pow(0.9, boxLevel - 1);
    const decay = slope * (daysSinceLastReview / 7) * boxMultiplier;
    return Math.max(0, Math.min(1, baseRetention - decay));
  }

  // Get prioritized due items
  async getDueItemsReconciled(planId, limit, token, options = {}) {
    const userId = parseInt(token) || 1;
    const profile = this.profileManager.getProfile(userId);

    // Get raw due items
    const rawItems = this.learningPlanManager.getDueItems(planId, limit * 2);

    // Filter out already reviewed today
    const filteredItems = rawItems.filter((item) => !this.reviewedToday.has(item.id));

    // Enrich with decay and priority
    const enrichedItems = filteredItems.map((item) => {
      const daysOverdue = this.learningPlanManager.calculateDaysOverdue(item);
      const decayedMastery = this.calculatePersonalDecay(profile, daysOverdue, item.box || 1);
      const gap = this.analyzeGap(profile, daysOverdue);

      return {
        ...item,
        daysOverdue,
        decayedMastery,
        gapSeverity: gap.severity,
        priority: this.calculatePriority(item, gap, decayedMastery),
      };
    });

    // Sort by priority
    enrichedItems.sort((a, b) => b.priority - a.priority);

    // Apply limit
    const items = enrichedItems.slice(0, limit);

    // If LLM reconciliation requested and available
    if (options.useReconciliation && this.aiProvider.isAvailable()) {
      try {
        const llmResult = await this.reconcileWithLLM(items, profile, options);
        if (llmResult.success) {
          return {
            reconciled: true,
            source: 'llm',
            items: llmResult.items,
            adjustments: llmResult.adjustments,
            sessionPlan: llmResult.sessionPlan,
            recommendations: llmResult.recommendations,
          };
        }
      } catch (error) {
        console.error('LLM reconciliation failed:', error);
      }
    }

    return {
      reconciled: false,
      source: 'basic',
      items,
      gapAnalysis: this.analyzeGap(profile, Math.max(...items.map((i) => i.daysOverdue), 0)),
    };
  }

  calculatePriority(item, gap, decayedMastery) {
    let priority = 5;

    // Higher priority for more severe gaps
    const severityBonus = {
      NONE: 0,
      MINOR: 1,
      MODERATE: 2,
      MAJOR: 3,
      SEVERE: 4,
    };
    priority += severityBonus[gap.severity] || 0;

    // Higher priority for lower decayed mastery
    priority += (1 - decayedMastery) * 3;

    // Higher priority for higher box (more to lose)
    priority += (item.box || 1) * 0.5;

    return priority;
  }

  async reconcileWithLLM(items, profile, options) {
    const prompt = this.buildReconciliationPrompt(items, profile, options);

    const response = await this.aiProvider.generateContentWithJson(prompt);

    if (!response || response.error) {
      return { success: false, error: response?.error || 'No response' };
    }

    // Parse and validate LLM response
    const parsed = this.parseLLMResponse(response, items);
    return { success: true, ...parsed };
  }

  buildReconciliationPrompt(items, profile, options) {
    return {
      planName: options.planName || 'Learning Plan',
      domainType: options.domainType || 'general',
      profile,
      overdueItems: items.slice(0, 10),
      gapAnalysis: this.analyzeGap(profile, Math.max(...items.map((i) => i.daysOverdue), 0)),
      sessionContext: options.sessionContext,
    };
  }

  parseLLMResponse(response, originalItems) {
    // Map LLM prioritization back to original items
    const prioritizedItems = response.prioritizedItems || [];
    const itemMap = new Map(originalItems.map((item) => [item.id, item]));

    const items = prioritizedItems
      .filter((p) => itemMap.has(p.itemId))
      .map((p) => ({
        ...itemMap.get(p.itemId),
        llmPriority: p.priority,
        llmReason: p.reason,
        suggestedInterval: p.suggestedInterval,
      }));

    // Add any items not mentioned by LLM at the end
    const mentionedIds = new Set(prioritizedItems.map((p) => p.itemId));
    originalItems.forEach((item) => {
      if (!mentionedIds.has(item.id)) {
        items.push(item);
      }
    });

    return {
      items,
      adjustments: response.adjustments || {},
      sessionPlan: response.sessionPlan || {},
      recommendations: response.recommendations || {},
    };
  }

  // Mark item as reviewed
  markReviewed(itemId) {
    this.reviewedToday.add(itemId);
  }

  // Record review with reconciliation-aware intervals
  async processReview(itemId, rating, responseTimeMs, token, options = {}) {
    const userId = parseInt(token) || 1;
    const profile = this.profileManager.getProfile(userId);
    const item = mockDB.getLearningPoint(itemId);

    if (!item) {
      return { error: 'Item not found' };
    }

    // Calculate new box
    let newBox = item.box;
    let correctStreak = item.correct_streak;

    if (rating === 1) {
      newBox = 1;
      correctStreak = 0;
    } else if (rating === 2) {
      correctStreak = 0;
    } else if (rating === 3) {
      newBox = Math.min(item.box + 1, 5);
      correctStreak += 1;
    } else if (rating === 4) {
      newBox = Math.min(item.box + 2, 5);
      correctStreak += 1;
    }

    // Calculate personalized interval
    const baseInterval = this.getBoxInterval(newBox, rating);
    const personalizedInterval = this.calculatePersonalizedInterval(
      baseInterval,
      profile,
      rating,
      newBox,
      correctStreak
    );

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + personalizedInterval);

    // Update item
    const updates = {
      box: newBox,
      next_review: nextReview.toISOString().split('T')[0],
      last_reviewed_at: new Date().toISOString(),
      review_count: item.review_count + 1,
      correct_streak: correctStreak,
      mastery_level: Math.min(100, Math.round((newBox / 5) * 100)),
    };

    const updated = mockDB.updateLearningPoint(itemId, updates);

    // Mark as reviewed today
    this.markReviewed(itemId);

    // Record episode
    this.episodeCollector.recordEvent('REVIEW_COMPLETED', {
      conceptId: itemId,
      conceptName: item.front,
      rating,
      responseTimeMs,
      previousBox: item.box,
      newBox,
      interval: personalizedInterval,
    }, userId);

    return {
      success: true,
      box: updated.box,
      nextReview: updated.next_review,
      interval: personalizedInterval,
      masteryLevel: updated.mastery_level,
    };
  }

  getBoxInterval(box, rating) {
    const baseIntervals = [1, 2, 4, 7, 14];
    const ratingModifiers = { 1: 0.5, 2: 0.8, 3: 1.0, 4: 1.5 };
    return Math.round(baseIntervals[box - 1] * (ratingModifiers[rating] || 1.0));
  }

  calculatePersonalizedInterval(baseInterval, profile, rating, box, streak) {
    if (!profile) return baseInterval;

    const optimalInterval = profile.optimalReviewInterval || 3;
    let interval = baseInterval * (optimalInterval / 3);

    // Rating modifier
    const ratingModifier = { 1: 0.5, 2: 0.8, 3: 1.0, 4: 1.3 };
    interval *= ratingModifier[rating] || 1.0;

    // Box modifier
    const boxModifier = Math.pow(1.1, box - 1);
    interval *= boxModifier;

    // Streak bonus
    if (streak >= 3) {
      interval *= 1.1;
    }

    // Bounds
    return Math.max(1, Math.min(90, Math.round(interval)));
  }

  // Generate catch-up plan
  async generateCatchUpPlan(token, options = {}) {
    const userId = parseInt(token) || 1;
    const profile = this.profileManager.getProfile(userId);

    const overdueGrouped = this.learningPlanManager.getOverdueItemsByGap(null, profile);

    const context = {
      totalOverdueCount: overdueGrouped.total,
      daysSinceLastSession: options.daysSinceLastSession || 0,
      profile,
      availableMinutesPerDay: options.availableMinutesPerDay || 30,
      targetCatchUpDays: options.targetCatchUpDays || 7,
      overdueByDomain: [], // Simplified for test
    };

    if (this.aiProvider.isAvailable()) {
      try {
        const response = await this.aiProvider.generateContentWithJson(context);
        if (response && !response.error) {
          return {
            success: true,
            source: 'llm',
            plan: response.plan,
            strategy: response.strategy,
            motivation: response.motivation,
          };
        }
      } catch (error) {
        console.error('Catch-up plan generation failed:', error);
      }
    }

    // Fallback to rule-based plan
    return this.generateRuleBasedCatchUpPlan(context, overdueGrouped);
  }

  generateRuleBasedCatchUpPlan(context, overdueGrouped) {
    const { availableMinutesPerDay, targetCatchUpDays, profile } = context;
    const itemsPerMinute = 2;
    const dailyCapacity = availableMinutesPerDay * itemsPerMinute;

    const totalItems = overdueGrouped.total;
    const daysNeeded = Math.ceil(totalItems / dailyCapacity);

    return {
      success: true,
      source: 'rule_based',
      plan: {
        totalDays: Math.max(daysNeeded, targetCatchUpDays),
        dailyItemCount: Math.min(dailyCapacity, Math.ceil(totalItems / targetCatchUpDays)),
        priorityTiers: {
          critical: overdueGrouped.critical.length,
          important: overdueGrouped.important.length,
          routine: overdueGrouped.routine.length,
        },
      },
      strategy: {
        approach: 'Start with critical items, then important, then routine',
        dailyGoal: `Review ${Math.min(dailyCapacity, 20)} items per day`,
      },
    };
  }

  // Clear cache and reset for new day
  resetForNewDay() {
    this.reviewedToday.clear();
    this.cache.clear();
  }
}

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Schedule Reconciliation Integration Tests', () => {
  let agent;

  beforeEach(() => {
    mockDB.reset();
    jest.clearAllMocks();
    agent = new MockScheduleReconciliationAgent();
  });

  // ===========================================================================
  // BASIC RECONCILIATION FLOW
  // ===========================================================================

  describe('Basic Reconciliation Flow', () => {
    beforeEach(() => {
      // Set up learner profile
      mockDB.setProfile(1, {
        forgettingCurveSlope: 0.4,
        optimalReviewInterval: 3,
        averageRetentionRate: 0.75,
        pacePreference: 'steady',
        consistencyScore: 70,
      });

      // Create learning items with various overdue states
      const today = new Date();
      const daysAgo = (days) => {
        const date = new Date(today);
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
      };

      // Critical items (> 6 days overdue with optimal=3)
      mockDB.createLearningPoint({
        front: 'Critical Item 1',
        back: 'Answer 1',
        next_review: daysAgo(10),
        box: 2,
      }, 1);

      mockDB.createLearningPoint({
        front: 'Critical Item 2',
        back: 'Answer 2',
        next_review: daysAgo(8),
        box: 3,
      }, 1);

      // Important items (3-6 days overdue)
      mockDB.createLearningPoint({
        front: 'Important Item 1',
        back: 'Answer 3',
        next_review: daysAgo(5),
        box: 1,
      }, 1);

      // Routine items (< 3 days overdue)
      mockDB.createLearningPoint({
        front: 'Routine Item 1',
        back: 'Answer 4',
        next_review: daysAgo(1),
        box: 1,
      }, 1);

      mockDB.createLearningPoint({
        front: 'Routine Item 2',
        back: 'Answer 5',
        next_review: daysAgo(2),
        box: 2,
      }, 1);
    });

    test('getDueItemsReconciled returns prioritized items without LLM', async () => {
      const result = await agent.getDueItemsReconciled(null, 10, '1', {
        useReconciliation: false,
      });

      expect(result.reconciled).toBe(false);
      expect(result.source).toBe('basic');
      expect(result.items.length).toBe(5);

      // Critical items should be first
      expect(result.items[0].front).toContain('Critical');
      expect(result.items[0].gapSeverity).toBe('SEVERE');

      // All items should have decay and priority calculated
      result.items.forEach((item) => {
        expect(item.daysOverdue).toBeDefined();
        expect(item.decayedMastery).toBeDefined();
        expect(item.priority).toBeDefined();
      });
    });

    test('getDueItemsReconciled with LLM reconciliation', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        prioritizedItems: [
          { itemId: 'lp-1', priority: 10, reason: 'Highest decay risk', suggestedInterval: 2 },
          { itemId: 'lp-2', priority: 9, reason: 'High decay risk', suggestedInterval: 3 },
          { itemId: 'lp-3', priority: 7, reason: 'Moderate decay', suggestedInterval: 4 },
        ],
        adjustments: {
          intervalMultiplier: 0.8,
          reasoning: 'Extended gap detected, using shorter intervals',
        },
        sessionPlan: {
          recommendedItemCount: 15,
          estimatedDurationMinutes: 20,
          focusAreas: ['Critical vocabulary'],
        },
        recommendations: {
          studyOrder: 'Start with most overdue items',
          breakSuggestion: 'Take break after 10 items',
        },
      });

      const result = await agent.getDueItemsReconciled(null, 10, '1', {
        useReconciliation: true,
      });

      expect(result.reconciled).toBe(true);
      expect(result.source).toBe('llm');
      expect(result.adjustments).toBeDefined();
      expect(result.adjustments.intervalMultiplier).toBe(0.8);
      expect(result.sessionPlan).toBeDefined();
      expect(result.recommendations).toBeDefined();

      // First items should have LLM-assigned priorities
      expect(result.items[0].llmPriority).toBe(10);
      expect(result.items[0].llmReason).toBe('Highest decay risk');
    });

    test('LLM reconciliation fallback on error', async () => {
      mockAIProvider.generateContentWithJson.mockRejectedValue(new Error('API Error'));

      const result = await agent.getDueItemsReconciled(null, 10, '1', {
        useReconciliation: true,
      });

      expect(result.reconciled).toBe(false);
      expect(result.source).toBe('basic');
      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // GAP ANALYSIS
  // ===========================================================================

  describe('Gap Analysis', () => {
    test('analyzeGap returns correct severity levels', () => {
      const profile = { optimalReviewInterval: 4 };

      expect(agent.analyzeGap(profile, 1).severity).toBe('NONE'); // 0.25x
      expect(agent.analyzeGap(profile, 3).severity).toBe('MINOR'); // 0.75x
      expect(agent.analyzeGap(profile, 6).severity).toBe('MODERATE'); // 1.5x
      expect(agent.analyzeGap(profile, 10).severity).toBe('MAJOR'); // 2.5x
      expect(agent.analyzeGap(profile, 15).severity).toBe('SEVERE'); // 3.75x
    });

    test('analyzeGap with null profile uses defaults', () => {
      const result = agent.analyzeGap(null, 6);

      expect(result.severity).toBe('MODERATE'); // 6/3 = 2x with default interval of 3
    });

    test('analyzeGap includes ratio and days', () => {
      const profile = { optimalReviewInterval: 5 };
      const result = agent.analyzeGap(profile, 10);

      expect(result.ratio).toBe(2);
      expect(result.daysSinceLastReview).toBe(10);
    });
  });

  // ===========================================================================
  // DECAY CALCULATION
  // ===========================================================================

  describe('Decay Calculation', () => {
    test('calculatePersonalDecay based on profile', () => {
      const profile = {
        forgettingCurveSlope: 0.3,
        averageRetentionRate: 0.8,
      };

      // Low decay for short time
      const shortDecay = agent.calculatePersonalDecay(profile, 3, 1);
      expect(shortDecay).toBeGreaterThan(0.6);

      // Higher decay for longer time
      const longDecay = agent.calculatePersonalDecay(profile, 14, 1);
      expect(longDecay).toBeLessThan(shortDecay);
    });

    test('calculatePersonalDecay considers box level', () => {
      const profile = {
        forgettingCurveSlope: 0.5,
        averageRetentionRate: 0.7,
      };

      const box1Decay = agent.calculatePersonalDecay(profile, 7, 1);
      const box5Decay = agent.calculatePersonalDecay(profile, 7, 5);

      // Higher box should decay slower
      expect(box5Decay).toBeGreaterThan(box1Decay);
    });

    test('calculatePersonalDecay bounds between 0 and 1', () => {
      const profile = {
        forgettingCurveSlope: 2.0, // Very steep
        averageRetentionRate: 0.5,
      };

      const decay = agent.calculatePersonalDecay(profile, 100, 1);
      expect(decay).toBeGreaterThanOrEqual(0);
      expect(decay).toBeLessThanOrEqual(1);
    });
  });

  // ===========================================================================
  // REVIEW PROCESSING WITH PERSONALIZED INTERVALS
  // ===========================================================================

  describe('Review Processing with Personalized Intervals', () => {
    beforeEach(() => {
      mockDB.setProfile(1, {
        forgettingCurveSlope: 0.4,
        optimalReviewInterval: 5, // Longer than default
        averageRetentionRate: 0.8,
      });

      mockDB.createLearningPoint({
        front: 'Test Question',
        back: 'Test Answer',
        box: 2,
        review_count: 5,
        correct_streak: 2,
      }, 1);
    });

    test('processReview calculates personalized interval', async () => {
      const result = await agent.processReview('lp-1', 3, 2000, '1');

      expect(result.success).toBe(true);
      expect(result.box).toBe(3);
      expect(result.interval).toBeDefined();
      // With optimal interval 5 (vs default 3), intervals should be longer
      expect(result.interval).toBeGreaterThan(2);
    });

    test('processReview marks item as reviewed today', async () => {
      await agent.processReview('lp-1', 3, 2000, '1');

      // Item should be filtered out of subsequent due items calls
      const dueItems = await agent.getDueItemsReconciled(null, 10, '1');

      // The reviewed item should not appear
      expect(dueItems.items.find((i) => i.id === 'lp-1')).toBeUndefined();
    });

    test('processReview records episode', async () => {
      await agent.processReview('lp-1', 3, 2000, '1');

      expect(mockEpisodeCollector.recordEvent).toHaveBeenCalledWith(
        'REVIEW_COMPLETED',
        expect.objectContaining({
          conceptId: 'lp-1',
          rating: 3,
          responseTimeMs: 2000,
          previousBox: 2,
          newBox: 3,
        }),
        1
      );
    });

    test('processReview handles all rating values', async () => {
      // Create 4 items for each rating
      for (let i = 2; i <= 5; i++) {
        mockDB.createLearningPoint({
          front: `Question ${i}`,
          back: `Answer ${i}`,
          box: 2,
        }, 1);
      }

      // Rate 1 (Again) - resets to box 1
      const again = await agent.processReview('lp-2', 1, 5000, '1');
      expect(again.box).toBe(1);

      // Rate 2 (Hard) - stays at box 2
      const hard = await agent.processReview('lp-3', 2, 3000, '1');
      expect(hard.box).toBe(2);

      // Rate 3 (Good) - advances to box 3
      const good = await agent.processReview('lp-4', 3, 2000, '1');
      expect(good.box).toBe(3);

      // Rate 4 (Easy) - skips to box 4
      const easy = await agent.processReview('lp-5', 4, 1000, '1');
      expect(easy.box).toBe(4);
    });
  });

  // ===========================================================================
  // SAME-DAY SESSION HANDLING
  // ===========================================================================

  describe('Same-Day Session Handling', () => {
    beforeEach(() => {
      const today = new Date().toISOString().split('T')[0];

      for (let i = 1; i <= 5; i++) {
        mockDB.createLearningPoint({
          front: `Question ${i}`,
          back: `Answer ${i}`,
          next_review: today,
          box: 1,
        }, 1);
      }
    });

    test('items reviewed are excluded from subsequent sessions', async () => {
      // First session gets all 5 items
      const session1 = await agent.getDueItemsReconciled(null, 10, '1');
      expect(session1.items.length).toBe(5);

      // Review 3 items
      await agent.processReview('lp-1', 3, 2000, '1');
      await agent.processReview('lp-2', 3, 2000, '1');
      await agent.processReview('lp-3', 3, 2000, '1');

      // Second session should only show 2 unreviewed items
      const session2 = await agent.getDueItemsReconciled(null, 10, '1');
      expect(session2.items.length).toBe(2);

      // The reviewed items should not be in the list
      const reviewedIds = ['lp-1', 'lp-2', 'lp-3'];
      session2.items.forEach((item) => {
        expect(reviewedIds).not.toContain(item.id);
      });
    });

    test('resetForNewDay clears reviewed items', async () => {
      // Review some items
      await agent.processReview('lp-1', 3, 2000, '1');
      await agent.processReview('lp-2', 3, 2000, '1');

      // Reset for new day
      agent.resetForNewDay();

      // Now items should be available again (if they become due)
      // Note: In reality, next_review would be in the future after review
      // This test just verifies the set is cleared
      expect(agent.reviewedToday.size).toBe(0);
    });
  });

  // ===========================================================================
  // CATCH-UP PLAN GENERATION
  // ===========================================================================

  describe('Catch-Up Plan Generation', () => {
    beforeEach(() => {
      mockDB.setProfile(1, {
        forgettingCurveSlope: 0.5,
        optimalReviewInterval: 3,
        averageRetentionRate: 0.7,
        pacePreference: 'steady',
        optimalSessionLength: 25,
        consistencyScore: 60,
      });

      // Create 50 overdue items
      const daysAgo = (days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
      };

      for (let i = 1; i <= 50; i++) {
        mockDB.createLearningPoint({
          front: `Question ${i}`,
          back: `Answer ${i}`,
          next_review: daysAgo(i % 15 + 1), // Various overdue dates
          box: (i % 5) + 1,
        }, 1);
      }
    });

    test('generateCatchUpPlan with LLM', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        plan: {
          totalDays: 7,
          dailySchedule: [
            { day: 1, itemCount: 10, intensity: 'light' },
            { day: 2, itemCount: 12, intensity: 'moderate' },
          ],
          priorityTiers: { critical: 10, important: 20, routine: 20 },
        },
        strategy: {
          approach: 'Gradual ramp-up',
          dailyGoal: 'Review 10-15 items',
        },
        motivation: {
          encouragement: 'You can do this!',
        },
      });

      const result = await agent.generateCatchUpPlan('1', {
        availableMinutesPerDay: 30,
        targetCatchUpDays: 7,
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('llm');
      expect(result.plan).toBeDefined();
      expect(result.strategy).toBeDefined();
      expect(result.motivation).toBeDefined();
    });

    test('generateCatchUpPlan falls back to rule-based', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue(null);

      const result = await agent.generateCatchUpPlan('1', {
        availableMinutesPerDay: 30,
        targetCatchUpDays: 7,
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('rule_based');
      expect(result.plan.priorityTiers).toBeDefined();
      expect(result.plan.dailyItemCount).toBeGreaterThan(0);
    });

    test('catch-up plan respects available time', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue(null);

      const shortTime = await agent.generateCatchUpPlan('1', {
        availableMinutesPerDay: 10,
        targetCatchUpDays: 7,
      });

      const longTime = await agent.generateCatchUpPlan('1', {
        availableMinutesPerDay: 60,
        targetCatchUpDays: 7,
      });

      // With more time, daily item count should be at least equal (may be capped by total items / days)
      // The formula is: Math.min(dailyCapacity, Math.ceil(totalItems / targetCatchUpDays))
      // When total items (50) / days (7) = 8, this becomes the limiter regardless of capacity
      expect(longTime.plan.dailyItemCount).toBeGreaterThanOrEqual(shortTime.plan.dailyItemCount);
    });
  });

  // ===========================================================================
  // OVERDUE GROUPING BY GAP
  // ===========================================================================

  describe('Overdue Grouping by Gap', () => {
    beforeEach(() => {
      mockDB.setProfile(1, { optimalReviewInterval: 4 });

      const daysAgo = (days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
      };

      // Critical: > 8 days (2x optimal)
      mockDB.createLearningPoint({ front: 'Critical 1', back: 'A', next_review: daysAgo(12), box: 1 }, 1);
      mockDB.createLearningPoint({ front: 'Critical 2', back: 'A', next_review: daysAgo(10), box: 1 }, 1);

      // Important: 4-8 days (1-2x optimal)
      mockDB.createLearningPoint({ front: 'Important 1', back: 'A', next_review: daysAgo(6), box: 1 }, 1);
      mockDB.createLearningPoint({ front: 'Important 2', back: 'A', next_review: daysAgo(5), box: 1 }, 1);

      // Routine: < 4 days (< 1x optimal)
      mockDB.createLearningPoint({ front: 'Routine 1', back: 'A', next_review: daysAgo(2), box: 1 }, 1);
      mockDB.createLearningPoint({ front: 'Routine 2', back: 'A', next_review: daysAgo(1), box: 1 }, 1);
    });

    test('getOverdueItemsByGap groups correctly', () => {
      const profile = { optimalReviewInterval: 4 };
      const grouped = mockLearningPlanManager.getOverdueItemsByGap(null, profile);

      expect(grouped.critical.length).toBe(2);
      expect(grouped.important.length).toBe(2);
      expect(grouped.routine.length).toBe(2);
      expect(grouped.total).toBe(6);
    });

    test('groups are sorted by days overdue', () => {
      const profile = { optimalReviewInterval: 4 };
      const grouped = mockLearningPlanManager.getOverdueItemsByGap(null, profile);

      // Critical should be sorted descending by days overdue
      expect(grouped.critical[0].daysOverdue).toBeGreaterThan(grouped.critical[1].daysOverdue);
    });
  });

  // ===========================================================================
  // FULL STUDY SESSION SIMULATION
  // ===========================================================================

  describe('Full Study Session Simulation', () => {
    beforeEach(() => {
      mockDB.setProfile(1, {
        forgettingCurveSlope: 0.4,
        optimalReviewInterval: 3,
        averageRetentionRate: 0.75,
        pacePreference: 'steady',
      });

      const daysAgo = (days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
      };

      // Create 20 items with various states
      for (let i = 1; i <= 20; i++) {
        mockDB.createLearningPoint({
          front: `Vocabulary ${i}`,
          back: `Definition ${i}`,
          next_review: daysAgo(i % 10 + 1),
          box: (i % 5) + 1,
          correct_streak: i % 3,
        }, 1);
      }
    });

    test('simulates complete study session with reconciliation', async () => {
      // 1. Get reconciled due items
      const session1Items = await agent.getDueItemsReconciled(null, 10, '1', {
        useReconciliation: false,
      });

      expect(session1Items.items.length).toBe(10);
      expect(session1Items.items[0].gapSeverity).toBeDefined();

      // 2. Process reviews (mix of ratings)
      const results = [];
      for (let i = 0; i < 10; i++) {
        const item = session1Items.items[i];
        const rating = (i % 4) + 1; // Cycle through 1-4 ratings
        const result = await agent.processReview(item.id, rating, 2000 + i * 100, '1');
        results.push(result);
      }

      // Verify all reviews processed
      expect(results.every((r) => r.success)).toBe(true);

      // 3. Items should be excluded from next session
      const session2Items = await agent.getDueItemsReconciled(null, 10, '1');
      expect(session2Items.items.length).toBe(10); // Next 10 items

      // None of the reviewed items should appear
      const reviewedIds = session1Items.items.map((i) => i.id);
      session2Items.items.forEach((item) => {
        expect(reviewedIds).not.toContain(item.id);
      });

      // 4. Episodes should be recorded
      expect(mockEpisodeCollector.recordEvent).toHaveBeenCalledTimes(10);
    });

    test('simulates session with LLM adjustments', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        prioritizedItems: Array.from({ length: 10 }, (_, i) => ({
          itemId: `lp-${i + 1}`,
          priority: 10 - i,
          reason: `Priority reason ${i}`,
          suggestedInterval: 3 + i,
        })),
        adjustments: {
          intervalMultiplier: 0.7,
          reasoning: 'Significant learning gap detected',
        },
        sessionPlan: {
          recommendedItemCount: 15,
          estimatedDurationMinutes: 20,
        },
        recommendations: {
          studyOrder: 'Focus on critical items first',
        },
      });

      const session = await agent.getDueItemsReconciled(null, 10, '1', {
        useReconciliation: true,
      });

      expect(session.reconciled).toBe(true);
      expect(session.adjustments.intervalMultiplier).toBe(0.7);

      // Items should have LLM metadata
      expect(session.items[0].llmPriority).toBeDefined();
      expect(session.items[0].llmReason).toBeDefined();
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('Error Handling', () => {
    test('handles missing profile gracefully', async () => {
      // No profile set
      mockDB.createLearningPoint({
        front: 'Question',
        back: 'Answer',
        next_review: new Date().toISOString().split('T')[0],
      }, 1);

      const result = await agent.getDueItemsReconciled(null, 10, '1');

      expect(result.items.length).toBe(1);
      // Should use defaults
      expect(result.items[0].gapSeverity).toBeDefined();
    });

    test('handles non-existent item review', async () => {
      const result = await agent.processReview('non-existent', 3, 2000, '1');

      expect(result.error).toBe('Item not found');
    });

    test('handles empty due items list', async () => {
      // No items created
      const result = await agent.getDueItemsReconciled(null, 10, '1');

      expect(result.items).toEqual([]);
      expect(result.source).toBe('basic');
    });

    test('handles AI provider unavailable', async () => {
      mockAIProvider.isAvailable.mockReturnValue(false);

      mockDB.createLearningPoint({
        front: 'Question',
        back: 'Answer',
        next_review: new Date().toISOString().split('T')[0],
      }, 1);

      const result = await agent.getDueItemsReconciled(null, 10, '1', {
        useReconciliation: true,
      });

      // Should fall back to basic
      expect(result.reconciled).toBe(false);
      expect(result.source).toBe('basic');
    });
  });
});
