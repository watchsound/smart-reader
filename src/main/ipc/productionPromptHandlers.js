/**
 * productionPromptHandlers — Phase 8 production loop renderer-facing IPC.
 *
 * The Brain heartbeat (LearningBrainAgent.schedulePromptForProduction) picks
 * a learning point and emits a notification with
 * `actionUrl: /knowledge?produce=<learningPointId>`. These handlers let the
 * renderer:
 *   - fetch the learning point so the panel can show the prompt,
 *   - grade the free-text answer (reuses Phase 6's grading service so we
 *     don't maintain two prompt+schema pipelines),
 *   - clear the dedup record on submit OR skip so the slot frees up for
 *     the next heartbeat to pick a different point.
 *
 * Channels:
 *   production-get-prompt    { id, token }                   → { learningPoint | null }
 *   production-grade-answer  { id, answer, token }           → { score, strengths, gaps, feedback } | { error }
 *   production-complete      { id, score, token }            → { ok }
 *   production-skip          { id, token }                   → { ok }
 */

import { ipcMain } from 'electron';
import db, { getUserIdFromToken } from '../db/dbManager';
import { learningPointService } from '../utils/LearningPointService';
import comprehensionGradingService from '../utils/ComprehensionGradingService';

// Phase 8c production grade math — ported from the SQLite-bound
// applyProductionGrade so the IPC handler can drive it against the
// graph store via learningPointService.updateLearningPoint. Contract
// preserved bit-for-bit with the old SQLite path; only the storage
// destination changed.
function computeProductionGradeDelta(current, productionScore) {
  const score = Math.max(0, Math.min(100, Math.round(productionScore || 0)));
  let nextMastery = current.masteryLevel;
  let nextBox = current.box;
  let demoted = false;
  let nextReview = null;

  if (score >= 75) {
    nextMastery = Math.max(current.masteryLevel || 0, score);
  } else if (score >= 50) {
    nextMastery = score;
  } else {
    nextMastery = score;
    nextBox = Math.max(1, (current.box || 1) - 1);
    demoted = nextBox !== current.box;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    nextReview = tomorrow.toISOString();
  }

  const updates = { masteryLevel: nextMastery, box: nextBox };
  if (nextReview) {
    updates.nextReview = nextReview;
    updates.correctStreak = 0;
  }

  return {
    updates,
    summary: {
      beforeMastery: current.masteryLevel,
      afterMastery: nextMastery,
      beforeBox: current.box,
      afterBox: nextBox,
      demoted,
      changed: nextMastery !== current.masteryLevel || nextBox !== current.box,
    },
  };
}

const ProductionPromptService = require('../brain/ProductionPromptService');

let registered = false;
let service = null;

function getBookTitle(bookId) {
  if (!bookId) return '';
  try {
    const row = db.prepare('SELECT name FROM book WHERE id = ?').get(bookId);
    return row?.name || '';
  } catch (_) {
    return '';
  }
}

function extractBackText(point) {
  if (!point?.back) return '';
  try {
    const parsed =
      typeof point.back === 'string' ? JSON.parse(point.back) : point.back;
    return parsed?.text || '';
  } catch (_) {
    return typeof point.back === 'string' ? point.back : '';
  }
}

function registerProductionPromptHandlers(store) {
  if (registered) {
    console.warn('[productionPromptHandlers] already registered, skipping');
    return;
  }
  registered = true;
  service = new ProductionPromptService({ store });

  ipcMain.handle('production-get-prompt', async (_event, payload) => {
    try {
      const { id, token } = payload || {};
      if (!id) return { learningPoint: null };
      const point = await learningPointService.getLearningPointById(id, token);
      if (!point) return { learningPoint: null };
      const bookTitle = getBookTitle(point.bookId);
      const backText = extractBackText(point);
      return {
        learningPoint: {
          id: point.id,
          title: point.title,
          bookTitle,
          bookId: point.bookId,
          domainType: point.domainType,
          masteryLevel: point.masteryLevel,
          backText,
        },
      };
    } catch (err) {
      console.error('[productionPromptHandlers] get-prompt failed:', err);
      return { learningPoint: null, error: err?.message };
    }
  });

  ipcMain.handle('production-grade-answer', async (_event, payload) => {
    try {
      const { id, answer = '', token } = payload || {};
      if (!id || !answer.trim()) return { error: 'Empty answer.' };
      const point = await learningPointService.getLearningPointById(id, token);
      if (!point) return { error: 'Learning point not found.' };
      const bookTitle = getBookTitle(point.bookId);
      const backText = extractBackText(point);
      const grading = await comprehensionGradingService.gradeAnswer({
        chapterTitle: point.title,
        textExcerpt: backText,
        bookTitle,
        question: `Explain "${point.title}" in your own words.`,
        answer,
      });
      if (grading?.error) return grading;

      // Submitting IS the commitment — write the SRS delta now so the
      // panel can display "mastery 80 → 35" in the result state. The
      // `Done` button after this is acknowledgement, not commitment.
      // Writes via service.updateLearningPoint so the change lands in
      // Kùzu (where lp-get-all reads from), not the dead SQLite mirror.
      const { updates, summary } = computeProductionGradeDelta(
        point,
        grading.score,
      );
      await learningPointService.updateLearningPoint(id, updates, token);
      return { ...grading, update: summary };
    } catch (err) {
      console.error('[productionPromptHandlers] grade-answer failed:', err);
      return { error: err?.message || 'grading failed' };
    }
  });

  ipcMain.handle('production-complete', (_event, payload) => {
    try {
      const { id, token } = payload || {};
      if (!id) return { ok: false };
      const userId = token ? getUserIdFromToken(token) : 1;
      const cleared = service.clearPrompt(userId > 0 ? userId : 1, id);
      return { ok: true, cleared };
    } catch (err) {
      console.error('[productionPromptHandlers] complete failed:', err);
      return { ok: false, error: err?.message };
    }
  });

  ipcMain.handle('production-skip', (_event, payload) => {
    try {
      const { id, token } = payload || {};
      if (!id) return { ok: false };
      const userId = token ? getUserIdFromToken(token) : 1;
      // Symmetric with production-complete: `cleared` reports whether a
      // dedup record existed; `ok` reports whether the skip operation
      // itself succeeded. A "no such record" outcome is a successful
      // no-op, not a failure.
      const cleared = service.clearPrompt(userId > 0 ? userId : 1, id);
      return { ok: true, cleared };
    } catch (err) {
      console.error('[productionPromptHandlers] skip failed:', err);
      return { ok: false, error: err?.message };
    }
  });
}

export default registerProductionPromptHandlers;
export { registerProductionPromptHandlers };
