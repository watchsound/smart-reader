## StudyEnhancer System

A comprehensive text animation system for making web content more study-friendly. Located in `src/renderer/views/browser/study-enhancer/`.

### Architecture

```
Renderer Process (Browser.js)
├── useStudyEnhancer() hook
│   └── StudyEnhancerController
│       ├── inject() - Injects bundle into webview
│       ├── applyEffect() - Sends commands
│       └── smartSummary() - AI-powered summary with animation
│
└── Webview (Page Context)
    └── window.studyEnhancer
        ├── WordWrapper - Wraps words in <span> tags using TreeWalker
        ├── CloneManager - Creates positioned clones for animation
        ├── AnimationEngine - Handles flying animations with Bezier curves
        ├── PositionManager - Captures word positions
        └── EffectRegistry - Plugin system for effects
```

### Key Files

- **StudyEnhancerController.js**: Renderer-side controller with inlined bundle code (~1200 lines)
- **useStudyEnhancer.js**: React hook exposing `inject()`, `smartSummary()`, `highlightWords()`, etc.
- **effects/SmartSummaryEffect.js**: Standalone effect file (reference implementation)

### Smart Summary Feature

Accessible via context menu "Smart Summary" option:

1. User selects text → clicks "Smart Summary"
2. AI generates summary using words from source text + user's vocabulary
3. Page dims with overlay
4. Matching words in source glow and pulse
5. Word clones fly along curved Bezier paths to summary panel
6. Non-matching words fade in directly
7. Panel includes "Save Note" and close buttons

### Effect Types

- **highlight**: Background color highlighting with stagger
- **fadeIn**: Fade in words with optional slide-up
- **flyingAbstract**: Fly words to form abstract (basic version)
- **smartSummary**: Full "Word Constellation" effect with:
  - Page dimming
  - Source word glow (vocabulary words in gold, regular in blue)
  - Curved flight paths (quadratic Bezier)
  - Word slots with fade-in for unmatched words
  - Save Note functionality via IPC

### Integration Pattern

```javascript
// In Browser.js
const { inject, smartSummary, isReady } = useStudyEnhancer(webviewRef);

// On context menu "Smart Summary"
const handleSmartSummary = async (selectedText) => {
  const prompt = createSmartSummaryPrompt(selectedText, vocabularyWords);
  const result = await aiProviderManager.generateContentWithJson(prompt);
  await smartSummary('#source-element', result.summary, vocabularyWords);
};
```

### Paragraph Action Icons

Floating icons that appear at the right edge of meaningful paragraphs, providing quick access to AI features:

**Components:**
- **ParagraphActionManager** (in StudyEnhancerController.js): Detects paragraphs with 50+ words and injects floating icons
- **BrowserToolbar**: Toggle button (✨ AutoAwesome icon) to show/hide paragraph icons
- **BrowserContextMenu**: `paragraph` menu type with Smart Summary, Mind Map, Entity Links options

**Architecture (Context Isolation Workaround):**
```
Injected Script (page context)          Preload Script (isolated world)
─────────────────────────────          ──────────────────────────────
ParagraphActionManager                  window.addEventListener('message')
  └── _handleIconClick()                  └── if (type === 'se-paragraph-action')
        └── window.postMessage({              └── ipcRenderer.sendToHost('show-context-menu')
              type: 'se-paragraph-action',
              menuType: 'paragraph',               ↓
              selectedText, paragraphId,
              x, y                          Browser.js (renderer)
            })                              └── handleWebviewMessage()
                                                └── setContextMenu({ menuType: 'paragraph' })
```

**Key Implementation Details:**
- Scripts injected via `executeJavaScript` run in page context, isolated from preload script
- `window.ipcRenderer` set by preload is NOT accessible to injected scripts
- Solution: Use `postMessage` API - injected script posts, preload listens and forwards via IPC
- Icons positioned using `position: fixed` and update on scroll/resize
- Paragraph detection: `<p>`, `<article>`, `<section>`, `<div>` elements with 50+ words
- Icons auto-hide when paragraph scrolls out of viewport

**Usage:**
```javascript
const { injectParagraphIcons, removeParagraphIcons, toggleParagraphIcons, paragraphIconsActive } = useStudyEnhancer(webviewRef);

// Toggle via toolbar button
<IconButton onClick={toggleParagraphIcons}>
  <AutoAwesomeIcon />
</IconButton>
```

### IPC Events

The webview sends events to renderer via `ipcRenderer.sendToHost()`:
- `study-enhancer-event` with `type: 'createNote'` - Creates note from summary content
- `show-context-menu` with `menuType: 'paragraph'` - Shows context menu for paragraph actions (forwarded from postMessage)
