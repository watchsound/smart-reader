/**
 * FlyingWordEffect - Makes words fly to a target location
 *
 * A clone-based effect that creates flying word animations.
 * Words are cloned and animated while the originals are dimmed.
 *
 * Usage:
 *   const effect = new FlyingWordEffect(managers);
 *   await effect.apply(sourceElement, {
 *     targetWords: ['these', 'words', 'will', 'fly'],
 *     targetPosition: { x: 100, y: 100 }
 *   });
 */

import BaseEffect from './BaseEffect';

class FlyingWordEffect extends BaseEffect {
  constructor(managers, options = {}) {
    super(managers, {
      duration: 1000,
      staggerDelay: 80,
      dimSource: true,
      dimOpacity: 0.3,
      glowColor: '#00bfff',
      useBezier: true,
      arcHeight: 80,
      ...options,
    });

    this.cloneIds = [];
    this.sourceWordIds = new Set();
    this.container = null;
  }

  /**
   * Apply flying word effect
   * @param {HTMLElement|string} sourceElement - Source element to wrap
   * @param {Object} options - Effect options including targetWords and targetPosition
   * @returns {Promise}
   */
  async apply(sourceElement, options = {}) {
    const opts = this._mergeOptions(options);
    const source =
      typeof sourceElement === 'string'
        ? document.querySelector(sourceElement)
        : sourceElement;

    if (!source) {
      console.warn('FlyingWordEffect: Source element not found');
      return { matchCount: 0 };
    }

    if (!opts.targetWords || !opts.targetWords.length) {
      console.warn('FlyingWordEffect: No target words provided');
      return { matchCount: 0 };
    }

    this.isActive = true;

    // Wrap words in source element
    const wrapResult = this.managers.wordWrapper.wrapElement(source);

    // Find matching words
    const matches = this._findMatches(wrapResult.wordIds, opts.targetWords);

    if (!matches.length) {
      console.log('FlyingWordEffect: No matching words found');
      return { matchCount: 0 };
    }

    // Calculate target positions
    const targetLayout = this.managers.positionManager.calculateTargetLayout(
      matches.map((m) => m.word),
      {
        maxWidth: opts.targetMaxWidth || 500,
        position: opts.targetPosition || 'center',
      }
    );

    // Create container if requested
    if (opts.showContainer !== false) {
      this._createTargetContainer(targetLayout.containerBounds, opts);
    }

    // Clone words and set up flights
    const flights = [];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const sourceSpan = document.getElementById(match.sourceWordId);
      if (!sourceSpan) continue;

      // Clone the word
      const cloneData = this.managers.cloneManager.cloneWord(sourceSpan, {
        additionalClass: 'ac-flying-word',
        styles: {
          textShadow: `0 0 12px ${opts.glowColor}, 0 0 24px ${opts.glowColor}`,
          color: '#fff',
          fontWeight: '600',
        },
      });

      this.cloneIds.push(cloneData.cloneId);
      this.sourceWordIds.add(match.sourceWordId);

      // Dim source
      if (opts.dimSource) {
        this.managers.cloneManager.dimSource(match.sourceWordId, opts.dimOpacity);
      }

      // Add to flight list
      flights.push({
        element: cloneData.element,
        from: cloneData.position,
        to: targetLayout.words[i].position,
        options: {
          duration: opts.duration,
          easing: 'easeOutCubic',
        },
      });
    }

    // Execute flights
    if (opts.useBezier) {
      await this._flyBezierMultiple(flights, opts);
    } else {
      await this.managers.animationEngine.flyMultiple(flights, {
        staggerDelay: opts.staggerDelay,
      });
    }

    return { matchCount: matches.length };
  }

  /**
   * Fly multiple words using Bezier curves
   * @private
   */
  async _flyBezierMultiple(flights, opts) {
    const promises = flights.map(
      (f, i) =>
        new Promise((resolve) => {
          setTimeout(async () => {
            await this.managers.animationEngine.flyBezier(f.element, f.from, f.to, {
              duration: opts.duration,
              arcHeight: opts.arcHeight,
              onUpdate: ({ progress }) => {
                // Fade glow as word approaches target
                if (progress > 0.7) {
                  const fadeProgress = (progress - 0.7) / 0.3;
                  const glowSize = 12 * (1 - fadeProgress);
                  f.element.style.textShadow = `0 0 ${glowSize}px ${opts.glowColor}`;
                }
              },
            });
            resolve();
          }, i * opts.staggerDelay);
        })
    );

    await Promise.all(promises);
  }

  /**
   * Create target container
   * @private
   */
  _createTargetContainer(bounds, opts) {
    this.container = document.createElement('div');
    this.container.className = 'ac-flying-target-container';
    this.container.style.cssText = `
      position: fixed;
      left: ${bounds.x}px;
      top: ${bounds.y}px;
      width: ${bounds.width}px;
      min-height: ${bounds.height}px;
      background: ${opts.containerBackground || 'rgba(255, 255, 255, 0.95)'};
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 999998;
      opacity: 0;
      transition: opacity 300ms ease-out;
    `;

    document.body.appendChild(this.container);
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });
  }

  /**
   * Find matching words in source
   * @private
   */
  _findMatches(sourceWordIds, targetWords) {
    const matches = [];
    const used = new Set();
    const targetLower = targetWords.map((w) =>
      w.toLowerCase().replace(/[.,!?;:'"]/g, '')
    );

    targetWords.forEach((word, index) => {
      const search = targetLower[index];
      if (!search) return;

      for (const sid of sourceWordIds) {
        if (used.has(sid)) continue;
        const span = document.getElementById(sid);
        if (!span) continue;

        const spanText = span.textContent.toLowerCase().replace(/[.,!?;:'"]/g, '');

        if (spanText === search) {
          matches.push({
            sourceWordId: sid,
            word: word,
            index: index,
          });
          used.add(sid);
          break;
        }
      }
    });

    return matches;
  }

  /**
   * Remove effect
   * @param {Object} options
   * @returns {Promise}
   */
  async remove(options = {}) {
    if (!this.isActive) return;

    const { fadeOutDuration = 300 } = options;

    // Fade out and remove clones
    await Promise.all(
      this.cloneIds.map((id) =>
        this.managers.cloneManager.fadeOutAndRemove(id, fadeOutDuration)
      )
    );

    // Restore sources
    this.sourceWordIds.forEach((id) => {
      this.managers.cloneManager.restoreSource(id);
    });

    // Remove container
    if (this.container) {
      this.container.style.opacity = '0';
      await new Promise((r) => setTimeout(r, fadeOutDuration));
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
    }

    this.cloneIds = [];
    this.sourceWordIds.clear();
    this.isActive = false;
  }
}

export default FlyingWordEffect;
