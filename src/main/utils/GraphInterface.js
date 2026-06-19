/**
 * GraphInterface.js
 *
 * Abstract interface for graph database operations.
 * This abstraction layer allows swapping between different graph backends:
 * - Kùzu (default - embedded, MIT license, no external server)
 * - Neo4j (external server required)
 * - Graphiti (future - Python-based graph memory layer)
 *
 * All graph operations should go through this interface, not directly to the adapter.
 *
 * Usage:
 *   import graphInterface from './GraphInterface';
 *
 *   // Initialize with desired adapter (defaults to 'kuzu')
 *   await graphInterface.initialize('kuzu', store);
 *
 *   // Use the interface (adapter-agnostic)
 *   const note = await graphInterface.createNote(noteData, token);
 */

// Default adapter type - Kùzu is preferred as it's embedded (no external server)
const DEFAULT_ADAPTER_TYPE = 'kuzu';

/**
 * @typedef {Object} GraphAdapter
 * @property {function} connect - Connect to the graph database
 * @property {function} disconnect - Disconnect from the graph database
 * @property {function} checkConnection - Check if connected
 * @property {function} createNote - Create a note node
 * @property {function} getNoteById - Get note by ID
 * @property {function} getNotesBySource - Get notes by source (book, URL)
 * @property {function} updateNote - Update a note field
 * @property {function} deleteNote - Delete a note
 * @property {function} searchNotes - Search notes by text
 * @property {function} createVocabulary - Create vocabulary node
 * @property {function} getVocabularyByWord - Get vocabulary by word
 * @property {function} getDueForReview - Get items due for Leitner review
 * @property {function} recordReview - Record a review outcome
 * @property {function} addNoteToLeitnerStudy - Add note to Leitner system
 * @property {function} upsertConcept - Create/update concept node
 * @property {function} createMentionsRelationship - Link note to concept
 * @property {function} startLearningSession - Start episodic session
 * @property {function} endLearningSession - End episodic session
 * @property {function} storeEmbedding - Store vector embedding
 * @property {function} findSimilar - Find similar nodes by embedding
 * @property {function} getLearningPath - Get prerequisite path to concept
 * @property {function} getKnowledgeAtTime - Temporal query for knowledge state
 */

class GraphInterface {
  constructor() {
    if (GraphInterface.instance) {
      return GraphInterface.instance;
    }

    /** @type {GraphAdapter|null} */
    this.adapter = null;
    this.adapterType = null;
    this.isInitialized = false;
    this.loadError = null; // Store any initialization/load errors

    GraphInterface.instance = this;
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize the graph interface with a specific adapter
   * @param {string} adapterType - 'kuzu' (default), 'neo4j', or 'graphiti' (future)
   * @param {Object} store - Electron store for configuration
   * @returns {Promise<boolean>}
   */
  async initialize(adapterType = DEFAULT_ADAPTER_TYPE, store) {
    if (this.isInitialized && this.adapterType === adapterType) {
      console.log(`[GraphInterface] Already initialized with ${adapterType}`);
      return true;
    }

    // Disconnect existing adapter if switching
    if (this.adapter && this.adapterType !== adapterType) {
      await this.disconnect();
    }

    try {
      switch (adapterType) {
        case 'neo4j':
          const Neo4jAdapter = require('./Neo4jAdapter').default;
          this.adapter = Neo4jAdapter;
          break;

        case 'kuzu':
          // Kùzu embedded graph database (MIT license, embeddable).
          // isKuzuAvailable + getKuzuLoadError are STATIC methods on the
          // class; the singleton instance is on `.default`. Need both.
          const kuzuAdapterModule = require('./KuzuAdapter');
          const KuzuAdapterClass = kuzuAdapterModule.KuzuAdapter;
          const kuzuAdapterInstance = kuzuAdapterModule.default;
          if (!KuzuAdapterClass.isKuzuAvailable()) {
            const loadError = KuzuAdapterClass.getKuzuLoadError();
            console.warn('[GraphInterface] Kuzu native module not available:', loadError?.message);
            this.loadError = loadError;
            this.isInitialized = false;
            return false;
          }
          this.adapter = kuzuAdapterInstance;
          break;

        case 'graphiti':
          // Future: Graphiti adapter
          // const GraphitiAdapter = require('./GraphitiAdapter').default;
          // this.adapter = GraphitiAdapter;
          throw new Error('Graphiti adapter not yet implemented');

        default:
          throw new Error(`Unknown adapter type: ${adapterType}`);
      }

      this.adapterType = adapterType;
      const connected = await this.adapter.connect(store);
      this.isInitialized = connected;

      console.log(
        `[GraphInterface] Initialized with ${adapterType}: ${connected}`,
      );
      return connected;
    } catch (error) {
      console.error(
        `[GraphInterface] Failed to initialize ${adapterType}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get the current adapter type
   * @returns {string|null}
   */
  getAdapterType() {
    return this.adapterType;
  }

  /**
   * Check if interface is initialized
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && this.adapter !== null;
  }

  /**
   * Get comprehensive status information for the graph interface
   * @returns {Object} Status object with adapter info, connection state, and capabilities
   */
  getStatus() {
    const status = {
      initialized: this.isInitialized,
      adapterType: this.adapterType,
      connected: this.checkConnection(),
      available: this.isReady(),
      capabilities: {
        vectorSearch: false,
        leitnerSystem: false,
        learningPaths: false,
        knowledgeWeb: false,
        embeddedDatabase: this.adapterType === 'kuzu',
        requiresExternalServer: this.adapterType === 'neo4j',
      },
      error: null,
      nativeModuleAvailable: true,
    };

    // Check if kuzu native module is available (for kuzu adapter)
    if (this.adapterType === 'kuzu' || !this.adapterType) {
      try {
        const { KuzuAdapter } = require('./KuzuAdapter');
        status.nativeModuleAvailable = KuzuAdapter.isKuzuAvailable();
        if (!status.nativeModuleAvailable) {
          const loadError = KuzuAdapter.getKuzuLoadError();
          status.error = loadError ? loadError.message : 'Kuzu native module not available';
        }
      } catch (e) {
        status.nativeModuleAvailable = false;
        status.error = e.message;
      }
    }

    // Check adapter-specific capabilities
    if (this.adapter) {
      status.capabilities.vectorSearch = typeof this.adapter.findSimilar === 'function';
      status.capabilities.leitnerSystem = typeof this.adapter.recordLeitnerReview === 'function';
      status.capabilities.learningPaths = typeof this.adapter.getPersonalizedLearningPath === 'function';
      status.capabilities.knowledgeWeb = typeof this.adapter.getBacklinks === 'function';

      // Get adapter-specific config if available
      if (this.adapter.config) {
        status.dbPath = this.adapter.config.dbPath || null;
      }

      // Get adapter load error if any
      if (this.adapter.loadError) {
        status.error = this.adapter.loadError.message || String(this.adapter.loadError);
      }
    }

    // Include interface-level load error
    if (this.loadError && !status.error) {
      status.error = this.loadError.message || String(this.loadError);
    }

    return status;
  }

  /**
   * Get the default adapter type
   * @returns {string}
   */
  static getDefaultAdapterType() {
    return DEFAULT_ADAPTER_TYPE;
  }

  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  /**
   * Connect to the graph database
   * @param {Object} store - Configuration store
   * @returns {Promise<boolean>}
   */
  async connect(store) {
    this._ensureAdapter();
    const result = await this.adapter.connect(store);
    this.isInitialized = result;
    return result;
  }

  /**
   * Disconnect from the graph database
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.isInitialized = false;
    }
  }

  /**
   * Check connection status
   * @returns {boolean}
   */
  checkConnection() {
    return this.adapter ? this.adapter.checkConnection() : false;
  }

  // ===========================================================================
  // USER OPERATIONS
  // ===========================================================================

  /**
   * Create or update user
   * @param {Object} user - User data
   * @returns {Promise<Object|null>}
   */
  async upsertUser(user) {
    this._ensureAdapter();
    return this.adapter.upsertUser(user);
  }

  // ===========================================================================
  // BOOK OPERATIONS
  // ===========================================================================

  /**
   * Create a book node
   * @param {Object} book - Book data
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async createBook(book, token) {
    this._ensureAdapter();
    return this.adapter.createBook(book, token);
  }

  /**
   * Get books for user
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getBooksByUser(token) {
    this._ensureAdapter();
    return this.adapter.getBooksByUser(token);
  }

  // ===========================================================================
  // NOTE OPERATIONS (Core of the learning system)
  // ===========================================================================

  /**
   * Create a note
   * @param {Object} note - Note data
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async createNote(note, token) {
    this._ensureAdapter();
    return this.adapter.createNote(note, token);
  }

  /**
   * Get note by ID
   * @param {string|number} noteId - Note ID
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async getNoteById(noteId, token) {
    this._ensureAdapter();
    return this.adapter.getNoteById(noteId, token);
  }

  /**
   * Get notes by source (book, URL, etc.)
   * @param {string} sourceKey - Source identifier
   * @param {string} sourceType - 'book', 'url', etc.
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getNotesBySource(sourceKey, sourceType, token) {
    this._ensureAdapter();
    return this.adapter.getNotesBySource(sourceKey, sourceType, token);
  }

  /**
   * Update a note field
   * @param {string|number} noteId - Note ID
   * @param {string} field - Field name
   * @param {any} value - New value
   * @param {string} token - User token
   * @returns {Promise<number>} 1 on success, -1 on failure
   */
  async updateNote(noteId, field, value, token) {
    this._ensureAdapter();
    return this.adapter.updateNote(noteId, field, value, token);
  }

  /**
   * Sync full note object to graph (create or update)
   * @param {Object} note - Full note object from SQLite
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async syncNote(note, token) {
    this._ensureAdapter();
    // Try to find existing note
    const existing = await this.adapter.getNoteById(note.id, token);
    if (existing) {
      // Update existing - use createNote which does MERGE
      return this.adapter.createNote(note, token);
    }
    return this.adapter.createNote(note, token);
  }

  /**
   * Delete a note
   * @param {string|number} noteId - Note ID
   * @param {string} token - User token
   * @returns {Promise<number>} 1 on success, -1 on failure
   */
  async deleteNote(noteId, token) {
    this._ensureAdapter();
    return this.adapter.deleteNote(noteId, token);
  }

  /**
   * Search notes by text
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async searchNotes(query, token) {
    this._ensureAdapter();
    return this.adapter.searchNotes(query, token);
  }

  // ===========================================================================
  // VOCABULARY OPERATIONS
  // ===========================================================================

  /**
   * Create vocabulary
   * @param {Object} vocab - Vocabulary data
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async createVocabulary(vocab, token) {
    this._ensureAdapter();
    return this.adapter.createVocabulary(vocab, token);
  }

  /**
   * Get vocabulary by word
   * @param {string} word - Word to look up
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async getVocabularyByWord(word, token) {
    this._ensureAdapter();
    return this.adapter.getVocabularyByWord(word, token);
  }

  // ===========================================================================
  // SPACED REPETITION (LEITNER SYSTEM)
  // ===========================================================================

  /**
   * Get items due for review
   * @param {Date} asOfDate - Date to check against
   * @param {Array<string>} itemTypes - ['note', 'vocabulary']
   * @param {number} limit - Max items
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getDueForReview(asOfDate, itemTypes, limit, token) {
    this._ensureAdapter();
    return this.adapter.getDueForReview(asOfDate, itemTypes, limit, token);
  }

  /**
   * Record a review outcome
   * @param {string|number} itemId - Item ID
   * @param {string} itemType - 'note' or 'vocabulary'
   * @param {string} outcome - 'correct', 'incorrect', 'skipped'
   * @param {number} leitnerSpeed - Speed factor (1=fast, 2=normal, 4=slow)
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async recordReview(itemId, itemType, outcome, leitnerSpeed, token) {
    this._ensureAdapter();
    return this.adapter.recordReview(
      itemId,
      itemType,
      outcome,
      leitnerSpeed,
      token,
    );
  }

  /**
   * Add note to Leitner study
   * @param {string|number} noteId - Note ID
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async addNoteToLeitnerStudy(noteId, token) {
    this._ensureAdapter();
    return this.adapter.addNoteToLeitnerStudy(noteId, token);
  }

  // ===========================================================================
  // CONCEPT OPERATIONS
  // ===========================================================================

  /**
   * Create or update concept
   * @param {Object} concept - Concept data
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async upsertConcept(concept, token) {
    this._ensureAdapter();
    return this.adapter.upsertConcept(concept, token);
  }

  /**
   * Create MENTIONS_CONCEPT relationship
   * @param {string|number} noteId - Note ID
   * @param {string|number} conceptId - Concept ID
   * @param {number} frequency - Mention count
   * @param {number} importance - Importance score (0-1)
   * @returns {Promise<void>}
   */
  async createMentionsRelationship(noteId, conceptId, frequency, importance) {
    this._ensureAdapter();
    return this.adapter.createMentionsRelationship(
      noteId,
      conceptId,
      frequency,
      importance,
    );
  }

  // ===========================================================================
  // LEARNING SESSION (EPISODIC MEMORY)
  // ===========================================================================

  /**
   * Start a learning session
   * @param {string} activityType - 'reading', 'reviewing', 'quizzing', 'browsing', 'chatting'
   * @param {string|null} resourceType - 'book', 'url', 'note', or null
   * @param {string|number|null} resourceId - Resource ID or null
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async startLearningSession(activityType, resourceType, resourceId, token) {
    this._ensureAdapter();
    return this.adapter.startLearningSession(
      activityType,
      resourceType,
      resourceId,
      token,
    );
  }

  /**
   * End a learning session
   * @param {string|number} sessionId - Session ID
   * @param {Object} stats - Session statistics
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async endLearningSession(sessionId, stats, token) {
    this._ensureAdapter();
    return this.adapter.endLearningSession(sessionId, stats, token);
  }

  // ===========================================================================
  // SEMANTIC SEARCH (EMBEDDINGS)
  // ===========================================================================

  /**
   * Store embedding for a node
   * @param {string|number} nodeId - Node ID
   * @param {string} nodeType - Node type
   * @param {Array<number>} embedding - Embedding vector
   * @param {string} model - Embedding model used
   * @returns {Promise<void>}
   */
  async storeEmbedding(nodeId, nodeType, embedding, model) {
    this._ensureAdapter();
    return this.adapter.storeEmbedding(nodeId, nodeType, embedding, model);
  }

  /**
   * Find similar nodes by embedding
   * @param {Array<number>} queryEmbedding - Query embedding
   * @param {Array<string>} nodeTypes - Node types to search
   * @param {number} limit - Max results
   * @param {number} minSimilarity - Min similarity threshold (0-1)
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async findSimilar(queryEmbedding, nodeTypes, limit, minSimilarity, token) {
    this._ensureAdapter();
    return this.adapter.findSimilar(
      queryEmbedding,
      nodeTypes,
      limit,
      minSimilarity,
      token,
    );
  }

  // ===========================================================================
  // BOOK CHUNK OPERATIONS (RAG / vector search over book content)
  // ===========================================================================

  /**
   * Batch create Chunk nodes attached to a book, with optional embeddings.
   * @param {string} bookId
   * @param {Array<{id?:string, text:string, chunkIndex:number, pageNum?:number, cfi?:string, sectionTitle?:string}>} chunks
   * @param {Array<number[]|null>} embeddings - Aligned with chunks; entries may be null
   * @param {string} token
   * @returns {Promise<number>} count created
   */
  async batchCreateChunks(bookId, chunks, embeddings, token) {
    this._ensureAdapter();
    if (typeof this.adapter.batchCreateChunks !== 'function') {
      console.warn('[GraphInterface] Adapter does not support batchCreateChunks');
      return 0;
    }
    return this.adapter.batchCreateChunks(bookId, chunks, embeddings, token);
  }

  /**
   * Vector similarity search over book chunks.
   * @param {number[]} queryEmbedding
   * @param {{bookId?:string|number, userId?:string|number}} filters
   * @param {number} limit
   * @param {number} minSimilarity
   * @returns {Promise<Array<{chunk:Object, similarity:number}>>}
   */
  async searchSimilarChunks(queryEmbedding, filters = {}, limit = 10, minSimilarity = 0.7) {
    this._ensureAdapter();
    if (typeof this.adapter.searchSimilarChunks !== 'function') {
      console.warn('[GraphInterface] Adapter does not support searchSimilarChunks');
      return [];
    }
    return this.adapter.searchSimilarChunks(queryEmbedding, filters, limit, minSimilarity);
  }

  async getChunksByBook(bookId, token) {
    this._ensureAdapter();
    if (typeof this.adapter.getChunksByBook !== 'function') return [];
    return this.adapter.getChunksByBook(bookId, token);
  }

  async getChunksWithoutEmbeddings(bookId, token) {
    this._ensureAdapter();
    if (typeof this.adapter.getChunksWithoutEmbeddings !== 'function') return [];
    return this.adapter.getChunksWithoutEmbeddings(bookId, token);
  }

  async updateChunkEmbedding(chunkId, embedding, model) {
    this._ensureAdapter();
    if (typeof this.adapter.updateChunkEmbedding !== 'function') return;
    return this.adapter.updateChunkEmbedding(chunkId, embedding, model);
  }

  async deleteChunksByBook(bookId, token) {
    this._ensureAdapter();
    if (typeof this.adapter.deleteChunksByBook !== 'function') return 0;
    return this.adapter.deleteChunksByBook(bookId, token);
  }

  /**
   * Ensure any adapter-side index structures for chunk embeddings exist.
   * On Kùzu this is a no-op (indexes created at schema time); on Neo4j
   * it runs the index DDL.
   */
  async createChunkIndexes() {
    this._ensureAdapter();
    if (typeof this.adapter.createChunkIndexes !== 'function') return;
    return this.adapter.createChunkIndexes();
  }

  // ===========================================================================
  // LEARNING PATH
  // ===========================================================================

  /**
   * Get learning path to a concept
   * @param {string|number} targetConceptId - Target concept ID
   * @param {number} maxDepth - Max path depth
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async getLearningPath(targetConceptId, maxDepth, token) {
    this._ensureAdapter();
    return this.adapter.getLearningPath(targetConceptId, maxDepth, token);
  }

  /**
   * Get knowledge state at a point in time (temporal query)
   * @param {Date} asOfDate - Point in time
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getKnowledgeAtTime(asOfDate, token) {
    this._ensureAdapter();
    return this.adapter.getKnowledgeAtTime(asOfDate, token);
  }

  // ===========================================================================
  // CHAT OPERATIONS
  // ===========================================================================

  /**
   * Create a chat
   * @param {Object} chat - Chat data
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async createChat(chat, token) {
    this._ensureAdapter();
    return this.adapter.createChat(chat, token);
  }

  /**
   * Add message to chat
   * @param {Object} message - Message data
   * @param {string|number} chatId - Chat ID
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async addMessage(message, chatId, token) {
    this._ensureAdapter();
    return this.adapter.addMessage(message, chatId, token);
  }

  /**
   * Search messages by text
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async searchMessages(query, token) {
    this._ensureAdapter();
    return this.adapter.searchMessages(query, token);
  }

  // ===========================================================================
  // BOOKMARK OPERATIONS
  // ===========================================================================

  /**
   * Create a bookmark
   * @param {Object} bookmark - Bookmark data
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async createBookmark(bookmark, token) {
    this._ensureAdapter();
    return this.adapter.createBookmark(bookmark, token);
  }

  /**
   * Get bookmarks by source
   * @param {string} sourceKey - Source identifier (URL)
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getBookmarksBySource(sourceKey, token) {
    this._ensureAdapter();
    return this.adapter.getBookmarksBySource(sourceKey, token);
  }

  /**
   * Search bookmarks by text
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async searchBookmarks(query, token) {
    this._ensureAdapter();
    return this.adapter.searchBookmarks(query, token);
  }

  // ===========================================================================
  // STATS
  // ===========================================================================

  /**
   * Get graph statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    this._ensureAdapter();
    if (typeof this.adapter.getStats === 'function') {
      return this.adapter.getStats();
    }
    return {};
  }

  // ===========================================================================
  // KNOWLEDGE WEB - LINK OPERATIONS
  // ===========================================================================

  /**
   * Get backlinks for a target (notes linking TO the target)
   * @param {string} targetId - Target node ID
   * @param {string} targetType - 'note', 'vocabulary', 'concept'
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getBacklinks(targetId, targetType, token) {
    this._ensureAdapter();
    if (typeof this.adapter.getBacklinks === 'function') {
      return this.adapter.getBacklinks(targetId, targetType, token);
    }
    return [];
  }

  /**
   * Get outgoing links from a note
   * @param {string} noteId - Source note ID
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getOutgoingLinks(noteId, token) {
    this._ensureAdapter();
    if (typeof this.adapter.getOutgoingLinks === 'function') {
      return this.adapter.getOutgoingLinks(noteId, token);
    }
    return [];
  }

  /**
   * Sync note links - replace all LINKS_TO relationships
   * @param {string} noteId - Source note ID
   * @param {Array} links - Array of link objects
   * @param {string} token - User token
   * @returns {Promise<Object>}
   */
  async syncNoteLinks(noteId, links, token) {
    this._ensureAdapter();
    if (typeof this.adapter.syncNoteLinks === 'function') {
      return this.adapter.syncNoteLinks(noteId, links, token);
    }
    return { success: false, error: 'Not supported by adapter' };
  }

  /**
   * Search for items to link (vocabulary, concepts, notes)
   * @param {string} query - Search query
   * @param {string} token - User token
   * @param {number} limit - Max results
   * @returns {Promise<Array>}
   */
  async searchForLinking(query, token, limit = 15) {
    this._ensureAdapter();
    if (typeof this.adapter.searchForLinking === 'function') {
      return this.adapter.searchForLinking(query, token, limit);
    }
    return [];
  }

  /**
   * Find notes with shared tags
   * @param {Array} tags - Tags to search for
   * @param {string} excludeNoteId - Note ID to exclude
   * @param {string} token - User token
   * @param {number} minSharedTags - Minimum shared tags
   * @returns {Promise<Array>}
   */
  async findNotesBySharedTags(tags, excludeNoteId, token, minSharedTags = 2) {
    this._ensureAdapter();
    if (typeof this.adapter.findNotesBySharedTags === 'function') {
      return this.adapter.findNotesBySharedTags(tags, excludeNoteId, token, minSharedTags);
    }
    return [];
  }

  /**
   * Find semantically similar notes
   * @param {string} noteId - Source note ID
   * @param {Array} embedding - Embedding vector
   * @param {number} threshold - Similarity threshold
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async findSemanticallySimilarNotes(noteId, embedding, threshold, token) {
    this._ensureAdapter();
    if (typeof this.adapter.findSemanticallySimilarNotes === 'function') {
      return this.adapter.findSemanticallySimilarNotes(noteId, embedding, threshold, token);
    }
    return [];
  }

  /**
   * Get link preview data
   * @param {string} type - Target type
   * @param {string} id - Target ID
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async getLinkPreview(type, id, token) {
    this._ensureAdapter();
    if (typeof this.adapter.getLinkPreview === 'function') {
      return this.adapter.getLinkPreview(type, id, token);
    }
    return null;
  }

  // ===========================================================================
  // EPISODIC MEMORY / BRAIN
  // ===========================================================================

  /**
   * Batch create Episode nodes (for EpisodeCollector)
   * @param {Array} events - Array of episode events
   * @returns {Promise<Object>} Result with count
   */
  async batchCreateEpisodes(events) {
    this._ensureAdapter();
    if (!this.adapter.batchCreateEpisodes) {
      console.warn('[GraphInterface] Adapter does not support batchCreateEpisodes');
      return { created: 0 };
    }
    return this.adapter.batchCreateEpisodes(events);
  }

  // ===========================================================================
  // UNIFIED LEARNING POINT OPERATIONS
  // ===========================================================================

  /**
   * Create a unified learning point
   * Replaces separate Note/Vocabulary creation with a single unified entity
   * @param {Object} point - Learning point data
   * @param {string} point.itemType - 'word', 'concept', 'note', 'pdf_annotation', 'formula'
   * @param {string} point.domainType - 'vocabulary', 'knowledge', 'math', 'reading'
   * @param {string} point.title - Display title
   * @param {string|Object} point.front - Question/term (JSON for complex types)
   * @param {string|Object} point.back - Answer/definition (JSON for complex types)
   * @param {Object} point.extras - Type-specific extra data
   * @param {string} point.sourceType - 'book', 'url', 'chat', 'manual'
   * @param {string} point.sourceId - Source reference ID
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async createLearningPoint(point, token) {
    this._ensureAdapter();
    if (typeof this.adapter.createLearningPoint !== 'function') {
      console.warn('[GraphInterface] Adapter does not support createLearningPoint');
      return null;
    }
    return this.adapter.createLearningPoint(point, token);
  }

  /**
   * Batch create multiple learning points
   * @param {Array<Object>} points - Array of learning point data
   * @param {string} token - User token
   * @returns {Promise<{created: number, errors: Array}>}
   */
  async createLearningPointsBatch(points, token) {
    this._ensureAdapter();
    if (typeof this.adapter.createLearningPointsBatch !== 'function') {
      console.warn('[GraphInterface] Adapter does not support createLearningPointsBatch');
      return { created: 0, errors: [{ error: 'Not supported by adapter' }] };
    }
    return this.adapter.createLearningPointsBatch(points, token);
  }

  /**
   * Get learning point by ID
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async getLearningPointById(id, token) {
    this._ensureAdapter();
    if (typeof this.adapter.getLearningPointById !== 'function') {
      console.warn('[GraphInterface] Adapter does not support getLearningPointById');
      return null;
    }
    return this.adapter.getLearningPointById(id, token);
  }

  /**
   * Update learning point properties
   * @param {string} id - Learning point ID
   * @param {Object} updates - Properties to update
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async updateLearningPoint(id, updates, token) {
    this._ensureAdapter();
    if (typeof this.adapter.updateLearningPoint !== 'function') {
      console.warn('[GraphInterface] Adapter does not support updateLearningPoint');
      return null;
    }
    return this.adapter.updateLearningPoint(id, updates, token);
  }

  /**
   * Delete a learning point (soft delete sets validTo, hard delete removes)
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @param {boolean} hard - If true, permanently delete
   * @returns {Promise<boolean>}
   */
  async deleteLearningPoint(id, token, hard = false) {
    this._ensureAdapter();
    if (typeof this.adapter.deleteLearningPoint !== 'function') {
      console.warn('[GraphInterface] Adapter does not support deleteLearningPoint');
      return false;
    }
    return this.adapter.deleteLearningPoint(id, token, hard);
  }

  /**
   * Get learning points due for review (spaced repetition)
   * @param {Object} options - Query options
   * @param {string} options.token - User token (required)
   * @param {string} options.date - Date to check against (default: today)
   * @param {number} options.limit - Max items (default: 50)
   * @param {Array<string>} options.itemTypes - Filter by item types
   * @param {Array<string>} options.domainTypes - Filter by domain types
   * @param {Array<string>} options.tags - Filter by tags
   * @param {string} options.planId - Filter by learning plan
   * @returns {Promise<Array>}
   */
  async getLearningPointsDue(options) {
    this._ensureAdapter();
    if (typeof this.adapter.getLearningPointsDue !== 'function') {
      console.warn('[GraphInterface] Adapter does not support getLearningPointsDue');
      return [];
    }
    return this.adapter.getLearningPointsDue(options);
  }

  /**
   * Get learning points by source (book, URL, etc.)
   * @param {string} sourceType - 'book', 'url', 'chat', 'manual'
   * @param {string} sourceId - Source reference ID
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getLearningPointsBySource(sourceType, sourceId, token) {
    this._ensureAdapter();
    if (typeof this.adapter.getLearningPointsBySource !== 'function') {
      console.warn('[GraphInterface] Adapter does not support getLearningPointsBySource');
      return [];
    }
    return this.adapter.getLearningPointsBySource(sourceType, sourceId, token);
  }

  /**
   * Get learning points by learning plan
   * @param {string} planId - Learning plan ID
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getLearningPointsByPlan(planId, token) {
    this._ensureAdapter();
    if (typeof this.adapter.getLearningPointsByPlan !== 'function') {
      console.warn('[GraphInterface] Adapter does not support getLearningPointsByPlan');
      return [];
    }
    return this.adapter.getLearningPointsByPlan(planId, token);
  }

  /**
   * Search learning points by text
   * @param {string} query - Search query
   * @param {string} token - User token
   * @param {Object} options - Search options
   * @param {number} options.limit - Max results
   * @param {string} options.domainType - Filter by domain
   * @param {string} options.itemType - Filter by item type
   * @returns {Promise<Array>}
   */
  async searchLearningPoints(query, token, options = {}) {
    this._ensureAdapter();
    if (typeof this.adapter.searchLearningPoints !== 'function') {
      console.warn('[GraphInterface] Adapter does not support searchLearningPoints');
      return [];
    }
    return this.adapter.searchLearningPoints(query, token, options);
  }

  /**
   * Get all learning points with pagination
   * @param {string} token - User token
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.pageSize - Items per page (default: 20)
   * @param {string} options.sortBy - Sort field
   * @param {string} options.sortOrder - 'asc' or 'desc'
   * @returns {Promise<{items: Array, total: number, page: number, pageSize: number}>}
   */
  async getAllLearningPoints(token, options = {}) {
    this._ensureAdapter();
    if (typeof this.adapter.getAllLearningPoints !== 'function') {
      console.warn('[GraphInterface] Adapter does not support getAllLearningPoints');
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
    return this.adapter.getAllLearningPoints(token, options);
  }

  /**
   * Process a review and update spaced repetition state
   * @param {string} id - Learning point ID
   * @param {number} rating - 1=Again, 2=Hard, 3=Good, 4=Easy
   * @param {number} responseTimeMs - Response time in milliseconds
   * @param {string} token - User token
   * @returns {Promise<{success: boolean, newBox: number, nextReview: string, masteryLevel: number}>}
   */
  async processLearningPointReview(id, rating, responseTimeMs, token) {
    this._ensureAdapter();
    if (typeof this.adapter.processLearningPointReview !== 'function') {
      console.warn('[GraphInterface] Adapter does not support processLearningPointReview');
      return { error: 'Not supported by adapter' };
    }
    return this.adapter.processLearningPointReview(id, rating, responseTimeMs, token);
  }

  /**
   * Reset learning point to box 1 (restart learning)
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @returns {Promise<boolean>}
   */
  async resetLearningPoint(id, token) {
    this._ensureAdapter();
    if (typeof this.adapter.resetLearningPoint !== 'function') {
      console.warn('[GraphInterface] Adapter does not support resetLearningPoint');
      return false;
    }
    return this.adapter.resetLearningPoint(id, token);
  }

  /**
   * Get learning point statistics
   * @param {string} token - User token
   * @param {Object} options - Filter options
   * @param {string} options.planId - Filter by plan
   * @param {string} options.domainType - Filter by domain
   * @returns {Promise<Object>} Statistics object
   */
  async getLearningPointStats(token, options = {}) {
    this._ensureAdapter();
    if (typeof this.adapter.getLearningPointStats !== 'function') {
      console.warn('[GraphInterface] Adapter does not support getLearningPointStats');
      return null;
    }
    return this.adapter.getLearningPointStats(token, options);
  }

  /**
   * Get daily forecast of items due for review
   * @param {string} token - User token
   * @param {number} days - Number of days to forecast (default: 14)
   * @returns {Promise<Object>} Map of date -> count
   */
  async getLearningPointForecast(token, days = 14) {
    this._ensureAdapter();
    if (typeof this.adapter.getLearningPointForecast !== 'function') {
      console.warn('[GraphInterface] Adapter does not support getLearningPointForecast');
      return {};
    }
    return this.adapter.getLearningPointForecast(token, days);
  }

  // ===========================================================================
  // INTERNAL HELPERS
  // ===========================================================================

  /**
   * Ensure adapter is initialized
   * @private
   */
  _ensureAdapter() {
    if (!this.adapter) {
      throw new Error(
        'GraphInterface not initialized. Call initialize() first.',
      );
    }
  }
}

// Export singleton instance
const graphInterface = new GraphInterface();
export default graphInterface;
