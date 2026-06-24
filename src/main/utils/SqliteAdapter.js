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
import * as lpm from '../db/LearningPointManager';

function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

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

  /**
   * Concepts have no dedicated table; we treat them as edge endpoints.
   * Returns a minimal envelope so callers that expect an id keep working.
   */
  async upsertConcept(concept /* , token */) {
    return concept && concept.id ? { id: concept.id, name: concept.name } : null;
  }

  /**
   * Note → Concept "MENTIONS_CONCEPT" edge with frequency + importance in
   * props_json. Idempotent via the unique index on
   * (source_type, source_id, edge_type, target_type, target_id).
   */
  async createMentionsRelationship(noteId, conceptId, frequency, importance) {
    if (!this.isConnected || noteId == null || conceptId == null) return;
    try {
      this._upsertEdge({
        sourceType: 'Note',
        sourceId: noteId,
        targetType: 'Concept',
        targetId: conceptId,
        edgeType: 'MENTIONS_CONCEPT',
        props: { frequency: frequency || 1, importance: importance ?? null },
      });
    } catch (e) {
      console.error('[SqliteAdapter] createMentionsRelationship:', e.message);
    }
  }

  /**
   * Replace all LINKS_TO edges from a note with the supplied list.
   * Used by the [[wiki-link]] parser whenever a note is saved.
   *
   * @param {string|number} noteId
   * @param {Array<{targetType:string, targetId:string|number, anchor?:string, position?:number}>} links
   */
  async syncNoteLinks(noteId, links, token) {
    if (!this.isConnected || noteId == null) {
      return { success: false, error: 'not connected' };
    }
    const db = getDb();
    const userId = token ? getUserIdFromToken(token) : null;
    const tx = db.transaction(() => {
      db.prepare(
        `DELETE FROM graph_edge
         WHERE source_type = 'Note' AND source_id = ? AND edge_type = 'LINKS_TO'`,
      ).run(String(noteId));
      const insert = db.prepare(
        `INSERT OR IGNORE INTO graph_edge
           (source_id, source_type, target_id, target_type, edge_type,
            weight, props_json, user_id, created_at)
         VALUES (?, 'Note', ?, ?, 'LINKS_TO', ?, ?, ?, ?)`,
      );
      const now = new Date().toISOString();
      for (const link of links || []) {
        const props = JSON.stringify({
          anchor: link.anchor ?? null,
          position: link.position ?? null,
        });
        insert.run(
          String(noteId),
          String(link.targetId),
          link.targetType || 'Note',
          link.weight ?? null,
          props,
          userId,
          now,
        );
      }
    });
    try {
      tx();
      return { success: true, count: (links || []).length };
    } catch (e) {
      console.error('[SqliteAdapter] syncNoteLinks:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Notes (or anything) linking TO the given (targetType, targetId).
   * Returns minimal envelopes — callers fetch full entity data themselves.
   */
  async getBacklinks(targetId, targetType, token) {
    if (!this.isConnected || targetId == null) return [];
    try {
      const rows = getDb()
        .prepare(
          `SELECT source_id AS sourceId, source_type AS sourceType,
                  edge_type AS edgeType, props_json AS propsJson, created_at AS createdAt
           FROM graph_edge
           WHERE target_id = ? AND target_type = ?
           ORDER BY created_at DESC`,
        )
        .all(String(targetId), targetType || 'Note');
      return rows.map((r) => ({
        sourceId: r.sourceId,
        sourceType: r.sourceType,
        edgeType: r.edgeType,
        props: r.propsJson ? safeParse(r.propsJson) : null,
        createdAt: r.createdAt,
      }));
    } catch (e) {
      console.error('[SqliteAdapter] getBacklinks:', e.message);
      return [];
    }
  }

  /** Outgoing edges from a note (or any source). */
  async getOutgoingLinks(noteId, token) {
    if (!this.isConnected || noteId == null) return [];
    try {
      const rows = getDb()
        .prepare(
          `SELECT target_id AS targetId, target_type AS targetType,
                  edge_type AS edgeType, props_json AS propsJson, created_at AS createdAt
           FROM graph_edge
           WHERE source_id = ? AND source_type = 'Note'
           ORDER BY created_at DESC`,
        )
        .all(String(noteId));
      return rows.map((r) => ({
        targetId: r.targetId,
        targetType: r.targetType,
        edgeType: r.edgeType,
        props: r.propsJson ? safeParse(r.propsJson) : null,
        createdAt: r.createdAt,
      }));
    } catch (e) {
      console.error('[SqliteAdapter] getOutgoingLinks:', e.message);
      return [];
    }
  }

  /**
   * Reuses findSimilar to surface semantically-near notes, then strips out
   * the source note itself. Matches the contract callers expect.
   */
  async findSemanticallySimilarNotes(noteId, embedding, threshold, token) {
    if (!embedding?.length) return [];
    const hits = await this.findSimilar(embedding, ['Note'], 20, threshold ?? 0.7, token);
    return hits.filter((r) => String(r.id) !== String(noteId));
  }

  /**
   * Generic upsert into graph_edge. Internal helper — keeps the SQL in one
   * place so the unique-index conflict policy stays consistent across edge
   * types (MENTIONS_CONCEPT, LINKS_TO, …).
   * @private
   */
  _upsertEdge({ sourceType, sourceId, targetType, targetId, edgeType, weight, props, userId }) {
    getDb()
      .prepare(
        `INSERT INTO graph_edge
           (source_id, source_type, target_id, target_type, edge_type,
            weight, props_json, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_type, source_id, edge_type, target_type, target_id)
         DO UPDATE SET
           weight = excluded.weight,
           props_json = excluded.props_json`,
      )
      .run(
        String(sourceId),
        sourceType,
        String(targetId),
        targetType,
        edgeType,
        weight ?? null,
        props ? JSON.stringify(props) : null,
        userId ?? null,
        new Date().toISOString(),
      );
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
  // LEARNING POINTS — delegate to LearningPointManager (owns the learning_point
  // table). Methods are synchronous in LPM; async wrapper resolves immediately.
  // ===========================================================================

  async createLearningPoint(point, token) {
    return lpm.createLearningPoint(point, token);
  }

  async createLearningPointsBatch(points, token) {
    return lpm.createLearningPointsBatch(points, token);
  }

  async getLearningPointById(id, token) {
    return lpm.getLearningPointById(id, token);
  }

  async updateLearningPoint(id, updates, token) {
    return lpm.updateLearningPoint(id, updates, token);
  }

  async deleteLearningPoint(id, token, hard = false) {
    return lpm.deleteLearningPoint(id, token, hard);
  }

  async getLearningPointsDue(options) {
    return lpm.getDueItems(options);
  }

  async getLearningPointsBySource(sourceType, sourceId, token) {
    return lpm.getBySource(sourceType, sourceId, token);
  }

  async getLearningPointsByPlan(planId, token) {
    return lpm.getByPlan(planId, token);
  }

  async searchLearningPoints(query, token, options = {}) {
    return lpm.searchLearningPoints(query, token, options);
  }

  async getAllLearningPoints(token, options = {}) {
    return lpm.getAllLearningPoints(token, options);
  }

  async processLearningPointReview(id, rating, responseTimeMs, token) {
    return lpm.processReview(id, rating, responseTimeMs, token);
  }

  async resetLearningPoint(id, token) {
    return lpm.resetLearningPoint(id, token);
  }

  async getLearningPointStats(token, options = {}) {
    return lpm.getStats(token, options);
  }

  async getLearningPointForecast(token, days = 14) {
    return lpm.getDailyForecast(token, days);
  }

  // ===========================================================================
  // LEARNING PATHS — Pass 4 may wire recursive CTEs over graph_edge.
  // ===========================================================================

  async getLearningPath(/* targetConceptId, maxDepth, token */) { return null; }
  async getKnowledgeAtTime(/* asOfDate, token */) { return []; }

  // ===========================================================================
  // KNOWLEDGE GRAPH VIEW — returns nodes + edges for the dashboard visualisation.
  // Note nodes come from graph_embedding (joined to the note table for titles).
  // Concept nodes are inferred from MENTIONS_CONCEPT edge targets — they have no
  // dedicated table in the SQLite adapter.
  // ===========================================================================

  async getKnowledgeGraphData(token) {
    if (!this.isConnected) return { nodes: [], edges: [] };
    try {
      const db = getDb();
      const userId = token ? getUserIdFromToken(token) : null;

      // Note nodes — graph_embedding stores node_id (=note.id) as TEXT.
      // user_id is not set by graphEmbeddingManager.addNote, so filter via note JOIN.
      const noteUserClause = userId != null ? 'AND n.user_id = ?' : '';
      const noteRows = db
        .prepare(
          `SELECT ge.node_id AS id,
                  json_extract(n.data, '$.title') AS title,
                  ge.updated_at AS updatedAt
           FROM graph_embedding ge
           LEFT JOIN note n ON CAST(ge.node_id AS INTEGER) = n.id
           WHERE ge.node_type = 'Note'
           ${noteUserClause}
           ORDER BY ge.updated_at DESC
           LIMIT 200`,
        )
        .all(...(userId != null ? [userId] : []));

      // Concept nodes — inferred from edge targets; no dedicated table.
      const conceptUserClause = userId != null ? 'AND user_id = ?' : '';
      const conceptRows = db
        .prepare(
          `SELECT target_id AS id, COUNT(*) AS frequency
           FROM graph_edge
           WHERE target_type = 'Concept' AND edge_type = 'MENTIONS_CONCEPT'
           ${conceptUserClause}
           GROUP BY target_id`,
        )
        .all(...(userId != null ? [userId] : []));

      // Edges
      const edgeUserClause = userId != null ? 'AND user_id = ?' : '';
      const edgeRows = db
        .prepare(
          `SELECT source_id AS source, target_id AS target, edge_type AS type
           FROM graph_edge
           WHERE edge_type IN ('MENTIONS_CONCEPT', 'LINKS_TO', 'RELATED_TO', 'REQUIRES')
           ${edgeUserClause}
           LIMIT 1000`,
        )
        .all(...(userId != null ? [userId] : []));

      const noteNodes = noteRows.map((r) => ({
        id: String(r.id),
        name: r.title || `Note #${r.id}`,
        type: 'Note',
        mastery: 0,
        domain: 'note',
      }));

      const conceptNodes = conceptRows.map((r) => ({
        id: String(r.id),
        name: String(r.id),
        type: 'Concept',
        mastery: 0,
        domain: 'concept',
        frequency: r.frequency,
      }));

      const edges = edgeRows
        .filter((r) => r.source && r.target)
        .map((r) => ({
          source: String(r.source),
          target: String(r.target),
          type: r.type,
        }));

      return { nodes: [...noteNodes, ...conceptNodes], edges };
    } catch (e) {
      console.error('[SqliteAdapter] getKnowledgeGraphData:', e.message);
      return { nodes: [], edges: [] };
    }
  }
}

const sqliteAdapter = new SqliteAdapter();
module.exports = sqliteAdapter;
module.exports.default = sqliteAdapter;
module.exports.SqliteAdapter = SqliteAdapter;
