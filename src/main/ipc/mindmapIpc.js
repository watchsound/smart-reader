/**
 * mindmapIpc — IPC surface for the mindmap LP persistence layer (Commit 5).
 *
 * Channels:
 *   mindmap:save-as-learning-points (invoke) — idempotent batch save of
 *     mindmap nodes as learning points; writes the (mindmapId, nodeId) ->
 *     lpId rows that back reopen hydration.
 *   mindmap:mastery-snapshot (invoke) — bulk fetch of masteryLevel for a
 *     list of lpIds, returned as { [lpId]: masteryLevel }.
 */

import { ipcMain } from 'electron';
import { getDb } from '../db/dbManager';
import * as learningPointManager from '../db/LearningPointManager';
import * as mindmapJsonManager from '../db/MindmapJsonManager';

// Service is CommonJS; ESM-side default-import not needed because we
// reach via require() within main.ts/IPC contexts that already mix both.
// eslint-disable-next-line global-require
const MindmapPersistenceService = require('../utils/MindmapPersistenceService');

let registered = false;
let svc = null;

function registerMindmapIpc() {
  if (registered) {
    console.warn('[mindmapIpc] already registered, skipping');
    return;
  }
  registered = true;
  svc = new MindmapPersistenceService({
    db: getDb(),
    learningPointService: learningPointManager,
  });

  ipcMain.handle('mindmap:save-as-learning-points', async (_e, payload) => {
    try {
      const { mindmapId, bookId, nodes, token } = payload || {};
      return await svc.saveAsLearningPoints({
        mindmapId,
        bookId,
        nodes,
        token,
      });
    } catch (err) {
      console.error('[mindmapIpc] save-as-learning-points failed:', err);
      return { error: err?.message || 'save failed' };
    }
  });

  ipcMain.handle('mindmap:mastery-snapshot', async (_e, payload) => {
    try {
      const { lpIds, token } = payload || {};
      return await svc.getMasterySnapshot(lpIds, token);
    } catch (err) {
      console.error('[mindmapIpc] mastery-snapshot failed:', err);
      return {};
    }
  });

  ipcMain.handle('mindmap:save', (_e, payload) => {
    try {
      const { title, query, data, token } = payload || {};
      return mindmapJsonManager.saveMindmap({ title, query, data }, token);
    } catch (err) {
      console.error('[mindmapIpc] save failed:', err);
      return null;
    }
  });

  ipcMain.handle('mindmap:list', (_e, payload) => {
    try {
      const { token } = payload || {};
      return mindmapJsonManager.listMindmaps(token);
    } catch (err) {
      console.error('[mindmapIpc] list failed:', err);
      return [];
    }
  });

  ipcMain.handle('mindmap:get', (_e, payload) => {
    try {
      const { id, token } = payload || {};
      return mindmapJsonManager.getMindmap(id, token);
    } catch (err) {
      console.error('[mindmapIpc] get failed:', err);
      return null;
    }
  });

  ipcMain.handle('mindmap:delete', (_e, payload) => {
    try {
      const { id, token } = payload || {};
      return mindmapJsonManager.deleteMindmap(id, token);
    } catch (err) {
      console.error('[mindmapIpc] delete failed:', err);
      return -1;
    }
  });
}

export { registerMindmapIpc };
export default registerMindmapIpc;
