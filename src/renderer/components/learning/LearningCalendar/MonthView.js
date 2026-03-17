/**
 * MonthView.js
 *
 * Monthly calendar grid showing learning activity and scheduled items.
 * Uses DayCell for individual day rendering.
 */

import React, { useMemo, useState } from 'react';
import { Box, Typography, IconButton, Chip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';

import DayCell from './DayCell';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Generate calendar grid for a month
 * Returns array of weeks, each week is array of dates (null for empty cells)
 */
function generateMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const grid = [];
  let currentWeek = [];

  // Fill in empty cells before first day
  for (let i = 0; i < startingDayOfWeek; i++) {
    // Get previous month's dates
    const prevMonthDate = new Date(year, month, 0 - (startingDayOfWeek - i - 1));
    currentWeek.push({ date: prevMonthDate, isCurrentMonth: false });
  }

  // Fill in the days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    currentWeek.push({ date, isCurrentMonth: true });

    if (currentWeek.length === 7) {
      grid.push(currentWeek);
      currentWeek = [];
    }
  }

  // Fill in empty cells after last day
  if (currentWeek.length > 0) {
    let nextDay = 1;
    while (currentWeek.length < 7) {
      const nextMonthDate = new Date(year, month + 1, nextDay++);
      currentWeek.push({ date: nextMonthDate, isCurrentMonth: false });
    }
    grid.push(currentWeek);
  }

  return grid;
}

/**
 * Get streak days for the month
 */
function getStreakDays(dailyData, year, month) {
  const streakDays = new Set();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find consecutive days with activity going backwards from today
  let checkDate = new Date(today);
  let consecutiveCount = 0;

  while (true) {
    const key = checkDate.toISOString().split('T')[0];
    const dayData = dailyData[key];

    if (dayData && dayData.reviewed > 0) {
      consecutiveCount++;
      // Only mark as streak if it's at least 2 days
      if (consecutiveCount >= 2) {
        streakDays.add(key);
        // Also mark the previous day if not already marked
        const prevKey = new Date(checkDate.getTime() + 86400000).toISOString().split('T')[0];
        if (dailyData[prevKey]?.reviewed > 0) {
          streakDays.add(prevKey);
        }
      }
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streakDays;
}

function MonthView({
  dailyData = {},
  streaks = {},
  onDayClick,
  onMonthChange,
  initialDate,
  size = 'normal', // 'compact' | 'normal' | 'large'
  showWeekNumbers = false,
  highlightToday = true,
  showMonthStats = true,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Current displayed month
  const [currentDate, setCurrentDate] = useState(() => {
    if (initialDate) return new Date(initialDate);
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Generate grid
  const grid = useMemo(() => generateMonthGrid(year, month), [year, month]);

  // Get streak days for highlighting
  const streakDays = useMemo(
    () => getStreakDays(dailyData, year, month),
    [dailyData, year, month]
  );

  // Month statistics
  const monthStats = useMemo(() => {
    let totalReviewed = 0;
    let totalScheduled = 0;
    let daysActive = 0;
    let totalCorrect = 0;

    grid.flat().forEach(({ date, isCurrentMonth }) => {
      if (!isCurrentMonth) return;
      const key = date.toISOString().split('T')[0];
      const dayData = dailyData[key];
      if (dayData) {
        totalReviewed += dayData.reviewed || 0;
        totalScheduled += dayData.scheduled || 0;
        totalCorrect += dayData.correct || 0;
        if (dayData.reviewed > 0) daysActive++;
      }
    });

    const accuracy = totalReviewed > 0 ? Math.round((totalCorrect / totalReviewed) * 100) : 0;

    return { totalReviewed, totalScheduled, daysActive, accuracy };
  }, [grid, dailyData]);

  // Navigation handlers
  const goToPreviousMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onMonthChange?.(today);
  };

  // Check if we're on current month
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  // Size configurations
  const sizeConfig = {
    compact: { cell: 32, gap: 2, headerFont: 'subtitle2' },
    normal: { cell: 44, gap: 4, headerFont: 'h6' },
    large: { cell: 56, gap: 6, headerFont: 'h5' },
  }[size] || { cell: 44, gap: 4, headerFont: 'h6' };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with month/year and navigation */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={goToPreviousMonth}>
            <ChevronLeftIcon />
          </IconButton>

          <Typography
            variant={sizeConfig.headerFont}
            sx={{ fontWeight: 600, minWidth: 180, textAlign: 'center' }}
          >
            {MONTHS[month]} {year}
          </Typography>

          <IconButton size="small" onClick={goToNextMonth}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!isCurrentMonth && (
            <IconButton size="small" onClick={goToToday} title="Go to today">
              <TodayIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Month statistics */}
      {showMonthStats && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mb: 2,
            flexWrap: 'wrap',
          }}
        >
          <Chip
            label={`${monthStats.daysActive} days active`}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.success.main, 0.1),
              color: theme.palette.success.main,
            }}
          />
          <Chip
            label={`${monthStats.totalReviewed} reviewed`}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.info.main, 0.1),
              color: theme.palette.info.main,
            }}
          />
          {monthStats.accuracy > 0 && (
            <Chip
              label={`${monthStats.accuracy}% accuracy`}
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
              }}
            />
          )}
        </Box>
      )}

      {/* Weekday headers */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: showWeekNumbers ? 'auto repeat(7, 1fr)' : 'repeat(7, 1fr)',
          gap: `${sizeConfig.gap}px`,
          mb: 1,
        }}
      >
        {showWeekNumbers && <Box />}
        {WEEKDAYS.map((day) => (
          <Typography
            key={day}
            variant="caption"
            sx={{
              textAlign: 'center',
              fontWeight: 600,
              color: theme.palette.text.secondary,
              py: 0.5,
            }}
          >
            {size === 'compact' ? day.charAt(0) : day}
          </Typography>
        ))}
      </Box>

      {/* Calendar grid */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${sizeConfig.gap}px`,
        }}
      >
        {grid.map((week, weekIndex) => (
          <Box
            key={weekIndex}
            sx={{
              display: 'grid',
              gridTemplateColumns: showWeekNumbers ? 'auto repeat(7, 1fr)' : 'repeat(7, 1fr)',
              gap: `${sizeConfig.gap}px`,
            }}
          >
            {/* Week number */}
            {showWeekNumbers && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.disabled, fontSize: '0.65rem' }}
                >
                  {getWeekNumber(week[0].date)}
                </Typography>
              </Box>
            )}

            {/* Day cells */}
            {week.map(({ date, isCurrentMonth }) => {
              const dateKey = date.toISOString().split('T')[0];
              const dayData = dailyData[dateKey];
              const isStreak = streakDays.has(dateKey);

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isToday = date.getTime() === today.getTime();
              const isPast = date < today;
              const isFuture = date > today;

              const enrichedDayData = {
                ...dayData,
                isToday,
                isPast,
                isFuture,
              };

              return (
                <Box
                  key={dateKey}
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <DayCell
                    date={date}
                    dayData={enrichedDayData}
                    isCurrentMonth={isCurrentMonth}
                    isSelected={false}
                    isStreak={isStreak}
                    onClick={onDayClick}
                    size={size}
                  />
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

export default MonthView;
