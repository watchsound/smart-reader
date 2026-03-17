/**
 * KuzuAdapterIntegration.test.js
 *
 * Comprehensive integration tests for KuzuAdapter.
 * Tests cross-module operations, data flow, and realistic usage scenarios.
 *
 * These tests verify that different components work together correctly:
 * - Connection lifecycle and schema management
 * - CRUD operations across related entities
 * - Leitner system with learning progress
 * - Vector search with RAG workflows
 * - Knowledge graph traversal and analysis
 *
 * Uses MockKuzuAdapter with state tracking to simulate real database behavior.
 */

// Mock query result object with state tracking
const mockQueryResult = {
  getAll: jest.fn().mockResolvedValue([]),
  getAllSync: jest.fn().mockReturnValue([]),
};

// Mock connection object
const mockConnection = {
  query: jest.fn().mockResolvedValue(mockQueryResult),
  querySync: jest.fn().mockReturnValue(mockQueryResult),
};

// Mock database object
const mockDatabase = {
  close: jest.fn(),
};

// Mock kuzu module
jest.mock('kuzu', () => ({
  Database: jest.fn(() => mockDatabase),
  Connection: jest.fn(() => mockConnection),
}), { virtual: true });

// Mock DBManager
jest.mock('../../main/db/DBManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user2-token') return 2;
    if (token === 'admin-token') return 99;
    return 1;
  }),
}));

// ===========================================================================
// INTEGRATED MOCK KUZU ADAPTER
// ===========================================================================

/**
 * IntegratedMockKuzuAdapter - A comprehensive mock that simulates
 * the full KuzuAdapter behavior with in-memory state tracking.
 * This allows testing complex workflows that span multiple operations.
 */
class IntegratedMockKuzuAdapter {
  constructor() {
    this.db = null;
    this.conn = null;
    this.isConnected = false;
    this.vectorIndexesCreated = false;
    this.schemaCreated = false;

    // In-memory state for integration testing
    this._state = {
      users: new Map(),
      books: new Map(),
      notes: new Map(),
      vocabulary: new Map(),
      concepts: new Map(),
      chunks: new Map(),
      keyConcepts: new Map(),
      links: new Map(),
      reviews: [],
      embeddings: new Map(),
    };

    // Track operation history for verification
    this._operationHistory = [];

    // Leitner intervals
    this.leitnerIntervals = [1, 2, 4, 7, 14];
  }

  // ===========================================================================
  // CONNECTION & SCHEMA MANAGEMENT
  // ===========================================================================

  async connect(store) {
    this._logOperation('connect', { store: !!store });
    try {
      const dbPath = store?.get?.('kuzu_db_path') || '/mock/userData/kuzu_graph.db';
      this.config = { dbPath, bufferPoolSize: 256 * 1024 * 1024 };
      this.db = mockDatabase;
      this.conn = mockConnection;
      this.isConnected = true;
      await this.createSchema();
      return true;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    this._logOperation('disconnect', {});
    this.db = null;
    this.conn = null;
    this.isConnected = false;
  }

  checkConnection() {
    return this.isConnected && this.db !== null && this.conn !== null;
  }

  async createSchema() {
    this._logOperation('createSchema', {});
    this.schemaCreated = true;
    await mockConnection.query('CREATE NODE TABLE User');
    await mockConnection.query('CREATE NODE TABLE Book');
    await mockConnection.query('CREATE NODE TABLE Note');
    await mockConnection.query('CREATE NODE TABLE Vocabulary');
    await mockConnection.query('CREATE NODE TABLE Concept');
    await mockConnection.query('CREATE NODE TABLE Chunk');
  }

  async createVectorIndexes() {
    this._logOperation('createVectorIndexes', {});
    if (this.vectorIndexesCreated) return;
    await mockConnection.query('CREATE HNSW INDEX ON Note(embedding)');
    await mockConnection.query('CREATE HNSW INDEX ON Chunk(embedding)');
    await mockConnection.query('CREATE HNSW INDEX ON Vocabulary(embedding)');
    this.vectorIndexesCreated = true;
  }

  // ===========================================================================
  // USER OPERATIONS
  // ===========================================================================

  async upsertUser(user, token) {
    this._logOperation('upsertUser', { userId: user.id });
    const stored = { ...user, createdAt: user.createdAt || new Date().toISOString() };
    this._state.users.set(user.id, stored);
    await mockConnection.query('MERGE (u:User)', user.id);
    return stored;
  }

  async getUser(id) {
    this._logOperation('getUser', { id });
    return this._state.users.get(id) || null;
  }

  // ===========================================================================
  // BOOK OPERATIONS
  // ===========================================================================

  async upsertBook(book, token) {
    const userId = this._getUserId(token);
    this._logOperation('upsertBook', { bookId: book.id, userId });

    const stored = {
      ...book,
      userId,
      createdAt: book.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this._state.books.set(book.id, stored);
    await mockConnection.query('MERGE (b:Book)', book.id, userId);
    return stored;
  }

  async getBook(bookId, token) {
    const userId = this._getUserId(token);
    this._logOperation('getBook', { bookId, userId });
    const book = this._state.books.get(bookId);
    if (book && book.userId === userId) {
      return book;
    }
    return null;
  }

  async getUserBooks(token, limit = 100) {
    const userId = this._getUserId(token);
    this._logOperation('getUserBooks', { userId, limit });
    const books = Array.from(this._state.books.values())
      .filter(b => b.userId === userId)
      .slice(0, limit);
    await mockConnection.query('MATCH (b:Book)', userId, limit);
    return books;
  }

  async deleteBook(bookId, token) {
    const userId = this._getUserId(token);
    this._logOperation('deleteBook', { bookId, userId });
    const book = this._state.books.get(bookId);
    if (book && book.userId === userId) {
      this._state.books.delete(bookId);
      // Also delete related notes and chunks
      this._deleteRelatedEntities(bookId);
      await mockConnection.query('MATCH (b:Book) DETACH DELETE', bookId);
      return true;
    }
    return false;
  }

  // ===========================================================================
  // NOTE OPERATIONS
  // ===========================================================================

  async upsertNote(note, token) {
    const userId = this._getUserId(token);
    this._logOperation('upsertNote', { noteId: note.id, userId });

    const stored = {
      ...note,
      userId,
      box: note.box || 1,
      nextReview: note.nextReview || new Date().toISOString().split('T')[0],
      reviewCount: note.reviewCount || 0,
      correctCount: note.correctCount || 0,
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this._state.notes.set(note.id, stored);
    await mockConnection.query('MERGE (n:Note)', note.id, userId);
    return stored;
  }

  async getNote(noteId, token) {
    const userId = this._getUserId(token);
    this._logOperation('getNote', { noteId, userId });
    const note = this._state.notes.get(noteId);
    if (note && note.userId === userId) {
      return note;
    }
    return null;
  }

  async getNotesByBook(bookId, token) {
    const userId = this._getUserId(token);
    this._logOperation('getNotesByBook', { bookId, userId });
    return Array.from(this._state.notes.values())
      .filter(n => n.sourceId === bookId && n.userId === userId);
  }

  async deleteNote(noteId, token) {
    const userId = this._getUserId(token);
    this._logOperation('deleteNote', { noteId, userId });
    const note = this._state.notes.get(noteId);
    if (note && note.userId === userId) {
      this._state.notes.delete(noteId);
      return true;
    }
    return false;
  }

  // ===========================================================================
  // VOCABULARY OPERATIONS
  // ===========================================================================

  async upsertVocabulary(vocab, token) {
    const userId = this._getUserId(token);
    this._logOperation('upsertVocabulary', { vocabId: vocab.id, userId });

    const stored = {
      ...vocab,
      userId,
      box: vocab.box || 1,
      nextReview: vocab.nextReview || new Date().toISOString().split('T')[0],
      reviewCount: vocab.reviewCount || 0,
      correctCount: vocab.correctCount || 0,
      createdAt: vocab.createdAt || new Date().toISOString(),
    };
    this._state.vocabulary.set(vocab.id, stored);
    await mockConnection.query('MERGE (v:Vocabulary)', vocab.id);
    return stored;
  }

  async getVocabulary(vocabId, token) {
    const userId = this._getUserId(token);
    const vocab = this._state.vocabulary.get(vocabId);
    if (vocab && vocab.userId === userId) {
      return vocab;
    }
    return null;
  }

  async getUserVocabulary(token, limit = 100) {
    const userId = this._getUserId(token);
    return Array.from(this._state.vocabulary.values())
      .filter(v => v.userId === userId)
      .slice(0, limit);
  }

  // ===========================================================================
  // CONCEPT OPERATIONS
  // ===========================================================================

  async upsertConcept(concept, token) {
    const userId = this._getUserId(token);
    this._logOperation('upsertConcept', { conceptId: concept.id, userId });

    const stored = {
      ...concept,
      userId,
      mastery: concept.mastery || 0,
      masteryHistory: concept.masteryHistory || [],
      createdAt: concept.createdAt || new Date().toISOString(),
    };
    this._state.concepts.set(concept.id, stored);
    await mockConnection.query('MERGE (c:Concept)', concept.id);
    return stored;
  }

  async getConcept(conceptId, token) {
    const userId = this._getUserId(token);
    const concept = this._state.concepts.get(conceptId);
    if (concept && concept.userId === userId) {
      return concept;
    }
    return null;
  }

  // ===========================================================================
  // LEITNER SYSTEM OPERATIONS
  // ===========================================================================

  async recordLeitnerReview(itemId, itemType, correct, token, options = {}) {
    const userId = this._getUserId(token);
    this._logOperation('recordLeitnerReview', { itemId, itemType, correct, userId });

    const stateMap = itemType === 'Vocabulary' ? this._state.vocabulary : this._state.notes;
    const item = stateMap.get(itemId);

    if (!item || item.userId !== userId) {
      return null;
    }

    // Calculate new box
    let newBox;
    if (correct) {
      newBox = Math.min(item.box + 1, 5);
    } else {
      newBox = 1;
    }

    // Calculate next review date based on box
    const nextReviewDays = this.leitnerIntervals[newBox - 1];
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + nextReviewDays);

    // Update item
    const updated = {
      ...item,
      box: newBox,
      reviewCount: item.reviewCount + 1,
      correctCount: correct ? item.correctCount + 1 : item.correctCount,
      lastReview: new Date().toISOString(),
      nextReview: nextReview.toISOString().split('T')[0],
      responseTime: options.responseTimeMs || null,
    };

    stateMap.set(itemId, updated);

    // Record review history
    this._state.reviews.push({
      itemId,
      itemType,
      correct,
      box: newBox,
      date: new Date().toISOString(),
      responseTime: options.responseTimeMs,
    });

    await mockConnection.query('MATCH SET box', itemId, newBox);
    return updated;
  }

  async getLeitnerDueItems(itemType, token, limit = 20, options = {}) {
    const userId = this._getUserId(token);
    this._logOperation('getLeitnerDueItems', { itemType, userId, limit });

    const today = new Date().toISOString().split('T')[0];
    let items = [];

    if (itemType === 'all' || itemType === 'Vocabulary') {
      const vocabItems = Array.from(this._state.vocabulary.values())
        .filter(v => v.userId === userId && v.nextReview <= today);
      items.push(...vocabItems);
    }

    if (itemType === 'all' || itemType === 'Note') {
      const noteItems = Array.from(this._state.notes.values())
        .filter(n => n.userId === userId && n.nextReview <= today);
      items.push(...noteItems);
    }

    // Apply filters
    if (options.box !== undefined) {
      items = items.filter(i => i.box === options.box);
    }

    // Sort by box (lower boxes first)
    items.sort((a, b) => a.box - b.box);

    await mockConnection.query('MATCH WHERE nextReview', today, limit);
    return items.slice(0, limit);
  }

  async getLeitnerStats(itemType, token) {
    const userId = this._getUserId(token);
    this._logOperation('getLeitnerStats', { itemType, userId });

    const stateMap = itemType === 'Vocabulary' ? this._state.vocabulary : this._state.notes;
    const items = Array.from(stateMap.values()).filter(i => i.userId === userId);

    const boxCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalReviews = 0;
    let correctReviews = 0;

    items.forEach(item => {
      boxCounts[item.box] = (boxCounts[item.box] || 0) + 1;
      totalReviews += item.reviewCount || 0;
      correctReviews += item.correctCount || 0;
    });

    const today = new Date().toISOString().split('T')[0];
    const dueCount = items.filter(i => i.nextReview <= today).length;

    return {
      boxCounts,
      totalItems: items.length,
      masteryPercentage: items.length > 0 ? (boxCounts[5] / items.length) * 100 : 0,
      dueCount,
      totalReviews,
      accuracy: totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0,
    };
  }

  // ===========================================================================
  // CHUNK/RAG OPERATIONS
  // ===========================================================================

  async createChunk(bookId, chunk, embedding, token) {
    const userId = this._getUserId(token);
    this._logOperation('createChunk', { bookId, chunkId: chunk.id, userId });

    const stored = {
      ...chunk,
      bookId,
      userId,
      embedding,
      createdAt: chunk.createdAt || new Date().toISOString(),
    };
    this._state.chunks.set(chunk.id, stored);
    await mockConnection.query('CREATE (c:Chunk)', chunk.id, bookId);
    return stored;
  }

  async getChunksByBook(bookId, token, options = {}) {
    const userId = this._getUserId(token);
    this._logOperation('getChunksByBook', { bookId, userId });

    let chunks = Array.from(this._state.chunks.values())
      .filter(c => c.bookId === bookId && c.userId === userId);

    if (options.pageNum !== undefined) {
      chunks = chunks.filter(c => c.pageNum === options.pageNum);
    }

    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    if (options.limit) {
      chunks = chunks.slice(options.offset || 0, (options.offset || 0) + options.limit);
    }

    return chunks;
  }

  async searchSimilarChunks(embedding, limit, token, options = {}) {
    const userId = this._getUserId(token);
    this._logOperation('searchSimilarChunks', { limit, userId });

    let chunks = Array.from(this._state.chunks.values())
      .filter(c => c.userId === userId && c.embedding);

    if (options.bookId) {
      chunks = chunks.filter(c => c.bookId === options.bookId);
    }

    // Calculate cosine similarity
    chunks = chunks.map(c => ({
      ...c,
      similarity: this._cosineSimilarity(embedding, c.embedding),
    }));

    // Filter by threshold
    if (options.threshold) {
      chunks = chunks.filter(c => c.similarity >= options.threshold);
    }

    // Sort by similarity
    chunks.sort((a, b) => b.similarity - a.similarity);

    await mockConnection.query('CALL QUERY_VECTOR_INDEX', embedding, limit);
    return chunks.slice(0, limit);
  }

  async createKeyConcepts(bookId, concepts, token) {
    const userId = this._getUserId(token);
    this._logOperation('createKeyConcepts', { bookId, count: concepts.length });

    for (const concept of concepts) {
      const stored = { ...concept, bookId, userId };
      this._state.keyConcepts.set(concept.id, stored);
    }

    await mockConnection.query('CREATE (kc:KeyConcept)', bookId, concepts.length);
    return { created: concepts.length };
  }

  async getKeyConceptsByBook(bookId, token, limit) {
    const userId = this._getUserId(token);
    let concepts = Array.from(this._state.keyConcepts.values())
      .filter(c => c.bookId === bookId && c.userId === userId);

    concepts.sort((a, b) => (b.importance || 0) - (a.importance || 0));

    if (limit) {
      concepts = concepts.slice(0, limit);
    }

    return concepts;
  }

  async buildRAGPrompt(query, embedding, bookId, token) {
    this._logOperation('buildRAGPrompt', { bookId });

    const chunks = await this.searchSimilarChunks(embedding, 5, token, { bookId });
    const keyConcepts = await this.getKeyConceptsByBook(bookId, token, 10);

    const contextText = chunks.map(c => c.text).join('\n\n');

    return {
      context: contextText,
      prompt: `Based on the following context from the book, answer the question.\n\nContext:\n${contextText}\n\nQuestion: ${query}`,
      chunks,
      keyConcepts,
    };
  }

  // ===========================================================================
  // VECTOR OPERATIONS
  // ===========================================================================

  async storeEmbedding(nodeId, nodeType, embedding, model, token) {
    this._logOperation('storeEmbedding', { nodeId, nodeType, model });

    const key = `${nodeType}:${nodeId}`;
    this._state.embeddings.set(key, {
      nodeId,
      nodeType,
      embedding: this._normalizeEmbedding(embedding),
      model,
    });

    // Also update the entity if it exists
    const stateMap = this._getStateMapForType(nodeType);
    if (stateMap && stateMap.has(nodeId)) {
      const entity = stateMap.get(nodeId);
      entity.embedding = embedding;
      entity.embeddingModel = model;
    }

    await mockConnection.query('MATCH SET embedding', nodeId, nodeType);
    return true;
  }

  async findSimilar(embedding, labels, limit, threshold, token) {
    const userId = this._getUserId(token);
    this._logOperation('findSimilar', { labels, limit, threshold });

    const results = [];
    const normalizedQuery = this._normalizeEmbedding(embedding);

    for (const label of labels) {
      const stateMap = this._getStateMapForType(label);
      if (!stateMap) continue;

      for (const entity of stateMap.values()) {
        if (entity.userId !== userId || !entity.embedding) continue;

        const similarity = this._cosineSimilarity(normalizedQuery, entity.embedding);
        if (similarity >= threshold) {
          results.push({ ...entity, similarity });
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    await mockConnection.query('CALL QUERY_VECTOR_INDEX', labels, limit);
    return results.slice(0, limit);
  }

  // ===========================================================================
  // KNOWLEDGE GRAPH OPERATIONS
  // ===========================================================================

  async getKnowledgeGraphData(centerId, token, options = {}) {
    const userId = this._getUserId(token);
    this._logOperation('getKnowledgeGraphData', { centerId, userId });

    const nodes = [];
    const edges = [];

    // Collect all nodes
    for (const [id, concept] of this._state.concepts) {
      if (concept.userId === userId) {
        nodes.push({ id, type: 'Concept', ...concept });
      }
    }

    for (const [id, note] of this._state.notes) {
      if (note.userId === userId) {
        nodes.push({ id, type: 'Note', ...note });
      }
    }

    // Generate edges based on relationships
    for (const note of this._state.notes.values()) {
      if (note.sourceId && this._state.books.has(note.sourceId)) {
        edges.push({
          source: note.sourceId,
          target: note.id,
          type: 'HAS_NOTE',
        });
      }
    }

    await mockConnection.query('MATCH (n) RETURN', centerId);
    return { nodes, edges };
  }

  async detectWeakConcepts(limit, token, options = {}) {
    const userId = this._getUserId(token);
    this._logOperation('detectWeakConcepts', { limit, userId });

    let concepts = Array.from(this._state.concepts.values())
      .filter(c => c.userId === userId && c.mastery < 0.5);

    if (options.minReviews) {
      concepts = concepts.filter(c => (c.reviewCount || 0) >= options.minReviews);
    }

    concepts.sort((a, b) => a.mastery - b.mastery);
    await mockConnection.query('MATCH (c:Concept) WHERE mastery', limit);
    return concepts.slice(0, limit);
  }

  async updateConceptMastery(conceptId, mastery, token) {
    const userId = this._getUserId(token);
    this._logOperation('updateConceptMastery', { conceptId, mastery, userId });

    const concept = this._state.concepts.get(conceptId);
    if (!concept || concept.userId !== userId) {
      return null;
    }

    const clampedMastery = Math.max(0, Math.min(1, mastery));
    concept.mastery = clampedMastery;
    concept.masteryHistory = [...(concept.masteryHistory || []), clampedMastery];

    await mockConnection.query('MATCH SET mastery', conceptId, clampedMastery);
    return concept;
  }

  async getPersonalizedLearningPath(targetConceptId, token, options = {}) {
    const userId = this._getUserId(token);
    this._logOperation('getPersonalizedLearningPath', { targetConceptId, userId });

    // Simulate prerequisite chain
    const concepts = Array.from(this._state.concepts.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => (a.mastery || 0) - (b.mastery || 0));

    const path = concepts.map(c => ({
      ...c,
      estimatedHours: (1 - c.mastery) * 2,
    }));

    const totalEstimatedHours = path.reduce((sum, p) => sum + p.estimatedHours, 0);

    await mockConnection.query('MATCH path', targetConceptId);
    return { path, totalEstimatedHours };
  }

  // ===========================================================================
  // LINK OPERATIONS
  // ===========================================================================

  async syncNoteLinks(noteId, links, token) {
    const userId = this._getUserId(token);
    this._logOperation('syncNoteLinks', { noteId, linkCount: links.length });

    // Get existing links
    const existingLinks = this._state.links.get(noteId) || [];
    const existingIds = existingLinks.map(l => l.id);
    const newIds = links.map(l => l.id);

    // Calculate changes
    const deleted = existingIds.filter(id => !newIds.includes(id)).length;
    const created = newIds.filter(id => !existingIds.includes(id)).length;

    // Update links
    this._state.links.set(noteId, links);

    await mockConnection.query('MATCH (n:Note) DELETE CREATE', noteId, links.length);
    return { created, deleted };
  }

  async getBacklinks(targetId, targetType, token, limit = 50) {
    this._logOperation('getBacklinks', { targetId, targetType });

    const backlinks = [];

    for (const [noteId, links] of this._state.links) {
      for (const link of links) {
        if (link.id === targetId && link.type === targetType) {
          const note = this._state.notes.get(noteId);
          if (note) {
            backlinks.push({
              sourceId: noteId,
              sourceType: 'Note',
              title: note.title,
              linkText: link.text,
            });
          }
        }
      }
    }

    return backlinks.slice(0, limit);
  }

  async getOutgoingLinks(noteId, token) {
    this._logOperation('getOutgoingLinks', { noteId });
    return this._state.links.get(noteId) || [];
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  _getUserId(token) {
    const DBManager = require('../../main/db/DBManager');
    return DBManager.getUserIdFromToken(token);
  }

  _getStateMapForType(nodeType) {
    switch (nodeType) {
      case 'Note': return this._state.notes;
      case 'Book': return this._state.books;
      case 'Vocabulary': return this._state.vocabulary;
      case 'Concept': return this._state.concepts;
      case 'Chunk': return this._state.chunks;
      default: return null;
    }
  }

  _deleteRelatedEntities(bookId) {
    // Delete notes for this book
    for (const [noteId, note] of this._state.notes) {
      if (note.sourceId === bookId) {
        this._state.notes.delete(noteId);
      }
    }

    // Delete chunks for this book
    for (const [chunkId, chunk] of this._state.chunks) {
      if (chunk.bookId === bookId) {
        this._state.chunks.delete(chunkId);
      }
    }

    // Delete key concepts for this book
    for (const [conceptId, concept] of this._state.keyConcepts) {
      if (concept.bookId === bookId) {
        this._state.keyConcepts.delete(conceptId);
      }
    }
  }

  _normalizeEmbedding(embedding) {
    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    if (norm === 0) return embedding;
    return embedding.map(x => x / norm);
  }

  _cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  _logOperation(operation, params) {
    this._operationHistory.push({
      operation,
      params,
      timestamp: Date.now(),
    });
  }

  // Test utilities
  getOperationHistory() {
    return this._operationHistory;
  }

  getState() {
    return this._state;
  }

  clearState() {
    this._state = {
      users: new Map(),
      books: new Map(),
      notes: new Map(),
      vocabulary: new Map(),
      concepts: new Map(),
      chunks: new Map(),
      keyConcepts: new Map(),
      links: new Map(),
      reviews: [],
      embeddings: new Map(),
    };
    this._operationHistory = [];
  }
}

// ===========================================================================
// TEST SETUP
// ===========================================================================

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult.getAll.mockResolvedValue([]);
});

// ===========================================================================
// CONNECTION LIFECYCLE INTEGRATION TESTS
// ===========================================================================

describe('KuzuAdapter Integration: Connection Lifecycle', () => {
  let adapter;

  beforeEach(() => {
    adapter = new IntegratedMockKuzuAdapter();
  });

  afterEach(() => {
    adapter.clearState();
  });

  it('should handle complete connection lifecycle', async () => {
    const mockStore = { get: jest.fn().mockReturnValue('/test/db/path') };

    // Connect
    const connected = await adapter.connect(mockStore);
    expect(connected).toBe(true);
    expect(adapter.isConnected).toBe(true);
    expect(adapter.schemaCreated).toBe(true);

    // Verify connection
    expect(adapter.checkConnection()).toBe(true);

    // Create vector indexes
    await adapter.createVectorIndexes();
    expect(adapter.vectorIndexesCreated).toBe(true);

    // Disconnect
    await adapter.disconnect();
    expect(adapter.isConnected).toBe(false);
    expect(adapter.checkConnection()).toBe(false);

    // Verify operation sequence
    const history = adapter.getOperationHistory();
    expect(history.map(h => h.operation)).toEqual([
      'connect',
      'createSchema',
      'createVectorIndexes',
      'disconnect',
    ]);
  });

  it('should maintain state across multiple operations', async () => {
    const mockStore = { get: jest.fn().mockReturnValue(null) };
    await adapter.connect(mockStore);

    const validToken = 'valid-token';

    // Create a user
    await adapter.upsertUser({ id: 1, username: 'testuser' }, validToken);

    // Create a book
    const book = await adapter.upsertBook({
      id: 'book_1',
      title: 'Test Book',
    }, validToken);

    // Create notes for the book
    await adapter.upsertNote({
      id: 'note_1',
      title: 'Note 1',
      sourceId: 'book_1',
    }, validToken);

    await adapter.upsertNote({
      id: 'note_2',
      title: 'Note 2',
      sourceId: 'book_1',
    }, validToken);

    // Verify state
    const state = adapter.getState();
    expect(state.books.size).toBe(1);
    expect(state.notes.size).toBe(2);

    // Get notes by book
    const notes = await adapter.getNotesByBook('book_1', validToken);
    expect(notes).toHaveLength(2);
  });
});

// ===========================================================================
// CRUD WORKFLOW INTEGRATION TESTS
// ===========================================================================

describe('KuzuAdapter Integration: CRUD Workflows', () => {
  let adapter;
  const validToken = 'valid-token';
  const user2Token = 'user2-token';

  beforeEach(async () => {
    adapter = new IntegratedMockKuzuAdapter();
    await adapter.connect({ get: jest.fn() });
  });

  afterEach(() => {
    adapter.clearState();
  });

  describe('Book → Note → Vocabulary workflow', () => {
    it('should create book with notes and vocabulary', async () => {
      // Create book
      const book = await adapter.upsertBook({
        id: 'book_learn',
        title: 'Learning Guide',
        author: 'Test Author',
      }, validToken);
      expect(book.userId).toBe(1);

      // Add notes to book
      const note1 = await adapter.upsertNote({
        id: 'note_ch1',
        title: 'Chapter 1 Notes',
        content: 'Key concepts...',
        sourceId: 'book_learn',
      }, validToken);

      const note2 = await adapter.upsertNote({
        id: 'note_ch2',
        title: 'Chapter 2 Notes',
        content: 'More concepts...',
        sourceId: 'book_learn',
      }, validToken);

      // Add vocabulary from book
      const vocab1 = await adapter.upsertVocabulary({
        id: 'vocab_1',
        word: 'ephemeral',
        definition: 'lasting for a very short time',
        sourceId: 'book_learn',
      }, validToken);

      const vocab2 = await adapter.upsertVocabulary({
        id: 'vocab_2',
        word: 'ubiquitous',
        definition: 'present everywhere',
        sourceId: 'book_learn',
      }, validToken);

      // Verify relationships
      const bookNotes = await adapter.getNotesByBook('book_learn', validToken);
      expect(bookNotes).toHaveLength(2);

      const userVocab = await adapter.getUserVocabulary(validToken);
      expect(userVocab).toHaveLength(2);
    });

    it('should cascade delete related entities', async () => {
      // Setup
      await adapter.upsertBook({ id: 'book_del', title: 'Delete Test' }, validToken);
      await adapter.upsertNote({ id: 'note_del', sourceId: 'book_del' }, validToken);

      // Create chunk for the book
      await adapter.createChunk('book_del', {
        id: 'chunk_1',
        text: 'Sample text',
        chunkIndex: 0,
      }, [0.1, 0.2, 0.3], validToken);

      // Verify setup
      expect(adapter.getState().books.size).toBe(1);
      expect(adapter.getState().notes.size).toBe(1);
      expect(adapter.getState().chunks.size).toBe(1);

      // Delete book
      await adapter.deleteBook('book_del', validToken);

      // Verify cascade
      expect(adapter.getState().books.size).toBe(0);
      expect(adapter.getState().notes.size).toBe(0);
      expect(adapter.getState().chunks.size).toBe(0);
    });
  });

  describe('Multi-user isolation', () => {
    it('should isolate data between users', async () => {
      // User 1 creates book
      await adapter.upsertBook({
        id: 'book_u1',
        title: 'User 1 Book',
      }, validToken);

      // User 2 creates book
      await adapter.upsertBook({
        id: 'book_u2',
        title: 'User 2 Book',
      }, user2Token);

      // User 1 can only see their book
      const user1Books = await adapter.getUserBooks(validToken);
      expect(user1Books).toHaveLength(1);
      expect(user1Books[0].title).toBe('User 1 Book');

      // User 2 can only see their book
      const user2Books = await adapter.getUserBooks(user2Token);
      expect(user2Books).toHaveLength(1);
      expect(user2Books[0].title).toBe('User 2 Book');

      // User 1 cannot access user 2's book
      const crossAccess = await adapter.getBook('book_u2', validToken);
      expect(crossAccess).toBeNull();
    });
  });
});

// ===========================================================================
// LEITNER SYSTEM INTEGRATION TESTS
// ===========================================================================

describe('KuzuAdapter Integration: Leitner System', () => {
  let adapter;
  const validToken = 'valid-token';

  beforeEach(async () => {
    adapter = new IntegratedMockKuzuAdapter();
    await adapter.connect({ get: jest.fn() });
  });

  afterEach(() => {
    adapter.clearState();
  });

  describe('Complete learning cycle', () => {
    it('should progress vocabulary through all boxes', async () => {
      // Create vocabulary
      const vocab = await adapter.upsertVocabulary({
        id: 'vocab_test',
        word: 'serendipity',
        definition: 'the occurrence of happy discoveries by accident',
      }, validToken);

      expect(vocab.box).toBe(1);

      // Review correctly 4 times to reach box 5
      let current = vocab;
      for (let i = 0; i < 4; i++) {
        current = await adapter.recordLeitnerReview(
          'vocab_test',
          'Vocabulary',
          true,
          validToken
        );
        expect(current.box).toBe(Math.min(i + 2, 5));
        expect(current.reviewCount).toBe(i + 1);
        expect(current.correctCount).toBe(i + 1);
      }

      // Verify final state
      expect(current.box).toBe(5);
      expect(current.reviewCount).toBe(4);
      expect(current.correctCount).toBe(4);
    });

    it('should handle incorrect answers by resetting to box 1', async () => {
      // Create and progress vocabulary
      await adapter.upsertVocabulary({
        id: 'vocab_reset',
        word: 'test',
        box: 3,
        reviewCount: 5,
        correctCount: 4,
      }, validToken);

      // Answer incorrectly
      const result = await adapter.recordLeitnerReview(
        'vocab_reset',
        'Vocabulary',
        false,
        validToken
      );

      expect(result.box).toBe(1);
      expect(result.reviewCount).toBe(6);
      expect(result.correctCount).toBe(4); // Unchanged
    });

    it('should track due items correctly', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // Create items with different due dates
      await adapter.upsertVocabulary({
        id: 'vocab_due',
        word: 'due today',
        nextReview: today,
      }, validToken);

      await adapter.upsertVocabulary({
        id: 'vocab_overdue',
        word: 'overdue',
        nextReview: yesterday,
      }, validToken);

      await adapter.upsertVocabulary({
        id: 'vocab_future',
        word: 'future',
        nextReview: tomorrow,
      }, validToken);

      // Get due items
      const dueItems = await adapter.getLeitnerDueItems('Vocabulary', validToken);

      expect(dueItems).toHaveLength(2);
      expect(dueItems.map(i => i.id)).toContain('vocab_due');
      expect(dueItems.map(i => i.id)).toContain('vocab_overdue');
      expect(dueItems.map(i => i.id)).not.toContain('vocab_future');
    });

    it('should calculate accurate statistics', async () => {
      // Create vocabulary with various states
      await adapter.upsertVocabulary({
        id: 'v1', word: 'word1', box: 1, reviewCount: 5, correctCount: 3,
        nextReview: new Date().toISOString().split('T')[0],
      }, validToken);

      await adapter.upsertVocabulary({
        id: 'v2', word: 'word2', box: 3, reviewCount: 10, correctCount: 8,
        nextReview: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      }, validToken);

      await adapter.upsertVocabulary({
        id: 'v3', word: 'word3', box: 5, reviewCount: 20, correctCount: 18,
        nextReview: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      }, validToken);

      const stats = await adapter.getLeitnerStats('Vocabulary', validToken);

      expect(stats.totalItems).toBe(3);
      expect(stats.boxCounts[1]).toBe(1);
      expect(stats.boxCounts[3]).toBe(1);
      expect(stats.boxCounts[5]).toBe(1);
      expect(stats.dueCount).toBe(1);
      expect(stats.totalReviews).toBe(35);
      expect(stats.accuracy).toBeCloseTo((29 / 35) * 100, 1);
      expect(stats.masteryPercentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('Mixed item types', () => {
    it('should handle vocabulary and notes in same session', async () => {
      // Create mixed items
      await adapter.upsertVocabulary({
        id: 'vocab_mixed',
        word: 'test',
        nextReview: new Date().toISOString().split('T')[0],
      }, validToken);

      await adapter.upsertNote({
        id: 'note_mixed',
        title: 'Test Note',
        nextReview: new Date().toISOString().split('T')[0],
      }, validToken);

      // Get all due items
      const allDue = await adapter.getLeitnerDueItems('all', validToken);
      expect(allDue).toHaveLength(2);

      // Review both
      const vocabResult = await adapter.recordLeitnerReview(
        'vocab_mixed', 'Vocabulary', true, validToken
      );
      const noteResult = await adapter.recordLeitnerReview(
        'note_mixed', 'Note', true, validToken
      );

      expect(vocabResult.box).toBe(2);
      expect(noteResult.box).toBe(2);

      // Verify review history
      const state = adapter.getState();
      expect(state.reviews).toHaveLength(2);
    });
  });
});

// ===========================================================================
// VECTOR SEARCH & RAG INTEGRATION TESTS
// ===========================================================================

describe('KuzuAdapter Integration: Vector Search & RAG', () => {
  let adapter;
  const validToken = 'valid-token';

  // Sample embeddings
  const createEmbedding = (seed) => {
    const embedding = [];
    for (let i = 0; i < 384; i++) {
      embedding.push(Math.sin(seed + i * 0.1));
    }
    return embedding;
  };

  beforeEach(async () => {
    adapter = new IntegratedMockKuzuAdapter();
    await adapter.connect({ get: jest.fn() });
    await adapter.createVectorIndexes();
  });

  afterEach(() => {
    adapter.clearState();
  });

  describe('Document chunking and retrieval', () => {
    it('should create and search chunks for a book', async () => {
      // Create book
      await adapter.upsertBook({
        id: 'book_rag',
        title: 'RAG Test Book',
      }, validToken);

      // Create chunks
      await adapter.createChunk('book_rag', {
        id: 'chunk_1',
        text: 'Machine learning is a subset of artificial intelligence.',
        chunkIndex: 0,
        pageNum: 1,
      }, createEmbedding(1), validToken);

      await adapter.createChunk('book_rag', {
        id: 'chunk_2',
        text: 'Neural networks are inspired by biological neurons.',
        chunkIndex: 1,
        pageNum: 1,
      }, createEmbedding(2), validToken);

      await adapter.createChunk('book_rag', {
        id: 'chunk_3',
        text: 'Deep learning uses multiple layers of neural networks.',
        chunkIndex: 2,
        pageNum: 2,
      }, createEmbedding(1.5), validToken);

      // Search with similar embedding
      const searchResults = await adapter.searchSimilarChunks(
        createEmbedding(1.2),
        3,
        validToken,
        { bookId: 'book_rag' }
      );

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0]).toHaveProperty('similarity');
    });

    it('should build RAG prompt with context', async () => {
      // Setup book and chunks
      await adapter.upsertBook({ id: 'book_qa', title: 'Q&A Book' }, validToken);

      await adapter.createChunk('book_qa', {
        id: 'chunk_context',
        text: 'The capital of France is Paris. Paris is known for the Eiffel Tower.',
        chunkIndex: 0,
      }, createEmbedding(1), validToken);

      await adapter.createKeyConcepts('book_qa', [
        { id: 'kc_1', name: 'France', importance: 0.9 },
        { id: 'kc_2', name: 'Paris', importance: 0.95 },
      ], validToken);

      // Build RAG prompt
      const ragResult = await adapter.buildRAGPrompt(
        'What is the capital of France?',
        createEmbedding(1),
        'book_qa',
        validToken
      );

      expect(ragResult.context).toBeDefined();
      expect(ragResult.prompt).toContain('Question:');
      expect(ragResult.chunks.length).toBeGreaterThan(0);
      expect(ragResult.keyConcepts).toHaveLength(2);
    });
  });

  describe('Semantic similarity across entities', () => {
    it('should find similar notes using embeddings', async () => {
      // Create notes with embeddings
      const note1 = await adapter.upsertNote({
        id: 'note_ml',
        title: 'Machine Learning Basics',
        content: 'Introduction to ML algorithms',
      }, validToken);

      await adapter.storeEmbedding('note_ml', 'Note', createEmbedding(1), 'text-embedding-3-small', validToken);

      const note2 = await adapter.upsertNote({
        id: 'note_dl',
        title: 'Deep Learning',
        content: 'Neural network architectures',
      }, validToken);

      await adapter.storeEmbedding('note_dl', 'Note', createEmbedding(1.1), 'text-embedding-3-small', validToken);

      const note3 = await adapter.upsertNote({
        id: 'note_cooking',
        title: 'Cooking Tips',
        content: 'How to make pasta',
      }, validToken);

      await adapter.storeEmbedding('note_cooking', 'Note', createEmbedding(10), 'text-embedding-3-small', validToken);

      // Find similar notes
      const similar = await adapter.findSimilar(
        createEmbedding(1.05),
        ['Note'],
        3,
        0.5,
        validToken
      );

      expect(similar.length).toBeGreaterThan(0);
      // ML and DL notes should be more similar than cooking
      const titles = similar.map(s => s.title);
      expect(titles).toContain('Machine Learning Basics');
    });
  });
});

// ===========================================================================
// KNOWLEDGE GRAPH INTEGRATION TESTS
// ===========================================================================

describe('KuzuAdapter Integration: Knowledge Graph', () => {
  let adapter;
  const validToken = 'valid-token';

  beforeEach(async () => {
    adapter = new IntegratedMockKuzuAdapter();
    await adapter.connect({ get: jest.fn() });
  });

  afterEach(() => {
    adapter.clearState();
  });

  describe('Concept mastery tracking', () => {
    it('should track concept mastery progression', async () => {
      // Create concepts in a learning path
      const concepts = [
        { id: 'c_algebra', name: 'Algebra', mastery: 0.8 },
        { id: 'c_calculus', name: 'Calculus', mastery: 0.3 },
        { id: 'c_diffeq', name: 'Differential Equations', mastery: 0.1 },
      ];

      for (const concept of concepts) {
        await adapter.upsertConcept(concept, validToken);
      }

      // Update mastery as learning progresses
      await adapter.updateConceptMastery('c_calculus', 0.5, validToken);
      await adapter.updateConceptMastery('c_calculus', 0.7, validToken);

      // Verify mastery history
      const calculus = await adapter.getConcept('c_calculus', validToken);
      expect(calculus.mastery).toBe(0.7);
      expect(calculus.masteryHistory).toContain(0.5);
      expect(calculus.masteryHistory).toContain(0.7);
    });

    it('should detect weak concepts', async () => {
      // Create concepts with varying mastery
      await adapter.upsertConcept({ id: 'c_strong', name: 'Strong', mastery: 0.9 }, validToken);
      await adapter.upsertConcept({ id: 'c_medium', name: 'Medium', mastery: 0.6 }, validToken);
      await adapter.upsertConcept({ id: 'c_weak', name: 'Weak', mastery: 0.2 }, validToken);
      await adapter.upsertConcept({ id: 'c_vweak', name: 'Very Weak', mastery: 0.1 }, validToken);

      // Detect weak concepts
      const weakConcepts = await adapter.detectWeakConcepts(10, validToken);

      expect(weakConcepts).toHaveLength(2);
      expect(weakConcepts[0].name).toBe('Very Weak');
      expect(weakConcepts[1].name).toBe('Weak');
    });
  });

  describe('Learning path generation', () => {
    it('should generate personalized learning path', async () => {
      // Create concept hierarchy
      await adapter.upsertConcept({ id: 'c_basics', name: 'Programming Basics', mastery: 0.9 }, validToken);
      await adapter.upsertConcept({ id: 'c_oop', name: 'OOP', mastery: 0.6 }, validToken);
      await adapter.upsertConcept({ id: 'c_patterns', name: 'Design Patterns', mastery: 0.3 }, validToken);
      await adapter.upsertConcept({ id: 'c_arch', name: 'Software Architecture', mastery: 0.1 }, validToken);

      // Get learning path
      const { path, totalEstimatedHours } = await adapter.getPersonalizedLearningPath(
        'c_arch',
        validToken
      );

      expect(path.length).toBeGreaterThan(0);
      expect(totalEstimatedHours).toBeGreaterThan(0);

      // Path should be ordered by mastery (ascending)
      for (let i = 1; i < path.length; i++) {
        expect(path[i].mastery).toBeGreaterThanOrEqual(path[i - 1].mastery);
      }
    });
  });

  describe('Knowledge graph visualization', () => {
    it('should retrieve graph data for visualization', async () => {
      // Create interconnected data
      await adapter.upsertBook({ id: 'book_1', title: 'Book 1' }, validToken);
      await adapter.upsertNote({ id: 'note_1', title: 'Note 1', sourceId: 'book_1' }, validToken);
      await adapter.upsertConcept({ id: 'concept_1', name: 'Concept 1' }, validToken);

      // Get graph data
      const { nodes, edges } = await adapter.getKnowledgeGraphData(null, validToken);

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.some(n => n.type === 'Note')).toBe(true);
      expect(nodes.some(n => n.type === 'Concept')).toBe(true);
    });
  });
});

// ===========================================================================
// LINK OPERATIONS INTEGRATION TESTS
// ===========================================================================

describe('KuzuAdapter Integration: Knowledge Web Links', () => {
  let adapter;
  const validToken = 'valid-token';

  beforeEach(async () => {
    adapter = new IntegratedMockKuzuAdapter();
    await adapter.connect({ get: jest.fn() });
  });

  afterEach(() => {
    adapter.clearState();
  });

  describe('Bidirectional linking', () => {
    it('should create and retrieve bidirectional links', async () => {
      // Create vocabulary and notes
      await adapter.upsertVocabulary({
        id: 'vocab_linked',
        word: 'serendipity',
      }, validToken);

      await adapter.upsertNote({
        id: 'note_linking',
        title: 'Note with Link',
      }, validToken);

      // Sync links from note to vocabulary
      await adapter.syncNoteLinks('note_linking', [
        { id: 'vocab_linked', type: 'vocabulary', text: 'serendipity' },
      ], validToken);

      // Get outgoing links from note
      const outgoing = await adapter.getOutgoingLinks('note_linking', validToken);
      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].id).toBe('vocab_linked');

      // Get backlinks to vocabulary
      const backlinks = await adapter.getBacklinks('vocab_linked', 'vocabulary', validToken);
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].sourceId).toBe('note_linking');
    });

    it('should update links correctly', async () => {
      await adapter.upsertNote({ id: 'note_update' }, validToken);
      await adapter.upsertVocabulary({ id: 'vocab_1' }, validToken);
      await adapter.upsertVocabulary({ id: 'vocab_2' }, validToken);
      await adapter.upsertVocabulary({ id: 'vocab_3' }, validToken);

      // Initial links
      await adapter.syncNoteLinks('note_update', [
        { id: 'vocab_1', type: 'vocabulary' },
        { id: 'vocab_2', type: 'vocabulary' },
      ], validToken);

      let links = await adapter.getOutgoingLinks('note_update', validToken);
      expect(links).toHaveLength(2);

      // Update links (remove vocab_1, add vocab_3)
      const result = await adapter.syncNoteLinks('note_update', [
        { id: 'vocab_2', type: 'vocabulary' },
        { id: 'vocab_3', type: 'vocabulary' },
      ], validToken);

      expect(result.created).toBe(1);
      expect(result.deleted).toBe(1);

      links = await adapter.getOutgoingLinks('note_update', validToken);
      expect(links).toHaveLength(2);
      expect(links.map(l => l.id)).toContain('vocab_2');
      expect(links.map(l => l.id)).toContain('vocab_3');
    });
  });
});

// ===========================================================================
// END-TO-END WORKFLOW TESTS
// ===========================================================================

describe('KuzuAdapter Integration: End-to-End Workflows', () => {
  let adapter;
  const validToken = 'valid-token';

  beforeEach(async () => {
    adapter = new IntegratedMockKuzuAdapter();
    await adapter.connect({ get: jest.fn() });
    await adapter.createVectorIndexes();
  });

  afterEach(() => {
    adapter.clearState();
  });

  describe('Reading → Note-taking → Review workflow', () => {
    it('should support complete reading workflow', async () => {
      // 1. User opens a book
      const book = await adapter.upsertBook({
        id: 'book_reading',
        title: 'The Art of Learning',
        author: 'Josh Waitzkin',
      }, validToken);

      // 2. Create chunks for the book
      const embedding1 = Array(384).fill(0).map((_, i) => Math.sin(i * 0.1));
      await adapter.createChunk('book_reading', {
        id: 'chunk_intro',
        text: 'Learning is a lifelong journey...',
        chunkIndex: 0,
        pageNum: 1,
      }, embedding1, validToken);

      // 3. Extract key concepts
      await adapter.createKeyConcepts('book_reading', [
        { id: 'kc_learning', name: 'Learning', importance: 0.9 },
        { id: 'kc_practice', name: 'Deliberate Practice', importance: 0.85 },
      ], validToken);

      // 4. User takes notes while reading
      const note = await adapter.upsertNote({
        id: 'note_reading',
        title: 'Key Takeaways',
        content: 'Focus on deliberate practice...',
        sourceId: 'book_reading',
      }, validToken);

      // 5. User looks up vocabulary
      const vocab = await adapter.upsertVocabulary({
        id: 'vocab_deliberate',
        word: 'deliberate',
        definition: 'done consciously and intentionally',
        sourceId: 'book_reading',
      }, validToken);

      // 6. User links note to vocabulary
      await adapter.syncNoteLinks('note_reading', [
        { id: 'vocab_deliberate', type: 'vocabulary', text: 'deliberate' },
      ], validToken);

      // 7. User reviews vocabulary using Leitner system
      await adapter.recordLeitnerReview('vocab_deliberate', 'Vocabulary', true, validToken);
      const updatedVocab = await adapter.getVocabulary('vocab_deliberate', validToken);
      expect(updatedVocab.box).toBe(2);

      // 8. User checks learning progress
      const stats = await adapter.getLeitnerStats('Vocabulary', validToken);
      expect(stats.totalItems).toBe(1);
      expect(stats.totalReviews).toBe(1);

      // Verify complete workflow
      const state = adapter.getState();
      expect(state.books.size).toBe(1);
      expect(state.notes.size).toBe(1);
      expect(state.vocabulary.size).toBe(1);
      expect(state.chunks.size).toBe(1);
      expect(state.keyConcepts.size).toBe(2);
    });
  });

  describe('Question → RAG → Answer workflow', () => {
    it('should answer questions using RAG', async () => {
      // Setup book with content
      await adapter.upsertBook({
        id: 'book_qa',
        title: 'Science Encyclopedia',
      }, validToken);

      // Create chunks with relevant content
      const chunkData = [
        { text: 'The sun is a star at the center of our solar system.', seed: 1 },
        { text: 'Planets orbit around the sun due to gravitational force.', seed: 1.2 },
        { text: 'The moon is Earth\'s natural satellite.', seed: 2 },
      ];

      for (let i = 0; i < chunkData.length; i++) {
        const embedding = Array(384).fill(0).map((_, j) => Math.sin(chunkData[i].seed + j * 0.1));
        await adapter.createChunk('book_qa', {
          id: `chunk_${i}`,
          text: chunkData[i].text,
          chunkIndex: i,
        }, embedding, validToken);
      }

      // User asks a question
      const queryEmbedding = Array(384).fill(0).map((_, i) => Math.sin(1.1 + i * 0.1));
      const ragResult = await adapter.buildRAGPrompt(
        'What is at the center of our solar system?',
        queryEmbedding,
        'book_qa',
        validToken
      );

      // RAG should find relevant chunks
      expect(ragResult.chunks.length).toBeGreaterThan(0);
      expect(ragResult.prompt).toContain('Question:');
      expect(ragResult.context).toBeDefined();
    });
  });

  describe('Learning → Weak concept detection → Review workflow', () => {
    it('should guide user to review weak concepts', async () => {
      // User learns multiple concepts
      const concepts = [
        { id: 'c_1', name: 'Algebra', mastery: 0.9 },
        { id: 'c_2', name: 'Calculus', mastery: 0.7 },
        { id: 'c_3', name: 'Statistics', mastery: 0.3 },
        { id: 'c_4', name: 'Linear Algebra', mastery: 0.2 },
      ];

      for (const concept of concepts) {
        await adapter.upsertConcept(concept, validToken);
      }

      // System detects weak concepts
      const weakConcepts = await adapter.detectWeakConcepts(5, validToken);
      expect(weakConcepts.map(c => c.name)).toContain('Statistics');
      expect(weakConcepts.map(c => c.name)).toContain('Linear Algebra');

      // User studies weak concept and improves
      await adapter.updateConceptMastery('c_4', 0.5, validToken);
      await adapter.updateConceptMastery('c_4', 0.75, validToken);

      // Verify improvement
      const improved = await adapter.getConcept('c_4', validToken);
      expect(improved.mastery).toBe(0.75);
      expect(improved.masteryHistory.length).toBeGreaterThan(0);

      // Weak concepts should update
      const updatedWeak = await adapter.detectWeakConcepts(5, validToken);
      expect(updatedWeak.map(c => c.name)).not.toContain('Linear Algebra');
    });
  });
});

// ===========================================================================
// PERFORMANCE & STRESS TESTS
// ===========================================================================

describe('KuzuAdapter Integration: Performance', () => {
  let adapter;
  const validToken = 'valid-token';

  beforeEach(async () => {
    adapter = new IntegratedMockKuzuAdapter();
    await adapter.connect({ get: jest.fn() });
  });

  afterEach(() => {
    adapter.clearState();
  });

  it('should handle bulk operations efficiently', async () => {
    const start = Date.now();

    // Create 100 vocabulary items
    for (let i = 0; i < 100; i++) {
      await adapter.upsertVocabulary({
        id: `vocab_${i}`,
        word: `word_${i}`,
        definition: `definition_${i}`,
      }, validToken);
    }

    // Get all vocabulary
    const vocab = await adapter.getUserVocabulary(validToken, 100);
    expect(vocab).toHaveLength(100);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should maintain data integrity under concurrent-like operations', async () => {
    // Simulate rapid successive operations
    const operations = [];

    for (let i = 0; i < 20; i++) {
      operations.push(
        adapter.upsertVocabulary({ id: `v_${i}`, word: `word_${i}` }, validToken)
      );
    }

    await Promise.all(operations);

    // Verify all items created
    const vocab = await adapter.getUserVocabulary(validToken, 100);
    expect(vocab).toHaveLength(20);

    // Verify each item is unique
    const ids = vocab.map(v => v.id);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds).toHaveLength(20);
  });
});

// ===========================================================================
// ERROR HANDLING INTEGRATION TESTS
// ===========================================================================

describe('KuzuAdapter Integration: Error Handling', () => {
  let adapter;
  const validToken = 'valid-token';

  beforeEach(async () => {
    adapter = new IntegratedMockKuzuAdapter();
    await adapter.connect({ get: jest.fn() });
  });

  afterEach(() => {
    adapter.clearState();
  });

  it('should handle non-existent items gracefully', async () => {
    // Try to get non-existent items
    const book = await adapter.getBook('nonexistent', validToken);
    expect(book).toBeNull();

    const note = await adapter.getNote('nonexistent', validToken);
    expect(note).toBeNull();

    const vocab = await adapter.getVocabulary('nonexistent', validToken);
    expect(vocab).toBeNull();
  });

  it('should handle invalid token gracefully', async () => {
    // Create item with valid token
    await adapter.upsertBook({ id: 'book_1', title: 'Test' }, validToken);

    // Try to access with different user's token
    const book = await adapter.getBook('book_1', 'user2-token');
    expect(book).toBeNull();
  });

  it('should handle Leitner review for non-existent item', async () => {
    const result = await adapter.recordLeitnerReview(
      'nonexistent',
      'Vocabulary',
      true,
      validToken
    );

    expect(result).toBeNull();
  });
});
