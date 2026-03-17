/**
 * EffectRegistry - Plugin system for registering and managing effects
 *
 * Provides a centralized way to:
 * - Register new effects
 * - Retrieve effects by name
 * - Manage effect lifecycle
 */

class EffectRegistry {
  constructor() {
    this.effects = new Map();
    this.activeEffects = new Map(); // effectInstanceId -> effect instance
    this.instanceCounter = 0;
  }

  /**
   * Register a new effect class
   * @param {string} name - Effect name (e.g., 'highlight', 'flyingAbstract')
   * @param {Class} EffectClass - Effect class extending BaseEffect
   * @param {Object} metadata - Optional metadata about the effect
   */
  register(name, EffectClass, metadata = {}) {
    if (this.effects.has(name)) {
      console.warn(`Effect "${name}" is already registered. Overwriting.`);
    }

    this.effects.set(name, {
      EffectClass,
      metadata: {
        name,
        description: metadata.description || '',
        category: metadata.category || 'general', // 'in-place', 'spatial', 'clone-based'
        requiredManagers: metadata.requiredManagers || [],
        ...metadata
      }
    });
  }

  /**
   * Unregister an effect
   * @param {string} name
   */
  unregister(name) {
    this.effects.delete(name);
  }

  /**
   * Get effect class by name
   * @param {string} name
   * @returns {Class|null}
   */
  getEffectClass(name) {
    const entry = this.effects.get(name);
    return entry ? entry.EffectClass : null;
  }

  /**
   * Get effect metadata
   * @param {string} name
   * @returns {Object|null}
   */
  getMetadata(name) {
    const entry = this.effects.get(name);
    return entry ? entry.metadata : null;
  }

  /**
   * Create an effect instance
   * @param {string} name - Effect name
   * @param {Object} managers - { wordWrapper, positionManager, cloneManager, animationEngine }
   * @param {Object} options - Effect options
   * @returns {Object} - { instanceId, effect }
   */
  createInstance(name, managers, options = {}) {
    const EffectClass = this.getEffectClass(name);
    if (!EffectClass) {
      throw new Error(`Effect "${name}" is not registered`);
    }

    const instanceId = `${name}-${this.instanceCounter++}`;
    const effect = new EffectClass(managers, options);
    effect.instanceId = instanceId;

    this.activeEffects.set(instanceId, effect);

    return { instanceId, effect };
  }

  /**
   * Get active effect instance
   * @param {string} instanceId
   * @returns {Object|null}
   */
  getInstance(instanceId) {
    return this.activeEffects.get(instanceId) || null;
  }

  /**
   * Remove an effect instance
   * @param {string} instanceId
   */
  removeInstance(instanceId) {
    const effect = this.activeEffects.get(instanceId);
    if (effect && typeof effect.destroy === 'function') {
      effect.destroy();
    }
    this.activeEffects.delete(instanceId);
  }

  /**
   * Remove all active effect instances
   */
  removeAllInstances() {
    this.activeEffects.forEach((effect, instanceId) => {
      if (typeof effect.destroy === 'function') {
        effect.destroy();
      }
    });
    this.activeEffects.clear();
  }

  /**
   * List all registered effects
   * @returns {Array} - Array of { name, metadata }
   */
  listEffects() {
    const list = [];
    this.effects.forEach((entry, name) => {
      list.push({ name, metadata: entry.metadata });
    });
    return list;
  }

  /**
   * List effects by category
   * @param {string} category
   * @returns {Array}
   */
  listByCategory(category) {
    return this.listEffects().filter(e => e.metadata.category === category);
  }

  /**
   * Check if effect exists
   * @param {string} name
   * @returns {boolean}
   */
  hasEffect(name) {
    return this.effects.has(name);
  }

  /**
   * Get all active effect instances
   * @returns {Map}
   */
  getActiveEffects() {
    return this.activeEffects;
  }

  /**
   * Get count of active effects
   * @returns {number}
   */
  getActiveCount() {
    return this.activeEffects.size;
  }
}

// Singleton instance
const effectRegistry = new EffectRegistry();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EffectRegistry, effectRegistry };
} else {
  window.EffectRegistry = EffectRegistry;
  window.effectRegistry = effectRegistry;
}
