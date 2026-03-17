/**
 * SmartSummaryEffect - "Word Constellation" Effect
 *
 * Creates a dramatic learning experience:
 * 1. Dims the page (like twilight, not too dark)
 * 2. Source words glow before lifting
 * 3. Words fly along curved paths to form summary
 * 4. Vocabulary words glow with gold color
 * 5. Summary appears in a beautiful floating panel
 *
 * Options:
 * - summary: The summary text or array of words
 * - vocabularyWords: Array of vocabulary words (will glow gold)
 * - dimOpacity: Page dim level (default: 0.4 - lighter)
 * - glowDuration: How long words glow before flying (default: 400ms)
 * - flyDuration: Flight duration (default: 1200ms)
 * - staggerDelay: Delay between words (default: 100ms)
 */

class SmartSummaryEffect {
  constructor(managers, options = {}) {
    this.managers = managers;
    this.options = {
      summary: '',
      vocabularyWords: [],
      dimOpacity: 0.4,
      glowDuration: 400,
      flyDuration: 1200,
      staggerDelay: 100,
      vocabGlowColor: '#ffd700',
      regularGlowColor: '#00bfff',
      ...options
    };

    this.instanceId = null;
    this.isActive = false;
    this.cloneIds = [];
    this.sourceWordIds = new Set();
    this.dimOverlay = null;
    this.summaryContainer = null;

    this.name = 'smartSummary';
    this.category = 'clone-based';
  }

  async apply(sourceElement, options = {}) {
    const opts = { ...this.options, ...options };

    if (!opts.summary) {
      console.warn('SmartSummaryEffect: No summary provided');
      return;
    }

    const source = typeof sourceElement === 'string'
      ? document.querySelector(sourceElement)
      : sourceElement;

    if (!source) {
      console.warn('SmartSummaryEffect: Source element not found');
      return;
    }

    this.isActive = true;

    // Step 1: Dim the page
    await this._dimPage(opts.dimOpacity);

    // Step 2: Wrap words in source
    const wrapResult = this.managers.wordWrapper.wrapElement(source);

    // Step 3: Parse summary into words
    const summaryWords = typeof opts.summary === 'string'
      ? opts.summary.split(/\s+/).filter(w => w.length > 0)
      : opts.summary;

    // Step 4: Find matches
    const matches = this._findMatches(wrapResult.wordIds, summaryWords, opts.vocabularyWords);

    if (matches.length === 0) {
      console.warn('SmartSummaryEffect: No matching words found');
      await this._undimPage();
      return { matchCount: 0 };
    }

    // Step 5: Calculate target layout
    const targetLayout = this.managers.positionManager.calculateTargetLayout(
      matches.map(m => m.word),
      { maxWidth: 450 }
    );

    // Step 6: Create summary container
    this._createSummaryContainer(targetLayout.containerBounds, opts);

    // Step 7: Glow source words
    await this._glowSourceWords(matches, opts);

    // Step 8: Fly words to summary
    await this._flyWordsToSummary(matches, targetLayout, opts);

    return {
      matchCount: matches.length,
      vocabularyUsed: matches.filter(m => m.isVocabulary).length
    };
  }

  async _dimPage(opacity) {
    this.dimOverlay = document.createElement('div');
    this.dimOverlay.id = 'se-dim-overlay';
    this.dimOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 20, ${opacity});
      z-index: 999990;
      opacity: 0;
      transition: opacity 400ms ease-out;
      pointer-events: none;
    `;
    document.body.appendChild(this.dimOverlay);

    await new Promise(r => setTimeout(r, 50));
    this.dimOverlay.style.opacity = '1';
    await new Promise(r => setTimeout(r, 400));
  }

  async _undimPage(duration = 400) {
    if (this.dimOverlay) {
      this.dimOverlay.style.opacity = '0';
      await new Promise(r => setTimeout(r, duration));
      if (this.dimOverlay.parentNode) {
        this.dimOverlay.parentNode.removeChild(this.dimOverlay);
      }
      this.dimOverlay = null;
    }
  }

  async _glowSourceWords(matches, opts) {
    // Inject glow animation
    if (!document.getElementById('se-glow-animation')) {
      const style = document.createElement('style');
      style.id = 'se-glow-animation';
      style.textContent = `
        @keyframes se-glow-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `;
      document.head.appendChild(style);
    }

    // Glow each word with stagger
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const span = document.getElementById(match.sourceWordId);

      if (span) {
        const color = match.isVocabulary ? opts.vocabGlowColor : opts.regularGlowColor;
        span.style.transition = 'all 250ms ease-out';
        span.style.textShadow = `0 0 8px ${color}, 0 0 16px ${color}, 0 0 24px ${color}`;
        span.style.color = '#fff';
        span.style.position = 'relative';
        span.style.zIndex = '999995';
        span.style.display = 'inline-block';
        span.style.animation = 'se-glow-pulse 0.4s ease-out';
      }

      await new Promise(r => setTimeout(r, 30));
    }

    await new Promise(r => setTimeout(r, opts.glowDuration));
  }

  async _flyWordsToSummary(matches, targetLayout, opts) {
    const clones = [];

    // Create all clones
    matches.forEach((match, i) => {
      const sourceSpan = document.getElementById(match.sourceWordId);
      if (!sourceSpan) return;

      const sourceRect = sourceSpan.getBoundingClientRect();
      const cloneData = this.managers.cloneManager.cloneWord(sourceSpan, {
        additionalClass: 'se-flying-word'
      });

      // Style clone
      const color = match.isVocabulary ? opts.vocabGlowColor : opts.regularGlowColor;
      cloneData.element.style.textShadow = `0 0 12px ${color}, 0 0 24px ${color}`;
      cloneData.element.style.color = '#fff';
      cloneData.element.style.fontSize = '18px';
      cloneData.element.style.fontWeight = '600';
      cloneData.element.style.zIndex = '999999';

      clones.push({
        element: cloneData.element,
        cloneId: cloneData.cloneId,
        match,
        fromX: sourceRect.left,
        fromY: sourceRect.top,
        toX: targetLayout.words[i].position.x,
        toY: targetLayout.words[i].position.y
      });

      this.cloneIds.push(cloneData.cloneId);
      this.sourceWordIds.add(match.sourceWordId);

      // Dim source
      sourceSpan.style.opacity = '0.15';
      sourceSpan.style.textShadow = 'none';
    });

    // Animate with stagger
    const promises = clones.map((clone, index) => {
      return new Promise(resolve => {
        setTimeout(() => {
          this._animateCloneFlight(clone, opts.flyDuration, resolve);
        }, index * opts.staggerDelay);
      });
    });

    await Promise.all(promises);
  }

  _animateCloneFlight(clone, duration, onComplete) {
    const el = clone.element;
    const fromX = clone.fromX;
    const fromY = clone.fromY;
    const toX = clone.toX;
    const toY = clone.toY;
    const isVocab = clone.match.isVocabulary;

    // Bezier control point (arc upward)
    const ctrlX = (fromX + toX) / 2;
    const ctrlY = Math.min(fromY, toY) - 80 - Math.random() * 40;

    const startTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const t = 1 - Math.pow(1 - progress, 3);

      // Quadratic bezier curve
      const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * ctrlX + t * t * toX;
      const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * ctrlY + t * t * toY;

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      // Fade glow near end
      if (progress > 0.7) {
        const fadeProgress = (progress - 0.7) / 0.3;
        const glowSize = 12 * (1 - fadeProgress);
        const color = isVocab ? '#ffd700' : '#00bfff';
        el.style.textShadow = `0 0 ${glowSize}px ${color}`;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        el.style.color = isVocab ? '#ffd700' : '#ffffff';
        el.style.textShadow = isVocab ? '0 0 6px #ffd700' : 'none';
        onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  _createSummaryContainer(bounds, opts) {
    this.summaryContainer = document.createElement('div');
    this.summaryContainer.id = 'se-summary-container';
    this.summaryContainer.style.cssText = `
      position: fixed;
      left: ${bounds.x}px;
      top: ${bounds.y}px;
      width: ${bounds.width + 40}px;
      min-height: ${bounds.height + 20}px;
      background: linear-gradient(135deg, rgba(30,35,50,0.98), rgba(20,25,40,0.98));
      border-radius: 20px;
      padding: 28px 32px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.6), 0 0 80px rgba(0,150,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1);
      border: 1px solid rgba(100,150,255,0.2);
      z-index: 999997;
      opacity: 0;
      transform: scale(0.92) translateY(10px);
      transition: all 500ms cubic-bezier(0.16,1,0.3,1);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: rgba(100,180,255,0.7);
      margin-bottom: 16px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    header.textContent = '✨ SMART SUMMARY';
    this.summaryContainer.appendChild(header);

    // Content area
    const content = document.createElement('div');
    content.id = 'se-summary-content';
    content.style.cssText = `
      min-height: 40px;
      font-size: 18px;
      line-height: 1.8;
      color: #ffffff;
      font-weight: 500;
    `;
    this.summaryContainer.appendChild(content);

    document.body.appendChild(this.summaryContainer);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.summaryContainer.style.opacity = '1';
        this.summaryContainer.style.transform = 'scale(1) translateY(0)';
      });
    });
  }

  _findMatches(sourceWordIds, summaryWords, vocabularyWords = []) {
    const matches = [];
    const used = new Set();
    const vocabLower = (vocabularyWords || []).map(w => w.toLowerCase());

    summaryWords.forEach((word, si) => {
      const search = word.toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, '');
      if (!search || search.length < 2) return;

      const isVocabulary = vocabLower.some(v =>
        v === search || search.includes(v) || v.includes(search)
      );

      for (const sid of sourceWordIds) {
        if (used.has(sid)) continue;

        const span = document.getElementById(sid);
        if (!span) continue;

        const spanText = span.textContent.toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, '');

        if (spanText === search) {
          matches.push({
            sourceWordId: sid,
            word,
            summaryIndex: si,
            isVocabulary
          });
          used.add(sid);
          break;
        }
      }
    });

    return matches;
  }

  async remove(options = {}) {
    if (!this.isActive) return;
    const { fadeOutDuration = 400 } = options;

    // Fade clones
    await Promise.all(
      this.cloneIds.map(id =>
        this.managers.cloneManager.fadeOutAndRemove(id, fadeOutDuration)
      )
    );

    // Restore sources
    this.sourceWordIds.forEach(id => {
      const span = document.getElementById(id);
      if (span) {
        span.style.opacity = '';
        span.style.textShadow = '';
        span.style.color = '';
        span.style.animation = '';
        span.style.transform = '';
        span.style.display = '';
      }
    });

    // Fade container
    if (this.summaryContainer) {
      this.summaryContainer.style.opacity = '0';
      this.summaryContainer.style.transform = 'scale(0.92) translateY(10px)';
      await new Promise(r => setTimeout(r, fadeOutDuration));
      if (this.summaryContainer.parentNode) {
        this.summaryContainer.parentNode.removeChild(this.summaryContainer);
      }
      this.summaryContainer = null;
    }

    await this._undimPage(fadeOutDuration);

    this.cloneIds = [];
    this.sourceWordIds.clear();
    this.isActive = false;
  }

  destroy() {
    this.remove({ fadeOutDuration: 0 });
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartSummaryEffect;
} else {
  window.SmartSummaryEffect = SmartSummaryEffect;
}
