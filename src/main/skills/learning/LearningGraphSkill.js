/**
 * LearningGraphSkill - Knowledge Graph Integration for Learning
 *
 * This skill integrates the learning system with Neo4j knowledge graph to provide:
 * - Domain-specific concept schemas
 * - Personalized learning path generation
 * - Concept relationship mapping
 * - Mastery tracking across concepts
 * - Weak concept detection and remediation
 * - Cross-domain concept linking
 *
 * Domain-Specific Schemas:
 * - Vocabulary: word -> root -> family -> synonym/antonym relationships
 * - Math: concept -> formula -> theorem -> proof dependencies
 * - Language: grammar_rule -> pattern -> usage -> exception relationships
 * - Knowledge: concept -> fact -> relationship -> hierarchy
 * - Skill: technique -> application -> project -> mastery_level
 */

const BaseSkill = require('../BaseSkill');

// Domain-specific relationship types
const DOMAIN_RELATIONSHIPS = {
  vocabulary: {
    nodeTypes: ['Word', 'Root', 'WordFamily', 'Definition', 'Example'],
    relationships: [
      { type: 'HAS_ROOT', from: 'Word', to: 'Root' },
      { type: 'BELONGS_TO', from: 'Word', to: 'WordFamily' },
      { type: 'SYNONYM_OF', from: 'Word', to: 'Word', bidirectional: true },
      { type: 'ANTONYM_OF', from: 'Word', to: 'Word', bidirectional: true },
      { type: 'DERIVED_FROM', from: 'Word', to: 'Word' },
      { type: 'HAS_DEFINITION', from: 'Word', to: 'Definition' },
      { type: 'HAS_EXAMPLE', from: 'Word', to: 'Example' },
    ],
  },
  math: {
    nodeTypes: ['Concept', 'Formula', 'Theorem', 'Proof', 'Problem'],
    relationships: [
      { type: 'REQUIRES', from: 'Concept', to: 'Concept' },
      { type: 'USES_FORMULA', from: 'Concept', to: 'Formula' },
      { type: 'PROVES', from: 'Proof', to: 'Theorem' },
      { type: 'APPLIES_TO', from: 'Formula', to: 'Problem' },
      { type: 'GENERALIZES', from: 'Concept', to: 'Concept' },
      { type: 'SPECIALIZES', from: 'Concept', to: 'Concept' },
    ],
  },
  language: {
    nodeTypes: ['GrammarRule', 'Pattern', 'Usage', 'Exception', 'Example'],
    relationships: [
      { type: 'REQUIRES', from: 'GrammarRule', to: 'GrammarRule' },
      { type: 'HAS_PATTERN', from: 'GrammarRule', to: 'Pattern' },
      { type: 'HAS_USAGE', from: 'Pattern', to: 'Usage' },
      { type: 'HAS_EXCEPTION', from: 'GrammarRule', to: 'Exception' },
      { type: 'SIMILAR_TO', from: 'Pattern', to: 'Pattern' },
      { type: 'CONTRASTS_WITH', from: 'GrammarRule', to: 'GrammarRule' },
    ],
  },
  knowledge: {
    nodeTypes: ['Concept', 'Fact', 'Topic', 'Category', 'Entity'],
    relationships: [
      { type: 'REQUIRES', from: 'Concept', to: 'Concept' },
      { type: 'PART_OF', from: 'Concept', to: 'Topic' },
      { type: 'BELONGS_TO', from: 'Topic', to: 'Category' },
      { type: 'RELATED_TO', from: 'Concept', to: 'Concept' },
      { type: 'SUPPORTS', from: 'Fact', to: 'Concept' },
      { type: 'MENTIONS', from: 'Concept', to: 'Entity' },
    ],
  },
  skill: {
    nodeTypes: ['Technique', 'Application', 'Project', 'Tool', 'Pattern'],
    relationships: [
      { type: 'REQUIRES', from: 'Technique', to: 'Technique' },
      { type: 'APPLIED_IN', from: 'Technique', to: 'Application' },
      { type: 'USES', from: 'Application', to: 'Tool' },
      { type: 'DEMONSTRATES', from: 'Project', to: 'Technique' },
      { type: 'IMPLEMENTS', from: 'Project', to: 'Pattern' },
      { type: 'BUILDS_ON', from: 'Technique', to: 'Technique' },
    ],
  },
};

// Mastery thresholds
const MASTERY_THRESHOLDS = {
  novice: 0,
  beginner: 20,
  intermediate: 40,
  proficient: 60,
  advanced: 80,
  expert: 95,
};

class LearningGraphSkill extends BaseSkill {
  static get name() {
    return 'manage_learning_graph';
  }

  static get description() {
    return 'Manage knowledge graph for learning. Create domain-specific concept networks, generate personalized learning paths, track mastery across concepts, and detect weak areas needing remediation.';
  }

  static get parameters() {
    return {
      action: {
        type: 'string',
        enum: [
          'create_concept',
          'link_concepts',
          'get_learning_path',
          'get_weak_concepts',
          'update_mastery',
          'get_concept_network',
          'get_domain_schema',
          'suggest_next_concepts',
          'get_prerequisites',
          'get_dependents',
          'find_related_concepts',
          'get_mastery_overview',
        ],
        description: 'The graph management action to perform',
      },
      domainType: {
        type: 'string',
        enum: ['vocabulary', 'math', 'language', 'knowledge', 'skill'],
        description: 'The learning domain type',
      },
      concept: {
        type: 'object',
        description: 'Concept data: { name, description, nodeType, difficulty, metadata }',
      },
      conceptId: {
        type: 'string',
        description: 'ID of a concept',
      },
      targetConceptId: {
        type: 'string',
        description: 'Target concept for learning path',
      },
      sourceConceptId: {
        type: 'string',
        description: 'Source concept for relationship',
      },
      relationshipType: {
        type: 'string',
        description: 'Type of relationship between concepts',
      },
      mastery: {
        type: 'number',
        description: 'Mastery level (0-100)',
      },
      masteryData: {
        type: 'object',
        description: 'Mastery update data: { correct, responseTime, confidence }',
      },
      limit: {
        type: 'number',
        default: 10,
        description: 'Maximum number of results',
      },
      topicId: {
        type: 'string',
        description: 'Associated learning topic ID',
      },
      planId: {
        type: 'string',
        description: 'Associated learning plan ID',
      },
      depth: {
        type: 'number',
        default: 3,
        description: 'Graph traversal depth',
      },
    };
  }

  static get requiredParams() {
    return ['action'];
  }

  static get category() {
    return 'learning';
  }

  /**
   * Check if graph features are available
   */
  static isAvailable(context) {
    const graphFeatures = context?.services?.graphLearningFeatures;
    if (graphFeatures) {
      return graphFeatures.isAvailable();
    }
    return false;
  }

  async execute(params) {
    const { action } = params;

    switch (action) {
      case 'create_concept':
        return this.createConcept(params);
      case 'link_concepts':
        return this.linkConcepts(params);
      case 'get_learning_path':
        return this.getLearningPath(params);
      case 'get_weak_concepts':
        return this.getWeakConcepts(params);
      case 'update_mastery':
        return this.updateMastery(params);
      case 'get_concept_network':
        return this.getConceptNetwork(params);
      case 'get_domain_schema':
        return this.getDomainSchema(params);
      case 'suggest_next_concepts':
        return this.suggestNextConcepts(params);
      case 'get_prerequisites':
        return this.getPrerequisites(params);
      case 'get_dependents':
        return this.getDependents(params);
      case 'find_related_concepts':
        return this.findRelatedConcepts(params);
      case 'get_mastery_overview':
        return this.getMasteryOverview(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Create a concept in the knowledge graph
   */
  async createConcept(params) {
    const { concept = {}, domainType = 'knowledge' } = params;
    const graphFeatures = this.getGraphFeatures();

    if (!graphFeatures) {
      return { success: false, error: 'Graph features not available' };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const domainSchema = DOMAIN_RELATIONSHIPS[domainType] || DOMAIN_RELATIONSHIPS.knowledge;

      // Validate node type for domain
      const nodeType = concept.nodeType || domainSchema.nodeTypes[0];
      if (!domainSchema.nodeTypes.includes(nodeType)) {
        return {
          success: false,
          error: `Invalid node type '${nodeType}' for domain '${domainType}'. Valid types: ${domainSchema.nodeTypes.join(', ')}`,
        };
      }

      const createdConcept = await graphFeatures.createConceptWithPrereqs(
        {
          name: concept.name,
          description: concept.description,
          domain: domainType,
          difficulty: concept.difficulty || 'intermediate',
          nodeType,
          metadata: concept.metadata || {},
        },
        concept.prerequisites || [],
        token
      );

      this.logExecution(
        { action: 'create_concept', domainType, nodeType },
        { conceptId: createdConcept?.id }
      );

      return {
        success: true,
        concept: createdConcept,
        domainType,
        nodeType,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a relationship between concepts
   */
  async linkConcepts(params) {
    const {
      sourceConceptId,
      targetConceptId,
      relationshipType,
      domainType = 'knowledge',
    } = params;

    if (!sourceConceptId || !targetConceptId) {
      return { success: false, error: 'sourceConceptId and targetConceptId are required' };
    }

    const graphFeatures = this.getGraphFeatures();
    if (!graphFeatures) {
      return { success: false, error: 'Graph features not available' };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const domainSchema = DOMAIN_RELATIONSHIPS[domainType] || DOMAIN_RELATIONSHIPS.knowledge;

      // Validate relationship type for domain
      const validRelTypes = domainSchema.relationships.map(r => r.type);
      const relType = relationshipType || 'RELATED_TO';

      if (!validRelTypes.includes(relType) && relType !== 'RELATED_TO') {
        return {
          success: false,
          error: `Invalid relationship '${relType}' for domain '${domainType}'. Valid types: ${validRelTypes.join(', ')}`,
        };
      }

      // Create the relationship using the graph interface
      const graphInterface = this.getGraphInterface();
      if (!graphInterface?.adapter?.session) {
        return { success: false, error: 'Graph session not available' };
      }

      const session = graphInterface.adapter.session;
      const result = await session.run(
        `
        MATCH (source:Concept {id: $sourceId})
        MATCH (target:Concept {id: $targetId})
        MERGE (source)-[r:${relType}]->(target)
        ON CREATE SET r.createdAt = datetime()
        RETURN source, r, target
        `,
        { sourceId: sourceConceptId, targetId: targetConceptId }
      );

      const created = result.records.length > 0;

      this.logExecution(
        { action: 'link_concepts', relationshipType: relType },
        { created }
      );

      return {
        success: created,
        relationshipType: relType,
        source: sourceConceptId,
        target: targetConceptId,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get personalized learning path to a target concept
   */
  async getLearningPath(params) {
    const { targetConceptId, domainType } = params;

    if (!targetConceptId) {
      return { success: false, error: 'targetConceptId is required' };
    }

    const graphFeatures = this.getGraphFeatures();
    if (!graphFeatures) {
      return { success: false, error: 'Graph features not available' };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const learningPath = await graphFeatures.getPersonalizedLearningPath(
        targetConceptId,
        token
      );

      if (!learningPath) {
        return { success: false, error: 'Could not generate learning path' };
      }

      // Enrich with domain-specific recommendations
      const recommendations = this.generatePathRecommendations(learningPath, domainType);

      return {
        success: true,
        learningPath: {
          ...learningPath,
          domainType,
          recommendations,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get weak concepts that need remediation
   */
  async getWeakConcepts(params) {
    const { domainType, limit = 10 } = params;

    const graphFeatures = this.getGraphFeatures();
    if (!graphFeatures) {
      return { success: false, error: 'Graph features not available' };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      let weakConcepts = await graphFeatures.detectWeakConcepts(token, limit);

      // Filter by domain if specified
      if (domainType) {
        weakConcepts = weakConcepts.filter(c => c.domain === domainType);
      }

      // Add remediation suggestions
      const withRemediation = weakConcepts.map(concept => ({
        ...concept,
        remediation: this.generateRemediationPlan(concept, domainType),
      }));

      return {
        success: true,
        weakConcepts: withRemediation,
        count: withRemediation.length,
        domainType,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update concept mastery based on learning performance
   */
  async updateMastery(params) {
    const { conceptId, mastery, masteryData = {} } = params;

    if (!conceptId) {
      return { success: false, error: 'conceptId is required' };
    }

    const graphInterface = this.getGraphInterface();
    if (!graphInterface?.adapter?.session) {
      return { success: false, error: 'Graph session not available' };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const session = graphInterface.adapter.session;

      // Calculate new mastery based on performance
      let newMastery;
      if (mastery !== undefined) {
        newMastery = Math.max(0, Math.min(100, mastery));
      } else if (masteryData.correct !== undefined) {
        // Calculate based on correct/incorrect response
        const adjustment = masteryData.correct ? 5 : -3;
        const timeBonus = masteryData.responseTime && masteryData.responseTime < 3000 ? 2 : 0;
        const confidenceBonus = masteryData.confidence > 80 ? 1 : 0;

        // Get current mastery first
        const currentResult = await session.run(
          `MATCH (c:Concept {id: $conceptId}) RETURN c.masteryLevel AS mastery`,
          { conceptId }
        );
        const currentMastery = currentResult.records[0]?.get('mastery') || 0;
        newMastery = Math.max(0, Math.min(100, currentMastery + adjustment + timeBonus + confidenceBonus));
      } else {
        return { success: false, error: 'Either mastery or masteryData.correct is required' };
      }

      // Update mastery in graph
      const result = await session.run(
        `
        MATCH (c:Concept {id: $conceptId})
        SET c.masteryLevel = $mastery,
            c.reviewCount = COALESCE(c.reviewCount, 0) + 1,
            c.lastReviewedAt = datetime()
        RETURN c.masteryLevel AS mastery, c.reviewCount AS reviewCount
        `,
        { conceptId, mastery: newMastery }
      );

      if (result.records.length === 0) {
        return { success: false, error: 'Concept not found' };
      }

      const masteryLevel = this.getMasteryLevel(newMastery);

      return {
        success: true,
        conceptId,
        mastery: newMastery,
        masteryLevel,
        reviewCount: result.records[0].get('reviewCount'),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the concept network around a specific concept
   */
  async getConceptNetwork(params) {
    const { conceptId, depth = 2, domainType } = params;

    if (!conceptId) {
      return { success: false, error: 'conceptId is required' };
    }

    const graphInterface = this.getGraphInterface();
    if (!graphInterface?.adapter?.session) {
      return { success: false, error: 'Graph session not available' };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const session = graphInterface.adapter.session;

      const result = await session.run(
        `
        MATCH (center:Concept {id: $conceptId})
        OPTIONAL MATCH path = (center)-[*1..${Math.min(depth, 5)}]-(related:Concept)
        WITH center, related, relationships(path) AS rels
        UNWIND COALESCE(rels, []) AS r
        WITH center, related,
             COLLECT(DISTINCT {
               type: type(r),
               startNode: startNode(r).id,
               endNode: endNode(r).id
             }) AS relationships
        RETURN
          center,
          COLLECT(DISTINCT related) AS relatedConcepts,
          relationships
        `,
        { conceptId }
      );

      if (result.records.length === 0) {
        return { success: false, error: 'Concept not found' };
      }

      const record = result.records[0];
      const centerNode = record.get('center').properties;
      const relatedConcepts = record.get('relatedConcepts')
        .filter(n => n)
        .map(n => n.properties);

      return {
        success: true,
        network: {
          center: centerNode,
          related: relatedConcepts,
          relationships: record.get('relationships') || [],
          conceptCount: relatedConcepts.length + 1,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the schema for a specific domain
   */
  getDomainSchema(params) {
    const { domainType = 'knowledge' } = params;

    const schema = DOMAIN_RELATIONSHIPS[domainType];
    if (!schema) {
      return {
        success: false,
        error: `Unknown domain: ${domainType}`,
        availableDomains: Object.keys(DOMAIN_RELATIONSHIPS),
      };
    }

    return {
      success: true,
      domainType,
      schema: {
        nodeTypes: schema.nodeTypes,
        relationships: schema.relationships,
        description: this.getDomainDescription(domainType),
        masteryThresholds: MASTERY_THRESHOLDS,
      },
    };
  }

  /**
   * Suggest next concepts to learn based on current mastery
   */
  async suggestNextConcepts(params) {
    const { domainType, limit = 5, topicId } = params;

    const graphFeatures = this.getGraphFeatures();
    if (!graphFeatures) {
      return { success: false, error: 'Graph features not available' };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const graphInterface = this.getGraphInterface();
      if (!graphInterface?.adapter?.session) {
        return { success: false, error: 'Graph session not available' };
      }

      const session = graphInterface.adapter.session;

      // Find concepts where:
      // 1. All prerequisites are mastered (>= 60%)
      // 2. The concept itself is not yet mastered (< 60%)
      // 3. Optionally filtered by domain
      const domainFilter = domainType ? `AND c.domain = $domain` : '';

      const result = await session.run(
        `
        MATCH (c:Concept {userId: $userId})
        WHERE c.masteryLevel < 60 ${domainFilter}

        // Check prerequisites are mastered
        OPTIONAL MATCH (c)-[:REQUIRES]->(prereq:Concept)
        WITH c, COLLECT(prereq) AS prereqs

        // All prereqs mastered or no prereqs
        WHERE ALL(p IN prereqs WHERE p.masteryLevel >= 60) OR SIZE(prereqs) = 0

        // Order by difficulty and how close to mastery
        ORDER BY
          CASE c.difficulty
            WHEN 'beginner' THEN 1
            WHEN 'elementary' THEN 2
            WHEN 'intermediate' THEN 3
            WHEN 'advanced' THEN 4
            WHEN 'expert' THEN 5
            ELSE 3
          END,
          c.masteryLevel DESC

        LIMIT $limit

        RETURN
          c.id AS id,
          c.name AS name,
          c.description AS description,
          c.difficulty AS difficulty,
          c.masteryLevel AS mastery,
          c.domain AS domain,
          SIZE(prereqs) AS prereqCount
        `,
        {
          userId: String(this.getUserId()),
          domain: domainType || '',
          limit: parseInt(limit, 10),
        }
      );

      const suggestions = result.records.map(record => ({
        id: record.get('id'),
        name: record.get('name'),
        description: record.get('description'),
        difficulty: record.get('difficulty'),
        mastery: record.get('mastery'),
        domain: record.get('domain'),
        prereqCount: record.get('prereqCount'),
        readyToLearn: true,
      }));

      return {
        success: true,
        suggestions,
        count: suggestions.length,
        domainType,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get prerequisites for a concept
   */
  async getPrerequisites(params) {
    const { conceptId, depth = 3 } = params;

    if (!conceptId) {
      return { success: false, error: 'conceptId is required' };
    }

    const graphInterface = this.getGraphInterface();
    if (!graphInterface?.adapter?.session) {
      return { success: false, error: 'Graph session not available' };
    }

    try {
      const session = graphInterface.adapter.session;

      const result = await session.run(
        `
        MATCH (c:Concept {id: $conceptId})
        OPTIONAL MATCH path = (c)-[:REQUIRES*1..${Math.min(depth, 5)}]->(prereq:Concept)
        WITH prereq, length(path) AS level
        WHERE prereq IS NOT NULL
        RETURN
          prereq.id AS id,
          prereq.name AS name,
          prereq.masteryLevel AS mastery,
          prereq.difficulty AS difficulty,
          level
        ORDER BY level, prereq.difficulty
        `,
        { conceptId }
      );

      const prerequisites = result.records.map(record => ({
        id: record.get('id'),
        name: record.get('name'),
        mastery: record.get('mastery'),
        difficulty: record.get('difficulty'),
        level: record.get('level'),
        mastered: (record.get('mastery') || 0) >= 60,
      }));

      const allMastered = prerequisites.every(p => p.mastered);

      return {
        success: true,
        conceptId,
        prerequisites,
        count: prerequisites.length,
        allMastered,
        readyToLearn: allMastered || prerequisites.length === 0,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get concepts that depend on this concept
   */
  async getDependents(params) {
    const { conceptId, depth = 2 } = params;

    if (!conceptId) {
      return { success: false, error: 'conceptId is required' };
    }

    const graphFeatures = this.getGraphFeatures();
    if (!graphFeatures) {
      return { success: false, error: 'Graph features not available' };
    }

    const token = this.context?.token;

    try {
      const dependents = await graphFeatures.getDependentConcepts(conceptId, token);

      return {
        success: true,
        conceptId,
        dependents,
        count: dependents.length,
        impact: dependents.length > 5 ? 'high' : dependents.length > 2 ? 'medium' : 'low',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Find concepts related to a given concept
   */
  async findRelatedConcepts(params) {
    const { conceptId, domainType, limit = 10 } = params;

    if (!conceptId) {
      return { success: false, error: 'conceptId is required' };
    }

    const graphInterface = this.getGraphInterface();
    if (!graphInterface?.adapter?.session) {
      return { success: false, error: 'Graph session not available' };
    }

    try {
      const session = graphInterface.adapter.session;

      const domainFilter = domainType ? `AND related.domain = $domain` : '';

      const result = await session.run(
        `
        MATCH (c:Concept {id: $conceptId})
        MATCH (c)-[r]-(related:Concept)
        WHERE related.id <> c.id ${domainFilter}
        RETURN DISTINCT
          related.id AS id,
          related.name AS name,
          related.domain AS domain,
          related.masteryLevel AS mastery,
          type(r) AS relationship,
          related.difficulty AS difficulty
        LIMIT $limit
        `,
        {
          conceptId,
          domain: domainType || '',
          limit: parseInt(limit, 10),
        }
      );

      const related = result.records.map(record => ({
        id: record.get('id'),
        name: record.get('name'),
        domain: record.get('domain'),
        mastery: record.get('mastery'),
        relationship: record.get('relationship'),
        difficulty: record.get('difficulty'),
      }));

      return {
        success: true,
        conceptId,
        related,
        count: related.length,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get mastery overview for a domain or all domains
   */
  async getMasteryOverview(params) {
    const { domainType, topicId } = params;

    const graphInterface = this.getGraphInterface();
    if (!graphInterface?.adapter?.session) {
      return { success: false, error: 'Graph session not available' };
    }

    try {
      const session = graphInterface.adapter.session;
      const userId = this.getUserId();

      const domainFilter = domainType ? `AND c.domain = $domain` : '';

      const result = await session.run(
        `
        MATCH (c:Concept {userId: $userId})
        WHERE c.masteryLevel IS NOT NULL ${domainFilter}
        WITH c.domain AS domain,
             COUNT(c) AS totalConcepts,
             AVG(c.masteryLevel) AS avgMastery,
             SUM(CASE WHEN c.masteryLevel >= 80 THEN 1 ELSE 0 END) AS mastered,
             SUM(CASE WHEN c.masteryLevel >= 40 AND c.masteryLevel < 80 THEN 1 ELSE 0 END) AS learning,
             SUM(CASE WHEN c.masteryLevel < 40 THEN 1 ELSE 0 END) AS needsWork
        RETURN domain, totalConcepts, avgMastery, mastered, learning, needsWork
        ORDER BY domain
        `,
        {
          userId: String(userId),
          domain: domainType || '',
        }
      );

      const overview = result.records.map(record => ({
        domain: record.get('domain'),
        totalConcepts: record.get('totalConcepts').toNumber(),
        averageMastery: Math.round(record.get('avgMastery') || 0),
        masteredCount: record.get('mastered').toNumber(),
        learningCount: record.get('learning').toNumber(),
        needsWorkCount: record.get('needsWork').toNumber(),
        masteryLevel: this.getMasteryLevel(record.get('avgMastery') || 0),
      }));

      // Calculate totals
      const totals = {
        totalConcepts: overview.reduce((sum, d) => sum + d.totalConcepts, 0),
        averageMastery: overview.length > 0
          ? Math.round(overview.reduce((sum, d) => sum + d.averageMastery, 0) / overview.length)
          : 0,
        masteredCount: overview.reduce((sum, d) => sum + d.masteredCount, 0),
        learningCount: overview.reduce((sum, d) => sum + d.learningCount, 0),
        needsWorkCount: overview.reduce((sum, d) => sum + d.needsWorkCount, 0),
      };

      return {
        success: true,
        overview,
        totals,
        domainFilter: domainType || 'all',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // =============================================================================
  // Helper methods
  // =============================================================================

  getGraphFeatures() {
    if (this.context?.services?.graphLearningFeatures) {
      return this.context.services.graphLearningFeatures;
    }

    try {
      const GraphLearningFeatures = require('../../utils/GraphLearningFeatures').default;
      return new GraphLearningFeatures();
    } catch (e) {
      return null;
    }
  }

  getGraphInterface() {
    if (this.context?.services?.graphInterface) {
      return this.context.services.graphInterface;
    }

    try {
      return require('../../utils/GraphInterface').default;
    } catch (e) {
      return null;
    }
  }

  getUserId() {
    const token = this.context?.token;
    if (!token) return null;

    try {
      const { getUserIdFromToken } = require('../../db/dbManager');
      return getUserIdFromToken(token);
    } catch (e) {
      return null;
    }
  }

  getMasteryLevel(mastery) {
    if (mastery >= MASTERY_THRESHOLDS.expert) return 'expert';
    if (mastery >= MASTERY_THRESHOLDS.advanced) return 'advanced';
    if (mastery >= MASTERY_THRESHOLDS.proficient) return 'proficient';
    if (mastery >= MASTERY_THRESHOLDS.intermediate) return 'intermediate';
    if (mastery >= MASTERY_THRESHOLDS.beginner) return 'beginner';
    return 'novice';
  }

  getDomainDescription(domainType) {
    const descriptions = {
      vocabulary: 'Word relationships including roots, families, synonyms, and antonyms',
      math: 'Mathematical concept dependencies, formulas, theorems, and proofs',
      language: 'Grammar rules, patterns, usage examples, and exceptions',
      knowledge: 'General knowledge concepts, facts, topics, and relationships',
      skill: 'Technical skills, techniques, applications, and projects',
    };
    return descriptions[domainType] || 'Learning concepts and relationships';
  }

  generatePathRecommendations(learningPath, domainType) {
    const recommendations = [];

    if (learningPath.conceptCount > 5) {
      recommendations.push({
        type: 'pacing',
        message: 'This is a longer path. Consider breaking it into 2-3 concept sessions.',
      });
    }

    if (learningPath.estimatedMinutes > 60) {
      recommendations.push({
        type: 'time',
        message: `Estimated ${learningPath.estimatedMinutes} minutes. Plan multiple sessions.`,
      });
    }

    if (domainType === 'vocabulary') {
      recommendations.push({
        type: 'strategy',
        message: 'Focus on word roots and families to accelerate vocabulary building.',
      });
    } else if (domainType === 'math') {
      recommendations.push({
        type: 'strategy',
        message: 'Master each formula before moving to concepts that use it.',
      });
    }

    return recommendations;
  }

  generateRemediationPlan(concept, domainType) {
    const plan = {
      priority: concept.weaknessScore > 100 ? 'high' : concept.weaknessScore > 50 ? 'medium' : 'low',
      suggestedActions: [],
      estimatedSessions: Math.ceil((60 - (concept.mastery || 0)) / 15),
    };

    if (!concept.lastReviewed) {
      plan.suggestedActions.push('Start with a comprehensive review');
    }

    if (concept.mastery < 30) {
      plan.suggestedActions.push('Focus on foundational understanding');
      plan.suggestedActions.push('Use multiple learning modalities');
    }

    if (concept.dependentCount > 3) {
      plan.suggestedActions.push('Prioritize this concept - it blocks other learning');
    }

    if (domainType === 'vocabulary') {
      plan.suggestedActions.push('Practice in context sentences');
    } else if (domainType === 'math') {
      plan.suggestedActions.push('Work through step-by-step examples');
    }

    return plan;
  }
}

module.exports = LearningGraphSkill;
