# LLM-Driven Dynamic Learning Schedule Algorithm

## Executive Summary

This document outlines an **LLM-driven** approach to dynamic learning schedule management that integrates with the existing Brain system (ConsolidationService, LearnerProfileInference, CrossConceptAnalyzer, EpisodeCollector).

**Key Principle**: Instead of hardcoded rules, we use the LLM to:
1. Analyze learner's personal forgetting curve from episode data
2. Generate personalized catch-up strategies based on learner profile
3. Synthesize recommendations from cross-concept patterns
4. Adapt scheduling based on inferred learning style and pace

---

## Table of Contents

1. [Architecture Integration](#1-architecture-integration)
2. [Data Flow](#2-data-flow)
3. [LLM-Driven Components](#3-llm-driven-components)
4. [Algorithm Details](#4-algorithm-details)
5. [Edge Cases](#5-edge-cases)
6. [Implementation Plan](#6-implementation-plan)
7. [Prompts Library](#7-prompts-library)

---

## 1. Architecture Integration

### 1.1 Existing Brain System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXISTING BRAIN SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EpisodeCollector                    ConsolidationService                   │
│  ───────────────                     ────────────────────                   │
│  • REVIEW_COMPLETED events           • LLM memory synthesis                 │
│  • SESSION_STARTED/ENDED             • Cross-concept analysis               │
│  • MASTERY_CHANGED events            • Profile inference integration        │
│  • Bi-temporal timestamps            • Graphiti-style consolidation         │
│                                                                              │
│  LearnerProfileInference             CrossConceptAnalyzer                   │
│  ──────────────────────              ───────────────────                    │
│  • inferForgettingCurve()            • PREREQUISITE detection               │
│  • inferOptimalTiming()              • INTERFERENCE detection               │
│  • inferSessionPreferences()         • POSITIVE_TRANSFER detection          │
│  • inferPacePreferences()            • CONCEPT_CLUSTER detection            │
│  • inferEngagementPatterns()         • FORGETTING_CORRELATION               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ INTEGRATE
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEW: DYNAMIC SCHEDULE ORCHESTRATOR                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ScheduleReconciliationAgent (LLM-Driven)                                   │
│  ─────────────────────────────────────────                                  │
│  • Consumes learner profile data                                            │
│  • Generates personalized schedule adjustments                              │
│  • Creates catch-up plans via LLM reasoning                                 │
│  • Adapts to learner's actual forgetting curve                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Insight: Use Existing Inferences

Your `LearnerProfileInference` already calculates:
- **`forgettingCurve.optimalReviewInterval`** - Personalized interval in days
- **`forgettingCurve.forgettingSlope`** - How fast the learner forgets
- **`forgettingCurve.averageRetentionRate`** - Personal retention rate
- **`sessionPreferences.optimalMinutes`** - Best session length
- **`pacePreferences.avgItemsPerSession`** - Natural pace
- **`engagementPatterns.consistencyScore`** - Study consistency (0-1)

**Instead of hardcoded decay formulas, we use the learner's actual measured forgetting curve.**

---

## 2. Data Flow

### 2.1 Session Start Flow (LLM-Driven)

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
│  Step 2: Detect Gap & Analyze Situation (LLM Call)                 │
├────────────────────────────────────────────────────────────────────┤
│  PROMPT: createScheduleAnalysisPrompt()                            │
│                                                                    │
│  INPUT:                                                            │
│  - Days since last session                                         │
│  - Learner's forgettingCurve profile                               │
│  - Number of overdue items                                         │
│  - Recent engagement trend                                         │
│  - Cross-concept patterns (prerequisites, interference)            │
│                                                                    │
│  OUTPUT (JSON):                                                    │
│  {                                                                 │
│    "gapSeverity": "moderate",                                      │
│    "estimatedMasteryDecay": { "item_123": 0.25, ... },             │
│    "prioritizedItems": ["item_456", "item_123", ...],              │
│    "recommendedLoad": {                                            │
│      "reviewCount": 18,                                            │
│      "newCount": 4,                                                │
│      "reasoning": "Based on your forgetting curve..."              │
│    },                                                              │
│    "catchUpPlan": {                                                │
│      "daysNeeded": 3,                                              │
│      "dailyBreakdown": [...]                                       │
│    },                                                              │
│    "userMessage": "Welcome back! You've been away 5 days..."       │
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

### 2.2 Review Recording Flow (LLM-Enhanced)

```
User Completes Review (rating 1-4)
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│  Step 1: Record Episode                                            │
├────────────────────────────────────────────────────────────────────┤
│  episodeCollector.recordEvent('REVIEW_COMPLETED', {                │
│    conceptId: item.id,                                             │
│    conceptName: item.front,                                        │
│    rating: 3,                                                      │
│    responseTimeMs: 2500,                                           │
│    hintUsed: false,                                                │
│    previousBox: 2,                                                 │
│    newBox: 3,                                                      │
│    daysOverdue: 5,  // NEW: Track how late the review was          │
│  });                                                               │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│  Step 2: Calculate Next Review (Profile-Aware)                     │
├────────────────────────────────────────────────────────────────────┤
│  // Use learner's personal forgetting curve instead of hardcoded   │
│  const profile = getLearnerProfile(token);                         │
│  const baseInterval = profile.forgettingCurve?.optimalReviewInterval || 7;
│  const personalSlope = profile.forgettingCurve?.forgettingSlope || 0.14;
│                                                                    │
│  // Adjust interval based on rating and personal curve             │
│  const intervalDays = calculatePersonalizedInterval(               │
│    rating,                                                         │
│    item.correctStreak,                                             │
│    baseInterval,                                                   │
│    personalSlope                                                   │
│  );                                                                │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│  Step 3: Update Learning Point                                     │
├────────────────────────────────────────────────────────────────────┤
│  updateLearningPoint(pointId, {                                    │
│    box: newBox,                                                    │
│    masteryLevel: adjustedMastery,                                  │
│    correctStreak: newStreak,                                       │
│    nextReview: nextReviewDate,                                     │
│    lastReviewedAt: now,                                            │
│    // NEW: Track decay and recovery                                │
│    decayHistory: [...item.decayHistory, decayEvent],               │
│  });                                                               │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. LLM-Driven Components

### 3.1 Schedule Analysis Agent

**Purpose**: Analyze current situation and generate personalized recommendations

**Inputs**:
- Learner profile (from `LearnerProfileInference`)
- Gap duration (days since last session)
- Overdue items with metadata
- Cross-concept patterns
- Recent consolidated memories

**LLM Responsibilities**:
1. Estimate mastery decay for each item based on personal forgetting curve
2. Prioritize items considering:
   - How overdue they are
   - Current mastery level
   - Cross-concept prerequisites (study A before B)
   - Interference patterns (space out A and B)
3. Generate personalized catch-up plan
4. Create encouraging user message

### 3.2 Mastery Decay Estimation (LLM-Assisted)

Instead of a hardcoded formula like `mastery * e^(-days/stability)`, we:

1. **Use the learner's actual decay data** from `inferForgettingCurve()`
2. **Let LLM reason about specific items** based on:
   - Item's box level (stability indicator)
   - Item's review history
   - Similar items' decay patterns from consolidated memories

```javascript
// Example: LLM receives this context
{
  "learnerProfile": {
    "forgettingSlope": 0.12,           // Personal: forgets slower than average
    "optimalReviewInterval": 8,         // Personal: can wait 8 days
    "retentionStrength": "strong"       // Categorized by system
  },
  "item": {
    "id": "word_ephemeral",
    "front": "ephemeral",
    "currentMastery": 75,
    "box": 3,
    "correctStreak": 4,
    "lastReviewedAt": "2024-01-10",
    "daysOverdue": 12
  },
  "similarItemsDecay": [
    // From consolidated memories about similar words
    { "concept": "transient", "decayAfter10Days": 0.22 },
    { "concept": "fleeting", "decayAfter14Days": 0.35 }
  ]
}

// LLM Output:
{
  "estimatedDecay": 0.28,
  "adjustedMastery": 54,
  "confidence": 0.85,
  "reasoning": "Based on your forgetting slope (0.12) and this item's stability (box 3, streak 4), plus similar vocabulary decay patterns, estimated 28% decay after 12 days overdue."
}
```

### 3.3 Priority Scoring (LLM-Enhanced)

Instead of a weighted formula, the LLM considers multiple factors holistically:

```javascript
// LLM receives full context
{
  "overdueItems": [
    { "id": "A", "front": "ephemeral", "daysOverdue": 14, "mastery": 45, "box": 2 },
    { "id": "B", "front": "calculus basics", "daysOverdue": 7, "mastery": 60, "box": 3 },
    { "id": "C", "front": "derivative rules", "daysOverdue": 10, "mastery": 30, "box": 1 }
  ],
  "crossConceptPatterns": [
    { "type": "PREREQUISITE", "from": "calculus basics", "to": "derivative rules" }
  ],
  "learnerProfile": {
    "weakAreas": ["math concepts"],
    "strongAreas": ["vocabulary"]
  }
}

// LLM Output (prioritized list with reasoning):
{
  "prioritizedOrder": ["B", "C", "A"],
  "reasoning": [
    "1. 'calculus basics' first - prerequisite for 'derivative rules' and math is a weak area",
    "2. 'derivative rules' - low mastery (30%) and depends on basics",
    "3. 'ephemeral' - most overdue but vocabulary is a strong area, will recover faster"
  ]
}
```

### 3.4 Adaptive Daily Load (Profile-Driven)

Uses learner profile data instead of hardcoded multipliers:

```javascript
// From LearnerProfileInference
const profile = {
  pacePreferences: {
    avgItemsPerSession: 18,        // Learner's natural pace
    preferredPace: "steady",       // vs "burst" or "marathon"
    optimalBatchSize: 12           // Items before needing break
  },
  sessionPreferences: {
    optimalMinutes: 22,            // Personal optimal session length
    focusDecayPoint: 25            // Minutes when focus drops
  },
  engagementPatterns: {
    consistencyScore: 0.7,         // 0-1, how consistent they study
    sessionsPerWeek: 4.5           // Actual average
  }
};

// LLM generates load recommendation based on profile
{
  "recommendedLoad": {
    "totalItems": 20,              // Based on avgItemsPerSession
    "reviewItems": 16,             // 80% for overdue catch-up
    "newItems": 4,                 // 20% new (or 0 if heavily overloaded)
    "breakAfter": 12,              // Suggest break after this many
    "estimatedMinutes": 22         // Match their optimal session
  },
  "reasoning": "Your natural pace is ~18 items in 22 minutes. With 40 overdue items, we'll focus on reviews today and spread catch-up over 3 days."
}
```

---

## 4. Algorithm Details

### 4.1 Gap Detection (Enhanced)

```javascript
/**
 * Detect and analyze study gap using learner profile
 *
 * @param {string} planId - Learning plan ID
 * @param {string} token - User token
 * @returns {Object} Gap analysis with personalized thresholds
 */
async function detectStudyGap(planId, token) {
  const lastSession = await getLastCompletedSession(planId, token);
  const profile = await getLearnerProfile(token);

  if (!lastSession) {
    return { hasGap: false, daysSinceLastSession: 0 };
  }

  const daysSinceLastSession = calculateDaysSince(lastSession.completedAt);

  // Use PERSONAL thresholds based on learner's forgetting curve
  const personalOptimalInterval = profile.forgettingCurve?.optimalReviewInterval || 7;

  // Gap thresholds are relative to personal optimal interval
  const GAP_THRESHOLDS = {
    MINOR: personalOptimalInterval * 0.5,      // Half of their interval
    MODERATE: personalOptimalInterval,          // At their interval
    MAJOR: personalOptimalInterval * 2,         // Double their interval
    SEVERE: personalOptimalInterval * 4,        // 4x their interval
  };

  let gapType = 'NONE';
  if (daysSinceLastSession >= GAP_THRESHOLDS.SEVERE) {
    gapType = 'SEVERE';
  } else if (daysSinceLastSession >= GAP_THRESHOLDS.MAJOR) {
    gapType = 'MAJOR';
  } else if (daysSinceLastSession >= GAP_THRESHOLDS.MODERATE) {
    gapType = 'MODERATE';
  } else if (daysSinceLastSession >= GAP_THRESHOLDS.MINOR) {
    gapType = 'MINOR';
  }

  return {
    hasGap: gapType !== 'NONE',
    gapType,
    daysSinceLastSession,
    personalThresholds: GAP_THRESHOLDS,
    profileBased: true
  };
}
```

### 4.2 Personalized Interval Calculation

```javascript
/**
 * Calculate next review interval using learner's personal forgetting curve
 *
 * @param {number} rating - Review rating (1-4)
 * @param {number} correctStreak - Consecutive correct answers
 * @param {Object} profile - Learner profile with forgetting curve data
 * @returns {number} Interval in days
 */
function calculatePersonalizedInterval(rating, correctStreak, profile) {
  // Get personal parameters (with defaults)
  const baseInterval = profile.forgettingCurve?.optimalReviewInterval || 7;
  const retentionRate = profile.forgettingCurve?.averageRetentionRate || 0.7;

  // Rating multipliers (relative, not absolute)
  const ratingMultipliers = {
    1: 0.1,   // Again: very short interval
    2: 0.5,   // Hard: half interval
    3: 1.0,   // Good: normal interval
    4: 1.5,   // Easy: extended interval
  };

  // Streak bonus (compounding, but personalized)
  // Stronger retention = more aggressive streak bonus
  const streakBonus = Math.pow(1 + (retentionRate * 0.2), Math.min(correctStreak, 5));

  // Calculate interval
  let interval = baseInterval * ratingMultipliers[rating] * streakBonus;

  // Bounds based on personal profile
  const minInterval = rating === 1 ? 0.01 : 1;  // 1 = review again soon
  const maxInterval = baseInterval * 10;         // Cap at 10x personal interval

  return Math.max(minInterval, Math.min(maxInterval, Math.round(interval)));
}
```

### 4.3 Same-Day Session Handling

```javascript
/**
 * Handle same-day session start
 * Track already-reviewed items, don't duplicate
 *
 * @param {string} planId - Plan ID
 * @param {string} token - User token
 * @returns {Object} Session context
 */
async function handleSameDaySession(planId, token) {
  const today = new Date().toISOString().split('T')[0];
  const todaysSessions = await getSessionsForDate(planId, today, token);

  if (todaysSessions.length === 0) {
    // First session - run full reconciliation
    return await reconcileSchedule(planId, token);
  }

  // Collect already-reviewed item IDs from today's sessions
  const reviewedToday = new Set();
  for (const session of todaysSessions) {
    const results = session.sessionData?.itemResults || [];
    results.forEach(r => reviewedToday.add(r.itemId));
  }

  // Get all due items
  const allDue = await getDueItemsWithPriority(planId, token);

  // Filter out already-reviewed
  const remainingItems = allDue.filter(item => !reviewedToday.has(item.id));

  // Get profile for load calculation
  const profile = await getLearnerProfile(token);
  const dailyGoal = profile.pacePreferences?.avgItemsPerSession || 20;
  const completedToday = reviewedToday.size;
  const remainingGoal = Math.max(0, dailyGoal - completedToday);

  return {
    isFirstSession: false,
    sessionNumber: todaysSessions.length + 1,
    completedToday,
    remainingGoal,
    itemsForSession: remainingItems.slice(0, remainingGoal),
    message: completedToday >= dailyGoal
      ? `You've reached today's goal of ${dailyGoal} items! Extra practice is optional.`
      : `${remainingGoal} items remaining for today's goal.`
  };
}
```

### 4.4 LLM Schedule Reconciliation

```javascript
/**
 * Main reconciliation using LLM for intelligent scheduling
 *
 * @param {string} planId - Plan ID
 * @param {string} token - User token
 * @returns {Object} Reconciliation result
 */
async function reconcileScheduleWithLLM(planId, token) {
  // 1. Gather all context
  const [profile, gapAnalysis, overdueItems, crossPatterns, recentMemories] = await Promise.all([
    getLearnerProfile(token),
    detectStudyGap(planId, token),
    getDueItems(planId, null),  // No limit, get all
    getRecentCrossConceptPatterns(token),
    getRecentConsolidatedMemories(token, 10)
  ]);

  // 2. Build prompt context
  const promptContext = {
    learnerProfile: {
      forgettingCurve: profile.forgettingCurve,
      pacePreferences: profile.pacePreferences,
      sessionPreferences: profile.sessionPreferences,
      engagementTrend: profile.engagementPatterns?.trend,
      consistencyScore: profile.engagementPatterns?.consistencyScore
    },
    gapAnalysis: {
      daysSinceLastSession: gapAnalysis.daysSinceLastSession,
      gapType: gapAnalysis.gapType,
      personalThresholds: gapAnalysis.personalThresholds
    },
    overdueItems: overdueItems.map(item => ({
      id: item.id,
      front: item.front?.substring(0, 50),  // Truncate for prompt
      mastery: item.masteryLevel,
      box: item.box,
      daysOverdue: calculateDaysOverdue(item.nextReview),
      correctStreak: item.correctStreak
    })),
    crossConceptPatterns: crossPatterns.slice(0, 10).map(p => ({
      type: p.type,
      concepts: [p.fromConceptName || p.conceptAName, p.toConceptName || p.conceptBName],
      insight: p.insight
    })),
    recentInsights: recentMemories.flatMap(m => m.insights || []).slice(0, 5)
  };

  // 3. Call LLM for schedule analysis
  const prompt = createScheduleReconciliationPrompt(promptContext);
  const llmResult = await aiProvider.generateContentWithJson(prompt, true);

  // 4. Apply LLM recommendations
  const result = {
    gapAnalysis,
    totalOverdue: overdueItems.length,

    // LLM-generated
    estimatedDecay: llmResult.estimatedDecay || {},
    prioritizedItems: llmResult.prioritizedItems || overdueItems.map(i => i.id),
    recommendedLoad: llmResult.recommendedLoad || { reviewCount: 20, newCount: 5 },
    catchUpPlan: llmResult.catchUpPlan || null,
    userMessage: llmResult.userMessage || 'Welcome back!',

    // Apply priority order
    itemsForToday: applyPriorityOrder(
      overdueItems,
      llmResult.prioritizedItems,
      llmResult.recommendedLoad.reviewCount
    )
  };

  // 5. Persist mastery updates if significant decay
  if (Object.keys(result.estimatedDecay).length > 0) {
    await applyMasteryDecay(result.estimatedDecay, token);
  }

  // 6. Record reconciliation as episode
  await recordReconciliationEpisode(result, token);

  return result;
}
```

---

## 5. Edge Cases

### 5.1 Edge Case Matrix (Profile-Aware)

| Scenario | Learner Type | Action |
|----------|--------------|--------|
| 7 days gap | Strong retention (slope 0.08) | Minor adjustment, ~10% decay |
| 7 days gap | Weak retention (slope 0.25) | Major adjustment, ~40% decay |
| 100 overdue items | Marathon learner | Allow larger daily batches |
| 100 overdue items | Burst learner | Suggest multiple short sessions |
| Same concept studied 3x in day | Any | Flag potential cramming |
| Cross-concept interference | Any | LLM spaces out conflicting concepts |

### 5.2 Cramming Detection

From existing `ConsolidationService.detectCramming()`:
```javascript
detectCramming(episodes) {
  if (episodes.length < 5) return false;
  const firstTime = new Date(episodes[0].timestamp);
  const lastTime = new Date(episodes[episodes.length - 1].timestamp);
  const totalHours = (lastTime - firstTime) / (1000 * 60 * 60);
  // Cramming: >5 reviews in <1 hour
  return totalHours < 1 && episodes.length >= 5;
}
```

**Enhancement**: When cramming is detected, LLM adjusts recommendations:
```json
{
  "recommendation": {
    "message": "We noticed cramming behavior. Spaced reviews are more effective for long-term retention.",
    "suggestedAction": "Take a break and return tomorrow",
    "adjustedSchedule": {
      "todayLimit": 0,
      "tomorrowItems": 15
    }
  }
}
```

### 5.3 Return After Long Absence (30+ days)

```javascript
// LLM receives special "long_absence" context
{
  "scenario": "long_absence",
  "daysSinceLastSession": 45,
  "totalItems": 200,
  "learnerProfile": { ... },

  // Special instruction for LLM
  "instruction": "User returning after 45 days. Generate a gentle re-onboarding plan that doesn't overwhelm."
}

// LLM Output:
{
  "approach": "gradual_reactivation",
  "userMessage": "Welcome back! It's been a while. Let's ease back in with your strongest items first.",
  "phase1": {
    "days": 3,
    "focus": "high_mastery_items",
    "dailyLimit": 10,
    "purpose": "Rebuild confidence"
  },
  "phase2": {
    "days": 5,
    "focus": "medium_mastery_items",
    "dailyLimit": 15,
    "purpose": "Reactivate memory"
  },
  "phase3": {
    "days": 7,
    "focus": "all_items",
    "dailyLimit": 20,
    "purpose": "Full schedule resume"
  }
}
```

---

## 6. Implementation Plan

### Phase 1: Integrate with Existing Brain System

| Task | File | Notes |
|------|------|-------|
| Create `ScheduleReconciliationAgent.js` | `src/main/brain/` | New file, uses existing services |
| Add `createScheduleReconciliationPrompt()` | `AIPrompts.js` | New prompt function |
| Integrate in `getDueItems()` | `LearningPlanManager.js` | Call reconciler first |
| Add IPC handler | `learningPlanHandlers.js` | `learning-plan-reconcile` |

### Phase 2: Profile-Driven Intervals

| Task | File | Notes |
|------|------|-------|
| Add `calculatePersonalizedInterval()` | `LearningPlanGenerator.js` | Use profile.forgettingCurve |
| Fix `processReview()` bug | `learningPlanHandlers.js` | Method doesn't exist currently |
| Track `daysOverdue` in episodes | `EpisodeCollector.js` | Add to REVIEW_COMPLETED payload |

### Phase 3: LLM-Driven Recommendations

| Task | File | Notes |
|------|------|-------|
| Create `getScheduleRecommendations()` | `ConsolidationService.js` | Extend existing method |
| Add catch-up plan generation | `ScheduleReconciliationAgent.js` | LLM generates multi-day plan |
| Store catch-up plans | `LearningPlanManager.js` | New field in plan_data |

### Phase 4: Renderer Integration

| Task | File | Notes |
|------|------|-------|
| Add `scheduleApi.js` | `src/renderer/api/` | New API file |
| Update `useStudySession.js` | Hook | Use reconciled items |
| Show gap notification UI | `StudySessionPage.js` | Display userMessage |
| Show catch-up calendar | `LearningCalendar.js` | Visualize plan |

---

## 7. Prompts Library

### 7.1 Schedule Reconciliation Prompt

```javascript
/**
 * Create prompt for schedule reconciliation
 * @param {Object} context - Full context object
 * @returns {string} Prompt for LLM
 */
export function createScheduleReconciliationPrompt(context) {
  return `You are an adaptive learning schedule manager. Analyze this learner's situation and generate personalized recommendations.

## Learner Profile
- Forgetting curve: optimal interval ${context.learnerProfile.forgettingCurve?.optimalReviewInterval || 7} days, slope ${context.learnerProfile.forgettingCurve?.forgettingSlope || 0.14}
- Session preference: ${context.learnerProfile.sessionPreferences?.optimalMinutes || 20} minutes, ${context.learnerProfile.pacePreferences?.avgItemsPerSession || 15} items
- Engagement: ${context.learnerProfile.engagementTrend || 'stable'} trend, consistency ${Math.round((context.learnerProfile.consistencyScore || 0.5) * 100)}%

## Current Situation
- Days since last session: ${context.gapAnalysis.daysSinceLastSession}
- Gap severity: ${context.gapAnalysis.gapType}
- Overdue items: ${context.overdueItems.length}

## Overdue Items (top 20)
${JSON.stringify(context.overdueItems.slice(0, 20), null, 2)}

## Cross-Concept Patterns
${JSON.stringify(context.crossConceptPatterns, null, 2)}

## Recent Learning Insights
${context.recentInsights.join('\n')}

## Your Task
Generate a JSON response with:
1. estimatedDecay: For each overdue item, estimate mastery decay percentage based on learner's forgetting curve
2. prioritizedItems: Order item IDs by review priority (consider prerequisites, mastery, urgency)
3. recommendedLoad: { reviewCount, newCount } for today's session
4. catchUpPlan: If >1 day needed to clear backlog, plan daily breakdown
5. userMessage: Encouraging message for the user

Consider:
- Prerequisites: Study prerequisite concepts before dependent ones
- Interference: Space out concepts that interfere with each other
- Personal pace: Don't exceed learner's natural session length
- Forgetting curve: Use learner's measured decay rate, not generic formula

Response in JSON format:
{
  "estimatedDecay": { "item_id": decayPercentage, ... },
  "prioritizedItems": ["item_id", ...],
  "recommendedLoad": {
    "reviewCount": number,
    "newCount": number,
    "reasoning": "string"
  },
  "catchUpPlan": {
    "daysNeeded": number,
    "dailyBreakdown": [{ "day": 1, "reviewCount": n, "focus": "string" }, ...]
  } | null,
  "userMessage": "string"
}`;
}
```

### 7.2 Item Priority Prompt (For Complex Cases)

```javascript
/**
 * Create prompt for item prioritization with cross-concept awareness
 */
export function createItemPriorityPrompt(items, patterns, profile) {
  return `Prioritize these learning items for review.

## Items to Prioritize
${JSON.stringify(items, null, 2)}

## Cross-Concept Relationships
${JSON.stringify(patterns, null, 2)}

## Learner Weak/Strong Areas
- Weak: ${profile.weakAreas?.join(', ') || 'None identified'}
- Strong: ${profile.strongAreas?.join(', ') || 'None identified'}

## Prioritization Rules
1. Prerequisites before dependents (if A is prerequisite for B, review A first)
2. Lower mastery items get priority (they need more reinforcement)
3. Interference: if concepts A and B interfere, don't schedule consecutively
4. Weak areas need more attention than strong areas
5. Very overdue items (>2x normal interval) are urgent

Return JSON:
{
  "prioritizedOrder": ["item_id", ...],
  "reasoning": ["1. Item X first because...", "2. Item Y next because...", ...],
  "spacingRecommendations": [
    { "itemA": "id", "itemB": "id", "reason": "interference", "minGap": 3 }
  ]
}`;
}
```

### 7.3 Catch-Up Plan Prompt

```javascript
/**
 * Create prompt for multi-day catch-up plan generation
 */
export function createCatchUpPlanPrompt(overdueCount, profile, deadline = null) {
  return `Generate a catch-up learning plan.

## Situation
- Overdue items: ${overdueCount}
- Learner's daily capacity: ${profile.pacePreferences?.avgItemsPerSession || 15} items
- Consistency score: ${profile.engagementPatterns?.consistencyScore || 0.5}
${deadline ? `- Deadline: ${deadline}` : '- No deadline pressure'}

## Learner Preferences
- Preferred pace: ${profile.pacePreferences?.preferredPace || 'steady'}
- Session length: ${profile.sessionPreferences?.optimalMinutes || 20} minutes
- Focus decay after: ${profile.sessionPreferences?.focusDecayPoint || 25} minutes

## Generate Plan
Create a realistic catch-up plan that:
1. Doesn't overwhelm (max 1.5x normal daily capacity)
2. Respects learner's pace preference
3. Includes rest days if plan is > 5 days
4. Prioritizes high-urgency items in early days

Return JSON:
{
  "totalDays": number,
  "dailyPlan": [
    {
      "day": 1,
      "itemCount": number,
      "sessionCount": number,
      "focus": "Most overdue items",
      "estimatedMinutes": number
    },
    ...
  ],
  "milestones": [
    { "day": 3, "achievement": "50% backlog cleared" },
    ...
  ],
  "encouragement": "You've got this! ..."
}`;
}
```

---

## 8. Summary: Key Differences from Rule-Based Approach

| Aspect | Rule-Based (Old) | LLM-Driven (New) |
|--------|------------------|------------------|
| Forgetting curve | Hardcoded `e^(-days/7)` | Personal `e^(-days/learnerSlope)` |
| Priority scoring | Fixed weights (urgency + mastery) | LLM considers context holistically |
| Daily load | `configuredItems * 1.5` max | Based on learner's actual pace |
| Gap thresholds | Fixed (7/14/30 days) | Relative to personal interval |
| Cross-concept | Not considered | LLM respects prerequisites/interference |
| Catch-up plan | Linear distribution | Personalized phased approach |
| User messaging | Static strings | LLM-generated contextual messages |

---

*Document Version: 2.0 (LLM-Driven)*
*Last Updated: 2024*
*Author: Claude Code*
