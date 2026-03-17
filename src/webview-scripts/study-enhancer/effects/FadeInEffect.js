/**
 * FadeInEffect - Fade in words sequentially
 *
 * Options:
 * - duration: Fade duration per word (default: 500ms)
 * - staggerDelay: Delay between words (default: 50ms)
 * - initialOpacity: Starting opacity (default: 0)
 * - slideUp: Also slide up while fading (default: false)
 * - slideDistance: Slide distance in px (default: 10)
 */

class FadeInEffect {
  constructor(managers, options = {}) {
    this.managers = managers;
    this.options = {
      duration: 500,
      staggerDelay: 50,
      initialOpacity: 0,
      slideUp: false,
      slideDistance: 10,
      easing: 'ease-out',
      ...options
    };

    this.instanceId = null;
    this.isActive = false;
    this.affectedWords = new Set();
    this.name = 'fadeIn';
    this.category = 'in-place';
  }

  async apply(target, options = {}) {
    const wordSpans = this._resolveTarget(target);
    if (wordSpans.length === 0) return;

    this.isActive = true;
    const opts = { ...this.options, ...options };

    // Set initial state
    wordSpans.forEach(span => {
      this.affectedWords.add(span.id);
      this._storeOriginalStyle(span, ['opacity', 'transform', 'transition', 'display']);

      span.style.opacity = opts.initialOpacity;
      span.style.display = 'inline-block'; // Required for transform

      if (opts.slideUp) {
        span.style.transform = `translateY(${opts.slideDistance}px)`;
      }
    });

    // Force reflow
    wordSpans[0]?.offsetHeight;

    // Animate each word with stagger
    const promises = wordSpans.map((span, index) => {
      return new Promise(resolve => {
        const delay = index * opts.staggerDelay;

        setTimeout(() => {
          span.style.transition = `opacity ${opts.duration}ms ${opts.easing}, transform ${opts.duration}ms ${opts.easing}`;
          span.style.opacity = '1';

          if (opts.slideUp) {
            span.style.transform = 'translateY(0)';
          }

          setTimeout(resolve, opts.duration);
        }, delay);
      });
    });

    await Promise.all(promises);
    return { wordCount: wordSpans.length };
  }

  async remove(options = {}) {
    if (!this.isActive) return;

    const wordSpans = Array.from(this.affectedWords)
      .map(id => document.getElementById(id))
      .filter(Boolean);

    wordSpans.forEach(span => {
      this._restoreOriginalStyle(span);
      span.classList.remove('se-effect-fadeIn');
    });

    this.affectedWords.clear();
    this.isActive = false;
  }

  /**
   * Fade out (reverse of fade in)
   */
  async fadeOut(options = {}) {
    const opts = { ...this.options, ...options };
    const wordSpans = Array.from(this.affectedWords)
      .map(id => document.getElementById(id))
      .filter(Boolean);

    // Reverse stagger (last word fades first or vice versa)
    const reversed = options.reverseStagger ? [...wordSpans].reverse() : wordSpans;

    const promises = reversed.map((span, index) => {
      return new Promise(resolve => {
        const delay = index * opts.staggerDelay;

        setTimeout(() => {
          span.style.transition = `opacity ${opts.duration}ms ${opts.easing}, transform ${opts.duration}ms ${opts.easing}`;
          span.style.opacity = '0';

          if (opts.slideUp) {
            span.style.transform = `translateY(-${opts.slideDistance}px)`;
          }

          setTimeout(resolve, opts.duration);
        }, delay);
      });
    });

    await Promise.all(promises);
  }

  destroy() {
    this.remove();
    this.managers = null;
  }

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

  _storeOriginalStyle(span, properties) {
    if (!span.dataset.seOriginalStyles) {
      const original = {};
      properties.forEach(prop => {
        original[prop] = span.style[prop] || '';
      });
      span.dataset.seOriginalStyles = JSON.stringify(original);
    }
  }

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
  module.exports = FadeInEffect;
} else {
  window.FadeInEffect = FadeInEffect;
}
