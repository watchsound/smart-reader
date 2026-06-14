/**
 * microCardHandlers — IPC surface for Phase 4 micro-card proposal.
 *
 * Channels:
 *   microcard-propose            (invoke)  → proposal result (or skip reason)
 *   microcard-accept             (invoke)  → { success, learningPointId } (Phase 4c)
 *   microcard-freeze-chapter     (sync)    → ack — back off this chapter
 *   microcard-reset-state        (sync)    → ack — clear per-chapter cache (book or all)
 *   microcard-get-state          (sync)    → telemetry snapshot
 *
 * `microcard-accept` (Phase 4c) creates the actual learning_point from a
 * proposal. It enriches the card with Phase 3b extras (so it renders via
 * the right Phase 3c specialty card), then calls
 * LearningPointService.createLearningPoint. Cards are stored with
 * sourceType='book' / sourceId=bookId — no plan grouping required.
 *
 * Dismiss episodes are recorded by the renderer via `brainApi.recordEvent`
 * directly — no main-side handler needed.
 */

import { ipcMain } from 'electron';
import microCardProposer from '../utils/MicroCardProposer';
import { learningPointService } from '../utils/LearningPointService';
import { extractForDomain } from '../utils/extractors';
import { LIVE_WRITABLE_DOMAINS } from '../../commons/model/LearningPointDomains';

let registered = false;

/**
 * @param {{ triggerEmitter?: import('../brain/TriggerEmitter') }} [services]
 */
function registerMicroCardHandlers(services = {}) {
  if (registered) {
    console.warn('[microCardHandlers] already registered, skipping');
    return;
  }
  registered = true;

  const triggerEmitter = services.triggerEmitter || null;

  ipcMain.handle('microcard-propose', async (_event, input, options) => {
    try {
      const result = await microCardProposer.proposeFromParagraph(
        input || {},
        options || {},
      );

      // Brain-driven shell (Plan 1): also emit a Trigger so the Orb
      // reflects the proposal and AtomicChipHost can render it. The
      // existing in-reader MicroCardChip continues to render via the
      // hook's local state — Plan 2 deduplicates to a single path.
      if (result?.proposed && triggerEmitter) {
        const { bookId, chapterId } = input || {};
        triggerEmitter.emit({
          id: `phase4:${bookId ?? 'no-book'}:${result.paragraphHash || result.proposalId}`,
          source: 'phase-4-micro-card',
          unit: 'atomic-chip',
          surfaceTarget: { kind: 'global' },
          priority: 'normal',
          freshness: 5 * 60 * 1000,
          payload: {
            title: result.conceptName || result.front || 'New micro-card',
            body: result.back || '',
            proposalId: result.proposalId,
            front: result.front,
            back: result.back,
            domain: result.domain,
            confidence: result.confidence,
            bookId,
            chapterId,
            paragraphHash: result.paragraphHash,
          },
        });
      }

      return result;
    } catch (err) {
      console.error('[microCardHandlers] propose failed:', err);
      return {
        proposed: false,
        reason: 'handler-error',
        error: err.message || 'propose failed',
      };
    }
  });

  ipcMain.on('microcard-freeze-chapter', (event, payload) => {
    const { bookId, chapterId } = payload || {};
    microCardProposer.freezeChapter(bookId, chapterId);
    event.returnValue = { ok: true };
  });

  ipcMain.on('microcard-reset-state', (event, payload) => {
    const { bookId } = payload || {};
    microCardProposer.resetState(bookId);
    event.returnValue = { ok: true };
  });

  ipcMain.on('microcard-get-state', (event) => {
    event.returnValue = microCardProposer.getStateSnapshot();
  });

  // Phase 4c: turn an accepted proposal into a real learning_point.
  // Input: { proposal, mode, token, bookId, sourceText? }
  //   - mode: 'accept' (default) | 'acknowledge'  (acknowledge = user
  //     already knows it; card starts at a higher mastery; uses 'easy'
  //     difficulty so the SR scheduler treats it as a refresher.)
  //   - sourceText: original paragraph used for richer extras enrichment.
  //     If omitted, falls back to proposal.front + proposal.back.
  // Returns: { success: boolean, learningPointId?: string, error?: string }
  ipcMain.handle('microcard-accept', async (_event, payload) => {
    try {
      const {
        proposal,
        mode = 'accept',
        token,
        bookId,
        sourceText,
      } = payload || {};
      if (!proposal || !proposal.front || !proposal.back) {
        return { success: false, error: 'Invalid proposal' };
      }

      // 1. Enrich with Phase 3b domain extras (best-effort — proceed even
      //    if AI is unavailable so the card still gets created).
      const detectedDomain = proposal.domain || 'knowledge';
      const enrichmentSource =
        (sourceText && sourceText.trim()) ||
        `${proposal.front}\n${proposal.back}`;
      let extras = {};
      try {
        const enrichment = await extractForDomain(
          detectedDomain,
          enrichmentSource,
        );
        if (
          enrichment &&
          enrichment.source === 'ai' &&
          enrichment.extras &&
          Object.keys(enrichment.extras).length > 0
        ) {
          extras = enrichment.extras;
        }
      } catch (err) {
        console.warn(
          '[microcard-accept] enrichment failed:',
          err?.message || err,
        );
      }

      // 2. Build the learning_point. domainType only set if it's in the
      //    LIVE-writable subset (LearningPointService validates this);
      //    extras populate regardless of domain validity.
      const learningPointInput = {
        front: proposal.front,
        back: proposal.back,
        extras,
        sourceType: 'book',
        sourceId: bookId != null ? String(bookId) : null,
        tags: proposal.conceptName ? [proposal.conceptName] : [],
        difficulty: mode === 'acknowledge' ? 'beginner' : 'intermediate',
      };
      if (LIVE_WRITABLE_DOMAINS.includes(detectedDomain)) {
        learningPointInput.domainType = detectedDomain;
      }

      // 3. Create via the live service.
      const created = await learningPointService.createLearningPoint(
        learningPointInput,
        token,
      );
      if (!created || created.error) {
        return {
          success: false,
          error: created?.error || 'Failed to create learning point',
        };
      }

      // 4. Acknowledge mode means "I already know this — track as a
      //    deep-decay refresher." createLearningPoint always starts at
      //    box 1; bump to box 4 via a follow-up update so the SR scheduler
      //    treats the card as a refresher rather than fresh learning.
      //    Failure here is non-fatal — the card still exists at box 1.
      let actualStartingBox = 1;
      if (mode === 'acknowledge' && created.id) {
        const updated = await learningPointService.updateLearningPoint(
          created.id,
          { box: 4 },
          token,
        );
        if (updated && !updated.error) {
          actualStartingBox = 4;
        } else {
          console.warn(
            '[microcard-accept] box-bump for acknowledge failed:',
            updated?.error || '(unknown)',
          );
        }
      }

      return {
        success: true,
        learningPointId: created.id,
        domainType: created.domainType,
        sourceType: created.sourceType,
        mode,
        startingBox: actualStartingBox,
      };
    } catch (err) {
      console.error('[microcard-accept] failed:', err);
      return { success: false, error: err.message || 'accept failed' };
    }
  });
}

export default registerMicroCardHandlers;
export { registerMicroCardHandlers };
