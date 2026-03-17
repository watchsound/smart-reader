/**
 * ForecastPanel.js
 *
 * Displays upcoming workload forecast with:
 * - Daily due item counts
 * - Workload warnings (heavy days)
 * - Suggested study times
 * - Memory decay alerts
 * - Smart scheduling suggestions
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, LinearProgress, Tooltip, Alert, Button, IconButton } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Estimate study time based on item count and average time per item
 */
function estimateStudyTime(itemCount, avgTimePerItem = 30) {
  // avgTimePerItem in seconds, return in minutes
  const totalSeconds = itemCount * avgTimePerItem;
  return Math.ceil(totalSeconds / 60);
}

/**
 * Get workload level and color
 */
function getWorkloadLevel(count, avgCount) {
  if (count === 0) return { level: 'none', color: 'text.disabled' };
  if (count <= avgCount * 0.5) return { level: 'light', color: 'success.main' };
  if (count <= avgCount * 1.2) return { level: 'normal', color: 'info.main' };
  if (count <= avgCount * 1.8) return { level: 'heavy', color: 'warning.main' };
  return { level: 'intense', color: 'error.main' };
}

function ForecastPanel({
  forecast = [],
  statistics = {},
  daysToShow = 7,
  showTimeEstimates = true,
  showSuggestions = true,
  avgTimePerItem = 30, // seconds
  compact = false,
  showStudyButtons = true,
}) {
  const theme = useTheme();
  const navigate = useNavigate();

  // Handle study button click
  const handleStudy = (dateKey) => {
    navigate(`/study/all?date=${dateKey}`);
  };

  const handleStudyAll = () => {
    navigate('/study/all');
  };

  // Process forecast data
  const forecastData = useMemo(() => {
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];

      const forecastDay = forecast.find((f) => {
        const fDate = new Date(f.date).toISOString().split('T')[0];
        return fDate === dateKey;
      });

      data.push({
        date,
        dateKey,
        dayName: DAYS_OF_WEEK[date.getDay()],
        isToday: i === 0,
        isTomorrow: i === 1,
        dueCount: forecastDay?.dueCount || 0,
        newCount: forecastDay?.newCount || 0,
        reviewCount: forecastDay?.reviewCount || 0,
      });
    }

    return data;
  }, [forecast, daysToShow]);

  // Calculate averages and trends
  const analysis = useMemo(() => {
    const dueCounts = forecastData.map((d) => d.dueCount);
    const totalDue = dueCounts.reduce((sum, c) => sum + c, 0);
    const avgDue = totalDue / Math.max(dueCounts.length, 1);
    const maxDue = Math.max(...dueCounts, 1);
    const minDue = Math.min(...dueCounts);

    // Heavy days (> 1.5x average)
    const heavyDays = forecastData.filter((d) => d.dueCount > avgDue * 1.5);

    // Light days (< 0.5x average)
    const lightDays = forecastData.filter((d) => d.dueCount < avgDue * 0.5 && d.dueCount > 0);

    // Trend (comparing first half vs second half)
    const firstHalf = dueCounts.slice(0, Math.ceil(dueCounts.length / 2));
    const secondHalf = dueCounts.slice(Math.ceil(dueCounts.length / 2));
    const firstAvg = firstHalf.reduce((sum, c) => sum + c, 0) / Math.max(firstHalf.length, 1);
    const secondAvg = secondHalf.reduce((sum, c) => sum + c, 0) / Math.max(secondHalf.length, 1);
    const trend = secondAvg > firstAvg * 1.2 ? 'increasing' : secondAvg < firstAvg * 0.8 ? 'decreasing' : 'stable';

    // Total estimated time
    const totalTime = estimateStudyTime(totalDue, avgTimePerItem);

    return {
      avgDue: Math.round(avgDue),
      maxDue,
      minDue,
      totalDue,
      totalTime,
      heavyDays,
      lightDays,
      trend,
    };
  }, [forecastData, avgTimePerItem]);

  // Generate suggestions
  const suggestions = useMemo(() => {
    const sugg = [];

    if (analysis.heavyDays.length > 0) {
      const heavyDay = analysis.heavyDays[0];
      sugg.push({
        type: 'warning',
        icon: WarningAmberIcon,
        text: `${heavyDay.dayName} has ${heavyDay.dueCount} items - consider studying ahead`,
      });
    }

    if (analysis.lightDays.length > 0 && analysis.heavyDays.length > 0) {
      sugg.push({
        type: 'tip',
        icon: TipsAndUpdatesIcon,
        text: `Balance your workload by doing extra items on ${analysis.lightDays[0].dayName}`,
      });
    }

    if (analysis.trend === 'increasing') {
      sugg.push({
        type: 'info',
        icon: TrendingUpIcon,
        text: 'Workload increasing - pace yourself!',
      });
    }

    if (forecastData[0]?.dueCount > analysis.avgDue * 1.5) {
      sugg.push({
        type: 'urgent',
        icon: AccessTimeIcon,
        text: `Heavy day today! Estimated ${estimateStudyTime(forecastData[0].dueCount, avgTimePerItem)} min needed`,
      });
    }

    return sugg;
  }, [analysis, forecastData, avgTimePerItem]);

  if (compact) {
    return (
      <Box
        sx={{
          p: 1.5,
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        {/* Compact bar chart */}
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end', height: 40 }}>
          {forecastData.slice(0, 7).map((day) => {
            const height = analysis.maxDue > 0 ? (day.dueCount / analysis.maxDue) * 100 : 0;
            const { color } = getWorkloadLevel(day.dueCount, analysis.avgDue);

            return (
              <Tooltip
                key={day.dateKey}
                title={`${day.dayName}: ${day.dueCount} items`}
                arrow
              >
                <Box
                  sx={{
                    flex: 1,
                    height: `${Math.max(height, 10)}%`,
                    minHeight: 4,
                    bgcolor: theme.palette[color.split('.')[0]]?.[color.split('.')[1]] || color,
                    borderRadius: 0.5,
                    transition: 'height 0.3s ease',
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.8 },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>

        {/* Summary line */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            {analysis.totalDue} items next {daysToShow} days
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            ~{analysis.totalTime} min
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: alpha(theme.palette.background.paper, 0.8),
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoGraphIcon sx={{ color: theme.palette.primary.main }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Workload Forecast
        </Typography>
        {analysis.trend !== 'stable' && (
          <Chip
            icon={analysis.trend === 'increasing' ? <TrendingUpIcon /> : <TrendingDownIcon />}
            label={analysis.trend}
            size="small"
            sx={{
              bgcolor: alpha(
                analysis.trend === 'increasing'
                  ? theme.palette.warning.main
                  : theme.palette.success.main,
                0.1
              ),
              color: analysis.trend === 'increasing'
                ? theme.palette.warning.main
                : theme.palette.success.main,
              '& .MuiChip-icon': {
                color: 'inherit',
              },
            }}
          />
        )}
      </Box>

      {/* Daily forecast bars */}
      <Box sx={{ mb: 3 }}>
        {forecastData.map((day) => {
          const { level, color } = getWorkloadLevel(day.dueCount, analysis.avgDue);
          const percentage = analysis.maxDue > 0 ? (day.dueCount / analysis.maxDue) * 100 : 0;
          const timeEstimate = estimateStudyTime(day.dueCount, avgTimePerItem);

          return (
            <Box key={day.dateKey} sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: day.isToday ? 700 : 500,
                      color: day.isToday ? theme.palette.primary.main : 'inherit',
                      minWidth: 45,
                    }}
                  >
                    {day.isToday ? 'Today' : day.isTomorrow ? 'Tmrw' : day.dayName}
                  </Typography>

                  {level === 'intense' && (
                    <WarningAmberIcon
                      sx={{ fontSize: 16, color: theme.palette.error.main }}
                    />
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {showTimeEstimates && day.dueCount > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      ~{timeEstimate}min
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette[color.split('.')[0]]?.[color.split('.')[1]] || color,
                    }}
                  >
                    {day.dueCount}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  sx={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    bgcolor: alpha(theme.palette.grey[500], 0.1),
                    '& .MuiLinearProgress-bar': {
                      bgcolor: theme.palette[color.split('.')[0]]?.[color.split('.')[1]] || color,
                      borderRadius: 4,
                    },
                  }}
                />
                {showStudyButtons && day.dueCount > 0 && (
                  <Tooltip title={`Study ${day.isToday ? 'today' : day.dayName}'s items`} arrow>
                    <IconButton
                      size="small"
                      onClick={() => handleStudy(day.dateKey)}
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                        width: 24,
                        height: 24,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                        },
                      }}
                    >
                      <PlayArrowIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Summary stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.5,
          mb: 2,
          p: 1.5,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.05),
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {analysis.totalDue}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Total Items
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {analysis.avgDue}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Daily Avg
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {analysis.totalTime}m
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Est. Time
          </Typography>
        </Box>
      </Box>

      {/* Study All button */}
      {showStudyButtons && analysis.totalDue > 0 && (
        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<PlayArrowIcon />}
            onClick={handleStudyAll}
            sx={{
              borderRadius: 2,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Study All ({forecastData[0]?.dueCount || 0} due today)
          </Button>
        </Box>
      )}

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <PsychologyIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Smart Suggestions
            </Typography>
          </Box>

          {suggestions.map((sugg, index) => (
            <Alert
              key={index}
              severity={
                sugg.type === 'warning' || sugg.type === 'urgent'
                  ? 'warning'
                  : sugg.type === 'tip'
                    ? 'success'
                    : 'info'
              }
              icon={<sugg.icon sx={{ fontSize: 18 }} />}
              sx={{
                mb: 1,
                py: 0.5,
                '& .MuiAlert-message': {
                  fontSize: '0.8rem',
                },
              }}
            >
              {sugg.text}
            </Alert>
          ))}
        </Box>
      )}

      {/* All caught up message */}
      {analysis.totalDue === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 3,
          }}
        >
          <CheckCircleIcon
            sx={{ fontSize: 48, color: theme.palette.success.main, mb: 1 }}
          />
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            All caught up!
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            No reviews scheduled for the next {daysToShow} days
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default ForecastPanel;
