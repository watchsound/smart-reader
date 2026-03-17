/**
 * CloneManager - Creates and manages positioned word clones
 *
 * Clones are created in an overlay layer and can be animated
 * without affecting the original page layout.
 */

class CloneManager {
  constructor(options = {}) {
    this.overlayId = options.overlayId || 'se-clone-overlay';
    this.cloneClass = options.cloneClass || 'se-clone';
    this.cloneIdPrefix = options.cloneIdPrefix || 'se-clone-';
    this.cloneCounter = 0;

    this.overlay = null;
    this.clones = new Map(); // cloneId -> { element, sourceId, sourceSpan }
    this.sourceToClones = new Map(); // sourceId -> [cloneIds]

    this._ensureOverlay();
  }

  /**
   * Ensure overlay container exists
   * @private
   */
  _ensureOverlay() {
    this.overlay = document.getElementById(this.overlayId);

    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.id = this.overlayId;
      this.overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
        overflow: visible;
      `;
      document.body.appendChild(this.overlay);
    }
  }

  /**
   * Clone a word at its exact position
   * @param {HTMLElement} sourceSpan - Original word span
   * @param {Object} options - Clone options
   * @returns {Object} - { cloneId, element, position }
   */
  cloneWord(sourceSpan, options = {}) {
    const {
      inheritStyles = true,
      additionalClass = '',
      initialOpacity = 1,
      copyDataAttributes = true
    } = options;

    this._ensureOverlay();

    // Get source position
    const rect = sourceSpan.getBoundingClientRect();

    // Create clone
    const cloneId = this.cloneIdPrefix + this.cloneCounter++;
    const clone = document.createElement('span');
    clone.id = cloneId;
    clone.className = `${this.cloneClass} ${additionalClass}`.trim();
    clone.textContent = sourceSpan.textContent;

    // Copy data attributes
    if (copyDataAttributes) {
      Object.keys(sourceSpan.dataset).forEach(key => {
        clone.dataset[key] = sourceSpan.dataset[key];
      });
    }
    clone.dataset.sourceId = sourceSpan.id;

    // Position exactly over source
    clone.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      margin: 0;
      padding: 0;
      opacity: ${initialOpacity};
      pointer-events: none;
      will-change: transform, opacity;
      transform-origin: center center;
    `;

    // Inherit computed styles from source
    if (inheritStyles) {
      const computedStyle = window.getComputedStyle(sourceSpan);
      clone.style.fontSize = computedStyle.fontSize;
      clone.style.fontFamily = computedStyle.fontFamily;
      clone.style.fontWeight = computedStyle.fontWeight;
      clone.style.color = computedStyle.color;
      clone.style.lineHeight = computedStyle.lineHeight;
      clone.style.letterSpacing = computedStyle.letterSpacing;
      clone.style.textTransform = computedStyle.textTransform;
    }

    // Add to overlay
    this.overlay.appendChild(clone);

    // Track clone
    const cloneData = {
      element: clone,
      sourceId: sourceSpan.id,
      sourceSpan,
      initialPosition: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      }
    };

    this.clones.set(cloneId, cloneData);

    // Track source -> clones mapping
    if (sourceSpan.id) {
      if (!this.sourceToClones.has(sourceSpan.id)) {
        this.sourceToClones.set(sourceSpan.id, []);
      }
      this.sourceToClones.get(sourceSpan.id).push(cloneId);
    }

    return {
      cloneId,
      element: clone,
      position: cloneData.initialPosition
    };
  }

  /**
   * Clone multiple words
   * @param {HTMLElement[]|NodeList} sourceSpans
   * @param {Object} options
   * @returns {Object[]}
   */
  cloneWords(sourceSpans, options = {}) {
    const clones = [];
    sourceSpans.forEach(span => {
      clones.push(this.cloneWord(span, options));
    });
    return clones;
  }

  /**
   * Create a clone at arbitrary position (not from existing word)
   * @param {string} text - Text content
   * @param {Object} position - { x, y }
   * @param {Object} styles - CSS styles
   * @returns {Object}
   */
  createCloneAt(text, position, styles = {}) {
    this._ensureOverlay();

    const cloneId = this.cloneIdPrefix + this.cloneCounter++;
    const clone = document.createElement('span');
    clone.id = cloneId;
    clone.className = this.cloneClass;
    clone.textContent = text;

    clone.style.cssText = `
      position: fixed;
      left: ${position.x}px;
      top: ${position.y}px;
      margin: 0;
      padding: 0;
      pointer-events: none;
      will-change: transform, opacity;
    `;

    // Apply custom styles
    Object.keys(styles).forEach(key => {
      clone.style[key] = styles[key];
    });

    this.overlay.appendChild(clone);

    const cloneData = {
      element: clone,
      sourceId: null,
      sourceSpan: null,
      initialPosition: { x: position.x, y: position.y }
    };

    this.clones.set(cloneId, cloneData);

    return { cloneId, element: clone, position };
  }

  /**
   * Get clone by ID
   * @param {string} cloneId
   * @returns {Object|null}
   */
  getClone(cloneId) {
    return this.clones.get(cloneId) || null;
  }

  /**
   * Get all clones from a source word
   * @param {string} sourceId
   * @returns {Object[]}
   */
  getClonesFromSource(sourceId) {
    const cloneIds = this.sourceToClones.get(sourceId) || [];
    return cloneIds.map(id => this.clones.get(id)).filter(Boolean);
  }

  /**
   * Remove a specific clone
   * @param {string} cloneId
   */
  removeClone(cloneId) {
    const cloneData = this.clones.get(cloneId);
    if (cloneData) {
      if (cloneData.element.parentNode) {
        cloneData.element.parentNode.removeChild(cloneData.element);
      }

      // Clean up source mapping
      if (cloneData.sourceId) {
        const cloneIds = this.sourceToClones.get(cloneData.sourceId);
        if (cloneIds) {
          const index = cloneIds.indexOf(cloneId);
          if (index > -1) {
            cloneIds.splice(index, 1);
          }
        }
      }

      this.clones.delete(cloneId);
    }
  }

  /**
   * Remove all clones
   */
  removeAllClones() {
    this.clones.forEach((cloneData, cloneId) => {
      if (cloneData.element.parentNode) {
        cloneData.element.parentNode.removeChild(cloneData.element);
      }
    });
    this.clones.clear();
    this.sourceToClones.clear();
  }

  /**
   * Fade out and remove clone
   * @param {string} cloneId
   * @param {number} duration - Fade duration in ms
   * @returns {Promise}
   */
  fadeOutAndRemove(cloneId, duration = 300) {
    return new Promise(resolve => {
      const cloneData = this.clones.get(cloneId);
      if (!cloneData) {
        resolve();
        return;
      }

      const clone = cloneData.element;
      clone.style.transition = `opacity ${duration}ms ease-out`;
      clone.style.opacity = '0';

      setTimeout(() => {
        this.removeClone(cloneId);
        resolve();
      }, duration);
    });
  }

  /**
   * Fade out and remove all clones
   * @param {number} duration
   * @returns {Promise}
   */
  fadeOutAndRemoveAll(duration = 300) {
    const promises = [];
    this.clones.forEach((_, cloneId) => {
      promises.push(this.fadeOutAndRemove(cloneId, duration));
    });
    return Promise.all(promises);
  }

  /**
   * Dim/highlight source word when cloned
   * @param {string} sourceId
   * @param {number} opacity - Dim level (0-1)
   */
  dimSource(sourceId, opacity = 0.3) {
    const sourceSpan = document.getElementById(sourceId);
    if (sourceSpan) {
      sourceSpan.dataset.originalOpacity = sourceSpan.style.opacity || '1';
      sourceSpan.style.opacity = opacity;
    }
  }

  /**
   * Restore source word opacity
   * @param {string} sourceId
   */
  restoreSource(sourceId) {
    const sourceSpan = document.getElementById(sourceId);
    if (sourceSpan && sourceSpan.dataset.originalOpacity) {
      sourceSpan.style.opacity = sourceSpan.dataset.originalOpacity;
      delete sourceSpan.dataset.originalOpacity;
    }
  }

  /**
   * Restore all source opacities
   */
  restoreAllSources() {
    this.sourceToClones.forEach((_, sourceId) => {
      this.restoreSource(sourceId);
    });
  }

  /**
   * Get overlay element
   * @returns {HTMLElement}
   */
  getOverlay() {
    this._ensureOverlay();
    return this.overlay;
  }

  /**
   * Destroy manager and clean up
   */
  destroy() {
    this.restoreAllSources();
    this.removeAllClones();
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloneManager;
} else {
  window.CloneManager = CloneManager;
}
