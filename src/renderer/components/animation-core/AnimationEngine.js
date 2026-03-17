/**
 * AnimationEngine - Core animation utilities for word movements
 *
 * Provides various animation primitives:
 * - fly: Move element from point A to point B
 * - flyBezier: Curved flight path using quadratic Bezier
 * - pulse: Scale up and down
 * - fadeIn/fadeOut: Opacity transitions
 * - glow: Text shadow glow effect
 *
 * Usage:
 *   const engine = new AnimationEngine();
 *   await engine.fly(element, { x: 0, y: 0 }, { x: 100, y: 100 }, { duration: 800 });
 */

class AnimationEngine {
  constructor() {
    this.activeAnimations = new Map();
    this.animationCounter = 0;

    // Easing functions
    this.easings = {
      linear: (t) => t,
      easeOut: (t) => t * (2 - t),
      easeIn: (t) => t * t,
      easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
      easeOutCubic: (t) => --t * t * t + 1,
      easeInCubic: (t) => t * t * t,
      easeOutBack: (t) => {
        const c = 1.70158;
        return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
      },
      easeOutElastic: (t) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0
          ? 0
          : t === 1
            ? 1
            : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      },
    };
  }

  /**
   * Linear flight animation from one point to another
   * @param {HTMLElement} element - Element to animate
   * @param {Object} from - Start position { x, y }
   * @param {Object} to - End position { x, y }
   * @param {Object} options - Animation options
   * @returns {Promise}
   */
  fly(element, from, to, options = {}) {
    const {
      duration = 800,
      easing = 'easeOutCubic',
      delay = 0,
      onUpdate = null,
    } = options;

    return new Promise((resolve) => {
      const startTime = performance.now() + delay;
      const easingFunc = this.easings[easing] || this.easings.easeOutCubic;
      const animationId = ++this.animationCounter;

      const animate = (currentTime) => {
        if (currentTime < startTime) {
          requestAnimationFrame(animate);
          return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easingFunc(progress);

        const x = from.x + (to.x - from.x) * eased;
        const y = from.y + (to.y - from.y) * eased;

        element.style.left = `${x}px`;
        element.style.top = `${y}px`;

        if (onUpdate) onUpdate({ x, y, progress, eased });

        if (progress < 1) {
          this.activeAnimations.set(animationId, requestAnimationFrame(animate));
        } else {
          this.activeAnimations.delete(animationId);
          resolve();
        }
      };

      this.activeAnimations.set(animationId, requestAnimationFrame(animate));
    });
  }

  /**
   * Curved flight using quadratic Bezier curve
   * @param {HTMLElement} element - Element to animate
   * @param {Object} from - Start position { x, y }
   * @param {Object} to - End position { x, y }
   * @param {Object} options - Animation options including control point
   * @returns {Promise}
   */
  flyBezier(element, from, to, options = {}) {
    const {
      duration = 1200,
      easing = 'easeOutCubic',
      delay = 0,
      controlPoint = null,
      arcHeight = 80,
      onUpdate = null,
    } = options;

    // Calculate control point if not provided
    const ctrl = controlPoint || {
      x: (from.x + to.x) / 2,
      y: Math.min(from.y, to.y) - arcHeight - Math.random() * 40,
    };

    return new Promise((resolve) => {
      const startTime = performance.now() + delay;
      const easingFunc = this.easings[easing] || this.easings.easeOutCubic;
      const animationId = ++this.animationCounter;

      const animate = (currentTime) => {
        if (currentTime < startTime) {
          requestAnimationFrame(animate);
          return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const t = easingFunc(progress);

        // Quadratic Bezier curve
        const x =
          (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * ctrl.x + t * t * to.x;
        const y =
          (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * ctrl.y + t * t * to.y;

        element.style.left = `${x}px`;
        element.style.top = `${y}px`;

        if (onUpdate) onUpdate({ x, y, progress, t });

        if (progress < 1) {
          this.activeAnimations.set(animationId, requestAnimationFrame(animate));
        } else {
          this.activeAnimations.delete(animationId);
          resolve();
        }
      };

      this.activeAnimations.set(animationId, requestAnimationFrame(animate));
    });
  }

  /**
   * Animate multiple flights with staggered timing
   * @param {Array} flights - Array of { element, from, to, options }
   * @param {Object} staggerOptions - Stagger configuration
   * @returns {Promise}
   */
  flyMultiple(flights, staggerOptions = {}) {
    const { staggerDelay = 50, useBezier = false } = staggerOptions;

    return Promise.all(
      flights.map((f, i) => {
        const opts = {
          ...f.options,
          delay: (f.options?.delay || 0) + i * staggerDelay,
        };
        return useBezier
          ? this.flyBezier(f.element, f.from, f.to, opts)
          : this.fly(f.element, f.from, f.to, opts);
      })
    );
  }

  /**
   * Pulse animation (scale up then down)
   * @param {HTMLElement} element
   * @param {Object} options
   * @returns {Promise}
   */
  pulse(element, options = {}) {
    const { scale = 1.2, duration = 300 } = options;

    return new Promise((resolve) => {
      element.style.transition = `transform ${duration / 2}ms ease-out`;
      element.style.transform = `scale(${scale})`;

      setTimeout(() => {
        element.style.transform = 'scale(1)';
        setTimeout(resolve, duration / 2);
      }, duration / 2);
    });
  }

  /**
   * Fade in animation
   * @param {HTMLElement} element
   * @param {Object} options
   * @returns {Promise}
   */
  fadeIn(element, options = {}) {
    const { duration = 300, slideUp = false, slideDistance = 10 } = options;

    return new Promise((resolve) => {
      // Set initial state
      element.style.opacity = '0';
      if (slideUp) {
        element.style.transform = `translateY(${slideDistance}px)`;
      }

      // Force reflow
      element.offsetHeight;

      // Apply transition
      element.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`;
      element.style.opacity = '1';
      if (slideUp) {
        element.style.transform = 'translateY(0)';
      }

      setTimeout(resolve, duration);
    });
  }

  /**
   * Fade out animation
   * @param {HTMLElement} element
   * @param {Object} options
   * @returns {Promise}
   */
  fadeOut(element, options = {}) {
    const { duration = 300, slideDown = false, slideDistance = 10 } = options;

    return new Promise((resolve) => {
      element.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`;
      element.style.opacity = '0';

      if (slideDown) {
        element.style.transform = `translateY(${slideDistance}px)`;
      }

      setTimeout(resolve, duration);
    });
  }

  /**
   * Apply glow effect to element
   * @param {HTMLElement} element
   * @param {Object} options
   * @returns {Promise}
   */
  glow(element, options = {}) {
    const {
      color = '#00bfff',
      intensity = [8, 16, 24],
      duration = 400,
      pulse = true,
    } = options;

    return new Promise((resolve) => {
      const shadowStr = intensity
        .map((i) => `0 0 ${i}px ${color}`)
        .join(', ');

      element.style.transition = `text-shadow ${duration}ms ease-out, transform ${duration}ms ease-out`;
      element.style.textShadow = shadowStr;
      element.style.color = '#fff';

      if (pulse) {
        element.style.transform = 'scale(1.15)';
        setTimeout(() => {
          element.style.transform = 'scale(1)';
        }, duration / 2);
      }

      setTimeout(resolve, duration);
    });
  }

  /**
   * Remove glow effect
   * @param {HTMLElement} element
   * @param {Object} options
   * @returns {Promise}
   */
  removeGlow(element, options = {}) {
    const { duration = 300 } = options;

    return new Promise((resolve) => {
      element.style.transition = `text-shadow ${duration}ms ease-out`;
      element.style.textShadow = 'none';
      setTimeout(resolve, duration);
    });
  }

  /**
   * Staggered animation for multiple elements
   * @param {HTMLElement[]} elements
   * @param {Function} animateFn - Animation function for each element
   * @param {Object} options
   * @returns {Promise}
   */
  stagger(elements, animateFn, options = {}) {
    const { staggerDelay = 50 } = options;

    return Promise.all(
      Array.from(elements).map(
        (el, i) =>
          new Promise((resolve) => {
            setTimeout(async () => {
              await animateFn(el, i);
              resolve();
            }, i * staggerDelay);
          })
      )
    );
  }

  /**
   * Cancel all active animations
   */
  cancelAll() {
    this.activeAnimations.forEach((frameId) => {
      cancelAnimationFrame(frameId);
    });
    this.activeAnimations.clear();
  }

  /**
   * Get number of active animations
   * @returns {number}
   */
  get activeCount() {
    return this.activeAnimations.size;
  }
}

export default AnimationEngine;
