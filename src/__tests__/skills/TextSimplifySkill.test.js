/**
 * TextSimplifySkill Tests
 */

const TextSimplifySkill = require('../../main/skills/ai/TextSimplifySkill');

describe('TextSimplifySkill', () => {
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

  describe('Static Properties', () => {
    test('should have correct name', () => {
      expect(TextSimplifySkill.name).toBe('text_simplify');
    });

    test('should have description', () => {
      expect(TextSimplifySkill.description).toBeTruthy();
    });

    test('should have correct parameters', () => {
      const params = TextSimplifySkill.parameters;
      expect(params.text).toBeDefined();
      expect(params.targetLevel).toBeDefined();
      expect(params.vocabularyLimit).toBeDefined();
      expect(params.preserveHtml).toBeDefined();
    });

    test('should have text as required param', () => {
      expect(TextSimplifySkill.requiredParams).toEqual(['text']);
    });

    test('should be in ai category', () => {
      expect(TextSimplifySkill.category).toBe('ai');
    });

    test('targetLevel should have correct enum values', () => {
      expect(TextSimplifySkill.parameters.targetLevel.enum).toEqual([
        'elementary',
        'middle',
        'high',
        'college',
      ]);
    });

    test('targetLevel should default to middle', () => {
      expect(TextSimplifySkill.parameters.targetLevel.default).toBe('middle');
    });
  });

  describe('execute - Level-based Simplification', () => {
    test('should simplify text for elementary level', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          simplifiedText: 'The big cat ran fast.',
        }),
      );

      const skill = new TextSimplifySkill(mockContext);
      const result = await skill.execute({
        text: 'The magnificent feline sprinted at tremendous velocity.',
        targetLevel: 'elementary',
      });

      expect(result.simplifiedText).toBe('The big cat ran fast.');
      expect(result.targetLevel).toBe('elementary');
      expect(result.originalText).toBe(
        'The magnificent feline sprinted at tremendous velocity.',
      );
      expect(result.simplificationRatio).toBeDefined();
    });

    test('should use default level when not specified', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          simplifiedText: 'The cat ran quickly.',
        }),
      );

      const skill = new TextSimplifySkill(mockContext);
      const result = await skill.execute({
        text: 'The cat ran quickly.',
      });

      expect(result.targetLevel).toBe('middle');
    });

    test('should calculate simplification ratio', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          simplifiedText: 'Cat ran.',
        }),
      );

      const skill = new TextSimplifySkill(mockContext);
      const result = await skill.execute({
        text: 'The cat ran fast.',
        targetLevel: 'elementary',
      });

      // 2 words / 4 words = 0.5
      expect(result.simplificationRatio).toBe(0.5);
    });
  });

  describe('execute - Vocabulary-limited Simplification', () => {
    test('should simplify using vocabulary limit', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          simplifiedText: 'The man went to the big building.',
        }),
      );

      const skill = new TextSimplifySkill(mockContext);
      const result = await skill.execute({
        text: 'The gentleman proceeded to the magnificent edifice.',
        vocabularyLimit: 1000,
      });

      expect(result.simplifiedText).toBe('The man went to the big building.');
      expect(result.vocabularyLimit).toBe(1000);
    });
  });

  describe('execute - HTML Preservation', () => {
    test('should preserve HTML when option is set', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          simplifiedText: '<p>The <strong>big</strong> cat ran.</p>',
        }),
      );

      const skill = new TextSimplifySkill(mockContext);
      const result = await skill.execute({
        text: '<p>The <strong>magnificent</strong> feline sprinted.</p>',
        preserveHtml: true,
      });

      expect(result.simplifiedText).toContain('<p>');
      expect(result.simplifiedText).toContain('<strong>');
    });
  });

  describe('buildLevelPrompt', () => {
    test('should build prompt with level instructions', () => {
      const skill = new TextSimplifySkill(mockContext);
      const prompt = skill.buildLevelPrompt('Test text', 'elementary', false);

      expect(prompt).toContain('elementary');
      expect(prompt).toContain('Test text');
      expect(prompt).toContain('simplifiedText');
    });

    test('should include HTML note when preserveHtml is true', () => {
      const skill = new TextSimplifySkill(mockContext);
      const prompt = skill.buildLevelPrompt('Test text', 'middle', true);

      expect(prompt).toContain('Preserve all HTML tags');
    });
  });

  describe('buildVocabularyLimitPrompt', () => {
    test('should build prompt with vocabulary limit', () => {
      const skill = new TextSimplifySkill(mockContext);
      const prompt = skill.buildVocabularyLimitPrompt('Test text', 1000, false);

      expect(prompt).toContain('1000');
      expect(prompt).toContain('most frequently used English words');
    });
  });

  describe('parseResponse', () => {
    test('should parse JSON response', () => {
      const skill = new TextSimplifySkill(mockContext);
      const result = skill.parseResponse(
        JSON.stringify({ simplifiedText: 'Simple text' }),
      );

      expect(result.simplifiedText).toBe('Simple text');
    });

    test('should handle modified-html field', () => {
      const skill = new TextSimplifySkill(mockContext);
      const result = skill.parseResponse(
        JSON.stringify({ 'modified-html': '<p>Simple</p>' }),
      );

      expect(result.simplifiedText).toBe('<p>Simple</p>');
    });

    test('should fallback to raw text on parse error', () => {
      const skill = new TextSimplifySkill(mockContext);
      const result = skill.parseResponse('Simple text without JSON');

      expect(result.simplifiedText).toBe('Simple text without JSON');
    });

    test('should handle array response format', () => {
      const skill = new TextSimplifySkill(mockContext);
      const result = skill.parseResponse([
        { type: 'text', text: '{"simplifiedText": "Simple"}' },
      ]);

      expect(result.simplifiedText).toBe('Simple');
    });
  });

  describe('Error Handling', () => {
    test('should throw error if AI provider not available', async () => {
      const skill = new TextSimplifySkill({ token: 'test' });
      await expect(skill.execute({ text: 'test' })).rejects.toThrow(
        'AI provider not available',
      );
    });
  });
});
