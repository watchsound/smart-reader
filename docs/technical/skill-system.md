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
