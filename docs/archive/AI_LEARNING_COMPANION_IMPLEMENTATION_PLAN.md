# AI Learning Companion - Implementation Plan

## Overview

This document provides a detailed phase-by-phase implementation plan for the AI Learning Companion Framework. Each phase builds on the previous, with clear deliverables and dependencies.

**Total Estimated Duration**: 16 weeks
**Phases**: 8 phases

---

## Phase Summary

| Phase | Name | Duration | Key Deliverables |
|-------|------|----------|------------------|
| 1 | Foundation | 2 weeks | Database schema, domain types, basic models |
| 2 | Learner Profile | 2 weeks | Profile storage, update/analyze skills |
| 3 | Learning Plan Core | 2 weeks | Plan create, progress, session tracking |
| 4 | Content Generation | 2 weeks | Quiz, explanation, practice generation |
| 5 | Notification System | 2 weeks | Persistent store, UI, reminders |
| 6 | Knowledge Graph | 2 weeks | Per-domain schemas, learning paths |
| 7 | Adaptive Learning | 2 weeks | Plan adaptation, pattern detection |
| 8 | UI & Integration | 2 weeks | Dashboard, dialogs, existing system integration |

---

## Phase 1: Foundation (Week 1-2)

### Objective
Establish the core data structures, database schema, and domain type system.

### Tasks

#### 1.1 Database Schema
- [ ] **1.1.1** Create `learning_topic` table
  - Fields: id, user_id, name, description, domain_type, source_type, source_id, target_date, daily_time_minutes, difficulty, status, progress_percent, mastered_items, total_items, streak_days, last_studied_at, created_at, updated_at
  - Indexes on user_id, status, domain_type

- [ ] **1.1.2** Create `learning_plan` table
  - Fields: id, topic_id, user_id, plan_data (JSON), current_phase, current_day, status, started_at, completed_at, created_at, updated_at
  - Foreign keys to learning_topic

- [ ] **1.1.3** Create `learning_session` table
  - Fields: id, plan_id, topic_id, user_id, session_type, started_at, completed_at, duration_minutes, items_reviewed, items_correct, items_new, session_data (JSON)
  - Indexes on topic_id, started_at

- [ ] **1.1.4** Create `learning_item_performance` table
  - Fields: id, user_id, topic_id, item_id, item_type, reviewed_at, was_correct, response_time_ms, confidence_level, mistake_type, difficulty_rating, mastery_before, mastery_after, session_id
  - Indexes on topic_id, item_id

- [ ] **1.1.5** Update `db.sql` with new schema
- [ ] **1.1.6** Create migration script for existing databases

#### 1.2 Domain Type System
- [ ] **1.2.1** Create `src/commons/model/LearningDomains.ts`
  - Define `DomainType` enum (vocabulary, math, language, knowledge, skill)
  - Define `DomainTypeConfig` interface
  - Implement `DOMAIN_CONFIGS` object with all 5 domain configurations

- [ ] **1.2.2** Create domain-specific content types
  - Vocabulary: definition, example_sentence, etymology, synonym, antonym
  - Math: concept_explanation, formula, worked_example, practice_problem
  - Language: grammar_rule, reading_passage, writing_prompt, dialogue
  - Knowledge: concept, fact, relationship, summary, quote
  - Skill: tutorial, exercise, project, code_example, best_practice

- [ ] **1.2.3** Create domain-specific assessment methods per domain
- [ ] **1.2.4** Create domain-specific mastery criteria per domain

#### 1.3 Learning Topic Model
- [ ] **1.3.1** Create `src/commons/model/LearningTopic.ts`
  - Define `LearningTopic` interface
  - Define status enum (planning, active, paused, completed, abandoned)

- [ ] **1.3.2** Create `src/main/db/LearningTopicManager.js`
  - CRUD operations: create, get, getByUser, update, delete
  - Query methods: getActive, getByDomain, search

- [ ] **1.3.3** Create `src/main/db/LearningPlanManager.js`
  - CRUD operations: create, get, getByTopic, update
  - Progress methods: updateProgress, getProgress

- [ ] **1.3.4** Create `src/main/db/LearningSessionManager.js`
  - Session operations: start, complete, get, getByTopic

#### 1.4 IPC Handlers (Basic)
- [ ] **1.4.1** Create `src/main/ipc/learningHandlers.js`
  - Register handlers for topic CRUD
  - Register handlers for plan CRUD
  - Register handlers for session operations

- [ ] **1.4.2** Create `src/renderer/api/learningApi.js`
  - Wrapper methods for all IPC calls

#### 1.5 Tests
- [ ] **1.5.1** Create `src/__tests__/learning/LearningTopicManager.test.js`
- [ ] **1.5.2** Create `src/__tests__/learning/LearningPlanManager.test.js`
- [ ] **1.5.3** Create `src/__tests__/learning/LearningDomains.test.js`

### Deliverables
- Database schema ready
- Domain type system implemented
- Basic CRUD for topics, plans, sessions
- IPC layer for renderer communication

### Dependencies
- None (foundation phase)

---

## Phase 2: Learner Profile (Week 3-4)

### Objective
Implement the learner profile system with global and per-domain profiles.

### Tasks

#### 2.1 Profile Schema
- [ ] **2.1.1** Create `learner_profile` table
  - Fields: id, user_id, global_profile (JSON), created_at, updated_at
  - Unique constraint on user_id

- [ ] **2.1.2** Create `learner_domain_profile` table
  - Fields: id, user_id, domain_type, domain_name, profile_data (JSON), created_at, updated_at
  - Unique constraint on (user_id, domain_type)

#### 2.2 Profile Models
- [ ] **2.2.1** Create `src/commons/model/LearnerProfile.ts`
  - Define `LearnerProfile` interface
  - Define `GlobalLearnerProfile` interface
  - Define `DomainLearnerProfile` interface
  - Define `WeakArea` interface
  - Define `ConfusionPattern` interface

- [ ] **2.2.2** Create `src/main/db/LearnerProfileManager.js`
  - get(userId): Get or create profile
  - update(userId, updates): Update global profile
  - getDomainProfile(userId, domainType): Get domain profile
  - updateDomainProfile(userId, domainType, updates): Update domain profile

#### 2.3 Profile Skills
- [ ] **2.3.1** Create `src/main/skills/profile/` directory structure

- [ ] **2.3.2** Create `LearnerProfileUpdateSkill.js`
  - Parameters: activityType, domainType, topicId, activityData
  - Activity types: study_session, quiz_completed, content_viewed, goal_set, milestone_reached
  - Updates both global and domain profiles based on activity

- [ ] **2.3.3** Create `LearnerProfileAnalyzeSkill.js`
  - Parameters: domainType, analysisType
  - Analysis types: weakness_detection, pattern_recognition, velocity_analysis, full
  - Uses AI to analyze performance history and detect patterns
  - Returns: weakAreas, confusionPatterns, learningStyleInsights, velocityAnalysis

- [ ] **2.3.4** Create `LearnerProfileRecommendSkill.js`
  - Parameters: recommendationType, context
  - Recommendation types: next_action, study_schedule, content, difficulty_adjustment
  - Context: timeOfDay, availableMinutes, energyLevel, daysSinceLastStudy
  - Returns personalized recommendations

- [ ] **2.3.5** Create `src/main/skills/profile/index.js`
  - Export registerProfileSkills function

#### 2.4 Profile Integration
- [ ] **2.4.1** Add profile IPC handlers to `learningHandlers.js`
  - `learner-profile-get`: Get user's profile
  - `learner-profile-update`: Update profile (triggers skill)
  - `learner-profile-analyze`: Run analysis (triggers skill)
  - `learner-profile-recommend`: Get recommendations (triggers skill)

- [ ] **2.4.2** Add profile methods to `learningApi.js`

- [ ] **2.4.3** Initialize profile on first learning topic creation

#### 2.5 Tests
- [ ] **2.5.1** Create `src/__tests__/profile/LearnerProfileManager.test.js`
- [ ] **2.5.2** Create `src/__tests__/profile/LearnerProfileSkills.test.js`

### Deliverables
- Learner profile storage and retrieval
- Profile update skill (tracks learning activity)
- Profile analyze skill (detects patterns, weaknesses)
- Profile recommend skill (personalized suggestions)

### Dependencies
- Phase 1 complete

---

## Phase 3: Learning Plan Core (Week 5-6)

### Objective
Implement the core learning plan skills for creation, progress tracking, and session management.

### Tasks

#### 3.1 Learning Skills Directory
- [ ] **3.1.1** Create `src/main/skills/learning/` directory structure

#### 3.2 Domain Detection Skill
- [ ] **3.2.1** Create `DomainDetectionSkill.js`
  - Parameters: learningGoal, context (optional: bookTitle, sourceType)
  - Uses AI to analyze goal and determine domain type
  - Returns: detectedDomain, confidence, reasoning, suggestedTopicName, initialAssessmentNeeded, estimatedScope, prerequisites

#### 3.3 Learning Plan Create Skill
- [ ] **3.3.1** Create `LearningPlanCreateSkill.js`
  - Parameters: topicId, userGoals, constraints (dailyMinutes, deadlineDate, difficultyPreference), existingKnowledge
  - Fetches: topic, domain config, learner profile, content inventory
  - Uses AI to generate comprehensive plan with:
    - Phases with focus areas and daily goals
    - Weekly structure (study days, review days, rest days)
    - Milestones with criteria
    - Adaptation rules
    - Content sequence
  - Creates plan entity and initializes first day's content

#### 3.4 Learning Plan Progress Skill
- [ ] **3.4.1** Create `LearningPlanProgressSkill.js`
  - Parameters: planId, action (check, complete_session, skip_day, get_today), sessionData
  - Actions:
    - `check`: Calculate progress, analyze status, get next milestone
    - `complete_session`: Record session, update profile, check goals, apply adaptations
    - `skip_day`: Handle missed day, adjust plan
    - `get_today`: Generate today's learning content

- [ ] **3.4.2** Implement progress calculation
  - percentComplete, itemsMastered, onTrack, daysAhead, streakDays

- [ ] **3.4.3** Implement session recording
  - Store session data, update profile via skill, check daily goals

- [ ] **3.4.4** Implement today's content generation
  - Based on plan phase, learner profile, due items

#### 3.5 Learning Session Skill
- [ ] **3.5.1** Create `LearningSessionSkill.js`
  - Parameters: topicId, sessionType (review, new_material, quiz, practice, mixed)
  - Generates session content based on type and learner state
  - Returns: items to study, estimated time, focus areas

#### 3.6 Integration
- [ ] **3.6.1** Create `src/main/skills/learning/index.js`
  - Export registerLearningSkills function

- [ ] **3.6.2** Update `learningHandlers.js`
  - `learning-plan-create`: Trigger plan creation skill
  - `learning-plan-progress`: Trigger progress skill
  - `learning-plan-today`: Get today's content
  - `learning-session-generate`: Generate session content

- [ ] **3.6.3** Update `learningApi.js` with new methods

#### 3.7 Tests
- [ ] **3.7.1** Create `src/__tests__/learning/DomainDetectionSkill.test.js`
- [ ] **3.7.2** Create `src/__tests__/learning/LearningPlanCreateSkill.test.js`
- [ ] **3.7.3** Create `src/__tests__/learning/LearningPlanProgressSkill.test.js`

### Deliverables
- Domain detection from learning goal
- AI-generated learning plans
- Progress tracking and session completion
- Today's learning content generation

### Dependencies
- Phase 1 & 2 complete

---

## Phase 4: Content Generation (Week 7-8)

### Objective
Implement domain-aware content generation skills for quizzes, explanations, and practice.

### Tasks

#### 4.1 Content Skills Directory
- [ ] **4.1.1** Create `src/main/skills/content/` directory structure

#### 4.2 Quiz Generation Skill
- [ ] **4.2.1** Create `ContentGenerateQuizSkill.js`
  - Parameters: topicId, items, quizType (recall, application, mixed, weakness_focused), difficulty, questionCount
  - Domain-specific question types:
    - Vocabulary: definition recall, fill blank, usage sentence, synonym matching
    - Math: problem solving, concept application, formula recall
    - Knowledge: fact recall, relationship identification, application scenario
    - Skill: code output prediction, debug exercise, implementation choice
  - Emphasizes weak areas from learner profile
  - Returns: quiz object with questions, options, answers, explanations

#### 4.3 Explanation Generation Skill
- [ ] **4.3.1** Create `ContentGenerateExplanationSkill.js`
  - Parameters: itemId, itemContent, reason (first_time, incorrect_answer, requested, confusion), previousAttempts
  - Adapts to learning style (visual, auditory, reading, kinesthetic)
  - Addresses misconceptions from wrong answers
  - Returns: mainExplanation, visualAid, analogy, keyPoints, commonMistakes, memoryTip, practicePrompt

#### 4.4 Practice Generation Skill
- [ ] **4.4.1** Create `ContentGeneratePracticeSkill.js`
  - Parameters: topicId, focusArea, difficulty, practiceType (drill, application, mixed, challenge), count
  - Domain-specific practice types:
    - Vocabulary: sentence completion, word usage, error correction
    - Math: computational, word problems, multi-step solutions
    - Language: grammar exercises, translation, composition
    - Knowledge: concept application, case studies, critical thinking
    - Skill: code challenges, implementation, debug scenarios
  - Returns: practice problems with solutions and hints

#### 4.5 Summary Generation Skill
- [ ] **4.5.1** Create `ContentGenerateSummarySkill.js`
  - Parameters: topicId, summaryType (daily, weekly, milestone, topic_complete)
  - Generates progress summaries with:
    - Items learned/reviewed
    - Accuracy metrics
    - Improvement areas
    - Achievements
    - Next steps

#### 4.6 Review Session Generation Skill
- [ ] **4.6.1** Create `ContentGenerateReviewSkill.js`
  - Parameters: topicId, availableMinutes, reviewType (spaced_repetition, weakness_focus, mixed)
  - Selects items based on forgetting curve and performance
  - Mixes difficulty levels
  - Returns: ordered review items with estimated time

#### 4.7 Integration
- [ ] **4.7.1** Create `src/main/skills/content/index.js`
  - Export registerContentSkills function

- [ ] **4.7.2** Update `learningHandlers.js`
  - `content-generate-quiz`: Generate quiz
  - `content-generate-explanation`: Generate explanation
  - `content-generate-practice`: Generate practice
  - `content-generate-summary`: Generate summary
  - `content-generate-review`: Generate review session

- [ ] **4.7.3** Update `learningApi.js`

#### 4.8 Tests
- [ ] **4.8.1** Create `src/__tests__/content/ContentGenerateQuizSkill.test.js`
- [ ] **4.8.2** Create `src/__tests__/content/ContentGenerateExplanationSkill.test.js`
- [ ] **4.8.3** Create `src/__tests__/content/ContentGeneratePracticeSkill.test.js`

### Deliverables
- Domain-aware quiz generation
- Adaptive explanation generation
- Targeted practice generation
- Progress summary generation
- Spaced repetition review generation

### Dependencies
- Phase 1, 2, 3 complete

---

## Phase 5: Notification System (Week 9-10)

### Objective
Implement the persistent notification system with UI integration.

### Tasks

#### 5.1 Notification Schema
- [ ] **5.1.1** Create `learning_notification` table
  - Fields: id, user_id, type, priority, title, message, icon, color, plan_id, topic_id, action_url, action_label, actions (JSON), created_at, scheduled_for, expires_at, status, read_at, actioned_at, persistent, dismissible
  - Indexes on user_id, status, scheduled_for

#### 5.2 Notification Model
- [ ] **5.2.1** Create `src/commons/model/Notification.ts`
  - Define `LearningNotification` interface
  - Define `NotificationType` enum (study_reminder, streak_risk, streak_achieved, milestone_approaching, milestone_reached, behind_schedule, plan_adapted, weakness_detected, improvement_noticed, etc.)
  - Define `NotificationAction` interface

#### 5.3 Notification Manager
- [ ] **5.3.1** Create `src/main/db/NotificationManager.js`
  - `create(notification)`: Create new notification
  - `getActive(userId, options)`: Get active notifications with filtering
  - `getUnreadCount(userId)`: Count unread notifications
  - `markRead(notificationId, userId)`: Mark as read
  - `markActioned(notificationId, userId, action)`: Mark as actioned
  - `dismiss(notificationId, userId)`: Dismiss notification
  - `processScheduled()`: Process scheduled notifications (for cron)
  - `expireOld()`: Expire old notifications (for cron)

#### 5.4 Notification Reminder Skill
- [ ] **5.4.1** Create `src/main/skills/notification/NotificationGenerateSkill.js`
  - Parameters: checkType (scheduled, daily_check, streak_risk, milestone_approaching)
  - Generates contextual notifications based on:
    - Learning plan progress
    - Streak status
    - Upcoming milestones
    - Behind schedule detection
  - Uses AI for personalized reminder messages

- [ ] **5.4.2** Update `LearningPlanRemindSkill.js` (from Phase 3)
  - Integrate with NotificationManager
  - Generate and store notifications

#### 5.5 IPC Handlers
- [ ] **5.5.1** Add notification handlers to `learningHandlers.js`
  - `notifications-get-active`: Get active notifications
  - `notifications-get-unread-count`: Get unread count
  - `notification-mark-read`: Mark as read
  - `notification-mark-actioned`: Mark as actioned
  - `notification-dismiss`: Dismiss notification

- [ ] **5.5.2** Create `src/renderer/api/notificationApi.js`

#### 5.6 UI Components
- [ ] **5.6.1** Create `src/renderer/components/notifications/NotificationCenter.js`
  - Notification bell icon with badge in nav bar
  - Drawer with notification list
  - Read/dismiss/action functionality
  - Poll for new notifications

- [ ] **5.6.2** Create `src/renderer/components/notifications/NotificationItem.js`
  - Display notification with type icon
  - Priority-based styling
  - Action buttons
  - Timestamp

- [ ] **5.6.3** Create `src/renderer/components/notifications/HomeNotificationWidget.js`
  - Today's learning summary
  - Priority notifications (3 most important)
  - Quick action buttons

- [ ] **5.6.4** Integrate NotificationCenter into `RightCollapsibleLayout.js` or `root.jsx`

#### 5.7 Background Processing
- [ ] **5.7.1** Create `src/main/jobs/NotificationJobs.js`
  - `processScheduled()`: Run every minute
  - `expireOld()`: Run every hour
  - `dailyReminderCheck()`: Run daily

- [ ] **5.7.2** Integrate with main.ts startup
  - Schedule notification jobs

#### 5.8 Tests
- [ ] **5.8.1** Create `src/__tests__/notification/NotificationManager.test.js`
- [ ] **5.8.2** Create `src/__tests__/notification/NotificationGenerateSkill.test.js`

### Deliverables
- Persistent notification storage
- Notification CRUD operations
- Reminder generation skill
- NotificationCenter UI component
- Home page notification widget
- Background job processing

### Dependencies
- Phase 1, 2, 3 complete

---

## Phase 6: Knowledge Graph (Week 11-12)

### Objective
Implement per-domain knowledge graph schemas and learning path generation in Neo4j.

### Tasks

#### 6.1 Graph Schema
- [ ] **6.1.1** Create `src/commons/model/DomainGraphSchema.ts`
  - Define node types per domain
  - Define edge types per domain
  - Define property schemas

- [ ] **6.1.2** Extend `src/commons/model/GraphSchema.ts`
  - Add DOMAIN_GRAPH_SCHEMAS export

#### 6.2 Domain Graph Features
- [ ] **6.2.1** Create `src/main/utils/DomainGraphFeatures.js`
  - Constructor: neo4jAdapter, domainType
  - `getLearningPath(targetNodeId, userId)`: Get prerequisite path
  - `findWeakConcepts(userId, limit)`: Find struggling concepts
  - `getRelatedConcepts(nodeId, relationTypes)`: Get related items
  - `suggestNextConcepts(userId, limit)`: Suggest next items to learn
  - `getConceptClusters(userId)`: Get related concept clusters

#### 6.3 Graph Sync
- [ ] **6.3.1** Create `src/main/utils/LearningGraphSync.js`
  - `syncTopicToGraph(topic, userId)`: Create topic node
  - `syncItemToGraph(item, topicId, userId)`: Create item node
  - `syncPerformanceToGraph(performance, userId)`: Update mastery
  - `generateRelationships(item, domain)`: AI-generate relationships
  - `linkToExistingConcepts(item, userId)`: Link to existing concepts

- [ ] **6.3.2** Integrate sync into LearningPlanProgressSkill
  - Sync items after session completion
  - Update mastery scores in graph

#### 6.4 Learning Path Skill
- [ ] **6.4.1** Create `src/main/skills/learning/LearningPathSkill.js`
  - Parameters: targetItemId, topicId
  - Uses DomainGraphFeatures to get path
  - Returns: ordered list of prerequisites to learn first

#### 6.5 Weak Concept Skill
- [ ] **6.5.1** Create `src/main/skills/learning/WeakConceptSkill.js`
  - Parameters: topicId, limit
  - Uses DomainGraphFeatures to find weak concepts
  - Returns: weak concepts with weakness scores and recommendations

#### 6.6 IPC Handlers
- [ ] **6.6.1** Add graph handlers to `learningHandlers.js`
  - `learning-graph-path`: Get learning path
  - `learning-graph-weak`: Get weak concepts
  - `learning-graph-related`: Get related concepts
  - `learning-graph-next`: Get suggested next items

#### 6.7 Tests
- [ ] **6.7.1** Create `src/__tests__/graph/DomainGraphFeatures.test.js`
- [ ] **6.7.2** Create `src/__tests__/graph/LearningGraphSync.test.js`

### Deliverables
- Per-domain graph schemas
- Graph sync for learning items
- Learning path generation
- Weak concept detection
- Related concept queries

### Dependencies
- Phase 1, 2, 3 complete
- Neo4j configured

---

## Phase 7: Adaptive Learning (Week 13-14)

### Objective
Implement plan adaptation based on performance and advanced pattern detection.

### Tasks

#### 7.1 Plan Adaptation Skill
- [ ] **7.1.1** Create/Update `LearningPlanAdaptSkill.js`
  - Parameters: planId, adaptationType (performance_based, schedule_change, goal_change, ai_recommendation), adaptationData
  - Adaptation types:
    - `performance_based`: Analyze recent performance, adjust pace/difficulty
    - `schedule_change`: User changed available time, reschedule
    - `goal_change`: User changed goal/deadline, replanning
    - `ai_recommendation`: Proactive AI suggestions
  - Apply adaptations and notify user

- [ ] **7.1.2** Implement adaptation rules engine
  - Check predefined rules from plan (accuracy thresholds, etc.)
  - Generate adaptations when rules trigger

#### 7.2 Pattern Detection
- [ ] **7.2.1** Enhance `LearnerProfileAnalyzeSkill.js`
  - Add confusion pattern detection (items confused together)
  - Add learning speed patterns (fast/slow for different types)
  - Add error type analysis (spelling, meaning, application)
  - Add time-based patterns (performance by time of day)

- [ ] **7.2.2** Create `src/main/skills/learning/PatternDetectionSkill.js`
  - Parameters: topicId, detectionType (confusion, velocity, error_type, comprehensive)
  - Returns: detailed pattern analysis with recommendations

#### 7.3 Difficulty Adjustment
- [ ] **7.3.1** Create `src/main/skills/learning/DifficultyAdjustmentSkill.js`
  - Parameters: topicId, itemId (optional)
  - Analyzes performance to recommend difficulty changes
  - Can adjust per-item or topic-wide

- [ ] **7.3.2** Implement adaptive spacing
  - Adjust review intervals based on individual forgetting curves
  - Store per-item interval multipliers

#### 7.4 Progress Prediction
- [ ] **7.4.1** Create `src/main/skills/learning/ProgressPredictionSkill.js`
  - Parameters: topicId
  - Predicts:
    - Estimated mastery date
    - Days to complete
    - Risk areas
    - Confidence level
  - Uses performance history and velocity analysis

#### 7.5 Weekly Analysis Job
- [ ] **7.5.1** Create `src/main/jobs/LearningAnalysisJob.js`
  - Run weekly for each active user
  - Analyze all active topics
  - Detect patterns
  - Generate adaptations
  - Create insight notifications

- [ ] **7.5.2** Integrate with main.ts startup

#### 7.6 Tests
- [ ] **7.6.1** Create `src/__tests__/learning/LearningPlanAdaptSkill.test.js`
- [ ] **7.6.2** Create `src/__tests__/learning/PatternDetectionSkill.test.js`
- [ ] **7.6.3** Create `src/__tests__/learning/ProgressPredictionSkill.test.js`

### Deliverables
- Plan adaptation skill with multiple adaptation types
- Pattern detection (confusion, velocity, error types)
- Difficulty adjustment
- Progress prediction
- Weekly analysis background job

### Dependencies
- Phase 1-6 complete

---

## Phase 8: UI & Integration (Week 15-16)

### Objective
Build the user interface and integrate with existing SmartReader systems.

### Tasks

#### 8.1 Learning Dashboard
- [ ] **8.1.1** Create `src/renderer/views/learning/LearningDashboard.js`
  - AI recommendation banner
  - Active topics grid with progress cards
  - Add new topic card
  - Quick study session button

- [ ] **8.1.2** Create `src/renderer/views/learning/LearningTopicCard.js`
  - Domain indicator (color-coded)
  - Progress bar
  - Streak indicator
  - Study now / details buttons

#### 8.2 Create Topic Flow
- [ ] **8.2.1** Create `src/renderer/views/learning/CreateLearningTopicDialog.js`
  - Step 1: Enter learning goal
  - AI analyzes and detects domain
  - Step 2: Customize (name, daily time, deadline, difficulty)
  - Step 3: Review and create

- [ ] **8.2.2** Integrate domain detection UI feedback
- [ ] **8.2.3** Show AI-generated plan preview

#### 8.3 Topic Detail View
- [ ] **8.3.1** Create `src/renderer/views/learning/LearningTopicView.js`
  - Topic header with stats
  - Progress overview
  - Current phase info
  - Today's plan
  - Milestone timeline

- [ ] **8.3.2** Create `src/renderer/views/learning/LearningProgressChart.js`
  - Visual progress over time
  - Accuracy trend
  - Items mastered vs target

#### 8.4 Study Session View
- [ ] **8.4.1** Create `src/renderer/views/learning/StudySessionView.js`
  - Session type indicator
  - Item display (domain-specific)
  - Response input
  - Feedback display
  - Progress within session

- [ ] **8.4.2** Create domain-specific item renderers
  - Vocabulary item renderer
  - Math item renderer
  - Knowledge item renderer
  - Skill item renderer

- [ ] **8.4.3** Create confidence selector component
- [ ] **8.4.4** Create session completion summary

#### 8.5 Existing System Integration
- [ ] **8.5.1** Book Import Integration
  - When book imported, offer to create learning topic
  - Domain: knowledge
  - Extract concepts as learning items

- [ ] **8.5.2** Vocabulary Migration
  - Migrate existing vocabulary to vocabulary domain learning topic
  - Preserve Leitner box/progress data
  - Map to new performance tracking

- [ ] **8.5.3** Notes Integration
  - Link notes to learning topics
  - Use notes for knowledge extraction
  - Show related notes in topic view

- [ ] **8.5.4** Quiz Integration
  - Generated quizzes link to learning sessions
  - Quiz results update performance tracking

#### 8.6 Navigation
- [ ] **8.6.1** Add Learning Dashboard to sidebar navigation
- [ ] **8.6.2** Add routes to `routes/index.jsx`
  - `/learning` - Dashboard
  - `/learning/:topicId` - Topic detail
  - `/learning/:topicId/study` - Study session
  - `/learning/:topicId/progress` - Progress view

#### 8.7 Home Page Integration
- [ ] **8.7.1** Add HomeNotificationWidget to home page
- [ ] **8.7.2** Add learning summary to home page

#### 8.8 Tests
- [ ] **8.8.1** Create UI component tests (basic rendering)
- [ ] **8.8.2** Create integration tests for main flows

### Deliverables
- Complete Learning Dashboard UI
- Topic creation flow
- Study session experience
- Integration with books, vocabulary, notes, quizzes
- Navigation and routing

### Dependencies
- Phase 1-7 complete

---

## Post-Implementation

### Documentation
- [ ] Update CLAUDE.md with new learning system documentation
- [ ] Create user guide for learning features
- [ ] Document API for skill extensions

### Performance Optimization
- [ ] Profile database queries
- [ ] Optimize AI calls (caching, batching)
- [ ] Lazy load components

### User Testing
- [ ] Internal testing
- [ ] Gather feedback
- [ ] Iterate on UX

---

## Task Summary by Phase

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Foundation | 18 tasks | 40 hrs |
| Phase 2: Learner Profile | 14 tasks | 32 hrs |
| Phase 3: Learning Plan Core | 18 tasks | 48 hrs |
| Phase 4: Content Generation | 18 tasks | 40 hrs |
| Phase 5: Notification System | 18 tasks | 40 hrs |
| Phase 6: Knowledge Graph | 14 tasks | 32 hrs |
| Phase 7: Adaptive Learning | 14 tasks | 32 hrs |
| Phase 8: UI & Integration | 20 tasks | 48 hrs |
| **Total** | **134 tasks** | **312 hrs** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI response quality | Implement fallbacks, prompt iteration, validation |
| Performance with large data | Pagination, indexing, caching |
| Neo4j integration complexity | Graceful degradation if Neo4j unavailable |
| UI complexity | Component library, design system |
| Migration of existing data | Careful migration scripts, backup first |

---

## Success Criteria

### Phase Completion Criteria
- All tasks completed
- Tests passing
- No critical bugs
- Documentation updated

### Final Success Criteria
- User can create learning topic from goal
- AI generates appropriate learning plan
- Progress tracking works
- Notifications delivered
- Knowledge graph populated
- Adaptive learning functioning
- UI intuitive and responsive
- Existing features still work
