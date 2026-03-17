/**
 * brainHandlersSummarization.test.js
 *
 * Tests for the summarization graph IPC handlers in brainHandlers.js.
 * Tests the IPC interface for SummarizationGraphService operations.
 */

// Mock electron ipcMain
const mockHandlers = {};
const mockSyncHandlers = {};

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => {
      mockHandlers[channel] = handler;
    }),
    on: jest.fn((channel, handler) => {
      mockSyncHandlers[channel] = handler;
    }),
  },
}));

// Mock dbManager
jest.mock('../../main/db/dbManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'invalid-token') return -1;
    return 1;
  }),
}));

// Mock ConsolidatedMemoryManager
jest.mock('../../main/db/ConsolidatedMemoryManager', () => ({
  initConsolidatedMemoryTable: jest.fn(),
}));

// Mock PredictiveInsightsService
jest.mock('../../main/utils/PredictiveInsightsService', () => {
  return jest.fn().mockImplementation(() => ({
    getPredictiveInsights: jest.fn(),
    clearCache: jest.fn(),
    updateConfig: jest.fn(),
  }));
});

// Mock SummarizationGraphService
const mockSummarizationGraph = {
  isAvailable: jest.fn(() => true),
  getSummarizationHierarchy: jest.fn(),
  getMemoriesForConcept: jest.fn(),
  getConceptLearningTimeline: jest.fn(),
  getRelatedMemories: jest.fn(),
  getMemoryChain: jest.fn(),
  getCrossConceptClusters: jest.fn(),
  getSummarizationStats: jest.fn(),
  getMemoryCoverage: jest.fn(),
  findMemoryGaps: jest.fn(),
  calculateConceptMasteryFromMemories: jest.fn(),
  getSourceEpisodes: jest.fn(),
  getConceptsForMemory: jest.fn(),
};

jest.mock('../../main/utils/SummarizationGraphService', () => {
  return jest.fn().mockImplementation(() => mockSummarizationGraph);
});

const { registerBrainHandlers } = require('../../main/ipc/brainHandlers');

describe('Brain Handlers - Summarization Graph', () => {
  let mockEvent;

  beforeAll(() => {
    // Register handlers
    registerBrainHandlers({
      brain: {
        neo4jAdapter: {},
        episodeCollector: {},
        sessionAnalyticsManager: {},
        learningPlanManager: {},
        learnerProfileManager: {},
        graphInterface: {},
      },
      store: {
        get: jest.fn(),
        set: jest.fn(),
      },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEvent = { returnValue: null };
    mockSummarizationGraph.isAvailable.mockReturnValue(true);
  });

  describe('graph-summarization-available', () => {
    it('should return true when service is available', () => {
      const handler = mockSyncHandlers['graph-summarization-available'];
      handler(mockEvent);
      expect(mockEvent.returnValue).toBe(true);
    });

    it('should return false when service is not available', () => {
      mockSummarizationGraph.isAvailable.mockReturnValue(false);
      const handler = mockSyncHandlers['graph-summarization-available'];
      handler(mockEvent);
      expect(mockEvent.returnValue).toBe(false);
    });
  });

  describe('graph-get-summarization-hierarchy', () => {
    it('should return hierarchy for a concept', async () => {
      const mockHierarchy = {
        concept: { id: 'c1', name: 'Test' },
        memories: [{ memory: { id: 'cm_1' }, episodes: [] }],
      };
      mockSummarizationGraph.getSummarizationHierarchy.mockResolvedValue(mockHierarchy);

      const handler = mockHandlers['graph-get-summarization-hierarchy'];
      const result = await handler(mockEvent, {
        conceptId: 'c1',
        token: 'valid-token',
        options: {},
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHierarchy);
    });

    it('should return error when service not available', async () => {
      mockSummarizationGraph.isAvailable.mockReturnValue(false);

      const handler = mockHandlers['graph-get-summarization-hierarchy'];
      const result = await handler(mockEvent, {
        conceptId: 'c1',
        token: 'valid-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });
  });

  describe('graph-get-memories-for-concept', () => {
    it('should return memories for a concept', async () => {
      const mockMemories = [
        { memory: { id: 'cm_1' }, relationship: { weight: 1.0 } },
      ];
      mockSummarizationGraph.getMemoriesForConcept.mockResolvedValue(mockMemories);

      const handler = mockHandlers['graph-get-memories-for-concept'];
      const result = await handler(mockEvent, {
        conceptId: 'c1',
        token: 'valid-token',
        options: { limit: 50 },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMemories);
    });
  });

  describe('graph-get-concept-timeline', () => {
    it('should return timeline for a concept', async () => {
      const mockTimeline = [
        { memory: { id: 'cm_1', periodEnd: '2024-01-02' } },
        { memory: { id: 'cm_2', periodEnd: '2024-01-01' } },
      ];
      mockSummarizationGraph.getConceptLearningTimeline.mockResolvedValue(mockTimeline);

      const handler = mockHandlers['graph-get-concept-timeline'];
      const result = await handler(mockEvent, {
        conceptId: 'c1',
        token: 'valid-token',
        limit: 50,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTimeline);
    });
  });

  describe('graph-get-related-memories', () => {
    it('should return related memories', async () => {
      const mockRelated = [
        { memory: { id: 'cm_2' }, direction: 'outgoing' },
      ];
      mockSummarizationGraph.getRelatedMemories.mockResolvedValue(mockRelated);

      const handler = mockHandlers['graph-get-related-memories'];
      const result = await handler(mockEvent, {
        memoryId: 'cm_1',
        token: 'valid-token',
        relationType: 'prerequisite',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRelated);
    });
  });

  describe('graph-get-memory-chain', () => {
    it('should return memory chain', async () => {
      const mockChain = [
        { memory: { id: 'cm_1' }, depth: 0 },
        { memory: { id: 'cm_2' }, depth: 1 },
      ];
      mockSummarizationGraph.getMemoryChain.mockResolvedValue(mockChain);

      const handler = mockHandlers['graph-get-memory-chain'];
      const result = await handler(mockEvent, {
        memoryId: 'cm_1',
        token: 'valid-token',
        direction: 'outgoing',
        maxDepth: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockChain);
    });
  });

  describe('graph-get-cross-concept-clusters', () => {
    it('should return cross-concept clusters', async () => {
      const mockClusters = [
        { memory: { id: 'cm_1' }, concepts: [{ id: 'c1' }, { id: 'c2' }] },
      ];
      mockSummarizationGraph.getCrossConceptClusters.mockResolvedValue(mockClusters);

      const handler = mockHandlers['graph-get-cross-concept-clusters'];
      const result = await handler(mockEvent, {
        token: 'valid-token',
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockClusters);
    });

    it('should return error for invalid token', async () => {
      const handler = mockHandlers['graph-get-cross-concept-clusters'];
      const result = await handler(mockEvent, {
        token: 'invalid-token',
        limit: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid session');
    });
  });

  describe('graph-get-summarization-stats', () => {
    it('should return summarization stats', async () => {
      const mockStats = {
        totalMemories: 10,
        byType: { concept_session: 8, cross_concept: 2 },
        totalEpisodes: 50,
      };
      mockSummarizationGraph.getSummarizationStats.mockResolvedValue(mockStats);

      const handler = mockHandlers['graph-get-summarization-stats'];
      const result = await handler(mockEvent, {
        token: 'valid-token',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);
    });
  });

  describe('graph-get-memory-coverage', () => {
    it('should return memory coverage data', async () => {
      const mockCoverage = [
        { conceptId: 'c1', conceptName: 'Concept 1', memoryCount: 5 },
        { conceptId: 'c2', conceptName: 'Concept 2', memoryCount: 3 },
      ];
      mockSummarizationGraph.getMemoryCoverage.mockResolvedValue(mockCoverage);

      const handler = mockHandlers['graph-get-memory-coverage'];
      const result = await handler(mockEvent, {
        token: 'valid-token',
        limit: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCoverage);
    });
  });

  describe('graph-find-memory-gaps', () => {
    it('should find memory gaps', async () => {
      const mockGaps = [
        { conceptId: 'c1', conceptName: 'Neglected', daysSinceLastMemory: 45 },
      ];
      mockSummarizationGraph.findMemoryGaps.mockResolvedValue(mockGaps);

      const handler = mockHandlers['graph-find-memory-gaps'];
      const result = await handler(mockEvent, {
        token: 'valid-token',
        daysSinceLastMemory: 30,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockGaps);
    });
  });

  describe('graph-calculate-concept-mastery', () => {
    it('should calculate concept mastery', async () => {
      const mockMastery = {
        conceptId: 'c1',
        aggregatedMastery: 0.75,
        masteryLevel: 'proficient',
      };
      mockSummarizationGraph.calculateConceptMasteryFromMemories.mockResolvedValue(mockMastery);

      const handler = mockHandlers['graph-calculate-concept-mastery'];
      const result = await handler(mockEvent, {
        conceptId: 'c1',
        token: 'valid-token',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMastery);
    });
  });

  describe('graph-get-source-episodes', () => {
    it('should return source episodes for a memory', async () => {
      const mockEpisodes = [
        { episode: { id: 'ep_1' }, relationship: { weight: 0.8 } },
      ];
      mockSummarizationGraph.getSourceEpisodes.mockResolvedValue(mockEpisodes);

      const handler = mockHandlers['graph-get-source-episodes'];
      const result = await handler(mockEvent, {
        memoryId: 'cm_1',
        token: 'valid-token',
        limit: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEpisodes);
    });
  });

  describe('graph-get-concepts-for-memory', () => {
    it('should return concepts for a memory', async () => {
      const mockConcepts = [
        { concept: { id: 'c1' }, relationship: { isPrimary: true } },
      ];
      mockSummarizationGraph.getConceptsForMemory.mockResolvedValue(mockConcepts);

      const handler = mockHandlers['graph-get-concepts-for-memory'];
      const result = await handler(mockEvent, {
        memoryId: 'cm_1',
        token: 'valid-token',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockConcepts);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockSummarizationGraph.getSummarizationHierarchy.mockRejectedValue(
        new Error('Neo4j connection lost')
      );

      const handler = mockHandlers['graph-get-summarization-hierarchy'];
      const result = await handler(mockEvent, {
        conceptId: 'c1',
        token: 'valid-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Neo4j connection lost');
    });
  });
});
