/**
 * useComprehensionCheck — chapter-end comprehension offer trigger (Phase 6).
 *
 * Fires after the reader leaves a chapter that had at least MIN_CHARS of
 * accumulated text. The offer is a one-shot per chapter per session — once
 * accepted, skipped, or dismissed it does not re-appear for that chapter.
 *
 * Interface:
 *   const { trackText, pendingOffer, dismissOffer } = useComprehensionCheck({ bookId, bookTitle, enabled });
 *
 *   trackText(text, pageInfo) — call from the onPageText + onPageChange path
 *   pendingOffer             — null | { chapterId, chapterName, textExcerpt }
 *   dismissOffer()           — clear the pending offer (user skipped / finished)
 *
 * The parent (reading/index.js) owns the panel state machine; this hook only
 * decides WHEN to surface the offer and provides the text snapshot for the AI call.
 *
 * Text accumulation strategy:
 *   - Text is keyed by chapterId and capped at EXCERPT_CHAR_CAP characters so the
 *     IPC payload stays reasonable. We keep a rolling window of the most-recent text
 *     (most relevant for comprehension) rather than the very beginning.
 *   - A chapter is "offer-eligible" when it accumulates MIN_CHARS and the reader
 *     has moved to a DIFFERENT chapter (not just turned a page within the same one).
 */

import { useRef, useCallback, useState } from 'react';

// Minimum accumulated chars before we consider a chapter offer-eligible.
const MIN_CHARS = 400;

// Max chars passed to the AI (ComprehensionGradingService caps further).
const EXCERPT_CHAR_CAP = 6000;

function emptyAccumulator() {
  return { text: '', chapterName: '' };
}

/**
 * @param {Object} args
 * @param {string|number} args.bookId
 * @param {string} [args.bookTitle]
 * @param {boolean} [args.enabled] — default true; set false for PDF/non-epub
 */
export default function useComprehensionCheck({ bookId, enabled = true }) {
  // chapterId → { text, chapterName }
  const accRef = useRef({});
  // Set of chapterIds that already had an offer (offered/skipped/dismissed).
  const offeredRef = useRef(new Set());
  // Last seen chapterId — used to detect chapter change.
  const lastChapterRef = useRef(null);

  const [pendingOffer, setPendingOffer] = useState(null);

  const dismissOffer = useCallback(() => {
    setPendingOffer(null);
  }, []);

  /**
   * Feed page text + current chapter info.
   * Call this from the reading view's onPageText / onPageChange callbacks.
   *
   * @param {string} text — raw page text
   * @param {{ curChapterId?: string, curChapter?: string }} pageInfo
   */
  const trackText = useCallback(
    (text, pageInfo) => {
      if (!enabled || !bookId) return;

      const chapterId = pageInfo?.curChapterId || '';
      const chapterName = pageInfo?.curChapter || '';

      // Initialize accumulator for new chapter
      if (!accRef.current[chapterId]) {
        accRef.current[chapterId] = emptyAccumulator();
      }

      const acc = accRef.current[chapterId];
      acc.chapterName = chapterName || acc.chapterName;

      // Accumulate text — rolling window keeps most-recent content
      if (text) {
        const combined = `${acc.text} ${text}`;
        acc.text =
          combined.length > EXCERPT_CHAR_CAP
            ? combined.slice(combined.length - EXCERPT_CHAR_CAP)
            : combined;
      }

      // Detect chapter change
      const prev = lastChapterRef.current;
      if (prev && prev !== chapterId) {
        // Reader left `prev` — check if it qualifies for an offer
        const prevAcc = accRef.current[prev];
        if (
          prevAcc &&
          prevAcc.text.trim().length >= MIN_CHARS &&
          !offeredRef.current.has(prev)
        ) {
          offeredRef.current.add(prev);
          setPendingOffer({
            chapterId: prev,
            chapterName: prevAcc.chapterName,
            textExcerpt: prevAcc.text.trim(),
          });
        }
      }

      lastChapterRef.current = chapterId;
    },
    [bookId, enabled],
  );

  // Reset when book changes
  const resetRef = useRef(bookId);
  if (resetRef.current !== bookId) {
    resetRef.current = bookId;
    accRef.current = {};
    offeredRef.current = new Set();
    lastChapterRef.current = null;
    // pendingOffer will be cleared on next render cycle via state
  }

  return { trackText, pendingOffer, dismissOffer };
}
