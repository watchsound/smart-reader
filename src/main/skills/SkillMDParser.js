/**
 * SkillMDParser - Parses SKILL.md files following the Agent Skills standard
 *
 * SKILL.md Format:
 * ```
 * ---
 * name: skill-name
 * description: A brief description
 * parameters:
 *   - name: param1
 *     type: string
 *     required: true
 *     description: Parameter description
 *   - name: param2
 *     type: string
 *     enum: [option1, option2]
 *     default: option1
 * category: ai
 * user-invocable: true
 * ---
 *
 * # Skill Name
 *
 * Detailed instructions for the AI...
 * ```
 */

const fs = require('fs');
const path = require('path');

class SkillMDParser {
  /**
   * Parse a SKILL.md file
   * @param {string} filePath - Path to SKILL.md file
   * @returns {Object} Parsed skill definition
   */
  static parse(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseContent(content, filePath);
  }

  /**
   * Parse SKILL.md content string
   * @param {string} content - SKILL.md content
   * @param {string} sourcePath - Source path for error messages
   * @returns {Object} Parsed skill definition
   */
  static parseContent(content, sourcePath = 'unknown') {
    const result = {
      name: '',
      description: '',
      parameters: {},
      requiredParams: [],
      category: 'general',
      instructions: '',
      userInvocable: true,
      disableModelInvocation: false,
      allowedTools: [],
      context: [],
      agent: false,
      sourcePath,
    };

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error(`Invalid SKILL.md format in ${sourcePath}: missing frontmatter`);
    }

    const frontmatter = frontmatterMatch[1];
    const markdownContent = content.slice(frontmatterMatch[0].length).trim();

    // Parse YAML frontmatter (simple parser, no external dependency)
    const parsed = this.parseYAML(frontmatter);

    // Map parsed values to result
    result.name = parsed.name || this.extractNameFromPath(sourcePath);
    result.description = parsed.description || '';
    result.category = parsed.category || 'general';
    result.userInvocable = parsed['user-invocable'] !== false;
    result.disableModelInvocation = parsed['disable-model-invocation'] === true;
    result.allowedTools = parsed['allowed-tools'] || [];
    result.context = parsed.context || [];
    result.agent = parsed.agent === true;
    result.instructions = markdownContent;

    // Parse parameters
    if (parsed.parameters && Array.isArray(parsed.parameters)) {
      for (const param of parsed.parameters) {
        const paramDef = {
          type: param.type || 'string',
          description: param.description || '',
        };

        if (param.enum) {
          paramDef.enum = param.enum;
        }

        if (param.default !== undefined) {
          paramDef.default = param.default;
        }

        result.parameters[param.name] = paramDef;

        if (param.required) {
          result.requiredParams.push(param.name);
        }
      }
    }

    return result;
  }

  /**
   * Simple YAML parser for frontmatter
   * Handles common cases without external dependency
   * @param {string} yaml - YAML content
   * @returns {Object}
   */
  static parseYAML(yaml) {
    const result = {};
    const lines = yaml.split('\n');
    let currentKey = null;
    let currentArray = null;
    let currentArrayItem = null;
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Count leading spaces
      const leadingSpaces = line.match(/^(\s*)/)[1].length;

      // Check for array item
      if (trimmed.startsWith('- ')) {
        const itemContent = trimmed.slice(2).trim();

        if (currentArray !== null) {
          // Check if it's a nested object in array
          if (itemContent.includes(':')) {
            // New array item with properties
            const [key, ...valueParts] = itemContent.split(':');
            const value = valueParts.join(':').trim();
            currentArrayItem = { [key.trim()]: this.parseValue(value) };
            result[currentArray].push(currentArrayItem);
          } else {
            // Simple array item
            result[currentArray].push(this.parseValue(itemContent));
            currentArrayItem = null;
          }
        }
        continue;
      }

      // Check for key-value pair
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();

        // If this is a property of an array item
        if (currentArrayItem !== null && leadingSpaces > indentLevel) {
          currentArrayItem[key] = this.parseValue(value);
          continue;
        }

        // If we're back at root level
        if (leadingSpaces === 0 || leadingSpaces <= 2) {
          currentArrayItem = null;
          indentLevel = leadingSpaces;

          if (value === '') {
            // Start of array or nested object
            currentKey = key;
            currentArray = key;
            result[key] = [];
          } else {
            // Simple key-value
            result[key] = this.parseValue(value);
            currentKey = key;
            currentArray = null;
          }
        }
      }
    }

    return result;
  }

  /**
   * Parse a YAML value string
   * @param {string} value
   * @returns {*}
   */
  static parseValue(value) {
    if (!value) return '';

    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Number
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

    // Array (inline)
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      return inner.split(',').map((item) => this.parseValue(item.trim()));
    }

    // Quoted string
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    return value;
  }

  /**
   * Extract skill name from file path
   * @param {string} filePath
   * @returns {string}
   */
  static extractNameFromPath(filePath) {
    const dir = path.dirname(filePath);
    const parentDir = path.basename(dir);
    // Convert to snake_case
    return parentDir
      .replace(/-/g, '_')
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  /**
   * Validate a parsed skill definition
   * @param {Object} skillDef
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validate(skillDef) {
    const errors = [];

    if (!skillDef.name) {
      errors.push('Skill must have a name');
    }

    if (!skillDef.description) {
      errors.push('Skill must have a description');
    }

    if (skillDef.name && !/^[a-z][a-z0-9_]*$/.test(skillDef.name)) {
      errors.push('Skill name must be lowercase snake_case (e.g., "my_skill")');
    }

    // Validate parameters (if present)
    if (skillDef.parameters && typeof skillDef.parameters === 'object') {
      for (const [paramName, paramDef] of Object.entries(skillDef.parameters)) {
        if (!paramDef.type) {
          errors.push(`Parameter "${paramName}" must have a type`);
        }
        if (paramDef.enum && !Array.isArray(paramDef.enum)) {
          errors.push(`Parameter "${paramName}" enum must be an array`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}


module.exports = SkillMDParser;
