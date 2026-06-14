/**
 * moodBoardOrganizerApi — renderer-side client for Phase 8 organize loop.
 *
 * Backed by `moodboard-organizer-*` IPC handlers in main.
 */

import customStorage from '../store/customStorage';

const moodBoardOrganizerApi = {
  async getSuggestion(dedupKey) {
    const token = customStorage.getToken();
    return window.electron.ipcRenderer.invoke(
      'moodboard-organizer-get-suggestion',
      { dedupKey, token },
    );
  },

  async clearSuggestion(bookId, domainType) {
    const token = customStorage.getToken();
    return window.electron.ipcRenderer.invoke(
      'moodboard-organizer-clear-suggestion',
      { bookId, domainType, token },
    );
  },

  /**
   * Phase 8 Slice 3: server-side board creation pre-populated with the
   * cluster's learning points (one note per concept, laid out in a grid).
   * Server clears the dedup record atomically with board+note creation,
   * so callers do NOT also need to call clearSuggestion.
   *
   * @returns {Promise<{ board, noteIds } | { error }>}
   */
  async createBoardFromCluster(bookId, domainType) {
    const token = customStorage.getToken();
    return window.electron.ipcRenderer.invoke(
      'moodboard-organizer-create-board',
      { bookId, domainType, token },
    );
  },
};

export default moodBoardOrganizerApi;
