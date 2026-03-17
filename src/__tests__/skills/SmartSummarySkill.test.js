/**
 * SmartSummarySkill Tests
 */

const SmartSummarySkill = require('../../main/skills/ai/SmartSummarySkill');

describe('SmartSummarySkill', () => {
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
      expect(SmartSummarySkill.name).toBe('smart_summary');
    });

    test('should have description', () => {
      expect(SmartSummarySkill.description).toBeTruthy();
      expect(SmartSummarySkill.description).toContain('vocabulary-constrained');
    });

    test('should have correct parameters', () => {
      const params = SmartSummarySkill.parameters;
      expect(params.text).toBeDefined();
      expect(params.vocabularyWords).toBeDefined();
      expect(params.maxWords).toBeDefined();
    });

    test('should have text as required param', () => {
      expect(SmartSummarySkill.requiredParams).toEqual(['text']);
    });

    test('should be in ai category', () => {
      expect(SmartSummarySkill.category).toBe('ai');
    });

    test('maxWords should default to 20', () => {
      expect(SmartSummarySkill.parameters.maxWords.default).toBe(20);
    });

    test('vocabularyWords should default to empty array', () => {
      expect(SmartSummarySkill.parameters.vocabularyWords.default).toEqual([]);
    });
  });

  describe('execute', () => {
    test('should generate vocabulary-constrained summary', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          summary: 'The cat ran fast.',
          words: ['the', 'cat', 'ran', 'fast'],
          vocabularyUsed: ['cat', 'fast'],
        }),
      );

      const skill = new SmartSummarySkill(mockContext);
      const result = await skill.execute({
        text: 'The cat ran very fast across the yard.',
        vocabularyWords: ['cat', 'fast', 'yard'],
      });

      expect(result.summary).toBe('The cat ran fast.');
      expect(result.words).toEqual(['the', 'cat', 'ran', 'fast']);
      expect(result.vocabularyUsed).toEqual(['cat', 'fast']);
      expect(result.summaryWordCount).toBe(4);
    });

    test('should work without vocabulary words', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          summary: 'A short summary.',
          words: ['a', 'short', 'summary'],
          vocabularyUsed: [],
        }),
      );

      const skill = new SmartSummarySkill(mockContext);
      const result = await skill.execute({
        text: 'A longer text that needs to be summarized.',
      });

      expect(result.summary).toBe('A short summary.');
      expect(result.vocabularyUsed).toEqual([]);
    });

    test('should include source word count', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          summary: 'Summary here.',
          words: ['summary', 'here'],
          vocabularyUsed: [],
        }),
      );

      const skill = new SmartSummarySkill(mockContext);
      const result = await skill.execute({
        text: 'This is a test with eight total words here.',
      });

      expect(result.sourceWordCount).toBe(9);
    });

    test('should respect maxWords parameter', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          summary: 'Brief.',
          words: ['brief'],
          vocabularyUsed: [],
        }),
      );

      const skill = new SmartSummarySkill(mockContext);
      await skill.execute({
        text: 'Long text here',
        maxWords: 10,
      });

      expect(mockAIProvider.generateContent).toHaveBeenCalled();
      const prompt = mockAIProvider.generateContent.mock.calls[0][0];
      expect(prompt).toContain('max 10 words');
    });
  });

  describe('buildPrompt', () => {
    test('should build prompt with vocabulary words', () => {
      const skill = new SmartSummarySkill(mockContext);
      const prompt = skill.buildPrompt(
        'Test text here',
        ['word1', 'word2'],
        15,
      );

      expect(prompt).toContain('Learning Vocabulary');
      expect(prompt).toContain('word1, word2');
      expect(prompt).toContain('max 15 words');
    });

    test('should build prompt without vocabulary section if empty', () => {
      const skill = new SmartSummarySkill(mockContext);
      const prompt = skill.buildPrompt('Test text here', [], 20);

      // Should not contain the vocabulary list section with actual words
      expect(prompt).not.toContain('MUST include at least 2-3');
      expect(prompt).not.toContain('word1, word2');
    });

    test('should include critical rules', () => {
      const skill = new SmartSummarySkill(mockContext);
      const prompt = skill.buildPrompt('Test', [], 20);

      expect(prompt).toContain('CRITICAL RULES');
      expect(prompt).toContain('ONLY words that appear in the original text');
    });
  });

  describe('parseResponse', () => {
    test('should parse valid JSON response', () => {
      const skill = new SmartSummarySkill(mockContext);
      const result = skill.parseResponse(
        JSON.stringify({
          summary: 'Test summary',
          words: ['test', 'summary'],
          vocabularyUsed: ['test'],
        }),
      );

      expect(result.summary).toBe('Test summary');
      expect(result.words).toEqual(['test', 'summary']);
      expect(result.vocabularyUsed).toEqual(['test']);
    });

    test('should extract words from summary if not provided', () => {
      const skill = new SmartSummarySkill(mockContext);
      const result = skill.parseResponse(
        JSON.stringify({
          summary: 'Test summary here',
        }),
      );

      expect(result.summary).toBe('Test summary here');
      expect(result.words).toEqual(['test', 'summary', 'here']);
    });

    test('should handle malformed JSON gracefully', () => {
      const skill = new SmartSummarySkill(mockContext);
      const result = skill.parseResponse('Not valid JSON at all');

      expect(result.summary).toBe('Not valid JSON at all');
      expect(result.vocabularyUsed).toEqual([]);
    });

    test('should handle array response format', () => {
      const skill = new SmartSummarySkill(mockContext);
      const result = skill.parseResponse([
        { type: 'text', text: '{"summary": "Array format"}' },
      ]);

      expect(result.summary).toBe('Array format');
    });
  });

  describe('extractWords', () => {
    test('should extract words and remove punctuation', () => {
      const skill = new SmartSummarySkill(mockContext);
      const words = skill.extractWords('Hello, world! How are you?');

      expect(words).toEqual(['hello', 'world', 'how', 'are', 'you']);
    });

    test('should convert to lowercase', () => {
      const skill = new SmartSummarySkill(mockContext);
      const words = skill.extractWords('Hello World');

      expect(words).toEqual(['hello', 'world']);
    });

    test('should filter empty strings', () => {
      const skill = new SmartSummarySkill(mockContext);
      const words = skill.extractWords('  word   with   spaces  ');

      expect(words).toEqual(['word', 'with', 'spaces']);
    });
  });

  describe('Error Handling', () => {
    test('should throw error if AI provider not available', async () => {
      const skill = new SmartSummarySkill({ token: 'test' });
      await expect(skill.execute({ text: 'test' })).rejects.toThrow(
        'AI provider not available',
      );
    });
  });
});
