/**
 * brainVisibilityHandlers — IPC surface for Brain Visibility (Phase 11).
 *
 * Channels:
 *   brainVisibility:dashboard  { window, userId } → { mastery, timeline, sessions, topConcepts }
 *   brainVisibility:concept    { learningPointId, userId } → { meta, lineage, costToDate, boxOverTime }
 */

const { ipcMain } = require('electron');
const BrainVisibilityService = require('../utils/BrainVisibilityService');

function register() {
  ipcMain.handle('brainVisibility:dashboard', async (_e, { window, userId }) =>
    BrainVisibilityService.getDashboard({ window, userId })
  );

  ipcMain.handle('brainVisibility:concept', async (_e, { learningPointId, userId }) =>
    BrainVisibilityService.getConcept({ learningPointId, userId })
  );
}

module.exports = { register };
