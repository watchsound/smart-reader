/**
 * CalendarHeatmap.js
 *
 * GitHub-style contribution heatmap showing learning activity over time.
 * Each cell represents a day, colored by intensity of activity.
 */

import React, { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Intensity color scales
const INTENSITY_COLORS = {
  light: [
    '#ebedf0', // 0 - no activity
    '#9be9a8', // 1 - low
    '#40c463', // 2 - medium
    '#30a14e', // 3 - high
    '#216e39', // 4 - very high
  ],
  dark: [
    '#161b22', // 0 - no activity
    '#0e4429', // 1 - low
    '#006d32', // 2 - medium
    '#26a641', // 3 - high
    '#39d353', // 4 - very high
  ],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Generate array of dates for the heatmap
 */
function generateDateRange(weeks = 52) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from the beginning of the week, `weeks` weeks ago
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeks * 7) - startDate.getDay());

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End of current week

  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Group dates by week for grid layout
 */
function groupByWeek(dates) {
  const weeks = [];
  let currentWeek = [];

  dates.forEach((date) => {
    if (date.getDay() === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(date);
  });

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

/**
 * Get month labels with positions
 */
function getMonthLabels(weeks) {
  const labels = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    const firstDayOfWeek = week[0];
    const month = firstDayOfWeek.getMonth();

    if (month !== lastMonth) {
      labels.push({ month: MONTHS[month], weekIndex });
      lastMonth = month;
    }
  });

  return labels;
}

function CalendarHeatmap({
  dailyData = {},
  weeks = 52,
  cellSize = 12,
  cellGap = 3,
  showMonthLabels = true,
  showDayLabels = true,
  showLegend = true,
  onDayClick,
  compact = false,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colors = isDark ? INTENSITY_COLORS.dark : INTENSITY_COLORS.light;

  // Adjust sizes for compact mode
  const actualCellSize = compact ? 10 : cellSize;
  const actualCellGap = compact ? 2 : cellGap;

  // Generate date grid
  const dates = useMemo(() => generateDateRange(weeks), [weeks]);
  const weekGroups = useMemo(() => groupByWeek(dates), [dates]);
  const monthLabels = useMemo(() => getMonthLabels(weekGroups), [weekGroups]);

  // Calculate dimensions
  const gridWidth = weekGroups.length * (actualCellSize + actualCellGap);
  const gridHeight = 7 * (actualCellSize + actualCellGap);
  const labelOffset = showDayLabels ? 30 : 0;

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTooltipContent = (date, data) => {
    const dateStr = formatDate(date);
    if (!data || (data.reviewed === 0 && data.scheduled === 0)) {
      return `${dateStr}\nNo activity`;
    }

    let content = dateStr;
    if (data.reviewed > 0) {
      content += `\n${data.reviewed} items reviewed`;
      if (data.correct > 0) {
        const rate = Math.round((data.correct / data.reviewed) * 100);
        content += ` (${rate}% correct)`;
      }
    }
    if (data.scheduled > 0 && data.isFuture) {
      content += `\n${data.scheduled} items scheduled`;
    }
    return content;
  };

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      {/* Month labels */}
      {showMonthLabels && (
        <Box
          sx={{
            display: 'flex',
            ml: `${labelOffset}px`,
            mb: 0.5,
            height: 16,
            position: 'relative',
          }}
        >
          {monthLabels.map(({ month, weekIndex }) => (
            <Typography
              key={`${month}-${weekIndex}`}
              variant="caption"
              sx={{
                position: 'absolute',
                left: weekIndex * (actualCellSize + actualCellGap),
                fontSize: compact ? '0.6rem' : '0.7rem',
                color: theme.palette.text.secondary,
              }}
            >
              {month}
            </Typography>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex' }}>
        {/* Day labels */}
        {showDayLabels && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-around',
              width: labelOffset,
              pr: 0.5,
            }}
          >
            {[1, 3, 5].map((dayIndex) => (
              <Typography
                key={dayIndex}
                variant="caption"
                sx={{
                  fontSize: compact ? '0.55rem' : '0.65rem',
                  color: theme.palette.text.secondary,
                  height: actualCellSize + actualCellGap,
                  lineHeight: `${actualCellSize + actualCellGap}px`,
                }}
              >
                {DAYS[dayIndex]}
              </Typography>
            ))}
          </Box>
        )}

        {/* Heatmap grid */}
        <Box
          sx={{
            display: 'flex',
            gap: `${actualCellGap}px`,
          }}
        >
          {weekGroups.map((week, weekIndex) => (
            <Box
              key={weekIndex}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: `${actualCellGap}px`,
              }}
            >
              {week.map((date) => {
                const dateKey = date.toISOString().split('T')[0];
                const dayData = dailyData[dateKey];
                const intensity = dayData?.intensity || 0;
                const isToday = dayData?.isToday;
                const isFuture = dayData?.isFuture;

                return (
                  <Tooltip
                    key={dateKey}
                    title={
                      <Box sx={{ whiteSpace: 'pre-line', textAlign: 'center' }}>
                        {getTooltipContent(date, dayData)}
                      </Box>
                    }
                    arrow
                    placement="top"
                  >
                    <Box
                      onClick={() => onDayClick?.(date, dayData)}
                      sx={{
                        width: actualCellSize,
                        height: actualCellSize,
                        borderRadius: 0.5,
                        bgcolor: isFuture
                          ? alpha(colors[Math.min(intensity, 4)], 0.5)
                          : colors[intensity],
                        border: isToday
                          ? `2px solid ${theme.palette.primary.main}`
                          : 'none',
                        cursor: onDayClick ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          transform: 'scale(1.2)',
                          boxShadow: `0 2px 8px ${alpha('#000', 0.2)}`,
                        },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Legend */}
      {showLegend && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1,
            mt: 1.5,
            ml: labelOffset,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, fontSize: '0.65rem' }}
          >
            Less
          </Typography>
          {colors.map((color, index) => (
            <Box
              key={index}
              sx={{
                width: actualCellSize,
                height: actualCellSize,
                borderRadius: 0.5,
                bgcolor: color,
              }}
            />
          ))}
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, fontSize: '0.65rem' }}
          >
            More
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default CalendarHeatmap;
