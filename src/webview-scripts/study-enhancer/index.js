/**
 * StudyEnhancer - Main Entry Point
 *
 * This file bundles all components and provides a unified API
 * for the renderer process to interact with.
 *
 * Usage (injected into webview):
 *   window.studyEnhancer.wrapParagraph('p.content')
 *   window.studyEnhancer.applyEffect('highlight', '.se-word', { color: 'yellow' })
 *   window.studyEnhancer.applyEffect('flyingAbstract', 'p', { abstract: '...' })
 */

// Import components (these will be bundled or loaded separately)
// For now, we assume they're loaded via script tags or bundled

(function(global) {
  'use strict';

  // ============================================
  // Component Initialization
  // ============================================

  const wordWrapper = new WordWrapper();
  const positionManager = new PositionManager();
  const cloneManager = new CloneManager();
  const animationEngine = new AnimationEngine();
  const registry = new EffectRegistry();

  // Managers object passed to effects
  const managers = {
    wordWrapper,
    positionManager,
    cloneManager,
    animationEngine
  };

  // ============================================
  // Register Built-in Effects
  // ============================================

  registry.register('highlight', HighlightEffect, {
    description: 'Apply background highlight to words',
    category: 'in-place'
  });

  registry.register('fadeIn', FadeInEffect, {
    description: 'Fade in words sequentially',
    category: 'in-place'
  });

  registry.register('flyingAbstract', FlyingAbstractEffect, {
    description: 'Words fly to form abstract summary',
    category: 'clone-based'
  });

  // ============================================
  // Inject CSS Styles
  // ============================================

  function injectStyles() {
    if (document.getElementById('se-styles')) return;

    const style = document.createElement('style');
    style.id = 'se-styles';
    style.textContent = `
      .se-word { display: inline; position: relative; }
      #se-clone-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999999; overflow: visible; }
      .se-clone { position: fixed; margin: 0; padding: 0; pointer-events: none; will-change: transform, opacity, left, top; }
      .se-effect-highlight { transition: background-color 0.3s ease-out; }
      .se-flying-word { z-index: 999999; text-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .se-abstract-container { z-index: 999998; backdrop-filter: blur(5px); }
      @keyframes se-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      @keyframes se-blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
      .se-dimmed { opacity: 0.3; transition: opacity 0.3s ease-out; }
      .se-vocabulary { background-color: rgba(100, 200, 255, 0.2); border-bottom: 2px solid rgba(100, 200, 255, 0.6); cursor: pointer; }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // Public API
  // ============================================

  const studyEnhancer = {
    // Version
    version: '1.0.0',

    // Direct access to managers (for advanced use)
    managers,
    registry,

    /**
     * Initialize the enhancer (inject styles, etc.)
     */
    init() {
      injectStyles();
      return this;
    },

    /**
     * Wrap words in an element
     * @param {string|HTMLElement} target - Selector or element
     * @returns {Object} - { wordCount, wordIds }
     */
    wrapElement(target) {
      const element = typeof target === 'string'
        ? document.querySelector(target)
        : target;

      if (!element) {
        console.warn('StudyEnhancer: Element not found:', target);
        return { wordCount: 0, wordIds: [] };
      }

      return wordWrapper.wrapElement(element);
    },

    /**
     * Wrap all paragraphs in the page
     */
    wrapAllParagraphs() {
      return wordWrapper.wrapAllParagraphs();
    },

    /**
     * Apply an effect
     * @param {string} effectName - Registered effect name
     * @param {string|HTMLElement|Array} target - Target words/element
     * @param {Object} options - Effect options
     * @returns {Promise<Object>} - { instanceId, result }
     */
    async applyEffect(effectName, target, options = {}) {
      if (!registry.hasEffect(effectName)) {
        throw new Error(`Effect "${effectName}" is not registered`);
      }

      const { instanceId, effect } = registry.createInstance(effectName, managers, options);

      try {
        const result = await effect.apply(target, options);
        return { instanceId, result };
      } catch (error) {
        console.error(`StudyEnhancer: Error applying "${effectName}":`, error);
        registry.removeInstance(instanceId);
        throw error;
      }
    },

    /**
     * Remove an active effect
     * @param {string} instanceId
     * @param {Object} options
     */
    async removeEffect(instanceId, options = {}) {
      const effect = registry.getInstance(instanceId);
      if (effect) {
        await effect.remove(options);
        registry.removeInstance(instanceId);
      }
    },

    /**
     * Remove all active effects
     */
    async removeAllEffects() {
      const effects = registry.getActiveEffects();
      const promises = [];

      effects.forEach((effect, instanceId) => {
        promises.push(this.removeEffect(instanceId));
      });

      await Promise.all(promises);
    },

    /**
     * Restore all wrapped elements to original state
     */
    restoreAll() {
      this.removeAllEffects();
      wordWrapper.restoreAll();
      cloneManager.destroy();
    },

    /**
     * Get word by ID
     * @param {string} wordId
     * @returns {HTMLElement|null}
     */
    getWord(wordId) {
      return wordWrapper.getWord(wordId);
    },

    /**
     * Find words by text
     * @param {string} text
     * @returns {Array}
     */
    findWords(text) {
      return wordWrapper.findWordsByText(text);
    },

    /**
     * Highlight specific words by text
     * @param {string[]} texts - Array of words to highlight
     * @param {Object} options - Highlight options
     */
    async highlightWords(texts, options = {}) {
      const allMatches = [];

      texts.forEach(text => {
        const matches = wordWrapper.findWordsByText(text);
        allMatches.push(...matches.map(m => m.span));
      });

      if (allMatches.length > 0) {
        return this.applyEffect('highlight', allMatches, options);
      }

      return null;
    },

    /**
     * Apply flying abstract effect
     * @param {string|HTMLElement} sourceElement - Source paragraph
     * @param {string} abstract - Abstract text from AI
     * @param {Object} options
     */
    async flyingAbstract(sourceElement, abstract, options = {}) {
      // First wrap the source element
      this.wrapElement(sourceElement);

      return this.applyEffect('flyingAbstract', sourceElement, {
        abstract,
        ...options
      });
    },

    /**
     * Register a custom effect
     * @param {string} name
     * @param {Class} EffectClass
     * @param {Object} metadata
     */
    registerEffect(name, EffectClass, metadata = {}) {
      registry.register(name, EffectClass, metadata);
    },

    /**
     * List all available effects
     */
    listEffects() {
      return registry.listEffects();
    },

    /**
     * Send event to parent window (renderer process)
     * @param {string} eventType
     * @param {Object} data
     */
    sendEvent(eventType, data) {
      if (typeof window.ipcRenderer !== 'undefined') {
        window.ipcRenderer.sendToHost('study-enhancer-event', {
          type: eventType,
          ...data
        });
      } else if (window.parent !== window) {
        window.parent.postMessage({
          source: 'study-enhancer',
          type: eventType,
          ...data
        }, '*');
      }
    },

    /**
     * Cleanup and destroy
     */
    destroy() {
      this.restoreAll();
      const styleEl = document.getElementById('se-styles');
      if (styleEl) styleEl.remove();
    }
  };

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => studyEnhancer.init());
  } else {
    studyEnhancer.init();
  }

  // Expose globally
  global.studyEnhancer = studyEnhancer;

  // Also expose individual classes for custom effect development
  global.StudyEnhancer = {
    WordWrapper,
    PositionManager,
    CloneManager,
    AnimationEngine,
    EffectRegistry,
    BaseEffect,
    BaseCloneEffect,
    HighlightEffect,
    FadeInEffect,
    FlyingAbstractEffect
  };

})(typeof window !== 'undefined' ? window : this);
