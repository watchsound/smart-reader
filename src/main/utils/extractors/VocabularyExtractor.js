/* eslint-disable class-methods-use-this */
/**
 * VocabularyExtractor — extracts VocabularyExtras (see LearningPointDomains.ts).
 *
 * Produces card fields where the front is the word/phrase and the back is
 * a short gloss assembled from the extracted fields.
 */

import BaseExtractor from './BaseExtractor';
import { createVocabularyExtractionPrompt } from '../../../commons/utils/AIPrompts';

const SCHEMA = {
  type: 'object',
  properties: {
    ipa: { type: 'string' },
    partOfSpeech: {
      type: 'string',
      enum: ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'other'],
    },
    examples: { type: 'array', items: { type: 'string' } },
    collocations: { type: 'array', items: { type: 'string' } },
    translations: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
  },
};

export default class VocabularyExtractor extends BaseExtractor {
  get domain() {
    return 'vocabulary';
  }

  get schema() {
    return SCHEMA;
  }

  buildPrompt(text, options = {}) {
    return createVocabularyExtractionPrompt(text, options.targetLang || '');
  }

  postProcess(raw) {
    const extras = {};
    if (typeof raw.ipa === 'string' && raw.ipa.trim())
      extras.ipa = raw.ipa.trim();
    if (typeof raw.partOfSpeech === 'string' && raw.partOfSpeech.trim()) {
      extras.partOfSpeech = raw.partOfSpeech.trim().toLowerCase();
    }
    if (Array.isArray(raw.examples)) {
      extras.examples = raw.examples
        .filter((e) => typeof e === 'string' && e.trim())
        .slice(0, 3);
    }
    if (Array.isArray(raw.collocations)) {
      extras.collocations = raw.collocations
        .filter((c) => typeof c === 'string' && c.trim())
        .slice(0, 5);
    }
    if (raw.translations && typeof raw.translations === 'object') {
      extras.translations = {};
      Object.entries(raw.translations).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim())
          extras.translations[k] = v.trim();
      });
      if (Object.keys(extras.translations).length === 0)
        delete extras.translations;
    }
    return extras;
  }

  deriveCardFields(extras, text) {
    // Front: first 1-3 words of source as a fallback identifier.
    // The micro-card / note creation flow normally provides the real headword;
    // this is just a safe default when the extractor is called standalone.
    const headword = text.trim().split(/\s+/).slice(0, 3).join(' ');
    const parts = [];
    if (extras.partOfSpeech) parts.push(`(${extras.partOfSpeech})`);
    if (extras.examples && extras.examples[0]) parts.push(extras.examples[0]);
    return {
      front: headword || text.slice(0, 80),
      back: parts.join(' — ') || '',
    };
  }
}
