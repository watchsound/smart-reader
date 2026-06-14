/**
 * useReadingEpisodes — silent reading-behavior signal collection (Phase 2).
 *
 * Captures CHAPTER_ENTERED, CHAPTER_LEFT, and BACKTRACK signals as the user
 * navigates an EPUB or PDF. Designed to be the SINGLE instrumentation point
 * for both reader types — `reading/index.js` already aggregates page-change
 * events from EPubView and PDFView via the shared `handlePageChange` callback,
 * so wiring there gives full coverage with one hook.
 *
 * The 30-day clock starts the moment this hook ships — downstream features
 * (pre-book diagnostic calibration, micro-card tuning, tutor-mode struggle
 * detection) all depend on this signal stream existing in the Brain.
 *
 * Paragraph-level signals (PARAGRAPH_DWELL, PARAGRAPH_REREAD) require finer
 * DOM observation and are deferred to a follow-up.
 */

import { useRef, useCallback, useEffect } from 'react';
import { recordEvent } from '../../../api/brainApi';

// Page deltas below this threshold are treated as natural forward navigation
// (single-page reverse may be accidental — gesture overshoot, scroll bounce).
const BACKTRACK_PAGE_THRESHOLD = 2;

function emptyState() {
  return {
    bookId: null,
    bookType: null,
    lastChapterId: null,
    lastChapterName: null,
    lastChapterEnteredAt: null,
    lastPage: 0,
    pagesVisitedInChapter: 0,
  };
}

function emitChapterLeft(state, fallbackTotalPages = null) {
  if (!state.lastChapterId || !state.bookId) return;
  recordEvent.chapterLeft({
    bookId: state.bookId,
    bookType: state.bookType,
    chapterId: state.lastChapterId,
    chapterName: state.lastChapterName,
    durationMs: state.lastChapterEnteredAt
      ? Date.now() - state.lastChapterEnteredAt
      : null,
    pagesVisited: state.pagesVisitedInChapter,
    lastPage: state.lastPage,
    totalPages: fallbackTotalPages,
  });
}

/**
 * @param {Object} args
 * @param {string|number} args.bookId — the current book's stable id
 * @param {string} args.bookType — 'epub' | 'pdf'
 * @returns {{ trackPageChange: (pageInfo: Object) => void }}
 */
export default function useReadingEpisodes({ bookId, bookType }) {
  const stateRef = useRef(emptyState());

  const trackPageChange = useCallback(
    (pageInfo) => {
      if (!pageInfo || !bookId) return;
      const state = stateRef.current;
      const { curPage, totalPages, curChapter, curChapterId } = pageInfo;
      const now = Date.now();

      // Book changed under us — flush previous chapter and reset.
      if (state.bookId && state.bookId !== bookId) {
        emitChapterLeft(state);
        stateRef.current = emptyState();
      }
      const s = stateRef.current;
      s.bookId = bookId;
      s.bookType = bookType;

      // Chapter change.
      if (curChapterId && curChapterId !== s.lastChapterId) {
        if (s.lastChapterId) {
          emitChapterLeft(s, totalPages);
        }
        recordEvent.chapterEntered({
          bookId,
          bookType,
          chapterId: curChapterId,
          chapterName: curChapter,
          fromChapter: s.lastChapterId,
          fromChapterDurationMs: s.lastChapterEnteredAt
            ? now - s.lastChapterEnteredAt
            : null,
        });
        s.lastChapterId = curChapterId;
        s.lastChapterName = curChapter;
        s.lastChapterEnteredAt = now;
        s.pagesVisitedInChapter = 1;
        s.lastPage = typeof curPage === 'number' ? curPage : 0;
        return;
      }

      // Same chapter — check for backtrack (meaningful reverse navigation).
      if (
        typeof curPage === 'number' &&
        typeof s.lastPage === 'number' &&
        s.lastPage - curPage >= BACKTRACK_PAGE_THRESHOLD
      ) {
        recordEvent.backtrack({
          bookId,
          bookType,
          chapterId: curChapterId,
          fromPage: s.lastPage,
          toPage: curPage,
          pagesBack: s.lastPage - curPage,
        });
      }

      s.pagesVisitedInChapter += 1;
      if (typeof curPage === 'number') {
        s.lastPage = curPage;
      }
    },
    [bookId, bookType],
  );

  // Final flush on unmount so the last chapter's duration is captured.
  useEffect(() => {
    return () => {
      emitChapterLeft(stateRef.current);
    };
  }, []);

  return { trackPageChange };
}
