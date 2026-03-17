/**
 * BaseSkill - Abstract base class for all skills
 *
 * Skills are composable, single-purpose capabilities that can be:
 * 1. Invoked directly by UI (user clicks button)
 * 2. Invoked by LLM via tool_use (AI decides which skill to use)
 *
 * Each skill:
 * - Has a unique name and description
 * - Defines its parameters via JSON Schema
 * - Receives context (user, document, settings)
 * - Returns structured results
 *
 * Usage:
 *   class SummarizeSkill extends BaseSkill {
 *     static get name() { return 'summarize'; }
 *     static get description() { return 'Generate a summary of text'; }
 *     static get parameters() {
 *       return {
 *         text: { type: 'string', description: 'Text to summarize' },
 *         length: { type: 'string', enum: ['brief', 'detailed'] }
 *       };
 *     }
 *     async execute({ text, length }) {
 *       // ... implementation
 *       return { summary: '...' };
 *     }
 *   }
 */

class BaseSkill {
  /**
   * Unique identifier for the skill (used in tool_use)
   * @returns {string}
   */
  static get name() {
    throw new Error('Skill must implement static name getter');
  }

  /**
   * Human-readable description (shown to LLM)
   * @returns {string}
   */
  static get description() {
    throw new Error('Skill must implement static description getter');
  }

  /**
   * JSON Schema for parameters
   * @returns {Object} - JSON Schema properties object
   */
  static get parameters() {
    return {};
  }

  /**
   * Required parameter names
   * @returns {string[]}
   */
  static get requiredParams() {
    return [];
  }

  /**
   * Skill category for organization
   * @returns {string} - 'ai' | 'data' | 'graph' | 'animation' | 'system'
   */
  static get category() {
    return 'general';
  }

  /**
   * Whether this skill requires specific capabilities
   * Override to check for Neo4j connection, ChromaDB, etc.
   * @param {Object} context
   * @returns {boolean}
   */
  static isAvailable(context) {
    return true;
  }

  /**
   * Create a new skill instance with context
   * @param {Object} context - Execution context
   * @param {string} context.userId - User ID
   * @param {string} context.token - Auth token
   * @param {string} context.currentView - Current view name
   * @param {Object} context.currentDocument - Current document info
   * @param {string} context.selectedText - Currently selected text
   * @param {string} context.readerLevel - User's reader level
   * @param {string} context.studyMode - User's study mode
   * @param {Object} context.aiProvider - AI provider instance
   * @param {Object} context.services - Service references (db, graph, etc.)
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate parameters against schema
   * @param {Object} params
   * @returns {{ valid: boolean, errors?: string[] }}
   */
  validateParams(params) {
    const errors = [];
    const schema = this.constructor.parameters;
    const required = this.constructor.requiredParams;

    // Check required params
    for (const paramName of required) {
      if (params[paramName] === undefined || params[paramName] === null) {
        errors.push(`Missing required parameter: ${paramName}`);
      }
    }

    // Check enum values
    for (const [paramName, paramSchema] of Object.entries(schema)) {
      const value = params[paramName];
      if (value !== undefined && paramSchema.enum) {
        if (!paramSchema.enum.includes(value)) {
          errors.push(
            `Invalid value for ${paramName}: ${value}. Must be one of: ${paramSchema.enum.join(', ')}`,
          );
        }
      }

      // Check type
      if (value !== undefined && paramSchema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== paramSchema.type) {
          errors.push(
            `Invalid type for ${paramName}: expected ${paramSchema.type}, got ${actualType}`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Apply default values to parameters
   * @param {Object} params
   * @returns {Object}
   */
  applyDefaults(params) {
    const result = { ...params };
    const schema = this.constructor.parameters;

    for (const [paramName, paramSchema] of Object.entries(schema)) {
      if (result[paramName] === undefined && paramSchema.default !== undefined) {
        result[paramName] = paramSchema.default;
      }
    }

    return result;
  }

  /**
   * Execute the skill
   * @param {Object} params - Validated parameters
   * @returns {Promise<Object>} - Result object
   */
  async execute(params) {
    throw new Error('Skill must implement execute method');
  }

  /**
   * Optional: Stream results for long-running skills
   * @param {Object} params
   * @yields {Object} - Partial results
   */
  async *executeStream(params) {
    // Default implementation: single yield of full result
    yield await this.execute(params);
  }

  /**
   * Get the JSON Schema for LLM tool definition
   * @returns {Object}
   */
  static getToolSchema() {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: 'object',
        properties: this.parameters,
        required: this.requiredParams,
      },
    };
  }

  /**
   * Helper: Get AI provider from context
   * @returns {Object}
   */
  getAIProvider() {
    return this.context.aiProvider;
  }

  /**
   * Helper: Get reader level prompt suffix
   * @returns {string}
   */
  getReaderLevelInstruction() {
    const level = this.context.readerLevel;
    if (level === 'Elementary') {
      return 'Use simple words that elementary school students can understand.';
    }
    if (level === 'Middle') {
      return 'Use vocabulary suitable for middle and high school students.';
    }
    return '';
  }

  /**
   * Helper: Log skill execution for analytics
   * @param {Object} params
   * @param {Object} result
   */
  logExecution(params, result) {
    console.log(`[Skill:${this.constructor.name}] Executed with params:`, params);
    // Could also send to analytics service
  }
}

module.exports = BaseSkill;
