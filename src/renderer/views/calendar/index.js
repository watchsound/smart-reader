/**
 * LearningCalendarPage
 *
 * Full-page view for the Learning Calendar.
 * Provides comprehensive learning schedule management.
 */

import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Typography, Container } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

import { LearningCalendar } from '../../components/learning/LearningCalendar';

export default function LearningCalendarPage() {
  const theme = useTheme();
  const userInfo = useSelector((state) => state.user.userInfo);
  const token = userInfo?.token;

  return (
    <Box
      sx={{
        minHeight: '100%',
        width: '100%',
        bgcolor: theme.palette.mode === 'dark' ? '#1a1d21' : '#fafafa',
        pb: 4,
      }}
    >
      <Container maxWidth="lg" sx={{ pt: 3 }}>
        {/* Page Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            }}
          >
            <CalendarMonthIcon sx={{ color: '#fff', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Learning Calendar
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Track your learning schedule, streaks, and upcoming reviews
            </Typography>
          </Box>
        </Box>

        {/* Main Calendar Component */}
        {token ? (
          <LearningCalendar
            token={token}
            defaultView="month"
            layout="full"
            showStreak={true}
            showForecast={true}
            forecastDays={14}
            heatmapWeeks={26}
            showTitle={false}
          />
        ) : (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 3,
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
            }}
          >
            <Typography variant="body1" sx={{ color: theme.palette.warning.main }}>
              Please log in to view your learning calendar
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}
