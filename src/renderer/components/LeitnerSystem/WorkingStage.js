import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SchoolIcon from '@mui/icons-material/School';

import FlipCard from './FlipCard';

/**
 * WorkingStage - The primary focus area for the current flashcard being studied
 *
 * This component provides a large, centered workspace for the active card,
 * with navigation controls and progress indicators.
 */
function WorkingStage({
  currentCard,
  currentBoxNumber,
  boxColors,
  boxNames,
  boxIntervals,
  totalDueCards,
  currentIndex,
  onCorrect,
  onIncorrect,
  onSkip,
  isVocabulary,
  animationState, // 'fly-out-forward' | 'fly-out-backward' | 'fly-in' | null
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const colors = boxColors[currentBoxNumber - 1] || boxColors[0];
  const boxName = boxNames[currentBoxNumber - 1] || 'New';
  const interval = boxIntervals[currentBoxNumber - 1] || '1 day';

  // Empty state when no cards to review
  if (!currentCard) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          p: 4,
        }}
      >
        <Box
          sx={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.success.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <EmojiEventsIcon
            sx={{
              fontSize: 60,
              color: theme.palette.success.main,
            }}
          />
        </Box>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            mb: 1,
          }}
        >
          All caught up!
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: theme.palette.text.secondary,
            textAlign: 'center',
            maxWidth: 300,
          }}
        >
          No cards due for review right now. Great job staying on top of your learning!
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: 500,
        mx: 'auto',
      }}
    >
      {/* Current Box Indicator */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
        }}
      >
        <Chip
          icon={<SchoolIcon sx={{ fontSize: 18 }} />}
          label={`Box ${currentBoxNumber} - ${boxName}`}
          sx={{
            background: colors.gradient,
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.875rem',
            height: 36,
            '& .MuiChip-icon': {
              color: '#fff',
            },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.secondary,
            bgcolor: alpha(theme.palette.divider, 0.1),
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
          }}
        >
          Review in {interval}
        </Typography>
      </Box>

      {/* Progress Counter */}
      <Typography
        variant="body2"
        sx={{
          color: theme.palette.text.secondary,
          mb: 2,
        }}
      >
        Card {currentIndex + 1} of {totalDueCards}
      </Typography>

      {/* Main Card Area */}
      <Box
        sx={{
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Card Glow Effect */}
        <Box
          sx={{
            position: 'absolute',
            inset: -20,
            background: `radial-gradient(ellipse at center, ${alpha(colors.accent, 0.15)} 0%, transparent 70%)`,
            borderRadius: 4,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

        {/* FlipCard Container with Animation */}
        <Box
          className={`working-stage-card ${animationState ? `card-${animationState}` : ''}`}
          sx={{
            position: 'relative',
            zIndex: 1,
            transform: 'scale(1)',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'scale(1.02)',
            },
          }}
        >
          <FlipCard
            card={currentCard}
            onCorrect={onCorrect}
            onIncorrect={onIncorrect}
            isVocabulary={isVocabulary}
            boxColor={colors}
          />
        </Box>
      </Box>

      {/* Skip Button */}
      {totalDueCards > 1 && (
        <Tooltip title="Skip to next card" arrow>
          <IconButton
            onClick={onSkip}
            sx={{
              mt: 2,
              color: theme.palette.text.secondary,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
              },
            }}
          >
            <SkipNextIcon />
            <Typography variant="caption" sx={{ ml: 0.5 }}>
              Skip
            </Typography>
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

export default WorkingStage;
