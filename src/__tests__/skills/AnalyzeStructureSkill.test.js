/**
 * AnalyzeStructureSkill Tests (5W Analysis)
 */

const AnalyzeStructureSkill = require('../../main/skills/ai/AnalyzeStructureSkill');

describe('AnalyzeStructureSkill', () => {
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
      expect(AnalyzeStructureSkill.name).toBe('analyze_structure');
    });

    test('should have description', () => {
      expect(AnalyzeStructureSkill.description).toBeTruthy();
      expect(AnalyzeStructureSkill.description).toContain('Who');
      expect(AnalyzeStructureSkill.description).toContain('What');
    });

    test('should have correct parameters', () => {
      const params = AnalyzeStructureSkill.parameters;
      expect(params.text).toBeDefined();
    });

    test('should have text as required param', () => {
      expect(AnalyzeStructureSkill.requiredParams).toEqual(['text']);
    });

    test('should be in ai category', () => {
      expect(AnalyzeStructureSkill.category).toBe('ai');
    });
  });

  describe('execute', () => {
    test('should extract 5W from single sentence', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          data: [
            {
              sentenceIndex: 0,
              sentence: 'John ran to the store yesterday to buy milk.',
              who: 'John',
              what: 'ran, buy milk',
              when: 'yesterday',
              where: 'the store',
              why: 'to buy milk',
            },
          ],
        }),
      );

      const skill = new AnalyzeStructureSkill(mockContext);
      const result = await skill.execute({
        text: 'John ran to the store yesterday to buy milk.',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].who).toBe('John');
      expect(result.data[0].what).toBe('ran, buy milk');
      expect(result.data[0].when).toBe('yesterday');
      expect(result.data[0].where).toBe('the store');
      expect(result.data[0].why).toBe('to buy milk');
      expect(result.sentenceCount).toBe(1);
    });

    test('should handle multiple sentences', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({
          data: [
            {
              sentenceIndex: 0,
              sentence: 'Mary went home.',
              who: 'Mary',
              what: 'went',
              when: '-',
              where: 'home',
              why: '-',
            },
            {
              sentenceIndex: 1,
              sentence: 'She was tired.',
              who: 'She',
              what: 'was tired',
              when: '-',
              where: '-',
              why: '-',
            },
          ],
        }),
      );

      const skill = new AnalyzeStructureSkill(mockContext);
      const result = await skill.execute({
        text: 'Mary went home. She was tired.',
      });

      expect(result.data).toHaveLength(2);
      expect(result.sentenceCount).toBe(2);
    });

    test('should include original text in result', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        JSON.stringify({ data: [] }),
      );

      const skill = new AnalyzeStructureSkill(mockContext);
      const result = await skill.execute({
        text: 'Test sentence.',
      });

      expect(result.originalText).toBe('Test sentence.');
    });
  });

  describe('buildPrompt', () => {
    test('should include 5W instructions', () => {
      const skill = new AnalyzeStructureSkill(mockContext);
      const prompt = skill.buildPrompt('Test paragraph');

      expect(prompt).toContain('Who');
      expect(prompt).toContain('What');
      expect(prompt).toContain('When');
      expect(prompt).toContain('Where');
      expect(prompt).toContain('Why');
    });

    test('should include JSON format instruction', () => {
      const skill = new AnalyzeStructureSkill(mockContext);
      const prompt = skill.buildPrompt('Test paragraph');

      expect(prompt).toContain('JSON format');
      expect(prompt).toContain('"data"');
    });

    test('should include the input text', () => {
      const skill = new AnalyzeStructureSkill(mockContext);
      const prompt = skill.buildPrompt('My specific test paragraph');

      expect(prompt).toContain('My specific test paragraph');
    });
  });

  describe('parseResponse', () => {
    test('should parse valid JSON with data array', () => {
      const skill = new AnalyzeStructureSkill(mockContext);
      const result = skill.parseResponse(
        JSON.stringify({
          data: [
            {
              sentenceIndex: 0,
              sentence: 'Test',
              who: 'A',
              what: 'B',
              when: 'C',
              where: 'D',
              why: 'E',
            },
          ],
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].who).toBe('A');
    });

    test('should normalize missing fields to dash', () => {
      const skill = new AnalyzeStructureSkill(mockContext);
      const result = skill.parseResponse(
        JSON.stringify({
          data: [
            {
              sentence: 'Test',
              who: 'Person',
            },
          ],
        }),
      );

      expect(result.data[0].who).toBe('Person');
      expect(result.data[0].what).toBe('-');
      expect(result.data[0].when).toBe('-');
      expect(result.data[0].where).toBe('-');
      expect(result.data[0].why).toBe('-');
    });

    test('should add sentenceIndex if missing', () => {
      const skill = new AnalyzeStructureSkill(mockContext);
      const result = skill.parseResponse(
        JSON.stringify({
          data: [
            { sentence: 'First' },
            { sentence: 'Second' },
          ],
        }),
      );

      expect(result.data[0].sentenceIndex).toBe(0);
      expect(result.data[1].sentenceIndex).toBe(1);
    });

    test('should return empty data on parse error', () => {
      const skill = new AnalyzeStructureSkill(mockContext);
      const result = skill.parseResponse('not valid json');

      expect(result.data).toEqual([]);
    });

    test('should handle array response format', () => {
      const skill = new AnalyzeStructureSkill(mockContext);
      const result = skill.parseResponse([
        {
          type: 'text',
          text: '{"data": [{"sentence": "Test", "who": "X"}]}',
        },
      ]);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].who).toBe('X');
    });

    test('should handle empty data array', () => {
      const skill = new AnalyzeStructureSkill(mockContext);
      const result = skill.parseResponse(JSON.stringify({ data: [] }));

      expect(result.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should throw error if AI provider not available', async () => {
      const skill = new AnalyzeStructureSkill({ token: 'test' });
      await expect(skill.execute({ text: 'test' })).rejects.toThrow(
        'AI provider not available',
      );
    });
  });
});
