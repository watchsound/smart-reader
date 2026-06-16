/**
 * graphApi.js
 *
 * Renderer-side API for graph database operations.
 * Provides a clean interface for components to interact with the graph database.
 *
 * Supports multiple backends via GraphInterface abstraction:
 * - Kùzu (default - embedded, no external server required)
 * - Neo4j (external server required)
 *
 * Usage:
 * import graphApi from '../api/graphApi';
 *
 * // Check status
 * const status = graphApi.getStatus();
 *
 * // Connect to graph database
 * const connected = await graphApi.connect();
 *
 * // Create a note
 * const note = await graphApi.createNote({ title: 'My Note', ... }, token);
 */

import customStorage from '../store/customStorage';

/**
 * Graph API - Renderer-side interface for graph database operations
 * Works with both Kùzu (default) and Neo4j backends
 */
class GraphApi {
  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Check if IPC is available
   * @returns {boolean}
   */
  _isIPCAvailable() {
    return !!(window.electron?.ipcRenderer);
  }

  /**
   * Safe sendSync with fallback
   * @private
   */
  _sendSync(channel, ...args) {
    if (!this._isIPCAvailable()) {
      console.warn(`GraphApi: IPC not available for ${channel}`);
      return null;
    }
    return window.electron.ipcRenderer.sendSync(channel, ...args);
  }

  /**
   * Safe invoke with fallback
   * @private
   */
  async _invoke(channel, ...args) {
    if (!this._isIPCAvailable()) {
      console.warn(`GraphApi: IPC not available for ${channel}`);
      return null;
    }
    return window.electron.ipcRenderer.invoke(channel, ...args);
  }

  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  /**
   * Connect to graph database (Kùzu by default)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async connect() {
    return this._invoke('graph-connect');
  }

  /**
   * Check if graph database is connected
   * @returns {boolean}
   */
  isConnected() {
    return this._sendSync('graph-check-connection') || false;
  }

  /**
   * Disconnect from graph database
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async disconnect() {
    return this._invoke('graph-disconnect');
  }

  /**
   * Get comprehensive graph database status
   * @returns {Object} Status object with:
   *   - initialized: boolean - Whether interface is initialized
   *   - adapterType: string - 'kuzu' or 'neo4j'
   *   - connected: boolean - Whether database is connected
   *   - available: boolean - Whether ready for operations
   *   - capabilities: Object - Feature availability (vectorSearch, leitnerSystem, etc.)
   *   - dbPath: string|null - Database path (for embedded databases like Kùzu)
   *   - error: string|null - Any error message
   */
  getStatus() {
    const status = this._sendSync('graph-get-status');
    return status || {
      initialized: false,
      adapterType: null,
      connected: false,
      available: false,
      error: 'IPC not available',
    };
  }

  /**
   * Check if graph features are available
   * @returns {boolean}
   */
  isAvailable() {
    const status = this.getStatus();
    return status.available === true;
  }

  /**
   * Get the current adapter type
   * @returns {string|null} 'kuzu', 'neo4j', or null
   */
  getAdapterType() {
    const status = this.getStatus();
    return status.adapterType;
  }

  // ===========================================================================
  // USER OPERATIONS
  // ===========================================================================

  /**
   * Create or update user
   * @param {Object} user - User data
   * @returns {Object|null} User node
   */
  async upsertUser(user) {
    return this._invoke('graph-upsert-user', user);
  }

  // ===========================================================================
  // BOOK OPERATIONS
  // ===========================================================================

  /**
   * Create a book
   * @param {Object} book - Book data
   * @param {string} token - User token (optional, uses current session)
   * @returns {Object|null} Book node
   */
  async createBook(book, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-create-book', book, t);
  }

  /**
   * Get books for current user
   * @param {string} token - User token (optional)
   * @returns {Array} Books
   */
  async getBooks(token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-books', t);
  }

  // ===========================================================================
  // NOTE OPERATIONS
  // ===========================================================================

  /**
   * Create a note
   * @param {Object} note - Note data
   * @param {string} token - User token (optional)
   * @returns {Object|null} Created note
   */
  async createNote(note, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-create-note', note, t);
  }

  /**
   * Get note by ID
   * @param {string|number} noteId - Note ID
   * @param {string} token - User token (optional)
   * @returns {Object|null} Note
   */
  async getNoteById(noteId, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-note', noteId, t);
  }

  /**
   * Get notes by source (book, URL, etc.)
   * @param {string} sourceKey - Source ID
   * @param {string} sourceType - Source type ('book', 'url', etc.)
   * @param {string} token - User token (optional)
   * @returns {Array} Notes
   */
  async getNotesBySource(sourceKey, sourceType, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-notes-by-source',
      sourceKey,
      sourceType,
      t,
    );
  }

  /**
   * Update a note field
   * @param {string|number} noteId - Note ID
   * @param {string} field - Field name
   * @param {any} value - New value
   * @param {string} token - User token (optional)
   * @returns {number} 1 on success, -1 on failure
   */
  async updateNote(noteId, field, value, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-update-note',
      noteId,
      field,
      value,
      t,
    );
  }

  /**
   * Delete a note
   * @param {string|number} noteId - Note ID
   * @param {string} token - User token (optional)
   * @returns {number} 1 on success, -1 on failure
   */
  async deleteNote(noteId, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-delete-note', noteId, t);
  }

  /**
   * Search notes by text
   * @param {string} query - Search query
   * @param {string} token - User token (optional)
   * @returns {Array} Matching notes
   */
  async searchNotes(query, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-search-notes', query, t);
  }

  // ===========================================================================
  // VOCABULARY OPERATIONS
  // ===========================================================================

  /**
   * Create vocabulary
   * @param {Object} vocab - Vocabulary data
   * @param {string} token - User token (optional)
   * @returns {Object|null} Created vocabulary
   */
  async createVocabulary(vocab, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-create-vocabulary',
      vocab,
      t,
    );
  }

  /**
   * Get vocabulary by word
   * @param {string} word - Word to look up
   * @param {string} token - User token (optional)
   * @returns {Object|null} Vocabulary
   */
  async getVocabularyByWord(word, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-vocabulary-by-word',
      word,
      t,
    );
  }

  // ===========================================================================
  // SPACED REPETITION (LEITNER SYSTEM)
  // ===========================================================================

  /**
   * Get items due for review
   * @param {Array} itemTypes - Item types to include ('note', 'vocabulary')
   * @param {number} limit - Maximum items to return
   * @param {Date} asOfDate - Date to check against (defaults to now)
   * @param {string} token - User token (optional)
   * @returns {Array} Items due for review
   */
  async getDueForReview(
    itemTypes = ['note', 'vocabulary'],
    limit = 50,
    asOfDate = new Date(),
    token = null,
  ) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-due-for-review',
      asOfDate.toISOString(),
      itemTypes,
      limit,
      t,
    );
  }

  /**
   * Record a review outcome
   * @param {string|number} itemId - Item ID
   * @param {string} itemType - 'note' or 'vocabulary'
   * @param {string} outcome - 'correct', 'incorrect', or 'skipped'
   * @param {number} leitnerSpeed - Speed factor (1=fast, 2=normal, 4=slow)
   * @param {string} token - User token (optional)
   * @returns {Object|null} Updated item
   */
  async recordReview(
    itemId,
    itemType,
    outcome,
    leitnerSpeed = 2,
    token = null,
  ) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-record-review',
      itemId,
      itemType,
      outcome,
      leitnerSpeed,
      t,
    );
  }

  /**
   * Add note to Leitner study
   * @param {string|number} noteId - Note ID
   * @param {string} token - User token (optional)
   * @returns {Object|null} Updated note
   */
  async addNoteToLeitnerStudy(noteId, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-add-note-to-leitner',
      noteId,
      t,
    );
  }

  // ===========================================================================
  // CONCEPT OPERATIONS
  // ===========================================================================

  /**
   * Create or update concept
   * @param {Object} concept - Concept data
   * @param {string} token - User token (optional)
   * @returns {Object|null} Concept node
   */
  async upsertConcept(concept, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-upsert-concept',
      concept,
      t,
    );
  }

  /**
   * Create MENTIONS_CONCEPT relationship
   * @param {string|number} noteId - Note ID
   * @param {string|number} conceptId - Concept ID
   * @param {number} frequency - How many times mentioned
   * @param {number} importance - Contextual importance (0-1)
   * @returns {{success: boolean, error?: string}}
   */
  async createMentionsRelationship(
    noteId,
    conceptId,
    frequency = 1,
    importance = 0.5,
  ) {
    return this._invoke(
      'graph-create-mentions',
      noteId,
      conceptId,
      frequency,
      importance,
    );
  }

  // ===========================================================================
  // LEARNING SESSION OPERATIONS
  // ===========================================================================

  /**
   * Start a learning session
   * @param {string} activityType - 'reading', 'reviewing', 'quizzing', 'browsing', 'chatting'
   * @param {string} resourceType - 'book', 'url', 'note', or null
   * @param {string|number} resourceId - Resource ID or null
   * @param {string} token - User token (optional)
   * @returns {Object|null} Learning session
   */
  async startLearningSession(
    activityType,
    resourceType = null,
    resourceId = null,
    token = null,
  ) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-start-session',
      activityType,
      resourceType,
      resourceId,
      t,
    );
  }

  /**
   * End a learning session
   * @param {string|number} sessionId - Session ID
   * @param {Object} stats - Session statistics
   * @param {number} stats.focusScore - Focus score (0-1)
   * @param {number} stats.notesCreated - Number of notes created
   * @param {number} stats.conceptsReviewed - Number of concepts reviewed
   * @param {number} stats.wordsLearned - Number of words learned
   * @param {string} token - User token (optional)
   * @returns {Object|null} Updated session
   */
  async endLearningSession(sessionId, stats, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-end-session',
      sessionId,
      stats,
      t,
    );
  }

  // ===========================================================================
  // SEMANTIC SEARCH
  // ===========================================================================

  /**
   * Store embedding for a node
   * @param {string|number} nodeId - Node ID
   * @param {string} nodeType - Node type (Note, Book, etc.)
   * @param {Array<number>} embedding - Embedding vector
   * @param {string} model - Embedding model used
   * @returns {{success: boolean, error?: string}}
   */
  async storeEmbedding(nodeId, nodeType, embedding, model) {
    return this._invoke(
      'graph-store-embedding',
      nodeId,
      nodeType,
      embedding,
      model,
    );
  }

  /**
   * Find similar nodes
   * @param {Array<number>} queryEmbedding - Query embedding vector
   * @param {Array<string>} nodeTypes - Node types to search
   * @param {number} limit - Maximum results
   * @param {number} minSimilarity - Minimum similarity threshold (0-1)
   * @param {string} token - User token (optional)
   * @returns {Array} Similar nodes with similarity scores
   */
  async findSimilar(
    queryEmbedding,
    nodeTypes,
    limit = 10,
    minSimilarity = 0.7,
    token = null,
  ) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-find-similar',
      queryEmbedding,
      nodeTypes,
      limit,
      minSimilarity,
      t,
    );
  }

  // ===========================================================================
  // LEARNING PATH
  // ===========================================================================

  /**
   * Get learning path to a concept
   * @param {string|number} targetConceptId - Target concept ID
   * @param {number} maxDepth - Maximum path depth
   * @param {string} token - User token (optional)
   * @returns {Object|null} Learning path
   */
  async getLearningPath(targetConceptId, maxDepth = 5, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-learning-path',
      targetConceptId,
      maxDepth,
      t,
    );
  }

  /**
   * Get knowledge state at a point in time (temporal query)
   * @param {Date} asOfDate - Point in time to query
   * @param {string} token - User token (optional)
   * @returns {Array} Knowledge state
   */
  async getKnowledgeAtTime(asOfDate, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-knowledge-at-time',
      asOfDate.toISOString(),
      t,
    );
  }

  // ===========================================================================
  // CHAT OPERATIONS
  // ===========================================================================

  /**
   * Create a chat
   * @param {Object} chat - Chat data
   * @param {string} token - User token (optional)
   * @returns {Object|null} Created chat
   */
  async createChat(chat, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-create-chat', chat, t);
  }

  /**
   * Add message to chat
   * @param {Object} message - Message data
   * @param {string|number} chatId - Chat ID
   * @param {string} token - User token (optional)
   * @returns {Object|null} Created message
   */
  async addMessage(message, chatId, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-add-message',
      message,
      chatId,
      t,
    );
  }

  /**
   * Search messages by text
   * @param {string} query - Search query
   * @param {string} token - User token (optional)
   * @returns {Array} Matching messages
   */
  async searchMessages(query, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-search-messages',
      query,
      t,
    );
  }

  // ===========================================================================
  // BOOKMARK OPERATIONS
  // ===========================================================================

  /**
   * Create a bookmark
   * @param {Object} bookmark - Bookmark data
   * @param {string} token - User token (optional)
   * @returns {Object|null} Created bookmark
   */
  async createBookmark(bookmark, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-create-bookmark',
      bookmark,
      t,
    );
  }

  /**
   * Get bookmarks by source URL
   * @param {string} sourceKey - Source URL
   * @param {string} token - User token (optional)
   * @returns {Array} Bookmarks
   */
  async getBookmarksBySource(sourceKey, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-bookmarks-by-source',
      sourceKey,
      t,
    );
  }

  /**
   * Search bookmarks by text
   * @param {string} query - Search query
   * @param {string} token - User token (optional)
   * @returns {Array} Matching bookmarks
   */
  async searchBookmarks(query, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-search-bookmarks',
      query,
      t,
    );
  }

  // ===========================================================================
  // STATS
  // ===========================================================================

  /**
   * Get graph database statistics
   * @returns {Object} Counts of nodes by type
   */
  getStats() {
    return this._invoke('graph-get-stats');
  }

  // ===========================================================================
  // LEARNING PATH FEATURES
  // ===========================================================================

  /**
   * Create a concept with prerequisites
   * @param {Object} concept - Concept data { name, description, domain, difficulty }
   * @param {Array<string>} prerequisiteIds - IDs of prerequisite concepts
   * @param {string} token - User token (optional)
   * @returns {Object|null} Created concept
   */
  async createConceptWithPrereqs(concept, prerequisiteIds = [], token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-create-concept-with-prereqs',
      concept,
      prerequisiteIds,
      t,
    );
  }

  /**
   * Get personalized learning path to master a target concept
   * @param {string} targetConceptId - Target concept ID
   * @param {string} token - User token (optional)
   * @returns {Object} Learning path with ordered concepts
   */
  async getPersonalizedLearningPath(targetConceptId, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-personalized-learning-path',
      targetConceptId,
      t,
    );
  }

  /**
   * Get concepts that depend on a given concept
   * @param {string} conceptId - Concept ID
   * @param {string} token - User token (optional)
   * @returns {Array} Dependent concepts
   */
  async getDependentConcepts(conceptId, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-dependent-concepts',
      conceptId,
      t,
    );
  }

  // ===========================================================================
  // WEAK CONCEPTS DETECTION
  // ===========================================================================

  /**
   * Detect weak concepts based on performance
   * @param {number} limit - Maximum concepts to return
   * @param {string} token - User token (optional)
   * @returns {Array} Weak concepts sorted by priority
   */
  async detectWeakConcepts(limit = 10, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-detect-weak-concepts',
      t,
      limit,
    );
  }

  /**
   * Get concepts where user frequently makes mistakes
   * @param {number} lookbackDays - Days to look back
   * @param {string} token - User token (optional)
   * @returns {Array} Error-prone concepts
   */
  async getErrorProneTopics(lookbackDays = 30, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-error-prone-topics',
      t,
      lookbackDays,
    );
  }

  // ===========================================================================
  // ENTITY RESOLUTION
  // ===========================================================================

  /**
   * Find and suggest related concept links
   * @param {string} token - User token (optional)
   * @returns {Array} Related concept pairs
   */
  async resolveRelatedConcepts(token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-resolve-related-concepts',
      t,
    );
  }

  /**
   * Create a relationship between two concepts
   * @param {string} concept1Id - First concept ID
   * @param {string} concept2Id - Second concept ID
   * @param {string} relationType - Relationship type
   * @param {number} strength - Relationship strength (0-1)
   * @returns {boolean} Success
   */
  async linkConcepts(
    concept1Id,
    concept2Id,
    relationType = 'related',
    strength = 0.5,
  ) {
    return this._invoke(
      'graph-link-concepts',
      concept1Id,
      concept2Id,
      relationType,
      strength,
    );
  }

  /**
   * Extract concepts from text content
   * @param {string} content - Text to analyze
   * @param {string} token - User token (optional)
   * @returns {Object} { existing: [], suggested: [] }
   */
  async extractConceptsFromText(content, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-extract-concepts-from-text',
      content,
      t,
    );
  }

  /**
   * Get concept clusters
   * @param {string} token - User token (optional)
   * @returns {Array} Concept clusters by domain
   */
  async getConceptClusters(token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-concept-clusters', t);
  }

  // ===========================================================================
  // MASTERY TRACKING
  // ===========================================================================

  /**
   * Update concept mastery based on review outcome
   * @param {string} conceptId - Concept ID
   * @param {string} outcome - 'correct', 'incorrect', or 'skipped'
   * @param {string} token - User token (optional)
   * @returns {Object|null} Updated concept
   */
  async updateConceptMastery(conceptId, outcome, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-update-concept-mastery',
      conceptId,
      outcome,
      t,
    );
  }

  /**
   * Get mastery progress over time
   * @param {number} days - Number of days to look back
   * @param {string} token - User token (optional)
   * @returns {Array} Daily mastery snapshots
   */
  async getMasteryProgress(days = 30, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-mastery-progress',
      t,
      days,
    );
  }

  /**
   * Get knowledge graph data for visualization
   * @param {string} centerConceptId - Optional center concept for focused view
   * @param {string} token - User token (optional)
   * @returns {Object} { nodes: [], edges: [] }
   */
  async getKnowledgeGraphData(centerConceptId = null, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-knowledge-graph-data',
      t,
      centerConceptId,
    );
  }

  // ===========================================================================
  // SEMANTIC SEARCH (Graph-based)
  // ===========================================================================

  /**
   * Semantic search for books
   * @param {string} query - Search query
   * @param {string} token - User token (optional)
   * @returns {Array} Matching books
   */
  async semanticSearchBooks(query, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-semantic-search-books',
      query,
      t,
    );
  }

  /**
   * Semantic search for notes
   * @param {string} query - Search query
   * @param {string} token - User token (optional)
   * @returns {Array} Matching notes
   */
  async semanticSearchNotes(query, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-semantic-search-notes',
      query,
      t,
    );
  }

  /**
   * Get book content by semantic query
   * @param {number} bookKey - Book ID
   * @param {string} bookType - 'epub' or 'pdf'
   * @param {string} query - Search query
   * @param {string} token - User token (optional)
   * @returns {Array} Matching content sections
   */
  async getBookContentByQuery(bookKey, bookType, query, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-get-book-content-by-query',
      bookKey,
      bookType,
      query,
      t,
    );
  }

  // ===========================================================================
  // AI-POWERED CONCEPT EXTRACTION
  // ===========================================================================

  /**
   * Check if AI concept extraction is available
   * @returns {boolean} True if AI provider is configured
   */
  isAIExtractionAvailable() {
    if (!this._isIPCAvailable()) {
      return false;
    }
    return this._sendSync('graph-ai-extraction-available') || false;
  }

  /**
   * Extract concepts from text using AI
   * Uses the mindmap extraction prompt to get structured concepts
   * @param {string} text - Text content to analyze
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { title, nodes, edges, entities }
   */
  async aiExtractConcepts(text, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-ai-extract-concepts', text, t) || { nodes: [], edges: [], entities: [] };
  }

  /**
   * Extract entities with coreference resolution using AI
   * @param {string} text - Text content to analyze
   * @returns {Promise<Object>} { entities: [] }
   */
  async aiExtractEntities(text) {
    return this._invoke('graph-ai-extract-entities', text) || { entities: [] };
  }

  /**
   * Full AI extraction: concepts + entities + relationship suggestions
   * Use this for comprehensive extraction when saving notes
   * @param {string} text - Text content to analyze
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { nodes, edges, entities, existingConcepts, suggestions }
   */
  async aiFullExtraction(text, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-ai-full-extraction', text, t);
  }

  /**
   * Save AI-extracted concepts to graph database
   * Call after user reviews and approves the extracted concepts
   * @param {Array} nodes - Concept nodes to save
   * @param {Array} edges - Relationship edges to save
   * @param {string} sourceId - Source note/book ID
   * @param {string} sourceType - Type of source ('note', 'book')
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { saved, linked, error? }
   */
  async aiSaveExtraction(nodes, edges, sourceId, sourceType, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke(
      'graph-ai-save-extraction',
      nodes,
      edges,
      sourceId,
      sourceType,
      t,
    ) || { saved: 0, linked: 0, error: 'IPC not available' };
  }

  // ===========================================================================
  // SUMMARIZATION GRAPH API
  // ===========================================================================

  /**
   * Check if summarization graph (Neo4j) is available
   * @returns {boolean}
   */
  isSummarizationAvailable() {
    if (!this._isIPCAvailable()) {
      return false;
    }
    return this._sendSync('graph-summarization-available') || false;
  }

  /**
   * Get full summarization hierarchy for a concept
   * Returns: concept → memories → episodes
   * @param {string} conceptId - Concept ID
   * @param {Object} options - Query options
   * @param {boolean} options.includeEpisodes - Include source episodes (default: true)
   * @param {number} options.maxEpisodes - Max episodes per memory (default: 10)
   * @param {number} options.limit - Max memories (default: 20)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { concept, memories: [{ memory, summarizes, episodes }] }
   */
  async getSummarizationHierarchy(conceptId, options = {}, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-summarization-hierarchy', {
      conceptId,
      token: t,
      options,
    }) || { success: false, error: 'IPC not available' };
  }

  /**
   * Get all memories that summarize a concept
   * @param {string} conceptId - Concept ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Max results (default: 50)
   * @param {string} options.memoryType - Filter by type
   * @param {boolean} options.primaryOnly - Only primary concept memories
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: [{ memory, relationship }] }
   */
  async getMemoriesForConcept(conceptId, options = {}, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-memories-for-concept', {
      conceptId,
      token: t,
      options,
    }) || { data: [] };
  }

  /**
   * Get learning timeline for a concept (ordered by period)
   * @param {string} conceptId - Concept ID
   * @param {number} limit - Max results (default: 50)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: [{ memory, relationship }] }
   */
  async getConceptTimeline(conceptId, limit = 50, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-concept-timeline', {
      conceptId,
      token: t,
      limit,
    }) || { data: [] };
  }

  /**
   * Get memories related to a specific memory
   * @param {string} memoryId - Memory ID
   * @param {string} relationType - Filter by relation type (optional)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: [{ memory, relationship, direction }] }
   */
  async getRelatedMemories(memoryId, relationType = null, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-related-memories', {
      memoryId,
      token: t,
      relationType,
    }) || { data: [] };
  }

  /**
   * Get memory chain (prerequisite sequences)
   * @param {string} memoryId - Starting memory ID
   * @param {string} direction - 'outgoing', 'incoming', or 'both'
   * @param {number} maxDepth - Maximum chain depth (default: 5)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: [{ memory, depth }] }
   */
  async getMemoryChain(memoryId, direction = 'both', maxDepth = 5, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-memory-chain', {
      memoryId,
      token: t,
      direction,
      maxDepth,
    }) || { data: [] };
  }

  /**
   * Get cross-concept memory clusters
   * @param {number} limit - Max clusters (default: 10)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: [{ memory, concepts }] }
   */
  async getCrossConceptClusters(limit = 10, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-cross-concept-clusters', {
      token: t,
      limit,
    }) || { data: [] };
  }

  /**
   * Get summarization statistics
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: { totalMemories, byType, ... } }
   */
  async getSummarizationStats(token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-summarization-stats', {
      token: t,
    }) || { data: null };
  }

  /**
   * Get memory coverage analysis (which concepts have most/least memories)
   * @param {number} limit - Max results (default: 20)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: [{ conceptId, conceptName, memoryCount, ... }] }
   */
  async getMemoryCoverage(limit = 20, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-memory-coverage', {
      token: t,
      limit,
    }) || { data: [] };
  }

  /**
   * Find gaps in memory coverage (concepts without recent memories)
   * @param {number} daysSinceLastMemory - Days threshold (default: 30)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: [{ conceptId, conceptName, lastMemory, ... }] }
   */
  async findMemoryGaps(daysSinceLastMemory = 30, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-find-memory-gaps', {
      token: t,
      daysSinceLastMemory,
    }) || { data: [] };
  }

  /**
   * Calculate aggregated concept mastery from memories
   * Uses weighted average with recency bias
   * @param {string} conceptId - Concept ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: { conceptId, aggregatedMastery, masteryLevel, ... } }
   */
  async calculateConceptMastery(conceptId, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-calculate-concept-mastery', {
      conceptId,
      token: t,
    }) || { data: null };
  }

  /**
   * Get source episodes for a memory
   * @param {string} memoryId - Memory ID
   * @param {number} limit - Max results (default: 100)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: [{ episode, relationship }] }
   */
  async getSourceEpisodes(memoryId, limit = 100, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-source-episodes', {
      memoryId,
      token: t,
      limit,
    }) || { data: [] };
  }

  /**
   * Get concepts for a memory
   * @param {string} memoryId - Memory ID
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>} { data: [{ concept, relationship }] }
   */
  async getConceptsForMemory(memoryId, token = null) {
    const t = token || customStorage.getSessionToken();
    return this._invoke('graph-get-concepts-for-memory', {
      memoryId,
      token: t,
    }) || { data: [] };
  }
}

// Export singleton instance
const graphApi = new GraphApi();
export default graphApi;
