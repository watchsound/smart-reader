/**
 * KuzuAdapter.js
 *
 * Kùzu implementation of the GraphInterface.
 * Drop-in replacement for Neo4jAdapter with MIT license for commercial bundling.
 *
 * Key differences from Neo4j:
 * - Embedded database (no external server required)
 * - Native HNSW vector index (replaces manual cosine similarity)
 * - Cypher-compatible query language
 * - MIT licensed (can bundle with commercial product)
 *
 * This adapter handles:
 * - Connection management (embedded database)
 * - CRUD operations for all node types
 * - Relationship creation and traversal
 * - Native vector similarity search (replacing ChromaDB)
 * - Spaced repetition queries
 * - Learning path recommendations
 */

import path from 'path';
import { app } from 'electron';
import { getUserIdFromToken } from '../db/DBManager';

// Graceful fallback for kuzu native module
// If kuzu fails to load (e.g., platform not supported), the app continues but graph features are disabled
const kuzuModule = (() => {
  try {
    // Dynamic import to handle cases where native module isn't available
    // eslint-disable-next-line global-require
    return { kuzu: require('kuzu'), error: null };
  } catch (error) {
    console.warn('[KuzuAdapter] Failed to load kuzu native module:', error.message);
    console.warn('[KuzuAdapter] Graph database features will be unavailable');
    return { kuzu: null, error };
  }
})();

const kuzu = kuzuModule.kuzu;
const kuzuLoadError = kuzuModule.error;

/**
 * Configuration for Kùzu database
 */
const DEFAULT_CONFIG = {
  // Database will be stored in app data directory
  dbPath: null, // Set dynamically based on electron app path
  bufferPoolSize: 256 * 1024 * 1024, // 256MB buffer pool
  maxNumThreads: 4,
  enableCompression: true,
  readOnly: false,
};

/**
 * KuzuAdapter Singleton
 *
 * Implements GraphInterface for Kùzu embedded database.
 * Provides all graph database operations for the SmartReader learning system.
 */
class KuzuAdapter {
  constructor() {
    if (KuzuAdapter.instance) {
      return KuzuAdapter.instance;
    }

    this.db = null;
    this.conn = null;
    this.isConnected = false;
    this.config = { ...DEFAULT_CONFIG };
    this.vectorIndexesCreated = false;
    this.loadError = kuzuLoadError; // Store any load error from module initialization

    KuzuAdapter.instance = this;
  }

  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  /**
   * Check if kuzu native module is available
   * @returns {boolean} True if kuzu loaded successfully
   */
  static isKuzuAvailable() {
    return kuzu !== null;
  }

  /**
   * Get kuzu load error if any
   * @returns {Error|null} The error that occurred during kuzu load, or null
   */
  static getKuzuLoadError() {
    return kuzuLoadError;
  }

  /**
   * Initialize connection to Kùzu
   * @param {Object} store - electron-store instance for configuration
   */
  async connect(store) {
    try {
      // Check if kuzu is available
      if (!kuzu) {
        const errorMsg = kuzuLoadError
          ? `Kuzu native module failed to load: ${kuzuLoadError.message}`
          : 'Kuzu native module is not available';
        console.error('[KuzuAdapter]', errorMsg);
        this.isConnected = false;
        this.loadError = kuzuLoadError;
        return false;
      }

      // Get database path from store or use default
      const userDataPath = app?.getPath?.('userData') || './data';
      const dbPath = store?.get('kuzu_db_path') || path.join(userDataPath, 'kuzu_graph.db');

      // Ensure directory exists
      const fs = require('fs');
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.config.dbPath = dbPath;

      // Create database instance
      this.db = new kuzu.Database(dbPath, this.config.bufferPoolSize);

      // Create connection
      this.conn = new kuzu.Connection(this.db);

      this.isConnected = true;
      this.loadError = null;
      console.log('[KuzuAdapter] Connected to embedded database at', dbPath);

      // Create schema (tables and indexes)
      await this.createSchema();

      return true;
    } catch (error) {
      console.error('[KuzuAdapter] Failed to connect:', error);
      this.isConnected = false;
      this.loadError = error;
      return false;
    }
  }

  /**
   * Close the Kùzu connection
   */
  async disconnect() {
    try {
      if (this.conn) {
        // Kùzu connections are automatically cleaned up
        this.conn = null;
      }
      if (this.db) {
        // Close the database
        this.db = null;
      }
      this.isConnected = false;
      console.log('KuzuAdapter: Disconnected from database');
    } catch (error) {
      console.error('KuzuAdapter: Error during disconnect', error);
    }
  }

  /**
   * Execute a query (async)
   * @param {string} query - Cypher query
   * @param {Object} params - Query parameters
   * @returns {Array} Query results
   */
  async query(query, params = {}) {
    if (!this.conn || !this.isConnected) {
      throw new Error('KuzuAdapter: Not connected to database');
    }

    try {
      // Kùzu uses positional parameters in Node.js
      // Convert Neo4j-style $param to Kùzu-style
      const { processedQuery, paramArray } = this._processQueryParams(query, params);

      const result = await this.conn.query(processedQuery, ...paramArray);
      const rows = await result.getAll();
      return rows;
    } catch (error) {
      console.error('KuzuAdapter: Query error', error, query);
      throw error;
    }
  }

  /**
   * Execute a query synchronously
   * @param {string} query - Cypher query
   * @param {Object} params - Query parameters
   * @returns {Array} Query results
   */
  querySync(query, params = {}) {
    if (!this.conn || !this.isConnected) {
      throw new Error('KuzuAdapter: Not connected to database');
    }

    try {
      const { processedQuery, paramArray } = this._processQueryParams(query, params);
      const result = this.conn.querySync(processedQuery, ...paramArray);
      return result.getAllSync();
    } catch (error) {
      console.error('KuzuAdapter: QuerySync error', error, query);
      throw error;
    }
  }

  /**
   * Process Neo4j-style parameters to Kùzu-style
   * Kùzu uses $1, $2, etc. for positional parameters
   * @private
   */
  _processQueryParams(query, params) {
    if (!params || Object.keys(params).length === 0) {
      return { processedQuery: query, paramArray: [] };
    }

    let processedQuery = query;
    const paramArray = [];
    const paramNames = Object.keys(params);

    // Replace $paramName with $1, $2, etc.
    paramNames.forEach((name, index) => {
      const regex = new RegExp(`\\$${name}\\b`, 'g');
      processedQuery = processedQuery.replace(regex, `$${index + 1}`);
      paramArray.push(params[name]);
    });

    return { processedQuery, paramArray };
  }

  /**
   * Check if connected to Kùzu
   * @returns {boolean}
   */
  checkConnection() {
    return this.isConnected && this.db !== null && this.conn !== null;
  }

  // ===========================================================================
  // SCHEMA MANAGEMENT
  // ===========================================================================

  /**
   * Create all necessary tables and indexes
   * Kùzu requires explicit schema definition unlike Neo4j
   */
  async createSchema() {
    try {
      // Load pre-installed extensions
      await this._safeQuery('LOAD EXTENSION vector');
      await this._safeQuery('LOAD EXTENSION fts');

      // Create Node Tables
      await this._createNodeTables();

      // Create Relationship Tables
      await this._createRelationshipTables();

      // Create Vector Indexes
      await this._createVectorIndexes();

      console.log('KuzuAdapter: Schema created/verified');
    } catch (error) {
      console.error('KuzuAdapter: Schema creation error', error);
      // Don't throw - schema might already exist
    }
  }

  /**
   * Execute query safely (ignore if table exists)
   * @private
   */
  async _safeQuery(query) {
    try {
      await this.conn.query(query);
    } catch (error) {
      // Ignore "already exists" errors
      if (!error.message?.includes('already exists') &&
          !error.message?.includes('Duplicate')) {
        console.warn('KuzuAdapter: Safe query warning:', error.message);
      }
    }
  }

  /**
   * Create all node tables
   * @private
   */
  async _createNodeTables() {
    const nodeTables = [
      // User table
      `CREATE NODE TABLE IF NOT EXISTS User (
        id STRING PRIMARY KEY,
        email STRING,
        name STRING,
        readerLevel STRING,
        studyMode STRING,
        preferredProvider STRING,
        preferredModel STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP
      )`,

      // Book table
      `CREATE NODE TABLE IF NOT EXISTS Book (
        id STRING PRIMARY KEY,
        keyInStorage STRING,
        name STRING,
        subtitle STRING,
        author STRING,
        description STRING,
        cover STRING,
        format STRING,
        publisher STRING,
        category STRING,
        size INT64,
        path STRING,
        favorite BOOL,
        bookshelfId INT64,
        userId STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP
      )`,

      // Note table - central to learning
      `CREATE NODE TABLE IF NOT EXISTS Note (
        id STRING PRIMARY KEY,
        sourceType STRING,
        sourceKey STRING,
        title STRING,
        chapter STRING,
        chapterIndex INT64,
        cards STRING,
        cfi STRING,
        range STRING,
        percentage DOUBLE,
        position STRING,
        emoji STRING,
        color STRING,
        tags STRING[],
        rate INT64,
        hasQuiz BOOL,
        highlightOnly BOOL,
        highlightType STRING,
        userId STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP,
        eventTime TIMESTAMP,
        recordTime TIMESTAMP,
        validFrom TIMESTAMP,
        validTo TIMESTAMP,
        leitnerBox INT64,
        leitnerNextReview TIMESTAMP,
        leitnerFullyLearned BOOL,
        leitnerSkips INT64,
        leitnerFlips INT64,
        leitnerScore INT64,
        embedding FLOAT[1536]
      )`,

      // Vocabulary table
      `CREATE NODE TABLE IF NOT EXISTS Vocabulary (
        id STRING PRIMARY KEY,
        word STRING,
        definition STRING,
        relatedWords STRING,
        example STRING,
        setId INT64,
        userId STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP,
        eventTime TIMESTAMP,
        recordTime TIMESTAMP,
        validFrom TIMESTAMP,
        validTo TIMESTAMP,
        leitnerBox INT64,
        leitnerNextReview TIMESTAMP,
        leitnerFullyLearned BOOL,
        leitnerSkips INT64,
        leitnerFlips INT64,
        leitnerScore INT64,
        embedding FLOAT[1536]
      )`,

      // Concept table
      `CREATE NODE TABLE IF NOT EXISTS Concept (
        id STRING PRIMARY KEY,
        name STRING,
        description STRING,
        category STRING,
        masteryLevel DOUBLE,
        exposureCount INT64,
        userId STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP,
        eventTime TIMESTAMP,
        recordTime TIMESTAMP,
        validFrom TIMESTAMP,
        validTo TIMESTAMP,
        embedding FLOAT[1536]
      )`,

      // URL/Bookmark table
      `CREATE NODE TABLE IF NOT EXISTS URL (
        id STRING PRIMARY KEY,
        url STRING,
        domain STRING,
        title STRING,
        description STRING,
        content STRING,
        userId STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP,
        embedding FLOAT[1536]
      )`,

      // Bookmark table
      `CREATE NODE TABLE IF NOT EXISTS Bookmark (
        id STRING PRIMARY KEY,
        title STRING,
        url STRING,
        description STRING,
        content STRING,
        sourceKey STRING,
        folderId INT64,
        parentId INT64,
        isFolder BOOL,
        icon STRING,
        userId STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP,
        embedding FLOAT[1536]
      )`,

      // Chat table
      `CREATE NODE TABLE IF NOT EXISTS Chat (
        id STRING PRIMARY KEY,
        name STRING,
        chatType STRING,
        articleType STRING,
        articleSummary STRING,
        article STRING,
        sourceKey STRING,
        userId STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP
      )`,

      // Message table
      `CREATE NODE TABLE IF NOT EXISTS Message (
        id STRING PRIMARY KEY,
        chatId STRING,
        role STRING,
        content STRING,
        userId STRING,
        createdAt TIMESTAMP,
        embedding FLOAT[1536]
      )`,

      // Learning Session table (episodic memory)
      `CREATE NODE TABLE IF NOT EXISTS LearningSession (
        id STRING PRIMARY KEY,
        userId STRING,
        activityType STRING,
        primaryResourceType STRING,
        primaryResourceId STRING,
        startTime TIMESTAMP,
        endTime TIMESTAMP,
        durationMinutes INT64,
        itemsReviewed INT64,
        itemsLearned INT64,
        accuracy DOUBLE,
        eventTime TIMESTAMP,
        recordTime TIMESTAMP,
        validFrom TIMESTAMP,
        validTo TIMESTAMP
      )`,

      // Episode table (for brain/memory consolidation)
      `CREATE NODE TABLE IF NOT EXISTS Episode (
        id STRING PRIMARY KEY,
        userId STRING,
        eventType STRING,
        timestamp TIMESTAMP,
        payload STRING,
        conceptId STRING,
        conceptName STRING,
        processed BOOL,
        processedAt TIMESTAMP,
        createdAt TIMESTAMP
      )`,

      // ConsolidatedMemory table
      `CREATE NODE TABLE IF NOT EXISTS ConsolidatedMemory (
        id STRING PRIMARY KEY,
        userId STRING,
        conceptId STRING,
        conceptName STRING,
        memoryType STRING,
        periodStart TIMESTAMP,
        periodEnd TIMESTAMP,
        episodeCount INT64,
        summary STRING,
        insights STRING,
        learningProcess STRING,
        metrics STRING,
        sourceEpisodes STRING,
        masteryAssessment STRING,
        learningStyle STRING,
        recommendations STRING,
        createdAt TIMESTAMP,
        expiresAt TIMESTAMP
      )`,

      // LearnerProfile table
      `CREATE NODE TABLE IF NOT EXISTS LearnerProfile (
        userId STRING PRIMARY KEY,
        learningStyle STRING,
        preferredTimeOfDay STRING,
        optimalSessionLength INT64,
        consistencyScore DOUBLE,
        forgettingCurveSlope DOUBLE,
        pacePreference STRING,
        aiInsights STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP
      )`,

      // DomainProfile table
      `CREATE NODE TABLE IF NOT EXISTS DomainProfile (
        id STRING PRIMARY KEY,
        userId STRING,
        domainType STRING,
        accuracyTrend STRING,
        learningVelocityTrend STRING,
        weakAreas STRING,
        strongAreas STRING,
        suggestedFocus STRING,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP
      )`,

      // Chunk table (for book content / RAG)
      `CREATE NODE TABLE IF NOT EXISTS Chunk (
        id STRING PRIMARY KEY,
        bookId STRING,
        chunkIndex INT64,
        text STRING,
        chapter STRING,
        pageNumber INT64,
        startPosition INT64,
        endPosition INT64,
        metadata STRING,
        embedding FLOAT[1536],
        embeddingModel STRING,
        embeddingUpdatedAt TIMESTAMP,
        createdAt TIMESTAMP
      )`,

      // KeyConcept table (for concept extraction)
      `CREATE NODE TABLE IF NOT EXISTS KeyConcept (
        id STRING PRIMARY KEY,
        bookId STRING,
        name STRING,
        description STRING,
        frequency INT64,
        importance DOUBLE,
        embedding FLOAT[1536],
        createdAt TIMESTAMP
      )`,

      // UnifiedLearningPoint table
      `CREATE NODE TABLE IF NOT EXISTS LearningPoint (
        id STRING PRIMARY KEY,
        itemType STRING,
        domainType STRING,
        title STRING,
        front STRING,
        back STRING,
        extras STRING,
        sourceType STRING,
        sourceId STRING,
        tags STRING[],
        userId STRING,
        planId STRING,
        leitnerBox INT64,
        leitnerNextReview TIMESTAMP,
        leitnerFullyLearned BOOL,
        masteryLevel DOUBLE,
        reviewCount INT64,
        correctCount INT64,
        incorrectCount INT64,
        lastReviewedAt TIMESTAMP,
        createdAt TIMESTAMP,
        updatedAt TIMESTAMP,
        eventTime TIMESTAMP,
        validFrom TIMESTAMP,
        validTo TIMESTAMP,
        embedding FLOAT[1536]
      )`,
    ];

    for (const tableQuery of nodeTables) {
      await this._safeQuery(tableQuery);
    }
  }

  /**
   * Create all relationship tables
   * @private
   */
  async _createRelationshipTables() {
    const relTables = [
      // User relationships
      'CREATE REL TABLE IF NOT EXISTS OWNS (FROM User TO Book, createdAt TIMESTAMP, weight DOUBLE)',
      'CREATE REL TABLE IF NOT EXISTS OWNS_NOTE (FROM User TO Note, createdAt TIMESTAMP, weight DOUBLE)',
      'CREATE REL TABLE IF NOT EXISTS OWNS_VOCAB (FROM User TO Vocabulary, createdAt TIMESTAMP, weight DOUBLE)',
      'CREATE REL TABLE IF NOT EXISTS OWNS_CHAT (FROM User TO Chat, createdAt TIMESTAMP, weight DOUBLE)',
      'CREATE REL TABLE IF NOT EXISTS OWNS_BOOKMARK (FROM User TO Bookmark, createdAt TIMESTAMP, weight DOUBLE)',

      // Note relationships
      'CREATE REL TABLE IF NOT EXISTS ANNOTATES_BOOK (FROM Note TO Book, cfi STRING, percentage DOUBLE, createdAt TIMESTAMP, weight DOUBLE)',
      'CREATE REL TABLE IF NOT EXISTS ANNOTATES_URL (FROM Note TO URL, createdAt TIMESTAMP, weight DOUBLE)',
      'CREATE REL TABLE IF NOT EXISTS MENTIONS_CONCEPT (FROM Note TO Concept, frequency INT64, importance DOUBLE, createdAt TIMESTAMP, weight DOUBLE)',
      'CREATE REL TABLE IF NOT EXISTS LINKS_TO_NOTE (FROM Note TO Note, linkText STRING, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS LINKS_TO_VOCAB (FROM Note TO Vocabulary, linkText STRING, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS LINKS_TO_CONCEPT (FROM Note TO Concept, linkText STRING, createdAt TIMESTAMP)',

      // Review relationships
      'CREATE REL TABLE IF NOT EXISTS REVIEWED_NOTE (FROM User TO Note, outcome STRING, leitnerBoxBefore INT64, leitnerBoxAfter INT64, eventTime TIMESTAMP, recordTime TIMESTAMP, validFrom TIMESTAMP, validTo TIMESTAMP, createdAt TIMESTAMP, weight DOUBLE)',
      'CREATE REL TABLE IF NOT EXISTS REVIEWED_VOCAB (FROM User TO Vocabulary, outcome STRING, leitnerBoxBefore INT64, leitnerBoxAfter INT64, eventTime TIMESTAMP, recordTime TIMESTAMP, validFrom TIMESTAMP, validTo TIMESTAMP, createdAt TIMESTAMP, weight DOUBLE)',

      // Learning session relationships
      'CREATE REL TABLE IF NOT EXISTS HAS_SESSION (FROM User TO LearningSession, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS SESSION_RESOURCE (FROM LearningSession TO Book, resourceType STRING, createdAt TIMESTAMP)',

      // Concept relationships
      'CREATE REL TABLE IF NOT EXISTS REQUIRES (FROM Concept TO Concept, createdAt TIMESTAMP, weight DOUBLE)',
      'CREATE REL TABLE IF NOT EXISTS RELATED_TO (FROM Concept TO Concept, relationType STRING, createdAt TIMESTAMP, weight DOUBLE)',

      // Chat/Message relationships
      'CREATE REL TABLE IF NOT EXISTS BELONGS_TO_CHAT (FROM Message TO Chat, createdAt TIMESTAMP)',

      // Book content relationships
      'CREATE REL TABLE IF NOT EXISTS HAS_CHUNK (FROM Book TO Chunk, chunkIndex INT64, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS CHUNK_TAGGED (FROM Chunk TO KeyConcept, similarity DOUBLE, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS HAS_KEY_CONCEPT (FROM Book TO KeyConcept, createdAt TIMESTAMP)',

      // Memory consolidation relationships
      'CREATE REL TABLE IF NOT EXISTS CONSOLIDATED_INTO (FROM Episode TO ConsolidatedMemory, weight DOUBLE, contributionType STRING, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS SUMMARIZES (FROM ConsolidatedMemory TO Concept, weight DOUBLE, isPrimary BOOL, masteryContribution STRING, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS MEMORY_RELATES (FROM ConsolidatedMemory TO ConsolidatedMemory, relationType STRING, strength DOUBLE, confidence DOUBLE, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS HAS_MEMORY (FROM LearnerProfile TO ConsolidatedMemory, createdAt TIMESTAMP)',

      // Learning point relationships
      'CREATE REL TABLE IF NOT EXISTS HAS_LEARNING_POINT (FROM User TO LearningPoint, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS POINT_FROM_BOOK (FROM LearningPoint TO Book, createdAt TIMESTAMP)',
      'CREATE REL TABLE IF NOT EXISTS POINT_FROM_URL (FROM LearningPoint TO URL, createdAt TIMESTAMP)',
    ];

    for (const relQuery of relTables) {
      await this._safeQuery(relQuery);
    }
  }

  /**
   * Create vector indexes for semantic search
   * Uses Kùzu's native HNSW index
   * @private
   */
  async _createVectorIndexes() {
    if (this.vectorIndexesCreated) return;

    const vectorIndexes = [
      // Note embedding index
      `CALL CREATE_VECTOR_INDEX('note_embedding_idx', 'Note', 'embedding', {
        metric: 'cosine',
        mu: 30,
        ml: 60,
        efc: 200
      })`,

      // Vocabulary embedding index
      `CALL CREATE_VECTOR_INDEX('vocab_embedding_idx', 'Vocabulary', 'embedding', {
        metric: 'cosine',
        mu: 30,
        ml: 60,
        efc: 200
      })`,

      // Concept embedding index
      `CALL CREATE_VECTOR_INDEX('concept_embedding_idx', 'Concept', 'embedding', {
        metric: 'cosine',
        mu: 30,
        ml: 60,
        efc: 200
      })`,

      // Chunk embedding index (for RAG)
      `CALL CREATE_VECTOR_INDEX('chunk_embedding_idx', 'Chunk', 'embedding', {
        metric: 'cosine',
        mu: 30,
        ml: 60,
        efc: 200
      })`,

      // Message embedding index
      `CALL CREATE_VECTOR_INDEX('message_embedding_idx', 'Message', 'embedding', {
        metric: 'cosine',
        mu: 30,
        ml: 60,
        efc: 200
      })`,

      // Bookmark embedding index
      `CALL CREATE_VECTOR_INDEX('bookmark_embedding_idx', 'Bookmark', 'embedding', {
        metric: 'cosine',
        mu: 30,
        ml: 60,
        efc: 200
      })`,

      // LearningPoint embedding index
      `CALL CREATE_VECTOR_INDEX('learning_point_embedding_idx', 'LearningPoint', 'embedding', {
        metric: 'cosine',
        mu: 30,
        ml: 60,
        efc: 200
      })`,
    ];

    for (const indexQuery of vectorIndexes) {
      await this._safeQuery(indexQuery);
    }

    this.vectorIndexesCreated = true;
  }

  // ===========================================================================
  // USER OPERATIONS
  // ===========================================================================

  /**
   * Create or update a user node
   * @param {Object} user - User data
   * @returns {Object} Created/updated user node
   */
  async upsertUser(user) {
    const now = new Date().toISOString();

    try {
      // Try to find existing user
      const existing = await this.query(
        'MATCH (u:User {id: $id}) RETURN u',
        { id: String(user.id) }
      );

      if (existing.length > 0) {
        // Update existing
        await this.query(
          `MATCH (u:User {id: $id})
           SET u.email = $email,
               u.name = $name,
               u.readerLevel = $readerLevel,
               u.studyMode = $studyMode,
               u.preferredProvider = $preferredProvider,
               u.preferredModel = $preferredModel,
               u.updatedAt = $updatedAt
           RETURN u`,
          {
            id: String(user.id),
            email: user.email || '',
            name: user.name || '',
            readerLevel: user.readerLevel || 'middle',
            studyMode: user.studyMode || 'general',
            preferredProvider: user.preferredProvider || 'chatGPT',
            preferredModel: user.preferredModel || '',
            updatedAt: now,
          }
        );
      } else {
        // Create new
        await this.query(
          `CREATE (u:User {
             id: $id,
             email: $email,
             name: $name,
             readerLevel: $readerLevel,
             studyMode: $studyMode,
             preferredProvider: $preferredProvider,
             preferredModel: $preferredModel,
             createdAt: $createdAt,
             updatedAt: $updatedAt
           })`,
          {
            id: String(user.id),
            email: user.email || '',
            name: user.name || '',
            readerLevel: user.readerLevel || 'middle',
            studyMode: user.studyMode || 'general',
            preferredProvider: user.preferredProvider || 'chatGPT',
            preferredModel: user.preferredModel || '',
            createdAt: now,
            updatedAt: now,
          }
        );
      }

      // Return the user
      const result = await this.query(
        'MATCH (u:User {id: $id}) RETURN u',
        { id: String(user.id) }
      );
      return result[0]?.u || null;
    } catch (error) {
      console.error('KuzuAdapter: upsertUser error', error);
      return null;
    }
  }

  // ===========================================================================
  // BOOK OPERATIONS
  // ===========================================================================

  /**
   * Create a book node with OWNS relationship to user
   * @param {Object} book - Book data
   * @param {string} token - User token
   * @returns {Object} Created book node
   */
  async createBook(book, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const bookId = String(book.id || Date.now());

    try {
      await this.query(
        `CREATE (b:Book {
           id: $id,
           keyInStorage: $keyInStorage,
           name: $name,
           subtitle: $subtitle,
           author: $author,
           description: $description,
           cover: $cover,
           format: $format,
           publisher: $publisher,
           category: $category,
           size: $size,
           path: $path,
           favorite: $favorite,
           bookshelfId: $bookshelfId,
           userId: $userId,
           createdAt: $createdAt,
           updatedAt: $updatedAt
         })`,
        {
          id: bookId,
          keyInStorage: book.keyInStorage || '',
          name: book.name || '',
          subtitle: book.subtitle || null,
          author: book.author || null,
          description: book.description || null,
          cover: book.cover || null,
          format: book.format || 'epub',
          publisher: book.publisher || null,
          category: book.category || null,
          size: book.size || 0,
          path: book.path || '',
          favorite: book.favorite || false,
          bookshelfId: book.bookshelfId || -1,
          userId: String(userId),
          createdAt: now,
          updatedAt: now,
        }
      );

      // Create OWNS relationship
      await this.query(
        `MATCH (u:User {id: $userId}), (b:Book {id: $bookId})
         CREATE (u)-[:OWNS {createdAt: $createdAt, weight: 1.0}]->(b)`,
        {
          userId: String(userId),
          bookId: bookId,
          createdAt: now,
        }
      );

      const result = await this.query(
        'MATCH (b:Book {id: $id}) RETURN b',
        { id: bookId }
      );
      return result[0]?.b || null;
    } catch (error) {
      console.error('KuzuAdapter: createBook error', error);
      return null;
    }
  }

  /**
   * Get books by user
   * @param {string} token - User token
   * @returns {Array} User's books
   */
  async getBooksByUser(token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (u:User {id: $userId})-[:OWNS]->(b:Book)
         RETURN b
         ORDER BY b.createdAt DESC`,
        { userId: String(userId) }
      );
      return result.map(r => r.b);
    } catch (error) {
      console.error('KuzuAdapter: getBooksByUser error', error);
      return [];
    }
  }

  // ===========================================================================
  // NOTE OPERATIONS
  // ===========================================================================

  /**
   * Create a note with bi-temporal tracking
   * @param {Object} note - Note data
   * @param {string} token - User token
   * @returns {Object} Created note node
   */
  async createNote(note, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const noteId = String(note.id || Date.now());

    try {
      await this.query(
        `CREATE (n:Note {
           id: $id,
           sourceType: $sourceType,
           sourceKey: $sourceKey,
           title: $title,
           chapter: $chapter,
           chapterIndex: $chapterIndex,
           cards: $cards,
           cfi: $cfi,
           range: $range,
           percentage: $percentage,
           position: $position,
           emoji: $emoji,
           color: $color,
           tags: $tags,
           rate: $rate,
           hasQuiz: $hasQuiz,
           highlightOnly: $highlightOnly,
           highlightType: $highlightType,
           userId: $userId,
           createdAt: $createdAt,
           updatedAt: $updatedAt,
           eventTime: $eventTime,
           recordTime: $recordTime,
           validFrom: $validFrom,
           validTo: $validTo,
           leitnerBox: $leitnerBox,
           leitnerNextReview: $leitnerNextReview,
           leitnerFullyLearned: $leitnerFullyLearned,
           leitnerSkips: $leitnerSkips,
           leitnerFlips: $leitnerFlips,
           leitnerScore: $leitnerScore
         })`,
        {
          id: noteId,
          sourceType: note.sourceType || 'note',
          sourceKey: String(note.sourceKey || ''),
          title: note.title || '',
          chapter: note.chapter || null,
          chapterIndex: note.chapterIndex || null,
          cards: JSON.stringify(note.cards || []),
          cfi: note.cfi || null,
          range: note.range || null,
          percentage: note.percentage || null,
          position: note.position ? JSON.stringify(note.position) : null,
          emoji: note.emoji || null,
          color: note.color || null,
          tags: note.tags || [],
          rate: note.rate || 0,
          hasQuiz: note.hasQuiz || false,
          highlightOnly: note.highlightOnly || false,
          highlightType: note.highlightType || null,
          userId: String(userId),
          createdAt: now,
          updatedAt: now,
          eventTime: now,
          recordTime: now,
          validFrom: now,
          validTo: null,
          leitnerBox: 1,
          leitnerNextReview: null,
          leitnerFullyLearned: false,
          leitnerSkips: 0,
          leitnerFlips: 0,
          leitnerScore: 0,
        }
      );

      // Create OWNS relationship
      await this.query(
        `MATCH (u:User {id: $userId}), (n:Note {id: $noteId})
         CREATE (u)-[:OWNS_NOTE {createdAt: $createdAt, weight: 1.0}]->(n)`,
        {
          userId: String(userId),
          noteId: noteId,
          createdAt: now,
        }
      );

      // Create ANNOTATES relationship if applicable
      if (note.sourceType === 'book' && note.sourceKey) {
        await this._createAnnotatesBookRelationship(noteId, note.sourceKey, note.cfi, note.percentage);
      }

      const result = await this.query(
        'MATCH (n:Note {id: $id}) RETURN n',
        { id: noteId }
      );

      const createdNote = result[0]?.n || null;
      if (createdNote) {
        return {
          ...createdNote,
          cards: createdNote.cards ? JSON.parse(createdNote.cards) : [],
          position: createdNote.position ? JSON.parse(createdNote.position) : null,
        };
      }
      return null;
    } catch (error) {
      console.error('KuzuAdapter: createNote error', error);
      return null;
    }
  }

  /**
   * Create ANNOTATES relationship between note and book
   * @private
   */
  async _createAnnotatesBookRelationship(noteId, bookId, cfi, percentage) {
    try {
      await this.query(
        `MATCH (n:Note {id: $noteId}), (b:Book {id: $bookId})
         CREATE (n)-[:ANNOTATES_BOOK {
           cfi: $cfi,
           percentage: $percentage,
           createdAt: $createdAt,
           weight: 1.0
         }]->(b)`,
        {
          noteId: String(noteId),
          bookId: String(bookId),
          cfi: cfi || null,
          percentage: percentage || null,
          createdAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      // Relationship might already exist or book doesn't exist
      console.warn('KuzuAdapter: _createAnnotatesBookRelationship warning', error.message);
    }
  }

  /**
   * Get notes by source
   * @param {string} sourceKey - Source ID
   * @param {string} sourceType - Type of source
   * @param {string} token - User token
   * @returns {Array} Notes for the source
   */
  async getNotesBySource(sourceKey, sourceType, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (n:Note {sourceKey: $sourceKey, sourceType: $sourceType, userId: $userId})
         RETURN n
         ORDER BY n.createdAt DESC`,
        {
          sourceKey: String(sourceKey),
          sourceType: sourceType,
          userId: String(userId),
        }
      );

      return result.map(r => ({
        ...r.n,
        cards: r.n.cards ? JSON.parse(r.n.cards) : [],
        position: r.n.position ? JSON.parse(r.n.position) : null,
      }));
    } catch (error) {
      console.error('KuzuAdapter: getNotesBySource error', error);
      return [];
    }
  }

  /**
   * Get note by ID
   * @param {string} id - Note ID
   * @param {string} token - User token
   * @returns {Object|null} Note or null
   */
  async getNoteById(id, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    try {
      const result = await this.query(
        'MATCH (n:Note {id: $id, userId: $userId}) RETURN n',
        {
          id: String(id),
          userId: String(userId),
        }
      );

      if (result.length === 0) return null;

      const note = result[0].n;
      return {
        ...note,
        cards: note.cards ? JSON.parse(note.cards) : [],
        position: note.position ? JSON.parse(note.position) : null,
      };
    } catch (error) {
      console.error('KuzuAdapter: getNoteById error', error);
      return null;
    }
  }

  /**
   * Update a note field
   * @param {string} noteId - Note ID
   * @param {string} field - Field to update
   * @param {any} value - New value
   * @param {string} token - User token
   * @returns {number} 1 on success, -1 on failure
   */
  async updateNote(noteId, field, value, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return -1;

    try {
      let processedValue = value;
      if (field === 'cards' || field === 'position') {
        processedValue = typeof value === 'string' ? value : JSON.stringify(value);
      }

      // Dynamic field update - need to construct query carefully
      await this.query(
        `MATCH (n:Note {id: $noteId, userId: $userId})
         SET n.${field} = $value, n.updatedAt = $updatedAt`,
        {
          noteId: String(noteId),
          userId: String(userId),
          value: processedValue,
          updatedAt: new Date().toISOString(),
        }
      );
      return 1;
    } catch (error) {
      console.error('KuzuAdapter: updateNote error', error);
      return -1;
    }
  }

  /**
   * Delete a note
   * @param {string} id - Note ID
   * @param {string} token - User token
   * @returns {number} 1 on success, -1 on failure
   */
  async deleteNote(id, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return -1;

    try {
      // Delete relationships first, then node
      await this.query(
        `MATCH (n:Note {id: $id, userId: $userId})
         DETACH DELETE n`,
        {
          id: String(id),
          userId: String(userId),
        }
      );
      return 1;
    } catch (error) {
      console.error('KuzuAdapter: deleteNote error', error);
      return -1;
    }
  }

  /**
   * Search notes by text
   * @param {string} queryText - Search query
   * @param {string} token - User token
   * @returns {Array} Matching notes
   */
  async searchNotes(queryText, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (n:Note {userId: $userId})
         WHERE n.title CONTAINS $query OR n.cards CONTAINS $query
         RETURN n
         ORDER BY n.updatedAt DESC
         LIMIT 50`,
        {
          userId: String(userId),
          query: queryText,
        }
      );

      return result.map(r => ({
        ...r.n,
        cards: r.n.cards ? JSON.parse(r.n.cards) : [],
        position: r.n.position ? JSON.parse(r.n.position) : null,
      }));
    } catch (error) {
      console.error('KuzuAdapter: searchNotes error', error);
      return [];
    }
  }

  // ===========================================================================
  // VECTOR SIMILARITY SEARCH (Native HNSW)
  // ===========================================================================

  /**
   * Store embedding for a node
   * @param {string} nodeId - Node ID
   * @param {string} nodeType - Node type (Note, Vocabulary, etc.)
   * @param {Array<number>} embedding - Embedding vector
   * @param {string} model - Embedding model used
   */
  async storeEmbedding(nodeId, nodeType, embedding, model) {
    try {
      const label = nodeType.charAt(0).toUpperCase() + nodeType.slice(1).toLowerCase();

      await this.query(
        `MATCH (n:${label} {id: $nodeId})
         SET n.embedding = $embedding,
             n.embeddingModel = $model,
             n.embeddingUpdatedAt = $updatedAt`,
        {
          nodeId: String(nodeId),
          embedding: embedding,
          model: model || 'text-embedding-3-small',
          updatedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error('KuzuAdapter: storeEmbedding error', error);
    }
  }

  /**
   * Find similar nodes using native HNSW vector index
   * @param {Array<number>} queryEmbedding - Query embedding vector
   * @param {Array<string>} nodeTypes - Node types to search
   * @param {number} limit - Max results
   * @param {number} minSimilarity - Min similarity threshold (0-1)
   * @param {string} token - User token
   * @returns {Array} Similar nodes with similarity scores
   */
  async findSimilar(queryEmbedding, nodeTypes, limit, minSimilarity, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0 || !queryEmbedding || queryEmbedding.length === 0) return [];

    try {
      const results = [];

      for (const nodeType of nodeTypes) {
        const label = nodeType.charAt(0).toUpperCase() + nodeType.slice(1).toLowerCase();
        const indexName = `${nodeType.toLowerCase()}_embedding_idx`;

        try {
          // Use Kùzu's native vector search
          const searchResults = await this.query(
            `CALL QUERY_VECTOR_INDEX('${indexName}', $embedding, $limit)
             YIELD node, distance
             WHERE node.userId = $userId
             RETURN node, distance, '${label}' AS nodeType
             ORDER BY distance ASC`,
            {
              embedding: queryEmbedding,
              limit: limit,
              userId: String(userId),
            }
          );

          // Convert distance to similarity (cosine distance -> similarity)
          for (const row of searchResults) {
            const similarity = 1 - row.distance; // cosine distance to similarity
            if (similarity >= minSimilarity) {
              results.push({
                node: row.node,
                nodeType: row.nodeType,
                similarity: similarity,
              });
            }
          }
        } catch (e) {
          // Index might not exist for this type
          console.warn(`KuzuAdapter: Vector search warning for ${label}:`, e.message);
        }
      }

      // Sort by similarity and limit
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, limit);
    } catch (error) {
      console.error('KuzuAdapter: findSimilar error', error);
      return [];
    }
  }

  /**
   * Search chunks by embedding similarity (for RAG)
   * @param {string} bookKey - Book ID
   * @param {Array<number>} queryEmbedding - Query embedding
   * @param {number} limit - Max results
   * @param {number} threshold - Similarity threshold
   * @returns {Array} Similar chunks
   */
  async searchChunksByEmbedding(bookKey, queryEmbedding, limit = 10, threshold = 0.7) {
    try {
      const results = await this.query(
        `CALL QUERY_VECTOR_INDEX('chunk_embedding_idx', $embedding, $limit)
         YIELD node, distance
         WHERE node.bookId = $bookId
         RETURN node AS chunk, distance
         ORDER BY distance ASC`,
        {
          embedding: queryEmbedding,
          limit: limit,
          bookId: String(bookKey),
        }
      );

      return results
        .map(r => ({
          ...r.chunk,
          similarity: 1 - r.distance,
        }))
        .filter(c => c.similarity >= threshold);
    } catch (error) {
      console.error('KuzuAdapter: searchChunksByEmbedding error', error);
      return [];
    }
  }

  // ===========================================================================
  // SPACED REPETITION (LEITNER SYSTEM)
  // ===========================================================================

  /**
   * Get items due for review
   * @param {Date} asOfDate - Date to check against
   * @param {Array} itemTypes - Types to include ('note', 'vocabulary')
   * @param {number} limit - Maximum items to return
   * @param {string} token - User token
   * @returns {Array} Items due for review
   */
  async getDueForReview(asOfDate, itemTypes, limit, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const results = [];
      const dateStr = asOfDate.toISOString();

      for (const itemType of itemTypes) {
        const label = itemType === 'note' ? 'Note' : 'Vocabulary';

        const items = await this.query(
          `MATCH (item:${label} {userId: $userId})
           WHERE item.leitnerFullyLearned = false
             AND (item.leitnerNextReview IS NULL OR item.leitnerNextReview <= $asOfDate)
           RETURN item, '${itemType}' AS itemType
           ORDER BY item.leitnerNextReview ASC
           LIMIT $limit`,
          {
            userId: String(userId),
            asOfDate: dateStr,
            limit: limit,
          }
        );

        for (const row of items) {
          results.push({
            ...row.item,
            itemType: row.itemType,
            cards: row.item.cards ? JSON.parse(row.item.cards) : undefined,
            position: row.item.position ? JSON.parse(row.item.position) : undefined,
          });
        }
      }

      // Sort by next review date and limit
      results.sort((a, b) => {
        if (!a.leitnerNextReview) return -1;
        if (!b.leitnerNextReview) return 1;
        return new Date(a.leitnerNextReview) - new Date(b.leitnerNextReview);
      });

      return results.slice(0, limit);
    } catch (error) {
      console.error('KuzuAdapter: getDueForReview error', error);
      return [];
    }
  }

  /**
   * Record a review outcome and update Leitner box
   * @param {string} itemId - Item ID
   * @param {string} itemType - 'note' or 'vocabulary'
   * @param {string} outcome - 'correct', 'incorrect', or 'skipped'
   * @param {number} leitnerSpeed - Speed factor (1, 2, or 4)
   * @param {string} token - User token
   * @returns {Object} Updated item
   */
  async recordReview(itemId, itemType, outcome, leitnerSpeed, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const label = itemType === 'note' ? 'Note' : 'Vocabulary';
    const now = new Date().toISOString();
    const speed = leitnerSpeed || 2;

    try {
      // Get current state
      const current = await this.query(
        `MATCH (item:${label} {id: $itemId, userId: $userId})
         RETURN item.leitnerBox AS oldBox`,
        {
          itemId: String(itemId),
          userId: String(userId),
        }
      );

      if (current.length === 0) return null;

      const oldBox = current[0].oldBox || 1;
      let newBox = oldBox;

      if (outcome === 'correct') {
        newBox = Math.min(oldBox + 1, 5);
      } else if (outcome === 'incorrect') {
        newBox = 1;
      }

      // Calculate next review date
      const nextReviewDays = newBox * speed;
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + nextReviewDays);

      const fullyLearned = newBox === 5 && outcome === 'correct';

      // Update the item
      await this.query(
        `MATCH (item:${label} {id: $itemId, userId: $userId})
         SET item.leitnerBox = $newBox,
             item.leitnerFlips = item.leitnerFlips + 1,
             item.leitnerSkips = CASE WHEN $outcome = 'skipped' THEN item.leitnerSkips + 1 ELSE item.leitnerSkips END,
             item.leitnerNextReview = $nextReview,
             item.leitnerFullyLearned = $fullyLearned,
             item.updatedAt = $updatedAt`,
        {
          itemId: String(itemId),
          userId: String(userId),
          newBox: newBox,
          outcome: outcome,
          nextReview: nextReview.toISOString(),
          fullyLearned: fullyLearned,
          updatedAt: now,
        }
      );

      // Create review relationship
      const relTable = itemType === 'note' ? 'REVIEWED_NOTE' : 'REVIEWED_VOCAB';
      await this.query(
        `MATCH (u:User {id: $userId}), (item:${label} {id: $itemId})
         CREATE (u)-[:${relTable} {
           outcome: $outcome,
           leitnerBoxBefore: $oldBox,
           leitnerBoxAfter: $newBox,
           eventTime: $eventTime,
           recordTime: $recordTime,
           validFrom: $validFrom,
           validTo: $validTo,
           createdAt: $createdAt,
           weight: 1.0
         }]->(item)`,
        {
          userId: String(userId),
          itemId: String(itemId),
          outcome: outcome,
          oldBox: oldBox,
          newBox: newBox,
          eventTime: now,
          recordTime: now,
          validFrom: now,
          validTo: null,
          createdAt: now,
        }
      );

      // Return updated item
      const updated = await this.query(
        `MATCH (item:${label} {id: $itemId}) RETURN item`,
        { itemId: String(itemId) }
      );

      return updated[0]?.item || null;
    } catch (error) {
      console.error('KuzuAdapter: recordReview error', error);
      return null;
    }
  }

  /**
   * Add a note to Leitner study
   * @param {string} noteId - Note ID
   * @param {string} token - User token
   * @returns {Object} Updated note
   */
  async addNoteToLeitnerStudy(noteId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    try {
      await this.query(
        `MATCH (n:Note {id: $noteId, userId: $userId})
         SET n.leitnerBox = 1,
             n.leitnerNextReview = $nextReview,
             n.leitnerFullyLearned = false,
             n.updatedAt = $updatedAt`,
        {
          noteId: String(noteId),
          userId: String(userId),
          nextReview: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );

      const result = await this.query(
        'MATCH (n:Note {id: $id}) RETURN n',
        { id: String(noteId) }
      );

      return result[0]?.n || null;
    } catch (error) {
      console.error('KuzuAdapter: addNoteToLeitnerStudy error', error);
      return null;
    }
  }

  // ===========================================================================
  // VOCABULARY OPERATIONS
  // ===========================================================================

  /**
   * Create a vocabulary node
   * @param {Object} vocab - Vocabulary data
   * @param {string} token - User token
   * @returns {Object} Created vocabulary node
   */
  async createVocabulary(vocab, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const vocabId = String(vocab.id || Date.now());

    try {
      await this.query(
        `CREATE (v:Vocabulary {
           id: $id,
           word: $word,
           definition: $definition,
           relatedWords: $relatedWords,
           example: $example,
           setId: $setId,
           userId: $userId,
           createdAt: $createdAt,
           updatedAt: $updatedAt,
           eventTime: $eventTime,
           recordTime: $recordTime,
           validFrom: $validFrom,
           validTo: $validTo,
           leitnerBox: 1,
           leitnerNextReview: $leitnerNextReview,
           leitnerFullyLearned: false,
           leitnerSkips: 0,
           leitnerFlips: 0,
           leitnerScore: 0
         })`,
        {
          id: vocabId,
          word: vocab.word || '',
          definition: vocab.definition || '',
          relatedWords: vocab.relatedWords || null,
          example: vocab.example || null,
          setId: vocab.setId || 0,
          userId: String(userId),
          createdAt: now,
          updatedAt: now,
          eventTime: now,
          recordTime: now,
          validFrom: now,
          validTo: null,
          leitnerNextReview: null,
        }
      );

      // Create OWNS relationship
      await this.query(
        `MATCH (u:User {id: $userId}), (v:Vocabulary {id: $vocabId})
         CREATE (u)-[:OWNS_VOCAB {createdAt: $createdAt, weight: 1.0}]->(v)`,
        {
          userId: String(userId),
          vocabId: vocabId,
          createdAt: now,
        }
      );

      const result = await this.query(
        'MATCH (v:Vocabulary {id: $id}) RETURN v',
        { id: vocabId }
      );

      return result[0]?.v || null;
    } catch (error) {
      console.error('KuzuAdapter: createVocabulary error', error);
      return null;
    }
  }

  /**
   * Get vocabulary by word
   * @param {string} word - Word to look up
   * @param {string} token - User token
   * @returns {Object|null} Vocabulary or null
   */
  async getVocabularyByWord(word, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    try {
      const result = await this.query(
        'MATCH (v:Vocabulary {word: $word, userId: $userId}) RETURN v',
        {
          word: word,
          userId: String(userId),
        }
      );

      return result[0]?.v || null;
    } catch (error) {
      console.error('KuzuAdapter: getVocabularyByWord error', error);
      return null;
    }
  }

  // ===========================================================================
  // CONCEPT OPERATIONS
  // ===========================================================================

  /**
   * Create or update a concept node
   * @param {Object} concept - Concept data
   * @param {string} token - User token
   * @returns {Object} Created/updated concept
   */
  async upsertConcept(concept, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const conceptId = String(concept.id || Date.now());

    try {
      // Check if exists
      const existing = await this.query(
        'MATCH (c:Concept {name: $name, userId: $userId}) RETURN c',
        {
          name: concept.name,
          userId: String(userId),
        }
      );

      if (existing.length > 0) {
        // Update
        await this.query(
          `MATCH (c:Concept {name: $name, userId: $userId})
           SET c.exposureCount = c.exposureCount + 1,
               c.updatedAt = $updatedAt
           RETURN c`,
          {
            name: concept.name,
            userId: String(userId),
            updatedAt: now,
          }
        );
      } else {
        // Create
        await this.query(
          `CREATE (c:Concept {
             id: $id,
             name: $name,
             description: $description,
             category: $category,
             masteryLevel: 0,
             exposureCount: 1,
             userId: $userId,
             createdAt: $createdAt,
             updatedAt: $updatedAt,
             eventTime: $eventTime,
             recordTime: $recordTime,
             validFrom: $validFrom,
             validTo: $validTo
           })`,
          {
            id: conceptId,
            name: concept.name,
            description: concept.description || null,
            category: concept.category || null,
            userId: String(userId),
            createdAt: now,
            updatedAt: now,
            eventTime: now,
            recordTime: now,
            validFrom: now,
            validTo: null,
          }
        );
      }

      const result = await this.query(
        'MATCH (c:Concept {name: $name, userId: $userId}) RETURN c',
        {
          name: concept.name,
          userId: String(userId),
        }
      );

      return result[0]?.c || null;
    } catch (error) {
      console.error('KuzuAdapter: upsertConcept error', error);
      return null;
    }
  }

  /**
   * Create MENTIONS_CONCEPT relationship
   * @param {string} noteId - Note ID
   * @param {string} conceptId - Concept ID
   * @param {number} frequency - Mention count
   * @param {number} importance - Importance score (0-1)
   */
  async createMentionsRelationship(noteId, conceptId, frequency, importance) {
    try {
      await this.query(
        `MATCH (n:Note {id: $noteId}), (c:Concept {id: $conceptId})
         CREATE (n)-[:MENTIONS_CONCEPT {
           frequency: $frequency,
           importance: $importance,
           createdAt: $createdAt,
           weight: $importance
         }]->(c)`,
        {
          noteId: String(noteId),
          conceptId: String(conceptId),
          frequency: frequency || 1,
          importance: importance || 0.5,
          createdAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.warn('KuzuAdapter: createMentionsRelationship warning', error.message);
    }
  }

  // ===========================================================================
  // LEARNING SESSION OPERATIONS
  // ===========================================================================

  /**
   * Start a new learning session
   * @param {string} activityType - Type of activity
   * @param {string} primaryResourceType - Type of primary resource
   * @param {string} primaryResourceId - ID of primary resource
   * @param {string} token - User token
   * @returns {Object} Created session
   */
  async startLearningSession(activityType, primaryResourceType, primaryResourceId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const sessionId = `session_${Date.now()}`;

    try {
      await this.query(
        `CREATE (s:LearningSession {
           id: $id,
           userId: $userId,
           activityType: $activityType,
           primaryResourceType: $primaryResourceType,
           primaryResourceId: $primaryResourceId,
           startTime: $startTime,
           endTime: $endTime,
           durationMinutes: 0,
           itemsReviewed: 0,
           itemsLearned: 0,
           accuracy: 0,
           eventTime: $eventTime,
           recordTime: $recordTime,
           validFrom: $validFrom,
           validTo: $validTo
         })`,
        {
          id: sessionId,
          userId: String(userId),
          activityType: activityType,
          primaryResourceType: primaryResourceType || null,
          primaryResourceId: primaryResourceId ? String(primaryResourceId) : null,
          startTime: now,
          endTime: null,
          eventTime: now,
          recordTime: now,
          validFrom: now,
          validTo: null,
        }
      );

      // Create HAS_SESSION relationship
      await this.query(
        `MATCH (u:User {id: $userId}), (s:LearningSession {id: $sessionId})
         CREATE (u)-[:HAS_SESSION {createdAt: $createdAt}]->(s)`,
        {
          userId: String(userId),
          sessionId: sessionId,
          createdAt: now,
        }
      );

      const result = await this.query(
        'MATCH (s:LearningSession {id: $id}) RETURN s',
        { id: sessionId }
      );

      return result[0]?.s || null;
    } catch (error) {
      console.error('KuzuAdapter: startLearningSession error', error);
      return null;
    }
  }

  /**
   * End a learning session
   * @param {string} sessionId - Session ID
   * @param {Object} stats - Session statistics
   * @param {string} token - User token
   * @returns {Object} Updated session
   */
  async endLearningSession(sessionId, stats, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();

    try {
      await this.query(
        `MATCH (s:LearningSession {id: $sessionId, userId: $userId})
         SET s.endTime = $endTime,
             s.durationMinutes = $durationMinutes,
             s.itemsReviewed = $itemsReviewed,
             s.itemsLearned = $itemsLearned,
             s.accuracy = $accuracy`,
        {
          sessionId: String(sessionId),
          userId: String(userId),
          endTime: now,
          durationMinutes: stats.durationMinutes || 0,
          itemsReviewed: stats.itemsReviewed || 0,
          itemsLearned: stats.itemsLearned || 0,
          accuracy: stats.accuracy || 0,
        }
      );

      const result = await this.query(
        'MATCH (s:LearningSession {id: $id}) RETURN s',
        { id: String(sessionId) }
      );

      return result[0]?.s || null;
    } catch (error) {
      console.error('KuzuAdapter: endLearningSession error', error);
      return null;
    }
  }

  // ===========================================================================
  // LEARNING PATH / KNOWLEDGE GRAPH
  // ===========================================================================

  /**
   * Get learning path to a concept (prerequisites)
   * @param {string} targetConceptId - Target concept ID
   * @param {number} maxDepth - Max path depth
   * @param {string} token - User token
   * @returns {Object} Learning path with steps
   */
  async getLearningPath(targetConceptId, maxDepth, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    try {
      // Find prerequisite chain
      const result = await this.query(
        `MATCH path = (prereq:Concept)-[:REQUIRES*1..${maxDepth}]->(target:Concept {id: $targetId})
         WHERE target.userId = $userId
         RETURN nodes(path) AS concepts, length(path) AS depth
         ORDER BY depth ASC`,
        {
          targetId: String(targetConceptId),
          userId: String(userId),
        }
      );

      if (result.length === 0) {
        // No prerequisites, return just the target
        const target = await this.query(
          'MATCH (c:Concept {id: $id}) RETURN c',
          { id: String(targetConceptId) }
        );
        return {
          target: target[0]?.c || null,
          prerequisites: [],
          totalSteps: 0,
        };
      }

      // Get the longest prerequisite chain
      const longestPath = result[result.length - 1];
      const concepts = longestPath.concepts;

      return {
        target: concepts[concepts.length - 1],
        prerequisites: concepts.slice(0, -1),
        totalSteps: concepts.length - 1,
      };
    } catch (error) {
      console.error('KuzuAdapter: getLearningPath error', error);
      return null;
    }
  }

  /**
   * Get knowledge state at a point in time (temporal query)
   * @param {Date} asOfDate - Point in time
   * @param {string} token - User token
   * @returns {Array} Knowledge state
   */
  async getKnowledgeAtTime(asOfDate, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (c:Concept {userId: $userId})
         WHERE c.validFrom <= $asOfDate
           AND (c.validTo IS NULL OR c.validTo > $asOfDate)
         RETURN c
         ORDER BY c.masteryLevel DESC`,
        {
          userId: String(userId),
          asOfDate: asOfDate.toISOString(),
        }
      );

      return result.map(r => r.c);
    } catch (error) {
      console.error('KuzuAdapter: getKnowledgeAtTime error', error);
      return [];
    }
  }

  // ===========================================================================
  // CHAT OPERATIONS
  // ===========================================================================

  /**
   * Create a chat
   * @param {Object} chat - Chat data
   * @param {string} token - User token
   * @returns {Object} Created chat
   */
  async createChat(chat, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const chatId = String(chat.id || Date.now());

    try {
      await this.query(
        `CREATE (c:Chat {
           id: $id,
           name: $name,
           chatType: $chatType,
           articleType: $articleType,
           articleSummary: $articleSummary,
           article: $article,
           sourceKey: $sourceKey,
           userId: $userId,
           createdAt: $createdAt,
           updatedAt: $updatedAt
         })`,
        {
          id: chatId,
          name: chat.name || '',
          chatType: chat.chatType || 'general',
          articleType: chat.articleType || null,
          articleSummary: chat.articleSummary || null,
          article: chat.article || null,
          sourceKey: chat.sourceKey || null,
          userId: String(userId),
          createdAt: now,
          updatedAt: now,
        }
      );

      // Create OWNS relationship
      await this.query(
        `MATCH (u:User {id: $userId}), (c:Chat {id: $chatId})
         CREATE (u)-[:OWNS_CHAT {createdAt: $createdAt, weight: 1.0}]->(c)`,
        {
          userId: String(userId),
          chatId: chatId,
          createdAt: now,
        }
      );

      const result = await this.query(
        'MATCH (c:Chat {id: $id}) RETURN c',
        { id: chatId }
      );

      return result[0]?.c || null;
    } catch (error) {
      console.error('KuzuAdapter: createChat error', error);
      return null;
    }
  }

  /**
   * Add message to chat
   * @param {Object} message - Message data
   * @param {string} chatId - Chat ID
   * @param {string} token - User token
   * @returns {Object} Created message
   */
  async addMessage(message, chatId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const messageId = String(message.id || Date.now());

    try {
      await this.query(
        `CREATE (m:Message {
           id: $id,
           chatId: $chatId,
           role: $role,
           content: $content,
           userId: $userId,
           createdAt: $createdAt
         })`,
        {
          id: messageId,
          chatId: String(chatId),
          role: message.role || 'user',
          content: message.content || '',
          userId: String(userId),
          createdAt: now,
        }
      );

      // Create BELONGS_TO_CHAT relationship
      await this.query(
        `MATCH (m:Message {id: $messageId}), (c:Chat {id: $chatId})
         CREATE (m)-[:BELONGS_TO_CHAT {createdAt: $createdAt}]->(c)`,
        {
          messageId: messageId,
          chatId: String(chatId),
          createdAt: now,
        }
      );

      const result = await this.query(
        'MATCH (m:Message {id: $id}) RETURN m',
        { id: messageId }
      );

      return result[0]?.m || null;
    } catch (error) {
      console.error('KuzuAdapter: addMessage error', error);
      return null;
    }
  }

  /**
   * Search messages by text
   * @param {string} queryText - Search query
   * @param {string} token - User token
   * @returns {Array} Matching messages
   */
  async searchMessages(queryText, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (m:Message {userId: $userId})
         WHERE m.content CONTAINS $query
         RETURN m
         ORDER BY m.createdAt DESC
         LIMIT 50`,
        {
          userId: String(userId),
          query: queryText,
        }
      );

      return result.map(r => r.m);
    } catch (error) {
      console.error('KuzuAdapter: searchMessages error', error);
      return [];
    }
  }

  // ===========================================================================
  // BOOKMARK OPERATIONS
  // ===========================================================================

  /**
   * Create a bookmark
   * @param {Object} bookmark - Bookmark data
   * @param {string} token - User token
   * @returns {Object} Created bookmark
   */
  async createBookmark(bookmark, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const bookmarkId = String(bookmark.id || Date.now());

    try {
      await this.query(
        `CREATE (b:Bookmark {
           id: $id,
           title: $title,
           url: $url,
           description: $description,
           content: $content,
           sourceKey: $sourceKey,
           folderId: $folderId,
           parentId: $parentId,
           isFolder: $isFolder,
           icon: $icon,
           userId: $userId,
           createdAt: $createdAt,
           updatedAt: $updatedAt
         })`,
        {
          id: bookmarkId,
          title: bookmark.title || '',
          url: bookmark.url || '',
          description: bookmark.description || '',
          content: bookmark.content || '',
          sourceKey: bookmark.sourceKey || '',
          folderId: bookmark.folderId || -1,
          parentId: bookmark.parentId || null,
          isFolder: bookmark.isFolder || false,
          icon: bookmark.icon || null,
          userId: String(userId),
          createdAt: now,
          updatedAt: now,
        }
      );

      // Create OWNS relationship
      await this.query(
        `MATCH (u:User {id: $userId}), (b:Bookmark {id: $bookmarkId})
         CREATE (u)-[:OWNS_BOOKMARK {createdAt: $createdAt, weight: 1.0}]->(b)`,
        {
          userId: String(userId),
          bookmarkId: bookmarkId,
          createdAt: now,
        }
      );

      const result = await this.query(
        'MATCH (b:Bookmark {id: $id}) RETURN b',
        { id: bookmarkId }
      );

      return result[0]?.b || null;
    } catch (error) {
      console.error('KuzuAdapter: createBookmark error', error);
      return null;
    }
  }

  /**
   * Get bookmarks by source
   * @param {string} sourceKey - Source identifier (URL)
   * @param {string} token - User token
   * @returns {Array} Bookmarks
   */
  async getBookmarksBySource(sourceKey, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (b:Bookmark {sourceKey: $sourceKey, userId: $userId})
         RETURN b
         ORDER BY b.createdAt DESC`,
        {
          sourceKey: sourceKey,
          userId: String(userId),
        }
      );

      return result.map(r => r.b);
    } catch (error) {
      console.error('KuzuAdapter: getBookmarksBySource error', error);
      return [];
    }
  }

  /**
   * Search bookmarks by text
   * @param {string} queryText - Search query
   * @param {string} token - User token
   * @returns {Array} Matching bookmarks
   */
  async searchBookmarks(queryText, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (b:Bookmark {userId: $userId})
         WHERE b.title CONTAINS $query OR b.description CONTAINS $query OR b.content CONTAINS $query
         RETURN b
         ORDER BY b.updatedAt DESC
         LIMIT 50`,
        {
          userId: String(userId),
          query: queryText,
        }
      );

      return result.map(r => r.b);
    } catch (error) {
      console.error('KuzuAdapter: searchBookmarks error', error);
      return [];
    }
  }

  // ===========================================================================
  // EPISODIC MEMORY / BRAIN
  // ===========================================================================

  /**
   * Batch create Episode nodes
   * @param {Array} events - Array of episode events
   * @returns {Object} Result with count
   */
  async batchCreateEpisodes(events) {
    if (!events || events.length === 0) {
      return { created: 0 };
    }

    const now = new Date().toISOString();
    let created = 0;

    try {
      for (const event of events) {
        const episodeId = event.id || `episode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await this.query(
          `CREATE (e:Episode {
             id: $id,
             userId: $userId,
             eventType: $eventType,
             timestamp: $timestamp,
             payload: $payload,
             conceptId: $conceptId,
             conceptName: $conceptName,
             processed: false,
             processedAt: $processedAt,
             createdAt: $createdAt
           })`,
          {
            id: episodeId,
            userId: String(event.userId),
            eventType: event.eventType,
            timestamp: event.timestamp || now,
            payload: JSON.stringify(event.payload || {}),
            conceptId: event.payload?.conceptId || null,
            conceptName: event.payload?.conceptName || null,
            processedAt: null,
            createdAt: now,
          }
        );
        created++;
      }

      return { created };
    } catch (error) {
      console.error('KuzuAdapter: batchCreateEpisodes error', error);
      return { created, error: error.message };
    }
  }

  // ===========================================================================
  // STATS
  // ===========================================================================

  /**
   * Get graph statistics
   * @returns {Object} Statistics
   */
  async getStats() {
    try {
      const stats = {};

      const nodeTypes = ['User', 'Book', 'Note', 'Vocabulary', 'Concept', 'Chat', 'Message', 'Bookmark', 'LearningSession', 'Episode'];

      for (const nodeType of nodeTypes) {
        try {
          const result = await this.query(
            `MATCH (n:${nodeType}) RETURN count(n) AS count`
          );
          stats[`${nodeType.toLowerCase()}Count`] = result[0]?.count || 0;
        } catch (e) {
          stats[`${nodeType.toLowerCase()}Count`] = 0;
        }
      }

      stats.isConnected = this.isConnected;
      stats.adapterType = 'kuzu';
      stats.dbPath = this.config.dbPath;

      return stats;
    } catch (error) {
      console.error('KuzuAdapter: getStats error', error);
      return { isConnected: this.isConnected, error: error.message };
    }
  }

  // ===========================================================================
  // CHUNK OPERATIONS (for Book RAG)
  // ===========================================================================

  /**
   * Create a single book chunk node
   * @param {string} bookId - Book ID
   * @param {Object} chunk - Chunk data
   * @param {number[]} embedding - Optional embedding vector
   * @param {string} token - User token
   * @returns {Object} Created chunk node
   */
  async createChunk(bookId, chunk, embedding, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const chunkId = chunk.id || `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await this.query(
        `CREATE (c:Chunk {
           id: $chunkId,
           bookId: $bookId,
           userId: $userId,
           text: $text,
           chunkIndex: $chunkIndex,
           pageNum: $pageNum,
           cfi: $cfi,
           sectionTitle: $sectionTitle,
           embedding: $embedding,
           embeddingModel: $embeddingModel,
           createdAt: $createdAt
         })`,
        {
          chunkId: chunkId,
          bookId: String(bookId),
          userId: String(userId),
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          pageNum: chunk.pageNum || null,
          cfi: chunk.cfi || null,
          sectionTitle: chunk.sectionTitle || null,
          embedding: embedding || null,
          embeddingModel: embedding ? (chunk.embeddingModel || 'text-embedding-3-small') : null,
          createdAt: now,
        }
      );

      // Create HAS_CHUNK relationship
      await this._safeQuery(
        `MATCH (b:Book {id: $bookId}), (c:Chunk {id: $chunkId})
         CREATE (b)-[:HAS_CHUNK {chunkIndex: $chunkIndex, createdAt: $createdAt}]->(c)`,
        {
          bookId: String(bookId),
          chunkId: chunkId,
          chunkIndex: chunk.chunkIndex,
          createdAt: now,
        }
      );

      const result = await this.query(
        'MATCH (c:Chunk {id: $id}) RETURN c',
        { id: chunkId }
      );
      return result[0]?.c || null;
    } catch (error) {
      console.error('KuzuAdapter: createChunk error', error);
      return null;
    }
  }

  /**
   * Batch create chunks for a book
   * @param {string} bookId - Book ID
   * @param {Array} chunks - Array of chunk data
   * @param {Array} embeddings - Array of embeddings (parallel to chunks)
   * @param {string} token - User token
   * @returns {number} Number of chunks created
   */
  async batchCreateChunks(bookId, chunks, embeddings, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return 0;

    let created = 0;
    const now = new Date().toISOString();

    try {
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunk = chunks[idx];
        const embedding = embeddings?.[idx] || null;
        const chunkId = chunk.id || `chunk_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;

        await this.query(
          `CREATE (c:Chunk {
             id: $chunkId,
             bookId: $bookId,
             userId: $userId,
             text: $text,
             chunkIndex: $chunkIndex,
             pageNum: $pageNum,
             cfi: $cfi,
             sectionTitle: $sectionTitle,
             embedding: $embedding,
             embeddingModel: $embeddingModel,
             createdAt: $createdAt
           })`,
          {
            chunkId: chunkId,
            bookId: String(bookId),
            userId: String(userId),
            text: chunk.text,
            chunkIndex: chunk.chunkIndex,
            pageNum: chunk.pageNum || null,
            cfi: chunk.cfi || null,
            sectionTitle: chunk.sectionTitle || null,
            embedding: embedding,
            embeddingModel: embedding ? 'text-embedding-3-small' : null,
            createdAt: now,
          }
        );
        created++;
      }

      console.log(`KuzuAdapter: Created ${created} chunks for book ${bookId}`);
      return created;
    } catch (error) {
      console.error('KuzuAdapter: batchCreateChunks error', error);
      return created;
    }
  }

  /**
   * Get all chunks for a book
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {Array} Chunks ordered by chunkIndex
   */
  async getChunksByBook(bookId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (c:Chunk {bookId: $bookId, userId: $userId})
         RETURN c
         ORDER BY c.chunkIndex`,
        { bookId: String(bookId), userId: String(userId) }
      );
      return result.map(r => r.c);
    } catch (error) {
      console.error('KuzuAdapter: getChunksByBook error', error);
      return [];
    }
  }

  /**
   * Get chunks without embeddings
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {Array} Chunks without embeddings
   */
  async getChunksWithoutEmbeddings(bookId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (c:Chunk {bookId: $bookId, userId: $userId})
         WHERE c.embedding IS NULL
         RETURN c
         ORDER BY c.chunkIndex`,
        { bookId: String(bookId), userId: String(userId) }
      );
      return result.map(r => r.c);
    } catch (error) {
      console.error('KuzuAdapter: getChunksWithoutEmbeddings error', error);
      return [];
    }
  }

  /**
   * Update chunk embedding
   * @param {string} chunkId - Chunk ID
   * @param {number[]} embedding - Embedding vector
   * @param {string} model - Embedding model name
   */
  async updateChunkEmbedding(chunkId, embedding, model = 'text-embedding-3-small') {
    try {
      await this.query(
        `MATCH (c:Chunk {id: $chunkId})
         SET c.embedding = $embedding,
             c.embeddingModel = $model,
             c.embeddingUpdatedAt = $updatedAt`,
        {
          chunkId: chunkId,
          embedding: embedding,
          model: model,
          updatedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error('KuzuAdapter: updateChunkEmbedding error', error);
    }
  }

  /**
   * Delete all chunks for a book
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {number} Number of chunks deleted
   */
  async deleteChunksByBook(bookId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return 0;

    try {
      const countResult = await this.query(
        `MATCH (c:Chunk {bookId: $bookId, userId: $userId}) RETURN count(c) AS count`,
        { bookId: String(bookId), userId: String(userId) }
      );
      const count = countResult[0]?.count || 0;

      await this.query(
        `MATCH (c:Chunk {bookId: $bookId, userId: $userId}) DETACH DELETE c`,
        { bookId: String(bookId), userId: String(userId) }
      );

      return count;
    } catch (error) {
      console.error('KuzuAdapter: deleteChunksByBook error', error);
      return 0;
    }
  }

  /**
   * Chunk-index DDL hook. Kùzu builds the chunk vector index during schema
   * setup (_createVectorIndexes), so this is a no-op kept for parity with
   * Neo4jAdapter, which needs an explicit DDL pass.
   */
  async createChunkIndexes() {
    return true;
  }

  /**
   * Vector search for similar chunks using native HNSW
   * @param {number[]} queryEmbedding - Query embedding
   * @param {Object} filters - Filters {bookId, userId}
   * @param {number} limit - Max results
   * @param {number} minSimilarity - Min similarity threshold
   * @returns {Array} Similar chunks with similarity scores
   */
  async searchSimilarChunks(queryEmbedding, filters = {}, limit = 10, minSimilarity = 0.7) {
    try {
      const results = await this.query(
        `CALL QUERY_VECTOR_INDEX('chunk_embedding_idx', $embedding, $limit)
         YIELD node, distance
         WHERE ($bookId IS NULL OR node.bookId = $bookId)
           AND ($userId IS NULL OR node.userId = $userId)
         RETURN node AS chunk, distance
         ORDER BY distance ASC`,
        {
          embedding: queryEmbedding,
          limit: limit,
          bookId: filters.bookId ? String(filters.bookId) : null,
          userId: filters.userId ? String(filters.userId) : null,
        }
      );

      return results
        .map(r => ({
          chunk: r.chunk,
          similarity: 1 - r.distance,
        }))
        .filter(r => r.similarity >= minSimilarity);
    } catch (error) {
      console.error('KuzuAdapter: searchSimilarChunks error', error);
      return [];
    }
  }

  // ===========================================================================
  // KEY CONCEPT OPERATIONS
  // ===========================================================================

  /**
   * Create key concepts for a book
   * @param {string} bookId - Book ID
   * @param {Array} concepts - Array of concept data
   * @param {string} token - User token
   * @returns {number} Number created
   */
  async createKeyConcepts(bookId, concepts, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return 0;

    let created = 0;
    const now = new Date().toISOString();

    try {
      for (let idx = 0; idx < concepts.length; idx++) {
        const concept = concepts[idx];
        const conceptId = concept.id || `concept_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`;

        await this.query(
          `CREATE (k:KeyConcept {
             id: $id,
             bookId: $bookId,
             userId: $userId,
             name: $name,
             description: $description,
             category: $category,
             importance: $importance,
             primarySection: $primarySection,
             createdAt: $createdAt
           })`,
          {
            id: conceptId,
            bookId: String(bookId),
            userId: String(userId),
            name: concept.name,
            description: concept.description || null,
            category: concept.category || null,
            importance: concept.importance || 0.5,
            primarySection: concept.primarySection || null,
            createdAt: now,
          }
        );
        created++;
      }

      return created;
    } catch (error) {
      console.error('KuzuAdapter: createKeyConcepts error', error);
      return created;
    }
  }

  /**
   * Get key concepts for a book
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {Array} Key concepts
   */
  async getKeyConceptsByBook(bookId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (k:KeyConcept {bookId: $bookId, userId: $userId})
         RETURN k
         ORDER BY k.importance DESC, k.name`,
        { bookId: String(bookId), userId: String(userId) }
      );
      return result.map(r => r.k);
    } catch (error) {
      console.error('KuzuAdapter: getKeyConceptsByBook error', error);
      return [];
    }
  }

  /**
   * Store embeddings for key concepts
   * @param {string} bookId - Book ID
   * @param {Array} conceptEmbeddings - Array of {conceptId, embedding}
   */
  async storeConceptEmbeddings(bookId, conceptEmbeddings) {
    try {
      for (const item of conceptEmbeddings) {
        await this.query(
          `MATCH (k:KeyConcept {id: $conceptId})
           SET k.embedding = $embedding,
               k.embeddingModel = 'text-embedding-3-small'`,
          {
            conceptId: item.conceptId,
            embedding: item.embedding,
          }
        );
      }
    } catch (error) {
      console.error('KuzuAdapter: storeConceptEmbeddings error', error);
    }
  }

  /**
   * Tag chunks with matching concepts
   * @param {string} bookId - Book ID
   * @param {number} similarityThreshold - Min similarity
   * @param {string} token - User token
   */
  async tagChunksWithConcepts(bookId, similarityThreshold = 0.75, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return;

    // This would require embedding comparison - simplified version
    console.log(`KuzuAdapter: tagChunksWithConcepts for book ${bookId} (use vector search for full implementation)`);
  }

  /**
   * Derive concept relationships from co-occurrence
   * @param {string} bookId - Book ID
   * @param {number} minCooccurrence - Min count
   * @param {string} token - User token
   */
  async deriveConceptRelationships(bookId, minCooccurrence = 2, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return;

    console.log(`KuzuAdapter: deriveConceptRelationships for book ${bookId}`);
  }

  // ===========================================================================
  // KNOWLEDGE WEB - LINK OPERATIONS
  // ===========================================================================

  /**
   * Get backlinks (items linking TO a target)
   * @param {string} targetId - Target node ID
   * @param {string} targetType - 'note', 'vocabulary', 'concept'
   * @param {string} token - User token
   * @returns {Array} Backlink objects
   */
  async getBacklinks(targetId, targetType, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const targetLabel = this._getLabelForType(targetType);

      const result = await this.query(
        `MATCH (source:Note)-[r:LINKS_TO_${targetLabel.toUpperCase()}]->(target:${targetLabel} {id: $targetId})
         WHERE source.userId = $userId
         RETURN source, r.linkText AS linkText, r.createdAt AS createdAt
         ORDER BY r.createdAt DESC`,
        {
          targetId: String(targetId),
          userId: String(userId),
        }
      );

      return result.map(rec => ({
        note: rec.source,
        noteId: rec.source?.id,
        noteTitle: rec.source?.title || 'Untitled Note',
        linkText: rec.linkText || '',
        createdAt: rec.createdAt || '',
      }));
    } catch (error) {
      console.error('KuzuAdapter: getBacklinks error', error);
      return [];
    }
  }

  /**
   * Get outgoing links from a note
   * @param {string} noteId - Source note ID
   * @param {string} token - User token
   * @returns {Array} Outgoing link objects
   */
  async getOutgoingLinks(noteId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const results = [];

      // Check links to notes
      const noteLinks = await this.query(
        `MATCH (source:Note {id: $noteId, userId: $userId})-[r:LINKS_TO_NOTE]->(target:Note)
         RETURN target, r.linkText AS linkText, 'note' AS targetType`,
        { noteId: String(noteId), userId: String(userId) }
      );
      results.push(...noteLinks.map(r => ({
        target: r.target,
        targetId: r.target?.id,
        type: 'note',
        linkText: r.linkText || '',
      })));

      // Check links to vocabulary
      const vocabLinks = await this.query(
        `MATCH (source:Note {id: $noteId, userId: $userId})-[r:LINKS_TO_VOCAB]->(target:Vocabulary)
         RETURN target, r.linkText AS linkText, 'vocabulary' AS targetType`,
        { noteId: String(noteId), userId: String(userId) }
      );
      results.push(...vocabLinks.map(r => ({
        target: r.target,
        targetId: r.target?.id,
        type: 'vocabulary',
        linkText: r.linkText || '',
      })));

      // Check links to concepts
      const conceptLinks = await this.query(
        `MATCH (source:Note {id: $noteId, userId: $userId})-[r:LINKS_TO_CONCEPT]->(target:Concept)
         RETURN target, r.linkText AS linkText, 'concept' AS targetType`,
        { noteId: String(noteId), userId: String(userId) }
      );
      results.push(...conceptLinks.map(r => ({
        target: r.target,
        targetId: r.target?.id,
        type: 'concept',
        linkText: r.linkText || '',
      })));

      return results;
    } catch (error) {
      console.error('KuzuAdapter: getOutgoingLinks error', error);
      return [];
    }
  }

  /**
   * Sync links from note content
   * @param {string} noteId - Source note ID
   * @param {Array} links - Array of link objects
   * @param {string} token - User token
   * @returns {Object} Result
   */
  async syncNoteLinks(noteId, links, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return { success: false, error: 'Invalid token' };

    try {
      // Delete existing links
      await this._safeQuery(
        `MATCH (n:Note {id: $noteId, userId: $userId})-[r:LINKS_TO_NOTE]->() DELETE r`,
        { noteId: String(noteId), userId: String(userId) }
      );
      await this._safeQuery(
        `MATCH (n:Note {id: $noteId, userId: $userId})-[r:LINKS_TO_VOCAB]->() DELETE r`,
        { noteId: String(noteId), userId: String(userId) }
      );
      await this._safeQuery(
        `MATCH (n:Note {id: $noteId, userId: $userId})-[r:LINKS_TO_CONCEPT]->() DELETE r`,
        { noteId: String(noteId), userId: String(userId) }
      );

      // Create new links
      let linkedCount = 0;
      const now = new Date().toISOString();

      for (const link of links) {
        const targetLabel = this._getLabelForType(link.type);
        const relType = `LINKS_TO_${targetLabel.toUpperCase()}`;

        try {
          await this.query(
            `MATCH (source:Note {id: $sourceId, userId: $userId}), (target:${targetLabel} {id: $targetId})
             CREATE (source)-[:${relType} {createdAt: $createdAt, linkText: $linkText}]->(target)`,
            {
              sourceId: String(noteId),
              targetId: String(link.targetId),
              userId: String(userId),
              createdAt: now,
              linkText: link.text || '',
            }
          );
          linkedCount++;
        } catch (e) {
          console.warn(`KuzuAdapter: Failed to create link to ${link.targetId}:`, e.message);
        }
      }

      return { success: true, linked: linkedCount };
    } catch (error) {
      console.error('KuzuAdapter: syncNoteLinks error', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search for items to link
   * @param {string} query - Search query
   * @param {string} token - User token
   * @param {number} limit - Max results
   * @returns {Array} Suggestions
   */
  async searchForLinking(query, token, limit = 15) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const results = [];

    try {
      // Search vocabulary
      const vocabResult = await this.query(
        `MATCH (v:Vocabulary {userId: $userId})
         WHERE v.word CONTAINS $query
         RETURN v
         ORDER BY v.word
         LIMIT $limit`,
        { userId: String(userId), query: query, limit: Math.ceil(limit / 3) }
      );

      vocabResult.forEach(rec => {
        results.push({
          type: 'vocabulary',
          id: rec.v?.id,
          word: rec.v?.word,
          definition: rec.v?.definition?.substring(0, 100) || '',
          priority: 1,
        });
      });

      // Search concepts
      const conceptResult = await this.query(
        `MATCH (c:Concept {userId: $userId})
         WHERE c.name CONTAINS $query
         RETURN c
         ORDER BY c.name
         LIMIT $limit`,
        { userId: String(userId), query: query, limit: Math.ceil(limit / 3) }
      );

      conceptResult.forEach(rec => {
        results.push({
          type: 'concept',
          id: rec.c?.id,
          name: rec.c?.name,
          description: rec.c?.description?.substring(0, 100) || '',
          priority: 2,
        });
      });

      // Search notes
      const noteResult = await this.query(
        `MATCH (n:Note {userId: $userId})
         WHERE n.title CONTAINS $query
         RETURN n
         ORDER BY n.updatedAt DESC
         LIMIT $limit`,
        { userId: String(userId), query: query, limit: Math.ceil(limit / 3) }
      );

      noteResult.forEach(rec => {
        results.push({
          type: 'note',
          id: rec.n?.id,
          title: rec.n?.title || 'Untitled Note',
          priority: 3,
        });
      });

      results.sort((a, b) => a.priority - b.priority);
      return results.slice(0, limit);
    } catch (error) {
      console.error('KuzuAdapter: searchForLinking error', error);
      return [];
    }
  }

  /**
   * Find notes with shared tags
   * @param {Array} tags - Tags to search
   * @param {string} excludeNoteId - Note to exclude
   * @param {string} token - User token
   * @param {number} minSharedTags - Min shared tags
   * @returns {Array} Related notes
   */
  async findNotesBySharedTags(tags, excludeNoteId, token, minSharedTags = 2) {
    const userId = getUserIdFromToken(token);
    if (userId < 0 || !tags || tags.length < minSharedTags) return [];

    try {
      const result = await this.query(
        `MATCH (n:Note {userId: $userId})
         WHERE n.id <> $excludeId AND n.tags IS NOT NULL
         RETURN n
         ORDER BY n.updatedAt DESC
         LIMIT 20`,
        {
          userId: String(userId),
          excludeId: String(excludeNoteId),
        }
      );

      // Filter by shared tags in JS
      return result
        .map(r => {
          const noteTags = r.n?.tags || [];
          const sharedTags = tags.filter(t => noteTags.includes(t));
          return {
            note: r.n,
            sharedTags,
            sharedCount: sharedTags.length,
          };
        })
        .filter(r => r.sharedCount >= minSharedTags)
        .sort((a, b) => b.sharedCount - a.sharedCount)
        .slice(0, 10);
    } catch (error) {
      console.error('KuzuAdapter: findNotesBySharedTags error', error);
      return [];
    }
  }

  /**
   * Find semantically similar notes using vector search
   * @param {string} noteId - Source note ID
   * @param {Array} embedding - Embedding vector
   * @param {number} threshold - Similarity threshold
   * @param {string} token - User token
   * @returns {Array} Similar notes
   */
  async findSemanticallySimilarNotes(noteId, embedding, threshold = 0.75, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0 || !embedding || embedding.length === 0) return [];

    try {
      const results = await this.query(
        `CALL QUERY_VECTOR_INDEX('note_embedding_idx', $embedding, 15)
         YIELD node, distance
         WHERE node.userId = $userId AND node.id <> $excludeId
         RETURN node, distance
         ORDER BY distance ASC`,
        {
          embedding: embedding,
          userId: String(userId),
          excludeId: String(noteId),
        }
      );

      return results
        .map(r => ({
          note: r.node,
          similarity: 1 - r.distance,
        }))
        .filter(r => r.similarity >= threshold)
        .slice(0, 10);
    } catch (error) {
      console.error('KuzuAdapter: findSemanticallySimilarNotes error', error);
      return [];
    }
  }

  /**
   * Get link preview data
   * @param {string} type - Target type
   * @param {string} id - Target ID
   * @param {string} token - User token
   * @returns {Object|null} Preview data
   */
  async getLinkPreview(type, id, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    try {
      const label = this._getLabelForType(type);

      const result = await this.query(
        `MATCH (t:${label} {id: $id})
         RETURN t`,
        { id: String(id) }
      );

      if (result.length === 0) return null;

      const node = result[0].t;

      switch (type) {
        case 'vocabulary':
          return {
            type: 'vocabulary',
            word: node?.word,
            definition: node?.definition,
            example: node?.example,
            leitnerBox: node?.leitnerBox || 1,
          };
        case 'concept':
          return {
            type: 'concept',
            name: node?.name,
            description: node?.description,
            mastery: node?.masteryLevel || 0,
          };
        case 'note':
        default:
          return {
            type: 'note',
            title: node?.title || 'Untitled Note',
            tags: node?.tags || [],
            sourceType: node?.sourceType,
          };
      }
    } catch (error) {
      console.error('KuzuAdapter: getLinkPreview error', error);
      return null;
    }
  }

  // ===========================================================================
  // UNIFIED LEARNING POINT OPERATIONS
  // ===========================================================================

  /**
   * Leitner box intervals (days)
   */
  static get BOX_INTERVALS() {
    return [1, 2, 4, 7, 14];
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateLearningPointId() {
    return `lp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a unified learning point
   * @param {Object} point - Learning point data
   * @param {string} token - User token
   * @returns {Object|null}
   */
  async createLearningPoint(point, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const now = new Date().toISOString();
    const id = point.id || this._generateLearningPointId();
    const today = now.split('T')[0];

    try {
      await this.query(
        `CREATE (lp:LearningPoint {
           id: $id,
           userId: $userId,
           itemType: $itemType,
           domainType: $domainType,
           title: $title,
           front: $front,
           back: $back,
           extras: $extras,
           sourceType: $sourceType,
           sourceId: $sourceId,
           cfi: $cfi,
           chapter: $chapter,
           chapterIndex: $chapterIndex,
           pageNumber: $pageNumber,
           percentage: $percentage,
           tags: $tags,
           difficulty: $difficulty,
           planId: $planId,
           box: 1,
           nextReview: $nextReview,
           lastReviewedAt: $lastReviewedAt,
           reviewCount: 0,
           correctStreak: 0,
           totalCorrect: 0,
           totalIncorrect: 0,
           easeFactor: 2.5,
           fullyLearned: false,
           masteryLevel: 0,
           avgResponseTimeMs: 0,
           lastResponseTimeMs: 0,
           eventTime: $eventTime,
           validFrom: $validFrom,
           validTo: $validTo,
           createdAt: $createdAt,
           updatedAt: $updatedAt
         })`,
        {
          id: id,
          userId: String(userId),
          itemType: point.itemType || 'concept',
          domainType: point.domainType || 'knowledge',
          title: point.title || '',
          front: typeof point.front === 'string' ? point.front : JSON.stringify(point.front || ''),
          back: typeof point.back === 'string' ? point.back : JSON.stringify(point.back || ''),
          extras: point.extras ? JSON.stringify(point.extras) : null,
          sourceType: point.sourceType || null,
          sourceId: point.sourceId ? String(point.sourceId) : null,
          cfi: point.cfi || null,
          chapter: point.chapter || null,
          chapterIndex: point.chapterIndex || null,
          pageNumber: point.pageNumber || null,
          percentage: point.percentage || null,
          tags: point.tags || [],
          difficulty: point.difficulty || 'intermediate',
          planId: point.planId || null,
          nextReview: today,
          lastReviewedAt: null,
          eventTime: now,
          validFrom: now,
          validTo: null,
          createdAt: now,
          updatedAt: now,
        }
      );

      // Create OWNS relationship
      await this._safeQuery(
        `MATCH (u:User {id: $userId}), (lp:LearningPoint {id: $lpId})
         CREATE (u)-[:HAS_LEARNING_POINT {createdAt: $createdAt}]->(lp)`,
        {
          userId: String(userId),
          lpId: id,
          createdAt: now,
        }
      );

      const result = await this.query(
        'MATCH (lp:LearningPoint {id: $id}) RETURN lp',
        { id: id }
      );

      return this._parseLearningPointNode(result[0]?.lp);
    } catch (error) {
      console.error('KuzuAdapter: createLearningPoint error', error);
      return null;
    }
  }

  /**
   * Batch create learning points
   * @param {Array} points - Array of learning point data
   * @param {string} token - User token
   * @returns {Object} Result with created count
   */
  async createLearningPointsBatch(points, token) {
    const results = { created: 0, errors: [] };

    for (const point of points) {
      try {
        if (!point.title && !point.front) {
          results.errors.push({ point: point.title || '', error: 'Title or front required' });
          continue;
        }

        const created = await this.createLearningPoint(point, token);
        if (created) {
          results.created++;
        } else {
          results.errors.push({ point: point.title || '', error: 'Failed to create' });
        }
      } catch (error) {
        results.errors.push({ point: point.title || '', error: error.message });
      }
    }

    return results;
  }

  /**
   * Get learning point by ID
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @returns {Object|null}
   */
  async getLearningPointById(id, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    try {
      const result = await this.query(
        `MATCH (lp:LearningPoint {id: $id, userId: $userId})
         WHERE lp.validTo IS NULL
         RETURN lp`,
        { id: id, userId: String(userId) }
      );

      return this._parseLearningPointNode(result[0]?.lp);
    } catch (error) {
      console.error('KuzuAdapter: getLearningPointById error', error);
      return null;
    }
  }

  /**
   * Update learning point
   * @param {string} id - Learning point ID
   * @param {Object} updates - Updates to apply
   * @param {string} token - User token
   * @returns {Object}
   */
  async updateLearningPoint(id, updates, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return { error: 'Invalid session' };

    const allowedFields = [
      'title', 'front', 'back', 'extras', 'tags', 'difficulty',
      'itemType', 'domainType', 'cfi', 'chapter', 'chapterIndex',
      'pageNumber', 'percentage', 'planId',
    ];

    const setClauses = ['lp.updatedAt = $updatedAt'];
    const params = { id: id, userId: String(userId), updatedAt: new Date().toISOString() };

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const paramKey = `update_${key}`;
        if (key === 'front' || key === 'back' || key === 'extras') {
          params[paramKey] = typeof value === 'string' ? value : JSON.stringify(value);
        } else {
          params[paramKey] = value;
        }
        setClauses.push(`lp.${key} = $${paramKey}`);
      }
    }

    if (setClauses.length === 1) {
      return { error: 'No valid fields to update' };
    }

    try {
      await this.query(
        `MATCH (lp:LearningPoint {id: $id, userId: $userId})
         WHERE lp.validTo IS NULL
         SET ${setClauses.join(', ')}`,
        params
      );

      const result = await this.query(
        'MATCH (lp:LearningPoint {id: $id}) RETURN lp',
        { id: id }
      );

      return this._parseLearningPointNode(result[0]?.lp) || { error: 'Not found' };
    } catch (error) {
      console.error('KuzuAdapter: updateLearningPoint error', error);
      return { error: error.message };
    }
  }

  /**
   * Delete a learning point
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @param {boolean} hard - Hard delete
   * @returns {boolean}
   */
  async deleteLearningPoint(id, token, hard = false) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return false;

    try {
      if (hard) {
        await this.query(
          `MATCH (lp:LearningPoint {id: $id, userId: $userId}) DETACH DELETE lp`,
          { id: id, userId: String(userId) }
        );
      } else {
        await this.query(
          `MATCH (lp:LearningPoint {id: $id, userId: $userId})
           WHERE lp.validTo IS NULL
           SET lp.validTo = $validTo, lp.updatedAt = $updatedAt`,
          { id: id, userId: String(userId), validTo: new Date().toISOString(), updatedAt: new Date().toISOString() }
        );
      }
      return true;
    } catch (error) {
      console.error('KuzuAdapter: deleteLearningPoint error', error);
      return false;
    }
  }

  /**
   * Get learning points due for review
   * @param {Object} options - Query options
   * @returns {Array}
   */
  async getLearningPointsDue(options = {}) {
    const { token, date, limit = 50, itemTypes, domainTypes, tags, planId } = options;
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const asOfDate = date || new Date().toISOString().split('T')[0];

    try {
      let whereClause = `lp.userId = $userId AND lp.fullyLearned = false AND lp.validTo IS NULL`;
      const params = { userId: String(userId), asOfDate: asOfDate, limit: limit };

      if (planId) {
        whereClause += ' AND lp.planId = $planId';
        params.planId = planId;
      }

      const result = await this.query(
        `MATCH (lp:LearningPoint)
         WHERE ${whereClause}
           AND (lp.nextReview IS NULL OR lp.nextReview <= $asOfDate)
         RETURN lp
         ORDER BY lp.nextReview ASC, lp.box ASC
         LIMIT $limit`,
        params
      );

      return result.map(r => this._parseLearningPointNode(r.lp)).filter(Boolean);
    } catch (error) {
      console.error('KuzuAdapter: getLearningPointsDue error', error);
      return [];
    }
  }

  /**
   * Get learning points by source
   * @param {string} sourceType - Source type
   * @param {string} sourceId - Source ID
   * @param {string} token - User token
   * @returns {Array}
   */
  async getLearningPointsBySource(sourceType, sourceId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (lp:LearningPoint {userId: $userId, sourceType: $sourceType, sourceId: $sourceId})
         WHERE lp.validTo IS NULL
         RETURN lp
         ORDER BY lp.createdAt DESC`,
        { userId: String(userId), sourceType: sourceType, sourceId: String(sourceId) }
      );

      return result.map(r => this._parseLearningPointNode(r.lp)).filter(Boolean);
    } catch (error) {
      console.error('KuzuAdapter: getLearningPointsBySource error', error);
      return [];
    }
  }

  /**
   * Get learning points by plan
   * @param {string} planId - Plan ID
   * @param {string} token - User token
   * @returns {Array}
   */
  async getLearningPointsByPlan(planId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    try {
      const result = await this.query(
        `MATCH (lp:LearningPoint {userId: $userId, planId: $planId})
         WHERE lp.validTo IS NULL
         RETURN lp
         ORDER BY lp.createdAt DESC`,
        { userId: String(userId), planId: planId }
      );

      return result.map(r => this._parseLearningPointNode(r.lp)).filter(Boolean);
    } catch (error) {
      console.error('KuzuAdapter: getLearningPointsByPlan error', error);
      return [];
    }
  }

  /**
   * Search learning points
   * @param {string} query - Search query
   * @param {string} token - User token
   * @param {Object} options - Options
   * @returns {Array}
   */
  async searchLearningPoints(query, token, options = {}) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const { limit = 50 } = options;

    try {
      const result = await this.query(
        `MATCH (lp:LearningPoint {userId: $userId})
         WHERE lp.validTo IS NULL
           AND (lp.title CONTAINS $query OR lp.front CONTAINS $query OR lp.back CONTAINS $query)
         RETURN lp
         ORDER BY lp.updatedAt DESC
         LIMIT $limit`,
        { userId: String(userId), query: query, limit: limit }
      );

      return result.map(r => this._parseLearningPointNode(r.lp)).filter(Boolean);
    } catch (error) {
      console.error('KuzuAdapter: searchLearningPoints error', error);
      return [];
    }
  }

  /**
   * Get all learning points with pagination
   * @param {string} token - User token
   * @param {Object} options - Options
   * @returns {Object}
   */
  async getAllLearningPoints(token, options = {}) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return { items: [], total: 0, page: 1, pageSize: 20 };

    const { page = 1, pageSize = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * pageSize;

    try {
      // Get count
      const countResult = await this.query(
        `MATCH (lp:LearningPoint {userId: $userId}) WHERE lp.validTo IS NULL RETURN count(lp) AS total`,
        { userId: String(userId) }
      );
      const total = countResult[0]?.total || 0;

      // Get items
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const result = await this.query(
        `MATCH (lp:LearningPoint {userId: $userId})
         WHERE lp.validTo IS NULL
         RETURN lp
         ORDER BY lp.${sortBy} ${order}
         SKIP $skip
         LIMIT $limit`,
        { userId: String(userId), skip: skip, limit: pageSize }
      );

      const items = result.map(r => this._parseLearningPointNode(r.lp)).filter(Boolean);
      return { items, total, page, pageSize };
    } catch (error) {
      console.error('KuzuAdapter: getAllLearningPoints error', error);
      return { items: [], total: 0, page, pageSize };
    }
  }

  /**
   * Process review and update spaced repetition state
   * @param {string} id - Learning point ID
   * @param {number} rating - 1-4 rating
   * @param {number} responseTimeMs - Response time
   * @param {string} token - User token
   * @returns {Object}
   */
  async processLearningPointReview(id, rating, responseTimeMs, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return { error: 'Invalid session' };

    try {
      // Get current state
      const current = await this.query(
        `MATCH (lp:LearningPoint {id: $id, userId: $userId}) WHERE lp.validTo IS NULL RETURN lp`,
        { id: id, userId: String(userId) }
      );

      if (current.length === 0) {
        return { error: 'Learning point not found' };
      }

      const lp = current[0].lp;
      const currentBox = lp?.box || 1;
      const currentEase = lp?.easeFactor || 2.5;
      const currentStreak = lp?.correctStreak || 0;
      const currentReviewCount = lp?.reviewCount || 0;
      const currentCorrect = lp?.totalCorrect || 0;
      const currentIncorrect = lp?.totalIncorrect || 0;
      const currentAvgTime = lp?.avgResponseTimeMs || 0;

      // Calculate new state
      let newBox = currentBox;
      let newEase = currentEase;
      let isCorrect = false;

      switch (rating) {
        case 1: newBox = 1; newEase = Math.max(1.3, currentEase - 0.2); break;
        case 2: newBox = currentBox; newEase = Math.max(1.3, currentEase - 0.15); break;
        case 3: newBox = Math.min(5, currentBox + 1); isCorrect = true; break;
        case 4: newBox = Math.min(5, currentBox + 2); newEase = currentEase + 0.15; isCorrect = true; break;
      }

      const intervalDays = KuzuAdapter.BOX_INTERVALS[newBox - 1] || 14;
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
      const nextReview = nextReviewDate.toISOString().split('T')[0];

      const newStreak = isCorrect ? currentStreak + 1 : 0;
      const fullyLearned = newBox === 5 && newStreak >= 3;
      const masteryLevel = Math.min(100, Math.round((newBox / 5) * 70 + (newStreak / 5) * 30));

      const newReviewCount = currentReviewCount + 1;
      const newAvgTime = currentReviewCount === 0 ? responseTimeMs :
        Math.round((currentAvgTime * currentReviewCount + responseTimeMs) / newReviewCount);

      // Update
      await this.query(
        `MATCH (lp:LearningPoint {id: $id, userId: $userId})
         WHERE lp.validTo IS NULL
         SET lp.box = $newBox,
             lp.nextReview = $nextReview,
             lp.lastReviewedAt = $lastReviewedAt,
             lp.reviewCount = $reviewCount,
             lp.correctStreak = $streak,
             lp.totalCorrect = $totalCorrect,
             lp.totalIncorrect = $totalIncorrect,
             lp.easeFactor = $ease,
             lp.fullyLearned = $fullyLearned,
             lp.masteryLevel = $mastery,
             lp.lastResponseTimeMs = $lastTime,
             lp.avgResponseTimeMs = $avgTime,
             lp.updatedAt = $updatedAt`,
        {
          id: id,
          userId: String(userId),
          newBox: newBox,
          nextReview: nextReview,
          lastReviewedAt: new Date().toISOString(),
          reviewCount: newReviewCount,
          streak: newStreak,
          totalCorrect: currentCorrect + (isCorrect ? 1 : 0),
          totalIncorrect: currentIncorrect + (isCorrect ? 0 : 1),
          ease: newEase,
          fullyLearned: fullyLearned,
          mastery: masteryLevel,
          lastTime: responseTimeMs,
          avgTime: newAvgTime,
          updatedAt: new Date().toISOString(),
        }
      );

      return {
        success: true,
        newBox,
        nextReview,
        masteryLevel,
        correctStreak: newStreak,
        reviewCount: newReviewCount,
        fullyLearned,
      };
    } catch (error) {
      console.error('KuzuAdapter: processLearningPointReview error', error);
      return { error: error.message };
    }
  }

  /**
   * Reset learning point to box 1
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @returns {boolean}
   */
  async resetLearningPoint(id, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return false;

    const today = new Date().toISOString().split('T')[0];

    try {
      await this.query(
        `MATCH (lp:LearningPoint {id: $id, userId: $userId})
         WHERE lp.validTo IS NULL
         SET lp.box = 1,
             lp.nextReview = $today,
             lp.correctStreak = 0,
             lp.fullyLearned = false,
             lp.masteryLevel = 0,
             lp.updatedAt = $updatedAt`,
        { id: id, userId: String(userId), today: today, updatedAt: new Date().toISOString() }
      );
      return true;
    } catch (error) {
      console.error('KuzuAdapter: resetLearningPoint error', error);
      return false;
    }
  }

  /**
   * Get learning point statistics
   * @param {string} token - User token
   * @param {Object} options - Options
   * @returns {Object|null}
   */
  async getLearningPointStats(token, options = {}) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const { planId, domainType } = options;

    try {
      let whereClause = 'lp.userId = $userId AND lp.validTo IS NULL';
      const params = { userId: String(userId) };

      if (planId) {
        whereClause += ' AND lp.planId = $planId';
        params.planId = planId;
      }
      if (domainType) {
        whereClause += ' AND lp.domainType = $domainType';
        params.domainType = domainType;
      }

      const today = new Date().toISOString().split('T')[0];
      params.today = today;

      const result = await this.query(
        `MATCH (lp:LearningPoint)
         WHERE ${whereClause}
         RETURN
           count(lp) AS total,
           sum(CASE WHEN lp.fullyLearned = true THEN 1 ELSE 0 END) AS mastered,
           sum(CASE WHEN lp.nextReview <= $today AND lp.fullyLearned = false THEN 1 ELSE 0 END) AS dueToday,
           sum(lp.totalCorrect) AS totalCorrect,
           sum(lp.totalIncorrect) AS totalIncorrect,
           sum(lp.reviewCount) AS totalReviews`,
        params
      );

      const record = result[0] || {};
      const total = record.total || 0;
      const mastered = record.mastered || 0;
      const dueToday = record.dueToday || 0;
      const totalCorrect = record.totalCorrect || 0;
      const totalIncorrect = record.totalIncorrect || 0;
      const totalReviews = record.totalReviews || 0;

      // Get box distribution
      const boxResult = await this.query(
        `MATCH (lp:LearningPoint) WHERE ${whereClause}
         RETURN lp.box AS box, count(*) AS count`,
        params
      );

      const byBox = {};
      boxResult.forEach(r => {
        byBox[r.box || 1] = r.count || 0;
      });

      return {
        total,
        mastered,
        dueToday,
        learning: total - mastered,
        accuracy: totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0,
        totalReviews,
        totalCorrect,
        totalIncorrect,
        byBox,
      };
    } catch (error) {
      console.error('KuzuAdapter: getLearningPointStats error', error);
      return null;
    }
  }

  /**
   * Get daily forecast
   * @param {string} token - User token
   * @param {number} days - Number of days
   * @returns {Object}
   */
  async getLearningPointForecast(token, days = 14) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return {};

    try {
      const result = await this.query(
        `MATCH (lp:LearningPoint {userId: $userId})
         WHERE lp.validTo IS NULL
           AND lp.fullyLearned = false
           AND lp.nextReview IS NOT NULL
         RETURN lp.nextReview AS reviewDate, count(*) AS count
         ORDER BY lp.nextReview`,
        { userId: String(userId) }
      );

      const forecast = {};
      result.forEach(r => {
        if (r.reviewDate) {
          forecast[r.reviewDate] = r.count || 0;
        }
      });

      return forecast;
    } catch (error) {
      console.error('KuzuAdapter: getLearningPointForecast error', error);
      return {};
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Parse LearningPoint node to JS object
   * @private
   */
  _parseLearningPointNode(node) {
    if (!node) return null;

    return {
      id: node.id,
      userId: node.userId,
      itemType: node.itemType,
      domainType: node.domainType,
      title: node.title,
      front: this._parseJson(node.front),
      back: this._parseJson(node.back),
      extras: this._parseJson(node.extras),
      sourceType: node.sourceType,
      sourceId: node.sourceId,
      cfi: node.cfi,
      chapter: node.chapter,
      chapterIndex: node.chapterIndex,
      pageNumber: node.pageNumber,
      percentage: node.percentage,
      tags: node.tags || [],
      difficulty: node.difficulty,
      planId: node.planId,
      box: node.box || 1,
      nextReview: node.nextReview,
      lastReviewedAt: node.lastReviewedAt,
      reviewCount: node.reviewCount || 0,
      correctStreak: node.correctStreak || 0,
      totalCorrect: node.totalCorrect || 0,
      totalIncorrect: node.totalIncorrect || 0,
      easeFactor: node.easeFactor || 2.5,
      fullyLearned: node.fullyLearned || false,
      masteryLevel: node.masteryLevel || 0,
      avgResponseTimeMs: node.avgResponseTimeMs || 0,
      lastResponseTimeMs: node.lastResponseTimeMs || 0,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  }

  /**
   * Parse JSON string safely
   * @private
   */
  _parseJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  }

  /**
   * Get label for type
   * @private
   */
  _getLabelForType(type) {
    const typeMap = {
      vocabulary: 'Vocabulary',
      concept: 'Concept',
      note: 'Note',
      book: 'Book',
      url: 'URL',
      learningpoint: 'LearningPoint',
    };
    return typeMap[type?.toLowerCase()] || 'Note';
  }

  /**
   * Get migration stats (for compatibility)
   * @returns {Object}
   */
  async getMigrationStats() {
    return this.getStats();
  }
}

// Create and export singleton
const kuzuAdapter = new KuzuAdapter();
export default kuzuAdapter;
export { KuzuAdapter };
