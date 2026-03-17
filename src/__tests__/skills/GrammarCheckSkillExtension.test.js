/**
 * GrammarCheckSkill Extension Tests
 *
 * Tests for the compareWith and generateExercises extension features.
 */

const GrammarCheckSkill = require('../../main/skills/ai/GrammarCheckSkill');

describe('GrammarCheckSkill Extension', () => {
  const mockAIProvider = {
    generateContent: jest.fn(),
  };

  const mockContext = {
    aiProvider: mockAIProvider,
    token: 'test-token',
    userId: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Extended Parameters', () => {
    test('should have compareWith parameter', () => {
      expect(GrammarCheckSkill.parameters.compareWith).toBeDefined();
      expect(GrammarCheckSkill.parameters.compareWith.type).toBe('string');
    });

    test('should have generateExercises parameter', () => {
      expect(GrammarCheckSkill.parameters.generateExercises).toBeDefined();
      expect(GrammarCheckSkill.parameters.generateExercises.type).toBe(
        'boolean',
      );
      expect(GrammarCheckSkill.parameters.generateExercises.default).toBe(
        false,
      );
    });
  });

  describe('Comparison Mode', () => {
    test('should detect issues when comparing student text to original', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          hasErrors: true,
          issues: [
            {
              type: 'Capitalization',
              explain: 'Sentence should start with a capital letter.',
            },
            {
              type: 'Article Usage',
              explain: 'Missing article "the" before "store".',
            },
          ],
        }),
      );

      const skill = new GrammarCheckSkill(mockContext);
      const result = await skill.execute({
        text: 'i went to store yesterday.',
        compareWith: 'I went to the store yesterday.',
      });

      expect(result.mode).toBe('comparison');
      expect(result.hasErrors).toBe(true);
      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].type).toBe('Capitalization');
      expect(result.studentText).toBe('i went to store yesterday.');
      expect(result.originalText).toBe('I went to the store yesterday.');
    });

    test('should return no issues for correct text', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          hasErrors: false,
          issues: [],
        }),
      );

      const skill = new GrammarCheckSkill(mockContext);
      const result = await skill.execute({
        text: 'I went to the store yesterday.',
        compareWith: 'I went to the store yesterday.',
      });

      expect(result.hasErrors).toBe(false);
      expect(result.issues).toEqual([]);
    });

    test('should include exercises when generateExercises is true', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          hasErrors: true,
          issues: [
            {
              type: 'Verb Tense',
              explain: 'Use past tense "went" instead of "go".',
            },
          ],
          exercises: [
            {
              type: 'Verb Tense',
              original: 'I go to the store yesterday.',
              rewriteExercise:
                'Rewrite the sentence using the correct past tense.',
              example: 'I went to the store yesterday.',
            },
          ],
        }),
      );

      const skill = new GrammarCheckSkill(mockContext);
      const result = await skill.execute({
        text: 'I go to the store yesterday.',
        compareWith: 'I went to the store yesterday.',
        generateExercises: true,
      });

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].type).toBe('Verb Tense');
      expect(result.exerciseCount).toBe(1);
    });

    test('should not include exercises when generateExercises is false', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          hasErrors: true,
          issues: [{ type: 'Error', explain: 'Description' }],
        }),
      );

      const skill = new GrammarCheckSkill(mockContext);
      const result = await skill.execute({
        text: 'Error text',
        compareWith: 'Correct text',
        generateExercises: false,
      });

      expect(result.exercises).toEqual([]);
    });

    test('should support different explanation languages', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          hasErrors: true,
          issues: [
            {
              type: 'Article Usage',
              explain: '冠词"the"的使用错误。',
            },
          ],
        }),
      );

      const skill = new GrammarCheckSkill(mockContext);
      await skill.execute({
        text: 'Student text',
        compareWith: 'Original text',
        explanationLanguage: 'chinese',
      });

      const prompt = mockAIProvider.generateContent.mock.calls[0][0];
      expect(prompt).toContain('chinese');
    });
  });

  describe('buildComparisonPrompt', () => {
    test('should build prompt with both texts', () => {
      const skill = new GrammarCheckSkill(mockContext);
      const prompt = skill.buildComparisonPrompt(
        'The original sentence.',
        'The student sentence.',
        'english',
        false,
      );

      expect(prompt).toContain('The original sentence.');
      expect(prompt).toContain('The student sentence.');
      expect(prompt).toContain('original sentence');
      expect(prompt).toContain('what I wrote');
    });

    test('should include exercise instructions when requested', () => {
      const skill = new GrammarCheckSkill(mockContext);
      const prompt = skill.buildComparisonPrompt(
        'Original',
        'Student',
        'english',
        true,
      );

      expect(prompt).toContain('design exercises');
      expect(prompt).toContain('"exercises"');
    });

    test('should include language note for non-English explanations', () => {
      const skill = new GrammarCheckSkill(mockContext);
      const prompt = skill.buildComparisonPrompt(
        'Original',
        'Student',
        'chinese',
        false,
      );

      expect(prompt).toContain('explanations in chinese');
    });
  });

  describe('parseComparisonResponse', () => {
    test('should parse valid JSON response', () => {
      const skill = new GrammarCheckSkill(mockContext);
      const result = skill.parseComparisonResponse(
        JSON.stringify({
          hasErrors: true,
          issues: [{ type: 'Type1', explain: 'Explanation1' }],
          exercises: [{ type: 'Type1', original: 'text', example: 'fixed' }],
        }),
      );

      expect(result.hasErrors).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.exercises).toHaveLength(1);
      expect(result.issueCount).toBe(1);
      expect(result.exerciseCount).toBe(1);
    });

    test('should infer hasErrors from issues array', () => {
      const skill = new GrammarCheckSkill(mockContext);
      const result = skill.parseComparisonResponse(
        JSON.stringify({
          issues: [{ type: 'Error', explain: 'Something wrong' }],
        }),
      );

      expect(result.hasErrors).toBe(true);
    });

    test('should handle array response format', () => {
      const skill = new GrammarCheckSkill(mockContext);
      const result = skill.parseComparisonResponse([
        {
          type: 'text',
          text: '{"hasErrors": true, "issues": [{"type": "Test"}]}',
        },
      ]);

      expect(result.hasErrors).toBe(true);
      expect(result.issues).toHaveLength(1);
    });

    test('should handle malformed JSON gracefully', () => {
      const skill = new GrammarCheckSkill(mockContext);
      const result = skill.parseComparisonResponse('not valid json');

      expect(result.hasErrors).toBe(false);
      expect(result.issues).toEqual([]);
      expect(result.exercises).toEqual([]);
      expect(result.rawResponse).toBe('not valid json');
    });

    test('should handle response with .text property', () => {
      const skill = new GrammarCheckSkill(mockContext);
      const result = skill.parseComparisonResponse({
        text: '{"hasErrors": false, "issues": []}',
      });

      expect(result.hasErrors).toBe(false);
      expect(result.issues).toEqual([]);
    });
  });

  describe('Standard Mode (backward compatibility)', () => {
    test('should use standard mode when compareWith is not provided', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          hasErrors: true,
          correctedText: 'Correct text here.',
          errors: [
            {
              original: 'error',
              correction: 'correct',
              explanation: 'reason',
            },
          ],
        }),
      );

      const skill = new GrammarCheckSkill(mockContext);
      const result = await skill.execute({
        text: 'Text with error here.',
      });

      // Standard mode doesn't have 'mode' property
      expect(result.mode).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.correctedText).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should throw error if AI provider not available', async () => {
      const skill = new GrammarCheckSkill({ token: 'test' });
      await expect(
        skill.execute({
          text: 'test',
          compareWith: 'original',
        }),
      ).rejects.toThrow('AI provider not available');
    });
  });
});
