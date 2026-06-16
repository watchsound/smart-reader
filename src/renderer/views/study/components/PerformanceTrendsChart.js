/**
 * PerformanceTrendsChart.js
 *
 * Displays performance trends over time using charts.
 * Shows accuracy, study time, and item count trends.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  TrendingFlat as TrendFlatIcon,
} from '@mui/icons-material';
import studyAnalyticsApi from '../../../api/studyAnalyticsApi';

/**
 * Simple line chart component (no external dependency)
 */
function SimpleLineChart({ data, dataKey, color, height = 120 }) {
  const theme = useTheme();

  const { points, minVal, maxVal, range } = useMemo(() => {
    const values = data.map((d) => d[dataKey] || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const r = max - min || 1;

    const pts = data.map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * 100;
      const y = 100 - ((d[dataKey] || 0) - min) / r * 100;
      return { x, y, value: d[dataKey] || 0, date: d.date };
    });

    return { points: pts, minVal: min, maxVal: max, range: r };
  }, [data, dataKey]);

  if (data.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Typography color="text.secondary" variant="caption">
          No data available
        </Typography>
      </Box>
    );
  }

  // Create SVG path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Create area path (for fill)
  const areaD = `${pathD} L ${points[points.length - 1].x} 100 L 0 100 Z`;

  return (
    <Box sx={{ position: 'relative', height }}>
      <svg
        width="100%"
        height={height}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke={theme.palette.divider}
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Area fill */}
        <path
          d={areaD}
          fill={alpha(color, 0.1)}
        />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={color}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* Y-axis labels */}
      <Box
        sx={{
          position: 'absolute',
          left: -30,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {Math.round(maxVal)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {Math.round(minVal)}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Trend indicator component
 */
function TrendIndicator({ current, previous }) {
  const change = current - previous;
  const percentChange = previous > 0 ? (change / previous) * 100 : 0;

  if (Math.abs(percentChange) < 1) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
        <TrendFlatIcon fontSize="small" />
        <Typography variant="caption">Stable</Typography>
      </Box>
    );
  }

  const isUp = change > 0;
  const Icon = isUp ? TrendUpIcon : TrendDownIcon;
  const color = isUp ? 'success.main' : 'error.main';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color }}>
      <Icon fontSize="small" />
      <Typography variant="caption">
        {isUp ? '+' : ''}{Math.round(percentChange)}%
      </Typography>
    </Box>
  );
}

/**
 * Main PerformanceTrendsChart component
 */
export default function PerformanceTrendsChart({
  token,
  topicId = null,
  defaultPeriod = 30,
}) {
  const theme = useTheme();
  const [period, setPeriod] = useState(defaultPeriod);
  const [trends, setTrends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load trends
  useEffect(() => {
    if (!token) return undefined;
    // Race guard: rapid period/topicId changes (user clicks period
    // selector, parent nav switches topic) fire overlapping fetches; the
    // slower one can land last and overwrite the newer's setTrends.
    let cancelled = false;
    const loadTrends = async () => {
      setIsLoading(true);
      try {
        const result = await studyAnalyticsApi.getPerformanceTrends(
          token,
          period,
          topicId,
        );
        if (cancelled) return;
        if (result.success) {
          setTrends(result.trends);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadTrends();
    return () => {
      cancelled = true;
    };
  }, [token, period, topicId]);

  // Calculate summary stats
  const summary = useMemo(() => {
    if (trends.length === 0) {
      return {
        avgAccuracy: 0,
        totalMinutes: 0,
        totalItems: 0,
        prevAccuracy: 0,
        prevMinutes: 0,
        prevItems: 0,
      };
    }

    const midpoint = Math.floor(trends.length / 2);
    const firstHalf = trends.slice(0, midpoint);
    const secondHalf = trends.slice(midpoint);

    const sum = (arr, key) => arr.reduce((s, t) => s + (t[key] || 0), 0);
    const avg = (arr, key) => sum(arr, key) / Math.max(arr.length, 1);

    return {
      avgAccuracy: avg(secondHalf, 'accuracy'),
      totalMinutes: sum(trends, 'totalMinutes'),
      totalItems: sum(trends, 'totalItems'),
      prevAccuracy: avg(firstHalf, 'accuracy'),
      prevMinutes: sum(firstHalf, 'totalMinutes'),
      prevItems: sum(firstHalf, 'totalItems'),
    };
  }, [trends]);

  const handlePeriodChange = (event, newPeriod) => {
    if (newPeriod !== null) {
      setPeriod(newPeriod);
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={120} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={120} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Period selector */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={handlePeriodChange}
          size="small"
        >
          <ToggleButton value={7}>7D</ToggleButton>
          <ToggleButton value={30}>30D</ToggleButton>
          <ToggleButton value={90}>90D</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Accuracy trend */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Accuracy
            </Typography>
            <Typography variant="h6">
              {summary.avgAccuracy.toFixed(1)}%
            </Typography>
          </Box>
          <TrendIndicator
            current={summary.avgAccuracy}
            previous={summary.prevAccuracy}
          />
        </Box>
        <Box sx={{ pl: 4 }}>
          <SimpleLineChart
            data={trends}
            dataKey="accuracy"
            color={theme.palette.primary.main}
          />
        </Box>
      </Paper>

      {/* Study time trend */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Study Time
            </Typography>
            <Typography variant="h6">
              {Math.round(summary.totalMinutes)} min
            </Typography>
          </Box>
          <TrendIndicator
            current={summary.totalMinutes - summary.prevMinutes}
            previous={summary.prevMinutes}
          />
        </Box>
        <Box sx={{ pl: 4 }}>
          <SimpleLineChart
            data={trends}
            dataKey="totalMinutes"
            color={theme.palette.info.main}
          />
        </Box>
      </Paper>

      {/* Items reviewed trend */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Items Reviewed
            </Typography>
            <Typography variant="h6">
              {summary.totalItems}
            </Typography>
          </Box>
          <TrendIndicator
            current={summary.totalItems - summary.prevItems}
            previous={summary.prevItems}
          />
        </Box>
        <Box sx={{ pl: 4 }}>
          <SimpleLineChart
            data={trends}
            dataKey="totalItems"
            color={theme.palette.success.main}
          />
        </Box>
      </Paper>
    </Box>
  );
}
