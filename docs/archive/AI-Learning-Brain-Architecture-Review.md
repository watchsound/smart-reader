# AI Learning Brain Architecture Review

## Integration Analysis & Gap Assessment

This document reviews the proposed AI Learning Brain architecture against the existing agentic AI implementation in SmartReader v2, identifies gaps, and proposes optimizations for LLM usage.

---

## 1. Existing Agentic Infrastructure (What We Have)

### 1.1 Skill System Architecture

The codebase already has a sophisticated skill system that the Learning Brain should integrate with:

| Component | Location | Relevance to Brain |
|-----------|----------|-------------------|
| **BaseSkill** | `src/main/skills/BaseSkill.js` | Brain actions can extend BaseSkill |
| **SkillRegistry** | `src/main/skills/SkillRegistry.js` | Brain can register its skills |
| **SkillExecutor** | `src/main/skills/SkillExecutor.js` | Brain can execute skills with context |
| **ContextManager** | `src/main/skills/ContextManager.js` | Already tracks session state |
| **AdaptiveLearningSkill** | `src/main/skills/learning/AdaptiveLearningSkill.js` | **Heavy overlap** - already does pattern detection |
| **LearningGraphSkill** | `src/main/skills/learning/LearningGraphSkill.js` | Already manages knowledge graph |

### 1.2 Critical Finding: AdaptiveLearningSkill Already Exists

The `AdaptiveLearningSkill` (1500+ lines) already implements:

| Feature | Current Implementation | Brain Plan |
|---------|----------------------|------------|
| Pattern Detection | ✅ `detect_patterns` - time, day, session length, momentum, fatigue | ✅ Planned |
| Performance Analysis | ✅ `analyze_performance` - trend, consistency, retention | ✅ Planned |
| Difficulty Calibration | ✅ `calibrate_difficulty` - 70-85% target zone | ✅ Planned |
| Spaced Repetition Optimization | ✅ `optimize_spacing` - interval adjustment | ✅ Planned |
| Learning Style Detection | ✅ `detect_learning_style` - visual/auditory/reading/kinesthetic | ✅ Planned |
| Optimal Schedule | ✅ `get_optimal_schedule` - best times, days | ✅ Planned |
| Fatigue Detection | ✅ `detect_fatigue` - decline indicators | ✅ Planned |
| Learner Profile | ✅ `get_learner_profile` - aggregated profile | ✅ Planned |

**Gap**: These features exist but are **reactive** (called on demand), not **proactive** (running autonomously).

### 1.3 LearningGraphSkill Capabilities

The `LearningGraphSkill` already provides:
- Domain-specific concept schemas (vocabulary, math, language, knowledge, skill)
- Learning path generation via Neo4j
- Weak concept detection
- Mastery tracking and updates
- Prerequisite discovery
- Concept network visualization

---

## 2. Integration Points & Gaps

### 2.1 What the Brain Adds (True Gaps)

| Gap | Description | Value |
|-----|-------------|-------|
| **Heartbeat/Scheduler** | No periodic autonomous execution | Enables proactive behavior |
| **Episodic Memory Storage** | Events logged but not structured temporally | Enables intention inference |
| **Memory Consolidation** | No summarization of old events | Efficient long-term storage |
| **Bi-temporal Model** | No event/ingestion time tracking | Point-in-time queries |
| **Autonomous Decision Loop** | Skills are reactive, not proactive | True agent behavior |

### 2.2 Integration Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      LEARNING BRAIN INTEGRATION                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 1: HeartbeatScheduler (NEW)                                 │ │
│  │  ────────────────────────────                                      │ │
│  │  • Periodic wake-up (setTimeout-based)                             │ │
│  │  • BRAIN_CHECKLIST.md parsing                                      │ │
│  │  • Active hours enforcement                                        │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 2: EpisodeCollector (NEW)                                   │ │
│  │  ────────────────────────────                                      │ │
│  │  • Hook into existing skill executions                             │ │
│  │  • Capture learning events with timestamps                         │ │
│  │  • Store in Neo4j Episode nodes                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 3: LearningBrainAgent (NEW) - REUSE EXISTING SKILLS         │ │
│  │  ────────────────────────────────────────────────────────          │ │
│  │  • Uses SkillExecutor to call AdaptiveLearningSkill                │ │
│  │  • Uses SkillExecutor to call LearningGraphSkill                   │ │
│  │  • Adds LLM reasoning layer for intention inference                │ │
│  │  • Makes autonomous decisions based on analysis                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 4: ConsolidationPipeline (NEW)                              │ │
│  │  ────────────────────────────                                      │ │
│  │  • Periodic summarization of old episodes                          │ │
│  │  • LLM-assisted pattern summarization                              │ │
│  │  • Pruning of detailed old data                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 What Should NOT Be Rebuilt

**Do NOT rebuild:**
- Pattern detection algorithms (AdaptiveLearningSkill has them)
- Learning path generation (LearningGraphSkill handles it)
- Weak concept detection (already in LearningGraphSkill)
- Mastery tracking (already in LearningGraphSkill)

**DO add:**
- Heartbeat scheduler
- Episodic event collection hooks
- Memory consolidation pipeline
- LLM-based intention inference
- Autonomous decision execution

---

## 3. LLM Usage Optimization

### 3.1 Current LLM Usage Analysis

| Feature | Current Approach | LLM Needed? |
|---------|-----------------|-------------|
| Pattern Detection | Algorithmic (AdaptiveLearningSkill) | ❌ No |
| Performance Analysis | Statistical (AdaptiveLearningSkill) | ❌ No |
| Difficulty Calibration | Rule-based thresholds | ❌ No |
| Learning Path | Graph traversal (Neo4j) | ❌ No |
| Weak Concept Detection | Graph query (Neo4j) | ❌ No |
| Concept Extraction | LLM (AIConceptExtractionService) | ✅ Yes |
| Intention Inference | Not implemented | ✅ **Yes** |
| Episode Summarization | Not implemented | ✅ **Yes** |

### 3.2 Proposed LLM Usage Strategy

**Principle: Use LLM only where algorithms cannot suffice**

#### Where LLM IS Needed:

1. **Intention Inference** (Complex reasoning)
   - Input: Sequence of episodic events
   - Output: Inferred user intention + confidence
   - Why LLM: Requires understanding temporal patterns and human behavior

2. **Episode Consolidation** (Summarization)
   - Input: Collection of raw episodes (30+ days old)
   - Output: Consolidated summary nodes
   - Why LLM: Natural language summarization

3. **Personalized Recommendations** (Nuanced advice)
   - Input: Learner profile + current state
   - Output: Human-readable advice
   - Why LLM: Contextual, personalized language generation

#### Where LLM is NOT Needed:

1. **Pattern Detection** - Already algorithmic (variance analysis, time buckets)
2. **Mastery Calculation** - Formula-based (adjustment + bonus)
3. **Spaced Repetition Intervals** - Rule-based (Leitner/FSRS)
4. **Learning Path Generation** - Graph traversal (Neo4j Cypher)
5. **Weak Concept Detection** - Scoring formula (masteryGap + staleness + blocking)
6. **Difficulty Calibration** - Threshold comparison (70-85% target)

### 3.3 Context Window Optimization

**Problem**: LLM API calls have context window limits and token costs.

**Strategies:**

#### Strategy 1: Tiered Summarization Before LLM

```
Raw Episodes (unlimited)
       │
       ▼
[Pre-processing: No LLM]
       │
       ▼ Extract key metrics
Structured Summary (small)
       │
       ▼
[LLM Call: Intention Inference]
       │
       ▼
Inferred Intention
```

**Example:**
Instead of sending 100 episodes to LLM:
```json
// DON'T send this (100 episodes, ~10k tokens)
[
  { "type": "review", "concept": "derivative", "rating": 2, "time": "..." },
  { "type": "review", "concept": "derivative", "rating": 2, "time": "..." },
  // ... 98 more
]

// DO send this (pre-aggregated, ~500 tokens)
{
  "timeWindow": "7 days",
  "totalSessions": 15,
  "avgSessionsPerDay": 2.1,
  "studyTimeDistribution": {
    "morning": 3, "afternoon": 2, "evening": 10
  },
  "strugglingConcepts": [
    { "name": "derivative", "attempts": 12, "avgRating": 2.1 }
  ],
  "recentTrend": "cramming_pattern",
  "lastStudyGap": "0 days",
  "streakDays": 7
}
```

#### Strategy 2: Batch Consolidation (Not Per-Episode)

```
// DON'T: Call LLM for each old episode
for (episode of oldEpisodes) {
  await llm.summarize(episode);  // 100 API calls!
}

// DO: Batch consolidation (1 API call per concept group)
const grouped = groupByConcept(oldEpisodes);  // Group 100 episodes into 5 concepts
for (concept of grouped) {
  await llm.summarize(concept.episodes);  // 5 API calls
}
```

#### Strategy 3: Hierarchical Memory (Reduce LLM Load Over Time)

```
Week 1-4:    Raw Episodes     → Keep all detail
Week 4-12:   Weekly Summaries → LLM consolidation once/week
Month 3+:    Monthly Patterns → LLM consolidation once/month
Year+:       Annual Overview  → Single summary node
```

### 3.4 Specific LLM Prompts

#### Intention Inference Prompt (Optimized for Token Efficiency)

```javascript
const intentionPrompt = `
You are a learning analytics system. Based on the learner's recent activity metrics, infer their likely intention.

METRICS:
- Study frequency: ${metrics.avgSessionsPerDay} sessions/day (7-day avg)
- Time pattern: Mostly ${metrics.dominantTime} (${metrics.timeDistribution})
- Concept focus: ${metrics.topConcepts.join(', ')}
- Performance trend: ${metrics.trend}
- Recent gap: ${metrics.lastGap} days since last session

POSSIBLE INTENTIONS:
1. exam_prep: High frequency, focused topics, late hours
2. maintenance: Steady pace, mixed topics, regular schedule
3. catch_up: After gap, review focus
4. exploration: New topics, varied content
5. struggling: Same concepts repeated, low ratings
6. abandoning: Decreasing frequency, broken streak

Respond with JSON only:
{ "intention": "...", "confidence": 0.0-1.0, "evidence": ["..."] }
`;
```

Token estimate: ~200 tokens input, ~50 tokens output = ~250 tokens/inference

#### Consolidation Prompt (Batched)

```javascript
const consolidationPrompt = `
Summarize this learner's journey with "${conceptName}" over the past ${dayCount} days.

RAW EVENTS:
${events.map(e => `- ${e.date}: ${e.type}, rating: ${e.rating}`).join('\n')}

Create a concise summary (2-3 sentences) capturing:
1. Overall progress trajectory
2. Key struggles or breakthroughs
3. Current mastery state

Respond with JSON:
{ "summary": "...", "progressType": "improving|struggling|plateaued", "masteryEstimate": 0-100 }
`;
```

Token estimate: ~300 tokens input (for ~20 events), ~80 tokens output = ~380 tokens/consolidation

### 3.5 Cost Estimation

| Operation | Frequency | Tokens/Call | Calls/Month | Monthly Tokens |
|-----------|-----------|-------------|-------------|----------------|
| Intention Inference | Daily | 250 | 30 | 7,500 |
| Episode Consolidation | Weekly | 380 | 4 (×5 concepts) | 7,600 |
| Personalized Advice | Weekly | 500 | 4 | 2,000 |
| **Total** | | | | **~17,100** |

At Claude pricing (~$3/1M tokens): **~$0.05/month** per user

Compare to if we used LLM for everything:
- 100 reviews/month × 200 tokens = 20,000 tokens (just logging)
- Pattern detection × 30 days = 30,000+ tokens
- **Savings: 75%+ by using algorithms where possible**

---

## 4. Revised Architecture Recommendations

### 4.1 Updated Component Breakdown

```
src/main/brain/
├── index.js                    # Main exports
│
├── heartbeat/
│   ├── HeartbeatScheduler.js   # Periodic wake-up (setTimeout-based)
│   ├── BrainChecklist.js       # BRAIN_CHECKLIST.md parser
│   └── ActiveHoursManager.js   # Time window enforcement
│
├── episode/
│   ├── EpisodeCollector.js     # Event collection hooks
│   ├── EpisodeSchema.js        # Event type definitions
│   └── EpisodeStore.js         # Neo4j persistence (Episode nodes)
│
├── agent/
│   ├── LearningBrainAgent.js   # Main brain logic
│   ├── IntentionInferrer.js    # LLM-based intention (NEW)
│   └── DecisionExecutor.js     # Action execution
│
├── consolidation/
│   ├── ConsolidationPipeline.js  # Orchestration
│   ├── EpisodeAggregator.js      # Pre-LLM aggregation (NO LLM)
│   └── SummaryGenerator.js       # LLM summarization (BATCHED)
│
└── integration/
    ├── AdaptiveSkillBridge.js    # Calls AdaptiveLearningSkill
    └── GraphSkillBridge.js       # Calls LearningGraphSkill
```

### 4.2 Key Integration Hooks

```javascript
// Hook into existing skill execution
SkillExecutor.execute = async function(skillName, params, context) {
  const result = await originalExecute(skillName, params, context);

  // Collect episode if learning-related
  if (LEARNING_SKILLS.includes(skillName)) {
    await episodeCollector.record({
      eventType: `skill_${skillName}`,
      params: summarizeParams(params),
      result: summarizeResult(result),
      timestamp: new Date().toISOString()
    });
  }

  return result;
};

// Hook into study session
StudySessionPage.handleRate = async function(rating) {
  const result = await originalHandleRate(rating);

  await episodeCollector.record({
    eventType: 'review_completed',
    payload: { conceptId, rating, responseTimeMs },
    timestamp: new Date().toISOString()
  });

  return result;
};
```

### 4.3 Brain Agent Flow (LLM-Optimized)

```javascript
class LearningBrainAgent {
  async executeHeartbeat() {
    // 1. Gather data (NO LLM)
    const recentEpisodes = await this.episodeStore.getRecent(7);  // Last 7 days
    const aggregatedMetrics = this.aggregator.aggregate(recentEpisodes);  // NO LLM

    // 2. Run algorithmic analysis (NO LLM) - reuse existing skills
    const patternResult = await this.skillExecutor.execute('adaptive_learning', {
      action: 'detect_patterns',
      performanceHistory: aggregatedMetrics.sessions
    }, this.context);

    const weakConcepts = await this.skillExecutor.execute('manage_learning_graph', {
      action: 'get_weak_concepts',
      limit: 5
    }, this.context);

    // 3. LLM-based intention inference (ONLY place LLM is needed)
    const intention = await this.intentionInferrer.infer(aggregatedMetrics);

    // 4. Make decisions based on all inputs (NO LLM - rule-based)
    const decisions = this.decisionEngine.decide({
      patterns: patternResult.patterns,
      weakConcepts: weakConcepts.weakConcepts,
      intention: intention,
      checklist: this.checklist.items
    });

    // 5. Execute decisions
    for (const decision of decisions) {
      await this.decisionExecutor.execute(decision);
    }

    return { success: true, decisions };
  }
}
```

---

## 5. Summary of Recommendations

### 5.1 DO

1. **Integrate with existing skills** - Don't rebuild AdaptiveLearningSkill or LearningGraphSkill
2. **Add heartbeat scheduler** - The missing piece for proactive behavior
3. **Implement episodic event collection** - Hook into existing code paths
4. **Use LLM only for intention inference and summarization** - ~3% of operations
5. **Pre-aggregate data before LLM calls** - 75% token savings
6. **Batch consolidation** - Monthly, not per-episode

### 5.2 DON'T

1. **Don't rebuild pattern detection** - AdaptiveLearningSkill already has it
2. **Don't use LLM for mastery calculations** - Formulas work better
3. **Don't use LLM for learning path generation** - Graph traversal is deterministic
4. **Don't send raw episodes to LLM** - Always pre-aggregate
5. **Don't consolidate per-episode** - Batch by concept/time period

### 5.3 Implementation Priority

| Priority | Component | Effort | Value |
|----------|-----------|--------|-------|
| 1 | HeartbeatScheduler | Low | Enables everything |
| 2 | EpisodeCollector + Store | Medium | Foundation for memory |
| 3 | Skill Integration Bridges | Low | Reuse existing logic |
| 4 | IntentionInferrer (LLM) | Medium | Core intelligence |
| 5 | ConsolidationPipeline | Medium | Long-term efficiency |
| 6 | UI Integration | Medium | User visibility |

---

## 6. Appendix: Existing Skill Actions Reference

### AdaptiveLearningSkill Actions (All Algorithmic, No LLM)
- `detect_patterns` - Time, day, session, momentum, fatigue patterns
- `analyze_performance` - Overall, trend, consistency, retention
- `calibrate_difficulty` - Target 70-85% accuracy zone
- `optimize_spacing` - Interval adjustment based on retention
- `detect_learning_style` - Visual/auditory/reading/kinesthetic
- `suggest_adaptations` - Combines all analyses
- `get_optimal_schedule` - Best times and days
- `analyze_content_effectiveness` - Content type comparison
- `detect_fatigue` - Decline indicators
- `get_learner_profile` - Aggregated profile

### LearningGraphSkill Actions (Graph Queries, No LLM)
- `create_concept` - Create concept node
- `link_concepts` - Create relationship
- `get_learning_path` - Prerequisite-based path
- `get_weak_concepts` - Low mastery concepts
- `update_mastery` - Update mastery level
- `get_concept_network` - Surrounding concepts
- `get_domain_schema` - Domain-specific schema
- `suggest_next_concepts` - Ready-to-learn concepts
- `get_prerequisites` - Prerequisite concepts
- `get_dependents` - Dependent concepts
- `find_related_concepts` - Related by any relationship
- `get_mastery_overview` - Domain mastery statistics

---

*Review completed: 2026-02-24*
