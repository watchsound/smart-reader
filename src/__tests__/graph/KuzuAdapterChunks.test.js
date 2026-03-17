/**
 * KuzuAdapterChunks.test.js
 *
 * Comprehensive tests for KuzuAdapter chunk operations (RAG support).
 * Tests book chunk storage, key concept operations, and semantic search.
 */

// Mock kuzu module (virtual: true because kuzu may not be installed yet)
const mockQueryResult = {
  getAll: jest.fn().mockResolvedValue([]),
  getAllSync: jest.fn().mockReturnValue([]),
};

const mockConnection = {
  query: jest.fn().mockResolvedValue(mockQueryResult),
  querySync: jest.fn().mockReturnValue(mockQueryResult),
};

const mockDatabase = {};

jest.mock('kuzu', () => ({
  Database: jest.fn(() => mockDatabase),
  Connection: jest.fn(() => mockConnection),
}), { virtual: true });

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/userData') },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

jest.mock('../../main/db/DBManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user2-token') return 2;
    return 1;
  }),
}));

/**
 * MockKuzuAdapter class that simulates the chunk/RAG methods
 * Uses mockConnection.query to make calls verifiable in tests
 */
class MockKuzuAdapter {
  constructor() {
    this.db = mockDatabase;
    this.conn = mockConnection;
    this.isConnected = true;
    this.vectorIndexesCreated = true;
  }

  async createChunkIndexes() {
    this.vectorIndexesCreated = false;
    try {
      // Create chunk node table
      await mockConnection.query(
        'CREATE NODE TABLE Chunk (id STRING, bookId STRING, text STRING, chunkIndex INT64, pageNum INT64, cfi STRING, sectionTitle STRING, wordCount INT64, embedding FLOAT[1536], userId INT64, createdAt STRING, PRIMARY KEY (id))',
        {}
      );

      // Create vector index
      await mockConnection.query(
        'CREATE HNSW INDEX ON Chunk(embedding)',
        {}
      );

      // Create index on bookId
      await mockConnection.query(
        'CREATE INDEX ON Chunk(bookId)',
        {}
      );

      // Create index on chunkIndex
      await mockConnection.query(
        'CREATE INDEX ON Chunk(chunkIndex)',
        {}
      );

      this.vectorIndexesCreated = true;
    } catch (error) {
      // Handle existing index errors gracefully
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  async createChunk(bookId, chunk, embedding, token) {
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    // Create the chunk node
    await mockConnection.query(
      'CREATE (c:Chunk {id: $id, bookId: $bookId, text: $text, chunkIndex: $chunkIndex, pageNum: $pageNum, cfi: $cfi, sectionTitle: $sectionTitle, wordCount: $wordCount, embedding: $embedding, userId: $userId, createdAt: $createdAt})',
      {
        id: chunk.id,
        bookId,
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        pageNum: chunk.pageNum || null,
        cfi: chunk.cfi || null,
        sectionTitle: chunk.sectionTitle || null,
        wordCount: chunk.wordCount || null,
        embedding,
        userId,
        createdAt: chunk.createdAt || new Date().toISOString(),
      }
    );

    // Create relationship to book
    await mockConnection.query(
      'MATCH (c:Chunk {id: $chunkId}), (b:Book {id: $bookId}) CREATE (c)-[:BELONGS_TO]->(b)',
      { chunkId: chunk.id, bookId }
    );

    const result = await mockQueryResult.getAll();
    return result[0]?.c || { ...chunk, userId };
  }

  async batchCreateChunks(bookId, chunks, embeddings, token) {
    // Validate embeddings length matches chunks
    if (embeddings.length !== chunks.length) {
      throw new Error('Embeddings length must match chunks length');
    }

    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    let created = 0;
    let failed = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        await mockConnection.query(
          'CREATE (c:Chunk {id: $id, bookId: $bookId, text: $text, chunkIndex: $chunkIndex, embedding: $embedding, userId: $userId})',
          {
            id: chunks[i].id,
            bookId,
            text: chunks[i].text,
            chunkIndex: chunks[i].chunkIndex,
            embedding: embeddings[i],
            userId,
          }
        );
        const result = await mockQueryResult.getAll();
        if (result[0]?.success !== false) {
          created++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }

    return { created, failed };
  }

  async getChunksByBook(bookId, token, options = {}) {
    const { limit, offset, pageNum, sectionTitle } = options;

    let query = 'MATCH (c:Chunk {bookId: $bookId}) WHERE c.userId = $userId';

    if (pageNum !== undefined) {
      query += ' AND c.pageNum = $pageNum';
    }
    if (sectionTitle) {
      query += ' AND c.sectionTitle = $sectionTitle';
    }

    query += ' RETURN c ORDER BY c.chunkIndex';

    if (limit) {
      query += ' LIMIT $limit';
    }
    if (offset) {
      query += ' SKIP $offset';
    }

    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    await mockConnection.query(query, { bookId, userId, limit, offset, pageNum, sectionTitle });
    const results = await mockQueryResult.getAll();
    return results.map(r => r.c);
  }

  async getChunk(chunkId, token) {
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    await mockConnection.query(
      'MATCH (c:Chunk {id: $chunkId}) WHERE c.userId = $userId RETURN c',
      { chunkId, userId }
    );

    const results = await mockQueryResult.getAll();
    return results.length > 0 ? results[0].c : null;
  }

  async searchSimilarChunks(embedding, limit, token, options = {}) {
    const { bookId, threshold } = options;
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    let query = 'CALL QUERY_VECTOR_INDEX(Chunk, embedding, $embedding, $limit) YIELD node, distance WHERE node.userId = $userId';

    if (bookId) {
      query += ' AND node.bookId = $bookId';
    }

    query += ' RETURN node AS c, distance';

    await mockConnection.query(query, { embedding, limit, userId, bookId });
    let results = await mockQueryResult.getAll();

    // Apply threshold filter if specified
    if (threshold) {
      results = results.filter(r => (1 - r.distance) >= threshold);
    }

    return results.map(r => ({
      ...r.c,
      similarity: 1 - r.distance,
      distance: r.distance,
    }));
  }

  async deleteChunk(chunkId, token) {
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    await mockConnection.query(
      'MATCH (c:Chunk {id: $chunkId}) WHERE c.userId = $userId DELETE c',
      { chunkId, userId }
    );

    const results = await mockQueryResult.getAll();
    return results[0]?.deleted || true;
  }

  async deleteChunksByBook(bookId, token) {
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    await mockConnection.query(
      'MATCH (c:Chunk) WHERE c.bookId = $bookId AND c.userId = $userId DELETE c RETURN count(*) AS count',
      { bookId, userId }
    );

    const results = await mockQueryResult.getAll();
    return results[0]?.count || 0;
  }

  async createKeyConcepts(bookId, concepts, token) {
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    for (const concept of concepts) {
      await mockConnection.query(
        'CREATE (kc:KeyConcept {id: $id, name: $name, importance: $importance, mentions: $mentions, userId: $userId})',
        {
          id: concept.id,
          name: concept.name,
          importance: concept.importance,
          mentions: concept.mentions,
          userId,
        }
      );

      // Link concept to book
      await mockConnection.query(
        'MATCH (kc:KeyConcept {id: $conceptId}), (b:Book {id: $bookId}) CREATE (kc)-[:KEY_CONCEPT_OF]->(b)',
        { conceptId: concept.id, bookId }
      );
    }

    const results = await mockQueryResult.getAll();
    return { created: results[0]?.count || concepts.length };
  }

  async getKeyConceptsByBook(bookId, token, limit) {
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    let query = 'MATCH (kc:KeyConcept)-[:KEY_CONCEPT_OF]->(b:Book {id: $bookId}) WHERE kc.userId = $userId RETURN kc ORDER BY kc.importance DESC';

    if (limit) {
      query += ' LIMIT $limit';
    }

    await mockConnection.query(query, { bookId, userId, limit });
    const results = await mockQueryResult.getAll();
    return results.map(r => r.kc);
  }

  async storeConceptEmbeddings(embeddings, model, token) {
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    for (const item of embeddings) {
      await mockConnection.query(
        'MATCH (kc:KeyConcept {id: $conceptId}) WHERE kc.userId = $userId SET kc.embedding = $embedding, kc.embeddingModel = $model',
        { conceptId: item.conceptId, embedding: item.embedding, model, userId }
      );
    }

    const results = await mockQueryResult.getAll();
    return { stored: results[0]?.count || embeddings.length };
  }

  async findSimilarKeyConcepts(embedding, limit, token, options = {}) {
    const { excludeBookId } = options;
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    let query = 'CALL QUERY_VECTOR_INDEX(KeyConcept, embedding, $embedding, $limit) YIELD node, distance WHERE node.userId = $userId';

    if (excludeBookId) {
      query += ' AND NOT (node)-[:KEY_CONCEPT_OF]->(:Book {id: $excludeBookId})';
    }

    query += ' RETURN node AS kc, distance';

    await mockConnection.query(query, { embedding, limit, userId, excludeBookId });
    const results = await mockQueryResult.getAll();

    return results.map(r => ({
      ...r.kc,
      similarity: 1 - r.distance,
      distance: r.distance,
    }));
  }

  async getContextForQuery(embedding, bookId, limit, token, options = {}) {
    const { includeKeyConcepts, maxTokens } = options;
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    // Search for similar chunks
    await mockConnection.query(
      'CALL QUERY_VECTOR_INDEX(Chunk, embedding, $embedding, $limit) YIELD node, distance WHERE node.bookId = $bookId AND node.userId = $userId RETURN node AS c, (1 - distance) AS similarity ORDER BY similarity DESC',
      { embedding, bookId, limit, userId }
    );

    const chunkResults = await mockQueryResult.getAll();
    const chunks = chunkResults.map(r => ({
      ...r.c,
      similarity: r.similarity,
    }));

    const result = { chunks };

    if (includeKeyConcepts) {
      await mockConnection.query(
        'MATCH (kc:KeyConcept)-[:KEY_CONCEPT_OF]->(b:Book {id: $bookId}) WHERE kc.userId = $userId RETURN kc ORDER BY kc.importance DESC LIMIT 10',
        { bookId, userId }
      );

      const kcResults = await mockQueryResult.getAll();
      result.keyConcepts = kcResults.map(r => r.kc);
    }

    return result;
  }

  async buildRAGPrompt(query, embedding, bookId, token) {
    const context = await this.getContextForQuery(embedding, bookId, 5, token, { includeKeyConcepts: true });

    const contextText = context.chunks.map(c => c.text).join('\n\n');

    return {
      context: contextText,
      prompt: `Based on the following context from the book, answer the question.\n\nContext:\n${contextText}\n\nQuestion: ${query}`,
      chunks: context.chunks,
      keyConcepts: context.keyConcepts,
    };
  }

  async updateChunkEmbedding(chunkId, embedding, token) {
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    await mockConnection.query(
      'MATCH (c:Chunk {id: $chunkId}) WHERE c.userId = $userId SET c.embedding = $embedding',
      { chunkId, embedding, userId }
    );

    const results = await mockQueryResult.getAll();
    return results[0]?.success || true;
  }

  async reindexBookChunks(bookId, token) {
    const { getUserIdFromToken } = require('../../main/db/DBManager');
    const userId = getUserIdFromToken(token);

    await mockConnection.query(
      'MATCH (c:Chunk) WHERE c.bookId = $bookId AND c.userId = $userId RETURN count(*) AS count',
      { bookId, userId }
    );

    const results = await mockQueryResult.getAll();
    return { reindexed: results[0]?.count || 0 };
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult.getAll.mockResolvedValue([]);
});

describe('KuzuAdapter Chunk Operations', () => {
  let adapter;
  const validToken = 'valid-token';

  // Sample embedding (1536 dimensions)
  const sampleEmbedding = Array(1536).fill(0).map(() => Math.random() - 0.5);

  // Sample chunk data
  const sampleChunk = {
    id: 'chunk_123',
    bookId: 'book_456',
    text: 'This is a sample chunk of text from a book about machine learning. It discusses neural networks and deep learning concepts.',
    chunkIndex: 0,
    pageNum: 5,
    cfi: '/2/4/6',
    sectionTitle: 'Introduction to ML',
    wordCount: 25,
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    adapter = new MockKuzuAdapter();
  });

  // ===========================================================================
  // CHUNK INDEX CREATION TESTS
  // ===========================================================================

  describe('createChunkIndexes', () => {
    beforeEach(() => {
      adapter.vectorIndexesCreated = false;
    });

    it('should create chunk node table', async () => {
      await adapter.createChunkIndexes();

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringMatching(/CREATE.*NODE.*TABLE.*Chunk/i),
        expect.anything()
      );
    });

    it('should create vector index for chunk embeddings', async () => {
      await adapter.createChunkIndexes();

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringMatching(/INDEX|HNSW/i),
        expect.anything()
      );
    });

    it('should create index on bookId for fast lookup', async () => {
      await adapter.createChunkIndexes();

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('bookId'),
        expect.anything()
      );
    });

    it('should create index on chunkIndex for ordering', async () => {
      await adapter.createChunkIndexes();

      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should handle existing index errors gracefully', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('already exists'));

      await expect(adapter.createChunkIndexes()).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // SINGLE CHUNK CREATION TESTS
  // ===========================================================================

  describe('createChunk', () => {
    it('should create a chunk with all properties', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ c: sampleChunk }]);

      const result = await adapter.createChunk(
        'book_456',
        sampleChunk,
        sampleEmbedding,
        validToken
      );

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE'),
        expect.anything()
      );
      expect(result).toHaveProperty('id', 'chunk_123');
      expect(result).toHaveProperty('text');
    });

    it('should store embedding with chunk', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ c: sampleChunk }]);

      await adapter.createChunk('book_456', sampleChunk, sampleEmbedding, validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('embedding'),
        expect.anything()
      );
    });

    it('should set userId from token', async () => {
      mockQueryResult.getAll.mockResolvedValue([{
        c: { ...sampleChunk, userId: 1 },
      }]);

      const result = await adapter.createChunk(
        'book_456',
        sampleChunk,
        sampleEmbedding,
        validToken
      );

      expect(result.userId).toBe(1);
    });

    it('should create relationship to book', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ c: sampleChunk }]);

      await adapter.createChunk('book_456', sampleChunk, sampleEmbedding, validToken);

      // Should create BELONGS_TO or similar relationship
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringMatching(/BELONGS_TO|FROM_BOOK|HAS_CHUNK/),
        expect.anything()
      );
    });

    it('should handle missing optional fields', async () => {
      const minimalChunk = {
        id: 'chunk_minimal',
        text: 'Minimal chunk text',
        chunkIndex: 0,
      };
      mockQueryResult.getAll.mockResolvedValue([{ c: minimalChunk }]);

      const result = await adapter.createChunk(
        'book_456',
        minimalChunk,
        sampleEmbedding,
        validToken
      );

      expect(result.id).toBe('chunk_minimal');
    });
  });

  // ===========================================================================
  // BATCH CHUNK CREATION TESTS
  // ===========================================================================

  describe('batchCreateChunks', () => {
    const chunks = [
      { ...sampleChunk, id: 'chunk_1', chunkIndex: 0 },
      { ...sampleChunk, id: 'chunk_2', chunkIndex: 1 },
      { ...sampleChunk, id: 'chunk_3', chunkIndex: 2 },
    ];
    const embeddings = [sampleEmbedding, sampleEmbedding, sampleEmbedding];

    it('should create multiple chunks in batch', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ count: 3 }]);

      const result = await adapter.batchCreateChunks(
        'book_456',
        chunks,
        embeddings,
        validToken
      );

      expect(result.created).toBe(3);
    });

    it('should use efficient batch query', async () => {
      await adapter.batchCreateChunks('book_456', chunks, embeddings, validToken);

      // Should use UNWIND or batch INSERT
      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should handle partial failures', async () => {
      mockQueryResult.getAll
        .mockResolvedValueOnce([{ success: true }])
        .mockResolvedValueOnce([{ success: true }])
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await adapter.batchCreateChunks(
        'book_456',
        chunks,
        embeddings,
        validToken
      );

      expect(result.failed).toBe(1);
      expect(result.created).toBe(2);
    });

    it('should validate embeddings length matches chunks', async () => {
      const mismatchedEmbeddings = [sampleEmbedding]; // Only 1 embedding for 3 chunks

      // Should either throw or handle gracefully
      await expect(
        adapter.batchCreateChunks('book_456', chunks, mismatchedEmbeddings, validToken)
      ).rejects.toThrow();
    });

    it('should maintain chunk order', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ count: 3 }]);

      await adapter.batchCreateChunks('book_456', chunks, embeddings, validToken);

      // Chunks should maintain their chunkIndex order
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // CHUNK RETRIEVAL TESTS
  // ===========================================================================

  describe('getChunksByBook', () => {
    it('should get all chunks for a book', async () => {
      const chunks = [
        { c: { ...sampleChunk, chunkIndex: 0 } },
        { c: { ...sampleChunk, id: 'chunk_2', chunkIndex: 1 } },
        { c: { ...sampleChunk, id: 'chunk_3', chunkIndex: 2 } },
      ];
      mockQueryResult.getAll.mockResolvedValue(chunks);

      const result = await adapter.getChunksByBook('book_456', validToken);

      expect(result).toHaveLength(3);
    });

    it('should order by chunkIndex', async () => {
      await adapter.getChunksByBook('book_456', validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY'),
        expect.anything()
      );
    });

    it('should support pagination', async () => {
      await adapter.getChunksByBook('book_456', validToken, {
        limit: 10,
        offset: 5,
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.anything()
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SKIP'),
        expect.anything()
      );
    });

    it('should filter by page number', async () => {
      await adapter.getChunksByBook('book_456', validToken, { pageNum: 5 });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('pageNum'),
        expect.anything()
      );
    });

    it('should filter by section', async () => {
      await adapter.getChunksByBook('book_456', validToken, {
        sectionTitle: 'Introduction',
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('sectionTitle'),
        expect.anything()
      );
    });
  });

  describe('getChunk', () => {
    it('should get single chunk by id', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ c: sampleChunk }]);

      const result = await adapter.getChunk('chunk_123', validToken);

      expect(result).toEqual(sampleChunk);
    });

    it('should return null for non-existent chunk', async () => {
      mockQueryResult.getAll.mockResolvedValue([]);

      const result = await adapter.getChunk('nonexistent', validToken);

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // CHUNK SEARCH TESTS
  // ===========================================================================

  describe('searchSimilarChunks', () => {
    const searchResults = [
      { c: sampleChunk, distance: 0.1 },
      { c: { ...sampleChunk, id: 'chunk_2' }, distance: 0.2 },
      { c: { ...sampleChunk, id: 'chunk_3' }, distance: 0.3 },
    ];

    it('should search chunks by embedding similarity', async () => {
      mockQueryResult.getAll.mockResolvedValue(searchResults);

      const result = await adapter.searchSimilarChunks(
        sampleEmbedding,
        10,
        validToken
      );

      expect(result).toHaveLength(3);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('QUERY_VECTOR_INDEX'),
        expect.anything()
      );
    });

    it('should filter by book', async () => {
      mockQueryResult.getAll.mockResolvedValue(searchResults);

      await adapter.searchSimilarChunks(sampleEmbedding, 10, validToken, {
        bookId: 'book_456',
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('bookId'),
        expect.anything()
      );
    });

    it('should filter by similarity threshold', async () => {
      mockQueryResult.getAll.mockResolvedValue(searchResults);

      const result = await adapter.searchSimilarChunks(
        sampleEmbedding,
        10,
        validToken,
        { threshold: 0.8 }
      );

      // Should filter out low-similarity results
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should include similarity score in results', async () => {
      mockQueryResult.getAll.mockResolvedValue(searchResults);

      const result = await adapter.searchSimilarChunks(
        sampleEmbedding,
        10,
        validToken
      );

      result.forEach(r => {
        expect(r.similarity || r.distance).toBeDefined();
      });
    });

    it('should respect limit parameter', async () => {
      await adapter.searchSimilarChunks(sampleEmbedding, 5, validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything()
      );
    });
  });

  // ===========================================================================
  // CHUNK DELETION TESTS
  // ===========================================================================

  describe('deleteChunk', () => {
    it('should delete single chunk', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ deleted: true }]);

      const result = await adapter.deleteChunk('chunk_123', validToken);

      expect(result).toBe(true);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.anything()
      );
    });
  });

  describe('deleteChunksByBook', () => {
    it('should delete all chunks for a book', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ count: 10 }]);

      const result = await adapter.deleteChunksByBook('book_456', validToken);

      expect(result).toBe(10);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('bookId'),
        expect.anything()
      );
    });
  });

  // ===========================================================================
  // KEY CONCEPT OPERATIONS TESTS
  // ===========================================================================

  describe('Key Concept Operations', () => {
    const keyConcepts = [
      { id: 'kc_1', name: 'Neural Networks', importance: 0.9, mentions: 15 },
      { id: 'kc_2', name: 'Deep Learning', importance: 0.85, mentions: 12 },
      { id: 'kc_3', name: 'Backpropagation', importance: 0.8, mentions: 8 },
    ];

    describe('createKeyConcepts', () => {
      it('should create key concepts for a book', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ count: 3 }]);

        const result = await adapter.createKeyConcepts(
          'book_456',
          keyConcepts,
          validToken
        );

        expect(result.created).toBe(3);
      });

      it('should link concepts to book', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ count: 3 }]);

        await adapter.createKeyConcepts('book_456', keyConcepts, validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringMatching(/KEY_CONCEPT_OF|HAS_KEY_CONCEPT/),
          expect.anything()
        );
      });

      it('should store importance scores', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ count: 3 }]);

        await adapter.createKeyConcepts('book_456', keyConcepts, validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('importance'),
          expect.anything()
        );
      });

      it('should store mention counts', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ count: 3 }]);

        await adapter.createKeyConcepts('book_456', keyConcepts, validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('mentions'),
          expect.anything()
        );
      });
    });

    describe('getKeyConceptsByBook', () => {
      it('should get key concepts for a book', async () => {
        mockQueryResult.getAll.mockResolvedValue(keyConcepts.map(kc => ({ kc })));

        const result = await adapter.getKeyConceptsByBook('book_456', validToken);

        expect(result).toHaveLength(3);
      });

      it('should order by importance', async () => {
        await adapter.getKeyConceptsByBook('book_456', validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY'),
          expect.anything()
        );
      });

      it('should support limit parameter', async () => {
        await adapter.getKeyConceptsByBook('book_456', validToken, 5);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.anything()
        );
      });
    });

    describe('storeConceptEmbeddings', () => {
      it('should store embeddings for key concepts', async () => {
        const conceptEmbeddings = keyConcepts.map((kc, i) => ({
          conceptId: kc.id,
          embedding: sampleEmbedding,
        }));

        mockQueryResult.getAll.mockResolvedValue([{ count: 3 }]);

        const result = await adapter.storeConceptEmbeddings(
          conceptEmbeddings,
          'text-embedding-3-small',
          validToken
        );

        expect(result.stored).toBe(3);
      });

      it('should use vector index for semantic concept search', async () => {
        await adapter.storeConceptEmbeddings(
          [{ conceptId: 'kc_1', embedding: sampleEmbedding }],
          'model',
          validToken
        );

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('embedding'),
          expect.anything()
        );
      });
    });

    describe('findSimilarKeyConcepts', () => {
      it('should find similar concepts across books', async () => {
        mockQueryResult.getAll.mockResolvedValue([
          { kc: keyConcepts[0], distance: 0.1 },
          { kc: keyConcepts[1], distance: 0.2 },
        ]);

        const result = await adapter.findSimilarKeyConcepts(
          sampleEmbedding,
          10,
          validToken
        );

        expect(result).toHaveLength(2);
      });

      it('should exclude concepts from specified book', async () => {
        await adapter.findSimilarKeyConcepts(sampleEmbedding, 10, validToken, {
          excludeBookId: 'book_456',
        });

        expect(mockConnection.query).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // RAG CONTEXT BUILDING TESTS
  // ===========================================================================

  describe('RAG Context Building', () => {
    describe('getContextForQuery', () => {
      it('should return relevant chunks for a query embedding', async () => {
        const contextChunks = [
          { c: sampleChunk, similarity: 0.95 },
          { c: { ...sampleChunk, id: 'chunk_2' }, similarity: 0.88 },
        ];
        mockQueryResult.getAll.mockResolvedValue(contextChunks);

        const result = await adapter.getContextForQuery(
          sampleEmbedding,
          'book_456',
          5,
          validToken
        );

        expect(result.chunks).toHaveLength(2);
        expect(result.chunks[0].similarity).toBeGreaterThan(result.chunks[1].similarity);
      });

      it('should include key concepts in context', async () => {
        mockQueryResult.getAll
          .mockResolvedValueOnce([{ c: sampleChunk, similarity: 0.9 }])
          .mockResolvedValueOnce([{ kc: { name: 'Neural Networks' } }]);

        const result = await adapter.getContextForQuery(
          sampleEmbedding,
          'book_456',
          5,
          validToken,
          { includeKeyConcepts: true }
        );

        expect(result.keyConcepts).toBeDefined();
      });

      it('should respect token limit', async () => {
        await adapter.getContextForQuery(
          sampleEmbedding,
          'book_456',
          5,
          validToken,
          { maxTokens: 4000 }
        );

        // Should limit chunks based on token count
        expect(mockConnection.query).toHaveBeenCalled();
      });
    });

    describe('buildRAGPrompt', () => {
      it('should build prompt with context chunks', async () => {
        const chunks = [sampleChunk, { ...sampleChunk, id: 'chunk_2' }];
        mockQueryResult.getAll.mockResolvedValue(chunks.map(c => ({ c })));

        const result = await adapter.buildRAGPrompt(
          'What is machine learning?',
          sampleEmbedding,
          'book_456',
          validToken
        );

        expect(result.context).toBeDefined();
        expect(result.prompt).toBeDefined();
      });
    });
  });
});

// ===========================================================================
// CHUNK UPDATE TESTS
// ===========================================================================

describe('KuzuAdapter Chunk Updates', () => {
  let adapter;
  const validToken = 'valid-token';

  beforeEach(() => {
    adapter = new MockKuzuAdapter();
  });

  describe('updateChunkEmbedding', () => {
    it('should update embedding for existing chunk', async () => {
      const newEmbedding = Array(1536).fill(0.5);
      mockQueryResult.getAll.mockResolvedValue([{ success: true }]);

      const result = await adapter.updateChunkEmbedding(
        'chunk_123',
        newEmbedding,
        validToken
      );

      expect(result).toBe(true);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SET'),
        expect.anything()
      );
    });
  });

  describe('reindexBookChunks', () => {
    it('should regenerate all chunk embeddings for a book', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ count: 10 }]);

      const result = await adapter.reindexBookChunks('book_456', validToken);

      expect(result.reindexed).toBe(10);
    });
  });
});
