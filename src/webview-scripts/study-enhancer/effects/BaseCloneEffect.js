/**
 * BaseCloneEffect - Base class for clone-based spatial effects
 *
 * Clone effects create positioned clones of words and animate them.
 * The original words remain in place (optionally dimmed).
 * Examples: flying words, word explosion, abstract reconstruction
 */

class BaseCloneEffect {
  /**
   * @param {Object} managers - { wordWrapper, positionManager, cloneManager, animationEngine }
   * @param {Object} options - Effect-specific options
   */
  constructor(managers, options = {}) {
    this.managers = managers;
    this.options = {
      dimSource: true,
      dimOpacity: 0.3,
      inheritStyles: true,
      ...options
    };

    this.instanceId = null;
    this.isActive = false;
    this.cloneIds = [];
    this.sourceWordIds = new Set();

    this.name = 'baseClone';
    this.category = 'clone-based';
  }

  /**
   * Apply effect
   * @param {HTMLElement[]|string[]|string} target - Source words
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
    const mergedOptions = { ...this.options, ...options };

    // Track source words
    wordSpans.forEach(span => {
      if (span.id) this.sourceWordIds.add(span.id);
    });

    // Create clones
    const clones = this._createClones(wordSpans, mergedOptions);
    this.cloneIds = clones.map(c => c.cloneId);

    // Dim source words if enabled
    if (mergedOptions.dimSource) {
      wordSpans.forEach(span => {
        if (span.id) {
          this.managers.cloneManager.dimSource(span.id, mergedOptions.dimOpacity);
        }
      });
    }

    // Subclass implements the actual animation
    await this._animateClones(clones, wordSpans, mergedOptions);

    return { clones, sourceWords: wordSpans };
  }

  /**
   * Remove effect - clean up clones and restore sources
   * @param {Object} options
   * @returns {Promise}
   */
  async remove(options = {}) {
    if (!this.isActive) return;

    const { fadeOutDuration = 300 } = options;

    // Fade out and remove clones
    if (fadeOutDuration > 0) {
      await this.managers.cloneManager.fadeOutAndRemoveAll(fadeOutDuration);
    } else {
      this.cloneIds.forEach(id => {
        this.managers.cloneManager.removeClone(id);
      });
    }

    // Restore source word opacity
    this.sourceWordIds.forEach(id => {
      this.managers.cloneManager.restoreSource(id);
    });

    this.cloneIds = [];
    this.sourceWordIds.clear();
    this.isActive = false;
  }

  /**
   * Destroy effect
   */
  destroy() {
    this.remove({ fadeOutDuration: 0 });
    this.managers = null;
    this.options = null;
  }

  /**
   * Resolve target to word spans
   * @protected
   */
  _resolveTarget(target) {
    if (typeof target === 'string') {
      const elem = document.getElementById(target);
      if (elem) return [elem];
      return Array.from(document.querySelectorAll(target));
    }

    if (Array.isArray(target) && typeof target[0] === 'string') {
      return target.map(id => document.getElementById(id)).filter(Boolean);
    }

    if (Array.isArray(target)) return target;
    if (target instanceof NodeList) return Array.from(target);
    if (target instanceof HTMLElement) return [target];

    return [];
  }

  /**
   * Create clones for source words
   * @protected
   */
  _createClones(wordSpans, options) {
    return this.managers.cloneManager.cloneWords(wordSpans, {
      inheritStyles: options.inheritStyles,
      additionalClass: `se-clone-${this.name}`,
      initialOpacity: options.initialCloneOpacity ?? 1
    });
  }

  /**
   * Subclasses implement this to define their animation
   * @protected
   * @param {Object[]} clones - Array of { cloneId, element, position }
   * @param {HTMLElement[]} sourceWords
   * @param {Object} options
   * @returns {Promise}
   */
  async _animateClones(clones, sourceWords, options) {
    throw new Error('Subclass must implement _animateClones');
  }

  /**
   * Calculate target positions for clones
   * Can be overridden by subclasses
   * @protected
   */
  _calculateTargetPositions(clones, options) {
    // Default: no movement
    return clones.map(clone => ({
      cloneId: clone.cloneId,
      from: clone.position,
      to: clone.position
    }));
  }

  /**
   * Utility: Match source words to abstract words
   * Returns mapping of which source words match which abstract words
   * @protected
   * @param {HTMLElement[]} sourceWords
   * @param {string[]} abstractWords
   * @returns {Map} - sourceWordId -> { abstractIndex, abstractWord }
   */
  _matchWordsToAbstract(sourceWords, abstractWords) {
    const abstractLower = abstractWords.map(w => w.toLowerCase().replace(/[.,!?;:'"]/g, ''));
    const matches = new Map();
    const usedAbstractIndices = new Set();

    sourceWords.forEach(span => {
      const sourceText = span.textContent.toLowerCase().replace(/[.,!?;:'"]/g, '');

      // Find first unused matching abstract word
      for (let i = 0; i < abstractLower.length; i++) {
        if (!usedAbstractIndices.has(i) && abstractLower[i] === sourceText) {
          matches.set(span.id, {
            abstractIndex: i,
            abstractWord: abstractWords[i]
          });
          usedAbstractIndices.add(i);
          break;
        }
      }
    });

    return matches;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseCloneEffect;
} else {
  window.BaseCloneEffect = BaseCloneEffect;
}
