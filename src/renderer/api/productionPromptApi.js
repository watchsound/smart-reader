/**
 * productionPromptApi — renderer client for Phase 8 production loop.
 *
 * Backed by `production-*` IPC handlers in main.
 */

import customStorage from '../store/customStorage';

const productionPromptApi = {
  async getPrompt(id) {
    const token = customStorage.getToken();
    return window.electron.ipcRenderer.invoke('production-get-prompt', {
      id,
      token,
    });
  },

  async gradeAnswer(id, answer) {
    const token = customStorage.getToken();
    return window.electron.ipcRenderer.invoke('production-grade-answer', {
      id,
      answer,
      token,
    });
  },

  async complete(id, score) {
    const token = customStorage.getToken();
    return window.electron.ipcRenderer.invoke('production-complete', {
      id,
      score,
      token,
    });
  },

  async skip(id) {
    const token = customStorage.getToken();
    return window.electron.ipcRenderer.invoke('production-skip', { id, token });
  },
};

export default productionPromptApi;
