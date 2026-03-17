/**
 * Neo4jAdapterChunks.test.js
 *
 * Comprehensive tests for Neo4jAdapter chunk operations.
 * Tests book chunk storage, key concept operations, and learning point management.
 */

// Mock neo4j-driver
const mockSession = {
  run: jest.fn(),
  close: jest.fn(),
};

const mockDriver = {
  session: jest.fn(() => mockSession),
  verifyConnectivity: jest.fn().mockResolvedValue(true),
  close: jest.fn(),
};

jest.mock('neo4j-driver', () => ({
  driver: jest.fn(() => mockDriver),
  auth: {
    basic: jest.fn((user, password) => ({ user, password })),
  },
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

// Reset the singleton before each import
beforeEach(() => {
  jest.clearAllMocks();
  // Reset singleton
  jest.resetModules();
});

describe('Neo4jAdapter Chunk Operations', () => {
  let Neo4jAdapter;
  let adapter;
  const validToken = 'valid-token';

  beforeEach(async () => {
    // Import fresh for each test
    const module = require('../../main/utils/Neo4jAdapter');
    Neo4jAdapter = module.Neo4jAdapter;
    adapter = module.default;

    // Connect the adapter
    adapter.driver = mockDriver;
    adapter.isConnected = true;
    adapter.config = { database: 'neo4j' };
  });

  // ===========================================================================
  // CHUNK INDEX CREATION TESTS
  // ===========================================================================

  describe('createChunkIndexes', () => {
    it('should create all required chunk indexes', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.createChunkIndexes();

      // Should create constraints for Chunk, KeyConcept, LearningPoint
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE CONSTRAINT chunk_id_unique')
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE CONSTRAINT key_concept_id_unique')
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE CONSTRAINT learning_point_id_unique')
      );

      // Should create performance indexes
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX chunk_book')
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX learning_point_topic')
      );

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle existing index errors gracefully', async () => {
      mockSession.run.mockRejectedValueOnce(new Error('Index already exists'));
      mockSession.run.mockResolvedValue({ records: [] });

      // Should not throw
      await expect(adapter.createChunkIndexes()).resolves.not.toThrow();
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should warn on non-exists errors', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockSession.run.mockRejectedValueOnce(new Error('Some other error'));
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.createChunkIndexes();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Chunk index creation warning')
      );
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // SINGLE CHUNK CREATION TESTS
  // ===========================================================================

  describe('createChunk', () => {
    const testChunk = {
      id: 'chunk_123',
      text: 'This is a sample chunk of text from a book.',
      chunkIndex: 0,
      pageNum: 5,
      cfi: '/2/4/6',
      sectionTitle: 'Introduction',
    };
    const testEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

    it('should create a chunk with all properties', async () => {
      const mockRecord = {
        get: jest.fn(() => ({
          properties: {
            id: 'chunk_123',
            bookId: 'book1',
            userId: 1,
            text: testChunk.text,
            chunkIndex: 0,
            pageNum: 5,
            embedding: testEmbedding,
          },
        })),
      };
      mockSession.run.mockResolvedValue({ records: [mockRecord] });

      const result = await adapter.createChunk('book1', testChunk, testEmbedding, validToken);

      expect(result).toHaveProperty('id', 'chunk_123');
      expect(result).toHaveProperty('text', testChunk.text);
      expect(result).toHaveProperty('embedding', testEmbedding);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (c:Chunk'),
        expect.objectContaining({
          bookId: 'book1',
          text: testChunk.text,
          chunkIndex: 0,
          embedding: testEmbedding,
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should create chunk without embedding', async () => {
      const mockRecord = {
        get: jest.fn(() => ({
          properties: {
            id: 'chunk_456',
            bookId: 'book1',
            text: testChunk.text,
            embedding: null,
          },
        })),
      };
      mockSession.run.mockResolvedValue({ records: [mockRecord] });

      const result = await adapter.createChunk('book1', testChunk, null, validToken);

      expect(result).toHaveProperty('embedding', null);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          embedding: null,
          embeddingModel: null,
        })
      );
    });

    it('should generate chunk ID if not provided', async () => {
      const chunkWithoutId = { ...testChunk };
      delete chunkWithoutId.id;

      const mockRecord = {
        get: jest.fn(() => ({
          properties: { id: 'chunk_generated', text: testChunk.text },
        })),
      };
      mockSession.run.mockResolvedValue({ records: [mockRecord] });

      await adapter.createChunk('book1', chunkWithoutId, null, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          chunkId: expect.stringMatching(/^chunk_/),
        })
      );
    });

    it('should return null for invalid token', async () => {
      const result = await adapter.createChunk('book1', testChunk, null, 'invalid-token');
      expect(result).toBeNull();
      expect(mockSession.run).not.toHaveBeenCalled();
    });

    it('should return null when no records returned', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await adapter.createChunk('book1', testChunk, null, validToken);
      expect(result).toBeNull();
    });

    it('should link to previous chunk via NEXT relationship', async () => {
      const chunk2 = { ...testChunk, chunkIndex: 1 };
      mockSession.run.mockResolvedValue({
        records: [
          {
            get: jest.fn(() => ({
              properties: { id: 'chunk_2', chunkIndex: 1 },
            })),
          },
        ],
      });

      await adapter.createChunk('book1', chunk2, null, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('OPTIONAL MATCH (prev:Chunk'),
        expect.objectContaining({
          prevIndex: 0,
        })
      );
    });
  });

  // ===========================================================================
  // BATCH CHUNK CREATION TESTS
  // ===========================================================================

  describe('batchCreateChunks', () => {
    const testChunks = [
      { text: 'Chunk 1 text', chunkIndex: 0, pageNum: 1 },
      { text: 'Chunk 2 text', chunkIndex: 1, pageNum: 1 },
      { text: 'Chunk 3 text', chunkIndex: 2, pageNum: 2 },
    ];
    const testEmbeddings = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
      [0.7, 0.8, 0.9],
    ];

    it('should batch create chunks with embeddings', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] }); // MERGE book
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 3) }],
      }); // Create chunks
      mockSession.run.mockResolvedValueOnce({ records: [] }); // NEXT relationships

      const result = await adapter.batchCreateChunks(
        'book1',
        testChunks,
        testEmbeddings,
        validToken
      );

      expect(result).toBe(3);
      expect(mockSession.run).toHaveBeenCalledTimes(3);

      // Check UNWIND query was called
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('UNWIND $chunks AS chunk'),
        expect.objectContaining({
          chunks: expect.arrayContaining([
            expect.objectContaining({
              text: 'Chunk 1 text',
              chunkIndex: 0,
              embedding: [0.1, 0.2, 0.3],
            }),
          ]),
        })
      );
    });

    it('should create NEXT relationships between chunks', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 3) }],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await adapter.batchCreateChunks('book1', testChunks, testEmbeddings, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (curr)-[:NEXT]->(next)'),
        expect.objectContaining({ bookId: 'book1', userId: 1 })
      );
    });

    it('should return 0 for invalid token', async () => {
      const result = await adapter.batchCreateChunks(
        'book1',
        testChunks,
        testEmbeddings,
        'invalid-token'
      );
      expect(result).toBe(0);
      expect(mockSession.run).not.toHaveBeenCalled();
    });

    it('should handle empty chunks array', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 0) }],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await adapter.batchCreateChunks('book1', [], [], validToken);
      expect(result).toBe(0);
    });

    it('should handle chunks without embeddings', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 3) }],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await adapter.batchCreateChunks('book1', testChunks, null, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('UNWIND'),
        expect.objectContaining({
          chunks: expect.arrayContaining([
            expect.objectContaining({
              embedding: null,
              embeddingModel: null,
            }),
          ]),
        })
      );
    });
  });

  // ===========================================================================
  // GET CHUNKS TESTS
  // ===========================================================================

  describe('getChunksByBook', () => {
    it('should return all chunks for a book ordered by index', async () => {
      const mockRecords = [
        { get: jest.fn(() => ({ properties: { id: 'c1', chunkIndex: 0 } })) },
        { get: jest.fn(() => ({ properties: { id: 'c2', chunkIndex: 1 } })) },
        { get: jest.fn(() => ({ properties: { id: 'c3', chunkIndex: 2 } })) },
      ];
      mockSession.run.mockResolvedValue({ records: mockRecords });

      const result = await adapter.getChunksByBook('book1', validToken);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('id', 'c1');
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:Chunk'),
        expect.objectContaining({ bookId: 'book1', userId: 1 })
      );
    });

    it('should return empty array for invalid token', async () => {
      const result = await adapter.getChunksByBook('book1', 'invalid-token');
      expect(result).toEqual([]);
    });

    it('should return empty array when no chunks found', async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      const result = await adapter.getChunksByBook('nonexistent', validToken);
      expect(result).toEqual([]);
    });
  });

  describe('getChunksWithoutEmbeddings', () => {
    it('should return only chunks without embeddings', async () => {
      const mockRecords = [
        { get: jest.fn(() => ({ properties: { id: 'c1', embedding: null } })) },
        { get: jest.fn(() => ({ properties: { id: 'c2', embedding: null } })) },
      ];
      mockSession.run.mockResolvedValue({ records: mockRecords });

      const result = await adapter.getChunksWithoutEmbeddings('book1', validToken);

      expect(result).toHaveLength(2);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.embedding IS NULL'),
        expect.any(Object)
      );
    });

    it('should return empty array for invalid token', async () => {
      const result = await adapter.getChunksWithoutEmbeddings('book1', 'invalid-token');
      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // UPDATE CHUNK EMBEDDING TESTS
  // ===========================================================================

  describe('updateChunkEmbedding', () => {
    it('should update chunk embedding', async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      const embedding = [0.1, 0.2, 0.3];

      await adapter.updateChunkEmbedding('chunk1', embedding, 'text-embedding-3-large');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET c.embedding = $embedding'),
        expect.objectContaining({
          chunkId: 'chunk1',
          embedding,
          model: 'text-embedding-3-large',
        })
      );
    });

    it('should use default model if not provided', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.updateChunkEmbedding('chunk1', [0.1, 0.2]);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: 'text-embedding-3-small',
        })
      );
    });
  });

  // ===========================================================================
  // DELETE CHUNKS TESTS
  // ===========================================================================

  describe('deleteChunksByBook', () => {
    it('should delete all chunks for a book', async () => {
      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn(() => 5) }],
      });

      const result = await adapter.deleteChunksByBook('book1', validToken);

      expect(result).toBe(5);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('DETACH DELETE c'),
        expect.objectContaining({ bookId: 'book1', userId: 1 })
      );
    });

    it('should return 0 for invalid token', async () => {
      const result = await adapter.deleteChunksByBook('book1', 'invalid-token');
      expect(result).toBe(0);
    });

    it('should return 0 when no chunks deleted', async () => {
      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn(() => 0) }],
      });

      const result = await adapter.deleteChunksByBook('nonexistent', validToken);
      expect(result).toBe(0);
    });
  });

  // ===========================================================================
  // VECTOR SEARCH TESTS
  // ===========================================================================

  describe('searchSimilarChunks', () => {
    const queryEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

    it('should search for similar chunks', async () => {
      const mockRecords = [
        {
          get: jest.fn((key) =>
            key === 'c'
              ? { properties: { id: 'c1', text: 'Similar chunk' } }
              : 0.95
          ),
        },
        {
          get: jest.fn((key) =>
            key === 'c'
              ? { properties: { id: 'c2', text: 'Another similar' } }
              : 0.85
          ),
        },
      ];
      mockSession.run.mockResolvedValue({ records: mockRecords });

      const result = await adapter.searchSimilarChunks(queryEmbedding, {}, 10, 0.7);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('chunk');
      expect(result[0]).toHaveProperty('similarity', 0.95);
      expect(result[0].chunk).toHaveProperty('id', 'c1');
    });

    it('should filter by bookId', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.searchSimilarChunks(queryEmbedding, { bookId: 'book1' });

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('c.bookId = $bookId'),
        expect.objectContaining({ bookId: 'book1' })
      );
    });

    it('should filter by userId', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.searchSimilarChunks(queryEmbedding, { userId: 1 });

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('c.userId = $userId'),
        expect.objectContaining({ userId: 1 })
      );
    });

    it('should respect minimum similarity threshold', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.searchSimilarChunks(queryEmbedding, {}, 10, 0.9);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('WHERE similarity >= $minSimilarity'),
        expect.objectContaining({ minSimilarity: 0.9 })
      );
    });

    it('should respect limit parameter', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.searchSimilarChunks(queryEmbedding, {}, 5, 0.7);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $limit'),
        expect.objectContaining({ limit: 5 })
      );
    });
  });

  // ===========================================================================
  // KEY CONCEPT TESTS
  // ===========================================================================

  describe('createKeyConcepts', () => {
    const testConcepts = [
      { name: 'Machine Learning', description: 'AI technique', category: 'AI', importance: 0.9 },
      { name: 'Neural Networks', description: 'Deep learning', category: 'AI', importance: 0.8 },
    ];

    it('should create key concepts for a book', async () => {
      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn(() => 2) }],
      });

      const result = await adapter.createKeyConcepts('book1', testConcepts, validToken);

      expect(result).toBe(2);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (k:KeyConcept'),
        expect.objectContaining({
          bookId: 'book1',
          concepts: expect.arrayContaining([
            expect.objectContaining({
              name: 'Machine Learning',
              importance: 0.9,
            }),
          ]),
        })
      );
    });

    it('should return 0 for invalid token', async () => {
      const result = await adapter.createKeyConcepts('book1', testConcepts, 'invalid-token');
      expect(result).toBe(0);
    });

    it('should generate concept IDs if not provided', async () => {
      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn(() => 1) }],
      });

      await adapter.createKeyConcepts('book1', [{ name: 'Test' }], validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          concepts: expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^concept_/),
            }),
          ]),
        })
      );
    });

    it('should use default importance if not provided', async () => {
      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn(() => 1) }],
      });

      await adapter.createKeyConcepts('book1', [{ name: 'Test' }], validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          concepts: expect.arrayContaining([
            expect.objectContaining({
              importance: 0.5,
            }),
          ]),
        })
      );
    });
  });

  describe('getKeyConceptsByBook', () => {
    it('should return concepts ordered by importance', async () => {
      const mockRecords = [
        { get: jest.fn(() => ({ properties: { id: 'k1', name: 'ML', importance: 0.9 } })) },
        { get: jest.fn(() => ({ properties: { id: 'k2', name: 'DL', importance: 0.8 } })) },
      ];
      mockSession.run.mockResolvedValue({ records: mockRecords });

      const result = await adapter.getKeyConceptsByBook('book1', validToken);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name', 'ML');
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY k.importance DESC'),
        expect.any(Object)
      );
    });

    it('should return empty array for invalid token', async () => {
      const result = await adapter.getKeyConceptsByBook('book1', 'invalid-token');
      expect(result).toEqual([]);
    });
  });

  describe('storeConceptEmbeddings', () => {
    it('should store embeddings for concepts', async () => {
      mockSession.run.mockResolvedValue({ records: [] });
      const data = [
        { conceptId: 'c1', embedding: [0.1, 0.2] },
        { conceptId: 'c2', embedding: [0.3, 0.4] },
      ];

      await adapter.storeConceptEmbeddings('book1', data);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET k.embedding = item.embedding'),
        expect.objectContaining({ data })
      );
    });
  });

  describe('tagChunksWithConcepts', () => {
    it('should create MENTIONS relationships', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.tagChunksWithConcepts('book1', 0.8, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (c)-[r:MENTIONS]->(k)'),
        expect.objectContaining({
          bookId: 'book1',
          userId: 1,
          threshold: 0.8,
        })
      );
    });

    it('should do nothing for invalid token', async () => {
      await adapter.tagChunksWithConcepts('book1', 0.8, 'invalid-token');
      expect(mockSession.run).not.toHaveBeenCalled();
    });

    it('should use default similarity threshold', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.tagChunksWithConcepts('book1', undefined, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          threshold: 0.75,
        })
      );
    });
  });

  describe('deriveConceptRelationships', () => {
    it('should create RELATED_TO and PRECEDES relationships', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.deriveConceptRelationships('book1', 2, validToken);

      // Should create RELATED_TO relationships
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (k1)-[r:RELATED_TO]->(k2)'),
        expect.any(Object)
      );

      // Should create PRECEDES relationships
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (k1)-[r:PRECEDES]->(k2)'),
        expect.any(Object)
      );
    });

    it('should do nothing for invalid token', async () => {
      await adapter.deriveConceptRelationships('book1', 2, 'invalid-token');
      expect(mockSession.run).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // LEARNING POINT TESTS
  // ===========================================================================

  describe('createLearningPoints', () => {
    const testLearningPoints = [
      {
        id: 'lp1',
        itemType: 'word',
        domainType: 'vocabulary',
        title: 'Ephemeral',
        front: { text: 'Ephemeral' },
        back: { text: 'Lasting for a very short time' },
        difficulty: 'intermediate',
        tags: ['gre', 'adjective'],
      },
      {
        itemType: 'concept',
        domainType: 'knowledge',
        title: 'Machine Learning',
        front: { text: 'What is Machine Learning?' },
        back: { text: 'A subset of AI...' },
        extras: { keyPoints: ['Data-driven', 'Pattern recognition'] },
      },
    ];

    it('should create learning points', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 2) }],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] }); // Link to chunks

      const result = await adapter.createLearningPoints('topic1', testLearningPoints, validToken);

      expect(result).toBe(2);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (l:LearningPoint'),
        expect.objectContaining({
          points: expect.arrayContaining([
            expect.objectContaining({
              id: 'lp1',
              title: 'Ephemeral',
              frontText: 'Ephemeral',
              backText: 'Lasting for a very short time',
              tags: ['gre', 'adjective'],
            }),
          ]),
        })
      );
    });

    it('should serialize extras to JSON', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 1) }],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await adapter.createLearningPoints('topic1', testLearningPoints, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          points: expect.arrayContaining([
            expect.objectContaining({
              extras: expect.stringContaining('keyPoints'),
            }),
          ]),
        })
      );
    });

    it('should link learning points to source chunks', async () => {
      const lpWithChunk = [
        { ...testLearningPoints[0], chunkId: 'chunk1' },
      ];
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 1) }],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await adapter.createLearningPoints('topic1', lpWithChunk, validToken);

      // The second call links to source chunks
      expect(mockSession.run).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('MERGE (l)-[:FROM_CHUNK]->(c)')
      );
    });

    it('should return 0 for invalid token', async () => {
      const result = await adapter.createLearningPoints(
        'topic1',
        testLearningPoints,
        'invalid-token'
      );
      expect(result).toBe(0);
    });

    it('should generate IDs if not provided', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 1) }],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await adapter.createLearningPoints('topic1', [testLearningPoints[1]], validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          points: expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^lp_/),
            }),
          ]),
        })
      );
    });

    it('should set default values for optional fields', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 1) }],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await adapter.createLearningPoints(
        'topic1',
        [{ itemType: 'word', domainType: 'vocabulary', title: 'Test', front: {}, back: {} }],
        validToken
      );

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          points: expect.arrayContaining([
            expect.objectContaining({
              difficulty: 'intermediate',
              estimatedTimeMinutes: 2,
              status: 'pending',
              masteryLevel: 0,
              reviewCount: 0,
              correctStreak: 0,
            }),
          ]),
        })
      );
    });
  });

  describe('getLearningPointsByTopic', () => {
    it('should return learning points for a topic', async () => {
      const mockRecords = [
        {
          get: jest.fn(() => ({
            properties: {
              id: 'lp1',
              title: 'Test',
              extras: '{"keyPoints":["a","b"]}',
            },
          })),
        },
      ];
      mockSession.run.mockResolvedValue({ records: mockRecords });

      const result = await adapter.getLearningPointsByTopic('topic1', {}, validToken);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('title', 'Test');
      expect(result[0].extras).toEqual({ keyPoints: ['a', 'b'] });
    });

    it('should filter by status', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.getLearningPointsByTopic('topic1', { status: 'reviewing' }, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('l.status = $status'),
        expect.objectContaining({ status: 'reviewing' })
      );
    });

    it('should filter by phase', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.getLearningPointsByTopic('topic1', { phase: 2 }, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('l.phase = $phase'),
        expect.objectContaining({ phase: 2 })
      );
    });

    it('should filter by scheduledDay', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.getLearningPointsByTopic('topic1', { scheduledDay: 5 }, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('l.scheduledDay = $scheduledDay'),
        expect.objectContaining({ scheduledDay: 5 })
      );
    });

    it('should return empty array for invalid token', async () => {
      const result = await adapter.getLearningPointsByTopic('topic1', {}, 'invalid-token');
      expect(result).toEqual([]);
    });

    it('should handle invalid JSON in extras', async () => {
      const mockRecords = [
        {
          get: jest.fn(() => ({
            properties: {
              id: 'lp1',
              extras: 'invalid json',
            },
          })),
        },
      ];
      mockSession.run.mockResolvedValue({ records: mockRecords });

      const result = await adapter.getLearningPointsByTopic('topic1', {}, validToken);

      expect(result[0].extras).toBeNull();
    });
  });

  describe('updateLearningPointAfterReview', () => {
    it('should update learning point after correct answer', async () => {
      const mockRecord = {
        get: jest.fn(() => ({
          properties: {
            id: 'lp1',
            reviewCount: 1,
            correctStreak: 1,
            masteryLevel: 12,
            status: 'reviewing',
          },
        })),
      };
      mockSession.run.mockResolvedValue({ records: [mockRecord] });

      const result = await adapter.updateLearningPointAfterReview('lp1', {
        wasCorrect: true,
      });

      expect(result).toHaveProperty('correctStreak', 1);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('l.correctStreak + 1'),
        expect.objectContaining({
          id: 'lp1',
          wasCorrect: true,
        })
      );
    });

    it('should reset streak after incorrect answer', async () => {
      const mockRecord = {
        get: jest.fn(() => ({
          properties: {
            id: 'lp1',
            reviewCount: 2,
            correctStreak: 0,
            masteryLevel: 5,
          },
        })),
      };
      mockSession.run.mockResolvedValue({ records: [mockRecord] });

      const result = await adapter.updateLearningPointAfterReview('lp1', {
        wasCorrect: false,
      });

      expect(result).toHaveProperty('correctStreak', 0);
    });

    it('should return null when learning point not found', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await adapter.updateLearningPointAfterReview('nonexistent', {
        wasCorrect: true,
      });

      expect(result).toBeNull();
    });

    it('should update status based on mastery and review count', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.updateLearningPointAfterReview('lp1', { wasCorrect: true });

      // Check the query includes status update logic
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining("WHEN l.masteryLevel >= 90 AND l.reviewCount >= 5 THEN 'mastered'"),
        expect.any(Object)
      );
    });
  });

  describe('getLearningPointsDueForReview', () => {
    it('should return learning points due for review', async () => {
      const mockRecords = [
        { get: jest.fn(() => ({ properties: { id: 'lp1', nextReviewAt: null } })) },
        { get: jest.fn(() => ({ properties: { id: 'lp2', nextReviewAt: '2024-01-01' } })) },
      ];
      mockSession.run.mockResolvedValue({ records: mockRecords });

      const result = await adapter.getLearningPointsDueForReview(null, 20, validToken);

      expect(result).toHaveLength(2);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('l.nextReviewAt IS NULL OR l.nextReviewAt <= datetime()'),
        expect.objectContaining({ userId: 1, limit: 20 })
      );
    });

    it('should filter by topic when provided', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.getLearningPointsDueForReview('topic1', 10, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('l.topicId = $topicId'),
        expect.objectContaining({ topicId: 'topic1' })
      );
    });

    it('should return empty array for invalid token', async () => {
      const result = await adapter.getLearningPointsDueForReview(null, 20, 'invalid-token');
      expect(result).toEqual([]);
    });

    it('should order by nextReviewAt and masteryLevel', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.getLearningPointsDueForReview(null, 20, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY l.nextReviewAt ASC, l.masteryLevel ASC'),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('Error Handling', () => {
    it('should throw error when not connected', async () => {
      adapter.isConnected = false;
      adapter.driver = null;

      expect(() => adapter.getSession()).toThrow('Not connected to Neo4j');
    });

    it('should close session on chunk creation error', async () => {
      mockSession.run.mockRejectedValue(new Error('Database error'));

      await expect(
        adapter.createChunk('book1', { text: 'test', chunkIndex: 0 }, null, validToken)
      ).rejects.toThrow('Database error');

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should close session on batch creation error', async () => {
      mockSession.run.mockRejectedValue(new Error('Batch error'));

      await expect(
        adapter.batchCreateChunks('book1', [{ text: 'test', chunkIndex: 0 }], null, validToken)
      ).rejects.toThrow('Batch error');

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should close session on search error', async () => {
      mockSession.run.mockRejectedValue(new Error('Search error'));

      await expect(
        adapter.searchSimilarChunks([0.1, 0.2], {})
      ).rejects.toThrow('Search error');

      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle very long text in chunks', async () => {
      const longText = 'a'.repeat(100000);
      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn(() => ({ properties: { id: 'c1', text: longText } })) }],
      });

      const result = await adapter.createChunk(
        'book1',
        { text: longText, chunkIndex: 0 },
        null,
        validToken
      );

      expect(result).toHaveProperty('text', longText);
    });

    it('should handle special characters in chunk text', async () => {
      const specialText = 'Test with "quotes" and \'apostrophes\' and \\ backslashes';
      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn(() => ({ properties: { id: 'c1', text: specialText } })) }],
      });

      const result = await adapter.createChunk(
        'book1',
        { text: specialText, chunkIndex: 0 },
        null,
        validToken
      );

      expect(result).toHaveProperty('text', specialText);
    });

    it('should handle unicode in learning point titles', async () => {
      const unicodeTitle = '中文标题 with 日本語 and émojis 🎉';
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn(() => 1) }],
      });
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await adapter.createLearningPoints(
        'topic1',
        [{ itemType: 'word', domainType: 'vocabulary', title: unicodeTitle, front: {}, back: {} }],
        validToken
      );

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          points: expect.arrayContaining([
            expect.objectContaining({ title: unicodeTitle }),
          ]),
        })
      );
    });

    it('should handle empty embedding array', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.searchSimilarChunks([], {});

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ queryEmbedding: [] })
      );
    });

    it('should handle numeric book IDs', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      await adapter.getChunksByBook(12345, validToken);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ bookId: '12345' })
      );
    });
  });
});
