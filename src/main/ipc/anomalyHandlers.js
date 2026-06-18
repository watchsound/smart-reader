/**
 * anomalyHandlers — Phase 15b IPC for BrainAnomalyDetector.
 *
 * Channels:
 *   anomaly:list       opts? → AnomalyRow[]
 *   anomaly:rescan     {}    → { found, upserted, removed }
 *   anomaly:acknowledge id   → { acknowledged: true, at: ms }
 */

const { ipcMain } = require('electron');

let registered = false;

function register() {
  if (registered) return;
  registered = true;
  const detector = require('../utils/BrainAnomalyDetector');

  ipcMain.handle('anomaly:list', async (_e, opts) => {
    try { return detector.listAnomalies(opts || {}); }
    catch (err) {
      console.error('[anomalyHandlers] list failed:', err);
      return [];
    }
  });

  ipcMain.handle('anomaly:rescan', async () => {
    try { return await detector.runAndPersist({}); }
    catch (err) {
      console.error('[anomalyHandlers] rescan failed:', err);
      return { found: 0, upserted: 0, removed: 0, error: String(err && err.message) };
    }
  });

  ipcMain.handle('anomaly:acknowledge', async (_e, id) => {
    try { return detector.acknowledgeAnomaly(id); }
    catch (err) {
      console.error('[anomalyHandlers] acknowledge failed:', err);
      return { acknowledged: false, error: String(err && err.message) };
    }
  });
}

module.exports = { register };
