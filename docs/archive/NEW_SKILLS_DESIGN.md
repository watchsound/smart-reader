# New AI/Data Skills Design Document (Revised)

## Overview

This document outlines the design and implementation plan for expanding SmartReader's skill system with additional AI and Data skills. These skills follow the Claude Code Skills pattern established in the existing skill infrastructure.

**Revision Notes**: This document incorporates critical review findings to avoid duplicate functionality and maximize code reuse.

---

## Critical Review Summary

### Issues Identified and Resolved

| Issue | Resolution |
|-------|------------|
| CompareWritingSkill duplicates GrammarCheckSkill | Extend GrammarCheckSkill with `compareWith` parameter |
| NLPAnalysisSkill only useful for translation | Merge into TranslateSkill as `includeNLP` option |
| MindmapSkill missing | Added to plan |
| TextSimplifySkill missing | Added to plan (extract from RewriteHelper) |
| SmartSummarySkill missing | Added to plan (vocabulary-constrained) |
| Prompts scattered across files | Consolidate to AIPrompts.js |
| CreateVocabularySkill duplicates VocabularySkill AI logic | Make persistence-only |

---

## Proposed Skills (Final List)

### AI Skills - NEW

| Skill Name | Description | Priority |
|------------|-------------|----------|
| `TranslateSkill` | Multi-step translation learning (Chinese/Japanese → English) with optional NLP | High |
| `QuizGenerateSkill` | Generate quiz questions from text content | High |
| `MindmapSkill` | Generate mindmap structure from text | High |
| `TextSimplifySkill` | Simplify text for different reading levels | Medium |
| `SmartSummarySkill` | Vocabulary-constrained summary for visual learning | Medium |
| `AnnotateSkill` | Annotate text for grammar elements (nouns, verbs, etc.) | Medium |
| `AnalyzeStructureSkill` | 5W analysis (Who, What, When, Where, Why) | Medium |
| `VerbCompareSkill` | Compare usage of two English verbs | Low |

### AI Skills - EXTEND (Not New)

| Skill Name | Extension | Priority |
|------------|-----------|----------|
| `GrammarCheckSkill` | Add `compareWith` and `generateExercises` params | High |

### Data Skills - NEW

| Skill Name | Description | Priority |
|------------|-------------|----------|
| `CreateVocabularySkill` | Save vocabulary cards (persistence only, no AI) | High |
| `CreateQuizSkill` | Save generated quiz problems to database | High |
| `SearchVocabularySkill` | Search vocabulary by word or query | Medium |
| `GetLeitnerDueSkill` | Get items due for Leitner review | Medium |

---

## Pre-Implementation: Prompt Consolidation

Before implementing skills, move translation prompts to the central prompt hub.

### Files to Modify

**Source**: `src/renderer/views/translate/PromptUtil.js`
**Target**: `src/commons/utils/AIPrompts.js`

**Functions to Move**:
```javascript
// Move these to AIPrompts.js:
export const getTranslatePrompt = (sentence, language) => { ... }
export const getNLPAnnotationPrompt = (sentence) => { ... }
export const getVerbComparisonPrompt = (verb1, verb2, language) => { ... }
export const getVerbExplainedPrompt = (verb, language) => { ... }
```

**Reason**: Main process skills cannot import from renderer process files. Consolidating prompts allows proper code sharing.

---

## Detailed Skill Specifications

### 1. TranslateSkill (AI) - NEW

**Purpose**: Guide users through structured translation learning from Chinese/Japanese to English using a 5-step methodology. Optionally includes NLP analysis.

**Parameters**:
```javascript
{
  text: {
    type: 'string',
    description: 'Text to translate (Chinese or Japanese)'
  },
  sourceLanguage: {
    type: 'string',
    enum: ['Chinese', 'Japanese'],
    default: 'Chinese',
    description: 'Source language of the text'
  },
  includeNLP: {
    type: 'boolean',
    default: false,
    description: 'Include NLP analysis (tokenization, POS, dependencies) for the translated output'
  },
  mode: {
    type: 'string',
    enum: ['full', 'simple'],
    default: 'full',
    description: 'full = 5-step breakdown, simple = direct translation with explanation'
  }
}
```

**Required Parameters**: `['text']`

**Returns** (mode='full'):
```javascript
{
  inputSentence: string,
  sourceLanguage: string,
  steps: {
    'step-1': {
      title: string,  // "Extract SVO structure"
      subVerbObjList: [{
        subject: { input: string, english: string },
        verb: { input: string, english: string[] },
        object: { input: string, english: string }
      }],
      explain: string
    },
    'step-2': {
      title: string,  // "Analyze verbs"
      inputVerbList: [{ inputVerb: string, englishVerbOptions: string[] }],
      explain: string
    },
    'step-3': {
      title: string,  // "Build scaffold"
      scaffoldOptions: string[],
      bestScaffold: string,
      explain: string
    },
    'step-4': {
      title: string,  // "Select sentence pattern"
      sentenceStructure: string,
      explain: string
    },
    'step-5': {
      title: string,  // "Final translation"
      output: string,
      explain: string
    }
  },
  nlpAnalysis?: {  // Only if includeNLP=true
    sentence: string,
    tokens: [{ text, pos, ner, dependency, index, head }],
    coreferences: [{ coref_chain, mentions }]
  }
}
```

**Prompt Reuse**:
- `getTranslatePrompt()` (move to AIPrompts.js)
- `getNLPAnnotationPrompt()` (move to AIPrompts.js)

**Note**: This skill replaces the proposed `NLPAnalysisSkill` by integrating NLP as an option.

---

### 2. QuizGenerateSkill (AI) - NEW

**Purpose**: Generate multiple-choice quiz questions from text content.

**Parameters**:
```javascript
{
  text: {
    type: 'string',
    description: 'Text content to generate quiz from'
  },
  questionCount: {
    type: 'number',
    default: 4,
    minimum: 1,
    maximum: 10,
    description: 'Number of questions to generate'
  },
  difficulty: {
    type: 'string',
    enum: ['easy', 'medium', 'hard', 'mixed'],
    default: 'mixed',
    description: 'Difficulty level of questions'
  }
}
```

**Required Parameters**: `['text']`

**Returns**:
```javascript
{
  quiz: [
    {
      question: string,
      options: {
        optionA: string,
        optionB: string,
        optionC: string,
        optionD: string
      },
      answer: string  // 'A', 'B', 'C', or 'D'
    }
  ],
  sourceTextLength: number,
  questionCount: number
}
```

**Prompt Reuse**:
- `multipleChoiceOne` + content + `multipleChoiceTwo` from AIPrompts.js
- `getQuizChatHistoryPrompt()` for chat format

**Reader Level**: Respects `getReaderLevelInstruction()` for age-appropriate questions.

---

### 3. GrammarCheckSkill (AI) - EXTEND EXISTING

**Purpose**: Extend existing skill to support writing comparison and exercise generation.

**New Parameters** (add to existing):
```javascript
{
  // Existing parameters...
  text: { type: 'string' },
  explanationLanguage: { enum: ['english', 'chinese', 'japanese'], default: 'english' },
  detailed: { type: 'boolean', default: true },

  // NEW parameters:
  compareWith: {
    type: 'string',
    description: 'Original text to compare student writing against. When provided, focuses on differences.'
  },
  generateExercises: {
    type: 'boolean',
    default: false,
    description: 'Generate corrective exercises for identified errors'
  }
}
```

**Extended Returns** (when `compareWith` provided):
```javascript
{
  // Existing fields...
  hasErrors: boolean,
  correctedText: string,
  errors: [...],

  // NEW fields when compareWith is provided:
  issues: [
    {
      type: string,      // e.g., "Capitalization", "Article Usage"
      explain: string
    }
  ],
  exercises: [           // Only when generateExercises=true
    {
      type: string,
      original: string,
      rewriteExercise: string,
      example: string
    }
  ]
}
```

**Prompt Reuse**:
- Existing grammar prompt for basic mode
- `langstudyComparisonExercise()` from AIPrompts.js when `compareWith` provided

**Note**: This replaces the proposed `CompareWritingSkill`.

---

### 4. MindmapSkill (AI) - NEW

**Purpose**: Generate mindmap structure from text for visualization.

**Parameters**:
```javascript
{
  text: {
    type: 'string',
    description: 'Text to generate mindmap from'
  },
  maxNodes: {
    type: 'number',
    default: 8,
    minimum: 3,
    maximum: 15,
    description: 'Maximum number of nodes (excluding root)'
  },
  format: {
    type: 'string',
    enum: ['structured', 'markdown'],
    default: 'structured',
    description: 'Output format: structured JSON or markdown outline'
  }
}
```

**Required Parameters**: `['text']`

**Returns** (format='structured'):
```javascript
{
  title: string,
  root: {
    id: string,
    text: string,
    type: string  // 'concept'
  },
  nodes: [
    {
      id: string,
      text: string,
      type: string,  // 'person', 'concept', 'place', 'event', 'object'
      level: number, // 1 or 2
      parentId?: string,  // For level 2 nodes
      sourcePhrase: string
    }
  ],
  edges: [
    {
      from: string,
      to: string,
      relation: string  // Connecting verb/preposition
    }
  ]
}
```

**Returns** (format='markdown'):
```javascript
{
  title: string,
  markdown: string  // Markdown outline with - prefix
}
```

**Prompt Reuse**:
- `createMindmapExtractionPrompt()` from AIPrompts.js (structured)
- `getMindMapChatHistoryPrompt()` from AIPrompts.js (markdown)

**Difference from ConceptExtractSkill**: MindmapSkill focuses on hierarchical visualization structure. ConceptExtractSkill focuses on knowledge graph entities/relationships for Neo4j.

---

### 5. TextSimplifySkill (AI) - NEW

**Purpose**: Simplify text for different reading levels or vocabulary constraints.

**Parameters**:
```javascript
{
  text: {
    type: 'string',
    description: 'Text to simplify'
  },
  targetLevel: {
    type: 'string',
    enum: ['elementary', 'middle', 'high', 'college'],
    default: 'middle',
    description: 'Target reading level'
  },
  vocabularyLimit: {
    type: 'number',
    description: 'Limit to top N most common words (optional)'
  },
  preserveHtml: {
    type: 'boolean',
    default: false,
    description: 'Preserve HTML tags while simplifying content'
  }
}
```

**Required Parameters**: `['text']`

**Returns**:
```javascript
{
  originalText: string,
  simplifiedText: string,
  targetLevel: string,
  vocabularyLimit?: number,
  simplificationRatio: number  // e.g., 0.7 means 30% simpler
}
```

**Prompt Reuse**:
- `createRewriteHtmlCodeForElementarySchoolPrompt` from AIPrompts.js
- `createRewriteHtmlCodeForWordFrequencyJsonPrompt()` from AIPrompts.js

**Note**: Extracted from browser-only `RewriteHelper.js` to be generally available.

---

### 6. SmartSummarySkill (AI) - NEW

**Purpose**: Generate vocabulary-constrained summaries for visual learning (Study Enhancer).

**Parameters**:
```javascript
{
  text: {
    type: 'string',
    description: 'Text to summarize'
  },
  vocabularyWords: {
    type: 'array',
    items: { type: 'string' },
    default: [],
    description: 'Learning vocabulary words to prioritize in summary'
  },
  maxWords: {
    type: 'number',
    default: 20,
    description: 'Maximum words in summary'
  }
}
```

**Required Parameters**: `['text']`

**Returns**:
```javascript
{
  summary: string,
  words: string[],  // Array of each word in summary
  vocabularyUsed: string[],  // Which learning vocabulary words were used
  sourceWordCount: number,
  summaryWordCount: number
}
```

**Prompt Reuse**:
- `createSmartSummaryPrompt()` from AIPrompts.js

**Key Constraint**: Summary must ONLY use words from source text OR vocabularyWords list. This enables the "flying words" animation in Study Enhancer.

**Difference from SummarizeSkill**: SummarizeSkill produces any valid summary. SmartSummarySkill constrains vocabulary for visual word association learning.

---

### 7. AnnotateSkill (AI) - NEW

**Purpose**: Annotate text to highlight specific grammatical elements.

**Parameters**:
```javascript
{
  text: {
    type: 'string',
    description: 'Text to annotate'
  },
  annotationType: {
    type: 'string',
    enum: ['Noun', 'Verb', 'Prepositions', 'Collocations', 'Structures'],
    default: 'Noun',
    description: 'Type of grammatical element to annotate'
  }
}
```

**Required Parameters**: `['text']`

**Returns**:
```javascript
{
  originalText: string,
  annotatedText: string,  // Text with ${} markers, e.g., "I ${love} ${apples}"
  annotationType: string,
  annotations: [
    {
      text: string,
      startIndex: number,
      endIndex: number
    }
  ],
  annotationCount: number
}
```

**Prompt Reuse**:
- `langstudyAnnotatePrompt()` from AIPrompts.js

---

### 8. AnalyzeStructureSkill (AI) - NEW

**Purpose**: Extract Who, What, When, Where, Why from each sentence.

**Parameters**:
```javascript
{
  text: {
    type: 'string',
    description: 'Paragraph text to analyze'
  }
}
```

**Required Parameters**: `['text']`

**Returns**:
```javascript
{
  data: [
    {
      sentenceIndex: number,
      who: string,
      what: string,
      when: string,
      where: string,
      why: string
    }
  ],
  sentenceCount: number
}
```

**Prompt Reuse**:
- `langstudy5wPrompt` from AIPrompts.js

---

### 9. VerbCompareSkill (AI) - NEW (Low Priority)

**Purpose**: Compare usage of two English verbs with examples.

**Parameters**:
```javascript
{
  verb1: {
    type: 'string',
    description: 'First verb to compare'
  },
  verb2: {
    type: 'string',
    description: 'Second verb to compare'
  },
  explanationLanguage: {
    type: 'string',
    enum: ['english', 'chinese', 'japanese'],
    default: 'english',
    description: 'Language for explanation'
  }
}
```

**Required Parameters**: `['verb1', 'verb2']`

**Returns**:
```javascript
{
  verb1: string,
  verb2: string,
  comparison: string,  // Detailed comparison (100+ words)
  examples: {
    verb1: string[],
    verb2: string[]
  }
}
```

**Prompt Reuse**:
- `getVerbComparisonPrompt()` (move to AIPrompts.js)

---

### 10. CreateVocabularySkill (Data) - NEW

**Purpose**: Save vocabulary cards to database with Leitner integration. **Persistence only** - does not generate definitions (use VocabularySkill for AI definition).

**Parameters**:
```javascript
{
  word: {
    type: 'string',
    description: 'The vocabulary word'
  },
  definition: {
    type: 'string',
    description: 'Definition of the word (required - use VocabularySkill first if needed)'
  },
  example: {
    type: 'string',
    default: '',
    description: 'Example sentence'
  },
  relatedWords: {
    type: 'string',
    default: '',
    description: 'Comma-separated related words'
  },
  setId: {
    type: 'number',
    default: 0,
    description: 'Vocabulary set ID'
  }
}
```

**Required Parameters**: `['word', 'definition']`

**Availability**: Requires `vocabularyManager` in context.

**Returns**:
```javascript
{
  vocabularyId: number,
  word: string,
  definition: string,
  leitnerBox: 1,
  nextReviewDate: string,
  message: string
}
```

**Note**: Unlike VocabularySkill (AI), this skill does NOT call AI. It expects definition to be provided. Typical usage:
1. User selects word
2. Call `VocabularySkill` to get AI-generated definition
3. Call `CreateVocabularySkill` to persist

---

### 11. CreateQuizSkill (Data) - NEW

**Purpose**: Save generated quiz problems to database.

**Parameters**:
```javascript
{
  quiz: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        options: { type: 'object' },
        answer: { type: 'string' }
      }
    },
    description: 'Array of quiz questions to save'
  },
  sourceKey: {
    type: 'string',
    description: 'ID of source (book ID, URL, chat ID)'
  },
  sourceType: {
    type: 'string',
    enum: ['book', 'web', 'chat', 'manual'],
    default: 'manual',
    description: 'Type of content source'
  }
}
```

**Required Parameters**: `['quiz']`

**Availability**: Requires `quizManager` in context.

**Returns**:
```javascript
{
  savedCount: number,
  quizIds: number[],
  sourceKey: string,
  sourceType: string,
  message: string
}
```

---

### 12. SearchVocabularySkill (Data) - NEW

**Purpose**: Search vocabulary cards by word or query.

**Parameters**:
```javascript
{
  query: {
    type: 'string',
    description: 'Search query (word or partial match)'
  },
  page: {
    type: 'number',
    default: 1
  },
  limit: {
    type: 'number',
    default: 20
  }
}
```

**Required Parameters**: `['query']`

**Availability**: Requires `vocabularyManager` in context.

**Returns**:
```javascript
{
  query: string,
  results: [
    {
      id: number,
      word: string,
      definition: string,
      example: string,
      leitnerBox: number,
      nextReview: string
    }
  ],
  total: number,
  page: number,
  totalPages: number
}
```

---

### 13. GetLeitnerDueSkill (Data) - NEW

**Purpose**: Get items due for Leitner spaced repetition review.

**Parameters**:
```javascript
{
  itemType: {
    type: 'string',
    enum: ['vocabulary', 'note', 'all'],
    default: 'all',
    description: 'Type of items to retrieve'
  },
  limit: {
    type: 'number',
    default: 20
  },
  page: {
    type: 'number',
    default: 1
  }
}
```

**Required Parameters**: `[]` (all optional)

**Availability**: Requires `vocabularyManager` or `noteManager` in context.

**Returns**:
```javascript
{
  items: [
    {
      id: number,
      type: string,  // 'vocabulary' or 'note'
      content: object,
      box: number,
      nextReview: string,
      overdueDays: number  // Negative = days until due
    }
  ],
  total: number,
  dueNow: number,
  dueToday: number
}
```

---

## Implementation Plan

### Phase 0: Prompt Consolidation (Pre-requisite)

Move prompts from renderer to commons:

```
src/renderer/views/translate/PromptUtil.js
  → getTranslatePrompt()        → src/commons/utils/AIPrompts.js
  → getNLPAnnotationPrompt()    → src/commons/utils/AIPrompts.js
  → getVerbComparisonPrompt()   → src/commons/utils/AIPrompts.js
  → getVerbExplainedPrompt()    → src/commons/utils/AIPrompts.js
```

Update TranslateMainPage.js imports accordingly.

### Phase 1: High Priority Skills

| Order | Skill | Type | Effort |
|-------|-------|------|--------|
| 1 | GrammarCheckSkill extension | EXTEND | Low |
| 2 | QuizGenerateSkill | NEW AI | Medium |
| 3 | TranslateSkill | NEW AI | High |
| 4 | MindmapSkill | NEW AI | Medium |
| 5 | CreateVocabularySkill | NEW Data | Low |
| 6 | CreateQuizSkill | NEW Data | Low |

### Phase 2: Medium Priority Skills

| Order | Skill | Type | Effort |
|-------|-------|------|--------|
| 7 | TextSimplifySkill | NEW AI | Medium |
| 8 | SmartSummarySkill | NEW AI | Medium |
| 9 | AnnotateSkill | NEW AI | Low |
| 10 | AnalyzeStructureSkill | NEW AI | Low |
| 11 | SearchVocabularySkill | NEW Data | Low |
| 12 | GetLeitnerDueSkill | NEW Data | Low |

### Phase 3: Low Priority Skills

| Order | Skill | Type | Effort |
|-------|-------|------|--------|
| 13 | VerbCompareSkill | NEW AI | Low |

---

## File Structure

```
src/main/skills/
├── ai/
│   ├── index.js                    # Update exports
│   ├── TranslateSkill.js           # NEW
│   ├── QuizGenerateSkill.js        # NEW
│   ├── MindmapSkill.js             # NEW
│   ├── TextSimplifySkill.js        # NEW
│   ├── SmartSummarySkill.js        # NEW
│   ├── AnnotateSkill.js            # NEW
│   ├── AnalyzeStructureSkill.js    # NEW
│   ├── VerbCompareSkill.js         # NEW (low priority)
│   ├── GrammarCheckSkill.js        # MODIFY (extend)
│   └── ... (existing skills)
├── data/
│   ├── index.js                    # Update exports
│   ├── CreateVocabularySkill.js    # NEW
│   ├── CreateQuizSkill.js          # NEW
│   ├── SearchVocabularySkill.js    # NEW
│   ├── GetLeitnerDueSkill.js       # NEW
│   └── ... (existing skills)
└── index.js                        # Auto-registers all

src/commons/utils/
└── AIPrompts.js                    # ADD translation prompts
```

---

## Test Plan

### Test Files

```
src/__tests__/skills/
├── TranslateSkill.test.js          # 25-30 tests
├── QuizGenerateSkill.test.js       # 20-25 tests
├── MindmapSkill.test.js            # 15-20 tests
├── TextSimplifySkill.test.js       # 15-20 tests
├── SmartSummarySkill.test.js       # 15-20 tests
├── AnnotateSkill.test.js           # 15-20 tests
├── AnalyzeStructureSkill.test.js   # 15-20 tests
├── GrammarCheckSkill.test.js       # UPDATE existing (add 10-15 tests)
├── CreateVocabularySkill.test.js   # 20-25 tests
├── CreateQuizSkill.test.js         # 20-25 tests
├── SearchVocabularySkill.test.js   # 15-20 tests
├── GetLeitnerDueSkill.test.js      # 15-20 tests
└── VerbCompareSkill.test.js        # 10-15 tests (low priority)
```

### Test Categories per Skill

1. **Static properties**: name, description, parameters, category
2. **Parameter validation**: required params, type checking, defaults
3. **Availability checks**: service dependencies
4. **Execute method**: mocked AI provider, happy path
5. **Error handling**: AI errors, parsing errors
6. **Edge cases**: empty text, special characters, long text

---

## Integration Points

### InContextChatPanel Quick Actions

Update quick action buttons:

| Button | Skill | Parameters |
|--------|-------|------------|
| Summarize | `summarize` | existing |
| Explain | `explain` | existing |
| Key Points | `extract_concepts` | existing |
| Grammar | `grammar_check` | existing |
| My Notes | `search_notes` | existing |
| **Quiz** | `quiz_generate` | `questionCount: 4` |
| **Mindmap** | `mindmap` | `format: 'structured'` |
| **Simplify** | `text_simplify` | `targetLevel: from settings` |
| **Translate** | `translate` | `mode: 'simple'` |

### Context Menu Integration

Browser/Reader right-click menu:
- "Generate Quiz" → `quiz_generate`
- "Create Mindmap" → `mindmap`
- "Simplify for Me" → `text_simplify`
- "Translate (Step by Step)" → `translate` with `mode: 'full'`
- "5W Analysis" → `analyze_structure`

---

## Success Criteria

1. **Phase 0 Complete**: Prompts consolidated, no cross-process imports
2. **Phase 1 Complete**: 6 high-priority skills implemented and tested
3. **Phase 2 Complete**: 6 medium-priority skills implemented and tested
4. **All Tests Pass**: 200+ new unit tests
5. **Integration Working**: Skills available in InContextChatPanel
6. **Documentation Updated**: CLAUDE.md reflects all new skills
7. **No Regressions**: Existing skills and views still work

---

## Appendix: Prompt Locations Reference

| Prompt Function | Current Location | Used By |
|-----------------|------------------|---------|
| `multipleChoiceOne/Two` | AIPrompts.js | QuizGenerateSkill |
| `getQuizChatHistoryPrompt()` | AIPrompts.js | QuizGenerateSkill |
| `createMindmapExtractionPrompt()` | AIPrompts.js | MindmapSkill |
| `getMindMapChatHistoryPrompt()` | AIPrompts.js | MindmapSkill |
| `createSmartSummaryPrompt()` | AIPrompts.js | SmartSummarySkill |
| `langstudyAnnotatePrompt()` | AIPrompts.js | AnnotateSkill |
| `langstudy5wPrompt` | AIPrompts.js | AnalyzeStructureSkill |
| `langstudyComparisonExercise()` | AIPrompts.js | GrammarCheckSkill (ext) |
| `createRewriteHtml...()` | AIPrompts.js | TextSimplifySkill |
| `getTranslatePrompt()` | translate/PromptUtil.js → **MOVE** | TranslateSkill |
| `getNLPAnnotationPrompt()` | translate/PromptUtil.js → **MOVE** | TranslateSkill |
| `getVerbComparisonPrompt()` | translate/PromptUtil.js → **MOVE** | VerbCompareSkill |
