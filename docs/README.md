# SmartReader Documentation

Welcome to SmartReader v2 - An AI-powered e-reader with spaced repetition learning.

## 🚀 Quick Navigation

**New user?** → [Quick Start Guide](user/QUICK_START.md) (5 minutes)

**Need help?** → [Troubleshooting](user/TROUBLESHOOTING.md)

**Developer?** → [Technical Documentation](#technical-documentation)

## 📚 Documentation Structure

### User Documentation (`docs/user/`)

Essential guides for using SmartReader:

| Document | Description | Audience |
|----------|-------------|----------|
| [Quick Start](user/QUICK_START.md) | Get started in 5 minutes | New users ⭐ |
| [User Manual](user/user_manual.md) | Complete feature reference | All users |
| [AI Provider Setup](user/AI_PROVIDER_SETUP.md) | Configure AI services | AI users |
| [Troubleshooting](user/TROUBLESHOOTING.md) | Fix common issues | When stuck |
| [Keyboard Shortcuts](user/KEYBOARD_SHORTCUTS.md) | Shortcuts reference | Power users |
| [Use Cases](user/USE_CASES.md) | Real-world examples | All users |

### Technical Documentation (`docs/technical/`)

Architecture and implementation details:

**Cross-cutting design docs:**

| Document | Description | Audience |
|----------|-------------|----------|
| [Architecture Overview](technical/ARCHITECTURE.md) | System architecture | Developers |
| [AI Learning Brain Architecture](technical/AI-Learning-Brain-Architecture.md) | Brain system design | Developers |
| [Agentic AI](technical/Agentic-AI-Implementation-Analysis.md) | AI agent implementation | Developers |
| [LLM-Driven Learning](technical/LLM-DRIVEN-LEARNING-MANAGEMENT-SYSTEM.md) | Learning system | Developers |
| [API Reference](technical/API_REFERENCE.md) | API documentation | Developers |

**Subsystem references** (extracted from CLAUDE.md — read before touching that subsystem):

| Document | Scope |
|----------|-------|
| [Views & Feature Modules](technical/views.md) | Reading, Bookshelf, Notes, Chat, Browser, Vocabulary, Translate, Writing, Grammar, Quiz, MoodBoard, Settings; common UI patterns |
| [Graph Database (Neo4j)](technical/graph-database.md) | Neo4j adapters, IPC, Memory Consolidation Graph (`SummarizationGraphService`) |
| [StudyEnhancer System](technical/study-enhancer.md) | Browser word-animation system, Smart Summary, paragraph action icons |
| [Animation Core](technical/animation-core.md) | Modular animations for EPUB/PDF/Notes (`useEPUBAnimations`, `usePDFAnimations`, `useNoteAnimations`) |
| [Rich Markdown Editor](technical/rich-markdown-editor.md) | TipTap-based editor, `[[wiki-link]]` Knowledge Web, backlinks |
| [AI Concept Extraction](technical/concept-extraction.md) | `AIConceptExtractionService`, `ConceptReviewPanel` |
| [Skill System](technical/skill-system.md) | Agent Skills standard, code- and file-based skills, IPC handlers, view integration |
| [Knowledge Dashboard](technical/knowledge-dashboard.md) | `/knowledge` route, `MemoryTimelinePanel`, dashboard tabs |
| [Learning Plan System](technical/learning-plan.md) | 5-step wizard, Universal Learning Points, Leitner/FSRS |
| [Study Session System](technical/study-session.md) | Session modes, ratings, enhanced features (AI hints, sounds, TTS), analytics |
| [AI Learning Brain](technical/ai-learning-brain.md) | Background service, heartbeat, episodic memory, consolidation, cross-concept analysis, schedule reconciliation |

### Archive (`docs/archive/`)

Historical design documents and completed planning documents. Kept for reference but may be outdated.

## 📖 Documentation by Use Case

### 🎓 I'm a Student

**You want to:** Master vocabulary and concepts with spaced repetition

**Start here:**
1. [Quick Start → Workflow 2](user/QUICK_START.md#essential-workflow-2)
2. [Learning Plans](user/user_manual.md#learning-plans)
3. [Study Sessions](user/user_manual.md#study-sessions)
4. [Leitner System](user/user_manual.md#spaced-repetition-leitner-system)

**Example:** [GRE Vocabulary Mastery](user/USE_CASES.md#gre-vocabulary)

---

### 📚 I'm a Researcher

**You want to:** Analyze papers and build knowledge graphs

**Start here:**
1. [Reading Documents](user/user_manual.md#reading-documents)
2. [Knowledge Graph](user/user_manual.md#knowledge-graph)
3. [AI Chat](user/user_manual.md#ai-chat-assistant)
4. [Concept Extraction](user/user_manual.md#concept-extraction)

**Example:** [Research Paper Analysis](user/USE_CASES.md#research-paper-analysis)

---

### 📖 I'm Learning a Language

**You want to:** Read and improve comprehension with vocabulary building

**Start here:**
1. [Vocabulary Learning](user/user_manual.md#vocabulary-learning)
2. [Translation Features](user/user_manual.md#translation)
3. [Reading Assistance](user/user_manual.md#reading-with-assistance)
4. [Study Sessions](user/user_manual.md#study-sessions)

**Example:** [Novel Reading with Translation](user/USE_CASES.md#language-learning)

---

### 👨‍💻 I'm a Developer

**You want to:** Understand the codebase and contribute

**Start here:**
1. [Architecture Overview](technical/ARCHITECTURE.md)
2. [Development Setup](../CLAUDE.md#development-commands)
3. [Contributing Guide](../CONTRIBUTING.md)
4. [API Reference](technical/API_REFERENCE.md)

## 🎯 Common Tasks

### Reading
- [Import a book](user/user_manual.md#opening-a-book)
- [Highlight and annotate](user/user_manual.md#highlighting-annotations)
- [Use AI features](user/user_manual.md#ai-features)
- [Smart Summary](user/user_manual.md#smart-summary)

### Learning
- [Create learning plan](user/QUICK_START.md#essential-workflow-2)
- [Study flashcards](user/QUICK_START.md#essential-workflow-3)
- [Track progress](user/user_manual.md#progress-tracking)
- [View knowledge graph](user/user_manual.md#knowledge-graph)

### AI Features
- [Configure provider](user/AI_PROVIDER_SETUP.md)
- [Use skill commands](user/user_manual.md#skill-commands)
- [Chat with AI](user/user_manual.md#in-context-chat)
- [Generate quizzes](user/user_manual.md#quiz-generation)

### Troubleshooting
- [Installation issues](user/TROUBLESHOOTING.md#installation)
- [AI not working](user/TROUBLESHOOTING.md#ai-providers)
- [Import problems](user/TROUBLESHOOTING.md#import-issues)
- [Performance issues](user/TROUBLESHOOTING.md#performance)

## 🔧 System Requirements

**Minimum:**
- OS: Windows 10+, macOS 10.14+, Linux (Ubuntu 18.04+)
- RAM: 4GB
- Storage: 500MB

**Recommended:**
- RAM: 8GB+
- Storage: 2GB+
- For AI: Internet connection (cloud) or 16GB+ RAM (local)

## 📦 Installation

**Pre-built binaries:**
1. Download from [Releases](https://github.com/your-repo/releases)
2. Run installer for your platform
3. Follow [Quick Start Guide](user/QUICK_START.md)

**Build from source:**
```bash
git clone https://github.com/your-repo/smart-reader-v2
cd smart-reader-v2
npm install
npm start
```

See [Development Setup](../CLAUDE.md) for details.

## 🤝 Contributing

We welcome contributions!

**Documentation:**
- Found an error? [Submit an issue](https://github.com/your-repo/issues)
- Want to improve docs? [Submit a PR](https://github.com/your-repo/pulls)
- Follow [Documentation Standards](#documentation-standards)

**Code:**
- See [Contributing Guide](../CONTRIBUTING.md)
- Read [Architecture Overview](technical/ARCHITECTURE.md)
- Check [Open Issues](https://github.com/your-repo/issues)

### Documentation Standards

**Writing Style:**
- Clear, concise language
- Present tense, active voice
- Include examples for features
- Specify expected outcomes

**Formatting:**
- ATX-style headers (`#`)
- Language-specified code blocks
- Markdown tables for comparisons
- Cross-reference related docs

**Content:**
- Test all instructions
- Check all links
- Update version numbers
- Maintain consistency

## 📞 Getting Help

**Community:**
- 💬 [Discord](https://discord.gg/smartreader)
- 🐙 [GitHub Discussions](https://github.com/your-repo/discussions)
- 📝 [Issue Tracker](https://github.com/your-repo/issues)

**Professional Support:**
- 📧 support@smartreader.com
- 📝 [Submit Ticket](https://support.smartreader.com)

## 📋 Documentation Changelog

### Version 2.0.0 (2026-03-17)

**Major reorganization:**
- ✅ Created organized structure (user/technical/archive)
- ✅ Moved 21 outdated planning docs to archive
- ✅ Created quick start guide
- ✅ Improved documentation index
- ✅ Cross-referenced all documents

**New documents:**
- Quick Start Guide
- Documentation Index
- Troubleshooting Guide (planned)
- Use Cases Library (planned)

**Archived:**
- All completed planning documents
- Historical design documents
- Migration guides (completed)

### Version 1.0.0 (2024-02-01)

- Initial user manual
- Basic installation instructions
- Core feature documentation

## 📄 License

[Add your license information]

---

*SmartReader Documentation v2.0.0 | Last updated: 2026-03-17*

*For the latest updates, visit the [project repository](https://github.com/your-repo)*
