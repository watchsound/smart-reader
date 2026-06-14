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
 *
 * All userId scoping is derived from the session token (matches the
 * existing reread-queue and notification handler patterns).
 *
 * Brain weighting + renderer UI (Orb right-click menu, Quest progress
 * panel) are deferred to Plan 3.
 */

const { ipcMain } = require('electron');
const QuestService = require('../utils/QuestService');
const { getUserIdFromToken } = require('../db/dbManager');

let registered = false;
let service = null;

function registerQuestHandlers(store) {
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

  ipcMain.handle('quest-create', (_event, payload) => {
    try {
      const { name, goal, bookIds, metadata, token } = payload || {};
      const userId = tokenToUserId(token);
      return service.create({ name, goal, bookIds, metadata, userId });
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
      return service.update(id, patch || {});
    } catch (err) {
      console.error('[questHandlers] update failed:', err);
      return { error: err?.message || 'update failed' };
    }
  });

  ipcMain.handle('quest-pause', (_event, payload) => {
    try {
      const { id } = payload || {};
      if (!id) return null;
      return service.pause(id);
    } catch (err) {
      console.error('[questHandlers] pause failed:', err);
      return null;
    }
  });

  ipcMain.handle('quest-resume', (_event, payload) => {
    try {
      const { id } = payload || {};
      if (!id) return null;
      return service.resume(id);
    } catch (err) {
      console.error('[questHandlers] resume failed:', err);
      return null;
    }
  });

  ipcMain.handle('quest-archive', (_event, payload) => {
    try {
      const { id } = payload || {};
      if (!id) return null;
      return service.archive(id);
    } catch (err) {
      console.error('[questHandlers] archive failed:', err);
      return null;
    }
  });
}

module.exports = { registerQuestHandlers };
