/**
 * SmartSummarySkill - Vocabulary-constrained summaries
 *
 * Generates summaries that ONLY use words from:
 * 1. The source text itself
 * 2. The user's learning vocabulary list
 *
 * This enables visual "flying words" animation in Study Enhancer
 * where words fly from source to summary.
 *
 * Different from SummarizeSkill which produces any valid summary.
 */

const BaseSkill = require('../BaseSkill');

class SmartSummarySkill extends BaseSkill {
  static get name() {
    return 'smart_summary';
  }

  static get description() {
    return 'Generate a vocabulary-constrained summary using only words from the source text and learning vocabulary. Enables visual word association learning.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text to summarize',
      },
      vocabularyWords: {
        type: 'array',
        default: [],
        description:
          'Learning vocabulary words to prioritize in the summary',
      },
      maxWords: {
        type: 'number',
        default: 20,
        description: 'Maximum words in the summary',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({ text, vocabularyWords = [], maxWords = 20 }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = this.buildPrompt(text, vocabularyWords, maxWords);
    console.log('[SmartSummarySkill] Calling AI provider...');
    const response = await aiProvider.generateContent(prompt);
    console.log('[SmartSummarySkill] Raw response:', JSON.stringify(response).substring(0, 500));

    const result = this.parseResponse(response);
    console.log('[SmartSummarySkill] Parsed result:', { summary: result.summary?.substring(0, 100), wordsCount: result.words?.length });

    // Validate we got a summary
    if (!result.summary || result.summary.trim().length === 0) {
      throw new Error('AI provider returned empty summary. Raw response: ' + JSON.stringify(response).substring(0, 200));
    }

    const sourceWordCount = text.split(/\s+/).length;
    const summaryWordCount = result.summary.split(/\s+/).length;

    this.logExecution(
      {
        textLength: text.length,
        vocabularyCount: vocabularyWords.length,
        maxWords,
      },
      {
        summaryWordCount,
        vocabularyUsedCount: result.vocabularyUsed.length,
      },
    );

    return {
      summary: result.summary,
      words: result.words,
      vocabularyUsed: result.vocabularyUsed,
      sourceWordCount,
      summaryWordCount,
    };
  }

  buildPrompt(text, vocabularyWords, maxWords) {
    const vocabList =
      vocabularyWords.length > 0
        ? `\n\nLearning Vocabulary (MUST include at least 2-3 of these words if they fit naturally):\n${vocabularyWords.join(', ')}`
        : '';

    return `You are a study assistant helping students learn through visual word association.

TASK: Create a concise summary (1-2 sentences, max ${maxWords} words) of the following text.

CRITICAL RULES:
1. Use ONLY words that appear in the original text OR from the Learning Vocabulary list
2. Do NOT add any new words, synonyms, or paraphrases
3. The summary must be grammatically correct
4. Prioritize including Learning Vocabulary words when they fit naturally
${vocabList}

TEXT TO SUMMARIZE:
"""
${text}
"""

Respond in JSON format:
{
  "summary": "Your summary here using only words from the source",
  "words": ["array", "of", "each", "word", "in", "summary"],
  "vocabularyUsed": ["words", "from", "learning", "vocabulary", "that", "were", "used"]
}

Remember: Every word in your summary MUST exist in the original text or the Learning Vocabulary list. No exceptions.`;
  }

  parseResponse(response) {
    let textContent = this.extractTextContent(response);

    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || '',
          words: parsed.words || this.extractWords(parsed.summary || ''),
          vocabularyUsed: parsed.vocabularyUsed || [],
        };
      }
    } catch (e) {
      console.warn('Could not parse smart summary response as JSON:', e);
    }

    // Fallback
    return {
      summary: textContent.trim(),
      words: this.extractWords(textContent),
      vocabularyUsed: [],
    };
  }

  /**
   * Extract words from text, removing punctuation
   */
  extractWords(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }

  extractTextContent(response) {
    // Handle Claude's content array format
    if (Array.isArray(response)) {
      return response
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }
    // Handle response with content array (Claude API format)
    if (response?.content && Array.isArray(response.content)) {
      return response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }
    // Handle simple text response
    if (response?.text) {
      return response.text;
    }
    // Handle string response
    if (typeof response === 'string') {
      return response;
    }
    // Handle candidates array (Gemini format)
    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }
    // Handle choices array (OpenAI format)
    if (response?.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }
    console.warn('[SmartSummarySkill] Unknown response format:', typeof response, Object.keys(response || {}));
    return String(response);
  }
}

module.exports = SmartSummarySkill;
