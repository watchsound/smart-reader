/**
 * BaseEffect - Abstract base class for all animation effects
 *
 * All effects should extend this class and implement:
 * - apply(target, options): Apply the effect
 * - remove(options): Remove the effect
 * - destroy(): Clean up resources
 */

class BaseEffect {
  constructor(managers, options = {}) {
    this.managers = managers;
    this.options = options;
    this.instanceId = null;
    this.effectName = null;
    this.isActive = false;
  }

  /**
   * Apply the effect to a target
   * @param {HTMLElement|string} target - Target element or selector
   * @param {Object} options - Effect options
   * @returns {Promise}
   */
  async apply(target, options = {}) {
    throw new Error('apply() must be implemented by subclass');
  }

  /**
   * Remove the effect
   * @param {Object} options
   * @returns {Promise}
   */
  async remove(options = {}) {
    throw new Error('remove() must be implemented by subclass');
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.remove({ fadeOutDuration: 0 });
    this.isActive = false;
  }

  /**
   * Resolve target to element(s)
   * @protected
   * @param {HTMLElement|string|Array} target
   * @returns {Array}
   */
  _resolveTarget(target) {
    if (typeof target === 'string') {
      const el = document.getElementById(target);
      if (el) return [el];
      return Array.from(document.querySelectorAll(target));
    }
    if (Array.isArray(target)) {
      return target
        .map((t) => (typeof t === 'string' ? document.getElementById(t) : t))
        .filter(Boolean);
    }
    if (target instanceof NodeList) {
      return Array.from(target);
    }
    if (target instanceof HTMLElement) {
      return [target];
    }
    return [];
  }

  /**
   * Merge options with defaults
   * @protected
   * @param {Object} options
   * @returns {Object}
   */
  _mergeOptions(options) {
    return { ...this.options, ...options };
  }
}

export default BaseEffect;
