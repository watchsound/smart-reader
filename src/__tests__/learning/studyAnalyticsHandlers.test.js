/**
 * studyAnalyticsHandlers.test.js
 *
 * Unit tests for study analytics IPC handlers
 */

import { ipcMain } from 'electron';

// Mock SessionAnalyticsManager
const mockInitAnalyticsTables = jest.fn().mockReturnValue(true);
const mockRecordSessionAnalytics = jest.fn().mockReturnValue({ success: true });
const mockGetSessionAnalytics = jest.fn();
const mockGetPerformanceTrends = jest.fn();
const mockGetWeeklyPerformance = jest.fn();
const mockRecordLearningVelocity = jest.fn().mockReturnValue({ success: true, velocity: 5 });
const mockGetLearningVelocity = jest.fn();
const mockGetAggregateVelocity = jest.fn();
const mockAnalyzeOptimalStudyTimes = jest.fn();
const mockIdentifyWeakItems = jest.fn();
const mockGetSessionHistory = jest.fn();
const mockExportSessionData = jest.fn();
const mockGetDashboardSummary = jest.fn();

jest.mock('../../main/db/SessionAnalyticsManager', () => ({
  initAnalyticsTables: () => mockInitAnalyticsTables(),
  recordSessionAnalytics: (...args) => mockRecordSessionAnalytics(...args),
  getSessionAnalytics: (...args) => mockGetSessionAnalytics(...args),
  getPerformanceTrends: (...args) => mockGetPerformanceTrends(...args),
  getWeeklyPerformance: (...args) => mockGetWeeklyPerformance(...args),
  recordLearningVelocity: (...args) => mockRecordLearningVelocity(...args),
  getLearningVelocity: (...args) => mockGetLearningVelocity(...args),
  getAggregateVelocity: (...args) => mockGetAggregateVelocity(...args),
  analyzeOptimalStudyTimes: (...args) => mockAnalyzeOptimalStudyTimes(...args),
  identifyWeakItems: (...args) => mockIdentifyWeakItems(...args),
  getSessionHistory: (...args) => mockGetSessionHistory(...args),
  exportSessionData: (...args) => mockExportSessionData(...args),
  getDashboardSummary: (...args) => mockGetDashboardSummary(...args),
}));

// Mock graph features
const mockDetectWeakConcepts = jest.fn().mockResolvedValue([]);
const mockGetMasteryProgress = jest.fn().mockResolvedValue([]);
const mockUpdateConceptMastery = jest.fn().mockResolvedValue({ id: 'c1', mastery: 60 });
const mockGetErrorProneTopics = jest.fn().mockResolvedValue([]);
const mockGetConceptClusters = jest.fn().mockResolvedValue([]);

jest.mock('../../main/utils/GraphLearningFeatures', () => ({
  __esModule: true,
  default: {
    detectWeakConcepts: (...args) => mockDetectWeakConcepts(...args),
    getMasteryProgress: (...args) => mockGetMasteryProgress(...args),
    updateConceptMastery: (...args) => mockUpdateConceptMastery(...args),
    getErrorProneTopics: (...args) => mockGetErrorProneTopics(...args),
    getConceptClusters: (...args) => mockGetConceptClusters(...args),
  },
}));

// Mock graph interface
jest.mock('../../main/utils/GraphInterface', () => ({
  __esModule: true,
  default: {
    checkConnection: jest.fn().mockReturnValue(false),
    adapter: null,
  },
}));

// Mock ipcMain
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

// Import handlers after mocks
const { registerStudyAnalyticsHandlers } = require('../../main/ipc/studyAnalyticsHandlers');

describe('studyAnalyticsHandlers', () => {
  let handlers = {};
  const mockStore = { get: jest.fn(), set: jest.fn() };
  const mockServices = { aiProvider: {} };

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};

    // Capture registered handlers
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    // Register handlers
    registerStudyAnalyticsHandlers(mockStore, mockServices);
  });

  describe('registerStudyAnalyticsHandlers', () => {
    it('should initialize analytics tables', () => {
      expect(mockInitAnalyticsTables).toHaveBeenCalled();
    });

    it('should register all expected handlers', () => {
      expect(handlers['analytics-record-session']).toBeDefined();
      expect(handlers['analytics-get-session']).toBeDefined();
      expect(handlers['analytics-get-trends']).toBeDefined();
      expect(handlers['analytics-get-weekly']).toBeDefined();
      expect(handlers['analytics-record-velocity']).toBeDefined();
      expect(handlers['analytics-get-velocity']).toBeDefined();
      expect(handlers['analytics-get-aggregate-velocity']).toBeDefined();
      expect(handlers['analytics-optimal-times']).toBeDefined();
      expect(handlers['analytics-weak-items']).toBeDefined();
      expect(handlers['analytics-session-history']).toBeDefined();
      expect(handlers['analytics-export']).toBeDefined();
      expect(handlers['analytics-dashboard']).toBeDefined();
      expect(handlers['analytics-sync-mastery']).toBeDefined();
      expect(handlers['analytics-graph-insights']).toBeDefined();
    });
  });

  describe('analytics-record-session', () => {
    it('should record session analytics', async () => {
      const analytics = {
        focusScore: 85,
        efficiencyScore: 80,
        streakLength: 5,
      };

      const result = await handlers['analytics-record-session']({}, {
        sessionId: 'session_123',
        analytics,
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(mockRecordSessionAnalytics).toHaveBeenCalledWith(
        'session_123',
        analytics,
        'test-token',
      );
    });
  });

  describe('analytics-get-trends', () => {
    it('should return performance trends', async () => {
      mockGetPerformanceTrends.mockReturnValue([
        { date: '2024-01-15', accuracy: 85 },
        { date: '2024-01-16', accuracy: 90 },
      ]);

      const result = await handlers['analytics-get-trends']({}, {
        token: 'test-token',
        days: 30,
      });

      expect(result.success).toBe(true);
      expect(result.trends).toHaveLength(2);
    });

    it('should filter by topic', async () => {
      mockGetPerformanceTrends.mockReturnValue([]);

      await handlers['analytics-get-trends']({}, {
        token: 'test-token',
        days: 30,
        topicId: 'topic_123',
      });

      expect(mockGetPerformanceTrends).toHaveBeenCalledWith(
        'test-token',
        30,
        'topic_123',
      );
    });
  });

  describe('analytics-record-velocity', () => {
    it('should record learning velocity', async () => {
      const data = {
        topicId: 'topic_123',
        masteryStart: 50,
        masteryEnd: 65,
        itemsStudied: 20,
      };

      const result = await handlers['analytics-record-velocity']({}, {
        data,
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.velocity).toBe(5);
    });
  });

  describe('analytics-get-aggregate-velocity', () => {
    it('should return aggregate velocity', async () => {
      mockGetAggregateVelocity.mockReturnValue({
        avgVelocity: 5,
        velocityPerWeek: '35.00',
        activeDays: 7,
      });

      const result = await handlers['analytics-get-aggregate-velocity']({}, {
        token: 'test-token',
        days: 7,
      });

      expect(result.success).toBe(true);
      expect(result.aggregate.avgVelocity).toBe(5);
    });
  });

  describe('analytics-optimal-times', () => {
    it('should return optimal study times analysis', async () => {
      mockAnalyzeOptimalStudyTimes.mockReturnValue({
        hourlyBreakdown: [{ hour: 9, avgFocus: 85 }],
        dailyBreakdown: [{ day: 1, avgFocus: 80 }],
        recommendations: {
          bestHours: [{ hour: 9, label: '9 AM' }],
          bestDays: [{ day: 1, name: 'Monday' }],
          suggestion: 'Study in the morning',
        },
      });

      const result = await handlers['analytics-optimal-times']({}, {
        token: 'test-token',
        days: 90,
      });

      expect(result.success).toBe(true);
      expect(result.analysis.recommendations.suggestion).toContain('morning');
    });
  });

  describe('analytics-weak-items', () => {
    it('should return weak items', async () => {
      mockIdentifyWeakItems.mockReturnValue([
        { itemId: 'item_1', accuracy: '30.0', weaknessReason: 'Low accuracy' },
        { itemId: 'item_2', accuracy: '45.0', weaknessReason: 'Below target' },
      ]);

      const result = await handlers['analytics-weak-items']({}, {
        token: 'test-token',
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.weakItems).toHaveLength(2);
    });
  });

  describe('analytics-session-history', () => {
    it('should return paginated session history', async () => {
      mockGetSessionHistory.mockReturnValue({
        sessions: [{ id: 'session_1', accuracy: '90.0' }],
        total: 25,
        hasMore: true,
      });

      const result = await handlers['analytics-session-history']({}, {
        token: 'test-token',
        limit: 20,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('analytics-export', () => {
    it('should export session data as JSON', async () => {
      mockExportSessionData.mockReturnValue({
        totalSessions: 10,
        sessions: [],
      });

      const result = await handlers['analytics-export']({}, {
        token: 'test-token',
        format: 'json',
      });

      expect(result.success).toBe(true);
      expect(result.data.totalSessions).toBe(10);
    });

    it('should return error when no data to export', async () => {
      mockExportSessionData.mockReturnValue(null);

      const result = await handlers['analytics-export']({}, {
        token: 'test-token',
        format: 'json',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No data to export');
    });
  });

  describe('analytics-dashboard', () => {
    it('should return dashboard summary', async () => {
      mockGetDashboardSummary.mockReturnValue({
        today: { items: 30, accuracy: '90.0' },
        thisWeek: { items: 150, accuracy: '85.0' },
        currentStreak: 7,
        velocity: { velocityPerWeek: '5.00' },
      });

      const result = await handlers['analytics-dashboard']({}, {
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.summary.today.items).toBe(30);
      expect(result.summary.currentStreak).toBe(7);
    });
  });

  describe('analytics-sync-mastery', () => {
    it('should return error when graph not available', async () => {
      const result = await handlers['analytics-sync-mastery']({}, {
        conceptId: 'concept_1',
        outcome: 'correct',
        token: 'test-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Graph not available');
    });
  });

  describe('analytics-graph-insights', () => {
    it('should return error when graph not available', async () => {
      const result = await handlers['analytics-graph-insights']({}, {
        token: 'test-token',
        lookbackDays: 30,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Graph not available');
    });
  });
});
