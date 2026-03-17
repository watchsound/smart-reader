/**
 * studySessionHandlers.test.js
 *
 * Comprehensive unit tests for Study Session IPC handlers.
 * Tests the handlers in learningPlanHandlers.js for study session management.
 */

// Mock the database managers BEFORE requiring electron or handlers
const mockStartLearningSession = jest.fn();
const mockCompleteLearningSession = jest.fn();
const mockGetRecentSessions = jest.fn();
const mockGetDailyActivity = jest.fn();
const mockGetDueItems = jest.fn();

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

// Mock LearningSessionManager - used via inline require in handlers
jest.mock('../../main/db/LearningSessionManager', () => ({
  startLearningSession: (...args) => mockStartLearningSession(...args),
  completeLearningSession: (...args) => mockCompleteLearningSession(...args),
  getRecentSessions: (...args) => mockGetRecentSessions(...args),
  getDailyActivity: (...args) => mockGetDailyActivity(...args),
}));

// Mock LearningPlanGenerator
jest.mock('../../main/utils/LearningPlanGenerator', () => ({
  getInstance: jest.fn(() => ({
    generatePlan: jest.fn(),
    processReview: jest.fn(),
  })),
}));

// Mock LearningPointImporter
jest.mock('../../main/utils/LearningPointImporter', () => ({
  getInstance: jest.fn(() => ({
    parseCSV: jest.fn(),
    parseJSON: jest.fn(),
    parseTXT: jest.fn(),
    parseExcel: jest.fn(),
    getAvailableColumns: jest.fn(),
    importFromURL: jest.fn(),
  })),
}));

// Mock fs
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

const { ipcMain } = require('electron');

describe('Study Session IPC Handlers', () => {
  let handlers = {};
  let mockDbManager;
  let mockServices;

  beforeAll(() => {
    // Capture the handlers when they're registered
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    // Create mock services
    mockDbManager = {
      learningPlanManager: {
        getDueItems: mockGetDueItems,
        createPlan: jest.fn(),
        getPlan: jest.fn(),
        getPlans: jest.fn(),
        updatePlanStatus: jest.fn(),
        deletePlan: jest.fn(),
      },
      learningSessionManager: {
        createSession: jest.fn(),
        completeSession: jest.fn(),
        getSessionHistory: jest.fn(),
      },
      bookManager: {
        getBook: jest.fn(),
      },
      vocabularyManager: {
        getVocabularyBySet: jest.fn(),
        getVocabularySets: jest.fn(),
      },
    };

    mockServices = {
      dbManager: mockDbManager,
      aiProvider: {},
      graphInterface: null,
    };

    // Register the handlers
    const { registerLearningPlanHandlers } = require('../../main/ipc/learningPlanHandlers');
    registerLearningPlanHandlers({}, mockServices);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // study-session-start Handler Tests
  // =============================================================================

  describe('study-session-start', () => {
    it('should start a new study session successfully', async () => {
      const mockSession = {
        id: 'session_abc123',
        planId: 'plan_123',
        topicId: 'plan_123',
        sessionType: 'standard',
        startedAt: new Date(),
      };

      mockStartLearningSession.mockReturnValue(mockSession);

      const result = await handlers['study-session-start'](
        {},
        {
          planId: 'plan_123',
          mode: 'standard',
          itemCount: 20,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session_abc123');
      expect(result.session).toEqual(mockSession);
      expect(mockStartLearningSession).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'plan_123',
          topicId: 'plan_123',
          sessionType: 'standard',
        }),
        'valid_token'
      );
    });

    it('should handle session without planId (study all)', async () => {
      const mockSession = {
        id: 'session_xyz789',
        planId: null,
        topicId: 'study_session',
        sessionType: 'quick',
      };

      mockStartLearningSession.mockReturnValue(mockSession);

      const result = await handlers['study-session-start'](
        {},
        {
          planId: null,
          mode: 'quick',
          itemCount: 10,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(mockStartLearningSession).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: null,
          topicId: 'study_session',
          sessionType: 'quick',
        }),
        'valid_token'
      );
    });

    it('should return error when session creation fails', async () => {
      mockStartLearningSession.mockReturnValue({
        error: 'Invalid session',
      });

      const result = await handlers['study-session-start'](
        {},
        {
          planId: 'plan_123',
          mode: 'standard',
          itemCount: 20,
          token: 'invalid_token',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid session');
    });

    it('should handle exceptions gracefully', async () => {
      mockStartLearningSession.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await handlers['study-session-start'](
        {},
        {
          planId: 'plan_123',
          mode: 'standard',
          itemCount: 20,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should use default mode when not specified', async () => {
      const mockSession = {
        id: 'session_default',
        sessionType: 'standard',
      };

      mockStartLearningSession.mockReturnValue(mockSession);

      await handlers['study-session-start'](
        {},
        {
          planId: 'plan_123',
          itemCount: 10,
          token: 'valid_token',
        }
      );

      expect(mockStartLearningSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionType: 'standard',
        }),
        'valid_token'
      );
    });
  });

  // =============================================================================
  // study-session-complete Handler Tests
  // =============================================================================

  describe('study-session-complete', () => {
    it('should complete a session with full stats', async () => {
      const mockCompletedSession = {
        id: 'session_123',
        completedAt: new Date(),
        itemsReviewed: 25,
        itemsCorrect: 20,
        durationMinutes: 15,
      };

      mockCompleteLearningSession.mockReturnValue(mockCompletedSession);

      const result = await handlers['study-session-complete'](
        {},
        {
          sessionId: 'session_123',
          stats: {
            itemsReviewed: 25,
            correctCount: 20,
            newCount: 5,
            duration: 900,
            avgRating: 3.2,
            ratings: { again: 2, hard: 3, good: 15, easy: 5 },
          },
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockCompletedSession);
      expect(mockCompleteLearningSession).toHaveBeenCalledWith(
        'session_123',
        expect.objectContaining({
          itemsReviewed: 25,
          itemsCorrect: 20,
          itemsNew: 5,
          sessionData: expect.objectContaining({
            duration: 900,
            avgRating: 3.2,
          }),
        }),
        'valid_token'
      );
    });

    it('should handle completion with minimal stats', async () => {
      mockCompleteLearningSession.mockReturnValue({
        id: 'session_123',
        completedAt: new Date(),
      });

      const result = await handlers['study-session-complete'](
        {},
        {
          sessionId: 'session_123',
          stats: {},
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(mockCompleteLearningSession).toHaveBeenCalledWith(
        'session_123',
        expect.objectContaining({
          itemsReviewed: 0,
          itemsCorrect: 0,
          itemsNew: 0,
        }),
        'valid_token'
      );
    });

    it('should return error when completion fails', async () => {
      mockCompleteLearningSession.mockReturnValue({
        error: 'Session not found',
      });

      const result = await handlers['study-session-complete'](
        {},
        {
          sessionId: 'nonexistent_session',
          stats: { itemsReviewed: 10 },
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should handle null stats gracefully', async () => {
      mockCompleteLearningSession.mockReturnValue({
        id: 'session_123',
        completedAt: new Date(),
      });

      const result = await handlers['study-session-complete'](
        {},
        {
          sessionId: 'session_123',
          stats: null,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(mockCompleteLearningSession).toHaveBeenCalledWith(
        'session_123',
        expect.objectContaining({
          itemsReviewed: 0,
          itemsCorrect: 0,
          itemsNew: 0,
        }),
        'valid_token'
      );
    });

    it('should handle database exceptions', async () => {
      mockCompleteLearningSession.mockImplementation(() => {
        throw new Error('Transaction failed');
      });

      const result = await handlers['study-session-complete'](
        {},
        {
          sessionId: 'session_123',
          stats: { itemsReviewed: 10 },
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
    });
  });

  // =============================================================================
  // study-session-history Handler Tests
  // =============================================================================

  describe('study-session-history', () => {
    it('should return recent sessions', async () => {
      const mockSessions = [
        {
          id: 'session_1',
          planId: 'plan_123',
          startedAt: new Date('2024-01-15T10:00:00Z'),
          completedAt: new Date('2024-01-15T10:30:00Z'),
          itemsReviewed: 25,
        },
        {
          id: 'session_2',
          planId: 'plan_123',
          startedAt: new Date('2024-01-14T10:00:00Z'),
          completedAt: new Date('2024-01-14T10:20:00Z'),
          itemsReviewed: 20,
        },
      ];

      mockGetRecentSessions.mockReturnValue(mockSessions);

      const result = await handlers['study-session-history'](
        {},
        {
          planId: 'plan_123',
          limit: 10,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
      expect(mockGetRecentSessions).toHaveBeenCalledWith('valid_token', 30);
    });

    it('should filter sessions by planId', async () => {
      const mockSessions = [
        { id: 'session_1', planId: 'plan_123' },
        { id: 'session_2', planId: 'plan_456' },
        { id: 'session_3', planId: 'plan_123' },
      ];

      mockGetRecentSessions.mockReturnValue(mockSessions);

      const result = await handlers['study-session-history'](
        {},
        {
          planId: 'plan_123',
          limit: 10,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions.every(s => s.planId === 'plan_123')).toBe(true);
    });

    it('should return all sessions when planId is "all"', async () => {
      const mockSessions = [
        { id: 'session_1', planId: 'plan_123' },
        { id: 'session_2', planId: 'plan_456' },
      ];

      mockGetRecentSessions.mockReturnValue(mockSessions);

      const result = await handlers['study-session-history'](
        {},
        {
          planId: 'all',
          limit: 10,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
    });

    it('should apply limit to results', async () => {
      const mockSessions = Array.from({ length: 20 }, (_, i) => ({
        id: `session_${i}`,
        planId: 'plan_123',
      }));

      mockGetRecentSessions.mockReturnValue(mockSessions);

      const result = await handlers['study-session-history'](
        {},
        {
          planId: 'all',
          limit: 5,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(5);
    });

    it('should use default limit of 10', async () => {
      const mockSessions = Array.from({ length: 20 }, (_, i) => ({
        id: `session_${i}`,
      }));

      mockGetRecentSessions.mockReturnValue(mockSessions);

      const result = await handlers['study-session-history'](
        {},
        {
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(10);
    });

    it('should handle empty session history', async () => {
      mockGetRecentSessions.mockReturnValue([]);

      const result = await handlers['study-session-history'](
        {},
        {
          planId: 'plan_123',
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.sessions).toEqual([]);
    });

    it('should handle null params gracefully', async () => {
      mockGetRecentSessions.mockReturnValue([]);

      const result = await handlers['study-session-history']({}, null);

      expect(result.success).toBe(true);
      expect(result.sessions).toEqual([]);
    });

    it('should handle database exceptions', async () => {
      mockGetRecentSessions.mockImplementation(() => {
        throw new Error('Query failed');
      });

      const result = await handlers['study-session-history'](
        {},
        {
          planId: 'plan_123',
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });
  });

  // =============================================================================
  // learning-plan-daily-data Handler Tests
  // =============================================================================

  describe('learning-plan-daily-data', () => {
    it('should return aggregated daily data', async () => {
      const mockActivity = [
        {
          date: new Date('2024-01-15'),
          topicId: 'plan_123',
          sessionsCount: 3,
          totalMinutes: 45,
          itemsReviewed: 75,
          itemsCorrect: 60,
        },
        {
          date: new Date('2024-01-15'),
          topicId: 'plan_123',
          sessionsCount: 1,
          totalMinutes: 15,
          itemsReviewed: 25,
          itemsCorrect: 20,
        },
        {
          date: new Date('2024-01-14'),
          topicId: 'plan_123',
          sessionsCount: 2,
          totalMinutes: 30,
          itemsReviewed: 50,
          itemsCorrect: 40,
        },
      ];

      mockGetDailyActivity.mockReturnValue(mockActivity);

      const result = await handlers['learning-plan-daily-data'](
        {},
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          planId: 'all',
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.data['2024-01-15']).toBeDefined();
      expect(result.data['2024-01-15'].reviewed).toBe(100); // 75 + 25
      expect(result.data['2024-01-15'].correct).toBe(80); // 60 + 20
      expect(result.data['2024-01-15'].sessions).toBe(4); // 3 + 1
      expect(result.data['2024-01-15'].duration).toBe(60); // 45 + 15
    });

    it('should filter by planId', async () => {
      const mockActivity = [
        {
          date: new Date('2024-01-15'),
          topicId: 'plan_123',
          itemsReviewed: 50,
          itemsCorrect: 40,
          sessionsCount: 2,
          totalMinutes: 30,
        },
        {
          date: new Date('2024-01-15'),
          topicId: 'plan_456',
          itemsReviewed: 30,
          itemsCorrect: 25,
          sessionsCount: 1,
          totalMinutes: 20,
        },
      ];

      mockGetDailyActivity.mockReturnValue(mockActivity);

      const result = await handlers['learning-plan-daily-data'](
        {},
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          planId: 'plan_123',
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.data['2024-01-15'].reviewed).toBe(50);
    });

    it('should calculate correct days difference', async () => {
      mockGetDailyActivity.mockReturnValue([]);

      await handlers['learning-plan-daily-data'](
        {},
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          token: 'valid_token',
        }
      );

      // 31 days in January
      expect(mockGetDailyActivity).toHaveBeenCalledWith('valid_token', 31);
    });

    it('should return empty data for no activity', async () => {
      mockGetDailyActivity.mockReturnValue([]);

      const result = await handlers['learning-plan-daily-data'](
        {},
        {
          startDate: '2024-01-01',
          endDate: '2024-01-07',
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should handle database exceptions', async () => {
      mockGetDailyActivity.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await handlers['learning-plan-daily-data'](
        {},
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  // =============================================================================
  // learning-plan-forecast Handler Tests
  // =============================================================================

  describe('learning-plan-forecast', () => {
    it('should return forecast for upcoming days', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);

      const mockDueItems = [
        { id: 'item_1', nextReview: today.toISOString() },
        { id: 'item_2', nextReview: today.toISOString() },
        { id: 'item_3', nextReview: tomorrow.toISOString() },
        { id: 'item_4', nextReview: dayAfter.toISOString() },
      ];

      mockGetDueItems.mockResolvedValue(mockDueItems);

      const result = await handlers['learning-plan-forecast'](
        {},
        {
          days: 3,
          planId: 'plan_123',
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.forecast).toHaveLength(3);
      // Today should include all items due today or earlier (2 overdue/today)
      expect(result.forecast[0].dueCount).toBe(2);
      // Tomorrow should only have items scheduled for tomorrow
      expect(result.forecast[1].dueCount).toBe(1);
      // Day after should only have items scheduled for that day
      expect(result.forecast[2].dueCount).toBe(1);
    });

    it('should use default of 7 days', async () => {
      mockGetDueItems.mockResolvedValue([]);

      const result = await handlers['learning-plan-forecast'](
        {},
        {
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.forecast).toHaveLength(7);
    });

    it('should handle empty due items', async () => {
      mockGetDueItems.mockResolvedValue([]);

      const result = await handlers['learning-plan-forecast'](
        {},
        {
          days: 5,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      expect(result.forecast).toHaveLength(5);
      expect(result.forecast.every(d => d.dueCount === 0)).toBe(true);
    });

    it('should handle items with no nextReview date', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mockDueItems = [
        { id: 'item_1', nextReview: null },
        { id: 'item_2', nextReview: undefined },
        { id: 'item_3' }, // no nextReview property
      ];

      mockGetDueItems.mockResolvedValue(mockDueItems);

      const result = await handlers['learning-plan-forecast'](
        {},
        {
          days: 3,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      // Items without nextReview should default to today
      expect(result.forecast[0].dueCount).toBe(3);
    });

    it('should include correct date strings in forecast', async () => {
      mockGetDueItems.mockResolvedValue([]);

      const result = await handlers['learning-plan-forecast'](
        {},
        {
          days: 3,
          token: 'valid_token',
        }
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      expect(result.forecast[0].date).toBe(today.toISOString().split('T')[0]);
    });

    it('should handle null params gracefully', async () => {
      mockGetDueItems.mockResolvedValue([]);

      const result = await handlers['learning-plan-forecast']({}, null);

      expect(result.success).toBe(true);
      expect(result.forecast).toHaveLength(7);
    });

    it('should handle database exceptions', async () => {
      mockGetDueItems.mockRejectedValue(new Error('Query timeout'));

      const result = await handlers['learning-plan-forecast'](
        {},
        {
          days: 7,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query timeout');
    });
  });

  // =============================================================================
  // Integration-like Tests
  // =============================================================================

  describe('Full Session Workflow', () => {
    it('should support complete session lifecycle', async () => {
      // 1. Start session
      const mockStartedSession = {
        id: 'session_workflow_123',
        planId: 'plan_123',
        sessionType: 'standard',
        startedAt: new Date(),
      };
      mockStartLearningSession.mockReturnValue(mockStartedSession);

      const startResult = await handlers['study-session-start'](
        {},
        {
          planId: 'plan_123',
          mode: 'standard',
          itemCount: 20,
          token: 'valid_token',
        }
      );

      expect(startResult.success).toBe(true);
      const sessionId = startResult.sessionId;

      // 2. Complete session
      const mockCompletedSession = {
        id: sessionId,
        completedAt: new Date(),
        itemsReviewed: 20,
        itemsCorrect: 16,
      };
      mockCompleteLearningSession.mockReturnValue(mockCompletedSession);

      const completeResult = await handlers['study-session-complete'](
        {},
        {
          sessionId,
          stats: {
            itemsReviewed: 20,
            correctCount: 16,
            duration: 600,
            avgRating: 3.5,
          },
          token: 'valid_token',
        }
      );

      expect(completeResult.success).toBe(true);

      // 3. Verify in history
      // The completed session should include planId for filtering to work
      const sessionWithPlan = { ...mockCompletedSession, planId: 'plan_123' };
      mockGetRecentSessions.mockReturnValue([sessionWithPlan]);

      const historyResult = await handlers['study-session-history'](
        {},
        {
          planId: 'plan_123',
          limit: 10,
          token: 'valid_token',
        }
      );

      expect(historyResult.success).toBe(true);
      expect(historyResult.sessions).toContainEqual(
        expect.objectContaining({ id: sessionId })
      );
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle very large item counts in session', async () => {
      const mockSession = {
        id: 'session_large',
        itemsReviewed: 10000,
      };
      mockStartLearningSession.mockReturnValue(mockSession);

      const result = await handlers['study-session-start'](
        {},
        {
          planId: 'plan_123',
          mode: 'cram',
          itemCount: 10000,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
    });

    it('should handle special characters in planId', async () => {
      const specialPlanId = 'plan_特殊字符_123';
      const mockSession = {
        id: 'session_special',
        planId: specialPlanId,
      };
      mockStartLearningSession.mockReturnValue(mockSession);

      const result = await handlers['study-session-start'](
        {},
        {
          planId: specialPlanId,
          mode: 'standard',
          itemCount: 10,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
    });

    it('should handle future dates in forecast', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockDueItems = [
        { id: 'item_1', nextReview: futureDate.toISOString() },
      ];

      mockGetDueItems.mockResolvedValue(mockDueItems);

      const result = await handlers['learning-plan-forecast'](
        {},
        {
          days: 7,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      // Items scheduled far in the future should not appear in 7-day forecast
      expect(result.forecast.every(d => d.dueCount === 0)).toBe(true);
    });

    it('should handle overdue items (past dates)', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

      const mockDueItems = [
        { id: 'item_overdue', nextReview: pastDate.toISOString() },
      ];

      mockGetDueItems.mockResolvedValue(mockDueItems);

      const result = await handlers['learning-plan-forecast'](
        {},
        {
          days: 3,
          token: 'valid_token',
        }
      );

      expect(result.success).toBe(true);
      // Overdue items should appear in today's count
      expect(result.forecast[0].dueCount).toBe(1);
    });
  });
});
