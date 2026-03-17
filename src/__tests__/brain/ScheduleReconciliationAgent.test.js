/**
 * ScheduleReconciliationAgent Tests
 *
 * Tests for the LLM-driven schedule reconciliation agent
 *
 * Note: This is a minimal test suite focusing on class instantiation and
 * basic API structure. Full integration tests are in scheduleReconciliation.integration.test.js
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

// Mock electron before any other imports
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/user/data'),
  },
}));

// Mock dbManager to avoid SQLite dependency
jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(() => ({ all: jest.fn(() => []), get: jest.fn(() => null), run: jest.fn() })),
    exec: jest.fn(),
  },
  getUserIdFromToken: jest.fn(() => 1),
}));

// Mock all database managers to avoid db dependencies
jest.mock('../../main/db/LearnerProfileManager', () => ({
  getFullProfile: jest.fn(),
}));

jest.mock('../../main/db/LearningPlanManager', () => ({
  getDueItems: jest.fn(),
  getPlan: jest.fn(),
  getLearningPoints: jest.fn(),
}));

jest.mock('../../main/db/LearningSessionManager', () => ({
  getTodaySessions: jest.fn(),
  getRecentSessions: jest.fn(),
}));

// Mock dependencies
const mockAIProvider = {
  generateContentWithJson: jest.fn(),
};

describe('ScheduleReconciliationAgent', () => {
  let ScheduleReconciliationAgent;
  let agent;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Import the module
    ScheduleReconciliationAgent = require('../../main/brain/ScheduleReconciliationAgent');
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      agent = new ScheduleReconciliationAgent({
        aiProvider: mockAIProvider,
      });

      expect(agent.config).toBeDefined();
      expect(agent.config.maxItemsInPrompt).toBe(30);
      expect(agent.config.defaultDailyItems).toBe(20);
      expect(agent.config.minDailyItems).toBe(5);
      expect(agent.reconciliationCache).toBeDefined();
    });

    it('should store AI provider reference', () => {
      agent = new ScheduleReconciliationAgent({
        aiProvider: mockAIProvider,
      });

      expect(agent.aiProvider).toBe(mockAIProvider);
    });

    it('should store service references', () => {
      const mockServices = {
        aiProvider: mockAIProvider,
        learningPlanManager: { test: true },
        learningSessionManager: { test: true },
        episodeCollector: { test: true },
        consolidationService: { test: true },
        store: { test: true },
      };

      agent = new ScheduleReconciliationAgent(mockServices);

      expect(agent.aiProvider).toBe(mockAIProvider);
      expect(agent.learningPlanManager).toEqual({ test: true });
      expect(agent.learningSessionManager).toEqual({ test: true });
      expect(agent.episodeCollector).toEqual({ test: true });
      expect(agent.consolidationService).toEqual({ test: true });
      expect(agent.store).toEqual({ test: true });
    });
  });

  describe('class methods exist', () => {
    beforeEach(() => {
      agent = new ScheduleReconciliationAgent({
        aiProvider: mockAIProvider,
      });
    });

    it('should have getDueItemsReconciled method', () => {
      expect(typeof agent.getDueItemsReconciled).toBe('function');
    });

    it('should have analyzeGap method', () => {
      expect(typeof agent.analyzeGap).toBe('function');
    });

    it('should have gatherContext method', () => {
      expect(typeof agent.gatherContext).toBe('function');
    });

    it('should have shouldUseLLM method', () => {
      expect(typeof agent.shouldUseLLM).toBe('function');
    });

    it('should have reconcileWithLLM method', () => {
      expect(typeof agent.reconcileWithLLM).toBe('function');
    });

    it('should have generateBasicCatchUpPlan method', () => {
      expect(typeof agent.generateBasicCatchUpPlan).toBe('function');
    });

    it('should have clearCache method', () => {
      expect(typeof agent.clearCache).toBe('function');
    });

    it('should have calculatePersonalizedInterval method', () => {
      expect(typeof agent.calculatePersonalizedInterval).toBe('function');
    });
  });

  describe('clearCache', () => {
    it('should clear the reconciliation cache', () => {
      agent = new ScheduleReconciliationAgent({
        aiProvider: mockAIProvider,
      });

      // Manually add something to cache
      agent.reconciliationCache.set('test_key', { data: 'test' });
      expect(agent.reconciliationCache.size).toBe(1);

      agent.clearCache();
      expect(agent.reconciliationCache.size).toBe(0);
    });
  });

  describe('config defaults', () => {
    it('should have correct default configuration', () => {
      agent = new ScheduleReconciliationAgent({
        aiProvider: mockAIProvider,
      });

      expect(agent.config.maxItemsInPrompt).toBe(30);
      expect(agent.config.defaultDailyItems).toBe(20);
      expect(agent.config.maxDailyMultiplier).toBe(1.5);
      expect(agent.config.minDailyItems).toBe(5);
      expect(agent.config.useLLMForPriority).toBe(true);
      expect(agent.config.cacheReconciliationMinutes).toBe(5);
    });
  });

  describe('cache initialization', () => {
    it('should initialize with empty cache', () => {
      agent = new ScheduleReconciliationAgent({
        aiProvider: mockAIProvider,
      });

      expect(agent.reconciliationCache).toBeInstanceOf(Map);
      expect(agent.reconciliationCache.size).toBe(0);
    });
  });
});
