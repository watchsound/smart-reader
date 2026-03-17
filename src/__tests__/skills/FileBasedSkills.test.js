/**
 * FileBasedSkills.test.js
 *
 * Tests for the file-based skill system (SKILL.md files)
 */

const SkillMDParser = require('../../main/skills/SkillMDParser');
const { createSkillFromDefinition, FileBasedSkillLoader } = require('../../main/skills/FileBasedSkill');

describe('SkillMDParser', () => {
  describe('parseContent', () => {
    const validSkillMD = `---
name: test_skill
description: A test skill for unit testing
parameters:
  - name: text
    type: string
    required: true
    description: The input text
  - name: format
    type: string
    enum: [json, text, markdown]
    default: text
    description: Output format
category: ai
user-invocable: true
---

# Test Skill

This is the instructions section for the test skill.

## Usage

Use this skill to test things.
`;

    it('should parse valid SKILL.md content', () => {
      const result = SkillMDParser.parseContent(validSkillMD, 'test.md');

      expect(result.name).toBe('test_skill');
      expect(result.description).toBe('A test skill for unit testing');
      expect(result.category).toBe('ai');
      expect(result.userInvocable).toBe(true);
      expect(result.instructions).toContain('# Test Skill');
      expect(result.instructions).toContain('## Usage');
    });

    it('should parse parameters correctly', () => {
      const result = SkillMDParser.parseContent(validSkillMD, 'test.md');

      expect(result.parameters).toHaveProperty('text');
      expect(result.parameters.text.type).toBe('string');
      expect(result.parameters.text.description).toBe('The input text');

      expect(result.parameters).toHaveProperty('format');
      expect(result.parameters.format.enum).toEqual(['json', 'text', 'markdown']);
      expect(result.parameters.format.default).toBe('text');

      expect(result.requiredParams).toContain('text');
      expect(result.requiredParams).not.toContain('format');
    });

    it('should throw error for missing frontmatter', () => {
      const invalidContent = `# No Frontmatter\n\nJust markdown content.`;

      expect(() => {
        SkillMDParser.parseContent(invalidContent, 'invalid.md');
      }).toThrow('missing frontmatter');
    });

    it('should handle minimal frontmatter', () => {
      const minimalContent = `---
name: minimal_skill
description: Minimal description
---

Instructions here.
`;

      const result = SkillMDParser.parseContent(minimalContent, 'minimal.md');

      expect(result.name).toBe('minimal_skill');
      expect(result.description).toBe('Minimal description');
      expect(result.category).toBe('general');
      expect(result.parameters).toEqual({});
      expect(result.requiredParams).toEqual([]);
    });

    it('should parse boolean values', () => {
      const content = `---
name: bool_test
description: Test booleans
user-invocable: false
disable-model-invocation: true
agent: true
---

Test content.
`;

      const result = SkillMDParser.parseContent(content, 'bool.md');

      expect(result.userInvocable).toBe(false);
      expect(result.disableModelInvocation).toBe(true);
      expect(result.agent).toBe(true);
    });

    it('should parse inline arrays', () => {
      const content = `---
name: array_test
description: Test arrays
allowed-tools: [read, write, search]
context: [selection, document]
---

Test content.
`;

      const result = SkillMDParser.parseContent(content, 'array.md');

      expect(result.allowedTools).toEqual(['read', 'write', 'search']);
      expect(result.context).toEqual(['selection', 'document']);
    });
  });

  describe('validate', () => {
    it('should validate valid skill definition', () => {
      const skillDef = {
        name: 'valid_skill',
        description: 'A valid skill',
        parameters: {
          input: { type: 'string', description: 'Input text' },
        },
        requiredParams: ['input'],
        category: 'ai',
      };

      const result = SkillMDParser.validate(skillDef);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing name', () => {
      const skillDef = {
        description: 'Missing name',
      };

      const result = SkillMDParser.validate(skillDef);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Skill must have a name');
    });

    it('should reject invalid name format', () => {
      const skillDef = {
        name: 'Invalid-Name',
        description: 'Invalid name format',
      };

      const result = SkillMDParser.validate(skillDef);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('snake_case'))).toBe(true);
    });

    it('should reject missing description', () => {
      const skillDef = {
        name: 'no_description',
      };

      const result = SkillMDParser.validate(skillDef);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Skill must have a description');
    });
  });

  describe('extractNameFromPath', () => {
    it('should extract name from directory path', () => {
      const path = '/skills/my_custom_skill/SKILL.md';
      const name = SkillMDParser.extractNameFromPath(path);

      expect(name).toBe('my_custom_skill');
    });

    it('should convert kebab-case to snake_case', () => {
      const path = '/skills/my-custom-skill/SKILL.md';
      const name = SkillMDParser.extractNameFromPath(path);

      expect(name).toBe('my_custom_skill');
    });
  });
});

describe('createSkillFromDefinition', () => {
  const skillDef = {
    name: 'test_file_skill',
    description: 'A test file-based skill',
    parameters: {
      input: { type: 'string', description: 'Input text' },
      option: { type: 'string', enum: ['a', 'b'], default: 'a' },
    },
    requiredParams: ['input'],
    category: 'ai',
    instructions: '# Test Instructions\n\nDo something with the input.',
    userInvocable: true,
    disableModelInvocation: false,
    allowedTools: [],
    context: [],
    sourcePath: '/test/SKILL.md',
  };

  it('should create a valid skill class', () => {
    const SkillClass = createSkillFromDefinition(skillDef);

    expect(SkillClass.name).toBe('test_file_skill');
    expect(SkillClass.description).toBe('A test file-based skill');
    expect(SkillClass.category).toBe('ai');
    expect(SkillClass.isFileBased).toBe(true);
    expect(SkillClass.instructions).toContain('# Test Instructions');
    expect(SkillClass.requiredParams).toEqual(['input']);
  });

  it('should have correct parameters schema', () => {
    const SkillClass = createSkillFromDefinition(skillDef);

    expect(SkillClass.parameters).toHaveProperty('input');
    expect(SkillClass.parameters).toHaveProperty('option');
    expect(SkillClass.parameters.option.enum).toEqual(['a', 'b']);
    expect(SkillClass.parameters.option.default).toBe('a');
  });

  it('should generate valid tool schema', () => {
    const SkillClass = createSkillFromDefinition(skillDef);
    const schema = SkillClass.getToolSchema();

    expect(schema.name).toBe('test_file_skill');
    expect(schema.description).toBe('A test file-based skill');
    expect(schema.input_schema.type).toBe('object');
    expect(schema.input_schema.properties).toHaveProperty('input');
    expect(schema.input_schema.required).toEqual(['input']);
  });

  it('should check context requirements in isAvailable', () => {
    const defWithContext = {
      ...skillDef,
      context: ['selection'],
    };

    const SkillClass = createSkillFromDefinition(defWithContext);

    // Without selection
    expect(SkillClass.isAvailable({ selectedText: '' })).toBe(false);

    // With selection
    expect(SkillClass.isAvailable({ selectedText: 'some text' })).toBe(true);
  });

  it('should create instance with context', () => {
    const SkillClass = createSkillFromDefinition(skillDef);
    const context = {
      userId: 1,
      token: 'test-token',
      readerLevel: 'College',
    };

    const instance = new SkillClass(context);

    expect(instance.context).toBe(context);
  });

  it('should validate parameters correctly', () => {
    const SkillClass = createSkillFromDefinition(skillDef);
    const instance = new SkillClass({});

    // Missing required param
    const result1 = instance.validateParams({});
    expect(result1.valid).toBe(false);
    expect(result1.errors).toContain('Missing required parameter: input');

    // Valid params
    const result2 = instance.validateParams({ input: 'test' });
    expect(result2.valid).toBe(true);

    // Invalid enum value
    const result3 = instance.validateParams({ input: 'test', option: 'invalid' });
    expect(result3.valid).toBe(false);
    expect(result3.errors.some((e) => e.includes('Invalid value for option'))).toBe(true);
  });
});

describe('FileBasedSkillLoader', () => {
  it('should initialize with search paths', () => {
    const loader = new FileBasedSkillLoader(['/path1', '/path2']);

    expect(loader.searchPaths).toEqual(['/path1', '/path2']);
  });

  it('should add search paths', () => {
    const loader = new FileBasedSkillLoader(['/path1']);
    loader.addSearchPath('/path2');

    expect(loader.searchPaths).toContain('/path2');
  });

  it('should not add duplicate paths', () => {
    const loader = new FileBasedSkillLoader(['/path1']);
    loader.addSearchPath('/path1');

    expect(loader.searchPaths).toHaveLength(1);
  });

  it('should return empty map for non-existent paths', () => {
    const loader = new FileBasedSkillLoader(['/nonexistent/path']);
    const skills = loader.loadAll();

    expect(skills.size).toBe(0);
  });
});
