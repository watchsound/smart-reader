/**
 * CreateVocabularySkill - Save vocabulary cards to database
 *
 * Persistence-only skill - does NOT generate definitions.
 * Use VocabularySkill (AI) first to get AI-generated definition,
 * then use this skill to persist the vocabulary card.
 *
 * Integrates with Leitner spaced repetition system.
 */

const BaseSkill = require('../BaseSkill');

class CreateVocabularySkill extends BaseSkill {
  static get name() {
    return 'create_vocabulary';
  }

  static get description() {
    return 'Save a vocabulary card to the database with Leitner spaced repetition integration. This is a persistence-only skill - use the vocabulary skill first to generate definitions.';
  }

  static get parameters() {
    return {
      word: {
        type: 'string',
        description: 'The vocabulary word',
      },
      definition: {
        type: 'string',
        description:
          'Definition of the word (required - use VocabularySkill first if needed)',
      },
      example: {
        type: 'string',
        default: '',
        description: 'Example sentence using the word',
      },
      relatedWords: {
        type: 'string',
        default: '',
        description: 'Comma-separated related words (synonyms, etc.)',
      },
      setId: {
        type: 'number',
        default: 0,
        description: 'Vocabulary set ID to add this word to',
      },
    };
  }

  static get requiredParams() {
    return ['word', 'definition'];
  }

  static get category() {
    return 'data';
  }

  /**
   * Check if vocabulary creation is available
   */
  static isAvailable(context) {
    const vocabularyManager =
      context.vocabularyManager || context.services?.vocabularyManager;
    return !!vocabularyManager;
  }

  async execute({ word, definition, example = '', relatedWords = '', setId = 0 }) {
    const vocabularyManager =
      this.context.vocabularyManager || this.context.services?.vocabularyManager;
    const token = this.context.token;

    if (!vocabularyManager) {
      throw new Error('Vocabulary manager not available');
    }

    if (!token) {
      throw new Error('Authentication token required');
    }

    // Check if word already exists
    let existingVocab = null;
    if (vocabularyManager.getVocabularyByName) {
      existingVocab = vocabularyManager.getVocabularyByName(word, token);
    }

    if (existingVocab) {
      // Update existing vocabulary
      return this.updateExisting(existingVocab, {
        definition,
        example,
        relatedWords,
        setId,
      });
    }

    // Create new vocabulary entry
    const vocabularyData = {
      word: word.trim(),
      definition: definition.trim(),
      example: example.trim(),
      relatedWords: relatedWords.trim(),
      setId: setId || 0,
      leitnerItem: {
        box: 1,
        skips: 0,
        flips: 0,
        nextReview: this.calculateNextReview(1),
        fullyLearned: 0,
        score: 0,
      },
    };

    let result;
    try {
      if (vocabularyManager.createVocabulary) {
        result = vocabularyManager.createVocabulary(vocabularyData, token);
      } else if (vocabularyManager.create) {
        result = await vocabularyManager.create(vocabularyData, token);
      } else {
        throw new Error('Vocabulary manager does not support vocabulary creation');
      }
    } catch (e) {
      console.error('Error creating vocabulary:', e);
      throw new Error(`Failed to create vocabulary: ${e.message}`);
    }

    if (!result || !result.id) {
      throw new Error('Failed to create vocabulary - no ID returned');
    }

    this.logExecution(
      { word, hasExample: !!example, setId },
      { vocabularyId: result.id },
    );

    return {
      vocabularyId: result.id,
      word: result.word || word,
      definition: result.definition || definition,
      example: result.example || example,
      leitnerBox: 1,
      nextReviewDate: this.calculateNextReview(1),
      message: `Vocabulary "${word}" created successfully`,
      isNew: true,
    };
  }

  /**
   * Update existing vocabulary entry
   */
  updateExisting(existing, updates) {
    // For now, just return info about existing entry
    // In future, could update definition/example if different
    this.logExecution(
      { word: existing.word, action: 'found_existing' },
      { vocabularyId: existing.id },
    );

    return {
      vocabularyId: existing.id,
      word: existing.word,
      definition: existing.detail || existing.definition,
      example: existing.example,
      leitnerBox: existing.leitnerItem?.box || 1,
      nextReviewDate: existing.leitnerItem?.nextReview || null,
      message: `Vocabulary "${existing.word}" already exists`,
      isNew: false,
    };
  }

  /**
   * Calculate next review date based on Leitner box
   */
  calculateNextReview(box) {
    const intervals = {
      1: 1, // 1 day
      2: 3, // 3 days
      3: 7, // 1 week
      4: 14, // 2 weeks
      5: 30, // 1 month
    };

    const days = intervals[box] || 1;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }
}

module.exports = CreateVocabularySkill;
