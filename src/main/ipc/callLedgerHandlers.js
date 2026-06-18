// src/main/ipc/callLedgerHandlers.js
/**
 * callLedgerHandlers — IPC surface for the Brain Spine Call Ledger.
 *
 * Channels:
 *   callLedger:rationaleByTrigger     triggerId → LedgerRow | null
 *   callLedger:aggregateByIntent      sinceMs   → AggregateRow[]
 *   callLedger:aggregateByProvider    sinceMs   → AggregateRow[]
 *   callLedger:cacheHitRateByIntent   sinceMs   → { [intent]: number }
 *   callLedger:attributionBars        opts      → BarRow[]       (Phase 13)
 *   callLedger:attributionGroupDetail opts      → GroupDetail    (Phase 13)
 *   callLedger:attributionDensityStrip opts     → DensityRow[]   (Phase 13)
 *
 * Used by the Rationale Card and Economics Panel on the renderer side.
 */

const { ipcMain: electronIpcMain } = require('electron');
const CallLedgerStore = require('../db/CallLedgerStore');
const AttributionService = require('../utils/AttributionService');

// Instantiated once — AttributionService is stateless (all state lives in DB).
const attribution = new AttributionService();

function registerCallLedgerHandlers(ipcMain = electronIpcMain) {
  ipcMain.handle('callLedger:rationaleByTrigger', async (_e, triggerId) => {
    return CallLedgerStore.findByTriggerId(triggerId);
  });

  ipcMain.handle('callLedger:aggregateByIntent', async (_e, sinceMs) => {
    return CallLedgerStore.aggregateByIntent(sinceMs || 0);
  });

  ipcMain.handle('callLedger:aggregateByProvider', async (_e, sinceMs) => {
    return CallLedgerStore.aggregateByProvider(sinceMs || 0);
  });

  // Phase 15a: per-intent latency stats (mean/p50/p95/max) within window.
  ipcMain.handle('callLedger:latencyByIntent', async (_e, sinceMs) => {
    return CallLedgerStore.latencyByIntent(sinceMs || 0);
  });

  ipcMain.handle('callLedger:cacheHitRateByIntent', async (_e, sinceMs) => {
    const map = CallLedgerStore.cacheHitRateByIntent(sinceMs || 0);
    return Object.fromEntries(map);
  });

  ipcMain.handle('callLedger:tracesByCallId', async (_e, callId) => {
    return CallLedgerStore.tracesByCallId(callId);
  });

  ipcMain.handle('callLedger:aggregateByTraceId', async (_e, { traceId }) =>
    CallLedgerStore.aggregateByTraceId(traceId)
  );

  ipcMain.handle('callLedger:listSessionTraces', async (_e, { limit }) =>
    CallLedgerStore.listSessionTraces({ limit })
  );

  // ── Phase 13 attribution channels ──────────────────────────────────────────
  ipcMain.handle('callLedger:attributionBars', (_e, opts) =>
    attribution.getBars(opts)
  );

  ipcMain.handle('callLedger:attributionGroupDetail', (_e, opts) =>
    attribution.getGroupDetail(opts)
  );

  ipcMain.handle('callLedger:attributionDensityStrip', (_e, opts) =>
    attribution.getDensityStrip(opts)
  );
}

module.exports = { registerCallLedgerHandlers };
