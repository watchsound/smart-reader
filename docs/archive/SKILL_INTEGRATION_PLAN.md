# Skill Integration Plan: EPUB Reader, PDF Viewer, Browser

## Executive Summary

This plan outlines **minimal, safe enhancements** to integrate the skill system more deeply across reading views in SmartReader v2. The existing codebase is complex, so we focus on:
1. **Extending existing patterns** rather than creating new ones
2. **Leveraging InContextChatPanel** which already has full skill integration
3. **Small, targeted changes** to existing components
4. **No major refactoring** of working code

**Current State Analysis:**
- **Browser**: Has `handleSmartSummary`, `handleMindmap`, `handleEntityResolution` using direct AI calls (lines 407-598 in Browser.js)
- **EPUB Reader**: Uses `EReaderPage` wrapper in `index.js` which embeds `InContextChatPanel` in tab (line 780)
- **PDF Viewer**: Embedded via same `EReaderPage` wrapper, shares same tab structure
- **InContextChatPanel**: Already has `quickActions` array with skill mappings (lines 716-774) and `executeSkillDirect` method (lines 777-843)

**Key Insight:** The `InContextChatPanel` already has all the skill infrastructure. The EPUB/PDF views already embed it. The real gaps are:
1. Browser context menu uses direct AI, not skills
2. Quick actions in InContextChatPanel are not prominent enough
3. No text selection menu in EPUB/PDF (they only have annotation dialogs)

---

## Revised Approach: Minimal Changes

### Principle 1: Don't Rewrite Working Code
The Browser's Smart Summary/Mind Map/Entity Links work well. We should **wrap** them with skill calls, not replace them.

### Principle 2: Extend InContextChatPanel
It already has skill mode, quick actions, and tool tracking. We should enhance its visibility, not duplicate it.

### Principle 3: Add, Don't Replace
For EPUB/PDF text selection, add a lightweight menu alongside existing annotation system.

---

## Phase 1: Browser View - Skill Wrapper (Lowest Risk)

The goal is to **route existing AI functionality through the skill system** for consistency and tracking, while adding **new skill options** to menus.

### 1.1 Create useSkillBridge Hook (Minimal New Code)

**File:** `src/renderer/hooks/useSkillBridge.js`

A lightweight hook that wraps skillApi for use in views. This is the ONLY new shared component needed.

```javascript
/**
 * useSkillBridge - Bridge between views and skill system
 * Provides skill execution with loading states and result handling
 */
import { useState, useCallback } from 'react';
import skillApi from '../api/skillApi';
import customStorage from '../store/customStorage';

export function useSkillBridge() {
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [lastSkill, setLastSkill] = useState(null);

  const execute = useCallback(async (skillName, params) => {
    setExecuting(true);
    setLastSkill(skillName);
    try {
      const token = await customStorage.getToken();
      const result = await skillApi.executeSkill(skillName, params, token);
      setLastResult(result);
      return result;
    } catch (error) {
      console.error(`Skill ${skillName} failed:`, error);
      throw error;
    } finally {
      setExecuting(false);
    }
  }, []);

  return { execute, executing, lastResult, lastSkill };
}
```

**Why this approach:**
- Single file, ~30 lines
- No new UI components (reuse existing patterns)
- Can be adopted incrementally per view

---

## Phase 1: Browser View - Wrap Existing AI Calls (Safest Change)

### 1.2 Modify Browser.js - Add Skill Wrapper Functions

**File:** `src/renderer/views/browser/Browser.js`

**Strategy:** Keep existing `handleSmartSummary`, `handleMindmap`, `handleEntityResolution` but ADD parallel skill calls for tracking. Do NOT remove working code.

**Changes (lines ~407-598):**

```javascript
// Add import at top
import { useSkillBridge } from '../../hooks/useSkillBridge';

// Inside Browser function, add hook
const { execute: executeSkill, executing: skillExecuting } = useSkillBridge();

// MODIFY handleSmartSummary to also call skill for tracking
const handleSmartSummary = async (selectedText, sourceElementId = null) => {
  if (!selectedText || selectedText.length < 20) return;

  try {
    const vocabularyWords = await customStorage.getKeyWordList(StudyMode.Language) || [];

    // NEW: Execute skill for tracking (non-blocking, fire-and-forget)
    executeSkill('smart_summary', {
      text: selectedText,
      vocabularyWords,
      maxWords: 30
    }).catch(e => console.log('Skill tracking failed:', e));

    // KEEP: Existing AI call and animation logic unchanged
    const prompt = createSmartSummaryPrompt(selectedText, vocabularyWords);
    const result = await aiProviderManager.generateContentWithJson(prompt, true);
    // ... rest of existing code ...
  } catch (error) {
    console.error('Smart Summary error:', error);
  }
};
```

**Why this approach:**
- Existing animation system continues to work
- Skill system tracks usage
- Zero risk of breaking working features
- Can be upgraded to full skill-based later

### 1.3 Add New Menu Items to BrowserContextMenu.js

**File:** `src/renderer/views/browser/BrowserContextMenu.js`

**Strategy:** Add new skill-based items BELOW existing items. Keep existing items unchanged.

**Add to menu items array (after line ~200):**

```javascript
// NEW SKILL ITEMS (add to selection menu, after existing Smart Summary/Mind Map)
{
  id: 'quizGenerate',
  label: 'Generate Quiz',
  icon: <QuizIcon />,
  minWords: 30,  // Require substantial text
  onClick: () => onCommand('quizGenerate', selectedText),
},
{
  id: 'simplifyText',
  label: 'Simplify Text',
  icon: <AccessibilityIcon />,
  minWords: 15,
  onClick: () => onCommand('simplifyText', selectedText),
},
{
  id: 'analyzeStructure',
  label: '5W Analysis',
  icon: <AnalyticsIcon />,
  minWords: 20,
  onClick: () => onCommand('analyzeStructure', selectedText),
},
```

**Modify handleContextMenuCommand in Browser.js:**

```javascript
// Add to handleContextMenuCommand (around line 601)
if (command === 'quizGenerate') {
  const result = await executeSkill('quiz_generate', {
    text: selectedText,
    questionCount: 4
  });
  // Show result in sidebar or modal
  if (result?.quiz) {
    // Option 1: Open quiz modal
    // Option 2: Show in InContextChatPanel
  }
}
if (command === 'simplifyText') {
  const result = await executeSkill('text_simplify', {
    text: selectedText,
    targetLevel: 'middle'
  });
  // Show simplified text
}
if (command === 'analyzeStructure') {
  const result = await executeSkill('analyze_structure', { text: selectedText });
  // Show 5W analysis
}
```

---

## Phase 2: EPUB/PDF - Enhance Existing InContextChatPanel Usage

### 2.1 Modify InContextChatPanel to Accept Selection Prop

**File:** `src/renderer/components/chat/InContextChatPanel.js`

**Current State:** InContextChatPanel uses internal `articleStr` state which comes from book content. It doesn't have direct access to user's text selection.

**Strategy:** Add optional `selectedText` prop for direct skill execution on selection.

**Changes:**

```javascript
// Modify function signature (around line 100)
function InContextChatPanel({
  curBook,
  selectedText = '',  // NEW: Optional selected text from parent view
  onSelectionAction,  // NEW: Callback when skill executes on selection
}) {
  // Existing code...

  // NEW: When selectedText changes, show quick action prompt
  useEffect(() => {
    if (selectedText && selectedText.length > 10) {
      // Highlight that user can use quick actions on selection
      setShowSelectionHint(true);
    }
  }, [selectedText]);
```

**Why this works:**
- EPUB/PDF views already embed InContextChatPanel
- Just need to pass `selectedText` prop from parent
- Quick actions already exist, just need to use selection instead of articleStr

### 2.2 Modify EReaderPage to Pass Selection

**File:** `src/renderer/views/reading/index.js`

**Current:** EPubView and PDFView manage their own selection state. EReaderPage doesn't track it.

**Strategy:** Lift selection state to EReaderPage, pass to InContextChatPanel.

```javascript
// In EReaderPage function (around line 668)
function EReaderPage() {
  const [tabValue, setTabValue] = React.useState(0);
  const [bookPath, setBookPath] = React.useState('');
  const [selectedText, setSelectedText] = React.useState('');  // NEW

  // ... existing code ...

  // Modify rightPanel to pass selectedText
  const rightPanel = (
    <Box sx={{ width: '100%' }}>
      {/* ... tabs ... */}
      <CustomTabPanel value={tabValue} index={2}>
        <InContextChatPanel
          curBook={book}
          selectedText={selectedText}  // NEW
        />
      </CustomTabPanel>
    </Box>
  );

  // Modify mainPanelEPub to report selection
  const mainPanelEPub = (
    <EPubView
      bookPath={bookPath}
      curBook={book}
      curCfi={note ? note.cfi : ''}
      onSelectionChange={setSelectedText}  // NEW callback
    />
  );
```

### 2.3 Modify EPubView to Report Selection

**File:** `src/renderer/views/reading/EPubView.js`

**Strategy:** Add `onSelectionChange` prop, call it when user selects text.

```javascript
// Modify function signature (line 68)
function EPubView({ bookPath, curBook, curCfi, onSelectionChange }) {
  // ... existing code ...

  // Find existing selection handling (look for setSelections usage)
  // Add callback when selection changes
  useEffect(() => {
    if (rendition) {
      rendition.on('selected', (cfiRange) => {
        const range = rendition.getRange(cfiRange);
        const text = range.toString();
        setSelections([{ cfiRange, text }]);  // Existing
        if (onSelectionChange) {
          onSelectionChange(text);  // NEW: Notify parent
        }
      });
    }
  }, [rendition, onSelectionChange]);
```

### 2.4 Same Pattern for PDFView

**File:** `src/renderer/views/reading/PDFView.js`

Similar changes to pass selection to parent.

---

## Phase 3: Add Quick Actions Visibility in InContextChatPanel

### 3.1 Make Quick Actions More Prominent

**File:** `src/renderer/components/chat/InContextChatPanel.js`

**Current:** Quick actions are at the bottom, require scrolling.

**Strategy:** When `selectedText` prop is provided, show quick actions prominently at top.

```javascript
// Add new component inside InContextChatPanel (around line 920)
{selectedText && selectedText.length > 10 && (
  <Box sx={{
    p: 1,
    bgcolor: 'action.hover',
    borderRadius: 1,
    mb: 1,
    border: '1px dashed',
    borderColor: 'primary.main'
  }}>
    <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
      Selected: "{selectedText.substring(0, 50)}..."
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {quickActions.slice(0, 5).map((action) => (
        <Chip
          key={action.id}
          label={action.label}
          size="small"
          onClick={() => handleQuickAction(action)}
          icon={action.icon}
        />
      ))}
    </Box>
  </Box>
)}
```

---

## Phase 4: EPUB/PDF Animation Support

EPUB and PDF are the primary reading materials in SmartReader. Adding animation support brings the same engaging Smart Summary experience from the Browser view to these core reading views.

### 4.1 Architecture Overview

The animation-core system already has adapters for EPUB and PDF:

```
src/renderer/components/animation-core/
├── adapters/
│   ├── EPUBAdapter.js      # Already exists - needs integration
│   ├── PDFAdapter.js       # Already exists - needs integration
│   ├── useEPUBAnimations.js # React hook for EPUB
│   └── usePDFAnimations.js  # React hook for PDF
```

**Key Insight:** Both epub.js and PDF.js provide DOM access for word positions:
- **EPUB**: `rendition.views()._views[0].iframe.contentDocument` gives us the iframe DOM
- **PDF**: `.textLayer span` elements are accessible for `getBoundingClientRect()`

### 4.2 EPUB Animation Integration

**File:** `src/renderer/views/reading/EPubView.js`

**Strategy:** Use existing `EPUBAdapter` with the rendition object.

```javascript
// Add imports
import { useEPUBAnimations } from '../../components/animation-core';

function EPubView({ bookPath, curBook, curCfi, onSelectionChange }) {
  const [rendition, setRendition] = useState(null);

  // NEW: Initialize animation system
  const {
    isReady: animationReady,
    highlightVocabulary,
    smartSummary,
    removeSummary,
    removeAllEffects
  } = useEPUBAnimations(rendition);

  // ... existing code ...

  // NEW: Handle Smart Summary from context menu or quick action
  const handleSmartSummary = async (selectedText) => {
    if (!animationReady || !selectedText) return;

    try {
      // Get vocabulary words for highlighting
      const vocabularyWords = await customStorage.getKeyWordList(StudyMode.Language) || [];

      // Call AI for summary
      const prompt = createSmartSummaryPrompt(selectedText, vocabularyWords);
      const result = await aiProviderManager.generateContentWithJson(prompt, true);

      if (result?.summary) {
        // Trigger flying word animation
        await smartSummary(selectedText, result.summary, {
          vocabularyWords,
          glowColor: '#ffd700',  // Gold for vocabulary words
          onSaveNote: (content) => handleCreateNote(content),
        });
      }
    } catch (error) {
      console.error('EPUB Smart Summary error:', error);
    }
  };

  // Cleanup on unmount or page change
  useEffect(() => {
    return () => {
      if (animationReady) {
        removeAllEffects();
      }
    };
  }, [animationReady, removeAllEffects]);
```

**Selection Menu Addition:**

```javascript
// In the existing selection handling (where annotation dialog appears)
// Add Smart Summary option alongside highlight/underline/note

const handleSelection = (cfiRange, contents) => {
  const text = contents.window.getSelection().toString();

  // Show selection menu with options:
  // 1. Highlight (existing)
  // 2. Underline (existing)
  // 3. Add Note (existing)
  // 4. Smart Summary (NEW)
  // 5. Explain (NEW)

  setSelectionMenu({
    visible: true,
    cfiRange,
    text,
    position: getSelectionPosition(contents),
  });
};
```

### 4.3 PDF Animation Integration

**File:** `src/renderer/views/reading/PDFView.js`

**Strategy:** Use existing `PDFAdapter` with the container ref.

```javascript
// Add imports
import { usePDFAnimations } from '../../components/animation-core';

function PDFView({ bookPath, curBook, onSelectionChange }) {
  const containerRef = useRef(null);

  // NEW: Initialize animation system
  const {
    isReady: animationReady,
    highlightVocabulary,
    smartSummary,
    removeSummary,
    removeAllEffects
  } = usePDFAnimations(containerRef);

  // ... existing code ...

  // NEW: Handle Smart Summary
  const handleSmartSummary = async (selectedText) => {
    if (!animationReady || !selectedText) return;

    try {
      const vocabularyWords = await customStorage.getKeyWordList(StudyMode.Language) || [];
      const prompt = createSmartSummaryPrompt(selectedText, vocabularyWords);
      const result = await aiProviderManager.generateContentWithJson(prompt, true);

      if (result?.summary) {
        await smartSummary(selectedText, result.summary, {
          vocabularyWords,
          glowColor: '#ffd700',
          onSaveNote: (content) => handleCreateNote(content),
        });
      }
    } catch (error) {
      console.error('PDF Smart Summary error:', error);
    }
  };
```

### 4.4 Enhance EPUBAdapter for Full Flying Animation

**File:** `src/renderer/components/animation-core/adapters/EPUBAdapter.js`

The current adapter has basic structure. Enhance for full flying word support:

```javascript
/**
 * Enhanced smartSummary with flying words
 */
async smartSummary(sourceText, summaryText, options = {}) {
  if (!this.isInitialized) {
    await this.initialize();
  }

  const { vocabularyWords = [], glowColor = '#00bfff', onSaveNote } = options;

  // 1. Create dim overlay in renderer DOM (outside iframe)
  const overlay = this._createOverlay();

  // 2. Wrap words in source element within iframe
  const sourceElement = this._findSourceElement(sourceText);
  if (!sourceElement) {
    console.warn('EPUBAdapter: Could not find source element');
    return { matchCount: 0 };
  }

  // 3. Wrap words and get positions (within iframe)
  const wrappedResult = this.animationCore.wordWrapper.wrapElement(sourceElement);

  // 4. Find matching words between source and summary
  const summaryWords = summaryText.split(/\s+/).filter(w => w.length > 2);
  const matches = this.animationCore.wordWrapper.findMultipleWords(summaryWords);

  // 5. Get positions and convert to renderer coordinates
  const wordPositions = [];
  for (const [word, data] of matches) {
    const rect = data.span.getBoundingClientRect();
    const iframeRect = this._getIframeRect();

    // Convert iframe-relative to renderer-relative
    wordPositions.push({
      word,
      span: data.span,
      x: rect.left + iframeRect.left,
      y: rect.top + iframeRect.top,
      width: rect.width,
      height: rect.height,
      isVocabulary: vocabularyWords.some(v =>
        v.toLowerCase() === word.toLowerCase()
      ),
    });
  }

  // 6. Glow source words
  for (const pos of wordPositions) {
    pos.span.style.textShadow = pos.isVocabulary
      ? '0 0 8px #ffd700, 0 0 16px #ffd700'  // Gold for vocabulary
      : `0 0 8px ${glowColor}, 0 0 16px ${glowColor}`;
    pos.span.style.animation = 'epub-ac-glow-pulse 1.5s ease-in-out infinite';
  }

  // 7. Create summary panel in renderer DOM
  const summaryPanel = this._createSummaryPanel(summaryText, onSaveNote);

  // 8. Create clones and fly them
  await this._flyWordsToSummary(wordPositions, summaryPanel);

  return { matchCount: wordPositions.length };
}

/**
 * Get iframe bounding rect for coordinate conversion
 */
_getIframeRect() {
  const views = this.rendition?.views?.();
  if (!views?._views?.[0]) return { left: 0, top: 0 };

  const view = views._views[0];
  const iframe = view.iframe || view.element?.querySelector('iframe');
  return iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
}

/**
 * Create overlay in renderer DOM
 */
_createOverlay() {
  let overlay = document.getElementById('epub-ac-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'epub-ac-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 20, 0.4);
      z-index: 999990;
      opacity: 0;
      transition: opacity 400ms ease-out;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);
  }

  requestAnimationFrame(() => overlay.style.opacity = '1');
  return overlay;
}

/**
 * Create summary panel with slots for flying words
 */
_createSummaryPanel(summaryText, onSaveNote) {
  const panel = document.createElement('div');
  panel.id = 'epub-ac-summary-panel';
  panel.style.cssText = `
    position: fixed;
    left: 50%; top: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    max-width: 500px;
    background: linear-gradient(135deg, rgba(30, 35, 50, 0.98), rgba(20, 25, 40, 0.98));
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
    z-index: 999997;
    opacity: 0;
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
  header.textContent = '✨ SMART SUMMARY';
  panel.appendChild(header);

  // Content with word slots
  const content = document.createElement('div');
  content.id = 'epub-ac-summary-content';
  content.style.cssText = `
    font-size: 16px;
    line-height: 1.8;
    color: #fff;
    min-height: 100px;
  `;

  // Create slots for each word
  const words = summaryText.split(/(\s+)/);
  words.forEach((word, i) => {
    if (word.trim()) {
      const slot = document.createElement('span');
      slot.className = 'epub-ac-word-slot';
      slot.dataset.word = word.toLowerCase().replace(/[.,!?;:'"]/g, '');
      slot.dataset.index = i;
      slot.style.cssText = `
        display: inline-block;
        opacity: 0;
        transform: translateY(5px);
        transition: opacity 300ms ease-out, transform 300ms ease-out;
      `;
      slot.textContent = word;
      content.appendChild(slot);
    } else {
      content.appendChild(document.createTextNode(word));
    }
  });
  panel.appendChild(content);

  // Buttons
  const buttons = document.createElement('div');
  buttons.style.cssText = `
    display: flex;
    gap: 8px;
    margin-top: 16px;
    justify-content: flex-end;
  `;

  if (onSaveNote) {
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '📝 Save Note';
    saveBtn.style.cssText = `
      background: rgba(100, 180, 255, 0.2);
      border: 1px solid rgba(100, 180, 255, 0.3);
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
    `;
    saveBtn.onclick = () => onSaveNote(summaryText);
    buttons.appendChild(saveBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = `
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
  `;
  closeBtn.onclick = () => this.removeSummary();
  buttons.appendChild(closeBtn);

  panel.appendChild(buttons);
  document.body.appendChild(panel);

  // Animate in
  requestAnimationFrame(() => {
    panel.style.opacity = '1';
    panel.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  return panel;
}

/**
 * Fly words from source to summary panel slots
 */
async _flyWordsToSummary(wordPositions, summaryPanel) {
  const content = summaryPanel.querySelector('#epub-ac-summary-content');
  const slots = content.querySelectorAll('.epub-ac-word-slot');

  // Match slots with source positions
  const flights = [];
  slots.forEach((slot) => {
    const slotWord = slot.dataset.word;
    const sourcePos = wordPositions.find(p =>
      p.word.toLowerCase().replace(/[.,!?;:'"]/g, '') === slotWord
    );

    if (sourcePos) {
      const slotRect = slot.getBoundingClientRect();
      flights.push({
        word: slotWord,
        from: { x: sourcePos.x, y: sourcePos.y },
        to: { x: slotRect.left, y: slotRect.top },
        slot,
        isVocabulary: sourcePos.isVocabulary,
      });
    } else {
      // No source match - just fade in
      setTimeout(() => {
        slot.style.opacity = '1';
        slot.style.transform = 'translateY(0)';
      }, 800 + Math.random() * 400);
    }
  });

  // Animate flights with stagger
  for (let i = 0; i < flights.length; i++) {
    const flight = flights[i];
    await this._animateFlight(flight, i * 50);
  }
}

/**
 * Animate single word flight
 */
async _animateFlight(flight, delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Create flying clone
      const clone = document.createElement('span');
      clone.textContent = flight.word;
      clone.style.cssText = `
        position: fixed;
        left: ${flight.from.x}px;
        top: ${flight.from.y}px;
        color: ${flight.isVocabulary ? '#ffd700' : '#fff'};
        font-size: 16px;
        z-index: 999999;
        pointer-events: none;
        text-shadow: ${flight.isVocabulary
          ? '0 0 8px #ffd700, 0 0 16px #ffd700'
          : '0 0 8px #00bfff, 0 0 16px #00bfff'};
        transition: all 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
      `;
      document.body.appendChild(clone);

      // Fly to target
      requestAnimationFrame(() => {
        clone.style.left = `${flight.to.x}px`;
        clone.style.top = `${flight.to.y}px`;
      });

      // Reveal slot and remove clone
      setTimeout(() => {
        flight.slot.style.opacity = '1';
        flight.slot.style.transform = 'translateY(0)';
        if (flight.isVocabulary) {
          flight.slot.style.color = '#ffd700';
          flight.slot.style.fontWeight = '600';
        }
        clone.remove();
        resolve();
      }, 600);
    }, delay);
  });
}
```

### 4.5 Enhance PDFAdapter for Word-Level Animation

**File:** `src/renderer/components/animation-core/adapters/PDFAdapter.js`

PDF.js text layer spans may contain multiple words. We need to handle this:

```javascript
/**
 * Wrap individual words in PDF text layer spans
 * PDF.js spans can contain multiple words, so we split them
 */
_wrapTextLayerWords() {
  const textLayers = this._getTextLayers();
  const wrappedWords = new Map();
  let wordIndex = 0;

  textLayers.forEach((layer) => {
    const spans = Array.from(layer.querySelectorAll('span:not(.pdf-ac-word)'));

    spans.forEach((span) => {
      const text = span.textContent || '';
      if (!text.trim()) return;

      // Store original span properties
      const style = window.getComputedStyle(span);
      const originalLeft = span.style.left;
      const originalTop = span.style.top;
      const originalTransform = span.style.transform;

      // Split into words
      const parts = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      parts.forEach((part) => {
        if (part.trim()) {
          const wordSpan = document.createElement('span');
          wordSpan.className = 'pdf-ac-word';
          wordSpan.id = `pdf-ac-word-${wordIndex++}`;
          wordSpan.textContent = part;
          wordSpan.style.cssText = `
            display: inline;
            position: relative;
          `;
          fragment.appendChild(wordSpan);

          wrappedWords.set(wordSpan.id, {
            span: wordSpan,
            text: part,
            parentSpan: span,
          });
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      });

      // Replace span content
      span.innerHTML = '';
      span.appendChild(fragment);
    });
  });

  return wrappedWords;
}

/**
 * Enhanced smartSummary with flying words
 */
async smartSummary(sourceText, summaryText, options = {}) {
  if (!this.isInitialized) {
    await this.initialize();
  }

  const { vocabularyWords = [], glowColor = '#00bfff', onSaveNote } = options;

  // 1. Wrap words in text layer
  const wrappedWords = this._wrapTextLayerWords();

  // 2. Find matching words
  const summaryWordList = summaryText.split(/\s+/).filter(w => w.length > 2);
  const sourceWordList = sourceText.split(/\s+/).filter(w => w.length > 2);

  const matchingPositions = [];
  for (const [wordId, data] of wrappedWords) {
    const wordLower = data.text.toLowerCase().replace(/[.,!?;:'"]/g, '');

    if (sourceWordList.some(sw => sw.toLowerCase().includes(wordLower) ||
        wordLower.includes(sw.toLowerCase()))) {
      const rect = data.span.getBoundingClientRect();
      matchingPositions.push({
        wordId,
        word: data.text,
        span: data.span,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        isVocabulary: vocabularyWords.some(v =>
          v.toLowerCase() === wordLower
        ),
        matchesSummary: summaryWordList.some(sw =>
          sw.toLowerCase().replace(/[.,!?;:'"]/g, '') === wordLower
        ),
      });
    }
  }

  // 3. Create overlay
  const overlay = this._createOverlay();

  // 4. Glow matching words
  matchingPositions.forEach((pos) => {
    pos.span.style.textShadow = pos.isVocabulary
      ? '0 0 8px #ffd700, 0 0 16px #ffd700'
      : `0 0 8px ${glowColor}, 0 0 16px ${glowColor}`;
    pos.span.style.color = '#fff';
    pos.span.classList.add('pdf-ac-glowing');
  });

  // 5. Create summary panel (reuse similar structure as EPUB)
  const summaryPanel = this._createSummaryPanel(summaryText, onSaveNote);

  // 6. Fly words that match summary
  const flyingWords = matchingPositions.filter(p => p.matchesSummary);
  await this._flyWordsToSummary(flyingWords, summaryPanel);

  this.activeEffects.set('wrapped-words', wrappedWords);

  return { matchCount: flyingWords.length };
}

// _createOverlay, _createSummaryPanel, _flyWordsToSummary
// similar to EPUBAdapter implementation above
```

### 4.6 Add Selection Context Menu for EPUB/PDF

**File:** `src/renderer/components/reading/SelectionMenu.js` (NEW)

A lightweight floating menu that appears on text selection:

```javascript
/**
 * SelectionMenu - Floating menu for text selection in EPUB/PDF
 *
 * Appears near selection with quick actions:
 * - Smart Summary
 * - Explain
 * - Add to Vocabulary
 * - Highlight
 * - Create Note
 */
import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import HighlightIcon from '@mui/icons-material/Highlight';
import NoteAddIcon from '@mui/icons-material/NoteAdd';

function SelectionMenu({
  visible,
  position,
  selectedText,
  onSmartSummary,
  onExplain,
  onAddVocabulary,
  onHighlight,
  onCreateNote,
  onClose
}) {
  if (!visible || !selectedText) return null;

  const actions = [
    {
      icon: <AutoAwesomeIcon />,
      label: 'Smart Summary',
      onClick: onSmartSummary,
      minWords: 10,
    },
    {
      icon: <LightbulbIcon />,
      label: 'Explain',
      onClick: onExplain,
      minWords: 1,
    },
    {
      icon: <BookmarkAddIcon />,
      label: 'Add to Vocabulary',
      onClick: onAddVocabulary,
      minWords: 1,
      maxWords: 5,
    },
    {
      icon: <HighlightIcon />,
      label: 'Highlight',
      onClick: onHighlight,
      minWords: 1,
    },
    {
      icon: <NoteAddIcon />,
      label: 'Create Note',
      onClick: onCreateNote,
      minWords: 1,
    },
  ];

  const wordCount = selectedText.split(/\s+/).length;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 3,
        display: 'flex',
        gap: 0.5,
        p: 0.5,
        zIndex: 9999,
      }}
      onMouseLeave={onClose}
    >
      {actions.map((action) => {
        const enabled =
          wordCount >= (action.minWords || 1) &&
          (!action.maxWords || wordCount <= action.maxWords);

        return (
          <Tooltip key={action.label} title={action.label}>
            <span>
              <IconButton
                size="small"
                disabled={!enabled}
                onClick={() => {
                  action.onClick(selectedText);
                  onClose();
                }}
              >
                {action.icon}
              </IconButton>
            </span>
          </Tooltip>
        );
      })}
    </Box>
  );
}

export default SelectionMenu;
```

### 4.7 Integration Summary

**Files to Modify:**

| File | Changes | Lines |
|------|---------|-------|
| `EPubView.js` | Add useEPUBAnimations, handleSmartSummary, SelectionMenu | ~80 |
| `PDFView.js` | Add usePDFAnimations, handleSmartSummary, SelectionMenu | ~80 |
| `EPUBAdapter.js` | Enhance smartSummary with flying words | ~200 |
| `PDFAdapter.js` | Add word wrapping, enhance smartSummary | ~250 |

**Files to Create:**

| File | Purpose | Lines |
|------|---------|-------|
| `SelectionMenu.js` | Floating selection menu component | ~80 |

**Total for Phase 4:** ~690 lines

---

## Phase 5: Optional Enhancements (Lower Priority)

### 5.1 Add Skill Result Modal

**File:** `src/renderer/components/skills/SkillResultModal.js`

A generic modal to display skill results (quiz, mindmap, 5W analysis).

Only create if needed - can reuse existing modals first.

### 5.2 Keyboard Shortcuts

Add to existing keyboard handling in each view, not as separate system.

---

## Implementation Order (Revised)

### Sprint 1: Browser Skill Tracking (3 changes)
1. Create `useSkillBridge.js` hook (~30 lines)
2. Modify `Browser.js` to call skill alongside existing AI
3. Add new menu items to `BrowserContextMenu.js`

**Risk:** Very Low - only adds tracking, doesn't change existing behavior

### Sprint 2: EPUB/PDF Selection Bridge (4 changes)
1. Add `selectedText` prop to `InContextChatPanel`
2. Modify `EReaderPage` to track selection
3. Modify `EPubView` to report selection
4. Modify `PDFView` to report selection

**Risk:** Low - adds prop passing, doesn't change existing logic

### Sprint 3: Quick Actions Visibility (1 change)
1. Add selection-aware quick actions display in `InContextChatPanel`

**Risk:** Very Low - UI only change

### Sprint 4: EPUB/PDF Animation (5 changes)
1. Create `SelectionMenu.js` floating menu component (~80 lines)
2. Enhance `EPUBAdapter.js` with flying word animation (~200 lines)
3. Enhance `PDFAdapter.js` with word wrapping and flying animation (~250 lines)
4. Integrate animation hooks in `EPubView.js` (~80 lines)
5. Integrate animation hooks in `PDFView.js` (~80 lines)

**Risk:** Medium - modifies view components, but isolated to animation features

---

## Files Summary

### Files to Create (2 files)
| File | Lines | Purpose |
|------|-------|---------|
| `src/renderer/hooks/useSkillBridge.js` | ~30 | Skill execution wrapper |
| `src/renderer/components/reading/SelectionMenu.js` | ~80 | Floating selection menu |

### Files to Modify (8 files)
| File | Changes | Lines Changed |
|------|---------|---------------|
| `Browser.js` | Add skill tracking, handle new commands | ~30 |
| `BrowserContextMenu.js` | Add new menu items | ~20 |
| `InContextChatPanel.js` | Add selectedText prop, selection UI | ~40 |
| `index.js` (reading) | Pass selection to InContextChatPanel | ~10 |
| `EPubView.js` | Add animation hooks, selection menu, handleSmartSummary | ~90 |
| `PDFView.js` | Add animation hooks, selection menu, handleSmartSummary | ~90 |
| `EPUBAdapter.js` | Enhance smartSummary with flying words, coordinate conversion | ~200 |
| `PDFAdapter.js` | Add word wrapping, enhance smartSummary with flying words | ~250 |

**Total new/changed code:** ~840 lines

---

## What We're NOT Doing (Risk Avoidance)

1. **NOT creating new context menu component** - Reuse existing BrowserContextMenu pattern for Browser, create lightweight SelectionMenu for EPUB/PDF
2. **NOT replacing AI calls** - Only wrapping for tracking
3. **NOT creating new layout components** - Use existing RightCollapsibleLayout
4. **NOT adding global context provider** - Keep state local to views
5. **NOT adding keyboard shortcuts system** - Too invasive, can add per-view later if needed

---

## Success Criteria

1. Browser context menu has 3 new skill options
2. Skill executions are trackable via skill system
3. EPUB/PDF quick actions work on selected text
4. **EPUB/PDF support Smart Summary with flying word animation**
5. **Selection menu appears on text selection in EPUB/PDF**
6. No existing functionality broken
7. Animation degrades gracefully if DOM access fails
