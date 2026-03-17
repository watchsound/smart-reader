/**
 * SkillRegistry - Central registry for all available skills
 *
 * Manages skill registration, lookup, and tool definition generation.
 * Supports both:
 * - Class-based skills (traditional JavaScript classes extending BaseSkill)
 * - File-based skills (SKILL.md files following Agent Skills standard)
 *
 * Usage:
 *   const registry = new SkillRegistry();
 *   registry.register(SummarizeSkill);
 *   registry.register(TranslateSkill);
 *
 *   // Load file-based skills
 *   registry.loadFileBasedSkills(['./.claude/skills']);
 *
 *   // Get skill class
 *   const SkillClass = registry.get('summarize');
 *
 *   // Get tool definitions for LLM
 *   const tools = registry.getToolDefinitions(context);
 */

class SkillRegistry {
  constructor() {
    this.skills = new Map();
    this.categories = new Map();
    this.fileBasedLoader = null;
    this.skillSources = new Map(); // Track where each skill came from
  }

  /**
   * Register a skill class
   * @param {typeof BaseSkill} SkillClass
   * @param {string} source - Source of the skill ('code' | 'file' | path)
   */
  register(SkillClass, source = 'code') {
    const name = SkillClass.name;
    const category = SkillClass.category;

    if (this.skills.has(name)) {
      console.warn(`Skill ${name} is already registered, overwriting`);
    }

    this.skills.set(name, SkillClass);
    this.skillSources.set(name, source);

    // Track by category
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category).add(name);

    const isFileBased = SkillClass.isFileBased ? ' (file-based)' : '';
    console.log(`[SkillRegistry] Registered skill: ${name} (${category})${isFileBased}`);
  }

  /**
   * Unregister a skill
   * @param {string} name
   */
  unregister(name) {
    const SkillClass = this.skills.get(name);
    if (SkillClass) {
      const category = SkillClass.category;
      this.skills.delete(name);
      this.categories.get(category)?.delete(name);
    }
  }

  /**
   * Get a skill class by name
   * @param {string} name
   * @returns {typeof BaseSkill | undefined}
   */
  get(name) {
    return this.skills.get(name);
  }

  /**
   * Check if a skill is registered
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.skills.has(name);
  }

  /**
   * Get all registered skill classes
   * @returns {Array<typeof BaseSkill>}
   */
  getAll() {
    return Array.from(this.skills.values());
  }

  /**
   * Get all skill names
   * @returns {string[]}
   */
  getAllNames() {
    return Array.from(this.skills.keys());
  }

  /**
   * Get skills by category
   * @param {string} category
   * @returns {Array<typeof BaseSkill>}
   */
  getByCategory(category) {
    const names = this.categories.get(category);
    if (!names) return [];
    return Array.from(names).map((name) => this.skills.get(name));
  }

  /**
   * Get all categories
   * @returns {string[]}
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * Get available skills for a given context
   * Filters out skills that are not available (e.g., Neo4j skills when not connected)
   * @param {Object} context
   * @returns {Array<typeof BaseSkill>}
   */
  getAvailable(context) {
    return this.getAll().filter((SkillClass) => SkillClass.isAvailable(context));
  }

  /**
   * Generate tool definitions for LLM (Claude/OpenAI format)
   * @param {Object} context - Context for filtering available skills
   * @param {Object} options
   * @param {string[]} options.categories - Only include these categories
   * @param {string[]} options.include - Only include these skill names
   * @param {string[]} options.exclude - Exclude these skill names
   * @returns {Array<Object>}
   */
  getToolDefinitions(context, options = {}) {
    let skills = this.getAvailable(context);

    // Filter by categories
    if (options.categories?.length > 0) {
      skills = skills.filter((s) => options.categories.includes(s.category));
    }

    // Filter by include list
    if (options.include?.length > 0) {
      skills = skills.filter((s) => options.include.includes(s.name));
    }

    // Filter by exclude list
    if (options.exclude?.length > 0) {
      skills = skills.filter((s) => !options.exclude.includes(s.name));
    }

    return skills.map((SkillClass) => SkillClass.getToolSchema());
  }

  /**
   * Get a summary of all registered skills (for debugging/display)
   * @returns {Object}
   */
  getSummary() {
    const summary = {
      total: this.skills.size,
      categories: {},
    };

    for (const [category, names] of this.categories) {
      summary.categories[category] = {
        count: names.size,
        skills: Array.from(names),
      };
    }

    return summary;
  }

  /**
   * Clear all registered skills
   */
  clear() {
    this.skills.clear();
    this.categories.clear();
    this.skillSources.clear();
  }

  /**
   * Load file-based skills from directories
   * @param {string[]} searchPaths - Directories to search for SKILL.md files
   * @returns {number} Number of skills loaded
   */
  loadFileBasedSkills(searchPaths) {
    const { FileBasedSkillLoader } = require('./FileBasedSkill');

    if (!this.fileBasedLoader) {
      this.fileBasedLoader = new FileBasedSkillLoader(searchPaths);
    } else {
      // Add new search paths
      for (const path of searchPaths) {
        this.fileBasedLoader.addSearchPath(path);
      }
    }

    const loadedSkills = this.fileBasedLoader.loadAll();

    // Register loaded skills
    let count = 0;
    for (const [name, SkillClass] of loadedSkills) {
      this.register(SkillClass, SkillClass.sourcePath || 'file');
      count++;
    }

    return count;
  }

  /**
   * Reload file-based skills (refresh from disk)
   * @returns {number} Number of skills reloaded
   */
  reloadFileBasedSkills() {
    if (!this.fileBasedLoader) {
      return 0;
    }

    // Remove existing file-based skills
    for (const [name, source] of this.skillSources) {
      if (source !== 'code') {
        this.unregister(name);
      }
    }

    // Reload from disk
    const loadedSkills = this.fileBasedLoader.reload();

    let count = 0;
    for (const [name, SkillClass] of loadedSkills) {
      this.register(SkillClass, SkillClass.sourcePath || 'file');
      count++;
    }

    return count;
  }

  /**
   * Get skill source information
   * @param {string} name
   * @returns {string | undefined}
   */
  getSource(name) {
    return this.skillSources.get(name);
  }

  /**
   * Check if a skill is file-based
   * @param {string} name
   * @returns {boolean}
   */
  isFileBased(name) {
    const source = this.skillSources.get(name);
    return source && source !== 'code';
  }

  /**
   * Get all file-based skills
   * @returns {Array<typeof BaseSkill>}
   */
  getFileBasedSkills() {
    return this.getAll().filter((SkillClass) => SkillClass.isFileBased);
  }

  /**
   * Get all code-based skills
   * @returns {Array<typeof BaseSkill>}
   */
  getCodeBasedSkills() {
    return this.getAll().filter((SkillClass) => !SkillClass.isFileBased);
  }

  /**
   * Get extended summary including skill sources
   * @returns {Object}
   */
  getExtendedSummary() {
    const summary = this.getSummary();

    // Add source breakdown
    let fileBasedCount = 0;
    let codeBasedCount = 0;

    for (const source of this.skillSources.values()) {
      if (source === 'code') {
        codeBasedCount++;
      } else {
        fileBasedCount++;
      }
    }

    summary.sources = {
      codeBased: codeBasedCount,
      fileBased: fileBasedCount,
    };

    return summary;
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton SkillRegistry instance
 * @returns {SkillRegistry}
 */
function getSkillRegistry() {
  if (!instance) {
    instance = new SkillRegistry();
  }
  return instance;
}

module.exports = {
  SkillRegistry,
  getSkillRegistry,
};
