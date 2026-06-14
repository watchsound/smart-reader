/**
 * learningPathPlannerApi — renderer-side client for Phase 7 cross-book curriculum.
 */

import customStorage from '../store/customStorage';

const learningPathPlannerApi = {
  /**
   * @param {string} goal — free-text learning goal
   * @returns {Promise<{ summary, pathSteps, coverageGaps, analyzedCount, totalBooks } | { error }>}
   */
  async plan(goal) {
    const token = await customStorage.getToken();
    return window.electron.ipcRenderer.invoke('learning-path-plan', {
      goal,
      token,
    });
  },
};

export default learningPathPlannerApi;
