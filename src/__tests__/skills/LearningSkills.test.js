/**
 * Comprehensive Tests for Learning Skills
 *
 * Tests for:
 * - DomainDetectionSkill
 * - LearningPlanCreateSkill
 * - LearningPlanProgressSkill
 * - LearningSessionSkill
 */

const DomainDetectionSkill = require('../../main/skills/learning/DomainDetectionSkill');
const LearningPlanCreateSkill = require('../../main/skills/learning/LearningPlanCreateSkill');
const LearningPlanProgressSkill = require('../../main/skills/learning/LearningPlanProgressSkill');
const LearningSessionSkill = require('../../main/skills/learning/LearningSessionSkill');

// Mock AI provider
const mockAIProvider = {
  generateContentWithJson: jest.fn(),
};

// =============================================================================
// DomainDetectionSkill Tests
// =============================================================================

describe('DomainDetectionSkill', () => {
  let skill;

  beforeEach(() => {
    skill = new DomainDetectionSkill();
    skill.context = {};
    jest.clearAllMocks();
  });

  describe('static properties', () => {
    it('should have correct name', () => {
      expect(DomainDetectionSkill.name).toBe('detect_domain');
    });

    it('should have correct category', () => {
      expect(DomainDetectionSkill.category).toBe('learning');
    });

    it('should have required parameters', () => {
      expect(DomainDetectionSkill.requiredParams).toContain('text');
    });

    it('should have useAI parameter', () => {
      expect(DomainDetectionSkill.parameters.useAI).toBeDefined();
      expect(DomainDetectionSkill.parameters.useAI.type).toBe('boolean');
      expect(DomainDetectionSkill.parameters.useAI.default).toBe(false);
    });

    it('should have sourceType parameter with valid enum', () => {
      expect(DomainDetectionSkill.parameters.sourceType).toBeDefined();
      expect(DomainDetectionSkill.parameters.sourceType.enum).toContain('book');
      expect(DomainDetectionSkill.parameters.sourceType.enum).toContain('article');
      expect(DomainDetectionSkill.parameters.sourceType.enum).toContain('vocabulary_set');
    });

    it('should have description', () => {
      expect(DomainDetectionSkill.description).toBeDefined();
      expect(DomainDetectionSkill.description.length).toBeGreaterThan(20);
    });
  });

  describe('rule-based detection - vocabulary domain', () => {
    it('should detect vocabulary domain from word definitions', async () => {
      const result = await skill.execute({
        text: 'Learn vocabulary words and their definitions. GRE SAT TOEFL word list.',
      });

      expect(result.domain).toBe('vocabulary');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.method).toBe('rule_based');
    });

    it('should detect vocabulary from dictionary-style content', async () => {
      const result = await skill.execute({
        text: 'Etymology of the word. Pronunciation guide. Synonym and antonym pairs. Lexicon study.',
      });

      expect(result.domain).toBe('vocabulary');
    });

    it('should detect vocabulary from test prep content', async () => {
      const result = await skill.execute({
        text: 'IELTS vocabulary preparation. Word meaning and usage in context.',
      });

      expect(result.domain).toBe('vocabulary');
    });

    it('should detect vocabulary from flashcard-style content', async () => {
      const result = await skill.execute({
        text: 'Define the following words. Glossary terms and their meanings.',
      });

      expect(result.domain).toBe('vocabulary');
    });
  });

  describe('rule-based detection - math domain', () => {
    it('should detect math domain from equations', async () => {
      const result = await skill.execute({
        text: 'Solve the equation x = 5 + 3. Calculate the derivative of f(x). Theorem proof.',
      });

      expect(result.domain).toBe('math');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect math from calculus content', async () => {
      const result = await skill.execute({
        text: 'Find the integral of the function. Derivative rules and applications.',
      });

      expect(result.domain).toBe('math');
    });

    it('should detect math from algebra content', async () => {
      const result = await skill.execute({
        text: 'Solve the polynomial equation. Coefficient values and variable substitution.',
      });

      expect(result.domain).toBe('math');
    });

    it('should detect math from geometry content', async () => {
      const result = await skill.execute({
        text: 'Calculate using trigonometry formulas. sin cos tan functions.',
      });

      expect(result.domain).toBe('math');
    });

    it('should detect math from mathematical expressions', async () => {
      const result = await skill.execute({
        text: 'Evaluate 2 + 3 * 5 = 17. Simplify the expression.',
      });

      expect(result.domain).toBe('math');
    });

    it('should detect math from statistics content', async () => {
      const result = await skill.execute({
        text: 'Calculate the probability distribution. Statistics and matrix operations.',
      });

      expect(result.domain).toBe('math');
    });
  });

  describe('rule-based detection - language domain', () => {
    it('should detect language domain from grammar content', async () => {
      const result = await skill.execute({
        text: 'Present tense conjugation. Grammar rules for English. Translate from Spanish.',
      });

      expect(result.domain).toBe('language');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect language from verb tenses', async () => {
      const result = await skill.execute({
        text: 'Present perfect tense usage. Past continuous examples. Future simple structure.',
      });

      expect(result.domain).toBe('language');
    });

    it('should detect language from parts of speech content', async () => {
      const result = await skill.execute({
        text: 'Identify the noun, verb, and adjective in the sentence. Adverb placement rules.',
      });

      expect(result.domain).toBe('language');
    });

    it('should detect language from translation content', async () => {
      const result = await skill.execute({
        text: 'Translate the phrase from French to English. Spanish lesson for beginners.',
      });

      expect(result.domain).toBe('language');
    });

    it('should detect language from sentence structure', async () => {
      const result = await skill.execute({
        text: 'Subject and predicate identification. Clause structure and preposition usage.',
      });

      expect(result.domain).toBe('language');
    });
  });

  describe('rule-based detection - knowledge domain', () => {
    it('should detect knowledge domain from factual content', async () => {
      const result = await skill.execute({
        text: 'The history of ancient Rome. Understanding the concept of democracy. Learn about biology.',
      });

      expect(result.domain).toBe('knowledge');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect knowledge from science content', async () => {
      const result = await skill.execute({
        text: 'The theory of evolution. Chemistry principles and physics concepts.',
      });

      expect(result.domain).toBe('knowledge');
    });

    it('should detect knowledge from questions about facts', async () => {
      const result = await skill.execute({
        text: 'What is the capital of France? Why did World War II start? How does photosynthesis work?',
      });

      expect(result.domain).toBe('knowledge');
    });

    it('should detect knowledge from social sciences', async () => {
      const result = await skill.execute({
        text: 'Psychology of learning. Economic principles. Sociology and anthropology concepts.',
      });

      expect(result.domain).toBe('knowledge');
    });

    it('should detect knowledge from explanatory content', async () => {
      const result = await skill.execute({
        text: 'Understanding how the brain works. The science of climate change.',
      });

      expect(result.domain).toBe('knowledge');
    });
  });

  describe('rule-based detection - skill domain', () => {
    it('should detect skill domain from programming content', async () => {
      const result = await skill.execute({
        text: 'How to build a React application. Step by step tutorial for JavaScript. Learn programming.',
      });

      expect(result.domain).toBe('skill');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect skill from code examples', async () => {
      const result = await skill.execute({
        text: 'Create a function to handle API requests. Debug the code and test deployment.',
      });

      expect(result.domain).toBe('skill');
    });

    it('should detect skill from tutorial content', async () => {
      const result = await skill.execute({
        text: 'Step-by-step guide for building a website. Tutorial for Python programming.',
      });

      expect(result.domain).toBe('skill');
    });

    it('should detect skill from code blocks', async () => {
      const result = await skill.execute({
        text: '```javascript\nfunction hello() { console.log("hello"); }\n```',
      });

      expect(result.domain).toBe('skill');
    });

    it('should detect skill from framework content', async () => {
      const result = await skill.execute({
        text: 'Learn Node.js framework. CSS styling and HTML structure basics.',
      });

      expect(result.domain).toBe('skill');
    });

    it('should detect skill from project-based content', async () => {
      const result = await skill.execute({
        text: 'Build a REST API. Implement the algorithm and develop the feature.',
      });

      expect(result.domain).toBe('skill');
    });
  });

  describe('title influence on detection', () => {
    it('should use title to influence domain detection', async () => {
      const result = await skill.execute({
        text: 'Some general content',
        title: 'GRE Vocabulary Master List',
      });

      expect(result.domain).toBe('vocabulary');
    });

    it('should combine title and text for better accuracy', async () => {
      const result = await skill.execute({
        text: 'Learn the following items',
        title: 'Calculus Formulas and Theorems',
      });

      expect(result.domain).toBe('math');
    });

    it('should handle empty title gracefully', async () => {
      const result = await skill.execute({
        text: 'Vocabulary words and definitions',
        title: '',
      });

      expect(result.domain).toBe('vocabulary');
    });
  });

  describe('result structure', () => {
    it('should return all domains with scores', async () => {
      const result = await skill.execute({
        text: 'Learn vocabulary words.',
      });

      expect(result.allDomains).toBeDefined();
      expect(result.allDomains.length).toBe(5);
      expect(result.allDomains[0].score).toBeGreaterThanOrEqual(result.allDomains[1].score);
    });

    it('should return confidence between 0 and 1', async () => {
      const result = await skill.execute({
        text: 'Some text content',
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include method in result', async () => {
      const result = await skill.execute({
        text: 'Some text',
      });

      expect(result.method).toBeDefined();
      expect(result.method).toBe('rule_based');
    });

    it('should include details for the detected domain', async () => {
      const result = await skill.execute({
        text: 'Vocabulary word definitions',
      });

      expect(result.details).toBeDefined();
      expect(result.details.score).toBeDefined();
      expect(result.details.matches).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', async () => {
      const result = await skill.execute({
        text: '',
      });

      expect(result.domain).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle very short text', async () => {
      const result = await skill.execute({
        text: 'hi',
      });

      expect(result.domain).toBeDefined();
    });

    it('should handle text with no clear domain indicators', async () => {
      const result = await skill.execute({
        text: 'The quick brown fox jumps over the lazy dog.',
      });

      // Should default to knowledge
      expect(result.domain).toBe('knowledge');
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should handle mixed domain content', async () => {
      const result = await skill.execute({
        text: 'Vocabulary for math: equation, formula, variable. Grammar for writing equations.',
      });

      expect(result.domain).toBeDefined();
      expect(result.allDomains.length).toBe(5);
    });
  });

  describe('AI-enhanced detection', () => {
    beforeEach(() => {
      skill.getAIProvider = jest.fn().mockReturnValue(mockAIProvider);
    });

    it('should use AI when requested and confidence is low', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        domain: 'knowledge',
        confidence: 0.85,
        reasoning: 'Content discusses historical facts',
        suggestedTitle: 'History Overview',
        suggestedDescription: 'Learn about historical events',
        contentTypes: ['facts', 'concepts'],
      });

      const result = await skill.execute({
        text: 'Some ambiguous content that could be multiple domains',
        useAI: true,
      });

      expect(result.method).toBe('ai_enhanced');
      expect(result.reasoning).toBeDefined();
    });

    it('should skip AI when rule-based confidence is high', async () => {
      const result = await skill.execute({
        text: 'Vocabulary word definition synonym antonym etymology pronunciation GRE SAT TOEFL word list meaning',
        useAI: true,
      });

      // High confidence rule-based result should skip AI
      expect(result.method).toBe('rule_based');
    });

    it('should fall back to rule-based when AI unavailable', async () => {
      skill.getAIProvider = jest.fn().mockReturnValue(null);

      const result = await skill.execute({
        text: 'Learn vocabulary words.',
        useAI: true,
      });

      expect(result.method).toMatch(/rule_based/);
    });

    it('should fall back to rule-based when AI fails', async () => {
      mockAIProvider.generateContentWithJson.mockRejectedValue(new Error('AI error'));

      const result = await skill.execute({
        text: 'Some ambiguous content',
        useAI: true,
      });

      expect(result.method).toBe('rule_based_fallback');
      expect(result.error).toBeDefined();
    });

    it('should include AI suggestions in result', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        domain: 'vocabulary',
        confidence: 0.9,
        reasoning: 'Word-based learning content',
        suggestedTitle: 'Word Study',
        suggestedDescription: 'Learn new words',
        contentTypes: ['definitions', 'examples'],
      });

      const result = await skill.execute({
        text: 'Some ambiguous content',
        useAI: true,
      });

      expect(result.suggestedTitle).toBe('Word Study');
      expect(result.suggestedDescription).toBeDefined();
      expect(result.contentTypes).toBeDefined();
    });

    it('should include rule-based hint in AI result', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        domain: 'vocabulary',
        confidence: 0.9,
      });

      const result = await skill.execute({
        text: 'Some content',
        useAI: true,
      });

      expect(result.ruleBasedHint).toBeDefined();
      expect(result.ruleBasedHint.domain).toBeDefined();
      expect(result.ruleBasedHint.confidence).toBeDefined();
    });
  });
});

// =============================================================================
// LearningPlanCreateSkill Tests
// =============================================================================

describe('LearningPlanCreateSkill', () => {
  let skill;

  beforeEach(() => {
    skill = new LearningPlanCreateSkill();
    skill.context = {};
    jest.clearAllMocks();
  });

  describe('static properties', () => {
    it('should have correct name', () => {
      expect(LearningPlanCreateSkill.name).toBe('create_learning_plan');
    });

    it('should have correct category', () => {
      expect(LearningPlanCreateSkill.category).toBe('learning');
    });

    it('should have required parameters', () => {
      expect(LearningPlanCreateSkill.requiredParams).toContain('topicId');
      expect(LearningPlanCreateSkill.requiredParams).toContain('topicName');
      expect(LearningPlanCreateSkill.requiredParams).toContain('domainType');
    });

    it('should have domainType enum', () => {
      expect(LearningPlanCreateSkill.parameters.domainType.enum).toContain('vocabulary');
      expect(LearningPlanCreateSkill.parameters.domainType.enum).toContain('math');
      expect(LearningPlanCreateSkill.parameters.domainType.enum).toContain('language');
      expect(LearningPlanCreateSkill.parameters.domainType.enum).toContain('knowledge');
      expect(LearningPlanCreateSkill.parameters.domainType.enum).toContain('skill');
    });

    it('should have difficulty enum', () => {
      expect(LearningPlanCreateSkill.parameters.difficulty.enum).toContain('beginner');
      expect(LearningPlanCreateSkill.parameters.difficulty.enum).toContain('intermediate');
      expect(LearningPlanCreateSkill.parameters.difficulty.enum).toContain('expert');
      expect(LearningPlanCreateSkill.parameters.difficulty.enum).toContain('auto');
    });

    it('should have learningStyle enum', () => {
      expect(LearningPlanCreateSkill.parameters.learningStyle.enum).toContain('visual');
      expect(LearningPlanCreateSkill.parameters.learningStyle.enum).toContain('reading');
      expect(LearningPlanCreateSkill.parameters.learningStyle.enum).toContain('hands_on');
    });
  });

  describe('plan creation - vocabulary domain', () => {
    it('should create a vocabulary learning plan', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'GRE Vocabulary',
        domainType: 'vocabulary',
        totalItems: 500,
        difficulty: 'intermediate',
      });

      expect(result.id).toBeDefined();
      expect(result.planData).toBeDefined();
      expect(result.planData.phases).toBeDefined();
      expect(result.planData.phases.length).toBeGreaterThan(0);
    });

    it('should include spaced repetition for vocabulary', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'SAT Words',
        domainType: 'vocabulary',
      });

      expect(result.planData.domainConfig.usesSpacedRepetition).toBe(true);
    });

    it('should include vocabulary-specific session types', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'TOEFL Vocabulary',
        domainType: 'vocabulary',
      });

      expect(result.planData.domainConfig.sessionTypes).toContain('review');
    });
  });

  describe('plan creation - math domain', () => {
    it('should create a math learning plan', async () => {
      const result = await skill.execute({
        topicId: 'topic_456',
        topicName: 'Calculus',
        domainType: 'math',
        totalItems: 100,
      });

      expect(result.id).toMatch(/^plan_/);
      expect(result.planData.domainConfig).toBeDefined();
    });

    it('should include practice session type for math', async () => {
      const result = await skill.execute({
        topicId: 'topic_456',
        topicName: 'Algebra',
        domainType: 'math',
      });

      expect(result.planData.domainConfig.sessionTypes).toContain('practice');
    });

    it('should include math-specific item types', async () => {
      const result = await skill.execute({
        topicId: 'topic_456',
        topicName: 'Geometry',
        domainType: 'math',
      });

      expect(result.planData.domainConfig.itemTypes).toContain('problem');
      expect(result.planData.domainConfig.itemTypes).toContain('formula');
    });
  });

  describe('plan creation - language domain', () => {
    it('should create a language learning plan', async () => {
      const result = await skill.execute({
        topicId: 'topic_789',
        topicName: 'Spanish Language',
        domainType: 'language',
      });

      expect(result.planData.milestones).toBeDefined();
      expect(result.planData.milestones.length).toBeGreaterThan(0);
    });

    it('should have more phases for language learning', async () => {
      const result = await skill.execute({
        topicId: 'topic_789',
        topicName: 'French',
        domainType: 'language',
      });

      // Language has 5 default phases
      expect(result.planData.totalPhases).toBeGreaterThanOrEqual(2);
    });

    it('should include reading and practice for language', async () => {
      const result = await skill.execute({
        topicId: 'topic_789',
        topicName: 'German',
        domainType: 'language',
      });

      expect(result.planData.domainConfig.sessionTypes).toContain('practice');
      expect(result.planData.domainConfig.sessionTypes).toContain('reading');
    });
  });

  describe('plan creation - knowledge domain', () => {
    it('should create a knowledge learning plan', async () => {
      const result = await skill.execute({
        topicId: 'topic_abc',
        topicName: 'World History',
        domainType: 'knowledge',
      });

      expect(result.planData.dailySchedule).toBeDefined();
      expect(result.planData.dailySchedule.sessionDurationMinutes).toBeGreaterThan(0);
    });

    it('should include reading session type for knowledge', async () => {
      const result = await skill.execute({
        topicId: 'topic_abc',
        topicName: 'Biology',
        domainType: 'knowledge',
      });

      expect(result.planData.domainConfig.sessionTypes).toContain('reading');
    });

    it('should include concept and fact item types', async () => {
      const result = await skill.execute({
        topicId: 'topic_abc',
        topicName: 'Physics',
        domainType: 'knowledge',
      });

      expect(result.planData.domainConfig.itemTypes).toContain('concept');
      expect(result.planData.domainConfig.itemTypes).toContain('fact');
    });
  });

  describe('plan creation - skill domain', () => {
    it('should create a skill learning plan', async () => {
      const result = await skill.execute({
        topicId: 'topic_def',
        topicName: 'React Programming',
        domainType: 'skill',
        dailyMinutes: 60,
      });

      expect(result.planData.dailySchedule.recommendedSessions).toBe(2);
      expect(result.planData.dailySchedule.sessionDurationMinutes).toBe(30);
    });

    it('should not use spaced repetition for skills', async () => {
      const result = await skill.execute({
        topicId: 'topic_def',
        topicName: 'JavaScript',
        domainType: 'skill',
      });

      expect(result.planData.domainConfig.usesSpacedRepetition).toBe(false);
    });

    it('should include project session type for skills', async () => {
      const result = await skill.execute({
        topicId: 'topic_def',
        topicName: 'Python',
        domainType: 'skill',
      });

      expect(result.planData.domainConfig.sessionTypes).toContain('project');
    });
  });

  describe('plan structure', () => {
    it('should include milestones', async () => {
      const result = await skill.execute({
        topicId: 'topic_789',
        topicName: 'Spanish Language',
        domainType: 'language',
      });

      expect(result.planData.milestones).toBeDefined();
      expect(result.planData.milestones.length).toBeGreaterThan(0);
      expect(result.planData.milestones[0].id).toBeDefined();
      expect(result.planData.milestones[0].type).toBeDefined();
    });

    it('should include daily schedule', async () => {
      const result = await skill.execute({
        topicId: 'topic_abc',
        topicName: 'World History',
        domainType: 'knowledge',
      });

      expect(result.planData.dailySchedule).toBeDefined();
      expect(result.planData.dailySchedule.recommendedSessions).toBeDefined();
      expect(result.planData.dailySchedule.newItemsPercent).toBeDefined();
      expect(result.planData.dailySchedule.reviewPercent).toBeDefined();
    });

    it('should include assessment checkpoints', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test Topic',
        domainType: 'vocabulary',
      });

      expect(result.planData.assessmentCheckpoints).toBeDefined();
      expect(result.planData.assessmentCheckpoints.length).toBeGreaterThan(0);
    });

    it('should include recommendations', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test Topic',
        domainType: 'vocabulary',
      });

      expect(result.planData.recommendations).toBeDefined();
      expect(result.planData.recommendations.length).toBeGreaterThan(0);
    });

    it('should have proper phase structure', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test Topic',
        domainType: 'vocabulary',
      });

      const phase = result.planData.phases[0];
      expect(phase.phaseNumber).toBe(1);
      expect(phase.name).toBeDefined();
      expect(phase.description).toBeDefined();
      expect(phase.startDay).toBeDefined();
      expect(phase.endDay).toBeDefined();
      expect(phase.durationDays).toBeDefined();
      expect(phase.goals).toBeDefined();
      expect(phase.completionCriteria).toBeDefined();
    });
  });

  describe('duration calculation', () => {
    it('should calculate duration from totalItems', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Large Vocabulary Set',
        domainType: 'vocabulary',
        totalItems: 1000,
        dailyMinutes: 30,
      });

      expect(result.planData.estimatedDuration).toBeGreaterThan(30);
    });

    it('should calculate duration from target date', async () => {
      const targetDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days from now
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test Topic',
        domainType: 'vocabulary',
        targetDate: targetDate.toISOString(),
      });

      expect(result.planData.estimatedDuration).toBeLessThanOrEqual(60);
    });

    it('should default to 30 days when no duration info', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test Topic',
        domainType: 'vocabulary',
      });

      expect(result.planData.estimatedDuration).toBe(30);
    });
  });

  describe('plan metadata', () => {
    it('should include plan ID', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test',
        domainType: 'vocabulary',
      });

      expect(result.id).toMatch(/^plan_/);
    });

    it('should include timestamps', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test',
        domainType: 'vocabulary',
      });

      expect(result.startedAt).toBeDefined();
      expect(result.targetCompletionAt).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should include status', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test',
        domainType: 'vocabulary',
      });

      expect(result.status).toBe('active');
      expect(result.currentPhase).toBe(1);
      expect(result.currentDay).toBe(1);
    });
  });

  describe('AI-enhanced plan creation', () => {
    beforeEach(() => {
      skill.getAIProvider = jest.fn().mockReturnValue(mockAIProvider);
    });

    it('should use AI for personalized overview when content sample provided', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        overview: 'Master GRE vocabulary through systematic learning',
        phases: [
          { name: 'Foundation Building', description: 'Learn roots and prefixes', goals: ['Start with roots'], focusAreas: ['word roots'] },
        ],
        recommendations: ['Focus on word families'],
      });

      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'GRE Vocabulary',
        domainType: 'vocabulary',
        contentSample: 'Sample vocabulary content for GRE preparation...',
      });

      expect(result.planData.overview).toBeDefined();
    });

    it('should incorporate AI phase names', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        overview: 'Custom overview',
        phases: [
          { name: 'Custom Phase 1', description: 'Custom description', goals: ['Custom goal'], focusAreas: ['Custom area'] },
        ],
        recommendations: ['Custom recommendation'],
      });

      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test',
        domainType: 'vocabulary',
        contentSample: 'Sample content',
      });

      expect(result.planData.phases[0].name).toBe('Custom Phase 1');
    });

    it('should incorporate AI recommendations', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        overview: 'Test',
        phases: [],
        recommendations: ['AI recommendation 1', 'AI recommendation 2'],
      });

      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test',
        domainType: 'vocabulary',
        contentSample: 'Sample content',
      });

      expect(result.planData.recommendations).toContain('AI recommendation 1');
    });

    it('should fall back gracefully when AI fails', async () => {
      mockAIProvider.generateContentWithJson.mockRejectedValue(new Error('AI error'));

      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test',
        domainType: 'vocabulary',
        contentSample: 'Sample content',
      });

      // Should still return a valid plan
      expect(result.id).toBeDefined();
      expect(result.planData.phases.length).toBeGreaterThan(0);
    });
  });

  describe('learning style adaptation', () => {
    it('should adapt activities for visual learners', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Test',
        domainType: 'vocabulary',
        learningStyle: 'visual',
      });

      expect(result.planData.learningStyle).toBe('visual');
      expect(result.planData.dailySchedule.suggestedActivities).toBeDefined();
    });

    it('should adapt activities for hands-on learners', async () => {
      const result = await skill.execute({
        topicId: 'topic_123',
        topicName: 'Programming',
        domainType: 'skill',
        learningStyle: 'hands_on',
      });

      expect(result.planData.learningStyle).toBe('hands_on');
    });
  });
});

// =============================================================================
// LearningPlanProgressSkill Tests
// =============================================================================

describe('LearningPlanProgressSkill', () => {
  let skill;

  beforeEach(() => {
    skill = new LearningPlanProgressSkill();
    skill.context = {};
    jest.clearAllMocks();
  });

  describe('static properties', () => {
    it('should have correct name', () => {
      expect(LearningPlanProgressSkill.name).toBe('update_plan_progress');
    });

    it('should have correct category', () => {
      expect(LearningPlanProgressSkill.category).toBe('learning');
    });

    it('should have action parameter with enum', () => {
      expect(LearningPlanProgressSkill.parameters.action.enum).toContain('record_session');
      expect(LearningPlanProgressSkill.parameters.action.enum).toContain('check_progress');
      expect(LearningPlanProgressSkill.parameters.action.enum).toContain('advance_phase');
      expect(LearningPlanProgressSkill.parameters.action.enum).toContain('complete_milestone');
      expect(LearningPlanProgressSkill.parameters.action.enum).toContain('get_statistics');
      expect(LearningPlanProgressSkill.parameters.action.enum).toContain('suggest_adjustments');
    });

    it('should require action parameter', () => {
      expect(LearningPlanProgressSkill.requiredParams).toContain('action');
    });
  });

  describe('record_session action', () => {
    it('should record session data', async () => {
      const result = await skill.execute({
        action: 'record_session',
        planId: 'plan_123',
        topicId: 'topic_456',
        sessionData: {
          itemsReviewed: 20,
          itemsCorrect: 18,
          itemsNew: 5,
          durationMinutes: 30,
          sessionType: 'review',
        },
      });

      expect(result.success).toBe(true);
      expect(result.progressUpdate).toBeDefined();
      expect(result.progressUpdate.session.accuracy).toBe(0.9);
    });

    it('should calculate accuracy correctly', async () => {
      const result = await skill.execute({
        action: 'record_session',
        sessionData: {
          itemsReviewed: 10,
          itemsCorrect: 7,
        },
      });

      expect(result.progressUpdate.session.accuracy).toBe(0.7);
    });

    it('should handle zero items reviewed', async () => {
      const result = await skill.execute({
        action: 'record_session',
        sessionData: {
          itemsReviewed: 0,
          itemsCorrect: 0,
        },
      });

      expect(result.progressUpdate.session.accuracy).toBe(0);
    });

    it('should check for achievements', async () => {
      const result = await skill.execute({
        action: 'record_session',
        sessionData: {
          itemsReviewed: 50,
          itemsCorrect: 50,
          itemsNew: 0,
          durationMinutes: 60,
        },
      });

      expect(result.achievements).toBeDefined();
      expect(result.achievements.length).toBeGreaterThan(0);
    });

    it('should award perfect session achievement', async () => {
      const result = await skill.execute({
        action: 'record_session',
        sessionData: {
          itemsReviewed: 15,
          itemsCorrect: 15,
          durationMinutes: 20,
        },
      });

      const perfectAchievement = result.achievements.find(a => a.type === 'perfect_session');
      expect(perfectAchievement).toBeDefined();
    });

    it('should award marathon achievement', async () => {
      const result = await skill.execute({
        action: 'record_session',
        sessionData: {
          itemsReviewed: 55,
          itemsCorrect: 40,
          durationMinutes: 90,
        },
      });

      const marathonAchievement = result.achievements.find(a => a.type === 'marathon_session');
      expect(marathonAchievement).toBeDefined();
    });

    it('should suggest next session', async () => {
      const result = await skill.execute({
        action: 'record_session',
        sessionData: {
          itemsReviewed: 20,
          itemsCorrect: 12,
          durationMinutes: 30,
        },
      });

      expect(result.nextSessionSuggestion).toBeDefined();
      expect(result.nextSessionSuggestion.type).toBeDefined();
    });

    it('should suggest review for low accuracy', async () => {
      const result = await skill.execute({
        action: 'record_session',
        sessionData: {
          itemsReviewed: 20,
          itemsCorrect: 8, // 8/20 = 0.4 accuracy, which is < 0.6
          durationMinutes: 30,
        },
      });

      expect(result.nextSessionSuggestion.type).toBe('review');
    });

    it('should suggest new content for high accuracy', async () => {
      const result = await skill.execute({
        action: 'record_session',
        sessionData: {
          itemsReviewed: 20,
          itemsCorrect: 19, // 19/20 = 0.95 accuracy, which is >= 0.9
          durationMinutes: 30,
        },
      });

      expect(result.nextSessionSuggestion.type).toBe('learn_new');
    });

    it('should require sessionData', async () => {
      await expect(skill.execute({
        action: 'record_session',
        planId: 'plan_123',
      })).rejects.toThrow('sessionData is required');
    });
  });

  describe('check_progress action', () => {
    const mockCurrentPlan = {
      currentPhase: 2,
      currentDay: 15,
      startedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      planData: {
        estimatedDuration: 30,
        phases: [
          { name: 'Phase 1', startDay: 1, endDay: 10, durationDays: 10 },
          { name: 'Phase 2', startDay: 11, endDay: 20, durationDays: 10 },
          { name: 'Phase 3', startDay: 21, endDay: 30, durationDays: 10 },
        ],
        milestones: [
          { id: 'm1', targetDay: 10, completed: true },
          { id: 'm2', targetDay: 20, completed: false },
        ],
      },
    };

    it('should return progress status', async () => {
      const result = await skill.execute({
        action: 'check_progress',
        planId: 'plan_123',
        currentPlan: mockCurrentPlan,
      });

      expect(result.success).toBe(true);
      expect(result.progress).toBeDefined();
      expect(result.progress.dayProgress).toBe(50);
      expect(result.onTrack).toBeDefined();
    });

    it('should calculate phase progress', async () => {
      const result = await skill.execute({
        action: 'check_progress',
        currentPlan: mockCurrentPlan,
      });

      expect(result.progress.currentPhase).toBe(2);
      expect(result.progress.totalPhases).toBe(3);
    });

    it('should include current phase data', async () => {
      const result = await skill.execute({
        action: 'check_progress',
        currentPlan: mockCurrentPlan,
      });

      expect(result.progress.currentPhaseData).toBeDefined();
      expect(result.progress.currentPhaseData.name).toBe('Phase 2');
    });

    it('should find upcoming milestones', async () => {
      const result = await skill.execute({
        action: 'check_progress',
        currentPlan: mockCurrentPlan,
      });

      expect(result.upcomingMilestones).toBeDefined();
    });

    it('should determine if on track', async () => {
      const result = await skill.execute({
        action: 'check_progress',
        currentPlan: mockCurrentPlan,
      });

      expect(result.onTrack).toBeDefined();
      expect(result.onTrack.isOnTrack).toBeDefined();
      expect(result.onTrack.status).toBeDefined();
    });

    it('should require currentPlan', async () => {
      const result = await skill.execute({
        action: 'check_progress',
        planId: 'plan_123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('currentPlan is required');
    });
  });

  describe('advance_phase action', () => {
    it('should advance to next phase', async () => {
      const result = await skill.execute({
        action: 'advance_phase',
        planId: 'plan_123',
        currentPlan: {
          currentPhase: 1,
          planData: {
            phases: [
              { name: 'Phase 1', goals: ['Learn basics'] },
              { name: 'Phase 2', description: 'Advanced learning', goals: ['Master concepts'], durationDays: 10, startDay: 11 },
            ],
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.newPhase).toBe(2);
      expect(result.transitionSummary).toBeDefined();
    });

    it('should include transition summary', async () => {
      const result = await skill.execute({
        action: 'advance_phase',
        currentPlan: {
          currentPhase: 1,
          planData: {
            phases: [
              { name: 'Phase 1' },
              { name: 'Phase 2', description: 'Next phase' },
            ],
          },
        },
      });

      expect(result.transitionSummary.previousPhase).toBeDefined();
      expect(result.transitionSummary.newPhase).toBeDefined();
      expect(result.transitionSummary.recommendedActions).toBeDefined();
    });

    it('should provide update data', async () => {
      const result = await skill.execute({
        action: 'advance_phase',
        currentPlan: {
          currentPhase: 1,
          planData: {
            phases: [
              { name: 'Phase 1' },
              { name: 'Phase 2', startDay: 11 },
            ],
          },
        },
      });

      expect(result.update).toBeDefined();
      expect(result.update.currentPhase).toBe(2);
      expect(result.update.updatedAt).toBeDefined();
    });

    it('should indicate plan complete when at final phase', async () => {
      const result = await skill.execute({
        action: 'advance_phase',
        currentPlan: {
          currentPhase: 2,
          planData: {
            phases: [
              { name: 'Phase 1' },
              { name: 'Phase 2' },
            ],
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.planComplete).toBe(true);
    });

    it('should require currentPlan', async () => {
      const result = await skill.execute({
        action: 'advance_phase',
        planId: 'plan_123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('currentPlan is required');
    });
  });

  describe('complete_milestone action', () => {
    it('should complete a milestone', async () => {
      const result = await skill.execute({
        action: 'complete_milestone',
        planId: 'plan_123',
        milestoneId: 'milestone_1',
        currentPlan: {
          currentDay: 10,
          planData: {
            milestones: [
              {
                id: 'milestone_1',
                title: 'First 100 words',
                type: 'checkpoint',
                targetDay: 10,
                reward: { type: 'badge' },
              },
            ],
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.milestone.completed).toBe(true);
      expect(result.celebration).toBeDefined();
    });

    it('should include completion timestamp', async () => {
      const result = await skill.execute({
        action: 'complete_milestone',
        milestoneId: 'milestone_1',
        currentPlan: {
          currentDay: 10,
          planData: {
            milestones: [
              { id: 'milestone_1', type: 'checkpoint', targetDay: 10, reward: {} },
            ],
          },
        },
      });

      expect(result.milestone.completedAt).toBeDefined();
    });

    it('should include celebration data', async () => {
      const result = await skill.execute({
        action: 'complete_milestone',
        milestoneId: 'milestone_1',
        currentPlan: {
          currentDay: 10,
          planData: {
            milestones: [
              { id: 'milestone_1', type: 'phase_complete', targetDay: 10, reward: {} },
            ],
          },
        },
      });

      expect(result.celebration.emoji).toBeDefined();
      expect(result.celebration.message).toBeDefined();
      expect(result.celebration.animation).toBeDefined();
    });

    it('should check for bonus rewards', async () => {
      const result = await skill.execute({
        action: 'complete_milestone',
        milestoneId: 'milestone_1',
        currentPlan: {
          currentDay: 8, // Early completion
          planData: {
            milestones: [
              { id: 'milestone_1', type: 'checkpoint', targetDay: 10, reward: {} },
            ],
          },
        },
      });

      expect(result.bonusRewards).toBeDefined();
      expect(result.bonusRewards.length).toBeGreaterThan(0);
    });

    it('should require milestoneId', async () => {
      const result = await skill.execute({
        action: 'complete_milestone',
        currentPlan: { planData: { milestones: [] } },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('milestoneId is required');
    });

    it('should handle milestone not found', async () => {
      const result = await skill.execute({
        action: 'complete_milestone',
        milestoneId: 'nonexistent',
        currentPlan: {
          planData: {
            milestones: [{ id: 'other_milestone' }],
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Milestone not found');
    });
  });

  describe('get_statistics action', () => {
    it('should return statistics', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        currentPlan: {
          currentPhase: 2,
          currentDay: 15,
          startedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          planData: {
            estimatedDuration: 30,
            phases: [
              { name: 'Phase 1', durationDays: 10 },
              { name: 'Phase 2', durationDays: 10 },
            ],
          },
        },
        performanceHistory: [
          { accuracy: 0.8, durationMinutes: 30, itemsReviewed: 20 },
          { accuracy: 0.85, durationMinutes: 25, itemsReviewed: 18 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.overallProgress).toBeDefined();
      expect(result.statistics.performance).toBeDefined();
    });

    it('should calculate overall progress', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        currentPlan: {
          currentPhase: 2,
          currentDay: 15,
          planData: {
            estimatedDuration: 30,
            phases: [{ name: 'Phase 1' }, { name: 'Phase 2' }],
          },
        },
      });

      expect(result.statistics.overallProgress.daysCompleted).toBe(15);
      expect(result.statistics.overallProgress.totalDays).toBe(30);
      expect(result.statistics.overallProgress.percentComplete).toBe(50);
    });

    it('should calculate performance metrics', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        currentPlan: {
          currentPhase: 1,
          currentDay: 5,
          planData: { estimatedDuration: 30, phases: [] },
        },
        performanceHistory: [
          { accuracy: 0.7, durationMinutes: 20, itemsReviewed: 15 },
          { accuracy: 0.8, durationMinutes: 25, itemsReviewed: 20 },
          { accuracy: 0.85, durationMinutes: 30, itemsReviewed: 25 },
        ],
      });

      expect(result.statistics.performance.average).toBeCloseTo(0.78, 1);
      expect(result.statistics.performance.trend).toBeDefined();
    });

    it('should calculate time stats', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        currentPlan: {
          currentPhase: 1,
          currentDay: 5,
          planData: { estimatedDuration: 30, phases: [] },
        },
        performanceHistory: [
          { accuracy: 0.8, durationMinutes: 30, itemsReviewed: 20 },
          { accuracy: 0.8, durationMinutes: 25, itemsReviewed: 15 },
        ],
      });

      expect(result.statistics.timeStats.totalMinutes).toBe(55);
      expect(result.statistics.timeStats.sessionsCompleted).toBe(2);
    });

    it('should include phase breakdown', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        currentPlan: {
          currentPhase: 2,
          currentDay: 15,
          planData: {
            estimatedDuration: 30,
            phases: [
              { name: 'Phase 1', durationDays: 10 },
              { name: 'Phase 2', durationDays: 10 },
              { name: 'Phase 3', durationDays: 10 },
            ],
          },
        },
      });

      expect(result.statistics.phaseBreakdown).toBeDefined();
      expect(result.statistics.phaseBreakdown.length).toBe(3);
      expect(result.statistics.phaseBreakdown[0].status).toBe('completed');
      expect(result.statistics.phaseBreakdown[1].status).toBe('in_progress');
      expect(result.statistics.phaseBreakdown[2].status).toBe('upcoming');
    });

    it('should include projections', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        currentPlan: {
          currentPhase: 1,
          currentDay: 10,
          planData: {
            estimatedDuration: 30,
            phases: [],
          },
        },
      });

      expect(result.statistics.projections).toBeDefined();
      expect(result.statistics.projections.daysRemaining).toBe(20);
      expect(result.statistics.projections.estimatedCompletionDate).toBeDefined();
    });

    it('should require currentPlan', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('currentPlan is required');
    });
  });

  describe('suggest_adjustments action', () => {
    it('should suggest adjustments based on performance', async () => {
      const result = await skill.execute({
        action: 'suggest_adjustments',
        currentPlan: {
          planData: {
            difficulty: 'intermediate',
            dailySchedule: { expectedItemsPerDay: 20, sessionDurationMinutes: 30 },
          },
        },
        performanceHistory: [
          { accuracy: 0.5, durationMinutes: 20, itemsReviewed: 10 },
          { accuracy: 0.55, durationMinutes: 25, itemsReviewed: 8 },
          { accuracy: 0.48, durationMinutes: 22, itemsReviewed: 9 },
          { accuracy: 0.52, durationMinutes: 18, itemsReviewed: 7 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest difficulty reduction for low accuracy', async () => {
      const result = await skill.execute({
        action: 'suggest_adjustments',
        currentPlan: {
          planData: {
            difficulty: 'intermediate',
            dailySchedule: { expectedItemsPerDay: 20, sessionDurationMinutes: 30 },
          },
        },
        performanceHistory: [
          { accuracy: 0.4 },
          { accuracy: 0.45 },
          { accuracy: 0.42 },
          { accuracy: 0.38 },
        ],
      });

      const difficultySuggestion = result.suggestions.find(s => s.type === 'difficulty');
      expect(difficultySuggestion).toBeDefined();
      expect(difficultySuggestion.priority).toBe('high');
    });

    it('should suggest pace adjustment for low volume', async () => {
      const result = await skill.execute({
        action: 'suggest_adjustments',
        currentPlan: {
          planData: {
            difficulty: 'intermediate',
            dailySchedule: { expectedItemsPerDay: 20, sessionDurationMinutes: 30 },
          },
        },
        performanceHistory: [
          { accuracy: 0.8, itemsReviewed: 5 },
          { accuracy: 0.75, itemsReviewed: 6 },
          { accuracy: 0.82, itemsReviewed: 4 },
          { accuracy: 0.78, itemsReviewed: 5 },
        ],
      });

      const paceSuggestion = result.suggestions.find(s => s.type === 'pace');
      expect(paceSuggestion).toBeDefined();
    });

    it('should sort suggestions by priority', async () => {
      const result = await skill.execute({
        action: 'suggest_adjustments',
        currentPlan: {
          planData: {
            difficulty: 'intermediate',
            dailySchedule: { expectedItemsPerDay: 20, sessionDurationMinutes: 30 },
          },
        },
        performanceHistory: [
          { accuracy: 0.4, itemsReviewed: 5 },
          { accuracy: 0.45, itemsReviewed: 6 },
          { accuracy: 0.42, itemsReviewed: 4 },
          { accuracy: 0.38, itemsReviewed: 5 },
        ],
      });

      if (result.suggestions.length >= 2) {
        const priorities = { high: 0, medium: 1, low: 2 };
        for (let i = 1; i < result.suggestions.length; i++) {
          expect(priorities[result.suggestions[i - 1].priority])
            .toBeLessThanOrEqual(priorities[result.suggestions[i].priority]);
        }
      }
    });

    it('should include analysis data', async () => {
      const result = await skill.execute({
        action: 'suggest_adjustments',
        currentPlan: {
          planData: {
            difficulty: 'intermediate',
            dailySchedule: { expectedItemsPerDay: 20, sessionDurationMinutes: 30 },
          },
        },
        performanceHistory: [
          { accuracy: 0.7, itemsReviewed: 15 },
          { accuracy: 0.75, itemsReviewed: 18 },
          { accuracy: 0.72, itemsReviewed: 16 },
        ],
      });

      expect(result.analysisData).toBeDefined();
      expect(result.analysisData.recentAccuracy).toBeDefined();
      expect(result.analysisData.recentPace).toBeDefined();
    });

    it('should return empty suggestions with insufficient data', async () => {
      const result = await skill.execute({
        action: 'suggest_adjustments',
        currentPlan: {
          planData: {
            difficulty: 'intermediate',
            dailySchedule: { expectedItemsPerDay: 20 },
          },
        },
        performanceHistory: [
          { accuracy: 0.8 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toEqual([]);
      expect(result.message).toContain('Need more performance data');
    });
  });

  describe('unknown action', () => {
    it('should throw error for unknown action', async () => {
      await expect(skill.execute({
        action: 'invalid_action',
      })).rejects.toThrow('Unknown action');
    });
  });
});

// =============================================================================
// LearningSessionSkill Tests
// =============================================================================

describe('LearningSessionSkill', () => {
  let skill;

  beforeEach(() => {
    skill = new LearningSessionSkill();
    skill.context = {};
    jest.clearAllMocks();
  });

  describe('static properties', () => {
    it('should have correct name', () => {
      expect(LearningSessionSkill.name).toBe('manage_learning_session');
    });

    it('should have correct category', () => {
      expect(LearningSessionSkill.category).toBe('learning');
    });

    it('should have action parameter with all actions', () => {
      const actions = LearningSessionSkill.parameters.action.enum;
      expect(actions).toContain('start');
      expect(actions).toContain('record_item');
      expect(actions).toContain('update_progress');
      expect(actions).toContain('complete');
      expect(actions).toContain('get_session');
      expect(actions).toContain('get_statistics');
      expect(actions).toContain('get_feedback');
      expect(actions).toContain('get_weak_items');
    });

    it('should have sessionType enum', () => {
      const types = LearningSessionSkill.parameters.sessionType.enum;
      expect(types).toContain('review');
      expect(types).toContain('learn_new');
      expect(types).toContain('mixed');
      expect(types).toContain('quiz');
      expect(types).toContain('practice');
      expect(types).toContain('assessment');
    });
  });

  describe('start action', () => {
    it('should start a new session', async () => {
      const result = await skill.execute({
        action: 'start',
        topicId: 'topic_123',
        sessionType: 'review',
      });

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.id).toMatch(/^session_/);
      expect(result.session.status).toBe('active');
      expect(result.recommendations).toBeDefined();
    });

    it('should include session metadata', async () => {
      const result = await skill.execute({
        action: 'start',
        topicId: 'topic_123',
        planId: 'plan_456',
        sessionType: 'mixed',
      });

      expect(result.session.topicId).toBe('topic_123');
      expect(result.session.planId).toBe('plan_456');
      expect(result.session.sessionType).toBe('mixed');
      expect(result.session.startedAt).toBeDefined();
    });

    it('should provide session recommendations for review', async () => {
      const result = await skill.execute({
        action: 'start',
        topicId: 'topic_123',
        sessionType: 'review',
      });

      expect(result.recommendations.targetItems).toBe(20);
      expect(result.recommendations.newItemRatio).toBe(0);
      expect(result.recommendations.focusAreas).toContain('retention');
    });

    it('should provide session recommendations for learn_new', async () => {
      const result = await skill.execute({
        action: 'start',
        topicId: 'topic_123',
        sessionType: 'learn_new',
      });

      expect(result.recommendations.targetItems).toBe(15);
      expect(result.recommendations.newItemRatio).toBe(1);
    });

    it('should provide session recommendations for quiz', async () => {
      const result = await skill.execute({
        action: 'start',
        topicId: 'topic_123',
        sessionType: 'quiz',
      });

      expect(result.recommendations.targetItems).toBe(10);
      expect(result.recommendations.focusAreas).toContain('accuracy');
    });

    it('should require topicId', async () => {
      await expect(skill.execute({
        action: 'start',
      })).rejects.toThrow('topicId is required');
    });

    it('should generate unique session IDs', async () => {
      const result1 = await skill.execute({
        action: 'start',
        topicId: 'topic_123',
      });

      const result2 = await skill.execute({
        action: 'start',
        topicId: 'topic_123',
      });

      expect(result1.session.id).not.toBe(result2.session.id);
    });
  });

  describe('record_item action', () => {
    it('should record item performance', async () => {
      const result = await skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        topicId: 'topic_456',
        itemPerformance: {
          itemId: 'word_789',
          itemType: 'vocabulary',
          wasCorrect: true,
          responseTimeMs: 1500,
          masteryBefore: 0.5,
        },
      });

      expect(result.success).toBe(true);
      expect(result.performanceRecord).toBeDefined();
      expect(result.masteryChange).toBeDefined();
      expect(result.masteryChange.after).toBeGreaterThan(result.masteryChange.before);
    });

    it('should increase mastery on correct answer', async () => {
      const result = await skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        itemPerformance: {
          itemId: 'word_789',
          wasCorrect: true,
          masteryBefore: 0.5,
        },
      });

      expect(result.masteryChange.change).toBeGreaterThan(0);
    });

    it('should give bonus for fast response', async () => {
      const fastResult = await skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        itemPerformance: {
          itemId: 'word_789',
          wasCorrect: true,
          responseTimeMs: 1000,
          masteryBefore: 0.5,
        },
      });

      const slowResult = await skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        itemPerformance: {
          itemId: 'word_790',
          wasCorrect: true,
          responseTimeMs: 5000,
          masteryBefore: 0.5,
        },
      });

      expect(fastResult.masteryChange.change).toBeGreaterThan(slowResult.masteryChange.change);
    });

    it('should decrease mastery on incorrect answer', async () => {
      const result = await skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        itemPerformance: {
          itemId: 'word_789',
          wasCorrect: false,
          masteryBefore: 0.7,
        },
      });

      expect(result.masteryChange.after).toBeLessThan(result.masteryChange.before);
    });

    it('should provide immediate feedback for correct', async () => {
      const result = await skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        itemPerformance: {
          itemId: 'word_789',
          wasCorrect: true,
          responseTimeMs: 1000,
        },
      });

      expect(result.immediateFeedback).toBeDefined();
      expect(result.immediateFeedback.type).toBe('success');
      expect(result.immediateFeedback.emoji).toBeDefined();
    });

    it('should provide immediate feedback for incorrect', async () => {
      const result = await skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        itemPerformance: {
          itemId: 'word_789',
          wasCorrect: false,
        },
      });

      expect(result.immediateFeedback.type).toBe('incorrect');
    });

    it('should record mistake type', async () => {
      const result = await skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        itemPerformance: {
          itemId: 'word_789',
          wasCorrect: false,
          mistakeType: 'spelling',
        },
      });

      expect(result.performanceRecord.mistakeType).toBe('spelling');
    });

    it('should record confidence level', async () => {
      const result = await skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        itemPerformance: {
          itemId: 'word_789',
          wasCorrect: true,
          confidenceLevel: 4,
        },
      });

      expect(result.performanceRecord.confidenceLevel).toBe(4);
    });

    it('should require sessionId and itemPerformance', async () => {
      await expect(skill.execute({
        action: 'record_item',
      })).rejects.toThrow('sessionId and itemPerformance are required');
    });

    it('should require itemId and wasCorrect', async () => {
      await expect(skill.execute({
        action: 'record_item',
        sessionId: 'session_123',
        itemPerformance: {},
      })).rejects.toThrow('itemId and wasCorrect are required');
    });
  });

  describe('update_progress action', () => {
    it('should update session progress', async () => {
      const result = await skill.execute({
        action: 'update_progress',
        sessionId: 'session_123',
        progressUpdate: {
          itemsReviewedIncrement: 5,
          itemsCorrectIncrement: 4,
          itemsNewIncrement: 2,
        },
      });

      expect(result.success).toBe(true);
      expect(result.update).toBeDefined();
      expect(result.runningAccuracy).toBe(0.8);
    });

    it('should calculate running accuracy', async () => {
      const result = await skill.execute({
        action: 'update_progress',
        sessionId: 'session_123',
        progressUpdate: {
          itemsReviewedIncrement: 10,
          itemsCorrectIncrement: 7,
        },
      });

      expect(result.runningAccuracy).toBe(0.7);
    });

    it('should handle zero items reviewed', async () => {
      const result = await skill.execute({
        action: 'update_progress',
        sessionId: 'session_123',
        progressUpdate: {
          itemsReviewedIncrement: 0,
          itemsCorrectIncrement: 0,
        },
      });

      expect(result.runningAccuracy).toBeNull();
    });

    it('should include timestamp', async () => {
      const result = await skill.execute({
        action: 'update_progress',
        sessionId: 'session_123',
        progressUpdate: {
          itemsReviewedIncrement: 5,
        },
      });

      expect(result.update.timestamp).toBeDefined();
    });

    it('should require sessionId and progressUpdate', async () => {
      await expect(skill.execute({
        action: 'update_progress',
      })).rejects.toThrow('sessionId and progressUpdate are required');
    });
  });

  describe('complete action', () => {
    it('should complete a session', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        topicId: 'topic_456',
        results: {
          itemsReviewed: 25,
          itemsCorrect: 22,
          itemsNew: 8,
          sessionData: {
            startedAt: new Date(Date.now() - 30 * 60000).toISOString(),
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.accuracy).toBe(0.88);
      expect(result.summary.performance).toBe('good');
      expect(result.achievements).toBeDefined();
      expect(result.feedback).toBeDefined();
      expect(result.nextSessionSuggestions).toBeDefined();
    });

    it('should calculate duration', async () => {
      const startTime = new Date(Date.now() - 45 * 60000); // 45 minutes ago
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 18,
          sessionData: { startedAt: startTime.toISOString() },
        },
      });

      expect(result.summary.durationMinutes).toBeGreaterThanOrEqual(44);
      expect(result.summary.durationMinutes).toBeLessThanOrEqual(46);
    });

    it('should classify excellent performance', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 19,
          sessionData: { startedAt: new Date().toISOString() },
        },
      });

      expect(result.summary.performance).toBe('excellent');
    });

    it('should classify good performance', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 16,
          sessionData: { startedAt: new Date().toISOString() },
        },
      });

      expect(result.summary.performance).toBe('good');
    });

    it('should classify fair performance', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 13,
          sessionData: { startedAt: new Date().toISOString() },
        },
      });

      expect(result.summary.performance).toBe('fair');
    });

    it('should classify needs_work performance', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 9,
          sessionData: { startedAt: new Date().toISOString() },
        },
      });

      expect(result.summary.performance).toBe('needs_work');
    });

    it('should classify struggling performance', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 5,
          sessionData: { startedAt: new Date().toISOString() },
        },
      });

      expect(result.summary.performance).toBe('struggling');
    });

    it('should award perfect session achievement', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 15,
          itemsCorrect: 15,
          sessionData: { startedAt: new Date().toISOString() },
        },
      });

      expect(result.achievements.some(a => a.type === 'perfect_session')).toBe(true);
    });

    it('should award marathon achievement', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 50,
          itemsCorrect: 50,
          itemsNew: 0,
          sessionData: {
            startedAt: new Date(Date.now() - 60 * 60000).toISOString(),
          },
        },
      });

      expect(result.achievements.some(a => a.type === 'marathon')).toBe(true);
    });

    it('should award quick learner achievement', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 25,
          itemsCorrect: 22,
          itemsNew: 20,
          sessionData: { startedAt: new Date().toISOString() },
        },
      });

      expect(result.achievements.some(a => a.type === 'quick_learner')).toBe(true);
    });

    it('should award focused achievement', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 16,
          sessionData: {
            startedAt: new Date(Date.now() - 35 * 60000).toISOString(),
          },
        },
      });

      expect(result.achievements.some(a => a.type === 'focused')).toBe(true);
    });

    it('should provide feedback with summary', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 16,
          sessionData: { startedAt: new Date().toISOString() },
        },
      });

      expect(result.feedback.summary).toBeDefined();
      expect(result.feedback.stats).toBeDefined();
      expect(result.feedback.highlights).toBeDefined();
    });

    it('should provide next session suggestions', async () => {
      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 10,
          sessionData: { startedAt: new Date().toISOString() },
        },
      });

      expect(result.nextSessionSuggestions.sessionType).toBe('review');
    });

    it('should require sessionId', async () => {
      await expect(skill.execute({
        action: 'complete',
      })).rejects.toThrow('sessionId is required');
    });
  });

  describe('get_session action', () => {
    it('should return session query info', async () => {
      const result = await skill.execute({
        action: 'get_session',
        sessionId: 'session_123',
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session_123');
    });

    it('should require sessionId', async () => {
      await expect(skill.execute({
        action: 'get_session',
      })).rejects.toThrow('sessionId is required');
    });
  });

  describe('get_statistics action', () => {
    it('should calculate statistics from results', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 25,
          itemsCorrect: 20,
          itemsNew: 10,
        },
      });

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.accuracy).toBe(80);
      expect(result.statistics.metrics.correctRate).toBe(80);
    });

    it('should include performance classification', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 18,
        },
      });

      expect(result.statistics.performance).toBe('excellent');
    });

    it('should estimate retention', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        results: {
          itemsReviewed: 25,
          itemsCorrect: 22,
        },
      });

      expect(result.statistics.metrics.retentionEstimate).toBeDefined();
      expect(result.statistics.metrics.retentionEstimate).toBeGreaterThan(0);
    });

    it('should return context without results', async () => {
      const result = await skill.execute({
        action: 'get_statistics',
        sessionId: 'session_123',
        topicId: 'topic_456',
      });

      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context.sessionId).toBe('session_123');
    });
  });

  describe('get_feedback action', () => {
    it('should generate feedback for results', async () => {
      const result = await skill.execute({
        action: 'get_feedback',
        results: {
          itemsReviewed: 15,
          itemsCorrect: 12,
          itemsNew: 5,
        },
      });

      expect(result.success).toBe(true);
      expect(result.feedback).toBeDefined();
      expect(result.feedback.performance).toBe('good');
      expect(result.feedback.tips).toBeDefined();
      expect(result.feedback.encouragement).toBeDefined();
    });

    it('should provide different messages for different performance levels', async () => {
      const excellentResult = await skill.execute({
        action: 'get_feedback',
        results: { itemsReviewed: 20, itemsCorrect: 19 },
      });

      const strugglingResult = await skill.execute({
        action: 'get_feedback',
        results: { itemsReviewed: 20, itemsCorrect: 5 },
      });

      expect(excellentResult.feedback.message).not.toBe(strugglingResult.feedback.message);
    });

    it('should provide tips based on performance', async () => {
      const result = await skill.execute({
        action: 'get_feedback',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 10,
        },
      });

      expect(result.feedback.tips.length).toBeGreaterThan(0);
    });

    it('should require results', async () => {
      const result = await skill.execute({
        action: 'get_feedback',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('results are required');
    });
  });

  describe('get_weak_items action', () => {
    it('should return weak items query', async () => {
      const result = await skill.execute({
        action: 'get_weak_items',
        topicId: 'topic_123',
      });

      expect(result.success).toBe(true);
      expect(result.query).toBeDefined();
      expect(result.query.type).toBe('weak_items');
      expect(result.query.criteria).toBeDefined();
    });

    it('should include query criteria', async () => {
      const result = await skill.execute({
        action: 'get_weak_items',
        topicId: 'topic_123',
      });

      expect(result.query.criteria.minReviews).toBeDefined();
      expect(result.query.criteria.maxAccuracy).toBeDefined();
    });

    it('should require topicId', async () => {
      await expect(skill.execute({
        action: 'get_weak_items',
      })).rejects.toThrow('topicId is required');
    });
  });

  describe('AI feedback', () => {
    beforeEach(() => {
      skill.getAIProvider = jest.fn().mockReturnValue(mockAIProvider);
    });

    it('should include AI feedback when requested', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        personalizedMessage: 'Great session! You showed improvement.',
        learningTip: 'Try reviewing before bed for better retention.',
        motivationalNote: 'Keep up the momentum!',
      });

      const result = await skill.execute({
        action: 'get_feedback',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 18,
        },
        includeAIFeedback: true,
      });

      expect(result.feedback.aiFeedback).toBeDefined();
      expect(result.feedback.aiFeedback.personalizedMessage).toBeDefined();
      expect(result.feedback.aiFeedback.learningTip).toBeDefined();
    });

    it('should include AI feedback in complete action', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        personalizedMessage: 'Excellent work!',
        learningTip: 'Keep it up',
        motivationalNote: 'You rock!',
      });

      const result = await skill.execute({
        action: 'complete',
        sessionId: 'session_123',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 18,
          sessionData: { startedAt: new Date().toISOString() },
        },
        includeAIFeedback: true,
      });

      expect(result.feedback.aiFeedback).toBeDefined();
    });

    it('should fall back gracefully when AI fails', async () => {
      mockAIProvider.generateContentWithJson.mockRejectedValue(new Error('AI error'));

      const result = await skill.execute({
        action: 'get_feedback',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 18,
        },
        includeAIFeedback: true,
      });

      // Should still succeed without AI feedback
      expect(result.success).toBe(true);
      expect(result.feedback).toBeDefined();
      expect(result.feedback.aiFeedback).toBeUndefined();
    });

    it('should work without AI provider', async () => {
      skill.getAIProvider = jest.fn().mockReturnValue(null);

      const result = await skill.execute({
        action: 'get_feedback',
        results: {
          itemsReviewed: 20,
          itemsCorrect: 18,
        },
        includeAIFeedback: true,
      });

      expect(result.success).toBe(true);
      expect(result.feedback).toBeDefined();
    });
  });

  describe('unknown action', () => {
    it('should throw error for unknown action', async () => {
      await expect(skill.execute({
        action: 'invalid_action',
      })).rejects.toThrow('Unknown action');
    });
  });
});

// =============================================================================
// Learning Skills Integration Tests
// =============================================================================

describe('Learning Skills Integration', () => {
  it('should export all learning skills from index', () => {
    const learningSkills = require('../../main/skills/learning');

    expect(learningSkills.DomainDetectionSkill).toBeDefined();
    expect(learningSkills.LearningPlanCreateSkill).toBeDefined();
    expect(learningSkills.LearningPlanProgressSkill).toBeDefined();
    expect(learningSkills.LearningSessionSkill).toBeDefined();
  });

  it('should provide learningSkills array', () => {
    const { learningSkills } = require('../../main/skills/learning');
    expect(learningSkills).toBeDefined();
    expect(learningSkills.length).toBe(8);
  });

  it('should provide registerLearningSkills function', () => {
    const { registerLearningSkills } = require('../../main/skills/learning');
    expect(typeof registerLearningSkills).toBe('function');
  });

  it('should register skills with registry', () => {
    const { registerLearningSkills } = require('../../main/skills/learning');

    const mockRegistry = {
      register: jest.fn(),
    };

    registerLearningSkills(mockRegistry);

    expect(mockRegistry.register).toHaveBeenCalledTimes(8);
  });

  it('should have consistent skill naming', () => {
    const { learningSkills } = require('../../main/skills/learning');

    learningSkills.forEach(SkillClass => {
      expect(SkillClass.name).toBeDefined();
      expect(typeof SkillClass.name).toBe('string');
      expect(SkillClass.name.length).toBeGreaterThan(0);
    });
  });

  it('should have consistent category', () => {
    const { learningSkills } = require('../../main/skills/learning');

    learningSkills.forEach(SkillClass => {
      expect(SkillClass.category).toBe('learning');
    });
  });

  it('should have descriptions', () => {
    const { learningSkills } = require('../../main/skills/learning');

    learningSkills.forEach(SkillClass => {
      expect(SkillClass.description).toBeDefined();
      expect(SkillClass.description.length).toBeGreaterThan(10);
    });
  });

  it('should have required params defined', () => {
    const { learningSkills } = require('../../main/skills/learning');

    learningSkills.forEach(SkillClass => {
      expect(SkillClass.requiredParams).toBeDefined();
      expect(Array.isArray(SkillClass.requiredParams)).toBe(true);
    });
  });
});
