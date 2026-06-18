/**
 * aiPricingApi — renderer-side IPC client for per-provider pricing overrides.
 * Mirrors the `aiPricing:*` handlers in `src/main/ipc/spineHandlers.js`.
 *
 * Phase 13.2: allows users to set custom input/output rates (USD per 1M tokens)
 * for each AI provider. costEstimator in main reads these overrides at call time.
 */

const aiPricingApi = {
  /**
   * Returns the current overrides map: `{ [providerKey]: { input, output } }`.
   * @returns {Promise<Record<string, { input: number, output: number }>>}
   */
  get() {
    return window.electron.ipcRenderer.invoke('aiPricing:get');
  },

  /**
   * Persist an override for `providerKey`.
   * Pass `input: null, output: null` to delete the override (reset to default).
   * Returns the updated overrides map.
   * @param {{ providerKey: string, input: number|null, output: number|null }}
   * @returns {Promise<Record<string, { input: number, output: number }>>}
   */
  set({ providerKey, input, output }) {
    return window.electron.ipcRenderer.invoke('aiPricing:set', {
      providerKey,
      input,
      output,
    });
  },

  /**
   * Returns the hardcoded PRICING table from costEstimator (before overrides).
   * Used by the UI to show the default rate when no override is set.
   * @returns {Promise<Record<string, { input: number, output: number }>>}
   */
  defaults() {
    return window.electron.ipcRenderer.invoke('aiPricing:defaults');
  },
};

export default aiPricingApi;
