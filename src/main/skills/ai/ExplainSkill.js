/**
 * ExplainSkill - Explain concepts in context
 *
 * Provides explanations of concepts, terms, or passages.
 * Adapts to user's reader level.
 */

const BaseSkill = require('../BaseSkill');

class ExplainSkill extends BaseSkill {
  static get name() {
    return 'explain';
  }

  static get description() {
    return 'Explain a concept, term, or passage in a clear and understandable way. Adapts explanation depth to reader level.';
  }

  static get parameters() {
    return {
      topic: {
        type: 'string',
        description: 'The concept, term, or passage to explain',
      },
      context: {
        type: 'string',
        description: 'Optional surrounding context to help provide relevant explanation',
      },
      depth: {
        type: 'string',
        enum: ['brief', 'moderate', 'detailed'],
        default: 'moderate',
        description: 'How detailed the explanation should be',
      },
      useAnalogy: {
        type: 'boolean',
        default: true,
        description: 'Whether to include an analogy or real-world example',
      },
    };
  }

  static get requiredParams() {
    return ['topic'];
  }

  static get category() {
    return 'ai';
  }

  async execute({ topic, context, depth = 'moderate', useAnalogy = true }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = this.buildPrompt(topic, context, depth, useAnalogy);
    const response = await aiProvider.generateContent(prompt);

    // Parse response
    const explanation = this.parseResponse(response);

    this.logExecution({ topic, depth, useAnalogy }, { explanationLength: explanation.length });

    return {
      topic,
      explanation,
      depth,
    };
  }

  buildPrompt(topic, context, depth, useAnalogy) {
    const depthInstructions = {
      brief: 'Give a brief, 1-2 sentence explanation.',
      moderate: 'Give a clear explanation in 3-5 sentences.',
      detailed: 'Give a comprehensive explanation covering key aspects.',
    };

    const readerLevelInstruction = this.getReaderLevelInstruction();

    const parts = [
      `Explain the following: "${topic}"`,
      '',
    ];

    if (context) {
      parts.push(`Context: "${context}"`);
      parts.push('');
    }

    parts.push(depthInstructions[depth]);

    if (useAnalogy) {
      parts.push('Include a helpful analogy or real-world example to make it relatable.');
    }

    if (readerLevelInstruction) {
      parts.push(readerLevelInstruction);
    }

    parts.push('');
    parts.push('Provide a clear, educational explanation:');

    return parts.join('\n');
  }

  parseResponse(response) {
    if (Array.isArray(response)) {
      return response
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
    }

    if (typeof response === 'string') {
      return response.trim();
    }

    if (response?.text) {
      return response.text.trim();
    }

    return String(response).trim();
  }
}

module.exports = ExplainSkill;
