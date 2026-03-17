/**
 * PositionManager - Manages word positions and layout calculations
 *
 * Handles:
 * - Capturing word positions from the DOM
 * - Calculating target layouts for summary panels
 * - Managing scroll-aware positioning
 *
 * Usage:
 *   const positionManager = new PositionManager();
 *   const position = positionManager.capturePosition(spanElement);
 *   const layout = positionManager.calculateTargetLayout(['word1', 'word2'], { maxWidth: 500 });
 */

class PositionManager {
  constructor() {
    this.positionCache = new Map();
  }

  /**
   * Capture the position and styles of a word span
   * @param {HTMLElement} wordSpan
   * @returns {Object} Position data
   */
  capturePosition(wordSpan) {
    const rect = wordSpan.getBoundingClientRect();
    const cs = window.getComputedStyle(wordSpan);

    const position = {
      viewport: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      },
      center: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      },
      styles: {
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        color: cs.color,
        lineHeight: cs.lineHeight,
      },
    };

    // Cache for later use
    if (wordSpan.id) {
      this.positionCache.set(wordSpan.id, position);
    }

    return position;
  }

  /**
   * Capture positions of multiple word spans
   * @param {HTMLElement[]|NodeList} wordSpans
   * @returns {Map}
   */
  captureMultiplePositions(wordSpans) {
    const positions = new Map();
    Array.from(wordSpans).forEach((span) => {
      if (span.id) {
        positions.set(span.id, this.capturePosition(span));
      }
    });
    return positions;
  }

  /**
   * Get cached position for a word ID
   * @param {string} wordId
   * @returns {Object|null}
   */
  getCachedPosition(wordId) {
    return this.positionCache.get(wordId) || null;
  }

  /**
   * Calculate a target layout for words (e.g., for a summary panel)
   * @param {string[]} words - Array of words to layout
   * @param {Object} options - Layout options
   * @returns {Object} Layout data
   */
  calculateTargetLayout(words, options = {}) {
    const {
      maxWidth = 400,
      position = 'center',
      fontSize = '16px',
      padding = 20,
      lineHeight = 1.6,
    } = options;

    // Create temporary container to measure layout
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      visibility: hidden;
      max-width: ${maxWidth}px;
      font-size: ${fontSize};
      line-height: ${lineHeight};
      padding: ${padding}px;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      word-wrap: break-word;
      white-space: pre-wrap;
    `;

    // Create word spans and add them to container
    const wordSpans = [];
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.textContent = word;
      span.style.display = 'inline';
      container.appendChild(span);

      // Add space after word (except last)
      if (i < words.length - 1) {
        container.appendChild(document.createTextNode(' '));
      }

      wordSpans.push(span);
    });

    // Append to body to measure
    document.body.appendChild(container);

    // Measure each word's position
    const layout = wordSpans.map((span, i) => {
      const rect = span.getBoundingClientRect();
      return {
        word: words[i],
        index: i,
        position: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
      };
    });

    // Get container bounds
    const bounds = container.getBoundingClientRect();

    // Clean up
    document.body.removeChild(container);

    return {
      words: layout,
      containerBounds: {
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
    };
  }

  /**
   * Calculate layout with slots for flying words vs static words
   * @param {string[]} words - All words
   * @param {Set} matchedIndices - Indices of words that will be flown in
   * @param {Object} options
   * @returns {Object}
   */
  calculateSlotLayout(words, matchedIndices, options = {}) {
    const layout = this.calculateTargetLayout(words, options);

    // Mark which slots are for flying words
    layout.words = layout.words.map((item) => ({
      ...item,
      isFlying: matchedIndices.has(item.index),
    }));

    return layout;
  }

  /**
   * Get viewport dimensions
   * @returns {Object}
   */
  getViewportDimensions() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
  }

  /**
   * Calculate center position for an overlay
   * @param {number} width
   * @param {number} height
   * @returns {Object}
   */
  calculateCenterPosition(width, height) {
    const viewport = this.getViewportDimensions();
    return {
      x: (viewport.width - width) / 2,
      y: (viewport.height - height) / 2,
    };
  }

  /**
   * Calculate position relative to an element
   * @param {HTMLElement} element
   * @param {string} position - 'top', 'bottom', 'left', 'right', 'center'
   * @param {Object} options
   * @returns {Object}
   */
  calculateRelativePosition(element, position = 'bottom', options = {}) {
    const { offset = 10, containerWidth = 400, containerHeight = 200 } = options;
    const rect = element.getBoundingClientRect();
    const viewport = this.getViewportDimensions();

    let x, y;

    switch (position) {
      case 'top':
        x = rect.left + rect.width / 2 - containerWidth / 2;
        y = rect.top - containerHeight - offset;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2 - containerWidth / 2;
        y = rect.bottom + offset;
        break;
      case 'left':
        x = rect.left - containerWidth - offset;
        y = rect.top + rect.height / 2 - containerHeight / 2;
        break;
      case 'right':
        x = rect.right + offset;
        y = rect.top + rect.height / 2 - containerHeight / 2;
        break;
      case 'center':
      default:
        x = rect.left + rect.width / 2 - containerWidth / 2;
        y = rect.top + rect.height / 2 - containerHeight / 2;
    }

    // Constrain to viewport
    x = Math.max(offset, Math.min(viewport.width - containerWidth - offset, x));
    y = Math.max(offset, Math.min(viewport.height - containerHeight - offset, y));

    return { x, y };
  }

  /**
   * Clear position cache
   */
  clearCache() {
    this.positionCache.clear();
  }

  /**
   * Refresh cached position for a word
   * @param {string} wordId
   * @returns {Object|null}
   */
  refreshPosition(wordId) {
    const span = document.getElementById(wordId);
    if (span) {
      return this.capturePosition(span);
    }
    return null;
  }

  /**
   * Calculate mindmap layout positions
   * @param {Object} data - Mindmap data with root and nodes
   * @param {Object} options
   * @returns {Object} Layout with node positions
   */
  calculateMindmapLayout(data, options = {}) {
    const {
      centerX = window.innerWidth / 2,
      centerY = window.innerHeight / 2,
      level1Radius = 140,
      level2Radius = 80,
    } = options;

    const positions = new Map();

    // Root position
    if (data.root) {
      positions.set(data.root.id, { x: centerX, y: centerY });
    }

    // Level 1 nodes
    const level1Nodes = data.nodes.filter((n) => n.level === 1);
    const angleStep = (2 * Math.PI) / Math.max(level1Nodes.length, 1);

    level1Nodes.forEach((node, i) => {
      const angle = angleStep * i - Math.PI / 2;
      positions.set(node.id, {
        x: centerX + level1Radius * Math.cos(angle),
        y: centerY + level1Radius * Math.sin(angle),
      });
    });

    // Level 2 nodes
    const level2Nodes = data.nodes.filter((n) => n.level === 2);
    level2Nodes.forEach((node, i) => {
      const parentPos = positions.get(node.parentId);
      if (parentPos) {
        const parentAngle = Math.atan2(
          parentPos.y - centerY,
          parentPos.x - centerX
        );
        const childAngle = parentAngle + (i % 2 === 0 ? 0.5 : -0.5);
        positions.set(node.id, {
          x: parentPos.x + level2Radius * Math.cos(childAngle),
          y: parentPos.y + level2Radius * Math.sin(childAngle),
        });
      }
    });

    return positions;
  }
}

export default PositionManager;
