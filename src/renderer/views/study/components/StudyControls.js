/**
 * StudyControls.js
 *
 * Rating buttons and control panel for study sessions.
 * Provides the 4-point rating system (Again, Hard, Good, Easy).
 */

import React from 'react';
import { Box, Button, IconButton, Tooltip, Typography, Fade } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  Flip as FlipIcon,
  SkipNext as SkipIcon,
  Lightbulb as HintIcon,
  Replay as AgainIcon,
  ThumbDown as HardIcon,
  ThumbUp as GoodIcon,
  Bolt as EasyIcon,
  VolumeUp as PronounceIcon,
} from '@mui/icons-material';

import { RATINGS } from '../hooks/useStudySession';

// Styled components
const ControlsContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 600,
  marginTop: theme.spacing(3),
}));

const FrontControls = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const BackControls = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const RatingButtonsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(1),
  [theme.breakpoints.down('sm')]: {
    flexWrap: 'wrap',
  },
}));

const RatingButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'ratingColor',
})(({ theme, ratingColor }) => ({
  flex: 1,
  maxWidth: 130,
  minWidth: 90,
  height: 64,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  borderRadius: 12,
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.8rem',
  color: ratingColor,
  backgroundColor: alpha(ratingColor, 0.08),
  border: `1px solid ${alpha(ratingColor, 0.2)}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: alpha(ratingColor, 0.15),
    transform: 'translateY(-2px)',
    boxShadow: `0 4px 12px ${alpha(ratingColor, 0.25)}`,
  },
  '&:active': {
    transform: 'translateY(0)',
  },
}));

const SecondaryControls = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(1),
}));

const FlipButton = styled(Button)(({ theme }) => ({
  borderRadius: 12,
  padding: theme.spacing(1.5, 4),
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '1rem',
}));

// Rating config
const RATING_CONFIG = {
  [RATINGS.AGAIN]: {
    label: 'Again',
    sublabel: '< 1 min',
    icon: AgainIcon,
    color: '#f44336',
    key: '1',
  },
  [RATINGS.HARD]: {
    label: 'Hard',
    sublabel: '~10 min',
    icon: HardIcon,
    color: '#ff9800',
    key: '2',
  },
  [RATINGS.GOOD]: {
    label: 'Good',
    sublabel: '~1 day',
    icon: GoodIcon,
    color: '#4caf50',
    key: '3',
  },
  [RATINGS.EASY]: {
    label: 'Easy',
    sublabel: '~4 days',
    icon: EasyIcon,
    color: '#2196f3',
    key: '4',
  },
};

function StudyControls({
  isFlipped,
  onFlip,
  onRate,
  onSkip,
  onHint,
  onPronounce,
  disabled = false,
  hintAvailable = true,
  hintLevel = 0,
  maxHintLevels = 4,
}) {
  if (disabled) {
    return null;
  }

  // Front side controls (before flip)
  if (!isFlipped) {
    return (
      <ControlsContainer>
        <FrontControls>
          {/* Pronounce button */}
          <Tooltip title="Pronounce (R)" arrow>
            <IconButton
              onClick={onPronounce}
              sx={{
                bgcolor: (theme) => alpha(theme.palette.info.main, 0.1),
                color: 'info.main',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.info.main, 0.2),
                },
              }}
            >
              <PronounceIcon />
            </IconButton>
          </Tooltip>

          {/* Hint button with level indicator */}
          <Tooltip
            title={hintAvailable ? `Show hint (H) - Level ${hintLevel + 1}/${maxHintLevels}` : 'No more hints'}
            arrow
          >
            <span>
              <IconButton
                onClick={onHint}
                disabled={!hintAvailable}
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.warning.main, hintAvailable ? 0.1 : 0.05),
                  color: hintAvailable ? 'warning.main' : 'text.disabled',
                  position: 'relative',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.warning.main, 0.2),
                  },
                }}
              >
                <HintIcon />
                {hintLevel > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      bgcolor: 'warning.main',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {hintLevel}
                  </Box>
                )}
              </IconButton>
            </span>
          </Tooltip>

          <FlipButton
            variant="contained"
            startIcon={<FlipIcon />}
            onClick={onFlip}
            sx={{
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            Show Answer
          </FlipButton>

          <Tooltip title="Skip (S)" arrow>
            <IconButton
              onClick={onSkip}
              sx={{
                bgcolor: (theme) => alpha(theme.palette.grey[500], 0.1),
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.grey[500], 0.2),
                },
              }}
            >
              <SkipIcon />
            </IconButton>
          </Tooltip>
        </FrontControls>
      </ControlsContainer>
    );
  }

  // Back side controls (after flip)
  return (
    <Fade in={isFlipped}>
      <ControlsContainer>
        <BackControls>
          {/* Rating buttons */}
          <RatingButtonsRow>
            {Object.entries(RATING_CONFIG).map(([rating, config]) => {
              const Icon = config.icon;
              return (
                <Tooltip
                  key={rating}
                  title={`${config.label} (${config.key})`}
                  arrow
                  placement="top"
                >
                  <RatingButton
                    ratingColor={config.color}
                    onClick={() => onRate(parseInt(rating, 10))}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', fontWeight: 600, lineHeight: 1.2 }}
                      >
                        {config.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          fontSize: '0.6rem',
                          opacity: 0.7,
                          lineHeight: 1,
                        }}
                      >
                        {config.sublabel}
                      </Typography>
                    </Box>
                  </RatingButton>
                </Tooltip>
              );
            })}
          </RatingButtonsRow>

          {/* Secondary controls */}
          <SecondaryControls>
            <Tooltip title="Flip back (Space)" arrow>
              <IconButton
                onClick={onFlip}
                size="small"
                sx={{
                  color: 'text.secondary',
                }}
              >
                <FlipIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Skip (S)" arrow>
              <IconButton
                onClick={onSkip}
                size="small"
                sx={{
                  color: 'text.secondary',
                }}
              >
                <SkipIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </SecondaryControls>

          {/* Keyboard hint */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">
              Keyboard: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
            </Typography>
          </Box>
        </BackControls>
      </ControlsContainer>
    </Fade>
  );
}

export default StudyControls;
