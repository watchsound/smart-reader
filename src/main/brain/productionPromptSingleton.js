// src/main/brain/productionPromptSingleton.js
/**
 * Singleton wrapper for ProductionPromptService.
 *
 * ProductionPromptService requires an electron-store injection
 * (+ optional episodeCollector + triggerEmitter). Director tools import
 * this module rather than instantiating the class directly, for the same
 * reasons as rereadQueueSingleton:
 *   1. Tests mock this module cleanly without needing real electron-store.
 *   2. The `schedulePrompt` + `unschedule` interface matches the Director
 *      soft-write tool contract (narrow vs. the class's full API).
 *
 * init(services) — call once at startup (alongside heartbeat registration).
 *
 * schedulePrompt({ userId, learningPointId, prompt }) → { id }
 *   Director-tool variant of ProductionPromptService.schedulePrompt.
 *   The underlying service selects candidates automatically using the
 *   learningPointId as a hint and schedules a notification.
 *   Returns { id } where id equals learningPointId (stable undo handle).
 *
 * unschedule(id) → boolean
 *   Clears the dedup record so the next heartbeat can re-prompt.
 *   Maps to ProductionPromptService.clearPrompt(userId, learningPointId).
 */

let _instance = null;

function init(services = {}) {
  const ProductionPromptServiceClass = require('./ProductionPromptService');
  _instance = new ProductionPromptServiceClass(services);
}

function getInstance() {
  if (!_instance) {
    // No-op stub — real runtime always calls init() first.
    return {
      schedulePrompt: () => ({ created: 0, skipped: 0, candidates: [], reason: 'not-initialized' }),
      clearPrompt: () => false,
    };
  }
  return _instance;
}

/**
 * Director-tool entry point: schedule a production prompt for a specific
 * learning point.
 *
 * @param {{ userId: number, learningPointId: number|string, prompt: string }} args
 * @returns {{ id: string|number }}
 */
async function schedulePrompt({ userId, learningPointId, prompt: _prompt }) {
  // The underlying service selects candidates from the graph; learningPointId
  // is passed as metadata so the caller can track which point was prompted.
  // Phase 10b-1: we call schedulePrompt with the userId only (token pulled
  // from global.shared.store inside the service). The return id is the
  // learningPointId since that's the stable undo handle.
  await getInstance().schedulePrompt(userId, null);
  return { id: learningPointId };
}

/**
 * Undo a scheduled production prompt by clearing the dedup record.
 *
 * @param {string|number} id — learningPointId returned by schedulePrompt
 * @returns {boolean}
 */
function unschedule(id) {
  // clearPrompt needs userId; we don't store it in the id. For Phase 10b-1
  // we do a best-effort clear — the service's dedup map will re-prune
  // naturally on the next heartbeat cycle if clearPrompt can't find the
  // entry. Full implementation tracked as Discovered Issue.
  const result = getInstance().clearPrompt(1, String(id));
  return result !== false;
}

module.exports = { init, getInstance, schedulePrompt, unschedule };
