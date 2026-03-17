/**
 * Skills Module - Agentic AI Infrastructure
 *
 * This module provides the skill-based architecture for AI capabilities.
 * Supports both code-based (JavaScript classes) and file-based (SKILL.md) skills.
 *
 * Core Components:
 * - BaseSkill: Abstract base class for all skills
 * - SkillRegistry: Central registry for skill registration/lookup
 * - SkillExecutor: Executes skills with context and error handling
 * - ContextManager: Manages session and user context
 * - SkillMDParser: Parses SKILL.md files (Agent Skills standard)
 * - FileBasedSkillLoader: Discovers and loads SKILL.md files
 *
 * Skill Categories:
 * - AI Skills: Summarize, Grammar, Vocabulary, ConceptExtract, Explain
 * - Data Skills: SearchNotes, GraphQuery, CreateNote
 * - Learning Skills: DomainDetection, LearningPlanCreate, LearningPlanProgress, LearningSession
 * - File-based Skills: Any skill defined via SKILL.md
 *
 * Usage:
 *   const { getSkillRegistry, SkillExecutor, getContextManager, registerDefaultSkills } = require('./skills');
 *
 *   // Register default skills (code + file-based)
 *   registerDefaultSkills();
 *
 *   // Get singletons
 *   const registry = getSkillRegistry();
 *   const contextManager = getContextManager();
 *   const executor = new SkillExecutor(registry, contextManager);
 *
 *   // Execute a skill
 *   const context = await contextManager.getFullContext(userId, token, services);
 *   const result = await executor.execute('summarize', { text: '...' }, context);
 *
 * File-based Skills (Agent Skills Standard):
 *   Skills can be defined using SKILL.md files placed in:
 *   - Project: ./.claude/skills/<skill-name>/SKILL.md
 *   - App data: <userData>/.smartreader/skills/<skill-name>/SKILL.md
 *
 *   SKILL.md format:
 *   ```
 *   ---
 *   name: my_skill
 *   description: What the skill does
 *   parameters:
 *     - name: input
 *       type: string
 *       required: true
 *   category: ai
 *   ---
 *
 *   # My Skill
 *
 *   Instructions for the AI...
 *   ```
 */

const path = require('path');
const BaseSkill = require('./BaseSkill');
const { SkillRegistry, getSkillRegistry } = require('./SkillRegistry');
const SkillExecutor = require('./SkillExecutor');
const { ContextManager, getContextManager } = require('./ContextManager');
const SkillMDParser = require('./SkillMDParser');
const { FileBasedSkillLoader, createSkillFromDefinition } = require('./FileBasedSkill');

// Import skill categories
const aiSkills = require('./ai');
const dataSkills = require('./data');
const learningSkills = require('./learning');

/**
 * Get default skill search paths
 * @returns {string[]}
 */
function getSkillSearchPaths() {
  const paths = [];

  // 1. Built-in file-based skills: resources/skills (bundled with app)
  // In production, this is inside the app.asar or resources folder
  // In development, it's in the project root
  try {
    const { app } = require('electron');
    if (app) {
      // Production: inside app resources
      const resourcesPath = process.resourcesPath || app.getAppPath();
      paths.push(path.join(resourcesPath, 'skills'));
      paths.push(path.join(resourcesPath, 'resources', 'skills'));

      // Also check app path for development
      const appPath = app.getAppPath();
      paths.push(path.join(appPath, 'resources', 'skills'));
    }
  } catch (e) {
    // Not in Electron context, use cwd
    paths.push(path.join(process.cwd(), 'resources', 'skills'));
  }

  // 2. Project-level skills: ./.claude/skills/ and ./.smartreader/skills/
  const projectSkillsPath = path.join(process.cwd(), '.claude', 'skills');
  paths.push(projectSkillsPath);

  const projectSmartReaderPath = path.join(process.cwd(), '.smartreader', 'skills');
  paths.push(projectSmartReaderPath);

  // 3. User data directory (Electron app data)
  try {
    const { app } = require('electron');
    if (app) {
      const userDataPath = app.getPath('userData');
      paths.push(path.join(userDataPath, 'skills'));
      paths.push(path.join(userDataPath, '.smartreader', 'skills'));
    }
  } catch (e) {
    // Not in Electron context, skip
  }

  // 4. Home directory skills: ~/.smartreader/skills/
  const homePath = process.env.HOME || process.env.USERPROFILE;
  if (homePath) {
    paths.push(path.join(homePath, '.smartreader', 'skills'));
    paths.push(path.join(homePath, '.claude', 'skills'));
  }

  return paths;
}

/**
 * Register all default skills with the registry
 * Call this once during application initialization
 * @param {Object} options
 * @param {boolean} options.loadFileBased - Whether to load file-based skills (default: true)
 * @param {string[]} options.additionalPaths - Additional paths to search for SKILL.md files
 */
function registerDefaultSkills(options = {}) {
  const { loadFileBased = true, additionalPaths = [] } = options;
  const registry = getSkillRegistry();

  // Register code-based AI skills
  Object.values(aiSkills).forEach((SkillClass) => {
    registry.register(SkillClass, 'code');
  });

  // Register code-based Data skills
  Object.values(dataSkills).forEach((SkillClass) => {
    registry.register(SkillClass, 'code');
  });

  // Register code-based Learning skills
  learningSkills.registerLearningSkills(registry);

  const codeBasedCount = registry.getAll().length;
  console.log(`[Skills] Registered ${codeBasedCount} code-based skills`);

  // Load file-based skills
  if (loadFileBased) {
    const searchPaths = [...getSkillSearchPaths(), ...additionalPaths];
    const fileBasedCount = registry.loadFileBasedSkills(searchPaths);

    if (fileBasedCount > 0) {
      console.log(`[Skills] Loaded ${fileBasedCount} file-based skills`);
    }
  }

  const totalCount = registry.getAll().length;
  console.log(`[Skills] Total skills available: ${totalCount}`);

  return registry;
}

/**
 * Reload file-based skills from disk
 * Useful when user adds new skills
 * @returns {number} Number of skills reloaded
 */
function reloadFileBasedSkills() {
  const registry = getSkillRegistry();
  return registry.reloadFileBasedSkills();
}

module.exports = {
  // Classes
  BaseSkill,
  SkillRegistry,
  SkillExecutor,
  ContextManager,

  // File-based skill support
  SkillMDParser,
  FileBasedSkillLoader,
  createSkillFromDefinition,

  // Singleton getters
  getSkillRegistry,
  getContextManager,

  // Registration helpers
  registerDefaultSkills,
  reloadFileBasedSkills,
  getSkillSearchPaths,

  // Skill collections (for direct access)
  aiSkills,
  dataSkills,
  learningSkills,
};
