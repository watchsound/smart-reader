/**
 * rereadQueueHandlers — IPC surface for Phase 8 spaced re-reading queue.
 *
 * Channels:
 *   reread-queue-schedule  (invoke)  — add/update an item; returns the item
 *   reread-queue-get       (invoke)  — list pending items for current user
 *   reread-queue-complete  (invoke)  — mark an item as completed
 *   reread-queue-dismiss   (invoke)  — remove an item without completing
 *
 * The service is injected with the electron-store instance at registration
 * time, matching the pattern used by EpisodeCollector and the Brain service.
 */

import { ipcMain } from 'electron';
import { getUserIdFromToken } from '../db/dbManager';
import RereadQueueService from '../utils/RereadQueueService';

let registered = false;
let queueService = null;

/**
 * @param {object} store electron-store instance
 * @param {{ triggerEmitter?: import('../brain/TriggerEmitter') }} [services]
 */
function registerRereadQueueHandlers(store, services = {}) {
  if (registered) {
    console.warn('[rereadQueueHandlers] already registered, skipping');
    return;
  }
  registered = true;
  queueService = new RereadQueueService(store);
  const triggerEmitter = services.triggerEmitter || null;

  ipcMain.handle('reread-queue-schedule', (_event, payload) => {
    try {
      const { bookId, bookTitle, chapterId, chapterName, gaps, score, token } =
        payload || {};
      const userId = token ? getUserIdFromToken(token) : 1;
      const item = queueService.schedule({
        bookId,
        bookTitle,
        chapterId,
        chapterName,
        gaps: Array.isArray(gaps) ? gaps : [],
        score: typeof score === 'number' ? score : 0,
        userId: userId > 0 ? userId : 1,
      });

      // Brain-driven shell: a newly-scheduled re-read item emits an
      // atomic-chip Trigger so the Orb can surface it cross-surface.
      // The user navigates to the chapter via the chip's "Open" action.
      if (item && !item.error && triggerEmitter && bookId) {
        const gapList = Array.isArray(gaps) ? gaps : [];
        triggerEmitter.emit({
          id: `phase8a:${bookId}:${chapterId ?? 'no-chapter'}`,
          source: 'phase-8a-reread',
          unit: 'atomic-chip',
          surfaceTarget: { kind: 'global' },
          priority: 'normal',
          freshness: 7 * 24 * 60 * 60 * 1000, // 7 days
          payload: {
            title: `Re-read: ${chapterName || 'chapter'} of ${bookTitle || `Book ${bookId}`}`,
            body: gapList.length > 0
              ? `Gaps: ${gapList.slice(0, 3).join('; ')}`
              : `Comprehension score was low (${score ?? '?'}).`,
            actions: [
              { label: 'Open', navigate: `reading/${bookId}`, primary: true },
            ],
            bookId,
            chapterId,
            itemId: item.id,
          },
        });
      }

      return item;
    } catch (err) {
      console.error('[rereadQueueHandlers] schedule failed:', err);
      return { error: err?.message || 'schedule failed' };
    }
  });

  ipcMain.handle('reread-queue-get', (_event, payload) => {
    try {
      const { token } = payload || {};
      const userId = token ? getUserIdFromToken(token) : 1;
      return queueService.getPending(userId > 0 ? userId : 1);
    } catch (err) {
      console.error('[rereadQueueHandlers] get failed:', err);
      return [];
    }
  });

  ipcMain.handle('reread-queue-complete', (_event, payload) => {
    try {
      const { id } = payload || {};
      return queueService.complete(id) || { error: 'Item not found.' };
    } catch (err) {
      console.error('[rereadQueueHandlers] complete failed:', err);
      return { error: err?.message || 'complete failed' };
    }
  });

  ipcMain.handle('reread-queue-dismiss', (_event, payload) => {
    try {
      const { id } = payload || {};
      if (!id) return { ok: false };
      // `dismissed` reports whether an item was actually removed;
      // `ok` reports whether the dismiss operation itself succeeded.
      // Dismissing a non-existent id is a successful no-op (idempotent).
      const dismissed = queueService.dismiss(id);
      return { ok: true, dismissed };
    } catch (err) {
      console.error('[rereadQueueHandlers] dismiss failed:', err);
      return { ok: false };
    }
  });
}

export default registerRereadQueueHandlers;
export { registerRereadQueueHandlers };
