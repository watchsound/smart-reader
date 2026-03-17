/**
 * CreateVocabularySkill Tests
 */

const CreateVocabularySkill = require('../../main/skills/data/CreateVocabularySkill');

describe('CreateVocabularySkill', () => {
  const mockVocabularyManager = {
    createVocabulary: jest.fn(),
    getVocabularyByName: jest.fn(),
  };

  const mockContext = {
    vocabularyManager: mockVocabularyManager,
    token: 'test-token',
    userId: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Static Properties', () => {
    test('should have correct name', () => {
      expect(CreateVocabularySkill.name).toBe('create_vocabulary');
    });

    test('should have description', () => {
      expect(CreateVocabularySkill.description).toBeTruthy();
      expect(CreateVocabularySkill.description).toContain('persistence-only');
    });

    test('should have correct parameters', () => {
      const params = CreateVocabularySkill.parameters;
      expect(params.word).toBeDefined();
      expect(params.definition).toBeDefined();
      expect(params.example).toBeDefined();
      expect(params.relatedWords).toBeDefined();
      expect(params.setId).toBeDefined();
    });

    test('should have word and definition as required params', () => {
      expect(CreateVocabularySkill.requiredParams).toEqual([
        'word',
        'definition',
      ]);
    });

    test('should be in data category', () => {
      expect(CreateVocabularySkill.category).toBe('data');
    });

    test('setId should default to 0', () => {
      expect(CreateVocabularySkill.parameters.setId.default).toBe(0);
    });
  });

  describe('isAvailable', () => {
    test('should return true when vocabularyManager is available', () => {
      expect(CreateVocabularySkill.isAvailable(mockContext)).toBe(true);
    });

    test('should return true when vocabularyManager is in services', () => {
      expect(
        CreateVocabularySkill.isAvailable({
          services: { vocabularyManager: mockVocabularyManager },
        }),
      ).toBe(true);
    });

    test('should return false when no vocabularyManager', () => {
      expect(CreateVocabularySkill.isAvailable({})).toBe(false);
    });
  });

  describe('execute', () => {
    test('should create new vocabulary entry', async () => {
      mockVocabularyManager.getVocabularyByName.mockReturnValue(null);
      mockVocabularyManager.createVocabulary.mockReturnValue({
        id: 123,
        word: 'ephemeral',
        definition: 'lasting for a very short time',
      });

      const skill = new CreateVocabularySkill(mockContext);
      const result = await skill.execute({
        word: 'ephemeral',
        definition: 'lasting for a very short time',
        example: 'The ephemeral beauty of cherry blossoms.',
      });

      expect(result.vocabularyId).toBe(123);
      expect(result.word).toBe('ephemeral');
      expect(result.isNew).toBe(true);
      expect(result.leitnerBox).toBe(1);
      expect(result.message).toContain('created successfully');
    });

    test('should return existing vocabulary if word exists', async () => {
      mockVocabularyManager.getVocabularyByName.mockReturnValue({
        id: 456,
        word: 'existing',
        detail: 'existing definition',
        leitnerItem: { box: 3, nextReview: '2024-01-15' },
      });

      const skill = new CreateVocabularySkill(mockContext);
      const result = await skill.execute({
        word: 'existing',
        definition: 'new definition',
      });

      expect(result.vocabularyId).toBe(456);
      expect(result.isNew).toBe(false);
      expect(result.leitnerBox).toBe(3);
      expect(result.message).toContain('already exists');
    });

    test('should include example and relatedWords', async () => {
      mockVocabularyManager.getVocabularyByName.mockReturnValue(null);
      mockVocabularyManager.createVocabulary.mockReturnValue({
        id: 789,
        word: 'test',
        definition: 'def',
        example: 'example sentence',
      });

      const skill = new CreateVocabularySkill(mockContext);
      const result = await skill.execute({
        word: 'test',
        definition: 'def',
        example: 'example sentence',
        relatedWords: 'synonym1, synonym2',
      });

      expect(mockVocabularyManager.createVocabulary).toHaveBeenCalledWith(
        expect.objectContaining({
          example: 'example sentence',
          relatedWords: 'synonym1, synonym2',
        }),
        'test-token',
      );
    });

    test('should include Leitner item in created vocabulary', async () => {
      mockVocabularyManager.getVocabularyByName.mockReturnValue(null);
      mockVocabularyManager.createVocabulary.mockReturnValue({
        id: 100,
        word: 'test',
      });

      const skill = new CreateVocabularySkill(mockContext);
      await skill.execute({
        word: 'test',
        definition: 'test definition',
      });

      expect(mockVocabularyManager.createVocabulary).toHaveBeenCalledWith(
        expect.objectContaining({
          leitnerItem: expect.objectContaining({
            box: 1,
            skips: 0,
            flips: 0,
            fullyLearned: 0,
            score: 0,
          }),
        }),
        'test-token',
      );
    });

    test('should include setId when provided', async () => {
      mockVocabularyManager.getVocabularyByName.mockReturnValue(null);
      mockVocabularyManager.createVocabulary.mockReturnValue({
        id: 101,
        word: 'test',
      });

      const skill = new CreateVocabularySkill(mockContext);
      await skill.execute({
        word: 'test',
        definition: 'def',
        setId: 5,
      });

      expect(mockVocabularyManager.createVocabulary).toHaveBeenCalledWith(
        expect.objectContaining({
          setId: 5,
        }),
        'test-token',
      );
    });
  });

  describe('calculateNextReview', () => {
    test('should calculate next review date based on box', () => {
      const skill = new CreateVocabularySkill(mockContext);

      // Box 1 = 1 day
      const date1 = new Date(skill.calculateNextReview(1));
      const now = new Date();
      const diffDays1 = Math.round((date1 - now) / (1000 * 60 * 60 * 24));
      expect(diffDays1).toBe(1);

      // Box 3 = 7 days
      const date3 = new Date(skill.calculateNextReview(3));
      const diffDays3 = Math.round((date3 - now) / (1000 * 60 * 60 * 24));
      expect(diffDays3).toBe(7);

      // Box 5 = 30 days
      const date5 = new Date(skill.calculateNextReview(5));
      const diffDays5 = Math.round((date5 - now) / (1000 * 60 * 60 * 24));
      expect(diffDays5).toBe(30);
    });

    test('should default to 1 day for invalid box', () => {
      const skill = new CreateVocabularySkill(mockContext);
      const date = new Date(skill.calculateNextReview(99));
      const now = new Date();
      const diffDays = Math.round((date - now) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should throw error if vocabulary manager not available', async () => {
      const skill = new CreateVocabularySkill({ token: 'test' });
      await expect(
        skill.execute({ word: 'test', definition: 'def' }),
      ).rejects.toThrow('Vocabulary manager not available');
    });

    test('should throw error if token not provided', async () => {
      const skill = new CreateVocabularySkill({
        vocabularyManager: mockVocabularyManager,
      });
      await expect(
        skill.execute({ word: 'test', definition: 'def' }),
      ).rejects.toThrow('Authentication token required');
    });

    test('should throw error if no ID returned', async () => {
      mockVocabularyManager.getVocabularyByName.mockReturnValue(null);
      mockVocabularyManager.createVocabulary.mockReturnValue({});

      const skill = new CreateVocabularySkill(mockContext);
      await expect(
        skill.execute({ word: 'test', definition: 'def' }),
      ).rejects.toThrow('no ID returned');
    });

    test('should throw error on createVocabulary failure', async () => {
      mockVocabularyManager.getVocabularyByName.mockReturnValue(null);
      mockVocabularyManager.createVocabulary.mockImplementation(() => {
        throw new Error('Database error');
      });

      const skill = new CreateVocabularySkill(mockContext);
      await expect(
        skill.execute({ word: 'test', definition: 'def' }),
      ).rejects.toThrow('Failed to create vocabulary');
    });
  });
});
