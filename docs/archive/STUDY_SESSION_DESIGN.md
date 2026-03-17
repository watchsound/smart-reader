# Study Session View - Comprehensive Design Plan

## Overview

The Study Session view (`/study/:planId`) provides an immersive, focused learning experience for reviewing learning points from a Learning Plan. It integrates with the Learning Calendar for scheduling and tracking, and uses the proven Leitner spaced repetition system.

## Architecture

```
Study Session Flow
├── Entry Points
│   ├── Learning Plans Page → "Study" button
│   ├── Learning Calendar → Click on day with due items
│   ├── Dashboard/Home → "Due Today" widget
│   └── Notification → "Time to study" reminder
│
├── UI Components
│   ├── StudySessionPage.js          # Main container with routing
│   ├── StudySessionHeader.js        # Progress, timer, controls
│   ├── StudyCard.js                 # Flip card for learning points
│   ├── StudyControls.js             # Answer buttons, shortcuts
│   ├── StudyProgressBar.js          # Visual progress indicator
│   ├── SessionSummary.js            # End-of-session stats
│   └── PauseOverlay.js              # Pause screen with options
│
├── State Management
│   └── useStudySession.js           # Custom hook for session logic
│
└── Integration Points
    ├── learningPlanApi.js           # Fetch due items, record reviews
    ├── spacedRepetitionApi.js       # FSRS algorithm
    ├── LearningCalendar             # Update calendar on completion
    └── NotificationManager          # Schedule reminders
```

## Key Features

### 1. Session Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Standard** | Review all due items | Daily review session |
| **Quick** | 5-10 minute burst | Short break study |
| **Focused** | Single topic/tag | Exam preparation |
| **Cram** | All items regardless of schedule | Last-minute review |
| **Custom** | User-defined count/time | Flexible learning |

### 2. Card Interaction

```
┌─────────────────────────────────────────────┐
│  [Progress: 12/45]     [Timer: 08:23]  [⏸]  │
├─────────────────────────────────────────────┤
│                                             │
│         ┌───────────────────────┐           │
│         │                       │           │
│         │    FRONT OF CARD      │           │
│         │    (Question/Term)    │           │
│         │                       │           │
│         └───────────────────────┘           │
│                                             │
│    [💡 Hint]  [🔄 Flip]  [⏭ Skip]          │
│                                             │
├─────────────────────────────────────────────┤
│  Box: 2 (Learning)  │  Streak: 🔥 5        │
└─────────────────────────────────────────────┘

After Flip:
┌─────────────────────────────────────────────┐
│         ┌───────────────────────┐           │
│         │                       │           │
│         │    BACK OF CARD       │           │
│         │    (Answer/Definition)│           │
│         │                       │           │
│         └───────────────────────┘           │
│                                             │
│  [❌ Again]  [🤔 Hard]  [✓ Good]  [⚡ Easy] │
│    (1)        (2)        (3)       (4)     │
└─────────────────────────────────────────────┘
```

### 3. Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `Space` | Flip card | Front showing |
| `1` | Again (incorrect) | Back showing |
| `2` | Hard | Back showing |
| `3` | Good (correct) | Back showing |
| `4` | Easy | Back showing |
| `H` | Show hint | Any |
| `S` | Skip card | Any |
| `P` | Pause/Resume | Any |
| `Esc` | End session | Any |

### 4. Progress Tracking

```javascript
SessionState = {
  // Identifiers
  planId: string,
  sessionId: string,
  startedAt: Date,

  // Items
  items: LearningPoint[],
  currentIndex: number,

  // Answers
  answers: [{
    pointId: string,
    rating: 1-4,              // Again, Hard, Good, Easy
    responseTime: number,     // ms
    wasFlipped: boolean,
    hintUsed: boolean,
    timestamp: Date,
  }],

  // Session stats
  elapsedTime: number,        // seconds
  isPaused: boolean,
  streak: number,             // consecutive correct
  bestStreak: number,

  // Derived
  progress: number,           // 0-100%
  accuracy: number,           // 0-100%
  avgResponseTime: number,    // ms
}
```

### 5. Spaced Repetition Integration

Using FSRS (Free Spaced Repetition Scheduler) algorithm:

| Rating | Effect | Next Review |
|--------|--------|-------------|
| Again (1) | Reset to box 1 | In 1 minute |
| Hard (2) | Stay in current box | In 1.2× interval |
| Good (3) | Move to next box | Standard interval |
| Easy (4) | Skip a box | 1.5× interval |

Box intervals (Leitner-compatible):
- Box 1: 1 day
- Box 2: 2 days
- Box 3: 4 days
- Box 4: 7 days
- Box 5: 14 days (mastered)

### 6. Session Summary

```
┌─────────────────────────────────────────────┐
│              🎉 Session Complete!            │
├─────────────────────────────────────────────┤
│                                             │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│     │   45    │  │  87%    │  │  12:34  │  │
│     │ Items   │  │Accuracy │  │  Time   │  │
│     └─────────┘  └─────────┘  └─────────┘  │
│                                             │
│  Performance Breakdown:                     │
│  ████████████████░░░░ Easy: 20 (44%)       │
│  ██████████░░░░░░░░░░ Good: 15 (33%)       │
│  ████░░░░░░░░░░░░░░░░ Hard: 5 (11%)        │
│  ██░░░░░░░░░░░░░░░░░░ Again: 5 (11%)       │
│                                             │
│  🔥 Best Streak: 12                         │
│  ⚡ Avg Response: 3.2s                      │
│  📈 Items Promoted: 18                      │
│                                             │
│  [Review Mistakes]  [Continue]  [Done]     │
└─────────────────────────────────────────────┘
```

## Calendar Integration

### 1. Calendar → Study Session Flow

```
Learning Calendar
       │
       ▼
┌─────────────────┐
│  Day Cell Click │───────────┐
└─────────────────┘           │
       │                      │
       ▼                      ▼
┌─────────────────┐   ┌─────────────────┐
│ Day Detail Panel│   │ Quick Study     │
│ - Due items: 25 │   │ Modal (optional)│
│ - Plans: 3      │   └─────────────────┘
│ [Study Now] btn │
└─────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         Study Session Page              │
│  /study?date=2024-01-15&plans=all       │
└─────────────────────────────────────────┘
```

### 2. Study Session → Calendar Update

After each session:
1. Update `dailyReviewData` with session stats
2. Refresh calendar heatmap intensity
3. Update streak counters
4. Sync to forecast panel

```javascript
// On session complete
await learningPlanApi.recordSessionComplete({
  planId,
  sessionId,
  date: today,
  stats: {
    itemsReviewed: 45,
    correctCount: 40,
    duration: 754,  // seconds
    avgRating: 2.8,
  }
});

// Calendar auto-refreshes via useLearningCalendar hook
```

### 3. Calendar Enhancements

Add to existing calendar:

1. **Day Cell Badge**: Show due items count
2. **Quick Study Button**: In day detail panel
3. **Plan Filter**: Filter calendar by specific plan
4. **Session History**: View past sessions for a day

### 4. Forecast Integration

```
Today's Forecast:
┌─────────────────────────────────────────┐
│ Plan A (Vocabulary) ████████░░ 24 due   │ [Study]
│ Plan B (Math)       ███░░░░░░░  8 due   │ [Study]
│ Plan C (History)    █░░░░░░░░░  3 due   │ [Study]
└─────────────────────────────────────────┘
         Total: 35 items (~18 min)
              [Study All]
```

## Component Specifications

### StudySessionPage.js

```javascript
Props: {
  // From route params
  planId?: string,           // Specific plan or 'all'
  date?: string,             // ISO date, default today
  mode?: 'standard' | 'quick' | 'focused' | 'cram' | 'custom',

  // Optional filters
  tags?: string[],
  maxItems?: number,
  maxMinutes?: number,
}

State: {
  session: SessionState,
  settings: {
    autoFlip: boolean,       // Auto-flip after X seconds
    autoAdvance: boolean,    // Auto-advance on rating
    showTimer: boolean,
    soundEffects: boolean,
    hapticFeedback: boolean, // Mobile
  },
  view: 'study' | 'paused' | 'summary',
}
```

### StudyCard.js

Extends existing FlipCard patterns:

```javascript
Props: {
  item: {
    id: string,
    front: string,           // Question/term
    back: string,            // Answer/definition
    tags?: string[],
    difficulty?: string,
    box: number,
    reviewCount: number,
  },
  isFlipped: boolean,
  onFlip: () => void,
  animationClass?: string,   // 'correct-pulse' | 'incorrect-shake' | 'fly-out'
}

Features:
- 3D flip animation (preserve existing)
- Dynamic font sizing based on content length
- LaTeX/Math rendering support
- Image support (if item has image)
- Audio pronunciation (for vocabulary)
```

### useStudySession.js Hook

```javascript
const {
  // State
  session,
  currentItem,
  isLoading,
  error,

  // Actions
  startSession,
  flipCard,
  rateAnswer,
  skipItem,
  pauseSession,
  resumeSession,
  endSession,

  // Utils
  getHint,
  toggleSettings,

  // Computed
  progress,
  accuracy,
  timeRemaining,
} = useStudySession({
  planId,
  mode,
  options,
});
```

## UI/UX Guidelines

### 1. Visual Design

- **Color Scheme**: Inherit from domain colors (vocabulary=green, math=blue, etc.)
- **Dark Mode**: Full support with comfortable contrast
- **Typography**: Large, readable fonts for card content
- **Spacing**: Generous padding for touch targets

### 2. Animations

| Animation | Duration | Easing |
|-----------|----------|--------|
| Card flip | 400ms | ease-in-out |
| Correct feedback | 400ms | elastic |
| Incorrect shake | 400ms | ease-out |
| Card advance | 500ms | cubic-bezier |
| Progress bar | 300ms | ease-out |

### 3. Responsive Behavior

| Breakpoint | Layout Changes |
|------------|----------------|
| Desktop (>1024px) | Full layout, keyboard shortcuts prominent |
| Tablet (768-1024px) | Larger touch targets, swipe gestures |
| Mobile (<768px) | Full-screen cards, swipe to rate |

### 4. Accessibility

- Screen reader announcements for card content
- High contrast mode support
- Reduced motion preference respected
- Focus management for keyboard navigation
- ARIA live regions for progress updates

## Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        Main Process                          │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │ LearningPlan    │    │ SpacedRepetition│                 │
│  │ Manager (SQLite)│    │ Service (FSRS)  │                 │
│  └────────┬────────┘    └────────┬────────┘                 │
│           │                      │                          │
│           └──────────┬───────────┘                          │
│                      │                                      │
│              ┌───────┴───────┐                              │
│              │ IPC Handlers  │                              │
│              └───────┬───────┘                              │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       │ IPC
                       │
┌──────────────────────┼──────────────────────────────────────┐
│                      │        Renderer Process              │
├──────────────────────┼──────────────────────────────────────┤
│              ┌───────┴───────┐                              │
│              │learningPlanApi│                              │
│              └───────┬───────┘                              │
│                      │                                      │
│           ┌──────────┴──────────┐                          │
│           │                     │                          │
│  ┌────────┴────────┐   ┌───────┴───────┐                  │
│  │useStudySession  │   │useLearning    │                  │
│  │      Hook       │   │Calendar Hook  │                  │
│  └────────┬────────┘   └───────┬───────┘                  │
│           │                    │                          │
│  ┌────────┴────────┐   ┌───────┴───────┐                  │
│  │StudySessionPage │   │LearningCalendar│                  │
│  │                 │◄──│    Page       │                  │
│  └─────────────────┘   └───────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Study Session (MVP)
- [ ] StudySessionPage with basic routing
- [ ] StudyCard component (flip animation)
- [ ] StudyControls with keyboard shortcuts
- [ ] useStudySession hook with state management
- [ ] Basic progress tracking
- [ ] Session summary modal

### Phase 2: Calendar Integration
- [ ] Add "Study" button to Learning Plans cards
- [ ] Calendar day click → study session
- [ ] Session complete → calendar refresh
- [ ] Streak tracking update
- [ ] Forecast panel integration

### Phase 3: Enhanced Features
- [ ] Multiple session modes (quick, focused, cram)
- [ ] Hint system with AI generation
- [ ] Audio pronunciation for vocabulary
- [ ] Swipe gestures for mobile
- [ ] Sound effects and haptics

### Phase 4: Analytics & Insights
- [ ] Detailed session history
- [ ] Performance trends over time
- [ ] Weak items identification
- [ ] Optimal study time suggestions
- [ ] Export session data

## File Structure

```
src/renderer/views/study/
├── index.js                     # Route exports
├── StudySessionPage.js          # Main container
├── components/
│   ├── StudyCard.js             # Flip card
│   ├── StudyCard.css            # Card animations
│   ├── StudyControls.js         # Rating buttons
│   ├── StudyHeader.js           # Progress, timer
│   ├── StudyProgressBar.js      # Visual progress
│   ├── SessionSummary.js        # End stats
│   ├── PauseOverlay.js          # Pause screen
│   └── SessionModeSelector.js   # Mode picker
├── hooks/
│   └── useStudySession.js       # Session logic
└── utils/
    └── sessionHelpers.js        # Helper functions

src/renderer/api/
└── studySessionApi.js           # API methods (if separate)

src/main/ipc/
└── studySessionHandlers.js      # IPC handlers (if needed)
```

## API Additions

### New IPC Handlers

```javascript
// Get items due for a specific plan and date
'study-session-get-items': {
  params: { planId, date, mode, limit },
  returns: { items: LearningPoint[], total: number }
}

// Start a new study session (for tracking)
'study-session-start': {
  params: { planId, mode, itemCount },
  returns: { sessionId: string }
}

// Record individual review (real-time)
'study-session-review': {
  params: { sessionId, pointId, rating, responseTime },
  returns: { newBox, nextReview }
}

// Complete session (batch update)
'study-session-complete': {
  params: { sessionId, stats },
  returns: { success: boolean }
}
```

### API Methods

```javascript
// studySessionApi.js
export const studySessionApi = {
  getSessionItems(planId, date, mode, limit),
  startSession(planId, mode, itemCount),
  recordReview(sessionId, pointId, rating, responseTime),
  completeSession(sessionId, stats),
  getSessionHistory(planId, limit),
};
```

## Testing Strategy

### Unit Tests
- useStudySession hook state transitions
- Rating calculations (FSRS algorithm)
- Progress/accuracy computations
- Session timer logic

### Integration Tests
- Card fetch → display → rate → next flow
- Session start → complete → calendar update
- Keyboard navigation
- Multiple session modes

### E2E Tests
- Full study session flow
- Calendar → Study → Calendar refresh
- Pause/resume/end scenarios
- Summary display and navigation

## Success Metrics

1. **Engagement**: Average session duration > 10 minutes
2. **Completion**: Session completion rate > 80%
3. **Retention**: Items reaching Box 5 within expected time
4. **Consistency**: Daily study streak increases
5. **Performance**: <100ms response time for card transitions
