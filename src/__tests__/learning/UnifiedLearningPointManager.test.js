/**
 * UnifiedLearningPointManager.test.js
 *
 * Unit tests for the unified query interface.
 * Tests the wrapper functions that normalize learning points for the UI.
 *
 * Note: Since the migration to Neo4j, UnifiedLearningPointManager now uses
 * LearningPointService which abstracts over GraphInterface (Neo4j).
 */

// Mock LearningPointService (the new backend after Neo4j migration)
jest.mock('../../main/utils/LearningPointService', () => ({
  __esModule: true,
  default: {
    getDueForReview: jest.fn(),
    processReview: jest.fn(),
    getStats: jest.fn(),
    getLearningPointById: jest.fn(),
    createLearningPoint: jest.fn(),
    createLearningPointsBatch: jest.fn(),
    updateLearningPoint: jest.fn(),
    deleteLearningPoint: jest.fn(),
    search: jest.fn(),
    getBySource: jest.fn(),
    getByPlan: jest.fn(),
    getAll: jest.fn(),
    reset: jest.fn(),
    getForecast: jest.fn(),
    isAvailable: jest.fn(() => true),
  },
  ITEM_TYPES: ['word', 'concept', 'formula'],
  DOMAIN_TYPES: ['vocabulary', 'math', 'knowledge'],
  DIFFICULTY_LEVELS: ['beginner', 'intermediate', 'advanced'],
  SOURCE_TYPES: ['book', 'url', 'chat', 'plan', 'manual'],
  RATINGS: { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 },
  BOX_INTERVALS: { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 },
}));

const mockLPService = require('../../main/utils/LearningPointService').default;

const {
  getDueItems,
  processReview,
  getStats,
  getItemById,
  createItem,
  createItemsBatch,
  updateItem,
  deleteItem,
  search,
  getItemsBySource,
  getItemsByPlan,
  getAllItems,
  resetItem,
  getForecast,
  normalizeItem,
  boxToMastery,
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  FORMATS,
  BOX_INTERVALS,
} = require('../../main/db/UnifiedLearningPointManager');

describe('UnifiedLearningPointManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  describe('boxToMastery', () => {
    test('converts box 1 to 10% mastery', () => {
      expect(boxToMastery(1)).toBe(10);
    });

    test('converts box 2 to 30% mastery', () => {
      expect(boxToMastery(2)).toBe(30);
    });

    test('converts box 3 to 50% mastery', () => {
      expect(boxToMastery(3)).toBe(50);
    });

    test('converts box 4 to 70% mastery', () => {
      expect(boxToMastery(4)).toBe(70);
    });

    test('converts box 5 to 90% mastery', () => {
      expect(boxToMastery(5)).toBe(90);
    });

    test('handles null/undefined box', () => {
      expect(boxToMastery(null)).toBe(0);
      expect(boxToMastery(undefined)).toBe(0);
    });

    test('handles box less than 1', () => {
      expect(boxToMastery(0)).toBe(0);
      expect(boxToMastery(-1)).toBe(0);
    });

    test('caps at 100%', () => {
      expect(boxToMastery(6)).toBe(100);
      expect(boxToMastery(10)).toBe(100);
    });
  });

  describe('normalizeItem', () => {
    test('converts snake_case to camelCase', () => {
      const dbRow = {
        id: 'test-id',
        source_type: 'book',
        source_id: 'book-123',
        item_type: 'word',
        domain_type: 'vocabulary',
        next_review: '2024-01-15',
        mastery_level: 50,
        last_reviewed_at: '2024-01-10',
        review_count: 5,
        correct_streak: 3,
        total_correct: 10,
        total_incorrect: 2,
        fully_learned: 0,
        ease_factor: 2.5,
        interval_days: 4,
        avg_response_time_ms: 2500,
        last_response_time_ms: 2000,
        created_at: '2024-01-01',
        updated_at: '2024-01-10',
        front: { text: 'Q' },
        back: { text: 'A' },
        box: 3,
      };

      const result = normalizeItem(dbRow);

      expect(result.sourceType).toBe('book');
      expect(result.sourceId).toBe('book-123');
      expect(result.itemType).toBe('word');
      expect(result.domainType).toBe('vocabulary');
      expect(result.nextReview).toBe('2024-01-15');
      expect(result.masteryLevel).toBe(50);
      expect(result.lastReviewedAt).toBe('2024-01-10');
      expect(result.reviewCount).toBe(5);
      expect(result.correctStreak).toBe(3);
      expect(result.totalCorrect).toBe(10);
      expect(result.totalIncorrect).toBe(2);
      expect(result.fullyLearned).toBe(0);
      expect(result.easeFactor).toBe(2.5);
      expect(result.intervalDays).toBe(4);
      expect(result.avgResponseTimeMs).toBe(2500);
      expect(result.lastResponseTimeMs).toBe(2000);
      expect(result.createdAt).toBe('2024-01-01');
      expect(result.updatedAt).toBe('2024-01-10');
    });

    test('calculates mastery from box if mastery_level is null', () => {
      const dbRow = {
        id: 'test-id',
        box: 3,
        mastery_level: null,
      };

      const result = normalizeItem(dbRow);

      expect(result.masteryLevel).toBe(50); // Box 3 = 50%
    });

    test('returns null for null input', () => {
      expect(normalizeItem(null)).toBeNull();
    });

    test('preserves original fields', () => {
      const dbRow = {
        id: 'test-id',
        title: 'Test Title',
        front: { text: 'Q' },
        back: { text: 'A' },
        tags: ['tag1', 'tag2'],
        box: 2,
      };

      const result = normalizeItem(dbRow);

      expect(result.id).toBe('test-id');
      expect(result.title).toBe('Test Title');
      expect(result.front).toEqual({ text: 'Q' });
      expect(result.back).toEqual({ text: 'A' });
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.box).toBe(2);
    });
  });

  // ==========================================================================
  // CONSTANTS RE-EXPORT
  // ==========================================================================

  describe('Constants re-export', () => {
    test('re-exports ITEM_TYPES', () => {
      expect(ITEM_TYPES).toEqual(['word', 'concept', 'formula']);
    });

    test('re-exports DOMAIN_TYPES', () => {
      expect(DOMAIN_TYPES).toEqual(['vocabulary', 'math', 'knowledge']);
    });

    test('re-exports DIFFICULTY_LEVELS', () => {
      expect(DIFFICULTY_LEVELS).toEqual(['beginner', 'intermediate', 'advanced']);
    });

    test('re-exports FORMATS', () => {
      expect(FORMATS).toEqual(['card', 'mindmap', 'quiz', 'image', 'code']);
    });

    test('re-exports BOX_INTERVALS', () => {
      expect(BOX_INTERVALS).toEqual({ 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 });
    });
  });

  // ==========================================================================
  // getDueItems
  // ==========================================================================

  describe('getDueItems (getDueItemsUnified)', () => {
    test('calls underlying getDueItems with options', async () => {
      mockLPService.getDueForReview.mockResolvedValue([
        { id: '1', box: 1, mastery_level: 10, front: { text: 'Q1' }, back: { text: 'A1' } },
        { id: '2', box: 2, mastery_level: 30, front: { text: 'Q2' }, back: { text: 'A2' } },
      ]);

      const result = await getDueItems({
        token: 'valid-token',
        limit: 20,
        itemTypes: ['word'],
        domainTypes: ['vocabulary'],
      });

      expect(mockLPService.getDueForReview).toHaveBeenCalledWith(expect.objectContaining({
        token: 'valid-token',
        limit: 20,
        itemTypes: ['word'],
        domainTypes: ['vocabulary'],
      }));

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    test('normalizes returned items', async () => {
      mockLPService.getDueForReview.mockResolvedValue([
        {
          id: '1',
          source_type: 'book',
          item_type: 'word',
          domain_type: 'vocabulary',
          next_review: '2024-01-15',
          mastery_level: 30,
          box: 2,
        },
      ]);

      const result = await getDueItems({ token: 'valid-token' });

      expect(result.data[0].sourceType).toBe('book');
      expect(result.data[0].itemType).toBe('word');
      expect(result.data[0].domainType).toBe('vocabulary');
      expect(result.data[0].masteryLevel).toBe(30);
    });

    test('converts Date to string for date parameter', async () => {
      mockLPService.getDueForReview.mockResolvedValue([]);
      const testDate = new Date('2024-01-15T10:30:00Z');

      await getDueItems({ token: 'valid-token', date: testDate });

      expect(mockLPService.getDueForReview).toHaveBeenCalledWith(expect.objectContaining({
        date: '2024-01-15',
      }));
    });

    test('uses default values for unspecified options', async () => {
      mockLPService.getDueForReview.mockResolvedValue([]);

      await getDueItems({ token: 'valid-token' });

      expect(mockLPService.getDueForReview).toHaveBeenCalledWith(expect.objectContaining({
        limit: 50,
        offset: 0,
        includeNew: true,
      }));
    });
  });

  // ==========================================================================
  // processReview
  // ==========================================================================

  describe('processReview (processReviewUnified)', () => {
    test('calls underlying processReview', async () => {
      // The underlying processReview returns snake_case fields
      // UnifiedLearningPointManager maps result.box to newBox
      mockLPService.processReview.mockResolvedValue({
        box: 3, // This becomes newBox in the unified API
        next_review: '2024-01-19',
        mastery_level: 50,
        correct_streak: 2,
        review_count: 5,
      });

      const result = await processReview({
        itemId: 'item-123',
        rating: 3,
        responseTime: 2500,
        token: 'valid-token',
      });

      expect(mockLPService.processReview).toHaveBeenCalledWith(
        'item-123',
        3,
        2500,
        'valid-token'
      );

      expect(result.success).toBe(true);
      expect(result.newBox).toBe(3);
      expect(result.nextReview).toBe('2024-01-19');
      expect(result.masteryLevel).toBe(50);
    });

    test('returns error for missing itemId', async () => {
      const result = await processReview({
        rating: 3,
        token: 'valid-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing itemId or rating');
    });

    test('returns error for missing rating', async () => {
      const result = await processReview({
        itemId: 'item-123',
        token: 'valid-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing itemId or rating');
    });

    test('handles error from underlying function', async () => {
      mockLPService.processReview.mockResolvedValue({
        error: 'Learning point not found',
      });

      const result = await processReview({
        itemId: 'non-existent',
        rating: 3,
        token: 'valid-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Learning point not found');
    });

    test('uses default responseTime of 0', async () => {
      mockLPService.processReview.mockResolvedValue({
        newBox: 2,
        next_review: '2024-01-17',
      });

      await processReview({
        itemId: 'item-123',
        rating: 3,
        token: 'valid-token',
      });

      expect(mockLPService.processReview).toHaveBeenCalledWith(
        'item-123',
        3,
        0, // default responseTime
        'valid-token'
      );
    });
  });

  // ==========================================================================
  // getStats
  // ==========================================================================

  describe('getStats (getStatsUnified)', () => {
    test('returns stats with all fields', async () => {
      mockLPService.getStats.mockResolvedValue({
        total: 100,
        dueToday: 15,
        mastered: 20,
        learning: 80,
        byBox: { 1: 30, 2: 25, 3: 15, 4: 10, 5: 20 },
        byDomain: { vocabulary: 50, math: 30, knowledge: 20 },
        byItemType: { word: 60, concept: 30, formula: 10 },
        averageMastery: 45,
      });

      const result = await getStats('valid-token');

      expect(result.total).toBe(100);
      expect(result.dueToday).toBe(15);
      expect(result.totalDue).toBe(15);
      expect(result.totalItems).toBe(100);
      expect(result.mastered).toBe(20);
      expect(result.learning).toBe(80);
      expect(result.byBox).toEqual({ 1: 30, 2: 25, 3: 15, 4: 10, 5: 20 });
      expect(result.byDomain).toEqual({ vocabulary: 50, math: 30, knowledge: 20 });
    });

    test('handles error from underlying function', async () => {
      mockLPService.getStats.mockResolvedValue({
        error: 'Invalid session',
      });

      const result = await getStats('invalid-token');

      expect(result.error).toBe('Invalid session');
    });

    test('handles null return', async () => {
      mockLPService.getStats.mockResolvedValue(null);

      const result = await getStats('valid-token');

      expect(result.error).toContain('Failed to get stats');
    });

    test('passes options to underlying function', async () => {
      mockLPService.getStats.mockResolvedValue({
        total: 50,
        dueToday: 10,
      });

      await getStats('valid-token', { planId: 'plan-123', domainType: 'vocabulary' });

      expect(mockLPService.getStats).toHaveBeenCalledWith(
        'valid-token',
        { planId: 'plan-123', domainType: 'vocabulary' }
      );
    });
  });

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  describe('getItemById (getItemByIdUnified)', () => {
    test('returns normalized item', async () => {
      mockLPService.getLearningPointById.mockResolvedValue({
        id: 'item-123',
        source_type: 'book',
        item_type: 'word',
        mastery_level: 45,
        box: 3,
      });

      const result = await getItemById('item-123', 'valid-token');

      expect(result.sourceType).toBe('book');
      expect(result.itemType).toBe('word');
      expect(result.masteryLevel).toBe(45);
    });

    test('returns null for not found', async () => {
      mockLPService.getLearningPointById.mockResolvedValue(null);

      const result = await getItemById('non-existent', 'valid-token');

      expect(result).toBeNull();
    });
  });

  describe('createItem', () => {
    test('returns success with normalized item', async () => {
      mockLPService.createLearningPoint.mockResolvedValue({
        id: 'new-item-id',
        source_type: 'manual',
        item_type: 'concept',
        box: 1,
      });

      const result = await createItem({
        title: 'Test',
        front: 'Q',
        back: 'A',
      }, 'valid-token');

      expect(result.success).toBe(true);
      expect(result.item.sourceType).toBe('manual');
    });

    test('returns error from underlying function', async () => {
      mockLPService.createLearningPoint.mockResolvedValue({
        error: 'Title is required',
      });

      const result = await createItem({
        front: 'Q',
        back: 'A',
      }, 'valid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Title is required');
    });
  });

  describe('createItemsBatch', () => {
    test('passes through to underlying function', async () => {
      mockLPService.createLearningPointsBatch.mockResolvedValue({
        created: 5,
        errors: [],
      });

      const points = [
        { title: 'Item 1', front: 'Q1', back: 'A1' },
        { title: 'Item 2', front: 'Q2', back: 'A2' },
      ];

      const result = await createItemsBatch(points, 'valid-token');

      expect(mockLPService.createLearningPointsBatch).toHaveBeenCalledWith(
        points,
        'valid-token'
      );
      expect(result.created).toBe(5);
    });
  });

  describe('updateItem', () => {
    test('returns success with normalized item', async () => {
      mockLPService.updateLearningPoint.mockResolvedValue({
        id: 'item-123',
        title: 'Updated Title',
        item_type: 'concept',
      });

      const result = await updateItem('item-123', { title: 'Updated Title' }, 'valid-token');

      expect(result.success).toBe(true);
      expect(result.item.title).toBe('Updated Title');
      expect(result.item.itemType).toBe('concept');
    });

    test('returns error from underlying function', async () => {
      mockLPService.updateLearningPoint.mockResolvedValue({
        error: 'No valid fields to update',
      });

      const result = await updateItem('item-123', { invalid: 'field' }, 'valid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid fields to update');
    });
  });

  describe('deleteItem', () => {
    test('returns success status', async () => {
      mockLPService.deleteLearningPoint.mockResolvedValue(true);

      const result = await deleteItem('item-123', 'valid-token');

      expect(result.success).toBe(true);
    });

    test('returns failure status', async () => {
      mockLPService.deleteLearningPoint.mockResolvedValue(false);

      const result = await deleteItem('item-123', 'invalid-token');

      expect(result.success).toBe(false);
    });

    test('supports hard delete', async () => {
      mockLPService.deleteLearningPoint.mockResolvedValue(true);

      await deleteItem('item-123', 'valid-token', true);

      expect(mockLPService.deleteLearningPoint).toHaveBeenCalledWith(
        'item-123',
        'valid-token',
        true
      );
    });
  });

  // ==========================================================================
  // SEARCH AND QUERY
  // ==========================================================================

  describe('search (searchItems)', () => {
    test('returns normalized items', async () => {
      mockLPService.search.mockResolvedValue([
        { id: '1', source_type: 'book', item_type: 'word' },
        { id: '2', source_type: 'url', item_type: 'concept' },
      ]);

      const result = await search('test query', 'valid-token');

      expect(result).toHaveLength(2);
      expect(result[0].sourceType).toBe('book');
      expect(result[1].sourceType).toBe('url');
    });

    test('passes options to underlying function', async () => {
      mockLPService.search.mockResolvedValue([]);

      await search('test', 'valid-token', { limit: 20, domainType: 'vocabulary' });

      expect(mockLPService.search).toHaveBeenCalledWith(
        'test',
        'valid-token',
        { limit: 20, domainType: 'vocabulary' }
      );
    });
  });

  describe('getItemsBySource', () => {
    test('returns normalized items', async () => {
      mockLPService.getBySource.mockResolvedValue([
        { id: '1', source_type: 'book', source_id: 'book-123', item_type: 'word' },
      ]);

      const result = await getItemsBySource('book', 'book-123', 'valid-token');

      expect(result).toHaveLength(1);
      expect(result[0].sourceType).toBe('book');
      expect(result[0].sourceId).toBe('book-123');
    });
  });

  describe('getItemsByPlan', () => {
    test('returns normalized items', async () => {
      mockLPService.getByPlan.mockResolvedValue([
        { id: '1', plan_id: 'plan-123', item_type: 'concept' },
        { id: '2', plan_id: 'plan-123', item_type: 'formula' },
      ]);

      const result = await getItemsByPlan('plan-123', 'valid-token');

      expect(result).toHaveLength(2);
      expect(result[0].itemType).toBe('concept');
      expect(result[1].itemType).toBe('formula');
    });
  });

  describe('getAllItems', () => {
    test('returns paginated normalized items', async () => {
      mockLPService.getAll.mockResolvedValue({
        items: [
          { id: '1', item_type: 'word' },
          { id: '2', item_type: 'concept' },
        ],
        total: 100,
        page: 1,
        pageSize: 50,
      });

      const result = await getAllItems('valid-token', { page: 1 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].itemType).toBe('word');
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    test('handles null items array', async () => {
      mockLPService.getAll.mockResolvedValue({
        items: null,
        total: 0,
        page: 1,
        pageSize: 50,
      });

      const result = await getAllItems('valid-token');

      expect(result.items).toEqual([]);
    });
  });

  // ==========================================================================
  // SPACED REPETITION HELPERS
  // ==========================================================================

  describe('resetItem', () => {
    test('delegates to underlying function', async () => {
      mockLPService.reset.mockResolvedValue(true);

      const result = await resetItem('item-123', 'valid-token');

      expect(mockLPService.reset).toHaveBeenCalledWith(
        'item-123',
        'valid-token'
      );
      expect(result).toBe(true);
    });
  });

  describe('getForecast', () => {
    test('delegates to underlying function', async () => {
      mockLPService.getForecast.mockResolvedValue({
        '2024-01-15': 5,
        '2024-01-16': 10,
      });

      const result = await getForecast('valid-token', 7);

      expect(mockLPService.getForecast).toHaveBeenCalledWith(
        'valid-token',
        7
      );
      expect(result['2024-01-15']).toBe(5);
    });

    test('uses default days of 14', async () => {
      mockLPService.getForecast.mockResolvedValue({});

      await getForecast('valid-token');

      expect(mockLPService.getForecast).toHaveBeenCalledWith(
        'valid-token',
        14
      );
    });
  });
});
