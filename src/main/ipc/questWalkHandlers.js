/**
 * questWalkHandlers — Plan 4: re-emit a Quest's stored path as a
 * multi-surface-flow Trigger so the user can resume the walk from any
 * surface (OrbQuestMenu).
 *
 * Channel:
 *   quest-walk  { questId } → { ok: boolean, error?: string }
 *
 * The Quest must have been auto-created by Phase 7 (carries
 * `metadata.source === 'phase-7-learning-path'` and `metadata.pathSteps`).
 * Walks for non-Phase-7 quests are rejected — Plan 5 may add a
 * deterministic "open each book in order" fallback.
 */

const { ipcMain } = require('electron');
const QuestService = require('../utils/QuestService');

let registered = false;

/**
 * @param {object} store electron-store instance
 * @param {{ triggerEmitter?: import('../brain/TriggerEmitter') }} [services]
 */
function registerQuestWalkHandlers(store, services = {}) {
  if (registered) {
    console.warn('[questWalkHandlers] already registered, skipping');
    return;
  }
  registered = true;

  const service = new QuestService(store);
  const triggerEmitter = services.triggerEmitter || null;

  ipcMain.handle('quest-walk', async (_evt, payload) => {
    try {
      const { questId } = payload || {};
      if (!questId) return { ok: false, error: 'questId required' };
      if (!triggerEmitter) {
        return { ok: false, error: 'trigger emitter unavailable' };
      }

      const quest = service.get(questId);
      if (!quest) return { ok: false, error: 'quest not found' };
      if (quest.metadata?.source !== 'phase-7-learning-path') {
        return {
          ok: false,
          error: 'walk only supported for phase-7 quests',
        };
      }
      const steps = Array.isArray(quest.metadata?.pathSteps)
        ? quest.metadata.pathSteps
        : [];
      const flowSteps = steps
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
      if (flowSteps.length === 0) {
        return { ok: false, error: 'quest has no walkable steps' };
      }

      triggerEmitter.emit({
        id: `phase7:walk:${questId}`,
        source: 'phase-7-learning-path',
        unit: 'multi-surface-flow',
        surfaceTarget: { kind: 'flow', steps: flowSteps },
        priority: 'high',
        freshness: 24 * 60 * 60 * 1000,
        payload: {
          title: `Resume: ${quest.name}`,
          goal: quest.goal,
          summary: quest.metadata?.summary || '',
          steps: flowSteps,
          questId,
        },
      });
      return { ok: true };
    } catch (err) {
      console.error('[questWalkHandlers] walk failed:', err);
      return { ok: false, error: err?.message || 'walk failed' };
    }
  });
}

module.exports = { registerQuestWalkHandlers };
