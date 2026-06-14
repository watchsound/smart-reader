/**
 * IPC handlers for the renderer-side TriggerBus.
 * - brain:trigger:accept           — record acceptance
 * - brain:trigger:dismiss          — record dismissal
 * - brain:trigger:pull             — synthesize "what's next?" when queue empty
 * - brain:trigger:queue-snapshot   — persist queue snapshot to electron-store
 * - brain:trigger:queue-restore    — restore persisted queue snapshot on bus init
 */

const { ipcMain } = require('electron');

const QUEUE_STORE_KEY = 'brainShell.queueSnapshot';

/**
 * @param {{ brain?: object, store?: object }} services
 */
function registerTriggerBusHandlers(services = {}) {
  const { brain, store } = services;

  ipcMain.handle('brain:trigger:accept', async (_evt, proposalId) => {
    if (brain?.recordProposalEvent) {
      await brain.recordProposalEvent({ proposalId, kind: 'accept' });
    }
    return { ok: true };
  });

  ipcMain.handle('brain:trigger:dismiss', async (_evt, proposalId) => {
    if (brain?.recordProposalEvent) {
      await brain.recordProposalEvent({ proposalId, kind: 'dismiss' });
    }
    return { ok: true };
  });

  ipcMain.handle('brain:trigger:pull', async () => {
    if (brain?.synthesizePullSuggestion) {
      return brain.synthesizePullSuggestion();
    }
    return null;
  });

  ipcMain.handle('brain:trigger:queue-snapshot', async (_evt, snapshot) => {
    if (!store) return { ok: false };
    try {
      store.set(QUEUE_STORE_KEY, Array.isArray(snapshot) ? snapshot : []);
      return { ok: true };
    } catch (err) {
      console.error('[triggerBusHandlers] queue-snapshot failed:', err);
      return { ok: false };
    }
  });

  ipcMain.handle('brain:trigger:queue-restore', async () => {
    if (!store) return [];
    try {
      const raw = store.get(QUEUE_STORE_KEY, []);
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.error('[triggerBusHandlers] queue-restore failed:', err);
      return [];
    }
  });
}

module.exports = { registerTriggerBusHandlers };
