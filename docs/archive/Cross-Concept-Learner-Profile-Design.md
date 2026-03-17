# Cross-Concept Pattern Detection & Learner Profile Design

## Overview

This document outlines the design for cross-concept consolidation and learner profile inference - two features that transform raw learning data into actionable insights about how a user learns.

## Part 1: What Patterns Are We Looking For?

### 1.1 Temporal Patterns

| Pattern | Detection Method | Insight Value |
|---------|-----------------|---------------|
| **Optimal Study Time** | Correlate `hour_of_day` with accuracy | "You perform 15% better when studying in the morning" |
| **Session Duration Sweet Spot** | Analyze accuracy decay over session time | "Your focus drops after 25 minutes" |
| **Day-of-Week Preferences** | Aggregate sessions by `day_of_week` | "Tuesday and Thursday are your best study days" |
| **Learning Velocity Trends** | Track mastery progression over time windows | "You learn vocabulary 2x faster than math concepts" |
| **Cramming Detection** | 5+ reviews in <1 hour for same topic | "Cramming detected - try spacing reviews for better retention" |
| **Spacing Compliance** | Compare actual vs optimal review intervals | "You're reviewing 2 days early - this wastes effort" |

### 1.2 Performance Patterns

| Pattern | Detection Method | Insight Value |
|---------|-----------------|---------------|
| **Struggle Chains** | Incorrect → hint → incorrect → correct sequence | "You typically need 3 attempts before mastering hard items" |
| **Response Time Distribution** | Fast (<2s) vs slow (>10s) vs timeout | "Fast responses have 90% accuracy; slow ones only 60%" |
| **Confidence Calibration** | Self-rated confidence vs actual accuracy | "You're overconfident - items you rate 'easy' fail 30% of the time" |
| **Mistake Type Clustering** | Group errors by `mistakeType` | "40% of your errors are conceptual, not careless" |
| **Hint Dependency** | Track hint usage rate over time | "Your hint usage is decreasing - good progress!" |
| **Recovery Patterns** | Time to recover from wrong answer | "After mistakes, you recover faster in vocabulary than math" |

### 1.3 Cross-Concept Patterns

| Pattern | Detection Method | Insight Value |
|---------|-----------------|---------------|
| **Concept Prerequisites** | A mastered before B improves → A prerequisite of B | "Master 'fractions' before attempting 'percentages'" |
| **Concept Interference** | Learning A degrades B accuracy | "Learning Spanish interferes with your French - review French more" |
| **Positive Transfer** | Learning A improves B | "Your programming concepts are helping with math logic" |
| **Concept Clustering** | Concepts often studied together | "You naturally group grammar with vocabulary" |
| **Domain Crossover Effects** | Performance in domain A affects domain B | "Your reading comprehension skills boost vocabulary learning" |
| **Forgetting Correlation** | Items forgotten together | "Irregular verbs and prepositions decay at similar rates" |

### 1.4 Behavioral Patterns

| Pattern | Detection Method | Insight Value |
|---------|-----------------|---------------|
| **Session Start Triggers** | Context before session (time, previous activity) | "You study best after reading, not after video" |
| **Quit Signals** | What happens before session ends early | "You quit when accuracy drops below 50%" |
| **Content Preferences** | Engagement by content type | "You engage 3x longer with visual content" |
| **Pace Preferences** | Items per session distribution | "You prefer short bursts of 10-15 items" |
| **Break Patterns** | Pause frequency and duration | "You take breaks every 8 items - optimizing for this" |
| **Goal Orientation** | Goal completion vs abandonment rates | "You complete 80% of daily goals, 40% of weekly goals" |

## Part 2: Learner Profile Inference Rules

### 2.1 Learning Style Inference

The system infers learning style from behavioral signals:

```javascript
// Learning Style Score Calculation
const inferLearningStyleScores = (episodes, sessionAnalytics) => {
  const scores = { visual: 0, reading: 0, hands_on: 0, auditory: 0 };
  let totalWeight = 0;

  // Visual: High engagement with diagrams, images, graphs
  const visualContent = episodes.filter(e =>
    e.sourceContext?.contentType === 'image' ||
    e.sourceContext?.view === 'moodboard' ||
    e.payload?.diagramUsed
  );
  scores.visual = visualContent.length / totalEpisodes;

  // Reading: Long text engagement, highlight creation, note taking
  const readingSignals = episodes.filter(e =>
    e.eventType === 'HIGHLIGHT_CREATED' ||
    e.eventType === 'NOTE_CREATED' ||
    (e.sourceContext?.view === 'reading' && e.payload?.durationMinutes > 5)
  );
  scores.reading = readingSignals.length / totalEpisodes;

  // Hands-on: Quiz taking, flashcard reviews, active recall
  const handsOnSignals = episodes.filter(e =>
    e.eventType === 'QUIZ_TAKEN' ||
    e.eventType === 'REVIEW_COMPLETED' ||
    e.payload?.practiceMode === true
  );
  scores.hands_on = handsOnSignals.length / totalEpisodes;

  // Auditory: TTS usage, audio playback
  const auditorySignals = episodes.filter(e =>
    e.payload?.ttsUsed === true ||
    e.sourceContext?.contentType === 'audio'
  );
  scores.auditory = auditorySignals.length / totalEpisodes;

  return normalizeScores(scores); // Sum to 1.0
};
```

### 2.2 Optimal Timing Inference

```javascript
const inferOptimalTiming = (sessionAnalytics) => {
  // Group sessions by hour
  const byHour = groupBy(sessionAnalytics, s => s.hour_of_day);

  // Calculate average accuracy per hour
  const hourlyPerformance = Object.entries(byHour).map(([hour, sessions]) => ({
    hour: parseInt(hour),
    avgAccuracy: mean(sessions.map(s => s.efficiency_score)),
    sessionCount: sessions.length
  }));

  // Find best hours (top 3 with enough data)
  const validHours = hourlyPerformance.filter(h => h.sessionCount >= 3);
  const bestHours = validHours.sort((a, b) => b.avgAccuracy - a.avgAccuracy).slice(0, 3);

  // Determine time preference
  const bestHourAvg = mean(bestHours.map(h => h.hour));
  if (bestHourAvg >= 5 && bestHourAvg < 12) return 'morning';
  if (bestHourAvg >= 12 && bestHourAvg < 17) return 'afternoon';
  if (bestHourAvg >= 17 && bestHourAvg < 21) return 'evening';
  return 'night';
};
```

### 2.3 Session Length Optimization

```javascript
const inferOptimalSessionLength = (sessions) => {
  // Group sessions by duration buckets
  const buckets = {
    short: sessions.filter(s => s.duration_minutes <= 10),
    medium: sessions.filter(s => s.duration_minutes > 10 && s.duration_minutes <= 25),
    long: sessions.filter(s => s.duration_minutes > 25)
  };

  // Calculate effectiveness per bucket
  const effectiveness = {};
  for (const [bucket, data] of Object.entries(buckets)) {
    if (data.length < 3) continue;

    effectiveness[bucket] = {
      avgAccuracy: mean(data.map(s => s.accuracy)),
      avgFocus: mean(data.map(s => s.focus_score)),
      combined: (avgAccuracy * 0.6) + (avgFocus * 0.4)
    };
  }

  // Find optimal
  const best = Object.entries(effectiveness)
    .sort((a, b) => b[1].combined - a[1].combined)[0];

  return {
    preference: best[0],
    optimalMinutes: best[0] === 'short' ? 10 : best[0] === 'medium' ? 20 : 35
  };
};
```

### 2.4 Forgetting Curve Modeling

```javascript
const calculateForgettingCurve = (reviewEpisodes) => {
  // Group by item, sort by time
  const byItem = groupBy(reviewEpisodes, e => e.payload.conceptId);

  const decayRates = [];

  for (const [itemId, reviews] of Object.entries(byItem)) {
    const sorted = reviews.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Calculate accuracy decay between reviews
    for (let i = 1; i < sorted.length; i++) {
      const gap = daysBetween(sorted[i-1].timestamp, sorted[i].timestamp);
      const prevCorrect = sorted[i-1].payload.wasCorrect;
      const currCorrect = sorted[i].payload.wasCorrect;

      if (prevCorrect && !currCorrect) {
        // Forgot after gap days - record decay point
        decayRates.push({ gap, itemId });
      }
    }
  }

  // Fit Ebbinghaus curve: R = e^(-t/S)
  // S = memory strength, higher = slower forgetting
  const avgDecayGap = mean(decayRates.map(d => d.gap));
  const forgettingSlope = 1 / avgDecayGap; // Lower = better retention

  return {
    optimalReviewInterval: Math.ceil(avgDecayGap * 0.8), // Review before decay
    forgettingSlope,
    retentionStrength: 1 / forgettingSlope
  };
};
```

### 2.5 Cross-Concept Relationship Detection

```javascript
const detectConceptRelationships = async (episodes, conceptGraph) => {
  const relationships = [];

  // Get all concepts user has studied
  const studiedConcepts = unique(episodes
    .filter(e => e.payload?.conceptId)
    .map(e => e.payload.conceptId)
  );

  // For each pair, analyze correlation
  for (let i = 0; i < studiedConcepts.length; i++) {
    for (let j = i + 1; j < studiedConcepts.length; j++) {
      const conceptA = studiedConcepts[i];
      const conceptB = studiedConcepts[j];

      const reviewsA = episodes.filter(e => e.payload?.conceptId === conceptA);
      const reviewsB = episodes.filter(e => e.payload?.conceptId === conceptB);

      // Check for prerequisite relationship
      // If A mastered before B, and B improved faster afterward
      const aMasteryDate = findMasteryDate(reviewsA);
      const bStartDate = findFirstReview(reviewsB);

      if (aMasteryDate && bStartDate && aMasteryDate < bStartDate) {
        const bAccuracyAfterA = calculateAccuracyAfterDate(reviewsB, aMasteryDate);
        const bAccuracyBefore = calculateAccuracyBeforeDate(reviewsB, aMasteryDate);

        if (bAccuracyAfterA > bAccuracyBefore + 0.15) {
          relationships.push({
            type: 'PREREQUISITE',
            from: conceptA,
            to: conceptB,
            confidence: (bAccuracyAfterA - bAccuracyBefore) / 0.15,
            insight: `Mastering ${conceptA} improved ${conceptB} performance`
          });
        }
      }

      // Check for interference
      // If studying A causes B accuracy to drop
      const overlappingPeriods = findOverlappingSessions(reviewsA, reviewsB);
      for (const period of overlappingPeriods) {
        const bAccuracyDuring = getAccuracyInPeriod(reviewsB, period);
        const bAccuracyOutside = getAccuracyOutsidePeriod(reviewsB, period);

        if (bAccuracyDuring < bAccuracyOutside - 0.1) {
          relationships.push({
            type: 'INTERFERENCE',
            between: [conceptA, conceptB],
            severity: (bAccuracyOutside - bAccuracyDuring),
            insight: `Studying ${conceptA} and ${conceptB} together reduces performance`
          });
        }
      }

      // Check for positive transfer
      // If improvement in A correlates with improvement in B
      const aVelocity = calculateLearningVelocity(reviewsA);
      const bVelocity = calculateLearningVelocity(reviewsB);
      const correlation = pearsonCorrelation(aVelocity, bVelocity);

      if (correlation > 0.7) {
        relationships.push({
          type: 'POSITIVE_TRANSFER',
          between: [conceptA, conceptB],
          correlation,
          insight: `Learning ${conceptA} helps with ${conceptB} (and vice versa)`
        });
      }
    }
  }

  return relationships;
};
```

## Part 3: Data Collection Requirements

### 3.1 Required Episode Payload Fields

To enable comprehensive pattern detection, episodes should include:

```typescript
interface ReviewEpisodePayload {
  // Core identifiers
  conceptId: string;
  conceptName: string;
  domainType: DomainType;
  topicId?: string;

  // Performance metrics
  wasCorrect: boolean;
  rating: 1 | 2 | 3 | 4;  // Again, Hard, Good, Easy
  responseTimeMs: number;

  // Learning context
  hintUsed: boolean;
  hintLevel?: number;  // 1-4 progressive hints
  attemptNumber: number;  // Within session

  // Spaced repetition state
  previousBox: number;
  newBox: number;
  intervalDays: number;

  // Optional enrichment
  mistakeType?: 'conceptual' | 'careless' | 'memory' | 'calculation' | 'grammatical';
  confidenceRating?: 1 | 2 | 3 | 4 | 5;  // Self-assessed
  difficultyRating?: 1 | 2 | 3 | 4 | 5;  // Perceived
}

interface SessionEpisodePayload {
  sessionId: string;
  mode: 'standard' | 'quick' | 'focused' | 'cram';

  // Timing
  startTime: string;
  endTime?: string;
  durationMinutes: number;

  // Performance summary
  itemsReviewed: number;
  correctCount: number;
  incorrectCount: number;
  avgResponseTimeMs: number;

  // Behavioral signals
  pauseCount: number;
  pauseTotalSeconds: number;
  hintsUsed: number;
  itemsSkipped: number;

  // Context
  planId?: string;
  topicIds: string[];
  domainTypes: DomainType[];
}
```

### 3.2 New Data to Collect

Currently missing but valuable for profile inference:

| Data Point | Collection Point | Purpose |
|------------|-----------------|---------|
| `confidenceRating` | Before answer reveal | Calibration analysis |
| `difficultyRating` | After answer | Perceived vs actual difficulty |
| `mistakeType` | After wrong answer | Error pattern classification |
| `contentType` | From source context | Learning style inference |
| `ttsUsed` | TTS playback events | Auditory preference |
| `pauseReason` | Pause dialog | Engagement analysis |
| `sessionEndReason` | Session end | Quit pattern analysis |

### 3.3 Computed Metrics to Store

Store these in `session_analytics` for efficient querying:

```sql
ALTER TABLE session_analytics ADD COLUMN cramming_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE session_analytics ADD COLUMN response_time_variance REAL;
ALTER TABLE session_analytics ADD COLUMN accuracy_trend TEXT;  -- 'improving'|'stable'|'declining'
ALTER TABLE session_analytics ADD COLUMN optimal_time_match BOOLEAN;  -- studied during optimal time?
```

## Part 4: Implementation Architecture

### 4.1 Service Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Learner Intelligence Layer                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ CrossConcept    │    │ LearnerProfile  │    │ Pattern      │ │
│  │ Analyzer        │───▶│ Inference       │───▶│ Recommender  │ │
│  │                 │    │ Engine          │    │              │ │
│  └────────┬────────┘    └────────┬────────┘    └──────────────┘ │
│           │                      │                               │
│           ▼                      ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Episode & Analytics Store                 ││
│  │  ┌──────────┐  ┌────────────────┐  ┌────────────────────┐  ││
│  │  │ Episode  │  │ Session        │  │ Learner Profile    │  ││
│  │  │ Collector│  │ Analytics Mgr  │  │ Manager            │  ││
│  │  └──────────┘  └────────────────┘  └────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 New Files to Create

| File | Purpose |
|------|---------|
| `src/main/utils/CrossConceptAnalyzer.js` | Detect relationships between concepts |
| `src/main/utils/LearnerProfileInference.js` | Infer profile from behavioral data |
| `src/main/utils/PatternDetector.js` | Generic pattern detection utilities |
| `src/main/utils/TemporalAnalyzer.js` | Time-based pattern analysis |
| `src/commons/model/LearningPatterns.ts` | Type definitions for patterns |

### 4.3 Integration with Consolidation

The consolidation service will be extended to:

1. **Per-Concept Analysis** (existing): Analyze learning process for single concept
2. **Cross-Concept Analysis** (new): Detect relationships between concepts
3. **Profile Update** (new): Update learner profile based on patterns

```javascript
// In ConsolidationService.consolidateEpisodes()
async consolidateEpisodes(userId, token, options) {
  // 1. Existing: Per-concept consolidation
  const conceptResults = await this.consolidatePerConcept(userId, token, options);

  // 2. NEW: Cross-concept analysis
  const crossConceptPatterns = await this.crossConceptAnalyzer.analyze(
    conceptResults,
    options.lookbackDays || 30
  );

  // 3. NEW: Update learner profile
  const profileUpdates = await this.profileInference.inferFromPatterns(
    conceptResults,
    crossConceptPatterns
  );

  await this.updateLearnerProfile(userId, profileUpdates, token);

  return {
    conceptConsolidations: conceptResults,
    crossConceptPatterns,
    profileUpdates
  };
}
```

## Part 5: AI-Powered Insights

### 5.1 LLM Prompts for Pattern Synthesis

```javascript
const createCrossConceptPrompt = (patterns, profile) => `
You are analyzing learning patterns across multiple concepts for a learner.

Detected Patterns:
${JSON.stringify(patterns, null, 2)}

Current Learner Profile:
${JSON.stringify(profile, null, 2)}

Synthesize these patterns into actionable insights:

1. **Learning Strategy Observations**: What does this tell us about how they learn?
2. **Cross-Concept Recommendations**: Which concepts should they study together/separately?
3. **Schedule Optimization**: When and how long should they study?
4. **Focus Areas**: What should they prioritize?
5. **Encouragement**: What are they doing well?

Return JSON:
{
  "strategyInsights": ["insight 1", "insight 2"],
  "conceptRecommendations": [
    { "action": "study_together|study_separately|prerequisite", "concepts": ["A", "B"], "reason": "..." }
  ],
  "scheduleRecommendations": {
    "optimalTimes": ["9:00 AM", "3:00 PM"],
    "sessionLength": 20,
    "frequency": "daily",
    "reasoning": "..."
  },
  "focusAreas": [
    { "concept": "...", "priority": "high|medium|low", "reason": "..." }
  ],
  "encouragement": "...",
  "profileUpdates": {
    "learningStyle": "visual|reading|hands_on|auditory|mixed",
    "consistencyScore": 0.0-1.0,
    "aiInsights": ["new insight 1", "new insight 2"]
  }
}
`;
```

### 5.2 Automated Profile Updates

After AI analysis, automatically update profile:

```javascript
const updateProfileFromAI = async (aiResult, token) => {
  const { profileUpdates, scheduleRecommendations, strategyInsights } = aiResult;

  // Update global profile
  await updateGlobalProfile({
    learningStyle: profileUpdates.learningStyle,
    optimalSessionLength: scheduleRecommendations.sessionLength,
    preferredTimeOfDay: inferTimePreference(scheduleRecommendations.optimalTimes),
    aiInsights: [...existingInsights, ...strategyInsights].slice(-10),
    lastAnalyzedAt: new Date()
  }, token);

  // Update domain profiles with focus areas
  for (const focusArea of aiResult.focusAreas) {
    const domainType = inferDomainFromConcept(focusArea.concept);
    await updateDomainProfile(domainType, {
      suggestedFocus: [focusArea.concept, ...existing].slice(0, 5)
    }, token);
  }
};
```

## Part 6: Next Steps

### Phase 1: Data Collection Enhancement
1. Add missing payload fields to episode recording
2. Add `cramming_detected` and `accuracy_trend` to session analytics
3. Create `learning_pattern` table for storing detected patterns

### Phase 2: Pattern Detection Implementation
1. Implement `CrossConceptAnalyzer.js`
2. Implement `LearnerProfileInference.js`
3. Add temporal pattern detection

### Phase 3: Integration
1. Extend `ConsolidationService` with cross-concept analysis
2. Add IPC handlers for pattern queries
3. Create UI components for displaying insights

### Phase 4: AI Enhancement
1. Create LLM prompts for pattern synthesis
2. Implement automated profile updates
3. Add notification system for insights
