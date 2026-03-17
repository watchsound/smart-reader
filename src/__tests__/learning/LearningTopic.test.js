/**
 * LearningTopic.test.js
 *
 * Unit tests for LearningTopic.ts data models and utility functions.
 * Tests interfaces, type guards, and helper functions.
 */

// Mock the LearningDomains module
jest.mock('../../commons/model/LearningDomains', () => ({
  DomainType: {
    VOCABULARY: 'vocabulary',
    MATH: 'math',
    LANGUAGE: 'language',
    KNOWLEDGE: 'knowledge',
    SKILL: 'skill',
  },
  TopicStatus: {
    ACTIVE: 'active',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    ARCHIVED: 'archived',
  },
  SessionType: {
    LEARN: 'learn',
    REVIEW: 'review',
    QUIZ: 'quiz',
    PRACTICE: 'practice',
    ASSESSMENT: 'assessment',
  },
  DifficultyLevel: {
    BEGINNER: 'beginner',
    ELEMENTARY: 'elementary',
    INTERMEDIATE: 'intermediate',
    ADVANCED: 'advanced',
    EXPERT: 'expert',
  },
  TopicSourceType: {
    BOOK: 'book',
    VOCABULARY_SET: 'vocabulary_set',
    WEB_URL: 'web_url',
    MANUAL: 'manual',
    IMPORTED: 'imported',
  },
  ContentType: {
    TEXT: 'text',
    VIDEO: 'video',
    AUDIO: 'audio',
    INTERACTIVE: 'interactive',
    EXERCISE: 'exercise',
  },
  AssessmentMethod: {
    MULTIPLE_CHOICE: 'multiple_choice',
    FILL_BLANK: 'fill_blank',
    MATCHING: 'matching',
    SHORT_ANSWER: 'short_answer',
    ESSAY: 'essay',
    PROBLEM_SOLVING: 'problem_solving',
    PROJECT: 'project',
  },
}));

// Import after mocking
const {
  isTopicActive,
  topicHasPlan,
  daysUntilTarget,
  calculateSessionAccuracy,
  calculateNextReview,
  generateLearningId,
} = require('../../commons/model/LearningTopic');

const { TopicStatus } = require('../../commons/model/LearningDomains');

describe('LearningTopic Module', () => {
  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  describe('isTopicActive', () => {
    it('should return true for active topics', () => {
      const topic = { status: TopicStatus.ACTIVE };
      expect(isTopicActive(topic)).toBe(true);
    });

    it('should return false for paused topics', () => {
      const topic = { status: TopicStatus.PAUSED };
      expect(isTopicActive(topic)).toBe(false);
    });

    it('should return false for completed topics', () => {
      const topic = { status: TopicStatus.COMPLETED };
      expect(isTopicActive(topic)).toBe(false);
    });

    it('should return false for archived topics', () => {
      const topic = { status: TopicStatus.ARCHIVED };
      expect(isTopicActive(topic)).toBe(false);
    });
  });

  describe('topicHasPlan', () => {
    it('should return true for topic with active plan', () => {
      const topic = { id: 'topic_1', status: TopicStatus.ACTIVE };
      const plan = { id: 'plan_1', topicId: 'topic_1', status: 'active' };
      expect(topicHasPlan(topic, plan)).toBe(true);
    });

    it('should return false when plan is null', () => {
      const topic = { id: 'topic_1', status: TopicStatus.ACTIVE };
      expect(topicHasPlan(topic, null)).toBe(false);
    });

    it('should return false for paused plan', () => {
      const topic = { id: 'topic_1', status: TopicStatus.ACTIVE };
      const plan = { id: 'plan_1', topicId: 'topic_1', status: 'paused' };
      expect(topicHasPlan(topic, plan)).toBe(false);
    });

    it('should return false for completed plan', () => {
      const topic = { id: 'topic_1', status: TopicStatus.ACTIVE };
      const plan = { id: 'plan_1', topicId: 'topic_1', status: 'completed' };
      expect(topicHasPlan(topic, plan)).toBe(false);
    });

    it('should return false for abandoned plan', () => {
      const topic = { id: 'topic_1', status: TopicStatus.ACTIVE };
      const plan = { id: 'plan_1', topicId: 'topic_1', status: 'abandoned' };
      expect(topicHasPlan(topic, plan)).toBe(false);
    });
  });

  describe('daysUntilTarget', () => {
    it('should return null when no target date', () => {
      const topic = { targetDate: null };
      expect(daysUntilTarget(topic)).toBeNull();
    });

    it('should return positive days for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const topic = { targetDate: futureDate };
      const days = daysUntilTarget(topic);
      expect(days).toBe(10);
    });

    it('should return 0 or 1 for today', () => {
      const today = new Date();
      // Set to end of day to ensure it's still "today"
      today.setHours(23, 59, 59, 999);
      const topic = { targetDate: today };
      const days = daysUntilTarget(topic);
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(1);
    });

    it('should return negative days for past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const topic = { targetDate: pastDate };
      const days = daysUntilTarget(topic);
      expect(days).toBeLessThanOrEqual(-4); // Could be -4 or -5 depending on time
    });

    it('should handle date strings', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const topic = { targetDate: futureDate.toISOString() };
      const days = daysUntilTarget(topic);
      expect(days).toBe(7);
    });
  });

  describe('calculateSessionAccuracy', () => {
    it('should return 0 when no items reviewed', () => {
      const session = { itemsReviewed: 0, itemsCorrect: 0 };
      expect(calculateSessionAccuracy(session)).toBe(0);
    });

    it('should return 100 for perfect session', () => {
      const session = { itemsReviewed: 10, itemsCorrect: 10 };
      expect(calculateSessionAccuracy(session)).toBe(100);
    });

    it('should return 50 for half correct', () => {
      const session = { itemsReviewed: 10, itemsCorrect: 5 };
      expect(calculateSessionAccuracy(session)).toBe(50);
    });

    it('should return 0 for all incorrect', () => {
      const session = { itemsReviewed: 10, itemsCorrect: 0 };
      expect(calculateSessionAccuracy(session)).toBe(0);
    });

    it('should handle decimal percentages', () => {
      const session = { itemsReviewed: 3, itemsCorrect: 2 };
      const accuracy = calculateSessionAccuracy(session);
      expect(accuracy).toBeCloseTo(66.67, 1);
    });

    it('should handle large numbers', () => {
      const session = { itemsReviewed: 1000, itemsCorrect: 750 };
      expect(calculateSessionAccuracy(session)).toBe(75);
    });
  });

  describe('calculateNextReview', () => {
    beforeEach(() => {
      // Mock Date.now for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return 1 day interval for incorrect answer', () => {
      const nextReview = calculateNextReview(5, false);
      const expectedDate = new Date('2024-01-16T12:00:00Z');
      expect(nextReview.getTime()).toBe(expectedDate.getTime());
    });

    it('should return 1 day for first correct (streak 0)', () => {
      const nextReview = calculateNextReview(0, true);
      const expectedDate = new Date('2024-01-16T12:00:00Z');
      expect(nextReview.getTime()).toBe(expectedDate.getTime());
    });

    it('should return 1 day for streak 1', () => {
      const nextReview = calculateNextReview(1, true);
      const expectedDate = new Date('2024-01-16T12:00:00Z');
      expect(nextReview.getTime()).toBe(expectedDate.getTime());
    });

    it('should return 3 days for streak 2', () => {
      const nextReview = calculateNextReview(2, true);
      const expectedDate = new Date('2024-01-18T12:00:00Z');
      expect(nextReview.getTime()).toBe(expectedDate.getTime());
    });

    it('should return 7 days for streak 3', () => {
      const nextReview = calculateNextReview(3, true);
      const expectedDate = new Date('2024-01-22T12:00:00Z');
      expect(nextReview.getTime()).toBe(expectedDate.getTime());
    });

    it('should return 14 days for streak 4', () => {
      const nextReview = calculateNextReview(4, true);
      const expectedDate = new Date('2024-01-29T12:00:00Z');
      expect(nextReview.getTime()).toBe(expectedDate.getTime());
    });

    it('should return 30 days for streak 5', () => {
      const nextReview = calculateNextReview(5, true);
      const expectedDate = new Date('2024-02-14T12:00:00Z');
      expect(nextReview.getTime()).toBe(expectedDate.getTime());
    });

    it('should grow exponentially for streak > 5', () => {
      const nextReview6 = calculateNextReview(6, true);
      const nextReview7 = calculateNextReview(7, true);

      // Streak 6: 30 * 1.5^1 = 45 days from Jan 15
      // Jan 15 + 45 days = Feb 29 (2024 is a leap year)
      const expectedDate6 = new Date('2024-02-29T12:00:00Z');
      expect(nextReview6.getTime()).toBe(expectedDate6.getTime());

      // Streak 7: 30 * 1.5^2 = 67.5 days (floor to 67)
      const daysForStreak7 = Math.floor(
        (nextReview7.getTime() - new Date('2024-01-15T12:00:00Z').getTime()) /
          (24 * 60 * 60 * 1000)
      );
      expect(daysForStreak7).toBeGreaterThan(60);
    });

    it('should cap at 90 days maximum', () => {
      const nextReview = calculateNextReview(20, true);
      const daysDiff = Math.floor(
        (nextReview.getTime() - new Date('2024-01-15T12:00:00Z').getTime()) /
          (24 * 60 * 60 * 1000)
      );
      expect(daysDiff).toBeLessThanOrEqual(90);
    });

    it('should reset to 1 day after incorrect regardless of streak', () => {
      const nextReviewStreak0 = calculateNextReview(0, false);
      const nextReviewStreak10 = calculateNextReview(10, false);

      // Both should be 1 day
      expect(nextReviewStreak0.getTime()).toBe(nextReviewStreak10.getTime());
    });
  });

  describe('generateLearningId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateLearningId());
      }
      expect(ids.size).toBe(100);
    });

    it('should use default prefix', () => {
      const id = generateLearningId();
      expect(id.startsWith('learn_')).toBe(true);
    });

    it('should use custom prefix', () => {
      const id = generateLearningId('topic');
      expect(id.startsWith('topic_')).toBe(true);
    });

    it('should use custom prefix for different entities', () => {
      const planId = generateLearningId('plan');
      const sessionId = generateLearningId('session');
      const itemId = generateLearningId('item');

      expect(planId.startsWith('plan_')).toBe(true);
      expect(sessionId.startsWith('session_')).toBe(true);
      expect(itemId.startsWith('item_')).toBe(true);
    });

    it('should generate IDs with timestamp and random parts', () => {
      const id = generateLearningId('test');
      const parts = id.split('_');

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('test');
      expect(parts[1].length).toBeGreaterThan(0); // timestamp
      expect(parts[2].length).toBe(6); // random part
    });

    it('should handle empty prefix', () => {
      const id = generateLearningId('');
      expect(id.startsWith('_')).toBe(true);
    });
  });

  // =============================================================================
  // INTERFACE STRUCTURE TESTS (Validation of expected shapes)
  // =============================================================================

  describe('LearningTopic interface shape', () => {
    it('should define expected properties for a complete topic', () => {
      const topic = {
        id: 'topic_123',
        userId: 1,
        name: 'GRE Vocabulary',
        description: 'Prepare for GRE exam vocabulary section',
        domainType: 'vocabulary',
        sourceType: 'manual',
        sourceId: null,
        targetDate: new Date('2024-06-01'),
        dailyTimeMinutes: 30,
        difficulty: 'intermediate',
        status: 'active',
        progressPercent: 45,
        masteredItems: 450,
        totalItems: 1000,
        streakDays: 12,
        lastStudiedAt: new Date('2024-01-14'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-14'),
      };

      expect(topic.id).toBeDefined();
      expect(topic.userId).toBeDefined();
      expect(topic.name).toBeDefined();
      expect(topic.domainType).toBeDefined();
      expect(topic.status).toBeDefined();
      expect(topic.progressPercent).toBeDefined();
      expect(topic.masteredItems).toBeDefined();
      expect(topic.totalItems).toBeDefined();
    });

    it('should allow optional fields to be null', () => {
      const minimalTopic = {
        id: 'topic_123',
        userId: 1,
        name: 'Quick Topic',
        description: null,
        domainType: 'vocabulary',
        sourceType: null,
        sourceId: null,
        targetDate: null,
        dailyTimeMinutes: 15,
        difficulty: 'auto',
        status: 'active',
        progressPercent: 0,
        masteredItems: 0,
        totalItems: 0,
        streakDays: 0,
        lastStudiedAt: null,
        createdAt: new Date(),
        updatedAt: null,
      };

      expect(minimalTopic.description).toBeNull();
      expect(minimalTopic.sourceType).toBeNull();
      expect(minimalTopic.targetDate).toBeNull();
      expect(minimalTopic.lastStudiedAt).toBeNull();
      expect(minimalTopic.updatedAt).toBeNull();
    });
  });

  describe('LearningPlan interface shape', () => {
    it('should define expected properties for a plan', () => {
      const plan = {
        id: 'plan_123',
        topicId: 'topic_123',
        userId: 1,
        planData: {
          overview: 'A comprehensive vocabulary learning plan',
          estimatedDuration: 90,
          totalPhases: 3,
          phases: [],
          items: [],
          dailySchedule: {
            recommendedSessions: 2,
            sessionDurationMinutes: 15,
            newItemsPercent: 30,
            reviewPercent: 50,
            practicePercent: 20,
            suggestedActivities: ['flashcards', 'quiz'],
          },
          milestones: [],
          recommendations: [],
          assessmentCheckpoints: [],
        },
        currentPhase: 1,
        currentDay: 5,
        status: 'active',
        startedAt: new Date('2024-01-01'),
        completedAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-05'),
      };

      expect(plan.id).toBeDefined();
      expect(plan.topicId).toBeDefined();
      expect(plan.planData).toBeDefined();
      expect(plan.planData.phases).toBeInstanceOf(Array);
      expect(plan.planData.items).toBeInstanceOf(Array);
      expect(plan.planData.dailySchedule).toBeDefined();
      expect(plan.status).toBe('active');
    });
  });

  describe('LearningSession interface shape', () => {
    it('should define expected properties for a session', () => {
      const session = {
        id: 'session_123',
        planId: 'plan_123',
        topicId: 'topic_123',
        userId: 1,
        sessionType: 'review',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:30:00Z'),
        durationMinutes: 30,
        itemsReviewed: 25,
        itemsCorrect: 20,
        itemsNew: 5,
        sessionData: {
          itemResults: [],
          focusScore: 0.85,
          engagementLevel: 'high',
          aiObservations: ['Good focus maintained'],
          suggestedNextSteps: ['Review weak items tomorrow'],
        },
      };

      expect(session.id).toBeDefined();
      expect(session.topicId).toBeDefined();
      expect(session.sessionType).toBeDefined();
      expect(session.itemsReviewed).toBeDefined();
      expect(session.itemsCorrect).toBeDefined();
      expect(session.sessionData).toBeDefined();
    });

    it('should allow ad-hoc sessions without plan', () => {
      const adHocSession = {
        id: 'session_456',
        planId: null, // No plan
        topicId: 'topic_123',
        userId: 1,
        sessionType: 'learn',
        startedAt: new Date(),
        completedAt: null,
        durationMinutes: null,
        itemsReviewed: 0,
        itemsCorrect: 0,
        itemsNew: 0,
        sessionData: null,
      };

      expect(adHocSession.planId).toBeNull();
      expect(adHocSession.completedAt).toBeNull();
      expect(adHocSession.sessionData).toBeNull();
    });
  });

  describe('LearningItem interface shape', () => {
    it('should define expected properties for a learning item', () => {
      const item = {
        id: 'item_vocab_001',
        type: 'word',
        name: 'ephemeral',
        description: 'lasting for a very short time',
        difficulty: 'advanced',
        phase: 1,
        prerequisites: [],
        scheduledDay: 3,
        estimatedTimeMinutes: 2,
        status: 'learning',
        masteryLevel: 45,
        lastReviewedAt: new Date('2024-01-14'),
        nextReviewAt: new Date('2024-01-17'),
        reviewCount: 3,
        correctStreak: 2,
      };

      expect(item.id).toBeDefined();
      expect(item.type).toBe('word');
      expect(item.difficulty).toBeDefined();
      expect(item.status).toBeDefined();
      expect(item.masteryLevel).toBeGreaterThanOrEqual(0);
      expect(item.masteryLevel).toBeLessThanOrEqual(100);
    });

    it('should handle item with prerequisites', () => {
      const advancedItem = {
        id: 'item_math_002',
        type: 'concept',
        name: 'Derivatives',
        difficulty: 'intermediate',
        phase: 2,
        prerequisites: ['item_math_001'], // Requires limits
        scheduledDay: 15,
        estimatedTimeMinutes: 30,
        status: 'pending',
        masteryLevel: 0,
        reviewCount: 0,
        correctStreak: 0,
      };

      expect(advancedItem.prerequisites).toContain('item_math_001');
      expect(advancedItem.prerequisites.length).toBe(1);
    });
  });

  describe('TopicStatistics interface shape', () => {
    it('should define comprehensive statistics', () => {
      const stats = {
        topicId: 'topic_123',
        totalItems: 1000,
        masteredItems: 450,
        inProgressItems: 200,
        pendingItems: 350,
        progressPercent: 45,
        totalTimeMinutes: 1200,
        averageSessionMinutes: 25,
        totalSessions: 48,
        overallAccuracy: 82.5,
        averageResponseTimeMs: 2500,
        currentStreak: 12,
        longestStreak: 15,
        lastSessionAt: new Date('2024-01-14'),
        sessionsLast7Days: 7,
        itemsReviewedLast7Days: 175,
        currentPhase: 2,
        totalPhases: 3,
        currentDay: 45,
        estimatedDaysRemaining: 45,
        itemsDueToday: 25,
        itemsOverdue: 3,
      };

      expect(stats.totalItems).toBe(
        stats.masteredItems + stats.inProgressItems + stats.pendingItems
      );
      expect(stats.overallAccuracy).toBeGreaterThanOrEqual(0);
      expect(stats.overallAccuracy).toBeLessThanOrEqual(100);
    });
  });

  describe('WeaknessAnalysis interface shape', () => {
    it('should identify weak areas and patterns', () => {
      const analysis = {
        topicId: 'topic_123',
        weakItems: [
          {
            itemId: 'item_001',
            itemName: 'ephemeral',
            masteryLevel: 25,
            recentAccuracy: 0.4,
            commonMistakeTypes: ['spelling', 'meaning_confusion'],
          },
          {
            itemId: 'item_002',
            itemName: 'ubiquitous',
            masteryLevel: 30,
            recentAccuracy: 0.5,
            commonMistakeTypes: ['pronunciation', 'usage'],
          },
        ],
        patterns: [
          {
            pattern: 'latin_roots',
            description: 'Difficulty with Latin-derived words',
            affectedItems: ['item_001', 'item_002'],
            suggestedAction: 'Review Latin root vocabulary',
          },
        ],
        recommendations: [
          'Focus on etymology to understand word origins',
          'Practice with context sentences',
        ],
      };

      expect(analysis.weakItems.length).toBeGreaterThan(0);
      expect(analysis.patterns.length).toBeGreaterThan(0);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // INPUT INTERFACE TESTS
  // =============================================================================

  describe('CreateLearningTopicInput shape', () => {
    it('should require only mandatory fields', () => {
      const minimalInput = {
        name: 'New Topic',
        domainType: 'vocabulary',
      };

      expect(minimalInput.name).toBeDefined();
      expect(minimalInput.domainType).toBeDefined();
    });

    it('should allow all optional fields', () => {
      const fullInput = {
        name: 'GRE Vocabulary',
        description: 'Prepare for GRE exam',
        domainType: 'vocabulary',
        sourceType: 'vocabulary_set',
        sourceId: 'gre_vocab_set_001',
        targetDate: new Date('2024-06-01'),
        dailyTimeMinutes: 30,
        difficulty: 'intermediate',
      };

      expect(fullInput.description).toBeDefined();
      expect(fullInput.sourceType).toBeDefined();
      expect(fullInput.targetDate).toBeDefined();
      expect(fullInput.dailyTimeMinutes).toBe(30);
    });
  });

  describe('CreateLearningPlanInput shape', () => {
    it('should require only topicId', () => {
      const minimalInput = {
        topicId: 'topic_123',
      };

      expect(minimalInput.topicId).toBeDefined();
    });

    it('should allow AI hints', () => {
      const fullInput = {
        topicId: 'topic_123',
        focusAreas: ['high frequency words', 'antonyms'],
        preferredPace: 'moderate',
        existingKnowledge: ['basic vocabulary', 'common words'],
        learningStyle: 'visual',
      };

      expect(fullInput.focusAreas).toContain('high frequency words');
      expect(fullInput.preferredPace).toBe('moderate');
      expect(fullInput.learningStyle).toBe('visual');
    });
  });

  describe('RecordItemPerformanceInput shape', () => {
    it('should require core fields', () => {
      const minimalInput = {
        topicId: 'topic_123',
        itemId: 'item_001',
        itemType: 'word',
        wasCorrect: true,
      };

      expect(minimalInput.topicId).toBeDefined();
      expect(minimalInput.itemId).toBeDefined();
      expect(minimalInput.wasCorrect).toBe(true);
    });

    it('should allow optional tracking fields', () => {
      const fullInput = {
        topicId: 'topic_123',
        itemId: 'item_001',
        itemType: 'word',
        wasCorrect: false,
        responseTimeMs: 3500,
        confidenceLevel: 2,
        mistakeType: 'spelling',
        difficultyRating: 4,
        sessionId: 'session_456',
      };

      expect(fullInput.responseTimeMs).toBe(3500);
      expect(fullInput.confidenceLevel).toBe(2);
      expect(fullInput.mistakeType).toBe('spelling');
      expect(fullInput.difficultyRating).toBe(4);
    });
  });
});
