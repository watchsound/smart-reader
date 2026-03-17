/**
 * Comprehensive Tests for ContentGenerationSkill
 *
 * Tests domain-dependent, learning plan-driven content generation
 */

const ContentGenerationSkill = require('../../main/skills/learning/ContentGenerationSkill');

// Mock AI provider
const mockAIProvider = {
  generateContent: jest.fn(),
  generateContentWithJson: jest.fn(),
};

describe('ContentGenerationSkill', () => {
  let skill;

  beforeEach(() => {
    skill = new ContentGenerationSkill();
    skill.context = {};
    jest.clearAllMocks();
  });

  describe('static properties', () => {
    it('should have correct name', () => {
      expect(ContentGenerationSkill.name).toBe('generate_learning_content');
    });

    it('should have correct category', () => {
      expect(ContentGenerationSkill.category).toBe('learning');
    });

    it('should have required parameters', () => {
      expect(ContentGenerationSkill.requiredParams).toContain('action');
      expect(ContentGenerationSkill.requiredParams).toContain('domainType');
    });

    it('should have action enum', () => {
      const actions = ContentGenerationSkill.parameters.action.enum;
      expect(actions).toContain('generate_session_content');
      expect(actions).toContain('generate_review_items');
      expect(actions).toContain('generate_assessment');
      expect(actions).toContain('generate_explanation');
      expect(actions).toContain('generate_practice');
      expect(actions).toContain('suggest_content_mix');
    });

    it('should have domainType enum', () => {
      const domains = ContentGenerationSkill.parameters.domainType.enum;
      expect(domains).toContain('vocabulary');
      expect(domains).toContain('math');
      expect(domains).toContain('language');
      expect(domains).toContain('knowledge');
      expect(domains).toContain('skill');
    });

    it('should have sessionType enum', () => {
      const types = ContentGenerationSkill.parameters.sessionType.enum;
      expect(types).toContain('review');
      expect(types).toContain('learn_new');
      expect(types).toContain('mixed');
      expect(types).toContain('quiz');
      expect(types).toContain('practice');
      expect(types).toContain('assessment');
    });

    it('should have description', () => {
      expect(ContentGenerationSkill.description).toBeDefined();
      expect(ContentGenerationSkill.description.length).toBeGreaterThan(50);
    });
  });

  // ===========================================================================
  // generate_session_content action
  // ===========================================================================

  describe('generate_session_content action', () => {
    it('should generate content for vocabulary domain', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
        count: 5,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.metadata.domainType).toBe('vocabulary');
      expect(result.metadata.sessionType).toBe('review');
    });

    it('should generate content for math domain', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'math',
        sessionType: 'practice',
        count: 3,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.domainType).toBe('math');
    });

    it('should generate content for language domain', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'language',
        sessionType: 'learn_new',
        count: 5,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.domainType).toBe('language');
    });

    it('should generate content for knowledge domain', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'knowledge',
        sessionType: 'quiz',
        count: 4,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.domainType).toBe('knowledge');
    });

    it('should generate content for skill domain', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'skill',
        sessionType: 'project',
        count: 2,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.domainType).toBe('skill');
    });

    it('should include content types in metadata', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
      });

      expect(result.metadata.contentTypes).toBeDefined();
      expect(Array.isArray(result.metadata.contentTypes)).toBe(true);
    });

    it('should include difficulty config in metadata', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'math',
        sessionType: 'practice',
        planContext: { currentPhase: 2, totalPhases: 4 },
      });

      expect(result.metadata.difficulty).toBeDefined();
      expect(result.metadata.difficulty.complexity).toBeDefined();
    });

    it('should use sourceItems when provided', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
        sourceItems: [
          { id: 'word1', value: 'ephemeral' },
          { id: 'word2', value: 'ubiquitous' },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('should use custom contentTypes when specified', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
        contentTypes: ['flashcard', 'cloze'],
      });

      expect(result.metadata.contentTypes).toEqual(['flashcard', 'cloze']);
    });

    it('should use AI when available', async () => {
      skill.getAIProvider = jest.fn().mockReturnValue(mockAIProvider);
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        items: [
          { type: 'flashcard', content: { front: 'word', back: 'definition' } },
        ],
        sessionIntro: 'Practice session',
        learningTips: ['tip1'],
      });

      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'learn_new',
        count: 1,
      });

      expect(result.success).toBe(true);
      expect(mockAIProvider.generateContentWithJson).toHaveBeenCalled();
    });

    it('should generate fallback content when AI unavailable', async () => {
      skill.getAIProvider = jest.fn().mockReturnValue(null);

      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
        sourceItems: ['word1', 'word2'],
        count: 2,
      });

      expect(result.success).toBe(true);
      expect(result.content.items).toBeDefined();
    });

    it('should handle AI errors gracefully', async () => {
      skill.getAIProvider = jest.fn().mockReturnValue(mockAIProvider);
      mockAIProvider.generateContentWithJson.mockRejectedValue(new Error('AI error'));

      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
        sourceItems: ['word1'],
        count: 1,
      });

      expect(result.success).toBe(true);
      expect(result.content.items).toBeDefined();
    });
  });

  // ===========================================================================
  // Session type content selection
  // ===========================================================================

  describe('session type content selection', () => {
    it('should select review content types for vocabulary review', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
      });

      expect(result.metadata.contentTypes).toContain('flashcard');
    });

    it('should select learn_new content types for vocabulary learn_new', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'learn_new',
      });

      expect(result.metadata.contentTypes).toContain('flashcard');
      expect(result.metadata.contentTypes).toContain('context_sentence');
    });

    it('should select quiz content types for math quiz', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'math',
        sessionType: 'quiz',
      });

      expect(result.metadata.contentTypes).toContain('problem');
    });

    it('should select practice content types for language practice', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'language',
        sessionType: 'practice',
      });

      expect(result.metadata.contentTypes).toContain('sentence_building');
    });

    it('should select assessment content types for knowledge assessment', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'knowledge',
        sessionType: 'assessment',
      });

      expect(result.metadata.contentTypes).toContain('concept_quiz');
    });

    it('should select project content types for skill project', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'skill',
        sessionType: 'project',
      });

      expect(result.metadata.contentTypes).toContain('project_task');
    });
  });

  // ===========================================================================
  // Plan context and difficulty
  // ===========================================================================

  describe('plan context and difficulty', () => {
    it('should use early phase difficulty for phase 1 of 4', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'learn_new',
        planContext: { currentPhase: 1, totalPhases: 4 },
      });

      expect(result.metadata.difficulty.complexity).toBe('basic');
      expect(result.metadata.difficulty.scaffolding).toBe('high');
    });

    it('should use middle phase difficulty for phase 2 of 4', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'math',
        sessionType: 'practice',
        planContext: { currentPhase: 2, totalPhases: 4 },
      });

      expect(result.metadata.difficulty.complexity).toBe('moderate');
    });

    it('should use late phase difficulty for phase 4 of 4', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'knowledge',
        sessionType: 'quiz',
        planContext: { currentPhase: 4, totalPhases: 4 },
      });

      expect(result.metadata.difficulty.complexity).toBe('advanced');
      expect(result.metadata.difficulty.scaffolding).toBe('low');
    });

    it('should default to middle difficulty without plan context', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'mixed',
      });

      expect(result.metadata.difficulty).toBeDefined();
    });
  });

  // ===========================================================================
  // Mastery-based prioritization
  // ===========================================================================

  describe('mastery-based item prioritization', () => {
    it('should prioritize weak items for review sessions', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
        sourceItems: [
          { id: 'strong1', value: 'easy' },
          { id: 'weak1', value: 'hard' },
          { id: 'weak2', value: 'difficult' },
        ],
        masteryData: {
          weakItems: [{ id: 'weak1' }, { id: 'weak2' }],
          strongItems: [{ id: 'strong1' }],
          averageMastery: 0.6,
        },
        count: 2,
      });

      expect(result.success).toBe(true);
    });

    it('should prioritize unmastered items for learn_new sessions', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'learn_new',
        sourceItems: [
          { id: 'new1', value: 'newword' },
          { id: 'strong1', value: 'known' },
        ],
        masteryData: {
          strongItems: [{ id: 'strong1' }],
        },
        count: 1,
      });

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // generate_review_items action
  // ===========================================================================

  describe('generate_review_items action', () => {
    it('should generate review items prioritizing weak areas', async () => {
      const result = await skill.execute({
        action: 'generate_review_items',
        domainType: 'vocabulary',
        sourceItems: ['word1', 'word2', 'word3'],
        masteryData: {
          weakItems: ['word1', 'word2'],
          averageMastery: 0.5,
        },
        count: 2,
      });

      expect(result.success).toBe(true);
      expect(result.reviewStrategy).toBeDefined();
      expect(result.reviewStrategy.spacedRepetitionApplied).toBe(true);
    });

    it('should include weak item count in review strategy', async () => {
      const result = await skill.execute({
        action: 'generate_review_items',
        domainType: 'math',
        sourceItems: ['problem1', 'problem2'],
        masteryData: {
          weakItems: ['problem1'],
        },
      });

      expect(result.reviewStrategy.weakItemCount).toBe(1);
    });
  });

  // ===========================================================================
  // generate_assessment action
  // ===========================================================================

  describe('generate_assessment action', () => {
    it('should generate assessment content', async () => {
      const result = await skill.execute({
        action: 'generate_assessment',
        domainType: 'vocabulary',
        planContext: { currentPhase: 2, totalPhases: 3 },
        count: 10,
      });

      expect(result.success).toBe(true);
      expect(result.assessment).toBeDefined();
      expect(result.assessment.type).toBe('phase_assessment');
    });

    it('should include passing score based on phase', async () => {
      const result1 = await skill.execute({
        action: 'generate_assessment',
        domainType: 'math',
        planContext: { currentPhase: 1, totalPhases: 3 },
        count: 5,
      });

      const result2 = await skill.execute({
        action: 'generate_assessment',
        domainType: 'math',
        planContext: { currentPhase: 3, totalPhases: 3 },
        count: 5,
      });

      expect(result1.assessment.passingScore).toBeLessThan(result2.assessment.passingScore);
    });

    it('should include time limit based on domain', async () => {
      const vocabResult = await skill.execute({
        action: 'generate_assessment',
        domainType: 'vocabulary',
        count: 10,
      });

      const mathResult = await skill.execute({
        action: 'generate_assessment',
        domainType: 'math',
        count: 10,
      });

      // Math should have longer time limit
      expect(mathResult.assessment.timeLimit).toBeGreaterThan(vocabResult.assessment.timeLimit);
    });

    it('should include scoring rubric', async () => {
      const result = await skill.execute({
        action: 'generate_assessment',
        domainType: 'vocabulary',
        count: 5,
      });

      expect(result.assessment.scoringRubric).toBeDefined();
      expect(result.assessment.scoringRubric.pointsPerItem).toBeDefined();
    });

    it('should include domain-specific rubric for math', async () => {
      const result = await skill.execute({
        action: 'generate_assessment',
        domainType: 'math',
        count: 5,
      });

      expect(result.assessment.scoringRubric.partialCreditForProcess).toBe(true);
    });

    it('should include domain-specific rubric for skill', async () => {
      const result = await skill.execute({
        action: 'generate_assessment',
        domainType: 'skill',
        count: 5,
      });

      expect(result.assessment.scoringRubric.codeExecutionRequired).toBe(true);
    });
  });

  // ===========================================================================
  // generate_explanation action
  // ===========================================================================

  describe('generate_explanation action', () => {
    it('should require AI provider', async () => {
      skill.getAIProvider = jest.fn().mockReturnValue(null);

      const result = await skill.execute({
        action: 'generate_explanation',
        domainType: 'math',
        sourceContent: 'Explain calculus',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AI provider required');
    });

    it('should generate explanation with AI', async () => {
      skill.getAIProvider = jest.fn().mockReturnValue(mockAIProvider);
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        explanations: [
          {
            topic: 'Derivatives',
            explanation: 'A derivative measures rate of change',
            keyPoints: ['Rate of change', 'Slope of tangent'],
            examples: ['f(x) = x²'],
          },
        ],
        summary: 'Introduction to calculus',
      });

      const result = await skill.execute({
        action: 'generate_explanation',
        domainType: 'math',
        sourceContent: 'Explain derivatives',
        sourceItems: ['derivative', 'integral'],
      });

      expect(result.success).toBe(true);
      expect(result.explanation).toBeDefined();
    });
  });

  // ===========================================================================
  // generate_practice action
  // ===========================================================================

  describe('generate_practice action', () => {
    it('should generate practice content', async () => {
      const result = await skill.execute({
        action: 'generate_practice',
        domainType: 'language',
        sourceItems: ['grammar1', 'grammar2'],
        count: 3,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.sessionType).toBe('practice');
    });

    it('should use practice session type', async () => {
      const result = await skill.execute({
        action: 'generate_practice',
        domainType: 'math',
        count: 5,
      });

      expect(result.metadata.sessionType).toBe('practice');
    });
  });

  // ===========================================================================
  // suggest_content_mix action
  // ===========================================================================

  describe('suggest_content_mix action', () => {
    it('should suggest content mix for review session', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'vocabulary',
        sessionType: 'review',
      });

      expect(result.success).toBe(true);
      expect(result.recommendation).toBeDefined();
      expect(result.recommendation.reviewPercent).toBeGreaterThan(50);
    });

    it('should suggest content mix for learn_new session', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'vocabulary',
        sessionType: 'learn_new',
      });

      expect(result.recommendation.newContentPercent).toBeGreaterThan(50);
    });

    it('should adjust mix based on low mastery', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'math',
        sessionType: 'mixed',
        masteryData: {
          averageMastery: 0.3,
          recentAccuracy: 0.4,
        },
      });

      // Low mastery should lead to more review
      expect(result.recommendation.reviewPercent).toBeGreaterThanOrEqual(50);
    });

    it('should adjust mix based on high mastery', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'math',
        sessionType: 'mixed',
        masteryData: {
          averageMastery: 0.9,
          recentAccuracy: 0.95,
        },
      });

      // High mastery should lead to more new content
      expect(result.recommendation.newContentPercent).toBeGreaterThanOrEqual(50);
    });

    it('should include suggested item count', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'vocabulary',
        sessionType: 'quiz',
      });

      expect(result.recommendation.suggestedItemCount).toBeDefined();
      expect(result.recommendation.suggestedItemCount).toBeGreaterThan(0);
    });

    it('should include session duration suggestion', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'skill',
        sessionType: 'project',
      });

      expect(result.recommendation.sessionDuration).toBeDefined();
      expect(result.recommendation.sessionDuration).toBeGreaterThan(0);
    });

    it('should include content types recommendation', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'language',
        sessionType: 'reading',
      });

      expect(result.recommendation.contentTypes).toBeDefined();
      expect(Array.isArray(result.recommendation.contentTypes)).toBe(true);
    });

    it('should include phase adjustments', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'knowledge',
        sessionType: 'learn_new',
        planContext: { currentPhase: 1, totalPhases: 3 },
      });

      expect(result.recommendation.phaseAdjustments).toBeDefined();
      expect(result.recommendation.phaseAdjustments.emphasize).toBeDefined();
      expect(result.recommendation.phaseAdjustments.tips).toBeDefined();
    });

    it('should provide early phase adjustments', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'math',
        sessionType: 'learn_new',
        planContext: { currentPhase: 1, totalPhases: 4 },
      });

      expect(result.recommendation.phaseAdjustments.emphasize).toContain('fundamentals');
    });

    it('should provide late phase adjustments', async () => {
      const result = await skill.execute({
        action: 'suggest_content_mix',
        domainType: 'math',
        sessionType: 'assessment',
        planContext: { currentPhase: 4, totalPhases: 4 },
      });

      expect(result.recommendation.phaseAdjustments.emphasize).toContain('mastery');
    });
  });

  // ===========================================================================
  // Domain-specific content structures
  // ===========================================================================

  describe('domain-specific content generation', () => {
    describe('vocabulary domain', () => {
      it('should support flashcard content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'vocabulary',
          sessionType: 'learn_new',
          contentTypes: ['flashcard'],
          sourceItems: ['ephemeral'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });

      it('should support cloze content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'vocabulary',
          sessionType: 'quiz',
          contentTypes: ['cloze'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });

      it('should support matching content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'vocabulary',
          sessionType: 'quiz',
          contentTypes: ['matching'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('math domain', () => {
      it('should support problem content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'math',
          sessionType: 'practice',
          contentTypes: ['problem'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });

      it('should support worked_example content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'math',
          sessionType: 'learn_new',
          contentTypes: ['worked_example'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('language domain', () => {
      it('should support grammar_exercise content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'language',
          sessionType: 'practice',
          contentTypes: ['grammar_exercise'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });

      it('should support translation content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'language',
          sessionType: 'quiz',
          contentTypes: ['translation'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('knowledge domain', () => {
      it('should support concept_quiz content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'knowledge',
          sessionType: 'quiz',
          contentTypes: ['concept_quiz'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });

      it('should support true_false content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'knowledge',
          sessionType: 'review',
          contentTypes: ['true_false'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('skill domain', () => {
      it('should support code_exercise content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'skill',
          sessionType: 'practice',
          contentTypes: ['code_exercise'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });

      it('should support debugging_challenge content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'skill',
          sessionType: 'quiz',
          contentTypes: ['debugging_challenge'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });

      it('should support project_task content type', async () => {
        const result = await skill.execute({
          action: 'generate_session_content',
          domainType: 'skill',
          sessionType: 'project',
          contentTypes: ['project_task'],
          count: 1,
        });

        expect(result.success).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe('error handling', () => {
    it('should throw error for unknown action', async () => {
      await expect(skill.execute({
        action: 'invalid_action',
        domainType: 'vocabulary',
      })).rejects.toThrow('Unknown action');
    });

    it('should handle missing sourceItems gracefully', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
        count: 5,
      });

      expect(result.success).toBe(true);
    });

    it('should handle empty sourceItems gracefully', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'math',
        sessionType: 'practice',
        sourceItems: [],
        count: 3,
      });

      expect(result.success).toBe(true);
    });

    it('should handle missing planContext gracefully', async () => {
      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'language',
        sessionType: 'learn_new',
      });

      expect(result.success).toBe(true);
      expect(result.metadata.difficulty).toBeDefined();
    });

    it('should handle missing masteryData gracefully', async () => {
      const result = await skill.execute({
        action: 'generate_review_items',
        domainType: 'vocabulary',
        sourceItems: ['word1', 'word2'],
      });

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Integration with AI provider
  // ===========================================================================

  describe('AI provider integration', () => {
    beforeEach(() => {
      skill.getAIProvider = jest.fn().mockReturnValue(mockAIProvider);
    });

    it('should build proper prompt for vocabulary', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        items: [],
        sessionIntro: '',
        learningTips: [],
      });

      await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'review',
        planContext: { currentPhase: 2, totalPhases: 4, phaseGoals: ['Master basics'] },
        sourceItems: ['word1', 'word2'],
        count: 2,
      });

      const promptArg = mockAIProvider.generateContentWithJson.mock.calls[0][0];
      expect(promptArg).toContain('vocabulary');
      expect(promptArg).toContain('review');
      expect(promptArg).toContain('flashcard');
    });

    it('should include focus areas in prompt', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        items: [],
      });

      await skill.execute({
        action: 'generate_session_content',
        domainType: 'math',
        sessionType: 'practice',
        planContext: { focusAreas: ['algebra', 'equations'] },
        count: 1,
      });

      const promptArg = mockAIProvider.generateContentWithJson.mock.calls[0][0];
      expect(promptArg).toContain('algebra');
      expect(promptArg).toContain('equations');
    });

    it('should include source content in prompt', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        items: [],
      });

      await skill.execute({
        action: 'generate_session_content',
        domainType: 'knowledge',
        sessionType: 'quiz',
        sourceContent: 'The mitochondria is the powerhouse of the cell.',
        count: 1,
      });

      const promptArg = mockAIProvider.generateContentWithJson.mock.calls[0][0];
      expect(promptArg).toContain('mitochondria');
    });

    it('should parse AI response correctly', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        items: [
          {
            type: 'flashcard',
            content: { front: 'Hello', back: 'Hola' },
            difficulty: 'easy',
          },
        ],
        sessionIntro: 'Welcome!',
        learningTips: ['Practice daily'],
      });

      const result = await skill.execute({
        action: 'generate_session_content',
        domainType: 'language',
        sessionType: 'learn_new',
        count: 1,
      });

      expect(result.content.items).toHaveLength(1);
      expect(result.content.items[0].type).toBe('flashcard');
      expect(result.content.sessionIntro).toBe('Welcome!');
    });
  });

  // ===========================================================================
  // Integration test
  // ===========================================================================

  describe('learning plan integration', () => {
    it('should generate content appropriate for learning plan phase', async () => {
      // Early phase - basic difficulty, high scaffolding
      const earlyResult = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'learn_new',
        planContext: {
          currentPhase: 1,
          totalPhases: 4,
          phaseGoals: ['Learn basic vocabulary'],
          focusAreas: ['common words'],
        },
        count: 5,
      });

      expect(earlyResult.metadata.difficulty.complexity).toBe('basic');
      expect(earlyResult.metadata.difficulty.scaffolding).toBe('high');

      // Late phase - advanced difficulty, low scaffolding
      const lateResult = await skill.execute({
        action: 'generate_session_content',
        domainType: 'vocabulary',
        sessionType: 'assessment',
        planContext: {
          currentPhase: 4,
          totalPhases: 4,
          phaseGoals: ['Master advanced vocabulary'],
          focusAreas: ['academic words'],
        },
        count: 10,
      });

      expect(lateResult.metadata.difficulty.complexity).toBe('advanced');
      expect(lateResult.metadata.difficulty.scaffolding).toBe('low');
    });
  });
});

// ===========================================================================
// Module integration test
// ===========================================================================

describe('ContentGenerationSkill module integration', () => {
  it('should be exported from learning skills index', () => {
    const learningSkills = require('../../main/skills/learning');
    expect(learningSkills.ContentGenerationSkill).toBeDefined();
  });

  it('should be included in learningSkills array', () => {
    const { learningSkills } = require('../../main/skills/learning');
    const skillNames = learningSkills.map(s => s.name);
    expect(skillNames).toContain('generate_learning_content');
  });

  it('should be registered by registerLearningSkills', () => {
    const { registerLearningSkills } = require('../../main/skills/learning');

    const mockRegistry = {
      register: jest.fn(),
    };

    registerLearningSkills(mockRegistry);

    const registeredNames = mockRegistry.register.mock.calls.map(call => call[0].name);
    expect(registeredNames).toContain('generate_learning_content');
  });
});
