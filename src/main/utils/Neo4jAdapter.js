/**
 * Neo4jAdapter.js
 *
 * Neo4j implementation of the GraphInterface.
 * Implements Graphiti-inspired bi-temporal patterns for learning progression.
 *
 * This adapter handles:
 * - Connection management to Neo4j
 * - CRUD operations for all node types
 * - Relationship creation and traversal
 * - Semantic similarity search (replacing ChromaDB)
 * - Spaced repetition queries
 * - Learning path recommendations
 *
 * Future: Can be swapped with GraphitiAdapter when Graphiti integration is ready.
 */

import neo4j from 'neo4j-driver';
import { getUserIdFromToken } from '../db/dbManager';

/**
 * Configuration for Neo4j connection
 */
const DEFAULT_CONFIG = {
  uri: 'bolt://localhost:7687',
  user: 'neo4j',
  password: 'password', // Should be configured via electron-store
  database: 'neo4j',
};

/**
 * Neo4jAdapter Singleton
 *
 * Implements GraphInterface for Neo4j database.
 * Provides all graph database operations for the SmartReader learning system.
 */
class Neo4jAdapter {
  constructor() {
    if (Neo4jAdapter.instance) {
      return Neo4jAdapter.instance;
    }

    this.driver = null;
    this.isConnected = false;
    this.config = { ...DEFAULT_CONFIG };

    Neo4jAdapter.instance = this;
  }

  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  /**
   * Initialize connection to Neo4j
   * @param {Object} store - electron-store instance for configuration
   */
  async connect(store) {
    try {
      // Get configuration from store or use defaults
      const uri = store?.get('neo4j_uri') || this.config.uri;
      const user = store?.get('neo4j_user') || this.config.user;
      const password = store?.get('neo4j_password') || this.config.password;

      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
        maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
        disableLosslessIntegers: true, // Return regular JS numbers
      });

      // Verify connectivity
      await this.driver.verifyConnectivity();
      this.isConnected = true;
      console.log('GraphManager: Connected to Neo4j');

      // Create indexes on first connection
      await this.createIndexes();

      return true;
    } catch (error) {
      console.error('GraphManager: Failed to connect to Neo4j', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Close the Neo4j connection
   */
  async disconnect() {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.isConnected = false;
      console.log('GraphManager: Disconnected from Neo4j');
    }
  }

  /**
   * Get a session for database operations
   * @returns {Session}
   */
  getSession() {
    if (!this.driver || !this.isConnected) {
      throw new Error('GraphManager: Not connected to Neo4j');
    }
    return this.driver.session({ database: this.config.database });
  }

  /**
   * Check if connected to Neo4j
   * @returns {boolean}
   */
  checkConnection() {
    return this.isConnected && this.driver !== null;
  }

  // ===========================================================================
  // SCHEMA MANAGEMENT
  // ===========================================================================

  /**
   * Create all necessary indexes and constraints
   */
  async createIndexes() {
    const session = this.getSession();
    try {
      const indexes = [
        // Unique constraints
        'CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
        'CREATE CONSTRAINT book_id_unique IF NOT EXISTS FOR (b:Book) REQUIRE b.id IS UNIQUE',
        'CREATE CONSTRAINT note_id_unique IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE',
        'CREATE CONSTRAINT concept_id_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT vocabulary_id_unique IF NOT EXISTS FOR (v:Vocabulary) REQUIRE v.id IS UNIQUE',
        'CREATE CONSTRAINT url_id_unique IF NOT EXISTS FOR (u:URL) REQUIRE u.id IS UNIQUE',
        'CREATE CONSTRAINT chat_id_unique IF NOT EXISTS FOR (c:Chat) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT bookmark_id_unique IF NOT EXISTS FOR (b:Bookmark) REQUIRE b.id IS UNIQUE',

        // Performance indexes
        'CREATE INDEX note_source IF NOT EXISTS FOR (n:Note) ON (n.sourceType, n.sourceKey)',
        'CREATE INDEX note_user IF NOT EXISTS FOR (n:Note) ON (n.userId)',
        'CREATE INDEX vocabulary_word IF NOT EXISTS FOR (v:Vocabulary) ON (v.word)',
        'CREATE INDEX vocabulary_user IF NOT EXISTS FOR (v:Vocabulary) ON (v.userId)',
        'CREATE INDEX concept_name IF NOT EXISTS FOR (c:Concept) ON (c.name)',
        'CREATE INDEX url_domain IF NOT EXISTS FOR (u:URL) ON (u.domain)',
        'CREATE INDEX book_user IF NOT EXISTS FOR (b:Book) ON (b.userId)',
        'CREATE INDEX bookmark_user IF NOT EXISTS FOR (b:Bookmark) ON (b.userId)',
        'CREATE INDEX bookmark_source IF NOT EXISTS FOR (b:Bookmark) ON (b.sourceKey)',

        // Temporal indexes for bi-temporal queries
        'CREATE INDEX note_event_time IF NOT EXISTS FOR (n:Note) ON (n.eventTime)',
        'CREATE INDEX session_event_time IF NOT EXISTS FOR (s:LearningSession) ON (s.eventTime)',

        // Spaced repetition indexes
        'CREATE INDEX note_leitner IF NOT EXISTS FOR (n:Note) ON (n.leitnerNextReview)',
        'CREATE INDEX vocabulary_leitner IF NOT EXISTS FOR (v:Vocabulary) ON (v.leitnerNextReview)',

        // ConsolidatedMemory indexes (for :SUMMARIZES relationships)
        'CREATE CONSTRAINT memory_id_unique IF NOT EXISTS FOR (m:ConsolidatedMemory) REQUIRE m.id IS UNIQUE',
        'CREATE INDEX memory_user IF NOT EXISTS FOR (m:ConsolidatedMemory) ON (m.userId)',
        'CREATE INDEX memory_type IF NOT EXISTS FOR (m:ConsolidatedMemory) ON (m.memoryType)',
        'CREATE INDEX memory_period IF NOT EXISTS FOR (m:ConsolidatedMemory) ON (m.periodStart, m.periodEnd)',
        'CREATE INDEX memory_concept IF NOT EXISTS FOR (m:ConsolidatedMemory) ON (m.conceptId)',

        // Episode indexes (for :CONSOLIDATED_INTO relationships)
        'CREATE CONSTRAINT episode_id_unique IF NOT EXISTS FOR (e:Episode) REQUIRE e.id IS UNIQUE',
        'CREATE INDEX episode_user IF NOT EXISTS FOR (e:Episode) ON (e.userId)',
        'CREATE INDEX episode_type IF NOT EXISTS FOR (e:Episode) ON (e.eventType)',
        'CREATE INDEX episode_timestamp IF NOT EXISTS FOR (e:Episode) ON (e.timestamp)',
        'CREATE INDEX episode_processed IF NOT EXISTS FOR (e:Episode) ON (e.processed)',

        // LearnerProfile indexes
        'CREATE CONSTRAINT learner_profile_unique IF NOT EXISTS FOR (lp:LearnerProfile) REQUIRE lp.userId IS UNIQUE',
        'CREATE INDEX domain_profile_user IF NOT EXISTS FOR (dp:DomainProfile) ON (dp.userId, dp.domainType)',
      ];

      for (const index of indexes) {
        try {
          await session.run(index);
        } catch (e) {
          // Index might already exist, which is fine
          if (!e.message.includes('already exists')) {
            console.warn(`GraphManager: Index creation warning: ${e.message}`);
          }
        }
      }

      console.log('GraphManager: Indexes created/verified');
    } finally {
      await session.close();
    }
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
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MERGE (u:User {id: $id})
        ON CREATE SET
          u.createdAt = datetime(),
          u.updatedAt = datetime(),
          u.email = $email,
          u.name = $name,
          u.readerLevel = $readerLevel,
          u.studyMode = $studyMode,
          u.preferredProvider = $preferredProvider,
          u.preferredModel = $preferredModel
        ON MATCH SET
          u.updatedAt = datetime(),
          u.email = $email,
          u.name = $name,
          u.readerLevel = $readerLevel,
          u.studyMode = $studyMode,
          u.preferredProvider = $preferredProvider,
          u.preferredModel = $preferredModel
        RETURN u
        `,
        {
          id: String(user.id),
          email: user.email || '',
          name: user.name || '',
          readerLevel: user.readerLevel || 'middle',
          studyMode: user.studyMode || 'general',
          preferredProvider: user.preferredProvider || 'chatGPT',
          preferredModel: user.preferredModel || '',
        },
      );
      return result.records[0]?.get('u')?.properties;
    } finally {
      await session.close();
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

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})
        CREATE (b:Book {
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
          createdAt: datetime(),
          updatedAt: datetime()
        })
        CREATE (u)-[:OWNS {createdAt: datetime(), weight: 1.0}]->(b)
        RETURN b
        `,
        {
          userId: String(userId),
          id: String(book.id || Date.now()),
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
        },
      );
      return result.records[0]?.get('b')?.properties;
    } finally {
      await session.close();
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

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:OWNS]->(b:Book)
        RETURN b
        ORDER BY b.createdAt DESC
        `,
        { userId: String(userId) },
      );
      return result.records.map((r) => r.get('b').properties);
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // NOTE OPERATIONS - THE CENTER OF LEARNING
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

    const session = this.getSession();
    const now = new Date().toISOString();

    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})
        CREATE (n:Note {
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
          createdAt: datetime(),
          updatedAt: datetime(),
          eventTime: datetime($eventTime),
          recordTime: datetime(),
          validFrom: datetime(),
          validTo: null,
          leitnerBox: 1,
          leitnerNextReview: null,
          leitnerFullyLearned: false,
          leitnerSkips: 0,
          leitnerFlips: 0,
          leitnerScore: 0
        })
        CREATE (u)-[:OWNS {createdAt: datetime(), weight: 1.0}]->(n)
        RETURN n
        `,
        {
          userId: String(userId),
          id: String(note.id || Date.now()),
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
          eventTime: now,
        },
      );

      const createdNote = result.records[0]?.get('n')?.properties;

      // Create relationship to source (book or URL)
      if (note.sourceType === 'book' && note.sourceKey) {
        await this.createAnnotatesRelationship(
          createdNote.id,
          note.sourceKey,
          note.cfi,
          note.percentage,
        );
      } else if (note.sourceType === 'url' && note.sourceKey) {
        await this.createAnnotatesRelationship(
          createdNote.id,
          note.sourceKey,
          null,
          null,
        );
      }

      return createdNote;
    } finally {
      await session.close();
    }
  }

  /**
   * Create ANNOTATES relationship between note and source
   */
  async createAnnotatesRelationship(noteId, sourceId, cfi, percentage) {
    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (n:Note {id: $noteId})
        MATCH (source) WHERE source.id = $sourceId AND (source:Book OR source:URL)
        MERGE (n)-[r:ANNOTATES]->(source)
        ON CREATE SET
          r.createdAt = datetime(),
          r.weight = 1.0,
          r.cfi = $cfi,
          r.percentage = $percentage
        `,
        {
          noteId: String(noteId),
          sourceId: String(sourceId),
          cfi: cfi || null,
          percentage: percentage || null,
        },
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Get notes by source
   * @param {string} sourceKey - Source ID (book ID, URL, etc.)
   * @param {string} sourceType - Type of source
   * @param {string} token - User token
   * @returns {Array} Notes for the source
   */
  async getNotesBySource(sourceKey, sourceType, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (n:Note {
          sourceKey: $sourceKey,
          sourceType: $sourceType,
          userId: $userId
        })
        RETURN n
        ORDER BY n.createdAt DESC
        `,
        {
          sourceKey: String(sourceKey),
          sourceType: sourceType,
          userId: String(userId),
        },
      );
      return result.records.map((r) => {
        const props = r.get('n').properties;
        return {
          ...props,
          cards: props.cards ? JSON.parse(props.cards) : [],
          position: props.position ? JSON.parse(props.position) : null,
        };
      });
    } finally {
      await session.close();
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

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (n:Note {id: $id, userId: $userId})
        RETURN n
        `,
        {
          id: String(id),
          userId: String(userId),
        },
      );
      if (result.records.length === 0) return null;

      const props = result.records[0].get('n').properties;
      return {
        ...props,
        cards: props.cards ? JSON.parse(props.cards) : [],
        position: props.position ? JSON.parse(props.position) : null,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Update a note
   * @param {string} noteId - Note ID
   * @param {string} field - Field to update
   * @param {any} value - New value
   * @param {string} token - User token
   * @returns {number} 1 on success, -1 on failure
   */
  async updateNote(noteId, field, value, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return -1;

    const session = this.getSession();
    try {
      // Special handling for complex fields
      let processedValue = value;
      if (field === 'cards' || field === 'position') {
        processedValue =
          typeof value === 'string' ? value : JSON.stringify(value);
      }

      await session.run(
        `
        MATCH (n:Note {id: $noteId, userId: $userId})
        SET n.${field} = $value, n.updatedAt = datetime()
        `,
        {
          noteId: String(noteId),
          userId: String(userId),
          value: processedValue,
        },
      );
      return 1;
    } catch (e) {
      console.error('GraphManager: updateNote error', e);
      return -1;
    } finally {
      await session.close();
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

    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (n:Note {id: $id, userId: $userId})
        DETACH DELETE n
        `,
        {
          id: String(id),
          userId: String(userId),
        },
      );
      return 1;
    } catch (e) {
      console.error('GraphManager: deleteNote error', e);
      return -1;
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // VOCABULARY OPERATIONS
  // ===========================================================================

  /**
   * Create a vocabulary node with Leitner system integration
   * @param {Object} vocab - Vocabulary data
   * @param {string} token - User token
   * @returns {Object} Created vocabulary node
   */
  async createVocabulary(vocab, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    const now = new Date().toISOString();

    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})
        CREATE (v:Vocabulary {
          id: $id,
          word: $word,
          definition: $definition,
          relatedWords: $relatedWords,
          example: $example,
          setId: $setId,
          userId: $userId,
          createdAt: datetime(),
          updatedAt: datetime(),
          eventTime: datetime($eventTime),
          recordTime: datetime(),
          validFrom: datetime(),
          validTo: null,
          leitnerBox: 1,
          leitnerNextReview: null,
          leitnerFullyLearned: false,
          leitnerSkips: 0,
          leitnerFlips: 0,
          leitnerScore: 0
        })
        CREATE (u)-[:OWNS {createdAt: datetime(), weight: 1.0}]->(v)
        RETURN v
        `,
        {
          userId: String(userId),
          id: String(vocab.id || Date.now()),
          word: vocab.word || '',
          definition: vocab.definition || '',
          relatedWords: vocab.relatedWords || null,
          example: vocab.example || null,
          setId: vocab.setId || 0,
          eventTime: now,
        },
      );
      return result.records[0]?.get('v')?.properties;
    } finally {
      await session.close();
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

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (v:Vocabulary {word: $word, userId: $userId})
        RETURN v
        `,
        {
          word: word,
          userId: String(userId),
        },
      );
      if (result.records.length === 0) return null;
      return result.records[0].get('v').properties;
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // SPACED REPETITION (LEITNER SYSTEM)
  // ===========================================================================

  /**
   * Get items due for review (notes and vocabulary)
   * @param {Date} asOfDate - Date to check against
   * @param {Array} itemTypes - Types to include ('note', 'vocabulary')
   * @param {number} limit - Maximum items to return
   * @param {string} token - User token
   * @returns {Array} Items due for review
   */
  async getDueForReview(asOfDate, itemTypes, limit, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const labels = itemTypes
        .map((t) => (t === 'note' ? 'Note' : 'Vocabulary'))
        .join('|');

      const result = await session.run(
        `
        MATCH (item)
        WHERE (item:Note OR item:Vocabulary)
          AND item.userId = $userId
          AND item.leitnerFullyLearned = false
          AND (item.leitnerNextReview IS NULL OR item.leitnerNextReview <= datetime($asOfDate))
        RETURN item, labels(item)[0] AS itemType
        ORDER BY item.leitnerNextReview ASC
        LIMIT $limit
        `,
        {
          userId: String(userId),
          asOfDate: asOfDate.toISOString(),
          limit: neo4j.int(limit),
        },
      );

      return result.records.map((r) => {
        const props = r.get('item').properties;
        const itemType = r.get('itemType').toLowerCase();
        return {
          ...props,
          itemType,
          cards: props.cards ? JSON.parse(props.cards) : undefined,
          position: props.position ? JSON.parse(props.position) : undefined,
        };
      });
    } finally {
      await session.close();
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

    const session = this.getSession();
    const label = itemType === 'note' ? 'Note' : 'Vocabulary';

    try {
      // Calculate new box and next review date based on Leitner system
      const result = await session.run(
        `
        MATCH (item:${label} {id: $itemId, userId: $userId})
        WITH item,
             item.leitnerBox AS oldBox,
             CASE
               WHEN $outcome = 'correct' THEN
                 CASE WHEN item.leitnerBox < 5 THEN item.leitnerBox + 1 ELSE 5 END
               WHEN $outcome = 'incorrect' THEN 1
               ELSE item.leitnerBox
             END AS newBox
        SET item.leitnerBox = newBox,
            item.leitnerFlips = item.leitnerFlips + 1,
            item.leitnerSkips = CASE WHEN $outcome = 'skipped' THEN item.leitnerSkips + 1 ELSE item.leitnerSkips END,
            item.leitnerNextReview = datetime() + duration({days: newBox * $leitnerSpeed}),
            item.leitnerFullyLearned = CASE WHEN newBox = 5 AND $outcome = 'correct' THEN true ELSE item.leitnerFullyLearned END,
            item.updatedAt = datetime()
        RETURN item, oldBox
        `,
        {
          itemId: String(itemId),
          userId: String(userId),
          outcome: outcome,
          leitnerSpeed: leitnerSpeed || 2,
        },
      );

      if (result.records.length === 0) return null;

      const item = result.records[0].get('item').properties;
      const oldBox = result.records[0].get('oldBox');

      // Create REVIEWED relationship to track history
      await session.run(
        `
        MATCH (u:User {id: $userId})
        MATCH (item:${label} {id: $itemId})
        CREATE (u)-[r:REVIEWED {
          createdAt: datetime(),
          eventTime: datetime(),
          recordTime: datetime(),
          validFrom: datetime(),
          validTo: null,
          outcome: $outcome,
          leitnerBoxBefore: $oldBox,
          leitnerBoxAfter: $newBox,
          weight: 1.0
        }]->(item)
        `,
        {
          userId: String(userId),
          itemId: String(itemId),
          outcome: outcome,
          oldBox: oldBox,
          newBox: item.leitnerBox,
        },
      );

      return item;
    } finally {
      await session.close();
    }
  }

  /**
   * Add a note to Leitner study
   * @param {string} noteId - Note ID
   * @param {string} token - User token
   * @returns {Object} Updated note with Leitner info
   */
  async addNoteToLeitnerStudy(noteId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (n:Note {id: $noteId, userId: $userId})
        SET n.leitnerBox = 1,
            n.leitnerNextReview = datetime(),
            n.leitnerFullyLearned = false,
            n.updatedAt = datetime()
        RETURN n
        `,
        {
          noteId: String(noteId),
          userId: String(userId),
        },
      );
      if (result.records.length === 0) return null;
      return result.records[0].get('n').properties;
    } finally {
      await session.close();
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

    const session = this.getSession();
    const now = new Date().toISOString();

    try {
      const result = await session.run(
        `
        MERGE (c:Concept {name: $name, userId: $userId})
        ON CREATE SET
          c.id = $id,
          c.description = $description,
          c.category = $category,
          c.masteryLevel = 0,
          c.exposureCount = 1,
          c.createdAt = datetime(),
          c.updatedAt = datetime(),
          c.eventTime = datetime($eventTime),
          c.recordTime = datetime(),
          c.validFrom = datetime(),
          c.validTo = null
        ON MATCH SET
          c.exposureCount = c.exposureCount + 1,
          c.updatedAt = datetime()
        RETURN c
        `,
        {
          id: String(concept.id || Date.now()),
          name: concept.name,
          description: concept.description || null,
          category: concept.category || null,
          userId: String(userId),
          eventTime: now,
        },
      );
      return result.records[0]?.get('c')?.properties;
    } finally {
      await session.close();
    }
  }

  /**
   * Create MENTIONS_CONCEPT relationship between note and concept
   * @param {string} noteId - Note ID
   * @param {string} conceptId - Concept ID
   * @param {number} frequency - How many times mentioned
   * @param {number} importance - Contextual importance (0-1)
   */
  async createMentionsRelationship(noteId, conceptId, frequency, importance) {
    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (n:Note {id: $noteId})
        MATCH (c:Concept {id: $conceptId})
        MERGE (n)-[r:MENTIONS_CONCEPT]->(c)
        ON CREATE SET
          r.createdAt = datetime(),
          r.weight = $importance,
          r.frequency = $frequency,
          r.importance = $importance
        ON MATCH SET
          r.frequency = r.frequency + $frequency,
          r.weight = (r.weight + $importance) / 2
        `,
        {
          noteId: String(noteId),
          conceptId: String(conceptId),
          frequency: frequency || 1,
          importance: importance || 0.5,
        },
      );
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // LEARNING SESSION OPERATIONS (Graphiti-inspired episodic memory)
  // ===========================================================================

  /**
   * Start a new learning session
   * @param {string} activityType - Type of activity
   * @param {string} primaryResourceType - Type of primary resource
   * @param {string} primaryResourceId - ID of primary resource
   * @param {string} token - User token
   * @returns {Object} Created session
   */
  async startLearningSession(
    activityType,
    primaryResourceType,
    primaryResourceId,
    token,
  ) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    const now = new Date().toISOString();

    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})
        CREATE (s:LearningSession {
          id: $id,
          userId: $userId,
          startTime: datetime(),
          endTime: null,
          duration: 0,
          focusScore: 0,
          notesCreated: 0,
          conceptsReviewed: 0,
          wordsLearned: 0,
          activityType: $activityType,
          primaryResourceType: $primaryResourceType,
          primaryResourceId: $primaryResourceId,
          createdAt: datetime(),
          updatedAt: datetime(),
          eventTime: datetime($eventTime),
          recordTime: datetime(),
          validFrom: datetime(),
          validTo: null
        })
        CREATE (u)-[:HAD_SESSION {createdAt: datetime(), weight: 1.0}]->(s)
        RETURN s
        `,
        {
          id: String(Date.now()),
          userId: String(userId),
          activityType: activityType || 'reading',
          primaryResourceType: primaryResourceType || null,
          primaryResourceId: primaryResourceId
            ? String(primaryResourceId)
            : null,
          eventTime: now,
        },
      );
      return result.records[0]?.get('s')?.properties;
    } finally {
      await session.close();
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

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (s:LearningSession {id: $sessionId, userId: $userId})
        SET s.endTime = datetime(),
            s.duration = duration.inSeconds(s.startTime, datetime()).seconds,
            s.focusScore = $focusScore,
            s.notesCreated = $notesCreated,
            s.conceptsReviewed = $conceptsReviewed,
            s.wordsLearned = $wordsLearned,
            s.updatedAt = datetime()
        RETURN s
        `,
        {
          sessionId: String(sessionId),
          userId: String(userId),
          focusScore: stats.focusScore || 0,
          notesCreated: stats.notesCreated || 0,
          conceptsReviewed: stats.conceptsReviewed || 0,
          wordsLearned: stats.wordsLearned || 0,
        },
      );
      return result.records[0]?.get('s')?.properties;
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // SEMANTIC SEARCH (Replacing ChromaDB)
  // ===========================================================================

  /**
   * Store embedding for a node
   * @param {string} nodeId - Node ID
   * @param {string} nodeType - Node type (Note, Book, etc.)
   * @param {Array<number>} embedding - Embedding vector
   * @param {string} model - Embedding model used
   */
  async storeEmbedding(nodeId, nodeType, embedding, model) {
    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (n:${nodeType} {id: $nodeId})
        SET n.embedding = $embedding,
            n.embeddingModel = $model,
            n.updatedAt = datetime()
        `,
        {
          nodeId: String(nodeId),
          embedding: embedding,
          model: model,
        },
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Find similar nodes using cosine similarity
   * Note: For production, consider using Neo4j GDS library or vector index
   * @param {Array<number>} queryEmbedding - Query embedding
   * @param {Array<string>} nodeTypes - Node types to search
   * @param {number} limit - Maximum results
   * @param {number} minSimilarity - Minimum similarity threshold
   * @param {string} token - User token
   * @returns {Array} Similar nodes with similarity scores
   */
  async findSimilar(queryEmbedding, nodeTypes, limit, minSimilarity, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    const labels = nodeTypes.join('|');

    try {
      // Note: This is a simplified similarity calculation
      // For better performance, use Neo4j's vector index (available in 5.11+)
      // or the GDS library's cosine similarity
      const result = await session.run(
        `
        MATCH (n)
        WHERE (${nodeTypes.map((t) => `n:${t}`).join(' OR ')})
          AND n.userId = $userId
          AND n.embedding IS NOT NULL
        WITH n,
             reduce(dot = 0.0, i IN range(0, size(n.embedding)-1) |
               dot + n.embedding[i] * $queryEmbedding[i]) /
             (sqrt(reduce(a = 0.0, i IN range(0, size(n.embedding)-1) |
               a + n.embedding[i] * n.embedding[i])) *
              sqrt(reduce(b = 0.0, i IN range(0, size($queryEmbedding)-1) |
               b + $queryEmbedding[i] * $queryEmbedding[i]))) AS similarity
        WHERE similarity >= $minSimilarity
        RETURN n, similarity, labels(n)[0] AS nodeType
        ORDER BY similarity DESC
        LIMIT $limit
        `,
        {
          userId: String(userId),
          queryEmbedding: queryEmbedding,
          minSimilarity: minSimilarity || 0.7,
          limit: neo4j.int(limit || 10),
        },
      );

      return result.records.map((r) => ({
        node: r.get('n').properties,
        similarity: r.get('similarity'),
        nodeType: r.get('nodeType'),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Search notes by query text (for migration from ChromaDB)
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Array} Matching notes
   */
  async searchNotes(query, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      // Full-text search using CONTAINS (for simple queries)
      // For production, create a full-text index
      const result = await session.run(
        `
        MATCH (n:Note {userId: $userId})
        WHERE n.title CONTAINS $query OR n.cards CONTAINS $query
        RETURN n
        ORDER BY n.createdAt DESC
        LIMIT 20
        `,
        {
          userId: String(userId),
          query: query,
        },
      );

      return result.records.map((r) => {
        const props = r.get('n').properties;
        return {
          ...props,
          cards: props.cards ? JSON.parse(props.cards) : [],
          position: props.position ? JSON.parse(props.position) : null,
        };
      });
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // LEARNING PATH RECOMMENDATIONS
  // ===========================================================================

  /**
   * Get learning path to a target concept
   * @param {string} targetConceptId - Target concept ID
   * @param {number} maxDepth - Maximum path depth
   * @param {string} token - User token
   * @returns {Object} Learning path with prerequisites
   */
  async getLearningPath(targetConceptId, maxDepth, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH path = (target:Concept {id: $targetId})<-[:REQUIRES*1..${maxDepth || 5}]-(prereq:Concept)
        WHERE prereq.userId = $userId
        WITH prereq, target,
             CASE WHEN prereq.masteryLevel >= 70 THEN true ELSE false END AS mastered
        RETURN prereq, mastered
        ORDER BY length(path) ASC
        `,
        {
          targetId: String(targetConceptId),
          userId: String(userId),
        },
      );

      const prerequisites = result.records.map((r) => ({
        concept: r.get('prereq').properties,
        mastered: r.get('mastered'),
      }));

      const masteredCount = prerequisites.filter((p) => p.mastered).length;

      return {
        targetConceptId,
        prerequisites,
        masteredCount,
        totalCount: prerequisites.length,
        readyToLearn: masteredCount === prerequisites.length,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get knowledge state at a specific point in time (temporal query)
   * @param {Date} asOfDate - Point in time to query
   * @param {string} token - User token
   * @returns {Array} Concepts with mastery levels at that time
   */
  async getKnowledgeAtTime(asOfDate, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[r:REVIEWED]->(item)
        WHERE (item:Note OR item:Vocabulary OR item:Concept)
          AND r.eventTime <= datetime($asOfDate)
        WITH item, MAX(r.eventTime) AS lastReview, COUNT(r) AS reviewCount
        RETURN item, lastReview, reviewCount,
               labels(item)[0] AS itemType
        ORDER BY lastReview DESC
        `,
        {
          userId: String(userId),
          asOfDate: asOfDate.toISOString(),
        },
      );

      return result.records.map((r) => ({
        item: r.get('item').properties,
        lastReview: r.get('lastReview'),
        reviewCount: r.get('reviewCount'),
        itemType: r.get('itemType'),
      }));
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // CHAT OPERATIONS
  // ===========================================================================

  /**
   * Create a chat node
   * @param {Object} chat - Chat data
   * @param {string} token - User token
   * @returns {Object} Created chat
   */
  async createChat(chat, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})
        CREATE (c:Chat {
          id: $id,
          description: $description,
          totalTokens: $totalTokens,
          pinned: $pinned,
          autoDelete: $autoDelete,
          sessionType: $sessionType,
          contextType: $contextType,
          contextKey: $contextKey,
          userId: $userId,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        CREATE (u)-[:OWNS {createdAt: datetime(), weight: 1.0}]->(c)
        RETURN c
        `,
        {
          userId: String(userId),
          id: String(chat.id || Date.now()),
          description: chat.description || '',
          totalTokens: chat.totalTokens || 0,
          pinned: chat.pinned || false,
          autoDelete: chat.autoDelete || false,
          sessionType: chat.sessionType || 'general',
          contextType: chat.contextType || null,
          contextKey: chat.contextKey ? String(chat.contextKey) : null,
        },
      );
      return result.records[0]?.get('c')?.properties;
    } finally {
      await session.close();
    }
  }

  /**
   * Add a message to a chat
   * @param {Object} message - Message data
   * @param {string} chatId - Chat ID
   * @param {string} token - User token
   * @returns {Object} Created message
   */
  async addMessage(message, chatId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    const now = new Date().toISOString();

    try {
      const result = await session.run(
        `
        MATCH (c:Chat {id: $chatId, userId: $userId})
        CREATE (m:Message {
          id: $id,
          role: $role,
          content: $content,
          tokenCount: $tokenCount,
          toolCalls: $toolCalls,
          toolResults: $toolResults,
          userId: $userId,
          createdAt: datetime(),
          updatedAt: datetime(),
          eventTime: datetime($eventTime),
          recordTime: datetime(),
          validFrom: datetime(),
          validTo: null
        })
        CREATE (c)-[r:HAS_MESSAGE {
          createdAt: datetime(),
          weight: 1.0,
          orderIndex: size((c)-[:HAS_MESSAGE]->())
        }]->(m)
        WITH c, m
        SET c.totalTokens = c.totalTokens + $tokenCount,
            c.updatedAt = datetime()
        RETURN m
        `,
        {
          chatId: String(chatId),
          userId: String(userId),
          id: String(message.id || Date.now()),
          role: message.role,
          content: message.content,
          tokenCount: message.tokenCount || 0,
          toolCalls: message.toolCalls
            ? JSON.stringify(message.toolCalls)
            : null,
          toolResults: message.toolResults
            ? JSON.stringify(message.toolResults)
            : null,
          eventTime: now,
        },
      );
      return result.records[0]?.get('m')?.properties;
    } finally {
      await session.close();
    }
  }

  /**
   * Search messages by query text
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Array} Matching messages
   */
  async searchMessages(query, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (c:Chat {userId: $userId})-[:HAS_MESSAGE]->(m:Message)
        WHERE m.content CONTAINS $query
        RETURN m, c.id AS chatId
        ORDER BY m.createdAt DESC
        LIMIT 20
        `,
        {
          userId: String(userId),
          query: query,
        },
      );

      return result.records.map((r) => ({
        ...r.get('m').properties,
        chatId: r.get('chatId'),
      }));
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // BOOKMARK OPERATIONS
  // ===========================================================================

  /**
   * Create a bookmark node with OWNS relationship to user
   * @param {Object} bookmark - Bookmark data
   * @param {string} token - User token
   * @returns {Object} Created bookmark node
   */
  async createBookmark(bookmark, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})
        CREATE (b:Bookmark {
          id: $id,
          title: $title,
          url: $url,
          description: $description,
          sourceKey: $sourceKey,
          sourceType: $sourceType,
          groupId: $groupId,
          favicon: $favicon,
          userId: $userId,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        CREATE (u)-[:OWNS {createdAt: datetime(), weight: 1.0}]->(b)
        RETURN b
        `,
        {
          userId: String(userId),
          id: String(bookmark.id || Date.now()),
          title: bookmark.title || '',
          url: bookmark.url || bookmark.sourceKey || '',
          description: bookmark.description || '',
          sourceKey: String(bookmark.sourceKey || ''),
          sourceType: bookmark.sourceType || 'url',
          groupId: bookmark.groupId || -1,
          favicon: bookmark.favicon || null,
        },
      );
      return result.records[0]?.get('b')?.properties;
    } finally {
      await session.close();
    }
  }

  /**
   * Get bookmarks by source URL
   * @param {string} sourceKey - Source URL
   * @param {string} token - User token
   * @returns {Array} Bookmarks for the source
   */
  async getBookmarksBySource(sourceKey, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (b:Bookmark {sourceKey: $sourceKey, userId: $userId})
        RETURN b
        ORDER BY b.createdAt DESC
        `,
        {
          sourceKey: String(sourceKey),
          userId: String(userId),
        },
      );
      return result.records.map((r) => r.get('b').properties);
    } finally {
      await session.close();
    }
  }

  /**
   * Search bookmarks by query text
   * @param {string} query - Search query
   * @param {string} token - User token
   * @returns {Array} Matching bookmarks
   */
  async searchBookmarks(query, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (b:Bookmark {userId: $userId})
        WHERE b.title CONTAINS $query OR b.description CONTAINS $query OR b.url CONTAINS $query
        RETURN b
        ORDER BY b.createdAt DESC
        LIMIT 20
        `,
        {
          userId: String(userId),
          query: query,
        },
      );
      return result.records.map((r) => r.get('b').properties);
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // MIGRATION HELPERS
  // ===========================================================================

  /**
   * Migrate a note from SQLite to Neo4j
   * @param {Object} sqliteNote - Note from SQLite
   * @param {string} token - User token
   * @returns {Object} Created note in Neo4j
   */
  async migrateNote(sqliteNote, token) {
    // Convert SQLite note format to Neo4j format
    const graphNote = {
      id: String(sqliteNote.id),
      sourceType: sqliteNote.sourceType,
      sourceKey: sqliteNote.sourceKey,
      title: sqliteNote.title,
      chapter: sqliteNote.chapter,
      chapterIndex: sqliteNote.chapterIndex,
      cards: sqliteNote.cards,
      cfi: sqliteNote.cfi,
      range: sqliteNote.range,
      percentage: sqliteNote.percentage,
      position: sqliteNote.position,
      emoji: sqliteNote.emoji,
      color: sqliteNote.color,
      tags: sqliteNote.tags,
      rate: sqliteNote.rate,
      hasQuiz: sqliteNote.hasQuiz,
      highlightOnly: sqliteNote.highlightOnly,
      highlightType: sqliteNote.highlightType,
    };

    const createdNote = await this.createNote(graphNote, token);

    // If the note was in Leitner study, set those properties
    if (sqliteNote.leitnerItemId && sqliteNote.leitnerItem) {
      const session = this.getSession();
      try {
        await session.run(
          `
          MATCH (n:Note {id: $noteId})
          SET n.leitnerBox = $box,
              n.leitnerNextReview = datetime($nextReview),
              n.leitnerFullyLearned = $fullyLearned,
              n.leitnerSkips = $skips,
              n.leitnerFlips = $flips,
              n.leitnerScore = $score
          `,
          {
            noteId: String(sqliteNote.id),
            box: sqliteNote.leitnerItem.box || 1,
            nextReview: sqliteNote.leitnerItem.nextReview || null,
            fullyLearned: sqliteNote.leitnerItem.fullyLearned || false,
            skips: sqliteNote.leitnerItem.skips || 0,
            flips: sqliteNote.leitnerItem.flips || 0,
            score: sqliteNote.leitnerItem.score || 0,
          },
        );
      } finally {
        await session.close();
      }
    }

    return createdNote;
  }

  /**
   * Get migration statistics
   * @returns {Object} Counts of migrated entities
   */
  async getMigrationStats() {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (n)
        WITH labels(n)[0] AS nodeType, count(n) AS count
        RETURN nodeType, count
        ORDER BY count DESC
      `);

      const stats = {};
      result.records.forEach((r) => {
        stats[r.get('nodeType')] = r.get('count');
      });

      return stats;
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // BOOK CHUNK OPERATIONS (for Vector Storage Migration)
  // ===========================================================================

  /**
   * Create indexes for chunk and concept nodes
   * Called during initial connection
   */
  async createChunkIndexes() {
    const session = this.getSession();
    try {
      const indexes = [
        // Unique constraints for chunks and concepts
        'CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT key_concept_id_unique IF NOT EXISTS FOR (k:KeyConcept) REQUIRE k.id IS UNIQUE',
        'CREATE CONSTRAINT learning_point_id_unique IF NOT EXISTS FOR (l:LearningPoint) REQUIRE l.id IS UNIQUE',

        // Performance indexes
        'CREATE INDEX chunk_book IF NOT EXISTS FOR (c:Chunk) ON (c.bookId)',
        'CREATE INDEX chunk_user IF NOT EXISTS FOR (c:Chunk) ON (c.userId)',
        'CREATE INDEX chunk_index IF NOT EXISTS FOR (c:Chunk) ON (c.chunkIndex)',
        'CREATE INDEX key_concept_book IF NOT EXISTS FOR (k:KeyConcept) ON (k.bookId)',
        'CREATE INDEX key_concept_name IF NOT EXISTS FOR (k:KeyConcept) ON (k.name)',
        'CREATE INDEX learning_point_topic IF NOT EXISTS FOR (l:LearningPoint) ON (l.topicId)',
        'CREATE INDEX learning_point_user IF NOT EXISTS FOR (l:LearningPoint) ON (l.userId)',
        'CREATE INDEX learning_point_status IF NOT EXISTS FOR (l:LearningPoint) ON (l.status)',
      ];

      for (const index of indexes) {
        try {
          await session.run(index);
        } catch (e) {
          if (!e.message.includes('already exists')) {
            console.warn(`GraphManager: Chunk index creation warning: ${e.message}`);
          }
        }
      }

      console.log('GraphManager: Chunk indexes created/verified');
    } finally {
      await session.close();
    }
  }

  /**
   * Create a single book chunk node
   * @param {string} bookId - Book ID from SQLite
   * @param {Object} chunk - Chunk data
   * @param {number[]} embedding - Optional embedding vector
   * @param {string} token - User token
   * @returns {Object} Created chunk node
   */
  async createChunk(bookId, chunk, embedding, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MERGE (b:Book {id: $bookId})
        CREATE (c:Chunk {
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
          createdAt: datetime()
        })
        CREATE (b)-[:HAS_CHUNK]->(c)
        WITH c
        OPTIONAL MATCH (prev:Chunk {bookId: $bookId, chunkIndex: $prevIndex, userId: $userId})
        FOREACH (_ IN CASE WHEN prev IS NOT NULL THEN [1] ELSE [] END |
          CREATE (prev)-[:NEXT]->(c)
        )
        RETURN c
        `,
        {
          bookId: String(bookId),
          chunkId: chunk.id || `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          userId,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          pageNum: chunk.pageNum || null,
          cfi: chunk.cfi || null,
          sectionTitle: chunk.sectionTitle || null,
          embedding: embedding || null,
          embeddingModel: embedding ? (chunk.embeddingModel || 'text-embedding-3-small') : null,
          prevIndex: chunk.chunkIndex - 1,
        },
      );

      if (result.records.length > 0) {
        return result.records[0].get('c').properties;
      }
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * Batch create chunks for a book (more efficient)
   * @param {string} bookId - Book ID
   * @param {Array} chunks - Array of {text, chunkIndex, pageNum?, cfi?, sectionTitle?}
   * @param {Array} embeddings - Array of embedding vectors (parallel to chunks)
   * @param {string} token - User token
   * @returns {number} Number of chunks created
   */
  async batchCreateChunks(bookId, chunks, embeddings, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return 0;

    const session = this.getSession();
    try {
      // Prepare data for batch insert
      const chunkData = chunks.map((chunk, idx) => ({
        id: chunk.id || `chunk_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
        bookId: String(bookId),
        userId,
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        pageNum: chunk.pageNum || null,
        cfi: chunk.cfi || null,
        sectionTitle: chunk.sectionTitle || null,
        embedding: embeddings?.[idx] || null,
        embeddingModel: embeddings?.[idx] ? 'text-embedding-3-small' : null,
      }));

      // First, ensure book node exists
      await session.run(
        `MERGE (b:Book {id: $bookId}) ON CREATE SET b.createdAt = datetime()`,
        { bookId: String(bookId) },
      );

      // Batch create chunks
      const result = await session.run(
        `
        UNWIND $chunks AS chunk
        CREATE (c:Chunk {
          id: chunk.id,
          bookId: chunk.bookId,
          userId: chunk.userId,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          pageNum: chunk.pageNum,
          cfi: chunk.cfi,
          sectionTitle: chunk.sectionTitle,
          embedding: chunk.embedding,
          embeddingModel: chunk.embeddingModel,
          createdAt: datetime()
        })
        WITH c
        MATCH (b:Book {id: c.bookId})
        CREATE (b)-[:HAS_CHUNK]->(c)
        RETURN count(c) AS created
        `,
        { chunks: chunkData },
      );

      // Create NEXT relationships sequentially
      await session.run(
        `
        MATCH (c:Chunk {bookId: $bookId, userId: $userId})
        WITH c ORDER BY c.chunkIndex
        WITH collect(c) AS chunks
        UNWIND range(0, size(chunks)-2) AS idx
        WITH chunks[idx] AS curr, chunks[idx+1] AS next
        CREATE (curr)-[:NEXT]->(next)
        `,
        { bookId: String(bookId), userId },
      );

      const created = result.records[0]?.get('created') || 0;
      console.log(`GraphManager: Created ${created} chunks for book ${bookId}`);
      return created;
    } finally {
      await session.close();
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

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (c:Chunk {bookId: $bookId, userId: $userId})
        RETURN c
        ORDER BY c.chunkIndex
        `,
        { bookId: String(bookId), userId },
      );

      return result.records.map((r) => r.get('c').properties);
    } finally {
      await session.close();
    }
  }

  /**
   * Get chunks without embeddings (for lazy embedding generation)
   * @param {string} bookId - Book ID
   * @param {string} token - User token
   * @returns {Array} Chunks without embeddings
   */
  async getChunksWithoutEmbeddings(bookId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (c:Chunk {bookId: $bookId, userId: $userId})
        WHERE c.embedding IS NULL
        RETURN c
        ORDER BY c.chunkIndex
        `,
        { bookId: String(bookId), userId },
      );

      return result.records.map((r) => r.get('c').properties);
    } finally {
      await session.close();
    }
  }

  /**
   * Update chunk embedding
   * @param {string} chunkId - Chunk ID
   * @param {number[]} embedding - Embedding vector
   * @param {string} model - Embedding model name
   */
  async updateChunkEmbedding(chunkId, embedding, model = 'text-embedding-3-small') {
    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (c:Chunk {id: $chunkId})
        SET c.embedding = $embedding,
            c.embeddingModel = $model,
            c.embeddingUpdatedAt = datetime()
        `,
        { chunkId, embedding, model },
      );
    } finally {
      await session.close();
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

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (c:Chunk {bookId: $bookId, userId: $userId})
        DETACH DELETE c
        RETURN count(c) AS deleted
        `,
        { bookId: String(bookId), userId },
      );

      return result.records[0]?.get('deleted') || 0;
    } finally {
      await session.close();
    }
  }

  /**
   * Vector search for similar chunks using cosine similarity
   * @param {number[]} queryEmbedding - Query embedding vector
   * @param {Object} filters - Optional filters {bookId, userId}
   * @param {number} limit - Max results
   * @param {number} minSimilarity - Minimum similarity threshold
   * @returns {Array} Similar chunks with similarity scores
   */
  async searchSimilarChunks(queryEmbedding, filters = {}, limit = 10, minSimilarity = 0.7) {
    const session = this.getSession();
    try {
      let whereClause = 'WHERE c.embedding IS NOT NULL';
      const params = { queryEmbedding, limit, minSimilarity };

      if (filters.bookId) {
        whereClause += ' AND c.bookId = $bookId';
        params.bookId = String(filters.bookId);
      }
      if (filters.userId) {
        whereClause += ' AND c.userId = $userId';
        params.userId = filters.userId;
      }

      const result = await session.run(
        `
        MATCH (c:Chunk)
        ${whereClause}
        WITH c,
          reduce(dot = 0.0, i IN range(0, size(c.embedding)-1) |
            dot + c.embedding[i] * $queryEmbedding[i]) /
          (sqrt(reduce(a = 0.0, i IN range(0, size(c.embedding)-1) |
            a + c.embedding[i] * c.embedding[i])) *
           sqrt(reduce(b = 0.0, i IN range(0, size($queryEmbedding)-1) |
            b + $queryEmbedding[i] * $queryEmbedding[i]))) AS similarity
        WHERE similarity >= $minSimilarity
        RETURN c, similarity
        ORDER BY similarity DESC
        LIMIT $limit
        `,
        params,
      );

      return result.records.map((r) => ({
        chunk: r.get('c').properties,
        similarity: r.get('similarity'),
      }));
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // KEY CONCEPT OPERATIONS
  // ===========================================================================

  /**
   * Create key concepts for a book (extracted from metadata)
   * @param {string} bookId - Book ID
   * @param {Array} concepts - Array of {name, description, category, importance}
   * @param {string} token - User token
   * @returns {number} Number of concepts created
   */
  async createKeyConcepts(bookId, concepts, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return 0;

    const session = this.getSession();
    try {
      const conceptData = concepts.map((concept, idx) => ({
        id: concept.id || `concept_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
        bookId: String(bookId),
        userId,
        name: concept.name,
        description: concept.description || null,
        category: concept.category || null,
        importance: concept.importance || 0.5,
        primarySection: concept.primarySection || null,
      }));

      const result = await session.run(
        `
        MATCH (b:Book {id: $bookId})
        UNWIND $concepts AS concept
        CREATE (k:KeyConcept {
          id: concept.id,
          bookId: concept.bookId,
          userId: concept.userId,
          name: concept.name,
          description: concept.description,
          category: concept.category,
          importance: concept.importance,
          primarySection: concept.primarySection,
          createdAt: datetime()
        })
        CREATE (b)-[:HAS_KEY_CONCEPT]->(k)
        RETURN count(k) AS created
        `,
        { bookId: String(bookId), concepts: conceptData },
      );

      return result.records[0]?.get('created') || 0;
    } finally {
      await session.close();
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

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (k:KeyConcept {bookId: $bookId, userId: $userId})
        RETURN k
        ORDER BY k.importance DESC, k.name
        `,
        { bookId: String(bookId), userId },
      );

      return result.records.map((r) => r.get('k').properties);
    } finally {
      await session.close();
    }
  }

  /**
   * Store embeddings for key concepts
   * @param {string} bookId - Book ID
   * @param {Array} conceptEmbeddings - Array of {conceptId, embedding}
   */
  async storeConceptEmbeddings(bookId, conceptEmbeddings) {
    const session = this.getSession();
    try {
      await session.run(
        `
        UNWIND $data AS item
        MATCH (k:KeyConcept {id: item.conceptId})
        SET k.embedding = item.embedding,
            k.embeddingModel = 'text-embedding-3-small'
        `,
        { data: conceptEmbeddings },
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Tag chunks with matching concepts using embedding similarity
   * @param {string} bookId - Book ID
   * @param {number} similarityThreshold - Minimum similarity to create MENTIONS relationship
   * @param {string} token - User token
   */
  async tagChunksWithConcepts(bookId, similarityThreshold = 0.75, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return;

    const session = this.getSession();
    try {
      // This query finds chunks and concepts with similar embeddings
      // and creates MENTIONS relationships
      await session.run(
        `
        MATCH (c:Chunk {bookId: $bookId, userId: $userId})
        WHERE c.embedding IS NOT NULL
        MATCH (k:KeyConcept {bookId: $bookId, userId: $userId})
        WHERE k.embedding IS NOT NULL
        WITH c, k,
          reduce(dot = 0.0, i IN range(0, size(c.embedding)-1) |
            dot + c.embedding[i] * k.embedding[i]) /
          (sqrt(reduce(a = 0.0, i IN range(0, size(c.embedding)-1) |
            a + c.embedding[i] * c.embedding[i])) *
           sqrt(reduce(b = 0.0, i IN range(0, size(k.embedding)-1) |
            b + k.embedding[i] * k.embedding[i]))) AS similarity
        WHERE similarity >= $threshold
        MERGE (c)-[r:MENTIONS]->(k)
        SET r.similarity = similarity
        `,
        { bookId: String(bookId), userId, threshold: similarityThreshold },
      );

      console.log(`GraphManager: Tagged chunks with concepts for book ${bookId}`);
    } finally {
      await session.close();
    }
  }

  /**
   * Derive concept relationships from co-occurrence in chunks
   * @param {string} bookId - Book ID
   * @param {number} minCooccurrence - Minimum co-occurrence count
   * @param {string} token - User token
   */
  async deriveConceptRelationships(bookId, minCooccurrence = 2, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return;

    const session = this.getSession();
    try {
      // Create RELATED_TO relationships based on co-occurrence
      await session.run(
        `
        MATCH (k1:KeyConcept {bookId: $bookId, userId: $userId})<-[:MENTIONS]-(c:Chunk)-[:MENTIONS]->(k2:KeyConcept {bookId: $bookId, userId: $userId})
        WHERE id(k1) < id(k2)
        WITH k1, k2, count(c) AS cooccurrence
        WHERE cooccurrence >= $minCooccurrence
        MERGE (k1)-[r:RELATED_TO]->(k2)
        SET r.cooccurrence = cooccurrence,
            r.derivedAt = datetime()
        `,
        { bookId: String(bookId), userId, minCooccurrence },
      );

      // Create PRECEDES relationships based on sequential proximity
      await session.run(
        `
        MATCH (k1:KeyConcept {bookId: $bookId, userId: $userId})<-[:MENTIONS]-(c1:Chunk)-[:NEXT]->(c2:Chunk)-[:MENTIONS]->(k2:KeyConcept {bookId: $bookId, userId: $userId})
        WHERE k1 <> k2
        WITH k1, k2, count(*) AS sequenceCount
        WHERE sequenceCount >= $minCooccurrence
        MERGE (k1)-[r:PRECEDES]->(k2)
        SET r.sequenceCount = sequenceCount,
            r.derivedAt = datetime()
        `,
        { bookId: String(bookId), userId, minCooccurrence },
      );

      console.log(`GraphManager: Derived concept relationships for book ${bookId}`);
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // LEARNING POINT OPERATIONS
  // ===========================================================================

  /**
   * Create learning points (cards) for a learning plan
   * @param {string} topicId - Learning topic ID
   * @param {Array} learningPoints - Array of learning point data
   * @param {string} token - User token
   * @returns {number} Number created
   */
  async createLearningPoints(topicId, learningPoints, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return 0;

    const session = this.getSession();
    try {
      const pointData = learningPoints.map((lp, idx) => ({
        id: lp.id || `lp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
        topicId,
        userId,
        itemType: lp.itemType,
        domainType: lp.domainType,
        title: lp.title,
        frontText: lp.front?.text || '',
        frontHtml: lp.front?.html || null,
        frontImage: lp.front?.image || null,
        frontLatex: lp.front?.latex || null,
        backText: lp.back?.text || '',
        backHtml: lp.back?.html || null,
        backImage: lp.back?.image || null,
        backLatex: lp.back?.latex || null,
        extras: lp.extras ? JSON.stringify(lp.extras) : null,
        difficulty: lp.difficulty || 'intermediate',
        estimatedTimeMinutes: lp.estimatedTimeMinutes || 2,
        tags: lp.tags || [],
        status: lp.status || 'pending',
        masteryLevel: lp.masteryLevel || 0,
        scheduledDay: lp.scheduledDay || null,
        phase: lp.phase || null,
        sourceType: lp.sourceType || null,
        sourceId: lp.sourceId || null,
        chunkId: lp.chunkId || null,
        reviewCount: 0,
        correctStreak: 0,
      }));

      const result = await session.run(
        `
        UNWIND $points AS point
        CREATE (l:LearningPoint {
          id: point.id,
          topicId: point.topicId,
          userId: point.userId,
          itemType: point.itemType,
          domainType: point.domainType,
          title: point.title,
          frontText: point.frontText,
          frontHtml: point.frontHtml,
          frontImage: point.frontImage,
          frontLatex: point.frontLatex,
          backText: point.backText,
          backHtml: point.backHtml,
          backImage: point.backImage,
          backLatex: point.backLatex,
          extras: point.extras,
          difficulty: point.difficulty,
          estimatedTimeMinutes: point.estimatedTimeMinutes,
          tags: point.tags,
          status: point.status,
          masteryLevel: point.masteryLevel,
          scheduledDay: point.scheduledDay,
          phase: point.phase,
          sourceType: point.sourceType,
          sourceId: point.sourceId,
          chunkId: point.chunkId,
          reviewCount: point.reviewCount,
          correctStreak: point.correctStreak,
          createdAt: datetime()
        })
        RETURN count(l) AS created
        `,
        { points: pointData },
      );

      // Link to source chunks if provided
      await session.run(
        `
        MATCH (l:LearningPoint)
        WHERE l.chunkId IS NOT NULL
        MATCH (c:Chunk {id: l.chunkId})
        MERGE (l)-[:FROM_CHUNK]->(c)
        `,
      );

      return result.records[0]?.get('created') || 0;
    } finally {
      await session.close();
    }
  }

  /**
   * Get learning points for a topic
   * @param {string} topicId - Topic ID
   * @param {Object} filters - Optional {status, phase, scheduledDay}
   * @param {string} token - User token
   * @returns {Array} Learning points
   */
  async getLearningPointsByTopic(topicId, filters = {}, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      let whereClause = 'WHERE l.topicId = $topicId AND l.userId = $userId';
      const params = { topicId, userId };

      if (filters.status) {
        whereClause += ' AND l.status = $status';
        params.status = filters.status;
      }
      if (filters.phase !== undefined) {
        whereClause += ' AND l.phase = $phase';
        params.phase = filters.phase;
      }
      if (filters.scheduledDay !== undefined) {
        whereClause += ' AND l.scheduledDay = $scheduledDay';
        params.scheduledDay = filters.scheduledDay;
      }

      const result = await session.run(
        `
        MATCH (l:LearningPoint)
        ${whereClause}
        RETURN l
        ORDER BY l.scheduledDay, l.title
        `,
        params,
      );

      return result.records.map((r) => {
        const props = r.get('l').properties;
        // Parse extras back to object
        if (props.extras) {
          try {
            props.extras = JSON.parse(props.extras);
          } catch (e) {
            props.extras = null;
          }
        }
        return props;
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Update learning point after review
   * @param {string} learningPointId - Learning point ID
   * @param {Object} reviewResult - {wasCorrect, responseTimeMs, confidenceLevel}
   * @returns {Object} Updated learning point
   */
  async updateLearningPointAfterReview(learningPointId, reviewResult) {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (l:LearningPoint {id: $id})
        SET l.reviewCount = l.reviewCount + 1,
            l.correctStreak = CASE WHEN $wasCorrect THEN l.correctStreak + 1 ELSE 0 END,
            l.masteryLevel = CASE
              WHEN $wasCorrect THEN
                CASE WHEN l.masteryLevel + 10 + l.correctStreak * 2 > 100 THEN 100
                     ELSE l.masteryLevel + 10 + l.correctStreak * 2 END
              ELSE
                CASE WHEN l.masteryLevel - 15 < 0 THEN 0
                     ELSE l.masteryLevel - 15 END
            END,
            l.lastReviewedAt = datetime(),
            l.nextReviewAt = datetime() + duration({days:
              CASE l.correctStreak
                WHEN 0 THEN 1
                WHEN 1 THEN 1
                WHEN 2 THEN 3
                WHEN 3 THEN 7
                WHEN 4 THEN 14
                WHEN 5 THEN 30
                ELSE 60
              END
            }),
            l.status = CASE
              WHEN l.masteryLevel >= 90 AND l.reviewCount >= 5 THEN 'mastered'
              WHEN l.reviewCount > 0 THEN 'reviewing'
              ELSE 'learning'
            END,
            l.updatedAt = datetime()
        RETURN l
        `,
        {
          id: learningPointId,
          wasCorrect: reviewResult.wasCorrect,
        },
      );

      if (result.records.length > 0) {
        return result.records[0].get('l').properties;
      }
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * Get learning points due for review
   * @param {string} topicId - Topic ID (optional, null for all topics)
   * @param {number} limit - Max items
   * @param {string} token - User token
   * @returns {Array} Learning points due for review
   */
  async getLearningPointsDueForReview(topicId, limit = 20, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      let whereClause = 'WHERE l.userId = $userId AND (l.nextReviewAt IS NULL OR l.nextReviewAt <= datetime())';
      const params = { userId, limit };

      if (topicId) {
        whereClause += ' AND l.topicId = $topicId';
        params.topicId = topicId;
      }

      const result = await session.run(
        `
        MATCH (l:LearningPoint)
        ${whereClause}
        RETURN l
        ORDER BY l.nextReviewAt ASC, l.masteryLevel ASC
        LIMIT $limit
        `,
        params,
      );

      return result.records.map((r) => r.get('l').properties);
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // KNOWLEDGE WEB - LINK RELATIONSHIP METHODS
  // ===========================================================================

  /**
   * Get all notes/items linking TO a given target (backlinks)
   * @param {string} targetId - Target node ID
   * @param {string} targetType - Target node type: 'note', 'vocabulary', 'concept'
   * @param {string} token - User token
   * @returns {Array} Array of backlink objects
   */
  async getBacklinks(targetId, targetType, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const targetLabel = this._getLabelForType(targetType);

      const result = await session.run(
        `
        MATCH (source:Note)-[r:LINKS_TO]->(target:${targetLabel} {id: $targetId})
        WHERE source.userId = $userId
        RETURN source, r.linkText AS linkText, r.context AS context,
               r.linkType AS linkType, r.createdAt AS createdAt
        ORDER BY r.createdAt DESC
        `,
        { targetId: String(targetId), userId },
      );

      return result.records.map((rec) => ({
        note: rec.get('source').properties,
        noteId: rec.get('source').properties.id,
        noteTitle: rec.get('source').properties.title || 'Untitled Note',
        linkText: rec.get('linkText') || '',
        context: rec.get('context') || '',
        linkType: rec.get('linkType') || 'explicit',
        createdAt: rec.get('createdAt') || '',
      }));
    } catch (error) {
      console.error('GraphManager: getBacklinks error:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get outgoing links from a note
   * @param {string} noteId - Source note ID
   * @param {string} token - User token
   * @returns {Array} Array of outgoing link objects
   */
  async getOutgoingLinks(noteId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (source:Note {id: $noteId, userId: $userId})-[r:LINKS_TO]->(target)
        RETURN target, labels(target)[0] AS targetType, r.linkText AS linkText,
               r.linkType AS linkType, r.position AS position
        ORDER BY r.position ASC
        `,
        { noteId: String(noteId), userId },
      );

      return result.records.map((rec) => ({
        target: rec.get('target').properties,
        targetId: rec.get('target').properties.id,
        type: (rec.get('targetType') || 'Note').toLowerCase(),
        linkText: rec.get('linkText') || '',
        linkType: rec.get('linkType') || 'explicit',
        position: rec.get('position') || 0,
      }));
    } catch (error) {
      console.error('GraphManager: getOutgoingLinks error:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Sync links from note content - delete old links and create new ones
   * @param {string} noteId - Source note ID
   * @param {Array} links - Array of link objects [{targetId, type, text, position, linkType, context}]
   * @param {string} token - User token
   * @returns {Object} Result with success status and link count
   */
  async syncNoteLinks(noteId, links, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return { success: false, error: 'Invalid token' };

    const session = this.getSession();
    try {
      // Delete old LINKS_TO relationships from this note
      await session.run(
        `
        MATCH (n:Note {id: $noteId, userId: $userId})-[r:LINKS_TO]->()
        DELETE r
        `,
        { noteId: String(noteId), userId },
      );

      // Create new links
      let linkedCount = 0;
      for (const link of links) {
        const targetLabel = this._getLabelForType(link.type);

        try {
          await session.run(
            `
            MATCH (source:Note {id: $sourceId, userId: $userId})
            MATCH (target:${targetLabel} {id: $targetId})
            CREATE (source)-[:LINKS_TO {
              createdAt: datetime(),
              linkText: $linkText,
              position: $position,
              linkType: $linkType,
              context: $context
            }]->(target)
            `,
            {
              sourceId: String(noteId),
              targetId: String(link.targetId),
              linkText: link.text || '',
              position: link.position || 0,
              linkType: link.linkType || 'explicit',
              context: link.context || '',
              userId,
            },
          );
          linkedCount += 1;
        } catch (linkError) {
          console.warn(`GraphManager: Failed to create link to ${link.targetId}:`, linkError.message);
        }
      }

      return { success: true, linked: linkedCount };
    } catch (error) {
      console.error('GraphManager: syncNoteLinks error:', error);
      return { success: false, error: error.message };
    } finally {
      await session.close();
    }
  }

  /**
   * Search for items to link (vocabulary, concepts, notes)
   * @param {string} query - Search query
   * @param {string} token - User token
   * @param {number} limit - Max results
   * @returns {Array} Array of suggestion objects
   */
  async searchForLinking(query, token, limit = 15) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    const results = [];

    try {
      const searchPattern = `(?i).*${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`;

      // Search vocabulary (priority 1)
      const vocabResult = await session.run(
        `
        MATCH (v:Vocabulary)
        WHERE v.userId = $userId AND v.word =~ $pattern
        RETURN v, 1 AS priority
        ORDER BY v.leitnerBox DESC, v.word
        LIMIT $limit
        `,
        { userId, pattern: searchPattern, limit: Math.ceil(limit / 3) },
      );

      vocabResult.records.forEach((rec) => {
        const v = rec.get('v').properties;
        results.push({
          type: 'vocabulary',
          id: v.id,
          word: v.word,
          definition: v.definition?.substring(0, 100) || '',
          priority: 1,
          leitnerBox: v.leitnerBox || 1,
        });
      });

      // Search concepts (priority 2)
      const conceptResult = await session.run(
        `
        MATCH (c:Concept)
        WHERE c.userId = $userId AND c.name =~ $pattern
        RETURN c, 2 AS priority
        ORDER BY c.masteryLevel DESC, c.name
        LIMIT $limit
        `,
        { userId, pattern: searchPattern, limit: Math.ceil(limit / 3) },
      );

      conceptResult.records.forEach((rec) => {
        const c = rec.get('c').properties;
        results.push({
          type: 'concept',
          id: c.id,
          name: c.name,
          description: c.description?.substring(0, 100) || '',
          mastery: c.masteryLevel || 0,
          priority: 2,
        });
      });

      // Search notes (priority 3)
      const noteResult = await session.run(
        `
        MATCH (n:Note)
        WHERE n.userId = $userId AND (n.title =~ $pattern OR n.content =~ $pattern)
        RETURN n, 3 AS priority
        ORDER BY n.updatedAt DESC, n.title
        LIMIT $limit
        `,
        { userId, pattern: searchPattern, limit: Math.ceil(limit / 3) },
      );

      noteResult.records.forEach((rec) => {
        const n = rec.get('n').properties;
        results.push({
          type: 'note',
          id: n.id,
          title: n.title || 'Untitled Note',
          content: n.content?.substring(0, 100) || '',
          priority: 3,
        });
      });

      // Sort by priority, then limit
      results.sort((a, b) => a.priority - b.priority);
      return results.slice(0, limit);
    } catch (error) {
      console.error('GraphManager: searchForLinking error:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Find notes with shared tags (for semantic auto-linking)
   * @param {Array} tags - Tags to search for
   * @param {string} excludeNoteId - Note ID to exclude from results
   * @param {string} token - User token
   * @param {number} minSharedTags - Minimum shared tags required (default 2)
   * @returns {Array} Array of related notes
   */
  async findNotesBySharedTags(tags, excludeNoteId, token, minSharedTags = 2) {
    const userId = getUserIdFromToken(token);
    if (userId < 0 || !tags || tags.length < minSharedTags) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (n:Note)
        WHERE n.userId = $userId
          AND n.id <> $excludeId
          AND n.tags IS NOT NULL
        WITH n, [tag IN $tags WHERE tag IN n.tags] AS sharedTags
        WHERE size(sharedTags) >= $minSharedTags
        RETURN n, sharedTags, size(sharedTags) AS sharedCount
        ORDER BY sharedCount DESC
        LIMIT 10
        `,
        {
          userId,
          tags,
          excludeId: String(excludeNoteId),
          minSharedTags,
        },
      );

      return result.records.map((rec) => ({
        note: rec.get('n').properties,
        sharedTags: rec.get('sharedTags'),
        sharedCount: rec.get('sharedCount'),
      }));
    } catch (error) {
      console.error('GraphManager: findNotesBySharedTags error:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Find semantically similar notes based on embedding
   * @param {string} noteId - Source note ID
   * @param {Array} embedding - Embedding vector
   * @param {number} threshold - Similarity threshold (0-1)
   * @param {string} token - User token
   * @returns {Array} Array of similar notes with similarity scores
   */
  async findSemanticallySimilarNotes(noteId, embedding, threshold = 0.75, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0 || !embedding || embedding.length === 0) return [];

    const session = this.getSession();
    try {
      // Use cosine similarity on stored embeddings
      const result = await session.run(
        `
        MATCH (n:Note)
        WHERE n.userId = $userId
          AND n.id <> $excludeId
          AND n.embedding IS NOT NULL
        WITH n, gds.similarity.cosine(n.embedding, $embedding) AS similarity
        WHERE similarity >= $threshold
        RETURN n, similarity
        ORDER BY similarity DESC
        LIMIT 10
        `,
        {
          userId,
          excludeId: String(noteId),
          embedding,
          threshold,
        },
      );

      return result.records.map((rec) => ({
        note: rec.get('n').properties,
        similarity: rec.get('similarity'),
      }));
    } catch (error) {
      // GDS might not be installed, fall back to empty
      console.warn('GraphManager: findSemanticallySimilarNotes - GDS not available or error:', error.message);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get link preview data for a target
   * @param {string} type - Target type
   * @param {string} id - Target ID
   * @param {string} token - User token
   * @returns {Object|null} Preview data
   */
  async getLinkPreview(type, id, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    try {
      const label = this._getLabelForType(type);

      const result = await session.run(
        `
        MATCH (t:${label} {id: $id})
        WHERE t.userId = $userId OR $type = 'concept'
        RETURN t
        `,
        { id: String(id), userId, type },
      );

      if (result.records.length === 0) return null;

      const node = result.records[0].get('t').properties;

      switch (type) {
        case 'vocabulary':
          return {
            type: 'vocabulary',
            word: node.word,
            definition: node.definition,
            example: node.example,
            relatedWords: node.relatedWords,
            leitnerBox: node.leitnerBox || 1,
            nextReview: node.leitnerNextReview,
          };

        case 'concept':
          return {
            type: 'concept',
            name: node.name,
            description: node.description,
            mastery: node.masteryLevel || 0,
            exposureCount: node.exposureCount || 0,
          };

        case 'note':
        default:
          return {
            type: 'note',
            title: node.title || 'Untitled Note',
            content: node.content?.substring(0, 200) || '',
            tags: node.tags || [],
            createdAt: node.createdAt,
            sourceType: node.sourceType,
          };
      }
    } catch (error) {
      console.error('GraphManager: getLinkPreview error:', error);
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * Batch create Episode nodes (for EpisodeCollector)
   * @param {Array} events - Array of episode events
   */
  async batchCreateEpisodes(events) {
    if (!this.isConnected || !this.driver || !events || events.length === 0) {
      return { created: 0 };
    }

    const session = this.driver.session();
    try {
      const query = `
        UNWIND $events AS event
        MERGE (e:Episode {id: event.id})
        ON CREATE SET
          e.userId = event.userId,
          e.eventType = event.eventType,
          e.timestamp = event.timestamp,
          e.payload = event.payloadJson,
          e.sourceContext = event.sourceContextJson,
          e.processed = false,
          e.t_created = datetime(),
          e.t_valid = datetime(event.timestamp)
        RETURN count(e) as created
      `;

      const result = await session.run(query, { events });
      const record = result.records[0];
      if (!record) return { created: 0 };

      const createdValue = record.get('created');
      // Handle both Neo4j Integer objects and plain numbers
      const created = typeof createdValue === 'object' && createdValue.toNumber
        ? createdValue.toNumber()
        : Number(createdValue) || 0;

      return { created };
    } catch (error) {
      console.error('[Neo4jAdapter] Error creating episodes:', error);
      // Don't throw - just log and return 0 to prevent infinite loops
      return { created: 0 };
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // UNIFIED LEARNING POINT OPERATIONS
  // ===========================================================================

  /**
   * Leitner box intervals (days)
   * @private
   */
  static get BOX_INTERVALS() {
    return [1, 2, 4, 7, 14];
  }

  /**
   * Generate unique ID for learning point
   * @private
   */
  _generateLearningPointId() {
    return `lp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a unified learning point node
   * @param {Object} point - Learning point data
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async createLearningPoint(point, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    const now = new Date().toISOString();
    const id = point.id || this._generateLearningPointId();
    const today = now.split('T')[0];

    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})
        CREATE (lp:LearningPoint {
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
          nextReview: date($nextReview),
          lastReviewedAt: null,
          reviewCount: 0,
          correctStreak: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          easeFactor: 2.5,
          fullyLearned: false,
          masteryLevel: 0,
          avgResponseTimeMs: 0,
          lastResponseTimeMs: 0,
          embedding: null,
          embeddingModel: null,
          eventTime: datetime($eventTime),
          recordTime: datetime(),
          validFrom: datetime(),
          validTo: null,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        CREATE (u)-[:OWNS {createdAt: datetime()}]->(lp)
        WITH lp
        OPTIONAL MATCH (source)
          WHERE ($sourceType = 'book' AND source:Book AND source.id = $sourceId)
             OR ($sourceType = 'url' AND source:URL AND source.id = $sourceId)
        FOREACH (s IN CASE WHEN source IS NOT NULL THEN [source] ELSE [] END |
          CREATE (lp)-[:FROM_SOURCE {createdAt: datetime()}]->(s)
        )
        RETURN lp
        `,
        {
          userId: String(userId),
          id,
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
          chapterIndex: point.chapterIndex != null ? neo4j.int(point.chapterIndex) : null,
          pageNumber: point.pageNumber != null ? neo4j.int(point.pageNumber) : null,
          percentage: point.percentage != null ? point.percentage : null,
          tags: point.tags || [],
          difficulty: point.difficulty || 'intermediate',
          planId: point.planId || null,
          nextReview: today,
          eventTime: now,
        },
      );

      const node = result.records[0]?.get('lp');
      return node ? this._parseLearningPointNode(node) : null;
    } catch (error) {
      console.error('[Neo4jAdapter] Error creating learning point:', error);
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * Batch create multiple learning points
   * @param {Array<Object>} points - Array of learning point data
   * @param {string} token - User token
   * @returns {Promise<{created: number, errors: Array}>}
   */
  async createLearningPointsBatch(points, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return { error: 'Invalid session' };

    const results = { created: 0, errors: [] };

    for (const point of points) {
      try {
        // Validate required fields
        if (!point.title && !point.front) {
          results.errors.push({ point: point.title || '', error: 'Title or front required' });
          continue;
        }
        if (!point.front && !point.back) {
          results.errors.push({ point: point.title || '', error: 'Front or back required' });
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
   * @returns {Promise<Object|null>}
   */
  async getLearningPointById(id, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (lp:LearningPoint {id: $id, userId: $userId})
        WHERE lp.validTo IS NULL
        RETURN lp
        `,
        { id, userId: String(userId) },
      );

      const node = result.records[0]?.get('lp');
      return node ? this._parseLearningPointNode(node) : null;
    } catch (error) {
      console.error('[Neo4jAdapter] Error getting learning point:', error);
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * Update learning point properties
   * @param {string} id - Learning point ID
   * @param {Object} updates - Properties to update
   * @param {string} token - User token
   * @returns {Promise<Object|null>}
   */
  async updateLearningPoint(id, updates, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return { error: 'Invalid session' };

    const session = this.getSession();

    // Build SET clause dynamically
    const allowedFields = [
      'title', 'front', 'back', 'extras', 'tags', 'difficulty',
      'itemType', 'domainType', 'cfi', 'chapter', 'chapterIndex',
      'pageNumber', 'percentage', 'planId',
    ];

    const setClauses = ['lp.updatedAt = datetime()'];
    const params = { id, userId: String(userId) };

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const paramKey = `update_${key}`;
        if (key === 'front' || key === 'back' || key === 'extras') {
          params[paramKey] = typeof value === 'string' ? value : JSON.stringify(value);
        } else if (key === 'chapterIndex' || key === 'pageNumber') {
          params[paramKey] = value != null ? neo4j.int(value) : null;
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
      const result = await session.run(
        `
        MATCH (lp:LearningPoint {id: $id, userId: $userId})
        WHERE lp.validTo IS NULL
        SET ${setClauses.join(', ')}
        RETURN lp
        `,
        params,
      );

      const node = result.records[0]?.get('lp');
      return node ? this._parseLearningPointNode(node) : { error: 'Not found' };
    } catch (error) {
      console.error('[Neo4jAdapter] Error updating learning point:', error);
      return { error: error.message };
    } finally {
      await session.close();
    }
  }

  /**
   * Delete a learning point
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @param {boolean} hard - If true, permanently delete
   * @returns {Promise<boolean>}
   */
  async deleteLearningPoint(id, token, hard = false) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return false;

    const session = this.getSession();
    try {
      if (hard) {
        await session.run(
          `
          MATCH (lp:LearningPoint {id: $id, userId: $userId})
          DETACH DELETE lp
          `,
          { id, userId: String(userId) },
        );
      } else {
        // Soft delete - set validTo
        await session.run(
          `
          MATCH (lp:LearningPoint {id: $id, userId: $userId})
          WHERE lp.validTo IS NULL
          SET lp.validTo = datetime(), lp.updatedAt = datetime()
          `,
          { id, userId: String(userId) },
        );
      }
      return true;
    } catch (error) {
      console.error('[Neo4jAdapter] Error deleting learning point:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * Get learning points due for review
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getLearningPointsDue(options = {}) {
    const { token, date, limit = 50, itemTypes, domainTypes, tags, planId } = options;
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    const asOfDate = date || new Date().toISOString().split('T')[0];

    try {
      let query = `
        MATCH (lp:LearningPoint {userId: $userId})
        WHERE lp.fullyLearned = false
          AND lp.validTo IS NULL
          AND (lp.nextReview IS NULL OR lp.nextReview <= date($asOfDate))
      `;

      const params = {
        userId: String(userId),
        asOfDate,
        limit: neo4j.int(limit),
      };

      if (itemTypes?.length) {
        query += ` AND lp.itemType IN $itemTypes`;
        params.itemTypes = itemTypes;
      }
      if (domainTypes?.length) {
        query += ` AND lp.domainType IN $domainTypes`;
        params.domainTypes = domainTypes;
      }
      if (tags?.length) {
        query += ` AND ANY(tag IN lp.tags WHERE tag IN $tags)`;
        params.tags = tags;
      }
      if (planId) {
        query += ` AND lp.planId = $planId`;
        params.planId = planId;
      }

      query += `
        RETURN lp
        ORDER BY lp.nextReview ASC, lp.box ASC
        LIMIT $limit
      `;

      const result = await session.run(query, params);
      return result.records.map((r) => this._parseLearningPointNode(r.get('lp')));
    } catch (error) {
      console.error('[Neo4jAdapter] Error getting due items:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get learning points by source
   * @param {string} sourceType - Source type
   * @param {string} sourceId - Source ID
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getLearningPointsBySource(sourceType, sourceId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (lp:LearningPoint {userId: $userId, sourceType: $sourceType, sourceId: $sourceId})
        WHERE lp.validTo IS NULL
        RETURN lp
        ORDER BY lp.createdAt DESC
        `,
        { userId: String(userId), sourceType, sourceId: String(sourceId) },
      );

      return result.records.map((r) => this._parseLearningPointNode(r.get('lp')));
    } catch (error) {
      console.error('[Neo4jAdapter] Error getting learning points by source:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get learning points by plan
   * @param {string} planId - Plan ID
   * @param {string} token - User token
   * @returns {Promise<Array>}
   */
  async getLearningPointsByPlan(planId, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (lp:LearningPoint {userId: $userId, planId: $planId})
        WHERE lp.validTo IS NULL
        RETURN lp
        ORDER BY lp.createdAt DESC
        `,
        { userId: String(userId), planId },
      );

      return result.records.map((r) => this._parseLearningPointNode(r.get('lp')));
    } catch (error) {
      console.error('[Neo4jAdapter] Error getting learning points by plan:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Search learning points by text
   * @param {string} query - Search query
   * @param {string} token - User token
   * @param {Object} options - Search options
   * @returns {Promise<Array>}
   */
  async searchLearningPoints(query, token, options = {}) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return [];

    const { limit = 50, domainType, itemType } = options;
    const session = this.getSession();

    try {
      let cypher = `
        MATCH (lp:LearningPoint {userId: $userId})
        WHERE lp.validTo IS NULL
          AND (lp.title CONTAINS $query OR lp.front CONTAINS $query OR lp.back CONTAINS $query)
      `;

      const params = {
        userId: String(userId),
        query,
        limit: neo4j.int(limit),
      };

      if (domainType) {
        cypher += ` AND lp.domainType = $domainType`;
        params.domainType = domainType;
      }
      if (itemType) {
        cypher += ` AND lp.itemType = $itemType`;
        params.itemType = itemType;
      }

      cypher += `
        RETURN lp
        ORDER BY lp.updatedAt DESC
        LIMIT $limit
      `;

      const result = await session.run(cypher, params);
      return result.records.map((r) => this._parseLearningPointNode(r.get('lp')));
    } catch (error) {
      console.error('[Neo4jAdapter] Error searching learning points:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get all learning points with pagination
   * @param {string} token - User token
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async getAllLearningPoints(token, options = {}) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return { items: [], total: 0, page: 1, pageSize: 20 };

    const { page = 1, pageSize = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * pageSize;
    const session = this.getSession();

    try {
      // Get total count
      const countResult = await session.run(
        `
        MATCH (lp:LearningPoint {userId: $userId})
        WHERE lp.validTo IS NULL
        RETURN count(lp) as total
        `,
        { userId: String(userId) },
      );
      const total = countResult.records[0]?.get('total')?.toNumber?.() || 0;

      // Get paginated items
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const result = await session.run(
        `
        MATCH (lp:LearningPoint {userId: $userId})
        WHERE lp.validTo IS NULL
        RETURN lp
        ORDER BY lp.${sortBy} ${order}
        SKIP $skip
        LIMIT $limit
        `,
        {
          userId: String(userId),
          skip: neo4j.int(skip),
          limit: neo4j.int(pageSize),
        },
      );

      const items = result.records.map((r) => this._parseLearningPointNode(r.get('lp')));
      return { items, total, page, pageSize };
    } catch (error) {
      console.error('[Neo4jAdapter] Error getting all learning points:', error);
      return { items: [], total: 0, page, pageSize };
    } finally {
      await session.close();
    }
  }

  /**
   * Process review and update spaced repetition state
   * @param {string} id - Learning point ID
   * @param {number} rating - 1=Again, 2=Hard, 3=Good, 4=Easy
   * @param {number} responseTimeMs - Response time in milliseconds
   * @param {string} token - User token
   * @returns {Promise<Object>}
   */
  async processLearningPointReview(id, rating, responseTimeMs, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return { error: 'Invalid session' };

    const session = this.getSession();

    try {
      // Get current state
      const current = await session.run(
        `MATCH (lp:LearningPoint {id: $id, userId: $userId}) WHERE lp.validTo IS NULL RETURN lp`,
        { id, userId: String(userId) },
      );

      if (!current.records.length) {
        return { error: 'Learning point not found' };
      }

      const lp = current.records[0].get('lp').properties;
      const currentBox = this._toNumber(lp.box) || 1;
      const currentEase = lp.easeFactor || 2.5;
      const currentStreak = this._toNumber(lp.correctStreak) || 0;
      const currentReviewCount = this._toNumber(lp.reviewCount) || 0;
      const currentCorrect = this._toNumber(lp.totalCorrect) || 0;
      const currentIncorrect = this._toNumber(lp.totalIncorrect) || 0;
      const currentAvgTime = this._toNumber(lp.avgResponseTimeMs) || 0;

      // Calculate new state based on rating
      let newBox = currentBox;
      let newEase = currentEase;
      let isCorrect = false;

      switch (rating) {
        case 1: // Again - back to box 1
          newBox = 1;
          newEase = Math.max(1.3, currentEase - 0.2);
          break;
        case 2: // Hard - stay, reduce ease
          newBox = currentBox;
          newEase = Math.max(1.3, currentEase - 0.15);
          break;
        case 3: // Good - advance 1 box
          newBox = Math.min(5, currentBox + 1);
          isCorrect = true;
          break;
        case 4: // Easy - advance 2 boxes
          newBox = Math.min(5, currentBox + 2);
          newEase = currentEase + 0.15;
          isCorrect = true;
          break;
      }

      // Calculate next review date
      const intervalDays = Neo4jAdapter.BOX_INTERVALS[newBox - 1] || 14;
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
      const nextReview = nextReviewDate.toISOString().split('T')[0];

      // Calculate new streak and mastery
      const newStreak = isCorrect ? currentStreak + 1 : 0;
      const fullyLearned = newBox === 5 && newStreak >= 3;
      const masteryLevel = Math.min(100, Math.round((newBox / 5) * 70 + (newStreak / 5) * 30));

      // Calculate new average response time
      const newReviewCount = currentReviewCount + 1;
      const newAvgTime = currentReviewCount === 0
        ? responseTimeMs
        : Math.round((currentAvgTime * currentReviewCount + responseTimeMs) / newReviewCount);

      // Update the node
      await session.run(
        `
        MATCH (lp:LearningPoint {id: $id, userId: $userId})
        WHERE lp.validTo IS NULL
        SET lp.box = $newBox,
            lp.nextReview = date($nextReview),
            lp.lastReviewedAt = datetime(),
            lp.reviewCount = $reviewCount,
            lp.correctStreak = $streak,
            lp.totalCorrect = $totalCorrect,
            lp.totalIncorrect = $totalIncorrect,
            lp.easeFactor = $ease,
            lp.fullyLearned = $fullyLearned,
            lp.masteryLevel = $mastery,
            lp.lastResponseTimeMs = $lastTime,
            lp.avgResponseTimeMs = $avgTime,
            lp.updatedAt = datetime()
        `,
        {
          id,
          userId: String(userId),
          newBox: neo4j.int(newBox),
          nextReview,
          reviewCount: neo4j.int(newReviewCount),
          streak: neo4j.int(newStreak),
          totalCorrect: neo4j.int(currentCorrect + (isCorrect ? 1 : 0)),
          totalIncorrect: neo4j.int(currentIncorrect + (isCorrect ? 0 : 1)),
          ease: newEase,
          fullyLearned,
          mastery: neo4j.int(masteryLevel),
          lastTime: neo4j.int(responseTimeMs),
          avgTime: neo4j.int(newAvgTime),
        },
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
      console.error('[Neo4jAdapter] Error processing review:', error);
      return { error: error.message };
    } finally {
      await session.close();
    }
  }

  /**
   * Reset learning point to box 1
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @returns {Promise<boolean>}
   */
  async resetLearningPoint(id, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return false;

    const session = this.getSession();
    const today = new Date().toISOString().split('T')[0];

    try {
      await session.run(
        `
        MATCH (lp:LearningPoint {id: $id, userId: $userId})
        WHERE lp.validTo IS NULL
        SET lp.box = 1,
            lp.nextReview = date($today),
            lp.correctStreak = 0,
            lp.fullyLearned = false,
            lp.masteryLevel = 0,
            lp.updatedAt = datetime()
        `,
        { id, userId: String(userId), today },
      );
      return true;
    } catch (error) {
      console.error('[Neo4jAdapter] Error resetting learning point:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * Get learning point statistics
   * @param {string} token - User token
   * @param {Object} options - Filter options
   * @returns {Promise<Object|null>}
   */
  async getLearningPointStats(token, options = {}) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return null;

    const { planId, domainType } = options;
    const session = this.getSession();

    try {
      let whereClause = 'WHERE lp.validTo IS NULL';
      const params = { userId: String(userId) };

      if (planId) {
        whereClause += ' AND lp.planId = $planId';
        params.planId = planId;
      }
      if (domainType) {
        whereClause += ' AND lp.domainType = $domainType';
        params.domainType = domainType;
      }

      const result = await session.run(
        `
        MATCH (lp:LearningPoint {userId: $userId})
        ${whereClause}
        RETURN
          count(lp) as total,
          sum(CASE WHEN lp.fullyLearned THEN 1 ELSE 0 END) as mastered,
          sum(CASE WHEN lp.nextReview <= date() AND NOT lp.fullyLearned THEN 1 ELSE 0 END) as dueToday,
          sum(lp.totalCorrect) as totalCorrect,
          sum(lp.totalIncorrect) as totalIncorrect,
          sum(lp.reviewCount) as totalReviews,
          collect(DISTINCT lp.domainType) as domains,
          collect(DISTINCT lp.itemType) as itemTypes
        `,
        params,
      );

      const record = result.records[0];
      if (!record) return null;

      const total = this._toNumber(record.get('total')) || 0;
      const mastered = this._toNumber(record.get('mastered')) || 0;
      const dueToday = this._toNumber(record.get('dueToday')) || 0;
      const totalCorrect = this._toNumber(record.get('totalCorrect')) || 0;
      const totalIncorrect = this._toNumber(record.get('totalIncorrect')) || 0;
      const totalReviews = this._toNumber(record.get('totalReviews')) || 0;

      // Get box distribution
      const boxResult = await session.run(
        `
        MATCH (lp:LearningPoint {userId: $userId})
        ${whereClause}
        RETURN lp.box as box, count(*) as count
        ORDER BY lp.box
        `,
        params,
      );

      const byBox = {};
      boxResult.records.forEach((r) => {
        const box = this._toNumber(r.get('box')) || 1;
        byBox[box] = this._toNumber(r.get('count')) || 0;
      });

      // Get domain distribution
      const domainResult = await session.run(
        `
        MATCH (lp:LearningPoint {userId: $userId})
        ${whereClause}
        RETURN lp.domainType as domain, count(*) as count
        `,
        params,
      );

      const byDomain = {};
      domainResult.records.forEach((r) => {
        const domain = r.get('domain') || 'unknown';
        byDomain[domain] = this._toNumber(r.get('count')) || 0;
      });

      // Get type distribution
      const typeResult = await session.run(
        `
        MATCH (lp:LearningPoint {userId: $userId})
        ${whereClause}
        RETURN lp.itemType as type, count(*) as count
        `,
        params,
      );

      const byType = {};
      typeResult.records.forEach((r) => {
        const type = r.get('type') || 'unknown';
        byType[type] = this._toNumber(r.get('count')) || 0;
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
        byDomain,
        byType,
      };
    } catch (error) {
      console.error('[Neo4jAdapter] Error getting stats:', error);
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * Get daily forecast of items due for review
   * @param {string} token - User token
   * @param {number} days - Number of days
   * @returns {Promise<Object>}
   */
  async getLearningPointForecast(token, days = 14) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return {};

    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (lp:LearningPoint {userId: $userId})
        WHERE lp.validTo IS NULL
          AND lp.fullyLearned = false
          AND lp.nextReview IS NOT NULL
          AND lp.nextReview <= date() + duration({days: $days})
        RETURN toString(lp.nextReview) as reviewDate, count(*) as count
        ORDER BY reviewDate
        `,
        { userId: String(userId), days: neo4j.int(days) },
      );

      const forecast = {};
      result.records.forEach((r) => {
        const date = r.get('reviewDate');
        forecast[date] = this._toNumber(r.get('count')) || 0;
      });

      return forecast;
    } catch (error) {
      console.error('[Neo4jAdapter] Error getting forecast:', error);
      return {};
    } finally {
      await session.close();
    }
  }

  /**
   * Parse LearningPoint node to JS object
   * @private
   */
  _parseLearningPointNode(node) {
    if (!node) return null;

    const props = node.properties;
    return {
      id: props.id,
      userId: this._toNumber(props.userId),
      itemType: props.itemType,
      domainType: props.domainType,
      title: props.title,
      front: this._parseJson(props.front),
      back: this._parseJson(props.back),
      extras: this._parseJson(props.extras),
      sourceType: props.sourceType,
      sourceId: props.sourceId,
      cfi: props.cfi,
      chapter: props.chapter,
      chapterIndex: this._toNumber(props.chapterIndex),
      pageNumber: this._toNumber(props.pageNumber),
      percentage: props.percentage,
      tags: props.tags || [],
      difficulty: props.difficulty,
      planId: props.planId,
      box: this._toNumber(props.box) || 1,
      nextReview: this._dateToString(props.nextReview),
      lastReviewedAt: this._dateToString(props.lastReviewedAt),
      reviewCount: this._toNumber(props.reviewCount) || 0,
      correctStreak: this._toNumber(props.correctStreak) || 0,
      totalCorrect: this._toNumber(props.totalCorrect) || 0,
      totalIncorrect: this._toNumber(props.totalIncorrect) || 0,
      easeFactor: props.easeFactor || 2.5,
      fullyLearned: props.fullyLearned || false,
      masteryLevel: this._toNumber(props.masteryLevel) || 0,
      avgResponseTimeMs: this._toNumber(props.avgResponseTimeMs) || 0,
      lastResponseTimeMs: this._toNumber(props.lastResponseTimeMs) || 0,
      createdAt: this._dateToString(props.createdAt),
      updatedAt: this._dateToString(props.updatedAt),
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
    } catch {
      return value;
    }
  }

  /**
   * Convert Neo4j date/datetime to string
   * @private
   */
  _dateToString(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value.toString) return value.toString();
    return null;
  }

  /**
   * Convert Neo4j Integer to JS number
   * @private
   */
  _toNumber(value) {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value.toNumber) return value.toNumber();
    return Number(value) || null;
  }

  /**
   * Helper: Get Neo4j label for a given type
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
}

// Export the singleton instance
const instance = new Neo4jAdapter();

export default instance;
export { Neo4jAdapter };
