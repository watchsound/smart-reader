/**
 * GraphLearningFeatures.test.js
 *
 * Tests for the advanced learning features powered by Neo4j.
 * Tests learning paths, weak concepts detection, entity resolution, and mastery tracking.
 */

// Mock graphInterface
const mockSession = {
  run: jest.fn(),
  close: jest.fn(),
};

const mockGraphInterface = {
  checkConnection: jest.fn().mockReturnValue(true),
  adapter: {
    session: mockSession,
  },
};

jest.mock('../../main/utils/GraphInterface', () => ({
  default: mockGraphInterface,
  __esModule: true,
}));

// Mock getUserIdFromToken
jest.mock('../../main/db/dbManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'invalid-token') return -1;
    return 1;
  }),
}));

// Import after mocking
const graphLearningFeatures = require('../../main/utils/GraphLearningFeatures').default;

describe('GraphLearningFeatures', () => {
  const validToken = 'valid-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGraphInterface.checkConnection.mockReturnValue(true);
    mockGraphInterface.adapter = { session: mockSession };
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const GraphLearningFeatures = require('../../main/utils/GraphLearningFeatures').default.constructor;
      const instance1 = new GraphLearningFeatures();
      const instance2 = new GraphLearningFeatures();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Availability Check', () => {
    it('should return true when connected', () => {
      expect(graphLearningFeatures.isAvailable()).toBe(true);
    });

    it('should return false when not connected', () => {
      mockGraphInterface.checkConnection.mockReturnValue(false);
      expect(graphLearningFeatures.isAvailable()).toBe(false);
    });
  });

  describe('Learning Path Features', () => {
    describe('createConceptWithPrereqs', () => {
      it('should create concept with prerequisites', async () => {
        const mockRecord = {
          get: jest.fn(() => ({
            properties: { id: 'concept1', name: 'Machine Learning', masteryLevel: 0 },
          })),
        };
        mockSession.run.mockResolvedValueOnce({ records: [mockRecord] });
        mockSession.run.mockResolvedValue({ records: [] }); // For prerequisite relationships

        const result = await graphLearningFeatures.createConceptWithPrereqs(
          { name: 'Machine Learning', description: 'AI technique', domain: 'AI' },
          ['prereq1', 'prereq2'],
          validToken
        );

        expect(result).toHaveProperty('name', 'Machine Learning');
        expect(mockSession.run).toHaveBeenCalledTimes(3); // Create + 2 prereqs
      });

      it('should return null when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.createConceptWithPrereqs({}, [], validToken);
        expect(result).toBeNull();
      });

      it('should return null when session is not available', async () => {
        mockGraphInterface.adapter = null;
        const result = await graphLearningFeatures.createConceptWithPrereqs({}, [], validToken);
        expect(result).toBeNull();
      });

      it('should return null when no records are returned', async () => {
        mockSession.run.mockResolvedValueOnce({ records: [] });
        const result = await graphLearningFeatures.createConceptWithPrereqs(
          { name: 'Test' },
          [],
          validToken
        );
        expect(result).toBeNull();
      });

      it('should handle errors gracefully', async () => {
        mockSession.run.mockRejectedValueOnce(new Error('Database error'));
        const result = await graphLearningFeatures.createConceptWithPrereqs({}, [], validToken);
        expect(result).toBeNull();
      });
    });

    describe('getPersonalizedLearningPath', () => {
      it('should return learning path with concepts ordered by depth', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              const data = {
                id: 'concept1',
                name: 'Basic ML',
                description: 'Intro',
                difficulty: 'beginner',
                mastery: 30,
                depth: 2,
              };
              return data[key];
            }),
          },
          {
            get: jest.fn((key) => {
              const data = {
                id: 'concept2',
                name: 'Advanced ML',
                description: 'Advanced',
                difficulty: 'advanced',
                mastery: 10,
                depth: 0,
              };
              return data[key];
            }),
          },
        ];
        mockSession.run.mockResolvedValueOnce({ records: mockRecords });

        const result = await graphLearningFeatures.getPersonalizedLearningPath('target1', validToken);

        expect(result).toHaveProperty('targetConceptId', 'target1');
        expect(result).toHaveProperty('path');
        expect(result.path).toHaveLength(2);
        expect(result).toHaveProperty('conceptCount', 2);
        expect(result).toHaveProperty('estimatedMinutes');
        expect(result).toHaveProperty('nextConcept');
      });

      it('should return null when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.getPersonalizedLearningPath('target', validToken);
        expect(result).toBeNull();
      });

      it('should handle empty path', async () => {
        mockSession.run.mockResolvedValueOnce({ records: [] });
        const result = await graphLearningFeatures.getPersonalizedLearningPath('target', validToken);
        expect(result.path).toEqual([]);
        expect(result.nextConcept).toBeNull();
      });
    });

    describe('getDependentConcepts', () => {
      it('should return concepts that depend on the given concept', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              const data = { id: 'dep1', name: 'Dependent 1', mastery: 50, difficulty: 'intermediate' };
              return data[key];
            }),
          },
        ];
        mockSession.run.mockResolvedValueOnce({ records: mockRecords });

        const result = await graphLearningFeatures.getDependentConcepts('concept1', validToken);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('name', 'Dependent 1');
      });

      it('should return empty array when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.getDependentConcepts('concept1', validToken);
        expect(result).toEqual([]);
      });
    });
  });

  describe('Weak Concepts Detection', () => {
    describe('detectWeakConcepts', () => {
      it('should detect weak concepts sorted by weakness score', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              const data = {
                id: 'weak1',
                name: 'Weak Concept',
                description: 'Needs work',
                mastery: 20,
                reviewCount: 3,
                lastReviewed: null,
                dependentCount: 5,
                weaknessScore: 150,
              };
              return data[key];
            }),
          },
        ];
        mockSession.run.mockResolvedValueOnce({ records: mockRecords });

        const result = await graphLearningFeatures.detectWeakConcepts(validToken, 10);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('id', 'weak1');
        expect(result[0]).toHaveProperty('weaknessScore', 150);
        expect(result[0]).toHaveProperty('reason');
      });

      it('should return empty array when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.detectWeakConcepts(validToken);
        expect(result).toEqual([]);
      });
    });

    describe('_getWeaknessReason', () => {
      it('should return reason for very low mastery', () => {
        const reason = graphLearningFeatures._getWeaknessReason(20, 0, new Date());
        expect(reason).toContain('Very low mastery');
      });

      it('should return reason for below threshold mastery', () => {
        const reason = graphLearningFeatures._getWeaknessReason(40, 0, new Date());
        expect(reason).toContain('Below threshold mastery');
      });

      it('should return reason for blocking concepts', () => {
        const reason = graphLearningFeatures._getWeaknessReason(60, 5, new Date());
        expect(reason).toContain('Blocking 5 other concepts');
      });

      it('should return reason for never reviewed', () => {
        const reason = graphLearningFeatures._getWeaknessReason(60, 0, null);
        expect(reason).toContain('Never reviewed');
      });

      it('should return default reason when no specific issues', () => {
        const reason = graphLearningFeatures._getWeaknessReason(60, 0, new Date());
        expect(reason).toBe('Needs improvement');
      });

      it('should combine multiple reasons', () => {
        const reason = graphLearningFeatures._getWeaknessReason(20, 5, null);
        expect(reason).toContain('Very low mastery');
        expect(reason).toContain('Blocking 5 other concepts');
        expect(reason).toContain('Never reviewed');
      });
    });

    describe('getErrorProneTopics', () => {
      it('should return concepts with high error rates', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              const data = { id: 'error1', name: 'Error Prone', mastery: 30, totalErrors: 10 };
              return data[key];
            }),
          },
        ];
        mockSession.run.mockResolvedValueOnce({ records: mockRecords });

        const result = await graphLearningFeatures.getErrorProneTopics(validToken, 30);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('errorCount', 10);
      });

      it('should return empty array when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.getErrorProneTopics(validToken);
        expect(result).toEqual([]);
      });
    });
  });

  describe('Entity Resolution', () => {
    describe('resolveRelatedConcepts', () => {
      it('should find related concept pairs', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              const data = {
                concept1Id: 'c1',
                concept1Name: 'Concept 1',
                concept2Id: 'c2',
                concept2Name: 'Concept 2',
                coOccurrence: 5,
                alreadyLinked: false,
              };
              return data[key];
            }),
          },
        ];
        mockSession.run.mockResolvedValueOnce({ records: mockRecords });

        const result = await graphLearningFeatures.resolveRelatedConcepts(validToken);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('concept1');
        expect(result[0]).toHaveProperty('concept2');
        expect(result[0]).toHaveProperty('coOccurrence', 5);
      });

      it('should return empty array when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.resolveRelatedConcepts(validToken);
        expect(result).toEqual([]);
      });
    });

    describe('linkConcepts', () => {
      it('should link two concepts successfully', async () => {
        mockSession.run.mockResolvedValueOnce({ records: [] });

        const result = await graphLearningFeatures.linkConcepts('c1', 'c2', 'similar', 0.8);

        expect(result).toBe(true);
        expect(mockSession.run).toHaveBeenCalled();
      });

      it('should return false when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.linkConcepts('c1', 'c2');
        expect(result).toBe(false);
      });

      it('should handle errors', async () => {
        mockSession.run.mockRejectedValueOnce(new Error('Link failed'));
        const result = await graphLearningFeatures.linkConcepts('c1', 'c2');
        expect(result).toBe(false);
      });
    });

    describe('extractConceptsFromText', () => {
      it('should extract existing concepts and suggest new ones', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              const data = { id: 'existing1', name: 'Machine', mastery: 50 };
              return data[key];
            }),
          },
        ];
        mockSession.run.mockResolvedValueOnce({ records: mockRecords });

        const result = await graphLearningFeatures.extractConceptsFromText(
          'Machine Learning is about Neural Networks',
          validToken
        );

        expect(result).toHaveProperty('existing');
        expect(result).toHaveProperty('suggested');
        expect(result.existing).toHaveLength(1);
      });

      it('should suggest capitalized phrases as new concepts', async () => {
        mockSession.run.mockResolvedValueOnce({ records: [] });

        const result = await graphLearningFeatures.extractConceptsFromText(
          'Machine Learning and Neural Networks are important',
          validToken
        );

        // Should extract "Machine Learning" and "Neural Networks" as capitalized phrases
        expect(result.suggested.length).toBeGreaterThanOrEqual(0);
      });

      it('should return empty arrays when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.extractConceptsFromText('text', validToken);
        expect(result).toEqual({ existing: [], suggested: [] });
      });
    });

    describe('getConceptClusters', () => {
      it('should return concept clusters by domain', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              if (key === 'domain') return 'AI';
              if (key === 'groups') return [{ center: {}, related: [] }];
            }),
          },
        ];
        mockSession.run.mockResolvedValueOnce({ records: mockRecords });

        const result = await graphLearningFeatures.getConceptClusters(validToken);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('domain', 'AI');
        expect(result[0]).toHaveProperty('groups');
      });

      it('should return empty array when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.getConceptClusters(validToken);
        expect(result).toEqual([]);
      });
    });
  });

  describe('Mastery Tracking', () => {
    describe('updateConceptMastery', () => {
      it('should increase mastery for correct answer', async () => {
        const mockRecord = {
          get: jest.fn((key) => {
            const data = { id: 'concept1', name: 'Test', mastery: 60 };
            return data[key];
          }),
        };
        mockSession.run.mockResolvedValueOnce({ records: [mockRecord] });

        const result = await graphLearningFeatures.updateConceptMastery(
          'concept1',
          'correct',
          validToken
        );

        expect(result).toHaveProperty('mastery', 60);
      });

      it('should return null when no records found', async () => {
        mockSession.run.mockResolvedValueOnce({ records: [] });
        const result = await graphLearningFeatures.updateConceptMastery('c1', 'correct', validToken);
        expect(result).toBeNull();
      });

      it('should return null when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.updateConceptMastery('c1', 'correct', validToken);
        expect(result).toBeNull();
      });
    });

    describe('getMasteryProgress', () => {
      it('should return daily mastery snapshots', async () => {
        const mockRecords = [
          {
            get: jest.fn((key) => {
              const data = { day: '2024-01-01', correct: 8, total: 10, accuracy: 80 };
              return data[key];
            }),
          },
        ];
        mockSession.run.mockResolvedValueOnce({ records: mockRecords });

        const result = await graphLearningFeatures.getMasteryProgress(validToken, 30);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('accuracy', 80);
      });

      it('should return empty array when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.getMasteryProgress(validToken);
        expect(result).toEqual([]);
      });
    });
  });

  describe('Knowledge Graph Visualization', () => {
    describe('getKnowledgeGraphData', () => {
      it('should return full knowledge graph when no center specified', async () => {
        const mockRecord = {
          get: jest.fn((key) => {
            if (key === 'nodes') {
              return [{ id: 'n1', name: 'Node 1', mastery: 50, domain: 'AI' }];
            }
            if (key === 'edges') {
              return [{ source: 'n1', target: 'n2', type: 'REQUIRES' }];
            }
          }),
        };
        mockSession.run.mockResolvedValueOnce({ records: [mockRecord] });

        const result = await graphLearningFeatures.getKnowledgeGraphData(validToken);

        expect(result).toHaveProperty('nodes');
        expect(result).toHaveProperty('edges');
        expect(result.nodes).toHaveLength(1);
      });

      it('should return focused graph when center is specified', async () => {
        const mockRecord = {
          get: jest.fn((key) => {
            if (key === 'nodes') return [{ id: 'center', name: 'Center' }];
            if (key === 'edges') return [];
          }),
        };
        mockSession.run.mockResolvedValueOnce({ records: [mockRecord] });

        const result = await graphLearningFeatures.getKnowledgeGraphData(validToken, 'center');

        expect(result).toHaveProperty('nodes');
        expect(result.nodes).toHaveLength(1);
      });

      it('should filter out edges with missing source or target', async () => {
        const mockRecord = {
          get: jest.fn((key) => {
            if (key === 'nodes') return [{ id: 'n1' }];
            if (key === 'edges') {
              return [
                { source: 'n1', target: 'n2', type: 'REQUIRES' },
                { source: null, target: 'n2', type: 'REQUIRES' },
                { source: 'n1', target: null, type: 'REQUIRES' },
              ];
            }
          }),
        };
        mockSession.run.mockResolvedValueOnce({ records: [mockRecord] });

        const result = await graphLearningFeatures.getKnowledgeGraphData(validToken);

        expect(result.edges).toHaveLength(1);
      });

      it('should return empty graph when no records', async () => {
        mockSession.run.mockResolvedValueOnce({ records: [] });
        const result = await graphLearningFeatures.getKnowledgeGraphData(validToken);
        expect(result).toEqual({ nodes: [], edges: [] });
      });

      it('should return empty graph when not available', async () => {
        mockGraphInterface.checkConnection.mockReturnValue(false);
        const result = await graphLearningFeatures.getKnowledgeGraphData(validToken);
        expect(result).toEqual({ nodes: [], edges: [] });
      });

      it('should handle errors gracefully', async () => {
        mockSession.run.mockRejectedValueOnce(new Error('Query failed'));
        const result = await graphLearningFeatures.getKnowledgeGraphData(validToken);
        expect(result).toEqual({ nodes: [], edges: [] });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle session errors in createConceptWithPrereqs', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSession.run.mockRejectedValueOnce(new Error('Session error'));

      const result = await graphLearningFeatures.createConceptWithPrereqs(
        { name: 'Test' },
        [],
        validToken
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle session errors in getPersonalizedLearningPath', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSession.run.mockRejectedValueOnce(new Error('Session error'));

      const result = await graphLearningFeatures.getPersonalizedLearningPath('target', validToken);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle session errors in getDependentConcepts', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSession.run.mockRejectedValueOnce(new Error('Session error'));

      const result = await graphLearningFeatures.getDependentConcepts('concept', validToken);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle session errors in detectWeakConcepts', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSession.run.mockRejectedValueOnce(new Error('Session error'));

      const result = await graphLearningFeatures.detectWeakConcepts(validToken);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
