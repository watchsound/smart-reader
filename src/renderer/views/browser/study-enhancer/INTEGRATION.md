# StudyEnhancer Integration Guide

## Quick Start

Add to `Browser.js`:

```javascript
import { useStudyEnhancer } from './study-enhancer';

function Browser({ urlPath, curBook }) {
  const webviewRef = useRef();

  // Initialize StudyEnhancer hook
  const {
    inject,
    isReady,
    applyEffect,
    flyingAbstract,
    highlightWords,
    removeAllEffects,
    restoreAll
  } = useStudyEnhancer(webviewRef);

  // Inject after webview is ready
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = async () => {
      // Inject StudyEnhancer into the page
      await inject();
    };

    webview.addEventListener('dom-ready', handleDomReady);
    return () => webview.removeEventListener('dom-ready', handleDomReady);
  }, [inject]);

  // Example: Highlight vocabulary words
  const handleHighlightVocabulary = async () => {
    const keywords = await customStorage.getKeyWordList(StudyMode.Language);
    if (keywords && keywords.length > 0) {
      await highlightWords(keywords, { color: 'rgba(100, 200, 255, 0.3)' });
    }
  };

  // Example: Flying Abstract with AI
  const handleFlyingAbstract = async () => {
    // 1. Get paragraph text
    const paragraphText = await webviewRef.current.executeJavaScript(`
      document.querySelector('p')?.textContent || ''
    `);

    if (!paragraphText) return;

    // 2. Generate abstract using AI
    const prompt = `Summarize this paragraph in one sentence using only words from the original text:\n\n${paragraphText}`;
    const abstract = await aiProviderManager.generateContent(prompt);

    // 3. Apply flying abstract effect
    await flyingAbstract('p', abstract, {
      duration: 1000,
      staggerDelay: 80
    });
  };

  // Cleanup when URL changes
  useEffect(() => {
    return () => {
      restoreAll();
    };
  }, [currentUrl]);

  // ... rest of Browser.js
}
```

## Available Effects

### 1. Highlight Effect
```javascript
await applyEffect('highlight', '.se-word', {
  color: 'rgba(255, 255, 0, 0.4)',  // Background color
  textColor: null,                   // Optional text color
  duration: 300,                     // Animation duration
  animate: true                      // Whether to animate
});
```

### 2. FadeIn Effect
```javascript
await applyEffect('fadeIn', 'p', {
  duration: 500,          // Fade duration per word
  staggerDelay: 50,       // Delay between words
  slideUp: true,          // Also slide up while fading
  slideDistance: 10       // Slide distance in pixels
});
```

### 3. Flying Abstract Effect
```javascript
await flyingAbstract('p.content', 'This is the abstract text', {
  duration: 800,              // Flight duration
  staggerDelay: 50,           // Delay between words
  dimSource: true,            // Dim source words
  dimOpacity: 0.3,            // How much to dim
  showContainer: true,        // Show background container
  targetPosition: 'center',   // 'center', 'top', 'bottom', or {x, y}
  targetMaxWidth: 500         // Max width of abstract container
});
```

## Adding to Context Menu

In `BrowserContextMenu.js`, add a new menu item:

```javascript
{
  icon: <AutoAwesomeIcon />,
  label: 'Animate Abstract',
  action: 'flyingAbstract'
}
```

Then handle in `Browser.js`:

```javascript
const handleContextMenuCommand = (command, selectedText) => {
  if (command === 'flyingAbstract') {
    handleFlyingAbstract();
  }
  // ... other commands
};
```

## Creating Custom Effects

1. Create a new effect class:

```javascript
// src/webview-scripts/study-enhancer/effects/MyCustomEffect.js
class MyCustomEffect {
  constructor(managers, options = {}) {
    this.managers = managers;
    this.options = options;
    this.isActive = false;
  }

  async apply(target, options = {}) {
    // Your effect logic
  }

  async remove() {
    // Cleanup logic
  }

  destroy() {
    this.remove();
  }
}
```

2. Register in index.js:

```javascript
registry.register('myCustom', MyCustomEffect, {
  category: 'in-place',
  description: 'My custom effect'
});
```

3. Use it:

```javascript
await applyEffect('myCustom', 'p', { /* options */ });
```

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│ Renderer Process (Browser.js)                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ useStudyEnhancer() hook                                 │ │
│  │   └── StudyEnhancerController                          │ │
│  │         ├── inject() - Injects bundle into webview     │ │
│  │         ├── applyEffect() - Sends commands             │ │
│  │         └── on() - Listens for events                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          │ executeJavaScript()               │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Webview (Page Context)                                  │ │
│  │   └── window.studyEnhancer                             │ │
│  │         ├── WordWrapper (wraps words in spans)         │ │
│  │         ├── CloneManager (creates flying clones)       │ │
│  │         ├── AnimationEngine (handles animations)       │ │
│  │         └── EffectRegistry (manages effects)           │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Tips

1. **Always inject after dom-ready** - The webview needs to be fully loaded
2. **Restore on URL change** - Clean up effects when navigating away
3. **Use stagger for large selections** - Looks better than all-at-once
4. **Combine with AI** - Use AIProviderManager for smart content analysis
5. **Test on different pages** - Some pages may have complex DOM structures
