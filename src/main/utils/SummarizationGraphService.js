/**
 * SummarizationGraphService.js
 *
 * Manages :SUMMARIZES relationships in Neo4j, connecting:
 * - Episodes → ConsolidatedMemory (via :CONSOLIDATED_INTO)
 * - ConsolidatedMemory → Concept (via :SUMMARIZES)
 * - ConsolidatedMemory → ConsolidatedMemory (via :MEMORY_RELATES)
 *
 * This service enables hierarchical learning memory queries:
 * - Get all memories summarizing a concept
 * - Get all episodes that contributed to a memory
 * - Find memory chains (prerequisite sequences)
 * - Calculate aggregated mastery from memories
 * - Find memory gaps (concepts without recent memories)
 *
 * Relationship Properties:
 *
 * :CONSOLIDATED_INTO (Episode → ConsolidatedMemory)
 *   - weight: 0.0-1.0 (contribution weight)
 *   - position: 1-N (order in sequence)
 *   - contribution: 'primary' | 'supporting' | 'contextual'
 *
 * :SUMMARIZES (ConsolidatedMemory → Concept)
 *   - weight: 0.0-1.0 (how strongly memory represents concept)
 *   - confidence: 0.0-1.0 (confidence in summarization)
 *   - isPrimary: boolean (is this the primary concept?)
 *   - aspectsCovered: ['definition', 'examples', 'relationships', ...]
 *   - masteryContribution: 'positive' | 'negative' | 'neutral'
 *
 * :MEMORY_RELATES (ConsolidatedMemory → ConsolidatedMemory)
 *   - relationType: 'prerequisite' | 'builds_on' | 'contrasts' | 'clusters_with'
 *   - strength: 0.0-1.0
 */

// Relationship type constants
const RELATIONSHIP_TYPES = {
  CONSOLIDATED_INTO: 'CONSOLIDATED_INTO',
  SUMMARIZES: 'SUMMARIZES',
  MEMORY_RELATES: 'MEMORY_RELATES',
  HAS_MEMORY: 'HAS_MEMORY',
};

// Contribution types for episodes
const CONTRIBUTION_TYPES = {
  PRIMARY: 'primary',
  SUPPORTING: 'supporting',
  CONTEXTUAL: 'contextual',
};

// Memory relation types
const MEMORY_RELATION_TYPES = {
  PREREQUISITE: 'prerequisite',
  BUILDS_ON: 'builds_on',
  CONTRASTS: 'contrasts',
  CLUSTERS_WITH: 'clusters_with',
};

// Mastery contribution types
const MASTERY_CONTRIBUTIONS = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
};

class SummarizationGraphService {
  /**
   * @param {Object} services - Required services
   * @param {Object} services.neo4jAdapter - Neo4j adapter instance
   * @param {Object} services.store - electron-store instance (optional)
   */
  constructor(services = {}) {
    this.neo4jAdapter = services.neo4jAdapter;
    this.store = services.store;
  }

  /**
   * Check if Neo4j is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.neo4jAdapter?.checkConnection() || false;
  }

  // ===========================================================================
  // MEMORY NODE OPERATIONS
  // ===========================================================================

  /**
   * Create or update a ConsolidatedMemory node in Neo4j
   * @param {Object} memory - Memory data
   * @param {number} userId - User ID
   * @returns {Object} Created/updated memory node
   */
  async upsertConsolidatedMemory(memory, userId) {
    if (!this.isAvailable()) {
      console.warn('[SummarizationGraph] Neo4j not available');
      return null;
    }

    const query = `
      MERGE (m:ConsolidatedMemory {id: $id})
      ON CREATE SET
        m.userId = $userId,
        m.conceptId = $conceptId,
        m.conceptName = $conceptName,
        m.memoryType = $memoryType,
        m.periodStart = datetime($periodStart),
        m.periodEnd = datetime($periodEnd),
        m.episodeCount = $episodeCount,
        m.summary = $summary,
        m.insights = $insights,
        m.masteryAssessment = $masteryAssessment,
        m.learningStyle = $learningStyle,
        m.recommendations = $recommendations,
        m.metrics = $metrics,
        m.createdAt = datetime(),
        m.t_valid = datetime(),
        m.t_invalid = null
      ON MATCH SET
        m.summary = $summary,
        m.insights = $insights,
        m.masteryAssessment = $masteryAssessment,
        m.learningStyle = $learningStyle,
        m.recommendations = $recommendations,
        m.metrics = $metrics,
        m.updatedAt = datetime()
      RETURN m
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, {
        id: memory.id,
        userId,
        conceptId: memory.conceptId || null,
        conceptName: memory.conceptName || null,
        memoryType: memory.memoryType,
        periodStart: memory.periodStart,
        periodEnd: memory.periodEnd,
        episodeCount: memory.episodeCount,
        summary: memory.summary,
        insights: JSON.stringify(memory.insights || []),
        masteryAssessment: memory.masteryAssessment || null,
        learningStyle: memory.learningStyle || null,
        recommendations: JSON.stringify(memory.recommendations || []),
        metrics: JSON.stringify(memory.metrics || memory.learningProcess || {}),
      });

      return result.records[0]?.get('m')?.properties;
    } catch (err) {
      console.error('[SummarizationGraph] Error upserting memory:', err);
      throw err;
    }
  }

  /**
   * Delete a ConsolidatedMemory node and its relationships
   * @param {string} memoryId - Memory ID
   * @returns {Object} Deletion result
   */
  async deleteConsolidatedMemory(memoryId) {
    if (!this.isAvailable()) return { deleted: 0 };

    const query = `
      MATCH (m:ConsolidatedMemory {id: $memoryId})
      OPTIONAL MATCH (m)-[r]-()
      DELETE r, m
      RETURN count(m) as deleted
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { memoryId });
      return { deleted: result.records[0]?.get('deleted') || 0 };
    } catch (err) {
      console.error('[SummarizationGraph] Error deleting memory:', err);
      throw err;
    }
  }

  /**
   * Get a memory by ID
   * @param {string} memoryId - Memory ID
   * @returns {Object|null}
   */
  async getMemoryById(memoryId) {
    if (!this.isAvailable()) return null;

    const query = `
      MATCH (m:ConsolidatedMemory {id: $memoryId})
      RETURN m
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { memoryId });
      const node = result.records[0]?.get('m');
      return node ? this.parseMemoryNode(node) : null;
    } catch (err) {
      console.error('[SummarizationGraph] Error getting memory:', err);
      return null;
    }
  }

  // ===========================================================================
  // EPISODE → MEMORY RELATIONSHIPS (:CONSOLIDATED_INTO)
  // ===========================================================================

  /**
   * Link episodes to their consolidated memory
   * @param {Array} episodeIds - Array of episode IDs
   * @param {string} memoryId - Memory ID
   * @param {Object} options - Options
   * @param {boolean} options.calculateWeights - Auto-calculate weights based on position
   * @returns {Object} Result with count of relationships created
   */
  async linkEpisodesToMemory(episodeIds, memoryId, options = {}) {
    if (!this.isAvailable() || !episodeIds?.length) {
      return { created: 0 };
    }

    const { calculateWeights = true } = options;

    // Build episode data with positions
    const episodesWithPosition = episodeIds.map((id, index) => ({
      id,
      position: index + 1,
      weight: calculateWeights ? this.calculateEpisodeWeight(index, episodeIds.length) : 1.0,
      contribution: this.determineContribution(index, episodeIds.length),
    }));

    const query = `
      UNWIND $episodes AS ep
      MATCH (e:Episode {id: ep.id})
      MATCH (m:ConsolidatedMemory {id: $memoryId})
      MERGE (e)-[r:CONSOLIDATED_INTO]->(m)
      SET r.weight = ep.weight,
          r.position = ep.position,
          r.contribution = ep.contribution,
          r.createdAt = datetime()
      RETURN count(r) as created
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, {
        episodes: episodesWithPosition,
        memoryId,
      });
      return { created: result.records[0]?.get('created') || 0 };
    } catch (err) {
      console.error('[SummarizationGraph] Error linking episodes:', err);
      throw err;
    }
  }

  /**
   * Calculate weight for an episode based on its position
   * Later episodes are weighted more (recency bias)
   * @param {number} index - Position index (0-based)
   * @param {number} total - Total number of episodes
   * @returns {number} Weight 0.0-1.0
   */
  calculateEpisodeWeight(index, total) {
    if (total <= 1) return 1.0;
    // Linear recency bias: later episodes get higher weight
    const baseWeight = 0.5;
    const recencyBonus = 0.5 * (index / (total - 1));
    return Math.min(1.0, baseWeight + recencyBonus);
  }

  /**
   * Determine contribution type based on position
   * @param {number} index - Position index
   * @param {number} total - Total episodes
   * @returns {string} Contribution type
   */
  determineContribution(index, total) {
    if (total <= 2) return CONTRIBUTION_TYPES.PRIMARY;
    if (index === 0 || index === total - 1) return CONTRIBUTION_TYPES.PRIMARY;
    if (index < total / 3) return CONTRIBUTION_TYPES.SUPPORTING;
    return CONTRIBUTION_TYPES.CONTEXTUAL;
  }

  /**
   * Get all episodes that contributed to a memory
   * @param {string} memoryId - Memory ID
   * @param {number} limit - Max results
   * @returns {Array} Episodes with relationship data
   */
  async getSourceEpisodes(memoryId, limit = 100) {
    if (!this.isAvailable()) return [];

    const query = `
      MATCH (e:Episode)-[r:CONSOLIDATED_INTO]->(m:ConsolidatedMemory {id: $memoryId})
      RETURN e, r
      ORDER BY r.position ASC
      LIMIT $limit
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { memoryId, limit });
      return result.records.map((record) => ({
        episode: this.parseEpisodeNode(record.get('e')),
        relationship: this.parseRelationship(record.get('r')),
      }));
    } catch (err) {
      console.error('[SummarizationGraph] Error getting source episodes:', err);
      return [];
    }
  }

  /**
   * Get the memory that an episode was consolidated into
   * @param {string} episodeId - Episode ID
   * @returns {Object|null} Memory with relationship data
   */
  async getMemoryForEpisode(episodeId) {
    if (!this.isAvailable()) return null;

    const query = `
      MATCH (e:Episode {id: $episodeId})-[r:CONSOLIDATED_INTO]->(m:ConsolidatedMemory)
      RETURN m, r
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { episodeId });
      if (result.records.length === 0) return null;

      return {
        memory: this.parseMemoryNode(result.records[0].get('m')),
        relationship: this.parseRelationship(result.records[0].get('r')),
      };
    } catch (err) {
      console.error('[SummarizationGraph] Error getting memory for episode:', err);
      return null;
    }
  }

  // ===========================================================================
  // MEMORY → CONCEPT RELATIONSHIPS (:SUMMARIZES)
  // ===========================================================================

  /**
   * Create :SUMMARIZES relationship with properties
   * @param {string} memoryId - Memory ID
   * @param {string} conceptId - Concept ID
   * @param {Object} properties - Relationship properties
   * @returns {Object} Created relationship
   */
  async createSummarizesRelationship(memoryId, conceptId, properties = {}) {
    if (!this.isAvailable()) return null;

    const {
      weight = 1.0,
      confidence = 0.8,
      isPrimary = false,
      aspectsCovered = [],
      masteryContribution = MASTERY_CONTRIBUTIONS.NEUTRAL,
    } = properties;

    const query = `
      MATCH (m:ConsolidatedMemory {id: $memoryId})
      MATCH (c:Concept {id: $conceptId})
      MERGE (m)-[r:SUMMARIZES]->(c)
      SET r.weight = $weight,
          r.confidence = $confidence,
          r.isPrimary = $isPrimary,
          r.aspectsCovered = $aspectsCovered,
          r.masteryContribution = $masteryContribution,
          r.createdAt = datetime()
      RETURN r
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, {
        memoryId,
        conceptId,
        weight,
        confidence,
        isPrimary,
        aspectsCovered,
        masteryContribution,
      });
      return this.parseRelationship(result.records[0]?.get('r'));
    } catch (err) {
      console.error('[SummarizationGraph] Error creating SUMMARIZES:', err);
      throw err;
    }
  }

  /**
   * Link a memory to multiple concepts with weights
   * @param {string} memoryId - Memory ID
   * @param {Array} concepts - Array of concept objects {id, name, weight, isPrimary, aspectsCovered}
   * @returns {Object} Result with count
   */
  async linkMemoryToConcepts(memoryId, concepts) {
    if (!this.isAvailable() || !concepts?.length) {
      return { created: 0 };
    }

    // First, ensure concepts exist (create if needed)
    const ensureQuery = `
      UNWIND $concepts AS c
      MERGE (concept:Concept {id: c.id})
      ON CREATE SET
        concept.name = c.name,
        concept.createdAt = datetime()
      RETURN count(concept) as ensured
    `;

    // Then create relationships
    const linkQuery = `
      UNWIND $concepts AS c
      MATCH (m:ConsolidatedMemory {id: $memoryId})
      MATCH (concept:Concept {id: c.id})
      MERGE (m)-[r:SUMMARIZES]->(concept)
      SET r.weight = coalesce(c.weight, 1.0),
          r.confidence = coalesce(c.confidence, 0.8),
          r.isPrimary = coalesce(c.isPrimary, false),
          r.aspectsCovered = coalesce(c.aspectsCovered, []),
          r.masteryContribution = coalesce(c.masteryContribution, 'neutral'),
          r.createdAt = datetime()
      RETURN count(r) as created
    `;

    try {
      await this.neo4jAdapter.runQuery(ensureQuery, { concepts });
      const result = await this.neo4jAdapter.runQuery(linkQuery, {
        memoryId,
        concepts,
      });
      return { created: result.records[0]?.get('created') || 0 };
    } catch (err) {
      console.error('[SummarizationGraph] Error linking memory to concepts:', err);
      throw err;
    }
  }

  /**
   * Get all concepts summarized by a memory
   * @param {string} memoryId - Memory ID
   * @returns {Array} Concepts with relationship data
   */
  async getConceptsForMemory(memoryId) {
    if (!this.isAvailable()) return [];

    const query = `
      MATCH (m:ConsolidatedMemory {id: $memoryId})-[r:SUMMARIZES]->(c:Concept)
      RETURN c, r
      ORDER BY r.isPrimary DESC, r.weight DESC
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { memoryId });
      return result.records.map((record) => ({
        concept: record.get('c')?.properties,
        relationship: this.parseRelationship(record.get('r')),
      }));
    } catch (err) {
      console.error('[SummarizationGraph] Error getting concepts for memory:', err);
      return [];
    }
  }

  /**
   * Get all memories that summarize a concept
   * @param {string} conceptId - Concept ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Max results
   * @param {string} options.memoryType - Filter by memory type
   * @param {boolean} options.primaryOnly - Only get memories where this is primary concept
   * @returns {Array} Memories with relationship data
   */
  async getMemoriesForConcept(conceptId, options = {}) {
    if (!this.isAvailable()) return [];

    const { limit = 50, memoryType = null, primaryOnly = false } = options;

    let query = `
      MATCH (m:ConsolidatedMemory)-[r:SUMMARIZES]->(c:Concept {id: $conceptId})
    `;

    if (memoryType) {
      query += ` WHERE m.memoryType = $memoryType`;
    }

    if (primaryOnly) {
      query += memoryType ? ' AND r.isPrimary = true' : ' WHERE r.isPrimary = true';
    }

    query += `
      RETURN m, r
      ORDER BY m.periodEnd DESC
      LIMIT $limit
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, {
        conceptId,
        memoryType,
        limit,
      });
      return result.records.map((record) => ({
        memory: this.parseMemoryNode(record.get('m')),
        relationship: this.parseRelationship(record.get('r')),
      }));
    } catch (err) {
      console.error('[SummarizationGraph] Error getting memories for concept:', err);
      return [];
    }
  }

  /**
   * Calculate aggregated mastery for a concept from its memories
   * Uses weighted average with recency bias
   * @param {string} conceptId - Concept ID
   * @returns {Object} Aggregated mastery data
   */
  async calculateConceptMasteryFromMemories(conceptId) {
    if (!this.isAvailable()) return null;

    const query = `
      MATCH (m:ConsolidatedMemory)-[r:SUMMARIZES]->(c:Concept {id: $conceptId})
      WHERE m.masteryAssessment IS NOT NULL
      WITH c, m, r,
           CASE m.masteryAssessment
             WHEN 'mastered' THEN 1.0
             WHEN 'proficient' THEN 0.75
             WHEN 'developing' THEN 0.5
             WHEN 'beginner' THEN 0.25
             ELSE 0.0
           END AS masteryScore,
           duration.between(m.periodEnd, datetime()).days AS daysAgo
      WITH c, m, r, masteryScore,
           CASE WHEN daysAgo < 0 THEN 1.0
                WHEN daysAgo > 90 THEN 0.5
                ELSE 1.0 - (daysAgo / 180.0)
           END AS recencyWeight
      RETURN c.id AS conceptId,
             c.name AS conceptName,
             count(m) AS memoryCount,
             collect({
               memoryId: m.id,
               mastery: m.masteryAssessment,
               score: masteryScore,
               weight: r.weight * r.confidence * recencyWeight,
               periodEnd: m.periodEnd
             }) AS memories,
             sum(masteryScore * r.weight * r.confidence * recencyWeight) /
               sum(r.weight * r.confidence * recencyWeight) AS aggregatedMastery
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { conceptId });
      if (result.records.length === 0) return null;

      const record = result.records[0];
      const aggregatedMastery = record.get('aggregatedMastery');

      return {
        conceptId: record.get('conceptId'),
        conceptName: record.get('conceptName'),
        memoryCount: record.get('memoryCount'),
        memories: record.get('memories'),
        aggregatedMastery: aggregatedMastery != null ? Number(aggregatedMastery.toFixed(3)) : null,
        masteryLevel: this.masteryScoreToLevel(aggregatedMastery),
      };
    } catch (err) {
      console.error('[SummarizationGraph] Error calculating mastery:', err);
      return null;
    }
  }

  /**
   * Convert mastery score (0-1) to level string
   * @param {number} score
   * @returns {string}
   */
  masteryScoreToLevel(score) {
    if (score == null) return 'unknown';
    if (score >= 0.9) return 'mastered';
    if (score >= 0.7) return 'proficient';
    if (score >= 0.4) return 'developing';
    return 'beginner';
  }

  // ===========================================================================
  // MEMORY → MEMORY RELATIONSHIPS (:MEMORY_RELATES)
  // ===========================================================================

  /**
   * Create relationship between related memories
   * @param {string} memoryId1 - First memory ID
   * @param {string} memoryId2 - Second memory ID
   * @param {string} relationType - Type of relationship
   * @param {number} strength - Relationship strength 0.0-1.0
   * @returns {Object} Created relationship
   */
  async linkRelatedMemories(memoryId1, memoryId2, relationType, strength = 0.5) {
    if (!this.isAvailable()) return null;

    const query = `
      MATCH (m1:ConsolidatedMemory {id: $memoryId1})
      MATCH (m2:ConsolidatedMemory {id: $memoryId2})
      MERGE (m1)-[r:MEMORY_RELATES]->(m2)
      SET r.relationType = $relationType,
          r.strength = $strength,
          r.createdAt = datetime()
      RETURN r
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, {
        memoryId1,
        memoryId2,
        relationType,
        strength,
      });
      return this.parseRelationship(result.records[0]?.get('r'));
    } catch (err) {
      console.error('[SummarizationGraph] Error linking memories:', err);
      throw err;
    }
  }

  /**
   * Find memories related to a given memory
   * @param {string} memoryId - Memory ID
   * @param {string} relationType - Optional filter by relation type
   * @returns {Array} Related memories with relationship data
   */
  async getRelatedMemories(memoryId, relationType = null) {
    if (!this.isAvailable()) return [];

    let query = `
      MATCH (m1:ConsolidatedMemory {id: $memoryId})-[r:MEMORY_RELATES]-(m2:ConsolidatedMemory)
    `;

    if (relationType) {
      query += ` WHERE r.relationType = $relationType`;
    }

    query += `
      RETURN m2, r,
             CASE startNode(r) WHEN m1 THEN 'outgoing' ELSE 'incoming' END AS direction
      ORDER BY r.strength DESC
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { memoryId, relationType });
      return result.records.map((record) => ({
        memory: this.parseMemoryNode(record.get('m2')),
        relationship: this.parseRelationship(record.get('r')),
        direction: record.get('direction'),
      }));
    } catch (err) {
      console.error('[SummarizationGraph] Error getting related memories:', err);
      return [];
    }
  }

  /**
   * Find memory chains (prerequisite sequences)
   * @param {string} memoryId - Starting memory ID
   * @param {string} direction - 'outgoing', 'incoming', or 'both'
   * @param {number} maxDepth - Maximum chain depth
   * @returns {Array} Memory chain
   */
  async getMemoryChain(memoryId, direction = 'both', maxDepth = 5) {
    if (!this.isAvailable()) return [];

    let relationPattern;
    switch (direction) {
      case 'outgoing':
        relationPattern = '-[r:MEMORY_RELATES*1..5]->';
        break;
      case 'incoming':
        relationPattern = '<-[r:MEMORY_RELATES*1..5]-';
        break;
      default:
        relationPattern = '-[r:MEMORY_RELATES*1..5]-';
    }

    const query = `
      MATCH path = (start:ConsolidatedMemory {id: $memoryId})${relationPattern}(end:ConsolidatedMemory)
      WHERE length(path) <= $maxDepth
      UNWIND nodes(path) AS n
      WITH DISTINCT n, min(length(shortestPath((start)-[:MEMORY_RELATES*]-(n)))) AS depth
      RETURN n, depth
      ORDER BY depth ASC
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { memoryId, maxDepth });
      return result.records.map((record) => ({
        memory: this.parseMemoryNode(record.get('n')),
        depth: record.get('depth'),
      }));
    } catch (err) {
      console.error('[SummarizationGraph] Error getting memory chain:', err);
      return [];
    }
  }

  // ===========================================================================
  // HIERARCHICAL QUERIES
  // ===========================================================================

  /**
   * Get full summarization hierarchy for a concept
   * Returns: concept → memories → episodes
   * @param {string} conceptId - Concept ID
   * @param {Object} options - Query options
   * @returns {Object} Hierarchical data
   */
  async getSummarizationHierarchy(conceptId, options = {}) {
    if (!this.isAvailable()) return null;

    const { includeEpisodes = true, maxEpisodes = 10, limit = 20 } = options;

    let query = `
      MATCH (c:Concept {id: $conceptId})
      OPTIONAL MATCH (m:ConsolidatedMemory)-[rs:SUMMARIZES]->(c)
    `;

    if (includeEpisodes) {
      query += `
        OPTIONAL MATCH (e:Episode)-[rc:CONSOLIDATED_INTO]->(m)
        WITH c, m, rs, collect({
          episode: e,
          relationship: rc
        })[0..$maxEpisodes] AS episodes
      `;
    } else {
      query += `
        WITH c, m, rs, [] AS episodes
      `;
    }

    query += `
      RETURN c,
             collect({
               memory: m,
               summarizes: rs,
               episodes: episodes
             })[0..$limit] AS hierarchy
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, {
        conceptId,
        maxEpisodes,
        limit,
      });

      if (result.records.length === 0) return null;

      const record = result.records[0];
      const concept = record.get('c')?.properties;
      const hierarchy = record.get('hierarchy') || [];

      return {
        concept,
        memories: hierarchy
          .filter((h) => h.memory)
          .map((h) => ({
            memory: this.parseMemoryNode(h.memory),
            summarizes: this.parseRelationship(h.summarizes),
            episodes: (h.episodes || [])
              .filter((ep) => ep.episode)
              .map((ep) => ({
                episode: this.parseEpisodeNode(ep.episode),
                relationship: this.parseRelationship(ep.relationship),
              })),
          })),
      };
    } catch (err) {
      console.error('[SummarizationGraph] Error getting hierarchy:', err);
      return null;
    }
  }

  /**
   * Get learning timeline for a concept (ordered by period)
   * @param {string} conceptId - Concept ID
   * @param {number} limit - Max results
   * @returns {Array} Timeline entries
   */
  async getConceptLearningTimeline(conceptId, limit = 50) {
    if (!this.isAvailable()) return [];

    const query = `
      MATCH (m:ConsolidatedMemory)-[r:SUMMARIZES]->(c:Concept {id: $conceptId})
      RETURN m, r
      ORDER BY m.periodEnd DESC
      LIMIT $limit
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { conceptId, limit });
      return result.records.map((record) => ({
        memory: this.parseMemoryNode(record.get('m')),
        relationship: this.parseRelationship(record.get('r')),
      }));
    } catch (err) {
      console.error('[SummarizationGraph] Error getting timeline:', err);
      return [];
    }
  }

  /**
   * Get cross-concept memory clusters
   * @param {number} userId - User ID
   * @param {number} limit - Max clusters
   * @returns {Array} Clusters with their concepts
   */
  async getCrossConceptClusters(userId, limit = 10) {
    if (!this.isAvailable()) return [];

    const query = `
      MATCH (m:ConsolidatedMemory {memoryType: 'cross_concept', userId: $userId})-[r:SUMMARIZES]->(c:Concept)
      WITH m, collect({concept: c, relationship: r}) AS concepts
      WHERE size(concepts) > 1
      RETURN m, concepts
      ORDER BY m.periodEnd DESC
      LIMIT $limit
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { userId, limit });
      return result.records.map((record) => ({
        memory: this.parseMemoryNode(record.get('m')),
        concepts: (record.get('concepts') || []).map((c) => ({
          concept: c.concept?.properties,
          relationship: this.parseRelationship(c.relationship),
        })),
      }));
    } catch (err) {
      console.error('[SummarizationGraph] Error getting clusters:', err);
      return [];
    }
  }

  // ===========================================================================
  // USER RELATIONSHIP
  // ===========================================================================

  /**
   * Link a memory to a user
   * @param {string} memoryId - Memory ID
   * @param {number} userId - User ID
   * @returns {Object} Created relationship
   */
  async linkMemoryToUser(memoryId, userId) {
    if (!this.isAvailable()) return null;

    const query = `
      MATCH (u:User {id: $userId})
      MATCH (m:ConsolidatedMemory {id: $memoryId})
      MERGE (u)-[r:HAS_MEMORY]->(m)
      SET r.createdAt = datetime()
      RETURN r
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, {
        userId: String(userId),
        memoryId,
      });
      return this.parseRelationship(result.records[0]?.get('r'));
    } catch (err) {
      console.warn('[SummarizationGraph] Error linking memory to user:', err.message);
      return null;
    }
  }

  // ===========================================================================
  // ANALYTICS
  // ===========================================================================

  /**
   * Get summarization statistics for a user
   * @param {number} userId - User ID
   * @returns {Object} Statistics
   */
  async getSummarizationStats(userId) {
    if (!this.isAvailable()) {
      return {
        totalMemories: 0,
        byType: {},
        totalEpisodes: 0,
        totalConcepts: 0,
        averageEpisodesPerMemory: 0,
        recentMemories: 0,
      };
    }

    const query = `
      MATCH (m:ConsolidatedMemory {userId: $userId})
      OPTIONAL MATCH (e:Episode)-[:CONSOLIDATED_INTO]->(m)
      OPTIONAL MATCH (m)-[:SUMMARIZES]->(c:Concept)
      WITH m, count(DISTINCT e) AS episodeCount, count(DISTINCT c) AS conceptCount
      RETURN count(m) AS totalMemories,
             collect(DISTINCT m.memoryType) AS memoryTypes,
             sum(episodeCount) AS totalEpisodes,
             sum(conceptCount) AS totalConcepts,
             avg(episodeCount) AS avgEpisodesPerMemory
    `;

    const recentQuery = `
      MATCH (m:ConsolidatedMemory {userId: $userId})
      WHERE m.createdAt > datetime() - duration({days: 7})
      RETURN count(m) AS recentMemories
    `;

    const byTypeQuery = `
      MATCH (m:ConsolidatedMemory {userId: $userId})
      RETURN m.memoryType AS memoryType, count(m) AS count
    `;

    try {
      const [mainResult, recentResult, byTypeResult] = await Promise.all([
        this.neo4jAdapter.runQuery(query, { userId }),
        this.neo4jAdapter.runQuery(recentQuery, { userId }),
        this.neo4jAdapter.runQuery(byTypeQuery, { userId }),
      ]);

      const main = mainResult.records[0];
      const recent = recentResult.records[0];
      const byType = {};
      byTypeResult.records.forEach((r) => {
        const type = r.get('memoryType');
        if (type) byType[type] = r.get('count');
      });

      return {
        totalMemories: main?.get('totalMemories') || 0,
        byType,
        totalEpisodes: main?.get('totalEpisodes') || 0,
        totalConcepts: main?.get('totalConcepts') || 0,
        averageEpisodesPerMemory: Number((main?.get('avgEpisodesPerMemory') || 0).toFixed(1)),
        recentMemories: recent?.get('recentMemories') || 0,
      };
    } catch (err) {
      console.error('[SummarizationGraph] Error getting stats:', err);
      return {
        totalMemories: 0,
        byType: {},
        totalEpisodes: 0,
        totalConcepts: 0,
        averageEpisodesPerMemory: 0,
        recentMemories: 0,
      };
    }
  }

  /**
   * Get memory coverage analysis (which concepts have most/least memories)
   * @param {number} userId - User ID
   * @param {number} limit - Max results
   * @returns {Array} Coverage data sorted by memory count
   */
  async getMemoryCoverage(userId, limit = 20) {
    if (!this.isAvailable()) return [];

    const query = `
      MATCH (c:Concept)
      OPTIONAL MATCH (m:ConsolidatedMemory {userId: $userId})-[r:SUMMARIZES]->(c)
      WITH c, count(m) AS memoryCount, max(m.periodEnd) AS lastMemory
      RETURN c.id AS conceptId,
             c.name AS conceptName,
             memoryCount,
             lastMemory
      ORDER BY memoryCount DESC
      LIMIT $limit
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, { userId, limit });
      return result.records.map((r) => ({
        conceptId: r.get('conceptId'),
        conceptName: r.get('conceptName'),
        memoryCount: r.get('memoryCount'),
        lastMemory: r.get('lastMemory'),
      }));
    } catch (err) {
      console.error('[SummarizationGraph] Error getting coverage:', err);
      return [];
    }
  }

  /**
   * Find gaps in memory coverage (concepts without recent memories)
   * @param {number} userId - User ID
   * @param {number} daysSinceLastMemory - Days threshold
   * @returns {Array} Concepts with memory gaps
   */
  async findMemoryGaps(userId, daysSinceLastMemory = 30) {
    if (!this.isAvailable()) return [];

    const query = `
      MATCH (c:Concept)
      WHERE EXISTS {
        (c)<-[:MENTIONS_CONCEPT]-(:Note {userId: $userId})
      }
      OPTIONAL MATCH (m:ConsolidatedMemory {userId: $userId})-[:SUMMARIZES]->(c)
      WHERE m.periodEnd > datetime() - duration({days: $days})
      WITH c, count(m) AS recentMemories
      WHERE recentMemories = 0
      OPTIONAL MATCH (oldM:ConsolidatedMemory {userId: $userId})-[:SUMMARIZES]->(c)
      RETURN c.id AS conceptId,
             c.name AS conceptName,
             max(oldM.periodEnd) AS lastMemory,
             count(oldM) AS totalMemories
      ORDER BY totalMemories DESC, conceptName ASC
      LIMIT 50
    `;

    try {
      const result = await this.neo4jAdapter.runQuery(query, {
        userId,
        days: daysSinceLastMemory,
      });
      return result.records.map((r) => ({
        conceptId: r.get('conceptId'),
        conceptName: r.get('conceptName'),
        lastMemory: r.get('lastMemory'),
        totalMemories: r.get('totalMemories'),
        daysSinceLastMemory:
          r.get('lastMemory')
            ? Math.floor(
                (Date.now() - new Date(r.get('lastMemory')).getTime()) / (1000 * 60 * 60 * 24)
              )
            : null,
      }));
    } catch (err) {
      console.error('[SummarizationGraph] Error finding gaps:', err);
      return [];
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Parse a Neo4j memory node
   * @param {Object} node
   * @returns {Object}
   */
  parseMemoryNode(node) {
    if (!node) return null;
    const props = node.properties || node;
    return {
      id: props.id,
      userId: props.userId,
      conceptId: props.conceptId,
      conceptName: props.conceptName,
      memoryType: props.memoryType,
      periodStart: props.periodStart,
      periodEnd: props.periodEnd,
      episodeCount: props.episodeCount,
      summary: props.summary,
      insights: this.safeJsonParse(props.insights, []),
      masteryAssessment: props.masteryAssessment,
      learningStyle: props.learningStyle,
      recommendations: this.safeJsonParse(props.recommendations, []),
      metrics: this.safeJsonParse(props.metrics, {}),
      createdAt: props.createdAt,
    };
  }

  /**
   * Parse a Neo4j episode node
   * @param {Object} node
   * @returns {Object}
   */
  parseEpisodeNode(node) {
    if (!node) return null;
    const props = node.properties || node;
    return {
      id: props.id,
      userId: props.userId,
      eventType: props.eventType,
      timestamp: props.timestamp,
      t_valid: props.t_valid,
      t_invalid: props.t_invalid,
      payload: this.safeJsonParse(props.payload, {}),
      sourceContext: this.safeJsonParse(props.sourceContext, {}),
      processed: props.processed,
      processedAt: props.processedAt,
      consolidatedInto: props.consolidatedInto,
    };
  }

  /**
   * Parse a Neo4j relationship
   * @param {Object} rel
   * @returns {Object|null}
   */
  parseRelationship(rel) {
    if (!rel) return null;
    const props = rel.properties || rel;
    return {
      type: rel.type,
      ...props,
    };
  }

  /**
   * Safely parse JSON string
   * @param {string} jsonStr
   * @param {*} defaultValue
   * @returns {*}
   */
  safeJsonParse(jsonStr, defaultValue) {
    if (!jsonStr) return defaultValue;
    if (typeof jsonStr === 'object') return jsonStr;
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      return defaultValue;
    }
  }
}

// Export constants
module.exports = SummarizationGraphService;
module.exports.RELATIONSHIP_TYPES = RELATIONSHIP_TYPES;
module.exports.CONTRIBUTION_TYPES = CONTRIBUTION_TYPES;
module.exports.MEMORY_RELATION_TYPES = MEMORY_RELATION_TYPES;
module.exports.MASTERY_CONTRIBUTIONS = MASTERY_CONTRIBUTIONS;
