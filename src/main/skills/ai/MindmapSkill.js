/**
 * MindmapSkill - Generate mindmap structure from text
 *
 * Creates a hierarchical mindmap structure with nodes and edges
 * for visualization. Supports both structured JSON and markdown formats.
 *
 * Different from ConceptExtractSkill which focuses on knowledge graph
 * entities/relationships for Neo4j. MindmapSkill focuses on
 * hierarchical visualization structure.
 */

const BaseSkill = require('../BaseSkill');

class MindmapSkill extends BaseSkill {
  static get name() {
    return 'mindmap';
  }

  static get description() {
    return 'Generate a mindmap structure from text for visualization. Creates hierarchical nodes and edges representing key concepts and their relationships.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text to generate mindmap from',
      },
      maxNodes: {
        type: 'number',
        default: 8,
        description: 'Maximum number of nodes excluding root (3-15)',
      },
      format: {
        type: 'string',
        enum: ['structured', 'markdown'],
        default: 'structured',
        description: 'Output format: structured JSON or markdown outline',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({ text, maxNodes = 8, format = 'structured' }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    // Validate maxNodes
    const nodeLimit = Math.min(Math.max(3, maxNodes), 15);

    const prompt =
      format === 'markdown'
        ? this.buildMarkdownPrompt(text)
        : this.buildStructuredPrompt(text, nodeLimit);

    const response = await aiProvider.generateContent(prompt);
    const result =
      format === 'markdown'
        ? this.parseMarkdownResponse(response)
        : this.parseStructuredResponse(response);

    this.logExecution(
      { textLength: text.length, maxNodes: nodeLimit, format },
      { nodeCount: result.nodes?.length || 0, hasRoot: !!result.root },
    );

    return {
      ...result,
      format,
      sourceTextLength: text.length,
    };
  }

  buildStructuredPrompt(text, maxNodes) {
    return `You are a knowledge extraction assistant helping students understand text through visual mindmaps.

TASK: Extract key entities and their relationships from the following text to create a mindmap structure.

RULES:
1. Identify the MAIN CONCEPT (central topic) - this becomes the root node
2. Extract KEY ENTITIES: people, concepts, places, events, objects (max ${maxNodes} entities)
3. Identify RELATIONSHIPS between entities (verbs, prepositions that connect them)
4. Each entity text should be SHORT (1-3 words, use the exact words from text when possible)
5. Assign entity types: "person", "concept", "place", "event", "object"
6. Structure should be hierarchical: root -> level1 -> level2 (max 2 levels deep)

TEXT TO ANALYZE:
"""
${text}
"""

Respond in JSON format:
{
  "title": "Brief title for the mindmap",
  "root": {
    "id": "root",
    "text": "Main concept (1-3 words)",
    "type": "concept"
  },
  "nodes": [
    { "id": "n1", "text": "Entity text", "type": "person|concept|place|event|object", "level": 1, "sourcePhrase": "original phrase from text" },
    { "id": "n2", "text": "Entity text", "type": "concept", "level": 1, "sourcePhrase": "original phrase" },
    { "id": "n3", "text": "Sub-entity", "type": "event", "level": 2, "parentId": "n1", "sourcePhrase": "original phrase" }
  ],
  "edges": [
    { "from": "root", "to": "n1", "relation": "verb or preposition connecting them" },
    { "from": "root", "to": "n2", "relation": "relationship word" },
    { "from": "n1", "to": "n3", "relation": "relationship word" }
  ]
}

IMPORTANT:
- Keep it simple: 4-${maxNodes} nodes total (not counting root)
- Use EXACT words from the source text for "sourcePhrase"
- Relations should be single words or short phrases (1-3 words)
- Level 1 nodes connect to root, Level 2 nodes connect to their parentId`;
  }

  buildMarkdownPrompt(text) {
    return `You are an expert for logic reasoning.

Create a mindmap outline using markdown for the following text.
Each node should start with "-" and include: keyword | simple description

Return ONLY the mindmap in markdown format, starting with the root concept.

TEXT:
"""
${text}
"""

Example format:
- Main Topic | Central theme of the content
  - Subtopic 1 | Brief description
    - Detail 1.1 | More specific point
  - Subtopic 2 | Another key area
    - Detail 2.1 | Related concept`;
  }

  parseStructuredResponse(response) {
    let textContent = this.extractTextContent(response);

    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        return {
          title: parsed.title || 'Mindmap',
          root: parsed.root || { id: 'root', text: 'Topic', type: 'concept' },
          nodes: this.normalizeNodes(parsed.nodes || []),
          edges: this.normalizeEdges(parsed.edges || []),
        };
      }
    } catch (e) {
      console.warn('Could not parse mindmap response as JSON:', e);
    }

    return {
      title: 'Mindmap',
      root: { id: 'root', text: 'Topic', type: 'concept' },
      nodes: [],
      edges: [],
      rawResponse: textContent,
    };
  }

  parseMarkdownResponse(response) {
    let textContent = this.extractTextContent(response);

    // Extract just the markdown part (lines starting with -)
    const lines = textContent.split('\n');
    const markdownLines = lines.filter(
      (line) => line.trim().startsWith('-') || line.trim() === '',
    );
    const markdown = markdownLines.join('\n').trim();

    // Extract title from first line
    const firstLine = markdownLines.find((l) => l.trim().startsWith('-'));
    let title = 'Mindmap';
    if (firstLine) {
      const match = firstLine.match(/-\s*([^|]+)/);
      if (match) {
        title = match[1].trim();
      }
    }

    return {
      title,
      markdown,
    };
  }

  normalizeNodes(nodes) {
    return nodes.map((node, index) => ({
      id: node.id || `n${index + 1}`,
      text: node.text || '',
      type: node.type || 'concept',
      level: node.level || 1,
      parentId: node.parentId || null,
      sourcePhrase: node.sourcePhrase || node.text || '',
    }));
  }

  normalizeEdges(edges) {
    return edges.map((edge) => ({
      from: edge.from || 'root',
      to: edge.to || '',
      relation: edge.relation || '',
    }));
  }

  extractTextContent(response) {
    if (Array.isArray(response)) {
      return response
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }
    if (response?.text) {
      return response.text;
    }
    return String(response);
  }
}

module.exports = MindmapSkill;
