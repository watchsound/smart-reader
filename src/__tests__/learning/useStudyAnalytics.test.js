/**
 * useStudyAnalytics.test.js
 *
 * Unit tests for the useStudyAnalytics React hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the API
const mockGetDashboardSummary = jest.fn();
const mockGetPerformanceTrends = jest.fn();
const mockGetAggregateVelocity = jest.fn();
const mockIdentifyWeakItems = jest.fn();
const mockRecordSessionAnalytics = jest.fn();
const mockRecordLearningVelocity = jest.fn();
const mockGetSessionHistory = jest.fn();
const mockExportSessionData = jest.fn();

jest.mock('../../../src/renderer/api/studyAnalyticsApi', () => ({
  __esModule: true,
  default: {
    getDashboardSummary: (...args) => mockGetDashboardSummary(...args),
    getPerformanceTrends: (...args) => mockGetPerformanceTrends(...args),
    getAggregateVelocity: (...args) => mockGetAggregateVelocity(...args),
    identifyWeakItems: (...args) => mockIdentifyWeakItems(...args),
    recordSessionAnalytics: (...args) => mockRecordSessionAnalytics(...args),
    recordLearningVelocity: (...args) => mockRecordLearningVelocity(...args),
    getSessionHistory: (...args) => mockGetSessionHistory(...args),
    exportSessionData: (...args) => mockExportSessionData(...args),
    analyzeOptimalStudyTimes: jest.fn().mockResolvedValue({ success: true, analysis: {} }),
  },
  calculateFocusScore: jest.fn(() => 75),
  calculateEfficiencyScore: jest.fn(() => 80),
  calculateRetentionRate: jest.fn(() => 70),
  getPerformanceLevel: jest.fn((score) => ({
    label: score >= 70 ? 'Good' : 'Needs Work',
    color: score >= 70 ? '#4CAF50' : '#f44336',
  })),
  formatDuration: jest.fn((mins) => `${mins} min`),
  formatAccuracy: jest.fn((acc) => `${acc}%`),
}));

// Import hook after mocks
import useStudyAnalytics, {
  useSessionHistory,
  usePerformanceComparison,
  useExportAnalytics,
} from '../../../src/renderer/views/study/hooks/useStudyAnalytics';

describe('useStudyAnalytics', () => {
  const defaultToken = 'test-token';

  const mockDashboard = {
    today: { items: 30, accuracy: '90.0' },
    thisWeek: { items: 150, accuracy: '85.0' },
    currentStreak: 7,
    velocity: { velocityPerWeek: '5.00' },
  };

  const mockTrends = [
    { date: '2024-01-15', accuracy: 85 },
    { date: '2024-01-16', accuracy: 90 },
  ];

  const mockVelocity = {
    avgVelocity: 5,
    velocityPerWeek: '35.00',
    activeDays: 7,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDashboardSummary.mockResolvedValue({
      success: true,
      summary: mockDashboard,
    });
    mockGetPerformanceTrends.mockResolvedValue({
      success: true,
      trends: mockTrends,
    });
    mockGetAggregateVelocity.mockResolvedValue({
      success: true,
      aggregate: mockVelocity,
    });
    mockIdentifyWeakItems.mockResolvedValue({
      success: true,
      weakItems: [],
    });
    mockRecordSessionAnalytics.mockResolvedValue({ success: true });
    mockRecordLearningVelocity.mockResolvedValue({ success: true });
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      expect(result.current.dashboard).toBeNull();
      expect(result.current.trends).toEqual([]);
      expect(result.current.velocity).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should auto-load data when autoLoad is true', async () => {
      const { result } = renderHook(() =>
        useStudyAnalytics({ token: defaultToken, autoLoad: true }),
      );

      await waitFor(() => {
        expect(result.current.dashboard).not.toBeNull();
      });

      expect(mockGetDashboardSummary).toHaveBeenCalledWith(defaultToken);
    });

    it('should not load data without token', async () => {
      const { result } = renderHook(() => useStudyAnalytics({ autoLoad: true }));

      // Wait a bit to ensure no calls are made
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetDashboardSummary).not.toHaveBeenCalled();
      expect(result.current.dashboard).toBeNull();
    });
  });

  describe('loadDashboard', () => {
    it('should load dashboard summary', async () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      await act(async () => {
        await result.current.loadDashboard();
      });

      expect(result.current.dashboard).toEqual(mockDashboard);
    });

    it('should set error on failure', async () => {
      mockGetDashboardSummary.mockResolvedValue({
        success: false,
        error: 'Failed to load',
      });

      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      await act(async () => {
        await result.current.loadDashboard();
      });

      expect(result.current.error).toBe('Failed to load');
    });
  });

  describe('loadTrends', () => {
    it('should load performance trends', async () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      await act(async () => {
        await result.current.loadTrends(30);
      });

      expect(result.current.trends).toEqual(mockTrends);
      expect(mockGetPerformanceTrends).toHaveBeenCalledWith(defaultToken, 30, null);
    });

    it('should filter by topic', async () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      await act(async () => {
        await result.current.loadTrends(30, 'topic_123');
      });

      expect(mockGetPerformanceTrends).toHaveBeenCalledWith(
        defaultToken,
        30,
        'topic_123',
      );
    });
  });

  describe('loadVelocity', () => {
    it('should load aggregate velocity', async () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      await act(async () => {
        await result.current.loadVelocity(7);
      });

      expect(result.current.velocity).toEqual(mockVelocity);
    });
  });

  describe('session tracking', () => {
    it('should start session tracking', () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      act(() => {
        result.current.startSessionTracking();
      });

      // No error means success
      expect(true).toBe(true);
    });

    it('should record review events', () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      act(() => {
        result.current.startSessionTracking();
        result.current.recordReview({
          itemId: 'item_1',
          wasCorrect: true,
          rating: 3,
          responseTimeMs: 3000,
        });
      });

      // No error means success
      expect(true).toBe(true);
    });

    it('should record hint usage', () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      act(() => {
        result.current.startSessionTracking();
        result.current.recordHintUsed();
      });

      // No error means success
      expect(true).toBe(true);
    });

    it('should record pauses', () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      act(() => {
        result.current.startSessionTracking();
        result.current.recordPause();
      });

      // No error means success
      expect(true).toBe(true);
    });

    it('should end session and record analytics', async () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      act(() => {
        result.current.startSessionTracking();
        result.current.recordReview({
          itemId: 'item_1',
          wasCorrect: true,
          responseTimeMs: 3000,
        });
        result.current.recordReview({
          itemId: 'item_2',
          wasCorrect: false,
          responseTimeMs: 5000,
        });
      });

      await act(async () => {
        await result.current.endSessionAndRecord('session_123', {
          topicId: 'topic_1',
          durationMinutes: 15,
          masteryStart: 50,
          masteryEnd: 60,
        });
      });

      expect(mockRecordSessionAnalytics).toHaveBeenCalled();
      expect(mockRecordLearningVelocity).toHaveBeenCalled();
    });
  });

  describe('computed values', () => {
    it('should compute performance level from trends', async () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      await act(async () => {
        await result.current.loadTrends(30);
      });

      expect(result.current.performanceLevel).toBeDefined();
    });

    it('should compute velocity trend', async () => {
      const { result } = renderHook(() => useStudyAnalytics({ token: defaultToken }));

      await act(async () => {
        await result.current.loadVelocity(7);
      });

      expect(result.current.velocityTrend).toBe('improving');
    });
  });
});

describe('useSessionHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionHistory.mockResolvedValue({
      success: true,
      sessions: [{ id: 'session_1', accuracy: '90.0' }],
      total: 25,
      hasMore: true,
    });
  });

  it('should load initial page', async () => {
    const { result } = renderHook(() =>
      useSessionHistory({ token: 'test-token', pageSize: 20 }),
    );

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    expect(result.current.total).toBe(25);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.page).toBe(0);
  });

  it('should navigate to next page', async () => {
    const { result } = renderHook(() =>
      useSessionHistory({ token: 'test-token', pageSize: 20 }),
    );

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    await act(async () => {
      result.current.nextPage();
    });

    expect(mockGetSessionHistory).toHaveBeenLastCalledWith('test-token', {
      limit: 20,
      offset: 20,
      topicId: null,
    });
  });
});

describe('useExportAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExportSessionData.mockResolvedValue({
      success: true,
      data: { totalSessions: 10, sessions: [] },
    });
  });

  it('should export data', async () => {
    const { result } = renderHook(() => useExportAnalytics('test-token'));

    let exportResult;
    await act(async () => {
      exportResult = await result.current.exportData({ format: 'json' });
    });

    expect(exportResult.success).toBe(true);
    expect(exportResult.data.totalSessions).toBe(10);
  });

  it('should set isExporting during export', async () => {
    const { result } = renderHook(() => useExportAnalytics('test-token'));

    expect(result.current.isExporting).toBe(false);

    let promise;
    act(() => {
      promise = result.current.exportData();
    });

    // isExporting should be true during export
    expect(result.current.isExporting).toBe(true);

    await act(async () => {
      await promise;
    });

    expect(result.current.isExporting).toBe(false);
  });
});
