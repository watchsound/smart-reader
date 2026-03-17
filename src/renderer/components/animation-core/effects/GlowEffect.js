/**
 * GlowEffect - Applies glowing text-shadow effect to words
 *
 * Creates a pulsing glow effect typically used to highlight important words
 * like vocabulary or key concepts.
 *
 * Usage:
 *   const effect = new GlowEffect(managers, { color: '#ffd700' });
 *   await effect.apply(wordElements);
 */

import BaseEffect from './BaseEffect';

class GlowEffect extends BaseEffect {
  constructor(managers, options = {}) {
    super(managers, {
      color: '#00bfff',
      intensity: [8, 16, 24],
      duration: 400,
      staggerDelay: 30,
      pulse: true,
      pulseScale: 1.15,
      ...options,
    });

    this.affectedWords = new Set();
    this.styleElement = null;
  }

  /**
   * Apply glow effect
   * @param {HTMLElement|string|Array} target
   * @param {Object} options
   * @returns {Promise}
   */
  async apply(target, options = {}) {
    const spans = this._resolveTarget(target);
    if (!spans.length) return { wordCount: 0 };

    this.isActive = true;
    const opts = this._mergeOptions(options);

    // Inject keyframe animation if needed
    this._ensureAnimationStyle();

    // Build text-shadow string
    const shadowStr = opts.intensity
      .map((i) => `0 0 ${i}px ${opts.color}`)
      .join(', ');

    // Apply to each span with stagger
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      if (!span.id) continue;

      this.affectedWords.add(span.id);

      // Store original styles
      span.dataset.acOrigShadow = span.style.textShadow || '';
      span.dataset.acOrigColor = span.style.color || '';
      span.dataset.acOrigPosition = span.style.position || '';
      span.dataset.acOrigZIndex = span.style.zIndex || '';
      span.dataset.acOrigDisplay = span.style.display || '';
      span.dataset.acOrigAnimation = span.style.animation || '';

      span.style.transition = `all ${opts.duration}ms ease-out`;
      span.style.textShadow = shadowStr;
      span.style.color = '#fff';
      span.style.position = 'relative';
      span.style.zIndex = '999995';
      span.style.display = 'inline-block';

      if (opts.pulse) {
        span.style.animation = `ac-glow-pulse ${opts.duration}ms ease-out`;
      }

      await new Promise((r) => setTimeout(r, opts.staggerDelay));
    }

    await new Promise((r) => setTimeout(r, opts.duration));
    return { wordCount: spans.length };
  }

  /**
   * Remove glow effect
   * @param {Object} options
   * @returns {Promise}
   */
  async remove(options = {}) {
    if (!this.isActive) return;

    const { duration = 300 } = options;

    this.affectedWords.forEach((id) => {
      const span = document.getElementById(id);
      if (span) {
        span.style.transition = `all ${duration}ms ease-out`;
        span.style.textShadow = span.dataset.acOrigShadow || '';
        span.style.color = span.dataset.acOrigColor || '';
        span.style.position = span.dataset.acOrigPosition || '';
        span.style.zIndex = span.dataset.acOrigZIndex || '';
        span.style.display = span.dataset.acOrigDisplay || '';
        span.style.animation = span.dataset.acOrigAnimation || '';

        delete span.dataset.acOrigShadow;
        delete span.dataset.acOrigColor;
        delete span.dataset.acOrigPosition;
        delete span.dataset.acOrigZIndex;
        delete span.dataset.acOrigDisplay;
        delete span.dataset.acOrigAnimation;
      }
    });

    await new Promise((r) => setTimeout(r, duration));

    this.affectedWords.clear();
    this.isActive = false;
  }

  /**
   * Ensure animation keyframes exist
   * @private
   */
  _ensureAnimationStyle() {
    if (document.getElementById('ac-glow-animation')) return;

    const style = document.createElement('style');
    style.id = 'ac-glow-animation';
    style.textContent = `
      @keyframes ac-glow-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(${this.options.pulseScale}); }
      }
    `;
    document.head.appendChild(style);
    this.styleElement = style;
  }

  destroy() {
    super.destroy();
    // Note: We don't remove the style element as other effects might use it
  }
}

export default GlowEffect;
