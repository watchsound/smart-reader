/**
 * VocabularySkill - Define words and create vocabulary cards
 *
 * Provides word definitions, roots, example sentences.
 * Respects user's reader level settings.
 */

const BaseSkill = require('../BaseSkill');

class VocabularySkill extends BaseSkill {
  static get name() {
    return 'vocabulary';
  }

  static get description() {
    return 'Get definition, root/etymology, and example sentence for a vocabulary word. Can create flashcard-ready content.';
  }

  static get parameters() {
    return {
      word: {
        type: 'string',
        description: 'The vocabulary word to define',
      },
      context: {
        type: 'string',
        description: 'Optional sentence context where the word was found',
      },
      includeRoot: {
        type: 'boolean',
        default: true,
        description: 'Whether to include word root/etymology',
      },
      includeExamples: {
        type: 'boolean',
        default: true,
        description: 'Whether to include example sentences',
      },
      exampleCount: {
        type: 'number',
        default: 1,
        description: 'Number of example sentences to generate',
      },
    };
  }

  static get requiredParams() {
    return ['word'];
  }

  static get category() {
    return 'ai';
  }

  async execute({
    word,
    context,
    includeRoot = true,
    includeExamples = true,
    exampleCount = 1,
  }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = this.buildPrompt(word, context, includeRoot, includeExamples, exampleCount);
    const response = await aiProvider.generateContent(prompt);

    // Parse response
    const result = this.parseResponse(response, word);

    this.logExecution({ word, context: !!context }, result);

    return result;
  }

  buildPrompt(word, context, includeRoot, includeExamples, exampleCount) {
    const readerLevelInstruction = this.getReaderLevelInstruction();

    const parts = [
      `Provide vocabulary information for the word: "${word}"`,
      '',
    ];

    if (context) {
      parts.push(`Context where this word appeared: "${context}"`);
      parts.push('');
    }

    parts.push('Please provide:');
    parts.push('1. A clear, concise definition');

    if (includeRoot) {
      parts.push('2. Word root or etymology (if applicable)');
    }

    if (includeExamples) {
      parts.push(`3. ${exampleCount} example sentence(s) using the word`);
    }

    if (readerLevelInstruction) {
      parts.push('');
      parts.push(readerLevelInstruction);
    }

    parts.push('');
    parts.push('Return your response in JSON format:');
    parts.push('{');
    parts.push('  "word": "the word",');
    parts.push('  "partOfSpeech": "noun/verb/adjective/etc",');
    parts.push('  "pronunciation": "phonetic pronunciation",');
    parts.push('  "definition": "clear definition",');

    if (includeRoot) {
      parts.push('  "root": "word root or etymology",');
    }

    if (includeExamples) {
      parts.push('  "examples": ["example sentence 1", "example sentence 2"],');
    }

    parts.push('  "synonyms": ["synonym1", "synonym2"],');
    parts.push('  "antonyms": ["antonym1", "antonym2"]');
    parts.push('}');

    return parts.join('\n');
  }

  parseResponse(response, originalWord) {
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
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          word: parsed.word || originalWord,
          partOfSpeech: parsed.partOfSpeech || '',
          pronunciation: parsed.pronunciation || '',
          definition: parsed.definition || '',
          root: parsed.root || '',
          examples: parsed.examples || [],
          synonyms: parsed.synonyms || [],
          antonyms: parsed.antonyms || [],
        };
      }
    } catch (e) {
      console.warn('Could not parse vocabulary response as JSON:', e);
    }

    // Fallback: return raw response
    return {
      word: originalWord,
      partOfSpeech: '',
      pronunciation: '',
      definition: textContent,
      root: '',
      examples: [],
      synonyms: [],
      antonyms: [],
      rawResponse: textContent,
    };
  }
}

module.exports = VocabularySkill;
