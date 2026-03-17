/**
 * LearningTopicManager.test.js
 *
 * Unit tests for LearningTopicManager.js database operations.
 * Tests CRUD operations for learning topics.
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

const db = require('../../main/db/dbManager').default;
const { getUserIdFromToken } = require('../../main/db/dbManager');
const { dateToSQLiteString } = require('../../commons/utils/SqliteHelper');

const {
  getLearningTopicById,
  getLearningTopics,
  getActiveTopics,
  getTopicsBySource,
  createLearningTopic,
  updateLearningTopic,
  deleteLearningTopic,
  updateTopicProgress,
  getTopicStatistics,
  countTopicsByStatus,
} = require('../../main/db/LearningTopicManager');

describe('LearningTopicManager', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    getUserIdFromToken.mockReturnValue(1); // Default valid user
  });

  // =============================================================================
  // getLearningTopicById
  // =============================================================================

  describe('getLearningTopicById', () => {
    it('should return topic when found', () => {
      const mockRow = {
        id: 'topic_123',
        user_id: 1,
        name: 'GRE Vocabulary',
        description: 'Prepare for GRE',
        domain_type: 'vocabulary',
        source_type: null,
        source_id: null,
        target_date: '2024-06-01T00:00:00.000Z',
        daily_time_minutes: 30,
        difficulty: 'intermediate',
        status: 'active',
        progress_percent: 45.5,
        mastered_items: 455,
        total_items: 1000,
        streak_days: 12,
        last_studied_at: '2024-01-14T10:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-14T12:00:00.000Z',
      };

      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningTopicById('topic_123', 'valid_token');

      expect(db.prepare).toHaveBeenCalledWith(
        'SELECT * FROM learning_topic WHERE id = ? AND user_id = ?'
      );
      expect(mockStmt.get).toHaveBeenCalledWith('topic_123', 1);
      expect(result).toEqual({
        id: 'topic_123',
        userId: 1,
        name: 'GRE Vocabulary',
        description: 'Prepare for GRE',
        domainType: 'vocabulary',
        sourceType: null,
        sourceId: null,
        targetDate: expect.any(Date),
        dailyTimeMinutes: 30,
        difficulty: 'intermediate',
        status: 'active',
        progressPercent: 45.5,
        masteredItems: 455,
        totalItems: 1000,
        streakDays: 12,
        lastStudiedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should return null when topic not found', () => {
      const mockStmt = { get: jest.fn().mockReturnValue(undefined) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningTopicById('nonexistent', 'valid_token');

      expect(result).toBeNull();
    });

    it('should return null for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getLearningTopicById('topic_123', 'invalid_token');

      expect(result).toBeNull();
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', () => {
      db.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = getLearningTopicById('topic_123', 'valid_token');

      expect(result).toBeNull();
    });

    it('should handle null optional fields', () => {
      const mockRow = {
        id: 'topic_123',
        user_id: 1,
        name: 'Minimal Topic',
        description: null,
        domain_type: 'vocabulary',
        source_type: null,
        source_id: null,
        target_date: null,
        daily_time_minutes: null,
        difficulty: null,
        status: null,
        progress_percent: null,
        mastered_items: null,
        total_items: null,
        streak_days: null,
        last_studied_at: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: null,
      };

      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningTopicById('topic_123', 'valid_token');

      expect(result.description).toBeNull();
      expect(result.targetDate).toBeNull();
      expect(result.dailyTimeMinutes).toBe(15); // default
      expect(result.difficulty).toBe('auto'); // default
      expect(result.status).toBe('planning'); // default
      expect(result.progressPercent).toBe(0); // default
    });
  });

  // =============================================================================
  // getLearningTopics
  // =============================================================================

  describe('getLearningTopics', () => {
    it('should return all topics for user', () => {
      const mockRows = [
        {
          id: 'topic_1',
          user_id: 1,
          name: 'Topic 1',
          domain_type: 'vocabulary',
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'topic_2',
          user_id: 1,
          name: 'Topic 2',
          domain_type: 'math',
          status: 'planning',
          created_at: '2024-01-02T00:00:00.000Z',
        },
      ];

      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningTopics('valid_token');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Topic 1');
      expect(result[1].name).toBe('Topic 2');
    });

    it('should filter by status', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getLearningTopics('valid_token', { status: 'active' });

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND status = ?')
      );
      expect(mockStmt.all).toHaveBeenCalledWith(1, 'active', 100, 0);
    });

    it('should filter by domainType', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getLearningTopics('valid_token', { domainType: 'vocabulary' });

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND domain_type = ?')
      );
      expect(mockStmt.all).toHaveBeenCalledWith(1, 'vocabulary', 100, 0);
    });

    it('should filter by both status and domainType', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getLearningTopics('valid_token', {
        status: 'active',
        domainType: 'vocabulary',
      });

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND status = ?')
      );
      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND domain_type = ?')
      );
      expect(mockStmt.all).toHaveBeenCalledWith(1, 'active', 'vocabulary', 100, 0);
    });

    it('should apply limit and offset', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getLearningTopics('valid_token', { limit: 10, offset: 20 });

      expect(mockStmt.all).toHaveBeenCalledWith(1, 10, 20);
    });

    it('should return empty array for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getLearningTopics('invalid_token');

      expect(result).toEqual([]);
    });

    it('should return empty array on database error', () => {
      db.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = getLearningTopics('valid_token');

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // getActiveTopics
  // =============================================================================

  describe('getActiveTopics', () => {
    it('should call getLearningTopics with status active', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getActiveTopics('valid_token');

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND status = ?')
      );
    });
  });

  // =============================================================================
  // getTopicsBySource
  // =============================================================================

  describe('getTopicsBySource', () => {
    it('should filter by source type and id', () => {
      const mockRows = [
        {
          id: 'topic_1',
          user_id: 1,
          name: 'Book Topic',
          source_type: 'book',
          source_id: 'book_123',
          domain_type: 'knowledge',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getTopicsBySource('book', 'book_123', 'valid_token');

      expect(mockStmt.all).toHaveBeenCalledWith(1, 'book', 'book_123');
      expect(result).toHaveLength(1);
      expect(result[0].sourceType).toBe('book');
    });

    it('should return empty array for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getTopicsBySource('book', 'book_123', 'invalid_token');

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // createLearningTopic
  // =============================================================================

  describe('createLearningTopic', () => {
    it('should create topic with required fields', () => {
      const mockRunStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_generated',
          user_id: 1,
          name: 'New Topic',
          domain_type: 'vocabulary',
          created_at: '2024-01-15T00:00:00.000Z',
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockRunStmt) // INSERT
        .mockReturnValueOnce(mockGetStmt); // SELECT

      const result = createLearningTopic(
        {
          name: 'New Topic',
          domainType: 'vocabulary',
        },
        'valid_token'
      );

      expect(mockRunStmt.run).toHaveBeenCalled();
      expect(result.name).toBe('New Topic');
    });

    it('should create topic with all optional fields', () => {
      const mockRunStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_generated',
          user_id: 1,
          name: 'Full Topic',
          description: 'Description',
          domain_type: 'vocabulary',
          source_type: 'book',
          source_id: 'book_123',
          target_date: '2024-06-01T00:00:00.000Z',
          daily_time_minutes: 45,
          difficulty: 'advanced',
          status: 'active',
          created_at: '2024-01-15T00:00:00.000Z',
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockRunStmt)
        .mockReturnValueOnce(mockGetStmt);

      const result = createLearningTopic(
        {
          name: 'Full Topic',
          description: 'Description',
          domainType: 'vocabulary',
          sourceType: 'book',
          sourceId: 'book_123',
          targetDate: new Date('2024-06-01'),
          dailyTimeMinutes: 45,
          difficulty: 'advanced',
          status: 'active',
        },
        'valid_token'
      );

      expect(result.description).toBe('Description');
      expect(result.sourceType).toBe('book');
      expect(result.dailyTimeMinutes).toBe(45);
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = createLearningTopic(
        { name: 'Topic', domainType: 'vocabulary' },
        'invalid_token'
      );

      expect(result.error).toBe('Invalid session');
    });

    it('should handle database errors', () => {
      db.prepare.mockImplementation(() => {
        throw new Error('Constraint violation');
      });

      const result = createLearningTopic(
        { name: 'Topic', domainType: 'vocabulary' },
        'valid_token'
      );

      expect(result.error).toBe('Constraint violation');
    });

    it('should use default values for missing optional fields', () => {
      const mockRunStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_generated',
          user_id: 1,
          name: 'Minimal Topic',
          domain_type: 'vocabulary',
          daily_time_minutes: 15,
          difficulty: 'auto',
          status: 'planning',
          progress_percent: 0,
          created_at: '2024-01-15T00:00:00.000Z',
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockRunStmt)
        .mockReturnValueOnce(mockGetStmt);

      const result = createLearningTopic(
        { name: 'Minimal Topic', domainType: 'vocabulary' },
        'valid_token'
      );

      // Check that default values were passed to run
      const runCall = mockRunStmt.run.mock.calls[0];
      expect(runCall[8]).toBe(15); // dailyTimeMinutes default
      expect(runCall[9]).toBe('auto'); // difficulty default
      expect(runCall[10]).toBe('planning'); // status default
    });
  });

  // =============================================================================
  // updateLearningTopic
  // =============================================================================

  describe('updateLearningTopic', () => {
    it('should update single field', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Updated Name',
          domain_type: 'vocabulary',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-15T00:00:00.000Z',
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      const result = updateLearningTopic(
        'topic_123',
        { name: 'Updated Name' },
        'valid_token'
      );

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE learning_topic SET name = ?')
      );
      expect(result.name).toBe('Updated Name');
    });

    it('should update multiple fields', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Updated',
          status: 'active',
          progress_percent: 50,
          domain_type: 'vocabulary',
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateLearningTopic(
        'topic_123',
        {
          name: 'Updated',
          status: 'active',
          progressPercent: 50,
        },
        'valid_token'
      );

      const query = db.prepare.mock.calls[0][0];
      expect(query).toContain('name = ?');
      expect(query).toContain('status = ?');
      expect(query).toContain('progress_percent = ?');
    });

    it('should handle null targetDate', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          target_date: null,
          domain_type: 'vocabulary',
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateLearningTopic('topic_123', { targetDate: null }, 'valid_token');

      expect(mockUpdateStmt.run).toHaveBeenCalledWith(
        null, // targetDate
        expect.any(String), // updated_at
        'topic_123',
        1
      );
    });

    it('should return unchanged topic when no updates provided', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          domain_type: 'vocabulary',
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      db.prepare.mockReturnValue(mockGetStmt);

      const result = updateLearningTopic('topic_123', {}, 'valid_token');

      expect(result.id).toBe('topic_123');
      // Should only call prepare once (for SELECT, not UPDATE)
      expect(db.prepare).toHaveBeenCalledTimes(1);
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = updateLearningTopic(
        'topic_123',
        { name: 'Test' },
        'invalid_token'
      );

      expect(result.error).toBe('Invalid session');
    });

    it('should update all supported fields', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Full Update',
          domain_type: 'vocabulary',
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateLearningTopic(
        'topic_123',
        {
          name: 'Full Update',
          description: 'New description',
          targetDate: new Date('2024-07-01'),
          dailyTimeMinutes: 60,
          difficulty: 'expert',
          status: 'completed',
          progressPercent: 100,
          masteredItems: 500,
          totalItems: 500,
          streakDays: 30,
          lastStudiedAt: new Date(),
        },
        'valid_token'
      );

      const query = db.prepare.mock.calls[0][0];
      expect(query).toContain('name = ?');
      expect(query).toContain('description = ?');
      expect(query).toContain('target_date = ?');
      expect(query).toContain('daily_time_minutes = ?');
      expect(query).toContain('difficulty = ?');
      expect(query).toContain('status = ?');
      expect(query).toContain('progress_percent = ?');
      expect(query).toContain('mastered_items = ?');
      expect(query).toContain('total_items = ?');
      expect(query).toContain('streak_days = ?');
      expect(query).toContain('last_studied_at = ?');
      expect(query).toContain('updated_at = ?');
    });
  });

  // =============================================================================
  // deleteLearningTopic
  // =============================================================================

  describe('deleteLearningTopic', () => {
    it('should delete existing topic', () => {
      const mockStmt = { run: jest.fn().mockReturnValue({ changes: 1 }) };
      db.prepare.mockReturnValue(mockStmt);

      const result = deleteLearningTopic('topic_123', 'valid_token');

      expect(db.prepare).toHaveBeenCalledWith(
        'DELETE FROM learning_topic WHERE id = ? AND user_id = ?'
      );
      expect(mockStmt.run).toHaveBeenCalledWith('topic_123', 1);
      expect(result.success).toBe(true);
    });

    it('should return success false when topic not found', () => {
      const mockStmt = { run: jest.fn().mockReturnValue({ changes: 0 }) };
      db.prepare.mockReturnValue(mockStmt);

      const result = deleteLearningTopic('nonexistent', 'valid_token');

      expect(result.success).toBe(false);
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = deleteLearningTopic('topic_123', 'invalid_token');

      expect(result.error).toBe('Invalid session');
    });

    it('should handle database errors', () => {
      db.prepare.mockImplementation(() => {
        throw new Error('Foreign key constraint');
      });

      const result = deleteLearningTopic('topic_123', 'valid_token');

      expect(result.error).toBe('Foreign key constraint');
    });
  });

  // =============================================================================
  // updateTopicProgress
  // =============================================================================

  describe('updateTopicProgress', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should increment streak for consecutive day', () => {
      // First call: getLearningTopicById
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          domain_type: 'vocabulary',
          streak_days: 5,
          mastered_items: 100,
          total_items: 1000,
          last_studied_at: '2024-01-14T12:00:00.000Z', // Yesterday
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt) // Initial get
        .mockReturnValueOnce(mockUpdateStmt) // Update
        .mockReturnValueOnce(mockGetStmt); // Final get

      const result = updateTopicProgress(
        'topic_123',
        { newlyMastered: 10 },
        'valid_token'
      );

      // Check that streak was incremented
      const runCall = mockUpdateStmt.run.mock.calls[0];
      // The streak should be 6 (5 + 1)
      expect(runCall).toContain(6);
    });

    it('should reset streak after missed day', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          domain_type: 'vocabulary',
          streak_days: 10,
          mastered_items: 100,
          total_items: 1000,
          last_studied_at: '2024-01-12T12:00:00.000Z', // 3 days ago
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateTopicProgress('topic_123', { newlyMastered: 5 }, 'valid_token');

      // Check that streak was reset to 1
      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain(1);
    });

    it('should maintain streak for same day', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          domain_type: 'vocabulary',
          streak_days: 7,
          mastered_items: 100,
          total_items: 1000,
          last_studied_at: '2024-01-15T08:00:00.000Z', // Earlier today
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateTopicProgress('topic_123', { newlyMastered: 3 }, 'valid_token');

      // Streak should stay at 7
      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain(7);
    });

    it('should start streak at 1 for first session', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          domain_type: 'vocabulary',
          streak_days: 0,
          mastered_items: 0,
          total_items: 1000,
          last_studied_at: null, // Never studied
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateTopicProgress('topic_123', { newlyMastered: 5 }, 'valid_token');

      // Streak should be 1
      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain(1);
    });

    it('should update mastered items count', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          domain_type: 'vocabulary',
          streak_days: 5,
          mastered_items: 100,
          total_items: 1000,
          last_studied_at: '2024-01-14T12:00:00.000Z',
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateTopicProgress('topic_123', { newlyMastered: 10 }, 'valid_token');

      // Mastered items should be 110 (100 + 10)
      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain(110);
    });

    it('should calculate progress percent', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          domain_type: 'vocabulary',
          streak_days: 5,
          mastered_items: 450,
          total_items: 1000,
          last_studied_at: '2024-01-14T12:00:00.000Z',
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateTopicProgress('topic_123', { newlyMastered: 50 }, 'valid_token');

      // Progress should be 50% ((450 + 50) / 1000 * 100)
      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain(50);
    });

    it('should return error when topic not found', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(undefined) };
      db.prepare.mockReturnValue(mockGetStmt);

      const result = updateTopicProgress(
        'nonexistent',
        { newlyMastered: 5 },
        'valid_token'
      );

      expect(result.error).toBe('Topic not found');
    });
  });

  // =============================================================================
  // getTopicStatistics
  // =============================================================================

  describe('getTopicStatistics', () => {
    it('should return comprehensive statistics', () => {
      const mockTopicStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          domain_type: 'vocabulary',
          streak_days: 12,
          mastered_items: 450,
          total_items: 1000,
          progress_percent: 45,
          last_studied_at: '2024-01-14T12:00:00.000Z',
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      const mockSessionStmt = {
        get: jest.fn().mockReturnValue({
          total_sessions: 48,
          total_minutes: 1200,
          avg_session_minutes: 25,
          total_items_reviewed: 2400,
          total_items_correct: 2000,
        }),
      };

      const mockRecentStmt = {
        get: jest.fn().mockReturnValue({
          sessions_last_7_days: 7,
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockTopicStmt)
        .mockReturnValueOnce(mockSessionStmt)
        .mockReturnValueOnce(mockRecentStmt);

      const result = getTopicStatistics('topic_123', 'valid_token');

      expect(result.topicId).toBe('topic_123');
      expect(result.totalItems).toBe(1000);
      expect(result.masteredItems).toBe(450);
      expect(result.totalSessions).toBe(48);
      expect(result.totalTimeMinutes).toBe(1200);
      expect(result.currentStreak).toBe(12);
      expect(result.sessionsLast7Days).toBe(7);
      expect(result.overallAccuracy).toBeCloseTo(83.33, 1);
    });

    it('should return error when topic not found', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(undefined) };
      db.prepare.mockReturnValue(mockGetStmt);

      const result = getTopicStatistics('nonexistent', 'valid_token');

      expect(result.error).toBe('Topic not found');
    });

    it('should handle zero items reviewed', () => {
      const mockTopicStmt = {
        get: jest.fn().mockReturnValue({
          id: 'topic_123',
          user_id: 1,
          name: 'Topic',
          domain_type: 'vocabulary',
          streak_days: 0,
          mastered_items: 0,
          total_items: 1000,
          progress_percent: 0,
          created_at: '2024-01-01T00:00:00.000Z',
        }),
      };

      const mockSessionStmt = {
        get: jest.fn().mockReturnValue({
          total_sessions: 0,
          total_minutes: 0,
          avg_session_minutes: 0,
          total_items_reviewed: 0,
          total_items_correct: 0,
        }),
      };

      const mockRecentStmt = {
        get: jest.fn().mockReturnValue({
          sessions_last_7_days: 0,
        }),
      };

      db.prepare
        .mockReturnValueOnce(mockTopicStmt)
        .mockReturnValueOnce(mockSessionStmt)
        .mockReturnValueOnce(mockRecentStmt);

      const result = getTopicStatistics('topic_123', 'valid_token');

      expect(result.overallAccuracy).toBe(0);
      expect(result.totalSessions).toBe(0);
    });
  });

  // =============================================================================
  // countTopicsByStatus
  // =============================================================================

  describe('countTopicsByStatus', () => {
    it('should return counts for all statuses', () => {
      const mockRows = [
        { status: 'planning', count: 2 },
        { status: 'active', count: 5 },
        { status: 'paused', count: 1 },
        { status: 'completed', count: 3 },
      ];

      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = countTopicsByStatus('valid_token');

      expect(result.planning).toBe(2);
      expect(result.active).toBe(5);
      expect(result.paused).toBe(1);
      expect(result.completed).toBe(3);
      expect(result.archived).toBe(0);
      expect(result.total).toBe(11);
    });

    it('should return zeros when no topics exist', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      const result = countTopicsByStatus('valid_token');

      expect(result.planning).toBe(0);
      expect(result.active).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = countTopicsByStatus('invalid_token');

      expect(result.error).toBe('Invalid session');
    });
  });
});
