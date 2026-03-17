/**
 * Query Analyzer for the Brainstorm Skill.
 *
 * Analyzes user queries to detect domain, question type, and complexity
 * to enable intelligent auto-selection of strategies.
 *
 * Converted from Python to JavaScript for SmartReader integration.
 */

const DomainType = {
  GENERAL: 'general',
  SCIENTIFIC: 'scientific',
  BUSINESS: 'business',
  CREATIVE: 'creative',
  TECHNICAL: 'technical',
  PHILOSOPHICAL: 'philosophical',
};

const InsightDepth = {
  SURFACE: 'surface',
  INTERMEDIATE: 'intermediate',
  DEEP: 'deep',
  PROFOUND: 'profound',
};

const QuestionType = {
  WHAT_IF: 'what_if',
  WHY: 'why',
  HOW_TO: 'how_to',
  IMPROVE: 'improve',
  EXPLAIN: 'explain',
  CREATIVE: 'creative',
  COMPARE: 'compare',
  GENERAL: 'general',
};

const DOMAIN_KEYWORDS = {
  [DomainType.SCIENTIFIC]: {
    research: 1.0, experiment: 1.0, hypothesis: 1.0,
    data: 0.7, study: 0.8, theory: 0.9, evidence: 0.8,
    analysis: 0.6, variable: 0.9, methodology: 1.0,
    empirical: 1.0, observation: 0.7, scientific: 1.0,
    biology: 1.0, physics: 1.0, chemistry: 1.0,
    psychology: 0.9, neuroscience: 1.0, medicine: 0.9,
    climate: 0.8, environment: 0.7, evolution: 0.9,
    genetic: 1.0, quantum: 1.0, statistical: 0.8,
  },
  [DomainType.BUSINESS]: {
    market: 1.0, revenue: 1.0, customer: 0.9,
    strategy: 0.8, profit: 1.0, growth: 0.8,
    company: 0.7, startup: 0.9, entrepreneur: 0.9,
    investment: 0.9, roi: 1.0, kpi: 1.0,
    marketing: 0.9, sales: 0.8, brand: 0.8,
    competitor: 0.9, pricing: 0.8, product: 0.6,
    stakeholder: 0.9, leadership: 0.7, management: 0.7,
    budget: 0.8, finance: 0.9, economic: 0.7,
  },
  [DomainType.CREATIVE]: {
    art: 1.0, design: 0.9, story: 0.9,
    creative: 1.0, imagine: 0.9, express: 0.8,
    artistic: 1.0, aesthetic: 0.9, visual: 0.7,
    music: 1.0, writing: 0.8, poetry: 1.0,
    film: 0.9, narrative: 0.8, fiction: 0.9,
    innovation: 0.7, inspiration: 0.8, original: 0.7,
    painting: 1.0, sculpture: 1.0, composition: 0.8,
    beauty: 0.7, emotion: 0.6, style: 0.6,
  },
  [DomainType.TECHNICAL]: {
    code: 1.0, system: 0.8, architecture: 0.9,
    performance: 0.7, scale: 0.8, software: 1.0,
    algorithm: 1.0, database: 1.0, api: 1.0,
    programming: 1.0, developer: 0.9, engineering: 0.9,
    infrastructure: 0.9, deployment: 0.9, security: 0.8,
    optimization: 0.7, debug: 1.0, testing: 0.8,
    framework: 0.9, library: 0.8, tool: 0.5,
    'machine learning': 1.0, ai: 0.9, automation: 0.8,
  },
  [DomainType.PHILOSOPHICAL]: {
    meaning: 1.0, ethics: 1.0, consciousness: 1.0,
    existence: 1.0, truth: 0.9, moral: 1.0,
    philosophy: 1.0, metaphysics: 1.0, epistemology: 1.0,
    reality: 0.8, mind: 0.7, soul: 0.9,
    purpose: 0.8, value: 0.6, belief: 0.7,
    knowledge: 0.6, wisdom: 0.9, virtue: 1.0,
    'free will': 1.0, determinism: 1.0, identity: 0.8,
    justice: 0.9, rights: 0.7, ought: 0.9,
  },
};

const QUESTION_PATTERNS = {
  [QuestionType.WHAT_IF]: [
    /\bwhat if\b/i, /\bimagine\b/i, /\bsuppose\b/i,
    /\bhypothetically\b/i, /\bwhat would happen\b/i,
    /\bwhat could\b/i, /\bif we\b.*\bwould\b/i,
  ],
  [QuestionType.WHY]: [
    /^why\b/i, /\bwhy is\b/i, /\bwhy do\b/i,
    /\bwhy does\b/i, /\bcause\b/i, /\breason\b/i,
    /\bexplain why\b/i, /\bwhat causes\b/i,
  ],
  [QuestionType.HOW_TO]: [
    /^how\b/i, /\bhow to\b/i, /\bhow can\b/i,
    /\bhow do\b/i, /\bways to\b/i, /\bsteps to\b/i,
    /\bmethod\b/i, /\bapproach\b/i, /\bprocess\b/i,
  ],
  [QuestionType.IMPROVE]: [
    /\bimprove\b/i, /\boptimize\b/i, /\benhance\b/i,
    /\bbetter\b/i, /\bincrease\b/i, /\breduce\b/i,
    /\bfix\b/i, /\bsolve\b/i, /\baddress\b/i,
    /\bovercome\b/i, /\bboost\b/i,
  ],
  [QuestionType.EXPLAIN]: [
    /^what is\b/i, /\bdefine\b/i, /\bdescribe\b/i,
    /\bexplain\b/i, /\bclarify\b/i, /\bwhat does\b/i,
    /\bmeaning of\b/i, /\bunderstand\b/i,
  ],
  [QuestionType.COMPARE]: [
    /\bcompare\b/i, /\bversus\b/i, /\bvs\b/i,
    /\bdifference\b/i, /\bsimilar\b/i, /\bbetter than\b/i,
    /\badvantage\b/i, /\bdisadvantage\b/i, /\bpros and cons\b/i,
  ],
  [QuestionType.CREATIVE]: [
    /\bcreate\b/i, /\binvent\b/i, /\bdesign\b/i,
    /\bbrainstorm\b/i, /\bideas for\b/i, /\bnew ways\b/i,
    /\binnovative\b/i, /\boriginal\b/i, /\bunique\b/i,
  ],
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
  'by', 'from', 'as', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if',
  'or', 'because', 'until', 'while', 'this', 'that', 'these',
  'those', 'what', 'which', 'who', 'whom', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'it', 'its', 'they', 'them',
]);

class QueryAnalyzer {
  /**
   * Analyzes queries to extract domain, question type, and other metadata.
   */

  /**
   * Analyze a query and return structured analysis.
   * @param {string} query - The query to analyze
   * @returns {Object} Analysis result
   */
  analyze(query) {
    const normalized = query.toLowerCase().trim();
    const keywords = this._extractKeywords(normalized);
    const [domain, domainConfidence] = this._detectDomain(normalized, keywords);
    const [questionType, questionConfidence] = this._classifyQuestionType(normalized);
    const complexity = this._assessComplexity(query, keywords);

    return {
      query,
      domain,
      domainConfidence,
      questionType,
      questionTypeConfidence: questionConfidence,
      complexity,
      keywords,
    };
  }

  /**
   * Extract meaningful keywords from text.
   * @param {string} text - Normalized text
   * @returns {string[]} List of keywords
   */
  _extractKeywords(text) {
    const words = text.match(/\b[a-z]+\b/g) || [];
    return words.filter(w => !STOP_WORDS.has(w) && w.length > 2);
  }

  /**
   * Detect the domain of the query.
   * @param {string} text - Normalized text
   * @param {string[]} keywords - Extracted keywords
   * @returns {[string, number]} Domain and confidence
   */
  _detectDomain(text, keywords) {
    const scores = {};
    for (const domain of Object.values(DomainType)) {
      scores[domain] = 0.0;
    }

    for (const [domain, domainKeywords] of Object.entries(DOMAIN_KEYWORDS)) {
      for (const [keyword, weight] of Object.entries(domainKeywords)) {
        if (text.includes(keyword.toLowerCase())) {
          scores[domain] += weight;
        }
        for (const extracted of keywords) {
          if (keyword.toLowerCase().split(' ').includes(extracted)) {
            scores[domain] += weight * 0.5;
          }
        }
      }
    }

    let bestDomain = DomainType.GENERAL;
    let bestScore = 0;
    for (const [domain, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    const maxPossible = Math.max(
      ...Object.values(DOMAIN_KEYWORDS).map(kw =>
        Object.values(kw).reduce((sum, v) => sum + v, 0)
      )
    );
    const confidence = Math.min(bestScore / (maxPossible * 0.3), 1.0);

    if (confidence < 0.15) {
      return [DomainType.GENERAL, confidence];
    }
    return [bestDomain, confidence];
  }

  /**
   * Classify the type of question.
   * @param {string} text - Normalized text
   * @returns {[string, number]} Question type and confidence
   */
  _classifyQuestionType(text) {
    const scores = {};
    for (const qtype of Object.values(QuestionType)) {
      scores[qtype] = 0;
    }

    for (const [qtype, patterns] of Object.entries(QUESTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          scores[qtype] += 1;
        }
      }
    }

    let bestType = QuestionType.GENERAL;
    let bestScore = 0;
    for (const [qtype, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = qtype;
      }
    }

    if (bestScore === 0) {
      return [QuestionType.GENERAL, 0.5];
    }

    const totalPatterns = QUESTION_PATTERNS[bestType]?.length || 1;
    const confidence = Math.min(bestScore / Math.max(totalPatterns * 0.3, 1), 1.0);
    return [bestType, confidence];
  }

  /**
   * Assess the complexity of the query.
   * @param {string} query - Original query
   * @param {string[]} keywords - Extracted keywords
   * @returns {string} Complexity level
   */
  _assessComplexity(query, keywords) {
    let complexityScore = 0;
    const wordCount = query.split(/\s+/).length;

    if (wordCount > 30) {
      complexityScore += 2;
    } else if (wordCount > 15) {
      complexityScore += 1;
    }

    const uniqueKeywords = new Set(keywords);
    if (uniqueKeywords.size > 10) {
      complexityScore += 2;
    } else if (uniqueKeywords.size > 5) {
      complexityScore += 1;
    }

    const clauseIndicators = (query.match(/[,;]|\band\b|\bor\b|\bbut\b/gi) || []).length;
    if (clauseIndicators > 3) {
      complexityScore += 2;
    } else if (clauseIndicators > 1) {
      complexityScore += 1;
    }

    const abstractIndicators = [
      'relationship', 'impact', 'influence', 'implications',
      'consequences', 'dynamics', 'interaction', 'systemic',
      'fundamental', 'underlying', 'interconnected',
    ];
    const lowerQuery = query.toLowerCase();
    const abstractCount = abstractIndicators.filter(ind => lowerQuery.includes(ind)).length;
    complexityScore += Math.min(abstractCount, 2);

    if (complexityScore >= 5) {
      return 'complex';
    } else if (complexityScore >= 2) {
      return 'moderate';
    }
    return 'simple';
  }
}

module.exports = {
  QueryAnalyzer,
  DomainType,
  InsightDepth,
  QuestionType,
};
