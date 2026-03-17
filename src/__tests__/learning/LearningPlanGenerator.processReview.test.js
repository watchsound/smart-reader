/**
 * LearningPlanGenerator.processReview Tests
 *
 * Comprehensive tests for the processReview method and related
 * personalized interval calculation functions.
 */

import learningPlanGenerator, { LearningPlanGenerator } from '../../main/utils/LearningPlanGenerator';

describe('LearningPlanGenerator - processReview', () => {
  describe('processReview()', () => {
    describe('Basic Review Processing', () => {
      it('should return all required fields', () => {
        const result = learningPlanGenerator.processReview({
          planId: 'plan_123',
          pointId: 'point_456',
          correct: true,
          rating: 3,
        });

        expect(result).toHaveProperty('pointId', 'point_456');
        expect(result).toHaveProperty('planId', 'plan_123');
        expect(result).toHaveProperty('box');
        expect(result).toHaveProperty('boxLevel');
        expect(result).toHaveProperty('previousBox');
        expect(result).toHaveProperty('lastReview');
        expect(result).toHaveProperty('nextReview');
        expect(result).toHaveProperty('intervalDays');
        expect(result).toHaveProperty('reviewCount');
        expect(result).toHaveProperty('correctCount');
        expect(result).toHaveProperty('correctStreak');
        expect(result).toHaveProperty('rating');
        expect(result).toHaveProperty('wasCorrect');
      });

      it('should handle first review (no current point data)', () => {
        const result = learningPlanGenerator.processReview({
          planId: 'plan_123',
          pointId: 'point_456',
          correct: true,
          rating: 3,
        });

        expect(result.previousBox).toBe(1); // Default start
        expect(result.box).toBe(2); // Advance for correct
        expect(result.reviewCount).toBe(1);
        expect(result.correctCount).toBe(1);
      });

      it('should track response time', () => {
        const result = learningPlanGenerator.processReview({
          planId: 'plan_123',
          pointId: 'point_456',
          correct: true,
          rating: 3,
          responseTime: 2500,
        });

        expect(result.responseTime).toBe(2500);
      });
    });

    describe('Rating-Based Box Transitions', () => {
      it('should reset to box 1 on Again (rating 1)', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: false,
          rating: 1,
          currentPoint: { box: 4, correctStreak: 5 },
        });

        expect(result.box).toBe(1);
        expect(result.correctStreak).toBe(0);
      });

      it('should stay in current box on Hard (rating 2)', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: false,
          rating: 2,
          currentPoint: { box: 3, correctStreak: 2 },
        });

        expect(result.box).toBe(3);
        expect(result.correctStreak).toBe(0);
      });

      it('should advance one box on Good (rating 3)', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 3,
          currentPoint: { box: 2, correctStreak: 3 },
        });

        expect(result.box).toBe(3);
        expect(result.correctStreak).toBe(4);
      });

      it('should advance two boxes on Easy (rating 4)', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 4,
          currentPoint: { box: 2, correctStreak: 3 },
        });

        expect(result.box).toBe(4);
        expect(result.correctStreak).toBe(5);
      });

      it('should not exceed box 5', () => {
        const resultFromBox4 = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 4, // Would advance 2
          currentPoint: { box: 4 },
        });

        expect(resultFromBox4.box).toBe(5);

        const resultFromBox5 = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 4,
          currentPoint: { box: 5 },
        });

        expect(resultFromBox5.box).toBe(5);
      });
    });

    describe('Boolean Correct Fallback', () => {
      it('should advance on correct without rating', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          // No rating - should use fallback
          currentPoint: { box: 2 },
        });

        expect(result.box).toBe(3);
      });

      it('should reset on incorrect without rating', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: false,
          // No rating - should use fallback
          currentPoint: { box: 4 },
        });

        expect(result.box).toBe(1);
      });
    });

    describe('Review Statistics Tracking', () => {
      it('should increment review count', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 3,
          currentPoint: { reviewCount: 10 },
        });

        expect(result.reviewCount).toBe(11);
      });

      it('should increment correct count on correct answer', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 3,
          currentPoint: { correctCount: 5 },
        });

        expect(result.correctCount).toBe(6);
      });

      it('should not increment correct count on incorrect answer', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: false,
          rating: 1,
          currentPoint: { correctCount: 5 },
        });

        expect(result.correctCount).toBe(5);
      });
    });

    describe('Profile-Based Interval Calculation', () => {
      it('should use personalized intervals when profile provided', () => {
        const profile = {
          optimalReviewInterval: 5,
          forgettingCurveSlope: 0.4,
        };

        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 3,
          profile,
          currentPoint: { box: 2 },
        });

        // With profile, interval should be based on profile settings
        expect(result.intervalDays).toBeGreaterThan(0);
      });

      it('should use standard Leitner intervals without profile', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 3,
          currentPoint: { box: 3 },
        });

        // When correct, box advances from 3 to 4, so interval = boxIntervals[4] = 7 days
        expect(result.intervalDays).toBe(7);
      });
    });

    describe('Next Review Date Calculation', () => {
      it('should set next review date correctly', () => {
        const before = new Date();

        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 3,
          currentPoint: { box: 2 },
        });

        const nextReview = new Date(result.nextReview);
        const after = new Date();

        // Next review should be in the future
        expect(nextReview.getTime()).toBeGreaterThan(before.getTime());

        // Interval should match
        const expectedDate = new Date(before);
        expectedDate.setDate(expectedDate.getDate() + result.intervalDays);

        // Allow small time variance
        const diff = Math.abs(nextReview.getDate() - expectedDate.getDate());
        expect(diff).toBeLessThanOrEqual(1);
      });

      it('should set immediate review for Again rating', () => {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: false,
          rating: 1,
          currentPoint: { box: 3 },
        });

        expect(result.intervalDays).toBe(0);
      });
    });
  });

  describe('getBoxInterval()', () => {
    it('should return correct base intervals for each box', () => {
      expect(learningPlanGenerator.getBoxInterval(1, 3)).toBe(1);
      expect(learningPlanGenerator.getBoxInterval(2, 3)).toBe(2);
      expect(learningPlanGenerator.getBoxInterval(3, 3)).toBe(4);
      expect(learningPlanGenerator.getBoxInterval(4, 3)).toBe(7);
      expect(learningPlanGenerator.getBoxInterval(5, 3)).toBe(14);
    });

    it('should return 0 interval for Again rating', () => {
      expect(learningPlanGenerator.getBoxInterval(3, 1)).toBe(0);
      expect(learningPlanGenerator.getBoxInterval(5, 1)).toBe(0);
    });

    it('should reduce interval for Hard rating', () => {
      const goodInterval = learningPlanGenerator.getBoxInterval(3, 3);
      const hardInterval = learningPlanGenerator.getBoxInterval(3, 2);

      expect(hardInterval).toBeLessThan(goodInterval);
    });

    it('should increase interval for Easy rating', () => {
      const goodInterval = learningPlanGenerator.getBoxInterval(3, 3);
      const easyInterval = learningPlanGenerator.getBoxInterval(3, 4);

      expect(easyInterval).toBeGreaterThan(goodInterval);
    });

    it('should handle invalid box number', () => {
      const interval = learningPlanGenerator.getBoxInterval(10, 3);

      expect(interval).toBeGreaterThan(0);
    });
  });

  describe('calculatePersonalizedInterval()', () => {
    it('should scale with optimal review interval', () => {
      const shortIntervalProfile = {
        optimalReviewInterval: 2,
        forgettingCurveSlope: 0.5,
      };

      const longIntervalProfile = {
        optimalReviewInterval: 10,
        forgettingCurveSlope: 0.5,
      };

      const shortResult = learningPlanGenerator.calculatePersonalizedInterval(3, 3, 2, shortIntervalProfile);
      const longResult = learningPlanGenerator.calculatePersonalizedInterval(3, 3, 2, longIntervalProfile);

      expect(longResult).toBeGreaterThan(shortResult);
    });

    describe('Rating Modifiers', () => {
      const profile = {
        optimalReviewInterval: 5,
        forgettingCurveSlope: 0.5,
      };

      it('should apply very short interval for Again (rating 1)', () => {
        const interval = learningPlanGenerator.calculatePersonalizedInterval(1, 2, 0, profile);

        expect(interval).toBeLessThanOrEqual(1);
      });

      it('should apply shorter interval for Hard (rating 2)', () => {
        const goodInterval = learningPlanGenerator.calculatePersonalizedInterval(3, 2, 0, profile);
        const hardInterval = learningPlanGenerator.calculatePersonalizedInterval(2, 2, 0, profile);

        expect(hardInterval).toBeLessThan(goodInterval);
      });

      it('should apply longer interval for Easy (rating 4)', () => {
        const goodInterval = learningPlanGenerator.calculatePersonalizedInterval(3, 2, 0, profile);
        const easyInterval = learningPlanGenerator.calculatePersonalizedInterval(4, 2, 0, profile);

        expect(easyInterval).toBeGreaterThan(goodInterval);
      });

      it('should consider forgetting slope for Easy rating', () => {
        const goodRetentionProfile = {
          optimalReviewInterval: 5,
          forgettingCurveSlope: 0.2, // Slow forgetting
        };

        const poorRetentionProfile = {
          optimalReviewInterval: 5,
          forgettingCurveSlope: 0.8, // Fast forgetting
        };

        const goodRetentionInterval = learningPlanGenerator.calculatePersonalizedInterval(
          4, 3, 5, goodRetentionProfile
        );
        const poorRetentionInterval = learningPlanGenerator.calculatePersonalizedInterval(
          4, 3, 5, poorRetentionProfile
        );

        expect(goodRetentionInterval).toBeGreaterThan(poorRetentionInterval);
      });
    });

    describe('Box Level Multipliers', () => {
      const profile = {
        optimalReviewInterval: 5,
        forgettingCurveSlope: 0.5,
      };

      it('should increase interval with higher box level', () => {
        const box1Interval = learningPlanGenerator.calculatePersonalizedInterval(3, 1, 0, profile);
        const box3Interval = learningPlanGenerator.calculatePersonalizedInterval(3, 3, 0, profile);
        const box5Interval = learningPlanGenerator.calculatePersonalizedInterval(3, 5, 0, profile);

        expect(box3Interval).toBeGreaterThan(box1Interval);
        expect(box5Interval).toBeGreaterThan(box3Interval);
      });
    });

    describe('Streak Bonus', () => {
      const profile = {
        optimalReviewInterval: 5,
        forgettingCurveSlope: 0.5,
      };

      it('should not apply streak bonus for streak < 4', () => {
        const interval3 = learningPlanGenerator.calculatePersonalizedInterval(3, 2, 3, profile);
        const interval0 = learningPlanGenerator.calculatePersonalizedInterval(3, 2, 0, profile);

        expect(interval3).toBe(interval0);
      });

      it('should apply streak bonus for streak >= 4', () => {
        const interval0 = learningPlanGenerator.calculatePersonalizedInterval(3, 2, 0, profile);
        const interval5 = learningPlanGenerator.calculatePersonalizedInterval(3, 2, 5, profile);

        expect(interval5).toBeGreaterThan(interval0);
      });

      it('should cap streak bonus', () => {
        const interval10 = learningPlanGenerator.calculatePersonalizedInterval(3, 2, 10, profile);
        const interval20 = learningPlanGenerator.calculatePersonalizedInterval(3, 2, 20, profile);

        // Should be the same due to cap
        expect(interval10).toBe(interval20);
      });
    });

    describe('Interval Bounds', () => {
      it('should not return interval less than 1 (except for Again)', () => {
        const profile = {
          optimalReviewInterval: 0.5, // Very short
          forgettingCurveSlope: 0.9,
        };

        const interval = learningPlanGenerator.calculatePersonalizedInterval(3, 1, 0, profile);

        expect(interval).toBeGreaterThanOrEqual(1);
      });

      it('should cap interval at reasonable maximum (90 days)', () => {
        const profile = {
          optimalReviewInterval: 30,
          forgettingCurveSlope: 0.1,
        };

        const interval = learningPlanGenerator.calculatePersonalizedInterval(4, 5, 20, profile);

        expect(interval).toBeLessThanOrEqual(90);
      });
    });
  });

  describe('Integration: processReview with Profile', () => {
    it('should produce consistent results for same inputs', () => {
      const params = {
        pointId: 'test_123',
        planId: 'plan_456',
        correct: true,
        rating: 3,
        currentPoint: { box: 2, correctStreak: 3, reviewCount: 5, correctCount: 4 },
        profile: { optimalReviewInterval: 5, forgettingCurveSlope: 0.3 },
      };

      const result1 = learningPlanGenerator.processReview(params);
      const result2 = learningPlanGenerator.processReview(params);

      expect(result1.box).toBe(result2.box);
      expect(result1.intervalDays).toBe(result2.intervalDays);
      expect(result1.correctStreak).toBe(result2.correctStreak);
    });

    it('should handle rapid consecutive reviews (cramming scenario)', () => {
      // Simulate multiple reviews in quick succession
      let currentPoint = { box: 1, correctStreak: 0, reviewCount: 0, correctCount: 0 };

      for (let i = 0; i < 5; i++) {
        const result = learningPlanGenerator.processReview({
          pointId: 'test',
          correct: true,
          rating: 3,
          currentPoint,
        });

        currentPoint = {
          box: result.box,
          correctStreak: result.correctStreak,
          reviewCount: result.reviewCount,
          correctCount: result.correctCount,
        };
      }

      expect(currentPoint.box).toBe(5); // Should max out at box 5
      expect(currentPoint.correctStreak).toBe(5);
      expect(currentPoint.reviewCount).toBe(5);
    });

    it('should handle alternating correct/incorrect pattern', () => {
      let currentPoint = { box: 3, correctStreak: 2, reviewCount: 5, correctCount: 3 };

      // Incorrect - reset to box 1
      let result = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: false,
        rating: 1,
        currentPoint,
      });

      expect(result.box).toBe(1);
      expect(result.correctStreak).toBe(0);

      // Correct - advance to box 2
      currentPoint = { ...result };
      result = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: true,
        rating: 3,
        currentPoint,
      });

      expect(result.box).toBe(2);
      expect(result.correctStreak).toBe(1);

      // Incorrect again - back to box 1
      currentPoint = { ...result };
      result = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: false,
        rating: 2,
        currentPoint,
      });

      // Hard rating keeps at same box, but resets streak
      expect(result.box).toBe(2);
      expect(result.correctStreak).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined currentPoint fields', () => {
      const result = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: true,
        rating: 3,
        currentPoint: {}, // Empty object
      });

      expect(result.previousBox).toBe(1);
      expect(result.box).toBe(2);
      expect(result.reviewCount).toBe(1);
    });

    it('should handle null values in currentPoint', () => {
      const result = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: true,
        rating: 3,
        currentPoint: {
          box: null,
          correctStreak: null,
          reviewCount: null,
          correctCount: null,
        },
      });

      expect(result.box).toBeGreaterThan(0);
      expect(result.reviewCount).toBe(1);
    });

    it('should handle boxLevel alias', () => {
      const result = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: true,
        rating: 3,
        currentPoint: { boxLevel: 3 }, // Using alias
      });

      expect(result.previousBox).toBe(3);
      expect(result.box).toBe(4);
    });

    it('should handle profile with missing fields', () => {
      const result = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: true,
        rating: 3,
        profile: {}, // Empty profile
        currentPoint: { box: 2 },
      });

      // Should fall back to defaults
      expect(result.intervalDays).toBeGreaterThan(0);
    });

    it('should handle extreme rating values', () => {
      // Test boundary ratings
      const result0 = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: true,
        rating: 0, // Invalid
        currentPoint: { box: 2 },
      });

      const result5 = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: true,
        rating: 5, // Invalid
        currentPoint: { box: 2 },
      });

      // Should handle gracefully
      expect(result0.box).toBeGreaterThan(0);
      expect(result5.box).toBeGreaterThan(0);
    });
  });
});

describe('LearningPlanGenerator - Box Interval Progression', () => {
  it('should follow standard Leitner progression', () => {
    // Simulate learning a new item from box 1 to box 5
    const intervals = [];
    let box = 1;

    for (let i = 0; i < 5; i++) {
      const result = learningPlanGenerator.processReview({
        pointId: 'test',
        correct: true,
        rating: 3,
        currentPoint: { box },
      });

      intervals.push(result.intervalDays);
      box = result.box;
    }

    // Intervals should generally increase
    for (let i = 1; i < intervals.length; i++) {
      // Allow for some flexibility due to rounding
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1] * 0.9);
    }
  });

  it('should have reasonable intervals for vocabulary domain', () => {
    // Vocabulary typically needs shorter intervals
    const profile = {
      optimalReviewInterval: 3,
      forgettingCurveSlope: 0.5,
    };

    const interval = learningPlanGenerator.calculatePersonalizedInterval(3, 3, 5, profile);

    // Should be reasonable for vocabulary
    expect(interval).toBeGreaterThanOrEqual(3);
    expect(interval).toBeLessThanOrEqual(30);
  });

  it('should have longer intervals for well-known items', () => {
    const profile = {
      optimalReviewInterval: 7,
      forgettingCurveSlope: 0.3,
    };

    // Well-known item: box 5, long streak, Easy rating
    const interval = learningPlanGenerator.calculatePersonalizedInterval(4, 5, 10, profile);

    // Should be quite long
    expect(interval).toBeGreaterThanOrEqual(20);
  });
});
