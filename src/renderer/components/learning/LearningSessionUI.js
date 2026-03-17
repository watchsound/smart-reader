/**
 * LearningSessionUI.js
 *
 * An interactive learning session interface with progress tracking,
 * adaptive feedback, and real-time performance metrics.
 * Features glass-morphism design and smooth animations.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme, alpha } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PsychologyIcon from '@mui/icons-material/Psychology';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

import learningApi from '../../api/learningApi';
import customStorage from '../../store/customStorage';

// Session state colors
const SESSION_COLORS = {
  active: {
    color: '#43A047',
    darkColor: '#66BB6A',
    bg: '#E8F5E9',
    darkBg: '#1B3A1B',
  },
  paused: {
    color: '#FB8C00',
    darkColor: '#FFA726',
    bg: '#FFF3E0',
    darkBg: '#2D1B00',
  },
  completed: {
    color: '#1E88E5',
    darkColor: '#42A5F5',
    bg: '#E3F2FD',
    darkBg: '#0D2137',
  },
};

// Performance level colors
const PERFORMANCE_COLORS = {
  excellent: { color: '#43A047', darkColor: '#66BB6A' },
  good: { color: '#1E88E5', darkColor: '#42A5F5' },
  fair: { color: '#FB8C00', darkColor: '#FFA726' },
  needsWork: { color: '#E53935', darkColor: '#EF5350' },
};

// Format duration as mm:ss
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Get performance level
function getPerformanceLevel(accuracy) {
  if (accuracy >= 90) return 'excellent';
  if (accuracy >= 75) return 'good';
  if (accuracy >= 60) return 'fair';
  return 'needsWork';
}

export default function LearningSessionUI({
  session,
  topic,
  onSessionComplete,
  onSessionPause,
  onClose,
  items = [],
}) {
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [streak, setStreak] = useState(0);
  const [hint, setHint] = useState(null);

  const timerRef = useRef(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  customStorage.getSessionToken(); // Token reserved for authenticated calls

  // Calculate metrics
  const totalItems = items.length || session?.planData?.itemCount || 10;
  const completedItems = answers.length;
  const correctItems = answers.filter((a) => a.correct).length;
  const accuracy =
    completedItems > 0 ? Math.round((correctItems / completedItems) * 100) : 0;
  const progress = Math.round((completedItems / totalItems) * 100);

  const performanceLevel = getPerformanceLevel(accuracy);
  const performanceColor = PERFORMANCE_COLORS[performanceLevel];

  // Timer effect
  useEffect(() => {
    if (!isPaused && !showSummary) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, showSummary]);

  // Complete session (defined before handleAnswer to avoid use-before-define)
  const completeSession = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      // Record session completion
      if (session?.id) {
        await learningApi.completeSession(session.id, {
          completedItems: answers.length + 1,
          correctItems:
            correctItems + (answers[answers.length - 1]?.correct ? 1 : 0),
          durationMinutes: Math.ceil(elapsedTime / 60),
          accuracyRate: accuracy,
        });
      }

      setShowSummary(true);
      onSessionComplete?.({
        totalItems: completedItems + 1,
        correctItems,
        accuracy,
        duration: elapsedTime,
        streak,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[LearningSessionUI] Error completing session:', e);
    }
  }, [
    session,
    answers,
    correctItems,
    accuracy,
    elapsedTime,
    completedItems,
    streak,
    onSessionComplete,
  ]);

  // Handle answer submission
  const handleAnswer = useCallback(
    (isCorrect) => {
      const newAnswer = {
        itemIndex: currentItemIndex,
        correct: isCorrect,
        timestamp: new Date().toISOString(),
        responseTime:
          elapsedTime - (answers[answers.length - 1]?.elapsedAt || 0),
        elapsedAt: elapsedTime,
      };

      setAnswers((prev) => [...prev, newAnswer]);

      if (isCorrect) {
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
      }

      setHint(null);

      // Move to next item or complete
      if (currentItemIndex + 1 >= totalItems) {
        completeSession();
      } else {
        setCurrentItemIndex((prev) => prev + 1);
      }
    },
    [currentItemIndex, totalItems, elapsedTime, answers, completeSession],
  );

  // Skip current item
  const handleSkip = useCallback(() => {
    const newAnswer = {
      itemIndex: currentItemIndex,
      correct: false,
      skipped: true,
      timestamp: new Date().toISOString(),
      elapsedAt: elapsedTime,
    };

    setAnswers((prev) => [...prev, newAnswer]);
    setStreak(0);
    setHint(null);

    if (currentItemIndex + 1 >= totalItems) {
      completeSession();
    } else {
      setCurrentItemIndex((prev) => prev + 1);
    }
  }, [currentItemIndex, totalItems, elapsedTime, completeSession]);

  // Toggle pause
  const handlePauseToggle = useCallback(() => {
    setIsPaused((prev) => !prev);
    onSessionPause?.(!isPaused);
  }, [isPaused, onSessionPause]);

  // Request hint
  const handleRequestHint = useCallback(() => {
    // Placeholder - would integrate with AI skill
    setHint('Try breaking down the problem into smaller parts.');
  }, []);

  // Get current session state color
  const getStateColor = () => {
    if (showSummary) return SESSION_COLORS.completed;
    if (isPaused) return SESSION_COLORS.paused;
    return SESSION_COLORS.active;
  };
  const stateColor = getStateColor();

  // Render session summary
  if (showSummary) {
    return (
      <Dialog open maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon
              sx={{ color: performanceColor[isDark ? 'darkColor' : 'color'] }}
            />
            Session Complete!
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              p: 3,
              textAlign: 'center',
              bgcolor: isDark ? stateColor.darkBg : stateColor.bg,
              borderRadius: 2,
              mb: 2,
            }}
          >
            <Typography
              variant="h2"
              sx={{
                fontWeight: 700,
                color: performanceColor[isDark ? 'darkColor' : 'color'],
                mb: 1,
              }}
            >
              {accuracy}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Accuracy
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
              mb: 2,
            }}
          >
            <Box
              sx={{
                p: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderRadius: 2,
                textAlign: 'center',
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {correctItems}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Correct / {completedItems}
              </Typography>
            </Box>
            <Box
              sx={{
                p: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderRadius: 2,
                textAlign: 'center',
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {formatDuration(elapsedTime)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Duration
              </Typography>
            </Box>
          </Box>

          {streak >= 3 && (
            <Box
              sx={{
                p: 2,
                bgcolor: alpha('#FF5722', 0.1),
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                justifyContent: 'center',
              }}
            >
              <LocalFireDepartmentIcon sx={{ color: '#FF5722' }} />
              <Typography sx={{ fontWeight: 500 }}>
                Best streak: {streak} correct in a row!
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowSummary(false);
              setCurrentItemIndex(0);
              setAnswers([]);
              setElapsedTime(0);
              setStreak(0);
            }}
          >
            Start New Session
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: isDark ? alpha('#1a1a1a', 0.95) : alpha('#fff', 0.95),
        backdropFilter: 'blur(12px)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          bgcolor: isDark ? stateColor.darkBg : stateColor.bg,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PsychologyIcon
              sx={{ color: isDark ? stateColor.darkColor : stateColor.color }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {topic?.title || 'Learning Session'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Timer */}
            <Chip
              icon={<TimerIcon sx={{ fontSize: 16 }} />}
              label={formatDuration(elapsedTime)}
              size="small"
              sx={{
                bgcolor: alpha(
                  isDark ? stateColor.darkColor : stateColor.color,
                  0.15,
                ),
                color: isDark ? stateColor.darkColor : stateColor.color,
              }}
            />

            {/* Streak */}
            {streak >= 2 && (
              <Chip
                icon={
                  <LocalFireDepartmentIcon
                    sx={{ fontSize: 16, color: '#FF5722' }}
                  />
                }
                label={streak}
                size="small"
                sx={{
                  bgcolor: alpha('#FF5722', 0.15),
                  color: '#FF5722',
                }}
              />
            )}
          </Box>
        </Box>

        {/* Progress bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              bgcolor: alpha(
                isDark ? stateColor.darkColor : stateColor.color,
                0.2,
              ),
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: isDark ? stateColor.darkColor : stateColor.color,
              },
            }}
          />
          <Typography variant="caption" sx={{ fontWeight: 500, minWidth: 40 }}>
            {completedItems}/{totalItems}
          </Typography>
        </Box>
      </Box>

      {/* Content area */}
      <Box
        sx={{
          flex: 1,
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPaused ? (
          <Box sx={{ textAlign: 'center' }}>
            <PauseIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 1 }}>
              Session Paused
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Take a break, then continue when ready
            </Typography>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={handlePauseToggle}
              sx={{
                bgcolor: isDark
                  ? SESSION_COLORS.active.darkColor
                  : SESSION_COLORS.active.color,
              }}
            >
              Resume
            </Button>
          </Box>
        ) : (
          <>
            {/* Current item placeholder */}
            <Box
              sx={{
                width: '100%',
                maxWidth: 500,
                p: 4,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderRadius: 3,
                textAlign: 'center',
                mb: 3,
              }}
            >
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                Question {currentItemIndex + 1} of {totalItems}
              </Typography>
              <Typography variant="h5" sx={{ mb: 2 }}>
                {items[currentItemIndex]?.question ||
                  `Sample Question ${currentItemIndex + 1}`}
              </Typography>
              {items[currentItemIndex]?.context && (
                <Typography variant="body2" color="text.secondary">
                  {items[currentItemIndex].context}
                </Typography>
              )}
            </Box>

            {/* Hint */}
            {hint && (
              <Box
                sx={{
                  width: '100%',
                  maxWidth: 500,
                  p: 2,
                  bgcolor: alpha('#FDD835', 0.15),
                  borderRadius: 2,
                  mb: 3,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <LightbulbIcon sx={{ color: '#FDD835', mt: 0.25 }} />
                <Typography variant="body2">{hint}</Typography>
              </Box>
            )}

            {/* Answer buttons */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleAnswer(true)}
                sx={{
                  bgcolor: isDark
                    ? PERFORMANCE_COLORS.excellent.darkColor
                    : PERFORMANCE_COLORS.excellent.color,
                  px: 4,
                }}
              >
                Correct
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<CancelIcon />}
                onClick={() => handleAnswer(false)}
                sx={{
                  bgcolor: isDark
                    ? PERFORMANCE_COLORS.needsWork.darkColor
                    : PERFORMANCE_COLORS.needsWork.color,
                  px: 4,
                }}
              >
                Incorrect
              </Button>
            </Box>
          </>
        )}
      </Box>

      {/* Footer controls */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title="Current accuracy">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TrendingUpIcon
                sx={{
                  fontSize: 18,
                  color: performanceColor[isDark ? 'darkColor' : 'color'],
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: performanceColor[isDark ? 'darkColor' : 'color'],
                }}
              >
                {accuracy}%
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Get a hint">
            <span>
              <IconButton onClick={handleRequestHint} disabled={isPaused}>
                <LightbulbIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Skip question">
            <span>
              <IconButton onClick={handleSkip} disabled={isPaused}>
                <SkipNextIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={isPaused ? 'Resume' : 'Pause'}>
            <IconButton onClick={handlePauseToggle}>
              {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="End session">
            <IconButton onClick={completeSession} color="error">
              <StopIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
