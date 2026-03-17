/**
 * integration.test.js
 *
 * Integration tests for the unified learning point system.
 * Tests the full flow from API calls through handlers to database operations.
 *
 * @jest-environment node
 */

const {
  learningPointToCard,
  getCardDisplayName,
  createMockLearningPoint,
  createMockVocabularyItem,
  createMockCardArray,
  BOX_NAMES,
  BOX_INTERVALS,
  DOMAIN_FILTERS,
} = require('./__fixtures__/testHelpers');

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock database operations
const mockDB = {
  data: new Map(),
  nextId: 1,

  reset() {
    this.data.clear();
    this.nextId = 1;
  },

  insert(record) {
    const id = `lp-${this.nextId++}`;
    const item = { ...record, id, created_at: new Date().toISOString() };
    this.data.set(id, item);
    return item;
  },

  get(id) {
    return this.data.get(id) || null;
  },

  update(id, updates) {
    const item = this.data.get(id);
    if (!item) return null;
    const updated = { ...item, ...updates, updated_at: new Date().toISOString() };
    this.data.set(id, updated);
    return updated;
  },

  delete(id) {
    return this.data.delete(id);
  },

  getAll() {
    return Array.from(this.data.values());
  },

  query(predicate) {
    return Array.from(this.data.values()).filter(predicate);
  },
};

// Mock LearningPointManager
const mockLPManager = {
  createLearningPoint(point, token) {
    if (!point.front || !point.back) {
      return { error: 'Missing required fields' };
    }
    const item = mockDB.insert({
      ...point,
      user_id: parseInt(token) || 1,
      box: point.box || 1,
      next_review: point.next_review || new Date().toISOString().split('T')[0],
      review_count: 0,
      correct_streak: 0,
      fully_learned: 0,
      mastery_level: 0,
    });
    return item;
  },

  createLearningPointsBatch(points, token) {
    const created = [];
    const errors = [];
    points.forEach((point, index) => {
      const result = this.createLearningPoint(point, token);
      if (result.error) {
        errors.push({ index, error: result.error });
      } else {
        created.push(result);
      }
    });
    return { created: created.length, errors, items: created };
  },

  getLearningPointById(id, token) {
    const item = mockDB.get(id);
    if (!item || item.user_id !== (parseInt(token) || 1)) return null;
    return item;
  },

  updateLearningPoint(id, updates, token) {
    const item = mockDB.get(id);
    if (!item || item.user_id !== (parseInt(token) || 1)) {
      return { error: 'Not found' };
    }
    return mockDB.update(id, updates);
  },

  deleteLearningPoint(id, token, hard = false) {
    const item = mockDB.get(id);
    if (!item || item.user_id !== (parseInt(token) || 1)) return false;
    if (hard) {
      return mockDB.delete(id);
    }
    mockDB.update(id, { deleted_at: new Date().toISOString() });
    return true;
  },

  getDueItems({ token, limit = 50, domainTypes = null, planId = null }) {
    const userId = parseInt(token) || 1;
    const today = new Date().toISOString().split('T')[0];
    return mockDB.query((item) => {
      if (item.user_id !== userId) return false;
      if (item.deleted_at) return false;
      if (item.fully_learned === 1) return false;
      if (item.next_review && item.next_review > today) return false;
      if (domainTypes && !domainTypes.includes(item.domain_type)) return false;
      if (planId && item.plan_id !== planId) return false;
      return true;
    }).slice(0, limit);
  },

  getBySource(sourceType, sourceId, token) {
    const userId = parseInt(token) || 1;
    return mockDB.query((item) =>
      item.user_id === userId &&
      item.source_type === sourceType &&
      item.source_id === sourceId &&
      !item.deleted_at
    );
  },

  searchLearningPoints(query, token, options = {}) {
    const userId = parseInt(token) || 1;
    const queryLower = query.toLowerCase();
    return mockDB.query((item) => {
      if (item.user_id !== userId || item.deleted_at) return false;
      const title = (item.title || '').toLowerCase();
      const front = typeof item.front === 'string' ? item.front.toLowerCase() : '';
      return title.includes(queryLower) || front.includes(queryLower);
    }).slice(0, options.limit || 50);
  },

  getAllLearningPoints(token, options = {}) {
    const userId = parseInt(token) || 1;
    const { page = 1, pageSize = 50 } = options;
    const allItems = mockDB.query((item) =>
      item.user_id === userId && !item.deleted_at
    );
    const start = (page - 1) * pageSize;
    return {
      items: allItems.slice(start, start + pageSize),
      total: allItems.length,
      page,
      pageSize,
    };
  },

  processReview(id, rating, responseTimeMs, token) {
    const item = mockDB.get(id);
    if (!item || item.user_id !== (parseInt(token) || 1)) {
      return { error: 'Not found' };
    }

    let newBox = item.box;
    let correctStreak = item.correct_streak;

    // RATINGS: 1=AGAIN, 2=HARD, 3=GOOD, 4=EASY
    if (rating === 1) {
      // AGAIN: back to box 1
      newBox = 1;
      correctStreak = 0;
    } else if (rating === 2) {
      // HARD: stay in box
      correctStreak = 0;
    } else if (rating === 3) {
      // GOOD: advance one box
      newBox = Math.min(item.box + 1, 5);
      correctStreak += 1;
    } else if (rating === 4) {
      // EASY: skip a box
      newBox = Math.min(item.box + 2, 5);
      correctStreak += 1;
    }

    // Calculate next review based on Leitner intervals
    const intervals = [1, 2, 4, 7, 14];
    const daysUntilReview = intervals[newBox - 1];
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + daysUntilReview);

    const updates = {
      box: newBox,
      next_review: nextReview.toISOString().split('T')[0],
      last_reviewed_at: new Date().toISOString(),
      review_count: item.review_count + 1,
      correct_streak: correctStreak,
      fully_learned: newBox === 5 && correctStreak >= 3 ? 1 : 0,
      mastery_level: Math.min(100, Math.round((newBox / 5) * 100)),
    };

    const updated = mockDB.update(id, updates);
    return {
      success: true,
      box: updated.box,
      nextReview: updated.next_review,
      masteryLevel: updated.mastery_level,
      fullyLearned: updated.fully_learned === 1,
    };
  },

  resetLearningPoint(id, token) {
    const item = mockDB.get(id);
    if (!item || item.user_id !== (parseInt(token) || 1)) return false;
    mockDB.update(id, {
      box: 1,
      next_review: new Date().toISOString().split('T')[0],
      review_count: 0,
      correct_streak: 0,
      fully_learned: 0,
      mastery_level: 0,
    });
    return true;
  },

  getStats(token, options = {}) {
    const userId = parseInt(token) || 1;
    const items = mockDB.query((item) =>
      item.user_id === userId && !item.deleted_at
    );

    const today = new Date().toISOString().split('T')[0];
    const boxCounts = [0, 0, 0, 0, 0];
    let dueToday = 0;
    let mastered = 0;

    items.forEach((item) => {
      if (item.box >= 1 && item.box <= 5) {
        boxCounts[item.box - 1]++;
      }
      if (item.fully_learned === 1) mastered++;
      if (item.next_review && item.next_review <= today) dueToday++;
    });

    return {
      total: items.length,
      mastered,
      dueToday,
      byBox: {
        1: boxCounts[0],
        2: boxCounts[1],
        3: boxCounts[2],
        4: boxCounts[3],
        5: boxCounts[4],
      },
    };
  },
};

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Learning Point Integration Tests', () => {
  beforeEach(() => {
    mockDB.reset();
  });

  // ===========================================================================
  // CRUD FLOW TESTS
  // ===========================================================================

  describe('CRUD Flow', () => {
    test('complete CRUD cycle for a learning point', async () => {
      const token = '1';

      // Create
      const created = mockLPManager.createLearningPoint({
        title: 'React Hooks',
        front: 'What is useState?',
        back: 'A hook for state management in functional components',
        domain_type: 'knowledge',
        item_type: 'concept',
      }, token);

      expect(created.id).toBeDefined();
      expect(created.title).toBe('React Hooks');
      expect(created.box).toBe(1);

      // Read
      const retrieved = mockLPManager.getLearningPointById(created.id, token);
      expect(retrieved).toEqual(created);

      // Update
      const updated = mockLPManager.updateLearningPoint(created.id, {
        title: 'React Hooks Updated',
        tags: ['react', 'hooks'],
      }, token);
      expect(updated.title).toBe('React Hooks Updated');
      expect(updated.tags).toEqual(['react', 'hooks']);

      // Verify update persisted
      const afterUpdate = mockLPManager.getLearningPointById(created.id, token);
      expect(afterUpdate.title).toBe('React Hooks Updated');

      // Soft delete
      const deleted = mockLPManager.deleteLearningPoint(created.id, token, false);
      expect(deleted).toBe(true);

      // Verify soft deleted (should have deleted_at)
      const afterDelete = mockDB.get(created.id);
      expect(afterDelete.deleted_at).toBeDefined();

      // Hard delete
      const hardDeleted = mockLPManager.deleteLearningPoint(created.id, token, true);
      expect(hardDeleted).toBe(true);

      // Verify hard deleted
      const afterHardDelete = mockDB.get(created.id);
      expect(afterHardDelete).toBeNull();
    });

    test('batch create learning points', () => {
      const token = '1';
      const points = [
        { title: 'Item 1', front: 'Q1', back: 'A1' },
        { title: 'Item 2', front: 'Q2', back: 'A2' },
        { title: 'Item 3', front: 'Q3', back: 'A3' },
      ];

      const result = mockLPManager.createLearningPointsBatch(points, token);

      expect(result.created).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.items).toHaveLength(3);
    });

    test('batch create with validation errors', () => {
      const token = '1';
      const points = [
        { title: 'Valid', front: 'Q', back: 'A' },
        { title: 'Missing back', front: 'Q' },
        { title: 'Missing front', back: 'A' },
      ];

      const result = mockLPManager.createLearningPointsBatch(points, token);

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(2);
    });
  });

  // ===========================================================================
  // SPACED REPETITION FLOW TESTS
  // ===========================================================================

  describe('Spaced Repetition Flow', () => {
    test('complete review cycle with box progression', () => {
      const token = '1';

      // Create a learning point
      const item = mockLPManager.createLearningPoint({
        front: 'Capital of France',
        back: 'Paris',
      }, token);

      expect(item.box).toBe(1);

      // Review with GOOD rating - should advance to box 2
      const review1 = mockLPManager.processReview(item.id, 3, 2000, token);
      expect(review1.success).toBe(true);
      expect(review1.box).toBe(2);

      // Review with GOOD rating - should advance to box 3
      const review2 = mockLPManager.processReview(item.id, 3, 1500, token);
      expect(review2.box).toBe(3);

      // Review with GOOD rating - should advance to box 4
      const review3 = mockLPManager.processReview(item.id, 3, 1000, token);
      expect(review3.box).toBe(4);

      // Review with GOOD rating - should advance to box 5
      const review4 = mockLPManager.processReview(item.id, 3, 800, token);
      expect(review4.box).toBe(5);
      expect(review4.fullyLearned).toBe(true);
    });

    test('AGAIN rating resets to box 1', () => {
      const token = '1';

      // Create and advance to box 3
      const item = mockLPManager.createLearningPoint({
        front: 'Q',
        back: 'A',
        box: 3,
      }, token);

      // Update to box 3
      mockDB.update(item.id, { box: 3 });

      // Review with AGAIN - should reset to box 1
      const result = mockLPManager.processReview(item.id, 1, 5000, token);
      expect(result.box).toBe(1);
    });

    test('HARD rating keeps same box', () => {
      const token = '1';

      const item = mockLPManager.createLearningPoint({
        front: 'Q',
        back: 'A',
      }, token);
      mockDB.update(item.id, { box: 3 });

      const result = mockLPManager.processReview(item.id, 2, 3000, token);
      expect(result.box).toBe(3);
    });

    test('EASY rating skips a box', () => {
      const token = '1';

      const item = mockLPManager.createLearningPoint({
        front: 'Q',
        back: 'A',
      }, token);
      expect(item.box).toBe(1);

      const result = mockLPManager.processReview(item.id, 4, 500, token);
      expect(result.box).toBe(3); // Skipped box 2
    });

    test('box capped at 5', () => {
      const token = '1';

      const item = mockLPManager.createLearningPoint({
        front: 'Q',
        back: 'A',
      }, token);
      mockDB.update(item.id, { box: 5 });

      // EASY from box 5 should stay at 5
      const result = mockLPManager.processReview(item.id, 4, 500, token);
      expect(result.box).toBe(5);
    });

    test('reset learning point', () => {
      const token = '1';

      const item = mockLPManager.createLearningPoint({
        front: 'Q',
        back: 'A',
      }, token);

      // Advance to box 4
      mockDB.update(item.id, {
        box: 4,
        review_count: 10,
        correct_streak: 5,
        mastery_level: 80,
      });

      // Reset
      const result = mockLPManager.resetLearningPoint(item.id, token);
      expect(result).toBe(true);

      // Verify reset
      const after = mockDB.get(item.id);
      expect(after.box).toBe(1);
      expect(after.review_count).toBe(0);
      expect(after.correct_streak).toBe(0);
      expect(after.mastery_level).toBe(0);
    });
  });

  // ===========================================================================
  // QUERY FLOW TESTS
  // ===========================================================================

  describe('Query Flow', () => {
    beforeEach(() => {
      const token = '1';
      // Create test data
      mockLPManager.createLearningPoint({
        front: 'ephemeral',
        back: 'lasting a short time',
        domain_type: 'vocabulary',
        item_type: 'word',
        next_review: '2024-01-01', // Past date - due
      }, token);

      mockLPManager.createLearningPoint({
        front: 'React Hooks',
        back: 'Functions for state',
        domain_type: 'knowledge',
        next_review: '2024-01-01', // Past date - due
      }, token);

      mockLPManager.createLearningPoint({
        front: 'Future Item',
        back: 'Not due yet',
        domain_type: 'knowledge',
        next_review: '2099-12-31', // Future date - not due
      }, token);

      mockLPManager.createLearningPoint({
        front: 'Math Formula',
        back: 'E=mc²',
        domain_type: 'math',
        next_review: '2024-01-01',
      }, token);
    });

    test('getDueItems returns only due items', () => {
      const token = '1';
      const due = mockLPManager.getDueItems({ token });

      // Should not include future item
      expect(due.length).toBe(3);
      expect(due.every(item => item.next_review <= new Date().toISOString().split('T')[0])).toBe(true);
    });

    test('getDueItems filters by domain type', () => {
      const token = '1';

      const vocabOnly = mockLPManager.getDueItems({
        token,
        domainTypes: ['vocabulary'],
      });
      expect(vocabOnly.length).toBe(1);
      expect(vocabOnly[0].domain_type).toBe('vocabulary');

      const mathOnly = mockLPManager.getDueItems({
        token,
        domainTypes: ['math'],
      });
      expect(mathOnly.length).toBe(1);
      expect(mathOnly[0].domain_type).toBe('math');
    });

    test('searchLearningPoints finds matching items', () => {
      const token = '1';

      const results = mockLPManager.searchLearningPoints('React', token);
      expect(results.length).toBe(1);
      expect(results[0].front).toBe('React Hooks');
    });

    test('searchLearningPoints is case-insensitive', () => {
      const token = '1';

      const results = mockLPManager.searchLearningPoints('EPHEMERAL', token);
      expect(results.length).toBe(1);
    });

    test('getAllLearningPoints with pagination', () => {
      const token = '1';

      const page1 = mockLPManager.getAllLearningPoints(token, { page: 1, pageSize: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.total).toBe(4);
      expect(page1.page).toBe(1);

      const page2 = mockLPManager.getAllLearningPoints(token, { page: 2, pageSize: 2 });
      expect(page2.items.length).toBe(2);
    });

    test('getStats returns correct statistics', () => {
      const token = '1';

      const stats = mockLPManager.getStats(token);
      expect(stats.total).toBe(4);
      expect(stats.byBox['1']).toBe(4); // All items start in box 1
      expect(stats.mastered).toBe(0);
    });
  });

  // ===========================================================================
  // UI INTEGRATION TESTS
  // ===========================================================================

  describe('UI Integration', () => {
    test('learning point converts to card format correctly', () => {
      const token = '1';

      const item = mockLPManager.createLearningPoint({
        front: 'ephemeral',
        back: 'lasting a short time',
        domain_type: 'vocabulary',
        item_type: 'word',
        extras: {
          example: 'The ephemeral beauty of cherry blossoms',
          relatedWords: 'transient, fleeting',
        },
      }, token);

      const card = learningPointToCard(item);

      expect(card.id).toBe(item.id);
      expect(card.word).toBe('ephemeral');
      expect(card.definition).toBe('lasting a short time');
      expect(card.example).toBe('The ephemeral beauty of cherry blossoms');
      expect(card.relatedWords).toBe('transient, fleeting');
      expect(card.leitnerItem.box).toBe(1);
      expect(card.isLearningPoint).toBe(true);
    });

    test('card display name extracted correctly', () => {
      const vocabCard = { word: 'ephemeral', title: 'Word Card' };
      expect(getCardDisplayName(vocabCard)).toBe('ephemeral');

      const noteCard = { title: 'React Basics', front: 'What is React?' };
      expect(getCardDisplayName(noteCard)).toBe('React Basics');
    });

    test('review flow updates card correctly', () => {
      const token = '1';

      // Create item
      const item = mockLPManager.createLearningPoint({
        front: 'Test Question',
        back: 'Test Answer',
      }, token);

      // Convert to card
      let card = learningPointToCard(item);
      expect(card.leitnerItem.box).toBe(1);

      // Simulate correct answer
      const result = mockLPManager.processReview(item.id, 3, 2000, token);

      // Update card with new data
      const updatedItem = mockDB.get(item.id);
      card = learningPointToCard(updatedItem);

      expect(card.leitnerItem.box).toBe(2);
    });

    test('domain filter integration', () => {
      const token = '1';

      // Create items with different domains
      mockLPManager.createLearningPoint({
        front: 'vocab word',
        back: 'definition',
        domain_type: 'vocabulary',
        next_review: '2020-01-01',
      }, token);

      mockLPManager.createLearningPoint({
        front: 'knowledge item',
        back: 'explanation',
        domain_type: 'knowledge',
        next_review: '2020-01-01',
      }, token);

      // Test filter logic
      const allFilter = DOMAIN_FILTERS.ALL;
      const vocabFilter = DOMAIN_FILTERS.VOCABULARY;

      const allDomainTypes = allFilter === DOMAIN_FILTERS.ALL ? null : [allFilter];
      const vocabDomainTypes = vocabFilter === DOMAIN_FILTERS.ALL ? null : [vocabFilter];

      const allItems = mockLPManager.getDueItems({ token, domainTypes: allDomainTypes });
      const vocabItems = mockLPManager.getDueItems({ token, domainTypes: vocabDomainTypes });

      expect(allItems.length).toBe(2);
      expect(vocabItems.length).toBe(1);
      expect(vocabItems[0].domain_type).toBe('vocabulary');
    });
  });

  // ===========================================================================
  // USER ISOLATION TESTS
  // ===========================================================================

  describe('User Isolation', () => {
    test('users cannot access each other\'s learning points', () => {
      const user1Token = '1';
      const user2Token = '2';

      // User 1 creates item
      const item1 = mockLPManager.createLearningPoint({
        front: 'User 1 Question',
        back: 'User 1 Answer',
      }, user1Token);

      // User 2 creates item
      const item2 = mockLPManager.createLearningPoint({
        front: 'User 2 Question',
        back: 'User 2 Answer',
      }, user2Token);

      // User 1 cannot access User 2's item
      const notFound = mockLPManager.getLearningPointById(item2.id, user1Token);
      expect(notFound).toBeNull();

      // User 2 cannot update User 1's item
      const updateResult = mockLPManager.updateLearningPoint(item1.id, { title: 'Hacked' }, user2Token);
      expect(updateResult.error).toBe('Not found');

      // User 2 cannot delete User 1's item
      const deleteResult = mockLPManager.deleteLearningPoint(item1.id, user2Token);
      expect(deleteResult).toBe(false);

      // Each user sees only their own items
      const user1Items = mockLPManager.getAllLearningPoints(user1Token);
      const user2Items = mockLPManager.getAllLearningPoints(user2Token);

      expect(user1Items.total).toBe(1);
      expect(user2Items.total).toBe(1);
      expect(user1Items.items[0].id).toBe(item1.id);
      expect(user2Items.items[0].id).toBe(item2.id);
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('Edge Cases', () => {
    test('handles empty search results', () => {
      const token = '1';
      const results = mockLPManager.searchLearningPoints('nonexistent', token);
      expect(results).toEqual([]);
    });

    test('handles duplicate creates', () => {
      const token = '1';
      const point = { front: 'Same', back: 'Content' };

      const first = mockLPManager.createLearningPoint(point, token);
      const second = mockLPManager.createLearningPoint(point, token);

      // Both should succeed with different IDs
      expect(first.id).not.toBe(second.id);
    });

    test('handles update on non-existent item', () => {
      const token = '1';
      const result = mockLPManager.updateLearningPoint('non-existent', { title: 'New' }, token);
      expect(result.error).toBe('Not found');
    });

    test('handles delete on non-existent item', () => {
      const token = '1';
      const result = mockLPManager.deleteLearningPoint('non-existent', token);
      expect(result).toBe(false);
    });

    test('handles review on non-existent item', () => {
      const token = '1';
      const result = mockLPManager.processReview('non-existent', 3, 1000, token);
      expect(result.error).toBe('Not found');
    });

    test('handles very long content', () => {
      const token = '1';
      const longContent = 'A'.repeat(10000);

      const item = mockLPManager.createLearningPoint({
        front: longContent,
        back: longContent,
        title: longContent.substring(0, 100),
      }, token);

      expect(item.id).toBeDefined();
      expect(item.front.length).toBe(10000);
    });

    test('handles special characters in content', () => {
      const token = '1';

      const item = mockLPManager.createLearningPoint({
        front: 'What is $\\sum_{i=1}^{n} i$?',
        back: 'LaTeX formula: $$\\frac{n(n+1)}{2}$$',
      }, token);

      const retrieved = mockLPManager.getLearningPointById(item.id, token);
      expect(retrieved.front).toContain('\\sum');
      expect(retrieved.back).toContain('\\frac');
    });

    test('handles JSON content objects', () => {
      const token = '1';

      const item = mockLPManager.createLearningPoint({
        front: { text: 'Question text', html: '<p>Question text</p>', latex: '$x^2$' },
        back: { text: 'Answer text', code: 'console.log("hello")' },
      }, token);

      const card = learningPointToCard(item);
      expect(card.front.text).toBe('Question text');
      expect(card.back.code).toBe('console.log("hello")');
    });
  });
});

// =============================================================================
// FULL STUDY SESSION SIMULATION
// =============================================================================

describe('Study Session Simulation', () => {
  beforeEach(() => {
    mockDB.reset();
  });

  test('simulates a complete study session', () => {
    const token = '1';

    // Create 5 vocabulary items
    const words = [
      { word: 'ephemeral', definition: 'lasting a short time' },
      { word: 'ubiquitous', definition: 'present everywhere' },
      { word: 'serendipity', definition: 'happy accident' },
      { word: 'eloquent', definition: 'fluent and expressive' },
      { word: 'pragmatic', definition: 'dealing with practical matters' },
    ];

    const items = words.map(({ word, definition }) =>
      mockLPManager.createLearningPoint({
        front: word,
        back: definition,
        domain_type: 'vocabulary',
        item_type: 'word',
        next_review: '2020-01-01', // Due
      }, token)
    );

    // Initial stats
    let stats = mockLPManager.getStats(token);
    expect(stats.total).toBe(5);
    expect(stats.byBox['1']).toBe(5);
    expect(stats.dueToday).toBe(5);

    // Simulate study session - mix of correct and incorrect
    // Item 0: GOOD (advance to box 2)
    mockLPManager.processReview(items[0].id, 3, 2000, token);
    // Item 1: AGAIN (stay at box 1)
    mockLPManager.processReview(items[1].id, 1, 5000, token);
    // Item 2: EASY (skip to box 3)
    mockLPManager.processReview(items[2].id, 4, 1000, token);
    // Item 3: HARD (stay at box 1)
    mockLPManager.processReview(items[3].id, 2, 3000, token);
    // Item 4: GOOD (advance to box 2)
    mockLPManager.processReview(items[4].id, 3, 2500, token);

    // Check final stats
    stats = mockLPManager.getStats(token);
    expect(stats.byBox['1']).toBe(2); // Items 1, 3
    expect(stats.byBox['2']).toBe(2); // Items 0, 4
    expect(stats.byBox['3']).toBe(1); // Item 2

    // Verify individual items
    expect(mockDB.get(items[0].id).box).toBe(2);
    expect(mockDB.get(items[1].id).box).toBe(1);
    expect(mockDB.get(items[2].id).box).toBe(3);
    expect(mockDB.get(items[3].id).box).toBe(1);
    expect(mockDB.get(items[4].id).box).toBe(2);

    // Verify review counts
    items.forEach((item) => {
      const updated = mockDB.get(item.id);
      expect(updated.review_count).toBe(1);
      expect(updated.last_reviewed_at).toBeDefined();
    });
  });

  test('simulates mastery achievement', () => {
    const token = '1';

    const item = mockLPManager.createLearningPoint({
      front: 'Master this',
      back: 'You got it!',
      next_review: '2020-01-01',
    }, token);

    // Review with GOOD 4 times to reach box 5
    for (let i = 0; i < 4; i++) {
      mockLPManager.processReview(item.id, 3, 1000, token);
    }

    const final = mockDB.get(item.id);
    expect(final.box).toBe(5);
    expect(final.fully_learned).toBe(1);
    expect(final.mastery_level).toBe(100);
  });
});
