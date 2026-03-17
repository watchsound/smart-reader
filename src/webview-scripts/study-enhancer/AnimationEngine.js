/**
 * AnimationEngine - Choreographs complex animations
 *
 * Handles:
 * - Position-to-position flights
 * - Staggered timing
 * - Easing functions
 * - Animation sequences
 */

class AnimationEngine {
  constructor() {
    this.activeAnimations = new Map(); // animationId -> animation data
    this.animationCounter = 0;

    // Built-in easing functions
    this.easings = {
      linear: t => t,
      easeIn: t => t * t,
      easeOut: t => t * (2 - t),
      easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      easeInCubic: t => t * t * t,
      easeOutCubic: t => (--t) * t * t + 1,
      easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
      easeInQuart: t => t * t * t * t,
      easeOutQuart: t => 1 - (--t) * t * t * t,
      easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
      easeOutBack: t => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      },
      easeOutElastic: t => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 :
          Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      },
      easeOutBounce: t => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      }
    };
  }

  /**
   * Animate element from current position to target
   * @param {HTMLElement} element
   * @param {Object} to - Target { x, y } or { transform, opacity, ... }
   * @param {Object} options
   * @returns {Promise}
   */
  animateTo(element, to, options = {}) {
    const {
      duration = 500,
      easing = 'easeOutCubic',
      delay = 0
    } = options;

    return new Promise(resolve => {
      setTimeout(() => {
        // Use CSS transitions for smooth animation
        const easingFunc = typeof easing === 'function' ? 'ease-out' : this._getCSSEasing(easing);

        element.style.transition = `all ${duration}ms ${easingFunc}`;

        // Apply target properties
        Object.keys(to).forEach(prop => {
          element.style[prop] = to[prop];
        });

        // Resolve after animation completes
        setTimeout(resolve, duration);
      }, delay);
    });
  }

  /**
   * Fly element from source position to target position
   * @param {HTMLElement} element - Element to animate (should be position: fixed)
   * @param {Object} from - Source { x, y }
   * @param {Object} to - Target { x, y }
   * @param {Object} options
   * @returns {Promise}
   */
  fly(element, from, to, options = {}) {
    const {
      duration = 800,
      easing = 'easeOutCubic',
      delay = 0,
      fadeIn = false,
      fadeOut = false,
      scale = null, // { from: 1, to: 1 }
      rotate = null, // { from: 0, to: 0 } in degrees
      onProgress = null
    } = options;

    const animationId = 'anim-' + this.animationCounter++;

    return new Promise(resolve => {
      // Initial position
      element.style.left = `${from.x}px`;
      element.style.top = `${from.y}px`;

      if (fadeIn) {
        element.style.opacity = '0';
      }

      const startTime = performance.now() + delay;
      const easingFunc = this.easings[easing] || this.easings.easeOutCubic;

      const animate = (currentTime) => {
        if (currentTime < startTime) {
          requestAnimationFrame(animate);
          return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easingFunc(progress);

        // Calculate current position
        const currentX = from.x + (to.x - from.x) * easedProgress;
        const currentY = from.y + (to.y - from.y) * easedProgress;

        // Apply position
        element.style.left = `${currentX}px`;
        element.style.top = `${currentY}px`;

        // Apply opacity
        if (fadeIn && progress < 0.3) {
          element.style.opacity = (progress / 0.3).toString();
        } else if (fadeOut && progress > 0.7) {
          element.style.opacity = (1 - (progress - 0.7) / 0.3).toString();
        } else if (fadeIn || fadeOut) {
          element.style.opacity = '1';
        }

        // Apply scale
        if (scale) {
          const currentScale = scale.from + (scale.to - scale.from) * easedProgress;
          element.style.transform = `scale(${currentScale})`;
        }

        // Apply rotation
        if (rotate) {
          const currentRotate = rotate.from + (rotate.to - rotate.from) * easedProgress;
          const existingTransform = element.style.transform || '';
          element.style.transform = existingTransform + ` rotate(${currentRotate}deg)`;
        }

        // Callback
        if (onProgress) {
          onProgress(progress, { x: currentX, y: currentY });
        }

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
   * Fly multiple elements with staggered timing
   * @param {Array} flights - Array of { element, from, to, options }
   * @param {Object} staggerOptions
   * @returns {Promise}
   */
  flyMultiple(flights, staggerOptions = {}) {
    const {
      staggerDelay = 50,
      staggerPattern = 'linear' // 'linear', 'random', 'reverse'
    } = staggerOptions;

    let delays;
    switch (staggerPattern) {
      case 'random':
        delays = flights.map(() => Math.random() * staggerDelay * flights.length);
        break;
      case 'reverse':
        delays = flights.map((_, i) => (flights.length - 1 - i) * staggerDelay);
        break;
      case 'linear':
      default:
        delays = flights.map((_, i) => i * staggerDelay);
    }

    const promises = flights.map((flight, index) => {
      const options = { ...flight.options, delay: (flight.options?.delay || 0) + delays[index] };
      return this.fly(flight.element, flight.from, flight.to, options);
    });

    return Promise.all(promises);
  }

  /**
   * Pulse animation (scale up and down)
   * @param {HTMLElement} element
   * @param {Object} options
   * @returns {Promise}
   */
  pulse(element, options = {}) {
    const {
      scale = 1.2,
      duration = 300,
      count = 1
    } = options;

    return new Promise(resolve => {
      let completed = 0;

      const doPulse = () => {
        element.style.transition = `transform ${duration / 2}ms ease-out`;
        element.style.transform = `scale(${scale})`;

        setTimeout(() => {
          element.style.transform = 'scale(1)';

          setTimeout(() => {
            completed++;
            if (completed < count) {
              doPulse();
            } else {
              resolve();
            }
          }, duration / 2);
        }, duration / 2);
      };

      doPulse();
    });
  }

  /**
   * Shake animation
   * @param {HTMLElement} element
   * @param {Object} options
   * @returns {Promise}
   */
  shake(element, options = {}) {
    const {
      intensity = 5,
      duration = 500
    } = options;

    return new Promise(resolve => {
      const startTime = performance.now();
      const originalTransform = element.style.transform || '';

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = elapsed / duration;

        if (progress >= 1) {
          element.style.transform = originalTransform;
          resolve();
          return;
        }

        const decay = 1 - progress;
        const offsetX = (Math.random() - 0.5) * 2 * intensity * decay;
        const offsetY = (Math.random() - 0.5) * 2 * intensity * decay;

        element.style.transform = `${originalTransform} translate(${offsetX}px, ${offsetY}px)`;
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Typewriter effect - reveal text character by character
   * @param {HTMLElement} element
   * @param {Object} options
   * @returns {Promise}
   */
  typewriter(element, options = {}) {
    const {
      speed = 50, // ms per character
      cursor = true
    } = options;

    return new Promise(resolve => {
      const text = element.textContent;
      element.textContent = '';
      element.style.visibility = 'visible';

      let cursorSpan = null;
      if (cursor) {
        cursorSpan = document.createElement('span');
        cursorSpan.textContent = '|';
        cursorSpan.style.animation = 'se-blink 0.7s infinite';
        element.appendChild(cursorSpan);
      }

      let index = 0;
      const type = () => {
        if (index < text.length) {
          const char = document.createTextNode(text[index]);
          if (cursorSpan) {
            element.insertBefore(char, cursorSpan);
          } else {
            element.appendChild(char);
          }
          index++;
          setTimeout(type, speed);
        } else {
          if (cursorSpan) {
            setTimeout(() => {
              cursorSpan.remove();
              resolve();
            }, 500);
          } else {
            resolve();
          }
        }
      };

      type();
    });
  }

  /**
   * Create animation sequence
   * @param {Array} steps - Array of { action: Function, delay?: number }
   * @returns {Promise}
   */
  sequence(steps) {
    return steps.reduce((promise, step) => {
      return promise.then(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            const result = step.action();
            if (result && result.then) {
              result.then(resolve);
            } else {
              resolve();
            }
          }, step.delay || 0);
        });
      });
    }, Promise.resolve());
  }

  /**
   * Run animations in parallel
   * @param {Array} animations - Array of Promises or functions returning Promises
   * @returns {Promise}
   */
  parallel(animations) {
    const promises = animations.map(anim => {
      return typeof anim === 'function' ? anim() : anim;
    });
    return Promise.all(promises);
  }

  /**
   * Cancel all active animations
   */
  cancelAll() {
    this.activeAnimations.forEach(animId => {
      cancelAnimationFrame(animId);
    });
    this.activeAnimations.clear();
  }

  /**
   * Get CSS easing equivalent
   * @private
   */
  _getCSSEasing(name) {
    const cssEasings = {
      linear: 'linear',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
      easeInCubic: 'cubic-bezier(0.32, 0, 0.67, 0)',
      easeOutCubic: 'cubic-bezier(0.33, 1, 0.68, 1)',
      easeInOutCubic: 'cubic-bezier(0.65, 0, 0.35, 1)',
      easeOutBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      easeOutElastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    };
    return cssEasings[name] || 'ease-out';
  }

  /**
   * Add custom easing function
   * @param {string} name
   * @param {Function} func
   */
  addEasing(name, func) {
    this.easings[name] = func;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnimationEngine;
} else {
  window.AnimationEngine = AnimationEngine;
}
