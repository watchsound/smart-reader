/* eslint-disable class-methods-use-this */
/**
 * BaseExtractor — common interface and helpers for per-domain extractors.
 *
 * Each concrete extractor (VocabularyExtractor, FormalConceptExtractor,
 * ProgrammingExtractor, KnowledgeExtractor, ...) extends this class and
 * implements:
 *   - get domain()              → the LearningDomain this extractor handles
 *   - buildPrompt(text, options) → string (the per-domain extraction prompt)
 *   - get schema()              → JSON-schema-like object describing extras shape
 *   - postProcess(rawExtras, text, options) → normalized extras object
 *
 * The shared `extract()` method handles availability checks, calls the
 * structured-output polyfill, and packages the result into the standard
 * extraction result shape.
 *
 * Returned shape:
 *   {
 *     domain: string,
 *     extras: Object,         // matches the per-domain extras type
 *     front: string,          // suggested card front (short identifier/title)
 *     back: string,           // suggested card back (short summary or definition)
 *     source: 'ai' | 'fallback',
 *     confidence: number,     // 0..1
 *   }
 */

import { instanceInMain as aiProviderManager } from '../../../commons/service/AIProviderManager';
import { getStructured } from '../../../commons/service/polyfills/structuredOutput';

export default class BaseExtractor {
  /** Subclass override — the LearningDomain this extractor handles. */
  get domain() {
    throw new Error('BaseExtractor subclass must implement `domain`');
  }

  /** Subclass override — return the per-domain extraction prompt string. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  buildPrompt(_text, _options) {
    throw new Error('BaseExtractor subclass must implement `buildPrompt()`');
  }

  /** Subclass override — JSON-schema-like object for the extras shape. */
  get schema() {
    throw new Error('BaseExtractor subclass must implement `schema`');
  }

  /**
   * Subclass override — normalize the raw LLM JSON into the typed extras
   * shape. Default: pass through unchanged.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  postProcess(rawExtras, _text, _options) {
    return rawExtras || {};
  }

  /**
   * Subclass override — derive front/back card text from the typed extras.
   * Default: use the first non-empty string field as both sides.
   */
  deriveCardFields(extras, text) {
    const firstStringField = Object.values(extras || {}).find(
      (v) => typeof v === 'string' && v.trim().length > 0,
    );
    return {
      front: firstStringField || text.slice(0, 80),
      back: firstStringField || '',
    };
  }

  /**
   * Top-level entry point. Subclasses normally don't override this.
   *
   * @param {string} text — source text to extract from
   * @param {Object} [options]
   * @param {string} [options.targetLang] — vocabulary-only: translation target
   * @param {number} [options.maxRetries=1] — JSON parse-retry budget
   * @returns {Promise<{domain: string, extras: Object, front: string, back: string, source: string, confidence: number}>}
   */
  async extract(text, options = {}) {
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return this.fallbackResult(text, 'too-short');
    }
    const provider = aiProviderManager.currentProvider;
    if (!provider) {
      return this.fallbackResult(text, 'no-provider');
    }

    const prompt = this.buildPrompt(text, options);
    let raw;
    try {
      raw = await getStructured(provider, prompt, this.schema, {
        schemaName: `${this.domain}Extras`,
        maxRetries: options.maxRetries ?? 1,
      });
    } catch (err) {
      // Network / API / rate-limit errors — degrade gracefully, matching the
      // convention in AIConceptExtractionService. Caller checks `source` to
      // distinguish AI-derived from fallback results.
      console.warn(
        `[${this.constructor.name}] AI call failed: ${err && err.message ? err.message : err}`,
      );
      return this.fallbackResult(text, 'api-error');
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return this.fallbackResult(text, 'parse-failed');
    }

    const extras = this.postProcess(raw, text, options);
    const { front, back } = this.deriveCardFields(extras, text);
    return {
      domain: this.domain,
      extras,
      front,
      back,
      source: 'ai',
      confidence: 0.7,
    };
  }

  /** Internal: return a minimal empty result on failure. */
  fallbackResult(text, reason) {
    return {
      domain: this.domain,
      extras: {},
      front: (text || '').slice(0, 80),
      back: '',
      source: 'fallback',
      confidence: 0,
      fallbackReason: reason,
    };
  }
}
