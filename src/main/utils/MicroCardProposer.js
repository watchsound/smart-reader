/* eslint-disable no-bitwise */
/* eslint-disable no-plusplus */
/**
 * MicroCardProposer — Phase 4a in-reading micro-card proposal pipeline.
 *
 * Given a paragraph the reader just finished, decides whether to propose
 * a flashcard. The pipeline:
 *
 *   1. Length gate     — paragraph word count ≥ minWords (default 50)
 *   2. Density gate    — ≥ 3 sentence-like terminators OR ≥ minDefinitionWords
 *   3. Dedup gate      — paragraph hash not seen before for this chapter
 *   4. Rate gate       — < maxPerChapter proposals already surfaced for this chapter
 *   5. AI generation   — LLM is the quality gate, can return shouldPropose=false
 *   6. Quality gate    — proposal has non-empty front/back, confidence ≥ threshold
 *
 * Each stage returns a result object so callers can show telemetry / debug
 * why a paragraph was skipped. Successful proposals get a stable proposalId
 * so the renderer can correlate the chip → accept/dismiss flow.
 *
 * Per-chapter rate state lives in-memory on the singleton (resets on app
 * restart, which is fine — proposals are session-scoped).
 *
 * This module does NOT auto-call brainApi.recordEvent — the renderer
 * decides when to emit CARD_PROPOSED (typically when the chip surfaces)
 * so we don't double-count proposals that the user never sees.
 */

import { v4 as uuidv4 } from 'uuid';
import { instanceInMain as aiProviderManager } from '../../commons/service/AIProviderManager';
import { createMicroCardProposalPrompt } from '../../commons/utils/AIPrompts';
import { getStructured } from '../../commons/service/polyfills/structuredOutput';

const DEFAULTS = {
  minWords: 50,
  minSentences: 3,
  maxPerChapter: 2,
  minConfidence: 0.55,
};

const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    shouldPropose: { type: 'boolean' },
    front: { type: 'string' },
    back: { type: 'string' },
    domain: { type: 'string' },
    conceptName: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['shouldPropose'],
};

// Skip reasons surfaced to callers for transparency / tuning.
const SKIP = {
  TOO_SHORT: 'too-short',
  LOW_DENSITY: 'low-density',
  DUPLICATE: 'duplicate-paragraph',
  RATE_LIMIT: 'chapter-rate-limit',
  NO_PROVIDER: 'no-provider',
  AI_DECLINED: 'ai-declined',
  AI_FAILED: 'ai-failed',
  LOW_CONFIDENCE: 'low-confidence',
  EMPTY_RESULT: 'empty-result',
};

// Cheap deterministic hash for dedup keys. Sufficient at this scale.
function hashParagraph(text) {
  const s = (text || '').trim();
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function countWords(text) {
  if (!text) return 0;
  return (text.trim().match(/\S+/g) || []).length;
}

function countSentenceTerminators(text) {
  if (!text) return 0;
  return (text.match(/[.!?。！？]\s+/g) || []).length;
}

function chapterKey(bookId, chapterId) {
  return `${bookId || 'no-book'}::${chapterId || 'no-chapter'}`;
}

class MicroCardProposer {
  constructor() {
    if (MicroCardProposer.instance) {
      // eslint-disable-next-line no-constructor-return
      return MicroCardProposer.instance;
    }
    MicroCardProposer.instance = this;

    // chapterKey → { proposalCount: number, seenHashes: Set<string> }
    this.chapterState = new Map();
  }

  /**
   * Clear per-chapter state — call when the user leaves a book.
   * @param {string|number} [bookId] — clear only this book; omit to clear all
   */
  resetState(bookId) {
    if (bookId === undefined) {
      this.chapterState.clear();
      return;
    }
    const prefix = `${bookId}::`;
    Array.from(this.chapterState.keys())
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => this.chapterState.delete(key));
  }

  getChapterState(bookId, chapterId) {
    const key = chapterKey(bookId, chapterId);
    if (!this.chapterState.has(key)) {
      this.chapterState.set(key, { proposalCount: 0, seenHashes: new Set() });
    }
    return this.chapterState.get(key);
  }

  /**
   * Evaluate a paragraph. Returns either a proposal object or a skip reason.
   *
   * @param {Object} input
   * @param {string} input.text — paragraph text
   * @param {string|number} [input.bookId]
   * @param {string} [input.chapterId]
   * @param {string} [input.bookTitle]
   * @param {string} [input.chapterTitle]
   * @param {string[]} [input.knownConcepts] — passed to the AI as exclusions
   * @param {Object} [options]
   * @param {number} [options.minWords]
   * @param {number} [options.minSentences]
   * @param {number} [options.maxPerChapter]
   * @param {number} [options.minConfidence]
   * @returns {Promise<Object>} { proposed: boolean, proposalId?, front?, back?, domain?, conceptName?, confidence?, paragraphHash, reason? }
   */
  async proposeFromParagraph(input, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    const text = input?.text || '';
    const { bookId, chapterId, bookTitle, chapterTitle, knownConcepts } =
      input || {};

    const paragraphHash = hashParagraph(text);
    const state = this.getChapterState(bookId, chapterId);

    // 1. Length gate.
    const words = countWords(text);
    if (words < opts.minWords) {
      return { proposed: false, reason: SKIP.TOO_SHORT, paragraphHash, words };
    }

    // 2. Density gate.
    const sentences = countSentenceTerminators(text);
    if (sentences < opts.minSentences) {
      return {
        proposed: false,
        reason: SKIP.LOW_DENSITY,
        paragraphHash,
        sentences,
      };
    }

    // 3 + 4. Dedup + rate gates — claim atomically BEFORE the async AI call
    // so concurrent evaluations honor the same limits. Single-threaded JS
    // makes sync check+claim atomic; mutating state AFTER an `await` would
    // let multiple paragraphs all pass the same stale check.
    if (state.seenHashes.has(paragraphHash)) {
      return { proposed: false, reason: SKIP.DUPLICATE, paragraphHash };
    }
    if (state.proposalCount >= opts.maxPerChapter) {
      return { proposed: false, reason: SKIP.RATE_LIMIT, paragraphHash };
    }
    state.seenHashes.add(paragraphHash);
    state.proposalCount += 1;

    // Helper to release the rate-slot reservation on failure paths. Hash is
    // released only for TRANSIENT failures (network / parse) so a retry can
    // succeed; deterministic rejections (AI decline, low confidence, empty)
    // keep the hash so we never re-ask the model about the same paragraph.
    const release = ({ releaseHash }) => {
      state.proposalCount = Math.max(0, state.proposalCount - 1);
      if (releaseHash) state.seenHashes.delete(paragraphHash);
    };

    // 5. AI generation.
    const provider = aiProviderManager.currentProvider;
    if (!provider) {
      release({ releaseHash: true });
      return { proposed: false, reason: SKIP.NO_PROVIDER, paragraphHash };
    }
    const prompt = createMicroCardProposalPrompt(text, {
      bookTitle,
      chapterTitle,
      knownConcepts,
    });
    let raw;
    try {
      raw = await getStructured(provider, prompt, PROPOSAL_SCHEMA, {
        schemaName: 'microCardProposal',
        maxRetries: 1,
      });
    } catch (err) {
      console.warn('[MicroCardProposer] AI call failed:', err?.message || err);
      release({ releaseHash: true });
      return { proposed: false, reason: SKIP.AI_FAILED, paragraphHash };
    }
    if (!raw || typeof raw !== 'object') {
      release({ releaseHash: true });
      return { proposed: false, reason: SKIP.EMPTY_RESULT, paragraphHash };
    }

    // 6. Quality gate. AI decline / low-confidence / empty front-back are
    // deterministic for this input — release the rate slot but keep the
    // hash so we don't re-ask the same paragraph.
    if (raw.shouldPropose !== true) {
      release({ releaseHash: false });
      return {
        proposed: false,
        reason: SKIP.AI_DECLINED,
        paragraphHash,
        confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
      };
    }
    const front = (typeof raw.front === 'string' && raw.front.trim()) || '';
    const back = (typeof raw.back === 'string' && raw.back.trim()) || '';
    if (!front || !back) {
      release({ releaseHash: false });
      return { proposed: false, reason: SKIP.EMPTY_RESULT, paragraphHash };
    }
    const confidence =
      typeof raw.confidence === 'number' ? raw.confidence : opts.minConfidence;
    if (confidence < opts.minConfidence) {
      release({ releaseHash: false });
      return {
        proposed: false,
        reason: SKIP.LOW_CONFIDENCE,
        paragraphHash,
        confidence,
      };
    }

    // Surface proposal — keep the rate-slot and hash reservation.
    const proposalId = `prop_${uuidv4()}`;
    return {
      proposed: true,
      proposalId,
      front,
      back,
      domain: typeof raw.domain === 'string' ? raw.domain : 'knowledge',
      conceptName:
        typeof raw.conceptName === 'string' ? raw.conceptName : undefined,
      confidence,
      paragraphHash,
      bookId,
      chapterId,
    };
  }

  /**
   * After 3 consecutive AI-declined or user-dismissed proposals in a chapter,
   * the proposer can be told to back off. Callers (renderer) decide when to
   * trigger this — typically based on CARD_DISMISSED episodes in a row.
   */
  freezeChapter(bookId, chapterId) {
    const state = this.getChapterState(bookId, chapterId);
    state.proposalCount = Number.MAX_SAFE_INTEGER;
  }

  /** Telemetry / debugging — current per-chapter rate state. */
  getStateSnapshot() {
    const out = {};
    this.chapterState.forEach((value, key) => {
      out[key] = {
        proposalCount: value.proposalCount,
        seenCount: value.seenHashes.size,
      };
    });
    return out;
  }
}

const microCardProposer = new MicroCardProposer();

export default microCardProposer;
export { MicroCardProposer, hashParagraph, SKIP, DEFAULTS };
