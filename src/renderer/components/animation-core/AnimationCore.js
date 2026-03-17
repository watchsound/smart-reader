/**
 * AnimationCore - Main controller for the universal animation system
 *
 * This is the primary interface for using animations across different views
 * (EPUB, PDF, Notes, Browser). It manages all the underlying components
 * and provides a simple API for common animation tasks.
 *
 * Usage:
 *   const core = new AnimationCore({ container: document.body });
 *   await core.highlightWords(['vocabulary', 'words'], { color: 'yellow' });
 *   await core.flyWordsToSummary(sourceEl, summaryText);
 */

import WordWrapper from './WordWrapper';
import AnimationEngine from './AnimationEngine';
import CloneManager from './CloneManager';
import PositionManager from './PositionManager';
import EffectRegistry from './EffectRegistry';

// Import built-in effects
import HighlightEffect from './effects/HighlightEffect';
import FadeInEffect from './effects/FadeInEffect';
import GlowEffect from './effects/GlowEffect';
import FlyingWordEffect from './effects/FlyingWordEffect';

class AnimationCore {
  constructor(options = {}) {
    this.options = {
      container: document.body,
      wordClass: 'ac-word',
      wordIdPrefix: 'ac-word-',
      cloneClass: 'ac-clone',
      ...options,
    };

    // Initialize managers
    this.wordWrapper = new WordWrapper({
      wordClass: this.options.wordClass,
      wordIdPrefix: this.options.wordIdPrefix,
    });

    this.positionManager = new PositionManager();

    this.cloneManager = new CloneManager({
      cloneClass: this.options.cloneClass,
      container: this.options.container,
    });

    this.animationEngine = new AnimationEngine();

    this.registry = new EffectRegistry();

    // Bundle managers for effects
    this.managers = {
      wordWrapper: this.wordWrapper,
      positionManager: this.positionManager,
      cloneManager: this.cloneManager,
      animationEngine: this.animationEngine,
    };

    // Register built-in effects
    this._registerBuiltInEffects();

    // Track state
    this.isInitialized = true;
    this.activeEffectIds = new Set();
  }

  /**
   * Register built-in effects
   * @private
   */
  _registerBuiltInEffects() {
    this.registry.register('highlight', HighlightEffect, {
      category: 'in-place',
      description: 'Background color highlighting',
    });

    this.registry.register('fadeIn', FadeInEffect, {
      category: 'in-place',
      description: 'Sequential word fade-in',
    });

    this.registry.register('glow', GlowEffect, {
      category: 'in-place',
      description: 'Text glow effect',
    });

    this.registry.register('flyingWord', FlyingWordEffect, {
      category: 'clone-based',
      description: 'Fly words to target position',
    });
  }

  /**
   * Wrap words in an element
   * @param {HTMLElement|string} element
   * @param {Object} options
   * @returns {Object} { wordCount, wordIds }
   */
  wrapElement(element, options = {}) {
    const el =
      typeof element === 'string' ? document.querySelector(element) : element;
    if (!el) return { wordCount: 0, wordIds: [] };
    return this.wordWrapper.wrapElement(el, options);
  }

  /**
   * Wrap all paragraphs on the page
   * @returns {Object} { totalWords }
   */
  wrapAllParagraphs() {
    return this.wordWrapper.wrapAllParagraphs();
  }

  /**
   * Restore all wrapped elements
   */
  restoreAll() {
    this.wordWrapper.restoreAll();
  }

  // ============================================
  // Convenience Methods for Common Animations
  // ============================================

  /**
   * Highlight specific words by text
   * @param {string[]} words - Words to highlight
   * @param {Object} options
   * @returns {Promise}
   */
  async highlightWords(words, options = {}) {
    const { color = 'rgba(255, 255, 0, 0.4)', ...effectOptions } = options;

    // First, wrap and find the words
    if (!options.skipWrap) {
      const el = options.element
        ? typeof options.element === 'string'
          ? document.querySelector(options.element)
          : options.element
        : document.body;
      this.wrapElement(el);
    }

    // Find matching words
    const matches = [];
    words.forEach((word) => {
      const found = this.wordWrapper.findWordsByText(word);
      matches.push(...found.map((f) => f.span));
    });

    if (!matches.length) return { wordCount: 0 };

    // Apply highlight effect
    const { instanceId, effect } = this.registry.createInstance(
      'highlight',
      this.managers,
      { color, ...effectOptions }
    );

    this.activeEffectIds.add(instanceId);
    await effect.apply(matches, effectOptions);

    return { wordCount: matches.length, effectId: instanceId };
  }

  /**
   * Apply glow effect to words
   * @param {string[]} words - Words to glow
   * @param {Object} options
   * @returns {Promise}
   */
  async glowWords(words, options = {}) {
    if (!options.skipWrap) {
      const el = options.element
        ? typeof options.element === 'string'
          ? document.querySelector(options.element)
          : options.element
        : document.body;
      this.wrapElement(el);
    }

    // Find matching words
    const matches = [];
    words.forEach((word) => {
      const found = this.wordWrapper.findWordsByText(word);
      matches.push(...found.map((f) => f.span));
    });

    if (!matches.length) return { wordCount: 0 };

    const { instanceId, effect } = this.registry.createInstance(
      'glow',
      this.managers,
      options
    );

    this.activeEffectIds.add(instanceId);
    await effect.apply(matches, options);

    return { wordCount: matches.length, effectId: instanceId };
  }

  /**
   * Fly words from source to form a summary
   * @param {HTMLElement|string} sourceElement - Source content element
   * @param {string} summaryText - Text of the summary
   * @param {Object} options
   * @returns {Promise}
   */
  async flyWordsToSummary(sourceElement, summaryText, options = {}) {
    const summaryWords = summaryText.split(/\s+/).filter((w) => w.length > 0);

    const { instanceId, effect } = this.registry.createInstance(
      'flyingWord',
      this.managers,
      options
    );

    this.activeEffectIds.add(instanceId);

    return effect.apply(sourceElement, {
      ...options,
      targetWords: summaryWords,
    });
  }

  /**
   * Apply a registered effect by name
   * @param {string} effectName
   * @param {HTMLElement|string} target
   * @param {Object} options
   * @returns {Promise}
   */
  async applyEffect(effectName, target, options = {}) {
    if (!this.registry.hasEffect(effectName)) {
      throw new Error(`Effect "${effectName}" not registered`);
    }

    const { instanceId, effect } = this.registry.createInstance(
      effectName,
      this.managers,
      options
    );

    this.activeEffectIds.add(instanceId);
    const result = await effect.apply(target, options);

    return { ...result, effectId: instanceId };
  }

  /**
   * Remove a specific effect by ID
   * @param {string} effectId
   * @returns {Promise}
   */
  async removeEffect(effectId) {
    await this.registry.removeInstance(effectId);
    this.activeEffectIds.delete(effectId);
  }

  /**
   * Remove all active effects
   * @returns {Promise}
   */
  async removeAllEffects() {
    await this.registry.removeAllInstances();
    this.activeEffectIds.clear();
  }

  // ============================================
  // Effect Registration
  // ============================================

  /**
   * Register a custom effect
   * @param {string} name
   * @param {class} EffectClass
   * @param {Object} metadata
   */
  registerEffect(name, EffectClass, metadata = {}) {
    this.registry.register(name, EffectClass, metadata);
  }

  /**
   * List all available effects
   * @returns {Array}
   */
  listEffects() {
    return this.registry.listEffects();
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get word by ID
   * @param {string} wordId
   * @returns {HTMLElement|null}
   */
  getWord(wordId) {
    return this.wordWrapper.getWord(wordId);
  }

  /**
   * Find words by text
   * @param {string} text
   * @returns {Array}
   */
  findWordsByText(text) {
    return this.wordWrapper.findWordsByText(text);
  }

  /**
   * Capture position of an element
   * @param {HTMLElement} element
   * @returns {Object}
   */
  capturePosition(element) {
    return this.positionManager.capturePosition(element);
  }

  /**
   * Get viewport dimensions
   * @returns {Object}
   */
  getViewportDimensions() {
    return this.positionManager.getViewportDimensions();
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clean up all resources
   */
  async destroy() {
    await this.removeAllEffects();
    this.wordWrapper.restoreAll();
    this.cloneManager.destroy();
    this.animationEngine.cancelAll();
    await this.registry.destroy();
    this.isInitialized = false;
  }

  /**
   * Get current state info
   * @returns {Object}
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      wrappedElementCount: this.wordWrapper.wrappedElements.size,
      wordCount: this.wordWrapper.wordMap.size,
      activeEffectCount: this.activeEffectIds.size,
      cloneCount: this.cloneManager.cloneCount,
      activeAnimationCount: this.animationEngine.activeCount,
    };
  }
}

export default AnimationCore;
