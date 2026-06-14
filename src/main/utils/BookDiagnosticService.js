/* eslint-disable class-methods-use-this */
/**
 * BookDiagnosticService — Phase 5 pre-book diagnostic.
 *
 * Given a book's TOC (flat list of chapter labels from EPubView's
 * tocChanged callback) plus light metadata, produces:
 *
 *   - bookSummary       — what the book is about
 *   - topics            — high-level topics covered
 *   - estimatedDifficulty
 *   - chapters[]        — { title, estimatedConcepts[], knownToReader[], status }
 *   - primer            — personalized note to the reader
 *   - prerequisiteWarnings[]
 *
 * The AI does the WHAT (book summary, per-chapter concepts, primer). The
 * known-to-reader annotation is computed DETERMINISTICALLY post-call by
 * intersecting `estimatedConcepts` with the learner's known concepts —
 * no second AI call needed, and the intersection logic is testable.
 *
 * Per-chapter status:
 *   - 'review'  → ≥ 60% of concepts already known (chip user as "you've got this")
 *   - 'partial' → 1 known concept (mixed)
 *   - 'new'     → 0 known concepts (fresh material)
 *   - 'unknown' → estimatedConcepts is empty (TOC entry too generic)
 *
 * This module is reader-type agnostic — the caller passes whatever TOC
 * shape they have (EPubView passes ReactReader's array, future PDF/Word
 * extractors will pass theirs). All the service needs is `[{label}, ...]`.
 */

import { instanceInMain as aiProviderManager } from '../../commons/service/AIProviderManager';
import { createBookDiagnosticPrompt } from '../../commons/utils/AIPrompts';
import { getStructured } from '../../commons/service/polyfills/structuredOutput';

const DIAGNOSTIC_SCHEMA = {
  type: 'object',
  properties: {
    bookSummary: { type: 'string' },
    topics: { type: 'array', items: { type: 'string' } },
    estimatedDifficulty: { type: 'string' },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          estimatedConcepts: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    primer: { type: 'string' },
    prerequisiteWarnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
  required: ['bookSummary', 'chapters'],
};

const MAX_TOC_ENTRIES = 80; // protect against pathological TOCs (e.g. per-section navs)

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildKnownSet(knownConcepts) {
  const set = new Set();
  (knownConcepts || []).forEach((c) => {
    const name =
      typeof c === 'string' ? c : c?.name || c?.conceptName || c?.label;
    if (name) set.add(normalizeName(name));
  });
  return set;
}

function classifyChapter(estimatedConcepts, knownToReader) {
  const total = Array.isArray(estimatedConcepts) ? estimatedConcepts.length : 0;
  if (total === 0) return 'unknown';
  const known = Array.isArray(knownToReader) ? knownToReader.length : 0;
  if (known === 0) return 'new';
  if (known / total >= 0.6) return 'review';
  return 'partial';
}

/**
 * Take ReactReader-style nested TOC into a flat list with depth markers.
 * Caps at MAX_TOC_ENTRIES so an oversize nav doesn't blow up the prompt.
 */
function flattenToc(toc) {
  const out = [];
  const walk = (items, depth) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (out.length >= MAX_TOC_ENTRIES) return;
      const label = (item?.label || '').trim();
      if (label) out.push({ label, depth });
      if (Array.isArray(item?.subitems) && item.subitems.length) {
        walk(item.subitems, depth + 1);
      }
    });
  };
  walk(toc, 0);
  return out;
}

class BookDiagnosticService {
  /**
   * Run the diagnostic. Returns the diagnostic object on success, or
   * `{ error: string }` on failure. Never throws.
   *
   * @param {Object} input
   * @param {string} input.bookTitle
   * @param {string} [input.bookAuthor]
   * @param {string} [input.bookCategory]
   * @param {Array} input.toc — raw TOC array (nested {label, href, subitems?})
   * @param {Array<string|Object>} [input.knownConcepts]
   */
  async run(input = {}) {
    const {
      bookTitle = '',
      bookAuthor = '',
      bookCategory = '',
      toc = [],
      knownConcepts = [],
    } = input;

    const tocEntries = flattenToc(toc);
    if (tocEntries.length === 0) {
      return { error: 'No table of contents available for this book.' };
    }
    if (!bookTitle) {
      return { error: 'Book title is required for diagnostic.' };
    }

    const provider = aiProviderManager.currentProvider;
    if (!provider) {
      return { error: 'No AI provider configured.' };
    }

    const prompt = createBookDiagnosticPrompt({
      bookTitle,
      bookAuthor,
      bookCategory,
      tocEntries,
      knownConcepts: Array.from(buildKnownSet(knownConcepts)),
    });

    let raw;
    try {
      raw = await getStructured(provider, prompt, DIAGNOSTIC_SCHEMA, {
        schemaName: 'bookDiagnostic',
        maxRetries: 1,
      });
    } catch (err) {
      return { error: err?.message || 'AI diagnostic call failed' };
    }
    if (!raw || typeof raw !== 'object') {
      return { error: 'AI returned empty diagnostic.' };
    }

    return this.annotate(raw, knownConcepts, {
      bookTitle,
      bookAuthor,
      bookCategory,
    });
  }

  /**
   * Deterministic post-processing — intersect estimatedConcepts with the
   * learner's known concepts and classify each chapter. Exported (via the
   * singleton) so it can be tested without an AI call.
   */
  annotate(raw, knownConcepts, meta = {}) {
    const knownSet = buildKnownSet(knownConcepts);
    const chaptersIn = Array.isArray(raw.chapters) ? raw.chapters : [];
    const chapters = chaptersIn.map((ch) => {
      const estimated = Array.isArray(ch?.estimatedConcepts)
        ? ch.estimatedConcepts.filter((s) => typeof s === 'string' && s.trim())
        : [];
      const knownToReader = estimated.filter((c) =>
        knownSet.has(normalizeName(c)),
      );
      const status = classifyChapter(estimated, knownToReader);
      return {
        title: (ch?.title || '').trim(),
        estimatedConcepts: estimated,
        knownToReader,
        status,
      };
    });

    const totalConcepts = chapters.reduce(
      (sum, c) => sum + c.estimatedConcepts.length,
      0,
    );
    const totalKnown = chapters.reduce(
      (sum, c) => sum + c.knownToReader.length,
      0,
    );
    const readinessScore =
      totalConcepts > 0 ? Math.round((totalKnown / totalConcepts) * 100) : 0;

    return {
      bookTitle: meta.bookTitle || '',
      bookAuthor: meta.bookAuthor || '',
      bookCategory: meta.bookCategory || '',
      bookSummary: (raw.bookSummary || '').trim(),
      topics: Array.isArray(raw.topics)
        ? raw.topics.filter((t) => typeof t === 'string' && t.trim())
        : [],
      estimatedDifficulty:
        typeof raw.estimatedDifficulty === 'string'
          ? raw.estimatedDifficulty
          : '',
      chapters,
      primer: (raw.primer || '').trim(),
      prerequisiteWarnings: Array.isArray(raw.prerequisiteWarnings)
        ? raw.prerequisiteWarnings
            .filter((w) => w && typeof w.topic === 'string')
            .map((w) => ({
              topic: w.topic.trim(),
              reason: (w.reason || '').trim(),
            }))
        : [],
      readinessScore,
      generatedAt: new Date().toISOString(),
    };
  }
}

const bookDiagnosticService = new BookDiagnosticService();
export default bookDiagnosticService;
export { BookDiagnosticService, flattenToc };
