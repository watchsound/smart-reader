/**
 * EPUBAdapter - Animation adapter for EPUB reader (react-reader / epub.js)
 *
 * Bridges the AnimationCore with the EPUB reader's iframe-based rendering.
 * The EPUB content is rendered inside an iframe managed by epub.js, so we
 * need to access the iframe's document to apply animations.
 *
 * Key Features:
 * - Coordinate translation from iframe to parent window for flying animations
 * - Word wrapping for text selection targeting
 * - Smart summary with flying word constellation effect
 * - Vocabulary highlighting with glow effects
 *
 * Usage:
 *   const adapter = new EPUBAdapter(rendition);
 *   await adapter.initialize();
 *   await adapter.highlightVocabulary(['word1', 'word2']);
 *   await adapter.smartSummary(selectedText, summaryText, vocabWords);
 *   adapter.destroy();
 *
 * Integration with EPubView.js:
 *   // After rendition is set up
 *   const epubAnimations = useRef(null);
 *
 *   useEffect(() => {
 *     if (rendition) {
 *       epubAnimations.current = new EPUBAdapter(rendition);
 *       epubAnimations.current.initialize();
 *     }
 *     return () => epubAnimations.current?.destroy();
 *   }, [rendition]);
 */

import AnimationCore from '../AnimationCore';
import WordWrapper from '../WordWrapper';
import AnimationEngine from '../AnimationEngine';
import { wrapMatchesInDocument } from './srsHaloWalker';

class EPUBAdapter {
  constructor(rendition) {
    this.rendition = rendition;
    this.animationCore = null;
    this.currentDocument = null;
    this.currentWindow = null;
    this.currentIframe = null;
    this.isInitialized = false;
    this.activeEffects = new Map();
    this.locationChangeListener = null;

    // Internal components for iframe-safe animations
    this.wordWrapper = null;
    this.animationEngine = new AnimationEngine();

    // Lexical halo state — independent from wordWrapper so Smart Summary
    // and the halo don't fight over the same DOM wraps. Reset per chapter.
    this._haloedWords = new Set();
    this._haloSpans = [];

    // Bind methods
    this._handleLocationChange = this._handleLocationChange.bind(this);
    this._handleContentsLoaded = this._handleContentsLoaded.bind(this);
  }

  /**
   * Convert iframe-relative position to parent window position
   * @private
   */
  _iframeToParent(position) {
    if (!this.currentIframe) return position;

    const iframeRect = this.currentIframe.getBoundingClientRect();
    return {
      x: position.x + iframeRect.left,
      y: position.y + iframeRect.top,
      width: position.width,
      height: position.height,
    };
  }

  /**
   * Get position of element in parent window coordinates
   * @private
   */
  _getPositionInParent(element) {
    const rect = element.getBoundingClientRect();
    return this._iframeToParent({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }

  /**
   * Initialize the adapter - must be called after rendition is ready
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.isInitialized) return true;

    if (!this.rendition) {
      console.warn('EPUBAdapter: No rendition provided');
      return false;
    }

    try {
      // Get the iframe document
      this._setupDocument();

      if (!this.currentDocument) {
        console.warn('EPUBAdapter: Could not access EPUB document');
        return false;
      }

      // Create AnimationCore instance for the EPUB document
      this.animationCore = new AnimationCore({
        container: this.currentDocument.body,
        wordClass: 'epub-ac-word',
        wordIdPrefix: 'epub-ac-word-',
      });

      // Inject required styles into iframe
      this._injectStyles();

      // Listen for location changes (page turns)
      this.rendition.on('locationChanged', this._handleLocationChange);

      // Listen for content loads
      this.rendition.on('rendered', this._handleContentsLoaded);

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('EPUBAdapter initialization error:', error);
      return false;
    }
  }

  /**
   * Set up document reference from rendition views
   * @private
   */
  _setupDocument() {
    const views = this.rendition?.views?.();
    if (!views || !views._views || !views._views.length) {
      console.warn('EPUBAdapter: No views available');
      return;
    }

    const view = views._views[0];
    if (!view) return;

    // Get the iframe and its document
    const iframe = view.iframe || view.element?.querySelector('iframe');
    if (iframe && iframe.contentDocument) {
      this.currentDocument = iframe.contentDocument;
      this.currentWindow = iframe.contentWindow;
      this.currentIframe = iframe;
    } else if (view.document) {
      this.currentDocument = view.document;
      this.currentWindow = view.window;
      this.currentIframe = null;
    }

    // Create word wrapper for this document
    if (this.currentDocument) {
      this.wordWrapper = new WordWrapper({
        wordClass: 'epub-ac-word',
        wordIdPrefix: 'epub-ac-word-',
      });
    }
  }

  /**
   * Handle location changes - reinitialize for new page
   * @private
   */
  _handleLocationChange(location) {
    // Clean up animations from previous page
    this._cleanup();

    // Re-setup for new page content
    setTimeout(() => {
      this._setupDocument();
      if (this.currentDocument && this.animationCore) {
        this.animationCore.options.container = this.currentDocument.body;
        this._injectStyles();
      }
    }, 100);
  }

  /**
   * Handle content rendered
   * @private
   */
  _handleContentsLoaded(section, view) {
    this._setupDocument();
    if (this.currentDocument && this.animationCore) {
      this.animationCore.options.container = this.currentDocument.body;
      this._injectStyles();
    }
    // New chapter DOM — previously-haloed spans are gone with the old iframe
    // content, so the dedup set must reset or the next applyLexicalHalo call
    // would skip every word as "already haloed."
    this._haloedWords = new Set();
    this._haloSpans = [];
  }

  /**
   * Inject required CSS into the EPUB iframe
   * @private
   */
  _injectStyles() {
    if (!this.currentDocument) return;

    // Check if styles already exist
    if (this.currentDocument.getElementById('epub-ac-styles')) return;

    const style = this.currentDocument.createElement('style');
    style.id = 'epub-ac-styles';
    style.textContent = `
      .epub-ac-word {
        display: inline;
        position: relative;
      }

      #epub-ac-clone-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
      }

      .epub-ac-clone {
        position: fixed;
        margin: 0;
        padding: 0;
        pointer-events: none;
      }

      .epub-ac-flying-word {
        z-index: 999999;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .epub-ac-dim-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 20, 0.4);
        z-index: 999990;
        pointer-events: none;
      }

      .epub-ac-summary-container {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        max-width: 80%;
        background: linear-gradient(135deg, rgba(30, 35, 50, 0.98), rgba(20, 25, 40, 0.98));
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
        z-index: 999997;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }

      @keyframes epub-ac-glow-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.15); }
      }

      @keyframes epub-ac-fade-in {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes epub-ac-halo-pulse {
        0%   { background-color: rgba(100, 180, 255, 0); }
        30%  { background-color: rgba(100, 180, 255, 0.28); }
        100% { background-color: transparent; }
      }

      .epub-ac-lexical-halo {
        display: inline;
        border-bottom: 1px dotted rgba(100, 180, 255, 0.65);
        border-radius: 2px;
        padding-bottom: 1px;
        animation: epub-ac-halo-pulse 900ms ease-out 1 both;
        cursor: help;
        transition: background-color 200ms ease-out;
      }
      .epub-ac-lexical-halo:hover {
        background-color: rgba(100, 180, 255, 0.18);
      }

      .epub-ac-srs-foggy {
        display: inline;
        cursor: help;
        transition: opacity 250ms ease-out;
      }
      .epub-ac-srs-foggy:hover {
        opacity: 1 !important;
      }

      @keyframes epub-ac-mastered-emerge {
        from { opacity: 0; transform: scale(0.5); }
        to   { opacity: 1; transform: scale(1); }
      }
      .epub-ac-srs-mastered {
        display: inline;
        position: relative;
      }
      .epub-ac-srs-mastered::after {
        content: ' ✦';
        color: #d4b86a;
        font-size: 0.7em;
        opacity: 0;
        animation: epub-ac-mastered-emerge 600ms ease-out forwards;
      }
    `;

    this.currentDocument.head.appendChild(style);
  }

  /**
   * Clean up current effects
   * @private
   */
  async _cleanup() {
    // Remove summary if active
    await this.removeSummary();

    // Clean up animation core
    if (this.animationCore) {
      await this.animationCore.removeAllEffects();
      this.animationCore.restoreAll();
    }

    // Clean up word wrapper
    if (this.wordWrapper) {
      this.wordWrapper.restoreAll();
    }

    // Remove any remaining DOM elements in parent
    const parentDoc = document;
    ['epub-ac-dim-overlay', 'epub-ac-clone-overlay', 'epub-ac-summary-container'].forEach(id => {
      const el = parentDoc.getElementById(id);
      if (el) el.remove();
    });

    this.activeEffects.clear();
  }

  // ============================================
  // Public API - Animation Methods
  // ============================================

  /**
   * Highlight vocabulary words on current page
   * @param {string[]} words - Array of vocabulary words
   * @param {Object} options
   * @returns {Promise}
   */
  async highlightVocabulary(words, options = {}) {
    if (!this.isInitialized || !this.animationCore) {
      const initialized = await this.initialize();
      if (!initialized) return { wordCount: 0 };
    }

    const result = await this.animationCore.highlightWords(words, {
      color: options.color || 'rgba(255, 215, 0, 0.3)',
      element: this.currentDocument.body,
      ...options,
    });

    if (result.effectId) {
      this.activeEffects.set(result.effectId, 'vocabulary-highlight');
    }

    return result;
  }

  /**
   * Apply glow effect to specific words
   * @param {string[]} words
   * @param {Object} options
   * @returns {Promise}
   */
  async glowWords(words, options = {}) {
    if (!this.isInitialized || !this.animationCore) {
      const initialized = await this.initialize();
      if (!initialized) return { wordCount: 0 };
    }

    const result = await this.animationCore.glowWords(words, {
      element: this.currentDocument.body,
      ...options,
    });

    if (result.effectId) {
      this.activeEffects.set(result.effectId, 'glow');
    }

    return result;
  }

  /**
   * Apply the SRS-aware halo for the current chapter. Each item is an
   * already-classified vocab entry `{ word, state, intensity }` (see
   * `renderer/utils/srsHaloClassifier.js`). The walker wraps first
   * occurrences with state-specific CSS classes:
   *   - 'learning' → .epub-ac-lexical-halo (v1 blue dotted underline)
   *   - 'foggy'    → .epub-ac-srs-foggy + inline opacity by intensity
   *   - 'mastered' → .epub-ac-srs-mastered (✦ pseudo-element)
   *
   * Per-chapter dedup is threaded via `this._haloedWords`; state resets
   * in `_handleContentsLoaded` when a new chapter renders.
   *
   * @param {Array<{word: string, state: string, intensity: number}>} items
   * @param {Object} [options]
   * @returns {Promise<{ haloCount: number }>}
   */
  async applySrsHalo(items, options = {}) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return { haloCount: 0 };
    }
    if (!this.currentDocument || !Array.isArray(items) || items.length === 0) {
      return { haloCount: 0 };
    }
    const { spans } = wrapMatchesInDocument(
      this.currentDocument,
      this.currentDocument.body,
      items,
      {
        seenWords: this._haloedWords,
        excludeTags: options.excludeTags,
      },
    );
    spans.forEach((span, i) => {
      // Stagger the pulse so multiple haloed words on the same page
      // emerge as a constellation rather than a synchronised flash.
      span.style.animationDelay = `${Math.min(i * 35, 600)}ms`;
      this._haloSpans.push(span);
    });
    return { haloCount: spans.length };
  }

  /**
   * v1 backwards-compat shim. Maps plain word strings to 'learning' items
   * and delegates to applySrsHalo. EPubView callers still using the v1
   * signature see the same blue dotted underline they always did.
   *
   * @param {string[]} words
   * @param {Object} [options]
   * @returns {Promise<{ haloCount: number }>}
   */
  async applyLexicalHalo(words, options = {}) {
    if (!Array.isArray(words) || words.length === 0) {
      return { haloCount: 0 };
    }
    const items = words.map((w) => ({
      word: w,
      state: 'learning',
      intensity: 0,
    }));
    return this.applySrsHalo(items, options);
  }

  /**
   * Remove all lexical halos and reset the per-chapter dedup set.
   * Useful when the user toggles the feature off mid-read.
   */
  async removeLexicalHalo() {
    if (!this._haloSpans || this._haloSpans.length === 0) {
      this._haloedWords = new Set();
      return;
    }
    this._haloSpans.forEach((span) => {
      if (span && span.parentNode) {
        const doc = span.ownerDocument || this.currentDocument;
        span.parentNode.replaceChild(
          doc.createTextNode(span.textContent),
          span,
        );
      }
    });
    this._haloSpans = [];
    this._haloedWords = new Set();
  }

  /**
   * Create smart summary animation from selected text
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

    if (!this.currentDocument || !this.wordWrapper) {
      console.warn('EPUBAdapter: Document not available');
      return { matchCount: 0 };
    }

    // Find the selection or source element
    const selection = this.currentWindow?.getSelection();
    let sourceElement;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      sourceElement = range.commonAncestorContainer;
      if (sourceElement.nodeType === Node.TEXT_NODE) {
        sourceElement = sourceElement.parentElement;
      }
    }

    if (!sourceElement) {
      // Try to find element containing the source text
      const walker = this.currentDocument.createTreeWalker(
        this.currentDocument.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      while (walker.nextNode()) {
        if (walker.currentNode.textContent.includes(sourceText.substring(0, 50))) {
          sourceElement = walker.currentNode.parentElement;
          break;
        }
      }
    }

    if (!sourceElement) {
      console.warn('EPUBAdapter: Could not find source element for summary');
      return { matchCount: 0 };
    }

    // Create dim overlay in parent document
    const parentDoc = document;
    let overlay = parentDoc.getElementById('epub-ac-dim-overlay');
    if (!overlay) {
      overlay = parentDoc.createElement('div');
      overlay.id = 'epub-ac-dim-overlay';
      overlay.className = 'epub-ac-dim-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 20, 0.5);
        z-index: 999990;
        pointer-events: none;
        opacity: 0;
        transition: opacity 400ms ease-out;
      `;
      parentDoc.body.appendChild(overlay);
    }

    // Animate overlay in
    await new Promise(r => setTimeout(r, 50));
    overlay.style.opacity = '1';
    await new Promise(r => setTimeout(r, 400));

    // Wrap words in source element
    const wrapResult = this.wordWrapper.wrapElement(sourceElement, {
      document: this.currentDocument,
    });

    // Parse summary words
    const summaryWords = summaryText.split(/\s+/).filter(w => w.length > 0);
    const vocabLower = vocabularyWords.map(w => w.toLowerCase());

    // Find matching words between source and summary
    const matches = [];
    const usedSourceIds = new Set();

    summaryWords.forEach((summaryWord, index) => {
      const searchWord = summaryWord.toLowerCase().replace(/[.,!?;:'"]/g, '');
      if (searchWord.length < 2) return;

      // Find matching word in source
      for (const wordId of wrapResult.wordIds) {
        if (usedSourceIds.has(wordId)) continue;

        const span = this.currentDocument.getElementById(wordId);
        if (!span) continue;

        const spanText = span.textContent.toLowerCase().replace(/[.,!?;:'"]/g, '');
        if (spanText === searchWord) {
          const isVocab = vocabLower.some(v => v === searchWord);
          matches.push({
            sourceWordId: wordId,
            word: summaryWord,
            summaryIndex: index,
            isVocabulary: isVocab,
            sourcePosition: this._getPositionInParent(span),
          });
          usedSourceIds.add(wordId);
          break;
        }
      }
    });

    // Create summary container in parent document
    const container = this._createSummaryContainer(parentDoc, summaryText, summaryWords, options);
    this.activeEffects.set('summary-container', container);

    // Create clone overlay in parent for flying words
    let cloneOverlay = parentDoc.getElementById('epub-ac-clone-overlay');
    if (!cloneOverlay) {
      cloneOverlay = parentDoc.createElement('div');
      cloneOverlay.id = 'epub-ac-clone-overlay';
      cloneOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
      `;
      parentDoc.body.appendChild(cloneOverlay);
    }

    // Glow source words and dim non-matching
    for (const wordId of wrapResult.wordIds) {
      const span = this.currentDocument.getElementById(wordId);
      if (!span) continue;

      if (usedSourceIds.has(wordId)) {
        const match = matches.find(m => m.sourceWordId === wordId);
        const glowColor = match?.isVocabulary ? '#ffd700' : '#00bfff';
        span.style.textShadow = `0 0 8px ${glowColor}, 0 0 16px ${glowColor}`;
        span.style.color = '#fff';
      } else {
        span.style.opacity = '0.3';
      }
    }

    // Fly matching words to summary
    await this._flyWordsToSummary(parentDoc, cloneOverlay, matches, container, options);

    // Store for cleanup
    this.activeEffects.set('dim-overlay', overlay);
    this.activeEffects.set('clone-overlay', cloneOverlay);
    this.activeEffects.set('wrapped-word-ids', wrapResult.wordIds);

    return { matchCount: matches.length };
  }

  /**
   * Create summary container element
   * @private
   */
  _createSummaryContainer(doc, summaryText, summaryWords, options) {
    const container = doc.createElement('div');
    container.id = 'epub-ac-summary-container';
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
    const header = doc.createElement('div');
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
    const slotsContainer = doc.createElement('div');
    slotsContainer.className = 'epub-ac-summary-slots';
    slotsContainer.style.cssText = `
      font-size: 16px;
      line-height: 1.8;
      color: rgba(255, 255, 255, 0.3);
    `;

    // Create word slots
    summaryWords.forEach((word, i) => {
      const slot = doc.createElement('span');
      slot.id = `epub-ac-slot-${i}`;
      slot.className = 'epub-ac-word-slot';
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
        slotsContainer.appendChild(doc.createTextNode(' '));
      }
    });
    container.appendChild(slotsContainer);

    // Button container (top right)
    const btnContainer = doc.createElement('div');
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
      const saveBtn = doc.createElement('button');
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
          console.error('[EPUBAdapter] Save failed:', error);
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
    const closeBtn = doc.createElement('button');
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

    doc.body.appendChild(container);

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
  async _flyWordsToSummary(doc, cloneOverlay, matches, container, options) {
    const staggerDelay = options.staggerDelay || 60;
    const duration = options.duration || 800;

    // Wait for container to be positioned
    await new Promise(r => setTimeout(r, 100));

    const flights = [];

    for (const match of matches) {
      const slot = doc.getElementById(`epub-ac-slot-${match.summaryIndex}`);
      if (!slot) continue;

      const slotRect = slot.getBoundingClientRect();

      // Create flying clone in parent document
      const clone = doc.createElement('span');
      clone.className = 'epub-ac-flying-word';
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
    const slots = container.querySelectorAll('.epub-ac-word-slot');
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
   * Remove smart summary and restore page
   * @returns {Promise}
   */
  async removeSummary() {
    const parentDoc = document;

    // Fade out summary container
    const container = this.activeEffects.get('summary-container');
    if (container) {
      container.style.opacity = '0';
      container.style.transform = 'translate(-50%, -50%) scale(0.9)';
      await new Promise(r => setTimeout(r, 400));
      container.remove();
      this.activeEffects.delete('summary-container');
    }

    // Remove dim overlay
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

    // Restore wrapped words in iframe
    const wrappedWordIds = this.activeEffects.get('wrapped-word-ids');
    if (wrappedWordIds && this.currentDocument) {
      wrappedWordIds.forEach(wordId => {
        const span = this.currentDocument.getElementById(wordId);
        if (span) {
          span.style.textShadow = '';
          span.style.color = '';
          span.style.opacity = '';
        }
      });
      this.activeEffects.delete('wrapped-word-ids');
    }

    // Restore word wrapper state
    if (this.wordWrapper) {
      this.wordWrapper.restoreAll();
    }
  }

  /**
   * Remove vocabulary highlights
   * @returns {Promise}
   */
  async removeHighlights() {
    for (const [effectId, type] of this.activeEffects) {
      if (type === 'vocabulary-highlight') {
        await this.animationCore.removeEffect(effectId);
        this.activeEffects.delete(effectId);
      }
    }
  }

  /**
   * Remove all active effects
   * @returns {Promise}
   */
  async removeAllEffects() {
    await this._cleanup();
  }

  /**
   * Get the current EPUB document
   * @returns {Document|null}
   */
  getDocument() {
    return this.currentDocument;
  }

  /**
   * Check if adapter is ready
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && this.currentDocument !== null;
  }

  /**
   * Destroy the adapter and clean up
   */
  async destroy() {
    await this._cleanup();

    // Remove event listeners
    if (this.rendition) {
      this.rendition.off('locationChanged', this._handleLocationChange);
      this.rendition.off('rendered', this._handleContentsLoaded);
    }

    // Destroy animation core
    if (this.animationCore) {
      await this.animationCore.destroy();
      this.animationCore = null;
    }

    this.currentDocument = null;
    this.currentWindow = null;
    this.isInitialized = false;
    this.rendition = null;
  }
}

export default EPUBAdapter;
