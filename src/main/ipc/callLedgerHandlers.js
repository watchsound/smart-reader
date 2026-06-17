// src/main/ipc/callLedgerHandlers.js
/**
 * callLedgerHandlers — IPC surface for the Brain Spine Call Ledger.
 *
 * Channels:
 *   callLedger:rationaleByTrigger   triggerId → LedgerRow | null
 *   callLedger:aggregateByIntent    sinceMs   → AggregateRow[]
 *   callLedger:aggregateByProvider  sinceMs   → AggregateRow[]
 *   callLedger:cacheHitRateByIntent sinceMs   → { [intent]: number }
 *
 * Used by the Rationale Card and Economics Panel on the renderer side.
 */

const { ipcMain } = require('electron');
const CallLedgerStore = require('../db/CallLedgerStore');

function registerCallLedgerHandlers() {
  ipcMain.handle('callLedger:rationaleByTrigger', async (_e, triggerId) => {
    return CallLedgerStore.findByTriggerId(triggerId);
  });

  ipcMain.handle('callLedger:aggregateByIntent', async (_e, sinceMs) => {
    return CallLedgerStore.aggregateByIntent(sinceMs || 0);
  });

  ipcMain.handle('callLedger:aggregateByProvider', async (_e, sinceMs) => {
    return CallLedgerStore.aggregateByProvider(sinceMs || 0);
  });

  ipcMain.handle('callLedger:cacheHitRateByIntent', async (_e, sinceMs) => {
    const map = CallLedgerStore.cacheHitRateByIntent(sinceMs || 0);
    return Object.fromEntries(map);
  });

  ipcMain.handle('callLedger:tracesByCallId', async (_e, callId) => {
    return CallLedgerStore.tracesByCallId(callId);
  });
}

module.exports = { registerCallLedgerHandlers };
