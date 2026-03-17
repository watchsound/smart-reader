/**
 * ConceptExtractSkill - Extract concepts and entities from text
 *
 * Uses AI to identify key entities, concepts, and relationships.
 * Returns structured data suitable for knowledge graph integration.
 */

const BaseSkill = require('../BaseSkill');

class ConceptExtractSkill extends BaseSkill {
  static get name() {
    return 'extract_concepts';
  }

  static get description() {
    return 'Extract key concepts, entities, and relationships from text. Returns structured data suitable for knowledge graph or mindmap visualization.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text to analyze for concepts',
      },
      maxConcepts: {
        type: 'number',
        default: 8,
        description: 'Maximum number of concepts to extract',
      },
      includeRelationships: {
        type: 'boolean',
        default: true,
        description: 'Whether to include relationships between concepts',
      },
      entityTypes: {
        type: 'array',
        default: ['person', 'concept', 'place', 'event', 'object', 'organization'],
        description: 'Types of entities to extract',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({
    text,
    maxConcepts = 8,
    includeRelationships = true,
    entityTypes = ['person', 'concept', 'place', 'event', 'object', 'organization'],
  }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = this.buildPrompt(text, maxConcepts, includeRelationships, entityTypes);
    const response = await aiProvider.generateContent(prompt);

    // Parse response
    const result = this.parseResponse(response);

    this.logExecution(
      { textLength: text.length, maxConcepts },
      {
        nodeCount: result.nodes?.length || 0,
        edgeCount: result.edges?.length || 0,
      },
    );

    return result;
  }

  buildPrompt(text, maxConcepts, includeRelationships, entityTypes) {
    const typeList = entityTypes.join(', ');

    const parts = [
      'You are a knowledge extraction assistant. Extract key concepts and entities from the following text.',
      '',
      'Rules:',
      `1. Extract up to ${maxConcepts} key entities`,
      `2. Entity types to look for: ${typeList}`,
      '3. Use short labels (1-3 words) for each entity',
      '4. Include the exact phrase from the text where possible',
    ];

    if (includeRelationships) {
      parts.push('5. Identify relationships between entities (use action verbs or prepositions)');
    }

    parts.push('');
    parts.push('Text to analyze:');
    parts.push('"""');
    parts.push(text);
    parts.push('"""');
    parts.push('');
    parts.push('Return your response in JSON format:');
    parts.push('{');
    parts.push('  "title": "Brief title for the content",');
    parts.push('  "mainConcept": "The central concept or topic",');
    parts.push('  "nodes": [');
    parts.push('    {');
    parts.push('      "id": "n1",');
    parts.push('      "text": "Entity label",');
    parts.push('      "type": "person|concept|place|event|object|organization",');
    parts.push('      "sourcePhrase": "exact phrase from text"');
    parts.push('    }');
    parts.push('  ],');

    if (includeRelationships) {
      parts.push('  "edges": [');
      parts.push('    {');
      parts.push('      "from": "n1",');
      parts.push('      "to": "n2",');
      parts.push('      "relation": "verb or preposition connecting them"');
      parts.push('    }');
      parts.push('  ]');
    }

    parts.push('}');

    return parts.join('\n');
  }

  parseResponse(response) {
    // Get text content
    let textContent = response;
    if (Array.isArray(response)) {
      textContent = response
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    } else if (response?.text) {
      textContent = response.text;
    }

    // Try to parse as JSON
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || '',
          mainConcept: parsed.mainConcept || '',
          nodes: (parsed.nodes || []).map((node, idx) => ({
            id: node.id || `n${idx + 1}`,
            text: node.text || '',
            type: node.type || 'concept',
            sourcePhrase: node.sourcePhrase || node.text || '',
          })),
          edges: (parsed.edges || []).map((edge) => ({
            from: edge.from,
            to: edge.to,
            relation: edge.relation || 'related_to',
          })),
        };
      }
    } catch (e) {
      console.warn('Could not parse concept extraction response as JSON:', e);
    }

    // Fallback: return empty result
    return {
      title: '',
      mainConcept: '',
      nodes: [],
      edges: [],
      rawResponse: textContent,
    };
  }
}

module.exports = ConceptExtractSkill;
