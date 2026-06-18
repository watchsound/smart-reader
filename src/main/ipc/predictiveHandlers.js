function register(ipcMain, engine) {
  ipcMain.handle('predictive:predict', async (_e, args) => engine.predict(args));
  ipcMain.handle('predictive:rank', async (_e, candidates) => engine.rankCandidates(candidates));
  ipcMain.handle('predictive:refresh', async (_e, opts) => engine.refreshModel(opts || {}));
  ipcMain.handle('predictive:report', async (_e, opts) => engine.calibrationReport(opts || {}));
  // Phase 14d: Budget Session Planner.
  ipcMain.handle('predictive:plan', async (_e, opts) => {
    // eslint-disable-next-line global-require
    const { computePlan } = require('../utils/BudgetSessionPlanner');
    return computePlan(opts || {});
  });
}

module.exports = { register };
