/**
 * GetLeitnerDueSkill Tests
 */

const GetLeitnerDueSkill = require('../../main/skills/data/GetLeitnerDueSkill');

describe('GetLeitnerDueSkill', () => {
  const mockVocabularyManager = {
    getVocabulariesByDueReview: jest.fn(),
  };

  const mockNoteManager = {
    getNotesByDueReview: jest.fn(),
  };

  const mockContext = {
    vocabularyManager: mockVocabularyManager,
    noteManager: mockNoteManager,
    token: 'test-token',
    userId: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Static Properties', () => {
    test('should have correct name', () => {
      expect(GetLeitnerDueSkill.name).toBe('get_leitner_due');
    });

    test('should have description', () => {
      expect(GetLeitnerDueSkill.description).toBeTruthy();
      expect(GetLeitnerDueSkill.description).toContain('Leitner');
    });

    test('should have correct parameters', () => {
      const params = GetLeitnerDueSkill.parameters;
      expect(params.itemType).toBeDefined();
      expect(params.limit).toBeDefined();
      expect(params.page).toBeDefined();
    });

    test('should have no required params', () => {
      expect(GetLeitnerDueSkill.requiredParams).toEqual([]);
    });

    test('should be in data category', () => {
      expect(GetLeitnerDueSkill.category).toBe('data');
    });

    test('itemType should have correct enum values', () => {
      expect(GetLeitnerDueSkill.parameters.itemType.enum).toEqual([
        'vocabulary',
        'note',
        'all',
      ]);
    });

    test('itemType should default to all', () => {
      expect(GetLeitnerDueSkill.parameters.itemType.default).toBe('all');
    });

    test('limit should default to 20', () => {
      expect(GetLeitnerDueSkill.parameters.limit.default).toBe(20);
    });
  });

  describe('isAvailable', () => {
    test('should return true when vocabularyManager is available', () => {
      expect(
        GetLeitnerDueSkill.isAvailable({
          vocabularyManager: mockVocabularyManager,
        }),
      ).toBe(true);
    });

    test('should return true when noteManager is available', () => {
      expect(
        GetLeitnerDueSkill.isAvailable({
          noteManager: mockNoteManager,
        }),
      ).toBe(true);
    });

    test('should return true when both managers are available', () => {
      expect(GetLeitnerDueSkill.isAvailable(mockContext)).toBe(true);
    });

    test('should return false when no managers available', () => {
      expect(GetLeitnerDueSkill.isAvailable({})).toBe(false);
    });
  });

  describe('execute - vocabulary only', () => {
    test('should get vocabulary due for review', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

      mockVocabularyManager.getVocabulariesByDueReview.mockReturnValue({
        data: [
          {
            id: 1,
            word: 'ephemeral',
            definition: 'short-lived',
            leitnerItem: { box: 2, nextReview: pastDate.toISOString() },
          },
        ],
        total: 1,
      });

      const skill = new GetLeitnerDueSkill(mockContext);
      const result = await skill.execute({
        itemType: 'vocabulary',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('vocabulary');
      expect(result.items[0].content.word).toBe('ephemeral');
      expect(result.items[0].overdueDays).toBeGreaterThanOrEqual(1);
    });

    test('should not fetch notes when itemType is vocabulary', async () => {
      mockVocabularyManager.getVocabulariesByDueReview.mockReturnValue({
        data: [],
        total: 0,
      });

      const skill = new GetLeitnerDueSkill(mockContext);
      await skill.execute({
        itemType: 'vocabulary',
      });

      expect(
        mockVocabularyManager.getVocabulariesByDueReview,
      ).toHaveBeenCalled();
      expect(mockNoteManager.getNotesByDueReview).not.toHaveBeenCalled();
    });
  });

  describe('execute - notes only', () => {
    test('should get notes due for review', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      mockNoteManager.getNotesByDueReview.mockResolvedValue({
        data: [
          {
            id: 10,
            title: 'Test Note',
            content: 'This is a test note content.',
            leitnerItem: { box: 1, nextReview: pastDate.toISOString() },
          },
        ],
        total: 1,
      });

      const skill = new GetLeitnerDueSkill(mockContext);
      const result = await skill.execute({
        itemType: 'note',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('note');
      expect(result.items[0].content.title).toBe('Test Note');
    });

    test('should not fetch vocabulary when itemType is note', async () => {
      mockNoteManager.getNotesByDueReview.mockResolvedValue({
        data: [],
        total: 0,
      });

      const skill = new GetLeitnerDueSkill(mockContext);
      await skill.execute({
        itemType: 'note',
      });

      expect(mockNoteManager.getNotesByDueReview).toHaveBeenCalled();
      expect(
        mockVocabularyManager.getVocabulariesByDueReview,
      ).not.toHaveBeenCalled();
    });
  });

  describe('execute - all types', () => {
    test('should combine vocabulary and notes', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      mockVocabularyManager.getVocabulariesByDueReview.mockReturnValue({
        data: [
          {
            id: 1,
            word: 'vocab1',
            leitnerItem: { box: 1, nextReview: pastDate.toISOString() },
          },
        ],
        total: 1,
      });

      mockNoteManager.getNotesByDueReview.mockResolvedValue({
        data: [
          {
            id: 10,
            title: 'Note1',
            content: 'Content',
            leitnerItem: { box: 2, nextReview: pastDate.toISOString() },
          },
        ],
        total: 1,
      });

      const skill = new GetLeitnerDueSkill(mockContext);
      const result = await skill.execute({
        itemType: 'all',
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      const types = result.items.map((i) => i.type);
      expect(types).toContain('vocabulary');
      expect(types).toContain('note');
    });

    test('should sort by overdue days descending', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      mockVocabularyManager.getVocabulariesByDueReview.mockReturnValue({
        data: [
          {
            id: 1,
            word: 'recent',
            leitnerItem: { box: 1, nextReview: twoDaysAgo.toISOString() },
          },
        ],
        total: 1,
      });

      mockNoteManager.getNotesByDueReview.mockResolvedValue({
        data: [
          {
            id: 10,
            title: 'older',
            content: 'c',
            leitnerItem: { box: 2, nextReview: fiveDaysAgo.toISOString() },
          },
        ],
        total: 1,
      });

      const skill = new GetLeitnerDueSkill(mockContext);
      const result = await skill.execute({
        itemType: 'all',
      });

      // Most overdue should be first
      expect(result.items[0].content.title).toBe('older');
    });
  });

  describe('execute - counts', () => {
    test('should count dueNow and dueToday correctly', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      mockVocabularyManager.getVocabulariesByDueReview.mockReturnValue({
        data: [
          {
            id: 1,
            word: 'overdue',
            leitnerItem: { box: 1, nextReview: pastDate.toISOString() },
          },
        ],
        total: 1,
      });

      mockNoteManager.getNotesByDueReview.mockResolvedValue({
        data: [],
        total: 0,
      });

      const skill = new GetLeitnerDueSkill(mockContext);
      const result = await skill.execute({
        itemType: 'all',
      });

      expect(result.dueNow).toBeGreaterThanOrEqual(1);
      expect(result.dueToday).toBeGreaterThanOrEqual(1);
    });
  });

  describe('formatVocabularyItem', () => {
    test('should format vocabulary item correctly', () => {
      const skill = new GetLeitnerDueSkill(mockContext);
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const item = skill.formatVocabularyItem(
        {
          id: 1,
          word: 'test',
          definition: 'test def',
          example: 'test example',
          leitnerItem: { box: 3, nextReview: yesterday.toISOString() },
        },
        now,
      );

      expect(item.id).toBe(1);
      expect(item.type).toBe('vocabulary');
      expect(item.content.word).toBe('test');
      expect(item.box).toBe(3);
      expect(item.overdueDays).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatNoteItem', () => {
    test('should format note item correctly', () => {
      const skill = new GetLeitnerDueSkill(mockContext);
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const item = skill.formatNoteItem(
        {
          id: 10,
          title: 'Note Title',
          content: 'Short content',
          leitnerItem: { box: 2, nextReview: yesterday.toISOString() },
        },
        now,
      );

      expect(item.id).toBe(10);
      expect(item.type).toBe('note');
      expect(item.content.title).toBe('Note Title');
      expect(item.box).toBe(2);
    });

    test('should truncate long note content', () => {
      const skill = new GetLeitnerDueSkill(mockContext);
      const now = new Date();
      const longContent = 'A'.repeat(300);

      const item = skill.formatNoteItem(
        {
          id: 10,
          title: 'Note',
          content: longContent,
          leitnerItem: { box: 1, nextReview: now.toISOString() },
        },
        now,
      );

      expect(item.content.content.length).toBeLessThanOrEqual(203); // 200 + "..."
      expect(item.content.content).toContain('...');
    });
  });

  describe('Error Handling', () => {
    test('should throw error if token not provided', async () => {
      const skill = new GetLeitnerDueSkill({
        vocabularyManager: mockVocabularyManager,
      });
      await expect(skill.execute({})).rejects.toThrow(
        'Authentication token required',
      );
    });

    test('should handle vocabulary manager errors gracefully', async () => {
      mockVocabularyManager.getVocabulariesByDueReview.mockImplementation(
        () => {
          throw new Error('DB error');
        },
      );
      mockNoteManager.getNotesByDueReview.mockResolvedValue({
        data: [],
        total: 0,
      });

      const skill = new GetLeitnerDueSkill(mockContext);
      const result = await skill.execute({ itemType: 'all' });

      // Should still return result, just without vocabulary
      expect(result.items).toEqual([]);
    });

    test('should handle note manager errors gracefully', async () => {
      mockVocabularyManager.getVocabulariesByDueReview.mockReturnValue({
        data: [],
        total: 0,
      });
      mockNoteManager.getNotesByDueReview.mockRejectedValue(
        new Error('DB error'),
      );

      const skill = new GetLeitnerDueSkill(mockContext);
      const result = await skill.execute({ itemType: 'all' });

      // Should still return result, just without notes
      expect(result.items).toEqual([]);
    });
  });
});
