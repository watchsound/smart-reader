/**
 * LearningPatterns.ts
 *
 * Type definitions for learning patterns detected by the AI Learning Brain.
 * These patterns are inferred from episodic memory and used to build learner profiles.
 */

import { DomainType } from './LearningDomains';

// =============================================================================
// TEMPORAL PATTERNS - Time-based learning behaviors
// =============================================================================

/**
 * Optimal study time analysis
 */
export interface OptimalTimePattern {
  type: 'OPTIMAL_TIME';
  hourOfDay: number; // 0-23
  dayOfWeek?: number; // 0-6 (Sunday = 0)
  avgAccuracy: number; // 0-1
  avgFocusScore: number; // 0-100
  sessionCount: number; // Number of sessions analyzed
  confidence: number; // 0-1, based on sample size
}

/**
 * Session duration effectiveness
 */
export interface SessionDurationPattern {
  type: 'SESSION_DURATION';
  optimalMinutes: number;
  preference: 'short' | 'medium' | 'long';
  accuracyByDuration: {
    short: number; // <= 10 min
    medium: number; // 10-25 min
    long: number; // > 25 min
  };
  focusDecayPoint: number; // Minutes after which focus drops
}

/**
 * Learning velocity over time
 */
export interface VelocityTrendPattern {
  type: 'VELOCITY_TREND';
  domainType: DomainType;
  trend: 'accelerating' | 'stable' | 'decelerating';
  currentVelocity: number; // Items mastered per session
  velocityHistory: Array<{
    date: string;
    velocity: number;
  }>;
  projectedMasteryDate?: string; // For current learning plan
}

/**
 * Cramming behavior detection
 */
export interface CrammingPattern {
  type: 'CRAMMING';
  detectedAt: string; // ISO timestamp
  conceptId: string;
  conceptName: string;
  reviewCount: number; // Reviews in short period
  periodMinutes: number; // Duration of cramming
  effectivenessScore: number; // 0-1, how effective was the cramming
  recommendation: string;
}

/**
 * Review spacing compliance
 */
export interface SpacingPattern {
  type: 'SPACING';
  complianceRate: number; // 0-1, how often user reviews on schedule
  avgDaysEarly: number;
  avgDaysLate: number;
  optimalInterval: number; // Calculated optimal interval for this user
  forgettingCurveSlope: number; // Lower = better retention
}

// =============================================================================
// PERFORMANCE PATTERNS - How the user performs during learning
// =============================================================================

/**
 * Struggle chain - sequence of attempts before mastery
 */
export interface StrugglePattern {
  type: 'STRUGGLE';
  conceptId: string;
  conceptName: string;
  attemptsToSuccess: number;
  hintsUsed: number;
  avgResponseTimeMs: number;
  resolution: 'mastered' | 'abandoned' | 'in_progress';
  mistakeSequence: Array<{
    attemptNumber: number;
    wasCorrect: boolean;
    mistakeType?: MistakeType;
    hintUsed: boolean;
  }>;
}

/**
 * Response time distribution analysis
 */
export interface ResponseTimePattern {
  type: 'RESPONSE_TIME';
  avgResponseTimeMs: number;
  distribution: {
    fast: { count: number; accuracy: number }; // < 2s
    medium: { count: number; accuracy: number }; // 2-10s
    slow: { count: number; accuracy: number }; // > 10s
  };
  optimalTimeRange: { min: number; max: number }; // Best accuracy range
  insight: string;
}

/**
 * Confidence calibration - self-assessment vs reality
 */
export interface ConfidenceCalibrationPattern {
  type: 'CONFIDENCE_CALIBRATION';
  calibrationScore: number; // 0-1, 1 = perfectly calibrated
  tendancy: 'overconfident' | 'underconfident' | 'calibrated';
  byConfidenceLevel: Record<
    1 | 2 | 3 | 4 | 5,
    { count: number; actualAccuracy: number }
  >;
  recommendation: string;
}

/**
 * Mistake type clustering
 */
export interface MistakeClusterPattern {
  type: 'MISTAKE_CLUSTER';
  primaryMistakeType: MistakeType;
  distribution: Record<MistakeType, number>; // Percentage
  conceptsAffected: string[];
  recommendation: string;
}

/**
 * Hint usage trend
 */
export interface HintUsagePattern {
  type: 'HINT_USAGE';
  overallRate: number; // 0-1
  trendDirection: 'increasing' | 'stable' | 'decreasing';
  byDomain: Record<DomainType, number>;
  dependencyLevel: 'high' | 'moderate' | 'low' | 'independent';
}

// =============================================================================
// CROSS-CONCEPT PATTERNS - Relationships between concepts
// =============================================================================

/**
 * Prerequisite relationship between concepts
 */
export interface PrerequisitePattern {
  type: 'PREREQUISITE';
  fromConceptId: string;
  fromConceptName: string;
  toConceptId: string;
  toConceptName: string;
  confidence: number; // 0-1
  evidenceType: 'temporal' | 'performance' | 'explicit';
  performanceImpact: number; // How much B improved after A mastered
  insight: string;
}

/**
 * Interference between concepts
 */
export interface InterferencePattern {
  type: 'INTERFERENCE';
  conceptAId: string;
  conceptAName: string;
  conceptBId: string;
  conceptBName: string;
  severity: number; // 0-1
  direction: 'bidirectional' | 'a_affects_b' | 'b_affects_a';
  recommendedGap: number; // Hours between studying
  insight: string;
}

/**
 * Positive transfer between concepts
 */
export interface PositiveTransferPattern {
  type: 'POSITIVE_TRANSFER';
  conceptAId: string;
  conceptAName: string;
  conceptBId: string;
  conceptBName: string;
  correlation: number; // 0-1
  direction: 'bidirectional' | 'a_helps_b' | 'b_helps_a';
  insight: string;
}

/**
 * Concepts that cluster together in learning
 */
export interface ConceptClusterPattern {
  type: 'CONCEPT_CLUSTER';
  conceptIds: string[];
  conceptNames: string[];
  coStudyFrequency: number; // Times studied in same session
  sharedDomain: DomainType | null;
  suggestedGrouping: boolean;
  insight: string;
}

/**
 * Forgetting correlation - items that decay together
 */
export interface ForgettingCorrelationPattern {
  type: 'FORGETTING_CORRELATION';
  conceptIds: string[];
  conceptNames: string[];
  correlationScore: number; // 0-1
  suggestedReviewStrategy: 'together' | 'staggered' | 'independent';
  insight: string;
}

// =============================================================================
// BEHAVIORAL PATTERNS - User behavior and preferences
// =============================================================================

/**
 * Session start triggers
 */
export interface SessionTriggerPattern {
  type: 'SESSION_TRIGGER';
  triggers: Array<{
    context: string; // 'after_reading', 'scheduled', 'notification', etc.
    frequency: number; // 0-1
    successRate: number; // Sessions that complete successfully
  }>;
  bestTrigger: string;
  recommendation: string;
}

/**
 * Quit signals - what causes early session end
 */
export interface QuitSignalPattern {
  type: 'QUIT_SIGNAL';
  signals: Array<{
    trigger: string; // 'low_accuracy', 'fatigue', 'time_constraint', etc.
    frequency: number;
    avgSessionProgress: number; // 0-1, how far into session
  }>;
  primaryQuitReason: string;
  recommendation: string;
}

/**
 * Content engagement preferences
 */
export interface ContentPreferencePattern {
  type: 'CONTENT_PREFERENCE';
  preferences: Record<
    string,
    {
      engagementTime: number; // Average minutes
      accuracy: number;
      preference: 'high' | 'medium' | 'low';
    }
  >;
  strongPreferences: string[];
  avoidances: string[];
}

/**
 * Pace preferences
 */
export interface PacePreferencePattern {
  type: 'PACE_PREFERENCE';
  avgItemsPerSession: number;
  preferredPace: 'burst' | 'steady' | 'marathon';
  optimalBatchSize: number;
  breakFrequency: number; // Items before natural break
}

/**
 * Goal orientation
 */
export interface GoalOrientationPattern {
  type: 'GOAL_ORIENTATION';
  dailyGoalCompletionRate: number;
  weeklyGoalCompletionRate: number;
  stretchGoalAcceptance: number; // How often they accept harder goals
  motivationType: 'achievement' | 'consistency' | 'mastery' | 'social';
  insight: string;
}

// =============================================================================
// AGGREGATE TYPES
// =============================================================================

/**
 * Mistake type classification
 */
export type MistakeType =
  | 'conceptual' // Misunderstanding of concept
  | 'careless' // Knew it but made error
  | 'memory' // Forgot the information
  | 'calculation' // Math/logic error
  | 'grammatical' // Language structure error
  | 'spelling' // Spelling/typing error
  | 'unknown';

/**
 * All pattern types union
 */
export type LearningPattern =
  // Temporal
  | OptimalTimePattern
  | SessionDurationPattern
  | VelocityTrendPattern
  | CrammingPattern
  | SpacingPattern
  // Performance
  | StrugglePattern
  | ResponseTimePattern
  | ConfidenceCalibrationPattern
  | MistakeClusterPattern
  | HintUsagePattern
  // Cross-concept
  | PrerequisitePattern
  | InterferencePattern
  | PositiveTransferPattern
  | ConceptClusterPattern
  | ForgettingCorrelationPattern
  // Behavioral
  | SessionTriggerPattern
  | QuitSignalPattern
  | ContentPreferencePattern
  | PacePreferencePattern
  | GoalOrientationPattern;

/**
 * Pattern category
 */
export type PatternCategory =
  | 'temporal'
  | 'performance'
  | 'cross_concept'
  | 'behavioral';

/**
 * Pattern priority for recommendations
 */
export type PatternPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

// =============================================================================
// PATTERN ANALYSIS RESULTS
// =============================================================================

/**
 * Result of cross-concept analysis
 */
export interface CrossConceptAnalysisResult {
  userId: number;
  analyzedAt: string;
  periodStart: string;
  periodEnd: string;
  episodeCount: number;
  conceptCount: number;

  // Detected patterns by category
  temporalPatterns: Array<
    | OptimalTimePattern
    | SessionDurationPattern
    | VelocityTrendPattern
    | CrammingPattern
    | SpacingPattern
  >;

  performancePatterns: Array<
    | StrugglePattern
    | ResponseTimePattern
    | ConfidenceCalibrationPattern
    | MistakeClusterPattern
    | HintUsagePattern
  >;

  crossConceptPatterns: Array<
    | PrerequisitePattern
    | InterferencePattern
    | PositiveTransferPattern
    | ConceptClusterPattern
    | ForgettingCorrelationPattern
  >;

  behavioralPatterns: Array<
    | SessionTriggerPattern
    | QuitSignalPattern
    | ContentPreferencePattern
    | PacePreferencePattern
    | GoalOrientationPattern
  >;

  // Summary statistics
  summary: {
    totalPatterns: number;
    criticalPatterns: number;
    highPriorityPatterns: number;
    topInsights: string[];
    suggestedActions: string[];
  };
}

/**
 * Pattern detection configuration
 */
export interface PatternDetectionConfig {
  // Time windows
  lookbackDays: number;
  minEpisodesRequired: number;

  // Thresholds
  correlationThreshold: number; // Min correlation for relationships
  confidenceThreshold: number; // Min confidence to report pattern
  crammingThreshold: {
    reviewCount: number;
    periodMinutes: number;
  };

  // What to analyze
  enabledPatterns: PatternCategory[];

  // AI enhancement
  useAIForSynthesis: boolean;
  aiInsightCount: number;
}

/**
 * Default configuration
 */
export const DEFAULT_PATTERN_CONFIG: PatternDetectionConfig = {
  lookbackDays: 30,
  minEpisodesRequired: 10,
  correlationThreshold: 0.6,
  confidenceThreshold: 0.7,
  crammingThreshold: {
    reviewCount: 5,
    periodMinutes: 60,
  },
  enabledPatterns: ['temporal', 'performance', 'cross_concept', 'behavioral'],
  useAIForSynthesis: true,
  aiInsightCount: 5,
};

// =============================================================================
// PROFILE UPDATE RECOMMENDATIONS
// =============================================================================

/**
 * Recommended profile updates based on patterns
 */
export interface ProfileUpdateRecommendation {
  // Global profile updates
  globalUpdates: {
    learningStyle?: string;
    preferredTimeOfDay?: string;
    optimalSessionLength?: number;
    consistencyScore?: number;
    forgettingCurveSlope?: number;
    aiInsights?: string[];
  };

  // Domain-specific updates
  domainUpdates: Array<{
    domainType: DomainType;
    updates: {
      accuracyTrend?: string;
      learningVelocityTrend?: string;
      weakAreas?: Array<{
        concept: string;
        accuracy: number;
        reviewCount: number;
        commonMistakes: string[];
        suggestedApproach: string;
      }>;
      strongAreas?: string[];
      suggestedFocus?: string[];
      aiInsights?: string[];
    };
  }>;

  // Schedule recommendations
  scheduleUpdates?: {
    optimalStudyTimes: string[];
    recommendedSessionLength: number;
    recommendedFrequency: string;
    spacingAdjustments: Array<{
      conceptId: string;
      newInterval: number;
      reason: string;
    }>;
  };

  // Relationship-based recommendations
  conceptRelationships?: {
    prerequisites: Array<{
      study: string;
      before: string;
      confidence: number;
    }>;
    avoidTogether: Array<{
      conceptA: string;
      conceptB: string;
      reason: string;
    }>;
    studyTogether: Array<{
      concepts: string[];
      reason: string;
    }>;
  };
}

/**
 * Pattern-based notification
 */
export interface PatternNotification {
  id: string;
  patternType: string;
  priority: PatternPriority;
  title: string;
  message: string;
  actionable: boolean;
  action?: {
    type: 'navigate' | 'dismiss' | 'snooze' | 'apply';
    payload?: Record<string, unknown>;
  };
  createdAt: string;
  expiresAt?: string;
}
