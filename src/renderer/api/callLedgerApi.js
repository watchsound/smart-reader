/**
 * callLedgerApi — renderer-side IPC client for the Brain Spine Call Ledger.
 * Mirrors `src/main/ipc/callLedgerHandlers.js`.
 *
 * Usage:
 *   import callLedgerApi from '../api/callLedgerApi';
 *
 *   // Rationale Card: fetch the ledger row that produced a given trigger
 *   const row = await callLedgerApi.rationaleByTrigger(triggerId);
 *
 *   // Economics Panel: aggregate by intent over the last 7 days
 *   const rows = await callLedgerApi.aggregateByIntent(Date.now() - 7 * 86400_000);
 */

const callLedgerApi = {
  /**
   * Fetch the most recent ledger row associated with a trigger ID.
   * @param {string} triggerId
   * @returns {Promise<import('../../main/db/CallLedgerStore').LedgerRow|null>}
   */
  rationaleByTrigger(triggerId) {
    return window.electron.ipcRenderer.invoke(
      'callLedger:rationaleByTrigger',
      triggerId,
    );
  },

  /**
   * Aggregate call cost + count grouped by intent since `sinceMs`.
   * @param {number} [sinceMs=0]
   * @returns {Promise<import('../../main/db/CallLedgerStore').AggregateRow[]>}
   */
  aggregateByIntent(sinceMs) {
    return window.electron.ipcRenderer.invoke(
      'callLedger:aggregateByIntent',
      sinceMs,
    );
  },

  /**
   * Aggregate call cost + count grouped by provider since `sinceMs`.
   * @param {number} [sinceMs=0]
   * @returns {Promise<import('../../main/db/CallLedgerStore').AggregateRow[]>}
   */
  aggregateByProvider(sinceMs) {
    return window.electron.ipcRenderer.invoke(
      'callLedger:aggregateByProvider',
      sinceMs,
    );
  },

  /**
   * Phase 15a: per-intent latency stats since `sinceMs`.
   * Returns `Array<{ intent, n, mean_ms, p50_ms, p95_ms, max_ms }>`.
   */
  latencyByIntent(sinceMs) {
    return window.electron.ipcRenderer.invoke(
      'callLedger:latencyByIntent',
      sinceMs,
    );
  },

  /**
   * Cache hit-rate per intent since `sinceMs`.
   * @param {number} [sinceMs=0]
   * @returns {Promise<Record<string, number>>}
   */
  cacheHitRateByIntent(sinceMs) {
    return window.electron.ipcRenderer.invoke(
      'callLedger:cacheHitRateByIntent',
      sinceMs,
    );
  },

  /**
   * Fetch all ledger rows sharing the same trace_id as the given call,
   * ordered by ts ASC. Falls back to [row] when trace_id is null.
   * @param {number} callId
   * @returns {Promise<import('../../main/db/CallLedgerStore').LedgerRow[]>}
   */
  tracesByCallId(callId) {
    return window.electron.ipcRenderer.invoke(
      'callLedger:tracesByCallId',
      callId,
    );
  },

  /**
   * Aggregate cost + token + call breakdown for a single Director session.
   * @param {string} traceId
   * @returns {Promise<{ traceId: string, totalCost: number, totalTokens: number, callCount: number, byIntent: Record<string, {count:number, cost:number, tokens:number}> }>}
   */
  aggregateByTraceId(traceId) {
    return window.electron.ipcRenderer.invoke(
      'callLedger:aggregateByTraceId',
      { traceId },
    );
  },

  /**
   * List distinct Director sessions (newest-first) with summary stats.
   * @param {number} [limit=20]
   * @returns {Promise<{ traceId: string, startedAt: number, endedAt: number, totalCost: number, callCount: number }[]>}
   */
  listSessionTraces(limit = 20) {
    return window.electron.ipcRenderer.invoke(
      'callLedger:listSessionTraces',
      { limit },
    );
  },

  // ── Phase 13 attribution channels ────────────────────────────────────────

  /**
   * Fetch cost-per-group bar data grouped by a lens (attention | phase | intent).
   * @param {{ lens: string, from: number, to: number, userId: number }} opts
   * @returns {Promise<import('../../main/utils/AttributionService').BarRow[]>}
   */
  attributionBars(opts) {
    return window.electron.ipcRenderer.invoke('callLedger:attributionBars', opts);
  },

  /**
   * Fetch per-event detail rows for a specific group within a lens.
   * @param {{ lens: string, groupKey: string, from: number, to: number, userId: number, limit?: number }} opts
   * @returns {Promise<import('../../main/utils/AttributionService').GroupDetail>}
   */
  attributionGroupDetail(opts) {
    return window.electron.ipcRenderer.invoke('callLedger:attributionGroupDetail', opts);
  },

  /**
   * Fetch time-series density strip data for the Attribution view sparkline.
   * @param {number} userId
   * @returns {Promise<import('../../main/db/CallLedgerStore').DensityRow[]>}
   */
  attributionDensityStrip(userId) {
    return window.electron.ipcRenderer.invoke('callLedger:attributionDensityStrip', { userId });
  },
};

export default callLedgerApi;
