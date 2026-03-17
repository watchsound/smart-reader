/**
 * NoteAdapter - Animation adapter for Notes/Leitner views
 *
 * Enables animations when reviewing notes - highlighting key terms,
 * visualizing concepts, and animated transitions between cards.
 *
 * Usage:
 *   const adapter = new NoteAdapter(containerRef);
 *   await adapter.initialize();
 *   await adapter.highlightKeywords(['keyword1', 'keyword2']);
 *   await adapter.revealAnswer();
 *   adapter.destroy();
 *
 * Integration with LeitnerSystem:
 *   const noteAnimations = useRef(null);
 *
 *   useEffect(() => {
 *     noteAnimations.current = new NoteAdapter(cardContainerRef);
 *     noteAnimations.current.initialize();
 *     return () => noteAnimations.current?.destroy();
 *   }, []);
 */

import AnimationCore from '../AnimationCore';

class NoteAdapter {
  constructor(containerRef) {
    this.containerRef = containerRef;
    this.animationCore = null;
    this.isInitialized = false;
    this.activeEffects = new Map();
  }

  /**
   * Get container element
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
    if (this.isInitialized) return true;

    const container = this.container;
    if (!container) {
      console.warn('NoteAdapter: No container provided');
      return false;
    }

    try {
      this.animationCore = new AnimationCore({
        container: container,
        wordClass: 'note-ac-word',
        wordIdPrefix: 'note-ac-word-',
      });

      this._injectStyles();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('NoteAdapter initialization error:', error);
      return false;
    }
  }

  /**
   * Inject required CSS
   * @private
   */
  _injectStyles() {
    if (document.getElementById('note-ac-styles')) return;

    const style = document.createElement('style');
    style.id = 'note-ac-styles';
    style.textContent = `
      .note-ac-word {
        display: inline;
        position: relative;
      }

      .note-ac-keyword-highlight {
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 165, 0, 0.3));
        border-radius: 3px;
        padding: 0 3px;
        transition: all 300ms ease-out;
      }

      .note-ac-keyword-highlight:hover {
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.5), rgba(255, 165, 0, 0.5));
        transform: scale(1.05);
      }

      .note-ac-concept-glow {
        text-shadow: 0 0 8px #00bfff, 0 0 16px #00bfff;
        color: #fff;
        transition: all 300ms ease-out;
      }

      .note-ac-reveal-blur {
        filter: blur(4px);
        opacity: 0.3;
        user-select: none;
        transition: all 400ms ease-out;
      }

      .note-ac-reveal-visible {
        filter: blur(0);
        opacity: 1;
        transition: all 400ms ease-out;
      }

      #note-ac-clone-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
      }

      @keyframes note-ac-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      @keyframes note-ac-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }

      @keyframes note-ac-celebrate {
        0% { transform: scale(1) rotate(0deg); }
        25% { transform: scale(1.1) rotate(-3deg); }
        50% { transform: scale(1.15) rotate(3deg); }
        75% { transform: scale(1.1) rotate(-3deg); }
        100% { transform: scale(1) rotate(0deg); }
      }

      @keyframes note-ac-confetti {
        0% { opacity: 1; transform: translateY(0) rotate(0deg); }
        100% { opacity: 0; transform: translateY(-100px) rotate(720deg); }
      }

      .note-ac-confetti-particle {
        position: fixed;
        pointer-events: none;
        z-index: 999999;
        animation: note-ac-confetti 1s ease-out forwards;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Clean up effects
   * @private
   */
  async _cleanup() {
    if (this.animationCore) {
      await this.animationCore.removeAllEffects();
      this.animationCore.restoreAll();
    }

    // Remove highlight classes
    document.querySelectorAll('.note-ac-keyword-highlight, .note-ac-concept-glow').forEach((el) => {
      el.classList.remove('note-ac-keyword-highlight', 'note-ac-concept-glow');
    });

    // Remove confetti
    document.querySelectorAll('.note-ac-confetti-particle').forEach((el) => el.remove());

    this.activeEffects.clear();
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Highlight keywords in a note card
   * @param {string[]} keywords - Keywords to highlight
   * @param {Object} options
   * @returns {Promise}
   */
  async highlightKeywords(keywords, options = {}) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return { wordCount: 0 };
    }

    const container = options.element || this.container;
    if (!container) return { wordCount: 0 };

    // Wrap words in the container
    const wrapResult = this.animationCore.wrapElement(container);
    if (!wrapResult.wordCount) return { wordCount: 0 };

    const keywordsLower = keywords.map((k) => k.toLowerCase());
    let matchCount = 0;

    // Find and highlight matching words
    wrapResult.wordIds.forEach((wordId) => {
      const span = document.getElementById(wordId);
      if (!span) return;

      const text = span.textContent.toLowerCase().replace(/[.,!?;:'"]/g, '');

      const isKeyword = keywordsLower.some(
        (keyword) =>
          text === keyword.replace(/[.,!?;:'"]/g, '') ||
          keyword.includes(text) ||
          text.includes(keyword)
      );

      if (isKeyword) {
        span.classList.add('note-ac-keyword-highlight');
        matchCount++;
      }
    });

    return { wordCount: matchCount };
  }

  /**
   * Apply glow effect to concept terms
   * @param {string[]} concepts
   * @param {Object} options
   * @returns {Promise}
   */
  async glowConcepts(concepts, options = {}) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return { wordCount: 0 };
    }

    const container = options.element || this.container;
    if (!container) return { wordCount: 0 };

    const result = await this.animationCore.glowWords(concepts, {
      element: container,
      color: options.color || '#00bfff',
      ...options,
    });

    return result;
  }

  /**
   * Blur/reveal effect for flashcard answers
   * @param {HTMLElement} answerElement - Element containing the answer
   * @param {boolean} reveal - True to reveal, false to blur
   * @param {Object} options
   * @returns {Promise}
   */
  async setAnswerVisibility(answerElement, reveal, options = {}) {
    if (!answerElement) return;

    if (reveal) {
      answerElement.classList.remove('note-ac-reveal-blur');
      answerElement.classList.add('note-ac-reveal-visible');
    } else {
      answerElement.classList.add('note-ac-reveal-blur');
      answerElement.classList.remove('note-ac-reveal-visible');
    }

    // Wait for animation
    await new Promise((r) => setTimeout(r, 400));
  }

  /**
   * Animate correct answer feedback
   * @param {HTMLElement} cardElement
   * @param {Object} options
   * @returns {Promise}
   */
  async animateCorrect(cardElement, options = {}) {
    if (!cardElement) return;

    const { showConfetti = true, duration = 600 } = options;

    // Celebrate animation
    cardElement.style.animation = `note-ac-celebrate ${duration}ms ease-out`;

    // Flash green
    const originalBg = cardElement.style.backgroundColor;
    cardElement.style.transition = 'background-color 200ms ease-out';
    cardElement.style.backgroundColor = 'rgba(46, 183, 125, 0.2)';

    if (showConfetti) {
      this._createConfetti(cardElement);
    }

    await new Promise((r) => setTimeout(r, duration));

    cardElement.style.animation = '';
    cardElement.style.backgroundColor = originalBg;
  }

  /**
   * Animate incorrect answer feedback
   * @param {HTMLElement} cardElement
   * @param {Object} options
   * @returns {Promise}
   */
  async animateIncorrect(cardElement, options = {}) {
    if (!cardElement) return;

    const { duration = 400 } = options;

    // Shake animation
    cardElement.style.animation = `note-ac-shake ${duration}ms ease-out`;

    // Flash red
    const originalBg = cardElement.style.backgroundColor;
    cardElement.style.transition = 'background-color 200ms ease-out';
    cardElement.style.backgroundColor = 'rgba(255, 82, 82, 0.2)';

    await new Promise((r) => setTimeout(r, duration));

    cardElement.style.animation = '';
    cardElement.style.backgroundColor = originalBg;
  }

  /**
   * Create confetti particles
   * @private
   */
  _createConfetti(centerElement) {
    const rect = centerElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const colors = ['#ffd700', '#00bfff', '#ff6b6b', '#2ecc71', '#9b59b6'];

    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'note-ac-confetti-particle';

      // Random position spread
      const angle = (Math.random() * Math.PI * 2);
      const distance = 20 + Math.random() * 60;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;

      particle.style.cssText = `
        left: ${x}px;
        top: ${y}px;
        width: ${4 + Math.random() * 4}px;
        height: ${4 + Math.random() * 4}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      `;

      document.body.appendChild(particle);

      // Remove after animation
      setTimeout(() => particle.remove(), 1000);
    }
  }

  /**
   * Animate card transition (Leitner box change)
   * @param {HTMLElement} cardElement
   * @param {number} fromBox
   * @param {number} toBox
   * @param {Object} options
   * @returns {Promise}
   */
  async animateBoxTransition(cardElement, fromBox, toBox, options = {}) {
    if (!cardElement) return;

    const { duration = 800 } = options;
    const isPromotion = toBox > fromBox;

    // Start state
    cardElement.style.transition = 'none';
    cardElement.style.transform = 'scale(1)';
    cardElement.style.opacity = '1';

    // Animate based on direction
    await new Promise((r) => setTimeout(r, 50));

    cardElement.style.transition = `all ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;

    if (isPromotion) {
      // Promotion - slide up and scale up
      cardElement.style.transform = 'scale(1.1) translateY(-20px)';
      cardElement.style.boxShadow = '0 10px 40px rgba(46, 183, 125, 0.3)';
    } else {
      // Demotion - slide down and shrink
      cardElement.style.transform = 'scale(0.95) translateY(20px)';
      cardElement.style.boxShadow = '0 10px 40px rgba(255, 82, 82, 0.3)';
    }

    await new Promise((r) => setTimeout(r, duration / 2));

    // Return to normal
    cardElement.style.transform = 'scale(1) translateY(0)';
    cardElement.style.boxShadow = '';

    await new Promise((r) => setTimeout(r, duration / 2));

    cardElement.style.transition = '';
  }

  /**
   * Remove keyword highlights
   */
  removeHighlights() {
    document.querySelectorAll('.note-ac-keyword-highlight').forEach((el) => {
      el.classList.remove('note-ac-keyword-highlight');
    });
    this.animationCore?.restoreAll();
  }

  /**
   * Remove all effects
   */
  async removeAllEffects() {
    await this._cleanup();
  }

  /**
   * Check if ready
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Destroy adapter
   */
  async destroy() {
    await this._cleanup();

    if (this.animationCore) {
      await this.animationCore.destroy();
      this.animationCore = null;
    }

    this.isInitialized = false;
  }
}

export default NoteAdapter;
