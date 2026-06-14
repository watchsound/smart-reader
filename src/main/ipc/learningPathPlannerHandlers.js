/**
 * learningPathPlannerHandlers — IPC surface for Phase 7 cross-book curriculum planner.
 *
 * Channels:
 *   learning-path-plan  (invoke)
 *     Payload: { goal: string, token: string }
 *     Returns: { summary, pathSteps, coverageGaps, analyzedCount, totalBooks } or { error }
 *
 * The handler fetches all user books from SQLite (including their cached
 * diagnostic_data from Phase 5), then delegates to LearningPathPlannerService
 * for the AI call and sequencing logic.
 */

import { ipcMain } from 'electron';
import learningPathPlannerService from '../utils/LearningPathPlannerService';
import { getBooksByCategory } from '../db/BookManager';

let registered = false;

function registerLearningPathPlannerHandlers() {
  if (registered) {
    console.warn('[learningPathPlannerHandlers] already registered, skipping');
    return;
  }
  registered = true;

  ipcMain.handle('learning-path-plan', async (_event, payload) => {
    try {
      const { goal, token } = payload || {};
      if (!goal || !goal.trim()) return { error: 'Goal is required.' };
      if (!token) return { error: 'Not authenticated.' };

      // Fetch all books for this user — diagnostic_data column is included
      // in the returned objects from BookManager.dbRowToBook via getBooksByCategory.
      const books = getBooksByCategory('', token);

      return await learningPathPlannerService.plan(goal, books);
    } catch (err) {
      console.error('[learningPathPlannerHandlers] plan failed:', err);
      return { error: err?.message || 'Learning path planning failed.' };
    }
  });
}

export default registerLearningPathPlannerHandlers;
export { registerLearningPathPlannerHandlers };
