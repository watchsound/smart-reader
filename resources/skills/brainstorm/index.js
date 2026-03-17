/**
 * Brainstorm Skill - Index
 *
 * Exports all brainstorm modules for use by the skill executor.
 */

const {
  brainstorm,
  formatBrainstormResult,
  getStrategyDescriptions,
  DomainType,
  InsightDepth,
} = require('./brainstorm');

const { QueryAnalyzer, QuestionType } = require('./queryAnalyzer');
const { QuestionGenerator } = require('./questionGenerator');
const { StrategySelector, AVAILABLE_STRATEGIES } = require('./strategySelector');

module.exports = {
  // Main function
  brainstorm,
  formatBrainstormResult,
  getStrategyDescriptions,

  // Core classes
  QueryAnalyzer,
  QuestionGenerator,
  StrategySelector,

  // Enums
  DomainType,
  InsightDepth,
  QuestionType,

  // Constants
  AVAILABLE_STRATEGIES,
};
