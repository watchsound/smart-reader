/**
 * Brainstorm - Main entry point for the brainstorm skill.
 *
 * This script analyzes a query and selects optimal cognitive strategies.
 * Can be used as a module by the skill executor.
 *
 * Converted from Python to JavaScript for SmartReader integration.
 */

const { QueryAnalyzer, DomainType, InsightDepth } = require('./queryAnalyzer');
const { QuestionGenerator } = require('./questionGenerator');
const { StrategySelector, STRATEGY_DESCRIPTIONS } = require('./strategySelector');

/**
 * Analyze a query and select optimal brainstorming strategies.
 *
 * @param {string} query - The brainstorming topic or question
 * @param {Object} options - Configuration options
 * @param {string} options.domain - Optional domain override
 * @param {string} options.depth - Insight depth level (surface, intermediate, deep, profound)
 * @param {number} options.count - Number of strategies to select
 * @param {boolean} options.direct - Skip follow-up questions, generate insights immediately
 * @param {string} options.context - Additional context provided by user
 * @returns {Object} Analysis and strategy selection
 */
function brainstorm(query, options = {}) {
  const {
    domain = null,
    depth = 'deep',
    count = 3,
    direct = false,
    context = null,
  } = options;

  const analyzer = new QueryAnalyzer();
  const selector = new StrategySelector(analyzer);
  const questionGenerator = new QuestionGenerator();

  // Analyze query
  const analysis = analyzer.analyze(query);

  // Override domain if specified
  let domainEnum = analysis.domain;
  if (domain) {
    domainEnum = Object.values(DomainType).includes(domain.toLowerCase())
      ? domain.toLowerCase()
      : analysis.domain;
  }

  // Get depth enum
  let depthEnum = InsightDepth.DEEP;
  if (Object.values(InsightDepth).includes(depth.toLowerCase())) {
    depthEnum = depth.toLowerCase();
  }

  // Select strategies
  const selection = selector.selectStrategies(
    query,
    domainEnum,
    depthEnum,
    count
  );

  // Generate follow-up questions if not in direct mode
  let followUpQuestions = null;
  if (!direct) {
    followUpQuestions = questionGenerator.generate(query, 4);
  }

  return {
    query,
    analysis: {
      domain: analysis.domain,
      domainConfidence: analysis.domainConfidence,
      questionType: analysis.questionType,
      questionTypeConfidence: analysis.questionTypeConfidence,
      complexity: analysis.complexity,
      keywords: analysis.keywords.slice(0, 10),
    },
    strategies: selection,
    followUpQuestions: followUpQuestions ? {
      questions: followUpQuestions.questions,
      formatted: followUpQuestions.formatForDisplay(),
    } : null,
    context,
    mode: direct ? 'direct' : 'interactive',
  };
}

/**
 * Format the brainstorm result for display.
 *
 * @param {Object} result - Result from brainstorm()
 * @returns {string} Formatted output
 */
function formatBrainstormResult(result) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('BRAINSTORM ANALYSIS');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Query: ${result.query}`);
  lines.push('');
  lines.push(`Domain: ${result.analysis.domain} (confidence: ${result.analysis.domainConfidence.toFixed(2)})`);
  lines.push(`Question Type: ${result.analysis.questionType}`);
  lines.push(`Complexity: ${result.analysis.complexity}`);
  lines.push(`Keywords: ${result.analysis.keywords.join(', ')}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('SELECTED STRATEGIES');
  lines.push('-'.repeat(60));
  lines.push('');

  result.strategies.strategies.forEach((strategy, i) => {
    const score = result.strategies.scores[strategy];
    const rationale = result.strategies.rationale[strategy];
    lines.push(`${i + 1}. ${strategy.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`);
    lines.push(`   Score: ${score.toFixed(3)}`);
    lines.push(`   ${rationale}`);
    lines.push('');
  });

  if (result.followUpQuestions && result.mode === 'interactive') {
    lines.push('-'.repeat(60));
    lines.push('FOLLOW-UP QUESTIONS');
    lines.push('-'.repeat(60));
    lines.push('');
    lines.push(result.followUpQuestions.formatted);
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Get strategy descriptions.
 * @returns {Object} Strategy name to description mapping
 */
function getStrategyDescriptions() {
  return STRATEGY_DESCRIPTIONS;
}

module.exports = {
  brainstorm,
  formatBrainstormResult,
  getStrategyDescriptions,
  QueryAnalyzer,
  QuestionGenerator,
  StrategySelector,
  DomainType,
  InsightDepth,
};
