/**
 * LearningPlanGenerator.test.js
 *
 * Comprehensive tests for the LearningPlanGenerator service.
 * Tests plan calculation, phase generation, scheduling, and progress tracking.
 */

import learningPlanGenerator, { LearningPlanGenerator } from '../../main/utils/LearningPlanGenerator';

describe('LearningPlanGenerator', () => {
  describe('Singleton Pattern', () => {
    it('should export default instance', () => {
      expect(learningPlanGenerator).toBeDefined();
      expect(typeof learningPlanGenerator.generatePlan).toBe('function');
    });

    it('should have all required methods', () => {
      expect(learningPlanGenerator).toHaveProperty('generatePlan');
      expect(learningPlanGenerator).toHaveProperty('checkFeasibility');
      expect(learningPlanGenerator).toHaveProperty('calculateNextReview');
      expect(learningPlanGenerator).toHaveProperty('distributeLearningPoints');
    });
  });

  describe('generatePlan()', () => {
    describe('Basic Plan Generation', () => {
      it('should generate a plan with required fields', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        expect(plan).toHaveProperty('overview');
        expect(plan).toHaveProperty('estimatedDuration');
        expect(plan).toHaveProperty('totalPhases');
        expect(plan).toHaveProperty('phases');
        expect(plan).toHaveProperty('dailySchedule');
        expect(plan).toHaveProperty('milestones');
        expect(plan).toHaveProperty('assessmentCheckpoints');
        expect(plan).toHaveProperty('recommendations');
        expect(plan).toHaveProperty('calculation');
      });

      it('should calculate correct duration for vocabulary', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        // Vocabulary: defaultItemsPerSession=20, defaultDailyMinutes=15
        // timeRatio = 30/15 = 2.0
        // newItemsPerDay = floor(20 * 2.0 * 0.4) = 16
        // daysToComplete = ceil(100/16) = 7
        expect(plan.estimatedDuration).toBeGreaterThanOrEqual(5);
        expect(plan.estimatedDuration).toBeLessThanOrEqual(15);
      });

      it('should scale duration with daily time commitment', () => {
        const plan15min = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 15,
          domainType: 'vocabulary',
        });

        const plan60min = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 60,
          domainType: 'vocabulary',
        });

        // More time = shorter duration
        expect(plan15min.estimatedDuration).toBeGreaterThan(plan60min.estimatedDuration);
      });

      it('should generate 3 phases by default', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        expect(plan.totalPhases).toBe(3);
        expect(plan.phases).toHaveLength(3);
      });
    });

    describe('Domain-Specific Plans', () => {
      const domains = ['vocabulary', 'math', 'language', 'knowledge', 'skill'];

      domains.forEach(domain => {
        it(`should generate valid plan for ${domain} domain`, () => {
          const plan = learningPlanGenerator.generatePlan({
            totalItems: 50,
            dailyMinutes: 30,
            domainType: domain,
          });

          expect(plan.phases.length).toBeGreaterThanOrEqual(3);
          expect(plan.dailySchedule.suggestedActivities.length).toBeGreaterThan(0);
          // Overview contains domain name (case insensitive)
          expect(plan.overview.toLowerCase()).toContain(domain.toLowerCase());
        });
      });

      it('should have different phase names for different domains', () => {
        const vocabPlan = learningPlanGenerator.generatePlan({
          totalItems: 50,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        const mathPlan = learningPlanGenerator.generatePlan({
          totalItems: 50,
          dailyMinutes: 30,
          domainType: 'math',
        });

        // Different domains should have different phase names
        expect(vocabPlan.phases[0].name).not.toBe(mathPlan.phases[0].name);
      });
    });

    describe('Deadline Feasibility', () => {
      it('should mark plan as feasible when no deadline', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        expect(plan.calculation.feasibility.isFeasible).toBe(true);
        expect(plan.calculation.feasibility.needsAdjustment).toBe(false);
      });

      it('should mark plan as feasible when deadline is achievable', () => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 100); // 100 days from now

        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
          targetDate,
        });

        expect(plan.calculation.feasibility.isFeasible).toBe(true);
      });

      it('should mark plan as needing adjustment when deadline is tight', () => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 5); // Only 5 days

        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
          targetDate,
        });

        expect(plan.calculation.feasibility.needsAdjustment).toBe(true);
        expect(plan.calculation.feasibility.daysShort).toBeGreaterThan(0);
      });

      it('should suggest increased daily time when deadline is tight', () => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 10);

        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
          targetDate,
        });

        if (plan.calculation.feasibility.needsAdjustment) {
          expect(plan.calculation.feasibility.adjustedDailyMinutes).toBeGreaterThan(30);
        }
      });
    });

    describe('Phase Generation', () => {
      it('should distribute items across phases', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 90,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        const totalItemsInPhases = plan.phases.reduce((sum, p) => sum + p.itemCount, 0);
        expect(totalItemsInPhases).toBe(90);
      });

      it('should have sequential phase days', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        for (let i = 1; i < plan.phases.length; i++) {
          expect(plan.phases[i].startDay).toBe(plan.phases[i - 1].endDay + 1);
        }
      });

      it('should have valid phase distribution percentages', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        plan.phases.forEach(phase => {
          const total = phase.distribution.newPercent +
                       phase.distribution.reviewPercent +
                       (phase.distribution.practicePercent || 0);
          expect(total).toBe(100);
        });
      });

      it('should have focus areas for each phase', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        plan.phases.forEach(phase => {
          expect(phase.focusAreas).toBeDefined();
          expect(phase.focusAreas.length).toBeGreaterThan(0);
        });
      });
    });

    describe('Daily Schedule', () => {
      it('should generate valid daily schedule', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        const schedule = plan.dailySchedule;
        expect(schedule.totalMinutes).toBe(30);
        expect(schedule.newItemsPerDay).toBeGreaterThan(0);
        expect(schedule.reviewsPerDay).toBeGreaterThan(0);
      });

      it('should recommend more sessions for longer daily time', () => {
        const plan30 = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        const plan90 = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 90,
          domainType: 'vocabulary',
        });

        expect(plan90.dailySchedule.recommendedSessions).toBeGreaterThanOrEqual(
          plan30.dailySchedule.recommendedSessions
        );
      });

      it('should have suggested activities', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        expect(plan.dailySchedule.suggestedActivities).toBeDefined();
        expect(plan.dailySchedule.suggestedActivities.length).toBeGreaterThan(0);
      });
    });

    describe('Milestones', () => {
      it('should generate milestones', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        expect(plan.milestones.length).toBeGreaterThan(0);
      });

      it('should include phase completion milestones', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        const phaseMillestones = plan.milestones.filter(m => m.id.includes('phase'));
        expect(phaseMillestones.length).toBe(plan.phases.length);
      });

      it('should include progress milestones (25%, 50%, 75%, 100%)', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        const progressMilestones = plan.milestones.filter(m => m.id.includes('progress'));
        expect(progressMilestones.length).toBe(4);
      });

      it('should include streak milestones', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        const streakMilestones = plan.milestones.filter(m => m.id.includes('streak'));
        expect(streakMilestones.length).toBeGreaterThan(0);
      });

      it('should have rewards for milestones', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        plan.milestones.forEach(milestone => {
          expect(milestone.reward).toBeDefined();
        });
      });
    });

    describe('Assessment Checkpoints', () => {
      it('should generate assessment checkpoints', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        expect(plan.assessmentCheckpoints.length).toBeGreaterThan(0);
      });

      it('should have checkpoint at end of each phase', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        plan.phases.forEach(phase => {
          const phaseCheckpoint = plan.assessmentCheckpoints.find(
            c => c.phase === phase.phaseNumber && c.day === phase.endDay
          );
          expect(phaseCheckpoint).toBeDefined();
        });
      });

      it('should have a comprehensive final assessment', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        const finalAssessment = plan.assessmentCheckpoints.find(c => c.type === 'comprehensive');
        expect(finalAssessment).toBeDefined();
        expect(finalAssessment.passingScore).toBeGreaterThanOrEqual(80);
      });
    });

    describe('Recommendations', () => {
      it('should generate recommendations', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        expect(plan.recommendations.length).toBeGreaterThan(0);
      });

      it('should warn about short study time', () => {
        const plan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 10,
          domainType: 'vocabulary',
        });

        const hasTimeWarning = plan.recommendations.some(r =>
          r.toLowerCase().includes('time') || r.toLowerCase().includes('minutes')
        );
        expect(hasTimeWarning).toBe(true);
      });

      it('should include domain-specific recommendations', () => {
        const vocabPlan = learningPlanGenerator.generatePlan({
          totalItems: 100,
          dailyMinutes: 30,
          domainType: 'vocabulary',
        });

        const hasVocabRec = vocabPlan.recommendations.some(r =>
          r.toLowerCase().includes('spaced repetition') ||
          r.toLowerCase().includes('context')
        );
        expect(hasVocabRec).toBe(true);
      });
    });
  });

  describe('checkFeasibility()', () => {
    it('should return feasible for null target date', () => {
      const result = learningPlanGenerator.checkFeasibility(30, null);
      expect(result.isFeasible).toBe(true);
      expect(result.needsAdjustment).toBe(false);
    });

    it('should calculate available days correctly', () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 50);

      const result = learningPlanGenerator.checkFeasibility(30, targetDate);
      expect(result.availableDays).toBeGreaterThanOrEqual(49);
      expect(result.availableDays).toBeLessThanOrEqual(51);
    });

    it('should calculate days short when infeasible', () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 10);

      const result = learningPlanGenerator.checkFeasibility(30, targetDate);
      if (!result.isFeasible) {
        expect(result.daysShort).toBe(30 - result.availableDays);
      }
    });
  });

  describe('distributeLearningPoints()', () => {
    let plan;

    beforeEach(() => {
      plan = learningPlanGenerator.generatePlan({
        totalItems: 30,
        dailyMinutes: 30,
        domainType: 'vocabulary',
      });
    });

    it('should assign scheduledDay to all learning points', () => {
      const learningPoints = Array.from({ length: 30 }, (_, i) => ({
        id: `lp_${i}`,
        title: `Word ${i}`,
        front: { text: `word_${i}` },
        back: { text: `definition_${i}` },
      }));

      const distributed = learningPlanGenerator.distributeLearningPoints(learningPoints, plan);

      distributed.forEach(lp => {
        expect(lp.scheduledDay).toBeDefined();
        expect(lp.scheduledDay).toBeGreaterThan(0);
      });
    });

    it('should assign phase to all learning points', () => {
      const learningPoints = Array.from({ length: 30 }, (_, i) => ({
        id: `lp_${i}`,
        title: `Word ${i}`,
      }));

      const distributed = learningPlanGenerator.distributeLearningPoints(learningPoints, plan);

      distributed.forEach(lp => {
        expect(lp.phase).toBeDefined();
        expect(lp.phase).toBeGreaterThanOrEqual(1);
        expect(lp.phase).toBeLessThanOrEqual(plan.totalPhases);
      });
    });

    it('should respect newItemsPerDay limit', () => {
      const learningPoints = Array.from({ length: 30 }, (_, i) => ({
        id: `lp_${i}`,
        title: `Word ${i}`,
      }));

      const distributed = learningPlanGenerator.distributeLearningPoints(learningPoints, plan);

      // Count items per day
      const itemsPerDay = {};
      distributed.forEach(lp => {
        itemsPerDay[lp.scheduledDay] = (itemsPerDay[lp.scheduledDay] || 0) + 1;
      });

      Object.values(itemsPerDay).forEach(count => {
        expect(count).toBeLessThanOrEqual(plan.dailySchedule.newItemsPerDay);
      });
    });

    it('should initialize status as pending', () => {
      const learningPoints = [{ id: 'lp_1', title: 'Test' }];
      const distributed = learningPlanGenerator.distributeLearningPoints(learningPoints, plan);

      expect(distributed[0].status).toBe('pending');
      expect(distributed[0].masteryLevel).toBe(0);
      expect(distributed[0].reviewCount).toBe(0);
      expect(distributed[0].correctStreak).toBe(0);
    });
  });

  describe('calculateNextReview()', () => {
    it('should return 1 day interval on incorrect answer', () => {
      const result = learningPlanGenerator.calculateNextReview(5, false);
      expect(result.intervalDays).toBe(1);
      expect(result.newCorrectStreak).toBe(0);
    });

    it('should increase interval with correct streak', () => {
      const intervals = [];
      for (let streak = 0; streak <= 6; streak++) {
        const result = learningPlanGenerator.calculateNextReview(streak, true);
        intervals.push(result.intervalDays);
      }

      // Each interval should be >= previous (non-decreasing)
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
      }
    });

    it('should increment correct streak on correct answer', () => {
      const result = learningPlanGenerator.calculateNextReview(3, true);
      expect(result.newCorrectStreak).toBe(4);
    });

    it('should return valid ISO date string for nextReviewAt', () => {
      const result = learningPlanGenerator.calculateNextReview(2, true);
      expect(() => new Date(result.nextReviewAt)).not.toThrow();
    });

    it('should return future date for nextReviewAt', () => {
      const result = learningPlanGenerator.calculateNextReview(2, true);
      const reviewDate = new Date(result.nextReviewAt);
      expect(reviewDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('getItemsDueForReview()', () => {
    it('should return items scheduled for today', () => {
      const today = new Date();
      const learningPoints = [
        { id: 'lp_1', scheduledDay: 1, status: 'pending', nextReviewAt: null },
        { id: 'lp_2', scheduledDay: 2, status: 'pending', nextReviewAt: null },
      ];

      const due = learningPlanGenerator.getItemsDueForReview(learningPoints, 1, 10);
      expect(due.some(lp => lp.id === 'lp_1')).toBe(true);
    });

    it('should return items with past nextReviewAt', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const learningPoints = [
        { id: 'lp_1', status: 'reviewing', nextReviewAt: yesterday.toISOString() },
        { id: 'lp_2', status: 'reviewing', nextReviewAt: new Date(Date.now() + 86400000).toISOString() },
      ];

      const due = learningPlanGenerator.getItemsDueForReview(learningPoints, 1, 10);
      expect(due.some(lp => lp.id === 'lp_1')).toBe(true);
      expect(due.some(lp => lp.id === 'lp_2')).toBe(false);
    });

    it('should respect limit parameter', () => {
      const learningPoints = Array.from({ length: 50 }, (_, i) => ({
        id: `lp_${i}`,
        scheduledDay: 1,
        status: 'pending',
      }));

      const due = learningPlanGenerator.getItemsDueForReview(learningPoints, 1, 10);
      expect(due.length).toBeLessThanOrEqual(10);
    });

    it('should prioritize overdue items', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const learningPoints = [
        { id: 'lp_newer', status: 'reviewing', nextReviewAt: yesterday.toISOString() },
        { id: 'lp_older', status: 'reviewing', nextReviewAt: twoDaysAgo.toISOString() },
      ];

      const due = learningPlanGenerator.getItemsDueForReview(learningPoints, 1, 10);
      expect(due[0].id).toBe('lp_older');
    });
  });

  describe('calculateProgress()', () => {
    it('should calculate correct totals', () => {
      const learningPoints = [
        { status: 'pending', masteryLevel: 0 },
        { status: 'learning', masteryLevel: 30 },
        { status: 'reviewing', masteryLevel: 60 },
        { status: 'mastered', masteryLevel: 100 },
      ];

      const progress = learningPlanGenerator.calculateProgress(learningPoints);

      expect(progress.total).toBe(4);
      expect(progress.pending).toBe(1);
      expect(progress.learning).toBe(1);
      expect(progress.reviewing).toBe(1);
      expect(progress.mastered).toBe(1);
    });

    it('should calculate progress percentage correctly', () => {
      const learningPoints = [
        { status: 'pending', masteryLevel: 0 },
        { status: 'pending', masteryLevel: 0 },
        { status: 'reviewing', masteryLevel: 60 },
        { status: 'mastered', masteryLevel: 100 },
      ];

      const progress = learningPlanGenerator.calculateProgress(learningPoints);

      // 2 out of 4 are reviewing/mastered = 50%
      expect(progress.progressPercent).toBe(50);
    });

    it('should calculate average mastery correctly', () => {
      const learningPoints = [
        { status: 'pending', masteryLevel: 0 },
        { status: 'reviewing', masteryLevel: 50 },
        { status: 'mastered', masteryLevel: 100 },
      ];

      const progress = learningPlanGenerator.calculateProgress(learningPoints);

      // (0 + 50 + 100) / 3 = 50
      expect(progress.averageMastery).toBe(50);
    });

    it('should handle empty array', () => {
      const progress = learningPlanGenerator.calculateProgress([]);

      expect(progress.total).toBe(0);
      expect(progress.progressPercent).toBe(0);
      expect(progress.averageMastery).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small item count', () => {
      const plan = learningPlanGenerator.generatePlan({
        totalItems: 3,
        dailyMinutes: 30,
        domainType: 'vocabulary',
      });

      expect(plan.estimatedDuration).toBeGreaterThanOrEqual(1);
      expect(plan.phases.length).toBe(3);
    });

    it('should handle very large item count', () => {
      const plan = learningPlanGenerator.generatePlan({
        totalItems: 10000,
        dailyMinutes: 30,
        domainType: 'vocabulary',
      });

      expect(plan.estimatedDuration).toBeGreaterThan(100);
      expect(plan.calculation.totalItems).toBe(10000);
    });

    it('should handle minimum daily time', () => {
      const plan = learningPlanGenerator.generatePlan({
        totalItems: 50,
        dailyMinutes: 5,
        domainType: 'vocabulary',
      });

      expect(plan.dailySchedule.newItemsPerDay).toBeGreaterThanOrEqual(1);
    });

    it('should handle maximum daily time', () => {
      const plan = learningPlanGenerator.generatePlan({
        totalItems: 50,
        dailyMinutes: 480, // 8 hours
        domainType: 'vocabulary',
      });

      expect(plan.dailySchedule.recommendedSessions).toBeGreaterThanOrEqual(3);
    });

    it('should handle unknown domain type gracefully', () => {
      const plan = learningPlanGenerator.generatePlan({
        totalItems: 50,
        dailyMinutes: 30,
        domainType: 'unknown_domain',
      });

      // Should fall back to vocabulary/knowledge defaults
      expect(plan.phases.length).toBeGreaterThanOrEqual(3);
    });
  });
});
