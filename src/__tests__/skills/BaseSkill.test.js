/**
 * BaseSkill.test.js
 *
 * Unit tests for the BaseSkill abstract class.
 * Tests parameter validation, schema generation, and proper abstraction behavior.
 */

const BaseSkill = require('../../main/skills/BaseSkill');

// Create a concrete implementation for testing
class TestSkill extends BaseSkill {
  static get name() {
    return 'test_skill';
  }

  static get description() {
    return 'A test skill for unit testing';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'Input text',
      },
      count: {
        type: 'number',
        description: 'Number of items',
        default: 5,
      },
      mode: {
        type: 'string',
        enum: ['fast', 'slow', 'normal'],
        default: 'normal',
        description: 'Processing mode',
      },
      optional: {
        type: 'string',
        description: 'Optional parameter',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'testing';
  }

  async execute({ text, count = 5, mode = 'normal' }) {
    return {
      processed: text.toUpperCase(),
      count,
      mode,
    };
  }
}

// Skill with availability check
class ConditionalSkill extends BaseSkill {
  static get name() {
    return 'conditional_skill';
  }

  static get description() {
    return 'A skill that requires certain conditions';
  }

  static get parameters() {
    return {
      data: { type: 'string' },
    };
  }

  static isAvailable(context) {
    return context && context.hasRequiredService === true;
  }

  async execute({ data }) {
    return { data };
  }
}

describe('BaseSkill', () => {
  describe('Abstract Class Behavior', () => {
    it('should throw error when getting name directly from BaseSkill', () => {
      // BaseSkill.name throws because it's an abstract class
      expect(() => BaseSkill.name).toThrow('Skill must implement static name getter');
    });

    it('should throw error when description is not implemented', () => {
      class BadSkill extends BaseSkill {
        static get name() {
          return 'bad';
        }
      }
      expect(() => BadSkill.description).toThrow('Skill must implement static description getter');
    });

    it('should throw error when execute is not implemented', async () => {
      class BadSkill extends BaseSkill {
        static get name() {
          return 'bad';
        }
        static get description() {
          return 'bad skill';
        }
      }
      const skill = new BadSkill({});
      await expect(skill.execute({})).rejects.toThrow('Skill must implement execute method');
    });
  });

  describe('Static Properties', () => {
    it('should return correct name', () => {
      expect(TestSkill.name).toBe('test_skill');
    });

    it('should return correct description', () => {
      expect(TestSkill.description).toBe('A test skill for unit testing');
    });

    it('should return correct category', () => {
      expect(TestSkill.category).toBe('testing');
    });

    it('should return default category when not overridden', () => {
      class MinimalSkill extends BaseSkill {
        static get name() {
          return 'minimal';
        }
        static get description() {
          return 'minimal skill';
        }
        async execute() {
          return {};
        }
      }
      expect(MinimalSkill.category).toBe('general');
    });

    it('should return parameters schema', () => {
      const params = TestSkill.parameters;
      expect(params).toHaveProperty('text');
      expect(params).toHaveProperty('count');
      expect(params).toHaveProperty('mode');
      expect(params.text.type).toBe('string');
      expect(params.count.type).toBe('number');
      expect(params.count.default).toBe(5);
      expect(params.mode.enum).toEqual(['fast', 'slow', 'normal']);
    });

    it('should return required params', () => {
      expect(TestSkill.requiredParams).toEqual(['text']);
    });
  });

  describe('Instance Creation', () => {
    it('should create instance with context', () => {
      const context = { userId: 1, token: 'test-token' };
      const skill = new TestSkill(context);
      expect(skill.context).toBe(context);
    });

    it('should handle empty context', () => {
      const skill = new TestSkill({});
      expect(skill.context).toEqual({});
    });
  });

  describe('Parameter Validation', () => {
    let skill;

    beforeEach(() => {
      skill = new TestSkill({});
    });

    it('should pass validation with required params', () => {
      const result = skill.validateParams({ text: 'hello' });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined(); // No errors means errors is undefined
    });

    it('should fail validation when required param is missing', () => {
      const result = skill.validateParams({});
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Missing required parameter: text'))).toBe(true);
    });

    it('should fail validation when required param is null', () => {
      const result = skill.validateParams({ text: null });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Missing required parameter: text'))).toBe(true);
    });

    it('should pass validation for empty string (not undefined/null)', () => {
      // Implementation allows empty string - only null/undefined are missing
      const result = skill.validateParams({ text: '' });
      expect(result.valid).toBe(true);
    });

    it('should fail validation for wrong type - string expected, number given', () => {
      const result = skill.validateParams({ text: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid type for text'))).toBe(true);
    });

    it('should fail validation for wrong type - number expected, string given', () => {
      const result = skill.validateParams({ text: 'hello', count: 'five' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid type for count'))).toBe(true);
    });

    it('should fail validation for invalid enum value', () => {
      const result = skill.validateParams({ text: 'hello', mode: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid value for mode'))).toBe(true);
    });

    it('should pass validation with valid enum value', () => {
      const result = skill.validateParams({ text: 'hello', mode: 'fast' });
      expect(result.valid).toBe(true);
    });

    it('should pass validation with optional params omitted', () => {
      const result = skill.validateParams({ text: 'hello' });
      expect(result.valid).toBe(true);
    });

    it('should ignore unknown parameters', () => {
      const result = skill.validateParams({ text: 'hello', unknown: 'value' });
      expect(result.valid).toBe(true);
    });
  });

  describe('Default Parameter Application', () => {
    let skill;

    beforeEach(() => {
      skill = new TestSkill({});
    });

    it('should apply defaults to missing params', () => {
      const params = skill.applyDefaults({ text: 'hello' });
      expect(params.text).toBe('hello');
      expect(params.count).toBe(5);
      expect(params.mode).toBe('normal');
    });

    it('should not override provided values', () => {
      const params = skill.applyDefaults({ text: 'hello', count: 10, mode: 'fast' });
      expect(params.count).toBe(10);
      expect(params.mode).toBe('fast');
    });

    it('should preserve explicit null (defaults only apply to undefined)', () => {
      const params = skill.applyDefaults({ text: 'hello', count: null });
      // Implementation uses === undefined, so null is preserved
      expect(params.count).toBeNull();
    });

    it('should preserve explicit zero (defaults only apply to undefined)', () => {
      const params = skill.applyDefaults({ text: 'hello', count: 0 });
      // Implementation uses === undefined, so 0 is preserved
      expect(params.count).toBe(0);
    });
  });

  describe('Skill Execution', () => {
    it('should execute and return result', async () => {
      const skill = new TestSkill({});
      const result = await skill.execute({ text: 'hello world' });
      expect(result.processed).toBe('HELLO WORLD');
      expect(result.count).toBe(5);
      expect(result.mode).toBe('normal');
    });

    it('should respect provided parameters', async () => {
      const skill = new TestSkill({});
      const result = await skill.execute({ text: 'test', count: 10, mode: 'fast' });
      expect(result.count).toBe(10);
      expect(result.mode).toBe('fast');
    });
  });

  describe('Tool Schema Generation', () => {
    it('should generate valid tool schema for LLM', () => {
      const schema = TestSkill.getToolSchema();

      expect(schema.name).toBe('test_skill');
      expect(schema.description).toBe('A test skill for unit testing');
      expect(schema.input_schema.type).toBe('object');
      expect(schema.input_schema.properties).toHaveProperty('text');
      expect(schema.input_schema.properties).toHaveProperty('count');
      expect(schema.input_schema.properties).toHaveProperty('mode');
      expect(schema.input_schema.required).toEqual(['text']);
    });

    it('should include enum constraints in schema', () => {
      const schema = TestSkill.getToolSchema();
      expect(schema.input_schema.properties.mode.enum).toEqual(['fast', 'slow', 'normal']);
    });

    it('should include descriptions for parameters', () => {
      const schema = TestSkill.getToolSchema();
      expect(schema.input_schema.properties.text.description).toBe('Input text');
      expect(schema.input_schema.properties.count.description).toBe('Number of items');
    });
  });

  describe('Availability Check', () => {
    it('should return true by default', () => {
      expect(TestSkill.isAvailable({})).toBe(true);
    });

    it('should check context for conditional availability', () => {
      expect(ConditionalSkill.isAvailable({ hasRequiredService: true })).toBe(true);
      expect(ConditionalSkill.isAvailable({ hasRequiredService: false })).toBe(false);
      expect(ConditionalSkill.isAvailable({})).toBe(false);
    });
  });

  describe('Execution Logging', () => {
    it('should log execution via console.log', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const skill = new TestSkill({ userId: 123 });
      skill.logExecution({ text: 'hello' }, { processed: 'HELLO' });

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('[Skill:');

      consoleSpy.mockRestore();
    });

    it('should not throw when logging without context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const skill = new TestSkill({});
      expect(() => skill.logExecution({ text: 'hello' }, { processed: 'HELLO' })).not.toThrow();
      consoleSpy.mockRestore();
    });
  });
});
