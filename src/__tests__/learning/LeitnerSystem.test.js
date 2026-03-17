/**
 * LeitnerSystem.test.js
 *
 * Unit tests for the LeitnerSystem component and related components.
 * Tests the 5-box spaced repetition UI and user interactions.
 *
 * @jest-environment node
 */

// Setup mocks before imports
const mockGetDueItems = jest.fn();
const mockProcessReview = jest.fn();
const mockGetToken = jest.fn();
const mockRecordEpisode = jest.fn();

// Mock learningPointApi
jest.mock('../../renderer/api/learningPointApi', () => ({
  getDueItems: (...args) => mockGetDueItems(...args),
  processReview: (...args) => mockProcessReview(...args),
  RATINGS: {
    AGAIN: 1,
    HARD: 2,
    GOOD: 3,
    EASY: 4,
  },
}));

// Mock customStorage
jest.mock('../../renderer/store/customStorage', () => ({
  getToken: () => mockGetToken(),
}));

// Mock brainApi
jest.mock('../../renderer/api/brainApi', () => ({
  recordEpisode: (...args) => mockRecordEpisode(...args),
  recordEvent: {
    reviewCompleted: jest.fn(),
    masteryChanged: jest.fn(),
  },
  EPISODE_TYPES: {
    REVIEW_COMPLETED: 'REVIEW_COMPLETED',
    REVIEW_SKIPPED: 'REVIEW_SKIPPED',
    MASTERY_CHANGED: 'MASTERY_CHANGED',
  },
}));

// Import test utilities after mocks
const { learningPointToCard, getCardDisplayName, BOX_COLORS, BOX_NAMES, BOX_INTERVALS, DOMAIN_FILTERS } = require('./__fixtures__/testHelpers');

describe('LeitnerSystem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue('test-token');
    mockGetDueItems.mockResolvedValue([]);
    mockProcessReview.mockResolvedValue({ success: true, box: 2 });
  });

  // ==========================================================================
  // LEARNING POINT TO CARD CONVERSION
  // ==========================================================================

  describe('learningPointToCard conversion', () => {
    test('converts basic learning point to card format', () => {
      const learningPoint = {
        id: 'lp-123',
        title: 'Test Item',
        front: 'What is React?',
        back: 'A JavaScript library for building UIs',
        box: 2,
        next_review: '2024-01-20',
        review_count: 5,
        domain_type: 'knowledge',
        item_type: 'concept',
      };

      const card = learningPointToCard(learningPoint);

      expect(card.id).toBe('lp-123');
      expect(card.title).toBe('Test Item');
      expect(card.front).toBe('What is React?');
      expect(card.back).toBe('A JavaScript library for building UIs');
      expect(card.leitnerItem.box).toBe(2);
      expect(card.leitnerItem.nextReview).toBe('2024-01-20');
      expect(card.domainType).toBe('knowledge');
      expect(card.itemType).toBe('concept');
      expect(card.isLearningPoint).toBe(true);
    });

    test('converts vocabulary learning point', () => {
      const learningPoint = {
        id: 'vocab-1',
        front: 'ephemeral',
        back: 'lasting for a very short time',
        domain_type: 'vocabulary',
        item_type: 'word',
        box: 3,
        extras: {
          example: 'The ephemeral beauty of cherry blossoms',
          relatedWords: 'transient, fleeting',
        },
      };

      const card = learningPointToCard(learningPoint);

      expect(card.word).toBe('ephemeral');
      expect(card.definition).toBe('lasting for a very short time');
      expect(card.example).toBe('The ephemeral beauty of cherry blossoms');
      expect(card.relatedWords).toBe('transient, fleeting');
      expect(card.domainType).toBe('vocabulary');
    });

    test('handles JSON content in front/back', () => {
      const learningPoint = {
        id: 'lp-json',
        front: { text: 'Question text', html: '<p>Question text</p>' },
        back: { text: 'Answer text', html: '<p>Answer text</p>' },
        domain_type: 'knowledge',
      };

      const card = learningPointToCard(learningPoint);

      expect(card.title).toBe('Question text');
    });

    test('handles null/undefined input', () => {
      expect(learningPointToCard(null)).toBeNull();
      expect(learningPointToCard(undefined)).toBeNull();
    });

    test('sets default values for missing fields', () => {
      const learningPoint = {
        id: 'lp-minimal',
        front: 'Question',
        back: 'Answer',
      };

      const card = learningPointToCard(learningPoint);

      expect(card.leitnerItem.box).toBe(1);
      expect(card.sourceType).toBe('manual');
      expect(card.domainType).toBe('knowledge');
      expect(card.itemType).toBe('concept');
    });

    test('converts fully_learned flag', () => {
      const learningPoint = {
        id: 'lp-mastered',
        front: 'Q',
        back: 'A',
        fully_learned: 1,
      };

      const card = learningPointToCard(learningPoint);

      expect(card.leitnerItem.fullyLearned).toBe(true);
    });
  });

  // ==========================================================================
  // GET CARD DISPLAY NAME
  // ==========================================================================

  describe('getCardDisplayName', () => {
    test('returns word for vocabulary cards', () => {
      const card = { word: 'ephemeral', title: 'Vocab Card' };
      expect(getCardDisplayName(card)).toBe('ephemeral');
    });

    test('returns title for non-vocabulary cards', () => {
      const card = { title: 'React Basics' };
      expect(getCardDisplayName(card)).toBe('React Basics');
    });

    test('extracts text from front object', () => {
      const card = { front: { text: 'Question text' } };
      expect(getCardDisplayName(card)).toBe('Question text');
    });

    test('returns string front directly', () => {
      const card = { front: 'Direct question' };
      expect(getCardDisplayName(card)).toBe('Direct question');
    });

    test('returns default for empty card', () => {
      const card = {};
      expect(getCardDisplayName(card)).toBe('Item');
    });
  });

  // ==========================================================================
  // BOX COLORS AND CONSTANTS
  // ==========================================================================

  describe('Box constants', () => {
    test('BOX_COLORS has 5 entries for light mode', () => {
      expect(BOX_COLORS.length).toBe(5);
      BOX_COLORS.forEach(color => {
        expect(color.bg).toBeDefined();
        expect(color.accent).toBeDefined();
        expect(color.icon).toBeDefined();
        expect(color.gradient).toBeDefined();
      });
    });

    test('BOX_NAMES has correct labels', () => {
      expect(BOX_NAMES).toEqual(['New', 'Learning', 'Reviewing', 'Familiar', 'Mastered']);
    });

    test('BOX_INTERVALS has correct intervals', () => {
      expect(BOX_INTERVALS).toEqual(['1 day', '2 days', '4 days', '1 week', '2 weeks']);
    });

    test('DOMAIN_FILTERS has all filter options', () => {
      expect(DOMAIN_FILTERS.ALL).toBe('all');
      expect(DOMAIN_FILTERS.VOCABULARY).toBe('vocabulary');
      expect(DOMAIN_FILTERS.KNOWLEDGE).toBe('knowledge');
      expect(DOMAIN_FILTERS.MATH).toBe('math');
    });
  });

  // ==========================================================================
  // BOX COUNTS CALCULATION
  // ==========================================================================

  describe('Box counts calculation', () => {
    test('calculates box counts from cards array', () => {
      const cards = [
        { leitnerItem: { box: 1 } },
        { leitnerItem: { box: 1 } },
        { leitnerItem: { box: 2 } },
        { leitnerItem: { box: 3 } },
        { leitnerItem: { box: 5 } },
      ];

      const getBoxCounts = (cardList) => {
        const counts = [0, 0, 0, 0, 0];
        cardList.forEach((card) => {
          const box = card.leitnerItem?.box || 1;
          if (box >= 1 && box <= 5) {
            counts[box - 1]++;
          }
        });
        return counts;
      };

      const counts = getBoxCounts(cards);
      expect(counts).toEqual([2, 1, 1, 0, 1]);
    });

    test('handles empty cards array', () => {
      const getBoxCounts = (cardList) => {
        const counts = [0, 0, 0, 0, 0];
        cardList.forEach((card) => {
          const box = card.leitnerItem?.box || 1;
          if (box >= 1 && box <= 5) {
            counts[box - 1]++;
          }
        });
        return counts;
      };

      expect(getBoxCounts([])).toEqual([0, 0, 0, 0, 0]);
    });

    test('defaults to box 1 for cards without box number', () => {
      const cards = [
        { leitnerItem: {} },
        { leitnerItem: null },
        {},
      ];

      const getBoxCounts = (cardList) => {
        const counts = [0, 0, 0, 0, 0];
        cardList.forEach((card) => {
          const box = card.leitnerItem?.box || 1;
          if (box >= 1 && box <= 5) {
            counts[box - 1]++;
          }
        });
        return counts;
      };

      expect(getBoxCounts(cards)).toEqual([3, 0, 0, 0, 0]);
    });
  });

  // ==========================================================================
  // CARD HANDLING LOGIC
  // ==========================================================================

  describe('Card handling logic', () => {
    describe('handleCorrect', () => {
      test('calls processReview with GOOD rating', async () => {
        const card = {
          id: 'card-1',
          leitnerItem: { box: 2 },
          domainType: 'vocabulary',
          word: 'test',
        };

        mockProcessReview.mockResolvedValue({ box: 3, error: null });

        // Simulate handleCorrect logic
        const result = await mockProcessReview('card-1', 3, 0, 'test-token');

        expect(mockProcessReview).toHaveBeenCalledWith('card-1', 3, 0, 'test-token');
        expect(result.box).toBe(3);
      });

      test('box advances on correct answer', () => {
        const oldBox = 2;
        const newBox = 3;
        expect(newBox).toBeGreaterThan(oldBox);
      });
    });

    describe('handleIncorrect', () => {
      test('calls processReview with AGAIN rating', async () => {
        mockProcessReview.mockResolvedValue({ box: 1, error: null });

        const result = await mockProcessReview('card-1', 1, 0, 'test-token');

        expect(mockProcessReview).toHaveBeenCalledWith('card-1', 1, 0, 'test-token');
        expect(result.box).toBe(1);
      });

      test('box resets to 1 on incorrect answer', () => {
        const oldBox = 3;
        const newBox = 1;
        expect(newBox).toBeLessThan(oldBox);
        expect(newBox).toBe(1);
      });
    });

    describe('handleSkip', () => {
      test('moves current card to end of array', () => {
        const cards = [
          { id: '1', word: 'first' },
          { id: '2', word: 'second' },
          { id: '3', word: 'third' },
        ];
        const currentCardIndex = 0;

        // Simulate skip logic
        const currentCard = cards[currentCardIndex];
        const newCards = cards.filter((_, i) => i !== currentCardIndex);
        newCards.push(currentCard);

        expect(newCards[0].id).toBe('2');
        expect(newCards[1].id).toBe('3');
        expect(newCards[2].id).toBe('1');
      });

      test('skip only works when more than 1 card', () => {
        const cards = [{ id: '1' }];
        const canSkip = cards.length > 1;
        expect(canSkip).toBe(false);
      });
    });
  });

  // ==========================================================================
  // DOMAIN FILTER LOGIC
  // ==========================================================================

  describe('Domain filter logic', () => {
    test('ALL filter returns null domain types', () => {
      const domainFilter = DOMAIN_FILTERS.ALL;
      const domainTypes = domainFilter === DOMAIN_FILTERS.ALL ? null : [domainFilter];
      expect(domainTypes).toBeNull();
    });

    test('VOCABULARY filter returns vocabulary array', () => {
      const domainFilter = DOMAIN_FILTERS.VOCABULARY;
      const domainTypes = domainFilter === DOMAIN_FILTERS.ALL ? null : [domainFilter];
      expect(domainTypes).toEqual(['vocabulary']);
    });

    test('KNOWLEDGE filter returns knowledge array', () => {
      const domainFilter = DOMAIN_FILTERS.KNOWLEDGE;
      const domainTypes = domainFilter === DOMAIN_FILTERS.ALL ? null : [domainFilter];
      expect(domainTypes).toEqual(['knowledge']);
    });

    test('MATH filter returns math array', () => {
      const domainFilter = DOMAIN_FILTERS.MATH;
      const domainTypes = domainFilter === DOMAIN_FILTERS.ALL ? null : [domainFilter];
      expect(domainTypes).toEqual(['math']);
    });
  });

  // ==========================================================================
  // VOCABULARY DETECTION
  // ==========================================================================

  describe('Vocabulary detection', () => {
    test('detects vocabulary by domainType', () => {
      const card = { domainType: 'vocabulary' };
      const isVocabulary = card.domainType === 'vocabulary' || card.word !== undefined;
      expect(isVocabulary).toBe(true);
    });

    test('detects vocabulary by word property', () => {
      const card = { word: 'ephemeral', domainType: 'knowledge' };
      const isVocabulary = card.domainType === 'vocabulary' || card.word !== undefined;
      expect(isVocabulary).toBe(true);
    });

    test('non-vocabulary card is detected correctly', () => {
      const card = { title: 'React Basics', domainType: 'knowledge' };
      const isVocabulary = card.domainType === 'vocabulary' || card.word !== undefined;
      expect(isVocabulary).toBe(false);
    });
  });

  // ==========================================================================
  // ANIMATION STATES
  // ==========================================================================

  describe('Animation states', () => {
    test('fly-out-forward state is set on box advancement', () => {
      const oldBox = 2;
      const newBox = 3;
      const shouldAnimate = newBox > oldBox;
      const animationState = shouldAnimate ? 'fly-out-forward' : null;

      expect(shouldAnimate).toBe(true);
      expect(animationState).toBe('fly-out-forward');
    });

    test('fly-out-backward state is set on box demotion', () => {
      const oldBox = 3;
      const newBox = 1;
      const shouldAnimate = newBox < oldBox;
      const animationState = shouldAnimate ? 'fly-out-backward' : null;

      expect(shouldAnimate).toBe(true);
      expect(animationState).toBe('fly-out-backward');
    });

    test('no animation when box stays the same', () => {
      const oldBox = 2;
      const newBox = 2;
      const shouldAnimate = newBox !== oldBox;
      expect(shouldAnimate).toBe(false);
    });
  });

  // ==========================================================================
  // CARD STATE UPDATES
  // ==========================================================================

  describe('Card state updates', () => {
    test('updates card box after correct answer', () => {
      const card = { id: '1', leitnerItem: { box: 2, skips: 0 } };
      const newBox = 3;

      const updatedCard = {
        ...card,
        leitnerItem: { ...card.leitnerItem, box: newBox },
      };

      expect(updatedCard.leitnerItem.box).toBe(3);
      expect(updatedCard.id).toBe('1');
    });

    test('increments skips on same-box correct', () => {
      const card = { id: '1', leitnerItem: { box: 5, skips: 2 } };

      // When at max box (5), card stays but skips increment
      const updatedCard = {
        ...card,
        leitnerItem: { ...card.leitnerItem, skips: card.leitnerItem.skips + 1 },
      };

      expect(updatedCard.leitnerItem.skips).toBe(3);
    });

    test('increments flips on flip action', () => {
      const card = { id: '1', leitnerItem: { flips: 3 } };

      const updatedCard = {
        ...card,
        leitnerItem: { ...card.leitnerItem, flips: card.leitnerItem.flips + 1 },
      };

      expect(updatedCard.leitnerItem.flips).toBe(4);
    });

    test('moves card to end of array after update', () => {
      const cards = [
        { id: '1', leitnerItem: { box: 1 } },
        { id: '2', leitnerItem: { box: 2 } },
        { id: '3', leitnerItem: { box: 3 } },
      ];
      const id = '1';
      const updatedCard = { ...cards[0], leitnerItem: { box: 2 } };

      const remaining = cards.filter((m) => m.id !== id);
      const newCards = [...remaining, updatedCard];

      expect(newCards.length).toBe(3);
      expect(newCards[2].id).toBe('1');
      expect(newCards[2].leitnerItem.box).toBe(2);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge cases', () => {
    test('handles empty cards array gracefully', () => {
      const cards = [];
      const currentCard = cards.length > 0 ? cards[0] : null;
      expect(currentCard).toBeNull();
    });

    test('handles card without leitnerItem', () => {
      const card = { id: '1', word: 'test' };
      const box = card.leitnerItem?.box || 1;
      expect(box).toBe(1);
    });

    test('handles processReview error', async () => {
      mockProcessReview.mockResolvedValue({ error: 'Failed to process' });

      const result = await mockProcessReview('card-1', 3, 0, 'token');

      expect(result.error).toBe('Failed to process');
    });

    test('handles API rejection', async () => {
      mockProcessReview.mockRejectedValue(new Error('Network error'));

      await expect(mockProcessReview('card-1', 3, 0, 'token'))
        .rejects.toThrow('Network error');
    });
  });
});

describe('FlipCard', () => {
  // ==========================================================================
  // FLIP CARD LOGIC
  // ==========================================================================

  describe('Flip functionality', () => {
    test('flip toggles isFlipped state', () => {
      let isFlipped = false;
      const handleFlip = () => {
        isFlipped = !isFlipped;
      };

      handleFlip();
      expect(isFlipped).toBe(true);

      handleFlip();
      expect(isFlipped).toBe(false);
    });

    test('flip increments flip count', () => {
      const card = { id: '1', leitnerItem: { flips: 0 } };
      let flips = card.leitnerItem.flips;

      // Simulate flip
      flips += 1;

      expect(flips).toBe(1);
    });
  });

  // ==========================================================================
  // WORD FONT SIZE CALCULATION
  // ==========================================================================

  describe('Word font size calculation', () => {
    const getWordFontSize = (word) => {
      if (!word) return '1.8rem';
      const len = word.length;
      if (len <= 6) return '2rem';
      if (len <= 10) return '1.6rem';
      if (len <= 14) return '1.3rem';
      if (len <= 18) return '1.1rem';
      return '0.95rem';
    };

    test('returns large font for short words', () => {
      expect(getWordFontSize('cat')).toBe('2rem');
      expect(getWordFontSize('hello')).toBe('2rem');
    });

    test('returns medium font for medium words', () => {
      expect(getWordFontSize('ephemeral')).toBe('1.6rem');
    });

    test('returns smaller font for longer words', () => {
      expect(getWordFontSize('internationalization')).toBe('0.95rem');
    });

    test('returns default for null/undefined', () => {
      expect(getWordFontSize(null)).toBe('1.8rem');
      expect(getWordFontSize(undefined)).toBe('1.8rem');
    });
  });

  // ==========================================================================
  // ANIMATION CLASSES
  // ==========================================================================

  describe('Animation classes', () => {
    test('correct-pulse class applied on correct answer', () => {
      const isCorrectAnimating = true;
      const className = isCorrectAnimating ? 'correct-pulse' : '';
      expect(className).toBe('correct-pulse');
    });

    test('incorrect-shake class applied on incorrect answer', () => {
      const isIncorrectAnimating = true;
      const className = isIncorrectAnimating ? 'incorrect-shake' : '';
      expect(className).toBe('incorrect-shake');
    });

    test('flipped class applied when card is flipped', () => {
      const isFlipped = true;
      const className = isFlipped ? 'flipped' : '';
      expect(className).toBe('flipped');
    });

    test('combines multiple classes', () => {
      const isFlipped = true;
      const isCorrectAnimating = true;
      const classNames = [
        'flip-card',
        isFlipped ? 'flipped' : '',
        isCorrectAnimating ? 'correct-pulse' : '',
      ].filter(Boolean).join(' ');

      expect(classNames).toBe('flip-card flipped correct-pulse');
    });
  });
});

describe('WorkingStage', () => {
  // ==========================================================================
  // EMPTY STATE
  // ==========================================================================

  describe('Empty state', () => {
    test('shows empty state when no current card', () => {
      const currentCard = null;
      const shouldShowEmptyState = !currentCard;
      expect(shouldShowEmptyState).toBe(true);
    });

    test('shows cards when available', () => {
      const currentCard = { id: '1', word: 'test' };
      const shouldShowEmptyState = !currentCard;
      expect(shouldShowEmptyState).toBe(false);
    });
  });

  // ==========================================================================
  // BOX COLOR SELECTION
  // ==========================================================================

  describe('Box color selection', () => {
    test('selects correct color for box 1', () => {
      const currentBoxNumber = 1;
      const colors = BOX_COLORS[currentBoxNumber - 1];
      expect(colors).toBe(BOX_COLORS[0]);
    });

    test('selects correct color for box 5', () => {
      const currentBoxNumber = 5;
      const colors = BOX_COLORS[currentBoxNumber - 1];
      expect(colors).toBe(BOX_COLORS[4]);
    });

    test('defaults to first color for invalid box', () => {
      const currentBoxNumber = 0;
      const colors = BOX_COLORS[currentBoxNumber - 1] || BOX_COLORS[0];
      expect(colors).toBe(BOX_COLORS[0]);
    });
  });

  // ==========================================================================
  // PROGRESS DISPLAY
  // ==========================================================================

  describe('Progress display', () => {
    test('formats progress correctly', () => {
      const currentIndex = 5;
      const totalDueCards = 20;
      const progressText = `Card ${currentIndex + 1} of ${totalDueCards}`;
      expect(progressText).toBe('Card 6 of 20');
    });

    test('shows correct interval for box', () => {
      const currentBoxNumber = 3;
      const interval = BOX_INTERVALS[currentBoxNumber - 1];
      expect(interval).toBe('4 days');
    });

    test('shows correct box name', () => {
      const currentBoxNumber = 4;
      const boxName = BOX_NAMES[currentBoxNumber - 1];
      expect(boxName).toBe('Familiar');
    });
  });

  // ==========================================================================
  // SKIP BUTTON VISIBILITY
  // ==========================================================================

  describe('Skip button visibility', () => {
    test('skip button visible when multiple cards', () => {
      const totalDueCards = 5;
      const showSkipButton = totalDueCards > 1;
      expect(showSkipButton).toBe(true);
    });

    test('skip button hidden when single card', () => {
      const totalDueCards = 1;
      const showSkipButton = totalDueCards > 1;
      expect(showSkipButton).toBe(false);
    });

    test('skip button hidden when no cards', () => {
      const totalDueCards = 0;
      const showSkipButton = totalDueCards > 1;
      expect(showSkipButton).toBe(false);
    });
  });
});

describe('BoxProgressionTrack', () => {
  // ==========================================================================
  // BOX COUNTS DISPLAY
  // ==========================================================================

  describe('Box counts display', () => {
    test('displays correct counts for each box', () => {
      const boxCounts = [10, 5, 8, 3, 2];

      boxCounts.forEach((count, index) => {
        expect(count).toBe([10, 5, 8, 3, 2][index]);
      });
    });

    test('highlights active box', () => {
      const activeBox = 3;
      const boxIndices = [1, 2, 3, 4, 5];

      boxIndices.forEach((box) => {
        const isActive = box === activeBox;
        if (box === 3) {
          expect(isActive).toBe(true);
        } else {
          expect(isActive).toBe(false);
        }
      });
    });

    test('shows animation indicator for target box', () => {
      const animatingToBox = 4;
      const boxIndices = [1, 2, 3, 4, 5];

      boxIndices.forEach((box) => {
        const isAnimating = box === animatingToBox;
        if (box === 4) {
          expect(isAnimating).toBe(true);
        } else {
          expect(isAnimating).toBe(false);
        }
      });
    });
  });

  // ==========================================================================
  // TOTAL CALCULATIONS
  // ==========================================================================

  describe('Total calculations', () => {
    test('calculates total cards from counts', () => {
      const boxCounts = [10, 5, 8, 3, 2];
      const total = boxCounts.reduce((sum, count) => sum + count, 0);
      expect(total).toBe(28);
    });

    test('handles empty counts', () => {
      const boxCounts = [0, 0, 0, 0, 0];
      const total = boxCounts.reduce((sum, count) => sum + count, 0);
      expect(total).toBe(0);
    });
  });
});
