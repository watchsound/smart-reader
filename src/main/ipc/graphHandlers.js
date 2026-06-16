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
  ipcMain.handle('graph-connect', async () => {
    try {
      // Default to Kùzu - embedded database, MIT license
      const adapterType = store?.get('graph.adapterType') || 'kuzu';
      const result = await graphInterface.initialize(adapterType, store);
      return { success: result, error: null };
    } catch (error) {
      return { success: false, error: error.message };
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
  ipcMain.handle('graph-disconnect', async () => {
    try {
      await graphInterface.disconnect();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // USER OPERATIONS
  // ===========================================================================

  /**
   * Create or update user
   */
  ipcMain.handle('graph-upsert-user', async (_event, user) => {
    try {
      return await graphInterface.upsertUser(user);
    } catch (error) {
      console.error('graph-upsert-user error:', error);
      return null;
    }
  });

  // ===========================================================================
  // BOOK OPERATIONS
  // ===========================================================================

  /**
   * Create a book
   */
  ipcMain.handle('graph-create-book', async (_event, book, token) => {
    try {
      return await graphInterface.createBook(book, token);
    } catch (error) {
      console.error('graph-create-book error:', error);
      return null;
    }
  });

  /**
   * Get books for current user
   */
  ipcMain.handle('graph-get-books', async (_event, token) => {
    try {
      return await graphInterface.getBooksByUser(token);
    } catch (error) {
      console.error('graph-get-books error:', error);
      return [];
    }
  });

  // ===========================================================================
  // NOTE OPERATIONS
  // ===========================================================================

  /**
   * Create a note
   */
  ipcMain.handle('graph-create-note', async (_event, note, token) => {
    try {
      return await graphInterface.createNote(note, token);
    } catch (error) {
      console.error('graph-create-note error:', error);
      return null;
    }
  });

  /**
   * Get note by ID
   */
  ipcMain.handle('graph-get-note', async (_event, noteId, token) => {
    try {
      return await graphInterface.getNoteById(noteId, token);
    } catch (error) {
      console.error('graph-get-note error:', error);
      return null;
    }
  });

  /**
   * Get notes by source (book, URL, etc.)
   */
  ipcMain.handle(
    'graph-get-notes-by-source',
    async (_event, sourceKey, sourceType, token) => {
      try {
        return await graphInterface.getNotesBySource(
          sourceKey,
          sourceType,
          token,
        );
      } catch (error) {
        console.error('graph-get-notes-by-source error:', error);
        return [];
      }
    },
  );

  /**
   * Update a note field
   */
  ipcMain.handle(
    'graph-update-note',
    async (_event, noteId, field, value, token) => {
      try {
        return await graphInterface.updateNote(noteId, field, value, token);
      } catch (error) {
        console.error('graph-update-note error:', error);
        return -1;
      }
    },
  );

  /**
   * Delete a note
   */
  ipcMain.handle('graph-delete-note', async (_event, noteId, token) => {
    try {
      return await graphInterface.deleteNote(noteId, token);
    } catch (error) {
      console.error('graph-delete-note error:', error);
      return -1;
    }
  });

  /**
   * Search notes by text
   */
  ipcMain.handle('graph-search-notes', async (_event, query, token) => {
    try {
      return await graphInterface.searchNotes(query, token);
    } catch (error) {
      console.error('graph-search-notes error:', error);
      return [];
    }
  });

  // ===========================================================================
  // VOCABULARY OPERATIONS
  // ===========================================================================

  /**
   * Create vocabulary
   */
  ipcMain.handle('graph-create-vocabulary', async (_event, vocab, token) => {
    try {
      return await graphInterface.createVocabulary(vocab, token);
    } catch (error) {
      console.error('graph-create-vocabulary error:', error);
      return null;
    }
  });

  /**
   * Get vocabulary by word
   */
  ipcMain.handle('graph-get-vocabulary-by-word', async (_event, word, token) => {
    try {
      return await graphInterface.getVocabularyByWord(word, token);
    } catch (error) {
      console.error('graph-get-vocabulary-by-word error:', error);
      return null;
    }
  });

  // ===========================================================================
  // SPACED REPETITION (LEITNER SYSTEM)
  // ===========================================================================

  /**
   * Get items due for review
   */
  ipcMain.handle(
    'graph-get-due-for-review',
    async (_event, asOfDate, itemTypes, limit, token) => {
      try {
        const date = new Date(asOfDate);
        return await graphInterface.getDueForReview(date, itemTypes, limit, token);
      } catch (error) {
        console.error('graph-get-due-for-review error:', error);
        return [];
      }
    },
  );

  /**
   * Record a review outcome
   */
  ipcMain.handle(
    'graph-record-review',
    async (_event, itemId, itemType, outcome, leitnerSpeed, token) => {
      try {
        return await graphInterface.recordReview(
          itemId,
          itemType,
          outcome,
          leitnerSpeed,
          token,
        );
      } catch (error) {
        console.error('graph-record-review error:', error);
        return null;
      }
    },
  );

  /**
   * Add note to Leitner study
   */
  ipcMain.handle('graph-add-note-to-leitner', async (_event, noteId, token) => {
    try {
      return await graphInterface.addNoteToLeitnerStudy(noteId, token);
    } catch (error) {
      console.error('graph-add-note-to-leitner error:', error);
      return null;
    }
  });

  // ===========================================================================
  // CONCEPT OPERATIONS
  // ===========================================================================

  /**
   * Create or update concept
   */
  ipcMain.handle('graph-upsert-concept', async (_event, concept, token) => {
    try {
      return await graphInterface.upsertConcept(concept, token);
    } catch (error) {
      console.error('graph-upsert-concept error:', error);
      return null;
    }
  });

  /**
   * Create MENTIONS_CONCEPT relationship
   */
  ipcMain.handle(
    'graph-create-mentions',
    async (_event, noteId, conceptId, frequency, importance) => {
      try {
        await graphInterface.createMentionsRelationship(
          noteId,
          conceptId,
          frequency,
          importance,
        );
        return { success: true };
      } catch (error) {
        console.error('graph-create-mentions error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  // ===========================================================================
  // LEARNING SESSION OPERATIONS
  // ===========================================================================

  /**
   * Start a learning session
   */
  ipcMain.handle(
    'graph-start-session',
    async (_event, activityType, resourceType, resourceId, token) => {
      try {
        return await graphInterface.startLearningSession(
          activityType,
          resourceType,
          resourceId,
          token,
        );
      } catch (error) {
        console.error('graph-start-session error:', error);
        return null;
      }
    },
  );

  /**
   * End a learning session
   */
  ipcMain.handle('graph-end-session', async (_event, sessionId, stats, token) => {
    try {
      return await graphInterface.endLearningSession(sessionId, stats, token);
    } catch (error) {
      console.error('graph-end-session error:', error);
      return null;
    }
  });

  // ===========================================================================
  // SEMANTIC SEARCH
  // ===========================================================================

  /**
   * Store embedding for a node
   */
  ipcMain.handle(
    'graph-store-embedding',
    async (_event, nodeId, nodeType, embedding, model) => {
      try {
        await graphInterface.storeEmbedding(nodeId, nodeType, embedding, model);
        return { success: true };
      } catch (error) {
        console.error('graph-store-embedding error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Find similar nodes
   */
  ipcMain.handle(
    'graph-find-similar',
    async (_event, queryEmbedding, nodeTypes, limit, minSimilarity, token) => {
      try {
        return await graphInterface.findSimilar(
          queryEmbedding,
          nodeTypes,
          limit,
          minSimilarity,
          token,
        );
      } catch (error) {
        console.error('graph-find-similar error:', error);
        return [];
      }
    },
  );

  // ===========================================================================
  // LEARNING PATH
  // ===========================================================================

  /**
   * Get learning path to a concept
   */
  ipcMain.handle(
    'graph-get-learning-path',
    async (_event, targetConceptId, maxDepth, token) => {
      try {
        return await graphInterface.getLearningPath(
          targetConceptId,
          maxDepth,
          token,
        );
      } catch (error) {
        console.error('graph-get-learning-path error:', error);
        return null;
      }
    },
  );

  /**
   * Get knowledge state at a point in time
   */
  ipcMain.handle('graph-get-knowledge-at-time', async (_event, asOfDate, token) => {
    try {
      const date = new Date(asOfDate);
      return await graphInterface.getKnowledgeAtTime(date, token);
    } catch (error) {
      console.error('graph-get-knowledge-at-time error:', error);
      return [];
    }
  });

  // ===========================================================================
  // CHAT OPERATIONS
  // ===========================================================================

  /**
   * Create a chat
   */
  ipcMain.handle('graph-create-chat', async (_event, chat, token) => {
    try {
      return await graphInterface.createChat(chat, token);
    } catch (error) {
      console.error('graph-create-chat error:', error);
      return null;
    }
  });

  /**
   * Add message to chat
   */
  ipcMain.handle('graph-add-message', async (_event, message, chatId, token) => {
    try {
      return await graphInterface.addMessage(message, chatId, token);
    } catch (error) {
      console.error('graph-add-message error:', error);
      return null;
    }
  });

  /**
   * Search messages by text
   */
  ipcMain.handle('graph-search-messages', async (_event, query, token) => {
    try {
      return await graphInterface.searchMessages(query, token);
    } catch (error) {
      console.error('graph-search-messages error:', error);
      return [];
    }
  });

  // ===========================================================================
  // BOOKMARK OPERATIONS
  // ===========================================================================

  /**
   * Create a bookmark
   */
  ipcMain.handle('graph-create-bookmark', async (_event, bookmark, token) => {
    try {
      return await graphInterface.createBookmark(bookmark, token);
    } catch (error) {
      console.error('graph-create-bookmark error:', error);
      return null;
    }
  });

  /**
   * Get bookmarks by source
   */
  ipcMain.handle(
    'graph-get-bookmarks-by-source',
    async (_event, sourceKey, token) => {
      try {
        return await graphInterface.getBookmarksBySource(sourceKey, token);
      } catch (error) {
        console.error('graph-get-bookmarks-by-source error:', error);
        return [];
      }
    },
  );

  /**
   * Search bookmarks by text
   */
  ipcMain.handle('graph-search-bookmarks', async (_event, query, token) => {
    try {
      return await graphInterface.searchBookmarks(query, token);
    } catch (error) {
      console.error('graph-search-bookmarks error:', error);
      return [];
    }
  });

  // ===========================================================================
  // STATS
  // ===========================================================================

  /**
   * Get graph database statistics
   */
  ipcMain.handle('graph-get-stats', async () => {
    try {
      return await graphInterface.getStats();
    } catch (error) {
      console.error('graph-get-stats error:', error);
      return {};
    }
  });

  // ===========================================================================
  // LEARNING PATH FEATURES
  // ===========================================================================

  /**
   * Create concept with prerequisites
   */
  ipcMain.handle(
    'graph-create-concept-with-prereqs',
    async (_event, concept, prerequisiteIds, token) => {
      try {
        return await graphLearningFeatures.createConceptWithPrereqs(
          concept,
          prerequisiteIds,
          token,
        );
      } catch (error) {
        console.error('graph-create-concept-with-prereqs error:', error);
        return null;
      }
    },
  );

  /**
   * Get personalized learning path
   */
  ipcMain.handle(
    'graph-get-personalized-learning-path',
    async (_event, targetConceptId, token) => {
      try {
        return await graphLearningFeatures.getPersonalizedLearningPath(
          targetConceptId,
          token,
        );
      } catch (error) {
        console.error('graph-get-personalized-learning-path error:', error);
        return null;
      }
    },
  );

  /**
   * Get concepts that depend on a given concept
   */
  ipcMain.handle(
    'graph-get-dependent-concepts',
    async (_event, conceptId, token) => {
      try {
        return await graphLearningFeatures.getDependentConcepts(
          conceptId,
          token,
        );
      } catch (error) {
        console.error('graph-get-dependent-concepts error:', error);
        return [];
      }
    },
  );

  // ===========================================================================
  // WEAK CONCEPTS DETECTION
  // ===========================================================================

  /**
   * Detect weak concepts
   */
  ipcMain.handle('graph-detect-weak-concepts', async (_event, token, limit) => {
    try {
      return await graphLearningFeatures.detectWeakConcepts(token, limit);
    } catch (error) {
      console.error('graph-detect-weak-concepts error:', error);
      return [];
    }
  });

  /**
   * Get error-prone topics
   */
  ipcMain.handle(
    'graph-get-error-prone-topics',
    async (_event, token, lookbackDays) => {
      try {
        return await graphLearningFeatures.getErrorProneTopics(
          token,
          lookbackDays,
        );
      } catch (error) {
        console.error('graph-get-error-prone-topics error:', error);
        return [];
      }
    },
  );

  // ===========================================================================
  // ENTITY RESOLUTION
  // ===========================================================================

  /**
   * Resolve related concepts
   */
  ipcMain.handle('graph-resolve-related-concepts', async (_event, token) => {
    try {
      return await graphLearningFeatures.resolveRelatedConcepts(token);
    } catch (error) {
      console.error('graph-resolve-related-concepts error:', error);
      return [];
    }
  });

  /**
   * Link two concepts
   */
  ipcMain.handle(
    'graph-link-concepts',
    async (_event, concept1Id, concept2Id, relationType, strength) => {
      try {
        return await graphLearningFeatures.linkConcepts(
          concept1Id,
          concept2Id,
          relationType,
          strength,
        );
      } catch (error) {
        console.error('graph-link-concepts error:', error);
        return false;
      }
    },
  );

  /**
   * Extract concepts from text
   */
  ipcMain.handle(
    'graph-extract-concepts-from-text',
    async (_event, content, token) => {
      try {
        return await graphLearningFeatures.extractConceptsFromText(
          content,
          token,
        );
      } catch (error) {
        console.error('graph-extract-concepts-from-text error:', error);
        return { existing: [], suggested: [] };
      }
    },
  );

  /**
   * Get concept clusters
   */
  ipcMain.handle('graph-get-concept-clusters', async (_event, token) => {
    try {
      return await graphLearningFeatures.getConceptClusters(token);
    } catch (error) {
      console.error('graph-get-concept-clusters error:', error);
      return [];
    }
  });

  // ===========================================================================
  // MASTERY TRACKING
  // ===========================================================================

  /**
   * Update concept mastery
   */
  ipcMain.handle(
    'graph-update-concept-mastery',
    async (_event, conceptId, outcome, token) => {
      try {
        return await graphLearningFeatures.updateConceptMastery(
          conceptId,
          outcome,
          token,
        );
      } catch (error) {
        console.error('graph-update-concept-mastery error:', error);
        return null;
      }
    },
  );

  /**
   * Get mastery progress over time
   */
  ipcMain.handle('graph-get-mastery-progress', async (_event, token, days) => {
    try {
      return await graphLearningFeatures.getMasteryProgress(token, days);
    } catch (error) {
      console.error('graph-get-mastery-progress error:', error);
      return [];
    }
  });

  /**
   * Get knowledge graph data for visualization
   */
  ipcMain.handle(
    'graph-get-knowledge-graph-data',
    async (_event, token, centerConceptId) => {
      try {
        return await graphLearningFeatures.getKnowledgeGraphData(
          token,
          centerConceptId,
        );
      } catch (error) {
        console.error('graph-get-knowledge-graph-data error:', error);
        return { nodes: [], edges: [] };
      }
    },
  );

  // ===========================================================================
  // EMBEDDING OPERATIONS (Graph-based semantic search)
  // ===========================================================================

  /**
   * Initialize graph embedding manager
   */
  ipcMain.handle('graph-embedding-setup', async () => {
    try {
      await graphEmbeddingManager.setup(store);
      return { success: true };
    } catch (error) {
      console.error('graph-embedding-setup error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Semantic search for books
   */
  ipcMain.handle('graph-semantic-search-books', async (_event, query, token) => {
    try {
      return await graphEmbeddingManager.searchBooks(query, token);
    } catch (error) {
      console.error('graph-semantic-search-books error:', error);
      return [];
    }
  });

  /**
   * Semantic search for notes
   */
  ipcMain.handle('graph-semantic-search-notes', async (_event, query, token) => {
    try {
      return await graphEmbeddingManager.searchNotes(query, token);
    } catch (error) {
      console.error('graph-semantic-search-notes error:', error);
      return [];
    }
  });

  /**
   * Get book content by semantic query
   */
  ipcMain.handle(
    'graph-get-book-content-by-query',
    async (_event, bookKey, bookType, query, token) => {
      try {
        return await graphEmbeddingManager.getBookContentByQuery(
          bookKey,
          bookType,
          query,
          token,
        );
      } catch (error) {
        console.error('graph-get-book-content-by-query error:', error);
        return [];
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
  ipcMain.handle('get-link-suggestions', async (_event, args) => {
    try {
      const [query, token] = args || [];
      if (!graphInterface.isReady()) {
        return [];
      }
      return await graphInterface.searchForLinking(query || '', token, 15);
    } catch (error) {
      console.error('get-link-suggestions error:', error);
      return [];
    }
  });

  /**
   * Get preview data for a linked item (vocabulary, concept, note)
   * Used for hover preview popover
   */
  ipcMain.handle('get-link-preview', async (_event, args) => {
    try {
      const [type, id, token] = args || [];
      if (!graphInterface.isReady()) {
        return null;
      }
      return await graphInterface.getLinkPreview(type, id, token);
    } catch (error) {
      console.error('get-link-preview error:', error);
      return null;
    }
  });

  /**
   * Get backlinks for a note/vocabulary/concept
   * Returns all notes that link TO the target
   */
  ipcMain.handle('get-backlinks', async (_event, args) => {
    try {
      const [targetId, targetType, token] = args || [];
      if (!graphInterface.isReady()) {
        return [];
      }
      return await graphInterface.getBacklinks(targetId, targetType, token);
    } catch (error) {
      console.error('get-backlinks error:', error);
      return [];
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
  ipcMain.handle('get-outgoing-links', async (_event, args) => {
    try {
      const [noteId, token] = args || [];
      if (!graphInterface.isReady()) {
        return [];
      }
      return await graphInterface.getOutgoingLinks(noteId, token);
    } catch (error) {
      console.error('get-outgoing-links error:', error);
      return [];
    }
  });

  /**
   * Find notes with shared tags (for semantic auto-linking)
   */
  ipcMain.handle('find-notes-by-shared-tags', async (_event, args) => {
    try {
      const [tags, excludeNoteId, token, minSharedTags] = args || [];
      if (!graphInterface.isReady()) {
        return [];
      }
      return await graphInterface.findNotesBySharedTags(
        tags,
        excludeNoteId,
        token,
        minSharedTags || 2,
      );
    } catch (error) {
      console.error('find-notes-by-shared-tags error:', error);
      return [];
    }
  });

  /**
   * Find semantically similar notes
   */
  ipcMain.handle('find-similar-notes', async (_event, args) => {
    try {
      const [noteId, embedding, threshold, token] = args || [];
      if (!graphInterface.isReady()) {
        return [];
      }
      return await graphInterface.findSemanticallySimilarNotes(
        noteId,
        embedding,
        threshold || 0.75,
        token,
      );
    } catch (error) {
      console.error('find-similar-notes error:', error);
      return [];
    }
  });

  console.log('Graph IPC handlers registered');
}

export default registerGraphHandlers;
