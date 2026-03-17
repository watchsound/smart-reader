/**
 * CrossConceptAnalyzer.js
 *
 * Analyzes learning episodes to detect cross-concept patterns:
 * - Prerequisites (A must be mastered before B)
 * - Interference (learning A hurts B performance)
 * - Positive Transfer (learning A helps B)
 * - Concept Clustering (concepts naturally studied together)
 * - Forgetting Correlation (concepts that decay together)
 *
 * These patterns inform the learner profile and enable personalized recommendations.
 */

class CrossConceptAnalyzer {
  constructor(services = {}) {
    this.episodeCollector = services.episodeCollector;
    this.sessionAnalyticsManager = services.sessionAnalyticsManager;
    this.graphInterface = services.graphInterface;

    // Configuration
    this.config = {
      minEpisodesPerConcept: 5,
      correlationThreshold: 0.6,
      prerequisiteConfidenceThreshold: 0.7,
      interferenceThreshold: 0.1, // 10% accuracy drop
      contextShiftHours: 24,
      lookbackDays: 30,
    };
  }

  /**
   * Run full cross-concept analysis
   * @param {number} userId
   * @param {string} token
   * @param {Object} options
   * @returns {Object} Analysis results
   */
  async analyze(userId, token, options = {}) {
    const lookbackDays = options.lookbackDays || this.config.lookbackDays;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    console.log(`[CrossConceptAnalyzer] Analyzing patterns for user ${userId}, ${lookbackDays} days`);

    // Get episodes in range
    const episodes = await this.getEpisodes(userId, startDate, endDate);
    if (episodes.length < this.config.minEpisodesPerConcept) {
      return {
        success: true,
        message: 'Not enough data for analysis',
        patterns: [],
        episodeCount: episodes.length,
      };
    }

    // Group episodes by concept
    const conceptGroups = this.groupByConcept(episodes);
    const conceptIds = Object.keys(conceptGroups);

    console.log(`[CrossConceptAnalyzer] Found ${conceptIds.length} concepts with ${episodes.length} episodes`);

    // Run pattern detection
    const patterns = {
      prerequisites: [],
      interferences: [],
      positiveTransfers: [],
      conceptClusters: [],
      forgettingCorrelations: [],
    };

    // Analyze concept pairs
    for (let i = 0; i < conceptIds.length; i++) {
      for (let j = i + 1; j < conceptIds.length; j++) {
        const conceptA = conceptIds[i];
        const conceptB = conceptIds[j];
        const episodesA = conceptGroups[conceptA];
        const episodesB = conceptGroups[conceptB];

        // Skip if not enough data
        if (
          episodesA.length < this.config.minEpisodesPerConcept ||
          episodesB.length < this.config.minEpisodesPerConcept
        ) {
          continue;
        }

        // Check for prerequisite relationship
        const prereq = this.detectPrerequisite(episodesA, episodesB, conceptA, conceptB);
        if (prereq) patterns.prerequisites.push(prereq);

        // Check reverse direction
        const prereqReverse = this.detectPrerequisite(episodesB, episodesA, conceptB, conceptA);
        if (prereqReverse) patterns.prerequisites.push(prereqReverse);

        // Check for interference
        const interference = this.detectInterference(episodesA, episodesB, conceptA, conceptB);
        if (interference) patterns.interferences.push(interference);

        // Check for positive transfer
        const transfer = this.detectPositiveTransfer(episodesA, episodesB, conceptA, conceptB);
        if (transfer) patterns.positiveTransfers.push(transfer);
      }
    }

    // Detect concept clusters (concepts studied in same sessions)
    const clusters = this.detectConceptClusters(episodes, conceptGroups);
    patterns.conceptClusters = clusters;

    // Detect forgetting correlations
    const forgettingPatterns = this.detectForgettingCorrelations(conceptGroups);
    patterns.forgettingCorrelations = forgettingPatterns;

    // Calculate summary
    const totalPatterns =
      patterns.prerequisites.length +
      patterns.interferences.length +
      patterns.positiveTransfers.length +
      patterns.conceptClusters.length +
      patterns.forgettingCorrelations.length;

    return {
      success: true,
      userId,
      analyzedAt: new Date().toISOString(),
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      episodeCount: episodes.length,
      conceptCount: conceptIds.length,
      patterns,
      summary: {
        totalPatterns,
        prerequisiteCount: patterns.prerequisites.length,
        interferenceCount: patterns.interferences.length,
        transferCount: patterns.positiveTransfers.length,
        clusterCount: patterns.conceptClusters.length,
      },
    };
  }

  /**
   * Get episodes from collector
   */
  async getEpisodes(userId, startDate, endDate) {
    if (!this.episodeCollector) {
      console.warn('[CrossConceptAnalyzer] No episode collector available');
      return [];
    }

    try {
      const episodes = await this.episodeCollector.getEpisodesInRange(startDate, endDate);
      return episodes.filter((ep) => {
        const epUserId = ep.userId || 1;
        return epUserId === userId && ep.eventType === 'REVIEW_COMPLETED';
      });
    } catch (err) {
      console.error('[CrossConceptAnalyzer] Failed to get episodes:', err);
      return [];
    }
  }

  /**
   * Group episodes by concept
   */
  groupByConcept(episodes) {
    const groups = {};

    for (const ep of episodes) {
      const payload = typeof ep.payload === 'string' ? JSON.parse(ep.payload) : ep.payload || {};
      const conceptKey = payload.conceptId || payload.conceptName || payload.word;

      if (!conceptKey) continue;

      if (!groups[conceptKey]) {
        groups[conceptKey] = [];
      }
      groups[conceptKey].push({
        ...ep,
        payload,
        timestamp: new Date(ep.timestamp || ep.t_valid),
      });
    }

    // Sort each group by timestamp
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.timestamp - b.timestamp);
    }

    return groups;
  }

  /**
   * Detect prerequisite relationship: A mastered before B → B improves faster
   */
  detectPrerequisite(episodesA, episodesB, conceptA, conceptB) {
    // Find when A was mastered (80%+ accuracy over 3+ reviews)
    const aMasteryDate = this.findMasteryDate(episodesA);
    if (!aMasteryDate) return null;

    // Get B's first review
    const bStartDate = episodesB[0]?.timestamp;
    if (!bStartDate) return null;

    // A must be mastered before B started
    if (aMasteryDate >= bStartDate) return null;

    // Compare B's accuracy before and after A was mastered
    const bBeforeA = episodesB.filter((e) => e.timestamp < aMasteryDate);
    const bAfterA = episodesB.filter((e) => e.timestamp >= aMasteryDate);

    if (bBeforeA.length < 2 || bAfterA.length < 2) return null;

    const accuracyBefore = this.calculateAccuracy(bBeforeA);
    const accuracyAfter = this.calculateAccuracy(bAfterA);

    const improvement = accuracyAfter - accuracyBefore;

    if (improvement >= 0.15) {
      // 15%+ improvement threshold
      return {
        type: 'PREREQUISITE',
        fromConceptId: conceptA,
        fromConceptName: this.getConceptName(episodesA),
        toConceptId: conceptB,
        toConceptName: this.getConceptName(episodesB),
        confidence: Math.min(1, improvement / 0.15),
        evidenceType: 'temporal',
        performanceImpact: improvement,
        aMasteryDate: aMasteryDate.toISOString(),
        insight: `Mastering "${this.getConceptName(episodesA)}" improved "${this.getConceptName(episodesB)}" performance by ${Math.round(improvement * 100)}%`,
      };
    }

    return null;
  }

  /**
   * Find when a concept was mastered
   * @returns {Date|null}
   */
  findMasteryDate(episodes) {
    // Look for streak of 3+ correct reviews with 80%+ accuracy
    let correctStreak = 0;
    let recentCorrect = 0;
    let recentTotal = 0;

    for (const ep of episodes) {
      recentTotal++;
      if (ep.payload?.wasCorrect || ep.payload?.rating >= 3) {
        recentCorrect++;
        correctStreak++;

        // Check if mastered: 3+ correct and 80%+ recent accuracy
        if (correctStreak >= 3 && recentCorrect / recentTotal >= 0.8) {
          return ep.timestamp;
        }
      } else {
        correctStreak = 0;
      }
    }

    return null;
  }

  /**
   * Detect interference: studying A hurts B performance
   */
  detectInterference(episodesA, episodesB, conceptA, conceptB) {
    // Find sessions where both A and B were studied
    const overlappingSessions = this.findOverlappingSessions(episodesA, episodesB);

    if (overlappingSessions.length < 2) return null;

    // Calculate B's accuracy during overlapping vs non-overlapping sessions
    const bInOverlap = episodesB.filter((ep) =>
      overlappingSessions.some(
        (session) => ep.timestamp >= session.start && ep.timestamp <= session.end,
      ),
    );

    const bOutsideOverlap = episodesB.filter(
      (ep) =>
        !overlappingSessions.some(
          (session) => ep.timestamp >= session.start && ep.timestamp <= session.end,
        ),
    );

    if (bInOverlap.length < 2 || bOutsideOverlap.length < 2) return null;

    const accuracyDuring = this.calculateAccuracy(bInOverlap);
    const accuracyOutside = this.calculateAccuracy(bOutsideOverlap);

    const drop = accuracyOutside - accuracyDuring;

    if (drop >= this.config.interferenceThreshold) {
      return {
        type: 'INTERFERENCE',
        conceptAId: conceptA,
        conceptAName: this.getConceptName(episodesA),
        conceptBId: conceptB,
        conceptBName: this.getConceptName(episodesB),
        severity: Math.min(1, drop / 0.2),
        direction: 'a_affects_b',
        accuracyDrop: drop,
        recommendedGap: 24, // Hours
        insight: `Studying "${this.getConceptName(episodesA)}" in the same session reduces "${this.getConceptName(episodesB)}" accuracy by ${Math.round(drop * 100)}%`,
      };
    }

    return null;
  }

  /**
   * Find sessions where both concepts were studied
   */
  findOverlappingSessions(episodesA, episodesB) {
    const sessions = [];
    const sessionWindow = 2 * 60 * 60 * 1000; // 2 hours

    for (const epA of episodesA) {
      const sessionStart = new Date(epA.timestamp.getTime() - sessionWindow / 2);
      const sessionEnd = new Date(epA.timestamp.getTime() + sessionWindow / 2);

      // Check if any B episode falls within this window
      const bInWindow = episodesB.some(
        (epB) => epB.timestamp >= sessionStart && epB.timestamp <= sessionEnd,
      );

      if (bInWindow) {
        sessions.push({ start: sessionStart, end: sessionEnd });
      }
    }

    return sessions;
  }

  /**
   * Detect positive transfer: learning A helps B
   */
  detectPositiveTransfer(episodesA, episodesB, conceptA, conceptB) {
    // Calculate learning velocity for both concepts
    const velocityA = this.calculateLearningVelocity(episodesA);
    const velocityB = this.calculateLearningVelocity(episodesB);

    if (velocityA.length < 3 || velocityB.length < 3) return null;

    // Calculate correlation between velocity trends
    const correlation = this.pearsonCorrelation(velocityA, velocityB);

    if (correlation >= this.config.correlationThreshold) {
      return {
        type: 'POSITIVE_TRANSFER',
        conceptAId: conceptA,
        conceptAName: this.getConceptName(episodesA),
        conceptBId: conceptB,
        conceptBName: this.getConceptName(episodesB),
        correlation,
        direction: 'bidirectional',
        insight: `Learning "${this.getConceptName(episodesA)}" and "${this.getConceptName(episodesB)}" show strong positive correlation (${Math.round(correlation * 100)}%)`,
      };
    }

    return null;
  }

  /**
   * Calculate learning velocity (accuracy improvement over time)
   */
  calculateLearningVelocity(episodes) {
    const windowSize = 5;
    const velocities = [];

    for (let i = windowSize; i < episodes.length; i++) {
      const window = episodes.slice(i - windowSize, i);
      const prevWindow = episodes.slice(Math.max(0, i - windowSize * 2), i - windowSize);

      if (prevWindow.length < windowSize) continue;

      const currentAccuracy = this.calculateAccuracy(window);
      const prevAccuracy = this.calculateAccuracy(prevWindow);

      velocities.push(currentAccuracy - prevAccuracy);
    }

    return velocities;
  }

  /**
   * Detect concept clusters (concepts studied together)
   */
  detectConceptClusters(episodes, conceptGroups) {
    const sessionWindow = 30 * 60 * 1000; // 30 minutes
    const coStudyMatrix = {};
    const conceptIds = Object.keys(conceptGroups);

    // Build co-study matrix
    for (const conceptA of conceptIds) {
      coStudyMatrix[conceptA] = {};
      for (const conceptB of conceptIds) {
        if (conceptA !== conceptB) {
          coStudyMatrix[conceptA][conceptB] = 0;
        }
      }
    }

    // Count co-occurrences within session windows
    for (const ep of episodes) {
      const payload = typeof ep.payload === 'string' ? JSON.parse(ep.payload) : ep.payload || {};
      const conceptKey = payload.conceptId || payload.conceptName || payload.word;
      if (!conceptKey) continue;

      const epTime = new Date(ep.timestamp || ep.t_valid);

      // Find other concepts studied within window
      for (const otherConcept of conceptIds) {
        if (otherConcept === conceptKey) continue;

        const otherEpisodes = conceptGroups[otherConcept] || [];
        const inWindow = otherEpisodes.some((otherEp) => {
          const otherTime = otherEp.timestamp;
          return Math.abs(epTime - otherTime) <= sessionWindow;
        });

        if (inWindow) {
          coStudyMatrix[conceptKey][otherConcept]++;
        }
      }
    }

    // Find strong clusters (frequently studied together)
    const clusters = [];
    const minCoStudy = 3;
    const processed = new Set();

    for (const conceptA of conceptIds) {
      if (processed.has(conceptA)) continue;

      const cluster = [conceptA];
      processed.add(conceptA);

      for (const conceptB of conceptIds) {
        if (processed.has(conceptB)) continue;
        if ((coStudyMatrix[conceptA]?.[conceptB] || 0) >= minCoStudy) {
          cluster.push(conceptB);
          processed.add(conceptB);
        }
      }

      if (cluster.length >= 2) {
        clusters.push({
          type: 'CONCEPT_CLUSTER',
          conceptIds: cluster,
          conceptNames: cluster.map((c) => this.getConceptNameFromGroups(c, conceptGroups)),
          coStudyFrequency: Math.max(
            ...cluster.map((c) =>
              Math.max(...Object.values(coStudyMatrix[c] || {}).filter((v) => v > 0), 0),
            ),
          ),
          sharedDomain: null, // Could be inferred from concept metadata
          suggestedGrouping: true,
          insight: `These concepts are naturally studied together and may benefit from joint review`,
        });
      }
    }

    return clusters;
  }

  /**
   * Detect forgetting correlations (concepts that decay together)
   */
  detectForgettingCorrelations(conceptGroups) {
    const correlations = [];
    const conceptIds = Object.keys(conceptGroups);

    for (let i = 0; i < conceptIds.length; i++) {
      for (let j = i + 1; j < conceptIds.length; j++) {
        const conceptA = conceptIds[i];
        const conceptB = conceptIds[j];
        const episodesA = conceptGroups[conceptA];
        const episodesB = conceptGroups[conceptB];

        // Find decay events (correct → incorrect after gap)
        const decaysA = this.findDecayEvents(episodesA);
        const decaysB = this.findDecayEvents(episodesB);

        if (decaysA.length < 2 || decaysB.length < 2) continue;

        // Check if decays correlate in time
        const decayCorrelation = this.calculateDecayCorrelation(decaysA, decaysB);

        if (decayCorrelation >= 0.5) {
          correlations.push({
            type: 'FORGETTING_CORRELATION',
            conceptIds: [conceptA, conceptB],
            conceptNames: [
              this.getConceptNameFromGroups(conceptA, conceptGroups),
              this.getConceptNameFromGroups(conceptB, conceptGroups),
            ],
            correlationScore: decayCorrelation,
            suggestedReviewStrategy: decayCorrelation > 0.7 ? 'together' : 'staggered',
            insight: `These concepts tend to be forgotten at similar times - consider reviewing them together`,
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Find decay events (forgetting after successful recall)
   */
  findDecayEvents(episodes) {
    const decays = [];

    for (let i = 1; i < episodes.length; i++) {
      const prev = episodes[i - 1];
      const curr = episodes[i];

      const prevCorrect = prev.payload?.wasCorrect || prev.payload?.rating >= 3;
      const currCorrect = curr.payload?.wasCorrect || curr.payload?.rating >= 3;

      if (prevCorrect && !currCorrect) {
        const gapDays = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60 * 24);
        decays.push({
          date: curr.timestamp,
          gapDays,
        });
      }
    }

    return decays;
  }

  /**
   * Calculate correlation between decay events
   */
  calculateDecayCorrelation(decaysA, decaysB) {
    // Simple correlation: how often decays happen in same week
    const weekWindow = 7 * 24 * 60 * 60 * 1000;
    let matches = 0;

    for (const decayA of decaysA) {
      for (const decayB of decaysB) {
        if (Math.abs(decayA.date - decayB.date) <= weekWindow) {
          matches++;
          break;
        }
      }
    }

    return matches / Math.max(decaysA.length, decaysB.length);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Calculate accuracy from episodes
   */
  calculateAccuracy(episodes) {
    if (!episodes.length) return 0;

    const correct = episodes.filter(
      (ep) => ep.payload?.wasCorrect || ep.payload?.rating >= 3,
    ).length;

    return correct / episodes.length;
  }

  /**
   * Get concept name from first episode
   */
  getConceptName(episodes) {
    if (!episodes.length) return 'Unknown';
    const payload = episodes[0].payload || {};
    return payload.conceptName || payload.word || payload.conceptId || 'Unknown';
  }

  /**
   * Get concept name from groups
   */
  getConceptNameFromGroups(conceptId, groups) {
    const episodes = groups[conceptId] || [];
    return this.getConceptName(episodes);
  }

  /**
   * Pearson correlation coefficient
   */
  pearsonCorrelation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const xSlice = x.slice(0, n);
    const ySlice = y.slice(0, n);

    const sumX = xSlice.reduce((a, b) => a + b, 0);
    const sumY = ySlice.reduce((a, b) => a + b, 0);
    const sumXY = xSlice.reduce((sum, xi, i) => sum + xi * ySlice[i], 0);
    const sumX2 = xSlice.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = ySlice.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  /**
   * Update configuration
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }
}

module.exports = CrossConceptAnalyzer;
