/**
 * spacedRepetitionHandlers.js
 *
 * IPC handlers for the Adaptive Spaced Repetition system.
 * Provides communication between renderer and main process for SR operations.
 */

import { ipcMain } from 'electron';
import { getUserIdFromToken } from '../db/dbManager';
import SpacedRepetitionService from '../utils/SpacedRepetitionService';

const { Rating, State } = SpacedRepetitionService;

/**
 * Register all spaced repetition IPC handlers
 */
export function registerSpacedRepetitionHandlers() {
  // =========================================================================
  // REVIEW OPERATIONS
  // =========================================================================

  /**
   * Process a review for an item
   * @param {Object} data - { itemId, itemType, rating, topicId?, responseTimeMs? }
   * @param {string} token - User token
   * @returns {Object} Updated item state and next review info
   */
  ipcMain.handle('sr-process-review', async (event, data, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    const { itemId, itemType, rating, topicId, responseTimeMs } = data;

    if (!itemId || !itemType || !rating) {
      return { error: 'Missing required fields: itemId, itemType, rating' };
    }

    if (rating < 1 || rating > 4) {
      return { error: 'Rating must be between 1 and 4' };
    }

    return SpacedRepetitionService.processReview(userId, itemId, itemType, rating, {
      topicId,
      responseTimeMs,
    });
  });

  /**
   * Get or create an SR item
   * @param {Object} data - { itemId, itemType, topicId? }
   * @param {string} token - User token
   * @returns {Object} SR item data
   */
  ipcMain.handle('sr-get-item', async (event, data, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    const { itemId, itemType, topicId } = data;

    if (!itemId || !itemType) {
      return { error: 'Missing required fields: itemId, itemType' };
    }

    const item = SpacedRepetitionService.getOrCreateSRItem(
      userId,
      itemId,
      itemType,
      topicId,
    );

    if (!item) {
      return { error: 'Failed to get/create item' };
    }

    // Calculate current retrievability
    if (item.stability > 0 && item.lastReview) {
      const elapsedDays =
        (Date.now() - item.lastReview.getTime()) / (1000 * 60 * 60 * 24);
      item.retrievability = SpacedRepetitionService.calculateRetrievability(
        item.stability,
        elapsedDays,
      );
    } else {
      item.retrievability = 1;
    }

    return item;
  });

  // =========================================================================
  // QUERY OPERATIONS
  // =========================================================================

  /**
   * Get items due for review
   * @param {Object} options - { itemType?, topicId?, limit?, includeNew? }
   * @param {string} token - User token
   * @returns {Array} Due items
   */
  ipcMain.handle('sr-get-due-items', async (event, options, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    return SpacedRepetitionService.getDueItems(userId, options || {});
  });

  /**
   * Get review statistics
   * @param {Object} options - { topicId?, days? }
   * @param {string} token - User token
   * @returns {Object} Statistics
   */
  ipcMain.handle('sr-get-statistics', async (event, options, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    return SpacedRepetitionService.getReviewStatistics(userId, options || {});
  });

  /**
   * Get review forecast
   * @param {number} days - Days to forecast
   * @param {string} token - User token
   * @returns {Array} Forecast data
   */
  ipcMain.handle('sr-get-forecast', async (event, days, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    return SpacedRepetitionService.getReviewForecast(userId, days || 14);
  });

  /**
   * Calculate optimal review time for an item
   * @param {Object} data - { stability, currentRetrievability, targetRetrievability? }
   * @returns {Object} Optimal review info
   */
  ipcMain.handle('sr-calculate-optimal-time', async (event, data) => {
    const { stability, currentRetrievability, targetRetrievability } = data;

    return SpacedRepetitionService.calculateOptimalReviewTime(
      stability,
      currentRetrievability,
      targetRetrievability,
    );
  });

  // =========================================================================
  // HISTORY OPERATIONS
  // =========================================================================

  /**
   * Get review history
   * @param {Object} options - { days?, topicId?, itemType? }
   * @param {string} token - User token
   * @returns {Array} Review history records
   */
  ipcMain.handle('sr-get-review-history', async (event, options, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    return SpacedRepetitionService.getReviewHistory(userId, options || {});
  });

  /**
   * Get daily aggregated review data for calendar
   * @param {Object} options - { days?, topicId? }
   * @param {string} token - User token
   * @returns {Object} Daily aggregated data
   */
  ipcMain.handle('sr-get-daily-review-data', async (event, options, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    return SpacedRepetitionService.getDailyReviewData(userId, options || {});
  });

  // =========================================================================
  // PARAMETER OPTIMIZATION
  // =========================================================================

  /**
   * Optimize FSRS parameters for the user
   * @param {string} token - User token
   * @returns {Object} Optimized parameters
   */
  ipcMain.handle('sr-optimize-parameters', async (event, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    return SpacedRepetitionService.optimizeParameters(userId);
  });

  // =========================================================================
  // SYNC HANDLERS (for quick access)
  // =========================================================================

  /**
   * Get rating constants
   */
  ipcMain.on('sr-get-ratings', (event) => {
    event.returnValue = Rating;
  });

  /**
   * Get state constants
   */
  ipcMain.on('sr-get-states', (event) => {
    event.returnValue = State;
  });

  /**
   * Calculate retrievability (sync for quick UI updates)
   */
  ipcMain.on('sr-calculate-retrievability', (event, stability, elapsedDays) => {
    event.returnValue = SpacedRepetitionService.calculateRetrievability(
      stability,
      elapsedDays,
    );
  });

  console.log('Spaced Repetition IPC handlers registered');
}

export default { registerSpacedRepetitionHandlers };
