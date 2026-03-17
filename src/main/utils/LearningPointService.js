/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
/**
 * LearningPointService.js
 *
 * Business logic layer for unified learning points.
 * Provides validation, transformation, and orchestration between
 * IPC handlers and the GraphInterface abstraction layer.
 *
 * This service is the primary interface for all learning point operations,
 * handling:
 * - Content validation by item type
 * - Spaced repetition logic coordination
 * - Migration from legacy tables
 * - Episodic memory integration
 */

import { v4 as uuidv4 } from 'uuid';
import graphInterface from './GraphInterface';
import { getUserIdFromToken } from '../db/dbManager';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Valid item types for learning points
 */
const ITEM_TYPES = {
  WORD: 'word',
  CONCEPT: 'concept',
  NOTE: 'note',
  PDF_ANNOTATION: 'pdf_annotation',
  FORMULA: 'formula',
  PROBLEM: 'problem',
};

/**
 * Valid domain types
 */
const DOMAIN_TYPES = {
  VOCABULARY: 'vocabulary',
  KNOWLEDGE: 'knowledge',
  MATH: 'math',
  READING: 'reading',
  LANGUAGE: 'language',
  SKILL: 'skill',
};

/**
 * Difficulty levels
 */
const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
};

/**
 * Source types for learning points
 */
const SOURCE_TYPES = {
  BOOK: 'book',
  URL: 'url',
  CHAT: 'chat',
  MANUAL: 'manual',
  IMPORT: 'import',
  MIGRATION: 'migration',
};

/**
 * Rating values for reviews
 */
const RATINGS = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
};

/**
 * Leitner box intervals in days
 */
const BOX_INTERVALS = [1, 2, 4, 7, 14];

// =============================================================================
// SERVICE CLASS
// =============================================================================

class LearningPointService {
  constructor() {
    if (LearningPointService.instance) {
      // eslint-disable-next-line no-constructor-return
      return LearningPointService.instance;
    }
    LearningPointService.instance = this;
    this.episodeCollector = null;
  }

  /**
   * Set episode collector for episodic memory integration
   * @param {Object} collector - EpisodeCollector instance
   */
  setEpisodeCollector(collector) {
    this.episodeCollector = collector;
  }

  /**
   * Check if the service is available
   */
  isAvailable() {
    return graphInterface.isConnected();
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate a learning point before creation/update
   * @param {Object} point - Learning point data
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateLearningPoint(point) {
    const errors = [];

    // Required fields
    if (!point.title && !point.front) {
      errors.push('Either title or front content is required');
    }

    // Item type validation
    if (point.itemType && !Object.values(ITEM_TYPES).includes(point.itemType)) {
      errors.push(`Invalid itemType: ${point.itemType}`);
    }

    // Domain type validation
    if (point.domainType && !Object.values(DOMAIN_TYPES).includes(point.domainType)) {
      errors.push(`Invalid domainType: ${point.domainType}`);
    }

    // Difficulty validation
    if (point.difficulty && !Object.values(DIFFICULTY_LEVELS).includes(point.difficulty)) {
      errors.push(`Invalid difficulty: ${point.difficulty}`);
    }

    // Content validation based on item type
    const contentErrors = this.validateContent(point);
    errors.push(...contentErrors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate content structure based on item type
   * @param {Object} point - Learning point data
   * @returns {string[]} Array of error messages
   */
  validateContent(point) {
    const errors = [];
    const { itemType, front, back } = point;

    switch (itemType) {
      case ITEM_TYPES.WORD:
        // Word requires simple string front (the word itself)
        if (typeof front !== 'string' && typeof front?.text !== 'string') {
          errors.push('Word type requires front to be a string or have text property');
        }
        break;

      case ITEM_TYPES.NOTE:
      case ITEM_TYPES.PDF_ANNOTATION:
        // Notes/annotations can have cards array
        if (front?.cards && !Array.isArray(front.cards)) {
          errors.push('Note cards must be an array');
        }
        break;

      case ITEM_TYPES.FORMULA:
        // Formula should have latex or text
        if (!front?.latex && !front?.text && typeof front !== 'string') {
          errors.push('Formula requires latex or text content');
        }
        break;

      default:
        // Generic validation - just need some content
        break;
    }

    return errors;
  }

  // ===========================================================================
  // NORMALIZATION & TRANSFORMATION
  // ===========================================================================

  /**
   * Normalize learning point data before storage
   * @param {Object} point - Raw learning point data
   * @returns {Object} Normalized learning point
   */
  normalizeLearningPoint(point) {
    const now = new Date().toISOString();
    const id = point.id || `lp_${uuidv4()}`;

    // Extract title from content if not provided
    let title = point.title;
    if (!title) {
      title = this.extractTitle(point);
    }

    // Normalize front/back to proper JSON structure
    const front = this.normalizeContent(point.front, point.itemType, 'front');
    const back = this.normalizeContent(point.back, point.itemType, 'back');

    // Normalize extras
    const extras = this.normalizeExtras(point.extras, point.itemType);

    // Infer domain type if not provided
    const domainType = point.domainType || this.inferDomainType(point.itemType);

    return {
      id,
      itemType: point.itemType || ITEM_TYPES.CONCEPT,
      domainType,
      title,
      front,
      back,
      extras,
      sourceType: point.sourceType || SOURCE_TYPES.MANUAL,
      sourceId: point.sourceId || null,
      cfi: point.cfi || null,
      chapter: point.chapter || null,
      chapterIndex: point.chapterIndex ?? null,
      pageNumber: point.pageNumber ?? null,
      percentage: point.percentage ?? null,
      tags: this.normalizeTags(point.tags),
      difficulty: point.difficulty || DIFFICULTY_LEVELS.INTERMEDIATE,
      planId: point.planId || null,
      // Spaced repetition defaults
      box: point.box || 1,
      nextReview: point.nextReview || now.split('T')[0],
      // Timestamps
      eventTime: point.eventTime || now,
    };
  }

  /**
   * Extract title from content
   * @param {Object} point - Learning point data
   * @returns {string} Extracted title
   */
  extractTitle(point) {
    const { front, itemType } = point;

    // Simple string
    if (typeof front === 'string') {
      return front.substring(0, 100);
    }

    // Object with text
    if (front?.text) {
      return front.text.substring(0, 100);
    }

    // Cards array (notes)
    if (front?.cards?.[0]?.text) {
      return front.cards[0].text.substring(0, 100);
    }

    // Formula with latex
    if (front?.latex) {
      return front.latex.substring(0, 100);
    }

    return `Untitled ${itemType || 'item'}`;
  }

  /**
   * Normalize content to JSON structure
   * @param {*} content - Raw content (string or object)
   * @param {string} itemType - Item type
   * @param {string} side - 'front' or 'back'
   * @returns {Object|string} Normalized content
   */
  normalizeContent(content, itemType, side) {
    // Already properly structured
    if (content && typeof content === 'object') {
      return content;
    }

    // Simple string - wrap based on item type
    if (typeof content === 'string') {
      switch (itemType) {
        case ITEM_TYPES.WORD:
          return content; // Keep as string for vocabulary
        case ITEM_TYPES.NOTE:
        case ITEM_TYPES.PDF_ANNOTATION:
          return {
            cards: [{ id: 1, text: content, type: 'normal' }],
          };
        case ITEM_TYPES.FORMULA:
          return { text: content };
        default:
          return { text: content };
      }
    }

    // Null or undefined
    return side === 'back' ? '' : { text: '' };
  }

  /**
   * Normalize extras field
   * @param {*} extras - Raw extras
   * @param {string} itemType - Item type
   * @returns {Object|null} Normalized extras
   */
  normalizeExtras(extras, itemType) {
    if (!extras) {
      // Provide default extras structure based on item type
      switch (itemType) {
        case ITEM_TYPES.WORD:
          return { partOfSpeech: null, pronunciation: null, example: null };
        case ITEM_TYPES.NOTE:
        case ITEM_TYPES.PDF_ANNOTATION:
          return { color: '#FFE082', highlightType: 'highlight' };
        default:
          return null;
      }
    }

    if (typeof extras === 'string') {
      try {
        return JSON.parse(extras);
      } catch {
        return { raw: extras };
      }
    }

    return extras;
  }

  /**
   * Normalize tags to array
   * @param {*} tags - Raw tags (string, array, or null)
   * @returns {string[]} Normalized tags array
   */
  normalizeTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.filter(t => typeof t === 'string');
    if (typeof tags === 'string') {
      // Try JSON parse first
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Split by comma
        return tags.split(',').map(t => t.trim()).filter(Boolean);
      }
    }
    return [];
  }

  /**
   * Infer domain type from item type
   * @param {string} itemType - Item type
   * @returns {string} Inferred domain type
   */
  inferDomainType(itemType) {
    switch (itemType) {
      case ITEM_TYPES.WORD:
        return DOMAIN_TYPES.VOCABULARY;
      case ITEM_TYPES.FORMULA:
        return DOMAIN_TYPES.MATH;
      case ITEM_TYPES.PDF_ANNOTATION:
      case ITEM_TYPES.NOTE:
        return DOMAIN_TYPES.READING;
      default:
        return DOMAIN_TYPES.KNOWLEDGE;
    }
  }

  // ===========================================================================
  // CRUD OPERATIONS
  // ===========================================================================

  /**
   * Create a new learning point
   * @param {Object} point - Learning point data
   * @param {string} token - User token
   * @returns {Promise<Object>} Created learning point
   */
  async createLearningPoint(point, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    // Validate
    const validation = this.validateLearningPoint(point);
    if (!validation.valid) {
      return { error: 'Validation failed', errors: validation.errors };
    }

    // Normalize
    const normalized = this.normalizeLearningPoint(point);

    try {
      const created = await graphInterface.createLearningPoint(normalized, token);

      // Record episode if collector available
      if (this.episodeCollector && created) {
        this.episodeCollector.collectEvent({
          eventType: 'LEARNING_POINT_CREATED',
          userId,
          payload: {
            pointId: created.id,
            itemType: created.itemType,
            domainType: created.domainType,
            sourceType: created.sourceType,
          },
        });
      }

      return created;
    } catch (error) {
      console.error('LearningPointService.createLearningPoint error:', error);
      return { error: error.message };
    }
  }

  /**
   * Create multiple learning points in batch
   * @param {Array} points - Array of learning point data
   * @param {string} token - User token
   * @returns {Promise<Object>} { created: number, errors: Array }
   */
  async createLearningPointsBatch(points, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    const validPoints = [];
    const errors = [];

    // Validate and normalize all points
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const validation = this.validateLearningPoint(point);

      if (validation.valid) {
        validPoints.push(this.normalizeLearningPoint(point));
      } else {
        errors.push({ index: i, errors: validation.errors });
      }
    }

    if (validPoints.length === 0) {
      return { created: 0, errors };
    }

    try {
      const result = await graphInterface.createLearningPointsBatch(validPoints, token);
      return { ...result, validationErrors: errors };
    } catch (error) {
      console.error('LearningPointService.createLearningPointsBatch error:', error);
      return { error: error.message, validationErrors: errors };
    }
  }

  /**
   * Get learning point by ID
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @returns {Promise<Object|null>} Learning point or null
   */
  async getLearningPointById(id, token) {
    try {
      return await graphInterface.getLearningPointById(id, token);
    } catch (error) {
      console.error('LearningPointService.getLearningPointById error:', error);
      return null;
    }
  }

  /**
   * Update a learning point
   * @param {string} id - Learning point ID
   * @param {Object} updates - Fields to update
   * @param {string} token - User token
   * @returns {Promise<Object>} Updated learning point
   */
  async updateLearningPoint(id, updates, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    // Don't allow changing certain fields
    const sanitizedUpdates = { ...updates };
    delete sanitizedUpdates.id;
    delete sanitizedUpdates.userId;
    delete sanitizedUpdates.createdAt;

    // Normalize content if provided
    if (sanitizedUpdates.front) {
      sanitizedUpdates.front = this.normalizeContent(
        sanitizedUpdates.front,
        updates.itemType,
        'front'
      );
    }
    if (sanitizedUpdates.back) {
      sanitizedUpdates.back = this.normalizeContent(
        sanitizedUpdates.back,
        updates.itemType,
        'back'
      );
    }
    if (sanitizedUpdates.tags) {
      sanitizedUpdates.tags = this.normalizeTags(sanitizedUpdates.tags);
    }

    try {
      return await graphInterface.updateLearningPoint(id, sanitizedUpdates, token);
    } catch (error) {
      console.error('LearningPointService.updateLearningPoint error:', error);
      return { error: error.message };
    }
  }

  /**
   * Delete a learning point
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @param {boolean} hard - Hard delete (default: soft delete)
   * @returns {Promise<boolean>}
   */
  async deleteLearningPoint(id, token, hard = false) {
    try {
      return await graphInterface.deleteLearningPoint(id, token, hard);
    } catch (error) {
      console.error('LearningPointService.deleteLearningPoint error:', error);
      return false;
    }
  }

  // ===========================================================================
  // QUERY OPERATIONS
  // ===========================================================================

  /**
   * Get learning points due for review
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Due items
   */
  async getDueForReview(options = {}) {
    try {
      return await graphInterface.getLearningPointsDue(options);
    } catch (error) {
      console.error('LearningPointService.getDueForReview error:', error);
      return [];
    }
  }

  /**
   * Get learning points by source
   * @param {string} sourceType - Source type
   * @param {string} sourceId - Source ID
   * @param {string} token - User token
   * @returns {Promise<Array>} Learning points from source
   */
  async getBySource(sourceType, sourceId, token) {
    try {
      return await graphInterface.getLearningPointsBySource(sourceType, sourceId, token);
    } catch (error) {
      console.error('LearningPointService.getBySource error:', error);
      return [];
    }
  }

  /**
   * Get learning points by plan
   * @param {string} planId - Learning plan ID
   * @param {string} token - User token
   * @returns {Promise<Array>} Learning points in plan
   */
  async getByPlan(planId, token) {
    try {
      return await graphInterface.getLearningPointsByPlan(planId, token);
    } catch (error) {
      console.error('LearningPointService.getByPlan error:', error);
      return [];
    }
  }

  /**
   * Search learning points
   * @param {string} query - Search query
   * @param {string} token - User token
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching learning points
   */
  async search(query, token, options = {}) {
    try {
      return await graphInterface.searchLearningPoints(query, token, options);
    } catch (error) {
      console.error('LearningPointService.search error:', error);
      return [];
    }
  }

  /**
   * Get all learning points for user
   * @param {string} token - User token
   * @param {Object} options - Query options (limit, offset, filters)
   * @returns {Promise<Array>} Learning points
   */
  async getAll(token, options = {}) {
    try {
      return await graphInterface.getAllLearningPoints(token, options);
    } catch (error) {
      console.error('LearningPointService.getAll error:', error);
      return [];
    }
  }

  /**
   * Get statistics
   * @param {string} token - User token
   * @param {Object} options - Stats options
   * @returns {Promise<Object>} Statistics
   */
  async getStats(token, options = {}) {
    try {
      return await graphInterface.getLearningPointStats(token, options);
    } catch (error) {
      console.error('LearningPointService.getStats error:', error);
      return { error: error.message };
    }
  }

  /**
   * Get daily forecast
   * @param {string} token - User token
   * @param {number} days - Number of days to forecast
   * @returns {Promise<Array>} Daily forecast
   */
  async getForecast(token, days = 14) {
    try {
      return await graphInterface.getLearningPointForecast(token, days);
    } catch (error) {
      console.error('LearningPointService.getForecast error:', error);
      return [];
    }
  }

  // ===========================================================================
  // SPACED REPETITION OPERATIONS
  // ===========================================================================

  /**
   * Process a review and update spaced repetition state
   * @param {string} id - Learning point ID
   * @param {number} rating - Rating (1-4)
   * @param {number} responseTimeMs - Response time in ms
   * @param {string} token - User token
   * @returns {Promise<Object>} Review result
   */
  async processReview(id, rating, responseTimeMs, token) {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid session' };
    }

    // Validate rating
    if (!Object.values(RATINGS).includes(rating)) {
      return { error: `Invalid rating: ${rating}` };
    }

    try {
      // Get current state before processing
      const current = await graphInterface.getLearningPointById(id, token);
      if (!current) {
        return { error: 'Learning point not found' };
      }

      const previousBox = current.box || 1;

      // Process the review via GraphInterface
      const result = await graphInterface.processLearningPointReview(
        id,
        rating,
        responseTimeMs,
        token
      );

      // Record episode if collector available
      if (this.episodeCollector && result.success) {
        this.episodeCollector.collectEvent({
          eventType: 'REVIEW_COMPLETED',
          userId,
          payload: {
            conceptId: id,
            conceptName: current.title,
            rating,
            responseTimeMs,
            previousBox,
            newBox: result.newBox,
            wasCorrect: rating >= RATINGS.GOOD,
            masteryLevel: result.masteryLevel,
          },
        });
      }

      return result;
    } catch (error) {
      console.error('LearningPointService.processReview error:', error);
      return { error: error.message };
    }
  }

  /**
   * Reset a learning point to box 1
   * @param {string} id - Learning point ID
   * @param {string} token - User token
   * @returns {Promise<boolean>}
   */
  async reset(id, token) {
    try {
      return await graphInterface.resetLearningPoint(id, token);
    } catch (error) {
      console.error('LearningPointService.reset error:', error);
      return false;
    }
  }

  /**
   * Calculate next review date based on box
   * @param {number} box - Current box (1-5)
   * @returns {string} Next review date (ISO string)
   */
  calculateNextReviewDate(box) {
    const intervalDays = BOX_INTERVALS[(box || 1) - 1] || BOX_INTERVALS[4];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);
    return nextDate.toISOString().split('T')[0];
  }

  // ===========================================================================
  // MIGRATION HELPERS
  // ===========================================================================

  /**
   * Convert legacy vocabulary item to learning point
   * @param {Object} vocab - Vocabulary record from SQLite
   * @param {Object} leitnerItem - Associated leitner_item record
   * @returns {Object} Normalized learning point
   */
  convertFromVocabulary(vocab, leitnerItem = null) {
    return this.normalizeLearningPoint({
      id: `lp_vocab_${vocab.id}`,
      itemType: ITEM_TYPES.WORD,
      domainType: DOMAIN_TYPES.VOCABULARY,
      title: vocab.word,
      front: vocab.word,
      back: vocab.definition || '',
      extras: {
        partOfSpeech: vocab.part_of_speech,
        pronunciation: vocab.pronunciation,
        example: vocab.example,
        etymology: vocab.etymology,
        context: vocab.context,
      },
      sourceType: vocab.source_type || SOURCE_TYPES.MANUAL,
      sourceId: vocab.source_id,
      tags: vocab.tags ? JSON.parse(vocab.tags) : [],
      // Leitner state
      box: leitnerItem?.box || 1,
      nextReview: leitnerItem?.next_review,
      // Timestamps
      eventTime: vocab.created_at,
    });
  }

  /**
   * Convert legacy note to learning point
   * @param {Object} note - Note record from SQLite
   * @param {Object} leitnerItem - Associated leitner_item record
   * @returns {Object} Normalized learning point
   */
  convertFromNote(note, leitnerItem = null) {
    let noteData;
    try {
      noteData = typeof note.data === 'string' ? JSON.parse(note.data) : note.data;
    } catch {
      noteData = { cards: [{ id: 1, text: note.data || '' }] };
    }

    const isPDF = noteData.position && Array.isArray(noteData.position);

    return this.normalizeLearningPoint({
      id: `lp_note_${note.id}`,
      itemType: isPDF ? ITEM_TYPES.PDF_ANNOTATION : ITEM_TYPES.NOTE,
      domainType: DOMAIN_TYPES.READING,
      title: noteData.cards?.[0]?.text?.substring(0, 100) || 'Note',
      front: { cards: noteData.cards?.filter(c => c.type !== 'annotation') || [] },
      back: { cards: noteData.cards?.filter(c => c.type === 'annotation') || [] },
      extras: {
        color: noteData.color,
        emoji: noteData.emoji,
        highlightType: noteData.highlightType,
        highlightOnly: noteData.highlightOnly,
        hasQuiz: noteData.hasQuiz,
        range: noteData.range,
        position: noteData.position,
      },
      sourceType: SOURCE_TYPES.BOOK,
      sourceId: noteData.bookPath,
      cfi: noteData.cfi,
      chapter: noteData.chapter,
      chapterIndex: noteData.chapterIndex,
      pageNumber: noteData.position?.[0]?.pageNumber,
      percentage: noteData.percentage,
      tags: noteData.tags || [],
      // Leitner state
      box: leitnerItem?.box || 1,
      nextReview: leitnerItem?.next_review,
      // Timestamps
      eventTime: note.created_at,
    });
  }

  /**
   * Convert learning plan point to learning point
   * @param {Object} planPoint - Learning point from plan.plan_data.learningPoints
   * @param {string} planId - Parent plan ID
   * @returns {Object} Normalized learning point
   */
  convertFromPlanPoint(planPoint, planId) {
    return this.normalizeLearningPoint({
      id: planPoint.id || `lp_plan_${planId}_${uuidv4()}`,
      itemType: planPoint.type || ITEM_TYPES.CONCEPT,
      domainType: planPoint.domain || DOMAIN_TYPES.KNOWLEDGE,
      title: planPoint.front?.text || planPoint.front || planPoint.title,
      front: planPoint.front,
      back: planPoint.back,
      extras: planPoint.extras,
      sourceType: SOURCE_TYPES.IMPORT,
      sourceId: planId,
      planId,
      tags: planPoint.tags || [],
      difficulty: planPoint.difficulty || DIFFICULTY_LEVELS.INTERMEDIATE,
      // Leitner state from plan point
      box: planPoint.box || 1,
      nextReview: planPoint.nextReview,
    });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

const learningPointService = new LearningPointService();

export {
  learningPointService,
  ITEM_TYPES,
  DOMAIN_TYPES,
  DIFFICULTY_LEVELS,
  SOURCE_TYPES,
  RATINGS,
  BOX_INTERVALS,
};

export default learningPointService;
