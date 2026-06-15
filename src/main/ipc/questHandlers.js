/**
 * questHandlers — IPC surface for Plan 2 fork #5 (Quest layer).
 *
 * Channels:
 *   quest-create   { name, goal, bookIds?, metadata?, token } → quest | { error }
 *   quest-list     { status?, token } → quest[]
 *   quest-get      { id, token } → quest | null
 *   quest-update   { id, patch, token } → quest | null
 *   quest-pause    { id, token } → quest | null
 *   quest-resume   { id, token } → quest | null
 *   quest-archive  { id, token } → quest | null
 *   quest-progress { id, token } → { learningPointsTotal, booksStarted,
 *                                    booksTotal, pathStepsTotal }
 *
 * All userId scoping is derived from the session token (matches the
 * existing reread-queue and notification handler patterns).
 */

const { ipcMain } = require('electron');
const QuestService = require('../utils/QuestService');
const { getUserIdFromToken } = require('../db/dbManager');
const learningPointManager = require('../db/LearningPointManager');

let registered = false;
let service = null;

/**
 * @param {object} store electron-store instance
 * @param {{ getWebContents?: () => Electron.WebContents | null }} [services]
 */
function registerQuestHandlers(store, services = {}) {
  if (registered) {
    console.warn('[questHandlers] already registered, skipping');
    return;
  }
  registered = true;
  service = new QuestService(store);

  const tokenToUserId = (token) => {
    const uid = token ? getUserIdFromToken(token) : 1;
    return uid > 0 ? uid : 1;
  };

  const broadcastChanged = () => {
    try {
      const wc = services.getWebContents?.();
      if (wc) wc.send('quest:changed');
    } catch (e) {
      console.warn('[questHandlers] broadcast failed:', e?.message || e);
    }
  };

  ipcMain.handle('quest-create', (_event, payload) => {
    try {
      const { name, goal, bookIds, metadata, token } = payload || {};
      const userId = tokenToUserId(token);
      const created = service.create({ name, goal, bookIds, metadata, userId });
      if (created && !created.error) broadcastChanged();
      return created;
    } catch (err) {
      console.error('[questHandlers] create failed:', err);
      return { error: err?.message || 'create failed' };
    }
  });

  ipcMain.handle('quest-list', (_event, payload) => {
    try {
      const { status, token } = payload || {};
      const userId = tokenToUserId(token);
      return service.list({ userId, status });
    } catch (err) {
      console.error('[questHandlers] list failed:', err);
      return [];
    }
  });

  ipcMain.handle('quest-get', (_event, payload) => {
    try {
      const { id } = payload || {};
      if (!id) return null;
      return service.get(id);
    } catch (err) {
      console.error('[questHandlers] get failed:', err);
      return null;
    }
  });

  ipcMain.handle('quest-update', (_event, payload) => {
    try {
      const { id, patch } = payload || {};
      if (!id) return null;
      const updated = service.update(id, patch || {});
      if (updated) broadcastChanged();
      return updated;
    } catch (err) {
      console.error('[questHandlers] update failed:', err);
      return { error: err?.message || 'update failed' };
    }
  });

  ipcMain.handle('quest-pause', (_event, payload) => {
    try {
      const { id } = payload || {};
      if (!id) return null;
      const result = service.pause(id);
      if (result) broadcastChanged();
      return result;
    } catch (err) {
      console.error('[questHandlers] pause failed:', err);
      return null;
    }
  });

  ipcMain.handle('quest-resume', (_event, payload) => {
    try {
      const { id } = payload || {};
      if (!id) return null;
      const result = service.resume(id);
      if (result) broadcastChanged();
      return result;
    } catch (err) {
      console.error('[questHandlers] resume failed:', err);
      return null;
    }
  });

  ipcMain.handle('quest-archive', (_event, payload) => {
    try {
      const { id } = payload || {};
      if (!id) return null;
      const result = service.archive(id);
      if (result) broadcastChanged();
      return result;
    } catch (err) {
      console.error('[questHandlers] archive failed:', err);
      return null;
    }
  });

  // Lightweight progress snapshot for the OrbQuestMenu. Aggregates a single
  // SQLite COUNT against the Quest's bookIds. Episode-level engagement
  // (Phase 2) lives in the graph backend and is not aggregated here yet —
  // a Quest's learning-point count is a directional signal that "the user
  // is doing work in these books." Path-step total comes from Phase 7's
  // persisted metadata.pathSteps; completion tracking would require
  // walk-step marking, which we don't have yet, so we only return total.
  ipcMain.handle('quest-progress', (_event, payload) => {
    try {
      const { id, token } = payload || {};
      if (!id) return null;
      const quest = service.get(id);
      if (!quest) return null;
      const bookIds = Array.isArray(quest.bookIds) ? quest.bookIds : [];
      const counts = learningPointManager.countByBookIds(bookIds, token);
      const pathSteps = Array.isArray(quest.metadata?.pathSteps)
        ? quest.metadata.pathSteps
        : [];
      return {
        questId: id,
        learningPointsTotal: counts.total,
        booksStarted: counts.booksStarted,
        booksTotal: bookIds.length,
        pathStepsTotal: pathSteps.length,
      };
    } catch (err) {
      console.error('[questHandlers] progress failed:', err);
      return null;
    }
  });
}

module.exports = { registerQuestHandlers };
