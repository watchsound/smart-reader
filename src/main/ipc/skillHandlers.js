/**
 * skillHandlers.js
 *
 * IPC handlers for skill-based AI operations.
 * These handlers are registered in main.ts and called from the renderer process.
 *
 * Provides:
 * - Skill execution (direct and AI-directed)
 * - Skill registry queries
 * - Context management
 * - Chat with skills (agentic conversations)
 *
 * Naming convention: skill-{operation}
 * Example: skill-execute, skill-list, skill-chat
 */

import { ipcMain } from 'electron';
import {
  getSkillRegistry,
  getContextManager,
  SkillExecutor,
  registerDefaultSkills,
  reloadFileBasedSkills,
} from '../skills';
import { instanceInMain as aiProviderManager } from '../../commons/service/AIProviderManager';

// Module-level state
let skillExecutor = null;
let initialized = false;

/**
 * Initialize the skill system
 * @param {Object} services - Service instances (noteManager, graphApi, etc.)
 */
function initializeSkillSystem(services = {}) {
  if (initialized) {
    return;
  }

  // Register all default skills
  registerDefaultSkills();

  // Create executor
  const registry = getSkillRegistry();
  const contextManager = getContextManager();
  skillExecutor = new SkillExecutor(registry, contextManager);

  // Store services for context
  skillExecutor.services = services;

  initialized = true;
  console.log('[Skills] Skill system initialized');
}

/**
 * Register all skill-related IPC handlers
 * @param {Object} store - electron-store instance
 * @param {Object} services - Service instances
 */
export function registerSkillHandlers(store, services = {}) {
  // Initialize skill system
  initializeSkillSystem(services);

  const registry = getSkillRegistry();
  const contextManager = getContextManager();

  // ===========================================================================
  // SKILL REGISTRY
  // ===========================================================================

  /**
   * Get list of all registered skills
   */
  ipcMain.on('skill-list', (event) => {
    try {
      const skills = registry.getAll().map((Skill) => ({
        name: Skill.name,
        description: Skill.description,
        category: Skill.category,
        parameters: Skill.parameters,
        requiredParams: Skill.requiredParams,
        isFileBased: Skill.isFileBased || false,
        source: registry.getSource(Skill.name) || 'code',
      }));
      event.returnValue = skills;
    } catch (error) {
      console.error('skill-list error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Get available skills for current context
   */
  ipcMain.on('skill-list-available', async (event, token, userId) => {
    try {
      const context = await contextManager.getFullContext(
        userId,
        token,
        skillExecutor.services,
      );
      const skills = registry.getAvailable(context).map((Skill) => ({
        name: Skill.name,
        description: Skill.description,
        category: Skill.category,
        parameters: Skill.parameters,
        requiredParams: Skill.requiredParams,
        isFileBased: Skill.isFileBased || false,
        source: registry.getSource(Skill.name) || 'code',
      }));
      event.returnValue = skills;
    } catch (error) {
      console.error('skill-list-available error:', error);
      event.returnValue = [];
    }
  });

  /**
   * Get tool definitions for LLM (Claude/OpenAI format)
   */
  ipcMain.handle('skill-get-tools', async (event, args) => {
    try {
      const [token, userId, options] = args;
      const context = await contextManager.getFullContext(
        userId,
        token,
        skillExecutor.services,
      );
      const tools = registry.getToolDefinitions(context, options || {});
      return tools;
    } catch (error) {
      console.error('skill-get-tools error:', error);
      return [];
    }
  });

  // ===========================================================================
  // SKILL EXECUTION
  // ===========================================================================

  /**
   * Execute a single skill directly
   * Used for UI-triggered skill invocation
   */
  ipcMain.handle('skill-execute', async (event, args) => {
    try {
      const [skillName, params, token, userId] = args;

      if (!skillExecutor) {
        return { success: false, error: 'Skill system not initialized' };
      }

      const context = await contextManager.getFullContext(
        userId,
        token,
        skillExecutor.services,
      );

      const executorResult = await skillExecutor.execute(skillName, params, context);
      // SkillExecutor already returns { success, result, executionTime }
      // Don't wrap it again - just pass it through
      return executorResult;
    } catch (error) {
      console.error('skill-execute error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Execute multiple skills
   * @param {boolean} parallel - Execute in parallel (default: false)
   */
  ipcMain.handle('skill-execute-multiple', async (event, args) => {
    try {
      const [skillCalls, token, userId, parallel] = args;

      if (!skillExecutor) {
        return { success: false, error: 'Skill system not initialized' };
      }

      const context = await contextManager.getFullContext(
        userId,
        token,
        skillExecutor.services,
      );

      const results = await skillExecutor.executeMultiple(skillCalls, context, {
        parallel: parallel || false,
      });

      return { success: true, results };
    } catch (error) {
      console.error('skill-execute-multiple error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // CONTEXT MANAGEMENT
  // ===========================================================================

  /**
   * Update the current view context
   */
  ipcMain.on('skill-update-view', (event, userId, viewData) => {
    try {
      contextManager.updateView(userId, viewData);
      event.returnValue = { success: true };
    } catch (error) {
      console.error('skill-update-view error:', error);
      event.returnValue = { success: false, error: error.message };
    }
  });

  /**
   * Update the current selection
   */
  ipcMain.on('skill-update-selection', (event, userId, selectedText) => {
    try {
      contextManager.updateSelection(userId, selectedText);
      event.returnValue = { success: true };
    } catch (error) {
      console.error('skill-update-selection error:', error);
      event.returnValue = { success: false, error: error.message };
    }
  });

  /**
   * Get current context for debugging
   */
  ipcMain.handle('skill-get-context', async (event, args) => {
    try {
      const [token, userId] = args;
      const context = await contextManager.getFullContext(
        userId,
        token,
        skillExecutor.services,
      );
      return context;
    } catch (error) {
      console.error('skill-get-context error:', error);
      return null;
    }
  });

  // ===========================================================================
  // AI-DIRECTED SKILL EXECUTION (AGENTIC)
  // ===========================================================================

  /**
   * Chat with skills - AI decides which skills to use
   * Returns response text and list of skills used
   */
  ipcMain.handle('skill-chat', async (event, args) => {
    try {
      const [messages, token, userId, options] = args;

      if (!aiProviderManager.currentProvider) {
        return {
          success: false,
          error: 'AI provider not configured',
          text: '',
          toolsUsed: [],
        };
      }

      // Get full context
      const context = await contextManager.getFullContext(
        userId,
        token,
        skillExecutor.services,
      );

      // Get available tools
      const tools = registry.getToolDefinitions(context, {
        includeUnavailable: false,
      });

      if (tools.length === 0) {
        // No skills available, fall back to regular chat
        const lastMessage = messages[messages.length - 1];
        const response = await aiProviderManager.sendChatMessage(
          messages.slice(0, -1),
          lastMessage?.content || '',
          {},
        );
        const text =
          typeof response === 'string' ? response : response[0]?.text || '';
        return { success: true, text, toolsUsed: [] };
      }

      // Build system prompt
      const systemPrompt = contextManager.buildSystemPrompt(context);

      // Use chatWithSkills
      const result = await aiProviderManager.chatWithSkills(messages, {
        skillExecutor,
        context,
        tools,
        systemPrompt,
        maxIterations: options?.maxIterations || 5,
        onToolCall: (toolCall) => {
          console.log(`[skill-chat] Tool called: ${toolCall.name}`);
        },
        onToolResult: (toolCall, result) => {
          console.log(`[skill-chat] Tool result for ${toolCall.name}:`, result);
        },
      });

      return {
        success: true,
        text: result.text,
        toolsUsed: result.toolsUsed,
      };
    } catch (error) {
      console.error('skill-chat error:', error);
      return {
        success: false,
        error: error.message,
        text: '',
        toolsUsed: [],
      };
    }
  });

  /**
   * Generate with tools - single turn tool use
   * Useful for specific operations like "summarize this" where you want
   * the AI to optionally use skills
   */
  ipcMain.handle('skill-generate-with-tools', async (event, args) => {
    try {
      const [prompt, token, userId, options] = args;

      // Get full context
      const context = await contextManager.getFullContext(
        userId,
        token,
        skillExecutor.services,
      );

      // Get available tools
      const tools = registry.getToolDefinitions(context, {
        includeUnavailable: false,
        categories: options?.categories,
      });

      // Build system prompt
      const systemPrompt = contextManager.buildSystemPrompt(context);

      const result = await aiProviderManager.generateWithTools(prompt, tools, {
        systemPrompt,
        maxTokens: options?.maxTokens || 4096,
      });

      return {
        success: true,
        text: result.text,
        toolCalls: result.toolCalls,
        stopReason: result.stopReason,
      };
    } catch (error) {
      console.error('skill-generate-with-tools error:', error);
      return {
        success: false,
        error: error.message,
        text: '',
        toolCalls: [],
      };
    }
  });

  // ===========================================================================
  // SKILL SYSTEM STATUS
  // ===========================================================================

  /**
   * Check if skill system is initialized
   */
  ipcMain.on('skill-status', (event) => {
    const summary = registry.getExtendedSummary();
    event.returnValue = {
      initialized,
      skillCount: registry.getAll().length,
      supportsToolUse: aiProviderManager.supportsToolUse(),
      providerName: aiProviderManager.currentProviderName || 'none',
      codeBasedCount: summary.sources?.codeBased || 0,
      fileBasedCount: summary.sources?.fileBased || 0,
    };
  });

  /**
   * Check if AI provider supports tool use
   */
  ipcMain.on('skill-supports-tool-use', (event) => {
    event.returnValue = aiProviderManager.supportsToolUse();
  });

  /**
   * Reload file-based skills from disk
   * Useful when user adds new SKILL.md files
   */
  ipcMain.handle('skill-reload-file-based', async () => {
    try {
      const count = reloadFileBasedSkills();
      return { success: true, count };
    } catch (error) {
      console.error('skill-reload-file-based error:', error);
      return { success: false, error: error.message, count: 0 };
    }
  });

  /**
   * Get extended skill summary
   */
  ipcMain.on('skill-summary', (event) => {
    try {
      const summary = registry.getExtendedSummary();
      event.returnValue = summary;
    } catch (error) {
      console.error('skill-summary error:', error);
      event.returnValue = { total: 0, categories: {}, sources: {} };
    }
  });

  console.log('[Skills] Skill IPC handlers registered');
}

/**
 * Update services after initialization
 * Call this when services become available (e.g., after DB connection)
 */
export function updateSkillServices(services) {
  if (skillExecutor) {
    skillExecutor.services = { ...skillExecutor.services, ...services };
    console.log('[Skills] Services updated');
  }
}

export default registerSkillHandlers;
