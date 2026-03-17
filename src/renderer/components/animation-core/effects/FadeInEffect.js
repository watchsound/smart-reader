/**
 * FadeInEffect - Fades words in with optional slide-up animation
 *
 * An in-place effect that reveals words sequentially.
 *
 * Usage:
 *   const effect = new FadeInEffect(managers, { slideUp: true });
 *   await effect.apply('p.content');
 */

import BaseEffect from './BaseEffect';

class FadeInEffect extends BaseEffect {
  constructor(managers, options = {}) {
    super(managers, {
      duration: 500,
      staggerDelay: 50,
      slideUp: false,
      slideDistance: 10,
      initialOpacity: 0,
      ...options,
    });

    this.affectedWords = new Set();
  }

  /**
   * Apply fade-in effect
   * @param {HTMLElement|string|Array} target
   * @param {Object} options
   * @returns {Promise}
   */
  async apply(target, options = {}) {
    const spans = this._resolveTarget(target);
    if (!spans.length) return { wordCount: 0 };

    this.isActive = true;
    const opts = this._mergeOptions(options);

    // Set initial state for all spans
    spans.forEach((span) => {
      if (!span.id) return;
      this.affectedWords.add(span.id);

      // Store original styles
      span.dataset.acOrigOpacity = span.style.opacity || '';
      span.dataset.acOrigTransform = span.style.transform || '';
      span.dataset.acOrigDisplay = span.style.display || '';

      // Set initial state
      span.style.opacity = String(opts.initialOpacity);
      span.style.display = 'inline-block';
      if (opts.slideUp) {
        span.style.transform = `translateY(${opts.slideDistance}px)`;
      }
    });

    // Force reflow
    spans[0]?.offsetHeight;

    // Animate each span
    const promises = spans.map(
      (span, i) =>
        new Promise((resolve) => {
          setTimeout(() => {
            span.style.transition = `opacity ${opts.duration}ms ease-out, transform ${opts.duration}ms ease-out`;
            span.style.opacity = '1';
            if (opts.slideUp) {
              span.style.transform = 'translateY(0)';
            }
            setTimeout(resolve, opts.duration);
          }, i * opts.staggerDelay);
        })
    );

    await Promise.all(promises);
    return { wordCount: spans.length };
  }

  /**
   * Remove effect (restore original styles)
   * @param {Object} options
   * @returns {Promise}
   */
  async remove(options = {}) {
    if (!this.isActive) return;

    this.affectedWords.forEach((id) => {
      const span = document.getElementById(id);
      if (span) {
        span.style.opacity = span.dataset.acOrigOpacity || '';
        span.style.transform = span.dataset.acOrigTransform || '';
        span.style.display = span.dataset.acOrigDisplay || '';
        span.style.transition = '';
        delete span.dataset.acOrigOpacity;
        delete span.dataset.acOrigTransform;
        delete span.dataset.acOrigDisplay;
      }
    });

    this.affectedWords.clear();
    this.isActive = false;
  }
}

export default FadeInEffect;
