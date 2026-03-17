/**
 * SessionAnalyticsManager.test.js
 *
 * Unit tests for the session analytics manager
 */

// Mock database
const mockDb = {
  exec: jest.fn(),
  prepare: jest.fn(),
};

const mockStmt = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
};

mockDb.prepare.mockReturnValue(mockStmt);

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: mockDb,
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user2-token') return 2;
    return -1;
  }),
}));

jest.mock('../../commons/utils/SqliteHelper', () => ({
  dateToSQLiteString: jest.fn((date) => date.toISOString()),
}));

// Import after mocks
const {
  initAnalyticsTables,
  recordSessionAnalytics,
  getSessionAnalytics,
  getPerformanceTrends,
  getWeeklyPerformance,
  recordLearningVelocity,
  getLearningVelocity,
  getAggregateVelocity,
  analyzeOptimalStudyTimes,
  identifyWeakItems,
  getSessionHistory,
  exportSessionData,
  getDashboardSummary,
} = require('../../main/db/SessionAnalyticsManager');

describe('SessionAnalyticsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStmt.get.mockReset();
    mockStmt.all.mockReset();
    mockStmt.run.mockReset();
  });

  describe('initAnalyticsTables', () => {
    it('should create analytics tables and indexes', () => {
      const result = initAnalyticsTables();

      expect(result).toBe(true);
      expect(mockDb.exec).toHaveBeenCalledTimes(4);
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "session_analytics"'),
      );
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "learning_velocity"'),
      );
    });

    it('should handle errors gracefully', () => {
      mockDb.exec.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const result = initAnalyticsTables();

      expect(result).toBe(false);
    });
  });

  describe('recordSessionAnalytics', () => {
    it('should record analytics for a session', () => {
      const analytics = {
        focusScore: 85,
        efficiencyScore: 78,
        avgResponseTimeMs: 3500,
        retentionRate: 72,
        streakLength: 5,
        hintsUsed: 2,
        conceptsImproved: [{ id: 'c1', name: 'Test Concept' }],
      };

      const result = recordSessionAnalytics('session_123', analytics, 'valid-token');

      expect(result.success).toBe(true);
      expect(mockStmt.run).toHaveBeenCalledWith(
        'session_123',
        1, // userId
        expect.any(Number), // hour
        expect.any(Number), // day
        85, // focusScore
        78, // efficiencyScore
        3500, // avgResponseTimeMs
        72, // retentionRate
        5, // streakLength
        2, // hintsUsed
        expect.any(String), // JSON concepts
        expect.any(String), // createdAt
      );
    });

    it('should return error for invalid token', () => {
      const result = recordSessionAnalytics('session_123', {}, 'invalid-token');

      expect(result.error).toBe('Invalid session');
    });
  });

  describe('getPerformanceTrends', () => {
    it('should return performance trends', () => {
      mockStmt.all.mockReturnValue([
        {
          date: '2024-01-15',
          sessions_count: 3,
          total_minutes: 45,
          total_items: 30,
          total_correct: 25,
          avg_focus: 80,
          avg_efficiency: 75,
          avg_response_time: 4000,
          avg_retention: 70,
        },
        {
          date: '2024-01-16',
          sessions_count: 2,
          total_minutes: 30,
          total_items: 20,
          total_correct: 18,
          avg_focus: 85,
          avg_efficiency: 80,
          avg_response_time: 3500,
          avg_retention: 75,
        },
      ]);

      const trends = getPerformanceTrends('valid-token', 30);

      expect(trends).toHaveLength(2);
      expect(trends[0].date).toBe('2024-01-15');
      expect(trends[0].sessionsCount).toBe(3);
      expect(trends[0].accuracy).toBeCloseTo(83.33, 1);
      expect(trends[1].avgFocus).toBe(85);
    });

    it('should filter by topic when provided', () => {
      mockStmt.all.mockReturnValue([]);

      getPerformanceTrends('valid-token', 30, 'topic_123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('topic_id = ?'),
      );
    });

    it('should return empty array for invalid token', () => {
      const trends = getPerformanceTrends('invalid-token', 30);

      expect(trends).toEqual([]);
    });
  });

  describe('recordLearningVelocity', () => {
    it('should record velocity and calculate change', () => {
      const data = {
        topicId: 'topic_123',
        masteryStart: 50,
        masteryEnd: 65,
        itemsStudied: 20,
        timeSpentMinutes: 30,
      };

      const result = recordLearningVelocity(data, 'valid-token');

      expect(result.success).toBe(true);
      expect(result.velocity).toBe(15); // 65 - 50
    });

    it('should handle null masteryStart', () => {
      const data = {
        topicId: 'topic_123',
        masteryEnd: 65,
        itemsStudied: 20,
        timeSpentMinutes: 30,
      };

      const result = recordLearningVelocity(data, 'valid-token');

      expect(result.success).toBe(true);
      expect(result.velocity).toBe(65);
    });
  });

  describe('getAggregateVelocity', () => {
    it('should return aggregate velocity stats', () => {
      mockStmt.get.mockReturnValue({
        avg_velocity: 5.5,
        max_velocity: 15,
        min_velocity: -2,
        total_items: 100,
        total_minutes: 180,
        active_days: 5,
      });

      const result = getAggregateVelocity('valid-token', 7);

      expect(result.avgVelocity).toBe(5.5);
      expect(result.maxVelocity).toBe(15);
      expect(result.minVelocity).toBe(-2);
      expect(result.totalItems).toBe(100);
      expect(result.activeDays).toBe(5);
      expect(result.velocityPerWeek).toBe('38.50'); // 5.5 * 7
    });

    it('should return zeros when no data', () => {
      mockStmt.get.mockReturnValue({ active_days: 0 });

      const result = getAggregateVelocity('valid-token', 7);

      expect(result.avgVelocity).toBe(0);
      expect(result.activeDays).toBe(0);
    });
  });

  describe('analyzeOptimalStudyTimes', () => {
    it('should return hourly and daily breakdown', () => {
      // Mock hourly data
      mockStmt.all
        .mockReturnValueOnce([
          {
            hour_of_day: 9,
            session_count: 10,
            avg_focus: 85,
            avg_efficiency: 80,
            avg_retention: 75,
            avg_accuracy: 0.9,
          },
          {
            hour_of_day: 14,
            session_count: 8,
            avg_focus: 75,
            avg_efficiency: 70,
            avg_retention: 65,
            avg_accuracy: 0.8,
          },
        ])
        // Mock daily data
        .mockReturnValueOnce([
          {
            day_of_week: 1,
            session_count: 15,
            avg_focus: 80,
            avg_efficiency: 75,
            avg_retention: 70,
            total_minutes: 300,
          },
          {
            day_of_week: 3,
            session_count: 12,
            avg_focus: 85,
            avg_efficiency: 80,
            avg_retention: 75,
            total_minutes: 240,
          },
        ]);

      const result = analyzeOptimalStudyTimes('valid-token', 90);

      expect(result).not.toBeNull();
      expect(result.hourlyBreakdown).toHaveLength(2);
      expect(result.hourlyBreakdown[0].hour).toBe(9);
      expect(result.hourlyBreakdown[0].hourLabel).toBe('9 AM');

      expect(result.dailyBreakdown).toHaveLength(2);
      expect(result.dailyBreakdown[0].dayName).toBe('Monday');

      expect(result.recommendations.bestHours).toBeDefined();
      expect(result.recommendations.bestDays).toBeDefined();
      expect(result.recommendations.suggestion).toBeDefined();
    });

    it('should return null for invalid token', () => {
      const result = analyzeOptimalStudyTimes('invalid-token', 90);

      expect(result).toBeNull();
    });
  });

  describe('identifyWeakItems', () => {
    it('should return items with low accuracy', () => {
      mockStmt.all.mockReturnValue([
        {
          item_id: 'item_1',
          item_type: 'vocabulary',
          topic_id: 'topic_1',
          review_count: 10,
          correct_count: 3,
          avg_response_time: 8000,
          current_mastery: 25,
          last_reviewed: '2024-01-15',
          accuracy: 0.3,
        },
        {
          item_id: 'item_2',
          item_type: 'note',
          topic_id: 'topic_1',
          review_count: 5,
          correct_count: 2,
          avg_response_time: 6000,
          current_mastery: 35,
          last_reviewed: '2024-01-14',
          accuracy: 0.4,
        },
      ]);

      const weakItems = identifyWeakItems('valid-token', 'topic_1', 10);

      expect(weakItems).toHaveLength(2);
      expect(weakItems[0].itemId).toBe('item_1');
      expect(weakItems[0].accuracy).toBe('30.0');
      expect(weakItems[0].weaknessReason).toContain('Low accuracy');
    });

    it('should return empty array for invalid token', () => {
      const result = identifyWeakItems('invalid-token');

      expect(result).toEqual([]);
    });
  });

  describe('getSessionHistory', () => {
    it('should return paginated session history', () => {
      // Mock count query
      mockStmt.get.mockReturnValue({ total: 25 });

      // Mock session query
      mockStmt.all.mockReturnValue([
        {
          id: 'session_1',
          topic_id: 'topic_1',
          session_type: 'standard',
          started_at: '2024-01-15T10:00:00Z',
          completed_at: '2024-01-15T10:30:00Z',
          duration_minutes: 30,
          items_reviewed: 20,
          items_correct: 18,
          items_new: 5,
          focus_score: 85,
          efficiency_score: 80,
          avg_response_time_ms: 3500,
          retention_rate: 75,
          streak_length: 8,
          hints_used: 2,
        },
      ]);

      const result = getSessionHistory('valid-token', { limit: 20, offset: 0 });

      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(true);
      expect(result.sessions[0].id).toBe('session_1');
      expect(result.sessions[0].accuracy).toBe('90.0');
    });
  });

  describe('exportSessionData', () => {
    it('should export data as JSON', () => {
      mockStmt.all.mockReturnValue([
        {
          id: 'session_1',
          topic_id: 'topic_1',
          session_type: 'standard',
          started_at: '2024-01-15T10:00:00Z',
          completed_at: '2024-01-15T10:30:00Z',
          duration_minutes: 30,
          items_reviewed: 20,
          items_correct: 18,
          items_new: 5,
          focus_score: 85,
          efficiency_score: 80,
          retention_rate: 75,
          streak_length: 8,
          hints_used: 2,
        },
      ]);

      const result = exportSessionData('valid-token', { format: 'json' });

      expect(result).not.toBeNull();
      expect(result.totalSessions).toBe(1);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].analytics.focusScore).toBe(85);
    });

    it('should export data as CSV', () => {
      mockStmt.all.mockReturnValue([
        {
          id: 'session_1',
          topic_id: 'topic_1',
          session_type: 'standard',
          started_at: '2024-01-15T10:00:00Z',
          completed_at: '2024-01-15T10:30:00Z',
          duration_minutes: 30,
          items_reviewed: 20,
          items_correct: 18,
          items_new: 5,
          focus_score: 85,
          efficiency_score: 80,
          retention_rate: 75,
          streak_length: 8,
          hints_used: 2,
        },
      ]);

      const result = exportSessionData('valid-token', { format: 'csv' });

      expect(result).not.toBeNull();
      expect(result.content).toContain('Session ID');
      expect(result.content).toContain('session_1');
      expect(result.mimeType).toBe('text/csv');
    });
  });

  describe('getDashboardSummary', () => {
    it('should return comprehensive dashboard stats', () => {
      // Mock today stats
      mockStmt.get
        .mockReturnValueOnce({
          sessions: 2,
          minutes: 45,
          items: 30,
          correct: 27,
        })
        // Mock week stats
        .mockReturnValueOnce({
          sessions: 10,
          minutes: 200,
          items: 150,
          correct: 130,
          active_days: 5,
        })
        // Mock streak
        .mockReturnValueOnce({ streak: 7 })
        // Mock velocity (from getAggregateVelocity)
        .mockReturnValueOnce({
          avg_velocity: 5,
          max_velocity: 10,
          min_velocity: 0,
          total_items: 100,
          total_minutes: 200,
          active_days: 7,
        });

      const result = getDashboardSummary('valid-token');

      expect(result).not.toBeNull();
      expect(result.today.sessions).toBe(2);
      expect(result.today.minutes).toBe(45);
      expect(result.today.accuracy).toBe('90.0');
      expect(result.thisWeek.sessions).toBe(10);
      expect(result.thisWeek.activeDays).toBe(5);
      expect(result.currentStreak).toBe(7);
    });

    it('should return null for invalid token', () => {
      const result = getDashboardSummary('invalid-token');

      expect(result).toBeNull();
    });
  });
});
