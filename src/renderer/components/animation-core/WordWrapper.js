/**
 * WordWrapper - Wraps individual words in DOM elements for animation
 *
 * This is a pure JavaScript class that can be instantiated in different contexts:
 * - Browser webview (StudyEnhancer)
 * - React components (Notes, EPUB, PDF views)
 *
 * Usage:
 *   const wrapper = new WordWrapper();
 *   const result = wrapper.wrapElement(document.querySelector('.content'));
 *   // result = { wordCount: 42, wordIds: ['se-word-0', 'se-word-1', ...] }
 */

class WordWrapper {
  constructor(options = {}) {
    this.wordClass = options.wordClass || 'ac-word';
    this.wordIdPrefix = options.wordIdPrefix || 'ac-word-';
    this.wordCounter = options.startCounter || 0;
    this.wrappedElements = new Map();
    this.wordMap = new Map();
  }

  /**
   * Wrap all words in an element with span tags
   * @param {HTMLElement} element - The DOM element to process
   * @param {Object} options - Options for wrapping
   * @returns {Object} { wordCount, wordIds }
   */
  wrapElement(element, options = {}) {
    const excludeTags = options.excludeTags || [
      'SCRIPT',
      'STYLE',
      'NOSCRIPT',
      'SVG',
      'CANVAS',
      'VIDEO',
      'AUDIO',
      'IFRAME',
      'CODE',
      'PRE',
    ];

    // Store original HTML for restoration
    if (!this.wrappedElements.has(element)) {
      this.wrappedElements.set(element, element.innerHTML);
    }

    // Collect text nodes
    const textNodes = this._collectTextNodes(element, excludeTags);
    const wordIds = [];

    // Wrap each text node
    textNodes.forEach((textNode) => {
      const wrappedIds = this._wrapTextNode(textNode);
      wordIds.push(...wrappedIds);
    });

    return { wordCount: wordIds.length, wordIds };
  }

  /**
   * Wrap all paragraphs and heading elements on the page
   * @returns {Object} { totalWords }
   */
  wrapAllParagraphs() {
    const elements = document.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote'
    );
    let totalWords = 0;

    elements.forEach((element) => {
      const result = this.wrapElement(element);
      totalWords += result.wordCount;
    });

    return { totalWords };
  }

  /**
   * Get a wrapped word span by ID
   * @param {string} wordId - The word ID
   * @returns {HTMLElement|null}
   */
  getWord(wordId) {
    const entry = this.wordMap.get(wordId);
    return entry ? entry.span : null;
  }

  /**
   * Get all wrapped words
   * @returns {Map}
   */
  getAllWords() {
    return this.wordMap;
  }

  /**
   * Find words by their text content
   * @param {string} text - Text to search for
   * @returns {Array} Matching word entries
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
   * Find multiple words by text (for matching summary words)
   * @param {string[]} words - Array of words to search for
   * @returns {Map} Map of word -> matched span IDs
   */
  findMultipleWords(words) {
    const results = new Map();
    const usedIds = new Set();

    words.forEach((word) => {
      const searchText = word.toLowerCase().replace(/[.,!?;:'"]/g, '');
      if (!searchText) return;

      for (const [wordId, data] of this.wordMap) {
        if (usedIds.has(wordId)) continue;
        const spanText = data.text.toLowerCase().replace(/[.,!?;:'"]/g, '');

        if (spanText === searchText) {
          results.set(word, { wordId, ...data });
          usedIds.add(wordId);
          break;
        }
      }
    });

    return results;
  }

  /**
   * Restore original content for all wrapped elements
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
   * Restore a specific element
   * @param {HTMLElement} element
   */
  restoreElement(element) {
    const original = this.wrappedElements.get(element);
    if (original && element && element.parentNode) {
      element.innerHTML = original;
      this.wrappedElements.delete(element);

      // Remove from wordMap
      this.wordMap.forEach((data, wordId) => {
        if (data.parentElement === element) {
          this.wordMap.delete(wordId);
        }
      });
    }
  }

  /**
   * Collect all text nodes within an element
   * @private
   */
  _collectTextNodes(element, excludeTags) {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip empty or whitespace-only nodes
        if (!node.nodeValue || node.nodeValue.trim() === '') {
          return NodeFilter.FILTER_REJECT;
        }

        // Check parent chain for excluded tags
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
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    return textNodes;
  }

  /**
   * Wrap a single text node
   * @private
   */
  _wrapTextNode(textNode) {
    const text = textNode.nodeValue;
    const parentElement = textNode.parentNode;
    // Split by whitespace, keeping the whitespace
    const parts = text.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    const wordIds = [];

    parts.forEach((part) => {
      if (part.trim() === '') {
        // Preserve whitespace
        fragment.appendChild(document.createTextNode(part));
      } else {
        // Create word span
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
          parentElement,
        });
      }
    });

    parentElement.replaceChild(fragment, textNode);
    return wordIds;
  }
}

export default WordWrapper;
