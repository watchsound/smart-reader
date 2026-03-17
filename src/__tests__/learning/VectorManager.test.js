/**
 * VectorManager.test.js
 *
 * Comprehensive tests for VectorManager - the unified vector storage interface.
 * Tests book chunk operations, key concept management, note/message embedding,
 * and learning point operations.
 */

// Mock Neo4jAdapter
const mockNeo4jAdapter = {
  checkConnection: jest.fn().mockReturnValue(true),
  createChunkIndexes: jest.fn().mockResolvedValue(undefined),
  batchCreateChunks: jest.fn().mockResolvedValue(5),
  getChunksWithoutEmbeddings: jest.fn().mockResolvedValue([]),
  updateChunkEmbedding: jest.fn().mockResolvedValue(undefined),
  searchSimilarChunks: jest.fn().mockResolvedValue([]),
  deleteChunksByBook: jest.fn().mockResolvedValue(5),
  createKeyConcepts: jest.fn().mockResolvedValue(3),
  getKeyConceptsByBook: jest.fn().mockResolvedValue([]),
  storeConceptEmbeddings: jest.fn().mockResolvedValue(undefined),
  tagChunksWithConcepts: jest.fn().mockResolvedValue(undefined),
  deriveConceptRelationships: jest.fn().mockResolvedValue(undefined),
  storeEmbedding: jest.fn().mockResolvedValue(undefined),
  findSimilar: jest.fn().mockResolvedValue([]),
  createLearningPoints: jest.fn().mockResolvedValue(10),
  getLearningPointsByTopic: jest.fn().mockResolvedValue([]),
  updateLearningPointAfterReview: jest.fn().mockResolvedValue({}),
  getLearningPointsDueForReview: jest.fn().mockResolvedValue([]),
  getMigrationStats: jest.fn().mockResolvedValue({}),
};

jest.mock('../../main/utils/Neo4jAdapter', () => ({
  default: mockNeo4jAdapter,
  __esModule: true,
}));

// Mock getUserIdFromToken
jest.mock('../../main/db/dbManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user2-token') return 2;
    if (token === 'invalid-token') return -1;
    return 1;
  }),
}));

// Mock BookManager
jest.mock('../../main/db/BookManager', () => ({
  getBookById: jest.fn().mockResolvedValue(null),
}));

// Mock CommonLangUtil
jest.mock('../../commons/utils/CommonLangUtil', () => ({
  splitTextIntoChunks: jest.fn((text, maxSize) => {
    if (!text) return [];
    // Simple chunking for tests
    const words = text.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length; i += maxSize) {
      chunks.push(words.slice(i, i + maxSize).join(' '));
    }
    return chunks.length > 0 ? chunks : [text];
  }),
}));

// Import the module once at top level
const vectorManagerModule = require('../../main/utils/VectorManager');
const VectorManager = vectorManagerModule.VectorManager;
const vectorManager = vectorManagerModule.default;

describe('VectorManager', () => {
  const validToken = 'valid-token';

  // Mock store
  let mockStore;

  // Mock embedding function - defined fresh each test
  let mockEmbeddingFunction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset mock adapter return values to defaults
    mockNeo4jAdapter.checkConnection.mockReturnValue(true);
    mockNeo4jAdapter.createChunkIndexes.mockResolvedValue(undefined);
    mockNeo4jAdapter.batchCreateChunks.mockResolvedValue(5);
    mockNeo4jAdapter.getChunksWithoutEmbeddings.mockResolvedValue([]);
    mockNeo4jAdapter.searchSimilarChunks.mockResolvedValue([]);
    mockNeo4jAdapter.createKeyConcepts.mockResolvedValue(3);
    mockNeo4jAdapter.getKeyConceptsByBook.mockResolvedValue([]);
    mockNeo4jAdapter.findSimilar.mockResolvedValue([]);
    mockNeo4jAdapter.createLearningPoints.mockResolvedValue(10);
    mockNeo4jAdapter.getLearningPointsByTopic.mockResolvedValue([]);
    mockNeo4jAdapter.updateLearningPointAfterReview.mockResolvedValue({});
    mockNeo4jAdapter.getLearningPointsDueForReview.mockResolvedValue([]);
    mockNeo4jAdapter.getMigrationStats.mockResolvedValue({});

    // Create fresh mock store
    mockStore = {
      get: jest.fn((key) => {
        if (key === 'vector.enabled') return true;
        return undefined;
      }),
    };

    // Create fresh mock embedding function
    mockEmbeddingFunction = jest.fn(async (text) => {
      // Return a simple embedding based on text length
      return Array(384).fill(0).map((_, i) => text.length / 1000 + i * 0.001);
    });

    // Reset singleton state
    vectorManager.store = null;
    vectorManager.embeddingFunction = null;
    vectorManager.isInitialized = false;

    // Reset mock connection
    mockNeo4jAdapter.checkConnection.mockReturnValue(true);
  });

  // ===========================================================================
  // INITIALIZATION TESTS
  // ===========================================================================

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = new VectorManager();
      const instance2 = new VectorManager();
      expect(instance1).toBe(instance2);
    });
  });

  describe('setup', () => {
    it('should initialize with store and embedding function', async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);

      expect(vectorManager.isInitialized).toBe(true);
      expect(vectorManager.store).toBe(mockStore);
      expect(vectorManager.embeddingFunction).toBe(mockEmbeddingFunction);
    });

    it('should create chunk indexes when Neo4j is connected', async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);

      expect(mockNeo4jAdapter.createChunkIndexes).toHaveBeenCalled();
    });

    it('should skip index creation when Neo4j is not connected', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      await vectorManager.setup(mockStore, mockEmbeddingFunction);

      expect(mockNeo4jAdapter.createChunkIndexes).not.toHaveBeenCalled();
    });

    it('should work without embedding function', async () => {
      await vectorManager.setup(mockStore, null);

      expect(vectorManager.isInitialized).toBe(true);
      expect(vectorManager.embeddingFunction).toBeNull();
    });
  });

  describe('isEnabled', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should return true when enabled and connected', () => {
      expect(vectorManager.isEnabled(validToken)).toBe(true);
    });

    it('should return false for invalid token', () => {
      expect(vectorManager.isEnabled('invalid-token')).toBe(false);
    });

    it('should return false when vector.enabled is false', () => {
      mockStore.get.mockReturnValue(false);
      expect(vectorManager.isEnabled(validToken)).toBe(false);
    });

    it('should return false when Neo4j is not connected', () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);
      expect(vectorManager.isEnabled(validToken)).toBe(false);
    });
  });

  describe('hasEmbeddingFunction', () => {
    it('should return true when embedding function is set', async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
      expect(vectorManager.hasEmbeddingFunction()).toBe(true);
    });

    it('should return false when no embedding function', async () => {
      await vectorManager.setup(mockStore, null);
      expect(vectorManager.hasEmbeddingFunction()).toBe(false);
    });
  });

  // ===========================================================================
  // EMBEDDING GENERATION TESTS
  // ===========================================================================

  describe('generateEmbedding', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should generate embedding for text', async () => {
      const embedding = await vectorManager.generateEmbedding('Test text');

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(384);
      expect(mockEmbeddingFunction).toHaveBeenCalledWith('Test text');
    });

    it('should return null when no embedding function', async () => {
      vectorManager.embeddingFunction = null;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const embedding = await vectorManager.generateEmbedding('Test');

      expect(embedding).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No embedding function configured')
      );
      consoleSpy.mockRestore();
    });

    it('should return null on embedding error', async () => {
      mockEmbeddingFunction.mockRejectedValueOnce(new Error('API error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const embedding = await vectorManager.generateEmbedding('Test');

      expect(embedding).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('batchGenerateEmbeddings', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should generate embeddings for multiple texts', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const embeddings = await vectorManager.batchGenerateEmbeddings(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach((emb) => {
        expect(emb).toBeInstanceOf(Array);
        expect(emb.length).toBe(384);
      });
    });

    it('should use batch method if available', async () => {
      const batchFn = jest.fn().mockResolvedValue([[0.1], [0.2], [0.3]]);
      mockEmbeddingFunction.batch = batchFn;

      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const embeddings = await vectorManager.batchGenerateEmbeddings(texts);

      expect(batchFn).toHaveBeenCalledWith(texts);
      expect(embeddings).toEqual([[0.1], [0.2], [0.3]]);

      delete mockEmbeddingFunction.batch;
    });

    it('should return nulls when no embedding function', async () => {
      vectorManager.embeddingFunction = null;
      const embeddings = await vectorManager.batchGenerateEmbeddings(['a', 'b']);
      expect(embeddings).toEqual([null, null]);
    });

    it('should return nulls on batch error', async () => {
      mockEmbeddingFunction.mockRejectedValue(new Error('Batch error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const embeddings = await vectorManager.batchGenerateEmbeddings(['a', 'b']);

      expect(embeddings).toEqual([null, null]);
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // BOOK OPERATIONS TESTS
  // ===========================================================================

  describe('importBook', () => {
    const testBook = {
      id: 'book1',
      title: 'Test Book',
      content: 'This is a test book with some content for chunking.',
    };

    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should import book and create chunks', async () => {
      const result = await vectorManager.importBook(testBook, {}, validToken);

      expect(result.chunksCreated).toBe(5);
      expect(mockNeo4jAdapter.batchCreateChunks).toHaveBeenCalledWith(
        'book1',
        expect.any(Array),
        expect.any(Array),
        validToken
      );
    });

    it('should return error when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const result = await vectorManager.importBook(testBook, {}, validToken);

      expect(result.error).toBe('Vector storage not enabled');
      expect(result.chunksCreated).toBe(0);
    });

    it('should skip embedding generation when disabled', async () => {
      await vectorManager.importBook(
        testBook,
        { generateEmbeddings: false },
        validToken
      );

      expect(mockEmbeddingFunction).not.toHaveBeenCalled();
    });

    it('should return error for empty content', async () => {
      const emptyBook = { id: 'book2', content: '' };

      const result = await vectorManager.importBook(emptyBook, {}, validToken);

      expect(result.error).toBe('No content to chunk');
    });

    it('should handle import error', async () => {
      mockNeo4jAdapter.batchCreateChunks.mockRejectedValueOnce(
        new Error('Database error')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await vectorManager.importBook(testBook, {}, validToken);

      expect(result.error).toBe('Database error');
      consoleSpy.mockRestore();
    });

    it('should return hasEmbeddings flag correctly', async () => {
      const result = await vectorManager.importBook(testBook, {}, validToken);
      expect(result.hasEmbeddings).toBe(true);

      // Without embedding function
      vectorManager.embeddingFunction = null;
      const result2 = await vectorManager.importBook(testBook, {}, validToken);
      expect(result2.hasEmbeddings).toBe(false);
    });
  });

  describe('parseBookIntoChunks', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should parse book content into chunks', async () => {
      const book = { content: 'word1 word2 word3 word4 word5' };
      const chunks = await vectorManager.parseBookIntoChunks(book, 2);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk, idx) => {
        expect(chunk).toHaveProperty('text');
        expect(chunk).toHaveProperty('chunkIndex', idx);
      });
    });

    it('should return empty array for book without content', async () => {
      const book = { id: 'book1' };
      const chunks = await vectorManager.parseBookIntoChunks(book);
      expect(chunks).toEqual([]);
    });
  });

  describe('addBookChunks', () => {
    const testChunks = [
      { text: 'Chunk 1', chunkIndex: 0 },
      { text: 'Chunk 2', chunkIndex: 1 },
    ];

    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should add pre-parsed chunks with embeddings', async () => {
      const result = await vectorManager.addBookChunks('book1', testChunks, validToken);

      expect(result.chunksCreated).toBe(5);
      expect(result.hasEmbeddings).toBe(true);
      expect(mockEmbeddingFunction).toHaveBeenCalledTimes(2);
    });

    it('should return error when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const result = await vectorManager.addBookChunks('book1', testChunks, validToken);

      expect(result.error).toBe('Vector storage not enabled');
    });

    it('should handle chunks without embedding function', async () => {
      vectorManager.embeddingFunction = null;

      const result = await vectorManager.addBookChunks('book1', testChunks, validToken);

      expect(result.chunksCreated).toBe(5);
      expect(result.hasEmbeddings).toBe(false);
    });

    it('should handle error during chunk addition', async () => {
      mockNeo4jAdapter.batchCreateChunks.mockRejectedValueOnce(
        new Error('Chunk error')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await vectorManager.addBookChunks('book1', testChunks, validToken);

      expect(result.error).toBe('Chunk error');
      consoleSpy.mockRestore();
    });
  });

  describe('searchBookContent', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
      mockNeo4jAdapter.searchSimilarChunks.mockResolvedValue([
        {
          chunk: {
            id: 'c1',
            text: 'Matching chunk',
            bookId: 'book1',
            chunkIndex: 0,
            pageNum: 5,
            sectionTitle: 'Chapter 1',
          },
          similarity: 0.95,
        },
      ]);
    });

    it('should search book content by semantic similarity', async () => {
      const results = await vectorManager.searchBookContent(
        'search query',
        'book1',
        10,
        validToken
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('text', 'Matching chunk');
      expect(results[0]).toHaveProperty('similarity', 0.95);
      expect(mockNeo4jAdapter.searchSimilarChunks).toHaveBeenCalledWith(
        expect.any(Array),
        { userId: 1, bookId: 'book1' },
        10,
        0.7
      );
    });

    it('should search across all books when bookId not provided', async () => {
      await vectorManager.searchBookContent('query', null, 10, validToken);

      expect(mockNeo4jAdapter.searchSimilarChunks).toHaveBeenCalledWith(
        expect.any(Array),
        { userId: 1 },
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should return empty array when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const results = await vectorManager.searchBookContent(
        'query',
        null,
        10,
        validToken
      );

      expect(results).toEqual([]);
    });

    it('should return empty array without embedding function', async () => {
      vectorManager.embeddingFunction = null;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const results = await vectorManager.searchBookContent(
        'query',
        null,
        10,
        validToken
      );

      expect(results).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('should return empty array on search error', async () => {
      mockNeo4jAdapter.searchSimilarChunks.mockRejectedValueOnce(
        new Error('Search error')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const results = await vectorManager.searchBookContent(
        'query',
        'book1',
        10,
        validToken
      );

      expect(results).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('deleteBookChunks', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should delete chunks for a book', async () => {
      await vectorManager.deleteBookChunks('book1', validToken);

      expect(mockNeo4jAdapter.deleteChunksByBook).toHaveBeenCalledWith(
        'book1',
        validToken
      );
    });

    it('should do nothing when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      await vectorManager.deleteBookChunks('book1', validToken);

      expect(mockNeo4jAdapter.deleteChunksByBook).not.toHaveBeenCalled();
    });

    it('should handle delete error gracefully', async () => {
      mockNeo4jAdapter.deleteChunksByBook.mockRejectedValueOnce(
        new Error('Delete error')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await vectorManager.deleteBookChunks('book1', validToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('ensureBookEmbeddings', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should generate embeddings for chunks without them', async () => {
      mockNeo4jAdapter.getChunksWithoutEmbeddings.mockResolvedValueOnce([
        { id: 'c1', text: 'Chunk 1' },
        { id: 'c2', text: 'Chunk 2' },
      ]);

      const count = await vectorManager.ensureBookEmbeddings('book1', validToken);

      expect(count).toBe(2);
      expect(mockNeo4jAdapter.updateChunkEmbedding).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when all chunks have embeddings', async () => {
      mockNeo4jAdapter.getChunksWithoutEmbeddings.mockResolvedValueOnce([]);

      const count = await vectorManager.ensureBookEmbeddings('book1', validToken);

      expect(count).toBe(0);
    });

    it('should return 0 when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const count = await vectorManager.ensureBookEmbeddings('book1', validToken);

      expect(count).toBe(0);
    });

    it('should return 0 without embedding function', async () => {
      vectorManager.embeddingFunction = null;

      const count = await vectorManager.ensureBookEmbeddings('book1', validToken);

      expect(count).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockNeo4jAdapter.getChunksWithoutEmbeddings.mockRejectedValueOnce(
        new Error('Error')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const count = await vectorManager.ensureBookEmbeddings('book1', validToken);

      expect(count).toBe(0);
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // KEY CONCEPT OPERATIONS TESTS
  // ===========================================================================

  describe('storeKeyConcepts', () => {
    const testConcepts = [
      { id: 'c1', name: 'Machine Learning', description: 'AI technique' },
      { id: 'c2', name: 'Neural Networks', description: 'Deep learning' },
    ];

    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should store concepts and generate embeddings', async () => {
      const count = await vectorManager.storeKeyConcepts('book1', testConcepts, validToken);

      expect(count).toBe(3);
      expect(mockNeo4jAdapter.createKeyConcepts).toHaveBeenCalledWith(
        'book1',
        testConcepts,
        validToken
      );
      expect(mockNeo4jAdapter.storeConceptEmbeddings).toHaveBeenCalled();
    });

    it('should return 0 when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const count = await vectorManager.storeKeyConcepts('book1', testConcepts, validToken);

      expect(count).toBe(0);
    });

    it('should handle empty concepts array', async () => {
      mockNeo4jAdapter.createKeyConcepts.mockResolvedValueOnce(0);

      const count = await vectorManager.storeKeyConcepts('book1', [], validToken);

      expect(count).toBe(0);
      expect(mockNeo4jAdapter.storeConceptEmbeddings).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockNeo4jAdapter.createKeyConcepts.mockRejectedValueOnce(new Error('Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const count = await vectorManager.storeKeyConcepts('book1', testConcepts, validToken);

      expect(count).toBe(0);
      consoleSpy.mockRestore();
    });
  });

  describe('buildConceptGraph', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should tag chunks and derive relationships', async () => {
      await vectorManager.buildConceptGraph('book1', validToken);

      expect(mockNeo4jAdapter.tagChunksWithConcepts).toHaveBeenCalledWith(
        'book1',
        0.75,
        validToken
      );
      expect(mockNeo4jAdapter.deriveConceptRelationships).toHaveBeenCalledWith(
        'book1',
        2,
        validToken
      );
    });

    it('should do nothing when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      await vectorManager.buildConceptGraph('book1', validToken);

      expect(mockNeo4jAdapter.tagChunksWithConcepts).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockNeo4jAdapter.tagChunksWithConcepts.mockRejectedValueOnce(new Error('Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await vectorManager.buildConceptGraph('book1', validToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getKeyConcepts', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
      mockNeo4jAdapter.getKeyConceptsByBook.mockResolvedValue([
        { id: 'c1', name: 'ML' },
        { id: 'c2', name: 'DL' },
      ]);
    });

    it('should return key concepts for a book', async () => {
      const concepts = await vectorManager.getKeyConcepts('book1', validToken);

      expect(concepts).toHaveLength(2);
      expect(concepts[0]).toHaveProperty('name', 'ML');
    });

    it('should return empty array when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const concepts = await vectorManager.getKeyConcepts('book1', validToken);

      expect(concepts).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockNeo4jAdapter.getKeyConceptsByBook.mockRejectedValueOnce(new Error('Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const concepts = await vectorManager.getKeyConcepts('book1', validToken);

      expect(concepts).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // NOTE OPERATIONS TESTS
  // ===========================================================================

  describe('addNote', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should add note with embedding', async () => {
      const note = { id: 1, content: 'This is a long enough note content' };

      await vectorManager.addNote(note, validToken);

      expect(mockNeo4jAdapter.storeEmbedding).toHaveBeenCalledWith(
        '1',
        'Note',
        expect.any(Array),
        'text-embedding-3-small'
      );
    });

    it('should skip short notes', async () => {
      const note = { id: 1, content: 'Short' };

      await vectorManager.addNote(note, validToken);

      expect(mockNeo4jAdapter.storeEmbedding).not.toHaveBeenCalled();
    });

    it('should use title if no content', async () => {
      const note = { id: 1, title: 'This is a long enough title' };

      await vectorManager.addNote(note, validToken);

      expect(mockNeo4jAdapter.storeEmbedding).toHaveBeenCalled();
    });

    it('should do nothing when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      await vectorManager.addNote({ id: 1, content: 'Long content here' }, validToken);

      expect(mockNeo4jAdapter.storeEmbedding).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockNeo4jAdapter.storeEmbedding.mockRejectedValueOnce(new Error('Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await vectorManager.addNote({ id: 1, content: 'Long content here' }, validToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('searchNotes', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
      mockNeo4jAdapter.findSimilar.mockResolvedValue([
        { id: 'n1', similarity: 0.9 },
      ]);
    });

    it('should search notes by semantic similarity', async () => {
      const results = await vectorManager.searchNotes('query', 10, validToken);

      expect(results).toHaveLength(1);
      expect(mockNeo4jAdapter.findSimilar).toHaveBeenCalledWith(
        expect.any(Array),
        ['Note'],
        10,
        0.7,
        validToken
      );
    });

    it('should return empty array when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const results = await vectorManager.searchNotes('query', 10, validToken);

      expect(results).toEqual([]);
    });

    it('should return empty array without embedding function', async () => {
      vectorManager.embeddingFunction = null;

      const results = await vectorManager.searchNotes('query', 10, validToken);

      expect(results).toEqual([]);
    });
  });

  // ===========================================================================
  // MESSAGE OPERATIONS TESTS
  // ===========================================================================

  describe('addMessage', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should add message with embedding', async () => {
      const message = { id: 1, content: 'This is a message content' };

      await vectorManager.addMessage(message, validToken);

      expect(mockNeo4jAdapter.storeEmbedding).toHaveBeenCalledWith(
        '1',
        'Message',
        expect.any(Array),
        'text-embedding-3-small'
      );
    });

    it('should skip short messages', async () => {
      const message = { id: 1, content: 'Hi' };

      await vectorManager.addMessage(message, validToken);

      expect(mockNeo4jAdapter.storeEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('searchMessages', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
      mockNeo4jAdapter.findSimilar.mockResolvedValue([
        { id: 'm1', similarity: 0.85 },
      ]);
    });

    it('should search messages by semantic similarity', async () => {
      const results = await vectorManager.searchMessages('query', null, 10, validToken);

      expect(results).toHaveLength(1);
      expect(mockNeo4jAdapter.findSimilar).toHaveBeenCalledWith(
        expect.any(Array),
        ['Message'],
        10,
        0.7,
        validToken
      );
    });
  });

  // ===========================================================================
  // LEARNING POINT OPERATIONS TESTS
  // ===========================================================================

  describe('createLearningPoints', () => {
    const testLearningPoints = [
      { itemType: 'word', domainType: 'vocabulary', title: 'Test' },
    ];

    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should create learning points', async () => {
      const count = await vectorManager.createLearningPoints(
        'topic1',
        testLearningPoints,
        validToken
      );

      expect(count).toBe(10);
      expect(mockNeo4jAdapter.createLearningPoints).toHaveBeenCalledWith(
        'topic1',
        testLearningPoints,
        validToken
      );
    });

    it('should return 0 when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const count = await vectorManager.createLearningPoints(
        'topic1',
        testLearningPoints,
        validToken
      );

      expect(count).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockNeo4jAdapter.createLearningPoints.mockRejectedValueOnce(new Error('Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const count = await vectorManager.createLearningPoints(
        'topic1',
        testLearningPoints,
        validToken
      );

      expect(count).toBe(0);
      consoleSpy.mockRestore();
    });
  });

  describe('getLearningPoints', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
      mockNeo4jAdapter.getLearningPointsByTopic.mockResolvedValue([
        { id: 'lp1', title: 'Test' },
      ]);
    });

    it('should return learning points for a topic', async () => {
      const points = await vectorManager.getLearningPoints('topic1', {}, validToken);

      expect(points).toHaveLength(1);
      expect(points[0]).toHaveProperty('title', 'Test');
    });

    it('should pass filters to adapter', async () => {
      await vectorManager.getLearningPoints('topic1', { status: 'reviewing' }, validToken);

      expect(mockNeo4jAdapter.getLearningPointsByTopic).toHaveBeenCalledWith(
        'topic1',
        { status: 'reviewing' },
        validToken
      );
    });

    it('should return empty array when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const points = await vectorManager.getLearningPoints('topic1', {}, validToken);

      expect(points).toEqual([]);
    });
  });

  describe('updateLearningPointAfterReview', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
      mockNeo4jAdapter.updateLearningPointAfterReview.mockResolvedValue({
        id: 'lp1',
        masteryLevel: 20,
      });
    });

    it('should update learning point after review', async () => {
      const result = await vectorManager.updateLearningPointAfterReview('lp1', {
        wasCorrect: true,
      });

      expect(result).toHaveProperty('masteryLevel', 20);
      expect(mockNeo4jAdapter.updateLearningPointAfterReview).toHaveBeenCalledWith(
        'lp1',
        { wasCorrect: true }
      );
    });

    it('should return null on error', async () => {
      mockNeo4jAdapter.updateLearningPointAfterReview.mockRejectedValueOnce(
        new Error('Error')
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await vectorManager.updateLearningPointAfterReview('lp1', {
        wasCorrect: true,
      });

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('getLearningPointsDueForReview', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
      mockNeo4jAdapter.getLearningPointsDueForReview.mockResolvedValue([
        { id: 'lp1' },
        { id: 'lp2' },
      ]);
    });

    it('should return due learning points', async () => {
      const points = await vectorManager.getLearningPointsDueForReview(null, 20, validToken);

      expect(points).toHaveLength(2);
      expect(mockNeo4jAdapter.getLearningPointsDueForReview).toHaveBeenCalledWith(
        null,
        20,
        validToken
      );
    });

    it('should filter by topic when provided', async () => {
      await vectorManager.getLearningPointsDueForReview('topic1', 10, validToken);

      expect(mockNeo4jAdapter.getLearningPointsDueForReview).toHaveBeenCalledWith(
        'topic1',
        10,
        validToken
      );
    });

    it('should return empty array when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const points = await vectorManager.getLearningPointsDueForReview(null, 20, validToken);

      expect(points).toEqual([]);
    });
  });

  // ===========================================================================
  // STATISTICS TESTS
  // ===========================================================================

  describe('getStats', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
      mockNeo4jAdapter.getMigrationStats.mockResolvedValue({
        Chunk: 100,
        KeyConcept: 50,
        LearningPoint: 200,
        Note: 30,
        Message: 500,
      });
    });

    it('should return storage statistics', async () => {
      const stats = await vectorManager.getStats(validToken);

      expect(stats).toEqual({
        enabled: true,
        hasEmbeddingFunction: true,
        chunks: 100,
        keyConcepts: 50,
        learningPoints: 200,
        notes: 30,
        messages: 500,
      });
    });

    it('should return enabled: false when not enabled', async () => {
      mockNeo4jAdapter.checkConnection.mockReturnValue(false);

      const stats = await vectorManager.getStats(validToken);

      expect(stats).toEqual({ enabled: false });
    });

    it('should handle errors gracefully', async () => {
      mockNeo4jAdapter.getMigrationStats.mockRejectedValueOnce(new Error('Stats error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const stats = await vectorManager.getStats(validToken);

      expect(stats).toHaveProperty('error', 'Stats error');
      consoleSpy.mockRestore();
    });

    it('should handle missing stats', async () => {
      mockNeo4jAdapter.getMigrationStats.mockResolvedValue({});

      const stats = await vectorManager.getStats(validToken);

      expect(stats.chunks).toBe(0);
      expect(stats.keyConcepts).toBe(0);
      expect(stats.learningPoints).toBe(0);
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await vectorManager.setup(mockStore, mockEmbeddingFunction);
    });

    it('should handle embedding function returning empty array', async () => {
      mockEmbeddingFunction.mockResolvedValueOnce([]);

      const embedding = await vectorManager.generateEmbedding('Test');

      expect(embedding).toEqual([]);
    });

    it('should handle very long text for embedding', async () => {
      const longText = 'a'.repeat(100000);

      const embedding = await vectorManager.generateEmbedding(longText);

      expect(embedding).toBeInstanceOf(Array);
      expect(mockEmbeddingFunction).toHaveBeenCalledWith(longText);
    });

    it('should handle unicode text', async () => {
      const unicodeText = '中文测试 日本語 émojis 🎉';

      const embedding = await vectorManager.generateEmbedding(unicodeText);

      expect(embedding).toBeInstanceOf(Array);
    });

    it('should handle concurrent operations', async () => {
      const promises = [
        vectorManager.generateEmbedding('Text 1'),
        vectorManager.generateEmbedding('Text 2'),
        vectorManager.generateEmbedding('Text 3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((emb) => expect(emb).toBeInstanceOf(Array));
    });
  });
});
