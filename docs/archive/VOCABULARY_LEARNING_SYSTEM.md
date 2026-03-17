# SmartReader v2 - Vocabulary Learning System

## Executive Summary

SmartReader v2 implements a comprehensive vocabulary learning system that integrates:
1. **Multi-point vocabulary import** - Settings, vocabulary panel, navigation bar, browser context menu
2. **AI-powered learning** - LLM uses vocabulary words to generate constrained output
3. **Visual highlighting** - Keywords highlighted in markdown rendering and animations
4. **Spaced repetition** - Leitner system with 5 boxes for flashcard learning

---

## Table of Contents

1. [Vocabulary Import & Creation](#1-vocabulary-import--creation)
2. [Storage Architecture](#2-storage-architecture)
3. [AI Integration - Vocabulary-Aware Generation](#3-ai-integration---vocabulary-aware-generation)
4. [Highlighting System](#4-highlighting-system)
5. [Leitner Spaced Repetition System](#5-leitner-spaced-repetition-system)
6. [Skill System Integration](#6-skill-system-integration)
7. [Animation Effects](#7-animation-effects)
8. [Creative Enhancement Ideas](#8-creative-enhancement-ideas)

---

## 1. Vocabulary Import & Creation

### 1.1 Settings Panel - Keywords Import

**Location**: [SettingsPanel.js:1665-1690](src/renderer/views/settings/SettingsPanel.js#L1665-L1690)

The settings panel provides bulk keyword import functionality:

```
Settings → Study Configuration → Keywords Management
```

**Features:**
- **Study Mode Selector**: General, Language Study, Mathematics, Programming
- **Import Keywords**: File-based bulk import (one word per line)
- **WordListManagerUI**: Visual management of imported keywords

**Key Files:**
| File | Purpose |
|------|---------|
| [SettingsPanel.js](src/renderer/views/settings/SettingsPanel.js) | Main settings UI |
| [WordListManagerUI.js](src/renderer/views/settings/WordListManagerUI.js) | Word list CRUD |

### 1.2 Vocabulary Panel - Single/Bulk Creation

**Location**: [CreateVocabularyModal.js](src/renderer/views/vocabulary/CreateVocabularyModal.js)

**Tab 1: Single Word Creation**
```
┌────────────────────────────────────────┐
│  Word: [input field] [🤖 AI Generate]  │
│  Definition: [multiline textarea]       │
│  Related Words: [input field]           │
│  Example Sentence: [textarea]           │
│                                         │
│  [Cancel]  [Save Vocabulary]            │
└────────────────────────────────────────┘
```

**Tab 2: Bulk Import**
- Multi-line text input for multiple words
- Format support:
  - `word` - AI generates definition
  - `word: definition` - Colon separator
  - `word = definition` - Equals separator
- Progress tracking with status chips (ready/pending/error)
- Batch AI generation for pending words

### 1.3 VocabularyListView - Quick Creation

**Location**: [VocabularyListView.js](src/renderer/views/vocabulary/VocabularyListView.js)

Three creation methods:
1. **Search**: `searchIt()` - Search existing vocabulary
2. **AI Create**: `createNewVocabularyByAI()` - One-click AI generation (3-30 chars)
3. **Manual**: `createNewVocabulary()` - Opens dialog for manual entry

```javascript
// One-click AI creation flow
const createNewVocabularyByAI = async () => {
  const exist = await customStorage.getVocabularyByName(text);
  if (!exist) {
    await customStorage.addToVocabulary(text); // Triggers AI generation
  }
};
```

### 1.4 Browser Context Menu - Selection-Based Creation

**Location**: [CreateVocabularyDialog.js](src/renderer/views/browser/CreateVocabularyDialog.js)

When user selects text (3-30 characters) in browser:
1. Context menu shows "Create Vocabulary Card"
2. Checks if word already exists: `customStorage.getVocabularyByName(text)`
3. If new, triggers AI generation: `customStorage.addToVocabulary(text)`
4. Shows popup with definition, etymology, example

**Context Menu Integration:**
```javascript
// Browser.js context menu handler
const handleVocabularyFromSelection = async (selectedText) => {
  const existing = await customStorage.getVocabularyByName(selectedText);
  if (!existing) {
    await customStorage.addToVocabulary(selectedText);
  }
  setShowVocabularyDialog(true);
};
```

### 1.5 Add to Keywords (Chat/Message)

**Location**: [MessageItem.tsx:310-314](src/renderer/components/chat/MessageItem.tsx#L310-L314)

In AI chat responses, users can select text and add to keyword list:
```javascript
const addToKeyWordList = async () => {
  const studyMode = await customStorage.getStudyMode() || StudyMode.General;
  customStorage.addToKeyWordList(studyMode, selectedText);
};
```

---

## 2. Storage Architecture

### 2.1 Database Schema

**Location**: [db.sql](db.sql)

```sql
-- Vocabulary cards with full details
CREATE TABLE "vocabulary" (
  "id"             INTEGER PRIMARY KEY AUTOINCREMENT,
  "word"           TEXT,
  "definition"     TEXT,       -- AI-generated definition
  "related_words"  TEXT,       -- Synonyms, etymology, root
  "example"        TEXT,       -- Example sentence
  "set_id"         INTEGER,    -- Vocabulary set grouping
  "leitner_item_id" INTEGER,   -- Links to spaced repetition
  "created_at"     TEXT,
  "user_id"        INTEGER
);

-- Spaced repetition tracking
CREATE TABLE "leitner_item" (
  "id"           INTEGER PRIMARY KEY AUTOINCREMENT,
  "type"         INTEGER,      -- 0=vocabulary, other=note
  "box"          INTEGER,      -- 1-5 Leitner boxes
  "skips"        INTEGER,      -- Correct streak count
  "flips"        INTEGER,      -- Incorrect/flip count
  "next_review"  TEXT,         -- ISO datetime for next review
  "fully_learned" INTEGER,     -- Boolean: mastered flag
  "score"        INTEGER
);

-- Vocabulary groupings
CREATE TABLE "vocabulary_set" (
  "id"         INTEGER PRIMARY KEY AUTOINCREMENT,
  "name"       TEXT,
  "score"      INTEGER,
  "last_time_at" TEXT,
  "created_at" TEXT,
  "user_id"    INTEGER
);
```

### 2.2 Keywords Storage (electron-store)

**Location**: [main.ts:719-756](src/main/main.ts#L719-L756)

Keywords are stored per study mode per user using electron-store:
```javascript
// Storage key pattern
`keywords_${studyMode}_${userId}`

// Maximum 50 keywords per mode (LRU eviction)
// Words are stemmed using Porter Stemmer before storage
```

**IPC Handlers:**
| Handler | Purpose |
|---------|---------|
| `getKeyWordList` | Retrieve keywords for mode |
| `addToKeyWordList` | Add word(s) with stemming |
| `setKeyWordList` | Replace entire list |
| `removeFromKeyWordList` | Remove specific words |

### 2.3 VocabularyManager API

**Location**: [VocabularyManager.js](src/main/db/VocabularyManager.js)

| Method | Purpose |
|--------|---------|
| `createVocabulary(vocab, token)` | Create vocab + Leitner item (box 1) |
| `getVocabularyById(id, token)` | Fetch by ID with Leitner data |
| `getVocabularyByName(name, token)` | Lookup to prevent duplicates |
| `getVocabulariesByQuery(query, page, limit, token)` | Search with pagination |
| `getVocabulariesByDueReview(time, page, limit, token)` | Get items due for review |
| `updateVocabulary(id, field, value, token)` | Update single field |
| `deleteVocabularyById(id, token)` | Delete vocab + cascade Leitner |

---

## 3. AI Integration - Vocabulary-Aware Generation

### 3.1 Vocabulary Definition Prompt

**Location**: [AIPrompts.js:309-318](src/commons/utils/AIPrompts.js#L309-L318)

When creating a vocabulary card via AI:
```javascript
const createVocabularyPrompt = (vocabulary, readerLevel) => {
  // Returns JSON:
  // {
  //   "definition": "...",     // Level-appropriate definition
  //   "root": "...",           // Etymology/word origins
  //   "example": "..."         // Context sentence
  // }
};
```

Reader level influences definition complexity:
- Elementary: Simple words, basic sentences
- Middle: More vocabulary, compound sentences
- High School: Academic vocabulary, complex structures
- College: Sophisticated, technical definitions

### 3.2 Smart Summary - Vocabulary-Constrained Output

**Location**: [AIPrompts.js:397-426](src/commons/utils/AIPrompts.js#L397-L426)

The **Smart Summary** feature generates summaries using ONLY:
1. Words from the original source text
2. User's learning vocabulary words (prioritized)

```javascript
const createSmartSummaryPrompt = (text, vocabularyWords = []) => {
  // Constraints:
  // - Use ONLY words from source text OR learning vocabulary
  // - Vocabulary words MUST be used if they fit naturally
  // - NO synonyms or paraphrasing allowed

  // Returns JSON:
  // {
  //   "summary": "concise summary",
  //   "words": ["array", "of", "words"],
  //   "vocabularyUsed": ["vocab", "words", "used"]
  // }
};
```

**Purpose**: Enables "flying words" animation where vocabulary words visually fly from source to summary.

### 3.3 AI Provider Integration Points

Multiple views integrate vocabulary into AI generation:

| View | Integration |
|------|-------------|
| [Browser.js](src/renderer/views/browser/Browser.js) | Smart Summary with vocabulary |
| [InContextChatPanel.js](src/renderer/components/chat/InContextChatPanel.js) | Vocabulary in system prompt |
| [ChatDetailPanel.js](src/renderer/views/chat/ChatDetailPanel.js) | Keywords in chat context |
| [MessageItem.tsx](src/renderer/components/chat/MessageItem.tsx) | Smart Summary from messages |

---

## 4. Highlighting System

### 4.1 Markdown Rendering - Keyword Highlighting

**Location**: [KeywordsColorPlugin.js](src/main/utils/KeywordsColorPlugin.js)

A markdown-it plugin that automatically bolds keywords in rendered content:

```javascript
// Process: Parse markdown → Find keywords → Wrap in <strong>
md.core.ruler.push('bold_keywords', (state) => {
  keywords.forEach((keyword) => {
    const word = stem2word[keyword]; // Match stemmed form
    if (regex.test(content)) {
      // Replace with <strong>word</strong>
    }
  });
});
```

### 4.2 Word Frequency Coloring

**Location**: [WordFrequencyColorPlugin.js](src/main/utils/WordFrequencyColorPlugin.js)

Colors words based on frequency level (import from Settings):
```javascript
// Data structure for word colors
// 'word_colors' => { levels: {[name]: id}, colors: {[id]: color}, words: {[id]: [word]} }

md.core.ruler.push('color_keywords', (state) => {
  levelIds.forEach((levelId) => {
    const color = colors[levelId];
    // <span style="color:${color}">word</span>
  });
});
```

**Use Case**: Visual vocabulary tiers (e.g., red=difficult, green=common)

### 4.3 Smart Summary Visual Highlighting

In Smart Summary mode, vocabulary words receive special visual treatment:

| Word Type | Visual Effect |
|-----------|---------------|
| Learning Vocabulary | Gold glow (#FFD700) |
| Regular Source Words | Blue glow (#2196F3) |
| Non-matching Words | 50% opacity fade |

---

## 5. Leitner Spaced Repetition System

### 5.1 Box Structure & Intervals

**Location**: [LeitnerSystem.js](src/renderer/components/LeitnerSystem/LeitnerSystem.js)

| Box | Name | Review Interval | Color |
|-----|------|-----------------|-------|
| 1 | New | 1 day | Red (#F44336) |
| 2 | Learning | 2 days | Orange (#FF9800) |
| 3 | Reviewing | 4 days | Amber (#FFC107) |
| 4 | Familiar | 1 week | Green (#4CAF50) |
| 5 | Mastered | 2 weeks | Blue (#2196F3) |

### 5.2 FlipCard Component

**Location**: [FlipCard.js](src/renderer/components/LeitnerSystem/FlipCard.js)

**Vocabulary Mode Front:**
```
┌────────────────────────────────────────┐
│  What does this word mean?             │
│                                        │
│         [EPHEMERAL]                    │
│                                        │
│  [✓ I know this!]    [🔄 Flip]         │
└────────────────────────────────────────┘
```

**Vocabulary Mode Back:**
```
┌────────────────────────────────────────┐
│  Definition                            │
│  ──────────────────────────────────    │
│  ephemeral                             │
│  lasting for a very short time         │
│                                        │
│  📚 from Greek ephēmeros               │
│                                        │
│  "The ephemeral beauty of cherry       │
│   blossoms reminds us..."              │
│                                        │
│  [✓ Got it!] [🔄 Back] [✗ Need more]   │
└────────────────────────────────────────┘
```

### 5.3 Box Transition Logic

**Correct Answer:**
```javascript
const handleCorrect = async (card) => {
  card.leitnerItem.skips++;

  // Every N skips (based on leitnerSpeed), move to next box
  if (card.leitnerItem.skips >= threshold) {
    card.leitnerItem.box = Math.min(5, card.leitnerItem.box + 1);
    card.leitnerItem.skips = 0;
  }

  // Update next_review based on new box
  card.leitnerItem.nextReview = calculateNextReview(card.leitnerItem.box);

  // After 5 skips in Box 5: Mark fully learned
  if (card.leitnerItem.box === 5 && card.leitnerItem.skips >= 5) {
    card.leitnerItem.fullLearned = true;
  }
};
```

**Incorrect Answer:**
```javascript
const handleIncorrect = async (card, justFlipped) => {
  card.leitnerItem.flips++;

  if (!justFlipped) {
    card.leitnerItem.box = 1; // Reset to Box 1
  }

  card.leitnerItem.nextReview = calculateNextReview(1); // +1 day
};
```

### 5.4 Leitner Speed Settings

**Location**: [DataTypes.js](src/commons/model/DataTypes.js)

| Speed | Correct Answers to Advance |
|-------|---------------------------|
| Fast | 1 correct |
| Normal | 2 correct |
| Slow | 3 correct |

---

## 6. Skill System Integration

### 6.1 VocabularySkill (AI Lookup)

**Location**: [VocabularySkill.js](src/main/skills/ai/VocabularySkill.js)

```javascript
// Parameters
{
  word: string,           // Required: word to define
  context: string,        // Optional: sentence context
  includeRoot: boolean,   // Default: true
  includeExamples: boolean, // Default: true
  exampleCount: number    // Default: 1
}

// Returns
{
  word: "ephemeral",
  partOfSpeech: "adjective",
  pronunciation: "/ɪˈfem(ə)rəl/",
  definition: "lasting for a very short time",
  root: "Greek ephēmeros 'lasting only a day'",
  examples: ["The ephemeral beauty..."],
  synonyms: ["fleeting", "transient"],
  antonyms: ["permanent", "enduring"]
}
```

### 6.2 CreateVocabularySkill (Persistence)

**Location**: [CreateVocabularySkill.js](src/main/skills/data/CreateVocabularySkill.js)

```javascript
// Parameters
{
  word: string,           // Required
  definition: string,     // Required
  example: string,        // Optional
  relatedWords: string,   // Optional
  setId: number           // Optional
}

// Returns
{
  vocabularyId: 123,
  word: "ephemeral",
  leitnerBox: 1,
  nextReviewDate: "2024-01-16T00:00:00Z",
  isNew: true
}
```

### 6.3 SmartSummarySkill

**Location**: [SmartSummarySkill.js](src/main/skills/ai/SmartSummarySkill.js)

```javascript
// Parameters
{
  text: string,              // Required
  vocabularyWords: string[], // Learning vocabulary
  maxWords: number           // Default: 20
}

// Returns
{
  summary: "...",
  words: ["word", "array"],
  vocabularyUsed: ["vocab", "words"],
  sourceWordCount: 150,
  summaryWordCount: 25
}
```

### 6.4 SearchVocabularySkill & GetLeitnerDueSkill

**Location**: [SearchVocabularySkill.js](src/main/skills/data/SearchVocabularySkill.js), [GetLeitnerDueSkill.js](src/main/skills/data/GetLeitnerDueSkill.js)

```javascript
// Search vocabulary
await skillApi.executeSkill('search_vocabulary', { query: 'ephemeral' });

// Get items due for review
await skillApi.executeSkill('get_leitner_due', { itemType: 'vocabulary', limit: 20 });
```

---

## 7. Animation Effects

### 7.1 Flying Words Animation (Smart Summary)

**Locations:**
- [EPUBAdapter.js](src/renderer/components/animation-core/adapters/EPUBAdapter.js)
- [PDFAdapter.js](src/renderer/components/animation-core/adapters/PDFAdapter.js)
- [StudyEnhancerController.js](src/renderer/views/browser/study-enhancer/StudyEnhancerController.js)

**Animation Flow:**
1. Page dims with semi-transparent overlay
2. Source words wrap in spans for position tracking
3. Matching words glow (gold for vocabulary, blue for regular)
4. Non-matching words dim to 30% opacity
5. Summary container fades in at center
6. Word clones fly along Bezier curves from source to summary
7. Glow fades as words approach target

### 7.2 Leitner Card Transitions

**Location**: [FlipCard.css](src/renderer/components/LeitnerSystem/FlipCard.css)

```css
/* Correct answer animation */
@keyframes correct-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(76, 175, 80, 0); }
  50% { transform: scale(1.02); box-shadow: 0 0 20px rgba(76, 175, 80, 0.5); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(76, 175, 80, 0); }
}

/* Incorrect answer animation */
@keyframes incorrect-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}
```

### 7.3 Animation Core System

**Location**: [animation-core/](src/renderer/components/animation-core/)

Modular animation system with view-specific adapters:
- `useEPUBAnimations()` - For epub.js iframe
- `usePDFAnimations()` - For PDF.js text layers
- `useNoteAnimations()` - For Notes/Leitner flashcards

---

## 8. Creative Enhancement Ideas

### 8.1 Gamification Enhancements

#### 8.1.1 Achievement System
```javascript
const achievements = [
  { id: 'first_word', name: 'First Steps', desc: 'Learn your first word' },
  { id: 'streak_7', name: 'Weekly Warrior', desc: '7-day review streak' },
  { id: 'box5_10', name: 'Master of 10', desc: '10 words in Box 5' },
  { id: 'polyglot', name: 'Polyglot', desc: 'Learn words from 3+ languages' },
];
```

#### 8.1.2 Daily Challenges
- "Learn 5 new words today"
- "Review 20 cards without mistakes"
- "Use 3 vocabulary words in AI conversations"

#### 8.1.3 Vocabulary Streak & XP
- Daily streak tracking with streak freeze items
- XP for reviews, new words, perfect sessions
- Levels unlock new features/themes

### 8.2 Social & Collaborative Features

#### 8.2.1 Shared Vocabulary Sets
- Create and share vocabulary sets
- Import community-curated lists (TOEFL, GRE, HSK)
- Collaborative study groups

#### 8.2.2 Vocabulary Challenges
- Head-to-head vocabulary battles
- Leaderboards per vocabulary set
- Study group competitions

### 8.3 AI-Enhanced Learning

#### 8.3.1 Contextual Vocabulary Suggestions
```javascript
// While reading, suggest relevant vocabulary
const suggestVocabulary = async (pageContent) => {
  const userLevel = await customStorage.getReaderLevel();
  const existingVocab = await getVocabularyWords();

  return aiProvider.generateContentWithJson({
    prompt: `Analyze this text and suggest vocabulary appropriate for ${userLevel}:
    - Words that appear but user doesn't know
    - Related words that would enhance understanding
    - Exclude: ${existingVocab.join(', ')}`
  });
};
```

#### 8.3.2 Personalized Example Sentences
- Generate examples using user's interests
- Use context from recently read books
- Progressive difficulty based on mastery

#### 8.3.3 Vocabulary Usage Tracking
- Track when users successfully use vocabulary in writing
- Bonus XP for real-world usage
- "Vocabulary in Action" report

### 8.4 Visual & Interactive Enhancements

#### 8.4.1 Word Etymology Visualization
```
      ┌─────────────────────────────────────┐
      │         EPHEMERAL                    │
      │         /ɪˈfem(ə)rəl/                │
      └─────────────────────────────────────┘
                      │
              ┌───────┴───────┐
              │               │
         Greek: ephēmeros   Latin: ephemera
         "lasting a day"    "things lasting one day"
                │
         eph- (upon) + hēmera (day)
```

#### 8.4.2 Word Relationship Graph
- Neo4j-powered word connections
- Visualize synonyms, antonyms, word families
- Navigate vocabulary like a mind map

#### 8.4.3 AR/Spatial Vocabulary Review
- Place vocabulary cards in AR space
- Walk through "vocabulary rooms"
- Spatial memory association

### 8.5 Adaptive Learning Algorithms

#### 8.5.1 Forgetting Curve Optimization
```javascript
// Beyond simple box intervals, use actual forgetting curve
const calculateOptimalReview = (card) => {
  const halfLife = calculateHalfLife(card.history);
  const targetRetention = 0.9;

  return -halfLife * Math.log(targetRetention) / Math.log(2);
};
```

#### 8.5.2 Difficulty Adjustment
- Track which words are consistently difficult
- Adjust review frequency based on error patterns
- Group similar difficult words for focused review

#### 8.5.3 Time-of-Day Optimization
- Track when user performs best
- Suggest optimal study times
- Adjust difficulty based on time/energy

### 8.6 Multi-Modal Learning

#### 8.6.1 Audio Integration
- TTS pronunciation for all vocabulary
- Record user pronunciation for comparison
- Audio-only review mode (commute learning)

#### 8.6.2 Image Association
- Auto-generate or select images for words
- Visual memory palace integration
- Image-first flashcard mode

#### 8.6.3 Writing Practice
- Handwriting recognition for spelling
- Fill-in-the-blank exercises
- Sentence construction challenges

### 8.7 Cross-Platform Sync

#### 8.7.1 Mobile Companion App
- Sync vocabulary across devices
- Quick review during idle moments
- Push notifications for due reviews

#### 8.7.2 Browser Extension
- Highlight vocabulary on any webpage
- One-click vocabulary addition
- Reading assistance mode

### 8.8 Advanced Analytics

#### 8.8.1 Learning Insights Dashboard
```
┌─────────────────────────────────────────────────────┐
│  VOCABULARY INSIGHTS                     This Week  │
├─────────────────────────────────────────────────────┤
│  📈 Words Learned: 23 (+5 from last week)          │
│  🎯 Retention Rate: 87%                            │
│  🔥 Current Streak: 14 days                        │
│  📚 Reading Vocabulary Match: 45%                  │
│                                                     │
│  Most Difficult Words:                              │
│  • ephemeral (failed 4 times)                      │
│  • ubiquitous (failed 3 times)                     │
│                                                     │
│  Recommended Focus: Abstract concepts               │
└─────────────────────────────────────────────────────┘
```

#### 8.8.2 Progress Predictions
- "At this rate, you'll reach 1000 words by..."
- Mastery predictions per word
- Study time recommendations

### 8.9 Content Integration

#### 8.9.1 Book-Specific Vocabulary Lists
- Auto-extract vocabulary from imported books
- Pre-learn vocabulary before reading
- Track vocabulary coverage while reading

#### 8.9.2 Reading Level Progression
- Track vocabulary complexity over time
- Suggest books matching current level
- Gradual difficulty increase

### 8.10 Accessibility Features

#### 8.10.1 Dyslexia-Friendly Mode
- OpenDyslexic font option
- Larger letter spacing
- Color overlays

#### 8.10.2 Screen Reader Integration
- Full accessibility for flashcards
- Audio descriptions for visual elements
- Keyboard-only navigation

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        VOCABULARY DATA FLOW                               │
└──────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │  Settings   │    │ Vocabulary  │    │   Browser   │    │    Chat     │
  │   Panel     │    │    View     │    │ Context Menu│    │  Selection  │
  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
         │                  │                  │                  │
         │ Keywords Import  │ Create/Search    │ Quick Lookup     │ Add to KW
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                         IPC LAYER (preload.ts)                        │
  │   addToKeyWordList / addToVocabulary / createVocabulary              │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                         MAIN PROCESS (main.ts)                        │
  │                                                                       │
  │  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────┐   │
  │  │ electron-   │    │  AI Provider    │    │  VocabularyManager  │   │
  │  │   store     │    │   (generate)    │    │     (SQLite)        │   │
  │  │  keywords   │    │  definition     │    │   vocabulary +      │   │
  │  │  per mode   │    │  root/example   │    │   leitner_item      │   │
  │  └─────────────┘    └─────────────────┘    └─────────────────────┘   │
  └──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                        RENDERING LAYER                                │
  │                                                                       │
  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │
  │  │ KeywordsColor   │    │ Smart Summary   │    │ Leitner System  │   │
  │  │   Plugin        │    │ (vocab-aware)   │    │ (FlipCard)      │   │
  │  │ <strong>word    │    │ Flying Words    │    │ Spaced Review   │   │
  │  └─────────────────┘    └─────────────────┘    └─────────────────┘   │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| Category | File | Purpose |
|----------|------|---------|
| **UI** | [CreateVocabularyModal.js](src/renderer/views/vocabulary/CreateVocabularyModal.js) | Single/bulk vocabulary creation |
| | [VocabularyListView.js](src/renderer/views/vocabulary/VocabularyListView.js) | Vocabulary list with search |
| | [VocabularyView.js](src/renderer/views/vocabulary/VocabularyView.js) | Main vocabulary page |
| | [LeitnerSystem.js](src/renderer/components/LeitnerSystem/LeitnerSystem.js) | Spaced repetition container |
| | [FlipCard.js](src/renderer/components/LeitnerSystem/FlipCard.js) | Flashcard component |
| **Database** | [VocabularyManager.js](src/main/db/VocabularyManager.js) | SQLite CRUD operations |
| | [db.sql](db.sql) | Database schema |
| **AI** | [AIPrompts.js](src/commons/utils/AIPrompts.js) | Vocabulary/Summary prompts |
| | [VocabularySkill.js](src/main/skills/ai/VocabularySkill.js) | AI vocabulary lookup skill |
| | [SmartSummarySkill.js](src/main/skills/ai/SmartSummarySkill.js) | Vocabulary-constrained summary |
| **Rendering** | [KeywordsColorPlugin.js](src/main/utils/KeywordsColorPlugin.js) | Keyword highlighting in markdown |
| | [WordFrequencyColorPlugin.js](src/main/utils/WordFrequencyColorPlugin.js) | Word frequency coloring |
| **Animation** | [animation-core/](src/renderer/components/animation-core/) | Flying words animation system |
| | [StudyEnhancerController.js](src/renderer/views/browser/study-enhancer/StudyEnhancerController.js) | Browser animation injection |
| **Storage** | [customStorage.js](src/renderer/store/customStorage.js) | Client-side storage wrapper |
| | [main.ts](src/main/main.ts) | IPC handlers for keywords |
