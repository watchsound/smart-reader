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
import { getStructured } from '../../commons/service/polyfills/structuredOutput';

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
    const { chapterTitle = '', textExcerpt = '', bookTitle = '' } = input;

    const provider = aiProviderManager.currentProvider;
    if (!provider) return null;

    const prompt = createComprehensionPromptPrompt({
      chapterTitle,
      textExcerpt: textExcerpt.slice(0, EXCERPT_CHAR_LIMIT),
      bookTitle,
    });

    try {
      const text = await provider.generateContent(prompt);
      return typeof text === 'string' && text.trim() ? text.trim() : null;
    } catch (err) {
      console.error(
        '[ComprehensionGradingService] generateQuestion failed:',
        err,
      );
      return null;
    }
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
    } = input;

    const provider = aiProviderManager.currentProvider;
    if (!provider) return { error: 'No AI provider configured.' };
    if (!answer.trim()) return { error: 'Empty answer.' };

    const prompt = createComprehensionGradingPrompt({
      chapterTitle,
      textExcerpt: textExcerpt.slice(0, EXCERPT_CHAR_LIMIT),
      bookTitle,
      question,
      answer,
    });

    let raw;
    try {
      raw = await getStructured(provider, prompt, GRADING_SCHEMA, {
        schemaName: 'comprehensionGrading',
        maxRetries: 1,
      });
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
    };
  }
}

const comprehensionGradingService = new ComprehensionGradingService();
export default comprehensionGradingService;
