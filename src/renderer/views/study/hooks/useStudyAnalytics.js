/**
 * useStudyAnalytics.js
 *
 * React hook for study session analytics and insights.
 * Provides easy access to:
 * - Dashboard summary
 * - Performance trends
 * - Learning velocity
 * - Optimal study times
 * - Weak items
 * - Session history
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import studyAnalyticsApi, {
  calculateFocusScore,
  calculateEfficiencyScore,
  calculateRetentionRate,
  getPerformanceLevel,
} from '../../../api/studyAnalyticsApi';

/**
 * Main analytics hook
 * @param {Object} options - Hook options
 * @param {string} options.token - User token
 * @param {boolean} options.autoLoad - Auto-load data on mount
 * @param {number} options.refreshInterval - Auto-refresh interval in ms
 */
export default function useStudyAnalytics(options = {}) {
  const { token, autoLoad = false, refreshInterval = 0 } = options;

  // State
  const [dashboard, setDashboard] = useState(null);
  const [trends, setTrends] = useState([]);
  const [velocity, setVelocity] = useState(null);
  const [optimalTimes, setOptimalTimes] = useState(null);
  const [weakItems, setWeakItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Session tracking for analytics recording
  const sessionMetricsRef = useRef({
    startTime: null,
    reviews: [],
    hintsUsed: 0,
    pauseCount: 0,
    conceptsImproved: [],
  });

  // Load dashboard summary
  const loadDashboard = useCallback(async () => {
    if (!token) return null;

    try {
      setIsLoading(true);
      const result = await studyAnalyticsApi.getDashboardSummary(token);
      if (result.success) {
        setDashboard(result.summary);
        return result;
      } else {
        setError(result.error);
        return null;
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Load performance trends
  const loadTrends = useCallback(
    async (days = 30, topicId = null) => {
      if (!token) return [];

      try {
        setIsLoading(true);
        const result = await studyAnalyticsApi.getPerformanceTrends(
          token,
          days,
          topicId,
        );
        if (result.success) {
          setTrends(result.trends);
          return result.trends;
        }
        return [];
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  // Load learning velocity
  const loadVelocity = useCallback(
    async (days = 7) => {
      if (!token) return null;

      try {
        const result = await studyAnalyticsApi.getAggregateVelocity(token, days);
        if (result.success) {
          setVelocity(result.aggregate);
          return result.aggregate;
        }
        return null;
      } catch (err) {
        setError(err.message);
        return null;
      }
    },
    [token],
  );

  // Load optimal study times
  const loadOptimalTimes = useCallback(
    async (days = 90) => {
      if (!token) return null;

      try {
        const result = await studyAnalyticsApi.analyzeOptimalStudyTimes(
          token,
          days,
        );
        if (result.success) {
          setOptimalTimes(result.analysis);
          return result.analysis;
        }
        return null;
      } catch (err) {
        setError(err.message);
        return null;
      }
    },
    [token],
  );

  // Load weak items
  const loadWeakItems = useCallback(
    async (topicId = null, limit = 20) => {
      if (!token) return [];

      try {
        const result = await studyAnalyticsApi.identifyWeakItems(
          token,
          topicId,
          limit,
        );
        if (result.success) {
          setWeakItems(result.weakItems);
          return result.weakItems;
        }
        return [];
      } catch (err) {
        setError(err.message);
        return [];
      }
    },
    [token],
  );

  // Load all data
  const loadAll = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      await Promise.all([
        loadDashboard(),
        loadTrends(30),
        loadVelocity(7),
        loadWeakItems(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [token, loadDashboard, loadTrends, loadVelocity, loadWeakItems]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && token) {
      loadAll();
    }
  }, [autoLoad, token, loadAll]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0 && token) {
      const interval = setInterval(loadDashboard, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, token, loadDashboard]);

  // ===========================================================================
  // SESSION TRACKING
  // ===========================================================================

  /**
   * Start tracking a new session
   */
  const startSessionTracking = useCallback(() => {
    sessionMetricsRef.current = {
      startTime: Date.now(),
      reviews: [],
      hintsUsed: 0,
      pauseCount: 0,
      conceptsImproved: [],
    };
  }, []);

  /**
   * Record a review event
   * @param {Object} review - Review data
   */
  const recordReview = useCallback((review) => {
    sessionMetricsRef.current.reviews.push({
      ...review,
      timestamp: Date.now(),
    });
  }, []);

  /**
   * Record hint usage
   */
  const recordHintUsed = useCallback(() => {
    sessionMetricsRef.current.hintsUsed++;
  }, []);

  /**
   * Record a pause
   */
  const recordPause = useCallback(() => {
    sessionMetricsRef.current.pauseCount++;
  }, []);

  /**
   * Record concept improvement
   * @param {Object} concept - Concept that improved
   */
  const recordConceptImproved = useCallback((concept) => {
    sessionMetricsRef.current.conceptsImproved.push(concept);
  }, []);

  /**
   * End session and record analytics
   * @param {string} sessionId - Session ID
   * @param {Object} sessionResults - Session results from study session
   */
  const endSessionAndRecord = useCallback(
    async (sessionId, sessionResults) => {
      if (!token || !sessionId) return null;

      const metrics = sessionMetricsRef.current;
      const reviews = metrics.reviews;

      // Calculate analytics
      const totalItems = reviews.length;
      const correctCount = reviews.filter((r) => r.wasCorrect).length;
      const totalResponseTime = reviews.reduce(
        (sum, r) => sum + (r.responseTimeMs || 0),
        0,
      );
      const avgResponseTimeMs =
        totalItems > 0 ? totalResponseTime / totalItems : 0;

      const focusScore = calculateFocusScore({
        avgResponseTimeMs,
        hintRatio: totalItems > 0 ? metrics.hintsUsed / totalItems : 0,
        pauseCount: metrics.pauseCount,
        totalItems,
      });

      const accuracy = totalItems > 0 ? (correctCount / totalItems) * 100 : 0;
      const durationMinutes = sessionResults?.durationMinutes || 0;

      const efficiencyScore = calculateEfficiencyScore({
        accuracy,
        avgTimePerItem: avgResponseTimeMs,
        targetTimePerItem: 5000,
        itemsReviewed: totalItems,
        durationMinutes,
      });

      const retentionRate = calculateRetentionRate(reviews);

      // Find longest streak
      let currentStreak = 0;
      let maxStreak = 0;
      for (const review of reviews) {
        if (review.wasCorrect) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      const analytics = {
        focusScore,
        efficiencyScore,
        avgResponseTimeMs: Math.round(avgResponseTimeMs),
        retentionRate,
        streakLength: maxStreak,
        hintsUsed: metrics.hintsUsed,
        conceptsImproved: metrics.conceptsImproved,
        accuracy,
        itemsReviewed: totalItems,
        durationMinutes,
      };

      try {
        const result = await studyAnalyticsApi.recordSessionAnalytics(
          sessionId,
          analytics,
          token,
        );

        // Also record velocity
        if (sessionResults?.masteryStart !== undefined) {
          await studyAnalyticsApi.recordLearningVelocity(
            {
              topicId: sessionResults.topicId,
              masteryStart: sessionResults.masteryStart,
              masteryEnd: sessionResults.masteryEnd || sessionResults.masteryStart,
              itemsStudied: totalItems,
              timeSpentMinutes: durationMinutes,
            },
            token,
          );
        }

        // Reset tracking
        startSessionTracking();

        return { success: true, analytics };
      } catch (err) {
        console.error('Failed to record session analytics:', err);
        return { success: false, error: err.message };
      }
    },
    [token, startSessionTracking],
  );

  // ===========================================================================
  // COMPUTED VALUES
  // ===========================================================================

  /**
   * Get performance level based on recent trends
   */
  const performanceLevel = useMemo(() => {
    if (!trends || trends.length === 0) return null;

    const recentAvg =
      trends
        .slice(-7)
        .reduce((sum, t) => sum + (t.accuracy || 0), 0) /
      Math.min(trends.length, 7);

    return getPerformanceLevel(recentAvg);
  }, [trends]);

  /**
   * Get velocity trend (improving, stable, declining)
   */
  const velocityTrend = useMemo(() => {
    if (!velocity) return 'unknown';

    const weeklyVelocity = parseFloat(velocity.velocityPerWeek);
    if (weeklyVelocity > 5) return 'improving';
    if (weeklyVelocity > -5) return 'stable';
    return 'declining';
  }, [velocity]);

  /**
   * Get study recommendation based on optimal times
   */
  const studyRecommendation = useMemo(() => {
    if (!optimalTimes?.recommendations) return null;
    return optimalTimes.recommendations.suggestion;
  }, [optimalTimes]);

  /**
   * Get priority weak items (top 5)
   */
  const priorityWeakItems = useMemo(() => {
    return weakItems.slice(0, 5);
  }, [weakItems]);

  return {
    // Data
    dashboard,
    trends,
    velocity,
    optimalTimes,
    weakItems,

    // Computed
    performanceLevel,
    velocityTrend,
    studyRecommendation,
    priorityWeakItems,

    // State
    isLoading,
    error,

    // Actions - Data Loading
    loadDashboard,
    loadTrends,
    loadVelocity,
    loadOptimalTimes,
    loadWeakItems,
    loadAll,
    refresh: loadAll,

    // Actions - Session Tracking
    startSessionTracking,
    recordReview,
    recordHintUsed,
    recordPause,
    recordConceptImproved,
    endSessionAndRecord,

    // API access for direct calls
    api: studyAnalyticsApi,
  };
}

// ===========================================================================
// SPECIALIZED HOOKS
// ===========================================================================

/**
 * Hook for session history with pagination
 */
export function useSessionHistory(options = {}) {
  const { token, topicId = null, pageSize = 20 } = options;

  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadPage = useCallback(
    async (pageNum = 0) => {
      if (!token) return;

      setIsLoading(true);
      try {
        const result = await studyAnalyticsApi.getSessionHistory(token, {
          limit: pageSize,
          offset: pageNum * pageSize,
          topicId,
        });

        if (result.success) {
          setSessions(result.sessions);
          setTotal(result.total);
          setHasMore(result.hasMore);
          setPage(pageNum);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [token, topicId, pageSize],
  );

  const nextPage = useCallback(() => {
    if (hasMore) {
      loadPage(page + 1);
    }
  }, [hasMore, page, loadPage]);

  const prevPage = useCallback(() => {
    if (page > 0) {
      loadPage(page - 1);
    }
  }, [page, loadPage]);

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  return {
    sessions,
    total,
    page,
    pageSize,
    hasMore,
    hasPrev: page > 0,
    isLoading,
    loadPage,
    nextPage,
    prevPage,
    refresh: () => loadPage(page),
  };
}

/**
 * Hook for performance comparison (week over week)
 */
export function usePerformanceComparison(token) {
  const [comparison, setComparison] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadComparison = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const [thisWeek, lastWeek] = await Promise.all([
        studyAnalyticsApi.getPerformanceTrends(token, 7),
        studyAnalyticsApi.getPerformanceTrends(token, 14),
      ]);

      if (thisWeek.success && lastWeek.success) {
        const thisWeekData = thisWeek.trends;
        const lastWeekData = lastWeek.trends.slice(0, 7);

        const thisWeekAvg =
          thisWeekData.reduce((sum, t) => sum + (t.accuracy || 0), 0) /
          Math.max(thisWeekData.length, 1);

        const lastWeekAvg =
          lastWeekData.reduce((sum, t) => sum + (t.accuracy || 0), 0) /
          Math.max(lastWeekData.length, 1);

        const thisWeekMinutes = thisWeekData.reduce(
          (sum, t) => sum + (t.totalMinutes || 0),
          0,
        );
        const lastWeekMinutes = lastWeekData.reduce(
          (sum, t) => sum + (t.totalMinutes || 0),
          0,
        );

        const thisWeekItems = thisWeekData.reduce(
          (sum, t) => sum + (t.totalItems || 0),
          0,
        );
        const lastWeekItems = lastWeekData.reduce(
          (sum, t) => sum + (t.totalItems || 0),
          0,
        );

        setComparison({
          accuracy: {
            thisWeek: thisWeekAvg,
            lastWeek: lastWeekAvg,
            change: thisWeekAvg - lastWeekAvg,
            trend: thisWeekAvg > lastWeekAvg ? 'up' : thisWeekAvg < lastWeekAvg ? 'down' : 'same',
          },
          studyTime: {
            thisWeek: thisWeekMinutes,
            lastWeek: lastWeekMinutes,
            change: thisWeekMinutes - lastWeekMinutes,
            changePercent:
              lastWeekMinutes > 0
                ? ((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100
                : 0,
          },
          itemsReviewed: {
            thisWeek: thisWeekItems,
            lastWeek: lastWeekItems,
            change: thisWeekItems - lastWeekItems,
          },
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadComparison();
  }, [loadComparison]);

  return { comparison, isLoading, refresh: loadComparison };
}

/**
 * Hook for export functionality
 */
export function useExportAnalytics(token) {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = useCallback(
    async (options = {}) => {
      if (!token) return null;

      setIsExporting(true);
      try {
        const result = await studyAnalyticsApi.exportSessionData(token, options);
        return result;
      } finally {
        setIsExporting(false);
      }
    },
    [token],
  );

  const downloadJSON = useCallback(
    async (options = {}) => {
      const result = await exportData({ ...options, format: 'json' });
      if (result?.success && result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `study_analytics_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return true;
      }
      return false;
    },
    [exportData],
  );

  const downloadCSV = useCallback(
    async (options = {}) => {
      const result = await exportData({ ...options, format: 'csv' });
      if (result?.success && result.data?.content) {
        const blob = new Blob([result.data.content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename || 'study_analytics.csv';
        a.click();
        URL.revokeObjectURL(url);
        return true;
      }
      return false;
    },
    [exportData],
  );

  return {
    isExporting,
    exportData,
    downloadJSON,
    downloadCSV,
  };
}
