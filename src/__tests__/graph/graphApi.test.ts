/**
 * graphApi.test.ts
 *
 * Unit tests for the renderer-side Graph API.
 * Tests ensure proper IPC communication and token handling.
 */

// Mock customStorage
const mockGetSessionToken = jest.fn();
jest.mock('../../renderer/store/customStorage', () => ({
  __esModule: true,
  default: {
    getSessionToken: mockGetSessionToken,
  },
}));

// Mock window.electron.ipcRenderer
const mockSendSync = jest.fn();
const mockInvoke = jest.fn();

// Set up window mock before any imports
Object.defineProperty(global, 'window', {
  value: {
    electron: {
      ipcRenderer: {
        sendSync: mockSendSync,
        invoke: mockInvoke,
      },
    },
  },
  writable: true,
});

// Import after mocking
import graphApi from '../../renderer/api/graphApi';

describe('GraphApi', () => {
  const defaultToken = 'default-session-token';

  beforeEach(() => {
    // Clear mock call history but preserve implementations
    mockSendSync.mockClear();
    mockInvoke.mockClear();
    mockGetSessionToken.mockClear();
    mockGetSessionToken.mockReturnValue(defaultToken);
  });

  // ===========================================================================
  // CONNECTION MANAGEMENT TESTS
  // ===========================================================================

  describe('Connection Management', () => {
    test('connect() should send graph-connect IPC message', async () => {
      const expectedResult = { success: true };
      mockSendSync.mockReturnValue(expectedResult);

      const result = await graphApi.connect();

      expect(mockSendSync).toHaveBeenCalledWith('graph-connect');
      expect(result).toEqual(expectedResult);
    });

    test('isConnected() should return connection status', () => {
      mockSendSync.mockReturnValue(true);

      const result = graphApi.isConnected();

      expect(mockSendSync).toHaveBeenCalledWith('graph-check-connection');
      expect(result).toBe(true);
    });

    test('isConnected() should return false when disconnected', () => {
      mockSendSync.mockReturnValue(false);

      const result = graphApi.isConnected();

      expect(result).toBe(false);
    });

    test('disconnect() should send graph-disconnect IPC message', async () => {
      const expectedResult = { success: true };
      mockSendSync.mockReturnValue(expectedResult);

      const result = await graphApi.disconnect();

      expect(mockSendSync).toHaveBeenCalledWith('graph-disconnect');
      expect(result).toEqual(expectedResult);
    });
  });

  // ===========================================================================
  // USER OPERATIONS TESTS
  // ===========================================================================

  describe('User Operations', () => {
    test('upsertUser() should create/update user', async () => {
      const user = { id: 1, email: 'test@test.com', name: 'Test User' };
      mockSendSync.mockReturnValue(user);

      const result = await graphApi.upsertUser(user);

      expect(mockSendSync).toHaveBeenCalledWith('graph-upsert-user', user);
      expect(result).toEqual(user);
    });
  });

  // ===========================================================================
  // BOOK OPERATIONS TESTS
  // ===========================================================================

  describe('Book Operations', () => {
    test('createBook() should use provided token', async () => {
      const book = { id: 'book-001', name: 'Test Book' };
      const customToken = 'custom-token';
      mockSendSync.mockReturnValue(book);

      const result = await graphApi.createBook(book, customToken);

      expect(mockSendSync).toHaveBeenCalledWith('graph-create-book', book, customToken);
      expect(result).toEqual(book);
    });

    test('createBook() should use session token when none provided', async () => {
      const book = { id: 'book-001', name: 'Test Book' };
      mockSendSync.mockReturnValue(book);

      const result = await graphApi.createBook(book);

      expect(mockGetSessionToken).toHaveBeenCalled();
      expect(mockSendSync).toHaveBeenCalledWith('graph-create-book', book, defaultToken);
      expect(result).toEqual(book);
    });

    test('getBooks() should return user books', async () => {
      const books = [{ id: 'book-001' }, { id: 'book-002' }];
      mockSendSync.mockReturnValue(books);

      const result = await graphApi.getBooks();

      expect(mockSendSync).toHaveBeenCalledWith('graph-get-books', defaultToken);
      expect(result).toEqual(books);
    });

    test('getBooks() should use provided token', async () => {
      const books = [{ id: 'book-001' }];
      const customToken = 'custom-token';
      mockSendSync.mockReturnValue(books);

      const result = await graphApi.getBooks(customToken);

      expect(mockSendSync).toHaveBeenCalledWith('graph-get-books', customToken);
      expect(result).toEqual(books);
    });
  });

  // ===========================================================================
  // NOTE OPERATIONS TESTS
  // ===========================================================================

  describe('Note Operations', () => {
    test('createNote() should create a note with session token', async () => {
      const note = { id: 'note-001', title: 'Test Note', content: 'Content' };
      mockSendSync.mockReturnValue(note);

      const result = await graphApi.createNote(note);

      expect(mockSendSync).toHaveBeenCalledWith('graph-create-note', note, defaultToken);
      expect(result).toEqual(note);
    });

    test('createNote() should use provided token', async () => {
      const note = { id: 'note-001', title: 'Test Note' };
      const customToken = 'custom-token';
      mockSendSync.mockReturnValue(note);

      const result = await graphApi.createNote(note, customToken);

      expect(mockSendSync).toHaveBeenCalledWith('graph-create-note', note, customToken);
    });

    test('getNoteById() should return note', async () => {
      const note = { id: 'note-001', title: 'Test Note' };
      mockSendSync.mockReturnValue(note);

      const result = await graphApi.getNoteById('note-001');

      expect(mockSendSync).toHaveBeenCalledWith('graph-get-note', 'note-001', defaultToken);
      expect(result).toEqual(note);
    });

    test('getNoteById() should handle numeric ID', async () => {
      const note = { id: 123, title: 'Test Note' };
      mockSendSync.mockReturnValue(note);

      const result = await graphApi.getNoteById(123);

      expect(mockSendSync).toHaveBeenCalledWith('graph-get-note', 123, defaultToken);
      expect(result).toEqual(note);
    });

    test('getNotesBySource() should return notes for book', async () => {
      const notes = [{ id: 'note-001' }, { id: 'note-002' }];
      mockSendSync.mockReturnValue(notes);

      const result = await graphApi.getNotesBySource('book-001', 'book');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-get-notes-by-source',
        'book-001',
        'book',
        defaultToken
      );
      expect(result).toEqual(notes);
    });

    test('getNotesBySource() should work for URL source', async () => {
      const notes = [{ id: 'note-001' }];
      mockSendSync.mockReturnValue(notes);

      const result = await graphApi.getNotesBySource('https://example.com', 'url');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-get-notes-by-source',
        'https://example.com',
        'url',
        defaultToken
      );
      expect(result).toEqual(notes);
    });

    test('updateNote() should update note field', async () => {
      mockSendSync.mockReturnValue(1);

      const result = await graphApi.updateNote('note-001', 'title', 'New Title');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-update-note',
        'note-001',
        'title',
        'New Title',
        defaultToken
      );
      expect(result).toBe(1);
    });

    test('updateNote() should handle different value types', async () => {
      mockSendSync.mockReturnValue(1);

      // String value
      await graphApi.updateNote('note-001', 'title', 'New Title');
      expect(mockSendSync).toHaveBeenLastCalledWith(
        'graph-update-note',
        'note-001',
        'title',
        'New Title',
        defaultToken
      );

      // Boolean value
      await graphApi.updateNote('note-001', 'inLeitner', true);
      expect(mockSendSync).toHaveBeenLastCalledWith(
        'graph-update-note',
        'note-001',
        'inLeitner',
        true,
        defaultToken
      );

      // Number value
      await graphApi.updateNote('note-001', 'leitnerBox', 3);
      expect(mockSendSync).toHaveBeenLastCalledWith(
        'graph-update-note',
        'note-001',
        'leitnerBox',
        3,
        defaultToken
      );
    });

    test('deleteNote() should delete note and return status', async () => {
      mockSendSync.mockReturnValue(1);

      const result = await graphApi.deleteNote('note-001');

      expect(mockSendSync).toHaveBeenCalledWith('graph-delete-note', 'note-001', defaultToken);
      expect(result).toBe(1);
    });

    test('deleteNote() should return -1 on failure', async () => {
      mockSendSync.mockReturnValue(-1);

      const result = await graphApi.deleteNote('nonexistent');

      expect(result).toBe(-1);
    });

    test('searchNotes() should search notes by query', async () => {
      const notes = [
        { id: 'note-001', title: 'Machine Learning Basics' },
        { id: 'note-002', title: 'Deep Learning' },
      ];
      mockSendSync.mockReturnValue(notes);

      const result = await graphApi.searchNotes('learning');

      expect(mockSendSync).toHaveBeenCalledWith('graph-search-notes', 'learning', defaultToken);
      expect(result).toEqual(notes);
    });
  });

  // ===========================================================================
  // VOCABULARY OPERATIONS TESTS
  // ===========================================================================

  describe('Vocabulary Operations', () => {
    test('createVocabulary() should create vocabulary', async () => {
      const vocab = {
        id: 'vocab-001',
        word: 'serendipity',
        definition: 'Happy accident',
      };
      mockSendSync.mockReturnValue(vocab);

      const result = await graphApi.createVocabulary(vocab);

      expect(mockSendSync).toHaveBeenCalledWith('graph-create-vocabulary', vocab, defaultToken);
      expect(result).toEqual(vocab);
    });

    test('getVocabularyByWord() should return vocabulary', async () => {
      const vocab = { id: 'vocab-001', word: 'serendipity' };
      mockSendSync.mockReturnValue(vocab);

      const result = await graphApi.getVocabularyByWord('serendipity');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-get-vocabulary-by-word',
        'serendipity',
        defaultToken
      );
      expect(result).toEqual(vocab);
    });

    test('getVocabularyByWord() should return null for unknown word', async () => {
      mockSendSync.mockReturnValue(null);

      const result = await graphApi.getVocabularyByWord('unknownword');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // SPACED REPETITION (LEITNER) TESTS
  // ===========================================================================

  describe('Spaced Repetition (Leitner System)', () => {
    test('getDueForReview() should return due items with defaults', async () => {
      const dueItems = [
        { id: 'note-001', leitnerBox: 2 },
        { id: 'vocab-001', leitnerBox: 1 },
      ];
      mockSendSync.mockReturnValue(dueItems);

      const result = await graphApi.getDueForReview();

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-get-due-for-review',
        expect.any(String), // ISO date string
        ['note', 'vocabulary'],
        50,
        defaultToken
      );
      expect(result).toEqual(dueItems);
    });

    test('getDueForReview() should use custom parameters', async () => {
      const dueItems = [{ id: 'note-001', leitnerBox: 1 }];
      const customDate = new Date('2024-06-15T10:00:00Z');
      mockSendSync.mockReturnValue(dueItems);

      const result = await graphApi.getDueForReview(['note'], 25, customDate, 'custom-token');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-get-due-for-review',
        customDate.toISOString(),
        ['note'],
        25,
        'custom-token'
      );
      expect(result).toEqual(dueItems);
    });

    test('recordReview() should record correct answer', async () => {
      const updatedItem = { id: 'note-001', leitnerBox: 3 };
      mockSendSync.mockReturnValue(updatedItem);

      const result = await graphApi.recordReview('note-001', 'note', 'correct');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-record-review',
        'note-001',
        'note',
        'correct',
        2, // default leitnerSpeed
        defaultToken
      );
      expect(result).toEqual(updatedItem);
    });

    test('recordReview() should record incorrect answer', async () => {
      const updatedItem = { id: 'note-001', leitnerBox: 1 };
      mockSendSync.mockReturnValue(updatedItem);

      const result = await graphApi.recordReview('note-001', 'note', 'incorrect', 4);

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-record-review',
        'note-001',
        'note',
        'incorrect',
        4,
        defaultToken
      );
      expect(result).toEqual(updatedItem);
    });

    test('recordReview() should handle vocabulary item', async () => {
      const updatedItem = { id: 'vocab-001', leitnerBox: 2 };
      mockSendSync.mockReturnValue(updatedItem);

      const result = await graphApi.recordReview('vocab-001', 'vocabulary', 'correct', 1);

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-record-review',
        'vocab-001',
        'vocabulary',
        'correct',
        1,
        defaultToken
      );
    });

    test('addNoteToLeitnerStudy() should add note to study', async () => {
      const updatedNote = { id: 'note-001', inLeitner: true, leitnerBox: 1 };
      mockSendSync.mockReturnValue(updatedNote);

      const result = await graphApi.addNoteToLeitnerStudy('note-001');

      expect(mockSendSync).toHaveBeenCalledWith('graph-add-note-to-leitner', 'note-001', defaultToken);
      expect(result).toEqual(updatedNote);
    });
  });

  // ===========================================================================
  // CONCEPT OPERATIONS TESTS
  // ===========================================================================

  describe('Concept Operations', () => {
    test('upsertConcept() should create concept', async () => {
      const concept = { id: 'concept-001', name: 'Machine Learning' };
      mockSendSync.mockReturnValue(concept);

      const result = await graphApi.upsertConcept(concept);

      expect(mockSendSync).toHaveBeenCalledWith('graph-upsert-concept', concept, defaultToken);
      expect(result).toEqual(concept);
    });

    test('upsertConcept() should update existing concept', async () => {
      const concept = {
        id: 'concept-001',
        name: 'Machine Learning',
        description: 'Updated description',
      };
      mockSendSync.mockReturnValue(concept);

      const result = await graphApi.upsertConcept(concept);

      expect(result).toEqual(concept);
    });

    test('createMentionsRelationship() should create relationship with defaults', async () => {
      mockSendSync.mockReturnValue({ success: true });

      const result = await graphApi.createMentionsRelationship('note-001', 'concept-001');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-create-mentions',
        'note-001',
        'concept-001',
        1, // default frequency
        0.5 // default importance
      );
      expect(result).toEqual({ success: true });
    });

    test('createMentionsRelationship() should use custom values', async () => {
      mockSendSync.mockReturnValue({ success: true });

      const result = await graphApi.createMentionsRelationship('note-001', 'concept-001', 5, 0.9);

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-create-mentions',
        'note-001',
        'concept-001',
        5,
        0.9
      );
    });
  });

  // ===========================================================================
  // LEARNING SESSION TESTS
  // ===========================================================================

  describe('Learning Session Operations', () => {
    test('startLearningSession() should start reading session', async () => {
      const session = { id: 'session-001', activityType: 'reading', startTime: new Date() };
      mockSendSync.mockReturnValue(session);

      const result = await graphApi.startLearningSession('reading', 'book', 'book-001');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-start-session',
        'reading',
        'book',
        'book-001',
        defaultToken
      );
      expect(result).toEqual(session);
    });

    test('startLearningSession() should start session without resource', async () => {
      const session = { id: 'session-001', activityType: 'reviewing' };
      mockSendSync.mockReturnValue(session);

      const result = await graphApi.startLearningSession('reviewing');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-start-session',
        'reviewing',
        null,
        null,
        defaultToken
      );
    });

    test('startLearningSession() should support different activity types', async () => {
      const activities = ['reading', 'reviewing', 'quizzing', 'browsing', 'chatting'];

      for (const activity of activities) {
        mockSendSync.mockReturnValue({ id: `session-${activity}`, activityType: activity });

        await graphApi.startLearningSession(activity);

        expect(mockSendSync).toHaveBeenLastCalledWith(
          'graph-start-session',
          activity,
          null,
          null,
          defaultToken
        );
      }
    });

    test('endLearningSession() should end session with stats', async () => {
      const stats = {
        focusScore: 0.85,
        notesCreated: 5,
        conceptsReviewed: 10,
        wordsLearned: 3,
      };
      const session = { id: 'session-001', duration: 1800, ...stats };
      mockSendSync.mockReturnValue(session);

      const result = await graphApi.endLearningSession('session-001', stats);

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-end-session',
        'session-001',
        stats,
        defaultToken
      );
      expect(result).toEqual(session);
    });
  });

  // ===========================================================================
  // SEMANTIC SEARCH TESTS
  // ===========================================================================

  describe('Semantic Search', () => {
    test('storeEmbedding() should store embedding for node', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockSendSync.mockReturnValue({ success: true });

      const result = await graphApi.storeEmbedding(
        'note-001',
        'Note',
        embedding,
        'text-embedding-3-small'
      );

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-store-embedding',
        'note-001',
        'Note',
        embedding,
        'text-embedding-3-small'
      );
      expect(result).toEqual({ success: true });
    });

    test('storeEmbedding() should work with different node types', async () => {
      const embedding = [0.1, 0.2];
      mockSendSync.mockReturnValue({ success: true });

      const nodeTypes = ['Note', 'Book', 'Concept', 'Vocabulary'];

      for (const nodeType of nodeTypes) {
        await graphApi.storeEmbedding(`id-001`, nodeType, embedding, 'model');

        expect(mockSendSync).toHaveBeenLastCalledWith(
          'graph-store-embedding',
          'id-001',
          nodeType,
          embedding,
          'model'
        );
      }
    });

    test('findSimilar() should find similar nodes with defaults', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3];
      const similar = [
        { node: { id: 'note-001' }, similarity: 0.95 },
        { node: { id: 'note-002' }, similarity: 0.87 },
      ];
      mockSendSync.mockReturnValue(similar);

      const result = await graphApi.findSimilar(queryEmbedding, ['Note']);

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-find-similar',
        queryEmbedding,
        ['Note'],
        10, // default limit
        0.7, // default minSimilarity
        defaultToken
      );
      expect(result).toEqual(similar);
    });

    test('findSimilar() should use custom parameters', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3];
      mockSendSync.mockReturnValue([]);

      await graphApi.findSimilar(queryEmbedding, ['Note', 'Concept'], 5, 0.9, 'custom-token');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-find-similar',
        queryEmbedding,
        ['Note', 'Concept'],
        5,
        0.9,
        'custom-token'
      );
    });
  });

  // ===========================================================================
  // LEARNING PATH TESTS
  // ===========================================================================

  describe('Learning Path', () => {
    test('getLearningPath() should return path to concept', async () => {
      const path = {
        target: { id: 'concept-001', name: 'Neural Networks' },
        prerequisites: [
          { id: 'concept-002', name: 'Linear Algebra' },
          { id: 'concept-003', name: 'Calculus' },
        ],
        readyToLearn: false,
      };
      mockSendSync.mockReturnValue(path);

      const result = await graphApi.getLearningPath('concept-001');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-get-learning-path',
        'concept-001',
        5, // default maxDepth
        defaultToken
      );
      expect(result).toEqual(path);
    });

    test('getLearningPath() should use custom depth', async () => {
      mockSendSync.mockReturnValue({ prerequisites: [], readyToLearn: true });

      await graphApi.getLearningPath('concept-001', 10, 'custom-token');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-get-learning-path',
        'concept-001',
        10,
        'custom-token'
      );
    });

    test('getKnowledgeAtTime() should return historical knowledge state', async () => {
      const asOfDate = new Date('2024-01-15T00:00:00Z');
      const knowledge = [
        { item: { id: 'note-001', title: 'ML Basics' }, reviewCount: 5, leitnerBox: 3 },
        { item: { id: 'vocab-001', word: 'gradient' }, reviewCount: 10, leitnerBox: 4 },
      ];
      mockSendSync.mockReturnValue(knowledge);

      const result = await graphApi.getKnowledgeAtTime(asOfDate);

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-get-knowledge-at-time',
        asOfDate.toISOString(),
        defaultToken
      );
      expect(result).toEqual(knowledge);
    });
  });

  // ===========================================================================
  // CHAT OPERATIONS TESTS
  // ===========================================================================

  describe('Chat Operations', () => {
    test('createChat() should create a chat', async () => {
      const chat = { id: 'chat-001', description: 'Learning about ML' };
      mockSendSync.mockReturnValue(chat);

      const result = await graphApi.createChat(chat);

      expect(mockSendSync).toHaveBeenCalledWith('graph-create-chat', chat, defaultToken);
      expect(result).toEqual(chat);
    });

    test('addMessage() should add message to chat', async () => {
      const message = { id: 'msg-001', role: 'user', content: 'What is backpropagation?' };
      mockSendSync.mockReturnValue(message);

      const result = await graphApi.addMessage(message, 'chat-001');

      expect(mockSendSync).toHaveBeenCalledWith('graph-add-message', message, 'chat-001', defaultToken);
      expect(result).toEqual(message);
    });

    test('addMessage() should handle assistant messages', async () => {
      const message = {
        id: 'msg-002',
        role: 'assistant',
        content: 'Backpropagation is...',
      };
      mockSendSync.mockReturnValue(message);

      const result = await graphApi.addMessage(message, 'chat-001');

      expect(result).toEqual(message);
    });

    test('searchMessages() should send correct IPC message', async () => {
      const messages = [{ id: 'msg-001', content: 'test' }];
      mockSendSync.mockReturnValue(messages);

      const result = await graphApi.searchMessages('test');

      expect(mockSendSync).toHaveBeenCalledWith('graph-search-messages', 'test', defaultToken);
      expect(result).toEqual(messages);
    });
  });

  // ===========================================================================
  // BOOKMARK OPERATIONS TESTS
  // ===========================================================================

  describe('Bookmark Operations', () => {
    test('createBookmark() should send correct IPC message', async () => {
      const bookmark = { id: 'bookmark-001', title: 'Test', url: 'https://test.com' };
      mockSendSync.mockReturnValue(bookmark);

      const result = await graphApi.createBookmark(bookmark);

      expect(mockSendSync).toHaveBeenCalledWith('graph-create-bookmark', bookmark, defaultToken);
      expect(result).toEqual(bookmark);
    });

    test('getBookmarksBySource() should send correct IPC message', async () => {
      const bookmarks = [{ id: 'bookmark-001', url: 'https://test.com' }];
      mockSendSync.mockReturnValue(bookmarks);

      const result = await graphApi.getBookmarksBySource('https://test.com');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-get-bookmarks-by-source',
        'https://test.com',
        defaultToken
      );
      expect(result).toEqual(bookmarks);
    });

    test('searchBookmarks() should send correct IPC message', async () => {
      const bookmarks = [{ id: 'bookmark-001', title: 'Test' }];
      mockSendSync.mockReturnValue(bookmarks);

      const result = await graphApi.searchBookmarks('test');

      expect(mockSendSync).toHaveBeenCalledWith('graph-search-bookmarks', 'test', defaultToken);
      expect(result).toEqual(bookmarks);
    });
  });

  // ===========================================================================
  // STATS OPERATIONS TESTS
  // ===========================================================================

  describe('Stats Operations', () => {
    test('getStats() should return stats synchronously', () => {
      const stats = { Note: 100, Book: 25, Vocabulary: 500, Concept: 50 };
      mockSendSync.mockReturnValue(stats);

      const result = graphApi.getStats();

      expect(mockSendSync).toHaveBeenCalledWith('graph-get-stats');
      expect(result).toEqual(stats);
    });
  });

  // ===========================================================================
  // TOKEN HANDLING EDGE CASES
  // ===========================================================================

  describe('Token Handling Edge Cases', () => {
    test('should use null token when session token is null', async () => {
      mockGetSessionToken.mockReturnValue(null);
      mockSendSync.mockReturnValue({ id: 'note-001' });

      await graphApi.createNote({ title: 'Test' });

      expect(mockSendSync).toHaveBeenCalledWith('graph-create-note', { title: 'Test' }, null);
    });

    test('should use empty string token when session token is empty', async () => {
      mockGetSessionToken.mockReturnValue('');
      mockSendSync.mockReturnValue({ id: 'note-001' });

      await graphApi.createNote({ title: 'Test' });

      expect(mockSendSync).toHaveBeenCalledWith('graph-create-note', { title: 'Test' }, '');
    });

    test('should prefer provided token over session token', async () => {
      mockGetSessionToken.mockReturnValue('session-token');
      mockSendSync.mockReturnValue({ id: 'note-001' });

      await graphApi.createNote({ title: 'Test' }, 'provided-token');

      expect(mockSendSync).toHaveBeenCalledWith(
        'graph-create-note',
        { title: 'Test' },
        'provided-token'
      );
      expect(mockGetSessionToken).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SINGLETON BEHAVIOR TESTS
  // ===========================================================================

  describe('Singleton Behavior', () => {
    test('graphApi should be a singleton instance', () => {
      // The default export is already an instance
      expect(graphApi).toBeDefined();
      expect(typeof graphApi.connect).toBe('function');
      expect(typeof graphApi.createNote).toBe('function');
    });

    test('all methods should be accessible on the singleton', () => {
      const expectedMethods = [
        'connect',
        'isConnected',
        'disconnect',
        'upsertUser',
        'createBook',
        'getBooks',
        'createNote',
        'getNoteById',
        'getNotesBySource',
        'updateNote',
        'deleteNote',
        'searchNotes',
        'createVocabulary',
        'getVocabularyByWord',
        'getDueForReview',
        'recordReview',
        'addNoteToLeitnerStudy',
        'upsertConcept',
        'createMentionsRelationship',
        'startLearningSession',
        'endLearningSession',
        'storeEmbedding',
        'findSimilar',
        'getLearningPath',
        'getKnowledgeAtTime',
        'createChat',
        'addMessage',
        'searchMessages',
        'createBookmark',
        'getBookmarksBySource',
        'searchBookmarks',
        'getStats',
      ];

      for (const method of expectedMethods) {
        expect(typeof (graphApi as any)[method]).toBe('function');
      }
    });
  });
});
