/**
 * BaseEffect - Abstract base class for all effects
 *
 * In-place effects modify word spans without moving them.
 * Examples: highlight, underline, fade-in, pulse
 */

class BaseEffect {
  /**
   * @param {Object} managers - { wordWrapper, positionManager, cloneManager, animationEngine }
   * @param {Object} options - Effect-specific options
   */
  constructor(managers, options = {}) {
    this.managers = managers;
    this.options = options;
    this.instanceId = null; // Set by EffectRegistry
    this.isActive = false;
    this.affectedWords = new Set(); // Track affected word IDs

    // Subclasses should override these
    this.name = 'base';
    this.category = 'in-place';
  }

  /**
   * Apply effect to specified words
   * @param {HTMLElement[]|string[]|string} target - Word spans, word IDs, or CSS selector
   * @param {Object} options - Runtime options
   * @returns {Promise}
   */
  async apply(target, options = {}) {
    const wordSpans = this._resolveTarget(target);

    if (wordSpans.length === 0) {
      console.warn(`${this.name}: No words found for target`);
      return;
    }

    this.isActive = true;
    wordSpans.forEach(span => this.affectedWords.add(span.id));

    // Subclasses implement this
    await this._applyToWords(wordSpans, { ...this.options, ...options });
  }

  /**
   * Remove effect from all affected words
   * @returns {Promise}
   */
  async remove() {
    if (!this.isActive) return;

    const wordSpans = Array.from(this.affectedWords)
      .map(id => document.getElementById(id))
      .filter(Boolean);

    await this._removeFromWords(wordSpans);

    this.affectedWords.clear();
    this.isActive = false;
  }

  /**
   * Clean up effect completely
   */
  destroy() {
    this.remove();
    this.managers = null;
    this.options = null;
  }

  /**
   * Resolve target to array of word spans
   * @protected
   */
  _resolveTarget(target) {
    // String selector
    if (typeof target === 'string') {
      // Check if it's a word ID
      const elem = document.getElementById(target);
      if (elem) return [elem];

      // Otherwise treat as selector
      return Array.from(document.querySelectorAll(target));
    }

    // Array of IDs
    if (Array.isArray(target) && typeof target[0] === 'string') {
      return target.map(id => document.getElementById(id)).filter(Boolean);
    }

    // Array of elements
    if (Array.isArray(target)) {
      return target;
    }

    // NodeList
    if (target instanceof NodeList) {
      return Array.from(target);
    }

    // Single element
    if (target instanceof HTMLElement) {
      return [target];
    }

    return [];
  }

  /**
   * Subclasses implement this to apply their effect
   * @protected
   * @param {HTMLElement[]} wordSpans
   * @param {Object} options
   * @returns {Promise}
   */
  async _applyToWords(wordSpans, options) {
    throw new Error('Subclass must implement _applyToWords');
  }

  /**
   * Subclasses implement this to remove their effect
   * @protected
   * @param {HTMLElement[]} wordSpans
   * @returns {Promise}
   */
  async _removeFromWords(wordSpans) {
    // Default: remove effect classes
    wordSpans.forEach(span => {
      span.classList.remove(`se-effect-${this.name}`);
    });
  }

  /**
   * Store original styles for restoration
   * @protected
   */
  _storeOriginalStyle(span, properties) {
    if (!span.dataset.seOriginalStyles) {
      const original = {};
      properties.forEach(prop => {
        original[prop] = span.style[prop] || '';
      });
      span.dataset.seOriginalStyles = JSON.stringify(original);
    }
  }

  /**
   * Restore original styles
   * @protected
   */
  _restoreOriginalStyle(span) {
    if (span.dataset.seOriginalStyles) {
      const original = JSON.parse(span.dataset.seOriginalStyles);
      Object.keys(original).forEach(prop => {
        span.style[prop] = original[prop];
      });
      delete span.dataset.seOriginalStyles;
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseEffect;
} else {
  window.BaseEffect = BaseEffect;
}
