/**
 * learningPointHandlers.test.js
 *
 * Unit tests for the learning point IPC handlers.
 * Tests the bridge between renderer process and LearningPointService (Neo4j primary storage).
 */

// Mock dependencies
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

// Mock the LearningPointService
jest.mock('../../main/utils/LearningPointService', () => {
  const mockService = {
    isAvailable: jest.fn(() => true),
    setEpisodeCollector: jest.fn(),
    validateLearningPoint: jest.fn(),
    createLearningPoint: jest.fn(),
    createLearningPointsBatch: jest.fn(),
    getLearningPointById: jest.fn(),
    updateLearningPoint: jest.fn(),
    deleteLearningPoint: jest.fn(),
    getDueForReview: jest.fn(),
    getBySource: jest.fn(),
    getByPlan: jest.fn(),
    search: jest.fn(),
    getAll: jest.fn(),
    processReview: jest.fn(),
    reset: jest.fn(),
    getStats: jest.fn(),
    getForecast: jest.fn(),
    convertFromVocabulary: jest.fn(),
    convertFromNote: jest.fn(),
    convertFromPlanPoint: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockService,
    learningPointService: mockService,
    ITEM_TYPES: {
      WORD: 'word',
      CONCEPT: 'concept',
      NOTE: 'note',
      PDF_ANNOTATION: 'pdf_annotation',
      FORMULA: 'formula',
      PROBLEM: 'problem',
    },
    DOMAIN_TYPES: {
      VOCABULARY: 'vocabulary',
      KNOWLEDGE: 'knowledge',
      MATH: 'math',
      READING: 'reading',
      LANGUAGE: 'language',
      SKILL: 'skill',
    },
    DIFFICULTY_LEVELS: {
      BEGINNER: 'beginner',
      INTERMEDIATE: 'intermediate',
      ADVANCED: 'advanced',
    },
    SOURCE_TYPES: {
      BOOK: 'book',
      URL: 'url',
      CHAT: 'chat',
      MANUAL: 'manual',
      IMPORT: 'import',
      MIGRATION: 'migration',
    },
    RATINGS: {
      AGAIN: 1,
      HARD: 2,
      GOOD: 3,
      EASY: 4,
    },
    BOX_INTERVALS: [1, 2, 4, 7, 14],
  };
});

const { ipcMain } = require('electron');
const mockService = require('../../main/utils/LearningPointService').learningPointService;
const {
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  SOURCE_TYPES,
  RATINGS,
  BOX_INTERVALS,
} = require('../../main/utils/LearningPointService');
const { registerLearningPointHandlers } = require('../../main/ipc/learningPointHandlers');

describe('learningPointHandlers', () => {
  let handlers = {};
  let syncHandlers = {};

  let episodeCollectorWasCalled = false;

  beforeAll(() => {
    // Capture registered handlers
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
    ipcMain.on.mockImplementation((channel, handler) => {
      syncHandlers[channel] = handler;
    });

    // Track if setEpisodeCollector is called before clearing mocks
    mockService.setEpisodeCollector.mockImplementation(() => {
      episodeCollectorWasCalled = true;
    });

    // Register handlers
    registerLearningPointHandlers({}, { episodeCollector: { collectEvent: jest.fn() } });
  });

  beforeEach(() => {
    // Clear mocks but not the handlers
    jest.clearAllMocks();
    mockService.isAvailable.mockReturnValue(true);
  });

  // ==========================================================================
  // REGISTRATION
  // ==========================================================================

  describe('Registration', () => {
    test('sets episode collector if provided', () => {
      // Check the flag we set in beforeAll before mocks were cleared
      expect(episodeCollectorWasCalled).toBe(true);
    });

    test('registers all async handlers', () => {
      const expectedHandlers = [
        'lp-create',
        'lp-create-batch',
        'lp-get',
        'lp-update',
        'lp-delete',
        'lp-get-due',
        'lp-get-by-source',
        'lp-get-by-plan',
        'lp-search',
        'lp-get-all',
        'lp-process-review',
        'lp-reset',
        'lp-get-stats',
        'lp-get-forecast',
      ];

      expectedHandlers.forEach(channel => {
        expect(handlers[channel]).toBeDefined();
      });
    });

    test('registers all sync handlers', () => {
      const expectedSyncHandlers = [
        'lp-status',
        'lp-get-item-types',
        'lp-get-domain-types',
        'lp-get-difficulty-levels',
        'lp-get-source-types',
        'lp-validate',
        'lp-convert-vocabulary',
        'lp-convert-note',
        'lp-convert-plan-point',
      ];

      expectedSyncHandlers.forEach(channel => {
        expect(syncHandlers[channel]).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // STATUS HANDLER
  // ==========================================================================

  describe('lp-status handler', () => {
    test('returns service status and constants', () => {
      const mockEvent = { returnValue: null };

      syncHandlers['lp-status'](mockEvent);

      expect(mockEvent.returnValue.available).toBe(true);
      expect(mockEvent.returnValue.constants.itemTypes).toEqual(ITEM_TYPES);
      expect(mockEvent.returnValue.constants.domainTypes).toEqual(DOMAIN_TYPES);
      expect(mockEvent.returnValue.constants.ratings).toEqual(RATINGS);
    });
  });

  // ==========================================================================
  // CRUD HANDLERS
  // ==========================================================================

  describe('lp-create handler', () => {
    test('calls createLearningPoint with correct arguments', async () => {
      const point = { title: 'Test', front: 'Q', back: 'A' };
      const token = 'valid-token';

      mockService.createLearningPoint.mockResolvedValue({
        id: 'new-id',
        ...point,
      });

      const result = await handlers['lp-create']({}, point, token);

      expect(mockService.createLearningPoint).toHaveBeenCalledWith(point, token);
      expect(result.id).toBe('new-id');
    });

    test('returns error on failure', async () => {
      const point = { title: 'Test' };
      const token = 'valid-token';

      mockService.createLearningPoint.mockRejectedValue(new Error('Create failed'));

      const result = await handlers['lp-create']({}, point, token);

      expect(result.error).toBe('Create failed');
    });
  });

  describe('lp-create-batch handler', () => {
    test('calls createLearningPointsBatch with correct arguments', async () => {
      const points = [
        { title: 'Item 1', front: 'Q1', back: 'A1' },
        { title: 'Item 2', front: 'Q2', back: 'A2' },
      ];
      const token = 'valid-token';

      mockService.createLearningPointsBatch.mockResolvedValue({
        created: 2,
        validationErrors: [],
      });

      const result = await handlers['lp-create-batch']({}, points, token);

      expect(mockService.createLearningPointsBatch).toHaveBeenCalledWith(points, token);
      expect(result.created).toBe(2);
    });
  });

  describe('lp-get handler', () => {
    test('calls getLearningPointById with correct arguments', async () => {
      const id = 'item-123';
      const token = 'valid-token';

      mockService.getLearningPointById.mockResolvedValue({
        id,
        title: 'Test Item',
      });

      const result = await handlers['lp-get']({}, id, token);

      expect(mockService.getLearningPointById).toHaveBeenCalledWith(id, token);
      expect(result.title).toBe('Test Item');
    });

    test('returns null for non-existent item', async () => {
      mockService.getLearningPointById.mockResolvedValue(null);

      const result = await handlers['lp-get']({}, 'non-existent', 'valid-token');

      expect(result).toBeNull();
    });
  });

  describe('lp-update handler', () => {
    test('calls updateLearningPoint with correct arguments', async () => {
      const id = 'item-123';
      const updates = { title: 'Updated Title' };
      const token = 'valid-token';

      mockService.updateLearningPoint.mockResolvedValue({
        id,
        ...updates,
      });

      const result = await handlers['lp-update']({}, id, updates, token);

      expect(mockService.updateLearningPoint).toHaveBeenCalledWith(id, updates, token);
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('lp-delete handler', () => {
    test('calls deleteLearningPoint with soft delete by default', async () => {
      const id = 'item-123';
      const token = 'valid-token';

      mockService.deleteLearningPoint.mockResolvedValue(true);

      const result = await handlers['lp-delete']({}, id, token);

      expect(mockService.deleteLearningPoint).toHaveBeenCalledWith(id, token, false);
      expect(result.success).toBe(true);
    });

    test('calls deleteLearningPoint with hard delete when specified', async () => {
      const id = 'item-123';
      const token = 'valid-token';

      mockService.deleteLearningPoint.mockResolvedValue(true);

      const result = await handlers['lp-delete']({}, id, token, true);

      expect(mockService.deleteLearningPoint).toHaveBeenCalledWith(id, token, true);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // QUERY HANDLERS
  // ==========================================================================

  describe('lp-get-due handler', () => {
    test('calls getDueForReview with options', async () => {
      const options = {
        token: 'valid-token',
        limit: 20,
        itemTypes: ['word'],
      };

      mockService.getDueForReview.mockResolvedValue([
        { id: '1', title: 'Item 1' },
        { id: '2', title: 'Item 2' },
      ]);

      const result = await handlers['lp-get-due']({}, options);

      expect(mockService.getDueForReview).toHaveBeenCalledWith(options);
      expect(result).toHaveLength(2);
    });

    test('returns empty array on error', async () => {
      mockService.getDueForReview.mockRejectedValue(new Error('Query failed'));

      const result = await handlers['lp-get-due']({}, {});

      expect(result).toEqual([]);
    });
  });

  describe('lp-get-by-source handler', () => {
    test('calls getBySource with correct arguments', async () => {
      const sourceType = 'book';
      const sourceId = 'book-123';
      const token = 'valid-token';

      mockService.getBySource.mockResolvedValue([
        { id: '1', sourceType: 'book', sourceId: 'book-123' },
      ]);

      const result = await handlers['lp-get-by-source']({}, sourceType, sourceId, token);

      expect(mockService.getBySource).toHaveBeenCalledWith(sourceType, sourceId, token);
      expect(result).toHaveLength(1);
    });
  });

  describe('lp-get-by-plan handler', () => {
    test('calls getByPlan with correct arguments', async () => {
      const planId = 'plan-123';
      const token = 'valid-token';

      mockService.getByPlan.mockResolvedValue([
        { id: '1', planId: 'plan-123' },
        { id: '2', planId: 'plan-123' },
      ]);

      const result = await handlers['lp-get-by-plan']({}, planId, token);

      expect(mockService.getByPlan).toHaveBeenCalledWith(planId, token);
      expect(result).toHaveLength(2);
    });
  });

  describe('lp-search handler', () => {
    test('calls search with correct arguments', async () => {
      const query = 'test query';
      const token = 'valid-token';
      const options = { limit: 10, domainTypes: ['vocabulary'] };

      mockService.search.mockResolvedValue([
        { id: '1', title: 'Test Item' },
      ]);

      const result = await handlers['lp-search']({}, query, token, options);

      expect(mockService.search).toHaveBeenCalledWith(query, token, options);
      expect(result).toHaveLength(1);
    });
  });

  describe('lp-get-all handler', () => {
    test('calls getAll with correct arguments', async () => {
      const token = 'valid-token';
      const options = { limit: 20, offset: 0 };

      mockService.getAll.mockResolvedValue([
        { id: '1' },
        { id: '2' },
      ]);

      const result = await handlers['lp-get-all']({}, token, options);

      expect(mockService.getAll).toHaveBeenCalledWith(token, options);
      expect(result).toHaveLength(2);
    });
  });

  // ==========================================================================
  // SPACED REPETITION HANDLERS
  // ==========================================================================

  describe('lp-process-review handler', () => {
    test('calls processReview with correct arguments', async () => {
      const id = 'item-123';
      const rating = 3;
      const responseTimeMs = 2500;
      const token = 'valid-token';

      mockService.processReview.mockResolvedValue({
        success: true,
        newBox: 3,
        nextReview: '2024-01-19',
      });

      const result = await handlers['lp-process-review']({}, id, rating, responseTimeMs, token);

      expect(mockService.processReview).toHaveBeenCalledWith(id, rating, responseTimeMs, token);
      expect(result.success).toBe(true);
      expect(result.newBox).toBe(3);
    });

    test('returns error on failure', async () => {
      mockService.processReview.mockRejectedValue(new Error('Review failed'));

      const result = await handlers['lp-process-review']({}, 'id', 3, 2000, 'token');

      expect(result.error).toBe('Review failed');
    });
  });

  describe('lp-reset handler', () => {
    test('calls reset with correct arguments', async () => {
      const id = 'item-123';
      const token = 'valid-token';

      mockService.reset.mockResolvedValue(true);

      const result = await handlers['lp-reset']({}, id, token);

      expect(mockService.reset).toHaveBeenCalledWith(id, token);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // STATISTICS HANDLERS
  // ==========================================================================

  describe('lp-get-stats handler', () => {
    test('calls getStats with correct arguments', async () => {
      const token = 'valid-token';
      const options = { planId: 'plan-123' };

      mockService.getStats.mockResolvedValue({
        total: 100,
        mastered: 20,
        dueToday: 15,
      });

      const result = await handlers['lp-get-stats']({}, token, options);

      expect(mockService.getStats).toHaveBeenCalledWith(token, options);
      expect(result.total).toBe(100);
    });
  });

  describe('lp-get-forecast handler', () => {
    test('calls getForecast with correct arguments', async () => {
      const token = 'valid-token';
      const days = 7;

      mockService.getForecast.mockResolvedValue([
        { date: '2024-01-15', count: 5 },
        { date: '2024-01-16', count: 10 },
      ]);

      const result = await handlers['lp-get-forecast']({}, token, days);

      expect(mockService.getForecast).toHaveBeenCalledWith(token, days);
      expect(result).toHaveLength(2);
    });

    test('uses default days of 14', async () => {
      const token = 'valid-token';

      mockService.getForecast.mockResolvedValue([]);

      await handlers['lp-get-forecast']({}, token);

      expect(mockService.getForecast).toHaveBeenCalledWith(token, 14);
    });
  });

  // ==========================================================================
  // CONSTANTS SYNC HANDLERS
  // ==========================================================================

  describe('lp-get-item-types sync handler', () => {
    test('returns ITEM_TYPES', () => {
      const mockEvent = { returnValue: null };

      syncHandlers['lp-get-item-types'](mockEvent);

      expect(mockEvent.returnValue).toEqual(ITEM_TYPES);
    });
  });

  describe('lp-get-domain-types sync handler', () => {
    test('returns DOMAIN_TYPES', () => {
      const mockEvent = { returnValue: null };

      syncHandlers['lp-get-domain-types'](mockEvent);

      expect(mockEvent.returnValue).toEqual(DOMAIN_TYPES);
    });
  });

  describe('lp-get-difficulty-levels sync handler', () => {
    test('returns DIFFICULTY_LEVELS', () => {
      const mockEvent = { returnValue: null };

      syncHandlers['lp-get-difficulty-levels'](mockEvent);

      expect(mockEvent.returnValue).toEqual(DIFFICULTY_LEVELS);
    });
  });

  describe('lp-get-source-types sync handler', () => {
    test('returns SOURCE_TYPES', () => {
      const mockEvent = { returnValue: null };

      syncHandlers['lp-get-source-types'](mockEvent);

      expect(mockEvent.returnValue).toEqual(SOURCE_TYPES);
    });
  });

  // ==========================================================================
  // VALIDATION SYNC HANDLER
  // ==========================================================================

  describe('lp-validate sync handler', () => {
    test('validates learning point', () => {
      const mockEvent = { returnValue: null };
      const point = { title: 'Test', front: 'Q' };

      mockService.validateLearningPoint.mockReturnValue({ valid: true, errors: [] });

      syncHandlers['lp-validate'](mockEvent, point);

      expect(mockService.validateLearningPoint).toHaveBeenCalledWith(point);
      expect(mockEvent.returnValue.valid).toBe(true);
    });

    test('returns validation errors', () => {
      const mockEvent = { returnValue: null };
      const point = {};

      mockService.validateLearningPoint.mockReturnValue({
        valid: false,
        errors: ['Title is required'],
      });

      syncHandlers['lp-validate'](mockEvent, point);

      expect(mockEvent.returnValue.valid).toBe(false);
      expect(mockEvent.returnValue.errors).toContain('Title is required');
    });
  });

  // ==========================================================================
  // MIGRATION SYNC HANDLERS
  // ==========================================================================

  describe('lp-convert-vocabulary sync handler', () => {
    test('converts vocabulary to learning point', () => {
      const mockEvent = { returnValue: null };
      const vocab = { id: 1, word: 'test', definition: 'a test' };
      const leitnerItem = { box: 2 };

      mockService.convertFromVocabulary.mockReturnValue({
        id: 'lp_vocab_1',
        itemType: 'word',
        title: 'test',
      });

      syncHandlers['lp-convert-vocabulary'](mockEvent, vocab, leitnerItem);

      expect(mockService.convertFromVocabulary).toHaveBeenCalledWith(vocab, leitnerItem);
      expect(mockEvent.returnValue.itemType).toBe('word');
    });
  });

  describe('lp-convert-note sync handler', () => {
    test('converts note to learning point', () => {
      const mockEvent = { returnValue: null };
      const note = { id: 1, data: '{}' };
      const leitnerItem = { box: 3 };

      mockService.convertFromNote.mockReturnValue({
        id: 'lp_note_1',
        itemType: 'note',
      });

      syncHandlers['lp-convert-note'](mockEvent, note, leitnerItem);

      expect(mockService.convertFromNote).toHaveBeenCalledWith(note, leitnerItem);
      expect(mockEvent.returnValue.itemType).toBe('note');
    });
  });

  describe('lp-convert-plan-point sync handler', () => {
    test('converts plan point to learning point', () => {
      const mockEvent = { returnValue: null };
      const planPoint = { front: 'Q', back: 'A' };
      const planId = 'plan-123';

      mockService.convertFromPlanPoint.mockReturnValue({
        id: 'lp_plan_123_uuid',
        planId: 'plan-123',
      });

      syncHandlers['lp-convert-plan-point'](mockEvent, planPoint, planId);

      expect(mockService.convertFromPlanPoint).toHaveBeenCalledWith(planPoint, planId);
      expect(mockEvent.returnValue.planId).toBe('plan-123');
    });
  });
});
