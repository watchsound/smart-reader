/**
 * Skills Test Suite Index
 *
 * This file provides an overview of the skill system tests.
 * Run all skill tests with: npm test -- --testPathPattern=skills
 *
 * Test files:
 * - BaseSkill.test.js: Tests for the abstract base class
 * - SkillRegistry.test.js: Tests for skill registration and lookup
 * - SkillExecutor.test.js: Tests for skill execution engine
 * - ContextManager.test.js: Tests for session/context management
 * - AISkills.test.js: Tests for AI-powered skills
 * - DataSkills.test.js: Tests for data/storage skills
 * - skillHandlers.test.js: Tests for IPC handlers
 */

describe('Skills Module Test Suite', () => {
  describe('Module Structure', () => {
    it('should export all required components from main index', () => {
      const skillsModule = require('../../main/skills');

      expect(skillsModule.BaseSkill).toBeDefined();
      expect(skillsModule.SkillRegistry).toBeDefined();
      expect(skillsModule.SkillExecutor).toBeDefined();
      expect(skillsModule.ContextManager).toBeDefined();
      expect(skillsModule.getSkillRegistry).toBeDefined();
      expect(skillsModule.getContextManager).toBeDefined();
      expect(skillsModule.registerDefaultSkills).toBeDefined();
    });

    it('should export AI skills', () => {
      const aiSkills = require('../../main/skills/ai');

      expect(aiSkills.SummarizeSkill).toBeDefined();
      expect(aiSkills.GrammarCheckSkill).toBeDefined();
      expect(aiSkills.VocabularySkill).toBeDefined();
      expect(aiSkills.ConceptExtractSkill).toBeDefined();
      expect(aiSkills.ExplainSkill).toBeDefined();
    });

    it('should export data skills', () => {
      const dataSkills = require('../../main/skills/data');

      expect(dataSkills.SearchNotesSkill).toBeDefined();
      expect(dataSkills.GraphQuerySkill).toBeDefined();
      expect(dataSkills.CreateNoteSkill).toBeDefined();
    });
  });

  describe('Skill Registration', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should register all default skills', () => {
      const { registerDefaultSkills, getSkillRegistry } = require('../../main/skills');

      registerDefaultSkills();
      const registry = getSkillRegistry();
      const allSkills = registry.getAll();

      // Should have at least AI skills + data skills
      expect(allSkills.length).toBeGreaterThanOrEqual(8);

      // Check specific skills are registered
      expect(registry.has('summarize')).toBe(true);
      expect(registry.has('grammar_check')).toBe(true);
      expect(registry.has('vocabulary')).toBe(true); // Name is 'vocabulary', not 'vocabulary_lookup'
      expect(registry.has('extract_concepts')).toBe(true);
      expect(registry.has('explain')).toBe(true);
      expect(registry.has('search_notes')).toBe(true);
      expect(registry.has('query_graph')).toBe(true);
      expect(registry.has('create_note')).toBe(true);
    });

    it('should not duplicate skills on multiple registrations', () => {
      const { registerDefaultSkills, getSkillRegistry } = require('../../main/skills');

      registerDefaultSkills();
      const countAfterFirst = getSkillRegistry().getAll().length;

      registerDefaultSkills();
      const countAfterSecond = getSkillRegistry().getAll().length;

      expect(countAfterSecond).toBe(countAfterFirst);
    });
  });

  describe('End-to-End Skill Execution', () => {
    it('should execute a skill through the full pipeline', async () => {
      jest.resetModules();

      const {
        registerDefaultSkills,
        getSkillRegistry,
        getContextManager,
        SkillExecutor,
      } = require('../../main/skills');

      registerDefaultSkills();

      const registry = getSkillRegistry();
      const contextManager = getContextManager();
      const executor = new SkillExecutor(registry, contextManager);

      // Create mock context with mock AI provider
      const mockAiProvider = {
        generateContent: jest.fn().mockResolvedValue('This is a summary of the text.'),
      };

      const context = {
        userId: 1,
        token: 'test-token',
        aiProvider: mockAiProvider,
        readerLevel: 'college',
      };

      // Execute summarize skill (length enum: 'brief', 'medium', 'detailed')
      const result = await executor.execute('summarize', {
        text: 'This is a long piece of text that needs to be summarized.',
        length: 'brief',
      }, context);

      expect(result.success).toBe(true);
      expect(result.result.summary).toBeDefined();
    });
  });

  describe('Tool Definition Compatibility', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should generate Claude-compatible tool definitions', () => {
      const { registerDefaultSkills, getSkillRegistry } = require('../../main/skills');

      registerDefaultSkills();
      const registry = getSkillRegistry();

      const tools = registry.getToolDefinitions({});

      tools.forEach((tool) => {
        // Claude format requirements
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.name).toMatch(/^[a-z_]+$/); // snake_case

        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');

        expect(tool.input_schema).toBeDefined();
        expect(tool.input_schema.type).toBe('object');
        expect(tool.input_schema.properties).toBeDefined();
        expect(typeof tool.input_schema.properties).toBe('object');

        if (tool.input_schema.required) {
          expect(Array.isArray(tool.input_schema.required)).toBe(true);
        }
      });
    });

    it('should generate OpenAI-compatible tool definitions', () => {
      const { registerDefaultSkills, getSkillRegistry } = require('../../main/skills');

      registerDefaultSkills();
      const registry = getSkillRegistry();

      const tools = registry.getToolDefinitions({});

      // OpenAI format is similar to Claude, verify compatibility
      tools.forEach((tool) => {
        // Can be wrapped in function object for OpenAI
        const functionDef = {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        };

        expect(functionDef.type).toBe('function');
        expect(functionDef.function.name).toBeDefined();
        expect(functionDef.function.parameters).toBeDefined();
      });
    });
  });
});
