/**
 * HighlightEffect - Applies background highlight to words
 *
 * A simple in-place effect that highlights words without cloning.
 *
 * Usage:
 *   const effect = new HighlightEffect(managers, { color: 'rgba(255, 255, 0, 0.4)' });
 *   await effect.apply('.se-word', { staggerDelay: 20 });
 *   await effect.remove();
 */

import BaseEffect from './BaseEffect';

class HighlightEffect extends BaseEffect {
  constructor(managers, options = {}) {
    super(managers, {
      color: 'rgba(255, 255, 0, 0.4)',
      textColor: null,
      duration: 300,
      staggerDelay: 20,
      animate: true,
      ...options,
    });

    this.affectedWords = new Set();
  }

  /**
   * Apply highlight to target words
   * @param {HTMLElement|string|Array} target
   * @param {Object} options
   * @returns {Promise}
   */
  async apply(target, options = {}) {
    const spans = this._resolveTarget(target);
    if (!spans.length) return { wordCount: 0 };

    this.isActive = true;
    const opts = this._mergeOptions(options);

    // Apply highlight to each span
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      if (!span.id) continue;

      this.affectedWords.add(span.id);

      // Store original styles
      span.dataset.acOrigBg = span.style.backgroundColor || '';
      span.dataset.acOrigColor = span.style.color || '';

      if (opts.animate) {
        span.style.transition = `background-color ${opts.duration}ms ease-out, color ${opts.duration}ms ease-out`;
      }

      // Apply highlight after stagger delay
      await new Promise((resolve) => {
        setTimeout(() => {
          span.style.backgroundColor = opts.color;
          if (opts.textColor) {
            span.style.color = opts.textColor;
          }
          resolve();
        }, i * opts.staggerDelay);
      });
    }

    // Wait for final animation
    if (opts.animate) {
      await new Promise((r) => setTimeout(r, opts.duration));
    }

    return { wordCount: spans.length };
  }

  /**
   * Remove highlight from all affected words
   * @param {Object} options
   * @returns {Promise}
   */
  async remove(options = {}) {
    if (!this.isActive) return;

    const { duration = this.options.duration } = options;

    this.affectedWords.forEach((id) => {
      const span = document.getElementById(id);
      if (span) {
        span.style.transition = `background-color ${duration}ms ease-out, color ${duration}ms ease-out`;
        span.style.backgroundColor = span.dataset.acOrigBg || '';
        span.style.color = span.dataset.acOrigColor || '';
        delete span.dataset.acOrigBg;
        delete span.dataset.acOrigColor;
      }
    });

    await new Promise((r) => setTimeout(r, duration));

    this.affectedWords.clear();
    this.isActive = false;
  }
}

export default HighlightEffect;
