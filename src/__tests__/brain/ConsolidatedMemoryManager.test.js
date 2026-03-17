/**
 * ConsolidatedMemoryManager.test.js
 *
 * Unit tests for the Consolidated Memory Manager (SQLite CRUD operations)
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
    if (token === 'brain-heartbeat') return 1;
    return -1;
  }),
}));

jest.mock('../../commons/utils/SqliteHelper', () => ({
  dateToSQLiteString: jest.fn((date) => date.toISOString()),
}));

// Import after mocks
const {
  initConsolidatedMemoryTable,
  createConsolidatedMemory,
  getConsolidatedMemories,
  getMemoryById,
  updateConsolidatedMemory,
  deleteConsolidatedMemory,
  deleteOldMemories,
  clearExpiredMemories,
  getConsolidationStats,
  getMemoriesForConcept,
  searchMemories,
  MEMORY_TYPES,
  MASTERY_LEVELS,
  LEARNING_STYLES,
} = require('../../main/db/ConsolidatedMemoryManager');

describe('ConsolidatedMemoryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStmt.get.mockReset();
    mockStmt.all.mockReset();
    mockStmt.run.mockReset();
  });

  // ====================
  // Constants
  // ====================

  describe('Constants', () => {
    it('should export MEMORY_TYPES', () => {
      expect(MEMORY_TYPES).toEqual({
        CONCEPT_SESSION: 'concept_session',
        DAILY: 'daily',
        WEEKLY: 'weekly',
      });
    });

    it('should export MASTERY_LEVELS', () => {
      expect(MASTERY_LEVELS).toEqual({
        BEGINNER: 'beginner',
        DEVELOPING: 'developing',
        PROFICIENT: 'proficient',
        MASTERED: 'mastered',
      });
    });

    it('should export LEARNING_STYLES', () => {
      expect(LEARNING_STYLES).toEqual({
        QUICK: 'quick',
        STEADY: 'steady',
        NEEDS_REPETITION: 'needs-repetition',
        VARIABLE: 'variable',
      });
    });
  });

  // ====================
  // Table Initialization
  // ====================

  describe('initConsolidatedMemoryTable', () => {
    it('should create consolidated_memory table and indexes', () => {
      const result = initConsolidatedMemoryTable();

      expect(result).toBe(true);
      expect(mockDb.exec).toHaveBeenCalledTimes(2);
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "consolidated_memory"')
      );
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
    });

    it('should handle database errors gracefully', () => {
      mockDb.exec.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const result = initConsolidatedMemoryTable();

      expect(result).toBe(false);
    });
  });

  // ====================
  // Create Memory
  // ====================

  describe('createConsolidatedMemory', () => {
    const validMemory = {
      conceptId: 'concept_123',
      conceptName: 'Vocabulary: ephemeral',
      memoryType: 'concept_session',
      periodStart: '2024-01-01T00:00:00Z',
      periodEnd: '2024-01-01T23:59:59Z',
      episodeCount: 5,
      summary: 'Learning session with steady improvement.',
      insights: ['Struggled initially', 'Improved after hints'],
      learningProcess: { accuracy: 80, correctCount: 4 },
      metrics: { totalReviews: 5, avgResponseTimeMs: 2500 },
      sourceEpisodes: ['ep_1', 'ep_2', 'ep_3'],
      masteryAssessment: 'developing',
      learningStyle: 'steady',
      recommendations: ['Practice daily'],
    };

    it('should create a memory with valid token', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = createConsolidatedMemory(validMemory, 'valid-token');

      expect(result.success).toBe(true);
      expect(result.memory).toBeDefined();
      expect(result.memory.userId).toBe(1);
      expect(result.memory.conceptName).toBe('Vocabulary: ephemeral');
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('should generate an ID if not provided', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = createConsolidatedMemory(validMemory, 'valid-token');

      expect(result.memory.id).toMatch(/^cm_\d+_[a-z0-9]+$/);
    });

    it('should use provided ID if given', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const memoryWithId = { ...validMemory, id: 'custom_id_123' };
      const result = createConsolidatedMemory(memoryWithId, 'valid-token');

      expect(result.memory.id).toBe('custom_id_123');
    });

    it('should reject invalid token', () => {
      const result = createConsolidatedMemory(validMemory, 'invalid-token');

      expect(result.error).toBe('Invalid token');
      expect(mockStmt.run).not.toHaveBeenCalled();
    });

    it('should stringify object fields (insights, metrics, etc.)', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      createConsolidatedMemory(validMemory, 'valid-token');

      const runArgs = mockStmt.run.mock.calls[0];
      // insights should be stringified (position 9 in args)
      expect(runArgs[9]).toBe(JSON.stringify(validMemory.insights));
      // metrics should be stringified (position 11)
      expect(runArgs[11]).toBe(JSON.stringify(validMemory.metrics));
    });

    it('should handle database errors', () => {
      mockStmt.run.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      const result = createConsolidatedMemory(validMemory, 'valid-token');

      expect(result.error).toBe('Insert failed');
    });

    it('should set default expiry to 365 days', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = createConsolidatedMemory(validMemory, 'valid-token');

      expect(result.memory.expiresAt).toBeDefined();
      const expiryDate = new Date(result.memory.expiresAt);
      const now = new Date();
      const daysDiff = Math.round((expiryDate - now) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(364);
      expect(daysDiff).toBeLessThanOrEqual(366);
    });
  });

  // ====================
  // Get Memories
  // ====================

  describe('getConsolidatedMemories', () => {
    const mockMemoryRow = {
      id: 'cm_123',
      user_id: 1,
      concept_id: 'concept_123',
      concept_name: 'Test Concept',
      memory_type: 'concept_session',
      period_start: '2024-01-01T00:00:00Z',
      period_end: '2024-01-01T23:59:59Z',
      episode_count: 5,
      summary: 'Test summary',
      insights: '["insight1", "insight2"]',
      learning_process: '{"accuracy": 80}',
      metrics: '{"totalReviews": 5}',
      source_episodes: '["ep_1", "ep_2"]',
      mastery_assessment: 'developing',
      learning_style: 'steady',
      recommendations: '["recommendation1"]',
      created_at: '2024-01-01T12:00:00Z',
      expires_at: '2025-01-01T12:00:00Z',
    };

    it('should return memories for valid token', () => {
      mockStmt.all.mockReturnValue([mockMemoryRow]);

      const result = getConsolidatedMemories({ token: 'valid-token' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cm_123');
      expect(result[0].conceptName).toBe('Test Concept');
    });

    it('should parse JSON fields', () => {
      mockStmt.all.mockReturnValue([mockMemoryRow]);

      const result = getConsolidatedMemories({ token: 'valid-token' });

      expect(result[0].insights).toEqual(['insight1', 'insight2']);
      expect(result[0].learningProcess).toEqual({ accuracy: 80 });
      expect(result[0].metrics).toEqual({ totalReviews: 5 });
      expect(result[0].sourceEpisodes).toEqual(['ep_1', 'ep_2']);
      expect(result[0].recommendations).toEqual(['recommendation1']);
    });

    it('should filter by conceptId', () => {
      mockStmt.all.mockReturnValue([mockMemoryRow]);

      getConsolidatedMemories({ token: 'valid-token', conceptId: 'concept_123' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND concept_id = ?')
      );
    });

    it('should filter by conceptName with LIKE', () => {
      mockStmt.all.mockReturnValue([]);

      getConsolidatedMemories({ token: 'valid-token', conceptName: 'Test' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND concept_name LIKE ?')
      );
    });

    it('should filter by memoryType', () => {
      mockStmt.all.mockReturnValue([]);

      getConsolidatedMemories({ token: 'valid-token', memoryType: 'daily' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND memory_type = ?')
      );
    });

    it('should filter by date range', () => {
      mockStmt.all.mockReturnValue([]);

      getConsolidatedMemories({
        token: 'valid-token',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND period_start >= ?')
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND period_end <= ?')
      );
    });

    it('should apply limit and offset', () => {
      mockStmt.all.mockReturnValue([]);

      getConsolidatedMemories({ token: 'valid-token', limit: 10, offset: 20 });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?')
      );
    });

    it('should return empty array for invalid token', () => {
      const result = getConsolidatedMemories({ token: 'invalid-token' });

      expect(result).toEqual([]);
      expect(mockStmt.all).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedRow = { ...mockMemoryRow, insights: 'not valid json' };
      mockStmt.all.mockReturnValue([malformedRow]);

      const result = getConsolidatedMemories({ token: 'valid-token' });

      expect(result[0].insights).toEqual([]);
    });
  });

  // ====================
  // Get Memory By ID
  // ====================

  describe('getMemoryById', () => {
    const mockRow = {
      id: 'cm_123',
      user_id: 1,
      concept_name: 'Test',
      memory_type: 'concept_session',
      period_start: '2024-01-01',
      period_end: '2024-01-01',
      episode_count: 5,
      summary: 'Test',
      insights: '[]',
      learning_process: '{}',
      metrics: '{}',
      source_episodes: '[]',
      recommendations: '[]',
    };

    it('should return memory for valid ID and token', () => {
      mockStmt.get.mockReturnValue(mockRow);

      const result = getMemoryById('cm_123', 'valid-token');

      expect(result).toBeDefined();
      expect(result.id).toBe('cm_123');
    });

    it('should return null for invalid token', () => {
      const result = getMemoryById('cm_123', 'invalid-token');

      expect(result).toBeNull();
    });

    it('should return null if memory not found', () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = getMemoryById('non_existent', 'valid-token');

      expect(result).toBeNull();
    });
  });

  // ====================
  // Update Memory
  // ====================

  describe('updateConsolidatedMemory', () => {
    it('should update allowed fields', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = updateConsolidatedMemory(
        'cm_123',
        { summary: 'Updated summary', masteryAssessment: 'proficient' },
        'valid-token'
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(1);
    });

    it('should reject invalid token', () => {
      const result = updateConsolidatedMemory(
        'cm_123',
        { summary: 'Updated' },
        'invalid-token'
      );

      expect(result.error).toBe('Invalid token');
    });

    it('should return error if no valid fields to update', () => {
      const result = updateConsolidatedMemory(
        'cm_123',
        { invalidField: 'value' },
        'valid-token'
      );

      expect(result.error).toBe('No valid fields to update');
    });

    it('should stringify object updates', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      updateConsolidatedMemory(
        'cm_123',
        { insights: ['new insight'] },
        'valid-token'
      );

      expect(mockStmt.run).toHaveBeenCalledWith(
        expect.stringContaining('['),
        expect.anything(),
        expect.anything()
      );
    });
  });

  // ====================
  // Delete Memory
  // ====================

  describe('deleteConsolidatedMemory', () => {
    it('should delete memory for valid token', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = deleteConsolidatedMemory('cm_123', 'valid-token');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(1);
    });

    it('should reject invalid token', () => {
      const result = deleteConsolidatedMemory('cm_123', 'invalid-token');

      expect(result.error).toBe('Invalid token');
    });

    it('should return 0 if memory not found', () => {
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = deleteConsolidatedMemory('non_existent', 'valid-token');

      expect(result.deleted).toBe(0);
    });
  });

  // ====================
  // Delete Old Memories
  // ====================

  describe('deleteOldMemories', () => {
    it('should delete memories older than specified days', () => {
      mockStmt.run.mockReturnValue({ changes: 5 });

      const result = deleteOldMemories(30, 'valid-token');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(5);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND created_at < ?')
      );
    });

    it('should reject invalid token', () => {
      const result = deleteOldMemories(30, 'invalid-token');

      expect(result.error).toBe('Invalid token');
    });
  });

  // ====================
  // Clear Expired Memories
  // ====================

  describe('clearExpiredMemories', () => {
    it('should delete expired memories', () => {
      mockStmt.run.mockReturnValue({ changes: 3 });

      const result = clearExpiredMemories();

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(3);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE expires_at IS NOT NULL AND expires_at < ?')
      );
    });
  });

  // ====================
  // Get Statistics
  // ====================

  describe('getConsolidationStats', () => {
    it('should return consolidation statistics', () => {
      // Mock type stats
      mockStmt.all
        .mockReturnValueOnce([
          { memory_type: 'concept_session', count: 10, total_episodes: 50 },
          { memory_type: 'daily', count: 5, total_episodes: 25 },
        ])
        .mockReturnValueOnce([
          { mastery_assessment: 'developing', count: 8 },
          { mastery_assessment: 'proficient', count: 7 },
        ]);

      mockStmt.get
        .mockReturnValueOnce({ unique_concepts: 15 })
        .mockReturnValueOnce({ count: 3 });

      const stats = getConsolidationStats('valid-token');

      expect(stats.totalMemories).toBe(15);
      expect(stats.totalEpisodesConsolidated).toBe(75);
      expect(stats.uniqueConcepts).toBe(15);
      expect(stats.recentConsolidations).toBe(3);
      expect(stats.byType.concept_session.count).toBe(10);
      expect(stats.masteryDistribution.developing).toBe(8);
    });

    it('should return error for invalid token', () => {
      const result = getConsolidationStats('invalid-token');

      expect(result.error).toBe('Invalid token');
    });
  });

  // ====================
  // Get Memories For Concept
  // ====================

  describe('getMemoriesForConcept', () => {
    it('should call getConsolidatedMemories with conceptId filter', () => {
      mockStmt.all.mockReturnValue([]);

      getMemoriesForConcept('concept_123', 'valid-token', 10);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND concept_id = ?')
      );
    });
  });

  // ====================
  // Search Memories
  // ====================

  describe('searchMemories', () => {
    it('should search by summary, concept_name, and insights', () => {
      mockStmt.all.mockReturnValue([]);

      searchMemories('vocabulary', 'valid-token', 20);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('summary LIKE ?')
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('concept_name LIKE ?')
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('insights LIKE ?')
      );
    });

    it('should return empty array for invalid token', () => {
      const result = searchMemories('test', 'invalid-token');

      expect(result).toEqual([]);
    });
  });
});
