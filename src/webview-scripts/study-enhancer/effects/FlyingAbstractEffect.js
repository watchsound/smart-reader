/**
 * FlyingAbstractEffect - Words fly from paragraph to form abstract
 *
 * This effect:
 * 1. Takes source words from a paragraph
 * 2. Takes an abstract text (e.g., from AI)
 * 3. Matches words from paragraph that appear in abstract
 * 4. Clones matched words and flies them to form the abstract
 *
 * Options:
 * - abstract: The abstract text or array of words
 * - targetPosition: Where to display abstract ('center', 'top', 'bottom', {x, y})
 * - duration: Flight duration (default: 800ms)
 * - staggerDelay: Delay between words (default: 50ms)
 * - dimSource: Dim source words (default: true)
 * - easing: Animation easing (default: 'easeOutCubic')
 * - showContainer: Show a container around the abstract (default: true)
 */

class FlyingAbstractEffect {
  constructor(managers, options = {}) {
    this.managers = managers;
    this.options = {
      abstract: '',
      targetPosition: 'center',
      targetMaxWidth: 500,
      duration: 800,
      staggerDelay: 50,
      dimSource: true,
      dimOpacity: 0.3,
      easing: 'easeOutCubic',
      showContainer: true,
      containerStyle: {
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      },
      ...options
    };

    this.instanceId = null;
    this.isActive = false;
    this.cloneIds = [];
    this.sourceWordIds = new Set();
    this.abstractContainer = null;

    this.name = 'flyingAbstract';
    this.category = 'clone-based';
  }

  /**
   * Apply the flying abstract effect
   * @param {string|HTMLElement} sourceElement - Source paragraph or selector
   * @param {Object} options - Runtime options
   */
  async apply(sourceElement, options = {}) {
    const opts = { ...this.options, ...options };
    const abstract = opts.abstract;

    if (!abstract) {
      console.warn('FlyingAbstractEffect: No abstract provided');
      return;
    }

    // Get source element
    const source = typeof sourceElement === 'string'
      ? document.querySelector(sourceElement)
      : sourceElement;

    if (!source) {
      console.warn('FlyingAbstractEffect: Source element not found');
      return;
    }

    this.isActive = true;

    // Step 1: Wrap words in source if not already wrapped
    const wrapResult = this.managers.wordWrapper.wrapElement(source);

    // Step 2: Parse abstract into words
    const abstractWords = typeof abstract === 'string'
      ? abstract.split(/\s+/).filter(w => w.length > 0)
      : abstract;

    // Step 3: Match source words to abstract words
    const matches = this._findMatches(wrapResult.wordIds, abstractWords);

    if (matches.length === 0) {
      console.warn('FlyingAbstractEffect: No matching words found');
      return;
    }

    // Step 4: Calculate target layout
    const targetLayout = this.managers.positionManager.calculateTargetLayout(
      matches.map(m => m.abstractWord),
      {
        maxWidth: opts.targetMaxWidth,
        position: opts.targetPosition,
        fontSize: window.getComputedStyle(source).fontSize
      }
    );

    // Step 5: Create container for abstract (optional)
    if (opts.showContainer) {
      this._createAbstractContainer(targetLayout.containerBounds, opts.containerStyle);
    }

    // Step 6: Create clones for matched words
    const clones = [];
    matches.forEach((match, index) => {
      const sourceSpan = document.getElementById(match.sourceWordId);
      if (!sourceSpan) return;

      const cloneData = this.managers.cloneManager.cloneWord(sourceSpan, {
        inheritStyles: true,
        additionalClass: 'se-flying-word'
      });

      clones.push({
        ...cloneData,
        match,
        targetPosition: targetLayout.words[index].position
      });

      this.cloneIds.push(cloneData.cloneId);
      this.sourceWordIds.add(match.sourceWordId);

      // Dim source word
      if (opts.dimSource) {
        this.managers.cloneManager.dimSource(match.sourceWordId, opts.dimOpacity);
      }
    });

    // Step 7: Animate clones to target positions
    const flights = clones.map((clone, index) => ({
      element: clone.element,
      from: { x: clone.position.x, y: clone.position.y },
      to: { x: clone.targetPosition.x, y: clone.targetPosition.y },
      options: {
        duration: opts.duration,
        easing: opts.easing
      }
    }));

    await this.managers.animationEngine.flyMultiple(flights, {
      staggerDelay: opts.staggerDelay,
      staggerPattern: 'linear'
    });

    return {
      matchCount: matches.length,
      abstractWords: abstractWords.length,
      matches
    };
  }

  /**
   * Reverse the effect - fly words back to source
   */
  async reverse(options = {}) {
    const opts = { ...this.options, ...options };

    // Get current clone positions and fly back to source
    const flights = [];

    this.cloneIds.forEach(cloneId => {
      const cloneData = this.managers.cloneManager.getClone(cloneId);
      if (!cloneData) return;

      const currentRect = cloneData.element.getBoundingClientRect();
      const sourceSpan = document.getElementById(cloneData.sourceId);

      if (sourceSpan) {
        const sourceRect = sourceSpan.getBoundingClientRect();
        flights.push({
          element: cloneData.element,
          from: { x: currentRect.left, y: currentRect.top },
          to: { x: sourceRect.left, y: sourceRect.top },
          options: {
            duration: opts.duration,
            easing: opts.easing
          }
        });
      }
    });

    await this.managers.animationEngine.flyMultiple(flights, {
      staggerDelay: opts.staggerDelay,
      staggerPattern: 'reverse'
    });

    // Clean up
    await this.remove({ fadeOutDuration: 0 });
  }

  /**
   * Remove effect
   */
  async remove(options = {}) {
    if (!this.isActive) return;

    const { fadeOutDuration = 300 } = options;

    // Remove clones
    if (fadeOutDuration > 0) {
      await Promise.all(
        this.cloneIds.map(id =>
          this.managers.cloneManager.fadeOutAndRemove(id, fadeOutDuration)
        )
      );
    } else {
      this.cloneIds.forEach(id => {
        this.managers.cloneManager.removeClone(id);
      });
    }

    // Restore source words
    this.sourceWordIds.forEach(id => {
      this.managers.cloneManager.restoreSource(id);
    });

    // Remove abstract container
    if (this.abstractContainer && this.abstractContainer.parentNode) {
      if (fadeOutDuration > 0) {
        this.abstractContainer.style.transition = `opacity ${fadeOutDuration}ms ease-out`;
        this.abstractContainer.style.opacity = '0';
        await new Promise(r => setTimeout(r, fadeOutDuration));
      }
      this.abstractContainer.parentNode.removeChild(this.abstractContainer);
      this.abstractContainer = null;
    }

    this.cloneIds = [];
    this.sourceWordIds.clear();
    this.isActive = false;
  }

  destroy() {
    this.remove({ fadeOutDuration: 0 });
    this.managers = null;
  }

  /**
   * Find words from source that match abstract
   * @private
   */
  _findMatches(sourceWordIds, abstractWords) {
    const matches = [];
    const usedSourceIds = new Set();
    const abstractLower = abstractWords.map(w =>
      w.toLowerCase().replace(/[.,!?;:'"()[\]{}]/g, '')
    );

    // For each abstract word, find a matching source word
    abstractWords.forEach((abstractWord, abstractIndex) => {
      const searchText = abstractLower[abstractIndex];
      if (!searchText) return;

      // Find unused source word that matches
      for (const sourceId of sourceWordIds) {
        if (usedSourceIds.has(sourceId)) continue;

        const sourceSpan = document.getElementById(sourceId);
        if (!sourceSpan) continue;

        const sourceText = sourceSpan.textContent
          .toLowerCase()
          .replace(/[.,!?;:'"()[\]{}]/g, '');

        if (sourceText === searchText) {
          matches.push({
            sourceWordId: sourceId,
            abstractWord,
            abstractIndex
          });
          usedSourceIds.add(sourceId);
          break;
        }
      }
    });

    return matches;
  }

  /**
   * Create container for abstract display
   * @private
   */
  _createAbstractContainer(bounds, style) {
    this.abstractContainer = document.createElement('div');
    this.abstractContainer.className = 'se-abstract-container';
    this.abstractContainer.style.cssText = `
      position: fixed;
      left: ${bounds.x}px;
      top: ${bounds.y}px;
      width: ${bounds.width}px;
      min-height: ${bounds.height}px;
      background: ${style.background || 'rgba(255,255,255,0.95)'};
      border-radius: ${style.borderRadius || '8px'};
      padding: ${style.padding || '20px'};
      box-shadow: ${style.boxShadow || '0 4px 20px rgba(0,0,0,0.15)'};
      z-index: 999998;
      pointer-events: none;
      opacity: 0;
      transition: opacity 300ms ease-out;
    `;

    document.body.appendChild(this.abstractContainer);

    // Fade in
    requestAnimationFrame(() => {
      this.abstractContainer.style.opacity = '1';
    });
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlyingAbstractEffect;
} else {
  window.FlyingAbstractEffect = FlyingAbstractEffect;
}
