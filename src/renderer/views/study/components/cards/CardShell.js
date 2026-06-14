/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/**
 * CardShell — shared flip-card chrome (header, footer, flip mechanics,
 * hint slot, tags) used by all per-domain study cards.
 *
 * Per-domain cards (VocabCard, MathCard, CodeCard, KnowledgeCard,
 * GenericCard) supply their own question-body and answer-body via the
 * `questionBody` and `answerBody` props; everything else (domain colors,
 * box-level chip, hint display, footer instructions) is provided here so
 * domain cards stay focused on their rendering logic.
 *
 * Extracted from the original StudyCard.js so the behavior is unchanged
 * for the generic path — GenericCard simply renders item.front / item.back
 * inside this shell, identical to the previous implementation.
 */

import React, { useMemo } from 'react';
import { Box, Typography, Chip, Fade, CircularProgress } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  AutoStories as QuestionIcon,
  Lightbulb as AnswerIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';

import '../../../../components/LeitnerSystem/FlipCard.css';

// Domain colors — keep in sync with LearningPlanWizard's palette.
// Falls back to theme primary for unknown domains.
const DOMAIN_COLORS = {
  vocabulary: {
    primary: '#4CAF50',
    gradient: 'linear-gradient(135deg, #4CAF50, #81C784)',
  },
  math: {
    primary: '#2196F3',
    gradient: 'linear-gradient(135deg, #2196F3, #64B5F6)',
  },
  physics: {
    primary: '#1976D2',
    gradient: 'linear-gradient(135deg, #1976D2, #42A5F5)',
  },
  chemistry: {
    primary: '#7B1FA2',
    gradient: 'linear-gradient(135deg, #7B1FA2, #AB47BC)',
  },
  biology: {
    primary: '#388E3C',
    gradient: 'linear-gradient(135deg, #388E3C, #66BB6A)',
  },
  programming: {
    primary: '#455A64',
    gradient: 'linear-gradient(135deg, #455A64, #78909C)',
  },
  language: {
    primary: '#9C27B0',
    gradient: 'linear-gradient(135deg, #9C27B0, #BA68C8)',
  },
  knowledge: {
    primary: '#FF9800',
    gradient: 'linear-gradient(135deg, #FF9800, #FFB74D)',
  },
  history: {
    primary: '#8D6E63',
    gradient: 'linear-gradient(135deg, #8D6E63, #A1887F)',
  },
  geography: {
    primary: '#00897B',
    gradient: 'linear-gradient(135deg, #00897B, #4DB6AC)',
  },
  reading: {
    primary: '#5E35B1',
    gradient: 'linear-gradient(135deg, #5E35B1, #7E57C2)',
  },
  skill: {
    primary: '#00BCD4',
    gradient: 'linear-gradient(135deg, #00BCD4, #4DD0E1)',
  },
};

const BOX_LABELS = ['New', 'Learning', 'Reviewing', 'Familiar', 'Mastered'];

function CardShell({
  item,
  isFlipped,
  onFlip,
  hint,
  hintLevel = 0,
  hintLoading = false,
  animationClass,
  questionBody,
  answerBody,
  // Optional: override the front-reminder shown at the top of the back side.
  // Defaults to item.front. Pass an empty string to suppress it.
  backFrontReminder,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const domainColor = useMemo(
    () => DOMAIN_COLORS[item?.domain]?.primary || theme.palette.primary.main,
    [item?.domain, theme.palette.primary.main],
  );
  const domainGradient = useMemo(
    () =>
      DOMAIN_COLORS[item?.domain]?.gradient ||
      `linear-gradient(135deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.7)})`,
    [item?.domain, theme.palette.primary.main],
  );

  const boxLevel = item?.box || 1;
  const boxLabel = BOX_LABELS[Math.min(boxLevel - 1, 4)];

  if (!item) return null;

  const reminderText =
    backFrontReminder !== undefined ? backFrontReminder : item.front;

  return (
    <div
      className={`flip-card ${isFlipped ? 'flipped' : ''} ${animationClass || ''}`}
      onClick={!isFlipped ? onFlip : undefined}
      style={{ cursor: !isFlipped ? 'pointer' : 'default' }}
    >
      <div className="flip-card-inner">
        {/* Front side */}
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
                  sx={{
                    color: alpha('#fff', 0.95),
                    fontWeight: 600,
                    letterSpacing: 0.5,
                  }}
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
              {questionBody}

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
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <CircularProgress
                          size={14}
                          sx={{ color: domainColor }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ color: domainColor }}
                        >
                          Generating hint...
                        </Typography>
                      </Box>
                    ) : (
                      <Typography
                        variant="caption"
                        sx={{ color: domainColor, fontStyle: 'italic' }}
                      >
                        💡 Hint {hintLevel > 1 ? `(Level ${hintLevel})` : ''}:{' '}
                        {hint}
                      </Typography>
                    )}
                  </Box>
                </Fade>
              )}
            </Box>

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

        {/* Back side */}
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
                sx={{
                  color: alpha('#fff', 0.95),
                  fontWeight: 600,
                  letterSpacing: 0.5,
                }}
              >
                ANSWER
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                p: 3,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {reminderText && (
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
                  {reminderText}
                </Typography>
              )}

              <Box sx={{ flex: 1 }}>{answerBody}</Box>

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
                  <TagIcon
                    sx={{
                      fontSize: 14,
                      color: theme.palette.text.disabled,
                      mr: 0.5,
                    }}
                  />
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

export default CardShell;
export { DOMAIN_COLORS };
