/**
 * extractors — barrel export + unified entry point for per-domain
 * learning-point extraction (Phase 3b).
 *
 * Usage:
 *   import { extractForDomain } from './extractors';
 *
 *   const result = await extractForDomain('math', sourceText);
 *   // → { domain, extras, front, back, source, confidence, fallbackReason? }
 *
 * If the caller doesn't know the domain, run DomainDetector first:
 *   import { detectDomain } from '../../commons/utils/DomainDetector';
 *   const { domain } = await detectDomain(text);
 *   const result = await extractForDomain(domain, text);
 *
 * Coverage in this phase:
 *   vocabulary, math, physics, chemistry, biology, programming,
 *   knowledge, history, geography, reading
 *
 * Not yet implemented (falls through to GenericKnowledgeExtractor or
 * returns a minimal fallback): language (sentence patterns), skill,
 * custom. These need their own per-domain prompts + extras shapes and
 * are deferred to a Phase 3b follow-up.
 */

import VocabularyExtractor from './VocabularyExtractor';
import FormalConceptExtractor from './FormalConceptExtractor';
import ProgrammingExtractor from './ProgrammingExtractor';
import KnowledgeExtractor from './KnowledgeExtractor';

// Singleton extractors for stateless domains; FormalConcept and Knowledge
// are constructed per-domain because they parameterize their domain field.
const vocabularyExtractor = new VocabularyExtractor();
const programmingExtractor = new ProgrammingExtractor();

const formalExtractors = {
  math: new FormalConceptExtractor('math'),
  physics: new FormalConceptExtractor('physics'),
  chemistry: new FormalConceptExtractor('chemistry'),
  biology: new FormalConceptExtractor('biology'),
};

const knowledgeExtractors = {
  knowledge: new KnowledgeExtractor('knowledge'),
  history: new KnowledgeExtractor('history'),
  geography: new KnowledgeExtractor('geography'),
  reading: new KnowledgeExtractor('reading'),
};

/**
 * Resolve the extractor instance for a given LearningDomain. Returns null
 * if no extractor is implemented for the domain yet — caller should fall
 * back to a generic flow (or to KnowledgeExtractor on 'knowledge').
 *
 * @param {string} domain
 * @returns {BaseExtractor|null}
 */
export function getExtractorForDomain(domain) {
  if (!domain || typeof domain !== 'string') return null;
  if (domain === 'vocabulary') return vocabularyExtractor;
  if (domain === 'programming') return programmingExtractor;
  if (formalExtractors[domain]) return formalExtractors[domain];
  if (knowledgeExtractors[domain]) return knowledgeExtractors[domain];
  return null;
}

/**
 * Top-level extraction entry point. Picks the right extractor for the
 * domain, calls it, and falls back to the KnowledgeExtractor on unknown
 * domains (so the caller always gets a usable result).
 *
 * @param {string} domain — a LearningDomain identifier
 * @param {string} text — source text to extract from
 * @param {Object} [options] — forwarded to the extractor
 * @returns {Promise<{domain: string, extras: Object, front: string, back: string, source: string, confidence: number}>}
 */
export async function extractForDomain(domain, text, options = {}) {
  const extractor =
    getExtractorForDomain(domain) || knowledgeExtractors.knowledge;
  return extractor.extract(text, options);
}

export {
  VocabularyExtractor,
  FormalConceptExtractor,
  ProgrammingExtractor,
  KnowledgeExtractor,
};
