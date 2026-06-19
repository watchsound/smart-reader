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
import { getUserIdFromToken } from '../db/dbManager';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const QuestService = require('../utils/QuestService');

let registered = false;

/**
 * @param {{ triggerEmitter?: import('../brain/TriggerEmitter'), store?: object, getWebContents?: () => Electron.WebContents | null }} [services]
 */
function registerLearningPathPlannerHandlers(services = {}) {
  if (registered) {
    console.warn('[learningPathPlannerHandlers] already registered, skipping');
    return;
  }
  registered = true;

  const triggerEmitter = services.triggerEmitter || null;
  const questService = services.store ? new QuestService(services.store) : null;

  ipcMain.handle('learning-path-plan', async (_event, payload) => {
    try {
      const { goal, token } = payload || {};
      if (!goal || !goal.trim()) return { error: 'Goal is required.' };
      if (!token) return { error: 'Not authenticated.' };

      // Fetch all books for this user — diagnostic_data column is included
      // in the returned objects from BookManager.dbRowToBook via getBooksByCategory.
      const books = getBooksByCategory('', token);
      const userId = getUserIdFromToken(token);
      const resolvedUserId = userId > 0 ? userId : 1;

      const result = await learningPathPlannerService.plan(goal, books, { userId: resolvedUserId });

      // Brain-driven shell: a successful path auto-creates a Quest record
      // (so the user sees it in the Orb menu) and emits a multi-surface-flow
      // Trigger (so they can resume the walk from the Orb in any view).
      let createdQuest = null;
      if (result && !result.error && questService) {
        const pathBookIds = Array.isArray(result.pathSteps)
          ? Array.from(
              new Set(
                result.pathSteps
                  .map((s) => s?.bookId)
                  .filter((b) => typeof b === 'number'),
              ),
            )
          : [];
        // Persist the path steps in Quest metadata so the user can later
        // re-emit the walk trigger from OrbQuestMenu without re-running
        // the planner.
        const persistedSteps = Array.isArray(result.pathSteps)
          ? result.pathSteps
              .filter((s) => s && s.bookId)
              .map((s) => ({
                bookId: s.bookId,
                bookTitle: s.bookTitle || `Book ${s.bookId}`,
                reason: s.reason || '',
                chapterFocus: s.chapterFocus || null,
                estimatedHours: s.estimatedHours || null,
              }))
          : [];
        try {
          const quest = questService.create({
            name: goal.length > 60 ? `${goal.slice(0, 57)}\u2026` : goal,
            goal,
            bookIds: pathBookIds,
            metadata: {
              source: 'phase-7-learning-path',
              pathSteps: persistedSteps,
              summary: result.summary || '',
            },
            userId: resolvedUserId,
          });
          if (quest && !quest.error) {
            createdQuest = quest;
            // Broadcast quest:changed so the renderer triggerBus refreshes
            // its weighting context for this new quest's bookIds.
            try {
              const wc = services.getWebContents?.();
              if (wc) wc.send('quest:changed');
            } catch (_) {
              // best-effort
            }
          }
        } catch (e) {
          console.warn(
            '[learningPathPlannerHandlers] quest auto-create failed:',
            e?.message || e,
          );
        }
      }

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
          const triggerId = `phase7:${goal.slice(0, 80)}`;
          triggerEmitter.emit({
            id: triggerId,
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
              questId: createdQuest?.id || null,
            },
          });
          // Phase 9b: bind the ledger row to the trigger so the Rationale Card
          // can look it up via CallLedgerStore.findByTriggerId.
          try {
            if (result.callId) {
              // eslint-disable-next-line global-require
              const CallLedgerStore = require('../db/CallLedgerStore');
              CallLedgerStore.bindTriggerId(result.callId, triggerId);
            }
          } catch (e) {
            console.warn('[phase-7] bindTriggerId failed:', e?.message || e);
          }
        }
      }

      // Surface the created quest id back to the caller (CrossBookPathPanel
      // can link to it; UI tests can assert auto-creation happened).
      if (createdQuest && result && !result.error) {
        return { ...result, questId: createdQuest.id };
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
