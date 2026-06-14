## Animation Core System

A modular animation system extracted from StudyEnhancer for use across different views (EPUB, PDF, Notes, Browser). Located in `src/renderer/components/animation-core/`.

### Architecture

```
animation-core/
├── index.js                    # Main exports
├── AnimationCore.js            # Main controller class
├── useAnimationCore.js         # React hook
├── WordWrapper.js              # Wraps words in DOM elements
├── AnimationEngine.js          # Animation primitives (fly, fade, glow)
├── CloneManager.js             # Creates floating clones for animations
├── PositionManager.js          # Tracks positions and calculates layouts
├── EffectRegistry.js           # Plugin system for effects
├── effects/
│   ├── BaseEffect.js           # Abstract base class
│   ├── HighlightEffect.js      # Background color highlighting
│   ├── FadeInEffect.js         # Sequential word fade-in
│   ├── GlowEffect.js           # Text glow with pulse
│   ├── FlyingWordEffect.js     # Fly words to target position
│   └── LeitnerTransitionEffect.js  # Leitner box transitions
└── adapters/
    ├── index.js                # Adapter exports
    ├── EPUBAdapter.js          # For epub.js iframe rendering
    ├── useEPUBAnimations.js    # React hook for EPUB
    ├── PDFAdapter.js           # For PDF.js text layers
    ├── usePDFAnimations.js     # React hook for PDF
    ├── NoteAdapter.js          # For Notes/Leitner views
    └── useNoteAnimations.js    # React hook for Notes
```

### Core Components

| Component | Purpose |
|-----------|---------|
| `AnimationCore` | Main controller orchestrating all animation components |
| `WordWrapper` | Wraps individual words in `<span>` elements for targeting |
| `AnimationEngine` | Animation primitives: `fly()`, `flyBezier()`, `pulse()`, `fadeIn()`, `fadeOut()`, `glow()` |
| `CloneManager` | Creates positioned clones for flying animations with dimming support |
| `PositionManager` | Captures word positions and calculates target layouts (grid, mindmap) |
| `EffectRegistry` | Plugin system for registering and managing custom effects |

### Built-in Effects

| Effect | Description |
|--------|-------------|
| `HighlightEffect` | Background color highlighting with configurable color and stagger |
| `FadeInEffect` | Sequential word fade-in with optional slide-up animation |
| `GlowEffect` | Text glow with pulse effect (configurable color and intensity) |
| `FlyingWordEffect` | Fly words to target position with Bezier curves |
| `LeitnerTransitionEffect` | Animated transitions for Leitner box changes (correct/incorrect/promotion) |

### View-Specific Adapters

Adapters bridge AnimationCore with different rendering contexts:

| Adapter | Context | Key Methods |
|---------|---------|-------------|
| `EPUBAdapter` | epub.js iframe | `highlightVocabulary()`, `glowWords()`, `smartSummary()` |
| `PDFAdapter` | PDF.js text layers | `highlightVocabulary()`, `glowWords()`, `smartSummary()` |
| `NoteAdapter` | DOM (Notes/Leitner) | `highlightKeywords()`, `animateCorrect()`, `animateIncorrect()`, `animateBoxTransition()` |

### Usage with React Hooks

**EPUB Animations:**
```javascript
import { useEPUBAnimations } from '../components/animation-core';

function EPubView({ rendition }) {
  const { isReady, highlightVocabulary, smartSummary, removeAllEffects } = useEPUBAnimations(rendition);

  const handleHighlight = async () => {
    await highlightVocabulary(['important', 'words'], { color: '#ffd700' });
  };

  return <button onClick={handleHighlight}>Highlight</button>;
}
```

**PDF Animations:**
```javascript
import { usePDFAnimations } from '../components/animation-core';

function PDFView({ containerRef }) {
  const { highlightVocabulary, glowWords } = usePDFAnimations(containerRef);

  // Highlight vocabulary in PDF text layers
  await highlightVocabulary(['concept', 'term']);
}
```

**Leitner/Note Animations:**
```javascript
import { useNoteAnimations } from '../components/animation-core';

function FlashCard({ card }) {
  const cardRef = useRef(null);
  const { animateCorrect, animateIncorrect, animateBoxTransition } = useNoteAnimations(cardRef);

  const handleCorrect = async () => {
    await animateCorrect(cardRef.current);     // Green glow + scale
    await animateBoxTransition(cardRef.current, 1, 2);  // Slide to box 2
  };

  const handleIncorrect = async () => {
    await animateIncorrect(cardRef.current);   // Red shake
    await animateBoxTransition(cardRef.current, 3, 1);  // Back to box 1
  };

  return <div ref={cardRef}>...</div>;
}
```

### Usage without Hooks

```javascript
import { AnimationCore } from '../components/animation-core';

const core = new AnimationCore({ container: myElement });
await core.initialize();

// Highlight words
await core.highlightWords(['important', 'words'], { color: '#ffd700' });

// Glow effect
await core.glowWords(['concept'], { color: '#00bfff', pulse: true });

// Cleanup
await core.destroy();
```

### Creating Custom Effects

```javascript
import { BaseEffect } from '../components/animation-core';

class MyCustomEffect extends BaseEffect {
  static get effectName() { return 'myCustom'; }

  async apply(words, options = {}) {
    const wrappedWords = await this.wrapWords(words);

    for (const word of wrappedWords) {
      word.element.style.color = 'red';
      word.element.style.fontWeight = 'bold';
    }

    return {
      wordCount: wrappedWords.length,
      cleanup: () => this.remove()
    };
  }

  async remove() {
    // Cleanup logic
  }
}

// Register the effect
import { EffectRegistry } from '../components/animation-core';
const registry = new EffectRegistry();
registry.register(MyCustomEffect);
```

### Animation Engine Methods

| Method | Description |
|--------|-------------|
| `fly(element, from, to, options)` | Linear flight from point A to B |
| `flyBezier(element, from, to, options)` | Curved flight using quadratic Bezier |
| `flyMultiple(flights, staggerOptions)` | Staggered multiple flights |
| `pulse(element, options)` | Scale up then down |
| `fadeIn(element, options)` | Fade in with optional slide-up |
| `fadeOut(element, options)` | Fade out with optional slide-down |
| `glow(element, options)` | Text shadow glow effect |
| `removeGlow(element, options)` | Remove glow effect |
| `stagger(elements, animateFn, options)` | Staggered animation for multiple elements |

### Easing Functions

Available in `AnimationEngine.easings`:
- `linear`, `easeIn`, `easeOut`, `easeInOut`
- `easeInCubic`, `easeOutCubic`
- `easeOutBack`, `easeOutElastic`
