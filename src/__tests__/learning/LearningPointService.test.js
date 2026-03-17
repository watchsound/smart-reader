/**
 * LearningPointService.test.js
 *
 * Unit tests for the LearningPointService which provides business logic
 * for unified learning points using Neo4j as primary storage.
 */

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

jest.mock('../../main/utils/GraphInterface', () => ({
  __esModule: true,
  default: {
    isConnected: jest.fn(() => true),
    createLearningPoint: jest.fn(),
    createLearningPointsBatch: jest.fn(),
    getLearningPointById: jest.fn(),
    updateLearningPoint: jest.fn(),
    deleteLearningPoint: jest.fn(),
    getLearningPointsDue: jest.fn(),
    getLearningPointsBySource: jest.fn(),
    getLearningPointsByPlan: jest.fn(),
    searchLearningPoints: jest.fn(),
    getAllLearningPoints: jest.fn(),
    processLearningPointReview: jest.fn(),
    resetLearningPoint: jest.fn(),
    getLearningPointStats: jest.fn(),
    getLearningPointForecast: jest.fn(),
  },
}));

jest.mock('../../main/db/dbManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'invalid-token') return -1;
    return -1;
  }),
}));

const graphInterface = require('../../main/utils/GraphInterface').default;
const { getUserIdFromToken } = require('../../main/db/dbManager');

// Import the service after mocks are set up
const {
  learningPointService,
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  SOURCE_TYPES,
  RATINGS,
  BOX_INTERVALS,
} = require('../../main/utils/LearningPointService');

describe('LearningPointService', () => {
  const validToken = 'valid-token';
  const invalidToken = 'invalid-token';

  beforeEach(() => {
    jest.clearAllMocks();
    graphInterface.isConnected.mockReturnValue(true);
  });

  // ===========================================================================
  // CONSTANTS
  // ===========================================================================

  describe('Constants', () => {
    test('ITEM_TYPES contains expected values', () => {
      expect(ITEM_TYPES).toEqual({
        WORD: 'word',
        CONCEPT: 'concept',
        NOTE: 'note',
        PDF_ANNOTATION: 'pdf_annotation',
        FORMULA: 'formula',
        PROBLEM: 'problem',
      });
    });

    test('DOMAIN_TYPES contains expected values', () => {
      expect(DOMAIN_TYPES).toEqual({
        VOCABULARY: 'vocabulary',
        KNOWLEDGE: 'knowledge',
        MATH: 'math',
        READING: 'reading',
        LANGUAGE: 'language',
        SKILL: 'skill',
      });
    });

    test('DIFFICULTY_LEVELS contains expected values', () => {
      expect(DIFFICULTY_LEVELS).toEqual({
        BEGINNER: 'beginner',
        INTERMEDIATE: 'intermediate',
        ADVANCED: 'advanced',
      });
    });

    test('RATINGS contains expected values', () => {
      expect(RATINGS).toEqual({
        AGAIN: 1,
        HARD: 2,
        GOOD: 3,
        EASY: 4,
      });
    });

    test('BOX_INTERVALS contains correct day values', () => {
      expect(BOX_INTERVALS).toEqual([1, 2, 4, 7, 14]);
    });
  });

  // ===========================================================================
  // SERVICE AVAILABILITY
  // ===========================================================================

  describe('isAvailable', () => {
    test('returns true when graph is connected', () => {
      graphInterface.isConnected.mockReturnValue(true);
      expect(learningPointService.isAvailable()).toBe(true);
    });

    test('returns false when graph is not connected', () => {
      graphInterface.isConnected.mockReturnValue(false);
      expect(learningPointService.isAvailable()).toBe(false);
    });
  });

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  describe('validateLearningPoint', () => {
    test('validates a valid learning point', () => {
      const point = {
        title: 'Test Point',
        front: 'What is 2+2?',
        back: '4',
        itemType: 'concept',
        domainType: 'math',
      };
      const result = learningPointService.validateLearningPoint(point);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('fails when no title or front provided', () => {
      const point = { back: 'answer' };
      const result = learningPointService.validateLearningPoint(point);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Either title or front content is required');
    });

    test('fails for invalid item type', () => {
      const point = {
        title: 'Test',
        itemType: 'invalid_type',
      };
      const result = learningPointService.validateLearningPoint(point);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid itemType'))).toBe(true);
    });

    test('fails for invalid domain type', () => {
      const point = {
        title: 'Test',
        domainType: 'invalid_domain',
      };
      const result = learningPointService.validateLearningPoint(point);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid domainType'))).toBe(true);
    });

    test('validates word type content', () => {
      const point = {
        title: 'ephemeral',
        front: 'ephemeral',
        itemType: 'word',
      };
      const result = learningPointService.validateLearningPoint(point);
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // NORMALIZATION
  // ===========================================================================

  describe('normalizeLearningPoint', () => {
    test('generates ID if not provided', () => {
      const point = { title: 'Test', front: 'Question' };
      const normalized = learningPointService.normalizeLearningPoint(point);
      expect(normalized.id).toBe('lp_mock-uuid-1234');
    });

    test('preserves provided ID', () => {
      const point = { id: 'custom-id', title: 'Test' };
      const normalized = learningPointService.normalizeLearningPoint(point);
      expect(normalized.id).toBe('custom-id');
    });

    test('infers domain type from item type', () => {
      const vocabPoint = { title: 'word', itemType: 'word' };
      const mathPoint = { title: 'formula', itemType: 'formula' };
      const notePoint = { title: 'note', itemType: 'note' };

      expect(learningPointService.normalizeLearningPoint(vocabPoint).domainType).toBe('vocabulary');
      expect(learningPointService.normalizeLearningPoint(mathPoint).domainType).toBe('math');
      expect(learningPointService.normalizeLearningPoint(notePoint).domainType).toBe('reading');
    });

    test('normalizes tags from string', () => {
      const point = { title: 'Test', tags: 'tag1, tag2, tag3' };
      const normalized = learningPointService.normalizeLearningPoint(point);
      expect(normalized.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    test('normalizes tags from JSON string', () => {
      const point = { title: 'Test', tags: '["tag1", "tag2"]' };
      const normalized = learningPointService.normalizeLearningPoint(point);
      expect(normalized.tags).toEqual(['tag1', 'tag2']);
    });

    test('sets default box to 1', () => {
      const point = { title: 'Test' };
      const normalized = learningPointService.normalizeLearningPoint(point);
      expect(normalized.box).toBe(1);
    });

    test('sets default difficulty to intermediate', () => {
      const point = { title: 'Test' };
      const normalized = learningPointService.normalizeLearningPoint(point);
      expect(normalized.difficulty).toBe('intermediate');
    });
  });

  // ===========================================================================
  // CRUD OPERATIONS
  // ===========================================================================

  describe('createLearningPoint', () => {
    test('creates a learning point with valid data', async () => {
      const point = {
        title: 'Test Point',
        front: 'Question',
        back: 'Answer',
      };
      const mockCreated = { id: 'lp_123', ...point };
      graphInterface.createLearningPoint.mockResolvedValue(mockCreated);

      const result = await learningPointService.createLearningPoint(point, validToken);

      expect(graphInterface.createLearningPoint).toHaveBeenCalled();
      expect(result).toEqual(mockCreated);
    });

    test('returns error for invalid token', async () => {
      const point = { title: 'Test' };
      const result = await learningPointService.createLearningPoint(point, invalidToken);

      expect(result.error).toBe('Invalid session');
      expect(graphInterface.createLearningPoint).not.toHaveBeenCalled();
    });

    test('returns validation errors for invalid data', async () => {
      const point = { itemType: 'invalid' };
      const result = await learningPointService.createLearningPoint(point, validToken);

      expect(result.error).toBe('Validation failed');
      expect(result.errors).toBeDefined();
    });
  });

  describe('createLearningPointsBatch', () => {
    test('creates multiple valid points', async () => {
      const points = [
        { title: 'Point 1', front: 'Q1', back: 'A1' },
        { title: 'Point 2', front: 'Q2', back: 'A2' },
      ];
      graphInterface.createLearningPointsBatch.mockResolvedValue({ created: 2 });

      const result = await learningPointService.createLearningPointsBatch(points, validToken);

      expect(graphInterface.createLearningPointsBatch).toHaveBeenCalled();
      expect(result.created).toBe(2);
    });

    test('returns validation errors for invalid points', async () => {
      const points = [
        { title: 'Valid', front: 'Q' },
        { itemType: 'invalid' }, // Invalid
      ];
      graphInterface.createLearningPointsBatch.mockResolvedValue({ created: 1 });

      const result = await learningPointService.createLearningPointsBatch(points, validToken);

      expect(result.validationErrors.length).toBe(1);
      expect(result.validationErrors[0].index).toBe(1);
    });
  });

  describe('getLearningPointById', () => {
    test('returns learning point when found', async () => {
      const mockPoint = { id: 'lp_123', title: 'Test' };
      graphInterface.getLearningPointById.mockResolvedValue(mockPoint);

      const result = await learningPointService.getLearningPointById('lp_123', validToken);

      expect(result).toEqual(mockPoint);
    });

    test('returns null when not found', async () => {
      graphInterface.getLearningPointById.mockResolvedValue(null);

      const result = await learningPointService.getLearningPointById('nonexistent', validToken);

      expect(result).toBeNull();
    });
  });

  describe('updateLearningPoint', () => {
    test('updates with valid data', async () => {
      const updates = { title: 'Updated Title' };
      const mockUpdated = { id: 'lp_123', ...updates };
      graphInterface.updateLearningPoint.mockResolvedValue(mockUpdated);

      const result = await learningPointService.updateLearningPoint('lp_123', updates, validToken);

      expect(graphInterface.updateLearningPoint).toHaveBeenCalledWith(
        'lp_123',
        expect.objectContaining({ title: 'Updated Title' }),
        validToken
      );
      expect(result).toEqual(mockUpdated);
    });

    test('sanitizes updates to remove protected fields', async () => {
      const updates = { id: 'new-id', userId: 999, title: 'New Title' };
      graphInterface.updateLearningPoint.mockResolvedValue({ id: 'lp_123', title: 'New Title' });

      await learningPointService.updateLearningPoint('lp_123', updates, validToken);

      const calledUpdates = graphInterface.updateLearningPoint.mock.calls[0][1];
      expect(calledUpdates.id).toBeUndefined();
      expect(calledUpdates.userId).toBeUndefined();
      expect(calledUpdates.title).toBe('New Title');
    });
  });

  describe('deleteLearningPoint', () => {
    test('deletes with soft delete by default', async () => {
      graphInterface.deleteLearningPoint.mockResolvedValue(true);

      const result = await learningPointService.deleteLearningPoint('lp_123', validToken);

      expect(graphInterface.deleteLearningPoint).toHaveBeenCalledWith('lp_123', validToken, false);
      expect(result).toBe(true);
    });

    test('supports hard delete', async () => {
      graphInterface.deleteLearningPoint.mockResolvedValue(true);

      await learningPointService.deleteLearningPoint('lp_123', validToken, true);

      expect(graphInterface.deleteLearningPoint).toHaveBeenCalledWith('lp_123', validToken, true);
    });
  });

  // ===========================================================================
  // QUERY OPERATIONS
  // ===========================================================================

  describe('getDueForReview', () => {
    test('returns due items', async () => {
      const mockItems = [{ id: 'lp_1' }, { id: 'lp_2' }];
      graphInterface.getLearningPointsDue.mockResolvedValue(mockItems);

      const result = await learningPointService.getDueForReview({ token: validToken });

      expect(graphInterface.getLearningPointsDue).toHaveBeenCalled();
      expect(result).toEqual(mockItems);
    });

    test('returns empty array on error', async () => {
      graphInterface.getLearningPointsDue.mockRejectedValue(new Error('DB error'));

      const result = await learningPointService.getDueForReview({ token: validToken });

      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    test('searches learning points', async () => {
      const mockResults = [{ id: 'lp_1', title: 'Match' }];
      graphInterface.searchLearningPoints.mockResolvedValue(mockResults);

      const result = await learningPointService.search('query', validToken);

      expect(graphInterface.searchLearningPoints).toHaveBeenCalledWith('query', validToken, {});
      expect(result).toEqual(mockResults);
    });
  });

  // ===========================================================================
  // SPACED REPETITION
  // ===========================================================================

  describe('processReview', () => {
    test('processes review with valid rating', async () => {
      const mockCurrent = { id: 'lp_123', title: 'Test', box: 1 };
      const mockResult = { success: true, newBox: 2, masteryLevel: 30 };

      graphInterface.getLearningPointById.mockResolvedValue(mockCurrent);
      graphInterface.processLearningPointReview.mockResolvedValue(mockResult);

      const result = await learningPointService.processReview('lp_123', RATINGS.GOOD, 2000, validToken);

      expect(graphInterface.processLearningPointReview).toHaveBeenCalledWith(
        'lp_123',
        RATINGS.GOOD,
        2000,
        validToken
      );
      expect(result).toEqual(mockResult);
    });

    test('returns error for invalid rating', async () => {
      const result = await learningPointService.processReview('lp_123', 5, 2000, validToken);

      expect(result.error).toContain('Invalid rating');
    });

    test('returns error for invalid token', async () => {
      const result = await learningPointService.processReview('lp_123', RATINGS.GOOD, 2000, invalidToken);

      expect(result.error).toBe('Invalid session');
    });

    test('returns error when learning point not found', async () => {
      graphInterface.getLearningPointById.mockResolvedValue(null);

      const result = await learningPointService.processReview('nonexistent', RATINGS.GOOD, 2000, validToken);

      expect(result.error).toBe('Learning point not found');
    });
  });

  describe('reset', () => {
    test('resets learning point to box 1', async () => {
      graphInterface.resetLearningPoint.mockResolvedValue(true);

      const result = await learningPointService.reset('lp_123', validToken);

      expect(graphInterface.resetLearningPoint).toHaveBeenCalledWith('lp_123', validToken);
      expect(result).toBe(true);
    });
  });

  describe('calculateNextReviewDate', () => {
    test('calculates correct dates for each box', () => {
      const testCases = [
        { box: 1, expectedDays: 1 },
        { box: 2, expectedDays: 2 },
        { box: 3, expectedDays: 4 },
        { box: 4, expectedDays: 7 },
        { box: 5, expectedDays: 14 },
      ];

      testCases.forEach(({ box, expectedDays }) => {
        // Calculate expected date using the same method as the service
        // to avoid timezone edge cases
        const now = new Date();
        const expectedDate = new Date(now);
        expectedDate.setDate(expectedDate.getDate() + expectedDays);
        const expectedDateStr = expectedDate.toISOString().split('T')[0];

        const result = learningPointService.calculateNextReviewDate(box);

        // Allow for ±1 day tolerance due to timezone differences during test runs
        const resultDate = new Date(result);
        const diffDays = Math.round((resultDate - now) / (1000 * 60 * 60 * 24));

        // The actual days should be within 1 day of expected (due to timezone boundary)
        expect(Math.abs(diffDays - expectedDays)).toBeLessThanOrEqual(1);
      });
    });
  });

  // ===========================================================================
  // MIGRATION HELPERS
  // ===========================================================================

  describe('convertFromVocabulary', () => {
    test('converts vocabulary to learning point format', () => {
      const vocab = {
        id: 123,
        word: 'ephemeral',
        definition: 'lasting for a very short time',
        part_of_speech: 'adjective',
        pronunciation: '/ɪˈfem(ə)rəl/',
        example: 'The ephemeral nature of fashion',
        context: 'in literature',
        source_type: 'manual',
        tags: '["english", "advanced"]',
        created_at: '2024-01-01T00:00:00Z',
      };
      const leitnerItem = { box: 3, next_review: '2024-01-15' };

      const result = learningPointService.convertFromVocabulary(vocab, leitnerItem);

      expect(result.id).toBe('lp_vocab_123');
      expect(result.itemType).toBe('word');
      expect(result.domainType).toBe('vocabulary');
      expect(result.title).toBe('ephemeral');
      expect(result.front).toBe('ephemeral');
      expect(result.back).toBe('lasting for a very short time');
      expect(result.extras.partOfSpeech).toBe('adjective');
      expect(result.box).toBe(3);
    });
  });

  describe('convertFromNote', () => {
    test('converts EPUB note to learning point format', () => {
      const note = {
        id: 456,
        data: JSON.stringify({
          cards: [
            { id: 1, text: 'Highlight text', type: 'normal' },
            { id: 2, text: 'My annotation', type: 'annotation' },
          ],
          color: '#FFE082',
          cfi: 'epubcfi(/6/4)',
          chapter: 'Chapter 1',
          bookPath: '/path/to/book.epub',
        }),
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = learningPointService.convertFromNote(note);

      expect(result.id).toBe('lp_note_456');
      expect(result.itemType).toBe('note');
      expect(result.domainType).toBe('reading');
      expect(result.front.cards).toHaveLength(1);
      expect(result.back.cards).toHaveLength(1);
      expect(result.extras.color).toBe('#FFE082');
      expect(result.cfi).toBe('epubcfi(/6/4)');
    });

    test('converts PDF annotation to learning point format', () => {
      const note = {
        id: 789,
        data: JSON.stringify({
          cards: [{ id: 1, text: 'PDF text' }],
          position: [{ x1: 100, y1: 200, pageNumber: 5 }],
          color: '#FFEB3B',
        }),
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = learningPointService.convertFromNote(note);

      expect(result.itemType).toBe('pdf_annotation');
      expect(result.extras.position).toBeDefined();
      expect(result.pageNumber).toBe(5);
    });
  });

  describe('convertFromPlanPoint', () => {
    test('converts plan point to learning point format', () => {
      const planPoint = {
        id: 'plan_point_1',
        front: 'What is mitosis?',
        back: 'Cell division process',
        type: 'concept',
        domain: 'knowledge',
        tags: ['biology', 'cell'],
        difficulty: 'intermediate',
        box: 2,
        nextReview: '2024-02-01',
      };
      const planId = 'plan_123';

      const result = learningPointService.convertFromPlanPoint(planPoint, planId);

      expect(result.id).toBe('plan_point_1');
      expect(result.itemType).toBe('concept');
      expect(result.domainType).toBe('knowledge');
      expect(result.planId).toBe('plan_123');
      expect(result.sourceType).toBe('import');
      expect(result.box).toBe(2);
    });
  });

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  describe('getStats', () => {
    test('returns statistics', async () => {
      const mockStats = {
        total: 100,
        boxDistribution: { 1: 20, 2: 30, 3: 25, 4: 15, 5: 10 },
        dueToday: 15,
      };
      graphInterface.getLearningPointStats.mockResolvedValue(mockStats);

      const result = await learningPointService.getStats(validToken);

      expect(result).toEqual(mockStats);
    });
  });

  describe('getForecast', () => {
    test('returns daily forecast', async () => {
      const mockForecast = [
        { date: '2024-01-15', count: 10 },
        { date: '2024-01-16', count: 15 },
      ];
      graphInterface.getLearningPointForecast.mockResolvedValue(mockForecast);

      const result = await learningPointService.getForecast(validToken, 14);

      expect(graphInterface.getLearningPointForecast).toHaveBeenCalledWith(validToken, 14);
      expect(result).toEqual(mockForecast);
    });
  });

  // ===========================================================================
  // EPISODE COLLECTOR INTEGRATION
  // ===========================================================================

  describe('Episode Collector Integration', () => {
    test('records episode on learning point creation', async () => {
      const mockCollector = {
        collectEvent: jest.fn(),
      };
      learningPointService.setEpisodeCollector(mockCollector);

      const mockCreated = { id: 'lp_123', itemType: 'concept', domainType: 'knowledge', sourceType: 'manual' };
      graphInterface.createLearningPoint.mockResolvedValue(mockCreated);

      await learningPointService.createLearningPoint({ title: 'Test' }, validToken);

      expect(mockCollector.collectEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'LEARNING_POINT_CREATED',
          userId: 1,
          payload: expect.objectContaining({
            pointId: 'lp_123',
            itemType: 'concept',
          }),
        })
      );

      // Clean up
      learningPointService.setEpisodeCollector(null);
    });

    test('records episode on review completion', async () => {
      const mockCollector = {
        collectEvent: jest.fn(),
      };
      learningPointService.setEpisodeCollector(mockCollector);

      const mockCurrent = { id: 'lp_123', title: 'Test', box: 1 };
      const mockResult = { success: true, newBox: 2, masteryLevel: 30 };

      graphInterface.getLearningPointById.mockResolvedValue(mockCurrent);
      graphInterface.processLearningPointReview.mockResolvedValue(mockResult);

      await learningPointService.processReview('lp_123', RATINGS.GOOD, 2000, validToken);

      expect(mockCollector.collectEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'REVIEW_COMPLETED',
          userId: 1,
          payload: expect.objectContaining({
            conceptId: 'lp_123',
            rating: RATINGS.GOOD,
            wasCorrect: true,
            previousBox: 1,
            newBox: 2,
          }),
        })
      );

      // Clean up
      learningPointService.setEpisodeCollector(null);
    });
  });
});
