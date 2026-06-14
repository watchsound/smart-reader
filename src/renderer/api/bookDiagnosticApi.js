/**
 * bookDiagnosticApi — renderer client for the Phase 5 pre-book diagnostic.
 *
 * Typical flow (from the reading view on first-open of a book):
 *
 *   const opened = await bookDiagnosticApi.markOpened({ bookId, token });
 *   if (!opened.wasFirstOpen) return;            // panel already shown
 *
 *   let diagnostic = await bookDiagnosticApi.get({ bookId, token });
 *   if (!diagnostic) {
 *     diagnostic = await bookDiagnosticApi.run({ bookId, token, toc });
 *   }
 *   showPanel(diagnostic);
 *
 * Note: `run()` performs one AI call (~1-3s on DeepSeek) and caches the
 * result on the book row. Re-runs are explicit — call `run()` again to
 * refresh; otherwise `get()` returns the cached version.
 */

const { ipcRenderer } = window.electron || {};

const bookDiagnosticApi = {
  /** Read the cached diagnostic, or null if not yet generated. */
  async get({ bookId, token }) {
    return ipcRenderer?.invoke('book-diagnostic-get', { bookId, token });
  },

  /**
   * Run a fresh diagnostic and cache the result.
   *
   * @param {Object} args
   * @param {number} args.bookId
   * @param {string} args.token
   * @param {Array} args.toc — raw TOC array from the reader (EPubView's tocChanged)
   * @param {string[]} [args.knownConcepts] — override Brain-derived known concepts
   * @returns {Promise<Object>} diagnostic object or { error }
   */
  async run({ bookId, token, toc, knownConcepts }) {
    return ipcRenderer?.invoke('book-diagnostic-run', {
      bookId,
      token,
      toc,
      knownConcepts,
    });
  },

  /**
   * Mark the book as first-opened. Idempotent — `wasFirstOpen` is false
   * on subsequent calls so the renderer can skip showing the panel.
   *
   * @returns {Promise<{ wasFirstOpen: boolean, firstOpenedAt: string }>}
   */
  async markOpened({ bookId, token }) {
    return ipcRenderer?.invoke('book-diagnostic-mark-opened', {
      bookId,
      token,
    });
  },
};

export default bookDiagnosticApi;
