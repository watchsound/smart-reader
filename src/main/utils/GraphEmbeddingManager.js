/**
 * GraphEmbeddingManager.js
 *
 * Manages embeddings in Neo4j graph database, replacing ChromaManager functionality.
 * Stores document embeddings for semantic search across books, notes, bookmarks, and messages.
 *
 * This manager is now the PRIMARY embedding store (replacing ChromaDB).
 *
 * Key Features:
 * - Book chunk storage with embeddings
 * - Key concept extraction and storage
 * - Concept-chunk relationship derivation
 * - Semantic search across all content types
 * - Learning point management for learning plans
 */

import { getUserIdFromToken } from '../db/dbManager';
import { getBookById } from '../db/BookManager';
import { getMessageById } from '../db/MessageManager';
import { getNoteById } from '../db/NoteJsonManager';
import graphInterface from './GraphInterface';
import neo4jAdapter from './Neo4jAdapter';
import { splitTextIntoChunks } from '../../commons/utils/CommonLangUtil';

class GraphEmbeddingManager {
  constructor() {
    if (GraphEmbeddingManager.instance) {
      return GraphEmbeddingManager.instance;
    }

    this.embeddingFunction = null;
    this.store = null;
    GraphEmbeddingManager.instance = this;
  }

  /**
   * Initialize the manager with store and embedding function
   * @param {Object} store - electron-store instance
   * @param {Function} embeddingFunction - Function that generates embeddings from text
   */
  async setup(store, embeddingFunction = null) {
    this.store = store;
    this.embeddingFunction = embeddingFunction;
  }

  /**
   * Check if graph embedding is enabled
   * @param {string} token - User token
   * @returns {boolean}
   */
  isEnabled(token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return false;
    const graphEnabled = this.store?.get('graph.enabled') ?? true;
    return graphEnabled && graphInterface.checkConnection();
  }

  /**
   * Generate embedding for text (placeholder - requires AI provider integration)
   * @param {string} text - Text to embed
   * @returns {Array<number>|null} Embedding vector or null
   */
  async generateEmbedding(text) {
    if (!this.embeddingFunction) {
      // Without an embedding function, we store text for full-text search
      return null;
    }
    try {
      return await this.embeddingFunction(text);
    } catch (e) {
      console.error('Error generating embedding:', e);
      return null;
    }
  }

  // ===========================================================================
  // BOOKMARK OPERATIONS
  // ===========================================================================

  /**
   * Add bookmark to graph with embedding
   * @param {Object} bookmark - Bookmark data
   * @param {string} token - User token
   */
  async addBookmark(bookmark, token) {
    if (!this.isEnabled(token)) return;

    const doc = `${bookmark.title || ''} ${bookmark.description || ''}`.trim();
    if (doc.length < 10) return;

    try {
      // Create bookmark node in graph
      const result = await graphInterface.createBookmark(bookmark, token);
      if (!result) return;

      // Generate and store embedding
      const embedding = await this.generateEmbedding(doc);
      if (embedding) {
        await graphInterface.storeEmbedding(
          result.id,
          'Bookmark',
          embedding,
          'default',
        );
      }

      console.log('Added bookmark to graph with embedding');
    } catch (e) {
      console.error('Error adding bookmark to graph:', e);
    }
  }

  // ===========================================================================
  // BOOK OPERATIONS
  // ===========================================================================

  /**
   * Add book content chunks to graph with embeddings
   * @param {Object} book - Book data
   * @param {string} token - User token
   */
  async addBook(book, token) {
    if (!this.isEnabled(token)) return;

    try {
      // Create book node in graph
      const result = await graphInterface.createBook(book, token);
      if (!result) return;

      // Book content is handled via processBookContent for EPUB/PDF
      console.log('Added book to graph');
    } catch (e) {
      console.error('Error adding book to graph:', e);
    }
  }

  /**
   * Process book content and store chunks with embeddings
   * Called from renderer after parsing EPUB/PDF content
   * @param {number} bookId - Book ID
   * @param {Array<{id: string, content: string, metadata: Object}>} chunks - Content chunks
   * @param {string} token - User token
   */
  async processBookContent(bookId, chunks, token) {
    if (!this.isEnabled(token)) return;

    try {
      for (const chunk of chunks) {
        // Create a BookChunk node linked to the book
        const session = graphInterface.adapter?.session;
        if (!session) return;

        const chunkId = chunk.id || `${bookId}|${Date.now()}`;
        await session.run(
          `
          MATCH (b:Book {id: $bookId})
          MERGE (c:BookChunk {id: $chunkId})
          SET c.content = $content,
              c.metadata = $metadata,
              c.createdAt = datetime()
          MERGE (b)-[:HAS_CHUNK]->(c)
          RETURN c
          `,
          {
            bookId,
            chunkId,
            content: chunk.content,
            metadata: JSON.stringify(chunk.metadata || {}),
          },
        );

        // Generate and store embedding for chunk
        const embedding = await this.generateEmbedding(chunk.content);
        if (embedding) {
          await graphInterface.storeEmbedding(
            chunkId,
            'BookChunk',
            embedding,
            'default',
          );
        }
      }

      console.log(`Processed ${chunks.length} chunks for book ${bookId}`);
    } catch (e) {
      console.error('Error processing book content:', e);
    }
  }

  // ===========================================================================
  // NOTE OPERATIONS
  // ===========================================================================

  /**
   * Add note to graph with embedding
   * @param {Object} noteObj - Note data
   * @param {string} token - User token
   */
  async addNote(noteObj, token) {
    if (!this.isEnabled(token)) return;

    let doc = noteObj.title || '';
    if (noteObj.cards) {
      if (noteObj.cards[0]) doc += ` ${noteObj.cards[0].text || ''}`;
      if (noteObj.cards[1]) doc += ` ${noteObj.cards[1].text || ''}`;
      if (noteObj.cards[2]) doc += ` ${noteObj.cards[2].text || ''}`;
    }
    doc = doc.trim();
    if (doc.length < 10) return;

    try {
      // Note is already created via SQLite, just store embedding
      const embedding = await this.generateEmbedding(doc);
      if (embedding) {
        await graphInterface.storeEmbedding(
          noteObj.id,
          'Note',
          embedding,
          'default',
        );
      }

      console.log('Added note embedding to graph');
    } catch (e) {
      console.error('Error adding note to graph:', e);
    }
  }

  /**
   * Sync note to graph (create node and store embedding)
   * @param {Object} noteObj - Note data from SQLite
   * @param {string} token - User token
   */
  async syncNote(noteObj, token) {
    if (!this.isEnabled(token)) return;

    try {
      // Create note in graph
      const result = await graphInterface.createNote(noteObj, token);
      if (!result) return;

      // Add embedding
      await this.addNote(noteObj, token);
    } catch (e) {
      console.error('Error syncing note to graph:', e);
    }
  }

  // ===========================================================================
  // MESSAGE OPERATIONS
  // ===========================================================================

  /**
   * Add message to graph with embedding
   * @param {Object} message - Message data
   * @param {number} chatId - Chat ID
   * @param {string} token - User token
   */
  async addMessage(message, chatId, token) {
    if (!this.isEnabled(token)) return;

    const doc = message.content || '';
    if (doc.length < 10) return;

    try {
      // Create message node in graph
      const result = await graphInterface.addMessage(message, chatId, token);
      if (!result) return;

      // Generate and store embedding
      const embedding = await this.generateEmbedding(doc);
      if (embedding) {
        await graphInterface.storeEmbedding(
          result.id,
          'Message',
          embedding,
          'default',
        );
      }

      console.log('Added message to graph with embedding');
    } catch (e) {
      console.error('Error adding message to graph:', e);
    }
  }

  // ===========================================================================
  // SEARCH OPERATIONS
  // ===========================================================================

  /**
   * Semantic search for books
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Array} Matching books
   */
  async searchBooks(query, token) {
    if (!this.isEnabled(token)) return [];

    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) {
        // Fall back to text search
        return graphInterface.searchNotes(query, token);
      }

      const results = await graphInterface.findSimilar(
        embedding,
        ['Book', 'BookChunk'],
        10,
        0.7,
        token,
      );

      // Extract unique books from results
      const bookIds = new Set();
      const books = [];

      for (const result of results) {
        let bookId = result.id;
        if (result.nodeType === 'BookChunk') {
          // Extract book ID from chunk
          const pos = bookId.indexOf('|');
          bookId = pos > 0 ? bookId.substring(0, pos) : bookId;
        }

        if (!bookIds.has(bookId)) {
          bookIds.add(bookId);
          const book = getBookById(bookId);
          if (book) books.push(book);
        }
      }

      return books;
    } catch (e) {
      console.error('Error searching books in graph:', e);
      return [];
    }
  }

  /**
   * Semantic search for notes
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Array} Matching notes
   */
  async searchNotes(query, token) {
    if (!this.isEnabled(token)) return [];

    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) {
        // Fall back to text search
        return graphInterface.searchNotes(query, token);
      }

      const results = await graphInterface.findSimilar(
        embedding,
        ['Note'],
        10,
        0.7,
        token,
      );

      const notes = [];
      for (const result of results) {
        const note = getNoteById(result.id, token);
        if (note) notes.push(note);
      }

      return notes;
    } catch (e) {
      console.error('Error searching notes in graph:', e);
      return [];
    }
  }

  /**
   * Semantic search for messages
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Array} Matching messages
   */
  async searchMessages(query, token) {
    if (!this.isEnabled(token)) return [];

    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) {
        // Fall back to text search
        return graphInterface.searchMessages(query, token);
      }

      const results = await graphInterface.findSimilar(
        embedding,
        ['Message'],
        10,
        0.7,
        token,
      );

      const messages = [];
      for (const result of results) {
        const message = getMessageById(result.id, token);
        if (message) messages.push(message);
      }

      return messages;
    } catch (e) {
      console.error('Error searching messages in graph:', e);
      return [];
    }
  }

  /**
   * Semantic search for bookmarks
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Array} Matching bookmarks
   */
  async searchBookmarks(query, token) {
    if (!this.isEnabled(token)) return [];

    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) {
        // Fall back to text search
        return graphInterface.searchBookmarks(query, token);
      }

      const results = await graphInterface.findSimilar(
        embedding,
        ['Bookmark'],
        10,
        0.7,
        token,
      );

      return results.map((r) => ({
        ...r,
        similarity: r.similarity,
      }));
    } catch (e) {
      console.error('Error searching bookmarks in graph:', e);
      return [];
    }
  }

  /**
   * Get book content by semantic query
   * @param {number} bookKey - Book ID
   * @param {string} bookType - 'epub' or 'pdf'
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Array} Matching content sections
   */
  async getBookContentByQuery(bookKey, bookType, query, token) {
    if (!this.isEnabled(token)) return [];

    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) return [];

      const session = graphInterface.adapter?.session;
      if (!session) return [];

      const result = await session.run(
        `
        MATCH (b:Book {id: $bookKey})-[:HAS_CHUNK]->(c:BookChunk)
        WHERE c.embedding IS NOT NULL
        WITH c,
             reduce(dot = 0.0, i IN range(0, size(c.embedding)-1) |
               dot + c.embedding[i] * $embedding[i]) /
             (sqrt(reduce(a = 0.0, i IN range(0, size(c.embedding)-1) |
               a + c.embedding[i] * c.embedding[i])) *
              sqrt(reduce(b = 0.0, i IN range(0, size($embedding)-1) |
               b + $embedding[i] * $embedding[i]))) AS similarity
        WHERE similarity > 0.7
        RETURN c.id AS id, c.content AS content, c.metadata AS metadata, similarity
        ORDER BY similarity DESC
        LIMIT 10
        `,
        { bookKey, embedding },
      );

      return result.records.map((record) => {
        const id = record.get('id');
        const content = record.get('content');
        const metadata = JSON.parse(record.get('metadata') || '{}');

        if (bookType === 'epub') {
          const pos = id.indexOf('|');
          return {
            data: {
              bookKey: id.substring(0, pos),
              cfi: id.substring(pos + 1),
              excerpt: content,
              type: bookType,
            },
          };
        } else if (bookType === 'pdf') {
          const pos = id.indexOf('|');
          const pos2 = id.indexOf('|', pos + 2);
          return {
            data: {
              id: id.substring(0, pos),
              position: {
                boundingRect: {
                  x1: 0,
                  y1: 0,
                  x2: 10,
                  y2: 10,
                  width: 10,
                  height: 10,
                  pageNumber: parseInt(id.substring(pos + 1, pos2)) || 1,
                },
                rects: [{ x1: 0, y1: 0, x2: 10, y2: 10, width: 10, height: 10 }],
                pageNumber: parseInt(id.substring(pos + 1, pos2)) || 1,
              },
              content: { text: content },
              type: bookType,
            },
          };
        }
        return { data: { content, metadata } };
      });
    } catch (e) {
      console.error('Error getting book content by query:', e);
      return [];
    }
  }

  // ===========================================================================
  // IN-MEMORY TEMPORARY COLLECTION (for RAG context)
  // ===========================================================================

  /**
   * Add content to temporary in-memory storage for RAG
   * @param {string} content - Content to store
   * @returns {boolean} Success
   */
  async addContentToTempStorage(content) {
    // For temporary storage, we use the existing ChromaDB approach
    // or a simple in-memory cache since Neo4j persists data
    // This is typically for RAG context during a session
    this._tempContent = splitTextIntoChunks(content, 500);
    return true;
  }

  /**
   * Query temporary storage
   * @param {string} query - Search query
   * @returns {Array} Matching chunks
   */
  async queryTempStorage(query) {
    if (!this._tempContent) return [];

    // Simple keyword matching for temp storage
    const queryLower = query.toLowerCase();
    return this._tempContent.filter((chunk) =>
      chunk.toLowerCase().includes(queryLower),
    );
  }

  // ===========================================================================
  // BOOK CHUNK OPERATIONS (New - replaces ChromaDB book storage)
  // ===========================================================================

  /**
   * Import book content as chunks with embeddings
   * This is the main method for ingesting books into vector storage
   *
   * @param {string} bookId - Book ID from SQLite
   * @param {Array} chunks - Array of {text, chunkIndex, pageNum?, cfi?, sectionTitle?}
   * @param {Object} options - Options {generateEmbeddings: boolean}
   * @param {string} token - User token
   * @returns {Object} Result {chunksCreated, hasEmbeddings}
   */
  async importBookChunks(bookId, chunks, options = {}, token) {
    if (!this.isEnabled(token)) {
      return { chunksCreated: 0, error: 'Graph embedding not enabled' };
    }

    const { generateEmbeddings = true } = options;

    try {
      // Generate embeddings if requested and function available
      let embeddings = [];
      if (generateEmbeddings && this.embeddingFunction) {
        console.log(`GraphEmbeddingManager: Generating embeddings for ${chunks.length} chunks`);
        embeddings = await this.batchGenerateEmbeddings(chunks.map(c => c.text));
      }

      // Store chunks in Neo4j
      const chunksCreated = await neo4jAdapter.batchCreateChunks(
        bookId,
        chunks,
        embeddings,
        token
      );

      console.log(`GraphEmbeddingManager: Imported ${chunksCreated} chunks for book ${bookId}`);

      return {
        chunksCreated,
        hasEmbeddings: embeddings.length > 0 && embeddings[0] !== null,
      };
    } catch (error) {
      console.error('GraphEmbeddingManager: Error importing book chunks:', error);
      return { chunksCreated: 0, error: error.message };
    }
  }

  /**
   * Batch generate embeddings for multiple texts
   * @param {string[]} texts - Array of texts to embed
   * @returns {(number[]|null)[]} Array of embeddings
   */
  async batchGenerateEmbeddings(texts) {
    if (!this.embeddingFunction) {
      return texts.map(() => null);
    }

    try {
      // If embedding function supports batch, use it
      if (this.embeddingFunction.batch) {
        return await this.embeddingFunction.batch(texts);
      }

      // Otherwise generate one by one with progress logging
      const embeddings = [];
      const batchSize = 10;

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        );
        embeddings.push(...batchEmbeddings);

        if (i > 0 && i % 100 === 0) {
          console.log(`GraphEmbeddingManager: Generated ${i}/${texts.length} embeddings`);
        }
      }

      return embeddings;
    } catch (error) {
      console.error('GraphEmbeddingManager: Error batch generating embeddings:', error);
      return texts.map(() => null);
    }
  }

  /**
   * Search book chunks by semantic similarity
   * @param {string} query - Search query
   * @param {string} bookId - Optional book ID to filter
   * @param {number} limit - Max results
   * @param {string} token - User token
   * @returns {Array} Matching chunks with similarity
   */
  async searchBookChunks(query, bookId, limit = 10, token) {
    if (!this.isEnabled(token)) return [];

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        console.warn('GraphEmbeddingManager: Cannot search without embedding');
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
        cfi: r.chunk.cfi,
        sectionTitle: r.chunk.sectionTitle,
        similarity: r.similarity,
      }));
    } catch (error) {
      console.error('GraphEmbeddingManager: Error searching book chunks:', error);
      return [];
    }
  }

  /**
   * Get all chunks for a book
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {Array} Chunks
   */
  async getBookChunks(bookId, token) {
    if (!this.isEnabled(token)) return [];

    try {
      return await neo4jAdapter.getChunksByBook(bookId, token);
    } catch (error) {
      console.error('GraphEmbeddingManager: Error getting book chunks:', error);
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
      console.log(`GraphEmbeddingManager: Deleted chunks for book ${bookId}`);
    } catch (error) {
      console.error('GraphEmbeddingManager: Error deleting book chunks:', error);
    }
  }

  /**
   * Ensure embeddings exist for all chunks (lazy generation)
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {number} Number of embeddings generated
   */
  async ensureBookChunkEmbeddings(bookId, token) {
    if (!this.isEnabled(token) || !this.embeddingFunction) {
      return 0;
    }

    try {
      const chunks = await neo4jAdapter.getChunksWithoutEmbeddings(bookId, token);

      if (chunks.length === 0) {
        return 0;
      }

      console.log(`GraphEmbeddingManager: Generating embeddings for ${chunks.length} chunks`);

      let generated = 0;
      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk.text);
        if (embedding) {
          await neo4jAdapter.updateChunkEmbedding(chunk.id, embedding);
          generated++;
        }
      }

      return generated;
    } catch (error) {
      console.error('GraphEmbeddingManager: Error ensuring chunk embeddings:', error);
      return 0;
    }
  }

  // ===========================================================================
  // KEY CONCEPT OPERATIONS
  // ===========================================================================

  /**
   * Store key concepts extracted from book metadata
   * @param {string} bookId - Book ID
   * @param {Array} concepts - Array of {name, description, category, importance}
   * @param {string} token - User token
   * @returns {number} Number created
   */
  async storeKeyConcepts(bookId, concepts, token) {
    if (!this.isEnabled(token)) return 0;

    try {
      // Assign IDs to concepts if not present
      const conceptsWithIds = concepts.map((c, idx) => ({
        ...c,
        id: c.id || `concept_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
      }));

      // Create concept nodes in Neo4j
      const created = await neo4jAdapter.createKeyConcepts(bookId, conceptsWithIds, token);

      // Generate and store embeddings for concepts
      if (this.embeddingFunction && conceptsWithIds.length > 0) {
        const conceptTexts = conceptsWithIds.map(c =>
          `${c.name}${c.description ? ': ' + c.description : ''}`
        );
        const embeddings = await this.batchGenerateEmbeddings(conceptTexts);

        const conceptEmbeddings = conceptsWithIds
          .map((c, idx) => ({
            conceptId: c.id,
            embedding: embeddings[idx],
          }))
          .filter(ce => ce.embedding !== null);

        if (conceptEmbeddings.length > 0) {
          await neo4jAdapter.storeConceptEmbeddings(bookId, conceptEmbeddings);
        }
      }

      console.log(`GraphEmbeddingManager: Stored ${created} key concepts for book ${bookId}`);
      return created;
    } catch (error) {
      console.error('GraphEmbeddingManager: Error storing key concepts:', error);
      return 0;
    }
  }

  /**
   * Get key concepts for a book
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {Array} Concepts
   */
  async getKeyConcepts(bookId, token) {
    if (!this.isEnabled(token)) return [];

    try {
      return await neo4jAdapter.getKeyConceptsByBook(bookId, token);
    } catch (error) {
      console.error('GraphEmbeddingManager: Error getting key concepts:', error);
      return [];
    }
  }

  /**
   * Tag chunks with matching concepts and derive relationships
   * This builds the concept graph from chunk-concept similarities
   *
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   */
  async buildConceptGraph(bookId, token) {
    if (!this.isEnabled(token)) return;

    try {
      // Tag chunks with concepts based on embedding similarity
      await neo4jAdapter.tagChunksWithConcepts(bookId, 0.75, token);

      // Derive relationships from co-occurrence
      await neo4jAdapter.deriveConceptRelationships(bookId, 2, token);

      console.log(`GraphEmbeddingManager: Built concept graph for book ${bookId}`);
    } catch (error) {
      console.error('GraphEmbeddingManager: Error building concept graph:', error);
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
    if (!this.isEnabled(token)) return 0;

    try {
      return await neo4jAdapter.createLearningPoints(topicId, learningPoints, token);
    } catch (error) {
      console.error('GraphEmbeddingManager: Error creating learning points:', error);
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
    if (!this.isEnabled(token)) return [];

    try {
      return await neo4jAdapter.getLearningPointsByTopic(topicId, filters, token);
    } catch (error) {
      console.error('GraphEmbeddingManager: Error getting learning points:', error);
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
      console.error('GraphEmbeddingManager: Error updating learning point:', error);
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
  async getLearningPointsDue(topicId, limit = 20, token) {
    if (!this.isEnabled(token)) return [];

    try {
      return await neo4jAdapter.getLearningPointsDueForReview(topicId, limit, token);
    } catch (error) {
      console.error('GraphEmbeddingManager: Error getting due learning points:', error);
      return [];
    }
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get vector storage statistics
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
        hasEmbeddingFunction: !!this.embeddingFunction,
        chunks: stats.Chunk || 0,
        keyConcepts: stats.KeyConcept || 0,
        learningPoints: stats.LearningPoint || 0,
        notes: stats.Note || 0,
        messages: stats.Message || 0,
        books: stats.Book || 0,
        bookmarks: stats.Bookmark || 0,
      };
    } catch (error) {
      console.error('GraphEmbeddingManager: Error getting stats:', error);
      return { enabled: true, error: error.message };
    }
  }
}

// Export singleton instance
const graphEmbeddingManager = new GraphEmbeddingManager();
export default graphEmbeddingManager;
