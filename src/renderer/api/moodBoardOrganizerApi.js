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
};

export default moodBoardOrganizerApi;
