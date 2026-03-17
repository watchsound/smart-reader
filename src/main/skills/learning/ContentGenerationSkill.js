/**
 * ContentGenerationSkill - Domain-dependent, learning plan-driven content generation
 *
 * This skill generates learning content (quizzes, explanations, practice exercises,
 * flashcards) based on:
 * - The current learning plan phase and goals
 * - Domain type (vocabulary, math, language, knowledge, skill)
 * - Session type (review, learn_new, practice, quiz, assessment)
 * - Learner's mastery levels and weak areas
 *
 * Content Generation Strategy by Domain:
 * - Vocabulary: Flashcards, cloze tests, synonym/antonym matching, context sentences
 * - Math: Practice problems, worked examples, concept explanations, formula drills
 * - Language: Grammar exercises, translation, sentence building, reading comprehension
 * - Knowledge: Concept quizzes, fact recall, relationship mapping, explanation prompts
 * - Skill: Code exercises, project tasks, debugging challenges, technique drills
 */

const BaseSkill = require('../BaseSkill');

// Domain-specific content type configurations
const DOMAIN_CONTENT_TYPES = {
  vocabulary: {
    contentTypes: ['flashcard', 'cloze', 'matching', 'context_sentence', 'etymology_quiz', 'synonym_antonym'],
    sessionTypeMapping: {
      review: ['flashcard', 'cloze'],
      learn_new: ['flashcard', 'context_sentence', 'etymology_quiz'],
      quiz: ['cloze', 'matching', 'synonym_antonym'],
      practice: ['context_sentence', 'cloze'],
      assessment: ['cloze', 'matching', 'synonym_antonym'],
    },
  },
  math: {
    contentTypes: ['problem', 'worked_example', 'concept_explanation', 'formula_drill', 'word_problem', 'proof_exercise'],
    sessionTypeMapping: {
      review: ['problem', 'formula_drill'],
      learn_new: ['concept_explanation', 'worked_example'],
      quiz: ['problem', 'word_problem'],
      practice: ['problem', 'word_problem', 'formula_drill'],
      assessment: ['problem', 'word_problem', 'proof_exercise'],
    },
  },
  language: {
    contentTypes: ['grammar_exercise', 'translation', 'sentence_building', 'reading_comprehension', 'fill_blank', 'error_correction'],
    sessionTypeMapping: {
      review: ['fill_blank', 'grammar_exercise'],
      learn_new: ['grammar_exercise', 'sentence_building'],
      quiz: ['fill_blank', 'error_correction', 'translation'],
      practice: ['sentence_building', 'translation'],
      reading: ['reading_comprehension'],
      assessment: ['translation', 'error_correction', 'reading_comprehension'],
    },
  },
  knowledge: {
    contentTypes: ['concept_quiz', 'fact_recall', 'relationship_mapping', 'explanation_prompt', 'true_false', 'short_answer'],
    sessionTypeMapping: {
      review: ['fact_recall', 'true_false'],
      learn_new: ['explanation_prompt', 'concept_quiz'],
      quiz: ['concept_quiz', 'true_false', 'short_answer'],
      reading: ['explanation_prompt'],
      assessment: ['concept_quiz', 'short_answer', 'relationship_mapping'],
    },
  },
  skill: {
    contentTypes: ['code_exercise', 'project_task', 'debugging_challenge', 'technique_drill', 'implementation_task', 'code_review'],
    sessionTypeMapping: {
      review: ['technique_drill', 'code_review'],
      learn_new: ['technique_drill', 'code_exercise'],
      quiz: ['debugging_challenge', 'code_exercise'],
      practice: ['code_exercise', 'implementation_task'],
      project: ['project_task', 'implementation_task'],
      assessment: ['implementation_task', 'debugging_challenge'],
    },
  },
};

// Difficulty scaling by phase position
const PHASE_DIFFICULTY_SCALE = {
  early: { complexity: 'basic', distractorSimilarity: 'low', scaffolding: 'high' },
  middle: { complexity: 'moderate', distractorSimilarity: 'medium', scaffolding: 'medium' },
  late: { complexity: 'advanced', distractorSimilarity: 'high', scaffolding: 'low' },
};

class ContentGenerationSkill extends BaseSkill {
  static get name() {
    return 'generate_learning_content';
  }

  static get description() {
    return 'Generate domain-specific learning content driven by the learning plan. Creates quizzes, explanations, practice exercises, and flashcards based on current phase, session type, domain, and learner mastery levels.';
  }

  static get parameters() {
    return {
      action: {
        type: 'string',
        enum: ['generate_session_content', 'generate_review_items', 'generate_assessment', 'generate_explanation', 'generate_practice', 'suggest_content_mix'],
        description: 'The type of content generation action',
      },
      domainType: {
        type: 'string',
        enum: ['vocabulary', 'math', 'language', 'knowledge', 'skill'],
        description: 'The learning domain type',
      },
      sessionType: {
        type: 'string',
        enum: ['review', 'learn_new', 'mixed', 'quiz', 'practice', 'reading', 'project', 'assessment'],
        default: 'mixed',
        description: 'Type of learning session',
      },
      planContext: {
        type: 'object',
        description: 'Current learning plan context: { currentPhase, totalPhases, phaseGoals, difficulty, focusAreas }',
      },
      sourceContent: {
        type: 'string',
        description: 'Source material to generate content from (text, vocabulary list, concepts, etc.)',
      },
      sourceItems: {
        type: 'array',
        description: 'Array of items to generate content for (words, problems, concepts)',
      },
      masteryData: {
        type: 'object',
        description: 'Learner mastery data: { weakItems: [], strongItems: [], averageMastery, recentAccuracy }',
      },
      count: {
        type: 'number',
        default: 5,
        description: 'Number of content items to generate',
      },
      contentTypes: {
        type: 'array',
        description: 'Specific content types to generate (overrides automatic selection)',
      },
    };
  }

  static get requiredParams() {
    return ['action', 'domainType'];
  }

  static get category() {
    return 'learning';
  }

  async execute(params) {
    const { action } = params;

    switch (action) {
      case 'generate_session_content':
        return this.generateSessionContent(params);
      case 'generate_review_items':
        return this.generateReviewItems(params);
      case 'generate_assessment':
        return this.generateAssessment(params);
      case 'generate_explanation':
        return this.generateExplanation(params);
      case 'generate_practice':
        return this.generatePractice(params);
      case 'suggest_content_mix':
        return this.suggestContentMix(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Generate content for a learning session based on plan context
   */
  async generateSessionContent(params) {
    const {
      domainType,
      sessionType = 'mixed',
      planContext = {},
      sourceContent,
      sourceItems = [],
      masteryData = {},
      count = 5,
      contentTypes,
    } = params;

    // Determine content types based on domain and session type
    const domainConfig = DOMAIN_CONTENT_TYPES[domainType] || DOMAIN_CONTENT_TYPES.knowledge;
    const selectedTypes = contentTypes || this.selectContentTypes(domainConfig, sessionType, planContext);

    // Determine difficulty based on plan phase
    const difficultyConfig = this.getDifficultyConfig(planContext);

    // Prioritize items based on mastery data
    const prioritizedItems = this.prioritizeItems(sourceItems, masteryData, sessionType);

    // Generate content using AI or fallback
    const aiProvider = this.getAIProvider();
    let generatedContent;

    if (aiProvider) {
      generatedContent = await this.generateWithAI({
        domainType,
        sessionType,
        selectedTypes,
        difficultyConfig,
        prioritizedItems,
        sourceContent,
        planContext,
        count,
      });
    } else {
      generatedContent = this.generateFallbackContent(params, selectedTypes, prioritizedItems);
    }

    this.logExecution(
      { action: 'generate_session_content', domainType, sessionType, count },
      { generatedCount: generatedContent.items?.length || 0, types: selectedTypes }
    );

    return {
      success: true,
      content: generatedContent,
      metadata: {
        domainType,
        sessionType,
        contentTypes: selectedTypes,
        difficulty: difficultyConfig,
        itemCount: generatedContent.items?.length || 0,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate review items prioritizing weak areas
   */
  async generateReviewItems(params) {
    const {
      domainType,
      sourceItems = [],
      masteryData = {},
      count = 10,
    } = params;

    // For review, prioritize weak items
    const weakItems = masteryData.weakItems || [];
    const reviewItems = this.selectReviewItems(sourceItems, weakItems, masteryData, count);

    // Generate review content for these items
    const reviewContent = await this.generateSessionContent({
      ...params,
      sessionType: 'review',
      sourceItems: reviewItems,
      count,
    });

    return {
      ...reviewContent,
      reviewStrategy: {
        weakItemCount: weakItems.length,
        selectedForReview: reviewItems.length,
        spacedRepetitionApplied: true,
      },
    };
  }

  /**
   * Generate assessment content for phase completion
   */
  async generateAssessment(params) {
    const {
      domainType,
      planContext = {},
      sourceContent,
      sourceItems = [],
      count = 10,
    } = params;

    const domainConfig = DOMAIN_CONTENT_TYPES[domainType] || DOMAIN_CONTENT_TYPES.knowledge;
    const assessmentTypes = domainConfig.sessionTypeMapping.assessment || ['quiz'];

    // Assessment should cover full range of content
    const assessmentContent = await this.generateSessionContent({
      ...params,
      sessionType: 'assessment',
      contentTypes: assessmentTypes,
      count,
    });

    // Add scoring rubric
    const scoringRubric = this.generateScoringRubric(domainType, assessmentContent.content);

    return {
      ...assessmentContent,
      assessment: {
        type: 'phase_assessment',
        phaseNumber: planContext.currentPhase,
        passingScore: 0.7 + ((planContext.currentPhase || 1) - 1) * 0.05,
        timeLimit: this.calculateTimeLimit(domainType, count),
        scoringRubric,
      },
    };
  }

  /**
   * Generate explanation content for learning new concepts
   */
  async generateExplanation(params) {
    const {
      domainType,
      sourceContent,
      sourceItems = [],
      planContext = {},
    } = params;

    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      return {
        success: false,
        error: 'AI provider required for explanation generation',
      };
    }

    const prompt = this.buildExplanationPrompt(domainType, sourceContent, sourceItems, planContext);
    const response = await aiProvider.generateContentWithJson(prompt);

    return {
      success: true,
      explanation: response,
      metadata: {
        domainType,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate practice exercises
   */
  async generatePractice(params) {
    const {
      domainType,
      sourceItems = [],
      count = 5,
      planContext = {},
    } = params;

    return this.generateSessionContent({
      ...params,
      sessionType: 'practice',
      count,
    });
  }

  /**
   * Suggest optimal content mix for a session
   */
  suggestContentMix(params) {
    const {
      domainType,
      sessionType = 'mixed',
      planContext = {},
      masteryData = {},
    } = params;

    const domainConfig = DOMAIN_CONTENT_TYPES[domainType] || DOMAIN_CONTENT_TYPES.knowledge;
    const phasePosition = this.getPhasePosition(planContext);

    // Calculate mix based on mastery and phase
    const averageMastery = masteryData.averageMastery || 0.5;
    const recentAccuracy = masteryData.recentAccuracy || 0.5;

    let newContentPercent, reviewPercent, practicePercent;

    if (sessionType === 'review') {
      newContentPercent = 10;
      reviewPercent = 70;
      practicePercent = 20;
    } else if (sessionType === 'learn_new') {
      newContentPercent = 60;
      reviewPercent = 20;
      practicePercent = 20;
    } else {
      // Mixed - adjust based on mastery
      if (averageMastery < 0.5 || recentAccuracy < 0.6) {
        // Struggling - more review
        newContentPercent = 20;
        reviewPercent = 50;
        practicePercent = 30;
      } else if (averageMastery > 0.8 && recentAccuracy > 0.85) {
        // Excelling - more new content
        newContentPercent = 50;
        reviewPercent = 20;
        practicePercent = 30;
      } else {
        // Balanced
        newContentPercent = 35;
        reviewPercent = 35;
        practicePercent = 30;
      }
    }

    // Select content types based on session type
    const contentTypes = domainConfig.sessionTypeMapping[sessionType] ||
      domainConfig.sessionTypeMapping.mixed ||
      domainConfig.contentTypes.slice(0, 3);

    return {
      success: true,
      recommendation: {
        newContentPercent,
        reviewPercent,
        practicePercent,
        contentTypes,
        suggestedItemCount: this.suggestItemCount(sessionType, planContext),
        sessionDuration: this.suggestSessionDuration(sessionType, planContext),
        phaseAdjustments: this.getPhaseAdjustments(phasePosition, domainType),
      },
    };
  }

  // =============================================================================
  // Helper methods
  // =============================================================================

  selectContentTypes(domainConfig, sessionType, planContext) {
    const mapping = domainConfig.sessionTypeMapping[sessionType];
    if (mapping) {
      return mapping;
    }

    // For 'mixed' or unknown session types, combine learn_new and review
    const learnTypes = domainConfig.sessionTypeMapping.learn_new || [];
    const reviewTypes = domainConfig.sessionTypeMapping.review || [];
    return [...new Set([...learnTypes, ...reviewTypes])].slice(0, 3);
  }

  getDifficultyConfig(planContext) {
    const { currentPhase = 1, totalPhases = 3 } = planContext;
    const phaseRatio = currentPhase / totalPhases;

    if (phaseRatio <= 0.33) {
      return PHASE_DIFFICULTY_SCALE.early;
    } else if (phaseRatio <= 0.66) {
      return PHASE_DIFFICULTY_SCALE.middle;
    } else {
      return PHASE_DIFFICULTY_SCALE.late;
    }
  }

  getPhasePosition(planContext) {
    const { currentPhase = 1, totalPhases = 3 } = planContext;
    const phaseRatio = currentPhase / totalPhases;

    if (phaseRatio <= 0.33) return 'early';
    if (phaseRatio <= 0.66) return 'middle';
    return 'late';
  }

  prioritizeItems(sourceItems, masteryData, sessionType) {
    if (!sourceItems || sourceItems.length === 0) {
      return [];
    }

    const weakItems = new Set((masteryData.weakItems || []).map(i => i.id || i));
    const strongItems = new Set((masteryData.strongItems || []).map(i => i.id || i));

    // Score items based on priority
    const scoredItems = sourceItems.map(item => {
      const itemId = item.id || item;
      let priority = 50; // Base priority

      if (sessionType === 'review') {
        // For review, prioritize weak items
        if (weakItems.has(itemId)) priority = 100;
        else if (strongItems.has(itemId)) priority = 20;
      } else if (sessionType === 'learn_new') {
        // For new learning, prioritize items not yet mastered
        if (!strongItems.has(itemId)) priority = 80;
        if (weakItems.has(itemId)) priority = 30; // Already seen but struggling
      } else {
        // Mixed - balanced approach
        if (weakItems.has(itemId)) priority = 70;
        else if (!strongItems.has(itemId)) priority = 60;
      }

      // Add some randomness for variety
      priority += Math.random() * 10;

      return { item, priority };
    });

    // Sort by priority (descending) and return items
    return scoredItems
      .sort((a, b) => b.priority - a.priority)
      .map(s => s.item);
  }

  selectReviewItems(sourceItems, weakItems, masteryData, count) {
    const prioritized = this.prioritizeItems(sourceItems, { ...masteryData, weakItems }, 'review');
    return prioritized.slice(0, count);
  }

  async generateWithAI(config) {
    const {
      domainType,
      selectedTypes,
      prioritizedItems,
    } = config;

    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      return { items: [] };
    }

    const prompt = this.buildContentGenerationPrompt(config);

    try {
      const response = await aiProvider.generateContentWithJson(prompt);
      return this.parseContentResponse(response, domainType, selectedTypes);
    } catch (error) {
      console.error('[ContentGenerationSkill] AI generation failed:', error);
      // Return fallback content (raw format, not wrapped)
      return this.generateFallbackContent(config, selectedTypes, prioritizedItems);
    }
  }

  buildContentGenerationPrompt(config) {
    const {
      domainType,
      sessionType,
      selectedTypes,
      difficultyConfig,
      prioritizedItems,
      sourceContent,
      planContext,
      count,
    } = config;

    const itemsDescription = prioritizedItems.length > 0
      ? `\nItems to include: ${JSON.stringify(prioritizedItems.slice(0, 20))}`
      : '';

    const sourceDescription = sourceContent
      ? `\nSource material:\n"""\n${sourceContent.substring(0, 2000)}\n"""`
      : '';

    return `Generate ${count} learning content items for a ${domainType} learning session.

Session Type: ${sessionType}
Content Types to Generate: ${selectedTypes.join(', ')}
Difficulty: ${difficultyConfig.complexity}
Scaffolding Level: ${difficultyConfig.scaffolding}
${planContext.phaseGoals ? `Phase Goals: ${planContext.phaseGoals.join(', ')}` : ''}
${planContext.focusAreas?.length ? `Focus Areas: ${planContext.focusAreas.join(', ')}` : ''}
${itemsDescription}
${sourceDescription}

Generate content items in JSON format:
{
  "items": [
    {
      "type": "${selectedTypes[0]}",
      "content": {
        // Type-specific content structure
      },
      "difficulty": "easy|medium|hard",
      "targetItem": "the item being tested (if applicable)",
      "hint": "optional hint for learner",
      "explanation": "explanation for correct answer"
    }
  ],
  "sessionIntro": "Brief introduction for this session",
  "learningTips": ["tip1", "tip2"]
}

Content type structures by domain:

${this.getContentTypeStructures(domainType, selectedTypes)}

Generate diverse, engaging content appropriate for ${difficultyConfig.complexity} difficulty.`;
  }

  getContentTypeStructures(domainType, selectedTypes) {
    const structures = {
      vocabulary: {
        flashcard: '{ "front": "word", "back": "definition", "example": "sentence" }',
        cloze: '{ "sentence": "The ____ was bright", "answer": "sun", "options": ["sun", "moon", "star", "cloud"] }',
        matching: '{ "pairs": [{ "term": "word", "match": "definition" }] }',
        context_sentence: '{ "word": "term", "sentences": ["sentence1", "sentence2"], "correctIndex": 0 }',
        synonym_antonym: '{ "word": "happy", "type": "synonym|antonym", "options": ["joyful", "sad", "tired", "angry"], "answer": "joyful" }',
      },
      math: {
        problem: '{ "question": "Solve: 2x + 5 = 15", "answer": "5", "steps": ["step1", "step2"], "type": "algebra" }',
        worked_example: '{ "problem": "problem statement", "steps": [{ "step": "description", "result": "value" }], "finalAnswer": "answer" }',
        concept_explanation: '{ "concept": "name", "definition": "text", "examples": ["ex1", "ex2"], "keyPoints": ["point1"] }',
        formula_drill: '{ "formula": "a² + b² = c²", "question": "Find c if a=3, b=4", "answer": "5" }',
      },
      language: {
        grammar_exercise: '{ "rule": "present perfect", "sentence": "I ____ (eat) lunch", "answer": "have eaten", "options": ["ate", "have eaten", "eating", "eat"] }',
        translation: '{ "source": "original text", "sourceLanguage": "en", "targetLanguage": "es", "answer": "translated text" }',
        sentence_building: '{ "words": ["I", "to", "school", "go"], "correctOrder": [0, 3, 1, 2], "translation": "I go to school" }',
        fill_blank: '{ "sentence": "She ____ to the store", "answer": "went", "options": ["go", "went", "going", "gone"] }',
      },
      knowledge: {
        concept_quiz: '{ "question": "What is photosynthesis?", "options": ["A", "B", "C", "D"], "answer": "A", "explanation": "text" }',
        fact_recall: '{ "question": "In what year did X happen?", "answer": "1969", "category": "history" }',
        true_false: '{ "statement": "The Earth is flat", "answer": false, "explanation": "The Earth is roughly spherical" }',
        relationship_mapping: '{ "concept1": "DNA", "concept2": "RNA", "relationship": "transcription", "explanation": "text" }',
      },
      skill: {
        code_exercise: '{ "language": "javascript", "prompt": "Write a function that...", "starterCode": "function solve() {}", "solution": "code", "testCases": [{ "input": "x", "expected": "y" }] }',
        debugging_challenge: '{ "language": "python", "buggyCode": "code with bug", "description": "Find the bug", "hint": "Check the loop", "fixedCode": "corrected code" }',
        technique_drill: '{ "technique": "name", "description": "how to use", "exercise": "practice task", "example": "demonstration" }',
        project_task: '{ "title": "Build X", "description": "requirements", "steps": ["step1", "step2"], "deliverables": ["item1"] }',
      },
    };

    const domainStructures = structures[domainType] || structures.knowledge;
    return selectedTypes
      .map(type => `${type}: ${domainStructures[type] || '{ "content": "..." }'}`)
      .join('\n');
  }

  buildExplanationPrompt(domainType, sourceContent, sourceItems, planContext) {
    const items = sourceItems.slice(0, 10);
    const content = sourceContent?.substring(0, 1500) || '';

    return `Generate clear, educational explanations for ${domainType} learning.

${content ? `Source Material:\n"""\n${content}\n"""` : ''}
${items.length > 0 ? `Items to explain: ${JSON.stringify(items)}` : ''}
${planContext.difficulty ? `Target difficulty: ${planContext.difficulty}` : ''}

Return as JSON:
{
  "explanations": [
    {
      "topic": "concept or item name",
      "explanation": "clear, detailed explanation",
      "keyPoints": ["point1", "point2"],
      "examples": ["example1", "example2"],
      "commonMistakes": ["mistake1"],
      "relatedConcepts": ["concept1", "concept2"]
    }
  ],
  "summary": "overall summary of the material"
}`;
  }

  parseContentResponse(response, domainType, expectedTypes) {
    try {
      if (typeof response === 'object' && response.items) {
        return response;
      }

      if (typeof response === 'string') {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return { items: [] };
    } catch (error) {
      console.error('[ContentGenerationSkill] Failed to parse response:', error);
      return { items: [] };
    }
  }

  generateFallbackContent(params, selectedTypes, items) {
    // Generate basic content without AI
    const { domainType, count = 5 } = params;
    const fallbackItems = [];

    const itemsToUse = items.slice(0, count);

    for (let i = 0; i < Math.min(count, itemsToUse.length || count); i++) {
      const item = itemsToUse[i];
      const type = selectedTypes[i % selectedTypes.length];

      fallbackItems.push({
        type,
        content: this.generateFallbackItem(domainType, type, item),
        difficulty: 'medium',
        targetItem: typeof item === 'object' ? item.id : item,
        generated: 'fallback',
      });
    }

    return {
      items: fallbackItems,
      sessionIntro: `Practice session for ${domainType}`,
      learningTips: ['Take your time with each item', 'Review any items you found difficult'],
    };
  }

  generateFallbackItem(domainType, type, item) {
    const itemValue = typeof item === 'object' ? (item.value || item.word || item.concept || JSON.stringify(item)) : item;

    const fallbacks = {
      flashcard: { front: itemValue, back: `Definition of ${itemValue}`, example: `Example using ${itemValue}` },
      cloze: { sentence: `The ${itemValue} is important.`, answer: itemValue, options: [itemValue, 'other1', 'other2', 'other3'] },
      problem: { question: `Solve for ${itemValue}`, answer: 'unknown', steps: [] },
      concept_quiz: { question: `What is ${itemValue}?`, options: ['A', 'B', 'C', 'D'], answer: 'A' },
      grammar_exercise: { rule: 'grammar', sentence: `Practice with ${itemValue}`, answer: itemValue },
      code_exercise: { language: 'javascript', prompt: `Implement ${itemValue}`, starterCode: '// Your code here' },
    };

    return fallbacks[type] || { item: itemValue };
  }

  generateScoringRubric(domainType, content) {
    const baseRubric = {
      pointsPerItem: 10,
      partialCreditAllowed: domainType !== 'math',
      bonusForSpeed: true,
      penaltyForHints: 2,
    };

    if (domainType === 'vocabulary') {
      return { ...baseRubric, spellingMatterst: false, partialCreditForSynonyms: true };
    } else if (domainType === 'math') {
      return { ...baseRubric, partialCreditForProcess: true, showWork: true };
    } else if (domainType === 'skill') {
      return { ...baseRubric, codeExecutionRequired: true, testCasesPassing: true };
    }

    return baseRubric;
  }

  calculateTimeLimit(domainType, itemCount) {
    const timePerItem = {
      vocabulary: 30, // seconds
      math: 120,
      language: 60,
      knowledge: 45,
      skill: 180,
    };

    const seconds = (timePerItem[domainType] || 60) * itemCount;
    return Math.ceil(seconds / 60); // Return in minutes
  }

  suggestItemCount(sessionType, planContext) {
    const baseCounts = {
      review: 15,
      learn_new: 10,
      mixed: 12,
      quiz: 10,
      practice: 8,
      reading: 3,
      project: 1,
      assessment: 15,
    };

    return baseCounts[sessionType] || 10;
  }

  suggestSessionDuration(sessionType, planContext) {
    const baseDurations = {
      review: 15,
      learn_new: 25,
      mixed: 20,
      quiz: 15,
      practice: 20,
      reading: 30,
      project: 45,
      assessment: 30,
    };

    return baseDurations[sessionType] || 20;
  }

  getPhaseAdjustments(phasePosition, domainType) {
    const adjustments = {
      early: {
        emphasize: ['fundamentals', 'scaffolding', 'examples'],
        reduce: ['complexity', 'assessment'],
        tips: ['Focus on building strong foundations', 'Dont rush through new concepts'],
      },
      middle: {
        emphasize: ['practice', 'connections', 'application'],
        reduce: ['basic_review'],
        tips: ['Connect new concepts to what you already know', 'Practice varied problems'],
      },
      late: {
        emphasize: ['mastery', 'assessment', 'advanced_application'],
        reduce: ['scaffolding'],
        tips: ['Challenge yourself with harder problems', 'Review any weak areas before assessment'],
      },
    };

    return adjustments[phasePosition] || adjustments.middle;
  }
}

module.exports = ContentGenerationSkill;
