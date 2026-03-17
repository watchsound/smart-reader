/**
 * UniversalCard.js
 *
 * Unified card component that renders ALL learning content types.
 * Auto-detects rendering mode from item content:
 * - text: Simple vocabulary flip card
 * - stem: MathJax + answer input + verification
 * - quiz: Embedded quiz component
 * - mindmap: Mindmap visualization
 * - image: Image with caption
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Box, Typography, Chip, Fade, IconButton, CircularProgress } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  AutoStories as QuestionIcon,
  Lightbulb as AnswerIcon,
  LocalOffer as TagIcon,
  VolumeUp as PronounceIcon,
  Functions as FormulaIcon,
  Code as CodeIcon,
  Quiz as QuizIcon,
  AccountTree as MindmapIcon,
  Image as ImageIcon,
} from '@mui/icons-material';

import CardContentRenderer from './CardContentRenderer';

// Import CSS from existing FlipCard
import '../LeitnerSystem/FlipCard.css';

// Domain colors (matching LearningPlanWizard and StudyCard)
const DOMAIN_COLORS = {
  vocabulary: { primary: '#4CAF50', gradient: 'linear-gradient(135deg, #4CAF50, #81C784)' },
  math: { primary: '#2196F3', gradient: 'linear-gradient(135deg, #2196F3, #64B5F6)' },
  language: { primary: '#9C27B0', gradient: 'linear-gradient(135deg, #9C27B0, #BA68C8)' },
  knowledge: { primary: '#FF9800', gradient: 'linear-gradient(135deg, #FF9800, #FFB74D)' },
  skill: { primary: '#00BCD4', gradient: 'linear-gradient(135deg, #00BCD4, #4DD0E1)' },
};

// Source type colors
const SOURCE_COLORS = {
  vocabulary: { primary: '#4CAF50', light: '#E8F5E9' },
  note: { primary: '#FF9800', light: '#FFF3E0' },
  plan: { primary: '#2196F3', light: '#E3F2FD' },
};

// Item type icons
const ITEM_TYPE_ICONS = {
  word: QuestionIcon,
  concept: QuestionIcon,
  formula: FormulaIcon,
  problem: FormulaIcon,
  code: CodeIcon,
  quiz: QuizIcon,
  mindmap: MindmapIcon,
  image: ImageIcon,
};

// Dynamic font size based on content length
const getContentFontSize = (text, isLong = false) => {
  if (!text) return '1.5rem';
  const len = typeof text === 'string' ? text.length : 50;

  if (isLong) {
    if (len <= 50) return '1.1rem';
    if (len <= 100) return '1rem';
    if (len <= 200) return '0.95rem';
    return '0.9rem';
  }

  if (len <= 20) return '2rem';
  if (len <= 40) return '1.6rem';
  if (len <= 60) return '1.3rem';
  if (len <= 100) return '1.1rem';
  return '1rem';
};

/**
 * Detect the rendering mode from item content
 */
const detectRenderMode = (item) => {
  if (!item) return 'text';

  // Check for STEM features
  if (
    item.extras?.solution ||
    item.itemType === 'formula' ||
    item.itemType === 'problem' ||
    item.domainType === 'math' ||
    item.domainType === 'skill'
  ) {
    return 'stem';
  }

  // Check for quiz
  if (item.extras?.quiz || item.extras?.hasQuiz || item.itemType === 'quiz') {
    return 'quiz';
  }

  // Check for mindmap
  if (
    item.extras?.mindmap ||
    item.itemType === 'mindmap' ||
    item.extras?.cards?.some((c) => c.type === 'mindmap')
  ) {
    return 'mindmap';
  }

  // Check for image content
  if (
    item.itemType === 'image' ||
    item.extras?.images?.length > 0 ||
    (typeof item.front === 'object' && item.front?.image)
  ) {
    return 'image';
  }

  // Default to text mode
  return 'text';
};

/**
 * Get the front text from item (handles different formats)
 */
const getFrontText = (item) => {
  if (!item) return '';
  if (typeof item.front === 'string') return item.front;
  if (typeof item.front === 'object') {
    return item.front.text || item.front.html || '';
  }
  return '';
};

/**
 * Get the back text from item (handles different formats)
 */
const getBackText = (item) => {
  if (!item) return '';
  if (typeof item.back === 'string') return item.back;
  if (typeof item.back === 'object') {
    return item.back.text || item.back.html || '';
  }
  return '';
};

/**
 * UniversalCard Component
 */
function UniversalCard({
  item,
  isFlipped = false,
  onFlip,
  hint = null,
  hintLevel = 0,
  hintLoading = false,
  onPronounce,
  animationClass = '',
  // STEM mode props
  onAnswerChange,
  onVerify,
  answer = '',
  verificationResult = null,
  isVerifying = false,
  showSolution = false,
  currentSolutionStep = 0,
  onRevealNextStep,
  // Canvas props
  showCanvas = false,
  onCanvasToggle,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Detect render mode
  const renderMode = useMemo(() => detectRenderMode(item), [item]);

  // Get domain color (fallback to source type color)
  const domainColor = useMemo(() => {
    if (item?.domainType && DOMAIN_COLORS[item.domainType]) {
      return DOMAIN_COLORS[item.domainType].primary;
    }
    if (item?.sourceType && SOURCE_COLORS[item.sourceType]) {
      return SOURCE_COLORS[item.sourceType].primary;
    }
    return theme.palette.primary.main;
  }, [item?.domainType, item?.sourceType, theme.palette.primary.main]);

  const domainGradient = useMemo(() => {
    if (item?.domainType && DOMAIN_COLORS[item.domainType]) {
      return DOMAIN_COLORS[item.domainType].gradient;
    }
    return `linear-gradient(135deg, ${domainColor}, ${alpha(domainColor, 0.7)})`;
  }, [item?.domainType, domainColor]);

  // Get item type icon
  const ItemTypeIcon = useMemo(() => {
    return ITEM_TYPE_ICONS[item?.itemType] || QuestionIcon;
  }, [item?.itemType]);

  // Box level indicator
  const boxLevel = item?.box || 1;
  const boxLabels = ['New', 'Learning', 'Reviewing', 'Familiar', 'Mastered'];
  const boxLabel = boxLabels[Math.min(boxLevel - 1, 4)];

  // Source type badge
  const sourceLabel = useMemo(() => {
    switch (item?.sourceType) {
      case 'vocabulary':
        return 'Vocab';
      case 'note':
        return 'Note';
      case 'plan':
        return 'Plan';
      default:
        return '';
    }
  }, [item?.sourceType]);

  // Mode label for header
  const modeLabel = useMemo(() => {
    switch (renderMode) {
      case 'stem':
        return item?.itemType === 'formula' ? 'FORMULA' : 'PROBLEM';
      case 'quiz':
        return 'QUIZ';
      case 'mindmap':
        return 'CONCEPT MAP';
      case 'image':
        return 'VISUAL';
      default:
        return item?.difficulty === 'hard' ? 'CHALLENGE' : 'QUESTION';
    }
  }, [renderMode, item?.itemType, item?.difficulty]);

  if (!item) return null;

  const frontText = getFrontText(item);
  const backText = getBackText(item);

  return (
    <div
      className={`flip-card ${isFlipped ? 'flipped' : ''} ${animationClass || ''}`}
      onClick={!isFlipped && renderMode === 'text' ? onFlip : undefined}
      style={{ cursor: !isFlipped && renderMode === 'text' ? 'pointer' : 'default' }}
    >
      <div className="flip-card-inner">
        {/* Front Side */}
        <div className="flip-card-front">
          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: `0 8px 32px ${alpha('#000', isDark ? 0.4 : 0.15)}`,
              border: `1px solid ${alpha(domainColor, 0.2)}`,
              height: '100%',
              minHeight: 280,
              display: 'flex',
              flexDirection: 'column',
              transition: 'box-shadow 0.3s ease',
              '&:hover': {
                boxShadow: `0 12px 40px ${alpha(domainColor, 0.25)}`,
              },
            }}
          >
            {/* Card Header */}
            <Box
              sx={{
                background: domainGradient,
                px: 2,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ItemTypeIcon sx={{ color: '#fff', fontSize: 20 }} />
                <Typography
                  variant="caption"
                  sx={{ color: alpha('#fff', 0.95), fontWeight: 600, letterSpacing: 0.5 }}
                >
                  {modeLabel}
                </Typography>
                {sourceLabel && (
                  <Chip
                    label={sourceLabel}
                    size="small"
                    sx={{
                      bgcolor: alpha('#fff', 0.2),
                      color: '#fff',
                      fontSize: '0.6rem',
                      height: 18,
                      fontWeight: 500,
                    }}
                  />
                )}
              </Box>
              <Chip
                label={`Box ${boxLevel} · ${boxLabel}`}
                size="small"
                sx={{
                  bgcolor: alpha('#fff', 0.2),
                  color: '#fff',
                  fontSize: '0.65rem',
                  height: 22,
                  fontWeight: 600,
                }}
              />
            </Box>

            {/* Card Content - Front */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
                minHeight: 180,
              }}
            >
              <CardContentRenderer
                item={item}
                mode={renderMode}
                side="front"
                domainColor={domainColor}
                // STEM props
                answer={answer}
                onAnswerChange={onAnswerChange}
                onVerify={onVerify}
                verificationResult={verificationResult}
                isVerifying={isVerifying}
              />

              {/* Hint display */}
              {(hint || hintLoading) && (
                <Fade in>
                  <Box
                    sx={{
                      mt: 2,
                      p: 1.5,
                      bgcolor: alpha(domainColor, 0.08),
                      borderRadius: 2,
                      border: `1px dashed ${alpha(domainColor, 0.3)}`,
                      minHeight: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                    }}
                  >
                    {hintLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={14} sx={{ color: domainColor }} />
                        <Typography variant="caption" sx={{ color: domainColor }}>
                          Generating hint...
                        </Typography>
                      </Box>
                    ) : (
                      <Typography
                        variant="caption"
                        sx={{ color: domainColor, fontStyle: 'italic' }}
                      >
                        Hint {hintLevel > 1 ? `(Level ${hintLevel})` : ''}: {hint}
                      </Typography>
                    )}
                  </Box>
                </Fade>
              )}
            </Box>

            {/* Footer hint */}
            <Box
              sx={{
                py: 1.5,
                px: 2,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                bgcolor: alpha(domainColor, 0.03),
                textAlign: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {renderMode === 'stem'
                  ? 'Enter your answer and click Check'
                  : 'Press Space or click to reveal answer'}
              </Typography>
            </Box>
          </Box>
        </div>

        {/* Back Side */}
        <div className="flip-card-back">
          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: `0 8px 32px ${alpha('#000', isDark ? 0.4 : 0.15)}`,
              border: `1px solid ${alpha(domainColor, 0.2)}`,
              height: '100%',
              minHeight: 280,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Card Header */}
            <Box
              sx={{
                background: domainGradient,
                px: 2,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <AnswerIcon sx={{ color: '#fff', fontSize: 20 }} />
              <Typography
                variant="caption"
                sx={{ color: alpha('#fff', 0.95), fontWeight: 600, letterSpacing: 0.5 }}
              >
                ANSWER
              </Typography>
            </Box>

            {/* Card Content - Back */}
            <Box
              sx={{
                flex: 1,
                p: 3,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Front reminder (smaller) */}
              <Typography
                variant="subtitle2"
                sx={{
                  color: domainColor,
                  fontWeight: 600,
                  mb: 1.5,
                  pb: 1.5,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                {frontText}
              </Typography>

              {/* Back content */}
              <CardContentRenderer
                item={item}
                mode={renderMode}
                side="back"
                domainColor={domainColor}
                showSolution={showSolution}
                currentSolutionStep={currentSolutionStep}
                onRevealNextStep={onRevealNextStep}
              />

              {/* Tags */}
              {item.tags?.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    mt: 2,
                    pt: 1.5,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  }}
                >
                  <TagIcon sx={{ fontSize: 14, color: theme.palette.text.disabled, mr: 0.5 }} />
                  {item.tags.slice(0, 3).map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: alpha(domainColor, 0.1),
                        color: domainColor,
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* Footer - Rating instruction */}
            <Box
              sx={{
                py: 1.5,
                px: 2,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                bgcolor: alpha(domainColor, 0.03),
                textAlign: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                How well did you know this? Rate below or use keys 1-4
              </Typography>
            </Box>
          </Box>
        </div>
      </div>
    </div>
  );
}

export default UniversalCard;
