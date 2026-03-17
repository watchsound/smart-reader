/**
 * graphHandlers.test.ts
 *
 * Unit tests for the graph IPC handlers.
 * Tests ensure proper communication between renderer and main processes.
 * Uses GraphInterface abstraction layer.
 */

// Mock OpenAI before any imports that might load it
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

import { ipcMain } from 'electron';

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
  },
}));

// Mock GraphInterface
const mockGraphInterface = {
  initialize: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  checkConnection: jest.fn(),
  isReady: jest.fn(),
  getAdapterType: jest.fn(),
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

jest.mock('../../main/utils/GraphInterface', () => ({
  __esModule: true,
  default: mockGraphInterface,
}));

// Mock GraphLearningFeatures
const mockGraphLearningFeatures = {
  isAvailable: jest.fn().mockReturnValue(true),
  createConceptWithPrereqs: jest.fn(),
  getPersonalizedLearningPath: jest.fn(),
  getDependentConcepts: jest.fn(),
  detectWeakConcepts: jest.fn(),
  getErrorProneTopics: jest.fn(),
  resolveRelatedConcepts: jest.fn(),
  linkConcepts: jest.fn(),
  extractConceptsFromText: jest.fn(),
  getConceptClusters: jest.fn(),
  updateConceptMastery: jest.fn(),
  getMasteryProgress: jest.fn(),
  getKnowledgeGraphData: jest.fn(),
};

jest.mock('../../main/utils/GraphLearningFeatures', () => ({
  __esModule: true,
  default: mockGraphLearningFeatures,
}));

// Mock GraphEmbeddingManager
const mockGraphEmbeddingManager = {
  setup: jest.fn(),
  isEnabled: jest.fn().mockReturnValue(true),
  searchBooks: jest.fn(),
  searchNotes: jest.fn(),
  searchMessages: jest.fn(),
  searchBookmarks: jest.fn(),
  getBookContentByQuery: jest.fn(),
  addBookmark: jest.fn(),
  addBook: jest.fn(),
  addNote: jest.fn(),
  syncNote: jest.fn(),
  addMessage: jest.fn(),
};

jest.mock('../../main/utils/GraphEmbeddingManager', () => ({
  __esModule: true,
  default: mockGraphEmbeddingManager,
}));

// Mock AIConceptExtractionService to avoid OpenAI import chain
jest.mock('../../main/utils/AIConceptExtractionService', () => ({
  __esModule: true,
  default: {
    extractConceptsWithAI: jest.fn(),
    extractEntitiesWithAI: jest.fn(),
    fullExtraction: jest.fn(),
    saveToGraph: jest.fn(),
    isAIExtractionAvailable: jest.fn().mockReturnValue(false),
  },
}));

// Mock AIProviderManager to avoid OpenAI/provider imports
jest.mock('../../commons/service/AIProviderManager', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      generateContentWithJson: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(false),
    }),
  },
}));

// Import after mocking
import registerGraphHandlers from '../../main/ipc/graphHandlers';

describe('Graph IPC Handlers', () => {
  let mockStore: any;
  let registeredHandlers: Map<string, Function>;
  let registeredInvokeHandlers: Map<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Capture registered handlers
    registeredHandlers = new Map();
    registeredInvokeHandlers = new Map();

    (ipcMain.on as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      registeredInvokeHandlers.set(channel, handler);
    });

    mockStore = {
      get: jest.fn(),
      set: jest.fn(),
    };

    // Register handlers
    registerGraphHandlers(mockStore);
  });

  // Helper to simulate IPC call
  const callHandler = async (channel: string, ...args: any[]) => {
    const handler = registeredHandlers.get(channel);
    if (!handler) throw new Error(`Handler not registered: ${channel}`);

    const mockEvent = { returnValue: undefined };
    await handler(mockEvent, ...args);
    return mockEvent.returnValue;
  };

  const callInvokeHandler = async (channel: string, ...args: any[]) => {
    const handler = registeredInvokeHandlers.get(channel);
    if (!handler) throw new Error(`Invoke handler not registered: ${channel}`);

    const mockEvent = {};
    return await handler(mockEvent, ...args);
  };

  // ===========================================================================
  // REGISTRATION TESTS
  // ===========================================================================

  describe('Handler Registration', () => {
    test('should register all connection handlers', () => {
      expect(registeredHandlers.has('graph-connect')).toBe(true);
      expect(registeredHandlers.has('graph-check-connection')).toBe(true);
      expect(registeredHandlers.has('graph-disconnect')).toBe(true);
    });

    test('should register all note handlers', () => {
      expect(registeredHandlers.has('graph-create-note')).toBe(true);
      expect(registeredHandlers.has('graph-get-note')).toBe(true);
      expect(registeredHandlers.has('graph-get-notes-by-source')).toBe(true);
      expect(registeredHandlers.has('graph-update-note')).toBe(true);
      expect(registeredHandlers.has('graph-delete-note')).toBe(true);
      expect(registeredHandlers.has('graph-search-notes')).toBe(true);
    });

    test('should register all vocabulary handlers', () => {
      expect(registeredHandlers.has('graph-create-vocabulary')).toBe(true);
      expect(registeredHandlers.has('graph-get-vocabulary-by-word')).toBe(true);
    });

    test('should register all spaced repetition handlers', () => {
      expect(registeredHandlers.has('graph-get-due-for-review')).toBe(true);
      expect(registeredHandlers.has('graph-record-review')).toBe(true);
      expect(registeredHandlers.has('graph-add-note-to-leitner')).toBe(true);
    });

    test('should register stats handler', () => {
      expect(registeredHandlers.has('graph-get-stats')).toBe(true);
    });
  });

  // ===========================================================================
  // CONNECTION HANDLER TESTS
  // ===========================================================================

  describe('Connection Handlers', () => {
    test('graph-connect should call GraphInterface.initialize', async () => {
      mockGraphInterface.initialize.mockResolvedValue(true);

      const result = await callHandler('graph-connect');

      // Default adapter is now 'kuzu' (embedded, MIT license)
      expect(mockGraphInterface.initialize).toHaveBeenCalledWith('kuzu', mockStore);
      expect(result).toEqual({ success: true, error: null });
    });

    test('graph-connect should handle connection failure', async () => {
      mockGraphInterface.initialize.mockRejectedValue(new Error('Connection failed'));

      const result = await callHandler('graph-connect');

      expect(result).toEqual({ success: false, error: 'Connection failed' });
    });

    test('graph-check-connection should return connection status', async () => {
      mockGraphInterface.checkConnection.mockReturnValue(true);

      const result = await callHandler('graph-check-connection');

      expect(result).toBe(true);
    });

    test('graph-disconnect should call GraphInterface.disconnect', async () => {
      mockGraphInterface.disconnect.mockResolvedValue(undefined);

      const result = await callHandler('graph-disconnect');

      expect(mockGraphInterface.disconnect).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  // ===========================================================================
  // USER HANDLER TESTS
  // ===========================================================================

  describe('User Handlers', () => {
    test('graph-upsert-user should create/update user', async () => {
      const user = { id: 1, email: 'test@test.com', name: 'Test' };
      mockGraphInterface.upsertUser.mockResolvedValue(user);

      const result = await callHandler('graph-upsert-user', user);

      expect(mockGraphInterface.upsertUser).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    test('graph-upsert-user should return null on error', async () => {
      mockGraphInterface.upsertUser.mockRejectedValue(new Error('Error'));

      const result = await callHandler('graph-upsert-user', {});

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // BOOK HANDLER TESTS
  // ===========================================================================

  describe('Book Handlers', () => {
    test('graph-create-book should create a book', async () => {
      const book = { id: 'book-001', name: 'Test Book' };
      mockGraphInterface.createBook.mockResolvedValue(book);

      const result = await callHandler('graph-create-book', book, 'token');

      expect(mockGraphInterface.createBook).toHaveBeenCalledWith(book, 'token');
      expect(result).toEqual(book);
    });

    test('graph-get-books should return user books', async () => {
      const books = [{ id: 'book-001' }, { id: 'book-002' }];
      mockGraphInterface.getBooksByUser.mockResolvedValue(books);

      const result = await callHandler('graph-get-books', 'token');

      expect(mockGraphInterface.getBooksByUser).toHaveBeenCalledWith('token');
      expect(result).toEqual(books);
    });
  });

  // ===========================================================================
  // NOTE HANDLER TESTS
  // ===========================================================================

  describe('Note Handlers', () => {
    test('graph-create-note should create a note', async () => {
      const note = { id: 'note-001', title: 'Test Note' };
      mockGraphInterface.createNote.mockResolvedValue(note);

      const result = await callHandler('graph-create-note', note, 'token');

      expect(mockGraphInterface.createNote).toHaveBeenCalledWith(note, 'token');
      expect(result).toEqual(note);
    });

    test('graph-get-note should return note by ID', async () => {
      const note = { id: 'note-001', title: 'Test Note' };
      mockGraphInterface.getNoteById.mockResolvedValue(note);

      const result = await callHandler('graph-get-note', 'note-001', 'token');

      expect(mockGraphInterface.getNoteById).toHaveBeenCalledWith('note-001', 'token');
      expect(result).toEqual(note);
    });

    test('graph-get-notes-by-source should return notes for source', async () => {
      const notes = [{ id: 'note-001' }, { id: 'note-002' }];
      mockGraphInterface.getNotesBySource.mockResolvedValue(notes);

      const result = await callHandler('graph-get-notes-by-source', 'book-001', 'book', 'token');

      expect(mockGraphInterface.getNotesBySource).toHaveBeenCalledWith('book-001', 'book', 'token');
      expect(result).toEqual(notes);
    });

    test('graph-update-note should update note field', async () => {
      mockGraphInterface.updateNote.mockResolvedValue(1);

      const result = await callHandler('graph-update-note', 'note-001', 'title', 'New Title', 'token');

      expect(mockGraphInterface.updateNote).toHaveBeenCalledWith('note-001', 'title', 'New Title', 'token');
      expect(result).toBe(1);
    });

    test('graph-delete-note should delete note', async () => {
      mockGraphInterface.deleteNote.mockResolvedValue(1);

      const result = await callHandler('graph-delete-note', 'note-001', 'token');

      expect(mockGraphInterface.deleteNote).toHaveBeenCalledWith('note-001', 'token');
      expect(result).toBe(1);
    });

    test('graph-search-notes should search notes', async () => {
      const notes = [{ id: 'note-001', title: 'Machine Learning' }];
      mockGraphInterface.searchNotes.mockResolvedValue(notes);

      const result = await callHandler('graph-search-notes', 'machine', 'token');

      expect(mockGraphInterface.searchNotes).toHaveBeenCalledWith('machine', 'token');
      expect(result).toEqual(notes);
    });
  });

  // ===========================================================================
  // VOCABULARY HANDLER TESTS
  // ===========================================================================

  describe('Vocabulary Handlers', () => {
    test('graph-create-vocabulary should create vocabulary', async () => {
      const vocab = { id: 'vocab-001', word: 'serendipity' };
      mockGraphInterface.createVocabulary.mockResolvedValue(vocab);

      const result = await callHandler('graph-create-vocabulary', vocab, 'token');

      expect(mockGraphInterface.createVocabulary).toHaveBeenCalledWith(vocab, 'token');
      expect(result).toEqual(vocab);
    });

    test('graph-get-vocabulary-by-word should return vocabulary', async () => {
      const vocab = { id: 'vocab-001', word: 'serendipity' };
      mockGraphInterface.getVocabularyByWord.mockResolvedValue(vocab);

      const result = await callHandler('graph-get-vocabulary-by-word', 'serendipity', 'token');

      expect(mockGraphInterface.getVocabularyByWord).toHaveBeenCalledWith('serendipity', 'token');
      expect(result).toEqual(vocab);
    });
  });

  // ===========================================================================
  // SPACED REPETITION HANDLER TESTS
  // ===========================================================================

  describe('Spaced Repetition Handlers', () => {
    test('graph-get-due-for-review should return due items', async () => {
      const items = [{ id: 'note-001', leitnerBox: 2 }];
      mockGraphInterface.getDueForReview.mockResolvedValue(items);

      const result = await callHandler(
        'graph-get-due-for-review',
        '2024-01-15T00:00:00Z',
        ['note', 'vocabulary'],
        50,
        'token'
      );

      expect(mockGraphInterface.getDueForReview).toHaveBeenCalledWith(
        expect.any(Date),
        ['note', 'vocabulary'],
        50,
        'token'
      );
      expect(result).toEqual(items);
    });

    test('graph-record-review should record review outcome', async () => {
      const item = { id: 'note-001', leitnerBox: 3 };
      mockGraphInterface.recordReview.mockResolvedValue(item);

      const result = await callHandler(
        'graph-record-review',
        'note-001',
        'note',
        'correct',
        2,
        'token'
      );

      expect(mockGraphInterface.recordReview).toHaveBeenCalledWith(
        'note-001',
        'note',
        'correct',
        2,
        'token'
      );
      expect(result).toEqual(item);
    });

    test('graph-add-note-to-leitner should add note to study', async () => {
      const note = { id: 'note-001', leitnerBox: 1 };
      mockGraphInterface.addNoteToLeitnerStudy.mockResolvedValue(note);

      const result = await callHandler('graph-add-note-to-leitner', 'note-001', 'token');

      expect(mockGraphInterface.addNoteToLeitnerStudy).toHaveBeenCalledWith('note-001', 'token');
      expect(result).toEqual(note);
    });
  });

  // ===========================================================================
  // CONCEPT HANDLER TESTS
  // ===========================================================================

  describe('Concept Handlers', () => {
    test('graph-upsert-concept should create/update concept', async () => {
      const concept = { id: 'concept-001', name: 'Machine Learning' };
      mockGraphInterface.upsertConcept.mockResolvedValue(concept);

      const result = await callHandler('graph-upsert-concept', concept, 'token');

      expect(mockGraphInterface.upsertConcept).toHaveBeenCalledWith(concept, 'token');
      expect(result).toEqual(concept);
    });

    test('graph-create-mentions should create relationship', async () => {
      mockGraphInterface.createMentionsRelationship.mockResolvedValue(undefined);

      const result = await callHandler('graph-create-mentions', 'note-001', 'concept-001', 3, 0.8);

      expect(mockGraphInterface.createMentionsRelationship).toHaveBeenCalledWith(
        'note-001',
        'concept-001',
        3,
        0.8
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ===========================================================================
  // LEARNING SESSION HANDLER TESTS
  // ===========================================================================

  describe('Learning Session Handlers', () => {
    test('graph-start-session should start a session', async () => {
      const session = { id: 'session-001', activityType: 'reading' };
      mockGraphInterface.startLearningSession.mockResolvedValue(session);

      const result = await callHandler(
        'graph-start-session',
        'reading',
        'book',
        'book-001',
        'token'
      );

      expect(mockGraphInterface.startLearningSession).toHaveBeenCalledWith(
        'reading',
        'book',
        'book-001',
        'token'
      );
      expect(result).toEqual(session);
    });

    test('graph-end-session should end a session', async () => {
      const session = { id: 'session-001', duration: 1800 };
      const stats = { focusScore: 0.85, notesCreated: 5 };
      mockGraphInterface.endLearningSession.mockResolvedValue(session);

      const result = await callHandler('graph-end-session', 'session-001', stats, 'token');

      expect(mockGraphInterface.endLearningSession).toHaveBeenCalledWith(
        'session-001',
        stats,
        'token'
      );
      expect(result).toEqual(session);
    });
  });

  // ===========================================================================
  // SEMANTIC SEARCH HANDLER TESTS
  // ===========================================================================

  describe('Semantic Search Handlers', () => {
    test('graph-store-embedding should store embedding', async () => {
      mockGraphInterface.storeEmbedding.mockResolvedValue(undefined);

      const result = await callHandler(
        'graph-store-embedding',
        'note-001',
        'Note',
        [0.1, 0.2, 0.3],
        'text-embedding-3-small'
      );

      expect(mockGraphInterface.storeEmbedding).toHaveBeenCalledWith(
        'note-001',
        'Note',
        [0.1, 0.2, 0.3],
        'text-embedding-3-small'
      );
      expect(result).toEqual({ success: true });
    });

    test('graph-find-similar should find similar nodes', async () => {
      const similar = [{ node: { id: 'note-001' }, similarity: 0.95 }];
      mockGraphInterface.findSimilar.mockResolvedValue(similar);

      const result = await callHandler(
        'graph-find-similar',
        [0.1, 0.2, 0.3],
        ['Note'],
        10,
        0.7,
        'token'
      );

      expect(mockGraphInterface.findSimilar).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3],
        ['Note'],
        10,
        0.7,
        'token'
      );
      expect(result).toEqual(similar);
    });
  });

  // ===========================================================================
  // LEARNING PATH HANDLER TESTS
  // ===========================================================================

  describe('Learning Path Handlers', () => {
    test('graph-get-learning-path should return learning path', async () => {
      const path = { prerequisites: [], readyToLearn: true };
      mockGraphInterface.getLearningPath.mockResolvedValue(path);

      const result = await callHandler('graph-get-learning-path', 'concept-001', 5, 'token');

      expect(mockGraphInterface.getLearningPath).toHaveBeenCalledWith('concept-001', 5, 'token');
      expect(result).toEqual(path);
    });

    test('graph-get-knowledge-at-time should return historical knowledge', async () => {
      const knowledge = [{ item: { id: 'note-001' }, reviewCount: 5 }];
      mockGraphInterface.getKnowledgeAtTime.mockResolvedValue(knowledge);

      const result = await callHandler(
        'graph-get-knowledge-at-time',
        '2024-01-15T00:00:00Z',
        'token'
      );

      expect(mockGraphInterface.getKnowledgeAtTime).toHaveBeenCalledWith(expect.any(Date), 'token');
      expect(result).toEqual(knowledge);
    });
  });

  // ===========================================================================
  // CHAT HANDLER TESTS
  // ===========================================================================

  describe('Chat Handlers', () => {
    test('graph-create-chat should create a chat', async () => {
      const chat = { id: 'chat-001', description: 'Test Chat' };
      mockGraphInterface.createChat.mockResolvedValue(chat);

      const result = await callHandler('graph-create-chat', chat, 'token');

      expect(mockGraphInterface.createChat).toHaveBeenCalledWith(chat, 'token');
      expect(result).toEqual(chat);
    });

    test('graph-add-message should add message to chat', async () => {
      const message = { id: 'msg-001', role: 'user', content: 'Hello' };
      mockGraphInterface.addMessage.mockResolvedValue(message);

      const result = await callHandler('graph-add-message', message, 'chat-001', 'token');

      expect(mockGraphInterface.addMessage).toHaveBeenCalledWith(message, 'chat-001', 'token');
      expect(result).toEqual(message);
    });
  });

  // ===========================================================================
  // MESSAGE SEARCH HANDLER TESTS
  // ===========================================================================

  describe('Message Search Handlers', () => {
    test('graph-search-messages should search messages', async () => {
      const messages = [{ id: 'msg-001', content: 'test message' }];
      mockGraphInterface.searchMessages.mockResolvedValue(messages);

      const result = await callHandler('graph-search-messages', 'test', 'token');

      expect(mockGraphInterface.searchMessages).toHaveBeenCalledWith('test', 'token');
      expect(result).toEqual(messages);
    });
  });

  // ===========================================================================
  // BOOKMARK HANDLER TESTS
  // ===========================================================================

  describe('Bookmark Handlers', () => {
    test('graph-create-bookmark should create a bookmark', async () => {
      const bookmark = { id: 'bookmark-001', title: 'Test', url: 'https://test.com' };
      mockGraphInterface.createBookmark.mockResolvedValue(bookmark);

      const result = await callHandler('graph-create-bookmark', bookmark, 'token');

      expect(mockGraphInterface.createBookmark).toHaveBeenCalledWith(bookmark, 'token');
      expect(result).toEqual(bookmark);
    });

    test('graph-get-bookmarks-by-source should return bookmarks', async () => {
      const bookmarks = [{ id: 'bookmark-001', url: 'https://test.com' }];
      mockGraphInterface.getBookmarksBySource.mockResolvedValue(bookmarks);

      const result = await callHandler('graph-get-bookmarks-by-source', 'https://test.com', 'token');

      expect(mockGraphInterface.getBookmarksBySource).toHaveBeenCalledWith('https://test.com', 'token');
      expect(result).toEqual(bookmarks);
    });

    test('graph-search-bookmarks should search bookmarks', async () => {
      const bookmarks = [{ id: 'bookmark-001', title: 'Test' }];
      mockGraphInterface.searchBookmarks.mockResolvedValue(bookmarks);

      const result = await callHandler('graph-search-bookmarks', 'test', 'token');

      expect(mockGraphInterface.searchBookmarks).toHaveBeenCalledWith('test', 'token');
      expect(result).toEqual(bookmarks);
    });
  });

  // ===========================================================================
  // STATS HANDLER TESTS
  // ===========================================================================

  describe('Stats Handlers', () => {
    test('graph-get-stats should return stats', async () => {
      const stats = { Note: 100, Book: 25, Vocabulary: 500 };
      mockGraphInterface.getStats.mockResolvedValue(stats);

      const result = await callHandler('graph-get-stats');

      expect(mockGraphInterface.getStats).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });
  });
});
