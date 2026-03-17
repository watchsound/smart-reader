/**
 * GetLeitnerDueSkill - Get items due for Leitner review
 *
 * Retrieves vocabulary and/or notes that are due for
 * spaced repetition review based on the Leitner system.
 */

const BaseSkill = require('../BaseSkill');

class GetLeitnerDueSkill extends BaseSkill {
  static get name() {
    return 'get_leitner_due';
  }

  static get description() {
    return 'Get vocabulary and notes that are due for Leitner spaced repetition review. Helps users practice items at optimal intervals.';
  }

  static get parameters() {
    return {
      itemType: {
        type: 'string',
        enum: ['vocabulary', 'note', 'all'],
        default: 'all',
        description: 'Type of items to retrieve',
      },
      limit: {
        type: 'number',
        default: 20,
        description: 'Maximum items to retrieve',
      },
      page: {
        type: 'number',
        default: 1,
        description: 'Page number for pagination',
      },
    };
  }

  static get requiredParams() {
    return [];
  }

  static get category() {
    return 'data';
  }

  /**
   * Check if Leitner due retrieval is available
   */
  static isAvailable(context) {
    const vocabularyManager =
      context.vocabularyManager || context.services?.vocabularyManager;
    const noteManager = context.noteManager || context.services?.noteManager;
    return !!vocabularyManager || !!noteManager;
  }

  async execute({ itemType = 'all', limit = 20, page = 1 }) {
    const vocabularyManager =
      this.context.vocabularyManager || this.context.services?.vocabularyManager;
    const noteManager =
      this.context.noteManager || this.context.services?.noteManager;
    const token = this.context.token;

    if (!token) {
      throw new Error('Authentication token required');
    }

    const now = new Date();
    const items = [];
    let dueNow = 0;
    let dueToday = 0;
    let total = 0;

    // Get vocabulary due for review
    if ((itemType === 'all' || itemType === 'vocabulary') && vocabularyManager) {
      try {
        const vocabResult = await this.getVocabularyDue(
          vocabularyManager,
          now,
          page,
          limit,
          token,
        );
        items.push(...vocabResult.items);
        dueNow += vocabResult.dueNow;
        dueToday += vocabResult.dueToday;
        total += vocabResult.total;
      } catch (e) {
        console.error('Error getting vocabulary due:', e);
      }
    }

    // Get notes due for review
    if ((itemType === 'all' || itemType === 'note') && noteManager) {
      try {
        const noteResult = await this.getNotesDue(
          noteManager,
          now,
          page,
          limit,
          token,
        );
        items.push(...noteResult.items);
        dueNow += noteResult.dueNow;
        dueToday += noteResult.dueToday;
        total += noteResult.total;
      } catch (e) {
        console.error('Error getting notes due:', e);
      }
    }

    // Sort by overdue days (most overdue first)
    items.sort((a, b) => b.overdueDays - a.overdueDays);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    this.logExecution(
      { itemType, limit, page },
      { itemCount: paginatedItems.length, dueNow, dueToday, total },
    );

    return {
      items: paginatedItems,
      total,
      dueNow,
      dueToday,
      page,
      limit,
    };
  }

  async getVocabularyDue(vocabularyManager, now, page, limit, token) {
    const items = [];
    let dueNow = 0;
    let dueToday = 0;
    let total = 0;

    try {
      let result;
      if (vocabularyManager.getVocabulariesByDueReview) {
        result = vocabularyManager.getVocabulariesByDueReview(
          now,
          page,
          limit,
          token,
        );
      }

      if (result && result.data) {
        total = result.total || result.data.length;

        for (const vocab of result.data) {
          const item = this.formatVocabularyItem(vocab, now);
          items.push(item);

          if (item.overdueDays >= 0) {
            dueNow++;
          }
          if (item.overdueDays >= -1) {
            dueToday++;
          }
        }
      }
    } catch (e) {
      console.error('Error in getVocabularyDue:', e);
    }

    return { items, dueNow, dueToday, total };
  }

  async getNotesDue(noteManager, now, page, limit, token) {
    const items = [];
    let dueNow = 0;
    let dueToday = 0;
    let total = 0;

    try {
      let result;
      if (noteManager.getNotesByDueReview) {
        result = await noteManager.getNotesByDueReview(now, page, limit, token);
      } else if (noteManager.getDueForReview) {
        result = await noteManager.getDueForReview(now, page, limit, token);
      }

      if (result && result.data) {
        total = result.total || result.data.length;

        for (const note of result.data) {
          const item = this.formatNoteItem(note, now);
          items.push(item);

          if (item.overdueDays >= 0) {
            dueNow++;
          }
          if (item.overdueDays >= -1) {
            dueToday++;
          }
        }
      }
    } catch (e) {
      console.error('Error in getNotesDue:', e);
    }

    return { items, dueNow, dueToday, total };
  }

  formatVocabularyItem(vocab, now) {
    const nextReview = vocab.leitnerItem?.nextReview
      ? new Date(vocab.leitnerItem.nextReview)
      : now;
    const overdueDays = Math.floor(
      (now.getTime() - nextReview.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      id: vocab.id,
      type: 'vocabulary',
      content: {
        word: vocab.word,
        definition: vocab.definition || vocab.detail,
        example: vocab.example,
      },
      box: vocab.leitnerItem?.box || 1,
      nextReview: vocab.leitnerItem?.nextReview || null,
      overdueDays,
    };
  }

  formatNoteItem(note, now) {
    const nextReview = note.leitnerItem?.nextReview || note.nextReviewDate
      ? new Date(note.leitnerItem?.nextReview || note.nextReviewDate)
      : now;
    const overdueDays = Math.floor(
      (now.getTime() - nextReview.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      id: note.id,
      type: 'note',
      content: {
        title: note.title,
        content: note.content?.substring(0, 200) + (note.content?.length > 200 ? '...' : ''),
      },
      box: note.leitnerItem?.box || note.leitnerBox || 1,
      nextReview: note.leitnerItem?.nextReview || note.nextReviewDate || null,
      overdueDays,
    };
  }
}

module.exports = GetLeitnerDueSkill;
