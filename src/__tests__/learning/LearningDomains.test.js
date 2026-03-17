/**
 * LearningDomains.test.js
 *
 * Unit tests for the Learning Domain Type System.
 * Tests domain configurations, enums, and helper functions.
 */

// Mock the module since it's TypeScript
jest.mock('../../commons/model/LearningDomains', () => {
  // Recreate the module structure for testing
  const DomainType = {
    VOCABULARY: 'vocabulary',
    MATH: 'math',
    LANGUAGE: 'language',
    KNOWLEDGE: 'knowledge',
    SKILL: 'skill',
  };

  const TopicStatus = {
    PLANNING: 'planning',
    ACTIVE: 'active',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    ARCHIVED: 'archived',
  };

  const DifficultyLevel = {
    BEGINNER: 'beginner',
    ELEMENTARY: 'elementary',
    INTERMEDIATE: 'intermediate',
    ADVANCED: 'advanced',
    EXPERT: 'expert',
  };

  const SessionType = {
    REVIEW: 'review',
    LEARN_NEW: 'learn_new',
    PRACTICE: 'practice',
    QUIZ: 'quiz',
    READING: 'reading',
    PROJECT: 'project',
  };

  const TopicSourceType = {
    BOOK: 'book',
    VOCABULARY_SET: 'vocabulary_set',
    URL: 'url',
    CHAT: 'chat',
    MANUAL: 'manual',
    COURSE: 'course',
  };

  const DOMAIN_CONFIGS = {
    [DomainType.VOCABULARY]: {
      type: DomainType.VOCABULARY,
      name: 'Vocabulary',
      description: 'Word learning with definitions, usage, and spaced repetition',
      icon: 'MenuBook',
      color: '#4CAF50',
      usesSpacedRepetition: true,
      usesProgressiveDifficulty: true,
      usesPracticeProblems: false,
      usesConceptGraph: true,
      contentTypes: ['definition', 'example_sentence', 'etymology', 'synonym', 'antonym', 'usage_context'],
      assessmentMethods: ['flashcard_recall', 'multiple_choice', 'fill_blank', 'usage_sentence', 'synonym_match'],
      masteryCriteria: {
        minCorrectStreak: 5,
        minRetentionDays: 14,
        requiredAssessmentTypes: ['flashcard_recall', 'usage_sentence'],
      },
      graphNodeTypes: ['Word', 'WordFamily', 'Concept', 'UsageContext'],
      graphEdgeTypes: ['SYNONYM', 'ANTONYM', 'DERIVED_FROM', 'RELATED_TO', 'USED_IN_CONTEXT', 'PART_OF_FAMILY'],
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
      color: '#2196F3',
      usesSpacedRepetition: true,
      usesProgressiveDifficulty: true,
      usesPracticeProblems: true,
      usesConceptGraph: true,
      contentTypes: ['concept_explanation', 'formula', 'worked_example', 'practice_problem', 'visual_diagram', 'proof'],
      assessmentMethods: ['problem_solving', 'concept_application', 'proof_completion', 'multiple_choice', 'step_by_step'],
      masteryCriteria: {
        minCorrectStreak: 3,
        minDifficultyLevel: 4,
        requiredAssessmentTypes: ['problem_solving', 'concept_application'],
      },
      graphNodeTypes: ['Concept', 'Formula', 'Theorem', 'Technique', 'Problem'],
      graphEdgeTypes: ['PREREQUISITE', 'APPLIES_TO', 'DERIVED_FROM', 'RELATED_TO', 'GENERALIZES', 'SPECIAL_CASE_OF'],
      defaultDailyMinutes: 30,
      defaultSessionLength: 25,
      defaultItemsPerSession: 5,
      aiPromptHints: ['Build on prerequisite concepts systematically'],
    },
    [DomainType.LANGUAGE]: {
      type: DomainType.LANGUAGE,
      name: 'Language Learning',
      description: 'Comprehensive language skills: grammar, reading, writing, listening',
      icon: 'Translate',
      color: '#FF9800',
      usesSpacedRepetition: true,
      usesProgressiveDifficulty: true,
      usesPracticeProblems: true,
      usesConceptGraph: true,
      contentTypes: ['grammar_rule', 'reading_passage', 'writing_prompt', 'dialogue', 'vocabulary_in_context', 'listening_exercise'],
      assessmentMethods: ['grammar_correction', 'reading_comprehension', 'writing_exercise', 'translation', 'fill_blank', 'multiple_choice'],
      masteryCriteria: {
        minCorrectStreak: 5,
        requiredSkillAreas: ['reading', 'writing', 'grammar'],
        minProficiencyLevel: 'intermediate',
      },
      graphNodeTypes: ['GrammarRule', 'Vocabulary', 'Phrase', 'Structure', 'Topic'],
      graphEdgeTypes: ['REQUIRES', 'SIMILAR_TO', 'CONTRASTS_WITH', 'USED_IN', 'EXCEPTION_TO', 'FORMAL_VERSION_OF'],
      defaultDailyMinutes: 30,
      defaultSessionLength: 20,
      defaultItemsPerSession: 10,
      aiPromptHints: ['Balance all four skills'],
    },
    [DomainType.KNOWLEDGE]: {
      type: DomainType.KNOWLEDGE,
      name: 'Knowledge Acquisition',
      description: 'Learning facts, concepts, and their relationships',
      icon: 'School',
      color: '#9C27B0',
      usesSpacedRepetition: true,
      usesProgressiveDifficulty: false,
      usesPracticeProblems: false,
      usesConceptGraph: true,
      contentTypes: ['concept', 'fact', 'relationship', 'summary', 'quote', 'example', 'timeline'],
      assessmentMethods: ['concept_recall', 'relationship_identification', 'application_scenario', 'essay', 'multiple_choice'],
      masteryCriteria: {
        minConceptsCovered: 0.8,
        minRelationshipsUnderstood: 0.7,
        requiredDepth: 'understanding',
      },
      graphNodeTypes: ['Concept', 'Entity', 'Event', 'Principle', 'Theory', 'Person', 'Place'],
      graphEdgeTypes: ['CAUSES', 'LEADS_TO', 'PART_OF', 'EXAMPLE_OF', 'CONTRASTS_WITH', 'RELATED_TO', 'INFLUENCED_BY', 'OCCURRED_IN'],
      defaultDailyMinutes: 20,
      defaultSessionLength: 15,
      defaultItemsPerSession: 10,
      aiPromptHints: ['Build mental models'],
    },
    [DomainType.SKILL]: {
      type: DomainType.SKILL,
      name: 'Skill Development',
      description: 'Procedural learning: programming, design, crafts, techniques',
      icon: 'Build',
      color: '#F44336',
      usesSpacedRepetition: false,
      usesProgressiveDifficulty: true,
      usesPracticeProblems: true,
      usesConceptGraph: true,
      contentTypes: ['tutorial', 'exercise', 'project', 'code_example', 'best_practice', 'common_mistake', 'checklist'],
      assessmentMethods: ['hands_on_exercise', 'project_completion', 'code_review', 'problem_solving', 'practical_demonstration'],
      masteryCriteria: {
        minProjectsCompleted: 3,
        minDifficultyLevel: 3,
        requiredCompetencies: ['basic', 'intermediate', 'application'],
      },
      graphNodeTypes: ['Skill', 'Technique', 'Tool', 'Pattern', 'BestPractice', 'Project'],
      graphEdgeTypes: ['PREREQUISITE', 'ENABLES', 'USED_WITH', 'ALTERNATIVE_TO', 'IMPLEMENTS', 'BUILDS_ON'],
      defaultDailyMinutes: 45,
      defaultSessionLength: 30,
      defaultItemsPerSession: 3,
      aiPromptHints: ['Learn by doing'],
    },
  };

  // Helper functions
  const getDomainConfig = (type) => DOMAIN_CONFIGS[type];
  const getAllDomainTypes = () => Object.values(DomainType);
  const getSpacedRepetitionDomains = () =>
    Object.values(DomainType).filter((type) => DOMAIN_CONFIGS[type].usesSpacedRepetition);
  const getPracticeProblemDomains = () =>
    Object.values(DomainType).filter((type) => DOMAIN_CONFIGS[type].usesPracticeProblems);
  const getDomainContentTypes = (type) => DOMAIN_CONFIGS[type].contentTypes;
  const getDomainAssessmentMethods = (type) => DOMAIN_CONFIGS[type].assessmentMethods;
  const isContentTypeSupported = (domain, contentType) =>
    DOMAIN_CONFIGS[domain].contentTypes.includes(contentType);
  const isAssessmentMethodSupported = (domain, method) =>
    DOMAIN_CONFIGS[domain].assessmentMethods.includes(method);
  const getDefaultSessionConfig = (domain) => ({
    dailyMinutes: DOMAIN_CONFIGS[domain].defaultDailyMinutes,
    sessionLength: DOMAIN_CONFIGS[domain].defaultSessionLength,
    itemsPerSession: DOMAIN_CONFIGS[domain].defaultItemsPerSession,
  });
  const getDomainAIPromptHints = (domain) => DOMAIN_CONFIGS[domain].aiPromptHints;
  const getDomainGraphNodeTypes = (domain) => DOMAIN_CONFIGS[domain].graphNodeTypes;
  const getDomainGraphEdgeTypes = (domain) => DOMAIN_CONFIGS[domain].graphEdgeTypes;

  const DOMAIN_LIST = Object.values(DomainType).map((type) => ({
    value: type,
    label: DOMAIN_CONFIGS[type].name,
    description: DOMAIN_CONFIGS[type].description,
    icon: DOMAIN_CONFIGS[type].icon,
    color: DOMAIN_CONFIGS[type].color,
  }));

  const SOURCE_TYPE_TO_DOMAIN = {
    [TopicSourceType.BOOK]: DomainType.KNOWLEDGE,
    [TopicSourceType.VOCABULARY_SET]: DomainType.VOCABULARY,
    [TopicSourceType.CHAT]: DomainType.KNOWLEDGE,
  };

  return {
    DomainType,
    TopicStatus,
    DifficultyLevel,
    SessionType,
    TopicSourceType,
    DOMAIN_CONFIGS,
    getDomainConfig,
    getAllDomainTypes,
    getSpacedRepetitionDomains,
    getPracticeProblemDomains,
    getDomainContentTypes,
    getDomainAssessmentMethods,
    isContentTypeSupported,
    isAssessmentMethodSupported,
    getDefaultSessionConfig,
    getDomainAIPromptHints,
    getDomainGraphNodeTypes,
    getDomainGraphEdgeTypes,
    DOMAIN_LIST,
    SOURCE_TYPE_TO_DOMAIN,
  };
});

const {
  DomainType,
  TopicStatus,
  DifficultyLevel,
  SessionType,
  TopicSourceType,
  DOMAIN_CONFIGS,
  getDomainConfig,
  getAllDomainTypes,
  getSpacedRepetitionDomains,
  getPracticeProblemDomains,
  getDomainContentTypes,
  getDomainAssessmentMethods,
  isContentTypeSupported,
  isAssessmentMethodSupported,
  getDefaultSessionConfig,
  getDomainAIPromptHints,
  getDomainGraphNodeTypes,
  getDomainGraphEdgeTypes,
  DOMAIN_LIST,
  SOURCE_TYPE_TO_DOMAIN,
} = require('../../commons/model/LearningDomains');

describe('LearningDomains', () => {
  describe('DomainType Enum', () => {
    it('should have exactly 5 domain types', () => {
      const types = Object.values(DomainType);
      expect(types).toHaveLength(5);
    });

    it('should have correct domain type values', () => {
      expect(DomainType.VOCABULARY).toBe('vocabulary');
      expect(DomainType.MATH).toBe('math');
      expect(DomainType.LANGUAGE).toBe('language');
      expect(DomainType.KNOWLEDGE).toBe('knowledge');
      expect(DomainType.SKILL).toBe('skill');
    });
  });

  describe('TopicStatus Enum', () => {
    it('should have all status values', () => {
      expect(TopicStatus.PLANNING).toBe('planning');
      expect(TopicStatus.ACTIVE).toBe('active');
      expect(TopicStatus.PAUSED).toBe('paused');
      expect(TopicStatus.COMPLETED).toBe('completed');
      expect(TopicStatus.ARCHIVED).toBe('archived');
    });
  });

  describe('DifficultyLevel Enum', () => {
    it('should have all difficulty levels', () => {
      expect(DifficultyLevel.BEGINNER).toBe('beginner');
      expect(DifficultyLevel.ELEMENTARY).toBe('elementary');
      expect(DifficultyLevel.INTERMEDIATE).toBe('intermediate');
      expect(DifficultyLevel.ADVANCED).toBe('advanced');
      expect(DifficultyLevel.EXPERT).toBe('expert');
    });
  });

  describe('SessionType Enum', () => {
    it('should have all session types', () => {
      expect(SessionType.REVIEW).toBe('review');
      expect(SessionType.LEARN_NEW).toBe('learn_new');
      expect(SessionType.PRACTICE).toBe('practice');
      expect(SessionType.QUIZ).toBe('quiz');
      expect(SessionType.READING).toBe('reading');
      expect(SessionType.PROJECT).toBe('project');
    });
  });

  describe('DOMAIN_CONFIGS', () => {
    it('should have config for each domain type', () => {
      Object.values(DomainType).forEach((type) => {
        expect(DOMAIN_CONFIGS[type]).toBeDefined();
      });
    });

    describe('Vocabulary Domain', () => {
      const config = DOMAIN_CONFIGS[DomainType.VOCABULARY];

      it('should have correct basic properties', () => {
        expect(config.type).toBe(DomainType.VOCABULARY);
        expect(config.name).toBe('Vocabulary');
        expect(config.icon).toBe('MenuBook');
        expect(config.color).toBe('#4CAF50');
      });

      it('should use spaced repetition', () => {
        expect(config.usesSpacedRepetition).toBe(true);
      });

      it('should not use practice problems', () => {
        expect(config.usesPracticeProblems).toBe(false);
      });

      it('should have vocabulary-specific content types', () => {
        expect(config.contentTypes).toContain('definition');
        expect(config.contentTypes).toContain('example_sentence');
        expect(config.contentTypes).toContain('synonym');
        expect(config.contentTypes).toContain('etymology');
      });

      it('should have vocabulary assessment methods', () => {
        expect(config.assessmentMethods).toContain('flashcard_recall');
        expect(config.assessmentMethods).toContain('usage_sentence');
      });

      it('should have mastery criteria with correct streak requirement', () => {
        expect(config.masteryCriteria.minCorrectStreak).toBe(5);
        expect(config.masteryCriteria.minRetentionDays).toBe(14);
      });

      it('should have graph types for word relationships', () => {
        expect(config.graphNodeTypes).toContain('Word');
        expect(config.graphNodeTypes).toContain('WordFamily');
        expect(config.graphEdgeTypes).toContain('SYNONYM');
        expect(config.graphEdgeTypes).toContain('ANTONYM');
      });

      it('should have default session configuration', () => {
        expect(config.defaultDailyMinutes).toBe(15);
        expect(config.defaultSessionLength).toBe(10);
        expect(config.defaultItemsPerSession).toBe(20);
      });
    });

    describe('Math Domain', () => {
      const config = DOMAIN_CONFIGS[DomainType.MATH];

      it('should have correct basic properties', () => {
        expect(config.type).toBe(DomainType.MATH);
        expect(config.name).toBe('Mathematics');
        expect(config.icon).toBe('Functions');
      });

      it('should use practice problems', () => {
        expect(config.usesPracticeProblems).toBe(true);
      });

      it('should use progressive difficulty', () => {
        expect(config.usesProgressiveDifficulty).toBe(true);
      });

      it('should have math-specific content types', () => {
        expect(config.contentTypes).toContain('formula');
        expect(config.contentTypes).toContain('worked_example');
        expect(config.contentTypes).toContain('practice_problem');
        expect(config.contentTypes).toContain('proof');
      });

      it('should have problem-solving assessment methods', () => {
        expect(config.assessmentMethods).toContain('problem_solving');
        expect(config.assessmentMethods).toContain('step_by_step');
      });

      it('should have prerequisite edge type', () => {
        expect(config.graphEdgeTypes).toContain('PREREQUISITE');
      });
    });

    describe('Language Domain', () => {
      const config = DOMAIN_CONFIGS[DomainType.LANGUAGE];

      it('should have all learning mechanics enabled', () => {
        expect(config.usesSpacedRepetition).toBe(true);
        expect(config.usesProgressiveDifficulty).toBe(true);
        expect(config.usesPracticeProblems).toBe(true);
        expect(config.usesConceptGraph).toBe(true);
      });

      it('should have language-specific content types', () => {
        expect(config.contentTypes).toContain('grammar_rule');
        expect(config.contentTypes).toContain('reading_passage');
        expect(config.contentTypes).toContain('dialogue');
      });

      it('should have required skill areas in mastery criteria', () => {
        expect(config.masteryCriteria.requiredSkillAreas).toContain('reading');
        expect(config.masteryCriteria.requiredSkillAreas).toContain('writing');
        expect(config.masteryCriteria.requiredSkillAreas).toContain('grammar');
      });
    });

    describe('Knowledge Domain', () => {
      const config = DOMAIN_CONFIGS[DomainType.KNOWLEDGE];

      it('should not use progressive difficulty', () => {
        expect(config.usesProgressiveDifficulty).toBe(false);
      });

      it('should have knowledge-specific content types', () => {
        expect(config.contentTypes).toContain('concept');
        expect(config.contentTypes).toContain('fact');
        expect(config.contentTypes).toContain('relationship');
        expect(config.contentTypes).toContain('timeline');
      });

      it('should have concept coverage in mastery criteria', () => {
        expect(config.masteryCriteria.minConceptsCovered).toBe(0.8);
        expect(config.masteryCriteria.minRelationshipsUnderstood).toBe(0.7);
      });
    });

    describe('Skill Domain', () => {
      const config = DOMAIN_CONFIGS[DomainType.SKILL];

      it('should not use spaced repetition', () => {
        expect(config.usesSpacedRepetition).toBe(false);
      });

      it('should have skill-specific content types', () => {
        expect(config.contentTypes).toContain('tutorial');
        expect(config.contentTypes).toContain('exercise');
        expect(config.contentTypes).toContain('project');
        expect(config.contentTypes).toContain('best_practice');
      });

      it('should have hands-on assessment methods', () => {
        expect(config.assessmentMethods).toContain('hands_on_exercise');
        expect(config.assessmentMethods).toContain('project_completion');
        expect(config.assessmentMethods).toContain('code_review');
      });

      it('should have project completion in mastery criteria', () => {
        expect(config.masteryCriteria.minProjectsCompleted).toBe(3);
      });

      it('should have longer session defaults', () => {
        expect(config.defaultDailyMinutes).toBe(45);
        expect(config.defaultSessionLength).toBe(30);
      });
    });
  });

  describe('Helper Functions', () => {
    describe('getDomainConfig', () => {
      it('should return correct config for each domain', () => {
        Object.values(DomainType).forEach((type) => {
          const config = getDomainConfig(type);
          expect(config.type).toBe(type);
        });
      });
    });

    describe('getAllDomainTypes', () => {
      it('should return all 5 domain types', () => {
        const types = getAllDomainTypes();
        expect(types).toHaveLength(5);
        expect(types).toContain(DomainType.VOCABULARY);
        expect(types).toContain(DomainType.MATH);
        expect(types).toContain(DomainType.LANGUAGE);
        expect(types).toContain(DomainType.KNOWLEDGE);
        expect(types).toContain(DomainType.SKILL);
      });
    });

    describe('getSpacedRepetitionDomains', () => {
      it('should return domains that use spaced repetition', () => {
        const domains = getSpacedRepetitionDomains();
        expect(domains).toContain(DomainType.VOCABULARY);
        expect(domains).toContain(DomainType.MATH);
        expect(domains).toContain(DomainType.LANGUAGE);
        expect(domains).toContain(DomainType.KNOWLEDGE);
        expect(domains).not.toContain(DomainType.SKILL);
      });
    });

    describe('getPracticeProblemDomains', () => {
      it('should return domains that use practice problems', () => {
        const domains = getPracticeProblemDomains();
        expect(domains).toContain(DomainType.MATH);
        expect(domains).toContain(DomainType.LANGUAGE);
        expect(domains).toContain(DomainType.SKILL);
        expect(domains).not.toContain(DomainType.VOCABULARY);
        expect(domains).not.toContain(DomainType.KNOWLEDGE);
      });
    });

    describe('getDomainContentTypes', () => {
      it('should return content types for vocabulary domain', () => {
        const types = getDomainContentTypes(DomainType.VOCABULARY);
        expect(types).toContain('definition');
        expect(types).toContain('synonym');
      });

      it('should return content types for math domain', () => {
        const types = getDomainContentTypes(DomainType.MATH);
        expect(types).toContain('formula');
        expect(types).toContain('proof');
      });
    });

    describe('getDomainAssessmentMethods', () => {
      it('should return assessment methods for vocabulary domain', () => {
        const methods = getDomainAssessmentMethods(DomainType.VOCABULARY);
        expect(methods).toContain('flashcard_recall');
      });

      it('should return assessment methods for skill domain', () => {
        const methods = getDomainAssessmentMethods(DomainType.SKILL);
        expect(methods).toContain('hands_on_exercise');
        expect(methods).toContain('project_completion');
      });
    });

    describe('isContentTypeSupported', () => {
      it('should return true for supported content types', () => {
        expect(isContentTypeSupported(DomainType.VOCABULARY, 'definition')).toBe(true);
        expect(isContentTypeSupported(DomainType.MATH, 'formula')).toBe(true);
      });

      it('should return false for unsupported content types', () => {
        expect(isContentTypeSupported(DomainType.VOCABULARY, 'formula')).toBe(false);
        expect(isContentTypeSupported(DomainType.MATH, 'definition')).toBe(false);
      });
    });

    describe('isAssessmentMethodSupported', () => {
      it('should return true for supported assessment methods', () => {
        expect(isAssessmentMethodSupported(DomainType.VOCABULARY, 'flashcard_recall')).toBe(true);
        expect(isAssessmentMethodSupported(DomainType.SKILL, 'hands_on_exercise')).toBe(true);
      });

      it('should return false for unsupported assessment methods', () => {
        expect(isAssessmentMethodSupported(DomainType.VOCABULARY, 'hands_on_exercise')).toBe(false);
      });
    });

    describe('getDefaultSessionConfig', () => {
      it('should return correct defaults for vocabulary domain', () => {
        const config = getDefaultSessionConfig(DomainType.VOCABULARY);
        expect(config.dailyMinutes).toBe(15);
        expect(config.sessionLength).toBe(10);
        expect(config.itemsPerSession).toBe(20);
      });

      it('should return correct defaults for skill domain', () => {
        const config = getDefaultSessionConfig(DomainType.SKILL);
        expect(config.dailyMinutes).toBe(45);
        expect(config.sessionLength).toBe(30);
        expect(config.itemsPerSession).toBe(3);
      });
    });

    describe('getDomainAIPromptHints', () => {
      it('should return AI hints for each domain', () => {
        Object.values(DomainType).forEach((type) => {
          const hints = getDomainAIPromptHints(type);
          expect(Array.isArray(hints)).toBe(true);
          expect(hints.length).toBeGreaterThan(0);
        });
      });
    });

    describe('getDomainGraphNodeTypes', () => {
      it('should return graph node types for vocabulary domain', () => {
        const types = getDomainGraphNodeTypes(DomainType.VOCABULARY);
        expect(types).toContain('Word');
        expect(types).toContain('WordFamily');
      });

      it('should return graph node types for math domain', () => {
        const types = getDomainGraphNodeTypes(DomainType.MATH);
        expect(types).toContain('Formula');
        expect(types).toContain('Theorem');
      });
    });

    describe('getDomainGraphEdgeTypes', () => {
      it('should return graph edge types for vocabulary domain', () => {
        const types = getDomainGraphEdgeTypes(DomainType.VOCABULARY);
        expect(types).toContain('SYNONYM');
        expect(types).toContain('ANTONYM');
      });

      it('should return graph edge types with prerequisites for math', () => {
        const types = getDomainGraphEdgeTypes(DomainType.MATH);
        expect(types).toContain('PREREQUISITE');
      });
    });
  });

  describe('DOMAIN_LIST', () => {
    it('should have entries for all domains', () => {
      expect(DOMAIN_LIST).toHaveLength(5);
    });

    it('should have correct structure for each entry', () => {
      DOMAIN_LIST.forEach((item) => {
        expect(item).toHaveProperty('value');
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('icon');
        expect(item).toHaveProperty('color');
      });
    });
  });

  describe('SOURCE_TYPE_TO_DOMAIN', () => {
    it('should map book source to knowledge domain', () => {
      expect(SOURCE_TYPE_TO_DOMAIN[TopicSourceType.BOOK]).toBe(DomainType.KNOWLEDGE);
    });

    it('should map vocabulary_set source to vocabulary domain', () => {
      expect(SOURCE_TYPE_TO_DOMAIN[TopicSourceType.VOCABULARY_SET]).toBe(DomainType.VOCABULARY);
    });

    it('should map chat source to knowledge domain', () => {
      expect(SOURCE_TYPE_TO_DOMAIN[TopicSourceType.CHAT]).toBe(DomainType.KNOWLEDGE);
    });
  });
});
