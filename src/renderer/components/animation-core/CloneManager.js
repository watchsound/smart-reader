/**
 * CloneManager - Creates and manages cloned word elements for flying animations
 *
 * Clones are positioned absolutely and can fly across the screen without
 * affecting the original document layout.
 *
 * Usage:
 *   const cloneManager = new CloneManager();
 *   const clone = cloneManager.cloneWord(spanElement);
 *   // Animate clone.element
 *   await cloneManager.fadeOutAndRemove(clone.cloneId);
 */

class CloneManager {
  constructor(options = {}) {
    this.overlayId = options.overlayId || 'ac-clone-overlay';
    this.cloneClass = options.cloneClass || 'ac-clone';
    this.cloneIdPrefix = options.cloneIdPrefix || 'ac-clone-';
    this.cloneCounter = 0;
    this.clones = new Map();
    this.sourceToClones = new Map();
    this.overlay = null;
    this.container = options.container || document.body;

    this._ensureOverlay();
  }

  /**
   * Ensure the overlay container exists
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
      `;
      this.container.appendChild(this.overlay);
    }
  }

  /**
   * Clone a word span element
   * @param {HTMLElement} sourceSpan - The source word span
   * @param {Object} options - Clone options
   * @returns {Object} { cloneId, element, position }
   */
  cloneWord(sourceSpan, options = {}) {
    this._ensureOverlay();

    const rect = sourceSpan.getBoundingClientRect();
    const cloneId = this.cloneIdPrefix + this.cloneCounter++;

    // Create clone element
    const clone = document.createElement('span');
    clone.id = cloneId;
    clone.className = `${this.cloneClass} ${options.additionalClass || ''}`;
    clone.textContent = sourceSpan.textContent;
    clone.dataset.sourceId = sourceSpan.id;

    // Copy computed styles from source
    const cs = window.getComputedStyle(sourceSpan);

    clone.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      margin: 0;
      padding: 0;
      pointer-events: none;
      will-change: transform, opacity;
      font-size: ${cs.fontSize};
      font-family: ${cs.fontFamily};
      font-weight: ${cs.fontWeight};
      color: ${cs.color};
      line-height: ${cs.lineHeight};
      z-index: 999999;
    `;

    // Apply custom styles
    if (options.styles) {
      Object.assign(clone.style, options.styles);
    }

    this.overlay.appendChild(clone);

    // Store clone data
    const cloneData = {
      element: clone,
      sourceId: sourceSpan.id,
      sourceSpan,
      initialPosition: { x: rect.left, y: rect.top },
    };

    this.clones.set(cloneId, cloneData);

    // Track source to clones mapping
    if (!this.sourceToClones.has(sourceSpan.id)) {
      this.sourceToClones.set(sourceSpan.id, []);
    }
    this.sourceToClones.get(sourceSpan.id).push(cloneId);

    return {
      cloneId,
      element: clone,
      position: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  /**
   * Clone multiple word spans
   * @param {HTMLElement[]|NodeList} sourceSpans
   * @param {Object} options
   * @returns {Array}
   */
  cloneWords(sourceSpans, options = {}) {
    return Array.from(sourceSpans).map((span) => this.cloneWord(span, options));
  }

  /**
   * Get a clone by ID
   * @param {string} cloneId
   * @returns {Object|null}
   */
  getClone(cloneId) {
    return this.clones.get(cloneId) || null;
  }

  /**
   * Get all clones for a source span
   * @param {string} sourceId
   * @returns {Array}
   */
  getClonesForSource(sourceId) {
    const cloneIds = this.sourceToClones.get(sourceId) || [];
    return cloneIds.map((id) => this.clones.get(id)).filter(Boolean);
  }

  /**
   * Remove a clone immediately
   * @param {string} cloneId
   */
  removeClone(cloneId) {
    const data = this.clones.get(cloneId);
    if (data) {
      if (data.element.parentNode) {
        data.element.parentNode.removeChild(data.element);
      }
      this.clones.delete(cloneId);

      // Clean up source mapping
      if (data.sourceId) {
        const sourceClones = this.sourceToClones.get(data.sourceId);
        if (sourceClones) {
          const idx = sourceClones.indexOf(cloneId);
          if (idx > -1) sourceClones.splice(idx, 1);
        }
      }
    }
  }

  /**
   * Remove all clones
   */
  removeAllClones() {
    this.clones.forEach((data) => {
      if (data.element.parentNode) {
        data.element.parentNode.removeChild(data.element);
      }
    });
    this.clones.clear();
    this.sourceToClones.clear();
  }

  /**
   * Fade out and remove a clone
   * @param {string} cloneId
   * @param {number} duration
   * @returns {Promise}
   */
  fadeOutAndRemove(cloneId, duration = 300) {
    return new Promise((resolve) => {
      const data = this.clones.get(cloneId);
      if (!data) {
        resolve();
        return;
      }

      data.element.style.transition = `opacity ${duration}ms ease-out`;
      data.element.style.opacity = '0';

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
    const promises = Array.from(this.clones.keys()).map((cloneId) =>
      this.fadeOutAndRemove(cloneId, duration)
    );
    return Promise.all(promises);
  }

  /**
   * Dim a source element (while its clone is flying)
   * @param {string} sourceId
   * @param {number} opacity
   */
  dimSource(sourceId, opacity = 0.3) {
    const span = document.getElementById(sourceId);
    if (span) {
      span.dataset.originalOpacity = span.style.opacity || '1';
      span.style.opacity = opacity;
    }
  }

  /**
   * Restore a source element's opacity
   * @param {string} sourceId
   */
  restoreSource(sourceId) {
    const span = document.getElementById(sourceId);
    if (span && span.dataset.originalOpacity) {
      span.style.opacity = span.dataset.originalOpacity;
      delete span.dataset.originalOpacity;
    }
  }

  /**
   * Restore all dimmed sources
   */
  restoreAllSources() {
    this.sourceToClones.forEach((_, sourceId) => {
      this.restoreSource(sourceId);
    });
  }

  /**
   * Update a clone's position
   * @param {string} cloneId
   * @param {Object} position { x, y }
   */
  updateClonePosition(cloneId, position) {
    const data = this.clones.get(cloneId);
    if (data && data.element) {
      data.element.style.left = `${position.x}px`;
      data.element.style.top = `${position.y}px`;
    }
  }

  /**
   * Apply styles to a clone
   * @param {string} cloneId
   * @param {Object} styles
   */
  styleClone(cloneId, styles) {
    const data = this.clones.get(cloneId);
    if (data && data.element) {
      Object.assign(data.element.style, styles);
    }
  }

  /**
   * Clean up and destroy the manager
   */
  destroy() {
    this.restoreAllSources();
    this.removeAllClones();
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }

  /**
   * Get number of active clones
   * @returns {number}
   */
  get cloneCount() {
    return this.clones.size;
  }
}

export default CloneManager;
