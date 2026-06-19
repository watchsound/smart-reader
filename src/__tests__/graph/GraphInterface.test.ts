/**
 * GraphInterface.test.ts
 *
 * Unit tests for the GraphInterface abstraction layer.
 * Tests initialization, adapter switching, and method delegation.
 */

// Mock Neo4jAdapter
const mockNeo4jAdapter = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  checkConnection: jest.fn(),
  upsertUser: jest.fn(),
  createBook: jest.fn(),
  getBooksByUser: jest.fn(),
  createNote: jest.fn(),
  getNoteById: jest.fn(),
  getNotesBySource: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
  searchNotes: jest.fn(),
  createVocabulary: jest.fn(),
  getVocabularyByWord: jest.fn(),
  getDueForReview: jest.fn(),
  recordReview: jest.fn(),
  addNoteToLeitnerStudy: jest.fn(),
  upsertConcept: jest.fn(),
  createMentionsRelationship: jest.fn(),
  startLearningSession: jest.fn(),
  endLearningSession: jest.fn(),
  storeEmbedding: jest.fn(),
  findSimilar: jest.fn(),
  getLearningPath: jest.fn(),
  getKnowledgeAtTime: jest.fn(),
  createChat: jest.fn(),
  addMessage: jest.fn(),
  searchMessages: jest.fn(),
  createBookmark: jest.fn(),
  getBookmarksBySource: jest.fn(),
  searchBookmarks: jest.fn(),
  getStats: jest.fn(),
};

jest.mock('../../main/utils/Neo4jAdapter', () => ({
  __esModule: true,
  default: mockNeo4jAdapter,
}));

// Import after mocking
import graphInterface from '../../main/utils/GraphInterface';

describe('GraphInterface', () => {
  let mockStore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the GraphInterface singleton state
    (graphInterface as any).adapter = null;
    (graphInterface as any).adapterType = null;
    (graphInterface as any).isInitialized = false;

    mockStore = {
      get: jest.fn((key: string) => {
        if (key === 'graph.adapterType') return 'neo4j';
        return null;
      }),
      set: jest.fn(),
    };

    // Default mock behavior
    mockNeo4jAdapter.connect.mockResolvedValue(true);
    mockNeo4jAdapter.checkConnection.mockReturnValue(true);
  });

  // ===========================================================================
  // INITIALIZATION TESTS
  // ===========================================================================

  describe('Initialization', () => {
    test('should initialize with neo4j adapter', async () => {
      const result = await graphInterface.initialize('neo4j', mockStore);

      expect(result).toBe(true);
      expect(graphInterface.getAdapterType()).toBe('neo4j');
      expect(graphInterface.isReady()).toBe(true);
      expect(mockNeo4jAdapter.connect).toHaveBeenCalledWith(mockStore);
    });

    test('should throw error for unknown adapter type', async () => {
      await expect(graphInterface.initialize('unknown' as any, mockStore)).rejects.toThrow(
        'Unknown adapter type: unknown'
      );
    });

    test('should throw error for unknown adapter type (graphiti placeholder dropped in D3)', async () => {
      // D3: the speculative 'graphiti' case in GraphInterface.initialize was
      // removed alongside Kùzu cleanup — nothing actually wired it. Unknown
      // types now fall through to the default-case throw.
      await expect(graphInterface.initialize('graphiti', mockStore)).rejects.toThrow(
        /Unknown adapter type/,
      );
    });

    test('should throw for kuzu adapter type (kuzu removed in D3, main.ts coerces to sqlite)', async () => {
      // Kùzu's win32-x64 prebuilt segfaults Electron at require() time; the
      // adapter was deleted in commit dfbce34. main.ts coerces any stored
      // 'kuzu' preference to 'sqlite' before calling initialize(), so this
      // throw path is only hit if something bypasses that coercion.
      await expect(graphInterface.initialize('kuzu' as any, mockStore)).rejects.toThrow(
        'Unknown adapter type: kuzu',
      );
    });

    test('should not re-initialize if already initialized with same adapter', async () => {
      await graphInterface.initialize('neo4j', mockStore);
      mockNeo4jAdapter.connect.mockClear();

      await graphInterface.initialize('neo4j', mockStore);

      expect(mockNeo4jAdapter.connect).not.toHaveBeenCalled();
    });

    test('should disconnect old adapter when switching', async () => {
      await graphInterface.initialize('neo4j', mockStore);

      // Attempting to switch to graphiti would disconnect neo4j first
      // (but graphiti throws an error, so we can't fully test the switch)
      // This test just verifies the adapter is set correctly initially
      expect(graphInterface.getAdapterType()).toBe('neo4j');
    });
  });

  // ===========================================================================
  // CONNECTION TESTS
  // ===========================================================================

  describe('Connection Management', () => {
    beforeEach(async () => {
      await graphInterface.initialize('neo4j', mockStore);
    });

    test('checkConnection should delegate to adapter', () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(true);

      const result = graphInterface.checkConnection();

      expect(result).toBe(true);
      expect(mockNeo4jAdapter.checkConnection).toHaveBeenCalled();
    });

    test('disconnect should delegate to adapter', async () => {
      mockNeo4jAdapter.disconnect.mockResolvedValue(undefined);

      await graphInterface.disconnect();

      expect(mockNeo4jAdapter.disconnect).toHaveBeenCalled();
      expect(graphInterface.isReady()).toBe(false);
    });

    test('checkConnection should return false when not initialized', () => {
      (graphInterface as any).adapter = null;

      const result = graphInterface.checkConnection();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // METHOD DELEGATION TESTS
  // ===========================================================================

  describe('Method Delegation', () => {
    beforeEach(async () => {
      await graphInterface.initialize('neo4j', mockStore);
    });

    test('should throw error when calling methods without initialization', async () => {
      (graphInterface as any).adapter = null;

      await expect(graphInterface.createNote({}, 'token')).rejects.toThrow(
        'GraphInterface not initialized'
      );
    });

    // User operations
    test('upsertUser should delegate to adapter', async () => {
      const user = { id: 1, email: 'test@test.com' };
      mockNeo4jAdapter.upsertUser.mockResolvedValue(user);

      const result = await graphInterface.upsertUser(user);

      expect(mockNeo4jAdapter.upsertUser).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    // Book operations
    test('createBook should delegate to adapter', async () => {
      const book = { id: 'book-001', name: 'Test Book' };
      mockNeo4jAdapter.createBook.mockResolvedValue(book);

      const result = await graphInterface.createBook(book, 'token');

      expect(mockNeo4jAdapter.createBook).toHaveBeenCalledWith(book, 'token');
      expect(result).toEqual(book);
    });

    test('getBooksByUser should delegate to adapter', async () => {
      const books = [{ id: 'book-001' }, { id: 'book-002' }];
      mockNeo4jAdapter.getBooksByUser.mockResolvedValue(books);

      const result = await graphInterface.getBooksByUser('token');

      expect(mockNeo4jAdapter.getBooksByUser).toHaveBeenCalledWith('token');
      expect(result).toEqual(books);
    });

    // Note operations
    test('createNote should delegate to adapter', async () => {
      const note = { id: 'note-001', title: 'Test Note' };
      mockNeo4jAdapter.createNote.mockResolvedValue(note);

      const result = await graphInterface.createNote(note, 'token');

      expect(mockNeo4jAdapter.createNote).toHaveBeenCalledWith(note, 'token');
      expect(result).toEqual(note);
    });

    test('getNoteById should delegate to adapter', async () => {
      const note = { id: 'note-001', title: 'Test Note' };
      mockNeo4jAdapter.getNoteById.mockResolvedValue(note);

      const result = await graphInterface.getNoteById('note-001', 'token');

      expect(mockNeo4jAdapter.getNoteById).toHaveBeenCalledWith('note-001', 'token');
      expect(result).toEqual(note);
    });

    test('getNotesBySource should delegate to adapter', async () => {
      const notes = [{ id: 'note-001' }];
      mockNeo4jAdapter.getNotesBySource.mockResolvedValue(notes);

      const result = await graphInterface.getNotesBySource('book-001', 'book', 'token');

      expect(mockNeo4jAdapter.getNotesBySource).toHaveBeenCalledWith('book-001', 'book', 'token');
      expect(result).toEqual(notes);
    });

    test('updateNote should delegate to adapter', async () => {
      mockNeo4jAdapter.updateNote.mockResolvedValue(1);

      const result = await graphInterface.updateNote('note-001', 'title', 'New Title', 'token');

      expect(mockNeo4jAdapter.updateNote).toHaveBeenCalledWith(
        'note-001',
        'title',
        'New Title',
        'token'
      );
      expect(result).toBe(1);
    });

    test('deleteNote should delegate to adapter', async () => {
      mockNeo4jAdapter.deleteNote.mockResolvedValue(1);

      const result = await graphInterface.deleteNote('note-001', 'token');

      expect(mockNeo4jAdapter.deleteNote).toHaveBeenCalledWith('note-001', 'token');
      expect(result).toBe(1);
    });

    test('searchNotes should delegate to adapter', async () => {
      const notes = [{ id: 'note-001', title: 'Machine Learning' }];
      mockNeo4jAdapter.searchNotes.mockResolvedValue(notes);

      const result = await graphInterface.searchNotes('machine', 'token');

      expect(mockNeo4jAdapter.searchNotes).toHaveBeenCalledWith('machine', 'token');
      expect(result).toEqual(notes);
    });

    // Vocabulary operations
    test('createVocabulary should delegate to adapter', async () => {
      const vocab = { id: 'vocab-001', word: 'serendipity' };
      mockNeo4jAdapter.createVocabulary.mockResolvedValue(vocab);

      const result = await graphInterface.createVocabulary(vocab, 'token');

      expect(mockNeo4jAdapter.createVocabulary).toHaveBeenCalledWith(vocab, 'token');
      expect(result).toEqual(vocab);
    });

    test('getVocabularyByWord should delegate to adapter', async () => {
      const vocab = { id: 'vocab-001', word: 'serendipity' };
      mockNeo4jAdapter.getVocabularyByWord.mockResolvedValue(vocab);

      const result = await graphInterface.getVocabularyByWord('serendipity', 'token');

      expect(mockNeo4jAdapter.getVocabularyByWord).toHaveBeenCalledWith('serendipity', 'token');
      expect(result).toEqual(vocab);
    });

    // Spaced repetition operations
    test('getDueForReview should delegate to adapter', async () => {
      const items = [{ id: 'note-001', leitnerBox: 2 }];
      const date = new Date();
      mockNeo4jAdapter.getDueForReview.mockResolvedValue(items);

      const result = await graphInterface.getDueForReview(date, ['note'], 50, 'token');

      expect(mockNeo4jAdapter.getDueForReview).toHaveBeenCalledWith(date, ['note'], 50, 'token');
      expect(result).toEqual(items);
    });

    test('recordReview should delegate to adapter', async () => {
      const item = { id: 'note-001', leitnerBox: 3 };
      mockNeo4jAdapter.recordReview.mockResolvedValue(item);

      const result = await graphInterface.recordReview('note-001', 'note', 'correct', 2, 'token');

      expect(mockNeo4jAdapter.recordReview).toHaveBeenCalledWith(
        'note-001',
        'note',
        'correct',
        2,
        'token'
      );
      expect(result).toEqual(item);
    });

    test('addNoteToLeitnerStudy should delegate to adapter', async () => {
      const note = { id: 'note-001', leitnerBox: 1 };
      mockNeo4jAdapter.addNoteToLeitnerStudy.mockResolvedValue(note);

      const result = await graphInterface.addNoteToLeitnerStudy('note-001', 'token');

      expect(mockNeo4jAdapter.addNoteToLeitnerStudy).toHaveBeenCalledWith('note-001', 'token');
      expect(result).toEqual(note);
    });

    // Concept operations
    test('upsertConcept should delegate to adapter', async () => {
      const concept = { id: 'concept-001', name: 'Machine Learning' };
      mockNeo4jAdapter.upsertConcept.mockResolvedValue(concept);

      const result = await graphInterface.upsertConcept(concept, 'token');

      expect(mockNeo4jAdapter.upsertConcept).toHaveBeenCalledWith(concept, 'token');
      expect(result).toEqual(concept);
    });

    test('createMentionsRelationship should delegate to adapter', async () => {
      mockNeo4jAdapter.createMentionsRelationship.mockResolvedValue(undefined);

      await graphInterface.createMentionsRelationship('note-001', 'concept-001', 3, 0.8);

      expect(mockNeo4jAdapter.createMentionsRelationship).toHaveBeenCalledWith(
        'note-001',
        'concept-001',
        3,
        0.8
      );
    });

    // Learning session operations
    test('startLearningSession should delegate to adapter', async () => {
      const session = { id: 'session-001', activityType: 'reading' };
      mockNeo4jAdapter.startLearningSession.mockResolvedValue(session);

      const result = await graphInterface.startLearningSession(
        'reading',
        'book',
        'book-001',
        'token'
      );

      expect(mockNeo4jAdapter.startLearningSession).toHaveBeenCalledWith(
        'reading',
        'book',
        'book-001',
        'token'
      );
      expect(result).toEqual(session);
    });

    test('endLearningSession should delegate to adapter', async () => {
      const session = { id: 'session-001', duration: 1800 };
      const stats = { focusScore: 0.85 };
      mockNeo4jAdapter.endLearningSession.mockResolvedValue(session);

      const result = await graphInterface.endLearningSession('session-001', stats, 'token');

      expect(mockNeo4jAdapter.endLearningSession).toHaveBeenCalledWith(
        'session-001',
        stats,
        'token'
      );
      expect(result).toEqual(session);
    });

    // Semantic search operations
    test('storeEmbedding should delegate to adapter', async () => {
      const embedding = [0.1, 0.2, 0.3];
      mockNeo4jAdapter.storeEmbedding.mockResolvedValue(undefined);

      await graphInterface.storeEmbedding('note-001', 'Note', embedding, 'model');

      expect(mockNeo4jAdapter.storeEmbedding).toHaveBeenCalledWith(
        'note-001',
        'Note',
        embedding,
        'model'
      );
    });

    test('findSimilar should delegate to adapter', async () => {
      const similar = [{ node: { id: 'note-001' }, similarity: 0.95 }];
      const embedding = [0.1, 0.2, 0.3];
      mockNeo4jAdapter.findSimilar.mockResolvedValue(similar);

      const result = await graphInterface.findSimilar(embedding, ['Note'], 10, 0.7, 'token');

      expect(mockNeo4jAdapter.findSimilar).toHaveBeenCalledWith(
        embedding,
        ['Note'],
        10,
        0.7,
        'token'
      );
      expect(result).toEqual(similar);
    });

    // Learning path operations
    test('getLearningPath should delegate to adapter', async () => {
      const path = { prerequisites: [], readyToLearn: true };
      mockNeo4jAdapter.getLearningPath.mockResolvedValue(path);

      const result = await graphInterface.getLearningPath('concept-001', 5, 'token');

      expect(mockNeo4jAdapter.getLearningPath).toHaveBeenCalledWith('concept-001', 5, 'token');
      expect(result).toEqual(path);
    });

    test('getKnowledgeAtTime should delegate to adapter', async () => {
      const knowledge = [{ item: { id: 'note-001' }, reviewCount: 5 }];
      const date = new Date();
      mockNeo4jAdapter.getKnowledgeAtTime.mockResolvedValue(knowledge);

      const result = await graphInterface.getKnowledgeAtTime(date, 'token');

      expect(mockNeo4jAdapter.getKnowledgeAtTime).toHaveBeenCalledWith(date, 'token');
      expect(result).toEqual(knowledge);
    });

    // Chat operations
    test('createChat should delegate to adapter', async () => {
      const chat = { id: 'chat-001', description: 'Test Chat' };
      mockNeo4jAdapter.createChat.mockResolvedValue(chat);

      const result = await graphInterface.createChat(chat, 'token');

      expect(mockNeo4jAdapter.createChat).toHaveBeenCalledWith(chat, 'token');
      expect(result).toEqual(chat);
    });

    test('addMessage should delegate to adapter', async () => {
      const message = { id: 'msg-001', role: 'user', content: 'Hello' };
      mockNeo4jAdapter.addMessage.mockResolvedValue(message);

      const result = await graphInterface.addMessage(message, 'chat-001', 'token');

      expect(mockNeo4jAdapter.addMessage).toHaveBeenCalledWith(message, 'chat-001', 'token');
      expect(result).toEqual(message);
    });

    test('searchMessages should delegate to adapter', async () => {
      const messages = [{ id: 'msg-001', content: 'test message' }];
      mockNeo4jAdapter.searchMessages.mockResolvedValue(messages);

      const result = await graphInterface.searchMessages('test', 'token');

      expect(mockNeo4jAdapter.searchMessages).toHaveBeenCalledWith('test', 'token');
      expect(result).toEqual(messages);
    });

    // Bookmark operations
    test('createBookmark should delegate to adapter', async () => {
      const bookmark = { id: 'bookmark-001', title: 'Test Site', url: 'https://test.com' };
      mockNeo4jAdapter.createBookmark.mockResolvedValue(bookmark);

      const result = await graphInterface.createBookmark(bookmark, 'token');

      expect(mockNeo4jAdapter.createBookmark).toHaveBeenCalledWith(bookmark, 'token');
      expect(result).toEqual(bookmark);
    });

    test('getBookmarksBySource should delegate to adapter', async () => {
      const bookmarks = [{ id: 'bookmark-001', url: 'https://test.com' }];
      mockNeo4jAdapter.getBookmarksBySource.mockResolvedValue(bookmarks);

      const result = await graphInterface.getBookmarksBySource('https://test.com', 'token');

      expect(mockNeo4jAdapter.getBookmarksBySource).toHaveBeenCalledWith('https://test.com', 'token');
      expect(result).toEqual(bookmarks);
    });

    test('searchBookmarks should delegate to adapter', async () => {
      const bookmarks = [{ id: 'bookmark-001', title: 'Test' }];
      mockNeo4jAdapter.searchBookmarks.mockResolvedValue(bookmarks);

      const result = await graphInterface.searchBookmarks('test', 'token');

      expect(mockNeo4jAdapter.searchBookmarks).toHaveBeenCalledWith('test', 'token');
      expect(result).toEqual(bookmarks);
    });

    // Stats
    test('getStats should delegate to adapter', async () => {
      const stats = { Note: 100, Book: 25 };
      mockNeo4jAdapter.getStats.mockResolvedValue(stats);

      const result = await graphInterface.getStats();

      expect(mockNeo4jAdapter.getStats).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });

    test('getStats should return empty object if adapter does not have getStats', async () => {
      (mockNeo4jAdapter as any).getStats = undefined;

      const result = await graphInterface.getStats();

      expect(result).toEqual({});
    });
  });

  // ===========================================================================
  // SINGLETON TESTS
  // ===========================================================================

  describe('Singleton Behavior', () => {
    test('should return same instance', () => {
      const instance1 = graphInterface;
      const instance2 = require('../../main/utils/GraphInterface').default;

      // They should be the same object (singleton)
      expect(instance1).toBe(instance2);
    });
  });
});
