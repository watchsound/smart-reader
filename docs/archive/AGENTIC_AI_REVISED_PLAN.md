# Agentic AI Architecture - Revised Plan
## SmartReader v2 → v3 Transformation

---

## Executive Summary

After reviewing the current codebase, I've identified key considerations for the agentic AI implementation:

### Current State Analysis

**Strengths:**
- Well-structured AI provider abstraction (`AIProviderInterface`, `AIProviderManager`)
- Rich prompt library (`AIPrompts.js` with 20+ specialized prompts)
- Dual instances (main/renderer) for process isolation
- JSON response parsing with retry logic

**Gaps:**
- No function/tool calling support in any provider
- No memory system (sessions are stateless)
- No multi-step reasoning (single prompt → single response)
- No skill/capability registry

---

## Part 1: Revised Architecture

### 1.1 Skill-Based Architecture

Instead of complex "agents", we introduce **Skills** - composable, single-purpose capabilities that can be combined.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SKILL-BASED ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      SKILL REGISTRY                              │    │
│  │                                                                   │    │
│  │  Core Skills (AI-powered)                                        │    │
│  │  ─────────────────────────                                       │    │
│  │  • SummarizeSkill        - Generate summaries                    │    │
│  │  • TranslateSkill        - Multi-step translation                │    │
│  │  • GrammarCheckSkill     - Check and correct grammar             │    │
│  │  • ConceptExtractSkill   - Extract entities/concepts             │    │
│  │  • QuizGenerateSkill     - Generate quiz questions               │    │
│  │  • MindmapSkill          - Create mindmap from text              │    │
│  │  • VocabularySkill       - Define, analyze, create cards         │    │
│  │  • RewriteSkill          - Simplify/adapt reading level          │    │
│  │  • ExplainSkill          - Explain concepts in context           │    │
│  │  • CompareSkill          - Compare user text with reference      │    │
│  │                                                                   │    │
│  │  Data Skills (Tool-based)                                         │    │
│  │  ────────────────────────                                         │    │
│  │  • SearchNotesSkill      - Search user's notes (SQLite/Neo4j)    │    │
│  │  • SearchBooksSkill      - Search book content (ChromaDB)        │    │
│  │  • GraphQuerySkill       - Query knowledge graph (Neo4j)         │    │
│  │  • CreateNoteSkill       - Create new note with concepts         │    │
│  │  • UpdateLeitnerSkill    - Update spaced repetition state        │    │
│  │  • WebSearchSkill        - Search web for information            │    │
│  │  • FetchUrlSkill         - Fetch and parse web content           │    │
│  │                                                                   │    │
│  │  Animation Skills (UI-based)                                      │    │
│  │  ───────────────────────                                          │    │
│  │  • HighlightWordsSkill   - Highlight vocabulary in view          │    │
│  │  • SmartSummarySkill     - Flying word animation + summary       │    │
│  │  • LeitnerAnimateSkill   - Animate card transitions              │    │
│  │  • ConceptMapSkill       - Show concept connections              │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      SKILL EXECUTOR                              │    │
│  │                                                                   │    │
│  │  Responsibilities:                                                │    │
│  │  • Parse LLM tool_use responses                                  │    │
│  │  • Execute skills with parameters                                 │    │
│  │  • Handle errors and retries                                      │    │
│  │  • Return results for multi-turn                                  │    │
│  │                                                                   │    │
│  │  Key Methods:                                                     │    │
│  │  • executeSkill(name, params, context)                           │    │
│  │  • getAvailableSkills(context)                                   │    │
│  │  • getSkillSchema(name) → JSON Schema for LLM                    │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      CONTEXT MANAGER                             │    │
│  │                                                                   │    │
│  │  Session Context (short-term):                                    │    │
│  │  • Current view/document being read                              │    │
│  │  • Selected text                                                  │    │
│  │  • Recent skill executions (for continuity)                      │    │
│  │  • Current chat conversation                                      │    │
│  │                                                                   │    │
│  │  User Context (long-term, from Neo4j):                           │    │
│  │  • Learning preferences (from settings)                          │    │
│  │  • Reader level (Elementary/Middle/College)                      │    │
│  │  • Study mode (General/Language/Math/Program)                    │    │
│  │  • Weak concepts (from graph analysis)                           │    │
│  │  • Vocabulary mastery levels                                      │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Why Skills Instead of Agents

| Aspect | Full Agents | Skills |
|--------|-------------|--------|
| Complexity | High - autonomous planning | Low - single purpose |
| Debugging | Hard - multi-step reasoning | Easy - clear inputs/outputs |
| Cost | High - many LLM calls | Lower - targeted calls |
| Integration | Requires orchestration | Works with existing UI |
| Gradual adoption | All or nothing | Add one skill at a time |
| User control | Agent decides | User chooses skill |

**Key insight**: Our app already has good UI for guiding users (Translation 5-step, Grammar annotate, Writing 6-level). We don't need autonomous agents - we need **Skills** that the user or UI can invoke.

### 1.3 Hybrid Approach

We can have both:
1. **Direct Skills**: User clicks "Summarize" → SummarizeSkill executes
2. **AI-Directed Skills**: User asks a question → LLM decides which skills to use

```
User: "Help me understand this paragraph better"

LLM receives:
- System prompt with available skills
- User's question
- Current context (selected text, reader level)

LLM responds with tool_use:
[
  { "skill": "ConceptExtractSkill", "params": { "text": "..." } },
  { "skill": "ExplainSkill", "params": { "concepts": [...], "level": "elementary" } }
]

SkillExecutor runs skills → returns results → LLM synthesizes response
```

---

## Part 2: Implementation Plan

### Phase 3A: Skill Infrastructure (Week 1-2)

#### 2.1 Skill Base Class

```javascript
// src/main/skills/BaseSkill.js
class BaseSkill {
  static get name() { throw new Error('Must implement name'); }
  static get description() { throw new Error('Must implement description'); }
  static get parameters() { return {}; } // JSON Schema
  static get category() { return 'general'; }

  constructor(context) {
    this.context = context; // { userId, token, currentView, selectedText, ... }
  }

  // Validate parameters against schema
  validateParams(params) { ... }

  // Execute the skill - must be overridden
  async execute(params) {
    throw new Error('Must implement execute');
  }

  // Optional: stream results
  async *executeStream(params) {
    yield await this.execute(params);
  }
}
```

#### 2.2 Skill Registry

```javascript
// src/main/skills/SkillRegistry.js
class SkillRegistry {
  constructor() {
    this.skills = new Map();
  }

  register(SkillClass) {
    this.skills.set(SkillClass.name, SkillClass);
  }

  get(name) {
    return this.skills.get(name);
  }

  getAll() {
    return Array.from(this.skills.values());
  }

  // Generate tool definitions for LLM
  getToolDefinitions(context) {
    return this.getAll()
      .filter(skill => this.isAvailable(skill, context))
      .map(skill => ({
        name: skill.name,
        description: skill.description,
        input_schema: {
          type: 'object',
          properties: skill.parameters,
          required: skill.requiredParams || []
        }
      }));
  }

  isAvailable(skill, context) {
    // Check if skill is available in current context
    // e.g., GraphQuerySkill needs Neo4j to be connected
    return true;
  }
}
```

#### 2.3 Skill Executor

```javascript
// src/main/skills/SkillExecutor.js
class SkillExecutor {
  constructor(registry, contextManager) {
    this.registry = registry;
    this.contextManager = contextManager;
  }

  async execute(skillName, params, context) {
    const SkillClass = this.registry.get(skillName);
    if (!SkillClass) {
      return { error: `Unknown skill: ${skillName}` };
    }

    const skill = new SkillClass(context);

    // Validate params
    const validation = skill.validateParams(params);
    if (!validation.valid) {
      return { error: validation.errors };
    }

    try {
      const result = await skill.execute(params);

      // Log for memory/analytics
      this.contextManager.logSkillExecution(skillName, params, result);

      return { success: true, result };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Execute multiple skills in sequence or parallel
  async executeMultiple(skillCalls, context, { parallel = false } = {}) {
    if (parallel) {
      return Promise.all(
        skillCalls.map(({ skill, params }) =>
          this.execute(skill, params, context)
        )
      );
    }

    const results = [];
    for (const { skill, params } of skillCalls) {
      results.push(await this.execute(skill, params, context));
    }
    return results;
  }
}
```

### Phase 3B: Provider Upgrades (Week 2-3)

#### 2.4 Add Tool Use to AIProviderInterface

```javascript
// src/commons/service/AIProviderInterface.js
export class AIProviderInterface {
  // ... existing methods ...

  // NEW: Generate content with tool use
  async generateWithTools(prompt, tools, options = {}) {
    throw new Error('Method not implemented');
  }

  // NEW: Continue conversation after tool results
  async continueWithToolResults(messages, toolResults, tools, options = {}) {
    throw new Error('Method not implemented');
  }

  // NEW: Check if provider supports tool use
  supportsToolUse() {
    return false;
  }
}
```

#### 2.5 Implement for Claude (Anthropic)

```javascript
// src/commons/service/ClaudeProvider.js
async generateWithTools(prompt, tools, options = {}) {
  const client = this.createModel();

  const response = await client.messages.create({
    model: this.model,
    max_tokens: options.maxTokens || 4096,
    system: options.systemPrompt,
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema
    })),
    messages: [{ role: 'user', content: prompt }]
  });

  return this.parseToolResponse(response);
}

parseToolResponse(response) {
  const result = {
    text: '',
    toolCalls: [],
    stopReason: response.stop_reason
  };

  for (const block of response.content) {
    if (block.type === 'text') {
      result.text += block.text;
    } else if (block.type === 'tool_use') {
      result.toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input
      });
    }
  }

  return result;
}

async continueWithToolResults(messages, toolResults, tools, options = {}) {
  const client = this.createModel();

  // Add tool results to messages
  const toolResultContent = toolResults.map(r => ({
    type: 'tool_result',
    tool_use_id: r.id,
    content: JSON.stringify(r.result)
  }));

  const updatedMessages = [
    ...messages,
    { role: 'user', content: toolResultContent }
  ];

  const response = await client.messages.create({
    model: this.model,
    max_tokens: options.maxTokens || 4096,
    system: options.systemPrompt,
    tools: tools,
    messages: updatedMessages
  });

  return this.parseToolResponse(response);
}

supportsToolUse() {
  return true;
}
```

#### 2.6 Implement for OpenAI (ChatGPT)

```javascript
// src/commons/service/ChatGPTProvider.js
async generateWithTools(prompt, tools, options = {}) {
  const openai = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });

  const response = await openai.chat.completions.create({
    model: this.model,
    messages: [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      { role: 'user', content: prompt }
    ],
    tools: tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }
    })),
    tool_choice: options.toolChoice || 'auto'
  });

  return this.parseToolResponse(response);
}

parseToolResponse(response) {
  const message = response.choices[0].message;
  const result = {
    text: message.content || '',
    toolCalls: [],
    stopReason: response.choices[0].finish_reason
  };

  if (message.tool_calls) {
    result.toolCalls = message.tool_calls.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments)
    }));
  }

  return result;
}

supportsToolUse() {
  return true;
}
```

### Phase 3C: Core Skills (Week 3-4)

#### 2.7 Example Skills

```javascript
// src/main/skills/ai/SummarizeSkill.js
class SummarizeSkill extends BaseSkill {
  static get name() { return 'summarize'; }
  static get description() { return 'Generate a concise summary of text'; }
  static get parameters() {
    return {
      text: { type: 'string', description: 'Text to summarize' },
      length: { type: 'string', enum: ['brief', 'medium', 'detailed'], default: 'medium' },
      format: { type: 'string', enum: ['paragraph', 'bullets', 'numbered'], default: 'paragraph' }
    };
  }
  static get requiredParams() { return ['text']; }

  async execute({ text, length = 'medium', format = 'paragraph' }) {
    const prompt = this.buildPrompt(text, length, format);
    const result = await this.context.aiProvider.generateContent(prompt);
    return { summary: result };
  }

  buildPrompt(text, length, format) {
    const lengthInstructions = {
      brief: '1-2 sentences',
      medium: '3-4 sentences',
      detailed: '5-7 sentences or a paragraph'
    };

    return `Summarize the following text in ${lengthInstructions[length]}.
Format: ${format}
${this.context.readerLevel ? `Reading level: ${this.context.readerLevel}` : ''}

Text:
"""
${text}
"""`;
  }
}
```

```javascript
// src/main/skills/data/SearchNotesSkill.js
class SearchNotesSkill extends BaseSkill {
  static get name() { return 'search_notes'; }
  static get description() { return 'Search user notes by semantic similarity or keywords'; }
  static get category() { return 'data'; }
  static get parameters() {
    return {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results', default: 10 },
      searchType: { type: 'string', enum: ['semantic', 'keyword'], default: 'semantic' }
    };
  }

  async execute({ query, limit = 10, searchType = 'semantic' }) {
    if (searchType === 'semantic') {
      // Use ChromaDB or Neo4j vector search
      const results = await this.context.chromaManager.search(query, limit);
      return { notes: results };
    } else {
      // Use SQLite LIKE query
      const results = await this.context.noteManager.searchByKeyword(query, limit);
      return { notes: results };
    }
  }
}
```

```javascript
// src/main/skills/graph/GraphQuerySkill.js
class GraphQuerySkill extends BaseSkill {
  static get name() { return 'query_knowledge_graph'; }
  static get description() { return 'Query the knowledge graph to find concepts, relationships, and learning paths'; }
  static get category() { return 'graph'; }
  static get parameters() {
    return {
      queryType: {
        type: 'string',
        enum: ['related_concepts', 'learning_path', 'weak_concepts', 'concept_notes', 'custom'],
        description: 'Type of graph query'
      },
      conceptName: { type: 'string', description: 'Concept to query about' },
      customQuery: { type: 'string', description: 'Custom Cypher query (for advanced use)' }
    };
  }

  async execute({ queryType, conceptName, customQuery }) {
    const graphApi = this.context.graphApi;

    switch (queryType) {
      case 'related_concepts':
        return graphApi.getRelatedConcepts(conceptName, this.context.token);
      case 'learning_path':
        return graphApi.getPersonalizedLearningPath(conceptName, this.context.token);
      case 'weak_concepts':
        return graphApi.detectWeakConcepts(10, this.context.token);
      case 'concept_notes':
        return graphApi.getNotesForConcept(conceptName, this.context.token);
      case 'custom':
        // Only for advanced/internal use
        return graphApi.runQuery(customQuery, this.context.token);
      default:
        return { error: 'Unknown query type' };
    }
  }
}
```

### Phase 3D: Context Manager (Week 4)

#### 2.8 Context Manager

```javascript
// src/main/skills/ContextManager.js
class ContextManager {
  constructor() {
    this.sessions = new Map(); // userId → SessionContext
    this.skillHistory = [];    // Recent skill executions
  }

  // Get or create session context for user
  getSessionContext(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        userId,
        currentView: null,
        currentDocument: null,
        selectedText: null,
        conversationHistory: [],
        recentSkills: []
      });
    }
    return this.sessions.get(userId);
  }

  // Update context when user navigates
  updateView(userId, { view, documentId, documentType }) {
    const ctx = this.getSessionContext(userId);
    ctx.currentView = view;
    ctx.currentDocument = { id: documentId, type: documentType };
  }

  // Update selected text
  updateSelection(userId, selectedText) {
    const ctx = this.getSessionContext(userId);
    ctx.selectedText = selectedText;
  }

  // Log skill execution for continuity
  logSkillExecution(userId, skillName, params, result) {
    const ctx = this.getSessionContext(userId);
    ctx.recentSkills.push({
      skill: skillName,
      params,
      result: this.summarizeResult(result),
      timestamp: Date.now()
    });

    // Keep only last 10
    if (ctx.recentSkills.length > 10) {
      ctx.recentSkills.shift();
    }
  }

  // Get full context for AI
  getFullContext(userId, token) {
    const session = this.getSessionContext(userId);

    return {
      ...session,
      token,
      // Add user preferences from storage
      readerLevel: customStorage.getReaderLevel(),
      studyMode: customStorage.getStudyMode(),
      // Add methods to access services
      aiProvider: aiProviderManager.currentProvider,
      // ... other service references
    };
  }

  summarizeResult(result) {
    // Truncate large results for memory efficiency
    const str = JSON.stringify(result);
    if (str.length > 500) {
      return str.substring(0, 500) + '...';
    }
    return result;
  }
}
```

### Phase 3E: Integration with AIProviderManager (Week 4-5)

#### 2.9 Add Skill-Aware Methods to AIProviderManager

```javascript
// src/commons/service/AIProviderManager.js
class AIProviderManager {
  // ... existing code ...

  constructor() {
    // ... existing ...
    this.skillRegistry = new SkillRegistry();
    this.skillExecutor = new SkillExecutor(this.skillRegistry, this.contextManager);
    this.contextManager = new ContextManager();
  }

  // Register default skills
  registerDefaultSkills() {
    // AI Skills
    this.skillRegistry.register(SummarizeSkill);
    this.skillRegistry.register(TranslateSkill);
    this.skillRegistry.register(GrammarCheckSkill);
    this.skillRegistry.register(ConceptExtractSkill);
    this.skillRegistry.register(QuizGenerateSkill);
    this.skillRegistry.register(VocabularySkill);
    this.skillRegistry.register(ExplainSkill);

    // Data Skills
    this.skillRegistry.register(SearchNotesSkill);
    this.skillRegistry.register(SearchBooksSkill);
    this.skillRegistry.register(GraphQuerySkill);
    this.skillRegistry.register(CreateNoteSkill);

    // Animation Skills
    this.skillRegistry.register(HighlightWordsSkill);
    this.skillRegistry.register(SmartSummarySkill);
  }

  // NEW: Chat with skill support (agentic mode)
  async chatWithSkills(messages, context, options = {}) {
    if (!this.currentProvider?.supportsToolUse()) {
      // Fallback to regular chat
      return this.sendChatMessage(messages, null, options);
    }

    const tools = this.skillRegistry.getToolDefinitions(context);
    const systemPrompt = this.buildSystemPrompt(context);

    let response = await this.currentProvider.generateWithTools(
      messages[messages.length - 1].content,
      tools,
      { ...options, systemPrompt }
    );

    // Handle tool calls in a loop
    const maxIterations = options.maxIterations || 5;
    let iteration = 0;

    while (response.toolCalls.length > 0 && iteration < maxIterations) {
      // Execute each tool call
      const toolResults = await Promise.all(
        response.toolCalls.map(async (tc) => ({
          id: tc.id,
          result: await this.skillExecutor.execute(tc.name, tc.input, context)
        }))
      );

      // Continue conversation with results
      response = await this.currentProvider.continueWithToolResults(
        messages,
        toolResults,
        tools,
        { ...options, systemPrompt }
      );

      iteration++;
    }

    return response.text;
  }

  buildSystemPrompt(context) {
    const parts = [
      'You are a helpful study assistant in SmartReader.',
      `The user is reading: ${context.currentDocument?.type || 'unknown content'}`,
      `Reader level: ${context.readerLevel || 'not specified'}`,
      `Study mode: ${context.studyMode || 'general'}`,
    ];

    if (context.selectedText) {
      parts.push(`\nCurrently selected text:\n"${context.selectedText.substring(0, 500)}..."`);
    }

    if (context.recentSkills?.length > 0) {
      parts.push('\nRecent actions in this session:');
      context.recentSkills.slice(-3).forEach(s => {
        parts.push(`- ${s.skill}: ${JSON.stringify(s.params).substring(0, 100)}`);
      });
    }

    return parts.join('\n');
  }
}
```

---

## Part 3: Missing Features to Add

### 3.1 Features Not in Original Plan

| Feature | Description | Skill Name | Priority |
|---------|-------------|------------|----------|
| **5W Analysis** | WHO/WHAT/WHEN/WHERE/WHY extraction | `AnalyzeWWWWWSkill` | High |
| **Comparison Exercise** | Compare user writing to reference | `CompareWritingSkill` | High |
| **More Exercises** | Generate practice exercises | `GenerateExerciseSkill` | Medium |
| **Decompose Paragraph** | Break into slides/cards | `DecomposeSkill` | Medium |
| **Category Classification** | Auto-categorize content | `CategorizeSkill` | Medium |
| **Reading Level Adaptation** | Rewrite for different levels | `AdaptLevelSkill` | High |
| **Dependency Tree** | Parse sentence structure | `ParseSentenceSkill` | Medium |
| **Error Pattern Tracking** | Track recurring errors | `ErrorPatternSkill` | Low |

### 3.2 Animation Skills (Using animation-core)

| Skill | Animation Effect | View |
|-------|------------------|------|
| `HighlightVocabSkill` | HighlightEffect + GlowEffect | EPUB/PDF/Notes |
| `SmartSummarySkill` | FlyingWordEffect | Browser/EPUB/PDF |
| `LeitnerAnimateSkill` | LeitnerTransitionEffect | Notes/Vocabulary |
| `ConceptPulseSkill` | GlowEffect on concept words | All views |
| `ErrorHighlightSkill` | HighlightEffect (red) | Grammar/Writing |

### 3.3 Graph-Powered Skills

| Skill | Graph Query | Purpose |
|-------|-------------|---------|
| `FindRelatedSkill` | RELATED_TO traversal | Find related notes/concepts |
| `LearningPathSkill` | REQUIRES traversal | Generate learning path |
| `WeakConceptSkill` | Mastery < threshold | Find concepts to review |
| `EntityLinkSkill` | MENTIONS relationships | Link entities across notes |
| `KnowledgeGapSkill` | Missing prerequisites | Find what user doesn't know |

---

## Part 4: Integration Points

### 4.1 Direct Skill Invocation (UI-driven)

```javascript
// In component
import { useSkill } from '../hooks/useSkill';

function SummaryButton({ selectedText }) {
  const { execute, loading, result } = useSkill('summarize');

  const handleClick = async () => {
    await execute({ text: selectedText, length: 'brief' });
  };

  return (
    <Button onClick={handleClick} loading={loading}>
      Summarize
    </Button>
  );
}
```

### 4.2 AI-Directed Skills (Chat-driven)

```javascript
// In InContextChatPanel
const handleSendMessage = async (message) => {
  const context = contextManager.getFullContext(userId, token);
  context.selectedText = articleStr;
  context.currentDocument = curBook;

  // This may invoke multiple skills based on user's question
  const response = await aiProviderManager.chatWithSkills(
    [...messages, { role: 'user', content: message }],
    context
  );

  setMessages(prev => [...prev,
    { role: 'user', content: message },
    { role: 'assistant', content: response }
  ]);
};
```

### 4.3 IPC Handlers

```javascript
// src/main/ipc/skillHandlers.js
ipcMain.handle('skill-execute', async (event, { skillName, params, token }) => {
  const userId = getUserIdFromToken(token);
  const context = contextManager.getFullContext(userId, token);
  return skillExecutor.execute(skillName, params, context);
});

ipcMain.handle('skill-list', async (event, { token }) => {
  const userId = getUserIdFromToken(token);
  const context = contextManager.getFullContext(userId, token);
  return skillRegistry.getToolDefinitions(context);
});

ipcMain.handle('skill-chat', async (event, { messages, token }) => {
  const userId = getUserIdFromToken(token);
  const context = contextManager.getFullContext(userId, token);
  return aiProviderManager.chatWithSkills(messages, context);
});
```

---

## Part 5: Revised Timeline

### Month 3: Skill Infrastructure ✅ COMPLETE

| Week | Tasks | Status |
|------|-------|--------|
| Week 1 | BaseSkill, SkillRegistry, SkillExecutor | ✅ Done |
| Week 2 | Add tool_use to ClaudeProvider, ChatGPTProvider | ✅ Done |
| Week 3 | Core AI skills (Summarize, Grammar, Vocabulary, Explain, ConceptExtract) | ✅ Done |
| Week 4 | Data skills (SearchNotes, GraphQuery, CreateNote) | ✅ Done |

**Implemented Files:**
- `src/main/skills/BaseSkill.js` - Abstract base class
- `src/main/skills/SkillRegistry.js` - Central registry with getToolDefinitions()
- `src/main/skills/SkillExecutor.js` - Executes skills with validation
- `src/main/skills/ContextManager.js` - Session/user context management
- `src/main/skills/ai/*.js` - 5 AI skills (Summarize, Grammar, Vocabulary, Explain, ConceptExtract)
- `src/main/skills/data/*.js` - 3 Data skills (SearchNotes, GraphQuery, CreateNote)
- `src/commons/service/ClaudeProvider.js` - Added tool_use support
- `src/commons/service/ChatGPTProvider.js` - Added tool_use support
- `src/commons/service/AIProviderManager.js` - Added chatWithSkills, generateWithTools
- `src/main/ipc/skillHandlers.js` - IPC handlers for skills
- `src/renderer/api/skillApi.js` - Renderer API
- `src/renderer/hooks/useSkills.js` - React hooks (useSkills, useSkillChat)

### Month 4: Skill Integration (Current)

| Week | Tasks | Status |
|------|-------|--------|
| Week 1 | ContextManager, session tracking | ✅ Done (included in Month 3) |
| Week 2 | chatWithSkills in AIProviderManager | ✅ Done (included in Month 3) |
| Week 3 | IPC handlers, renderer hooks (useSkill) | ✅ Done (included in Month 3) |
| Week 4 | Integration with InContextChatPanel | 🔲 TODO |

### Month 5: Animation Skills + View Integration

| Week | Tasks |
|------|-------|
| Week 1 | Animation skills (using animation-core) |
| Week 2 | EPUB/PDF view integration |
| Week 3 | Leitner/Notes view integration |
| Week 4 | Testing and polish |

---

## Part 6: File Structure

```
src/
├── main/
│   ├── skills/
│   │   ├── BaseSkill.js
│   │   ├── SkillRegistry.js
│   │   ├── SkillExecutor.js
│   │   ├── ContextManager.js
│   │   │
│   │   ├── ai/                    # AI-powered skills
│   │   │   ├── SummarizeSkill.js
│   │   │   ├── TranslateSkill.js
│   │   │   ├── GrammarCheckSkill.js
│   │   │   ├── VocabularySkill.js
│   │   │   ├── ConceptExtractSkill.js
│   │   │   ├── QuizGenerateSkill.js
│   │   │   ├── ExplainSkill.js
│   │   │   ├── CompareWritingSkill.js
│   │   │   ├── AdaptLevelSkill.js
│   │   │   └── ParseSentenceSkill.js
│   │   │
│   │   ├── data/                  # Data/tool skills
│   │   │   ├── SearchNotesSkill.js
│   │   │   ├── SearchBooksSkill.js
│   │   │   ├── CreateNoteSkill.js
│   │   │   ├── UpdateLeitnerSkill.js
│   │   │   ├── WebSearchSkill.js
│   │   │   └── FetchUrlSkill.js
│   │   │
│   │   ├── graph/                 # Neo4j skills
│   │   │   ├── GraphQuerySkill.js
│   │   │   ├── LearningPathSkill.js
│   │   │   ├── WeakConceptSkill.js
│   │   │   ├── EntityLinkSkill.js
│   │   │   └── KnowledgeGapSkill.js
│   │   │
│   │   └── animation/             # Animation-triggering skills
│   │       ├── HighlightVocabSkill.js
│   │       ├── SmartSummarySkill.js
│   │       ├── LeitnerAnimateSkill.js
│   │       └── ConceptPulseSkill.js
│   │
│   └── ipc/
│       └── skillHandlers.js
│
├── renderer/
│   ├── hooks/
│   │   ├── useSkill.js            # Hook for executing skills
│   │   └── useSkillChat.js        # Hook for skill-aware chat
│   │
│   └── api/
│       └── skillApi.js            # IPC calls for skills
│
└── commons/
    └── service/
        └── AIProviderInterface.js  # Add tool_use methods
        └── ClaudeProvider.js       # Implement tool_use
        └── ChatGPTProvider.js      # Implement tool_use
        └── AIProviderManager.js    # Add chatWithSkills
```

---

## Conclusion

This revised plan:

1. **Introduces Skills** instead of complex agents - more practical and gradual
2. **Builds on existing architecture** - extends AIProviderInterface, AIProviderManager
3. **Reuses existing prompts** - AIPrompts.js becomes skill implementations
4. **Integrates animation-core** - Animation skills use the new module
5. **Connects to Neo4j** - Graph skills leverage the graph database
6. **Maintains user control** - Skills are invoked by user or AI, not autonomous
7. **Enables gradual adoption** - Add skills one at a time, test each

The key insight: SmartReader already has sophisticated UI flows (Translation 5-step, Grammar annotate, Writing 6-level). We don't need autonomous agents - we need **Skills** that enhance these existing flows with AI capabilities and tool use.
