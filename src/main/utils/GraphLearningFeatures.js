/**
 * GraphLearningFeatures.js
 *
 * Advanced learning features powered by Neo4j graph database:
 * - Learning Paths: Prerequisites, concept dependencies, personalized learning routes
 * - Weak Concepts: Detection of concepts that need more practice
 * - Entity Resolution: Linking related concepts across notes, books, and vocabulary
 * - Knowledge Graph: Building connections between learned content
 *
 * These features leverage Neo4j's graph traversal capabilities to provide
 * insights that would be impossible with a relational database.
 */

import graphInterface from './GraphInterface';
import { getUserIdFromToken } from '../db/dbManager';

class GraphLearningFeatures {
  constructor() {
    if (GraphLearningFeatures.instance) {
      return GraphLearningFeatures.instance;
    }
    GraphLearningFeatures.instance = this;
  }

  /**
   * Check if graph features are available
   */
  isAvailable() {
    return graphInterface.checkConnection();
  }

  // ===========================================================================
  // LEARNING PATH FEATURES
  // ===========================================================================

  /**
   * Create a concept with prerequisites
   * @param {Object} concept - Concept data { name, description, domain, difficulty }
   * @param {Array<string>} prerequisiteIds - IDs of prerequisite concepts
   * @param {string} token - User token
   * @returns {Object|null} Created concept
   */
  async createConceptWithPrereqs(concept, prerequisiteIds = [], token) {
    if (!this.isAvailable()) return null;

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return null;

      const userId = getUserIdFromToken(token);
      const conceptId = `concept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create the concept
      const result = await session.run(
        `
        MERGE (c:Concept {name: $name, userId: $userId})
        ON CREATE SET
          c.id = $conceptId,
          c.description = $description,
          c.domain = $domain,
          c.difficulty = $difficulty,
          c.masteryLevel = 0,
          c.reviewCount = 0,
          c.lastReviewedAt = null,
          c.createdAt = datetime()
        ON MATCH SET
          c.description = COALESCE($description, c.description),
          c.domain = COALESCE($domain, c.domain),
          c.difficulty = COALESCE($difficulty, c.difficulty)
        RETURN c
        `,
        {
          conceptId,
          name: concept.name,
          description: concept.description || '',
          domain: concept.domain || 'general',
          difficulty: concept.difficulty || 'intermediate',
          userId: String(userId),
        },
      );

      if (result.records.length === 0) return null;

      const createdConcept = result.records[0].get('c').properties;

      // Create prerequisite relationships
      for (const prereqId of prerequisiteIds) {
        await session.run(
          `
          MATCH (c:Concept {id: $conceptId})
          MATCH (p:Concept {id: $prereqId})
          MERGE (c)-[r:REQUIRES]->(p)
          ON CREATE SET r.createdAt = datetime()
          `,
          { conceptId: createdConcept.id, prereqId },
        );
      }

      return createdConcept;
    } catch (e) {
      console.error('Error creating concept:', e);
      return null;
    }
  }

  /**
   * Get personalized learning path to master a target concept
   * Considers current mastery levels and prerequisites
   * @param {string} targetConceptId - Target concept to learn
   * @param {string} token - User token
   * @returns {Object} Learning path with ordered concepts to study
   */
  async getPersonalizedLearningPath(targetConceptId, token) {
    if (!this.isAvailable()) return null;

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return null;

      const userId = getUserIdFromToken(token);

      // Find all prerequisites recursively, ordered by depth and mastery
      const result = await session.run(
        `
        MATCH (target:Concept {id: $targetId, userId: $userId})
        OPTIONAL MATCH path = (target)<-[:REQUIRES*]-(prereq:Concept {userId: $userId})
        WITH target, prereq, length(path) AS depth
        WHERE prereq IS NULL OR prereq.masteryLevel < 70
        WITH COLLECT({
          concept: COALESCE(prereq, target),
          depth: COALESCE(depth, 0),
          mastery: COALESCE(prereq.masteryLevel, target.masteryLevel, 0)
        }) AS concepts
        UNWIND concepts AS c
        WITH c.concept AS concept, c.depth AS depth, c.mastery AS mastery
        ORDER BY depth DESC, mastery ASC
        RETURN DISTINCT
          concept.id AS id,
          concept.name AS name,
          concept.description AS description,
          concept.difficulty AS difficulty,
          concept.masteryLevel AS mastery,
          depth
        `,
        {
          targetId: String(targetConceptId),
          userId: String(userId),
        },
      );

      const path = result.records.map((record) => ({
        id: record.get('id'),
        name: record.get('name'),
        description: record.get('description'),
        difficulty: record.get('difficulty'),
        mastery: record.get('mastery'),
        depth: record.get('depth'),
      }));

      // Calculate estimated study time based on mastery gaps
      const estimatedTime = path.reduce((total, concept) => {
        const masteryGap = 70 - (concept.mastery || 0);
        return total + Math.ceil(masteryGap / 10) * 15; // 15 min per 10% mastery
      }, 0);

      return {
        targetConceptId,
        path,
        conceptCount: path.length,
        estimatedMinutes: estimatedTime,
        nextConcept: path[0] || null,
      };
    } catch (e) {
      console.error('Error getting learning path:', e);
      return null;
    }
  }

  /**
   * Get concepts that depend on a given concept (forward dependencies)
   * @param {string} conceptId - Concept ID
   * @param {string} token - User token
   * @returns {Array} Concepts that require this concept
   */
  async getDependentConcepts(conceptId, token) {
    if (!this.isAvailable()) return [];

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return [];

      const userId = getUserIdFromToken(token);

      const result = await session.run(
        `
        MATCH (c:Concept {id: $conceptId, userId: $userId})
        MATCH (dependent:Concept {userId: $userId})-[:REQUIRES]->(c)
        RETURN
          dependent.id AS id,
          dependent.name AS name,
          dependent.masteryLevel AS mastery,
          dependent.difficulty AS difficulty
        `,
        { conceptId: String(conceptId), userId: String(userId) },
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        name: record.get('name'),
        mastery: record.get('mastery'),
        difficulty: record.get('difficulty'),
      }));
    } catch (e) {
      console.error('Error getting dependent concepts:', e);
      return [];
    }
  }

  // ===========================================================================
  // WEAK CONCEPTS DETECTION
  // ===========================================================================

  /**
   * Detect weak concepts based on review history and performance
   * @param {string} token - User token
   * @param {number} limit - Maximum concepts to return
   * @returns {Array} Weak concepts sorted by priority
   */
  async detectWeakConcepts(token, limit = 10) {
    if (!this.isAvailable()) return [];

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return [];

      const userId = getUserIdFromToken(token);

      // Find concepts with:
      // 1. Low mastery (<50%)
      // 2. High failure rate in recent reviews
      // 3. Many dependent concepts (blocking other learning)
      // 4. Not reviewed recently despite low mastery
      const result = await session.run(
        `
        MATCH (c:Concept {userId: $userId})
        WHERE c.masteryLevel < 50
        OPTIONAL MATCH (dependent:Concept {userId: $userId})-[:REQUIRES]->(c)
        WITH c, COUNT(dependent) AS dependentCount

        // Calculate weakness score
        WITH c, dependentCount,
             (50 - COALESCE(c.masteryLevel, 0)) AS masteryGap,
             CASE
               WHEN c.lastReviewedAt IS NULL THEN 100
               WHEN duration.between(c.lastReviewedAt, datetime()).days > 7 THEN 50
               ELSE 0
             END AS staleness,
             dependentCount * 10 AS blockingScore

        WITH c,
             masteryGap + staleness + blockingScore AS weaknessScore,
             dependentCount,
             masteryGap

        ORDER BY weaknessScore DESC
        LIMIT $limit

        RETURN
          c.id AS id,
          c.name AS name,
          c.description AS description,
          c.masteryLevel AS mastery,
          c.reviewCount AS reviewCount,
          c.lastReviewedAt AS lastReviewed,
          dependentCount,
          weaknessScore
        `,
        {
          userId: String(userId),
          limit: parseInt(limit, 10),
        },
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        name: record.get('name'),
        description: record.get('description'),
        mastery: record.get('mastery'),
        reviewCount: record.get('reviewCount'),
        lastReviewed: record.get('lastReviewed'),
        dependentCount: record.get('dependentCount'),
        weaknessScore: record.get('weaknessScore'),
        reason: this._getWeaknessReason(
          record.get('mastery'),
          record.get('dependentCount'),
          record.get('lastReviewed'),
        ),
      }));
    } catch (e) {
      console.error('Error detecting weak concepts:', e);
      return [];
    }
  }

  /**
   * Get human-readable reason for concept weakness
   */
  _getWeaknessReason(mastery, dependentCount, lastReviewed) {
    const reasons = [];

    if (mastery < 30) {
      reasons.push('Very low mastery - needs focused practice');
    } else if (mastery < 50) {
      reasons.push('Below threshold mastery');
    }

    if (dependentCount > 3) {
      reasons.push(`Blocking ${dependentCount} other concepts`);
    }

    if (!lastReviewed) {
      reasons.push('Never reviewed');
    }

    return reasons.join('; ') || 'Needs improvement';
  }

  /**
   * Get concepts where user frequently makes mistakes
   * @param {string} token - User token
   * @param {number} lookbackDays - Days to look back
   * @returns {Array} Concepts with high error rates
   */
  async getErrorProneTopics(token, lookbackDays = 30) {
    if (!this.isAvailable()) return [];

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return [];

      const userId = getUserIdFromToken(token);

      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[r:REVIEWED]->(item)
        WHERE r.timestamp > datetime() - duration({days: $days})
          AND r.outcome = 'incorrect'
        WITH item, COUNT(r) AS errorCount

        // Get concepts mentioned in those items
        OPTIONAL MATCH (item)-[:MENTIONS_CONCEPT]->(c:Concept)
        WITH c, SUM(errorCount) AS totalErrors
        WHERE c IS NOT NULL

        ORDER BY totalErrors DESC
        LIMIT 10

        RETURN
          c.id AS id,
          c.name AS name,
          c.masteryLevel AS mastery,
          totalErrors
        `,
        {
          userId: String(userId),
          days: parseInt(lookbackDays, 10),
        },
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        name: record.get('name'),
        mastery: record.get('mastery'),
        errorCount: record.get('totalErrors'),
      }));
    } catch (e) {
      console.error('Error getting error-prone topics:', e);
      return [];
    }
  }

  // ===========================================================================
  // ENTITY RESOLUTION
  // ===========================================================================

  /**
   * Find and link related concepts across different content types
   * Uses text similarity and co-occurrence patterns
   * @param {string} token - User token
   * @returns {Array} Groups of related concepts
   */
  async resolveRelatedConcepts(token) {
    if (!this.isAvailable()) return [];

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return [];

      const userId = getUserIdFromToken(token);

      // Find concepts that appear together in notes/vocabulary
      const result = await session.run(
        `
        MATCH (c1:Concept {userId: $userId})<-[:MENTIONS_CONCEPT]-(item)-[:MENTIONS_CONCEPT]->(c2:Concept {userId: $userId})
        WHERE c1.id < c2.id  // Avoid duplicates
        WITH c1, c2, COUNT(item) AS coOccurrence
        WHERE coOccurrence >= 2

        // Check if they're already linked
        OPTIONAL MATCH (c1)-[existing:RELATED_TO]-(c2)
        WHERE existing IS NULL

        RETURN
          c1.id AS concept1Id,
          c1.name AS concept1Name,
          c2.id AS concept2Id,
          c2.name AS concept2Name,
          coOccurrence,
          CASE WHEN existing IS NOT NULL THEN true ELSE false END AS alreadyLinked
        ORDER BY coOccurrence DESC
        LIMIT 20
        `,
        { userId: String(userId) },
      );

      return result.records.map((record) => ({
        concept1: {
          id: record.get('concept1Id'),
          name: record.get('concept1Name'),
        },
        concept2: {
          id: record.get('concept2Id'),
          name: record.get('concept2Name'),
        },
        coOccurrence: record.get('coOccurrence'),
        alreadyLinked: record.get('alreadyLinked'),
      }));
    } catch (e) {
      console.error('Error resolving related concepts:', e);
      return [];
    }
  }

  /**
   * Create a RELATED_TO relationship between concepts
   * @param {string} concept1Id - First concept ID
   * @param {string} concept2Id - Second concept ID
   * @param {string} relationType - Type of relationship (e.g., 'similar', 'opposite', 'example_of')
   * @param {number} strength - Relationship strength (0-1)
   */
  async linkConcepts(concept1Id, concept2Id, relationType = 'related', strength = 0.5) {
    if (!this.isAvailable()) return false;

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return false;

      await session.run(
        `
        MATCH (c1:Concept {id: $concept1Id})
        MATCH (c2:Concept {id: $concept2Id})
        MERGE (c1)-[r:RELATED_TO]->(c2)
        SET r.type = $relationType,
            r.strength = $strength,
            r.createdAt = datetime()
        `,
        {
          concept1Id: String(concept1Id),
          concept2Id: String(concept2Id),
          relationType,
          strength,
        },
      );

      return true;
    } catch (e) {
      console.error('Error linking concepts:', e);
      return false;
    }
  }

  /**
   * Extract concepts from text content (notes, messages, etc.)
   * Returns suggested concepts to create or link
   * @param {string} content - Text content to analyze
   * @param {string} token - User token
   * @returns {Object} Extracted concepts and suggestions
   */
  async extractConceptsFromText(content, token) {
    if (!this.isAvailable()) return { existing: [], suggested: [] };

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return { existing: [], suggested: [] };

      const userId = getUserIdFromToken(token);

      // Find existing concepts that appear in the content
      const result = await session.run(
        `
        MATCH (c:Concept {userId: $userId})
        WHERE toLower($content) CONTAINS toLower(c.name)
        RETURN c.id AS id, c.name AS name, c.masteryLevel AS mastery
        `,
        {
          userId: String(userId),
          content,
        },
      );

      const existing = result.records.map((record) => ({
        id: record.get('id'),
        name: record.get('name'),
        mastery: record.get('mastery'),
      }));

      // Extract potential new concepts (simple heuristic - noun phrases)
      // In production, this would use NLP
      const words = content.split(/\s+/);
      const capitalizedPhrases = [];
      let currentPhrase = [];

      for (const word of words) {
        if (word.match(/^[A-Z][a-z]+$/)) {
          currentPhrase.push(word);
        } else if (currentPhrase.length > 0) {
          if (currentPhrase.length >= 1) {
            capitalizedPhrases.push(currentPhrase.join(' '));
          }
          currentPhrase = [];
        }
      }

      // Filter out existing concepts
      const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
      const suggested = [...new Set(capitalizedPhrases)]
        .filter((phrase) => !existingNames.has(phrase.toLowerCase()))
        .slice(0, 10);

      return { existing, suggested };
    } catch (e) {
      console.error('Error extracting concepts:', e);
      return { existing: [], suggested: [] };
    }
  }

  /**
   * Get concept clusters (groups of related concepts)
   * @param {string} token - User token
   * @returns {Array} Concept clusters
   */
  async getConceptClusters(token) {
    if (!this.isAvailable()) return [];

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return [];

      const userId = getUserIdFromToken(token);

      // Find clusters based on RELATED_TO and REQUIRES relationships
      const result = await session.run(
        `
        MATCH (c:Concept {userId: $userId})
        OPTIONAL MATCH (c)-[:RELATED_TO|REQUIRES*1..2]-(related:Concept {userId: $userId})
        WITH c, COLLECT(DISTINCT related) AS cluster
        WHERE size(cluster) > 0
        WITH c.domain AS domain, COLLECT({center: c, related: cluster}) AS groups
        RETURN domain, groups
        `,
        { userId: String(userId) },
      );

      return result.records.map((record) => ({
        domain: record.get('domain'),
        groups: record.get('groups'),
      }));
    } catch (e) {
      console.error('Error getting concept clusters:', e);
      return [];
    }
  }

  // ===========================================================================
  // MASTERY TRACKING
  // ===========================================================================

  /**
   * Update concept mastery based on review outcome
   * @param {string} conceptId - Concept ID
   * @param {string} outcome - 'correct', 'incorrect', or 'skipped'
   * @param {string} token - User token
   */
  async updateConceptMastery(conceptId, outcome, token) {
    if (!this.isAvailable()) return null;

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return null;

      const userId = getUserIdFromToken(token);

      // Calculate mastery change
      const masteryChange =
        outcome === 'correct' ? 10 : outcome === 'incorrect' ? -15 : 0;

      const result = await session.run(
        `
        MATCH (c:Concept {id: $conceptId, userId: $userId})
        SET c.masteryLevel = CASE
              WHEN c.masteryLevel + $change < 0 THEN 0
              WHEN c.masteryLevel + $change > 100 THEN 100
              ELSE c.masteryLevel + $change
            END,
            c.reviewCount = COALESCE(c.reviewCount, 0) + 1,
            c.lastReviewedAt = datetime()

        // Create review record
        WITH c
        CREATE (c)-[:WAS_REVIEWED {
          outcome: $outcome,
          timestamp: datetime(),
          masteryBefore: c.masteryLevel - $change,
          masteryAfter: c.masteryLevel
        }]->(c)

        RETURN c.id AS id, c.name AS name, c.masteryLevel AS mastery
        `,
        {
          conceptId: String(conceptId),
          userId: String(userId),
          outcome,
          change: masteryChange,
        },
      );

      if (result.records.length === 0) return null;

      return {
        id: result.records[0].get('id'),
        name: result.records[0].get('name'),
        mastery: result.records[0].get('mastery'),
      };
    } catch (e) {
      console.error('Error updating concept mastery:', e);
      return null;
    }
  }

  /**
   * Get mastery progress over time
   * @param {string} token - User token
   * @param {number} days - Number of days to look back
   * @returns {Array} Daily mastery snapshots
   */
  async getMasteryProgress(token, days = 30) {
    if (!this.isAvailable()) return [];

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return [];

      const userId = getUserIdFromToken(token);

      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[r:REVIEWED]->(item)
        WHERE r.timestamp > datetime() - duration({days: $days})
        WITH date(r.timestamp) AS day,
             COUNT(CASE WHEN r.outcome = 'correct' THEN 1 END) AS correct,
             COUNT(r) AS total
        ORDER BY day
        RETURN day, correct, total,
               CASE WHEN total > 0 THEN toFloat(correct) / total * 100 ELSE 0 END AS accuracy
        `,
        {
          userId: String(userId),
          days: parseInt(days, 10),
        },
      );

      return result.records.map((record) => ({
        date: record.get('day'),
        correct: record.get('correct'),
        total: record.get('total'),
        accuracy: record.get('accuracy'),
      }));
    } catch (e) {
      console.error('Error getting mastery progress:', e);
      return [];
    }
  }

  // ===========================================================================
  // KNOWLEDGE GRAPH VISUALIZATION
  // ===========================================================================

  /**
   * Get knowledge graph data for visualization
   * @param {string} token - User token
   * @param {string} centerConceptId - Optional center concept for focused view
   * @returns {Object} Nodes and edges for visualization
   */
  async getKnowledgeGraphData(token, centerConceptId = null) {
    if (!this.isAvailable()) return { nodes: [], edges: [] };

    try {
      const session = graphInterface.adapter?.session;
      if (!session) return { nodes: [], edges: [] };

      const userId = getUserIdFromToken(token);

      let query;
      let params = { userId: String(userId) };

      if (centerConceptId) {
        // Focused view around a specific concept
        query = `
          MATCH (center:Concept {id: $centerId, userId: $userId})
          OPTIONAL MATCH (center)-[r:REQUIRES|RELATED_TO*1..2]-(related:Concept {userId: $userId})
          WITH COLLECT(DISTINCT center) + COLLECT(DISTINCT related) AS concepts
          UNWIND concepts AS c
          WITH DISTINCT c

          OPTIONAL MATCH (c)-[rel:REQUIRES|RELATED_TO]-(other:Concept {userId: $userId})
          WHERE other IN concepts

          RETURN
            COLLECT(DISTINCT {
              id: c.id,
              name: c.name,
              mastery: c.masteryLevel,
              domain: c.domain
            }) AS nodes,
            COLLECT(DISTINCT {
              source: startNode(rel).id,
              target: endNode(rel).id,
              type: type(rel)
            }) AS edges
        `;
        params.centerId = String(centerConceptId);
      } else {
        // Full knowledge graph
        query = `
          MATCH (c:Concept {userId: $userId})
          OPTIONAL MATCH (c)-[rel:REQUIRES|RELATED_TO]-(other:Concept {userId: $userId})

          RETURN
            COLLECT(DISTINCT {
              id: c.id,
              name: c.name,
              mastery: c.masteryLevel,
              domain: c.domain
            }) AS nodes,
            COLLECT(DISTINCT {
              source: startNode(rel).id,
              target: endNode(rel).id,
              type: type(rel)
            }) AS edges
        `;
      }

      const result = await session.run(query, params);

      if (result.records.length === 0) {
        return { nodes: [], edges: [] };
      }

      return {
        nodes: result.records[0].get('nodes'),
        edges: result.records[0].get('edges').filter((e) => e.source && e.target),
      };
    } catch (e) {
      console.error('Error getting knowledge graph data:', e);
      return { nodes: [], edges: [] };
    }
  }
}

// Export singleton instance
const graphLearningFeatures = new GraphLearningFeatures();
export default graphLearningFeatures;
