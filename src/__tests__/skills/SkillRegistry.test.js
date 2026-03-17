/**
 * SkillRegistry.test.js
 *
 * Unit tests for the SkillRegistry singleton.
 * Tests skill registration, lookup, filtering, and tool definition generation.
 */

// Reset module cache before tests
beforeEach(() => {
  jest.resetModules();
});

const BaseSkill = require('../../main/skills/BaseSkill');

// Create test skills
class SummarizeTestSkill extends BaseSkill {
  static get name() {
    return 'summarize';
  }

  static get description() {
    return 'Summarize text content';
  }

  static get parameters() {
    return {
      text: { type: 'string', description: 'Text to summarize' },
      length: {
        type: 'string',
        enum: ['short', 'medium', 'long'],
        default: 'medium',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({ text, length }) {
    return { summary: text.substring(0, 100) };
  }
}

class GrammarTestSkill extends BaseSkill {
  static get name() {
    return 'grammar_check';
  }

  static get description() {
    return 'Check grammar in text';
  }

  static get parameters() {
    return {
      text: { type: 'string' },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({ text }) {
    return { errors: [] };
  }
}

class GraphQueryTestSkill extends BaseSkill {
  static get name() {
    return 'query_graph';
  }

  static get description() {
    return 'Query knowledge graph';
  }

  static get parameters() {
    return {
      query: { type: 'string' },
    };
  }

  static get requiredParams() {
    return ['query'];
  }

  static get category() {
    return 'graph';
  }

  // Only available when graph is connected
  static isAvailable(context) {
    return context && context.graphConnected === true;
  }

  async execute({ query }) {
    return { results: [] };
  }
}

class SearchNotesTestSkill extends BaseSkill {
  static get name() {
    return 'search_notes';
  }

  static get description() {
    return 'Search user notes';
  }

  static get parameters() {
    return {
      query: { type: 'string' },
      limit: { type: 'number', default: 10 },
    };
  }

  static get requiredParams() {
    return ['query'];
  }

  static get category() {
    return 'data';
  }

  async execute({ query, limit }) {
    return { notes: [] };
  }
}

describe('SkillRegistry', () => {
  let SkillRegistry, getSkillRegistry;

  beforeEach(() => {
    // Re-import to get fresh singleton
    jest.resetModules();
    const mod = require('../../main/skills/SkillRegistry');
    SkillRegistry = mod.SkillRegistry;
    getSkillRegistry = mod.getSkillRegistry;
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getSkillRegistry', () => {
      const registry1 = getSkillRegistry();
      const registry2 = getSkillRegistry();
      expect(registry1).toBe(registry2);
    });

    it('should create new instance when using constructor directly', () => {
      // Constructor creates new instances - only getSkillRegistry() provides singleton
      const registry1 = new SkillRegistry();
      const registry2 = new SkillRegistry();
      expect(registry1).not.toBe(registry2);
    });
  });

  describe('Skill Registration', () => {
    it('should register a skill class', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);

      const skill = registry.get('summarize');
      expect(skill).toBe(SummarizeTestSkill);
    });

    it('should register multiple skills', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GrammarTestSkill);
      registry.register(GraphQueryTestSkill);

      expect(registry.get('summarize')).toBe(SummarizeTestSkill);
      expect(registry.get('grammar_check')).toBe(GrammarTestSkill);
      expect(registry.get('query_graph')).toBe(GraphQueryTestSkill);
    });

    it('should overwrite existing skill with same name', () => {
      const registry = getSkillRegistry();

      class AnotherSummarize extends BaseSkill {
        static get name() {
          return 'summarize';
        }
        static get description() {
          return 'Another summarize';
        }
        async execute() {
          return {};
        }
      }

      registry.register(SummarizeTestSkill);
      registry.register(AnotherSummarize);

      expect(registry.get('summarize')).toBe(AnotherSummarize);
    });

    it('should return all registered skills', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GrammarTestSkill);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(SummarizeTestSkill);
      expect(all).toContain(GrammarTestSkill);
    });
  });

  describe('Skill Lookup', () => {
    it('should return undefined for unregistered skill', () => {
      const registry = getSkillRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should check if skill exists', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);

      expect(registry.has('summarize')).toBe(true);
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('Category Filtering', () => {
    it('should get skills by category', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GrammarTestSkill);
      registry.register(GraphQueryTestSkill);
      registry.register(SearchNotesTestSkill);

      const aiSkills = registry.getByCategory('ai');
      expect(aiSkills).toHaveLength(2);
      expect(aiSkills).toContain(SummarizeTestSkill);
      expect(aiSkills).toContain(GrammarTestSkill);

      const graphSkills = registry.getByCategory('graph');
      expect(graphSkills).toHaveLength(1);
      expect(graphSkills).toContain(GraphQueryTestSkill);

      const dataSkills = registry.getByCategory('data');
      expect(dataSkills).toHaveLength(1);
      expect(dataSkills).toContain(SearchNotesTestSkill);
    });

    it('should return empty array for unknown category', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);

      const unknownSkills = registry.getByCategory('unknown');
      expect(unknownSkills).toEqual([]);
    });
  });

  describe('Availability Filtering', () => {
    it('should filter skills by availability', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GraphQueryTestSkill);

      // Without graph connection
      const withoutGraph = registry.getAvailable({ graphConnected: false });
      expect(withoutGraph).toContain(SummarizeTestSkill);
      expect(withoutGraph).not.toContain(GraphQueryTestSkill);

      // With graph connection
      const withGraph = registry.getAvailable({ graphConnected: true });
      expect(withGraph).toContain(SummarizeTestSkill);
      expect(withGraph).toContain(GraphQueryTestSkill);
    });

    it('should handle null context', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GraphQueryTestSkill);

      const available = registry.getAvailable(null);
      expect(available).toContain(SummarizeTestSkill);
      expect(available).not.toContain(GraphQueryTestSkill);
    });
  });

  describe('Tool Definition Generation', () => {
    it('should generate tool definitions for LLM', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GrammarTestSkill);

      const tools = registry.getToolDefinitions({});

      expect(tools).toHaveLength(2);

      const summarizeTool = tools.find((t) => t.name === 'summarize');
      expect(summarizeTool).toBeDefined();
      expect(summarizeTool.description).toBe('Summarize text content');
      expect(summarizeTool.input_schema.type).toBe('object');
      expect(summarizeTool.input_schema.properties.text).toBeDefined();
      expect(summarizeTool.input_schema.required).toEqual(['text']);
    });

    it('should only include available skills in tool definitions', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GraphQueryTestSkill);

      const toolsWithoutGraph = registry.getToolDefinitions({ graphConnected: false });
      expect(toolsWithoutGraph).toHaveLength(1);
      expect(toolsWithoutGraph[0].name).toBe('summarize');

      const toolsWithGraph = registry.getToolDefinitions({ graphConnected: true });
      expect(toolsWithGraph).toHaveLength(2);
    });

    it('should filter by categories when specified', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GrammarTestSkill);
      registry.register(SearchNotesTestSkill);

      const aiTools = registry.getToolDefinitions({}, { categories: ['ai'] });
      expect(aiTools).toHaveLength(2);
      expect(aiTools.every((t) => ['summarize', 'grammar_check'].includes(t.name))).toBe(true);

      const dataTools = registry.getToolDefinitions({}, { categories: ['data'] });
      expect(dataTools).toHaveLength(1);
      expect(dataTools[0].name).toBe('search_notes');
    });

    it('should exclude unavailable skills by default (no includeUnavailable option)', () => {
      // Current implementation doesn't have includeUnavailable option
      // It always filters by availability
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GraphQueryTestSkill);

      const tools = registry.getToolDefinitions({ graphConnected: false });

      // Only available skills are included
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('summarize');
    });
  });

  describe('Edge Cases', () => {
    it('should handle registering same skill multiple times', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(SummarizeTestSkill);
      registry.register(SummarizeTestSkill);

      expect(registry.getAll()).toHaveLength(1);
    });

    it('should handle empty registry', () => {
      const registry = getSkillRegistry();

      expect(registry.getAll()).toEqual([]);
      expect(registry.getAvailable({})).toEqual([]);
      expect(registry.getToolDefinitions({})).toEqual([]);
      expect(registry.getByCategory('ai')).toEqual([]);
    });

    it('should handle context with complex objects', () => {
      const registry = getSkillRegistry();
      registry.register(SummarizeTestSkill);
      registry.register(GraphQueryTestSkill);

      const complexContext = {
        graphConnected: true,
        user: { id: 1, name: 'Test' },
        preferences: { level: 'advanced' },
        services: { chromaDb: {}, neo4j: {} },
      };

      const available = registry.getAvailable(complexContext);
      expect(available).toHaveLength(2);
    });
  });
});
