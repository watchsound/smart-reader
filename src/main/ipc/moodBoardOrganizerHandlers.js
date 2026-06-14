/**
 * moodBoardOrganizerHandlers — Phase 8 organize loop renderer-facing IPC.
 *
 * The Brain heartbeat already detects clusters and creates notifications
 * (see LearningBrainAgent.suggestOrganizeSessions). These IPC handlers
 * let the renderer:
 *   - look up the cluster behind a notification's `?organize=<dedupKey>`
 *     query param so it can render an organize banner with concept titles,
 *   - clear the dedup record so the next heartbeat can re-suggest if the
 *     reader keeps reading and accumulates more concepts in the same cluster.
 *
 * Channels:
 *   moodboard-organizer-get-suggestion    { dedupKey, token } → { suggestion | null }
 *   moodboard-organizer-clear-suggestion  { bookId, domainType, token } → { ok }
 *
 * State lives in electron-store; this handler module owns its own service
 * instance but reads/writes the same STORE_KEY as the brain instance, so
 * both views see the same dedup table.
 */

import { ipcMain } from 'electron';
import { getUserIdFromToken } from '../db/dbManager';

const MoodBoardOrganizerService = require('../brain/MoodBoardOrganizerService');

let registered = false;
let service = null;

function registerMoodBoardOrganizerHandlers(store) {
  if (registered) {
    console.warn('[moodBoardOrganizerHandlers] already registered, skipping');
    return;
  }
  registered = true;
  service = new MoodBoardOrganizerService({ store });

  ipcMain.handle('moodboard-organizer-get-suggestion', (_event, payload) => {
    try {
      const { dedupKey, token } = payload || {};
      if (!dedupKey) return { suggestion: null };
      const userId = token ? getUserIdFromToken(token) : 1;
      const suggestion = service.getSuggestion(
        userId > 0 ? userId : 1,
        dedupKey,
      );
      return { suggestion };
    } catch (err) {
      console.error('[moodBoardOrganizerHandlers] get-suggestion failed:', err);
      return { suggestion: null, error: err?.message };
    }
  });

  ipcMain.handle('moodboard-organizer-clear-suggestion', (_event, payload) => {
    try {
      const { bookId, domainType, token } = payload || {};
      if (!bookId || !domainType) return { ok: false };
      const userId = token ? getUserIdFromToken(token) : 1;
      // `cleared` reports whether a dedup record existed; `ok` reports
      // whether the clear operation itself succeeded. A "no such record"
      // outcome is a successful no-op (idempotent), not a failure.
      const cleared = service.clearSuggestion(
        userId > 0 ? userId : 1,
        Number(bookId),
        domainType,
      );
      return { ok: true, cleared };
    } catch (err) {
      console.error(
        '[moodBoardOrganizerHandlers] clear-suggestion failed:',
        err,
      );
      return { ok: false, error: err?.message };
    }
  });
}

export default registerMoodBoardOrganizerHandlers;
export { registerMoodBoardOrganizerHandlers };
