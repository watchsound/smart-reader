/**
 * SearchVocabularySkill - Search vocabulary cards
 *
 * Searches user's vocabulary cards by word or query.
 * Returns vocabulary entries with Leitner box information.
 */

const BaseSkill = require('../BaseSkill');

class SearchVocabularySkill extends BaseSkill {
  static get name() {
    return 'search_vocabulary';
  }

  static get description() {
    return 'Search vocabulary cards by word or query. Returns matching vocabulary entries with Leitner spaced repetition information.';
  }

  static get parameters() {
    return {
      query: {
        type: 'string',
        description: 'Search query (word or partial match)',
      },
      page: {
        type: 'number',
        default: 1,
        description: 'Page number for pagination',
      },
      limit: {
        type: 'number',
        default: 20,
        description: 'Maximum results per page',
      },
    };
  }

  static get requiredParams() {
    return ['query'];
  }

  static get category() {
    return 'data';
  }

  /**
   * Check if vocabulary search is available
   */
  static isAvailable(context) {
    const vocabularyManager =
      context.vocabularyManager || context.services?.vocabularyManager;
    return !!vocabularyManager;
  }

  async execute({ query, page = 1, limit = 20 }) {
    const vocabularyManager =
      this.context.vocabularyManager || this.context.services?.vocabularyManager;
    const token = this.context.token;

    if (!vocabularyManager) {
      throw new Error('Vocabulary manager not available');
    }

    if (!token) {
      throw new Error('Authentication token required');
    }

    let result;

    try {
      if (vocabularyManager.getVocabulariesByQuery) {
        result = vocabularyManager.getVocabulariesByQuery(
          query,
          page,
          limit,
          token,
        );
      } else if (vocabularyManager.search) {
        result = await vocabularyManager.search(query, page, limit, token);
      } else {
        throw new Error('Vocabulary manager does not support search');
      }
    } catch (e) {
      console.error('Error searching vocabulary:', e);
      throw new Error(`Failed to search vocabulary: ${e.message}`);
    }

    // Normalize results
    const normalizedResults = this.normalizeResults(result);

    this.logExecution(
      { query, page, limit },
      { resultCount: normalizedResults.results.length, total: normalizedResults.total },
    );

    return {
      query,
      results: normalizedResults.results,
      total: normalizedResults.total,
      page: normalizedResults.page,
      totalPages: normalizedResults.totalPages,
    };
  }

  normalizeResults(result) {
    // Handle paginated result format
    if (result && typeof result === 'object' && 'data' in result) {
      return {
        results: (result.data || []).map((v) => this.normalizeVocabulary(v)),
        total: result.total || 0,
        page: result.currentPage || 1,
        totalPages: result.totalPages || 1,
      };
    }

    // Handle array result
    if (Array.isArray(result)) {
      return {
        results: result.map((v) => this.normalizeVocabulary(v)),
        total: result.length,
        page: 1,
        totalPages: 1,
      };
    }

    return {
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
    };
  }

  normalizeVocabulary(v) {
    return {
      id: v.id,
      word: v.word,
      definition: v.detail || v.definition || '',
      example: v.example || '',
      relatedWords: v.relatedWords || '',
      leitnerBox: v.leitnerItem?.box || 1,
      nextReview: v.leitnerItem?.nextReview || null,
      createdAt: v.createdAt || null,
    };
  }
}

module.exports = SearchVocabularySkill;
