## Study Session System

The Study Session view (`/study/:planId`) provides an immersive, focused learning experience for reviewing learning points using spaced repetition.

### Architecture

```
src/renderer/views/study/
├── index.js                     # Route exports
├── StudySessionPage.js          # Main container with routing
├── components/
│   ├── StudyCard.js             # Flip card (extends FlipCard pattern)
│   ├── StudyControls.js         # Rating buttons (1-4) + keyboard shortcuts
│   ├── SessionSummary.js        # End-of-session stats modal
│   └── PauseOverlay.js          # Pause screen with progress
└── hooks/
    └── useStudySession.js       # Session state management
```

### Key Features

**Session Modes:**
| Mode | Description |
|------|-------------|
| Standard | Review all due items (default) |
| Quick | 5-10 minute burst (15 items max) |
| Focused | Single topic/tag filter |
| Cram | All items regardless of schedule |
| Custom | User-defined count/time |

**4-Point Rating System:**
| Rating | Key | Effect |
|--------|-----|--------|
| Again (1) | `1` | Reset to box 1, review in 1 min |
| Hard (2) | `2` | Stay in box, 1.2× interval |
| Good (3) | `3` | Advance to next box |
| Easy (4) | `4` | Skip a box, 1.5× interval |

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `Space` | Flip card |
| `1-4` | Rate answer (after flip) |
| `H` | Show hint |
| `S` | Skip card |
| `P` | Pause/Resume |
| `Esc` | End session |

### Routes

| Route | Description |
|-------|-------------|
| `/study/:planId` | Study specific plan |
| `/study/all` | Study all due items |
| `/study/all?date=2024-01-15` | Study items due on specific date |
| `/study/:planId?mode=quick` | Quick study mode |

### Components

**StudySessionPage.js:**
- Main container with header (progress, timer, controls)
- Manages session state via `useStudySession` hook
- Keyboard event handling
- Integration with learningPlanApi

**StudyCard.js:**
- 3D flip animation (extends FlipCard CSS)
- Front: Question/term with hint support
- Back: Answer with tags
- Domain-colored styling

**StudyControls.js:**
- Front: Flip button, hint, skip
- Back: 4 rating buttons with colors and keyboard hints

**SessionSummary.js:**
- Performance breakdown (Easy/Good/Hard/Again percentages)
- Stats: items reviewed, accuracy, time, best streak
- Actions: Review Mistakes, Continue, Done

### useStudySession Hook

```javascript
import useStudySession, { RATINGS, SESSION_MODES } from './hooks/useStudySession';

const {
  // State
  session,           // Full session state
  currentItem,       // Current learning point
  isLoading,
  error,
  isComplete,

  // Actions
  startSession,      // Initialize and load items
  rateAnswer,        // Rate current card (1-4)
  skipItem,
  pauseSession,
  resumeSession,
  endSession,

  // Computed
  progress,          // 0-100%
  accuracy,          // 0-100%
  timeRemaining,     // Seconds (if maxMinutes set)
  summary,           // Final stats object
} = useStudySession({
  planId: 'plan_123',
  mode: SESSION_MODES.STANDARD,
  date: '2024-01-15',
  maxItems: 50,
  maxMinutes: 30,
});
```

### Calendar Integration

The Learning Calendar integrates with Study Sessions:

**Calendar → Study Session:**
- Click day cell → Day Detail Panel shows "Study Now" button
- Forecast Panel has play buttons for each day
- "Study All" button for today's due items

**Study Session → Calendar:**
- Session completion triggers calendar refresh
- Updates daily review data and streak tracking
- Heatmap intensity reflects session performance

### Entry Points

1. **Learning Plans Page** → "Study" button on plan cards
2. **Learning Calendar** → Click day with due items → "Study Now"
3. **Calendar Forecast** → Play buttons next to each day
4. **Direct URL** → `/study/:planId` or `/study/all`

### API Methods

```javascript
import learningPlanApi from '../api/learningPlanApi';

// Start session (returns sessionId)
await learningPlanApi.startSession({ planId, mode, itemCount });

// Get due items
await learningPlanApi.getDueItems({ planId, date, mode, limit });

// Record review
await learningPlanApi.recordReview({ planId, sessionId, pointId, rating, responseTime });

// Complete session
await learningPlanApi.completeSession({ planId, sessionId, stats });

// Get calendar data
await learningPlanApi.getDailyReviewData({ startDate, endDate, planId });
await learningPlanApi.getForecast({ days: 7, planId });
```

## Study Session Enhanced Features

Enhanced features for study sessions including AI-powered hints with caching, configurable sound effects, and TTS pronunciation.

### Architecture

```
Main Process
├── src/main/db/AICacheManager.js           # SQLite caching for AI responses
└── src/main/ipc/studyEnhancementHandlers.js # IPC handlers for hints/sounds

Renderer Process
├── src/renderer/api/studyEnhancementApi.js  # Client API
├── src/renderer/views/study/hooks/
│   ├── useStudyHints.js                     # Progressive hints with caching
│   └── useStudySounds.js                    # Configurable sound effects
└── src/renderer/views/settings/
    └── SoundSettingsSection.js              # Settings UI for sounds/cache
```

### AI Cache System

The `AICacheManager` provides SQLite-based caching to avoid repeated AI API calls:

**Cache Types:**
| Type | Expiry | Purpose |
|------|--------|---------|
| `hint` | 90 days | AI-generated hints for learning points |
| `pronunciation` | 180 days | TTS pronunciation data |
| `explanation` | 30 days | AI explanations |

**Key Functions:**
```javascript
import { getCachedContent, setCachedContent, generateCacheKey } from './db/AICacheManager';

// Check cache before AI call
const cacheKey = generateCacheKey('hint', { front: item.front, hintType });
const cached = getCachedContent('hint', cacheKey, token);
if (cached) return cached.content;

// Cache AI response
setCachedContent('hint', cacheKey, aiResponse, {
  expiryDays: 90,
  metadata: { hintType },
  token,
});
```

### Progressive Hint System

`useStudyHints` provides 4 levels of progressive hints:

| Level | Hint Type | Example |
|-------|-----------|---------|
| 1 | `first_letter` | "Starts with 'E'..." |
| 2 | `category` | "This is a type of..." |
| 3 | `context` | "Used when describing..." |
| 4 | `partial` | "eph___al" |

**Usage:**
```javascript
import useStudyHints from './hooks/useStudyHints';

const {
  currentHint,
  hintLevel,
  isLoading,
  requestHint,       // Get next progressive hint
  resetHint,         // Reset for new card
  getHintAvailability,
} = useStudyHints({ useAI: true, token });

// Request progressive hint (level 1 → 2 → 3 → 4)
await requestHint(currentItem);

// Check availability
const { available, levelsUsed, maxLevels } = getHintAvailability(item);
```

### Configurable Sound Effects

`useStudySounds` provides Web Audio API-based sound effects with full configuration:

**Sound Types:**
| Sound | Trigger | Default Volume |
|-------|---------|----------------|
| `flip` | Card flip | 0.4 |
| `correct` | Good/Easy rating | 0.6 |
| `incorrect` | Again/Hard rating | 0.5 |
| `streak` | Milestone (5, 10, 25...) | 0.7 |
| `complete` | Session complete | 0.8 |
| `levelUp` | Box promotion | 0.8 |

**Usage:**
```javascript
import useStudySounds from './hooks/useStudySounds';

const {
  playFlip,
  playCorrect,
  playIncorrect,
  playStreak,
  playComplete,
  speak,           // TTS
  toggleSounds,
  updateConfig,
} = useStudySounds();

// Play on rating
if (rating >= RATINGS.GOOD) {
  playCorrect();
  playStreak(session.streak + 1);
} else {
  playIncorrect();
}

// TTS pronunciation
speak(currentItem.front, { language: 'en-US' });
```

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `study-get-hint` | invoke | Get AI hint (cached) |
| `study-get-pronunciation` | invoke | Get TTS data (cached) |
| `study-get-sound-config` | sync | Get sound settings |
| `study-set-sound-config` | sync | Save sound settings |
| `study-clear-hint-cache` | invoke | Clear hint cache |
| `study-clear-pronunciation-cache` | invoke | Clear TTS cache |
| `study-get-cache-stats` | invoke | Get cache statistics |

### Settings UI

In Settings → "Sound Effects & AI Cache":

- **Master Toggle**: Enable/disable all sounds
- **Master Volume**: 0-100% slider
- **Individual Sounds**: Toggle and volume for each sound type
- **Cache Management**: View stats and clear caches

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `H` | Request next hint level |
| `R` | Pronounce current term (TTS) |
| `1-4` | Rate answer |
| `Space` | Flip card |

### Test Commands

```bash
# Run enhanced features tests
npm test -- --testPathPattern=AICacheManager.test.js
npm test -- --testPathPattern=studyEnhancementHandlers.test.js
npm test -- --testPathPattern=useStudyHints.test.js
npm test -- --testPathPattern=useStudySounds.test.js
```

## Study Analytics & Insights

Comprehensive analytics system for tracking study session performance, identifying weak items, calculating learning velocity, and suggesting optimal study times.

### Architecture

```
Main Process
├── src/main/db/SessionAnalyticsManager.js    # SQLite analytics storage
└── src/main/ipc/studyAnalyticsHandlers.js    # IPC handlers

Renderer Process
├── src/renderer/api/studyAnalyticsApi.js     # Client API with helper functions
├── src/renderer/views/study/hooks/
│   └── useStudyAnalytics.js                  # Analytics data access hook
└── src/renderer/views/study/components/
    ├── AnalyticsDashboard.js                 # Main container
    ├── SessionHistoryPanel.js                # Paginated session history
    ├── PerformanceTrendsChart.js             # SVG line charts
    ├── WeakItemsPanel.js                     # Items needing practice
    └── OptimalTimeRecommendation.js          # Best study times
```

### Database Tables

Two SQLite tables store analytics data:

**session_analytics:**
```sql
CREATE TABLE session_analytics (
  id TEXT PRIMARY KEY,
  userId INTEGER,
  sessionId TEXT,
  topicId TEXT,
  date TEXT,
  startTime TEXT,
  endTime TEXT,
  durationMinutes INTEGER,
  itemsReviewed INTEGER,
  correctCount INTEGER,
  incorrectCount INTEGER,
  accuracy TEXT,
  avgResponseTimeMs INTEGER,
  focusScore INTEGER,        -- 0-100 based on hints, pauses, response time
  efficiencyScore INTEGER,   -- 0-100 based on accuracy × speed × throughput
  retentionRate TEXT,        -- Weighted recent review performance
  hintsUsed INTEGER,
  pauseCount INTEGER,
  pauseDurationSeconds INTEGER,
  streakMax INTEGER,
  conceptsImproved TEXT,     -- JSON array of concept IDs
  metadata TEXT,             -- JSON for additional data
  createdAt TEXT
);
```

**learning_velocity:**
```sql
CREATE TABLE learning_velocity (
  id TEXT PRIMARY KEY,
  userId INTEGER,
  topicId TEXT,
  date TEXT,
  masteryStart TEXT,         -- Mastery % at session start
  masteryEnd TEXT,           -- Mastery % at session end
  velocity TEXT,             -- % change per period
  itemsLearned INTEGER,
  itemsReviewed INTEGER,
  timeSpentMinutes INTEGER,
  createdAt TEXT
);
```

### Performance Metrics

**Focus Score (0-100):**
Measures how focused the learner was during the session.
```javascript
focusScore = 100
  - (hintsUsed * 5)              // Penalty for hint usage
  - (pauseCount * 10)            // Penalty for pauses
  - (avgResponseTimeBonus)       // Bonus for fast responses
```

**Efficiency Score (0-100):**
Measures learning efficiency combining accuracy and speed.
```javascript
efficiencyScore = (accuracy * 0.5) + (speedScore * 0.3) + (throughputScore * 0.2)
```

**Retention Rate:**
Weighted average of recent review performance (exponential decay).

**Learning Velocity:**
Mastery change per time period (daily/weekly).
```javascript
velocity = ((masteryEnd - masteryStart) / timeSpentMinutes) * 60
```

### Key Features

**1. Session History:**
- Paginated list of past sessions
- Expandable rows with detailed stats
- Filter by topic/date range

**2. Performance Trends:**
- SVG-based line charts (no external library)
- Daily/weekly aggregation
- Metrics: accuracy, study time, items reviewed

**3. Weak Items Detection:**
- Items with low accuracy (<60%)
- Items frequently marked "Again"
- Integration with knowledge graph concepts

**4. Optimal Study Time Analysis:**
- Hour-by-hour performance breakdown
- Day-of-week patterns
- Personalized recommendations

**5. Export Functionality:**
- JSON export with full details
- CSV export for spreadsheets

### useStudyAnalytics Hook

```javascript
import useStudyAnalytics, {
  useSessionHistory,
  usePerformanceComparison,
  useExportAnalytics,
} from './hooks/useStudyAnalytics';

// Main hook
const {
  dashboard,           // Summary stats
  trends,              // Performance trends array
  velocity,            // Learning velocity data
  isLoading,
  error,

  // Data loading
  loadDashboard,
  loadTrends,
  loadVelocity,
  loadWeakItems,

  // Session tracking
  startSessionTracking,
  recordReview,
  recordHintUsed,
  recordPause,
  endSessionAndRecord,

  // Computed values
  performanceLevel,    // { label, color }
  velocityTrend,       // 'improving' | 'declining' | 'stable'
} = useStudyAnalytics({ token, autoLoad: true });

// Session history hook
const {
  sessions,
  total,
  hasMore,
  page,
  nextPage,
  prevPage,
} = useSessionHistory({ token, pageSize: 20 });

// Export hook
const {
  exportData,
  isExporting,
} = useExportAnalytics(token);
```

### Session Tracking Integration

Analytics are automatically tracked in `StudySessionPage.js`:

```javascript
// In StudySessionPage.js
const {
  startSessionTracking,
  recordReview,
  recordHintUsed,
  recordPause,
  endSessionAndRecord,
} = useStudyAnalytics({ token });

// On mount
useEffect(() => {
  startSessionTracking();
}, []);

// On answer rating
const handleRate = (rating) => {
  recordReview({
    itemId: currentItem.id,
    wasCorrect: rating >= RATINGS.GOOD,
    rating,
    responseTimeMs: Date.now() - session.itemStartTime,
  });
  rateAnswer(rating);
};

// On hint usage
const handleHint = () => {
  recordHintUsed();
  requestHint(currentItem);
};

// On session complete
useEffect(() => {
  if (isComplete && summary) {
    endSessionAndRecord(session.id, {
      topicId: planId,
      durationMinutes: Math.round(session.elapsedTime / 60),
      masteryStart: summary.masteryStart,
      masteryEnd: summary.masteryEnd,
    });
  }
}, [isComplete]);
```

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `analytics-record-session` | invoke | Record session analytics |
| `analytics-get-session` | invoke | Get single session details |
| `analytics-get-trends` | invoke | Get performance trends |
| `analytics-get-weekly` | invoke | Get weekly performance |
| `analytics-record-velocity` | invoke | Record learning velocity |
| `analytics-get-velocity` | invoke | Get velocity for topic |
| `analytics-get-aggregate-velocity` | invoke | Get aggregate velocity stats |
| `analytics-optimal-times` | invoke | Analyze optimal study times |
| `analytics-weak-items` | invoke | Identify weak items |
| `analytics-session-history` | invoke | Get session history (paginated) |
| `analytics-export` | invoke | Export session data |
| `analytics-dashboard` | invoke | Get dashboard summary |
| `analytics-sync-mastery` | invoke | Sync mastery to knowledge graph |
| `analytics-graph-insights` | invoke | Get graph-based insights |

### API Helper Functions

```javascript
import studyAnalyticsApi, {
  calculateFocusScore,
  calculateEfficiencyScore,
  calculateRetentionRate,
  getPerformanceLevel,
  formatDuration,
  formatAccuracy,
} from '../api/studyAnalyticsApi';

// Calculate scores
const focus = calculateFocusScore({
  avgResponseTimeMs: 3000,
  hintsUsed: 2,
  pauseCount: 1,
  itemsReviewed: 20,
});

const efficiency = calculateEfficiencyScore({
  accuracy: 85,
  avgResponseTimeMs: 2500,
  itemsReviewed: 30,
  durationMinutes: 15,
});

// Get performance level
const level = getPerformanceLevel(85);
// { label: 'Good', color: '#4CAF50' }

// Format for display
formatDuration(75);    // "1h 15m"
formatAccuracy(85.5);  // "85.5%"
```

### AnalyticsDashboard Component

The main dashboard container with four tabs:

```javascript
import AnalyticsDashboard from './components/AnalyticsDashboard';

<AnalyticsDashboard
  token={userToken}
  topicId={planId}     // Optional: filter by topic
/>
```

**Tabs:**
1. **Trends**: Performance charts (accuracy, time, items)
2. **History**: Paginated session list
3. **Weak Items**: Items needing practice
4. **Best Times**: Optimal study time recommendations

**Summary Cards:**
- Today's stats (items, accuracy)
- This week's stats
- Current streak
- Learning velocity

### Test Commands

```bash
# Run analytics tests
npm test -- --testPathPattern=SessionAnalyticsManager.test.js
npm test -- --testPathPattern=studyAnalyticsHandlers.test.js
npm test -- --testPathPattern=useStudyAnalytics.test.js
```
