/**
 * ContextManager - Manages session and user context for skill execution
 *
 * Tracks:
 * - Current view and document being read
 * - Selected text
 * - Recent skill executions (for continuity)
 * - User preferences (from settings)
 *
 * Usage:
 *   const contextManager = new ContextManager();
 *
 *   // Update when user navigates
 *   contextManager.updateView(userId, { view: 'reading', documentId: '123' });
 *
 *   // Update when user selects text
 *   contextManager.updateSelection(userId, 'selected text here');
 *
 *   // Get full context for AI
 *   const context = await contextManager.getFullContext(userId, token, services);
 */

class ContextManager {
  constructor() {
    this.sessions = new Map(); // userId → SessionContext
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get or create session context for user
   * @param {string} userId
   * @returns {Object}
   */
  getSessionContext(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, this.createEmptySession(userId));
    }

    const session = this.sessions.get(userId);
    session.lastAccess = Date.now();

    return session;
  }

  /**
   * Create empty session
   * @param {string} userId
   * @returns {Object}
   */
  createEmptySession(userId) {
    return {
      userId,
      currentView: null,
      currentDocument: null,
      selectedText: null,
      conversationHistory: [],
      recentSkills: [],
      lastAccess: Date.now(),
      metadata: {},
    };
  }

  /**
   * Update current view context
   * @param {string} userId
   * @param {Object} viewInfo
   * @param {string} viewInfo.view - View name (reading, browser, notes, etc.)
   * @param {string} viewInfo.documentId - Document/book ID
   * @param {string} viewInfo.documentType - Type (epub, pdf, note, bookmark, etc.)
   * @param {string} viewInfo.title - Document title
   */
  updateView(userId, { view, documentId, documentType, title }) {
    const session = this.getSessionContext(userId);
    session.currentView = view;
    session.currentDocument = {
      id: documentId,
      type: documentType,
      title,
      openedAt: Date.now(),
    };
  }

  /**
   * Update selected text
   * @param {string} userId
   * @param {string} selectedText
   */
  updateSelection(userId, selectedText) {
    const session = this.getSessionContext(userId);
    session.selectedText = selectedText;
    session.selectionTime = Date.now();
  }

  /**
   * Clear selection
   * @param {string} userId
   */
  clearSelection(userId) {
    const session = this.getSessionContext(userId);
    session.selectedText = null;
    session.selectionTime = null;
  }

  /**
   * Add message to conversation history
   * @param {string} userId
   * @param {Object} message
   * @param {string} message.role - 'user' | 'assistant'
   * @param {string} message.content
   */
  addMessage(userId, message) {
    const session = this.getSessionContext(userId);
    session.conversationHistory.push({
      ...message,
      timestamp: Date.now(),
    });

    // Keep only last 20 messages
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-20);
    }
  }

  /**
   * Clear conversation history
   * @param {string} userId
   */
  clearConversation(userId) {
    const session = this.getSessionContext(userId);
    session.conversationHistory = [];
  }

  /**
   * Log skill execution for continuity
   * @param {string} userId
   * @param {string} skillName
   * @param {Object} params
   * @param {any} result
   */
  logSkillExecution(userId, skillName, params, result) {
    const session = this.getSessionContext(userId);

    session.recentSkills.push({
      skill: skillName,
      params: this.summarizeParams(params),
      result: this.summarizeResult(result),
      timestamp: Date.now(),
    });

    // Keep only last 10 skill executions
    if (session.recentSkills.length > 10) {
      session.recentSkills = session.recentSkills.slice(-10);
    }
  }

  /**
   * Set metadata value
   * @param {string} userId
   * @param {string} key
   * @param {any} value
   */
  setMetadata(userId, key, value) {
    const session = this.getSessionContext(userId);
    session.metadata[key] = value;
  }

  /**
   * Get metadata value
   * @param {string} userId
   * @param {string} key
   * @returns {any}
   */
  getMetadata(userId, key) {
    const session = this.getSessionContext(userId);
    return session.metadata[key];
  }

  /**
   * Build full context for skill execution
   * @param {string} userId
   * @param {string} token
   * @param {Object} services - Service references
   * @param {Object} services.aiProvider - AI provider instance
   * @param {Object} services.noteManager - Note manager
   * @param {Object} services.bookManager - Book manager
   * @param {Object} services.chromaManager - ChromaDB manager
   * @param {Object} services.graphApi - Neo4j graph API
   * @param {Object} services.customStorage - Settings storage
   * @returns {Object}
   */
  async getFullContext(userId, token, services = {}) {
    const session = this.getSessionContext(userId);
    const { customStorage } = services;

    // Get user preferences from storage
    let readerLevel = 'College';
    let studyMode = 'General';

    if (customStorage) {
      try {
        readerLevel = customStorage.getReaderLevel?.() || 'College';
        studyMode = customStorage.getStudyMode?.() || 'General';
      } catch (e) {
        console.warn('Could not get user preferences:', e);
      }
    }

    return {
      // Session context
      userId,
      token,
      currentView: session.currentView,
      currentDocument: session.currentDocument,
      selectedText: session.selectedText,
      conversationHistory: session.conversationHistory,
      recentSkills: session.recentSkills,
      metadata: session.metadata,

      // User preferences
      readerLevel,
      studyMode,

      // Service references
      aiProvider: services.aiProvider,
      noteManager: services.noteManager,
      bookManager: services.bookManager,
      chromaManager: services.chromaManager,
      graphApi: services.graphApi,
      customStorage,

      // Helper methods
      services,
    };
  }

  /**
   * Build system prompt for LLM with context
   * @param {Object} context
   * @returns {string}
   */
  buildSystemPrompt(context) {
    const parts = [
      'You are a helpful study assistant in SmartReader, an AI-powered e-reader application.',
      '',
    ];

    // Current context
    if (context.currentView) {
      parts.push(`The user is currently in: ${context.currentView} view`);
    }

    if (context.currentDocument) {
      parts.push(
        `Currently viewing: ${context.currentDocument.title || 'a document'} (${context.currentDocument.type || 'unknown type'})`,
      );
    }

    // User preferences
    if (context.readerLevel) {
      parts.push(`Reader level: ${context.readerLevel}`);
    }

    if (context.studyMode) {
      parts.push(`Study mode: ${context.studyMode}`);
    }

    // Selected text
    if (context.selectedText) {
      const preview =
        context.selectedText.length > 300
          ? context.selectedText.substring(0, 300) + '...'
          : context.selectedText;
      parts.push('');
      parts.push(`Currently selected text: "${preview}"`);
    }

    // Recent actions
    if (context.recentSkills?.length > 0) {
      parts.push('');
      parts.push('Recent actions in this session:');
      context.recentSkills.slice(-3).forEach((s) => {
        parts.push(`- Used ${s.skill}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Summarize params for logging (truncate large strings)
   * @param {Object} params
   * @returns {Object}
   */
  summarizeParams(params) {
    const result = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 100) {
        result[key] = value.substring(0, 100) + '...';
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Summarize result for logging
   * @param {any} result
   * @returns {any}
   */
  summarizeResult(result) {
    if (result === null || result === undefined) {
      return result;
    }

    const str = JSON.stringify(result);
    if (str.length > 200) {
      return { _summary: `Result with ${Object.keys(result).length} keys` };
    }

    return result;
  }

  /**
   * Clean up old sessions
   */
  cleanupSessions() {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastAccess > this.sessionTimeout) {
        this.sessions.delete(userId);
        console.log(`[ContextManager] Cleaned up session for user ${userId}`);
      }
    }
  }

  /**
   * Clear session for user
   * @param {string} userId
   */
  clearSession(userId) {
    this.sessions.delete(userId);
  }

  /**
   * Clear all sessions
   */
  clearAll() {
    this.sessions.clear();
  }

  /**
   * Get session count
   * @returns {number}
   */
  getSessionCount() {
    return this.sessions.size;
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton ContextManager instance
 * @returns {ContextManager}
 */
function getContextManager() {
  if (!instance) {
    instance = new ContextManager();

    // Setup periodic cleanup
    setInterval(() => {
      instance.cleanupSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
  return instance;
}

module.exports = {
  ContextManager,
  getContextManager,
};
