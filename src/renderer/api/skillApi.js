/**
 * skillApi.js
 *
 * Renderer-side API for skill-based AI operations.
 * Provides a clean interface for components to interact with the skill system.
 *
 * Usage:
 * import skillApi from '../api/skillApi';
 *
 * // Get available skills
 * const skills = await skillApi.getAvailableSkills();
 *
 * // Execute a skill
 * const result = await skillApi.executeSkill('summarize', { text: '...' });
 *
 * // Chat with skills (AI decides which skills to use)
 * const response = await skillApi.chatWithSkills(messages);
 */

import customStorage from '../store/customStorage';

/**
 * Skill API - Renderer-side interface for skill operations
 */
class SkillApi {
  // ===========================================================================
  // SKILL REGISTRY
  // ===========================================================================

  /**
   * Get all registered skills
   * @returns {Array<{name, description, category, parameters, requiredParams}>}
   */
  getAllSkills() {
    return window.electron.ipcRenderer.sendSync('skill-list');
  }

  /**
   * Get skills available for current context
   * @param {string} token - User token (optional)
   * @returns {Array<{name, description, category, parameters, requiredParams}>}
   */
  async getAvailableSkills(token = null) {
    const t = token || customStorage.getSessionToken();
    const userId = customStorage.getUserId();
    return window.electron.ipcRenderer.invoke('skill-list-available', t, userId);
  }

  /**
   * Get tool definitions for LLM (Claude/OpenAI format)
   * @param {Object} options - { categories?: string[] }
   * @param {string} token - User token (optional)
   * @returns {Promise<Array>} Tool definitions
   */
  async getToolDefinitions(options = {}, token = null) {
    const t = token || customStorage.getSessionToken();
    const userId = customStorage.getUserId();
    return window.electron.ipcRenderer.invoke('skill-get-tools', t, userId, options);
  }

  // ===========================================================================
  // SKILL EXECUTION
  // ===========================================================================

  /**
   * Execute a single skill directly
   * @param {string} skillName - Name of the skill to execute
   * @param {Object} params - Skill parameters
   * @param {string} token - User token (optional)
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async executeSkill(skillName, params, token = null) {
    const t = token || customStorage.getSessionToken();
    const userId = customStorage.getUserId();
    return window.electron.ipcRenderer.invoke('skill-execute', skillName, params, t, userId);
  }

  /**
   * Execute multiple skills
   * @param {Array<{skill: string, params: Object}>} skillCalls - Skills to execute
   * @param {boolean} parallel - Execute in parallel (default: false)
   * @param {string} token - User token (optional)
   * @returns {Promise<{success: boolean, results?: Array, error?: string}>}
   */
  async executeMultiple(skillCalls, parallel = false, token = null) {
    const t = token || customStorage.getSessionToken();
    const userId = customStorage.getUserId();
    return window.electron.ipcRenderer.invoke('skill-execute-multiple', skillCalls, t, userId, parallel);
  }

  // ===========================================================================
  // CONTEXT MANAGEMENT
  // ===========================================================================

  /**
   * Update the current view context
   * @param {{view: string, documentId?: string, documentType?: string}} viewData
   */
  updateView(viewData) {
    const userId = customStorage.getUserId();
    return window.electron.ipcRenderer.sendSync('skill-update-view', userId, viewData);
  }

  /**
   * Update the current selection
   * @param {string} selectedText
   */
  updateSelection(selectedText) {
    const userId = customStorage.getUserId();
    return window.electron.ipcRenderer.sendSync('skill-update-selection', userId, selectedText);
  }

  /**
   * Get current context (for debugging)
   * @param {string} token - User token (optional)
   * @returns {Promise<Object>}
   */
  async getContext(token = null) {
    const t = token || customStorage.getSessionToken();
    const userId = customStorage.getUserId();
    return window.electron.ipcRenderer.invoke('skill-get-context', t, userId);
  }

  // ===========================================================================
  // AI-DIRECTED SKILL EXECUTION (AGENTIC)
  // ===========================================================================

  /**
   * Chat with skills - AI decides which skills to use
   * @param {Array<{role: 'user'|'assistant', content: string}>} messages - Conversation history
   * @param {Object} options - { maxIterations?: number }
   * @param {string} token - User token (optional)
   * @returns {Promise<{success: boolean, text: string, toolsUsed: string[], error?: string}>}
   */
  async chatWithSkills(messages, options = {}, token = null) {
    const t = token || customStorage.getSessionToken();
    const userId = customStorage.getUserId();
    return window.electron.ipcRenderer.invoke('skill-chat', messages, t, userId, options);
  }

  /**
   * Generate with tools - single turn tool use
   * @param {string} prompt - User prompt
   * @param {Object} options - { categories?: string[], maxTokens?: number }
   * @param {string} token - User token (optional)
   * @returns {Promise<{success: boolean, text: string, toolCalls: Array, error?: string}>}
   */
  async generateWithTools(prompt, options = {}, token = null) {
    const t = token || customStorage.getSessionToken();
    const userId = customStorage.getUserId();
    return window.electron.ipcRenderer.invoke('skill-generate-with-tools', prompt, t, userId, options);
  }

  // ===========================================================================
  // SKILL SYSTEM STATUS
  // ===========================================================================

  /**
   * Get skill system status
   * @returns {{initialized: boolean, skillCount: number, supportsToolUse: boolean, providerName: string}}
   */
  getStatus() {
    return window.electron.ipcRenderer.sendSync('skill-status');
  }

  /**
   * Check if AI provider supports tool use
   * @returns {boolean}
   */
  supportsToolUse() {
    return window.electron.ipcRenderer.sendSync('skill-supports-tool-use');
  }

  /**
   * Reload file-based skills from disk
   * Call this after adding new SKILL.md files
   * @returns {Promise<{success: boolean, count: number, error?: string}>}
   */
  async reloadFileBasedSkills() {
    return window.electron.ipcRenderer.invoke('skill-reload-file-based');
  }

  /**
   * Get skill system summary
   * @returns {{total: number, categories: Object, sources: {codeBased: number, fileBased: number}}}
   */
  getSummary() {
    return window.electron.ipcRenderer.sendSync('skill-summary');
  }

  // ===========================================================================
  // CONVENIENCE METHODS
  // ===========================================================================

  /**
   * Summarize text
   * @param {string} text - Text to summarize
   * @param {Object} options - { length?: 'short'|'medium'|'detailed', format?: 'paragraph'|'bullets'|'outline' }
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async summarize(text, options = {}) {
    return this.executeSkill('summarize', { text, ...options });
  }

  /**
   * Check grammar
   * @param {string} text - Text to check
   * @param {string} explanationLanguage - Language for explanations
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async checkGrammar(text, explanationLanguage = 'english') {
    return this.executeSkill('grammar_check', { text, explanationLanguage });
  }

  /**
   * Look up vocabulary
   * @param {string} word - Word to look up
   * @param {string} context - Context sentence (optional)
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async lookupVocabulary(word, context = '') {
    return this.executeSkill('vocabulary_lookup', { word, context });
  }

  /**
   * Explain a concept
   * @param {string} concept - Concept to explain
   * @param {string} context - Additional context
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async explain(concept, context = '') {
    return this.executeSkill('explain', { concept, context });
  }

  /**
   * Extract concepts from text
   * @param {string} text - Text to extract from
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async extractConcepts(text) {
    return this.executeSkill('extract_concepts', { text });
  }

  /**
   * Search notes
   * @param {string} query - Search query
   * @param {Object} options - { searchType?: 'keyword'|'semantic', limit?: number }
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async searchNotes(query, options = {}) {
    return this.executeSkill('search_notes', { query, ...options });
  }

  /**
   * Query knowledge graph
   * @param {string} queryType - Type of query
   * @param {string} conceptName - Concept name (for some query types)
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async queryGraph(queryType, conceptName = '') {
    return this.executeSkill('query_graph', { queryType, conceptName });
  }

  /**
   * Create a note
   * @param {string} content - Note content
   * @param {Object} options - { title?, sourceType?, extractConcepts?, generateTags? }
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async createNote(content, options = {}) {
    return this.executeSkill('create_note', { content, ...options });
  }
}

// Export singleton
const skillApi = new SkillApi();
export default skillApi;
