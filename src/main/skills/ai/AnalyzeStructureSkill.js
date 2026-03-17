/**
 * AnalyzeStructureSkill - 5W Analysis (Who, What, When, Where, Why)
 *
 * Extracts the core structural elements from each sentence in a paragraph:
 * - Who: The subject/actor
 * - What: The action/event
 * - When: Time reference
 * - Where: Location
 * - Why: Reason/purpose
 */

const BaseSkill = require('../BaseSkill');

class AnalyzeStructureSkill extends BaseSkill {
  static get name() {
    return 'analyze_structure';
  }

  static get description() {
    return 'Extract Who, What, When, Where, and Why from each sentence in a paragraph. Helps understand the core structural elements of text.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The paragraph text to analyze',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({ text }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = this.buildPrompt(text);
    const response = await aiProvider.generateContent(prompt);
    const result = this.parseResponse(response);

    this.logExecution(
      { textLength: text.length },
      { sentenceCount: result.data?.length || 0 },
    );

    return {
      data: result.data,
      sentenceCount: result.data?.length || 0,
      originalText: text,
    };
  }

  buildPrompt(text) {
    return `Please provide only concise keywords for 'Who, What, When, Where, and Why' for every single sentence in the following paragraph.

If an element is not present in a sentence, use "-" or leave it empty.

Return data in JSON format:
{
  "data": [
    {
      "sentenceIndex": 0,
      "sentence": "The original sentence",
      "who": "subject/actor keywords",
      "what": "action/event keywords",
      "when": "time reference keywords",
      "where": "location keywords",
      "why": "reason/purpose keywords"
    }
  ]
}

Paragraph to analyze:
"""
${text}
"""`;
  }

  parseResponse(response) {
    let textContent = this.extractTextContent(response);

    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Normalize the data array
        const data = (parsed.data || []).map((item, index) => ({
          sentenceIndex: item.sentenceIndex ?? index,
          sentence: item.sentence || '',
          who: item.who || '-',
          what: item.what || '-',
          when: item.when || '-',
          where: item.where || '-',
          why: item.why || '-',
        }));

        return { data };
      }
    } catch (e) {
      console.warn('Could not parse 5W analysis response as JSON:', e);
    }

    return { data: [] };
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

module.exports = AnalyzeStructureSkill;
