/**
 * EpisodeCollector - Collects learning events for episodic memory
 *
 * Hooks into existing code paths to capture learning events with timestamps.
 * Events are batched and written to Neo4j for long-term storage and analysis.
 *
 * Usage:
 *   const collector = new EpisodeCollector(services);
 *
 *   // Record an event
 *   collector.record({
 *     eventType: 'REVIEW_COMPLETED',
 *     payload: { conceptId: '123', rating: 3, responseTimeMs: 2500 }
 *   });
 */

class EpisodeCollector {
  constructor(services = {}) {
    this.services = services;
    this.store = services.store;
    this.neo4jAdapter = services.neo4jAdapter;

    // Event buffer for batching
    this.eventBuffer = [];
    this.maxBufferSize = 50;
    this.flushInterval = 60000; // 1 minute
    this.flushTimer = null;

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Record a learning event
   * @param {Object} event
   * @param {string} event.eventType - Event type (see EVENT_TYPES)
   * @param {Object} event.payload - Event-specific data
   * @param {Object} event.sourceContext - Context (view, documentId, etc.)
   * @param {number} event.userId - User ID (default: 1)
   */
  record(event) {
    const episode = {
      id: this.generateId(),
      userId: event.userId || 1,
      eventType: event.eventType,
      timestamp: new Date().toISOString(),
      t_valid: event.timestamp || new Date().toISOString(),
      t_invalid: null,
      t_created: new Date().toISOString(),
      t_expired: null,
      payload: event.payload || {},
      sourceContext: event.sourceContext || {},
    };

    this.eventBuffer.push(episode);

    console.log(`[EpisodeCollector] Recorded ${event.eventType}`, {
      bufferSize: this.eventBuffer.length,
    });

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.maxBufferSize) {
      this.flush().catch((err) => {
        console.error('[EpisodeCollector] Auto-flush failed:', err);
      });
    }

    return episode.id;
  }

  /**
   * Flush buffered events to storage
   */
  async flush() {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    console.log(
      `[EpisodeCollector] Flushing ${eventsToFlush.length} events...`,
    );

    try {
      // Try Neo4j first
      if (this.neo4jAdapter) {
        await this.writeToNeo4j(eventsToFlush);
      } else {
        // Fallback to local storage
        await this.writeToLocalStorage(eventsToFlush);
      }

      console.log(`[EpisodeCollector] Flushed ${eventsToFlush.length} events`);
    } catch (error) {
      console.error('[EpisodeCollector] Flush failed:', error);
      // Put events back in buffer
      this.eventBuffer = [...eventsToFlush, ...this.eventBuffer];
    }
  }

  /**
   * Write events to Neo4j
   * @param {Array} events
   */
  async writeToNeo4j(events) {
    // Check if adapter is available and ready
    if (!this.neo4jAdapter) {
      console.warn(
        '[EpisodeCollector] Neo4j adapter not available, skipping flush to graph',
      );
      return;
    }

    // Check if adapter is initialized (for GraphInterface wrapper)
    if (this.neo4jAdapter.isReady && !this.neo4jAdapter.isReady()) {
      console.warn(
        '[EpisodeCollector] Neo4j adapter not ready, skipping flush to graph',
      );
      return;
    }

    // Serialize payloads
    const eventsWithJson = events.map((e) => ({
      ...e,
      payloadJson: JSON.stringify(e.payload),
      sourceContextJson: JSON.stringify(e.sourceContext),
    }));

    // Batch create episodes using Neo4jAdapter
    await this.neo4jAdapter.batchCreateEpisodes(eventsWithJson);
  }

  /**
   * Write events to local storage (fallback)
   * @param {Array} events
   */
  async writeToLocalStorage(events) {
    if (!this.store) {
      console.warn(
        '[EpisodeCollector] No storage available, events will be lost',
      );
      return;
    }

    // Get existing episodes
    const existing = this.store.get('learningBrain.episodes', []);

    // Append new events
    const updated = [...existing, ...events];

    // Keep only last 1000 episodes in local storage
    const trimmed = updated.slice(-1000);

    this.store.set('learningBrain.episodes', trimmed);
  }

  /**
   * Start periodic flush timer
   */
  startPeriodicFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[EpisodeCollector] Periodic flush failed:', err);
      });
    }, this.flushInterval);
  }

  /**
   * Stop periodic flush timer
   */
  stopPeriodicFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Generate unique episode ID
   * @returns {string}
   */
  generateId() {
    return `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent episodes from buffer + storage
   * @param {number} limit
   * @returns {Array}
   */
  async getRecentEpisodes(limit = 50) {
    const buffered = [...this.eventBuffer];

    // Try Neo4j
    if (this.neo4jAdapter) {
      try {
        const query = `
          MATCH (e:Episode)
          WHERE e.userId = 1
          RETURN e
          ORDER BY e.timestamp DESC
          LIMIT $limit
        `;
        const result = await this.neo4jAdapter.runQuery(query, { limit });
        const fromDb = result.records.map((r) => r.get('e').properties);
        return [...buffered, ...fromDb].slice(0, limit);
      } catch (e) {
        console.warn('[EpisodeCollector] Neo4j query failed:', e.message);
      }
    }

    // Fallback to local storage
    if (this.store) {
      const stored = this.store.get('learningBrain.episodes', []);
      return [...buffered, ...stored.slice(-limit)].slice(-limit);
    }

    return buffered;
  }

  /**
   * Get episodes by type
   * @param {string} eventType
   * @param {number} limit
   * @returns {Array}
   */
  async getEpisodesByType(eventType, limit = 50) {
    const episodes = await this.getRecentEpisodes(500);
    return episodes.filter((e) => e.eventType === eventType).slice(0, limit);
  }

  /**
   * Get episodes in time range
   * @param {Date} start
   * @param {Date} end
   * @returns {Array}
   */
  async getEpisodesInRange(start, end) {
    if (this.neo4jAdapter) {
      try {
        const query = `
          MATCH (e:Episode)
          WHERE e.userId = 1
            AND e.timestamp >= datetime($start)
            AND e.timestamp <= datetime($end)
          RETURN e
          ORDER BY e.timestamp ASC
        `;
        const result = await this.neo4jAdapter.runQuery(query, {
          start: start.toISOString(),
          end: end.toISOString(),
        });
        return result.records.map((r) => r.get('e').properties);
      } catch (e) {
        console.warn('[EpisodeCollector] Range query failed:', e.message);
      }
    }

    // Fallback
    const episodes = await this.getRecentEpisodes(1000);
    return episodes.filter((e) => {
      const ts = new Date(e.timestamp);
      return ts >= start && ts <= end;
    });
  }

  /**
   * Get episode count
   * @returns {number}
   */
  getBufferSize() {
    return this.eventBuffer.length;
  }

  /**
   * Get unprocessed episodes (for consolidation)
   * @param {number} userId - User ID
   * @param {Date} startDate - Start of range
   * @param {Date} endDate - End of range
   * @returns {Array}
   */
  async getUnprocessedEpisodes(userId, startDate, endDate) {
    const episodes = await this.getEpisodesInRange(startDate, endDate);
    return episodes.filter((ep) => {
      const epUserId = ep.userId || 1;
      const isProcessed = ep.processed || ep.consolidatedInto;
      return epUserId === userId && !isProcessed;
    });
  }

  /**
   * Mark episodes as processed (after consolidation)
   * @param {Array} episodeIds - IDs of episodes to mark
   * @param {string} consolidatedMemoryId - ID of the consolidated memory
   */
  async markAsProcessed(episodeIds, consolidatedMemoryId = null) {
    if (!episodeIds || episodeIds.length === 0) return;

    const now = new Date().toISOString();

    // Mark in Neo4j
    if (this.neo4jAdapter) {
      try {
        const query = `
          UNWIND $ids AS id
          MATCH (e:Episode {id: id})
          SET e.processed = true,
              e.processedAt = datetime($processedAt),
              e.consolidatedInto = $consolidatedInto
        `;
        await this.neo4jAdapter.runQuery(query, {
          ids: episodeIds,
          processedAt: now,
          consolidatedInto: consolidatedMemoryId,
        });
        console.log(
          `[EpisodeCollector] Marked ${episodeIds.length} episodes as processed in Neo4j`,
        );
      } catch (e) {
        console.warn(
          '[EpisodeCollector] Failed to mark episodes in Neo4j:',
          e.message,
        );
      }
    }

    // Mark in local storage
    if (this.store) {
      const episodes = this.store.get('learningBrain.episodes', []);
      const updated = episodes.map((ep) => {
        if (episodeIds.includes(ep.id)) {
          return {
            ...ep,
            processed: true,
            processedAt: now,
            consolidatedInto: consolidatedMemoryId,
          };
        }
        return ep;
      });
      this.store.set('learningBrain.episodes', updated);
      console.log(
        `[EpisodeCollector] Marked ${episodeIds.length} episodes as processed in local storage`,
      );
    }
  }

  /**
   * Get episodes by concept/topic
   * @param {string} conceptKey - Concept ID or name
   * @param {number} limit - Max results
   * @returns {Array}
   */
  async getEpisodesByConcept(conceptKey, limit = 100) {
    const episodes = await this.getRecentEpisodes(500);
    return episodes
      .filter((ep) => {
        const payload = ep.payload || {};
        return (
          payload.conceptId === conceptKey ||
          payload.conceptName === conceptKey ||
          payload.topicId === conceptKey ||
          payload.topicName === conceptKey ||
          payload.word === conceptKey
        );
      })
      .slice(0, limit);
  }

  /**
   * Get episode statistics
   * @param {number} userId
   * @returns {Object}
   */
  async getEpisodeStats(userId = 1) {
    const episodes = await this.getRecentEpisodes(1000);
    const userEpisodes = episodes.filter((ep) => (ep.userId || 1) === userId);

    const byType = {};
    let processedCount = 0;
    let unprocessedCount = 0;

    for (const ep of userEpisodes) {
      const eventType = ep.eventType || 'UNKNOWN';
      byType[eventType] = (byType[eventType] || 0) + 1;

      if (ep.processed) {
        processedCount++;
      } else {
        unprocessedCount++;
      }
    }

    return {
      total: userEpisodes.length,
      byType,
      processedCount,
      unprocessedCount,
      bufferSize: this.eventBuffer.length,
    };
  }
}

/**
 * Event type constants
 */
EpisodeCollector.EVENT_TYPES = {
  // Study Session Events
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',

  // Review Events
  REVIEW_COMPLETED: 'REVIEW_COMPLETED',
  REVIEW_SKIPPED: 'REVIEW_SKIPPED',

  // Performance Events
  QUIZ_TAKEN: 'QUIZ_TAKEN',
  CONCEPT_STRUGGLED: 'CONCEPT_STRUGGLED',
  CONCEPT_MASTERED: 'CONCEPT_MASTERED',
  MASTERY_CHANGED: 'MASTERY_CHANGED',

  // Content Events
  BOOK_OPENED: 'BOOK_OPENED',
  BOOK_COMPLETED: 'BOOK_COMPLETED',
  NOTE_CREATED: 'NOTE_CREATED',
  HIGHLIGHT_CREATED: 'HIGHLIGHT_CREATED',

  // Goal Events
  GOAL_SET: 'GOAL_SET',
  GOAL_PROGRESS: 'GOAL_PROGRESS',
  GOAL_COMPLETED: 'GOAL_COMPLETED',

  // Streak Events
  STREAK_EXTENDED: 'STREAK_EXTENDED',
  STREAK_BROKEN: 'STREAK_BROKEN',

  // Brain Events (internal)
  PATTERN_DETECTED: 'PATTERN_DETECTED',
  SUMMARY_CREATED: 'SUMMARY_CREATED',

  // Reading Comprehension Events (Phase 2)
  // These signals close the loop between reading behavior and the Brain's
  // mastery model. They are collected silently as the user reads and become
  // input to features like pre-book diagnostic calibration, micro-card
  // tuning, and tutor-mode struggle detection.
  CHAPTER_ENTERED: 'CHAPTER_ENTERED',
  CHAPTER_LEFT: 'CHAPTER_LEFT',
  BACKTRACK: 'BACKTRACK',
  PARAGRAPH_DWELL: 'PARAGRAPH_DWELL',
  PARAGRAPH_REREAD: 'PARAGRAPH_REREAD',

  // Micro-card Proposal Events (Phase 4)
  // Feedback loop for the in-reading card-proposal flow. ACCEPTED items
  // become SRS cards; ACKNOWLEDGED items skip Box 1 (user already knows
  // them); DISMISSED items teach the proposer what NOT to surface next time.
  CARD_PROPOSED: 'CARD_PROPOSED',
  CARD_ACCEPTED: 'CARD_ACCEPTED',
  CARD_ACKNOWLEDGED: 'CARD_ACKNOWLEDGED',
  CARD_DISMISSED: 'CARD_DISMISSED',

  // Chapter-end Comprehension Events (Phase 6)
  // Distinct from REVIEW_COMPLETED (SRS card outcomes). These are
  // user-authored explanations of what they just read, AI-graded against
  // the chapter content. Score + identified gaps feed the Brain's
  // mastery model as a stronger signal than "did you remember the card".
  COMPREHENSION_OFFERED: 'COMPREHENSION_OFFERED',
  COMPREHENSION_SUBMITTED: 'COMPREHENSION_SUBMITTED',
  COMPREHENSION_SKIPPED: 'COMPREHENSION_SKIPPED',

  // Spaced Re-reading Events (Phase 8)
  // Triggered by the reader after a comprehension check surfaces gaps.
  // SCHEDULED → item enters the re-read queue; COMPLETED → reader finished
  // the re-read and acknowledged it. Brain uses these to weight future
  // comprehension and micro-card offers toward recently-struggled chapters.
  REREAD_SCHEDULED: 'REREAD_SCHEDULED',
  REREAD_COMPLETED: 'REREAD_COMPLETED',

  // Production Loop Events (Phase 8)
  // PROMPTED  → brain heartbeat picked an LP and notified the user.
  // SUBMITTED → user gave a free-text explanation and was graded; payload
  //             carries score + beforeMastery/afterMastery + box-delta so
  //             downstream analytics can measure passive-vs-active gaps.
  // SKIPPED   → user dismissed the prompt without answering.
  PRODUCTION_PROMPTED: 'PRODUCTION_PROMPTED',
  PRODUCTION_SUBMITTED: 'PRODUCTION_SUBMITTED',
  PRODUCTION_SKIPPED: 'PRODUCTION_SKIPPED',

  // Organize Loop Events (Phase 8)
  // Symmetric with the production loop: SUGGESTED when the brain
  // heartbeat detects a cluster and notifies; ACCEPTED when the user
  // clicks "Create board with these concepts"; DISMISSED when the user
  // clicks "Not now". Together they let analytics compute the
  // suggest→accept conversion rate per cluster type.
  ORGANIZE_SUGGESTED: 'ORGANIZE_SUGGESTED',
  ORGANIZE_ACCEPTED: 'ORGANIZE_ACCEPTED',
  ORGANIZE_DISMISSED: 'ORGANIZE_DISMISSED',

  // MoodBoard Arrange Events (Phase 3)
  // Emitted when the user re-arranges cards on a MoodBoard (drag-reorder,
  // grid resize, layout change). Lets the Brain track engagement depth with
  // organized knowledge beyond creation alone.
  BOARD_ARRANGED: 'BOARD_ARRANGED',
};

module.exports = EpisodeCollector;
