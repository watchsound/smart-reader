// src/main/brain/director/SessionActiveStore.js
/**
 * SessionActiveStore — thin wrapper bridging SessionRunner's store interface
 * to electron-store (crash-recovery snapshot) and AISessionStore (completed
 * session persistence to SQLite).
 *
 * Keeps the active session snapshot in electron-store key 'active' under the
 * 'aiSession' store name so it survives unclean exits and can be resumed on
 * next launch.
 *
 * __reset is test-only; it reinstantiates the store so each test starts clean.
 */

const Store = require('electron-store');
const AISessionStore = require('../../db/AISessionStore');

let store = new Store({ name: 'aiSession' });

function saveActive(state) {
  store.set('active', state);
}

function loadActive() {
  return store.get('active');
}

function clearActive() {
  store.delete('active');
}

function persistCompleted(state) {
  return AISessionStore.persistCompleted(state);
}

/** Test-only: replace the internal store instance so tests start with a clean slate. */
function __reset() {
  store = new Store({ name: 'aiSession' });
  if (typeof store.clear === 'function') {
    store.clear();
  }
}

module.exports = { saveActive, loadActive, clearActive, persistCompleted, __reset };
