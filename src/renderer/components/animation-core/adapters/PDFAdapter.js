/**
 * PDFAdapter - Animation adapter for PDF viewer (react-pdf-highlighter)
 *
 * Bridges the AnimationCore with the PDF viewer's canvas/text layer rendering.
 * PDF.js renders text in a textLayer div with positioned spans - we can
 * work with those for animations.
 *
 * Key Features:
 * - Direct access to PDF.js text layer spans
 * - Smart summary with flying word constellation effect
 * - Vocabulary highlighting with glow effects
 * - Word-level matching and animation
 *
 * Usage:
 *   const adapter = new PDFAdapter(containerRef);
 *   await adapter.initialize();
 *   await adapter.highlightVocabulary(['word1', 'word2']);
 *   await adapter.smartSummary(sourceText, summaryText, vocabWords);
 *   adapter.destroy();
 *
 * Integration with PDFView.js:
 *   const pdfAnimations = useRef(null);
 *   const containerRef = useRef(null);
 *
 *   useEffect(() => {
 *     pdfAnimations.current = new PDFAdapter(containerRef);
 *     return () => pdfAnimations.current?.destroy();
 *   }, []);
 */

import AnimationCore from '../AnimationCore';
import AnimationEngine from '../AnimationEngine';

class PDFAdapter {
  constructor(containerRef) {
    this.containerRef = containerRef;
    this.animationCore = null;
    this.animationEngine = new AnimationEngine();
    this.isInitialized = false;
    this.activeEffects = new Map();
    this.observer = null;
    this.currentPage = 1;
    this.wrappedSpans = new Map(); // Track which spans we've processed

    // Bind methods
    this._handleMutation = this._handleMutation.bind(this);
  }

  /**
   * Get the container element
   * @private
   */
  get container() {
    return this.containerRef?.current || this.containerRef;
  }

  /**
   * Initialize the adapter
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[PDFAdapter] Already initialized');
      return true;
    }

    const container = this.container;
    console.log('[PDFAdapter] Initializing with container:', container?.className);

    if (!container) {
      console.warn('[PDFAdapter] No container provided');
      return false;
    }

    try {
      // Create AnimationCore instance
      this.animationCore = new AnimationCore({
        container: document.body,
        wordClass: 'pdf-ac-word',
        wordIdPrefix: 'pdf-ac-word-',
      });

      // Inject required styles
      this._injectStyles();

      // Set up mutation observer to detect page changes
      this._setupObserver();

      this.isInitialized = true;
      console.log('[PDFAdapter] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[PDFAdapter] Initialization error:', error);
      return false;
    }
  }

  /**
   * Set up mutation observer for page changes
   * @private
   */
  _setupObserver() {
    if (this.observer) return;

    this.observer = new MutationObserver(this._handleMutation);

    const container = this.container;
    if (container) {
      this.observer.observe(container, {
        childList: true,
        subtree: true,
      });
    }
  }

  /**
   * Handle DOM mutations (page changes)
   * @private
   */
  _handleMutation(mutations) {
    // Check if text layer was updated
    const textLayerChanged = mutations.some((m) =>
      Array.from(m.addedNodes).some(
        (n) =>
          n.classList?.contains('textLayer') ||
          n.querySelector?.('.textLayer')
      )
    );

    if (textLayerChanged) {
      // Clean up previous animations when page changes
      this._cleanup();
    }
  }

  /**
   * Inject required CSS
   * @private
   */
  _injectStyles() {
    if (document.getElementById('pdf-ac-styles')) return;

    const style = document.createElement('style');
    style.id = 'pdf-ac-styles';
    style.textContent = `
      .pdf-ac-word {
        display: inline;
        position: relative;
      }

      #pdf-ac-clone-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
      }

      .pdf-ac-clone {
        position: fixed;
        margin: 0;
        padding: 0;
        pointer-events: none;
      }

      .pdf-ac-flying-word {
        z-index: 999999;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .pdf-ac-dim-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 20, 0.4);
        z-index: 999990;
        pointer-events: none;
        opacity: 0;
        transition: opacity 400ms ease-out;
      }

      .pdf-ac-summary-container {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        max-width: 500px;
        background: linear-gradient(135deg, rgba(30, 35, 50, 0.98), rgba(20, 25, 40, 0.98));
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
        z-index: 999997;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }

      /* Highlight styles for text layer spans */
      .textLayer span.pdf-ac-highlighted {
        background-color: rgba(255, 215, 0, 0.3) !important;
        border-radius: 2px;
      }

      .textLayer span.pdf-ac-glowing {
        text-shadow: 0 0 8px #00bfff, 0 0 16px #00bfff;
        color: #fff !important;
      }

      @keyframes pdf-ac-glow-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Get all text layer elements on current visible pages
   * @private
   */
  _getTextLayers() {
    const container = this.container;
    if (!container) return [];

    // PDF.js renders text in .textLayer divs
    return Array.from(container.querySelectorAll('.textLayer'));
  }

  /**
   * Get all text spans from text layers
   * @private
   */
  _getTextSpans() {
    const textLayers = this._getTextLayers();
    const spans = [];

    textLayers.forEach((layer) => {
      // PDF.js creates spans for each text chunk
      spans.push(...Array.from(layer.querySelectorAll('span')));
    });

    return spans;
  }

  /**
   * Clean up current effects
   * @private
   */
  async _cleanup() {
    // Remove summary if active
    await this.removeSummary();

    if (this.animationCore) {
      await this.animationCore.removeAllEffects();
      this.animationCore.restoreAll();
    }

    // Remove any remaining DOM elements
    ['pdf-ac-dim-overlay', 'pdf-ac-clone-overlay', 'pdf-ac-summary-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // Remove highlight classes from text spans
    document.querySelectorAll('.pdf-ac-highlighted, .pdf-ac-glowing').forEach((el) => {
      el.classList.remove('pdf-ac-highlighted', 'pdf-ac-glowing');
      el.style.textShadow = '';
      el.style.backgroundColor = '';
    });

    // Restore wrapped word spans
    document.querySelectorAll('.pdf-ac-word').forEach(el => {
      el.style.textShadow = '';
      el.style.color = '';
      el.style.opacity = '';
    });

    this.activeEffects.clear();
    this.wrappedSpans.clear();
  }

  // ============================================
  // Public API - Animation Methods
  // ============================================

  /**
   * Highlight vocabulary words in the PDF
   * @param {string[]} words - Array of vocabulary words
   * @param {Object} options
   * @returns {Promise}
   */
  async highlightVocabulary(words, options = {}) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return { wordCount: 0 };
    }

    const textSpans = this._getTextSpans();
    if (!textSpans.length) {
      console.warn('PDFAdapter: No text spans found');
      return { wordCount: 0 };
    }

    const wordsLower = words.map((w) => w.toLowerCase());
    let matchCount = 0;

    textSpans.forEach((span) => {
      const text = span.textContent || '';
      const textLower = text.toLowerCase();

      // Check if any word is in this span
      const hasMatch = wordsLower.some(
        (word) => textLower.includes(word) || word.includes(textLower.trim())
      );

      if (hasMatch && text.trim().length > 0) {
        span.classList.add('pdf-ac-highlighted');
        if (options.color) {
          span.style.backgroundColor = options.color;
        }
        matchCount++;
      }
    });

    return { wordCount: matchCount };
  }

  /**
   * Apply glow effect to specific words
   * @param {string[]} words
   * @param {Object} options
   * @returns {Promise}
   */
  async glowWords(words, options = {}) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return { wordCount: 0 };
    }

    const textSpans = this._getTextSpans();
    if (!textSpans.length) return { wordCount: 0 };

    const wordsLower = words.map((w) => w.toLowerCase());
    let matchCount = 0;

    textSpans.forEach((span) => {
      const text = span.textContent || '';
      const textLower = text.toLowerCase();

      const hasMatch = wordsLower.some(
        (word) => textLower.includes(word) || word.includes(textLower.trim())
      );

      if (hasMatch && text.trim().length > 0) {
        span.classList.add('pdf-ac-glowing');
        if (options.color) {
          span.style.textShadow = `0 0 8px ${options.color}, 0 0 16px ${options.color}`;
        }
        matchCount++;
      }
    });

    return { wordCount: matchCount };
  }

  /**
   * Wrap words in PDF text layer spans for fine-grained control
   * PDF.js creates spans for text chunks, we need to further split into words
   * @private
   */
  _wrapWordsInSpan(span) {
    if (this.wrappedSpans.has(span)) return this.wrappedSpans.get(span);

    const text = span.textContent || '';
    if (!text.trim()) return [];

    const words = text.split(/(\s+)/);
    const wordElements = [];

    // Clear the span
    span.innerHTML = '';

    words.forEach((part, i) => {
      if (/^\s+$/.test(part)) {
        // Whitespace - just append as text
        span.appendChild(document.createTextNode(part));
      } else if (part.length > 0) {
        // Word - wrap in span
        const wordSpan = document.createElement('span');
        wordSpan.className = 'pdf-ac-word';
        wordSpan.id = `pdf-ac-word-${Date.now()}-${i}`;
        wordSpan.textContent = part;
        wordSpan.style.cssText = 'display: inline;';
        span.appendChild(wordSpan);
        wordElements.push(wordSpan);
      }
    });

    this.wrappedSpans.set(span, wordElements);
    return wordElements;
  }

  /**
   * Get word spans from selection or source text area
   * @private
   */
  _getWordSpansForText(sourceText) {
    const textSpans = this._getTextSpans();
    const allWordSpans = [];
    const sourceWordsLower = sourceText.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    // Find spans that contain parts of the source text
    textSpans.forEach(span => {
      const spanText = (span.textContent || '').toLowerCase();

      // Check if this span is part of the source
      const isRelevant = sourceWordsLower.some(word =>
        spanText.includes(word) || word.includes(spanText.trim())
      );

      if (isRelevant && spanText.trim().length > 0) {
        const wordSpans = this._wrapWordsInSpan(span);
        allWordSpans.push(...wordSpans);
      }
    });

    return allWordSpans;
  }

  /**
   * Create smart summary with flying word animation
   * Implements the "Word Constellation" flying animation effect
   *
   * @param {string} sourceText - Selected or source text
   * @param {string} summaryText - AI-generated summary
   * @param {string[]} vocabularyWords - Optional vocabulary words to highlight with gold glow
   * @param {Object} options
   * @returns {Promise}
   */
  async smartSummary(sourceText, summaryText, vocabularyWords = [], options = {}) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return { matchCount: 0 };
    }

    // Create dim overlay
    let overlay = document.getElementById('pdf-ac-dim-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pdf-ac-dim-overlay';
      overlay.className = 'pdf-ac-dim-overlay';
      document.body.appendChild(overlay);
    }

    // Animate overlay in
    await new Promise(r => setTimeout(r, 50));
    overlay.style.opacity = '1';
    await new Promise(r => setTimeout(r, 400));

    // Parse summary words
    const summaryWords = summaryText.split(/\s+/).filter(w => w.length > 0);
    const vocabLower = vocabularyWords.map(w => w.toLowerCase());

    // Get word spans from source area
    const sourceWordSpans = this._getWordSpansForText(sourceText);

    // Find matches between source and summary words
    const matches = [];
    const usedSpans = new Set();

    summaryWords.forEach((summaryWord, index) => {
      const searchWord = summaryWord.toLowerCase().replace(/[.,!?;:'"]/g, '');
      if (searchWord.length < 2) return;

      for (const wordSpan of sourceWordSpans) {
        if (usedSpans.has(wordSpan)) continue;

        const spanText = wordSpan.textContent.toLowerCase().replace(/[.,!?;:'"]/g, '');
        if (spanText === searchWord) {
          const isVocab = vocabLower.some(v => v === searchWord);
          const rect = wordSpan.getBoundingClientRect();

          matches.push({
            sourceSpan: wordSpan,
            word: summaryWord,
            summaryIndex: index,
            isVocabulary: isVocab,
            sourcePosition: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          });
          usedSpans.add(wordSpan);
          break;
        }
      }
    });

    // Create summary container
    const container = this._createSummaryContainer(summaryText, summaryWords, options);
    this.activeEffects.set('summary-container', container);

    // Create clone overlay for flying words
    let cloneOverlay = document.getElementById('pdf-ac-clone-overlay');
    if (!cloneOverlay) {
      cloneOverlay = document.createElement('div');
      cloneOverlay.id = 'pdf-ac-clone-overlay';
      cloneOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
      `;
      document.body.appendChild(cloneOverlay);
    }

    // Glow source words and dim non-matching
    sourceWordSpans.forEach(wordSpan => {
      if (usedSpans.has(wordSpan)) {
        const match = matches.find(m => m.sourceSpan === wordSpan);
        const glowColor = match?.isVocabulary ? '#ffd700' : '#00bfff';
        wordSpan.style.textShadow = `0 0 8px ${glowColor}, 0 0 16px ${glowColor}`;
        wordSpan.style.color = '#fff';
      } else {
        wordSpan.style.opacity = '0.3';
      }
    });

    // Fly matching words to summary
    await this._flyWordsToSummary(cloneOverlay, matches, container, options);

    // Store for cleanup
    this.activeEffects.set('dim-overlay', overlay);
    this.activeEffects.set('clone-overlay', cloneOverlay);
    this.activeEffects.set('source-word-spans', sourceWordSpans);

    return { matchCount: matches.length };
  }

  /**
   * Create summary container element
   * @private
   */
  _createSummaryContainer(summaryText, summaryWords, options) {
    const container = document.createElement('div');
    container.id = 'pdf-ac-summary-container';
    container.className = 'pdf-ac-summary-container';
    container.style.cssText = `
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      max-width: 500px;
      background: linear-gradient(135deg, rgba(30, 35, 50, 0.98), rgba(20, 25, 40, 0.98));
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
      z-index: 999997;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.9);
      transition: all 400ms cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: rgba(100, 180, 255, 0.7);
      font-weight: 600;
      margin-bottom: 16px;
    `;
    header.textContent = 'SMART SUMMARY';
    container.appendChild(header);

    // Word slots container
    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'pdf-ac-summary-slots';
    slotsContainer.style.cssText = `
      font-size: 16px;
      line-height: 1.8;
      color: rgba(255, 255, 255, 0.3);
    `;

    // Create word slots
    summaryWords.forEach((word, i) => {
      const slot = document.createElement('span');
      slot.id = `pdf-ac-slot-${i}`;
      slot.className = 'pdf-ac-word-slot';
      slot.dataset.word = word;
      slot.textContent = word;
      slot.style.cssText = `
        display: inline;
        opacity: 0.2;
        transition: opacity 200ms, color 200ms;
      `;
      slotsContainer.appendChild(slot);

      // Add space after word
      if (i < summaryWords.length - 1) {
        slotsContainer.appendChild(document.createTextNode(' '));
      }
    });
    container.appendChild(slotsContainer);

    // Button container (top right)
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Save button
    if (options.onSave) {
      const saveBtn = document.createElement('button');
      saveBtn.style.cssText = `
        background: rgba(100, 180, 255, 0.2);
        border: 1px solid rgba(100, 180, 255, 0.4);
        color: rgba(100, 180, 255, 0.9);
        font-size: 14px;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 6px;
        transition: all 150ms;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 6px;
      `;
      saveBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17,21 17,13 7,13 7,21"/>
          <polyline points="7,3 7,8 15,8"/>
        </svg>
        Save
      `;
      saveBtn.onmouseenter = () => {
        saveBtn.style.background = 'rgba(100, 180, 255, 0.3)';
        saveBtn.style.borderColor = 'rgba(100, 180, 255, 0.6)';
      };
      saveBtn.onmouseleave = () => {
        saveBtn.style.background = 'rgba(100, 180, 255, 0.2)';
        saveBtn.style.borderColor = 'rgba(100, 180, 255, 0.4)';
      };
      saveBtn.onclick = async () => {
        // Disable button and show saving state
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10"/>
          </svg>
          Saving...
        `;
        try {
          await options.onSave(summaryText);
          // Show success state
          saveBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            Saved!
          `;
          saveBtn.style.background = 'rgba(100, 255, 100, 0.2)';
          saveBtn.style.borderColor = 'rgba(100, 255, 100, 0.4)';
          saveBtn.style.color = 'rgba(100, 255, 100, 0.9)';
          // Auto close after a moment
          setTimeout(() => this.removeSummary(), 1500);
        } catch (error) {
          console.error('[PDFAdapter] Save failed:', error);
          saveBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            Failed
          `;
          saveBtn.style.background = 'rgba(255, 100, 100, 0.2)';
          saveBtn.style.borderColor = 'rgba(255, 100, 100, 0.4)';
          saveBtn.style.color = 'rgba(255, 100, 100, 0.9)';
          saveBtn.disabled = false;
        }
      };
      btnContainer.appendChild(saveBtn);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 50%;
      transition: all 150ms;
      pointer-events: auto;
    `;
    closeBtn.textContent = '✕';
    closeBtn.onmouseenter = () => closeBtn.style.color = 'rgba(255, 255, 255, 0.9)';
    closeBtn.onmouseleave = () => closeBtn.style.color = 'rgba(255, 255, 255, 0.5)';
    closeBtn.onclick = () => this.removeSummary();
    btnContainer.appendChild(closeBtn);

    container.appendChild(btnContainer);

    document.body.appendChild(container);

    // Animate in
    setTimeout(() => {
      container.style.opacity = '1';
      container.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 50);

    return container;
  }

  /**
   * Fly words from source to summary slots
   * @private
   */
  async _flyWordsToSummary(cloneOverlay, matches, container, options) {
    const staggerDelay = options.staggerDelay || 60;
    const duration = options.duration || 800;

    // Wait for container to be positioned
    await new Promise(r => setTimeout(r, 100));

    const flights = [];

    for (const match of matches) {
      const slot = document.getElementById(`pdf-ac-slot-${match.summaryIndex}`);
      if (!slot) continue;

      const slotRect = slot.getBoundingClientRect();

      // Create flying clone
      const clone = document.createElement('span');
      clone.className = 'pdf-ac-flying-word';
      clone.textContent = match.word;

      const glowColor = match.isVocabulary ? '#ffd700' : '#00bfff';
      clone.style.cssText = `
        position: fixed;
        left: ${match.sourcePosition.x}px;
        top: ${match.sourcePosition.y}px;
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        text-shadow: 0 0 12px ${glowColor}, 0 0 24px ${glowColor};
        pointer-events: none;
        z-index: 999999;
      `;

      cloneOverlay.appendChild(clone);

      flights.push({
        clone,
        slot,
        from: { x: match.sourcePosition.x, y: match.sourcePosition.y },
        to: { x: slotRect.left, y: slotRect.top },
        glowColor,
      });
    }

    // Execute staggered flights
    const promises = flights.map((flight, i) => {
      return new Promise(resolve => {
        setTimeout(async () => {
          await this._flyWord(flight, duration);
          resolve();
        }, i * staggerDelay);
      });
    });

    await Promise.all(promises);

    // Fade in remaining slots that didn't have matches
    const slots = container.querySelectorAll('.pdf-ac-word-slot');
    slots.forEach(slot => {
      if (slot.style.opacity !== '1') {
        slot.style.opacity = '1';
        slot.style.color = 'rgba(255, 255, 255, 0.85)';
      }
    });
  }

  /**
   * Fly a single word using Bezier curve
   * @private
   */
  async _flyWord(flight, duration) {
    const { clone, slot, from, to, glowColor } = flight;

    return new Promise(resolve => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;

      // Control point for Bezier curve (arc upward)
      const arcHeight = Math.min(Math.abs(dy) * 0.5, 80);
      const cpX = from.x + dx * 0.5;
      const cpY = Math.min(from.y, to.y) - arcHeight;

      const startTime = performance.now();

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const progress = 1 - Math.pow(1 - t, 3);

        // Quadratic Bezier position
        const oneMinusT = 1 - progress;
        const x = oneMinusT * oneMinusT * from.x + 2 * oneMinusT * progress * cpX + progress * progress * to.x;
        const y = oneMinusT * oneMinusT * from.y + 2 * oneMinusT * progress * cpY + progress * progress * to.y;

        clone.style.left = `${x}px`;
        clone.style.top = `${y}px`;

        // Fade glow near end
        if (progress > 0.7) {
          const fadeProgress = (progress - 0.7) / 0.3;
          const glowSize = 12 * (1 - fadeProgress);
          clone.style.textShadow = `0 0 ${glowSize}px ${glowColor}`;
        }

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Show slot and remove clone
          slot.style.opacity = '1';
          slot.style.color = '#fff';
          clone.remove();
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Remove smart summary
   * @returns {Promise}
   */
  async removeSummary() {
    // Fade out container
    const container = this.activeEffects.get('summary-container');
    if (container) {
      container.style.opacity = '0';
      container.style.transform = 'translate(-50%, -50%) scale(0.9)';
      await new Promise(r => setTimeout(r, 400));
      container.remove();
      this.activeEffects.delete('summary-container');
    }

    // Fade out overlay
    const overlay = this.activeEffects.get('dim-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      await new Promise(r => setTimeout(r, 400));
      overlay.remove();
      this.activeEffects.delete('dim-overlay');
    }

    // Remove clone overlay
    const cloneOverlay = this.activeEffects.get('clone-overlay');
    if (cloneOverlay) {
      cloneOverlay.remove();
      this.activeEffects.delete('clone-overlay');
    }

    // Restore source word spans
    const sourceWordSpans = this.activeEffects.get('source-word-spans');
    if (sourceWordSpans) {
      sourceWordSpans.forEach(span => {
        span.style.textShadow = '';
        span.style.color = '';
        span.style.opacity = '';
      });
      this.activeEffects.delete('source-word-spans');
    }

    // Remove glow effects
    document.querySelectorAll('.pdf-ac-glowing').forEach((el) => {
      el.classList.remove('pdf-ac-glowing');
      el.style.textShadow = '';
    });
  }

  /**
   * Remove vocabulary highlights
   * @returns {Promise}
   */
  async removeHighlights() {
    document.querySelectorAll('.pdf-ac-highlighted').forEach((el) => {
      el.classList.remove('pdf-ac-highlighted');
      el.style.backgroundColor = '';
    });
  }

  /**
   * Remove all active effects
   * @returns {Promise}
   */
  async removeAllEffects() {
    await this._cleanup();
  }

  /**
   * Check if adapter is ready
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Destroy the adapter
   */
  async destroy() {
    await this._cleanup();

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.animationCore) {
      await this.animationCore.destroy();
      this.animationCore = null;
    }

    this.isInitialized = false;
  }
}

export default PDFAdapter;
