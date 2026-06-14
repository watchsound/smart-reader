/**
 * LearningSessionManager.test.js
 *
 * Unit tests for LearningSessionManager.js database operations.
 * Tests session tracking and performance recording.
 */

// Mock the database and utilities
jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(),
  },
  getUserIdFromToken: jest.fn(),
}));

jest.mock('../../commons/utils/SqliteHelper', () => ({
  dateToSQLiteString: jest.fn((date) => date?.toISOString?.() || date),
}));

// completeLearningSession now writes back to streakRecord on the learner
// profile (Phase 8 streak chain). Stub the two functions it calls so the
// session tests don't need to mock learner_profile DB rows.
jest.mock('../../main/db/LearnerProfileManager', () => ({
  getGlobalProfile: jest.fn(() => ({
    globalProfile: { streakRecord: 0 },
  })),
  updateGlobalProfile: jest.fn(() => ({
    globalProfile: { streakRecord: 1 },
  })),
}));

const db = require('../../main/db/dbManager').default;
const { getUserIdFromToken } = require('../../main/db/dbManager');

const {
  getLearningSessionById,
  getSessionsByTopic,
  getRecentSessions,
  startLearningSession,
  completeLearningSession,
  recordItemPerformance,
  getItemPerformanceHistory,
  getWeakItems,
  getDailyActivity,
  getOverallStatistics,
} = require('../../main/db/LearningSessionManager');

describe('LearningSessionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserIdFromToken.mockReturnValue(1);
  });

  // =============================================================================
  // Helper to create mock session data
  // =============================================================================

  const createMockSessionRow = (overrides = {}) => ({
    id: 'session_123',
    plan_id: 'plan_123',
    topic_id: 'topic_123',
    user_id: 1,
    session_type: 'review',
    started_at: '2024-01-15T10:00:00.000Z',
    completed_at: '2024-01-15T10:30:00.000Z',
    duration_minutes: 30,
    items_reviewed: 25,
    items_correct: 20,
    items_new: 5,
    session_data: JSON.stringify({
      itemResults: [
        {
          itemId: 'item_1',
          wasCorrect: true,
          responseTimeMs: 2000,
        },
      ],
      focusScore: 0.85,
      engagementLevel: 'high',
    }),
    ...overrides,
  });

  const createMockPerformanceRow = (overrides = {}) => ({
    id: 1,
    user_id: 1,
    topic_id: 'topic_123',
    item_id: 'item_1',
    item_type: 'word',
    reviewed_at: '2024-01-15T10:00:00.000Z',
    was_correct: 1,
    response_time_ms: 2000,
    confidence_level: 4,
    mistake_type: null,
    difficulty_rating: 3,
    mastery_before: 50,
    mastery_after: 60,
    session_id: 'session_123',
    ...overrides,
  });

  // =============================================================================
  // getLearningSessionById
  // =============================================================================

  describe('getLearningSessionById', () => {
    it('should return session when found', () => {
      const mockRow = createMockSessionRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningSessionById('session_123', 'valid_token');

      expect(db.prepare).toHaveBeenCalledWith(
        'SELECT * FROM learning_session WHERE id = ? AND user_id = ?'
      );
      expect(result.id).toBe('session_123');
      expect(result.sessionType).toBe('review');
      expect(result.sessionData).toBeDefined();
      expect(result.sessionData.focusScore).toBe(0.85);
    });

    it('should return null when session not found', () => {
      const mockStmt = { get: jest.fn().mockReturnValue(undefined) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningSessionById('nonexistent', 'valid_token');

      expect(result).toBeNull();
    });

    it('should return null for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getLearningSessionById('session_123', 'invalid_token');

      expect(result).toBeNull();
    });

    it('should handle invalid JSON in session_data', () => {
      const mockRow = {
        ...createMockSessionRow(),
        session_data: 'invalid json',
      };
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningSessionById('session_123', 'valid_token');

      expect(result.sessionData).toBeNull();
    });

    it('should convert dates properly', () => {
      const mockRow = createMockSessionRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningSessionById('session_123', 'valid_token');

      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  // =============================================================================
  // getSessionsByTopic
  // =============================================================================

  describe('getSessionsByTopic', () => {
    it('should return sessions for topic', () => {
      const mockRows = [
        createMockSessionRow(),
        createMockSessionRow({ id: 'session_456' }),
      ];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getSessionsByTopic('topic_123', 'valid_token');

      expect(result).toHaveLength(2);
      expect(result[0].topicId).toBe('topic_123');
    });

    it('should apply limit and offset', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getSessionsByTopic('topic_123', 'valid_token', {
        limit: 10,
        offset: 20,
      });

      expect(mockStmt.all).toHaveBeenCalledWith('topic_123', 1, 10, 20);
    });

    it('should return empty array for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getSessionsByTopic('topic_123', 'invalid_token');

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // getRecentSessions
  // =============================================================================

  describe('getRecentSessions', () => {
    it('should return recent sessions', () => {
      const mockRows = [createMockSessionRow()];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getRecentSessions('valid_token', 7);

      // The query uses parameterized days, check that it's called correctly
      expect(mockStmt.all).toHaveBeenCalledWith(1, 7);
      expect(result).toHaveLength(1);
    });

    it('should default to 7 days', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getRecentSessions('valid_token');

      expect(mockStmt.all).toHaveBeenCalledWith(1, 7);
    });
  });

  // =============================================================================
  // startLearningSession
  // =============================================================================

  describe('startLearningSession', () => {
    it('should create new session', () => {
      const mockRunStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(
          createMockSessionRow({
            completed_at: null,
            duration_minutes: null,
            items_reviewed: 0,
            items_correct: 0,
            items_new: 0,
          })
        ),
      };

      db.prepare.mockReturnValueOnce(mockRunStmt).mockReturnValueOnce(mockGetStmt);

      const result = startLearningSession(
        {
          topicId: 'topic_123',
          planId: 'plan_123',
          sessionType: 'learn',
        },
        'valid_token'
      );

      expect(mockRunStmt.run).toHaveBeenCalled();
      expect(result.topicId).toBe('topic_123');
    });

    it('should allow sessions without plan', () => {
      const mockRunStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(
          createMockSessionRow({
            plan_id: null,
          })
        ),
      };

      db.prepare.mockReturnValueOnce(mockRunStmt).mockReturnValueOnce(mockGetStmt);

      const result = startLearningSession(
        {
          topicId: 'topic_123',
          sessionType: 'practice',
        },
        'valid_token'
      );

      expect(result.planId).toBeNull();
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = startLearningSession(
        { topicId: 'topic_123', sessionType: 'learn' },
        'invalid_token'
      );

      expect(result.error).toBe('Invalid session');
    });

    it('should handle database errors', () => {
      db.prepare.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = startLearningSession(
        { topicId: 'topic_123', sessionType: 'learn' },
        'valid_token'
      );

      expect(result.error).toBe('DB Error');
    });
  });

  // =============================================================================
  // completeLearningSession
  // =============================================================================

  describe('completeLearningSession', () => {
    it('should complete session with results', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockSessionRow()),
      };
      const mockUpdateStmt = { run: jest.fn() };
      // The streak write-back runs a SELECT against learning_session
      // to find the previous session's date. Returning null => "no
      // prior session" path => streak resets to 1, no extra prepares.
      const mockPrevSessionStmt = { get: jest.fn().mockReturnValue(null) };

      // 1: getLearningSessionById (initial check)
      // 2: UPDATE statement
      // 3: SELECT prev session inside updateStreakAfterSession (Phase 8)
      // 4: getLearningSessionById (return updated)
      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockPrevSessionStmt)
        .mockReturnValueOnce(mockGetStmt);

      const result = completeLearningSession(
        'session_123',
        {
          itemsReviewed: 30,
          itemsCorrect: 25,
          itemsNew: 10,
          sessionData: { focusScore: 0.9 },
        },
        'valid_token'
      );

      expect(mockUpdateStmt.run).toHaveBeenCalled();
      expect(result.itemsReviewed).toBe(25); // From mock row
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = completeLearningSession(
        'session_123',
        { itemsReviewed: 10, itemsCorrect: 8 },
        'invalid_token'
      );

      expect(result.error).toBe('Invalid session');
    });

    it('should return error when session not found', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(undefined) };
      db.prepare.mockReturnValue(mockGetStmt);

      const result = completeLearningSession(
        'nonexistent',
        { itemsReviewed: 10, itemsCorrect: 8 },
        'valid_token'
      );

      expect(result.error).toBe('Session not found');
    });

    // -------------------------------------------------------------------
    // Phase 8 streak chain — verify the three updateStreakAfterSession
    // branches by inspecting the writeback call to updateGlobalProfile.
    // -------------------------------------------------------------------
    describe('streak write-back', () => {
      const {
        getGlobalProfile,
        updateGlobalProfile,
      } = require('../../main/db/LearnerProfileManager');

      // Anchor the "current" session to real now so toDateString()
      // comparisons against `new Date(...)` derived prev timestamps line up.
      // The default mock row uses 2024-01-15 which won't match real-clock
      // "yesterday" / "today" values.
      const runCompleteWithPrevSession = (prevStartedAt, currentStreak) => {
        getGlobalProfile.mockReturnValue({
          globalProfile: { streakRecord: currentStreak },
        });
        const currentStartedAt = new Date().toISOString();
        const mockGetStmt = {
          get: jest
            .fn()
            .mockReturnValue(
              createMockSessionRow({ started_at: currentStartedAt })
            ),
        };
        const mockUpdateStmt = { run: jest.fn() };
        const mockPrevStmt = {
          get: jest.fn().mockReturnValue({ startedAt: prevStartedAt }),
        };
        db.prepare
          .mockReturnValueOnce(mockGetStmt) // initial getLearningSessionById
          .mockReturnValueOnce(mockUpdateStmt) // UPDATE
          .mockReturnValueOnce(mockPrevStmt) // prev-session SELECT
          .mockReturnValueOnce(mockGetStmt); // final getLearningSessionById

        completeLearningSession(
          'session_123',
          { itemsReviewed: 5, itemsCorrect: 4 },
          'valid_token'
        );
      };

      it('extends streak by 1 when prev session was yesterday', () => {
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        runCompleteWithPrevSession(yesterday, 5);
        expect(updateGlobalProfile).toHaveBeenCalledWith(
          { streakRecord: 6 },
          'valid_token'
        );
      });

      it('keeps streak unchanged when prev session was today', () => {
        const today = new Date().toISOString();
        runCompleteWithPrevSession(today, 5);
        expect(updateGlobalProfile).toHaveBeenCalledWith(
          { streakRecord: 5 },
          'valid_token'
        );
      });

      it('resets streak to 1 after a 2+ day gap', () => {
        const threeDaysAgo = new Date(
          Date.now() - 3 * 86400000
        ).toISOString();
        runCompleteWithPrevSession(threeDaysAgo, 10);
        expect(updateGlobalProfile).toHaveBeenCalledWith(
          { streakRecord: 1 },
          'valid_token'
        );
      });

      it('skips streak write-back entirely when itemsReviewed is 0', () => {
        const mockGetStmt = {
          get: jest.fn().mockReturnValue(createMockSessionRow()),
        };
        const mockUpdateStmt = { run: jest.fn() };
        db.prepare
          .mockReturnValueOnce(mockGetStmt)
          .mockReturnValueOnce(mockUpdateStmt)
          .mockReturnValueOnce(mockGetStmt);

        completeLearningSession(
          'session_123',
          { itemsReviewed: 0, itemsCorrect: 0 },
          'valid_token'
        );

        expect(updateGlobalProfile).not.toHaveBeenCalled();
      });
    });
  });

  // =============================================================================
  // recordItemPerformance
  // =============================================================================

  describe('recordItemPerformance', () => {
    it('should record performance data', () => {
      const mockRunStmt = { run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }) };
      db.prepare.mockReturnValue(mockRunStmt);

      const result = recordItemPerformance(
        {
          topicId: 'topic_123',
          itemId: 'item_1',
          itemType: 'word',
          wasCorrect: true,
          responseTimeMs: 2000,
          confidenceLevel: 4,
        },
        'valid_token'
      );

      expect(mockRunStmt.run).toHaveBeenCalled();
      expect(result.id).toBe(1);
      expect(result.topicId).toBe('topic_123');
    });

    it('should record optional fields', () => {
      const mockRunStmt = { run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }) };
      db.prepare.mockReturnValue(mockRunStmt);

      recordItemPerformance(
        {
          topicId: 'topic_123',
          itemId: 'item_1',
          itemType: 'word',
          wasCorrect: false,
          mistakeType: 'spelling',
          difficultyRating: 5,
          masteryBefore: 40,
          masteryAfter: 35,
          sessionId: 'session_123',
        },
        'valid_token'
      );

      const runCall = mockRunStmt.run.mock.calls[0];
      expect(runCall).toContain('spelling');
      expect(runCall).toContain(5);
      expect(runCall).toContain(40);
      expect(runCall).toContain(35);
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = recordItemPerformance(
        { topicId: 'topic_123', itemId: 'item_1', itemType: 'word', wasCorrect: true },
        'invalid_token'
      );

      expect(result.error).toBe('Invalid session');
    });
  });

  // =============================================================================
  // getItemPerformanceHistory
  // =============================================================================

  describe('getItemPerformanceHistory', () => {
    it('should return performance history for item', () => {
      const mockRows = [
        createMockPerformanceRow(),
        createMockPerformanceRow({ id: 2, was_correct: 0 }),
      ];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getItemPerformanceHistory(
        'topic_123',
        'item_1',
        'valid_token'
      );

      expect(result).toHaveLength(2);
      expect(result[0].wasCorrect).toBe(true);
      expect(result[1].wasCorrect).toBe(false);
    });

    it('should apply limit from options', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getItemPerformanceHistory('topic_123', 'item_1', 'valid_token', { limit: 10 });

      // Order: userId, topicId, itemId, limit
      expect(mockStmt.all).toHaveBeenCalledWith(1, 'topic_123', 'item_1', 10);
    });

    it('should return empty array for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getItemPerformanceHistory(
        'topic_123',
        'item_1',
        'invalid_token'
      );

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // getWeakItems
  // =============================================================================

  describe('getWeakItems', () => {
    it('should return items with low accuracy', () => {
      const mockRows = [
        {
          item_id: 'item_1',
          item_type: 'word',
          total_reviews: 10,
          correct_count: 3,
          accuracy: 0.3,
          current_mastery: 25,
        },
        {
          item_id: 'item_2',
          item_type: 'word',
          total_reviews: 8,
          correct_count: 4,
          accuracy: 0.5,
          current_mastery: 35,
        },
      ];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getWeakItems('topic_123', 'valid_token');

      expect(result).toHaveLength(2);
      // accuracy is multiplied by 100 in the return
      expect(result[0].accuracy).toBe(30); // 0.3 * 100
    });

    it('should apply limit', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getWeakItems('topic_123', 'valid_token', 5);

      // Order: userId, topicId, limit
      expect(mockStmt.all).toHaveBeenCalledWith(1, 'topic_123', 5);
    });

    it('should order by accuracy ascending', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getWeakItems('topic_123', 'valid_token');

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY accuracy ASC')
      );
    });
  });

  // =============================================================================
  // getDailyActivity
  // =============================================================================

  describe('getDailyActivity', () => {
    it('should return daily activity for date range', () => {
      const mockRows = [
        {
          date: '2024-01-15',
          topic_id: 'topic_123',
          sessions_count: 3,
          total_minutes: 45,
          items_reviewed: 75,
          items_correct: 60,
          new_items_learned: 15,
        },
        {
          date: '2024-01-14',
          topic_id: 'topic_123',
          sessions_count: 2,
          total_minutes: 30,
          items_reviewed: 50,
          items_correct: 40,
          new_items_learned: 10,
        },
      ];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getDailyActivity('valid_token', 7);

      expect(result).toHaveLength(2);
      expect(result[0].sessionsCount).toBe(3);
      expect(result[0].accuracy).toBeCloseTo(80, 0); // 60/75 * 100
    });

    it('should default to 30 days', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getDailyActivity('valid_token');

      expect(mockStmt.all).toHaveBeenCalledWith(1, 30);
    });

    it('should calculate accuracy correctly', () => {
      const mockRows = [
        {
          date: '2024-01-15',
          topic_id: 'topic_123',
          sessions_count: 1,
          total_minutes: 10,
          items_reviewed: 100,
          items_correct: 75,
          new_items_learned: 20,
        },
      ];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getDailyActivity('valid_token');

      expect(result[0].accuracy).toBe(75); // 75/100 * 100
    });

    it('should handle zero items reviewed on a day', () => {
      const mockRows = [
        {
          date: '2024-01-15',
          topic_id: 'topic_123',
          sessions_count: 1,
          total_minutes: 5,
          items_reviewed: 0,
          items_correct: 0,
          new_items_learned: 0,
        },
      ];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getDailyActivity('valid_token');

      expect(result[0].accuracy).toBe(0);
    });

    it('should return empty array for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getDailyActivity('invalid_token');

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // getOverallStatistics
  // =============================================================================

  describe('getOverallStatistics', () => {
    it('should return comprehensive statistics', () => {
      const mockOverallStmt = {
        get: jest.fn().mockReturnValue({
          total_sessions: 50,
          total_minutes: 1500,
          avg_session_minutes: 30,
          total_items_reviewed: 2500,
          total_items_correct: 2000,
          total_items_new: 500,
        }),
      };

      const mockRecentStmt = {
        get: jest.fn().mockReturnValue({
          count: 10,
        }),
      };

      const mockTopicsStmt = {
        get: jest.fn().mockReturnValue({
          active_topics: 3,
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockOverallStmt)
        .mockReturnValueOnce(mockRecentStmt)
        .mockReturnValueOnce(mockTopicsStmt);

      const result = getOverallStatistics('valid_token');

      expect(result.totalSessions).toBe(50);
      expect(result.totalMinutes).toBe(1500);
      expect(result.overallAccuracy).toBeCloseTo(80, 0);
      expect(result.sessionsLast7Days).toBe(10);
      expect(result.activeTopics).toBe(3);
    });

    it('should handle zero items reviewed', () => {
      const mockOverallStmt = {
        get: jest.fn().mockReturnValue({
          total_sessions: 0,
          total_minutes: 0,
          avg_session_minutes: 0,
          total_items_reviewed: 0,
          total_items_correct: 0,
          total_items_new: 0,
        }),
      };

      const mockRecentStmt = {
        get: jest.fn().mockReturnValue({
          count: 0,
        }),
      };

      const mockTopicsStmt = {
        get: jest.fn().mockReturnValue({
          active_topics: 0,
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockOverallStmt)
        .mockReturnValueOnce(mockRecentStmt)
        .mockReturnValueOnce(mockTopicsStmt);

      const result = getOverallStatistics('valid_token');

      expect(result.overallAccuracy).toBe(0);
    });

    it('should return null for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getOverallStatistics('invalid_token');

      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // Edge Cases and Error Handling
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle database errors in session functions', () => {
      db.prepare.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      expect(getLearningSessionById('session_123', 'valid_token')).toBeNull();
      expect(getSessionsByTopic('topic_123', 'valid_token')).toEqual([]);
      expect(getRecentSessions('valid_token')).toEqual([]);
      expect(
        startLearningSession({ topicId: 'topic_123', sessionType: 'learn' }, 'valid_token')
      ).toHaveProperty('error');
    });

    it('should handle null session_data gracefully', () => {
      const mockRow = {
        ...createMockSessionRow(),
        session_data: null,
      };
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningSessionById('session_123', 'valid_token');

      expect(result.sessionData).toBeNull();
    });

    it('should convert was_correct from 0/1 to boolean', () => {
      const mockRows = [
        createMockPerformanceRow({ was_correct: 1 }),
        createMockPerformanceRow({ id: 2, was_correct: 0 }),
      ];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getItemPerformanceHistory(
        'topic_123',
        'item_1',
        'valid_token'
      );

      expect(result[0].wasCorrect).toBe(true);
      expect(result[1].wasCorrect).toBe(false);
    });
  });
});
