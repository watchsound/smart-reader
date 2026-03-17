/**
 * learningPlanApi.test.js
 *
 * Unit tests for learningPlanApi.js renderer-side API.
 * Tests IPC communication for study session and learning plan operations.
 */

// Import API (will use window.ipcRenderer which is set up by the global setup)
import learningPlanApi from '../../renderer/api/learningPlanApi';

describe('learningPlanApi', () => {
  let mockInvoke;

  beforeEach(() => {
    // Create a fresh mock for each test
    mockInvoke = jest.fn();

    // Set up window.electron.ipcRenderer (not window.ipcRenderer)
    window.electron = {
      ipcRenderer: {
        invoke: mockInvoke,
        send: jest.fn(),
        sendSync: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // Study Session API Methods
  // =============================================================================

  describe('startSession', () => {
    it('should invoke study-session-start with params', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        sessionId: 'session_123',
      });

      const params = {
        planId: 'plan_123',
        mode: 'standard',
        itemCount: 20,
        token: 'valid_token',
      };

      const result = await learningPlanApi.startSession(params);

      expect(mockInvoke).toHaveBeenCalledWith('study-session-start', params);
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session_123');
    });

    it('should handle API errors', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const result = await learningPlanApi.startSession({
        planId: 'plan_123',
        token: 'invalid_token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should handle IPC exceptions', async () => {
      mockInvoke.mockRejectedValue(new Error('IPC channel not found'));

      await expect(
        learningPlanApi.startSession({ planId: 'plan_123' })
      ).rejects.toThrow('IPC channel not found');
    });
  });

  describe('completeSession', () => {
    it('should invoke study-session-complete with params', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      });

      const params = {
        planId: 'plan_123',
        sessionId: 'session_123',
        stats: {
          itemsReviewed: 25,
          correctCount: 20,
          duration: 600,
          avgRating: 3.5,
        },
        token: 'valid_token',
      };

      const result = await learningPlanApi.completeSession(params);

      expect(mockInvoke).toHaveBeenCalledWith('study-session-complete', params);
      expect(result.success).toBe(true);
    });

    it('should handle session not found error', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Session not found',
      });

      const result = await learningPlanApi.completeSession({
        sessionId: 'nonexistent',
        stats: {},
        token: 'valid_token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });

  describe('getSessionHistory', () => {
    it('should invoke study-session-history with params', async () => {
      const mockSessions = [
        { id: 'session_1', planId: 'plan_123', itemsReviewed: 25 },
        { id: 'session_2', planId: 'plan_123', itemsReviewed: 20 },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        sessions: mockSessions,
      });

      const params = {
        planId: 'plan_123',
        limit: 10,
        token: 'valid_token',
      };

      const result = await learningPlanApi.getSessionHistory(params);

      expect(mockInvoke).toHaveBeenCalledWith('study-session-history', params);
      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
    });

    it('should return empty sessions array on error', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Database error',
        sessions: [],
      });

      const result = await learningPlanApi.getSessionHistory({
        planId: 'plan_123',
        token: 'valid_token',
      });

      expect(result.sessions).toEqual([]);
    });
  });

  describe('getDailyReviewData', () => {
    it('should invoke learning-plan-daily-data with params', async () => {
      const mockData = {
        '2024-01-15': { reviewed: 50, correct: 40, sessions: 2 },
        '2024-01-14': { reviewed: 30, correct: 25, sessions: 1 },
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockData,
      });

      const params = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        planId: 'plan_123',
        token: 'valid_token',
      };

      const result = await learningPlanApi.getDailyReviewData(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-daily-data', params);
      expect(result.success).toBe(true);
      expect(result.data['2024-01-15'].reviewed).toBe(50);
    });

    it('should handle date range with no data', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {},
      });

      const result = await learningPlanApi.getDailyReviewData({
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        token: 'valid_token',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });
  });

  describe('getForecast', () => {
    it('should invoke learning-plan-forecast with params', async () => {
      const mockForecast = [
        { date: '2024-01-15', dueCount: 25, newCount: 5, reviewCount: 25 },
        { date: '2024-01-16', dueCount: 15, newCount: 3, reviewCount: 15 },
        { date: '2024-01-17', dueCount: 10, newCount: 2, reviewCount: 10 },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        forecast: mockForecast,
      });

      const params = {
        days: 7,
        planId: 'plan_123',
        token: 'valid_token',
      };

      const result = await learningPlanApi.getForecast(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-forecast', params);
      expect(result.success).toBe(true);
      expect(result.forecast).toHaveLength(3);
    });

    it('should handle empty forecast', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        forecast: [],
      });

      const result = await learningPlanApi.getForecast({
        days: 7,
        token: 'valid_token',
      });

      expect(result.success).toBe(true);
      expect(result.forecast).toEqual([]);
    });
  });

  // =============================================================================
  // Learning Plan CRUD Methods
  // =============================================================================

  describe('createPlan', () => {
    it('should invoke learning-plan-create with plan data', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        plan: { id: 'plan_123', name: 'GRE Vocabulary' },
      });

      const planData = {
        goalName: 'GRE Vocabulary',
        domainType: 'vocabulary',
        learningPoints: [
          { front: 'Word 1', back: 'Definition 1' },
          { front: 'Word 2', back: 'Definition 2' },
        ],
        dailyMinutes: 30,
      };

      const result = await learningPlanApi.createPlan(planData);

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-create', planData);
      expect(result.success).toBe(true);
      expect(result.plan.name).toBe('GRE Vocabulary');
    });
  });

  describe('calculatePlan', () => {
    it('should invoke learning-plan-calculate with params', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        plan: {
          estimatedDays: 30,
          dailyNewItems: 10,
          dailyReviewItems: 20,
        },
      });

      const params = {
        totalItems: 500,
        dailyMinutes: 30,
        targetDate: '2024-03-15',
        domain: 'vocabulary',
        algorithm: 'leitner',
      };

      const result = await learningPlanApi.calculatePlan(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-calculate', params);
      expect(result.success).toBe(true);
      expect(result.plan.estimatedDays).toBe(30);
    });
  });

  describe('getDueItems', () => {
    it('should invoke learning-plan-get-due with params', async () => {
      const mockItems = [
        { id: 'item_1', front: 'Word 1', back: 'Definition 1', box: 1 },
        { id: 'item_2', front: 'Word 2', back: 'Definition 2', box: 2 },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        items: mockItems,
      });

      const params = {
        planId: 'plan_123',
        limit: 20,
        token: 'valid_token',
      };

      const result = await learningPlanApi.getDueItems(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-get-due', params);
      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(2);
    });
  });

  describe('recordReview', () => {
    it('should invoke learning-plan-record-review with params', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        result: {
          newBox: 2,
          nextReview: '2024-01-17T00:00:00Z',
        },
      });

      const params = {
        planId: 'plan_123',
        pointId: 'item_1',
        correct: true,
        responseTime: 2500,
      };

      const result = await learningPlanApi.recordReview(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-record-review', params);
      expect(result.success).toBe(true);
      expect(result.result.newBox).toBe(2);
    });
  });

  describe('listPlans', () => {
    it('should invoke learning-plan-list with params', async () => {
      const mockPlans = [
        { id: 'plan_1', name: 'GRE Vocabulary', status: 'active' },
        { id: 'plan_2', name: 'Spanish Basics', status: 'paused' },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        plans: mockPlans,
      });

      const params = {
        status: 'active',
        page: 1,
        limit: 20,
      };

      const result = await learningPlanApi.listPlans(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-list', params);
      expect(result.success).toBe(true);
      expect(result.plans).toHaveLength(2);
    });
  });

  describe('getPlan', () => {
    it('should invoke learning-plan-get with planId', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        plan: {
          id: 'plan_123',
          name: 'GRE Vocabulary',
          learningPoints: [],
        },
      });

      const result = await learningPlanApi.getPlan('plan_123');

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-get', 'plan_123');
      expect(result.success).toBe(true);
      expect(result.plan.id).toBe('plan_123');
    });
  });

  describe('togglePlanStatus', () => {
    it('should invoke learning-plan-toggle-status with params', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        status: 'paused',
      });

      const params = {
        planId: 'plan_123',
        status: 'paused',
      };

      const result = await learningPlanApi.togglePlanStatus(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-toggle-status', params);
      expect(result.success).toBe(true);
      expect(result.status).toBe('paused');
    });
  });

  describe('deletePlan', () => {
    it('should invoke learning-plan-delete with planId', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      });

      const result = await learningPlanApi.deletePlan('plan_123');

      expect(mockInvoke).toHaveBeenCalledWith('learning-plan-delete', 'plan_123');
      expect(result.success).toBe(true);
    });
  });

  // =============================================================================
  // Import Methods
  // =============================================================================

  describe('importFromFile', () => {
    it('should invoke learning-point-import-file with params', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        items: [
          { front: 'Word 1', back: 'Definition 1' },
          { front: 'Word 2', back: 'Definition 2' },
        ],
        columns: ['front', 'back', 'tags'],
      });

      const params = {
        filePath: '/path/to/file.csv',
        fileType: 'csv',
        domain: 'vocabulary',
        columnMapping: { front: 0, back: 1 },
      };

      const result = await learningPlanApi.importFromFile(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-point-import-file', params);
      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(2);
    });
  });

  describe('extractFromBook', () => {
    it('should invoke learning-point-extract-from-book with params', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        items: [
          { front: 'Key concept 1', back: 'Explanation' },
        ],
      });

      const params = {
        bookId: 'book_123',
        domain: 'knowledge',
      };

      const result = await learningPlanApi.extractFromBook(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-point-extract-from-book', params);
      expect(result.success).toBe(true);
    });
  });

  describe('loadFromVocabulary', () => {
    it('should invoke learning-point-from-vocabulary with params', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        items: [
          { front: 'Hello', back: 'Hola' },
        ],
      });

      const params = {
        setId: 'vocab_set_123',
      };

      const result = await learningPlanApi.loadFromVocabulary(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-point-from-vocabulary', params);
      expect(result.success).toBe(true);
    });
  });

  describe('importFromUrl', () => {
    it('should invoke learning-point-import-url with params', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        items: [
          { front: 'Term 1', back: 'Definition 1' },
        ],
      });

      const params = {
        url: 'https://quizlet.com/set/123',
        domain: 'vocabulary',
      };

      const result = await learningPlanApi.importFromUrl(params);

      expect(mockInvoke).toHaveBeenCalledWith('learning-point-import-url', params);
      expect(result.success).toBe(true);
    });
  });

  describe('getVocabularySets', () => {
    it('should invoke vocabulary-get-sets', async () => {
      const mockSets = [
        { id: 'set_1', name: 'Spanish Basics' },
        { id: 'set_2', name: 'GRE Words' },
      ];

      mockInvoke.mockResolvedValue(mockSets);

      const result = await learningPlanApi.getVocabularySets();

      expect(mockInvoke).toHaveBeenCalledWith('vocabulary-get-sets');
      expect(result).toHaveLength(2);
    });
  });

  // =============================================================================
  // Error Handling Edge Cases
  // =============================================================================

  describe('Error Handling', () => {
    it('should propagate IPC errors', async () => {
      mockInvoke.mockRejectedValue(new Error('IPC timeout'));

      await expect(learningPlanApi.startSession({})).rejects.toThrow('IPC timeout');
    });

    it('should handle null response', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await learningPlanApi.startSession({});

      expect(result).toBeNull();
    });

    it('should handle undefined response', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const result = await learningPlanApi.getDueItems({});

      expect(result).toBeUndefined();
    });

    it('should handle malformed response', async () => {
      mockInvoke.mockResolvedValue({
        unexpectedField: 'value',
      });

      const result = await learningPlanApi.getForecast({});

      // Should return whatever the IPC returns
      expect(result.unexpectedField).toBe('value');
      expect(result.success).toBeUndefined();
    });
  });
});
