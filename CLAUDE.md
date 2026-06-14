# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SmartReader v2 is an AI-powered e-reader desktop application built on Electron React Boilerplate. It combines document reading (EPUB, PDF, Word), note-taking with spaced repetition (Leitner system), AI-assisted learning across multiple LLM providers, semantic search through ChromaDB, and a knowledge graph backed by an embedded Kùzu database (default) with optional Neo4j support.

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
npm test                  # Jest unit tests (mock DB + AI)
npm run test:integration  # Phase 4-8 service-level tests (Phase 8 uses real :memory: SQLite)
npm run test:smoke        # Boot Electron 12s + scan main-process logs for crash patterns
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

### Graph Database (Kùzu / Neo4j)

Two-tier storage: SQLite is primary (CRUD, categories, user data, settings) and the graph backend handles knowledge graph features (concept relationships, learning paths, semantic search, memory consolidation).

Two graph backends sit behind `src/main/utils/GraphInterface.js`:
- **Kùzu (default)**: embedded, MIT license, no external server required. Adapter: `KuzuAdapter.js`. Data lives under `<userData>/kuzu_graph/`.
- **Neo4j (optional)**: external server, swap in for environments that need it. Adapter: `Neo4jAdapter.js`. Requires connection URI + credentials.

The default is set in `GraphInterface.js` (`DEFAULT_ADAPTER_TYPE = 'kuzu'`). Code calling graph operations goes through the interface, not the adapter, so swapping is configuration-level.

See **[docs/technical/graph-database.md](docs/technical/graph-database.md)** for adapter details, IPC handlers, Memory Consolidation Graph (Episode/ConsolidatedMemory/Concept nodes), and configuration.

### State Management

- Redux Toolkit with Redux Persist (`src/renderer/store/`)
- `chatSlice.js` - Chat state management
- `customStorage.js` - Storage adapters

### Key Directories

```
src/
├── commons/           # Shared utilities, AI providers, data models
│   ├── model/         # DataTypes.js, LearningPointDomains.ts (Phase 3 domain taxonomy)
│   ├── service/       # AI provider implementations + Phase 0 capability registry
│   │   └── polyfills/ # structuredOutput.js, cache.js (Phase 0 cross-provider polyfills)
│   └── utils/         # AIPrompts.js, DomainDetector.js, learningPointExtras.js
├── main/              # Electron main process
│   ├── brain/         # LearningBrainAgent, HybridScheduler, EpisodeCollector,
│   │                  # MoodBoardOrganizerService + ProductionPromptService (Phase 8)
│   ├── db/            # SQLite managers
│   ├── ipc/           # IPC handlers (Phase 4-8 + earlier)
│   └── utils/         # ChromaManager, GraphInterface, KuzuAdapter (default), Neo4jAdapter,
│                      # RereadQueueService (Phase 8), BookDiagnosticService (Phase 5),
│                      # ComprehensionGradingService (Phase 6), MicroCardProposer (Phase 4),
│                      # LearningPathPlannerService (Phase 7), LearningPointEnrichmentService,
│                      # extractors/ (Phase 3 per-domain learning-point extractors)
├── __tests__/         # Jest tests
│   ├── brain/         # Brain/memory consolidation tests
│   ├── graph/         # Graph database tests
│   ├── integration/   # Phase 4-8 end-to-end tests (real :memory: SQLite for Phase 8)
│   └── learning/      # Learning point + session + handler tests
└── renderer/          # React UI
    ├── views/         # Page components
    │   ├── reading/   # EPubView, PreReadingPanel (Phase 5), MicroCardChip (Phase 4),
    │   │   │         # ComprehensionPanel (Phase 6)
    │   │   └── hooks/ # useReadingEpisodes (Phase 2), useMicroCardProposals (Phase 4),
    │   │              # useComprehensionCheck (Phase 6)
    │   └── study/components/cards/  # Per-domain cards (Phase 3): VocabCard, CodeCard,
    │                                # MathCard, KnowledgeCard, GenericCard, StudyCardRouter
    ├── components/
    │   ├── animation-core/  # Modular animation system for EPUB/PDF/Notes
    │   ├── graph/           # Knowledge graph UI
    │   ├── knowledge/       # ConceptReviewPanel, RereadQueuePanel + ProductionPromptPanel
    │   │                    # + CrossBookPathPanel (Phase 7/8)
    │   └── MoodBoard/       # Grid + diagram views
    ├── api/           # IPC clients (graphApi, brainApi, microCardApi, comprehensionApi,
    │                  #  bookDiagnosticApi, rereadQueueApi, moodBoardOrganizerApi,
    │                  #  productionPromptApi, learningPathPlannerApi, enrichmentApi)
    ├── store/         # Redux configuration
    ├── theme/         # Light/dark theme definitions
    └── utils/         # tutorContext.js (Phase 1 Brain → chat tutor system prompt)
```

## Key Dependencies & Version Constraints

- `chromadb@1.8.1` and `@google/generative-ai@0.1.3` must match for compatibility
- `better-sqlite3` is a native module - requires rebuild after Electron upgrades
- `ollama` package needs entry in both root and `release/app/package.json`

## External Runtime Requirements

- **ChromaDB**: Python service for vector search (optional)
- **Kùzu**: Embedded by default — no setup required, ships with the app
- **Neo4j**: Optional alternative graph backend (enables remote/shared graph databases)
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

## Brain-Driven Learning Loops (Phase 0–8)

A sequenced set of features layered onto the existing Brain. Each loop runs
(or is offered) during the heartbeat in `LearningBrainAgent.runHeartbeat`.
There is no dedicated technical doc per loop yet — code is the source of truth.

| Loop | Trigger | Service | Renderer surface |
|------|---------|---------|------------------|
| Phase 0 — LLM portability | n/a (infra) | `commons/service/polyfills/structuredOutput.js`, `cache.js`; capability registry on `AIProviderInterface` | none |
| Phase 1 — Tutor context | Chat open | `renderer/utils/tutorContext.js` builds Brain-aware system prompt | `InContextChatPanel` opt-in tutor mode |
| Phase 2 — Reading episode collector | Reader page-visibility events | `useReadingEpisodes` hook emits CHAPTER_ENTERED / BACKTRACK / PARAGRAPH_DWELL / PARAGRAPH_REREAD via `brainApi.recordEpisode` | invisible |
| Phase 3 — Domain-aware learning points | Card render + extraction | `extractors/` (per-domain) + `LearningPointDomains.ts` + `StudyCardRouter` | per-domain cards (`VocabCard`, `CodeCard`, `MathCard`, `KnowledgeCard`) |
| Phase 4 — Micro-card proposal | Paragraph in reading | `MicroCardProposer` (length/density/dedup/rate/AI gates) | `MicroCardChip` + `useMicroCardProposals` |
| Phase 5 — Pre-book diagnostic | First open of a book | `BookDiagnosticService` (TOC + AI + post-call known-concept annotate) | `PreReadingPanel` |
| Phase 6 — Comprehension grading | End of chapter | `ComprehensionGradingService.generateQuestion → gradeAnswer` | `ComprehensionPanel` + `useComprehensionCheck` |
| Phase 7 — Cross-book path planner | User asks for a path | `LearningPathPlannerService.plan(goal, books)` over books' Phase 5 diagnostic data | `CrossBookPathPanel` in Knowledge Dashboard |
| Phase 8a — Spaced re-reading | Low comprehension score | `RereadQueueService` (electron-store backed) | `RereadQueuePanel` in Knowledge Dashboard |
| Phase 8b — Organize loop | Cluster of ≥5 same-domain learning points in same book | `MoodBoardOrganizerService` (SQL cluster detection + dedup + Slice 3 `createBoardFromCluster`) | organize banner in `MoodBoardView` |
| Phase 8c — Production loop | High-mastery learning point | `ProductionPromptService.schedulePrompt` (mastery ≥ 60, ≥3 reviews, substantive back) | `ProductionPromptPanel` |

Cross-loop plumbing:
- Episode types defined in `EpisodeCollector.EVENT_TYPES` (mirrored on the renderer as `EPISODE_TYPES` in `renderer/api/brainApi.js`)
- All brain-driven notifications go through `persistBrainNotifications` in `LearningBrainAgent` with per-day per-type dedup
- SRS write-back from production grading lives in `LearningPointManager.applyProductionGrade`
- Streak chain: `completeLearningSession` → `updateStreakAfterSession` → `LearnerProfileManager.updateGlobalProfile`

Integration tests under `src/__tests__/integration/` exercise the Phase 4–8 loops end-to-end. Phase 8 uses real `:memory:` SQLite; run via `npm run test:integration` (rebuilds `better-sqlite3` for Node, runs, restores for Electron).

For boot-time crash detection, `npm run test:smoke` launches Electron against `src/main/main.ts` via `ts-node` (matching `npm start:main`), waits 12 s for the brain heartbeat to fire once, and scans stdout+stderr for known bug patterns (defined in `.erb/scripts/test-smoke.js` — extend the `ERROR_PATTERNS` list as new bug classes are found). This is NOT UI testing — Playwright is incompatible with Electron 26's flag handling, so true e2e UI tests are blocked until an Electron bump.

## Subsystem Documentation

Detailed reference docs live in [docs/technical/](docs/technical/). Open the relevant file before working on that subsystem.

| Subsystem | Doc | Scope |
|-----------|-----|-------|
| Views & Feature Modules | [views.md](docs/technical/views.md) | Reading, Bookshelf, Notes, Chat, Browser, Vocabulary, Translate, Writing, Grammar, Quiz, MoodBoard, Settings; common UI patterns; AI integration points |
| Graph Database (Kùzu / Neo4j) | [graph-database.md](docs/technical/graph-database.md) | `GraphInterface` abstraction, KuzuAdapter (default) + Neo4jAdapter (optional), IPC, configuration, Memory Consolidation Graph (`SummarizationGraphService`) |
| StudyEnhancer System | [study-enhancer.md](docs/technical/study-enhancer.md) | Browser word-animation system, Smart Summary, paragraph action icons |
| Animation Core | [animation-core.md](docs/technical/animation-core.md) | Modular animations for EPUB/PDF/Notes (`useEPUBAnimations`, `usePDFAnimations`, `useNoteAnimations`) |
| Rich Markdown Editor | [rich-markdown-editor.md](docs/technical/rich-markdown-editor.md) | TipTap-based editor, `[[wiki-link]]` Knowledge Web, backlinks |
| AI Concept Extraction | [concept-extraction.md](docs/technical/concept-extraction.md) | `AIConceptExtractionService`, `ConceptReviewPanel` |
| Skill System | [skill-system.md](docs/technical/skill-system.md) | Agent Skills standard, code- and file-based skills, IPC handlers, view integration |
| Knowledge Dashboard | [knowledge-dashboard.md](docs/technical/knowledge-dashboard.md) | `/knowledge` route, `MemoryTimelinePanel`, dashboard tabs |
| Learning Plan System | [learning-plan.md](docs/technical/learning-plan.md) | 5-step wizard, Universal Learning Points, Leitner/FSRS |
| Study Session System | [study-session.md](docs/technical/study-session.md) | Session modes, ratings, enhanced features (AI hints, sounds, TTS), analytics |
| AI Learning Brain | [ai-learning-brain.md](docs/technical/ai-learning-brain.md) | Background service, heartbeat, episodic memory, consolidation, cross-concept analysis, schedule reconciliation |

Cross-cutting design docs (longer-form, written separately from the per-subsystem files above):
- [LLM-Driven Learning Management System](docs/technical/LLM-DRIVEN-LEARNING-MANAGEMENT-SYSTEM.md)
- [AI Learning Brain Architecture](docs/technical/AI-Learning-Brain-Architecture.md)
- [Agentic AI Implementation Analysis](docs/technical/Agentic-AI-Implementation-Analysis.md)
