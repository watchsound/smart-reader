/**
 * Neo4jAdapterLearningPoints.test.js
 *
 * Comprehensive tests for Neo4jAdapter unified learning point operations.
 * Tests the new GraphInterface-compatible LearningPoint methods
 * (createLearningPoint, getLearningPointById, updateLearningPoint, etc.)
 */

// Mock neo4j-driver
const mockSession = {
  run: jest.fn(),
  close: jest.fn(),
};

const mockDriver = {
  session: jest.fn(() => mockSession),
  verifyConnectivity: jest.fn().mockResolvedValue(true),
  close: jest.fn(),
};

jest.mock('neo4j-driver', () => ({
  driver: jest.fn(() => mockDriver),
  auth: {
    basic: jest.fn((user, password) => ({ user, password })),
  },
  int: jest.fn((value) => ({ low: value, high: 0 })),
}));

// Mock getUserIdFromToken
jest.mock('../../main/db/dbManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user2-token') return 2;
    if (token === 'invalid-token') return -1;
    return 1;
  }),
}));

// Reset the singleton before each import
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('Neo4jAdapter Unified LearningPoint Operations', () => {
  let Neo4jAdapter;
  let adapter;
  const validToken = 'valid-token';

  beforeEach(async () => {
    const module = require('../../main/utils/Neo4jAdapter');
    Neo4jAdapter = module.Neo4jAdapter;
    adapter = module.default;

    adapter.driver = mockDriver;
    adapter.isConnected = true;
    adapter.config = { database: 'neo4j' };
  });

  // ===========================================================================
  // createLearningPoint
  // ===========================================================================

  describe('createLearningPoint', () => {
    const testPoint = {
      id: 'lp_123',
      title: 'Test Point',
      front: { text: 'Question' },
      back: { text: 'Answer' },
      itemType: 'concept',
      domainType: 'knowledge',
      sourceType: 'manual',
      box: 1,
      nextReview: '2024-01-15',
      tags: ['test', 'concept'],
    };

    it('should create a learning point node', async () => {
      mockSession.run.mockResolvedValue({
        records: [{ get: (key) => {
          if (key === 'lp') return { properties: testPoint };
          return null;
        }}],
      });

      const result = await adapter.createLearningPoint(testPoint, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE'),
        expect.objectContaining({
          id: 'lp_123',
          userId: '1',  // userId is stored as string
          title: 'Test Point',
        })
      );
      expect(result.title).toBe('Test Point');
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle JSON content serialization', async () => {
      mockSession.run.mockResolvedValue({
        records: [{ get: () => ({ properties: testPoint }) }],
      });

      await adapter.createLearningPoint(testPoint, validToken);

      const callArgs = mockSession.run.mock.calls[0][1];
      // front and back should be JSON strings
      expect(typeof callArgs.front).toBe('string');
      expect(JSON.parse(callArgs.front)).toEqual({ text: 'Question' });
    });

    it('should return null for invalid token', async () => {
      const result = await adapter.createLearningPoint(testPoint, 'invalid-token');

      expect(result).toBeNull();
      expect(mockSession.run).not.toHaveBeenCalled();
    });

    it('should handle missing fields gracefully', async () => {
      const minimalPoint = { id: 'lp_min', title: 'Minimal' };
      mockSession.run.mockResolvedValue({
        records: [{ get: () => ({ properties: { ...minimalPoint, box: 1 } }) }],
      });

      const result = await adapter.createLearningPoint(minimalPoint, validToken);

      expect(result.box).toBe(1);
    });

    it('should handle database errors', async () => {
      mockSession.run.mockRejectedValue(new Error('Connection failed'));

      const result = await adapter.createLearningPoint(testPoint, validToken);

      // createLearningPoint returns null on errors
      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // createLearningPointsBatch
  // ===========================================================================

  describe('createLearningPointsBatch', () => {
    const testPoints = [
      { id: 'lp_1', title: 'Point 1', front: 'Q1', back: 'A1' },
      { id: 'lp_2', title: 'Point 2', front: 'Q2', back: 'A2' },
      { id: 'lp_3', title: 'Point 3', front: 'Q3', back: 'A3' },
    ];

    it('should create multiple learning points', async () => {
      mockSession.run.mockResolvedValue({
        records: [{ get: () => ({ properties: {} }) }],
      });

      const result = await adapter.createLearningPointsBatch(testPoints, validToken);

      expect(result.created).toBe(3);
      expect(mockSession.run).toHaveBeenCalledTimes(3);
    });

    it('should track errors for failed items', async () => {
      mockSession.run
        .mockResolvedValueOnce({ records: [{ get: () => ({ properties: {} }) }] })
        .mockRejectedValueOnce(new Error('Constraint violation'))
        .mockResolvedValueOnce({ records: [{ get: () => ({ properties: {} }) }] });

      const result = await adapter.createLearningPointsBatch(testPoints, validToken);

      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(1);
      // Errors are objects with {point, error} structure
      expect(result.errors[0]).toHaveProperty('error');
    });

    it('should return early for invalid token', async () => {
      const result = await adapter.createLearningPointsBatch(testPoints, 'invalid-token');

      expect(result).toHaveProperty('error');
      expect(mockSession.run).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getLearningPointById
  // ===========================================================================

  describe('getLearningPointById', () => {
    it('should retrieve a learning point by ID', async () => {
      const mockPoint = {
        id: 'lp_123',
        title: 'Test',
        box: 2,
        front: '{"text":"Q"}',
        back: '{"text":"A"}',
      };
      mockSession.run.mockResolvedValue({
        records: [{ get: () => ({ properties: mockPoint }) }],
      });

      const result = await adapter.getLearningPointById('lp_123', validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH'),
        expect.objectContaining({ id: 'lp_123', userId: '1' })
      );
      expect(result.id).toBe('lp_123');
      expect(result.title).toBe('Test');
    });

    it('should return null for non-existent point', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await adapter.getLearningPointById('nonexistent', validToken);

      expect(result).toBeNull();
    });

    it('should return null for invalid token', async () => {
      const result = await adapter.getLearningPointById('lp_123', 'invalid-token');

      expect(result).toBeNull();
    });

    it('should deserialize JSON fields', async () => {
      // Note: tags is stored directly in Neo4j as array, not JSON string
      // front/back/extras are stored as JSON strings and parsed
      const mockPoint = {
        id: 'lp_123',
        front: '{"text":"Question","latex":"$x^2$"}',
        back: '{"text":"Answer"}',
        extras: '{"code":"print()"}',
        tags: ['tag1', 'tag2'],
      };
      mockSession.run.mockResolvedValue({
        records: [{ get: () => ({ properties: mockPoint }) }],
      });

      const result = await adapter.getLearningPointById('lp_123', validToken);

      expect(result.front.text).toBe('Question');
      expect(result.front.latex).toBe('$x^2$');
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });
  });

  // ===========================================================================
  // updateLearningPoint
  // ===========================================================================

  describe('updateLearningPoint', () => {
    it('should update specified fields', async () => {
      const updates = { title: 'Updated Title', box: 3 };
      mockSession.run.mockResolvedValue({
        records: [{ get: () => ({ properties: { id: 'lp_123', ...updates } }) }],
      });

      const result = await adapter.updateLearningPoint('lp_123', updates, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET'),
        expect.objectContaining({ id: 'lp_123' })
      );
      expect(result.title).toBe('Updated Title');
    });

    it('should serialize JSON updates', async () => {
      const updates = { front: { text: 'New Q', latex: '$y$' } };
      mockSession.run.mockResolvedValue({
        records: [{ get: () => ({ properties: { id: 'lp_123' } }) }],
      });

      await adapter.updateLearningPoint('lp_123', updates, validToken);

      const callArgs = mockSession.run.mock.calls[0][1];
      // updateLearningPoint uses dynamic param keys like update_front
      expect(typeof callArgs.update_front).toBe('string');
    });

    it('should return error for invalid token', async () => {
      const result = await adapter.updateLearningPoint('lp_123', {}, 'invalid-token');

      expect(result).toHaveProperty('error');
    });

    it('should return error for non-existent point', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await adapter.updateLearningPoint('nonexistent', { title: 'X' }, validToken);

      expect(result).toHaveProperty('error');
    });
  });

  // ===========================================================================
  // deleteLearningPoint
  // ===========================================================================

  describe('deleteLearningPoint', () => {
    it('should soft delete by default (set validTo)', async () => {
      mockSession.run.mockResolvedValue({ summary: { counters: { nodesUpdated: 1 } } });

      const result = await adapter.deleteLearningPoint('lp_123', validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET'),
        expect.objectContaining({ id: 'lp_123' })
      );
      expect(result).toBe(true);
    });

    it('should hard delete when specified', async () => {
      mockSession.run.mockResolvedValue({ summary: { counters: { nodesDeleted: 1 } } });

      const result = await adapter.deleteLearningPoint('lp_123', validToken, true);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.any(Object)
      );
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const result = await adapter.deleteLearningPoint('lp_123', 'invalid-token');

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // getLearningPointsDue
  // ===========================================================================

  describe('getLearningPointsDue', () => {
    it('should get due items with filters', async () => {
      const mockItems = [
        { properties: { id: 'lp_1', box: 1, nextReview: '2024-01-15' } },
        { properties: { id: 'lp_2', box: 2, nextReview: '2024-01-14' } },
      ];
      mockSession.run.mockResolvedValue({
        records: mockItems.map(item => ({ get: () => item })),
      });

      const result = await adapter.getLearningPointsDue({
        token: validToken,
        date: '2024-01-15',
        limit: 50,
        domainTypes: ['vocabulary'],
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should filter by item types', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.getLearningPointsDue({
        token: validToken,
        itemTypes: ['word', 'concept'],
      });

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('itemType'),
        expect.objectContaining({ itemTypes: ['word', 'concept'] })
      );
    });

    it('should filter by plan ID', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.getLearningPointsDue({
        token: validToken,
        planId: 'plan_123',
      });

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('planId'),
        expect.any(Object)
      );
    });

    it('should return empty array for invalid token', async () => {
      const result = await adapter.getLearningPointsDue({ token: 'invalid-token' });

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // getLearningPointsBySource
  // ===========================================================================

  describe('getLearningPointsBySource', () => {
    it('should get points by source type and ID', async () => {
      mockSession.run.mockResolvedValue({
        records: [
          { get: () => ({ properties: { id: 'lp_1', sourceType: 'book', sourceId: 'book_1' } }) },
        ],
      });

      const result = await adapter.getLearningPointsBySource('book', 'book_1', validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('sourceType'),
        expect.objectContaining({ sourceType: 'book', sourceId: 'book_1' })
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array for invalid token', async () => {
      const result = await adapter.getLearningPointsBySource('book', 'book_1', 'invalid-token');

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // getLearningPointsByPlan
  // ===========================================================================

  describe('getLearningPointsByPlan', () => {
    it('should get points by plan ID', async () => {
      mockSession.run.mockResolvedValue({
        records: [
          { get: () => ({ properties: { id: 'lp_1', planId: 'plan_123' } }) },
          { get: () => ({ properties: { id: 'lp_2', planId: 'plan_123' } }) },
        ],
      });

      const result = await adapter.getLearningPointsByPlan('plan_123', validToken);

      expect(result).toHaveLength(2);
    });
  });

  // ===========================================================================
  // searchLearningPoints
  // ===========================================================================

  describe('searchLearningPoints', () => {
    it('should search by query string', async () => {
      mockSession.run.mockResolvedValue({
        records: [
          { get: () => ({ properties: { id: 'lp_1', title: 'Ephemeral' } }) },
        ],
      });

      const result = await adapter.searchLearningPoints('ephem', validToken, { limit: 10 });

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CONTAINS'),
        expect.objectContaining({ query: expect.any(String) })
      );
      expect(result).toHaveLength(1);
    });

    it('should filter by domain type', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.searchLearningPoints('test', validToken, { domainType: 'vocabulary' });

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('domainType'),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // processLearningPointReview
  // ===========================================================================

  describe('processLearningPointReview', () => {
    it('should update SR state on GOOD rating', async () => {
      const currentState = { id: 'lp_123', box: 2, easeFactor: 2.5 };
      mockSession.run
        .mockResolvedValueOnce({
          records: [{ get: () => ({ properties: currentState }) }],
        })
        .mockResolvedValueOnce({
          records: [{ get: () => ({ properties: { ...currentState, box: 3 } }) }],
        });

      const result = await adapter.processLearningPointReview('lp_123', 3, 2000, validToken);

      expect(result.success).toBe(true);
      expect(result.newBox).toBe(3);
    });

    it('should reset to box 1 on AGAIN rating', async () => {
      const currentState = { id: 'lp_123', box: 3 };
      mockSession.run
        .mockResolvedValueOnce({
          records: [{ get: () => ({ properties: currentState }) }],
        })
        .mockResolvedValueOnce({
          records: [{ get: () => ({ properties: { box: 1 } }) }],
        });

      const result = await adapter.processLearningPointReview('lp_123', 1, 5000, validToken);

      expect(result.newBox).toBe(1);
    });

    it('should skip a box on EASY rating', async () => {
      const currentState = { id: 'lp_123', box: 2 };
      mockSession.run
        .mockResolvedValueOnce({
          records: [{ get: () => ({ properties: currentState }) }],
        })
        .mockResolvedValueOnce({
          records: [{ get: () => ({ properties: { box: 4 } }) }],
        });

      const result = await adapter.processLearningPointReview('lp_123', 4, 1000, validToken);

      expect(result.newBox).toBe(4);
    });

    it('should return error for non-existent point', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await adapter.processLearningPointReview('nonexistent', 3, 2000, validToken);

      expect(result).toHaveProperty('error');
    });

    it('should return error for invalid token', async () => {
      const result = await adapter.processLearningPointReview('lp_123', 3, 2000, 'invalid-token');

      expect(result).toHaveProperty('error');
    });
  });

  // ===========================================================================
  // resetLearningPoint
  // ===========================================================================

  describe('resetLearningPoint', () => {
    it('should reset to box 1', async () => {
      mockSession.run.mockResolvedValue({
        summary: { counters: { propertiesSet: 5 } },
      });

      const result = await adapter.resetLearningPoint('lp_123', validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('lp.box = 1'),
        expect.any(Object)
      );
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const result = await adapter.resetLearningPoint('lp_123', 'invalid-token');

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // getLearningPointStats
  // ===========================================================================

  describe('getLearningPointStats', () => {
    it('should return statistics', async () => {
      // First query: main stats
      mockSession.run
        .mockResolvedValueOnce({
          records: [{
            get: (key) => {
              const data = {
                total: 100,
                mastered: 20,
                dueToday: 15,
                totalCorrect: 200,
                totalIncorrect: 50,
                totalReviews: 250,
                domains: ['vocabulary', 'knowledge'],
                itemTypes: ['word', 'concept'],
              };
              return data[key];
            },
          }],
        })
        // Second query: box distribution
        .mockResolvedValueOnce({
          records: [
            { get: (k) => k === 'box' ? 1 : 30 },
            { get: (k) => k === 'box' ? 2 : 25 },
            { get: (k) => k === 'box' ? 3 : 15 },
            { get: (k) => k === 'box' ? 4 : 10 },
            { get: (k) => k === 'box' ? 5 : 20 },
          ],
        })
        // Third query: domain distribution
        .mockResolvedValueOnce({
          records: [
            { get: (k) => k === 'domain' ? 'vocabulary' : 60 },
            { get: (k) => k === 'domain' ? 'knowledge' : 40 },
          ],
        })
        // Fourth query: type distribution
        .mockResolvedValueOnce({
          records: [
            { get: (k) => k === 'type' ? 'word' : 50 },
            { get: (k) => k === 'type' ? 'concept' : 50 },
          ],
        });

      const result = await adapter.getLearningPointStats(validToken);

      expect(result.total).toBe(100);
      expect(result.mastered).toBe(20);
      expect(result.byBox).toHaveProperty('1');
    });

    it('should filter by plan ID', async () => {
      mockSession.run
        .mockResolvedValueOnce({ records: [{ get: () => 0 }] })
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] });

      await adapter.getLearningPointStats(validToken, { planId: 'plan_123' });

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('planId'),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // getLearningPointForecast
  // ===========================================================================

  describe('getLearningPointForecast', () => {
    it('should return daily forecast', async () => {
      mockSession.run.mockResolvedValue({
        records: [
          { get: (k) => k === 'reviewDate' ? '2024-01-15' : 5 },
          { get: (k) => k === 'reviewDate' ? '2024-01-16' : 10 },
        ],
      });

      const result = await adapter.getLearningPointForecast(validToken, 7);

      expect(result).toHaveProperty('2024-01-15', 5);
      expect(result).toHaveProperty('2024-01-16', 10);
    });

    it('should return empty object for invalid token', async () => {
      const result = await adapter.getLearningPointForecast('invalid-token', 7);

      expect(result).toEqual({});
    });
  });
});
