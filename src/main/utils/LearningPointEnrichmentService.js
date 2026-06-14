/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/**
 * LearningPointEnrichmentService — Phase 3d batch enrichment.
 *
 * Walks the user's `learning_point` rows, detects each row's domain from
 * its front/back text, and populates the typed `extras` payload that
 * Phase 3b extractors produce + Phase 3c cards render. Existing rows that
 * already have populated extras are skipped.
 *
 * IMPORTANT — divergence between the type system and the live writer:
 * `LearningPointDomains.ts` declares 13 domains; the LIVE LearningPointService
 * validator (src/main/utils/LearningPointService.js) accepts only the 6 in
 * LIVE_WRITABLE_DOMAINS (vocabulary, knowledge, math, reading, language, skill).
 * This service updates `extras` for ALL rows where extraction succeeds, but
 * updates `domainType` ONLY when the detected domain is in the live-writable
 * subset. Non-writable detected domains (physics, chemistry, biology,
 * programming, history, geography, custom) keep the row's existing
 * domainType — extras still populate, so cards will route correctly once
 * the live enum widens.
 *
 * Cancellation: pass a `signal` (or call `cancel()`); the loop honors it
 * between items.
 *
 * Cost on DeepSeek-V3 (per-item):
 *   - Heuristic-only domain detection:   $0 (synchronous regex)
 *   - 1 extraction call:                 ~$0.0002
 *   - 1000 items → ~$0.20; 5000 → ~$1
 *
 * Phase 3d does NOT auto-trigger this service on launch — wiring that
 * decision (settings toggle vs first-launch batch) is deliberately deferred
 * to a follow-up.
 */

import { learningPointService } from './LearningPointService';
import { instanceInMain as aiProviderManager } from '../../commons/service/AIProviderManager';
import {
  parseExtras,
  serializeExtras,
} from '../../commons/utils/learningPointExtras';
import { detectDomain } from '../../commons/utils/DomainDetector';
import { extractForDomain } from './extractors';
import { LIVE_WRITABLE_DOMAINS } from '../../commons/model/LearningPointDomains';

const DEFAULTS = {
  batchSize: 10,
  throttleMs: 200,
  minTextLength: 20,
  useAIDomainDetection: false, // heuristic-only by default; AI is opt-in for cost
};

function extractTextFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    return content.text || content.html || content.latex || content.code || '';
  }
  return '';
}

// Pull a single text blob from the structured front/back JSON columns.
function combineText(item) {
  if (!item) return '';
  const frontText = extractTextFromContent(item.front);
  const backText = extractTextFromContent(item.back);
  return `${frontText}\n${backText}`.trim();
}

// Items where extras is empty AND text is non-trivially long are eligible.
function isEligible(item, minTextLength) {
  const extras = parseExtras(item?.extras);
  if (Object.keys(extras).length > 0) return false;
  const text = combineText(item);
  return text.length >= minTextLength;
}

class LearningPointEnrichmentService {
  constructor() {
    if (LearningPointEnrichmentService.instance) {
      // eslint-disable-next-line no-constructor-return
      return LearningPointEnrichmentService.instance;
    }
    LearningPointEnrichmentService.instance = this;

    this.running = false;
    this.cancelRequested = false;
    this.lastProgress = null;
  }

  /**
   * Cancel an in-progress enrichment run. The loop checks between items.
   */
  cancel() {
    if (this.running) this.cancelRequested = true;
  }

  isRunning() {
    return this.running;
  }

  getLastProgress() {
    return this.lastProgress;
  }

  /**
   * How many of the user's learning points need enrichment? Cheap — does
   * not run AI calls. Useful for UI gating ("enrich 423 cards?").
   *
   * @param {string} token
   * @param {Object} [options]
   * @param {number} [options.minTextLength=DEFAULTS.minTextLength]
   * @returns {Promise<{ total: number, eligible: number }>}
   */
  // eslint-disable-next-line class-methods-use-this
  async getEligibleCount(token, options = {}) {
    const { minTextLength = DEFAULTS.minTextLength } = options;
    const items = await learningPointService.getAll(token, { limit: 100000 });
    if (!Array.isArray(items)) return { total: 0, eligible: 0 };
    const eligible = items.filter((it) => isEligible(it, minTextLength)).length;
    return { total: items.length, eligible };
  }

  /**
   * Run enrichment over all eligible learning points.
   *
   * @param {string} token
   * @param {Object} [options]
   * @param {number} [options.batchSize=10]      — items processed per "batch" before yielding
   * @param {number} [options.throttleMs=200]    — ms between AI calls (rate-limit guard)
   * @param {number} [options.minTextLength=20]  — skip items with too little text
   * @param {boolean} [options.useAIDomainDetection=false] — escalate to AI when heuristic returns null
   * @param {boolean} [options.dryRun=false]     — detect + extract but do NOT write
   * @param {Function} [options.onProgress]      — (progress) => void; called each item
   * @returns {Promise<Object>} final progress record
   */
  async runEnrichment(token, options = {}) {
    if (this.running) {
      return { error: 'Enrichment already running' };
    }
    if (!aiProviderManager.currentProvider) {
      return { error: 'No AI provider configured' };
    }

    const opts = { ...DEFAULTS, ...options };
    const items = await learningPointService.getAll(token, { limit: 100000 });
    if (!Array.isArray(items)) {
      return { error: 'Failed to load learning points' };
    }
    const eligible = items.filter((it) => isEligible(it, opts.minTextLength));

    const progress = {
      total: eligible.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      domainUpdates: 0,
      currentItemId: null,
      currentDomain: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      cancelled: false,
      dryRun: !!opts.dryRun,
    };

    this.running = true;
    this.cancelRequested = false;
    this.lastProgress = progress;

    try {
      for (let i = 0; i < eligible.length; i++) {
        if (this.cancelRequested) {
          progress.cancelled = true;
          break;
        }
        const item = eligible[i];
        progress.currentItemId = item.id;
        progress.processed = i + 1;

        const text = combineText(item);
        // 1. Detect domain.
        const detection = await detectDomain(text, {
          provider: opts.useAIDomainDetection
            ? aiProviderManager.currentProvider
            : null,
        });
        const detectedDomain = detection?.domain || 'knowledge';
        progress.currentDomain = detectedDomain;

        // 2. Extract typed extras for the detected domain.
        const result = await extractForDomain(detectedDomain, text);
        const extractionUsable =
          result &&
          result.source === 'ai' &&
          result.extras &&
          Object.keys(result.extras).length > 0;

        if (!extractionUsable) {
          progress.skipped++;
        } else {
          // 3. Build the update payload. extras always update; domainType only
          //    if detected is in the live-writable subset.
          const updates = { extras: result.extras };
          const detectedIsLiveWritable =
            LIVE_WRITABLE_DOMAINS.includes(detectedDomain);
          if (detectedIsLiveWritable && detectedDomain !== item.domainType) {
            updates.domainType = detectedDomain;
          }

          if (opts.dryRun) {
            progress.succeeded++;
            if (updates.domainType) progress.domainUpdates++;
          } else {
            const updateResult = await learningPointService.updateLearningPoint(
              item.id,
              updates,
              token,
            );
            if (updateResult && !updateResult.error) {
              progress.succeeded++;
              if (updates.domainType) progress.domainUpdates++;
            } else {
              progress.failed++;
              console.warn(
                `[Enrichment] update failed for ${item.id}:`,
                updateResult?.error || '(unknown)',
              );
            }
          }
        }

        if (opts.onProgress) opts.onProgress({ ...progress });
        await this.sleep(opts.throttleMs);
      }
    } finally {
      progress.finishedAt = new Date().toISOString();
      progress.currentItemId = null;
      progress.currentDomain = null;
      this.running = false;
      this.cancelRequested = false;
      this.lastProgress = progress;
    }

    return progress;
  }

  // Small helper so tests can stub timing.
  // eslint-disable-next-line class-methods-use-this
  sleep(ms) {
    if (!ms || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

// Singleton instance — matches the project pattern (LearningPointService, etc.)
const learningPointEnrichmentService = new LearningPointEnrichmentService();

export default learningPointEnrichmentService;
export {
  LearningPointEnrichmentService,
  parseExtras,
  serializeExtras,
  isEligible,
  combineText,
};
