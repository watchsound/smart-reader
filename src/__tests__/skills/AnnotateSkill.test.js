/**
 * AnnotateSkill Tests
 */

const AnnotateSkill = require('../../main/skills/ai/AnnotateSkill');

describe('AnnotateSkill', () => {
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
      expect(AnnotateSkill.name).toBe('annotate');
    });

    test('should have description', () => {
      expect(AnnotateSkill.description).toBeTruthy();
    });

    test('should have correct parameters', () => {
      const params = AnnotateSkill.parameters;
      expect(params.text).toBeDefined();
      expect(params.annotationType).toBeDefined();
    });

    test('should have text as required param', () => {
      expect(AnnotateSkill.requiredParams).toEqual(['text']);
    });

    test('should be in ai category', () => {
      expect(AnnotateSkill.category).toBe('ai');
    });

    test('annotationType should have correct enum values', () => {
      expect(AnnotateSkill.parameters.annotationType.enum).toEqual([
        'Noun',
        'Verb',
        'Prepositions',
        'Collocations',
        'Structures',
      ]);
    });

    test('annotationType should default to Noun', () => {
      expect(AnnotateSkill.parameters.annotationType.default).toBe('Noun');
    });
  });

  describe('execute', () => {
    test('should annotate nouns', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        'I love ${apple} and ${banana}.',
      );

      const skill = new AnnotateSkill(mockContext);
      const result = await skill.execute({
        text: 'I love apple and banana.',
        annotationType: 'Noun',
      });

      expect(result.annotatedText).toBe('I love ${apple} and ${banana}.');
      expect(result.annotationType).toBe('Noun');
      expect(result.originalText).toBe('I love apple and banana.');
      expect(result.annotationCount).toBe(2);
    });

    test('should annotate verbs', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        'The cat ${ran} and ${jumped}.',
      );

      const skill = new AnnotateSkill(mockContext);
      const result = await skill.execute({
        text: 'The cat ran and jumped.',
        annotationType: 'Verb',
      });

      expect(result.annotatedText).toContain('${ran}');
      expect(result.annotatedText).toContain('${jumped}');
      expect(result.annotationType).toBe('Verb');
    });

    test('should annotate prepositions', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        'The book is ${on} the table.',
      );

      const skill = new AnnotateSkill(mockContext);
      const result = await skill.execute({
        text: 'The book is on the table.',
        annotationType: 'Prepositions',
      });

      expect(result.annotatedText).toContain('${on}');
    });

    test('should annotate collocations', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        'He is ${happy with} the result.',
      );

      const skill = new AnnotateSkill(mockContext);
      const result = await skill.execute({
        text: 'He is happy with the result.',
        annotationType: 'Collocations',
      });

      expect(result.annotatedText).toContain('${happy with}');
    });

    test('should annotate structures', async () => {
      mockAIProvider.generateContent.mockResolvedValue(
        '${Not only} is he smart ${but also} kind.',
      );

      const skill = new AnnotateSkill(mockContext);
      const result = await skill.execute({
        text: 'Not only is he smart but also kind.',
        annotationType: 'Structures',
      });

      expect(result.annotatedText).toContain('${Not only}');
      expect(result.annotatedText).toContain('${but also}');
    });

    test('should use default annotation type when not specified', async () => {
      mockAIProvider.generateContent.mockResolvedValue('The ${cat}.');

      const skill = new AnnotateSkill(mockContext);
      const result = await skill.execute({
        text: 'The cat.',
      });

      expect(result.annotationType).toBe('Noun');
    });
  });

  describe('buildPrompt', () => {
    test('should build noun annotation prompt', () => {
      const skill = new AnnotateSkill(mockContext);
      const prompt = skill.buildPrompt('Test text', 'Noun');

      expect(prompt).toContain('enclose all nouns');
      expect(prompt).toContain('${}');
      expect(prompt).toContain('Test text');
    });

    test('should build verb annotation prompt', () => {
      const skill = new AnnotateSkill(mockContext);
      const prompt = skill.buildPrompt('Test text', 'Verb');

      expect(prompt).toContain('enclose all verbs');
    });

    test('should build preposition annotation prompt', () => {
      const skill = new AnnotateSkill(mockContext);
      const prompt = skill.buildPrompt('Test text', 'Prepositions');

      expect(prompt).toContain('enclose all prepositions');
    });

    test('should build collocation annotation prompt', () => {
      const skill = new AnnotateSkill(mockContext);
      const prompt = skill.buildPrompt('Test text', 'Collocations');

      expect(prompt).toContain('phrases and fixed collocation');
    });

    test('should build structures annotation prompt', () => {
      const skill = new AnnotateSkill(mockContext);
      const prompt = skill.buildPrompt('Test text', 'Structures');

      expect(prompt).toContain('key syntactic structures');
    });
  });

  describe('extractAnnotations', () => {
    test('should extract single annotation', () => {
      const skill = new AnnotateSkill(mockContext);
      const annotations = skill.extractAnnotations('I love ${apple}.');

      expect(annotations).toHaveLength(1);
      expect(annotations[0].text).toBe('apple');
    });

    test('should extract multiple annotations', () => {
      const skill = new AnnotateSkill(mockContext);
      const annotations = skill.extractAnnotations(
        'The ${cat} ${ran} quickly.',
      );

      expect(annotations).toHaveLength(2);
      expect(annotations[0].text).toBe('cat');
      expect(annotations[1].text).toBe('ran');
    });

    test('should handle multi-word annotations', () => {
      const skill = new AnnotateSkill(mockContext);
      const annotations = skill.extractAnnotations(
        'He is ${happy with} the result.',
      );

      expect(annotations).toHaveLength(1);
      expect(annotations[0].text).toBe('happy with');
    });

    test('should return empty array for no annotations', () => {
      const skill = new AnnotateSkill(mockContext);
      const annotations = skill.extractAnnotations('No annotations here.');

      expect(annotations).toHaveLength(0);
    });
  });

  describe('parseResponse', () => {
    test('should trim response text', () => {
      const skill = new AnnotateSkill(mockContext);
      const result = skill.parseResponse('  ${word}  \n');

      expect(result).toBe('${word}');
    });

    test('should handle array response format', () => {
      const skill = new AnnotateSkill(mockContext);
      const result = skill.parseResponse([
        { type: 'text', text: 'The ${cat} ran.' },
      ]);

      expect(result).toBe('The ${cat} ran.');
    });
  });

  describe('Error Handling', () => {
    test('should throw error if AI provider not available', async () => {
      const skill = new AnnotateSkill({ token: 'test' });
      await expect(skill.execute({ text: 'test' })).rejects.toThrow(
        'AI provider not available',
      );
    });
  });
});
