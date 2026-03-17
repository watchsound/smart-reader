/**
 * Unit tests for Memory Consolidation Prompts
 *
 * Tests the prompt generation functions used for LLM-powered
 * memory consolidation in the Learning Brain system.
 */

const {
  createMemoryConsolidationPrompt,
  formatEpisodesForConsolidation,
} = require('../../commons/utils/AIPrompts');

describe('formatEpisodesForConsolidation', () => {
  describe('basic formatting', () => {
    it('should format a single episode', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: {},
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);

      expect(result).toContain('[1]');
      expect(result).toContain('REVIEW_COMPLETED');
    });

    it('should format multiple episodes with sequential numbering', () => {
      const episodes = [
        { timestamp: '2024-01-15T10:00:00Z', eventType: 'REVIEW_COMPLETED', payload: {} },
        { timestamp: '2024-01-15T10:05:00Z', eventType: 'REVIEW_COMPLETED', payload: {} },
        { timestamp: '2024-01-15T10:10:00Z', eventType: 'REVIEW_COMPLETED', payload: {} },
      ];

      const result = formatEpisodesForConsolidation(episodes);
      const lines = result.split('\n');

      expect(lines[0]).toContain('[1]');
      expect(lines[1]).toContain('[2]');
      expect(lines[2]).toContain('[3]');
    });

    it('should handle empty episodes array', () => {
      const result = formatEpisodesForConsolidation([]);
      expect(result).toBe('');
    });
  });

  describe('payload details', () => {
    it('should include correct/incorrect status', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: { wasCorrect: true },
        },
        {
          timestamp: '2024-01-15T10:05:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: { wasCorrect: false },
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);

      expect(result).toContain('Correct');
      expect(result).toContain('Incorrect');
    });

    it('should include rating when present', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: { rating: 3 },
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);

      expect(result).toContain('(rating: 3)');
    });

    it('should indicate hint usage', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: { hintUsed: true },
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);

      expect(result).toContain('[hint used]');
    });

    it('should show box progression', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: { previousBox: 2, newBox: 3 },
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);

      expect(result).toContain('→ Box 3');
      expect(result).toContain('(from Box 2)');
    });

    it('should include response time', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: { responseTimeMs: 2500 },
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);

      expect(result).toContain('[2500ms]');
    });

    it('should combine multiple payload properties', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: {
            wasCorrect: true,
            rating: 4,
            hintUsed: false,
            previousBox: 1,
            newBox: 2,
            responseTimeMs: 1500,
          },
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);

      expect(result).toContain('Correct');
      expect(result).toContain('(rating: 4)');
      expect(result).toContain('→ Box 2');
      expect(result).toContain('(from Box 1)');
      expect(result).toContain('[1500ms]');
      // Should NOT contain hint marker since hintUsed is false
      expect(result).not.toContain('[hint used]');
    });
  });

  describe('timestamp handling', () => {
    it('should use timestamp field', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: {},
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);
      // Just verify it doesn't crash and includes the event type
      expect(result).toContain('REVIEW_COMPLETED');
    });

    it('should fallback to t_valid if timestamp is missing', () => {
      const episodes = [
        {
          t_valid: '2024-01-15T10:30:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: {},
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);
      expect(result).toContain('REVIEW_COMPLETED');
    });
  });

  describe('different event types', () => {
    it('should handle various event types', () => {
      const episodes = [
        { timestamp: '2024-01-15T10:00:00Z', eventType: 'SESSION_STARTED', payload: {} },
        { timestamp: '2024-01-15T10:01:00Z', eventType: 'REVIEW_COMPLETED', payload: { wasCorrect: true } },
        { timestamp: '2024-01-15T10:02:00Z', eventType: 'QUIZ_TAKEN', payload: { wasCorrect: false } },
        { timestamp: '2024-01-15T10:03:00Z', eventType: 'MASTERY_CHANGED', payload: { newBox: 3 } },
        { timestamp: '2024-01-15T10:10:00Z', eventType: 'SESSION_ENDED', payload: {} },
      ];

      const result = formatEpisodesForConsolidation(episodes);

      expect(result).toContain('SESSION_STARTED');
      expect(result).toContain('REVIEW_COMPLETED');
      expect(result).toContain('QUIZ_TAKEN');
      expect(result).toContain('MASTERY_CHANGED');
      expect(result).toContain('SESSION_ENDED');
    });
  });

  describe('edge cases', () => {
    it('should handle missing payload', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          eventType: 'REVIEW_COMPLETED',
          // No payload
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);
      expect(result).toContain('REVIEW_COMPLETED');
    });

    it('should handle null payload', () => {
      const episodes = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          eventType: 'REVIEW_COMPLETED',
          payload: null,
        },
      ];

      const result = formatEpisodesForConsolidation(episodes);
      expect(result).toContain('REVIEW_COMPLETED');
    });
  });
});

describe('createMemoryConsolidationPrompt', () => {
  const sampleEpisodes = [
    {
      timestamp: '2024-01-15T10:00:00Z',
      eventType: 'REVIEW_COMPLETED',
      payload: { wasCorrect: true, rating: 3 },
    },
    {
      timestamp: '2024-01-15T10:05:00Z',
      eventType: 'REVIEW_COMPLETED',
      payload: { wasCorrect: false, rating: 1 },
    },
  ];

  describe('basic structure', () => {
    it('should include concept name in prompt', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'ephemeral');

      expect(result).toContain('"ephemeral"');
      expect(result).toContain('concept');
    });

    it('should include episode timeline', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'vocabulary');

      expect(result).toContain('Episode Timeline');
      expect(result).toContain('REVIEW_COMPLETED');
    });

    it('should include analysis requirements', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test');

      expect(result).toContain('ANALYSIS REQUIREMENTS');
      expect(result).toContain('progression over time');
      expect(result).toContain('learning style indicators');
    });

    it('should include JSON response format', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test');

      expect(result).toContain('JSON format');
      expect(result).toContain('"summary"');
      expect(result).toContain('"keyInsights"');
      expect(result).toContain('"masteryAssessment"');
      expect(result).toContain('"learningStyle"');
      expect(result).toContain('"progressionNarrative"');
      expect(result).toContain('"strugglingAreas"');
      expect(result).toContain('"breakthroughMoments"');
      expect(result).toContain('"recommendations"');
      expect(result).toContain('"metrics"');
    });
  });

  describe('without process analysis', () => {
    it('should work without process analysis', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test');

      expect(result).not.toContain('Learning Process Analysis:');
      expect(result).toContain('Episode Timeline');
    });

    it('should handle null process analysis', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', null);

      expect(result).not.toContain('Learning Process Analysis:');
    });
  });

  describe('with process analysis', () => {
    const processAnalysis = {
      totalReviews: 10,
      correctCount: 7,
      incorrectCount: 3,
      accuracy: 70,
      boxProgression: [{ time: '2024-01-15T10:00:00Z', box: 2 }],
      strugglePatterns: [{ start: '2024-01-15T10:02:00Z', attemptsToSuccess: 3 }],
      isCramming: false,
      avgResponseTimeMs: 2500,
      hintUsage: 2,
    };

    it('should include process analysis section', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('Learning Process Analysis:');
    });

    it('should include total reviews', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('Total reviews: 10');
    });

    it('should include correct/incorrect counts', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('Correct answers: 7');
      expect(result).toContain('Incorrect answers: 3');
    });

    it('should include accuracy', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('Accuracy: 70%');
    });

    it('should include box progression', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('Box progression:');
      expect(result).toContain('"box":2');
    });

    it('should include struggle patterns count', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('Struggle patterns detected: 1');
    });

    it('should indicate cramming status - not cramming', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('Cramming detected: No');
    });

    it('should indicate cramming status - cramming', () => {
      const crammingAnalysis = { ...processAnalysis, isCramming: true };
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', crammingAnalysis);

      expect(result).toContain('Cramming detected: Yes');
    });

    it('should include average response time', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('Average response time: 2500ms');
    });

    it('should include hint usage', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('Hints used: 2');
    });
  });

  describe('with partial process analysis', () => {
    it('should handle missing fields with defaults', () => {
      const partialAnalysis = {
        totalReviews: 5,
        // Missing other fields
      };

      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', partialAnalysis);

      expect(result).toContain('Total reviews: 5');
      expect(result).toContain('Correct answers: 0');
      expect(result).toContain('Incorrect answers: 0');
      expect(result).toContain('Accuracy: 0%');
      expect(result).toContain('Box progression: []');
      expect(result).toContain('Struggle patterns detected: 0');
      expect(result).toContain('Cramming detected: No');
    });

    it('should handle missing avgResponseTimeMs', () => {
      const partialAnalysis = {
        totalReviews: 5,
        accuracy: 80,
        // No avgResponseTimeMs
      };

      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', partialAnalysis);

      expect(result).toContain('Average response time: N/Ams');
    });
  });

  describe('metrics in JSON template', () => {
    it('should inject metrics from process analysis into JSON template', () => {
      const processAnalysis = {
        totalReviews: 15,
        accuracy: 80,
        avgResponseTimeMs: 3000,
      };

      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', processAnalysis);

      expect(result).toContain('"totalReviews": 15');
      expect(result).toContain('"correctRate": 80');
      expect(result).toContain('"averageResponseTimeMs": 3000');
    });

    it('should use episode count as fallback for totalReviews', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test');

      // sampleEpisodes has 2 items
      expect(result).toContain('"totalReviews": 2');
    });

    it('should include consistencyScore guidance', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test');

      expect(result).toContain('"consistencyScore"');
      expect(result).toContain('100=very consistent');
    });
  });

  describe('mastery and learning style enums', () => {
    it('should include valid mastery assessment options', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test');

      expect(result).toContain('beginner|developing|proficient|mastered');
    });

    it('should include valid learning style options', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test');

      expect(result).toContain('quick|steady|needs-repetition|variable');
    });
  });

  describe('edge cases', () => {
    it('should handle empty episodes array', () => {
      const result = createMemoryConsolidationPrompt([], 'test');

      expect(result).toContain('test');
      expect(result).toContain('Episode Timeline');
    });

    it('should handle concept names with special characters', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, "don't/can't");

      expect(result).toContain("don't/can't");
    });

    it('should handle very long concept names', () => {
      const longName = 'a'.repeat(200);
      const result = createMemoryConsolidationPrompt(sampleEpisodes, longName);

      expect(result).toContain(longName);
    });
  });

  describe('prompt quality', () => {
    it('should be a well-structured prompt', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test', {
        totalReviews: 10,
        accuracy: 75,
      });

      // Check for key structural elements
      expect(result).toContain('You are a learning analytics assistant');
      expect(result).toContain('TASK:');
      expect(result).toContain('ANALYSIS REQUIREMENTS:');
      expect(result).toContain('Respond in JSON format:');

      // Check it's reasonably long (should be comprehensive)
      expect(result.length).toBeGreaterThan(500);
    });

    it('should produce parseable JSON structure description', () => {
      const result = createMemoryConsolidationPrompt(sampleEpisodes, 'test');

      // Extract JSON part (between first { and last })
      const jsonMatch = result.match(/\{[\s\S]*"summary"[\s\S]*\}/);
      expect(jsonMatch).not.toBeNull();

      // The JSON template should have proper structure hints
      const jsonPart = jsonMatch[0];
      expect(jsonPart).toContain('"summary"');
      expect(jsonPart).toContain('"keyInsights"');
      expect(jsonPart).toContain('"metrics"');
    });
  });
});
