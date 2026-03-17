/**
 * SummarizationGraphService.test.js
 *
 * Tests for the SummarizationGraphService which manages
 * :SUMMARIZES and :CONSOLIDATED_INTO relationships in Neo4j.
 */

const SummarizationGraphService = require('../../main/utils/SummarizationGraphService');
const {
  RELATIONSHIP_TYPES,
  CONTRIBUTION_TYPES,
  MEMORY_RELATION_TYPES,
  MASTERY_CONTRIBUTIONS,
} = require('../../main/utils/SummarizationGraphService');

// Mock Neo4j adapter
const createMockNeo4jAdapter = (queryResults = {}) => ({
  checkConnection: jest.fn(() => true),
  runQuery: jest.fn((query, params) => {
    // Return different results based on query content
    if (query.includes('ConsolidatedMemory') && query.includes('MERGE')) {
      return {
        records: [
          {
            get: () => ({
              properties: {
                id: params?.id || 'cm_123',
                userId: params?.userId || 1,
                memoryType: params?.memoryType || 'concept_session',
                summary: params?.summary || 'Test summary',
              },
            }),
          },
        ],
      };
    }
    if (query.includes('CONSOLIDATED_INTO')) {
      return { records: [{ get: () => queryResults.consolidatedCount || 5 }] };
    }
    if (query.includes('SUMMARIZES') && query.includes('MERGE')) {
      return {
        records: [
          {
            get: () => ({
              type: 'SUMMARIZES',
              properties: { weight: 1.0, confidence: 0.9 },
            }),
          },
        ],
      };
    }
    if (query.includes('Episode') && query.includes('CONSOLIDATED_INTO')) {
      return {
        records: [
          {
            get: (key) =>
              key === 'e'
                ? {
                    properties: {
                      id: 'ep_123',
                      eventType: 'REVIEW_COMPLETED',
                      timestamp: new Date().toISOString(),
                    },
                  }
                : {
                    type: 'CONSOLIDATED_INTO',
                    properties: { weight: 0.8, position: 1 },
                  },
          },
        ],
      };
    }
    return { records: queryResults.records || [] };
  }),
});

// Mock store
const createMockStore = () => ({
  get: jest.fn((key, defaultVal) => defaultVal),
  set: jest.fn(),
});

describe('SummarizationGraphService', () => {
  let service;
  let mockNeo4j;
  let mockStore;

  beforeEach(() => {
    mockNeo4j = createMockNeo4jAdapter();
    mockStore = createMockStore();
    service = new SummarizationGraphService({
      neo4jAdapter: mockNeo4j,
      store: mockStore,
    });
  });

  describe('isAvailable', () => {
    it('should return true when Neo4j is connected', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when Neo4j is not connected', () => {
      mockNeo4j.checkConnection.mockReturnValue(false);
      expect(service.isAvailable()).toBe(false);
    });

    it('should return false when Neo4j adapter is null', () => {
      service = new SummarizationGraphService({ neo4jAdapter: null });
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('Memory Node Operations', () => {
    describe('upsertConsolidatedMemory', () => {
      it('should create a ConsolidatedMemory node', async () => {
        const memory = {
          id: 'cm_test_123',
          conceptId: 'concept_123',
          conceptName: 'Test Concept',
          memoryType: 'concept_session',
          periodStart: '2024-01-01T00:00:00Z',
          periodEnd: '2024-01-02T00:00:00Z',
          episodeCount: 10,
          summary: 'Test summary',
          insights: ['insight1', 'insight2'],
          masteryAssessment: 'developing',
          learningStyle: 'steady',
          recommendations: ['recommendation1'],
          metrics: { accuracy: 85 },
        };

        const result = await service.upsertConsolidatedMemory(memory, 1);

        expect(mockNeo4j.runQuery).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result.id).toBe('cm_test_123');
      });

      it('should return null when Neo4j is not available', async () => {
        mockNeo4j.checkConnection.mockReturnValue(false);
        const result = await service.upsertConsolidatedMemory({}, 1);
        expect(result).toBeNull();
      });
    });

    describe('deleteConsolidatedMemory', () => {
      it('should delete memory and its relationships', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [{ get: () => 1 }],
        });

        const result = await service.deleteConsolidatedMemory('cm_123');

        expect(mockNeo4j.runQuery).toHaveBeenCalled();
        expect(result.deleted).toBe(1);
      });

      it('should return 0 when Neo4j is not available', async () => {
        mockNeo4j.checkConnection.mockReturnValue(false);
        const result = await service.deleteConsolidatedMemory('cm_123');
        expect(result.deleted).toBe(0);
      });
    });

    describe('getMemoryById', () => {
      it('should return memory when found', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: () => ({
                properties: {
                  id: 'cm_123',
                  summary: 'Test',
                  memoryType: 'concept_session',
                },
              }),
            },
          ],
        });

        const result = await service.getMemoryById('cm_123');

        expect(result).toBeDefined();
        expect(result.id).toBe('cm_123');
      });

      it('should return null when not found', async () => {
        mockNeo4j.runQuery.mockResolvedValue({ records: [] });
        const result = await service.getMemoryById('nonexistent');
        expect(result).toBeNull();
      });
    });
  });

  describe('Episode → Memory Relationships', () => {
    describe('linkEpisodesToMemory', () => {
      it('should create CONSOLIDATED_INTO relationships', async () => {
        const episodeIds = ['ep_1', 'ep_2', 'ep_3'];
        const result = await service.linkEpisodesToMemory(episodeIds, 'cm_123');

        expect(mockNeo4j.runQuery).toHaveBeenCalled();
        expect(result.created).toBeDefined();
      });

      it('should calculate weights when enabled', async () => {
        const episodeIds = ['ep_1', 'ep_2', 'ep_3'];
        await service.linkEpisodesToMemory(episodeIds, 'cm_123', {
          calculateWeights: true,
        });

        const call = mockNeo4j.runQuery.mock.calls[0];
        const params = call[1];
        expect(params.episodes).toHaveLength(3);
        // Later episodes should have higher weights
        expect(params.episodes[2].weight).toBeGreaterThan(params.episodes[0].weight);
      });

      it('should return 0 when no episodes provided', async () => {
        const result = await service.linkEpisodesToMemory([], 'cm_123');
        expect(result.created).toBe(0);
      });
    });

    describe('calculateEpisodeWeight', () => {
      it('should return 1.0 for single episode', () => {
        const weight = service.calculateEpisodeWeight(0, 1);
        expect(weight).toBe(1.0);
      });

      it('should give higher weight to later episodes', () => {
        const weight1 = service.calculateEpisodeWeight(0, 5);
        const weight5 = service.calculateEpisodeWeight(4, 5);
        expect(weight5).toBeGreaterThan(weight1);
      });

      it('should not exceed 1.0', () => {
        const weight = service.calculateEpisodeWeight(99, 100);
        expect(weight).toBeLessThanOrEqual(1.0);
      });
    });

    describe('determineContribution', () => {
      it('should return PRIMARY for first and last episodes', () => {
        expect(service.determineContribution(0, 10)).toBe(CONTRIBUTION_TYPES.PRIMARY);
        expect(service.determineContribution(9, 10)).toBe(CONTRIBUTION_TYPES.PRIMARY);
      });

      it('should return SUPPORTING for early episodes', () => {
        expect(service.determineContribution(2, 10)).toBe(CONTRIBUTION_TYPES.SUPPORTING);
      });

      it('should return CONTEXTUAL for middle episodes', () => {
        expect(service.determineContribution(5, 10)).toBe(CONTRIBUTION_TYPES.CONTEXTUAL);
      });

      it('should return PRIMARY for small sets', () => {
        expect(service.determineContribution(0, 2)).toBe(CONTRIBUTION_TYPES.PRIMARY);
        expect(service.determineContribution(1, 2)).toBe(CONTRIBUTION_TYPES.PRIMARY);
      });
    });

    describe('getSourceEpisodes', () => {
      it('should return episodes with relationship data', async () => {
        const result = await service.getSourceEpisodes('cm_123');

        expect(mockNeo4j.runQuery).toHaveBeenCalled();
        expect(Array.isArray(result)).toBe(true);
      });

      it('should return empty array when Neo4j is not available', async () => {
        mockNeo4j.checkConnection.mockReturnValue(false);
        const result = await service.getSourceEpisodes('cm_123');
        expect(result).toEqual([]);
      });
    });

    describe('getMemoryForEpisode', () => {
      it('should return memory with relationship data', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) =>
                key === 'm'
                  ? { properties: { id: 'cm_123', summary: 'Test' } }
                  : { type: 'CONSOLIDATED_INTO', properties: {} },
            },
          ],
        });

        const result = await service.getMemoryForEpisode('ep_123');

        expect(result).toBeDefined();
        expect(result.memory.id).toBe('cm_123');
      });

      it('should return null when episode has no memory', async () => {
        mockNeo4j.runQuery.mockResolvedValue({ records: [] });
        const result = await service.getMemoryForEpisode('ep_orphan');
        expect(result).toBeNull();
      });
    });
  });

  describe('Memory → Concept Relationships', () => {
    describe('createSummarizesRelationship', () => {
      it('should create SUMMARIZES relationship with properties', async () => {
        const result = await service.createSummarizesRelationship(
          'cm_123',
          'concept_456',
          {
            weight: 0.9,
            confidence: 0.85,
            isPrimary: true,
            aspectsCovered: ['definition', 'examples'],
            masteryContribution: 'positive',
          }
        );

        expect(mockNeo4j.runQuery).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should use default values when not provided', async () => {
        await service.createSummarizesRelationship('cm_123', 'concept_456');

        const call = mockNeo4j.runQuery.mock.calls[0];
        const params = call[1];
        expect(params.weight).toBe(1.0);
        expect(params.confidence).toBe(0.8);
        expect(params.isPrimary).toBe(false);
      });
    });

    describe('linkMemoryToConcepts', () => {
      it('should ensure concepts exist and create relationships', async () => {
        const concepts = [
          { id: 'c1', name: 'Concept 1', isPrimary: true, weight: 1.0 },
          { id: 'c2', name: 'Concept 2', weight: 0.5 },
        ];

        const result = await service.linkMemoryToConcepts('cm_123', concepts);

        // Should call runQuery twice: once for MERGE concepts, once for relationships
        expect(mockNeo4j.runQuery).toHaveBeenCalledTimes(2);
        expect(result.created).toBeDefined();
      });

      it('should return 0 when no concepts provided', async () => {
        const result = await service.linkMemoryToConcepts('cm_123', []);
        expect(result.created).toBe(0);
      });
    });

    describe('getConceptsForMemory', () => {
      it('should return concepts with relationship data', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) =>
                key === 'c'
                  ? { properties: { id: 'c1', name: 'Test' } }
                  : { type: 'SUMMARIZES', properties: { weight: 1.0 } },
            },
          ],
        });

        const result = await service.getConceptsForMemory('cm_123');

        expect(Array.isArray(result)).toBe(true);
        expect(result[0].concept.id).toBe('c1');
      });
    });

    describe('getMemoriesForConcept', () => {
      it('should return memories for a concept', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) =>
                key === 'm'
                  ? { properties: { id: 'cm_123' } }
                  : { type: 'SUMMARIZES', properties: {} },
            },
          ],
        });

        const result = await service.getMemoriesForConcept('concept_123');

        expect(Array.isArray(result)).toBe(true);
      });

      it('should filter by memoryType', async () => {
        await service.getMemoriesForConcept('concept_123', {
          memoryType: 'concept_session',
        });

        const call = mockNeo4j.runQuery.mock.calls[0];
        expect(call[0]).toContain('memoryType');
      });

      it('should filter by primaryOnly', async () => {
        await service.getMemoriesForConcept('concept_123', {
          primaryOnly: true,
        });

        const call = mockNeo4j.runQuery.mock.calls[0];
        expect(call[0]).toContain('isPrimary');
      });
    });

    describe('calculateConceptMasteryFromMemories', () => {
      it('should calculate weighted mastery', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) => {
                if (key === 'conceptId') return 'c1';
                if (key === 'conceptName') return 'Test';
                if (key === 'memoryCount') return 3;
                if (key === 'aggregatedMastery') return 0.75;
                if (key === 'memories') return [];
                return null;
              },
            },
          ],
        });

        const result = await service.calculateConceptMasteryFromMemories('c1');

        expect(result).toBeDefined();
        expect(result.aggregatedMastery).toBe(0.75);
        expect(result.masteryLevel).toBe('proficient');
      });

      it('should return null when no memories exist', async () => {
        mockNeo4j.runQuery.mockResolvedValue({ records: [] });
        const result = await service.calculateConceptMasteryFromMemories('c1');
        expect(result).toBeNull();
      });
    });
  });

  describe('Memory → Memory Relationships', () => {
    describe('linkRelatedMemories', () => {
      it('should create MEMORY_RELATES relationship', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: () => ({
                type: 'MEMORY_RELATES',
                properties: { relationType: 'prerequisite', strength: 0.8 },
              }),
            },
          ],
        });

        const result = await service.linkRelatedMemories(
          'cm_1',
          'cm_2',
          MEMORY_RELATION_TYPES.PREREQUISITE,
          0.8
        );

        expect(result).toBeDefined();
        expect(mockNeo4j.runQuery).toHaveBeenCalled();
      });
    });

    describe('getRelatedMemories', () => {
      it('should return related memories', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) => {
                if (key === 'm2') return { properties: { id: 'cm_2' } };
                if (key === 'r') return { type: 'MEMORY_RELATES', properties: {} };
                if (key === 'direction') return 'outgoing';
                return null;
              },
            },
          ],
        });

        const result = await service.getRelatedMemories('cm_1');

        expect(Array.isArray(result)).toBe(true);
        expect(result[0].direction).toBeDefined();
      });

      it('should filter by relationType', async () => {
        await service.getRelatedMemories('cm_1', MEMORY_RELATION_TYPES.PREREQUISITE);

        const call = mockNeo4j.runQuery.mock.calls[0];
        expect(call[0]).toContain('relationType');
      });
    });

    describe('getMemoryChain', () => {
      it('should return memory chain', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) => {
                if (key === 'n') return { properties: { id: 'cm_1' } };
                if (key === 'depth') return 0;
                return null;
              },
            },
            {
              get: (key) => {
                if (key === 'n') return { properties: { id: 'cm_2' } };
                if (key === 'depth') return 1;
                return null;
              },
            },
          ],
        });

        const result = await service.getMemoryChain('cm_start');

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
      });
    });
  });

  describe('Hierarchical Queries', () => {
    describe('getSummarizationHierarchy', () => {
      it('should return full hierarchy', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) => {
                if (key === 'c') return { properties: { id: 'c1', name: 'Test' } };
                if (key === 'hierarchy') {
                  return [
                    {
                      memory: { properties: { id: 'cm_1' } },
                      summarizes: { properties: { weight: 1.0 } },
                      episodes: [],
                    },
                  ];
                }
                return null;
              },
            },
          ],
        });

        const result = await service.getSummarizationHierarchy('c1');

        expect(result).toBeDefined();
        expect(result.concept).toBeDefined();
        expect(result.memories).toBeDefined();
      });
    });

    describe('getConceptLearningTimeline', () => {
      it('should return ordered timeline', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) =>
                key === 'm'
                  ? { properties: { id: 'cm_1', periodEnd: '2024-01-02' } }
                  : { properties: {} },
            },
            {
              get: (key) =>
                key === 'm'
                  ? { properties: { id: 'cm_2', periodEnd: '2024-01-01' } }
                  : { properties: {} },
            },
          ],
        });

        const result = await service.getConceptLearningTimeline('c1');

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
      });
    });

    describe('getCrossConceptClusters', () => {
      it('should return cross-concept memory clusters', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) => {
                if (key === 'm') return { properties: { id: 'cm_1', memoryType: 'cross_concept' } };
                if (key === 'concepts') {
                  return [
                    { concept: { properties: { id: 'c1' } }, relationship: {} },
                    { concept: { properties: { id: 'c2' } }, relationship: {} },
                  ];
                }
                return null;
              },
            },
          ],
        });

        const result = await service.getCrossConceptClusters(1);

        expect(Array.isArray(result)).toBe(true);
        expect(result[0].concepts.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Analytics', () => {
    describe('getSummarizationStats', () => {
      it('should return statistics', async () => {
        mockNeo4j.runQuery.mockResolvedValueOnce({
          records: [
            {
              get: (key) => {
                if (key === 'totalMemories') return 10;
                if (key === 'memoryTypes') return ['concept_session', 'cross_concept'];
                if (key === 'totalEpisodes') return 50;
                if (key === 'totalConcepts') return 15;
                if (key === 'avgEpisodesPerMemory') return 5.0;
                return null;
              },
            },
          ],
        });
        mockNeo4j.runQuery.mockResolvedValueOnce({
          records: [{ get: () => 3 }],
        });
        mockNeo4j.runQuery.mockResolvedValueOnce({
          records: [
            { get: (key) => (key === 'memoryType' ? 'concept_session' : 8) },
            { get: (key) => (key === 'memoryType' ? 'cross_concept' : 2) },
          ],
        });

        const result = await service.getSummarizationStats(1);

        expect(result.totalMemories).toBe(10);
        expect(result.byType).toBeDefined();
      });
    });

    describe('getMemoryCoverage', () => {
      it('should return coverage data', async () => {
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) => {
                if (key === 'conceptId') return 'c1';
                if (key === 'conceptName') return 'Concept 1';
                if (key === 'memoryCount') return 5;
                if (key === 'lastMemory') return '2024-01-15';
                return null;
              },
            },
          ],
        });

        const result = await service.getMemoryCoverage(1);

        expect(Array.isArray(result)).toBe(true);
        expect(result[0].conceptId).toBe('c1');
        expect(result[0].memoryCount).toBe(5);
      });
    });

    describe('findMemoryGaps', () => {
      it('should find concepts without recent memories', async () => {
        const mockDate = new Date('2024-01-01');
        mockNeo4j.runQuery.mockResolvedValue({
          records: [
            {
              get: (key) => {
                if (key === 'conceptId') return 'c1';
                if (key === 'conceptName') return 'Neglected Concept';
                if (key === 'lastMemory') return mockDate.toISOString();
                if (key === 'totalMemories') return 2;
                return null;
              },
            },
          ],
        });

        const result = await service.findMemoryGaps(1, 30);

        expect(Array.isArray(result)).toBe(true);
        expect(result[0].conceptId).toBe('c1');
        expect(result[0].daysSinceLastMemory).toBeDefined();
      });
    });
  });

  describe('Helper Methods', () => {
    describe('masteryScoreToLevel', () => {
      it('should convert scores to levels correctly', () => {
        expect(service.masteryScoreToLevel(0.95)).toBe('mastered');
        expect(service.masteryScoreToLevel(0.8)).toBe('proficient');
        expect(service.masteryScoreToLevel(0.5)).toBe('developing');
        expect(service.masteryScoreToLevel(0.2)).toBe('beginner');
        expect(service.masteryScoreToLevel(null)).toBe('unknown');
      });
    });

    describe('parseMemoryNode', () => {
      it('should parse memory node correctly', () => {
        const node = {
          properties: {
            id: 'cm_123',
            userId: 1,
            summary: 'Test',
            insights: '["insight1"]',
            metrics: '{"accuracy": 85}',
          },
        };

        const result = service.parseMemoryNode(node);

        expect(result.id).toBe('cm_123');
        expect(result.insights).toEqual(['insight1']);
        expect(result.metrics.accuracy).toBe(85);
      });

      it('should return null for null input', () => {
        expect(service.parseMemoryNode(null)).toBeNull();
      });
    });

    describe('parseEpisodeNode', () => {
      it('should parse episode node correctly', () => {
        const node = {
          properties: {
            id: 'ep_123',
            eventType: 'REVIEW_COMPLETED',
            payload: '{"rating": 3}',
          },
        };

        const result = service.parseEpisodeNode(node);

        expect(result.id).toBe('ep_123');
        expect(result.payload.rating).toBe(3);
      });
    });

    describe('safeJsonParse', () => {
      it('should parse valid JSON', () => {
        expect(service.safeJsonParse('{"key": "value"}', {})).toEqual({ key: 'value' });
      });

      it('should return default for invalid JSON', () => {
        expect(service.safeJsonParse('invalid', [])).toEqual([]);
      });

      it('should return object as-is', () => {
        const obj = { key: 'value' };
        expect(service.safeJsonParse(obj, {})).toEqual(obj);
      });
    });
  });

  describe('Constants Export', () => {
    it('should export relationship types', () => {
      expect(RELATIONSHIP_TYPES.CONSOLIDATED_INTO).toBe('CONSOLIDATED_INTO');
      expect(RELATIONSHIP_TYPES.SUMMARIZES).toBe('SUMMARIZES');
      expect(RELATIONSHIP_TYPES.MEMORY_RELATES).toBe('MEMORY_RELATES');
      expect(RELATIONSHIP_TYPES.HAS_MEMORY).toBe('HAS_MEMORY');
    });

    it('should export contribution types', () => {
      expect(CONTRIBUTION_TYPES.PRIMARY).toBe('primary');
      expect(CONTRIBUTION_TYPES.SUPPORTING).toBe('supporting');
      expect(CONTRIBUTION_TYPES.CONTEXTUAL).toBe('contextual');
    });

    it('should export memory relation types', () => {
      expect(MEMORY_RELATION_TYPES.PREREQUISITE).toBe('prerequisite');
      expect(MEMORY_RELATION_TYPES.BUILDS_ON).toBe('builds_on');
      expect(MEMORY_RELATION_TYPES.CONTRASTS).toBe('contrasts');
      expect(MEMORY_RELATION_TYPES.CLUSTERS_WITH).toBe('clusters_with');
    });

    it('should export mastery contributions', () => {
      expect(MASTERY_CONTRIBUTIONS.POSITIVE).toBe('positive');
      expect(MASTERY_CONTRIBUTIONS.NEGATIVE).toBe('negative');
      expect(MASTERY_CONTRIBUTIONS.NEUTRAL).toBe('neutral');
    });
  });

  describe('Error Handling', () => {
    it('should handle Neo4j query errors gracefully', async () => {
      mockNeo4j.runQuery.mockRejectedValue(new Error('Connection lost'));

      await expect(service.upsertConsolidatedMemory({}, 1)).rejects.toThrow('Connection lost');
    });

    it('should return empty arrays on query errors for list queries', async () => {
      mockNeo4j.runQuery.mockRejectedValue(new Error('Query failed'));

      const episodes = await service.getSourceEpisodes('cm_123');
      expect(episodes).toEqual([]);

      const concepts = await service.getConceptsForMemory('cm_123');
      expect(concepts).toEqual([]);
    });

    it('should return null on query errors for single item queries', async () => {
      mockNeo4j.runQuery.mockRejectedValue(new Error('Query failed'));

      const memory = await service.getMemoryById('cm_123');
      expect(memory).toBeNull();

      const mastery = await service.calculateConceptMasteryFromMemories('c1');
      expect(mastery).toBeNull();
    });
  });
});

describe('SummarizationGraphService Integration with ConsolidationService', () => {
  it('should be constructable with typical ConsolidationService dependencies', () => {
    const service = new SummarizationGraphService({
      neo4jAdapter: createMockNeo4jAdapter(),
      store: createMockStore(),
    });

    expect(service).toBeDefined();
    expect(service.isAvailable()).toBe(true);
  });

  it('should handle missing neo4jAdapter gracefully', () => {
    const service = new SummarizationGraphService({ store: createMockStore() });

    expect(service.isAvailable()).toBe(false);
  });
});
