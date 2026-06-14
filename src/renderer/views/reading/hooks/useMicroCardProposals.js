/**
 * useMicroCardProposals — Phase 4b in-reading proposer wiring.
 *
 * Reader-type agnostic. The reading view (EPubView / PDFView / Browser)
 * decides WHEN to call `processText(text, context)` — typically when a
 * page completes or a chapter changes. The hook handles:
 *
 *   - debounced single-flight calls to microCardApi.propose (no overlap)
 *   - emitting CARD_PROPOSED / CARD_ACCEPTED / CARD_ACKNOWLEDGED /
 *     CARD_DISMISSED episodes
 *   - tracking consecutive dismissals → auto-freezes the chapter after
 *     `dismissBackoffThreshold` strikes
 *   - clearing state on chapter / book changes
 *
 * UI shape: the hook exposes `currentProposal` (or null). The reading
 * view renders <MicroCardChip /> bound to those callbacks. Tap-once →
 * accept; tap-twice (or long-press, caller's choice) → acknowledge.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import microCardApi from '../../../api/microCardApi';
import { recordEvent } from '../../../api/brainApi';
import customStorage from '../../../store/customStorage';

const DEFAULTS = {
  dismissBackoffThreshold: 3, // consecutive dismissals → freeze chapter
};

function chapterKey(bookId, chapterId) {
  return `${bookId || 'no-book'}::${chapterId || 'no-chapter'}`;
}

/**
 * @param {Object} args
 * @param {string|number} args.bookId
 * @param {string} [args.bookTitle]
 * @param {string} [args.token] — optional override; defaults to customStorage.getToken()
 * @param {boolean} [args.enabled=true] — kill switch (user setting)
 * @param {number} [args.dismissBackoffThreshold]
 * @returns {{
 *   currentProposal: Object|null,
 *   isProcessing: boolean,
 *   processText: (text: string, context: { chapterId, chapterTitle }) => Promise<void>,
 *   acceptProposal: () => Promise<void>,
 *   acknowledgeProposal: () => Promise<void>,
 *   dismissProposal: (reason?: string) => void,
 *   clear: () => void,
 * }}
 */
export default function useMicroCardProposals({
  bookId,
  bookTitle,
  token: tokenOverride,
  enabled = true,
  dismissBackoffThreshold = DEFAULTS.dismissBackoffThreshold,
} = {}) {
  const [currentProposal, setCurrentProposal] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Per-chapter consecutive-dismissal counter; reset on accept/acknowledge.
  const dismissalStreakRef = useRef(new Map());
  // Single-flight guard — drop overlapping processText calls.
  const inFlightRef = useRef(false);
  // Track the latest bookId so cleanup-on-unmount knows which book to reset.
  const bookIdRef = useRef(bookId);
  useEffect(() => {
    bookIdRef.current = bookId;
  }, [bookId]);

  // Reset proposer state when the book changes.
  useEffect(() => {
    if (bookId !== undefined && bookId !== null) {
      microCardApi.resetState(bookId);
    }
    dismissalStreakRef.current = new Map();
    setCurrentProposal(null);
    return () => {
      // On unmount or before next bookId change, drop in-memory state for
      // the book we're leaving so the next session starts clean.
      if (bookIdRef.current !== undefined && bookIdRef.current !== null) {
        microCardApi.resetState(bookIdRef.current);
      }
    };
  }, [bookId]);

  const processText = useCallback(
    async (text, context = {}) => {
      if (!enabled || !text || !bookId) return;
      if (inFlightRef.current) return; // drop overlapping requests
      inFlightRef.current = true;
      setIsProcessing(true);
      try {
        const result = await microCardApi.propose({
          text,
          bookId,
          bookTitle,
          chapterId: context.chapterId,
          chapterTitle: context.chapterTitle,
          knownConcepts: context.knownConcepts,
        });
        if (result && result.proposed) {
          // Don't overwrite an active proposal the user hasn't decided on.
          // The new one is dropped — proposer state was already updated, so
          // we don't re-ask later either.
          setCurrentProposal((prev) => {
            if (prev) return prev;
            // Emit CARD_PROPOSED only when the chip actually surfaces.
            recordEvent.cardProposed({
              proposalId: result.proposalId,
              bookId,
              chapterId: context.chapterId,
              paragraphHash: result.paragraphHash,
              front: result.front,
              back: result.back,
              domain: result.domain,
              confidence: result.confidence,
            });
            return { ...result, chapterId: context.chapterId };
          });
        }
      } catch (err) {
        console.warn('[useMicroCardProposals] propose failed', err);
      } finally {
        inFlightRef.current = false;
        setIsProcessing(false);
      }
    },
    [enabled, bookId, bookTitle],
  );

  // Phase 4c: persist the proposal via microcard-accept, then emit the
  // episode with the real learning_point id. We dismiss the chip
  // OPTIMISTICALLY so the UI is responsive — the create call can take
  // ~500ms-2s due to extras enrichment. If the create fails, we still
  // emit the episode (with null id) so the Brain sees the user intent;
  // a warning is logged so the failure isn't silent.
  const persistAndEmit = useCallback(
    async (mode) => {
      // Snapshot + clear UI synchronously.
      let snapshot = null;
      setCurrentProposal((proposal) => {
        snapshot = proposal;
        if (proposal) {
          const key = chapterKey(bookId, proposal.chapterId);
          dismissalStreakRef.current.set(key, 0);
        }
        return null;
      });
      if (!snapshot) return;

      // Fetch the auth token JIT — customStorage.getToken() is async, and
      // requiring callers to thread it through every hook usage is fragile
      // (it's how Phase 4c initially silently no-op'd). Allow an explicit
      // override via the `token` prop for tests / non-standard contexts.
      let token = tokenOverride;
      if (!token) {
        try {
          token = await customStorage.getToken();
        } catch (err) {
          console.warn('[useMicroCardProposals] token fetch failed:', err);
        }
      }

      let learningPointId = null;
      let actualStartingBox = null;
      try {
        const result = await microCardApi.accept({
          proposal: snapshot,
          mode,
          token,
          bookId,
          // Phase 4c: the original paragraph text isn't easily available
          // here; passing undefined falls back to front+back in the handler.
          sourceText: undefined,
        });
        if (result?.success) {
          learningPointId = result.learningPointId;
          actualStartingBox = result.startingBox ?? null;
        } else if (result?.error) {
          console.warn('[useMicroCardProposals] accept failed:', result.error);
        }
      } catch (err) {
        console.warn('[useMicroCardProposals] accept threw:', err);
      }

      const payload = {
        proposalId: snapshot.proposalId,
        learningPointId,
        planId: null,
      };
      if (mode === 'acknowledge') {
        // Report the ACTUAL box the card landed at — don't claim 4 if the
        // box-bump failed and it's still at the default 1.
        recordEvent.cardAcknowledged({
          ...payload,
          startingBox: actualStartingBox ?? 1,
        });
      } else {
        recordEvent.cardAccepted(payload);
      }
    },
    [bookId, tokenOverride],
  );

  const acceptProposal = useCallback(
    () => persistAndEmit('accept'),
    [persistAndEmit],
  );
  const acknowledgeProposal = useCallback(
    () => persistAndEmit('acknowledge'),
    [persistAndEmit],
  );

  const dismissProposal = useCallback(
    (reason) => {
      setCurrentProposal((proposal) => {
        if (!proposal) return null;
        const key = chapterKey(bookId, proposal.chapterId);
        const next = (dismissalStreakRef.current.get(key) || 0) + 1;
        dismissalStreakRef.current.set(key, next);
        recordEvent.cardDismissed({
          proposalId: proposal.proposalId,
          bookId,
          chapterId: proposal.chapterId,
          paragraphHash: proposal.paragraphHash,
          reason: reason || 'user-dismissed',
        });
        // Adaptive backoff — stop pestering this chapter.
        if (next >= dismissBackoffThreshold) {
          microCardApi.freezeChapter(bookId, proposal.chapterId);
        }
        return null;
      });
    },
    [bookId, dismissBackoffThreshold],
  );

  const clear = useCallback(() => {
    setCurrentProposal(null);
  }, []);

  return {
    currentProposal,
    isProcessing,
    processText,
    acceptProposal,
    acknowledgeProposal,
    dismissProposal,
    clear,
  };
}
