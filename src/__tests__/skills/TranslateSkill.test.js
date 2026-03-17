/**
 * TranslateSkill Tests
 */

const TranslateSkill = require('../../main/skills/ai/TranslateSkill');

describe('TranslateSkill', () => {
  const mockAIProvider = {
    generateContent: jest.fn(),
  };

  const mockContext = {
    aiProvider: mockAIProvider,
    readerLevel: 'College',
    token: 'test-token',
    userId: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Static Properties', () => {
    test('should have correct name', () => {
      expect(TranslateSkill.name).toBe('translate');
    });

    test('should have description', () => {
      expect(TranslateSkill.description).toBeTruthy();
    });

    test('should have correct parameters', () => {
      const params = TranslateSkill.parameters;
      expect(params.text).toBeDefined();
      expect(params.sourceLanguage).toBeDefined();
      expect(params.includeNLP).toBeDefined();
      expect(params.mode).toBeDefined();
    });

    test('should have text as required param', () => {
      expect(TranslateSkill.requiredParams).toEqual(['text']);
    });

    test('should be in ai category', () => {
      expect(TranslateSkill.category).toBe('ai');
    });

    test('sourceLanguage should default to Chinese', () => {
      expect(TranslateSkill.parameters.sourceLanguage.default).toBe('Chinese');
    });

    test('mode should have full and simple options', () => {
      expect(TranslateSkill.parameters.mode.enum).toContain('full');
      expect(TranslateSkill.parameters.mode.enum).toContain('simple');
    });
  });

  describe('execute - Simple Mode', () => {
    test('should execute simple translation', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          translation: 'Hello',
          explanation: 'Direct translation',
        }),
      );

      const skill = new TranslateSkill(mockContext);
      const result = await skill.execute({
        text: '你好',
        mode: 'simple',
      });

      expect(result.mode).toBe('simple');
      expect(result.translation).toBe('Hello');
      expect(result.sourceLanguage).toBe('Chinese');
    });

    test('should handle Japanese source language', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          translation: 'Hello',
          explanation: 'Greeting',
        }),
      );

      const skill = new TranslateSkill(mockContext);
      const result = await skill.execute({
        text: 'こんにちは',
        sourceLanguage: 'Japanese',
        mode: 'simple',
      });

      expect(result.sourceLanguage).toBe('Japanese');
    });
  });

  describe('execute - Full Mode', () => {
    test('should execute full 5-step translation', async () => {
      const fullResponse = {
        'input-sentence': '图书馆有很多书',
        'step-1': {
          title: 'Extract SVO',
          'sub-verb-obj-list': [],
          explain: 'Explanation',
        },
        'step-2': { title: 'Analyze Verbs', explain: '' },
        'step-3': { title: 'Build Scaffold', explain: '' },
        'step-4': { title: 'Select Pattern', explain: '' },
        'step-5': {
          title: 'Final Translation',
          output: 'There are many books in the library.',
          explain: '',
        },
      };

      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify(fullResponse),
      );

      const skill = new TranslateSkill(mockContext);
      const result = await skill.execute({
        text: '图书馆有很多书',
        mode: 'full',
      });

      expect(result.mode).toBe('full');
      expect(result.steps).toBeDefined();
      expect(result.steps['step-1']).toBeDefined();
      expect(result.steps['step-5']).toBeDefined();
    });

    test('should include NLP analysis when requested', async () => {
      mockAIProvider.generateContent
        .mockResolvedValueOnce(
          JSON.stringify({
            'step-5': { output: 'Hello world' },
          }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            sentence: 'Hello world',
            tokens: [{ text: 'Hello', pos: 'UH' }],
            coreferences: [],
          }),
        );

      const skill = new TranslateSkill(mockContext);
      const result = await skill.execute({
        text: '你好',
        mode: 'full',
        includeNLP: true,
      });

      expect(mockAIProvider.generateContent).toHaveBeenCalledTimes(2);
      expect(result.nlpAnalysis).toBeDefined();
    });
  });

  describe('parseFullResponse', () => {
    test('should normalize step keys', () => {
      const skill = new TranslateSkill(mockContext);
      const result = skill.parseFullResponse(
        JSON.stringify({
          step1: { title: 'Step 1' },
          'step-2': { title: 'Step 2' },
        }),
      );

      expect(result.steps['step-1']).toBeDefined();
      expect(result.steps['step-2']).toBeDefined();
    });

    test('should handle malformed JSON gracefully', () => {
      const skill = new TranslateSkill(mockContext);
      const result = skill.parseFullResponse('not json');

      expect(result.steps).toBeNull();
      expect(result.rawResponse).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should throw error if AI provider not available', async () => {
      const skill = new TranslateSkill({ token: 'test' });
      await expect(skill.execute({ text: 'test' })).rejects.toThrow(
        'AI provider not available',
      );
    });
  });
});
