// src/main/ipc/sessionHandlers.js
/**
 * sessionHandlers — IPC surface for the Study-Session Director (Phase 10b-1).
 *
 * Channels:
 *   session:start            { userId, questId?, goal } → { sessionId, traceId }
 *   session:userResult       { sessionId, result }      → boolean
 *   session:cancel           { sessionId }              → boolean
 *   session:get              { sessionId }              → SessionState | null
 *   session:loadActive       (none)                     → SessionState | null
 *   session:undoSoftWrite    { sessionId, softWriteId } → { undone, reason? }
 *   session:listCompleted    { userId, limit? }         → ai_sessions[]
 *   session:getTrace         { sessionId }              → TraceEvent[]
 *
 * Real-time events are broadcast via webContents.send to all windows:
 *   session:<sessionId>:trace  — every trace event emitted by the runner
 */

const { ipcMain, BrowserWindow } = require('electron');
const SessionRunner = require('../brain/director/SessionRunner');
const Director = require('../brain/director/Director');
const SessionActiveStore = require('../brain/director/SessionActiveStore');
const AISessionStore = require('../db/AISessionStore');
const UndoRegistry = require('../brain/director/UndoRegistry');

let runner = null;

function broadcast(event) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(`session:${event.sessionId}:trace`, event);
  }
}

function getRunner() {
  if (!runner) {
    runner = new SessionRunner({ store: SessionActiveStore, director: Director, broadcast });
  }
  return runner;
}

function register() {
  ipcMain.handle('session:start', async (_e, { userId, questId, goal }) => {
    return getRunner().start({ userId, questId, goal });
  });

  ipcMain.handle('session:userResult', async (_e, { sessionId, result }) => {
    return getRunner().userResult(sessionId, result);
  });

  ipcMain.handle('session:cancel', async (_e, { sessionId }) => {
    return getRunner().cancel(sessionId);
  });

  ipcMain.handle('session:get', async (_e, { sessionId }) => {
    const r = getRunner();
    const entry = r.active.get(sessionId);
    return entry ? entry.state : null;
  });

  ipcMain.handle('session:loadActive', async () => SessionActiveStore.loadActive());

  ipcMain.handle('session:undoSoftWrite', async (_e, { sessionId, softWriteId }) => {
    const r = getRunner();
    const entry = r.active.get(sessionId);
    const sw = entry?.state.softWrites.find(s => s.id === softWriteId && !s.undone);
    if (!sw) return { undone: false, reason: 'not-found' };
    const result = await UndoRegistry.run(sw.tool, { ...sw.args, ...sw.handlerResult });
    if (result.undone) sw.undone = true;
    await SessionActiveStore.saveActive(entry.state);
    return result;
  });

  ipcMain.handle('session:listCompleted', async (_e, { userId, limit }) =>
    AISessionStore.listByUser(userId, limit)
  );

  ipcMain.handle('session:getTrace', async (_e, { sessionId }) =>
    AISessionStore.getTrace(sessionId)
  );
}

module.exports = { register, runnerForTest: () => runner };
