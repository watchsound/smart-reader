/**
 * rereadQueueApi — renderer-side client for Phase 8 spaced re-reading queue.
 */

import customStorage from '../store/customStorage';

const rereadQueueApi = {
  async schedule({ bookId, bookTitle, chapterId, chapterName, gaps, score }) {
    const token = customStorage.getToken();
    return window.electron.ipcRenderer.invoke('reread-queue-schedule', {
      bookId,
      bookTitle,
      chapterId,
      chapterName,
      gaps,
      score,
      token,
    });
  },

  async getPending() {
    const token = customStorage.getToken();
    return window.electron.ipcRenderer.invoke('reread-queue-get', { token });
  },

  async complete(id) {
    return window.electron.ipcRenderer.invoke('reread-queue-complete', { id });
  },

  async dismiss(id) {
    return window.electron.ipcRenderer.invoke('reread-queue-dismiss', { id });
  },
};

export default rereadQueueApi;
