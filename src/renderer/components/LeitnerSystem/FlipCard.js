import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FlipIcon from '@mui/icons-material/Flip';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import LinkIcon from '@mui/icons-material/Link';

import './FlipCard.css';
import NoteUI from '../note/NoteUI';

// Debounce function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

function FlipCard({ card, isVocabulary, onCorrect, onIncorrect, boxColor }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCorrectAnimating, setIsCorrectAnimating] = useState(false);
  const [isIncorrectAnimating, setIsIncorrectAnimating] = useState(false);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const updateSize = () => {
    if (containerRef.current) {
      const { offsetWidth, offsetHeight } = containerRef.current;
      setSize({ width: offsetWidth, height: offsetHeight });
    }
  };
  const debouncedUpdateSize = debounce(updateSize, 200);

  useEffect(() => {
    updateSize();
    window.addEventListener('resize', debouncedUpdateSize);
    return () => {
      window.removeEventListener('resize', debouncedUpdateSize);
    };
  }, []);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    onIncorrect(card.id, true);
  };

  const handleCorrect = () => {
    setIsCorrectAnimating(true);
    setTimeout(() => {
      setIsCorrectAnimating(false);
      setIsFlipped(false);
      onCorrect(card.id);
    }, 400);
  };

  const handleIncorrect = () => {
    setIsIncorrectAnimating(true);
    setTimeout(() => {
      setIsIncorrectAnimating(false);
      setIsFlipped(false);
      onIncorrect(card.id, false);
    }, 400);
  };

  const accentColor = boxColor?.accent || theme.palette.primary.main;
  const bgColor = boxColor?.bg || alpha(theme.palette.primary.main, 0.05);

  // Dynamic font size based on word length
  const getWordFontSize = (word) => {
    if (!word) return '1.8rem';
    const len = word.length;
    if (len <= 6) return '2rem';
    if (len <= 10) return '1.6rem';
    if (len <= 14) return '1.3rem';
    if (len <= 18) return '1.1rem';
    return '0.95rem';
  };

  const wordFontSize = getWordFontSize(card?.word);

  if (isVocabulary) {
    return (
      <div
        className={`flip-card ${isFlipped ? 'flipped' : ''} ${isCorrectAnimating ? 'correct-pulse' : ''} ${isIncorrectAnimating ? 'incorrect-shake' : ''}`}
      >
        <div className="flip-card-inner">
          {/* Front Side - Question */}
          <div className="flip-card-front">
            <Box
              sx={{
                bgcolor: theme.palette.background.paper,
                borderRadius: 3,
                overflow: 'hidden',
                boxShadow: `0 4px 20px ${alpha('#000', isDark ? 0.3 : 0.1)}`,
                border: `1px solid ${alpha(accentColor, 0.2)}`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Card Header */}
              <Box
                sx={{
                  background: boxColor?.gradient || `linear-gradient(135deg, ${accentColor}, ${alpha(accentColor, 0.7)})`,
                  px: 2,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoStoriesIcon sx={{ color: '#fff', fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: alpha('#fff', 0.9), fontWeight: 600 }}>
                    What does this word mean?
                  </Typography>
                </Box>
                <Chip
                  label={`Box ${card.leitnerItem?.box || 1}`}
                  size="small"
                  sx={{
                    bgcolor: alpha('#fff', 0.2),
                    color: '#fff',
                    fontSize: '0.65rem',
                    height: 20,
                  }}
                />
              </Box>

              {/* Card Content */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 2,
                  minHeight: 100,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: wordFontSize,
                    color: theme.palette.text.primary,
                    textAlign: 'center',
                    lineHeight: 1.2,
                    wordBreak: 'keep-all',
                    overflowWrap: 'normal',
                  }}
                >
                  {card.word}
                </Typography>
              </Box>

              {/* Card Actions */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  px: 2,
                  py: 1.5,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  bgcolor: alpha(bgColor, 0.3),
                }}
              >
                <Tooltip title="I know this!" arrow>
                  <IconButton
                    onClick={handleCorrect}
                    sx={{
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      color: theme.palette.success.main,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.success.main, 0.2),
                        transform: 'scale(1.1)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <CheckCircleIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Flip to see answer" arrow>
                  <IconButton
                    onClick={handleFlip}
                    sx={{
                      bgcolor: alpha(accentColor, 0.1),
                      color: accentColor,
                      px: 3,
                      borderRadius: 2,
                      '&:hover': {
                        bgcolor: alpha(accentColor, 0.2),
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <FlipIcon sx={{ mr: 0.5 }} />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Flip
                    </Typography>
                  </IconButton>
                </Tooltip>

                <Box sx={{ width: 40 }} /> {/* Spacer for balance */}
              </Box>
            </Box>
          </div>

          {/* Back Side - Answer */}
          <div className="flip-card-back">
            <Box
              sx={{
                bgcolor: theme.palette.background.paper,
                borderRadius: 3,
                overflow: 'hidden',
                boxShadow: `0 4px 20px ${alpha('#000', isDark ? 0.3 : 0.1)}`,
                border: `1px solid ${alpha(accentColor, 0.2)}`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Card Header */}
              <Box
                sx={{
                  background: boxColor?.gradient || `linear-gradient(135deg, ${accentColor}, ${alpha(accentColor, 0.7)})`,
                  px: 2,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <LightbulbIcon sx={{ color: '#fff', fontSize: 18 }} />
                <Typography variant="caption" sx={{ color: alpha('#fff', 0.9), fontWeight: 600 }}>
                  Definition
                </Typography>
              </Box>

              {/* Card Content */}
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  overflowY: 'auto',
                  maxHeight: 180,
                }}
              >
                {/* Word */}
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: accentColor,
                    mb: 1,
                  }}
                >
                  {card.word}
                </Typography>

                {/* Definition */}
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.primary,
                    mb: 1.5,
                    lineHeight: 1.6,
                  }}
                >
                  {card.definition || 'No definition available'}
                </Typography>

                {/* Related Words */}
                {card.relatedWords && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <LinkIcon sx={{ fontSize: 16, color: theme.palette.text.disabled, mt: 0.3 }} />
                    <Typography variant="caption" color="text.secondary">
                      <strong>Related:</strong> {card.relatedWords}
                    </Typography>
                  </Box>
                )}

                {/* Example */}
                {card.example && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      p: 1.5,
                      bgcolor: alpha(accentColor, 0.05),
                      borderRadius: 2,
                      borderLeft: `3px solid ${accentColor}`,
                    }}
                  >
                    <FormatQuoteIcon sx={{ fontSize: 16, color: accentColor, mt: 0.3 }} />
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}
                    >
                      {card.example}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Card Actions */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  px: 2,
                  py: 1.5,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  bgcolor: alpha(bgColor, 0.3),
                }}
              >
                <Tooltip title="Got it!" arrow>
                  <IconButton
                    onClick={handleCorrect}
                    sx={{
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      color: theme.palette.success.main,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.success.main, 0.2),
                        transform: 'scale(1.1)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <CheckCircleIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Flip back" arrow>
                  <IconButton
                    onClick={handleFlip}
                    sx={{
                      bgcolor: alpha(accentColor, 0.1),
                      color: accentColor,
                      '&:hover': {
                        bgcolor: alpha(accentColor, 0.2),
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <FlipIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Need more practice" arrow>
                  <IconButton
                    onClick={handleIncorrect}
                    sx={{
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                      color: theme.palette.error.main,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.error.main, 0.2),
                        transform: 'scale(1.1)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </div>
        </div>
      </div>
    );
  }

  // Notes mode (non-vocabulary)
  return (
    <div
      ref={containerRef}
      className={`flip-card-note ${isCorrectAnimating ? 'correct-pulse' : ''} ${isIncorrectAnimating ? 'incorrect-shake' : ''}`}
      style={{ width: '100%', height: '100%' }}
    >
      <Box
        sx={{
          bgcolor: theme.palette.background.paper,
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: `0 4px 20px ${alpha('#000', isDark ? 0.3 : 0.1)}`,
          border: `1px solid ${alpha(accentColor, 0.2)}`,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Note Content */}
        <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
          <NoteUI
            key={card.id}
            selectedNoteKey={card.id}
            selectHandler={() => {}}
            compactView
            showControl={false}
            useBgColor
            cardWidth={size.width - 40}
            cardHeight={size.height - 100}
          />
        </Box>

        {/* Card Actions */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 2,
            py: 1.5,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: alpha(bgColor, 0.3),
          }}
        >
          <Tooltip title="I remember this!" arrow>
            <IconButton
              onClick={handleCorrect}
              sx={{
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: theme.palette.success.main,
                '&:hover': {
                  bgcolor: alpha(theme.palette.success.main, 0.2),
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <CheckCircleIcon />
            </IconButton>
          </Tooltip>

          <Chip
            label={`Box ${card.leitnerItem?.box || 1}`}
            size="small"
            sx={{
              bgcolor: alpha(accentColor, 0.1),
              color: accentColor,
              fontWeight: 600,
            }}
          />

          <Tooltip title="Need more review" arrow>
            <IconButton
              onClick={handleIncorrect}
              sx={{
                bgcolor: alpha(theme.palette.error.main, 0.1),
                color: theme.palette.error.main,
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.2),
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <CancelIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </div>
  );
}

export default FlipCard;
