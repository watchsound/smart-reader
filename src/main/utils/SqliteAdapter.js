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
import { cosineSimilarity } from './EmbeddingService';

// ---------------------------------------------------------------------------
// Embedding BLOB packing. We store a Float32Array's underlying bytes in the
// BLOB column (4 bytes per dim) — about 3 KB for a 768-dim model. JSON would
// be ~3× larger and pay a stringify/parse round-trip per row, which adds up
// fast at query time when scanning thousands of embeddings.
// ---------------------------------------------------------------------------

function embeddingToBlob(arr) {
  if (!arr || !arr.length) return null;
  return Buffer.from(new Float32Array(arr).buffer);
}

function blobToEmbedding(blob) {
  if (!blob || blob.byteLength < 4) return null;
  const view = new Float32Array(
    blob.buffer,
    blob.byteOffset,
    Math.floor(blob.byteLength / 4),
  );
  // Copy out of the underlying SQLite buffer — view becomes invalid once the
  // statement is finalized.
  return Array.from(view);
}

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
  // VECTOR EMBEDDINGS
  //
  // graph_embedding stores one row per (node_type, node_id) — upsert on that
  // composite key so a re-embed simply overwrites. Vector data lives in the
  // BLOB column as packed Float32 bytes; findSimilar scans the matching
  // node_types and computes cosine JS-side. O(n) but very fast for the
  // expected single-user, ~10k-vector working set.
  // ===========================================================================

  async storeEmbedding(nodeId, nodeType, embedding, model) {
    if (!this.isConnected || !embedding || !embedding.length) return;
    const blob = embeddingToBlob(embedding);
    if (!blob) return;
    try {
      getDb()
        .prepare(
          `INSERT INTO graph_embedding (node_id, node_type, embedding, model, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(node_type, node_id) DO UPDATE SET
             embedding = excluded.embedding,
             model = excluded.model,
             updated_at = excluded.updated_at`,
        )
        .run(
          String(nodeId),
          nodeType,
          blob,
          model || 'default',
          new Date().toISOString(),
        );
    } catch (e) {
      console.error('[SqliteAdapter] storeEmbedding:', e.message);
    }
  }

  async findSimilar(queryEmbedding, nodeTypes, limit, minSimilarity, token) {
    if (!this.isConnected || !queryEmbedding?.length) return [];
    const types = Array.isArray(nodeTypes) ? nodeTypes : [nodeTypes];
    if (!types.length) return [];
    const userId = token ? getUserIdFromToken(token) : null;

    const placeholders = types.map(() => '?').join(',');
    let sql = `SELECT node_id, node_type, embedding FROM graph_embedding
               WHERE node_type IN (${placeholders})`;
    const params = [...types];
    if (userId != null && userId >= 0) {
      sql += ' AND (user_id = ? OR user_id IS NULL)';
      params.push(userId);
    }

    try {
      const rows = getDb().prepare(sql).all(...params);
      const scored = [];
      for (const r of rows) {
        const emb = blobToEmbedding(r.embedding);
        if (!emb) continue;
        const sim = cosineSimilarity(queryEmbedding, emb);
        if (sim >= (minSimilarity ?? 0)) {
          scored.push({ id: r.node_id, nodeType: r.node_type, similarity: sim });
        }
      }
      scored.sort((a, b) => b.similarity - a.similarity);
      return scored.slice(0, limit ?? 10);
    } catch (e) {
      console.error('[SqliteAdapter] findSimilar:', e.message);
      return [];
    }
  }

  // ===========================================================================
  // BOOK CHUNKS (RAG)
  //
  // Chunks live in their own table because callers fetch the chunk text +
  // optional position metadata together. Embedding is stored inline so the
  // similarity query is a single scan.
  // ===========================================================================

  async batchCreateChunks(bookId, chunks, embeddings, token) {
    if (!this.isConnected || !chunks?.length) return 0;
    const userId = token ? getUserIdFromToken(token) : null;
    const now = new Date().toISOString();
    let created = 0;
    const db = getDb();
    const insert = db.prepare(
      `INSERT INTO graph_chunk
         (id, book_id, user_id, text, chunk_index, page_num, cfi,
          section_title, embedding, embedding_model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         text = excluded.text,
         embedding = excluded.embedding,
         embedding_model = excluded.embedding_model`,
    );
    const tx = db.transaction((items) => {
      for (let i = 0; i < items.length; i += 1) {
        const c = items[i];
        const emb = embeddings?.[i];
        const id = c.id
          || `${bookId}|${c.chunkIndex ?? i}|${c.cfi || ''}`;
        insert.run(
          id,
          String(bookId),
          userId,
          c.text,
          c.chunkIndex ?? i,
          c.pageNum ?? null,
          c.cfi ?? null,
          c.sectionTitle ?? null,
          emb ? embeddingToBlob(emb) : null,
          emb ? 'text-embedding-3-small' : null,
          now,
        );
        created += 1;
      }
    });
    try {
      tx(chunks);
      return created;
    } catch (e) {
      console.error('[SqliteAdapter] batchCreateChunks:', e.message);
      return created;
    }
  }

  async searchSimilarChunks(queryEmbedding, filters = {}, limit = 10, minSimilarity = 0.7) {
    if (!this.isConnected || !queryEmbedding?.length) return [];
    let sql = `SELECT id, book_id, user_id, text, chunk_index, page_num,
                      cfi, section_title, embedding
               FROM graph_chunk
               WHERE embedding IS NOT NULL`;
    const params = [];
    if (filters.bookId != null) {
      sql += ' AND book_id = ?';
      params.push(String(filters.bookId));
    }
    if (filters.userId != null) {
      sql += ' AND user_id = ?';
      params.push(filters.userId);
    }
    try {
      const rows = getDb().prepare(sql).all(...params);
      const scored = [];
      for (const r of rows) {
        const emb = blobToEmbedding(r.embedding);
        if (!emb) continue;
        const sim = cosineSimilarity(queryEmbedding, emb);
        if (sim < minSimilarity) continue;
        scored.push({
          chunk: {
            id: r.id,
            bookId: r.book_id,
            text: r.text,
            chunkIndex: r.chunk_index,
            pageNum: r.page_num,
            cfi: r.cfi,
            sectionTitle: r.section_title,
          },
          similarity: sim,
        });
      }
      scored.sort((a, b) => b.similarity - a.similarity);
      return scored.slice(0, limit);
    } catch (e) {
      console.error('[SqliteAdapter] searchSimilarChunks:', e.message);
      return [];
    }
  }

  async getChunksByBook(bookId, token) {
    if (!this.isConnected) return [];
    try {
      const rows = getDb()
        .prepare(
          `SELECT id, book_id AS bookId, text, chunk_index AS chunkIndex,
                  page_num AS pageNum, cfi, section_title AS sectionTitle
           FROM graph_chunk WHERE book_id = ? ORDER BY chunk_index`,
        )
        .all(String(bookId));
      return rows;
    } catch (e) {
      console.error('[SqliteAdapter] getChunksByBook:', e.message);
      return [];
    }
  }

  async getChunksWithoutEmbeddings(bookId, token) {
    if (!this.isConnected) return [];
    try {
      return getDb()
        .prepare(
          `SELECT id, text FROM graph_chunk
           WHERE book_id = ? AND embedding IS NULL
           ORDER BY chunk_index`,
        )
        .all(String(bookId));
    } catch (e) {
      console.error('[SqliteAdapter] getChunksWithoutEmbeddings:', e.message);
      return [];
    }
  }

  async updateChunkEmbedding(chunkId, embedding, model) {
    if (!this.isConnected || !embedding?.length) return;
    try {
      getDb()
        .prepare(
          `UPDATE graph_chunk
             SET embedding = ?, embedding_model = ?
             WHERE id = ?`,
        )
        .run(embeddingToBlob(embedding), model || 'default', String(chunkId));
    } catch (e) {
      console.error('[SqliteAdapter] updateChunkEmbedding:', e.message);
    }
  }

  async deleteChunksByBook(bookId, token) {
    if (!this.isConnected) return 0;
    try {
      const r = getDb()
        .prepare('DELETE FROM graph_chunk WHERE book_id = ?')
        .run(String(bookId));
      return r.changes || 0;
    } catch (e) {
      console.error('[SqliteAdapter] deleteChunksByBook:', e.message);
      return 0;
    }
  }

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
