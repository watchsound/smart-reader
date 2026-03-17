/**
 * HighlightEffect - Apply background highlight to words
 *
 * Options:
 * - color: Background color (default: yellow)
 * - textColor: Text color (optional)
 * - animate: Whether to animate the highlight (default: true)
 * - duration: Animation duration in ms (default: 300)
 */

class HighlightEffect {
  constructor(managers, options = {}) {
    this.managers = managers;
    this.options = {
      color: 'rgba(255, 255, 0, 0.4)',
      textColor: null,
      animate: true,
      duration: 300,
      borderRadius: '2px',
      padding: '0 2px',
      ...options
    };

    this.instanceId = null;
    this.isActive = false;
    this.affectedWords = new Set();
    this.name = 'highlight';
    this.category = 'in-place';
  }

  async apply(target, options = {}) {
    const wordSpans = this._resolveTarget(target);
    if (wordSpans.length === 0) return;

    this.isActive = true;
    const opts = { ...this.options, ...options };

    wordSpans.forEach((span, index) => {
      this.affectedWords.add(span.id);

      // Store original styles
      this._storeOriginalStyle(span, ['backgroundColor', 'color', 'borderRadius', 'padding', 'transition']);

      // Apply highlight
      if (opts.animate) {
        span.style.transition = `background-color ${opts.duration}ms ease-out, color ${opts.duration}ms ease-out`;
        // Small delay for stagger effect
        setTimeout(() => {
          span.style.backgroundColor = opts.color;
          if (opts.textColor) span.style.color = opts.textColor;
          span.style.borderRadius = opts.borderRadius;
          span.style.padding = opts.padding;
        }, index * 20);
      } else {
        span.style.backgroundColor = opts.color;
        if (opts.textColor) span.style.color = opts.textColor;
        span.style.borderRadius = opts.borderRadius;
        span.style.padding = opts.padding;
      }

      span.classList.add('se-effect-highlight');
    });

    // Return promise that resolves when animation completes
    return new Promise(resolve => {
      setTimeout(resolve, opts.animate ? opts.duration + wordSpans.length * 20 : 0);
    });
  }

  async remove(options = {}) {
    if (!this.isActive) return;

    const { animate = true, duration = 300 } = options;
    const wordSpans = Array.from(this.affectedWords)
      .map(id => document.getElementById(id))
      .filter(Boolean);

    wordSpans.forEach(span => {
      if (animate) {
        span.style.transition = `background-color ${duration}ms ease-out, color ${duration}ms ease-out`;
      }
      this._restoreOriginalStyle(span);
      span.classList.remove('se-effect-highlight');
    });

    return new Promise(resolve => {
      setTimeout(() => {
        this.affectedWords.clear();
        this.isActive = false;
        resolve();
      }, animate ? duration : 0);
    });
  }

  destroy() {
    this.remove({ animate: false });
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
  module.exports = HighlightEffect;
} else {
  window.HighlightEffect = HighlightEffect;
}
