/**
 * Strategy Selector for the Brainstorm Skill.
 *
 * Automatically selects optimal cognitive enhancement strategies based on
 * query analysis, domain, and depth requirements.
 *
 * Converted from Python to JavaScript for SmartReader integration.
 */

const { QueryAnalyzer, QuestionType, DomainType, InsightDepth } = require('./queryAnalyzer');

const AVAILABLE_STRATEGIES = [
  'assumption_challenge',
  'semantic_expansion',
  'adversarial_questioning',
  'causal_analysis',
  'analogical_reasoning',
  'knowledge_graph',
  'scenario_simulation',
  'mental_model',
];

const QUESTION_TYPE_WEIGHTS = {
  [QuestionType.WHAT_IF]: {
    scenario_simulation: 1.0, assumption_challenge: 0.8,
    causal_analysis: 0.6, analogical_reasoning: 0.5,
    mental_model: 0.4, adversarial_questioning: 0.3,
    knowledge_graph: 0.2, semantic_expansion: 0.2,
  },
  [QuestionType.WHY]: {
    causal_analysis: 1.0, assumption_challenge: 0.7,
    knowledge_graph: 0.6, mental_model: 0.5,
    adversarial_questioning: 0.4, analogical_reasoning: 0.3,
    scenario_simulation: 0.3, semantic_expansion: 0.2,
  },
  [QuestionType.HOW_TO]: {
    analogical_reasoning: 1.0, knowledge_graph: 0.8,
    mental_model: 0.7, scenario_simulation: 0.5,
    causal_analysis: 0.4, assumption_challenge: 0.4,
    adversarial_questioning: 0.3, semantic_expansion: 0.3,
  },
  [QuestionType.IMPROVE]: {
    adversarial_questioning: 1.0, assumption_challenge: 0.9,
    scenario_simulation: 0.7, mental_model: 0.6,
    causal_analysis: 0.5, analogical_reasoning: 0.4,
    knowledge_graph: 0.3, semantic_expansion: 0.2,
  },
  [QuestionType.EXPLAIN]: {
    semantic_expansion: 1.0, knowledge_graph: 0.9,
    causal_analysis: 0.6, mental_model: 0.5,
    analogical_reasoning: 0.4, assumption_challenge: 0.3,
    adversarial_questioning: 0.2, scenario_simulation: 0.2,
  },
  [QuestionType.COMPARE]: {
    adversarial_questioning: 1.0, analogical_reasoning: 0.9,
    knowledge_graph: 0.7, assumption_challenge: 0.6,
    mental_model: 0.5, causal_analysis: 0.4,
    semantic_expansion: 0.4, scenario_simulation: 0.3,
  },
  [QuestionType.CREATIVE]: {
    analogical_reasoning: 1.0, scenario_simulation: 0.9,
    assumption_challenge: 0.8, semantic_expansion: 0.6,
    adversarial_questioning: 0.5, mental_model: 0.4,
    knowledge_graph: 0.3, causal_analysis: 0.3,
  },
  [QuestionType.GENERAL]: {
    assumption_challenge: 0.7, analogical_reasoning: 0.7,
    scenario_simulation: 0.7, causal_analysis: 0.6,
    adversarial_questioning: 0.6, mental_model: 0.6,
    knowledge_graph: 0.5, semantic_expansion: 0.5,
  },
};

const DOMAIN_WEIGHTS = {
  [DomainType.SCIENTIFIC]: {
    causal_analysis: 1.0, knowledge_graph: 0.9,
    assumption_challenge: 0.8, mental_model: 0.6,
    adversarial_questioning: 0.5, analogical_reasoning: 0.4,
    scenario_simulation: 0.4, semantic_expansion: 0.3,
  },
  [DomainType.BUSINESS]: {
    scenario_simulation: 1.0, adversarial_questioning: 0.9,
    mental_model: 0.8, assumption_challenge: 0.7,
    causal_analysis: 0.5, analogical_reasoning: 0.5,
    knowledge_graph: 0.4, semantic_expansion: 0.3,
  },
  [DomainType.CREATIVE]: {
    analogical_reasoning: 1.0, semantic_expansion: 0.9,
    scenario_simulation: 0.8, assumption_challenge: 0.7,
    mental_model: 0.5, adversarial_questioning: 0.4,
    knowledge_graph: 0.3, causal_analysis: 0.3,
  },
  [DomainType.TECHNICAL]: {
    knowledge_graph: 1.0, causal_analysis: 0.9,
    mental_model: 0.8, assumption_challenge: 0.6,
    scenario_simulation: 0.5, adversarial_questioning: 0.5,
    analogical_reasoning: 0.4, semantic_expansion: 0.3,
  },
  [DomainType.PHILOSOPHICAL]: {
    assumption_challenge: 1.0, analogical_reasoning: 0.9,
    mental_model: 0.8, adversarial_questioning: 0.7,
    semantic_expansion: 0.6, causal_analysis: 0.5,
    scenario_simulation: 0.4, knowledge_graph: 0.3,
  },
  [DomainType.GENERAL]: {
    assumption_challenge: 0.7, analogical_reasoning: 0.7,
    scenario_simulation: 0.6, mental_model: 0.6,
    causal_analysis: 0.6, adversarial_questioning: 0.6,
    knowledge_graph: 0.5, semantic_expansion: 0.5,
  },
};

const DEPTH_WEIGHTS = {
  [InsightDepth.SURFACE]: {
    semantic_expansion: 1.0, knowledge_graph: 0.9,
    mental_model: 0.5, analogical_reasoning: 0.4,
    causal_analysis: 0.3, assumption_challenge: 0.3,
    adversarial_questioning: 0.2, scenario_simulation: 0.2,
  },
  [InsightDepth.INTERMEDIATE]: {
    causal_analysis: 1.0, adversarial_questioning: 0.9,
    knowledge_graph: 0.8, mental_model: 0.7,
    semantic_expansion: 0.6, analogical_reasoning: 0.5,
    assumption_challenge: 0.5, scenario_simulation: 0.4,
  },
  [InsightDepth.DEEP]: {
    assumption_challenge: 1.0, analogical_reasoning: 0.9,
    scenario_simulation: 0.8, mental_model: 0.7,
    adversarial_questioning: 0.7, causal_analysis: 0.6,
    knowledge_graph: 0.5, semantic_expansion: 0.4,
  },
  [InsightDepth.PROFOUND]: {
    assumption_challenge: 1.0, analogical_reasoning: 0.95,
    scenario_simulation: 0.9, mental_model: 0.85,
    adversarial_questioning: 0.8, causal_analysis: 0.75,
    knowledge_graph: 0.6, semantic_expansion: 0.5,
  },
};

// Complementarity bonuses when strategies are selected together
const COMPLEMENTARITY_PAIRS = {
  'assumption_challenge:analogical_reasoning': 0.2,
  'assumption_challenge:scenario_simulation': 0.15,
  'causal_analysis:scenario_simulation': 0.2,
  'causal_analysis:mental_model': 0.15,
  'semantic_expansion:knowledge_graph': 0.15,
  'analogical_reasoning:semantic_expansion': 0.1,
  'adversarial_questioning:assumption_challenge': 0.15,
  'adversarial_questioning:scenario_simulation': 0.1,
  'mental_model:causal_analysis': 0.15,
  'mental_model:scenario_simulation': 0.1,
  'knowledge_graph:causal_analysis': 0.1,
};

const STRATEGY_DESCRIPTIONS = {
  assumption_challenge: 'Identifies and challenges hidden assumptions',
  semantic_expansion: 'Explores linguistic relationships and word meanings',
  adversarial_questioning: 'Generates counter-arguments and probing questions',
  causal_analysis: 'Builds causal graphs and Why-Because chains',
  analogical_reasoning: 'Finds cross-domain parallels and structural mappings',
  knowledge_graph: 'Leverages structured knowledge relationships',
  scenario_simulation: 'Explores alternative futures and what-if scenarios',
  mental_model: 'Builds explicit cognitive frameworks of the problem',
};

class StrategySelector {
  /**
   * Automatically selects optimal strategies based on query characteristics.
   */

  constructor(queryAnalyzer = null) {
    this.queryAnalyzer = queryAnalyzer || new QueryAnalyzer();
  }

  /**
   * Select optimal strategies for a query.
   * @param {string} query - The brainstorming query
   * @param {string} domain - Optional domain override
   * @param {string} depth - Insight depth level
   * @param {number} count - Number of strategies to select
   * @param {string[]} exclude - Strategies to exclude
   * @returns {Object} StrategySelection with strategies, scores, and rationale
   */
  selectStrategies(query, domain = null, depth = InsightDepth.DEEP, count = 3, exclude = []) {
    const analysis = this.queryAnalyzer.analyze(query);

    if (domain === null) {
      domain = analysis.domain;
    }

    const questionType = analysis.questionType;
    const excludeSet = new Set(exclude);

    const scores = {};
    const rationale = {};

    for (const strategy of AVAILABLE_STRATEGIES) {
      if (excludeSet.has(strategy)) {
        continue;
      }

      let score = 0.0;
      const reasons = [];

      // Question type weight (40%)
      const qtypeWeights = QUESTION_TYPE_WEIGHTS[questionType] || QUESTION_TYPE_WEIGHTS[QuestionType.GENERAL];
      const qtypeWeight = qtypeWeights[strategy] || 0.3;
      score += qtypeWeight * 0.4;
      if (qtypeWeight >= 0.7) {
        reasons.push(`Good fit for ${questionType} questions`);
      }

      // Domain weight (35%)
      const domainWeights = DOMAIN_WEIGHTS[domain] || DOMAIN_WEIGHTS[DomainType.GENERAL];
      const domainWeight = domainWeights[strategy] || 0.3;
      score += domainWeight * 0.35;
      if (domainWeight >= 0.7) {
        reasons.push(`Strong in ${domain} domain`);
      }

      // Depth weight (25%)
      const depthWeights = DEPTH_WEIGHTS[depth] || DEPTH_WEIGHTS[InsightDepth.DEEP];
      const depthWeight = depthWeights[strategy] || 0.3;
      score += depthWeight * 0.25;
      if (depthWeight >= 0.7) {
        reasons.push(`Suitable for ${depth} analysis`);
      }

      scores[strategy] = score;
      rationale[strategy] = STRATEGY_DESCRIPTIONS[strategy];
      if (reasons.length > 0) {
        rationale[strategy] += ` (${reasons.join(', ')})`;
      }
    }

    const selected = this._selectWithComplementarity(scores, count);

    return {
      strategies: selected,
      scores: Object.fromEntries(selected.map(s => [s, scores[s]])),
      rationale: Object.fromEntries(selected.map(s => [s, rationale[s]])),
    };
  }

  /**
   * Select strategies considering complementarity bonuses.
   * @param {Object} baseScores - Base scores for each strategy
   * @param {number} count - Number of strategies to select
   * @returns {string[]} Selected strategy names
   */
  _selectWithComplementarity(baseScores, count) {
    const selected = [];
    const remaining = new Set(Object.keys(baseScores));

    for (let i = 0; i < Math.min(count, remaining.size); i++) {
      if (remaining.size === 0) break;

      const adjustedScores = {};
      for (const strategy of remaining) {
        let score = baseScores[strategy];

        // Add complementarity bonuses
        for (const prevStrategy of selected) {
          const pair1 = `${prevStrategy}:${strategy}`;
          const pair2 = `${strategy}:${prevStrategy}`;
          const bonus = COMPLEMENTARITY_PAIRS[pair1] || COMPLEMENTARITY_PAIRS[pair2] || 0;
          score += bonus;
        }
        adjustedScores[strategy] = score;
      }

      // Find best strategy
      let best = null;
      let bestScore = -Infinity;
      for (const strategy of remaining) {
        if (adjustedScores[strategy] > bestScore) {
          bestScore = adjustedScores[strategy];
          best = strategy;
        }
      }

      if (best) {
        selected.push(best);
        remaining.delete(best);
      }
    }

    return selected;
  }
}

module.exports = {
  StrategySelector,
  AVAILABLE_STRATEGIES,
  STRATEGY_DESCRIPTIONS,
  QUESTION_TYPE_WEIGHTS,
  DOMAIN_WEIGHTS,
  DEPTH_WEIGHTS,
};
