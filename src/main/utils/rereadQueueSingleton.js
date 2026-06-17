// src/main/utils/rereadQueueSingleton.js
/**
 * Lazy singleton accessor for RereadQueueService.
 *
 * Director tools (scheduleReread) import this module rather than
 * instantiating RereadQueueService directly, so they do not need to
 * receive the electron-store via injection.
 *
 * Call init(store) once at app startup (alongside registerRereadQueueHandlers).
 * If init() is never called, getInstance() returns a no-op stub so
 * tests that mock this module stay isolated.
 */

const RereadQueueServiceClass = require('./RereadQueueService').default;

let _instance = null;

function init(store) {
  _instance = new RereadQueueServiceClass(store);
}

function getInstance() {
  if (!_instance) {
    // Fallback stub — schedule/unschedule return nullish values;
    // real runtime always calls init() first via registerRereadQueueHandlers.
    return {
      schedule: () => ({ id: null }),
      unschedule: () => false,
    };
  }
  return _instance;
}

// Expose class-level convenience pass-throughs used by tools:
function schedule(args) { return getInstance().schedule(args); }
function unschedule(id) { return getInstance().unschedule(id); }

module.exports = { init, getInstance, schedule, unschedule };
