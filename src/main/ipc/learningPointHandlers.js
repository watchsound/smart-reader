/**
 * learningPointHandlers.js
 *
 * IPC handlers for unified learning point operations.
 * Uses LearningPointService which delegates to GraphInterface (Neo4j primary storage).
 *
 * This replaces the previous SQLite-based LearningPointManager implementation
 * to use Neo4j as the primary storage via the GraphInterface abstraction layer.
 *
 * Naming convention: lp-{operation}
 * Example: lp-create, lp-get-due, lp-process-review
 */

import { ipcMain } from 'electron';
import learningPointService, {
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  SOURCE_TYPES,
  RATINGS,
  BOX_INTERVALS,
} from '../utils/LearningPointService';

/**
 * Register all learning point IPC handlers
 * @param {Object} store - electron-store instance
 * @param {Object} services - Service instances (episodeCollector, etc.)
 */
export function registerLearningPointHandlers(store, services = {}) {
  // Set episode collector if provided
  if (services.episodeCollector) {
    learningPointService.setEpisodeCollector(services.episodeCollector);
  }

  // ===========================================================================
  // STATUS & CONSTANTS
  // ===========================================================================

  /**
   * Check if learning point service is available
   * @channel lp-status
   */
  ipcMain.on('lp-status', (event) => {
    event.returnValue = {
      available: learningPointService.isAvailable(),
      constants: {
        itemTypes: ITEM_TYPES,
        domainTypes: DOMAIN_TYPES,
        difficultyLevels: DIFFICULTY_LEVELS,
        sourceTypes: SOURCE_TYPES,
        ratings: RATINGS,
        boxIntervals: BOX_INTERVALS,
      },
    };
  });

  /**
   * Get available item types
   * @channel lp-get-item-types
   */
  ipcMain.on('lp-get-item-types', (event) => {
    event.returnValue = ITEM_TYPES;
  });

  /**
   * Get available domain types
   * @channel lp-get-domain-types
   */
  ipcMain.on('lp-get-domain-types', (event) => {
    event.returnValue = DOMAIN_TYPES;
  });

  /**
   * Get available difficulty levels
   * @channel lp-get-difficulty-levels
   */
  ipcMain.on('lp-get-difficulty-levels', (event) => {
    event.returnValue = DIFFICULTY_LEVELS;
  });

  /**
   * Get available source types
   * @channel lp-get-source-types
   */
  ipcMain.on('lp-get-source-types', (event) => {
    event.returnValue = SOURCE_TYPES;
  });

  // ===========================================================================
  // CRUD OPERATIONS
  // ===========================================================================

  /**
   * Create a new learning point
   * @channel lp-create
   */
  ipcMain.handle('lp-create', async (event, point, token) => {
    try {
      const result = await learningPointService.createLearningPoint(point, token);
      return result;
    } catch (error) {
      console.error('lp-create error:', error);
      return { error: error.message };
    }
  });

  /**
   * Create multiple learning points in batch
   * @channel lp-create-batch
   */
  ipcMain.handle('lp-create-batch', async (event, points, token) => {
    try {
      const result = await learningPointService.createLearningPointsBatch(points, token);
      return result;
    } catch (error) {
      console.error('lp-create-batch error:', error);
      return { error: error.message };
    }
  });

  /**
   * Get a learning point by ID
   * @channel lp-get
   */
  ipcMain.handle('lp-get', async (event, id, token) => {
    try {
      const result = await learningPointService.getLearningPointById(id, token);
      return result;
    } catch (error) {
      console.error('lp-get error:', error);
      return null;
    }
  });

  /**
   * Update a learning point
   * @channel lp-update
   */
  ipcMain.handle('lp-update', async (event, id, updates, token) => {
    try {
      const result = await learningPointService.updateLearningPoint(id, updates, token);
      return result;
    } catch (error) {
      console.error('lp-update error:', error);
      return { error: error.message };
    }
  });

  /**
   * Delete a learning point
   * @channel lp-delete
   */
  ipcMain.handle('lp-delete', async (event, id, token, hard = false) => {
    try {
      const result = await learningPointService.deleteLearningPoint(id, token, hard);
      return { success: result };
    } catch (error) {
      console.error('lp-delete error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // QUERY OPERATIONS
  // ===========================================================================

  /**
   * Get items due for review
   * @channel lp-get-due
   * @param {Object} options - { token, date, limit, itemTypes, domainTypes, tags, planId }
   */
  ipcMain.handle('lp-get-due', async (event, options) => {
    try {
      const result = await learningPointService.getDueForReview(options);
      return result;
    } catch (error) {
      console.error('lp-get-due error:', error);
      return [];
    }
  });

  /**
   * Get learning points by source
   * @channel lp-get-by-source
   */
  ipcMain.handle('lp-get-by-source', async (event, sourceType, sourceId, token) => {
    try {
      const result = await learningPointService.getBySource(sourceType, sourceId, token);
      return result;
    } catch (error) {
      console.error('lp-get-by-source error:', error);
      return [];
    }
  });

  /**
   * Get learning points by plan
   * @channel lp-get-by-plan
   */
  ipcMain.handle('lp-get-by-plan', async (event, planId, token) => {
    try {
      const result = await learningPointService.getByPlan(planId, token);
      return result;
    } catch (error) {
      console.error('lp-get-by-plan error:', error);
      return [];
    }
  });

  /**
   * Search learning points
   * @channel lp-search
   * @param {string} query - Search query
   * @param {string} token - User token
   * @param {Object} options - { itemTypes, domainTypes, tags, limit }
   */
  ipcMain.handle('lp-search', async (event, query, token, options = {}) => {
    try {
      const result = await learningPointService.search(query, token, options);
      return result;
    } catch (error) {
      console.error('lp-search error:', error);
      return [];
    }
  });

  /**
   * Get all learning points (paginated)
   * @channel lp-get-all
   * @param {string} token - User token
   * @param {Object} options - { limit, offset, itemTypes, domainTypes }
   */
  ipcMain.handle('lp-get-all', async (event, token, options = {}) => {
    try {
      const result = await learningPointService.getAll(token, options);
      return result;
    } catch (error) {
      console.error('lp-get-all error:', error);
      return [];
    }
  });

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get learning statistics
   * @channel lp-get-stats
   * @param {string} token - User token
   * @param {Object} options - { itemTypes, domainTypes, planId }
   */
  ipcMain.handle('lp-get-stats', async (event, token, options = {}) => {
    try {
      const result = await learningPointService.getStats(token, options);
      return result;
    } catch (error) {
      console.error('lp-get-stats error:', error);
      return { error: error.message };
    }
  });

  /**
   * Get daily review forecast
   * @channel lp-get-forecast
   * @param {string} token - User token
   * @param {number} days - Number of days to forecast
   */
  ipcMain.handle('lp-get-forecast', async (event, token, days = 14) => {
    try {
      const result = await learningPointService.getForecast(token, days);
      return result;
    } catch (error) {
      console.error('lp-get-forecast error:', error);
      return [];
    }
  });

  // ===========================================================================
  // SPACED REPETITION OPERATIONS
  // ===========================================================================

  /**
   * Process a review and update SR state
   * @channel lp-process-review
   * @param {string} id - Learning point ID
   * @param {number} rating - Rating (1=Again, 2=Hard, 3=Good, 4=Easy)
   * @param {number} responseTimeMs - Response time in ms
   * @param {string} token - User token
   */
  ipcMain.handle('lp-process-review', async (event, id, rating, responseTimeMs, token) => {
    try {
      const result = await learningPointService.processReview(
        id,
        rating,
        responseTimeMs,
        token
      );
      return result;
    } catch (error) {
      console.error('lp-process-review error:', error);
      return { error: error.message };
    }
  });

  /**
   * Reset a learning point to box 1
   * @channel lp-reset
   */
  ipcMain.handle('lp-reset', async (event, id, token) => {
    try {
      const result = await learningPointService.reset(id, token);
      return { success: result };
    } catch (error) {
      console.error('lp-reset error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // MIGRATION HELPERS
  // ===========================================================================

  /**
   * Convert vocabulary item to learning point format
   * Useful for migration preview
   * @channel lp-convert-vocabulary
   */
  ipcMain.on('lp-convert-vocabulary', (event, vocab, leitnerItem) => {
    try {
      const result = learningPointService.convertFromVocabulary(vocab, leitnerItem);
      event.returnValue = result;
    } catch (error) {
      console.error('lp-convert-vocabulary error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Convert note to learning point format
   * Useful for migration preview
   * @channel lp-convert-note
   */
  ipcMain.on('lp-convert-note', (event, note, leitnerItem) => {
    try {
      const result = learningPointService.convertFromNote(note, leitnerItem);
      event.returnValue = result;
    } catch (error) {
      console.error('lp-convert-note error:', error);
      event.returnValue = null;
    }
  });

  /**
   * Convert plan point to learning point format
   * @channel lp-convert-plan-point
   */
  ipcMain.on('lp-convert-plan-point', (event, planPoint, planId) => {
    try {
      const result = learningPointService.convertFromPlanPoint(planPoint, planId);
      event.returnValue = result;
    } catch (error) {
      console.error('lp-convert-plan-point error:', error);
      event.returnValue = null;
    }
  });

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate a learning point without saving
   * @channel lp-validate
   */
  ipcMain.on('lp-validate', (event, point) => {
    try {
      const result = learningPointService.validateLearningPoint(point);
      event.returnValue = result;
    } catch (error) {
      console.error('lp-validate error:', error);
      event.returnValue = { valid: false, errors: [error.message] };
    }
  });

  console.log('Learning point IPC handlers registered (Neo4j primary storage)');
}

export default registerLearningPointHandlers;
