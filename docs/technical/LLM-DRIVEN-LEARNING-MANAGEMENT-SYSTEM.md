# LLM-Driven Learning Management System

## Executive Summary

SmartReader v2 implements a **comprehensive, LLM-driven learning management system** that uses AI reasoning instead of hardcoded rules for all scheduling, prioritization, and personalization decisions. This document provides a complete reference for the system architecture, components, algorithms, and integration points.

**Core Philosophy**: Every learning decision that can benefit from context-awareness should be made by the LLM, using the learner's personal profile data, cross-concept patterns, and episodic memory rather than generic formulas.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Three-Tier Memory System](#2-three-tier-memory-system)
3. [Learner Profile & Inference](#3-learner-profile--inference)
4. [Schedule Reconciliation Agent](#4-schedule-reconciliation-agent)
5. [Cross-Concept Pattern Detection](#5-cross-concept-pattern-detection)
6. [Memory Consolidation Pipeline](#6-memory-consolidation-pipeline)
7. [Episode Collection System](#7-episode-collection-system)
8. [AI Prompts Library](#8-ai-prompts-library)
9. [API Reference](#9-api-reference)
10. [Edge Cases & Scenarios](#10-edge-cases--scenarios)
11. [Integration Points](#11-integration-points)
12. [Testing](#12-testing)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LLM-DRIVEN LEARNING MANAGEMENT                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         RENDERER PROCESS                                  │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐│ │
│  │  │ Study       │ │ Learning    │ │ Leitner     │ │ Knowledge           ││ │
│  │  │ SessionPage │ │ Calendar    │ │ System      │ │ Dashboard           ││ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────────┬──────────┘│ │
│  │         │               │               │                    │           │ │
│  │  ┌──────▼───────────────▼───────────────▼────────────────────▼─────────┐│ │
│  │  │                        API Layer                                     ││ │
│  │  │  scheduleApi.js │ learningPlanApi.js │ brainApi.js │ graphApi.js    ││ │
│  │  └──────────────────────────────┬───────────────────────────────────────┘│ │
│  └─────────────────────────────────┼────────────────────────────────────────┘ │
│                                    │ IPC                                      │
│  ┌─────────────────────────────────▼────────────────────────────────────────┐ │
│  │                         MAIN PROCESS                                       │ │
│  │                                                                            │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐   │ │
│  │  │                    IPC HANDLERS                                     │   │ │
│  │  │  brainHandlers.js │ learningPlanHandlers.js │ graphHandlers.js     │   │ │
│  │  └──────────────────────────────┬─────────────────────────────────────┘   │ │
│  │                                 │                                          │ │
│  │  ┌──────────────────────────────▼─────────────────────────────────────┐   │ │
│  │  │                    LLM-DRIVEN CORE                                  │   │ │
│  │  │  ┌───────────────────────────────────────────────────────────────┐ │   │ │
│  │  │  │  ScheduleReconciliationAgent                                   │ │   │ │
│  │  │  │  • getDueItemsReconciled()                                    │ │   │ │
│  │  │  │  • reconcileSchedule()                                        │ │   │ │
│  │  │  │  • generateCatchUpPlan()                                      │ │   │ │
│  │  │  │  • calculatePersonalizedInterval()                            │ │   │ │
│  │  │  └───────────────────────────────────────────────────────────────┘ │   │ │
│  │  │                                                                    │   │ │
│  │  │  ┌───────────────────────────────────────────────────────────────┐ │   │ │
│  │  │  │  LearningBrainAgent (24h Heartbeat)                            │ │   │ │
│  │  │  │  • checkDueItems()                                             │ │   │ │
│  │  │  │  • runConsolidation()                                         │ │   │ │
│  │  │  │  • runCrossConceptAnalysis()                                  │ │   │ │
│  │  │  │  • runLearnerProfileUpdate()                                  │ │   │ │
│  │  │  └───────────────────────────────────────────────────────────────┘ │   │ │
│  │  │                                                                    │   │ │
│  │  │  ┌─────────────────────┐ ┌─────────────────────┐                   │   │ │
│  │  │  │ ConsolidationService│ │ LearnerProfileInfer │                   │   │ │
│  │  │  │ • LLM synthesis     │ │ • forgettingCurve   │                   │   │ │
│  │  │  │ • Memory creation   │ │ • optimalTiming     │                   │   │ │
│  │  │  └─────────────────────┘ └─────────────────────┘                   │   │ │
│  │  │                                                                    │   │ │
│  │  │  ┌─────────────────────┐ ┌─────────────────────┐                   │   │ │
│  │  │  │ CrossConceptAnalyzer│ │ EpisodeCollector    │                   │   │ │
│  │  │  │ • Prerequisites     │ │ • Bi-temporal       │                   │   │ │
│  │  │  │ • Interference      │ │ • Event buffering   │                   │   │ │
│  │  │  └─────────────────────┘ └─────────────────────┘                   │   │ │
│  │  └────────────────────────────────────────────────────────────────────┘   │ │
│  │                                 │                                          │ │
│  │  ┌──────────────────────────────▼─────────────────────────────────────┐   │ │
│  │  │                    DATA LAYER                                       │   │ │
│  │  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐   │   │ │
│  │  │  │ SQLite Primary  │ │ Neo4j Graph     │ │ AIProviderManager   │   │   │ │
│  │  │  │ • Learning plans│ │ • Episodes      │ │ • Claude/GPT/Gemini │   │   │ │
│  │  │  │ • Profiles      │ │ • Memories      │ │ • generateWithJson  │   │   │ │
│  │  │  │ • Memories      │ │ • Concepts      │ │ • chatWithTools     │   │   │ │
│  │  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘   │   │ │
│  │  └────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Principles

| Principle | Description |
|-----------|-------------|
| **LLM-First Decisions** | Use AI reasoning for scheduling, prioritization, and adaptation instead of hardcoded formulas |
| **Personal Data-Driven** | Leverage measured learner profile data (forgetting curve, pace, consistency) |
| **Context Holistic** | Consider cross-concept patterns, recent memories, and engagement trends |
| **Graceful Degradation** | Fall back to rule-based logic if LLM unavailable |
| **Bi-Temporal Memory** | Track both when events occurred and when they were recorded |

### 1.3 Component Overview

| Component | Location | Purpose |
|-----------|----------|---------|
| **ScheduleReconciliationAgent** | `src/main/brain/ScheduleReconciliationAgent.js` | LLM-driven schedule analysis and adjustment |
| **LearningBrainAgent** | `src/main/brain/LearningBrainAgent.js` | 24h heartbeat orchestrator |
| **ConsolidationService** | `src/main/utils/ConsolidationService.js` | LLM-powered episode → memory synthesis |
| **LearnerProfileInference** | `src/main/utils/LearnerProfileInference.js` | Infers learner characteristics from behavior |
| **CrossConceptAnalyzer** | `src/main/utils/CrossConceptAnalyzer.js` | Detects patterns across concepts |
| **EpisodeCollector** | `src/main/brain/EpisodeCollector.js` | Captures learning events with timestamps |
| **SummarizationGraphService** | `src/main/utils/SummarizationGraphService.js` | Neo4j graph relationships for memories |

---

## 2. Three-Tier Memory System

Inspired by [Graphiti/Zep](https://github.com/getzep/graphiti), the system implements a three-tier memory architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LEARNING BRAIN MEMORY (Neo4j + SQLite)                    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 1: EPISODIC MEMORY (Raw Events)                                    │ │
│  │  ────────────────────────────────────────                                │ │
│  │  (:Episode {                                                             │ │
│  │    id, userId, eventType, timestamp,                                     │ │
│  │    t_valid, t_invalid,        // Event timeline                          │ │
│  │    t_created, t_expired,      // Ingestion timeline                      │ │
│  │    payload: JSON,             // Event-specific data                     │ │
│  │    daysOverdue: number,       // NEW: How late the review was            │ │
│  │    sourceContext: JSON        // What user was doing                     │ │
│  │  })                                                                      │ │
│  │                                                                          │ │
│  │  Event Types:                                                            │ │
│  │  • REVIEW_COMPLETED    • CONCEPT_STRUGGLED   • BOOK_OPENED               │ │
│  │  • QUIZ_TAKEN          • NOTE_CREATED        • SESSION_STARTED           │ │
│  │  • MASTERY_CHANGED     • GOAL_SET            • STREAK_BROKEN             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              │                                                │
│                              │ LLM Synthesis (ConsolidationService)           │
│                              ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 2: CONSOLIDATED MEMORY (LLM-Synthesized)                           │ │
│  │  ──────────────────────────────────────────────────────                  │ │
│  │  (:ConsolidatedMemory {                                                  │ │
│  │    id, memoryType, periodStart, periodEnd, episodeCount,                 │ │
│  │    summary: string,           // LLM-generated narrative                 │ │
│  │    insights: string[],        // Key patterns detected                   │ │
│  │    masteryAssessment: enum,   // beginner/developing/proficient/mastered │ │
│  │    learningStyle: enum,       // quick/steady/needs-repetition/variable  │ │
│  │    recommendations: string[], // Actionable suggestions                  │ │
│  │    metrics: JSON              // Accuracy, times, etc.                   │ │
│  │  })                                                                      │ │
│  │                                                                          │ │
│  │  Relationships:                                                          │ │
│  │  - Episode -[:CONSOLIDATED_INTO]-> ConsolidatedMemory                    │ │
│  │  - ConsolidatedMemory -[:SUMMARIZES]-> Concept                           │ │
│  │  - ConsolidatedMemory -[:MEMORY_RELATES]-> ConsolidatedMemory            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              │                                                │
│                              │ Pattern Analysis                               │
│                              ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  TIER 3: LEARNER PROFILE (Inferred Patterns)                             │ │
│  │  ────────────────────────────────────────                                │ │
│  │  (:LearnerProfile {                                                      │ │
│  │    userId,                                                               │ │
│  │    forgettingCurve: {                                                    │ │
│  │      optimalReviewInterval: number,    // Days                           │ │
│  │      forgettingSlope: number,          // Decay rate                     │ │
│  │      averageRetentionRate: number      // 0-1                            │ │
│  │    },                                                                    │ │
│  │    sessionPreferences: {                                                 │ │
│  │      optimalMinutes: number,                                             │ │
│  │      focusDecayPoint: number                                             │ │
│  │    },                                                                    │ │
│  │    pacePreferences: {                                                    │ │
│  │      avgItemsPerSession: number,                                         │ │
│  │      preferredPace: 'burst' | 'steady' | 'marathon'                      │ │
│  │    },                                                                    │ │
│  │    engagementPatterns: {                                                 │ │
│  │      consistencyScore: number,         // 0-1                            │ │
│  │      trend: 'improving' | 'stable' | 'declining'                         │ │
│  │    },                                                                    │ │
│  │    crossConceptPatterns: CrossConceptPattern[]                           │ │
│  │  })                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Memory Relationships in Neo4j

| Relationship | Direction | Properties |
|--------------|-----------|------------|
| `:CONSOLIDATED_INTO` | Episode → Memory | weight, contributionType, t_valid, t_created |
| `:SUMMARIZES` | Memory → Concept | weight, isPrimary, aspectsCovered, masteryContribution |
| `:MEMORY_RELATES` | Memory ↔ Memory | relationType, strength, confidence |
| `:HAS_MEMORY` | LearnerProfile → Memory | - |

### 2.2 Contribution Types

| Type | Description | Example Events |
|------|-------------|----------------|
| `primary` | Direct learning activity | REVIEW_COMPLETED, QUIZ_TAKEN |
| `supporting` | Context activity | BOOK_OPENED, NOTE_CREATED |
| `contextual` | Background events | SESSION_STARTED, SESSION_ENDED |

---

## 3. Learner Profile & Inference

### 3.1 Profile Schema

```typescript
interface LearnerProfile {
  userId: number;

  // Forgetting Curve (measured from review data)
  forgettingCurve: {
    optimalReviewInterval: number;    // Days - when to optimally review
    forgettingSlope: number;          // Rate of forgetting (lower = better)
    averageRetentionRate: number;     // 0-1, measured retention
    retentionStrength: 'weak' | 'average' | 'strong';
  };

  // Session Preferences
  sessionPreferences: {
    optimalMinutes: number;           // Best session length
    focusDecayPoint: number;          // When focus drops
    preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  };

  // Pace Preferences
  pacePreferences: {
    avgItemsPerSession: number;       // Natural pace
    preferredPace: 'burst' | 'steady' | 'marathon';
    optimalBatchSize: number;         // Items before break
  };

  // Engagement Patterns
  engagementPatterns: {
    consistencyScore: number;         // 0-1, how consistent
    trend: 'improving' | 'stable' | 'declining';
    sessionsPerWeek: number;
  };

  // Cross-Concept Patterns
  crossConceptPatterns: CrossConceptPattern[];

  // Domain-Specific Profiles
  domainProfiles: {
    [domainType: string]: {
      accuracyTrend: 'improving' | 'stable' | 'declining';
      weakAreas: string[];
      strongAreas: string[];
    };
  };
}
```

### 3.2 Inference Methods

| Method | Purpose | Data Source |
|--------|---------|-------------|
| `inferForgettingCurve()` | Calculate personal decay rate | Review accuracy over time gaps |
| `inferOptimalTiming()` | Find best study times | Session performance by hour/day |
| `inferSessionPreferences()` | Optimal session length | Accuracy decay within sessions |
| `inferPacePreferences()` | Natural learning pace | Items per session distribution |
| `inferEngagementPatterns()` | Consistency and trends | Session frequency analysis |

### 3.3 Why LLM-Driven Instead of Hardcoded?

| Aspect | Rule-Based (Old) | LLM-Driven (New) |
|--------|------------------|------------------|
| Forgetting curve | Hardcoded `e^(-days/7)` | Personal `e^(-days/learnerSlope)` |
| Priority scoring | Fixed weights | LLM considers context holistically |
| Daily load | `configuredItems * 1.5` max | Based on learner's actual pace |
| Gap thresholds | Fixed (7/14/30 days) | Relative to personal interval |
| Cross-concept | Not considered | LLM respects prerequisites/interference |

---

## 4. Schedule Reconciliation Agent

The **ScheduleReconciliationAgent** is the core component for LLM-driven schedule management.

### 4.1 Location

`src/main/brain/ScheduleReconciliationAgent.js`

### 4.2 Key Methods

```javascript
class ScheduleReconciliationAgent {
  /**
   * Get due items with LLM-driven reconciliation
   * @param {Object} options - { planId, limit, token }
   * @returns {Object} Reconciled due items with metadata
   */
  async getDueItemsReconciled(options);

  /**
   * Full schedule reconciliation with LLM analysis
   * @param {Object} options - { planId, token, forceReconcile }
   * @returns {Object} Reconciliation result with adjustments
   */
  async reconcileSchedule(options);

  /**
   * Analyze gap and generate catch-up plan
   * @param {Object} context - Gap and profile context
   * @returns {Object} LLM-generated catch-up plan
   */
  async generateCatchUpPlan(context);

  /**
   * Calculate personalized review interval
   * @param {number} rating - 1-4 rating
   * @param {number} newBox - Target Leitner box
   * @param {number} correctStreak - Consecutive correct answers
   * @param {Object} profile - Learner profile
   * @returns {number} Interval in days
   */
  calculatePersonalizedInterval(rating, newBox, correctStreak, profile);

  /**
   * Handle same-day subsequent session
   * @param {string} planId - Plan ID
   * @param {string} token - User token
   * @returns {Object} Session context with remaining items
   */
  async handleSubsequentSession(planId, token);
}
```

### 4.3 Reconciliation Flow

```
User Opens Study Session
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│  Step 1: Gather Context                                            │
├────────────────────────────────────────────────────────────────────┤
│  • Get learner profile from LearnerProfileManager                  │
│  • Get recent episodes from EpisodeCollector                       │
│  • Get consolidated memories from ConsolidatedMemoryManager        │
│  • Get cross-concept patterns from recent analysis                 │
│  • Get all potentially due items from LearningPlanManager          │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│  Step 2: Detect Gap & Analyze (LLM Call)                           │
├────────────────────────────────────────────────────────────────────┤
│  PROMPT: createScheduleReconciliationPrompt()                      │
│                                                                    │
│  INPUT:                                                            │
│  - Days since last session                                         │
│  - Learner's forgettingCurve profile                               │
│  - Number of overdue items                                         │
│  - Cross-concept patterns (prerequisites, interference)            │
│                                                                    │
│  OUTPUT (JSON):                                                    │
│  {                                                                 │
│    "gapSeverity": "moderate",                                      │
│    "estimatedDecay": { "item_123": 0.25, ... },                    │
│    "prioritizedItems": ["item_456", "item_123", ...],              │
│    "recommendedLoad": { "reviewCount": 18, "newCount": 4 },        │
│    "catchUpPlan": { "daysNeeded": 3, ... },                        │
│    "userMessage": "Welcome back! ..."                              │
│  }                                                                 │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│  Step 3: Apply LLM Recommendations                                 │
├────────────────────────────────────────────────────────────────────┤
│  • Update mastery levels based on estimated decay                  │
│  • Reorder items by LLM-prioritized list                           │
│  • Apply recommended load limits                                   │
│  • Store catch-up plan for calendar display                        │
│  • Return items for today's session                                │
└────────────────────────────────────────────────────────────────────┘
```

### 4.4 Personalized Gap Thresholds

Instead of fixed thresholds (7/14/30 days), the system uses thresholds relative to the learner's personal optimal interval:

```javascript
const personalOptimalInterval = profile.forgettingCurve?.optimalReviewInterval || 7;

const GAP_THRESHOLDS = {
  MINOR: personalOptimalInterval * 0.5,      // Half of their interval
  MODERATE: personalOptimalInterval,          // At their interval
  SIGNIFICANT: personalOptimalInterval * 2,   // Double their interval
  CRITICAL: personalOptimalInterval * 4,      // 4x their interval
};
```

### 4.5 Personalized Interval Calculation

```javascript
function calculatePersonalizedInterval(rating, newBox, correctStreak, profile) {
  // Get personal parameters (with defaults)
  const baseInterval = profile.forgettingCurve?.optimalReviewInterval || 7;
  const retentionRate = profile.forgettingCurve?.averageRetentionRate || 0.7;

  // Box multipliers (Leitner progression)
  const boxMultipliers = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };

  // Rating multipliers
  const ratingMultipliers = {
    1: 0.1,   // Again: very short interval
    2: 0.5,   // Hard: half interval
    3: 1.0,   // Good: normal interval
    4: 1.5,   // Easy: extended interval
  };

  // Streak bonus (personalized by retention)
  const streakBonus = Math.pow(1 + (retentionRate * 0.2), Math.min(correctStreak, 5));

  // Calculate interval
  const interval = baseInterval
    * (boxMultipliers[newBox] || 1)
    * ratingMultipliers[rating]
    * streakBonus;

  // Bounds
  const minInterval = rating === 1 ? 0.01 : 1;
  const maxInterval = baseInterval * 30;

  return Math.max(minInterval, Math.min(maxInterval, Math.round(interval)));
}
```

---

## 5. Cross-Concept Pattern Detection

### 5.1 Pattern Types

| Pattern | Detection Method | LLM Action |
|---------|------------------|------------|
| **PREREQUISITE** | Concept A mastered before B improves B | "Study A before B" |
| **INTERFERENCE** | Learning A degrades B accuracy | "Space out A and B" |
| **POSITIVE_TRANSFER** | Learning A improves B | "A and B reinforce each other" |
| **CONCEPT_CLUSTER** | Concepts frequently studied together | "Group for efficient learning" |
| **FORGETTING_CORRELATION** | Items forgotten together | "Review A and B together" |

### 5.2 CrossConceptAnalyzer Methods

```javascript
class CrossConceptAnalyzer {
  analyzePrerequisites(episodes)     // Detect prerequisite relationships
  analyzeInterference(episodes)       // Detect negative transfer
  analyzePositiveTransfer(episodes)   // Detect positive transfer
  analyzeClusters(episodes)           // Find concept clusters
  analyzeTemporalPatterns(episodes)   // Time-based patterns
  generateFullAnalysis(episodes)      // Complete analysis report
}
```

### 5.3 How LLM Uses Cross-Concept Patterns

When the LLM receives scheduling context, it considers cross-concept patterns:

```javascript
// LLM receives full context
{
  "overdueItems": [
    { "id": "A", "front": "calculus basics", "daysOverdue": 7 },
    { "id": "B", "front": "derivative rules", "daysOverdue": 10 }
  ],
  "crossConceptPatterns": [
    { "type": "PREREQUISITE", "from": "calculus basics", "to": "derivative rules" }
  ]
}

// LLM Output (prioritized with reasoning):
{
  "prioritizedOrder": ["A", "B"],
  "reasoning": [
    "1. 'calculus basics' first - prerequisite for 'derivative rules'",
    "2. 'derivative rules' - depends on basics being fresh"
  ]
}
```

---

## 6. Memory Consolidation Pipeline

### 6.1 Pipeline Flow

```
Heartbeat Triggered (24h) or Manual Trigger
         │
         ▼
Query Episodes (last 7 days, unprocessed)
         │
         ▼
Group by Concept Clusters (with context shift detection)
         │
         ▼
For each cluster (≥3 episodes):
    ├── Analyze learning process (accuracy, progression, patterns)
    ├── Create synthesis prompt (createMemoryConsolidationPrompt)
    ├── Call AIProviderManager.generateContentWithJson()
    ├── Parse consolidation result
    ├── Store ConsolidatedMemory (SQLite + Neo4j)
    └── Create graph relationships (:CONSOLIDATED_INTO, :SUMMARIZES)
         │
         ▼
Mark episodes as processed
         │
         ▼
Archive old episodes (30 days) → Delete (90 days)
```

### 6.2 Consolidation Output Schema

```javascript
{
  "summary": "Learning session for 'ephemeral' with 8 reviews...",
  "keyInsights": [
    "Struggled initially but improved after 3rd attempt",
    "Response time decreased indicating familiarity"
  ],
  "masteryAssessment": "developing",  // beginner/developing/proficient/mastered
  "learningStyle": "steady",          // quick/steady/needs-repetition/variable
  "progressionNarrative": "Initial confusion resolved through repetition...",
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

---

## 7. Episode Collection System

### 7.1 Event Types

```javascript
const EVENT_TYPES = {
  // Study Session Events
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',

  // Review Events (with daysOverdue tracking)
  REVIEW_COMPLETED: 'REVIEW_COMPLETED',
  REVIEW_SKIPPED: 'REVIEW_SKIPPED',

  // Performance Events
  QUIZ_TAKEN: 'QUIZ_TAKEN',
  CONCEPT_STRUGGLED: 'CONCEPT_STRUGGLED',
  CONCEPT_MASTERED: 'CONCEPT_MASTERED',
  MASTERY_CHANGED: 'MASTERY_CHANGED',

  // Content Events
  BOOK_OPENED: 'BOOK_OPENED',
  NOTE_CREATED: 'NOTE_CREATED',
  HIGHLIGHT_CREATED: 'HIGHLIGHT_CREATED',
  VOCABULARY_ADDED: 'VOCABULARY_ADDED',

  // Goal & Streak Events
  GOAL_SET: 'GOAL_SET',
  GOAL_COMPLETED: 'GOAL_COMPLETED',
  STREAK_MILESTONE: 'STREAK_MILESTONE',
  STREAK_BROKEN: 'STREAK_BROKEN',
};
```

### 7.2 REVIEW_COMPLETED Payload (Enhanced)

```javascript
{
  eventType: 'REVIEW_COMPLETED',
  payload: {
    conceptId: 'item_123',
    conceptName: 'ephemeral',
    rating: 3,                    // 1=Again, 2=Hard, 3=Good, 4=Easy
    responseTimeMs: 2500,
    hintUsed: false,
    previousBox: 2,
    newBox: 3,
    daysOverdue: 5,               // NEW: How late the review was
    wasOverdue: true,             // NEW: Boolean flag
    sourceContext: {
      planId: 'plan_abc',
      sessionId: 'session_xyz',
      view: 'study'               // 'study' | 'leitner' | 'reading'
    }
  }
}
```

### 7.3 Recording Episodes

```javascript
// In StudySessionPage.js - after rating
async function handleRate(rating) {
  const daysOverdue = calculateDaysOverdue(currentItem);

  await episodeCollector.recordEvent('REVIEW_COMPLETED', {
    conceptId: currentItem.id,
    conceptName: currentItem.front,
    rating,
    responseTimeMs: Date.now() - itemStartTime,
    hintUsed: hintsUsed > 0,
    previousBox: currentItem.box,
    newBox: calculateNewBox(rating),
    daysOverdue,
    wasOverdue: daysOverdue > 0,
    sourceContext: { planId, sessionId, view: 'study' }
  });
}
```

---

## 8. AI Prompts Library

### 8.1 Schedule Reconciliation Prompt

Location: `src/commons/utils/AIPrompts.js`

```javascript
export function createScheduleReconciliationPrompt(context) {
  return `You are an adaptive learning schedule manager. Analyze this learner's situation and generate personalized recommendations.

## Learner Profile
- Forgetting curve: optimal interval ${context.profile.forgettingCurve?.optimalReviewInterval || 7} days
- Forgetting slope: ${context.profile.forgettingCurve?.forgettingSlope || 0.14}
- Session preference: ${context.profile.sessionPreferences?.optimalMinutes || 20} minutes
- Natural pace: ${context.profile.pacePreferences?.avgItemsPerSession || 15} items
- Consistency: ${Math.round((context.profile.engagementPatterns?.consistencyScore || 0.5) * 100)}%

## Current Situation
- Days since last session: ${context.daysSinceLastSession}
- Gap severity: ${context.gapType}
- Overdue items: ${context.overdueItems.length}

## Overdue Items
${JSON.stringify(context.overdueItems.slice(0, 20), null, 2)}

## Cross-Concept Patterns
${JSON.stringify(context.crossConceptPatterns, null, 2)}

## Your Task
Generate a JSON response with:
1. prioritizedItems: Order item IDs by review priority
2. recommendedLoad: { reviewCount, newCount } for today
3. adjustments: Any mastery or schedule adjustments
4. recommendations: Learning strategy suggestions
5. userMessage: Encouraging message for the user

Consider:
- Prerequisites: Study prerequisite concepts first
- Interference: Space out conflicting concepts
- Personal pace: Don't exceed learner's natural capacity
- Forgetting curve: Use measured decay rate

Response in JSON format:`;
}
```

### 8.2 Catch-Up Plan Prompt

```javascript
export function createCatchUpPlanPrompt(context) {
  return `Generate a catch-up learning plan for a returning learner.

## Situation
- Days absent: ${context.daysAbsent}
- Overdue items: ${context.overdueCount}
- Learner's daily capacity: ${context.profile.pacePreferences?.avgItemsPerSession || 15} items
- Available minutes per day: ${context.availableMinutesPerDay || 30}
- Target catch-up days: ${context.targetCatchUpDays || 7}

## Learner Preferences
- Preferred pace: ${context.profile.pacePreferences?.preferredPace || 'steady'}
- Focus decay after: ${context.profile.sessionPreferences?.focusDecayPoint || 25} minutes

## Generate Plan
Create a realistic catch-up plan that:
1. Doesn't overwhelm (max 1.5x normal daily capacity)
2. Prioritizes critical items in early days
3. Includes rest days if plan > 5 days
4. Provides motivation milestones

Return JSON with:
- totalDays: number
- dailyPlan: [{ day, itemCount, focus, estimatedMinutes }]
- milestones: [{ day, achievement }]
- encouragement: string`;
}
```

### 8.3 Memory Consolidation Prompt

```javascript
export function createMemoryConsolidationPrompt(episodes, conceptName, analysisData) {
  return `Synthesize these learning episodes into a consolidated memory.

## Concept: ${conceptName}

## Episodes (${episodes.length} total)
${JSON.stringify(episodes.map(e => ({
  type: e.eventType,
  rating: e.payload?.rating,
  responseTime: e.payload?.responseTimeMs,
  hintUsed: e.payload?.hintUsed,
  timestamp: e.timestamp
})), null, 2)}

## Analysis Data
- Accuracy: ${analysisData.accuracy}%
- Trend: ${analysisData.trend}
- Cramming detected: ${analysisData.cramming}
- Box progression: ${analysisData.boxProgression}

## Generate Summary
Create a JSON response with:
1. summary: Narrative of the learning journey
2. keyInsights: Array of key observations
3. masteryAssessment: beginner/developing/proficient/mastered
4. learningStyle: quick/steady/needs-repetition/variable
5. strugglingAreas: Array of areas needing work
6. recommendations: Array of actionable suggestions`;
}
```

---

## 9. API Reference

### 9.1 Renderer-Side APIs

#### scheduleApi.js

```javascript
import scheduleApi, {
  GAP_SEVERITY,
  SESSION_TYPE,
  PRIORITY_TIERS,
  getGapSeverityInfo,
  formatDaysOverdue,
  estimateCatchUpTime
} from '../api/scheduleApi';

// Get reconciled due items
const result = await scheduleApi.getDueItemsReconciled({
  planId: 'plan_123',
  limit: 20,
  token: userToken
});

// Full reconciliation
const reconciliation = await scheduleApi.reconcileSchedule({
  planId: 'plan_123',
  token: userToken,
  options: { forceReconcile: true }
});

// Get overdue items grouped by severity
const grouped = await scheduleApi.getOverdueGrouped({
  planId: 'plan_123',
  token: userToken
});

// Generate catch-up plan
const plan = await scheduleApi.generateCatchUpPlan({
  token: userToken,
  availableMinutesPerDay: 30,
  targetCatchUpDays: 7
});
```

#### brainApi.js

```javascript
import brainApi, {
  EPISODE_TYPES,
  MEMORY_TYPES,
  recordEvent
} from '../api/brainApi';

// Record episode
await recordEvent.reviewCompleted({
  conceptId: item.id,
  conceptName: item.front,
  rating: 3,
  responseTimeMs: 2500,
  hintUsed: false,
  previousBox: 2,
  newBox: 3,
  daysOverdue: 5
});

// Get learner profile
const profile = await brainApi.getLearnerProfile(token);

// Trigger manual consolidation
await brainApi.consolidateNow({ token, periodDays: 7 });

// Get cross-concept patterns
const patterns = await brainApi.getConceptPatterns(conceptId, token);
```

### 9.2 IPC Handlers

#### Schedule Reconciliation Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `schedule-get-due-reconciled` | invoke | Get reconciled due items |
| `schedule-reconcile` | invoke | Full schedule reconciliation |
| `schedule-get-overdue-grouped` | invoke | Get items grouped by severity |
| `schedule-generate-catch-up` | invoke | Generate catch-up plan |
| `schedule-clear-cache` | sync | Clear reconciliation cache |
| `schedule-reconciliation-available` | sync | Check if available |

#### Brain/Memory Handlers

| Handler | Type | Purpose |
|---------|------|---------|
| `brain-record-episode` | invoke | Record learning event |
| `brain-get-learner-profile` | invoke | Get learner profile |
| `brain-consolidate-now` | invoke | Trigger consolidation |
| `brain-get-cross-concept-patterns` | invoke | Get patterns |
| `brain-analyze-cross-concept` | invoke | Run full analysis |
| `brain-infer-profile` | invoke | Run profile inference |

---

## 10. Edge Cases & Scenarios

### 10.1 Same-Day Multiple Sessions

**Scenario**: User opens study session multiple times in one day.

**Handling**:
1. Track `reviewedToday` Set from today's episodes
2. Filter out already-reviewed items
3. Calculate remaining daily goal
4. Return appropriate message

```javascript
const handleSubsequentSession = async (planId, token) => {
  const today = new Date().toISOString().split('T')[0];
  const todaysSessions = await getSessionsForDate(planId, today, token);

  if (todaysSessions.length === 0) {
    return await reconcileSchedule(planId, token);
  }

  // Collect already-reviewed item IDs
  const reviewedToday = new Set();
  for (const session of todaysSessions) {
    const results = session.sessionData?.itemResults || [];
    results.forEach(r => reviewedToday.add(r.itemId));
  }

  // Filter and return remaining
  const allDue = await getDueItems(planId);
  const remaining = allDue.filter(item => !reviewedToday.has(item.id));

  return {
    isFirstSession: false,
    completedToday: reviewedToday.size,
    itemsForSession: remaining
  };
};
```

### 10.2 Skipped/Partial Sessions

**Scenario**: User starts session but only completes 10 of 50 planned items.

**Handling**:
- System tracks what was reviewed via episodes
- Next session uses reconciliation to:
  - Estimate decay for unreviewed items
  - Prioritize most overdue
  - Adjust daily load

### 10.3 Extended Absence (30+ days)

**Scenario**: User returns after 45 days.

**LLM Response**:
```javascript
{
  "approach": "gradual_reactivation",
  "userMessage": "Welcome back! Let's ease back in with your strongest items first.",
  "phase1": {
    "days": 3,
    "focus": "high_mastery_items",
    "dailyLimit": 10,
    "purpose": "Rebuild confidence"
  },
  "phase2": {
    "days": 5,
    "focus": "medium_mastery_items",
    "dailyLimit": 15
  },
  "phase3": {
    "days": 7,
    "focus": "all_items",
    "dailyLimit": 20
  }
}
```

### 10.4 Cramming Detection

**Detection**: 5+ reviews of same concept in <1 hour.

**LLM Action**:
```javascript
{
  "recommendation": {
    "message": "Cramming detected. Spaced reviews are more effective.",
    "suggestedAction": "Take a break and return tomorrow",
    "adjustedSchedule": {
      "todayLimit": 0,
      "tomorrowItems": 15
    }
  }
}
```

### 10.5 Cross-Concept Interference

**Detection**: Learning Spanish degrades French accuracy.

**LLM Action**:
- Space out conflicting concepts in priority order
- Suggest studying on different days
- Flag in recommendations

---

## 11. Integration Points

### 11.1 StudySessionPage.js

```javascript
// On session start
useEffect(() => {
  const loadReconciled = async () => {
    const result = await scheduleApi.getDueItemsReconciled({
      planId,
      limit: session.maxItems,
      token
    });

    setItems(result.items);
    setReconciliation(result.metadata);
    setUserMessage(result.userMessage);
  };
  loadReconciled();
}, [planId]);

// On rating
const handleRate = async (rating) => {
  const daysOverdue = calculateDaysOverdue(currentItem);

  await recordEvent.reviewCompleted({
    conceptId: currentItem.id,
    conceptName: currentItem.front,
    rating,
    responseTimeMs: responseTime,
    previousBox: currentItem.box,
    newBox: calculateNewBox(rating),
    daysOverdue,
    wasOverdue: daysOverdue > 0
  });

  // Continue...
};
```

### 11.2 LeitnerSystem.js

```javascript
const handleCorrect = async () => {
  const daysOverdue = calculateDaysOverdue(currentCard);

  await recordEvent.reviewCompleted({
    conceptId: currentCard.id,
    conceptName: currentCard.front,
    rating: RATINGS.GOOD,
    responseTimeMs: Date.now() - cardStartTime,
    previousBox: currentCard.box,
    newBox: currentCard.box + 1,
    daysOverdue,
    wasOverdue: daysOverdue > 0
  });
};

const handleIncorrect = async () => {
  const daysOverdue = calculateDaysOverdue(currentCard);

  await recordEvent.reviewCompleted({
    conceptId: currentCard.id,
    conceptName: currentCard.front,
    rating: RATINGS.AGAIN,
    responseTimeMs: Date.now() - cardStartTime,
    previousBox: currentCard.box,
    newBox: 1,  // Back to box 1
    daysOverdue,
    wasOverdue: daysOverdue > 0
  });
};
```

### 11.3 LearningCalendar Integration

```javascript
// Show catch-up plan on calendar
const CatchUpPlanOverlay = ({ plan }) => (
  <Box>
    <Typography variant="h6">Catch-Up Plan</Typography>
    <Typography>{plan.encouragement}</Typography>
    {plan.dailyPlan.map((day, i) => (
      <Box key={i}>
        <Typography>Day {day.day}: {day.itemCount} items ({day.focus})</Typography>
      </Box>
    ))}
    {plan.milestones.map((m, i) => (
      <Chip key={i} label={`Day ${m.day}: ${m.achievement}`} />
    ))}
  </Box>
);
```

---

## 12. Testing

### 12.1 Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `ScheduleReconciliationAgent.test.js` | 24 | Core reconciliation logic |
| `ConsolidationService.test.js` | 35 | Memory consolidation |
| `CrossConceptAnalyzer.test.js` | 28 | Pattern detection |
| `LearnerProfileInference.test.js` | 22 | Profile inference |
| `EpisodeCollector.test.js` | 18 | Episode collection |
| `SummarizationGraphService.test.js` | 59 | Graph relationships |

### 12.2 Test Commands

```bash
# Run all LLM learning tests
npm test -- --testPathPattern=brain

# Run schedule reconciliation tests
npm test -- --testPathPattern=ScheduleReconciliationAgent

# Run consolidation tests
npm test -- --testPathPattern=ConsolidationService

# Run cross-concept tests
npm test -- --testPathPattern=CrossConceptAnalyzer

# Run all learning system tests
npm test -- --testPathPattern="brain|learning"
```

### 12.3 Key Test Scenarios

1. **Gap Detection**: Verifies personal thresholds are used
2. **Personalized Intervals**: Tests interval calculation with profile data
3. **Same-Day Handling**: Tests filtering of already-reviewed items
4. **LLM Fallback**: Tests graceful degradation when LLM unavailable
5. **Cross-Concept Priority**: Tests prerequisite ordering
6. **Cramming Detection**: Tests cramming flag and response
7. **Extended Absence**: Tests phased reactivation plan

---

## Summary

The LLM-Driven Learning Management System represents a fundamental shift from rule-based to AI-driven learning optimization. Key innovations:

1. **Personal Forgetting Curves**: Uses measured decay rates instead of generic formulas
2. **LLM-Driven Prioritization**: Considers cross-concept patterns holistically
3. **Adaptive Daily Load**: Based on learner's actual pace and preferences
4. **Intelligent Catch-Up Plans**: Phased reactivation after extended absence
5. **Bi-Temporal Memory**: Full audit trail of learning journey
6. **Cross-Concept Awareness**: Respects prerequisites and avoids interference

The system achieves personalized, context-aware learning management while maintaining graceful degradation and comprehensive testing.

---

*Document Version: 1.0*
*Last Updated: 2026-02-26*
*Author: Claude Code*

## Related Documentation

- [AI-Learning-Brain-Architecture.md](AI-Learning-Brain-Architecture.md) - Brain system architecture
- [Agentic-AI-Implementation-Analysis.md](Agentic-AI-Implementation-Analysis.md) - Full agentic AI analysis
- [DYNAMIC_SCHEDULE_ALGORITHM_PLAN.md](DYNAMIC_SCHEDULE_ALGORITHM_PLAN.md) - Algorithm implementation plan
- [Cross-Concept-Learner-Profile-Design.md](Cross-Concept-Learner-Profile-Design.md) - Pattern detection design
