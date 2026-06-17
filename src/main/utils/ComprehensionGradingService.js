/* eslint-disable class-methods-use-this */
/**
 * ComprehensionGradingService — Phase 6 chapter-end comprehension loop.
 *
 * Two-step flow:
 *   1. generateQuestion({ chapterTitle, textExcerpt, bookTitle })
 *      → plain string question (no schema, the whole response IS the question)
 *   2. gradeAnswer({ chapterTitle, textExcerpt, bookTitle, question, answer })
 *      → { score, strengths, gaps, feedback }
 *
 * Scores: 0-49 = significant gaps, 50-74 = partial, 75-100 = solid understanding
 *
 * Text excerpt is capped at 3 000 chars here (prompts also cap) so that
 * accumulated paragraph text from the hook doesn't balloon the AI call.
 */

import { instanceInMain as aiProviderManager } from '../../commons/service/AIProviderManager';
import {
  createComprehensionPromptPrompt,
  createComprehensionGradingPrompt,
} from '../../commons/utils/AIPrompts';

const EXCERPT_CHAR_LIMIT = 3000;

const GRADING_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer' },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    feedback: { type: 'string' },
  },
  required: ['score', 'strengths', 'gaps', 'feedback'],
};

class ComprehensionGradingService {
  /**
   * Generate an open-ended comprehension question for a chapter.
   * Returns the question string, or null on failure.
   *
   * @param {Object} input
   * @param {string} input.chapterTitle
   * @param {string} [input.textExcerpt]
   * @param {string} [input.bookTitle]
   * @returns {Promise<string|null>}
   */
  async generateQuestion(input = {}) {
    const {
      chapterTitle = '',
      textExcerpt = '',
      bookTitle = '',
      userId,
      bookId,
      chapterIndex,
    } = input;

    if (!aiProviderManager.currentProvider) return null;

    const prompt = createComprehensionPromptPrompt({
      chapterTitle,
      textExcerpt: textExcerpt.slice(0, EXCERPT_CHAR_LIMIT),
      bookTitle,
    });

    let text;
    let questionCallId = null;
    try {
      const { brainCall } = require('../brain/spine');
      const result = await brainCall(
        'grade-comprehension',
        prompt,
        {
          userId: userId || 1,
          contextOverrides: {
            currentBook: bookId
              ? { bookId, chapterIndex, chapterTitle }
              : undefined,
          },
        },
      );
      text = result.output;
      questionCallId = result.callId;
    } catch (err) {
      console.error(
        '[ComprehensionGradingService] generateQuestion failed:',
        err,
      );
      return null;
    }

    if (typeof text !== 'string' || !text.trim()) return null;
    // Returns a plain string so the IPC handler and renderer callers can use it
    // directly. The callId is logged for brain_call_ledger traceability; it
    // cannot be attached to the primitive without breaking the string contract.
    const question = text.trim();
    console.log(
      `[ComprehensionGradingService] generateQuestion callId=${questionCallId}`,
    );
    return question;
  }

  /**
   * Grade the reader's free-text answer.
   * Returns { score, strengths, gaps, feedback } or { error } on failure.
   *
   * @param {Object} input
   * @param {string} input.chapterTitle
   * @param {string} [input.textExcerpt]
   * @param {string} [input.bookTitle]
   * @param {string} input.question
   * @param {string} input.answer
   * @returns {Promise<Object>}
   */
  async gradeAnswer(input = {}) {
    const {
      chapterTitle = '',
      textExcerpt = '',
      bookTitle = '',
      question = '',
      answer = '',
      userId,
      bookId,
      chapterIndex,
    } = input;

    if (!aiProviderManager.currentProvider) return { error: 'No AI provider configured.' };
    if (!answer.trim()) return { error: 'Empty answer.' };

    const prompt = createComprehensionGradingPrompt({
      chapterTitle,
      textExcerpt: textExcerpt.slice(0, EXCERPT_CHAR_LIMIT),
      bookTitle,
      question,
      answer,
    });

    let raw;
    let gradingCallId = null;
    try {
      const { brainCall } = require('../brain/spine');
      const result = await brainCall(
        'grade-comprehension',
        prompt,
        {
          userId: userId || 1,
          schema: GRADING_SCHEMA,
          contextOverrides: {
            currentBook: bookId
              ? { bookId, chapterIndex }
              : undefined,
          },
        },
      );
      raw = result.output;
      gradingCallId = result.callId;
    } catch (err) {
      return { error: err?.message || 'Grading call failed.' };
    }

    if (!raw || typeof raw !== 'object') {
      return { error: 'AI returned empty grading result.' };
    }

    return {
      score:
        typeof raw.score === 'number'
          ? Math.max(0, Math.min(100, raw.score))
          : 0,
      strengths: Array.isArray(raw.strengths)
        ? raw.strengths.filter(Boolean)
        : [],
      gaps: Array.isArray(raw.gaps) ? raw.gaps.filter(Boolean) : [],
      feedback: typeof raw.feedback === 'string' ? raw.feedback.trim() : '',
      callId: gradingCallId,
    };
  }
}

const comprehensionGradingService = new ComprehensionGradingService();
export default comprehensionGradingService;
