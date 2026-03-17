/**
 * AnalyticsDashboard.js
 *
 * Main analytics dashboard component that brings together all analytics features:
 * - Dashboard summary (today, this week, streak, velocity)
 * - Performance trends
 * - Session history
 * - Weak items
 * - Optimal study times
 * - Export functionality
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Tabs,
  Tab,
  Chip,
  Button,
  Divider,
  IconButton,
  Tooltip,
  Skeleton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as TrendIcon,
  History as HistoryIcon,
  Warning as WeakIcon,
  Schedule as TimeIcon,
  Download as ExportIcon,
  Refresh as RefreshIcon,
  LocalFireDepartment as StreakIcon,
  Speed as VelocityIcon,
  CheckCircle as AccuracyIcon,
  Timer as DurationIcon,
  ViewList as ItemsIcon,
} from '@mui/icons-material';
import useStudyAnalytics, { useExportAnalytics } from '../hooks/useStudyAnalytics';
import SessionHistoryPanel from './SessionHistoryPanel';
import PerformanceTrendsChart from './PerformanceTrendsChart';
import WeakItemsPanel from './WeakItemsPanel';
import OptimalTimeRecommendation from './OptimalTimeRecommendation';
import { formatDuration, getPerformanceLevel } from '../../../api/studyAnalyticsApi';

/**
 * Stat card component
 */
function StatCard({ icon, label, value, subValue, color = 'primary', trend }) {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box
          sx={{
            p: 0.5,
            borderRadius: 1,
            bgcolor: alpha(theme.palette[color].main, 0.1),
            color: `${color}.main`,
          }}
        >
          {icon}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
      <Typography variant="h5" fontWeight={600}>
        {value}
      </Typography>
      {subValue && (
        <Typography variant="caption" color="text.secondary">
          {subValue}
        </Typography>
      )}
      {trend && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mt: 0.5,
            color:
              trend === 'up'
                ? 'success.main'
                : trend === 'down'
                  ? 'error.main'
                  : 'text.secondary',
          }}
        >
          <TrendIcon
            fontSize="small"
            sx={{
              transform: trend === 'down' ? 'rotate(180deg)' : 'none',
            }}
          />
          <Typography variant="caption">{trend}</Typography>
        </Box>
      )}
    </Paper>
  );
}

/**
 * Tab panel wrapper
 */
function TabPanel({ children, value, index, ...other }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </Box>
  );
}

/**
 * Main AnalyticsDashboard component
 */
export default function AnalyticsDashboard({
  token,
  topicId = null,
  onStudyWeakItem,
  onStudyAllWeakItems,
}) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  const {
    dashboard,
    velocity,
    performanceLevel,
    velocityTrend,
    isLoading,
    loadAll,
    loadDashboard,
  } = useStudyAnalytics({ token, autoLoad: true });

  const { isExporting, downloadJSON, downloadCSV } = useExportAnalytics(token);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleExportJSON = async () => {
    await downloadJSON({ includeItems: true });
  };

  const handleExportCSV = async () => {
    await downloadCSV();
  };

  // Loading state
  if (isLoading && !dashboard) {
    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rectangular" height={300} sx={{ mt: 3, borderRadius: 1 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Study Analytics
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={loadDashboard} disabled={isLoading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ExportIcon />}
            onClick={handleExportJSON}
            disabled={isExporting}
          >
            Export
          </Button>
        </Box>
      </Box>

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Today's Progress */}
        <Grid item xs={6} sm={3}>
          <StatCard
            icon={<ItemsIcon fontSize="small" />}
            label="Today"
            value={dashboard?.today?.items || 0}
            subValue={`${formatDuration(dashboard?.today?.minutes || 0)} studied`}
            color="primary"
          />
        </Grid>

        {/* Weekly Progress */}
        <Grid item xs={6} sm={3}>
          <StatCard
            icon={<AccuracyIcon fontSize="small" />}
            label="This Week"
            value={`${dashboard?.thisWeek?.accuracy || 0}%`}
            subValue={`${dashboard?.thisWeek?.items || 0} items reviewed`}
            color="success"
          />
        </Grid>

        {/* Streak */}
        <Grid item xs={6} sm={3}>
          <StatCard
            icon={<StreakIcon fontSize="small" />}
            label="Current Streak"
            value={`${dashboard?.currentStreak || 0} days`}
            subValue={
              dashboard?.currentStreak >= 7
                ? '🔥 On fire!'
                : dashboard?.currentStreak > 0
                  ? 'Keep it up!'
                  : 'Start a streak today!'
            }
            color="warning"
          />
        </Grid>

        {/* Learning Velocity */}
        <Grid item xs={6} sm={3}>
          <StatCard
            icon={<VelocityIcon fontSize="small" />}
            label="Weekly Velocity"
            value={`${velocity?.velocityPerWeek || 0}%`}
            subValue={
              velocityTrend === 'improving'
                ? 'Improving'
                : velocityTrend === 'declining'
                  ? 'Declining'
                  : 'Stable'
            }
            color="info"
            trend={velocityTrend}
          />
        </Grid>
      </Grid>

      {/* Performance Level Badge */}
      {performanceLevel && (
        <Box sx={{ mb: 3 }}>
          <Paper
            sx={{
              p: 2,
              bgcolor: alpha(performanceLevel.color, 0.1),
              border: `1px solid ${alpha(performanceLevel.color, 0.3)}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: performanceLevel.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h6" color="white">
                  {performanceLevel.label[0]}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {performanceLevel.label} Performance
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Based on your recent 7-day accuracy trend
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Tabs */}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<TrendIcon fontSize="small" />}
            iconPosition="start"
            label="Trends"
          />
          <Tab
            icon={<HistoryIcon fontSize="small" />}
            iconPosition="start"
            label="History"
          />
          <Tab
            icon={<WeakIcon fontSize="small" />}
            iconPosition="start"
            label="Weak Items"
          />
          <Tab
            icon={<TimeIcon fontSize="small" />}
            iconPosition="start"
            label="Best Times"
          />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {/* Trends Tab */}
          <TabPanel value={activeTab} index={0}>
            <PerformanceTrendsChart token={token} topicId={topicId} />
          </TabPanel>

          {/* History Tab */}
          <TabPanel value={activeTab} index={1}>
            <SessionHistoryPanel token={token} topicId={topicId} />
          </TabPanel>

          {/* Weak Items Tab */}
          <TabPanel value={activeTab} index={2}>
            <WeakItemsPanel
              token={token}
              topicId={topicId}
              onStudyItem={onStudyWeakItem}
              onStudyAll={onStudyAllWeakItems}
            />
          </TabPanel>

          {/* Best Times Tab */}
          <TabPanel value={activeTab} index={3}>
            <OptimalTimeRecommendation token={token} />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

/**
 * Compact version for embedding in other views
 */
export function AnalyticsSummaryCard({ token }) {
  const { dashboard, velocity, isLoading, loadDashboard } = useStudyAnalytics({
    token,
    autoLoad: true,
    refreshInterval: 60000, // Refresh every minute
  });

  if (isLoading && !dashboard) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={100} />
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2">Today's Progress</Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadDashboard}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            {dashboard?.today?.items || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            items reviewed
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box>
          <Typography variant="h4" fontWeight={600}>
            {dashboard?.today?.accuracy || 0}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            accuracy
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StreakIcon color="warning" fontSize="small" />
            <Typography variant="h4" fontWeight={600}>
              {dashboard?.currentStreak || 0}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            day streak
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
