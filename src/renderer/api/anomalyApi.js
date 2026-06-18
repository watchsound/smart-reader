/**
 * anomalyApi — Phase 15b renderer client for the Brain Anomaly Detector.
 * Mirrors src/main/ipc/anomalyHandlers.js.
 */

const anomalyApi = {
  list(opts) {
    return window.electron.ipcRenderer.invoke('anomaly:list', opts || {});
  },
  rescan() {
    return window.electron.ipcRenderer.invoke('anomaly:rescan');
  },
  acknowledge(id) {
    return window.electron.ipcRenderer.invoke('anomaly:acknowledge', id);
  },
};

module.exports = anomalyApi;
module.exports.default = anomalyApi;
