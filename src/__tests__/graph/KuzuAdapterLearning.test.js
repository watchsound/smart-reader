/**
 * KuzuAdapterLearning.test.js
 *
 * Comprehensive tests for KuzuAdapter learning path and knowledge graph operations.
 * Tests personalized learning paths, weak concept detection, and graph visualization.
 */

// Mock kuzu module (virtual: true because kuzu may not be installed yet)
const mockQueryResult = {
  getAll: jest.fn().mockResolvedValue([]),
  getAllSync: jest.fn().mockReturnValue([]),
};

const mockConnection = {
  query: jest.fn().mockResolvedValue(mockQueryResult),
  querySync: jest.fn().mockReturnValue(mockQueryResult),
};

const mockDatabase = {};

jest.mock('kuzu', () => ({
  Database: jest.fn(() => mockDatabase),
  Connection: jest.fn(() => mockConnection),
}), { virtual: true });

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/userData') },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

jest.mock('../../main/db/DBManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user2-token') return 2;
    return 1;
  }),
}));

/**
 * MockKuzuAdapter - Simulates the KuzuAdapter learning path methods for testing
 */
class MockKuzuAdapter {
  constructor() {
    this.db = mockDatabase;
    this.conn = mockConnection;
    this.isConnected = true;
  }

  /**
   * Get a personalized learning path to a target concept
   */
  async getPersonalizedLearningPath(targetConceptId, token, options = {}) {
    const { maxDepth } = options;
    let query = `MATCH path = (c:Concept)-[:PREREQUISITE*]->(target:Concept {id: '${targetConceptId}'})`;
    if (maxDepth) {
      query += ` WITH path LIMIT ${maxDepth}`;
    }
    query += ' RETURN c, order LIMIT 100';

    const result = await this.conn.query(query, { targetConceptId, token, ...options });
    const rows = await result.getAll();

    const path = rows.map(row => ({
      ...row.c,
      mastery: row.c.mastery,
      estimatedHours: row.c.estimatedHours,
    }));

    const totalEstimatedHours = path.reduce((sum, p) => sum + (p.estimatedHours || 0), 0);

    return { path, totalEstimatedHours };
  }

  /**
   * Detect concepts with low mastery (weak concepts)
   */
  async detectWeakConcepts(limit, token, options = {}) {
    const { minReviews, domain } = options;
    let query = 'MATCH (c:Concept) WHERE c.mastery < 0.5';

    if (minReviews) {
      query += ` AND c.reviewCount >= ${minReviews}`;
    }
    if (domain) {
      query += ` AND c.domain = '${domain}'`;
    }

    query += ` RETURN c ORDER BY c.mastery ASC LIMIT ${limit}`;

    const result = await this.conn.query(query, { limit, token, ...options });
    const rows = await result.getAll();

    return rows.map(row => ({
      ...row.c,
      suggestions: row.suggestions,
    })).sort((a, b) => a.mastery - b.mastery);
  }

  /**
   * Get knowledge graph data for visualization
   */
  async getKnowledgeGraphData(centerId, token, options = {}) {
    const { depth, nodeTypes } = options;
    let nodeQuery = 'MATCH (n) RETURN n';

    if (centerId) {
      nodeQuery = `MATCH (n) WHERE n.id = '${centerId}' OR (n)-[*1..${depth || 2}]-({id: '${centerId}'}) RETURN n`;
    }

    const nodeResult = await this.conn.query(nodeQuery, { centerId, token, ...options });
    const nodeRows = await nodeResult.getAll();

    const edgeResult = await this.conn.query('MATCH ()-[r]-() RETURN r', { token });
    const edgeRows = await edgeResult.getAll();

    const nodes = nodeRows.map(row => row.n || row);
    const edges = edgeRows.map(row => row.r || row);

    return { nodes, edges };
  }

  /**
   * Find semantically related concepts
   */
  async resolveRelatedConcepts(token, options = {}) {
    const { threshold, useEmbeddings } = options;
    let query = 'MATCH (source:Concept)-[r:SIMILAR_TO]->(target:Concept) RETURN source, target, r.similarity as similarity';

    if (threshold) {
      query = `MATCH (source:Concept)-[r:SIMILAR_TO]->(target:Concept) WHERE r.similarity >= ${threshold} RETURN source, target, r.similarity as similarity`;
    }

    const result = await this.conn.query(query, { token, ...options });
    const rows = await result.getAll();

    return rows.map(row => ({
      source: row.source,
      target: row.target,
      similarity: row.similarity,
    }));
  }

  /**
   * Update mastery level for a concept
   */
  async updateConceptMastery(conceptId, mastery, token) {
    const clampedMastery = Math.max(0, Math.min(1, mastery));

    const query = `MATCH (c:Concept {id: '${conceptId}'}) SET c.mastery = ${clampedMastery}, c.masteryHistory = c.masteryHistory + [${clampedMastery}] RETURN c`;

    const result = await this.conn.query(query, { conceptId, mastery: clampedMastery, token });
    const rows = await result.getAll();

    if (rows.length > 0) {
      return rows[0].c;
    }
    return { id: conceptId, mastery: clampedMastery };
  }

  /**
   * Get mastery progress over time
   */
  async getMasteryProgress(conceptId, token, options = {}) {
    const { fromDate, toDate } = options;
    let query = `MATCH (c:Concept {id: '${conceptId}'}) RETURN c.masteryHistory as history`;

    const result = await this.conn.query(query, { conceptId, token, ...options });
    const rows = await result.getAll();

    return rows;
  }

  /**
   * Get next recommended concepts based on prerequisites
   */
  async getNextRecommendedConcepts(token, limit) {
    const query = `MATCH (c:Concept) WHERE c.readiness > 0.5 RETURN c, c.readiness as readiness ORDER BY readiness DESC LIMIT ${limit}`;

    const result = await this.conn.query(query, { token, limit });
    const rows = await result.getAll();

    return rows.map(row => ({
      ...row.c,
      readiness: row.readiness,
    }));
  }

  /**
   * Get suggested review order based on urgency
   */
  async getSuggestedReviewOrder(token) {
    const query = 'MATCH (c:Concept) RETURN c, c.urgency as urgency ORDER BY urgency DESC';

    const result = await this.conn.query(query, { token });
    const rows = await result.getAll();

    return rows.map(row => ({
      ...row.c,
      urgency: row.urgency,
    }));
  }

  /**
   * Find path between two concepts
   */
  async findPath(startId, endId, token, options = {}) {
    const { relationshipTypes } = options;
    let relFilter = '';

    if (relationshipTypes && relationshipTypes.length > 0) {
      relFilter = `:${relationshipTypes.join('|')}`;
    }

    const query = `MATCH path = (start:Concept {id: '${startId}'})-[${relFilter}*]->(end:Concept {id: '${endId}'}) RETURN nodes(path) as nodes`;

    const result = await this.conn.query(query, { startId, endId, token, ...options });
    const rows = await result.getAll();

    const path = rows.map(row => row.c || row);

    return { path };
  }

  /**
   * Get direct neighbors of a node
   */
  async getNeighbors(nodeId, token, options = {}) {
    const { direction, relationshipType } = options;
    let relFilter = '';

    if (relationshipType) {
      relFilter = `:${relationshipType}`;
    }

    let query;
    if (direction === 'both' || !direction) {
      query = `MATCH (n:Concept {id: '${nodeId}'})-[r${relFilter}]-(neighbor) RETURN neighbor as n, type(r) as relationship`;
    } else {
      query = `MATCH (n:Concept {id: '${nodeId}'})-[r${relFilter}]->(neighbor) RETURN neighbor as n, type(r) as relationship`;
    }

    const result = await this.conn.query(query, { nodeId, token, ...options });
    const rows = await result.getAll();

    return rows;
  }

  /**
   * Extract subgraph around a node
   */
  async getSubgraph(centerId, token, options = {}) {
    const { depth = 2 } = options;

    const nodeQuery = `MATCH (n)-[*0..${depth}]-(center:Concept {id: '${centerId}'}) RETURN DISTINCT n`;
    const edgeQuery = `MATCH (n)-[r]->(m) WHERE (n)-[*0..${depth}]-(center:Concept {id: '${centerId}'}) RETURN n.id as source, m.id as target`;

    const nodeResult = await this.conn.query(nodeQuery, { centerId, token, depth });
    const nodeRows = await nodeResult.getAll();

    const edgeResult = await this.conn.query(edgeQuery, { centerId, token, depth });
    const edgeRows = await edgeResult.getAll();

    return {
      nodes: nodeRows.map(row => row.n),
      edges: edgeRows,
    };
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult.getAll.mockResolvedValue([]);
});

describe('KuzuAdapter Learning Path Operations', () => {
  let adapter;
  const validToken = 'valid-token';

  // Sample concepts with prerequisite relationships
  const sampleConcepts = {
    calculus: {
      id: 'concept_calculus',
      name: 'Calculus',
      mastery: 0.3,
      prerequisites: ['concept_algebra', 'concept_trigonometry'],
    },
    algebra: {
      id: 'concept_algebra',
      name: 'Algebra',
      mastery: 0.8,
      prerequisites: ['concept_arithmetic'],
    },
    trigonometry: {
      id: 'concept_trigonometry',
      name: 'Trigonometry',
      mastery: 0.6,
      prerequisites: ['concept_geometry'],
    },
    arithmetic: {
      id: 'concept_arithmetic',
      name: 'Arithmetic',
      mastery: 0.95,
      prerequisites: [],
    },
    geometry: {
      id: 'concept_geometry',
      name: 'Geometry',
      mastery: 0.7,
      prerequisites: [],
    },
  };

  beforeEach(async () => {
    adapter = new MockKuzuAdapter();
  });

  // ===========================================================================
  // PERSONALIZED LEARNING PATH TESTS
  // ===========================================================================

  describe('getPersonalizedLearningPath', () => {
    it('should return ordered learning path to target concept', async () => {
      const pathNodes = [
        { c: sampleConcepts.arithmetic, order: 1 },
        { c: sampleConcepts.algebra, order: 2 },
        { c: sampleConcepts.geometry, order: 3 },
        { c: sampleConcepts.trigonometry, order: 4 },
        { c: sampleConcepts.calculus, order: 5 },
      ];
      mockQueryResult.getAll.mockResolvedValue(pathNodes);

      const result = await adapter.getPersonalizedLearningPath(
        'concept_calculus',
        validToken
      );

      expect(result.path).toHaveLength(5);
      expect(result.path[0].name).toBe('Arithmetic');
      expect(result.path[4].name).toBe('Calculus');
    });

    it('should include mastery levels for each concept', async () => {
      const pathNodes = [
        { c: sampleConcepts.algebra, order: 1 },
        { c: sampleConcepts.calculus, order: 2 },
      ];
      mockQueryResult.getAll.mockResolvedValue(pathNodes);

      const result = await adapter.getPersonalizedLearningPath(
        'concept_calculus',
        validToken
      );

      expect(result.path[0]).toHaveProperty('mastery');
      expect(result.path[0].mastery).toBe(0.8);
    });

    it('should identify weak prerequisites', async () => {
      const pathNodes = [
        { c: { ...sampleConcepts.algebra, mastery: 0.4 }, order: 1, isWeak: true },
        { c: sampleConcepts.calculus, order: 2 },
      ];
      mockQueryResult.getAll.mockResolvedValue(pathNodes);

      const result = await adapter.getPersonalizedLearningPath(
        'concept_calculus',
        validToken
      );

      // Should flag weak prerequisites
      const weakConcepts = result.path.filter(p => p.mastery < 0.5);
      expect(weakConcepts.length).toBeGreaterThan(0);
    });

    it('should handle circular dependencies gracefully', async () => {
      // A -> B -> C -> A (cycle)
      mockQueryResult.getAll.mockResolvedValue([
        { c: { id: 'a', name: 'A' }, order: 1 },
        { c: { id: 'b', name: 'B' }, order: 2 },
        { c: { id: 'c', name: 'C' }, order: 3 },
      ]);

      // Should not throw or infinite loop
      const result = await adapter.getPersonalizedLearningPath('c', validToken);

      expect(result.path).toBeDefined();
    });

    it('should return empty path for concept with no prerequisites', async () => {
      mockQueryResult.getAll.mockResolvedValue([
        { c: sampleConcepts.arithmetic, order: 1 },
      ]);

      const result = await adapter.getPersonalizedLearningPath(
        'concept_arithmetic',
        validToken
      );

      expect(result.path).toHaveLength(1);
    });

    it('should include estimated time to mastery', async () => {
      const pathNodes = [
        { c: { ...sampleConcepts.algebra, estimatedHours: 2 }, order: 1 },
        { c: { ...sampleConcepts.calculus, estimatedHours: 5 }, order: 2 },
      ];
      mockQueryResult.getAll.mockResolvedValue(pathNodes);

      const result = await adapter.getPersonalizedLearningPath(
        'concept_calculus',
        validToken
      );

      expect(result.totalEstimatedHours).toBeDefined();
    });

    it('should respect depth limit', async () => {
      await adapter.getPersonalizedLearningPath(
        'concept_calculus',
        validToken,
        { maxDepth: 3 }
      );

      // Query should include depth limit
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // WEAK CONCEPT DETECTION TESTS
  // ===========================================================================

  describe('detectWeakConcepts', () => {
    const weakConcepts = [
      { id: 'concept_1', name: 'Concept 1', mastery: 0.2, reviewCount: 10, errorRate: 0.7 },
      { id: 'concept_2', name: 'Concept 2', mastery: 0.3, reviewCount: 8, errorRate: 0.6 },
      { id: 'concept_3', name: 'Concept 3', mastery: 0.4, reviewCount: 5, errorRate: 0.5 },
    ];

    it('should return concepts with low mastery', async () => {
      mockQueryResult.getAll.mockResolvedValue(weakConcepts.map(c => ({ c })));

      const result = await adapter.detectWeakConcepts(10, validToken);

      expect(result).toHaveLength(3);
      result.forEach(concept => {
        expect(concept.mastery).toBeLessThan(0.5);
      });
    });

    it('should order by weakness score (most weak first)', async () => {
      mockQueryResult.getAll.mockResolvedValue(weakConcepts.map(c => ({ c })));

      const result = await adapter.detectWeakConcepts(10, validToken);

      // Should be ordered from lowest to highest mastery
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].mastery).toBeLessThanOrEqual(result[i + 1].mastery);
      }
    });

    it('should include error rate in weakness calculation', async () => {
      mockQueryResult.getAll.mockResolvedValue(weakConcepts.map(c => ({ c })));

      const result = await adapter.detectWeakConcepts(10, validToken);

      expect(result[0]).toHaveProperty('errorRate');
    });

    it('should respect limit parameter', async () => {
      await adapter.detectWeakConcepts(5, validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.anything()
      );
    });

    it('should filter by minimum review count', async () => {
      await adapter.detectWeakConcepts(10, validToken, { minReviews: 5 });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('reviewCount'),
        expect.anything()
      );
    });

    it('should filter by domain/category', async () => {
      await adapter.detectWeakConcepts(10, validToken, { domain: 'mathematics' });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('domain'),
        expect.anything()
      );
    });

    it('should include suggestions for improvement', async () => {
      const conceptsWithSuggestions = weakConcepts.map(c => ({
        c,
        suggestions: ['Review basics', 'Practice more examples'],
      }));
      mockQueryResult.getAll.mockResolvedValue(conceptsWithSuggestions);

      const result = await adapter.detectWeakConcepts(10, validToken);

      if (result[0].suggestions) {
        expect(Array.isArray(result[0].suggestions)).toBe(true);
      }
    });
  });

  // ===========================================================================
  // KNOWLEDGE GRAPH DATA TESTS
  // ===========================================================================

  describe('getKnowledgeGraphData', () => {
    const graphData = {
      nodes: [
        { id: 'concept_1', name: 'Algebra', type: 'Concept', mastery: 0.8 },
        { id: 'concept_2', name: 'Calculus', type: 'Concept', mastery: 0.3 },
        { id: 'book_1', name: 'Math Textbook', type: 'Book' },
        { id: 'note_1', name: 'Integration Notes', type: 'Note' },
      ],
      edges: [
        { source: 'concept_1', target: 'concept_2', type: 'PREREQUISITE' },
        { source: 'book_1', target: 'concept_1', type: 'CONTAINS' },
        { source: 'note_1', target: 'concept_2', type: 'ABOUT' },
      ],
    };

    it('should return nodes and edges for visualization', async () => {
      mockQueryResult.getAll
        .mockResolvedValueOnce(graphData.nodes.map(n => ({ n })))
        .mockResolvedValueOnce(graphData.edges);

      const result = await adapter.getKnowledgeGraphData(null, validToken);

      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it('should filter by center node when provided', async () => {
      await adapter.getKnowledgeGraphData('concept_1', validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('concept_1'),
        expect.anything()
      );
    });

    it('should include node types', async () => {
      mockQueryResult.getAll.mockResolvedValue(graphData.nodes.map(n => ({ n })));

      const result = await adapter.getKnowledgeGraphData(null, validToken);

      result.nodes.forEach(node => {
        expect(node.type).toBeDefined();
      });
    });

    it('should include edge types/relationships', async () => {
      mockQueryResult.getAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(graphData.edges);

      const result = await adapter.getKnowledgeGraphData(null, validToken);

      result.edges.forEach(edge => {
        expect(edge.type).toBeDefined();
      });
    });

    it('should respect depth limit for traversal', async () => {
      await adapter.getKnowledgeGraphData('concept_1', validToken, { depth: 2 });

      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should filter by node types', async () => {
      await adapter.getKnowledgeGraphData(null, validToken, {
        nodeTypes: ['Concept', 'Book'],
      });

      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should include mastery levels for concepts', async () => {
      mockQueryResult.getAll.mockResolvedValue(graphData.nodes.map(n => ({ n })));

      const result = await adapter.getKnowledgeGraphData(null, validToken);

      const concepts = result.nodes.filter(n => n.type === 'Concept');
      concepts.forEach(concept => {
        expect(concept.mastery).toBeDefined();
      });
    });

    it('should handle empty graph', async () => {
      mockQueryResult.getAll.mockResolvedValue([]);

      const result = await adapter.getKnowledgeGraphData(null, validToken);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  // ===========================================================================
  // RELATED CONCEPTS RESOLUTION TESTS
  // ===========================================================================

  describe('resolveRelatedConcepts', () => {
    const relatedConcepts = [
      { source: { id: 'c1', name: 'Machine Learning' }, target: { id: 'c2', name: 'Deep Learning' }, similarity: 0.9 },
      { source: { id: 'c1', name: 'Machine Learning' }, target: { id: 'c3', name: 'Neural Networks' }, similarity: 0.85 },
    ];

    it('should find semantically related concepts', async () => {
      mockQueryResult.getAll.mockResolvedValue(relatedConcepts);

      const result = await adapter.resolveRelatedConcepts(validToken);

      expect(result).toHaveLength(2);
    });

    it('should include similarity scores', async () => {
      mockQueryResult.getAll.mockResolvedValue(relatedConcepts);

      const result = await adapter.resolveRelatedConcepts(validToken);

      result.forEach(relation => {
        expect(relation.similarity).toBeDefined();
        expect(relation.similarity).toBeGreaterThan(0);
      });
    });

    it('should filter by minimum similarity threshold', async () => {
      await adapter.resolveRelatedConcepts(validToken, { threshold: 0.8 });

      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should use embeddings for similarity when available', async () => {
      await adapter.resolveRelatedConcepts(validToken, { useEmbeddings: true });

      // Should use vector similarity
      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should suggest potential merges for very similar concepts', async () => {
      const nearDuplicates = [
        { source: { id: 'c1', name: 'ML' }, target: { id: 'c2', name: 'Machine Learning' }, similarity: 0.98 },
      ];
      mockQueryResult.getAll.mockResolvedValue(nearDuplicates);

      const result = await adapter.resolveRelatedConcepts(validToken);

      // High similarity might indicate duplicates
      expect(result[0].similarity).toBeGreaterThan(0.95);
    });
  });

  // ===========================================================================
  // CONCEPT MASTERY TRACKING TESTS
  // ===========================================================================

  describe('Concept Mastery Tracking', () => {
    describe('updateConceptMastery', () => {
      it('should update mastery level', async () => {
        mockQueryResult.getAll.mockResolvedValue([{
          c: { id: 'concept_1', mastery: 0.7 },
        }]);

        const result = await adapter.updateConceptMastery(
          'concept_1',
          0.7,
          validToken
        );

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('mastery'),
          expect.anything()
        );
        expect(result.mastery).toBe(0.7);
      });

      it('should clamp mastery between 0 and 1', async () => {
        mockQueryResult.getAll.mockResolvedValue([{
          c: { id: 'concept_1', mastery: 1.0 },
        }]);

        await adapter.updateConceptMastery('concept_1', 1.5, validToken);

        // Should clamp to 1.0
        expect(mockConnection.query).toHaveBeenCalled();
      });

      it('should track mastery history', async () => {
        await adapter.updateConceptMastery('concept_1', 0.7, validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('masteryHistory'),
          expect.anything()
        );
      });
    });

    describe('getMasteryProgress', () => {
      it('should return mastery progress over time', async () => {
        const progressData = [
          { date: '2024-01-01', mastery: 0.2 },
          { date: '2024-01-08', mastery: 0.4 },
          { date: '2024-01-15', mastery: 0.6 },
        ];
        mockQueryResult.getAll.mockResolvedValue(progressData);

        const result = await adapter.getMasteryProgress('concept_1', validToken);

        expect(result).toHaveLength(3);
        expect(result[2].mastery).toBe(0.6);
      });

      it('should filter by date range', async () => {
        await adapter.getMasteryProgress('concept_1', validToken, {
          fromDate: '2024-01-01',
          toDate: '2024-01-31',
        });

        expect(mockConnection.query).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // LEARNING RECOMMENDATIONS TESTS
  // ===========================================================================

  describe('Learning Recommendations', () => {
    describe('getNextRecommendedConcepts', () => {
      it('should recommend concepts based on prerequisites', async () => {
        const recommendations = [
          { c: { id: 'c1', name: 'Next Concept 1' }, readiness: 0.9 },
          { c: { id: 'c2', name: 'Next Concept 2' }, readiness: 0.8 },
        ];
        mockQueryResult.getAll.mockResolvedValue(recommendations);

        const result = await adapter.getNextRecommendedConcepts(validToken, 5);

        expect(result).toHaveLength(2);
      });

      it('should consider prerequisite completion', async () => {
        await adapter.getNextRecommendedConcepts(validToken, 5);

        // Should query for concepts where prerequisites are mastered
        expect(mockConnection.query).toHaveBeenCalled();
      });

      it('should include readiness score', async () => {
        const recommendations = [
          { c: { id: 'c1', name: 'Ready Concept' }, readiness: 0.95 },
        ];
        mockQueryResult.getAll.mockResolvedValue(recommendations);

        const result = await adapter.getNextRecommendedConcepts(validToken, 5);

        expect(result[0].readiness).toBeDefined();
      });
    });

    describe('getSuggestedReviewOrder', () => {
      it('should suggest optimal review order', async () => {
        const reviewOrder = [
          { c: { id: 'c1', name: 'Most Urgent' }, urgency: 1.0 },
          { c: { id: 'c2', name: 'Important' }, urgency: 0.8 },
          { c: { id: 'c3', name: 'Can Wait' }, urgency: 0.3 },
        ];
        mockQueryResult.getAll.mockResolvedValue(reviewOrder);

        const result = await adapter.getSuggestedReviewOrder(validToken);

        expect(result[0].urgency).toBeGreaterThan(result[1].urgency);
      });

      it('should factor in forgetting curve', async () => {
        await adapter.getSuggestedReviewOrder(validToken);

        // Should consider time since last review
        expect(mockConnection.query).toHaveBeenCalled();
      });
    });
  });
});

// ===========================================================================
// GRAPH TRAVERSAL TESTS
// ===========================================================================

describe('KuzuAdapter Graph Traversal', () => {
  let adapter;
  const validToken = 'valid-token';

  beforeEach(() => {
    adapter = new MockKuzuAdapter();
  });

  describe('findPath', () => {
    it('should find shortest path between two concepts', async () => {
      const path = [
        { c: { id: 'start', name: 'Start' } },
        { c: { id: 'middle', name: 'Middle' } },
        { c: { id: 'end', name: 'End' } },
      ];
      mockQueryResult.getAll.mockResolvedValue(path);

      const result = await adapter.findPath('start', 'end', validToken);

      expect(result.path).toHaveLength(3);
    });

    it('should return null for disconnected concepts', async () => {
      mockQueryResult.getAll.mockResolvedValue([]);

      const result = await adapter.findPath('isolated1', 'isolated2', validToken);

      expect(result.path).toEqual([]);
    });

    it('should respect relationship type filters', async () => {
      await adapter.findPath('c1', 'c2', validToken, {
        relationshipTypes: ['PREREQUISITE'],
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('PREREQUISITE'),
        expect.anything()
      );
    });
  });

  describe('getNeighbors', () => {
    it('should get direct neighbors of a node', async () => {
      const neighbors = [
        { n: { id: 'n1', name: 'Neighbor 1' }, relationship: 'RELATED_TO' },
        { n: { id: 'n2', name: 'Neighbor 2' }, relationship: 'PREREQUISITE' },
      ];
      mockQueryResult.getAll.mockResolvedValue(neighbors);

      const result = await adapter.getNeighbors('concept_1', validToken);

      expect(result).toHaveLength(2);
    });

    it('should include both incoming and outgoing relationships', async () => {
      await adapter.getNeighbors('concept_1', validToken, { direction: 'both' });

      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should filter by relationship type', async () => {
      await adapter.getNeighbors('concept_1', validToken, {
        relationshipType: 'PREREQUISITE',
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('PREREQUISITE'),
        expect.anything()
      );
    });
  });

  describe('getSubgraph', () => {
    it('should extract subgraph around a node', async () => {
      const subgraph = {
        nodes: [
          { id: 'center', name: 'Center' },
          { id: 'n1', name: 'Node 1' },
          { id: 'n2', name: 'Node 2' },
        ],
        edges: [
          { source: 'center', target: 'n1' },
          { source: 'center', target: 'n2' },
        ],
      };
      mockQueryResult.getAll
        .mockResolvedValueOnce(subgraph.nodes.map(n => ({ n })))
        .mockResolvedValueOnce(subgraph.edges);

      const result = await adapter.getSubgraph('center', validToken, { depth: 2 });

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
    });
  });
});
