/**
 * LearningGraphSkill Tests
 *
 * Comprehensive tests for knowledge graph integration in learning.
 * Tests domain-specific schemas, learning paths, mastery tracking,
 * and weak concept detection.
 */

const LearningGraphSkill = require('../../main/skills/learning/LearningGraphSkill');

// Mock graph features
const mockGraphFeatures = {
  isAvailable: jest.fn().mockReturnValue(true),
  createConceptWithPrereqs: jest.fn(),
  getPersonalizedLearningPath: jest.fn(),
  detectWeakConcepts: jest.fn(),
  getDependentConcepts: jest.fn(),
};

// Mock graph interface with session
const mockSession = {
  run: jest.fn(),
};

const mockGraphInterface = {
  adapter: {
    session: mockSession,
  },
};

describe('LearningGraphSkill', () => {
  let skill;

  beforeEach(() => {
    skill = new LearningGraphSkill();
    skill.context = {
      token: 'test-token-123',
      services: {
        graphLearningFeatures: mockGraphFeatures,
        graphInterface: mockGraphInterface,
      },
    };
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Static Properties Tests
  // ==========================================================================

  describe('static properties', () => {
    it('should have correct name', () => {
      expect(LearningGraphSkill.name).toBe('manage_learning_graph');
    });

    it('should have correct category', () => {
      expect(LearningGraphSkill.category).toBe('learning');
    });

    it('should have action as required parameter', () => {
      expect(LearningGraphSkill.requiredParams).toContain('action');
    });

    it('should have description', () => {
      expect(LearningGraphSkill.description).toBeDefined();
      expect(LearningGraphSkill.description.length).toBeGreaterThan(20);
    });

    it('should have action parameter with enum', () => {
      const actions = LearningGraphSkill.parameters.action.enum;
      expect(actions).toContain('create_concept');
      expect(actions).toContain('link_concepts');
      expect(actions).toContain('get_learning_path');
      expect(actions).toContain('get_weak_concepts');
      expect(actions).toContain('update_mastery');
      expect(actions).toContain('get_concept_network');
      expect(actions).toContain('get_domain_schema');
      expect(actions).toContain('suggest_next_concepts');
      expect(actions).toContain('get_prerequisites');
      expect(actions).toContain('get_dependents');
      expect(actions).toContain('find_related_concepts');
      expect(actions).toContain('get_mastery_overview');
    });

    it('should have domainType parameter with enum', () => {
      const domains = LearningGraphSkill.parameters.domainType.enum;
      expect(domains).toContain('vocabulary');
      expect(domains).toContain('math');
      expect(domains).toContain('language');
      expect(domains).toContain('knowledge');
      expect(domains).toContain('skill');
    });
  });

  describe('isAvailable', () => {
    it('should return true when graph features are available', () => {
      const context = {
        services: {
          graphLearningFeatures: mockGraphFeatures,
        },
      };
      expect(LearningGraphSkill.isAvailable(context)).toBe(true);
    });

    it('should return false when graph features are unavailable', () => {
      mockGraphFeatures.isAvailable.mockReturnValue(false);
      const context = {
        services: {
          graphLearningFeatures: mockGraphFeatures,
        },
      };
      expect(LearningGraphSkill.isAvailable(context)).toBe(false);
    });

    it('should return false when no graph features in context', () => {
      expect(LearningGraphSkill.isAvailable({})).toBe(false);
      expect(LearningGraphSkill.isAvailable(null)).toBe(false);
    });
  });

  // ==========================================================================
  // get_domain_schema Tests
  // ==========================================================================

  describe('get_domain_schema action', () => {
    it('should return vocabulary domain schema', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
        domainType: 'vocabulary',
      });

      expect(result.success).toBe(true);
      expect(result.domainType).toBe('vocabulary');
      expect(result.schema.nodeTypes).toContain('Word');
      expect(result.schema.nodeTypes).toContain('Root');
      expect(result.schema.nodeTypes).toContain('WordFamily');
    });

    it('should return math domain schema', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
        domainType: 'math',
      });

      expect(result.success).toBe(true);
      expect(result.schema.nodeTypes).toContain('Concept');
      expect(result.schema.nodeTypes).toContain('Formula');
      expect(result.schema.nodeTypes).toContain('Theorem');
      expect(result.schema.nodeTypes).toContain('Proof');
    });

    it('should return language domain schema', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
        domainType: 'language',
      });

      expect(result.success).toBe(true);
      expect(result.schema.nodeTypes).toContain('GrammarRule');
      expect(result.schema.nodeTypes).toContain('Pattern');
      expect(result.schema.nodeTypes).toContain('Exception');
    });

    it('should return knowledge domain schema', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
        domainType: 'knowledge',
      });

      expect(result.success).toBe(true);
      expect(result.schema.nodeTypes).toContain('Concept');
      expect(result.schema.nodeTypes).toContain('Fact');
      expect(result.schema.nodeTypes).toContain('Topic');
    });

    it('should return skill domain schema', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
        domainType: 'skill',
      });

      expect(result.success).toBe(true);
      expect(result.schema.nodeTypes).toContain('Technique');
      expect(result.schema.nodeTypes).toContain('Application');
      expect(result.schema.nodeTypes).toContain('Project');
    });

    it('should include relationships in schema', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
        domainType: 'vocabulary',
      });

      expect(result.schema.relationships).toBeDefined();
      expect(result.schema.relationships.length).toBeGreaterThan(0);
      const relTypes = result.schema.relationships.map(r => r.type);
      expect(relTypes).toContain('HAS_ROOT');
      expect(relTypes).toContain('SYNONYM_OF');
    });

    it('should include mastery thresholds in schema', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
        domainType: 'vocabulary',
      });

      expect(result.schema.masteryThresholds).toBeDefined();
      expect(result.schema.masteryThresholds.novice).toBe(0);
      expect(result.schema.masteryThresholds.expert).toBe(95);
    });

    it('should include domain description', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
        domainType: 'vocabulary',
      });

      expect(result.schema.description).toBeDefined();
      expect(result.schema.description.length).toBeGreaterThan(10);
    });

    it('should default to knowledge domain', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
      });

      expect(result.success).toBe(true);
      expect(result.domainType).toBe('knowledge');
    });

    it('should return error for unknown domain', async () => {
      const result = await skill.execute({
        action: 'get_domain_schema',
        domainType: 'invalid_domain',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown domain');
      expect(result.availableDomains).toBeDefined();
    });
  });

  // ==========================================================================
  // create_concept Tests
  // ==========================================================================

  describe('create_concept action', () => {
    beforeEach(() => {
      mockGraphFeatures.createConceptWithPrereqs.mockResolvedValue({
        id: 'concept_123',
        name: 'Test Concept',
        domain: 'vocabulary',
      });
    });

    it('should create a concept', async () => {
      const result = await skill.execute({
        action: 'create_concept',
        domainType: 'vocabulary',
        concept: {
          name: 'Ephemeral',
          description: 'Lasting for a short time',
          nodeType: 'Word',
          difficulty: 'intermediate',
        },
      });

      expect(result.success).toBe(true);
      expect(result.concept).toBeDefined();
      expect(result.domainType).toBe('vocabulary');
      expect(result.nodeType).toBe('Word');
    });

    it('should validate node type for domain', async () => {
      const result = await skill.execute({
        action: 'create_concept',
        domainType: 'vocabulary',
        concept: {
          name: 'Test',
          nodeType: 'InvalidType',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid node type');
    });

    it('should use default node type when not specified', async () => {
      const result = await skill.execute({
        action: 'create_concept',
        domainType: 'vocabulary',
        concept: {
          name: 'Test Word',
        },
      });

      expect(result.success).toBe(true);
      expect(result.nodeType).toBe('Word'); // First node type for vocabulary
    });

    it('should include prerequisites when provided', async () => {
      await skill.execute({
        action: 'create_concept',
        domainType: 'math',
        concept: {
          name: 'Calculus',
          nodeType: 'Concept',
          prerequisites: ['prereq_1', 'prereq_2'],
        },
      });

      expect(mockGraphFeatures.createConceptWithPrereqs).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Calculus',
        }),
        ['prereq_1', 'prereq_2'],
        'test-token-123'
      );
    });

    it('should return error when graph features unavailable', async () => {
      skill.context.services.graphLearningFeatures = null;
      // Force getGraphFeatures to return null
      skill.getGraphFeatures = jest.fn().mockReturnValue(null);

      const result = await skill.execute({
        action: 'create_concept',
        concept: { name: 'Test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Graph features not available');
    });

    it('should return error when no token', async () => {
      skill.context.token = null;

      const result = await skill.execute({
        action: 'create_concept',
        concept: { name: 'Test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    it('should handle creation error', async () => {
      mockGraphFeatures.createConceptWithPrereqs.mockRejectedValue(
        new Error('Database error')
      );

      const result = await skill.execute({
        action: 'create_concept',
        concept: { name: 'Test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  // ==========================================================================
  // link_concepts Tests
  // ==========================================================================

  describe('link_concepts action', () => {
    beforeEach(() => {
      mockSession.run.mockResolvedValue({
        records: [{ dummy: true }],
      });
    });

    it('should link two concepts', async () => {
      const result = await skill.execute({
        action: 'link_concepts',
        sourceConceptId: 'concept_1',
        targetConceptId: 'concept_2',
        relationshipType: 'REQUIRES',
        domainType: 'math',
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('concept_1');
      expect(result.target).toBe('concept_2');
      expect(result.relationshipType).toBe('REQUIRES');
    });

    it('should require sourceConceptId', async () => {
      const result = await skill.execute({
        action: 'link_concepts',
        targetConceptId: 'concept_2',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sourceConceptId and targetConceptId are required');
    });

    it('should require targetConceptId', async () => {
      const result = await skill.execute({
        action: 'link_concepts',
        sourceConceptId: 'concept_1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sourceConceptId and targetConceptId are required');
    });

    it('should validate relationship type for domain', async () => {
      const result = await skill.execute({
        action: 'link_concepts',
        sourceConceptId: 'concept_1',
        targetConceptId: 'concept_2',
        relationshipType: 'INVALID_REL',
        domainType: 'vocabulary',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid relationship');
    });

    it('should allow RELATED_TO for any domain', async () => {
      const result = await skill.execute({
        action: 'link_concepts',
        sourceConceptId: 'concept_1',
        targetConceptId: 'concept_2',
        relationshipType: 'RELATED_TO',
        domainType: 'vocabulary',
      });

      expect(result.success).toBe(true);
      expect(result.relationshipType).toBe('RELATED_TO');
    });

    it('should default to RELATED_TO when no type specified', async () => {
      const result = await skill.execute({
        action: 'link_concepts',
        sourceConceptId: 'concept_1',
        targetConceptId: 'concept_2',
      });

      expect(result.success).toBe(true);
      expect(result.relationshipType).toBe('RELATED_TO');
    });

    it('should return false when no records created', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await skill.execute({
        action: 'link_concepts',
        sourceConceptId: 'concept_1',
        targetConceptId: 'concept_2',
      });

      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // get_learning_path Tests
  // ==========================================================================

  describe('get_learning_path action', () => {
    beforeEach(() => {
      mockGraphFeatures.getPersonalizedLearningPath.mockResolvedValue({
        targetConcept: { id: 'target_1', name: 'Advanced Calculus' },
        prerequisites: [
          { id: 'prereq_1', name: 'Basic Algebra', mastery: 0.8 },
          { id: 'prereq_2', name: 'Trigonometry', mastery: 0.6 },
        ],
        conceptCount: 3,
        estimatedMinutes: 90,
      });
    });

    it('should get personalized learning path', async () => {
      const result = await skill.execute({
        action: 'get_learning_path',
        targetConceptId: 'target_1',
        domainType: 'math',
      });

      expect(result.success).toBe(true);
      expect(result.learningPath).toBeDefined();
      expect(result.learningPath.targetConcept).toBeDefined();
      expect(result.learningPath.prerequisites).toBeDefined();
    });

    it('should include domain-specific recommendations', async () => {
      const result = await skill.execute({
        action: 'get_learning_path',
        targetConceptId: 'target_1',
        domainType: 'math',
      });

      expect(result.learningPath.recommendations).toBeDefined();
      expect(result.learningPath.recommendations.length).toBeGreaterThan(0);
    });

    it('should add pacing recommendation for long paths', async () => {
      mockGraphFeatures.getPersonalizedLearningPath.mockResolvedValue({
        conceptCount: 10,
        estimatedMinutes: 120,
        prerequisites: [],
      });

      const result = await skill.execute({
        action: 'get_learning_path',
        targetConceptId: 'target_1',
      });

      const pacingRec = result.learningPath.recommendations.find(r => r.type === 'pacing');
      expect(pacingRec).toBeDefined();
    });

    it('should add time recommendation for long duration', async () => {
      mockGraphFeatures.getPersonalizedLearningPath.mockResolvedValue({
        conceptCount: 3,
        estimatedMinutes: 120,
        prerequisites: [],
      });

      const result = await skill.execute({
        action: 'get_learning_path',
        targetConceptId: 'target_1',
      });

      const timeRec = result.learningPath.recommendations.find(r => r.type === 'time');
      expect(timeRec).toBeDefined();
    });

    it('should add strategy recommendation for vocabulary domain', async () => {
      const result = await skill.execute({
        action: 'get_learning_path',
        targetConceptId: 'target_1',
        domainType: 'vocabulary',
      });

      const strategyRec = result.learningPath.recommendations.find(r => r.type === 'strategy');
      expect(strategyRec).toBeDefined();
      expect(strategyRec.message).toContain('word roots');
    });

    it('should add strategy recommendation for math domain', async () => {
      const result = await skill.execute({
        action: 'get_learning_path',
        targetConceptId: 'target_1',
        domainType: 'math',
      });

      const strategyRec = result.learningPath.recommendations.find(r => r.type === 'strategy');
      expect(strategyRec).toBeDefined();
      expect(strategyRec.message).toContain('formula');
    });

    it('should require targetConceptId', async () => {
      const result = await skill.execute({
        action: 'get_learning_path',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('targetConceptId is required');
    });

    it('should handle null learning path', async () => {
      mockGraphFeatures.getPersonalizedLearningPath.mockResolvedValue(null);

      const result = await skill.execute({
        action: 'get_learning_path',
        targetConceptId: 'target_1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not generate learning path');
    });
  });

  // ==========================================================================
  // get_weak_concepts Tests
  // ==========================================================================

  describe('get_weak_concepts action', () => {
    beforeEach(() => {
      mockGraphFeatures.detectWeakConcepts.mockResolvedValue([
        {
          id: 'concept_1',
          name: 'Derivatives',
          domain: 'math',
          mastery: 0.3,
          weaknessScore: 120,
          dependentCount: 5,
        },
        {
          id: 'concept_2',
          name: 'Integration',
          domain: 'math',
          mastery: 0.4,
          weaknessScore: 80,
          dependentCount: 3,
        },
      ]);
    });

    it('should get weak concepts', async () => {
      const result = await skill.execute({
        action: 'get_weak_concepts',
        domainType: 'math',
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.weakConcepts).toBeDefined();
      expect(result.count).toBe(2);
    });

    it('should filter by domain', async () => {
      mockGraphFeatures.detectWeakConcepts.mockResolvedValue([
        { id: '1', name: 'Math Concept', domain: 'math', mastery: 0.3 },
        { id: '2', name: 'Vocab Word', domain: 'vocabulary', mastery: 0.4 },
      ]);

      const result = await skill.execute({
        action: 'get_weak_concepts',
        domainType: 'math',
      });

      expect(result.weakConcepts.length).toBe(1);
      expect(result.weakConcepts[0].domain).toBe('math');
    });

    it('should include remediation plan for each concept', async () => {
      const result = await skill.execute({
        action: 'get_weak_concepts',
        domainType: 'math',
      });

      result.weakConcepts.forEach(concept => {
        expect(concept.remediation).toBeDefined();
        expect(concept.remediation.priority).toBeDefined();
        expect(concept.remediation.suggestedActions).toBeDefined();
        expect(concept.remediation.estimatedSessions).toBeDefined();
      });
    });

    it('should set high priority for high weakness score', async () => {
      const result = await skill.execute({
        action: 'get_weak_concepts',
        domainType: 'math',
      });

      const highScoreConcept = result.weakConcepts.find(c => c.weaknessScore > 100);
      expect(highScoreConcept.remediation.priority).toBe('high');
    });

    it('should suggest foundational review for low mastery', async () => {
      mockGraphFeatures.detectWeakConcepts.mockResolvedValue([
        { id: '1', name: 'Concept', domain: 'math', mastery: 0.2 },
      ]);

      const result = await skill.execute({
        action: 'get_weak_concepts',
      });

      const actions = result.weakConcepts[0].remediation.suggestedActions;
      expect(actions.some(a => a.includes('foundational'))).toBe(true);
    });

    it('should prioritize blocking concepts', async () => {
      mockGraphFeatures.detectWeakConcepts.mockResolvedValue([
        { id: '1', name: 'Concept', domain: 'math', mastery: 0.5, dependentCount: 10 },
      ]);

      const result = await skill.execute({
        action: 'get_weak_concepts',
      });

      const actions = result.weakConcepts[0].remediation.suggestedActions;
      expect(actions.some(a => a.includes('blocks'))).toBe(true);
    });

    it('should use default limit of 10', async () => {
      await skill.execute({
        action: 'get_weak_concepts',
      });

      expect(mockGraphFeatures.detectWeakConcepts).toHaveBeenCalledWith(
        'test-token-123',
        10
      );
    });
  });

  // ==========================================================================
  // update_mastery Tests
  // ==========================================================================

  describe('update_mastery action', () => {
    beforeEach(() => {
      mockSession.run.mockImplementation((query) => {
        if (query.includes('RETURN c.masteryLevel AS mastery')) {
          return Promise.resolve({
            records: [{ get: () => 50 }],
          });
        }
        return Promise.resolve({
          records: [{
            get: (key) => key === 'mastery' ? 60 : 5,
          }],
        });
      });
    });

    it('should update mastery directly', async () => {
      const result = await skill.execute({
        action: 'update_mastery',
        conceptId: 'concept_1',
        mastery: 75,
      });

      expect(result.success).toBe(true);
      expect(result.mastery).toBe(75);
      expect(result.masteryLevel).toBeDefined();
    });

    it('should calculate mastery from correct answer', async () => {
      const result = await skill.execute({
        action: 'update_mastery',
        conceptId: 'concept_1',
        masteryData: {
          correct: true,
          responseTime: 2000,
          confidence: 90,
        },
      });

      expect(result.success).toBe(true);
      // 50 + 5 (correct) + 2 (fast) + 1 (confident) = 58
      expect(result.mastery).toBeGreaterThan(50);
    });

    it('should give time bonus for fast response', async () => {
      const fastResult = await skill.execute({
        action: 'update_mastery',
        conceptId: 'concept_1',
        masteryData: { correct: true, responseTime: 1000 },
      });

      mockSession.run.mockImplementation((query) => {
        if (query.includes('RETURN c.masteryLevel AS mastery')) {
          return Promise.resolve({ records: [{ get: () => 50 }] });
        }
        return Promise.resolve({
          records: [{ get: (key) => key === 'mastery' ? 55 : 5 }],
        });
      });

      const slowResult = await skill.execute({
        action: 'update_mastery',
        conceptId: 'concept_2',
        masteryData: { correct: true, responseTime: 5000 },
      });

      expect(fastResult.mastery).toBeGreaterThanOrEqual(slowResult.mastery);
    });

    it('should decrease mastery for incorrect answer', async () => {
      const result = await skill.execute({
        action: 'update_mastery',
        conceptId: 'concept_1',
        masteryData: { correct: false },
      });

      expect(result.success).toBe(true);
      // 50 - 3 = 47
      expect(result.mastery).toBeLessThan(50);
    });

    it('should cap mastery at 100', async () => {
      const result = await skill.execute({
        action: 'update_mastery',
        conceptId: 'concept_1',
        mastery: 150,
      });

      expect(result.mastery).toBe(100);
    });

    it('should floor mastery at 0', async () => {
      const result = await skill.execute({
        action: 'update_mastery',
        conceptId: 'concept_1',
        mastery: -10,
      });

      expect(result.mastery).toBe(0);
    });

    it('should require conceptId', async () => {
      const result = await skill.execute({
        action: 'update_mastery',
        mastery: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('conceptId is required');
    });

    it('should require mastery or masteryData', async () => {
      const result = await skill.execute({
        action: 'update_mastery',
        conceptId: 'concept_1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Either mastery or masteryData.correct is required');
    });

    it('should return correct mastery level', async () => {
      const testCases = [
        { mastery: 10, expected: 'novice' },
        { mastery: 25, expected: 'beginner' },
        { mastery: 45, expected: 'intermediate' },
        { mastery: 65, expected: 'proficient' },
        { mastery: 85, expected: 'advanced' },
        { mastery: 98, expected: 'expert' },
      ];

      for (const { mastery, expected } of testCases) {
        mockSession.run.mockResolvedValue({
          records: [{
            get: (key) => key === 'mastery' ? mastery : 1,
          }],
        });

        const result = await skill.execute({
          action: 'update_mastery',
          conceptId: 'concept_1',
          mastery,
        });

        expect(result.masteryLevel).toBe(expected);
      }
    });

    it('should handle concept not found', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await skill.execute({
        action: 'update_mastery',
        conceptId: 'nonexistent',
        mastery: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Concept not found');
    });
  });

  // ==========================================================================
  // get_concept_network Tests
  // ==========================================================================

  describe('get_concept_network action', () => {
    beforeEach(() => {
      mockSession.run.mockResolvedValue({
        records: [{
          get: (key) => {
            if (key === 'center') {
              return { properties: { id: 'center_1', name: 'Central Concept' } };
            }
            if (key === 'relatedConcepts') {
              return [
                { properties: { id: 'rel_1', name: 'Related 1' } },
                { properties: { id: 'rel_2', name: 'Related 2' } },
              ];
            }
            if (key === 'relationships') {
              return [{ type: 'REQUIRES', startNode: 'center_1', endNode: 'rel_1' }];
            }
            return null;
          },
        }],
      });
    });

    it('should get concept network', async () => {
      const result = await skill.execute({
        action: 'get_concept_network',
        conceptId: 'center_1',
        depth: 2,
      });

      expect(result.success).toBe(true);
      expect(result.network).toBeDefined();
      expect(result.network.center).toBeDefined();
      expect(result.network.related).toBeDefined();
      expect(result.network.relationships).toBeDefined();
    });

    it('should include concept count', async () => {
      const result = await skill.execute({
        action: 'get_concept_network',
        conceptId: 'center_1',
      });

      expect(result.network.conceptCount).toBe(3); // center + 2 related
    });

    it('should require conceptId', async () => {
      const result = await skill.execute({
        action: 'get_concept_network',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('conceptId is required');
    });

    it('should handle concept not found', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await skill.execute({
        action: 'get_concept_network',
        conceptId: 'nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Concept not found');
    });

    it('should use default depth of 2', async () => {
      await skill.execute({
        action: 'get_concept_network',
        conceptId: 'center_1',
      });

      const call = mockSession.run.mock.calls[0][0];
      expect(call).toContain('*1..2'); // depth limited to 2
    });

    it('should cap depth at 5', async () => {
      await skill.execute({
        action: 'get_concept_network',
        conceptId: 'center_1',
        depth: 10,
      });

      const call = mockSession.run.mock.calls[0][0];
      expect(call).toContain('*1..5'); // capped at 5
    });
  });

  // ==========================================================================
  // suggest_next_concepts Tests
  // ==========================================================================

  describe('suggest_next_concepts action', () => {
    beforeEach(() => {
      mockSession.run.mockResolvedValue({
        records: [
          {
            get: (key) => {
              const data = {
                id: 'concept_1',
                name: 'Next Concept',
                description: 'Learn this next',
                difficulty: 'beginner',
                mastery: 30,
                domain: 'math',
                prereqCount: 0,
              };
              return data[key];
            },
          },
        ],
      });
    });

    it('should suggest next concepts', async () => {
      const result = await skill.execute({
        action: 'suggest_next_concepts',
        domainType: 'math',
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should mark suggestions as ready to learn', async () => {
      const result = await skill.execute({
        action: 'suggest_next_concepts',
      });

      result.suggestions.forEach(s => {
        expect(s.readyToLearn).toBe(true);
      });
    });

    it('should include concept details', async () => {
      const result = await skill.execute({
        action: 'suggest_next_concepts',
      });

      const suggestion = result.suggestions[0];
      expect(suggestion.id).toBeDefined();
      expect(suggestion.name).toBeDefined();
      expect(suggestion.difficulty).toBeDefined();
      expect(suggestion.mastery).toBeDefined();
    });

    it('should use default limit of 5', async () => {
      await skill.execute({
        action: 'suggest_next_concepts',
      });

      const params = mockSession.run.mock.calls[0][1];
      expect(params.limit).toBe(5);
    });
  });

  // ==========================================================================
  // get_prerequisites Tests
  // ==========================================================================

  describe('get_prerequisites action', () => {
    beforeEach(() => {
      mockSession.run.mockResolvedValue({
        records: [
          {
            get: (key) => {
              const data = { id: 'prereq_1', name: 'Prereq 1', mastery: 70, difficulty: 'beginner', level: 1 };
              return data[key];
            },
          },
          {
            get: (key) => {
              const data = { id: 'prereq_2', name: 'Prereq 2', mastery: 50, difficulty: 'intermediate', level: 2 };
              return data[key];
            },
          },
        ],
      });
    });

    it('should get prerequisites', async () => {
      const result = await skill.execute({
        action: 'get_prerequisites',
        conceptId: 'concept_1',
      });

      expect(result.success).toBe(true);
      expect(result.prerequisites).toBeDefined();
      expect(result.prerequisites.length).toBe(2);
    });

    it('should include mastered status', async () => {
      const result = await skill.execute({
        action: 'get_prerequisites',
        conceptId: 'concept_1',
      });

      expect(result.prerequisites[0].mastered).toBe(true); // 70 >= 60
      expect(result.prerequisites[1].mastered).toBe(false); // 50 < 60
    });

    it('should indicate if all prerequisites are mastered', async () => {
      mockSession.run.mockResolvedValue({
        records: [
          { get: (key) => ({ id: 'prereq_1', name: 'P1', mastery: 80, level: 1 })[key] },
        ],
      });

      const result = await skill.execute({
        action: 'get_prerequisites',
        conceptId: 'concept_1',
      });

      expect(result.allMastered).toBe(true);
      expect(result.readyToLearn).toBe(true);
    });

    it('should indicate not ready when prerequisites incomplete', async () => {
      const result = await skill.execute({
        action: 'get_prerequisites',
        conceptId: 'concept_1',
      });

      expect(result.allMastered).toBe(false);
      expect(result.readyToLearn).toBe(false);
    });

    it('should be ready when no prerequisites', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await skill.execute({
        action: 'get_prerequisites',
        conceptId: 'concept_1',
      });

      expect(result.readyToLearn).toBe(true);
    });

    it('should require conceptId', async () => {
      const result = await skill.execute({
        action: 'get_prerequisites',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('conceptId is required');
    });
  });

  // ==========================================================================
  // get_dependents Tests
  // ==========================================================================

  describe('get_dependents action', () => {
    beforeEach(() => {
      mockGraphFeatures.getDependentConcepts.mockResolvedValue([
        { id: 'dep_1', name: 'Dependent 1' },
        { id: 'dep_2', name: 'Dependent 2' },
        { id: 'dep_3', name: 'Dependent 3' },
      ]);
    });

    it('should get dependent concepts', async () => {
      const result = await skill.execute({
        action: 'get_dependents',
        conceptId: 'concept_1',
      });

      expect(result.success).toBe(true);
      expect(result.dependents).toBeDefined();
      expect(result.count).toBe(3);
    });

    it('should assess impact level', async () => {
      const result = await skill.execute({
        action: 'get_dependents',
        conceptId: 'concept_1',
      });

      expect(result.impact).toBe('medium'); // 3 dependents = medium
    });

    it('should return high impact for many dependents', async () => {
      mockGraphFeatures.getDependentConcepts.mockResolvedValue(
        Array(8).fill({ id: 'dep', name: 'Dep' })
      );

      const result = await skill.execute({
        action: 'get_dependents',
        conceptId: 'concept_1',
      });

      expect(result.impact).toBe('high');
    });

    it('should return low impact for few dependents', async () => {
      mockGraphFeatures.getDependentConcepts.mockResolvedValue([
        { id: 'dep_1', name: 'Dep 1' },
      ]);

      const result = await skill.execute({
        action: 'get_dependents',
        conceptId: 'concept_1',
      });

      expect(result.impact).toBe('low');
    });

    it('should require conceptId', async () => {
      const result = await skill.execute({
        action: 'get_dependents',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('conceptId is required');
    });
  });

  // ==========================================================================
  // find_related_concepts Tests
  // ==========================================================================

  describe('find_related_concepts action', () => {
    beforeEach(() => {
      mockSession.run.mockResolvedValue({
        records: [
          {
            get: (key) => ({
              id: 'rel_1',
              name: 'Related 1',
              domain: 'math',
              mastery: 70,
              relationship: 'REQUIRES',
              difficulty: 'intermediate',
            })[key],
          },
        ],
      });
    });

    it('should find related concepts', async () => {
      const result = await skill.execute({
        action: 'find_related_concepts',
        conceptId: 'concept_1',
      });

      expect(result.success).toBe(true);
      expect(result.related).toBeDefined();
      expect(result.related.length).toBe(1);
    });

    it('should include relationship type', async () => {
      const result = await skill.execute({
        action: 'find_related_concepts',
        conceptId: 'concept_1',
      });

      expect(result.related[0].relationship).toBe('REQUIRES');
    });

    it('should filter by domain', async () => {
      await skill.execute({
        action: 'find_related_concepts',
        conceptId: 'concept_1',
        domainType: 'math',
      });

      const query = mockSession.run.mock.calls[0][0];
      expect(query).toContain('domain');
    });

    it('should require conceptId', async () => {
      const result = await skill.execute({
        action: 'find_related_concepts',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('conceptId is required');
    });
  });

  // ==========================================================================
  // get_mastery_overview Tests
  // ==========================================================================

  describe('get_mastery_overview action', () => {
    beforeEach(() => {
      mockSession.run.mockResolvedValue({
        records: [
          {
            get: (key) => {
              const data = {
                domain: 'math',
                totalConcepts: { toNumber: () => 50 },
                avgMastery: 65,
                mastered: { toNumber: () => 20 },
                learning: { toNumber: () => 20 },
                needsWork: { toNumber: () => 10 },
              };
              return data[key];
            },
          },
          {
            get: (key) => {
              const data = {
                domain: 'vocabulary',
                totalConcepts: { toNumber: () => 100 },
                avgMastery: 55,
                mastered: { toNumber: () => 30 },
                learning: { toNumber: () => 40 },
                needsWork: { toNumber: () => 30 },
              };
              return data[key];
            },
          },
        ],
      });
    });

    it('should get mastery overview', async () => {
      const result = await skill.execute({
        action: 'get_mastery_overview',
      });

      expect(result.success).toBe(true);
      expect(result.overview).toBeDefined();
      expect(result.overview.length).toBe(2);
    });

    it('should include totals', async () => {
      const result = await skill.execute({
        action: 'get_mastery_overview',
      });

      expect(result.totals).toBeDefined();
      expect(result.totals.totalConcepts).toBe(150);
      expect(result.totals.masteredCount).toBe(50);
    });

    it('should include mastery level for each domain', async () => {
      const result = await skill.execute({
        action: 'get_mastery_overview',
      });

      result.overview.forEach(domain => {
        expect(domain.masteryLevel).toBeDefined();
      });
    });

    it('should filter by domain when specified', async () => {
      await skill.execute({
        action: 'get_mastery_overview',
        domainType: 'math',
      });

      const params = mockSession.run.mock.calls[0][1];
      expect(params.domain).toBe('math');
    });

    it('should handle empty results', async () => {
      mockSession.run.mockResolvedValue({ records: [] });

      const result = await skill.execute({
        action: 'get_mastery_overview',
      });

      expect(result.success).toBe(true);
      expect(result.overview).toEqual([]);
      expect(result.totals.totalConcepts).toBe(0);
    });
  });

  // ==========================================================================
  // Unknown Action Tests
  // ==========================================================================

  describe('unknown action', () => {
    it('should throw error for unknown action', async () => {
      await expect(skill.execute({
        action: 'invalid_action',
      })).rejects.toThrow('Unknown action');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    it('should handle session not available', async () => {
      skill.context.services.graphInterface = null;

      const result = await skill.execute({
        action: 'link_concepts',
        sourceConceptId: 'a',
        targetConceptId: 'b',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should handle database errors gracefully', async () => {
      mockSession.run.mockRejectedValue(new Error('Connection lost'));

      const result = await skill.execute({
        action: 'get_concept_network',
        conceptId: 'concept_1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection lost');
    });
  });
});
