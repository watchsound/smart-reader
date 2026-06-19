# SmartReader Architecture Overview

Technical architecture documentation for SmartReader v2.

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Process Architecture](#process-architecture)
4. [Database Layer](#database-layer)
5. [AI Integration](#ai-integration)
6. [Learning System](#learning-system)
7. [Knowledge Graph](#knowledge-graph)
8. [Key Components](#key-components)

## System Overview

SmartReader v2 is an Electron-based desktop application built on a hybrid architecture:

- **Primary Storage**: SQLite (all CRUD operations, user data)
- **Graph Layer**: Neo4j (knowledge graph, relationships, learning paths)
- **Vector Search**: ChromaDB (optional, semantic search)
- **AI Layer**: Multi-provider strategy (OpenAI, Claude, Gemini, Ollama)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ IPC Layer  │  │   Database   │  │   AI Services     │   │
│  │ Handlers   │←→│   Managers   │←→│   Providers       │   │
│  └────────────┘  └──────────────┘  └───────────────────┘   │
│         ↑              ↓                      ↓              │
│         │        ┌──────────┐          ┌──────────┐         │
│         │        │  SQLite  │          │   LLM    │         │
│         │        │ Database │          │   APIs   │         │
│         │        └──────────┘          └──────────┘         │
│         │              ↓                                     │
│         │        ┌──────────┐                               │
│         │        │  Neo4j   │                               │
│         │        │  Graph   │                               │
│         │        └──────────┘                               │
└─────────┼──────────────────────────────────────────────────┘
          │
          ↓ IPC Bridge (preload.ts)
┌─────────────────────────────────────────────────────────────┐
│                  Electron Renderer Process                   │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │   React    │  │    Redux     │  │   Components      │   │
│  │   Router   │←→│    Store     │←→│   (Views/UI)      │   │
│  └────────────┘  └──────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Core Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Electron | 25+ | Desktop app framework |
| UI Framework | React | 18+ | Component-based UI |
| State Management | Redux Toolkit | Latest | Global state |
| Build System | Webpack | 5+ | Bundling & dev server |
| Language | JavaScript/TypeScript | ES2020+ | Mixed JS/TS codebase |

### Database Layer

| Database | Purpose | Required |
|----------|---------|----------|
| SQLite (better-sqlite3) | Primary data store | ✅ Yes |
| Neo4j | Knowledge graph | ❌ Optional |
| ChromaDB | Vector search | ❌ Optional |

### AI Providers

| Provider | Type | API |
|----------|------|-----|
| OpenAI | Cloud | REST API |
| Anthropic (Claude) | Cloud | REST API |
| Google (Gemini) | Cloud | REST API |
| Ollama | Local | HTTP API |
| Qwen | Cloud | REST API |
| Doubao | Cloud | REST API |

### Key Libraries

```json
{
  "react-reader": "EPUB rendering",
  "react-pdf-highlighter": "PDF rendering with annotations",
  "better-sqlite3": "Native SQLite bindings",
  "neo4j-driver": "Neo4j graph database",
  "kuzu": "Embedded graph + vector database (default)",
  "@projectstorm/react-diagrams": "MoodBoard diagrams",
  "@tiptap/react": "Rich text editor",
  "survey-react-ui": "Quiz rendering"
}
```

## Process Architecture

### Electron Main Process

**Location**: `src/main/`

**Responsibilities**:
- Window management
- IPC event handling (~100+ handlers)
- Database operations (SQLite, Neo4j)
- File system operations
- External API calls (AI providers)
- Background services (Learning Brain)

**Key Files**:
- `main.ts` - Main process entry (~2400 lines)
- `preload.ts` - IPC bridge (context isolation)
- `ipc/*.js` - Organized IPC handlers

### Electron Renderer Process

**Location**: `src/renderer/`

**Responsibilities**:
- UI rendering (React components)
- User interactions
- State management (Redux)
- Client-side routing
- API calls to main process via IPC

**Key Directories**:
- `views/` - Page-level components
- `components/` - Reusable UI components
- `store/` - Redux slices
- `api/` - IPC wrapper functions

### IPC Communication

**Pattern**: Renderer → IPC → Main → Database/External Services

**Example Flow**:
```javascript
// Renderer (src/renderer/api/chatApi.js)
export const sendMessage = (message, token) => {
  return window.electron.ipcRenderer.invoke('chat-send-message', { message, token });
};

// Main (src/main/ipc/chatHandlers.js)
ipcMain.handle('chat-send-message', async (event, { message, token }) => {
  const aiProvider = AIProviderManager.getInstance();
  const response = await aiProvider.generateContent(message);
  await MessageManager.saveMessage(response, token);
  return response;
});
```

## Database Layer

### SQLite (Primary Storage)

**File**: `sqlite_tables.db`

**Schema**: Defined in `db.sql`

**Manager Pattern**:
```
src/main/db/
├── DBManager.js               # Core connection
├── DatabaseInitializer.js     # Schema setup
├── BookManager.js             # Books CRUD
├── BookmarkManager.js         # Bookmarks CRUD
├── ChatManager.js             # Chats CRUD
├── MessageManager.js          # Messages CRUD
├── NoteJsonManager.js         # Notes CRUD
├── VocabularyManager.js       # Vocabulary CRUD
├── LearningPlanManager.js     # Learning plans
├── LearningPointManager.js    # Learning items
├── SessionAnalyticsManager.js # Study analytics
└── ConsolidatedMemoryManager.js # Memory consolidation
```

**Key Tables**:
- `books`, `bookmarks`, `notes`, `vocabulary`
- `learning_plans`, `learning_points`, `learning_sessions`
- `chats`, `messages`, `prompts`
- `session_analytics`, `consolidated_memory`

### Neo4j (Knowledge Graph)

**Purpose**: Relationships, learning paths, concept mastery

**Architecture**: Hybrid (SQLite primary, Neo4j secondary)

**Adapters**:
```
src/main/utils/
├── GraphInterface.js          # Abstraction layer
├── Neo4jAdapter.js            # Neo4j implementation
├── GraphEmbeddingManager.js   # Semantic search
├── GraphLearningFeatures.js   # Learning paths
└── SummarizationGraphService.js # Memory consolidation graph
```

**Node Types**:
- `Concept` - Learning concepts
- `Note` - User notes
- `Vocabulary` - Vocabulary words
- `Book` - Books
- `Episode` - Learning events
- `ConsolidatedMemory` - Memory summaries
- `LearnerProfile` - User profile

**Relationship Types**:
- `:RELATES_TO` - Concept relationships
- `:PREREQUISITE` - Learning dependencies
- `:CONSOLIDATED_INTO` - Episode → Memory
- `:SUMMARIZES` - Memory → Concept

See: [Memory Consolidation Graph](#memory-consolidation-graph)

## AI Integration

### Provider Strategy Pattern

**Location**: `src/commons/service/`

```
AIProviderInterface.js (Abstract)
       ↑
       ├── ChatGPTProvider.js
       ├── ClaudeProvider.js
       ├── GeminiProvider.js
       ├── OllamaProvider.js
       ├── QwenProvider.js
       └── DoubaoProvider.js
```

**AIProviderManager** (Singleton):
- Selects provider at runtime
- Manages API keys
- Handles rate limiting
- Provides unified interface

**Key Methods**:
```javascript
class AIProviderInterface {
  generateContent(prompt, options)
  generateContentWithJson(prompt, schema)
  generateEmbedding(text)
  streamContent(prompt, onChunk)
}
```

### Tool Use / Function Calling

Some providers (Claude, OpenAI) support tool use for structured outputs:

```javascript
const tools = skillRegistry.getToolDefinitions(context);
const response = await provider.generateContentWithTools(prompt, tools);
// Response includes tool calls that skill executor handles
```

## Learning System

### Spaced Repetition

**Algorithm**: Leitner System (5 boxes) or FSRS (adaptive)

**Box Intervals**:
- Box 1: 1 day
- Box 2: 2 days
- Box 3: 4 days
- Box 4: 7 days
- Box 5: 14 days

**Schedule Reconciliation**:
- LLM-driven prioritization
- Personal forgetting curve modeling
- Cross-concept pattern detection
- Personalized gap thresholds

See: [Schedule Reconciliation](LLM-DRIVEN-LEARNING-MANAGEMENT-SYSTEM.md#schedule-reconciliation)

### Learning Plans

**Wizard Flow**: 5 steps (Goal → Material → Import → Commitment → Review)

**Import Sources**:
- CSV/JSON/TXT/Excel files
- Quizlet URLs
- Library books
- Existing vocabulary sets
- Manual entry

**Components**:
```
src/main/utils/
├── LearningPlanGenerator.js    # Schedule calculation
├── LearningPointImporter.js    # File parsing
└── VectorManager.js            # Unified vector storage

src/main/db/
├── LearningPlanManager.js      # Plan CRUD
├── LearningPointManager.js     # Item CRUD
└── LearningSessionManager.js   # Session tracking
```

### Study Sessions

**Modes**: Standard, Quick, Focused, Cram, Custom

**Rating System**: 4-point (Again, Hard, Good, Easy)

**Features**:
- Progressive hints (AI-powered, cached)
- Sound effects (configurable)
- TTS pronunciation
- Real-time analytics
- Streak tracking

## Knowledge Graph

### Graph Features

**Neo4j-Exclusive**:
1. Learning Paths - Prerequisite chains
2. Weak Concepts Detection - Low mastery identification
3. Entity Resolution - Automatic concept linking
4. Knowledge Graph Visualization - Interactive force-directed graph
5. Mastery Tracking - Progress over time
6. Semantic Search - Embedding-based similarity
7. Memory Consolidation Graph - Episode → Memory → Concept hierarchy

**Components**:
```
src/main/utils/
├── GraphInterface.js              # Abstraction
├── Neo4jAdapter.js                # Main implementation
├── GraphEmbeddingManager.js       # Vector embeddings
├── GraphLearningFeatures.js       # Learning paths, weak concepts
├── SummarizationGraphService.js   # Memory consolidation
├── CrossConceptAnalyzer.js        # Pattern detection
└── LearnerProfileInference.js     # Profile inference

src/renderer/components/graph/
├── KnowledgeGraphPanel.js         # Interactive visualization
├── LearningPathPanel.js           # Prerequisite display
├── WeakConceptsPanel.js           # Weak areas
└── MemoryTimelinePanel.js         # Consolidated memories timeline
```

### Memory Consolidation Graph

**Architecture**: Three-tier memory system inspired by [Graphiti](https://github.com/getzep/graphiti)

```
Tier 1: Episodic Memory (raw events)
├── REVIEW_COMPLETED, SESSION_ENDED, BOOK_OPENED, etc.
├── Bi-temporal timestamps (t_valid, t_created)
└── Buffered → Neo4j

        ↓ (LLM-powered consolidation)

Tier 2: Consolidated Memory (synthesized)
├── LLM-generated summaries
├── Concept-level insights
├── Learning process analysis
└── Stored in SQLite + Neo4j graph

        ↓ (relationships)

Tier 3: Concepts & Profile
├── Concept nodes with mastery levels
├── LearnerProfile with learning style
└── Recommendations
```

**Relationship Types**:
- `Episode :CONSOLIDATED_INTO ConsolidatedMemory` (weight, contributionType)
- `ConsolidatedMemory :SUMMARIZES Concept` (masteryContribution, aspectsCovered)
- `ConsolidatedMemory :MEMORY_RELATES ConsolidatedMemory` (relationType, strength)

**Contribution Types**:
- `primary` - Direct learning (reviews, quizzes)
- `supporting` - Context (book opens, notes)
- `contextual` - Background (sessions)

**Mastery Contribution**:
- `high` - Strong positive impact
- `medium` - Moderate impact
- `low` - Minimal impact
- `negative` - Setbacks

See: [Memory Consolidation Documentation](LLM-DRIVEN-LEARNING-MANAGEMENT-SYSTEM.md#memory-consolidation)

## Key Components

### Skill System

**Location**: `src/main/skills/`

**Architecture**: Plugin-based skill registry following [Agent Skills Standard](https://agentskills.io)

**Skill Types**:
- **Code-based**: JavaScript classes extending `BaseSkill`
- **File-based**: SKILL.md files (drop-in plugins)

**Categories**:
- `ai/` - AI-powered skills (summarize, grammar, quiz, translate, etc.)
- `data/` - Data operations (search, create, update)

**Key Classes**:
```
skills/
├── BaseSkill.js           # Abstract base
├── SkillRegistry.js       # Registration
├── SkillExecutor.js       # Execution engine
├── ContextManager.js      # Session/context
├── SkillMDParser.js       # SKILL.md parser
└── FileBasedSkill.js      # File-based wrapper
```

**Skill Locations** (searched in order):
1. `resources/skills/` - Built-in
2. `.smartreader/skills/` - Project-level
3. `<userData>/skills/` - App data
4. `~/.smartreader/skills/` - User home

### Rich Markdown Editor

**Location**: `src/renderer/components/editor/`

**Technology**: TipTap (ProseMirror-based)

**Features**:
- Full formatting (bold, italic, headers, lists, tables)
- LaTeX math: `$inline$` and `$$block$$`
- Wiki-links: `[[word]]` for knowledge web
- Code blocks with syntax highlighting
- Link previews on hover
- Backlinks panel

**Extensions**:
```
editor/
├── RichMarkdownEditor.tsx     # Main editor
├── EditorToolbar.tsx          # Formatting toolbar
├── extensions/
│   ├── MathJaxExtension.tsx   # LaTeX support
│   └── WikiLinkExtension.tsx  # [[link]] syntax
└── popovers/
    ├── LinkPreviewPopover.tsx # Hover previews
    └── LinkSuggestionMenu.tsx # Autocomplete
```

### Animation Core System

**Location**: `src/renderer/components/animation-core/`

**Purpose**: Modular animation system for learning enhancement

**Components**:
```
animation-core/
├── AnimationCore.js          # Main controller
├── WordWrapper.js            # DOM word wrapping
├── AnimationEngine.js        # Animation primitives
├── CloneManager.js           # Floating clones
├── PositionManager.js        # Layout calculations
├── EffectRegistry.js         # Plugin system
├── effects/                  # Built-in effects
│   ├── HighlightEffect.js
│   ├── FadeInEffect.js
│   ├── GlowEffect.js
│   ├── FlyingWordEffect.js
│   └── LeitnerTransitionEffect.js
└── adapters/                 # View adapters
    ├── EPUBAdapter.js        # For epub.js
    ├── PDFAdapter.js         # For PDF.js
    └── NoteAdapter.js        # For Notes/Leitner
```

**Signature Feature**: Word Constellation (Smart Summary)
- Words fly from source text to summary panel
- Bezier curve animations
- Vocabulary words glow gold
- Creates engaging visual learning experience

### AI Learning Brain

**Location**: `src/main/brain/`

**Architecture**: Autonomous background agent (can run as OS service)

**Components**:
```
brain/
├── LearningBrainAgent.js           # Main orchestrator
├── EpisodeCollector.js             # Event collection
├── HybridScheduler.js              # Fallback scheduler
├── ScheduleReconciliationAgent.js  # LLM-driven scheduling
└── ServiceClient.js                # IPC to background service

service/ (optional background service)
├── HeartbeatScheduler.js           # Timing/wake-up
├── ServiceState.js                 # Persistent state
├── IPCServer.js                    # Named pipe server
└── NotificationBridge.js           # System notifications
```

**Heartbeat System**:
- Periodic analysis (default: 24 hours)
- Collects episodes (reviews, sessions, reading)
- LLM-powered consolidation
- Generates insights and recommendations
- System notifications

**Episode Types**:
- `REVIEW_COMPLETED` - Flashcard reviews
- `SESSION_STARTED/ENDED` - Study sessions
- `BOOK_OPENED` - Reading activity
- `NOTE_CREATED` - Note taking
- `MASTERY_CHANGED` - Progress updates

**Consolidation Flow**:
```
Episodes (raw events)
    ↓ Group by concept clusters
    ↓ Detect context shifts
    ↓ LLM synthesis
    ↓
ConsolidatedMemory (insights)
    ↓ Link to concepts
    ↓ Update mastery
    ↓
Recommendations (personalized)
```

See: [AI Learning Brain Architecture](AI-Learning-Brain-Architecture.md)

### Cross-Concept Analysis

**Location**: `src/main/utils/CrossConceptAnalyzer.js`

**Purpose**: Discover hidden relationships between concepts

**Pattern Types**:
- **Prerequisite** - A must be learned before B
- **Interference** - Negative correlation (study A and B together = confusion)
- **Positive Transfer** - Correlated learning velocities
- **Concept Clustering** - Frequently studied together
- **Forgetting Correlation** - Decay together over time

**Learner Profile Inference**:
```javascript
// src/main/utils/LearnerProfileInference.js
{
  learningStyle: 'visual' | 'textual' | 'mixed',
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening',
  optimalSessionLength: number, // minutes
  consistencyScore: 0-100,
  forgettingCurveSlope: number,
  pacePreference: 'burst' | 'steady' | 'marathon'
}
```

## Testing

**Test Structure**:
```
src/__tests__/
├── graph/             # Graph database tests (240 tests)
├── brain/             # Brain/memory tests (76+ tests)
├── skills/            # Skill system tests (500+ tests)
├── ipc/               # IPC handler tests
├── learning/          # Learning system tests
└── renderer/          # Component tests
```

**Test Commands**:
```bash
# Run all tests
npm test

# Run specific suites
npm test -- --testPathPattern=graph
npm test -- --testPathPattern=brain
npm test -- --testPathPattern=skills

# Watch mode
npm test -- --watch
```

## Build & Deployment

### Development Build

```bash
# Start dev server (hot reload)
npm run start:renderer  # Terminal 1
npm run start:main      # Terminal 2

# Or use single command
npm start
```

### Production Build

```bash
# Build both main and renderer
npm run build

# Package for distribution
npm run package
```

**Output**:
- Windows: `release/build/SmartReader-Setup-x.x.x.exe`
- macOS: `release/build/SmartReader-x.x.x.dmg`
- Linux: `release/build/SmartReader-x.x.x.AppImage`

### Build Configuration

**Webpack**:
- `.erb/configs/webpack.config.*.ts`
- DLL bundles for faster rebuilds
- Native module handling (better-sqlite3)

**Electron Builder**:
- `package.json` > `build` section
- Platform-specific configurations
- Code signing (optional)

## Security Considerations

**Context Isolation**: Disabled for file:// protocol support

**IPC Security**: Preload script provides controlled API exposure

**API Keys**: Stored in electron-store (encrypted on disk)

**Content Security**: Sandboxed webviews for browser feature

## Performance Optimizations

1. **SQLite**: Synchronous API (better-sqlite3) for main process
2. **Redux**: Normalized state, selective persistence
3. **Neo4j**: Connection pooling, query optimization
4. **Rendering**: Virtual scrolling for long lists
5. **Webpack**: DLL bundles, code splitting
6. **AI**: Response caching (AICacheManager)

## Scalability Considerations

**Current Limits**:
- Books: Tested with 500+ books
- Notes: Tested with 10,000+ notes
- Vocabulary: Tested with 5,000+ words
- Graph: Tested with 50,000+ nodes

**Bottlenecks**:
- Large PDFs (>100MB) - memory intensive
- Neo4j queries - scale with graph size
- AI requests - rate limited by providers

**Future Optimizations**:
- Lazy loading for large libraries
- Graph query optimization
- Background processing for heavy operations
- Pagination for large result sets

## References

- [AI Learning Brain Architecture](AI-Learning-Brain-Architecture.md)
- [Agentic AI Implementation](Agentic-AI-Implementation-Analysis.md)
- [LLM-Driven Learning System](LLM-DRIVEN-LEARNING-MANAGEMENT-SYSTEM.md)
- [Development Guide](../../CLAUDE.md)

---

*SmartReader Architecture v2.0 | Last updated: 2026-03-17*

*For questions or contributions, see [Contributing Guide](../../CONTRIBUTING.md)*
