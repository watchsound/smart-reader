/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/**
 * ComprehensionPanel — Phase 6 chapter-end comprehension check.
 *
 * Floats over the reading area when the reader finishes a chapter.
 * Five states:
 *
 *   'offer'     — non-intrusive prompt: "Test your understanding?" [Check / Skip]
 *   'loading'   — AI generating question
 *   'question'  — textarea for the reader's free-text answer [Submit / Skip]
 *   'grading'   — AI grading the answer
 *   'result'    — score + strengths + gaps + feedback [Done]
 *   'error'     — something failed; always has a "Skip" out
 *
 * Props:
 *   open          {boolean}
 *   state         {'offer'|'loading'|'question'|'grading'|'result'|'error'}
 *   chapterName   {string}
 *   question      {string}              — populated after 'loading'
 *   grading       {Object|null}         — { score, strengths, gaps, feedback }
 *   errorMessage  {string}
 *   onCheck       {() => void}          — user opts in; triggers question generation
 *   onSkip        {() => void}          — user skips; records COMPREHENSION_SKIPPED
 *   onSubmit      {(answer: string) => void}
 *   onDone        {() => void}          — close after result
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  LinearProgress,
  IconButton,
  Fade,
  Paper,
  Chip,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

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
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: `5px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: alpha(color, 0.08),
      }}
    >
      <Typography sx={{ fontSize: 22, fontWeight: 700, color }}>
        {score}
      </Typography>
    </Box>
  );
}

export default function ComprehensionPanel({
  open = false,
  state = 'offer',
  chapterName = '',
  question = '',
  grading = null,
  errorMessage = '',
  onCheck,
  onSkip,
  onSubmit,
  onDone,
  onScheduleReread,
}) {
  const theme = useTheme();
  const [answer, setAnswer] = useState('');

  // Reset answer when a new question arrives
  React.useEffect(() => {
    if (state === 'question') setAnswer('');
  }, [question, state]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!answer.trim()) return;
    if (onSubmit) onSubmit(answer);
  };

  const handleSkip = () => {
    if (onSkip) onSkip();
  };

  const handleDone = () => {
    if (onDone) onDone();
  };

  const chapterLabel = chapterName
    ? `"${chapterName.length > 50 ? `${chapterName.slice(0, 50)}\u2026` : chapterName}"`
    : 'this chapter';

  return (
    <Fade in={open}>
      <Box
        sx={{
          position: 'absolute',
          bottom: 80,
          right: 24,
          zIndex: 1400,
          width: { xs: 'calc(100% - 48px)', sm: 420 },
          maxWidth: 420,
        }}
      >
        <Paper
          elevation={8}
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
              Comprehension Check
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
            {/* OFFER */}
            {state === 'offer' && (
              <Stack spacing={2}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  You finished {chapterLabel}. Want a quick comprehension check?
                </Typography>
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
                    onClick={() => {
                      if (onCheck) onCheck();
                    }}
                    sx={{ fontSize: 12 }}
                  >
                    Check it
                  </Button>
                </Stack>
              </Stack>
            )}

            {/* LOADING (generating question) */}
            {state === 'loading' && (
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Generating a question&hellip;
                </Typography>
                <LinearProgress />
              </Stack>
            )}

            {/* QUESTION */}
            {state === 'question' && (
              <Stack spacing={2}>
                <Typography
                  variant="body2"
                  sx={{ fontStyle: 'italic', color: 'text.primary' }}
                >
                  {question}
                </Typography>
                <TextField
                  multiline
                  minRows={3}
                  maxRows={6}
                  placeholder="Write your answer here\u2026"
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
                    Submit
                  </Button>
                </Stack>
              </Stack>
            )}

            {/* GRADING */}
            {state === 'grading' && (
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Grading your answer&hellip;
                </Typography>
                <LinearProgress />
              </Stack>
            )}

            {/* RESULT */}
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

                <Stack direction="row" spacing={1} mt={0.5}>
                  {grading.gaps &&
                    grading.gaps.length > 0 &&
                    onScheduleReread && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        onClick={() => onScheduleReread(grading)}
                        sx={{ fontSize: 11, flex: 1 }}
                      >
                        Schedule re-read
                      </Button>
                    )}
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleDone}
                    sx={{ fontSize: 12, flex: 1 }}
                  >
                    Done
                  </Button>
                </Stack>
              </Stack>
            )}

            {/* ERROR */}
            {state === 'error' && (
              <Stack spacing={2}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {errorMessage ||
                    'Something went wrong. No worries \u2014 keep reading!'}
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
