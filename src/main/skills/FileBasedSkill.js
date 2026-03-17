/**
 * FileBasedSkill - Wrapper class for SKILL.md-based skills
 *
 * Converts a parsed SKILL.md definition into a skill class compatible
 * with the existing SkillRegistry and SkillExecutor.
 *
 * The SKILL.md "instructions" markdown is used as a system prompt
 * for the AI when executing the skill.
 */

const BaseSkill = require('./BaseSkill');

/**
 * Create a skill class from a parsed SKILL.md definition
 * @param {Object} skillDef - Parsed skill definition from SkillMDParser
 * @returns {typeof BaseSkill} A skill class
 */
function createSkillFromDefinition(skillDef) {
  const {
    name,
    description,
    parameters,
    requiredParams,
    category,
    instructions,
    userInvocable,
    disableModelInvocation,
    allowedTools,
    context: contextRequirements,
    sourcePath,
  } = skillDef;

  // Create a new class that extends BaseSkill
  // We store values as static properties instead of getters to avoid
  // conflicts with the built-in class 'name' property
  class FileBasedSkillInstance extends BaseSkill {
    static _skillDef = skillDef;
    static _skillName = name;
    static _description = description;
    static _parameters = parameters;
    static _requiredParams = requiredParams;
    static _category = category;
    static _sourcePath = sourcePath;
    static _instructions = instructions;
    static _userInvocable = userInvocable;
    static _disableModelInvocation = disableModelInvocation;
    static _allowedTools = allowedTools;
    static _contextRequirements = contextRequirements;

    // Use static getters that reference the stored values
    static get name() {
      return this._skillName;
    }

    static get description() {
      return this._description;
    }

    static get parameters() {
      return this._parameters;
    }

    static get requiredParams() {
      return this._requiredParams;
    }

    static get category() {
      return this._category;
    }

    static get sourcePath() {
      return this._sourcePath;
    }

    static get isFileBased() {
      return true;
    }

    static get instructions() {
      return this._instructions;
    }

    static get userInvocable() {
      return this._userInvocable;
    }

    static get disableModelInvocation() {
      return this._disableModelInvocation;
    }

    static get allowedTools() {
      return this._allowedTools;
    }

    static get contextRequirements() {
      return this._contextRequirements;
    }

    /**
     * Check if skill is available based on context requirements
     */
    static isAvailable(context) {
      // Check context requirements (e.g., ['selection', 'document'])
      const reqs = this._contextRequirements || [];
      for (const req of reqs) {
        switch (req) {
          case 'selection':
            if (!context.selectedText) return false;
            break;
          case 'document':
          case 'currentDocument':
            if (!context.currentDocument) return false;
            break;
          case 'neo4j':
          case 'graph':
            if (!context.services?.graph?.isConnected) return false;
            break;
          case 'chromadb':
          case 'vector':
            if (!context.services?.chromadb) return false;
            break;
          default:
            // Unknown requirement, allow by default
            break;
        }
      }
      return true;
    }

    /**
     * Execute the skill using AI with instructions from SKILL.md
     */
    async execute(params) {
      const aiProvider = this.getAIProvider();
      if (!aiProvider) {
        throw new Error('AI provider not available');
      }

      // Build prompt from instructions + parameters
      const prompt = this.buildPrompt(params);

      // Execute with AI
      const response = await aiProvider.generateContent(prompt);

      // Parse response
      const result = this.parseResponse(response);

      this.logExecution(params, result);

      return {
        result,
        skillName: name,
        isFileBased: true,
      };
    }

    /**
     * Build the prompt using SKILL.md instructions
     */
    buildPrompt(params) {
      const parts = [];

      // Add reader level context if relevant
      const readerLevel = this.getReaderLevelInstruction();
      if (readerLevel) {
        parts.push(`Context: ${readerLevel}`);
        parts.push('');
      }

      // Add the SKILL.md instructions
      parts.push(instructions);
      parts.push('');

      // Add parameters as context
      parts.push('## Input Parameters:');
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'string' && value.length > 100) {
            parts.push(`### ${key}:`);
            parts.push('```');
            parts.push(value);
            parts.push('```');
          } else {
            parts.push(`- **${key}**: ${JSON.stringify(value)}`);
          }
        }
      }

      // Add selected text if available and relevant
      if (this.context.selectedText && !params.text) {
        parts.push('');
        parts.push('### Selected Text:');
        parts.push('```');
        parts.push(this.context.selectedText);
        parts.push('```');
      }

      return parts.join('\n');
    }

    /**
     * Parse AI response
     */
    parseResponse(response) {
      // Handle different response formats
      if (Array.isArray(response)) {
        // Claude format: [{ type: 'text', text: '...' }]
        return response
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('')
          .trim();
      }

      if (typeof response === 'string') {
        return response.trim();
      }

      if (response?.text) {
        return response.text.trim();
      }

      return String(response).trim();
    }
  }

  return FileBasedSkillInstance;
}

/**
 * FileBasedSkillLoader - Loads SKILL.md files from directories
 */
class FileBasedSkillLoader {
  /**
   * @param {string[]} searchPaths - Directories to search for skills
   */
  constructor(searchPaths = []) {
    this.searchPaths = searchPaths;
    this.loadedSkills = new Map();
  }

  /**
   * Add a search path
   * @param {string} dirPath
   */
  addSearchPath(dirPath) {
    if (!this.searchPaths.includes(dirPath)) {
      this.searchPaths.push(dirPath);
    }
  }

  /**
   * Discover and load all SKILL.md files from search paths
   * @returns {Map<string, typeof BaseSkill>}
   */
  loadAll() {
    const fs = require('fs');
    const path = require('path');
    const SkillMDParser = require('./SkillMDParser');

    for (const searchPath of this.searchPaths) {
      if (!fs.existsSync(searchPath)) {
        console.log(`[FileBasedSkillLoader] Path does not exist: ${searchPath}`);
        continue;
      }

      this.scanDirectory(searchPath, fs, path, SkillMDParser);
    }

    console.log(`[FileBasedSkillLoader] Loaded ${this.loadedSkills.size} file-based skills`);
    return this.loadedSkills;
  }

  /**
   * Scan a directory for SKILL.md files
   */
  scanDirectory(dirPath, fs, path, SkillMDParser) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Check for SKILL.md in subdirectory
          const skillMdPath = path.join(fullPath, 'SKILL.md');
          if (fs.existsSync(skillMdPath)) {
            this.loadSkillFromFile(skillMdPath, SkillMDParser);
            // Don't recursively scan if we found a SKILL.md - this is a skill directory
          } else {
            // No SKILL.md found, recursively scan subdirectory
            this.scanDirectory(fullPath, fs, path, SkillMDParser);
          }
        } else if (entry.name === 'SKILL.md') {
          // SKILL.md at current level
          this.loadSkillFromFile(fullPath, SkillMDParser);
        }
      }
    } catch (err) {
      console.error(`[FileBasedSkillLoader] Error scanning ${dirPath}:`, err.message);
    }
  }

  /**
   * Load a single SKILL.md file
   * @param {string} filePath
   * @param {typeof SkillMDParser} SkillMDParser
   */
  loadSkillFromFile(filePath, SkillMDParser) {
    try {
      const skillDef = SkillMDParser.parse(filePath);
      const validation = SkillMDParser.validate(skillDef);

      if (!validation.valid) {
        console.warn(`[FileBasedSkillLoader] Invalid skill at ${filePath}:`, validation.errors);
        return;
      }

      const SkillClass = createSkillFromDefinition(skillDef);
      this.loadedSkills.set(skillDef.name, SkillClass);

      console.log(`[FileBasedSkillLoader] Loaded skill: ${skillDef.name} from ${filePath}`);
    } catch (err) {
      console.error(`[FileBasedSkillLoader] Error loading ${filePath}:`, err.message);
    }
  }

  /**
   * Get all loaded skills
   * @returns {Map<string, typeof BaseSkill>}
   */
  getLoadedSkills() {
    return this.loadedSkills;
  }

  /**
   * Get a specific skill by name
   * @param {string} name
   * @returns {typeof BaseSkill | undefined}
   */
  getSkill(name) {
    return this.loadedSkills.get(name);
  }

  /**
   * Reload all skills from search paths
   */
  reload() {
    this.loadedSkills.clear();
    return this.loadAll();
  }
}

module.exports = {
  createSkillFromDefinition,
  FileBasedSkillLoader,
};
