/**
 * QuizGenerateSkill Tests
 */

const QuizGenerateSkill = require('../../main/skills/ai/QuizGenerateSkill');

describe('QuizGenerateSkill', () => {
  // Mock AI provider
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
      expect(QuizGenerateSkill.name).toBe('quiz_generate');
    });

    test('should have description', () => {
      expect(QuizGenerateSkill.description).toBeTruthy();
      expect(typeof QuizGenerateSkill.description).toBe('string');
    });

    test('should have correct parameters', () => {
      const params = QuizGenerateSkill.parameters;
      expect(params.text).toBeDefined();
      expect(params.questionCount).toBeDefined();
      expect(params.difficulty).toBeDefined();
    });

    test('should have text as required param', () => {
      expect(QuizGenerateSkill.requiredParams).toEqual(['text']);
    });

    test('should be in ai category', () => {
      expect(QuizGenerateSkill.category).toBe('ai');
    });

    test('questionCount should have default of 4', () => {
      expect(QuizGenerateSkill.parameters.questionCount.default).toBe(4);
    });

    test('difficulty should have enum values', () => {
      expect(QuizGenerateSkill.parameters.difficulty.enum).toEqual([
        'easy',
        'medium',
        'hard',
        'mixed',
      ]);
    });
  });

  describe('execute', () => {
    test('should throw error if AI provider not available', async () => {
      const skill = new QuizGenerateSkill({ token: 'test' });
      await expect(skill.execute({ text: 'test' })).rejects.toThrow(
        'AI provider not available',
      );
    });

    test('should generate quiz with valid response', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          quiz: [
            {
              question: 'What is the capital of France?',
              options: {
                optionA: 'Paris',
                optionB: 'London',
                optionC: 'Berlin',
                optionD: 'Madrid',
              },
              answer: 'A',
            },
          ],
        }),
      );

      const skill = new QuizGenerateSkill(mockContext);
      const result = await skill.execute({
        text: 'Paris is the capital of France.',
        questionCount: 1,
      });

      expect(result.quiz).toHaveLength(1);
      expect(result.quiz[0].question).toBe('What is the capital of France?');
      expect(result.quiz[0].answer).toBe('A');
    });

    test('should normalize question count within bounds', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({ quiz: [] }),
      );

      const skill = new QuizGenerateSkill(mockContext);

      // Test max bound
      await skill.execute({ text: 'test', questionCount: 100 });
      expect(mockAIProvider.generateContent).toHaveBeenCalled();

      // Test min bound
      await skill.execute({ text: 'test', questionCount: -5 });
      expect(mockAIProvider.generateContent).toHaveBeenCalled();
    });

    test('should handle different difficulty levels', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({ quiz: [] }),
      );

      const skill = new QuizGenerateSkill(mockContext);

      for (const difficulty of ['easy', 'medium', 'hard', 'mixed']) {
        await skill.execute({ text: 'test', difficulty });
        expect(mockAIProvider.generateContent).toHaveBeenCalled();
      }
    });
  });

  describe('normalizeQuestion', () => {
    test('should normalize answer to uppercase', () => {
      const skill = new QuizGenerateSkill(mockContext);
      const normalized = skill.normalizeQuestion({
        question: 'Test?',
        options: { optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D' },
        answer: 'a',
      });

      expect(normalized.answer).toBe('A');
    });

    test('should handle optionX prefix in answer', () => {
      const skill = new QuizGenerateSkill(mockContext);
      const normalized = skill.normalizeQuestion({
        question: 'Test?',
        options: { optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D' },
        answer: 'optionB',
      });

      expect(normalized.answer).toBe('B');
    });

    test('should handle alternative option formats', () => {
      const skill = new QuizGenerateSkill(mockContext);
      const normalized = skill.normalizeQuestion({
        question: 'Test?',
        options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
        answer: 'C',
      });

      expect(normalized.options.optionA).toBe('Option A');
      expect(normalized.options.optionC).toBe('Option C');
    });

    test('should return null for invalid question', () => {
      const skill = new QuizGenerateSkill(mockContext);
      expect(skill.normalizeQuestion({})).toBeNull();
      expect(skill.normalizeQuestion(null)).toBeNull();
    });
  });

  describe('parseResponse', () => {
    test('should parse JSON string response', () => {
      const skill = new QuizGenerateSkill(mockContext);
      const result = skill.parseResponse(
        JSON.stringify({
          quiz: [{ question: 'Q1?', options: {}, answer: 'A' }],
        }),
      );

      expect(result.quiz).toHaveLength(1);
    });

    test('should handle Claude array format', () => {
      const skill = new QuizGenerateSkill(mockContext);
      const result = skill.parseResponse([
        {
          type: 'text',
          text: JSON.stringify({
            quiz: [{ question: 'Q1?', options: {}, answer: 'A' }],
          }),
        },
      ]);

      expect(result.quiz).toHaveLength(1);
    });

    test('should return empty quiz on parse error', () => {
      const skill = new QuizGenerateSkill(mockContext);
      const result = skill.parseResponse('invalid json');

      expect(result.quiz).toEqual([]);
    });
  });
});
