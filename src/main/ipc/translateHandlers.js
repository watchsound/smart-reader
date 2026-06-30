/**
 * translateHandlers.js
 *
 * IPC handlers for the Translate page (2026-06-30 redesign).
 *
 * v1 surface: a single `learning-point-create` handler that lets Path A and
 * Path B save one ad-hoc Learning Point per weakness chip. Existing bulk
 * import handlers in learningPlanHandlers.js cover multi-row paths; this
 * one is for the "one at a time, from a UI button" case.
 *
 * featureSurface is stashed in `extras.featureSurface` so later
 * mastery_event writes (Phase 13) can pick it up; LearningPointService
 * itself does not consume the value.
 */

const { ipcMain } = require('electron');

function registerTranslateHandlers(/* store, services */) {
  ipcMain.handle('learning-point-create', async (_event, params) => {
    // Lazy-require so the test mock can intercept.
    const LearningPointServiceModule = require('../utils/LearningPointService');
    const svc =
      LearningPointServiceModule.learningPointService ||
      LearningPointServiceModule.default ||
      LearningPointServiceModule;

    const {
      domain,
      content,
      extras,
      featureSurface,
      token,
    } = params || {};

    const point = {
      domainType: domain || 'language',
      front: content,
      title: typeof content === 'string' ? content.slice(0, 100) : undefined,
      extras: {
        ...(extras || {}),
        featureSurface: featureSurface || 'translate-drill',
      },
    };

    return svc.createLearningPoint(point, token);
  });
}

module.exports = { registerTranslateHandlers };
