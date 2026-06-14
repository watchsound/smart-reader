/**
 * TriggerEmitter — main-process helper used by Brain services
 * (MicroCardProposer, BookDiagnosticService, ComprehensionGradingService,
 * RereadQueueService, MoodBoardOrganizerService, ProductionPromptService,
 * LearningPathPlannerService) to ship Triggers to the renderer.
 *
 * Replaces the legacy `persistBrainNotifications` path for shell-driven flows.
 */

const DEFAULT_FRESHNESS_MS = 5 * 60 * 1000;

class TriggerEmitter {
  /**
   * @param {{ getWebContents: () => Electron.WebContents | null }} deps
   */
  constructor({ getWebContents }) {
    this._getWebContents = getWebContents;
  }

  /**
   * @param {Omit<import('../../commons/brain/triggerTypes').Trigger, 'emittedAt'> & { freshness?: number }} trigger
   */
  emit(trigger) {
    const wc = this._getWebContents();
    if (!wc) return; // Renderer not ready; trigger drops (Plan 2 may queue on main).
    const enriched = {
      freshness: DEFAULT_FRESHNESS_MS,
      ...trigger,
      emittedAt: Date.now(),
    };
    wc.send('brain:trigger:push', enriched);
  }
}

module.exports = TriggerEmitter;
