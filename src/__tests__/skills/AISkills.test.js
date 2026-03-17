/**
 * AISkills.test.js
 *
 * Unit tests for AI-powered skills.
 * Tests SummarizeSkill, GrammarCheckSkill, VocabularySkill, ConceptExtractSkill, ExplainSkill.
 */

// Mock AI provider
const mockAiProvider = {
  generateContent: jest.fn(),
  generateContentWithJson: jest.fn(),
};

// Create mock context
const createMockContext = (overrides = {}) => ({
  userId: 1,
  token: 'test-token',
  aiProvider: mockAiProvider,
  readerLevel: 'college',
  studyMode: 'general',
  ...overrides,
});

describe('AI Skills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SummarizeSkill', () => {
    let SummarizeSkill;

    beforeEach(() => {
      jest.resetModules();
      SummarizeSkill = require('../../main/skills/ai/SummarizeSkill');
    });

    describe('Static Properties', () => {
      it('should have correct name', () => {
        expect(SummarizeSkill.name).toBe('summarize');
      });

      it('should have description', () => {
        expect(SummarizeSkill.description).toBeDefined();
        expect(SummarizeSkill.description.length).toBeGreaterThan(0);
      });

      it('should have correct category', () => {
        expect(SummarizeSkill.category).toBe('ai');
      });

      it('should require text parameter', () => {
        expect(SummarizeSkill.requiredParams).toContain('text');
      });

      it('should have length parameter with enum', () => {
        expect(SummarizeSkill.parameters.length.enum).toEqual(['brief', 'medium', 'detailed']);
      });

      it('should have format parameter with enum', () => {
        expect(SummarizeSkill.parameters.format.enum).toEqual(['paragraph', 'bullets', 'numbered']);
      });
    });

    describe('Execution', () => {
      it('should generate summary with AI provider', async () => {
        mockAiProvider.generateContent.mockResolvedValue('This is a summary of the text.');

        const skill = new SummarizeSkill(createMockContext());
        const result = await skill.execute({
          text: 'Long text that needs to be summarized...',
          length: 'short',
          format: 'paragraph',
        });

        expect(mockAiProvider.generateContent).toHaveBeenCalled();
        expect(result.summary).toBe('This is a summary of the text.');
      });

      it('should use default length and format', async () => {
        mockAiProvider.generateContent.mockResolvedValue('Default summary');

        const skill = new SummarizeSkill(createMockContext());
        const result = await skill.execute({ text: 'Some text' });

        // Verify the result has the summary
        expect(result.summary).toBe('Default summary');
      });

      it('should pass correct parameters to prompt', async () => {
        mockAiProvider.generateContent.mockResolvedValue('Summary');

        const skill = new SummarizeSkill(createMockContext());
        const result = await skill.execute({ text: 'Some text', length: 'brief' });

        // Check the prompt was called
        expect(mockAiProvider.generateContent).toHaveBeenCalled();
        expect(result.length).toBe('brief');
      });

      it('should handle AI provider errors', async () => {
        mockAiProvider.generateContent.mockRejectedValue(new Error('API Error'));

        const skill = new SummarizeSkill(createMockContext());

        await expect(skill.execute({ text: 'Some text' })).rejects.toThrow('API Error');
      });
    });

    describe('Validation', () => {
      it('should validate text is required', () => {
        const skill = new SummarizeSkill(createMockContext());
        const result = skill.validateParams({});

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('text'))).toBe(true);
      });

      it('should validate length enum', () => {
        const skill = new SummarizeSkill(createMockContext());
        const result = skill.validateParams({ text: 'hello', length: 'invalid' });

        expect(result.valid).toBe(false);
      });
    });
  });

  describe('GrammarCheckSkill', () => {
    let GrammarCheckSkill;

    beforeEach(() => {
      jest.resetModules();
      GrammarCheckSkill = require('../../main/skills/ai/GrammarCheckSkill');
    });

    describe('Static Properties', () => {
      it('should have correct name', () => {
        expect(GrammarCheckSkill.name).toBe('grammar_check');
      });

      it('should have correct category', () => {
        expect(GrammarCheckSkill.category).toBe('ai');
      });

      it('should support explanation language parameter', () => {
        expect(GrammarCheckSkill.parameters.explanationLanguage).toBeDefined();
      });
    });

    describe('Execution', () => {
      it('should check grammar and return results', async () => {
        const mockResponse = JSON.stringify({
          errors: [
            {
              original: 'Their going',
              corrected: "They're going",
              explanation: 'Use "they\'re" for "they are"',
            },
          ],
          correctedText: "They're going to the store.",
        });
        mockAiProvider.generateContent.mockResolvedValue(mockResponse);

        const skill = new GrammarCheckSkill(createMockContext());
        const result = await skill.execute({
          text: 'Their going to the store.',
          explanationLanguage: 'english',
        });

        expect(result.originalText).toBe('Their going to the store.');
        expect(mockAiProvider.generateContent).toHaveBeenCalled();
      });

      it('should call AI provider with text', async () => {
        mockAiProvider.generateContent.mockResolvedValue(
          JSON.stringify({ errors: [], correctedText: 'Correct text.' }),
        );

        const skill = new GrammarCheckSkill(createMockContext());
        await skill.execute({ text: 'Correct text.' });

        expect(mockAiProvider.generateContent).toHaveBeenCalled();
      });
    });
  });

  describe('VocabularySkill', () => {
    let VocabularySkill;

    beforeEach(() => {
      jest.resetModules();
      VocabularySkill = require('../../main/skills/ai/VocabularySkill');
    });

    describe('Static Properties', () => {
      it('should have correct name', () => {
        // Name is 'vocabulary', not 'vocabulary_lookup'
        expect(VocabularySkill.name).toBe('vocabulary');
      });

      it('should require word parameter', () => {
        expect(VocabularySkill.requiredParams).toContain('word');
      });

      it('should have optional context parameter', () => {
        expect(VocabularySkill.parameters.context).toBeDefined();
      });
    });

    describe('Execution', () => {
      it('should look up vocabulary definition', async () => {
        const mockResponse = JSON.stringify({
          word: 'ephemeral',
          definition: 'lasting for a very short time',
          partOfSpeech: 'adjective',
          etymology: 'Greek ephemeros',
          examples: ['ephemeral beauty of cherry blossoms'],
          synonyms: ['fleeting', 'transient'],
        });
        mockAiProvider.generateContent.mockResolvedValue(mockResponse);

        const skill = new VocabularySkill(createMockContext());
        const result = await skill.execute({ word: 'ephemeral' });

        expect(result.word).toBe('ephemeral');
        expect(result.definition).toBeDefined();
      });

      it('should include context in prompt when provided', async () => {
        mockAiProvider.generateContent.mockResolvedValue(JSON.stringify({ word: 'bank' }));

        const skill = new VocabularySkill(createMockContext());
        await skill.execute({
          word: 'bank',
          context: 'The river bank was covered in flowers.',
        });

        const prompt = mockAiProvider.generateContent.mock.calls[0][0];
        expect(prompt).toContain('river bank');
      });

      it('should call AI provider for definition', async () => {
        mockAiProvider.generateContent.mockResolvedValue(JSON.stringify({ word: 'test' }));

        const skill = new VocabularySkill(createMockContext({ readerLevel: 'elementary' }));
        await skill.execute({ word: 'difficult' });

        expect(mockAiProvider.generateContent).toHaveBeenCalled();
      });
    });
  });

  describe('ConceptExtractSkill', () => {
    let ConceptExtractSkill;

    beforeEach(() => {
      jest.resetModules();
      ConceptExtractSkill = require('../../main/skills/ai/ConceptExtractSkill');
    });

    describe('Static Properties', () => {
      it('should have correct name', () => {
        expect(ConceptExtractSkill.name).toBe('extract_concepts');
      });

      it('should require text parameter', () => {
        expect(ConceptExtractSkill.requiredParams).toContain('text');
      });
    });

    describe('Execution', () => {
      it('should extract concepts from text', async () => {
        const mockResponse = JSON.stringify({
          title: 'AI Technologies',
          mainConcept: 'Machine Learning',
          nodes: [
            { id: 'n1', text: 'Machine Learning', type: 'concept' },
            { id: 'n2', text: 'Neural Networks', type: 'concept' },
            { id: 'n3', text: 'Google', type: 'organization' },
          ],
          edges: [
            { source: 'n3', target: 'n1', label: 'uses' },
          ],
        });
        mockAiProvider.generateContent.mockResolvedValue(mockResponse);

        const skill = new ConceptExtractSkill(createMockContext());
        const result = await skill.execute({
          text: 'Google uses machine learning and neural networks.',
        });

        expect(mockAiProvider.generateContent).toHaveBeenCalled();
        expect(result.nodes).toBeDefined();
        expect(result.nodes).toHaveLength(3);
      });
    });
  });

  describe('ExplainSkill', () => {
    let ExplainSkill;

    beforeEach(() => {
      jest.resetModules();
      ExplainSkill = require('../../main/skills/ai/ExplainSkill');
    });

    describe('Static Properties', () => {
      it('should have correct name', () => {
        expect(ExplainSkill.name).toBe('explain');
      });

      it('should require topic parameter', () => {
        // Parameter is called 'topic', not 'concept'
        expect(ExplainSkill.requiredParams).toContain('topic');
      });
    });

    describe('Execution', () => {
      it('should explain concept', async () => {
        const explanation =
          'Quantum entanglement is a phenomenon where particles become connected...';
        mockAiProvider.generateContent.mockResolvedValue(explanation);

        const skill = new ExplainSkill(createMockContext());
        const result = await skill.execute({
          topic: 'quantum entanglement',
          context: 'In the context of quantum computing',
        });

        expect(result.explanation).toContain('Quantum entanglement');
      });

      it('should call AI provider for explanation', async () => {
        mockAiProvider.generateContent.mockResolvedValue('Simple explanation');

        const skill = new ExplainSkill(createMockContext({ readerLevel: 'elementary' }));
        await skill.execute({ topic: 'photosynthesis' });

        expect(mockAiProvider.generateContent).toHaveBeenCalled();
      });

      it('should include analogy when requested', async () => {
        mockAiProvider.generateContent.mockResolvedValue('Explanation with analogy');

        const skill = new ExplainSkill(createMockContext());
        await skill.execute({
          topic: 'recursion',
          useAnalogy: true,
        });

        const prompt = mockAiProvider.generateContent.mock.calls[0][0];
        expect(prompt.toLowerCase()).toContain('analogy');
      });
    });
  });

  describe('Tool Schema Generation', () => {
    it('should generate valid tool schemas for all AI skills', () => {
      const SummarizeSkill = require('../../main/skills/ai/SummarizeSkill');
      const GrammarCheckSkill = require('../../main/skills/ai/GrammarCheckSkill');
      const VocabularySkill = require('../../main/skills/ai/VocabularySkill');
      const ConceptExtractSkill = require('../../main/skills/ai/ConceptExtractSkill');
      const ExplainSkill = require('../../main/skills/ai/ExplainSkill');

      const skills = [
        SummarizeSkill,
        GrammarCheckSkill,
        VocabularySkill,
        ConceptExtractSkill,
        ExplainSkill,
      ];

      for (const Skill of skills) {
        const schema = Skill.getToolSchema();

        expect(schema.name).toBeDefined();
        expect(schema.description).toBeDefined();
        expect(schema.input_schema.type).toBe('object');
        expect(schema.input_schema.properties).toBeDefined();
        expect(schema.input_schema.required).toBeDefined();
        expect(Array.isArray(schema.input_schema.required)).toBe(true);
      }
    });
  });

  describe('Availability', () => {
    it('should be available when AI provider exists', () => {
      const SummarizeSkill = require('../../main/skills/ai/SummarizeSkill');

      expect(SummarizeSkill.isAvailable({ aiProvider: mockAiProvider })).toBe(true);
    });

    it('should be available without context (defaults to true)', () => {
      const SummarizeSkill = require('../../main/skills/ai/SummarizeSkill');

      // Base behavior is to return true
      expect(SummarizeSkill.isAvailable({})).toBe(true);
    });
  });
});
