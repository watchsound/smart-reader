/**
 * PositionManager - Captures and manages word positions
 *
 * Provides utilities for:
 * - Capturing word bounding rectangles
 * - Coordinate system conversions
 * - Calculating target positions for layouts
 */

class PositionManager {
  constructor() {
    this.positionCache = new Map(); // wordId -> position data
    this.viewportOffset = { x: 0, y: 0 };
  }

  /**
   * Capture position of a single word
   * @param {HTMLElement} wordSpan - The word span element
   * @returns {Object} - Position data
   */
  capturePosition(wordSpan) {
    const rect = wordSpan.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    const position = {
      // Viewport-relative (for fixed positioning)
      viewport: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      },
      // Document-relative (for absolute positioning)
      document: {
        x: rect.left + scrollX,
        y: rect.top + scrollY,
        width: rect.width,
        height: rect.height
      },
      // Center point
      center: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      },
      // Computed styles
      styles: {
        fontSize: window.getComputedStyle(wordSpan).fontSize,
        fontFamily: window.getComputedStyle(wordSpan).fontFamily,
        fontWeight: window.getComputedStyle(wordSpan).fontWeight,
        color: window.getComputedStyle(wordSpan).color,
        lineHeight: window.getComputedStyle(wordSpan).lineHeight
      }
    };

    // Cache position
    if (wordSpan.id) {
      this.positionCache.set(wordSpan.id, position);
    }

    return position;
  }

  /**
   * Capture positions of multiple words
   * @param {HTMLElement[]|NodeList} wordSpans
   * @returns {Map} - wordId -> position
   */
  capturePositions(wordSpans) {
    const positions = new Map();

    wordSpans.forEach(span => {
      const position = this.capturePosition(span);
      if (span.id) {
        positions.set(span.id, position);
      }
    });

    return positions;
  }

  /**
   * Capture all words with a specific class
   * @param {string} wordClass
   * @returns {Map}
   */
  captureAllWords(wordClass = 'se-word') {
    const spans = document.querySelectorAll(`.${wordClass}`);
    return this.capturePositions(spans);
  }

  /**
   * Get cached position
   * @param {string} wordId
   * @returns {Object|null}
   */
  getCachedPosition(wordId) {
    return this.positionCache.get(wordId) || null;
  }

  /**
   * Clear position cache
   */
  clearCache() {
    this.positionCache.clear();
  }

  /**
   * Calculate flight vector between two positions
   * @param {Object} from - Source position
   * @param {Object} to - Target position
   * @returns {Object} - { dx, dy, distance, angle }
   */
  calculateFlightVector(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    return { dx, dy, distance, angle };
  }

  /**
   * Calculate target layout for abstract text
   * Creates an invisible container, lays out words, captures positions, then removes
   * @param {string[]} words - Words to layout
   * @param {Object} options - Layout options
   * @returns {Object[]} - Array of { word, position }
   */
  calculateTargetLayout(words, options = {}) {
    const {
      containerRect = null, // If null, uses viewport center
      maxWidth = 400,
      fontSize = '16px',
      lineHeight = 1.5,
      padding = 20,
      position = 'center' // 'center', 'top', 'bottom', or {x, y}
    } = options;

    // Create invisible layout container
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      visibility: hidden;
      pointer-events: none;
      max-width: ${maxWidth}px;
      font-size: ${fontSize};
      line-height: ${lineHeight};
      padding: ${padding}px;
      z-index: -9999;
      white-space: normal;
      word-wrap: break-word;
    `;

    // Position the container
    if (typeof position === 'object') {
      container.style.left = `${position.x}px`;
      container.style.top = `${position.y}px`;
    } else {
      // Calculate center position
      container.style.left = '50%';
      container.style.top = '50%';
      container.style.transform = 'translate(-50%, -50%)';
    }

    // Create word spans
    const wordSpans = [];
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.textContent = word;
      span.dataset.index = index;
      span.style.display = 'inline';
      container.appendChild(span);

      // Add space after word (except last)
      if (index < words.length - 1) {
        container.appendChild(document.createTextNode(' '));
      }

      wordSpans.push(span);
    });

    // Add to DOM temporarily
    document.body.appendChild(container);

    // Force layout calculation
    container.offsetHeight;

    // Capture positions
    const layout = wordSpans.map((span, index) => {
      const rect = span.getBoundingClientRect();
      return {
        word: words[index],
        index,
        position: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          center: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          }
        }
      };
    });

    // Get container bounds for reference
    const containerBounds = container.getBoundingClientRect();

    // Remove temporary container
    document.body.removeChild(container);

    return {
      words: layout,
      containerBounds: {
        x: containerBounds.left,
        y: containerBounds.top,
        width: containerBounds.width,
        height: containerBounds.height
      }
    };
  }

  /**
   * Calculate staggered animation delays
   * @param {number} count - Number of items
   * @param {Object} options
   * @returns {number[]} - Array of delay values in ms
   */
  calculateStaggerDelays(count, options = {}) {
    const {
      baseDelay = 0,
      staggerAmount = 50,
      pattern = 'linear' // 'linear', 'random', 'center-out', 'edges-in'
    } = options;

    const delays = [];

    switch (pattern) {
      case 'random':
        for (let i = 0; i < count; i++) {
          delays.push(baseDelay + Math.random() * staggerAmount * count);
        }
        break;

      case 'center-out':
        const center = Math.floor(count / 2);
        for (let i = 0; i < count; i++) {
          const distanceFromCenter = Math.abs(i - center);
          delays.push(baseDelay + distanceFromCenter * staggerAmount);
        }
        break;

      case 'edges-in':
        for (let i = 0; i < count; i++) {
          const distanceFromEdge = Math.min(i, count - 1 - i);
          delays.push(baseDelay + distanceFromEdge * staggerAmount);
        }
        break;

      case 'linear':
      default:
        for (let i = 0; i < count; i++) {
          delays.push(baseDelay + i * staggerAmount);
        }
        break;
    }

    return delays;
  }

  /**
   * Check if element is in viewport
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Get viewport dimensions
   * @returns {Object}
   */
  getViewportDimensions() {
    return {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight,
      scrollX: window.pageXOffset || document.documentElement.scrollLeft,
      scrollY: window.pageYOffset || document.documentElement.scrollTop
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PositionManager;
} else {
  window.PositionManager = PositionManager;
}
