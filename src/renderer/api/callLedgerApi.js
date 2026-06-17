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
};

export default callLedgerApi;
