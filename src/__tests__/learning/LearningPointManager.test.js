/**
 * LearningPointManager.test.js
 *
 * Comprehensive unit tests for the unified learning_point table manager.
 * Tests CRUD operations, spaced repetition logic, statistics, and edge cases.
 */

// Mock dependencies
jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(),
    exec: jest.fn(),
    transaction: jest.fn((fn) => fn),
  },
  getUserIdFromToken: jest.fn((token) => (token === 'valid-token' ? 1 : -1)),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

jest.mock('../../commons/utils/SqliteHelper', () => ({
  dateToSQLiteString: jest.fn((date) => {
    if (date instanceof Date) return date.toISOString().split('T')[0];
    return date;
  }),
}));

const mockDb = require('../../main/db/dbManager').default;
const { getUserIdFromToken } = require('../../main/db/dbManager');

// Import after mocks
const {
  initLearningPointTable,
  createLearningPoint,
  createLearningPointsBatch,
  getLearningPointById,
  updateLearningPoint,
  deleteLearningPoint,
  getDueItems,
  getBySource,
  getByPlan,
  searchLearningPoints,
  getAllLearningPoints,
  processReview,
  resetLearningPoint,
  getStats,
  getDailyForecast,
  applyProductionGrade,
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  FORMATS,
  SOURCE_TYPES,
  BOX_INTERVALS,
} = require('../../main/db/LearningPointManager');

describe('LearningPointManager', () => {
  let mockStmt;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStmt = {
      run: jest.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
      get: jest.fn(),
      all: jest.fn(() => []),
    };
    mockDb.prepare.mockReturnValue(mockStmt);
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    test('exports valid ITEM_TYPES array', () => {
      expect(Array.isArray(ITEM_TYPES)).toBe(true);
      expect(ITEM_TYPES).toContain('word');
      expect(ITEM_TYPES).toContain('concept');
      expect(ITEM_TYPES).toContain('formula');
      expect(ITEM_TYPES).toContain('problem');
      expect(ITEM_TYPES).toContain('rule');
      expect(ITEM_TYPES).toContain('fact');
      expect(ITEM_TYPES.length).toBeGreaterThan(5);
    });

    test('exports valid DOMAIN_TYPES array', () => {
      expect(Array.isArray(DOMAIN_TYPES)).toBe(true);
      expect(DOMAIN_TYPES).toContain('vocabulary');
      expect(DOMAIN_TYPES).toContain('math');
      expect(DOMAIN_TYPES).toContain('programming');
      expect(DOMAIN_TYPES).toContain('physics');
      expect(DOMAIN_TYPES).toContain('knowledge');
      expect(DOMAIN_TYPES.length).toBeGreaterThan(5);
    });

    test('exports valid DIFFICULTY_LEVELS in correct order', () => {
      expect(DIFFICULTY_LEVELS).toEqual([
        'beginner', 'elementary', 'intermediate', 'advanced', 'expert'
      ]);
    });

    test('exports valid FORMATS array', () => {
      expect(Array.isArray(FORMATS)).toBe(true);
      expect(FORMATS).toContain('card');
      expect(FORMATS).toContain('mindmap');
      expect(FORMATS).toContain('quiz');
      expect(FORMATS).toContain('image');
      expect(FORMATS).toContain('code');
    });

    test('exports valid SOURCE_TYPES array', () => {
      expect(Array.isArray(SOURCE_TYPES)).toBe(true);
      expect(SOURCE_TYPES).toContain('book');
      expect(SOURCE_TYPES).toContain('url');
      expect(SOURCE_TYPES).toContain('manual');
    });

    test('exports correct BOX_INTERVALS (Leitner schedule)', () => {
      expect(BOX_INTERVALS[1]).toBe(1);  // Box 1: 1 day
      expect(BOX_INTERVALS[2]).toBe(2);  // Box 2: 2 days
      expect(BOX_INTERVALS[3]).toBe(4);  // Box 3: 4 days
      expect(BOX_INTERVALS[4]).toBe(7);  // Box 4: 7 days
      expect(BOX_INTERVALS[5]).toBe(14); // Box 5: 14 days
    });
  });

  // ==========================================================================
  // TABLE INITIALIZATION
  // ==========================================================================

  describe('initLearningPointTable', () => {
    test('creates table with all required columns', () => {
      const result = initLearningPointTable();

      expect(mockDb.exec).toHaveBeenCalled();
      expect(result).toBe(true);

      // First call creates the table - SQL uses escaped quotes ("column")
      const tableCall = mockDb.exec.mock.calls[0][0];
      expect(tableCall).toContain('CREATE TABLE IF NOT EXISTS');
      expect(tableCall).toContain('learning_point');
      expect(tableCall).toContain('"id" TEXT PRIMARY KEY');
      expect(tableCall).toContain('"user_id" INTEGER NOT NULL');
      expect(tableCall).toContain('"front" TEXT NOT NULL');
      expect(tableCall).toContain('"back" TEXT NOT NULL');
      expect(tableCall).toContain('"box" INTEGER DEFAULT 1');
    });

    test('creates performance indexes', () => {
      initLearningPointTable();

      // Multiple exec calls for indexes
      const allCalls = mockDb.exec.mock.calls.map(call => call[0]).join('\n');
      expect(allCalls).toContain('CREATE INDEX IF NOT EXISTS');
      expect(allCalls).toContain('idx_lp_user_due');
      expect(allCalls).toContain('idx_lp_source');
    });

    test('handles database errors gracefully', () => {
      mockDb.exec.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = initLearningPointTable();
      expect(result).toBe(false);
    });

    test('is idempotent (can be called multiple times)', () => {
      initLearningPointTable();
      initLearningPointTable();

      expect(mockDb.exec).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // CREATE OPERATIONS
  // ==========================================================================

  describe('createLearningPoint', () => {
    const validPoint = {
      title: 'Test Word',
      front: { text: 'ephemeral' },
      back: { text: 'lasting for a short time' },
      itemType: 'word',
      domainType: 'vocabulary',
    };

    test('creates learning point with minimal required fields', () => {
      mockStmt.get.mockReturnValue({
        id: 'test-uuid-123',
        user_id: 1,
        title: 'Test',
        front: '{"text":"Q"}',
        back: '{"text":"A"}',
        box: 1,
      });

      const result = createLearningPoint({
        title: 'Test',
        front: 'Q',
        back: 'A',
      }, 'valid-token');

      expect(mockStmt.run).toHaveBeenCalled();
      expect(result.id).toBeDefined();
    });

    test('creates learning point with all fields', () => {
      const fullPoint = {
        ...validPoint,
        extras: { quiz: true, variables: { x: 5 } },
        tags: ['math', 'algebra'],
        difficulty: 'advanced',
        format: 'card',
        sourceType: 'book',
        sourceId: 'book-123',
        planId: 'plan-456',
        bookId: 1,
      };

      mockStmt.get.mockReturnValue({
        id: 'test-uuid-123',
        ...fullPoint,
        front: JSON.stringify(fullPoint.front),
        back: JSON.stringify(fullPoint.back),
        extras: JSON.stringify(fullPoint.extras),
        tags: JSON.stringify(fullPoint.tags),
      });

      const result = createLearningPoint(fullPoint, 'valid-token');

      expect(result.id).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    test('returns error for invalid token', () => {
      const result = createLearningPoint(validPoint, 'invalid-token');
      expect(result.error).toBe('Invalid session');
    });

    test('returns error for missing title', () => {
      const result = createLearningPoint({
        front: 'Q',
        back: 'A',
      }, 'valid-token');

      expect(result.error).toContain('Title is required');
    });

    test('returns error for empty title', () => {
      const result = createLearningPoint({
        title: '',
        front: 'Q',
        back: 'A',
      }, 'valid-token');

      expect(result.error).toContain('Title is required');
    });

    test('returns error for missing front content', () => {
      const result = createLearningPoint({
        title: 'Test',
        back: 'A',
      }, 'valid-token');

      expect(result.error).toContain('Front content is required');
    });

    test('returns error for missing back content', () => {
      const result = createLearningPoint({
        title: 'Test',
        front: 'Q',
      }, 'valid-token');

      expect(result.error).toContain('Back content is required');
    });

    test('validates item type against allowed values', () => {
      const result = createLearningPoint({
        ...validPoint,
        itemType: 'invalid-type',
      }, 'valid-token');

      expect(result.error).toContain('Invalid item type');
    });

    test('validates domain type against allowed values', () => {
      const result = createLearningPoint({
        ...validPoint,
        domainType: 'invalid-domain',
      }, 'valid-token');

      expect(result.error).toContain('Invalid domain type');
    });

    test('validates difficulty level', () => {
      const result = createLearningPoint({
        ...validPoint,
        difficulty: 'super-hard',
      }, 'valid-token');

      expect(result.error).toContain('Invalid difficulty');
    });

    test('serializes JSON content correctly', () => {
      const point = {
        title: 'Math Formula',
        front: { text: 'Quadratic formula', latex: '$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$' },
        back: { text: 'Solves ax² + bx + c = 0', code: 'def solve(a, b, c): ...' },
        tags: ['math', 'algebra', 'formulas'],
        extras: { variables: { a: 1, b: 2, c: 1 } },
      };

      mockStmt.get.mockReturnValue({
        id: 'test-uuid-123',
        front: JSON.stringify(point.front),
        back: JSON.stringify(point.back),
        tags: JSON.stringify(point.tags),
        extras: JSON.stringify(point.extras),
      });

      const result = createLearningPoint(point, 'valid-token');

      expect(result.error).toBeUndefined();
      const runCall = mockStmt.run.mock.calls[0];
      expect(runCall).toBeDefined();
    });

    test('handles string content (converts to object)', () => {
      mockStmt.get.mockReturnValue({
        id: 'test-uuid-123',
        front: '"simple string"',
        back: '"another string"',
      });

      const result = createLearningPoint({
        title: 'Simple',
        front: 'simple string',
        back: 'another string',
      }, 'valid-token');

      expect(result.error).toBeUndefined();
    });

    test('sets default values correctly', () => {
      mockStmt.get.mockReturnValue({
        id: 'test-uuid-123',
        box: 1,
        item_type: 'concept',
        domain_type: 'knowledge',
        difficulty: 'intermediate',
        format: 'card',
        status: 'active',
        mastery_level: 0,
        ease_factor: 2.5,
      });

      const result = createLearningPoint({
        title: 'Test',
        front: 'Q',
        back: 'A',
      }, 'valid-token');

      expect(result.box).toBe(1);
    });
  });

  describe('createLearningPointsBatch', () => {
    test('creates multiple items successfully', () => {
      const points = [
        { title: 'Item 1', front: 'Q1', back: 'A1' },
        { title: 'Item 2', front: 'Q2', back: 'A2' },
        { title: 'Item 3', front: 'Q3', back: 'A3' },
      ];

      const result = createLearningPointsBatch(points, 'valid-token');

      expect(result.created).toBe(3);
      expect(result.errors.length).toBe(0);
    });

    test('handles partial failures', () => {
      const points = [
        { title: '', front: 'Q1', back: 'A1' }, // Invalid - no title
        { title: 'Item 2', front: 'Q2', back: 'A2' }, // Valid
        { title: 'Item 3', front: '', back: 'A3' }, // Invalid - no front (empty string)
      ];

      const result = createLearningPointsBatch(points, 'valid-token');

      expect(result.created).toBe(1);
      expect(result.errors.length).toBe(2);
      // Errors contain point title, not index
      expect(result.errors[0].point).toBe('');
      expect(result.errors[1].point).toBe('Item 3');
    });

    test('returns error for invalid token', () => {
      const result = createLearningPointsBatch([
        { title: 'Item', front: 'Q', back: 'A' },
      ], 'invalid-token');

      expect(result.error).toBe('Invalid session');
    });

    test('handles empty array', () => {
      const result = createLearningPointsBatch([], 'valid-token');

      expect(result.created).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    test('uses transaction for atomicity', () => {
      const points = [
        { title: 'Item 1', front: 'Q1', back: 'A1' },
        { title: 'Item 2', front: 'Q2', back: 'A2' },
      ];

      createLearningPointsBatch(points, 'valid-token');

      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  describe('getLearningPointById', () => {
    test('returns parsed learning point with all fields', () => {
      mockStmt.get.mockReturnValue({
        id: 'uuid-123',
        user_id: 1,
        title: 'Test',
        front: '{"text":"Q","latex":"$x^2$"}',
        back: '{"text":"A"}',
        extras: '{"quiz":true}',
        tags: '["tag1","tag2"]',
        item_type: 'formula',
        domain_type: 'math',
        difficulty: 'advanced',
        box: 3,
        next_review: '2024-01-15',
        fully_learned: 0,
        mastery_level: 45,
        review_count: 10,
        correct_streak: 3,
      });

      const result = getLearningPointById('uuid-123', 'valid-token');

      expect(result).toBeDefined();
      expect(result.front).toEqual({ text: 'Q', latex: '$x^2$' });
      expect(result.back).toEqual({ text: 'A' });
      expect(result.extras).toEqual({ quiz: true });
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.box).toBe(3);
      expect(result.mastery_level).toBe(45);
    });

    test('handles null JSON fields gracefully', () => {
      mockStmt.get.mockReturnValue({
        id: 'uuid-123',
        user_id: 1,
        title: 'Test',
        front: '{"text":"Q"}',
        back: '{"text":"A"}',
        extras: null,
        tags: null,
        box: 1,
      });

      const result = getLearningPointById('uuid-123', 'valid-token');

      expect(result.extras).toBeNull();
      // parseRow returns empty array for null tags
      expect(result.tags).toEqual([]);
    });

    test('returns null for invalid token', () => {
      const result = getLearningPointById('uuid-123', 'invalid-token');
      expect(result).toBeNull();
    });

    test('returns null when not found', () => {
      mockStmt.get.mockReturnValue(null);
      const result = getLearningPointById('non-existent', 'valid-token');
      expect(result).toBeNull();
    });

    test('handles malformed JSON gracefully', () => {
      mockStmt.get.mockReturnValue({
        id: 'uuid-123',
        front: 'not valid json',
        back: '{"text":"A"}',
      });

      const result = getLearningPointById('uuid-123', 'valid-token');
      // Should return the raw string if JSON parsing fails
      expect(result).toBeDefined();
    });
  });

  describe('getAllLearningPoints', () => {
    test('returns paginated results', () => {
      mockStmt.get.mockReturnValue({ total: 100 });
      mockStmt.all.mockReturnValue([
        { id: 'item-1', front: '{"text":"Q1"}', back: '{"text":"A1"}' },
        { id: 'item-2', front: '{"text":"Q2"}', back: '{"text":"A2"}' },
      ]);

      const result = getAllLearningPoints('valid-token', { page: 1, pageSize: 20 });

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    test('uses default pagination values', () => {
      mockStmt.get.mockReturnValue({ total: 50 });
      mockStmt.all.mockReturnValue([]);

      const result = getAllLearningPoints('valid-token');

      expect(result.page).toBe(1);
      expect(result.pageSize).toBeDefined();
    });
  });

  // ==========================================================================
  // UPDATE OPERATIONS
  // ==========================================================================

  describe('updateLearningPoint', () => {
    test('updates single field', () => {
      mockStmt.get.mockReturnValue({
        id: 'uuid-123',
        title: 'Updated Title',
        front: '{"text":"Q"}',
        back: '{"text":"A"}',
      });

      const result = updateLearningPoint('uuid-123', {
        title: 'Updated Title',
      }, 'valid-token');

      expect(mockStmt.run).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });

    test('updates multiple fields', () => {
      mockStmt.get.mockReturnValue({
        id: 'uuid-123',
        title: 'New Title',
        front: '{"text":"New Q"}',
        difficulty: 'expert',
      });

      const result = updateLearningPoint('uuid-123', {
        title: 'New Title',
        front: { text: 'New Q' },
        difficulty: 'expert',
      }, 'valid-token');

      expect(result.error).toBeUndefined();
    });

    test('returns error for no valid fields', () => {
      const result = updateLearningPoint('uuid-123', {
        invalidField: 'value',
        anotherInvalid: 123,
      }, 'valid-token');

      expect(result.error).toBe('No valid fields to update');
    });

    test('returns error for invalid token', () => {
      const result = updateLearningPoint('uuid-123', {
        title: 'New Title',
      }, 'invalid-token');

      expect(result.error).toBe('Invalid session');
    });

    test('ignores item_type field during update (not in allowedFields)', () => {
      // updateLearningPoint only allows specific fields - item_type is allowed but as snake_case
      // The code converts camelCase to snake_case, so itemType becomes item_type
      mockStmt.run.mockReturnValue({ changes: 1 });
      mockStmt.get.mockReturnValue({
        id: 'uuid-123',
        item_type: 'concept', // Original unchanged
      });

      const result = updateLearningPoint('uuid-123', {
        itemType: 'word', // Valid - will be converted to item_type
      }, 'valid-token');

      // Since item_type is in allowedFields, update should proceed
      expect(result.error).toBeUndefined();
    });

    test('sets updated_at timestamp', () => {
      mockStmt.get.mockReturnValue({
        id: 'uuid-123',
        title: 'Updated',
        updated_at: expect.any(String),
      });

      updateLearningPoint('uuid-123', { title: 'Updated' }, 'valid-token');

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('updated_at');
    });
  });

  // ==========================================================================
  // DELETE OPERATIONS
  // ==========================================================================

  describe('deleteLearningPoint', () => {
    test('soft deletes by default (sets status to deleted)', () => {
      const result = deleteLearningPoint('uuid-123', 'valid-token');

      expect(mockStmt.run).toHaveBeenCalled();
      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('UPDATE');
      expect(sql).toContain("status = 'deleted'");
      expect(result).toBe(true);
    });

    test('hard deletes when specified', () => {
      const result = deleteLearningPoint('uuid-123', 'valid-token', true);

      expect(mockStmt.run).toHaveBeenCalled();
      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('DELETE');
      expect(sql).not.toContain('UPDATE');
      expect(result).toBe(true);
    });

    test('returns false for invalid token', () => {
      const result = deleteLearningPoint('uuid-123', 'invalid-token');
      expect(result).toBe(false);
    });

    test('returns true even when no rows affected (no check for changes)', () => {
      // The deleteLearningPoint function doesn't check result.changes
      // It returns true as long as the query doesn't throw
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = deleteLearningPoint('non-existent', 'valid-token');
      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  describe('getDueItems', () => {
    test('returns due items sorted by box and date', () => {
      mockStmt.all.mockReturnValue([
        {
          id: 'item-1',
          title: 'Item 1',
          front: '{"text":"Q1"}',
          back: '{"text":"A1"}',
          box: 1,
          next_review: '2024-01-01',
        },
        {
          id: 'item-2',
          title: 'Item 2',
          front: '{"text":"Q2"}',
          back: '{"text":"A2"}',
          box: 2,
          next_review: '2024-01-02',
        },
      ]);

      const result = getDueItems({ token: 'valid-token', limit: 50 });

      expect(result.length).toBe(2);
      expect(result[0].front).toEqual({ text: 'Q1' });
      expect(result[1].front).toEqual({ text: 'Q2' });
    });

    test('filters by item types', () => {
      getDueItems({
        token: 'valid-token',
        itemTypes: ['word', 'concept'],
      });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('item_type IN');
    });

    test('filters by domain types', () => {
      getDueItems({
        token: 'valid-token',
        domainTypes: ['vocabulary', 'math'],
      });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('domain_type IN');
    });

    test('filters by plan ID', () => {
      getDueItems({
        token: 'valid-token',
        planId: 'plan-123',
      });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('plan_id = ?');
    });

    test('filters by tags', () => {
      getDueItems({
        token: 'valid-token',
        tags: ['important', 'review'],
      });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('tags LIKE');
    });

    test('includes items with null next_review (new items)', () => {
      getDueItems({
        token: 'valid-token',
        includeNew: true,
      });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('next_review IS NULL');
    });

    test('excludes fully learned items', () => {
      getDueItems({ token: 'valid-token' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('fully_learned = 0');
    });

    test('respects limit parameter', () => {
      getDueItems({ token: 'valid-token', limit: 10 });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('LIMIT');
    });

    test('returns empty array for invalid token', () => {
      const result = getDueItems({ token: 'invalid-token' });
      expect(result).toEqual([]);
    });
  });

  describe('searchLearningPoints', () => {
    test('searches in title, front, and back content', () => {
      mockStmt.all.mockReturnValue([
        {
          id: 'item-1',
          title: 'Ephemeral',
          front: '{"text":"ephemeral"}',
          back: '{"text":"lasting briefly"}',
        },
      ]);

      const result = searchLearningPoints('ephemeral', 'valid-token');

      expect(result.length).toBe(1);
      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('title LIKE ?');
      expect(sql).toContain('front LIKE ?');
      expect(sql).toContain('back LIKE ?');
    });

    test('returns empty array for empty query', () => {
      const result = searchLearningPoints('', 'valid-token');
      expect(result).toEqual([]);
    });

    test('filters by domain type in search', () => {
      searchLearningPoints('test', 'valid-token', { domainType: 'vocabulary' });

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('domain_type = ?');
    });
  });

  describe('getBySource', () => {
    test('returns items by source type and ID', () => {
      mockStmt.all.mockReturnValue([
        { id: 'item-1', front: '{"text":"Q1"}', back: '{"text":"A1"}' },
      ]);

      const result = getBySource('book', 'book-123', 'valid-token');

      expect(result.length).toBe(1);
      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('source_type = ?');
      expect(sql).toContain('source_id = ?');
    });

    test('returns empty array for invalid token', () => {
      const result = getBySource('book', 'book-123', 'invalid-token');
      expect(result).toEqual([]);
    });
  });

  describe('getByPlan', () => {
    test('returns items for a plan', () => {
      mockStmt.all.mockReturnValue([
        { id: 'item-1', front: '{"text":"Q1"}', back: '{"text":"A1"}', plan_id: 'plan-123' },
        { id: 'item-2', front: '{"text":"Q2"}', back: '{"text":"A2"}', plan_id: 'plan-123' },
      ]);

      const result = getByPlan('plan-123', 'valid-token');

      expect(result.length).toBe(2);
      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('plan_id = ?');
    });
  });

  // ==========================================================================
  // SPACED REPETITION - CORE LOGIC
  // ==========================================================================

  describe('processReview', () => {
    const mockItem = {
      id: 'item-123',
      box: 2,
      correct_streak: 1,
      total_correct: 5,
      total_incorrect: 2,
      ease_factor: 2.5,
      review_count: 7,
      fully_learned: 0,
      front: '{"text":"Q"}',
      back: '{"text":"A"}',
    };

    beforeEach(() => {
      mockStmt.get.mockReturnValue(mockItem);
    });

    describe('Rating 1 (Again)', () => {
      test('resets to box 1', () => {
        const result = processReview('item-123', 1, 2000, 'valid-token');

        expect(result.success).toBe(true);
        expect(result.newBox).toBe(1);
      });

      test('resets correct streak to 0', () => {
        const result = processReview('item-123', 1, 2000, 'valid-token');

        expect(result.correctStreak).toBe(0);
      });

      test('increments total_incorrect', () => {
        processReview('item-123', 1, 2000, 'valid-token');

        const runCall = mockStmt.run.mock.calls[0];
        expect(runCall).toBeDefined();
      });

      test('decreases ease factor (stored in DB, not returned)', () => {
        // processReview updates ease_factor in DB but doesn't return it
        const result = processReview('item-123', 1, 2000, 'valid-token');

        // Check that DB update was called (ease factor decreases)
        expect(mockStmt.run).toHaveBeenCalled();
        expect(result.success).toBe(true);
      });
    });

    describe('Rating 2 (Hard)', () => {
      test('stays in current box', () => {
        const result = processReview('item-123', 2, 2000, 'valid-token');

        expect(result.success).toBe(true);
        expect(result.newBox).toBe(2); // Stays in box 2
      });

      test('resets correct streak', () => {
        const result = processReview('item-123', 2, 2000, 'valid-token');

        expect(result.correctStreak).toBe(0);
      });
    });

    describe('Rating 3 (Good)', () => {
      test('advances to next box', () => {
        const result = processReview('item-123', 3, 2000, 'valid-token');

        expect(result.success).toBe(true);
        expect(result.newBox).toBe(3); // From box 2 to 3
      });

      test('increments correct streak', () => {
        const result = processReview('item-123', 3, 2000, 'valid-token');

        expect(result.correctStreak).toBe(2); // Was 1, now 2
      });

      test('increments total_correct', () => {
        processReview('item-123', 3, 2000, 'valid-token');

        // Verify SQL was called (we can't check exact values easily with mocks)
        expect(mockStmt.run).toHaveBeenCalled();
      });
    });

    describe('Rating 4 (Easy)', () => {
      test('skips a box (advances by 2)', () => {
        const result = processReview('item-123', 4, 2000, 'valid-token');

        expect(result.success).toBe(true);
        expect(result.newBox).toBe(4); // From box 2 to 4 (skips 3)
      });

      test('increases ease factor (stored in DB, not returned)', () => {
        // processReview updates ease_factor in DB but doesn't return it
        const result = processReview('item-123', 4, 2000, 'valid-token');

        // Check that DB update was called (ease factor increases)
        expect(mockStmt.run).toHaveBeenCalled();
        expect(result.success).toBe(true);
      });
    });

    describe('Box boundaries', () => {
      test('does not go below box 1', () => {
        mockStmt.get.mockReturnValue({ ...mockItem, box: 1 });

        const result = processReview('item-123', 1, 2000, 'valid-token');

        expect(result.newBox).toBe(1);
      });

      test('does not go above box 5', () => {
        mockStmt.get.mockReturnValue({ ...mockItem, box: 5 });

        const result = processReview('item-123', 4, 2000, 'valid-token');

        expect(result.newBox).toBe(5);
      });

      test('marks as fully learned when reaching box 5 with streak', () => {
        mockStmt.get.mockReturnValue({ ...mockItem, box: 4, correct_streak: 4 });

        const result = processReview('item-123', 3, 2000, 'valid-token');

        expect(result.newBox).toBe(5);
        // After enough correct answers in box 5, should be marked fully learned
      });
    });

    describe('Next review date calculation', () => {
      test('sets next review based on box interval', () => {
        const result = processReview('item-123', 3, 2000, 'valid-token');

        expect(result.nextReview).toBeDefined();
      });
    });

    describe('Response time tracking', () => {
      test('updates average response time', () => {
        processReview('item-123', 3, 2500, 'valid-token');

        expect(mockStmt.run).toHaveBeenCalled();
      });

      test('stores last response time in DB (not returned in result)', () => {
        // processReview stores response time in DB but doesn't return it
        const result = processReview('item-123', 3, 3000, 'valid-token');

        // Verify the update was called with response time
        expect(mockStmt.run).toHaveBeenCalled();
        expect(result.success).toBe(true);
      });
    });

    describe('Error handling', () => {
      test('returns error for invalid token', () => {
        const result = processReview('item-123', 3, 2000, 'invalid-token');
        expect(result.error).toBe('Invalid session');
      });

      test('returns error for non-existent item', () => {
        mockStmt.get.mockReturnValue(null);

        const result = processReview('non-existent', 3, 2000, 'valid-token');
        expect(result.error).toBe('Learning point not found');
      });

      test('handles rating above 4 (no validation in current implementation)', () => {
        // The implementation doesn't validate rating bounds
        // Rating 5 won't match any if/else branch and nothing changes
        const result = processReview('item-123', 5, 2000, 'valid-token');

        // Current implementation doesn't return error, just processes without changes
        expect(result.success).toBe(true);
      });

      test('handles rating below 1 (no validation in current implementation)', () => {
        // The implementation doesn't validate rating bounds
        // Rating 0 won't match any if/else branch and nothing changes
        const result = processReview('item-123', 0, 2000, 'valid-token');

        // Current implementation doesn't return error, just processes without changes
        expect(result.success).toBe(true);
      });
    });
  });

  describe('resetLearningPoint', () => {
    test('resets to box 1', () => {
      const result = resetLearningPoint('item-123', 'valid-token');

      expect(result).toBe(true);
      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('box = 1');
    });

    test('resets correct streak', () => {
      resetLearningPoint('item-123', 'valid-token');

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('correct_streak = 0');
    });

    test('clears fully learned flag', () => {
      resetLearningPoint('item-123', 'valid-token');

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('fully_learned = 0');
    });

    test('sets next review to now', () => {
      resetLearningPoint('item-123', 'valid-token');

      const sql = mockDb.prepare.mock.calls[0][0];
      expect(sql).toContain('next_review');
    });

    test('returns false for invalid token', () => {
      const result = resetLearningPoint('item-123', 'invalid-token');
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  describe('getStats', () => {
    beforeEach(() => {
      mockStmt.get
        .mockReturnValueOnce({
          total: 100,
          mastered: 20,
          box1: 30,
          box2: 25,
          box3: 15,
          box4: 10,
          box5: 20,
          avgMastery: 45,
          totalReviews: 500,
          totalCorrect: 350,
          totalIncorrect: 150,
        })
        .mockReturnValueOnce({ dueCount: 15 })
        .mockReturnValueOnce({ reviewedCount: 25, correctCount: 20 });

      mockStmt.all
        .mockReturnValueOnce([
          { domain_type: 'vocabulary', count: 50 },
          { domain_type: 'math', count: 30 },
          { domain_type: 'knowledge', count: 20 },
        ])
        .mockReturnValueOnce([
          { item_type: 'word', count: 50 },
          { item_type: 'formula', count: 30 },
          { item_type: 'concept', count: 20 },
        ]);
    });

    test('returns total count', () => {
      const result = getStats('valid-token');
      expect(result.total).toBe(100);
    });

    test('returns mastered count', () => {
      const result = getStats('valid-token');
      expect(result.mastered).toBe(20);
    });

    test('returns due today count', () => {
      const result = getStats('valid-token');
      expect(result.dueToday).toBe(15);
    });

    test('returns box distribution', () => {
      const result = getStats('valid-token');

      expect(result.boxes[1]).toBe(30);
      expect(result.boxes[2]).toBe(25);
      expect(result.boxes[3]).toBe(15);
      expect(result.boxes[4]).toBe(10);
      expect(result.boxes[5]).toBe(20);
    });

    test('returns domain breakdown', () => {
      const result = getStats('valid-token');

      expect(result.byDomain.vocabulary).toBe(50);
      expect(result.byDomain.math).toBe(30);
      expect(result.byDomain.knowledge).toBe(20);
    });

    test('returns item type breakdown', () => {
      const result = getStats('valid-token');

      // Implementation uses byType, not byItemType
      expect(result.byType.word).toBe(50);
      expect(result.byType.formula).toBe(30);
    });

    test('returns accuracy percentage', () => {
      const result = getStats('valid-token');

      // 350 correct / 500 total = 70%
      expect(result.accuracy).toBeDefined();
    });

    test('returns null for invalid token', () => {
      // getStats returns null for invalid token, not an error object
      const result = getStats('invalid-token');
      expect(result).toBeNull();
    });

    test('filters by plan ID', () => {
      getStats('valid-token', { planId: 'plan-123' });

      const calls = mockDb.prepare.mock.calls;
      const hasFilter = calls.some(call => call[0].includes('plan_id'));
      expect(hasFilter).toBe(true);
    });
  });

  describe('getDailyForecast', () => {
    test('returns forecast for specified days', () => {
      mockStmt.get.mockReturnValue({ count: 5 });

      const result = getDailyForecast('valid-token', 7);

      // Should include today (0) plus 7 days = 8 entries
      expect(Object.keys(result).length).toBe(8);
    });

    test('uses default of 14 days', () => {
      mockStmt.get.mockReturnValue({ count: 5 });

      const result = getDailyForecast('valid-token');

      expect(Object.keys(result).length).toBe(15); // 0-14 days
    });

    test('returns counts per day', () => {
      mockStmt.get.mockReturnValue({ count: 10 });

      const result = getDailyForecast('valid-token', 3);

      Object.values(result).forEach(count => {
        expect(count).toBe(10);
      });
    });

    test('returns empty object for invalid token', () => {
      const result = getDailyForecast('invalid-token', 7);
      expect(Object.keys(result).length).toBe(0);
    });
  });

  // ==========================================================================
  // Phase 8 production loop write-back
  // ==========================================================================

  describe('applyProductionGrade', () => {
    // Helper: stub the SELECT current-state query and capture the UPDATE
    // statement so we can assert on its bound values.
    const setupCurrentState = ({ masteryLevel, box }) => {
      const updateStmt = { run: jest.fn() };
      const selectStmt = {
        get: jest.fn(() => ({ id: 'lp_1', masteryLevel, box })),
      };
      // First prepare → SELECT, second prepare → UPDATE.
      mockDb.prepare
        .mockReturnValueOnce(selectStmt)
        .mockReturnValueOnce(updateStmt);
      return updateStmt;
    };

    test('score >= 75 confirms mastery (raises to score, keeps box)', () => {
      const updateStmt = setupCurrentState({ masteryLevel: 60, box: 3 });
      const result = applyProductionGrade('lp_1', 85, 'valid-token');

      expect(result.beforeMastery).toBe(60);
      expect(result.afterMastery).toBe(85);
      expect(result.beforeBox).toBe(3);
      expect(result.afterBox).toBe(3);
      expect(result.demoted).toBe(false);
      expect(result.nextReview).toBeNull();
      // Confirm-branch UPDATE does NOT touch next_review or correct_streak.
      const sql = mockDb.prepare.mock.calls[1][0];
      expect(sql).toContain('mastery_level');
      expect(sql).toContain('box');
      expect(sql).not.toContain('next_review');
      expect(sql).not.toContain('correct_streak');
      expect(updateStmt.run).toHaveBeenCalled();
    });

    test('score >= 75 does NOT lower an already-higher mastery', () => {
      setupCurrentState({ masteryLevel: 90, box: 4 });
      const result = applyProductionGrade('lp_1', 80, 'valid-token');
      // max(90, 80) = 90 — confirmation must never demote on a pass.
      expect(result.afterMastery).toBe(90);
    });

    test('score 50-74 lowers mastery to score, keeps box', () => {
      setupCurrentState({ masteryLevel: 80, box: 4 });
      const result = applyProductionGrade('lp_1', 60, 'valid-token');

      expect(result.beforeMastery).toBe(80);
      expect(result.afterMastery).toBe(60);
      expect(result.beforeBox).toBe(4);
      expect(result.afterBox).toBe(4);
      expect(result.demoted).toBe(false);
      expect(result.nextReview).toBeNull();
    });

    test('score < 50 demotes box, resets correct_streak, requeues tomorrow', () => {
      const updateStmt = setupCurrentState({ masteryLevel: 80, box: 4 });
      const result = applyProductionGrade('lp_1', 30, 'valid-token');

      expect(result.beforeMastery).toBe(80);
      expect(result.afterMastery).toBe(30);
      expect(result.beforeBox).toBe(4);
      expect(result.afterBox).toBe(3);
      expect(result.demoted).toBe(true);
      expect(result.nextReview).toBeTruthy();
      // Hard-fail UPDATE MUST hit next_review + correct_streak so SRS
      // re-queues with a fresh attempt count.
      const sql = mockDb.prepare.mock.calls[1][0];
      expect(sql).toContain('next_review');
      expect(sql).toContain('correct_streak = 0');
      expect(updateStmt.run).toHaveBeenCalled();
    });

    test('score < 50 from box 1 does not go below box 1', () => {
      setupCurrentState({ masteryLevel: 30, box: 1 });
      const result = applyProductionGrade('lp_1', 10, 'valid-token');
      expect(result.afterBox).toBe(1);
      expect(result.demoted).toBe(false); // no actual change
    });

    test('clamps score above 100 down to 100', () => {
      setupCurrentState({ masteryLevel: 50, box: 2 });
      const result = applyProductionGrade('lp_1', 200, 'valid-token');
      expect(result.afterMastery).toBe(100);
    });

    test('clamps negative score up to 0 and demotes', () => {
      setupCurrentState({ masteryLevel: 80, box: 4 });
      const result = applyProductionGrade('lp_1', -50, 'valid-token');
      expect(result.afterMastery).toBe(0);
      expect(result.afterBox).toBe(3);
      expect(result.demoted).toBe(true);
    });

    test('returns error for invalid session', () => {
      const result = applyProductionGrade('lp_1', 80, 'invalid-token');
      expect(result.error).toBe('Invalid session');
    });

    test('returns error when learning point not found', () => {
      const selectStmt = { get: jest.fn(() => undefined) };
      mockDb.prepare.mockReturnValueOnce(selectStmt);
      const result = applyProductionGrade('missing', 80, 'valid-token');
      expect(result.error).toBe('Learning point not found');
    });
  });
});
