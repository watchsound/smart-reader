# SmartReader

An AI-powered e-reader desktop application that combines document reading, intelligent note-taking, spaced repetition learning, and knowledge graph visualization.

## Features

- **Multi-format Reader**: Read EPUB, PDF, and Word documents with annotations and highlights
- **AI-Powered Learning**: Integrated AI chat with multiple providers (ChatGPT, Claude, Gemini, Ollama, DeepSeek, Kimi, Qwen, Baidu, Doubao) with a capability registry + polyfills so each feature degrades gracefully on weaker providers
- **Spaced Repetition**: Leitner 5-box system for vocabulary and concept retention
- **Domain-Aware Learning Points**: Concepts carry a domain (vocabulary, programming, math, formal-concept, knowledge) with per-domain extractors and study cards
- **Knowledge Graph**: Visualize connections between concepts using embedded Kuzu database
- **Learning Plans**: Create structured curricula with AI-generated study schedules
- **Smart Summary**: Word constellation animations for visual learning
- **Built-in Browser**: Research and save web content with smart bookmarks
- **Quiz System**: Auto-generate quizzes from your reading materials
- **Tutor Mode**: AI chat that knows your reading history, weak concepts, and last quiz performance
- **Pre-Book Diagnostic**: New books get a short prerequisite quiz + a primer covering gaps
- **In-Reading Micro-Cards**: 1-tap creates a domain-correct learning card from the paragraph you just read
- **End-of-Chapter Comprehension Check**: Open-ended questions graded distinctly from SRS recall, feeding the re-reading queue
- **Cross-Book Learning Path**: Ask for a topic and the AI walks your library to suggest an ordered chapter sequence
- **Brain Loops**: Spaced re-reading, MoodBoard organize suggestions (with auto-populated boards), and "explain it in your own words" production prompts — all surfaced via the Knowledge Dashboard

## Installation

### Download Release

Download the latest release for your platform:

| Platform | File | Description |
|----------|------|-------------|
| Windows | `SmartReader Setup x.x.x.exe` | NSIS installer |
| macOS (Intel) | `SmartReader-x.x.x.dmg` | Disk image |
| macOS (Apple Silicon) | `SmartReader-x.x.x-arm64.dmg` | Disk image |
| Linux | `SmartReader-x.x.x.AppImage` | Portable AppImage |

### System Requirements

- **Windows**: Windows 10 or later
- **macOS**: macOS 10.14 (Mojave) or later
- **Linux**: Ubuntu 18.04 or equivalent
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB for application

## Development

### Prerequisites

- Node.js v14 or higher
- npm v7 or higher
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/smart-reader-v2.git
cd smart-reader-v2

# Install dependencies
npm install
```

### Development Mode

Run the app in development mode with hot reload:

```bash
# Terminal 1: Start renderer (webpack dev server)
npm run start:renderer

# Terminal 2: Start main process (Electron)
npm run start:main
```

Or use the single command (checks port first):

```bash
npm start
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development mode |
| `npm run start:renderer` | Start webpack dev server only |
| `npm run start:main` | Start Electron main process only |
| `npm run build` | Build both main and renderer for production |
| `npm run build:main` | Build main process only |
| `npm run build:renderer` | Build renderer process only |
| `npm run build:dll` | Rebuild DLL bundles |
| `npm run package` | Package for current platform |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |
| `npm run test:integration` | Run integration tests (rebuilds `better-sqlite3` for Node, runs the `src/__tests__/integration/` suite, restores Electron's binary in a `finally` so `npm start` keeps working) |
| `npm run rebuild` | Rebuild native modules |

## Building for Production

### Build Application

```bash
# Build both main and renderer processes
npm run build
```

### Package for Distribution

#### Windows (.exe installer)

```bash
# Using npm script
npm run package

# Or using electron-builder directly
npx electron-builder build --win --publish never
```

**Output files** (in `release/build/`):

| File | Size | Description |
|------|------|-------------|
| `SmartReader Setup x.x.x.exe` | ~245 MB | Windows NSIS installer |
| `SmartReader Setup x.x.x.exe.blockmap` | ~255 KB | Delta update blockmap |
| `latest.yml` | ~350 B | Auto-update metadata |
| `win-unpacked/` | - | Portable version |

#### macOS (.dmg)

```bash
npx electron-builder build --mac --publish never
```

**Output**: `SmartReader-x.x.x.dmg` and `SmartReader-x.x.x-arm64.dmg`

#### Linux (.AppImage)

```bash
npx electron-builder build --linux --publish never
```

**Output**: `SmartReader-x.x.x.AppImage`

#### All Platforms

```bash
npx electron-builder build --win --mac --linux --publish never
```

### Build Output Structure

```
release/
├── app/                    # Packaged app source
│   ├── dist/              # Compiled JS bundles
│   ├── node_modules/      # Production dependencies
│   └── package.json
└── build/                  # Distribution files
    ├── SmartReader Setup 1.0.2.exe
    ├── SmartReader Setup 1.0.2.exe.blockmap
    ├── latest.yml
    ├── builder-debug.yml
    ├── builder-effective-config.yaml
    └── win-unpacked/       # Portable Windows version
```

### Distribution Options

1. **Installer (.exe)**: Share `SmartReader Setup x.x.x.exe`
   - Users double-click to install
   - Creates Start Menu shortcuts
   - Supports auto-updates

2. **Portable**: Share the `win-unpacked/` folder
   - Users run `SmartReader.exe` directly
   - No installation required
   - Good for USB drives

### Build Configuration

Build settings are in `package.json` under the `"build"` key:

```json
{
  "build": {
    "productName": "SmartReader",
    "appId": "org.erb.SmartReader",
    "win": {
      "target": ["nsis"]
    },
    "mac": {
      "target": {
        "target": "default",
        "arch": ["arm64", "x64"]
      }
    },
    "linux": {
      "target": ["AppImage"]
    },
    "directories": {
      "output": "release/build"
    }
  }
}
```

## Project Structure

```
smart-reader-v2/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Main entry point
│   │   ├── preload.ts     # Preload script
│   │   ├── db/            # SQLite database managers
│   │   ├── ipc/           # IPC handlers (incl. Phase 4-8 brain loops)
│   │   ├── utils/         # Brain services + utilities
│   │   │   ├── BookDiagnosticService.js          # Phase 5
│   │   │   ├── ComprehensionGradingService.js    # Phase 6
│   │   │   ├── LearningPathPlannerService.js     # Phase 7
│   │   │   ├── MicroCardProposer.js              # Phase 4
│   │   │   ├── RereadQueueService.js             # Phase 8a
│   │   │   └── extractors/                       # Phase 3 per-domain
│   │   ├── brain/         # AI Learning Brain
│   │   │   ├── LearningBrainAgent.js  +  HybridScheduler.js  +  EpisodeCollector.js
│   │   │   ├── MoodBoardOrganizerService.js      # Phase 8b
│   │   │   └── ProductionPromptService.js        # Phase 8c
│   │   └── skills/        # Skill system
│   ├── renderer/          # React frontend
│   │   ├── views/         # Page components
│   │   │   ├── reading/   # + PreReadingPanel, MicroCardChip, ComprehensionPanel + hooks/
│   │   │   └── study/components/cards/  # Per-domain study cards
│   │   ├── components/
│   │   │   └── knowledge/ # RereadQueuePanel, ProductionPromptPanel, CrossBookPathPanel
│   │   ├── api/           # IPC client APIs (brain, microCard, comprehension, etc.)
│   │   ├── store/         # Redux store
│   │   ├── theme/         # MUI themes
│   │   └── utils/         # tutorContext.js (Phase 1 Brain → chat system prompt)
│   ├── commons/           # Shared code
│   │   ├── model/         # Data types, LearningPointDomains.ts
│   │   ├── service/       # AI providers + polyfills/ (Phase 0 capability layer)
│   │   └── utils/         # AIPrompts.js, DomainDetector.js, learningPointExtras.js
│   └── __tests__/
│       └── integration/   # End-to-end tests for Phase 4-8 loops
├── release/
│   ├── app/               # Production app
│   └── build/             # Distribution files
├── assets/                # Icons, images
├── docs/                  # Documentation
├── .erb/                  # Webpack configs (+ scripts/test-integration.js)
├── db.sql                 # SQLite schema
└── package.json
```

## Configuration

### AI Providers

Configure AI providers in Settings > AI Providers:

| Provider | Setup |
|----------|-------|
| OpenAI | Add API key from platform.openai.com |
| Claude | Add API key from console.anthropic.com |
| Gemini | Add API key from makersuite.google.com |
| Ollama | Install Ollama locally (no API key needed) |

### Graph Database

SmartReader uses **Kuzu** as the default embedded graph database:

- No external server required
- Data stored in `<userData>/kuzu_graph/`
- Automatic schema creation on first run

Optional: Configure **Neo4j** for advanced features:
1. Install Neo4j Desktop or run via Docker
2. Go to Settings > Graph Database
3. Enter connection URI and credentials

## Documentation

### For Users

- **[Quick Start Guide](docs/user/QUICK_START.md)** - Get started in 5 minutes ⭐
- [User Manual](docs/user/user_manual.md) - Complete user guide
- [Documentation Index](docs/README.md) - Full documentation navigation

### For Developers

- **[CLAUDE.md](CLAUDE.md)** - Complete developer reference and codebase guide ⭐
- [Architecture Overview](docs/technical/ARCHITECTURE.md) - System architecture
- [AI Learning Brain](docs/technical/AI-Learning-Brain-Architecture.md) - Brain system design
- [Contributing Guide](docs/community/CODE_OF_CONDUCT.md) - How to contribute

### Additional Documentation

- [Development Notes](docs/development/development-note.md) - Development history and notes
- [Testing Reports](docs/testing/) - Test coverage and bug fix reports
- [Changelog](docs/community/CHANGELOG.md) - Release history
- [Archive](docs/archive/) - Historical design documents

## Testing

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- --testPathPattern=KuzuAdapter

# Run with coverage
npm test -- --coverage

# Run integration tests (Phase 4-8 loops, end-to-end)
npm run test:integration
```

Unit tests mock `dbManager` and the AI providers, so they're fast and
don't need native modules. Integration tests under
`src/__tests__/integration/` exercise the full service composition;
Phase 8 uses a real in-memory SQLite database to catch schema and SQL
issues that mock-DB tests can't see. The `test:integration` script
handles the `better-sqlite3` ABI dance automatically (rebuild for Node,
run, restore for Electron — including a `finally` so `npm start`
still works if the test run fails).

## Troubleshooting

### Native Module Issues

If you encounter native module errors after updating Electron:

```bash
npm run rebuild
```

### Build Failures

1. Clear build cache:
```bash
rm -rf release/build
rm -rf .erb/dll
npm run build:dll
```

2. Reinstall dependencies:
```bash
rm -rf node_modules
rm -rf release/app/node_modules
npm install
```

### Kuzu Module Not Loading

The Kuzu native module is bundled in production. If it fails:

1. Check `release/app/node_modules/kuzu` exists
2. Ensure correct architecture (x64 vs arm64)
3. Check logs in `%APPDATA%/SmartReader/logs`

## License

MIT

## Acknowledgments

- Built on [Electron React Boilerplate](https://electron-react-boilerplate.js.org/)
- Graph database powered by [Kuzu](https://kuzudb.com/)
- UI components from [MUI](https://mui.com/)
