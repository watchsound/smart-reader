# AI Learning Companion Framework

## Executive Summary

This document defines a **generic AI-powered learning management framework** that transforms SmartReader from a reading app with learning features into an **intelligent learning companion platform**. The framework supports any learning goal - vocabulary, programming, exam preparation, book comprehension, skill acquisition - through a unified architecture with domain-specific specializations.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Domain Type System](#2-domain-type-system)
3. [Learner Profile Architecture](#3-learner-profile-architecture)
4. [Learning Plan Skills](#4-learning-plan-skills)
5. [Content Generation Skills](#5-content-generation-skills)
6. [Knowledge Graph Structure](#6-knowledge-graph-structure)
7. [Notification System](#7-notification-system)
8. [Database Schema](#8-database-schema)
9. [Skill Implementations](#9-skill-implementations)
10. [UI Components](#10-ui-components)
11. [Integration Points](#11-integration-points)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Core Concepts

### 1.1 The AI Learning Companion Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│    USER: "I want to learn calculus for my engineering exam"             │
│                                                                          │
│                              │                                           │
│                              ▼                                           │
│    ┌──────────────────────────────────────────────────────────────┐     │
│    │                   AI LEARNING COMPANION                       │     │
│    │                                                               │     │
│    │  1. UNDERSTAND: What domain? → Math                          │     │
│    │  2. PROFILE: Check learner's math background                 │     │
│    │  3. PLAN: Create personalized learning plan                  │     │
│    │  4. TEACH: Generate appropriate materials                    │     │
│    │  5. ASSESS: Quiz and track progress                          │     │
│    │  6. ADAPT: Modify plan based on performance                  │     │
│    │  7. REMIND: Proactive notifications                          │     │
│    │                                                               │     │
│    └──────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              ▼                                           │
│    RESULT: Structured learning journey with AI guidance                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Entities

| Entity | Description |
|--------|-------------|
| **Domain Type** | Predefined template (vocabulary, math, language, knowledge, skill) with specialized learning logic |
| **Learning Topic** | User-created instance: "GRE Vocabulary", "Python Programming", "The Art of War (book)" |
| **Learner Profile** | Persistent user profile with global patterns + per-domain mastery |
| **Learning Plan** | AI-generated curriculum for a topic with milestones and daily goals |
| **Learning Session** | Single learning interaction (review, quiz, reading, practice) |
| **Notification** | Proactive AI message (reminder, suggestion, milestone, alert) |

### 1.3 Design Principles

1. **Skill-Centric**: All intelligence lives in skills, not static data
2. **Domain-Specialized**: Each domain type has optimized learning strategies
3. **Profile-Driven**: All decisions informed by learner profile
4. **Proactive**: AI initiates engagement, not just responds
5. **Adaptive**: Plans evolve based on performance
6. **Graph-Connected**: Knowledge relationships power learning paths

---

## 2. Domain Type System

### 2.1 Domain Type Definitions

```typescript
// src/commons/model/LearningDomains.ts

export enum DomainType {
  VOCABULARY = 'vocabulary',
  MATH = 'math',
  LANGUAGE = 'language',
  KNOWLEDGE = 'knowledge',
  SKILL = 'skill'
}

export interface DomainTypeConfig {
  type: DomainType;
  name: string;
  description: string;

  // Learning mechanics
  usesSpacedRepetition: boolean;
  usesProgressiveDifficulty: boolean;
  usesPracticeProblems: boolean;
  usesConceptGraph: boolean;

  // Content types supported
  contentTypes: ContentType[];

  // Assessment methods
  assessmentMethods: AssessmentMethod[];

  // Mastery criteria
  masteryCriteria: MasteryCriteria;

  // Graph node types for this domain
  graphNodeTypes: string[];
  graphEdgeTypes: string[];
}

export const DOMAIN_CONFIGS: Record<DomainType, DomainTypeConfig> = {

  [DomainType.VOCABULARY]: {
    type: DomainType.VOCABULARY,
    name: 'Vocabulary',
    description: 'Word learning with definitions, usage, and spaced repetition',

    usesSpacedRepetition: true,
    usesProgressiveDifficulty: true,
    usesPracticeProblems: false,
    usesConceptGraph: true,

    contentTypes: ['definition', 'example_sentence', 'etymology', 'synonym', 'antonym', 'usage_context'],
    assessmentMethods: ['flashcard_recall', 'multiple_choice', 'fill_blank', 'usage_sentence'],

    masteryCriteria: {
      minCorrectStreak: 5,
      minRetentionDays: 14,
      requiredAssessmentTypes: ['recall', 'usage']
    },

    graphNodeTypes: ['Word', 'WordFamily', 'Concept'],
    graphEdgeTypes: ['SYNONYM', 'ANTONYM', 'DERIVED_FROM', 'RELATED_TO', 'USED_IN_CONTEXT']
  },

  [DomainType.MATH]: {
    type: DomainType.MATH,
    name: 'Mathematics',
    description: 'Mathematical concepts, formulas, and problem-solving',

    usesSpacedRepetition: true,
    usesProgressiveDifficulty: true,
    usesPracticeProblems: true,
    usesConceptGraph: true,

    contentTypes: ['concept_explanation', 'formula', 'worked_example', 'practice_problem', 'visual_diagram'],
    assessmentMethods: ['problem_solving', 'concept_application', 'proof_completion', 'multiple_choice'],

    masteryCriteria: {
      minCorrectStreak: 3,
      minDifficultyLevel: 4,
      requiredAssessmentTypes: ['problem_solving', 'application']
    },

    graphNodeTypes: ['Concept', 'Formula', 'Theorem', 'Technique'],
    graphEdgeTypes: ['PREREQUISITE', 'APPLIES_TO', 'DERIVED_FROM', 'RELATED_TO']
  },

  [DomainType.LANGUAGE]: {
    type: DomainType.LANGUAGE,
    name: 'Language Learning',
    description: 'Comprehensive language skills: grammar, reading, writing, listening',

    usesSpacedRepetition: true,
    usesProgressiveDifficulty: true,
    usesPracticeProblems: true,
    usesConceptGraph: true,

    contentTypes: ['grammar_rule', 'reading_passage', 'writing_prompt', 'dialogue', 'vocabulary_in_context'],
    assessmentMethods: ['grammar_correction', 'reading_comprehension', 'writing_exercise', 'translation'],

    masteryCriteria: {
      minCorrectStreak: 5,
      requiredSkillAreas: ['reading', 'writing', 'grammar'],
      minProficiencyLevel: 'intermediate'
    },

    graphNodeTypes: ['GrammarRule', 'Vocabulary', 'Phrase', 'Structure'],
    graphEdgeTypes: ['REQUIRES', 'SIMILAR_TO', 'CONTRASTS_WITH', 'USED_IN']
  },

  [DomainType.KNOWLEDGE]: {
    type: DomainType.KNOWLEDGE,
    name: 'Knowledge Acquisition',
    description: 'Learning facts, concepts, and their relationships (books, subjects, topics)',

    usesSpacedRepetition: true,
    usesProgressiveDifficulty: false,
    usesPracticeProblems: false,
    usesConceptGraph: true,

    contentTypes: ['concept', 'fact', 'relationship', 'summary', 'quote', 'example'],
    assessmentMethods: ['concept_recall', 'relationship_identification', 'application_scenario', 'essay'],

    masteryCriteria: {
      minConceptsCovered: 0.8,
      minRelationshipsUnderstood: 0.7,
      requiredDepth: 'understanding'
    },

    graphNodeTypes: ['Concept', 'Entity', 'Event', 'Principle', 'Theory'],
    graphEdgeTypes: ['CAUSES', 'LEADS_TO', 'PART_OF', 'EXAMPLE_OF', 'CONTRASTS_WITH', 'RELATED_TO']
  },

  [DomainType.SKILL]: {
    type: DomainType.SKILL,
    name: 'Skill Development',
    description: 'Procedural learning: programming, design, crafts, techniques',

    usesSpacedRepetition: false,
    usesProgressiveDifficulty: true,
    usesPracticeProblems: true,
    usesConceptGraph: true,

    contentTypes: ['tutorial', 'exercise', 'project', 'code_example', 'best_practice', 'common_mistake'],
    assessmentMethods: ['hands_on_exercise', 'project_completion', 'code_review', 'problem_solving'],

    masteryCriteria: {
      minProjectsCompleted: 3,
      minDifficultyLevel: 3,
      requiredCompetencies: ['basic', 'intermediate', 'application']
    },

    graphNodeTypes: ['Skill', 'Technique', 'Tool', 'Pattern', 'BestPractice'],
    graphEdgeTypes: ['PREREQUISITE', 'ENABLES', 'USED_WITH', 'ALTERNATIVE_TO']
  }
};
```

### 2.2 Domain Detection

AI automatically detects domain type from user's learning goal:

```javascript
// src/main/skills/learning/DomainDetectionSkill.js

class DomainDetectionSkill extends BaseSkill {
  static get name() { return 'domain_detection'; }
  static get description() {
    return 'Detects the appropriate domain type for a learning goal';
  }

  static get parameters() {
    return {
      learningGoal: { type: 'string', description: 'User stated learning goal' },
      context: { type: 'object', description: 'Additional context (book, URL, etc.)' }
    };
  }

  async execute({ learningGoal, context }) {
    const prompt = `
Analyze this learning goal and determine the best domain type:

Learning Goal: "${learningGoal}"
${context?.bookTitle ? `Related Book: "${context.bookTitle}"` : ''}
${context?.sourceType ? `Source Type: ${context.sourceType}` : ''}

Available Domain Types:
1. vocabulary - Word learning (GRE words, TOEFL vocabulary, technical terms)
2. math - Mathematical concepts, formulas, problem-solving (calculus, statistics, algebra)
3. language - Full language learning (grammar, reading, writing for a language)
4. knowledge - Factual/conceptual learning (history, science concepts, book comprehension)
5. skill - Procedural/practical skills (programming, design, techniques)

Return JSON:
{
  "detectedDomain": "vocabulary|math|language|knowledge|skill",
  "confidence": 0.0-1.0,
  "reasoning": "Why this domain fits",
  "suggestedTopicName": "A good name for this learning topic",
  "initialAssessmentNeeded": true|false,
  "estimatedScope": "small|medium|large",
  "prerequisites": ["any detected prerequisites"]
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return {
      ...result,
      domainConfig: DOMAIN_CONFIGS[result.detectedDomain]
    };
  }
}
```

### 2.3 Learning Topic Model

```typescript
// src/commons/model/LearningTopic.ts

export interface LearningTopic {
  id: string;
  userId: number;

  // Basic info
  name: string;                    // "GRE Vocabulary", "Python Programming"
  description: string;
  domainType: DomainType;

  // Source (optional)
  sourceType?: 'book' | 'url' | 'manual' | 'imported';
  sourceId?: string;               // Book ID, URL, etc.

  // Learning configuration
  targetDate?: string;             // Deadline if any
  dailyTimeMinutes?: number;       // Committed daily time
  difficulty?: 'beginner' | 'intermediate' | 'advanced';

  // Status
  status: 'planning' | 'active' | 'paused' | 'completed' | 'abandoned';
  createdAt: string;
  updatedAt: string;

  // Progress summary (computed)
  progressPercent?: number;
  masteredItems?: number;
  totalItems?: number;
  streakDays?: number;
  lastStudiedAt?: string;
}
```

---

## 3. Learner Profile Architecture

### 3.1 Profile Structure

```typescript
// src/commons/model/LearnerProfile.ts

export interface LearnerProfile {
  userId: number;

  // Global learning characteristics
  global: GlobalLearnerProfile;

  // Per-domain profiles
  domains: Record<string, DomainLearnerProfile>;

  // Active learning topics
  activeTopics: string[];  // Topic IDs

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface GlobalLearnerProfile {
  // Learning style preferences
  learningStyle: 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'mixed';
  preferredSessionLength: number;  // minutes
  bestTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'flexible';

  // Motivation patterns
  motivationType: 'streak' | 'achievement' | 'mastery' | 'social' | 'deadline';
  responseToChallenge: 'persistent' | 'needs_encouragement' | 'prefers_easy_wins';

  // Learning velocity (cross-domain)
  overallLearningVelocity: number;  // 1.0 = average
  consistencyScore: number;         // 0-1, how regular is their study

  // Engagement patterns
  averageSessionsPerWeek: number;
  averageSessionDuration: number;
  preferredContentTypes: string[];

  // Historical performance
  totalItemsLearned: number;
  totalStudyTimeMinutes: number;
  longestStreak: number;
}

export interface DomainLearnerProfile {
  domainType: DomainType;
  domainName: string;  // "vocabulary", "math", etc.

  // Mastery state
  overallMastery: number;           // 0-1
  itemsMastered: number;
  itemsInProgress: number;
  itemsNotStarted: number;

  // Performance patterns
  learningVelocity: number;         // Relative to global average
  retentionStrength: number;        // How well they retain in this domain
  averageAccuracy: number;

  // Weakness analysis
  weakAreas: WeakArea[];
  confusionPatterns: ConfusionPattern[];

  // Strength analysis
  strongAreas: string[];

  // Domain-specific metrics
  domainMetrics: Record<string, any>;  // Flexible per domain

  // Time tracking
  totalTimeSpent: number;
  lastStudiedAt: string;

  // Adaptive settings
  currentDifficultyLevel: number;   // 1-5
  spacedRepetitionMultiplier: number;  // Adjusts intervals
}

export interface WeakArea {
  area: string;                     // "phrasal verbs", "integration", "async programming"
  severity: 'mild' | 'moderate' | 'severe';
  accuracy: number;
  itemCount: number;
  suggestedAction: string;
}

export interface ConfusionPattern {
  items: string[];                  // Items often confused together
  confusionType: string;            // "spelling", "meaning", "application"
  frequency: number;
  lastOccurred: string;
}
```

### 3.2 Profile Skills

```javascript
// src/main/skills/profile/LearnerProfileSkills.js

/**
 * Updates learner profile based on learning activity
 */
class LearnerProfileUpdateSkill extends BaseSkill {
  static get name() { return 'learner_profile_update'; }

  static get parameters() {
    return {
      activityType: {
        type: 'string',
        enum: ['study_session', 'quiz_completed', 'content_viewed', 'goal_set', 'milestone_reached']
      },
      domainType: { type: 'string' },
      topicId: { type: 'string' },
      activityData: { type: 'object', description: 'Activity-specific data' }
    };
  }

  async execute({ activityType, domainType, topicId, activityData }) {
    const profile = await this.getProfile();

    // Update domain-specific profile
    if (!profile.domains[domainType]) {
      profile.domains[domainType] = this.initializeDomainProfile(domainType);
    }

    const domainProfile = profile.domains[domainType];

    switch (activityType) {
      case 'study_session':
        await this.updateFromStudySession(profile, domainProfile, activityData);
        break;
      case 'quiz_completed':
        await this.updateFromQuiz(profile, domainProfile, activityData);
        break;
      // ... other activity types
    }

    // Update global patterns
    await this.updateGlobalPatterns(profile);

    // Persist
    await this.saveProfile(profile);

    return { updated: true, profile };
  }

  async updateFromStudySession(profile, domainProfile, data) {
    const { duration, itemsReviewed, correctCount, responseTimesMs } = data;

    // Update time tracking
    profile.global.totalStudyTimeMinutes += duration;
    domainProfile.totalTimeSpent += duration;
    domainProfile.lastStudiedAt = new Date().toISOString();

    // Update accuracy
    const sessionAccuracy = correctCount / itemsReviewed;
    domainProfile.averageAccuracy =
      (domainProfile.averageAccuracy * 0.9) + (sessionAccuracy * 0.1);

    // Update learning velocity based on response times
    const avgResponseTime = responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length;
    // Faster responses = higher velocity (normalized)
    const velocitySignal = 5000 / avgResponseTime;  // 5 seconds = 1.0 velocity
    domainProfile.learningVelocity =
      (domainProfile.learningVelocity * 0.95) + (velocitySignal * 0.05);
  }
}

/**
 * Analyzes learner profile to detect patterns and weaknesses
 */
class LearnerProfileAnalyzeSkill extends BaseSkill {
  static get name() { return 'learner_profile_analyze'; }

  static get parameters() {
    return {
      domainType: { type: 'string', description: 'Domain to analyze (or "all")' },
      analysisType: {
        type: 'string',
        enum: ['weakness_detection', 'pattern_recognition', 'velocity_analysis', 'full']
      }
    };
  }

  async execute({ domainType, analysisType }) {
    const profile = await this.getProfile();
    const performanceHistory = await this.getPerformanceHistory(domainType);

    const prompt = `
Analyze this learner's profile and performance history:

PROFILE:
${JSON.stringify(profile.domains[domainType] || profile.global, null, 2)}

RECENT PERFORMANCE (last 50 items):
${JSON.stringify(performanceHistory.slice(0, 50), null, 2)}

Analysis Type: ${analysisType}

Provide insights on:
${analysisType === 'weakness_detection' || analysisType === 'full' ? `
1. Specific weak areas (topics/concepts with low accuracy)
2. Confusion patterns (items frequently mixed up)
3. Severity assessment for each weakness
` : ''}
${analysisType === 'pattern_recognition' || analysisType === 'full' ? `
4. Learning style indicators
5. Optimal session length based on performance decay
6. Best performing times/conditions
` : ''}
${analysisType === 'velocity_analysis' || analysisType === 'full' ? `
7. Learning velocity trends (improving, declining, stable)
8. Predicted time to mastery for current topics
9. Comparison to typical learner
` : ''}

Return JSON:
{
  "weakAreas": [...],
  "confusionPatterns": [...],
  "learningStyleInsights": {...},
  "velocityAnalysis": {...},
  "recommendations": [...],
  "alerts": [...],  // Urgent issues needing attention
  "encouragements": [...]  // Positive patterns to reinforce
}`;

    const analysis = await this.context.aiProvider.generateContentWithJson(prompt, true);

    // Update profile with new insights
    if (analysis.weakAreas) {
      profile.domains[domainType].weakAreas = analysis.weakAreas;
    }

    await this.saveProfile(profile);

    return analysis;
  }
}

/**
 * Gets personalized recommendations based on profile
 */
class LearnerProfileRecommendSkill extends BaseSkill {
  static get name() { return 'learner_profile_recommend'; }

  static get parameters() {
    return {
      recommendationType: {
        type: 'string',
        enum: ['next_action', 'study_schedule', 'content', 'difficulty_adjustment']
      },
      context: { type: 'object', description: 'Current context (time, energy, available time)' }
    };
  }

  async execute({ recommendationType, context }) {
    const profile = await this.getProfile();
    const activeTopics = await this.getActiveTopics();

    const prompt = `
Based on this learner profile, provide ${recommendationType} recommendations:

LEARNER PROFILE:
${JSON.stringify(profile.global, null, 2)}

ACTIVE TOPICS:
${JSON.stringify(activeTopics, null, 2)}

CURRENT CONTEXT:
- Time of day: ${context.timeOfDay}
- Available minutes: ${context.availableMinutes}
- Energy level: ${context.energyLevel || 'unknown'}
- Days since last study: ${context.daysSinceLastStudy}

${recommendationType === 'next_action' ? `
Recommend what the learner should do RIGHT NOW:
- Which topic to study?
- What type of activity (review, new material, quiz)?
- How long?
- Why this recommendation?
` : ''}

${recommendationType === 'study_schedule' ? `
Recommend an optimal study schedule for the coming week:
- Which topics on which days?
- Session lengths?
- Balance between new material and review?
` : ''}

Return JSON with actionable recommendations.`;

    return await this.context.aiProvider.generateContentWithJson(prompt, true);
  }
}
```

---

## 4. Learning Plan Skills

### 4.1 Plan Skill Architecture

```
LEARNING PLAN SKILLS
├── learning_plan_create      → Initial plan creation with user
├── learning_plan_get         → Retrieve current plan
├── learning_plan_progress    → Check and update progress
├── learning_plan_adapt       → Modify plan based on performance
├── learning_plan_execute     → Run a learning session
└── learning_plan_remind      → Generate notifications
```

### 4.2 Plan Creation Skill

```javascript
// src/main/skills/learning/LearningPlanCreateSkill.js

class LearningPlanCreateSkill extends BaseSkill {
  static get name() { return 'learning_plan_create'; }
  static get description() {
    return 'Creates a personalized learning plan through conversation with AI';
  }

  static get parameters() {
    return {
      topicId: { type: 'string', description: 'Learning topic ID' },
      userGoals: { type: 'string', description: 'User stated goals' },
      constraints: {
        type: 'object',
        description: '{ dailyMinutes, deadlineDate, difficultyPreference }'
      },
      existingKnowledge: { type: 'array', description: 'What user already knows' }
    };
  }

  async execute({ topicId, userGoals, constraints, existingKnowledge = [] }) {
    const topic = await this.getTopic(topicId);
    const domainConfig = DOMAIN_CONFIGS[topic.domainType];
    const learnerProfile = await this.getLearnerProfile();

    // Get domain-specific content inventory
    const contentInventory = await this.getContentInventory(topic);

    const prompt = `
Create a comprehensive learning plan:

LEARNING TOPIC:
- Name: ${topic.name}
- Domain: ${topic.domainType}
- Description: ${topic.description}

USER GOALS: ${userGoals}

CONSTRAINTS:
- Daily time: ${constraints.dailyMinutes} minutes
- Deadline: ${constraints.deadlineDate || 'None'}
- Difficulty preference: ${constraints.difficultyPreference || 'auto'}

LEARNER PROFILE:
- Learning velocity: ${learnerProfile.global.overallLearningVelocity}x
- Preferred session: ${learnerProfile.global.preferredSessionLength} min
- Learning style: ${learnerProfile.global.learningStyle}
- Domain experience: ${learnerProfile.domains[topic.domainType]?.overallMastery || 0}

EXISTING KNOWLEDGE:
${existingKnowledge.join('\n')}

CONTENT AVAILABLE:
- Total items: ${contentInventory.totalItems}
- Categories: ${contentInventory.categories.join(', ')}
- Difficulty range: ${contentInventory.difficultyRange}

DOMAIN-SPECIFIC MECHANICS:
- Uses spaced repetition: ${domainConfig.usesSpacedRepetition}
- Uses progressive difficulty: ${domainConfig.usesProgressiveDifficulty}
- Assessment methods: ${domainConfig.assessmentMethods.join(', ')}

Create a structured learning plan:

Return JSON:
{
  "planName": "Descriptive plan name",
  "estimatedDays": number,
  "dailyTimeMinutes": number,
  "totalItems": number,

  "phases": [
    {
      "phaseNumber": 1,
      "name": "Foundation",
      "durationDays": 7,
      "focus": "Core concepts",
      "dailyGoal": { "newItems": 5, "reviewItems": 10 },
      "successCriteria": "80% accuracy on fundamentals"
    }
  ],

  "weeklyStructure": {
    "studyDays": [1, 2, 3, 4, 5],
    "reviewDays": [6],
    "restDays": [7],
    "heavyDays": [1, 3, 5],
    "lightDays": [2, 4]
  },

  "milestones": [
    {
      "day": 7,
      "name": "Foundation Complete",
      "criteria": "Complete Phase 1 with 80% accuracy",
      "reward": "Unlock intermediate content"
    }
  ],

  "adaptationRules": [
    {
      "condition": "accuracy < 70% for 3 consecutive days",
      "action": "reduce_new_items",
      "parameter": 2
    },
    {
      "condition": "accuracy > 95% for 3 consecutive days",
      "action": "increase_difficulty",
      "parameter": 1
    }
  ],

  "initialAssessment": {
    "required": true,
    "itemCount": 20,
    "purpose": "Determine starting point"
  },

  "contentSequence": [
    {
      "category": "basic_concepts",
      "items": ["item1", "item2"],
      "introducedInPhase": 1
    }
  ]
}`;

    const planData = await this.context.aiProvider.generateContentWithJson(prompt, true);

    // Create plan entity
    const plan = await this.createPlanEntity({
      topicId,
      planData,
      status: 'active',
      currentPhase: 1,
      currentDay: 0
    });

    // Initialize first day's content
    await this.initializeDailyContent(plan);

    // Schedule reminders
    await this.scheduleInitialReminders(plan);

    return {
      plan,
      firstDayPreview: await this.getSessionPreview(plan, 1)
    };
  }
}
```

### 4.3 Plan Progress Skill

```javascript
// src/main/skills/learning/LearningPlanProgressSkill.js

class LearningPlanProgressSkill extends BaseSkill {
  static get name() { return 'learning_plan_progress'; }
  static get description() {
    return 'Checks and updates learning plan progress, determines next actions';
  }

  static get parameters() {
    return {
      planId: { type: 'string' },
      action: {
        type: 'string',
        enum: ['check', 'complete_session', 'skip_day', 'get_today']
      },
      sessionData: { type: 'object', description: 'Data from completed session if action=complete_session' }
    };
  }

  async execute({ planId, action, sessionData }) {
    const plan = await this.getPlan(planId);
    const profile = await this.getLearnerProfile();

    switch (action) {
      case 'check':
        return this.checkProgress(plan, profile);

      case 'complete_session':
        return this.recordSession(plan, profile, sessionData);

      case 'skip_day':
        return this.handleSkippedDay(plan);

      case 'get_today':
        return this.getTodaysPlan(plan, profile);
    }
  }

  async checkProgress(plan, profile) {
    const progress = await this.calculateProgress(plan);

    const analysis = await this.analyzeProgress(plan, progress, profile);

    return {
      progress: {
        currentDay: plan.currentDay,
        totalDays: plan.planData.estimatedDays,
        percentComplete: progress.percentComplete,
        itemsMastered: progress.itemsMastered,
        totalItems: plan.planData.totalItems,
        currentPhase: plan.currentPhase,
        onTrack: progress.onTrack,
        daysAhead: progress.daysAhead,  // negative if behind
        streakDays: progress.streakDays
      },

      analysis: {
        status: analysis.status,  // 'on_track', 'ahead', 'behind', 'struggling'
        message: analysis.message,
        suggestions: analysis.suggestions,
        alerts: analysis.alerts
      },

      nextMilestone: this.getNextMilestone(plan, progress),

      todayCompleted: progress.todayCompleted,
      todayRemaining: progress.todayRemaining
    };
  }

  async recordSession(plan, profile, sessionData) {
    const { itemsReviewed, correctCount, newItemsLearned, durationMinutes } = sessionData;

    // Record to history
    await this.recordSessionHistory(plan.id, sessionData);

    // Update profile
    await this.context.skillExecutor.execute('learner_profile_update', {
      activityType: 'study_session',
      domainType: plan.topic.domainType,
      topicId: plan.topicId,
      activityData: sessionData
    });

    // Check if day's goals met
    const dailyGoal = this.getDailyGoal(plan);
    const goalsMet = this.checkDailyGoals(sessionData, dailyGoal);

    // Check adaptation rules
    const adaptations = await this.checkAdaptationRules(plan, sessionData);

    // Generate feedback
    const feedback = await this.generateSessionFeedback(plan, sessionData, goalsMet);

    // Check for milestone completion
    const milestoneReached = await this.checkMilestones(plan, sessionData);

    // Update plan state
    if (goalsMet) {
      plan.currentDay++;
      await this.savePlan(plan);
    }

    // Apply any adaptations
    if (adaptations.length > 0) {
      await this.applyAdaptations(plan, adaptations);
    }

    // Create notifications if needed
    if (milestoneReached) {
      await this.createMilestoneNotification(plan, milestoneReached);
    }

    return {
      goalsMet,
      feedback,
      adaptations,
      milestoneReached,
      nextSession: goalsMet ? await this.getSessionPreview(plan, plan.currentDay + 1) : null
    };
  }

  async getTodaysPlan(plan, profile) {
    const todaysContent = await this.generateTodaysContent(plan, profile);

    return {
      dayNumber: plan.currentDay + 1,
      phase: plan.planData.phases[plan.currentPhase - 1],

      sessions: [
        {
          type: 'review',
          items: todaysContent.reviewItems,
          estimatedMinutes: todaysContent.reviewMinutes,
          priority: 'high'
        },
        {
          type: 'new_material',
          items: todaysContent.newItems,
          estimatedMinutes: todaysContent.newMinutes,
          priority: 'medium'
        },
        {
          type: 'practice',
          exercises: todaysContent.practiceExercises,
          estimatedMinutes: todaysContent.practiceMinutes,
          priority: profile.domains[plan.topic.domainType]?.weakAreas.length > 0 ? 'high' : 'low'
        }
      ],

      totalEstimatedMinutes: todaysContent.totalMinutes,
      focusAreas: todaysContent.focusAreas,
      dailyTip: todaysContent.tip
    };
  }
}
```

### 4.4 Plan Adaptation Skill

```javascript
// src/main/skills/learning/LearningPlanAdaptSkill.js

class LearningPlanAdaptSkill extends BaseSkill {
  static get name() { return 'learning_plan_adapt'; }
  static get description() {
    return 'Adapts learning plan based on performance and circumstances';
  }

  static get parameters() {
    return {
      planId: { type: 'string' },
      adaptationType: {
        type: 'string',
        enum: ['performance_based', 'schedule_change', 'goal_change', 'ai_recommendation']
      },
      adaptationData: { type: 'object' }
    };
  }

  async execute({ planId, adaptationType, adaptationData }) {
    const plan = await this.getPlan(planId);
    const profile = await this.getLearnerProfile();
    const recentPerformance = await this.getRecentPerformance(planId, 7); // Last 7 days

    let adaptations = [];

    switch (adaptationType) {
      case 'performance_based':
        adaptations = await this.analyzeAndAdapt(plan, recentPerformance);
        break;

      case 'schedule_change':
        adaptations = await this.adaptToScheduleChange(plan, adaptationData);
        break;

      case 'goal_change':
        adaptations = await this.adaptToGoalChange(plan, adaptationData);
        break;

      case 'ai_recommendation':
        adaptations = await this.getAIAdaptations(plan, profile, recentPerformance);
        break;
    }

    // Apply adaptations
    for (const adaptation of adaptations) {
      await this.applyAdaptation(plan, adaptation);
    }

    // Notify user of changes
    if (adaptations.length > 0) {
      await this.createAdaptationNotification(plan, adaptations);
    }

    return {
      adaptationsApplied: adaptations,
      updatedPlan: await this.getPlan(planId)
    };
  }

  async getAIAdaptations(plan, profile, recentPerformance) {
    const prompt = `
Analyze this learning plan and recent performance to suggest adaptations:

PLAN:
${JSON.stringify(plan.planData, null, 2)}

CURRENT PROGRESS:
- Day: ${plan.currentDay} of ${plan.planData.estimatedDays}
- Phase: ${plan.currentPhase}
- Items mastered: ${plan.progress?.itemsMastered || 0}

RECENT PERFORMANCE (7 days):
${JSON.stringify(recentPerformance, null, 2)}

LEARNER PROFILE:
${JSON.stringify(profile.domains[plan.topic.domainType], null, 2)}

Consider:
1. Is the pace appropriate? (too fast/slow)
2. Are there struggling areas needing extra focus?
3. Should difficulty be adjusted?
4. Are milestones realistic?
5. Should content sequence change?

Return JSON:
{
  "overallAssessment": "on_track|needs_adjustment|major_revision",
  "adaptations": [
    {
      "type": "pace_adjustment|difficulty_change|content_reorder|milestone_update|focus_shift",
      "description": "What change to make",
      "reason": "Why this change is recommended",
      "parameters": {...},
      "impact": "Expected impact of this change"
    }
  ],
  "encouragement": "Positive message for the learner",
  "warnings": ["Any concerns to address"]
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);
    return result.adaptations || [];
  }
}
```

### 4.5 Plan Reminder Skill

```javascript
// src/main/skills/learning/LearningPlanRemindSkill.js

class LearningPlanRemindSkill extends BaseSkill {
  static get name() { return 'learning_plan_remind'; }
  static get description() {
    return 'Generates contextual reminders and notifications for learning plans';
  }

  static get parameters() {
    return {
      checkType: {
        type: 'string',
        enum: ['scheduled', 'daily_check', 'streak_risk', 'milestone_approaching']
      }
    };
  }

  async execute({ checkType }) {
    const activePlans = await this.getActivePlans();
    const profile = await this.getLearnerProfile();
    const notifications = [];

    for (const plan of activePlans) {
      const planNotifications = await this.generatePlanNotifications(plan, profile, checkType);
      notifications.push(...planNotifications);
    }

    // Store notifications
    for (const notification of notifications) {
      await this.createNotification(notification);
    }

    return { notificationsCreated: notifications.length, notifications };
  }

  async generatePlanNotifications(plan, profile, checkType) {
    const notifications = [];
    const progress = await this.getProgress(plan.id);

    // Daily study reminder
    if (checkType === 'daily_check' || checkType === 'scheduled') {
      if (!progress.todayCompleted) {
        const optimalTime = profile.global.bestTimeOfDay;
        notifications.push({
          type: 'study_reminder',
          planId: plan.id,
          priority: 'normal',
          title: `Time to study: ${plan.topic.name}`,
          message: await this.generateReminderMessage(plan, progress),
          actionUrl: `/learning/${plan.topicId}/study`,
          actionLabel: 'Start Session',
          scheduledFor: this.getOptimalReminderTime(optimalTime)
        });
      }
    }

    // Streak at risk
    if (checkType === 'streak_risk' || checkType === 'daily_check') {
      if (progress.streakDays > 3 && !progress.todayCompleted) {
        const hoursLeft = this.getHoursUntilMidnight();
        if (hoursLeft < 4) {
          notifications.push({
            type: 'streak_risk',
            planId: plan.id,
            priority: 'high',
            title: `🔥 Don't lose your ${progress.streakDays}-day streak!`,
            message: `You have ${hoursLeft} hours to complete today's session for ${plan.topic.name}.`,
            actionUrl: `/learning/${plan.topicId}/study`,
            actionLabel: 'Quick Review',
            expiresAt: this.getEndOfDay()
          });
        }
      }
    }

    // Milestone approaching
    if (checkType === 'milestone_approaching' || checkType === 'daily_check') {
      const nextMilestone = this.getNextMilestone(plan);
      if (nextMilestone && nextMilestone.daysUntil <= 2) {
        notifications.push({
          type: 'milestone_approaching',
          planId: plan.id,
          priority: 'normal',
          title: `🎯 Milestone in ${nextMilestone.daysUntil} days`,
          message: `"${nextMilestone.name}" - ${nextMilestone.criteria}`,
          actionUrl: `/learning/${plan.topicId}/progress`,
          actionLabel: 'View Progress'
        });
      }
    }

    // Behind schedule
    if (progress.daysAhead < -2) {
      notifications.push({
        type: 'behind_schedule',
        planId: plan.id,
        priority: 'normal',
        title: `📅 ${plan.topic.name} is ${Math.abs(progress.daysAhead)} days behind`,
        message: 'Would you like to adjust your schedule or catch up with an extended session?',
        actionUrl: `/learning/${plan.topicId}/adapt`,
        actionLabel: 'Adjust Plan',
        actions: [
          { label: 'Catch Up Session', action: 'catch_up' },
          { label: 'Adjust Schedule', action: 'reschedule' }
        ]
      });
    }

    return notifications;
  }

  async generateReminderMessage(plan, progress) {
    const prompt = `
Generate a brief, motivating study reminder for:
- Topic: ${plan.topic.name}
- Current streak: ${progress.streakDays} days
- Progress: ${progress.percentComplete}%
- Phase: ${plan.planData.phases[plan.currentPhase - 1]?.name}
- Today's focus: ${progress.todayFocus}

Be encouraging but not annoying. Max 2 sentences. Use an emoji.`;

    const result = await this.context.aiProvider.generateContent(prompt);
    return result.trim();
  }
}
```

---

## 5. Content Generation Skills

### 5.1 Content Generator Architecture

```
CONTENT GENERATION SKILLS
├── content_generate_quiz      → Domain-aware quiz generation
├── content_generate_example   → Contextual examples
├── content_generate_explanation → Adaptive explanations
├── content_generate_practice  → Practice problems/exercises
├── content_generate_summary   → Progress summaries
└── content_generate_review    → Review session content
```

### 5.2 Domain-Aware Quiz Generation

```javascript
// src/main/skills/content/ContentGenerateQuizSkill.js

class ContentGenerateQuizSkill extends BaseSkill {
  static get name() { return 'content_generate_quiz'; }
  static get description() {
    return 'Generates domain-appropriate quiz questions based on learning content and learner profile';
  }

  static get parameters() {
    return {
      topicId: { type: 'string' },
      items: { type: 'array', description: 'Items to quiz on' },
      quizType: {
        type: 'string',
        enum: ['recall', 'application', 'mixed', 'weakness_focused']
      },
      difficulty: { type: 'number', description: '1-5 difficulty level' },
      questionCount: { type: 'number', default: 10 }
    };
  }

  async execute({ topicId, items, quizType, difficulty, questionCount }) {
    const topic = await this.getTopic(topicId);
    const domainConfig = DOMAIN_CONFIGS[topic.domainType];
    const profile = await this.getLearnerProfile();
    const weakAreas = profile.domains[topic.domainType]?.weakAreas || [];

    // Select question types based on domain
    const questionTypes = this.selectQuestionTypes(domainConfig, quizType);

    const prompt = `
Generate a ${questionCount}-question quiz for ${topic.domainType} learning:

TOPIC: ${topic.name}
DIFFICULTY: ${difficulty}/5
QUIZ TYPE: ${quizType}

ITEMS TO QUIZ ON:
${JSON.stringify(items.slice(0, 20), null, 2)}

DOMAIN: ${topic.domainType}
AVAILABLE QUESTION TYPES: ${questionTypes.join(', ')}

LEARNER WEAK AREAS (emphasize these):
${weakAreas.map(w => w.area).join(', ') || 'None identified'}

${topic.domainType === 'vocabulary' ? `
For vocabulary:
- Include definition recall
- Usage in sentences
- Synonym/antonym recognition
- Context-based meaning
` : ''}

${topic.domainType === 'math' ? `
For math:
- Concept application problems
- Formula recall and application
- Step-by-step problem solving
- Include "show your work" questions
` : ''}

${topic.domainType === 'knowledge' ? `
For knowledge:
- Fact recall
- Relationship questions (cause/effect, compare/contrast)
- Application scenarios
- Comprehension questions
` : ''}

${topic.domainType === 'skill' ? `
For skills:
- Code/output prediction
- Debug/fix exercises
- Implementation scenarios
- Best practice identification
` : ''}

Return JSON:
{
  "quiz": {
    "title": "Quiz title",
    "totalQuestions": ${questionCount},
    "estimatedMinutes": number,
    "difficulty": ${difficulty},

    "questions": [
      {
        "id": "q1",
        "type": "multiple_choice|fill_blank|true_false|short_answer|code|matching",
        "difficulty": 1-5,
        "itemId": "ID of item being tested",
        "question": "Question text",
        "options": ["A", "B", "C", "D"] or null,
        "correctAnswer": "answer",
        "explanation": "Why this is correct",
        "hints": ["hint1", "hint2"],
        "relatedWeakArea": "weak area if applicable" or null
      }
    ]
  }
}`;

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return result.quiz;
  }
}
```

### 5.3 Adaptive Explanation Generation

```javascript
// src/main/skills/content/ContentGenerateExplanationSkill.js

class ContentGenerateExplanationSkill extends BaseSkill {
  static get name() { return 'content_generate_explanation'; }
  static get description() {
    return 'Generates adaptive explanations based on learner profile and previous attempts';
  }

  static get parameters() {
    return {
      itemId: { type: 'string', description: 'Item to explain' },
      itemContent: { type: 'object', description: 'Item details' },
      reason: {
        type: 'string',
        enum: ['first_time', 'incorrect_answer', 'requested', 'confusion']
      },
      previousAttempts: { type: 'array', description: 'Previous wrong answers if any' }
    };
  }

  async execute({ itemId, itemContent, reason, previousAttempts = [] }) {
    const profile = await this.getLearnerProfile();
    const learningStyle = profile.global.learningStyle;

    const prompt = `
Generate an explanation for a learner who ${reason === 'incorrect_answer' ? 'got this wrong' : 'is learning this for the first time'}:

ITEM:
${JSON.stringify(itemContent, null, 2)}

LEARNER:
- Learning style: ${learningStyle}
- Level: ${profile.global.currentLevel || 'intermediate'}
${previousAttempts.length > 0 ? `
PREVIOUS WRONG ANSWERS:
${previousAttempts.map(a => `- Answered: "${a.answer}" (${a.misconception || 'unknown misconception'})`).join('\n')}
` : ''}

REASON FOR EXPLANATION: ${reason}

Generate an explanation that:
${learningStyle === 'visual' ? '- Uses visual analogies and diagrams descriptions' : ''}
${learningStyle === 'auditory' ? '- Uses rhythmic, memorable phrasing' : ''}
${learningStyle === 'reading' ? '- Provides detailed textual explanation' : ''}
${learningStyle === 'kinesthetic' ? '- Includes hands-on examples and applications' : ''}
${previousAttempts.length > 0 ? '- Directly addresses the misconception from wrong answers' : ''}

Return JSON:
{
  "mainExplanation": "Core explanation text",
  "visualAid": "Description of a helpful visual (can be rendered)",
  "analogy": "Relatable analogy if helpful",
  "keyPoints": ["point1", "point2"],
  "commonMistakes": ["mistake1"],
  "memoryTip": "Tip for remembering",
  "relatedConcepts": ["concept1", "concept2"],
  "practicePrompt": "A quick practice question to confirm understanding"
}`;

    return await this.context.aiProvider.generateContentWithJson(prompt, true);
  }
}
```

### 5.4 Practice Problem Generation

```javascript
// src/main/skills/content/ContentGeneratePracticeSkill.js

class ContentGeneratePracticeSkill extends BaseSkill {
  static get name() { return 'content_generate_practice'; }
  static get description() {
    return 'Generates practice problems tailored to weak areas and learning stage';
  }

  static get parameters() {
    return {
      topicId: { type: 'string' },
      focusArea: { type: 'string', description: 'Specific area to practice' },
      difficulty: { type: 'number' },
      practiceType: {
        type: 'string',
        enum: ['drill', 'application', 'mixed', 'challenge']
      },
      count: { type: 'number', default: 5 }
    };
  }

  async execute({ topicId, focusArea, difficulty, practiceType, count }) {
    const topic = await this.getTopic(topicId);
    const domainConfig = DOMAIN_CONFIGS[topic.domainType];

    // Domain-specific practice generation
    const prompt = this.buildDomainSpecificPrompt(topic, focusArea, difficulty, practiceType, count, domainConfig);

    const result = await this.context.aiProvider.generateContentWithJson(prompt, true);

    return {
      practiceSet: result.problems,
      estimatedTime: result.estimatedMinutes,
      focusArea,
      difficulty
    };
  }

  buildDomainSpecificPrompt(topic, focusArea, difficulty, practiceType, count, domainConfig) {
    const basePrompt = `
Generate ${count} practice problems for ${topic.domainType}:

TOPIC: ${topic.name}
FOCUS AREA: ${focusArea}
DIFFICULTY: ${difficulty}/5
PRACTICE TYPE: ${practiceType}
`;

    const domainInstructions = {
      vocabulary: `
For vocabulary practice:
- Sentence completion exercises
- Word usage in context
- Synonym/antonym matching
- Error correction (wrong word usage)
- Definition matching`,

      math: `
For math practice:
- Computational problems
- Word problems
- Multi-step solutions
- Proof exercises (if applicable)
- Real-world applications`,

      language: `
For language practice:
- Grammar exercises
- Sentence transformation
- Error correction
- Translation exercises
- Composition prompts`,

      knowledge: `
For knowledge practice:
- Concept application scenarios
- Compare/contrast exercises
- Cause-effect analysis
- Case studies
- Critical thinking questions`,

      skill: `
For skill practice:
- Code challenges
- Implementation exercises
- Debug scenarios
- Design problems
- Best practice identification`
    };

    return `${basePrompt}

${domainInstructions[topic.domainType] || ''}

Return JSON:
{
  "problems": [
    {
      "id": "p1",
      "type": "problem type",
      "difficulty": ${difficulty},
      "problem": "Problem statement",
      "inputs": {...} or null,
      "expectedOutput": "Expected answer/solution",
      "hints": ["hint1"],
      "solution": "Step-by-step solution",
      "commonErrors": ["error1"]
    }
  ],
  "estimatedMinutes": number
}`;
  }
}
```

---

## 6. Knowledge Graph Structure

### 6.1 Per-Domain Graph Schema

```javascript
// src/commons/model/GraphSchema.ts (extended)

export const DOMAIN_GRAPH_SCHEMAS = {

  vocabulary: {
    nodeTypes: {
      Word: {
        properties: ['word', 'definition', 'partOfSpeech', 'difficulty', 'frequency'],
        indexes: ['word', 'userId']
      },
      WordFamily: {
        properties: ['root', 'meaning', 'language'],
        indexes: ['root']
      },
      UsageContext: {
        properties: ['context', 'formality', 'domain'],
        indexes: ['domain']
      }
    },
    edgeTypes: {
      SYNONYM: { properties: ['strength'] },
      ANTONYM: { properties: ['strength'] },
      DERIVED_FROM: { properties: ['derivationType'] },
      BELONGS_TO_FAMILY: {},
      USED_IN_CONTEXT: { properties: ['frequency'] },
      OFTEN_CONFUSED_WITH: { properties: ['confusionType'] }
    }
  },

  math: {
    nodeTypes: {
      Concept: {
        properties: ['name', 'description', 'branch', 'difficulty'],
        indexes: ['name', 'branch']
      },
      Formula: {
        properties: ['expression', 'name', 'variables'],
        indexes: ['name']
      },
      Theorem: {
        properties: ['name', 'statement', 'proof'],
        indexes: ['name']
      },
      Technique: {
        properties: ['name', 'description', 'steps'],
        indexes: ['name']
      }
    },
    edgeTypes: {
      PREREQUISITE: { properties: ['strength'] },
      APPLIES_TO: {},
      PROVES: {},
      USES_TECHNIQUE: {},
      DERIVED_FROM: {}
    }
  },

  language: {
    nodeTypes: {
      GrammarRule: {
        properties: ['name', 'description', 'examples', 'level'],
        indexes: ['name', 'level']
      },
      Vocabulary: {
        properties: ['word', 'translation', 'partOfSpeech'],
        indexes: ['word']
      },
      Phrase: {
        properties: ['phrase', 'meaning', 'usage'],
        indexes: ['phrase']
      },
      Structure: {
        properties: ['pattern', 'usage', 'level'],
        indexes: ['pattern']
      }
    },
    edgeTypes: {
      REQUIRES: { properties: ['strength'] },
      SIMILAR_TO: {},
      CONTRASTS_WITH: {},
      USED_IN: {},
      EXAMPLE_OF: {}
    }
  },

  knowledge: {
    nodeTypes: {
      Concept: {
        properties: ['name', 'description', 'category'],
        indexes: ['name', 'category']
      },
      Entity: {
        properties: ['name', 'type', 'attributes'],
        indexes: ['name', 'type']
      },
      Event: {
        properties: ['name', 'date', 'description'],
        indexes: ['name', 'date']
      },
      Principle: {
        properties: ['name', 'statement', 'domain'],
        indexes: ['name']
      }
    },
    edgeTypes: {
      CAUSES: { properties: ['strength'] },
      LEADS_TO: {},
      PART_OF: {},
      EXAMPLE_OF: {},
      CONTRASTS_WITH: {},
      RELATED_TO: { properties: ['relationshipType'] }
    }
  },

  skill: {
    nodeTypes: {
      Skill: {
        properties: ['name', 'description', 'level'],
        indexes: ['name']
      },
      Technique: {
        properties: ['name', 'description', 'useCases'],
        indexes: ['name']
      },
      Tool: {
        properties: ['name', 'description', 'version'],
        indexes: ['name']
      },
      Pattern: {
        properties: ['name', 'description', 'context'],
        indexes: ['name']
      },
      BestPractice: {
        properties: ['name', 'description', 'rationale'],
        indexes: ['name']
      }
    },
    edgeTypes: {
      PREREQUISITE: { properties: ['strength'] },
      ENABLES: {},
      USED_WITH: {},
      ALTERNATIVE_TO: {},
      IMPLEMENTS: {}
    }
  }
};
```

### 6.2 Graph Learning Features

```javascript
// src/main/utils/DomainGraphFeatures.js

class DomainGraphFeatures {
  constructor(neo4jAdapter, domainType) {
    this.neo4j = neo4jAdapter;
    this.domainType = domainType;
    this.schema = DOMAIN_GRAPH_SCHEMAS[domainType];
  }

  /**
   * Get learning path for a target concept
   */
  async getLearningPath(targetNodeId, userId) {
    const session = this.neo4j.driver.session();

    try {
      const result = await session.run(`
        MATCH path = (start)-[:PREREQUISITE*0..5]->(target)
        WHERE target.id = $targetNodeId
          AND start.userId = $userId
          AND start.mastery < 0.8
        WITH path, nodes(path) as pathNodes
        UNWIND pathNodes as node
        WITH DISTINCT node
        ORDER BY node.mastery ASC
        RETURN collect({
          id: node.id,
          name: node.name,
          type: labels(node)[0],
          mastery: node.mastery,
          difficulty: node.difficulty
        }) as learningPath
      `, { targetNodeId, userId });

      return result.records[0]?.get('learningPath') || [];
    } finally {
      await session.close();
    }
  }

  /**
   * Find weak concepts in this domain
   */
  async findWeakConcepts(userId, limit = 10) {
    const session = this.neo4j.driver.session();

    try {
      const nodeTypes = Object.keys(this.schema.nodeTypes);

      const result = await session.run(`
        MATCH (n)
        WHERE any(label IN labels(n) WHERE label IN $nodeTypes)
          AND n.userId = $userId
          AND n.mastery < 0.6
        WITH n
        OPTIONAL MATCH (n)<-[:PREREQUISITE]-(dependent)
        WHERE dependent.mastery > 0.5
        WITH n, count(dependent) as blockedCount
        RETURN {
          id: n.id,
          name: n.name,
          type: labels(n)[0],
          mastery: n.mastery,
          reviewCount: n.reviewCount,
          lastReviewed: n.lastReviewed,
          blockedCount: blockedCount,
          weaknessScore: (1 - n.mastery) * (1 + blockedCount * 0.2)
        } as weakConcept
        ORDER BY weakConcept.weaknessScore DESC
        LIMIT $limit
      `, { nodeTypes, userId, limit: parseInt(limit) });

      return result.records.map(r => r.get('weakConcept'));
    } finally {
      await session.close();
    }
  }

  /**
   * Get related concepts for reinforcement learning
   */
  async getRelatedConcepts(nodeId, relationTypes = null) {
    const session = this.neo4j.driver.session();

    const edgeTypes = relationTypes || Object.keys(this.schema.edgeTypes);

    try {
      const result = await session.run(`
        MATCH (n {id: $nodeId})-[r]->(related)
        WHERE type(r) IN $edgeTypes
        RETURN {
          id: related.id,
          name: related.name,
          type: labels(related)[0],
          relationshipType: type(r),
          mastery: related.mastery
        } as relatedConcept
        LIMIT 20
      `, { nodeId, edgeTypes });

      return result.records.map(r => r.get('relatedConcept'));
    } finally {
      await session.close();
    }
  }

  /**
   * Suggest next concepts to learn based on mastered prerequisites
   */
  async suggestNextConcepts(userId, limit = 5) {
    const session = this.neo4j.driver.session();

    try {
      const result = await session.run(`
        // Find concepts where all prerequisites are mastered
        MATCH (target)
        WHERE target.userId = $userId
          AND target.mastery < 0.3
        OPTIONAL MATCH (prereq)-[:PREREQUISITE]->(target)
        WITH target, collect(prereq) as prereqs
        WHERE all(p IN prereqs WHERE p.mastery >= 0.7) OR size(prereqs) = 0
        RETURN {
          id: target.id,
          name: target.name,
          type: labels(target)[0],
          difficulty: target.difficulty,
          prerequisitesMet: size(prereqs),
          readinessScore: CASE WHEN size(prereqs) = 0 THEN 1.0
                          ELSE avg([p IN prereqs | p.mastery]) END
        } as suggestion
        ORDER BY suggestion.readinessScore DESC, suggestion.difficulty ASC
        LIMIT $limit
      `, { userId, limit: parseInt(limit) });

      return result.records.map(r => r.get('suggestion'));
    } finally {
      await session.close();
    }
  }
}
```

---

## 7. Notification System

### 7.1 Notification Schema

```typescript
// src/commons/model/Notification.ts

export interface LearningNotification {
  id: string;
  userId: number;

  // Notification content
  type: NotificationType;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  message: string;

  // Visual
  icon?: string;
  color?: string;

  // Related entities
  planId?: string;
  topicId?: string;

  // Actions
  actionUrl?: string;
  actionLabel?: string;
  actions?: NotificationAction[];  // Multiple actions

  // Timing
  createdAt: string;
  scheduledFor?: string;  // Future notification
  expiresAt?: string;     // Auto-dismiss after this time

  // State
  status: 'pending' | 'delivered' | 'read' | 'actioned' | 'dismissed' | 'expired';
  readAt?: string;
  actionedAt?: string;

  // Persistence
  persistent: boolean;    // Stays until explicitly dismissed
  dismissible: boolean;
}

export enum NotificationType {
  // Learning reminders
  STUDY_REMINDER = 'study_reminder',
  STREAK_RISK = 'streak_risk',
  STREAK_ACHIEVED = 'streak_achieved',

  // Progress
  MILESTONE_APPROACHING = 'milestone_approaching',
  MILESTONE_REACHED = 'milestone_reached',
  BEHIND_SCHEDULE = 'behind_schedule',
  AHEAD_OF_SCHEDULE = 'ahead_of_schedule',

  // Adaptive
  PLAN_ADAPTED = 'plan_adapted',
  WEAKNESS_DETECTED = 'weakness_detected',
  IMPROVEMENT_NOTICED = 'improvement_noticed',

  // Content
  NEW_CONTENT_AVAILABLE = 'new_content_available',
  PRACTICE_SUGGESTED = 'practice_suggested',

  // System
  GOAL_DEADLINE = 'goal_deadline',
  INACTIVITY_WARNING = 'inactivity_warning'
}

export interface NotificationAction {
  label: string;
  action: string;  // Action identifier
  primary?: boolean;
}
```

### 7.2 Notification Manager

```javascript
// src/main/db/NotificationManager.js

class NotificationManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new notification
   */
  async create(notification) {
    const id = uuid();
    const stmt = this.db.prepare(`
      INSERT INTO learning_notification
      (id, user_id, type, priority, title, message, icon, color,
       plan_id, topic_id, action_url, action_label, actions,
       created_at, scheduled_for, expires_at, status, persistent, dismissible)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      notification.userId,
      notification.type,
      notification.priority,
      notification.title,
      notification.message,
      notification.icon || null,
      notification.color || null,
      notification.planId || null,
      notification.topicId || null,
      notification.actionUrl || null,
      notification.actionLabel || null,
      notification.actions ? JSON.stringify(notification.actions) : null,
      new Date().toISOString(),
      notification.scheduledFor || null,
      notification.expiresAt || null,
      notification.scheduledFor ? 'pending' : 'delivered',
      notification.persistent ? 1 : 0,
      notification.dismissible !== false ? 1 : 0
    );

    return { ...notification, id };
  }

  /**
   * Get active notifications for user (for display)
   */
  async getActive(userId, options = {}) {
    const { limit = 20, includeRead = false, types = null } = options;

    let query = `
      SELECT * FROM learning_notification
      WHERE user_id = ?
        AND status IN ('delivered', 'read')
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND (scheduled_for IS NULL OR scheduled_for <= datetime('now'))
    `;

    if (!includeRead) {
      query += ` AND status = 'delivered'`;
    }

    if (types && types.length > 0) {
      query += ` AND type IN (${types.map(() => '?').join(',')})`;
    }

    query += ` ORDER BY
      CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        ELSE 4
      END,
      created_at DESC
      LIMIT ?`;

    const params = types ? [userId, ...types, limit] : [userId, limit];
    const stmt = this.db.prepare(query);
    const results = stmt.all(...params);

    return results.map(this.deserialize);
  }

  /**
   * Get unread count
   */
  getUnreadCount(userId) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM learning_notification
      WHERE user_id = ?
        AND status = 'delivered'
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND (scheduled_for IS NULL OR scheduled_for <= datetime('now'))
    `);

    return stmt.get(userId).count;
  }

  /**
   * Mark as read
   */
  markRead(notificationId, userId) {
    const stmt = this.db.prepare(`
      UPDATE learning_notification
      SET status = 'read', read_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `);

    return stmt.run(notificationId, userId).changes > 0;
  }

  /**
   * Mark as actioned
   */
  markActioned(notificationId, userId, action) {
    const stmt = this.db.prepare(`
      UPDATE learning_notification
      SET status = 'actioned', actioned_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `);

    return stmt.run(notificationId, userId).changes > 0;
  }

  /**
   * Dismiss notification
   */
  dismiss(notificationId, userId) {
    const stmt = this.db.prepare(`
      UPDATE learning_notification
      SET status = 'dismissed'
      WHERE id = ? AND user_id = ? AND dismissible = 1
    `);

    return stmt.run(notificationId, userId).changes > 0;
  }

  /**
   * Process scheduled notifications (call periodically)
   */
  async processScheduled() {
    const stmt = this.db.prepare(`
      UPDATE learning_notification
      SET status = 'delivered'
      WHERE status = 'pending'
        AND scheduled_for <= datetime('now')
    `);

    return stmt.run().changes;
  }

  /**
   * Expire old notifications
   */
  async expireOld() {
    const stmt = this.db.prepare(`
      UPDATE learning_notification
      SET status = 'expired'
      WHERE status IN ('delivered', 'read')
        AND expires_at IS NOT NULL
        AND expires_at < datetime('now')
    `);

    return stmt.run().changes;
  }

  deserialize(row) {
    return {
      ...row,
      actions: row.actions ? JSON.parse(row.actions) : null,
      persistent: row.persistent === 1,
      dismissible: row.dismissible === 1
    };
  }
}
```

### 7.3 Notification UI Components

```javascript
// src/renderer/components/notifications/NotificationCenter.js

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadNotifications();

    // Poll for new notifications
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    const result = await notificationApi.getActive({ limit: 20 });
    setNotifications(result.notifications);
    setUnreadCount(result.unreadCount);
  };

  const handleAction = async (notification, action) => {
    await notificationApi.markActioned(notification.id, action);

    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }

    loadNotifications();
  };

  const handleDismiss = async (notificationId) => {
    await notificationApi.dismiss(notificationId);
    loadNotifications();
  };

  return (
    <>
      {/* Notification Bell in Nav */}
      <IconButton onClick={() => setIsOpen(true)}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      {/* Notification Panel */}
      <Drawer anchor="right" open={isOpen} onClose={() => setIsOpen(false)}>
        <Box sx={{ width: 360, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Notifications
          </Typography>

          {notifications.length === 0 ? (
            <EmptyState message="No notifications" />
          ) : (
            <List>
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onAction={handleAction}
                  onDismiss={handleDismiss}
                />
              ))}
            </List>
          )}
        </Box>
      </Drawer>
    </>
  );
};

const NotificationItem = ({ notification, onAction, onDismiss }) => {
  const priorityColors = {
    urgent: 'error.main',
    high: 'warning.main',
    normal: 'info.main',
    low: 'text.secondary'
  };

  const typeIcons = {
    study_reminder: <SchoolIcon />,
    streak_risk: <LocalFireDepartmentIcon color="warning" />,
    streak_achieved: <LocalFireDepartmentIcon color="success" />,
    milestone_reached: <EmojiEventsIcon color="primary" />,
    behind_schedule: <WarningIcon color="warning" />,
    weakness_detected: <TrendingDownIcon color="error" />,
    improvement_noticed: <TrendingUpIcon color="success" />
  };

  return (
    <ListItem
      sx={{
        bgcolor: notification.status === 'delivered' ? 'action.hover' : 'transparent',
        borderRadius: 1,
        mb: 1,
        flexDirection: 'column',
        alignItems: 'flex-start'
      }}
    >
      <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          {typeIcons[notification.type] || <NotificationsIcon />}
        </ListItemIcon>

        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {notification.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {notification.message}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {formatRelativeTime(notification.createdAt)}
          </Typography>
        </Box>

        {notification.dismissible && (
          <IconButton size="small" onClick={() => onDismiss(notification.id)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Actions */}
      {(notification.actionUrl || notification.actions) && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          {notification.actionUrl && (
            <Button
              size="small"
              variant="contained"
              onClick={() => onAction(notification, 'primary')}
            >
              {notification.actionLabel || 'View'}
            </Button>
          )}

          {notification.actions?.map((action, idx) => (
            <Button
              key={idx}
              size="small"
              variant={action.primary ? 'contained' : 'outlined'}
              onClick={() => onAction(notification, action.action)}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      )}
    </ListItem>
  );
};
```

### 7.4 Home Page Notification Widget

```javascript
// src/renderer/components/notifications/HomeNotificationWidget.js

const HomeNotificationWidget = () => {
  const [topNotifications, setTopNotifications] = useState([]);
  const [todaysLearning, setTodaysLearning] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [notifications, learning] = await Promise.all([
      notificationApi.getActive({ limit: 3, types: ['study_reminder', 'streak_risk', 'milestone_approaching'] }),
      learningApi.getTodaysSummary()
    ]);

    setTopNotifications(notifications.notifications);
    setTodaysLearning(learning);
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          📚 Your Learning Today
        </Typography>

        {/* Today's learning summary */}
        {todaysLearning && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'primary.50', borderRadius: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="h4" color="primary">
                  {todaysLearning.completedSessions}
                </Typography>
                <Typography variant="caption">Sessions</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="h4" color="success.main">
                  {todaysLearning.itemsReviewed}
                </Typography>
                <Typography variant="caption">Reviewed</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="h4" color="warning.main">
                  {todaysLearning.streakDays}🔥
                </Typography>
                <Typography variant="caption">Streak</Typography>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Priority notifications */}
        {topNotifications.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Needs Your Attention
            </Typography>
            {topNotifications.map(notification => (
              <Alert
                key={notification.id}
                severity={notification.priority === 'high' ? 'warning' : 'info'}
                sx={{ mb: 1 }}
                action={
                  notification.actionUrl && (
                    <Button
                      size="small"
                      onClick={() => navigate(notification.actionUrl)}
                    >
                      {notification.actionLabel || 'Go'}
                    </Button>
                  )
                }
              >
                <AlertTitle>{notification.title}</AlertTitle>
                {notification.message}
              </Alert>
            ))}
          </>
        )}

        {/* Quick actions */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => navigate('/learning/quick-session')}
          >
            Quick Study Session
          </Button>
          <Button
            variant="outlined"
            startIcon={<ListIcon />}
            onClick={() => navigate('/learning/plans')}
          >
            View All Plans
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};
```

---

## 8. Database Schema

### 8.1 New Tables

```sql
-- Learning Topics (user-created learning goals)
CREATE TABLE learning_topic (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  domain_type TEXT NOT NULL,  -- 'vocabulary', 'math', 'language', 'knowledge', 'skill'
  source_type TEXT,           -- 'book', 'url', 'manual', 'imported'
  source_id TEXT,
  target_date TEXT,
  daily_time_minutes INTEGER,
  difficulty TEXT,
  status TEXT DEFAULT 'planning',  -- 'planning', 'active', 'paused', 'completed', 'abandoned'
  progress_percent REAL DEFAULT 0,
  mastered_items INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_studied_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Learning Plans (AI-generated curricula)
CREATE TABLE learning_plan (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  plan_data TEXT NOT NULL,      -- JSON: phases, milestones, weekly structure, etc.
  current_phase INTEGER DEFAULT 1,
  current_day INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (topic_id) REFERENCES learning_topic(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Learning Sessions (individual study sessions)
CREATE TABLE learning_session (
  id TEXT PRIMARY KEY,
  plan_id TEXT,
  topic_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  session_type TEXT NOT NULL,   -- 'review', 'new_material', 'quiz', 'practice'
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_minutes INTEGER,
  items_reviewed INTEGER DEFAULT 0,
  items_correct INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  session_data TEXT,            -- JSON: detailed session metrics
  FOREIGN KEY (plan_id) REFERENCES learning_plan(id),
  FOREIGN KEY (topic_id) REFERENCES learning_topic(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Learner Profile (global + domain-specific)
CREATE TABLE learner_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  global_profile TEXT NOT NULL,   -- JSON: GlobalLearnerProfile
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Domain-specific profiles
CREATE TABLE learner_domain_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  domain_type TEXT NOT NULL,
  domain_name TEXT,
  profile_data TEXT NOT NULL,     -- JSON: DomainLearnerProfile
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(user_id, domain_type),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Notifications
CREATE TABLE learning_notification (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  plan_id TEXT,
  topic_id TEXT,
  action_url TEXT,
  action_label TEXT,
  actions TEXT,                   -- JSON array of actions
  created_at TEXT NOT NULL,
  scheduled_for TEXT,
  expires_at TEXT,
  status TEXT DEFAULT 'delivered',
  read_at TEXT,
  actioned_at TEXT,
  persistent INTEGER DEFAULT 0,
  dismissible INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES user(id),
  FOREIGN KEY (plan_id) REFERENCES learning_plan(id),
  FOREIGN KEY (topic_id) REFERENCES learning_topic(id)
);

-- Item performance tracking (domain-agnostic)
CREATE TABLE learning_item_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic_id TEXT NOT NULL,
  item_id TEXT NOT NULL,          -- Domain-specific item ID
  item_type TEXT NOT NULL,        -- 'word', 'concept', 'formula', etc.
  reviewed_at TEXT NOT NULL,
  was_correct INTEGER NOT NULL,
  response_time_ms INTEGER,
  confidence_level INTEGER,
  mistake_type TEXT,
  difficulty_rating INTEGER,
  mastery_before REAL,
  mastery_after REAL,
  session_id TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id),
  FOREIGN KEY (topic_id) REFERENCES learning_topic(id),
  FOREIGN KEY (session_id) REFERENCES learning_session(id)
);

-- Indexes for performance
CREATE INDEX idx_topic_user_status ON learning_topic(user_id, status);
CREATE INDEX idx_plan_topic ON learning_plan(topic_id);
CREATE INDEX idx_session_topic ON learning_session(topic_id, started_at);
CREATE INDEX idx_notification_user_status ON learning_notification(user_id, status);
CREATE INDEX idx_performance_item ON learning_item_performance(topic_id, item_id);
```

---

## 9. Skill Implementations

### 9.1 Skills Directory Structure

```
src/main/skills/
├── index.js                      # Main exports, registerDefaultSkills()
├── BaseSkill.js                  # Base class
├── SkillRegistry.js              # Registration
├── SkillExecutor.js              # Execution
├── ContextManager.js             # Context management
│
├── learning/                     # Learning companion skills
│   ├── index.js
│   ├── DomainDetectionSkill.js
│   ├── LearningPlanCreateSkill.js
│   ├── LearningPlanProgressSkill.js
│   ├── LearningPlanAdaptSkill.js
│   ├── LearningPlanRemindSkill.js
│   ├── LearningSessionSkill.js
│   └── LearningRecommendSkill.js
│
├── profile/                      # Learner profile skills
│   ├── index.js
│   ├── LearnerProfileUpdateSkill.js
│   ├── LearnerProfileAnalyzeSkill.js
│   └── LearnerProfileRecommendSkill.js
│
├── content/                      # Content generation skills
│   ├── index.js
│   ├── ContentGenerateQuizSkill.js
│   ├── ContentGenerateExplanationSkill.js
│   ├── ContentGeneratePracticeSkill.js
│   ├── ContentGenerateSummarySkill.js
│   └── ContentGenerateReviewSkill.js
│
├── domain/                       # Domain-specific skills
│   ├── index.js
│   ├── vocabulary/
│   │   ├── VocabularyDifficultySkill.js
│   │   ├── VocabularyContextSkill.js
│   │   └── VocabularyDrillSkill.js
│   ├── math/
│   │   ├── MathProblemGenSkill.js
│   │   └── MathExplanationSkill.js
│   ├── knowledge/
│   │   ├── ConceptExtractionSkill.js
│   │   └── RelationshipSkill.js
│   └── skill/
│       ├── ProjectGenSkill.js
│       └── CodeReviewSkill.js
│
└── notification/                 # Notification skills
    ├── index.js
    └── NotificationGenerateSkill.js
```

### 9.2 Skill Registration

```javascript
// src/main/skills/learning/index.js

const DomainDetectionSkill = require('./DomainDetectionSkill');
const LearningPlanCreateSkill = require('./LearningPlanCreateSkill');
const LearningPlanProgressSkill = require('./LearningPlanProgressSkill');
const LearningPlanAdaptSkill = require('./LearningPlanAdaptSkill');
const LearningPlanRemindSkill = require('./LearningPlanRemindSkill');
const LearningSessionSkill = require('./LearningSessionSkill');
const LearningRecommendSkill = require('./LearningRecommendSkill');

function registerLearningSkills(registry) {
  registry.register(DomainDetectionSkill);
  registry.register(LearningPlanCreateSkill);
  registry.register(LearningPlanProgressSkill);
  registry.register(LearningPlanAdaptSkill);
  registry.register(LearningPlanRemindSkill);
  registry.register(LearningSessionSkill);
  registry.register(LearningRecommendSkill);
}

module.exports = { registerLearningSkills };
```

---

## 10. UI Components

### 10.1 Learning Dashboard

```javascript
// src/renderer/views/learning/LearningDashboard.js

const LearningDashboard = () => {
  const [topics, setTopics] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const [topicsResult, recsResult] = await Promise.all([
      learningApi.getTopics({ status: 'active' }),
      skillApi.executeSkill('learner_profile_recommend', {
        recommendationType: 'next_action',
        context: { timeOfDay: getCurrentTimeOfDay(), availableMinutes: 30 }
      })
    ]);

    setTopics(topicsResult);
    setRecommendations(recsResult.result);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🎓 Learning Dashboard
      </Typography>

      {/* AI Recommendation Banner */}
      {recommendations && (
        <AIRecommendationBanner recommendation={recommendations} />
      )}

      {/* Active Topics Grid */}
      <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
        Active Learning Topics
      </Typography>
      <Grid container spacing={2}>
        {topics.map(topic => (
          <Grid item xs={12} md={6} lg={4} key={topic.id}>
            <LearningTopicCard topic={topic} />
          </Grid>
        ))}

        {/* Add New Topic Card */}
        <Grid item xs={12} md={6} lg={4}>
          <Card
            sx={{
              height: '100%',
              minHeight: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '2px dashed',
              borderColor: 'divider',
              '&:hover': { borderColor: 'primary.main' }
            }}
            onClick={() => setCreateDialogOpen(true)}
          >
            <Box sx={{ textAlign: 'center' }}>
              <AddIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography color="text.secondary">
                Start Learning Something New
              </Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Create Topic Dialog */}
      <CreateLearningTopicDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={loadDashboard}
      />
    </Box>
  );
};

const LearningTopicCard = ({ topic }) => {
  const domainColors = {
    vocabulary: '#4CAF50',
    math: '#2196F3',
    language: '#9C27B0',
    knowledge: '#FF9800',
    skill: '#F44336'
  };

  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      {/* Domain indicator */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          bgcolor: domainColors[topic.domainType]
        }}
      />

      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Chip
            label={topic.domainType}
            size="small"
            sx={{ bgcolor: alpha(domainColors[topic.domainType], 0.1) }}
          />
          {topic.streakDays > 0 && (
            <Chip
              label={`🔥 ${topic.streakDays}`}
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Box>

        <Typography variant="h6" gutterBottom>
          {topic.name}
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {topic.description}
        </Typography>

        {/* Progress bar */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption">Progress</Typography>
            <Typography variant="caption">
              {topic.masteredItems}/{topic.totalItems} items
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={topic.progressPercent}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* Last studied */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Last studied: {topic.lastStudiedAt ? formatRelativeTime(topic.lastStudiedAt) : 'Never'}
        </Typography>
      </CardContent>

      <CardActions>
        <Button
          size="small"
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={() => navigate(`/learning/${topic.id}/study`)}
        >
          Study Now
        </Button>
        <Button
          size="small"
          onClick={() => navigate(`/learning/${topic.id}`)}
        >
          Details
        </Button>
      </CardActions>
    </Card>
  );
};
```

### 10.2 Create Learning Topic Dialog

```javascript
// src/renderer/views/learning/CreateLearningTopicDialog.js

const CreateLearningTopicDialog = ({ open, onClose, onCreated }) => {
  const [step, setStep] = useState(1);
  const [isDetecting, setIsDetecting] = useState(false);
  const [formData, setFormData] = useState({
    goal: '',
    detectedDomain: null,
    topicName: '',
    dailyMinutes: 15,
    deadlineDate: '',
    difficulty: 'auto'
  });

  const handleGoalSubmit = async () => {
    setIsDetecting(true);

    const result = await skillApi.executeSkill('domain_detection', {
      learningGoal: formData.goal,
      context: {}
    });

    setFormData(prev => ({
      ...prev,
      detectedDomain: result.result,
      topicName: result.result.suggestedTopicName
    }));

    setIsDetecting(false);
    setStep(2);
  };

  const handleCreateTopic = async () => {
    const topic = await learningApi.createTopic({
      name: formData.topicName,
      description: formData.goal,
      domainType: formData.detectedDomain.detectedDomain,
      dailyTimeMinutes: formData.dailyMinutes,
      targetDate: formData.deadlineDate || null,
      difficulty: formData.difficulty
    });

    // Create initial plan
    await skillApi.executeSkill('learning_plan_create', {
      topicId: topic.id,
      userGoals: formData.goal,
      constraints: {
        dailyMinutes: formData.dailyMinutes,
        deadlineDate: formData.deadlineDate,
        difficultyPreference: formData.difficulty
      }
    });

    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {step === 1 && '🎯 What do you want to learn?'}
        {step === 2 && '📝 Customize Your Learning'}
        {step === 3 && '✨ Review Your Plan'}
      </DialogTitle>

      <DialogContent>
        {step === 1 && (
          <Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Describe your learning goal"
              placeholder="e.g., 'I want to master GRE vocabulary for my December exam' or 'Learn Python for data science'"
              value={formData.goal}
              onChange={e => setFormData(prev => ({ ...prev, goal: e.target.value }))}
              sx={{ mt: 2 }}
            />

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Be specific about what you want to achieve. The AI will analyze your goal and create a personalized plan.
            </Typography>
          </Box>
        )}

        {step === 2 && formData.detectedDomain && (
          <Box>
            {/* Detected domain */}
            <Alert severity="success" sx={{ mb: 2 }}>
              AI detected this as <strong>{formData.detectedDomain.detectedDomain}</strong> learning
              ({Math.round(formData.detectedDomain.confidence * 100)}% confidence)
            </Alert>

            <TextField
              fullWidth
              label="Topic Name"
              value={formData.topicName}
              onChange={e => setFormData(prev => ({ ...prev, topicName: e.target.value }))}
              sx={{ mb: 2 }}
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Daily study time (minutes)"
                  value={formData.dailyMinutes}
                  onChange={e => setFormData(prev => ({ ...prev, dailyMinutes: parseInt(e.target.value) }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Target completion date"
                  InputLabelProps={{ shrink: true }}
                  value={formData.deadlineDate}
                  onChange={e => setFormData(prev => ({ ...prev, deadlineDate: e.target.value }))}
                />
              </Grid>
            </Grid>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Difficulty Level</InputLabel>
              <Select
                value={formData.difficulty}
                onChange={e => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
              >
                <MenuItem value="auto">Let AI decide</MenuItem>
                <MenuItem value="beginner">Beginner</MenuItem>
                <MenuItem value="intermediate">Intermediate</MenuItem>
                <MenuItem value="advanced">Advanced</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {step > 1 && (
          <Button onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>

        {step === 1 && (
          <Button
            variant="contained"
            onClick={handleGoalSubmit}
            disabled={!formData.goal || isDetecting}
            startIcon={isDetecting ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
          >
            {isDetecting ? 'Analyzing...' : 'Analyze Goal'}
          </Button>
        )}

        {step === 2 && (
          <Button
            variant="contained"
            onClick={handleCreateTopic}
            startIcon={<CheckIcon />}
          >
            Create Learning Plan
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
```

---

## 11. Integration Points

### 11.1 Existing System Integration

| Existing System | Integration |
|-----------------|-------------|
| **Book Import** | Auto-create learning topic for imported book (domain: knowledge) |
| **Vocabulary** | Migrate to vocabulary domain with existing Leitner data |
| **Notes** | Link notes to learning topics, use for knowledge extraction |
| **Chat** | AI chat can create/query learning plans via skills |
| **Quiz** | Generated quizzes link to learning sessions |
| **Neo4j** | Each domain stores concepts in graph |

### 11.2 IPC Handlers

```javascript
// src/main/ipc/learningHandlers.js

function registerLearningHandlers(ipcMain, services) {
  const { skillExecutor, notificationManager, db } = services;

  // Topic CRUD
  ipcMain.handle('learning-topic-create', async (_, topicData, token) => {
    return await db.learningTopic.create(topicData, token);
  });

  ipcMain.handle('learning-topic-list', async (_, filters, token) => {
    return await db.learningTopic.list(filters, token);
  });

  ipcMain.handle('learning-topic-get', async (_, topicId, token) => {
    return await db.learningTopic.get(topicId, token);
  });

  // Plan operations
  ipcMain.handle('learning-plan-get', async (_, topicId, token) => {
    return await db.learningPlan.getByTopic(topicId, token);
  });

  ipcMain.handle('learning-plan-progress', async (_, planId, token) => {
    return await skillExecutor.execute('learning_plan_progress', {
      planId,
      action: 'check'
    }, { token });
  });

  ipcMain.handle('learning-plan-today', async (_, planId, token) => {
    return await skillExecutor.execute('learning_plan_progress', {
      planId,
      action: 'get_today'
    }, { token });
  });

  // Session operations
  ipcMain.handle('learning-session-start', async (_, topicId, sessionType, token) => {
    return await db.learningSession.start(topicId, sessionType, token);
  });

  ipcMain.handle('learning-session-complete', async (_, sessionId, sessionData, token) => {
    return await skillExecutor.execute('learning_plan_progress', {
      planId: sessionData.planId,
      action: 'complete_session',
      sessionData
    }, { token });
  });

  // Notifications
  ipcMain.handle('notifications-get-active', async (_, options, token) => {
    const notifications = await notificationManager.getActive(token.userId, options);
    const unreadCount = notificationManager.getUnreadCount(token.userId);
    return { notifications, unreadCount };
  });

  ipcMain.handle('notification-mark-read', async (_, notificationId, token) => {
    return notificationManager.markRead(notificationId, token.userId);
  });

  ipcMain.handle('notification-dismiss', async (_, notificationId, token) => {
    return notificationManager.dismiss(notificationId, token.userId);
  });

  // Profile
  ipcMain.handle('learner-profile-get', async (_, token) => {
    return await db.learnerProfile.get(token.userId);
  });

  ipcMain.handle('learner-profile-analyze', async (_, domainType, token) => {
    return await skillExecutor.execute('learner_profile_analyze', {
      domainType,
      analysisType: 'full'
    }, { token });
  });
}
```

### 11.3 Background Jobs

```javascript
// src/main/jobs/LearningJobs.js

class LearningJobs {
  constructor(services) {
    this.skillExecutor = services.skillExecutor;
    this.notificationManager = services.notificationManager;
  }

  /**
   * Run daily at user's preferred time
   */
  async dailyLearningCheck() {
    const activeUsers = await this.getActiveUsers();

    for (const userId of activeUsers) {
      // Generate study reminders
      await this.skillExecutor.execute('learning_plan_remind', {
        checkType: 'daily_check'
      }, { userId });

      // Process scheduled notifications
      await this.notificationManager.processScheduled();

      // Expire old notifications
      await this.notificationManager.expireOld();
    }
  }

  /**
   * Run hourly
   */
  async hourlyStreakCheck() {
    // Check for at-risk streaks
    await this.skillExecutor.execute('learning_plan_remind', {
      checkType: 'streak_risk'
    });
  }

  /**
   * Run weekly
   */
  async weeklyProgressAnalysis() {
    const activeUsers = await this.getActiveUsers();

    for (const userId of activeUsers) {
      // Analyze profile and detect patterns
      await this.skillExecutor.execute('learner_profile_analyze', {
        domainType: 'all',
        analysisType: 'full'
      }, { userId });

      // Adapt plans based on performance
      const plans = await this.getActivePlans(userId);
      for (const plan of plans) {
        await this.skillExecutor.execute('learning_plan_adapt', {
          planId: plan.id,
          adaptationType: 'performance_based'
        }, { userId });
      }
    }
  }
}
```

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema creation
- [ ] Domain type definitions
- [ ] Basic CRUD for learning topics
- [ ] Learner profile schema and storage

### Phase 2: Core Skills (Week 3-4)
- [ ] DomainDetectionSkill
- [ ] LearningPlanCreateSkill
- [ ] LearningPlanProgressSkill
- [ ] LearnerProfileUpdateSkill

### Phase 3: Content Generation (Week 5-6)
- [ ] ContentGenerateQuizSkill
- [ ] ContentGenerateExplanationSkill
- [ ] ContentGeneratePracticeSkill
- [ ] Domain-specific content generators

### Phase 4: Notifications (Week 7-8)
- [ ] NotificationManager
- [ ] NotificationCenter UI
- [ ] HomeNotificationWidget
- [ ] LearningPlanRemindSkill

### Phase 5: Graph Integration (Week 9-10)
- [ ] Per-domain graph schemas
- [ ] DomainGraphFeatures
- [ ] Learning path generation
- [ ] Weak concept detection

### Phase 6: Adaptive Learning (Week 11-12)
- [ ] LearningPlanAdaptSkill
- [ ] LearnerProfileAnalyzeSkill
- [ ] Performance-based interval adjustment
- [ ] Pattern detection

### Phase 7: UI & Integration (Week 13-14)
- [ ] LearningDashboard
- [ ] CreateLearningTopicDialog
- [ ] Learning session views
- [ ] Existing system integration (books, vocabulary, notes)

### Phase 8: Polish (Week 15-16)
- [ ] Background jobs
- [ ] Performance optimization
- [ ] User testing
- [ ] Documentation

---

## Summary

This AI Learning Companion Framework provides:

1. **Domain-Specialized Learning**: Predefined templates (vocabulary, math, language, knowledge, skill) with optimized strategies

2. **Persistent Learner Profile**: Global + per-domain profiles tracking mastery, velocity, patterns, weaknesses

3. **Skill-Based Intelligence**: All AI capabilities as composable skills (plan create, progress, adapt, remind, content generation)

4. **Proactive Notifications**: Persistent store with home page/nav bar integration for reminders, milestones, alerts

5. **Dynamic Content Generation**: Domain-aware quiz, explanation, practice generation based on learner state

6. **Knowledge Graph Per Domain**: Neo4j stores domain-specific concepts with relationships for learning paths

7. **Adaptive Plans**: AI continuously monitors and adjusts learning plans based on performance

This framework makes vocabulary learning just one instantiation of a generic, powerful learning system that can support any learning goal.
