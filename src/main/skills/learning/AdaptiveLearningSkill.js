/**
 * AdaptiveLearningSkill - Intelligent Learning Adaptation
 *
 * This skill provides advanced adaptive learning capabilities:
 * - Pattern detection in learner behavior and performance
 * - Learning style detection and adaptation
 * - Automatic difficulty calibration
 * - Spaced repetition optimization
 * - Time-of-day performance analysis
 * - Content type effectiveness analysis
 * - Personalized learning path adjustments
 *
 * The skill analyzes historical performance data to identify patterns
 * and automatically adapts the learning experience for optimal retention.
 */

const BaseSkill = require('../BaseSkill');

// Learning pattern types
const PATTERN_TYPES = {
  TIME_OF_DAY: 'time_of_day',
  DAY_OF_WEEK: 'day_of_week',
  SESSION_LENGTH: 'session_length',
  CONTENT_TYPE: 'content_type',
  DIFFICULTY_RESPONSE: 'difficulty_response',
  FATIGUE: 'fatigue',
  MOMENTUM: 'momentum',
  INTERFERENCE: 'interference',
};

// Learning style indicators
const LEARNING_STYLES = {
  VISUAL: 'visual',
  AUDITORY: 'auditory',
  READING: 'reading',
  KINESTHETIC: 'kinesthetic',
};

// Difficulty levels
const DIFFICULTY_LEVELS = ['beginner', 'elementary', 'intermediate', 'advanced', 'expert'];

// Spaced repetition intervals (in days)
const SR_INTERVALS = {
  box1: 1,
  box2: 2,
  box3: 4,
  box4: 7,
  box5: 14,
};

class AdaptiveLearningSkill extends BaseSkill {
  static get name() {
    return 'adaptive_learning';
  }

  static get description() {
    return 'Analyze learning patterns and adapt the learning experience. Detects optimal study times, calibrates difficulty, optimizes spaced repetition, and personalizes content based on learner behavior.';
  }

  static get parameters() {
    return {
      action: {
        type: 'string',
        enum: [
          'detect_patterns',
          'analyze_performance',
          'calibrate_difficulty',
          'optimize_spacing',
          'detect_learning_style',
          'suggest_adaptations',
          'get_optimal_schedule',
          'analyze_content_effectiveness',
          'detect_fatigue',
          'get_learner_profile',
        ],
        description: 'The adaptive learning action to perform',
      },
      performanceHistory: {
        type: 'array',
        description: 'Array of session performance records with timestamps, accuracy, duration, etc.',
      },
      itemHistory: {
        type: 'array',
        description: 'Array of individual item performance records for spaced repetition',
      },
      currentPlan: {
        type: 'object',
        description: 'Current learning plan data',
      },
      topicId: {
        type: 'string',
        description: 'The learning topic ID',
      },
      domainType: {
        type: 'string',
        enum: ['vocabulary', 'math', 'language', 'knowledge', 'skill'],
        description: 'The learning domain type',
      },
      timeWindow: {
        type: 'number',
        default: 30,
        description: 'Number of days to analyze (default 30)',
      },
      learnerProfile: {
        type: 'object',
        description: 'Existing learner profile for updates',
      },
    };
  }

  static get requiredParams() {
    return ['action'];
  }

  static get category() {
    return 'learning';
  }

  async execute(params) {
    const { action } = params;

    switch (action) {
      case 'detect_patterns':
        return this.detectPatterns(params);
      case 'analyze_performance':
        return this.analyzePerformance(params);
      case 'calibrate_difficulty':
        return this.calibrateDifficulty(params);
      case 'optimize_spacing':
        return this.optimizeSpacing(params);
      case 'detect_learning_style':
        return this.detectLearningStyle(params);
      case 'suggest_adaptations':
        return this.suggestAdaptations(params);
      case 'get_optimal_schedule':
        return this.getOptimalSchedule(params);
      case 'analyze_content_effectiveness':
        return this.analyzeContentEffectiveness(params);
      case 'detect_fatigue':
        return this.detectFatigue(params);
      case 'get_learner_profile':
        return this.getLearnerProfile(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ==========================================================================
  // Pattern Detection
  // ==========================================================================

  async detectPatterns(params) {
    const { performanceHistory = [], timeWindow = 30 } = params;

    if (performanceHistory.length < 5) {
      return {
        success: true,
        patterns: [],
        message: 'Need at least 5 sessions to detect patterns',
        dataPoints: performanceHistory.length,
      };
    }

    const patterns = [];

    // Time of day patterns
    const timePattern = this.analyzeTimeOfDayPattern(performanceHistory);
    if (timePattern.significant) {
      patterns.push({
        type: PATTERN_TYPES.TIME_OF_DAY,
        ...timePattern,
      });
    }

    // Day of week patterns
    const dayPattern = this.analyzeDayOfWeekPattern(performanceHistory);
    if (dayPattern.significant) {
      patterns.push({
        type: PATTERN_TYPES.DAY_OF_WEEK,
        ...dayPattern,
      });
    }

    // Session length patterns
    const lengthPattern = this.analyzeSessionLengthPattern(performanceHistory);
    if (lengthPattern.significant) {
      patterns.push({
        type: PATTERN_TYPES.SESSION_LENGTH,
        ...lengthPattern,
      });
    }

    // Momentum patterns (improving vs plateauing)
    const momentumPattern = this.analyzeMomentumPattern(performanceHistory);
    if (momentumPattern.significant) {
      patterns.push({
        type: PATTERN_TYPES.MOMENTUM,
        ...momentumPattern,
      });
    }

    // Fatigue patterns (declining performance within sessions)
    const fatiguePattern = this.analyzeFatiguePattern(performanceHistory);
    if (fatiguePattern.significant) {
      patterns.push({
        type: PATTERN_TYPES.FATIGUE,
        ...fatiguePattern,
      });
    }

    this.logExecution(
      { action: 'detect_patterns', timeWindow },
      { patternsFound: patterns.length }
    );

    return {
      success: true,
      patterns,
      analysisWindow: {
        sessions: performanceHistory.length,
        days: timeWindow,
      },
      recommendations: this.generatePatternRecommendations(patterns),
    };
  }

  analyzeTimeOfDayPattern(history) {
    const hourBuckets = {};

    history.forEach(session => {
      if (!session.timestamp) return;
      const hour = new Date(session.timestamp).getHours();
      const bucket = Math.floor(hour / 3); // 8 buckets of 3 hours

      if (!hourBuckets[bucket]) {
        hourBuckets[bucket] = { total: 0, correct: 0, count: 0 };
      }
      hourBuckets[bucket].total += session.itemsReviewed || 0;
      hourBuckets[bucket].correct += session.itemsCorrect || 0;
      hourBuckets[bucket].count += 1;
    });

    const bucketStats = Object.entries(hourBuckets).map(([bucket, data]) => ({
      bucket: parseInt(bucket),
      accuracy: data.total > 0 ? data.correct / data.total : 0,
      sessions: data.count,
      timeRange: `${parseInt(bucket) * 3}:00-${(parseInt(bucket) * 3) + 3}:00`,
    })).filter(b => b.sessions >= 2);

    if (bucketStats.length < 2) {
      return { significant: false };
    }

    const accuracies = bucketStats.map(b => b.accuracy);
    const maxAccuracy = Math.max(...accuracies);
    const minAccuracy = Math.min(...accuracies);
    const variance = maxAccuracy - minAccuracy;

    const bestBucket = bucketStats.find(b => b.accuracy === maxAccuracy);
    const worstBucket = bucketStats.find(b => b.accuracy === minAccuracy);

    return {
      significant: variance > 0.1,
      variance,
      bestTime: bestBucket,
      worstTime: worstBucket,
      allTimes: bucketStats,
      recommendation: variance > 0.1
        ? `Study during ${bestBucket.timeRange} for best results`
        : null,
    };
  }

  analyzeDayOfWeekPattern(history) {
    const dayBuckets = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    history.forEach(session => {
      if (!session.timestamp) return;
      const day = new Date(session.timestamp).getDay();

      if (!dayBuckets[day]) {
        dayBuckets[day] = { total: 0, correct: 0, count: 0 };
      }
      dayBuckets[day].total += session.itemsReviewed || 0;
      dayBuckets[day].correct += session.itemsCorrect || 0;
      dayBuckets[day].count += 1;
    });

    const dayStats = Object.entries(dayBuckets).map(([day, data]) => ({
      day: parseInt(day),
      dayName: dayNames[parseInt(day)],
      accuracy: data.total > 0 ? data.correct / data.total : 0,
      sessions: data.count,
    })).filter(d => d.sessions >= 1);

    if (dayStats.length < 3) {
      return { significant: false };
    }

    const accuracies = dayStats.map(d => d.accuracy);
    const maxAccuracy = Math.max(...accuracies);
    const minAccuracy = Math.min(...accuracies);
    const variance = maxAccuracy - minAccuracy;

    const bestDay = dayStats.find(d => d.accuracy === maxAccuracy);
    const worstDay = dayStats.find(d => d.accuracy === minAccuracy);

    return {
      significant: variance > 0.1,
      variance,
      bestDay,
      worstDay,
      allDays: dayStats,
      recommendation: variance > 0.1
        ? `${bestDay.dayName} is your strongest day`
        : null,
    };
  }

  analyzeSessionLengthPattern(history) {
    const lengthBuckets = {
      short: { total: 0, correct: 0, count: 0 },    // <15 min
      medium: { total: 0, correct: 0, count: 0 },   // 15-30 min
      long: { total: 0, correct: 0, count: 0 },     // 30-60 min
      extended: { total: 0, correct: 0, count: 0 }, // >60 min
    };

    history.forEach(session => {
      const duration = session.durationMinutes || 0;
      let bucket;

      if (duration < 15) bucket = 'short';
      else if (duration < 30) bucket = 'medium';
      else if (duration < 60) bucket = 'long';
      else bucket = 'extended';

      lengthBuckets[bucket].total += session.itemsReviewed || 0;
      lengthBuckets[bucket].correct += session.itemsCorrect || 0;
      lengthBuckets[bucket].count += 1;
    });

    const bucketStats = Object.entries(lengthBuckets)
      .filter(([_, data]) => data.count >= 2)
      .map(([name, data]) => ({
        name,
        accuracy: data.total > 0 ? data.correct / data.total : 0,
        sessions: data.count,
        avgItems: data.count > 0 ? Math.round(data.total / data.count) : 0,
      }));

    if (bucketStats.length < 2) {
      return { significant: false };
    }

    const accuracies = bucketStats.map(b => b.accuracy);
    const maxAccuracy = Math.max(...accuracies);
    const minAccuracy = Math.min(...accuracies);
    const variance = maxAccuracy - minAccuracy;

    const optimalLength = bucketStats.find(b => b.accuracy === maxAccuracy);

    return {
      significant: variance > 0.08,
      variance,
      optimalLength,
      allLengths: bucketStats,
      recommendation: variance > 0.08
        ? `${optimalLength.name} sessions (${this.getLengthRange(optimalLength.name)}) work best for you`
        : null,
    };
  }

  getLengthRange(bucket) {
    const ranges = {
      short: '<15 min',
      medium: '15-30 min',
      long: '30-60 min',
      extended: '>60 min',
    };
    return ranges[bucket] || '';
  }

  analyzeMomentumPattern(history) {
    if (history.length < 7) {
      return { significant: false };
    }

    // Calculate rolling 7-session accuracy
    const rollingAccuracies = [];
    for (let i = 6; i < history.length; i++) {
      const window = history.slice(i - 6, i + 1);
      const total = window.reduce((sum, s) => sum + (s.itemsReviewed || 0), 0);
      const correct = window.reduce((sum, s) => sum + (s.itemsCorrect || 0), 0);
      rollingAccuracies.push(total > 0 ? correct / total : 0);
    }

    // Detect trend
    const firstHalf = rollingAccuracies.slice(0, Math.floor(rollingAccuracies.length / 2));
    const secondHalf = rollingAccuracies.slice(Math.floor(rollingAccuracies.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    let trend;
    if (diff > 0.05) trend = 'improving';
    else if (diff < -0.05) trend = 'declining';
    else trend = 'stable';

    // Detect plateau (low variance in recent sessions)
    const recentVariance = this.calculateVariance(secondHalf);
    const isPlateau = trend === 'stable' && recentVariance < 0.01 && secondAvg > 0.7;

    return {
      significant: Math.abs(diff) > 0.05 || isPlateau,
      trend,
      improvement: Math.round(diff * 100),
      isPlateau,
      firstPeriodAccuracy: Math.round(firstAvg * 100),
      secondPeriodAccuracy: Math.round(secondAvg * 100),
      recommendation: this.getMomentumRecommendation(trend, isPlateau),
    };
  }

  getMomentumRecommendation(trend, isPlateau) {
    if (isPlateau) {
      return 'You\'ve reached a plateau. Consider increasing difficulty or trying new content types.';
    }
    if (trend === 'improving') {
      return 'Great momentum! Keep your current approach.';
    }
    if (trend === 'declining') {
      return 'Performance is declining. Consider shorter sessions or reviewing fundamentals.';
    }
    return null;
  }

  analyzeFatiguePattern(history) {
    // Look for declining accuracy within sessions
    const sessionsWithProgression = history.filter(s =>
      s.itemProgression && s.itemProgression.length > 10
    );

    if (sessionsWithProgression.length < 3) {
      // Estimate from session data
      const longSessions = history.filter(s => (s.durationMinutes || 0) > 30);
      const shortSessions = history.filter(s => (s.durationMinutes || 0) <= 30);

      const longAccuracy = this.calculateAverageAccuracy(longSessions);
      const shortAccuracy = this.calculateAverageAccuracy(shortSessions);

      const fatigueEffect = shortAccuracy - longAccuracy;

      return {
        significant: fatigueEffect > 0.08,
        estimated: true,
        fatigueEffect: Math.round(fatigueEffect * 100),
        recommendation: fatigueEffect > 0.08
          ? 'Your accuracy drops in longer sessions. Try shorter, more frequent sessions.'
          : null,
      };
    }

    // Analyze within-session decline
    const declineRates = sessionsWithProgression.map(session => {
      const prog = session.itemProgression;
      const firstQuarter = prog.slice(0, Math.floor(prog.length / 4));
      const lastQuarter = prog.slice(-Math.floor(prog.length / 4));

      const firstAccuracy = firstQuarter.filter(p => p.correct).length / firstQuarter.length;
      const lastAccuracy = lastQuarter.filter(p => p.correct).length / lastQuarter.length;

      return firstAccuracy - lastAccuracy;
    });

    const avgDecline = declineRates.reduce((a, b) => a + b, 0) / declineRates.length;

    return {
      significant: avgDecline > 0.1,
      avgDecline: Math.round(avgDecline * 100),
      recommendation: avgDecline > 0.1
        ? `Accuracy drops ${Math.round(avgDecline * 100)}% by session end. Take breaks or use shorter sessions.`
        : null,
    };
  }

  calculateAverageAccuracy(sessions) {
    if (sessions.length === 0) return 0;
    const total = sessions.reduce((sum, s) => sum + (s.itemsReviewed || 0), 0);
    const correct = sessions.reduce((sum, s) => sum + (s.itemsCorrect || 0), 0);
    return total > 0 ? correct / total : 0;
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  generatePatternRecommendations(patterns) {
    const recommendations = [];

    patterns.forEach(pattern => {
      if (pattern.recommendation) {
        recommendations.push({
          type: pattern.type,
          message: pattern.recommendation,
          priority: pattern.significant ? 'high' : 'medium',
        });
      }
    });

    return recommendations;
  }

  // ==========================================================================
  // Performance Analysis
  // ==========================================================================

  async analyzePerformance(params) {
    const { performanceHistory = [], domainType, timeWindow = 30 } = params;

    if (performanceHistory.length === 0) {
      return {
        success: true,
        analysis: null,
        message: 'No performance data available',
      };
    }

    const analysis = {
      overall: this.calculateOverallMetrics(performanceHistory),
      trend: this.calculateTrend(performanceHistory),
      consistency: this.calculateConsistency(performanceHistory),
      retention: this.estimateRetention(performanceHistory),
      domainSpecific: domainType ? this.analyzeDomainPerformance(performanceHistory, domainType) : null,
    };

    this.logExecution(
      { action: 'analyze_performance', domainType, timeWindow },
      { sessions: performanceHistory.length, accuracy: analysis.overall.accuracy }
    );

    return {
      success: true,
      analysis,
      insights: this.generatePerformanceInsights(analysis),
    };
  }

  calculateOverallMetrics(history) {
    const totalItems = history.reduce((sum, s) => sum + (s.itemsReviewed || 0), 0);
    const correctItems = history.reduce((sum, s) => sum + (s.itemsCorrect || 0), 0);
    const totalTime = history.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const newItems = history.reduce((sum, s) => sum + (s.itemsNew || 0), 0);

    return {
      totalSessions: history.length,
      totalItems,
      correctItems,
      accuracy: totalItems > 0 ? Math.round((correctItems / totalItems) * 100) : 0,
      totalTimeMinutes: totalTime,
      totalTimeHours: Math.round(totalTime / 60 * 10) / 10,
      newItems,
      avgItemsPerSession: Math.round(totalItems / history.length),
      avgSessionLength: Math.round(totalTime / history.length),
    };
  }

  calculateTrend(history) {
    if (history.length < 3) {
      return { direction: 'insufficient_data', confidence: 0 };
    }

    const recent = history.slice(-Math.min(10, history.length));
    const accuracies = recent.map(s =>
      (s.itemsReviewed || 0) > 0
        ? (s.itemsCorrect || 0) / (s.itemsReviewed || 1)
        : 0
    );

    // Simple linear regression
    const n = accuracies.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = accuracies.reduce((a, b) => a + b, 0);
    const sumXY = accuracies.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    let direction;
    if (slope > 0.02) direction = 'improving';
    else if (slope < -0.02) direction = 'declining';
    else direction = 'stable';

    return {
      direction,
      slope: Math.round(slope * 1000) / 1000,
      confidence: Math.min(n / 10, 1),
      recentAccuracy: Math.round((sumY / n) * 100),
    };
  }

  calculateConsistency(history) {
    if (history.length < 3) {
      return { score: 0, description: 'insufficient_data' };
    }

    const accuracies = history.map(s =>
      (s.itemsReviewed || 0) > 0
        ? (s.itemsCorrect || 0) / (s.itemsReviewed || 1)
        : 0
    );

    const variance = this.calculateVariance(accuracies);
    const stdDev = Math.sqrt(variance);

    let description;
    if (stdDev < 0.05) description = 'very_consistent';
    else if (stdDev < 0.1) description = 'consistent';
    else if (stdDev < 0.15) description = 'somewhat_variable';
    else description = 'highly_variable';

    return {
      score: Math.round((1 - Math.min(stdDev * 2, 1)) * 100),
      variance: Math.round(variance * 10000) / 10000,
      stdDev: Math.round(stdDev * 100) / 100,
      description,
    };
  }

  estimateRetention(history) {
    // Simplified retention estimation based on spaced repetition theory
    const recentSessions = history.slice(-14); // Last 2 weeks
    if (recentSessions.length === 0) {
      return { estimatedRetention: 0, confidence: 0 };
    }

    const avgAccuracy = this.calculateAverageAccuracy(recentSessions);
    const sessionFrequency = recentSessions.length / 14; // sessions per day

    // Higher frequency + higher accuracy = better retention
    const retentionScore = avgAccuracy * (0.7 + 0.3 * Math.min(sessionFrequency, 1));

    return {
      estimatedRetention: Math.round(retentionScore * 100),
      confidence: Math.min(recentSessions.length / 10, 1),
      factors: {
        accuracy: Math.round(avgAccuracy * 100),
        frequency: Math.round(sessionFrequency * 100) / 100,
      },
    };
  }

  analyzeDomainPerformance(history, domainType) {
    // Domain-specific analysis
    const domainMetrics = {
      vocabulary: this.analyzeVocabularyPerformance(history),
      math: this.analyzeMathPerformance(history),
      language: this.analyzeLanguagePerformance(history),
      knowledge: this.analyzeKnowledgePerformance(history),
      skill: this.analyzeSkillPerformance(history),
    };

    return domainMetrics[domainType] || null;
  }

  analyzeVocabularyPerformance(history) {
    return {
      wordsLearned: history.reduce((sum, s) => sum + (s.itemsNew || 0), 0),
      recallRate: this.calculateAverageAccuracy(history),
      suggestedFocus: 'word_families',
    };
  }

  analyzeMathPerformance(history) {
    return {
      problemsSolved: history.reduce((sum, s) => sum + (s.itemsCorrect || 0), 0),
      accuracy: this.calculateAverageAccuracy(history),
      suggestedFocus: 'practice_problems',
    };
  }

  analyzeLanguagePerformance(history) {
    return {
      practiceItems: history.reduce((sum, s) => sum + (s.itemsReviewed || 0), 0),
      accuracy: this.calculateAverageAccuracy(history),
      suggestedFocus: 'grammar_patterns',
    };
  }

  analyzeKnowledgePerformance(history) {
    return {
      conceptsCovered: history.reduce((sum, s) => sum + (s.itemsNew || 0), 0),
      retention: this.calculateAverageAccuracy(history),
      suggestedFocus: 'concept_connections',
    };
  }

  analyzeSkillPerformance(history) {
    return {
      practiceHours: history.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60,
      proficiency: this.calculateAverageAccuracy(history),
      suggestedFocus: 'hands_on_projects',
    };
  }

  generatePerformanceInsights(analysis) {
    const insights = [];

    // Trend insight
    if (analysis.trend.direction === 'improving') {
      insights.push({
        type: 'positive',
        title: 'Improving Performance',
        message: 'Your accuracy is trending upward. Keep up the great work!',
      });
    } else if (analysis.trend.direction === 'declining') {
      insights.push({
        type: 'attention',
        title: 'Performance Dip',
        message: 'Your accuracy has been declining. Consider reviewing fundamentals or adjusting difficulty.',
      });
    }

    // Consistency insight
    if (analysis.consistency.description === 'highly_variable') {
      insights.push({
        type: 'suggestion',
        title: 'Variable Performance',
        message: 'Your performance varies significantly. Try studying at consistent times and conditions.',
      });
    }

    // Retention insight
    if (analysis.retention.estimatedRetention < 60) {
      insights.push({
        type: 'attention',
        title: 'Retention Alert',
        message: 'Retention is lower than optimal. Consider more frequent, shorter review sessions.',
      });
    }

    return insights;
  }

  // ==========================================================================
  // Difficulty Calibration
  // ==========================================================================

  async calibrateDifficulty(params) {
    const { performanceHistory = [], currentPlan, domainType } = params;

    if (performanceHistory.length < 5) {
      return {
        success: true,
        calibration: null,
        message: 'Need at least 5 sessions for difficulty calibration',
      };
    }

    const currentDifficulty = currentPlan?.planData?.difficulty || 'intermediate';
    const recentAccuracy = this.calculateRecentAccuracy(performanceHistory, 10);
    const trend = this.calculateTrend(performanceHistory);

    // Determine optimal difficulty zone (70-85% accuracy target)
    let suggestedDifficulty = currentDifficulty;
    let reason = '';

    if (recentAccuracy > 90 && trend.direction !== 'declining') {
      suggestedDifficulty = this.getHigherDifficulty(currentDifficulty);
      reason = 'High accuracy suggests content is too easy';
    } else if (recentAccuracy < 60 && trend.direction !== 'improving') {
      suggestedDifficulty = this.getLowerDifficulty(currentDifficulty);
      reason = 'Low accuracy suggests content is too difficult';
    } else if (recentAccuracy >= 70 && recentAccuracy <= 85) {
      reason = 'Current difficulty is optimal (70-85% accuracy zone)';
    } else {
      reason = 'Current difficulty is acceptable';
    }

    const calibration = {
      currentDifficulty,
      suggestedDifficulty,
      shouldChange: suggestedDifficulty !== currentDifficulty,
      reason,
      metrics: {
        recentAccuracy,
        trend: trend.direction,
        targetRange: '70-85%',
      },
      confidenceScore: Math.round(Math.min(performanceHistory.length / 10, 1) * 100),
    };

    this.logExecution(
      { action: 'calibrate_difficulty', currentDifficulty, domainType },
      { suggestedDifficulty, recentAccuracy }
    );

    return {
      success: true,
      calibration,
    };
  }

  calculateRecentAccuracy(history, count = 10) {
    const recent = history.slice(-count);
    return Math.round(this.calculateAverageAccuracy(recent) * 100);
  }

  getLowerDifficulty(current) {
    const index = DIFFICULTY_LEVELS.indexOf(current);
    return DIFFICULTY_LEVELS[Math.max(0, index - 1)];
  }

  getHigherDifficulty(current) {
    const index = DIFFICULTY_LEVELS.indexOf(current);
    return DIFFICULTY_LEVELS[Math.min(DIFFICULTY_LEVELS.length - 1, index + 1)];
  }

  // ==========================================================================
  // Spaced Repetition Optimization
  // ==========================================================================

  async optimizeSpacing(params) {
    const { itemHistory = [], performanceHistory = [], domainType } = params;

    if (itemHistory.length === 0) {
      return {
        success: true,
        optimization: null,
        message: 'No item history available for spacing optimization',
      };
    }

    // Analyze individual item performance to optimize intervals
    const itemAnalysis = this.analyzeItemRetention(itemHistory);
    const optimizedIntervals = this.calculateOptimalIntervals(itemAnalysis, performanceHistory);
    const prioritizedItems = this.prioritizeItemsForReview(itemHistory);

    const optimization = {
      suggestedIntervals: optimizedIntervals,
      defaultIntervals: SR_INTERVALS,
      intervalAdjustment: this.calculateIntervalAdjustment(itemAnalysis),
      prioritizedReview: prioritizedItems.slice(0, 20),
      statistics: {
        totalItems: itemHistory.length,
        dueToday: prioritizedItems.filter(i => i.priority === 'high').length,
        overdue: prioritizedItems.filter(i => i.isOverdue).length,
        wellRetained: itemAnalysis.wellRetained,
        needsWork: itemAnalysis.needsWork,
      },
    };

    this.logExecution(
      { action: 'optimize_spacing', domainType },
      { items: itemHistory.length, dueToday: optimization.statistics.dueToday }
    );

    return {
      success: true,
      optimization,
    };
  }

  analyzeItemRetention(itemHistory) {
    let wellRetained = 0;
    let needsWork = 0;

    itemHistory.forEach(item => {
      const reviews = item.reviews || [];
      if (reviews.length < 2) return;

      const recentReviews = reviews.slice(-5);
      const recentAccuracy = recentReviews.filter(r => r.correct).length / recentReviews.length;

      if (recentAccuracy >= 0.8) wellRetained++;
      else if (recentAccuracy < 0.6) needsWork++;
    });

    return {
      wellRetained,
      needsWork,
      averageRetention: itemHistory.length > 0
        ? Math.round(wellRetained / itemHistory.length * 100)
        : 0,
    };
  }

  calculateOptimalIntervals(itemAnalysis, performanceHistory) {
    // Adjust intervals based on overall performance
    const avgAccuracy = this.calculateAverageAccuracy(performanceHistory);
    const multiplier = avgAccuracy > 0.85 ? 1.2 : avgAccuracy < 0.6 ? 0.8 : 1.0;

    return {
      box1: Math.round(SR_INTERVALS.box1 * multiplier),
      box2: Math.round(SR_INTERVALS.box2 * multiplier),
      box3: Math.round(SR_INTERVALS.box3 * multiplier),
      box4: Math.round(SR_INTERVALS.box4 * multiplier),
      box5: Math.round(SR_INTERVALS.box5 * multiplier),
    };
  }

  calculateIntervalAdjustment(itemAnalysis) {
    if (itemAnalysis.averageRetention > 85) {
      return {
        recommendation: 'extend',
        percentage: 20,
        reason: 'High retention allows longer intervals',
      };
    } else if (itemAnalysis.averageRetention < 60) {
      return {
        recommendation: 'shorten',
        percentage: 20,
        reason: 'Low retention requires shorter intervals',
      };
    }
    return {
      recommendation: 'maintain',
      percentage: 0,
      reason: 'Current intervals are effective',
    };
  }

  prioritizeItemsForReview(itemHistory) {
    const now = Date.now();

    return itemHistory
      .map(item => {
        const nextReview = item.nextReviewDate ? new Date(item.nextReviewDate).getTime() : 0;
        const isOverdue = nextReview < now;
        const daysOverdue = isOverdue ? Math.floor((now - nextReview) / (1000 * 60 * 60 * 24)) : 0;

        const recentReviews = (item.reviews || []).slice(-3);
        const recentAccuracy = recentReviews.length > 0
          ? recentReviews.filter(r => r.correct).length / recentReviews.length
          : 0.5;

        // Priority score: higher = more urgent
        let priorityScore = 0;
        if (isOverdue) priorityScore += 50 + Math.min(daysOverdue * 10, 50);
        if (recentAccuracy < 0.5) priorityScore += 30;
        if (item.leitnerBox === 1) priorityScore += 20;

        return {
          ...item,
          isOverdue,
          daysOverdue,
          recentAccuracy,
          priorityScore,
          priority: priorityScore > 60 ? 'high' : priorityScore > 30 ? 'medium' : 'low',
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }

  // ==========================================================================
  // Learning Style Detection
  // ==========================================================================

  async detectLearningStyle(params) {
    const { performanceHistory = [], learnerProfile } = params;

    if (performanceHistory.length < 10) {
      return {
        success: true,
        learningStyle: null,
        message: 'Need at least 10 sessions to detect learning style',
      };
    }

    // Analyze content type performance
    const contentTypeAnalysis = this.analyzeContentTypePerformance(performanceHistory);

    // Analyze session patterns
    const sessionPatterns = this.analyzeSessionPatterns(performanceHistory);

    // Detect primary learning style
    const detectedStyle = this.inferLearningStyle(contentTypeAnalysis, sessionPatterns);

    const result = {
      primaryStyle: detectedStyle.primary,
      secondaryStyle: detectedStyle.secondary,
      confidence: detectedStyle.confidence,
      styleScores: detectedStyle.scores,
      recommendations: this.generateStyleRecommendations(detectedStyle),
      contentTypeEffectiveness: contentTypeAnalysis,
    };

    this.logExecution(
      { action: 'detect_learning_style' },
      { primaryStyle: result.primaryStyle, confidence: result.confidence }
    );

    return {
      success: true,
      learningStyle: result,
    };
  }

  analyzeContentTypePerformance(history) {
    const contentTypes = {};

    history.forEach(session => {
      const type = session.contentType || 'mixed';
      if (!contentTypes[type]) {
        contentTypes[type] = { total: 0, correct: 0, count: 0 };
      }
      contentTypes[type].total += session.itemsReviewed || 0;
      contentTypes[type].correct += session.itemsCorrect || 0;
      contentTypes[type].count += 1;
    });

    return Object.entries(contentTypes).map(([type, data]) => ({
      type,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      sessions: data.count,
    })).sort((a, b) => b.accuracy - a.accuracy);
  }

  analyzeSessionPatterns(history) {
    return {
      preferredLength: this.getPreferredSessionLength(history),
      preferredTime: this.getPreferredStudyTime(history),
      breakPattern: this.analyzeBreakPattern(history),
    };
  }

  getPreferredSessionLength(history) {
    const lengths = history.map(s => s.durationMinutes || 0);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    if (avg < 15) return 'short';
    if (avg < 30) return 'medium';
    if (avg < 60) return 'long';
    return 'extended';
  }

  getPreferredStudyTime(history) {
    const hours = history
      .filter(s => s.timestamp)
      .map(s => new Date(s.timestamp).getHours());

    if (hours.length === 0) return 'unknown';

    const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);

    if (avgHour < 6) return 'early_morning';
    if (avgHour < 12) return 'morning';
    if (avgHour < 17) return 'afternoon';
    if (avgHour < 21) return 'evening';
    return 'night';
  }

  analyzeBreakPattern(history) {
    // Simplified break pattern analysis
    return {
      takesBreaks: true,
      averageBreakInterval: 30,
    };
  }

  inferLearningStyle(contentTypeAnalysis, sessionPatterns) {
    const scores = {
      [LEARNING_STYLES.VISUAL]: 0,
      [LEARNING_STYLES.AUDITORY]: 0,
      [LEARNING_STYLES.READING]: 0,
      [LEARNING_STYLES.KINESTHETIC]: 0,
    };

    // Score based on content type performance
    contentTypeAnalysis.forEach(ct => {
      const effectiveness = ct.accuracy / 100;
      if (['image', 'diagram', 'video', 'chart'].includes(ct.type)) {
        scores[LEARNING_STYLES.VISUAL] += effectiveness * ct.sessions;
      }
      if (['audio', 'podcast', 'discussion'].includes(ct.type)) {
        scores[LEARNING_STYLES.AUDITORY] += effectiveness * ct.sessions;
      }
      if (['text', 'article', 'book'].includes(ct.type)) {
        scores[LEARNING_STYLES.READING] += effectiveness * ct.sessions;
      }
      if (['practice', 'exercise', 'project'].includes(ct.type)) {
        scores[LEARNING_STYLES.KINESTHETIC] += effectiveness * ct.sessions;
      }
    });

    // Score based on session patterns
    if (sessionPatterns.preferredLength === 'short') {
      scores[LEARNING_STYLES.KINESTHETIC] += 0.5;
    }
    if (sessionPatterns.preferredLength === 'long') {
      scores[LEARNING_STYLES.READING] += 0.5;
    }

    // Normalize scores
    const maxScore = Math.max(...Object.values(scores), 0.1);
    Object.keys(scores).forEach(key => {
      scores[key] = Math.round((scores[key] / maxScore) * 100);
    });

    // Find primary and secondary styles
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primary = sorted[0][0];
    const secondary = sorted[1][1] > 50 ? sorted[1][0] : null;

    return {
      primary,
      secondary,
      scores,
      confidence: sorted[0][1] > 70 ? 'high' : sorted[0][1] > 50 ? 'medium' : 'low',
    };
  }

  generateStyleRecommendations(detectedStyle) {
    const recommendations = [];

    const styleRecs = {
      [LEARNING_STYLES.VISUAL]: [
        'Use diagrams, charts, and mind maps',
        'Color-code your notes and materials',
        'Watch video explanations',
      ],
      [LEARNING_STYLES.AUDITORY]: [
        'Listen to podcasts and audio books',
        'Discuss topics with study partners',
        'Read content aloud',
      ],
      [LEARNING_STYLES.READING]: [
        'Take detailed written notes',
        'Read explanations and documentation',
        'Summarize content in your own words',
      ],
      [LEARNING_STYLES.KINESTHETIC]: [
        'Practice with hands-on exercises',
        'Work on projects that apply concepts',
        'Take frequent breaks with movement',
      ],
    };

    if (styleRecs[detectedStyle.primary]) {
      recommendations.push(...styleRecs[detectedStyle.primary]);
    }

    if (detectedStyle.secondary && styleRecs[detectedStyle.secondary]) {
      recommendations.push(styleRecs[detectedStyle.secondary][0]);
    }

    return recommendations;
  }

  // ==========================================================================
  // Adaptation Suggestions
  // ==========================================================================

  async suggestAdaptations(params) {
    const { performanceHistory = [], currentPlan, domainType, learnerProfile } = params;

    const adaptations = [];

    // Get patterns and analysis
    const patterns = await this.detectPatterns({ performanceHistory });
    const performance = await this.analyzePerformance({ performanceHistory, domainType });
    const difficulty = await this.calibrateDifficulty({ performanceHistory, currentPlan, domainType });

    // Generate adaptations from patterns
    if (patterns.patterns) {
      patterns.patterns.forEach(p => {
        if (p.recommendation) {
          adaptations.push({
            type: 'pattern_based',
            category: p.type,
            suggestion: p.recommendation,
            priority: p.significant ? 'high' : 'medium',
            dataSupport: `Based on ${performanceHistory.length} sessions`,
          });
        }
      });
    }

    // Generate adaptations from performance
    if (performance.insights) {
      performance.insights.forEach(insight => {
        adaptations.push({
          type: 'performance_based',
          category: insight.type,
          suggestion: insight.message,
          priority: insight.type === 'attention' ? 'high' : 'medium',
        });
      });
    }

    // Generate adaptations from difficulty calibration
    if (difficulty.calibration?.shouldChange) {
      adaptations.push({
        type: 'difficulty_adjustment',
        category: 'difficulty',
        suggestion: `Consider changing difficulty from ${difficulty.calibration.currentDifficulty} to ${difficulty.calibration.suggestedDifficulty}`,
        priority: 'high',
        action: {
          type: 'change_difficulty',
          from: difficulty.calibration.currentDifficulty,
          to: difficulty.calibration.suggestedDifficulty,
        },
      });
    }

    // Sort by priority
    adaptations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    this.logExecution(
      { action: 'suggest_adaptations', domainType },
      { adaptationsCount: adaptations.length }
    );

    return {
      success: true,
      adaptations,
      summary: {
        totalSuggestions: adaptations.length,
        highPriority: adaptations.filter(a => a.priority === 'high').length,
        categories: [...new Set(adaptations.map(a => a.category))],
      },
    };
  }

  // ==========================================================================
  // Optimal Schedule
  // ==========================================================================

  async getOptimalSchedule(params) {
    const { performanceHistory = [], currentPlan, domainType } = params;

    const timePattern = this.analyzeTimeOfDayPattern(performanceHistory);
    const dayPattern = this.analyzeDayOfWeekPattern(performanceHistory);
    const lengthPattern = this.analyzeSessionLengthPattern(performanceHistory);

    const schedule = {
      bestTimeOfDay: timePattern.bestTime?.timeRange || 'No preference detected',
      bestDays: dayPattern.allDays?.filter(d => d.accuracy >= 0.7).map(d => d.dayName) || [],
      optimalSessionLength: lengthPattern.optimalLength?.name || 'medium',
      suggestedSchedule: this.generateWeeklySchedule(timePattern, dayPattern, lengthPattern, currentPlan),
      flexibility: {
        timeFlexible: !timePattern.significant,
        dayFlexible: !dayPattern.significant,
        lengthFlexible: !lengthPattern.significant,
      },
    };

    this.logExecution(
      { action: 'get_optimal_schedule', domainType },
      { hasTimePreference: timePattern.significant }
    );

    return {
      success: true,
      schedule,
    };
  }

  generateWeeklySchedule(timePattern, dayPattern, lengthPattern, currentPlan) {
    const sessionsPerWeek = currentPlan?.planData?.dailySchedule?.recommendedSessions * 7 || 7;
    const sessionLength = this.getSessionLengthMinutes(lengthPattern.optimalLength?.name || 'medium');

    const schedule = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Sort days by performance
    const sortedDays = (dayPattern.allDays || dayNames.map((d, i) => ({ day: i, dayName: d })))
      .sort((a, b) => (b.accuracy || 0.5) - (a.accuracy || 0.5));

    // Assign sessions to best days
    const daysToUse = Math.min(sessionsPerWeek, 7);
    for (let i = 0; i < daysToUse; i++) {
      const dayInfo = sortedDays[i] || { dayName: dayNames[i] };
      schedule.push({
        day: dayInfo.dayName,
        time: timePattern.bestTime?.timeRange || '9:00-12:00',
        duration: sessionLength,
        focus: i < 3 ? 'intensive' : 'review',
      });
    }

    return schedule;
  }

  getSessionLengthMinutes(lengthName) {
    const lengths = {
      short: 15,
      medium: 25,
      long: 45,
      extended: 60,
    };
    return lengths[lengthName] || 25;
  }

  // ==========================================================================
  // Content Effectiveness
  // ==========================================================================

  async analyzeContentEffectiveness(params) {
    const { performanceHistory = [], domainType } = params;

    const contentTypes = this.analyzeContentTypePerformance(performanceHistory);

    const effectiveness = {
      contentTypes,
      mostEffective: contentTypes[0] || null,
      leastEffective: contentTypes[contentTypes.length - 1] || null,
      recommendations: this.generateContentRecommendations(contentTypes, domainType),
    };

    this.logExecution(
      { action: 'analyze_content_effectiveness', domainType },
      { typesAnalyzed: contentTypes.length }
    );

    return {
      success: true,
      effectiveness,
    };
  }

  generateContentRecommendations(contentTypes, domainType) {
    const recommendations = [];

    if (contentTypes.length > 0) {
      const best = contentTypes[0];
      recommendations.push({
        type: 'increase',
        content: best.type,
        reason: `${best.type} content has ${best.accuracy}% accuracy - use more of this`,
      });
    }

    if (contentTypes.length > 1) {
      const worst = contentTypes[contentTypes.length - 1];
      if (worst.accuracy < 60) {
        recommendations.push({
          type: 'reduce_or_adapt',
          content: worst.type,
          reason: `${worst.type} content has only ${worst.accuracy}% accuracy - consider adapting approach`,
        });
      }
    }

    return recommendations;
  }

  // ==========================================================================
  // Fatigue Detection
  // ==========================================================================

  async detectFatigue(params) {
    const { performanceHistory = [] } = params;

    const fatiguePattern = this.analyzeFatiguePattern(performanceHistory);
    const recentSessions = performanceHistory.slice(-5);

    // Check for recent fatigue signs
    const recentFatigueIndicators = {
      decliningAccuracy: this.checkRecentDecline(recentSessions),
      longerResponseTimes: this.checkResponseTimeIncrease(recentSessions),
      shorterSessions: this.checkSessionShortening(recentSessions),
    };

    const fatigueLevel = this.calculateFatigueLevel(fatiguePattern, recentFatigueIndicators);

    const result = {
      fatigueLevel,
      indicators: recentFatigueIndicators,
      pattern: fatiguePattern,
      recommendations: this.getFatigueRecommendations(fatigueLevel),
    };

    this.logExecution(
      { action: 'detect_fatigue' },
      { fatigueLevel }
    );

    return {
      success: true,
      fatigue: result,
    };
  }

  checkRecentDecline(sessions) {
    if (sessions.length < 3) return false;

    const accuracies = sessions.map(s =>
      (s.itemsReviewed || 0) > 0 ? (s.itemsCorrect || 0) / (s.itemsReviewed || 1) : 0
    );

    // Check if last 2 sessions are lower than first 2
    const firstTwo = (accuracies[0] + accuracies[1]) / 2;
    const lastTwo = (accuracies[accuracies.length - 2] + accuracies[accuracies.length - 1]) / 2;

    return lastTwo < firstTwo - 0.1;
  }

  checkResponseTimeIncrease(sessions) {
    // Simplified check
    return false;
  }

  checkSessionShortening(sessions) {
    if (sessions.length < 3) return false;

    const durations = sessions.map(s => s.durationMinutes || 0);
    const firstAvg = (durations[0] + durations[1]) / 2;
    const lastAvg = (durations[durations.length - 2] + durations[durations.length - 1]) / 2;

    return lastAvg < firstAvg * 0.7;
  }

  calculateFatigueLevel(pattern, indicators) {
    let score = 0;

    if (pattern.significant) score += 2;
    if (indicators.decliningAccuracy) score += 2;
    if (indicators.longerResponseTimes) score += 1;
    if (indicators.shorterSessions) score += 1;

    if (score >= 4) return 'high';
    if (score >= 2) return 'moderate';
    return 'low';
  }

  getFatigueRecommendations(level) {
    const recommendations = {
      high: [
        'Take a longer break (24-48 hours) before next session',
        'When returning, start with easier content',
        'Consider splitting sessions into smaller chunks',
        'Review sleep and stress levels',
      ],
      moderate: [
        'Take a short break before continuing',
        'Consider switching to lighter review content',
        'Try a change of scenery or study method',
      ],
      low: [
        'You\'re doing well! Take regular breaks to maintain performance',
      ],
    };

    return recommendations[level] || [];
  }

  // ==========================================================================
  // Learner Profile
  // ==========================================================================

  async getLearnerProfile(params) {
    const { performanceHistory = [], learnerProfile: existingProfile, domainType } = params;

    // Aggregate all analyses
    const patterns = await this.detectPatterns({ performanceHistory });
    const performance = await this.analyzePerformance({ performanceHistory, domainType });
    const style = await this.detectLearningStyle({ performanceHistory });
    const fatigue = await this.detectFatigue({ performanceHistory });
    const schedule = await this.getOptimalSchedule({ performanceHistory });

    const profile = {
      // Learning characteristics
      learningStyle: style.learningStyle,
      optimalSchedule: schedule.schedule,
      fatigueResistance: fatigue.fatigue?.fatigueLevel === 'low' ? 'high' : fatigue.fatigue?.fatigueLevel === 'high' ? 'low' : 'medium',

      // Performance metrics
      overallAccuracy: performance.analysis?.overall?.accuracy || 0,
      trend: performance.analysis?.trend?.direction || 'stable',
      consistency: performance.analysis?.consistency?.description || 'unknown',
      retentionEstimate: performance.analysis?.retention?.estimatedRetention || 0,

      // Behavioral patterns
      patterns: patterns.patterns || [],
      preferredSessionLength: schedule.schedule?.optimalSessionLength || 'medium',
      preferredStudyTime: schedule.schedule?.bestTimeOfDay || 'flexible',

      // Recommendations summary
      topRecommendations: this.getTopRecommendations(patterns, performance, style, fatigue),

      // Metadata
      lastUpdated: new Date().toISOString(),
      dataPoints: performanceHistory.length,
      confidenceLevel: performanceHistory.length >= 20 ? 'high' : performanceHistory.length >= 10 ? 'medium' : 'low',
    };

    this.logExecution(
      { action: 'get_learner_profile', domainType },
      { dataPoints: performanceHistory.length, accuracy: profile.overallAccuracy }
    );

    return {
      success: true,
      profile,
    };
  }

  getTopRecommendations(patterns, performance, style, fatigue) {
    const all = [];

    if (patterns.recommendations) {
      all.push(...patterns.recommendations.slice(0, 2));
    }

    if (performance.insights) {
      all.push(...performance.insights.slice(0, 2).map(i => ({
        type: i.type,
        message: i.message,
        priority: i.type === 'attention' ? 'high' : 'medium',
      })));
    }

    if (style.learningStyle?.recommendations) {
      all.push({
        type: 'learning_style',
        message: style.learningStyle.recommendations[0],
        priority: 'medium',
      });
    }

    if (fatigue.fatigue?.recommendations) {
      all.push({
        type: 'wellbeing',
        message: fatigue.fatigue.recommendations[0],
        priority: fatigue.fatigue.fatigueLevel === 'high' ? 'high' : 'low',
      });
    }

    return all.slice(0, 5);
  }
}

module.exports = AdaptiveLearningSkill;
