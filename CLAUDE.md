# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SmartReader v2 is an AI-powered e-reader desktop application built on Electron React Boilerplate. It combines document reading (EPUB, PDF, Word), note-taking with spaced repetition (Leitner system), AI-assisted learning across multiple LLM providers, and semantic search through ChromaDB and Neo4j graph database.

## Development Commands

```bash
# Install dependencies
npm install

# Development (run in two terminals)
npm run start:renderer    # Terminal 1: Webpack dev server on :3000
npm run start:main        # Terminal 2: Electron with hot reload

# Or use single command (checks port first)
npm start

# Build for production
npm run build             # Build both main and renderer
npm run build:main        # Build main process only
npm run build:renderer    # Build renderer process only
npm run build:dll         # Rebuild DLL bundles

# Package for distribution
npm run package           # Creates .exe/.dmg/.AppImage in release/build

# Native module rebuild (after dependency changes)
npm run rebuild

# Linting and testing
npm run lint              # ESLint for .js,.jsx,.ts,.tsx
npm test                  # Jest tests
```

## Architecture

### Process Model (Electron IPC)

- **Main Process** (`src/main/main.ts`): ~2400 lines handling IPC events, window management, database operations, AI provider integration, and ChromaDB. All database and external service calls happen here.
- **Preload Script** (`src/main/preload.ts`): Bridges main/renderer with secure IPC API exposure.
- **Renderer Process** (`src/renderer/`): React UI with Redux state management.

Communication flows through ~100+ IPC handlers defined in `main.ts` starting around line 487.

### AI Provider Strategy Pattern

Located in `src/commons/service/`:
- `AIProviderInterface.js` - Abstract base interface
- `AIProviderManager.js` - Singleton that selects provider at runtime
- Concrete providers: `ChatGPTProvider.js`, `GeminiProvider.js`, `ClaudeProvider.js`, `BaiduProvider.js`, `BaiduQianfanProvider.js`, `KimiProvider.js`, `OllamaProvider.js`

### Database Layer

SQLite with better-sqlite3 (native module). Schema in `db.sql`, data in `sqlite_tables.db`.

Manager pattern in `src/main/db/`:
- `DBManager.js` - Core connection
- `DatabaseInitializer.js` - Schema setup
- Entity managers: `BookManager.js`, `BookmarkManager.js`, `ChatManager.js`, `MessageManager.js`, `NoteJsonManager.js`, `PromptManager.js`, `QuizProblemJsonManager.js`, `MoodBoardJsonManager.js`, `VocabularyManager.js`, etc.

### Vector Database (ChromaDB)

ChromaDB integration in `src/main/utils/ChromaManager.js` and `chromaUtil.js`. Requires separate Python ChromaDB server:
```bash
pip install chromadb
chroma run --path chroma
```

### Graph Database (Neo4j)

Neo4j integration provides knowledge graph features. Uses a hybrid architecture where SQLite remains the primary store and Neo4j provides graph-specific capabilities.

**Architecture:**
- SQLite (primary): All CRUD operations, categories, groups, user data, settings
- Neo4j (secondary): Knowledge graph, learning paths, concept relationships, semantic search

**Key Files in `src/main/utils/`:**
| File | Purpose |
|------|---------|
| `GraphInterface.js` | Abstraction layer, delegates to adapters |
| `Neo4jAdapter.js` | Neo4j implementation (~1500 lines) |
| `GraphEmbeddingManager.js` | Semantic search, mirrors ChromaManager |
| `GraphLearningFeatures.js` | Learning paths, weak concepts, entity resolution |
| `SummarizationGraphService.js` | Memory consolidation graph patterns (~700 lines) |
| `ConsolidationService.js` | LLM-powered episode → memory consolidation |

**IPC Layer:**
- `src/main/ipc/graphHandlers.js` - All graph IPC handlers
- `src/renderer/api/graphApi.js` - Renderer-side API

**Neo4j-Exclusive Features:**
1. **Learning Paths**: Concept prerequisites, personalized learning routes
2. **Weak Concepts Detection**: Find concepts with low mastery or high error rates
3. **Entity Resolution**: Link related concepts across notes automatically
4. **Knowledge Graph Visualization**: Nodes and edges for graph visualization
5. **Mastery Tracking**: Track concept mastery over time with progress analytics
6. **Semantic Search**: Store embeddings in Neo4j (mirrors ChromaDB)
7. **Memory Consolidation Graph**: Episodes → ConsolidatedMemory → Concepts (see below)

**Configuration (electron-store):**
```javascript
{
  "graph": {
    "enabled": true,         // Toggle for development/troubleshooting
    "adapterType": "neo4j",  // or "graphiti" in future
    "connectionUri": "bolt://localhost:7687",
    "username": "neo4j",
    "password": "password"
  }
}
```

**Usage in Components:**
```javascript
import graphApi from '../api/graphApi';

// Learning paths
const path = await graphApi.getPersonalizedLearningPath('calculus_id', token);

// Weak concepts
const weak = await graphApi.detectWeakConcepts(10, token);

// Entity resolution
const related = await graphApi.resolveRelatedConcepts(token);

// Knowledge graph visualization
const graph = await graphApi.getKnowledgeGraphData(null, token);
```

**Requires Neo4j server:**
```bash
# Using Docker
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password neo4j:latest

# Or install Neo4j Desktop from https://neo4j.com/download/
```

**UI Components (`src/renderer/components/graph/`):**
| Component | Purpose |
|-----------|---------|
| `LearningPathPanel` | Displays learning path with prerequisites for target concept |
| `WeakConceptsPanel` | Shows concepts needing practice (low mastery, high errors) |
| `KnowledgeGraphPanel` | Interactive force-directed graph visualization |

**Auto-Sync:** Notes, books, bookmarks, and chats are automatically synced to Neo4j on create/update when enabled.

#### Memory Consolidation Graph (SummarizationGraphService)

The Memory Consolidation Graph implements a three-tier architecture inspired by [Graphiti](https://github.com/getzep/graphiti) for summarizing learning episodes into higher-level memories.

**Node Types:**
| Node | Description |
|------|-------------|
| `Episode` | Raw learning events (reviews, sessions, book opens, etc.) |
| `ConsolidatedMemory` | LLM-synthesized summaries of episodes |
| `Concept` | Learning concepts linked to memories |
| `LearnerProfile` | User profile with learning patterns |

**Relationship Types:**
| Relationship | Description | Properties |
|--------------|-------------|------------|
| `:CONSOLIDATED_INTO` | Episode → ConsolidatedMemory | weight, contributionType, t_valid, t_created |
| `:SUMMARIZES` | ConsolidatedMemory → Concept | weight, isPrimary, aspectsCovered, masteryContribution |
| `:MEMORY_RELATES` | ConsolidatedMemory ↔ ConsolidatedMemory | relationType, strength, confidence |
| `:HAS_MEMORY` | LearnerProfile → ConsolidatedMemory | - |

**Contribution Types (Episode → Memory):**
- `primary`: Direct learning activity (reviews, quizzes)
- `supporting`: Context activity (book opens, notes)
- `contextual`: Background events (session start/end)

**Mastery Contribution Levels:**
- `high`: Strong positive impact (correct answers, box promotions)
- `medium`: Moderate impact (regular reviews)
- `low`: Minimal impact (hints used, incorrect answers)
- `negative`: Setbacks (demotions, repeated failures)

**Key Methods in SummarizationGraphService:**
```javascript
import SummarizationGraphService from '../utils/SummarizationGraphService';

const service = new SummarizationGraphService(neo4jAdapter);

// Get full hierarchy: Concept → Memories → Episodes
const hierarchy = await service.getSummarizationHierarchy(conceptId, userId, {
  includeEpisodes: true,
  maxMemories: 10,
  maxEpisodesPerMemory: 5,
});

// Get learning timeline for a concept
const timeline = await service.getConceptLearningTimeline(conceptId, userId, 50);

// Calculate mastery from memory data (with recency bias)
const mastery = await service.calculateConceptMasteryFromMemories(conceptId, userId);
// Returns: { aggregatedMastery: 0.75, masteryLevel: 'proficient', memoryCount: 5 }

// Find gaps in learning coverage
const gaps = await service.findMemoryGaps(userId, 30);
// Returns concepts not reviewed in last 30 days

// Get cross-concept pattern memories
const clusters = await service.getCrossConceptClusters(userId, 10);
```

**IPC Handlers for Summarization:**
| Handler | Type | Purpose |
|---------|------|---------|
| `graph-summarization-available` | sync | Check if service is available |
| `graph-get-summarization-hierarchy` | invoke | Get concept → memories → episodes |
| `graph-get-memories-for-concept` | invoke | Get memories linked to concept |
| `graph-get-concept-timeline` | invoke | Get learning timeline |
| `graph-get-related-memories` | invoke | Get memories by relationship type |
| `graph-get-memory-chain` | invoke | Traverse memory relationships |
| `graph-get-cross-concept-clusters` | invoke | Get cross-concept memories |
| `graph-get-summarization-stats` | invoke | Get memory statistics |
| `graph-get-memory-coverage` | invoke | Get coverage by concept |
| `graph-find-memory-gaps` | invoke | Find concepts needing review |
| `graph-calculate-concept-mastery` | invoke | Calculate mastery from memories |
| `graph-get-source-episodes` | invoke | Get episodes for a memory |
| `graph-get-concepts-for-memory` | invoke | Get concepts linked to memory |

**Renderer API:**
```javascript
import graphApi from '../api/graphApi';

// Check availability
const available = graphApi.isSummarizationAvailable();

// Get hierarchy for a concept
const hierarchy = await graphApi.getSummarizationHierarchy(conceptId, token, {
  includeEpisodes: true,
});

// Get timeline
const timeline = await graphApi.getConceptTimeline(conceptId, token, 50);

// Calculate mastery
const mastery = await graphApi.calculateConceptMastery(conceptId, token);

// Find memory gaps
const gaps = await graphApi.findMemoryGaps(token, 30);

// Get statistics
const stats = await graphApi.getSummarizationStats(token);
```

**Consolidation Flow:**
```
1. Episodes collected → EpisodeCollector.js
   (REVIEW_COMPLETED, SESSION_ENDED, etc.)

2. Heartbeat triggers → LearningBrainAgent.js
   runConsolidation()

3. Episodes grouped → ConsolidationService.js
   groupByConceptClusters() with context shift detection

4. LLM synthesis → AIProviderManager
   createMemoryConsolidationPrompt()

5. Graph sync → SummarizationGraphService
   - upsertConsolidatedMemory()
   - linkEpisodesToMemory()
   - linkMemoryToConcepts()
```

**Test Commands:**
```bash
# Run summarization graph tests (76 tests)
npm test -- --testPathPattern=brain/SummarizationGraphService
npm test -- --testPathPattern=brain/brainHandlersSummarization
```

### State Management

- Redux Toolkit with Redux Persist (`src/renderer/store/`)
- `chatSlice.js` - Chat state management
- `customStorage.js` - Storage adapters

### Key Directories

```
src/
├── commons/           # Shared utilities, AI providers, data models
│   ├── model/         # DataTypes.js (providers, modes, models), entity definitions
│   ├── service/       # AI provider implementations
│   └── utils/         # AIPrompts.js, utilities
├── main/              # Electron main process
│   ├── db/            # SQLite managers
│   ├── ipc/           # IPC handlers (graphHandlers.js)
│   └── utils/         # ChromaManager, GraphInterface, Neo4jAdapter, GraphLearningFeatures
├── __tests__/         # Jest tests
│   ├── graph/         # Graph database tests (240 tests)
│   └── brain/         # Brain/memory consolidation tests (76+ tests)
└── renderer/          # React UI
    ├── views/         # Page components (reading, bookshelf, chat, notes, quiz, etc.)
    ├── components/    # Reusable components (chat, MoodBoard, dialog, etc.)
    │   ├── animation-core/  # Modular animation system for EPUB/PDF/Notes
    │   ├── graph/           # Knowledge graph UI components
    │   └── knowledge/       # ConceptReviewPanel, etc.
    ├── api/           # IPC calls to main process (graphApi.js)
    ├── store/         # Redux configuration
    └── theme/         # Light/dark theme definitions
```

## Key Dependencies & Version Constraints

- `chromadb@1.8.1` and `@google/generative-ai@0.1.3` must match for compatibility
- `better-sqlite3` is a native module - requires rebuild after Electron upgrades
- `ollama` package needs entry in both root and `release/app/package.json`

## External Runtime Requirements

- **ChromaDB**: Python service for vector search (optional if using Neo4j)
- **Neo4j**: Graph database for knowledge graph features (optional, enhances learning features)
- **LibreOffice** (optional): For Word document conversion
- **Ollama** (optional): For local LLM support
- **System TTS**: macOS/Windows built-in; Linux needs espeak/festival/flite

## Webpack Configuration

Located in `.erb/configs/`:
- `webpack.config.base.ts` - Shared config with polyfill fallbacks (zlib, crypto, etc.)
- `webpack.config.main.prod.ts` / `webpack.config.renderer.prod.ts` - Production builds
- `webpack.config.renderer.dev.ts` - Dev server with hot reload
- `webpack.config.renderer.dev.dll.ts` - DLL bundles (includes `better-sqlite3` in externals)

## Security Notes

Context isolation is disabled for file:// protocol support. The preload script provides controlled API exposure between processes.

## Views & Feature Modules

All views are in `src/renderer/views/` and follow a common layout pattern using `RightCollapsibleLayout` with a main panel and collapsible right sidebar.

### Reading (`/reading/:id`)
- **EPubView.js**: EPUB reader using `react-reader` with `marks-pane` for annotations (highlight, underline, strikethrough, dash)
- **PDFView.js**: PDF viewer using `react-pdf-highlighter-extended-x2` with highlighting and annotation support
- Right panel tabs: My Notes, Search, AI Bot (InContextChatPanel), Communities (if server configured)
- Supports navigation to specific CFI (EPUB) or note location (PDF)

### Bookshelf (`/bookshelf`)
- **BookshelfView.js**: Library organized by bookshelf (accordion-based)
- **BookSpineUI.js** / **BookCardUI.js**: Two display modes (spine view vs cover view)
- Import books via `ImportFileAsBook` component (supports EPUB, PDF, Word via LibreOffice/Mammoth)
- Routes to `/reading/:id` for EPUB/PDF or `/browser/:id` for HTML-based books

### Bookmarks (`/bookmarks`)
- **BookmarksPage**: Web bookmark management with hierarchical tree structure
- `SimpleTreeView` for folder navigation
- Bookmarks link to browser view for offline/online viewing

### Notes (`/notes`)
- Two tabs: **NotesUI** (general notes) and **NotesLeitnerUI** (spaced repetition)
- **LeitnerSystem** component: 5-box spaced repetition implementation for both notes and vocabulary
- Notes can include text, images (from area capture), markdown with LaTeX math

### Chat (`/chats/:id`)
- **ChatPageView.js** / **ChatDetailPanel.js**: AI chat interface
- Right panel: Chats list, Prompts (saved prompt templates)
- Uses `AIProviderManager` singleton for multi-provider support
- `InContextChatPanel`: Context-aware chat embedded in reading/browser views

### Browser (`/browser/:id`)
- **Browser.js**: Embedded webview for web browsing and HTML book viewing
- Features: URL navigation with history tree, bookmark creation, area capture for notes
- AI-powered vocabulary level adaptation ("For Xth grader" - rewrites page content for reading level)
- Right panel: Notes for current URL, History, AI Bot
- Context menu integration for creating vocabulary cards, TTS, and Smart Summary
- **StudyEnhancer**: Text animation system for learning enhancement (see below)

### Vocabulary (`/vocabulary`)
- **VocabularyView.js**: Vocabulary learning with Leitner spaced repetition
- **VocabularyListView.js**: Words due for review vs in-queue
- Integration with browser view for word lookup and card creation

### Translate (`/translate`)
- **TranslateMainPage.js**: Multi-step translation learning (Chinese/Japanese to English)
- 5-step process: SVO analysis → Verb identification → Sentence structure → Scaffold → Final translation
- **DependencyTree**: Visual dependency parsing display
- Uses NLP annotation prompts for sentence analysis

### Writing (`/writing`)
- **WritingView.js**: Guided writing practice with step-by-step annotation
- **WritingStepper**: Progressive learning stages (nouns, verbs, phrases, etc.)
- **ParagraphWithHiddenWords**: Cloze-style exercises
- Grammar checking and comparison exercises via AI

### Grammar (`/grammar`)
- **GrammarMainPage.js**: Grammar correction interface
- Uses `TextAnnotateBlend` for inline annotation display
- **CorrectionCard**: Shows original/corrected with explanations
- Multi-language support (English, Chinese, Japanese explanations)

### Quiz (`/quiz`)
- **QuizView.js**: Quiz taking interface
- Uses `survey-react-ui` (SurveyJS) for quiz rendering
- Two modes: **InstantResultQuiz** (immediate feedback) and **ScoredQuiz** (final score)
- Problem set builder from stored quiz problems

### MoodBoard (`/moodboard/:id`)
- **MoodBoardView.js**: Visual brainstorming/mind-mapping
- **DetailedDiagramPanel**: Uses `@projectstorm/react-diagrams` for node-based diagrams
- Drag notes from sidebar onto diagram canvas
- Supports creating notes directly in moodboard context

### Learn About (`/learnabout`)
- **LearnAboutView.js** / **LearnAboutDetailPanel.js**: Google Scholar-like exploration feature
- Chat-based learning with topic exploration
- Separate chat list filtered for "learn about" sessions

### Settings (`/settings`)
- **SettingsPanel.js**: Comprehensive app configuration (~1180 lines)
- AI Provider setup: API keys for ChatGPT, Gemini, Claude, Baidu, Kimi, Ollama
- Model selection per provider
- Study configuration: Reader level (Elementary/Middle/College), Study mode (General/Language/Math/Program)
- Leitner speed, Quiz settings, Note styling (fonts, colors, backgrounds)
- Data management: Clear notes/books/chats/prompts/moodboards
- Keywords import for vocabulary highlighting

### Login (`/login`)
- **Login.tsx**: Optional server-side authentication
- Connects to external book server for library synchronization

## Common UI Patterns

- **RightCollapsibleLayout**: Main content + collapsible right sidebar (used by most views)
- **TextSearchRow**: Search input with optional create button
- **SmallButton**: Consistent small action buttons
- **customStorage**: Unified access to electron-store settings via IPC

## AI Integration Points

- `AIProviderManager.generateContentWithJson()`: JSON-structured responses for grammar, translation, quiz generation
- `InContextChatPanel`: Embedded AI chat that can access current book/article content
- Prompt templates in `src/commons/utils/AIPrompts.js`

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

## Rich Markdown Editor (Knowledge Web)

A full-featured WYSIWYG markdown editor with a "Knowledge Web" linking system to connect notes, vocabulary, and concepts bidirectionally. Solves knowledge fragmentation by creating semantic relationships between learning materials.

### Architecture

```
src/renderer/components/editor/
├── RichMarkdownEditor.tsx          # Main TipTap editor component
├── EditorToolbar.tsx               # MUI-based formatting toolbar
├── extensions/
│   ├── MathJaxExtension.tsx        # LaTeX/MathJax support ($...$ and $$...$$)
│   └── WikiLinkExtension.tsx       # [[wiki-link]] syntax for linking
├── popovers/
│   ├── LinkPreviewPopover.tsx      # Hover preview for vocabulary/concept/note
│   └── LinkSuggestionMenu.tsx      # Autocomplete dropdown for [[...]]
├── panels/
│   └── BacklinksPanel.tsx          # Shows notes linking TO current note
├── editor.styles.css               # Editor styling, syntax highlighting
└── index.ts                        # Exports
```

### Key Features

**Editor Capabilities:**
- Full formatting: bold, italic, underline, strikethrough, headers (H1-H3)
- Lists (bullet, numbered), blockquotes, code blocks with syntax highlighting
- Tables with insert/resize support
- LaTeX/MathJax: inline `$E=mc^2$` and block `$$\int_a^b f(x)dx$$`
- Font family and text color customization
- Highlight/background colors
- Undo/redo, copy/paste preservation

**Knowledge Web Linking:**
| Layer | Trigger | Creates Link? | Purpose |
|-------|---------|---------------|---------|
| Vocabulary Tooltips | Hover over vocabulary word | No | Inline learning aid - see definition without leaving |
| Explicit Links | User types `[[...]]` | Yes | Manual connections between specific notes |
| Semantic Auto-Links | Save note | Yes (auto) | Auto-discover related notes via tags + embeddings |

### Wiki-Link Syntax

Type `[[` to trigger autocomplete:
```
[[vocabulary-word]]    → Links to vocabulary (green)
[[concept-name]]       → Links to concept (blue)
[[note-title]]         → Links to note (gray)
```

### Link Type Colors

| Type | Color | CSS Class |
|------|-------|-----------|
| Vocabulary | `#4CAF50` (green) | `.wiki-link--vocabulary` |
| Concept | `#2196F3` (blue) | `.wiki-link--concept` |
| Note | `#9E9E9E` (gray) | `.wiki-link--note` |

### Usage

**Basic Editor:**
```jsx
import { RichMarkdownEditor } from '../components/editor';

function NoteEditor() {
  const editorRef = useRef(null);

  const handleChange = (html, text) => {
    console.log('HTML:', html);
    console.log('Text:', text);
  };

  return (
    <RichMarkdownEditor
      ref={editorRef}
      content="<p>Initial content</p>"
      onChange={handleChange}
      placeholder="Write your note..."
      minHeight={200}
      maxHeight={400}
      onLinkClick={(type, id) => navigate(`/${type}/${id}`)}
    />
  );
}
```

**Ref Methods:**
```javascript
// Get content
editorRef.current.getHTML();   // Returns HTML string
editorRef.current.getText();   // Returns plain text
editorRef.current.getJSON();   // Returns ProseMirror JSON

// Set content
editorRef.current.setContent('<p>New content</p>');
editorRef.current.clear();
editorRef.current.focus();

// Insert special content
editorRef.current.insertMath('E=mc^2', true);   // inline math
editorRef.current.insertMath('\\int_a^b f(x)dx', false);  // block math
editorRef.current.insertWikiLink('vocabulary', 'word_123', 'ephemeral');
```

### Neo4j Link Methods

Located in `src/main/utils/Neo4jAdapter.js`:

| Method | Purpose |
|--------|---------|
| `getBacklinks(targetId, targetType, token)` | Get notes linking TO target |
| `getOutgoingLinks(noteId, token)` | Get links FROM a note |
| `syncNoteLinks(noteId, links, token)` | Update links on save |
| `searchForLinking(query, token, limit)` | Search vocab/concepts/notes for suggestions |
| `findNotesBySharedTags(tags, excludeId, token, minSharedTags)` | Find related by tags |
| `findSemanticallySimilarNotes(noteId, embedding, threshold, token)` | Find by embedding |
| `getLinkPreview(type, id, token)` | Fetch preview data for hover popup |

### IPC Handlers

Added to `src/main/ipc/graphHandlers.js`:

| Handler | Type | Purpose |
|---------|------|---------|
| `get-link-suggestions` | sync | Search vocab→concepts→notes for autocomplete |
| `get-link-preview` | sync | Fetch preview data for hover popup |
| `get-backlinks` | sync | Get notes linking to target |
| `sync-note-links` | invoke | Update links in Neo4j on save |
| `get-outgoing-links` | sync | Get links from a note |
| `find-notes-by-shared-tags` | sync | Find notes with shared tags |
| `find-similar-notes` | sync | Find semantically similar notes |

### Integration with CreateNotePanel

The editor is integrated into `CreateNotePanel.tsx` with a toggle to switch between rich and simple modes:

```jsx
// In CreateNotePanel.tsx
const [useRichEditor, setUseRichEditor] = useState(true);
const editorRef = useRef(null);

// Toggle in UI
<FormControlLabel
  control={<Switch checked={useRichEditor} onChange={(e) => setUseRichEditor(e.target.checked)} />}
  label="Rich Editor"
/>

// Conditional rendering
{useRichEditor ? (
  <RichMarkdownEditor
    ref={editorRef}
    content={summaryHtml}
    onChange={handleEditorChange}
    onLinkClick={handleLinkClick}
  />
) : (
  <TextField multiline value={summary} onChange={(e) => setSummary(e.target.value)} />
)}

// On save: extract wiki-links and sync to Neo4j
const extractWikiLinksFromHtml = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = [];
  doc.querySelectorAll('.wiki-link').forEach((el) => {
    links.push({
      type: el.dataset.linkType,
      id: el.dataset.linkId,
      text: el.textContent,
    });
  });
  return links;
};
```

### Dependencies

```json
{
  "@tiptap/react": "^3.20.0",
  "@tiptap/starter-kit": "^3.20.0",
  "@tiptap/extension-placeholder": "^3.20.0",
  "@tiptap/extension-underline": "^3.20.0",
  "@tiptap/extension-text-style": "^3.20.0",
  "@tiptap/extension-color": "^3.20.0",
  "@tiptap/extension-font-family": "^3.20.0",
  "@tiptap/extension-highlight": "^3.20.0",
  "@tiptap/extension-table": "^3.20.0",
  "@tiptap/extension-table-row": "^3.20.0",
  "@tiptap/extension-table-cell": "^3.20.0",
  "@tiptap/extension-table-header": "^3.20.0",
  "@tiptap/extension-code-block-lowlight": "^3.20.0",
  "@tiptap/suggestion": "^3.20.0",
  "lowlight": "^3.0.0"
}
```

### Test Commands

```bash
# Run editor tests
npm test -- --testPathPattern=editor

# Run specific test file
npm test -- --testPathPattern=RichMarkdownEditor.test.tsx
npm test -- --testPathPattern=WikiLinkExtension.test.ts
npm test -- --testPathPattern=MathJaxExtension.test.ts
```

## AI-Powered Concept Extraction

Intelligent extraction of concepts, entities, and relationships from note content using LLM, with automatic integration into the knowledge graph.

### Architecture

```
Note Creation Flow
├── CreateNotePanel.tsx
│   └── ConceptReviewPanel.tsx (UI for reviewing extracted concepts)
│       └── graphApi.aiFullExtraction() → IPC
│
Main Process
├── graphHandlers.js (IPC handlers)
│   └── graph-ai-full-extraction, graph-ai-save-extraction, etc.
│
└── AIConceptExtractionService.js
    ├── extractConceptsWithAI() - Uses createMindmapExtractionPrompt
    ├── extractEntitiesWithAI() - Uses createEntityResolutionPrompt
    ├── fullExtraction() - Combines both + relationship suggestions
    └── saveToGraph() - Saves to Neo4j
```

### Key Files

| File | Purpose |
|------|---------|
| `src/main/utils/AIConceptExtractionService.js` | Core extraction service using AI prompts |
| `src/main/ipc/graphHandlers.js` | IPC handlers for extraction operations |
| `src/renderer/api/graphApi.js` | Renderer-side API methods |
| `src/renderer/components/knowledge/ConceptReviewPanel.tsx` | UI for reviewing/selecting concepts |
| `src/renderer/components/chat/CreateNotePanel.tsx` | Note creation with concept extraction |

### AI Prompts Used

Located in `src/commons/utils/AIPrompts.js`:
- **`createMindmapExtractionPrompt(text)`**: Extracts entities, relationships, and creates a mindmap structure with nodes and edges
- **`createEntityResolutionPrompt(text)`**: Identifies entities and coreferences (pronouns, descriptions referring to same entity)

### Extraction Features

1. **Concept Extraction**: Identifies key entities (people, concepts, places, events, objects) from text
2. **Relationship Detection**: Extracts relationships between entities (requires, part_of, causes, example_of, related_to)
3. **Entity Resolution**: Detects when different mentions refer to the same entity (e.g., "Einstein", "he", "the physicist")
4. **Existing Concept Matching**: Finds concepts already in the user's knowledge graph
5. **Relationship Suggestions**: Suggests links between new concepts and existing ones

### Usage in Components

```javascript
import graphApi from '../api/graphApi';

// Check if AI extraction is available
const available = graphApi.isAIExtractionAvailable();

// Full extraction with suggestions
const result = await graphApi.aiFullExtraction(text, token);
// Returns: { nodes, edges, entities, existingConcepts, suggestions }

// Save extracted concepts to graph
await graphApi.aiSaveExtraction(
  selectedNodes,
  selectedEdges,
  noteId,
  'note',  // sourceType: 'note' or 'book'
  token
);
```

### ConceptReviewPanel Component

A React component for reviewing AI-extracted concepts before saving:

```jsx
<ConceptReviewPanel
  text={content}
  onExtracted={(result) => console.log('Extracted:', result)}
  onSave={(nodes, edges) => console.log('Save:', nodes, edges)}
  autoExtract={false}  // Set true to extract on mount
  compact={true}       // Compact mode for embedded use
/>
```

**Features:**
- Type-colored concept chips (person, concept, location, event, organization, object)
- Toggle selection for individual concepts and relationships
- Shows existing concepts already in the knowledge graph
- Displays suggested links between new and existing concepts
- "Save to Graph" button to persist selected concepts

### Integration with Note Creation

When creating notes via `CreateNotePanel`:
1. User enters/pastes content
2. ConceptReviewPanel appears (if content >= 50 chars)
3. User clicks sparkle button to trigger AI extraction
4. User reviews and selects concepts to save
5. On note save, selected concepts are automatically saved to Neo4j

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `graph-ai-extract-concepts` | invoke | Extract concepts using AI |
| `graph-ai-extract-entities` | invoke | Extract entities with coreference |
| `graph-ai-full-extraction` | invoke | Full extraction pipeline |
| `graph-ai-save-extraction` | invoke | Save concepts to Neo4j |
| `graph-ai-extraction-available` | sync | Check if AI provider is configured |

## Skill System (Agent Skills Standard)

A modular skill infrastructure following the **Agent Skills standard** (agentskills.io), enabling both code-based and file-based skill definitions. This allows users to add new skills by simply dropping SKILL.md files into the skills directory.

### Skill Types

1. **Code-based skills**: JavaScript classes extending `BaseSkill` (traditional approach)
2. **File-based skills**: SKILL.md files following the Agent Skills standard (drop-in approach)

Both types are compatible and work together seamlessly through the same `SkillRegistry` and `SkillExecutor`.

### Architecture

```
src/main/skills/
├── index.js              # Main exports, registerDefaultSkills()
├── BaseSkill.js          # Abstract base class for all skills
├── SkillRegistry.js      # Skill registration and lookup (singleton via getSkillRegistry())
├── SkillExecutor.js      # Execution engine with validation
├── ContextManager.js     # Session/context management (singleton via getContextManager())
├── SkillMDParser.js      # Parses SKILL.md files (YAML frontmatter + Markdown)
├── FileBasedSkill.js     # Creates skill classes from SKILL.md definitions
├── ai/                   # AI-powered skills
│   ├── index.js
│   ├── SummarizeSkill.js
│   ├── GrammarCheckSkill.js      # Extended with compareWith & generateExercises
│   ├── VocabularySkill.js
│   ├── ConceptExtractSkill.js
│   ├── ExplainSkill.js
│   ├── QuizGenerateSkill.js      # Generate quiz questions from text
│   ├── TranslateSkill.js         # 5-step translation learning (CN/JP to EN)
│   ├── MindmapSkill.js           # Generate mindmap structure
│   ├── TextSimplifySkill.js      # Simplify text for reading levels
│   ├── SmartSummarySkill.js      # Vocabulary-constrained summaries
│   ├── AnnotateSkill.js          # Annotate grammatical elements
│   └── AnalyzeStructureSkill.js  # 5W analysis (Who, What, When, Where, Why)
└── data/                 # Data/storage skills
    ├── index.js
    ├── SearchNotesSkill.js
    ├── GraphQuerySkill.js
    ├── CreateNoteSkill.js
    ├── CreateVocabularySkill.js  # Save vocabulary cards (persistence-only)
    ├── CreateQuizSkill.js        # Save quiz problems to database
    ├── SearchVocabularySkill.js  # Search vocabulary cards
    └── GetLeitnerDueSkill.js     # Get items due for Leitner review

resources/skills/         # Built-in file-based skills (bundled with app)
├── README.md
├── study_guide/
│   └── SKILL.md          # Create study guides with concepts & questions
└── flashcard_generate/
    └── SKILL.md          # Generate flashcards for spaced repetition

src/main/ipc/
└── skillHandlers.js      # IPC handlers for renderer communication

src/__tests__/skills/     # 500+ unit tests across 21 test files
├── index.test.js
├── BaseSkill.test.js
├── SkillRegistry.test.js
├── SkillExecutor.test.js
├── ContextManager.test.js
├── AISkills.test.js
├── DataSkills.test.js
├── skillHandlers.test.js
├── FileBasedSkills.test.js   # Tests for SKILL.md parsing and loading
├── QuizGenerateSkill.test.js
├── TranslateSkill.test.js
├── MindmapSkill.test.js
├── TextSimplifySkill.test.js
├── SmartSummarySkill.test.js
├── AnnotateSkill.test.js
├── AnalyzeStructureSkill.test.js
├── CreateVocabularySkill.test.js
├── CreateQuizSkill.test.js
├── SearchVocabularySkill.test.js
├── GetLeitnerDueSkill.test.js
└── GrammarCheckSkillExtension.test.js

# File-based skills directories (searched in order)
resources/skills/         # Built-in file-based skills (bundled with app)
.smartreader/skills/      # Project-level custom skills
<userData>/skills/        # App data directory skills
~/.smartreader/skills/    # User home directory skills
```

### File-Based Skills (SKILL.md)

Skills can be defined using SKILL.md files following the Agent Skills standard. This allows adding new skills without writing JavaScript code.

**Skill Search Paths (in priority order):**

| Priority | Location | Purpose |
|----------|----------|---------|
| 1 | `resources/skills/` | Built-in file-based skills (bundled with app) |
| 2 | `./.claude/skills/` | Project-level Claude skills |
| 3 | `./.smartreader/skills/` | Project-level SmartReader skills |
| 4 | `<userData>/skills/` | Electron app data directory |
| 5 | `~/.smartreader/skills/` | User home directory |
| 6 | `~/.claude/skills/` | User home Claude skills |

**Directory Structure:**
```
resources/skills/           # Built-in (bundled with app)
├── study_guide/
│   └── SKILL.md
└── flashcard_generate/
    └── SKILL.md

~/.smartreader/skills/      # User-added skills
├── my_custom_skill/
│   └── SKILL.md
└── another_skill/
    └── SKILL.md
```

**Built-in File-Based Skills:**

| Skill | Description |
|-------|-------------|
| `study_guide` | Create study guides with concepts, vocabulary, and review questions |
| `flashcard_generate` | Generate flashcards for spaced repetition learning |

**SKILL.md Format:**
```markdown
---
name: my_custom_skill
description: A brief description of what this skill does
parameters:
  - name: text
    type: string
    required: true
    description: The input text to process
  - name: format
    type: string
    enum: [json, text, markdown]
    default: text
    description: Output format
category: ai
user-invocable: true
---

# My Custom Skill

Detailed instructions for the AI on how to execute this skill.

## Guidelines

- Be concise and clear
- Use the specified format
- Consider the user's context
```

**Frontmatter Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique skill identifier (snake_case) |
| `description` | string | Yes | Brief description shown to AI/user |
| `parameters` | array | No | Parameter definitions |
| `category` | string | No | `ai`, `data`, `system`, `custom` (default: `general`) |
| `user-invocable` | boolean | No | Can be invoked via slash commands (default: `true`) |
| `disable-model-invocation` | boolean | No | Prevent AI from calling this skill (default: `false`) |
| `allowed-tools` | array | No | Tools this skill can use |
| `context` | array | No | Required context: `selection`, `document`, `neo4j`, `chromadb` |
| `agent` | boolean | No | Enable agentic behavior (default: `false`) |

**Parameter Definition:**
```yaml
parameters:
  - name: input_text
    type: string      # string, number, boolean, array
    required: true    # Whether parameter is required
    description: The text to process
    enum: [a, b, c]   # Optional: allowed values
    default: a        # Optional: default value
```

**Adding a New User Skill:**
1. Create a directory in `~/.smartreader/skills/` with your skill name (snake_case)
2. Create a `SKILL.md` file with frontmatter + instructions
3. Restart the app or call `skillApi.reloadFileBasedSkills()` for hot-reload
4. Your skill appears in the slash command menu with a "custom" badge

**Adding a Built-in Skill (for developers):**
1. Create a directory in `resources/skills/` with your skill name
2. Create a `SKILL.md` file following the format below
3. The skill will be bundled with the app on next build

**Example - Flashcard Generator:**
```markdown
---
name: flashcard_generate
description: Generate flashcards for spaced repetition learning
parameters:
  - name: text
    type: string
    required: true
    description: Source text to create flashcards from
  - name: count
    type: number
    default: 5
    description: Number of flashcards (1-20)
  - name: style
    type: string
    enum: [definition, question, cloze]
    default: question
category: ai
---

# Flashcard Generator

Generate high-quality flashcards from the provided text.

## Output Format
Return JSON:
\`\`\`json
{
  "flashcards": [
    {"front": "Question", "back": "Answer", "difficulty": "medium"}
  ]
}
\`\`\`

## Guidelines
- Each card tests ONE concept
- Keep cards concise
- Vary difficulty levels
```

### Core Components

| Component | Purpose |
|-----------|---------|
| `BaseSkill` | Abstract base class with static properties (name, description, parameters, category), validation, schema generation |
| `SkillRegistry` | Registers skills, provides lookup by name/category, generates Claude/OpenAI tool definitions |
| `SkillExecutor` | Executes skills with validation, handles multiple/parallel execution, processes tool calls |
| `ContextManager` | Manages user sessions, view/selection context, builds system prompts with available tools |

### Available Skills

**AI Skills** (`category: 'ai'`):
| Skill Name | Required Params | Description |
|------------|-----------------|-------------|
| `summarize` | `text` | Summarize text (length: brief/medium/detailed, format: paragraph/bullets/numbered) |
| `grammar_check` | `text` | Check grammar, return errors and corrections. Supports `compareWith` for student-original comparison and `generateExercises` for corrective exercises |
| `vocabulary` | `word` | Look up word definition, etymology, examples, synonyms (optional: context) |
| `extract_concepts` | `text` | Extract concepts as nodes/edges for knowledge graph |
| `explain` | `topic` | Explain a topic with optional analogy (optional: context, useAnalogy) |
| `quiz_generate` | `text` | Generate multiple-choice quiz questions (questionCount: 1-10, difficulty: easy/medium/hard/mixed) |
| `translate` | `text` | 5-step translation learning from Chinese/Japanese to English (sourceLanguage, includeNLP, mode: full/simple) |
| `mindmap` | `text` | Generate mindmap structure (maxNodes: 3-15, format: structured/markdown) |
| `text_simplify` | `text` | Simplify text for reading levels (targetLevel: elementary/middle/high/college, vocabularyLimit, preserveHtml) |
| `smart_summary` | `text` | Vocabulary-constrained summary using only source words and learning vocabulary (vocabularyWords, maxWords) |
| `annotate` | `text` | Annotate grammatical elements with ${} markers (annotationType: Noun/Verb/Prepositions/Collocations/Structures) |
| `analyze_structure` | `text` | 5W analysis extracting Who, What, When, Where, Why per sentence |

**Data Skills** (`category: 'data'`):
| Skill Name | Required Params | Description |
|------------|-----------------|-------------|
| `search_notes` | `query` | Search notes (searchType: keyword/semantic, sourceType filter) |
| `query_graph` | `query` | Query knowledge graph (queryType: neighbors/path/related_concepts) |
| `create_note` | `content` | Create a note (optional: title, sourceType, tags) |
| `create_vocabulary` | `word`, `definition` | Save vocabulary card with Leitner integration (persistence-only, use `vocabulary` skill first for AI definitions) |
| `create_quiz` | `quiz` | Save quiz problems to database (sourceKey, sourceType: book/web/chat/manual) |
| `search_vocabulary` | `query` | Search vocabulary cards with pagination (page, limit) |
| `get_leitner_due` | - | Get items due for Leitner review (itemType: vocabulary/note/all, limit, page) |

### Tool Definition Format

Skills generate Claude/OpenAI-compatible tool definitions:

```javascript
const registry = getSkillRegistry();
const tools = registry.getToolDefinitions(context);

// Each tool follows this format:
{
  name: 'summarize',           // snake_case
  description: 'Summarize text...',
  input_schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '...' },
      length: { type: 'string', enum: ['brief', 'medium', 'detailed'] }
    },
    required: ['text']
  }
}
```

### Usage

**Initialize skill system:**
```javascript
const { registerDefaultSkills, getSkillRegistry, getContextManager, SkillExecutor } = require('./skills');

registerDefaultSkills();
const registry = getSkillRegistry();
const contextManager = getContextManager();
const executor = new SkillExecutor(registry, contextManager);
```

**Execute a skill:**
```javascript
const context = {
  userId: 1,
  token: 'user-token',
  aiProvider: aiProviderInstance,
  readerLevel: 'college',
};

const result = await executor.execute('summarize', {
  text: 'Long text to summarize...',
  length: 'brief'
}, context);

// Result: { success: true, result: { summary: '...', length: 'brief' } }
```

**Execute multiple skills:**
```javascript
const skillCalls = [
  { skill: 'summarize', params: { text: 'Text 1' } },
  { skill: 'grammar_check', params: { text: 'Text 2' } }
];

const results = await executor.executeMultiple(skillCalls, context, true); // parallel=true
```

**Process tool calls from LLM:**
```javascript
const toolCalls = [
  { id: 'call_1', name: 'vocabulary', input: { word: 'ephemeral' } }
];

const results = await executor.executeToolCalls(toolCalls, context);
```

### IPC Handlers

Registered via `registerSkillHandlers(store, services)`:

| Handler | Type | Purpose |
|---------|------|---------|
| `skill-list` | sync | List all registered skills |
| `skill-list-available` | sync | List available skills for current context |
| `skill-execute` | invoke | Execute a single skill |
| `skill-execute-multiple` | invoke | Execute multiple skills |
| `skill-chat` | invoke | Chat with skill-enabled AI |
| `skill-get-tools` | invoke | Get tool definitions for AI |
| `skill-get-context` | invoke | Get current context |
| `skill-status` | sync | Get skill system status |
| `skill-update-view` | sync | Update view context |
| `skill-update-selection` | sync | Update selection context |
| `skill-supports-tool-use` | sync | Check if current provider supports tool_use |

### Creating Custom Skills

```javascript
const BaseSkill = require('./BaseSkill');

class MyCustomSkill extends BaseSkill {
  static get name() { return 'my_custom_skill'; }
  static get description() { return 'Does something custom'; }
  static get category() { return 'custom'; }
  static get parameters() {
    return {
      input: { type: 'string', description: 'Input text' },
      option: { type: 'string', enum: ['a', 'b'], default: 'a' }
    };
  }
  static get requiredParams() { return ['input']; }

  static isAvailable(context) {
    return !!context.someService;
  }

  async execute({ input, option = 'a' }) {
    // Implementation
    const result = await this.context.someService.process(input, option);
    this.logExecution({ input, option }, { processed: true });
    return { output: result };
  }
}

// Register
registry.register(MyCustomSkill);
```

### Test Commands

```bash
# Run all skill tests (210 tests)
npm test -- --testPathPattern=skills

# Run specific test file
npm test -- --testPathPattern=skills/BaseSkill.test.js
npm test -- --testPathPattern=skills/AISkills.test.js
```

### InContextChatPanel Integration

The skill system is integrated into `InContextChatPanel` (`src/renderer/components/chat/InContextChatPanel.js`) to enable AI-directed skill execution during reading sessions.

**Features:**
- **Skill Mode Toggle**: Click the "Skills" chip in the header to enable/disable skill-aware chat
- **Auto-Detection**: Skill mode auto-enables if the AI provider supports tool use (Claude, GPT-4, etc.)
- **Tool Usage Indicators**: Shows which tools were used to generate each response
- **Direct Skill Execution**: Quick action buttons can execute skills directly when skill mode is on

**Quick Actions with Skill Mappings:**
| Button | Skill Used | Parameters |
|--------|-----------|------------|
| Summarize | `summarize` | `length: 'brief', format: 'bullets'` |
| Explain | `explain` | `useAnalogy: true` |
| Key Points | `extract_concepts` | - |
| Grammar | `grammar_check` | - |
| My Notes | `search_notes` | `searchType: 'semantic'` |

**How It Works:**
1. When skill mode is enabled, chat messages go through `skillApi.chatWithSkills()`
2. The AI can decide which tools/skills to use based on user request
3. Tool calls are executed by the skill executor in the main process
4. Results are displayed with tool usage badges under each message

**Context Updates:**
- View context (reading/browser, document ID) is sent to skill system
- Selection context (first 2000 chars of article) helps skills understand the current content

```javascript
// Example: Skill mode automatically uses tools
// User: "Summarize this article"
// AI: Uses summarize skill, returns formatted summary with "summarize" badge

// Example: Direct skill execution via quick action
// Click "Grammar" button → executeSkillDirect('grammar_check', {})
// Returns grammar errors with corrections and explanations
```

## Knowledge Dashboard

A comprehensive view for exploring and managing the knowledge graph.

### Route

`/knowledge` - Accessible from sidebar under "Learning" section

### Key File

`src/renderer/views/knowledge/KnowledgeDashboard.js`

### Features

- **Overview Stats**: Total concepts, books, notes, mastered count
- **Quick Stats Grid**: Visual cards for key metrics
- **Learning Progress**: Bar chart showing mastery distribution
- **Knowledge Graph Visualization**: Interactive force-directed graph
- **Recent Activity**: Timeline of knowledge growth
- **Weak Concepts Panel**: Concepts needing review
- **Memory Timeline**: Chronological view of consolidated learning memories

### Dashboard Tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| Knowledge Graph | `KnowledgeGraphPanel` | Force-directed graph visualization |
| Learning Path | `LearningPathPanel` | Personalized learning paths with prerequisites |
| Weak Concepts | `WeakConceptsPanel` | Concepts with low mastery or high errors |
| Adaptive Learning | `AdaptiveLearningPanel` | AI-powered learning insights |
| Memory Timeline | `MemoryTimelinePanel` | Chronological memory visualization |

### Memory Timeline Panel

Located in `src/renderer/components/knowledge/MemoryTimelinePanel.js`, displays consolidated memories in a chronological timeline view.

**Features:**
- **Timeline View**: Chronological display of ConsolidatedMemory nodes
- **Coverage View**: Memory coverage analysis by concept (bar chart)
- **Gaps View**: Concepts without recent memories (review prompts)
- **Memory Cards**: Expandable cards showing summary, insights, recommendations
- **Episode Drill-Down**: Click to load source episodes for any memory
- **Filtering**: Search by text, filter by memory type

**Sub-Tabs (overview mode):**
| Tab | Content |
|-----|---------|
| Timeline | Chronological list of all memories |
| Coverage | Concepts with most/least memories |
| Gaps | Concepts needing review (days since last memory) |

**Concept-Specific Mode:**
When `conceptId` is provided, shows full hierarchy: Concept → Memories → Episodes

**Usage:**
```javascript
import MemoryTimelinePanel from '../components/knowledge/MemoryTimelinePanel';

<MemoryTimelinePanel
  conceptId={selectedConcept?.id}    // Optional: filter to specific concept
  conceptName={selectedConcept?.name}
  onConceptSelect={handleSelect}     // Called when clicking gaps/coverage items
  onMemorySelect={handleMemory}      // Called when clicking a memory
  height={500}
  showStats={true}                   // Show stats overview
  showGaps={true}                    // Show memory gaps section
/>
```

**API Integration:**
- `graphApi.getSummarizationStats()` - Memory statistics
- `graphApi.getSummarizationHierarchy()` - Concept → Memory → Episode hierarchy
- `graphApi.getConceptTimeline()` - Chronological memories for a concept
- `graphApi.getMemoryCoverage()` - Coverage by concept
- `graphApi.findMemoryGaps()` - Concepts needing review
- `graphApi.getSourceEpisodes()` - Episodes for a memory

**Test Commands:**
```bash
# Run Memory Timeline Panel tests (16 tests)
npm test -- --testPathPattern=knowledge/MemoryTimelinePanel

# Run all memory consolidation tests (92 tests total)
npm test -- --testPathPattern="knowledge/MemoryTimelinePanel|brain/SummarizationGraphService|brain/brainHandlersSummarization"
```

### Integration Points

The Knowledge Dashboard is also embedded in:
- **Reading View** (`/reading/:id`): "Knowledge" tab in right sidebar showing book-specific concepts
- **Notes View** (`/notes`): Collapsible sidebar with knowledge graph summary

## Skill Integration Across Views

Skills are integrated across EPUB reader, PDF viewer, and Browser views, enabling AI-powered features with animated feedback.

### Architecture

```
View Components                          Skill System
─────────────                            ────────────
EPubView.js                              InContextChatPanel.js
  └── useEPUBAnimations() hook             └── selectedText prop
  └── onSelectionChange callback           └── Selection-aware quick actions
  └── onAnimationReady callback            └── Skill mode toggle

PDFView.js                               skillApi.js
  └── usePDFAnimations() hook              └── executeSkill()
  └── onSelectionChange callback           └── chatWithSkills()
  └── onAnimationReady callback

Browser.js                               Main Process Skills
  └── useSkills() hook                     └── SkillExecutor
  └── BrowserContextMenu integration       └── AIProviderManager
```

### Reading View Selection Bridge

The reading view (`/reading/:id`) tracks text selection and passes it to the AI chat panel:

**Key Files:**
- `src/renderer/views/reading/index.js` - EReaderPage with selection state
- `src/renderer/views/reading/EPubView.js` - EPUB with `onSelectionChange` callback
- `src/renderer/views/reading/PDFView.js` - PDF with `onSelectionChange` callback
- `src/renderer/components/chat/InContextChatPanel.js` - Receives `selectedText` prop

**Selection Flow:**
```javascript
// EReaderPage (index.js)
const [selectedText, setSelectedText] = useState('');
const handleSelectionChange = useCallback((text) => setSelectedText(text || ''), []);

// Pass to views
<EPubView onSelectionChange={handleSelectionChange} />
<PDFView onSelectionChange={handleSelectionChange} />

// Pass to chat panel
<InContextChatPanel selectedText={selectedText} />
```

**Selection-Aware Quick Actions:**
When text is selected, quick actions in InContextChatPanel show a hint and can operate on the selection:
- Summarize selected text
- Explain selected passage
- Check grammar of selection
- Generate quiz from selection

### Browser Skill Integration

The Browser view (`/browser/:id`) integrates skills through context menu and tracking:

**Context Menu Items:**
| Menu Item | Skill | Icon |
|-----------|-------|------|
| Smart Summary | `smart_summary` | AutoAwesome |
| Generate Quiz | `quiz_generate` | Quiz |
| Simplify Text | `text_simplify` | AccessibilityNew |
| 5W Analysis | `analyze_structure` | Analytics |
| Mind Map | `mindmap` | AccountTree |

**Skill Tracking:**
```javascript
// In Browser.js
const { executeSkill, isLoading } = useSkills({ loadOnMount: false });

// Track skill execution for analytics
const handleSmartSummary = async (selectedText) => {
  executeSkill('smart_summary', { text: selectedText, vocabularyWords, maxWords: 30 })
    .catch(e => console.log('Skill tracking failed:', e));

  // Continue with animation...
};
```

### EPUB/PDF Animation Integration

Both EPUB and PDF views support the "Word Constellation" flying animation effect for smart summaries.

**EPUB Integration:**
```javascript
// EPubView.js
import { useEPUBAnimations } from '../../components/animation-core/adapters/useEPUBAnimations';

function EPubView({ bookPath, curBook, curCfi, onSelectionChange, onAnimationReady }) {
  const animations = useEPUBAnimations(rendition);

  useEffect(() => {
    if (onAnimationReady && animations.isReady) {
      onAnimationReady({
        smartSummary: animations.smartSummary,
        highlightVocabulary: animations.highlightVocabulary,
        glowWords: animations.glowWords,
        removeSummary: animations.removeSummary,
        removeAllEffects: animations.removeAllEffects,
      });
    }
  }, [animations.isReady, onAnimationReady]);
}
```

**PDF Integration:**
```javascript
// PDFView.js
import { usePDFAnimations } from '../../components/animation-core/adapters/usePDFAnimations';

function PDFView({ bookPath, curBook, curNote, onSelectionChange, onAnimationReady }) {
  const pdfContainerRef = useRef(null);
  const animations = usePDFAnimations(pdfContainerRef);

  useEffect(() => {
    if (onAnimationReady && animations.isReady) {
      onAnimationReady({
        smartSummary: animations.smartSummary,
        highlightVocabulary: animations.highlightVocabulary,
        glowWords: animations.glowWords,
        removeSummary: animations.removeSummary,
        removeAllEffects: animations.removeAllEffects,
      });
    }
  }, [animations.isReady, onAnimationReady]);

  return (
    <div ref={pdfContainerRef}>
      <PdfHighlighter ... />
    </div>
  );
}
```

**Smart Summary API:**
```javascript
// Both EPUB and PDF adapters use the same signature:
animations.smartSummary(
  sourceText,       // Selected text from document
  summaryText,      // AI-generated summary
  vocabularyWords,  // User's vocabulary words (highlighted in gold)
  options           // { staggerDelay, duration, glowColor }
);
```

### SelectionMenu Component

A floating toolbar that appears above text selection for quick AI actions.

**Location:** `src/renderer/views/reading/SelectionMenu.js`

**Actions:**
| Icon | Action | Description |
|------|--------|-------------|
| Copy | `copy` | Copy to clipboard |
| VolumeUp | `tts` | Text-to-speech |
| Summarize | `summarize` | AI summarization (15+ words) |
| HelpOutline | `explain` | AI explanation |
| Spellcheck | `grammar` | Grammar check |
| Translate | `translate` | Translation |
| AutoAwesome | `smartSummary` | Flying word animation (15+ words) |

**Usage:**
```javascript
<SelectionMenu
  visible={showMenu}
  position={{ x: cursorX, y: cursorY }}
  selectedText={selection}
  onClose={() => setShowMenu(false)}
  onAction={(action, text) => handleAction(action, text)}
  isLoading={isProcessing}
/>
```

### Enhanced Adapters

**EPUBAdapter Features:**
- Coordinate translation from iframe to parent window
- Word wrapping for individual word targeting
- Bezier curve flying animation
- Vocabulary word highlighting (gold glow)
- Regular word glow (blue)
- Automatic cleanup on page change

**PDFAdapter Features:**
- PDF.js text layer span manipulation
- Word-level span wrapping within PDF spans
- Same flying animation as EPUB
- Mutation observer for page changes

**Animation Flow:**
1. Page dims with semi-transparent overlay
2. Source words wrap in spans for position tracking
3. Matching words glow (gold for vocabulary, blue for regular)
4. Non-matching words dim to 30% opacity
5. Summary container fades in at center
6. Word clones fly along Bezier curves from source to summary slots
7. Glow fades as words approach target
8. Remaining summary words fade in

## Learning Plan System

A comprehensive system for creating personalized learning plans with spaced repetition. Supports any learning goal decomposed into "learning points" (flashcard-style items).

### Architecture

```
Learning Plan Flow
├── UI Layer (Renderer)
│   ├── LearningPlanWizard.js      # 5-step wizard modal
│   ├── steps/GoalStep.js          # Step 1: Define goal & domain
│   ├── steps/MaterialStep.js      # Step 2: Select source material
│   ├── steps/ImportStep.js        # Step 3: Import/create items
│   ├── steps/CommitmentStep.js    # Step 4: Set time commitment
│   └── steps/ReviewStep.js        # Step 5: Review & create
│
├── API Layer
│   └── learningPlanApi.js         # Renderer-side API
│
├── IPC Layer
│   └── learningPlanHandlers.js    # Main process handlers
│
├── Service Layer
│   ├── LearningPlanGenerator.js   # Schedule calculation (Leitner/FSRS)
│   ├── LearningPointImporter.js   # File parsing (CSV, JSON, TXT, Excel)
│   └── VectorManager.js           # Unified vector storage
│
└── Database Layer
    └── LearningPlanManager.js     # SQLite CRUD operations
```

### Key Files

| File | Purpose |
|------|---------|
| `src/renderer/views/learning/LearningPlanWizard.js` | Main wizard container with stepper |
| `src/renderer/views/learning/steps/*.js` | Individual step components |
| `src/renderer/api/learningPlanApi.js` | Renderer-side API |
| `src/main/ipc/learningPlanHandlers.js` | IPC handlers for plan operations |
| `src/main/utils/LearningPlanGenerator.js` | Schedule calculation service |
| `src/main/utils/LearningPointImporter.js` | File import/parsing service |
| `src/main/db/LearningPlanManager.js` | Database manager |

### 5-Step Wizard Flow

1. **GoalStep**: Define learning goal name and select domain type
   - Domains: vocabulary, math, language, knowledge, skill
   - Each domain has optimized learning parameters

2. **MaterialStep**: Select source material
   - File upload (CSV, JSON, TXT, Excel with drag-drop)
   - Library book selection
   - Existing vocabulary set
   - URL import (Quizlet, Anki Web, direct links)
   - Manual entry mode

3. **ImportStep**: Preview and edit learning items
   - Automatic file parsing with column mapping
   - Manual card creation form
   - Editable data table with pagination
   - Bulk editing capabilities

4. **CommitmentStep**: Set time commitment
   - Daily study time slider (5-120 minutes)
   - Optional target completion date
   - Preferred time of day (morning/afternoon/evening/flexible)
   - Real-time plan calculation preview

5. **ReviewStep**: Review and create plan
   - Summary of all selections
   - Additional settings (reminders, knowledge graph sync)
   - Create plan button with progress indicator

### Domain Types & Colors

```javascript
const DOMAIN_COLORS = {
  vocabulary: { primary: '#4CAF50', light: '#E8F5E9' },  // Green
  math: { primary: '#2196F3', light: '#E3F2FD' },       // Blue
  language: { primary: '#9C27B0', light: '#F3E5F5' },   // Purple
  knowledge: { primary: '#FF9800', light: '#FFF3E0' },  // Orange
  skill: { primary: '#00BCD4', light: '#E0F7FA' },      // Cyan
};
```

### Universal Learning Points

All learning content is normalized to "Universal Learning Points" - atomic units with:
- `front`: Question, term, or prompt
- `back`: Answer, definition, or response
- `tags`: Optional categorization
- `difficulty`: easy/medium/hard
- `source`: Origin (file, book, vocabulary, url, manual)

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `learning-plan-create` | invoke | Create new plan with items |
| `learning-plan-calculate` | invoke | Calculate schedule without creating |
| `learning-point-import-file` | invoke | Parse file (CSV, JSON, TXT, Excel) |
| `learning-point-extract-from-book` | invoke | Extract from library book |
| `learning-point-from-vocabulary` | invoke | Load from vocabulary set |
| `learning-point-import-url` | invoke | Import from web URL |
| `learning-plan-list` | invoke | Get all plans |
| `learning-plan-get` | invoke | Get single plan with details |
| `learning-plan-get-due` | invoke | Get items due for review |
| `learning-plan-record-review` | invoke | Record review result |
| `learning-plan-toggle-status` | invoke | Pause/resume plan |
| `learning-plan-delete` | invoke | Delete plan |

### Usage

**Open the wizard:**
```javascript
import { LearningPlanWizard } from '../views/learning';

<LearningPlanWizard
  open={showWizard}
  onClose={() => setShowWizard(false)}
  onComplete={(plan) => console.log('Created:', plan)}
/>
```

**Use the API directly:**
```javascript
import learningPlanApi from '../api/learningPlanApi';

// Create a plan
const result = await learningPlanApi.createPlan({
  goalName: 'GRE Vocabulary',
  domainType: 'vocabulary',
  learningPoints: [...],
  dailyMinutes: 30,
});

// Get due items
const due = await learningPlanApi.getDueItems({ planId: 'plan_123', limit: 20 });

// Record review
await learningPlanApi.recordReview({
  planId: 'plan_123',
  pointId: 'point_456',
  correct: true,
  responseTime: 2500,
});
```

### Spaced Repetition Algorithms

**Leitner System (Default):**
- 5 boxes with increasing intervals
- Correct → move forward one box
- Incorrect → back to box 1
- Box intervals: 1, 2, 4, 7, 14 days

**FSRS (Free Spaced Repetition Scheduler):**
- Algorithm parameter tuning based on review history
- Stability and difficulty tracking
- Optimal retention targeting

### Integration with Knowledge Graph

When `syncProgress` is enabled:
- Learning points are synced to Neo4j as nodes
- Mastery levels are tracked with relationships
- Progress analytics available in Knowledge Dashboard

### Test Commands

```bash
# Run learning plan tests
npm test -- --testPathPattern=learning

# Specific test files
npm test -- --testPathPattern=LearningPlanGenerator.test.js
npm test -- --testPathPattern=LearningPointImporter.test.js
npm test -- --testPathPattern=VectorManager.test.js
npm test -- --testPathPattern=Neo4jAdapterChunks.test.js
```

## Study Session System

The Study Session view (`/study/:planId`) provides an immersive, focused learning experience for reviewing learning points using spaced repetition.

### Architecture

```
src/renderer/views/study/
├── index.js                     # Route exports
├── StudySessionPage.js          # Main container with routing
├── components/
│   ├── StudyCard.js             # Flip card (extends FlipCard pattern)
│   ├── StudyControls.js         # Rating buttons (1-4) + keyboard shortcuts
│   ├── SessionSummary.js        # End-of-session stats modal
│   └── PauseOverlay.js          # Pause screen with progress
└── hooks/
    └── useStudySession.js       # Session state management
```

### Key Features

**Session Modes:**
| Mode | Description |
|------|-------------|
| Standard | Review all due items (default) |
| Quick | 5-10 minute burst (15 items max) |
| Focused | Single topic/tag filter |
| Cram | All items regardless of schedule |
| Custom | User-defined count/time |

**4-Point Rating System:**
| Rating | Key | Effect |
|--------|-----|--------|
| Again (1) | `1` | Reset to box 1, review in 1 min |
| Hard (2) | `2` | Stay in box, 1.2× interval |
| Good (3) | `3` | Advance to next box |
| Easy (4) | `4` | Skip a box, 1.5× interval |

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `Space` | Flip card |
| `1-4` | Rate answer (after flip) |
| `H` | Show hint |
| `S` | Skip card |
| `P` | Pause/Resume |
| `Esc` | End session |

### Routes

| Route | Description |
|-------|-------------|
| `/study/:planId` | Study specific plan |
| `/study/all` | Study all due items |
| `/study/all?date=2024-01-15` | Study items due on specific date |
| `/study/:planId?mode=quick` | Quick study mode |

### Components

**StudySessionPage.js:**
- Main container with header (progress, timer, controls)
- Manages session state via `useStudySession` hook
- Keyboard event handling
- Integration with learningPlanApi

**StudyCard.js:**
- 3D flip animation (extends FlipCard CSS)
- Front: Question/term with hint support
- Back: Answer with tags
- Domain-colored styling

**StudyControls.js:**
- Front: Flip button, hint, skip
- Back: 4 rating buttons with colors and keyboard hints

**SessionSummary.js:**
- Performance breakdown (Easy/Good/Hard/Again percentages)
- Stats: items reviewed, accuracy, time, best streak
- Actions: Review Mistakes, Continue, Done

### useStudySession Hook

```javascript
import useStudySession, { RATINGS, SESSION_MODES } from './hooks/useStudySession';

const {
  // State
  session,           // Full session state
  currentItem,       // Current learning point
  isLoading,
  error,
  isComplete,

  // Actions
  startSession,      // Initialize and load items
  rateAnswer,        // Rate current card (1-4)
  skipItem,
  pauseSession,
  resumeSession,
  endSession,

  // Computed
  progress,          // 0-100%
  accuracy,          // 0-100%
  timeRemaining,     // Seconds (if maxMinutes set)
  summary,           // Final stats object
} = useStudySession({
  planId: 'plan_123',
  mode: SESSION_MODES.STANDARD,
  date: '2024-01-15',
  maxItems: 50,
  maxMinutes: 30,
});
```

### Calendar Integration

The Learning Calendar integrates with Study Sessions:

**Calendar → Study Session:**
- Click day cell → Day Detail Panel shows "Study Now" button
- Forecast Panel has play buttons for each day
- "Study All" button for today's due items

**Study Session → Calendar:**
- Session completion triggers calendar refresh
- Updates daily review data and streak tracking
- Heatmap intensity reflects session performance

### Entry Points

1. **Learning Plans Page** → "Study" button on plan cards
2. **Learning Calendar** → Click day with due items → "Study Now"
3. **Calendar Forecast** → Play buttons next to each day
4. **Direct URL** → `/study/:planId` or `/study/all`

### API Methods

```javascript
import learningPlanApi from '../api/learningPlanApi';

// Start session (returns sessionId)
await learningPlanApi.startSession({ planId, mode, itemCount });

// Get due items
await learningPlanApi.getDueItems({ planId, date, mode, limit });

// Record review
await learningPlanApi.recordReview({ planId, sessionId, pointId, rating, responseTime });

// Complete session
await learningPlanApi.completeSession({ planId, sessionId, stats });

// Get calendar data
await learningPlanApi.getDailyReviewData({ startDate, endDate, planId });
await learningPlanApi.getForecast({ days: 7, planId });
```

## Study Session Enhanced Features

Enhanced features for study sessions including AI-powered hints with caching, configurable sound effects, and TTS pronunciation.

### Architecture

```
Main Process
├── src/main/db/AICacheManager.js           # SQLite caching for AI responses
└── src/main/ipc/studyEnhancementHandlers.js # IPC handlers for hints/sounds

Renderer Process
├── src/renderer/api/studyEnhancementApi.js  # Client API
├── src/renderer/views/study/hooks/
│   ├── useStudyHints.js                     # Progressive hints with caching
│   └── useStudySounds.js                    # Configurable sound effects
└── src/renderer/views/settings/
    └── SoundSettingsSection.js              # Settings UI for sounds/cache
```

### AI Cache System

The `AICacheManager` provides SQLite-based caching to avoid repeated AI API calls:

**Cache Types:**
| Type | Expiry | Purpose |
|------|--------|---------|
| `hint` | 90 days | AI-generated hints for learning points |
| `pronunciation` | 180 days | TTS pronunciation data |
| `explanation` | 30 days | AI explanations |

**Key Functions:**
```javascript
import { getCachedContent, setCachedContent, generateCacheKey } from './db/AICacheManager';

// Check cache before AI call
const cacheKey = generateCacheKey('hint', { front: item.front, hintType });
const cached = getCachedContent('hint', cacheKey, token);
if (cached) return cached.content;

// Cache AI response
setCachedContent('hint', cacheKey, aiResponse, {
  expiryDays: 90,
  metadata: { hintType },
  token,
});
```

### Progressive Hint System

`useStudyHints` provides 4 levels of progressive hints:

| Level | Hint Type | Example |
|-------|-----------|---------|
| 1 | `first_letter` | "Starts with 'E'..." |
| 2 | `category` | "This is a type of..." |
| 3 | `context` | "Used when describing..." |
| 4 | `partial` | "eph___al" |

**Usage:**
```javascript
import useStudyHints from './hooks/useStudyHints';

const {
  currentHint,
  hintLevel,
  isLoading,
  requestHint,       // Get next progressive hint
  resetHint,         // Reset for new card
  getHintAvailability,
} = useStudyHints({ useAI: true, token });

// Request progressive hint (level 1 → 2 → 3 → 4)
await requestHint(currentItem);

// Check availability
const { available, levelsUsed, maxLevels } = getHintAvailability(item);
```

### Configurable Sound Effects

`useStudySounds` provides Web Audio API-based sound effects with full configuration:

**Sound Types:**
| Sound | Trigger | Default Volume |
|-------|---------|----------------|
| `flip` | Card flip | 0.4 |
| `correct` | Good/Easy rating | 0.6 |
| `incorrect` | Again/Hard rating | 0.5 |
| `streak` | Milestone (5, 10, 25...) | 0.7 |
| `complete` | Session complete | 0.8 |
| `levelUp` | Box promotion | 0.8 |

**Usage:**
```javascript
import useStudySounds from './hooks/useStudySounds';

const {
  playFlip,
  playCorrect,
  playIncorrect,
  playStreak,
  playComplete,
  speak,           // TTS
  toggleSounds,
  updateConfig,
} = useStudySounds();

// Play on rating
if (rating >= RATINGS.GOOD) {
  playCorrect();
  playStreak(session.streak + 1);
} else {
  playIncorrect();
}

// TTS pronunciation
speak(currentItem.front, { language: 'en-US' });
```

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `study-get-hint` | invoke | Get AI hint (cached) |
| `study-get-pronunciation` | invoke | Get TTS data (cached) |
| `study-get-sound-config` | sync | Get sound settings |
| `study-set-sound-config` | sync | Save sound settings |
| `study-clear-hint-cache` | invoke | Clear hint cache |
| `study-clear-pronunciation-cache` | invoke | Clear TTS cache |
| `study-get-cache-stats` | invoke | Get cache statistics |

### Settings UI

In Settings → "Sound Effects & AI Cache":

- **Master Toggle**: Enable/disable all sounds
- **Master Volume**: 0-100% slider
- **Individual Sounds**: Toggle and volume for each sound type
- **Cache Management**: View stats and clear caches

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `H` | Request next hint level |
| `R` | Pronounce current term (TTS) |
| `1-4` | Rate answer |
| `Space` | Flip card |

### Test Commands

```bash
# Run enhanced features tests
npm test -- --testPathPattern=AICacheManager.test.js
npm test -- --testPathPattern=studyEnhancementHandlers.test.js
npm test -- --testPathPattern=useStudyHints.test.js
npm test -- --testPathPattern=useStudySounds.test.js
```

## Study Analytics & Insights

Comprehensive analytics system for tracking study session performance, identifying weak items, calculating learning velocity, and suggesting optimal study times.

### Architecture

```
Main Process
├── src/main/db/SessionAnalyticsManager.js    # SQLite analytics storage
└── src/main/ipc/studyAnalyticsHandlers.js    # IPC handlers

Renderer Process
├── src/renderer/api/studyAnalyticsApi.js     # Client API with helper functions
├── src/renderer/views/study/hooks/
│   └── useStudyAnalytics.js                  # Analytics data access hook
└── src/renderer/views/study/components/
    ├── AnalyticsDashboard.js                 # Main container
    ├── SessionHistoryPanel.js                # Paginated session history
    ├── PerformanceTrendsChart.js             # SVG line charts
    ├── WeakItemsPanel.js                     # Items needing practice
    └── OptimalTimeRecommendation.js          # Best study times
```

### Database Tables

Two SQLite tables store analytics data:

**session_analytics:**
```sql
CREATE TABLE session_analytics (
  id TEXT PRIMARY KEY,
  userId INTEGER,
  sessionId TEXT,
  topicId TEXT,
  date TEXT,
  startTime TEXT,
  endTime TEXT,
  durationMinutes INTEGER,
  itemsReviewed INTEGER,
  correctCount INTEGER,
  incorrectCount INTEGER,
  accuracy TEXT,
  avgResponseTimeMs INTEGER,
  focusScore INTEGER,        -- 0-100 based on hints, pauses, response time
  efficiencyScore INTEGER,   -- 0-100 based on accuracy × speed × throughput
  retentionRate TEXT,        -- Weighted recent review performance
  hintsUsed INTEGER,
  pauseCount INTEGER,
  pauseDurationSeconds INTEGER,
  streakMax INTEGER,
  conceptsImproved TEXT,     -- JSON array of concept IDs
  metadata TEXT,             -- JSON for additional data
  createdAt TEXT
);
```

**learning_velocity:**
```sql
CREATE TABLE learning_velocity (
  id TEXT PRIMARY KEY,
  userId INTEGER,
  topicId TEXT,
  date TEXT,
  masteryStart TEXT,         -- Mastery % at session start
  masteryEnd TEXT,           -- Mastery % at session end
  velocity TEXT,             -- % change per period
  itemsLearned INTEGER,
  itemsReviewed INTEGER,
  timeSpentMinutes INTEGER,
  createdAt TEXT
);
```

### Performance Metrics

**Focus Score (0-100):**
Measures how focused the learner was during the session.
```javascript
focusScore = 100
  - (hintsUsed * 5)              // Penalty for hint usage
  - (pauseCount * 10)            // Penalty for pauses
  - (avgResponseTimeBonus)       // Bonus for fast responses
```

**Efficiency Score (0-100):**
Measures learning efficiency combining accuracy and speed.
```javascript
efficiencyScore = (accuracy * 0.5) + (speedScore * 0.3) + (throughputScore * 0.2)
```

**Retention Rate:**
Weighted average of recent review performance (exponential decay).

**Learning Velocity:**
Mastery change per time period (daily/weekly).
```javascript
velocity = ((masteryEnd - masteryStart) / timeSpentMinutes) * 60
```

### Key Features

**1. Session History:**
- Paginated list of past sessions
- Expandable rows with detailed stats
- Filter by topic/date range

**2. Performance Trends:**
- SVG-based line charts (no external library)
- Daily/weekly aggregation
- Metrics: accuracy, study time, items reviewed

**3. Weak Items Detection:**
- Items with low accuracy (<60%)
- Items frequently marked "Again"
- Integration with knowledge graph concepts

**4. Optimal Study Time Analysis:**
- Hour-by-hour performance breakdown
- Day-of-week patterns
- Personalized recommendations

**5. Export Functionality:**
- JSON export with full details
- CSV export for spreadsheets

### useStudyAnalytics Hook

```javascript
import useStudyAnalytics, {
  useSessionHistory,
  usePerformanceComparison,
  useExportAnalytics,
} from './hooks/useStudyAnalytics';

// Main hook
const {
  dashboard,           // Summary stats
  trends,              // Performance trends array
  velocity,            // Learning velocity data
  isLoading,
  error,

  // Data loading
  loadDashboard,
  loadTrends,
  loadVelocity,
  loadWeakItems,

  // Session tracking
  startSessionTracking,
  recordReview,
  recordHintUsed,
  recordPause,
  endSessionAndRecord,

  // Computed values
  performanceLevel,    // { label, color }
  velocityTrend,       // 'improving' | 'declining' | 'stable'
} = useStudyAnalytics({ token, autoLoad: true });

// Session history hook
const {
  sessions,
  total,
  hasMore,
  page,
  nextPage,
  prevPage,
} = useSessionHistory({ token, pageSize: 20 });

// Export hook
const {
  exportData,
  isExporting,
} = useExportAnalytics(token);
```

### Session Tracking Integration

Analytics are automatically tracked in `StudySessionPage.js`:

```javascript
// In StudySessionPage.js
const {
  startSessionTracking,
  recordReview,
  recordHintUsed,
  recordPause,
  endSessionAndRecord,
} = useStudyAnalytics({ token });

// On mount
useEffect(() => {
  startSessionTracking();
}, []);

// On answer rating
const handleRate = (rating) => {
  recordReview({
    itemId: currentItem.id,
    wasCorrect: rating >= RATINGS.GOOD,
    rating,
    responseTimeMs: Date.now() - session.itemStartTime,
  });
  rateAnswer(rating);
};

// On hint usage
const handleHint = () => {
  recordHintUsed();
  requestHint(currentItem);
};

// On session complete
useEffect(() => {
  if (isComplete && summary) {
    endSessionAndRecord(session.id, {
      topicId: planId,
      durationMinutes: Math.round(session.elapsedTime / 60),
      masteryStart: summary.masteryStart,
      masteryEnd: summary.masteryEnd,
    });
  }
}, [isComplete]);
```

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `analytics-record-session` | invoke | Record session analytics |
| `analytics-get-session` | invoke | Get single session details |
| `analytics-get-trends` | invoke | Get performance trends |
| `analytics-get-weekly` | invoke | Get weekly performance |
| `analytics-record-velocity` | invoke | Record learning velocity |
| `analytics-get-velocity` | invoke | Get velocity for topic |
| `analytics-get-aggregate-velocity` | invoke | Get aggregate velocity stats |
| `analytics-optimal-times` | invoke | Analyze optimal study times |
| `analytics-weak-items` | invoke | Identify weak items |
| `analytics-session-history` | invoke | Get session history (paginated) |
| `analytics-export` | invoke | Export session data |
| `analytics-dashboard` | invoke | Get dashboard summary |
| `analytics-sync-mastery` | invoke | Sync mastery to knowledge graph |
| `analytics-graph-insights` | invoke | Get graph-based insights |

### API Helper Functions

```javascript
import studyAnalyticsApi, {
  calculateFocusScore,
  calculateEfficiencyScore,
  calculateRetentionRate,
  getPerformanceLevel,
  formatDuration,
  formatAccuracy,
} from '../api/studyAnalyticsApi';

// Calculate scores
const focus = calculateFocusScore({
  avgResponseTimeMs: 3000,
  hintsUsed: 2,
  pauseCount: 1,
  itemsReviewed: 20,
});

const efficiency = calculateEfficiencyScore({
  accuracy: 85,
  avgResponseTimeMs: 2500,
  itemsReviewed: 30,
  durationMinutes: 15,
});

// Get performance level
const level = getPerformanceLevel(85);
// { label: 'Good', color: '#4CAF50' }

// Format for display
formatDuration(75);    // "1h 15m"
formatAccuracy(85.5);  // "85.5%"
```

### AnalyticsDashboard Component

The main dashboard container with four tabs:

```javascript
import AnalyticsDashboard from './components/AnalyticsDashboard';

<AnalyticsDashboard
  token={userToken}
  topicId={planId}     // Optional: filter by topic
/>
```

**Tabs:**
1. **Trends**: Performance charts (accuracy, time, items)
2. **History**: Paginated session list
3. **Weak Items**: Items needing practice
4. **Best Times**: Optimal study time recommendations

**Summary Cards:**
- Today's stats (items, accuracy)
- This week's stats
- Current streak
- Learning velocity

### Test Commands

```bash
# Run analytics tests
npm test -- --testPathPattern=SessionAnalyticsManager.test.js
npm test -- --testPathPattern=studyAnalyticsHandlers.test.js
npm test -- --testPathPattern=useStudyAnalytics.test.js
```

## AI Learning Brain

An autonomous background agent that manages learning through episodic memory and periodic analysis. Inspired by [OpenClaw](https://openclaw.ai) heartbeat mechanism and [Graphiti/Zep](https://github.com/getzep/graphiti) episodic memory.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LEARNING BRAIN SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Background Service (survives app exit)                            │ │
│  │  ──────────────────────────────────────                            │ │
│  │  src/service/                                                      │ │
│  │  ├── index.js              Main service entry point                │ │
│  │  ├── HeartbeatScheduler.js Timing and wake-up logic               │ │
│  │  ├── ServiceState.js       Persistent state (survives restarts)   │ │
│  │  ├── IPCServer.js          Named Pipe / Unix Socket server        │ │
│  │  ├── NotificationBridge.js System notifications                   │ │
│  │  ├── DatabaseBridge.js     SQLite read access                     │ │
│  │  └── install/ServiceInstaller.js  Cross-platform installer        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              │ IPC (Named Pipe / Unix Socket)           │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Main Electron App (hybrid fallback)                               │ │
│  │  ──────────────────────────────────                                │ │
│  │  src/main/brain/                                                   │ │
│  │  ├── index.js              Module exports                         │ │
│  │  ├── LearningBrainAgent.js Brain orchestrator                     │ │
│  │  ├── HybridScheduler.js    Fallback scheduler                     │ │
│  │  ├── ServiceClient.js      IPC client to service                  │ │
│  │  └── EpisodeCollector.js   Learning event collection              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Background Service** | Runs independently of Electron, survives app exit |
| **Hybrid Fallback** | In-app scheduler if service installation fails |
| **Episodic Memory** | Collects timestamped learning events to Neo4j |
| **Heartbeat System** | Periodic wake-up (default 24h) for analysis |
| **System Notifications** | Notifies user even when app is closed |
| **Catch-up Logic** | Handles missed heartbeats after computer off |

### Episode Types

```javascript
import { EPISODE_TYPES, recordEvent } from '../api/brainApi';

// Record a review completion
recordEvent.reviewCompleted({
  conceptId: item.id,
  conceptName: item.front,
  rating: 3, // 1=Again, 2=Hard, 3=Good, 4=Easy
  responseTimeMs: 2500,
  hintUsed: false,
  previousBox: 2,
  newBox: 3,
});

// Record session start/end
recordEvent.sessionStarted({ planId, mode, date });
recordEvent.sessionEnded({ sessionId, itemsReviewed, accuracy });

// Other events
recordEvent.bookOpened({ bookId, title });
recordEvent.noteCreated({ noteId, sourceType });
recordEvent.masteryChanged({ itemId, direction: 'improved', fromBox: 2, toBox: 3 });
```

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `brain-get-status` | invoke | Get brain status (mode, running, etc.) |
| `brain-get-insights` | invoke | Get cached insights (quick) |
| `brain-trigger-heartbeat` | invoke | Trigger immediate heartbeat |
| `brain-record-episode` | invoke | Record a learning event |
| `brain-get-episodes` | invoke | Get recent episodes |
| `brain-get-config` | invoke | Get brain configuration |
| `brain-set-config` | invoke | Update configuration |
| `brain-set-enabled` | invoke | Enable/disable brain |
| `brain-service-status` | invoke | Get background service status |
| `brain-service-install` | invoke | Install background service |
| `brain-service-uninstall` | invoke | Uninstall background service |

### Renderer API

```javascript
import brainApi from '../api/brainApi';

// Status and insights
const status = await brainApi.getStatus();
const insights = await brainApi.getInsights();

// Trigger heartbeat manually
await brainApi.triggerHeartbeat();

// Record episode
await brainApi.recordEpisode({
  eventType: 'REVIEW_COMPLETED',
  payload: { conceptId, rating, responseTimeMs },
});

// Service management
await brainApi.installService();
await brainApi.uninstallService();
const serviceStatus = await brainApi.getServiceStatus();

// Configuration
await brainApi.setEnabled(true);
await brainApi.setConfig({ notifications: { streakAlert: true } });
```

### Background Service Dependencies

```bash
# Windows
npm install node-windows node-notifier

# macOS
npm install node-mac node-notifier

# Linux
npm install node-linux node-notifier
```

### Settings UI

The brain settings are available in Settings → "AI Learning Brain":
- Enable/disable toggle
- Current insights display
- Heartbeat schedule and manual trigger
- Background service install/uninstall
- Notification preferences

### Documentation

**Comprehensive LLM-Driven Learning Management System**: [docs/LLM-DRIVEN-LEARNING-MANAGEMENT-SYSTEM.md](docs/LLM-DRIVEN-LEARNING-MANAGEMENT-SYSTEM.md) - Complete reference for the LLM-driven scheduling, personalization, and memory systems.

Full architecture documentation: [docs/AI-Learning-Brain-Architecture.md](docs/AI-Learning-Brain-Architecture.md)

Comprehensive agentic AI analysis: [docs/Agentic-AI-Implementation-Analysis.md](docs/Agentic-AI-Implementation-Analysis.md)

### Memory Consolidation

LLM-powered memory consolidation that periodically summarizes raw learning episodes into higher-level memory patterns. Inspired by [Graphiti/Zep](https://github.com/getzep/graphiti) episodic memory consolidation.

**Architecture:**

```
Tier 1: Episodic Memory (raw events)
├── Individual learning events
├── Bi-temporal timestamps (t_valid, t_created)
└── Buffered + flushed to Neo4j/local storage

        ↓ (consolidation via LLM)

Tier 2: Consolidated Memory (synthesized)
├── LLM-generated summaries
├── Concept-level insights
├── Learning process analysis
└── Stored in SQLite (consolidated_memory table)
```

**Key Files:**

| File | Purpose |
|------|---------|
| `src/main/db/ConsolidatedMemoryManager.js` | SQLite CRUD for consolidated memories |
| `src/main/utils/ConsolidationService.js` | Core consolidation logic and LLM synthesis |
| `src/main/utils/SummarizationGraphService.js` | Neo4j graph patterns for memory relationships |
| `src/commons/utils/AIPrompts.js` | `createMemoryConsolidationPrompt()` function |
| `src/main/brain/LearningBrainAgent.js` | `runConsolidation()` integration |
| `src/main/brain/EpisodeCollector.js` | `markAsProcessed()` for tracking |

**Consolidation Pipeline:**

```
Heartbeat (24h) or Manual Trigger
        │
        ▼
Query Episodes (last 7 days, unprocessed)
        │
        ▼
Group by Concept Clusters
  └── Detect context shifts (gaps > 24h)
  └── Sort chronologically within clusters
        │
        ▼
For each cluster (≥3 episodes):
  ├── Analyze learning process
  │   ├── Accuracy, box progression
  │   ├── Struggle patterns
  │   ├── Cramming detection
  │   └── Response time analysis
  ├── Call LLM for synthesis
  ├── Store ConsolidatedMemory
  └── Mark episodes as processed
        │
        ▼
Archive old episodes (30 days) → Delete (90 days)
```

**Memory Types:**

| Type | Description |
|------|-------------|
| `concept_session` | Single learning session for a specific concept |
| `daily` | Daily summary across all concepts |
| `weekly` | Weekly learning summary |

**Mastery Assessment Levels:**

| Level | Description |
|-------|-------------|
| `beginner` | <50% accuracy, needs fundamentals |
| `developing` | 50-80% accuracy, progressing |
| `proficient` | 80-95% accuracy, strong understanding |
| `mastered` | >95% accuracy, fully learned |

**Learning Style Classifications:**

| Style | Pattern |
|-------|---------|
| `quick` | Fast mastery, few repetitions needed |
| `steady` | Consistent, gradual improvement |
| `needs-repetition` | Requires multiple reviews |
| `variable` | Inconsistent performance |

**IPC Handlers (Memory Consolidation):**

| Handler | Type | Purpose |
|---------|------|---------|
| `brain-consolidate-now` | invoke | Trigger manual consolidation |
| `brain-get-memories` | invoke | Get consolidated memories with filters |
| `brain-get-memory` | invoke | Get single memory by ID |
| `brain-search-memories` | invoke | Search memories by content |
| `brain-get-consolidation-stats` | invoke | Get consolidation statistics |
| `brain-delete-memory` | invoke | Delete a consolidated memory |
| `brain-delete-old-memories` | invoke | Delete memories older than N days |
| `brain-get-episode-stats` | invoke | Get episode statistics |

**Renderer API (Memory Consolidation):**

```javascript
import brainApi, { MEMORY_TYPES, MASTERY_LEVELS, LEARNING_STYLES } from '../api/brainApi';

// Trigger manual consolidation
const result = await brainApi.consolidateNow({ token, periodDays: 7, minEpisodes: 3 });

// Get consolidated memories
const memories = await brainApi.getConsolidatedMemories({
  token,
  conceptId: 'concept_123',
  memoryType: MEMORY_TYPES.CONCEPT_SESSION,
  limit: 20,
});

// Search memories
const results = await brainApi.searchMemories('vocabulary', token);

// Get statistics
const stats = await brainApi.getConsolidationStats(token);
// { totalMemories, totalEpisodesConsolidated, uniqueConcepts, masteryDistribution }

// Get episode statistics
const episodeStats = await brainApi.getEpisodeStats();
// { total, byType, processedCount, unprocessedCount, bufferSize }
```

**Consolidated Memory Schema:**

```sql
CREATE TABLE "consolidated_memory" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "concept_id" TEXT,
  "concept_name" TEXT,
  "memory_type" TEXT NOT NULL,        -- concept_session, daily, weekly
  "period_start" TEXT NOT NULL,
  "period_end" TEXT NOT NULL,
  "episode_count" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,            -- LLM-generated narrative
  "insights" TEXT,                    -- JSON: key patterns
  "learning_process" TEXT,            -- JSON: process analysis
  "metrics" TEXT,                     -- JSON: accuracy, times, etc.
  "source_episodes" TEXT,             -- JSON: episode IDs
  "mastery_assessment" TEXT,          -- beginner/developing/proficient/mastered
  "learning_style" TEXT,              -- quick/steady/needs-repetition/variable
  "recommendations" TEXT,             -- JSON: actionable suggestions
  "created_at" TEXT NOT NULL,
  "expires_at" TEXT
);
```

**LLM Synthesis Output:**

```json
{
  "summary": "Learning session for 'ephemeral' with 8 reviews. Started with difficulty but improved after hint usage...",
  "keyInsights": [
    "Struggled initially but improved after 3rd attempt",
    "Response time decreased from 5s to 2s indicating familiarity"
  ],
  "masteryAssessment": "developing",
  "learningStyle": "steady",
  "progressionNarrative": "Initial confusion resolved through repetition and hints...",
  "strugglingAreas": ["Spelling", "Context usage"],
  "breakthroughMoments": ["Correct on 5th attempt without hint"],
  "recommendations": ["Practice in sentence context"],
  "metrics": {
    "totalReviews": 8,
    "correctRate": 62,
    "averageResponseTimeMs": 3200,
    "consistencyScore": 45
  }
}
```

**Test Commands:**

```bash
# Run consolidation tests
npm test -- --testPathPattern=consolidation

# Run specific test files
npm test -- --testPathPattern=ConsolidatedMemoryManager.test.js
npm test -- --testPathPattern=ConsolidationService.test.js
```

**Neo4j Graph Integration:**

Consolidated memories are synced to Neo4j with full relationship tracking. See [Memory Consolidation Graph (SummarizationGraphService)](#memory-consolidation-graph-summarizationgraphservice) for details on:
- `:CONSOLIDATED_INTO` relationships (Episode → ConsolidatedMemory)
- `:SUMMARIZES` relationships (ConsolidatedMemory → Concept)
- `:MEMORY_RELATES` relationships (ConsolidatedMemory ↔ ConsolidatedMemory)
- Aggregated mastery calculation from memory data
- Memory gap detection and coverage analysis

### Cross-Concept Analysis & Learner Profile Inference

Advanced pattern detection that analyzes relationships between concepts and infers learner characteristics from behavioral data.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CROSS-CONCEPT ANALYSIS SYSTEM                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Episodic Memory (raw events)                                        │
│         │                                                            │
│         ▼                                                            │
│  CrossConceptAnalyzer.js                                             │
│  ├── Prerequisite detection (temporal correlation)                  │
│  ├── Interference detection (negative correlation)                  │
│  ├── Positive transfer (correlated velocities)                      │
│  ├── Concept clustering (co-study patterns)                         │
│  └── Forgetting correlation (decay together)                        │
│         │                                                            │
│         ▼                                                            │
│  LearnerProfileInference.js                                          │
│  ├── Learning style inference (visual, textual, mixed)              │
│  ├── Optimal timing (time of day, session length)                   │
│  ├── Forgetting curve modeling                                       │
│  ├── Pace preferences (burst, steady, marathon)                     │
│  └── Engagement patterns                                             │
│         │                                                            │
│         ▼                                                            │
│  Profile Updates → SQLite + Neo4j                                    │
│  Recommendations → Scheduling, Content, Strategy                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Files:**

| File | Purpose |
|------|---------|
| `src/commons/model/LearningPatterns.ts` | TypeScript types for all pattern categories |
| `src/main/utils/CrossConceptAnalyzer.js` | Pattern detection service |
| `src/main/utils/LearnerProfileInference.js` | Profile inference service |
| `src/main/utils/ConsolidationService.js` | Integration with consolidation pipeline |
| `src/main/ipc/brainHandlers.js` | IPC handlers for analysis |
| `src/renderer/api/brainApi.js` | Renderer-side API |

**Pattern Categories:**

| Category | Patterns |
|----------|----------|
| **Temporal** | Optimal study time, session duration, cramming, spacing compliance |
| **Performance** | Struggle chains, response time, confidence calibration, hint usage |
| **Cross-Concept** | Prerequisites, interference, positive transfer, clustering, forgetting correlation |
| **Behavioral** | Session triggers, quit signals, content preferences, pace, goal orientation |

**Cross-Concept Pattern Types:**

| Pattern | Detection Method | Insight |
|---------|------------------|---------|
| `PREREQUISITE` | Concept A mastered before B improves B's learning | "Study A before B" |
| `INTERFERENCE` | Negative correlation between concepts | "Space out A and B" |
| `POSITIVE_TRANSFER` | Correlated learning velocities | "A and B reinforce each other" |
| `CONCEPT_CLUSTER` | Frequently studied together | "Group for efficient learning" |
| `FORGETTING_CORRELATION` | Decay together over time | "Review A and B together" |

**Learner Profile Fields:**

```typescript
interface LearnerGlobalProfile {
  learningStyle: 'visual' | 'textual' | 'mixed';
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'flexible';
  optimalSessionLength: number;  // minutes
  consistencyScore: number;      // 0-100
  forgettingCurveSlope: number;  // lower = better retention
  pacePreference: 'burst' | 'steady' | 'marathon';
  aiInsights: string[];
}

interface LearnerDomainProfile {
  domainType: string;
  accuracyTrend: 'improving' | 'stable' | 'declining';
  learningVelocityTrend: 'accelerating' | 'stable' | 'decelerating';
  weakAreas: WeakArea[];
  strongAreas: string[];
  suggestedFocus: string[];
}
```

**IPC Handlers (Cross-Concept & Profile):**

| Handler | Type | Purpose |
|---------|------|---------|
| `brain-analyze-cross-concept` | invoke | Run cross-concept pattern analysis |
| `brain-get-cross-concept-patterns` | invoke | Get recent patterns |
| `brain-get-concept-patterns` | invoke | Get patterns for specific concept |
| `brain-infer-profile` | invoke | Run learner profile inference |
| `brain-get-learner-profile` | invoke | Get current profile (global + domains) |
| `brain-get-domain-profile` | invoke | Get profile for specific domain |
| `brain-update-profile` | invoke | Update profile manually |
| `brain-get-recommendations` | invoke | Get personalized learning recommendations |
| `brain-get-optimal-study-times` | invoke | Get optimal study times |
| `brain-get-concept-relationships` | invoke | Get concept graph for visualization |

**Renderer API:**

```javascript
import brainApi, { PATTERN_TYPES, DOMAIN_TYPES } from '../api/brainApi';

// Run cross-concept analysis
const analysis = await brainApi.analyzeCrossConcept({
  token,
  lookbackDays: 30,
  correlationThreshold: 0.6,
  enabledPatterns: ['temporal', 'performance', 'cross_concept'],
});
// Returns: { temporalPatterns, performancePatterns, crossConceptPatterns, summary }

// Get patterns for a specific concept
const patterns = await brainApi.getConceptPatterns('concept_123', token);
// Returns: { memoryCount, latestSummary, masteryAssessment, relatedPatterns, insights }

// Run profile inference
const profile = await brainApi.inferProfile({ token, lookbackDays: 30 });
// Returns: { inferences, summary, confidence }

// Get current learner profile
const { global, domains } = await brainApi.getLearnerProfile(token);

// Get personalized recommendations
const recommendations = await brainApi.getRecommendations({ token });
// Returns: { scheduling, content, strategy }

// Get concept relationship graph
const graph = await brainApi.getConceptRelationships(token, 50);
// Returns: { nodes, edges } for visualization
```

**Recommendation Types:**

| Type | Examples |
|------|----------|
| **Scheduling** | "Best study time: morning", "Aim for 25-minute sessions" |
| **Content** | "Study 'algebra' before 'calculus'", "Space out similar concepts" |
| **Strategy** | "Cramming detected - use spacing", "Improve consistency" |

**Integration with Consolidation:**

Cross-concept analysis and profile inference run automatically during consolidation:

```javascript
// In ConsolidationService.consolidateEpisodes():
// 1. Per-concept consolidation (existing)
// 2. Cross-concept analysis (new) - if ≥2 concept clusters
// 3. Profile inference (new) - updates learner profile
// 4. Generate recommendations
```

**Test Commands:**

```bash
# Run cross-concept tests
npm test -- --testPathPattern=CrossConceptAnalyzer.test.js
npm test -- --testPathPattern=LearnerProfileInference.test.js

# Run all brain tests
npm test -- --testPathPattern=brain
```

### Schedule Reconciliation Agent

LLM-driven schedule reconciliation that dynamically adjusts learning schedules based on the learner's personal forgetting curve, cross-concept patterns, and study behavior.

**Key Features:**
- Uses learner's measured forgetting curve instead of hardcoded decay formulas
- LLM-driven prioritization considering prerequisites and interference
- Personalized gap thresholds relative to optimal review interval
- Same-day session handling with duplicate filtering
- Catch-up plan generation for extended absences

**Key Files:**

| File | Purpose |
|------|---------|
| `src/main/brain/ScheduleReconciliationAgent.js` | Core LLM-driven reconciliation agent |
| `src/main/utils/LearningPlanGenerator.js` | `calculatePersonalizedInterval()` method |
| `src/main/db/LearningPlanManager.js` | `getDueItemsReconciled()` method |
| `src/main/ipc/brainHandlers.js` | Schedule reconciliation IPC handlers |
| `src/renderer/api/scheduleApi.js` | Renderer-side API |

**IPC Handlers:**

| Handler | Type | Purpose |
|---------|------|---------|
| `schedule-get-due-reconciled` | invoke | Get reconciled due items with LLM prioritization |
| `schedule-reconcile` | invoke | Full schedule reconciliation |
| `schedule-get-overdue-grouped` | invoke | Get items grouped by severity (critical/important/routine) |
| `schedule-generate-catch-up` | invoke | Generate multi-day catch-up plan |
| `schedule-clear-cache` | sync | Clear reconciliation cache |
| `schedule-reconciliation-available` | sync | Check if reconciliation available |

**Gap Severity Levels:**

Gap severity is calculated relative to the learner's personal optimal review interval:

| Severity | Threshold | Description |
|----------|-----------|-------------|
| `minor` | < 1x optimal interval | Within normal range |
| `moderate` | 1-2x optimal interval | Needs attention |
| `significant` | 2-3x optimal interval | Risk of forgetting |
| `critical` | > 3x optimal interval | Urgent review needed |

**Renderer API:**

```javascript
import scheduleApi, { GAP_SEVERITY, getGapSeverityInfo } from '../api/scheduleApi';

// Get reconciled due items
const result = await scheduleApi.getDueItemsReconciled({
  planId: 'plan_123',
  limit: 20,
  token
});
// Returns: { items, metadata: { gapType, userMessage, reconciled } }

// Full reconciliation
const reconciliation = await scheduleApi.reconcileSchedule({
  planId: 'plan_123',
  token,
  options: { forceReconcile: true }
});

// Get overdue grouped by severity
const grouped = await scheduleApi.getOverdueGrouped({ planId, token });
// Returns: { critical: [...], important: [...], routine: [...], total: number }

// Generate catch-up plan
const plan = await scheduleApi.generateCatchUpPlan({
  token,
  availableMinutesPerDay: 30,
  targetCatchUpDays: 7
});

// Helper functions
const severityInfo = getGapSeverityInfo(daysOverdue, optimalInterval);
// Returns: { severity, label, color }
```

**Episode Tracking:**

Reviews now track `daysOverdue` for better decay analysis:

```javascript
// In REVIEW_COMPLETED episode
{
  eventType: 'REVIEW_COMPLETED',
  payload: {
    conceptId: 'item_123',
    rating: 3,
    daysOverdue: 5,      // How late the review was
    wasOverdue: true,    // Boolean flag
    // ... other fields
  }
}
```

**Test Commands:**

```bash
# Run schedule reconciliation tests
npm test -- --testPathPattern=ScheduleReconciliationAgent

# Run all schedule-related tests
npm test -- --testPathPattern="schedule|brain"
```
