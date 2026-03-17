/**
 * GraphQuerySkill - Query the knowledge graph
 *
 * Provides access to Neo4j graph queries for:
 * - Related concepts
 * - Learning paths
 * - Weak concepts
 * - Concept-note relationships
 */

const BaseSkill = require('../BaseSkill');

class GraphQuerySkill extends BaseSkill {
  static get name() {
    return 'query_graph';
  }

  static get description() {
    return "Query the knowledge graph to find related concepts, learning paths, weak concepts, or notes mentioning a concept. Requires Neo4j to be connected.";
  }

  static get parameters() {
    return {
      queryType: {
        type: 'string',
        enum: [
          'related_concepts',
          'learning_path',
          'weak_concepts',
          'concept_notes',
          'concept_mastery',
        ],
        description: 'Type of graph query to perform',
      },
      conceptName: {
        type: 'string',
        description: 'Name of the concept to query about (for related_concepts, learning_path, concept_notes)',
      },
      limit: {
        type: 'number',
        default: 10,
        description: 'Maximum number of results',
      },
    };
  }

  static get requiredParams() {
    return ['queryType'];
  }

  static get category() {
    return 'graph';
  }

  /**
   * Check if graph is available
   */
  static isAvailable(context) {
    const graphApi = context.graphApi || context.services?.graphApi;
    return !!graphApi?.isConnected?.();
  }

  async execute({ queryType, conceptName, limit = 10 }) {
    const graphApi = this.context.graphApi || this.context.services?.graphApi;
    const token = this.context.token;

    if (!graphApi) {
      throw new Error('Graph API not available');
    }

    let result;

    switch (queryType) {
      case 'related_concepts':
        if (!conceptName) {
          throw new Error('conceptName is required for related_concepts query');
        }
        result = await this.getRelatedConcepts(graphApi, conceptName, limit, token);
        break;

      case 'learning_path':
        if (!conceptName) {
          throw new Error('conceptName is required for learning_path query');
        }
        result = await this.getLearningPath(graphApi, conceptName, token);
        break;

      case 'weak_concepts':
        result = await this.getWeakConcepts(graphApi, limit, token);
        break;

      case 'concept_notes':
        if (!conceptName) {
          throw new Error('conceptName is required for concept_notes query');
        }
        result = await this.getConceptNotes(graphApi, conceptName, limit, token);
        break;

      case 'concept_mastery':
        result = await this.getConceptMastery(graphApi, conceptName, limit, token);
        break;

      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }

    this.logExecution({ queryType, conceptName, limit }, { resultCount: result?.length || 1 });

    return {
      queryType,
      conceptName,
      result,
    };
  }

  async getRelatedConcepts(graphApi, conceptName, limit, token) {
    try {
      if (graphApi.getRelatedConcepts) {
        return await graphApi.getRelatedConcepts(conceptName, limit, token);
      }

      // Fallback: direct query
      if (graphApi.runQuery) {
        const result = await graphApi.runQuery(
          `
          MATCH (c:Concept {name: $conceptName})-[r:RELATED_TO|REQUIRES|PART_OF]-(related:Concept)
          RETURN related.name AS name, related.type AS type, type(r) AS relation, r.strength AS strength
          LIMIT $limit
          `,
          { conceptName, limit },
          token,
        );
        return result;
      }

      return [];
    } catch (e) {
      console.error('Error getting related concepts:', e);
      return [];
    }
  }

  async getLearningPath(graphApi, conceptName, token) {
    try {
      if (graphApi.getPersonalizedLearningPath) {
        return await graphApi.getPersonalizedLearningPath(conceptName, token);
      }

      // Fallback: get prerequisites
      if (graphApi.runQuery) {
        const result = await graphApi.runQuery(
          `
          MATCH path = (c:Concept {name: $conceptName})<-[:REQUIRES*1..5]-(prereq:Concept)
          RETURN prereq.name AS name, prereq.masteryLevel AS mastery, length(path) AS depth
          ORDER BY depth DESC
          `,
          { conceptName },
          token,
        );
        return {
          targetConcept: conceptName,
          prerequisites: result || [],
        };
      }

      return { targetConcept: conceptName, prerequisites: [] };
    } catch (e) {
      console.error('Error getting learning path:', e);
      return { targetConcept: conceptName, prerequisites: [] };
    }
  }

  async getWeakConcepts(graphApi, limit, token) {
    try {
      if (graphApi.detectWeakConcepts) {
        return await graphApi.detectWeakConcepts(limit, token);
      }

      // Fallback: query low mastery concepts
      if (graphApi.runQuery) {
        const result = await graphApi.runQuery(
          `
          MATCH (c:Concept)
          WHERE c.masteryLevel < 50
          RETURN c.name AS name, c.type AS type, c.masteryLevel AS mastery, c.reviewCount AS reviewCount
          ORDER BY c.masteryLevel ASC
          LIMIT $limit
          `,
          { limit },
          token,
        );
        return result || [];
      }

      return [];
    } catch (e) {
      console.error('Error getting weak concepts:', e);
      return [];
    }
  }

  async getConceptNotes(graphApi, conceptName, limit, token) {
    try {
      if (graphApi.getNotesForConcept) {
        return await graphApi.getNotesForConcept(conceptName, limit, token);
      }

      // Fallback: query notes mentioning concept
      if (graphApi.runQuery) {
        const result = await graphApi.runQuery(
          `
          MATCH (n:Note)-[:MENTIONS_CONCEPT]->(c:Concept {name: $conceptName})
          RETURN n.id AS id, n.title AS title, n.sourceType AS sourceType
          LIMIT $limit
          `,
          { conceptName, limit },
          token,
        );
        return result || [];
      }

      return [];
    } catch (e) {
      console.error('Error getting concept notes:', e);
      return [];
    }
  }

  async getConceptMastery(graphApi, conceptName, limit, token) {
    try {
      if (graphApi.getMasteryProgress) {
        return await graphApi.getMasteryProgress(30, token); // Last 30 days
      }

      return { concepts: [], summary: 'Mastery data not available' };
    } catch (e) {
      console.error('Error getting concept mastery:', e);
      return { concepts: [], error: e.message };
    }
  }
}

module.exports = GraphQuerySkill;
