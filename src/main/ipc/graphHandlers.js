/**
 * graphHandlers.js
 *
 * IPC handlers for graph database operations.
 * These handlers are registered in main.ts and called from the renderer process.
 *
 * Uses GraphInterface abstraction layer, which allows swapping between:
 * - Kùzu (default - embedded, MIT license, no external server)
 * - Neo4j (external server required)
 * - Graphiti (future implementation)
 *
 * Naming convention: graph-{operation}-{entity}
 * Example: graph-create-note, graph-get-notes-by-source
 */

import { ipcMain } from 'electron';
import graphInterface from '../utils/GraphInterface';
import graphLearningFeatures from '../utils/GraphLearningFeatures';
import graphEmbeddingManager from '../utils/GraphEmbeddingManager';
import aiConceptExtractionService from '../utils/AIConceptExtractionService';

/**
 * Register all graph-related IPC handlers
 * @param {Object} store - electron-store instance
 */
export function registerGraphHandlers(store) {
  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  /**
   * Initialize and connect to graph database
   * Default adapter is 'kuzu' (embedded, no external server required)
   */
  ipcMain.on('graph-connect', async (event) => {
    try {
      // Default to Kùzu - embedded database, MIT license
      const adapterType = store?.get('graph.adapterType') || 'kuzu';
      const result = await graphInterface.initialize(adapterType, store);
      event.returnValue = { success: result, error: null };
    } catch (error) {
      event.returnValue = { success: false, error: error.message };
    }
  });

  /**
   * Check if graph database is connected
   */
  ipcMain.on('graph-check-connection', (event) => {
    event.returnValue = graphInterface.checkConnection();
  });

  /**
   * Get comprehensive graph database status
   * Returns adapter type, connection state, capabilities, and any errors
   */
  ipcMain.on('graph-get-status', (event) => {
    try {
      const status = graphInterface.getStatus();
      event.returnValue = status;
    } catch (error) {
      event.returnValue = {
        initialized: false,
        adapterType: null,
        connected: false,
        available: false,
        error: error.message,
      };
    }
  });

  /**
   * Disconnect from graph database
   */
  ipcMain.on('graph-disconnect', async (event) => {
    try {
      await graphInterface.disconnect();
      event.returnValue = { success: true };
    } catch (error) {
      event.returnValue = { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // USER OPERATIONS
  // ===========================================================================

  /**
   * Create or update user
   */
  ipcMain.on('graph-upsert-user', async (event, user) => {
    try {
      const result = await graphInterface.upsertUser(user);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-upsert-user error:', error);
      event.returnValue = null;
    }
  });

  // ===========================================================================
  // BOOK OPERATIONS
  // ===========================================================================

  /**
   * Create a book
   */
  ipcMain.on('graph-create-book', async (event, book, token) => {
    try {
      const result = await graphInterface.createBook(book, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-create-book error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Get books for current user
   */
  ipcMain.on('graph-get-books', async (event, token) => {
    try {
      const result = await graphInterface.getBooksByUser(token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-get-books error:', error);
      event.returnValue = [];
    }
  });

  // ===========================================================================
  // NOTE OPERATIONS
  // ===========================================================================

  /**
   * Create a note
   */
  ipcMain.on('graph-create-note', async (event, note, token) => {
    try {
      const result = await graphInterface.createNote(note, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-create-note error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Get note by ID
   */
  ipcMain.on('graph-get-note', async (event, noteId, token) => {
    try {
      const result = await graphInterface.getNoteById(noteId, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-get-note error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Get notes by source (book, URL, etc.)
   */
  ipcMain.on(
    'graph-get-notes-by-source',
    async (event, sourceKey, sourceType, token) => {
      try {
        const result = await graphInterface.getNotesBySource(
          sourceKey,
          sourceType,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-get-notes-by-source error:', error);
        event.returnValue = [];
      }
    },
  );

  /**
   * Update a note field
   */
  ipcMain.on(
    'graph-update-note',
    async (event, noteId, field, value, token) => {
      try {
        const result = await graphInterface.updateNote(
          noteId,
          field,
          value,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-update-note error:', error);
        event.returnValue = -1;
      }
    },
  );

  /**
   * Delete a note
   */
  ipcMain.on('graph-delete-note', async (event, noteId, token) => {
    try {
      const result = await graphInterface.deleteNote(noteId, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-delete-note error:', error);
      event.returnValue = -1;
    }
  });

  /**
   * Search notes by text
   */
  ipcMain.on('graph-search-notes', async (event, query, token) => {
    try {
      const result = await graphInterface.searchNotes(query, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-search-notes error:', error);
      event.returnValue = [];
    }
  });

  // ===========================================================================
  // VOCABULARY OPERATIONS
  // ===========================================================================

  /**
   * Create vocabulary
   */
  ipcMain.on('graph-create-vocabulary', async (event, vocab, token) => {
    try {
      const result = await graphInterface.createVocabulary(vocab, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-create-vocabulary error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Get vocabulary by word
   */
  ipcMain.on('graph-get-vocabulary-by-word', async (event, word, token) => {
    try {
      const result = await graphInterface.getVocabularyByWord(word, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-get-vocabulary-by-word error:', error);
      event.returnValue = null;
    }
  });

  // ===========================================================================
  // SPACED REPETITION (LEITNER SYSTEM)
  // ===========================================================================

  /**
   * Get items due for review
   */
  ipcMain.on(
    'graph-get-due-for-review',
    async (event, asOfDate, itemTypes, limit, token) => {
      try {
        const date = new Date(asOfDate);
        const result = await graphInterface.getDueForReview(
          date,
          itemTypes,
          limit,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-get-due-for-review error:', error);
        event.returnValue = [];
      }
    },
  );

  /**
   * Record a review outcome
   */
  ipcMain.on(
    'graph-record-review',
    async (event, itemId, itemType, outcome, leitnerSpeed, token) => {
      try {
        const result = await graphInterface.recordReview(
          itemId,
          itemType,
          outcome,
          leitnerSpeed,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-record-review error:', error);
        event.returnValue = null;
      }
    },
  );

  /**
   * Add note to Leitner study
   */
  ipcMain.on('graph-add-note-to-leitner', async (event, noteId, token) => {
    try {
      const result = await graphInterface.addNoteToLeitnerStudy(noteId, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-add-note-to-leitner error:', error);
      event.returnValue = null;
    }
  });

  // ===========================================================================
  // CONCEPT OPERATIONS
  // ===========================================================================

  /**
   * Create or update concept
   */
  ipcMain.on('graph-upsert-concept', async (event, concept, token) => {
    try {
      const result = await graphInterface.upsertConcept(concept, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-upsert-concept error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Create MENTIONS_CONCEPT relationship
   */
  ipcMain.on(
    'graph-create-mentions',
    async (event, noteId, conceptId, frequency, importance) => {
      try {
        await graphInterface.createMentionsRelationship(
          noteId,
          conceptId,
          frequency,
          importance,
        );
        event.returnValue = { success: true };
      } catch (error) {
        console.error('graph-create-mentions error:', error);
        event.returnValue = { success: false, error: error.message };
      }
    },
  );

  // ===========================================================================
  // LEARNING SESSION OPERATIONS
  // ===========================================================================

  /**
   * Start a learning session
   */
  ipcMain.on(
    'graph-start-session',
    async (event, activityType, resourceType, resourceId, token) => {
      try {
        const result = await graphInterface.startLearningSession(
          activityType,
          resourceType,
          resourceId,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-start-session error:', error);
        event.returnValue = null;
      }
    },
  );

  /**
   * End a learning session
   */
  ipcMain.on('graph-end-session', async (event, sessionId, stats, token) => {
    try {
      const result = await graphInterface.endLearningSession(
        sessionId,
        stats,
        token,
      );
      event.returnValue = result;
    } catch (error) {
      console.error('graph-end-session error:', error);
      event.returnValue = null;
    }
  });

  // ===========================================================================
  // SEMANTIC SEARCH
  // ===========================================================================

  /**
   * Store embedding for a node
   */
  ipcMain.on(
    'graph-store-embedding',
    async (event, nodeId, nodeType, embedding, model) => {
      try {
        await graphInterface.storeEmbedding(nodeId, nodeType, embedding, model);
        event.returnValue = { success: true };
      } catch (error) {
        console.error('graph-store-embedding error:', error);
        event.returnValue = { success: false, error: error.message };
      }
    },
  );

  /**
   * Find similar nodes
   */
  ipcMain.on(
    'graph-find-similar',
    async (event, queryEmbedding, nodeTypes, limit, minSimilarity, token) => {
      try {
        const result = await graphInterface.findSimilar(
          queryEmbedding,
          nodeTypes,
          limit,
          minSimilarity,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-find-similar error:', error);
        event.returnValue = [];
      }
    },
  );

  // ===========================================================================
  // LEARNING PATH
  // ===========================================================================

  /**
   * Get learning path to a concept
   */
  ipcMain.on(
    'graph-get-learning-path',
    async (event, targetConceptId, maxDepth, token) => {
      try {
        const result = await graphInterface.getLearningPath(
          targetConceptId,
          maxDepth,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-get-learning-path error:', error);
        event.returnValue = null;
      }
    },
  );

  /**
   * Get knowledge state at a point in time
   */
  ipcMain.on('graph-get-knowledge-at-time', async (event, asOfDate, token) => {
    try {
      const date = new Date(asOfDate);
      const result = await graphInterface.getKnowledgeAtTime(date, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-get-knowledge-at-time error:', error);
      event.returnValue = [];
    }
  });

  // ===========================================================================
  // CHAT OPERATIONS
  // ===========================================================================

  /**
   * Create a chat
   */
  ipcMain.on('graph-create-chat', async (event, chat, token) => {
    try {
      const result = await graphInterface.createChat(chat, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-create-chat error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Add message to chat
   */
  ipcMain.on('graph-add-message', async (event, message, chatId, token) => {
    try {
      const result = await graphInterface.addMessage(message, chatId, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-add-message error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Search messages by text
   */
  ipcMain.on('graph-search-messages', async (event, query, token) => {
    try {
      const result = await graphInterface.searchMessages(query, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-search-messages error:', error);
      event.returnValue = [];
    }
  });

  // ===========================================================================
  // BOOKMARK OPERATIONS
  // ===========================================================================

  /**
   * Create a bookmark
   */
  ipcMain.on('graph-create-bookmark', async (event, bookmark, token) => {
    try {
      const result = await graphInterface.createBookmark(bookmark, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-create-bookmark error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Get bookmarks by source
   */
  ipcMain.on(
    'graph-get-bookmarks-by-source',
    async (event, sourceKey, token) => {
      try {
        const result = await graphInterface.getBookmarksBySource(
          sourceKey,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-get-bookmarks-by-source error:', error);
        event.returnValue = [];
      }
    },
  );

  /**
   * Search bookmarks by text
   */
  ipcMain.on('graph-search-bookmarks', async (event, query, token) => {
    try {
      const result = await graphInterface.searchBookmarks(query, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-search-bookmarks error:', error);
      event.returnValue = [];
    }
  });

  // ===========================================================================
  // STATS
  // ===========================================================================

  /**
   * Get graph database statistics
   */
  ipcMain.on('graph-get-stats', async (event) => {
    try {
      const result = await graphInterface.getStats();
      event.returnValue = result;
    } catch (error) {
      console.error('graph-get-stats error:', error);
      event.returnValue = {};
    }
  });

  // ===========================================================================
  // LEARNING PATH FEATURES
  // ===========================================================================

  /**
   * Create concept with prerequisites
   */
  ipcMain.on(
    'graph-create-concept-with-prereqs',
    async (event, concept, prerequisiteIds, token) => {
      try {
        const result = await graphLearningFeatures.createConceptWithPrereqs(
          concept,
          prerequisiteIds,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-create-concept-with-prereqs error:', error);
        event.returnValue = null;
      }
    },
  );

  /**
   * Get personalized learning path
   */
  ipcMain.on(
    'graph-get-personalized-learning-path',
    async (event, targetConceptId, token) => {
      try {
        const result = await graphLearningFeatures.getPersonalizedLearningPath(
          targetConceptId,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-get-personalized-learning-path error:', error);
        event.returnValue = null;
      }
    },
  );

  /**
   * Get concepts that depend on a given concept
   */
  ipcMain.on(
    'graph-get-dependent-concepts',
    async (event, conceptId, token) => {
      try {
        const result = await graphLearningFeatures.getDependentConcepts(
          conceptId,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-get-dependent-concepts error:', error);
        event.returnValue = [];
      }
    },
  );

  // ===========================================================================
  // WEAK CONCEPTS DETECTION
  // ===========================================================================

  /**
   * Detect weak concepts
   */
  ipcMain.on('graph-detect-weak-concepts', async (event, token, limit) => {
    try {
      const result = await graphLearningFeatures.detectWeakConcepts(
        token,
        limit,
      );
      event.returnValue = result;
    } catch (error) {
      console.error('graph-detect-weak-concepts error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Get error-prone topics
   */
  ipcMain.on(
    'graph-get-error-prone-topics',
    async (event, token, lookbackDays) => {
      try {
        const result = await graphLearningFeatures.getErrorProneTopics(
          token,
          lookbackDays,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-get-error-prone-topics error:', error);
        event.returnValue = [];
      }
    },
  );

  // ===========================================================================
  // ENTITY RESOLUTION
  // ===========================================================================

  /**
   * Resolve related concepts
   */
  ipcMain.on('graph-resolve-related-concepts', async (event, token) => {
    try {
      const result = await graphLearningFeatures.resolveRelatedConcepts(token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-resolve-related-concepts error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Link two concepts
   */
  ipcMain.on(
    'graph-link-concepts',
    async (event, concept1Id, concept2Id, relationType, strength) => {
      try {
        const result = await graphLearningFeatures.linkConcepts(
          concept1Id,
          concept2Id,
          relationType,
          strength,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-link-concepts error:', error);
        event.returnValue = false;
      }
    },
  );

  /**
   * Extract concepts from text
   */
  ipcMain.on(
    'graph-extract-concepts-from-text',
    async (event, content, token) => {
      try {
        const result = await graphLearningFeatures.extractConceptsFromText(
          content,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-extract-concepts-from-text error:', error);
        event.returnValue = { existing: [], suggested: [] };
      }
    },
  );

  /**
   * Get concept clusters
   */
  ipcMain.on('graph-get-concept-clusters', async (event, token) => {
    try {
      const result = await graphLearningFeatures.getConceptClusters(token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-get-concept-clusters error:', error);
      event.returnValue = [];
    }
  });

  // ===========================================================================
  // MASTERY TRACKING
  // ===========================================================================

  /**
   * Update concept mastery
   */
  ipcMain.on(
    'graph-update-concept-mastery',
    async (event, conceptId, outcome, token) => {
      try {
        const result = await graphLearningFeatures.updateConceptMastery(
          conceptId,
          outcome,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-update-concept-mastery error:', error);
        event.returnValue = null;
      }
    },
  );

  /**
   * Get mastery progress over time
   */
  ipcMain.on('graph-get-mastery-progress', async (event, token, days) => {
    try {
      const result = await graphLearningFeatures.getMasteryProgress(
        token,
        days,
      );
      event.returnValue = result;
    } catch (error) {
      console.error('graph-get-mastery-progress error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Get knowledge graph data for visualization
   */
  ipcMain.on(
    'graph-get-knowledge-graph-data',
    async (event, token, centerConceptId) => {
      try {
        const result = await graphLearningFeatures.getKnowledgeGraphData(
          token,
          centerConceptId,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-get-knowledge-graph-data error:', error);
        event.returnValue = { nodes: [], edges: [] };
      }
    },
  );

  // ===========================================================================
  // EMBEDDING OPERATIONS (Graph-based semantic search)
  // ===========================================================================

  /**
   * Initialize graph embedding manager
   */
  ipcMain.on('graph-embedding-setup', async (event) => {
    try {
      await graphEmbeddingManager.setup(store);
      event.returnValue = { success: true };
    } catch (error) {
      console.error('graph-embedding-setup error:', error);
      event.returnValue = { success: false, error: error.message };
    }
  });

  /**
   * Semantic search for books
   */
  ipcMain.on('graph-semantic-search-books', async (event, query, token) => {
    try {
      const result = await graphEmbeddingManager.searchBooks(query, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-semantic-search-books error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Semantic search for notes
   */
  ipcMain.on('graph-semantic-search-notes', async (event, query, token) => {
    try {
      const result = await graphEmbeddingManager.searchNotes(query, token);
      event.returnValue = result;
    } catch (error) {
      console.error('graph-semantic-search-notes error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Get book content by semantic query
   */
  ipcMain.on(
    'graph-get-book-content-by-query',
    async (event, bookKey, bookType, query, token) => {
      try {
        const result = await graphEmbeddingManager.getBookContentByQuery(
          bookKey,
          bookType,
          query,
          token,
        );
        event.returnValue = result;
      } catch (error) {
        console.error('graph-get-book-content-by-query error:', error);
        event.returnValue = [];
      }
    },
  );

  // ===========================================================================
  // AI-POWERED CONCEPT EXTRACTION
  // ===========================================================================

  /**
   * Extract concepts from text using AI
   * Returns structured nodes, edges, and relationship suggestions
   * Note: preload wraps args in array, so we destructure from args[0]
   */
  ipcMain.handle('graph-ai-extract-concepts', async (event, args) => {
    try {
      const [text, token] = args || [];
      const result = await aiConceptExtractionService.extractConceptsWithAI(
        text,
        token,
      );
      return result;
    } catch (error) {
      console.error('graph-ai-extract-concepts error:', error);
      return { nodes: [], edges: [], entities: [] };
    }
  });

  /**
   * Extract entities with coreference resolution using AI
   */
  ipcMain.handle('graph-ai-extract-entities', async (event, args) => {
    try {
      const [text] = args || [];
      const result = await aiConceptExtractionService.extractEntitiesWithAI(text);
      return result;
    } catch (error) {
      console.error('graph-ai-extract-entities error:', error);
      return { entities: [] };
    }
  });

  /**
   * Full extraction: concepts + entities + suggestions
   * Use this for note save flow to get comprehensive extraction
   */
  ipcMain.handle('graph-ai-full-extraction', async (event, args) => {
    try {
      const [text, token] = args || [];
      const result = await aiConceptExtractionService.fullExtraction(text, token);
      return result;
    } catch (error) {
      console.error('graph-ai-full-extraction error:', error);
      return {
        nodes: [],
        edges: [],
        entities: [],
        existingConcepts: [],
        suggestions: [],
      };
    }
  });

  /**
   * Save extracted concepts to graph database
   * Called after user reviews and approves extracted concepts
   */
  ipcMain.handle('graph-ai-save-extraction', async (event, args) => {
    try {
      const [nodes, edges, sourceId, sourceType, token] = args || [];
      const result = await aiConceptExtractionService.saveToGraph(
        nodes,
        edges,
        sourceId,
        sourceType,
        token,
      );
      return result;
    } catch (error) {
      console.error('graph-ai-save-extraction error:', error);
      return { saved: 0, linked: 0, error: error.message };
    }
  });

  /**
   * Check if AI concept extraction is available
   */
  ipcMain.on('graph-ai-extraction-available', (event) => {
    event.returnValue = aiConceptExtractionService.isAvailable();
  });

  // ===========================================================================
  // KNOWLEDGE WEB - LINK OPERATIONS
  // ===========================================================================

  /**
   * Get link suggestions for autocomplete (vocabulary, concepts, notes)
   * Used when user types [[ in the editor
   */
  ipcMain.on('get-link-suggestions', async (event, args) => {
    try {
      const [query, token] = args || [];

      if (!graphInterface.isReady()) {
        event.returnValue = [];
        return;
      }

      const results = await graphInterface.searchForLinking(query || '', token, 15);
      event.returnValue = results;
    } catch (error) {
      console.error('get-link-suggestions error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Get preview data for a linked item (vocabulary, concept, note)
   * Used for hover preview popover
   */
  ipcMain.on('get-link-preview', async (event, args) => {
    try {
      const [type, id, token] = args || [];

      if (!graphInterface.isReady()) {
        event.returnValue = null;
        return;
      }

      const preview = await graphInterface.getLinkPreview(type, id, token);
      event.returnValue = preview;
    } catch (error) {
      console.error('get-link-preview error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Get backlinks for a note/vocabulary/concept
   * Returns all notes that link TO the target
   */
  ipcMain.on('get-backlinks', async (event, args) => {
    try {
      const [targetId, targetType, token] = args || [];

      if (!graphInterface.isReady()) {
        event.returnValue = [];
        return;
      }

      const backlinks = await graphInterface.getBacklinks(targetId, targetType, token);
      event.returnValue = backlinks;
    } catch (error) {
      console.error('get-backlinks error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Sync note links - update LINKS_TO relationships
   * Called when a note is saved with [[wiki-link]] references
   */
  ipcMain.handle('sync-note-links', async (event, args) => {
    try {
      const [noteId, links, token] = args || [];

      if (!graphInterface.isReady()) {
        return { success: false, error: 'Graph database not connected' };
      }

      const result = await graphInterface.syncNoteLinks(noteId, links, token);
      return result;
    } catch (error) {
      console.error('sync-note-links error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get outgoing links from a note
   * Returns all items that the note links TO
   */
  ipcMain.on('get-outgoing-links', async (event, args) => {
    try {
      const [noteId, token] = args || [];

      if (!graphInterface.isReady()) {
        event.returnValue = [];
        return;
      }

      const links = await graphInterface.getOutgoingLinks(noteId, token);
      event.returnValue = links;
    } catch (error) {
      console.error('get-outgoing-links error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Find notes with shared tags (for semantic auto-linking)
   */
  ipcMain.on('find-notes-by-shared-tags', async (event, args) => {
    try {
      const [tags, excludeNoteId, token, minSharedTags] = args || [];

      if (!graphInterface.isReady()) {
        event.returnValue = [];
        return;
      }

      const results = await graphInterface.findNotesBySharedTags(
        tags,
        excludeNoteId,
        token,
        minSharedTags || 2,
      );
      event.returnValue = results;
    } catch (error) {
      console.error('find-notes-by-shared-tags error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Find semantically similar notes
   */
  ipcMain.on('find-similar-notes', async (event, args) => {
    try {
      const [noteId, embedding, threshold, token] = args || [];

      if (!graphInterface.isReady()) {
        event.returnValue = [];
        return;
      }

      const results = await graphInterface.findSemanticallySimilarNotes(
        noteId,
        embedding,
        threshold || 0.75,
        token,
      );
      event.returnValue = results;
    } catch (error) {
      console.error('find-similar-notes error:', error);
      event.returnValue = [];
    }
  });

  console.log('Graph IPC handlers registered');
}

export default registerGraphHandlers;
