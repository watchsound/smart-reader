## AI Learning Brain

An autonomous background agent that manages learning through episodic memory and periodic analysis. Inspired by [OpenClaw](https://openclaw.ai) heartbeat mechanism and [Graphiti/Zep](https://github.com/getzep/graphiti) episodic memory.

> **Note (2026-06-18):** This document describes the foundational Brain layer (background service, episode collection, consolidation). Phase 9–15 added significant layers on top. Read this whole section first for the current shape; the rest of the doc remains authoritative for the foundational pieces.

### Current Stack (Phase 9–15)

The Brain today is a layered stack. Foundational layer (this doc, below) sits at the bottom; Phase 9 adds the LLM access spine; Phase 10b adds AI-driven sessions; Phase 11–12 add visibility + trajectory; Phase 13 adds attribution; Phase 14 adds the Predictive Engine and four consumers; Phase 15 adds reliability + anomaly detection.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Brain Dashboard surfaces (BrainDashboardPanel)                       │
│  Overview │ Trigger Log │ Spend & Returns │ Predictions │ Plan │     │
│  Health   │ Visibility                                                │
└──────────────────────────────────────────────────────────────────────┘
                                  ▲
┌─────────────────────────────────┴────────────────────────────────────┐
│  Phase 14a Predictive Engine + consumers                              │
│  brain/predictive/PredictiveEngine         (empirical-Bayes model)    │
│  brain/predictive/conceptProjection         (per-concept ETA, 14c)    │
│  utils/BudgetSessionPlanner                 (14d budget planner)      │
│  utils/QuestPacingService                   (14e Quest pacing)        │
│  renderer/brain/triggerToCell               (14b queue ROI rank)      │
└─────────────────────────────────▲────────────────────────────────────┘
                                  │  consumes
┌─────────────────────────────────┴────────────────────────────────────┐
│  Phase 13 Attribution Layer                                           │
│  utils/AttributionService    (mastery_event ⋈ brain_call_ledger)     │
│  db.feature_surface enum     (proximate_call_id + amortized cost)    │
└─────────────────────────────────▲────────────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────────────┐
│  Phase 11–12 Visibility + Trajectory                                  │
│  utils/BrainVisibilityService    (dashboard + concept inspector)     │
│  db/MasteryEventStore            (append-only mastery_event table)   │
└─────────────────────────────────▲────────────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────────────┐
│  Phase 10/10b Director Mode                                           │
│  brain/director/SessionRunner    (AI-driven study sessions)          │
│  brain/spine/tools.js            (registered Brain-invokable tools)  │
└─────────────────────────────────▲────────────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────────────┐
│  Phase 9 Brain Spine (every LLM call)                                 │
│  brain/spine/brainCall + meteredCall + meteredCallJson               │
│  brain/spine/providerFailover    (Phase 15a-1 same-provider retry)   │
│  brain/spine/BrainContext        (canonical learner snapshot)        │
│  brain/spine/intents             (Intent Registry)                   │
│  db/CallLedgerStore              (brain_call_ledger + latency stats) │
└─────────────────────────────────▲────────────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────────────┐
│  Phase 15b Anomaly Detection (cross-cutting)                          │
│  utils/BrainAnomalyDetector     (4 detectors, nightly + on-demand)   │
│  db.brain_anomaly               (persisted + acknowledge state)      │
└─────────────────────────────────▲────────────────────────────────────┘
                                  │  reads from all layers
┌─────────────────────────────────┴────────────────────────────────────┐
│  Foundational layer (this document, below)                            │
│  brain/LearningBrainAgent        (heartbeat orchestrator)            │
│  brain/EpisodeCollector          (episodic memory)                   │
│  brain/HybridScheduler           (timing)                            │
│  utils/ConsolidationService      (LLM-driven memory consolidation)   │
└──────────────────────────────────────────────────────────────────────┘
```

**The heartbeat (`LearningBrainAgent.runHeartbeat`) now runs three extra steps after the original Brain checklist:**
1. Phase 9 Call Ledger prune (90d / 10K rows LRU)
2. Phase 14a Predictive Engine model refresh (24h cache)
3. Phase 15b anomaly rescan (24h throttle)

**Read the specs for design rationale:**
- [Phase 9 — Brain Spine](../superpowers/specs/2026-06-17-phase-9-brain-spine-design.md)
- [Phase 10b — Study-Session Director](../superpowers/specs/2026-06-17-phase-10b-study-session-director-design.md)
- [Phase 11 — Brain Visibility](../superpowers/specs/2026-06-17-phase-11-brain-visibility-design.md)
- [Phase 12 — Mastery Trajectory](../superpowers/specs/2026-06-17-phase-12-mastery-trajectory-design.md)
- [Phase 13 — Attribution Layer](../superpowers/specs/2026-06-18-phase-13-attribution-design.md)
- [Phase 14a — Predictive Engine](../superpowers/specs/2026-06-18-phase-14a-predictive-engine-design.md)
- [Phase 14b — ROI-Ranked Proposal Queue](../superpowers/specs/2026-06-18-phase-14b-roi-ranked-queue-design.md)
- [Phase 14c — Concept ETA Sparkline](../superpowers/specs/2026-06-18-phase-14c-concept-eta-sparkline-design.md)
- [Phase 14d — Budget Session Planner](../superpowers/specs/2026-06-18-phase-14d-budget-session-planner-design.md)
- [Phase 14e — Quest Pacing Forecaster](../superpowers/specs/2026-06-18-phase-14e-quest-pacing-forecaster-design.md)
- [Phase 15a — Reset & Deepen](../superpowers/specs/2026-06-18-phase-15a-reset-and-deepen-design.md)
- [Phase 15b — Anomaly Detection](../superpowers/specs/2026-06-18-phase-15b-anomaly-detection-design.md)

Glossary: [CONTEXT.md](../../CONTEXT.md)

---

### Foundational layer (original document)

The remainder of this document describes the original Phase 0–8 layer: the background service, episode collector, consolidation pipeline, and notification system. Still in active use; the Phase 9+ stack composes on top of it.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LEARNING BRAIN SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Background Service (survives app exit)                            │ │
│  │  ──────────────────────────────────────                            │ │
│  │  src/service/                                                      │ │
│  │  ├── index.js              Main service entry point                │ │
│  │  ├── HeartbeatScheduler.js Timing and wake-up logic               │ │
│  │  ├── ServiceState.js       Persistent state (survives restarts)   │ │
│  │  ├── IPCServer.js          Named Pipe / Unix Socket server        │ │
│  │  ├── NotificationBridge.js System notifications                   │ │
│  │  ├── DatabaseBridge.js     SQLite read access                     │ │
│  │  └── install/ServiceInstaller.js  Cross-platform installer        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              │ IPC (Named Pipe / Unix Socket)           │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Main Electron App (hybrid fallback)                               │ │
│  │  ──────────────────────────────────                                │ │
│  │  src/main/brain/                                                   │ │
│  │  ├── index.js              Module exports                         │ │
│  │  ├── LearningBrainAgent.js Brain orchestrator                     │ │
│  │  ├── HybridScheduler.js    Fallback scheduler                     │ │
│  │  ├── ServiceClient.js      IPC client to service                  │ │
│  │  └── EpisodeCollector.js   Learning event collection              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Background Service** | Runs independently of Electron, survives app exit |
| **Hybrid Fallback** | In-app scheduler if service installation fails |
| **Episodic Memory** | Collects timestamped learning events to Neo4j |
| **Heartbeat System** | Periodic wake-up (default 24h) for analysis |
| **System Notifications** | Notifies user even when app is closed |
| **Catch-up Logic** | Handles missed heartbeats after computer off |

### Episode Types

```javascript
import { EPISODE_TYPES, recordEvent } from '../api/brainApi';

// Record a review completion
recordEvent.reviewCompleted({
  conceptId: item.id,
  conceptName: item.front,
  rating: 3, // 1=Again, 2=Hard, 3=Good, 4=Easy
  responseTimeMs: 2500,
  hintUsed: false,
  previousBox: 2,
  newBox: 3,
});

// Record session start/end
recordEvent.sessionStarted({ planId, mode, date });
recordEvent.sessionEnded({ sessionId, itemsReviewed, accuracy });

// Other events
recordEvent.bookOpened({ bookId, title });
recordEvent.noteCreated({ noteId, sourceType });
recordEvent.masteryChanged({ itemId, direction: 'improved', fromBox: 2, toBox: 3 });
```

### IPC Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `brain-get-status` | invoke | Get brain status (mode, running, etc.) |
| `brain-get-insights` | invoke | Get cached insights (quick) |
| `brain-trigger-heartbeat` | invoke | Trigger immediate heartbeat |
| `brain-record-episode` | invoke | Record a learning event |
| `brain-get-episodes` | invoke | Get recent episodes |
| `brain-get-config` | invoke | Get brain configuration |
| `brain-set-config` | invoke | Update configuration |
| `brain-set-enabled` | invoke | Enable/disable brain |
| `brain-service-status` | invoke | Get background service status |
| `brain-service-install` | invoke | Install background service |
| `brain-service-uninstall` | invoke | Uninstall background service |

### Renderer API

```javascript
import brainApi from '../api/brainApi';

// Status and insights
const status = await brainApi.getStatus();
const insights = await brainApi.getInsights();

// Trigger heartbeat manually
await brainApi.triggerHeartbeat();

// Record episode
await brainApi.recordEpisode({
  eventType: 'REVIEW_COMPLETED',
  payload: { conceptId, rating, responseTimeMs },
});

// Service management
await brainApi.installService();
await brainApi.uninstallService();
const serviceStatus = await brainApi.getServiceStatus();

// Configuration
await brainApi.setEnabled(true);
await brainApi.setConfig({ notifications: { streakAlert: true } });
```

### Background Service Dependencies

```bash
# Windows
npm install node-windows node-notifier

# macOS
npm install node-mac node-notifier

# Linux
npm install node-linux node-notifier
```

### Settings UI

The brain settings are available in Settings → "AI Learning Brain":
- Enable/disable toggle
- Current insights display
- Heartbeat schedule and manual trigger
- Background service install/uninstall
- Notification preferences

### Documentation

**Comprehensive LLM-Driven Learning Management System**: [LLM-DRIVEN-LEARNING-MANAGEMENT-SYSTEM.md](LLM-DRIVEN-LEARNING-MANAGEMENT-SYSTEM.md) - Complete reference for the LLM-driven scheduling, personalization, and memory systems.

Full architecture documentation: [AI-Learning-Brain-Architecture.md](AI-Learning-Brain-Architecture.md)

Comprehensive agentic AI analysis: [Agentic-AI-Implementation-Analysis.md](Agentic-AI-Implementation-Analysis.md)

### Memory Consolidation

LLM-powered memory consolidation that periodically summarizes raw learning episodes into higher-level memory patterns. Inspired by [Graphiti/Zep](https://github.com/getzep/graphiti) episodic memory consolidation.

**Architecture:**

```
Tier 1: Episodic Memory (raw events)
├── Individual learning events
├── Bi-temporal timestamps (t_valid, t_created)
└── Buffered + flushed to Neo4j/local storage

        ↓ (consolidation via LLM)

Tier 2: Consolidated Memory (synthesized)
├── LLM-generated summaries
├── Concept-level insights
├── Learning process analysis
└── Stored in SQLite (consolidated_memory table)
```

**Key Files:**

| File | Purpose |
|------|---------|
| `src/main/db/ConsolidatedMemoryManager.js` | SQLite CRUD for consolidated memories |
| `src/main/utils/ConsolidationService.js` | Core consolidation logic and LLM synthesis |
| `src/main/utils/SummarizationGraphService.js` | Neo4j graph patterns for memory relationships |
| `src/commons/utils/AIPrompts.js` | `createMemoryConsolidationPrompt()` function |
| `src/main/brain/LearningBrainAgent.js` | `runConsolidation()` integration |
| `src/main/brain/EpisodeCollector.js` | `markAsProcessed()` for tracking |

**Consolidation Pipeline:**

```
Heartbeat (24h) or Manual Trigger
        │
        ▼
Query Episodes (last 7 days, unprocessed)
        │
        ▼
Group by Concept Clusters
  └── Detect context shifts (gaps > 24h)
  └── Sort chronologically within clusters
        │
        ▼
For each cluster (≥3 episodes):
  ├── Analyze learning process
  │   ├── Accuracy, box progression
  │   ├── Struggle patterns
  │   ├── Cramming detection
  │   └── Response time analysis
  ├── Call LLM for synthesis
  ├── Store ConsolidatedMemory
  └── Mark episodes as processed
        │
        ▼
Archive old episodes (30 days) → Delete (90 days)
```

**Memory Types:**

| Type | Description |
|------|-------------|
| `concept_session` | Single learning session for a specific concept |
| `daily` | Daily summary across all concepts |
| `weekly` | Weekly learning summary |

**Mastery Assessment Levels:**

| Level | Description |
|-------|-------------|
| `beginner` | <50% accuracy, needs fundamentals |
| `developing` | 50-80% accuracy, progressing |
| `proficient` | 80-95% accuracy, strong understanding |
| `mastered` | >95% accuracy, fully learned |

**Learning Style Classifications:**

| Style | Pattern |
|-------|---------|
| `quick` | Fast mastery, few repetitions needed |
| `steady` | Consistent, gradual improvement |
| `needs-repetition` | Requires multiple reviews |
| `variable` | Inconsistent performance |

**IPC Handlers (Memory Consolidation):**

| Handler | Type | Purpose |
|---------|------|---------|
| `brain-consolidate-now` | invoke | Trigger manual consolidation |
| `brain-get-memories` | invoke | Get consolidated memories with filters |
| `brain-get-memory` | invoke | Get single memory by ID |
| `brain-search-memories` | invoke | Search memories by content |
| `brain-get-consolidation-stats` | invoke | Get consolidation statistics |
| `brain-delete-memory` | invoke | Delete a consolidated memory |
| `brain-delete-old-memories` | invoke | Delete memories older than N days |
| `brain-get-episode-stats` | invoke | Get episode statistics |

**Renderer API (Memory Consolidation):**

```javascript
import brainApi, { MEMORY_TYPES, MASTERY_LEVELS, LEARNING_STYLES } from '../api/brainApi';

// Trigger manual consolidation
const result = await brainApi.consolidateNow({ token, periodDays: 7, minEpisodes: 3 });

// Get consolidated memories
const memories = await brainApi.getConsolidatedMemories({
  token,
  conceptId: 'concept_123',
  memoryType: MEMORY_TYPES.CONCEPT_SESSION,
  limit: 20,
});

// Search memories
const results = await brainApi.searchMemories('vocabulary', token);

// Get statistics
const stats = await brainApi.getConsolidationStats(token);
// { totalMemories, totalEpisodesConsolidated, uniqueConcepts, masteryDistribution }

// Get episode statistics
const episodeStats = await brainApi.getEpisodeStats();
// { total, byType, processedCount, unprocessedCount, bufferSize }
```

**Consolidated Memory Schema:**

```sql
CREATE TABLE "consolidated_memory" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "concept_id" TEXT,
  "concept_name" TEXT,
  "memory_type" TEXT NOT NULL,        -- concept_session, daily, weekly
  "period_start" TEXT NOT NULL,
  "period_end" TEXT NOT NULL,
  "episode_count" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,            -- LLM-generated narrative
  "insights" TEXT,                    -- JSON: key patterns
  "learning_process" TEXT,            -- JSON: process analysis
  "metrics" TEXT,                     -- JSON: accuracy, times, etc.
  "source_episodes" TEXT,             -- JSON: episode IDs
  "mastery_assessment" TEXT,          -- beginner/developing/proficient/mastered
  "learning_style" TEXT,              -- quick/steady/needs-repetition/variable
  "recommendations" TEXT,             -- JSON: actionable suggestions
  "created_at" TEXT NOT NULL,
  "expires_at" TEXT
);
```

**LLM Synthesis Output:**

```json
{
  "summary": "Learning session for 'ephemeral' with 8 reviews. Started with difficulty but improved after hint usage...",
  "keyInsights": [
    "Struggled initially but improved after 3rd attempt",
    "Response time decreased from 5s to 2s indicating familiarity"
  ],
  "masteryAssessment": "developing",
  "learningStyle": "steady",
  "progressionNarrative": "Initial confusion resolved through repetition and hints...",
  "strugglingAreas": ["Spelling", "Context usage"],
  "breakthroughMoments": ["Correct on 5th attempt without hint"],
  "recommendations": ["Practice in sentence context"],
  "metrics": {
    "totalReviews": 8,
    "correctRate": 62,
    "averageResponseTimeMs": 3200,
    "consistencyScore": 45
  }
}
```

**Test Commands:**

```bash
# Run consolidation tests
npm test -- --testPathPattern=consolidation

# Run specific test files
npm test -- --testPathPattern=ConsolidatedMemoryManager.test.js
npm test -- --testPathPattern=ConsolidationService.test.js
```

**Neo4j Graph Integration:**

Consolidated memories are synced to Neo4j with full relationship tracking. See [Memory Consolidation Graph](graph-database.md#memory-consolidation-graph-summarizationgraphservice) for details on:
- `:CONSOLIDATED_INTO` relationships (Episode → ConsolidatedMemory)
- `:SUMMARIZES` relationships (ConsolidatedMemory → Concept)
- `:MEMORY_RELATES` relationships (ConsolidatedMemory ↔ ConsolidatedMemory)
- Aggregated mastery calculation from memory data
- Memory gap detection and coverage analysis

### Cross-Concept Analysis & Learner Profile Inference

Advanced pattern detection that analyzes relationships between concepts and infers learner characteristics from behavioral data.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CROSS-CONCEPT ANALYSIS SYSTEM                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Episodic Memory (raw events)                                        │
│         │                                                            │
│         ▼                                                            │
│  CrossConceptAnalyzer.js                                             │
│  ├── Prerequisite detection (temporal correlation)                  │
│  ├── Interference detection (negative correlation)                  │
│  ├── Positive transfer (correlated velocities)                      │
│  ├── Concept clustering (co-study patterns)                         │
│  └── Forgetting correlation (decay together)                        │
│         │                                                            │
│         ▼                                                            │
│  LearnerProfileInference.js                                          │
│  ├── Learning style inference (visual, textual, mixed)              │
│  ├── Optimal timing (time of day, session length)                   │
│  ├── Forgetting curve modeling                                       │
│  ├── Pace preferences (burst, steady, marathon)                     │
│  └── Engagement patterns                                             │
│         │                                                            │
│         ▼                                                            │
│  Profile Updates → SQLite + Neo4j                                    │
│  Recommendations → Scheduling, Content, Strategy                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Files:**

| File | Purpose |
|------|---------|
| `src/commons/model/LearningPatterns.ts` | TypeScript types for all pattern categories |
| `src/main/utils/CrossConceptAnalyzer.js` | Pattern detection service |
| `src/main/utils/LearnerProfileInference.js` | Profile inference service |
| `src/main/utils/ConsolidationService.js` | Integration with consolidation pipeline |
| `src/main/ipc/brainHandlers.js` | IPC handlers for analysis |
| `src/renderer/api/brainApi.js` | Renderer-side API |

**Pattern Categories:**

| Category | Patterns |
|----------|----------|
| **Temporal** | Optimal study time, session duration, cramming, spacing compliance |
| **Performance** | Struggle chains, response time, confidence calibration, hint usage |
| **Cross-Concept** | Prerequisites, interference, positive transfer, clustering, forgetting correlation |
| **Behavioral** | Session triggers, quit signals, content preferences, pace, goal orientation |

**Cross-Concept Pattern Types:**

| Pattern | Detection Method | Insight |
|---------|------------------|---------|
| `PREREQUISITE` | Concept A mastered before B improves B's learning | "Study A before B" |
| `INTERFERENCE` | Negative correlation between concepts | "Space out A and B" |
| `POSITIVE_TRANSFER` | Correlated learning velocities | "A and B reinforce each other" |
| `CONCEPT_CLUSTER` | Frequently studied together | "Group for efficient learning" |
| `FORGETTING_CORRELATION` | Decay together over time | "Review A and B together" |

**Learner Profile Fields:**

```typescript
interface LearnerGlobalProfile {
  learningStyle: 'visual' | 'textual' | 'mixed';
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'flexible';
  optimalSessionLength: number;  // minutes
  consistencyScore: number;      // 0-100
  forgettingCurveSlope: number;  // lower = better retention
  pacePreference: 'burst' | 'steady' | 'marathon';
  aiInsights: string[];
}

interface LearnerDomainProfile {
  domainType: string;
  accuracyTrend: 'improving' | 'stable' | 'declining';
  learningVelocityTrend: 'accelerating' | 'stable' | 'decelerating';
  weakAreas: WeakArea[];
  strongAreas: string[];
  suggestedFocus: string[];
}
```

**IPC Handlers (Cross-Concept & Profile):**

| Handler | Type | Purpose |
|---------|------|---------|
| `brain-analyze-cross-concept` | invoke | Run cross-concept pattern analysis |
| `brain-get-cross-concept-patterns` | invoke | Get recent patterns |
| `brain-get-concept-patterns` | invoke | Get patterns for specific concept |
| `brain-infer-profile` | invoke | Run learner profile inference |
| `brain-get-learner-profile` | invoke | Get current profile (global + domains) |
| `brain-get-domain-profile` | invoke | Get profile for specific domain |
| `brain-update-profile` | invoke | Update profile manually |
| `brain-get-recommendations` | invoke | Get personalized learning recommendations |
| `brain-get-optimal-study-times` | invoke | Get optimal study times |
| `brain-get-concept-relationships` | invoke | Get concept graph for visualization |

**Renderer API:**

```javascript
import brainApi, { PATTERN_TYPES, DOMAIN_TYPES } from '../api/brainApi';

// Run cross-concept analysis
const analysis = await brainApi.analyzeCrossConcept({
  token,
  lookbackDays: 30,
  correlationThreshold: 0.6,
  enabledPatterns: ['temporal', 'performance', 'cross_concept'],
});
// Returns: { temporalPatterns, performancePatterns, crossConceptPatterns, summary }

// Get patterns for a specific concept
const patterns = await brainApi.getConceptPatterns('concept_123', token);
// Returns: { memoryCount, latestSummary, masteryAssessment, relatedPatterns, insights }

// Run profile inference
const profile = await brainApi.inferProfile({ token, lookbackDays: 30 });
// Returns: { inferences, summary, confidence }

// Get current learner profile
const { global, domains } = await brainApi.getLearnerProfile(token);

// Get personalized recommendations
const recommendations = await brainApi.getRecommendations({ token });
// Returns: { scheduling, content, strategy }

// Get concept relationship graph
const graph = await brainApi.getConceptRelationships(token, 50);
// Returns: { nodes, edges } for visualization
```

**Recommendation Types:**

| Type | Examples |
|------|----------|
| **Scheduling** | "Best study time: morning", "Aim for 25-minute sessions" |
| **Content** | "Study 'algebra' before 'calculus'", "Space out similar concepts" |
| **Strategy** | "Cramming detected - use spacing", "Improve consistency" |

**Integration with Consolidation:**

Cross-concept analysis and profile inference run automatically during consolidation:

```javascript
// In ConsolidationService.consolidateEpisodes():
// 1. Per-concept consolidation (existing)
// 2. Cross-concept analysis (new) - if ≥2 concept clusters
// 3. Profile inference (new) - updates learner profile
// 4. Generate recommendations
```

**Test Commands:**

```bash
# Run cross-concept tests
npm test -- --testPathPattern=CrossConceptAnalyzer.test.js
npm test -- --testPathPattern=LearnerProfileInference.test.js

# Run all brain tests
npm test -- --testPathPattern=brain
```

### Schedule Reconciliation Agent

LLM-driven schedule reconciliation that dynamically adjusts learning schedules based on the learner's personal forgetting curve, cross-concept patterns, and study behavior.

**Key Features:**
- Uses learner's measured forgetting curve instead of hardcoded decay formulas
- LLM-driven prioritization considering prerequisites and interference
- Personalized gap thresholds relative to optimal review interval
- Same-day session handling with duplicate filtering
- Catch-up plan generation for extended absences

**Key Files:**

| File | Purpose |
|------|---------|
| `src/main/brain/ScheduleReconciliationAgent.js` | Core LLM-driven reconciliation agent |
| `src/main/utils/LearningPlanGenerator.js` | `calculatePersonalizedInterval()` method |
| `src/main/db/LearningPlanManager.js` | `getDueItemsReconciled()` method |
| `src/main/ipc/brainHandlers.js` | Schedule reconciliation IPC handlers |
| `src/renderer/api/scheduleApi.js` | Renderer-side API |

**IPC Handlers:**

| Handler | Type | Purpose |
|---------|------|---------|
| `schedule-get-due-reconciled` | invoke | Get reconciled due items with LLM prioritization |
| `schedule-reconcile` | invoke | Full schedule reconciliation |
| `schedule-get-overdue-grouped` | invoke | Get items grouped by severity (critical/important/routine) |
| `schedule-generate-catch-up` | invoke | Generate multi-day catch-up plan |
| `schedule-clear-cache` | sync | Clear reconciliation cache |
| `schedule-reconciliation-available` | sync | Check if reconciliation available |

**Gap Severity Levels:**

Gap severity is calculated relative to the learner's personal optimal review interval:

| Severity | Threshold | Description |
|----------|-----------|-------------|
| `minor` | < 1x optimal interval | Within normal range |
| `moderate` | 1-2x optimal interval | Needs attention |
| `significant` | 2-3x optimal interval | Risk of forgetting |
| `critical` | > 3x optimal interval | Urgent review needed |

**Renderer API:**

```javascript
import scheduleApi, { GAP_SEVERITY, getGapSeverityInfo } from '../api/scheduleApi';

// Get reconciled due items
const result = await scheduleApi.getDueItemsReconciled({
  planId: 'plan_123',
  limit: 20,
  token
});
// Returns: { items, metadata: { gapType, userMessage, reconciled } }

// Full reconciliation
const reconciliation = await scheduleApi.reconcileSchedule({
  planId: 'plan_123',
  token,
  options: { forceReconcile: true }
});

// Get overdue grouped by severity
const grouped = await scheduleApi.getOverdueGrouped({ planId, token });
// Returns: { critical: [...], important: [...], routine: [...], total: number }

// Generate catch-up plan
const plan = await scheduleApi.generateCatchUpPlan({
  token,
  availableMinutesPerDay: 30,
  targetCatchUpDays: 7
});

// Helper functions
const severityInfo = getGapSeverityInfo(daysOverdue, optimalInterval);
// Returns: { severity, label, color }
```

**Episode Tracking:**

Reviews now track `daysOverdue` for better decay analysis:

```javascript
// In REVIEW_COMPLETED episode
{
  eventType: 'REVIEW_COMPLETED',
  payload: {
    conceptId: 'item_123',
    rating: 3,
    daysOverdue: 5,      // How late the review was
    wasOverdue: true,    // Boolean flag
    // ... other fields
  }
}
```

**Test Commands:**

```bash
# Run schedule reconciliation tests
npm test -- --testPathPattern=ScheduleReconciliationAgent

# Run all schedule-related tests
npm test -- --testPathPattern="schedule|brain"
```
