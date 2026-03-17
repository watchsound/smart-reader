/**
 * AnswerVerifySkill.js
 *
 * LLM-based skill for verifying student answers to STEM problems.
 * Uses AI to evaluate correctness, provide partial credit, and give feedback.
 *
 * This skill enables intelligent answer checking without requiring symbolic
 * math libraries - the LLM handles mathematical equivalence, units, etc.
 */

const BaseSkill = require('../BaseSkill');
const { createAnswerVerificationPrompt } = require('../../../commons/utils/AIPrompts');

class AnswerVerifySkill extends BaseSkill {
  static get name() {
    return 'verify_answer';
  }

  static get description() {
    return 'Verify a student answer to a STEM problem using LLM. Evaluates correctness, partial credit, and provides feedback.';
  }

  static get category() {
    return 'ai';
  }

  static get parameters() {
    return {
      problem: {
        type: 'string',
        description: 'The original problem or question',
      },
      studentAnswer: {
        type: 'string',
        description: "The student's submitted answer",
      },
      correctAnswer: {
        type: 'string',
        description: 'The expected correct answer (optional - LLM can evaluate without it)',
      },
      domain: {
        type: 'string',
        enum: ['math', 'physics', 'chemistry', 'programming', 'general'],
        default: 'general',
        description: 'Domain for specialized evaluation rules',
      },
      itemType: {
        type: 'string',
        enum: ['formula', 'problem', 'code', 'proof', 'derivation', 'general'],
        default: 'problem',
        description: 'Type of problem for tailored evaluation',
      },
      variables: {
        type: 'array',
        description: 'Array of variable definitions: [{symbol, meaning, value}]',
      },
      solution: {
        type: 'string',
        description: 'Step-by-step solution for reference (optional)',
      },
    };
  }

  static get requiredParams() {
    return ['problem', 'studentAnswer'];
  }

  /**
   * Check if AI provider is available
   */
  static isAvailable(context) {
    return !!context.aiProvider;
  }

  /**
   * Execute answer verification
   */
  async execute({
    problem,
    studentAnswer,
    correctAnswer = null,
    domain = 'general',
    itemType = 'problem',
    variables = null,
    solution = null,
  }) {
    const aiProvider = this.getAIProvider();

    if (!aiProvider) {
      return {
        success: false,
        error: 'AI provider not available',
      };
    }

    // Build the verification prompt
    const prompt = createAnswerVerificationPrompt({
      problem,
      studentAnswer,
      correctAnswer,
      domain,
      itemType,
      variables,
      solution,
    });

    try {
      // Call AI provider with JSON response format
      const response = await aiProvider.generateContentWithJson(prompt);

      // Parse the response
      let result;
      try {
        result = typeof response === 'string' ? JSON.parse(response) : response;
      } catch (parseError) {
        console.error('Failed to parse verification response:', parseError);
        // Try to extract JSON from response
        const jsonMatch = response?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse AI response as JSON');
        }
      }

      // Normalize the result
      const normalizedResult = this.normalizeResult(result);

      // Log execution
      this.logExecution(
        { problem: problem.substring(0, 50), studentAnswer, domain },
        { correct: normalizedResult.correct, partialCredit: normalizedResult.partialCredit },
      );

      return {
        success: true,
        ...normalizedResult,
      };
    } catch (error) {
      console.error('Answer verification failed:', error);
      return {
        success: false,
        error: error.message,
        // Provide fallback for UI
        correct: false,
        confidence: 0,
        partialCredit: 0,
        explanation: 'Unable to verify answer at this time.',
        feedback: 'Please try again or check your answer manually.',
      };
    }
  }

  /**
   * Normalize the verification result to ensure all expected fields are present
   */
  normalizeResult(result) {
    return {
      correct: Boolean(result.correct),
      confidence: Math.min(1, Math.max(0, parseFloat(result.confidence) || 0)),
      partialCredit: Math.min(100, Math.max(0, parseInt(result.partialCredit, 10) || 0)),
      equivalentToExpected: Boolean(result.equivalentToExpected),
      explanation: result.explanation || '',
      feedback: result.feedback || '',
      errors: Array.isArray(result.errors) ? result.errors : [],
      suggestedHint: result.suggestedHint || null,
      workingShown: Boolean(result.workingShown),
      conceptsApplied: Array.isArray(result.conceptsApplied) ? result.conceptsApplied : [],
      conceptsMissing: Array.isArray(result.conceptsMissing) ? result.conceptsMissing : [],
    };
  }

  /**
   * Map verification result to Leitner rating
   *
   * @param {Object} result - Verification result
   * @returns {number} Rating 1-4 (AGAIN, HARD, GOOD, EASY)
   */
  static mapToRating(result) {
    if (!result) return 1;

    // Easy (4): Correct with high confidence
    if (result.correct && result.confidence >= 0.8) {
      return 4;
    }

    // Good (3): Correct with moderate confidence or high partial credit
    if (result.correct || result.partialCredit >= 80) {
      return 3;
    }

    // Hard (2): Partial credit (50-79%)
    if (result.partialCredit >= 50) {
      return 2;
    }

    // Again (1): Incorrect or low partial credit
    return 1;
  }
}

module.exports = AnswerVerifySkill;
