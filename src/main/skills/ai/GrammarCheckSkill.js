/**
 * GrammarCheckSkill - Check and correct grammar errors
 *
 * Identifies grammar mistakes and provides corrections with explanations.
 * Supports multiple explanation languages.
 *
 * Extended features:
 * - compareWith: Compare student writing against original text
 * - generateExercises: Generate corrective exercises for identified errors
 */

const BaseSkill = require('../BaseSkill');

class GrammarCheckSkill extends BaseSkill {
  static get name() {
    return 'grammar_check';
  }

  static get description() {
    return 'Check text for grammar errors, identify mistakes, and provide corrections with explanations. Can compare student writing against original text and generate corrective exercises.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text to check for grammar errors',
      },
      explanationLanguage: {
        type: 'string',
        enum: ['english', 'chinese', 'japanese'],
        default: 'english',
        description: 'Language for error explanations',
      },
      detailed: {
        type: 'boolean',
        default: true,
        description: 'Whether to include detailed explanations',
      },
      compareWith: {
        type: 'string',
        description:
          'Original text to compare against. When provided, analyzes differences and identifies errors in the student text relative to the original.',
      },
      generateExercises: {
        type: 'boolean',
        default: false,
        description:
          'Generate corrective exercises for identified errors. Only applies when compareWith is provided.',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({
    text,
    explanationLanguage = 'english',
    detailed = true,
    compareWith,
    generateExercises = false,
  }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    // Use comparison mode if compareWith is provided
    if (compareWith) {
      return this.executeComparison({
        studentText: text,
        originalText: compareWith,
        explanationLanguage,
        generateExercises,
      });
    }

    // Standard grammar check mode
    const prompt = this.buildPrompt(text, explanationLanguage, detailed);
    const response = await aiProvider.generateContent(prompt);

    // Parse response
    const result = this.parseResponse(response);

    this.logExecution(
      { textLength: text.length, explanationLanguage, mode: 'standard' },
      { errorCount: result.errors?.length || 0 },
    );

    return {
      ...result,
      originalText: text,
    };
  }

  /**
   * Execute comparison mode - compare student writing against original
   */
  async executeComparison({
    studentText,
    originalText,
    explanationLanguage,
    generateExercises,
  }) {
    const aiProvider = this.getAIProvider();

    const prompt = this.buildComparisonPrompt(
      originalText,
      studentText,
      explanationLanguage,
      generateExercises,
    );

    const response = await aiProvider.generateContent(prompt);
    const result = this.parseComparisonResponse(response);

    this.logExecution(
      {
        studentTextLength: studentText.length,
        originalTextLength: originalText.length,
        explanationLanguage,
        mode: 'comparison',
        generateExercises,
      },
      {
        issueCount: result.issues?.length || 0,
        exerciseCount: result.exercises?.length || 0,
      },
    );

    return {
      ...result,
      originalText: originalText,
      studentText: studentText,
      mode: 'comparison',
    };
  }

  buildPrompt(text, explanationLanguage, detailed) {
    const languageInstructions = {
      english: 'Explain errors in English.',
      chinese: '用中文解释错误。',
      japanese: '日本語でエラーを説明してください。',
    };

    const parts = [
      'You are a grammar expert. Analyze the following text for grammar errors.',
      '',
      'For each error found:',
      '1. Identify the problematic word or phrase',
      '2. Explain what is wrong',
      '3. Provide the correct version',
    ];

    if (detailed) {
      parts.push('4. Explain the grammar rule that applies');
    }

    parts.push('');
    parts.push(languageInstructions[explanationLanguage]);
    parts.push('');
    parts.push('Return your response in JSON format:');
    parts.push('{');
    parts.push('  "hasErrors": true/false,');
    parts.push('  "correctedText": "Full text with all corrections applied",');
    parts.push('  "errors": [');
    parts.push('    {');
    parts.push('      "original": "problematic text",');
    parts.push('      "correction": "corrected text",');
    parts.push('      "explanation": "why it\'s wrong",');
    if (detailed) {
      parts.push('      "rule": "grammar rule that applies"');
    }
    parts.push('    }');
    parts.push('  ]');
    parts.push('}');
    parts.push('');
    parts.push('Text to check:');
    parts.push('"""');
    parts.push(text);
    parts.push('"""');

    return parts.join('\n');
  }

  /**
   * Build prompt for comparison mode
   * Uses the langstudyComparisonExercise pattern from AIPrompts.js
   */
  buildComparisonPrompt(
    originalText,
    studentText,
    explanationLanguage,
    generateExercises,
  ) {
    const languageNote =
      explanationLanguage !== 'english'
        ? `\nProvide all explanations in ${explanationLanguage}.`
        : '';

    const exerciseInstructions = generateExercises
      ? `
Also design exercises with examples to help correct these mistakes.
Include the "exercises" array in your response.`
      : '';

    return `
I am learning English by rewriting sentences. Please analyze my grammatical errors or any unnatural language usage.

# This is the original sentence:

${originalText}

# This is what I wrote:

${studentText}

# Instructions:

You are a language expert. Please analyze the grammatical errors or any unnatural language usage in my writing compared to the original.${languageNote}${exerciseInstructions}

Response with JSON format:

{
  "hasErrors": true/false,
  "issues": [
    {
      "type": "Error type (e.g., Capitalization, Article Usage, Verb Tense)",
      "explain": "Explanation of what is wrong"
    }
  ],
  "exercises": [
    {
      "type": "Exercise type matching the issue",
      "original": "Original sentence or phrase",
      "rewriteExercise": "Instructions for the exercise",
      "example": "Corrected example"
    }
  ]
}

${
  !generateExercises
    ? 'Note: You may omit the "exercises" array since exercises were not requested.'
    : ''
}
`;
  }

  parseResponse(response) {
    // Get text content
    let textContent = response;
    if (Array.isArray(response)) {
      textContent = response
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    } else if (response?.text) {
      textContent = response.text;
    }

    // Try to parse as JSON
    try {
      // Find JSON in response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          hasErrors: parsed.hasErrors || false,
          correctedText: parsed.correctedText || '',
          errors: parsed.errors || [],
        };
      }
    } catch (e) {
      console.warn('Could not parse grammar check response as JSON:', e);
    }

    // Fallback: return raw response
    return {
      hasErrors: false,
      correctedText: '',
      errors: [],
      rawResponse: textContent,
    };
  }

  /**
   * Parse response for comparison mode
   */
  parseComparisonResponse(response) {
    // Get text content
    let textContent = response;
    if (Array.isArray(response)) {
      textContent = response
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    } else if (response?.text) {
      textContent = response.text;
    }

    // Try to parse as JSON
    try {
      // Find JSON in response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          hasErrors: parsed.hasErrors ?? (parsed.issues?.length > 0 || false),
          issues: parsed.issues || [],
          exercises: parsed.exercises || [],
          issueCount: parsed.issues?.length || 0,
          exerciseCount: parsed.exercises?.length || 0,
        };
      }
    } catch (e) {
      console.warn(
        'Could not parse grammar comparison response as JSON:',
        e,
      );
    }

    // Fallback: return raw response
    return {
      hasErrors: false,
      issues: [],
      exercises: [],
      rawResponse: textContent,
    };
  }
}

module.exports = GrammarCheckSkill;
