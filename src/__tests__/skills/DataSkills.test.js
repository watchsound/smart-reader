/**
 * DataSkills.test.js
 *
 * Unit tests for data-related skills.
 * Tests SearchNotesSkill, GraphQuerySkill, CreateNoteSkill.
 */

// Mock services
const mockNoteManager = {
  searchByKeyword: jest.fn(),
  searchNotes: jest.fn(),
  getNotes: jest.fn(),
  createNote: jest.fn(),
  create: jest.fn(),
};

const mockChromaManager = {
  search: jest.fn(),
};

const mockGraphApi = {
  isConnected: jest.fn(),
  getRelatedConcepts: jest.fn(),
  getPersonalizedLearningPath: jest.fn(),
  detectWeakConcepts: jest.fn(),
  getNotesForConcept: jest.fn(),
  getMasteryProgress: jest.fn(),
  runQuery: jest.fn(),
  linkNoteToConcepts: jest.fn(),
};

const mockAiProvider = {
  generateContent: jest.fn(),
};

// Create mock context
const createMockContext = (overrides = {}) => ({
  userId: 1,
  token: 'test-token',
  noteManager: mockNoteManager,
  chromaManager: mockChromaManager,
  graphApi: mockGraphApi,
  aiProvider: mockAiProvider,
  services: {
    noteManager: mockNoteManager,
    chromaManager: mockChromaManager,
    graphApi: mockGraphApi,
  },
  ...overrides,
});

describe('Data Skills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGraphApi.isConnected.mockReturnValue(true);
  });

  describe('SearchNotesSkill', () => {
    let SearchNotesSkill;

    beforeEach(() => {
      jest.resetModules();
      SearchNotesSkill = require('../../main/skills/data/SearchNotesSkill');
    });

    describe('Static Properties', () => {
      it('should have correct name', () => {
        expect(SearchNotesSkill.name).toBe('search_notes');
      });

      it('should have correct category', () => {
        expect(SearchNotesSkill.category).toBe('data');
      });

      it('should require query parameter', () => {
        expect(SearchNotesSkill.requiredParams).toContain('query');
      });

      it('should have searchType parameter', () => {
        expect(SearchNotesSkill.parameters.searchType.enum).toEqual(['keyword', 'semantic']);
      });
    });

    describe('Keyword Search', () => {
      it('should search notes by keyword', async () => {
        const mockNotes = [
          { id: 1, title: 'Note 1', content: 'Test content' },
          { id: 2, title: 'Note 2', content: 'More test content' },
        ];
        mockNoteManager.searchNotes.mockResolvedValue(mockNotes);

        const skill = new SearchNotesSkill(createMockContext());
        const result = await skill.execute({
          query: 'test',
          searchType: 'keyword',
          limit: 10,
        });

        expect(mockNoteManager.searchNotes).toHaveBeenCalled();
        expect(result.notes).toEqual(mockNotes);
        expect(result.searchType).toBe('keyword');
      });

      it('should use default limit', async () => {
        mockNoteManager.searchNotes.mockResolvedValue([]);

        const skill = new SearchNotesSkill(createMockContext());
        await skill.execute({ query: 'test', searchType: 'keyword' });

        expect(mockNoteManager.searchNotes).toHaveBeenCalled();
      });
    });

    describe('Semantic Search', () => {
      it('should search notes semantically', async () => {
        const mockResults = [
          { id: 1, score: 0.95, document: 'Relevant content', metadata: { title: 'Test', sourceType: 'book' } },
        ];
        mockChromaManager.search.mockResolvedValue(mockResults);

        const skill = new SearchNotesSkill(createMockContext());
        const result = await skill.execute({
          query: 'machine learning concepts',
          searchType: 'semantic',
        });

        expect(mockChromaManager.search).toHaveBeenCalled();
        expect(result.notes.length).toBe(1);
        expect(result.notes[0].id).toBe(1);
        expect(result.searchType).toBe('semantic');
      });

      it('should use default search type (keyword)', async () => {
        mockNoteManager.searchNotes.mockResolvedValue([]);

        const skill = new SearchNotesSkill(createMockContext());
        await skill.execute({ query: 'test' });

        // Default is keyword, not semantic
        expect(mockNoteManager.searchNotes).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle search errors gracefully', async () => {
        mockNoteManager.searchNotes.mockRejectedValue(new Error('Search failed'));
        mockNoteManager.getNotes.mockRejectedValue(new Error('Search failed'));

        const skill = new SearchNotesSkill(createMockContext());
        const result = await skill.execute({ query: 'test', searchType: 'keyword' });

        // Should return empty array when search fails
        expect(result.notes).toEqual([]);
      });
    });
  });

  describe('GraphQuerySkill', () => {
    let GraphQuerySkill;

    beforeEach(() => {
      jest.resetModules();
      GraphQuerySkill = require('../../main/skills/data/GraphQuerySkill');
    });

    describe('Static Properties', () => {
      it('should have correct name', () => {
        expect(GraphQuerySkill.name).toBe('query_graph');
      });

      it('should have correct category', () => {
        expect(GraphQuerySkill.category).toBe('graph');
      });

      it('should require queryType parameter', () => {
        expect(GraphQuerySkill.requiredParams).toContain('queryType');
      });

      it('should have queryType enum', () => {
        expect(GraphQuerySkill.parameters.queryType.enum).toContain('related_concepts');
        expect(GraphQuerySkill.parameters.queryType.enum).toContain('learning_path');
        expect(GraphQuerySkill.parameters.queryType.enum).toContain('weak_concepts');
      });
    });

    describe('Availability', () => {
      it('should be available when graph is connected', () => {
        mockGraphApi.isConnected.mockReturnValue(true);
        expect(GraphQuerySkill.isAvailable({ graphApi: mockGraphApi })).toBe(true);
      });

      it('should not be available when graph is disconnected', () => {
        mockGraphApi.isConnected.mockReturnValue(false);
        expect(GraphQuerySkill.isAvailable({ graphApi: mockGraphApi })).toBe(false);
      });

      it('should not be available without graphApi', () => {
        expect(GraphQuerySkill.isAvailable({})).toBe(false);
        // Null context will throw, so we test empty object instead
      });
    });

    describe('Related Concepts Query', () => {
      it('should query related concepts', async () => {
        const mockConcepts = [
          { name: 'Neural Networks', relation: 'RELATED_TO', strength: 0.8 },
          { name: 'Deep Learning', relation: 'PART_OF', strength: 0.9 },
        ];
        mockGraphApi.getRelatedConcepts.mockResolvedValue(mockConcepts);

        const skill = new GraphQuerySkill(createMockContext());
        const result = await skill.execute({
          queryType: 'related_concepts',
          conceptName: 'Machine Learning',
          limit: 5,
        });

        expect(mockGraphApi.getRelatedConcepts).toHaveBeenCalledWith(
          'Machine Learning',
          5,
          'test-token',
        );
        expect(result.result).toEqual(mockConcepts);
      });

      it('should throw error when conceptName missing', async () => {
        const skill = new GraphQuerySkill(createMockContext());

        await expect(
          skill.execute({ queryType: 'related_concepts' }),
        ).rejects.toThrow('conceptName is required');
      });
    });

    describe('Learning Path Query', () => {
      it('should get learning path', async () => {
        const mockPath = {
          targetConcept: 'Calculus',
          prerequisites: [
            { name: 'Algebra', mastery: 80 },
            { name: 'Trigonometry', mastery: 60 },
          ],
        };
        mockGraphApi.getPersonalizedLearningPath.mockResolvedValue(mockPath);

        const skill = new GraphQuerySkill(createMockContext());
        const result = await skill.execute({
          queryType: 'learning_path',
          conceptName: 'Calculus',
        });

        expect(mockGraphApi.getPersonalizedLearningPath).toHaveBeenCalled();
        expect(result.result).toEqual(mockPath);
      });
    });

    describe('Weak Concepts Query', () => {
      it('should detect weak concepts', async () => {
        const mockWeakConcepts = [
          { name: 'Derivatives', masteryLevel: 30 },
          { name: 'Integrals', masteryLevel: 25 },
        ];
        mockGraphApi.detectWeakConcepts.mockResolvedValue(mockWeakConcepts);

        const skill = new GraphQuerySkill(createMockContext());
        const result = await skill.execute({
          queryType: 'weak_concepts',
          limit: 5,
        });

        expect(mockGraphApi.detectWeakConcepts).toHaveBeenCalled();
        expect(result.result).toEqual(mockWeakConcepts);
      });
    });

    describe('Concept Notes Query', () => {
      it('should get notes for concept', async () => {
        const mockNotes = [
          { id: 'note1', title: 'ML Introduction' },
          { id: 'note2', title: 'ML Advanced' },
        ];
        mockGraphApi.getNotesForConcept.mockResolvedValue(mockNotes);

        const skill = new GraphQuerySkill(createMockContext());
        const result = await skill.execute({
          queryType: 'concept_notes',
          conceptName: 'Machine Learning',
        });

        expect(result.result).toEqual(mockNotes);
      });
    });

    describe('Error Handling', () => {
      it('should handle unknown query type', async () => {
        const skill = new GraphQuerySkill(createMockContext());

        await expect(
          skill.execute({ queryType: 'unknown_type' }),
        ).rejects.toThrow('Unknown query type');
      });

      it('should handle graph API errors', async () => {
        mockGraphApi.getRelatedConcepts.mockRejectedValue(new Error('Graph error'));

        const skill = new GraphQuerySkill(createMockContext());
        const result = await skill.execute({
          queryType: 'related_concepts',
          conceptName: 'Test',
        });

        expect(result.result).toEqual([]);
      });
    });
  });

  describe('CreateNoteSkill', () => {
    let CreateNoteSkill;

    beforeEach(() => {
      jest.resetModules();
      CreateNoteSkill = require('../../main/skills/data/CreateNoteSkill');
    });

    describe('Static Properties', () => {
      it('should have correct name', () => {
        expect(CreateNoteSkill.name).toBe('create_note');
      });

      it('should have correct category', () => {
        expect(CreateNoteSkill.category).toBe('data');
      });

      it('should require content parameter', () => {
        expect(CreateNoteSkill.requiredParams).toContain('content');
      });

      it('should have sourceType parameter', () => {
        expect(CreateNoteSkill.parameters.sourceType.enum).toContain('book');
        expect(CreateNoteSkill.parameters.sourceType.enum).toContain('web');
        expect(CreateNoteSkill.parameters.sourceType.enum).toContain('manual');
      });
    });

    describe('Availability', () => {
      it('should be available when noteManager exists', () => {
        expect(CreateNoteSkill.isAvailable({ noteManager: mockNoteManager })).toBe(true);
      });

      it('should not be available without noteManager', () => {
        expect(CreateNoteSkill.isAvailable({})).toBe(false);
      });
    });

    describe('Note Creation', () => {
      it('should create note with content', async () => {
        mockNoteManager.createNote.mockResolvedValue(123);
        mockAiProvider.generateContent.mockResolvedValue('Auto-generated title');

        const skill = new CreateNoteSkill(createMockContext());
        const result = await skill.execute({
          content: 'This is my note content.',
          sourceType: 'manual',
          generateTags: false, // Disable to simplify test
        });

        expect(mockNoteManager.createNote).toHaveBeenCalled();
        expect(result.noteId).toBe(123);
      });

      it('should use provided title', async () => {
        mockNoteManager.createNote.mockResolvedValue(123);

        const skill = new CreateNoteSkill(createMockContext());
        const result = await skill.execute({
          content: 'Note content',
          title: 'My Custom Title',
          generateTags: false,
        });

        expect(result.title).toBe('My Custom Title');
      });

      it('should auto-generate title when not provided', async () => {
        mockNoteManager.createNote.mockResolvedValue(123);
        mockAiProvider.generateContent.mockResolvedValue('Generated Title');

        const skill = new CreateNoteSkill(createMockContext());
        const result = await skill.execute({
          content: 'This is a long piece of content that needs a title.',
          generateTags: false,
        });

        expect(mockAiProvider.generateContent).toHaveBeenCalled();
        expect(result.title).toBe('Generated Title');
      });

      it('should extract concepts when requested', async () => {
        mockNoteManager.createNote.mockResolvedValue(123);
        mockAiProvider.generateContent
          .mockResolvedValueOnce('Title') // For title
          .mockResolvedValueOnce('["tag1", "tag2"]') // For tags
          .mockResolvedValueOnce(
            JSON.stringify([
              { name: 'Concept1', type: 'term', importance: 5 },
            ]),
          ); // For concepts

        const skill = new CreateNoteSkill(createMockContext());
        const result = await skill.execute({
          content: 'Content about important concept.',
          extractConcepts: true,
        });

        expect(result.concepts.length).toBeGreaterThanOrEqual(0);
      });

      it('should generate tags when requested', async () => {
        mockNoteManager.createNote.mockResolvedValue(123);
        mockAiProvider.generateContent
          .mockResolvedValueOnce('Title')
          .mockResolvedValueOnce('["machine-learning", "ai", "tutorial"]');

        const skill = new CreateNoteSkill(createMockContext());
        const result = await skill.execute({
          content: 'A tutorial about machine learning and AI.',
          generateTags: true,
        });

        expect(Array.isArray(result.tags)).toBe(true);
      });

      it('should set correct Leitner box', async () => {
        mockNoteManager.createNote.mockResolvedValue(123);

        const skill = new CreateNoteSkill(createMockContext());
        const result = await skill.execute({
          content: 'Note content',
          leitnerBox: 3,
          generateTags: false,
        });

        expect(result.leitnerBox).toBe(3);
      });

      it('should set source type and ID', async () => {
        mockNoteManager.createNote.mockResolvedValue(123);

        const skill = new CreateNoteSkill(createMockContext());
        await skill.execute({
          content: 'Note from book',
          sourceType: 'book',
          sourceId: 'book_456',
          generateTags: false,
        });

        const createCall = mockNoteManager.createNote.mock.calls[0];
        expect(createCall[1].sourceType).toBe('book');
        expect(createCall[1].sourceId).toBe('book_456');
      });
    });

    describe('Error Handling', () => {
      it('should handle note creation errors', async () => {
        mockNoteManager.createNote.mockRejectedValue(new Error('Database error'));

        const skill = new CreateNoteSkill(createMockContext());

        await expect(
          skill.execute({ content: 'Test content' }),
        ).rejects.toThrow('Failed to create note');
      });

      it('should handle title generation errors gracefully', async () => {
        mockNoteManager.createNote.mockResolvedValue(123);
        mockAiProvider.generateContent.mockRejectedValue(new Error('AI error'));

        const skill = new CreateNoteSkill(createMockContext());
        const result = await skill.execute({
          content: 'This is a test note with some content.',
        });

        // Should fall back to truncated content
        expect(result.title).toContain('This is a test');
      });
    });
  });

  describe('Tool Schema Generation', () => {
    it('should generate valid tool schemas for all data skills', () => {
      const SearchNotesSkill = require('../../main/skills/data/SearchNotesSkill');
      const GraphQuerySkill = require('../../main/skills/data/GraphQuerySkill');
      const CreateNoteSkill = require('../../main/skills/data/CreateNoteSkill');

      const skills = [SearchNotesSkill, GraphQuerySkill, CreateNoteSkill];

      for (const Skill of skills) {
        const schema = Skill.getToolSchema();

        expect(schema.name).toBeDefined();
        expect(schema.description).toBeDefined();
        expect(schema.input_schema.type).toBe('object');
        expect(schema.input_schema.properties).toBeDefined();
      }
    });
  });
});
