/**
 * unifiedLearningHandlers.js
 *
 * IPC handlers for the Unified Learning Point system.
 * Provides a single API for all learning content (vocabulary, notes, learning plans).
 *
 * Now uses Neo4j as primary storage via UnifiedLearningPointManager,
 * which delegates to LearningPointService.
 */

import { ipcMain } from 'electron';
import UnifiedLearningPointManager from '../db/UnifiedLearningPointManager';

/**
 * Register all unified learning IPC handlers
 */
export function registerUnifiedLearningHandlers() {
  /**
   * Get due items from all sources
   * @param {Object} options
   * @param {string} options.token - User token
   * @param {string} options.date - ISO date string (default: now)
   * @param {number} options.limit - Max items (default: 50)
   * @param {string[]} options.itemTypes - ['vocabulary', 'note', 'plan', 'all']
   * @param {string[]} options.tags - Filter by tags
   * @param {string} options.planId - Filter by plan ID
   * @returns {{ data: UnifiedLearningPoint[], total: number, totalBySource: object }}
   */
  ipcMain.handle('unified-learning-get-due', async (event, options) => {
    try {
      const result = UnifiedLearningPointManager.getDueItems(options);
      return result;
    } catch (err) {
      console.error('unified-learning-get-due error:', err);
      return { data: [], total: 0, error: err.message };
    }
  });

  /**
   * Process a review for any item type
   * @param {Object} options
   * @param {string} options.itemId - Unified ID (e.g., "vocab_123", "note_456", "lp_789")
   * @param {number} options.rating - 1-4 (Again, Hard, Good, Easy)
   * @param {number} options.responseTime - Response time in ms
   * @param {string} options.token - User token
   * @returns {{ success: boolean, sourceType: string, newBox?: number, nextReview?: string }}
   */
  ipcMain.handle('unified-learning-process-review', async (event, options) => {
    try {
      const result = await UnifiedLearningPointManager.processReview(options);
      return result;
    } catch (err) {
      console.error('unified-learning-process-review error:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Get statistics across all learning sources
   * @param {string} token - User token
   * @returns {{ vocabulary: object, notes: object, plans: object, totalDue: number }}
   */
  ipcMain.handle('unified-learning-get-stats', async (event, token) => {
    try {
      const result = UnifiedLearningPointManager.getStats(token);
      return result;
    } catch (err) {
      console.error('unified-learning-get-stats error:', err);
      return { error: err.message };
    }
  });

  /**
   * Get a single item by unified ID
   * @param {string} itemId - Unified ID
   * @param {string} token - User token
   * @returns {UnifiedLearningPoint|null}
   */
  ipcMain.handle('unified-learning-get-item', async (event, itemId, token) => {
    try {
      const result = UnifiedLearningPointManager.getItemById(itemId, token);
      return result;
    } catch (err) {
      console.error('unified-learning-get-item error:', err);
      return null;
    }
  });

  /**
   * Sync handler for checking if unified learning is available
   * Now checks if Neo4j is connected via LearningPointService
   */
  ipcMain.on('unified-learning-available', (event) => {
    event.returnValue = UnifiedLearningPointManager.isAvailable?.() ?? true;
  });

  console.log('Unified Learning IPC handlers registered (Neo4j primary storage)');
}

export default {
  registerUnifiedLearningHandlers,
};
