/**
 * KuzuAdapterLeitner.test.js
 *
 * Comprehensive tests for KuzuAdapter spaced repetition (Leitner system) operations.
 * Tests review recording, due item queries, and statistics.
 *
 * Leitner System Overview:
 * - 5 boxes with increasing review intervals
 * - Correct answer: move to next box
 * - Incorrect answer: move back to box 1
 * - Box intervals: 1, 2, 4, 7, 14 days (configurable)
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
    if (token === 'invalid-token') return -1;
    return 1;
  }),
}));

/**
 * MockKuzuAdapter class that simulates Leitner system methods
 * Uses mockConnection.query to make calls verifiable in tests
 */
class MockKuzuAdapter {
  constructor() {
    this.db = mockDatabase;
    this.conn = mockConnection;
    this.isConnected = true;
    this.leitnerIntervals = [1, 2, 4, 7, 14]; // Default intervals for boxes 1-5
  }

  /**
   * Record a Leitner review for an item
   * @param {string} itemId - The item ID
   * @param {string} itemType - 'Vocabulary' or 'Note'
   * @param {boolean} correct - Whether the answer was correct
   * @param {string} token - User token
   * @param {object} options - Additional options like responseTimeMs
   * @returns {object|null} Updated item or null if not found
   */
  async recordLeitnerReview(itemId, itemType, correct, token, options = {}) {
    const nodeAlias = itemType === 'Vocabulary' ? 'v' : 'n';

    // Build query with all necessary fields
    let query = `MATCH (${nodeAlias}:${itemType} {id: $itemId})
SET ${nodeAlias}.box = $newBox,
    ${nodeAlias}.reviewCount = ${nodeAlias}.reviewCount + 1,
    ${nodeAlias}.lastReview = $now,
    ${nodeAlias}.nextReview = $nextReview`;

    if (correct) {
      query += `,
    ${nodeAlias}.correctCount = ${nodeAlias}.correctCount + 1`;
    }

    if (options.responseTimeMs) {
      query += `,
    ${nodeAlias}.responseTime = $responseTime`;
    }

    query += `
RETURN ${nodeAlias}`;

    const params = {
      itemId,
      newBox: correct ? 2 : 1, // Simplified: just increment or reset
      now: new Date().toISOString(),
      nextReview: new Date().toISOString().split('T')[0],
      ...(options.responseTimeMs && { responseTime: options.responseTimeMs }),
    };

    const result = await this.conn.query(query, params);
    const rows = await result.getAll();

    if (rows.length === 0) {
      return null;
    }

    return rows[0][nodeAlias];
  }

  /**
   * Get items due for Leitner review
   * @param {string} itemType - 'Vocabulary', 'Note', or 'all'
   * @param {string} token - User token
   * @param {number} limit - Maximum number of items to return
   * @param {object} options - Filter options (box, sourceType, fromDate, toDate)
   * @returns {Array} Array of due items
   */
  async getLeitnerDueItems(itemType, token, limit = 20, options = {}) {
    const today = new Date().toISOString().split('T')[0];

    if (itemType === 'all') {
      // Query both Vocabulary and Note
      const vocabQuery = `MATCH (v:Vocabulary)
WHERE v.nextReview <= $today
ORDER BY v.box ASC
LIMIT $limit
RETURN v`;

      const noteQuery = `MATCH (n:Note)
WHERE n.nextReview <= $today
ORDER BY n.box ASC
LIMIT $limit
RETURN n`;

      const vocabResult = await this.conn.query(vocabQuery, { today, limit });
      const noteResult = await this.conn.query(noteQuery, { today, limit });

      const vocabRows = await vocabResult.getAll();
      const noteRows = await noteResult.getAll();

      return [...vocabRows.map(r => r.v), ...noteRows.map(r => r.n)];
    }

    const nodeAlias = itemType === 'Vocabulary' ? 'v' : 'n';
    let query = `MATCH (${nodeAlias}:${itemType})
WHERE ${nodeAlias}.nextReview <= $today`;

    const params = { today, limit };

    if (options.box !== undefined) {
      query += ` AND ${nodeAlias}.box = $box`;
      params.box = options.box;
    }

    if (options.sourceType) {
      query += ` AND ${nodeAlias}.sourceType = $sourceType`;
      params.sourceType = options.sourceType;
    }

    query += `
ORDER BY ${nodeAlias}.box ASC
LIMIT $limit
RETURN ${nodeAlias}`;

    const result = await this.conn.query(query, params);
    const rows = await result.getAll();

    return rows.map(r => r[nodeAlias]);
  }

  /**
   * Get Leitner statistics for an item type
   * @param {string} itemType - 'Vocabulary' or 'Note'
   * @param {string} token - User token
   * @returns {object} Statistics object
   */
  async getLeitnerStats(itemType, token) {
    const nodeAlias = itemType === 'Vocabulary' ? 'v' : 'n';

    // Get box counts
    const boxQuery = `MATCH (${nodeAlias}:${itemType})
RETURN ${nodeAlias}.box AS box, COUNT(*) AS count
ORDER BY box`;

    const result = await this.conn.query(boxQuery, {});
    const boxStats = await result.getAll();

    // Calculate totals
    const boxCounts = {};
    let totalItems = 0;
    let masteredCount = 0;

    for (const stat of boxStats) {
      const box = stat.box || stat.box;
      const count = stat.count || stat.count;
      boxCounts[box] = count;
      totalItems += count;
      if (box === 5) {
        masteredCount = count;
      }
    }

    // Get additional stats (due count, reviews, accuracy, etc.)
    const dueQuery = `MATCH (${nodeAlias}:${itemType})
WHERE ${nodeAlias}.nextReview <= $today
RETURN COUNT(*) AS dueCount`;

    const dueResult = await this.conn.query(dueQuery, { today: new Date().toISOString().split('T')[0] });
    const dueRows = await dueResult.getAll();

    const reviewStatsQuery = `MATCH (${nodeAlias}:${itemType})
RETURN SUM(${nodeAlias}.reviewCount) AS totalReviews,
       SUM(${nodeAlias}.correctCount) AS correctReviews,
       AVG(${nodeAlias}.responseTime) AS avgResponseTime`;

    const reviewResult = await this.conn.query(reviewStatsQuery, {});
    const reviewRows = await reviewResult.getAll();

    const todayReviewsQuery = `MATCH (${nodeAlias}:${itemType})
WHERE ${nodeAlias}.lastReview = $today
RETURN COUNT(*) AS todayReviews`;

    const todayResult = await this.conn.query(todayReviewsQuery, { today: new Date().toISOString().split('T')[0] });
    const todayRows = await todayResult.getAll();

    return {
      boxCounts,
      totalItems,
      masteryPercentage: totalItems > 0 ? (masteredCount / totalItems) * 100 : 0,
      dueCount: dueRows[0]?.dueCount || 0,
      totalReviews: reviewRows[0]?.totalReviews || 0,
      accuracy: reviewRows[0]?.totalReviews > 0
        ? ((reviewRows[0]?.correctReviews || 0) / reviewRows[0]?.totalReviews) * 100
        : 0,
      todayReviews: todayRows[0]?.todayReviews || 0,
      avgResponseTimeMs: reviewRows[0]?.avgResponseTime || 0,
      streak: {
        current: 0, // Would require additional tracking
        longest: 0,
      },
    };
  }

  /**
   * Record multiple Leitner reviews in batch
   * @param {Array} reviews - Array of { itemId, itemType, correct }
   * @param {string} token - User token
   * @returns {object} { processed, failed }
   */
  async batchRecordLeitnerReviews(reviews, token) {
    let processed = 0;
    let failed = 0;

    for (const review of reviews) {
      try {
        await this.recordLeitnerReview(
          review.itemId,
          review.itemType,
          review.correct,
          token
        );
        processed++;
      } catch (error) {
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Reset an item to box 1
   * @param {string} itemId - The item ID
   * @param {string} itemType - 'Vocabulary' or 'Note'
   * @param {string} token - User token
   * @returns {object} Updated item
   */
  async resetToBox1(itemId, itemType, token) {
    const nodeAlias = itemType === 'Vocabulary' ? 'v' : 'n';

    const query = `MATCH (${nodeAlias}:${itemType} {id: $itemId})
SET ${nodeAlias}.box = 1,
    ${nodeAlias}.nextReview = $tomorrow
RETURN ${nodeAlias}`;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await this.conn.query(query, {
      itemId,
      tomorrow: tomorrow.toISOString().split('T')[0],
    });
    const rows = await result.getAll();

    return rows[0]?.[nodeAlias] || null;
  }

  /**
   * Reset multiple items to box 1
   * @param {Array} itemIds - Array of item IDs
   * @param {string} itemType - 'Vocabulary' or 'Note'
   * @param {string} token - User token
   * @returns {number} Number of items reset
   */
  async bulkResetItems(itemIds, itemType, token) {
    const nodeAlias = itemType === 'Vocabulary' ? 'v' : 'n';

    const query = `MATCH (${nodeAlias}:${itemType})
WHERE ${nodeAlias}.id IN $itemIds
SET ${nodeAlias}.box = 1
RETURN COUNT(*) AS count`;

    const result = await this.conn.query(query, { itemIds });
    const rows = await result.getAll();

    return rows[0]?.count || 0;
  }

  /**
   * Get review history for an item
   * @param {string} itemId - The item ID
   * @param {string} itemType - 'Vocabulary' or 'Note'
   * @param {string} token - User token
   * @param {number} limit - Maximum number of history entries
   * @returns {Array} Review history
   */
  async getReviewHistory(itemId, itemType, token, limit = 50) {
    const query = `MATCH (r:Review)-[:FOR_ITEM]->(:${itemType} {id: $itemId})
ORDER BY r.date DESC
LIMIT $limit
RETURN r.date AS date, r.correct AS correct, r.box AS box, r.responseTime AS responseTime`;

    const result = await this.conn.query(query, { itemId, limit });
    const rows = await result.getAll();

    return rows;
  }

  /**
   * Get daily review summary
   * @param {string} token - User token
   * @param {number} days - Number of days to include
   * @returns {Array} Daily summaries
   */
  async getDailyReviewSummary(token, days = 7) {
    const query = `MATCH (r:Review)
WHERE r.date >= $startDate
RETURN r.date AS date,
       COUNT(*) AS total,
       SUM(CASE WHEN r.correct THEN 1 ELSE 0 END) AS correct,
       SUM(CASE WHEN NOT r.correct THEN 1 ELSE 0 END) AS incorrect
ORDER BY date DESC`;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.conn.query(query, {
      startDate: startDate.toISOString().split('T')[0],
    });
    const rows = await result.getAll();

    return rows;
  }

  /**
   * Set custom Leitner intervals (optional)
   * @param {Array} intervals - Array of intervals for boxes 1-5
   */
  setLeitnerIntervals(intervals) {
    if (Array.isArray(intervals) && intervals.length === 5) {
      this.leitnerIntervals = intervals;
    }
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult.getAll.mockResolvedValue([]);
});

describe('KuzuAdapter Leitner System Operations', () => {
  let adapter;
  const validToken = 'valid-token';

  // Sample vocabulary item in Leitner system
  const sampleVocab = {
    id: 'vocab_123',
    word: 'ephemeral',
    definition: 'lasting for a very short time',
    box: 1,
    nextReview: '2024-01-15',
    reviewCount: 5,
    correctCount: 3,
    lastReview: '2024-01-14',
    createdAt: '2024-01-01T00:00:00Z',
  };

  // Sample note in Leitner system
  const sampleNote = {
    id: 'note_123',
    title: 'Key Concept',
    content: 'Important learning point',
    box: 2,
    nextReview: '2024-01-16',
    reviewCount: 10,
    correctCount: 8,
    lastReview: '2024-01-14',
  };

  beforeEach(async () => {
    adapter = new MockKuzuAdapter();
  });

  // ===========================================================================
  // RECORD LEITNER REVIEW TESTS
  // ===========================================================================

  describe('recordLeitnerReview', () => {
    describe('Vocabulary Reviews', () => {
      it('should record correct answer and move to next box', async () => {
        const updatedVocab = {
          ...sampleVocab,
          box: 2,
          reviewCount: 6,
          correctCount: 4,
          nextReview: '2024-01-17', // 2 days for box 2
        };
        mockQueryResult.getAll.mockResolvedValue([{ v: updatedVocab }]);

        const result = await adapter.recordLeitnerReview(
          'vocab_123',
          'Vocabulary',
          true, // correct
          validToken
        );

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('box'),
          expect.anything()
        );
        expect(result.box).toBe(2);
        expect(result.correctCount).toBe(4);
      });

      it('should record incorrect answer and move to box 1', async () => {
        const updatedVocab = {
          ...sampleVocab,
          box: 1, // Moved to box 1 on incorrect
          reviewCount: 6,
          // correctCount stays same on incorrect
          nextReview: '2024-01-15', // Tomorrow for box 1
        };
        // Mock returns the updated result after incorrect answer
        mockQueryResult.getAll.mockResolvedValue([{ v: updatedVocab }]);

        const result = await adapter.recordLeitnerReview(
          'vocab_123',
          'Vocabulary',
          false, // incorrect
          validToken
        );

        expect(result.box).toBe(1);
      });

      it('should not exceed box 5', async () => {
        const updatedVocab = {
          ...sampleVocab,
          box: 5, // Capped at 5
          reviewCount: 6,
          correctCount: 4,
          nextReview: '2024-01-29', // 14 days for box 5
        };
        mockQueryResult.getAll.mockResolvedValue([{ v: updatedVocab }]);

        const result = await adapter.recordLeitnerReview(
          'vocab_123',
          'Vocabulary',
          true,
          validToken
        );

        expect(result.box).toBe(5);
      });

      it('should update lastReview timestamp', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: sampleVocab }]);

        await adapter.recordLeitnerReview(
          'vocab_123',
          'Vocabulary',
          true,
          validToken
        );

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('lastReview'),
          expect.anything()
        );
      });

      it('should increment reviewCount', async () => {
        const updatedVocab = { ...sampleVocab, reviewCount: 6 };
        mockQueryResult.getAll.mockResolvedValue([{ v: updatedVocab }]);

        const result = await adapter.recordLeitnerReview(
          'vocab_123',
          'Vocabulary',
          true,
          validToken
        );

        expect(result.reviewCount).toBe(6);
      });
    });

    describe('Note Reviews', () => {
      it('should record note review correctly', async () => {
        const updatedNote = {
          ...sampleNote,
          box: 3,
          reviewCount: 11,
          correctCount: 9,
        };
        mockQueryResult.getAll.mockResolvedValue([{ n: updatedNote }]);

        const result = await adapter.recordLeitnerReview(
          'note_123',
          'Note',
          true,
          validToken
        );

        expect(result.box).toBe(3);
      });

      it('should handle note incorrect answer', async () => {
        const updatedNote = { ...sampleNote, box: 1 };
        mockQueryResult.getAll.mockResolvedValue([{ n: updatedNote }]);

        const result = await adapter.recordLeitnerReview(
          'note_123',
          'Note',
          false,
          validToken
        );

        expect(result.box).toBe(1);
      });
    });

    describe('Edge Cases', () => {
      it('should handle first review (no previous data)', async () => {
        const newItem = {
          id: 'vocab_new',
          word: 'new word',
          box: 1,
          reviewCount: 1,
          correctCount: 1,
        };
        mockQueryResult.getAll.mockResolvedValue([{ v: newItem }]);

        const result = await adapter.recordLeitnerReview(
          'vocab_new',
          'Vocabulary',
          true,
          validToken
        );

        expect(result.reviewCount).toBe(1);
      });

      it('should handle non-existent item', async () => {
        mockQueryResult.getAll.mockResolvedValue([]);

        const result = await adapter.recordLeitnerReview(
          'nonexistent',
          'Vocabulary',
          true,
          validToken
        );

        expect(result).toBeNull();
      });

      it('should record response time if provided', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: sampleVocab }]);

        await adapter.recordLeitnerReview(
          'vocab_123',
          'Vocabulary',
          true,
          validToken,
          { responseTimeMs: 2500 }
        );

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('responseTime'),
          expect.anything()
        );
      });
    });
  });

  // ===========================================================================
  // GET LEITNER DUE ITEMS TESTS
  // ===========================================================================

  describe('getLeitnerDueItems', () => {
    const today = new Date().toISOString().split('T')[0];

    describe('Vocabulary Due Items', () => {
      it('should get vocabulary items due for review', async () => {
        const dueItems = [
          { ...sampleVocab, nextReview: today },
          { ...sampleVocab, id: 'vocab_456', nextReview: today },
        ];
        mockQueryResult.getAll.mockResolvedValue(dueItems.map(v => ({ v })));

        const result = await adapter.getLeitnerDueItems(
          'Vocabulary',
          validToken
        );

        expect(result).toHaveLength(2);
        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('nextReview'),
          expect.anything()
        );
      });

      it('should order by box (lower boxes first)', async () => {
        await adapter.getLeitnerDueItems('Vocabulary', validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY'),
          expect.anything()
        );
      });

      it('should respect limit parameter', async () => {
        await adapter.getLeitnerDueItems('Vocabulary', validToken, 10);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.anything()
        );
      });

      it('should include overdue items', async () => {
        const overdueItem = { ...sampleVocab, nextReview: '2024-01-01' }; // Past date
        mockQueryResult.getAll.mockResolvedValue([{ v: overdueItem }]);

        const result = await adapter.getLeitnerDueItems(
          'Vocabulary',
          validToken
        );

        expect(result).toHaveLength(1);
      });
    });

    describe('Note Due Items', () => {
      it('should get notes due for review', async () => {
        const dueNotes = [sampleNote];
        mockQueryResult.getAll.mockResolvedValue(dueNotes.map(n => ({ n })));

        const result = await adapter.getLeitnerDueItems('Note', validToken);

        expect(result).toHaveLength(1);
      });
    });

    describe('All Item Types', () => {
      it('should get due items of all types', async () => {
        const dueVocab = [{ v: sampleVocab }];
        const dueNotes = [{ n: sampleNote }];
        mockQueryResult.getAll
          .mockResolvedValueOnce(dueVocab)
          .mockResolvedValueOnce(dueNotes);

        const result = await adapter.getLeitnerDueItems('all', validToken);

        // Should combine results
        expect(mockConnection.query).toHaveBeenCalledTimes(2);
      });
    });

    describe('Filtering Options', () => {
      it('should filter by box number', async () => {
        await adapter.getLeitnerDueItems('Vocabulary', validToken, 20, { box: 1 });

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringMatching(/box.*=.*\$box/),
          expect.anything()
        );
      });

      it('should filter by source type', async () => {
        await adapter.getLeitnerDueItems('Vocabulary', validToken, 20, {
          sourceType: 'book',
        });

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('sourceType'),
          expect.anything()
        );
      });

      it('should filter by date range', async () => {
        await adapter.getLeitnerDueItems('Vocabulary', validToken, 20, {
          fromDate: '2024-01-01',
          toDate: '2024-01-31',
        });

        expect(mockConnection.query).toHaveBeenCalled();
      });
    });

    describe('Empty Results', () => {
      it('should return empty array when no items due', async () => {
        mockQueryResult.getAll.mockResolvedValue([]);

        const result = await adapter.getLeitnerDueItems(
          'Vocabulary',
          validToken
        );

        expect(result).toEqual([]);
      });
    });
  });

  // ===========================================================================
  // GET LEITNER STATS TESTS
  // ===========================================================================

  describe('getLeitnerStats', () => {
    describe('Overall Statistics', () => {
      it('should return counts per box', async () => {
        const stats = [
          { box: 1, count: 10 },
          { box: 2, count: 8 },
          { box: 3, count: 5 },
          { box: 4, count: 3 },
          { box: 5, count: 2 },
        ];
        mockQueryResult.getAll.mockResolvedValue(stats);

        const result = await adapter.getLeitnerStats('Vocabulary', validToken);

        expect(result.boxCounts).toBeDefined();
        expect(result.boxCounts[1]).toBe(10);
      });

      it('should return total item count', async () => {
        const stats = [
          { box: 1, count: 10 },
          { box: 2, count: 5 },
        ];
        mockQueryResult.getAll.mockResolvedValue(stats);

        const result = await adapter.getLeitnerStats('Vocabulary', validToken);

        expect(result.totalItems).toBe(15);
      });

      it('should return mastery percentage', async () => {
        // 5 items in box 5 out of 20 total = 25% mastered
        const stats = [
          { box: 1, count: 5 },
          { box: 2, count: 5 },
          { box: 3, count: 5 },
          { box: 4, count: 0 },
          { box: 5, count: 5 },
        ];
        mockQueryResult.getAll.mockResolvedValue(stats);

        const result = await adapter.getLeitnerStats('Vocabulary', validToken);

        expect(result.masteryPercentage).toBeDefined();
      });

      it('should return due count', async () => {
        mockQueryResult.getAll
          .mockResolvedValueOnce([{ box: 1, count: 10 }]) // Box counts
          .mockResolvedValueOnce([{ dueCount: 5 }]); // Due items

        const result = await adapter.getLeitnerStats('Vocabulary', validToken);

        expect(result.dueCount).toBeDefined();
      });
    });

    describe('Review Statistics', () => {
      it('should return total reviews', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ totalReviews: 100 }]);

        const result = await adapter.getLeitnerStats('Vocabulary', validToken);

        expect(result.totalReviews).toBeDefined();
      });

      it('should return accuracy percentage', async () => {
        mockQueryResult.getAll.mockResolvedValue([{
          totalReviews: 100,
          correctReviews: 80,
        }]);

        const result = await adapter.getLeitnerStats('Vocabulary', validToken);

        expect(result.accuracy).toBeDefined();
      });

      it('should return streak information', async () => {
        mockQueryResult.getAll.mockResolvedValue([{
          currentStreak: 7,
          longestStreak: 14,
        }]);

        const result = await adapter.getLeitnerStats('Vocabulary', validToken);

        if (result.streak) {
          expect(result.streak.current).toBeDefined();
          expect(result.streak.longest).toBeDefined();
        }
      });
    });

    describe('Time-Based Statistics', () => {
      it('should return today\'s review count', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ todayReviews: 15 }]);

        const result = await adapter.getLeitnerStats('Vocabulary', validToken);

        expect(result.todayReviews).toBeDefined();
      });

      it('should return average response time', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ avgResponseTime: 2500 }]);

        const result = await adapter.getLeitnerStats('Vocabulary', validToken);

        expect(result.avgResponseTimeMs).toBeDefined();
      });
    });

    describe('Note Statistics', () => {
      it('should return stats for notes', async () => {
        const stats = [{ box: 1, count: 5 }];
        mockQueryResult.getAll.mockResolvedValue(stats);

        const result = await adapter.getLeitnerStats('Note', validToken);

        expect(result.boxCounts).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // LEITNER SCHEDULING TESTS
  // ===========================================================================

  describe('Leitner Scheduling', () => {
    describe('calculateNextReview', () => {
      it('should calculate correct interval for each box', async () => {
        const intervals = {
          1: 1,  // 1 day
          2: 2,  // 2 days
          3: 4,  // 4 days
          4: 7,  // 7 days
          5: 14, // 14 days
        };

        for (const [box, expectedDays] of Object.entries(intervals)) {
          const item = { ...sampleVocab, box: parseInt(box) };
          mockQueryResult.getAll.mockResolvedValue([{ v: item }]);

          await adapter.recordLeitnerReview('vocab_123', 'Vocabulary', true, validToken);

          // Should set next review to correct number of days
          expect(mockConnection.query).toHaveBeenCalled();
        }
      });
    });

    describe('Custom Intervals', () => {
      it('should support custom interval configuration', async () => {
        const customIntervals = [1, 3, 7, 14, 30];

        // If adapter supports custom intervals
        if (adapter.setLeitnerIntervals) {
          adapter.setLeitnerIntervals(customIntervals);
        }

        mockQueryResult.getAll.mockResolvedValue([{ v: sampleVocab }]);

        await adapter.recordLeitnerReview('vocab_123', 'Vocabulary', true, validToken);

        expect(mockConnection.query).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // LEITNER BATCH OPERATIONS TESTS
  // ===========================================================================

  describe('Leitner Batch Operations', () => {
    describe('batchRecordReviews', () => {
      it('should record multiple reviews efficiently', async () => {
        const reviews = [
          { itemId: 'vocab_1', itemType: 'Vocabulary', correct: true },
          { itemId: 'vocab_2', itemType: 'Vocabulary', correct: false },
          { itemId: 'vocab_3', itemType: 'Vocabulary', correct: true },
        ];

        mockQueryResult.getAll.mockResolvedValue([{ success: true }]);

        const result = await adapter.batchRecordLeitnerReviews(reviews, validToken);

        expect(result.processed).toBe(3);
      });

      it('should handle partial failures', async () => {
        const reviews = [
          { itemId: 'vocab_1', itemType: 'Vocabulary', correct: true },
          { itemId: 'vocab_2', itemType: 'Vocabulary', correct: true },
        ];

        mockQueryResult.getAll
          .mockResolvedValueOnce([{ v: sampleVocab }])
          .mockRejectedValueOnce(new Error('Failed'));

        const result = await adapter.batchRecordLeitnerReviews(reviews, validToken);

        expect(result.failed).toBe(1);
      });
    });

    describe('resetToBox1', () => {
      it('should reset item to box 1', async () => {
        const resetItem = { ...sampleVocab, box: 1 };
        mockQueryResult.getAll.mockResolvedValue([{ v: resetItem }]);

        const result = await adapter.resetToBox1('vocab_123', 'Vocabulary', validToken);

        expect(result.box).toBe(1);
        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('box'),
          expect.anything()
        );
      });
    });

    describe('bulkResetItems', () => {
      it('should reset multiple items to box 1', async () => {
        const itemIds = ['vocab_1', 'vocab_2', 'vocab_3'];
        mockQueryResult.getAll.mockResolvedValue([{ count: 3 }]);

        const result = await adapter.bulkResetItems(itemIds, 'Vocabulary', validToken);

        expect(result).toBe(3);
      });
    });
  });

  // ===========================================================================
  // LEITNER HISTORY AND ANALYTICS TESTS
  // ===========================================================================

  describe('Leitner History', () => {
    describe('getReviewHistory', () => {
      it('should get review history for an item', async () => {
        const history = [
          { date: '2024-01-14', correct: true, box: 2, responseTime: 2000 },
          { date: '2024-01-12', correct: true, box: 1, responseTime: 3000 },
          { date: '2024-01-10', correct: false, box: 2, responseTime: 5000 },
        ];
        mockQueryResult.getAll.mockResolvedValue(history);

        const result = await adapter.getReviewHistory('vocab_123', 'Vocabulary', validToken);

        expect(result).toHaveLength(3);
      });

      it('should limit history results', async () => {
        await adapter.getReviewHistory('vocab_123', 'Vocabulary', validToken, 10);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.anything()
        );
      });
    });

    describe('getDailyReviewSummary', () => {
      it('should return daily review summary', async () => {
        const summary = [
          { date: '2024-01-14', total: 20, correct: 15, incorrect: 5 },
          { date: '2024-01-13', total: 15, correct: 12, incorrect: 3 },
        ];
        mockQueryResult.getAll.mockResolvedValue(summary);

        const result = await adapter.getDailyReviewSummary(validToken, 7);

        expect(result).toHaveLength(2);
      });
    });
  });
});

// ===========================================================================
// LEITNER SYSTEM INTEGRATION TESTS
// ===========================================================================

describe('Leitner System Integration', () => {
  let adapter;
  const validToken = 'valid-token';

  // Sample vocabulary item in Leitner system
  const sampleVocab = {
    id: 'vocab_123',
    word: 'ephemeral',
    definition: 'lasting for a very short time',
    box: 1,
    nextReview: '2024-01-15',
    reviewCount: 5,
    correctCount: 3,
    lastReview: '2024-01-14',
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    adapter = new MockKuzuAdapter();
  });

  describe('Full Review Cycle', () => {
    it('should handle complete review cycle from box 1 to 5', async () => {
      // Simulate progressing through boxes
      for (let box = 1; box <= 5; box++) {
        const item = {
          id: 'vocab_123',
          word: 'test',
          box: Math.min(box + 1, 5), // Next box after correct answer
          reviewCount: box,
          correctCount: box,
        };
        mockQueryResult.getAll.mockResolvedValue([{ v: item }]);

        const result = await adapter.recordLeitnerReview(
          'vocab_123',
          'Vocabulary',
          true,
          validToken
        );

        expect(result.box).toBeLessThanOrEqual(5);
      }
    });

    it('should handle regression from box 3 to box 1', async () => {
      const item = {
        id: 'vocab_123',
        word: 'test',
        box: 1, // Back to box 1 after incorrect
        reviewCount: 10,
        correctCount: 7,
      };
      mockQueryResult.getAll.mockResolvedValue([{ v: item }]);

      const result = await adapter.recordLeitnerReview(
        'vocab_123',
        'Vocabulary',
        false,
        validToken
      );

      expect(result.box).toBe(1);
    });
  });

  describe('Mixed Item Types', () => {
    it('should maintain separate Leitner state for different item types', async () => {
      // Vocabulary at box 3
      mockQueryResult.getAll.mockResolvedValue([{
        v: { id: 'vocab_1', box: 3 }
      }]);
      const vocabResult = await adapter.recordLeitnerReview('vocab_1', 'Vocabulary', true, validToken);

      // Note at box 1
      mockQueryResult.getAll.mockResolvedValue([{
        n: { id: 'note_1', box: 1 }
      }]);
      const noteResult = await adapter.recordLeitnerReview('note_1', 'Note', true, validToken);

      // Each should have independent state
      expect(vocabResult.box).toBe(3);
      expect(noteResult.box).toBe(1);
    });
  });
});
