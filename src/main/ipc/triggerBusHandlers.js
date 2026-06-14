/**
 * IPC handlers for the renderer-side TriggerBus.
 * - brain:trigger:accept   — record acceptance; future: spawn server-side flow state
 * - brain:trigger:dismiss  — record dismissal; feed back into Brain learning
 * - brain:trigger:pull     — synthesize "what's next?" when queue empty
 */

const { ipcMain } = require('electron');

function registerTriggerBusHandlers(services = {}) {
  const { brain } = services;

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
}

module.exports = { registerTriggerBusHandlers };
