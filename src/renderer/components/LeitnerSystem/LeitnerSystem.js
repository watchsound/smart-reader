import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

import WorkingStage from './WorkingStage';
import BoxProgressionTrack from './BoxProgressionTrack';
import customStorage from '../../store/customStorage';
import brainApi, { recordEvent, EPISODE_TYPES } from '../../api/brainApi';
import learningPointApi, { RATINGS } from '../../api/learningPointApi';

// Icons
import RefreshIcon from '@mui/icons-material/Refresh';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import AbcIcon from '@mui/icons-material/Abc';
import NotesIcon from '@mui/icons-material/Notes';
import FunctionsIcon from '@mui/icons-material/Functions';

import './FlipCard.css';
import './LeitnerSystem.css';

// Color palette for Leitner boxes
const BOX_COLORS = [
  { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828', gradient: 'linear-gradient(135deg, #FF6B6B, #F44336)' },
  { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100', gradient: 'linear-gradient(135deg, #FFB347, #FF9800)' },
  { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00', gradient: 'linear-gradient(135deg, #FFD700, #FFC107)' },
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32', gradient: 'linear-gradient(135deg, #69F0AE, #4CAF50)' },
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0', gradient: 'linear-gradient(135deg, #64B5F6, #2196F3)' },
];

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

function LeitnerSystem({
  addItem,
  initialDomainTypes = null,
  planId = null,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorPalette = isDark ? BOX_COLORS_DARK : BOX_COLORS;

  const [cards, setCards] = useState([]);
  const [animatingCard, setAnimatingCard] = useState(null);
  const [animationState, setAnimationState] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [domainFilter, setDomainFilter] = useState(
    initialDomainTypes?.[0] || DOMAIN_FILTERS.ALL
  );
  const [isLoading, setIsLoading] = useState(true);

  // Add new item when provided
  useEffect(() => {
    if (addItem) {
      setCards((prev) => [...prev, learningPointToCard(addItem)]);
    }
  }, [addItem]);

  // Load cards from learning_point table
  useEffect(() => {
    async function loadCards() {
      setIsLoading(true);
      try {
        const token = await customStorage.getToken();
        const items = await learningPointApi.getDueItems({
          token,
          limit: 300,
          domainTypes: domainFilter === DOMAIN_FILTERS.ALL ? null : [domainFilter],
          planId,
        });

        const cardList = (items || []).map(learningPointToCard);
        setCards(cardList);
        setCurrentCardIndex(0);
      } catch (err) {
        console.error('Failed to load learning points:', err);
        setCards([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadCards();
  }, [domainFilter, planId]);

  const handleCorrect = useCallback(async (id) => {
    const card = cards.find((m) => m.id === id);
    if (!card) return;

    const oldBox = card.leitnerItem.box;
    const cardName = getCardDisplayName(card);

    try {
      const token = await customStorage.getToken();
      const result = await learningPointApi.processReview(
        card.id,
        RATINGS.GOOD,
        0,
        token
      );

      if (!result.error) {
        const newBox = result.box || oldBox;

        // Calculate days overdue for scheduling insights
        const calculateDaysOverdue = (item) => {
          const nextReview = item?.leitnerItem?.nextReview || item?.nextReview;
          if (!nextReview) return 0;
          const now = new Date();
          const reviewDate = new Date(nextReview);
          if (reviewDate > now) return 0;
          return Math.floor((now - reviewDate) / (1000 * 60 * 60 * 24));
        };

        const daysOverdue = calculateDaysOverdue(card);
        const nextReview = card?.leitnerItem?.nextReview || card?.nextReview;

        // Record episode for brain
        recordEvent.reviewCompleted({
          conceptId: card.id,
          conceptName: cardName,
          rating: 3,
          wasCorrect: true,
          previousBox: oldBox,
          newBox: newBox,
          itemType: card.domainType,
          daysOverdue,
          wasOverdue: nextReview ? new Date(nextReview) < new Date() : false,
          sourceContext: {
            view: 'leitner',
            totalDueCards: cards.length,
          },
        });

        if (newBox > oldBox) {
          recordEvent.masteryChanged({
            itemId: card.id,
            itemName: cardName,
            itemType: card.domainType,
            direction: 'up',
            fromBox: oldBox,
            toBox: newBox,
            fullyLearned: result.fully_learned,
          });

          setAnimatingCard({ id, fromBox: oldBox, toBox: newBox });
          setAnimationState('fly-out-forward');

          setTimeout(() => {
            const updatedCard = { ...card, leitnerItem: { ...card.leitnerItem, box: newBox } };
            const remaining = cards.filter((m) => m.id !== id);
            setCards([...remaining, updatedCard]);
            setAnimatingCard(null);
            setAnimationState(null);
            setCurrentCardIndex(0);
          }, 500);
        } else {
          const updatedCard = { ...card, leitnerItem: { ...card.leitnerItem, skips: card.leitnerItem.skips + 1 } };
          const remaining = cards.filter((m) => m.id !== id);
          setCards([...remaining, updatedCard]);
          setCurrentCardIndex(0);
        }
      }
    } catch (err) {
      console.error('Failed to process correct review:', err);
    }
  }, [cards]);

  const handleIncorrect = useCallback(async (id, isFlip) => {
    const card = cards.find((m) => m.id === id);
    if (!card) return;

    const oldBox = card.leitnerItem.box;
    const cardName = getCardDisplayName(card);

    // If just flipping the card, only record flip count
    if (isFlip) {
      const updatedCard = { ...card, leitnerItem: { ...card.leitnerItem, flips: card.leitnerItem.flips + 1 } };
      const remaining = cards.filter((m) => m.id !== id);
      setCards([...remaining, updatedCard]);
      return;
    }

    try {
      const token = await customStorage.getToken();
      const result = await learningPointApi.processReview(
        card.id,
        RATINGS.AGAIN,
        0,
        token
      );

      if (!result.error) {
        const newBox = result.box || 1;

        // Calculate days overdue for scheduling insights
        const calculateDaysOverdue = (item) => {
          const nextReview = item?.leitnerItem?.nextReview || item?.nextReview;
          if (!nextReview) return 0;
          const now = new Date();
          const reviewDate = new Date(nextReview);
          if (reviewDate > now) return 0;
          return Math.floor((now - reviewDate) / (1000 * 60 * 60 * 24));
        };

        const daysOverdue = calculateDaysOverdue(card);
        const nextReview = card?.leitnerItem?.nextReview || card?.nextReview;

        // Record episode for brain
        recordEvent.reviewCompleted({
          conceptId: card.id,
          conceptName: cardName,
          rating: 1,
          wasCorrect: false,
          previousBox: oldBox,
          newBox: newBox,
          itemType: card.domainType,
          daysOverdue,
          wasOverdue: nextReview ? new Date(nextReview) < new Date() : false,
          sourceContext: {
            view: 'leitner',
            totalDueCards: cards.length,
          },
        });

        if (newBox < oldBox) {
          recordEvent.masteryChanged({
            itemId: card.id,
            itemName: cardName,
            itemType: card.domainType,
            direction: 'down',
            fromBox: oldBox,
            toBox: newBox,
          });

          setAnimatingCard({ id, fromBox: oldBox, toBox: newBox });
          setAnimationState('fly-out-backward');

          setTimeout(() => {
            const updatedCard = { ...card, leitnerItem: { ...card.leitnerItem, box: newBox } };
            const remaining = cards.filter((m) => m.id !== id);
            setCards([...remaining, updatedCard]);
            setAnimatingCard(null);
            setAnimationState(null);
            setCurrentCardIndex(0);
          }, 500);
        } else {
          const updatedCard = { ...card, leitnerItem: { ...card.leitnerItem, flips: card.leitnerItem.flips + 1 } };
          const remaining = cards.filter((m) => m.id !== id);
          setCards([...remaining, updatedCard]);
          setCurrentCardIndex(0);
        }
      }
    } catch (err) {
      console.error('Failed to process incorrect review:', err);
    }
  }, [cards]);

  const handleSkip = useCallback(() => {
    if (cards.length > 1) {
      const currentCard = cards[currentCardIndex];
      const cardName = getCardDisplayName(currentCard);

      // Record skip episode for brain
      brainApi.recordEpisode({
        eventType: EPISODE_TYPES.REVIEW_SKIPPED,
        payload: {
          conceptId: currentCard.id,
          conceptName: cardName,
          itemType: currentCard.domainType,
          currentBox: currentCard.leitnerItem?.box || 1,
        },
        sourceContext: {
          view: 'leitner',
          totalDueCards: cards.length,
        },
      });

      // Move current card to end of array
      const newCards = cards.filter((_, i) => i !== currentCardIndex);
      newCards.push(currentCard);
      setCards(newCards);
      setCurrentCardIndex(0);
    }
  }, [cards, currentCardIndex]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await customStorage.getToken();
      const items = await learningPointApi.getDueItems({
        token,
        limit: 300,
        domainTypes: domainFilter === DOMAIN_FILTERS.ALL ? null : [domainFilter],
        planId,
      });

      const cardList = (items || []).map(learningPointToCard);
      setCards(cardList);
      setCurrentCardIndex(0);
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setIsLoading(false);
    }
  }, [domainFilter, planId]);

  // Get box counts for the progression track
  const getBoxCounts = () => {
    const counts = [0, 0, 0, 0, 0];
    cards.forEach((card) => {
      const box = card.leitnerItem?.box || 1;
      if (box >= 1 && box <= 5) {
        counts[box - 1]++;
      }
    });
    return counts;
  };

  // Handle domain filter change
  const handleDomainFilterChange = (event, newFilter) => {
    if (newFilter) {
      setDomainFilter(newFilter);
    }
  };

  // Get current card
  const currentCard = cards.length > 0 ? cards[currentCardIndex] : null;
  const currentBoxNumber = currentCard?.leitnerItem?.box || 1;
  const boxCounts = getBoxCounts();
  const totalCards = cards.length;
  const isVocabulary = currentCard?.domainType === 'vocabulary' || currentCard?.word !== undefined;

  return (
    <Box className="leitner-container-v2">
      {/* Filter Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 1.5,
          px: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.3),
        }}
      >
        <ToggleButtonGroup
          value={domainFilter}
          exclusive
          onChange={handleDomainFilterChange}
          size="small"
          aria-label="domain type filter"
        >
          <ToggleButton value={DOMAIN_FILTERS.ALL} aria-label="all types">
            <Tooltip title="All Types">
              <AllInclusiveIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={DOMAIN_FILTERS.VOCABULARY} aria-label="vocabulary">
            <Tooltip title="Vocabulary">
              <AbcIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={DOMAIN_FILTERS.KNOWLEDGE} aria-label="knowledge">
            <Tooltip title="Knowledge">
              <NotesIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={DOMAIN_FILTERS.MATH} aria-label="math">
            <Tooltip title="Math">
              <FunctionsIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Tooltip title="Refresh">
          <span>
            <IconButton size="small" onClick={handleRefresh} disabled={isLoading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Typography variant="caption" color="text.secondary">
          {isLoading ? 'Loading...' : `${totalCards} items due`}
        </Typography>
      </Box>

      {/* Working Stage - Main Focus Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
          px: 2,
        }}
      >
        <WorkingStage
          currentCard={currentCard}
          currentBoxNumber={currentBoxNumber}
          boxColors={colorPalette}
          boxNames={BOX_NAMES}
          boxIntervals={BOX_INTERVALS}
          totalDueCards={totalCards}
          currentIndex={currentCardIndex}
          onCorrect={handleCorrect}
          onIncorrect={handleIncorrect}
          onSkip={handleSkip}
          isVocabulary={isVocabulary}
          animationState={animationState}
        />
      </Box>

      {/* Box Progression Track - Secondary Indicator */}
      <Box
        sx={{
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.5),
          py: 3,
          px: 2,
        }}
      >
        <BoxProgressionTrack
          boxCounts={boxCounts}
          activeBox={currentBoxNumber}
          boxColors={colorPalette}
          boxNames={BOX_NAMES}
          boxIntervals={BOX_INTERVALS}
          animatingToBox={animatingCard?.toBox}
        />
      </Box>
    </Box>
  );
}

export default LeitnerSystem;
