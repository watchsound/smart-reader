/**
 * LeitnerTransitionEffect - Animated transitions for Leitner box changes
 *
 * Creates visual feedback when cards move between Leitner boxes:
 * - Promotion (correct answer): Upward movement with celebration
 * - Demotion (incorrect answer): Downward movement with subtle shake
 * - Completion: Special "graduation" animation
 *
 * Usage:
 *   const effect = new LeitnerTransitionEffect(managers, {
 *     showParticles: true,
 *     duration: 800
 *   });
 *
 *   await effect.apply(cardElement, {
 *     fromBox: 2,
 *     toBox: 3,
 *     isCorrect: true
 *   });
 */

import BaseEffect from './BaseEffect';

class LeitnerTransitionEffect extends BaseEffect {
  constructor(managers, options = {}) {
    super(managers, {
      duration: 800,
      showParticles: true,
      particleCount: 15,
      promotionColor: '#2ecc71',
      demotionColor: '#ff5252',
      completionColor: '#ffd700',
      ...options,
    });

    this.styleElement = null;
    this.particles = [];
  }

  /**
   * Apply the Leitner transition animation
   * @param {HTMLElement} cardElement - The card element to animate
   * @param {Object} options - Transition options
   * @returns {Promise}
   */
  async apply(cardElement, options = {}) {
    const opts = this._mergeOptions(options);

    if (!cardElement) {
      console.warn('LeitnerTransitionEffect: No card element provided');
      return;
    }

    const { fromBox, toBox, isCorrect, isCompletion } = opts;

    this.isActive = true;

    // Ensure styles are injected
    this._ensureStyles();

    // Determine transition type
    if (isCompletion || (toBox === 5 && isCorrect)) {
      await this._animateCompletion(cardElement, opts);
    } else if (isCorrect) {
      await this._animatePromotion(cardElement, fromBox, toBox, opts);
    } else {
      await this._animateDemotion(cardElement, fromBox, toBox, opts);
    }

    this.isActive = false;
  }

  /**
   * Animate promotion (moving up in boxes)
   * @private
   */
  async _animatePromotion(element, fromBox, toBox, opts) {
    const { duration, showParticles, promotionColor } = opts;

    // Save original state
    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;
    const originalBoxShadow = element.style.boxShadow;

    // Phase 1: Build up
    element.style.transition = `all ${duration * 0.3}ms ease-out`;
    element.style.transform = 'scale(1.05)';
    element.style.boxShadow = `0 8px 30px ${promotionColor}40`;

    await new Promise((r) => setTimeout(r, duration * 0.3));

    // Phase 2: Launch upward
    element.style.transition = `all ${duration * 0.4}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    element.style.transform = 'scale(1.1) translateY(-30px)';
    element.style.boxShadow = `0 20px 50px ${promotionColor}60`;

    // Add glow effect
    element.style.outline = `3px solid ${promotionColor}`;
    element.style.outlineOffset = '2px';

    if (showParticles) {
      this._createRisingParticles(element, promotionColor);
    }

    await new Promise((r) => setTimeout(r, duration * 0.4));

    // Phase 3: Settle
    element.style.transition = `all ${duration * 0.3}ms ease-out`;
    element.style.transform = originalTransform || 'scale(1) translateY(0)';
    element.style.boxShadow = originalBoxShadow || '';
    element.style.outline = '';
    element.style.outlineOffset = '';

    await new Promise((r) => setTimeout(r, duration * 0.3));

    element.style.transition = originalTransition || '';
  }

  /**
   * Animate demotion (moving down in boxes)
   * @private
   */
  async _animateDemotion(element, fromBox, toBox, opts) {
    const { duration, demotionColor } = opts;

    // Save original state
    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;
    const originalBoxShadow = element.style.boxShadow;

    // Phase 1: Shake
    element.style.transition = 'none';

    for (let i = 0; i < 4; i++) {
      const offset = i % 2 === 0 ? -8 : 8;
      element.style.transform = `translateX(${offset}px)`;
      await new Promise((r) => setTimeout(r, 50));
    }

    // Phase 2: Drop
    element.style.transition = `all ${duration * 0.5}ms ease-in`;
    element.style.transform = 'scale(0.95) translateY(15px)';
    element.style.boxShadow = `0 5px 20px ${demotionColor}40`;
    element.style.outline = `2px solid ${demotionColor}`;
    element.style.outlineOffset = '1px';

    await new Promise((r) => setTimeout(r, duration * 0.5));

    // Phase 3: Bounce back
    element.style.transition = `all ${duration * 0.3}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    element.style.transform = originalTransform || 'scale(1) translateY(0)';
    element.style.boxShadow = originalBoxShadow || '';
    element.style.outline = '';
    element.style.outlineOffset = '';

    await new Promise((r) => setTimeout(r, duration * 0.3));

    element.style.transition = originalTransition || '';
  }

  /**
   * Animate completion (fully learned)
   * @private
   */
  async _animateCompletion(element, opts) {
    const { duration, showParticles, completionColor, particleCount } = opts;

    // Save original state
    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;
    const originalBoxShadow = element.style.boxShadow;

    // Phase 1: Build up with golden glow
    element.style.transition = `all ${duration * 0.2}ms ease-out`;
    element.style.transform = 'scale(1.1)';
    element.style.boxShadow = `0 0 30px ${completionColor}, 0 0 60px ${completionColor}80`;

    await new Promise((r) => setTimeout(r, duration * 0.2));

    // Phase 2: Celebration burst
    element.style.transition = `all ${duration * 0.3}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    element.style.transform = 'scale(1.2) rotate(2deg)';

    // Create confetti explosion
    if (showParticles) {
      this._createConfettiBurst(element, particleCount * 2);
    }

    await new Promise((r) => setTimeout(r, duration * 0.3));

    // Phase 3: Trophy spin
    element.style.transition = `all ${duration * 0.3}ms ease-in-out`;
    element.style.transform = 'scale(1.15) rotate(-2deg)';

    await new Promise((r) => setTimeout(r, duration * 0.15));

    element.style.transform = 'scale(1.2) rotate(0deg)';

    await new Promise((r) => setTimeout(r, duration * 0.15));

    // Phase 4: Settle with lingering glow
    element.style.transition = `all ${duration * 0.2}ms ease-out`;
    element.style.transform = originalTransform || 'scale(1)';
    element.style.boxShadow = `0 0 20px ${completionColor}50`;

    await new Promise((r) => setTimeout(r, duration * 0.2));

    // Final cleanup
    element.style.boxShadow = originalBoxShadow || '';
    element.style.transition = originalTransition || '';
  }

  /**
   * Create rising particles for promotion
   * @private
   */
  _createRisingParticles(element, color) {
    const rect = element.getBoundingClientRect();
    const { particleCount } = this.options;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'leitner-particle leitner-particle-rise';

      const x = rect.left + Math.random() * rect.width;
      const y = rect.bottom;
      const size = 4 + Math.random() * 6;
      const delay = Math.random() * 200;
      const duration = 600 + Math.random() * 400;

      particle.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        animation: leitner-rise ${duration}ms ease-out ${delay}ms forwards;
      `;

      document.body.appendChild(particle);
      this.particles.push(particle);

      // Remove after animation
      setTimeout(() => {
        particle.remove();
        const idx = this.particles.indexOf(particle);
        if (idx > -1) this.particles.splice(idx, 1);
      }, duration + delay);
    }
  }

  /**
   * Create confetti burst for completion
   * @private
   */
  _createConfettiBurst(element, count) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ff9500', '#9b59b6'];

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'leitner-particle leitner-particle-confetti';

      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const velocity = 100 + Math.random() * 150;
      const size = 6 + Math.random() * 8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const rotation = Math.random() * 720;
      const duration = 800 + Math.random() * 400;

      const endX = Math.cos(angle) * velocity;
      const endY = Math.sin(angle) * velocity - 50; // Bias upward

      particle.style.cssText = `
        position: fixed;
        left: ${centerX}px;
        top: ${centerY}px;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        pointer-events: none;
        z-index: 999999;
        --end-x: ${endX}px;
        --end-y: ${endY}px;
        --rotation: ${rotation}deg;
        animation: leitner-confetti ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      `;

      document.body.appendChild(particle);
      this.particles.push(particle);

      setTimeout(() => {
        particle.remove();
        const idx = this.particles.indexOf(particle);
        if (idx > -1) this.particles.splice(idx, 1);
      }, duration);
    }
  }

  /**
   * Inject required styles
   * @private
   */
  _ensureStyles() {
    if (document.getElementById('leitner-transition-styles')) return;

    const style = document.createElement('style');
    style.id = 'leitner-transition-styles';
    style.textContent = `
      @keyframes leitner-rise {
        0% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translateY(-80px) scale(0.5);
        }
      }

      @keyframes leitner-confetti {
        0% {
          opacity: 1;
          transform: translate(0, 0) rotate(0deg) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(var(--end-x), var(--end-y)) rotate(var(--rotation)) scale(0.5);
        }
      }
    `;

    document.head.appendChild(style);
    this.styleElement = style;
  }

  /**
   * Remove effect
   */
  async remove() {
    // Remove all particles
    this.particles.forEach((p) => p.remove());
    this.particles = [];
    this.isActive = false;
  }

  /**
   * Destroy effect
   */
  destroy() {
    this.remove();
    // Note: We don't remove the style element as other instances might use it
  }
}

export default LeitnerTransitionEffect;
