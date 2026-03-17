/**
 * CreateQuizSkill Tests
 */

const CreateQuizSkill = require('../../main/skills/data/CreateQuizSkill');

describe('CreateQuizSkill', () => {
  const mockQuizManager = {
    createQuizProblem: jest.fn(),
  };

  const mockContext = {
    quizManager: mockQuizManager,
    token: 'test-token',
    userId: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Static Properties', () => {
    test('should have correct name', () => {
      expect(CreateQuizSkill.name).toBe('create_quiz');
    });

    test('should have description', () => {
      expect(CreateQuizSkill.description).toBeTruthy();
    });

    test('should have correct parameters', () => {
      const params = CreateQuizSkill.parameters;
      expect(params.quiz).toBeDefined();
      expect(params.sourceKey).toBeDefined();
      expect(params.sourceType).toBeDefined();
    });

    test('should have quiz as required param', () => {
      expect(CreateQuizSkill.requiredParams).toEqual(['quiz']);
    });

    test('should be in data category', () => {
      expect(CreateQuizSkill.category).toBe('data');
    });

    test('sourceType should have correct enum values', () => {
      expect(CreateQuizSkill.parameters.sourceType.enum).toEqual([
        'book',
        'web',
        'chat',
        'manual',
      ]);
    });

    test('sourceType should default to manual', () => {
      expect(CreateQuizSkill.parameters.sourceType.default).toBe('manual');
    });
  });

  describe('isAvailable', () => {
    test('should return true when quizManager is available', () => {
      expect(CreateQuizSkill.isAvailable(mockContext)).toBe(true);
    });

    test('should return true when quizManager is in services', () => {
      expect(
        CreateQuizSkill.isAvailable({
          services: { quizManager: mockQuizManager },
        }),
      ).toBe(true);
    });

    test('should return false when no quizManager', () => {
      expect(CreateQuizSkill.isAvailable({})).toBe(false);
    });
  });

  describe('execute', () => {
    test('should save quiz problems', async () => {
      mockQuizManager.createQuizProblem
        .mockReturnValueOnce({ id: 1 })
        .mockReturnValueOnce({ id: 2 });

      const skill = new CreateQuizSkill(mockContext);
      const result = await skill.execute({
        quiz: [
          {
            question: 'What is 2+2?',
            options: { A: '3', B: '4', C: '5', D: '6' },
            answer: 'B',
          },
          {
            question: 'What is the capital of France?',
            options: { A: 'London', B: 'Berlin', C: 'Paris', D: 'Madrid' },
            answer: 'C',
          },
        ],
      });

      expect(result.savedCount).toBe(2);
      expect(result.quizIds).toEqual([1, 2]);
      expect(result.success).toBe(true);
    });

    test('should include sourceKey and sourceType', async () => {
      mockQuizManager.createQuizProblem.mockReturnValue({ id: 1 });

      const skill = new CreateQuizSkill(mockContext);
      const result = await skill.execute({
        quiz: [{ question: 'Q', options: {}, answer: 'A' }],
        sourceKey: 'book-123',
        sourceType: 'book',
      });

      expect(result.sourceKey).toBe('book-123');
      expect(result.sourceType).toBe('book');
    });

    test('should handle partial failures', async () => {
      mockQuizManager.createQuizProblem
        .mockReturnValueOnce({ id: 1 })
        .mockImplementationOnce(() => {
          throw new Error('Database error');
        })
        .mockReturnValueOnce({ id: 3 });

      const skill = new CreateQuizSkill(mockContext);
      const result = await skill.execute({
        quiz: [
          { question: 'Q1', options: {}, answer: 'A' },
          { question: 'Q2', options: {}, answer: 'B' },
          { question: 'Q3', options: {}, answer: 'C' },
        ],
      });

      expect(result.savedCount).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
      expect(result.success).toBe(false);
    });

    test('should use default sourceType', async () => {
      mockQuizManager.createQuizProblem.mockReturnValue({ id: 1 });

      const skill = new CreateQuizSkill(mockContext);
      const result = await skill.execute({
        quiz: [{ question: 'Q', options: {}, answer: 'A' }],
      });

      expect(result.sourceType).toBe('manual');
    });
  });

  describe('normalizeProblem', () => {
    test('should normalize option formats', () => {
      const skill = new CreateQuizSkill(mockContext);

      const normalized = skill.normalizeProblem(
        {
          question: 'Test?',
          options: { A: 'opt1', B: 'opt2', C: 'opt3', D: 'opt4' },
          answer: 'A',
        },
        'key',
        'book',
      );

      expect(normalized.options.optionA).toBe('opt1');
      expect(normalized.options.optionB).toBe('opt2');
      expect(normalized.options.optionC).toBe('opt3');
      expect(normalized.options.optionD).toBe('opt4');
    });

    test('should normalize lowercase option keys', () => {
      const skill = new CreateQuizSkill(mockContext);

      const normalized = skill.normalizeProblem(
        {
          question: 'Test?',
          options: { a: 'opt1', b: 'opt2', c: 'opt3', d: 'opt4' },
          answer: 'B',
        },
        '',
        'manual',
      );

      expect(normalized.options.optionA).toBe('opt1');
      expect(normalized.options.optionB).toBe('opt2');
    });

    test('should normalize answer to uppercase', () => {
      const skill = new CreateQuizSkill(mockContext);

      const normalized = skill.normalizeProblem(
        { question: 'Q', options: {}, answer: 'b' },
        '',
        'manual',
      );

      expect(normalized.answer).toBe('B');
    });

    test('should handle OPTIONA format', () => {
      const skill = new CreateQuizSkill(mockContext);

      const normalized = skill.normalizeProblem(
        { question: 'Q', options: {}, answer: 'OPTIONC' },
        '',
        'manual',
      );

      expect(normalized.answer).toBe('C');
    });

    test('should default to A for invalid answer', () => {
      const skill = new CreateQuizSkill(mockContext);

      const normalized = skill.normalizeProblem(
        { question: 'Q', options: {}, answer: 'Z' },
        '',
        'manual',
      );

      expect(normalized.answer).toBe('A');
    });

    test('should include sourceKey and sourceType', () => {
      const skill = new CreateQuizSkill(mockContext);

      const normalized = skill.normalizeProblem(
        { question: 'Q', options: {}, answer: 'A' },
        'book-456',
        'book',
      );

      expect(normalized.sourceKey).toBe('book-456');
      expect(normalized.sourceType).toBe('book');
    });

    test('should initialize myChoice and correct fields', () => {
      const skill = new CreateQuizSkill(mockContext);

      const normalized = skill.normalizeProblem(
        { question: 'Q', options: {}, answer: 'A' },
        '',
        'manual',
      );

      expect(normalized.myChoice).toBe('');
      expect(normalized.correct).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should throw error if quiz manager not available', async () => {
      const skill = new CreateQuizSkill({ token: 'test' });
      await expect(
        skill.execute({ quiz: [{ question: 'Q', answer: 'A' }] }),
      ).rejects.toThrow('Quiz manager not available');
    });

    test('should throw error if token not provided', async () => {
      const skill = new CreateQuizSkill({
        quizManager: mockQuizManager,
      });
      await expect(
        skill.execute({ quiz: [{ question: 'Q', answer: 'A' }] }),
      ).rejects.toThrow('Authentication token required');
    });

    test('should throw error for empty quiz array', async () => {
      const skill = new CreateQuizSkill(mockContext);
      await expect(skill.execute({ quiz: [] })).rejects.toThrow(
        'Quiz array is empty or invalid',
      );
    });

    test('should throw error for non-array quiz', async () => {
      const skill = new CreateQuizSkill(mockContext);
      await expect(skill.execute({ quiz: 'not an array' })).rejects.toThrow(
        'Quiz array is empty or invalid',
      );
    });
  });
});
