import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

/**
 * BoxProgressionTrack - Compact horizontal indicator showing all 5 Leitner boxes
 *
 * Displays the progression path with card counts and highlights the active box.
 * Designed to be a secondary UI element that doesn't compete with the WorkingStage.
 */
function BoxProgressionTrack({
  boxCounts, // Array of 5 numbers: cards in each box
  activeBox, // 1-5, currently active box (where current card is from)
  boxColors,
  boxNames,
  boxIntervals,
  onBoxClick, // Optional: callback when a box is clicked
  animatingToBox, // Box number that's receiving a card (for animation)
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const totalCards = boxCounts.reduce((a, b) => a + b, 0);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 700,
        mx: 'auto',
        mt: 4,
      }}
    >
      {/* Section Header */}
      <Typography
        variant="caption"
        sx={{
          color: theme.palette.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: 600,
          mb: 2,
          display: 'block',
          textAlign: 'center',
        }}
      >
        Learning Progress • {totalCards} cards in review
      </Typography>

      {/* Box Track */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.5, sm: 1 },
          flexWrap: 'nowrap',
          overflowX: 'auto',
          pb: 1,
          px: 1,
        }}
      >
        {[1, 2, 3, 4, 5].map((boxNumber) => {
          const boxIndex = boxNumber - 1;
          const colors = boxColors[boxIndex];
          const count = boxCounts[boxIndex] || 0;
          const isActive = boxNumber === activeBox;
          const isReceiving = boxNumber === animatingToBox;
          const boxName = boxNames[boxIndex];
          const interval = boxIntervals[boxIndex];

          return (
            <React.Fragment key={boxNumber}>
              {/* Box Indicator */}
              <Tooltip
                title={
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {boxName}
                    </Typography>
                    <Typography variant="caption">
                      {count} card{count !== 1 ? 's' : ''} • Review in {interval}
                    </Typography>
                  </Box>
                }
                arrow
                placement="top"
              >
                <Box
                  onClick={() => onBoxClick?.(boxNumber)}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: onBoxClick ? 'pointer' : 'default',
                    transition: 'all 0.3s ease',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    '&:hover': {
                      transform: isActive ? 'scale(1.15)' : 'scale(1.05)',
                    },
                  }}
                >
                  {/* Box Circle */}
                  <Box
                    className={isReceiving ? 'box-receiving' : ''}
                    sx={{
                      width: { xs: 48, sm: 56 },
                      height: { xs: 48, sm: 56 },
                      borderRadius: '50%',
                      background: isActive
                        ? colors.gradient
                        : count > 0
                          ? alpha(colors.accent, 0.15)
                          : alpha(theme.palette.divider, 0.1),
                      border: `3px solid ${
                        isActive
                          ? colors.accent
                          : count > 0
                            ? alpha(colors.accent, 0.3)
                            : alpha(theme.palette.divider, 0.2)
                      }`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: isActive
                        ? `0 4px 20px ${alpha(colors.accent, 0.4)}`
                        : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {/* Box Number or Trophy for last box */}
                    {boxNumber === 5 ? (
                      <EmojiEventsIcon
                        sx={{
                          fontSize: { xs: 18, sm: 22 },
                          color: isActive ? '#fff' : colors.icon,
                        }}
                      />
                    ) : (
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: { xs: '1rem', sm: '1.2rem' },
                          color: isActive ? '#fff' : colors.icon,
                          lineHeight: 1,
                        }}
                      >
                        {boxNumber}
                      </Typography>
                    )}

                    {/* Card Count Badge */}
                    {count > 0 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          minWidth: 20,
                          height: 20,
                          borderRadius: 10,
                          bgcolor: isActive ? '#fff' : colors.accent,
                          color: isActive ? colors.accent : '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          px: 0.5,
                          boxShadow: `0 2px 6px ${alpha('#000', 0.2)}`,
                        }}
                      >
                        {count > 99 ? '99+' : count}
                      </Box>
                    )}
                  </Box>

                  {/* Box Label */}
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 0.5,
                      color: isActive ? colors.accent : theme.palette.text.secondary,
                      fontWeight: isActive ? 600 : 400,
                      fontSize: { xs: '0.6rem', sm: '0.7rem' },
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {boxName}
                  </Typography>
                </Box>
              </Tooltip>

              {/* Arrow Between Boxes */}
              {boxNumber < 5 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: { xs: 0.25, sm: 0.5 },
                    opacity: 0.4,
                  }}
                >
                  <ArrowForwardIcon
                    sx={{
                      fontSize: { xs: 14, sm: 18 },
                      color: theme.palette.text.disabled,
                    }}
                  />
                </Box>
              )}
            </React.Fragment>
          );
        })}
      </Box>

      {/* Progress Bar */}
      <Box
        sx={{
          mt: 2,
          mx: 'auto',
          maxWidth: 400,
          height: 6,
          borderRadius: 3,
          bgcolor: alpha(theme.palette.divider, 0.1),
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {boxCounts.map((count, index) => {
          const colors = boxColors[index];
          const width = totalCards > 0 ? (count / totalCards) * 100 : 0;

          return (
            <Box
              key={index}
              sx={{
                width: `${width}%`,
                height: '100%',
                bgcolor: colors.accent,
                transition: 'width 0.5s ease',
              }}
            />
          );
        })}
      </Box>

      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          mt: 1.5,
          flexWrap: 'wrap',
        }}
      >
        {boxColors.slice(0, 3).map((colors, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: colors.accent,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.65rem',
              }}
            >
              {boxNames[index]}
            </Typography>
          </Box>
        ))}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <EmojiEventsIcon
            sx={{
              fontSize: 12,
              color: boxColors[4].accent,
            }}
          />
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.65rem',
            }}
          >
            Mastered
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default BoxProgressionTrack;
