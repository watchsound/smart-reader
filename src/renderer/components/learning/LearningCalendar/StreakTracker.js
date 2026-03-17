/**
 * StreakTracker.js
 *
 * Displays learning streaks with gamification elements:
 * - Current streak with fire animation
 * - Longest streak record
 * - Weekly/monthly goals
 * - Achievement badges
 */

import React, { useMemo } from 'react';
import { Box, Typography, LinearProgress, Tooltip, Chip } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';

// Icons
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import StarIcon from '@mui/icons-material/Star';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';

// Fire pulse animation
const firePulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.9; }
`;

// Achievement definitions
const ACHIEVEMENTS = [
  { id: 'first_day', name: 'First Step', description: 'Complete your first study session', icon: StarIcon, threshold: 1, color: '#FFD700' },
  { id: 'week_warrior', name: 'Week Warrior', description: '7-day streak', icon: LocalFireDepartmentIcon, threshold: 7, color: '#FF6B35' },
  { id: 'fortnight_focus', name: 'Fortnight Focus', description: '14-day streak', icon: TrendingUpIcon, threshold: 14, color: '#4CAF50' },
  { id: 'monthly_master', name: 'Monthly Master', description: '30-day streak', icon: EmojiEventsIcon, threshold: 30, color: '#2196F3' },
  { id: 'quarter_quest', name: 'Quarter Quest', description: '90-day streak', icon: WorkspacePremiumIcon, threshold: 90, color: '#9C27B0' },
  { id: 'year_legend', name: 'Year Legend', description: '365-day streak', icon: MilitaryTechIcon, threshold: 365, color: '#E91E63' },
];

// Weekly goal settings
const DEFAULT_WEEKLY_GOAL = 5; // days per week

function StreakTracker({
  currentStreak = 0,
  longestStreak = 0,
  thisWeekDays = 0,
  thisMonthDays = 0,
  weeklyGoal = DEFAULT_WEEKLY_GOAL,
  showAchievements = true,
  showWeeklyGoal = true,
  compact = false,
  onAchievementClick,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Calculate weekly progress
  const weeklyProgress = Math.min(100, (thisWeekDays / weeklyGoal) * 100);
  const weeklyGoalMet = thisWeekDays >= weeklyGoal;

  // Determine earned achievements
  const earnedAchievements = useMemo(() => {
    return ACHIEVEMENTS.filter((a) => longestStreak >= a.threshold);
  }, [longestStreak]);

  // Next achievement to earn
  const nextAchievement = useMemo(() => {
    return ACHIEVEMENTS.find((a) => longestStreak < a.threshold);
  }, [longestStreak]);

  // Streak tier for color
  const getStreakColor = () => {
    if (currentStreak >= 30) return '#E91E63'; // Pink
    if (currentStreak >= 14) return '#9C27B0'; // Purple
    if (currentStreak >= 7) return '#FF5722'; // Deep Orange
    if (currentStreak >= 3) return '#FF9800'; // Orange
    return theme.palette.warning.main; // Yellow
  };

  const streakColor = getStreakColor();

  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1.5,
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        {/* Current streak */}
        <Tooltip title={`${currentStreak} day streak!`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LocalFireDepartmentIcon
              sx={{
                fontSize: 24,
                color: streakColor,
                animation: currentStreak > 0 ? `${firePulse} 1.5s ease-in-out infinite` : 'none',
              }}
            />
            <Typography variant="h6" sx={{ fontWeight: 700, color: streakColor }}>
              {currentStreak}
            </Typography>
          </Box>
        </Tooltip>

        {/* Weekly progress */}
        <Tooltip title={`${thisWeekDays}/${weeklyGoal} days this week`}>
          <Box sx={{ flex: 1, maxWidth: 100 }}>
            <LinearProgress
              variant="determinate"
              value={weeklyProgress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  bgcolor: weeklyGoalMet ? theme.palette.success.main : theme.palette.primary.main,
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        </Tooltip>

        {/* Best record */}
        <Tooltip title="Longest streak">
          <Chip
            icon={<EmojiEventsIcon sx={{ fontSize: 14 }} />}
            label={longestStreak}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              color: theme.palette.warning.main,
              fontWeight: 600,
              '& .MuiChip-icon': { color: theme.palette.warning.main },
            }}
          />
        </Tooltip>
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
      {/* Current streak - Hero display */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          mb: 3,
          py: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 1,
          }}
        >
          <LocalFireDepartmentIcon
            sx={{
              fontSize: 48,
              color: streakColor,
              animation: currentStreak > 0 ? `${firePulse} 1.5s ease-in-out infinite` : 'none',
              filter: currentStreak > 0 ? `drop-shadow(0 0 8px ${streakColor})` : 'none',
            }}
          />
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              color: streakColor,
              lineHeight: 1,
              textShadow: currentStreak > 7 ? `0 0 20px ${alpha(streakColor, 0.5)}` : 'none',
            }}
          >
            {currentStreak}
          </Typography>
        </Box>

        <Typography
          variant="body2"
          sx={{ color: theme.palette.text.secondary }}
        >
          {currentStreak === 0
            ? 'Start your streak today!'
            : currentStreak === 1
              ? 'day streak - Keep going!'
              : `day streak - You're on fire!`}
        </Typography>
      </Box>

      {/* Stats row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          mb: 3,
        }}
      >
        {/* Longest streak */}
        <Box
          sx={{
            textAlign: 'center',
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.warning.main, 0.08),
          }}
        >
          <EmojiEventsIcon
            sx={{ fontSize: 24, color: theme.palette.warning.main, mb: 0.5 }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {longestStreak}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Best Streak
          </Typography>
        </Box>

        {/* This week */}
        <Box
          sx={{
            textAlign: 'center',
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.info.main, 0.08),
          }}
        >
          <CalendarMonthIcon
            sx={{ fontSize: 24, color: theme.palette.info.main, mb: 0.5 }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {thisWeekDays}/{weeklyGoal}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            This Week
          </Typography>
        </Box>

        {/* This month */}
        <Box
          sx={{
            textAlign: 'center',
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.success.main, 0.08),
          }}
        >
          <TrendingUpIcon
            sx={{ fontSize: 24, color: theme.palette.success.main, mb: 0.5 }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {thisMonthDays}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            This Month
          </Typography>
        </Box>
      </Box>

      {/* Weekly goal progress */}
      {showWeeklyGoal && (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Weekly Goal
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: weeklyGoalMet ? theme.palette.success.main : theme.palette.text.secondary,
                fontWeight: weeklyGoalMet ? 600 : 400,
              }}
            >
              {weeklyGoalMet ? '🎉 Goal Met!' : `${weeklyGoal - thisWeekDays} days to go`}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={weeklyProgress}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                bgcolor: weeklyGoalMet ? theme.palette.success.main : theme.palette.primary.main,
                borderRadius: 5,
                transition: 'transform 0.4s ease',
              },
            }}
          />
        </Box>
      )}

      {/* Achievements */}
      {showAchievements && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
            Achievements
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {ACHIEVEMENTS.map((achievement) => {
              const isEarned = longestStreak >= achievement.threshold;
              const Icon = achievement.icon;

              return (
                <Tooltip
                  key={achievement.id}
                  title={
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {achievement.name}
                      </Typography>
                      <Typography variant="caption">
                        {achievement.description}
                      </Typography>
                      {!isEarned && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                          {achievement.threshold - longestStreak} days to unlock
                        </Typography>
                      )}
                    </Box>
                  }
                  arrow
                >
                  <Box
                    onClick={() => onAchievementClick?.(achievement)}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isEarned
                        ? alpha(achievement.color, 0.15)
                        : alpha(theme.palette.text.disabled, 0.1),
                      border: `2px solid ${isEarned ? achievement.color : 'transparent'}`,
                      cursor: onAchievementClick ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        boxShadow: isEarned ? `0 4px 12px ${alpha(achievement.color, 0.3)}` : 'none',
                      },
                    }}
                  >
                    <Icon
                      sx={{
                        fontSize: 22,
                        color: isEarned ? achievement.color : theme.palette.text.disabled,
                        opacity: isEarned ? 1 : 0.5,
                      }}
                    />
                  </Box>
                </Tooltip>
              );
            })}
          </Box>

          {/* Next achievement hint */}
          {nextAchievement && (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(nextAchievement.color, 0.08),
                border: `1px dashed ${alpha(nextAchievement.color, 0.3)}`,
              }}
            >
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                Next achievement:{' '}
                <Box component="span" sx={{ color: nextAchievement.color, fontWeight: 600 }}>
                  {nextAchievement.name}
                </Box>
                {' - '}
                {nextAchievement.threshold - longestStreak} more days needed
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default StreakTracker;
