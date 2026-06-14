## Learning Plan System

A comprehensive system for creating personalized learning plans with spaced repetition. Supports any learning goal decomposed into "learning points" (flashcard-style items).

### Architecture

```
Learning Plan Flow
├── UI Layer (Renderer)
│   ├── LearningPlanWizard.js      # 5-step wizard modal
│   ├── steps/GoalStep.js          # Step 1: Define goal & domain
│   ├── steps/MaterialStep.js      # Step 2: Select source material
│   ├── steps/ImportStep.js        # Step 3: Import/create items
│   ├── steps/CommitmentStep.js    # Step 4: Set time commitment
│   └── steps/ReviewStep.js        # Step 5: Review & create
│
├── API Layer
│   └── learningPlanApi.js         # Renderer-side API
│
├── IPC Layer
│   └── learningPlanHandlers.js    # Main process handlers
│
├── Service Layer
│   ├── LearningPlanGenerator.js   # Schedule calculation (Leitner/FSRS)
│   ├── LearningPointImporter.js   # File parsing (CSV, JSON, TXT, Excel)
│   └── VectorManager.js           # Unified vector storage
│
└── Database Layer
    └── LearningPlanManager.js     # SQLite CRUD operations
```

### Key Files

| File | Purpose |
|------|---------|
| `src/renderer/views/learning/LearningPlanWizard.js` | Main wizard container with stepper |
| `src/renderer/views/learning/steps/*.js` | Individual step components |
| `src/renderer/api/learningPlanApi.js` | Renderer-side API |
| `src/main/ipc/learningPlanHandlers.js` | IPC handlers for plan operations |
| `src/main/utils/LearningPlanGenerator.js` | Schedule calculation service |
| `src/main/utils/LearningPointImporter.js` | File import/parsing service |
| `src/main/db/LearningPlanManager.js` | Database manager |

### 5-Step Wizard Flow

1. **GoalStep**: Define learning goal name and select domain type
   - Domains: vocabulary, math, language, knowledge, skill
   - Each domain has optimized learning parameters

2. **MaterialStep**: Select source material
   - File upload (CSV, JSON, TXT, Excel with drag-drop)
   - Library book selection
   - Existing vocabulary set
   - URL import (Quizlet, Anki Web, direct links)
   - Manual entry mode

3. **ImportStep**: Preview and edit learning items
   - Automatic file parsing with column mapping
   - Manual card creation form
   - Editable data table with pagination
   - Bulk editing capabilities

4. **CommitmentStep**: Set time commitment
   - Daily study time slider (5-120 minutes)
   - Optional target completion date
   - Preferred time of day (morning/afternoon/evening/flexible)
   - Real-time plan calculation preview

5. **ReviewStep**: Review and create plan
   - Summary of all selections
   - Additional settings (reminders, knowledge graph sync)
   - Create plan button with progress indicator

### Domain Types & Colors

```javascript
const DOMAIN_COLORS = {
  vocabulary: { primary: '#4CAF50', light: '#E8F5E9' },  // Green
  math: { primary: '#2196F3', light: '#E3F2FD' },       // Blue
  language: { primary: '#9C27B0', light: '#F3E5F5' },   // Purple
  knowledge: { primary: '#FF9800', light: '#FFF3E0' },  // Orange
  skill: { primary: '#00BCD4', light: '#E0F7FA' },      // Cyan
};
```

### Universal Learning Points

All learning content is normalized to "Universal Learning Points" - atomic units with:
- `front`: Question, term, or prompt
- `back`: Answer, definition, or response
- `tags`: Optional categorization
- `difficulty`: easy/medium/hard
- `source`: Origin (file, book, vocabulary, url, manual)

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `learning-plan-create` | invoke | Create new plan with items |
| `learning-plan-calculate` | invoke | Calculate schedule without creating |
| `learning-point-import-file` | invoke | Parse file (CSV, JSON, TXT, Excel) |
| `learning-point-extract-from-book` | invoke | Extract from library book |
| `learning-point-from-vocabulary` | invoke | Load from vocabulary set |
| `learning-point-import-url` | invoke | Import from web URL |
| `learning-plan-list` | invoke | Get all plans |
| `learning-plan-get` | invoke | Get single plan with details |
| `learning-plan-get-due` | invoke | Get items due for review |
| `learning-plan-record-review` | invoke | Record review result |
| `learning-plan-toggle-status` | invoke | Pause/resume plan |
| `learning-plan-delete` | invoke | Delete plan |

### Usage

**Open the wizard:**
```javascript
import { LearningPlanWizard } from '../views/learning';

<LearningPlanWizard
  open={showWizard}
  onClose={() => setShowWizard(false)}
  onComplete={(plan) => console.log('Created:', plan)}
/>
```

**Use the API directly:**
```javascript
import learningPlanApi from '../api/learningPlanApi';

// Create a plan
const result = await learningPlanApi.createPlan({
  goalName: 'GRE Vocabulary',
  domainType: 'vocabulary',
  learningPoints: [...],
  dailyMinutes: 30,
});

// Get due items
const due = await learningPlanApi.getDueItems({ planId: 'plan_123', limit: 20 });

// Record review
await learningPlanApi.recordReview({
  planId: 'plan_123',
  pointId: 'point_456',
  correct: true,
  responseTime: 2500,
});
```

### Spaced Repetition Algorithms

**Leitner System (Default):**
- 5 boxes with increasing intervals
- Correct → move forward one box
- Incorrect → back to box 1
- Box intervals: 1, 2, 4, 7, 14 days

**FSRS (Free Spaced Repetition Scheduler):**
- Algorithm parameter tuning based on review history
- Stability and difficulty tracking
- Optimal retention targeting

### Integration with Knowledge Graph

When `syncProgress` is enabled:
- Learning points are synced to Neo4j as nodes
- Mastery levels are tracked with relationships
- Progress analytics available in Knowledge Dashboard

### Test Commands

```bash
# Run learning plan tests
npm test -- --testPathPattern=learning

# Specific test files
npm test -- --testPathPattern=LearningPlanGenerator.test.js
npm test -- --testPathPattern=LearningPointImporter.test.js
npm test -- --testPathPattern=VectorManager.test.js
npm test -- --testPathPattern=Neo4jAdapterChunks.test.js
```
