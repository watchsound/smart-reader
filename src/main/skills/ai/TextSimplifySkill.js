/**
 * TextSimplifySkill - Simplify text for different reading levels
 *
 * Rewrites text to be more accessible for different audiences.
 * Supports reading level targeting and vocabulary limits.
 * Can preserve HTML structure while simplifying content.
 */

const BaseSkill = require('../BaseSkill');

class TextSimplifySkill extends BaseSkill {
  static get name() {
    return 'text_simplify';
  }

  static get description() {
    return 'Simplify text for different reading levels. Rewrites content to be more accessible while preserving meaning.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text to simplify',
      },
      targetLevel: {
        type: 'string',
        enum: ['elementary', 'middle', 'high', 'college'],
        default: 'middle',
        description: 'Target reading level',
      },
      vocabularyLimit: {
        type: 'number',
        description:
          'Optional: Limit to top N most common words (e.g., 1000, 2000)',
      },
      preserveHtml: {
        type: 'boolean',
        default: false,
        description: 'Preserve HTML tags while simplifying content',
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
    targetLevel = 'middle',
    vocabularyLimit,
    preserveHtml = false,
  }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = vocabularyLimit
      ? this.buildVocabularyLimitPrompt(text, vocabularyLimit, preserveHtml)
      : this.buildLevelPrompt(text, targetLevel, preserveHtml);

    const response = await aiProvider.generateContent(prompt);
    const result = this.parseResponse(response);

    // Calculate simplification ratio (rough estimate based on word count)
    const originalWords = text.split(/\s+/).length;
    const simplifiedWords = result.simplifiedText.split(/\s+/).length;
    const simplificationRatio =
      originalWords > 0 ? simplifiedWords / originalWords : 1;

    this.logExecution(
      { textLength: text.length, targetLevel, vocabularyLimit, preserveHtml },
      { simplifiedLength: result.simplifiedText.length, simplificationRatio },
    );

    return {
      originalText: text,
      simplifiedText: result.simplifiedText,
      targetLevel,
      vocabularyLimit,
      simplificationRatio: Math.round(simplificationRatio * 100) / 100,
    };
  }

  buildLevelPrompt(text, targetLevel, preserveHtml) {
    const levelInstructions = {
      elementary:
        'Use simple words that elementary school students (ages 6-10) can understand. Use short sentences. Avoid complex concepts.',
      middle:
        'Use vocabulary suitable for middle school students (ages 11-14). Keep sentences clear and straightforward.',
      high: 'Use vocabulary suitable for high school students (ages 15-18). You can use more sophisticated concepts but keep explanations clear.',
      college:
        'Maintain academic vocabulary but improve clarity and readability. Simplify overly complex sentences.',
    };

    const htmlNote = preserveHtml
      ? '\n\nIMPORTANT: Preserve all HTML tags and attributes. Only modify the text content inside tags.'
      : '';

    return `Please simplify the following text for ${targetLevel} school level readers.

${levelInstructions[targetLevel]}${htmlNote}

Text to simplify:
"""
${text}
"""

Return your response in JSON format:
{
  "simplifiedText": "The simplified version of the text"
}`;
  }

  buildVocabularyLimitPrompt(text, vocabularyLimit, preserveHtml) {
    const htmlNote = preserveHtml
      ? '\n\nIMPORTANT: Preserve all HTML tags and attributes. Only modify the text content inside tags.'
      : '';

    return `Rewrite the following text using only the top ${vocabularyLimit} most frequently used English words.

Adjust sentence structures and expressions accordingly while preserving the original meaning and context.${htmlNote}

Text to simplify:
"""
${text}
"""

Return your response in JSON format:
{
  "simplifiedText": "The rewritten version using simpler vocabulary"
}`;
  }

  parseResponse(response) {
    let textContent = this.extractTextContent(response);

    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          simplifiedText:
            parsed.simplifiedText || parsed['modified-html'] || '',
        };
      }
    } catch (e) {
      console.warn('Could not parse simplify response as JSON:', e);
    }

    // Fallback: use raw response as simplified text
    return {
      simplifiedText: textContent.trim(),
    };
  }

  extractTextContent(response) {
    if (Array.isArray(response)) {
      return response
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }
    if (response?.text) {
      return response.text;
    }
    return String(response);
  }
}

module.exports = TextSimplifySkill;
