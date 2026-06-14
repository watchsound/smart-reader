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

Neo4j provides knowledge graph features over a SQLite-primary architecture. Quick summary:
- SQLite (primary): CRUD, categories, user data, settings
- Neo4j (secondary): Knowledge graph, learning paths, semantic search, memory consolidation

See **[docs/technical/graph-database.md](docs/technical/graph-database.md)** for adapters, IPC handlers, Memory Consolidation Graph (Episode/ConsolidatedMemory/Concept nodes), and configuration.

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

## Subsystem Documentation

Detailed reference docs live in [docs/technical/](docs/technical/). Open the relevant file before working on that subsystem.

| Subsystem | Doc | Scope |
|-----------|-----|-------|
| Views & Feature Modules | [views.md](docs/technical/views.md) | Reading, Bookshelf, Notes, Chat, Browser, Vocabulary, Translate, Writing, Grammar, Quiz, MoodBoard, Settings; common UI patterns; AI integration points |
| Graph Database (Neo4j) | [graph-database.md](docs/technical/graph-database.md) | Neo4j adapters, IPC, configuration, Memory Consolidation Graph (`SummarizationGraphService`) |
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
