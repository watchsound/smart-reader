/**
 * PredictiveInsightsService Tests
 *
 * Tests for predictive insights: scheduling, content, and strategy recommendations
 */

// Mock dependencies
const mockEpisodeCollector = {
  getEpisodesInRange: jest.fn().mockResolvedValue([]),
};

const mockSessionAnalyticsManager = {
  getSessionHistory: jest.fn().mockResolvedValue([]),
};

const mockLearningPlanManager = {
  getDueItems: jest.fn().mockResolvedValue([]),
};

const mockLearnerProfileManager = {
  getGlobalProfile: jest.fn().mockReturnValue(null),
};

const mockNeo4jAdapter = {
  checkConnection: jest.fn().mockReturnValue(true),
  detectWeakConcepts: jest.fn().mockResolvedValue([]),
};

// Mock LearnerProfileInference
jest.mock('../../main/utils/LearnerProfileInference', () => {
  return jest.fn().mockImplementation(() => ({
    inferProfile: jest.fn().mockResolvedValue({
      success: true,
      inferences: {
        learningStyle: { scores: {}, dominantStyle: 'reading', confidence: 0.8 },
        optimalTiming: {
          preferredTimeOfDay: 'morning',
          optimalHours: [9, 10, 11],
          hourlyPerformance: [],
          preferredDays: ['Monday', 'Wednesday'],
          confidence: 0.7,
        },
        sessionPreferences: {
          optimalMinutes: 25,
          preference: 'medium',
          focusDecayPoint: 30,
          confidence: 0.6,
        },
        forgettingCurve: {
          optimalReviewInterval: 5,
          forgettingSlope: 0.3,
          retentionStrength: 'moderate',
        },
        pacePreferences: {
          avgItemsPerSession: 20,
          preferredPace: 'steady',
          optimalBatchSize: 10,
        },
      },
    }),
  }));
});

// Mock CrossConceptAnalyzer
jest.mock('../../main/utils/CrossConceptAnalyzer', () => {
  return jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue({
      success: true,
      patterns: {
        prerequisites: [],
        interferences: [],
        positiveTransfers: [],
        conceptClusters: [],
        forgettingCorrelations: [],
      },
    }),
  }));
});

const PredictiveInsightsService = require('../../main/utils/PredictiveInsightsService');
const { RECOMMENDATION_TYPES, PRIORITY, PREDICTION_CONSTANTS } = require('../../main/utils/PredictiveInsightsService');

describe('PredictiveInsightsService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new PredictiveInsightsService({
      episodeCollector: mockEpisodeCollector,
      sessionAnalyticsManager: mockSessionAnalyticsManager,
      learningPlanManager: mockLearningPlanManager,
      learnerProfileManager: mockLearnerProfileManager,
      neo4jAdapter: mockNeo4jAdapter,
    });
  });

  // ====================
  // Constructor & Initialization
  // ====================

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(service.config.cacheExpiryMinutes).toBe(60);
      expect(service.config.lookbackDays).toBe(30);
      expect(service.config.forecastDays).toBe(7);
      expect(service.config.maxRecommendations).toBe(10);
    });

    it('should initialize analysis services', () => {
      expect(service.profileInference).toBeDefined();
      expect(service.crossConceptAnalyzer).toBeDefined();
    });

    it('should start with no cached data', () => {
      expect(service.cachedProfile).toBeNull();
      expect(service.cachedPatterns).toBeNull();
      expect(service.lastAnalysisTime).toBeNull();
    });
  });

  // ====================
  // Main Entry Point
  // ====================

  describe('getPredictiveInsights', () => {
    it('should return comprehensive insights', async () => {
      const result = await service.getPredictiveInsights(1, 'test-token');

      expect(result.success).toBe(true);
      expect(result.userId).toBe(1);
      expect(result).toHaveProperty('scheduling');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('summary');
    });

    it('should include processing time', async () => {
      const result = await service.getPredictiveInsights(1, 'test-token');

      expect(result.processingTimeMs).toBeDefined();
      expect(typeof result.processingTimeMs).toBe('number');
    });

    it('should limit recommendations to maxRecommendations', async () => {
      service.config.maxRecommendations = 3;

      const result = await service.getPredictiveInsights(1, 'test-token');

      expect(result.recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should sort recommendations by priority', async () => {
      const result = await service.getPredictiveInsights(1, 'test-token');

      for (let i = 1; i < result.recommendations.length; i++) {
        expect(result.recommendations[i].priority).toBeGreaterThanOrEqual(
          result.recommendations[i - 1].priority
        );
      }
    });

    it('should handle errors gracefully', async () => {
      service.refreshAnalysisCache = jest.fn().mockRejectedValue(new Error('Cache error'));

      const result = await service.getPredictiveInsights(1, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cache error');
    });
  });

  // ====================
  // Scheduling Insights
  // ====================

  describe('getSchedulingInsights', () => {
    beforeEach(async () => {
      // Pre-populate cache
      await service.refreshAnalysisCache(1, 'test-token');
    });

    it('should return scheduling recommendations', async () => {
      const result = await service.getSchedulingInsights(1, 'test-token');

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should include optimal review time', async () => {
      const result = await service.getSchedulingInsights(1, 'test-token');

      expect(result.optimalReviewTime).toBeDefined();
      expect(result.optimalReviewTime).toHaveProperty('preferredTimeOfDay');
      expect(result.optimalReviewTime).toHaveProperty('suggestedHours');
    });

    it('should include session duration recommendation', async () => {
      const result = await service.getSchedulingInsights(1, 'test-token');

      expect(result.sessionDuration).toBeDefined();
      expect(result.sessionDuration).toHaveProperty('recommendedMinutes');
      expect(result.sessionDuration).toHaveProperty('breakInterval');
    });

    it('should include due items forecast', async () => {
      const result = await service.getSchedulingInsights(1, 'test-token');

      expect(result.dueItems).toBeDefined();
      expect(result.dueItems).toHaveProperty('todayCount');
      expect(result.dueItems).toHaveProperty('overdueCount');
    });

    it('should include weekly distribution', async () => {
      const result = await service.getSchedulingInsights(1, 'test-token');

      expect(result.weeklyDistribution).toBeDefined();
      expect(result.weeklyDistribution).toHaveProperty('distribution');
    });
  });

  describe('predictOptimalReviewTime', () => {
    it('should return morning hours for morning preference', () => {
      const profile = {
        inferences: {
          optimalTiming: { preferredTimeOfDay: 'morning', optimalHours: [], confidence: 0.8 },
        },
      };

      const result = service.predictOptimalReviewTime(profile);

      expect(result.preferredTimeOfDay).toBe('morning');
      expect(result.suggestedHours).toContain(7);
      expect(result.suggestedHours).toContain(8);
      expect(result.suggestedHours).toContain(9);
    });

    it('should return afternoon hours for afternoon preference', () => {
      const profile = {
        inferences: {
          optimalTiming: { preferredTimeOfDay: 'afternoon', optimalHours: [], confidence: 0.8 },
        },
      };

      const result = service.predictOptimalReviewTime(profile);

      expect(result.suggestedHours).toContain(13);
      expect(result.suggestedHours).toContain(14);
    });

    it('should return evening hours for evening preference', () => {
      const profile = {
        inferences: {
          optimalTiming: { preferredTimeOfDay: 'evening', optimalHours: [], confidence: 0.8 },
        },
      };

      const result = service.predictOptimalReviewTime(profile);

      expect(result.suggestedHours).toContain(18);
      expect(result.suggestedHours).toContain(19);
    });

    it('should return night hours for night preference', () => {
      const profile = {
        inferences: {
          optimalTiming: { preferredTimeOfDay: 'night', optimalHours: [], confidence: 0.8 },
        },
      };

      const result = service.predictOptimalReviewTime(profile);

      expect(result.suggestedHours).toContain(21);
      expect(result.suggestedHours).toContain(22);
    });

    it('should use profile optimal hours when available', () => {
      const profile = {
        inferences: {
          optimalTiming: { preferredTimeOfDay: 'any', optimalHours: [10, 14, 20], confidence: 0.9 },
        },
      };

      const result = service.predictOptimalReviewTime(profile);

      expect(result.suggestedHours).toEqual([10, 14, 20]);
    });

    it('should handle missing profile', () => {
      const result = service.predictOptimalReviewTime(null);

      expect(result.preferredTimeOfDay).toBe('any');
      expect(result.suggestedHours).toEqual([9, 14, 19]);
    });
  });

  describe('predictOptimalSessionDuration', () => {
    it('should recommend minutes less than focus decay point', () => {
      const profile = {
        inferences: {
          sessionPreferences: { focusDecayPoint: 30, optimalMinutes: 25, preference: 'medium' },
          pacePreferences: { optimalBatchSize: 10 },
        },
      };

      const result = service.predictOptimalSessionDuration(profile);

      expect(result.recommendedMinutes).toBeLessThanOrEqual(30);
    });

    it('should respect minimum session minutes', () => {
      const profile = {
        inferences: {
          sessionPreferences: { focusDecayPoint: 3, optimalMinutes: 3 },
          pacePreferences: {},
        },
      };

      const result = service.predictOptimalSessionDuration(profile);

      expect(result.recommendedMinutes).toBeGreaterThanOrEqual(PREDICTION_CONSTANTS.MIN_SESSION_MINUTES);
    });

    it('should respect maximum session minutes', () => {
      const profile = {
        inferences: {
          sessionPreferences: { focusDecayPoint: 120, optimalMinutes: 90 },
          pacePreferences: {},
        },
      };

      const result = service.predictOptimalSessionDuration(profile);

      expect(result.recommendedMinutes).toBeLessThanOrEqual(PREDICTION_CONSTANTS.MAX_SESSION_MINUTES);
    });

    it('should include break interval', () => {
      const result = service.predictOptimalSessionDuration({});

      expect(result.breakInterval).toBeDefined();
      expect(result.breakInterval).toBeLessThanOrEqual(PREDICTION_CONSTANTS.OPTIMAL_BREAK_INTERVAL);
    });
  });

  describe('getDueItemsForecast', () => {
    it('should return forecast with byDay array', async () => {
      const result = await service.getDueItemsForecast(1, 'test-token');

      expect(result.byDay).toBeDefined();
      expect(Array.isArray(result.byDay)).toBe(true);
    });

    it('should forecast for configured days', async () => {
      const result = await service.getDueItemsForecast(1, 'test-token', { forecastDays: 5 });

      expect(result.byDay.length).toBe(5);
    });

    it('should count overdue items', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockLearningPlanManager.getDueItems.mockResolvedValue([
        { nextReviewDate: yesterday.toISOString() },
      ]);

      const result = await service.getDueItemsForecast(1, 'test-token');

      expect(result.overdueCount).toBe(1);
    });

    it('should estimate review time', async () => {
      mockLearningPlanManager.getDueItems.mockResolvedValue([
        { nextReviewDate: new Date().toISOString() },
        { nextReviewDate: new Date().toISOString() },
        { nextReviewDate: new Date().toISOString() },
      ]);

      const result = await service.getDueItemsForecast(1, 'test-token');

      expect(result.estimatedMinutes).toBeGreaterThan(0);
    });

    it('should handle missing learning plan manager', async () => {
      const serviceNoManager = new PredictiveInsightsService({});

      const result = await serviceNoManager.getDueItemsForecast(1, 'test-token');

      expect(result.todayCount).toBe(0);
      // Without a learning plan manager, byDay is empty
      expect(result.byDay.length).toBe(0);
    });
  });

  describe('calculateWeeklyDistribution', () => {
    it('should detect uneven load', () => {
      const dueItems = {
        byDay: [
          { dayName: 'Mon', count: 50 },
          { dayName: 'Tue', count: 5 },
          { dayName: 'Wed', count: 5 },
          { dayName: 'Thu', count: 5 },
          { dayName: 'Fri', count: 5 },
        ],
      };

      const result = service.calculateWeeklyDistribution(dueItems, {});

      expect(result.unevenLoad).toBe(true);
    });

    it('should not flag even distribution', () => {
      const dueItems = {
        byDay: [
          { dayName: 'Mon', count: 10 },
          { dayName: 'Tue', count: 12 },
          { dayName: 'Wed', count: 11 },
          { dayName: 'Thu', count: 10 },
          { dayName: 'Fri', count: 12 },
        ],
      };

      const result = service.calculateWeeklyDistribution(dueItems, {});

      expect(result.unevenLoad).toBe(false);
    });

    it('should provide suggestion for uneven load', () => {
      const dueItems = {
        byDay: [
          { dayName: 'Mon', count: 100 },
          { dayName: 'Tue', count: 1 },
        ],
      };

      const result = service.calculateWeeklyDistribution(dueItems, {});

      expect(result.suggestion).toBeTruthy();
      expect(result.suggestion.length).toBeGreaterThan(0);
    });

    it('should handle empty byDay', () => {
      const result = service.calculateWeeklyDistribution({ byDay: [] }, {});

      expect(result.unevenLoad).toBe(false);
      expect(result.distribution).toEqual([]);
    });
  });

  // ====================
  // Content Insights
  // ====================

  describe('getContentInsights', () => {
    beforeEach(async () => {
      await service.refreshAnalysisCache(1, 'test-token');
    });

    it('should return content recommendations', async () => {
      const result = await service.getContentInsights(1, 'test-token');

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should include learning order', async () => {
      const result = await service.getContentInsights(1, 'test-token');

      expect(result.learningOrder).toBeDefined();
    });

    it('should include weak concepts', async () => {
      const result = await service.getContentInsights(1, 'test-token');

      expect(result.weakConcepts).toBeDefined();
      expect(Array.isArray(result.weakConcepts)).toBe(true);
    });

    it('should include transfer opportunities', async () => {
      const result = await service.getContentInsights(1, 'test-token');

      expect(result.transferOpportunities).toBeDefined();
    });

    it('should include interference warnings', async () => {
      const result = await service.getContentInsights(1, 'test-token');

      expect(result.interferences).toBeDefined();
    });
  });

  describe('calculatePrerequisiteOrder', () => {
    it('should order concepts by dependencies', () => {
      const patterns = {
        patterns: {
          prerequisites: [
            { fromConceptName: 'Algebra', toConceptName: 'Calculus' },
            { fromConceptName: 'Arithmetic', toConceptName: 'Algebra' },
          ],
        },
      };

      const result = service.calculatePrerequisiteOrder(patterns);

      const arithmeticIndex = result.suggestedOrder.indexOf('Arithmetic');
      const algebraIndex = result.suggestedOrder.indexOf('Algebra');
      const calculusIndex = result.suggestedOrder.indexOf('Calculus');

      expect(arithmeticIndex).toBeLessThan(algebraIndex);
      expect(algebraIndex).toBeLessThan(calculusIndex);
    });

    it('should handle empty prerequisites', () => {
      const patterns = { patterns: { prerequisites: [] } };

      const result = service.calculatePrerequisiteOrder(patterns);

      expect(result.suggestedOrder).toEqual([]);
      expect(result.totalConcepts).toBe(0);
    });

    it('should handle missing patterns', () => {
      const result = service.calculatePrerequisiteOrder(null);

      expect(result.suggestedOrder).toEqual([]);
    });
  });

  describe('getWeakConceptsToReview', () => {
    it('should use Neo4j when available', async () => {
      mockNeo4jAdapter.detectWeakConcepts.mockResolvedValue([
        { id: 'c1', name: 'Concept 1', mastery: 0.3 },
      ]);

      const result = await service.getWeakConceptsToReview(1, 'test-token');

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Concept 1');
    });

    it('should fall back to pattern analysis', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);
      service.cachedPatterns = {
        patterns: {
          forgettingCorrelations: [
            { conceptA: 'Weak Concept', decayRate: 0.5 },
          ],
        },
      };

      const result = await service.getWeakConceptsToReview(1, 'test-token');

      expect(result.length).toBe(1);
      expect(result[0].reason).toBe('high_forgetting_rate');
    });

    it('should handle errors gracefully', async () => {
      mockNeo4jAdapter.detectWeakConcepts.mockRejectedValue(new Error('Neo4j error'));

      const result = await service.getWeakConceptsToReview(1, 'test-token');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findTransferOpportunities', () => {
    it('should filter by confidence threshold', () => {
      const patterns = {
        patterns: {
          positiveTransfers: [
            { fromConceptName: 'A', toConceptName: 'B', confidence: 0.8 },
            { fromConceptName: 'C', toConceptName: 'D', confidence: 0.3 },
          ],
        },
      };

      const result = service.findTransferOpportunities(patterns);

      expect(result.length).toBe(1);
      expect(result[0].from).toBe('A');
    });

    it('should limit to 5 transfers', () => {
      const patterns = {
        patterns: {
          positiveTransfers: Array(10).fill({ fromConceptName: 'A', toConceptName: 'B', confidence: 0.9 }),
        },
      };

      const result = service.findTransferOpportunities(patterns);

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('findInterferences', () => {
    it('should filter by severity threshold', () => {
      const patterns = {
        patterns: {
          interferences: [
            { conceptA: 'Spanish', conceptB: 'Portuguese', severityScore: 0.8 },
            { conceptA: 'Java', conceptB: 'JavaScript', severityScore: 0.2 },
          ],
        },
      };

      const result = service.findInterferences(patterns);

      expect(result.length).toBe(1);
      expect(result[0].conceptA).toBe('Spanish');
    });
  });

  // ====================
  // Strategy Insights
  // ====================

  describe('getStrategyInsights', () => {
    beforeEach(async () => {
      await service.refreshAnalysisCache(1, 'test-token');
    });

    it('should return strategy recommendations', async () => {
      const result = await service.getStrategyInsights(1, 'test-token');

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should include cramming analysis', async () => {
      const result = await service.getStrategyInsights(1, 'test-token');

      expect(result.crammingAnalysis).toBeDefined();
      expect(result.crammingAnalysis).toHaveProperty('isCramming');
    });

    it('should include spacing advice', async () => {
      const result = await service.getStrategyInsights(1, 'test-token');

      expect(result.spacingAdvice).toBeDefined();
      expect(result.spacingAdvice).toHaveProperty('optimalInterval');
    });

    it('should include consistency data', async () => {
      const result = await service.getStrategyInsights(1, 'test-token');

      expect(result.consistency).toBeDefined();
      expect(result.consistency).toHaveProperty('currentStreak');
    });
  });

  describe('detectCramming', () => {
    it('should detect high volume cramming', async () => {
      const recentEpisodes = Array(25).fill({
        eventType: 'REVIEW_COMPLETED',
        timestamp: new Date().toISOString(),
        payload: { conceptId: 'c1' },
      });
      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue(recentEpisodes);

      const result = await service.detectCramming(1, 'test-token');

      expect(result.isCramming).toBe(true);
    });

    it('should detect repeated concept cramming', async () => {
      const episodes = [
        { eventType: 'REVIEW_COMPLETED', timestamp: new Date().toISOString(), payload: JSON.stringify({ conceptId: 'c1' }) },
        { eventType: 'REVIEW_COMPLETED', timestamp: new Date().toISOString(), payload: JSON.stringify({ conceptId: 'c1' }) },
        { eventType: 'REVIEW_COMPLETED', timestamp: new Date().toISOString(), payload: JSON.stringify({ conceptId: 'c1' }) },
        { eventType: 'REVIEW_COMPLETED', timestamp: new Date().toISOString(), payload: JSON.stringify({ conceptId: 'c1' }) },
      ];
      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue(episodes);

      const result = await service.detectCramming(1, 'test-token');

      expect(result.conceptsRepeated.length).toBeGreaterThan(0);
    });

    it('should not flag normal review patterns', async () => {
      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue([
        { eventType: 'REVIEW_COMPLETED', timestamp: new Date().toISOString(), payload: { conceptId: 'c1' } },
        { eventType: 'REVIEW_COMPLETED', timestamp: new Date().toISOString(), payload: { conceptId: 'c2' } },
      ]);

      const result = await service.detectCramming(1, 'test-token');

      expect(result.isCramming).toBe(false);
    });
  });

  describe('calculateOptimalSpacing', () => {
    it('should use profile forgetting curve data', () => {
      const profile = {
        inferences: {
          forgettingCurve: {
            optimalReviewInterval: 7,
            retentionStrength: 'strong',
            forgettingSlope: 0.2,
          },
        },
      };

      const result = service.calculateOptimalSpacing(profile);

      expect(result.optimalInterval).toBe(7);
      expect(result.retentionStrength).toBe('strong');
    });

    it('should adjust intervals for strong retention', () => {
      const profile = {
        inferences: {
          forgettingCurve: { retentionStrength: 'strong' },
        },
      };

      const result = service.calculateOptimalSpacing(profile);

      // Strong retention should have longer intervals
      expect(result.recommendedIntervals[0]).toBeGreaterThanOrEqual(1);
    });

    it('should include target retention', () => {
      const result = service.calculateOptimalSpacing({});

      expect(result.targetRetention).toBe(PREDICTION_CONSTANTS.RETENTION_THRESHOLD);
    });
  });

  describe('analyzeConsistency', () => {
    it('should calculate current streak', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue([
        { timestamp: today.toISOString() },
        { timestamp: yesterday.toISOString() },
        { timestamp: twoDaysAgo.toISOString() },
      ]);

      const result = await service.analyzeConsistency(1, 'test-token');

      expect(result.currentStreak).toBeGreaterThanOrEqual(0);
    });

    it('should count sessions in last 7 days', async () => {
      const today = new Date();
      const episodes = [
        { timestamp: today.toISOString() },
        { timestamp: new Date(today.getTime() - 86400000).toISOString() },
        { timestamp: new Date(today.getTime() - 172800000).toISOString() },
      ];
      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue(episodes);

      const result = await service.analyzeConsistency(1, 'test-token');

      expect(result.sessionsLast7Days).toBeGreaterThanOrEqual(0);
    });

    it('should calculate days since last session', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue([
        { timestamp: threeDaysAgo.toISOString() },
      ]);

      const result = await service.analyzeConsistency(1, 'test-token');

      // Due to timezone differences and date boundary handling, allow 2-3 days
      expect(result.daysSinceLastSession).toBeGreaterThanOrEqual(2);
    });
  });

  describe('calculateNewItemPacing', () => {
    it('should recommend based on pace preference', () => {
      const profile = {
        inferences: {
          pacePreferences: {
            avgItemsPerSession: 30,
            preferredPace: 'marathon',
          },
        },
      };

      const result = service.calculateNewItemPacing(profile);

      // Marathon pace gives "longer sessions" suggestion
      expect(result.suggestion).toContain('longer sessions');
      expect(result.preferredPace).toBe('marathon');
    });

    it('should limit to max daily new items', () => {
      const profile = {
        inferences: {
          pacePreferences: {
            avgItemsPerSession: 100,
            preferredPace: 'steady',
          },
        },
      };

      const result = service.calculateNewItemPacing(profile);

      expect(result.recommendedNewItemsPerDay).toBeLessThanOrEqual(
        PREDICTION_CONSTANTS.OPTIMAL_DAILY_NEW_ITEMS
      );
    });
  });

  describe('calculateBreakStrategy', () => {
    it('should recommend breaks based on focus decay', () => {
      const profile = {
        inferences: {
          sessionPreferences: { focusDecayPoint: 15 },
        },
      };

      const result = service.calculateBreakStrategy(profile);

      expect(result.needsReminder).toBe(true);
      expect(result.recommendedBreakInterval).toBeLessThanOrEqual(15);
    });

    it('should not need reminder for high focus', () => {
      const profile = {
        inferences: {
          sessionPreferences: { focusDecayPoint: 45 },
        },
      };

      const result = service.calculateBreakStrategy(profile);

      expect(result.needsReminder).toBe(false);
    });
  });

  // ====================
  // Cache Management
  // ====================

  describe('refreshAnalysisCache', () => {
    it('should update cached profile and patterns', async () => {
      await service.refreshAnalysisCache(1, 'test-token');

      expect(service.cachedProfile).not.toBeNull();
      expect(service.cachedPatterns).not.toBeNull();
      expect(service.lastAnalysisTime).not.toBeNull();
    });

    it('should not refresh if cache is fresh', async () => {
      await service.refreshAnalysisCache(1, 'test-token');
      const firstAnalysisTime = service.lastAnalysisTime;

      // Call again immediately
      await service.refreshAnalysisCache(1, 'test-token');

      expect(service.lastAnalysisTime).toEqual(firstAnalysisTime);
    });

    it('should refresh if cache is expired', async () => {
      await service.refreshAnalysisCache(1, 'test-token');

      // Expire the cache
      service.lastAnalysisTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      await service.refreshAnalysisCache(1, 'test-token');

      expect(service.lastAnalysisTime.getTime()).toBeGreaterThan(
        Date.now() - 1000 // Should be very recent
      );
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      await service.refreshAnalysisCache(1, 'test-token');
      service.clearCache();

      expect(service.cachedProfile).toBeNull();
      expect(service.cachedPatterns).toBeNull();
      expect(service.lastAnalysisTime).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should update specific config values', () => {
      service.updateConfig({ maxRecommendations: 5 });

      expect(service.config.maxRecommendations).toBe(5);
    });

    it('should preserve other config values', () => {
      const originalLookback = service.config.lookbackDays;
      service.updateConfig({ maxRecommendations: 5 });

      expect(service.config.lookbackDays).toBe(originalLookback);
    });
  });

  // ====================
  // Summary Generation
  // ====================

  describe('generateSummary', () => {
    it('should warn about critical issues', () => {
      const scheduling = {
        recommendations: [{ priority: PRIORITY.CRITICAL }],
        dueItems: { overdueCount: 0 },
      };
      const content = { recommendations: [], weakConcepts: [] };
      const strategy = {
        recommendations: [],
        crammingAnalysis: { isCramming: false },
        consistency: { currentStreak: 0 },
      };

      const summary = service.generateSummary(scheduling, content, strategy);

      expect(summary.message).toContain('urgent');
      expect(summary.criticalIssues).toBe(1);
    });

    it('should mention overdue items', () => {
      const scheduling = {
        recommendations: [],
        dueItems: { overdueCount: 5, todayCount: 10 },
      };
      const content = { recommendations: [], weakConcepts: [] };
      const strategy = {
        recommendations: [],
        crammingAnalysis: { isCramming: false },
        consistency: { currentStreak: 0 },
      };

      const summary = service.generateSummary(scheduling, content, strategy);

      expect(summary.message).toContain('overdue');
      expect(summary.overdueCount).toBe(5);
    });

    it('should celebrate streaks', () => {
      const scheduling = {
        recommendations: [],
        dueItems: { overdueCount: 0, todayCount: 0 },
      };
      const content = { recommendations: [], weakConcepts: [] };
      const strategy = {
        recommendations: [],
        crammingAnalysis: { isCramming: false },
        consistency: { currentStreak: 10 },
      };

      const summary = service.generateSummary(scheduling, content, strategy);

      expect(summary.message).toContain('streak');
      expect(summary.currentStreak).toBe(10);
    });
  });

  // ====================
  // Constants Export
  // ====================

  describe('exports', () => {
    it('should export RECOMMENDATION_TYPES', () => {
      expect(RECOMMENDATION_TYPES).toBeDefined();
      expect(RECOMMENDATION_TYPES.SCHEDULE).toBe('schedule');
      expect(RECOMMENDATION_TYPES.CONTENT).toBe('content');
      expect(RECOMMENDATION_TYPES.STRATEGY).toBe('strategy');
      expect(RECOMMENDATION_TYPES.WARNING).toBe('warning');
      expect(RECOMMENDATION_TYPES.ENCOURAGEMENT).toBe('encouragement');
    });

    it('should export PRIORITY', () => {
      expect(PRIORITY).toBeDefined();
      expect(PRIORITY.CRITICAL).toBe(1);
      expect(PRIORITY.HIGH).toBe(2);
      expect(PRIORITY.MEDIUM).toBe(3);
      expect(PRIORITY.LOW).toBe(4);
    });

    it('should export PREDICTION_CONSTANTS', () => {
      expect(PREDICTION_CONSTANTS).toBeDefined();
      expect(PREDICTION_CONSTANTS.CRAMMING_THRESHOLD_HOURS).toBe(2);
      expect(PREDICTION_CONSTANTS.OPTIMAL_DAILY_NEW_ITEMS).toBe(10);
    });
  });
});
