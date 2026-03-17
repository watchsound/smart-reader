/**
 * EffectRegistry - Manages registration and creation of animation effects
 *
 * Effects are reusable animation patterns that can be applied to word-wrapped content.
 * The registry provides a plugin-like system for adding new effects.
 *
 * Usage:
 *   const registry = new EffectRegistry();
 *   registry.register('highlight', HighlightEffect, { category: 'in-place' });
 *   const { instanceId, effect } = registry.createInstance('highlight', managers, options);
 *   await effect.apply(target);
 *   await effect.remove();
 */

class EffectRegistry {
  constructor() {
    this.effects = new Map();
    this.activeEffects = new Map();
    this.instanceCounter = 0;
  }

  /**
   * Register an effect class
   * @param {string} name - Effect name
   * @param {class} EffectClass - The effect class constructor
   * @param {Object} metadata - Additional metadata
   */
  register(name, EffectClass, metadata = {}) {
    this.effects.set(name, {
      EffectClass,
      metadata: {
        name,
        category: metadata.category || 'general',
        description: metadata.description || '',
        ...metadata,
      },
    });
  }

  /**
   * Check if an effect is registered
   * @param {string} name
   * @returns {boolean}
   */
  hasEffect(name) {
    return this.effects.has(name);
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
   * Create an instance of an effect
   * @param {string} name - Effect name
   * @param {Object} managers - The animation managers (wordWrapper, cloneManager, etc.)
   * @param {Object} options - Effect options
   * @returns {Object} { instanceId, effect }
   */
  createInstance(name, managers, options = {}) {
    const entry = this.effects.get(name);
    if (!entry) {
      throw new Error(`Effect "${name}" not registered`);
    }

    const instanceId = `${name}-${++this.instanceCounter}`;
    const effect = new entry.EffectClass(managers, options);
    effect.instanceId = instanceId;
    effect.effectName = name;

    this.activeEffects.set(instanceId, effect);

    return { instanceId, effect };
  }

  /**
   * Get an active effect instance
   * @param {string} instanceId
   * @returns {Object|null}
   */
  getInstance(instanceId) {
    return this.activeEffects.get(instanceId) || null;
  }

  /**
   * Get all instances of a specific effect type
   * @param {string} name
   * @returns {Array}
   */
  getInstancesByType(name) {
    const instances = [];
    this.activeEffects.forEach((effect, id) => {
      if (effect.effectName === name) {
        instances.push({ id, effect });
      }
    });
    return instances;
  }

  /**
   * Remove an effect instance
   * @param {string} instanceId
   * @returns {Promise}
   */
  async removeInstance(instanceId) {
    const effect = this.activeEffects.get(instanceId);
    if (effect) {
      if (effect.remove) {
        await effect.remove();
      }
      if (effect.destroy) {
        effect.destroy();
      }
      this.activeEffects.delete(instanceId);
    }
  }

  /**
   * Remove all active effect instances
   * @returns {Promise}
   */
  async removeAllInstances() {
    const promises = [];
    this.activeEffects.forEach((effect, id) => {
      if (effect.remove) {
        promises.push(effect.remove());
      }
      if (effect.destroy) {
        effect.destroy();
      }
    });
    await Promise.all(promises);
    this.activeEffects.clear();
  }

  /**
   * Remove all instances of a specific effect type
   * @param {string} name
   * @returns {Promise}
   */
  async removeInstancesByType(name) {
    const instances = this.getInstancesByType(name);
    for (const { id, effect } of instances) {
      if (effect.remove) {
        await effect.remove();
      }
      if (effect.destroy) {
        effect.destroy();
      }
      this.activeEffects.delete(id);
    }
  }

  /**
   * Get all active effects
   * @returns {Map}
   */
  getActiveEffects() {
    return this.activeEffects;
  }

  /**
   * Get number of active effects
   * @returns {number}
   */
  get activeCount() {
    return this.activeEffects.size;
  }

  /**
   * List all registered effects
   * @returns {Array}
   */
  listEffects() {
    return Array.from(this.effects.entries()).map(([name, entry]) => ({
      name,
      metadata: entry.metadata,
    }));
  }

  /**
   * List effects by category
   * @param {string} category
   * @returns {Array}
   */
  listByCategory(category) {
    return this.listEffects().filter((e) => e.metadata.category === category);
  }

  /**
   * Unregister an effect
   * @param {string} name
   */
  unregister(name) {
    this.effects.delete(name);
  }

  /**
   * Clear all registrations
   */
  clearRegistry() {
    this.effects.clear();
  }

  /**
   * Destroy the registry and all active effects
   */
  async destroy() {
    await this.removeAllInstances();
    this.clearRegistry();
  }
}

export default EffectRegistry;
