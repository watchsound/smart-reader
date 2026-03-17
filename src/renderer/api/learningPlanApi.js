/**
 * learningPlanApi.js
 *
 * Renderer-side API for Learning Plan operations
 * Provides a clean interface for components to interact with the main process
 */

const learningPlanApi = {
  /**
   * Create a new learning plan
   * @param {Object} planData - Complete plan data from wizard
   * @returns {Promise<{success: boolean, plan?: Object, error?: string}>}
   */
  async createPlan(planData) {
    return window.electron.ipcRenderer.invoke('learning-plan-create', planData);
  },

  /**
   * Calculate plan schedule without creating
   * @param {Object} params - Calculation parameters
   * @param {number} params.totalItems - Number of learning items
   * @param {number} params.dailyMinutes - Daily study time in minutes
   * @param {string} [params.targetDate] - Optional target completion date
   * @param {string} params.domain - Learning domain
   * @param {string} [params.algorithm='leitner'] - Algorithm type
   * @returns {Promise<{success: boolean, plan?: Object, error?: string}>}
   */
  async calculatePlan(params) {
    return window.electron.ipcRenderer.invoke('learning-plan-calculate', params);
  },

  /**
   * Import learning points from a file
   * @param {Object} params - Import parameters
   * @param {string} params.filePath - Path to the file
   * @param {string} params.fileType - File type (csv, json, txt, xlsx)
   * @param {string} params.domain - Learning domain
   * @param {Object} [params.columnMapping] - Column mapping for CSV/Excel
   * @returns {Promise<{success: boolean, items?: Array, columns?: Array, error?: string}>}
   */
  async importFromFile(params) {
    return window.electron.ipcRenderer.invoke('learning-point-import-file', params);
  },

  /**
   * Extract learning points from a book
   * @param {Object} params - Extraction parameters
   * @param {string} params.bookId - Book ID
   * @param {string} params.domain - Learning domain
   * @returns {Promise<{success: boolean, items?: Array, error?: string}>}
   */
  async extractFromBook(params) {
    return window.electron.ipcRenderer.invoke('learning-point-extract-from-book', params);
  },

  /**
   * Load learning points from a vocabulary set
   * @param {Object} params - Parameters
   * @param {string} params.setId - Vocabulary set ID
   * @returns {Promise<{success: boolean, items?: Array, error?: string}>}
   */
  async loadFromVocabulary(params) {
    return window.electron.ipcRenderer.invoke('learning-point-from-vocabulary', params);
  },

  /**
   * Import learning points from a URL
   * @param {Object} params - Import parameters
   * @param {string} params.url - Source URL
   * @param {string} params.domain - Learning domain
   * @returns {Promise<{success: boolean, items?: Array, error?: string}>}
   */
  async importFromUrl(params) {
    return window.electron.ipcRenderer.invoke('learning-point-import-url', params);
  },

  /**
   * Get all learning plans
   * @param {Object} [params] - Query parameters
   * @param {string} [params.status] - Filter by status
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=20] - Items per page
   * @returns {Promise<{success: boolean, plans?: Array, error?: string}>}
   */
  async listPlans(params) {
    return window.electron.ipcRenderer.invoke('learning-plan-list', params);
  },

  /**
   * Get a single learning plan with details
   * @param {string} planId - Plan ID
   * @returns {Promise<{success: boolean, plan?: Object, error?: string}>}
   */
  async getPlan(planId) {
    return window.electron.ipcRenderer.invoke('learning-plan-get', planId);
  },

  /**
   * Get items due for review
   * @param {Object} [params] - Query parameters
   * @param {string} [params.planId] - Optional plan ID to filter
   * @param {number} [params.limit=20] - Maximum items to return
   * @returns {Promise<{success: boolean, items?: Array, error?: string}>}
   */
  async getDueItems(params) {
    return window.electron.ipcRenderer.invoke('learning-plan-get-due', params);
  },

  /**
   * Record a review result
   * @param {Object} params - Review parameters
   * @param {string} params.planId - Plan ID
   * @param {string} params.pointId - Learning point ID
   * @param {boolean} params.correct - Whether answer was correct
   * @param {number} [params.responseTime] - Response time in ms
   * @returns {Promise<{success: boolean, result?: Object, error?: string}>}
   */
  async recordReview(params) {
    return window.electron.ipcRenderer.invoke('learning-plan-record-review', params);
  },

  /**
   * Toggle plan status (pause/resume)
   * @param {Object} params - Status parameters
   * @param {string} params.planId - Plan ID
   * @param {string} params.status - New status ('active', 'paused', 'completed')
   * @returns {Promise<{success: boolean, status?: string, error?: string}>}
   */
  async togglePlanStatus(params) {
    return window.electron.ipcRenderer.invoke('learning-plan-toggle-status', params);
  },

  /**
   * Delete a learning plan
   * @param {string} planId - Plan ID to delete
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deletePlan(planId) {
    return window.electron.ipcRenderer.invoke('learning-plan-delete', planId);
  },

  /**
   * Get available vocabulary sets
   * @returns {Promise<Array>}
   */
  async getVocabularySets() {
    return window.electron.ipcRenderer.invoke('vocabulary-get-sets');
  },

  // ============================================
  // Study Session API Methods
  // ============================================

  /**
   * Start a new study session
   * @param {Object} params - Session parameters
   * @param {string} params.planId - Plan ID
   * @param {string} params.mode - Session mode
   * @param {number} params.itemCount - Number of items
   * @returns {Promise<{success: boolean, sessionId?: string, error?: string}>}
   */
  async startSession(params) {
    return window.electron.ipcRenderer.invoke('study-session-start', params);
  },

  /**
   * Complete a study session
   * @param {Object} params - Completion parameters
   * @param {string} params.planId - Plan ID
   * @param {string} params.sessionId - Session ID
   * @param {Object} params.stats - Session statistics
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async completeSession(params) {
    return window.electron.ipcRenderer.invoke('study-session-complete', params);
  },

  /**
   * Get session history
   * @param {Object} params - Query parameters
   * @param {string} [params.planId] - Optional plan ID filter
   * @param {number} [params.limit=10] - Number of sessions to return
   * @returns {Promise<{success: boolean, sessions?: Array, error?: string}>}
   */
  async getSessionHistory(params) {
    return window.electron.ipcRenderer.invoke('study-session-history', params);
  },

  /**
   * Get daily review data for calendar
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (ISO)
   * @param {string} params.endDate - End date (ISO)
   * @param {string} [params.planId] - Optional plan ID filter
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async getDailyReviewData(params) {
    return window.electron.ipcRenderer.invoke('learning-plan-daily-data', params);
  },

  /**
   * Get forecast for upcoming reviews
   * @param {Object} params - Query parameters
   * @param {number} [params.days=7] - Number of days to forecast
   * @param {string} [params.planId] - Optional plan ID filter
   * @returns {Promise<{success: boolean, forecast?: Array, error?: string}>}
   */
  async getForecast(params) {
    return window.electron.ipcRenderer.invoke('learning-plan-forecast', params);
  },
};

export default learningPlanApi;
