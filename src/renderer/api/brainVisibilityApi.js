/**
 * brainVisibilityApi — renderer-side IPC client for Brain Visibility (Phase 11).
 * Mirrors `src/main/ipc/brainVisibilityHandlers.js`.
 *
 * Usage:
 *   import brainVisibilityApi from '../api/brainVisibilityApi';
 *
 *   // Fetch dashboard data (mastery, timeline, sessions, top concepts)
 *   const dashboard = await brainVisibilityApi.dashboard({ window: '30d', userId: 1 });
 *
 *   // Fetch concept details including lineage and mastery history
 *   const concept = await brainVisibilityApi.concept({ learningPointId: 42, userId: 1 });
 */

const { ipcRenderer } = window.electron || {};

const brainVisibilityApi = {
  /**
   * Fetch the brain dashboard (mastery overview, timeline, sessions, top concepts).
   * @param {{ window?: string, userId?: number }} params - window defaults to '30d'
   * @returns {Promise<{ mastery: [], timeline: [], sessions: [], topConcepts: [] }>}
   */
  dashboard({ window = '30d', userId = 1 } = {}) {
    return ipcRenderer.invoke('brainVisibility:dashboard', { window, userId });
  },

  /**
   * Fetch concept details including lineage, cost, and mastery history.
   * @param {{ learningPointId: number, userId?: number }} params
   * @returns {Promise<{ meta: {}, lineage: [], costToDate: number, boxOverTime: null|[] }>}
   */
  concept({ learningPointId, userId = 1 } = {}) {
    return ipcRenderer.invoke('brainVisibility:concept', { learningPointId, userId });
  },
};

export default brainVisibilityApi;
