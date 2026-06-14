/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/**
 * CrossBookPathPanel — Phase 7 cross-book curriculum builder.
 *
 * Lives in the Knowledge Dashboard as tab 5 "Curriculum Builder".
 *
 * States:
 *   idle     — goal input + [Plan] button
 *   loading  — AI call in flight
 *   result   — ordered book steps + coverage gaps
 *   error    — error message + [Try again]
 *
 * Each path step shows: step number, book title, chapter focus chips,
 * reason badge, and estimated hours. Coverage gaps appear as warnings below.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  LinearProgress,
  Paper,
  Divider,
  Alert,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Route as RouteIcon,
  AccessTime as ClockIcon,
  MenuBook as BookIcon,
  Warning as WarningIcon,
  CheckCircle as DoneIcon,
} from '@mui/icons-material';
import learningPathPlannerApi from '../../api/learningPathPlannerApi';

function StepCard({ step, index, theme }) {
  const chapterFocusAll =
    step.chapterFocus === 'all' ||
    !Array.isArray(step.chapterFocus) ||
    step.chapterFocus.length === 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: alpha(theme.palette.divider, 0.15),
        background:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.6)
            : theme.palette.background.paper,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        {/* Step number badge */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: theme.palette.primary.main,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
            mt: 0.25,
          }}
        >
          {index + 1}
        </Box>

        <Box flex={1} minWidth={0}>
          {/* Book title */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            flexWrap="wrap"
          >
            <BookIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, fontSize: 14 }}
            >
              {step.bookTitle}
            </Typography>
            {step.estimatedHours != null && (
              <Chip
                icon={<ClockIcon sx={{ fontSize: 12 }} />}
                label={`~${step.estimatedHours}h`}
                size="small"
                sx={{ fontSize: 11, height: 20 }}
              />
            )}
          </Stack>

          {/* Reason */}
          {step.reason && (
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.5, fontSize: 12 }}
            >
              {step.reason}
            </Typography>
          )}

          {/* Chapter focus */}
          {!chapterFocusAll && step.chapterFocus.length > 0 && (
            <Box mt={1}>
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', fontWeight: 600, mr: 0.5 }}
              >
                Focus chapters:
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.25}>
                {step.chapterFocus.map((ch) => (
                  <Chip
                    key={ch}
                    label={ch}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: 10, height: 18 }}
                  />
                ))}
              </Stack>
            </Box>
          )}
          {chapterFocusAll && (
            <Box mt={0.75}>
              <Chip
                icon={<DoneIcon sx={{ fontSize: 12 }} />}
                label="Read all chapters"
                size="small"
                variant="outlined"
                sx={{
                  fontSize: 11,
                  height: 20,
                  color: '#10b981',
                  borderColor: alpha('#10b981', 0.5),
                }}
              />
            </Box>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export default function CrossBookPathPanel() {
  const theme = useTheme();
  const [goal, setGoal] = useState('');
  const [uiState, setUiState] = useState('idle');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePlan = async () => {
    if (!goal.trim()) return;
    setUiState('loading');
    setResult(null);
    setErrorMsg('');
    try {
      const res = await learningPathPlannerApi.plan(goal.trim());
      if (res?.error) {
        setErrorMsg(res.error);
        setUiState('error');
      } else {
        setResult(res);
        setUiState('result');
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Planning failed. Please try again.');
      setUiState('error');
    }
  };

  const handleReset = () => {
    setUiState('idle');
    setResult(null);
    setErrorMsg('');
  };

  const totalHours = result?.pathSteps?.reduce(
    (sum, s) => sum + (s.estimatedHours || 0),
    0,
  );

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 1 }}>
      {/* Header */}
      <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
        <RouteIcon sx={{ color: theme.palette.primary.main, fontSize: 24 }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 17 }}>
            Curriculum Builder
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', fontSize: 12 }}
          >
            Tell me what you want to learn — I&apos;ll build a reading sequence
            from your library.
          </Typography>
        </Box>
      </Stack>

      {/* Goal input — always visible */}
      <Stack direction="row" spacing={1} mb={3}>
        <TextField
          fullWidth
          size="small"
          placeholder='e.g. "understand machine learning from scratch" or "learn calculus"'
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && uiState !== 'loading') handlePlan();
          }}
          disabled={uiState === 'loading'}
          inputProps={{ style: { fontSize: 13 } }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handlePlan}
          disabled={!goal.trim() || uiState === 'loading'}
          sx={{ whiteSpace: 'nowrap', fontSize: 12, px: 2.5 }}
        >
          Plan it
        </Button>
      </Stack>

      {/* Loading */}
      {uiState === 'loading' && (
        <Stack spacing={1.5}>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', fontSize: 12 }}
          >
            Analyzing your library and building a path&hellip;
          </Typography>
          <LinearProgress />
        </Stack>
      )}

      {/* Error */}
      {uiState === 'error' && (
        <Stack spacing={2}>
          <Alert
            severity="warning"
            action={
              <Button size="small" onClick={handleReset}>
                Try again
              </Button>
            }
          >
            {errorMsg}
          </Alert>
        </Stack>
      )}

      {/* Result */}
      {uiState === 'result' && result && (
        <Stack spacing={2}>
          {/* Summary bar */}
          <Paper
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontStyle: 'italic', fontSize: 13 }}
            >
              {result.summary}
            </Typography>
            <Stack direction="row" spacing={2} mt={1} flexWrap="wrap">
              <Chip
                label={`${result.pathSteps.length} book${result.pathSteps.length !== 1 ? 's' : ''}`}
                size="small"
                sx={{ fontSize: 11 }}
              />
              {totalHours > 0 && (
                <Chip
                  icon={<ClockIcon sx={{ fontSize: 12 }} />}
                  label={`~${totalHours}h total`}
                  size="small"
                  sx={{ fontSize: 11 }}
                />
              )}
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', alignSelf: 'center' }}
              >
                Based on {result.analyzedCount} of {result.totalBooks} books
                with analysis
              </Typography>
            </Stack>
          </Paper>

          {/* Steps */}
          <Stack spacing={1.5}>
            {result.pathSteps.map((step, i) => (
              <StepCard
                key={step.bookId != null ? step.bookId : step.bookTitle}
                step={step}
                index={i}
                theme={theme}
              />
            ))}
          </Stack>

          {/* Coverage gaps */}
          {result.coverageGaps && result.coverageGaps.length > 0 && (
            <Box>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <WarningIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                <Typography
                  variant="caption"
                  sx={{ color: '#f59e0b', fontWeight: 600 }}
                >
                  Topics not covered by your library
                </Typography>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {result.coverageGaps.map((gap) => (
                  <Chip
                    key={gap}
                    label={gap}
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

          {/* Re-plan action */}
          <Box pt={1}>
            <Button size="small" onClick={handleReset} sx={{ fontSize: 12 }}>
              Try a different goal
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
