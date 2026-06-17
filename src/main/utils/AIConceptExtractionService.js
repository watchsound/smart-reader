/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-plusplus */
/**
 * AIConceptExtractionService.js
 *
 * AI-powered concept extraction service that uses LLM to extract
 * entities, concepts, and relationships from text content.
 *
 * This service connects the AI prompts (createMindmapExtractionPrompt,
 * createEntityResolutionPrompt) with the graph database to enable
 * intelligent concept extraction from notes.
 */

import { instanceInMain as aiProviderManager } from '../../commons/service/AIProviderManager';
import {
  createMindmapExtractionPrompt,
  createEntityResolutionPrompt,
} from '../../commons/utils/AIPrompts';
import graphInterface from './GraphInterface';
import { getUserIdFromToken } from '../db/dbManager';

class AIConceptExtractionService {
  constructor() {
    if (AIConceptExtractionService.instance) {
      // eslint-disable-next-line no-constructor-return
      return AIConceptExtractionService.instance;
    }
    AIConceptExtractionService.instance = this;
  }

  /**
   * Check if the service is available (AI provider configured and graph connected)
   */
  isAvailable() {
    return aiProviderManager.currentProvider !== null;
  }

  /**
   * Extract concepts and relationships from text using AI
   * @param {string} text - The text content to analyze
   * @param {string} token - User authentication token
   * @returns {Object} Extracted concepts with nodes and edges
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async extractConceptsWithAI(text, token) {
    if (!this.isAvailable()) {
      console.warn(
        'AI provider not configured, falling back to simple extraction',
      );
      return { nodes: [], edges: [], entities: [] };
    }

    if (!text || text.trim().length < 20) {
      return { nodes: [], edges: [], entities: [] };
    }

    try {
      // Use the mindmap extraction prompt to get structured concepts
      const prompt = createMindmapExtractionPrompt(text);
      // eslint-disable-next-line global-require
      const meteredCallJson = require('../brain/spine/meteredCallJson');
      const { output: result } = await meteredCallJson(
        prompt,
        null, // free-form JSON; provider-native JSON-mode handles shape
        { legacyLabel: 'concept-extraction' },
      );

      if (!result || !result.nodes) {
        console.warn('AI extraction returned no valid result');
        return { nodes: [], edges: [], entities: [] };
      }

      // Normalize the result
      const nodes = (result.nodes || []).map((node) => ({
        id: node.id,
        name: node.text,
        type: this.mapNodeType(node.type),
        level: node.level || 1,
        parentId: node.parentId || null,
        sourcePhrase: node.sourcePhrase || node.text,
      }));

      // Add root node if present
      if (result.root) {
        nodes.unshift({
          id: result.root.id || 'root',
          name: result.root.text,
          type: this.mapNodeType(result.root.type),
          level: 0,
          parentId: null,
          sourcePhrase: result.root.text,
          isRoot: true,
        });
      }

      const edges = (result.edges || []).map((edge) => ({
        from: edge.from,
        to: edge.to,
        relation: edge.relation,
        type: this.inferRelationType(edge.relation),
      }));

      return {
        title: result.title || '',
        nodes,
        edges,
        entities: [],
      };
    } catch (error) {
      console.error('AI concept extraction error:', error);
      return { nodes: [], edges: [], entities: [] };
    }
  }

  /**
   * Extract entities and coreferences using AI
   * @param {string} text - The text content to analyze
   * @returns {Object} Extracted entities with references
   */
  async extractEntitiesWithAI(text) {
    if (!this.isAvailable()) {
      return { entities: [] };
    }

    if (!text || text.trim().length < 50) {
      return { entities: [] };
    }

    try {
      const prompt = createEntityResolutionPrompt(text);
      // eslint-disable-next-line global-require
      const meteredCallJson = require('../brain/spine/meteredCallJson');
      const { output: result } = await meteredCallJson(
        prompt,
        null,
        { legacyLabel: 'entity-extraction' },
      );

      if (!result || !result.entities) {
        return { entities: [] };
      }

      return {
        entities: (result.entities || []).map((entity) => ({
          id: entity.id,
          canonicalName: entity.canonicalName,
          type: this.mapNodeType(entity.type),
          references: entity.references || [],
        })),
      };
    } catch (error) {
      console.error('AI entity extraction error:', error);
      return { entities: [] };
    }
  }

  /**
   * Full extraction: concepts + entities + relationship suggestions
   * @param {string} text - The text content to analyze
   * @param {string} token - User authentication token
   * @returns {Object} Complete extraction result
   */
  async fullExtraction(text, token) {
    // Run concept and entity extraction in parallel
    const [conceptResult, entityResult] = await Promise.all([
      this.extractConceptsWithAI(text, token),
      this.extractEntitiesWithAI(text),
    ]);

    // Merge entities into the concept result
    const mergedEntities = this.mergeEntities(
      conceptResult.nodes,
      entityResult.entities,
    );

    // Find existing concepts that match
    const existingConcepts = await this.findMatchingConcepts(
      mergedEntities,
      token,
    );

    // Generate relationship suggestions
    const suggestions = this.generateRelationshipSuggestions(
      mergedEntities,
      existingConcepts,
      conceptResult.edges,
    );

    return {
      title: conceptResult.title,
      nodes: conceptResult.nodes,
      edges: conceptResult.edges,
      entities: mergedEntities,
      existingConcepts,
      suggestions,
    };
  }

  /**
   * Save extracted concepts to the graph database
   * @param {Array} nodes - Concept nodes to save
   * @param {Array} edges - Relationship edges to save
   * @param {string} sourceId - Source note/book ID
   * @param {string} sourceType - Type of source ('note', 'book', etc.)
   * @param {string} token - User authentication token
   */
  async saveToGraph(nodes, edges, sourceId, sourceType, token) {
    if (!graphInterface.checkConnection()) {
      console.warn('Graph database not connected');
      return { saved: 0, linked: 0 };
    }

    const session = graphInterface.adapter?.session;
    if (!session) {
      return { saved: 0, linked: 0 };
    }

    const userId = getUserIdFromToken(token);
    let savedCount = 0;
    let linkedCount = 0;

    try {
      // Create concepts
      for (const node of nodes) {
        const conceptId = `concept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await session.run(
          `
          MERGE (c:Concept {name: $name, userId: $userId})
          ON CREATE SET
            c.id = $conceptId,
            c.type = $type,
            c.domain = $domain,
            c.masteryLevel = 0,
            c.reviewCount = 0,
            c.createdAt = datetime()
          RETURN c.id AS id
          `,
          {
            conceptId,
            name: node.name,
            type: node.type || 'concept',
            domain: node.domain || 'general',
            userId: String(userId),
          },
        );
        savedCount++;
      }

      // Create relationships
      for (const edge of edges) {
        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);

        if (fromNode && toNode) {
          await session.run(
            `
            MATCH (c1:Concept {name: $fromName, userId: $userId})
            MATCH (c2:Concept {name: $toName, userId: $userId})
            MERGE (c1)-[r:${edge.type || 'RELATED_TO'}]->(c2)
            ON CREATE SET
              r.relation = $relation,
              r.strength = 0.5,
              r.createdAt = datetime()
            RETURN r
            `,
            {
              fromName: fromNode.name,
              toName: toNode.name,
              relation: edge.relation,
              userId: String(userId),
            },
          );
          linkedCount++;
        }
      }

      // Link to source
      if (sourceId && sourceType) {
        for (const node of nodes) {
          await session.run(
            `
            MATCH (c:Concept {name: $name, userId: $userId})
            MERGE (s:${sourceType === 'note' ? 'Note' : 'Book'} {id: $sourceId})
            MERGE (s)-[r:MENTIONS_CONCEPT]->(c)
            ON CREATE SET r.createdAt = datetime()
            `,
            {
              name: node.name,
              sourceId,
              userId: String(userId),
            },
          );
        }
      }

      return { saved: savedCount, linked: linkedCount };
    } catch (error) {
      console.error('Error saving to graph:', error);
      return { saved: 0, linked: 0, error: error.message };
    }
  }

  /**
   * Map AI-generated node types to our concept types
   */
  mapNodeType(type) {
    const typeMap = {
      person: 'person',
      concept: 'concept',
      place: 'location',
      event: 'event',
      object: 'object',
      organization: 'organization',
      thing: 'object',
    };
    return typeMap[type?.toLowerCase()] || 'concept';
  }

  /**
   * Infer relationship type from relation text
   */
  inferRelationType(relation) {
    const relationLower = (relation || '').toLowerCase();

    if (relationLower.includes('require') || relationLower.includes('need')) {
      return 'REQUIRES';
    }
    if (
      relationLower.includes('part of') ||
      relationLower.includes('belongs')
    ) {
      return 'PART_OF';
    }
    if (relationLower.includes('cause') || relationLower.includes('lead')) {
      return 'CAUSES';
    }
    if (
      relationLower.includes('example') ||
      relationLower.includes('instance')
    ) {
      return 'EXAMPLE_OF';
    }
    return 'RELATED_TO';
  }

  /**
   * Merge concept nodes with entity references
   */
  mergeEntities(nodes, entities) {
    const merged = [...nodes];
    const existingNames = new Set(nodes.map((n) => n.name.toLowerCase()));

    for (const entity of entities) {
      if (!existingNames.has(entity.canonicalName.toLowerCase())) {
        merged.push({
          id: entity.id,
          name: entity.canonicalName,
          type: entity.type,
          references: entity.references,
          fromEntityResolution: true,
        });
        existingNames.add(entity.canonicalName.toLowerCase());
      }
    }

    return merged;
  }

  /**
   * Find existing concepts in the graph that match extracted ones
   */
  async findMatchingConcepts(entities, token) {
    if (!graphInterface.checkConnection()) {
      return [];
    }

    const session = graphInterface.adapter?.session;
    if (!session) return [];

    const userId = getUserIdFromToken(token);
    const names = entities.map((e) => e.name);

    try {
      const result = await session.run(
        `
        MATCH (c:Concept {userId: $userId})
        WHERE c.name IN $names OR any(name IN $names WHERE toLower(c.name) = toLower(name))
        RETURN c.id AS id, c.name AS name, c.masteryLevel AS mastery, c.type AS type
        `,
        {
          userId: String(userId),
          names,
        },
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        name: record.get('name'),
        mastery: record.get('mastery'),
        type: record.get('type'),
      }));
    } catch (error) {
      console.error('Error finding matching concepts:', error);
      return [];
    }
  }

  /**
   * Generate relationship suggestions based on extracted data
   */
  generateRelationshipSuggestions(entities, existingConcepts, edges) {
    const suggestions = [];

    // Suggest linking new concepts to existing related ones
    const existingNames = new Set(
      existingConcepts.map((c) => c.name.toLowerCase()),
    );

    for (const entity of entities) {
      if (!existingNames.has(entity.name.toLowerCase())) {
        // Find potential existing concepts to link with
        for (const existing of existingConcepts) {
          // Check if there's an edge in the extraction
          const hasEdge = edges.some(
            (e) =>
              e.from === entity.id ||
              e.to === entity.id ||
              entity.name.toLowerCase().includes(existing.name.toLowerCase()) ||
              existing.name.toLowerCase().includes(entity.name.toLowerCase()),
          );

          if (hasEdge) {
            suggestions.push({
              type: 'link',
              newConcept: entity.name,
              existingConcept: existing.name,
              existingConceptId: existing.id,
              suggestedRelation: 'RELATED_TO',
              confidence: 0.7,
            });
          }
        }
      }
    }

    return suggestions;
  }
}

const aiConceptExtractionService = new AIConceptExtractionService();
export default aiConceptExtractionService;
