/**
 * LearningDomains.ts
 *
 * Domain Type System for the AI Learning Companion Framework.
 * Defines predefined domain templates (vocabulary, math, language, knowledge, skill)
 * with specialized learning mechanics and configurations.
 *
 * Each domain type has optimized:
 * - Learning mechanics (spaced repetition, progressive difficulty, etc.)
 * - Content types supported
 * - Assessment methods
 * - Mastery criteria
 * - Knowledge graph node/edge types
 */

// =============================================================================
// ENUMS - Core domain and content type definitions
// =============================================================================

/**
 * Domain types - predefined templates for learning categories.
 * Users create Learning Topics using these as base templates.
 */
export enum DomainType {
  VOCABULARY = 'vocabulary',
  MATH = 'math',
  LANGUAGE = 'language',
  KNOWLEDGE = 'knowledge',
  SKILL = 'skill',
}

/**
 * Content types that can be generated/used for learning
 */
export type ContentType =
  // Vocabulary domain
  | 'definition'
  | 'example_sentence'
  | 'etymology'
  | 'synonym'
  | 'antonym'
  | 'usage_context'
  // Math domain
  | 'concept_explanation'
  | 'formula'
  | 'worked_example'
  | 'practice_problem'
  | 'visual_diagram'
  | 'proof'
  // Language domain
  | 'grammar_rule'
  | 'reading_passage'
  | 'writing_prompt'
  | 'dialogue'
  | 'vocabulary_in_context'
  | 'listening_exercise'
  // Knowledge domain
  | 'concept'
  | 'fact'
  | 'relationship'
  | 'summary'
  | 'quote'
  | 'example'
  | 'timeline'
  // Skill domain
  | 'tutorial'
  | 'exercise'
  | 'project'
  | 'code_example'
  | 'best_practice'
  | 'common_mistake'
  | 'checklist';

/**
 * Assessment methods for evaluating mastery
 */
export type AssessmentMethod =
  // Universal
  | 'multiple_choice'
  | 'fill_blank'
  // Vocabulary
  | 'flashcard_recall'
  | 'usage_sentence'
  | 'synonym_match'
  // Math
  | 'problem_solving'
  | 'concept_application'
  | 'proof_completion'
  | 'step_by_step'
  // Language
  | 'grammar_correction'
  | 'reading_comprehension'
  | 'writing_exercise'
  | 'translation'
  | 'listening_comprehension'
  // Knowledge
  | 'concept_recall'
  | 'relationship_identification'
  | 'application_scenario'
  | 'essay'
  // Skill
  | 'hands_on_exercise'
  | 'project_completion'
  | 'code_review'
  | 'practical_demonstration';

/**
 * Topic status in the learning lifecycle
 */
export enum TopicStatus {
  PLANNING = 'planning', // Initial setup, plan being created
  ACTIVE = 'active', // Currently studying
  PAUSED = 'paused', // Temporarily paused
  COMPLETED = 'completed', // Goal achieved
  ARCHIVED = 'archived', // No longer active
}

/**
 * Difficulty levels for content and assessments
 */
export enum DifficultyLevel {
  BEGINNER = 'beginner',
  ELEMENTARY = 'elementary',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

/**
 * Session types for learning sessions
 */
export enum SessionType {
  REVIEW = 'review', // Spaced repetition review
  LEARN_NEW = 'learn_new', // Learning new items
  PRACTICE = 'practice', // Practice problems/exercises
  QUIZ = 'quiz', // Assessment quiz
  READING = 'reading', // Reading content
  PROJECT = 'project', // Working on a project
}

// =============================================================================
// INTERFACES - Configuration structures
// =============================================================================

/**
 * Mastery criteria for determining when a learner has mastered content
 */
export interface MasteryCriteria {
  // For spaced repetition items
  minCorrectStreak?: number;
  minRetentionDays?: number;

  // For progressive difficulty
  minDifficultyLevel?: number;

  // For skill-based
  minProjectsCompleted?: number;
  requiredCompetencies?: string[];

  // For knowledge-based
  minConceptsCovered?: number;
  minRelationshipsUnderstood?: number;
  requiredDepth?: 'familiarity' | 'understanding' | 'application' | 'mastery';

  // For language
  requiredSkillAreas?: string[];
  minProficiencyLevel?: string;

  // Universal
  requiredAssessmentTypes?: string[];
}

/**
 * Configuration for a domain type
 */
export interface DomainTypeConfig {
  type: DomainType;
  name: string;
  description: string;
  icon: string; // Material icon name
  color: string; // Theme color

  // Learning mechanics
  usesSpacedRepetition: boolean;
  usesProgressiveDifficulty: boolean;
  usesPracticeProblems: boolean;
  usesConceptGraph: boolean;

  // Content and assessment
  contentTypes: ContentType[];
  assessmentMethods: AssessmentMethod[];

  // Mastery criteria
  masteryCriteria: MasteryCriteria;

  // Knowledge graph schema
  graphNodeTypes: string[];
  graphEdgeTypes: string[];

  // Default settings
  defaultDailyMinutes: number;
  defaultSessionLength: number; // minutes
  defaultItemsPerSession: number;

  // AI prompt hints for this domain
  aiPromptHints: string[];
}

// =============================================================================
// DOMAIN CONFIGURATIONS - The heart of the domain type system
// =============================================================================

/**
 * Complete configurations for all domain types
 */
export const DOMAIN_CONFIGS: Record<DomainType, DomainTypeConfig> = {
  [DomainType.VOCABULARY]: {
    type: DomainType.VOCABULARY,
    name: 'Vocabulary',
    description:
      'Word learning with definitions, usage, and spaced repetition',
    icon: 'MenuBook',
    color: '#4CAF50', // Green

    usesSpacedRepetition: true,
    usesProgressiveDifficulty: true,
    usesPracticeProblems: false,
    usesConceptGraph: true,

    contentTypes: [
      'definition',
      'example_sentence',
      'etymology',
      'synonym',
      'antonym',
      'usage_context',
    ],
    assessmentMethods: [
      'flashcard_recall',
      'multiple_choice',
      'fill_blank',
      'usage_sentence',
      'synonym_match',
    ],

    masteryCriteria: {
      minCorrectStreak: 5,
      minRetentionDays: 14,
      requiredAssessmentTypes: ['flashcard_recall', 'usage_sentence'],
    },

    graphNodeTypes: ['Word', 'WordFamily', 'Concept', 'UsageContext'],
    graphEdgeTypes: [
      'SYNONYM',
      'ANTONYM',
      'DERIVED_FROM',
      'RELATED_TO',
      'USED_IN_CONTEXT',
      'PART_OF_FAMILY',
    ],

    defaultDailyMinutes: 15,
    defaultSessionLength: 10,
    defaultItemsPerSession: 20,

    aiPromptHints: [
      'Focus on contextual usage over rote definitions',
      'Connect words to word families and roots',
      'Use memorable example sentences',
      'Highlight common mistakes and confusions',
    ],
  },

  [DomainType.MATH]: {
    type: DomainType.MATH,
    name: 'Mathematics',
    description: 'Mathematical concepts, formulas, and problem-solving',
    icon: 'Functions',
    color: '#2196F3', // Blue

    usesSpacedRepetition: true,
    usesProgressiveDifficulty: true,
    usesPracticeProblems: true,
    usesConceptGraph: true,

    contentTypes: [
      'concept_explanation',
      'formula',
      'worked_example',
      'practice_problem',
      'visual_diagram',
      'proof',
    ],
    assessmentMethods: [
      'problem_solving',
      'concept_application',
      'proof_completion',
      'multiple_choice',
      'step_by_step',
    ],

    masteryCriteria: {
      minCorrectStreak: 3,
      minDifficultyLevel: 4,
      requiredAssessmentTypes: ['problem_solving', 'concept_application'],
    },

    graphNodeTypes: ['Concept', 'Formula', 'Theorem', 'Technique', 'Problem'],
    graphEdgeTypes: [
      'PREREQUISITE',
      'APPLIES_TO',
      'DERIVED_FROM',
      'RELATED_TO',
      'GENERALIZES',
      'SPECIAL_CASE_OF',
    ],

    defaultDailyMinutes: 30,
    defaultSessionLength: 25,
    defaultItemsPerSession: 5,

    aiPromptHints: [
      'Build on prerequisite concepts systematically',
      'Provide step-by-step worked examples',
      'Vary problem types and difficulty',
      'Connect abstract concepts to real applications',
      'Use visual diagrams where helpful',
    ],
  },

  [DomainType.LANGUAGE]: {
    type: DomainType.LANGUAGE,
    name: 'Language Learning',
    description:
      'Comprehensive language skills: grammar, reading, writing, listening',
    icon: 'Translate',
    color: '#FF9800', // Orange

    usesSpacedRepetition: true,
    usesProgressiveDifficulty: true,
    usesPracticeProblems: true,
    usesConceptGraph: true,

    contentTypes: [
      'grammar_rule',
      'reading_passage',
      'writing_prompt',
      'dialogue',
      'vocabulary_in_context',
      'listening_exercise',
    ],
    assessmentMethods: [
      'grammar_correction',
      'reading_comprehension',
      'writing_exercise',
      'translation',
      'fill_blank',
      'multiple_choice',
    ],

    masteryCriteria: {
      minCorrectStreak: 5,
      requiredSkillAreas: ['reading', 'writing', 'grammar'],
      minProficiencyLevel: 'intermediate',
    },

    graphNodeTypes: ['GrammarRule', 'Vocabulary', 'Phrase', 'Structure', 'Topic'],
    graphEdgeTypes: [
      'REQUIRES',
      'SIMILAR_TO',
      'CONTRASTS_WITH',
      'USED_IN',
      'EXCEPTION_TO',
      'FORMAL_VERSION_OF',
    ],

    defaultDailyMinutes: 30,
    defaultSessionLength: 20,
    defaultItemsPerSession: 10,

    aiPromptHints: [
      'Balance all four skills (reading, writing, listening, speaking)',
      'Use authentic language examples',
      'Point out common errors for language learners',
      'Connect grammar to practical usage',
      'Provide cultural context where relevant',
    ],
  },

  [DomainType.KNOWLEDGE]: {
    type: DomainType.KNOWLEDGE,
    name: 'Knowledge Acquisition',
    description:
      'Learning facts, concepts, and their relationships (books, subjects, topics)',
    icon: 'School',
    color: '#9C27B0', // Purple

    usesSpacedRepetition: true,
    usesProgressiveDifficulty: false,
    usesPracticeProblems: false,
    usesConceptGraph: true,

    contentTypes: [
      'concept',
      'fact',
      'relationship',
      'summary',
      'quote',
      'example',
      'timeline',
    ],
    assessmentMethods: [
      'concept_recall',
      'relationship_identification',
      'application_scenario',
      'essay',
      'multiple_choice',
    ],

    masteryCriteria: {
      minConceptsCovered: 0.8,
      minRelationshipsUnderstood: 0.7,
      requiredDepth: 'understanding',
    },

    graphNodeTypes: [
      'Concept',
      'Entity',
      'Event',
      'Principle',
      'Theory',
      'Person',
      'Place',
    ],
    graphEdgeTypes: [
      'CAUSES',
      'LEADS_TO',
      'PART_OF',
      'EXAMPLE_OF',
      'CONTRASTS_WITH',
      'RELATED_TO',
      'INFLUENCED_BY',
      'OCCURRED_IN',
    ],

    defaultDailyMinutes: 20,
    defaultSessionLength: 15,
    defaultItemsPerSession: 10,

    aiPromptHints: [
      'Build a mental model of concept relationships',
      'Use analogies and real-world examples',
      'Create memory hooks and associations',
      'Test understanding, not just recall',
      'Connect new knowledge to existing knowledge',
    ],
  },

  [DomainType.SKILL]: {
    type: DomainType.SKILL,
    name: 'Skill Development',
    description: 'Procedural learning: programming, design, crafts, techniques',
    icon: 'Build',
    color: '#F44336', // Red

    usesSpacedRepetition: false,
    usesProgressiveDifficulty: true,
    usesPracticeProblems: true,
    usesConceptGraph: true,

    contentTypes: [
      'tutorial',
      'exercise',
      'project',
      'code_example',
      'best_practice',
      'common_mistake',
      'checklist',
    ],
    assessmentMethods: [
      'hands_on_exercise',
      'project_completion',
      'code_review',
      'problem_solving',
      'practical_demonstration',
    ],

    masteryCriteria: {
      minProjectsCompleted: 3,
      minDifficultyLevel: 3,
      requiredCompetencies: ['basic', 'intermediate', 'application'],
    },

    graphNodeTypes: [
      'Skill',
      'Technique',
      'Tool',
      'Pattern',
      'BestPractice',
      'Project',
    ],
    graphEdgeTypes: [
      'PREREQUISITE',
      'ENABLES',
      'USED_WITH',
      'ALTERNATIVE_TO',
      'IMPLEMENTS',
      'BUILDS_ON',
    ],

    defaultDailyMinutes: 45,
    defaultSessionLength: 30,
    defaultItemsPerSession: 3,

    aiPromptHints: [
      'Learn by doing - prioritize hands-on exercises',
      'Break complex skills into smaller sub-skills',
      'Provide immediate feedback on practice',
      'Progress from guided to independent work',
      'Include real-world projects',
    ],
  },
};

// =============================================================================
// HELPER FUNCTIONS - Domain type utilities
// =============================================================================

/**
 * Get domain config by type
 */
export function getDomainConfig(type: DomainType): DomainTypeConfig {
  return DOMAIN_CONFIGS[type];
}

/**
 * Get all domain types
 */
export function getAllDomainTypes(): DomainType[] {
  return Object.values(DomainType);
}

/**
 * Get domain types that use spaced repetition
 */
export function getSpacedRepetitionDomains(): DomainType[] {
  return Object.values(DomainType).filter(
    (type) => DOMAIN_CONFIGS[type].usesSpacedRepetition
  );
}

/**
 * Get domain types that use practice problems
 */
export function getPracticeProblemDomains(): DomainType[] {
  return Object.values(DomainType).filter(
    (type) => DOMAIN_CONFIGS[type].usesPracticeProblems
  );
}

/**
 * Get content types available for a domain
 */
export function getDomainContentTypes(type: DomainType): ContentType[] {
  return DOMAIN_CONFIGS[type].contentTypes;
}

/**
 * Get assessment methods available for a domain
 */
export function getDomainAssessmentMethods(type: DomainType): AssessmentMethod[] {
  return DOMAIN_CONFIGS[type].assessmentMethods;
}

/**
 * Check if a content type is supported by a domain
 */
export function isContentTypeSupported(
  domain: DomainType,
  contentType: ContentType
): boolean {
  return DOMAIN_CONFIGS[domain].contentTypes.includes(contentType);
}

/**
 * Check if an assessment method is supported by a domain
 */
export function isAssessmentMethodSupported(
  domain: DomainType,
  method: AssessmentMethod
): boolean {
  return DOMAIN_CONFIGS[domain].assessmentMethods.includes(method);
}

/**
 * Get the default session configuration for a domain
 */
export function getDefaultSessionConfig(domain: DomainType): {
  dailyMinutes: number;
  sessionLength: number;
  itemsPerSession: number;
} {
  const config = DOMAIN_CONFIGS[domain];
  return {
    dailyMinutes: config.defaultDailyMinutes,
    sessionLength: config.defaultSessionLength,
    itemsPerSession: config.defaultItemsPerSession,
  };
}

/**
 * Get AI prompt hints for a domain
 */
export function getDomainAIPromptHints(domain: DomainType): string[] {
  return DOMAIN_CONFIGS[domain].aiPromptHints;
}

/**
 * Get graph node types for a domain
 */
export function getDomainGraphNodeTypes(domain: DomainType): string[] {
  return DOMAIN_CONFIGS[domain].graphNodeTypes;
}

/**
 * Get graph edge types for a domain
 */
export function getDomainGraphEdgeTypes(domain: DomainType): string[] {
  return DOMAIN_CONFIGS[domain].graphEdgeTypes;
}

// =============================================================================
// SOURCE TYPE DEFINITIONS - For linking topics to existing content
// =============================================================================

/**
 * Source types for learning topics
 * A topic can be linked to existing content in the system
 */
export enum TopicSourceType {
  BOOK = 'book', // Learning from a specific book
  VOCABULARY_SET = 'vocabulary_set', // Based on a vocabulary set
  URL = 'url', // Based on a web article/page
  CHAT = 'chat', // From a "Learn About" chat session
  MANUAL = 'manual', // User-defined topic without source
  COURSE = 'course', // External course (future)
}

/**
 * Mapping of source types to default domain types
 */
export const SOURCE_TYPE_TO_DOMAIN: Partial<Record<TopicSourceType, DomainType>> = {
  [TopicSourceType.BOOK]: DomainType.KNOWLEDGE,
  [TopicSourceType.VOCABULARY_SET]: DomainType.VOCABULARY,
  [TopicSourceType.CHAT]: DomainType.KNOWLEDGE,
};

// =============================================================================
// DOMAIN LIST FOR UI - Formatted for selection components
// =============================================================================

/**
 * Domain list formatted for UI selection components
 */
export const DOMAIN_LIST = Object.values(DomainType).map((type) => ({
  value: type,
  label: DOMAIN_CONFIGS[type].name,
  description: DOMAIN_CONFIGS[type].description,
  icon: DOMAIN_CONFIGS[type].icon,
  color: DOMAIN_CONFIGS[type].color,
}));

/**
 * Topic status list for UI
 */
export const TOPIC_STATUS_LIST = [
  {
    value: TopicStatus.PLANNING,
    label: 'Planning',
    description: 'Setting up the learning plan',
    color: '#9E9E9E',
  },
  {
    value: TopicStatus.ACTIVE,
    label: 'Active',
    description: 'Currently studying',
    color: '#4CAF50',
  },
  {
    value: TopicStatus.PAUSED,
    label: 'Paused',
    description: 'Temporarily paused',
    color: '#FF9800',
  },
  {
    value: TopicStatus.COMPLETED,
    label: 'Completed',
    description: 'Learning goal achieved',
    color: '#2196F3',
  },
  {
    value: TopicStatus.ARCHIVED,
    label: 'Archived',
    description: 'No longer active',
    color: '#607D8B',
  },
];

/**
 * Difficulty level list for UI
 */
export const DIFFICULTY_LIST = [
  { value: DifficultyLevel.BEGINNER, label: 'Beginner', level: 1 },
  { value: DifficultyLevel.ELEMENTARY, label: 'Elementary', level: 2 },
  { value: DifficultyLevel.INTERMEDIATE, label: 'Intermediate', level: 3 },
  { value: DifficultyLevel.ADVANCED, label: 'Advanced', level: 4 },
  { value: DifficultyLevel.EXPERT, label: 'Expert', level: 5 },
];
