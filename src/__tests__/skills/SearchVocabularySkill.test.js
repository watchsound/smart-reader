/**
 * SearchVocabularySkill Tests
 */

const SearchVocabularySkill = require('../../main/skills/data/SearchVocabularySkill');

describe('SearchVocabularySkill', () => {
  const mockVocabularyManager = {
    getVocabulariesByQuery: jest.fn(),
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
      expect(SearchVocabularySkill.name).toBe('search_vocabulary');
    });

    test('should have description', () => {
      expect(SearchVocabularySkill.description).toBeTruthy();
    });

    test('should have correct parameters', () => {
      const params = SearchVocabularySkill.parameters;
      expect(params.query).toBeDefined();
      expect(params.page).toBeDefined();
      expect(params.limit).toBeDefined();
    });

    test('should have query as required param', () => {
      expect(SearchVocabularySkill.requiredParams).toEqual(['query']);
    });

    test('should be in data category', () => {
      expect(SearchVocabularySkill.category).toBe('data');
    });

    test('page should default to 1', () => {
      expect(SearchVocabularySkill.parameters.page.default).toBe(1);
    });

    test('limit should default to 20', () => {
      expect(SearchVocabularySkill.parameters.limit.default).toBe(20);
    });
  });

  describe('isAvailable', () => {
    test('should return true when vocabularyManager is available', () => {
      expect(SearchVocabularySkill.isAvailable(mockContext)).toBe(true);
    });

    test('should return true when vocabularyManager is in services', () => {
      expect(
        SearchVocabularySkill.isAvailable({
          services: { vocabularyManager: mockVocabularyManager },
        }),
      ).toBe(true);
    });

    test('should return false when no vocabularyManager', () => {
      expect(SearchVocabularySkill.isAvailable({})).toBe(false);
    });
  });

  describe('execute', () => {
    test('should search vocabulary by query', async () => {
      mockVocabularyManager.getVocabulariesByQuery.mockReturnValue({
        data: [
          {
            id: 1,
            word: 'ephemeral',
            detail: 'lasting a very short time',
            example: 'An ephemeral moment.',
            leitnerItem: { box: 2, nextReview: '2024-01-15' },
          },
        ],
        total: 1,
        currentPage: 1,
        totalPages: 1,
      });

      const skill = new SearchVocabularySkill(mockContext);
      const result = await skill.execute({
        query: 'ephemeral',
      });

      expect(result.query).toBe('ephemeral');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].word).toBe('ephemeral');
      expect(result.results[0].definition).toBe('lasting a very short time');
      expect(result.results[0].leitnerBox).toBe(2);
      expect(result.total).toBe(1);
    });

    test('should pass pagination parameters', async () => {
      mockVocabularyManager.getVocabulariesByQuery.mockReturnValue({
        data: [],
        total: 0,
        currentPage: 2,
        totalPages: 0,
      });

      const skill = new SearchVocabularySkill(mockContext);
      await skill.execute({
        query: 'test',
        page: 2,
        limit: 10,
      });

      expect(mockVocabularyManager.getVocabulariesByQuery).toHaveBeenCalledWith(
        'test',
        2,
        10,
        'test-token',
      );
    });

    test('should handle empty results', async () => {
      mockVocabularyManager.getVocabulariesByQuery.mockReturnValue({
        data: [],
        total: 0,
        currentPage: 1,
        totalPages: 0,
      });

      const skill = new SearchVocabularySkill(mockContext);
      const result = await skill.execute({
        query: 'nonexistent',
      });

      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
    });

    test('should use default pagination when not specified', async () => {
      mockVocabularyManager.getVocabulariesByQuery.mockReturnValue({
        data: [],
        total: 0,
      });

      const skill = new SearchVocabularySkill(mockContext);
      await skill.execute({
        query: 'test',
      });

      expect(mockVocabularyManager.getVocabulariesByQuery).toHaveBeenCalledWith(
        'test',
        1,
        20,
        'test-token',
      );
    });
  });

  describe('normalizeResults', () => {
    test('should normalize paginated result format', () => {
      const skill = new SearchVocabularySkill(mockContext);
      const result = skill.normalizeResults({
        data: [{ id: 1, word: 'test' }],
        total: 50,
        currentPage: 2,
        totalPages: 3,
      });

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(50);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
    });

    test('should normalize array result format', () => {
      const skill = new SearchVocabularySkill(mockContext);
      const result = skill.normalizeResults([
        { id: 1, word: 'test1' },
        { id: 2, word: 'test2' },
      ]);

      expect(result.results).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    test('should return empty results for invalid input', () => {
      const skill = new SearchVocabularySkill(mockContext);
      const result = skill.normalizeResults(null);

      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('normalizeVocabulary', () => {
    test('should normalize vocabulary entry', () => {
      const skill = new SearchVocabularySkill(mockContext);
      const normalized = skill.normalizeVocabulary({
        id: 123,
        word: 'test',
        detail: 'test definition',
        example: 'test example',
        relatedWords: 'word1, word2',
        leitnerItem: { box: 3, nextReview: '2024-01-20' },
        createdAt: '2024-01-01',
      });

      expect(normalized.id).toBe(123);
      expect(normalized.word).toBe('test');
      expect(normalized.definition).toBe('test definition');
      expect(normalized.example).toBe('test example');
      expect(normalized.relatedWords).toBe('word1, word2');
      expect(normalized.leitnerBox).toBe(3);
      expect(normalized.nextReview).toBe('2024-01-20');
      expect(normalized.createdAt).toBe('2024-01-01');
    });

    test('should use definition field if detail not present', () => {
      const skill = new SearchVocabularySkill(mockContext);
      const normalized = skill.normalizeVocabulary({
        id: 1,
        word: 'test',
        definition: 'from definition field',
      });

      expect(normalized.definition).toBe('from definition field');
    });

    test('should default leitnerBox to 1', () => {
      const skill = new SearchVocabularySkill(mockContext);
      const normalized = skill.normalizeVocabulary({
        id: 1,
        word: 'test',
      });

      expect(normalized.leitnerBox).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should throw error if vocabulary manager not available', async () => {
      const skill = new SearchVocabularySkill({ token: 'test' });
      await expect(skill.execute({ query: 'test' })).rejects.toThrow(
        'Vocabulary manager not available',
      );
    });

    test('should throw error if token not provided', async () => {
      const skill = new SearchVocabularySkill({
        vocabularyManager: mockVocabularyManager,
      });
      await expect(skill.execute({ query: 'test' })).rejects.toThrow(
        'Authentication token required',
      );
    });

    test('should throw error on search failure', async () => {
      mockVocabularyManager.getVocabulariesByQuery.mockImplementation(() => {
        throw new Error('Search failed');
      });

      const skill = new SearchVocabularySkill(mockContext);
      await expect(skill.execute({ query: 'test' })).rejects.toThrow(
        'Failed to search vocabulary',
      );
    });
  });
});
