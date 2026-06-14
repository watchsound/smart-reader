/**
 * enrichmentApi — renderer-side client for the Phase 3d batch enrichment
 * service.
 *
 * Typical UI flow:
 *   const { eligible, total } = await enrichmentApi.getEligibleCount(token);
 *   if (eligible > 0 && userConfirmed) {
 *     // start the run in the background; don't await
 *     enrichmentApi.run(token, { throttleMs: 200 });
 *     // poll progress for the spinner / progress bar
 *     const id = setInterval(() => {
 *       const progress = enrichmentApi.getProgress();
 *       updateUi(progress);
 *       if (progress?.finishedAt) clearInterval(id);
 *     }, 1000);
 *   }
 */

const { ipcRenderer } = window.electron || {};

const enrichmentApi = {
  /**
   * Count how many learning points need enrichment.
   * @param {string} token
   * @param {Object} [options] — forwarded to the service
   * @returns {Promise<{ total: number, eligible: number, error?: string }>}
   */
  async getEligibleCount(token, options) {
    return ipcRenderer?.invoke(
      'enrichment-eligible-count',
      token,
      options || {},
    );
  },

  /**
   * Run a full enrichment pass. Returns when the run completes (or is
   * cancelled). The renderer should `getProgress()` periodically while
   * the promise is pending to drive UI feedback.
   *
   * @param {string} token
   * @param {Object} [options] — { batchSize, throttleMs, minTextLength, useAIDomainDetection, dryRun }
   * @returns {Promise<Object>} final progress record
   */
  async run(token, options) {
    return ipcRenderer?.invoke('enrichment-run', token, options || {});
  },

  /** Signal the running enrichment loop to stop between items. */
  cancel() {
    return ipcRenderer?.sendSync('enrichment-cancel');
  },

  /** Last-known progress snapshot, or null if no run has started. */
  getProgress() {
    return ipcRenderer?.sendSync('enrichment-get-progress');
  },

  /** Boolean — is an enrichment run currently in progress? */
  isRunning() {
    return ipcRenderer?.sendSync('enrichment-is-running') === true;
  },
};

export default enrichmentApi;
