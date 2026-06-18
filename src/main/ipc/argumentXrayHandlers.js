/**
 * argumentXrayHandlers — IPC for Argument Skeleton X-ray (#13).
 *
 * Single channel: `argument-xray-analyze` takes a paragraph + token,
 * runs it through ArgumentXrayService (cached), returns the structured
 * {claims, evidence} so the renderer can highlight the load-bearing
 * structure of the paragraph.
 */

const { ArgumentXrayService } = require('../utils/ArgumentXrayService');

const registerArgumentXrayHandlers = (ipcMain) => {
  // Single per-registration instance — the in-memory cache is intentionally
  // process-lifetime so toggling X-ray off+on doesn't re-bill the LLM for
  // the same paragraph.
  const service = new ArgumentXrayService();

  ipcMain.handle('argument-xray-analyze', async (_event, payload) => {
    const paragraph =
      payload && typeof payload.paragraph === 'string' ? payload.paragraph : '';
    if (!paragraph.trim()) {
      return { error: 'paragraph is required' };
    }
    try {
      return await service.analyze(paragraph, payload.token);
    } catch (err) {
      console.warn(
        '[argumentXrayHandlers] analyze failed:',
        err && err.message ? err.message : err,
      );
      return { error: err && err.message ? err.message : 'analyze failed' };
    }
  });
};

module.exports = { registerArgumentXrayHandlers };
