/**
 * SummarizeSkill - Generate concise summaries of text
 *
 * Supports different lengths and formats.
 * Respects user's reader level settings.
 */

const BaseSkill = require('../BaseSkill');

class SummarizeSkill extends BaseSkill {
  static get name() {
    return 'summarize';
  }

  static get description() {
    return 'Generate a concise summary of the provided text. Can produce brief, medium, or detailed summaries in paragraph, bullet, or numbered format.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text to summarize',
      },
      length: {
        type: 'string',
        enum: ['brief', 'medium', 'detailed'],
        default: 'medium',
        description: 'Length of summary: brief (1-2 sentences), medium (3-4 sentences), detailed (5-7 sentences)',
      },
      format: {
        type: 'string',
        enum: ['paragraph', 'bullets', 'numbered'],
        default: 'paragraph',
        description: 'Output format',
      },
      language: {
        type: 'string',
        default: 'english',
        description: 'Language for the summary output',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({ text, length = 'medium', format = 'paragraph', language = 'english' }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = this.buildPrompt(text, length, format, language);
    const response = await aiProvider.generateContent(prompt);

    // Parse response
    const summary = this.parseResponse(response);

    this.logExecution({ textLength: text.length, length, format }, { summaryLength: summary.length });

    return {
      summary,
      length,
      format,
      originalLength: text.length,
      summaryLength: summary.length,
    };
  }

  buildPrompt(text, length, format, language) {
    const lengthInstructions = {
      brief: '1-2 sentences',
      medium: '3-4 sentences',
      detailed: '5-7 sentences or a short paragraph',
    };

    const formatInstructions = {
      paragraph: 'Write as a cohesive paragraph.',
      bullets: 'Write as bullet points, each starting with •',
      numbered: 'Write as a numbered list.',
    };

    const readerLevelInstruction = this.getReaderLevelInstruction();

    const parts = [
      `Summarize the following text in ${lengthInstructions[length]}.`,
      formatInstructions[format],
    ];

    if (readerLevelInstruction) {
      parts.push(readerLevelInstruction);
    }

    if (language !== 'english') {
      parts.push(`Write the summary in ${language}.`);
    }

    parts.push('');
    parts.push('Text to summarize:');
    parts.push('"""');
    parts.push(text);
    parts.push('"""');
    parts.push('');
    parts.push('Summary:');

    return parts.join('\n');
  }

  parseResponse(response) {
    // Handle different response formats
    if (Array.isArray(response)) {
      // Claude format: [{ type: 'text', text: '...' }]
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

module.exports = SummarizeSkill;
