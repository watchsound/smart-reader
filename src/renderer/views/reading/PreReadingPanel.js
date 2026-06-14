/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/**
 * PreReadingPanel — Phase 5 first-open primer modal.
 *
 * Shown once per book, the first time the user opens it. Three states:
 *
 *   - 'offer'   — opt-in: "Get a 30-second map of this book?" [Run / Skip]
 *   - 'loading' — diagnostic AI call in flight
 *   - 'result'  — annotated TOC + primer + start-reading button
 *   - 'error'   — diagnostic call failed; offer Skip
 *
 * Hard rules:
 *   - The modal is non-blocking — there's always a "Skip" / "Start Reading"
 *     out, even if the diagnostic errored.
 *   - Dismissing in any state marks the book first-opened so we never
 *     surface this panel again (the user already saw it once).
 *   - The panel does NOT auto-run the diagnostic on offer. Cost matters
 *     and the offer state lets the user opt out before we burn an AI call.
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  LinearProgress,
  IconButton,
  Modal,
  Fade,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckIcon,
  HelpOutline as HelpIcon,
  Lightbulb as LightbulbIcon,
  WarningAmber as WarningIcon,
  MenuBook as MenuBookIcon,
} from '@mui/icons-material';

const STATUS_META = {
  review: { label: 'Review', icon: CheckIcon, color: '#10b981' },
  partial: { label: 'Some new', icon: LightbulbIcon, color: '#f59e0b' },
  new: { label: 'New', icon: LightbulbIcon, color: '#3b82f6' },
  unknown: { label: '—', icon: HelpIcon, color: '#9ca3af' },
};

function StatusBadge({ status, theme }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const Icon = meta.icon;
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 12, color: `${meta.color} !important` }} />}
      label={meta.label}
      size="small"
      sx={{
        height: 20,
        fontSize: '0.65rem',
        fontWeight: 600,
        bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.18 : 0.12),
        color: meta.color,
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}

function ChapterRow({ chapter, theme }) {
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        py: 1,
        px: 1.5,
        borderRadius: 1.5,
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
        },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            color: theme.palette.text.primary,
            mb: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {chapter.title || '(untitled)'}
        </Typography>
        {chapter.estimatedConcepts && chapter.estimatedConcepts.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {chapter.estimatedConcepts.map((c) => {
              const known = chapter.knownToReader?.includes(c);
              return (
                <Chip
                  key={c}
                  label={c}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    bgcolor: known
                      ? alpha('#10b981', isDark ? 0.2 : 0.12)
                      : alpha(theme.palette.text.primary, isDark ? 0.08 : 0.05),
                    color: known ? '#10b981' : theme.palette.text.secondary,
                    textDecoration: known ? 'none' : 'none',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              );
            })}
          </Box>
        )}
      </Box>
      <StatusBadge status={chapter.status} theme={theme} />
    </Box>
  );
}

function PreReadingPanel({
  open,
  state, // 'offer' | 'loading' | 'result' | 'error'
  diagnostic,
  errorMessage,
  bookTitle,
  onRun,
  onSkip,
  onStartReading,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleClose = () => {
    // Closing in any state behaves as "skip" — the parent marks first-opened.
    if (state === 'result') {
      if (onStartReading) onStartReading();
    } else if (onSkip) {
      onSkip();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeAfterTransition
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <Fade in={open}>
        <Box
          sx={{
            width: 'min(560px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 64px)',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: theme.palette.background.paper,
            borderRadius: 3,
            boxShadow: `0 24px 64px ${alpha('#000', isDark ? 0.6 : 0.25)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
            overflow: 'hidden',
            outline: 'none',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2.5,
              py: 1.75,
              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.06),
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <AutoAwesomeIcon
              sx={{ color: theme.palette.primary.main, fontSize: 22 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {state === 'result' ? 'Reading Map' : 'Before you start'}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.secondary, display: 'block' }}
              >
                {bookTitle || ''}
              </Typography>
            </Box>
            <IconButton size="small" onClick={handleClose} aria-label="close">
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          {/* Body */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
            {state === 'offer' && (
              <Stack spacing={2}>
                <Typography
                  variant="body2"
                  sx={{ color: theme.palette.text.primary, lineHeight: 1.6 }}
                >
                  Get a quick map of what&apos;s ahead — chapter-by-chapter
                  concepts, which ones you likely already know, and a
                  personalized note on prerequisites. Takes about 5 seconds and
                  one AI call.
                </Typography>
                <Box
                  sx={{
                    bgcolor: alpha(
                      theme.palette.text.primary,
                      isDark ? 0.06 : 0.03,
                    ),
                    borderRadius: 2,
                    p: 1.5,
                    display: 'flex',
                    gap: 1,
                    alignItems: 'flex-start',
                  }}
                >
                  <MenuBookIcon
                    sx={{
                      color: theme.palette.text.secondary,
                      fontSize: 18,
                      mt: 0.25,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.text.secondary,
                      lineHeight: 1.5,
                    }}
                  >
                    The map is based on chapter titles only — it&apos;s a rough
                    guide, not a verdict. You can skip and still get in-reading
                    card suggestions as you go.
                  </Typography>
                </Box>
              </Stack>
            )}

            {state === 'loading' && (
              <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
                <AutoAwesomeIcon
                  sx={{
                    fontSize: 36,
                    color: theme.palette.primary.main,
                    opacity: 0.7,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: theme.palette.text.secondary }}
                >
                  Reading the table of contents…
                </Typography>
                <Box sx={{ width: '60%' }}>
                  <LinearProgress />
                </Box>
              </Stack>
            )}

            {state === 'error' && (
              <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
                <WarningIcon
                  sx={{ fontSize: 32, color: theme.palette.warning.main }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.primary,
                    textAlign: 'center',
                  }}
                >
                  Couldn&apos;t generate the reading map.
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.secondary,
                    textAlign: 'center',
                    maxWidth: 360,
                  }}
                >
                  {errorMessage ||
                    'The AI provider may be unreachable. You can skip and start reading — in-reading suggestions still work.'}
                </Typography>
              </Stack>
            )}

            {state === 'result' && diagnostic && (
              <Stack spacing={2}>
                {/* Summary */}
                {diagnostic.bookSummary && (
                  <Typography
                    variant="body2"
                    sx={{ color: theme.palette.text.primary, lineHeight: 1.6 }}
                  >
                    {diagnostic.bookSummary}
                  </Typography>
                )}

                {/* Meta chips */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {diagnostic.estimatedDifficulty && (
                    <Chip
                      label={diagnostic.estimatedDifficulty}
                      size="small"
                      sx={{
                        fontSize: '0.7rem',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                      }}
                    />
                  )}
                  {typeof diagnostic.readinessScore === 'number' &&
                    diagnostic.readinessScore > 0 && (
                      <Chip
                        label={`${diagnostic.readinessScore}% already familiar`}
                        size="small"
                        sx={{
                          fontSize: '0.7rem',
                          bgcolor: alpha('#10b981', 0.1),
                          color: '#10b981',
                        }}
                      />
                    )}
                  {(diagnostic.topics || []).slice(0, 4).map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      size="small"
                      sx={{
                        fontSize: '0.7rem',
                        bgcolor: alpha(
                          theme.palette.text.primary,
                          isDark ? 0.08 : 0.05,
                        ),
                        color: theme.palette.text.secondary,
                      }}
                    />
                  ))}
                </Box>

                {/* Primer */}
                {diagnostic.primer && (
                  <Box
                    sx={{
                      bgcolor: alpha(
                        theme.palette.primary.main,
                        isDark ? 0.1 : 0.05,
                      ),
                      borderLeft: `3px solid ${theme.palette.primary.main}`,
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.primary.main,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        display: 'block',
                        mb: 0.5,
                      }}
                    >
                      Note from your tutor
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        lineHeight: 1.5,
                      }}
                    >
                      {diagnostic.primer}
                    </Typography>
                  </Box>
                )}

                {/* Prerequisite warnings */}
                {Array.isArray(diagnostic.prerequisiteWarnings) &&
                  diagnostic.prerequisiteWarnings.length > 0 && (
                    <Box
                      sx={{
                        bgcolor: alpha(
                          theme.palette.warning.main,
                          isDark ? 0.1 : 0.06,
                        ),
                        borderRadius: 1.5,
                        p: 1.25,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        sx={{ mb: 0.5 }}
                      >
                        <WarningIcon
                          sx={{
                            fontSize: 14,
                            color: theme.palette.warning.main,
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: theme.palette.warning.main,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Worth knowing first
                        </Typography>
                      </Stack>
                      <Stack spacing={0.5}>
                        {diagnostic.prerequisiteWarnings.map((w) => (
                          <Typography
                            key={w.topic}
                            variant="caption"
                            sx={{ color: theme.palette.text.secondary }}
                          >
                            <Box component="span" sx={{ fontWeight: 600 }}>
                              {w.topic}
                            </Box>
                            {w.reason ? ` — ${w.reason}` : ''}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}

                {/* Chapters */}
                {Array.isArray(diagnostic.chapters) &&
                  diagnostic.chapters.length > 0 && (
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: theme.palette.text.secondary,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          display: 'block',
                          mb: 1,
                        }}
                      >
                        Chapter Map
                      </Typography>
                      <Stack spacing={0}>
                        {diagnostic.chapters.map((c, idx) => (
                          <ChapterRow
                            // eslint-disable-next-line react/no-array-index-key
                            key={`${c.title}-${idx}`}
                            chapter={c}
                            theme={theme}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
              </Stack>
            )}
          </Box>

          {/* Footer */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              px: 2.5,
              py: 1.5,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              bgcolor: alpha(theme.palette.text.primary, isDark ? 0.04 : 0.02),
            }}
          >
            {state === 'offer' && (
              <>
                <Button
                  variant="text"
                  onClick={onSkip}
                  sx={{
                    color: theme.palette.text.secondary,
                    textTransform: 'none',
                  }}
                >
                  Just start reading
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button
                  variant="contained"
                  onClick={onRun}
                  startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Show me the map
                </Button>
              </>
            )}
            {state === 'loading' && (
              <>
                <Box sx={{ flex: 1 }} />
                <Button
                  variant="text"
                  onClick={onSkip}
                  sx={{
                    color: theme.palette.text.secondary,
                    textTransform: 'none',
                  }}
                >
                  Skip
                </Button>
              </>
            )}
            {state === 'error' && (
              <>
                <Box sx={{ flex: 1 }} />
                <Button
                  variant="contained"
                  onClick={onSkip}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Start reading
                </Button>
              </>
            )}
            {state === 'result' && (
              <>
                <Box sx={{ flex: 1 }} />
                <Button
                  variant="contained"
                  onClick={onStartReading}
                  startIcon={<MenuBookIcon sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Start reading
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
}

export default PreReadingPanel;
