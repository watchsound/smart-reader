/* eslint-disable class-methods-use-this */
/**
 * KnowledgeExtractor — produces KnowledgeExtras for knowledge, history,
 * geography, and reading domains.
 *
 * The shape is identical across these four domains (per
 * LearningPointDomains.ts); only the `domain` field on the result varies.
 */

import BaseExtractor from './BaseExtractor';
import { createKnowledgeExtractionPrompt } from '../../../commons/utils/AIPrompts';

const SUPPORTED_DOMAINS = ['knowledge', 'history', 'geography', 'reading'];

const SCHEMA = {
  type: 'object',
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          cite: { type: 'string' },
        },
      },
    },
    relatedConcepts: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: { type: 'string' } },
    dates: { type: 'array', items: { type: 'string' } },
    locations: { type: 'array', items: { type: 'string' } },
  },
};

export default class KnowledgeExtractor extends BaseExtractor {
  constructor(domain = 'knowledge') {
    super();
    if (!SUPPORTED_DOMAINS.includes(domain)) {
      throw new Error(
        `KnowledgeExtractor: unsupported domain "${domain}". ` +
          `Expected one of ${SUPPORTED_DOMAINS.join(', ')}.`,
      );
    }
    this.domainName = domain;
  }

  get domain() {
    return this.domainName;
  }

  get schema() {
    return SCHEMA;
  }

  buildPrompt(text) {
    return createKnowledgeExtractionPrompt(text);
  }

  postProcess(raw) {
    const extras = {};
    if (Array.isArray(raw.sources)) {
      extras.sources = raw.sources
        .filter((s) => s && typeof s.title === 'string' && s.title.trim())
        .slice(0, 5)
        .map((s) => {
          const entry = { title: s.title.trim() };
          if (typeof s.url === 'string' && s.url.trim())
            entry.url = s.url.trim();
          if (typeof s.cite === 'string' && s.cite.trim())
            entry.cite = s.cite.trim();
          return entry;
        });
    }
    if (Array.isArray(raw.relatedConcepts)) {
      extras.relatedConcepts = raw.relatedConcepts
        .filter((c) => typeof c === 'string' && c.trim())
        .slice(0, 10);
    }
    if (Array.isArray(raw.evidence)) {
      extras.evidence = raw.evidence
        .filter((e) => typeof e === 'string' && e.trim())
        .slice(0, 5);
    }
    if (Array.isArray(raw.dates)) {
      extras.dates = raw.dates
        .filter((d) => typeof d === 'string' && d.trim())
        .slice(0, 10);
    }
    if (Array.isArray(raw.locations)) {
      extras.locations = raw.locations
        .filter((l) => typeof l === 'string' && l.trim())
        .slice(0, 10);
    }
    return extras;
  }

  deriveCardFields(extras, text) {
    const front =
      text.trim().split(/[\n.]/)[0].slice(0, 100) || text.slice(0, 80);
    const back =
      (extras.evidence && extras.evidence[0]) ||
      (extras.relatedConcepts && extras.relatedConcepts.join(', ')) ||
      '';
    return { front, back };
  }
}
