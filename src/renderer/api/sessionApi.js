/**
 * sessionApi — renderer-side IPC client for the Study Session Director (Phase 10b-1).
 * Mirrors `src/main/ipc/sessionHandlers.js`.
 *
 * Usage:
 *   import sessionApi from '../api/sessionApi';
 *
 *   // Start a new session
 *   const { sessionId, traceId } = await sessionApi.start({ userId: 1, questId: 'q-1', goal: 'learn' });
 *
 *   // Submit user result after card flip/answer
 *   await sessionApi.userResult(sessionId, { rating: 3, time: 45 });
 *
 *   // Subscribe to trace events as session progresses
 *   const unsubscribe = sessionApi.subscribeTrace(sessionId, (event) => {
 *     console.log('Session event:', event.type, event.data);
 *   });
 */

const { ipcRenderer } = window.electron || {};

const sessionApi = {
  /**
   * Start a new study session.
   * @param {{ userId: number, questId?: string, goal?: string }} params
   * @returns {Promise<{ sessionId: string, traceId: string, ...metadata }>}
   */
  start(params) {
    return ipcRenderer.invoke('session:start', params);
  },

  /**
   * Submit a user result (card rating, time spent, etc.) after a single card/item.
   * @param {string} sessionId
   * @param {object} result - { rating, time, answerText, ... }
   * @returns {Promise<{ ok: boolean, ...metadata }>}
   */
  userResult(sessionId, result) {
    return ipcRenderer.invoke('session:userResult', { sessionId, result });
  },

  /**
   * Cancel (hard-close) an in-progress session.
   * @param {string} sessionId
   * @returns {Promise<{ cancelled: boolean }>}
   */
  cancel(sessionId) {
    return ipcRenderer.invoke('session:cancel', { sessionId });
  },

  /**
   * Fetch the current session state (status, progress, cards, etc.).
   * @param {string} sessionId
   * @returns {Promise<Session>}
   */
  get(sessionId) {
    return ipcRenderer.invoke('session:get', { sessionId });
  },

  /**
   * Load the most recent active session for the current user (if one exists).
   * @returns {Promise<Session|null>}
   */
  loadActive() {
    return ipcRenderer.invoke('session:loadActive', {});
  },

  /**
   * Undo the most recent soft-write (SRS state change) within a session.
   * @param {string} sessionId
   * @param {string} softWriteId
   * @returns {Promise<{ undone: boolean }>}
   */
  undoSoftWrite(sessionId, softWriteId) {
    return ipcRenderer.invoke('session:undoSoftWrite', { sessionId, softWriteId });
  },

  /**
   * List completed sessions for a user (newest first).
   * @param {number} userId
   * @param {number} [limit=20]
   * @returns {Promise<{ sessions: Session[] }>}
   */
  listCompleted(userId, limit = 20) {
    return ipcRenderer.invoke('session:listCompleted', { userId, limit });
  },

  /**
   * Fetch the full trace log for a session.
   * @param {string} sessionId
   * @returns {Promise<{ traceId: string, events: TraceEvent[] }>}
   */
  getTrace(sessionId) {
    return ipcRenderer.invoke('session:getTrace', { sessionId });
  },

  /**
   * Subscribe to session-scoped trace events as they arrive (main → renderer broadcast).
   * Returns an unsubscribe function for cleanup.
   *
   * @param {string} sessionId
   * @param {function(TraceEvent): void} handler
   * @returns {function(): void} - unsubscribe function
   */
  subscribeTrace(sessionId, handler) {
    const channel = `session:${sessionId}:trace`;
    const fn = (_e, event) => handler(event);
    ipcRenderer.on(channel, fn);
    return () => ipcRenderer.removeListener(channel, fn);
  },
};

export default sessionApi;
