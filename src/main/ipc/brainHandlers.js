/**
 * Brain IPC Handlers
 *
 * Registers IPC handlers for Learning Brain operations.
 * These handlers bridge the renderer process with the brain module.
 */

const { ipcMain } = require('electron');
const { initConsolidatedMemoryTable } = require('../db/ConsolidatedMemoryManager');
const PredictiveInsightsService = require('../utils/PredictiveInsightsService');
const SummarizationGraphService = require('../utils/SummarizationGraphService');

/**
 * Register brain IPC handlers
 * @param {Object} services - Service dependencies
 * @param {Object} services.brain - Learning brain instance
 * @param {Object} services.store - electron-store instance
 */
function registerBrainHandlers(services = {}) {
  const { brain, store } = services;

  // Initialize PredictiveInsightsService
  let predictiveInsights = null;
  try {
    predictiveInsights = new PredictiveInsightsService({
      episodeCollector: brain?.episodeCollector,
      sessionAnalyticsManager: brain?.sessionAnalyticsManager,
      learningPlanManager: brain?.learningPlanManager,
      learnerProfileManager: brain?.learnerProfileManager,
      neo4jAdapter: brain?.neo4jAdapter,
      graphInterface: brain?.graphInterface,
    });
  } catch (err) {
    console.error('[brainHandlers] Failed to initialize PredictiveInsightsService:', err);
  }

  // Initialize SummarizationGraphService
  let summarizationGraph = null;
  try {
    summarizationGraph = new SummarizationGraphService({
      neo4jAdapter: brain?.neo4jAdapter,
      store,
    });
  } catch (err) {
    console.error('[brainHandlers] Failed to initialize SummarizationGraphService:', err);
  }

  // Initialize consolidated memory table
  try {
    initConsolidatedMemoryTable();
  } catch (err) {
    console.error('[brainHandlers] Failed to initialize consolidated memory table:', err);
  }

  // ==================== Status & Info ====================

  /**
   * Get brain status
   */
  ipcMain.handle('brain-get-status', async () => {
    if (!brain) {
      return { enabled: false, mode: 'disabled' };
    }
    return brain.getStatus();
  });

  /**
   * Get cached insights (quick, no re-analysis)
   */
  ipcMain.handle('brain-get-insights', async () => {
    if (!brain) {
      return null;
    }
    return brain.getInsights();
  });

  /**
   * Check if brain is enabled
   */
  ipcMain.on('brain-is-enabled', (event) => {
    const config = store?.get('learningBrain', {});
    event.returnValue = config.enabled !== false;
  });

  // ==================== Heartbeat Control ====================

  /**
   * Trigger an immediate heartbeat
   */
  ipcMain.handle('brain-trigger-heartbeat', async () => {
    if (!brain) {
      return { success: false, error: 'Brain not initialized' };
    }

    try {
      const result = await brain.triggerHeartbeat();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get time until next heartbeat
   */
  ipcMain.handle('brain-time-until-next', async () => {
    if (!brain || !brain.scheduler) {
      return null;
    }

    const status = brain.scheduler.getStatus();
    const next = status.nextScheduledHeartbeat;

    if (!next) {
      return null;
    }

    const nextTime = new Date(next);
    const ms = nextTime.getTime() - Date.now();

    return {
      ms,
      nextTime: next,
      human: formatDuration(ms),
    };
  });

  // ==================== Episode Collection ====================

  /**
   * Record a learning episode
   */
  ipcMain.handle('brain-record-episode', async (event, episode) => {
    if (!brain || !brain.episodeCollector) {
      // Store locally if brain not initialized
      const episodes = store?.get('learningBrain.pendingEpisodes', []) || [];
      episodes.push({
        ...episode,
        timestamp: new Date().toISOString(),
        pending: true,
      });
      store?.set('learningBrain.pendingEpisodes', episodes.slice(-100));
      return { success: true, queued: true };
    }

    try {
      const id = brain.recordEpisode(episode);
      return { success: true, id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get recent episodes
   */
  ipcMain.handle('brain-get-episodes', async (event, options = {}) => {
    if (!brain || !brain.episodeCollector) {
      // Return from local storage
      const episodes = store?.get('learningBrain.episodes', []) || [];
      return episodes.slice(-(options.limit || 50));
    }

    try {
      const episodes = await brain.episodeCollector.getRecentEpisodes(options.limit || 50);
      return episodes;
    } catch (error) {
      console.error('[brainHandlers] Get episodes failed:', error);
      return [];
    }
  });

  /**
   * Get episodes by type
   */
  ipcMain.handle('brain-get-episodes-by-type', async (event, eventType, limit = 50) => {
    if (!brain || !brain.episodeCollector) {
      return [];
    }

    try {
      return await brain.episodeCollector.getEpisodesByType(eventType, limit);
    } catch (error) {
      console.error('[brainHandlers] Get episodes by type failed:', error);
      return [];
    }
  });

  // ==================== Configuration ====================

  /**
   * Get brain configuration
   */
  ipcMain.handle('brain-get-config', async () => {
    return store?.get('learningBrain', {}) || {};
  });

  /**
   * Update brain configuration
   */
  ipcMain.handle('brain-set-config', async (event, config) => {
    const current = store?.get('learningBrain', {}) || {};
    const updated = { ...current, ...config };
    store?.set('learningBrain', updated);

    // Notify brain of config change
    if (brain && brain.scheduler && config.heartbeat) {
      brain.scheduler.loadConfig();
      brain.scheduler.scheduleNext();
    }

    return { success: true, config: updated };
  });

  /**
   * Enable/disable brain
   */
  ipcMain.handle('brain-set-enabled', async (event, enabled) => {
    store?.set('learningBrain.enabled', enabled);

    if (!enabled && brain) {
      brain.scheduler?.cancel();
    } else if (enabled && brain) {
      brain.scheduler?.scheduleNext();
    }

    return { success: true, enabled };
  });

  // ==================== Service Management ====================

  /**
   * Get service status
   */
  ipcMain.handle('brain-service-status', async () => {
    try {
      const ServiceInstaller = require('../service/install/ServiceInstaller');
      const installer = new ServiceInstaller();
      return installer.getStatus();
    } catch (error) {
      return {
        installed: false,
        running: false,
        error: error.message,
      };
    }
  });

  /**
   * Install background service
   */
  ipcMain.handle('brain-service-install', async () => {
    try {
      const ServiceInstaller = require('../service/install/ServiceInstaller');
      const installer = new ServiceInstaller();

      // Check dependencies first
      const deps = installer.checkDependencies();
      if (!deps.available) {
        return {
          success: false,
          error: `Missing dependency: ${deps.packageName}. Run: ${deps.installCommand}`,
          fallbackMode: true,
        };
      }

      const result = await installer.install();

      // Update config
      store?.set('learningBrain.service.installed', result.success);
      store?.set('learningBrain.service.installAttempted', true);
      if (!result.success) {
        store?.set('learningBrain.service.lastError', result.error);
      }

      return result;
    } catch (error) {
      store?.set('learningBrain.service.lastError', error.message);
      return {
        success: false,
        error: error.message,
        fallbackMode: true,
      };
    }
  });

  /**
   * Uninstall background service
   */
  ipcMain.handle('brain-service-uninstall', async () => {
    try {
      const ServiceInstaller = require('../service/install/ServiceInstaller');
      const installer = new ServiceInstaller();
      const result = await installer.uninstall();

      store?.set('learningBrain.service.installed', false);

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Start background service
   */
  ipcMain.handle('brain-service-start', async () => {
    try {
      const ServiceInstaller = require('../service/install/ServiceInstaller');
      const installer = new ServiceInstaller();
      return await installer.start();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Stop background service
   */
  ipcMain.handle('brain-service-stop', async () => {
    try {
      const ServiceInstaller = require('../service/install/ServiceInstaller');
      const installer = new ServiceInstaller();
      return await installer.stop();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==================== Heartbeat History ====================

  /**
   * Get heartbeat history
   */
  ipcMain.handle('brain-get-heartbeat-history', async (event, limit = 10) => {
    // Try service client first
    if (brain && brain.scheduler && brain.scheduler.serviceClient) {
      try {
        const history = await brain.scheduler.serviceClient.getHeartbeatHistory(limit);
        return history;
      } catch (e) {
        // Fall through to local storage
      }
    }

    // Local storage fallback
    return store?.get('learningBrain.heartbeatHistory', []).slice(-limit) || [];
  });

  // ==================== Memory Consolidation ====================

  /**
   * Trigger manual memory consolidation
   * Consolidates recent learning episodes into higher-level memories using LLM
   */
  ipcMain.handle('brain-consolidate-now', async (event, options = {}) => {
    if (!brain || !brain.agent) {
      return { success: false, error: 'Brain agent not initialized' };
    }

    try {
      const token = options.token || 'consolidation-manual';
      const result = await brain.agent.triggerManualConsolidation(token, options);
      return result;
    } catch (error) {
      console.error('[brainHandlers] Manual consolidation failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get consolidated memories with filters
   */
  ipcMain.handle('brain-get-memories', async (event, options = {}) => {
    try {
      const consolidatedMemoryManager = require('../db/ConsolidatedMemoryManager');
      return consolidatedMemoryManager.getConsolidatedMemories({
        token: options.token,
        conceptId: options.conceptId,
        conceptName: options.conceptName,
        memoryType: options.memoryType,
        startDate: options.startDate,
        endDate: options.endDate,
        limit: options.limit || 50,
        offset: options.offset || 0,
      });
    } catch (error) {
      console.error('[brainHandlers] Get memories failed:', error);
      return [];
    }
  });

  /**
   * Get a single consolidated memory by ID
   */
  ipcMain.handle('brain-get-memory', async (event, id, token) => {
    try {
      const consolidatedMemoryManager = require('../db/ConsolidatedMemoryManager');
      return consolidatedMemoryManager.getMemoryById(id, token);
    } catch (error) {
      console.error('[brainHandlers] Get memory failed:', error);
      return null;
    }
  });

  /**
   * Search consolidated memories
   */
  ipcMain.handle('brain-search-memories', async (event, query, token, limit = 20) => {
    try {
      const consolidatedMemoryManager = require('../db/ConsolidatedMemoryManager');
      return consolidatedMemoryManager.searchMemories(query, token, limit);
    } catch (error) {
      console.error('[brainHandlers] Search memories failed:', error);
      return [];
    }
  });

  /**
   * Get consolidation statistics
   */
  ipcMain.handle('brain-get-consolidation-stats', async (event, token) => {
    if (brain && brain.agent) {
      return brain.agent.getConsolidationStats(token);
    }

    try {
      const consolidatedMemoryManager = require('../db/ConsolidatedMemoryManager');
      return consolidatedMemoryManager.getConsolidationStats(token);
    } catch (error) {
      console.error('[brainHandlers] Get consolidation stats failed:', error);
      return {
        byType: {},
        totalMemories: 0,
        totalEpisodesConsolidated: 0,
        uniqueConcepts: 0,
        recentConsolidations: 0,
        masteryDistribution: {},
      };
    }
  });

  /**
   * Delete a consolidated memory
   */
  ipcMain.handle('brain-delete-memory', async (event, id, token) => {
    try {
      const consolidatedMemoryManager = require('../db/ConsolidatedMemoryManager');
      return consolidatedMemoryManager.deleteConsolidatedMemory(id, token);
    } catch (error) {
      console.error('[brainHandlers] Delete memory failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Delete old memories (maintenance)
   */
  ipcMain.handle('brain-delete-old-memories', async (event, olderThanDays, token) => {
    try {
      const consolidatedMemoryManager = require('../db/ConsolidatedMemoryManager');
      return consolidatedMemoryManager.deleteOldMemories(olderThanDays, token);
    } catch (error) {
      console.error('[brainHandlers] Delete old memories failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get episode statistics (for consolidation UI)
   */
  ipcMain.handle('brain-get-episode-stats', async (event, userId = 1) => {
    if (!brain || !brain.episodeCollector) {
      return {
        total: 0,
        byType: {},
        processedCount: 0,
        unprocessedCount: 0,
        bufferSize: 0,
      };
    }

    try {
      return await brain.episodeCollector.getEpisodeStats(userId);
    } catch (error) {
      console.error('[brainHandlers] Get episode stats failed:', error);
      return {
        total: 0,
        byType: {},
        processedCount: 0,
        unprocessedCount: 0,
        bufferSize: 0,
      };
    }
  });

  // ==================== Cross-Concept Analysis ====================

  /**
   * Run cross-concept pattern analysis
   * Detects relationships between concepts: prerequisites, interference, positive transfer
   */
  ipcMain.handle('brain-analyze-cross-concept', async (event, options = {}) => {
    if (!brain || !brain.agent || !brain.agent.consolidationService) {
      return { success: false, error: 'Consolidation service not initialized' };
    }

    try {
      const userId = options.userId || 1;
      const token = options.token || 'cross-concept-analysis';
      const result = await brain.agent.consolidationService.analyzeCrossConcept(userId, token, {
        lookbackDays: options.lookbackDays || 30,
        minEpisodesRequired: options.minEpisodes || 10,
        correlationThreshold: options.correlationThreshold || 0.6,
        confidenceThreshold: options.confidenceThreshold || 0.7,
        enabledPatterns: options.enabledPatterns || ['temporal', 'performance', 'cross_concept', 'behavioral'],
      });

      return { success: true, result };
    } catch (error) {
      console.error('[brainHandlers] Cross-concept analysis failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get recent cross-concept patterns
   */
  ipcMain.handle('brain-get-cross-concept-patterns', async (event, token, limit = 10) => {
    if (!brain || !brain.agent || !brain.agent.consolidationService) {
      return [];
    }

    try {
      return brain.agent.consolidationService.getRecentCrossConceptPatterns(token, limit);
    } catch (error) {
      console.error('[brainHandlers] Get cross-concept patterns failed:', error);
      return [];
    }
  });

  /**
   * Get pattern summary for a specific concept
   */
  ipcMain.handle('brain-get-concept-patterns', async (event, conceptId, token) => {
    if (!brain || !brain.agent || !brain.agent.consolidationService) {
      return {
        conceptId,
        memoryCount: 0,
        latestSummary: null,
        masteryAssessment: 'unknown',
        relatedPatterns: [],
        insights: [],
      };
    }

    try {
      return brain.agent.consolidationService.getConceptPatternSummary(conceptId, token);
    } catch (error) {
      console.error('[brainHandlers] Get concept patterns failed:', error);
      return {
        conceptId,
        memoryCount: 0,
        latestSummary: null,
        masteryAssessment: 'unknown',
        relatedPatterns: [],
        insights: [],
      };
    }
  });

  // ==================== Learner Profile Inference ====================

  /**
   * Run learner profile inference
   * Analyzes learning behavior to infer style, preferences, and patterns
   */
  ipcMain.handle('brain-infer-profile', async (event, options = {}) => {
    if (!brain || !brain.agent || !brain.agent.consolidationService) {
      return { success: false, error: 'Consolidation service not initialized' };
    }

    try {
      const userId = options.userId || 1;
      const token = options.token || 'profile-inference';
      const result = await brain.agent.consolidationService.inferLearnerProfile(userId, token, {
        lookbackDays: options.lookbackDays || 30,
        minSessions: options.minSessions || 3,
      });

      return { success: true, result };
    } catch (error) {
      console.error('[brainHandlers] Profile inference failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get current learner profile
   */
  ipcMain.handle('brain-get-learner-profile', async (event, token) => {
    try {
      const learnerProfileManager = require('../db/LearnerProfileManager');
      const globalProfile = learnerProfileManager.getGlobalProfile(token);
      const domainProfiles = learnerProfileManager.getAllDomainProfiles(token);

      return {
        global: globalProfile,
        domains: domainProfiles,
      };
    } catch (error) {
      console.error('[brainHandlers] Get learner profile failed:', error);
      return { global: null, domains: [] };
    }
  });

  /**
   * Get learner profile for a specific domain
   */
  ipcMain.handle('brain-get-domain-profile', async (event, domainType, token) => {
    try {
      const learnerProfileManager = require('../db/LearnerProfileManager');
      return learnerProfileManager.getDomainProfile(domainType, token);
    } catch (error) {
      console.error('[brainHandlers] Get domain profile failed:', error);
      return null;
    }
  });

  /**
   * Update learner profile manually
   */
  ipcMain.handle('brain-update-profile', async (event, updates, token) => {
    try {
      const learnerProfileManager = require('../db/LearnerProfileManager');

      // Update global profile
      if (updates.global) {
        const existing = learnerProfileManager.getGlobalProfile(token);
        if (existing) {
          learnerProfileManager.updateGlobalProfile({
            ...existing,
            ...updates.global,
            lastUpdated: new Date().toISOString(),
          }, token);
        } else {
          learnerProfileManager.createGlobalProfile({
            ...updates.global,
            createdAt: new Date().toISOString(),
          }, token);
        }
      }

      // Update domain profiles
      if (updates.domains && updates.domains.length > 0) {
        for (const domain of updates.domains) {
          const existing = learnerProfileManager.getDomainProfile(domain.domainType, token);
          if (existing) {
            learnerProfileManager.updateDomainProfile(domain.domainType, {
              ...existing,
              ...domain,
              lastUpdated: new Date().toISOString(),
            }, token);
          } else {
            learnerProfileManager.createDomainProfile({
              ...domain,
              createdAt: new Date().toISOString(),
            }, token);
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('[brainHandlers] Update profile failed:', error);
      return { success: false, error: error.message };
    }
  });

  // ==================== Learning Recommendations ====================

  /**
   * Get personalized learning recommendations based on patterns and profile
   */
  ipcMain.handle('brain-get-recommendations', async (event, options = {}) => {
    if (!brain || !brain.agent || !brain.agent.consolidationService) {
      return {
        scheduling: [],
        content: [],
        strategy: [],
      };
    }

    try {
      const userId = options.userId || 1;
      const token = options.token || 'recommendations';
      return await brain.agent.consolidationService.getLearningRecommendations(userId, token);
    } catch (error) {
      console.error('[brainHandlers] Get recommendations failed:', error);
      return {
        scheduling: [],
        content: [],
        strategy: [],
      };
    }
  });

  /**
   * Get optimal study times based on profile
   */
  ipcMain.handle('brain-get-optimal-study-times', async (event, token) => {
    try {
      const learnerProfileManager = require('../db/LearnerProfileManager');
      const profile = learnerProfileManager.getGlobalProfile(token);

      if (!profile) {
        return {
          available: false,
          message: 'Not enough data to determine optimal study times',
        };
      }

      return {
        available: true,
        preferredTimeOfDay: profile.preferredTimeOfDay || 'flexible',
        optimalSessionLength: profile.optimalSessionLength || 20,
        consistencyScore: profile.consistencyScore || 0,
        recommendation: profile.preferredTimeOfDay
          ? `Best study time: ${profile.preferredTimeOfDay}, aim for ${profile.optimalSessionLength} minute sessions`
          : 'Study at any time that works for you, but try to be consistent',
      };
    } catch (error) {
      console.error('[brainHandlers] Get optimal study times failed:', error);
      return { available: false, error: error.message };
    }
  });

  /**
   * Get concept relationship graph data for visualization
   */
  ipcMain.handle('brain-get-concept-relationships', async (event, token, limit = 50) => {
    try {
      const consolidatedMemoryManager = require('../db/ConsolidatedMemoryManager');

      // Get cross-concept memories
      const memories = consolidatedMemoryManager.getConsolidatedMemories({
        token,
        memoryType: 'cross_concept',
        limit: 20,
      });

      const nodes = new Map();
      const edges = [];

      // Extract concept relationships from pattern memories
      for (const memory of memories.data || []) {
        const patterns = memory.patterns || {};

        // Add cross-concept patterns as edges
        for (const pattern of (patterns.crossConcept || [])) {
          if (pattern.type === 'PREREQUISITE') {
            addNode(nodes, pattern.fromConceptId, pattern.fromConceptName);
            addNode(nodes, pattern.toConceptId, pattern.toConceptName);
            edges.push({
              source: pattern.fromConceptId,
              target: pattern.toConceptId,
              type: 'prerequisite',
              confidence: pattern.confidence,
              label: 'prerequisite',
            });
          } else if (pattern.type === 'INTERFERENCE') {
            addNode(nodes, pattern.conceptAId, pattern.conceptAName);
            addNode(nodes, pattern.conceptBId, pattern.conceptBName);
            edges.push({
              source: pattern.conceptAId,
              target: pattern.conceptBId,
              type: 'interference',
              severity: pattern.severity,
              label: 'interferes',
            });
          } else if (pattern.type === 'POSITIVE_TRANSFER') {
            addNode(nodes, pattern.conceptAId, pattern.conceptAName);
            addNode(nodes, pattern.conceptBId, pattern.conceptBName);
            edges.push({
              source: pattern.conceptAId,
              target: pattern.conceptBId,
              type: 'transfer',
              correlation: pattern.correlation,
              label: 'helps',
            });
          }
        }
      }

      return {
        nodes: Array.from(nodes.values()).slice(0, limit),
        edges: edges.slice(0, limit * 2),
      };
    } catch (error) {
      console.error('[brainHandlers] Get concept relationships failed:', error);
      return { nodes: [], edges: [] };
    }
  });

  // ==================== Predictive Insights ====================

  /**
   * Get full predictive insights
   * Returns scheduling, content, and strategy recommendations
   */
  ipcMain.handle('brain-get-predictive-insights', async (event, token, options = {}) => {
    if (!predictiveInsights) {
      return { success: false, error: 'Predictive insights service not initialized' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      const result = await predictiveInsights.getPredictiveInsights(userId, token, options);
      return result;
    } catch (error) {
      console.error('[brainHandlers] Get predictive insights failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get scheduling insights only
   * When and how long to study
   */
  ipcMain.handle('brain-get-scheduling-insights', async (event, token, options = {}) => {
    if (!predictiveInsights) {
      return { success: false, error: 'Predictive insights service not initialized' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      await predictiveInsights.refreshAnalysisCache(userId, token);
      const result = await predictiveInsights.getSchedulingInsights(userId, token, options);
      return { success: true, ...result };
    } catch (error) {
      console.error('[brainHandlers] Get scheduling insights failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get content insights only
   * What to study and in what order
   */
  ipcMain.handle('brain-get-content-insights', async (event, token, options = {}) => {
    if (!predictiveInsights) {
      return { success: false, error: 'Predictive insights service not initialized' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      await predictiveInsights.refreshAnalysisCache(userId, token);
      const result = await predictiveInsights.getContentInsights(userId, token, options);
      return { success: true, ...result };
    } catch (error) {
      console.error('[brainHandlers] Get content insights failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get strategy insights only
   * Spacing, anti-cramming, consistency tips
   */
  ipcMain.handle('brain-get-strategy-insights', async (event, token, options = {}) => {
    if (!predictiveInsights) {
      return { success: false, error: 'Predictive insights service not initialized' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      await predictiveInsights.refreshAnalysisCache(userId, token);
      const result = await predictiveInsights.getStrategyInsights(userId, token, options);
      return { success: true, ...result };
    } catch (error) {
      console.error('[brainHandlers] Get strategy insights failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get optimal review time prediction
   */
  ipcMain.handle('brain-predict-optimal-time', async (event, token) => {
    if (!predictiveInsights) {
      return { success: false, error: 'Predictive insights service not initialized' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      await predictiveInsights.refreshAnalysisCache(userId, token);
      const result = predictiveInsights.predictOptimalReviewTime(predictiveInsights.cachedProfile);
      return { success: true, ...result };
    } catch (error) {
      console.error('[brainHandlers] Predict optimal time failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get due items forecast
   */
  ipcMain.handle('brain-get-due-forecast', async (event, token, options = {}) => {
    if (!predictiveInsights) {
      return { success: false, error: 'Predictive insights service not initialized' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      const result = await predictiveInsights.getDueItemsForecast(userId, token, options);
      return { success: true, ...result };
    } catch (error) {
      console.error('[brainHandlers] Get due forecast failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Check for cramming behavior
   */
  ipcMain.handle('brain-detect-cramming', async (event, token) => {
    if (!predictiveInsights) {
      return { success: false, error: 'Predictive insights service not initialized' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      const result = await predictiveInsights.detectCramming(userId, token);
      return { success: true, ...result };
    } catch (error) {
      console.error('[brainHandlers] Detect cramming failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get consistency analysis
   */
  ipcMain.handle('brain-analyze-consistency', async (event, token) => {
    if (!predictiveInsights) {
      return { success: false, error: 'Predictive insights service not initialized' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      const result = await predictiveInsights.analyzeConsistency(userId, token);
      return { success: true, ...result };
    } catch (error) {
      console.error('[brainHandlers] Analyze consistency failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Clear predictive insights cache
   */
  ipcMain.on('brain-clear-insights-cache', (event) => {
    if (predictiveInsights) {
      predictiveInsights.clearCache();
      event.returnValue = { success: true };
    } else {
      event.returnValue = { success: false };
    }
  });

  /**
   * Update predictive insights config
   */
  ipcMain.on('brain-update-insights-config', (event, config) => {
    if (predictiveInsights) {
      predictiveInsights.updateConfig(config);
      event.returnValue = { success: true };
    } else {
      event.returnValue = { success: false };
    }
  });

  // ==================== Summarization Graph Handlers ====================

  /**
   * Get summarization hierarchy for a concept
   * Returns: concept → memories → episodes
   */
  ipcMain.handle('graph-get-summarization-hierarchy', async (event, { conceptId, token, options }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const hierarchy = await summarizationGraph.getSummarizationHierarchy(conceptId, options);
      return { success: true, data: hierarchy };
    } catch (error) {
      console.error('[brainHandlers] Get summarization hierarchy failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get memories that summarize a concept
   */
  ipcMain.handle('graph-get-memories-for-concept', async (event, { conceptId, token, options }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const memories = await summarizationGraph.getMemoriesForConcept(conceptId, options);
      return { success: true, data: memories };
    } catch (error) {
      console.error('[brainHandlers] Get memories for concept failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get learning timeline for a concept
   */
  ipcMain.handle('graph-get-concept-timeline', async (event, { conceptId, token, limit }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const timeline = await summarizationGraph.getConceptLearningTimeline(conceptId, limit);
      return { success: true, data: timeline };
    } catch (error) {
      console.error('[brainHandlers] Get concept timeline failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get memories related to a specific memory
   */
  ipcMain.handle('graph-get-related-memories', async (event, { memoryId, token, relationType }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const related = await summarizationGraph.getRelatedMemories(memoryId, relationType);
      return { success: true, data: related };
    } catch (error) {
      console.error('[brainHandlers] Get related memories failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get memory chain (prerequisite sequences)
   */
  ipcMain.handle('graph-get-memory-chain', async (event, { memoryId, token, direction, maxDepth }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const chain = await summarizationGraph.getMemoryChain(memoryId, direction, maxDepth);
      return { success: true, data: chain };
    } catch (error) {
      console.error('[brainHandlers] Get memory chain failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get cross-concept memory clusters
   */
  ipcMain.handle('graph-get-cross-concept-clusters', async (event, { token, limit }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      const clusters = await summarizationGraph.getCrossConceptClusters(userId, limit);
      return { success: true, data: clusters };
    } catch (error) {
      console.error('[brainHandlers] Get cross-concept clusters failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get summarization statistics
   */
  ipcMain.handle('graph-get-summarization-stats', async (event, { token }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      const stats = await summarizationGraph.getSummarizationStats(userId);
      return { success: true, data: stats };
    } catch (error) {
      console.error('[brainHandlers] Get summarization stats failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get memory coverage analysis
   */
  ipcMain.handle('graph-get-memory-coverage', async (event, { token, limit }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      const coverage = await summarizationGraph.getMemoryCoverage(userId, limit);
      return { success: true, data: coverage };
    } catch (error) {
      console.error('[brainHandlers] Get memory coverage failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Find gaps in memory coverage
   */
  ipcMain.handle('graph-find-memory-gaps', async (event, { token, daysSinceLastMemory }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      const gaps = await summarizationGraph.findMemoryGaps(userId, daysSinceLastMemory);
      return { success: true, data: gaps };
    } catch (error) {
      console.error('[brainHandlers] Find memory gaps failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Calculate concept mastery from memories
   */
  ipcMain.handle('graph-calculate-concept-mastery', async (event, { conceptId, token }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const mastery = await summarizationGraph.calculateConceptMasteryFromMemories(conceptId);
      return { success: true, data: mastery };
    } catch (error) {
      console.error('[brainHandlers] Calculate concept mastery failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get source episodes for a memory
   */
  ipcMain.handle('graph-get-source-episodes', async (event, { memoryId, token, limit }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const episodes = await summarizationGraph.getSourceEpisodes(memoryId, limit);
      return { success: true, data: episodes };
    } catch (error) {
      console.error('[brainHandlers] Get source episodes failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get concepts for a memory
   */
  ipcMain.handle('graph-get-concepts-for-memory', async (event, { memoryId, token }) => {
    if (!summarizationGraph || !summarizationGraph.isAvailable()) {
      return { success: false, error: 'Summarization graph not available' };
    }

    try {
      const concepts = await summarizationGraph.getConceptsForMemory(memoryId);
      return { success: true, data: concepts };
    } catch (error) {
      console.error('[brainHandlers] Get concepts for memory failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Check if summarization graph is available
   */
  ipcMain.on('graph-summarization-available', (event) => {
    event.returnValue = summarizationGraph?.isAvailable() || false;
  });

  // ==================== Schedule Reconciliation Handlers ====================

  // Lazy-load the schedule reconciliation agent
  let scheduleReconciler = null;
  const getScheduleReconciler = () => {
    if (!scheduleReconciler) {
      try {
        const { ScheduleReconciliationAgent } = require('../brain/ScheduleReconciliationAgent');
        scheduleReconciler = new ScheduleReconciliationAgent({
          aiProvider: services.aiProvider,
          services,
          episodeCollector,
          consolidationService,
          learnerProfileManager,
        });
      } catch (err) {
        console.error('[brainHandlers] Failed to initialize ScheduleReconciliationAgent:', err);
      }
    }
    return scheduleReconciler;
  };

  /**
   * Get due items with LLM-driven reconciliation
   */
  ipcMain.handle('schedule-get-due-reconciled', async (event, { planId, limit, token }) => {
    const reconciler = getScheduleReconciler();
    if (!reconciler) {
      return { success: false, error: 'Schedule reconciliation not available' };
    }

    try {
      const result = await reconciler.getDueItemsReconciled(planId, token, limit || 20);
      return { success: true, ...result };
    } catch (error) {
      console.error('[brainHandlers] Get due reconciled failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Reconcile schedule (full reconciliation with context)
   */
  ipcMain.handle('schedule-reconcile', async (event, { planId, token, options }) => {
    const reconciler = getScheduleReconciler();
    if (!reconciler) {
      return { success: false, error: 'Schedule reconciliation not available' };
    }

    try {
      const result = await reconciler.reconcileSchedule(planId, token, options || {});
      return { success: true, ...result };
    } catch (error) {
      console.error('[brainHandlers] Schedule reconcile failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get overdue items grouped by severity
   */
  ipcMain.handle('schedule-get-overdue-grouped', async (event, { planId, token }) => {
    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      // Get learner profile for personalized thresholds
      let profile = null;
      if (learnerProfileManager) {
        const profileResult = learnerProfileManager.getFullProfile(token);
        if (profileResult && !profileResult.error) {
          profile = profileResult.global;
        }
      }

      // Use LearningPlanManager to get grouped overdue items
      const { getOverdueItemsByGap } = require('../db/LearningPlanManager');
      const grouped = getOverdueItemsByGap(planId, profile);

      return { success: true, ...grouped };
    } catch (error) {
      console.error('[brainHandlers] Get overdue grouped failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Generate a catch-up plan for extended absence
   */
  ipcMain.handle('schedule-generate-catch-up', async (event, { token, options }) => {
    const reconciler = getScheduleReconciler();
    if (!reconciler) {
      return { success: false, error: 'Schedule reconciliation not available' };
    }

    try {
      const { getUserIdFromToken } = require('../db/dbManager');
      const userId = getUserIdFromToken(token);
      if (userId < 0) {
        return { success: false, error: 'Invalid session' };
      }

      // Get learner profile
      let profile = null;
      if (learnerProfileManager) {
        const profileResult = learnerProfileManager.getFullProfile(token);
        if (profileResult && !profileResult.error) {
          profile = profileResult.global;
        }
      }

      // Get all overdue items
      const { getOverdueItemsByGap } = require('../db/LearningPlanManager');
      const grouped = getOverdueItemsByGap(null, profile);

      // Get last session info from learning session manager
      let daysSinceLastSession = null;
      try {
        const LearningSessionManager = require('../db/LearningSessionManager');
        const recentSessions = LearningSessionManager.getRecentSessions(token, 30);
        if (recentSessions && recentSessions.length > 0) {
          const lastSession = recentSessions[0];
          const lastSessionDate = new Date(lastSession.startedAt || lastSession.createdAt);
          daysSinceLastSession = Math.floor((Date.now() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24));
        }
      } catch (sessionErr) {
        console.error('[brainHandlers] Failed to get last session:', sessionErr);
      }

      // Generate catch-up plan using LLM if significant backlog
      if (grouped.total > 10 || daysSinceLastSession > 3) {
        const { createCatchUpPlanPrompt } = require('../../commons/utils/AIPrompts');
        const prompt = createCatchUpPlanPrompt({
          totalOverdueCount: grouped.total,
          daysSinceLastSession,
          profile,
          availableMinutesPerDay: options?.availableMinutesPerDay || 30,
          overdueByDomain: [
            { domain: 'critical', count: grouped.critical.length, avgDaysOverdue: grouped.critical[0]?.daysOverdue || 0 },
            { domain: 'important', count: grouped.important.length, avgDaysOverdue: grouped.important[0]?.daysOverdue || 0 },
            { domain: 'routine', count: grouped.routine.length, avgDaysOverdue: grouped.routine[0]?.daysOverdue || 0 },
          ],
          targetCatchUpDays: options?.targetCatchUpDays || 7,
        });

        // Use AI to generate the catch-up plan
        if (services.aiProvider) {
          const response = await services.aiProvider.generateContentWithJson(prompt);
          return {
            success: true,
            plan: response,
            overdueGrouped: grouped,
            daysSinceLastSession,
            source: 'llm',
          };
        }
      }

      // Simple catch-up plan without LLM
      return {
        success: true,
        plan: {
          totalDays: Math.ceil(grouped.total / 15), // ~15 items per day
          strategy: {
            approach: 'Focus on critical items first, then important, then routine',
            dailyGoal: `Review ${Math.min(15, grouped.total)} items per day`,
          },
          priorityTiers: {
            critical: grouped.critical.length,
            important: grouped.important.length,
            routine: grouped.routine.length,
          },
        },
        overdueGrouped: grouped,
        daysSinceLastSession,
        source: 'basic',
      };
    } catch (error) {
      console.error('[brainHandlers] Generate catch-up plan failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Clear reconciliation cache
   */
  ipcMain.on('schedule-clear-cache', (event) => {
    const reconciler = getScheduleReconciler();
    if (reconciler) {
      reconciler.clearCache();
      event.returnValue = { success: true };
    } else {
      event.returnValue = { success: false };
    }
  });

  /**
   * Check if schedule reconciliation is available
   */
  ipcMain.on('schedule-reconciliation-available', (event) => {
    event.returnValue = !!getScheduleReconciler();
  });

  console.log('[brainHandlers] Registered brain IPC handlers');
}

/**
 * Helper to add nodes to map
 */
function addNode(nodes, id, name) {
  if (id && !nodes.has(id)) {
    nodes.set(id, { id, name: name || id });
  }
}

/**
 * Format duration in human-readable format
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 0) return 'overdue';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

module.exports = { registerBrainHandlers };
