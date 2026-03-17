/**
 * Neo4jAdapter.test.ts
 *
 * Comprehensive unit tests for the Neo4j adapter.
 * These tests cover connection management, CRUD operations, relationships,
 * spaced repetition (Leitner system), and semantic search.
 *
 * Note: These tests use mocks for the neo4j-driver.
 */

import neo4j, { Driver, Session, Result } from 'neo4j-driver';

// Mock the neo4j-driver
jest.mock('neo4j-driver', () => {
  const mockSession = {
    run: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockDriver = {
    session: jest.fn(() => mockSession),
    verifyConnectivity: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    driver: jest.fn(() => mockDriver),
    auth: {
      basic: jest.fn((user, pass) => ({ user, pass })),
    },
    int: jest.fn((val) => val),
    __mockDriver: mockDriver,
    __mockSession: mockSession,
  };
});

// Mock the dbManager for getUserIdFromToken
jest.mock('../../main/db/dbManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user-2-token') return 2;
    return -1;
  }),
}));

// Import after mocking
import Neo4jAdapter from '../../main/utils/Neo4jAdapter';

describe('Neo4jAdapter', () => {
  let neo4jAdapter: typeof Neo4jAdapter;
  let mockDriver: any;
  let mockSession: any;
  let mockStore: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Get mock references
    mockDriver = (neo4j as any).__mockDriver;
    mockSession = (neo4j as any).__mockSession;

    // Create mock store
    mockStore = {
      get: jest.fn((key: string) => {
        const config: { [key: string]: string } = {
          neo4j_uri: 'bolt://localhost:7687',
          neo4j_user: 'neo4j',
          neo4j_password: 'testpassword',
        };
        return config[key];
      }),
      set: jest.fn(),
    };

    // Reset the singleton state
    neo4jAdapter = Neo4jAdapter;
    (neo4jAdapter as any).driver = null;
    (neo4jAdapter as any).isConnected = false;
  });

  // ===========================================================================
  // CONNECTION MANAGEMENT TESTS
  // ===========================================================================

  describe('Connection Management', () => {
    test('connect() should establish connection to Neo4j', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await neo4jAdapter.connect(mockStore);

      expect(result).toBe(true);
      expect(neo4jAdapter.checkConnection()).toBe(true);
      expect(neo4j.driver).toHaveBeenCalledWith(
        'bolt://localhost:7687',
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('connect() should return false on connection failure', async () => {
      mockDriver.verifyConnectivity.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await neo4jAdapter.connect(mockStore);

      expect(result).toBe(false);
      expect(neo4jAdapter.checkConnection()).toBe(false);
    });

    test('connect() should use default config when store returns undefined', async () => {
      const emptyStore = { get: jest.fn(() => undefined), set: jest.fn() };
      mockSession.run.mockResolvedValue({ records: [] });

      await neo4jAdapter.connect(emptyStore);

      expect(neo4j.driver).toHaveBeenCalledWith(
        'bolt://localhost:7687', // default
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('disconnect() should close the driver', async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);

      await neo4jAdapter.disconnect();

      expect(mockDriver.close).toHaveBeenCalled();
      expect(neo4jAdapter.checkConnection()).toBe(false);
    });

    test('getSession() should throw when not connected', () => {
      expect(() => neo4jAdapter.getSession()).toThrow('Not connected to Neo4j');
    });

    test('getSession() should return a session when connected', async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);

      const session = neo4jAdapter.getSession();

      expect(session).toBeDefined();
      expect(mockDriver.session).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // USER OPERATIONS TESTS
  // ===========================================================================

  describe('User Operations', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('upsertUser() should create a new user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        readerLevel: 'middle',
        studyMode: 'general',
        preferredProvider: 'chatGPT',
        preferredModel: 'gpt-4o-mini',
      };

      mockSession.run.mockResolvedValueOnce({
        records: [{ get: (key: string) => ({ properties: mockUser }) }],
      });

      const result = await neo4jAdapter.upsertUser(mockUser);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (u:User {id: $id})'),
        expect.objectContaining({ id: '1', email: 'test@example.com' })
      );
      expect(result).toEqual(mockUser);
    });

    test('upsertUser() should update existing user', async () => {
      const existingUser = {
        id: '1',
        email: 'updated@example.com',
        name: 'Updated Name',
        readerLevel: 'college',
        studyMode: 'language',
        preferredProvider: 'claude',
        preferredModel: 'claude-sonnet-4',
      };

      mockSession.run.mockResolvedValueOnce({
        records: [{ get: (key: string) => ({ properties: existingUser }) }],
      });

      const result = await neo4jAdapter.upsertUser(existingUser) as any;

      expect(result.email).toBe('updated@example.com');
      expect(result.readerLevel).toBe('college');
    });
  });

  // ===========================================================================
  // BOOK OPERATIONS TESTS
  // ===========================================================================

  describe('Book Operations', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('createBook() should create a book with OWNS relationship', async () => {
      const mockBook = {
        id: 'book-001',
        keyInStorage: 'storage-key-001',
        name: 'Test Book',
        format: 'epub',
        path: '/path/to/book.epub',
      };

      mockSession.run.mockResolvedValueOnce({
        records: [{ get: (key: string) => ({ properties: { ...mockBook, userId: '1' } }) }],
      });

      const result = await neo4jAdapter.createBook(mockBook, 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {id: $userId})'),
        expect.objectContaining({ name: 'Test Book', format: 'epub' })
      );
      expect(result).toHaveProperty('name', 'Test Book');
    });

    test('createBook() should return null for invalid token', async () => {
      const result = await neo4jAdapter.createBook({}, 'invalid-token');

      expect(result).toBeNull();
    });

    test('getBooksByUser() should return user books', async () => {
      const mockBooks = [
        { properties: { id: 'book-001', name: 'Book 1' } },
        { properties: { id: 'book-002', name: 'Book 2' } },
      ];

      mockSession.run.mockResolvedValueOnce({
        records: mockBooks.map((b) => ({ get: () => b })),
      });

      const result = await neo4jAdapter.getBooksByUser('valid-token');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Book 1');
    });

    test('getBooksByUser() should return empty array for invalid token', async () => {
      const result = await neo4jAdapter.getBooksByUser('invalid-token');

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // NOTE OPERATIONS TESTS
  // ===========================================================================

  describe('Note Operations', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('createNote() should create note with bi-temporal properties', async () => {
      const mockNote = {
        id: 'note-001',
        sourceType: 'book',
        sourceKey: 'book-001',
        title: 'Test Note',
        cards: [{ id: 0, text: 'Card content', html: '', image: null, overlap: 0, type: 'normal' }],
        tags: ['test', 'demo'],
        rate: 5,
      };

      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => ({
              properties: {
                ...mockNote,
                userId: '1',
                eventTime: new Date().toISOString(),
                recordTime: new Date().toISOString(),
                leitnerBox: 1,
              },
            }),
          },
        ],
      });

      const result = await neo4jAdapter.createNote(mockNote, 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('eventTime: datetime($eventTime)'),
        expect.objectContaining({
          sourceType: 'book',
          title: 'Test Note',
          tags: ['test', 'demo'],
        })
      );
      expect(result).toHaveProperty('leitnerBox', 1);
    });

    test('createNote() should return null for invalid token', async () => {
      const result = await neo4jAdapter.createNote({}, 'invalid-token');

      expect(result).toBeNull();
    });

    test('getNoteById() should return note with parsed cards', async () => {
      const mockNote = {
        properties: {
          id: 'note-001',
          title: 'Test Note',
          cards: JSON.stringify([{ id: 0, text: 'Card 1' }]),
          position: null,
        },
      };

      mockSession.run.mockResolvedValueOnce({
        records: [{ get: () => mockNote }],
      });

      const result = await neo4jAdapter.getNoteById('note-001', 'valid-token') as any;

      expect(result).not.toBeNull();
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].text).toBe('Card 1');
    });

    test('getNoteById() should return null for non-existent note', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jAdapter.getNoteById('non-existent', 'valid-token');

      expect(result).toBeNull();
    });

    test('getNotesBySource() should return notes for a source', async () => {
      const mockNotes = [
        { properties: { id: 'note-001', title: 'Note 1', cards: '[]', position: null } },
        { properties: { id: 'note-002', title: 'Note 2', cards: '[]', position: null } },
      ];

      mockSession.run.mockResolvedValueOnce({
        records: mockNotes.map((n) => ({ get: () => n })),
      });

      const result = await neo4jAdapter.getNotesBySource('book-001', 'book', 'valid-token');

      expect(result).toHaveLength(2);
    });

    test('updateNote() should update a note field', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jAdapter.updateNote('note-001', 'title', 'Updated Title', 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET n.title = $value'),
        expect.objectContaining({ noteId: 'note-001', value: 'Updated Title' })
      );
      expect(result).toBe(1);
    });

    test('updateNote() should stringify cards field', async () => {
      const cards = [{ id: 0, text: 'New card' }];
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await neo4jAdapter.updateNote('note-001', 'cards', cards, 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ value: JSON.stringify(cards) })
      );
    });

    test('deleteNote() should delete note and relationships', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jAdapter.deleteNote('note-001', 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('DETACH DELETE n'),
        expect.objectContaining({ id: 'note-001' })
      );
      expect(result).toBe(1);
    });
  });

  // ===========================================================================
  // VOCABULARY OPERATIONS TESTS
  // ===========================================================================

  describe('Vocabulary Operations', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('createVocabulary() should create vocabulary with Leitner properties', async () => {
      const mockVocab = {
        id: 'vocab-001',
        word: 'serendipity',
        definition: 'finding something good without looking for it',
        example: 'Finding that book was pure serendipity.',
      };

      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                ...mockVocab,
                userId: '1',
                leitnerBox: 1,
                leitnerFullyLearned: false,
              },
            }),
          },
        ],
      });

      const result = await neo4jAdapter.createVocabulary(mockVocab, 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('leitnerBox: 1'),
        expect.objectContaining({ word: 'serendipity' })
      );
      expect(result).toHaveProperty('leitnerBox', 1);
    });

    test('getVocabularyByWord() should return vocabulary', async () => {
      const mockVocab = {
        properties: {
          id: 'vocab-001',
          word: 'serendipity',
          definition: 'finding something good without looking for it',
        },
      };

      mockSession.run.mockResolvedValueOnce({
        records: [{ get: () => mockVocab }],
      });

      const result = await neo4jAdapter.getVocabularyByWord('serendipity', 'valid-token');

      expect(result).toHaveProperty('word', 'serendipity');
    });

    test('getVocabularyByWord() should return null for non-existent word', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jAdapter.getVocabularyByWord('nonexistent', 'valid-token');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // SPACED REPETITION (LEITNER SYSTEM) TESTS
  // ===========================================================================

  describe('Spaced Repetition (Leitner System)', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('getDueForReview() should return items due for review', async () => {
      const mockItems = [
        {
          get: (key: string) => {
            if (key === 'itemType') return 'note';
            return { properties: { id: 'note-001', title: 'Note 1', cards: '[]', leitnerBox: 2 } };
          },
        },
        {
          get: (key: string) => {
            if (key === 'itemType') return 'vocabulary';
            return { properties: { id: 'vocab-001', word: 'test', leitnerBox: 1 } };
          },
        },
      ];

      mockSession.run.mockResolvedValueOnce({ records: mockItems });

      const result = await neo4jAdapter.getDueForReview(
        new Date(),
        ['note', 'vocabulary'],
        50,
        'valid-token'
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('itemType', 'note');
      expect(result[1]).toHaveProperty('itemType', 'vocabulary');
    });

    test('getDueForReview() should return empty array for invalid token', async () => {
      const result = await neo4jAdapter.getDueForReview(new Date(), ['note'], 50, 'invalid-token');

      expect(result).toEqual([]);
    });

    test('recordReview() should update Leitner box on correct answer', async () => {
      // First call for updating the item
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'oldBox') return 2;
              return { properties: { id: 'note-001', leitnerBox: 3 } };
            },
          },
        ],
      });
      // Second call for creating REVIEWED relationship
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jAdapter.recordReview('note-001', 'note', 'correct', 2, 'valid-token');

      expect(result).toHaveProperty('leitnerBox', 3);
    });

    test('recordReview() should reset Leitner box on incorrect answer', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'oldBox') return 3;
              return { properties: { id: 'note-001', leitnerBox: 1 } };
            },
          },
        ],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jAdapter.recordReview('note-001', 'note', 'incorrect', 2, 'valid-token');

      expect(result).toHaveProperty('leitnerBox', 1);
    });

    test('recordReview() should return null for invalid token', async () => {
      const result = await neo4jAdapter.recordReview('note-001', 'note', 'correct', 2, 'invalid-token');

      expect(result).toBeNull();
    });

    test('addNoteToLeitnerStudy() should set initial Leitner properties', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: { id: 'note-001', leitnerBox: 1, leitnerFullyLearned: false },
            }),
          },
        ],
      });

      const result = await neo4jAdapter.addNoteToLeitnerStudy('note-001', 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET n.leitnerBox = 1'),
        expect.any(Object)
      );
      expect(result).toHaveProperty('leitnerBox', 1);
    });
  });

  // ===========================================================================
  // CONCEPT OPERATIONS TESTS
  // ===========================================================================

  describe('Concept Operations', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('upsertConcept() should create a new concept', async () => {
      const mockConcept = {
        id: 'concept-001',
        name: 'Machine Learning',
        description: 'A branch of AI',
        category: 'Computer Science',
      };

      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: { ...mockConcept, masteryLevel: 0, exposureCount: 1 },
            }),
          },
        ],
      });

      const result = await neo4jAdapter.upsertConcept(mockConcept, 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (c:Concept {name: $name, userId: $userId})'),
        expect.objectContaining({ name: 'Machine Learning' })
      );
      expect(result).toHaveProperty('exposureCount', 1);
    });

    test('upsertConcept() should increment exposure count on update', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: { id: 'concept-001', name: 'ML', exposureCount: 5 },
            }),
          },
        ],
      });

      const result = await neo4jAdapter.upsertConcept(
        { name: 'ML', id: 'concept-001' },
        'valid-token'
      );

      expect(result).toHaveProperty('exposureCount', 5);
    });

    test('createMentionsRelationship() should create relationship', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await neo4jAdapter.createMentionsRelationship('note-001', 'concept-001', 3, 0.8);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (n)-[r:MENTIONS_CONCEPT]->(c)'),
        expect.objectContaining({
          noteId: 'note-001',
          conceptId: 'concept-001',
          frequency: 3,
          importance: 0.8,
        })
      );
    });
  });

  // ===========================================================================
  // LEARNING SESSION TESTS
  // ===========================================================================

  describe('Learning Session Operations', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('startLearningSession() should create a new session', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                id: 'session-001',
                activityType: 'reading',
                primaryResourceType: 'book',
                primaryResourceId: 'book-001',
              },
            }),
          },
        ],
      });

      const result = await neo4jAdapter.startLearningSession(
        'reading',
        'book',
        'book-001',
        'valid-token'
      );

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (s:LearningSession'),
        expect.objectContaining({
          activityType: 'reading',
          primaryResourceType: 'book',
        })
      );
      expect(result).toHaveProperty('activityType', 'reading');
    });

    test('endLearningSession() should update session with stats', async () => {
      const stats = {
        focusScore: 0.85,
        notesCreated: 5,
        conceptsReviewed: 10,
        wordsLearned: 3,
      };

      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: { id: 'session-001', duration: 1800, ...stats },
            }),
          },
        ],
      });

      const result = await neo4jAdapter.endLearningSession('session-001', stats, 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET s.endTime = datetime()'),
        expect.objectContaining({
          sessionId: 'session-001',
          focusScore: 0.85,
          notesCreated: 5,
        })
      );
      expect(result).toHaveProperty('focusScore', 0.85);
    });
  });

  // ===========================================================================
  // SEMANTIC SEARCH TESTS
  // ===========================================================================

  describe('Semantic Search', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('storeEmbedding() should store embedding on node', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await neo4jAdapter.storeEmbedding('note-001', 'Note', [0.1, 0.2, 0.3], 'text-embedding-3-small');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET n.embedding = $embedding'),
        expect.objectContaining({
          nodeId: 'note-001',
          embedding: [0.1, 0.2, 0.3],
          model: 'text-embedding-3-small',
        })
      );
    });

    test('findSimilar() should return similar nodes with scores', async () => {
      const mockResults = [
        {
          get: (key: string) => {
            if (key === 'similarity') return 0.95;
            if (key === 'nodeType') return 'Note';
            return { properties: { id: 'note-001', title: 'Similar Note' } };
          },
        },
      ];

      mockSession.run.mockResolvedValueOnce({ records: mockResults });

      const result = await neo4jAdapter.findSimilar(
        [0.1, 0.2, 0.3],
        ['Note'],
        10,
        0.7,
        'valid-token'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('similarity', 0.95);
      expect(result[0].node).toHaveProperty('title', 'Similar Note');
    });

    test('searchNotes() should search notes by text', async () => {
      const mockNotes = [
        { properties: { id: 'note-001', title: 'Machine Learning', cards: '[]', position: null } },
      ];

      mockSession.run.mockResolvedValueOnce({
        records: mockNotes.map((n) => ({ get: () => n })),
      });

      const result = await neo4jAdapter.searchNotes('machine', 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining("n.title CONTAINS $query"),
        expect.objectContaining({ query: 'machine' })
      );
      expect(result).toHaveLength(1);
    });
  });

  // ===========================================================================
  // LEARNING PATH TESTS
  // ===========================================================================

  describe('Learning Path', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('getLearningPath() should return prerequisites', async () => {
      const mockPrereqs = [
        {
          get: (key: string) => {
            if (key === 'mastered') return true;
            return { properties: { id: 'prereq-001', name: 'Prerequisite 1', masteryLevel: 80 } };
          },
        },
        {
          get: (key: string) => {
            if (key === 'mastered') return false;
            return { properties: { id: 'prereq-002', name: 'Prerequisite 2', masteryLevel: 40 } };
          },
        },
      ];

      mockSession.run.mockResolvedValueOnce({ records: mockPrereqs });

      const result = await neo4jAdapter.getLearningPath('target-concept', 5, 'valid-token') as any;

      expect(result).not.toBeNull();
      expect(result.prerequisites).toHaveLength(2);
      expect(result.masteredCount).toBe(1);
      expect(result.totalCount).toBe(2);
      expect(result.readyToLearn).toBe(false);
    });

    test('getKnowledgeAtTime() should return historical knowledge state', async () => {
      const mockKnowledge = [
        {
          get: (key: string) => {
            if (key === 'lastReview') return '2024-01-15T10:00:00Z';
            if (key === 'reviewCount') return 5;
            if (key === 'itemType') return 'Note';
            return { properties: { id: 'note-001', title: 'History Note' } };
          },
        },
      ];

      mockSession.run.mockResolvedValueOnce({ records: mockKnowledge });

      const result = await neo4jAdapter.getKnowledgeAtTime(new Date('2024-01-15'), 'valid-token');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('reviewCount', 5);
    });
  });

  // ===========================================================================
  // CHAT OPERATIONS TESTS
  // ===========================================================================

  describe('Chat Operations', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('createChat() should create a chat node', async () => {
      const mockChat = {
        id: 'chat-001',
        description: 'Test Chat',
        totalTokens: 0,
        pinned: false,
        sessionType: 'general',
      };

      mockSession.run.mockResolvedValueOnce({
        records: [{ get: () => ({ properties: { ...mockChat, userId: '1' } }) }],
      });

      const result = await neo4jAdapter.createChat(mockChat, 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (c:Chat'),
        expect.objectContaining({ description: 'Test Chat' })
      );
      expect(result).toHaveProperty('description', 'Test Chat');
    });

    test('addMessage() should add message to chat', async () => {
      const mockMessage = {
        id: 'msg-001',
        role: 'user',
        content: 'Hello, world!',
        tokenCount: 10,
      };

      mockSession.run.mockResolvedValueOnce({
        records: [{ get: () => ({ properties: mockMessage }) }],
      });

      const result = await neo4jAdapter.addMessage(mockMessage, 'chat-001', 'valid-token');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (m:Message'),
        expect.objectContaining({
          role: 'user',
          content: 'Hello, world!',
          chatId: 'chat-001',
        })
      );
      expect(result).toHaveProperty('role', 'user');
    });
  });

  // ===========================================================================
  // MIGRATION TESTS
  // ===========================================================================

  describe('Migration Helpers', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('getMigrationStats() should return node counts', async () => {
      const mockStats = [
        { get: (key: string) => (key === 'nodeType' ? 'Note' : 150) },
        { get: (key: string) => (key === 'nodeType' ? 'Book' : 25) },
        { get: (key: string) => (key === 'nodeType' ? 'Vocabulary' : 500) },
      ];

      mockSession.run.mockResolvedValueOnce({ records: mockStats });

      const result = await neo4jAdapter.getMigrationStats();

      expect(result).toEqual({
        Note: 150,
        Book: 25,
        Vocabulary: 500,
      });
    });

    test('migrateNote() should migrate SQLite note to Neo4j', async () => {
      const sqliteNote = {
        id: 1001,
        sourceType: 'book',
        sourceKey: 'book-001',
        title: 'Migrated Note',
        cards: [{ id: 0, text: 'Content' }],
        leitnerItemId: 100,
        leitnerItem: {
          box: 3,
          nextReview: '2024-02-01T00:00:00Z',
          fullyLearned: false,
          skips: 1,
          flips: 5,
          score: 80,
        },
      };

      // First call for createNote
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: { id: '1001', title: 'Migrated Note', leitnerBox: 1 },
            }),
          },
        ],
      });
      // Second call for updating Leitner properties
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jAdapter.migrateNote(sqliteNote, 'valid-token');

      expect(result).toHaveProperty('title', 'Migrated Note');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      await neo4jAdapter.connect(mockStore);
    });

    test('updateNote() should return -1 on database error', async () => {
      mockSession.run.mockRejectedValueOnce(new Error('Database error'));

      const result = await neo4jAdapter.updateNote('note-001', 'title', 'New Title', 'valid-token');

      expect(result).toBe(-1);
    });

    test('deleteNote() should return -1 on database error', async () => {
      mockSession.run.mockRejectedValueOnce(new Error('Database error'));

      const result = await neo4jAdapter.deleteNote('note-001', 'valid-token');

      expect(result).toBe(-1);
    });
  });
});
