/**
 * DomainDetectionSkill - Automatically detect the learning domain from content
 *
 * This AI skill analyzes text content to determine the most appropriate
 * learning domain type (vocabulary, math, language, knowledge, skill).
 *
 * Use cases:
 * - Auto-suggest domain when user creates a learning topic
 * - Validate user's domain selection
 * - Detect domain from book/article content
 */

const BaseSkill = require('../BaseSkill');

// Domain type definitions (same as LearningDomains.ts)
const DOMAIN_TYPES = {
  VOCABULARY: 'vocabulary',
  MATH: 'math',
  LANGUAGE: 'language',
  KNOWLEDGE: 'knowledge',
  SKILL: 'skill',
};

// Keywords and patterns for each domain
const DOMAIN_INDICATORS = {
  vocabulary: {
    keywords: [
      'word', 'definition', 'meaning', 'vocabulary', 'synonym', 'antonym',
      'etymology', 'pronunciation', 'usage', 'lexicon', 'terminology',
      'glossary', 'dictionary', 'thesaurus', 'GRE', 'SAT', 'TOEFL', 'IELTS',
    ],
    patterns: [
      /\bdefine\s+\w+/i,
      /\bmeaning\s+of\b/i,
      /\bword\s+(list|bank|study)/i,
      /\bvocab(ulary)?\b/i,
    ],
    contentTypes: ['definitions', 'word lists', 'flashcards'],
  },
  math: {
    keywords: [
      'equation', 'formula', 'calculate', 'theorem', 'proof', 'algebra',
      'calculus', 'geometry', 'trigonometry', 'statistics', 'probability',
      'derivative', 'integral', 'function', 'variable', 'coefficient',
      'polynomial', 'matrix', 'vector', 'linear', 'quadratic',
    ],
    patterns: [
      /\d+\s*[+\-*/^=]\s*\d+/,  // Basic math expressions
      /[a-z]\s*=\s*[a-z0-9+\-*/^()]+/i,  // Equations
      /\b(sin|cos|tan|log|ln|sqrt)\b/i,  // Math functions
      /\b(theorem|lemma|corollary|proof)\b/i,
      /∫|∑|∏|√|∂|∇|∞/,  // Math symbols
    ],
    contentTypes: ['problems', 'formulas', 'proofs', 'examples'],
  },
  language: {
    keywords: [
      'grammar', 'tense', 'conjugation', 'sentence', 'phrase', 'clause',
      'subject', 'predicate', 'noun', 'verb', 'adjective', 'adverb',
      'preposition', 'translation', 'reading comprehension', 'writing',
      'speaking', 'listening', 'fluency', 'native speaker',
    ],
    patterns: [
      /\b(present|past|future)\s+(simple|continuous|perfect)/i,
      /\b(grammar|grammatical)\s+(rule|error|structure)/i,
      /\btranslate\s+(from|to|into)\b/i,
      /\b(Spanish|French|German|Chinese|Japanese|Korean|Arabic)\s+(lesson|learning|course)/i,
    ],
    contentTypes: ['grammar rules', 'exercises', 'passages', 'dialogues'],
  },
  knowledge: {
    keywords: [
      'concept', 'theory', 'principle', 'history', 'science', 'biology',
      'chemistry', 'physics', 'philosophy', 'psychology', 'economics',
      'political', 'sociology', 'anthropology', 'geography', 'literature',
      'explain', 'understand', 'learn about', 'topic', 'subject',
    ],
    patterns: [
      /\b(what|why|how|when|where)\s+(is|was|are|were|did)\b/i,
      /\bthe\s+(history|science|theory|concept)\s+of\b/i,
      /\blearn(ing)?\s+about\b/i,
      /\bunderstand(ing)?\s+(the|how|why)\b/i,
    ],
    contentTypes: ['facts', 'concepts', 'relationships', 'summaries'],
  },
  skill: {
    keywords: [
      'programming', 'code', 'coding', 'tutorial', 'how to', 'step by step',
      'practice', 'exercise', 'project', 'build', 'create', 'develop',
      'design', 'implement', 'debug', 'test', 'deploy', 'framework',
      'library', 'API', 'function', 'class', 'method', 'algorithm',
    ],
    patterns: [
      /\bhow\s+to\s+\w+/i,
      /\bstep[- ]by[- ]step\b/i,
      /\b(tutorial|guide|course)\s+for\b/i,
      /```[\s\S]*```/,  // Code blocks
      /\b(JavaScript|Python|Java|C\+\+|React|Node|CSS|HTML)\b/i,
    ],
    contentTypes: ['tutorials', 'exercises', 'projects', 'code examples'],
  },
};

class DomainDetectionSkill extends BaseSkill {
  static get name() {
    return 'detect_domain';
  }

  static get description() {
    return 'Analyze content to detect the most appropriate learning domain type (vocabulary, math, language, knowledge, skill). Returns domain type with confidence score and reasoning.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text content to analyze for domain detection',
      },
      title: {
        type: 'string',
        description: 'Optional title or topic name for additional context',
      },
      sourceType: {
        type: 'string',
        enum: ['book', 'article', 'vocabulary_set', 'chat', 'manual', 'unknown'],
        default: 'unknown',
        description: 'The source type of the content',
      },
      useAI: {
        type: 'boolean',
        default: false,
        description: 'Whether to use AI for more accurate detection (slower but more accurate)',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'learning';
  }

  async execute({ text, title = '', sourceType = 'unknown', useAI = false }) {
    // First, do rule-based detection
    const ruleBasedResult = this.detectDomainRuleBased(text, title);

    // If confidence is high enough or AI not requested, return rule-based result
    if (!useAI || ruleBasedResult.confidence >= 0.8) {
      this.logExecution(
        { textLength: text.length, sourceType, useAI },
        { domain: ruleBasedResult.domain, confidence: ruleBasedResult.confidence }
      );
      return ruleBasedResult;
    }

    // Use AI for more accurate detection
    const aiResult = await this.detectDomainWithAI(text, title, ruleBasedResult);

    this.logExecution(
      { textLength: text.length, sourceType, useAI: true },
      { domain: aiResult.domain, confidence: aiResult.confidence }
    );

    return aiResult;
  }

  /**
   * Rule-based domain detection using keywords and patterns
   */
  detectDomainRuleBased(text, title = '') {
    const combinedText = `${title} ${text}`.toLowerCase();
    const scores = {};
    const details = {};

    // Calculate score for each domain
    for (const [domain, indicators] of Object.entries(DOMAIN_INDICATORS)) {
      let score = 0;
      const matches = [];

      // Check keywords
      for (const keyword of indicators.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const keywordMatches = combinedText.match(regex);
        if (keywordMatches) {
          score += keywordMatches.length * 2;
          matches.push({ type: 'keyword', value: keyword, count: keywordMatches.length });
        }
      }

      // Check patterns
      for (const pattern of indicators.patterns) {
        const patternMatches = combinedText.match(pattern);
        if (patternMatches) {
          score += patternMatches.length * 5;  // Patterns are stronger indicators
          matches.push({ type: 'pattern', value: pattern.toString(), count: patternMatches.length });
        }
      }

      scores[domain] = score;
      details[domain] = { score, matches, contentTypes: indicators.contentTypes };
    }

    // Normalize scores to get confidence
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
    const normalizedScores = {};

    for (const domain of Object.keys(scores)) {
      normalizedScores[domain] = scores[domain] / totalScore;
    }

    // Find the best domain
    let bestDomain = DOMAIN_TYPES.KNOWLEDGE;  // Default
    let bestScore = 0;

    for (const [domain, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    // Calculate confidence (higher if one domain clearly dominates)
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    let confidence = 0.5;  // Default confidence

    if (sortedScores[0] > 0) {
      // Confidence based on how much the top domain dominates
      const dominance = sortedScores[1] > 0
        ? (sortedScores[0] - sortedScores[1]) / sortedScores[0]
        : 1;
      confidence = Math.min(0.95, 0.5 + (dominance * 0.45));
    }

    return {
      domain: bestDomain,
      confidence: Math.round(confidence * 100) / 100,
      scores: normalizedScores,
      details: details[bestDomain],
      allDomains: Object.keys(normalizedScores)
        .map(d => ({ domain: d, score: normalizedScores[d], details: details[d] }))
        .sort((a, b) => b.score - a.score),
      method: 'rule_based',
    };
  }

  /**
   * AI-based domain detection for complex or ambiguous content
   */
  async detectDomainWithAI(text, title, ruleBasedHint) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      // Fall back to rule-based if AI not available
      return { ...ruleBasedHint, method: 'rule_based_fallback' };
    }

    const prompt = this.buildAIPrompt(text, title, ruleBasedHint);

    try {
      const response = await aiProvider.generateContentWithJson(prompt);
      const result = this.parseAIResponse(response);

      return {
        domain: result.domain || ruleBasedHint.domain,
        confidence: result.confidence || ruleBasedHint.confidence,
        reasoning: result.reasoning,
        suggestedTitle: result.suggestedTitle,
        suggestedDescription: result.suggestedDescription,
        contentTypes: result.contentTypes || [],
        method: 'ai_enhanced',
        ruleBasedHint: {
          domain: ruleBasedHint.domain,
          confidence: ruleBasedHint.confidence,
        },
      };
    } catch (error) {
      console.error('[DomainDetectionSkill] AI detection failed:', error);
      return { ...ruleBasedHint, method: 'rule_based_fallback', error: error.message };
    }
  }

  buildAIPrompt(text, title, ruleBasedHint) {
    const textSample = text.length > 2000 ? text.substring(0, 2000) + '...' : text;

    return `Analyze the following content and determine the most appropriate learning domain type.

Available domain types:
1. vocabulary - Word learning with definitions, usage, and spaced repetition
2. math - Mathematical concepts, formulas, and problem-solving
3. language - Language learning: grammar, reading, writing, listening (for learning a foreign language)
4. knowledge - Learning facts, concepts, and their relationships (books, subjects, topics)
5. skill - Procedural learning: programming, design, crafts, techniques

${title ? `Title: ${title}\n` : ''}
Content:
"""
${textSample}
"""

Rule-based analysis suggests: ${ruleBasedHint.domain} (confidence: ${ruleBasedHint.confidence})

Provide your analysis as JSON:
{
  "domain": "vocabulary|math|language|knowledge|skill",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this domain was chosen",
  "suggestedTitle": "A concise title for this learning topic",
  "suggestedDescription": "A brief description of what will be learned",
  "contentTypes": ["list", "of", "content", "types", "detected"]
}`;
  }

  parseAIResponse(response) {
    try {
      // Handle different response formats
      if (typeof response === 'object' && response.domain) {
        return response;
      }

      if (typeof response === 'string') {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      if (Array.isArray(response)) {
        const textContent = response
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('');
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return {};
    } catch (error) {
      console.error('[DomainDetectionSkill] Failed to parse AI response:', error);
      return {};
    }
  }
}

module.exports = DomainDetectionSkill;
