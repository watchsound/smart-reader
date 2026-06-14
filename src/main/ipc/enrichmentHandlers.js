/**
 * enrichmentHandlers — IPC surface for the Phase 3d batch enrichment service.
 *
 * Channels:
 *   enrichment-eligible-count  (invoke)  → { total, eligible }
 *   enrichment-run             (invoke)  → final progress object
 *   enrichment-cancel          (sync)    → ack
 *   enrichment-get-progress    (sync)    → last-known progress (or null)
 *   enrichment-is-running      (sync)    → boolean
 *
 * Progress events are NOT pushed from main to renderer in this slice —
 * callers poll `enrichment-get-progress` every ~1s while a run is active.
 * If we add push-style progress later, register a webContents send here.
 *
 * Wiring: this module exports `registerEnrichmentHandlers()`. It is NOT
 * yet wired into main.ts — wiring is a one-line follow-up alongside the
 * settings UI change that triggers the run.
 */

import { ipcMain } from 'electron';
import learningPointEnrichmentService from '../utils/LearningPointEnrichmentService';

let registered = false;

function registerEnrichmentHandlers() {
  if (registered) {
    console.warn('[enrichmentHandlers] already registered, skipping');
    return;
  }
  registered = true;

  ipcMain.handle(
    'enrichment-eligible-count',
    async (_event, token, options) => {
      try {
        return await learningPointEnrichmentService.getEligibleCount(
          token,
          options || {},
        );
      } catch (err) {
        console.error('[enrichmentHandlers] eligible-count failed:', err);
        return { error: err.message || 'eligible-count failed' };
      }
    },
  );

  ipcMain.handle('enrichment-run', async (_event, token, options) => {
    try {
      // onProgress callbacks aren't transferable over IPC — strip if present.
      // Renderer should poll `enrichment-get-progress` for updates.
      const sanitizedOptions = { ...(options || {}) };
      delete sanitizedOptions.onProgress;
      return await learningPointEnrichmentService.runEnrichment(
        token,
        sanitizedOptions,
      );
    } catch (err) {
      console.error('[enrichmentHandlers] run failed:', err);
      return { error: err.message || 'enrichment run failed' };
    }
  });

  ipcMain.on('enrichment-cancel', (event) => {
    learningPointEnrichmentService.cancel();
    event.returnValue = { ok: true };
  });

  ipcMain.on('enrichment-get-progress', (event) => {
    event.returnValue = learningPointEnrichmentService.getLastProgress();
  });

  ipcMain.on('enrichment-is-running', (event) => {
    event.returnValue = learningPointEnrichmentService.isRunning();
  });
}

export default registerEnrichmentHandlers;
export { registerEnrichmentHandlers };
