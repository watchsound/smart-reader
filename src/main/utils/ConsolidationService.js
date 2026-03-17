/**
 * ConsolidationService.js
 *
 * Memory consolidation service that periodically summarizes raw learning episodes
 * into higher-level memory patterns using LLM synthesis.
 *
 * Inspired by Graphiti/Zep episodic memory consolidation.
 *
 * Features:
 * - Concept clustering with context shift detection
 * - Learning process analysis (progression, struggles, cramming)
 * - Cross-concept pattern detection (prerequisites, interference, transfer)
 * - Learner profile inference (style, timing, pace preferences)
 * - LLM-powered synthesis via AIProviderManager
 * - SQLite storage for consolidated memories
 * - Optional Neo4j sync for knowledge graph integration
 */

const { createMemoryConsolidationPrompt } = require('../../commons/utils/AIPrompts');
const consolidatedMemoryManager = require('../db/ConsolidatedMemoryManager');
const CrossConceptAnalyzer = require('./CrossConceptAnalyzer');
const LearnerProfileInference = require('./LearnerProfileInference');
const learnerProfileManager = require('../db/LearnerProfileManager');
const SummarizationGraphService = require('./SummarizationGraphService');

class ConsolidationService {
  /**
   * @param {Object} services - Required services
   * @param {Object} services.aiProvider - AIProviderManager instance
   * @param {Object} services.episodeCollector - EpisodeCollector instance
   * @param {Object} services.neo4jAdapter - Neo4j adapter (optional)
   * @param {Object} services.store - electron-store instance
   * @param {Object} services.sessionAnalyticsManager - Session analytics manager (optional)
   */
  constructor(services = {}) {
    this.aiProvider = services.aiProvider;
    this.episodeCollector = services.episodeCollector;
    this.neo4jAdapter = services.neo4jAdapter;
    this.store = services.store;
    this.sessionAnalyticsManager = services.sessionAnalyticsManager;

    // Initialize cross-concept analyzer
    this.crossConceptAnalyzer = new CrossConceptAnalyzer({
      aiProvider: this.aiProvider,
      neo4jAdapter: this.neo4jAdapter,
      store: this.store,
    });

    // Initialize learner profile inference
    this.profileInference = new LearnerProfileInference({
      aiProvider: this.aiProvider,
      sessionAnalyticsManager: this.sessionAnalyticsManager,
      store: this.store,
    });

    // Initialize summarization graph service for Neo4j relationships
    this.summarizationGraph = new SummarizationGraphService({
      neo4jAdapter: this.neo4jAdapter,
      store: this.store,
    });

    // Default configuration
    this.config = {
      periodDays: 7,           // Look back period for episodes
      minEpisodes: 3,          // Minimum episodes to consolidate
      contextShiftHours: 24,   // Gap threshold for context shift detection
      archiveAfterDays: 30,    // Archive raw episodes after this many days
      deleteAfterDays: 90,     // Delete raw episodes after this many days
      enableCrossConceptAnalysis: true,  // Enable cross-concept pattern detection
      enableProfileInference: true,       // Enable learner profile inference
    };
  }

  /**
   * Main consolidation entry point
   * @param {number} userId - User ID
   * @param {string} token - User token
   * @param {Object} options - Consolidation options
   * @returns {Object} Consolidation result
   */
  async consolidateEpisodes(userId, token, options = {}) {
    const {
      periodDays = this.config.periodDays,
      minEpisodes = this.config.minEpisodes,
      contextShiftHours = this.config.contextShiftHours,
    } = options;

    console.log(`[ConsolidationService] Starting consolidation for user ${userId}...`);

    try {
      // 1. Fetch unprocessed episodes from the look-back period
      const episodes = await this.getUnprocessedEpisodes(userId, periodDays);

      if (episodes.length < minEpisodes) {
        console.log(`[ConsolidationService] Not enough episodes (${episodes.length} < ${minEpisodes})`);
        return {
          success: true,
          message: `Not enough episodes to consolidate (${episodes.length} found, ${minEpisodes} required)`,
          consolidated: 0,
        };
      }

      console.log(`[ConsolidationService] Found ${episodes.length} episodes to process`);

      // 2. Group by concept clusters with context shift detection
      const clusters = this.groupByConceptClusters(episodes, contextShiftHours);
      console.log(`[ConsolidationService] Created ${clusters.length} concept clusters`);

      // 3. Process each cluster
      const results = [];
      for (const cluster of clusters) {
        if (cluster.episodes.length >= minEpisodes) {
          try {
            const result = await this.consolidateCluster(cluster, userId, token);
            results.push(result);
          } catch (err) {
            console.error(`[ConsolidationService] Error consolidating cluster ${cluster.concept}:`, err);
          }
        }
      }

      // 4. Mark episodes as processed
      const processedIds = results.flatMap((r) => r.sourceEpisodeIds || []);
      if (processedIds.length > 0) {
        await this.markEpisodesProcessed(processedIds);
      }

      console.log(`[ConsolidationService] Consolidated ${results.length} clusters`);

      // 5. Run cross-concept analysis (if enabled and we have enough clusters)
      let crossConceptPatterns = null;
      if (this.config.enableCrossConceptAnalysis && clusters.length >= 2) {
        try {
          console.log('[ConsolidationService] Running cross-concept analysis...');
          crossConceptPatterns = await this.runCrossConceptAnalysis(userId, episodes, token, options);
          console.log(`[ConsolidationService] Found ${crossConceptPatterns?.crossConceptPatterns?.length || 0} cross-concept patterns`);
        } catch (err) {
          console.error('[ConsolidationService] Cross-concept analysis failed:', err);
        }
      }

      // 6. Update learner profile (if enabled)
      let profileUpdates = null;
      if (this.config.enableProfileInference) {
        try {
          console.log('[ConsolidationService] Running learner profile inference...');
          profileUpdates = await this.runProfileInference(userId, episodes, crossConceptPatterns, token, options);
          console.log('[ConsolidationService] Profile updated with', Object.keys(profileUpdates?.globalUpdates || {}).length, 'global updates');
        } catch (err) {
          console.error('[ConsolidationService] Profile inference failed:', err);
        }
      }

      console.log(`[ConsolidationService] Consolidation complete`);

      return {
        success: true,
        consolidated: results.length,
        totalEpisodes: episodes.length,
        results: results.map((r) => ({
          id: r.id,
          conceptName: r.conceptName,
          episodeCount: r.episodeCount,
          summary: r.summary?.substring(0, 100) + '...',
        })),
        crossConceptPatterns: crossConceptPatterns ? {
          patternCount: crossConceptPatterns.crossConceptPatterns?.length || 0,
          temporalPatternCount: crossConceptPatterns.temporalPatterns?.length || 0,
          performancePatternCount: crossConceptPatterns.performancePatterns?.length || 0,
          insights: crossConceptPatterns.summary?.topInsights || [],
        } : null,
        profileUpdates: profileUpdates ? {
          globalUpdatesCount: Object.keys(profileUpdates.globalUpdates || {}).length,
          domainUpdatesCount: profileUpdates.domainUpdates?.length || 0,
          insights: profileUpdates.insights || [],
        } : null,
      };
    } catch (error) {
      console.error('[ConsolidationService] Consolidation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Run cross-concept analysis on episodes
   * @param {number} userId - User ID
   * @param {Array} episodes - All episodes
   * @param {string} token - User token
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis result with patterns
   */
  async runCrossConceptAnalysis(userId, episodes, token, options = {}) {
    const analysisOptions = {
      lookbackDays: options.periodDays || this.config.periodDays,
      minEpisodesRequired: options.minEpisodes || this.config.minEpisodes,
      correlationThreshold: options.correlationThreshold || 0.6,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      enabledPatterns: options.enabledPatterns || ['temporal', 'performance', 'cross_concept', 'behavioral'],
      useAIForSynthesis: this.aiProvider != null,
    };

    // Pass episodes directly to avoid re-fetching
    const result = await this.crossConceptAnalyzer.analyze(userId, token, {
      ...analysisOptions,
      episodes, // Use already-fetched episodes
    });

    // Store cross-concept patterns as a special consolidated memory
    if (result.crossConceptPatterns?.length > 0 || result.temporalPatterns?.length > 0) {
      const patternMemory = {
        id: `ccm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        conceptId: null,
        conceptName: 'cross_concept_analysis',
        memoryType: 'cross_concept',
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        episodeCount: result.episodeCount,
        summary: result.summary?.topInsights?.join('; ') || 'Cross-concept patterns detected',
        insights: result.summary?.topInsights || [],
        patterns: {
          temporal: result.temporalPatterns,
          performance: result.performancePatterns,
          crossConcept: result.crossConceptPatterns,
          behavioral: result.behavioralPatterns,
        },
        metrics: {
          totalPatterns: result.summary?.totalPatterns || 0,
          criticalPatterns: result.summary?.criticalPatterns || 0,
          highPriorityPatterns: result.summary?.highPriorityPatterns || 0,
        },
      };

      try {
        consolidatedMemoryManager.createConsolidatedMemory(patternMemory, token);
      } catch (err) {
        console.warn('[ConsolidationService] Failed to store pattern memory:', err.message);
      }
    }

    return result;
  }

  /**
   * Run learner profile inference and update profile
   * @param {number} userId - User ID
   * @param {Array} episodes - Learning episodes
   * @param {Object} crossConceptPatterns - Cross-concept analysis results
   * @param {string} token - User token
   * @param {Object} options - Inference options
   * @returns {Object} Profile update recommendations
   */
  async runProfileInference(userId, episodes, crossConceptPatterns, token, options = {}) {
    const inferenceOptions = {
      lookbackDays: options.periodDays || this.config.periodDays,
      minSessions: options.minSessions || 3,
      useAIForSynthesis: this.aiProvider != null,
      episodes, // Pass already-fetched episodes
    };

    // Run profile inference
    const inferenceResult = await this.profileInference.inferProfile(userId, token, inferenceOptions);

    // Convert inferences to profile updates
    const profileUpdates = this.profileInference.buildProfileUpdates(inferenceResult.inferences);

    // Add cross-concept pattern insights if available
    if (crossConceptPatterns) {
      profileUpdates.crossConceptInsights = crossConceptPatterns.summary?.topInsights || [];

      // Add concept relationships to profile
      if (crossConceptPatterns.crossConceptPatterns?.length > 0) {
        profileUpdates.conceptRelationships = {
          prerequisites: crossConceptPatterns.crossConceptPatterns
            .filter(p => p.type === 'PREREQUISITE')
            .map(p => ({
              study: p.fromConceptName,
              before: p.toConceptName,
              confidence: p.confidence,
            })),
          avoidTogether: crossConceptPatterns.crossConceptPatterns
            .filter(p => p.type === 'INTERFERENCE')
            .map(p => ({
              conceptA: p.conceptAName,
              conceptB: p.conceptBName,
              reason: p.insight,
            })),
          studyTogether: crossConceptPatterns.crossConceptPatterns
            .filter(p => p.type === 'POSITIVE_TRANSFER' || p.type === 'CONCEPT_CLUSTER')
            .map(p => ({
              concepts: p.conceptIds || [p.conceptAName, p.conceptBName],
              reason: p.insight,
            })),
        };
      }
    }

    // Apply updates to learner profile
    await this.applyProfileUpdates(userId, profileUpdates, token);

    // Generate and add insights
    profileUpdates.insights = this.profileInference.generateInsights(inferenceResult.inferences);

    return profileUpdates;
  }

  /**
   * Apply profile updates to the learner profile in database
   * @param {number} userId - User ID
   * @param {Object} updates - Profile updates
   * @param {string} token - User token
   */
  async applyProfileUpdates(userId, updates, token) {
    try {
      // Get existing profile
      const existingProfile = learnerProfileManager.getGlobalProfile(token);

      // Merge global updates
      const globalUpdates = {
        ...(existingProfile || {}),
        ...updates.globalUpdates,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'consolidation_service',
      };

      // Update or create global profile
      if (existingProfile) {
        learnerProfileManager.updateGlobalProfile(globalUpdates, token);
      } else {
        learnerProfileManager.createGlobalProfile(globalUpdates, token);
      }

      // Apply domain-specific updates
      if (updates.domainUpdates?.length > 0) {
        for (const domainUpdate of updates.domainUpdates) {
          const existingDomain = learnerProfileManager.getDomainProfile(domainUpdate.domainType, token);

          const domainProfile = {
            ...(existingDomain || {}),
            domainType: domainUpdate.domainType,
            ...domainUpdate.updates,
            lastUpdated: new Date().toISOString(),
          };

          if (existingDomain) {
            learnerProfileManager.updateDomainProfile(domainUpdate.domainType, domainProfile, token);
          } else {
            learnerProfileManager.createDomainProfile(domainProfile, token);
          }
        }
      }

      // Sync to Neo4j if available
      if (this.neo4jAdapter) {
        await this.syncProfileToNeo4j(userId, globalUpdates, updates.domainUpdates || []);
      }

      console.log('[ConsolidationService] Profile updates applied successfully');
    } catch (err) {
      console.error('[ConsolidationService] Failed to apply profile updates:', err);
      throw err;
    }
  }

  /**
   * Sync learner profile updates to Neo4j
   * @param {number} userId - User ID
   * @param {Object} globalProfile - Global profile data
   * @param {Array} domainProfiles - Domain profile data
   */
  async syncProfileToNeo4j(userId, globalProfile, domainProfiles) {
    if (!this.neo4jAdapter) return;

    try {
      // Update global profile node
      const globalQuery = `
        MERGE (lp:LearnerProfile {userId: $userId})
        SET lp.learningStyle = $learningStyle,
            lp.preferredTimeOfDay = $preferredTimeOfDay,
            lp.optimalSessionLength = $optimalSessionLength,
            lp.consistencyScore = $consistencyScore,
            lp.forgettingCurveSlope = $forgettingCurveSlope,
            lp.aiInsights = $aiInsights,
            lp.lastUpdated = datetime()
        RETURN lp
      `;

      await this.neo4jAdapter.runQuery(globalQuery, {
        userId,
        learningStyle: globalProfile.learningStyle || 'unknown',
        preferredTimeOfDay: globalProfile.preferredTimeOfDay || 'flexible',
        optimalSessionLength: globalProfile.optimalSessionLength || 20,
        consistencyScore: globalProfile.consistencyScore || 0,
        forgettingCurveSlope: globalProfile.forgettingCurveSlope || 0.5,
        aiInsights: JSON.stringify(globalProfile.aiInsights || []),
      });

      // Update domain profile nodes
      for (const domain of domainProfiles) {
        const domainQuery = `
          MERGE (dp:DomainProfile {userId: $userId, domainType: $domainType})
          SET dp.accuracyTrend = $accuracyTrend,
              dp.learningVelocityTrend = $learningVelocityTrend,
              dp.weakAreas = $weakAreas,
              dp.strongAreas = $strongAreas,
              dp.suggestedFocus = $suggestedFocus,
              dp.lastUpdated = datetime()

          WITH dp
          MATCH (lp:LearnerProfile {userId: $userId})
          MERGE (lp)-[:HAS_DOMAIN]->(dp)

          RETURN dp
        `;

        await this.neo4jAdapter.runQuery(domainQuery, {
          userId,
          domainType: domain.domainType,
          accuracyTrend: domain.updates?.accuracyTrend || 'stable',
          learningVelocityTrend: domain.updates?.learningVelocityTrend || 'stable',
          weakAreas: JSON.stringify(domain.updates?.weakAreas || []),
          strongAreas: JSON.stringify(domain.updates?.strongAreas || []),
          suggestedFocus: JSON.stringify(domain.updates?.suggestedFocus || []),
        });
      }
    } catch (err) {
      console.warn('[ConsolidationService] Neo4j profile sync failed:', err.message);
    }
  }

  /**
   * Get unprocessed episodes from the last N days
   * @param {number} userId - User ID
   * @param {number} periodDays - Look-back period in days
   * @returns {Array} Episodes
   */
  async getUnprocessedEpisodes(userId, periodDays) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Episodes older than 24h (not same-day activity)
    const minAge = new Date();
    minAge.setDate(minAge.getDate() - 1);

    if (this.episodeCollector) {
      const episodes = await this.episodeCollector.getEpisodesInRange(startDate, minAge);

      // Filter by userId and unprocessed
      return episodes.filter((ep) => {
        const epUserId = ep.userId || 1;
        const isProcessed = ep.processed || ep.consolidatedInto;
        return epUserId === userId && !isProcessed;
      });
    }

    // Fallback: try local storage
    if (this.store) {
      const allEpisodes = this.store.get('learningBrain.episodes', []);
      return allEpisodes.filter((ep) => {
        const epDate = new Date(ep.timestamp || ep.t_valid);
        const epUserId = ep.userId || 1;
        const isProcessed = ep.processed || ep.consolidatedInto;
        return epDate >= startDate && epDate <= minAge && epUserId === userId && !isProcessed;
      });
    }

    return [];
  }

  /**
   * Group episodes by concept clusters with context shift detection
   *
   * Two-level grouping:
   * 1. Cluster by conceptId/conceptName
   * 2. Detect context shifts within each cluster (gaps > threshold)
   *
   * @param {Array} episodes - Episodes to group
   * @param {number} contextShiftHours - Hours threshold for context shift
   * @returns {Array} Clusters
   */
  groupByConceptClusters(episodes, contextShiftHours) {
    // Step 1: Cluster by concept
    const conceptClusters = {};
    for (const ep of episodes) {
      const conceptKey = this.extractConceptKey(ep);
      if (!conceptClusters[conceptKey]) {
        conceptClusters[conceptKey] = [];
      }
      conceptClusters[conceptKey].push(ep);
    }

    // Step 2: Sort each cluster by timestamp (chronological)
    for (const key of Object.keys(conceptClusters)) {
      conceptClusters[key].sort((a, b) => {
        const dateA = new Date(a.timestamp || a.t_valid);
        const dateB = new Date(b.timestamp || b.t_valid);
        return dateA - dateB;
      });
    }

    // Step 3: Detect context shifts (gaps > threshold within same concept)
    const result = [];
    for (const [concept, eps] of Object.entries(conceptClusters)) {
      if (eps.length === 0) continue;

      let currentBatch = [eps[0]];

      for (let i = 1; i < eps.length; i++) {
        const prevDate = new Date(eps[i - 1].timestamp || eps[i - 1].t_valid);
        const currDate = new Date(eps[i].timestamp || eps[i].t_valid);
        const gap = currDate - prevDate;
        const hoursGap = gap / (1000 * 60 * 60);

        if (hoursGap > contextShiftHours) {
          // Context shift: new learning session
          if (currentBatch.length > 0) {
            result.push({
              concept,
              episodes: currentBatch,
              sessionIndex: result.length,
              periodStart: currentBatch[0].timestamp || currentBatch[0].t_valid,
              periodEnd: currentBatch[currentBatch.length - 1].timestamp ||
                currentBatch[currentBatch.length - 1].t_valid,
            });
          }
          currentBatch = [];
        }
        currentBatch.push(eps[i]);
      }

      // Don't forget the last batch
      if (currentBatch.length > 0) {
        result.push({
          concept,
          episodes: currentBatch,
          sessionIndex: result.length,
          periodStart: currentBatch[0].timestamp || currentBatch[0].t_valid,
          periodEnd: currentBatch[currentBatch.length - 1].timestamp ||
            currentBatch[currentBatch.length - 1].t_valid,
        });
      }
    }

    return result;
  }

  /**
   * Extract concept key from an episode
   * @param {Object} episode
   * @returns {string}
   */
  extractConceptKey(episode) {
    const payload = episode.payload || {};

    // Try various payload fields that might contain concept info
    return (
      payload.conceptId ||
      payload.conceptName ||
      payload.topicId ||
      payload.topicName ||
      payload.word ||
      payload.bookId ||
      payload.sourceKey ||
      'general'
    );
  }

  /**
   * Consolidate a single cluster into a memory
   * @param {Object} cluster - Cluster to consolidate
   * @param {number} userId - User ID
   * @param {string} token - User token
   * @returns {Object} Created memory
   */
  async consolidateCluster(cluster, userId, token) {
    const { concept, episodes, periodStart, periodEnd } = cluster;

    console.log(`[ConsolidationService] Consolidating cluster: ${concept} (${episodes.length} episodes)`);

    // Analyze learning process within time-ordered cluster
    const processAnalysis = this.analyzeLearningProcess(episodes);

    // Create prompt with process analysis context
    const prompt = createMemoryConsolidationPrompt(episodes, concept, processAnalysis);

    // Call LLM for synthesis
    let synthesis;
    try {
      synthesis = await this.callLLMForSynthesis(prompt);
    } catch (llmError) {
      console.error('[ConsolidationService] LLM synthesis failed:', llmError);
      // Create a basic synthesis without AI
      synthesis = this.createFallbackSynthesis(episodes, concept, processAnalysis);
    }

    // Build consolidated memory object
    const memory = {
      id: `cm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conceptId: episodes[0]?.payload?.conceptId || null,
      conceptName: concept,
      memoryType: 'concept_session',
      periodStart,
      periodEnd,
      episodeCount: episodes.length,
      summary: synthesis.summary || 'Learning session recorded.',
      insights: synthesis.keyInsights || [],
      learningProcess: processAnalysis,
      metrics: synthesis.metrics || processAnalysis,
      sourceEpisodes: episodes.map((e) => e.id),
      masteryAssessment: synthesis.masteryAssessment || 'developing',
      learningStyle: synthesis.learningStyle || 'variable',
      recommendations: synthesis.recommendations || [],
    };

    // Store consolidated memory in SQLite
    const createResult = consolidatedMemoryManager.createConsolidatedMemory(memory, token);

    if (createResult.error) {
      console.error('[ConsolidationService] Failed to store memory:', createResult.error);
      throw new Error(createResult.error);
    }

    // Optional: Sync to Neo4j
    if (this.neo4jAdapter) {
      await this.syncToNeo4j(memory, userId).catch((err) => {
        console.warn('[ConsolidationService] Neo4j sync failed:', err.message);
      });
    }

    return {
      ...memory,
      sourceEpisodeIds: episodes.map((e) => e.id),
    };
  }

  /**
   * Analyze learning process from time-ordered episodes
   * @param {Array} episodes - Time-ordered episodes
   * @returns {Object} Process analysis
   */
  analyzeLearningProcess(episodes) {
    let correctCount = 0;
    let incorrectCount = 0;
    let hintCount = 0;
    const boxProgression = [];
    const strugglePatterns = [];
    const responseTimes = [];

    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      const payload = ep.payload || {};

      // Track correct/incorrect
      if (payload.wasCorrect !== undefined) {
        if (payload.wasCorrect) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }

      // Track hints
      if (payload.hintUsed) {
        hintCount++;
      }

      // Track response times
      if (payload.responseTimeMs) {
        responseTimes.push(payload.responseTimeMs);
      }

      // Track box progression (Leitner)
      if (payload.newBox !== undefined) {
        boxProgression.push({
          time: ep.timestamp || ep.t_valid,
          box: payload.newBox,
          previousBox: payload.previousBox,
        });
      }

      // Detect struggle patterns: incorrect → hint → eventually correct
      if (!payload.wasCorrect && i < episodes.length - 1) {
        const nextCorrectIdx = episodes.slice(i + 1).findIndex((e) => e.payload?.wasCorrect);
        if (nextCorrectIdx > 0) {
          strugglePatterns.push({
            start: ep.timestamp || ep.t_valid,
            attemptsToSuccess: nextCorrectIdx + 1,
          });
        }
      }
    }

    const totalAnswered = correctCount + incorrectCount;
    const avgResponseTimeMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null;

    return {
      totalReviews: episodes.length,
      correctCount,
      incorrectCount,
      accuracy: totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0,
      hintUsage: hintCount,
      avgResponseTimeMs,
      boxProgression,
      strugglePatterns,
      isCramming: this.detectCramming(episodes),
      responseTimeVariance: this.calculateVariance(responseTimes),
    };
  }

  /**
   * Detect cramming behavior (many reviews in short period)
   * @param {Array} episodes
   * @returns {boolean}
   */
  detectCramming(episodes) {
    if (episodes.length < 5) return false;

    const firstTime = new Date(episodes[0].timestamp || episodes[0].t_valid);
    const lastTime = new Date(episodes[episodes.length - 1].timestamp || episodes[episodes.length - 1].t_valid);
    const totalHours = (lastTime - firstTime) / (1000 * 60 * 60);

    // Cramming: >5 reviews in <1 hour
    return totalHours < 1 && episodes.length >= 5;
  }

  /**
   * Calculate variance of response times
   * @param {Array} times - Response times in ms
   * @returns {number|null}
   */
  calculateVariance(times) {
    if (times.length < 2) return null;

    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const squaredDiffs = times.map((t) => Math.pow(t - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / times.length;

    return Math.round(Math.sqrt(variance)); // Return standard deviation
  }

  /**
   * Call LLM for memory synthesis
   * @param {string} prompt
   * @returns {Object} Synthesis result
   */
  async callLLMForSynthesis(prompt) {
    if (!this.aiProvider) {
      throw new Error('AI provider not available');
    }

    // Use generateContentWithJson for structured response
    const result = await this.aiProvider.generateContentWithJson(prompt, true);

    if (typeof result === 'string') {
      // Try to parse as JSON
      try {
        return JSON.parse(result);
      } catch (e) {
        return { summary: result };
      }
    }

    return result;
  }

  /**
   * Create fallback synthesis without AI
   * @param {Array} episodes
   * @param {string} concept
   * @param {Object} processAnalysis
   * @returns {Object}
   */
  createFallbackSynthesis(episodes, concept, processAnalysis) {
    const { accuracy, totalReviews, correctCount, incorrectCount, isCramming } = processAnalysis;

    let summary = `Learning session for "${concept}" with ${totalReviews} reviews. `;
    if (accuracy >= 80) {
      summary += `Strong performance with ${accuracy}% accuracy.`;
    } else if (accuracy >= 60) {
      summary += `Moderate performance with ${accuracy}% accuracy. Some items need review.`;
    } else {
      summary += `Challenging session with ${accuracy}% accuracy. Consider reviewing fundamentals.`;
    }

    if (isCramming) {
      summary += ' Cramming behavior detected.';
    }

    let masteryAssessment = 'developing';
    if (accuracy >= 90) masteryAssessment = 'proficient';
    else if (accuracy >= 95) masteryAssessment = 'mastered';
    else if (accuracy < 50) masteryAssessment = 'beginner';

    return {
      summary,
      keyInsights: [
        `${correctCount} correct, ${incorrectCount} incorrect`,
        isCramming ? 'Learning was rushed (cramming detected)' : 'Steady learning pace',
      ],
      masteryAssessment,
      learningStyle: isCramming ? 'variable' : 'steady',
      recommendations: accuracy < 80 ? ['Schedule additional review sessions'] : [],
      metrics: processAnalysis,
    };
  }

  /**
   * Sync consolidated memory to Neo4j with full relationship creation
   *
   * Creates:
   * - ConsolidatedMemory node
   * - Episode -[:CONSOLIDATED_INTO]-> ConsolidatedMemory relationships
   * - ConsolidatedMemory -[:SUMMARIZES]-> Concept relationships
   * - Cross-concept pattern links (for cross_concept memory type)
   * - User -[:HAS_MEMORY]-> ConsolidatedMemory relationship
   *
   * @param {Object} memory - Consolidated memory object
   * @param {number} userId - User ID
   */
  async syncToNeo4j(memory, userId) {
    if (!this.neo4jAdapter) return;

    try {
      // 1. Create/update ConsolidatedMemory node
      await this.summarizationGraph.upsertConsolidatedMemory(memory, userId);
      console.log(`[ConsolidationService] Synced memory node ${memory.id}`);

      // 2. Link source episodes to memory
      if (memory.sourceEpisodes?.length > 0) {
        const episodeIds = Array.isArray(memory.sourceEpisodes)
          ? memory.sourceEpisodes
          : [memory.sourceEpisodes];
        const linkResult = await this.summarizationGraph.linkEpisodesToMemory(
          episodeIds,
          memory.id,
          { calculateWeights: true }
        );
        console.log(`[ConsolidationService] Linked ${linkResult.created} episodes to memory`);
      }

      // 3. Create :SUMMARIZES relationships to concepts
      const concepts = this.extractConceptsFromMemory(memory);
      if (concepts.length > 0) {
        const conceptResult = await this.summarizationGraph.linkMemoryToConcepts(memory.id, concepts);
        console.log(`[ConsolidationService] Linked memory to ${conceptResult.created} concepts`);
      }

      // 4. Link cross-concept patterns (for cross_concept type)
      if (memory.memoryType === 'cross_concept' && memory.patterns) {
        await this.linkCrossConceptPatterns(memory);
      }

      // 5. Link to user
      await this.summarizationGraph.linkMemoryToUser(memory.id, userId);

      console.log(`[ConsolidationService] Synced memory ${memory.id} to Neo4j with all relationships`);
    } catch (err) {
      console.error('[ConsolidationService] Neo4j sync failed:', err);
      throw err;
    }
  }

  /**
   * Extract concepts from memory for linking
   * @param {Object} memory - Consolidated memory
   * @returns {Array} Concepts array with properties
   */
  extractConceptsFromMemory(memory) {
    const concepts = [];

    // Primary concept from conceptId
    if (memory.conceptId) {
      concepts.push({
        id: memory.conceptId,
        name: memory.conceptName || memory.conceptId,
        isPrimary: true,
        weight: 1.0,
        confidence: 0.9,
        aspectsCovered: this.determineAspectsCovered(memory),
        masteryContribution: this.determineMasteryContribution(memory),
      });
    }

    // Additional concepts from insights (parse if they mention specific concepts)
    if (memory.insights && Array.isArray(memory.insights)) {
      // Future: parse insights for additional concept mentions
    }

    return concepts;
  }

  /**
   * Determine aspects covered based on memory content
   * @param {Object} memory
   * @returns {Array} Aspects covered
   */
  determineAspectsCovered(memory) {
    const aspects = [];
    const process = memory.learningProcess || memory.metrics || {};

    if (process.correctCount > 0) aspects.push('practice');
    if (process.boxProgression?.length > 0) aspects.push('progression');
    if (memory.recommendations?.length > 0) aspects.push('recommendations');
    if (memory.masteryAssessment) aspects.push('mastery_assessment');
    if (memory.summary?.length > 100) aspects.push('detailed_summary');

    return aspects.length > 0 ? aspects : ['general'];
  }

  /**
   * Determine mastery contribution based on accuracy
   * @param {Object} memory
   * @returns {string} 'positive', 'negative', or 'neutral'
   */
  determineMasteryContribution(memory) {
    const process = memory.learningProcess || memory.metrics || {};
    const accuracy = process.accuracy;

    if (accuracy == null) return 'neutral';
    if (accuracy >= 70) return 'positive';
    if (accuracy < 50) return 'negative';
    return 'neutral';
  }

  /**
   * Link cross-concept pattern memories to related concepts
   * @param {Object} memory - Cross-concept memory with patterns
   */
  async linkCrossConceptPatterns(memory) {
    const patterns = memory.patterns || {};

    // Prerequisites: link both from and to concepts
    const prerequisites = (patterns.crossConcept || []).filter(p => p.type === 'PREREQUISITE');
    for (const prereq of prerequisites) {
      const concepts = [];
      if (prereq.fromConceptId) {
        concepts.push({
          id: prereq.fromConceptId,
          name: prereq.fromConceptName,
          aspectsCovered: ['prerequisite_source'],
          weight: 0.8,
          confidence: prereq.confidence || 0.7,
        });
      }
      if (prereq.toConceptId) {
        concepts.push({
          id: prereq.toConceptId,
          name: prereq.toConceptName,
          aspectsCovered: ['prerequisite_target'],
          weight: 0.8,
          confidence: prereq.confidence || 0.7,
        });
      }
      if (concepts.length > 0) {
        await this.summarizationGraph.linkMemoryToConcepts(memory.id, concepts);
      }
    }

    // Concept clusters: link all concepts in cluster
    const clusters = (patterns.crossConcept || []).filter(
      p => p.type === 'CONCEPT_CLUSTER' || p.type === 'POSITIVE_TRANSFER'
    );
    for (const cluster of clusters) {
      const conceptIds = cluster.conceptIds || [cluster.conceptAId, cluster.conceptBId].filter(Boolean);
      if (conceptIds.length > 0) {
        const concepts = conceptIds.map(id => ({
          id,
          aspectsCovered: ['cluster_member'],
          weight: 1.0 / conceptIds.length,
          confidence: cluster.confidence || 0.6,
        }));
        await this.summarizationGraph.linkMemoryToConcepts(memory.id, concepts);
      }
    }

    // Interference patterns: link with negative indication
    const interference = (patterns.crossConcept || []).filter(p => p.type === 'INTERFERENCE');
    for (const intrf of interference) {
      const concepts = [];
      if (intrf.conceptAId) {
        concepts.push({
          id: intrf.conceptAId,
          name: intrf.conceptAName,
          aspectsCovered: ['interference'],
          masteryContribution: 'negative',
          weight: 0.6,
          confidence: intrf.severity || 0.5,
        });
      }
      if (intrf.conceptBId) {
        concepts.push({
          id: intrf.conceptBId,
          name: intrf.conceptBName,
          aspectsCovered: ['interference'],
          masteryContribution: 'negative',
          weight: 0.6,
          confidence: intrf.severity || 0.5,
        });
      }
      if (concepts.length > 0) {
        await this.summarizationGraph.linkMemoryToConcepts(memory.id, concepts);
      }
    }

    console.log('[ConsolidationService] Linked cross-concept patterns');
  }

  /**
   * Mark episodes as processed
   * @param {Array} episodeIds
   */
  async markEpisodesProcessed(episodeIds) {
    // Mark in Neo4j
    if (this.neo4jAdapter && episodeIds.length > 0) {
      try {
        const query = `
          UNWIND $ids AS id
          MATCH (e:Episode {id: id})
          SET e.processed = true,
              e.processedAt = datetime()
        `;
        await this.neo4jAdapter.runQuery(query, { ids: episodeIds });
      } catch (e) {
        console.warn('[ConsolidationService] Failed to mark episodes in Neo4j:', e.message);
      }
    }

    // Mark in local storage
    if (this.store) {
      const episodes = this.store.get('learningBrain.episodes', []);
      const updated = episodes.map((ep) => {
        if (episodeIds.includes(ep.id)) {
          return { ...ep, processed: true, processedAt: new Date().toISOString() };
        }
        return ep;
      });
      this.store.set('learningBrain.episodes', updated);
    }
  }

  /**
   * Archive old episodes (move to archive, mark for deletion)
   * @param {string} token - User token
   * @returns {Object} Archive result
   */
  async archiveOldEpisodes(token) {
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - this.config.archiveAfterDays);

    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() - this.config.deleteAfterDays);

    // In Neo4j, mark old episodes for archival
    if (this.neo4jAdapter) {
      try {
        // Archive (set flag, don't delete yet)
        const archiveQuery = `
          MATCH (e:Episode)
          WHERE e.processed = true
            AND e.timestamp < datetime($archiveDate)
            AND e.archived IS NULL
          SET e.archived = true,
              e.archivedAt = datetime()
          RETURN count(e) as archived
        `;
        const archiveResult = await this.neo4jAdapter.runQuery(archiveQuery, {
          archiveDate: archiveDate.toISOString(),
        });

        // Delete very old episodes
        const deleteQuery = `
          MATCH (e:Episode)
          WHERE e.archived = true
            AND e.archivedAt < datetime($deleteDate)
          DELETE e
          RETURN count(e) as deleted
        `;
        const deleteResult = await this.neo4jAdapter.runQuery(deleteQuery, {
          deleteDate: deleteDate.toISOString(),
        });

        return {
          success: true,
          archived: archiveResult.records[0]?.get('archived') || 0,
          deleted: deleteResult.records[0]?.get('deleted') || 0,
        };
      } catch (e) {
        console.error('[ConsolidationService] Archive failed:', e);
        return { success: false, error: e.message };
      }
    }

    // Local storage: just trim old episodes
    if (this.store) {
      const episodes = this.store.get('learningBrain.episodes', []);
      const filtered = episodes.filter((ep) => {
        const epDate = new Date(ep.timestamp || ep.t_valid);
        return epDate >= deleteDate;
      });

      const deleted = episodes.length - filtered.length;
      this.store.set('learningBrain.episodes', filtered);

      return { success: true, archived: 0, deleted };
    }

    return { success: true, archived: 0, deleted: 0 };
  }

  /**
   * Get consolidation statistics
   * @param {string} token - User token
   * @returns {Object}
   */
  getStats(token) {
    return consolidatedMemoryManager.getConsolidationStats(token);
  }

  /**
   * Get current configuration
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param {Object} updates - Configuration updates
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Run cross-concept analysis independently (for on-demand analysis)
   * @param {number} userId - User ID
   * @param {string} token - User token
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis result
   */
  async analyzeCrossConcept(userId, token, options = {}) {
    return this.crossConceptAnalyzer.analyze(userId, token, options);
  }

  /**
   * Run profile inference independently (for on-demand profiling)
   * @param {number} userId - User ID
   * @param {string} token - User token
   * @param {Object} options - Inference options
   * @returns {Object} Inference result
   */
  async inferLearnerProfile(userId, token, options = {}) {
    return this.profileInference.inferProfile(userId, token, options);
  }

  /**
   * Get recent cross-concept patterns from stored memories
   * @param {string} token - User token
   * @param {number} limit - Max number of patterns to return
   * @returns {Array} Cross-concept pattern memories
   */
  getRecentCrossConceptPatterns(token, limit = 10) {
    const memories = consolidatedMemoryManager.getConsolidatedMemories({
      token,
      memoryType: 'cross_concept',
      limit,
    });
    return memories.data || [];
  }

  /**
   * Get pattern summary for a specific concept
   * @param {string} conceptId - Concept ID
   * @param {string} token - User token
   * @returns {Object} Pattern summary for the concept
   */
  getConceptPatternSummary(conceptId, token) {
    const memories = consolidatedMemoryManager.getConsolidatedMemories({
      token,
      conceptId,
      limit: 100,
    });

    const conceptMemories = memories.data || [];
    const crossConceptMemories = this.getRecentCrossConceptPatterns(token, 50);

    // Find patterns involving this concept
    const relatedPatterns = crossConceptMemories.flatMap(m => {
      const patterns = m.patterns || {};
      return [
        ...(patterns.crossConcept || []).filter(p =>
          p.conceptAId === conceptId ||
          p.conceptBId === conceptId ||
          p.fromConceptId === conceptId ||
          p.toConceptId === conceptId
        ),
      ];
    });

    return {
      conceptId,
      memoryCount: conceptMemories.length,
      latestSummary: conceptMemories[0]?.summary || null,
      masteryAssessment: conceptMemories[0]?.masteryAssessment || 'unknown',
      relatedPatterns: relatedPatterns.slice(0, 10),
      insights: conceptMemories
        .flatMap(m => m.insights || [])
        .slice(0, 5),
    };
  }

  /**
   * Get learning recommendations based on patterns and profile
   * @param {number} userId - User ID
   * @param {string} token - User token
   * @returns {Object} Learning recommendations
   */
  async getLearningRecommendations(userId, token) {
    const crossConceptPatterns = this.getRecentCrossConceptPatterns(token, 20);
    const profile = learnerProfileManager.getGlobalProfile(token);

    const recommendations = {
      scheduling: [],
      content: [],
      strategy: [],
    };

    // Scheduling recommendations based on profile
    if (profile?.preferredTimeOfDay) {
      recommendations.scheduling.push({
        type: 'optimal_time',
        message: `Your best study time is ${profile.preferredTimeOfDay}`,
        priority: 'medium',
      });
    }

    if (profile?.optimalSessionLength) {
      recommendations.scheduling.push({
        type: 'session_length',
        message: `Aim for ${profile.optimalSessionLength} minute sessions for best focus`,
        priority: 'medium',
      });
    }

    // Content recommendations from cross-concept patterns
    for (const memory of crossConceptPatterns) {
      const patterns = memory.patterns || {};

      // Prerequisites to study first
      const prerequisites = (patterns.crossConcept || [])
        .filter(p => p.type === 'PREREQUISITE' && p.confidence > 0.7);

      for (const prereq of prerequisites) {
        recommendations.content.push({
          type: 'prerequisite',
          message: `Study "${prereq.fromConceptName}" before "${prereq.toConceptName}" for better retention`,
          priority: 'high',
          confidence: prereq.confidence,
        });
      }

      // Concepts to avoid together
      const interference = (patterns.crossConcept || [])
        .filter(p => p.type === 'INTERFERENCE' && p.severity > 0.5);

      for (const intrf of interference) {
        recommendations.content.push({
          type: 'interference',
          message: `Space out studying "${intrf.conceptAName}" and "${intrf.conceptBName}" - they may interfere`,
          priority: 'high',
          recommendedGap: intrf.recommendedGap,
        });
      }

      // Cramming warnings
      const cramming = (patterns.temporal || [])
        .filter(p => p.type === 'CRAMMING');

      for (const cram of cramming) {
        recommendations.strategy.push({
          type: 'cramming_warning',
          message: `Cramming detected for "${cram.conceptName}" - spacing reviews improves long-term retention`,
          priority: 'high',
        });
      }
    }

    // Strategy recommendations from profile
    if (profile?.consistencyScore < 50) {
      recommendations.strategy.push({
        type: 'consistency',
        message: 'Try to study more consistently - regular short sessions beat irregular long ones',
        priority: 'high',
      });
    }

    return recommendations;
  }
}

module.exports = ConsolidationService;
