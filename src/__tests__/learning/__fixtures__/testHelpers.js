/**
 * testHelpers.js
 *
 * Test utilities and helper functions for learning point tests.
 * Extracted from LeitnerSystem.js to enable unit testing.
 */

// Color palette for Leitner boxes (light mode)
const BOX_COLORS = [
  { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828', gradient: 'linear-gradient(135deg, #FF6B6B, #F44336)' },
  { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100', gradient: 'linear-gradient(135deg, #FFB347, #FF9800)' },
  { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00', gradient: 'linear-gradient(135deg, #FFD700, #FFC107)' },
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32', gradient: 'linear-gradient(135deg, #69F0AE, #4CAF50)' },
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0', gradient: 'linear-gradient(135deg, #64B5F6, #2196F3)' },
];

// Color palette for Leitner boxes (dark mode)
const BOX_COLORS_DARK = [
  { bg: '#2D1515', accent: '#F44336', icon: '#EF9A9A', gradient: 'linear-gradient(135deg, #EF5350, #C62828)' },
  { bg: '#2D1B00', accent: '#FF9800', icon: '#FFB74D', gradient: 'linear-gradient(135deg, #FFA726, #E65100)' },
  { bg: '#2D2600', accent: '#FFC107', icon: '#FFD54F', gradient: 'linear-gradient(135deg, #FFCA28, #FF8F00)' },
  { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784', gradient: 'linear-gradient(135deg, #66BB6A, #2E7D32)' },
  { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6', gradient: 'linear-gradient(135deg, #42A5F5, #1565C0)' },
];

const BOX_NAMES = ['New', 'Learning', 'Reviewing', 'Familiar', 'Mastered'];
const BOX_INTERVALS = ['1 day', '2 days', '4 days', '1 week', '2 weeks'];

// Domain type filter options
const DOMAIN_FILTERS = {
  ALL: 'all',
  VOCABULARY: 'vocabulary',
  KNOWLEDGE: 'knowledge',
  MATH: 'math',
};

/**
 * Convert learning_point item to card format for WorkingStage
 */
const learningPointToCard = (item) => {
  if (!item) return null;

  // Get content text from JSON or string
  const getFrontText = (front) => {
    if (!front) return '';
    if (typeof front === 'string') return front;
    return front.text || front.html || '';
  };

  const getBackText = (back) => {
    if (!back) return '';
    if (typeof back === 'string') return back;
    return back.text || back.html || '';
  };

  const domainType = item.domain_type || item.domainType || 'knowledge';
  const itemType = item.item_type || item.itemType || 'concept';

  const card = {
    id: item.id,
    sourceType: item.source_type || 'manual',
    isLearningPoint: true,
    leitnerItem: {
      id: item.id,
      box: item.box || 1,
      skips: item.review_count || 0,
      flips: item.review_count || 0,
      fullyLearned: item.fully_learned === 1,
      nextReview: item.next_review,
    },
    // Common fields
    title: item.title || getFrontText(item.front),
    front: item.front,
    back: item.back,
    extras: item.extras,
    itemType,
    domainType,
    tags: item.tags || [],
    difficulty: item.difficulty,
    masteryLevel: item.mastery_level || 0,
  };

  // Add type-specific fields for backward compatibility
  if (domainType === 'vocabulary' || itemType === 'word') {
    card.word = getFrontText(item.front);
    card.definition = getBackText(item.back);
    card.example = item.extras?.example || item.back?.example;
    card.relatedWords = item.extras?.relatedWords;
  } else {
    card.cards = item.extras?.cards || [
      { text: getFrontText(item.front) },
      { text: getBackText(item.back), html: getBackText(item.back) },
    ];
    card.hasQuiz = item.extras?.hasQuiz;
    card.cfi = item.extras?.cfi;
    card.sourceKey = item.source_id;
  }

  return card;
};

/**
 * Determine card display name based on type
 */
const getCardDisplayName = (card) => {
  if (card.word) return card.word;
  if (card.title) return card.title;
  if (card.front) {
    return typeof card.front === 'string' ? card.front : card.front?.text || 'Item';
  }
  return 'Item';
};

/**
 * Calculate box counts from cards array
 */
const getBoxCounts = (cards) => {
  const counts = [0, 0, 0, 0, 0];
  cards.forEach((card) => {
    const box = card.leitnerItem?.box || 1;
    if (box >= 1 && box <= 5) {
      counts[box - 1]++;
    }
  });
  return counts;
};

/**
 * Get word font size based on length
 */
const getWordFontSize = (word) => {
  if (!word) return '1.8rem';
  const len = word.length;
  if (len <= 6) return '2rem';
  if (len <= 10) return '1.6rem';
  if (len <= 14) return '1.3rem';
  if (len <= 18) return '1.1rem';
  return '0.95rem';
};

/**
 * Create mock learning point for tests
 */
const createMockLearningPoint = (overrides = {}) => ({
  id: `lp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Learning Point',
  front: 'Test Question',
  back: 'Test Answer',
  box: 1,
  next_review: new Date().toISOString().split('T')[0],
  review_count: 0,
  domain_type: 'knowledge',
  item_type: 'concept',
  fully_learned: 0,
  mastery_level: 0,
  tags: [],
  ...overrides,
});

/**
 * Create mock vocabulary item for tests
 */
const createMockVocabularyItem = (word, definition, overrides = {}) => ({
  id: `vocab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  front: word,
  back: definition,
  box: 1,
  domain_type: 'vocabulary',
  item_type: 'word',
  extras: {
    example: `Example sentence using ${word}`,
    relatedWords: 'synonym1, synonym2',
  },
  ...overrides,
});

/**
 * Create array of mock cards for testing
 */
const createMockCardArray = (count, baseBox = 1) => {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index}`,
    title: `Test Card ${index + 1}`,
    front: `Question ${index + 1}`,
    back: `Answer ${index + 1}`,
    box: Math.min(baseBox + (index % 5), 5),
    domain_type: 'knowledge',
    item_type: 'concept',
  })).map(learningPointToCard);
};

module.exports = {
  BOX_COLORS,
  BOX_COLORS_DARK,
  BOX_NAMES,
  BOX_INTERVALS,
  DOMAIN_FILTERS,
  learningPointToCard,
  getCardDisplayName,
  getBoxCounts,
  getWordFontSize,
  createMockLearningPoint,
  createMockVocabularyItem,
  createMockCardArray,
};
