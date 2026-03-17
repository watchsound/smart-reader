/**
 * QuizGenerateSkill - Generate multiple-choice quiz questions from text
 *
 * Creates quiz questions based on content to test comprehension.
 * Supports configurable question count and difficulty levels.
 * Respects user's reader level for age-appropriate questions.
 */

const BaseSkill = require('../BaseSkill');

class QuizGenerateSkill extends BaseSkill {
  static get name() {
    return 'quiz_generate';
  }

  static get description() {
    return 'Generate multiple-choice quiz questions from text content. Creates questions to test comprehension with configurable difficulty and count.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text content to generate quiz questions from',
      },
      questionCount: {
        type: 'number',
        default: 4,
        description: 'Number of questions to generate (1-10)',
      },
      difficulty: {
        type: 'string',
        enum: ['easy', 'medium', 'hard', 'mixed'],
        default: 'mixed',
        description: 'Difficulty level of questions',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({ text, questionCount = 4, difficulty = 'mixed' }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    // Validate questionCount
    const count = Math.min(Math.max(1, questionCount), 10);

    const prompt = this.buildPrompt(text, count, difficulty);
    const response = await aiProvider.generateContent(prompt);

    // Parse response
    const result = this.parseResponse(response);

    this.logExecution(
      { textLength: text.length, questionCount: count, difficulty },
      { generatedCount: result.quiz?.length || 0 },
    );

    return {
      quiz: result.quiz || [],
      sourceTextLength: text.length,
      questionCount: result.quiz?.length || 0,
      requestedCount: count,
      difficulty,
    };
  }

  buildPrompt(text, questionCount, difficulty) {
    const readerLevelInstruction = this.getReaderLevelInstruction();

    const difficultyInstructions = {
      easy: 'Focus on basic facts and simple recall questions.',
      medium:
        'Include a mix of recall and inference questions requiring some analysis.',
      hard: 'Focus on inference, analysis, and critical thinking questions.',
      mixed: 'Vary the difficulty from easy to hard across questions.',
    };

    const parts = [
      `Please generate ${questionCount} multiple-choice quiz questions based on the following paragraph.`,
      '',
      'Requirements:',
      '- Each question should have 4 answer options (labeled A, B, C, and D)',
      '- Only one option per question should be correct',
      '- Questions should cover key details, facts, or concepts from the paragraph',
      `- ${difficultyInstructions[difficulty]}`,
    ];

    if (readerLevelInstruction) {
      parts.push(`- ${readerLevelInstruction}`);
    }

    parts.push('');
    parts.push('Return the questions in JSON format:');
    parts.push('{');
    parts.push('  "quiz": [');
    parts.push('    {');
    parts.push('      "question": "The question text",');
    parts.push('      "options": {');
    parts.push('        "optionA": "First option",');
    parts.push('        "optionB": "Second option",');
    parts.push('        "optionC": "Third option",');
    parts.push('        "optionD": "Fourth option"');
    parts.push('      },');
    parts.push('      "answer": "A"');
    parts.push('    }');
    parts.push('  ]');
    parts.push('}');
    parts.push('');
    parts.push('Here is the paragraph:');
    parts.push('');
    parts.push('###');
    parts.push(text);
    parts.push('###');

    return parts.join('\n');
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

        // Handle both { quiz: [...] } and direct array format
        let quiz = parsed.quiz || parsed;
        if (!Array.isArray(quiz)) {
          quiz = [];
        }

        // Normalize and validate each question
        const normalizedQuiz = quiz
          .map((q) => this.normalizeQuestion(q))
          .filter((q) => q !== null);

        return { quiz: normalizedQuiz };
      }
    } catch (e) {
      console.warn('Could not parse quiz response as JSON:', e);
    }

    // Fallback: return empty quiz
    return {
      quiz: [],
      rawResponse: textContent,
    };
  }

  /**
   * Normalize a question to standard format
   */
  normalizeQuestion(q) {
    if (!q || !q.question) {
      return null;
    }

    // Ensure options exist
    const options = q.options || {};

    // Handle different option formats
    const normalizedOptions = {
      optionA: options.optionA || options.A || options.a || '',
      optionB: options.optionB || options.B || options.b || '',
      optionC: options.optionC || options.C || options.c || '',
      optionD: options.optionD || options.D || options.d || '',
    };

    // Normalize answer to uppercase letter
    let answer = (q.answer || 'A').toString().toUpperCase();
    if (answer.startsWith('OPTION')) {
      answer = answer.replace('OPTION', '');
    }
    if (!['A', 'B', 'C', 'D'].includes(answer)) {
      answer = 'A';
    }

    return {
      question: q.question,
      options: normalizedOptions,
      answer,
    };
  }
}

module.exports = QuizGenerateSkill;
