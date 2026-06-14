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
- **StudyEnhancer**: Text animation system for learning enhancement (see [StudyEnhancer System](study-enhancer.md))

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
