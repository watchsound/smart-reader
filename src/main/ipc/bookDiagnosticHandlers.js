/**
 * bookDiagnosticHandlers — IPC surface for Phase 5 pre-book diagnostic.
 *
 * Channels:
 *   book-diagnostic-get          (invoke)  → cached diagnostic JSON or null
 *   book-diagnostic-run          (invoke)  → full diagnostic object or { error }
 *   book-diagnostic-mark-opened  (invoke)  → { firstOpenedAt, wasFirstOpen }
 *
 * `book-diagnostic-run` calls BookDiagnosticService.run() which performs
 * exactly one AI call (the deterministic known-concept annotation runs
 * locally). The result is cached on the book row so re-runs are explicit
 * (user can request a refresh; otherwise the cache holds).
 *
 * `book-diagnostic-mark-opened` is idempotent — the second call returns
 * `wasFirstOpen: false` so the renderer can skip showing the panel.
 *
 * `bookId` is the SQLite primary key (number). Token is required for
 * user-scoping (the same book id only exists in one user's library).
 */

import { ipcMain } from 'electron';
import bookDiagnosticService from '../utils/BookDiagnosticService';
import {
  getBookDiagnostic,
  setBookDiagnostic,
  markBookFirstOpened,
  getBookById,
} from '../db/BookManager';
import graphLearningFeatures from '../utils/GraphLearningFeatures';

let registered = false;

/**
 * Pull the learner's mastered-concept names from the graph (Concept nodes
 * with masteryLevel ≥ 70). Returns [] if the graph is unavailable —
 * diagnostic still works, just with no personalization.
 *
 * NOTE: the LearnerProfileManager (SQLite) stores learner *style* and
 * aggregate signals — NOT lists of known concepts. Concept-level mastery
 * lives in the graph; that's the right source here.
 */
async function loadKnownConcepts(token) {
  try {
    const rows = await graphLearningFeatures.getKnownConcepts(token);
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => r?.name).filter(Boolean);
  } catch (err) {
    console.warn(
      '[bookDiagnosticHandlers] loadKnownConcepts failed:',
      err?.message || err,
    );
    return [];
  }
}

function registerBookDiagnosticHandlers() {
  if (registered) {
    console.warn('[bookDiagnosticHandlers] already registered, skipping');
    return;
  }
  registered = true;

  ipcMain.handle('book-diagnostic-get', async (_event, payload) => {
    try {
      const { bookId, token } = payload || {};
      if (!bookId) return null;
      return getBookDiagnostic(bookId, token);
    } catch (err) {
      console.error('[bookDiagnosticHandlers] get failed:', err);
      return null;
    }
  });

  ipcMain.handle('book-diagnostic-run', async (_event, payload) => {
    try {
      const {
        bookId,
        token,
        toc,
        knownConcepts: knownOverride,
      } = payload || {};
      if (!bookId) return { error: 'bookId required' };
      const book = getBookById(bookId, token);
      if (!book) return { error: 'Book not found.' };

      // Known concepts come from the Brain by default; an explicit override
      // is accepted (tests / future callers that already have the list).
      const knownConcepts =
        Array.isArray(knownOverride) && knownOverride.length > 0
          ? knownOverride
          : await loadKnownConcepts(token);

      const result = await bookDiagnosticService.run({
        bookTitle: book.name || book.subtitle || '',
        bookAuthor: book.author || '',
        bookCategory: book.category || '',
        toc: Array.isArray(toc) ? toc : [],
        knownConcepts,
      });
      if (result && !result.error) {
        // Cache the diagnostic so subsequent opens skip the AI call.
        setBookDiagnostic(bookId, result, token);
      }
      return result;
    } catch (err) {
      console.error('[bookDiagnosticHandlers] run failed:', err);
      return { error: err.message || 'diagnostic run failed' };
    }
  });

  ipcMain.handle('book-diagnostic-mark-opened', async (_event, payload) => {
    try {
      const { bookId, token } = payload || {};
      if (!bookId) return { wasFirstOpen: false, firstOpenedAt: '' };
      const rc = markBookFirstOpened(bookId, token);
      const book = getBookById(bookId, token);
      return {
        wasFirstOpen: rc === 1,
        firstOpenedAt: book?.firstOpenedAt || '',
      };
    } catch (err) {
      console.error('[bookDiagnosticHandlers] mark-opened failed:', err);
      return { wasFirstOpen: false, firstOpenedAt: '' };
    }
  });
}

export default registerBookDiagnosticHandlers;
export { registerBookDiagnosticHandlers };
