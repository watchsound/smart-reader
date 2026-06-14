/* eslint-disable class-methods-use-this */
/**
 * FormalConceptExtractor — produces FormalConceptExtras for math, physics,
 * chemistry, biology.
 *
 * One extractor class serves all four domains; the active domain is set
 * via constructor argument. The prompt is adapted accordingly so the LLM
 * knows whether to expect LaTeX, units, etc.
 */

import BaseExtractor from './BaseExtractor';
import { createFormalConceptExtractionPrompt } from '../../../commons/utils/AIPrompts';

const SUPPORTED_DOMAINS = ['math', 'physics', 'chemistry', 'biology'];

const SCHEMA = {
  type: 'object',
  properties: {
    definitionLatex: { type: 'string' },
    workedExampleLatex: { type: 'string' },
    prerequisites: { type: 'array', items: { type: 'string' } },
    similarProblems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          promptLatex: { type: 'string' },
          solutionLatex: { type: 'string' },
        },
      },
    },
    commonMistakes: { type: 'array', items: { type: 'string' } },
    units: { type: 'string' },
  },
};

export default class FormalConceptExtractor extends BaseExtractor {
  constructor(domain = 'math') {
    super();
    if (!SUPPORTED_DOMAINS.includes(domain)) {
      throw new Error(
        `FormalConceptExtractor: unsupported domain "${domain}". ` +
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
    return createFormalConceptExtractionPrompt(text, this.domainName);
  }

  postProcess(raw) {
    const extras = {};
    if (typeof raw.definitionLatex === 'string' && raw.definitionLatex.trim()) {
      extras.definitionLatex = raw.definitionLatex.trim();
    }
    if (
      typeof raw.workedExampleLatex === 'string' &&
      raw.workedExampleLatex.trim()
    ) {
      extras.workedExampleLatex = raw.workedExampleLatex.trim();
    }
    if (Array.isArray(raw.prerequisites)) {
      extras.prerequisites = raw.prerequisites
        .filter((p) => typeof p === 'string' && p.trim())
        .slice(0, 8);
    }
    if (Array.isArray(raw.similarProblems)) {
      extras.similarProblems = raw.similarProblems
        .filter(
          (p) => p && typeof p.promptLatex === 'string' && p.promptLatex.trim(),
        )
        .slice(0, 2)
        .map((p) => ({
          promptLatex: p.promptLatex.trim(),
          ...(typeof p.solutionLatex === 'string' && p.solutionLatex.trim()
            ? { solutionLatex: p.solutionLatex.trim() }
            : {}),
        }));
    }
    if (Array.isArray(raw.commonMistakes)) {
      extras.commonMistakes = raw.commonMistakes
        .filter((m) => typeof m === 'string' && m.trim())
        .slice(0, 3);
    }
    // Units field only meaningful for physics / chemistry.
    if (
      (this.domainName === 'physics' || this.domainName === 'chemistry') &&
      typeof raw.units === 'string' &&
      raw.units.trim()
    ) {
      extras.units = raw.units.trim();
    }
    return extras;
  }

  deriveCardFields(extras, text) {
    const front =
      text.trim().split(/[\n.]/)[0].slice(0, 100) || text.slice(0, 80);
    const back =
      extras.definitionLatex ||
      extras.workedExampleLatex ||
      (extras.commonMistakes && extras.commonMistakes[0]) ||
      '';
    return { front, back };
  }
}
