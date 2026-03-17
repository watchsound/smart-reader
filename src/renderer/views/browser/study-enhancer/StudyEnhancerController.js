/**
 * StudyEnhancerController - Renderer-side controller for StudyEnhancer
 *
 * This controller manages:
 * - Injecting the StudyEnhancer bundle into webview
 * - Sending commands to webview
 * - Receiving events from webview
 * - Coordinating with AI providers for content analysis
 */

class StudyEnhancerController {
  constructor(webviewRef) {
    this.webviewRef = webviewRef;
    this.isInjected = false;
    this.eventListeners = new Map();
    this.pendingCommands = [];

    // Bind methods
    this._handleMessage = this._handleMessage.bind(this);
    this._handleNavigation = this._handleNavigation.bind(this);

    // Listen for navigation events to reset injection state
    this._setupNavigationListener();
  }

  /**
   * Setup listener for navigation events to reset injection state
   * @private
   */
  _setupNavigationListener() {
    if (this._navigationListenerSetup) return;

    const webview = this.webview;
    if (webview) {
      webview.addEventListener('did-navigate', this._handleNavigation);
      webview.addEventListener('did-navigate-in-page', this._handleNavigation);
      this._navigationListenerSetup = true;
    }
  }

  /**
   * Handle navigation - reset injection state
   * @private
   */
  _handleNavigation() {
    this.isInjected = false;
  }

  /**
   * Get the webview element
   * @private
   */
  get webview() {
    return this.webviewRef?.current || this.webviewRef;
  }

  /**
   * Inject StudyEnhancer into webview
   * @returns {Promise<boolean>}
   */
  async inject() {
    if (this.isInjected) {
      console.log('StudyEnhancerController: Already injected');
      return true;
    }

    const webview = this.webview;
    if (!webview) {
      console.warn('StudyEnhancerController: No webview available');
      return false;
    }

    try {
      console.log('StudyEnhancerController: Injecting...');

      // Get the bundle script
      const script = await this._getBundleScript();

      // Execute in webview
      await webview.executeJavaScript(script);

      // Setup message listener
      webview.addEventListener('ipc-message', this._handleMessage);

      // Setup navigation listener (in case it wasn't set up in constructor)
      this._setupNavigationListener();

      this.isInjected = true;

      // Execute any pending commands
      while (this.pendingCommands.length > 0) {
        const { command, resolve, reject } = this.pendingCommands.shift();
        this._executeCommand(command).then(resolve).catch(reject);
      }

      return true;
    } catch (error) {
      console.error('StudyEnhancerController: Injection failed:', error);
      return false;
    }
  }

  /**
   * Get the bundle script to inject
   * @private
   */
  async _getBundleScript() {
    // For development, we concatenate the scripts
    // In production, this should be a pre-bundled file

    // The scripts need to be loaded in order due to dependencies
    const scripts = [
      'WordWrapper',
      'PositionManager',
      'CloneManager',
      'AnimationEngine',
      'EffectRegistry',
      'effects/BaseEffect',
      'effects/BaseCloneEffect',
      'effects/HighlightEffect',
      'effects/FadeInEffect',
      'effects/FlyingAbstractEffect',
      'index'
    ];

    // In a real implementation, we'd bundle these at build time
    // For now, we'll inline a minimal version or load from files

    // Return the main bundle (assuming it's pre-bundled)
    return this._getInlinedBundle();
  }

  /**
   * Get inlined bundle script
   * This is a simplified version - in production, use webpack to bundle
   * @private
   */
  _getInlinedBundle() {
    // This returns the concatenated scripts as a string
    // In production, this would be read from a bundled file
    return `
      // StudyEnhancer Bundle - Auto-generated
      // This is injected into the webview context

      if (typeof window.studyEnhancer === 'undefined') {
        ${this._getWordWrapperCode()}
        ${this._getPositionManagerCode()}
        ${this._getCloneManagerCode()}
        ${this._getAnimationEngineCode()}
        ${this._getEffectRegistryCode()}
        ${this._getEffectsCode()}
        ${this._getMainCode()}
      }
    `;
  }

  // These methods return the actual code strings
  // In a real implementation, these would be loaded from the bundled files

  _getWordWrapperCode() {
    return `
      class WordWrapper {
        constructor(options = {}) {
          this.wordClass = options.wordClass || 'se-word';
          this.wordIdPrefix = options.wordIdPrefix || 'se-word-';
          this.wordCounter = 0;
          this.wrappedElements = new Map();
          this.wordMap = new Map();
        }

        wrapElement(element, options = {}) {
          const excludeTags = options.excludeTags || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS'];
          if (!this.wrappedElements.has(element)) {
            this.wrappedElements.set(element, element.innerHTML);
          }
          const textNodes = this._collectTextNodes(element, excludeTags);
          const wordIds = [];
          textNodes.forEach(textNode => {
            const wrappedIds = this._wrapTextNode(textNode);
            wordIds.push(...wrappedIds);
          });
          return { wordCount: wordIds.length, wordIds };
        }

        wrapAllParagraphs() {
          const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote');
          let totalWords = 0;
          elements.forEach(element => {
            const result = this.wrapElement(element);
            totalWords += result.wordCount;
          });
          return { totalWords };
        }

        getWord(wordId) {
          const entry = this.wordMap.get(wordId);
          return entry ? entry.span : null;
        }

        getAllWords() { return this.wordMap; }

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

        restoreAll() {
          this.wrappedElements.forEach((original, element) => {
            if (element && element.parentNode) element.innerHTML = original;
          });
          this.wrappedElements.clear();
          this.wordMap.clear();
          this.wordCounter = 0;
        }

        _collectTextNodes(element, excludeTags) {
          const textNodes = [];
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
              if (!node.nodeValue || node.nodeValue.trim() === '') return NodeFilter.FILTER_REJECT;
              let parent = node.parentNode;
              while (parent && parent !== element) {
                if (excludeTags.includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
                if (parent.classList && parent.classList.contains(this.wordClass)) return NodeFilter.FILTER_REJECT;
                parent = parent.parentNode;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          });
          let node;
          while ((node = walker.nextNode())) textNodes.push(node);
          return textNodes;
        }

        _wrapTextNode(textNode) {
          const text = textNode.nodeValue;
          const parentElement = textNode.parentNode;
          const parts = text.split(/(\\s+)/);
          const fragment = document.createDocumentFragment();
          const wordIds = [];

          parts.forEach(part => {
            if (part.trim() === '') {
              fragment.appendChild(document.createTextNode(part));
            } else {
              const wordId = this.wordIdPrefix + this.wordCounter++;
              const span = document.createElement('span');
              span.className = this.wordClass;
              span.id = wordId;
              span.textContent = part;
              span.dataset.originalText = part;
              fragment.appendChild(span);
              wordIds.push(wordId);
              this.wordMap.set(wordId, { span, text: part, parentElement });
            }
          });

          parentElement.replaceChild(fragment, textNode);
          return wordIds;
        }
      }
      window.WordWrapper = WordWrapper;
    `;
  }

  _getPositionManagerCode() {
    return `
      class PositionManager {
        constructor() {
          this.positionCache = new Map();
        }

        capturePosition(wordSpan) {
          const rect = wordSpan.getBoundingClientRect();
          return {
            viewport: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
            center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            styles: {
              fontSize: window.getComputedStyle(wordSpan).fontSize,
              fontFamily: window.getComputedStyle(wordSpan).fontFamily,
              color: window.getComputedStyle(wordSpan).color
            }
          };
        }

        calculateTargetLayout(words, options = {}) {
          const { maxWidth = 400, position = 'center', fontSize = '16px', padding = 20 } = options;
          const container = document.createElement('div');
          container.style.cssText = 'position:fixed;visibility:hidden;max-width:'+maxWidth+'px;font-size:'+fontSize+';padding:'+padding+'px;left:50%;top:50%;transform:translate(-50%,-50%);';

          const wordSpans = [];
          words.forEach((word, i) => {
            const span = document.createElement('span');
            span.textContent = word;
            container.appendChild(span);
            if (i < words.length - 1) container.appendChild(document.createTextNode(' '));
            wordSpans.push(span);
          });

          document.body.appendChild(container);
          const layout = wordSpans.map((span, i) => {
            const rect = span.getBoundingClientRect();
            return { word: words[i], index: i, position: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } };
          });
          const bounds = container.getBoundingClientRect();
          document.body.removeChild(container);

          return { words: layout, containerBounds: { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height } };
        }

        getViewportDimensions() {
          return { width: window.innerWidth, height: window.innerHeight };
        }
      }
      window.PositionManager = PositionManager;
    `;
  }

  _getCloneManagerCode() {
    return `
      class CloneManager {
        constructor() {
          this.overlayId = 'se-clone-overlay';
          this.cloneClass = 'se-clone';
          this.cloneCounter = 0;
          this.clones = new Map();
          this.sourceToClones = new Map();
          this._ensureOverlay();
        }

        _ensureOverlay() {
          this.overlay = document.getElementById(this.overlayId);
          if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = this.overlayId;
            this.overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999999;';
            document.body.appendChild(this.overlay);
          }
        }

        cloneWord(sourceSpan, options = {}) {
          this._ensureOverlay();
          const rect = sourceSpan.getBoundingClientRect();
          const cloneId = 'se-clone-' + this.cloneCounter++;
          const clone = document.createElement('span');
          clone.id = cloneId;
          clone.className = this.cloneClass + ' ' + (options.additionalClass || '');
          clone.textContent = sourceSpan.textContent;
          clone.dataset.sourceId = sourceSpan.id;
          clone.style.cssText = 'position:fixed;left:'+rect.left+'px;top:'+rect.top+'px;width:'+rect.width+'px;height:'+rect.height+'px;margin:0;padding:0;pointer-events:none;will-change:transform,opacity;';

          const cs = window.getComputedStyle(sourceSpan);
          clone.style.fontSize = cs.fontSize;
          clone.style.fontFamily = cs.fontFamily;
          clone.style.color = cs.color;

          this.overlay.appendChild(clone);
          this.clones.set(cloneId, { element: clone, sourceId: sourceSpan.id, sourceSpan, initialPosition: { x: rect.left, y: rect.top } });
          if (!this.sourceToClones.has(sourceSpan.id)) this.sourceToClones.set(sourceSpan.id, []);
          this.sourceToClones.get(sourceSpan.id).push(cloneId);

          return { cloneId, element: clone, position: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } };
        }

        cloneWords(sourceSpans, options = {}) {
          return Array.from(sourceSpans).map(span => this.cloneWord(span, options));
        }

        getClone(cloneId) { return this.clones.get(cloneId) || null; }

        removeClone(cloneId) {
          const data = this.clones.get(cloneId);
          if (data) {
            if (data.element.parentNode) data.element.parentNode.removeChild(data.element);
            this.clones.delete(cloneId);
          }
        }

        removeAllClones() {
          this.clones.forEach((data) => { if (data.element.parentNode) data.element.parentNode.removeChild(data.element); });
          this.clones.clear();
          this.sourceToClones.clear();
        }

        fadeOutAndRemove(cloneId, duration = 300) {
          return new Promise(resolve => {
            const data = this.clones.get(cloneId);
            if (!data) { resolve(); return; }
            data.element.style.transition = 'opacity '+duration+'ms ease-out';
            data.element.style.opacity = '0';
            setTimeout(() => { this.removeClone(cloneId); resolve(); }, duration);
          });
        }

        dimSource(sourceId, opacity = 0.3) {
          const span = document.getElementById(sourceId);
          if (span) { span.dataset.originalOpacity = span.style.opacity || '1'; span.style.opacity = opacity; }
        }

        restoreSource(sourceId) {
          const span = document.getElementById(sourceId);
          if (span && span.dataset.originalOpacity) { span.style.opacity = span.dataset.originalOpacity; delete span.dataset.originalOpacity; }
        }

        restoreAllSources() {
          this.sourceToClones.forEach((_, id) => this.restoreSource(id));
        }

        destroy() {
          this.restoreAllSources();
          this.removeAllClones();
          if (this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
        }
      }
      window.CloneManager = CloneManager;
    `;
  }

  _getAnimationEngineCode() {
    return `
      class AnimationEngine {
        constructor() {
          this.activeAnimations = new Map();
          this.easings = {
            linear: t => t,
            easeOut: t => t * (2 - t),
            easeOutCubic: t => (--t) * t * t + 1,
            easeOutBack: t => { const c = 1.70158; return 1 + (c+1) * Math.pow(t-1,3) + c * Math.pow(t-1,2); }
          };
        }

        fly(element, from, to, options = {}) {
          const { duration = 800, easing = 'easeOutCubic', delay = 0 } = options;
          return new Promise(resolve => {
            const startTime = performance.now() + delay;
            const easingFunc = this.easings[easing] || this.easings.easeOutCubic;

            const animate = (currentTime) => {
              if (currentTime < startTime) { requestAnimationFrame(animate); return; }
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = easingFunc(progress);

              element.style.left = (from.x + (to.x - from.x) * eased) + 'px';
              element.style.top = (from.y + (to.y - from.y) * eased) + 'px';

              if (progress < 1) requestAnimationFrame(animate);
              else resolve();
            };
            requestAnimationFrame(animate);
          });
        }

        flyMultiple(flights, staggerOptions = {}) {
          const { staggerDelay = 50 } = staggerOptions;
          return Promise.all(flights.map((f, i) => {
            const opts = { ...f.options, delay: (f.options?.delay || 0) + i * staggerDelay };
            return this.fly(f.element, f.from, f.to, opts);
          }));
        }

        pulse(element, options = {}) {
          const { scale = 1.2, duration = 300 } = options;
          return new Promise(resolve => {
            element.style.transition = 'transform '+(duration/2)+'ms ease-out';
            element.style.transform = 'scale('+scale+')';
            setTimeout(() => {
              element.style.transform = 'scale(1)';
              setTimeout(resolve, duration/2);
            }, duration/2);
          });
        }
      }
      window.AnimationEngine = AnimationEngine;
    `;
  }

  _getEffectRegistryCode() {
    return `
      class EffectRegistry {
        constructor() {
          this.effects = new Map();
          this.activeEffects = new Map();
          this.instanceCounter = 0;
        }

        register(name, EffectClass, metadata = {}) {
          this.effects.set(name, { EffectClass, metadata: { name, ...metadata } });
        }

        hasEffect(name) { return this.effects.has(name); }

        createInstance(name, managers, options = {}) {
          const entry = this.effects.get(name);
          if (!entry) throw new Error('Effect "'+name+'" not registered');
          const instanceId = name + '-' + this.instanceCounter++;
          const effect = new entry.EffectClass(managers, options);
          effect.instanceId = instanceId;
          this.activeEffects.set(instanceId, effect);
          return { instanceId, effect };
        }

        getInstance(id) { return this.activeEffects.get(id) || null; }

        removeInstance(id) {
          const effect = this.activeEffects.get(id);
          if (effect && effect.destroy) effect.destroy();
          this.activeEffects.delete(id);
        }

        removeAllInstances() {
          this.activeEffects.forEach(e => { if (e.destroy) e.destroy(); });
          this.activeEffects.clear();
        }

        getActiveEffects() { return this.activeEffects; }
        listEffects() { return Array.from(this.effects.entries()).map(([name, e]) => ({ name, metadata: e.metadata })); }
      }
      window.EffectRegistry = EffectRegistry;
    `;
  }

  _getEffectsCode() {
    return `
      // HighlightEffect
      class HighlightEffect {
        constructor(managers, options = {}) {
          this.managers = managers;
          this.options = { color: 'rgba(255,255,0,0.4)', duration: 300, ...options };
          this.affectedWords = new Set();
          this.isActive = false;
        }

        async apply(target, options = {}) {
          const spans = this._resolve(target);
          if (!spans.length) return;
          this.isActive = true;
          const opts = { ...this.options, ...options };

          spans.forEach((span, i) => {
            this.affectedWords.add(span.id);
            span.dataset.seOrigBg = span.style.backgroundColor || '';
            span.style.transition = 'background-color '+opts.duration+'ms ease-out';
            setTimeout(() => { span.style.backgroundColor = opts.color; }, i * 20);
          });

          return new Promise(r => setTimeout(r, opts.duration + spans.length * 20));
        }

        async remove() {
          if (!this.isActive) return;
          this.affectedWords.forEach(id => {
            const span = document.getElementById(id);
            if (span) { span.style.backgroundColor = span.dataset.seOrigBg || ''; delete span.dataset.seOrigBg; }
          });
          this.affectedWords.clear();
          this.isActive = false;
        }

        destroy() { this.remove(); }

        _resolve(target) {
          if (typeof target === 'string') {
            const el = document.getElementById(target);
            return el ? [el] : Array.from(document.querySelectorAll(target));
          }
          if (Array.isArray(target)) return target.map(id => typeof id === 'string' ? document.getElementById(id) : id).filter(Boolean);
          if (target instanceof NodeList) return Array.from(target);
          if (target instanceof HTMLElement) return [target];
          return [];
        }
      }
      window.HighlightEffect = HighlightEffect;

      // FadeInEffect
      class FadeInEffect {
        constructor(managers, options = {}) {
          this.managers = managers;
          this.options = { duration: 500, staggerDelay: 50, slideUp: false, ...options };
          this.affectedWords = new Set();
          this.isActive = false;
        }

        async apply(target, options = {}) {
          const spans = this._resolve(target);
          if (!spans.length) return;
          this.isActive = true;
          const opts = { ...this.options, ...options };

          spans.forEach(span => {
            this.affectedWords.add(span.id);
            span.style.opacity = '0';
            span.style.display = 'inline-block';
            if (opts.slideUp) span.style.transform = 'translateY(10px)';
          });

          spans[0]?.offsetHeight;

          return Promise.all(spans.map((span, i) => new Promise(resolve => {
            setTimeout(() => {
              span.style.transition = 'opacity '+opts.duration+'ms ease-out, transform '+opts.duration+'ms ease-out';
              span.style.opacity = '1';
              if (opts.slideUp) span.style.transform = 'translateY(0)';
              setTimeout(resolve, opts.duration);
            }, i * opts.staggerDelay);
          })));
        }

        async remove() {
          this.affectedWords.forEach(id => {
            const span = document.getElementById(id);
            if (span) { span.style.opacity = ''; span.style.transform = ''; span.style.display = ''; }
          });
          this.affectedWords.clear();
          this.isActive = false;
        }

        destroy() { this.remove(); }
        _resolve(target) { /* same as HighlightEffect */ return HighlightEffect.prototype._resolve.call(this, target); }
      }
      window.FadeInEffect = FadeInEffect;

      // FlyingAbstractEffect
      class FlyingAbstractEffect {
        constructor(managers, options = {}) {
          this.managers = managers;
          this.options = { abstract: '', duration: 800, staggerDelay: 50, dimSource: true, dimOpacity: 0.3, ...options };
          this.cloneIds = [];
          this.sourceWordIds = new Set();
          this.abstractContainer = null;
          this.isActive = false;
        }

        async apply(sourceElement, options = {}) {
          const opts = { ...this.options, ...options };
          if (!opts.abstract) return;

          const source = typeof sourceElement === 'string' ? document.querySelector(sourceElement) : sourceElement;
          if (!source) return;

          this.isActive = true;
          const wrapResult = this.managers.wordWrapper.wrapElement(source);
          const abstractWords = typeof opts.abstract === 'string' ? opts.abstract.split(/\\s+/).filter(w => w) : opts.abstract;
          const matches = this._findMatches(wrapResult.wordIds, abstractWords);
          if (!matches.length) return;

          const targetLayout = this.managers.positionManager.calculateTargetLayout(matches.map(m => m.abstractWord), { maxWidth: 500 });

          // Create container
          this.abstractContainer = document.createElement('div');
          this.abstractContainer.style.cssText = 'position:fixed;left:'+targetLayout.containerBounds.x+'px;top:'+targetLayout.containerBounds.y+'px;width:'+targetLayout.containerBounds.width+'px;min-height:'+targetLayout.containerBounds.height+'px;background:rgba(255,255,255,0.95);border-radius:8px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:999998;opacity:0;transition:opacity 300ms;';
          document.body.appendChild(this.abstractContainer);
          requestAnimationFrame(() => { this.abstractContainer.style.opacity = '1'; });

          const clones = [];
          matches.forEach((match, i) => {
            const sourceSpan = document.getElementById(match.sourceWordId);
            if (!sourceSpan) return;
            const cloneData = this.managers.cloneManager.cloneWord(sourceSpan, { additionalClass: 'se-flying-word' });
            clones.push({ ...cloneData, match, targetPosition: targetLayout.words[i].position });
            this.cloneIds.push(cloneData.cloneId);
            this.sourceWordIds.add(match.sourceWordId);
            if (opts.dimSource) this.managers.cloneManager.dimSource(match.sourceWordId, opts.dimOpacity);
          });

          const flights = clones.map(c => ({
            element: c.element,
            from: { x: c.position.x, y: c.position.y },
            to: { x: c.targetPosition.x, y: c.targetPosition.y },
            options: { duration: opts.duration, easing: 'easeOutCubic' }
          }));

          await this.managers.animationEngine.flyMultiple(flights, { staggerDelay: opts.staggerDelay });
          return { matchCount: matches.length };
        }

        async remove(options = {}) {
          if (!this.isActive) return;
          const { fadeOutDuration = 300 } = options;

          await Promise.all(this.cloneIds.map(id => this.managers.cloneManager.fadeOutAndRemove(id, fadeOutDuration)));
          this.sourceWordIds.forEach(id => this.managers.cloneManager.restoreSource(id));

          if (this.abstractContainer) {
            this.abstractContainer.style.opacity = '0';
            await new Promise(r => setTimeout(r, fadeOutDuration));
            if (this.abstractContainer.parentNode) this.abstractContainer.parentNode.removeChild(this.abstractContainer);
            this.abstractContainer = null;
          }

          this.cloneIds = [];
          this.sourceWordIds.clear();
          this.isActive = false;
        }

        destroy() { this.remove({ fadeOutDuration: 0 }); }

        _findMatches(sourceWordIds, abstractWords) {
          const matches = [];
          const used = new Set();
          const abstractLower = abstractWords.map(w => w.toLowerCase().replace(/[.,!?;:'"]/g, ''));

          abstractWords.forEach((aw, ai) => {
            const search = abstractLower[ai];
            if (!search) return;
            for (const sid of sourceWordIds) {
              if (used.has(sid)) continue;
              const span = document.getElementById(sid);
              if (!span) continue;
              const st = span.textContent.toLowerCase().replace(/[.,!?;:'"]/g, '');
              if (st === search) {
                matches.push({ sourceWordId: sid, abstractWord: aw, abstractIndex: ai });
                used.add(sid);
                break;
              }
            }
          });
          return matches;
        }
      }
      window.FlyingAbstractEffect = FlyingAbstractEffect;

      // SmartSummaryEffect - Word Constellation
      class SmartSummaryEffect {
        constructor(managers, options = {}) {
          this.managers = managers;
          this.options = {
            summary: '', vocabularyWords: [], dimOpacity: 0.4, glowDuration: 400,
            flyDuration: 1200, staggerDelay: 100, vocabGlowColor: '#ffd700',
            regularGlowColor: '#00bfff', ...options
          };
          this.cloneIds = [];
          this.sourceWordIds = new Set();
          this.dimOverlay = null;
          this.summaryContainer = null;
          this.isActive = false;
        }

        async apply(sourceElement, options = {}) {
          const opts = { ...this.options, ...options };
          if (!opts.summary) { console.log('SmartSummary: No summary provided'); return; }

          const source = typeof sourceElement === 'string' ? document.querySelector(sourceElement) : sourceElement;
          if (!source) { console.log('SmartSummary: Source element not found:', sourceElement); return; }

          console.log('SmartSummary: Starting effect with summary:', opts.summary);
          this.isActive = true;

          // Dim page (lighter dimming)
          await this._dimPage(opts.dimOpacity);

          // Wrap words
          const wrapResult = this.managers.wordWrapper.wrapElement(source);
          console.log('SmartSummary: Wrapped', wrapResult.wordCount, 'words');

          const summaryWords = typeof opts.summary === 'string' ? opts.summary.split(/\\s+/).filter(w => w.length > 0) : opts.summary;
          console.log('SmartSummary: Summary words:', summaryWords);

          const matches = this._findMatches(wrapResult.wordIds, summaryWords, opts.vocabularyWords || []);
          console.log('SmartSummary: Found', matches.length, 'matches');

          if (!matches.length) {
            console.log('SmartSummary: No matches found, undimming');
            await this._undimPage();
            return { matchCount: 0 };
          }

          // Build the summary display with placeholders for flying words
          // matchedIndices tracks which summary words will be flown (have matching source words)
          const matchedIndices = new Set(matches.map(m => m.summaryIndex));

          // Create summary container with word slots
          // Words that have matches get placeholder spans, words without matches are rendered directly
          this._createSummaryContainerWithSlots(summaryWords, matchedIndices, opts);

          // Glow source words briefly
          await this._glowSourceWords(matches, opts);

          // Create clones and fly them to their placeholder slots
          await this._flyWordsToSlots(matches, opts);

          return { matchCount: matches.length, vocabularyUsed: matches.filter(m => m.isVocabulary).length };
        }

        async _dimPage(opacity) {
          this.dimOverlay = document.createElement('div');
          this.dimOverlay.id = 'se-dim-overlay';
          this.dimOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,20,'+opacity+');z-index:999990;opacity:0;transition:opacity 400ms ease-out;pointer-events:none;';
          document.body.appendChild(this.dimOverlay);
          await new Promise(r => setTimeout(r, 50));
          this.dimOverlay.style.opacity = '1';
          await new Promise(r => setTimeout(r, 400));
        }

        async _undimPage(duration = 400) {
          if (this.dimOverlay) {
            this.dimOverlay.style.opacity = '0';
            await new Promise(r => setTimeout(r, duration));
            if (this.dimOverlay.parentNode) this.dimOverlay.parentNode.removeChild(this.dimOverlay);
            this.dimOverlay = null;
          }
        }

        async _glowSourceWords(matches, opts) {
          if (!document.getElementById('se-glow-animation')) {
            const style = document.createElement('style');
            style.id = 'se-glow-animation';
            style.textContent = '@keyframes se-glow-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}';
            document.head.appendChild(style);
          }

          // Glow all matched words with stagger
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const span = document.getElementById(match.sourceWordId);
            if (span) {
              const color = match.isVocabulary ? opts.vocabGlowColor : opts.regularGlowColor;
              span.style.transition = 'all 250ms ease-out';
              span.style.textShadow = '0 0 8px '+color+',0 0 16px '+color+',0 0 24px '+color;
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

        async _flyWordsToSlots(matches, opts) {
          const clones = [];

          // Create all clones first
          matches.forEach((match) => {
            const sourceSpan = document.getElementById(match.sourceWordId);
            const targetSlot = document.getElementById('se-slot-' + match.summaryIndex);
            if (!sourceSpan || !targetSlot) return;

            // Get positions
            const sourceRect = sourceSpan.getBoundingClientRect();
            const targetRect = targetSlot.getBoundingClientRect();

            const cloneData = this.managers.cloneManager.cloneWord(sourceSpan, { additionalClass: 'se-flying-word' });

            // Style the clone
            const color = match.isVocabulary ? opts.vocabGlowColor : opts.regularGlowColor;
            cloneData.element.style.textShadow = '0 0 12px '+color+',0 0 24px '+color;
            cloneData.element.style.color = '#fff';
            cloneData.element.style.fontSize = '18px';
            cloneData.element.style.fontWeight = '600';
            cloneData.element.style.zIndex = '999999';

            clones.push({
              element: cloneData.element,
              cloneId: cloneData.cloneId,
              match: match,
              targetSlot: targetSlot,
              fromX: sourceRect.left,
              fromY: sourceRect.top,
              toX: targetRect.left,
              toY: targetRect.top
            });

            this.cloneIds.push(cloneData.cloneId);
            this.sourceWordIds.add(match.sourceWordId);

            // Dim source word
            sourceSpan.style.opacity = '0.15';
            sourceSpan.style.textShadow = 'none';
          });

          console.log('SmartSummary: Flying', clones.length, 'clones to slots');

          // Animate each clone with stagger
          const animationPromises = clones.map((clone, index) => {
            return new Promise(resolve => {
              const delay = index * opts.staggerDelay;

              setTimeout(() => {
                this._animateCloneToSlot(clone, opts.flyDuration, resolve);
              }, delay);
            });
          });

          await Promise.all(animationPromises);
        }

        _animateCloneToSlot(clone, duration, onComplete) {
          const el = clone.element;
          const fromX = clone.fromX;
          const fromY = clone.fromY;
          const toX = clone.toX;
          const toY = clone.toY;
          const isVocab = clone.match.isVocabulary;
          const targetSlot = clone.targetSlot;

          // Control point for bezier curve (arc upward)
          const ctrlX = (fromX + toX) / 2;
          const ctrlY = Math.min(fromY, toY) - 80 - Math.random() * 40;

          const startTime = performance.now();

          const animate = () => {
            const now = performance.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const t = 1 - Math.pow(1 - progress, 3);

            // Quadratic bezier
            const x = (1-t)*(1-t)*fromX + 2*(1-t)*t*ctrlX + t*t*toX;
            const y = (1-t)*(1-t)*fromY + 2*(1-t)*t*ctrlY + t*t*toY;

            el.style.left = x + 'px';
            el.style.top = y + 'px';

            // Fade glow as it approaches target
            if (progress > 0.7) {
              const fadeProgress = (progress - 0.7) / 0.3;
              const glowSize = 12 * (1 - fadeProgress);
              const color = isVocab ? '#ffd700' : '#00bfff';
              el.style.textShadow = '0 0 '+glowSize+'px '+color;
            }

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              // Animation complete - reveal the slot text and hide clone
              if (targetSlot) {
                targetSlot.style.opacity = '1';
                targetSlot.style.color = isVocab ? '#ffd700' : '#ffffff';
                if (isVocab) targetSlot.style.textShadow = '0 0 6px #ffd700';
              }
              // Fade out and remove clone
              el.style.transition = 'opacity 200ms ease-out';
              el.style.opacity = '0';
              setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
              }, 200);
              onComplete();
            }
          };

          requestAnimationFrame(animate);
        }

        _createSummaryContainerWithSlots(summaryWords, matchedIndices, opts) {
          const self = this;
          this.currentSummaryText = summaryWords.join(' ');

          this.summaryContainer = document.createElement('div');
          this.summaryContainer.id = 'se-summary-container';
          this.summaryContainer.style.cssText =
            'position:fixed;'+
            'left:50%;'+
            'top:50%;'+
            'transform:translate(-50%,-50%) scale(0.92);'+
            'max-width:500px;'+
            'background:linear-gradient(135deg, rgba(30,35,50,0.98), rgba(20,25,40,0.98));'+
            'border-radius:20px;'+
            'padding:28px 32px;'+
            'box-shadow:0 12px 48px rgba(0,0,0,0.6),0 0 80px rgba(0,150,255,0.15),inset 0 1px 0 rgba(255,255,255,0.1);'+
            'border:1px solid rgba(100,150,255,0.2);'+
            'z-index:999997;'+
            'opacity:0;'+
            'transition:all 500ms cubic-bezier(0.16,1,0.3,1);';

          // Header row with title, create note button and close button
          const headerRow = document.createElement('div');
          headerRow.style.cssText =
            'display:flex;'+
            'align-items:center;'+
            'justify-content:space-between;'+
            'margin-bottom:16px;';

          // Header title
          const header = document.createElement('div');
          header.style.cssText =
            'font-size:11px;'+
            'text-transform:uppercase;'+
            'letter-spacing:3px;'+
            'color:rgba(100,180,255,0.7);'+
            'font-weight:600;'+
            'font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
          header.textContent = '✨ SMART SUMMARY';
          headerRow.appendChild(header);

          // Button container
          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = 'display:flex;gap:8px;align-items:center;';

          // Create Note button
          const createNoteBtn = document.createElement('button');
          createNoteBtn.style.cssText =
            'background:rgba(100,180,255,0.2);'+
            'border:1px solid rgba(100,180,255,0.3);'+
            'border-radius:6px;'+
            'padding:6px 12px;'+
            'color:#fff;'+
            'font-size:12px;'+
            'font-weight:500;'+
            'cursor:pointer;'+
            'transition:all 150ms ease;'+
            'font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
          createNoteBtn.textContent = '📝 Save Note';
          createNoteBtn.onmouseenter = function() {
            this.style.background = 'rgba(100,180,255,0.35)';
          };
          createNoteBtn.onmouseleave = function() {
            this.style.background = 'rgba(100,180,255,0.2)';
          };
          createNoteBtn.onclick = function() {
            // Send message to renderer to create note
            if (typeof ipcRenderer !== 'undefined') {
              ipcRenderer.sendToHost('study-enhancer-event', {
                type: 'createNote',
                content: self.currentSummaryText
              });
            }
            // Visual feedback
            this.textContent = '✓ Saved!';
            this.style.background = 'rgba(46,183,125,0.3)';
            this.style.borderColor = 'rgba(46,183,125,0.5)';
            setTimeout(() => {
              this.textContent = '📝 Save Note';
              this.style.background = 'rgba(100,180,255,0.2)';
              this.style.borderColor = 'rgba(100,180,255,0.3)';
            }, 1500);
          };
          buttonContainer.appendChild(createNoteBtn);

          // Close button
          const closeBtn = document.createElement('button');
          closeBtn.style.cssText =
            'background:transparent;'+
            'border:none;'+
            'width:28px;'+
            'height:28px;'+
            'border-radius:50%;'+
            'display:flex;'+
            'align-items:center;'+
            'justify-content:center;'+
            'cursor:pointer;'+
            'color:rgba(255,255,255,0.5);'+
            'font-size:18px;'+
            'transition:all 150ms ease;'+
            'font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
          closeBtn.innerHTML = '✕';
          closeBtn.onmouseenter = function() {
            this.style.background = 'rgba(255,255,255,0.1)';
            this.style.color = 'rgba(255,255,255,0.9)';
          };
          closeBtn.onmouseleave = function() {
            this.style.background = 'transparent';
            this.style.color = 'rgba(255,255,255,0.5)';
          };
          closeBtn.onclick = function() {
            self.remove();
          };
          buttonContainer.appendChild(closeBtn);

          headerRow.appendChild(buttonContainer);
          this.summaryContainer.appendChild(headerRow);

          // Content area with word slots
          // Matched words start invisible (will be revealed when clones arrive)
          // Unmatched words are visible immediately with fade-in
          const content = document.createElement('div');
          content.id = 'se-summary-content';
          content.style.cssText =
            'min-height:40px;'+
            'font-size:18px;'+
            'line-height:1.8;'+
            'color:#ffffff;'+
            'font-weight:500;';

          // Create word slots
          summaryWords.forEach((word, index) => {
            const isMatched = matchedIndices.has(index);
            const span = document.createElement('span');
            span.id = 'se-slot-' + index;
            span.textContent = word;
            span.style.cssText = isMatched
              ? 'opacity:0;transition:opacity 200ms ease-out;'  // Hidden, will be revealed by flying clone
              : 'opacity:0;animation:se-fade-in 400ms ease-out forwards;animation-delay:'+(index * 30)+'ms;'; // Fade in for unmatched
            content.appendChild(span);

            // Add space after word (except last)
            if (index < summaryWords.length - 1) {
              content.appendChild(document.createTextNode(' '));
            }
          });

          this.summaryContainer.appendChild(content);

          // Inject fade-in animation if not exists
          if (!document.getElementById('se-fade-in-animation')) {
            const style = document.createElement('style');
            style.id = 'se-fade-in-animation';
            style.textContent = '@keyframes se-fade-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}';
            document.head.appendChild(style);
          }

          document.body.appendChild(this.summaryContainer);

          // Animate container in
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.summaryContainer.style.opacity = '1';
              this.summaryContainer.style.transform = 'translate(-50%,-50%) scale(1)';
            });
          });

          // Store content ref
          this.summaryContent = content;
        }

        _findMatches(sourceWordIds, summaryWords, vocabularyWords = []) {
          const matches = [];
          const used = new Set();
          const vocabLower = (vocabularyWords || []).map(w => w.toLowerCase());

          summaryWords.forEach((word, si) => {
            const search = word.toLowerCase().replace(/[.,!?;:'"()\\[\\]{}]/g, '');
            if (!search || search.length < 2) return;

            const isVocabulary = vocabLower.some(v => v === search || search.includes(v) || v.includes(search));

            for (const sid of sourceWordIds) {
              if (used.has(sid)) continue;
              const span = document.getElementById(sid);
              if (!span) continue;
              const spanText = span.textContent.toLowerCase().replace(/[.,!?;:'"()\\[\\]{}]/g, '');
              if (spanText === search) {
                matches.push({ sourceWordId: sid, word: word, summaryIndex: si, isVocabulary: isVocabulary });
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

          // Fade out clones
          const fadePromises = this.cloneIds.map(id => this.managers.cloneManager.fadeOutAndRemove(id, fadeOutDuration));
          await Promise.all(fadePromises);

          // Restore source words
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

          // Fade out container
          if (this.summaryContainer) {
            this.summaryContainer.style.opacity = '0';
            this.summaryContainer.style.transform = 'scale(0.92) translateY(10px)';
            await new Promise(r => setTimeout(r, fadeOutDuration));
            if (this.summaryContainer.parentNode) this.summaryContainer.parentNode.removeChild(this.summaryContainer);
            this.summaryContainer = null;
          }

          await this._undimPage(fadeOutDuration);

          this.cloneIds = [];
          this.sourceWordIds.clear();
          this.isActive = false;
        }

        destroy() { this.remove({ fadeOutDuration: 0 }); }
      }
      window.SmartSummaryEffect = SmartSummaryEffect;

      // ConstellationMindmapEffect - Animated mindmap visualization
      class ConstellationMindmapEffect {
        constructor(managers, options = {}) {
          this.managers = managers;
          this.options = {
            mindmapData: null,
            dimOpacity: 0.5,
            nodeColors: {
              person: '#ffd700',
              concept: '#00bfff',
              place: '#2eb67d',
              event: '#9c27b0',
              object: '#ff9500'
            },
            animationDurations: {
              dim: 400,
              scan: 600,
              glow: 800,
              rootLaunch: 600,
              branchBurst: 1200,
              lineDraw: 800,
              labelFade: 400
            },
            ...options
          };
          this.isActive = false;
          this.container = null;
          this.svgContainer = null;
          this.dimOverlay = null;
          this.nodeElements = new Map();
          this.edgeElements = [];
          this.sourceMatches = new Map();
          this.cloneIds = [];
        }

        async apply(sourceElement, options = {}) {
          const opts = { ...this.options, ...options };
          if (!opts.mindmapData) {
            console.warn('ConstellationMindmap: No mindmap data provided');
            return;
          }

          const source = typeof sourceElement === 'string' ? document.querySelector(sourceElement) : sourceElement;
          if (!source) {
            console.warn('ConstellationMindmap: Source element not found');
            return;
          }

          this.isActive = true;
          const data = opts.mindmapData;

          // Phase 1: Dim page
          await this._dimPage(opts.dimOpacity);

          // Phase 2: Wrap source and find entity matches
          const wrapResult = this.managers.wordWrapper.wrapElement(source);
          this._findEntityMatches(wrapResult.wordIds, data);

          // Phase 3: Create mindmap container with SVG
          this._createMindmapContainer(opts);

          // Phase 4: Glow source entities
          await this._glowSourceEntities(opts);

          // Phase 5: Animate root node
          await this._animateRootNode(data.root, opts);

          // Phase 6: Animate level 1 branches
          await this._animateBranches(data, 1, opts);

          // Phase 7: Draw edges with animation
          await this._animateEdges(data, opts);

          // Phase 8: Animate level 2 branches
          await this._animateBranches(data, 2, opts);

          // Phase 9: Draw remaining edges
          await this._animateEdges(data, opts, true);

          // Phase 10: Make container fully opaque after all flying animations complete
          await this._makeContainerOpaque();

          return { nodeCount: data.nodes.length, edgeCount: data.edges.length };
        }

        async _dimPage(opacity) {
          this.dimOverlay = document.createElement('div');
          this.dimOverlay.id = 'se-mindmap-dim';
          this.dimOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,20,'+opacity+');z-index:999990;opacity:0;transition:opacity 400ms ease-out;pointer-events:none;';
          document.body.appendChild(this.dimOverlay);
          await new Promise(r => setTimeout(r, 50));
          this.dimOverlay.style.opacity = '1';
          await new Promise(r => setTimeout(r, 400));
        }

        async _undimPage(duration = 400) {
          if (this.dimOverlay) {
            this.dimOverlay.style.opacity = '0';
            await new Promise(r => setTimeout(r, duration));
            if (this.dimOverlay.parentNode) this.dimOverlay.parentNode.removeChild(this.dimOverlay);
            this.dimOverlay = null;
          }
        }

        async _makeContainerOpaque() {
          if (this.container) {
            // Transition from semi-transparent to fully opaque
            this.container.style.transition = 'all 400ms ease-out';
            this.container.style.background = 'linear-gradient(135deg, rgba(20,25,35,0.98), rgba(15,18,28,0.98))';
            this.container.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6),0 0 100px rgba(0,100,255,0.1),inset 0 1px 0 rgba(255,255,255,0.08)';
            this.container.style.border = '1px solid rgba(100,150,255,0.15)';
            await new Promise(r => setTimeout(r, 400));
          }
        }

        _findEntityMatches(sourceWordIds, data) {
          const allNodes = [data.root, ...data.nodes];
          allNodes.forEach(node => {
            if (!node.sourcePhrase && !node.text) return;
            const searchText = (node.sourcePhrase || node.text).toLowerCase();
            const searchWords = searchText.split(/\\s+/);

            for (const word of searchWords) {
              const cleanWord = word.replace(/[.,!?;:'"()\\[\\]{}]/g, '');
              if (cleanWord.length < 2) continue;

              for (const sid of sourceWordIds) {
                if (this.sourceMatches.has(sid)) continue;
                const span = document.getElementById(sid);
                if (!span) continue;
                const spanText = span.textContent.toLowerCase().replace(/[.,!?;:'"()\\[\\]{}]/g, '');
                if (spanText === cleanWord) {
                  this.sourceMatches.set(sid, { nodeId: node.id, type: node.type });
                  break;
                }
              }
            }
          });
        }

        _createMindmapContainer(opts) {
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const containerWidth = Math.min(700, viewportWidth - 80);
          const containerHeight = Math.min(500, viewportHeight - 100);

          this.container = document.createElement('div');
          this.container.id = 'se-mindmap-container';
          // Start semi-transparent (30% opacity) so flying animations from source text are visible
          // Will transition to full opacity after animations complete
          this.container.style.cssText =
            'position:fixed;'+
            'left:50%;top:50%;'+
            'transform:translate(-50%,-50%) scale(0.9);'+
            'width:'+containerWidth+'px;'+
            'height:'+containerHeight+'px;'+
            'background:linear-gradient(135deg, rgba(20,25,35,0.3), rgba(15,18,28,0.3));'+
            'border-radius:24px;'+
            'padding:24px;'+
            'box-shadow:0 20px 60px rgba(0,0,0,0.3),0 0 100px rgba(0,100,255,0.05),inset 0 1px 0 rgba(255,255,255,0.05);'+
            'border:1px solid rgba(100,150,255,0.1);'+
            'z-index:999997;'+
            'opacity:0;'+
            'transition:all 500ms cubic-bezier(0.16,1,0.3,1);'+
            'overflow:hidden;';

          // Header
          const header = this._createHeader(opts);
          this.container.appendChild(header);

          // SVG container for nodes and edges
          this.svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          this.svgContainer.setAttribute('width', '100%');
          this.svgContainer.setAttribute('height', containerHeight - 60);
          this.svgContainer.style.cssText = 'position:absolute;top:60px;left:0;pointer-events:none;';

          // Defs for gradients and filters
          const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          defs.innerHTML = '<filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
          this.svgContainer.appendChild(defs);

          this.container.appendChild(this.svgContainer);

          // Node container (HTML for better text rendering)
          this.nodeContainer = document.createElement('div');
          this.nodeContainer.style.cssText = 'position:absolute;top:60px;left:24px;right:24px;bottom:24px;';
          this.container.appendChild(this.nodeContainer);

          document.body.appendChild(this.container);

          // Animate in
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.container.style.opacity = '1';
              this.container.style.transform = 'translate(-50%,-50%) scale(1)';
            });
          });

          // Store dimensions for layout calculations
          this.layoutWidth = containerWidth - 48;
          this.layoutHeight = containerHeight - 84;
          this.centerX = this.layoutWidth / 2;
          this.centerY = this.layoutHeight / 2;
        }

        _createHeader(opts) {
          const self = this;
          const header = document.createElement('div');
          header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';

          const title = document.createElement('div');
          title.style.cssText = 'font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(100,180,255,0.7);font-weight:600;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
          title.textContent = '🌟 CONSTELLATION MINDMAP';
          header.appendChild(title);

          const btnContainer = document.createElement('div');
          btnContainer.style.cssText = 'display:flex;gap:8px;';

          // Save button
          const saveBtn = document.createElement('button');
          saveBtn.style.cssText = 'background:rgba(100,180,255,0.2);border:1px solid rgba(100,180,255,0.3);border-radius:6px;padding:6px 12px;color:#fff;font-size:12px;cursor:pointer;transition:all 150ms;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
          saveBtn.textContent = '📝 Save';
          saveBtn.onclick = function() {
            if (typeof ipcRenderer !== 'undefined') {
              // Send mindmap data in markdown format for proper mindmap card creation
              const mindmapMarkdown = self._getMindmapMarkdown(opts.mindmapData);
              ipcRenderer.sendToHost('study-enhancer-event', {
                type: 'createMindmapNote',
                title: opts.mindmapData.title,
                mindmapMarkdown: mindmapMarkdown,
                mindmapData: opts.mindmapData
              });
            }
            this.textContent = '✓ Saved!';
            this.style.background = 'rgba(46,183,125,0.3)';
            setTimeout(() => { this.textContent = '📝 Save'; this.style.background = 'rgba(100,180,255,0.2)'; }, 1500);
          };
          btnContainer.appendChild(saveBtn);

          // Close button
          const closeBtn = document.createElement('button');
          closeBtn.style.cssText = 'background:transparent;border:none;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.5);font-size:18px;transition:all 150ms;';
          closeBtn.innerHTML = '✕';
          closeBtn.onmouseenter = function() { this.style.background='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.9)'; };
          closeBtn.onmouseleave = function() { this.style.background='transparent';this.style.color='rgba(255,255,255,0.5)'; };
          closeBtn.onclick = function() { self.remove(); };
          btnContainer.appendChild(closeBtn);

          header.appendChild(btnContainer);
          return header;
        }

        _getMindmapText(data) {
          let text = data.root.text + '\\n';
          const level1 = data.nodes.filter(n => n.level === 1);
          level1.forEach(n => {
            const edge = data.edges.find(e => e.to === n.id);
            text += '  ├─ ' + (edge ? edge.relation + ' → ' : '') + n.text + '\\n';
            const level2 = data.nodes.filter(n2 => n2.parentId === n.id);
            level2.forEach(n2 => {
              const edge2 = data.edges.find(e => e.to === n2.id);
              text += '  │   └─ ' + (edge2 ? edge2.relation + ' → ' : '') + n2.text + '\\n';
            });
          });
          return text;
        }

        // Convert mindmap data to markdown format for parseMindmapToReactFlow
        // Format: indented lines where each level adds 2 spaces
        // "keyword | description" format supported
        _getMindmapMarkdown(data) {
          let markdown = '';
          // Root node (level 0)
          markdown += '- ' + data.root.text + '\\n';
          // Level 1 nodes
          const level1 = data.nodes.filter(n => n.level === 1);
          level1.forEach(n => {
            const edge = data.edges.find(e => e.to === n.id);
            const relation = edge ? edge.relation : '';
            // Use "keyword | description" format
            markdown += '  - ' + n.text + (relation ? ' | ' + relation : '') + '\\n';
            // Level 2 nodes (children of this level 1 node)
            const level2 = data.nodes.filter(n2 => n2.parentId === n.id);
            level2.forEach(n2 => {
              const edge2 = data.edges.find(e => e.to === n2.id);
              const relation2 = edge2 ? edge2.relation : '';
              markdown += '    - ' + n2.text + (relation2 ? ' | ' + relation2 : '') + '\\n';
            });
          });
          return markdown;
        }

        async _glowSourceEntities(opts) {
          if (!document.getElementById('se-mindmap-glow')) {
            const style = document.createElement('style');
            style.id = 'se-mindmap-glow';
            style.textContent = '@keyframes se-entity-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}';
            document.head.appendChild(style);
          }

          for (const [sid, match] of this.sourceMatches) {
            const span = document.getElementById(sid);
            if (span) {
              const color = this.options.nodeColors[match.type] || '#00bfff';
              span.style.transition = 'all 200ms ease-out';
              span.style.textShadow = '0 0 8px '+color+',0 0 16px '+color;
              span.style.color = '#fff';
              span.style.position = 'relative';
              span.style.zIndex = '999995';
              span.style.display = 'inline-block';
              span.style.animation = 'se-entity-pulse 0.5s ease-out';
            }
            await new Promise(r => setTimeout(r, 50));
          }
          await new Promise(r => setTimeout(r, 300));
        }

        async _animateRootNode(root, opts) {
          const nodeEl = this._createNodeElement(root, this.centerX, this.centerY, true);
          this.nodeContainer.appendChild(nodeEl);
          this.nodeElements.set(root.id, { element: nodeEl, x: this.centerX, y: this.centerY });

          // Animate from source if match exists
          const sourceMatch = Array.from(this.sourceMatches.entries()).find(([_, m]) => m.nodeId === root.id);
          if (sourceMatch) {
            const sourceSpan = document.getElementById(sourceMatch[0]);
            if (sourceSpan) {
              const rect = sourceSpan.getBoundingClientRect();
              const containerRect = this.nodeContainer.getBoundingClientRect();
              const startX = rect.left - containerRect.left;
              const startY = rect.top - containerRect.top;

              nodeEl.style.left = startX + 'px';
              nodeEl.style.top = startY + 'px';
              nodeEl.style.transform = 'translate(-50%,-50%) scale(0.5)';
              nodeEl.style.opacity = '0';

              await new Promise(r => setTimeout(r, 50));
              nodeEl.style.transition = 'all 600ms cubic-bezier(0.34,1.56,0.64,1)';
              nodeEl.style.left = this.centerX + 'px';
              nodeEl.style.top = this.centerY + 'px';
              nodeEl.style.transform = 'translate(-50%,-50%) scale(1)';
              nodeEl.style.opacity = '1';
              await new Promise(r => setTimeout(r, 600));
            }
          } else {
            nodeEl.style.transform = 'translate(-50%,-50%) scale(0)';
            nodeEl.style.opacity = '0';
            await new Promise(r => setTimeout(r, 50));
            nodeEl.style.transition = 'all 500ms cubic-bezier(0.34,1.56,0.64,1)';
            nodeEl.style.transform = 'translate(-50%,-50%) scale(1)';
            nodeEl.style.opacity = '1';
            await new Promise(r => setTimeout(r, 500));
          }
        }

        async _animateBranches(data, level, opts) {
          const nodes = data.nodes.filter(n => n.level === level);
          if (!nodes.length) return;

          const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);
          const radius = level === 1 ? 140 : 80;

          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            let x, y;

            if (level === 1) {
              const angle = angleStep * i - Math.PI / 2;
              x = this.centerX + radius * Math.cos(angle);
              y = this.centerY + radius * Math.sin(angle);
            } else {
              const parent = this.nodeElements.get(node.parentId);
              if (parent) {
                const parentAngle = Math.atan2(parent.y - this.centerY, parent.x - this.centerX);
                const childAngle = parentAngle + (i % 2 === 0 ? 0.5 : -0.5);
                x = parent.x + radius * Math.cos(childAngle);
                y = parent.y + radius * Math.sin(childAngle);
              } else {
                x = this.centerX + (Math.random() - 0.5) * 200;
                y = this.centerY + (Math.random() - 0.5) * 150;
              }
            }

            const nodeEl = this._createNodeElement(node, x, y, false);
            this.nodeContainer.appendChild(nodeEl);
            this.nodeElements.set(node.id, { element: nodeEl, x, y });

            // Animate from source or from center
            const sourceMatch = Array.from(this.sourceMatches.entries()).find(([_, m]) => m.nodeId === node.id);
            if (sourceMatch) {
              const sourceSpan = document.getElementById(sourceMatch[0]);
              if (sourceSpan) {
                const rect = sourceSpan.getBoundingClientRect();
                const containerRect = this.nodeContainer.getBoundingClientRect();
                nodeEl.style.left = (rect.left - containerRect.left) + 'px';
                nodeEl.style.top = (rect.top - containerRect.top) + 'px';
                sourceSpan.style.opacity = '0.2';
              }
            } else {
              const parent = level === 1 ? { x: this.centerX, y: this.centerY } : this.nodeElements.get(node.parentId);
              if (parent) {
                nodeEl.style.left = parent.x + 'px';
                nodeEl.style.top = parent.y + 'px';
              }
            }

            nodeEl.style.transform = 'translate(-50%,-50%) scale(0)';
            nodeEl.style.opacity = '0';

            await new Promise(r => setTimeout(r, 30));
            nodeEl.style.transition = 'all 500ms cubic-bezier(0.34,1.56,0.64,1)';
            nodeEl.style.left = x + 'px';
            nodeEl.style.top = y + 'px';
            nodeEl.style.transform = 'translate(-50%,-50%) scale(1)';
            nodeEl.style.opacity = '1';

            await new Promise(r => setTimeout(r, 100));
          }
        }

        async _animateEdges(data, opts, level2Only = false) {
          const edges = level2Only
            ? data.edges.filter(e => data.nodes.find(n => n.id === e.to && n.level === 2))
            : data.edges.filter(e => data.nodes.find(n => n.id === e.to && n.level === 1) || e.to === data.root?.id);

          for (const edge of edges) {
            const fromNode = this.nodeElements.get(edge.from);
            const toNode = this.nodeElements.get(edge.to);
            if (!fromNode || !toNode) continue;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2 - 20;
            const d = 'M '+fromNode.x+' '+fromNode.y+' Q '+midX+' '+midY+' '+toNode.x+' '+toNode.y;

            line.setAttribute('d', d);
            line.setAttribute('fill', 'none');
            line.setAttribute('stroke', 'rgba(100,180,255,0.4)');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('filter', 'url(#glow)');

            const length = line.getTotalLength ? line.getTotalLength() : 200;
            line.style.strokeDasharray = length;
            line.style.strokeDashoffset = length;
            line.style.transition = 'stroke-dashoffset 400ms ease-out';

            this.svgContainer.appendChild(line);
            this.edgeElements.push(line);

            await new Promise(r => setTimeout(r, 30));
            line.style.strokeDashoffset = '0';

            // Add relation label
            if (edge.relation) {
              const label = document.createElement('div');
              label.style.cssText = 'position:absolute;font-size:10px;color:rgba(150,200,255,0.7);font-family:-apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none;opacity:0;transition:opacity 300ms;transform:translate(-50%,-50%);';
              label.style.left = midX + 'px';
              label.style.top = (midY + 10) + 'px';
              label.textContent = edge.relation;
              this.nodeContainer.appendChild(label);
              await new Promise(r => setTimeout(r, 100));
              label.style.opacity = '1';
            }
          }
        }

        _createNodeElement(node, x, y, isRoot) {
          const color = this.options.nodeColors[node.type] || '#00bfff';
          const el = document.createElement('div');
          el.id = 'se-mindmap-node-' + node.id;
          el.dataset.nodeId = node.id;

          const size = isRoot ? '120px' : '90px';
          const fontSize = isRoot ? '14px' : '12px';
          const padding = isRoot ? '16px 20px' : '10px 14px';

          el.style.cssText =
            'position:absolute;'+
            'left:'+x+'px;top:'+y+'px;'+
            'transform:translate(-50%,-50%);'+
            'max-width:'+size+';'+
            'padding:'+padding+';'+
            'background:rgba(30,35,50,0.95);'+
            'border:2px solid '+color+';'+
            'border-radius:'+(isRoot?'16px':'12px')+';'+
            'color:#fff;'+
            'font-size:'+fontSize+';'+
            'font-weight:'+(isRoot?'600':'500')+';'+
            'font-family:-apple-system,BlinkMacSystemFont,sans-serif;'+
            'text-align:center;'+
            'box-shadow:0 4px 20px rgba(0,0,0,0.4),0 0 20px '+color+'33;'+
            'cursor:pointer;'+
            'transition:transform 200ms, box-shadow 200ms;'+
            'z-index:999998;';

          el.textContent = node.text;

          // Hover effect
          el.onmouseenter = function() {
            this.style.transform = 'translate(-50%,-50%) scale(1.1)';
            this.style.boxShadow = '0 8px 30px rgba(0,0,0,0.5),0 0 30px '+color+'55';
          };
          el.onmouseleave = function() {
            this.style.transform = 'translate(-50%,-50%) scale(1)';
            this.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4),0 0 20px '+color+'33';
          };

          return el;
        }

        async remove(options = {}) {
          if (!this.isActive) return;
          const { fadeOutDuration = 400 } = options;

          // Restore source words
          this.sourceMatches.forEach((match, sid) => {
            const span = document.getElementById(sid);
            if (span) {
              span.style.opacity = '';
              span.style.textShadow = '';
              span.style.color = '';
              span.style.animation = '';
            }
          });

          // Fade out container
          if (this.container) {
            this.container.style.opacity = '0';
            this.container.style.transform = 'translate(-50%,-50%) scale(0.9)';
            await new Promise(r => setTimeout(r, fadeOutDuration));
            if (this.container.parentNode) this.container.parentNode.removeChild(this.container);
            this.container = null;
          }

          await this._undimPage(fadeOutDuration);

          this.nodeElements.clear();
          this.edgeElements = [];
          this.sourceMatches.clear();
          this.isActive = false;
        }

        destroy() { this.remove({ fadeOutDuration: 0 }); }
      }
      window.ConstellationMindmapEffect = ConstellationMindmapEffect;

      // ============================================
      // EntityResolutionEffect - Coreference linking
      // ============================================
      class EntityResolutionEffect {
        constructor(managers, options = {}) {
          this.managers = managers;
          this.options = {
            entityColors: [
              '#FF6B6B', // Red
              '#4ECDC4', // Teal
              '#45B7D1', // Blue
              '#96CEB4', // Green
              '#FFEAA7', // Yellow
              '#DDA0DD', // Plum
              '#98D8C8', // Mint
              '#F7DC6F', // Gold
            ],
            highlightOpacity: 0.25,
            arrowColor: 'rgba(255,255,255,0.6)',
            arrowWidth: 2,
            animationDuration: 300,
            staggerDelay: 50,
            ...options
          };
          this.isActive = false;
          this.entityGroups = new Map(); // entityId -> { color, references: [spanIds] }
          this.svgContainer = null;
          this.arrowPaths = [];
          this.activeEntityId = null;
          this.sourceElement = null;
          this.annotationWrapper = null;
        }

        async apply(sourceElement, options = {}) {
          const opts = { ...this.options, ...options };
          if (!opts.entityData || !opts.entityData.entities) {
            console.warn('EntityResolution: No entity data provided');
            return;
          }

          const source = typeof sourceElement === 'string' ? document.querySelector(sourceElement) : sourceElement;
          if (!source) {
            console.warn('EntityResolution: Source element not found');
            return;
          }

          this.isActive = true;
          this.sourceElement = source;
          const entities = opts.entityData.entities;

          // Phase 1: Wrap words in the source text
          const wrapResult = this.managers.wordWrapper.wrapElement(source);

          // Phase 2: Create annotation wrapper and SVG overlay for arrows
          this._createAnnotationLayer(source);

          // Phase 3: Match entities to word spans and apply colors
          await this._matchAndHighlightEntities(entities, wrapResult.wordIds, source, opts);

          // Phase 4: Draw connecting arrows
          await this._drawConnectionArrows(opts);

          // Phase 5: Add hover interactions
          this._addHoverInteractions(opts);

          return { entityCount: entities.length };
        }

        _createAnnotationLayer(source) {
          // Create a wrapper that contains both the source content and the SVG overlay
          // This ensures the SVG scrolls with the content
          this.annotationWrapper = document.createElement('div');
          this.annotationWrapper.id = 'se-entity-annotation-wrapper';
          this.annotationWrapper.style.cssText = 'position:relative;display:inline;';

          // Wrap the source element's content
          // We need to be careful to preserve the source element and just add the SVG as a sibling
          const sourceRect = source.getBoundingClientRect();
          const sourceStyle = window.getComputedStyle(source);

          // Ensure source element has position relative for proper SVG positioning
          const originalPosition = sourceStyle.position;
          if (originalPosition === 'static') {
            source.style.position = 'relative';
          }

          // Create SVG container positioned absolutely within the source element
          this.svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          this.svgContainer.id = 'se-entity-arrows';
          this.svgContainer.style.cssText =
            'position:absolute;' +
            'top:0;left:0;' +
            'width:100%;height:100%;' +
            'pointer-events:none;' +
            'z-index:999990;' +
            'overflow:visible;';

          // Add arrow marker definition
          const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          defs.innerHTML = '<marker id="se-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.6)"/></marker>';
          this.svgContainer.appendChild(defs);

          // Insert SVG as first child of source element so it's behind the text
          source.insertBefore(this.svgContainer, source.firstChild);

          // Store original position for cleanup
          this.originalSourcePosition = originalPosition;
        }

        async _matchAndHighlightEntities(entities, sourceWordIds, source, opts) {
          const sourceText = source.textContent;

          for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const color = opts.entityColors[i % opts.entityColors.length];
            const references = [];

            // Find each reference in the wrapped words
            for (const ref of entity.references) {
              const refText = ref.text.toLowerCase();
              const refWords = refText.split(/\\s+/);

              // Find matching spans for this reference
              const matchedSpans = this._findMatchingSpans(refWords, sourceWordIds, ref.startIndex, sourceText);
              if (matchedSpans.length > 0) {
                references.push(...matchedSpans);

                // Highlight the matched spans
                for (const spanId of matchedSpans) {
                  const span = document.getElementById(spanId);
                  if (span) {
                    span.dataset.entityId = entity.id;
                    span.dataset.entityColor = color;
                    span.style.transition = 'all ' + opts.animationDuration + 'ms ease-out';
                    span.style.backgroundColor = color + Math.round(opts.highlightOpacity * 255).toString(16).padStart(2, '0');
                    span.style.borderRadius = '3px';
                    span.style.padding = '1px 2px';
                    span.style.margin = '0 1px';
                    span.style.boxShadow = '0 0 0 1px ' + color + '44';
                  }
                  await new Promise(r => setTimeout(r, opts.staggerDelay / 2));
                }
              }
            }

            this.entityGroups.set(entity.id, {
              color,
              canonicalName: entity.canonicalName,
              type: entity.type,
              references
            });

            await new Promise(r => setTimeout(r, opts.staggerDelay));
          }
        }

        _findMatchingSpans(refWords, sourceWordIds, startIndex, sourceText) {
          const matchedSpans = [];

          // Try to find spans that match the reference words
          for (let i = 0; i < sourceWordIds.length; i++) {
            const span = document.getElementById(sourceWordIds[i]);
            if (!span) continue;

            const spanText = span.textContent.toLowerCase().replace(/[.,!?;:'"()\\[\\]{}]/g, '');

            // Check if this span matches the first word of the reference
            if (spanText === refWords[0].replace(/[.,!?;:'"()\\[\\]{}]/g, '')) {
              // Check if we can match all words in sequence
              let allMatch = true;
              const potentialMatches = [sourceWordIds[i]];

              for (let j = 1; j < refWords.length && i + j < sourceWordIds.length; j++) {
                const nextSpan = document.getElementById(sourceWordIds[i + j]);
                if (!nextSpan) { allMatch = false; break; }
                const nextText = nextSpan.textContent.toLowerCase().replace(/[.,!?;:'"()\\[\\]{}]/g, '');
                if (nextText !== refWords[j].replace(/[.,!?;:'"()\\[\\]{}]/g, '')) {
                  allMatch = false;
                  break;
                }
                potentialMatches.push(sourceWordIds[i + j]);
              }

              if (allMatch && potentialMatches.length === refWords.length) {
                matchedSpans.push(...potentialMatches);
                break; // Found a match for this reference
              }
            }
          }

          return matchedSpans;
        }

        async _drawConnectionArrows(opts) {
          // Get source element rect for relative positioning
          const sourceRect = this.sourceElement.getBoundingClientRect();

          for (const [entityId, group] of this.entityGroups) {
            if (group.references.length < 2) continue;

            const color = group.color;

            // Draw curved arrows between consecutive references
            for (let i = 0; i < group.references.length - 1; i++) {
              const fromSpan = document.getElementById(group.references[i]);
              const toSpan = document.getElementById(group.references[i + 1]);

              if (!fromSpan || !toSpan) continue;

              const fromRect = fromSpan.getBoundingClientRect();
              const toRect = toSpan.getBoundingClientRect();

              // Calculate start and end points RELATIVE to the source element
              // This ensures arrows scroll with the content
              const startX = fromRect.right - sourceRect.left;
              const startY = fromRect.top - sourceRect.top + fromRect.height / 2;
              const endX = toRect.left - sourceRect.left;
              const endY = toRect.top - sourceRect.top + toRect.height / 2;

              // Create curved path
              const path = this._createCurvedArrow(startX, startY, endX, endY, color, entityId);
              this.svgContainer.appendChild(path);
              this.arrowPaths.push(path);

              // Animate the arrow drawing
              const length = path.getTotalLength();
              path.style.strokeDasharray = length;
              path.style.strokeDashoffset = length;
              path.style.transition = 'stroke-dashoffset ' + opts.animationDuration + 'ms ease-out';

              await new Promise(r => setTimeout(r, 50));
              path.style.strokeDashoffset = '0';
            }
          }
        }

        _createCurvedArrow(x1, y1, x2, y2, color, entityId) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

          // Calculate control point for quadratic curve
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          const curveHeight = Math.min(distance * 0.3, 50);

          // Curve upward if going left-to-right, downward if right-to-left
          const ctrlY = midY - curveHeight;

          const d = 'M ' + x1 + ' ' + y1 + ' Q ' + midX + ' ' + ctrlY + ' ' + x2 + ' ' + y2;
          path.setAttribute('d', d);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', color);
          path.setAttribute('stroke-width', '2');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('opacity', '0.6');
          path.setAttribute('marker-end', 'url(#se-arrowhead)');
          path.dataset.entityId = entityId;

          return path;
        }

        _addHoverInteractions(opts) {
          // Add hover effects to highlighted spans
          for (const [entityId, group] of this.entityGroups) {
            for (const spanId of group.references) {
              const span = document.getElementById(spanId);
              if (!span) continue;

              span.style.cursor = 'pointer';

              span.addEventListener('mouseenter', () => {
                this._highlightEntityGroup(entityId, true);
              });

              span.addEventListener('mouseleave', () => {
                this._highlightEntityGroup(entityId, false);
              });
            }
          }
        }

        _highlightEntityGroup(entityId, highlight) {
          const group = this.entityGroups.get(entityId);
          if (!group) return;

          const color = group.color;

          // Highlight all spans in this entity group
          for (const spanId of group.references) {
            const span = document.getElementById(spanId);
            if (!span) continue;

            if (highlight) {
              span.style.backgroundColor = color + '66';
              span.style.boxShadow = '0 0 8px ' + color + '88, 0 0 0 2px ' + color;
              span.style.transform = 'scale(1.05)';
              span.style.zIndex = '999991';
              span.style.position = 'relative';
            } else {
              span.style.backgroundColor = color + Math.round(this.options.highlightOpacity * 255).toString(16).padStart(2, '0');
              span.style.boxShadow = '0 0 0 1px ' + color + '44';
              span.style.transform = 'scale(1)';
              span.style.zIndex = '';
            }
          }

          // Highlight arrows for this entity
          for (const path of this.arrowPaths) {
            if (path.dataset.entityId === entityId) {
              path.setAttribute('opacity', highlight ? '1' : '0.6');
              path.setAttribute('stroke-width', highlight ? '3' : '2');
            }
          }
        }

        _createLegend(opts) {
          const legend = document.createElement('div');
          legend.id = 'se-entity-legend';
          legend.style.cssText =
            'position:fixed;top:20px;right:20px;'+
            'background:rgba(30,35,50,0.95);'+
            'border-radius:12px;'+
            'padding:16px;'+
            'border:1px solid rgba(255,255,255,0.1);'+
            'box-shadow:0 8px 32px rgba(0,0,0,0.4);'+
            'z-index:999995;'+
            'font-family:-apple-system,BlinkMacSystemFont,sans-serif;'+
            'max-width:200px;';

          const title = document.createElement('div');
          title.style.cssText = 'font-size:11px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.5);margin-bottom:12px;font-weight:600;';
          title.textContent = 'Entity Links';
          legend.appendChild(title);

          for (const [entityId, group] of this.entityGroups) {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;padding:4px;border-radius:4px;transition:background 150ms;';

            const dot = document.createElement('div');
            dot.style.cssText = 'width:12px;height:12px;border-radius:50%;background:' + group.color + ';flex-shrink:0;';
            item.appendChild(dot);

            const name = document.createElement('div');
            name.style.cssText = 'font-size:12px;color:#fff;';
            name.textContent = group.canonicalName + ' (' + group.references.length + ')';
            item.appendChild(name);

            item.addEventListener('mouseenter', () => {
              item.style.background = 'rgba(255,255,255,0.1)';
              this._highlightEntityGroup(entityId, true);
            });
            item.addEventListener('mouseleave', () => {
              item.style.background = '';
              this._highlightEntityGroup(entityId, false);
            });

            legend.appendChild(item);
          }

          // Close button
          const closeBtn = document.createElement('button');
          closeBtn.style.cssText = 'position:absolute;top:8px;right:8px;background:transparent;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:14px;';
          closeBtn.innerHTML = '✕';
          closeBtn.onclick = () => this.remove();
          legend.appendChild(closeBtn);

          document.body.appendChild(legend);
          this.legend = legend;
        }

        async remove(options = {}) {
          if (!this.isActive) return;
          const { fadeOutDuration = 300 } = options;

          // Remove highlights from spans
          for (const [entityId, group] of this.entityGroups) {
            for (const spanId of group.references) {
              const span = document.getElementById(spanId);
              if (span) {
                span.style.backgroundColor = '';
                span.style.boxShadow = '';
                span.style.borderRadius = '';
                span.style.padding = '';
                span.style.margin = '';
                span.style.transform = '';
                span.style.cursor = '';
                span.style.zIndex = '';
                delete span.dataset.entityId;
                delete span.dataset.entityColor;
              }
            }
          }

          // Remove SVG overlay
          if (this.svgContainer && this.svgContainer.parentNode) {
            this.svgContainer.style.opacity = '0';
            this.svgContainer.style.transition = 'opacity ' + fadeOutDuration + 'ms';
            await new Promise(r => setTimeout(r, fadeOutDuration));
            this.svgContainer.parentNode.removeChild(this.svgContainer);
            this.svgContainer = null;
          }

          // Restore original source element position
          if (this.sourceElement && this.originalSourcePosition !== undefined) {
            this.sourceElement.style.position = this.originalSourcePosition || '';
          }
          this.sourceElement = null;
          this.annotationWrapper = null;

          // Remove legend
          if (this.legend && this.legend.parentNode) {
            this.legend.parentNode.removeChild(this.legend);
            this.legend = null;
          }

          this.entityGroups.clear();
          this.arrowPaths = [];
          this.isActive = false;
        }

        destroy() { this.remove({ fadeOutDuration: 0 }); }
      }
      window.EntityResolutionEffect = EntityResolutionEffect;

      // ============================================
      // ParagraphActionManager - Inject action icons on paragraphs
      // ============================================
      class ParagraphActionManager {
        constructor(options = {}) {
          this.options = {
            minWords: 15,
            iconSize: 24,
            iconOpacity: 0.4,
            iconHoverOpacity: 1,
            excludeTags: ['nav', 'header', 'footer', 'aside', 'button', 'form', 'menu', 'script', 'style', 'noscript'],
            excludeRoles: ['button', 'navigation', 'banner', 'contentinfo', 'complementary'],
            maxLinkRatio: 0.5,
            ...options
          };
          this.paragraphs = new Map(); // id -> { element, iconElement, text }
          this.iconContainer = null;
          this.isActive = false;
          this.scrollHandler = null;
          this.resizeHandler = null;
          this.idCounter = 0;
        }

        /**
         * Scan page and inject icons on meaningful paragraphs
         */
        inject() {
          console.log('ParagraphActionManager: inject() called, isActive:', this.isActive);
          if (this.isActive) return { paragraphCount: this.paragraphs.size };
          this.isActive = true;

          // Create container for all icons
          this._createIconContainer();

          // Find and process paragraphs
          const candidates = this._findCandidateParagraphs();
          console.log('ParagraphActionManager: Found', candidates.length, 'candidate paragraphs');
          candidates.forEach(el => this._processElement(el));

          // Set up scroll/resize handlers
          this._setupEventListeners();

          // Initial position update
          this._updateAllPositions();

          console.log('ParagraphActionManager: Injected', this.paragraphs.size, 'paragraph icons');
          console.log('ParagraphActionManager: window.ipcRenderer available:', !!window.ipcRenderer);
          return { paragraphCount: this.paragraphs.size };
        }

        /**
         * Create fixed container for icons
         */
        _createIconContainer() {
          this.iconContainer = document.createElement('div');
          this.iconContainer.id = 'se-paragraph-icons';
          this.iconContainer.style.cssText =
            'position:fixed;top:0;right:0;width:50px;height:100%;pointer-events:none;z-index:999800;';
          document.body.appendChild(this.iconContainer);

          // Add styles
          const style = document.createElement('style');
          style.id = 'se-paragraph-icon-styles';
          style.textContent = \`
            .se-para-icon {
              position: absolute;
              right: 12px;
              width: \${this.options.iconSize}px;
              height: \${this.options.iconSize}px;
              border-radius: 50%;
              border: none;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              font-size: 11px;
              font-weight: bold;
              cursor: pointer;
              pointer-events: auto;
              opacity: \${this.options.iconOpacity};
              transition: all 200ms ease;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .se-para-icon:hover {
              opacity: \${this.options.iconHoverOpacity};
              transform: scale(1.1);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            .se-para-icon:active {
              transform: scale(0.95);
            }
            .se-para-highlight {
              background-color: rgba(102, 126, 234, 0.08) !important;
              outline: 2px solid rgba(102, 126, 234, 0.2);
              outline-offset: 2px;
              border-radius: 4px;
              transition: all 200ms ease;
            }
          \`;
          document.head.appendChild(style);
        }

        /**
         * Find all candidate paragraph elements
         */
        _findCandidateParagraphs() {
          const candidates = [];
          const seen = new Set();

          // Target common content tags
          const selectors = ['p', 'article p', 'main p', '.content p', '.post p', '.article p',
                            'article > div', 'main > div', 'section > p'];

          selectors.forEach(selector => {
            try {
              document.querySelectorAll(selector).forEach(el => {
                if (!seen.has(el) && this._isValidParagraph(el)) {
                  seen.add(el);
                  candidates.push(el);
                }
              });
            } catch (e) { /* skip invalid selectors */ }
          });

          // Also look for divs with direct text content
          document.querySelectorAll('div').forEach(el => {
            if (!seen.has(el) && this._isValidParagraph(el) && this._hasDirectTextContent(el)) {
              seen.add(el);
              candidates.push(el);
            }
          });

          return candidates;
        }

        /**
         * Check if element is a valid paragraph for icon injection
         */
        _isValidParagraph(el) {
          // Skip if inside excluded tags
          const excludeTags = this.options.excludeTags;
          let parent = el.parentElement;
          while (parent) {
            if (excludeTags.includes(parent.tagName.toLowerCase())) return false;
            const role = parent.getAttribute('role');
            if (role && this.options.excludeRoles.includes(role)) return false;
            parent = parent.parentElement;
          }

          // Skip hidden elements
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
          }

          // Check word count
          const text = el.textContent || '';
          const wordCount = this._countWords(text);
          if (wordCount < this.options.minWords) return false;

          // Check link ratio (skip if >50% is links)
          const linkText = Array.from(el.querySelectorAll('a')).map(a => a.textContent).join(' ');
          const linkWordCount = this._countWords(linkText);
          if (wordCount > 0 && linkWordCount / wordCount > this.options.maxLinkRatio) {
            return false;
          }

          // Check if element has reasonable dimensions
          const rect = el.getBoundingClientRect();
          if (rect.width < 100 || rect.height < 20) return false;

          return true;
        }

        /**
         * Check if div has direct text content (not just nested elements)
         */
        _hasDirectTextContent(el) {
          for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 50) {
              return true;
            }
          }
          return false;
        }

        /**
         * Count words in text
         */
        _countWords(text) {
          if (!text) return 0;
          return text.trim().split(/\\s+/).filter(w => w.length > 0).length;
        }

        /**
         * Process a single paragraph element
         */
        _processElement(el) {
          const id = 'se-para-' + (++this.idCounter);
          const text = el.textContent || '';
          const wordCount = this._countWords(text);

          // Create icon button
          const icon = document.createElement('button');
          icon.className = 'se-para-icon';
          icon.id = id + '-icon';
          icon.dataset.paragraphId = id;
          icon.title = 'Analyze paragraph (' + wordCount + ' words)';
          icon.innerHTML = '✨';

          // Store reference
          el.dataset.seParagraphId = id;
          this.paragraphs.set(id, { element: el, iconElement: icon, text, wordCount });

          // Add to container
          this.iconContainer.appendChild(icon);

          // Add click handler - use arrow function to preserve 'this'
          const self = this;
          icon.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Visual feedback that click worked
            icon.style.background = 'red';
            setTimeout(() => {
              icon.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }, 200);
            self._handleIconClick(id, e);
          };

          // Add hover handlers for paragraph highlighting
          icon.addEventListener('mouseenter', () => {
            el.classList.add('se-para-highlight');
          });
          icon.addEventListener('mouseleave', () => {
            el.classList.remove('se-para-highlight');
          });
        }

        /**
         * Handle icon click - send event via multiple methods to ensure delivery
         */
        _handleIconClick(id, event) {
          const data = this.paragraphs.get(id);
          if (!data) {
            console.log('ParagraphIcons: No data for id', id);
            return;
          }

          console.log('ParagraphIcons: Handling click for paragraph', id, 'text length:', data.text.length);

          const messageData = {
            menuType: 'paragraph',
            selectedText: data.text,
            paragraphId: id,
            x: event.clientX,
            y: event.clientY
          };

          let sent = false;

          // Method 1: Try to use ipcRenderer if available (set by preload.js)
          if (window.ipcRenderer && typeof window.ipcRenderer.sendToHost === 'function') {
            console.log('ParagraphIcons: Using window.ipcRenderer.sendToHost');
            window.ipcRenderer.sendToHost('show-context-menu', messageData);
            sent = true;
          }

          // Method 2: Try to require electron directly (nodeintegration is enabled)
          if (!sent) {
            try {
              const { ipcRenderer: ipc } = require('electron');
              console.log('ParagraphIcons: Using required ipcRenderer');
              ipc.sendToHost('show-context-menu', messageData);
              sent = true;
            } catch (e) {
              console.log('ParagraphIcons: Cannot require electron:', e.message);
            }
          }

          // Method 3: Dispatch custom event (preload.js listens for this)
          if (!sent) {
            console.log('ParagraphIcons: Dispatching custom event');
            document.dispatchEvent(new CustomEvent('se-paragraph-action', {
              detail: messageData,
              bubbles: true
            }));
          }

          // Method 4: Also try postMessage as final fallback
          if (!sent) {
            console.log('ParagraphIcons: Using postMessage');
            window.postMessage({
              type: 'se-paragraph-action',
              ...messageData
            }, '*');
          }
        }

        /**
         * Set up scroll and resize listeners
         */
        _setupEventListeners() {
          // Throttled position update
          let ticking = false;
          const updatePositions = () => {
            if (!ticking) {
              requestAnimationFrame(() => {
                this._updateAllPositions();
                ticking = false;
              });
              ticking = true;
            }
          };

          this.scrollHandler = updatePositions;
          this.resizeHandler = updatePositions;

          window.addEventListener('scroll', this.scrollHandler, { passive: true });
          window.addEventListener('resize', this.resizeHandler, { passive: true });
        }

        /**
         * Update positions of all icons
         */
        _updateAllPositions() {
          const viewportHeight = window.innerHeight;

          for (const [id, data] of this.paragraphs) {
            const rect = data.element.getBoundingClientRect();
            const icon = data.iconElement;

            // Only show icons for visible paragraphs
            if (rect.bottom < 0 || rect.top > viewportHeight) {
              icon.style.display = 'none';
            } else {
              icon.style.display = 'flex';
              // Position icon at the first line of paragraph (top + small offset)
              icon.style.top = (rect.top + 4) + 'px';
            }
          }
        }

        /**
         * Get paragraph element by ID
         */
        getParagraph(id) {
          return this.paragraphs.get(id);
        }

        /**
         * Remove all icons and cleanup
         */
        remove() {
          if (!this.isActive) return;

          // Remove event listeners
          if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
          }
          if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
          }

          // Remove highlights
          this.paragraphs.forEach(data => {
            data.element.classList.remove('se-para-highlight');
            delete data.element.dataset.seParagraphId;
          });

          // Remove icon container
          if (this.iconContainer && this.iconContainer.parentNode) {
            this.iconContainer.parentNode.removeChild(this.iconContainer);
          }

          // Remove styles
          const style = document.getElementById('se-paragraph-icon-styles');
          if (style) style.remove();

          this.paragraphs.clear();
          this.iconContainer = null;
          this.isActive = false;
        }

        destroy() { this.remove(); }
      }
      window.ParagraphActionManager = ParagraphActionManager;

      // Base classes (minimal)
      window.BaseEffect = class { constructor(m,o) { this.managers=m; this.options=o; } };
      window.BaseCloneEffect = class { constructor(m,o) { this.managers=m; this.options=o; } };
    `;
  }

  _getMainCode() {
    return `
      (function(global) {
        const wordWrapper = new WordWrapper();
        const positionManager = new PositionManager();
        const cloneManager = new CloneManager();
        const animationEngine = new AnimationEngine();
        const registry = new EffectRegistry();

        const managers = { wordWrapper, positionManager, cloneManager, animationEngine };

        registry.register('highlight', HighlightEffect, { category: 'in-place' });
        registry.register('fadeIn', FadeInEffect, { category: 'in-place' });
        registry.register('flyingAbstract', FlyingAbstractEffect, { category: 'clone-based' });
        registry.register('smartSummary', SmartSummaryEffect, { category: 'clone-based' });
        registry.register('constellationMindmap', ConstellationMindmapEffect, { category: 'visualization' });
        registry.register('entityResolution', EntityResolutionEffect, { category: 'visualization' });

        // Inject minimal styles
        const style = document.createElement('style');
        style.id = 'se-styles';
        style.textContent = '.se-word{display:inline;position:relative}#se-clone-overlay{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999999}.se-clone{position:fixed;margin:0;padding:0;pointer-events:none}.se-flying-word{z-index:999999;text-shadow:0 1px 3px rgba(0,0,0,0.1)}';
        document.head.appendChild(style);

        // Initialize paragraph action manager
        const paragraphManager = new ParagraphActionManager();

        global.studyEnhancer = {
          version: '1.0.0',
          managers,
          registry,
          paragraphManager,

          wrapElement(target) {
            const el = typeof target === 'string' ? document.querySelector(target) : target;
            return el ? wordWrapper.wrapElement(el) : { wordCount: 0, wordIds: [] };
          },

          wrapAllParagraphs() { return wordWrapper.wrapAllParagraphs(); },

          // Paragraph action icons
          injectParagraphIcons(options = {}) {
            return paragraphManager.inject(options);
          },

          removeParagraphIcons() {
            return paragraphManager.remove();
          },

          getParagraph(id) {
            return paragraphManager.getParagraph(id);
          },

          async applyEffect(name, target, options = {}) {
            if (!registry.hasEffect(name)) throw new Error('Effect not registered: ' + name);
            const { instanceId, effect } = registry.createInstance(name, managers, options);
            const result = await effect.apply(target, options);
            return { instanceId, result };
          },

          async removeEffect(instanceId) {
            const effect = registry.getInstance(instanceId);
            if (effect) { await effect.remove(); registry.removeInstance(instanceId); }
          },

          async removeAllEffects() {
            const promises = [];
            registry.getActiveEffects().forEach((e, id) => promises.push(this.removeEffect(id)));
            await Promise.all(promises);
          },

          restoreAll() {
            this.removeAllEffects();
            wordWrapper.restoreAll();
            cloneManager.destroy();
          },

          getWord(id) { return wordWrapper.getWord(id); },
          findWords(text) { return wordWrapper.findWordsByText(text); },

          async highlightWords(texts, options = {}) {
            const matches = [];
            texts.forEach(t => matches.push(...wordWrapper.findWordsByText(t).map(m => m.span)));
            if (matches.length) return this.applyEffect('highlight', matches, options);
          },

          async flyingAbstract(source, abstract, options = {}) {
            this.wrapElement(source);
            return this.applyEffect('flyingAbstract', source, { abstract, ...options });
          },

          listEffects() { return registry.listEffects(); },

          sendEvent(type, data) {
            if (typeof ipcRenderer !== 'undefined') {
              ipcRenderer.sendToHost('study-enhancer-event', { type, ...data });
            }
          }
        };
      })(window);
    `;
  }

  /**
   * Handle messages from webview
   * @private
   */
  _handleMessage(event) {
    if (event.channel === 'study-enhancer-event') {
      const data = event.args[0];
      const listeners = this.eventListeners.get(data.type) || [];
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Execute a command in webview
   * @param {string} command - JavaScript to execute
   * @returns {Promise}
   */
  async _executeCommand(command) {
    if (!this.isInjected) {
      return new Promise((resolve, reject) => {
        this.pendingCommands.push({ command, resolve, reject });
        this.inject();
      });
    }

    return this.webview.executeJavaScript(command);
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Wrap words in an element
   */
  async wrapElement(selector) {
    return this._executeCommand(`window.studyEnhancer.wrapElement('${selector}')`);
  }

  /**
   * Wrap all paragraphs
   */
  async wrapAllParagraphs() {
    return this._executeCommand(`window.studyEnhancer.wrapAllParagraphs()`);
  }

  /**
   * Apply an effect
   */
  async applyEffect(effectName, target, options = {}) {
    const optionsJson = JSON.stringify(options);
    const targetJson = typeof target === 'string' ? `'${target}'` : JSON.stringify(target);
    return this._executeCommand(
      `window.studyEnhancer.applyEffect('${effectName}', ${targetJson}, ${optionsJson})`
    );
  }

  /**
   * Remove an effect
   */
  async removeEffect(instanceId) {
    return this._executeCommand(`window.studyEnhancer.removeEffect('${instanceId}')`);
  }

  /**
   * Remove all effects
   */
  async removeAllEffects() {
    return this._executeCommand(`window.studyEnhancer.removeAllEffects()`);
  }

  /**
   * Restore all wrapped elements
   */
  async restoreAll() {
    return this._executeCommand(`window.studyEnhancer.restoreAll()`);
  }

  /**
   * Highlight specific words
   */
  async highlightWords(words, options = {}) {
    const wordsJson = JSON.stringify(words);
    const optionsJson = JSON.stringify(options);
    return this._executeCommand(
      `window.studyEnhancer.highlightWords(${wordsJson}, ${optionsJson})`
    );
  }

  /**
   * Apply flying abstract effect
   */
  async flyingAbstract(selector, abstract, options = {}) {
    const optionsJson = JSON.stringify(options);
    const abstractJson = JSON.stringify(abstract);
    return this._executeCommand(
      `window.studyEnhancer.flyingAbstract('${selector}', ${abstractJson}, ${optionsJson})`
    );
  }

  /**
   * Apply smart summary effect (with vocabulary highlighting)
   * @param {string} selector - CSS selector for source element
   * @param {string} summary - Summary text from AI
   * @param {string[]} vocabularyWords - User's learning vocabulary
   * @param {Object} options - Additional options
   */
  async smartSummary(selector, summary, vocabularyWords = [], options = {}) {
    const fullOptions = {
      summary,
      vocabularyWords,
      ...options
    };
    const optionsJson = JSON.stringify(fullOptions);
    return this._executeCommand(
      `window.studyEnhancer.applyEffect('smartSummary', '${selector}', ${optionsJson})`
    );
  }

  /**
   * Apply constellation mindmap effect
   * @param {string} selector - CSS selector for source element
   * @param {Object} mindmapData - Mindmap data from AI extraction
   *   { title, root: {id, text, type}, nodes: [{id, text, type, level, parentId}], edges: [{from, to, relation}] }
   * @param {Object} options - Additional options
   */
  async constellationMindmap(selector, mindmapData, options = {}) {
    const fullOptions = {
      mindmapData,
      ...options
    };
    const optionsJson = JSON.stringify(fullOptions);
    return this._executeCommand(
      `window.studyEnhancer.applyEffect('constellationMindmap', '${selector}', ${optionsJson})`
    );
  }

  /**
   * Apply entity resolution effect (coreference linking)
   * @param {string} selector - CSS selector for source element
   * @param {Object} entityData - Entity resolution data from AI
   *   { entities: [{ id, canonicalName, type, references: [{ text, startIndex }] }] }
   * @param {Object} options - Additional options
   */
  async entityResolution(selector, entityData, options = {}) {
    const fullOptions = {
      entityData,
      ...options
    };
    const optionsJson = JSON.stringify(fullOptions);
    return this._executeCommand(
      `window.studyEnhancer.applyEffect('entityResolution', '${selector}', ${optionsJson})`
    );
  }

  /**
   * Inject paragraph action icons
   * @param {Object} options - Options for paragraph detection
   */
  async injectParagraphIcons(options = {}) {
    console.log('StudyEnhancerController: Injecting paragraph icons...');
    // Only pass serializable options (no DOM refs, functions, etc.)
    const safeOptions = {};
    if (options.minWords !== undefined) safeOptions.minWords = options.minWords;
    if (options.iconSize !== undefined) safeOptions.iconSize = options.iconSize;
    if (options.iconOpacity !== undefined) safeOptions.iconOpacity = options.iconOpacity;
    if (options.iconHoverOpacity !== undefined) safeOptions.iconHoverOpacity = options.iconHoverOpacity;
    if (options.maxLinkRatio !== undefined) safeOptions.maxLinkRatio = options.maxLinkRatio;

    const optionsJson = JSON.stringify(safeOptions);
    const result = await this._executeCommand(
      `window.studyEnhancer.injectParagraphIcons(${optionsJson})`
    );
    console.log('StudyEnhancerController: Paragraph icons result:', result);
    return result;
  }

  /**
   * Remove paragraph action icons
   */
  async removeParagraphIcons() {
    return this._executeCommand(`window.studyEnhancer.removeParagraphIcons()`);
  }

  /**
   * Get paragraph data by ID
   * @param {string} paragraphId - The paragraph ID
   */
  async getParagraph(paragraphId) {
    return this._executeCommand(`window.studyEnhancer.getParagraph('${paragraphId}')`);
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType, callback) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    const webview = this.webview;
    if (webview && typeof webview.removeEventListener === 'function') {
      webview.removeEventListener('ipc-message', this._handleMessage);
      webview.removeEventListener('did-navigate', this._handleNavigation);
      webview.removeEventListener('did-navigate-in-page', this._handleNavigation);
    }
    this.eventListeners.clear();
    this.isInjected = false;
  }
}

export default StudyEnhancerController;
