/**
 * StudyCard.js
 *
 * Flip card component for study sessions.
 * Extends the existing FlipCard pattern with enhanced styling for learning points.
 */

import React, { useMemo } from 'react';
import { Box, Typography, Chip, Fade, IconButton, CircularProgress } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  AutoStories as QuestionIcon,
  Lightbulb as AnswerIcon,
  LocalOffer as TagIcon,
  VolumeUp as PronounceIcon,
} from '@mui/icons-material';

// Import CSS from existing FlipCard
import '../../../components/LeitnerSystem/FlipCard.css';

// Domain colors (matching LearningPlanWizard)
const DOMAIN_COLORS = {
  vocabulary: { primary: '#4CAF50', gradient: 'linear-gradient(135deg, #4CAF50, #81C784)' },
  math: { primary: '#2196F3', gradient: 'linear-gradient(135deg, #2196F3, #64B5F6)' },
  language: { primary: '#9C27B0', gradient: 'linear-gradient(135deg, #9C27B0, #BA68C8)' },
  knowledge: { primary: '#FF9800', gradient: 'linear-gradient(135deg, #FF9800, #FFB74D)' },
  skill: { primary: '#00BCD4', gradient: 'linear-gradient(135deg, #00BCD4, #4DD0E1)' },
};

// Dynamic font size based on content length
const getContentFontSize = (text, isLong = false) => {
  if (!text) return '1.5rem';
  const len = text.length;

  if (isLong) {
    // Back of card (longer content)
    if (len <= 50) return '1.1rem';
    if (len <= 100) return '1rem';
    if (len <= 200) return '0.95rem';
    return '0.9rem';
  }

  // Front of card (shorter content)
  if (len <= 20) return '2rem';
  if (len <= 40) return '1.6rem';
  if (len <= 60) return '1.3rem';
  if (len <= 100) return '1.1rem';
  return '1rem';
};

function StudyCard({ item, isFlipped, onFlip, hint, hintLevel = 0, hintLoading = false, onPronounce, animationClass }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Get domain color
  const domainColor = useMemo(() => {
    return DOMAIN_COLORS[item?.domain]?.primary || theme.palette.primary.main;
  }, [item?.domain, theme.palette.primary.main]);

  const domainGradient = useMemo(() => {
    return DOMAIN_COLORS[item?.domain]?.gradient ||
      `linear-gradient(135deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.7)})`;
  }, [item?.domain, theme.palette.primary.main]);

  // Box level indicator
  const boxLevel = item?.box || 1;
  const boxLabels = ['New', 'Learning', 'Reviewing', 'Familiar', 'Mastered'];
  const boxLabel = boxLabels[Math.min(boxLevel - 1, 4)];

  if (!item) return null;

  return (
    <div
      className={`flip-card ${isFlipped ? 'flipped' : ''} ${animationClass || ''}`}
      onClick={!isFlipped ? onFlip : undefined}
      style={{ cursor: !isFlipped ? 'pointer' : 'default' }}
    >
      <div className="flip-card-inner">
        {/* Front Side - Question/Term */}
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
                <QuestionIcon sx={{ color: '#fff', fontSize: 20 }} />
                <Typography
                  variant="caption"
                  sx={{ color: alpha('#fff', 0.95), fontWeight: 600, letterSpacing: 0.5 }}
                >
                  {item.difficulty === 'hard' ? 'CHALLENGE' : 'QUESTION'}
                </Typography>
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

            {/* Card Content */}
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
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: getContentFontSize(item.front),
                  color: theme.palette.text.primary,
                  textAlign: 'center',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}
              >
                {item.front}
              </Typography>

              {/* Hint display with progressive levels */}
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
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{ color: domainColor, fontStyle: 'italic' }}
                        >
                          💡 Hint {hintLevel > 1 ? `(Level ${hintLevel})` : ''}: {hint}
                        </Typography>
                      </Box>
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
                Press Space or click to reveal answer
              </Typography>
            </Box>
          </Box>
        </div>

        {/* Back Side - Answer/Definition */}
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

            {/* Card Content */}
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
                {item.front}
              </Typography>

              {/* Answer */}
              <Typography
                sx={{
                  color: theme.palette.text.primary,
                  fontSize: getContentFontSize(item.back, true),
                  lineHeight: 1.7,
                  flex: 1,
                }}
              >
                {item.back}
              </Typography>

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

export default StudyCard;
