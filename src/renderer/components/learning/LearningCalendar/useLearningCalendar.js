/**
 * useLearningCalendar.js
 *
 * React hook for fetching and aggregating learning calendar data.
 * Combines data from multiple sources:
 * - Spaced repetition forecasts
 * - Review history
 * - Learning sessions
 * - Streak calculations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import spacedRepetitionApi from '../../../api/spacedRepetitionApi';

/**
 * Calculate streak data from review history
 */
function calculateStreaks(reviewHistory) {
  if (!reviewHistory || !Array.isArray(reviewHistory) || reviewHistory.length === 0) {
    return { current: 0, longest: 0, thisWeek: 0, thisMonth: 0 };
  }

  // Get unique review dates
  const reviewDates = new Set(
    reviewHistory.map((r) => {
      const d = new Date(r.reviewed_at || r.reviewedAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = new Date(today);

  // Check if studied today
  const todayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
  if (!reviewDates.has(todayKey)) {
    // Check yesterday (streak might still be valid)
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
    if (reviewDates.has(key)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  const sortedDates = Array.from(reviewDates)
    .map((d) => {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m, day);
    })
    .sort((a, b) => a - b);

  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // This week and month counts
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  let thisWeek = 0;
  let thisMonth = 0;

  sortedDates.forEach((d) => {
    if (d >= weekAgo) thisWeek++;
    if (d >= monthAgo) thisMonth++;
  });

  return { current: currentStreak, longest: longestStreak, thisWeek, thisMonth };
}

/**
 * Aggregate daily data from review history
 */
function aggregateDailyData(reviewHistory, forecast) {
  const dailyData = {};

  // Process review history (past data) - ensure it's an array
  if (reviewHistory && Array.isArray(reviewHistory)) {
    reviewHistory.forEach((review) => {
      const date = new Date(review.reviewed_at || review.reviewedAt);
      const key = date.toISOString().split('T')[0];

      if (!dailyData[key]) {
        dailyData[key] = {
          date: key,
          reviewed: 0,
          correct: 0,
          timeSpent: 0,
          sessions: 0,
          scheduled: 0,
          isToday: false,
          isPast: true,
          isFuture: false,
        };
      }

      dailyData[key].reviewed++;
      if (review.rating >= 3) {
        dailyData[key].correct++;
      }
    });
  }

  // Process forecast (future data) - ensure it's an array
  if (forecast && Array.isArray(forecast)) {
    forecast.forEach((day) => {
      const key = new Date(day.date).toISOString().split('T')[0];

      if (!dailyData[key]) {
        dailyData[key] = {
          date: key,
          reviewed: 0,
          correct: 0,
          timeSpent: 0,
          sessions: 0,
          scheduled: 0,
          isToday: false,
          isPast: false,
          isFuture: true,
        };
      }

      dailyData[key].scheduled = day.dueCount || 0;
      dailyData[key].isFuture = true;
    });
  }

  // Mark today
  const todayKey = new Date().toISOString().split('T')[0];
  if (dailyData[todayKey]) {
    dailyData[todayKey].isToday = true;
    dailyData[todayKey].isPast = false;
    dailyData[todayKey].isFuture = false;
  }

  return dailyData;
}

/**
 * Calculate intensity level (0-4) for heatmap coloring
 */
function calculateIntensity(count, maxCount) {
  if (count === 0) return 0;
  if (maxCount === 0) return 1;

  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Main hook for learning calendar data
 */
export default function useLearningCalendar(token, options = {}) {
  const {
    forecastDays = 30,
    historyDays = 365,
    autoRefresh = false,
    refreshInterval = 60000, // 1 minute
  } = options;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    forecast: [],
    statistics: null,
    reviewHistory: [],
    dailyData: {},
    streaks: { current: 0, longest: 0, thisWeek: 0, thisMonth: 0 },
  });

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch data in parallel
      const [forecast, statistics, reviewHistory, dailyReviewData] = await Promise.all([
        spacedRepetitionApi.getForecast(token, forecastDays),
        spacedRepetitionApi.getStatistics(token, { days: historyDays }),
        spacedRepetitionApi.getReviewHistory(token, { days: historyDays }),
        spacedRepetitionApi.getDailyReviewData(token, { days: historyDays }),
      ]);

      // Merge daily review data with forecast
      const dailyData = aggregateDailyData(reviewHistory, forecast);

      // Use backend-aggregated data if available, otherwise use computed
      const mergedDailyData = { ...dailyData };
      if (dailyReviewData && typeof dailyReviewData === 'object' && !dailyReviewData.error) {
        Object.entries(dailyReviewData).forEach(([key, value]) => {
          if (value && typeof value === 'object') {
            mergedDailyData[key] = {
              ...mergedDailyData[key],
              ...value,
            };
          }
        });
      }

      // Ensure arrays are actually arrays, not error objects
      const safeReviewHistory = Array.isArray(reviewHistory) ? reviewHistory : [];
      const safeForecast = Array.isArray(forecast) ? forecast : [];
      const streaks = calculateStreaks(safeReviewHistory);

      setData({
        forecast: safeForecast,
        statistics: statistics && !statistics.error ? statistics : {},
        reviewHistory: safeReviewHistory,
        dailyData: mergedDailyData,
        streaks,
      });
    } catch (err) {
      console.error('useLearningCalendar error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, forecastDays, historyDays]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  // Computed values
  const computed = useMemo(() => {
    const { forecast, statistics, dailyData } = data;

    // Today's workload
    const todayKey = new Date().toISOString().split('T')[0];
    const todayData = dailyData[todayKey] || { scheduled: 0, reviewed: 0 };

    // Calculate max for intensity
    const allCounts = Object.values(dailyData).map(
      (d) => d.reviewed + d.scheduled
    );
    const maxCount = Math.max(...allCounts, 1);

    // Add intensity to daily data
    const dailyDataWithIntensity = {};
    Object.entries(dailyData).forEach(([key, value]) => {
      dailyDataWithIntensity[key] = {
        ...value,
        intensity: calculateIntensity(value.reviewed + value.scheduled, maxCount),
      };
    });

    // Workload analysis - ensure forecast is an array
    const forecastArray = Array.isArray(forecast) ? forecast : [];
    const upcomingDays = forecastArray.slice(0, 7);
    const avgWorkload =
      upcomingDays.reduce((sum, d) => sum + (d.dueCount || 0), 0) /
      Math.max(upcomingDays.length, 1);

    const heavyDays = upcomingDays.filter((d) => (d.dueCount || 0) > avgWorkload * 1.5);
    const lightDays = upcomingDays.filter((d) => (d.dueCount || 0) < avgWorkload * 0.5);

    // Retention rate
    const retentionRate = statistics?.retentionRate || 0;

    return {
      todayDue: todayData.scheduled,
      todayCompleted: todayData.reviewed,
      avgDailyWorkload: Math.round(avgWorkload),
      heavyDays: heavyDays.length,
      lightDays: lightDays.length,
      retentionRate,
      dailyDataWithIntensity,
      maxCount,
    };
  }, [data]);

  return {
    loading,
    error,
    ...data,
    ...computed,
    refresh: fetchData,
  };
}
