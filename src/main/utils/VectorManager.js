/**
 * VectorManager.js
 *
 * Unified interface for vector storage operations, routed through
 * GraphInterface (Kùzu by default, Neo4j when configured). This is the
 * primary vector storage interface — Chroma has been removed.
 *
 * Features:
 * - Book chunk embedding and search
 * - Note / message embedding and search (delegate to GraphInterface)
 * - Key concept extraction and embedding
 * - Lazy embedding generation
 */

import graphInterface from './GraphInterface';
import { getUserIdFromToken } from '../db/dbManager';
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
   * @param {Object} store - electron-store instance
   * @param {Function|null} embeddingFunction - (text) => Promise<number[]|null>
   */
  async setup(store, embeddingFunction = null) {
    this.store = store;
    this.embeddingFunction = embeddingFunction;

    if (graphInterface.checkConnection()) {
      await graphInterface.createChunkIndexes();
    }

    this.isInitialized = true;
    console.log('VectorManager: Initialized');
  }

  setEmbeddingFunction(fn) {
    this.embeddingFunction = fn;
  }

  isEnabled(token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return false;
    const vectorEnabled = this.store?.get('vector.enabled') ?? true;
    return vectorEnabled && graphInterface.checkConnection();
  }

  hasEmbeddingFunction() {
    return typeof this.embeddingFunction === 'function';
  }

  async generateEmbedding(text) {
    if (!this.embeddingFunction) return null;
    try {
      return await this.embeddingFunction(text);
    } catch (error) {
      console.error('VectorManager: Error generating embedding:', error);
      return null;
    }
  }

  async batchGenerateEmbeddings(texts) {
    if (!this.embeddingFunction) return texts.map(() => null);
    try {
      if (this.embeddingFunction.batch) {
        return await this.embeddingFunction.batch(texts);
      }
      const embeddings = [];
      for (const text of texts) {
        // eslint-disable-next-line no-await-in-loop
        embeddings.push(await this.generateEmbedding(text));
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

  async importBook(book, options = {}, token) {
    if (!this.isEnabled(token)) {
      return {
        chunksCreated: 0,
        conceptsExtracted: 0,
        error: 'Vector storage not enabled',
      };
    }

    const { maxChunkSize = 500, generateEmbeddings = true } = options;

    try {
      const chunks = await this.parseBookIntoChunks(book, maxChunkSize);
      if (chunks.length === 0) {
        return {
          chunksCreated: 0,
          conceptsExtracted: 0,
          error: 'No content to chunk',
        };
      }

      let embeddings = [];
      if (generateEmbeddings && this.hasEmbeddingFunction()) {
        embeddings = await this.batchGenerateEmbeddings(
          chunks.map((c) => c.text),
        );
      }

      const chunksCreated = await graphInterface.batchCreateChunks(
        book.id,
        chunks,
        embeddings,
        token,
      );

      return {
        chunksCreated,
        conceptsExtracted: 0,
        totalChunks: chunks.length,
        hasEmbeddings: embeddings.length > 0 && embeddings[0] !== null,
      };
    } catch (error) {
      console.error('VectorManager: Error importing book:', error);
      return { chunksCreated: 0, conceptsExtracted: 0, error: error.message };
    }
  }

  async parseBookIntoChunks(book, maxChunkSize = 500) {
    if (book.content) {
      const textChunks = splitTextIntoChunks(book.content, maxChunkSize);
      return textChunks.map((text, idx) => ({ text, chunkIndex: idx }));
    }
    return [];
  }

  /**
   * Add pre-parsed chunks (sent in from the renderer after EPUB/PDF parsing).
   * @param {string} bookId
   * @param {Array} chunks
   * @param {string} token
   */
  async addBookChunks(bookId, chunks, token) {
    if (!this.isEnabled(token)) {
      return { chunksCreated: 0, error: 'Vector storage not enabled' };
    }

    try {
      let embeddings = [];
      if (this.hasEmbeddingFunction()) {
        embeddings = await this.batchGenerateEmbeddings(
          chunks.map((c) => c.text),
        );
      }

      const chunksCreated = await graphInterface.batchCreateChunks(
        bookId,
        chunks,
        embeddings,
        token,
      );

      return { chunksCreated, hasEmbeddings: embeddings.length > 0 };
    } catch (error) {
      console.error('VectorManager: Error adding book chunks:', error);
      return { chunksCreated: 0, error: error.message };
    }
  }

  /**
   * Semantic search over a book's chunks. Optional bookId filter scopes
   * the result to a single book.
   */
  async searchBookContent(query, bookId, limit = 10, token) {
    if (!this.isEnabled(token)) return [];
    if (!this.hasEmbeddingFunction()) {
      console.warn('VectorManager: Cannot search without embedding function');
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) return [];

      const userId = getUserIdFromToken(token);
      const filters = { userId: String(userId) };
      if (bookId) filters.bookId = String(bookId);

      const results = await graphInterface.searchSimilarChunks(
        queryEmbedding,
        filters,
        limit,
        0.7,
      );

      return results.map((r) => ({
        text: r.chunk.text,
        bookId: r.chunk.bookId,
        chunkIndex: r.chunk.chunkIndex,
        pageNum: r.chunk.pageNum,
        cfi: r.chunk.cfi,
        sectionTitle: r.chunk.sectionTitle,
        similarity: r.similarity,
      }));
    } catch (error) {
      console.error('VectorManager: Error searching book content:', error);
      return [];
    }
  }

  async deleteBookChunks(bookId, token) {
    if (!this.isEnabled(token)) return;
    try {
      await graphInterface.deleteChunksByBook(bookId, token);
    } catch (error) {
      console.error('VectorManager: Error deleting book chunks:', error);
    }
  }

  async ensureBookEmbeddings(bookId, token) {
    if (!this.isEnabled(token) || !this.hasEmbeddingFunction()) return 0;
    try {
      const chunks = await graphInterface.getChunksWithoutEmbeddings(
        bookId,
        token,
      );
      if (chunks.length === 0) return 0;

      for (const chunk of chunks) {
        // eslint-disable-next-line no-await-in-loop
        const embedding = await this.generateEmbedding(chunk.text);
        if (embedding) {
          // eslint-disable-next-line no-await-in-loop
          await graphInterface.updateChunkEmbedding(chunk.id, embedding);
        }
      }
      return chunks.length;
    } catch (error) {
      console.error('VectorManager: Error ensuring book embeddings:', error);
      return 0;
    }
  }
}

const vectorManager = new VectorManager();

export default vectorManager;
export { VectorManager };
