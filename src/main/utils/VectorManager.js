/**
 * VectorManager.js
 *
 * Unified interface for vector storage operations.
 * Abstracts the underlying storage (Neo4j) and provides a clean API
 * for embedding and searching documents.
 *
 * This replaces ChromaManager as the primary vector storage interface.
 *
 * Features:
 * - Book chunk embedding and search
 * - Note embedding and search
 * - Message embedding and search
 * - Bookmark embedding and search
 * - Key concept extraction and embedding
 * - Lazy embedding generation
 */

import neo4jAdapter from './Neo4jAdapter';
import { getUserIdFromToken } from '../db/dbManager';
import { getBookById } from '../db/BookManager';
import { splitTextIntoChunks } from '../../commons/utils/CommonLangUtil';

class VectorManager {
  constructor() {
    if (VectorManager.instance) {
      return VectorManager.instance;
    }

    this.store = null;
    this.embeddingFunction = null;
    this.isInitialized = false;

    VectorManager.instance = this;
  }

  /**
   * Initialize the vector manager
   * @param {Object} store - electron-store instance
   * @param {Function} embeddingFunction - Function to generate embeddings: (text) => number[]
   */
  async setup(store, embeddingFunction = null) {
    this.store = store;
    this.embeddingFunction = embeddingFunction;

    // Ensure Neo4j chunk indexes exist
    if (neo4jAdapter.checkConnection()) {
      await neo4jAdapter.createChunkIndexes();
    }

    this.isInitialized = true;
    console.log('VectorManager: Initialized');
  }

  /**
   * Check if vector operations are enabled
   * @param {string} token - User token
   * @returns {boolean}
   */
  isEnabled(token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return false;

    const vectorEnabled = this.store?.get('vector.enabled') ?? true;
    return vectorEnabled && neo4jAdapter.checkConnection();
  }

  /**
   * Check if embedding generation is available
   * @returns {boolean}
   */
  hasEmbeddingFunction() {
    return typeof this.embeddingFunction === 'function';
  }

  /**
   * Generate embedding for text
   * @param {string} text - Text to embed
   * @returns {number[]|null} Embedding vector or null
   */
  async generateEmbedding(text) {
    if (!this.embeddingFunction) {
      console.warn('VectorManager: No embedding function configured');
      return null;
    }

    try {
      const embedding = await this.embeddingFunction(text);
      return embedding;
    } catch (error) {
      console.error('VectorManager: Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Batch generate embeddings for multiple texts
   * @param {string[]} texts - Array of texts
   * @returns {(number[]|null)[]} Array of embeddings
   */
  async batchGenerateEmbeddings(texts) {
    if (!this.embeddingFunction) {
      return texts.map(() => null);
    }

    try {
      // If the embedding function supports batch, use it
      if (this.embeddingFunction.batch) {
        return await this.embeddingFunction.batch(texts);
      }

      // Otherwise, generate one by one
      const embeddings = [];
      for (const text of texts) {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
      }
      return embeddings;
    } catch (error) {
      console.error('VectorManager: Error batch generating embeddings:', error);
      return texts.map(() => null);
    }
  }

  // ===========================================================================
  // BOOK OPERATIONS
  // ===========================================================================

  /**
   * Import a book into vector storage
   * Parses the book into chunks and stores with embeddings
   *
   * @param {Object} book - Book object from SQLite
   * @param {Object} options - Options {maxChunkSize, generateEmbeddings}
   * @param {string} token - User token
   * @returns {Object} Import result {chunksCreated, conceptsExtracted}
   */
  async importBook(book, options = {}, token) {
    if (!this.isEnabled(token)) {
      return { chunksCreated: 0, conceptsExtracted: 0, error: 'Vector storage not enabled' };
    }

    const {
      maxChunkSize = 500,
      generateEmbeddings = true,
      extractConcepts = true,
    } = options;

    const userId = getUserIdFromToken(token);
    console.log(`VectorManager: Importing book ${book.id} for user ${userId}`);

    try {
      // Parse book content into chunks
      const chunks = await this.parseBookIntoChunks(book, maxChunkSize);

      if (chunks.length === 0) {
        return { chunksCreated: 0, conceptsExtracted: 0, error: 'No content to chunk' };
      }

      // Generate embeddings if enabled
      let embeddings = [];
      if (generateEmbeddings && this.hasEmbeddingFunction()) {
        console.log(`VectorManager: Generating embeddings for ${chunks.length} chunks`);
        embeddings = await this.batchGenerateEmbeddings(chunks.map(c => c.text));
      }

      // Store chunks in Neo4j
      const chunksCreated = await neo4jAdapter.batchCreateChunks(
        book.id,
        chunks,
        embeddings,
        token
      );

      // Extract key concepts if enabled
      let conceptsExtracted = 0;
      if (extractConcepts) {
        // Note: This requires an AI call - will be handled by caller if needed
        // This method just stores them
      }

      console.log(`VectorManager: Imported ${chunksCreated} chunks for book ${book.id}`);

      return {
        chunksCreated,
        conceptsExtracted,
        totalChunks: chunks.length,
        hasEmbeddings: embeddings.length > 0 && embeddings[0] !== null,
      };
    } catch (error) {
      console.error('VectorManager: Error importing book:', error);
      return { chunksCreated: 0, conceptsExtracted: 0, error: error.message };
    }
  }

  /**
   * Parse book content into chunks
   * @param {Object} book - Book object
   * @param {number} maxChunkSize - Maximum tokens per chunk
   * @returns {Array} Chunks with {text, chunkIndex, pageNum?, cfi?, sectionTitle?}
   */
  async parseBookIntoChunks(book, maxChunkSize = 500) {
    // This is a placeholder - actual parsing depends on book format
    // For now, we rely on the content being passed or read externally

    if (book.content) {
      // If content is already available
      const textChunks = splitTextIntoChunks(book.content, maxChunkSize);
      return textChunks.map((text, idx) => ({
        text,
        chunkIndex: idx,
      }));
    }

    // For EPUB/PDF, the parsing is done in the renderer process
    // and sent via IPC. This method handles the storage only.
    return [];
  }

  /**
   * Add pre-parsed chunks to a book
   * Called from IPC handler after renderer parses EPUB/PDF
   *
   * @param {string} bookId - Book ID
   * @param {Array} chunks - Parsed chunks from renderer
   * @param {string} token - User token
   * @returns {Object} Result
   */
  async addBookChunks(bookId, chunks, token) {
    if (!this.isEnabled(token)) {
      return { chunksCreated: 0, error: 'Vector storage not enabled' };
    }

    try {
      // Generate embeddings
      let embeddings = [];
      if (this.hasEmbeddingFunction()) {
        embeddings = await this.batchGenerateEmbeddings(chunks.map(c => c.text));
      }

      // Store in Neo4j
      const chunksCreated = await neo4jAdapter.batchCreateChunks(
        bookId,
        chunks,
        embeddings,
        token
      );

      return { chunksCreated, hasEmbeddings: embeddings.length > 0 };
    } catch (error) {
      console.error('VectorManager: Error adding book chunks:', error);
      return { chunksCreated: 0, error: error.message };
    }
  }

  /**
   * Search book content by semantic similarity
   * @param {string} query - Search query
   * @param {string} bookId - Optional book ID to filter
   * @param {number} limit - Max results
   * @param {string} token - User token
   * @returns {Array} Matching chunks with similarity scores
   */
  async searchBookContent(query, bookId, limit = 10, token) {
    if (!this.isEnabled(token)) {
      return [];
    }

    if (!this.hasEmbeddingFunction()) {
      console.warn('VectorManager: Cannot search without embedding function');
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        return [];
      }

      const userId = getUserIdFromToken(token);
      const filters = { userId };
      if (bookId) {
        filters.bookId = bookId;
      }

      const results = await neo4jAdapter.searchSimilarChunks(
        queryEmbedding,
        filters,
        limit,
        0.7
      );

      return results.map(r => ({
        text: r.chunk.text,
        bookId: r.chunk.bookId,
        chunkIndex: r.chunk.chunkIndex,
        pageNum: r.chunk.pageNum,
        sectionTitle: r.chunk.sectionTitle,
        similarity: r.similarity,
      }));
    } catch (error) {
      console.error('VectorManager: Error searching book content:', error);
      return [];
    }
  }

  /**
   * Delete all chunks for a book
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   */
  async deleteBookChunks(bookId, token) {
    if (!this.isEnabled(token)) return;

    try {
      await neo4jAdapter.deleteChunksByBook(bookId, token);
      console.log(`VectorManager: Deleted chunks for book ${bookId}`);
    } catch (error) {
      console.error('VectorManager: Error deleting book chunks:', error);
    }
  }

  /**
   * Ensure embeddings exist for a book (lazy generation)
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {number} Number of embeddings generated
   */
  async ensureBookEmbeddings(bookId, token) {
    if (!this.isEnabled(token) || !this.hasEmbeddingFunction()) {
      return 0;
    }

    try {
      const chunks = await neo4jAdapter.getChunksWithoutEmbeddings(bookId, token);

      if (chunks.length === 0) {
        return 0;
      }

      console.log(`VectorManager: Generating embeddings for ${chunks.length} chunks`);

      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk.text);
        if (embedding) {
          await neo4jAdapter.updateChunkEmbedding(chunk.id, embedding);
        }
      }

      return chunks.length;
    } catch (error) {
      console.error('VectorManager: Error ensuring book embeddings:', error);
      return 0;
    }
  }

  // ===========================================================================
  // KEY CONCEPT OPERATIONS
  // ===========================================================================

  /**
   * Store key concepts for a book
   * @param {string} bookId - Book ID
   * @param {Array} concepts - Extracted concepts
   * @param {string} token - User token
   * @returns {number} Number of concepts created
   */
  async storeKeyConcepts(bookId, concepts, token) {
    if (!this.isEnabled(token)) {
      return 0;
    }

    try {
      // Create concept nodes
      const created = await neo4jAdapter.createKeyConcepts(bookId, concepts, token);

      // Generate and store embeddings for concepts
      if (this.hasEmbeddingFunction() && concepts.length > 0) {
        const conceptTexts = concepts.map(c =>
          `${c.name}${c.description ? ': ' + c.description : ''}`
        );
        const embeddings = await this.batchGenerateEmbeddings(conceptTexts);

        const conceptEmbeddings = concepts.map((c, idx) => ({
          conceptId: c.id,
          embedding: embeddings[idx],
        })).filter(ce => ce.embedding !== null);

        if (conceptEmbeddings.length > 0) {
          await neo4jAdapter.storeConceptEmbeddings(bookId, conceptEmbeddings);
        }
      }

      return created;
    } catch (error) {
      console.error('VectorManager: Error storing key concepts:', error);
      return 0;
    }
  }

  /**
   * Tag chunks with matching concepts and derive relationships
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   */
  async buildConceptGraph(bookId, token) {
    if (!this.isEnabled(token)) {
      return;
    }

    try {
      // Tag chunks with concepts based on embedding similarity
      await neo4jAdapter.tagChunksWithConcepts(bookId, 0.75, token);

      // Derive relationships from co-occurrence
      await neo4jAdapter.deriveConceptRelationships(bookId, 2, token);

      console.log(`VectorManager: Built concept graph for book ${bookId}`);
    } catch (error) {
      console.error('VectorManager: Error building concept graph:', error);
    }
  }

  /**
   * Get key concepts for a book
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {Array} Concepts
   */
  async getKeyConcepts(bookId, token) {
    if (!this.isEnabled(token)) {
      return [];
    }

    try {
      return await neo4jAdapter.getKeyConceptsByBook(bookId, token);
    } catch (error) {
      console.error('VectorManager: Error getting key concepts:', error);
      return [];
    }
  }

  // ===========================================================================
  // NOTE OPERATIONS
  // ===========================================================================

  /**
   * Add a note to vector storage
   * @param {Object} note - Note object
   * @param {string} token - User token
   */
  async addNote(note, token) {
    if (!this.isEnabled(token)) return;

    try {
      const text = note.content || note.title || '';
      if (text.length < 10) return;

      const embedding = this.hasEmbeddingFunction()
        ? await this.generateEmbedding(text)
        : null;

      // Store in Neo4j using existing note embedding functionality
      await neo4jAdapter.storeEmbedding(
        String(note.id),
        'Note',
        embedding,
        'text-embedding-3-small'
      );
    } catch (error) {
      console.error('VectorManager: Error adding note:', error);
    }
  }

  /**
   * Search notes by semantic similarity
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @param {string} token - User token
   * @returns {Array} Matching notes
   */
  async searchNotes(query, limit = 10, token) {
    if (!this.isEnabled(token) || !this.hasEmbeddingFunction()) {
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) return [];

      return await neo4jAdapter.findSimilar(
        queryEmbedding,
        ['Note'],
        limit,
        0.7,
        token
      );
    } catch (error) {
      console.error('VectorManager: Error searching notes:', error);
      return [];
    }
  }

  // ===========================================================================
  // MESSAGE OPERATIONS
  // ===========================================================================

  /**
   * Add a message to vector storage
   * @param {Object} message - Message object
   * @param {string} token - User token
   */
  async addMessage(message, token) {
    if (!this.isEnabled(token)) return;

    try {
      const text = message.content || '';
      if (text.length < 10) return;

      const embedding = this.hasEmbeddingFunction()
        ? await this.generateEmbedding(text)
        : null;

      await neo4jAdapter.storeEmbedding(
        String(message.id),
        'Message',
        embedding,
        'text-embedding-3-small'
      );
    } catch (error) {
      console.error('VectorManager: Error adding message:', error);
    }
  }

  /**
   * Search messages by semantic similarity
   * @param {string} query - Search query
   * @param {string} chatId - Optional chat ID to filter
   * @param {number} limit - Max results
   * @param {string} token - User token
   * @returns {Array} Matching messages
   */
  async searchMessages(query, chatId, limit = 10, token) {
    if (!this.isEnabled(token) || !this.hasEmbeddingFunction()) {
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) return [];

      // TODO: Add chatId filter support in findSimilar
      return await neo4jAdapter.findSimilar(
        queryEmbedding,
        ['Message'],
        limit,
        0.7,
        token
      );
    } catch (error) {
      console.error('VectorManager: Error searching messages:', error);
      return [];
    }
  }

  // ===========================================================================
  // LEARNING POINT OPERATIONS
  // ===========================================================================

  /**
   * Create learning points for a topic
   * @param {string} topicId - Learning topic ID
   * @param {Array} learningPoints - Array of learning point data
   * @param {string} token - User token
   * @returns {number} Number created
   */
  async createLearningPoints(topicId, learningPoints, token) {
    if (!this.isEnabled(token)) {
      return 0;
    }

    try {
      return await neo4jAdapter.createLearningPoints(topicId, learningPoints, token);
    } catch (error) {
      console.error('VectorManager: Error creating learning points:', error);
      return 0;
    }
  }

  /**
   * Get learning points for a topic
   * @param {string} topicId - Topic ID
   * @param {Object} filters - Optional filters
   * @param {string} token - User token
   * @returns {Array} Learning points
   */
  async getLearningPoints(topicId, filters = {}, token) {
    if (!this.isEnabled(token)) {
      return [];
    }

    try {
      return await neo4jAdapter.getLearningPointsByTopic(topicId, filters, token);
    } catch (error) {
      console.error('VectorManager: Error getting learning points:', error);
      return [];
    }
  }

  /**
   * Update learning point after review
   * @param {string} learningPointId - Learning point ID
   * @param {Object} reviewResult - Review result
   * @returns {Object} Updated learning point
   */
  async updateLearningPointAfterReview(learningPointId, reviewResult) {
    try {
      return await neo4jAdapter.updateLearningPointAfterReview(learningPointId, reviewResult);
    } catch (error) {
      console.error('VectorManager: Error updating learning point:', error);
      return null;
    }
  }

  /**
   * Get learning points due for review
   * @param {string} topicId - Optional topic ID
   * @param {number} limit - Max items
   * @param {string} token - User token
   * @returns {Array} Due learning points
   */
  async getLearningPointsDueForReview(topicId, limit = 20, token) {
    if (!this.isEnabled(token)) {
      return [];
    }

    try {
      return await neo4jAdapter.getLearningPointsDueForReview(topicId, limit, token);
    } catch (error) {
      console.error('VectorManager: Error getting due learning points:', error);
      return [];
    }
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get statistics about vector storage
   * @param {string} token - User token
   * @returns {Object} Stats
   */
  async getStats(token) {
    if (!this.isEnabled(token)) {
      return { enabled: false };
    }

    try {
      const stats = await neo4jAdapter.getMigrationStats();
      return {
        enabled: true,
        hasEmbeddingFunction: this.hasEmbeddingFunction(),
        chunks: stats.Chunk || 0,
        keyConcepts: stats.KeyConcept || 0,
        learningPoints: stats.LearningPoint || 0,
        notes: stats.Note || 0,
        messages: stats.Message || 0,
      };
    } catch (error) {
      console.error('VectorManager: Error getting stats:', error);
      return { enabled: true, error: error.message };
    }
  }
}

// Export singleton instance
const vectorManager = new VectorManager();

export default vectorManager;
export { VectorManager };
