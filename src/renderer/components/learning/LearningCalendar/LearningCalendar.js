/**
 * LearningCalendar.js
 *
 * Main composite component combining all calendar features:
 * - View mode toggle (heatmap / month)
 * - Streak tracking with achievements
 * - Workload forecast
 * - Day detail panel
 * - Smart insights
 *
 * This is the primary component to import for learning schedule visualization.
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Divider,
  Collapse,
  Chip,
  Skeleton,
  Alert,
  Button,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GridViewIcon from '@mui/icons-material/GridView';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// Sub-components
import CalendarHeatmap from './CalendarHeatmap';
import MonthView from './MonthView';
import StreakTracker from './StreakTracker';
import ForecastPanel from './ForecastPanel';
import useLearningCalendar from './useLearningCalendar';

/**
 * Day detail panel shown when a day is selected
 */
function DayDetailPanel({ date, dayData, onClose, onStudy }) {
  const theme = useTheme();
  const navigate = useNavigate();

  if (!date) return null;

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dateIso = date.toISOString().split('T')[0];
  const hasDueItems = dayData?.scheduled > 0 || dayData?.isToday;

  const handleStudyClick = () => {
    // Navigate to study session with date parameter
    navigate(`/study/all?date=${dateIso}`);
    onStudy?.(date, dayData);
  };

  return (
    <Box
      sx={{
        p: 2,
        mt: 2,
        borderRadius: 2,
        bgcolor: alpha(theme.palette.primary.main, 0.05),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {dateStr}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <ExpandLessIcon fontSize="small" />
        </IconButton>
      </Box>

      {dayData ? (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {dayData.reviewed > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                {dayData.reviewed}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                Items Reviewed
              </Typography>
            </Box>
          )}

          {dayData.correct > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.info.main }}>
                {Math.round((dayData.correct / dayData.reviewed) * 100)}%
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                Accuracy
              </Typography>
            </Box>
          )}

          {dayData.scheduled > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
                {dayData.scheduled}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {dayData.isFuture ? 'Scheduled' : 'Were Due'}
              </Typography>
            </Box>
          )}

          {!dayData.reviewed && !dayData.scheduled && (
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              No activity recorded for this day
            </Typography>
          )}

          {/* Study Now button */}
          {hasDueItems && (
            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={handleStudyClick}
              sx={{
                ml: 'auto',
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Study Now
            </Button>
          )}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          No data available for this day
        </Typography>
      )}
    </Box>
  );
}

/**
 * Main LearningCalendar component
 */
function LearningCalendar({
  token,
  // View options
  defaultView = 'month', // 'heatmap' | 'month'
  showViewToggle = true,
  showStreak = true,
  showForecast = true,
  // Layout options
  layout = 'full', // 'full' | 'compact' | 'minimal'
  // Feature options
  heatmapWeeks = 26,
  forecastDays = 7,
  // Callbacks
  onDayClick,
  onRefresh,
  // Customization
  title = 'Learning Calendar',
  showTitle = true,
}) {
  const theme = useTheme();

  // State
  const [view, setView] = useState(defaultView);
  const [selectedDate, setSelectedDate] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    streak: true,
    forecast: true,
  });

  // Fetch data using hook
  const {
    loading,
    error,
    forecast,
    statistics,
    dailyData,
    dailyDataWithIntensity,
    streaks,
    todayDue,
    todayCompleted,
    avgDailyWorkload,
    refresh,
  } = useLearningCalendar(token, {
    forecastDays,
    historyDays: heatmapWeeks * 7,
  });

  // Handlers
  const handleDayClick = useCallback((date, dayData) => {
    setSelectedDate(date);
    onDayClick?.(date, dayData);
  }, [onDayClick]);

  const handleRefresh = useCallback(() => {
    refresh();
    onRefresh?.();
  }, [refresh, onRefresh]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Determine component sizes based on layout
  const isCompact = layout === 'compact' || layout === 'minimal';
  const isMinimal = layout === 'minimal';

  // Loading state
  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: isCompact ? 2 : 3,
          borderRadius: 3,
          bgcolor: alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="rectangular" height={isCompact ? 100 : 200} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
        </Box>
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: isCompact ? 2 : 3,
          borderRadius: 3,
          bgcolor: alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Alert
          severity="error"
          action={
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          }
        >
          Failed to load calendar data: {error}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: isCompact ? 2 : 3,
        borderRadius: 3,
        bgcolor: alpha(theme.palette.background.paper, 0.8),
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}
    >
      {/* Header */}
      {(showTitle || showViewToggle) && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          {showTitle && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarMonthIcon sx={{ color: theme.palette.primary.main }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>

              {/* Quick stats chips */}
              {!isMinimal && (
                <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                  {todayDue > 0 && (
                    <Chip
                      label={`${todayDue} due`}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.main,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                  )}
                  {streaks.current > 0 && (
                    <Chip
                      icon={<LocalFireDepartmentIcon sx={{ fontSize: 14 }} />}
                      label={streaks.current}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.error.main, 0.1),
                        color: theme.palette.error.main,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        '& .MuiChip-icon': { color: theme.palette.error.main },
                      }}
                    />
                  )}
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* View toggle */}
            {showViewToggle && !isMinimal && (
              <Tabs
                value={view}
                onChange={(_, v) => setView(v)}
                sx={{
                  minHeight: 32,
                  '& .MuiTab-root': {
                    minHeight: 32,
                    py: 0.5,
                    px: 1.5,
                    minWidth: 'auto',
                  },
                }}
              >
                <Tab
                  value="month"
                  icon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  label={isCompact ? '' : 'Month'}
                  sx={{ fontSize: '0.8rem' }}
                />
                <Tab
                  value="heatmap"
                  icon={<GridViewIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  label={isCompact ? '' : 'Heatmap'}
                  sx={{ fontSize: '0.8rem' }}
                />
              </Tabs>
            )}

            {/* Refresh button */}
            <IconButton size="small" onClick={handleRefresh} title="Refresh">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Streak tracker (collapsible in full mode) */}
      {showStreak && !isMinimal && (
        <Box sx={{ mb: 2 }}>
          {!isCompact && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                py: 1,
              }}
              onClick={() => toggleSection('streak')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalFireDepartmentIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Streak & Achievements
                </Typography>
              </Box>
              {expandedSections.streak ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
          )}

          <Collapse in={isCompact || expandedSections.streak}>
            <StreakTracker
              currentStreak={streaks.current}
              longestStreak={streaks.longest}
              thisWeekDays={streaks.thisWeek}
              thisMonthDays={streaks.thisMonth}
              compact={isCompact}
              showAchievements={!isCompact}
              showWeeklyGoal={!isCompact}
            />
          </Collapse>
        </Box>
      )}

      {/* Main calendar view */}
      <Box sx={{ mb: 2 }}>
        {view === 'heatmap' ? (
          <CalendarHeatmap
            dailyData={dailyDataWithIntensity}
            weeks={heatmapWeeks}
            onDayClick={handleDayClick}
            compact={isCompact}
          />
        ) : (
          <MonthView
            dailyData={dailyDataWithIntensity}
            streaks={streaks}
            onDayClick={handleDayClick}
            size={isCompact ? 'compact' : 'normal'}
            showMonthStats={!isCompact}
          />
        )}
      </Box>

      {/* Selected day detail */}
      <Collapse in={!!selectedDate}>
        <DayDetailPanel
          date={selectedDate}
          dayData={selectedDate ? dailyDataWithIntensity[selectedDate.toISOString().split('T')[0]] : null}
          onClose={() => setSelectedDate(null)}
        />
      </Collapse>

      {/* Forecast panel (collapsible in full mode) */}
      {showForecast && !isMinimal && (
        <Box sx={{ mt: 2 }}>
          {!isCompact && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  py: 1,
                }}
                onClick={() => toggleSection('forecast')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoGraphIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Workload Forecast
                  </Typography>
                </Box>
                {expandedSections.forecast ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
            </>
          )}

          <Collapse in={isCompact || expandedSections.forecast}>
            <ForecastPanel
              forecast={forecast}
              statistics={statistics}
              daysToShow={forecastDays}
              compact={isCompact}
              showSuggestions={!isCompact}
            />
          </Collapse>
        </Box>
      )}

      {/* Minimal view hint */}
      {isMinimal && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            mt: 1,
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 14, color: theme.palette.text.disabled }} />
          <Typography variant="caption" sx={{ color: theme.palette.text.disabled }}>
            Click a day to see details
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default LearningCalendar;
