/**
 * WordWrapper - Wraps individual words in spans using TreeWalker
 *
 * Safely traverses text nodes and wraps words without breaking:
 * - Existing HTML structure
 * - Page layout
 * - Nested elements (links, bold, etc.)
 */

class WordWrapper {
  constructor(options = {}) {
    this.wordClass = options.wordClass || 'se-word';
    this.wordIdPrefix = options.wordIdPrefix || 'se-word-';
    this.wordCounter = 0;
    this.wrappedElements = new Map(); // element -> original innerHTML
    this.wordMap = new Map(); // wordId -> { span, text, parentElement }
  }

  /**
   * Wrap all words in an element
   * @param {HTMLElement} element - Target element (e.g., a paragraph)
   * @param {Object} options - Options
   * @param {string[]} options.excludeTags - Tags to skip (default: script, style, noscript)
   * @returns {Object} - { wordCount, wordIds }
   */
  wrapElement(element, options = {}) {
    const excludeTags = options.excludeTags || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS'];

    // Store original for potential restoration
    if (!this.wrappedElements.has(element)) {
      this.wrappedElements.set(element, element.innerHTML);
    }

    // Find all text nodes using TreeWalker
    const textNodes = this._collectTextNodes(element, excludeTags);
    const wordIds = [];

    // Process each text node
    textNodes.forEach(textNode => {
      const wrappedIds = this._wrapTextNode(textNode);
      wordIds.push(...wrappedIds);
    });

    return {
      wordCount: wordIds.length,
      wordIds
    };
  }

  /**
   * Wrap words in multiple elements matching a selector
   * @param {string} selector - CSS selector
   * @returns {Object} - { totalWords, elements }
   */
  wrapSelector(selector) {
    const elements = document.querySelectorAll(selector);
    let totalWords = 0;
    const results = [];

    elements.forEach(element => {
      const result = this.wrapElement(element);
      totalWords += result.wordCount;
      results.push({ element, ...result });
    });

    return { totalWords, elements: results };
  }

  /**
   * Wrap all paragraphs in document body
   * @returns {Object}
   */
  wrapAllParagraphs() {
    return this.wrapSelector('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote');
  }

  /**
   * Get word span by ID
   * @param {string} wordId
   * @returns {HTMLSpanElement|null}
   */
  getWord(wordId) {
    const entry = this.wordMap.get(wordId);
    return entry ? entry.span : null;
  }

  /**
   * Get all word data
   * @returns {Map}
   */
  getAllWords() {
    return this.wordMap;
  }

  /**
   * Find words matching text (case-insensitive)
   * @param {string} text
   * @returns {Array} - Array of { wordId, span, text }
   */
  findWordsByText(text) {
    const searchText = text.toLowerCase().trim();
    const matches = [];

    this.wordMap.forEach((data, wordId) => {
      if (data.text.toLowerCase() === searchText) {
        matches.push({ wordId, ...data });
      }
    });

    return matches;
  }

  /**
   * Find words matching any of the given texts
   * @param {string[]} texts
   * @returns {Map} - Map of text -> [matches]
   */
  findWordsByTexts(texts) {
    const results = new Map();
    texts.forEach(text => {
      results.set(text.toLowerCase(), []);
    });

    this.wordMap.forEach((data, wordId) => {
      const lowerText = data.text.toLowerCase();
      if (results.has(lowerText)) {
        results.get(lowerText).push({ wordId, ...data });
      }
    });

    return results;
  }

  /**
   * Restore original content for an element
   * @param {HTMLElement} element
   */
  restoreElement(element) {
    const original = this.wrappedElements.get(element);
    if (original) {
      element.innerHTML = original;
      this.wrappedElements.delete(element);
      // Clean up word map entries for this element
      this.wordMap.forEach((data, wordId) => {
        if (data.parentElement === element || element.contains(data.span)) {
          this.wordMap.delete(wordId);
        }
      });
    }
  }

  /**
   * Restore all wrapped elements
   */
  restoreAll() {
    this.wrappedElements.forEach((original, element) => {
      if (element && element.parentNode) {
        element.innerHTML = original;
      }
    });
    this.wrappedElements.clear();
    this.wordMap.clear();
    this.wordCounter = 0;
  }

  /**
   * Collect text nodes using TreeWalker
   * @private
   */
  _collectTextNodes(element, excludeTags) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip empty or whitespace-only nodes
          if (!node.nodeValue || node.nodeValue.trim() === '') {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip excluded parent tags
          let parent = node.parentNode;
          while (parent && parent !== element) {
            if (excludeTags.includes(parent.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            // Skip if already wrapped
            if (parent.classList && parent.classList.contains(this.wordClass)) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    return textNodes;
  }

  /**
   * Wrap words in a single text node
   * @private
   */
  _wrapTextNode(textNode) {
    const text = textNode.nodeValue;
    const parentElement = textNode.parentNode;

    // Split by whitespace, preserving the whitespace
    const parts = text.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    const wordIds = [];

    parts.forEach(part => {
      if (part.trim() === '') {
        // Preserve whitespace as text node
        fragment.appendChild(document.createTextNode(part));
      } else {
        // Wrap word in span
        const wordId = this.wordIdPrefix + this.wordCounter++;
        const span = document.createElement('span');
        span.className = this.wordClass;
        span.id = wordId;
        span.textContent = part;
        span.dataset.originalText = part;

        fragment.appendChild(span);
        wordIds.push(wordId);

        // Store in word map
        this.wordMap.set(wordId, {
          span,
          text: part,
          parentElement
        });
      }
    });

    // Replace text node with fragment
    parentElement.replaceChild(fragment, textNode);

    return wordIds;
  }
}

// Export for module bundling or direct use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WordWrapper;
} else {
  window.WordWrapper = WordWrapper;
}
