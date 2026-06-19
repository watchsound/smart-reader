/**
 * GraphEmbeddingManager.js
 *
 * Primary embedding/search facade for entity-level content (books, notes,
 * messages, bookmarks). Replaces ChromaManager. Routes through GraphInterface
 * so Kùzu / Neo4j swap is transparent.
 *
 * Also owns the in-process temp-collection used for session-scoped RAG —
 * a tiny cosine ranker over chunks built from a single document.
 */

import { getUserIdFromToken } from '../db/dbManager';
import { getBookById } from '../db/BookManager';
import { getMessageById } from '../db/MessageManager';
import { getNoteById } from '../db/NoteJsonManager';
import graphInterface from './GraphInterface';
import { splitTextIntoChunks } from '../../commons/utils/CommonLangUtil';
import { cosineSimilarity } from './EmbeddingService';

class GraphEmbeddingManager {
  constructor() {
    if (GraphEmbeddingManager.instance) {
      return GraphEmbeddingManager.instance;
    }

    this.embeddingFunction = null;
    this.store = null;
    this._tempChunks = []; // [{text, embedding|null}]
    GraphEmbeddingManager.instance = this;
  }

  /**
   * @param {Object} store - electron-store instance
   * @param {Function|null} embeddingFunction - (text) => Promise<number[]|null>
   */
  async setup(store, embeddingFunction = null) {
    this.store = store;
    this.embeddingFunction = embeddingFunction;
  }

  setEmbeddingFunction(fn) {
    this.embeddingFunction = fn;
  }

  isEnabled(token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return false;
    const graphEnabled = this.store?.get('graph.enabled') ?? true;
    return graphEnabled && graphInterface.checkConnection();
  }

  async generateEmbedding(text) {
    if (!this.embeddingFunction) return null;
    try {
      return await this.embeddingFunction(text);
    } catch (e) {
      console.error('GraphEmbeddingManager: embedding error', e);
      return null;
    }
  }

  // ===========================================================================
  // BOOKMARK
  // ===========================================================================

  async addBookmark(bookmark, token) {
    if (!this.isEnabled(token)) return;
    const doc = `${bookmark.title || ''} ${bookmark.description || ''}`.trim();
    if (doc.length < 10) return;

    try {
      const result = await graphInterface.createBookmark(bookmark, token);
      if (!result) return;
      const embedding = await this.generateEmbedding(doc);
      if (embedding) {
        await graphInterface.storeEmbedding(
          result.id,
          'Bookmark',
          embedding,
          'default',
        );
      }
    } catch (e) {
      console.error('GraphEmbeddingManager: addBookmark error', e);
    }
  }

  // ===========================================================================
  // NOTE
  // ===========================================================================

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
      const embedding = await this.generateEmbedding(doc);
      if (embedding) {
        await graphInterface.storeEmbedding(
          noteObj.id,
          'Note',
          embedding,
          'default',
        );
      }
    } catch (e) {
      console.error('GraphEmbeddingManager: addNote error', e);
    }
  }

  // ===========================================================================
  // MESSAGE
  // ===========================================================================

  async addMessage(message, chatId, token) {
    if (!this.isEnabled(token)) return;
    const doc = message.content || '';
    if (doc.length < 10) return;

    try {
      const result = await graphInterface.addMessage(message, chatId, token);
      if (!result) return;
      const embedding = await this.generateEmbedding(doc);
      if (embedding) {
        await graphInterface.storeEmbedding(
          result.id,
          'Message',
          embedding,
          'default',
        );
      }
    } catch (e) {
      console.error('GraphEmbeddingManager: addMessage error', e);
    }
  }

  // ===========================================================================
  // SEARCH
  // ===========================================================================

  async searchBooks(query, token) {
    if (!this.isEnabled(token)) return [];
    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) {
        return graphInterface.searchNotes(query, token);
      }
      const results = await graphInterface.findSimilar(
        embedding,
        ['Book', 'BookChunk'],
        10,
        0.7,
        token,
      );
      const seen = new Set();
      const books = [];
      for (const r of results) {
        let bookId = r.id;
        if (r.nodeType === 'BookChunk') {
          const pos = bookId.indexOf('|');
          bookId = pos > 0 ? bookId.substring(0, pos) : bookId;
        }
        if (!seen.has(bookId)) {
          seen.add(bookId);
          const book = getBookById(bookId);
          if (book) books.push(book);
        }
      }
      return books;
    } catch (e) {
      console.error('GraphEmbeddingManager: searchBooks error', e);
      return [];
    }
  }

  async searchNotes(query, token) {
    if (!this.isEnabled(token)) return [];
    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) return graphInterface.searchNotes(query, token);
      const results = await graphInterface.findSimilar(
        embedding,
        ['Note'],
        10,
        0.7,
        token,
      );
      const notes = [];
      for (const r of results) {
        const note = getNoteById(r.id, token);
        if (note) notes.push(note);
      }
      return notes;
    } catch (e) {
      console.error('GraphEmbeddingManager: searchNotes error', e);
      return [];
    }
  }

  async searchMessages(query, token) {
    if (!this.isEnabled(token)) return [];
    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) return graphInterface.searchMessages(query, token);
      const results = await graphInterface.findSimilar(
        embedding,
        ['Message'],
        10,
        0.7,
        token,
      );
      const messages = [];
      for (const r of results) {
        const msg = getMessageById(r.id, token);
        if (msg) messages.push(msg);
      }
      return messages;
    } catch (e) {
      console.error('GraphEmbeddingManager: searchMessages error', e);
      return [];
    }
  }

  async searchBookmarks(query, token) {
    if (!this.isEnabled(token)) return [];
    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) return graphInterface.searchBookmarks(query, token);
      const results = await graphInterface.findSimilar(
        embedding,
        ['Bookmark'],
        10,
        0.7,
        token,
      );
      return results.map((r) => ({ ...r, similarity: r.similarity }));
    } catch (e) {
      console.error('GraphEmbeddingManager: searchBookmarks error', e);
      return [];
    }
  }

  /**
   * Semantic search over a specific book's chunks. Returns hits in the shape
   * the renderer expects for in-context RAG (epub: bookKey+cfi+excerpt; pdf: id+position+content).
   */
  async getBookContentByQuery(bookKey, bookType, query, token) {
    if (!this.isEnabled(token)) return [];
    try {
      const embedding = await this.generateEmbedding(query);
      if (!embedding) return [];

      const userId = getUserIdFromToken(token);
      const results = await graphInterface.searchSimilarChunks(
        embedding,
        { bookId: String(bookKey), userId: String(userId) },
        10,
        0.7,
      );

      return results.map((r) => {
        const id = r.chunk.id || '';
        const content = r.chunk.text || '';
        if (bookType === 'epub') {
          const pos = id.indexOf('|');
          return {
            data: {
              bookKey: pos > 0 ? id.substring(0, pos) : id,
              cfi: pos > 0 ? id.substring(pos + 1) : '',
              excerpt: content,
              type: bookType,
            },
          };
        }
        if (bookType === 'pdf') {
          const pos = id.indexOf('|');
          const pos2 = id.indexOf('|', pos + 2);
          const pageNum =
            pos > 0 && pos2 > 0
              ? parseInt(id.substring(pos + 1, pos2), 10) || 1
              : 1;
          return {
            data: {
              id: pos > 0 ? id.substring(0, pos) : id,
              position: {
                boundingRect: {
                  x1: 0,
                  y1: 0,
                  x2: 10,
                  y2: 10,
                  width: 10,
                  height: 10,
                  pageNumber: pageNum,
                },
                rects: [
                  { x1: 0, y1: 0, x2: 10, y2: 10, width: 10, height: 10 },
                ],
                pageNumber: pageNum,
              },
              content: { text: content },
              type: bookType,
            },
          };
        }
        return { data: { content } };
      });
    } catch (e) {
      console.error('GraphEmbeddingManager: getBookContentByQuery error', e);
      return [];
    }
  }

  // ===========================================================================
  // IN-PROCESS TEMP COLLECTION (session-scoped RAG)
  //
  // Replaces Chroma's `my_temp_collection`. Chunks the document, embeds each
  // chunk if an embedding function is available, then ranks by cosine
  // similarity at query time. Falls back to substring filtering when no
  // embedder is configured.
  // ===========================================================================

  async addContentToTempStorage(content) {
    const chunks = splitTextIntoChunks(content || '', 500);
    if (this.embeddingFunction) {
      const embeddings = await Promise.all(
        chunks.map((c) => this.generateEmbedding(c).catch(() => null)),
      );
      this._tempChunks = chunks.map((text, i) => ({
        text,
        embedding: embeddings[i],
      }));
    } else {
      this._tempChunks = chunks.map((text) => ({ text, embedding: null }));
    }
    return true;
  }

  /**
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<string[]>} top matching chunk texts
   */
  async queryTempStorage(query, limit = 5) {
    if (!this._tempChunks.length) return [];

    if (this.embeddingFunction && this._tempChunks.some((c) => c.embedding)) {
      const queryEmbedding = await this.generateEmbedding(query);
      if (queryEmbedding) {
        const scored = this._tempChunks
          .filter((c) => c.embedding)
          .map((c) => ({
            text: c.text,
            score: cosineSimilarity(queryEmbedding, c.embedding),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        return scored.map((s) => s.text);
      }
    }

    const q = (query || '').toLowerCase();
    return this._tempChunks
      .filter((c) => c.text.toLowerCase().includes(q))
      .slice(0, limit)
      .map((c) => c.text);
  }

  clearTempStorage() {
    this._tempChunks = [];
  }
}

const graphEmbeddingManager = new GraphEmbeddingManager();
export default graphEmbeddingManager;
