function register(ipcMain, engine) {
  ipcMain.handle('predictive:predict', async (_e, args) => engine.predict(args));
  ipcMain.handle('predictive:rank', async (_e, candidates) => engine.rankCandidates(candidates));
  ipcMain.handle('predictive:refresh', async (_e, opts) => engine.refreshModel(opts || {}));
  ipcMain.handle('predictive:report', async (_e, opts) => engine.calibrationReport(opts || {}));
}

module.exports = { register };
