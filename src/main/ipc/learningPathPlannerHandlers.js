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

/**
 * @param {{ triggerEmitter?: import('../brain/TriggerEmitter') }} [services]
 */
function registerLearningPathPlannerHandlers(services = {}) {
  if (registered) {
    console.warn('[learningPathPlannerHandlers] already registered, skipping');
    return;
  }
  registered = true;

  const triggerEmitter = services.triggerEmitter || null;

  ipcMain.handle('learning-path-plan', async (_event, payload) => {
    try {
      const { goal, token } = payload || {};
      if (!goal || !goal.trim()) return { error: 'Goal is required.' };
      if (!token) return { error: 'Not authenticated.' };

      // Fetch all books for this user — diagnostic_data column is included
      // in the returned objects from BookManager.dbRowToBook via getBooksByCategory.
      const books = getBooksByCategory('', token);

      const result = await learningPathPlannerService.plan(goal, books);

      // Brain-driven shell: a successful path emits a multi-surface-flow
      // Trigger so the user can resume the path from the Orb from any view.
      // Steps that lack a bookId are dropped — MultiSurfaceFlowHost navigates
      // via /reading/:bookId and a path-step with no book can't navigate.
      if (
        result &&
        !result.error &&
        triggerEmitter &&
        Array.isArray(result.pathSteps) &&
        result.pathSteps.length > 0
      ) {
        const steps = result.pathSteps
          .filter((s) => s && s.bookId)
          .map((s) => ({
            view: `reading/${s.bookId}`,
            payload: {
              label: s.bookTitle || `Book ${s.bookId}`,
              reason: s.reason || '',
              chapterFocus: s.chapterFocus || null,
              estimatedHours: s.estimatedHours || null,
            },
          }));
        if (steps.length > 0) {
          triggerEmitter.emit({
            id: `phase7:${goal.slice(0, 80)}`,
            source: 'phase-7-learning-path',
            unit: 'multi-surface-flow',
            surfaceTarget: { kind: 'flow', steps },
            priority: 'high',
            freshness: 24 * 60 * 60 * 1000, // 24h — quests are long-lived
            payload: {
              title: `Path: ${goal.slice(0, 60)}`,
              goal,
              summary: result.summary || '',
              steps,
            },
          });
        }
      }

      return result;
    } catch (err) {
      console.error('[learningPathPlannerHandlers] plan failed:', err);
      return { error: err?.message || 'Learning path planning failed.' };
    }
  });
}

export default registerLearningPathPlannerHandlers;
export { registerLearningPathPlannerHandlers };
