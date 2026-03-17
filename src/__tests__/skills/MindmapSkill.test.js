/**
 * MindmapSkill Tests
 */

const MindmapSkill = require('../../main/skills/ai/MindmapSkill');

describe('MindmapSkill', () => {
  const mockAIProvider = {
    generateContent: jest.fn(),
  };

  const mockContext = {
    aiProvider: mockAIProvider,
    token: 'test-token',
    userId: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Static Properties', () => {
    test('should have correct name', () => {
      expect(MindmapSkill.name).toBe('mindmap');
    });

    test('should have description', () => {
      expect(MindmapSkill.description).toBeTruthy();
    });

    test('should have correct parameters', () => {
      const params = MindmapSkill.parameters;
      expect(params.text).toBeDefined();
      expect(params.maxNodes).toBeDefined();
      expect(params.format).toBeDefined();
    });

    test('should have text as required param', () => {
      expect(MindmapSkill.requiredParams).toEqual(['text']);
    });

    test('should be in ai category', () => {
      expect(MindmapSkill.category).toBe('ai');
    });

    test('maxNodes should default to 8', () => {
      expect(MindmapSkill.parameters.maxNodes.default).toBe(8);
    });

    test('format should have structured and markdown options', () => {
      expect(MindmapSkill.parameters.format.enum).toContain('structured');
      expect(MindmapSkill.parameters.format.enum).toContain('markdown');
    });
  });

  describe('execute - Structured Format', () => {
    test('should generate structured mindmap', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          title: 'Test Mindmap',
          root: { id: 'root', text: 'Main Topic', type: 'concept' },
          nodes: [
            {
              id: 'n1',
              text: 'Subtopic',
              type: 'concept',
              level: 1,
              sourcePhrase: 'subtopic',
            },
          ],
          edges: [{ from: 'root', to: 'n1', relation: 'has' }],
        }),
      );

      const skill = new MindmapSkill(mockContext);
      const result = await skill.execute({
        text: 'Test content about main topic and subtopic.',
        format: 'structured',
      });

      expect(result.format).toBe('structured');
      expect(result.title).toBe('Test Mindmap');
      expect(result.root).toBeDefined();
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
    });

    test('should normalize maxNodes within bounds', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          title: 'Test',
          root: { id: 'root', text: 'Topic', type: 'concept' },
          nodes: [],
          edges: [],
        }),
      );

      const skill = new MindmapSkill(mockContext);

      // Test max bound (15)
      await skill.execute({ text: 'test', maxNodes: 100 });
      expect(mockAIProvider.generateContent).toHaveBeenCalled();

      // Test min bound (3)
      await skill.execute({ text: 'test', maxNodes: 1 });
      expect(mockAIProvider.generateContent).toHaveBeenCalled();
    });
  });

  describe('execute - Markdown Format', () => {
    test('should generate markdown mindmap', async () => {
      mockAIProvider.generateContent.mockResolvedValue(`
- Main Topic | Central theme
  - Subtopic 1 | Description
    - Detail 1.1 | More info
  - Subtopic 2 | Another area
      `);

      const skill = new MindmapSkill(mockContext);
      const result = await skill.execute({
        text: 'Test content',
        format: 'markdown',
      });

      expect(result.format).toBe('markdown');
      expect(result.title).toBe('Main Topic');
      expect(result.markdown).toContain('- Main Topic');
      expect(result.markdown).toContain('- Subtopic 1');
    });
  });

  describe('normalizeNodes', () => {
    test('should add missing fields to nodes', () => {
      const skill = new MindmapSkill(mockContext);
      const normalized = skill.normalizeNodes([{ text: 'Node 1' }]);

      expect(normalized[0].id).toBe('n1');
      expect(normalized[0].type).toBe('concept');
      expect(normalized[0].level).toBe(1);
      expect(normalized[0].sourcePhrase).toBe('Node 1');
    });
  });

  describe('normalizeEdges', () => {
    test('should add missing fields to edges', () => {
      const skill = new MindmapSkill(mockContext);
      const normalized = skill.normalizeEdges([{ to: 'n1' }]);

      expect(normalized[0].from).toBe('root');
      expect(normalized[0].to).toBe('n1');
      expect(normalized[0].relation).toBe('');
    });
  });

  describe('Error Handling', () => {
    test('should throw error if AI provider not available', async () => {
      const skill = new MindmapSkill({ token: 'test' });
      await expect(skill.execute({ text: 'test' })).rejects.toThrow(
        'AI provider not available',
      );
    });

    test('should handle malformed JSON gracefully', async () => {
      mockAIProvider.generateContent.mockResolvedValue('not valid json');

      const skill = new MindmapSkill(mockContext);
      const result = await skill.execute({
        text: 'test',
        format: 'structured',
      });

      expect(result.title).toBe('Mindmap');
      expect(result.nodes).toEqual([]);
    });
  });
});
