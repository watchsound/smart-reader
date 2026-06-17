/**
 * ArgumentXrayService — Argument Skeleton X-ray (#13).
 *
 * Detects claim words vs evidence words in a paragraph via the active
 * aiProvider's structured-output polyfill. The renderer wraps the
 * results through srsHaloWalker (state='claim'|'evidence') so the
 * paragraph's load-bearing structure surfaces at a glance.
 *
 * Cache by content hash so toggling the X-ray on/off doesn't re-bill
 * the LLM for the same paragraph.
 */

const {
  instanceInMain: aiProviderManager,
} = require('../../commons/service/AIProviderManager');

const SCHEMA = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Verbatim phrases from the paragraph that assert, propose, or conclude something.',
    },
    evidence: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Verbatim phrases that support claims — facts, citations, examples, statistics.',
    },
  },
  required: ['claims', 'evidence'],
};

const buildPrompt = (
  paragraph,
) => `You are analysing a paragraph for its argumentative structure.

Identify two disjoint sets of phrases that appear verbatim in the paragraph:
1. CLAIMS — assertions, propositions, conclusions, thesis statements
2. EVIDENCE — facts, citations, examples, statistics that support the claims

Return strict JSON matching the schema. Each entry must be a substring of
the source paragraph (whitespace + capitalisation preserved). If the
paragraph contains no clear argumentative structure, return empty arrays.

Paragraph:
"""
${paragraph}
"""`;

class ArgumentXrayService {
  constructor() {
    // Keyed on the exact paragraph text — collision-free by construction
    // for any realistic paragraph length. Lives for the lifetime of the
    // main process; chapter changes don't invalidate (same text → same
    // structure, regardless of context).
    this.cache = new Map();
  }

  // token kept in signature for symmetry with other learning-point IPCs.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async analyze(paragraph, _token) {
    if (this.cache.has(paragraph)) return this.cache.get(paragraph);

    if (!aiProviderManager.currentProvider) {
      const empty = { claims: [], evidence: [], callId: null, cacheHit: false };
      this.cache.set(paragraph, empty);
      return empty;
    }

    const { brainCall } = require('../brain/spine');
    const prompt = buildPrompt(paragraph);
    let raw;
    let callId = null;
    let cacheHit = false;
    try {
      const out = await brainCall('argument-xray', prompt, {
        userId: 1,
        schema: SCHEMA,
      });
      raw = out.output;
      callId = out.callId;
      cacheHit = out.cacheHit;
    } catch (err) {
      console.error('[ArgumentXrayService] brainCall failed:', err);
      raw = null;
    }

    const result = {
      claims: Array.isArray(raw?.claims) ? raw.claims : [],
      evidence: Array.isArray(raw?.evidence) ? raw.evidence : [],
      callId,
      cacheHit,
    };
    this.cache.set(paragraph, result);
    return result;
  }
}

module.exports = { ArgumentXrayService };
