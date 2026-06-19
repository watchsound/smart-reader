/**
 * SqliteAdapter.js
 *
 * SQLite implementation of the GraphInterface contract — the default backend
 * as of D3 (Kùzu's prebuilt segfaults Electron on Windows; Neo4j needs an
 * external server). Uses the existing better-sqlite3 connection so we share
 * one DB file with the entity managers.
 *
 * Three dedicated tables carry the graph layer (see db.sql `Graph layer in
 * SQLite` block):
 *   - graph_embedding — vector embeddings keyed on (node_type, node_id)
 *   - graph_chunk     — book content chunks for RAG (text + inline embedding)
 *   - graph_edge      — typed relationships (Note→Concept, Note→Note, …)
 *
 * Pass 1 (this file as first landed): stubs every contract method so the
 * GraphInterface initializes cleanly and the app boots without Neo4j or
 * Kùzu. Real implementations land in subsequent passes (embeddings +
 * chunks → notes/relationships → learning points → flip default).
 */

import { getUserIdFromToken, getDb } from '../db/dbManager';

const NOT_IMPLEMENTED = Symbol('SqliteAdapter:not-implemented');

class SqliteAdapter {
  constructor() {
    if (SqliteAdapter.instance) return SqliteAdapter.instance;
    this.isConnected = false;
    this.loadError = null;
    this.config = { dbPath: null };
    SqliteAdapter.instance = this;
  }

  // ===========================================================================
  // CONNECTION
  // ===========================================================================

  async connect(/* store */) {
    try {
      // Smoke-test the existing DB. SchemaMigrator runs db.sql at app boot,
      // which already creates graph_embedding / graph_chunk / graph_edge,
      // so this adapter doesn't own schema setup.
      const db = getDb();
      if (!db) {
        this.isConnected = false;
        this.loadError = new Error('SqliteAdapter: no db');
        return false;
      }
      db.prepare('SELECT 1').get();
      this.isConnected = true;
      this.loadError = null;
      return true;
    } catch (error) {
      console.error('[SqliteAdapter] connect failed:', error);
      this.isConnected = false;
      this.loadError = error;
      return false;
    }
  }

  async disconnect() {
    // Shared DB owned by DBManager — adapter doesn't close it.
    this.isConnected = false;
  }

  checkConnection() {
    return this.isConnected;
  }

  async getStats() {
    if (!this.isConnected) return {};
    try {
      const db = getDb();
      const count = (tbl) =>
        db.prepare(`SELECT COUNT(*) AS n FROM "${tbl}"`).get().n;
      return {
        Embedding: count('graph_embedding'),
        Chunk: count('graph_chunk'),
        Edge: count('graph_edge'),
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  // ===========================================================================
  // ENTITY OPERATIONS — Pass 1 stubs. Pass 3 wires through to NoteJsonManager,
  // BookManager, BookmarkManager, MessageManager, VocabularyManager which
  // already own these tables in SQLite. The graph adapter previously kept
  // duplicate "Note" / "Book" / "Bookmark" nodes; SQLite mode skips that
  // because the entity managers ARE the source of truth.
  // ===========================================================================

  async upsertUser(/* user */) { return null; }

  async createBook(/* book, token */) { return null; }
  async getBooksByUser(/* token */) { return []; }

  async createNote(/* note, token */) { return null; }
  async getNoteById(/* id, token */) { return null; }
  async getNotesBySource(/* sourceKey, sourceType, token */) { return []; }
  async updateNote(/* id, field, value, token */) { return -1; }
  async deleteNote(/* id, token */) { return -1; }
  async searchNotes(/* query, token */) { return []; }

  async createVocabulary(/* vocab, token */) { return null; }
  async getVocabularyByWord(/* word, token */) { return null; }

  async createChat(/* chat, token */) { return null; }
  async addMessage(/* message, chatId, token */) { return null; }
  async searchMessages(/* query, token */) { return []; }

  async createBookmark(/* bookmark, token */) { return null; }
  async getBookmarksBySource(/* sourceKey, token */) { return []; }
  async searchBookmarks(/* query, token */) { return []; }

  // ===========================================================================
  // SPACED REPETITION — leitner_item table already exists in SQLite. Phase 11
  // moved to learning_point + sr_item. Pass 4 wires these.
  // ===========================================================================

  async getDueForReview(/* asOfDate, itemTypes, limit, token */) { return []; }
  async recordReview(/* itemId, itemType, outcome, leitnerSpeed, token */) { return null; }
  async addNoteToLeitnerStudy(/* noteId, token */) { return null; }

  // ===========================================================================
  // CONCEPT + RELATIONSHIPS — Pass 3 uses graph_edge.
  // ===========================================================================

  async upsertConcept(/* concept, token */) { return null; }
  async createMentionsRelationship(/* noteId, conceptId, frequency, importance */) {
    return undefined;
  }

  // ===========================================================================
  // EPISODIC MEMORY — learning_session already exists; Phase 2 episodes
  // already write to SQLite via EpisodeCollector.
  // ===========================================================================

  async startLearningSession(/* activityType, resourceType, resourceId, token */) {
    return null;
  }
  async endLearningSession(/* sessionId, stats, token */) { return null; }
  async batchCreateEpisodes(/* events */) { return { created: 0 }; }

  // ===========================================================================
  // VECTOR EMBEDDINGS — Pass 2 implements with cosine-in-SQL.
  // ===========================================================================

  async storeEmbedding(/* nodeId, nodeType, embedding, model */) { return undefined; }
  async findSimilar(/* queryEmbedding, nodeTypes, limit, minSimilarity, token */) {
    return [];
  }

  // ===========================================================================
  // BOOK CHUNKS (RAG) — Pass 2 implements with graph_chunk table.
  // ===========================================================================

  async batchCreateChunks(/* bookId, chunks, embeddings, token */) { return 0; }
  async searchSimilarChunks(/* queryEmbedding, filters, limit, minSimilarity */) {
    return [];
  }
  async getChunksByBook(/* bookId, token */) { return []; }
  async getChunksWithoutEmbeddings(/* bookId, token */) { return []; }
  async updateChunkEmbedding(/* chunkId, embedding, model */) { return undefined; }
  async deleteChunksByBook(/* bookId, token */) { return 0; }
  async createChunkIndexes() { return true; }

  // ===========================================================================
  // LEARNING PATHS — Pass 4 may wire recursive CTEs over graph_edge.
  // ===========================================================================

  async getLearningPath(/* targetConceptId, maxDepth, token */) { return null; }
  async getKnowledgeAtTime(/* asOfDate, token */) { return []; }
}

const sqliteAdapter = new SqliteAdapter();
module.exports = sqliteAdapter;
module.exports.default = sqliteAdapter;
module.exports.SqliteAdapter = SqliteAdapter;
