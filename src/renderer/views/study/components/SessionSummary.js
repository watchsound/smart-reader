/**
 * SessionSummary.js
 *
 * End-of-session statistics and summary modal.
 * Shows performance breakdown, streaks, and next steps.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Grid,
  LinearProgress,
  Divider,
  Chip,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  EmojiEvents as TrophyIcon,
  Timer as TimerIcon,
  TrendingUp as AccuracyIcon,
  Whatshot as StreakIcon,
  Speed as SpeedIcon,
  Replay as ReviewIcon,
  CheckCircle as DoneIcon,
  PlayArrow as ContinueIcon,
} from '@mui/icons-material';

// Styled components
const SummaryHeader = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(3),
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.7)})`,
  color: '#fff',
  borderRadius: '16px 16px 0 0',
  margin: '-24px -24px 24px -24px',
}));

const StatCard = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(2),
  borderRadius: 12,
  background: theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.05)
    : alpha(theme.palette.common.black, 0.02),
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
}));

const StatValue = styled(Typography)(({ theme, color }) => ({
  fontWeight: 700,
  fontSize: '1.75rem',
  color: color || theme.palette.primary.main,
  lineHeight: 1.2,
}));

const StatLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}));

const RatingBar = styled(Box)(({ theme, color, percentage }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

const RatingLabel = styled(Typography)(({ theme }) => ({
  width: 60,
  fontSize: '0.8rem',
  fontWeight: 500,
}));

const RatingProgress = styled(Box)(({ theme, color, percentage }) => ({
  flex: 1,
  height: 12,
  borderRadius: 6,
  background: alpha(color, 0.15),
  position: 'relative',
  overflow: 'hidden',
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: `${percentage}%`,
    background: color,
    borderRadius: 6,
    transition: 'width 0.5s ease',
  },
}));

const RatingCount = styled(Typography)(({ theme }) => ({
  width: 60,
  textAlign: 'right',
  fontSize: '0.8rem',
  color: theme.palette.text.secondary,
}));

// Format time as MM:SS
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Rating colors
const RATING_COLORS = {
  easy: '#2196f3',
  good: '#4caf50',
  hard: '#ff9800',
  again: '#f44336',
};

function SessionSummary({
  open,
  summary,
  onClose,
  onReviewMistakes,
  onContinue,
}) {
  if (!summary) return null;

  const {
    itemsReviewed,
    totalItems,
    accuracy,
    duration,
    bestStreak,
    avgResponseTime,
    ratingCounts = {},
  } = summary;

  // Calculate percentages for rating bars
  const total = itemsReviewed || 1;
  const ratingPercentages = {
    easy: ((ratingCounts.easy || 0) / total) * 100,
    good: ((ratingCounts.good || 0) / total) * 100,
    hard: ((ratingCounts.hard || 0) / total) * 100,
    again: ((ratingCounts.again || 0) / total) * 100,
  };

  // Determine performance message
  const getPerformanceMessage = () => {
    if (accuracy >= 90) return { emoji: '🎉', text: 'Outstanding!' };
    if (accuracy >= 75) return { emoji: '👏', text: 'Great job!' };
    if (accuracy >= 60) return { emoji: '💪', text: 'Good effort!' };
    if (accuracy >= 40) return { emoji: '📚', text: 'Keep practicing!' };
    return { emoji: '🔄', text: 'More review needed' };
  };

  const performance = getPerformanceMessage();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
        },
      }}
    >
      <DialogContent sx={{ p: 3 }}>
        {/* Header */}
        <SummaryHeader>
          <Typography variant="h2" sx={{ fontSize: '3rem', mb: 1 }}>
            {performance.emoji}
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            Session Complete!
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {performance.text}
          </Typography>
        </SummaryHeader>

        {/* Main Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={4}>
            <StatCard>
              <TrophyIcon sx={{ color: '#ffc107', fontSize: 28, mb: 0.5 }} />
              <StatValue color="#ffc107">{itemsReviewed}</StatValue>
              <StatLabel>Items</StatLabel>
            </StatCard>
          </Grid>
          <Grid item xs={4}>
            <StatCard>
              <AccuracyIcon sx={{ color: '#4caf50', fontSize: 28, mb: 0.5 }} />
              <StatValue color="#4caf50">{accuracy}%</StatValue>
              <StatLabel>Accuracy</StatLabel>
            </StatCard>
          </Grid>
          <Grid item xs={4}>
            <StatCard>
              <TimerIcon sx={{ color: '#2196f3', fontSize: 28, mb: 0.5 }} />
              <StatValue color="#2196f3">{formatTime(duration)}</StatValue>
              <StatLabel>Time</StatLabel>
            </StatCard>
          </Grid>
        </Grid>

        {/* Performance Breakdown */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
          Performance Breakdown
        </Typography>

        <Box sx={{ mb: 3 }}>
          <RatingBar>
            <RatingLabel sx={{ color: RATING_COLORS.easy }}>Easy</RatingLabel>
            <RatingProgress color={RATING_COLORS.easy} percentage={ratingPercentages.easy} />
            <RatingCount>
              {ratingCounts.easy || 0} ({Math.round(ratingPercentages.easy)}%)
            </RatingCount>
          </RatingBar>

          <RatingBar>
            <RatingLabel sx={{ color: RATING_COLORS.good }}>Good</RatingLabel>
            <RatingProgress color={RATING_COLORS.good} percentage={ratingPercentages.good} />
            <RatingCount>
              {ratingCounts.good || 0} ({Math.round(ratingPercentages.good)}%)
            </RatingCount>
          </RatingBar>

          <RatingBar>
            <RatingLabel sx={{ color: RATING_COLORS.hard }}>Hard</RatingLabel>
            <RatingProgress color={RATING_COLORS.hard} percentage={ratingPercentages.hard} />
            <RatingCount>
              {ratingCounts.hard || 0} ({Math.round(ratingPercentages.hard)}%)
            </RatingCount>
          </RatingBar>

          <RatingBar>
            <RatingLabel sx={{ color: RATING_COLORS.again }}>Again</RatingLabel>
            <RatingProgress color={RATING_COLORS.again} percentage={ratingPercentages.again} />
            <RatingCount>
              {ratingCounts.again || 0} ({Math.round(ratingPercentages.again)}%)
            </RatingCount>
          </RatingBar>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Additional Stats */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
              <StreakIcon sx={{ color: '#ff9800', fontSize: 18 }} />
              <Typography variant="h6" fontWeight={700} color="#ff9800">
                {bestStreak}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Best Streak
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
              <SpeedIcon sx={{ color: '#9c27b0', fontSize: 18 }} />
              <Typography variant="h6" fontWeight={700} color="#9c27b0">
                {(avgResponseTime / 1000).toFixed(1)}s
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Avg Response
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0, gap: 1 }}>
        {(ratingCounts.again || 0) + (ratingCounts.hard || 0) > 0 && (
          <Button
            variant="outlined"
            startIcon={<ReviewIcon />}
            onClick={onReviewMistakes}
            sx={{ borderRadius: 2 }}
          >
            Review Mistakes
          </Button>
        )}
        {onContinue && (
          <Button
            variant="outlined"
            startIcon={<ContinueIcon />}
            onClick={onContinue}
            sx={{ borderRadius: 2 }}
          >
            Continue
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={<DoneIcon />}
          onClick={onClose}
          sx={{ borderRadius: 2, flex: 1, maxWidth: 150 }}
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SessionSummary;
