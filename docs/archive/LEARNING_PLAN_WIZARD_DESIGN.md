# Learning Plan Setup Wizard - Implementation Plan

## 1. Core Abstraction: Universal Learning Points

### Philosophy

Any learning goal can be decomposed into **Learning Points** - atomic units of knowledge represented as **cards** for spaced repetition.

```
┌─────────────────────────────────────────────────────────────┐
│                     LEARNING GOAL                           │
│                  "Master GRE Vocabulary"                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   LEARNING MATERIAL                         │
│              (Book, Word List, Course, URL)                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   LEARNING POINTS                           │
│    ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│    │Card 1│ │Card 2│ │Card 3│ │Card 4│ │ ...  │           │
│    └──────┘ └──────┘ └──────┘ └──────┘ └──────┘           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              USER COMMITMENT + DEADLINE                     │
│         "30 min/day, complete by June 1st"                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   GENERATED PLAN                            │
│     Phase 1 (Days 1-30): Learn 500 words                    │
│     Phase 2 (Days 31-60): Review + remaining 300            │
│     Daily: 10 new cards + 20 review cards                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              EXECUTE WITH SPACED REPETITION                 │
│                    (Leitner / FSRS)                         │
└─────────────────────────────────────────────────────────────┘
```

### Domain Examples

| Domain | Learning Material | Learning Points (Cards) |
|--------|------------------|------------------------|
| Vocabulary | GRE Word List | Word → Definition, Usage, Synonyms |
| Programming | API Documentation | Concept → Explanation, Code Example |
| History | Textbook Chapter | Event → Date, Cause, Consequence |
| Math | Formula Sheet | Formula → Derivation, Application |
| Language | Grammar Guide | Rule → Pattern, Examples, Exercises |
| Medicine | Anatomy Atlas | Term → Location, Function, Relations |

---

## 2. Data Model: UniversalLearningPoint

### New Interface (extends existing plan item)

```typescript
// src/commons/model/UniversalLearningPoint.ts

interface UniversalLearningPoint {
  // === Identification ===
  id: string;                    // UUID, unique across all types
  itemType: LearningPointType;   // word, concept, formula, rule, fact, technique
  domainType: DomainType;        // vocabulary, math, language, knowledge, skill

  // === Card Content ===
  front: CardContent;            // Question/prompt side
  back: CardContent;             // Answer/explanation side
  extras?: Record<string, any>;  // Domain-specific extra fields

  // === Metadata ===
  difficulty: DifficultyLevel;   // beginner, intermediate, advanced
  estimatedTimeMinutes: number;  // Time to learn this point
  tags?: string[];               // User-defined tags

  // === Learning Mechanics ===
  prerequisites?: string[];      // IDs of prerequisite items
  relatedItems?: string[];       // IDs of related items

  // === Status (managed by plan) ===
  status: 'pending' | 'learning' | 'reviewing' | 'mastered';
  masteryLevel: number;          // 0-100
  scheduledDay?: number;         // Day in plan when introduced

  // === Spaced Repetition (synced with sr_item) ===
  srItemId?: string;             // Link to sr_item table
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
  correctStreak: number;

  // === Source Reference ===
  sourceType?: 'vocabulary' | 'note' | 'quiz' | 'book' | 'url' | 'manual' | 'ai_generated';
  sourceId?: string;             // ID in source table
  sourceContext?: string;        // Page number, chapter, URL path

  // === AI Generation ===
  generatedBy?: string;          // AI provider used
  generationPrompt?: string;     // Prompt used (for regeneration)
  confidence?: number;           // AI confidence score
}

interface CardContent {
  text: string;                  // Main text (supports markdown)
  html?: string;                 // Rich HTML content
  image?: string;                // Image URL or base64
  audio?: string;                // Audio URL (for pronunciation)
  latex?: string;                // LaTeX formula
}

type LearningPointType =
  | 'word'           // Vocabulary word
  | 'concept'        // Abstract concept
  | 'formula'        // Mathematical formula
  | 'rule'           // Grammar/logic rule
  | 'fact'           // Historical fact, date, etc.
  | 'technique'      // Skill or procedure
  | 'example'        // Worked example
  | 'problem'        // Practice problem
  | 'definition'     // Term definition
  | 'relationship';  // Connection between concepts
```

### Mapping to Existing Tables

```
UniversalLearningPoint
        │
        ├── sourceType: 'vocabulary' → vocabulary table
        ├── sourceType: 'note' → note_json table
        ├── sourceType: 'quiz' → quiz_problem table
        ├── sourceType: 'book' → book table (highlights)
        └── sourceType: 'manual' → stored in plan_data.items

        │
        └── srItemId → sr_item table (for FSRS tracking)
```

---

## 3. Wizard Flow: 5-Step Process

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: GOAL        What do you want to learn?            │
├─────────────────────────────────────────────────────────────┤
│  Step 2: MATERIAL    Where will learning points come from? │
├─────────────────────────────────────────────────────────────┤
│  Step 3: IMPORT      Add/generate learning points          │
├─────────────────────────────────────────────────────────────┤
│  Step 4: COMMITMENT  How much time? What's the deadline?   │
├─────────────────────────────────────────────────────────────┤
│  Step 5: REVIEW      Confirm plan and start                │
└─────────────────────────────────────────────────────────────┘
```

---

### Step 1: Define Learning Goal

**Purpose**: Capture the high-level learning objective

**UI Components**:
```
┌─────────────────────────────────────────────────────────────┐
│  What do you want to learn?                                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Goal Name: [ Master GRE Vocabulary______________ ]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Select Domain:                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 📚       │ │ 📐       │ │ 🗣️       │ │ 💡       │      │
│  │Vocabulary│ │   Math   │ │ Language │ │Knowledge │      │
│  │ ✓ (sel)  │ │          │ │          │ │          │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  Description (optional):                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Prepare for GRE exam, targeting 160+ verbal score  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                      [Cancel] [Next →]      │
└─────────────────────────────────────────────────────────────┘
```

**Data Captured**:
```typescript
{
  name: string;           // Required
  domainType: DomainType; // Required
  description?: string;   // Optional
}
```

---

### Step 2: Select Learning Material

**Purpose**: Choose the source of learning points

**UI Components**:
```
┌─────────────────────────────────────────────────────────────┐
│  Where will your learning material come from?               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ○ Import from file (CSV, TXT, JSON)                 │   │
│  │   [Choose File...]  vocabulary_list.csv             │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ○ Select existing book from library                 │   │
│  │   [Select Book ▼]   "Barron's GRE Word List"       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ○ Use existing vocabulary set                       │   │
│  │   [Select Set ▼]    "My GRE Words (234 items)"     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ○ Generate from URL                                 │   │
│  │   [Enter URL...]    https://example.com/gre-words   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ● Enter manually / Use AI to generate               │   │
│  │   "I'll add items in the next step"                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Preview: 0 learning points detected                        │
│                                                             │
│                                [← Back] [Cancel] [Next →]   │
└─────────────────────────────────────────────────────────────┘
```

**Source Types**:
| Source | Parsing | Learning Points |
|--------|---------|-----------------|
| CSV/TXT File | Parse columns | word,definition → cards |
| JSON File | Parse structure | Flexible schema |
| Existing Book | Extract highlights/annotations | Highlight → card |
| Vocabulary Set | Link existing | Vocabulary records |
| URL | Fetch + AI extract | AI-generated cards |
| Manual/AI | User input or generation | Created in Step 3 |

**Data Captured**:
```typescript
{
  sourceType: 'file' | 'book' | 'vocabulary_set' | 'url' | 'manual';
  sourceId?: string;    // Book ID, vocabulary set ID
  sourceFile?: File;    // Uploaded file
  sourceUrl?: string;   // URL for extraction
  parsedItems?: UniversalLearningPoint[];  // Pre-parsed items
}
```

---

### Step 3: Import/Create Learning Points

**Purpose**: Add, edit, or generate learning points

**UI Components** (Tabs):

```
┌─────────────────────────────────────────────────────────────┐
│  Add Learning Points                                        │
│                                                             │
│  ┌──────────────┬───────────────┬────────────────────┐     │
│  │ Bulk Import  │ Single Entry  │ AI Generate        │     │
│  └──────────────┴───────────────┴────────────────────┘     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Paste your vocabulary list (one per line):          │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ aberrant - markedly different from norm         │ │   │
│  │ │ abjure - to reject or renounce                  │ │   │
│  │ │ abnegation - self-denial                        │ │   │
│  │ │ ...                                             │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │ Format: [word] - [definition]   [Parse & Preview]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Learning Points (342 items)           [+ Add] [🔄]   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ☑ aberrant      markedly different from...  [Edit] │   │
│  │ ☑ abjure        to reject or renounce...    [Edit] │   │
│  │ ☑ abnegation    self-denial...              [Edit] │   │
│  │ ☐ abscond       (pending AI generation...)  [Gen]  │   │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Selected: 340/342    [AI Enhance Selected] [Remove]       │
│                                                             │
│                                [← Back] [Cancel] [Next →]   │
└─────────────────────────────────────────────────────────────┘
```

**AI Generation Tab**:
```
┌─────────────────────────────────────────────────────────────┐
│  Generate Learning Points with AI                           │
│                                                             │
│  Describe what you want to learn:                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Generate 50 most common GRE vocabulary words that   │   │
│  │ start with letters A-C, with definitions, examples, │   │
│  │ and synonyms.                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Number of items: [ 50 ▼ ]    Difficulty: [ Mixed ▼ ]      │
│                                                             │
│  [🤖 Generate with AI]                                      │
│                                                             │
│  Generation Progress: ████████░░ 80% (40/50)               │
└─────────────────────────────────────────────────────────────┘
```

**Data Captured**:
```typescript
{
  items: UniversalLearningPoint[];  // All learning points
  totalCount: number;
  aiEnhanced: number;  // Count of AI-enhanced items
}
```

---

### Step 4: Set Commitment & Schedule

**Purpose**: Define time commitment and deadline

**UI Components**:
```
┌─────────────────────────────────────────────────────────────┐
│  How much time can you commit?                              │
│                                                             │
│  Daily Study Time:                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  15 min   30 min   45 min   60 min   Custom        │   │
│  │    ○        ●        ○        ○       ○            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Target Completion Date:                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ○ I have a deadline: [ June 1, 2025      📅 ]       │   │
│  │ ● No deadline (flexible pace)                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Preferred Study Time:                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 🌅       │ │ ☀️       │ │ 🌆       │ │ 🌙       │      │
│  │ Morning  │ │Afternoon │ │ Evening  │ │ Anytime  │      │
│  │          │ │          │ │    ✓     │ │          │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  📊 Plan Preview:                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • 342 learning points                               │   │
│  │ • 30 minutes/day × ~34 days                         │   │
│  │ • ~10 new cards + ~20 reviews per session           │   │
│  │ • Estimated completion: April 15, 2025              │   │
│  │                                                     │   │
│  │ Timeline:                                           │   │
│  │ Week 1-2: Learn 100 words (Phase 1)                │   │
│  │ Week 3-4: Learn 150 words + review (Phase 2)       │   │
│  │ Week 5+:  Remaining + intensive review (Phase 3)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                [← Back] [Cancel] [Next →]   │
└─────────────────────────────────────────────────────────────┘
```

**Plan Calculation Algorithm**:
```typescript
function calculatePlan(items: number, dailyMinutes: number, deadline?: Date): PlanPreview {
  const itemsPerMinute = getDomainConfig(domainType).defaultItemsPerSession /
                         getDomainConfig(domainType).defaultDailyMinutes;

  const newItemsPerDay = Math.floor(dailyMinutes * itemsPerMinute * 0.4);  // 40% new
  const reviewsPerDay = Math.floor(dailyMinutes * itemsPerMinute * 0.6);   // 60% review

  const daysToComplete = Math.ceil(items / newItemsPerDay);
  const estimatedCompletion = addDays(new Date(), daysToComplete);

  // Check if deadline is feasible
  if (deadline && estimatedCompletion > deadline) {
    // Suggest increased daily time
    const requiredDays = differenceInDays(deadline, new Date());
    const requiredNewPerDay = Math.ceil(items / requiredDays);
    // ...
  }

  return {
    newItemsPerDay,
    reviewsPerDay,
    daysToComplete,
    estimatedCompletion,
    phases: generatePhases(items, daysToComplete),
    feasibility: checkFeasibility(deadline, estimatedCompletion)
  };
}
```

**Data Captured**:
```typescript
{
  dailyTimeMinutes: number;
  targetDate?: string;         // ISO date
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'any';
  calculatedPlan: {
    newItemsPerDay: number;
    reviewsPerDay: number;
    estimatedDays: number;
    phases: Phase[];
  }
}
```

---

### Step 5: Review & Create Plan

**Purpose**: Final confirmation and plan creation

**UI Components**:
```
┌─────────────────────────────────────────────────────────────┐
│  Review Your Learning Plan                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📚 Master GRE Vocabulary                            │   │
│  │                                                     │   │
│  │ Domain: Vocabulary                                  │   │
│  │ Learning Points: 342 items                          │   │
│  │ Daily Commitment: 30 minutes                        │   │
│  │ Target Date: June 1, 2025                           │   │
│  │ Estimated Duration: 34 days                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Learning Schedule                                   │   │
│  │                                                     │   │
│  │ Phase 1: Foundation (Days 1-12)                    │   │
│  │ ├── 120 new words                                   │   │
│  │ └── Focus: Basic definitions                        │   │
│  │                                                     │   │
│  │ Phase 2: Building (Days 13-24)                     │   │
│  │ ├── 120 new words + reviews                         │   │
│  │ └── Focus: Usage and examples                       │   │
│  │                                                     │   │
│  │ Phase 3: Mastery (Days 25-34)                      │   │
│  │ ├── 102 new words + intensive review                │   │
│  │ └── Focus: Synonyms and nuances                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ☑ Send me daily reminders                                 │
│  ☑ Sync progress across devices                            │
│                                                             │
│                    [← Back] [Cancel] [🚀 Start Learning]   │
└─────────────────────────────────────────────────────────────┘
```

**Actions on Create**:
1. Create `learning_topic` record
2. Create `learning_plan` record with full `plan_data`
3. Create `sr_item` records for each learning point
4. Schedule notifications if enabled
5. Navigate to learning dashboard or first session

---

## 4. Implementation Phases

### Phase 1: Core Infrastructure (Backend)

**Files to Create/Modify**:

| File | Action | Description |
|------|--------|-------------|
| `src/commons/model/UniversalLearningPoint.ts` | Create | Type definitions |
| `src/main/utils/LearningPlanGenerator.js` | Create | Plan calculation algorithm |
| `src/main/utils/LearningPointImporter.js` | Create | Parse files, extract from books |
| `src/main/ipc/learningWizardHandlers.js` | Create | IPC handlers for wizard |
| `src/renderer/api/learningWizardApi.js` | Create | Renderer API |

**Key Functions**:
```javascript
// LearningPlanGenerator.js
class LearningPlanGenerator {
  calculatePlan(items, dailyMinutes, deadline, domainType)
  generatePhases(items, totalDays, domainConfig)
  distributeItems(items, phases)
  checkFeasibility(deadline, estimatedCompletion)
  adjustForDeadline(items, deadline, maxDailyMinutes)
}

// LearningPointImporter.js
class LearningPointImporter {
  parseCSV(content, options)
  parseJSON(content)
  parsePlainText(content, delimiter)
  extractFromBook(bookId, extractionType)
  extractFromVocabularySet(setId)
  extractFromURL(url)
  enhanceWithAI(items, domainType)
}
```

### Phase 2: Wizard UI Components

**Files to Create**:

| File | Description |
|------|-------------|
| `src/renderer/views/learning/LearningPlanWizard.js` | Main wizard container |
| `src/renderer/views/learning/steps/GoalStep.js` | Step 1: Goal definition |
| `src/renderer/views/learning/steps/MaterialStep.js` | Step 2: Material selection |
| `src/renderer/views/learning/steps/ImportStep.js` | Step 3: Import/create items |
| `src/renderer/views/learning/steps/CommitmentStep.js` | Step 4: Time commitment |
| `src/renderer/views/learning/steps/ReviewStep.js` | Step 5: Review & create |
| `src/renderer/components/learning/DomainSelector.js` | Domain cards component |
| `src/renderer/components/learning/LearningPointTable.js` | Editable item table |
| `src/renderer/components/learning/PlanPreview.js` | Visual plan preview |
| `src/renderer/components/learning/BulkImportPanel.js` | Bulk import with progress |

### Phase 3: Integration & Polish

**Tasks**:
1. Add route `/learning/new` for wizard
2. Add "Create Learning Plan" button to relevant views
3. Connect wizard completion to learning dashboard
4. Add progress tracking to existing session UI
5. Implement notification scheduling
6. Add plan editing capability (modify existing plans)

---

## 5. Gap Analysis vs Existing System

### ✅ Already Implemented (Reuse)

| Component | Location | Usage in Wizard |
|-----------|----------|-----------------|
| Learning Topic CRUD | `LearningTopicManager.js` | Step 5: Create topic |
| Learning Plan CRUD | `LearningPlanManager.js` | Step 5: Create plan |
| SR Item Management | `SpacedRepetitionService.js` | Sync learning points |
| Domain Configurations | `LearningDomains.ts` | Step 1: Domain defaults |
| Learner Profile | `LearnerProfileManager.js` | Personalization |
| Notifications | `NotificationManager.js` | Reminders |
| Leitner UI Components | `LeitnerSystem/*` | Review sessions |
| AI Provider | `AIProviderManager.js` | AI generation |

### 🔸 Needs Implementation

| Component | Effort | Priority |
|-----------|--------|----------|
| UniversalLearningPoint model | Small | High |
| LearningPlanGenerator | Medium | High |
| LearningPointImporter (file parsing) | Medium | High |
| Wizard UI (5 steps) | Large | High |
| AI bulk generation for learning points | Medium | Medium |
| Plan preview visualization | Small | Medium |
| Book highlight extraction | Medium | Low |
| URL content extraction | Medium | Low |

### 🔹 Optional Enhancements

| Enhancement | Description |
|-------------|-------------|
| Plan templates | Pre-built plans for common goals (GRE, TOEFL, etc.) |
| Social plans | Share plans with study groups |
| Adaptive replanning | AI adjusts plan based on performance |
| Calendar integration | Sync with Google/Apple Calendar |
| Progress gamification | Badges, streaks, leaderboards |

---

## 6. UI/UX Design Principles

### Wizard Best Practices

1. **Progressive Disclosure**: Only show relevant options based on previous choices
2. **Smart Defaults**: Pre-fill based on domain type and learner profile
3. **Validation Feedback**: Inline validation with helpful suggestions
4. **Reversibility**: Allow going back and changing any step
5. **Preview**: Always show impact of choices before committing
6. **Mobile-Friendly**: Steps should work on smaller screens

### Visual Hierarchy

```
Primary Action:  [🚀 Start Learning]  (prominent, colored)
Secondary:       [Next →] [← Back]    (outlined)
Tertiary:        [Cancel]             (text only)
```

### Color Coding by Domain

```javascript
const DOMAIN_COLORS = {
  vocabulary: { primary: '#4CAF50', light: '#E8F5E9' },  // Green
  math:       { primary: '#2196F3', light: '#E3F2FD' },  // Blue
  language:   { primary: '#9C27B0', light: '#F3E5F5' },  // Purple
  knowledge:  { primary: '#FF9800', light: '#FFF3E0' },  // Orange
  skill:      { primary: '#00BCD4', light: '#E0F7FA' },  // Cyan
};
```

---

## 7. Success Metrics

### User Experience

- Time to complete wizard: < 5 minutes
- Drop-off rate per step: < 20%
- Plan completion rate: > 60%

### Learning Effectiveness

- Daily streak maintenance: > 70% of users
- Items reaching mastery: > 80%
- User satisfaction score: > 4/5

---

## 8. Summary

The Learning Plan Setup Wizard bridges the gap between **"I want to learn X"** and **"I'm actively learning X"** by:

1. **Abstracting** learning content into universal **Learning Points** (cards)
2. **Guiding** users through goal → material → items → commitment → plan
3. **Generating** feasible plans with spaced repetition scheduling
4. **Integrating** with existing Leitner/FSRS systems for execution
5. **Tracking** progress through the comprehensive learning framework

The existing SmartReader infrastructure provides 80%+ of the backend capability. The primary work is:
- Designing the **wizard UI** (5 step components)
- Implementing the **plan generator** algorithm
- Building the **import/parsing** utilities
- Creating the **UniversalLearningPoint** abstraction layer
