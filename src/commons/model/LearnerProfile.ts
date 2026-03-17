/**
 * LearnerProfile.ts
 *
 * Data models for the Learner Profile system.
 * Tracks user's learning characteristics, preferences, and per-domain mastery.
 *
 * The profile has two layers:
 * 1. Global Profile: Overall learning patterns across all domains
 * 2. Domain Profiles: Per-domain mastery and learning characteristics
 */

import { DomainType, DifficultyLevel } from './LearningDomains';

// =============================================================================
// GLOBAL PROFILE - Overall learning patterns
// =============================================================================

/**
 * Learning style preferences
 */
export type LearningStyle =
  | 'visual' // Prefers diagrams, charts, images
  | 'reading' // Prefers text-based learning
  | 'hands_on' // Prefers exercises and practice
  | 'auditory' // Prefers listening/audio
  | 'mixed'; // No strong preference

/**
 * Time of day learning preference
 */
export type TimePreference = 'morning' | 'afternoon' | 'evening' | 'night' | 'any';

/**
 * Session length preference
 */
export type SessionLengthPreference = 'short' | 'medium' | 'long' | 'adaptive';

/**
 * Global learning profile
 */
export interface GlobalLearnerProfile {
  // Learning style analysis
  learningStyle: LearningStyle;
  learningStyleScores: {
    visual: number;
    reading: number;
    hands_on: number;
    auditory: number;
  };

  // Time preferences
  preferredTimeOfDay: TimePreference;
  optimalSessionLength: number; // minutes
  sessionLengthPreference: SessionLengthPreference;

  // Learning pace
  averageLearningVelocity: number; // items per session
  consistencyScore: number; // 0-1, how consistent is their schedule
  streakRecord: number; // longest streak ever

  // Retention patterns
  averageRetentionRate: number; // 0-1, how well they retain
  optimalReviewInterval: number; // days
  forgettingCurveSlope: number; // how fast they forget (lower = better)

  // Engagement patterns
  averageSessionsPerWeek: number;
  preferredDays: string[]; // ['Monday', 'Wednesday', etc.]
  engagementTrend: 'increasing' | 'stable' | 'decreasing';

  // Performance patterns
  performsWellWith: string[]; // content types that work well
  strugglesWidth: string[]; // content types that need more support
  motivationalTriggers: string[]; // what keeps them engaged

  // AI observations
  aiInsights: string[];
  lastAnalyzedAt: Date | null;
}

/**
 * Default global profile for new users
 */
export const DEFAULT_GLOBAL_PROFILE: GlobalLearnerProfile = {
  learningStyle: 'mixed',
  learningStyleScores: {
    visual: 0.25,
    reading: 0.25,
    hands_on: 0.25,
    auditory: 0.25,
  },

  preferredTimeOfDay: 'any',
  optimalSessionLength: 15,
  sessionLengthPreference: 'adaptive',

  averageLearningVelocity: 10,
  consistencyScore: 0.5,
  streakRecord: 0,

  averageRetentionRate: 0.7,
  optimalReviewInterval: 3,
  forgettingCurveSlope: 0.5,

  averageSessionsPerWeek: 0,
  preferredDays: [],
  engagementTrend: 'stable',

  performsWellWith: [],
  strugglesWidth: [],
  motivationalTriggers: [],

  aiInsights: [],
  lastAnalyzedAt: null,
};

// =============================================================================
// DOMAIN PROFILE - Per-domain learning characteristics
// =============================================================================

/**
 * Proficiency level in a domain
 */
export type ProficiencyLevel =
  | 'novice'
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

/**
 * Per-domain learner profile
 */
export interface DomainLearnerProfile {
  // Domain identification
  domainType: DomainType;
  domainName: string | null; // Optional specific name (e.g., "Spanish", "Python")

  // Proficiency
  proficiencyLevel: ProficiencyLevel;
  estimatedProficiencyScore: number; // 0-100

  // Mastery metrics
  totalItemsLearned: number;
  totalItemsMastered: number;
  averageMasteryLevel: number; // 0-100

  // Learning velocity in this domain
  itemsPerSession: number;
  averageTimePerItem: number; // seconds
  learningVelocityTrend: 'improving' | 'stable' | 'slowing';

  // Performance metrics
  overallAccuracy: number; // 0-1
  recentAccuracy: number; // 0-1, last 7 days
  accuracyTrend: 'improving' | 'stable' | 'declining';

  // Spaced repetition effectiveness (if applicable)
  retentionRate: number; // 0-1
  optimalReviewIntervals: number[]; // customized intervals

  // Difficulty preferences
  currentDifficultyLevel: DifficultyLevel;
  difficultyAdjustmentNeeded: 'increase' | 'maintain' | 'decrease';

  // Weak areas
  weakAreas: WeakArea[];

  // Strong areas
  strongAreas: string[];

  // Content type performance
  contentTypePerformance: Record<string, number>; // content type -> accuracy

  // Assessment performance
  assessmentTypePerformance: Record<string, number>; // assessment type -> score

  // Time investment
  totalTimeSpentMinutes: number;
  averageSessionMinutes: number;

  // Goals progress
  currentGoals: LearningGoal[];

  // AI observations specific to this domain
  aiInsights: string[];
  suggestedFocus: string[];

  // Timestamps
  lastStudiedAt: Date | null;
  lastAnalyzedAt: Date | null;
}

/**
 * Weak area identification
 */
export interface WeakArea {
  concept: string;
  accuracy: number;
  reviewCount: number;
  commonMistakes: string[];
  suggestedApproach: string;
}

/**
 * Learning goal tracking
 */
export interface LearningGoal {
  id: string;
  description: string;
  targetValue: number;
  currentValue: number;
  deadline: Date | null;
  status: 'active' | 'completed' | 'missed';
}

/**
 * Default domain profile
 */
export const DEFAULT_DOMAIN_PROFILE: Omit<
  DomainLearnerProfile,
  'domainType' | 'domainName'
> = {
  proficiencyLevel: 'novice',
  estimatedProficiencyScore: 0,

  totalItemsLearned: 0,
  totalItemsMastered: 0,
  averageMasteryLevel: 0,

  itemsPerSession: 0,
  averageTimePerItem: 0,
  learningVelocityTrend: 'stable',

  overallAccuracy: 0,
  recentAccuracy: 0,
  accuracyTrend: 'stable',

  retentionRate: 0.7,
  optimalReviewIntervals: [1, 3, 7, 14, 30],

  currentDifficultyLevel: DifficultyLevel.BEGINNER,
  difficultyAdjustmentNeeded: 'maintain',

  weakAreas: [],
  strongAreas: [],

  contentTypePerformance: {},
  assessmentTypePerformance: {},

  totalTimeSpentMinutes: 0,
  averageSessionMinutes: 0,

  currentGoals: [],

  aiInsights: [],
  suggestedFocus: [],

  lastStudiedAt: null,
  lastAnalyzedAt: null,
};

// =============================================================================
// FULL PROFILE - Combined global and domain profiles
// =============================================================================

/**
 * Full learner profile including global and all domain profiles
 */
export interface FullLearnerProfile {
  userId: number;
  globalProfile: GlobalLearnerProfile;
  domainProfiles: DomainLearnerProfile[];
  createdAt: Date;
  updatedAt: Date | null;
}

// =============================================================================
// PROFILE UPDATE TYPES
// =============================================================================

/**
 * Input for updating global profile
 */
export interface UpdateGlobalProfileInput {
  learningStyle?: LearningStyle;
  learningStyleScores?: Partial<GlobalLearnerProfile['learningStyleScores']>;
  preferredTimeOfDay?: TimePreference;
  optimalSessionLength?: number;
  sessionLengthPreference?: SessionLengthPreference;
  aiInsights?: string[];
}

/**
 * Input for updating domain profile
 */
export interface UpdateDomainProfileInput {
  domainType: DomainType;
  domainName?: string;
  proficiencyLevel?: ProficiencyLevel;
  estimatedProficiencyScore?: number;
  currentDifficultyLevel?: DifficultyLevel;
  difficultyAdjustmentNeeded?: 'increase' | 'maintain' | 'decrease';
  weakAreas?: WeakArea[];
  strongAreas?: string[];
  aiInsights?: string[];
  suggestedFocus?: string[];
}

/**
 * Performance data for profile analysis
 */
export interface PerformanceData {
  topicId: string;
  domainType: DomainType;
  sessionType: string;
  itemsReviewed: number;
  itemsCorrect: number;
  itemsNew: number;
  durationMinutes: number;
  timestamp: Date;
  itemResults?: {
    itemId: string;
    wasCorrect: boolean;
    responseTimeMs: number;
    mistakeType?: string;
  }[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate proficiency level from score
 */
export function scoreToProficiencyLevel(score: number): ProficiencyLevel {
  if (score >= 90) return 'expert';
  if (score >= 70) return 'advanced';
  if (score >= 50) return 'intermediate';
  if (score >= 25) return 'beginner';
  return 'novice';
}

/**
 * Calculate difficulty adjustment recommendation
 */
export function calculateDifficultyAdjustment(
  recentAccuracy: number,
  accuracyTrend: string,
): 'increase' | 'maintain' | 'decrease' {
  if (recentAccuracy >= 0.9 && accuracyTrend !== 'declining') {
    return 'increase';
  }
  if (recentAccuracy < 0.6 || accuracyTrend === 'declining') {
    return 'decrease';
  }
  return 'maintain';
}

/**
 * Determine learning style from style scores
 */
export function determineLearningStyle(
  scores: GlobalLearnerProfile['learningStyleScores'],
): LearningStyle {
  const entries = Object.entries(scores) as [string, number][];
  const maxScore = Math.max(...entries.map(([, v]) => v));
  const minScore = Math.min(...entries.map(([, v]) => v));

  // If scores are similar, it's mixed
  if (maxScore - minScore < 0.15) {
    return 'mixed';
  }

  // Find the dominant style
  const dominant = entries.find(([, v]) => v === maxScore);
  return (dominant?.[0] || 'mixed') as LearningStyle;
}

/**
 * Calculate engagement trend from session data
 */
export function calculateEngagementTrend(
  sessionsLast7Days: number,
  sessionsLast30Days: number,
): 'increasing' | 'stable' | 'decreasing' {
  const weeklyAverage = sessionsLast30Days / 4;
  const ratio = sessionsLast7Days / Math.max(weeklyAverage, 1);

  if (ratio > 1.2) return 'increasing';
  if (ratio < 0.8) return 'decreasing';
  return 'stable';
}

/**
 * Calculate accuracy trend from recent performance
 */
export function calculateAccuracyTrend(
  currentAccuracy: number,
  previousAccuracy: number,
): 'improving' | 'stable' | 'declining' {
  const diff = currentAccuracy - previousAccuracy;

  if (diff > 0.05) return 'improving';
  if (diff < -0.05) return 'declining';
  return 'stable';
}

/**
 * Generate AI prompt for profile analysis
 */
export function generateProfileAnalysisPrompt(
  globalProfile: GlobalLearnerProfile,
  domainProfile: DomainLearnerProfile,
  recentPerformance: PerformanceData[],
): string {
  return `
Analyze this learner's profile and recent performance to provide insights and recommendations.

Global Learning Profile:
- Learning Style: ${globalProfile.learningStyle}
- Preferred Time: ${globalProfile.preferredTimeOfDay}
- Average Sessions/Week: ${globalProfile.averageSessionsPerWeek}
- Consistency Score: ${(globalProfile.consistencyScore * 100).toFixed(0)}%
- Retention Rate: ${(globalProfile.averageRetentionRate * 100).toFixed(0)}%

Domain Profile (${domainProfile.domainType}):
- Proficiency: ${domainProfile.proficiencyLevel} (${domainProfile.estimatedProficiencyScore}%)
- Items Mastered: ${domainProfile.totalItemsMastered}/${domainProfile.totalItemsLearned}
- Recent Accuracy: ${(domainProfile.recentAccuracy * 100).toFixed(0)}%
- Accuracy Trend: ${domainProfile.accuracyTrend}
- Weak Areas: ${domainProfile.weakAreas.map((w) => w.concept).join(', ') || 'None identified'}

Recent Sessions (last ${recentPerformance.length}):
${recentPerformance
  .slice(0, 5)
  .map(
    (p) =>
      `- ${p.sessionType}: ${p.itemsCorrect}/${p.itemsReviewed} correct (${p.durationMinutes}min)`,
  )
  .join('\n')}

Please provide:
1. Key observations about this learner
2. Recommended adjustments to their learning approach
3. Specific areas to focus on
4. Motivational insights

Return as JSON:
{
  "observations": ["observation 1", "observation 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "focusAreas": ["area 1", "area 2"],
  "motivationalInsights": ["insight 1"],
  "suggestedDifficultyAdjustment": "increase|maintain|decrease",
  "suggestedSessionLength": number
}
`;
}
