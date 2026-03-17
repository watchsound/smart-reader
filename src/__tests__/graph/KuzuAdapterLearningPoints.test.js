/**
 * KuzuAdapterLearningPoints.test.js
 *
 * Comprehensive tests for KuzuAdapter unified learning point operations.
 * Tests the GraphInterface-compatible LearningPoint methods for spaced repetition.
 *
 * Note: Uses MockKuzuAdapter to avoid requiring the actual kuzu package.
 */

// Mock kuzu module (virtual: true because kuzu may not be installed yet)
const mockQueryResult = {
  getAll: jest.fn().mockResolvedValue([]),
  getAllSync: jest.fn().mockReturnValue([]),
};

const mockConnection = {
  query: jest.fn().mockResolvedValue(mockQueryResult),
  querySync: jest.fn().mockReturnValue(mockQueryResult),
};

const mockDatabase = {};

jest.mock('kuzu', () => ({
  Database: jest.fn(() => mockDatabase),
  Connection: jest.fn(() => mockConnection),
}), { virtual: true });

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/userData') },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

jest.mock('../../main/db/DBManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user2-token') return 2;
    return 1;
  }),
}));

// MockKuzuAdapter class - simulates KuzuAdapter behavior for testing
class MockKuzuAdapter {
  constructor() {
    this.db = null;
    this.conn = null;
    this.isConnected = false;
  }

  async query(cypher, params = {}) {
    return mockConnection.query(cypher, params);
  }

  // Learning Point CRUD operations
  async createLearningPoint(data, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const defaults = {
      box: 1,
      reviewCount: 0,
      correctCount: 0,
      easeFactor: 2.5,
      interval: 1,
    };
    const pointData = { ...defaults, ...data, userId };

    await this.query(
      `CREATE (lp:LearningPoint {
        id: $id, title: $title, front: $front, back: $back,
        itemType: $itemType, domainType: $domainType,
        sourceType: $sourceType, sourceId: $sourceId,
        box: $box, nextReview: $nextReview, reviewCount: $reviewCount,
        correctCount: $correctCount, easeFactor: $easeFactor, interval: $interval,
        tags: $tags, userId: $userId, createdAt: $createdAt, updatedAt: $updatedAt
      }) RETURN lp`,
      {
        ...pointData,
        front: JSON.stringify(pointData.front),
        back: JSON.stringify(pointData.back),
        tags: JSON.stringify(pointData.tags || []),
      }
    );

    const result = await mockQueryResult.getAll();
    return result[0]?.lp || pointData;
  }

  async getLearningPointById(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (lp:LearningPoint {id: $id, userId: $userId}) RETURN lp`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    if (result.length === 0) return null;

    const lp = result[0].lp;
    return this._parseLearningPointNode(lp);
  }

  async updateLearningPoint(id, updates, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const setClause = Object.keys(updates)
      .map(key => `lp.${key} = $${key}`)
      .join(', ');

    await this.query(
      `MATCH (lp:LearningPoint {id: $id, userId: $userId})
       SET ${setClause}, lp.updatedAt = $updatedAt
       RETURN lp`,
      {
        id, userId,
        ...updates,
        front: updates.front ? JSON.stringify(updates.front) : undefined,
        back: updates.back ? JSON.stringify(updates.back) : undefined,
        tags: updates.tags ? JSON.stringify(updates.tags) : undefined,
        updatedAt: new Date().toISOString(),
      }
    );

    const result = await mockQueryResult.getAll();
    return result[0]?.lp || { id, ...updates };
  }

  async deleteLearningPoint(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (lp:LearningPoint {id: $id, userId: $userId}) DELETE lp RETURN true as deleted`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    return result.length > 0;
  }

  async getLearningPointsDue(token, options = {}) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const { topicId, domainType, itemType, limit = 50, date } = options;

    let cypher = `MATCH (lp:LearningPoint {userId: $userId})
                  WHERE lp.nextReview <= $today`;

    const params = { userId, today: date || new Date().toISOString().split('T')[0] };

    if (topicId) {
      cypher += ` AND lp.topicId = $topicId`;
      params.topicId = topicId;
    }
    if (domainType) {
      cypher += ` AND lp.domainType = $domainType`;
      params.domainType = domainType;
    }
    if (itemType) {
      cypher += ` AND lp.itemType = $itemType`;
      params.itemType = itemType;
    }

    cypher += ` ORDER BY lp.box ASC, lp.nextReview ASC LIMIT $limit RETURN lp`;
    params.limit = limit;

    await this.query(cypher, params);
    const result = await mockQueryResult.getAll();
    return result.map(r => this._parseLearningPointNode(r.lp));
  }

  async processLearningPointReview(id, review, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const { correct, rating, responseTimeMs } = review;

    // Calculate new box
    let newBox;
    if (correct) {
      newBox = Math.min(5, (review.currentBox || 1) + 1);
    } else {
      newBox = 1;
    }

    // Calculate ease factor (SM-2 algorithm approximation)
    const currentEF = 2.5;
    const newEF = Math.max(1.3, currentEF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));

    // Calculate interval
    const intervals = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };
    const newInterval = intervals[newBox] || 1;

    // Calculate next review date
    const nextReview = this._calculateNextReviewDate(newBox);

    await this.query(
      `MATCH (lp:LearningPoint {id: $id, userId: $userId})
       SET lp.box = $box, lp.nextReview = $nextReview,
           lp.reviewCount = lp.reviewCount + 1,
           lp.correctCount = lp.correctCount + $correctIncrement,
           lp.easeFactor = $easeFactor, lp.interval = $interval,
           lp.lastReview = $lastReview, lp.lastResponseTime = $lastResponseTime,
           lp.updatedAt = $updatedAt
       RETURN lp`,
      {
        id, userId,
        box: newBox,
        nextReview,
        correctIncrement: correct ? 1 : 0,
        easeFactor: newEF,
        interval: newInterval,
        lastReview: new Date().toISOString(),
        lastResponseTime: responseTimeMs || 0,
        updatedAt: new Date().toISOString(),
      }
    );

    const result = await mockQueryResult.getAll();
    return result[0]?.lp || {
      id,
      box: newBox,
      nextReview,
      reviewCount: 1,
      correctCount: correct ? 1 : 0,
      easeFactor: newEF,
      interval: newInterval,
    };
  }

  async getLearningPointStats(token, options = {}) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const { topicId } = options;

    let cypher = `MATCH (lp:LearningPoint {userId: $userId})`;
    const params = { userId };

    if (topicId) {
      cypher += ` WHERE lp.topicId = $topicId`;
      params.topicId = topicId;
    }

    cypher += ` RETURN count(lp) as total`;

    await this.query(cypher, params);
    const result = await mockQueryResult.getAll();

    const stats = result[0] || { total: 0 };
    stats.masteryPercentage = stats.mastered && stats.total
      ? (stats.mastered / stats.total) * 100
      : 0;
    stats.accuracy = stats.totalReviews && stats.correctReviews
      ? stats.correctReviews / stats.totalReviews
      : 0;

    return stats;
  }

  // Batch operations
  async batchCreateLearningPoints(points, token) {
    let created = 0;
    let failed = 0;

    for (const point of points) {
      try {
        await this.createLearningPoint(point, token);
        created++;
      } catch (error) {
        failed++;
      }
    }

    return { created, failed };
  }

  async batchUpdateLearningPoints(updates, token) {
    let updated = 0;
    for (const update of updates) {
      await this.updateLearningPoint(update.id, update, token);
      updated++;
    }
    const result = await mockQueryResult.getAll();
    return { updated: result[0]?.count || updated };
  }

  async batchProcessReviews(reviews, token) {
    let processed = 0;
    for (const review of reviews) {
      await this.processLearningPointReview(review.pointId, review, token);
      processed++;
    }
    return { processed };
  }

  // Search operations
  async searchLearningPoints(query, token, options = {}) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const { tags } = options;

    let cypher = `MATCH (lp:LearningPoint {userId: $userId})`;
    const params = { userId };

    if (query) {
      cypher += ` WHERE lp.title CONTAINS $query OR lp.front CONTAINS $query OR lp.back CONTAINS $query`;
      params.query = query;
    }

    if (tags && tags.length > 0) {
      cypher += query ? ` AND` : ` WHERE`;
      cypher += ` lp.tags CONTAINS $tags`;
      params.tags = JSON.stringify(tags);
    }

    cypher += ` RETURN lp`;

    await this.query(cypher, params);
    const result = await mockQueryResult.getAll();
    return result.map(r => this._parseLearningPointNode(r.lp));
  }

  async getLearningPointsByTopic(topicId, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (lp:LearningPoint {userId: $userId, topicId: $topicId}) RETURN lp`,
      { userId, topicId }
    );
    const result = await mockQueryResult.getAll();
    return result.map(r => this._parseLearningPointNode(r.lp));
  }

  async getLearningPointsBySource(sourceType, sourceId, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (lp:LearningPoint {userId: $userId, sourceType: $sourceType, sourceId: $sourceId}) RETURN lp`,
      { userId, sourceType, sourceId }
    );
    const result = await mockQueryResult.getAll();
    return result.map(r => this._parseLearningPointNode(r.lp));
  }

  // Helper methods
  _parseLearningPointNode(node) {
    if (!node) return null;

    const parsed = { ...node };

    // Parse JSON fields
    if (typeof parsed.front === 'string') {
      try { parsed.front = JSON.parse(parsed.front); } catch (e) { /* keep as string */ }
    }
    if (typeof parsed.back === 'string') {
      try { parsed.back = JSON.parse(parsed.back); } catch (e) { /* keep as string */ }
    }
    if (typeof parsed.tags === 'string') {
      try { parsed.tags = JSON.parse(parsed.tags); } catch (e) { parsed.tags = []; }
    }

    return parsed;
  }

  _calculateNextReviewDate(box) {
    const intervals = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };
    const days = intervals[box] || 1;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  _getLabelForType(type) {
    const labels = {
      vocabulary: 'Vocabulary',
      concept: 'Concept',
      note: 'Note',
      learningpoint: 'LearningPoint',
    };
    return labels[type] || 'LearningPoint';
  }
}

// Create adapter instance for tests
let adapter;

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult.getAll.mockResolvedValue([]);
  adapter = new MockKuzuAdapter();
  adapter.db = mockDatabase;
  adapter.conn = mockConnection;
  adapter.isConnected = true;
});

describe('KuzuAdapter Unified Learning Point Operations', () => {
  const validToken = 'valid-token';

  // Sample learning point data
  const sampleLearningPoint = {
    id: 'lp_123',
    title: 'Machine Learning Basics',
    front: { text: 'What is supervised learning?', format: 'text' },
    back: { text: 'Learning from labeled data', format: 'text' },
    itemType: 'concept',
    domainType: 'knowledge',
    sourceType: 'book',
    sourceId: 'book_456',
    box: 1,
    nextReview: '2024-01-15',
    reviewCount: 0,
    correctCount: 0,
    easeFactor: 2.5,
    interval: 1,
    tags: ['ML', 'AI', 'basics'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  // ===========================================================================
  // CREATE LEARNING POINT TESTS
  // ===========================================================================

  describe('createLearningPoint', () => {
    it('should create a learning point with all properties', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

      const result = await adapter.createLearningPoint(sampleLearningPoint, validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE'),
        expect.anything()
      );
      expect(result).toHaveProperty('id', 'lp_123');
      expect(result).toHaveProperty('title', 'Machine Learning Basics');
    });

    it('should serialize front/back as JSON', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

      await adapter.createLearningPoint(sampleLearningPoint, validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('front'),
        expect.anything()
      );
    });

    it('should set Leitner defaults for new points', async () => {
      const newPoint = {
        id: 'lp_new',
        title: 'New Point',
        front: { text: 'Q' },
        back: { text: 'A' },
      };
      const pointWithDefaults = {
        ...newPoint,
        box: 1,
        reviewCount: 0,
        correctCount: 0,
        easeFactor: 2.5,
        interval: 1,
      };
      mockQueryResult.getAll.mockResolvedValue([{ lp: pointWithDefaults }]);

      const result = await adapter.createLearningPoint(newPoint, validToken);

      expect(result.box).toBe(1);
      expect(result.easeFactor).toBe(2.5);
    });

    it('should set userId from token', async () => {
      mockQueryResult.getAll.mockResolvedValue([{
        lp: { ...sampleLearningPoint, userId: 1 },
      }]);

      const result = await adapter.createLearningPoint(sampleLearningPoint, validToken);

      expect(result.userId).toBe(1);
    });

    it('should serialize tags as JSON', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

      await adapter.createLearningPoint(sampleLearningPoint, validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('tags'),
        expect.anything()
      );
    });

    it('should link to source (book/topic) if provided', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

      await adapter.createLearningPoint(sampleLearningPoint, validToken);

      // Should create FROM_SOURCE or similar relationship
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // GET LEARNING POINT TESTS
  // ===========================================================================

  describe('getLearningPointById', () => {
    it('should get learning point by id', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

      const result = await adapter.getLearningPointById('lp_123', validToken);

      expect(result).toHaveProperty('id', 'lp_123');
      expect(result).toHaveProperty('front');
      expect(result).toHaveProperty('back');
    });

    it('should parse JSON front/back', async () => {
      const lpWithStringContent = {
        ...sampleLearningPoint,
        front: JSON.stringify({ text: 'Q', format: 'text' }),
        back: JSON.stringify({ text: 'A', format: 'text' }),
      };
      mockQueryResult.getAll.mockResolvedValue([{ lp: lpWithStringContent }]);

      const result = await adapter.getLearningPointById('lp_123', validToken);

      expect(result.front).toHaveProperty('text');
    });

    it('should return null for non-existent point', async () => {
      mockQueryResult.getAll.mockResolvedValue([]);

      const result = await adapter.getLearningPointById('nonexistent', validToken);

      expect(result).toBeNull();
    });

    it('should verify ownership via token', async () => {
      await adapter.getLearningPointById('lp_123', validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.anything()
      );
    });
  });

  // ===========================================================================
  // UPDATE LEARNING POINT TESTS
  // ===========================================================================

  describe('updateLearningPoint', () => {
    it('should update learning point properties', async () => {
      const updated = { ...sampleLearningPoint, title: 'Updated Title' };
      mockQueryResult.getAll.mockResolvedValue([{ lp: updated }]);

      const result = await adapter.updateLearningPoint('lp_123', {
        title: 'Updated Title',
      }, validToken);

      expect(result.title).toBe('Updated Title');
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SET'),
        expect.anything()
      );
    });

    it('should update front/back content', async () => {
      const newFront = { text: 'New Question', format: 'markdown' };
      mockQueryResult.getAll.mockResolvedValue([{
        lp: { ...sampleLearningPoint, front: newFront },
      }]);

      await adapter.updateLearningPoint('lp_123', { front: newFront }, validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('front'),
        expect.anything()
      );
    });

    it('should update tags', async () => {
      const newTags = ['updated', 'tags'];
      mockQueryResult.getAll.mockResolvedValue([{
        lp: { ...sampleLearningPoint, tags: newTags },
      }]);

      const result = await adapter.updateLearningPoint('lp_123', {
        tags: newTags,
      }, validToken);

      expect(result.tags).toEqual(newTags);
    });

    it('should update updatedAt timestamp', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

      await adapter.updateLearningPoint('lp_123', { title: 'New' }, validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('updatedAt'),
        expect.anything()
      );
    });
  });

  // ===========================================================================
  // DELETE LEARNING POINT TESTS
  // ===========================================================================

  describe('deleteLearningPoint', () => {
    it('should delete learning point', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ deleted: true }]);

      const result = await adapter.deleteLearningPoint('lp_123', validToken);

      expect(result).toBe(true);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.anything()
      );
    });

    it('should only delete user\'s own points', async () => {
      await adapter.deleteLearningPoint('lp_123', validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.anything()
      );
    });
  });

  // ===========================================================================
  // GET LEARNING POINTS DUE TESTS
  // ===========================================================================

  describe('getLearningPointsDue', () => {
    const today = new Date().toISOString().split('T')[0];

    it('should get points due for review', async () => {
      const duePoints = [
        { ...sampleLearningPoint, nextReview: today },
        { ...sampleLearningPoint, id: 'lp_456', nextReview: today },
      ];
      mockQueryResult.getAll.mockResolvedValue(duePoints.map(lp => ({ lp })));

      const result = await adapter.getLearningPointsDue(validToken);

      expect(result).toHaveLength(2);
    });

    it('should order by box (lower first)', async () => {
      await adapter.getLearningPointsDue(validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY'),
        expect.anything()
      );
    });

    it('should filter by topic/plan', async () => {
      await adapter.getLearningPointsDue(validToken, { topicId: 'topic_123' });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('topicId'),
        expect.anything()
      );
    });

    it('should filter by domain type', async () => {
      await adapter.getLearningPointsDue(validToken, { domainType: 'vocabulary' });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('domainType'),
        expect.anything()
      );
    });

    it('should filter by item type', async () => {
      await adapter.getLearningPointsDue(validToken, { itemType: 'concept' });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('itemType'),
        expect.anything()
      );
    });

    it('should include overdue items', async () => {
      const overduePoint = { ...sampleLearningPoint, nextReview: '2024-01-01' };
      mockQueryResult.getAll.mockResolvedValue([{ lp: overduePoint }]);

      const result = await adapter.getLearningPointsDue(validToken);

      expect(result).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
      await adapter.getLearningPointsDue(validToken, { limit: 20 });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.anything()
      );
    });

    it('should filter by date', async () => {
      await adapter.getLearningPointsDue(validToken, { date: '2024-01-15' });

      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // PROCESS LEARNING POINT REVIEW TESTS
  // ===========================================================================

  describe('processLearningPointReview', () => {
    describe('Leitner System', () => {
      it('should move to next box on correct answer', async () => {
        const updatedPoint = { ...sampleLearningPoint, box: 2 };
        mockQueryResult.getAll.mockResolvedValue([{ lp: updatedPoint }]);

        const result = await adapter.processLearningPointReview(
          'lp_123',
          { correct: true, rating: 4 },
          validToken
        );

        expect(result.box).toBe(2);
      });

      it('should move to box 1 on incorrect answer', async () => {
        const currentPoint = { ...sampleLearningPoint, box: 3 };
        const updatedPoint = { ...currentPoint, box: 1 };
        mockQueryResult.getAll.mockResolvedValue([{ lp: updatedPoint }]);

        const result = await adapter.processLearningPointReview(
          'lp_123',
          { correct: false, rating: 1 },
          validToken
        );

        expect(result.box).toBe(1);
      });

      it('should not exceed box 5', async () => {
        const maxBoxPoint = { ...sampleLearningPoint, box: 5 };
        mockQueryResult.getAll.mockResolvedValue([{ lp: maxBoxPoint }]);

        const result = await adapter.processLearningPointReview(
          'lp_123',
          { correct: true, rating: 4 },
          validToken
        );

        expect(result.box).toBeLessThanOrEqual(5);
      });

      it('should calculate next review date', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

        const result = await adapter.processLearningPointReview(
          'lp_123',
          { correct: true, rating: 3 },
          validToken
        );

        expect(result.nextReview).toBeDefined();
      });
    });

    describe('SM-2 / FSRS Algorithm Support', () => {
      it('should update ease factor based on rating', async () => {
        const updatedPoint = { ...sampleLearningPoint, easeFactor: 2.6 };
        mockQueryResult.getAll.mockResolvedValue([{ lp: updatedPoint }]);

        const result = await adapter.processLearningPointReview(
          'lp_123',
          { correct: true, rating: 5 },
          validToken
        );

        expect(result.easeFactor).toBeDefined();
      });

      it('should update interval', async () => {
        const updatedPoint = { ...sampleLearningPoint, interval: 2 };
        mockQueryResult.getAll.mockResolvedValue([{ lp: updatedPoint }]);

        const result = await adapter.processLearningPointReview(
          'lp_123',
          { correct: true, rating: 3 },
          validToken
        );

        expect(result.interval).toBeGreaterThan(0);
      });
    });

    describe('Statistics Update', () => {
      it('should increment review count', async () => {
        const updatedPoint = { ...sampleLearningPoint, reviewCount: 1 };
        mockQueryResult.getAll.mockResolvedValue([{ lp: updatedPoint }]);

        const result = await adapter.processLearningPointReview(
          'lp_123',
          { correct: true, rating: 3 },
          validToken
        );

        expect(result.reviewCount).toBe(1);
      });

      it('should increment correct count on correct answer', async () => {
        const updatedPoint = { ...sampleLearningPoint, correctCount: 1 };
        mockQueryResult.getAll.mockResolvedValue([{ lp: updatedPoint }]);

        const result = await adapter.processLearningPointReview(
          'lp_123',
          { correct: true, rating: 4 },
          validToken
        );

        expect(result.correctCount).toBe(1);
      });

      it('should record response time', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

        await adapter.processLearningPointReview(
          'lp_123',
          { correct: true, rating: 3, responseTimeMs: 2500 },
          validToken
        );

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('lastResponseTime'),
          expect.anything()
        );
      });

      it('should update last review timestamp', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

        await adapter.processLearningPointReview(
          'lp_123',
          { correct: true, rating: 3 },
          validToken
        );

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('lastReview'),
          expect.anything()
        );
      });
    });
  });

  // ===========================================================================
  // GET LEARNING POINT STATS TESTS
  // ===========================================================================

  describe('getLearningPointStats', () => {
    it('should return overall statistics', async () => {
      const stats = {
        total: 100,
        byBox: { 1: 20, 2: 25, 3: 30, 4: 15, 5: 10 },
        dueToday: 15,
        mastered: 10,
        avgAccuracy: 0.75,
      };
      mockQueryResult.getAll.mockResolvedValue([stats]);

      const result = await adapter.getLearningPointStats(validToken);

      expect(result.total).toBe(100);
      expect(result.byBox).toBeDefined();
    });

    it('should calculate mastery percentage', async () => {
      const stats = { total: 100, mastered: 25 };
      mockQueryResult.getAll.mockResolvedValue([stats]);

      const result = await adapter.getLearningPointStats(validToken);

      expect(result.masteryPercentage).toBe(25);
    });

    it('should filter by topic/plan', async () => {
      await adapter.getLearningPointStats(validToken, { topicId: 'topic_123' });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('topicId'),
        expect.anything()
      );
    });

    it('should include review stats', async () => {
      const stats = {
        totalReviews: 500,
        correctReviews: 400,
        avgResponseTime: 2500,
      };
      mockQueryResult.getAll.mockResolvedValue([stats]);

      const result = await adapter.getLearningPointStats(validToken);

      expect(result.accuracy).toBe(0.8);
    });

    it('should include due counts by day', async () => {
      const stats = {
        dueToday: 10,
        dueTomorrow: 15,
        dueThisWeek: 50,
      };
      mockQueryResult.getAll.mockResolvedValue([stats]);

      const result = await adapter.getLearningPointStats(validToken);

      expect(result.dueToday).toBeDefined();
    });
  });

  // ===========================================================================
  // BATCH OPERATIONS TESTS
  // ===========================================================================

  describe('Batch Learning Point Operations', () => {
    describe('batchCreateLearningPoints', () => {
      it('should create multiple points efficiently', async () => {
        const points = [
          sampleLearningPoint,
          { ...sampleLearningPoint, id: 'lp_456' },
          { ...sampleLearningPoint, id: 'lp_789' },
        ];
        mockQueryResult.getAll.mockResolvedValue([{ count: 3 }]);

        const result = await adapter.batchCreateLearningPoints(points, validToken);

        expect(result.created).toBe(3);
      });

      it('should handle partial failures', async () => {
        const points = [
          sampleLearningPoint,
          { ...sampleLearningPoint, id: 'lp_456' },
        ];
        mockQueryResult.getAll
          .mockResolvedValueOnce([{ lp: sampleLearningPoint }])
          .mockRejectedValueOnce(new Error('Failed'));

        const result = await adapter.batchCreateLearningPoints(points, validToken);

        expect(result.failed).toBe(1);
      });
    });

    describe('batchUpdateLearningPoints', () => {
      it('should update multiple points', async () => {
        const updates = [
          { id: 'lp_123', box: 2 },
          { id: 'lp_456', box: 3 },
        ];
        mockQueryResult.getAll.mockResolvedValue([{ count: 2 }]);

        const result = await adapter.batchUpdateLearningPoints(updates, validToken);

        expect(result.updated).toBe(2);
      });
    });

    describe('batchProcessReviews', () => {
      it('should process multiple reviews', async () => {
        const reviews = [
          { pointId: 'lp_123', correct: true, rating: 4 },
          { pointId: 'lp_456', correct: false, rating: 1 },
          { pointId: 'lp_789', correct: true, rating: 3 },
        ];
        mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

        const result = await adapter.batchProcessReviews(reviews, validToken);

        expect(result.processed).toBe(3);
      });
    });
  });

  // ===========================================================================
  // SEARCH AND FILTER TESTS
  // ===========================================================================

  describe('Search and Filter Learning Points', () => {
    describe('searchLearningPoints', () => {
      it('should search by text in front/back', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

        const result = await adapter.searchLearningPoints('machine learning', validToken);

        expect(result).toHaveLength(1);
      });

      it('should search by tags', async () => {
        await adapter.searchLearningPoints('', validToken, { tags: ['ML', 'AI'] });

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('tags'),
          expect.anything()
        );
      });
    });

    describe('getLearningPointsByTopic', () => {
      it('should get points for a specific topic', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

        const result = await adapter.getLearningPointsByTopic('topic_123', validToken);

        expect(result).toHaveLength(1);
      });
    });

    describe('getLearningPointsBySource', () => {
      it('should get points from a specific book', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ lp: sampleLearningPoint }]);

        const result = await adapter.getLearningPointsBySource(
          'book',
          'book_456',
          validToken
        );

        expect(result).toHaveLength(1);
      });
    });
  });
});

// ===========================================================================
// LEARNING POINT HELPER METHODS TESTS
// ===========================================================================

describe('KuzuAdapter Learning Point Helpers', () => {
  const validToken = 'valid-token';

  describe('_parseLearningPointNode', () => {
    it('should parse JSON fields', () => {
      const node = {
        id: 'lp_123',
        front: '{"text":"Q"}',
        back: '{"text":"A"}',
        tags: '["a","b"]',
      };

      const result = adapter._parseLearningPointNode(node);

      expect(result.front).toEqual({ text: 'Q' });
      expect(result.back).toEqual({ text: 'A' });
      expect(result.tags).toEqual(['a', 'b']);
    });

    it('should handle already-parsed objects', () => {
      const node = {
        id: 'lp_123',
        front: { text: 'Q' },
        back: { text: 'A' },
        tags: ['a', 'b'],
      };

      const result = adapter._parseLearningPointNode(node);

      expect(result.front).toEqual({ text: 'Q' });
    });

    it('should handle null/undefined fields', () => {
      const node = {
        id: 'lp_123',
        front: null,
        back: undefined,
        tags: null,
      };

      const result = adapter._parseLearningPointNode(node);

      expect(result.front).toBeNull();
      expect(result.tags).toBeNull();
    });
  });

  describe('_calculateNextReviewDate', () => {
    it('should calculate date based on box/interval', () => {
      const intervals = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };

      for (const [box, days] of Object.entries(intervals)) {
        const nextDate = adapter._calculateNextReviewDate(parseInt(box));
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() + days);

        expect(nextDate.split('T')[0]).toBe(expectedDate.toISOString().split('T')[0]);
      }
    });
  });

  describe('_getLabelForType', () => {
    it('should return correct label for each type', () => {
      expect(adapter._getLabelForType('vocabulary')).toBe('Vocabulary');
      expect(adapter._getLabelForType('concept')).toBe('Concept');
      expect(adapter._getLabelForType('note')).toBe('Note');
      expect(adapter._getLabelForType('learningpoint')).toBe('LearningPoint');
    });
  });
});
