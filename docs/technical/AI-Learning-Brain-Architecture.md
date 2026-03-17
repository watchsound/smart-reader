# AI Learning Brain Architecture

## Vision: A Persistent, Episodic Memory-Powered Learning Manager

This document outlines the architecture for an **autonomous AI Learning Brain** that manages the user's learning journey through episodic memory and periodic introspection.

---

## 1. Core Concepts

### 1.1 What is the Learning Brain?

The Learning Brain is a **background autonomous agent** that:

1. **Runs persistently** in the Electron main process
2. **Wakes up periodically** (heartbeat mechanism, inspired by [OpenClaw](https://docs.openclaw.ai/gateway/heartbeat))
3. **Maintains episodic memory** of all learning events in Neo4j (inspired by [Graphiti/Zep](https://github.com/getzep/graphiti))
4. **Understands user intention** by analyzing temporal patterns in learning history
5. **Makes autonomous decisions** about learning priorities, schedules, and interventions

### 1.2 Why Episodic Memory?

Without temporal memory, the system is stateless - each interaction is independent. With episodic memory:

| Capability | Without Episodes | With Episodes |
|------------|------------------|---------------|
| Pattern Recognition | None | "User struggles with calculus every Monday" |
| Intention Inference | None | "User is cramming - probably has an exam" |
| Adaptive Scheduling | Static intervals | Dynamic based on historical performance |
| Personalization | Generic | "User learns vocabulary best in 15-min sessions" |
| Long-term Tracking | Snapshot only | Full learning journey over months/years |

### 1.3 Key Inspirations

| Source | Concept Borrowed |
|--------|------------------|
| [OpenClaw Heartbeat](https://docs.openclaw.ai/gateway/heartbeat) | Periodic wake-up, HEARTBEAT.md checklist, autonomous decision |
| [Graphiti/Zep](https://arxiv.org/html/2501.13956v1) | Three-tier memory (episodic → semantic → community), bi-temporal model, edge invalidation |
| Current SmartReader Skills | Tool-use pattern, context management, Neo4j integration |

---

## 2. Three-Tier Memory Architecture

Following Zep's research paper architecture, adapted for learning:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     LEARNING BRAIN MEMORY (Neo4j)                        │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 1: EPISODIC MEMORY (Raw Events)                              │ │
│  │  ──────────────────────────────────────                            │ │
│  │  High-fidelity, timestamped learning events                        │ │
│  │                                                                    │ │
│  │  (:Episode {                                                       │ │
│  │    id, userId, eventType, timestamp,                               │ │
│  │    t_valid, t_invalid,        // Event timeline                    │ │
│  │    t_created, t_expired,      // Ingestion timeline                │ │
│  │    payload: JSON,             // Event-specific data               │ │
│  │    sourceContext: JSON        // What user was doing               │ │
│  │  })                                                                │ │
│  │                                                                    │ │
│  │  Event Types:                                                      │ │
│  │  • REVIEW_COMPLETED    • CONCEPT_STRUGGLED   • BOOK_OPENED        │ │
│  │  • QUIZ_TAKEN          • NOTE_CREATED        • SESSION_STARTED    │ │
│  │  • MASTERY_CHANGED     • GOAL_SET            • STREAK_BROKEN      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              │ Extraction & Resolution                  │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 2: SEMANTIC MEMORY (Entities & Relationships)                │ │
│  │  ──────────────────────────────────────────────────                │ │
│  │  Extracted entities and their relationships                        │ │
│  │                                                                    │ │
│  │  (:LearningEntity {                                                │ │
│  │    id, type, name, embedding[1024],                                │ │
│  │    summary, firstSeen, lastSeen, interactionCount                  │ │
│  │  })                                                                │ │
│  │                                                                    │ │
│  │  Entity Types:                                                     │ │
│  │  • Concept       (calculus, photosynthesis)                        │ │
│  │  • Topic         (Chapter 5, GRE Vocabulary)                       │ │
│  │  • Book          (specific learning material)                      │ │
│  │  • LearningGoal  (Pass exam, Learn Spanish)                        │ │
│  │  • TimePattern   (Morning sessions, Weekend study)                 │ │
│  │                                                                    │ │
│  │  Relationships:                                                    │ │
│  │  -[:STRUGGLED_WITH {count, lastTime, avgResponseTime}]->           │ │
│  │  -[:MASTERED {masteryLevel, date}]->                               │ │
│  │  -[:STUDIED_DURING {timeOfDay, dayOfWeek, avgDuration}]->          │ │
│  │  -[:PART_OF_GOAL {priority, deadline}]->                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              │ Clustering & Summarization               │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 3: COMMUNITY MEMORY (Patterns & Insights)                    │ │
│  │  ──────────────────────────────────────────────────                │ │
│  │  High-level summaries and clustered insights                       │ │
│  │                                                                    │ │
│  │  (:LearningPattern {                                               │ │
│  │    id, patternType, summary, confidence,                           │ │
│  │    validFrom, validUntil, memberCount                              │ │
│  │  })                                                                │ │
│  │                                                                    │ │
│  │  Pattern Types:                                                    │ │
│  │  • WeakAreaCluster    "User consistently struggles with fractions" │ │
│  │  • StrengthCluster    "User excels at vocabulary retention"        │ │
│  │  • TimePreference     "Most productive 9-11am on weekdays"         │ │
│  │  • LearningStyle      "Prefers visual aids and short sessions"     │ │
│  │  • GoalProgress       "On track for GRE prep, behind on Spanish"   │ │
│  │                                                                    │ │
│  │  -[:MEMBER_OF]-> connects entities to patterns                     │ │
│  │  -[:DERIVED_FROM]-> connects patterns to episodes                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Bi-Temporal Data Model

Following Zep's approach, every edge tracks four timestamps:

```javascript
// Example: User mastered a concept
{
  t_valid: '2024-01-15T10:00:00Z',    // When mastery actually occurred
  t_invalid: null,                     // Still valid (not superseded)
  t_created: '2024-01-15T10:05:00Z',  // When system recorded it
  t_expired: null                      // Record still active
}

// Later: User forgot the concept (edge invalidation)
{
  t_valid: '2024-01-15T10:00:00Z',
  t_invalid: '2024-02-20T14:00:00Z',  // Mastery no longer valid
  t_created: '2024-01-15T10:05:00Z',
  t_expired: '2024-02-20T14:05:00Z'   // Record superseded
}
```

This enables:
- **Point-in-time queries**: "What did the user know on January 20th?"
- **Trend analysis**: "How has mastery of calculus changed over 3 months?"
- **Correction handling**: Retroactive updates don't lose history

---

## 3. Heartbeat System Architecture

### 3.0 Background Service vs In-App Scheduler

The heartbeat system uses a **Background Service with Hybrid Fallback** approach:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     INSTALLATION FLOW                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  App First Launch                                                        │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Try Install Background Service                                  │    │
│  │  ─────────────────────────────────                               │    │
│  │  Windows: node-windows → Windows Service                         │    │
│  │  macOS:   node-mac    → LaunchDaemon                             │    │
│  │  Linux:   node-linux  → systemd service                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       │                                                                  │
│       ├── Success ──────────────────────────────────────────────┐       │
│       │                                                         │       │
│       ▼                                                         ▼       │
│  ┌────────────────────────┐                    ┌────────────────────────┐│
│  │ FALLBACK: Hybrid Mode  │                    │ PRIMARY: Service Mode  ││
│  │ ────────────────────── │                    │ ────────────────────── ││
│  │ • In-app setTimeout    │                    │ • Survives app exit    ││
│  │ • Catch-up on launch   │                    │ • Auto-starts on boot  ││
│  │ • Still functional     │                    │ • System notifications ││
│  └────────────────────────┘                    └────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.0.1 Background Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND SERVICE (smartreader-service)              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Service Process (Node.js)                                        │   │
│  │  ─────────────────────────                                        │   │
│  │  • Lightweight (~20MB memory)                                     │   │
│  │  • Runs as system service (not Electron)                          │   │
│  │  • Shares SQLite database with main app                           │   │
│  │  • Communicates via Named Pipe (Windows) / Unix Socket            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ IPC (Named Pipe / Unix Socket)           │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Main App (Electron) - Optional                                   │   │
│  │  ───────────────────────────────                                  │   │
│  │  • Receives notifications from service                            │   │
│  │  • Can query service status                                       │   │
│  │  • UI shows insights when app opens                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Service Lifecycle:                                                      │
│  ─────────────────                                                       │
│  1. COMPUTER BOOT     → OS auto-starts service                          │
│  2. SERVICE STARTS    → Load lastHeartbeatTime from state file          │
│  3. CHECK CATCH-UP    → If >24h since last, run heartbeat immediately   │
│  4. SCHEDULE NEXT     → setTimeout for next heartbeat                   │
│  5. HEARTBEAT RUNS    → Execute checklist, update state                 │
│  6. NOTIFY USER       → System notification (if app closed)             │
│  7. COMPUTER SHUTDOWN → OS sends SIGTERM, service saves state           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.0.2 Shutdown/Boot Timeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TYPICAL 24-HOUR CYCLE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Day 1, 10:00 PM - User studies, then shuts down computer               │
│  ────────────────────────────────────────────────────                    │
│       └── Service receives SIGTERM from OS                               │
│       └── Saves state: { lastHeartbeat: "10:00 PM", pendingTasks: [] }  │
│       └── Service stops gracefully                                       │
│       └── Computer powers off                                            │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════    │
│                    [COMPUTER OFF - NO PROCESSING]                        │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                          │
│  Day 2, 8:00 AM - User boots computer                                   │
│  ──────────────────────────────────                                      │
│       └── OS auto-starts SmartReader Background Service                  │
│       └── Service loads state file                                       │
│       └── Checks: lastHeartbeat was 10 hours ago (< 24h threshold)      │
│       └── Schedules next heartbeat for 10:00 PM (24h cycle)             │
│                                                                          │
│  Day 2, 10:00 PM - Scheduled heartbeat triggers                         │
│  ───────────────────────────────────────────                             │
│       └── Service wakes up, runs BRAIN_CHECKLIST                         │
│       └── Analyzes learning patterns, consolidates memory                │
│       └── Detects: "5 vocabulary items due for review"                   │
│       └── Sends system notification (even though app is closed)         │
│       └── Saves state, schedules next heartbeat                          │
│                                                                          │
│  Day 2, 10:05 PM - User sees notification                               │
│  ─────────────────────────────────────                                   │
│       └── "SmartReader: 5 items ready for review! 🧠"                    │
│       └── User clicks → Main app opens                                   │
│       └── App queries service for latest insights                        │
│       └── Shows personalized dashboard                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.0.3 Catch-Up Scenario (Extended Offline)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EXTENDED OFFLINE SCENARIO                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Friday 6:00 PM  - User shuts down laptop for weekend trip              │
│  Monday 9:00 AM  - User returns, boots computer                         │
│                                                                          │
│  Service startup sequence:                                               │
│  ─────────────────────────                                               │
│       1. Load state: lastHeartbeat = "Friday 6:00 PM"                   │
│       2. Calculate gap: 63 hours (> 24h threshold)                      │
│       3. CATCH-UP MODE activated                                         │
│                                                                          │
│  Catch-up actions:                                                       │
│  ─────────────────                                                       │
│       • Run pattern analysis for missed period                           │
│       • Calculate items now overdue                                      │
│       • Generate "welcome back" summary                                  │
│       • Send notification: "Welcome back! Here's what you missed..."    │
│                                                                          │
│  After catch-up:                                                         │
│       • Reset heartbeat timer to normal 24h cycle                        │
│       • Continue normal operation                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.0.4 Service-App Communication

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    IPC COMMUNICATION                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Background Service                          Main App (Electron)         │
│  ──────────────────                          ───────────────────         │
│        │                                            │                    │
│        │◄─── getStatus() ──────────────────────────│                    │
│        │                                            │                    │
│        │──── { running: true, lastHeartbeat, ... } ─►│                  │
│        │                                            │                    │
│        │◄─── triggerHeartbeatNow() ────────────────│  (manual trigger)  │
│        │                                            │                    │
│        │──── { success: true, insights: [...] } ───►│                   │
│        │                                            │                    │
│        │──── notification: "5 items due" ──────────►│  (push from svc)  │
│        │                                            │                    │
│        │◄─── getInsights() ────────────────────────│                    │
│        │                                            │                    │
│        │──── { patterns, weakConcepts, ... } ──────►│                   │
│        │                                            │                    │
│                                                                          │
│  Communication Channel:                                                  │
│  ─────────────────────                                                   │
│  Windows: Named Pipe (\\.\pipe\smartreader-brain)                       │
│  macOS/Linux: Unix Socket (/tmp/smartreader-brain.sock)                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

Inspired by OpenClaw's heartbeat, adapted for Electron with Background Service:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        HEARTBEAT SYSTEM                                  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    HeartbeatScheduler                             │   │
│  │  ────────────────────────────────────                             │   │
│  │  • Runs in Background Service (survives app exit)                 │   │
│  │  • Fallback: Runs in Electron main process if service failed      │   │
│  │  • Uses setTimeout (not setInterval) to prevent drift             │   │
│  │  • Respects activeHours (e.g., 08:00-22:00)                       │   │
│  │  • Configurable interval (default: 24 hours for daily review)     │   │
│  │  • Can be triggered manually via IPC                              │   │
│  │  • Catch-up logic on boot if missed heartbeats                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ Wake-up trigger                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    LearningBrainAgent                             │   │
│  │  ────────────────────────────────────                             │   │
│  │  1. Load BRAIN_CHECKLIST.md (like HEARTBEAT.md)                   │   │
│  │  2. Query episodic memory for recent events                       │   │
│  │  3. Run analysis pipeline                                         │   │
│  │  4. Make autonomous decisions                                     │   │
│  │  5. Execute actions or queue notifications                        │   │
│  │  6. Return HEARTBEAT_OK or alert content                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ Actions                                  │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    BrainActionExecutor                            │   │
│  │  ────────────────────────────────────                             │   │
│  │  • Update learning schedules                                      │   │
│  │  • Consolidate old episodes into summaries                        │   │
│  │  • Generate notifications for user                                │   │
│  │  • Adjust spaced repetition intervals                             │   │
│  │  • Update community/pattern nodes                                 │   │
│  │  • Invalidate stale edges (bi-temporal)                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 BRAIN_CHECKLIST.md Format

```markdown
# Learning Brain Daily Checklist

## Morning Review (if active hours)
- [ ] Check items due for spaced repetition today
- [ ] Identify weak concepts from last 7 days
- [ ] Update streak status

## Pattern Analysis
- [ ] Analyze learning velocity (mastery change rate)
- [ ] Detect struggling patterns (same concept failed 3+ times)
- [ ] Identify optimal study times from historical data

## Memory Consolidation
- [ ] Collapse episodes older than 30 days into summaries
- [ ] Update community/pattern nodes
- [ ] Prune invalidated edges older than 90 days

## Notifications (if warranted)
- [ ] Alert if streak at risk
- [ ] Suggest concepts that need review
- [ ] Report weekly progress summary (Sundays)
```

### 3.2 Heartbeat Configuration

```javascript
// In electron-store settings
{
  "learningBrain": {
    "enabled": true,
    "service": {
      "mode": "auto",               // "auto" | "service" | "hybrid" | "disabled"
      "installed": true,            // Set by installer
      "installAttempted": true,
      "lastError": null
    },
    "heartbeat": {
      "interval": "24h",           // Daily by default
      "activeHours": {
        "start": "08:00",
        "end": "22:00",
        "timezone": "user"         // Use user's local timezone
      },
      "catchUp": {
        "enabled": true,           // Run catch-up if missed heartbeats
        "maxCatchUpDays": 7        // Don't try to catch up more than 7 days
      },
      "consolidation": {
        "episodeRetentionDays": 30,  // Keep raw episodes for 30 days
        "summaryRetentionDays": 365, // Keep summaries for 1 year
        "pruneInvalidatedDays": 90   // Remove old invalidated edges
      }
    },
    "notifications": {
      "enabled": true,
      "streakAlert": true,
      "weeklyReport": true,
      "struggleAlert": true,
      "welcomeBack": true,          // "Welcome back" after extended offline
      "dailySummary": true          // Daily learning summary
    }
  }
}
```

### 3.3 Background Service Implementation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SERVICE FILE STRUCTURE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  src/service/                       # Background Service (separate pkg)  │
│  ├── index.js                       # Service entry point                │
│  ├── HeartbeatScheduler.js          # Timing and wake-up                 │
│  ├── ServiceState.js                # Persistent state management        │
│  ├── IPCServer.js                   # Named Pipe / Unix Socket server    │
│  ├── NotificationBridge.js          # System notifications               │
│  ├── DatabaseBridge.js              # SQLite access (shared with app)    │
│  └── install/                                                            │
│      ├── install-windows.js         # Windows Service installer          │
│      ├── install-macos.js           # LaunchDaemon installer             │
│      └── install-linux.js           # systemd installer                  │
│                                                                          │
│  Service Dependencies (minimal):                                         │
│  ─────────────────────────────────                                       │
│  • better-sqlite3       (database access)                                │
│  • node-notifier        (system notifications)                           │
│  • node-windows/mac/linux (service installation)                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Service State Persistence

```javascript
// ServiceState.js - Survives computer restarts
// Stored in: %APPDATA%/SmartReader/service-state.json (Windows)
//            ~/Library/Application Support/SmartReader/service-state.json (macOS)
//            ~/.config/smartreader/service-state.json (Linux)

{
  "lastHeartbeat": "2024-01-15T22:00:00.000Z",
  "nextScheduledHeartbeat": "2024-01-16T22:00:00.000Z",
  "lastBootTime": "2024-01-16T08:00:00.000Z",
  "pendingNotifications": [],
  "cachedInsights": {
    "dueItems": 5,
    "weakConcepts": ["calculus", "derivatives"],
    "streakDays": 7,
    "lastUpdated": "2024-01-15T22:00:00.000Z"
  },
  "heartbeatHistory": [
    { "time": "2024-01-15T22:00:00.000Z", "status": "success", "duration": 1234 },
    { "time": "2024-01-14T22:00:00.000Z", "status": "success", "duration": 987 }
  ]
}
```

### 3.5 Notification Examples

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SYSTEM NOTIFICATION EXAMPLES                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Daily Review Reminder:                                                  │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  🧠 SmartReader                                          │            │
│  │  ─────────────────────────────────────────               │            │
│  │  5 items ready for review!                               │            │
│  │  Your streak: 7 days 🔥                                  │            │
│  │                                                          │            │
│  │  [Open SmartReader]                [Remind Later]        │            │
│  └─────────────────────────────────────────────────────────┘            │
│                                                                          │
│  Weekly Progress Report:                                                 │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  📊 SmartReader Weekly Report                            │            │
│  │  ─────────────────────────────────────────               │            │
│  │  This week: 42 items reviewed, 85% accuracy              │            │
│  │  Mastered: 8 new concepts                                │            │
│  │  Focus area: Calculus needs practice                     │            │
│  │                                                          │            │
│  │  [View Details]                    [Dismiss]             │            │
│  └─────────────────────────────────────────────────────────┘            │
│                                                                          │
│  Streak at Risk:                                                         │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  ⚠️ SmartReader                                          │            │
│  │  ─────────────────────────────────────────               │            │
│  │  Your 7-day streak ends in 2 hours!                      │            │
│  │  Just 3 quick reviews to keep it going.                  │            │
│  │                                                          │            │
│  │  [Quick Review]                    [Not Today]           │            │
│  └─────────────────────────────────────────────────────────┘            │
│                                                                          │
│  Welcome Back (after extended offline):                                  │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  👋 Welcome back to SmartReader!                         │            │
│  │  ─────────────────────────────────────────               │            │
│  │  You were away for 3 days.                               │            │
│  │  12 items are now overdue for review.                    │            │
│  │  Let's get back on track!                                │            │
│  │                                                          │            │
│  │  [Start Catch-Up]                  [Later]               │            │
│  └─────────────────────────────────────────────────────────┘            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Episode Collection System

### 4.1 Event Types and Payloads

```typescript
// Episode event types
enum LearningEventType {
  // Study Session Events
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended',

  // Review Events
  REVIEW_COMPLETED = 'review_completed',
  REVIEW_SKIPPED = 'review_skipped',

  // Performance Events
  QUIZ_TAKEN = 'quiz_taken',
  CONCEPT_STRUGGLED = 'concept_struggled',
  CONCEPT_MASTERED = 'concept_mastered',
  MASTERY_CHANGED = 'mastery_changed',

  // Content Events
  BOOK_OPENED = 'book_opened',
  BOOK_COMPLETED = 'book_completed',
  NOTE_CREATED = 'note_created',
  HIGHLIGHT_CREATED = 'highlight_created',

  // Goal Events
  GOAL_SET = 'goal_set',
  GOAL_PROGRESS = 'goal_progress',
  GOAL_COMPLETED = 'goal_completed',

  // Streak Events
  STREAK_EXTENDED = 'streak_extended',
  STREAK_BROKEN = 'streak_broken',

  // Brain Events (internal)
  PATTERN_DETECTED = 'pattern_detected',
  SUMMARY_CREATED = 'summary_created'
}

// Example episode payload
interface ReviewCompletedPayload {
  conceptId: string;
  conceptName: string;
  rating: 1 | 2 | 3 | 4;  // Again/Hard/Good/Easy
  responseTimeMs: number;
  hintUsed: boolean;
  previousBox: number;
  newBox: number;
  sourceContext: {
    planId?: string;
    sessionId?: string;
    view: string;  // 'study' | 'reading' | 'browser'
  };
}
```

### 4.2 Episode Collection Points

```javascript
// Integrated into existing code paths

// In StudySessionPage.js - after rating
async function handleRate(rating) {
  // Existing logic...

  // Collect episode
  await episodeCollector.record({
    eventType: 'review_completed',
    payload: {
      conceptId: currentItem.id,
      conceptName: currentItem.front,
      rating,
      responseTimeMs: Date.now() - itemStartTime,
      hintUsed: hintsUsed > 0,
      previousBox: currentItem.box,
      newBox: calculateNewBox(rating),
      sourceContext: { planId, sessionId, view: 'study' }
    }
  });
}

// In LeitnerSystem.js - on card flip
async function handleCorrect() {
  await episodeCollector.record({
    eventType: 'mastery_changed',
    payload: {
      itemId: card.id,
      itemType: 'vocabulary',
      direction: 'improved',
      fromBox: card.box,
      toBox: card.box + 1
    }
  });
}
```

---

## 5. Memory Consolidation Pipeline

### 5.1 Episode → Summary Transformation

Old episodes are consolidated into summary nodes to save space while preserving insights:

```
RAW EPISODES (last 30 days)                    SUMMARY NODE
─────────────────────────────                  ────────────
Episode: REVIEW_COMPLETED
  concept: "derivative"                        (:LearningPattern {
  rating: 2 (Hard)                               type: "WeakAreaCluster",
  timestamp: 2024-01-05                          summary: "User struggled with
                                                   calculus derivatives over
Episode: REVIEW_COMPLETED                          3 weeks. 12 reviews, avg
  concept: "derivative"                            rating 2.1. Improved after
  rating: 2 (Hard)                                 switching to visual
  timestamp: 2024-01-08                            explanations.",
                                                 confidence: 0.85,
Episode: REVIEW_COMPLETED                        memberConcepts: ["derivative",
  concept: "derivative"                            "integral", "chain_rule"],
  rating: 3 (Good)                               validFrom: 2024-01-05,
  timestamp: 2024-01-15                          validUntil: null,
                                                 derivedFromEpisodeCount: 12
Episode: CONCEPT_STRUGGLED                     })
  concept: "chain_rule"
  reason: "timeout"
  timestamp: 2024-01-12

... (12 episodes total)                        → 1 summary node
```

### 5.2 Consolidation Algorithm

```javascript
async function consolidateOldEpisodes(userId, olderThanDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  // 1. Query old episodes
  const oldEpisodes = await neo4j.run(`
    MATCH (e:Episode {userId: $userId})
    WHERE e.timestamp < $cutoff
    RETURN e
    ORDER BY e.timestamp
  `, { userId, cutoff: cutoffDate.toISOString() });

  // 2. Group by concept/topic
  const grouped = groupEpisodesByConcept(oldEpisodes);

  // 3. For each group, generate summary using AI
  for (const [conceptId, episodes] of Object.entries(grouped)) {
    if (episodes.length < 3) continue;  // Need minimum data

    const summary = await aiProvider.generateContent(
      createConsolidationPrompt(episodes)
    );

    // 4. Create summary node
    await neo4j.run(`
      CREATE (p:LearningPattern {
        id: $id,
        type: 'ConsolidatedHistory',
        summary: $summary,
        conceptId: $conceptId,
        episodeCount: $count,
        dateRange: {start: $start, end: $end},
        createdAt: datetime()
      })
    `, {
      id: generateId(),
      summary: summary.text,
      conceptId,
      count: episodes.length,
      start: episodes[0].timestamp,
      end: episodes[episodes.length - 1].timestamp
    });

    // 5. Link to concept
    await neo4j.run(`
      MATCH (p:LearningPattern {id: $patternId})
      MATCH (c:Concept {id: $conceptId})
      MERGE (p)-[:SUMMARIZES]->(c)
    `, { patternId: id, conceptId });

    // 6. Delete old episodes (keep references)
    await neo4j.run(`
      MATCH (e:Episode {userId: $userId})
      WHERE e.timestamp < $cutoff AND e.conceptId = $conceptId
      SET e:ArchivedEpisode
      REMOVE e:Episode
    `, { userId, cutoff: cutoffDate.toISOString(), conceptId });
  }
}
```

---

## 6. Intention Inference System

### 6.1 Pattern Detection Queries

```javascript
// Detect cramming behavior (exam preparation)
async function detectCrammingPattern(userId) {
  const result = await neo4j.run(`
    MATCH (e:Episode {userId: $userId, eventType: 'review_completed'})
    WHERE e.timestamp > datetime() - duration('P7D')
    WITH date(e.timestamp) as day, count(*) as reviewCount
    WHERE reviewCount > 50  // Unusually high
    RETURN count(day) as crammingDays
  `, { userId });

  if (result.crammingDays >= 3) {
    return {
      pattern: 'exam_preparation',
      confidence: 0.8,
      suggestion: 'User appears to be preparing for an exam. Consider offering focused review mode.'
    };
  }
}

// Detect struggling pattern
async function detectStrugglingPattern(userId) {
  const result = await neo4j.run(`
    MATCH (e:Episode {userId: $userId, eventType: 'review_completed'})
    WHERE e.timestamp > datetime() - duration('P14D')
    WITH e.payload.conceptId as concept,
         avg(e.payload.rating) as avgRating,
         count(*) as attempts
    WHERE avgRating < 2.5 AND attempts >= 3
    RETURN concept, avgRating, attempts
    ORDER BY avgRating ASC
    LIMIT 5
  `, { userId });

  return result.records.map(r => ({
    conceptId: r.get('concept'),
    avgRating: r.get('avgRating'),
    attempts: r.get('attempts'),
    intervention: 'Consider breaking down this concept or using alternative explanations'
  }));
}

// Detect optimal study times
async function detectOptimalStudyTimes(userId) {
  const result = await neo4j.run(`
    MATCH (e:Episode {userId: $userId, eventType: 'review_completed'})
    WHERE e.timestamp > datetime() - duration('P30D')
    WITH e.payload.rating as rating,
         time(e.timestamp).hour as hour,
         date(e.timestamp).dayOfWeek as dayOfWeek
    RETURN hour, dayOfWeek, avg(rating) as avgPerformance, count(*) as sessions
    ORDER BY avgPerformance DESC
  `, { userId });

  // Find top performing time slots
  return result.records
    .filter(r => r.get('sessions') >= 5)
    .slice(0, 3)
    .map(r => ({
      hour: r.get('hour'),
      dayOfWeek: r.get('dayOfWeek'),
      avgPerformance: r.get('avgPerformance')
    }));
}
```

### 6.2 Intention Categories

| Intention | Detection Signals | Brain Response |
|-----------|-------------------|----------------|
| **Exam Prep** | High review frequency, late nights, cramming patterns | Enable focus mode, suggest high-yield topics |
| **Casual Learning** | Steady pace, varied topics, no deadline pressure | Encourage exploration, suggest related topics |
| **Struggling** | Low ratings on same concept, long response times | Offer alternative explanations, break down concepts |
| **Maintenance** | Regular reviews, stable mastery | Optimize intervals, suggest new material |
| **Goal-Driven** | Activity aligned with set goals | Track progress, remind of milestones |
| **Abandoning** | Decreasing activity, broken streaks | Send re-engagement prompts, simplify goals |

---

## 7. Implementation Plan

### Phase 1: Background Service Foundation
```
src/service/                           # Standalone Node.js service
├── index.js                           # Service entry point
├── HeartbeatScheduler.js              # Timing and wake-up (setTimeout-based)
├── ServiceState.js                    # Persistent state (survives restarts)
├── IPCServer.js                       # Named Pipe / Unix Socket server
├── NotificationBridge.js              # System notifications (node-notifier)
├── DatabaseBridge.js                  # SQLite access (shared with app)
└── install/
    ├── ServiceInstaller.js            # Cross-platform installer
    ├── install-windows.js             # Windows Service (node-windows)
    ├── install-macos.js               # LaunchDaemon (node-mac)
    └── install-linux.js               # systemd service (node-linux)
```

### Phase 2: Hybrid Fallback (In-App Scheduler)
```
src/main/brain/
├── HybridScheduler.js                 # Fallback when service unavailable
├── CatchUpManager.js                  # Detect and handle missed heartbeats
├── ServiceClient.js                   # IPC client to connect to service
└── ServiceHealthCheck.js              # Monitor service status
```

### Phase 3: Episode Collection Infrastructure
```
src/main/brain/
├── EpisodeCollector.js                # Event recording hooks
├── EpisodeSchema.js                   # Event type definitions
└── EpisodeStore.js                    # Neo4j persistence
```

### Phase 4: Brain Logic (Reusing Existing Skills)
```
src/main/brain/
├── LearningBrainAgent.js              # Main brain orchestrator
├── BrainChecklist.js                  # BRAIN_CHECKLIST.md parser
├── BrainActionExecutor.js             # Action execution
└── integrations/
    ├── AdaptiveLearningBridge.js      # Reuse AdaptiveLearningSkill
    └── LearningGraphBridge.js         # Reuse LearningGraphSkill
```

### Phase 5: Memory Tiers
```
src/main/brain/
├── memory/
│   ├── EpisodicMemory.js              # Tier 1: Raw events
│   ├── SemanticMemory.js              # Tier 2: Entities
│   └── CommunityMemory.js             # Tier 3: Patterns
├── consolidation/
│   ├── ConsolidationPipeline.js       # LLM-powered summarization
│   └── SummaryGenerator.js            # Episode → Summary transforms
```

### Phase 6: Intention Inference
```
src/main/brain/
├── inference/
│   ├── PatternDetector.js             # Pattern queries (reuse existing)
│   ├── IntentionClassifier.js         # LLM-powered intention analysis
│   └── InterventionSuggester.js       # Action recommendations
```

### Phase 7: UI Integration
```
src/renderer/
├── components/brain/
│   ├── BrainInsightsPanel.js          # Show detected patterns
│   ├── LearningJourneyView.js         # Visualize episodic history
│   ├── BrainSettingsPanel.js          # Configure heartbeat & service
│   └── ServiceStatusIndicator.js      # Show service health
├── views/brain/
│   └── BrainDashboard.js              # Full brain dashboard view
```

### Implementation Priority Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION PHASES                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1-2: Foundation (Week 1-2)                                       │
│  ─────────────────────────────────                                       │
│  ✓ Background Service with installer                                     │
│  ✓ Hybrid fallback mechanism                                             │
│  ✓ Service-App IPC communication                                         │
│  ✓ System notifications                                                  │
│  Result: Heartbeat works even when app closed                           │
│                                                                          │
│  PHASE 3: Episode Collection (Week 3)                                   │
│  ────────────────────────────────────                                    │
│  ✓ Define episode schema                                                 │
│  ✓ Hook into existing code paths (StudySession, Leitner, etc.)          │
│  ✓ Store episodes in Neo4j                                               │
│  Result: Learning events are captured with timestamps                   │
│                                                                          │
│  PHASE 4: Brain Logic (Week 4)                                          │
│  ─────────────────────────────                                           │
│  ✓ Create LearningBrainAgent orchestrator                                │
│  ✓ Integrate with existing AdaptiveLearningSkill                         │
│  ✓ Integrate with existing LearningGraphSkill                            │
│  Result: Brain can analyze patterns using existing code                 │
│                                                                          │
│  PHASE 5-6: Memory & Inference (Week 5-6)                               │
│  ────────────────────────────────────────                                │
│  ✓ Implement memory tiers (episodic → semantic → community)              │
│  ✓ Build consolidation pipeline (LLM summarization)                      │
│  ✓ Add intention inference (LLM-powered)                                 │
│  Result: Old episodes consolidated, user intention understood           │
│                                                                          │
│  PHASE 7: UI (Week 7)                                                   │
│  ────────────────────                                                    │
│  ✓ Brain dashboard view                                                  │
│  ✓ Service status indicator                                              │
│  ✓ Insights panel                                                        │
│  Result: User can see brain insights and configure settings             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Neo4j Schema Extensions

```cypher
// Episode node
CREATE CONSTRAINT episode_id IF NOT EXISTS
FOR (e:Episode) REQUIRE e.id IS UNIQUE;

CREATE INDEX episode_user_time IF NOT EXISTS
FOR (e:Episode) ON (e.userId, e.timestamp);

CREATE INDEX episode_type IF NOT EXISTS
FOR (e:Episode) ON (e.eventType);

// Learning Pattern node
CREATE CONSTRAINT pattern_id IF NOT EXISTS
FOR (p:LearningPattern) REQUIRE p.id IS UNIQUE;

// Learning Entity node (semantic tier)
CREATE CONSTRAINT learning_entity_id IF NOT EXISTS
FOR (le:LearningEntity) REQUIRE le.id IS UNIQUE;

CREATE VECTOR INDEX learning_entity_embedding IF NOT EXISTS
FOR (le:LearningEntity) ON (le.embedding)
OPTIONS {indexConfig: {`vector.dimensions`: 1024, `vector.similarity_function`: 'cosine'}};

// Bi-temporal relationships
// All relationships should include:
// - t_valid, t_invalid (event timeline)
// - t_created, t_expired (ingestion timeline)
```

---

## 9. API Surface

### IPC Handlers (Main Process)

```javascript
// Episode collection
ipcMain.handle('brain-record-episode', (event, episode) => {...});
ipcMain.handle('brain-get-episodes', (event, query) => {...});

// Heartbeat control
ipcMain.handle('brain-trigger-heartbeat', () => {...});
ipcMain.handle('brain-get-status', () => {...});
ipcMain.handle('brain-configure', (event, config) => {...});

// Memory queries
ipcMain.handle('brain-get-patterns', (event, userId) => {...});
ipcMain.handle('brain-get-insights', (event, userId) => {...});
ipcMain.handle('brain-get-journey', (event, userId, timeRange) => {...});

// Consolidation
ipcMain.handle('brain-consolidate-now', () => {...});
ipcMain.handle('brain-get-consolidation-status', () => {...});
```

### Renderer API

```javascript
// src/renderer/api/brainApi.js
export const brainApi = {
  recordEpisode: (episode) => ipcRenderer.invoke('brain-record-episode', episode),
  triggerHeartbeat: () => ipcRenderer.invoke('brain-trigger-heartbeat'),
  getPatterns: () => ipcRenderer.invoke('brain-get-patterns'),
  getInsights: () => ipcRenderer.invoke('brain-get-insights'),
  getLearningJourney: (timeRange) => ipcRenderer.invoke('brain-get-journey', timeRange),
  configure: (config) => ipcRenderer.invoke('brain-configure', config),
};
```

---

## 10. Summary

The AI Learning Brain transforms SmartReader from a **reactive tool** into a **proactive learning companion** by:

1. **Collecting episodic memory** of every significant learning event
2. **Waking periodically** via heartbeat to analyze and act
3. **Understanding user intention** through temporal pattern analysis
4. **Making autonomous decisions** about learning priorities
5. **Consolidating old memories** into efficient summaries
6. **Providing insights** the user couldn't see themselves

The key insight is that **without memory of the past, the AI cannot truly understand or help the learner**. By implementing Graphiti-style episodic memory with OpenClaw-style heartbeat, the Learning Brain becomes a genuine autonomous agent managing the learning journey.

---

## References

- [Graphiti GitHub](https://github.com/getzep/graphiti) - Real-time knowledge graph for AI agents
- [Zep: A Temporal Knowledge Graph Architecture](https://arxiv.org/html/2501.13956v1) - Research paper on bi-temporal memory
- [OpenClaw Heartbeat Documentation](https://docs.openclaw.ai/gateway/heartbeat) - Periodic agent wake-up mechanism
- [Neo4j Documentation](https://neo4j.com/docs/) - Graph database for memory storage

---

*Document version: 1.0*
*Created: 2026-02-24*
