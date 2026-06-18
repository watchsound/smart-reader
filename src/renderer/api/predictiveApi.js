/**
 * predictiveApi — renderer-side IPC client for the Phase 14a Predictive Engine.
 * Mirrors `src/main/ipc/predictiveHandlers.js`.
 */

const predictiveApi = {
  predict(args) {
    return window.electron.ipcRenderer.invoke('predictive:predict', args);
  },
  rank(candidates) {
    return window.electron.ipcRenderer.invoke('predictive:rank', candidates);
  },
  refresh(opts) {
    return window.electron.ipcRenderer.invoke('predictive:refresh', opts);
  },
  report(opts) {
    return window.electron.ipcRenderer.invoke('predictive:report', opts);
  },
  plan(opts) {
    return window.electron.ipcRenderer.invoke('predictive:plan', opts);
  },
};

module.exports = predictiveApi;
module.exports.default = predictiveApi;
