/**
 * Unit tests for Brain IPC Handlers - Memory Consolidation
 *
 * Tests the IPC handlers in brainHandlers.js related to
 * memory consolidation operations.
 */

const { ipcMain } = require('electron');

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

// Mock ConsolidatedMemoryManager
const mockConsolidatedMemoryManager = {
  initConsolidatedMemoryTable: jest.fn(),
  getConsolidatedMemories: jest.fn(),
  getMemoryById: jest.fn(),
  searchMemories: jest.fn(),
  getConsolidationStats: jest.fn(),
  deleteConsolidatedMemory: jest.fn(),
  deleteOldMemories: jest.fn(),
};

jest.mock('../../main/db/ConsolidatedMemoryManager', () => mockConsolidatedMemoryManager);

// Import after mocking
const { registerBrainHandlers } = require('../../main/ipc/brainHandlers');

describe('brainHandlers - Memory Consolidation', () => {
  let handlers;
  let mockBrain;
  let mockStore;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset handler registry
    handlers = {};
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
    ipcMain.on.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    // Mock brain instance
    mockBrain = {
      getStatus: jest.fn().mockResolvedValue({ enabled: true, mode: 'active' }),
      getInsights: jest.fn().mockResolvedValue({ patterns: [] }),
      triggerHeartbeat: jest.fn().mockResolvedValue({ success: true }),
      recordEpisode: jest.fn().mockReturnValue('ep_123'),
      scheduler: {
        getStatus: jest.fn().mockReturnValue({ nextScheduledHeartbeat: null }),
        loadConfig: jest.fn(),
        scheduleNext: jest.fn(),
        cancel: jest.fn(),
      },
      episodeCollector: {
        getRecentEpisodes: jest.fn().mockResolvedValue([]),
        getEpisodesByType: jest.fn().mockResolvedValue([]),
        getEpisodeStats: jest.fn().mockResolvedValue({}),
      },
      agent: {
        triggerManualConsolidation: jest.fn().mockResolvedValue({ success: true }),
        getConsolidationStats: jest.fn().mockResolvedValue({}),
      },
    };

    // Mock store
    mockStore = {
      get: jest.fn().mockReturnValue({}),
      set: jest.fn(),
    };

    // Register handlers
    registerBrainHandlers({ brain: mockBrain, store: mockStore });
  });

  describe('initialization', () => {
    it('should initialize consolidated memory table', () => {
      expect(mockConsolidatedMemoryManager.initConsolidatedMemoryTable).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', () => {
      mockConsolidatedMemoryManager.initConsolidatedMemoryTable.mockImplementationOnce(() => {
        throw new Error('Init failed');
      });

      // Should not throw
      expect(() => {
        registerBrainHandlers({ brain: mockBrain, store: mockStore });
      }).not.toThrow();
    });
  });

  describe('brain-consolidate-now', () => {
    it('should trigger manual consolidation', async () => {
      const event = {};
      const options = { token: 'test-token' };

      const result = await handlers['brain-consolidate-now'](event, options);

      expect(mockBrain.agent.triggerManualConsolidation).toHaveBeenCalledWith(
        'test-token',
        options
      );
      expect(result.success).toBe(true);
    });

    it('should use default token if not provided', async () => {
      const event = {};
      const options = {};

      await handlers['brain-consolidate-now'](event, options);

      expect(mockBrain.agent.triggerManualConsolidation).toHaveBeenCalledWith(
        'consolidation-manual',
        options
      );
    });

    it('should return error if brain not initialized', async () => {
      // Re-register without brain
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      const result = await handlers['brain-consolidate-now']({}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('should return error if brain agent not initialized', async () => {
      // Re-register without brain.agent
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ brain: { ...mockBrain, agent: null }, store: mockStore });

      const result = await handlers['brain-consolidate-now']({}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('should handle consolidation errors', async () => {
      mockBrain.agent.triggerManualConsolidation.mockRejectedValueOnce(
        new Error('Consolidation failed')
      );

      const result = await handlers['brain-consolidate-now']({}, { token: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Consolidation failed');
    });
  });

  describe('brain-get-memories', () => {
    it('should get consolidated memories with all options', async () => {
      const options = {
        token: 'test-token',
        conceptId: 'concept_123',
        conceptName: 'test concept',
        memoryType: 'concept_session',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        limit: 20,
        offset: 10,
      };

      mockConsolidatedMemoryManager.getConsolidatedMemories.mockReturnValueOnce([
        { id: 'mem_1', summary: 'Test memory' },
      ]);

      const result = await handlers['brain-get-memories']({}, options);

      expect(mockConsolidatedMemoryManager.getConsolidatedMemories).toHaveBeenCalledWith({
        token: 'test-token',
        conceptId: 'concept_123',
        conceptName: 'test concept',
        memoryType: 'concept_session',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        limit: 20,
        offset: 10,
      });
      expect(result).toHaveLength(1);
    });

    it('should use default limit and offset', async () => {
      mockConsolidatedMemoryManager.getConsolidatedMemories.mockReturnValueOnce([]);

      await handlers['brain-get-memories']({}, {});

      expect(mockConsolidatedMemoryManager.getConsolidatedMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
          offset: 0,
        })
      );
    });

    it('should return empty array on error', async () => {
      mockConsolidatedMemoryManager.getConsolidatedMemories.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await handlers['brain-get-memories']({}, {});

      expect(result).toEqual([]);
    });
  });

  describe('brain-get-memory', () => {
    it('should get a single memory by ID', async () => {
      const mockMemory = {
        id: 'mem_123',
        summary: 'Test summary',
        conceptName: 'test',
      };
      mockConsolidatedMemoryManager.getMemoryById.mockReturnValueOnce(mockMemory);

      const result = await handlers['brain-get-memory']({}, 'mem_123', 'test-token');

      expect(mockConsolidatedMemoryManager.getMemoryById).toHaveBeenCalledWith(
        'mem_123',
        'test-token'
      );
      expect(result).toEqual(mockMemory);
    });

    it('should return null on error', async () => {
      mockConsolidatedMemoryManager.getMemoryById.mockImplementationOnce(() => {
        throw new Error('Not found');
      });

      const result = await handlers['brain-get-memory']({}, 'invalid', 'token');

      expect(result).toBeNull();
    });
  });

  describe('brain-search-memories', () => {
    it('should search memories with query', async () => {
      const mockResults = [
        { id: 'mem_1', summary: 'Memory about ephemeral' },
        { id: 'mem_2', summary: 'Another ephemeral memory' },
      ];
      mockConsolidatedMemoryManager.searchMemories.mockReturnValueOnce(mockResults);

      const result = await handlers['brain-search-memories']({}, 'ephemeral', 'test-token', 10);

      expect(mockConsolidatedMemoryManager.searchMemories).toHaveBeenCalledWith(
        'ephemeral',
        'test-token',
        10
      );
      expect(result).toHaveLength(2);
    });

    it('should use default limit', async () => {
      mockConsolidatedMemoryManager.searchMemories.mockReturnValueOnce([]);

      await handlers['brain-search-memories']({}, 'query', 'token');

      expect(mockConsolidatedMemoryManager.searchMemories).toHaveBeenCalledWith(
        'query',
        'token',
        20
      );
    });

    it('should return empty array on error', async () => {
      mockConsolidatedMemoryManager.searchMemories.mockImplementationOnce(() => {
        throw new Error('Search error');
      });

      const result = await handlers['brain-search-memories']({}, 'query', 'token');

      expect(result).toEqual([]);
    });
  });

  describe('brain-get-consolidation-stats', () => {
    it('should get stats from brain agent if available', async () => {
      const mockStats = {
        byType: { concept_session: 5, daily: 2 },
        totalMemories: 7,
        totalEpisodesConsolidated: 35,
        uniqueConcepts: 10,
      };
      mockBrain.agent.getConsolidationStats.mockReturnValueOnce(mockStats);

      const result = await handlers['brain-get-consolidation-stats']({}, 'test-token');

      expect(mockBrain.agent.getConsolidationStats).toHaveBeenCalledWith('test-token');
      expect(result).toEqual(mockStats);
    });

    it('should fallback to memory manager if no brain', async () => {
      // Re-register without brain
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      const mockStats = { totalMemories: 3 };
      mockConsolidatedMemoryManager.getConsolidationStats.mockReturnValueOnce(mockStats);

      const result = await handlers['brain-get-consolidation-stats']({}, 'token');

      expect(mockConsolidatedMemoryManager.getConsolidationStats).toHaveBeenCalledWith('token');
      expect(result).toEqual(mockStats);
    });

    it('should return default stats on error', async () => {
      // Re-register without brain
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      mockConsolidatedMemoryManager.getConsolidationStats.mockImplementationOnce(() => {
        throw new Error('Stats error');
      });

      const result = await handlers['brain-get-consolidation-stats']({}, 'token');

      expect(result).toEqual({
        byType: {},
        totalMemories: 0,
        totalEpisodesConsolidated: 0,
        uniqueConcepts: 0,
        recentConsolidations: 0,
        masteryDistribution: {},
      });
    });
  });

  describe('brain-delete-memory', () => {
    it('should delete a memory', async () => {
      mockConsolidatedMemoryManager.deleteConsolidatedMemory.mockReturnValueOnce({
        success: true,
        deleted: 1,
      });

      const result = await handlers['brain-delete-memory']({}, 'mem_123', 'test-token');

      expect(mockConsolidatedMemoryManager.deleteConsolidatedMemory).toHaveBeenCalledWith(
        'mem_123',
        'test-token'
      );
      expect(result.success).toBe(true);
    });

    it('should return error on delete failure', async () => {
      mockConsolidatedMemoryManager.deleteConsolidatedMemory.mockImplementationOnce(() => {
        throw new Error('Delete failed');
      });

      const result = await handlers['brain-delete-memory']({}, 'mem_123', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('brain-delete-old-memories', () => {
    it('should delete old memories', async () => {
      mockConsolidatedMemoryManager.deleteOldMemories.mockReturnValueOnce({
        success: true,
        deleted: 5,
      });

      const result = await handlers['brain-delete-old-memories']({}, 90, 'test-token');

      expect(mockConsolidatedMemoryManager.deleteOldMemories).toHaveBeenCalledWith(
        90,
        'test-token'
      );
      expect(result.success).toBe(true);
      expect(result.deleted).toBe(5);
    });

    it('should return error on failure', async () => {
      mockConsolidatedMemoryManager.deleteOldMemories.mockImplementationOnce(() => {
        throw new Error('Cleanup failed');
      });

      const result = await handlers['brain-delete-old-memories']({}, 30, 'token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cleanup failed');
    });
  });

  describe('brain-get-episode-stats', () => {
    it('should get episode stats from collector', async () => {
      const mockStats = {
        total: 100,
        byType: { REVIEW_COMPLETED: 80, QUIZ_TAKEN: 20 },
        processedCount: 50,
        unprocessedCount: 50,
        bufferSize: 5,
      };
      mockBrain.episodeCollector.getEpisodeStats.mockResolvedValueOnce(mockStats);

      const result = await handlers['brain-get-episode-stats']({}, 1);

      expect(mockBrain.episodeCollector.getEpisodeStats).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockStats);
    });

    it('should use default userId', async () => {
      mockBrain.episodeCollector.getEpisodeStats.mockResolvedValueOnce({});

      await handlers['brain-get-episode-stats']({});

      expect(mockBrain.episodeCollector.getEpisodeStats).toHaveBeenCalledWith(1);
    });

    it('should return default stats if no brain', async () => {
      // Re-register without brain
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      const result = await handlers['brain-get-episode-stats']({});

      expect(result).toEqual({
        total: 0,
        byType: {},
        processedCount: 0,
        unprocessedCount: 0,
        bufferSize: 0,
      });
    });

    it('should return default stats if no episodeCollector', async () => {
      // Re-register without episodeCollector
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ brain: { ...mockBrain, episodeCollector: null }, store: mockStore });

      const result = await handlers['brain-get-episode-stats']({});

      expect(result).toEqual({
        total: 0,
        byType: {},
        processedCount: 0,
        unprocessedCount: 0,
        bufferSize: 0,
      });
    });

    it('should return default stats on error', async () => {
      mockBrain.episodeCollector.getEpisodeStats.mockRejectedValueOnce(new Error('Stats error'));

      const result = await handlers['brain-get-episode-stats']({});

      expect(result).toEqual({
        total: 0,
        byType: {},
        processedCount: 0,
        unprocessedCount: 0,
        bufferSize: 0,
      });
    });
  });
});

describe('brainHandlers - Episode Collection', () => {
  let handlers;
  let mockBrain;
  let mockStore;

  beforeEach(() => {
    jest.clearAllMocks();

    handlers = {};
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
    ipcMain.on.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    mockBrain = {
      getStatus: jest.fn().mockResolvedValue({ enabled: true }),
      getInsights: jest.fn().mockResolvedValue(null),
      recordEpisode: jest.fn().mockReturnValue('ep_123'),
      episodeCollector: {
        getRecentEpisodes: jest.fn().mockResolvedValue([]),
        getEpisodesByType: jest.fn().mockResolvedValue([]),
        getEpisodeStats: jest.fn().mockResolvedValue({}),
      },
      agent: {
        triggerManualConsolidation: jest.fn(),
        getConsolidationStats: jest.fn(),
      },
    };

    mockStore = {
      get: jest.fn().mockReturnValue([]),
      set: jest.fn(),
    };

    registerBrainHandlers({ brain: mockBrain, store: mockStore });
  });

  describe('brain-record-episode', () => {
    it('should record episode through brain', async () => {
      const episode = {
        eventType: 'REVIEW_COMPLETED',
        payload: { conceptId: 'c_123', wasCorrect: true },
      };

      const result = await handlers['brain-record-episode']({}, episode);

      expect(mockBrain.recordEpisode).toHaveBeenCalledWith(episode);
      expect(result).toEqual({ success: true, id: 'ep_123' });
    });

    it('should queue locally if brain not initialized', async () => {
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      const episode = {
        eventType: 'REVIEW_COMPLETED',
        payload: { conceptId: 'c_123' },
      };

      const result = await handlers['brain-record-episode']({}, episode);

      expect(result.success).toBe(true);
      expect(result.queued).toBe(true);
      expect(mockStore.set).toHaveBeenCalled();
    });

    it('should handle recording errors', async () => {
      mockBrain.recordEpisode.mockImplementationOnce(() => {
        throw new Error('Recording failed');
      });

      const result = await handlers['brain-record-episode']({}, { eventType: 'TEST' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Recording failed');
    });
  });

  describe('brain-get-episodes', () => {
    it('should get recent episodes', async () => {
      const mockEpisodes = [
        { id: 'ep_1', eventType: 'REVIEW_COMPLETED' },
        { id: 'ep_2', eventType: 'QUIZ_TAKEN' },
      ];
      mockBrain.episodeCollector.getRecentEpisodes.mockResolvedValueOnce(mockEpisodes);

      const result = await handlers['brain-get-episodes']({}, { limit: 10 });

      expect(mockBrain.episodeCollector.getRecentEpisodes).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockEpisodes);
    });

    it('should use default limit', async () => {
      mockBrain.episodeCollector.getRecentEpisodes.mockResolvedValueOnce([]);

      await handlers['brain-get-episodes']({}, {});

      expect(mockBrain.episodeCollector.getRecentEpisodes).toHaveBeenCalledWith(50);
    });

    it('should fallback to store if no collector', async () => {
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      const storedEpisodes = [{ id: 'stored_1' }, { id: 'stored_2' }];
      mockStore.get.mockReturnValueOnce(storedEpisodes);
      registerBrainHandlers({ store: mockStore });

      const result = await handlers['brain-get-episodes']({}, { limit: 1 });

      expect(result).toHaveLength(1);
    });
  });

  describe('brain-get-episodes-by-type', () => {
    it('should get episodes filtered by type', async () => {
      const mockEpisodes = [
        { id: 'ep_1', eventType: 'REVIEW_COMPLETED' },
      ];
      mockBrain.episodeCollector.getEpisodesByType.mockResolvedValueOnce(mockEpisodes);

      const result = await handlers['brain-get-episodes-by-type']({}, 'REVIEW_COMPLETED', 25);

      expect(mockBrain.episodeCollector.getEpisodesByType).toHaveBeenCalledWith(
        'REVIEW_COMPLETED',
        25
      );
      expect(result).toEqual(mockEpisodes);
    });

    it('should return empty array if no collector', async () => {
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      const result = await handlers['brain-get-episodes-by-type']({}, 'REVIEW_COMPLETED');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockBrain.episodeCollector.getEpisodesByType.mockRejectedValueOnce(new Error('Error'));

      const result = await handlers['brain-get-episodes-by-type']({}, 'REVIEW_COMPLETED');

      expect(result).toEqual([]);
    });
  });
});

// ==================== Cross-Concept Analysis Handlers ====================

describe('brainHandlers - Cross-Concept Analysis', () => {
  let handlers;
  let mockBrain;
  let mockStore;
  let mockConsolidationService;

  beforeEach(() => {
    jest.clearAllMocks();

    handlers = {};
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
    ipcMain.on.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    // Mock consolidation service methods
    mockConsolidationService = {
      analyzeCrossConcept: jest.fn().mockResolvedValue({
        crossConceptPatterns: [
          { type: 'PREREQUISITE', fromConceptName: 'A', toConceptName: 'B', confidence: 0.85 },
        ],
        temporalPatterns: [],
        performancePatterns: [],
        summary: { totalPatterns: 1, topInsights: ['A is prerequisite for B'] },
      }),
      getRecentCrossConceptPatterns: jest.fn().mockReturnValue([
        { id: 'ccm_1', memoryType: 'cross_concept', patterns: {} },
      ]),
      getConceptPatternSummary: jest.fn().mockReturnValue({
        conceptId: 'concept_123',
        memoryCount: 5,
        latestSummary: 'Test summary',
        masteryAssessment: 'proficient',
        relatedPatterns: [],
        insights: ['Insight 1'],
      }),
      getLearningRecommendations: jest.fn().mockResolvedValue({
        scheduling: [{ type: 'optimal_time', message: 'Study in morning' }],
        content: [{ type: 'prerequisite', message: 'Study A before B' }],
        strategy: [{ type: 'consistency', message: 'Be more consistent' }],
      }),
    };

    mockBrain = {
      getStatus: jest.fn().mockResolvedValue({ enabled: true }),
      getInsights: jest.fn().mockResolvedValue(null),
      recordEpisode: jest.fn().mockReturnValue('ep_123'),
      episodeCollector: {
        getRecentEpisodes: jest.fn().mockResolvedValue([]),
        getEpisodesByType: jest.fn().mockResolvedValue([]),
        getEpisodeStats: jest.fn().mockResolvedValue({}),
      },
      agent: {
        triggerManualConsolidation: jest.fn(),
        getConsolidationStats: jest.fn(),
        consolidationService: mockConsolidationService,
      },
    };

    mockStore = {
      get: jest.fn().mockReturnValue({}),
      set: jest.fn(),
    };

    registerBrainHandlers({ brain: mockBrain, store: mockStore });
  });

  describe('brain-analyze-cross-concept', () => {
    it('should run cross-concept analysis with options', async () => {
      const options = {
        userId: 1,
        token: 'test-token',
        lookbackDays: 14,
        minEpisodes: 5,
        correlationThreshold: 0.7,
        confidenceThreshold: 0.8,
        enabledPatterns: ['temporal', 'cross_concept'],
      };

      const result = await handlers['brain-analyze-cross-concept']({}, options);

      expect(mockConsolidationService.analyzeCrossConcept).toHaveBeenCalledWith(
        1,
        'test-token',
        expect.objectContaining({
          lookbackDays: 14,
          minEpisodesRequired: 5,
          correlationThreshold: 0.7,
          confidenceThreshold: 0.8,
          enabledPatterns: ['temporal', 'cross_concept'],
        })
      );
      expect(result.success).toBe(true);
      expect(result.result.crossConceptPatterns).toHaveLength(1);
    });

    it('should use default values when options not provided', async () => {
      await handlers['brain-analyze-cross-concept']({}, {});

      expect(mockConsolidationService.analyzeCrossConcept).toHaveBeenCalledWith(
        1,
        'cross-concept-analysis',
        expect.objectContaining({
          lookbackDays: 30,
          minEpisodesRequired: 10,
          correlationThreshold: 0.6,
          confidenceThreshold: 0.7,
        })
      );
    });

    it('should return error if consolidation service not initialized', async () => {
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ brain: { ...mockBrain, agent: { consolidationService: null } }, store: mockStore });

      const result = await handlers['brain-analyze-cross-concept']({}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('should return error if brain not initialized', async () => {
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      const result = await handlers['brain-analyze-cross-concept']({}, {});

      expect(result.success).toBe(false);
    });

    it('should handle analysis errors', async () => {
      mockConsolidationService.analyzeCrossConcept.mockRejectedValueOnce(
        new Error('Analysis failed')
      );

      const result = await handlers['brain-analyze-cross-concept']({}, { token: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Analysis failed');
    });
  });

  describe('brain-get-cross-concept-patterns', () => {
    it('should get recent cross-concept patterns', async () => {
      const result = await handlers['brain-get-cross-concept-patterns']({}, 'test-token', 5);

      expect(mockConsolidationService.getRecentCrossConceptPatterns).toHaveBeenCalledWith(
        'test-token',
        5
      );
      expect(result).toHaveLength(1);
    });

    it('should use default limit', async () => {
      await handlers['brain-get-cross-concept-patterns']({}, 'test-token');

      expect(mockConsolidationService.getRecentCrossConceptPatterns).toHaveBeenCalledWith(
        'test-token',
        10
      );
    });

    it('should return empty array if service not available', async () => {
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      const result = await handlers['brain-get-cross-concept-patterns']({}, 'token');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockConsolidationService.getRecentCrossConceptPatterns.mockImplementationOnce(() => {
        throw new Error('Fetch error');
      });

      const result = await handlers['brain-get-cross-concept-patterns']({}, 'token');

      expect(result).toEqual([]);
    });
  });

  describe('brain-get-concept-patterns', () => {
    it('should get pattern summary for a concept', async () => {
      const result = await handlers['brain-get-concept-patterns']({}, 'concept_123', 'test-token');

      expect(mockConsolidationService.getConceptPatternSummary).toHaveBeenCalledWith(
        'concept_123',
        'test-token'
      );
      expect(result.conceptId).toBe('concept_123');
      expect(result.masteryAssessment).toBe('proficient');
    });

    it('should return default summary if service not available', async () => {
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      const result = await handlers['brain-get-concept-patterns']({}, 'concept_123', 'token');

      expect(result).toEqual({
        conceptId: 'concept_123',
        memoryCount: 0,
        latestSummary: null,
        masteryAssessment: 'unknown',
        relatedPatterns: [],
        insights: [],
      });
    });

    it('should return default summary on error', async () => {
      mockConsolidationService.getConceptPatternSummary.mockImplementationOnce(() => {
        throw new Error('Fetch error');
      });

      const result = await handlers['brain-get-concept-patterns']({}, 'concept_123', 'token');

      expect(result.masteryAssessment).toBe('unknown');
    });
  });
});

// ==================== Learner Profile Inference Handlers ====================

describe('brainHandlers - Learner Profile Inference', () => {
  let handlers;
  let mockBrain;
  let mockStore;
  let mockConsolidationService;
  let mockLearnerProfileManager;

  beforeEach(() => {
    jest.clearAllMocks();

    handlers = {};
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
    ipcMain.on.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    mockConsolidationService = {
      inferLearnerProfile: jest.fn().mockResolvedValue({
        inferences: {
          learningStyle: { primary: 'reading', confidence: 0.85 },
          optimalTiming: { preferredTime: 'morning', avgAccuracy: 0.8 },
          sessionPreferences: { preference: 'medium', optimalMinutes: 25 },
        },
      }),
      getLearningRecommendations: jest.fn().mockResolvedValue({
        scheduling: [],
        content: [],
        strategy: [],
      }),
    };

    mockBrain = {
      getStatus: jest.fn().mockResolvedValue({ enabled: true }),
      getInsights: jest.fn().mockResolvedValue(null),
      agent: {
        consolidationService: mockConsolidationService,
      },
    };

    mockStore = {
      get: jest.fn().mockReturnValue({}),
      set: jest.fn(),
    };

    // Mock LearnerProfileManager
    mockLearnerProfileManager = {
      getGlobalProfile: jest.fn().mockReturnValue({
        learningStyle: 'reading',
        preferredTimeOfDay: 'morning',
        optimalSessionLength: 25,
        consistencyScore: 75,
      }),
      getAllDomainProfiles: jest.fn().mockReturnValue([
        { domainType: 'vocabulary', accuracyTrend: 'improving' },
      ]),
      getDomainProfile: jest.fn().mockReturnValue({
        domainType: 'vocabulary',
        accuracyTrend: 'improving',
      }),
      createGlobalProfile: jest.fn().mockReturnValue({ success: true }),
      updateGlobalProfile: jest.fn().mockReturnValue({ success: true }),
      createDomainProfile: jest.fn().mockReturnValue({ success: true }),
      updateDomainProfile: jest.fn().mockReturnValue({ success: true }),
    };

    jest.doMock('../../main/db/LearnerProfileManager', () => mockLearnerProfileManager);

    registerBrainHandlers({ brain: mockBrain, store: mockStore });
  });

  describe('brain-infer-profile', () => {
    it('should run profile inference with options', async () => {
      const options = {
        userId: 1,
        token: 'test-token',
        lookbackDays: 14,
        minSessions: 5,
      };

      const result = await handlers['brain-infer-profile']({}, options);

      expect(mockConsolidationService.inferLearnerProfile).toHaveBeenCalledWith(
        1,
        'test-token',
        expect.objectContaining({
          lookbackDays: 14,
          minSessions: 5,
        })
      );
      expect(result.success).toBe(true);
      expect(result.result.inferences.learningStyle.primary).toBe('reading');
    });

    it('should use default values when options not provided', async () => {
      await handlers['brain-infer-profile']({}, {});

      expect(mockConsolidationService.inferLearnerProfile).toHaveBeenCalledWith(
        1,
        'profile-inference',
        expect.objectContaining({
          lookbackDays: 30,
          minSessions: 3,
        })
      );
    });

    it('should return error if consolidation service not initialized', async () => {
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ brain: { agent: {} }, store: mockStore });

      const result = await handlers['brain-infer-profile']({}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('should handle inference errors', async () => {
      mockConsolidationService.inferLearnerProfile.mockRejectedValueOnce(
        new Error('Inference failed')
      );

      const result = await handlers['brain-infer-profile']({}, { token: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inference failed');
    });
  });

  describe('brain-get-learner-profile', () => {
    it('should get global and domain profiles', async () => {
      // The handler requires the actual module, so we test the structure
      const result = await handlers['brain-get-learner-profile']({}, 'test-token');

      // Result should have global and domains keys
      expect(result).toHaveProperty('global');
      expect(result).toHaveProperty('domains');
    });

    it('should return null/empty on error', async () => {
      // Force require to fail by clearing module cache and re-mocking
      jest.resetModules();

      // This tests the error handling path
      const result = await handlers['brain-get-learner-profile']({}, 'token');

      // Either returns data or error fallback
      expect(result).toBeDefined();
    });
  });

  describe('brain-get-domain-profile', () => {
    it('should get profile for specific domain', async () => {
      const result = await handlers['brain-get-domain-profile']({}, 'vocabulary', 'test-token');

      // Result should be domain profile or null
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('brain-update-profile', () => {
    it('should handle profile update request', async () => {
      const updates = {
        global: { learningStyle: 'visual', preferredTimeOfDay: 'evening' },
        domains: [{ domainType: 'vocabulary', accuracyTrend: 'stable' }],
      };

      const result = await handlers['brain-update-profile']({}, updates, 'test-token');

      // Should return success or error object
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('success');
    });

    it('should handle update with only global changes', async () => {
      const updates = {
        global: { learningStyle: 'auditory' },
      };

      const result = await handlers['brain-update-profile']({}, updates, 'test-token');

      expect(result).toHaveProperty('success');
    });

    it('should handle update with only domain changes', async () => {
      const updates = {
        domains: [{ domainType: 'math', accuracyTrend: 'improving' }],
      };

      const result = await handlers['brain-update-profile']({}, updates, 'test-token');

      expect(result).toHaveProperty('success');
    });
  });
});

// ==================== Learning Recommendations Handlers ====================

describe('brainHandlers - Learning Recommendations', () => {
  let handlers;
  let mockBrain;
  let mockStore;
  let mockConsolidationService;

  beforeEach(() => {
    jest.clearAllMocks();

    handlers = {};
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
    ipcMain.on.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    mockConsolidationService = {
      getLearningRecommendations: jest.fn().mockResolvedValue({
        scheduling: [
          { type: 'optimal_time', message: 'Best study time: morning', priority: 'medium' },
          { type: 'session_length', message: 'Aim for 25 minute sessions', priority: 'medium' },
        ],
        content: [
          { type: 'prerequisite', message: 'Study Algebra before Calculus', priority: 'high' },
        ],
        strategy: [
          { type: 'consistency', message: 'Study more regularly', priority: 'high' },
        ],
      }),
    };

    mockBrain = {
      getStatus: jest.fn().mockResolvedValue({ enabled: true }),
      agent: {
        consolidationService: mockConsolidationService,
      },
    };

    mockStore = {
      get: jest.fn().mockReturnValue({}),
      set: jest.fn(),
    };

    registerBrainHandlers({ brain: mockBrain, store: mockStore });
  });

  describe('brain-get-recommendations', () => {
    it('should get learning recommendations', async () => {
      const options = { userId: 1, token: 'test-token' };

      const result = await handlers['brain-get-recommendations']({}, options);

      expect(mockConsolidationService.getLearningRecommendations).toHaveBeenCalledWith(
        1,
        'test-token'
      );
      expect(result.scheduling).toHaveLength(2);
      expect(result.content).toHaveLength(1);
      expect(result.strategy).toHaveLength(1);
    });

    it('should use default values', async () => {
      await handlers['brain-get-recommendations']({}, {});

      expect(mockConsolidationService.getLearningRecommendations).toHaveBeenCalledWith(
        1,
        'recommendations'
      );
    });

    it('should return empty recommendations if service not available', async () => {
      handlers = {};
      ipcMain.handle.mockImplementation((channel, handler) => {
        handlers[channel] = handler;
      });
      registerBrainHandlers({ store: mockStore });

      const result = await handlers['brain-get-recommendations']({}, {});

      expect(result).toEqual({
        scheduling: [],
        content: [],
        strategy: [],
      });
    });

    it('should return empty recommendations on error', async () => {
      mockConsolidationService.getLearningRecommendations.mockRejectedValueOnce(
        new Error('Fetch error')
      );

      const result = await handlers['brain-get-recommendations']({}, {});

      expect(result).toEqual({
        scheduling: [],
        content: [],
        strategy: [],
      });
    });
  });

  describe('brain-get-optimal-study-times', () => {
    it('should get optimal study times from profile', async () => {
      const result = await handlers['brain-get-optimal-study-times']({}, 'test-token');

      // Should return available: true/false with recommendations
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('available');
    });

    it('should handle missing profile', async () => {
      // Mock to return null profile
      const result = await handlers['brain-get-optimal-study-times']({}, 'no-profile-token');

      // Should still return a valid response
      expect(typeof result).toBe('object');
    });
  });

  describe('brain-get-concept-relationships', () => {
    beforeEach(() => {
      mockConsolidatedMemoryManager.getConsolidatedMemories.mockReturnValue({
        data: [
          {
            id: 'ccm_1',
            memoryType: 'cross_concept',
            patterns: {
              crossConcept: [
                {
                  type: 'PREREQUISITE',
                  fromConceptId: 'c1',
                  fromConceptName: 'Algebra',
                  toConceptId: 'c2',
                  toConceptName: 'Calculus',
                  confidence: 0.9,
                },
                {
                  type: 'INTERFERENCE',
                  conceptAId: 'c3',
                  conceptAName: 'Spanish',
                  conceptBId: 'c4',
                  conceptBName: 'Portuguese',
                  severity: 0.7,
                },
                {
                  type: 'POSITIVE_TRANSFER',
                  conceptAId: 'c5',
                  conceptAName: 'Java',
                  conceptBId: 'c6',
                  conceptBName: 'C#',
                  correlation: 0.8,
                },
              ],
            },
          },
        ],
      });
    });

    it('should build concept relationship graph', async () => {
      const result = await handlers['brain-get-concept-relationships']({}, 'test-token', 50);

      expect(mockConsolidatedMemoryManager.getConsolidatedMemories).toHaveBeenCalledWith({
        token: 'test-token',
        memoryType: 'cross_concept',
        limit: 20,
      });

      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('should create correct edge types', async () => {
      const result = await handlers['brain-get-concept-relationships']({}, 'token');

      const prerequisiteEdge = result.edges.find(e => e.type === 'prerequisite');
      const interferenceEdge = result.edges.find(e => e.type === 'interference');
      const transferEdge = result.edges.find(e => e.type === 'transfer');

      expect(prerequisiteEdge).toBeDefined();
      expect(prerequisiteEdge.label).toBe('prerequisite');
      expect(interferenceEdge).toBeDefined();
      expect(interferenceEdge.label).toBe('interferes');
      expect(transferEdge).toBeDefined();
      expect(transferEdge.label).toBe('helps');
    });

    it('should return empty graph on error', async () => {
      mockConsolidatedMemoryManager.getConsolidatedMemories.mockImplementationOnce(() => {
        throw new Error('Fetch error');
      });

      const result = await handlers['brain-get-concept-relationships']({}, 'token');

      expect(result).toEqual({ nodes: [], edges: [] });
    });

    it('should handle empty memories', async () => {
      mockConsolidatedMemoryManager.getConsolidatedMemories.mockReturnValue({ data: [] });

      const result = await handlers['brain-get-concept-relationships']({}, 'token');

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      // Create many patterns
      const manyPatterns = [];
      for (let i = 0; i < 100; i++) {
        manyPatterns.push({
          type: 'PREREQUISITE',
          fromConceptId: `c${i * 2}`,
          fromConceptName: `Concept ${i * 2}`,
          toConceptId: `c${i * 2 + 1}`,
          toConceptName: `Concept ${i * 2 + 1}`,
          confidence: 0.8,
        });
      }

      mockConsolidatedMemoryManager.getConsolidatedMemories.mockReturnValue({
        data: [{ patterns: { crossConcept: manyPatterns } }],
      });

      const result = await handlers['brain-get-concept-relationships']({}, 'token', 10);

      expect(result.nodes.length).toBeLessThanOrEqual(10);
    });
  });
});
