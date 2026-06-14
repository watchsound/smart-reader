/**
 * comprehensionHandlers — IPC surface for Phase 6 chapter-end comprehension.
 *
 * Channels:
 *   comprehension-generate-question  (invoke)  → { question: string } or { error }
 *   comprehension-grade-answer       (invoke)  → { score, strengths, gaps, feedback } or { error }
 *
 * Both calls receive the chapter text accumulated by useComprehensionCheck on
 * the renderer side. Text is capped in ComprehensionGradingService; the IPC
 * payload can pass the full string.
 *
 * Episode recording (COMPREHENSION_OFFERED / SUBMITTED / SKIPPED) happens on
 * the renderer side via brainApi.recordEvent so it goes through the existing
 * brain IPC path and doesn't need a separate handler here.
 */

import { ipcMain } from 'electron';
import comprehensionGradingService from '../utils/ComprehensionGradingService';

let registered = false;

function registerComprehensionHandlers() {
  if (registered) {
    console.warn('[comprehensionHandlers] already registered, skipping');
    return;
  }
  registered = true;

  ipcMain.handle('comprehension-generate-question', async (_event, payload) => {
    try {
      const {
        chapterTitle = '',
        textExcerpt = '',
        bookTitle = '',
      } = payload || {};
      const question = await comprehensionGradingService.generateQuestion({
        chapterTitle,
        textExcerpt,
        bookTitle,
      });
      if (!question) return { error: 'Could not generate a question.' };
      return { question };
    } catch (err) {
      console.error('[comprehensionHandlers] generate-question failed:', err);
      return { error: err?.message || 'question generation failed' };
    }
  });

  ipcMain.handle('comprehension-grade-answer', async (_event, payload) => {
    try {
      const {
        chapterTitle = '',
        textExcerpt = '',
        bookTitle = '',
        question = '',
        answer = '',
      } = payload || {};
      if (!answer.trim()) return { error: 'Empty answer.' };
      return await comprehensionGradingService.gradeAnswer({
        chapterTitle,
        textExcerpt,
        bookTitle,
        question,
        answer,
      });
    } catch (err) {
      console.error('[comprehensionHandlers] grade-answer failed:', err);
      return { error: err?.message || 'grading failed' };
    }
  });
}

export default registerComprehensionHandlers;
export { registerComprehensionHandlers };
