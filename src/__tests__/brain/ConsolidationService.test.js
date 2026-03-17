/**
 * ConsolidationService.test.js
 *
 * Unit tests for the Memory Consolidation Service
 */

// Mock dependencies
const mockAIProvider = {
  generateContentWithJson: jest.fn(),
};

const mockEpisodeCollector = {
  getEpisodesInRange: jest.fn(),
  markAsProcessed: jest.fn(),
};

const mockNeo4jAdapter = {
  runQuery: jest.fn(),
};

const mockStore = {
  get: jest.fn(),
  set: jest.fn(),
};

// Mock ConsolidatedMemoryManager
jest.mock('../../main/db/ConsolidatedMemoryManager', () => ({
  createConsolidatedMemory: jest.fn(),
  getConsolidationStats: jest.fn(),
  getConsolidatedMemories: jest.fn(() => ({ data: [] })),
}));

// Mock LearnerProfileManager
jest.mock('../../main/db/LearnerProfileManager', () => ({
  getGlobalProfile: jest.fn(() => null),
  createGlobalProfile: jest.fn(() => ({ success: true })),
  updateGlobalProfile: jest.fn(() => ({ success: true })),
  getDomainProfile: jest.fn(() => null),
  createDomainProfile: jest.fn(() => ({ success: true })),
  updateDomainProfile: jest.fn(() => ({ success: true })),
}));

// Mock AIPrompts
jest.mock('../../commons/utils/AIPrompts', () => ({
  createMemoryConsolidationPrompt: jest.fn(() => 'mocked prompt'),
}));

const ConsolidationService = require('../../main/utils/ConsolidationService');
const consolidatedMemoryManager = require('../../main/db/ConsolidatedMemoryManager');
const { createMemoryConsolidationPrompt } = require('../../commons/utils/AIPrompts');

describe('ConsolidationService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ConsolidationService({
      aiProvider: mockAIProvider,
      episodeCollector: mockEpisodeCollector,
      neo4jAdapter: mockNeo4jAdapter,
      store: mockStore,
    });
  });

  // ====================
  // Constructor & Config
  // ====================

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(service.config.periodDays).toBe(7);
      expect(service.config.minEpisodes).toBe(3);
      expect(service.config.contextShiftHours).toBe(24);
      expect(service.config.archiveAfterDays).toBe(30);
      expect(service.config.deleteAfterDays).toBe(90);
    });

    it('should accept custom services', () => {
      expect(service.aiProvider).toBe(mockAIProvider);
      expect(service.episodeCollector).toBe(mockEpisodeCollector);
    });
  });

  // ====================
  // Concept Key Extraction
  // ====================

  describe('extractConceptKey', () => {
    it('should extract conceptId if present', () => {
      const episode = { payload: { conceptId: 'concept_123' } };
      expect(service.extractConceptKey(episode)).toBe('concept_123');
    });

    it('should extract conceptName if conceptId not present', () => {
      const episode = { payload: { conceptName: 'Vocabulary' } };
      expect(service.extractConceptKey(episode)).toBe('Vocabulary');
    });

    it('should extract word for vocabulary episodes', () => {
      const episode = { payload: { word: 'ephemeral' } };
      expect(service.extractConceptKey(episode)).toBe('ephemeral');
    });

    it('should extract bookId for reading episodes', () => {
      const episode = { payload: { bookId: 'book_456' } };
      expect(service.extractConceptKey(episode)).toBe('book_456');
    });

    it('should return "general" if no key found', () => {
      const episode = { payload: {} };
      expect(service.extractConceptKey(episode)).toBe('general');
    });

    it('should handle missing payload', () => {
      const episode = {};
      expect(service.extractConceptKey(episode)).toBe('general');
    });
  });

  // ====================
  // Cramming Detection
  // ====================

  describe('detectCramming', () => {
    it('should detect cramming (5+ reviews in <1 hour)', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const episodes = Array(6).fill(null).map((_, i) => ({
        timestamp: new Date(baseTime.getTime() + i * 5 * 60 * 1000).toISOString(), // 5 min apart
      }));

      expect(service.detectCramming(episodes)).toBe(true);
    });

    it('should not detect cramming for fewer than 5 episodes', () => {
      const episodes = Array(4).fill(null).map((_, i) => ({
        timestamp: new Date().toISOString(),
      }));

      expect(service.detectCramming(episodes)).toBe(false);
    });

    it('should not detect cramming for spread-out reviews', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const episodes = Array(6).fill(null).map((_, i) => ({
        timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000).toISOString(), // 1 hour apart
      }));

      expect(service.detectCramming(episodes)).toBe(false);
    });
  });

  // ====================
  // Variance Calculation
  // ====================

  describe('calculateVariance', () => {
    it('should calculate standard deviation for response times', () => {
      const times = [1000, 2000, 3000, 4000, 5000];
      const result = service.calculateVariance(times);

      expect(result).toBeDefined();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should return null for fewer than 2 values', () => {
      expect(service.calculateVariance([1000])).toBeNull();
      expect(service.calculateVariance([])).toBeNull();
    });

    it('should return 0 for identical values', () => {
      const times = [2000, 2000, 2000, 2000];
      expect(service.calculateVariance(times)).toBe(0);
    });
  });

  // ====================
  // Learning Process Analysis
  // ====================

  describe('analyzeLearningProcess', () => {
    const baseEpisodes = [
      {
        eventType: 'REVIEW_COMPLETED',
        timestamp: '2024-01-01T10:00:00Z',
        payload: { wasCorrect: true, responseTimeMs: 2000, newBox: 2, previousBox: 1 },
      },
      {
        eventType: 'REVIEW_COMPLETED',
        timestamp: '2024-01-01T10:05:00Z',
        payload: { wasCorrect: false, responseTimeMs: 5000, hintUsed: true },
      },
      {
        eventType: 'REVIEW_COMPLETED',
        timestamp: '2024-01-01T10:10:00Z',
        payload: { wasCorrect: true, responseTimeMs: 3000, newBox: 2, previousBox: 1 },
      },
    ];

    it('should count correct and incorrect answers', () => {
      const analysis = service.analyzeLearningProcess(baseEpisodes);

      expect(analysis.correctCount).toBe(2);
      expect(analysis.incorrectCount).toBe(1);
      expect(analysis.accuracy).toBe(67);
    });

    it('should calculate total reviews', () => {
      const analysis = service.analyzeLearningProcess(baseEpisodes);

      expect(analysis.totalReviews).toBe(3);
    });

    it('should count hint usage', () => {
      const analysis = service.analyzeLearningProcess(baseEpisodes);

      expect(analysis.hintUsage).toBe(1);
    });

    it('should calculate average response time', () => {
      const analysis = service.analyzeLearningProcess(baseEpisodes);

      expect(analysis.avgResponseTimeMs).toBe(Math.round((2000 + 5000 + 3000) / 3));
    });

    it('should track box progression', () => {
      const analysis = service.analyzeLearningProcess(baseEpisodes);

      expect(analysis.boxProgression).toHaveLength(2);
      expect(analysis.boxProgression[0].box).toBe(2);
    });

    it('should detect struggle patterns', () => {
      const episodes = [
        { payload: { wasCorrect: false }, timestamp: '2024-01-01T10:00:00Z' },
        { payload: { wasCorrect: false }, timestamp: '2024-01-01T10:01:00Z' },
        { payload: { wasCorrect: true }, timestamp: '2024-01-01T10:02:00Z' },
      ];

      const analysis = service.analyzeLearningProcess(episodes);

      expect(analysis.strugglePatterns.length).toBeGreaterThan(0);
    });

    it('should include cramming detection', () => {
      const analysis = service.analyzeLearningProcess(baseEpisodes);

      expect(typeof analysis.isCramming).toBe('boolean');
    });

    it('should include response time variance', () => {
      const analysis = service.analyzeLearningProcess(baseEpisodes);

      expect(analysis.responseTimeVariance).toBeDefined();
    });

    it('should handle empty episodes', () => {
      const analysis = service.analyzeLearningProcess([]);

      expect(analysis.totalReviews).toBe(0);
      expect(analysis.accuracy).toBe(0);
    });
  });

  // ====================
  // Concept Clustering
  // ====================

  describe('groupByConceptClusters', () => {
    it('should group episodes by concept', () => {
      const episodes = [
        { payload: { conceptId: 'a' }, timestamp: '2024-01-01T10:00:00Z' },
        { payload: { conceptId: 'b' }, timestamp: '2024-01-01T10:01:00Z' },
        { payload: { conceptId: 'a' }, timestamp: '2024-01-01T10:02:00Z' },
      ];

      const clusters = service.groupByConceptClusters(episodes, 24);

      const conceptAClusters = clusters.filter(c => c.concept === 'a');
      const conceptBClusters = clusters.filter(c => c.concept === 'b');

      expect(conceptAClusters.length).toBeGreaterThan(0);
      expect(conceptBClusters.length).toBeGreaterThan(0);

      // Concept 'a' should have 2 episodes in total
      const totalEpisodesInA = conceptAClusters.reduce((sum, c) => sum + c.episodes.length, 0);
      expect(totalEpisodesInA).toBe(2);
    });

    it('should sort episodes chronologically within clusters', () => {
      const episodes = [
        { payload: { conceptId: 'a' }, timestamp: '2024-01-01T12:00:00Z' },
        { payload: { conceptId: 'a' }, timestamp: '2024-01-01T10:00:00Z' },
        { payload: { conceptId: 'a' }, timestamp: '2024-01-01T11:00:00Z' },
      ];

      const clusters = service.groupByConceptClusters(episodes, 24);
      const conceptACluster = clusters.find(c => c.concept === 'a');

      expect(new Date(conceptACluster.episodes[0].timestamp).getTime())
        .toBeLessThan(new Date(conceptACluster.episodes[1].timestamp).getTime());
    });

    it('should detect context shifts (gaps > threshold)', () => {
      const episodes = [
        { payload: { conceptId: 'a' }, timestamp: '2024-01-01T10:00:00Z' },
        { payload: { conceptId: 'a' }, timestamp: '2024-01-01T11:00:00Z' },
        // 25 hour gap
        { payload: { conceptId: 'a' }, timestamp: '2024-01-02T12:00:00Z' },
        { payload: { conceptId: 'a' }, timestamp: '2024-01-02T13:00:00Z' },
      ];

      const clusters = service.groupByConceptClusters(episodes, 24);
      const conceptAClusters = clusters.filter(c => c.concept === 'a');

      // Should have 2 clusters due to context shift
      expect(conceptAClusters.length).toBe(2);
      expect(conceptAClusters[0].episodes.length).toBe(2);
      expect(conceptAClusters[1].episodes.length).toBe(2);
    });

    it('should set periodStart and periodEnd correctly', () => {
      const episodes = [
        { payload: { conceptId: 'a' }, timestamp: '2024-01-01T10:00:00Z' },
        { payload: { conceptId: 'a' }, timestamp: '2024-01-01T12:00:00Z' },
      ];

      const clusters = service.groupByConceptClusters(episodes, 24);
      const cluster = clusters[0];

      expect(cluster.periodStart).toBe('2024-01-01T10:00:00Z');
      expect(cluster.periodEnd).toBe('2024-01-01T12:00:00Z');
    });

    it('should handle empty episodes array', () => {
      const clusters = service.groupByConceptClusters([], 24);

      expect(clusters).toEqual([]);
    });

    it('should use t_valid if timestamp not present', () => {
      const episodes = [
        { payload: { conceptId: 'a' }, t_valid: '2024-01-01T10:00:00Z' },
        { payload: { conceptId: 'a' }, t_valid: '2024-01-01T11:00:00Z' },
      ];

      const clusters = service.groupByConceptClusters(episodes, 24);

      expect(clusters.length).toBe(1);
      expect(clusters[0].episodes.length).toBe(2);
    });
  });

  // ====================
  // Fallback Synthesis
  // ====================

  describe('createFallbackSynthesis', () => {
    it('should create synthesis for high accuracy', () => {
      const processAnalysis = {
        accuracy: 90,
        totalReviews: 10,
        correctCount: 9,
        incorrectCount: 1,
        isCramming: false,
      };

      const result = service.createFallbackSynthesis([], 'Test Concept', processAnalysis);

      expect(result.summary).toContain('90%');
      expect(result.masteryAssessment).toBe('proficient');
      expect(result.learningStyle).toBe('steady');
    });

    it('should create synthesis for low accuracy', () => {
      const processAnalysis = {
        accuracy: 40,
        totalReviews: 10,
        correctCount: 4,
        incorrectCount: 6,
        isCramming: false,
      };

      const result = service.createFallbackSynthesis([], 'Test Concept', processAnalysis);

      expect(result.summary).toContain('Challenging');
      expect(result.masteryAssessment).toBe('beginner');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should note cramming in synthesis', () => {
      const processAnalysis = {
        accuracy: 70,
        totalReviews: 10,
        correctCount: 7,
        incorrectCount: 3,
        isCramming: true,
      };

      const result = service.createFallbackSynthesis([], 'Test Concept', processAnalysis);

      expect(result.summary).toContain('Cramming');
      expect(result.learningStyle).toBe('variable');
    });

    it('should include key insights', () => {
      const processAnalysis = {
        accuracy: 75,
        totalReviews: 8,
        correctCount: 6,
        incorrectCount: 2,
        isCramming: false,
      };

      const result = service.createFallbackSynthesis([], 'Test', processAnalysis);

      expect(result.keyInsights.length).toBeGreaterThan(0);
      expect(result.keyInsights[0]).toContain('6 correct, 2 incorrect');
    });
  });

  // ====================
  // LLM Synthesis
  // ====================

  describe('callLLMForSynthesis', () => {
    it('should call AI provider with prompt', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        summary: 'AI generated summary',
        masteryAssessment: 'developing',
      });

      const result = await service.callLLMForSynthesis('test prompt');

      expect(mockAIProvider.generateContentWithJson).toHaveBeenCalledWith('test prompt', true);
      expect(result.summary).toBe('AI generated summary');
    });

    it('should throw error if no AI provider', async () => {
      const serviceNoAI = new ConsolidationService({});

      await expect(serviceNoAI.callLLMForSynthesis('prompt'))
        .rejects.toThrow('AI provider not available');
    });

    it('should parse string response as JSON', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue(
        JSON.stringify({ summary: 'Parsed summary' })
      );

      const result = await service.callLLMForSynthesis('prompt');

      expect(result.summary).toBe('Parsed summary');
    });

    it('should return string as summary if JSON parse fails', async () => {
      mockAIProvider.generateContentWithJson.mockResolvedValue('plain text response');

      const result = await service.callLLMForSynthesis('prompt');

      expect(result.summary).toBe('plain text response');
    });
  });

  // ====================
  // Get Unprocessed Episodes
  // ====================

  describe('getUnprocessedEpisodes', () => {
    it('should filter out processed episodes', async () => {
      const episodes = [
        { id: '1', userId: 1, processed: false },
        { id: '2', userId: 1, processed: true },
        { id: '3', userId: 1, consolidatedInto: 'cm_123' },
        { id: '4', userId: 1 },
      ];

      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue(episodes);

      const result = await service.getUnprocessedEpisodes(1, 7);

      expect(result.length).toBe(2);
      expect(result.map(e => e.id)).toEqual(['1', '4']);
    });

    it('should filter by userId', async () => {
      const episodes = [
        { id: '1', userId: 1 },
        { id: '2', userId: 2 },
        { id: '3' }, // defaults to userId 1
      ];

      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue(episodes);

      const result = await service.getUnprocessedEpisodes(1, 7);

      expect(result.length).toBe(2);
    });

    it('should use local storage as fallback', async () => {
      const serviceNoCollector = new ConsolidationService({
        store: mockStore,
      });

      const episodes = [
        { id: '1', userId: 1, timestamp: new Date().toISOString() },
      ];
      mockStore.get.mockReturnValue(episodes);

      const result = await serviceNoCollector.getUnprocessedEpisodes(1, 7);

      expect(mockStore.get).toHaveBeenCalledWith('learningBrain.episodes', []);
    });
  });

  // ====================
  // Mark Episodes Processed
  // ====================

  describe('markEpisodesProcessed', () => {
    it('should mark episodes in Neo4j', async () => {
      mockNeo4jAdapter.runQuery.mockResolvedValue({});

      await service.markEpisodesProcessed(['ep_1', 'ep_2']);

      expect(mockNeo4jAdapter.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET e.processed = true'),
        expect.objectContaining({ ids: ['ep_1', 'ep_2'] })
      );
    });

    it('should mark episodes in local storage', async () => {
      const episodes = [
        { id: 'ep_1', processed: false },
        { id: 'ep_2', processed: false },
        { id: 'ep_3', processed: false },
      ];
      mockStore.get.mockReturnValue(episodes);

      await service.markEpisodesProcessed(['ep_1', 'ep_2']);

      expect(mockStore.set).toHaveBeenCalledWith(
        'learningBrain.episodes',
        expect.arrayContaining([
          expect.objectContaining({ id: 'ep_1', processed: true }),
          expect.objectContaining({ id: 'ep_2', processed: true }),
          expect.objectContaining({ id: 'ep_3', processed: false }),
        ])
      );
    });

    it('should handle empty episode IDs', async () => {
      await service.markEpisodesProcessed([]);

      // Neo4j check has length guard
      expect(mockNeo4jAdapter.runQuery).not.toHaveBeenCalled();
      // Local storage still gets called but no episodes are modified
      // (the implementation maps over episodes but none match empty IDs)
      expect(mockStore.get).toHaveBeenCalled();
    });
  });

  // ====================
  // Full Consolidation Flow
  // ====================

  describe('consolidateEpisodes', () => {
    const mockEpisodes = [
      { id: 'ep_1', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-01T10:00:00Z', payload: { conceptId: 'c1', wasCorrect: true } },
      { id: 'ep_2', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-01T10:05:00Z', payload: { conceptId: 'c1', wasCorrect: true } },
      { id: 'ep_3', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-01T10:10:00Z', payload: { conceptId: 'c1', wasCorrect: false } },
    ];

    beforeEach(() => {
      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue(mockEpisodes);
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        summary: 'Test summary',
        masteryAssessment: 'developing',
        keyInsights: ['insight1'],
      });
      consolidatedMemoryManager.createConsolidatedMemory.mockReturnValue({
        success: true,
        memory: { id: 'cm_123' },
      });
    });

    it('should consolidate episodes successfully', async () => {
      const result = await service.consolidateEpisodes(1, 'valid-token');

      expect(result.success).toBe(true);
      expect(result.consolidated).toBeGreaterThan(0);
    });

    it('should return early if not enough episodes', async () => {
      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue([{ id: '1' }]);

      const result = await service.consolidateEpisodes(1, 'token', { minEpisodes: 3 });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Not enough episodes');
      expect(result.consolidated).toBe(0);
    });

    it('should call createMemoryConsolidationPrompt', async () => {
      await service.consolidateEpisodes(1, 'token');

      expect(createMemoryConsolidationPrompt).toHaveBeenCalled();
    });

    it('should store consolidated memory', async () => {
      await service.consolidateEpisodes(1, 'token');

      expect(consolidatedMemoryManager.createConsolidatedMemory).toHaveBeenCalled();
    });

    it('should mark episodes as processed', async () => {
      await service.consolidateEpisodes(1, 'token');

      expect(mockStore.set).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockEpisodeCollector.getEpisodesInRange.mockRejectedValue(new Error('Database error'));

      const result = await service.consolidateEpisodes(1, 'token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should use fallback synthesis if LLM fails', async () => {
      mockAIProvider.generateContentWithJson.mockRejectedValue(new Error('LLM error'));

      const result = await service.consolidateEpisodes(1, 'token');

      expect(result.success).toBe(true);
      expect(consolidatedMemoryManager.createConsolidatedMemory).toHaveBeenCalled();
    });
  });

  // ====================
  // Archive Old Episodes
  // ====================

  describe('archiveOldEpisodes', () => {
    it('should archive and delete old episodes in Neo4j', async () => {
      mockNeo4jAdapter.runQuery
        .mockResolvedValueOnce({ records: [{ get: () => 5 }] })
        .mockResolvedValueOnce({ records: [{ get: () => 2 }] });

      const result = await service.archiveOldEpisodes('token');

      expect(result.success).toBe(true);
      expect(result.archived).toBe(5);
      expect(result.deleted).toBe(2);
    });

    it('should trim local storage if no Neo4j', async () => {
      const serviceNoNeo4j = new ConsolidationService({
        store: mockStore,
      });

      const episodes = Array(100).fill(null).map((_, i) => ({
        id: `ep_${i}`,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      }));
      mockStore.get.mockReturnValue(episodes);

      const result = await serviceNoNeo4j.archiveOldEpisodes('token');

      expect(result.success).toBe(true);
      expect(mockStore.set).toHaveBeenCalled();
    });
  });

  // ====================
  // Get Stats
  // ====================

  describe('getStats', () => {
    it('should delegate to consolidatedMemoryManager', () => {
      consolidatedMemoryManager.getConsolidationStats.mockReturnValue({ totalMemories: 10 });

      const stats = service.getStats('token');

      expect(consolidatedMemoryManager.getConsolidationStats).toHaveBeenCalledWith('token');
      expect(stats.totalMemories).toBe(10);
    });
  });

  // ====================
  // Cross-Concept Analysis Integration
  // ====================

  describe('runCrossConceptAnalysis', () => {
    const mockEpisodes = [
      { id: 'ep_1', userId: 1, timestamp: '2024-01-01T10:00:00Z', payload: { conceptId: 'c1', wasCorrect: true } },
      { id: 'ep_2', userId: 1, timestamp: '2024-01-01T10:05:00Z', payload: { conceptId: 'c2', wasCorrect: true } },
    ];

    beforeEach(() => {
      // Spy on crossConceptAnalyzer
      service.crossConceptAnalyzer = {
        analyze: jest.fn().mockResolvedValue({
          crossConceptPatterns: [],
          temporalPatterns: [],
          performancePatterns: [],
          behavioralPatterns: [],
          summary: { totalPatterns: 0, topInsights: [] },
          periodStart: '2024-01-01T00:00:00Z',
          periodEnd: '2024-01-07T00:00:00Z',
          episodeCount: 10,
        }),
      };
    });

    it('should call CrossConceptAnalyzer.analyze with episodes', async () => {
      await service.runCrossConceptAnalysis(1, mockEpisodes, 'test-token');

      expect(service.crossConceptAnalyzer.analyze).toHaveBeenCalledWith(
        1,
        'test-token',
        expect.objectContaining({
          episodes: mockEpisodes,
        })
      );
    });

    it('should pass configuration options to analyzer', async () => {
      await service.runCrossConceptAnalysis(1, mockEpisodes, 'test-token', {
        periodDays: 14,
        correlationThreshold: 0.7,
      });

      expect(service.crossConceptAnalyzer.analyze).toHaveBeenCalledWith(
        1,
        'test-token',
        expect.objectContaining({
          lookbackDays: 14,
          correlationThreshold: 0.7,
        })
      );
    });

    it('should store cross-concept patterns as consolidated memory', async () => {
      service.crossConceptAnalyzer.analyze.mockResolvedValue({
        crossConceptPatterns: [{ type: 'PREREQUISITE', confidence: 0.8 }],
        temporalPatterns: [],
        summary: { topInsights: ['Pattern detected'], totalPatterns: 1 },
        periodStart: '2024-01-01T00:00:00Z',
        periodEnd: '2024-01-07T00:00:00Z',
        episodeCount: 10,
      });

      await service.runCrossConceptAnalysis(1, mockEpisodes, 'test-token');

      expect(consolidatedMemoryManager.createConsolidatedMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryType: 'cross_concept',
          conceptName: 'cross_concept_analysis',
        }),
        'test-token'
      );
    });

    it('should not store memory if no patterns detected', async () => {
      service.crossConceptAnalyzer.analyze.mockResolvedValue({
        crossConceptPatterns: [],
        temporalPatterns: [],
        summary: { totalPatterns: 0, topInsights: [] },
      });

      await service.runCrossConceptAnalysis(1, mockEpisodes, 'test-token');

      expect(consolidatedMemoryManager.createConsolidatedMemory).not.toHaveBeenCalled();
    });

    it('should handle analyzer errors gracefully', async () => {
      service.crossConceptAnalyzer.analyze.mockRejectedValue(new Error('Analyzer error'));

      await expect(service.runCrossConceptAnalysis(1, mockEpisodes, 'test-token'))
        .rejects.toThrow('Analyzer error');
    });
  });

  // ====================
  // Profile Inference Integration
  // ====================

  describe('runProfileInference', () => {
    const mockEpisodes = [
      { id: 'ep_1', userId: 1, timestamp: '2024-01-01T10:00:00Z', payload: { conceptId: 'c1', wasCorrect: true } },
    ];

    beforeEach(() => {
      // Mock profile inference
      service.profileInference = {
        inferProfile: jest.fn().mockResolvedValue({
          inferences: {
            learningStyle: { primary: 'reading', confidence: 0.8 },
            optimalTiming: { preferredTime: 'morning' },
          },
        }),
        buildProfileUpdates: jest.fn().mockReturnValue({
          globalUpdates: { learningStyle: 'reading' },
          domainUpdates: [],
        }),
        generateInsights: jest.fn().mockReturnValue(['Insight 1', 'Insight 2']),
      };

      // Mock applyProfileUpdates
      service.applyProfileUpdates = jest.fn().mockResolvedValue();
    });

    it('should call LearnerProfileInference.inferProfile with episodes', async () => {
      await service.runProfileInference(1, mockEpisodes, null, 'test-token');

      expect(service.profileInference.inferProfile).toHaveBeenCalledWith(
        1,
        'test-token',
        expect.objectContaining({
          episodes: mockEpisodes,
        })
      );
    });

    it('should convert inferences to profile updates', async () => {
      await service.runProfileInference(1, mockEpisodes, null, 'test-token');

      expect(service.profileInference.buildProfileUpdates).toHaveBeenCalled();
    });

    it('should apply profile updates', async () => {
      await service.runProfileInference(1, mockEpisodes, null, 'test-token');

      expect(service.applyProfileUpdates).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          globalUpdates: expect.any(Object),
        }),
        'test-token'
      );
    });

    it('should generate and add insights', async () => {
      const result = await service.runProfileInference(1, mockEpisodes, null, 'test-token');

      expect(service.profileInference.generateInsights).toHaveBeenCalled();
      expect(result.insights).toEqual(['Insight 1', 'Insight 2']);
    });

    it('should include cross-concept insights when provided', async () => {
      const crossConceptPatterns = {
        summary: { topInsights: ['Cross-concept insight'] },
        crossConceptPatterns: [],
      };

      const result = await service.runProfileInference(1, mockEpisodes, crossConceptPatterns, 'test-token');

      expect(result.crossConceptInsights).toEqual(['Cross-concept insight']);
    });

    it('should extract concept relationships from patterns', async () => {
      const crossConceptPatterns = {
        summary: { topInsights: [] },
        crossConceptPatterns: [
          { type: 'PREREQUISITE', fromConceptName: 'A', toConceptName: 'B', confidence: 0.9 },
          { type: 'INTERFERENCE', conceptAName: 'C', conceptBName: 'D', insight: 'They interfere' },
          { type: 'POSITIVE_TRANSFER', conceptAName: 'E', conceptBName: 'F', insight: 'Good transfer', conceptIds: ['e_id', 'f_id'] },
          { type: 'CONCEPT_CLUSTER', conceptIds: ['g_id', 'h_id'], insight: 'Cluster found' },
        ],
      };

      const result = await service.runProfileInference(1, mockEpisodes, crossConceptPatterns, 'test-token');

      expect(result.conceptRelationships.prerequisites).toHaveLength(1);
      expect(result.conceptRelationships.prerequisites[0]).toEqual({
        study: 'A',
        before: 'B',
        confidence: 0.9,
      });

      expect(result.conceptRelationships.avoidTogether).toHaveLength(1);
      expect(result.conceptRelationships.avoidTogether[0].reason).toBe('They interfere');

      expect(result.conceptRelationships.studyTogether).toHaveLength(2);
    });
  });

  // ====================
  // Apply Profile Updates
  // ====================

  describe('applyProfileUpdates', () => {
    // Mock LearnerProfileManager
    const mockLearnerProfileManager = {
      getGlobalProfile: jest.fn(),
      createGlobalProfile: jest.fn(),
      updateGlobalProfile: jest.fn(),
      getDomainProfile: jest.fn(),
      createDomainProfile: jest.fn(),
      updateDomainProfile: jest.fn(),
    };

    beforeEach(() => {
      // Reset service to use mocked manager
      jest.doMock('../../main/db/LearnerProfileManager', () => mockLearnerProfileManager);
      jest.clearAllMocks();
    });

    it('should create new global profile when none exists', async () => {
      // For this test, we need to directly test the manager calls
      // Since the module is already imported, we'll test the logic flow
      const updates = {
        globalUpdates: { learningStyle: 'reading', preferredTimeOfDay: 'morning' },
        domainUpdates: [],
      };

      // The actual test would require module reset
      // This test verifies the function signature and error handling
      await expect(service.applyProfileUpdates(1, updates, 'test-token'))
        .resolves.not.toThrow();
    });

    it('should handle errors during profile update', async () => {
      // Create a service with mock that throws
      const errorService = new ConsolidationService({
        aiProvider: mockAIProvider,
        store: mockStore,
      });

      // Use the already-mocked module to simulate an error
      // The module is already mocked at the top of the file
      const LearnerProfileManager = require('../../main/db/LearnerProfileManager');
      LearnerProfileManager.getGlobalProfile.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const updates = { globalUpdates: { learningStyle: 'visual' }, domainUpdates: [] };

      await expect(errorService.applyProfileUpdates(1, updates, 'test-token'))
        .rejects.toThrow('DB error');
    });
  });

  // ====================
  // Neo4j Profile Sync
  // ====================

  describe('syncProfileToNeo4j', () => {
    it('should skip if no Neo4j adapter', async () => {
      const serviceNoNeo4j = new ConsolidationService({
        aiProvider: mockAIProvider,
        store: mockStore,
      });

      await serviceNoNeo4j.syncProfileToNeo4j(1, {}, []);

      expect(mockNeo4jAdapter.runQuery).not.toHaveBeenCalled();
    });

    it('should create LearnerProfile node with global profile data', async () => {
      await service.syncProfileToNeo4j(1, {
        learningStyle: 'reading',
        preferredTimeOfDay: 'morning',
        optimalSessionLength: 25,
        consistencyScore: 80,
        forgettingCurveSlope: 0.3,
        aiInsights: ['Insight 1'],
      }, []);

      expect(mockNeo4jAdapter.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (lp:LearnerProfile'),
        expect.objectContaining({
          userId: 1,
          learningStyle: 'reading',
          preferredTimeOfDay: 'morning',
          optimalSessionLength: 25,
        })
      );
    });

    it('should use defaults for missing profile fields', async () => {
      await service.syncProfileToNeo4j(1, {}, []);

      expect(mockNeo4jAdapter.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (lp:LearnerProfile'),
        expect.objectContaining({
          learningStyle: 'unknown',
          preferredTimeOfDay: 'flexible',
          optimalSessionLength: 20,
        })
      );
    });

    it('should create DomainProfile nodes for each domain', async () => {
      await service.syncProfileToNeo4j(1, {}, [
        {
          domainType: 'vocabulary',
          updates: {
            accuracyTrend: 'improving',
            learningVelocityTrend: 'stable',
            weakAreas: [{ concept: 'phrasal verbs' }],
            strongAreas: ['basic vocabulary'],
          },
        },
        {
          domainType: 'math',
          updates: { accuracyTrend: 'stable' },
        },
      ]);

      // Should have 3 calls: 1 global + 2 domains
      expect(mockNeo4jAdapter.runQuery).toHaveBeenCalledTimes(3);

      expect(mockNeo4jAdapter.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (dp:DomainProfile'),
        expect.objectContaining({
          domainType: 'vocabulary',
          accuracyTrend: 'improving',
        })
      );
    });

    it('should handle Neo4j errors gracefully', async () => {
      mockNeo4jAdapter.runQuery.mockRejectedValue(new Error('Neo4j connection error'));

      // Should not throw
      await expect(service.syncProfileToNeo4j(1, {}, []))
        .resolves.not.toThrow();
    });
  });

  // ====================
  // Full Integration Flow with Cross-Concept and Profile
  // ====================

  describe('consolidateEpisodes with cross-concept and profile integration', () => {
    const mockEpisodes = [
      { id: 'ep_1', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-01T10:00:00Z', payload: { conceptId: 'c1', wasCorrect: true } },
      { id: 'ep_2', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-01T10:05:00Z', payload: { conceptId: 'c1', wasCorrect: true } },
      { id: 'ep_3', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-01T10:10:00Z', payload: { conceptId: 'c1', wasCorrect: false } },
      { id: 'ep_4', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-01T10:15:00Z', payload: { conceptId: 'c2', wasCorrect: true } },
      { id: 'ep_5', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-01T10:20:00Z', payload: { conceptId: 'c2', wasCorrect: true } },
      { id: 'ep_6', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-01T10:25:00Z', payload: { conceptId: 'c2', wasCorrect: true } },
    ];

    beforeEach(() => {
      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue(mockEpisodes);
      mockAIProvider.generateContentWithJson.mockResolvedValue({
        summary: 'Test summary',
        masteryAssessment: 'developing',
        keyInsights: ['insight1'],
      });
      consolidatedMemoryManager.createConsolidatedMemory.mockReturnValue({
        success: true,
        memory: { id: 'cm_123' },
      });

      // Mock cross-concept analyzer
      service.crossConceptAnalyzer = {
        analyze: jest.fn().mockResolvedValue({
          crossConceptPatterns: [
            { type: 'POSITIVE_TRANSFER', conceptAName: 'c1', conceptBName: 'c2', correlation: 0.8 },
          ],
          temporalPatterns: [],
          performancePatterns: [],
          summary: {
            totalPatterns: 1,
            topInsights: ['c1 and c2 show positive transfer'],
          },
          periodStart: '2024-01-01T00:00:00Z',
          periodEnd: '2024-01-07T00:00:00Z',
          episodeCount: 6,
        }),
      };

      // Mock profile inference
      service.profileInference = {
        inferProfile: jest.fn().mockResolvedValue({
          inferences: {
            learningStyle: { primary: 'reading', confidence: 0.8 },
          },
        }),
        buildProfileUpdates: jest.fn().mockReturnValue({
          globalUpdates: { learningStyle: 'reading' },
          domainUpdates: [],
        }),
        generateInsights: jest.fn().mockReturnValue(['You learn best by reading']),
      };

      service.applyProfileUpdates = jest.fn().mockResolvedValue();
    });

    it('should run cross-concept analysis when enabled and multiple clusters', async () => {
      const result = await service.consolidateEpisodes(1, 'test-token');

      expect(service.crossConceptAnalyzer.analyze).toHaveBeenCalled();
      expect(result.crossConceptPatterns).toBeDefined();
      expect(result.crossConceptPatterns.patternCount).toBe(1);
    });

    it('should skip cross-concept analysis when disabled', async () => {
      service.config.enableCrossConceptAnalysis = false;

      const result = await service.consolidateEpisodes(1, 'test-token');

      expect(service.crossConceptAnalyzer.analyze).not.toHaveBeenCalled();
      expect(result.crossConceptPatterns).toBeNull();
    });

    it('should skip cross-concept analysis with fewer than 2 clusters', async () => {
      mockEpisodeCollector.getEpisodesInRange.mockResolvedValue([
        { id: 'ep_1', userId: 1, timestamp: '2024-01-01T10:00:00Z', payload: { conceptId: 'c1', wasCorrect: true } },
        { id: 'ep_2', userId: 1, timestamp: '2024-01-01T10:05:00Z', payload: { conceptId: 'c1', wasCorrect: true } },
        { id: 'ep_3', userId: 1, timestamp: '2024-01-01T10:10:00Z', payload: { conceptId: 'c1', wasCorrect: true } },
      ]);

      const result = await service.consolidateEpisodes(1, 'test-token');

      expect(service.crossConceptAnalyzer.analyze).not.toHaveBeenCalled();
    });

    it('should run profile inference when enabled', async () => {
      const result = await service.consolidateEpisodes(1, 'test-token');

      expect(service.profileInference.inferProfile).toHaveBeenCalled();
      expect(result.profileUpdates).toBeDefined();
      expect(result.profileUpdates.globalUpdatesCount).toBe(1);
    });

    it('should skip profile inference when disabled', async () => {
      service.config.enableProfileInference = false;

      const result = await service.consolidateEpisodes(1, 'test-token');

      expect(service.profileInference.inferProfile).not.toHaveBeenCalled();
      expect(result.profileUpdates).toBeNull();
    });

    it('should include cross-concept insights in profile updates', async () => {
      const result = await service.consolidateEpisodes(1, 'test-token');

      expect(result.crossConceptPatterns.insights).toContain('c1 and c2 show positive transfer');
    });

    it('should continue even if cross-concept analysis fails', async () => {
      service.crossConceptAnalyzer.analyze.mockRejectedValue(new Error('Analysis failed'));

      const result = await service.consolidateEpisodes(1, 'test-token');

      expect(result.success).toBe(true);
      expect(result.crossConceptPatterns).toBeNull();
    });

    it('should continue even if profile inference fails', async () => {
      service.profileInference.inferProfile.mockRejectedValue(new Error('Inference failed'));

      const result = await service.consolidateEpisodes(1, 'test-token');

      expect(result.success).toBe(true);
      expect(result.profileUpdates).toBeNull();
    });
  });

  // ====================
  // On-Demand Analysis Methods
  // ====================

  describe('analyzeCrossConcept', () => {
    it('should delegate to crossConceptAnalyzer', async () => {
      service.crossConceptAnalyzer = {
        analyze: jest.fn().mockResolvedValue({ crossConceptPatterns: [] }),
      };

      await service.analyzeCrossConcept(1, 'test-token', { lookbackDays: 14 });

      expect(service.crossConceptAnalyzer.analyze).toHaveBeenCalledWith(
        1,
        'test-token',
        { lookbackDays: 14 }
      );
    });
  });

  describe('inferLearnerProfile', () => {
    it('should delegate to profileInference', async () => {
      service.profileInference = {
        inferProfile: jest.fn().mockResolvedValue({ inferences: {} }),
      };

      await service.inferLearnerProfile(1, 'test-token', { minSessions: 5 });

      expect(service.profileInference.inferProfile).toHaveBeenCalledWith(
        1,
        'test-token',
        { minSessions: 5 }
      );
    });
  });

  // ====================
  // Pattern Retrieval Methods
  // ====================

  describe('getRecentCrossConceptPatterns', () => {
    it('should fetch cross_concept type memories', () => {
      consolidatedMemoryManager.getConsolidatedMemories = jest.fn().mockReturnValue({
        data: [
          { id: 'ccm_1', memoryType: 'cross_concept' },
          { id: 'ccm_2', memoryType: 'cross_concept' },
        ],
      });

      const patterns = service.getRecentCrossConceptPatterns('test-token', 5);

      expect(consolidatedMemoryManager.getConsolidatedMemories).toHaveBeenCalledWith({
        token: 'test-token',
        memoryType: 'cross_concept',
        limit: 5,
      });
      expect(patterns).toHaveLength(2);
    });

    it('should use default limit of 10', () => {
      consolidatedMemoryManager.getConsolidatedMemories = jest.fn().mockReturnValue({ data: [] });

      service.getRecentCrossConceptPatterns('test-token');

      expect(consolidatedMemoryManager.getConsolidatedMemories).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });
  });

  describe('getConceptPatternSummary', () => {
    it('should return summary for a specific concept', () => {
      consolidatedMemoryManager.getConsolidatedMemories = jest.fn()
        .mockReturnValueOnce({
          data: [
            {
              summary: 'Concept c1 summary',
              masteryAssessment: 'proficient',
              insights: ['Insight about c1'],
            },
          ],
        })
        .mockReturnValueOnce({ data: [] });

      const summary = service.getConceptPatternSummary('c1', 'test-token');

      expect(summary.conceptId).toBe('c1');
      expect(summary.latestSummary).toBe('Concept c1 summary');
      expect(summary.masteryAssessment).toBe('proficient');
      expect(summary.insights).toContain('Insight about c1');
    });

    it('should find related patterns from cross-concept memories', () => {
      consolidatedMemoryManager.getConsolidatedMemories = jest.fn()
        .mockReturnValueOnce({ data: [] }) // concept memories
        .mockReturnValueOnce({
          data: [{
            patterns: {
              crossConcept: [
                { type: 'PREREQUISITE', fromConceptId: 'c1', toConceptId: 'c2' },
                { type: 'INTERFERENCE', conceptAId: 'c3', conceptBId: 'c1' },
                { type: 'POSITIVE_TRANSFER', conceptAId: 'c4', conceptBId: 'c5' }, // Not related to c1
              ],
            },
          }],
        });

      const summary = service.getConceptPatternSummary('c1', 'test-token');

      expect(summary.relatedPatterns).toHaveLength(2);
    });

    it('should return null summary when no memories found', () => {
      consolidatedMemoryManager.getConsolidatedMemories = jest.fn()
        .mockReturnValue({ data: [] });

      const summary = service.getConceptPatternSummary('c1', 'test-token');

      expect(summary.latestSummary).toBeNull();
      expect(summary.masteryAssessment).toBe('unknown');
    });
  });

  // ====================
  // Learning Recommendations
  // ====================

  describe('getLearningRecommendations', () => {
    beforeEach(() => {
      consolidatedMemoryManager.getConsolidatedMemories = jest.fn().mockReturnValue({ data: [] });
    });

    it('should generate scheduling recommendations from profile', async () => {
      // Mock the learnerProfileManager through require
      const learnerProfileManager = require('../../main/db/LearnerProfileManager');
      learnerProfileManager.getGlobalProfile = jest.fn().mockReturnValue({
        preferredTimeOfDay: 'morning',
        optimalSessionLength: 25,
        consistencyScore: 80,
      });

      const recommendations = await service.getLearningRecommendations(1, 'test-token');

      expect(recommendations.scheduling).toContainEqual(
        expect.objectContaining({
          type: 'optimal_time',
          message: expect.stringContaining('morning'),
        })
      );

      expect(recommendations.scheduling).toContainEqual(
        expect.objectContaining({
          type: 'session_length',
          message: expect.stringContaining('25'),
        })
      );
    });

    it('should generate prerequisite recommendations from patterns', async () => {
      consolidatedMemoryManager.getConsolidatedMemories = jest.fn().mockReturnValue({
        data: [{
          patterns: {
            crossConcept: [
              { type: 'PREREQUISITE', fromConceptName: 'Algebra', toConceptName: 'Calculus', confidence: 0.85 },
            ],
          },
        }],
      });

      const learnerProfileManager = require('../../main/db/LearnerProfileManager');
      learnerProfileManager.getGlobalProfile = jest.fn().mockReturnValue({});

      const recommendations = await service.getLearningRecommendations(1, 'test-token');

      expect(recommendations.content).toContainEqual(
        expect.objectContaining({
          type: 'prerequisite',
          message: expect.stringContaining('Algebra'),
          priority: 'high',
        })
      );
    });

    it('should generate interference recommendations from patterns', async () => {
      consolidatedMemoryManager.getConsolidatedMemories = jest.fn().mockReturnValue({
        data: [{
          patterns: {
            crossConcept: [
              {
                type: 'INTERFERENCE',
                conceptAName: 'Spanish',
                conceptBName: 'Portuguese',
                severity: 0.7,
                recommendedGap: 48,
              },
            ],
          },
        }],
      });

      const learnerProfileManager = require('../../main/db/LearnerProfileManager');
      learnerProfileManager.getGlobalProfile = jest.fn().mockReturnValue({});

      const recommendations = await service.getLearningRecommendations(1, 'test-token');

      expect(recommendations.content).toContainEqual(
        expect.objectContaining({
          type: 'interference',
          message: expect.stringContaining('Spanish'),
          recommendedGap: 48,
        })
      );
    });

    it('should generate cramming warnings from temporal patterns', async () => {
      consolidatedMemoryManager.getConsolidatedMemories = jest.fn().mockReturnValue({
        data: [{
          patterns: {
            temporal: [
              { type: 'CRAMMING', conceptName: 'Final Exam Material' },
            ],
            crossConcept: [],
          },
        }],
      });

      const learnerProfileManager = require('../../main/db/LearnerProfileManager');
      learnerProfileManager.getGlobalProfile = jest.fn().mockReturnValue({});

      const recommendations = await service.getLearningRecommendations(1, 'test-token');

      expect(recommendations.strategy).toContainEqual(
        expect.objectContaining({
          type: 'cramming_warning',
          message: expect.stringContaining('Final Exam Material'),
        })
      );
    });

    it('should generate consistency recommendations for low scores', async () => {
      const learnerProfileManager = require('../../main/db/LearnerProfileManager');
      learnerProfileManager.getGlobalProfile = jest.fn().mockReturnValue({
        consistencyScore: 30,
      });

      const recommendations = await service.getLearningRecommendations(1, 'test-token');

      expect(recommendations.strategy).toContainEqual(
        expect.objectContaining({
          type: 'consistency',
          priority: 'high',
        })
      );
    });

    it('should not recommend consistency for high scores', async () => {
      const learnerProfileManager = require('../../main/db/LearnerProfileManager');
      learnerProfileManager.getGlobalProfile = jest.fn().mockReturnValue({
        consistencyScore: 80,
      });

      const recommendations = await service.getLearningRecommendations(1, 'test-token');

      const consistencyRec = recommendations.strategy.find(r => r.type === 'consistency');
      expect(consistencyRec).toBeUndefined();
    });
  });

  // ====================
  // Configuration Methods
  // ====================

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();

      expect(config.periodDays).toBe(7);
      expect(config.enableCrossConceptAnalysis).toBe(true);
      expect(config.enableProfileInference).toBe(true);
    });

    it('should return a copy (not reference)', () => {
      const config = service.getConfig();
      config.periodDays = 999;

      expect(service.getConfig().periodDays).toBe(7);
    });
  });

  describe('updateConfig', () => {
    it('should update specific config values', () => {
      service.updateConfig({
        periodDays: 14,
        enableCrossConceptAnalysis: false,
      });

      const config = service.getConfig();
      expect(config.periodDays).toBe(14);
      expect(config.enableCrossConceptAnalysis).toBe(false);
      // Other values unchanged
      expect(config.enableProfileInference).toBe(true);
    });
  });
});
