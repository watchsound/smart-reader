/**
 * microCardApi — renderer client for the Phase 4 micro-card proposer.
 *
 * Typical usage (called from the reading view when a paragraph completes):
 *
 *   const result = await microCardApi.propose({
 *     text: paragraphText,
 *     bookId, chapterId, bookTitle, chapterTitle,
 *     knownConcepts: cachedConcepts,
 *   });
 *   if (result.proposed) {
 *     showChip(result);                                  // surface UI
 *     recordEvent.cardProposed({                         // tell the Brain
 *       proposalId: result.proposalId,
 *       bookId, chapterId,
 *       paragraphHash: result.paragraphHash,
 *       front: result.front, back: result.back,
 *       domain: result.domain, confidence: result.confidence,
 *     });
 *   }
 *
 * The accept/dismiss flow is recorded via brainApi.recordEvent.cardAccepted /
 * cardAcknowledged / cardDismissed — there is no main-side handler for it
 * yet. Phase 4c will add the actual learning-point creation.
 */

const { ipcRenderer } = window.electron || {};

const microCardApi = {
  /**
   * Evaluate a paragraph; returns a proposal or a skip reason.
   * @param {Object} input — { text, bookId, chapterId, bookTitle, chapterTitle, knownConcepts }
   * @param {Object} [options] — { minWords, minSentences, maxPerChapter, minConfidence }
   * @returns {Promise<Object>}
   */
  async propose(input, options) {
    return ipcRenderer?.invoke('microcard-propose', input, options || {});
  },

  /** Tell the proposer to stop surfacing chips for this chapter (e.g. after several dismissals). */
  freezeChapter(bookId, chapterId) {
    return ipcRenderer?.sendSync('microcard-freeze-chapter', {
      bookId,
      chapterId,
    });
  },

  /** Clear per-chapter cached state (omit bookId to clear everything). */
  resetState(bookId) {
    return ipcRenderer?.sendSync('microcard-reset-state', { bookId });
  },

  /** Telemetry snapshot — { [chapterKey]: { proposalCount, seenCount } }. */
  getState() {
    return ipcRenderer?.sendSync('microcard-get-state');
  },

  /**
   * Phase 4c: turn an accepted proposal into a real learning_point.
   *
   * @param {Object} args
   * @param {Object} args.proposal — the proposal returned by `propose()`
   * @param {'accept'|'acknowledge'} [args.mode='accept']
   *   - 'accept': normal flow, card enters SR scheduling
   *   - 'acknowledge': "I already know this" — card treated as a deep-decay refresher
   * @param {string} args.token — user auth token
   * @param {string|number} [args.bookId] — for sourceId tracking
   * @param {string} [args.sourceText] — original paragraph; improves extras enrichment
   * @returns {Promise<{ success: boolean, learningPointId?: string, error?: string }>}
   */
  async accept({ proposal, mode = 'accept', token, bookId, sourceText }) {
    return ipcRenderer?.invoke('microcard-accept', {
      proposal,
      mode,
      token,
      bookId,
      sourceText,
    });
  },
};

export default microCardApi;
