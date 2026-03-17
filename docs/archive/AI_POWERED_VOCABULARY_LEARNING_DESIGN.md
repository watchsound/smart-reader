# AI-Powered Vocabulary Learning System Design

## Executive Summary

This document proposes a comprehensive AI-powered vocabulary learning system that transforms the current hardcoded Leitner implementation into an intelligent, adaptive learning experience. The design leverages the existing skill system, AI providers, and Neo4j knowledge graph to create a truly personalized vocabulary acquisition system.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Vision: AI-First Vocabulary Learning](#2-vision-ai-first-vocabulary-learning)
3. [Core AI Skills Design](#3-core-ai-skills-design)
4. [Adaptive Leitner System](#4-adaptive-leitner-system)
5. [AI Learning Plan Generation](#5-ai-learning-plan-generation)
6. [Progress Management & Prediction](#6-progress-management--prediction)
7. [Knowledge Graph Integration](#7-knowledge-graph-integration)
8. [Creative Learning Features](#8-creative-learning-features)
9. [Database Schema Extensions](#9-database-schema-extensions)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Current State Analysis

### 1.1 What Works Well
- ✅ Multi-point vocabulary import (settings, panel, browser, chat)
- ✅ AI-generated definitions with reader level adaptation
- ✅ Smart Summary with vocabulary-constrained output
- ✅ Visual animations (flying words, highlighting)
- ✅ Basic Leitner 5-box system
- ✅ Skill system architecture ready for extension

### 1.2 Critical Gaps

| Gap | Current State | Impact |
|-----|---------------|--------|
| **Fixed Intervals** | 1→2→4→7→14 days for ALL words | No personalization |
| **No Difficulty Assessment** | All words start in Box 1 | Easy words waste time |
| **No Performance Metrics** | Only count skips/flips | Can't predict mastery |
| **No Learning Plan** | User picks words randomly | No curriculum guidance |
| **No Progress Prediction** | Binary "learned/not learned" | No motivation/forecast |
| **No Pattern Detection** | Can't identify weak areas | No targeted practice |
| **No Neo4j Integration** | Vocabulary isolated from graph | No concept relationships |

### 1.3 The Core Problem

```
CURRENT: Human-driven, static system
┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │────▶│ Leitner │────▶│ Review  │
│ Chooses │     │ Box 1   │     │ Fixed   │
│  Words  │     │ Always  │     │ Schedule│
└─────────┘     └─────────┘     └─────────┘

PROPOSED: AI-driven, adaptive system
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│   AI    │────▶│   AI    │────▶│   AI    │────▶│   AI    │
│ Selects │     │ Assesses│     │ Adapts  │     │ Predicts│
│  Words  │     │Difficulty│    │ Spacing │     │ Mastery │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
      ▲                                               │
      └───────────────────────────────────────────────┘
                    Continuous Learning Loop
```

---

## 2. Vision: AI-First Vocabulary Learning

### 2.1 Design Principles

1. **AI as Learning Partner** - Not just a definition generator, but a tutor that understands your learning patterns
2. **Personalized Everything** - Intervals, difficulty, content, practice all adapt to YOU
3. **Predictive, Not Reactive** - System anticipates struggles before they happen
4. **Context-Rich Learning** - Words learned in meaningful contexts from your reading
5. **Graph-Connected** - Vocabulary connected to concepts, creating a knowledge web

### 2.2 User Experience Vision

```
┌────────────────────────────────────────────────────────────────────────┐
│  🎯 YOUR LEARNING DASHBOARD                              Week 3 of 12  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  📊 AI INSIGHTS                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ "You're 23% faster at learning nouns than verbs. I've adjusted   │ │
│  │  your schedule to give phrasal verbs more practice time."        │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  📈 MASTERY PREDICTION                                                 │
│  ┌─────────────────────────────────────────┐                          │
│  │ ████████████████░░░░░░░░ 67% → 100%     │  Est. completion: 18 days│
│  │                                         │                          │
│  │ 🟢 On track for your GRE goal (Dec 15) │                          │
│  └─────────────────────────────────────────┘                          │
│                                                                        │
│  🔥 TODAY'S SMART REVIEW (AI-Optimized)                               │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ 12 words • Est. 8 min • Mix: 3 hard, 6 medium, 3 reinforcement │   │
│  │                                                                 │   │
│  │ [Start Smart Review]  [Customize]  [Skip to Struggling Words]  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ⚠️ WORDS NEEDING ATTENTION (AI-Detected)                             │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ • "ephemeral" - Failed 4x, AI suggests: visual memory exercise │   │
│  │ • "ubiquitous" - Confused with "ambiguous", AI drill available │   │
│  │ • "pragmatic" - Slow response time, needs reinforcement        │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  📚 AI LEARNING PLAN                                                   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ This Week's Focus: Abstract Concepts (based on your reading)   │   │
│  │                                                                 │   │
│  │ Day 1: ephemeral, transient, fleeting (word family)           │   │
│  │ Day 2: Review + ubiquitous, pervasive, omnipresent            │   │
│  │ Day 3: Practice sentences with all 6 words                     │   │
│  │ ...                                                             │   │
│  │                                                                 │   │
│  │ [View Full Plan]  [Adjust Pace]  [Add Custom Words]            │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core AI Skills Design

### 3.1 VocabularyDifficultyAssessmentSkill

**Purpose**: AI evaluates word difficulty for THIS user based on multiple factors.

```javascript
// src/main/skills/ai/VocabularyDifficultyAssessmentSkill.js

class VocabularyDifficultyAssessmentSkill extends BaseSkill {
  static get name() { return 'vocabulary_difficulty_assessment'; }
  static get description() {
    return 'AI assesses word difficulty based on phonetic complexity, semantic distance, frequency, and user profile';
  }
  static get category() { return 'ai'; }

  static get parameters() {
    return {
      word: { type: 'string', description: 'Word to assess' },
      userNativeLanguage: { type: 'string', description: 'User L1 for interference analysis' },
      readerLevel: { type: 'string', enum: ['elementary', 'middle', 'high', 'college'] },
      existingVocabulary: { type: 'array', description: 'Words user already knows (for similarity check)' }
    };
  }

  async execute({ word, userNativeLanguage, readerLevel, existingVocabulary = [] }) {
    const prompt = `
You are a vocabulary difficulty analyst. Assess "${word}" for a ${readerLevel}-level learner whose native language is ${userNativeLanguage}.

Consider:
1. **Phonetic Difficulty** (1-5): Pronunciation complexity, silent letters, unusual patterns
2. **Semantic Difficulty** (1-5): Abstract vs concrete, multiple meanings, cultural context needed
3. **Morphological Difficulty** (1-5): Word roots, prefixes, suffixes complexity
4. **Frequency Score** (1-5): How common in academic/professional contexts
5. **L1 Interference Risk** (1-5): False friends, missing concepts in ${userNativeLanguage}
6. **Similar Words Confusion Risk**: Words it might be confused with from: ${existingVocabulary.slice(0, 50).join(', ')}

Return JSON:
{
  "overallDifficulty": 1-5 (weighted average),
  "phoneticDifficulty": 1-5,
  "semanticDifficulty": 1-5,
  "morphologicalDifficulty": 1-5,
  "frequencyScore": 1-5,
  "l1InterferenceRisk": 1-5,
  "confusionRisk": {
    "hasRisk": boolean,
    "confusableWords": ["word1", "word2"],
    "confusionType": "spelling|meaning|pronunciation"
  },
  "recommendedInitialBox": 1-3,
  "recommendedIntervalMultiplier": 0.5-2.0,
  "learningTips": ["tip1", "tip2"],
  "mnemonicSuggestion": "memory aid if helpful"
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return {
      word,
      difficulty: result,
      assessedAt: new Date().toISOString()
    };
  }
}
```

### 3.2 VocabularyPerformanceAnalysisSkill

**Purpose**: Analyze user's performance history to predict mastery and detect patterns.

```javascript
// src/main/skills/ai/VocabularyPerformanceAnalysisSkill.js

class VocabularyPerformanceAnalysisSkill extends BaseSkill {
  static get name() { return 'vocabulary_performance_analysis'; }
  static get description() {
    return 'Analyzes vocabulary performance history to predict mastery and optimize scheduling';
  }

  static get parameters() {
    return {
      wordId: { type: 'number', description: 'Vocabulary ID to analyze' },
      performanceHistory: {
        type: 'array',
        description: 'Array of {timestamp, correct, responseTimeMs, confidenceLevel}'
      },
      currentBox: { type: 'number' },
      currentDifficulty: { type: 'number' }
    };
  }

  async execute({ wordId, performanceHistory, currentBox, currentDifficulty }) {
    const prompt = `
You are a spaced repetition optimization expert. Analyze this vocabulary learning data:

Word ID: ${wordId}
Current Leitner Box: ${currentBox}
Difficulty Rating: ${currentDifficulty}/5
Performance History (last 20 reviews):
${JSON.stringify(performanceHistory, null, 2)}

Analyze:
1. **Forgetting Curve**: How quickly does this user forget this word?
2. **Confidence Trend**: Is confidence increasing, stable, or declining?
3. **Response Time Trend**: Getting faster (mastery) or slower (forgetting)?
4. **Error Patterns**: Any repeated mistake types?

Return JSON:
{
  "masteryScore": 0-100,
  "predictedMasteryDate": "ISO date when 95% retention expected",
  "daysToMastery": number,
  "forgettingCurveType": "fast|normal|slow",
  "optimalNextReviewDays": number (personalized interval),
  "confidenceTrend": "improving|stable|declining",
  "responseTimeTrend": "faster|stable|slower",
  "riskOfForgetting": "low|medium|high",
  "recommendedAction": "advance_box|stay|demote|intensive_drill",
  "intensiveDrillNeeded": boolean,
  "drillType": "spelling|meaning|usage|pronunciation" or null,
  "insights": ["insight1", "insight2"]
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return {
      wordId,
      analysis: result,
      analyzedAt: new Date().toISOString()
    };
  }
}
```

### 3.3 VocabularyLearningPlanSkill

**Purpose**: Generate personalized learning curriculum based on goals, time, and performance.

```javascript
// src/main/skills/ai/VocabularyLearningPlanSkill.js

class VocabularyLearningPlanSkill extends BaseSkill {
  static get name() { return 'vocabulary_learning_plan'; }
  static get description() {
    return 'Generates personalized vocabulary learning curriculum with AI-optimized sequencing';
  }

  static get parameters() {
    return {
      learningGoal: {
        type: 'string',
        description: 'Target goal (e.g., "GRE prep", "business English", "TOEFL 100+")'
      },
      targetWordCount: { type: 'number', description: 'Total words to learn' },
      dailyTimeMinutes: { type: 'number', description: 'Available study time per day' },
      deadlineDate: { type: 'string', description: 'Target completion date (ISO)' },
      currentVocabulary: { type: 'array', description: 'Words already known' },
      weakCategories: { type: 'array', description: 'Word categories user struggles with' },
      readerLevel: { type: 'string' },
      preferredLearningStyle: {
        type: 'string',
        enum: ['visual', 'contextual', 'etymological', 'associative']
      }
    };
  }

  async execute(params) {
    const {
      learningGoal, targetWordCount, dailyTimeMinutes, deadlineDate,
      currentVocabulary, weakCategories, readerLevel, preferredLearningStyle
    } = params;

    const prompt = `
You are an expert vocabulary curriculum designer. Create a personalized learning plan:

**User Profile:**
- Goal: ${learningGoal}
- Target: ${targetWordCount} words
- Daily Time: ${dailyTimeMinutes} minutes
- Deadline: ${deadlineDate}
- Current Level: ${readerLevel}
- Learning Style: ${preferredLearningStyle}
- Known Words: ${currentVocabulary.length} words
- Weak Categories: ${weakCategories.join(', ') || 'None identified'}

**Design a learning plan that:**
1. Groups words by semantic relationships (word families)
2. Orders by prerequisite dependencies (learn "happy" before "unhappy")
3. Mixes difficulty levels (2 hard + 3 medium + 2 easy per session)
4. Includes spaced review days
5. Accounts for weak categories (extra practice)
6. Matches learning style preference

Return JSON:
{
  "planName": "Personalized GRE Vocabulary Sprint",
  "totalDays": number,
  "totalWords": number,
  "wordsPerDay": number,
  "reviewDaysPerWeek": number,
  "estimatedMasteryRate": "85-95%",

  "weeklyStructure": {
    "newWordsDays": [1, 2, 3, 5],
    "reviewDays": [4, 6],
    "restDay": 7
  },

  "phases": [
    {
      "phaseNumber": 1,
      "phaseName": "Foundation",
      "durationDays": 14,
      "focus": "High-frequency academic words",
      "wordCategories": ["abstract nouns", "academic verbs"],
      "dailyGoal": 8,
      "expectedMastery": "70%"
    }
  ],

  "wordGroups": [
    {
      "groupName": "Temporal Concepts",
      "theme": "Words about time and duration",
      "words": ["ephemeral", "transient", "perpetual", "intermittent"],
      "dayToIntroduce": 1,
      "learningApproach": "visual timeline + etymology",
      "reviewSchedule": [3, 7, 14]
    }
  ],

  "adaptationRules": [
    "If accuracy < 70%, reduce new words by 2/day",
    "If accuracy > 90%, increase new words by 2/day",
    "Add extra review day if 3+ words need intensive drill"
  ],

  "milestones": [
    { "day": 7, "target": "50 words at 80% recall" },
    { "day": 30, "target": "200 words at 85% recall" }
  ]
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return {
      plan: result,
      generatedAt: new Date().toISOString(),
      parameters: params
    };
  }
}
```

### 3.4 VocabularyContextualDrillSkill

**Purpose**: Generate targeted practice exercises based on user's specific weaknesses.

```javascript
// src/main/skills/ai/VocabularyContextualDrillSkill.js

class VocabularyContextualDrillSkill extends BaseSkill {
  static get name() { return 'vocabulary_contextual_drill'; }
  static get description() {
    return 'Generates targeted drill exercises based on user weakness patterns';
  }

  static get parameters() {
    return {
      word: { type: 'string', description: 'Word to practice' },
      definition: { type: 'string', description: 'Word definition' },
      weaknessType: {
        type: 'string',
        enum: ['spelling', 'meaning', 'usage', 'pronunciation', 'confusion'],
        description: 'Type of weakness to address'
      },
      confusedWith: { type: 'string', description: 'Word often confused with (if applicable)' },
      userInterests: { type: 'array', description: 'User interests for context personalization' },
      readerLevel: { type: 'string' }
    };
  }

  async execute({ word, definition, weaknessType, confusedWith, userInterests, readerLevel }) {
    const prompt = `
Generate targeted vocabulary drills for "${word}" (${definition}).

**Weakness Type:** ${weaknessType}
${confusedWith ? `**Often Confused With:** ${confusedWith}` : ''}
**User Interests:** ${userInterests.join(', ') || 'general'}
**Level:** ${readerLevel}

Generate exercises specifically designed to address the ${weaknessType} weakness:

${weaknessType === 'spelling' ? `
- Letter pattern exercises
- Common misspelling traps
- Syllable breakdown practice
` : ''}

${weaknessType === 'meaning' ? `
- Context clue sentences
- Meaning discrimination MCQs
- Synonym/antonym matching
` : ''}

${weaknessType === 'usage' ? `
- Sentence completion with word
- Correct/incorrect usage identification
- Collocations practice
` : ''}

${weaknessType === 'confusion' ? `
- Side-by-side comparison of "${word}" vs "${confusedWith}"
- Discriminating sentences
- When-to-use scenarios
` : ''}

Return JSON:
{
  "drillType": "${weaknessType}",
  "targetWord": "${word}",
  "exercises": [
    {
      "type": "fill_blank|mcq|true_false|matching|sentence_correction",
      "instruction": "Complete the sentence...",
      "content": "The _____ nature of fame...",
      "options": ["A", "B", "C", "D"] or null,
      "correctAnswer": "ephemeral",
      "explanation": "Why this is correct...",
      "difficultyLevel": 1-3
    }
  ],
  "mnemonicAid": "Memory trick for this word",
  "visualAssociation": "Image description to aid memory",
  "pronunciationTip": "How to remember pronunciation"
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return {
      word,
      weakness: weaknessType,
      drill: result,
      generatedAt: new Date().toISOString()
    };
  }
}
```

### 3.5 VocabularyPatternDetectionSkill

**Purpose**: Analyze all user's vocabulary struggles to find patterns.

```javascript
// src/main/skills/ai/VocabularyPatternDetectionSkill.js

class VocabularyPatternDetectionSkill extends BaseSkill {
  static get name() { return 'vocabulary_pattern_detection'; }
  static get description() {
    return 'Detects patterns in vocabulary learning struggles across all words';
  }

  static get parameters() {
    return {
      vocabularyStats: {
        type: 'array',
        description: 'Array of {word, partOfSpeech, category, errorCount, errorTypes, avgResponseTime}'
      },
      totalReviews: { type: 'number' },
      overallAccuracy: { type: 'number' }
    };
  }

  async execute({ vocabularyStats, totalReviews, overallAccuracy }) {
    const prompt = `
You are a learning analytics expert. Analyze this vocabulary learning data to detect patterns:

**Overall Stats:**
- Total Reviews: ${totalReviews}
- Overall Accuracy: ${overallAccuracy}%

**Word-by-Word Data:**
${JSON.stringify(vocabularyStats.slice(0, 50), null, 2)}

Identify:
1. **Category Weaknesses**: Which word types (nouns, verbs, adjectives) are hardest?
2. **Semantic Patterns**: Any meaning categories consistently difficult (abstract, temporal, etc.)?
3. **Error Type Patterns**: Common mistake types across words?
4. **Confusion Clusters**: Groups of words user confuses with each other?
5. **Learning Speed Patterns**: Fast vs slow learner for different word types?

Return JSON:
{
  "categoryWeaknesses": [
    {
      "category": "phrasal verbs",
      "accuracy": 45,
      "comparedToAverage": "-35%",
      "affectedWords": ["put up with", "get along", "turn out"],
      "recommendedAction": "Focused phrasal verb module"
    }
  ],

  "confusionClusters": [
    {
      "words": ["affect", "effect"],
      "confusionType": "spelling_meaning",
      "frequency": 12,
      "recommendation": "Side-by-side drill with usage contexts"
    }
  ],

  "errorTypeBreakdown": {
    "spelling": 25,
    "meaning": 45,
    "usage": 20,
    "pronunciation": 10
  },

  "learningSpeedByCategory": {
    "concrete_nouns": "fast",
    "abstract_nouns": "slow",
    "action_verbs": "normal",
    "phrasal_verbs": "very_slow"
  },

  "strengthAreas": ["concrete nouns", "simple adjectives"],

  "prioritizedRecommendations": [
    {
      "priority": 1,
      "issue": "Phrasal verbs 35% below average",
      "action": "Add daily 5-minute phrasal verb drill",
      "expectedImprovement": "+20% in 2 weeks"
    }
  ],

  "overallLearnerProfile": {
    "type": "visual_learner",
    "bestTimeOfDay": "morning",
    "optimalSessionLength": "15 minutes",
    "retentionStrength": "meaning over spelling"
  }
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return {
      patterns: result,
      analyzedAt: new Date().toISOString(),
      sampleSize: vocabularyStats.length
    };
  }
}
```

### 3.6 AdaptiveReviewSchedulerSkill

**Purpose**: Calculate optimal review schedule based on performance data.

```javascript
// src/main/skills/ai/AdaptiveReviewSchedulerSkill.js

class AdaptiveReviewSchedulerSkill extends BaseSkill {
  static get name() { return 'adaptive_review_scheduler'; }
  static get description() {
    return 'Calculates personalized review schedule using forgetting curve analysis';
  }

  static get parameters() {
    return {
      vocabulary: {
        type: 'array',
        description: 'Array of {id, word, box, difficulty, lastReview, performanceHistory}'
      },
      availableTimeMinutes: { type: 'number', description: 'Time available for review' },
      userPreferences: {
        type: 'object',
        description: '{ preferHard, mixDifficulty, includeNew }'
      }
    };
  }

  async execute({ vocabulary, availableTimeMinutes, userPreferences }) {
    // Calculate optimal batch based on forgetting curves
    const prompt = `
You are a spaced repetition scheduling expert. Create an optimal review session:

**Available Time:** ${availableTimeMinutes} minutes
**User Preferences:** ${JSON.stringify(userPreferences)}

**Vocabulary Pool (${vocabulary.length} words):**
${JSON.stringify(vocabulary.slice(0, 30), null, 2)}

Design the optimal review session:
1. Prioritize words at highest forgetting risk
2. Mix difficulty levels (prevents fatigue)
3. Group semantically related words
4. Include "confidence builders" (easy wins)
5. End with moderately challenging words

Return JSON:
{
  "sessionPlan": {
    "estimatedMinutes": number,
    "wordCount": number,
    "difficultyMix": { "hard": 3, "medium": 5, "easy": 2 }
  },

  "reviewOrder": [
    {
      "wordId": 123,
      "word": "ephemeral",
      "priority": 1,
      "reason": "High forgetting risk - 5 days overdue",
      "estimatedTimeSeconds": 30,
      "reviewType": "full_recall|recognition|usage"
    }
  ],

  "sessionStrategy": {
    "warmUp": ["easy word 1", "easy word 2"],
    "mainChallenge": ["hard words..."],
    "coolDown": ["confidence builder"],
    "bonusIfTime": ["new word introduction"]
  },

  "adaptationRules": [
    "If 3 consecutive errors, switch to easier words",
    "If completing fast, add 2 more words"
  ]
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return {
      schedule: result,
      generatedAt: new Date().toISOString()
    };
  }
}
```

---

## 4. Adaptive Leitner System

### 4.1 Enhanced Box Transition Logic

Replace the current hardcoded transitions with AI-informed decisions:

```javascript
// src/renderer/components/LeitnerSystem/AdaptiveLeitnerEngine.js

class AdaptiveLeitnerEngine {
  constructor(skillExecutor, contextManager) {
    this.skillExecutor = skillExecutor;
    this.contextManager = contextManager;
  }

  /**
   * Calculate next review based on individual word performance
   */
  async calculateNextReview(wordId, performanceHistory, currentBox, difficulty) {
    // Use AI for complex analysis
    const analysis = await this.skillExecutor.execute(
      'vocabulary_performance_analysis',
      { wordId, performanceHistory, currentBox, difficulty }
    );

    const baseIntervals = [1, 2, 4, 7, 14, 30]; // Base intervals per box
    const multiplier = analysis.result.forgettingCurveType === 'fast' ? 0.7 :
                       analysis.result.forgettingCurveType === 'slow' ? 1.3 : 1.0;

    const personalizedInterval = baseIntervals[currentBox] * multiplier * (1 / difficulty);

    return {
      nextReviewDays: Math.round(personalizedInterval),
      recommendedAction: analysis.result.recommendedAction,
      masteryScore: analysis.result.masteryScore,
      predictedMasteryDate: analysis.result.predictedMasteryDate
    };
  }

  /**
   * Determine box transition based on holistic analysis
   */
  async determineBoxTransition(card, wasCorrect, responseTimeMs, confidenceLevel) {
    const performanceRecord = {
      timestamp: new Date().toISOString(),
      correct: wasCorrect,
      responseTimeMs,
      confidenceLevel,
      box: card.leitnerItem.box
    };

    // Add to history
    card.performanceHistory = card.performanceHistory || [];
    card.performanceHistory.push(performanceRecord);

    // AI analysis for non-trivial decisions
    if (card.performanceHistory.length >= 3) {
      const analysis = await this.calculateNextReview(
        card.id,
        card.performanceHistory.slice(-20),
        card.leitnerItem.box,
        card.difficulty || 3
      );

      switch (analysis.recommendedAction) {
        case 'advance_box':
          return {
            newBox: Math.min(5, card.leitnerItem.box + 1),
            nextReviewDays: analysis.nextReviewDays,
            masteryScore: analysis.masteryScore
          };

        case 'stay':
          return {
            newBox: card.leitnerItem.box,
            nextReviewDays: analysis.nextReviewDays,
            masteryScore: analysis.masteryScore
          };

        case 'demote':
          return {
            newBox: Math.max(1, card.leitnerItem.box - 1),
            nextReviewDays: 1, // Review soon
            masteryScore: analysis.masteryScore
          };

        case 'intensive_drill':
          return {
            newBox: 1,
            nextReviewDays: 0, // Immediate drill
            needsDrill: true,
            drillType: analysis.drillType,
            masteryScore: analysis.masteryScore
          };
      }
    }

    // Fallback to simple logic for new words
    return this.simpleTransition(card, wasCorrect);
  }

  simpleTransition(card, wasCorrect) {
    if (wasCorrect) {
      card.leitnerItem.skips++;
      if (card.leitnerItem.skips >= 2) {
        return {
          newBox: Math.min(5, card.leitnerItem.box + 1),
          nextReviewDays: [1, 2, 4, 7, 14][card.leitnerItem.box],
          masteryScore: card.leitnerItem.box * 20
        };
      }
      return {
        newBox: card.leitnerItem.box,
        nextReviewDays: [1, 2, 4, 7, 14][card.leitnerItem.box - 1],
        masteryScore: card.leitnerItem.box * 20 - 10
      };
    } else {
      return {
        newBox: 1,
        nextReviewDays: 1,
        masteryScore: 10
      };
    }
  }
}
```

### 4.2 Enhanced FlipCard with Performance Tracking

```javascript
// Enhanced FlipCard component additions

const EnhancedFlipCard = ({ card, onReview, aiEngine }) => {
  const [startTime, setStartTime] = useState(null);
  const [confidenceLevel, setConfidenceLevel] = useState(null);

  // Track when user starts viewing
  useEffect(() => {
    setStartTime(Date.now());
  }, [card.id]);

  const handleResponse = async (isCorrect, confidence = 3) => {
    const responseTimeMs = Date.now() - startTime;

    // Get AI-informed transition
    const transition = await aiEngine.determineBoxTransition(
      card,
      isCorrect,
      responseTimeMs,
      confidence
    );

    // Show mastery feedback
    if (transition.masteryScore) {
      showMasteryFeedback(transition.masteryScore, transition.predictedMasteryDate);
    }

    // Trigger drill if needed
    if (transition.needsDrill) {
      openContextualDrill(card, transition.drillType);
    }

    onReview(card.id, transition);
  };

  return (
    <Card>
      {/* ... existing card content ... */}

      {/* Confidence selector before answering */}
      <ConfidenceSelector
        onSelect={setConfidenceLevel}
        selected={confidenceLevel}
      />

      {/* Enhanced action buttons */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          onClick={() => handleResponse(true, confidenceLevel)}
          startIcon={<CheckIcon />}
        >
          I Know This ({confidenceLevel ? `Confidence: ${confidenceLevel}` : 'Select confidence'})
        </Button>

        <Button
          onClick={() => handleResponse(false, 1)}
          color="error"
        >
          Need More Practice
        </Button>
      </Box>

      {/* Mastery indicator */}
      <MasteryIndicator
        score={card.masteryScore}
        predictedDate={card.predictedMasteryDate}
      />
    </Card>
  );
};

// Confidence selector component
const ConfidenceSelector = ({ onSelect, selected }) => (
  <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
    <Typography variant="caption">How confident are you?</Typography>
    {[1, 2, 3, 4, 5].map(level => (
      <Chip
        key={level}
        label={['😰', '🤔', '😐', '😊', '😎'][level - 1]}
        onClick={() => onSelect(level)}
        color={selected === level ? 'primary' : 'default'}
        size="small"
      />
    ))}
  </Box>
);
```

---

## 5. AI Learning Plan Generation

### 5.1 Learning Plan UI Component

```javascript
// src/renderer/views/vocabulary/LearningPlanView.js

const LearningPlanView = () => {
  const [plan, setPlan] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [setupMode, setSetupMode] = useState(true);

  const [formData, setFormData] = useState({
    learningGoal: '',
    targetWordCount: 500,
    dailyTimeMinutes: 15,
    deadlineDate: '',
    preferredStyle: 'contextual'
  });

  const generatePlan = async () => {
    setIsGenerating(true);

    const currentVocab = await customStorage.getAllVocabularyWords();
    const weakCategories = await detectWeakCategories();
    const readerLevel = await customStorage.getReaderLevel();

    const result = await skillApi.executeSkill('vocabulary_learning_plan', {
      ...formData,
      currentVocabulary: currentVocab.map(v => v.word),
      weakCategories,
      readerLevel
    });

    setPlan(result.result.plan);
    setSetupMode(false);
    setIsGenerating(false);

    // Save plan
    await customStorage.saveLearningPlan(result.result);
  };

  return (
    <Box>
      {setupMode ? (
        <LearningPlanSetup
          formData={formData}
          onChange={setFormData}
          onGenerate={generatePlan}
          isGenerating={isGenerating}
        />
      ) : (
        <LearningPlanDashboard plan={plan} />
      )}
    </Box>
  );
};

const LearningPlanSetup = ({ formData, onChange, onGenerate, isGenerating }) => (
  <Card sx={{ p: 3 }}>
    <Typography variant="h5" gutterBottom>
      🎯 Create Your AI Learning Plan
    </Typography>

    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TextField
          label="What's your learning goal?"
          placeholder="e.g., GRE Verbal 160+, Business English, TOEFL 100+"
          value={formData.learningGoal}
          onChange={e => onChange({...formData, learningGoal: e.target.value})}
          fullWidth
        />
      </Grid>

      <Grid item xs={6}>
        <TextField
          label="Target words to learn"
          type="number"
          value={formData.targetWordCount}
          onChange={e => onChange({...formData, targetWordCount: parseInt(e.target.value)})}
          fullWidth
        />
      </Grid>

      <Grid item xs={6}>
        <TextField
          label="Daily study time (minutes)"
          type="number"
          value={formData.dailyTimeMinutes}
          onChange={e => onChange({...formData, dailyTimeMinutes: parseInt(e.target.value)})}
          fullWidth
        />
      </Grid>

      <Grid item xs={6}>
        <TextField
          label="Target completion date"
          type="date"
          value={formData.deadlineDate}
          onChange={e => onChange({...formData, deadlineDate: e.target.value})}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Grid>

      <Grid item xs={6}>
        <FormControl fullWidth>
          <InputLabel>Learning Style</InputLabel>
          <Select
            value={formData.preferredStyle}
            onChange={e => onChange({...formData, preferredStyle: e.target.value})}
          >
            <MenuItem value="visual">Visual (images & diagrams)</MenuItem>
            <MenuItem value="contextual">Contextual (sentences & stories)</MenuItem>
            <MenuItem value="etymological">Etymology (word origins)</MenuItem>
            <MenuItem value="associative">Associations (memory palace)</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12}>
        <Button
          variant="contained"
          size="large"
          onClick={onGenerate}
          disabled={isGenerating || !formData.learningGoal}
          startIcon={isGenerating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
          fullWidth
        >
          {isGenerating ? 'AI is creating your plan...' : 'Generate AI Learning Plan'}
        </Button>
      </Grid>
    </Grid>
  </Card>
);

const LearningPlanDashboard = ({ plan }) => (
  <Box>
    {/* Plan overview */}
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6">{plan.planName}</Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={3}>
            <Stat label="Total Days" value={plan.totalDays} />
          </Grid>
          <Grid item xs={3}>
            <Stat label="Total Words" value={plan.totalWords} />
          </Grid>
          <Grid item xs={3}>
            <Stat label="Daily Goal" value={`${plan.wordsPerDay} words`} />
          </Grid>
          <Grid item xs={3}>
            <Stat label="Expected Mastery" value={plan.estimatedMasteryRate} />
          </Grid>
        </Grid>
      </CardContent>
    </Card>

    {/* Phase breakdown */}
    <Typography variant="h6" sx={{ mb: 1 }}>Learning Phases</Typography>
    {plan.phases.map((phase, idx) => (
      <PhaseCard key={idx} phase={phase} />
    ))}

    {/* Today's focus */}
    <TodaysFocusCard plan={plan} />

    {/* Upcoming milestones */}
    <MilestonesCard milestones={plan.milestones} />
  </Box>
);
```

---

## 6. Progress Management & Prediction

### 6.1 Progress Dashboard Component

```javascript
// src/renderer/views/vocabulary/ProgressDashboard.js

const ProgressDashboard = () => {
  const [insights, setInsights] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [predictions, setPredictions] = useState(null);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    // Get vocabulary stats
    const vocabStats = await customStorage.getVocabularyWithStats();

    // AI pattern detection
    const patternResult = await skillApi.executeSkill('vocabulary_pattern_detection', {
      vocabularyStats: vocabStats,
      totalReviews: vocabStats.reduce((sum, v) => sum + v.reviewCount, 0),
      overallAccuracy: calculateOverallAccuracy(vocabStats)
    });

    setPatterns(patternResult.result.patterns);
    setPredictions(generatePredictions(vocabStats, patternResult.result.patterns));
  };

  return (
    <Box>
      {/* AI Insights Banner */}
      <AIInsightsBanner patterns={patterns} />

      {/* Mastery Prediction */}
      <MasteryPredictionCard predictions={predictions} />

      {/* Weakness Analysis */}
      <WeaknessAnalysisCard patterns={patterns} />

      {/* Learning Velocity Chart */}
      <LearningVelocityChart />

      {/* Confusion Clusters */}
      <ConfusionClustersCard clusters={patterns?.confusionClusters} />
    </Box>
  );
};

const AIInsightsBanner = ({ patterns }) => {
  if (!patterns) return null;

  const topInsight = patterns.prioritizedRecommendations?.[0];

  return (
    <Paper sx={{
      p: 2,
      mb: 2,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon />
        <Typography variant="subtitle1" fontWeight="bold">
          AI Insight
        </Typography>
      </Box>
      <Typography variant="body1" sx={{ mt: 1 }}>
        {topInsight?.issue}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
        Recommendation: {topInsight?.action}
      </Typography>
      <Chip
        label={`Expected: ${topInsight?.expectedImprovement}`}
        size="small"
        sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
      />
    </Paper>
  );
};

const MasteryPredictionCard = ({ predictions }) => (
  <Card sx={{ mb: 2 }}>
    <CardContent>
      <Typography variant="h6">📈 Mastery Prediction</Typography>

      <Box sx={{ mt: 2 }}>
        <LinearProgress
          variant="determinate"
          value={predictions?.currentMastery || 0}
          sx={{ height: 20, borderRadius: 2 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption">
            Current: {predictions?.currentMastery}%
          </Typography>
          <Typography variant="caption">
            Target: 95% by {predictions?.targetDate}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={4}>
          <Box textAlign="center">
            <Typography variant="h4" color="primary">
              {predictions?.daysToTarget}
            </Typography>
            <Typography variant="caption">Days to Goal</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box textAlign="center">
            <Typography variant="h4" color="success.main">
              {predictions?.wordsOnTrack}
            </Typography>
            <Typography variant="caption">Words on Track</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box textAlign="center">
            <Typography variant="h4" color="warning.main">
              {predictions?.wordsAtRisk}
            </Typography>
            <Typography variant="caption">Need Attention</Typography>
          </Box>
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

const WeaknessAnalysisCard = ({ patterns }) => (
  <Card sx={{ mb: 2 }}>
    <CardContent>
      <Typography variant="h6">⚠️ Areas Needing Focus</Typography>

      {patterns?.categoryWeaknesses?.map((weakness, idx) => (
        <Box key={idx} sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">{weakness.category}</Typography>
            <Chip
              label={`${weakness.accuracy}% accuracy`}
              color={weakness.accuracy < 50 ? 'error' : 'warning'}
              size="small"
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {weakness.comparedToAverage} vs your average
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            {weakness.affectedWords.map((word, i) => (
              <Chip key={i} label={word} size="small" variant="outlined" />
            ))}
          </Box>
          <Button
            size="small"
            startIcon={<AutoAwesomeIcon />}
            sx={{ mt: 1 }}
          >
            Start AI Drill for {weakness.category}
          </Button>
        </Box>
      ))}
    </CardContent>
  </Card>
);
```

---

## 7. Knowledge Graph Integration

### 7.1 Vocabulary-Neo4j Sync

```javascript
// src/main/utils/VocabularyGraphSync.js

class VocabularyGraphSync {
  constructor(neo4jAdapter, aiProvider) {
    this.neo4j = neo4jAdapter;
    this.aiProvider = aiProvider;
  }

  /**
   * Sync vocabulary to Neo4j as Concept nodes with relationships
   */
  async syncVocabularyToGraph(vocabulary, userId) {
    const session = this.neo4j.driver.session();

    try {
      // Create vocabulary node
      await session.run(`
        MERGE (v:Vocabulary {id: $vocabId})
        SET v.word = $word,
            v.definition = $definition,
            v.partOfSpeech = $partOfSpeech,
            v.difficulty = $difficulty,
            v.masteryScore = $masteryScore,
            v.userId = $userId,
            v.updatedAt = datetime()
      `, {
        vocabId: vocabulary.id,
        word: vocabulary.word,
        definition: vocabulary.definition,
        partOfSpeech: vocabulary.partOfSpeech || 'unknown',
        difficulty: vocabulary.difficulty || 3,
        masteryScore: vocabulary.masteryScore || 0,
        userId
      });

      // AI-generate relationships
      const relationships = await this.generateWordRelationships(vocabulary);

      for (const rel of relationships) {
        await session.run(`
          MATCH (v:Vocabulary {id: $vocabId})
          MERGE (related:Vocabulary {word: $relatedWord})
          MERGE (v)-[:${rel.type} {strength: $strength}]->(related)
        `, {
          vocabId: vocabulary.id,
          relatedWord: rel.word,
          strength: rel.strength
        });
      }

      // Link to concept if word appears in notes
      await this.linkToRelatedConcepts(vocabulary, userId, session);

    } finally {
      await session.close();
    }
  }

  /**
   * AI generates word relationships (synonyms, antonyms, word family)
   */
  async generateWordRelationships(vocabulary) {
    const prompt = `
For the word "${vocabulary.word}" (${vocabulary.definition}), identify:
1. Synonyms (similar meaning)
2. Antonyms (opposite meaning)
3. Word family (same root)
4. Collocations (commonly used together)
5. Semantic neighbors (related concepts)

Return JSON:
{
  "relationships": [
    { "word": "related_word", "type": "SYNONYM|ANTONYM|WORD_FAMILY|COLLOCATION|SEMANTIC_NEIGHBOR", "strength": 0.1-1.0 }
  ]
}`;

    const result = await this.aiProvider.generateContentWithJson(prompt, true);
    return result.relationships || [];
  }

  /**
   * Find concepts in Neo4j that relate to this vocabulary
   */
  async linkToRelatedConcepts(vocabulary, userId, session) {
    // Search for concepts containing this word
    const result = await session.run(`
      MATCH (c:Concept)
      WHERE c.userId = $userId
        AND (c.name CONTAINS $word OR c.description CONTAINS $word)
      RETURN c.id as conceptId, c.name as conceptName
      LIMIT 10
    `, { userId, word: vocabulary.word });

    for (const record of result.records) {
      await session.run(`
        MATCH (v:Vocabulary {id: $vocabId})
        MATCH (c:Concept {id: $conceptId})
        MERGE (v)-[:APPEARS_IN]->(c)
      `, {
        vocabId: vocabulary.id,
        conceptId: record.get('conceptId')
      });
    }
  }

  /**
   * Get vocabulary learning path based on prerequisites
   */
  async getVocabularyLearningPath(targetWord, userId) {
    const session = this.neo4j.driver.session();

    try {
      const result = await session.run(`
        MATCH path = (start:Vocabulary)-[:PREREQUISITE*0..3]->(target:Vocabulary {word: $targetWord})
        WHERE start.userId = $userId
        RETURN nodes(path) as words, length(path) as depth
        ORDER BY depth DESC
        LIMIT 1
      `, { targetWord, userId });

      if (result.records.length === 0) return null;

      const words = result.records[0].get('words');
      return words.map(w => ({
        word: w.properties.word,
        definition: w.properties.definition,
        mastery: w.properties.masteryScore
      }));

    } finally {
      await session.close();
    }
  }

  /**
   * Detect vocabulary clusters for group learning
   */
  async getVocabularyClusters(userId, clusterSize = 5) {
    const session = this.neo4j.driver.session();

    try {
      const result = await session.run(`
        MATCH (v:Vocabulary {userId: $userId})
        WHERE v.masteryScore < 80
        WITH v
        MATCH (v)-[:SYNONYM|WORD_FAMILY|SEMANTIC_NEIGHBOR]-(related:Vocabulary)
        WHERE related.userId = $userId
        WITH v, collect(DISTINCT related) as cluster
        WHERE size(cluster) >= 2
        RETURN v.word as centerWord,
               [w in cluster | w.word][0..$clusterSize] as clusterWords,
               avg([w in cluster | w.difficulty]) as avgDifficulty
        ORDER BY avgDifficulty
        LIMIT 10
      `, { userId, clusterSize });

      return result.records.map(r => ({
        centerWord: r.get('centerWord'),
        clusterWords: r.get('clusterWords'),
        avgDifficulty: r.get('avgDifficulty')
      }));

    } finally {
      await session.close();
    }
  }
}
```

---

## 8. Creative Learning Features

### 8.1 Vocabulary Story Generator

AI creates mini-stories using words the user is learning, making vocabulary memorable through narrative.

```javascript
// src/main/skills/ai/VocabularyStorySkill.js

class VocabularyStorySkill extends BaseSkill {
  static get name() { return 'vocabulary_story_generator'; }
  static get description() {
    return 'Creates memorable mini-stories incorporating vocabulary words for contextual learning';
  }

  static get parameters() {
    return {
      words: { type: 'array', description: 'Words to incorporate (3-7 words)' },
      storyType: {
        type: 'string',
        enum: ['adventure', 'mystery', 'sci-fi', 'historical', 'everyday'],
        description: 'Genre of story'
      },
      userInterests: { type: 'array', description: 'User interests for personalization' },
      length: { type: 'string', enum: ['short', 'medium'], default: 'short' }
    };
  }

  async execute({ words, storyType, userInterests, length }) {
    const prompt = `
Create a memorable ${length} ${storyType} story that naturally incorporates these vocabulary words:
${words.map(w => `- ${w.word}: ${w.definition}`).join('\n')}

Requirements:
1. Each word appears in a memorable, context-rich sentence
2. Story is engaging and relates to: ${userInterests.join(', ')}
3. Words appear in BOLD when used
4. Include subtle memory hooks (alliteration, emotion, imagery)
5. End with a twist or memorable conclusion

Return JSON:
{
  "title": "Story Title",
  "story": "The story text with **bold** vocabulary words...",
  "wordContexts": [
    {
      "word": "ephemeral",
      "sentence": "The exact sentence where it appears",
      "memoryHook": "Why this context is memorable"
    }
  ],
  "comprehensionQuestion": "A question to verify understanding"
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);
    return result;
  }
}
```

### 8.2 Vocabulary Battle Mode

Gamified competitive learning between user and AI (or other users).

```javascript
// src/renderer/views/vocabulary/VocabularyBattle.js

const VocabularyBattle = () => {
  const [battleState, setBattleState] = useState({
    round: 1,
    userScore: 0,
    aiScore: 0,
    currentWord: null,
    timeRemaining: 10,
    mode: 'definition' // definition, usage, spelling
  });

  const startBattle = async (difficulty) => {
    const words = await getWordsForBattle(difficulty, 10);
    setBattleState(prev => ({
      ...prev,
      words,
      currentWord: words[0],
      round: 1
    }));
    startTimer();
  };

  const handleAnswer = async (answer) => {
    const isCorrect = checkAnswer(answer, battleState.currentWord, battleState.mode);

    if (isCorrect) {
      // User gets points based on speed
      const points = Math.ceil(battleState.timeRemaining * 10);
      setBattleState(prev => ({
        ...prev,
        userScore: prev.userScore + points
      }));
    } else {
      // AI "answers correctly"
      setBattleState(prev => ({
        ...prev,
        aiScore: prev.aiScore + 50
      }));
    }

    nextRound();
  };

  return (
    <Box sx={{ textAlign: 'center', p: 3 }}>
      {/* Battle header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <PlayerScore name="You" score={battleState.userScore} avatar="👤" />
        <Typography variant="h4">VS</Typography>
        <PlayerScore name="AI Tutor" score={battleState.aiScore} avatar="🤖" />
      </Box>

      {/* Timer */}
      <CircularProgress
        variant="determinate"
        value={(battleState.timeRemaining / 10) * 100}
        size={80}
      />

      {/* Current challenge */}
      <Card sx={{ mt: 3, p: 3 }}>
        <Typography variant="h5">
          {battleState.mode === 'definition' && 'What does this word mean?'}
          {battleState.mode === 'usage' && 'Complete the sentence:'}
          {battleState.mode === 'spelling' && 'Spell this word:'}
        </Typography>

        <Typography variant="h3" sx={{ my: 3, color: 'primary.main' }}>
          {battleState.currentWord?.word}
        </Typography>

        {/* Multiple choice options */}
        <Grid container spacing={2}>
          {battleState.currentWord?.options.map((option, idx) => (
            <Grid item xs={6} key={idx}>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                onClick={() => handleAnswer(option)}
              >
                {option}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Card>

      {/* Power-ups */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
        <PowerUp icon="⏱️" name="Extra Time" onClick={() => addTime(5)} />
        <PowerUp icon="❌" name="Eliminate 2" onClick={() => eliminate2()} />
        <PowerUp icon="💡" name="Hint" onClick={() => showHint()} />
      </Box>
    </Box>
  );
};
```

### 8.3 Vocabulary Mind Palace

Visual-spatial learning using virtual "rooms" for vocabulary categories.

```javascript
// src/renderer/views/vocabulary/MindPalace.js

const MindPalace = () => {
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);

  useEffect(() => {
    generatePalaceRooms();
  }, []);

  const generatePalaceRooms = async () => {
    // AI generates room themes based on vocabulary categories
    const categories = await getVocabularyCategories();

    const roomsResult = await skillApi.executeSkill('mind_palace_generator', {
      categories,
      userPreferences: await getUserPreferences()
    });

    setRooms(roomsResult.result.rooms);
  };

  return (
    <Box sx={{ height: '100vh', position: 'relative' }}>
      {/* 3D-like palace visualization */}
      <PalaceVisualization
        rooms={rooms}
        currentRoom={currentRoom}
        onRoomClick={setCurrentRoom}
      />

      {/* Room detail panel */}
      {currentRoom && (
        <RoomPanel room={currentRoom}>
          <Typography variant="h5">{currentRoom.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {currentRoom.description}
          </Typography>

          {/* Words placed in room with visual anchors */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
            {currentRoom.words.map((wordPlacement, idx) => (
              <WordPlacement
                key={idx}
                word={wordPlacement.word}
                anchor={wordPlacement.anchor}
                memoryHook={wordPlacement.memoryHook}
              />
            ))}
          </Box>

          {/* Room quiz */}
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            onClick={() => startRoomQuiz(currentRoom)}
          >
            Test This Room
          </Button>
        </RoomPanel>
      )}
    </Box>
  );
};

// AI generates room placements
const MindPalaceGeneratorSkill = {
  generateRoomPlacements: async (category, words) => {
    const prompt = `
Create a mind palace room for "${category}" vocabulary:

Words to place: ${words.map(w => w.word).join(', ')}

Design a memorable room with:
1. Room theme related to "${category}"
2. Visual anchor points (objects) for each word
3. Memory hooks connecting word meaning to visual

Return JSON:
{
  "roomName": "The Library of Time",
  "roomDescription": "A Victorian library with grandfather clocks...",
  "atmosphere": "warm candlelight, ticking sounds",
  "placements": [
    {
      "word": "ephemeral",
      "anchor": "melting ice sculpture of a butterfly",
      "position": "center of room",
      "memoryHook": "The butterfly melts quickly, lasting only a moment - ephemeral",
      "visualDescription": "Crystal butterfly slowly dripping"
    }
  ]
}`;

    return await aiProvider.generateContentWithJson(prompt, true);
  }
};
```

### 8.4 Vocabulary Conversation Practice

AI engages user in natural conversations that require using vocabulary words.

```javascript
// src/main/skills/ai/VocabularyConversationSkill.js

class VocabularyConversationSkill extends BaseSkill {
  static get name() { return 'vocabulary_conversation'; }
  static get description() {
    return 'Engages user in natural conversation requiring vocabulary usage';
  }

  static get parameters() {
    return {
      targetWords: { type: 'array', description: 'Words user should try to use' },
      conversationHistory: { type: 'array', description: 'Previous exchanges' },
      scenario: { type: 'string', description: 'Conversation scenario' },
      userMessage: { type: 'string', description: 'User latest message' }
    };
  }

  async execute({ targetWords, conversationHistory, scenario, userMessage }) {
    const usedWords = detectUsedWords(userMessage, targetWords);
    const remainingWords = targetWords.filter(w => !usedWords.includes(w));

    const prompt = `
You are a conversation partner helping a learner practice vocabulary.

Scenario: ${scenario}
Target words to elicit: ${remainingWords.map(w => `${w.word} (${w.definition})`).join(', ')}
Words already used: ${usedWords.join(', ')}

Conversation so far:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

User's latest message: "${userMessage}"

Respond naturally while:
1. Acknowledging any vocabulary words they used correctly
2. Gently steering conversation toward opportunities to use remaining words
3. If they misuse a word, politely correct them
4. Keep the conversation engaging and natural

Return JSON:
{
  "response": "Your conversational response...",
  "wordsUsedCorrectly": ["word1"],
  "wordsMisused": [{ "word": "...", "correction": "..." }],
  "opportunityHint": "Subtle hint toward using a remaining word",
  "encouragement": "Positive feedback on their progress",
  "suggestionForNext": "How they might use [word] in their next response"
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return {
      ...result,
      wordsRemaining: remainingWords.length,
      conversationProgress: (targetWords.length - remainingWords.length) / targetWords.length
    };
  }
}
```

### 8.5 Reading-Integrated Vocabulary Discovery

While reading, AI proactively identifies words the user should learn.

```javascript
// src/renderer/hooks/useReadingVocabularyDiscovery.js

const useReadingVocabularyDiscovery = (bookContent, userLevel, existingVocab) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzePassage = useCallback(async (passage) => {
    setIsAnalyzing(true);

    const result = await skillApi.executeSkill('reading_vocabulary_discovery', {
      passage,
      userLevel,
      existingVocabulary: existingVocab.map(v => v.word),
      maxSuggestions: 5
    });

    setSuggestions(result.result.suggestions);
    setIsAnalyzing(false);
  }, [userLevel, existingVocab]);

  return { suggestions, analyzePassage, isAnalyzing };
};

// Skill for proactive vocabulary discovery
class ReadingVocabularyDiscoverySkill extends BaseSkill {
  static get name() { return 'reading_vocabulary_discovery'; }

  async execute({ passage, userLevel, existingVocabulary, maxSuggestions }) {
    const prompt = `
Analyze this passage for vocabulary learning opportunities for a ${userLevel}-level reader:

"${passage}"

They already know: ${existingVocabulary.slice(0, 100).join(', ')}

Identify ${maxSuggestions} words they should learn that:
1. Are important for understanding this passage
2. Are appropriate for their level
3. They likely don't know yet
4. Have high utility (will see again)

Return JSON:
{
  "suggestions": [
    {
      "word": "...",
      "contextInPassage": "the exact sentence from passage",
      "whyImportant": "Why learn this word",
      "difficulty": 1-5,
      "frequencyRank": "top 1000|top 5000|academic|advanced",
      "quickDefinition": "brief meaning"
    }
  ],
  "passageTheme": "Main topic of the passage",
  "readabilityNote": "Is this passage appropriate for their level?"
}`;

    return await this.context.aiProvider.generateContentWithJson(prompt, true);
  }
}
```

---

## 9. Database Schema Extensions

### 9.1 New Tables for AI-Powered Learning

```sql
-- Extended vocabulary performance tracking
ALTER TABLE vocabulary ADD COLUMN difficulty_rating INTEGER DEFAULT 3;
ALTER TABLE vocabulary ADD COLUMN ai_difficulty_assessment TEXT; -- JSON
ALTER TABLE vocabulary ADD COLUMN part_of_speech TEXT;
ALTER TABLE vocabulary ADD COLUMN mastery_score INTEGER DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN predicted_mastery_date TEXT;

-- New: Performance history table
CREATE TABLE vocabulary_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocabulary_id INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL,
  was_correct INTEGER NOT NULL,
  response_time_ms INTEGER,
  confidence_level INTEGER, -- 1-5
  mistake_type TEXT, -- 'spelling', 'meaning', 'usage', 'none'
  box_before INTEGER,
  box_after INTEGER,
  FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id)
);

-- New: Learning plans
CREATE TABLE learning_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_name TEXT NOT NULL,
  plan_data TEXT NOT NULL, -- JSON
  learning_goal TEXT,
  target_word_count INTEGER,
  daily_time_minutes INTEGER,
  deadline_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  status TEXT DEFAULT 'active' -- 'active', 'completed', 'paused'
);

-- New: Learning plan progress
CREATE TABLE learning_plan_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  words_learned INTEGER DEFAULT 0,
  words_reviewed INTEGER DEFAULT 0,
  accuracy_rate REAL,
  time_spent_minutes INTEGER,
  ai_insights TEXT, -- JSON
  FOREIGN KEY (plan_id) REFERENCES learning_plan(id)
);

-- New: AI-generated drills
CREATE TABLE vocabulary_drill (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vocabulary_id INTEGER NOT NULL,
  drill_type TEXT NOT NULL, -- 'spelling', 'meaning', 'usage', 'confusion'
  drill_content TEXT NOT NULL, -- JSON
  generated_at TEXT NOT NULL,
  completed_at TEXT,
  score INTEGER,
  FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id)
);

-- New: Pattern analysis cache
CREATE TABLE vocabulary_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pattern_type TEXT NOT NULL, -- 'weakness', 'confusion', 'strength'
  pattern_data TEXT NOT NULL, -- JSON
  analyzed_at TEXT NOT NULL,
  expires_at TEXT -- Patterns should be re-analyzed periodically
);

-- Neo4j sync tracking
CREATE TABLE vocabulary_graph_sync (
  vocabulary_id INTEGER PRIMARY KEY,
  synced_at TEXT,
  graph_node_id TEXT,
  relationships_count INTEGER
);
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Extend database schema with new tables
- [ ] Implement `VocabularyDifficultyAssessmentSkill`
- [ ] Add performance tracking to FlipCard
- [ ] Create basic performance history storage

### Phase 2: Adaptive Engine (Week 3-4)
- [ ] Implement `VocabularyPerformanceAnalysisSkill`
- [ ] Build `AdaptiveLeitnerEngine`
- [ ] Replace hardcoded intervals with AI-calculated ones
- [ ] Add mastery prediction display

### Phase 3: Learning Plans (Week 5-6)
- [ ] Implement `VocabularyLearningPlanSkill`
- [ ] Build Learning Plan UI
- [ ] Add plan progress tracking
- [ ] Integrate plan with daily reviews

### Phase 4: Pattern Detection (Week 7-8)
- [ ] Implement `VocabularyPatternDetectionSkill`
- [ ] Build Progress Dashboard
- [ ] Add weakness visualization
- [ ] Create confusion cluster detection

### Phase 5: Neo4j Integration (Week 9-10)
- [ ] Implement `VocabularyGraphSync`
- [ ] Add vocabulary → concept linking
- [ ] Build vocabulary relationship graph UI
- [ ] Enable graph-based learning paths

### Phase 6: Creative Features (Week 11-12)
- [ ] Implement Story Generator
- [ ] Build Conversation Practice
- [ ] Add Reading-Integrated Discovery
- [ ] Create Mind Palace (optional)

### Phase 7: Polish & Optimization (Week 13-14)
- [ ] Performance optimization
- [ ] UI/UX refinement
- [ ] User testing
- [ ] Documentation

---

## Summary

This design transforms SmartReader's vocabulary learning from a static, one-size-fits-all system into an AI-powered, personalized learning experience. Key innovations:

1. **AI Difficulty Assessment** - Words get personalized difficulty ratings
2. **Adaptive Spacing** - Review intervals based on individual performance curves
3. **Learning Plan Generation** - AI creates personalized curriculum
4. **Progress Prediction** - "You'll master this in 30 days"
5. **Pattern Detection** - "You struggle with phrasal verbs"
6. **Neo4j Integration** - Words connected in knowledge graph
7. **Creative Learning** - Stories, conversations, mind palace

The architecture leverages existing systems (skill framework, AI providers, Neo4j) while adding targeted enhancements for vocabulary-specific intelligence.
