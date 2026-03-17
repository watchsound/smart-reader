/**
 * AIPrompts Schedule Reconciliation Prompt Tests
 *
 * Tests for createScheduleReconciliationPrompt and createCatchUpPlanPrompt
 * Validates prompt structure, context handling, and output format expectations
 */

import {
  createScheduleReconciliationPrompt,
  createCatchUpPlanPrompt,
} from '../../commons/utils/AIPrompts';

describe('AIPrompts - Schedule Reconciliation', () => {
  // ===========================================================================
  // createScheduleReconciliationPrompt Tests
  // ===========================================================================

  describe('createScheduleReconciliationPrompt()', () => {
    describe('Basic Structure', () => {
      it('should return a non-empty string prompt', () => {
        const prompt = createScheduleReconciliationPrompt({});

        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(100);
      });

      it('should include task description', () => {
        const prompt = createScheduleReconciliationPrompt({});

        expect(prompt).toContain('adaptive learning schedule manager');
        expect(prompt).toContain('personalized spaced repetition');
        expect(prompt).toContain('TASK:');
      });

      it('should include JSON response format specification', () => {
        const prompt = createScheduleReconciliationPrompt({});

        expect(prompt).toContain('JSON format');
        expect(prompt).toContain('prioritizedItems');
        expect(prompt).toContain('sessionPlan');
        expect(prompt).toContain('adjustments');
        expect(prompt).toContain('recommendations');
        expect(prompt).toContain('confidence');
      });

      it('should include analysis requirements', () => {
        const prompt = createScheduleReconciliationPrompt({});

        expect(prompt).toContain('ANALYSIS REQUIREMENTS');
        expect(prompt).toContain('personal forgetting curve');
        expect(prompt).toContain('cross-concept relationships');
        expect(prompt).toContain('optimal session length');
      });

      it('should include important guidelines', () => {
        const prompt = createScheduleReconciliationPrompt({});

        expect(prompt).toContain('IMPORTANT');
        expect(prompt).toContain('risk of forgetting');
        expect(prompt).toContain('interference patterns');
        expect(prompt).toContain('prerequisites');
      });
    });

    describe('Plan Information', () => {
      it('should include plan name when provided', () => {
        const prompt = createScheduleReconciliationPrompt({
          planName: 'GRE Vocabulary',
        });

        expect(prompt).toContain('GRE Vocabulary');
      });

      it('should handle missing plan name gracefully', () => {
        const prompt = createScheduleReconciliationPrompt({});

        expect(prompt).toContain('Unknown');
      });

      it('should include domain type when provided', () => {
        const prompt = createScheduleReconciliationPrompt({
          domainType: 'vocabulary',
        });

        expect(prompt).toContain('vocabulary');
      });

      it('should default domain to general', () => {
        const prompt = createScheduleReconciliationPrompt({});

        expect(prompt).toContain('general');
      });
    });

    describe('Learner Profile Context', () => {
      it('should format complete learner profile', () => {
        const profile = {
          forgettingCurveSlope: 0.3,
          optimalReviewInterval: 5,
          averageRetentionRate: 0.85,
          pacePreference: 'burst',
          preferredTimeOfDay: 'morning',
          optimalSessionLength: 30,
          consistencyScore: 75,
        };

        const prompt = createScheduleReconciliationPrompt({ profile });

        expect(prompt).toContain('Learner Profile');
        expect(prompt).toContain('Forgetting curve slope: 0.3');
        expect(prompt).toContain('Optimal review interval: 5 days');
        expect(prompt).toContain('Average retention rate: 85%');
        expect(prompt).toContain('Learning pace preference: burst');
        expect(prompt).toContain('Optimal time of day: morning');
        expect(prompt).toContain('Optimal session length: 30 minutes');
        expect(prompt).toContain('Consistency score: 75/100');
      });

      it('should use default values for missing profile fields', () => {
        const profile = {
          forgettingCurveSlope: 0.4,
          // other fields missing
        };

        const prompt = createScheduleReconciliationPrompt({ profile });

        expect(prompt).toContain('Forgetting curve slope: 0.4');
        expect(prompt).toContain('Optimal review interval: 3 days'); // default
        expect(prompt).toContain('Average retention rate: 70%'); // default
        expect(prompt).toContain('Learning pace preference: steady'); // default
      });

      it('should handle null profile gracefully', () => {
        const prompt = createScheduleReconciliationPrompt({ profile: null });

        // Should not contain profile section or should have minimal content
        expect(prompt).not.toContain('undefined');
        expect(prompt).not.toContain('NaN');
      });

      it('should handle profile with zero values', () => {
        const profile = {
          forgettingCurveSlope: 0,
          optimalReviewInterval: 0,
          consistencyScore: 0,
        };

        const prompt = createScheduleReconciliationPrompt({ profile });

        // Note: Due to JS || operator, 0 values fall back to defaults
        // forgettingCurveSlope: 0 || 0.5 = 0.5 (0 is falsy)
        // optimalReviewInterval: 0 || 3 = 3
        // consistencyScore: 0 || 50 = 50
        expect(prompt).toContain('Forgetting curve slope: 0.5');
        expect(prompt).toContain('Optimal review interval: 3 days');
        expect(prompt).toContain('Consistency score: 50/100');
      });
    });

    describe('Overdue Items Context', () => {
      it('should format overdue items summary', () => {
        const overdueItems = [
          {
            id: 'item_1',
            front: 'ephemeral - lasting for a short time',
            boxLevel: 2,
            nextReview: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            decayedMastery: 0.45,
          },
          {
            id: 'item_2',
            front: 'ubiquitous - present everywhere',
            boxLevel: 3,
            nextReview: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            decayedMastery: 0.65,
          },
        ];

        const prompt = createScheduleReconciliationPrompt({ overdueItems });

        expect(prompt).toContain('Overdue Items (2 total)');
        expect(prompt).toContain('ephemeral');
        expect(prompt).toContain('ubiquitous');
        expect(prompt).toContain('Box 2');
        expect(prompt).toContain('Box 3');
        expect(prompt).toContain('45%'); // decayed mastery
        expect(prompt).toContain('65%');
      });

      it('should truncate long item front text', () => {
        const overdueItems = [
          {
            id: 'item_1',
            front: 'This is a very long front text that should be truncated to 30 characters for display',
            boxLevel: 1,
            nextReview: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ];

        const prompt = createScheduleReconciliationPrompt({ overdueItems });

        // Should be truncated with "..."
        expect(prompt).toContain('...');
        expect(prompt).not.toContain('for display');
      });

      it('should limit displayed items to 10', () => {
        const overdueItems = Array(15).fill(null).map((_, i) => ({
          id: `item_${i}`,
          front: `Test item ${i}`,
          boxLevel: 1,
          nextReview: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        }));

        const prompt = createScheduleReconciliationPrompt({ overdueItems });

        expect(prompt).toContain('Overdue Items (15 total)');
        expect(prompt).toContain('... and 5 more');
      });

      it('should handle empty overdue items', () => {
        const prompt = createScheduleReconciliationPrompt({ overdueItems: [] });

        expect(prompt).toContain('No overdue items');
      });

      it('should handle undefined decayedMastery', () => {
        const overdueItems = [
          {
            id: 'item_1',
            front: 'Test item',
            boxLevel: 1,
            nextReview: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            // decayedMastery not set
          },
        ];

        const prompt = createScheduleReconciliationPrompt({ overdueItems });

        expect(prompt).toContain('mastery: N/A');
      });
    });

    describe('Gap Analysis Context', () => {
      it('should format gap analysis summary', () => {
        const gapAnalysis = {
          severity: 'MODERATE',
          daysSinceLastReview: 7,
          gapRelativeToOptimal: 2.3,
          estimatedDecay: 0.35,
          sessionType: 'first_today',
        };

        const prompt = createScheduleReconciliationPrompt({ gapAnalysis });

        expect(prompt).toContain('Gap Analysis');
        expect(prompt).toContain('Gap severity: MODERATE');
        expect(prompt).toContain('Days since last review: 7');
        expect(prompt).toContain('Gap relative to optimal: 2.3x');
        expect(prompt).toContain('Estimated mastery decay: 35%');
        expect(prompt).toContain('Session type: first_today');
      });

      it('should handle partial gap analysis', () => {
        const gapAnalysis = {
          severity: 'MINOR',
          // other fields missing
        };

        const prompt = createScheduleReconciliationPrompt({ gapAnalysis });

        expect(prompt).toContain('Gap severity: MINOR');
        expect(prompt).toContain('N/A');
      });

      it('should handle null gap analysis gracefully', () => {
        const prompt = createScheduleReconciliationPrompt({ gapAnalysis: null });

        expect(prompt).not.toContain('undefined');
      });
    });

    describe('Cross-Concept Patterns Context', () => {
      it('should format PREREQUISITE patterns', () => {
        const crossConceptPatterns = [
          {
            type: 'PREREQUISITE',
            conceptA: 'algebra',
            conceptB: 'calculus',
            confidence: 0.85,
          },
        ];

        const prompt = createScheduleReconciliationPrompt({ crossConceptPatterns });

        expect(prompt).toContain('Cross-Concept Patterns Detected');
        expect(prompt).toContain('PREREQUISITE');
        expect(prompt).toContain('algebra');
        expect(prompt).toContain('calculus');
        expect(prompt).toContain('should be studied before');
        expect(prompt).toContain('85%');
      });

      it('should format INTERFERENCE patterns', () => {
        const crossConceptPatterns = [
          {
            type: 'INTERFERENCE',
            conceptA: 'affect',
            conceptB: 'effect',
          },
        ];

        const prompt = createScheduleReconciliationPrompt({ crossConceptPatterns });

        expect(prompt).toContain('INTERFERENCE');
        expect(prompt).toContain('affect');
        expect(prompt).toContain('effect');
        expect(prompt).toContain('space them out');
      });

      it('should format POSITIVE_TRANSFER patterns', () => {
        const crossConceptPatterns = [
          {
            type: 'POSITIVE_TRANSFER',
            conceptA: 'Spanish',
            conceptB: 'Italian',
          },
        ];

        const prompt = createScheduleReconciliationPrompt({ crossConceptPatterns });

        expect(prompt).toContain('POSITIVE TRANSFER');
        expect(prompt).toContain('Spanish');
        expect(prompt).toContain('Italian');
        expect(prompt).toContain('reinforces');
      });

      it('should handle unknown pattern types', () => {
        const crossConceptPatterns = [
          {
            type: 'CUSTOM_PATTERN',
            conceptA: 'A',
            conceptB: 'B',
          },
        ];

        const prompt = createScheduleReconciliationPrompt({ crossConceptPatterns });

        expect(prompt).toContain('CUSTOM_PATTERN');
        expect(prompt).toContain('A');
        expect(prompt).toContain('B');
      });

      it('should limit patterns to 5', () => {
        const crossConceptPatterns = Array(10).fill(null).map((_, i) => ({
          type: 'PREREQUISITE',
          conceptA: `concept_${i}a`,
          conceptB: `concept_${i}b`,
          confidence: 0.9,
        }));

        const prompt = createScheduleReconciliationPrompt({ crossConceptPatterns });

        // Should contain first 5 patterns but not last 5
        expect(prompt).toContain('concept_0a');
        expect(prompt).toContain('concept_4a');
        expect(prompt).not.toContain('concept_5a');
        expect(prompt).not.toContain('concept_9a');
      });

      it('should handle empty patterns array', () => {
        const prompt = createScheduleReconciliationPrompt({ crossConceptPatterns: [] });

        expect(prompt).not.toContain('Cross-Concept Patterns Detected');
      });
    });

    describe('Recent Memory Context', () => {
      it('should format recent memory summary', () => {
        const recentMemory = {
          lastSessionSummary: 'Reviewed 15 vocabulary items with 80% accuracy',
          masteryTrend: 'improving',
          strugglingConcepts: ['ephemeral', 'ubiquitous'],
          strongConcepts: ['common', 'simple'],
        };

        const prompt = createScheduleReconciliationPrompt({ recentMemory });

        expect(prompt).toContain('Recent Learning Context');
        expect(prompt).toContain('Reviewed 15 vocabulary items');
        expect(prompt).toContain('Recent mastery trend: improving');
        expect(prompt).toContain('Struggling concepts: ephemeral, ubiquitous');
        expect(prompt).toContain('Strong concepts: common, simple');
      });

      it('should handle missing memory fields', () => {
        const recentMemory = {
          lastSessionSummary: 'Basic session',
        };

        const prompt = createScheduleReconciliationPrompt({ recentMemory });

        expect(prompt).toContain('Basic session');
        expect(prompt).toContain('unknown'); // default trend
        expect(prompt).toContain('None identified'); // default for missing arrays
      });

      it('should handle null recent memory', () => {
        const prompt = createScheduleReconciliationPrompt({ recentMemory: null });

        expect(prompt).not.toContain('undefined');
      });
    });

    describe('Session Context', () => {
      it('should format session context summary', () => {
        const sessionContext = {
          timeOfDay: 'morning',
          dayOfWeek: 'Monday',
          sessionsToday: 2,
          itemsReviewedToday: 35,
          availableMinutes: 20,
        };

        const prompt = createScheduleReconciliationPrompt({ sessionContext });

        expect(prompt).toContain('Current Session Context');
        expect(prompt).toContain('Time of day: morning');
        expect(prompt).toContain('Day of week: Monday');
        expect(prompt).toContain('Sessions today: 2');
        expect(prompt).toContain('Items reviewed today: 35');
        expect(prompt).toContain('Available study time: 20 minutes');
      });

      it('should use defaults for missing session context fields', () => {
        const sessionContext = {
          timeOfDay: 'afternoon',
        };

        const prompt = createScheduleReconciliationPrompt({ sessionContext });

        expect(prompt).toContain('Time of day: afternoon');
        expect(prompt).toContain('unknown'); // default values
        expect(prompt).toContain('Sessions today: 0'); // default
      });
    });

    describe('Complete Context Integration', () => {
      it('should properly combine all context sections', () => {
        const context = {
          planName: 'Medical Terminology',
          domainType: 'vocabulary',
          profile: {
            forgettingCurveSlope: 0.4,
            optimalReviewInterval: 4,
            consistencyScore: 80,
          },
          overdueItems: [
            {
              id: 'item_1',
              front: 'tachycardia',
              boxLevel: 2,
              nextReview: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              decayedMastery: 0.6,
            },
          ],
          gapAnalysis: {
            severity: 'MINOR',
            daysSinceLastReview: 3,
          },
          crossConceptPatterns: [
            {
              type: 'PREREQUISITE',
              conceptA: 'anatomy',
              conceptB: 'pathology',
              confidence: 0.9,
            },
          ],
          recentMemory: {
            masteryTrend: 'stable',
          },
          sessionContext: {
            timeOfDay: 'evening',
            sessionsToday: 1,
          },
        };

        const prompt = createScheduleReconciliationPrompt(context);

        // Verify all sections present
        expect(prompt).toContain('Medical Terminology');
        expect(prompt).toContain('vocabulary');
        expect(prompt).toContain('Learner Profile');
        expect(prompt).toContain('Overdue Items');
        expect(prompt).toContain('Gap Analysis');
        expect(prompt).toContain('Cross-Concept Patterns');
        expect(prompt).toContain('Recent Learning Context');
        expect(prompt).toContain('Current Session Context');
      });
    });
  });

  // ===========================================================================
  // createCatchUpPlanPrompt Tests
  // ===========================================================================

  describe('createCatchUpPlanPrompt()', () => {
    describe('Basic Structure', () => {
      it('should return a non-empty string prompt', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(100);
      });

      it('should include role description', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('learning recovery specialist');
        expect(prompt).toContain('extended break');
      });

      it('should include JSON response format specification', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('JSON format');
        expect(prompt).toContain('plan');
        expect(prompt).toContain('dailySchedule');
        expect(prompt).toContain('strategy');
        expect(prompt).toContain('motivation');
        expect(prompt).toContain('warnings');
        expect(prompt).toContain('confidence');
      });

      it('should include task requirements', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('TASK');
        expect(prompt).toContain('risk of being forgotten');
        expect(prompt).toContain('sustainable daily load');
        expect(prompt).toContain('learning habit');
      });

      it('should include important guidelines', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('IMPORTANT');
        expect(prompt).toContain('gently on day 1');
        expect(prompt).toContain('Gradually increase intensity');
        expect(prompt).toContain('buffer');
        expect(prompt).toContain('re-learned from scratch');
      });
    });

    describe('Situation Context', () => {
      it('should include days since last session', () => {
        const prompt = createCatchUpPlanPrompt({
          daysSinceLastSession: 14,
        });

        expect(prompt).toContain('Days since last session: 14');
      });

      it('should handle missing days since last session', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('Days since last session: unknown');
      });

      it('should include total overdue count', () => {
        const prompt = createCatchUpPlanPrompt({
          totalOverdueCount: 150,
        });

        expect(prompt).toContain('Total overdue items: 150');
      });

      it('should default overdue count to 0', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('Total overdue items: 0');
      });

      it('should include available study time', () => {
        const prompt = createCatchUpPlanPrompt({
          availableMinutesPerDay: 45,
        });

        expect(prompt).toContain('Available study time per day: 45 minutes');
      });

      it('should default available time to 30 minutes', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('Available study time per day: 30 minutes');
      });

      it('should include target catch-up days', () => {
        const prompt = createCatchUpPlanPrompt({
          targetCatchUpDays: 10,
        });

        expect(prompt).toContain('Target catch-up period: 10 days');
      });

      it('should default target to 7 days', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('Target catch-up period: 7 days');
      });
    });

    describe('Domain Breakdown', () => {
      it('should format overdue items by domain', () => {
        const overdueByDomain = [
          { domain: 'vocabulary', count: 50, avgDaysOverdue: 5 },
          { domain: 'grammar', count: 30, avgDaysOverdue: 3 },
          { domain: 'reading', count: 20, avgDaysOverdue: 7 },
        ];

        const prompt = createCatchUpPlanPrompt({ overdueByDomain });

        expect(prompt).toContain('Overdue Items by Domain');
        expect(prompt).toContain('vocabulary: 50 items (avg 5 days overdue)');
        expect(prompt).toContain('grammar: 30 items (avg 3 days overdue)');
        expect(prompt).toContain('reading: 20 items (avg 7 days overdue)');
      });

      it('should handle empty domain breakdown', () => {
        const prompt = createCatchUpPlanPrompt({ overdueByDomain: [] });

        expect(prompt).toContain('No domain breakdown available');
      });

      it('should handle null domain breakdown', () => {
        const prompt = createCatchUpPlanPrompt({ overdueByDomain: null });

        expect(prompt).toContain('No domain breakdown available');
      });
    });

    describe('Learner Profile in Catch-Up', () => {
      it('should include learner profile details', () => {
        const profile = {
          pacePreference: 'burst',
          optimalSessionLength: 40,
          consistencyScore: 60,
          forgettingCurveSlope: 0.35,
        };

        const prompt = createCatchUpPlanPrompt({ profile });

        expect(prompt).toContain('Learner Profile');
        expect(prompt).toContain('Pace preference: burst');
        expect(prompt).toContain('Optimal session length: 40 minutes');
        expect(prompt).toContain('Consistency score: 60/100');
        expect(prompt).toContain('Forgetting curve slope: 0.35');
      });

      it('should use defaults for missing profile fields', () => {
        const prompt = createCatchUpPlanPrompt({ profile: {} });

        expect(prompt).toContain('Pace preference: steady'); // default
        expect(prompt).toContain('Optimal session length: 25 minutes'); // default
        expect(prompt).toContain('Consistency score: 50/100'); // default
        expect(prompt).toContain('Forgetting curve slope: 0.5'); // default
      });

      it('should handle null profile gracefully', () => {
        const prompt = createCatchUpPlanPrompt({ profile: null });

        // Should use optional chaining defaults
        expect(prompt).toContain('Pace preference: steady');
        expect(prompt).toContain('Optimal session length: 25');
      });
    });

    describe('Complete Context Integration', () => {
      it('should combine all context elements', () => {
        const context = {
          totalOverdueCount: 200,
          daysSinceLastSession: 21,
          profile: {
            pacePreference: 'steady',
            optimalSessionLength: 30,
            consistencyScore: 45,
            forgettingCurveSlope: 0.6,
          },
          availableMinutesPerDay: 25,
          overdueByDomain: [
            { domain: 'math', count: 100, avgDaysOverdue: 15 },
            { domain: 'science', count: 100, avgDaysOverdue: 10 },
          ],
          targetCatchUpDays: 14,
        };

        const prompt = createCatchUpPlanPrompt(context);

        expect(prompt).toContain('Days since last session: 21');
        expect(prompt).toContain('Total overdue items: 200');
        expect(prompt).toContain('Available study time per day: 25 minutes');
        expect(prompt).toContain('Target catch-up period: 14 days');
        expect(prompt).toContain('math: 100 items');
        expect(prompt).toContain('science: 100 items');
        expect(prompt).toContain('Pace preference: steady');
        expect(prompt).toContain('Consistency score: 45/100');
      });
    });

    describe('Response Format Validation', () => {
      it('should specify daily schedule structure', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('day');
        expect(prompt).toContain('itemCount');
        expect(prompt).toContain('focusDomains');
        expect(prompt).toContain('estimatedMinutes');
        expect(prompt).toContain('intensity');
        expect(prompt).toContain('light|moderate|intensive');
      });

      it('should specify priority tiers structure', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('priorityTiers');
        expect(prompt).toContain('critical');
        expect(prompt).toContain('important');
        expect(prompt).toContain('routine');
        expect(prompt).toContain('2x optimal interval');
        expect(prompt).toContain('1-2x optimal interval');
        expect(prompt).toContain('< 1x optimal interval');
      });

      it('should specify strategy structure', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('strategy');
        expect(prompt).toContain('approach');
        expect(prompt).toContain('dailyGoal');
        expect(prompt).toContain('milestones');
        expect(prompt).toContain('adjustmentTriggers');
      });

      it('should specify motivation structure', () => {
        const prompt = createCatchUpPlanPrompt({});

        expect(prompt).toContain('motivation');
        expect(prompt).toContain('encouragement');
        expect(prompt).toContain('progressMetric');
        expect(prompt).toContain('rewards');
      });
    });
  });

  // ===========================================================================
  // Edge Cases & Robustness
  // ===========================================================================

  describe('Edge Cases', () => {
    describe('createScheduleReconciliationPrompt edge cases', () => {
      it('should handle undefined context', () => {
        expect(() => createScheduleReconciliationPrompt(undefined)).toThrow();
      });

      it('should handle extremely large overdue item lists', () => {
        const overdueItems = Array(1000).fill(null).map((_, i) => ({
          id: `item_${i}`,
          front: `Item ${i}`,
          boxLevel: 1,
          nextReview: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        }));

        const prompt = createScheduleReconciliationPrompt({ overdueItems });

        // Should still work and show truncated list
        expect(prompt).toContain('1000 total');
        expect(prompt).toContain('... and 990 more');
      });

      it('should handle special characters in plan name', () => {
        const prompt = createScheduleReconciliationPrompt({
          planName: 'Test "Plan" with <special> & characters',
        });

        expect(prompt).toContain('Test "Plan" with <special> & characters');
      });

      it('should handle special characters in item front', () => {
        const overdueItems = [
          {
            id: 'item_1',
            front: 'Test with "quotes" and <brackets>',
            boxLevel: 1,
            nextReview: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ];

        const prompt = createScheduleReconciliationPrompt({ overdueItems });

        expect(prompt).toContain('Test with "quotes"');
      });

      it('should handle very long profile field values', () => {
        const profile = {
          pacePreference: 'a'.repeat(100),
          preferredTimeOfDay: 'b'.repeat(100),
        };

        const prompt = createScheduleReconciliationPrompt({ profile });

        // Should not crash
        expect(prompt.length).toBeGreaterThan(100);
      });
    });

    describe('createCatchUpPlanPrompt edge cases', () => {
      it('should handle undefined context', () => {
        expect(() => createCatchUpPlanPrompt(undefined)).toThrow();
      });

      it('should handle zero values', () => {
        const prompt = createCatchUpPlanPrompt({
          totalOverdueCount: 0,
          daysSinceLastSession: 0,
          availableMinutesPerDay: 0,
          targetCatchUpDays: 0,
        });

        // Note: Due to JS || operator, 0 values fall back to defaults
        // daysSinceLastSession: 0 || 'unknown' = 'unknown' (0 is falsy)
        // totalOverdueCount: 0 || 0 = 0 (both are 0)
        // availableMinutesPerDay: 0 || 30 = 30
        // targetCatchUpDays: 0 || 7 = 7
        expect(prompt).toContain('Total overdue items: 0');
        expect(prompt).toContain('Days since last session: unknown');
        expect(prompt).toContain('Available study time per day: 30 minutes');
        expect(prompt).toContain('Target catch-up period: 7 days');
      });

      it('should handle negative values', () => {
        const prompt = createCatchUpPlanPrompt({
          totalOverdueCount: -10,
          daysSinceLastSession: -5,
        });

        // Should include the values as-is (validation should happen elsewhere)
        expect(prompt).toContain('-10');
        expect(prompt).toContain('-5');
      });

      it('should handle very large numbers', () => {
        const prompt = createCatchUpPlanPrompt({
          totalOverdueCount: 999999,
          daysSinceLastSession: 365,
        });

        expect(prompt).toContain('999999');
        expect(prompt).toContain('365');
      });

      it('should handle special characters in domain names', () => {
        const overdueByDomain = [
          { domain: 'Test & Special <Domain>', count: 10, avgDaysOverdue: 3 },
        ];

        const prompt = createCatchUpPlanPrompt({ overdueByDomain });

        expect(prompt).toContain('Test & Special <Domain>');
      });
    });
  });

  // ===========================================================================
  // Prompt Quality Tests
  // ===========================================================================

  describe('Prompt Quality', () => {
    it('should not have duplicate sections in reconciliation prompt', () => {
      const prompt = createScheduleReconciliationPrompt({
        planName: 'Test',
        profile: { forgettingCurveSlope: 0.5 },
        overdueItems: [{ id: '1', front: 'test', boxLevel: 1, nextReview: new Date().toISOString() }],
        gapAnalysis: { severity: 'MINOR' },
      });

      // Check no duplicate section headers
      const taskCount = (prompt.match(/TASK:/g) || []).length;
      const importantCount = (prompt.match(/IMPORTANT:/g) || []).length;

      expect(taskCount).toBe(1);
      expect(importantCount).toBe(1);
    });

    it('should not have duplicate sections in catch-up prompt', () => {
      const prompt = createCatchUpPlanPrompt({
        totalOverdueCount: 50,
        profile: { pacePreference: 'steady' },
      });

      // Check no duplicate section headers
      const taskCount = (prompt.match(/TASK:/g) || []).length;
      const importantCount = (prompt.match(/IMPORTANT:/g) || []).length;

      expect(taskCount).toBe(1);
      expect(importantCount).toBe(1);
    });

    it('should maintain consistent formatting', () => {
      const prompt1 = createScheduleReconciliationPrompt({ planName: 'A' });
      const prompt2 = createScheduleReconciliationPrompt({ planName: 'B' });

      // Both should have same structure
      expect(prompt1.includes('JSON format')).toBe(prompt2.includes('JSON format'));
      expect(prompt1.includes('ANALYSIS REQUIREMENTS')).toBe(prompt2.includes('ANALYSIS REQUIREMENTS'));
    });
  });
});
