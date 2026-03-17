/**
 * OptimalTimeRecommendation.js
 *
 * Displays optimal study time recommendations based on performance analysis.
 * Shows best hours and days for studying.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  Tooltip,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  WbSunny as MorningIcon,
  LightMode as AfternoonIcon,
  NightsStay as EveningIcon,
  Schedule as TimeIcon,
  CalendarToday as CalendarIcon,
  TipsAndUpdates as TipIcon,
} from '@mui/icons-material';
import studyAnalyticsApi from '../../../api/studyAnalyticsApi';

/**
 * Get time of day icon and label
 */
const getTimeOfDayInfo = (hour) => {
  if (hour >= 5 && hour < 12) {
    return { icon: <MorningIcon />, label: 'Morning', color: '#FFB74D' };
  }
  if (hour >= 12 && hour < 17) {
    return { icon: <AfternoonIcon />, label: 'Afternoon', color: '#4FC3F7' };
  }
  if (hour >= 17 && hour < 21) {
    return { icon: <EveningIcon />, label: 'Evening', color: '#7986CB' };
  }
  return { icon: <NightsStay />, label: 'Night', color: '#5C6BC0' };
};

/**
 * Hour performance bar
 */
function HourBar({ hour, score, maxScore, isOptimal }) {
  const theme = useTheme();
  const height = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const timeInfo = getTimeOfDayInfo(hour);

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption" display="block">
            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
          </Typography>
          <Typography variant="caption" display="block">
            Score: {score?.toFixed(1) || 'N/A'}
          </Typography>
        </Box>
      }
      placement="top"
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 12,
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 20,
            height: 60,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: `${height}%`,
              minHeight: score > 0 ? 4 : 0,
              bgcolor: isOptimal
                ? theme.palette.success.main
                : alpha(timeInfo.color, 0.6),
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.3s ease',
            }}
          />
        </Box>
        {hour % 4 === 0 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.65rem', mt: 0.5 }}
          >
            {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

/**
 * Day performance card
 */
function DayCard({ day, score, isOptimal }) {
  const theme = useTheme();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Box
      sx={{
        flex: 1,
        p: 1,
        textAlign: 'center',
        borderRadius: 1,
        bgcolor: isOptimal
          ? alpha(theme.palette.success.main, 0.15)
          : 'action.hover',
        border: isOptimal ? `2px solid ${theme.palette.success.main}` : 'none',
      }}
    >
      <Typography
        variant="caption"
        color={isOptimal ? 'success.main' : 'text.secondary'}
        fontWeight={isOptimal ? 600 : 400}
      >
        {dayNames[day]}
      </Typography>
      {score !== null && (
        <Typography
          variant="body2"
          fontWeight={500}
          color={isOptimal ? 'success.main' : 'text.primary'}
        >
          {score?.toFixed(0)}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Main OptimalTimeRecommendation component
 */
export default function OptimalTimeRecommendation({ token, days = 90 }) {
  const theme = useTheme();
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load analysis
  useEffect(() => {
    const loadAnalysis = async () => {
      if (!token) return;

      setIsLoading(true);
      try {
        const result = await studyAnalyticsApi.analyzeOptimalStudyTimes(
          token,
          days,
        );
        if (result.success) {
          setAnalysis(result.analysis);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalysis();
  }, [token, days]);

  // Calculate max scores for normalization
  const { maxHourScore, maxDayScore, optimalHours, optimalDays } = useMemo(() => {
    if (!analysis) return { maxHourScore: 0, maxDayScore: 0, optimalHours: [], optimalDays: [] };

    const hourScores = analysis.hourlyBreakdown?.map((h) =>
      (h.avgFocus || 0) * 0.3 + (h.avgEfficiency || 0) * 0.3 +
      (h.avgRetention || 0) * 0.2 + (h.avgAccuracy || 0) * 0.2
    ) || [];

    const dayScores = analysis.dailyBreakdown?.map((d) =>
      (d.avgFocus || 0) * 0.35 + (d.avgEfficiency || 0) * 0.35 +
      (d.avgRetention || 0) * 0.3
    ) || [];

    return {
      maxHourScore: Math.max(...hourScores, 1),
      maxDayScore: Math.max(...dayScores, 1),
      optimalHours: analysis.recommendations?.bestHours?.map((h) => h.hour) || [],
      optimalDays: analysis.recommendations?.bestDays?.map((d) => d.day) || [],
    };
  }, [analysis]);

  // Loading state
  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  // Not enough data
  if (!analysis || !analysis.hourlyBreakdown?.length) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          textAlign: 'center',
          bgcolor: alpha(theme.palette.info.main, 0.05),
        }}
      >
        <TimeIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
        <Typography variant="subtitle1" gutterBottom>
          Not Enough Data Yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Complete more study sessions to get personalized recommendations
          about your optimal study times.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Recommendation banner */}
      {analysis.recommendations?.suggestion && (
        <Paper
          sx={{
            p: 2,
            mb: 3,
            bgcolor: alpha(theme.palette.success.main, 0.1),
            border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <TipIcon color="success" />
            <Box>
              <Typography variant="subtitle2" color="success.main" gutterBottom>
                Personalized Recommendation
              </Typography>
              <Typography variant="body2">
                {analysis.recommendations.suggestion}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Hourly breakdown */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TimeIcon color="action" fontSize="small" />
          <Typography variant="subtitle2">Performance by Hour</Typography>
        </Box>

        {/* Best hours chips */}
        {analysis.recommendations?.bestHours?.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              Best times:
            </Typography>
            {analysis.recommendations.bestHours.map((h, i) => (
              <Chip
                key={h.hour}
                label={h.label}
                size="small"
                color="success"
                variant={i === 0 ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        )}

        {/* Hour bars */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            alignItems: 'flex-end',
            height: 80,
          }}
        >
          {Array.from({ length: 24 }, (_, hour) => {
            const hourData = analysis.hourlyBreakdown?.find((h) => h.hour === hour);
            const score = hourData
              ? (hourData.avgFocus || 0) * 0.3 + (hourData.avgEfficiency || 0) * 0.3 +
                (hourData.avgRetention || 0) * 0.2 + (hourData.avgAccuracy || 0) * 0.2
              : 0;

            return (
              <HourBar
                key={hour}
                hour={hour}
                score={score}
                maxScore={maxHourScore}
                isOptimal={optimalHours.includes(hour)}
              />
            );
          })}
        </Box>
      </Paper>

      {/* Daily breakdown */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CalendarIcon color="action" fontSize="small" />
          <Typography variant="subtitle2">Performance by Day</Typography>
        </Box>

        {/* Best days chips */}
        {analysis.recommendations?.bestDays?.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              Best days:
            </Typography>
            {analysis.recommendations.bestDays.map((d, i) => (
              <Chip
                key={d.day}
                label={d.name}
                size="small"
                color="success"
                variant={i === 0 ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        )}

        {/* Day cards */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {Array.from({ length: 7 }, (_, day) => {
            const dayData = analysis.dailyBreakdown?.find((d) => d.day === day);
            const score = dayData
              ? (dayData.avgFocus || 0) * 0.35 + (dayData.avgEfficiency || 0) * 0.35 +
                (dayData.avgRetention || 0) * 0.3
              : null;

            return (
              <DayCard
                key={day}
                day={day}
                score={score}
                isOptimal={optimalDays.includes(day)}
              />
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
