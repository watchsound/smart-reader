/* eslint-disable class-methods-use-this */
/**
 * LearningPathPlannerService — Phase 7 cross-book curriculum planner.
 *
 * Given a free-text learning goal, queries the user's library and produces
 * an ordered multi-book reading sequence via one AI call.
 *
 * Data sources:
 *   - SQLite `book` table (all books) — fetched by the IPC handler and passed in.
 *   - Phase 5 `diagnostic_data` column on each book row — JSON with topics,
 *     estimatedDifficulty, and per-chapter estimatedConcepts. Books that
 *     haven't been diagnosed yet are included as title-only entries.
 *
 * AI call budget:
 *   - Up to MAX_ANALYZED_BOOKS books with full diagnostic data in the prompt.
 *   - Up to MAX_UNANALYZED_BOOKS title-only books appended separately.
 *   - Both limits keep the prompt under ~4 000 tokens for mid-tier models.
 */

import { instanceInMain as aiProviderManager } from '../../commons/service/AIProviderManager';
import { createLearningPathPrompt } from '../../commons/utils/AIPrompts';

const MAX_ANALYZED_BOOKS = 20;
const MAX_UNANALYZED_BOOKS = 30;

const PATH_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    pathSteps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          bookId: { type: 'number' },
          bookTitle: { type: 'string' },
          chapterFocus: {},
          reason: { type: 'string' },
          estimatedHours: { type: 'number' },
        },
      },
    },
    coverageGaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'pathSteps'],
};

/**
 * Parse diagnostic_data JSON stored on a book row. Returns null if missing/invalid.
 */
function parseDiagnostic(book) {
  const raw = book.diagnosticData || book.diagnostic_data || '';
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

/**
 * Split books into those with diagnostic data and those without.
 * Caps both lists for prompt safety.
 */
function partitionBooks(books) {
  const { analyzed, unanalyzed } = books.reduce(
    (acc, book) => {
      const diag = parseDiagnostic(book);
      if (diag && Array.isArray(diag.chapters) && diag.chapters.length > 0) {
        acc.analyzed.push({ book, diag });
      } else {
        acc.unanalyzed.push(book);
      }
      return acc;
    },
    { analyzed: [], unanalyzed: [] },
  );
  return {
    analyzed: analyzed.slice(0, MAX_ANALYZED_BOOKS),
    unanalyzed: unanalyzed.slice(0, MAX_UNANALYZED_BOOKS),
  };
}

/**
 * Shape analyzed books into what the prompt builder expects.
 */
function shapeAnalyzed(entry) {
  const { book, diag } = entry;
  return {
    id: book.id,
    title: book.name || book.title || '(Untitled)',
    author: book.author || '',
    topics: diag.topics || [],
    estimatedDifficulty: diag.estimatedDifficulty || '',
    chapters: (diag.chapters || []).map((ch) => ({
      title: ch.title || '',
      estimatedConcepts: Array.isArray(ch.estimatedConcepts)
        ? ch.estimatedConcepts
        : [],
    })),
  };
}

function shapeUnanalyzed(book) {
  return {
    id: book.id,
    title: book.name || book.title || '(Untitled)',
    author: book.author || '',
  };
}

class LearningPathPlannerService {
  /**
   * Plan a multi-book reading curriculum for a given goal.
   *
   * @param {string} goal — free-text learning goal
   * @param {Array} books — all user books (from getBooksByCategory('', token))
   * @returns {Promise<Object>} { summary, pathSteps, coverageGaps, analyzedCount, totalBooks } or { error }
   */
  // TODO(multi-user): thread userId through from the IPC handler payload
  // so multi-user deployments get per-user Brain context.
  async plan(goal, books, opts = {}) {
    if (!goal || !goal.trim()) return { error: 'Learning goal is required.' };

    if (!aiProviderManager.currentProvider) return { error: 'No AI provider configured.' };

    const allBooks = Array.isArray(books) ? books : [];
    if (allBooks.length === 0) {
      return { error: 'Your library is empty. Add some books first.' };
    }

    const { analyzed, unanalyzed } = partitionBooks(allBooks);

    if (analyzed.length === 0) {
      return {
        error:
          'None of your books have been analyzed yet. Open a book to run the pre-reading diagnostic first.',
      };
    }

    const prompt = createLearningPathPrompt({
      goal: goal.trim(),
      analyzedBooks: analyzed.map(shapeAnalyzed),
      unaanalyzedBooks: unanalyzed.map(shapeUnanalyzed),
    });

    let raw;
    let planCallId = null;
    try {
      // eslint-disable-next-line global-require
      const { brainCall } = require('../brain/spine');
      const userId = opts.userId || 1;
      const brainResult = await brainCall(
        'plan-cross-book-path',
        prompt,
        { userId, schema: PATH_SCHEMA },
      );
      raw = brainResult.output;
      planCallId = brainResult.callId;
    } catch (err) {
      return { error: err?.message || 'AI call failed.' };
    }

    if (!raw || typeof raw !== 'object') {
      return { error: 'AI returned an empty plan.' };
    }

    const steps = Array.isArray(raw.pathSteps) ? raw.pathSteps : [];
    const validSteps = steps
      .filter((s) => s && (s.bookId || s.bookTitle))
      .map((s) => ({
        bookId: typeof s.bookId === 'number' ? s.bookId : null,
        bookTitle: String(s.bookTitle || '').trim(),
        chapterFocus: Array.isArray(s.chapterFocus)
          ? s.chapterFocus.filter(Boolean)
          : 'all',
        reason: String(s.reason || '').trim(),
        estimatedHours:
          typeof s.estimatedHours === 'number' ? s.estimatedHours : null,
      }));

    return {
      summary: String(raw.summary || '').trim(),
      pathSteps: validSteps,
      coverageGaps: Array.isArray(raw.coverageGaps)
        ? raw.coverageGaps.filter((g) => typeof g === 'string' && g.trim())
        : [],
      analyzedCount: analyzed.length,
      totalBooks: allBooks.length,
      callId: planCallId,
    };
  }
}

const learningPathPlannerService = new LearningPathPlannerService();
export default learningPathPlannerService;
