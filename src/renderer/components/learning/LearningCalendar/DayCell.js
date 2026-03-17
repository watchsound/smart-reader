/**
 * DayCell.js
 *
 * Individual day cell for the monthly calendar view.
 * Shows date, item counts, and visual indicators.
 */

import React from 'react';
import { Box, Typography, Tooltip, Badge } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

function DayCell({
  date,
  dayData,
  isCurrentMonth = true,
  isSelected = false,
  isStreak = false,
  onClick,
  size = 'normal', // 'compact' | 'normal' | 'large'
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const day = date.getDate();
  const isToday = dayData?.isToday;
  const isPast = dayData?.isPast;
  const isFuture = dayData?.isFuture;

  const scheduled = dayData?.scheduled || 0;
  const reviewed = dayData?.reviewed || 0;
  const correct = dayData?.correct || 0;

  // Calculate completion rate for past days
  const completionRate = isPast && scheduled > 0
    ? Math.min(1, reviewed / scheduled)
    : 0;

  // Determine cell state
  const isOverdue = isPast && scheduled > 0 && reviewed < scheduled;
  const isCompleted = isPast && scheduled > 0 && reviewed >= scheduled;
  const hasActivity = reviewed > 0 || scheduled > 0;

  // Size configurations
  const sizes = {
    compact: { cell: 32, font: '0.75rem', badge: 14 },
    normal: { cell: 44, font: '0.875rem', badge: 18 },
    large: { cell: 56, font: '1rem', badge: 22 },
  };
  const sizeConfig = sizes[size] || sizes.normal;

  // Background color based on state
  const getBgColor = () => {
    if (!isCurrentMonth) return 'transparent';
    if (isSelected) return alpha(theme.palette.primary.main, 0.15);
    if (isToday) return alpha(theme.palette.primary.main, 0.1);
    if (isCompleted) return alpha(theme.palette.success.main, 0.1);
    if (isOverdue) return alpha(theme.palette.error.main, 0.1);
    return 'transparent';
  };

  // Border color
  const getBorderColor = () => {
    if (isSelected) return theme.palette.primary.main;
    if (isToday) return theme.palette.primary.main;
    return 'transparent';
  };

  // Text color
  const getTextColor = () => {
    if (!isCurrentMonth) return theme.palette.text.disabled;
    if (isToday) return theme.palette.primary.main;
    return theme.palette.text.primary;
  };

  // Tooltip content
  const getTooltipContent = () => {
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    let content = dateStr;

    if (isToday) {
      content += '\n(Today)';
    }

    if (scheduled > 0) {
      content += `\n${scheduled} items scheduled`;
    }

    if (reviewed > 0) {
      const accuracy = correct > 0 ? Math.round((correct / reviewed) * 100) : 0;
      content += `\n${reviewed} reviewed (${accuracy}% correct)`;
    }

    if (isOverdue) {
      content += '\n⚠️ Incomplete';
    }

    if (isStreak) {
      content += '\n🔥 Streak day!';
    }

    return content;
  };

  return (
    <Tooltip
      title={
        <Box sx={{ whiteSpace: 'pre-line', textAlign: 'center' }}>
          {getTooltipContent()}
        </Box>
      }
      arrow
      placement="top"
    >
      <Box
        onClick={() => onClick?.(date, dayData)}
        sx={{
          width: sizeConfig.cell,
          height: sizeConfig.cell,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1.5,
          bgcolor: getBgColor(),
          border: `2px solid ${getBorderColor()}`,
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: isCurrentMonth
              ? alpha(theme.palette.primary.main, 0.08)
              : 'transparent',
            transform: isCurrentMonth ? 'scale(1.05)' : 'none',
          },
        }}
      >
        {/* Day number */}
        <Typography
          sx={{
            fontSize: sizeConfig.font,
            fontWeight: isToday ? 700 : 500,
            color: getTextColor(),
            lineHeight: 1,
          }}
        >
          {day}
        </Typography>

        {/* Activity indicator dots */}
        {hasActivity && size !== 'compact' && (
          <Box
            sx={{
              display: 'flex',
              gap: 0.25,
              mt: 0.25,
            }}
          >
            {scheduled > 0 && (
              <Box
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  bgcolor: isFuture
                    ? theme.palette.info.main
                    : isCompleted
                      ? theme.palette.success.main
                      : theme.palette.warning.main,
                }}
              />
            )}
            {reviewed > 0 && isPast && (
              <Box
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  bgcolor: theme.palette.success.main,
                }}
              />
            )}
          </Box>
        )}

        {/* Count badge for scheduled items */}
        {scheduled > 0 && size !== 'compact' && (
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: sizeConfig.badge,
              height: sizeConfig.badge,
              borderRadius: sizeConfig.badge / 2,
              bgcolor: isFuture
                ? theme.palette.info.main
                : isOverdue
                  ? theme.palette.error.main
                  : theme.palette.success.main,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          >
            {scheduled > 99 ? '99+' : scheduled}
          </Box>
        )}

        {/* Streak fire icon */}
        {isStreak && (
          <LocalFireDepartmentIcon
            sx={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              fontSize: 12,
              color: theme.palette.warning.main,
            }}
          />
        )}

        {/* Completed checkmark */}
        {isCompleted && size !== 'compact' && (
          <CheckCircleIcon
            sx={{
              position: 'absolute',
              bottom: -2,
              left: -2,
              fontSize: 12,
              color: theme.palette.success.main,
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}

export default DayCell;
