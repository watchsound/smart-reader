/**
 * SkillExecutor - Executes skills with proper context and error handling
 *
 * Responsibilities:
 * - Create skill instances with context
 * - Validate parameters
 * - Execute skills and handle errors
 * - Log executions for analytics
 * - Support sequential and parallel execution
 *
 * Usage:
 *   const executor = new SkillExecutor(registry, contextManager);
 *
 *   // Single skill
 *   const result = await executor.execute('summarize', { text: '...' }, context);
 *
 *   // Multiple skills
 *   const results = await executor.executeMultiple([
 *     { skill: 'summarize', params: { text: '...' } },
 *     { skill: 'extract_concepts', params: { text: '...' } }
 *   ], context, { parallel: true });
 */

class SkillExecutor {
  /**
   * @param {SkillRegistry} registry
   * @param {ContextManager} contextManager
   */
  constructor(registry, contextManager) {
    this.registry = registry;
    this.contextManager = contextManager;
    this.executionLog = [];
    this.maxLogSize = 100;
  }

  /**
   * Execute a single skill
   * @param {string} skillName
   * @param {Object} params
   * @param {Object} context
   * @returns {Promise<{ success: boolean, result?: any, error?: string, executionTime?: number }>}
   */
  async execute(skillName, params, context) {
    const startTime = Date.now();

    // Get skill class
    const SkillClass = this.registry.get(skillName);
    if (!SkillClass) {
      return {
        success: false,
        error: `Unknown skill: ${skillName}`,
      };
    }

    // Check availability
    if (!SkillClass.isAvailable(context)) {
      return {
        success: false,
        error: `Skill ${skillName} is not available in current context`,
      };
    }

    // Create instance
    const skill = new SkillClass(context);

    // Apply defaults and validate
    const paramsWithDefaults = skill.applyDefaults(params);
    const validation = skill.validateParams(paramsWithDefaults);

    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid parameters: ${validation.errors.join(', ')}`,
      };
    }

    try {
      // Execute
      const result = await skill.execute(paramsWithDefaults);
      const executionTime = Date.now() - startTime;

      // Log execution
      this.logExecution({
        skillName,
        params: paramsWithDefaults,
        result: this.summarizeResult(result),
        success: true,
        executionTime,
        userId: context.userId,
        timestamp: new Date().toISOString(),
      });

      // Notify context manager
      if (this.contextManager) {
        this.contextManager.logSkillExecution(
          context.userId,
          skillName,
          paramsWithDefaults,
          result,
        );
      }

      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Log error
      this.logExecution({
        skillName,
        params: paramsWithDefaults,
        error: error.message,
        success: false,
        executionTime,
        userId: context.userId,
        timestamp: new Date().toISOString(),
      });

      console.error(`[SkillExecutor] Error executing ${skillName}:`, error);

      return {
        success: false,
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * Execute multiple skills
   * @param {Array<{ skill: string, params: Object }>} skillCalls
   * @param {Object} context
   * @param {Object} options
   * @param {boolean} options.parallel - Run in parallel (default: false)
   * @param {boolean} options.stopOnError - Stop on first error (only for sequential)
   * @returns {Promise<Array<{ skill: string, success: boolean, result?: any, error?: string }>>}
   */
  async executeMultiple(skillCalls, context, options = {}) {
    const { parallel = false, stopOnError = false } = options;

    if (parallel) {
      // Execute all in parallel
      const promises = skillCalls.map(async ({ skill, params }) => {
        const result = await this.execute(skill, params, context);
        return { skill, ...result };
      });

      return Promise.all(promises);
    }

    // Execute sequentially
    const results = [];
    for (const { skill, params } of skillCalls) {
      const result = await this.execute(skill, params, context);
      results.push({ skill, ...result });

      if (stopOnError && !result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute a skill with streaming (for skills that support it)
   * @param {string} skillName
   * @param {Object} params
   * @param {Object} context
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<{ success: boolean, result?: any, error?: string }>}
   */
  async executeStream(skillName, params, context, onChunk) {
    const SkillClass = this.registry.get(skillName);
    if (!SkillClass) {
      return { success: false, error: `Unknown skill: ${skillName}` };
    }

    if (!SkillClass.isAvailable(context)) {
      return {
        success: false,
        error: `Skill ${skillName} is not available`,
      };
    }

    const skill = new SkillClass(context);
    const paramsWithDefaults = skill.applyDefaults(params);
    const validation = skill.validateParams(paramsWithDefaults);

    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    try {
      let finalResult = null;

      for await (const chunk of skill.executeStream(paramsWithDefaults)) {
        finalResult = chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      return { success: true, result: finalResult };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute skills from LLM tool_use response
   * @param {Array<{ id: string, name: string, input: Object }>} toolCalls
   * @param {Object} context
   * @returns {Promise<Array<{ id: string, result: any }>>}
   */
  async executeToolCalls(toolCalls, context) {
    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        const result = await this.execute(tc.name, tc.input, context);
        return {
          id: tc.id,
          result: result.success
            ? result.result
            : { error: result.error },
        };
      }),
    );

    return results;
  }

  /**
   * Log execution for analytics
   * @param {Object} entry
   */
  logExecution(entry) {
    this.executionLog.push(entry);

    // Trim log if too large
    if (this.executionLog.length > this.maxLogSize) {
      this.executionLog = this.executionLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Summarize result for logging (truncate large results)
   * @param {any} result
   * @returns {any}
   */
  summarizeResult(result) {
    if (result === null || result === undefined) {
      return result;
    }

    const str = JSON.stringify(result);
    if (str.length > 500) {
      return {
        _truncated: true,
        _preview: str.substring(0, 500) + '...',
        _type: typeof result,
      };
    }

    return result;
  }

  /**
   * Get execution statistics
   * @param {Object} options
   * @param {number} options.limit - Number of recent executions
   * @param {string} options.skillName - Filter by skill name
   * @returns {Object}
   */
  getStats(options = {}) {
    let log = this.executionLog;

    if (options.skillName) {
      log = log.filter((e) => e.skillName === options.skillName);
    }

    if (options.limit) {
      log = log.slice(-options.limit);
    }

    const stats = {
      total: log.length,
      successful: log.filter((e) => e.success).length,
      failed: log.filter((e) => !e.success).length,
      averageTime:
        log.length > 0
          ? log.reduce((sum, e) => sum + (e.executionTime || 0), 0) / log.length
          : 0,
      bySkill: {},
    };

    // Group by skill
    for (const entry of log) {
      if (!stats.bySkill[entry.skillName]) {
        stats.bySkill[entry.skillName] = { count: 0, successful: 0, failed: 0 };
      }
      stats.bySkill[entry.skillName].count++;
      if (entry.success) {
        stats.bySkill[entry.skillName].successful++;
      } else {
        stats.bySkill[entry.skillName].failed++;
      }
    }

    return stats;
  }

  /**
   * Clear execution log
   */
  clearLog() {
    this.executionLog = [];
  }
}

module.exports = SkillExecutor;
