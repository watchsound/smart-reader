/**
 * LearnerProfileInference.js
 *
 * Infers learner profile characteristics from behavioral data:
 * - Learning style (visual, reading, hands-on, auditory)
 * - Optimal study times
 * - Session duration preferences
 * - Forgetting curve modeling
 * - Pace and engagement patterns
 *
 * Uses episode data and session analytics to build a comprehensive learner model.
 */

class LearnerProfileInference {
  constructor(services = {}) {
    this.episodeCollector = services.episodeCollector;
    this.sessionAnalyticsManager = services.sessionAnalyticsManager;
    this.learnerProfileManager = services.learnerProfileManager;
    this.aiProvider = services.aiProvider;

    // Configuration
    this.config = {
      minSessionsForInference: 5,
      minEpisodesForInference: 20,
      lookbackDays: 30,
      styleScoreDecay: 0.8, // Weight for existing style scores
    };
  }

  /**
   * Run full profile inference
   * @param {number} userId
   * @param {string} token
   * @param {Object} options
   * @returns {Object} Inferred profile updates
   */
  async inferProfile(userId, token, options = {}) {
    const lookbackDays = options.lookbackDays || this.config.lookbackDays;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    console.log(`[LearnerProfileInference] Inferring profile for user ${userId}`);

    // Gather data
    const episodes = await this.getEpisodes(userId, startDate, endDate);
    const sessionAnalytics = await this.getSessionAnalytics(userId, startDate, endDate, token);

    if (
      episodes.length < this.config.minEpisodesForInference ||
      sessionAnalytics.length < this.config.minSessionsForInference
    ) {
      return {
        success: true,
        message: 'Not enough data for inference',
        episodeCount: episodes.length,
        sessionCount: sessionAnalytics.length,
      };
    }

    // Run inference components
    const inferences = {
      learningStyle: this.inferLearningStyle(episodes),
      optimalTiming: this.inferOptimalTiming(sessionAnalytics),
      sessionPreferences: this.inferSessionPreferences(sessionAnalytics),
      forgettingCurve: this.inferForgettingCurve(episodes),
      pacePreferences: this.inferPacePreferences(episodes, sessionAnalytics),
      engagementPatterns: this.inferEngagementPatterns(sessionAnalytics),
      performancePatterns: this.inferPerformancePatterns(episodes),
    };

    // Build profile update recommendations
    const profileUpdates = this.buildProfileUpdates(inferences);

    return {
      success: true,
      userId,
      analyzedAt: new Date().toISOString(),
      episodeCount: episodes.length,
      sessionCount: sessionAnalytics.length,
      inferences,
      profileUpdates,
    };
  }

  /**
   * Infer learning style from behavioral signals
   */
  inferLearningStyle(episodes) {
    const scores = {
      visual: 0,
      reading: 0,
      hands_on: 0,
      auditory: 0,
    };

    let totalSignals = 0;

    for (const ep of episodes) {
      const payload = typeof ep.payload === 'string' ? JSON.parse(ep.payload) : ep.payload || {};
      const context = typeof ep.sourceContext === 'string'
        ? JSON.parse(ep.sourceContext)
        : ep.sourceContext || {};

      // Visual signals
      if (
        context.contentType === 'image' ||
        context.view === 'moodboard' ||
        payload.diagramUsed ||
        context.view === 'mindmap'
      ) {
        scores.visual++;
        totalSignals++;
      }

      // Reading signals
      if (
        ep.eventType === 'HIGHLIGHT_CREATED' ||
        ep.eventType === 'NOTE_CREATED' ||
        (context.view === 'reading' && (payload.durationMinutes || 0) > 5)
      ) {
        scores.reading++;
        totalSignals++;
      }

      // Hands-on signals
      if (
        ep.eventType === 'QUIZ_TAKEN' ||
        ep.eventType === 'REVIEW_COMPLETED' ||
        payload.practiceMode === true
      ) {
        scores.hands_on++;
        totalSignals++;
      }

      // Auditory signals
      if (payload.ttsUsed === true || context.contentType === 'audio') {
        scores.auditory++;
        totalSignals++;
      }
    }

    // Normalize scores
    if (totalSignals > 0) {
      for (const key of Object.keys(scores)) {
        scores[key] = scores[key] / totalSignals;
      }
    } else {
      // Default to equal distribution
      for (const key of Object.keys(scores)) {
        scores[key] = 0.25;
      }
    }

    // Determine dominant style
    const entries = Object.entries(scores);
    const maxScore = Math.max(...entries.map(([, v]) => v));
    const minScore = Math.min(...entries.map(([, v]) => v));

    let dominantStyle = 'mixed';
    if (maxScore - minScore >= 0.15) {
      const dominant = entries.find(([, v]) => v === maxScore);
      dominantStyle = dominant?.[0] || 'mixed';
    }

    return {
      scores,
      dominantStyle,
      confidence: maxScore - minScore, // Higher = more confident
      totalSignals,
    };
  }

  /**
   * Infer optimal study timing
   */
  inferOptimalTiming(sessionAnalytics) {
    if (!sessionAnalytics.length) {
      return { preferredTimeOfDay: 'any', optimalHours: [], confidence: 0 };
    }

    // Group by hour
    const byHour = {};
    for (const session of sessionAnalytics) {
      const hour = session.hour_of_day;
      if (hour === undefined || hour === null) continue;

      if (!byHour[hour]) {
        byHour[hour] = { sessions: [], totalEfficiency: 0, totalAccuracy: 0 };
      }
      byHour[hour].sessions.push(session);
      byHour[hour].totalEfficiency += session.efficiency_score || 50;
      byHour[hour].totalAccuracy += session.accuracy || 0.5;
    }

    // Calculate averages
    const hourlyPerformance = [];
    for (const [hour, data] of Object.entries(byHour)) {
      const count = data.sessions.length;
      if (count >= 2) {
        // Minimum 2 sessions for valid data
        hourlyPerformance.push({
          hour: parseInt(hour),
          avgEfficiency: data.totalEfficiency / count,
          avgAccuracy: data.totalAccuracy / count,
          sessionCount: count,
          combined: (data.totalEfficiency / count) * 0.6 + (data.totalAccuracy / count) * 40,
        });
      }
    }

    // Sort by performance
    hourlyPerformance.sort((a, b) => b.combined - a.combined);

    // Find best hours
    const bestHours = hourlyPerformance.slice(0, 3).map((h) => h.hour);

    // Determine time preference
    let preferredTimeOfDay = 'any';
    if (bestHours.length > 0) {
      const avgHour = bestHours.reduce((a, b) => a + b, 0) / bestHours.length;
      if (avgHour >= 5 && avgHour < 12) preferredTimeOfDay = 'morning';
      else if (avgHour >= 12 && avgHour < 17) preferredTimeOfDay = 'afternoon';
      else if (avgHour >= 17 && avgHour < 21) preferredTimeOfDay = 'evening';
      else preferredTimeOfDay = 'night';
    }

    // Day of week analysis
    const byDay = {};
    for (const session of sessionAnalytics) {
      const day = session.day_of_week;
      if (day === undefined || day === null) continue;

      if (!byDay[day]) {
        byDay[day] = { count: 0, totalEfficiency: 0 };
      }
      byDay[day].count++;
      byDay[day].totalEfficiency += session.efficiency_score || 50;
    }

    const preferredDays = Object.entries(byDay)
      .filter(([, data]) => data.count >= 2)
      .sort((a, b) => b[1].totalEfficiency / b[1].count - a[1].totalEfficiency / a[1].count)
      .slice(0, 3)
      .map(([day]) => this.dayNumberToName(parseInt(day)));

    return {
      preferredTimeOfDay,
      optimalHours: bestHours,
      hourlyPerformance: hourlyPerformance.slice(0, 5),
      preferredDays,
      confidence: Math.min(1, sessionAnalytics.length / 20),
    };
  }

  /**
   * Infer session duration preferences
   */
  inferSessionPreferences(sessionAnalytics) {
    if (!sessionAnalytics.length) {
      return { optimalMinutes: 20, preference: 'medium', confidence: 0 };
    }

    // Group by duration buckets
    const buckets = {
      short: { sessions: [], efficiency: 0 }, // <= 10 min
      medium: { sessions: [], efficiency: 0 }, // 10-25 min
      long: { sessions: [], efficiency: 0 }, // > 25 min
    };

    for (const session of sessionAnalytics) {
      const duration = session.duration_minutes;
      if (!duration) continue;

      const bucket = duration <= 10 ? 'short' : duration <= 25 ? 'medium' : 'long';
      buckets[bucket].sessions.push(session);
      buckets[bucket].efficiency += session.efficiency_score || 50;
    }

    // Calculate effectiveness per bucket
    const effectiveness = {};
    for (const [bucket, data] of Object.entries(buckets)) {
      if (data.sessions.length >= 2) {
        effectiveness[bucket] = {
          avgEfficiency: data.efficiency / data.sessions.length,
          sessionCount: data.sessions.length,
        };
      }
    }

    // Find best bucket
    let bestBucket = 'medium';
    let bestEfficiency = 0;
    for (const [bucket, data] of Object.entries(effectiveness)) {
      if (data.avgEfficiency > bestEfficiency) {
        bestEfficiency = data.avgEfficiency;
        bestBucket = bucket;
      }
    }

    // Calculate average duration in best bucket
    const bestSessions = buckets[bestBucket].sessions;
    const avgDuration =
      bestSessions.length > 0
        ? bestSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) /
          bestSessions.length
        : 20;

    // Detect focus decay point
    const focusDecayPoint = this.detectFocusDecayPoint(sessionAnalytics);

    return {
      optimalMinutes: Math.round(avgDuration),
      preference: bestBucket,
      effectiveness,
      focusDecayPoint,
      confidence: Math.min(1, sessionAnalytics.length / 15),
    };
  }

  /**
   * Detect when focus typically drops
   */
  detectFocusDecayPoint(sessionAnalytics) {
    // Sessions with focus score data
    const withFocus = sessionAnalytics.filter(
      (s) => s.focus_score !== undefined && s.duration_minutes,
    );

    if (withFocus.length < 5) return 25; // Default

    // Find duration where focus drops below average
    const avgFocus =
      withFocus.reduce((sum, s) => sum + s.focus_score, 0) / withFocus.length;

    // Group by 5-minute intervals and find where focus drops
    const byInterval = {};
    for (const session of withFocus) {
      const interval = Math.floor(session.duration_minutes / 5) * 5;
      if (!byInterval[interval]) {
        byInterval[interval] = { total: 0, count: 0 };
      }
      byInterval[interval].total += session.focus_score;
      byInterval[interval].count++;
    }

    // Find first interval where focus is below average
    const intervals = Object.entries(byInterval)
      .map(([interval, data]) => ({
        interval: parseInt(interval),
        avgFocus: data.total / data.count,
      }))
      .sort((a, b) => a.interval - b.interval);

    for (const { interval, avgFocus: intervalFocus } of intervals) {
      if (intervalFocus < avgFocus * 0.85) {
        // 15% below average
        return interval;
      }
    }

    return intervals[intervals.length - 1]?.interval || 30;
  }

  /**
   * Infer forgetting curve parameters
   */
  inferForgettingCurve(episodes) {
    const reviewEpisodes = episodes.filter((ep) => ep.eventType === 'REVIEW_COMPLETED');

    // Group by concept
    const byConcept = {};
    for (const ep of reviewEpisodes) {
      const payload = typeof ep.payload === 'string' ? JSON.parse(ep.payload) : ep.payload || {};
      const conceptKey = payload.conceptId || payload.conceptName || payload.word;
      if (!conceptKey) continue;

      if (!byConcept[conceptKey]) {
        byConcept[conceptKey] = [];
      }
      byConcept[conceptKey].push({
        ...ep,
        payload,
        timestamp: new Date(ep.timestamp || ep.t_valid),
      });
    }

    // Find decay events and calculate retention
    const decayGaps = [];
    let totalRetention = 0;
    let retentionCount = 0;

    for (const [, conceptEpisodes] of Object.entries(byConcept)) {
      const sorted = conceptEpisodes.sort((a, b) => a.timestamp - b.timestamp);

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        const prevCorrect = prev.payload?.wasCorrect || prev.payload?.rating >= 3;
        const currCorrect = curr.payload?.wasCorrect || curr.payload?.rating >= 3;

        const gapDays = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60 * 24);

        if (prevCorrect && !currCorrect && gapDays > 0) {
          // Decay event: remembered then forgot
          decayGaps.push(gapDays);
        }

        if (prevCorrect && currCorrect && gapDays > 0) {
          // Retention event
          totalRetention++;
        }
        retentionCount++;
      }
    }

    // Calculate forgetting curve parameters
    const avgDecayGap =
      decayGaps.length > 0
        ? decayGaps.reduce((a, b) => a + b, 0) / decayGaps.length
        : 7; // Default 7 days

    const retentionRate = retentionCount > 0 ? totalRetention / retentionCount : 0.7;
    const forgettingSlope = 1 / avgDecayGap; // Lower = slower forgetting

    return {
      optimalReviewInterval: Math.max(1, Math.ceil(avgDecayGap * 0.8)),
      forgettingSlope,
      averageRetentionRate: retentionRate,
      decayEventCount: decayGaps.length,
      retentionStrength: avgDecayGap > 7 ? 'strong' : avgDecayGap > 3 ? 'moderate' : 'weak',
    };
  }

  /**
   * Infer pace preferences
   */
  inferPacePreferences(episodes, sessionAnalytics) {
    const reviewEpisodes = episodes.filter((ep) => ep.eventType === 'REVIEW_COMPLETED');

    // Calculate items per session
    const itemsPerSession = [];
    for (const session of sessionAnalytics) {
      if (session.items_reviewed) {
        itemsPerSession.push(session.items_reviewed);
      }
    }

    const avgItemsPerSession =
      itemsPerSession.length > 0
        ? itemsPerSession.reduce((a, b) => a + b, 0) / itemsPerSession.length
        : 15;

    // Determine pace preference
    let preferredPace = 'steady';
    const variance = this.calculateVariance(itemsPerSession);
    const cv = variance > 0 ? Math.sqrt(variance) / avgItemsPerSession : 0;

    if (cv > 0.5) {
      // High variance = variable pace
      const maxItems = Math.max(...itemsPerSession);
      const minItems = Math.min(...itemsPerSession);
      preferredPace = maxItems > avgItemsPerSession * 2 ? 'marathon' : 'burst';
    }

    // Calculate break patterns from pause data
    const pausePatterns = sessionAnalytics
      .filter((s) => s.pause_count > 0)
      .map((s) => ({
        pauseCount: s.pause_count,
        itemsReviewed: s.items_reviewed || 0,
      }));

    let avgItemsBeforeBreak = 10;
    if (pausePatterns.length > 0) {
      avgItemsBeforeBreak =
        pausePatterns.reduce((sum, p) => sum + p.itemsReviewed / (p.pauseCount + 1), 0) /
        pausePatterns.length;
    }

    return {
      avgItemsPerSession: Math.round(avgItemsPerSession),
      preferredPace,
      optimalBatchSize: Math.round(avgItemsBeforeBreak),
      breakFrequency: Math.round(avgItemsBeforeBreak),
      paceVariability: cv,
    };
  }

  /**
   * Infer engagement patterns
   */
  inferEngagementPatterns(sessionAnalytics) {
    if (sessionAnalytics.length < 3) {
      return { trend: 'stable', confidence: 0 };
    }

    // Sort by date
    const sorted = [...sessionAnalytics].sort(
      (a, b) => new Date(a.start_time || a.date) - new Date(b.start_time || b.date),
    );

    // Calculate sessions per week
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    const lastWeekSessions = sorted.filter((s) => {
      const date = new Date(s.start_time || s.date);
      return date >= oneWeekAgo;
    }).length;

    const last4WeeksSessions = sorted.filter((s) => {
      const date = new Date(s.start_time || s.date);
      return date >= fourWeeksAgo;
    }).length;

    const avgWeeklySessions = last4WeeksSessions / 4;
    const ratio = avgWeeklySessions > 0 ? lastWeekSessions / avgWeeklySessions : 1;

    let trend = 'stable';
    if (ratio > 1.2) trend = 'increasing';
    else if (ratio < 0.8) trend = 'decreasing';

    // Calculate consistency score
    const weeklySessionCounts = [];
    let weekStart = fourWeeksAgo;
    while (weekStart < now) {
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const count = sorted.filter((s) => {
        const date = new Date(s.start_time || s.date);
        return date >= weekStart && date < weekEnd;
      }).length;
      weeklySessionCounts.push(count);
      weekStart = weekEnd;
    }

    const consistencyScore =
      weeklySessionCounts.length > 1
        ? 1 -
          this.calculateVariance(weeklySessionCounts) /
            Math.pow(Math.max(...weeklySessionCounts) || 1, 2)
        : 0.5;

    return {
      trend,
      sessionsPerWeek: avgWeeklySessions,
      lastWeekSessions,
      consistencyScore: Math.max(0, Math.min(1, consistencyScore)),
      weeklySessionCounts,
    };
  }

  /**
   * Infer performance patterns
   */
  inferPerformancePatterns(episodes) {
    const reviewEpisodes = episodes.filter((ep) => ep.eventType === 'REVIEW_COMPLETED');

    // Response time analysis
    const responseTimes = [];
    let hintCount = 0;
    let totalReviews = 0;
    let correctCount = 0;

    for (const ep of reviewEpisodes) {
      const payload = typeof ep.payload === 'string' ? JSON.parse(ep.payload) : ep.payload || {};

      if (payload.responseTimeMs) {
        responseTimes.push(payload.responseTimeMs);
      }
      if (payload.hintUsed) {
        hintCount++;
      }
      totalReviews++;
      if (payload.wasCorrect || payload.rating >= 3) {
        correctCount++;
      }
    }

    // Response time distribution
    const fast = responseTimes.filter((t) => t < 2000);
    const medium = responseTimes.filter((t) => t >= 2000 && t <= 10000);
    const slow = responseTimes.filter((t) => t > 10000);

    const responseTimePattern = {
      avgResponseTimeMs:
        responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : 0,
      distribution: {
        fast: { count: fast.length, percentage: fast.length / (responseTimes.length || 1) },
        medium: { count: medium.length, percentage: medium.length / (responseTimes.length || 1) },
        slow: { count: slow.length, percentage: slow.length / (responseTimes.length || 1) },
      },
    };

    // Hint dependency
    const hintUsageRate = totalReviews > 0 ? hintCount / totalReviews : 0;
    let hintDependency = 'independent';
    if (hintUsageRate > 0.3) hintDependency = 'high';
    else if (hintUsageRate > 0.15) hintDependency = 'moderate';
    else if (hintUsageRate > 0.05) hintDependency = 'low';

    return {
      overallAccuracy: totalReviews > 0 ? correctCount / totalReviews : 0,
      responseTime: responseTimePattern,
      hintUsage: {
        rate: hintUsageRate,
        dependency: hintDependency,
        totalHints: hintCount,
      },
      totalReviews,
    };
  }

  /**
   * Build profile update recommendations
   */
  buildProfileUpdates(inferences) {
    const globalUpdates = {};
    const domainUpdates = [];

    // Learning style
    if (inferences.learningStyle.confidence >= 0.15) {
      globalUpdates.learningStyle = inferences.learningStyle.dominantStyle;
      globalUpdates.learningStyleScores = inferences.learningStyle.scores;
    }

    // Timing preferences
    if (inferences.optimalTiming.confidence >= 0.3) {
      globalUpdates.preferredTimeOfDay = inferences.optimalTiming.preferredTimeOfDay;
      globalUpdates.preferredDays = inferences.optimalTiming.preferredDays;
    }

    // Session preferences
    if (inferences.sessionPreferences.confidence >= 0.3) {
      globalUpdates.optimalSessionLength = inferences.sessionPreferences.optimalMinutes;
      globalUpdates.sessionLengthPreference = inferences.sessionPreferences.preference;
    }

    // Forgetting curve
    if (inferences.forgettingCurve.decayEventCount >= 3) {
      globalUpdates.optimalReviewInterval = inferences.forgettingCurve.optimalReviewInterval;
      globalUpdates.forgettingCurveSlope = inferences.forgettingCurve.forgettingSlope;
      globalUpdates.averageRetentionRate = inferences.forgettingCurve.averageRetentionRate;
    }

    // Pace preferences
    globalUpdates.averageLearningVelocity = inferences.pacePreferences.avgItemsPerSession;

    // Engagement
    if (inferences.engagementPatterns.weeklySessionCounts?.length > 0) {
      globalUpdates.averageSessionsPerWeek = inferences.engagementPatterns.sessionsPerWeek;
      globalUpdates.consistencyScore = inferences.engagementPatterns.consistencyScore;
      globalUpdates.engagementTrend = inferences.engagementPatterns.trend;
    }

    // Build AI insights
    const insights = this.generateInsights(inferences);
    if (insights.length > 0) {
      globalUpdates.aiInsights = insights;
    }

    globalUpdates.lastAnalyzedAt = new Date().toISOString();

    return {
      globalUpdates,
      domainUpdates,
      scheduleRecommendations: this.buildScheduleRecommendations(inferences),
    };
  }

  /**
   * Generate human-readable insights
   */
  generateInsights(inferences) {
    const insights = [];

    // Learning style insight
    const style = inferences.learningStyle;
    if (style.dominantStyle !== 'mixed' && style.confidence >= 0.2) {
      insights.push(
        `You show a ${style.dominantStyle} learning preference (${Math.round(style.scores[style.dominantStyle] * 100)}% of signals)`,
      );
    }

    // Timing insight
    const timing = inferences.optimalTiming;
    if (timing.optimalHours.length > 0) {
      insights.push(
        `Your peak performance hours are ${timing.optimalHours.map((h) => this.formatHour(h)).join(', ')}`,
      );
    }

    // Session insight
    const session = inferences.sessionPreferences;
    if (session.focusDecayPoint) {
      insights.push(
        `Your focus typically starts declining after ${session.focusDecayPoint} minutes`,
      );
    }

    // Forgetting insight
    const forgetting = inferences.forgettingCurve;
    if (forgetting.retentionStrength) {
      insights.push(
        `Your retention strength is ${forgetting.retentionStrength} - optimal review interval is ${forgetting.optimalReviewInterval} days`,
      );
    }

    // Engagement insight
    const engagement = inferences.engagementPatterns;
    if (engagement.trend === 'increasing') {
      insights.push('Your study frequency is increasing - great momentum!');
    } else if (engagement.trend === 'decreasing') {
      insights.push('Your study frequency has declined recently - consider setting reminders');
    }

    // Performance insight
    const perf = inferences.performancePatterns;
    if (perf.hintUsage.dependency === 'high') {
      insights.push(
        `You rely heavily on hints (${Math.round(perf.hintUsage.rate * 100)}%) - try to recall before peeking`,
      );
    }

    return insights.slice(0, 5); // Top 5 insights
  }

  /**
   * Build schedule recommendations
   */
  buildScheduleRecommendations(inferences) {
    const timing = inferences.optimalTiming;
    const session = inferences.sessionPreferences;
    const engagement = inferences.engagementPatterns;

    return {
      optimalStudyTimes: timing.optimalHours.map((h) => this.formatHour(h)),
      recommendedSessionLength: session.optimalMinutes,
      focusBreakPoint: session.focusDecayPoint,
      recommendedFrequency:
        engagement.sessionsPerWeek >= 5
          ? 'daily'
          : engagement.sessionsPerWeek >= 3
            ? 'every other day'
            : 'twice weekly',
      preferredDays: timing.preferredDays,
    };
  }

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  async getEpisodes(userId, startDate, endDate) {
    if (!this.episodeCollector) {
      return [];
    }

    try {
      const episodes = await this.episodeCollector.getEpisodesInRange(startDate, endDate);
      return episodes.filter((ep) => (ep.userId || 1) === userId);
    } catch (err) {
      console.error('[LearnerProfileInference] Failed to get episodes:', err);
      return [];
    }
  }

  async getSessionAnalytics(userId, startDate, endDate, token) {
    if (!this.sessionAnalyticsManager) {
      return [];
    }

    try {
      // This would call the session analytics manager
      // For now, return empty array if not implemented
      const result = this.sessionAnalyticsManager.getSessionHistory
        ? await this.sessionAnalyticsManager.getSessionHistory({
            userId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            token,
          })
        : [];

      return Array.isArray(result) ? result : result.sessions || [];
    } catch (err) {
      console.error('[LearnerProfileInference] Failed to get session analytics:', err);
      return [];
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  calculateVariance(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  }

  dayNumberToName(day) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  }

  formatHour(hour) {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  }

  /**
   * Update configuration
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }
}

module.exports = LearnerProfileInference;
