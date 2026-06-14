/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/**
 * ProductionPromptPanel — Phase 8 production loop UI.
 *
 * Opens when KnowledgeDashboard sees a `?produce=<learningPointId>` query
 * param (set by the Brain heartbeat's notification actionUrl). Shows a
 * "explain it in your own words" prompt for a single learning point, grades
 * the free-text answer via the shared comprehension grader, and on Done
 * tells the backend to clear the dedup slot so the loop can pick a fresh
 * concept on the next heartbeat.
 *
 * States: loading → question → grading → result → error
 *
 * Reuses the visual vocabulary of Phase 6 ComprehensionPanel so the user
 * recognizes both as "brain-driven self-check" surfaces.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  TextField,
  LinearProgress,
  IconButton,
  Chip,
  Fade,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import productionPromptApi from '../../api/productionPromptApi';
import { recordEvent } from '../../api/brainApi';

function scoreColor(score) {
  if (score >= 75) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function ScoreRing({ score }) {
  const color = scoreColor(score);
  return (
    <Box
      sx={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        border: `4px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: alpha(color, 0.08),
      }}
    >
      <Typography sx={{ fontSize: 20, fontWeight: 700, color }}>
        {score}
      </Typography>
    </Box>
  );
}

export default function ProductionPromptPanel({
  learningPointId,
  open = false,
  onClose,
}) {
  const theme = useTheme();
  const [state, setState] = useState('loading');
  const [learningPoint, setLearningPoint] = useState(null);
  const [answer, setAnswer] = useState('');
  const [grading, setGrading] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Load the learning point whenever the id changes.
  useEffect(() => {
    if (!open || !learningPointId) return undefined;
    let cancelled = false;
    setState('loading');
    setAnswer('');
    setGrading(null);
    setErrorMessage('');
    productionPromptApi
      .getPrompt(learningPointId)
      .then((res) => {
        if (cancelled) return undefined;
        if (!res?.learningPoint) {
          setState('error');
          setErrorMessage('This learning point is no longer available.');
          return undefined;
        }
        setLearningPoint(res.learningPoint);
        setState('question');
        return undefined;
      })
      .catch(() => {
        if (cancelled) return;
        setState('error');
        setErrorMessage('Failed to load the prompt.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, learningPointId]);

  const handleSubmit = useCallback(async () => {
    if (!answer.trim() || !learningPointId) return;
    setState('grading');
    try {
      const res = await productionPromptApi.gradeAnswer(
        learningPointId,
        answer,
      );
      if (res?.error) {
        setState('error');
        setErrorMessage(res.error);
        return;
      }
      setGrading(res);
      setState('result');
    } catch (err) {
      setState('error');
      setErrorMessage(err?.message || 'Grading failed.');
    }
  }, [answer, learningPointId]);

  const handleSkip = useCallback(async () => {
    if (learningPointId) {
      try {
        await productionPromptApi.skip(learningPointId);
        recordEvent.productionSkipped({
          learningPointId,
          title: learningPoint?.title,
          masteryLevel: learningPoint?.masteryLevel,
        });
      } catch (_) {
        // best-effort
      }
    }
    if (onClose) onClose();
  }, [learningPointId, learningPoint, onClose]);

  const handleDone = useCallback(async () => {
    if (learningPointId) {
      try {
        await productionPromptApi.complete(
          learningPointId,
          grading?.score ?? 0,
        );
        // SRS write-back already happened at grade-answer time; the delta
        // is on `grading.update` (set there, not re-computed here).
        recordEvent.productionSubmitted({
          learningPointId,
          title: learningPoint?.title,
          score: grading?.score ?? 0,
          strengths: grading?.strengths || [],
          gaps: grading?.gaps || [],
          beforeMastery: grading?.update?.beforeMastery,
          afterMastery: grading?.update?.afterMastery,
          beforeBox: grading?.update?.beforeBox,
          afterBox: grading?.update?.afterBox,
          demoted: grading?.update?.demoted,
        });
      } catch (_) {
        // best-effort
      }
    }
    if (onClose) onClose();
  }, [learningPointId, learningPoint, grading, onClose]);

  if (!open) return null;

  return (
    <Fade in={open}>
      <Box
        sx={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          zIndex: 1400,
          width: { xs: 'calc(100% - 48px)', sm: 440 },
          maxWidth: 440,
        }}
      >
        <Paper
          elevation={10}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            background:
              theme.palette.mode === 'dark'
                ? alpha('#1e293b', 0.97)
                : alpha('#ffffff', 0.98),
            border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <PsychologyIcon
              sx={{ fontSize: 18, color: theme.palette.primary.main }}
            />
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, flex: 1, fontSize: 13 }}
            >
              Explain in your own words
            </Typography>
            <IconButton
              size="small"
              onClick={handleSkip}
              sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          <Box sx={{ px: 2.5, py: 2 }}>
            {state === 'loading' && (
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Loading the prompt&hellip;
                </Typography>
                <LinearProgress />
              </Stack>
            )}

            {state === 'question' && learningPoint && (
              <Stack spacing={2}>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', fontSize: 12, mb: 0.5 }}
                  >
                    From &ldquo;
                    {learningPoint.bookTitle || 'your library'}&rdquo; ·{' '}
                    {learningPoint.domainType} · mastery{' '}
                    {learningPoint.masteryLevel}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, fontSize: 15 }}
                  >
                    {learningPoint.title}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ fontStyle: 'italic', color: 'text.primary' }}
                >
                  Explain it in your own words — not the textbook phrasing. The
                  goal is to find out whether you can produce the idea, not just
                  recognize it.
                </Typography>
                <TextField
                  multiline
                  minRows={4}
                  maxRows={8}
                  placeholder="Write your explanation here…"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  variant="outlined"
                  size="small"
                  fullWidth
                  inputProps={{ style: { fontSize: 13 } }}
                />
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    onClick={handleSkip}
                    sx={{ fontSize: 12 }}
                  >
                    Skip
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!answer.trim()}
                    sx={{ fontSize: 12 }}
                  >
                    Grade my answer
                  </Button>
                </Stack>
              </Stack>
            )}

            {state === 'grading' && (
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Grading your explanation&hellip;
                </Typography>
                <LinearProgress />
              </Stack>
            )}

            {state === 'result' && grading && (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <ScoreRing score={grading.score} />
                  <Box flex={1}>
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', fontSize: 12 }}
                    >
                      {grading.feedback}
                    </Typography>
                  </Box>
                </Stack>

                {/* Mastery write-back delta — only show if something changed,
                    otherwise it's noise. Demotion gets the warning color. */}
                {grading.update &&
                  (grading.update.beforeMastery !==
                    grading.update.afterMastery ||
                    grading.update.demoted) && (
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        bgcolor: alpha(
                          grading.update.demoted ? '#ef4444' : '#f59e0b',
                          0.08,
                        ),
                        border: `1px solid ${alpha(
                          grading.update.demoted ? '#ef4444' : '#f59e0b',
                          0.2,
                        )}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: grading.update.demoted ? '#ef4444' : '#f59e0b',
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        Mastery {grading.update.beforeMastery} →{' '}
                        {grading.update.afterMastery}
                        {grading.update.demoted &&
                          ` · Box ${grading.update.beforeBox} → ${grading.update.afterBox} (re-queued for SRS)`}
                      </Typography>
                    </Box>
                  )}

                {Array.isArray(grading.strengths) &&
                  grading.strengths.length > 0 && (
                    <Box>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        mb={0.5}
                      >
                        <CheckCircleIcon
                          sx={{ fontSize: 13, color: '#10b981' }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ color: '#10b981', fontWeight: 600 }}
                        >
                          You got
                        </Typography>
                      </Stack>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {grading.strengths.map((s) => (
                          <Chip
                            key={s}
                            label={s}
                            size="small"
                            sx={{
                              fontSize: 11,
                              bgcolor: alpha('#10b981', 0.1),
                              color: '#10b981',
                            }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}

                {Array.isArray(grading.gaps) && grading.gaps.length > 0 && (
                  <Box>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.5}
                      mb={0.5}
                    >
                      <WarningIcon sx={{ fontSize: 13, color: '#f59e0b' }} />
                      <Typography
                        variant="caption"
                        sx={{ color: '#f59e0b', fontWeight: 600 }}
                      >
                        Review
                      </Typography>
                    </Stack>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {grading.gaps.map((g) => (
                        <Chip
                          key={g}
                          label={g}
                          size="small"
                          sx={{
                            fontSize: 11,
                            bgcolor: alpha('#f59e0b', 0.1),
                            color: '#f59e0b',
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}

                <Stack
                  direction="row"
                  spacing={1}
                  justifyContent="flex-end"
                  sx={{ mt: 0.5 }}
                >
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleDone}
                    sx={{ fontSize: 12 }}
                  >
                    Done
                  </Button>
                </Stack>
              </Stack>
            )}

            {state === 'error' && (
              <Stack spacing={2}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {errorMessage ||
                    'Something went wrong. No worries — try again later.'}
                </Typography>
                <Button
                  size="small"
                  onClick={handleSkip}
                  sx={{ fontSize: 12, alignSelf: 'flex-end' }}
                >
                  Close
                </Button>
              </Stack>
            )}
          </Box>
        </Paper>
      </Box>
    </Fade>
  );
}
