/**
 * AdaptiveLearningPanel.js
 *
 * A panel displaying adaptive learning insights, recommendations,
 * and learner profile data from the AdaptiveLearningSkill.
 * Features glass-morphism design with performance visualizations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, alpha } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Collapse from '@mui/material/Collapse';

import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import TuneIcon from '@mui/icons-material/Tune';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import SchoolIcon from '@mui/icons-material/School';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TouchAppIcon from '@mui/icons-material/TouchApp';

import skillApi from '../../api/skillApi';
import learningApi from '../../api/learningApi';
import customStorage from '../../store/customStorage';

// Learning style icons and colors
const LEARNING_STYLES = {
  visual: {
    icon: VisibilityIcon,
    color: '#1E88E5',
    darkColor: '#42A5F5',
    label: 'Visual Learner',
    description: 'Learn best through diagrams, charts, and visual content',
  },
  auditory: {
    icon: HeadphonesIcon,
    color: '#9C27B0',
    darkColor: '#BA68C8',
    label: 'Auditory Learner',
    description: 'Learn best through listening and discussion',
  },
  reading: {
    icon: MenuBookIcon,
    color: '#43A047',
    darkColor: '#66BB6A',
    label: 'Reading/Writing Learner',
    description: 'Learn best through reading and taking notes',
  },
  kinesthetic: {
    icon: TouchAppIcon,
    color: '#FF5722',
    darkColor: '#FF7043',
    label: 'Kinesthetic Learner',
    description: 'Learn best through hands-on practice',
  },
};

// Trend icons
const TREND_ICONS = {
  improving: { icon: TrendingUpIcon, color: '#43A047', label: 'Improving' },
  declining: { icon: TrendingDownIcon, color: '#E53935', label: 'Declining' },
  stable: { icon: TrendingFlatIcon, color: '#FB8C00', label: 'Stable' },
};

// Fatigue level styling
const FATIGUE_STYLES = {
  low: { icon: BatteryFullIcon, color: '#43A047', label: 'Low Fatigue' },
  moderate: {
    icon: BatteryAlertIcon,
    color: '#FB8C00',
    label: 'Moderate Fatigue',
  },
  high: { icon: BatteryAlertIcon, color: '#E53935', label: 'High Fatigue' },
};

// Priority colors
const PRIORITY_COLORS = {
  high: '#E53935',
  medium: '#FB8C00',
  low: '#9E9E9E',
};

// eslint-disable-next-line react/prop-types
export default function AdaptiveLearningPanel({
  topicId,
  domainType = 'vocabulary',
  onApplyRecommendation,
  compact = false,
}) {
  const [profile, setProfile] = useState(null);
  const [adaptations, setAdaptations] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    style: true,
    performance: true,
    recommendations: true,
  });

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  customStorage.getSessionToken(); // Token reserved for future authenticated calls

  // Load adaptive data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // Get performance history
      const sessionsResponse = await learningApi.getRecentSessions(30);
      const recentSessions = sessionsResponse?.data || [];
      const performanceHistory = recentSessions.map((s) => ({
        timestamp: s.startedAt,
        itemsReviewed: s.completedItems || 0,
        itemsCorrect: Math.round(
          ((s.completedItems || 0) * (s.accuracyRate || 0)) / 100,
        ),
        durationMinutes: s.durationMinutes || 0,
        contentType: s.sessionType || 'mixed',
      }));

      if (performanceHistory.length === 0) {
        setProfile(null);
        setAdaptations([]);
        setSchedule(null);
        setLoading(false);
        return;
      }

      // Execute adaptive learning skill actions
      const [profileResult, adaptResult, scheduleResult] = await Promise.all([
        skillApi.executeSkill('adaptive_learning', {
          action: 'get_learner_profile',
          performanceHistory,
          domainType,
        }),
        skillApi.executeSkill('adaptive_learning', {
          action: 'suggest_adaptations',
          performanceHistory,
          domainType,
        }),
        skillApi.executeSkill('adaptive_learning', {
          action: 'get_optimal_schedule',
          performanceHistory,
        }),
      ]);

      if (profileResult?.result?.profile) {
        setProfile(profileResult.result.profile);
      }
      if (adaptResult?.result?.adaptations) {
        setAdaptations(adaptResult.result.adaptations);
      }
      if (scheduleResult?.result?.schedule) {
        setSchedule(scheduleResult.result.schedule);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[AdaptiveLearningPanel] Error loading:', e);
      setError('Failed to load adaptive learning data');
    } finally {
      setLoading(false);
    }
  }, [domainType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Render learning style section
  const renderLearningStyle = () => {
    const style = profile?.learningStyle;
    if (!style?.primaryStyle) return null;

    const primaryStyleData = LEARNING_STYLES[style.primaryStyle];
    if (!primaryStyleData) return null;

    const Icon = primaryStyleData.icon;

    return (
      <Box sx={{ mb: 2 }}>
        <Box
          onClick={() => toggleSection('style')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PsychologyIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Learning Style
            </Typography>
          </Box>
          {expandedSections.style ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>

        <Collapse in={expandedSections.style}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(
                isDark ? primaryStyleData.darkColor : primaryStyleData.color,
                0.1,
              ),
              border: `1px solid ${alpha(
                isDark ? primaryStyleData.darkColor : primaryStyleData.color,
                0.2,
              )}`,
            }}
          >
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}
            >
              <Box
                sx={{
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: alpha(
                    isDark
                      ? primaryStyleData.darkColor
                      : primaryStyleData.color,
                    0.2,
                  ),
                }}
              >
                <Icon
                  sx={{
                    fontSize: 24,
                    color: isDark
                      ? primaryStyleData.darkColor
                      : primaryStyleData.color,
                  }}
                />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {primaryStyleData.label}
                </Typography>
                <Chip
                  label={`${style.confidence} confidence`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              </Box>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {primaryStyleData.description}
            </Typography>

            {/* Style scores */}
            {style.styleScores && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.entries(style.styleScores).map(([styleName, score]) => {
                  const styleInfo = LEARNING_STYLES[styleName];
                  if (!styleInfo) return null;
                  return (
                    <Box
                      key={styleName}
                      sx={{
                        flex: '1 0 45%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <Typography variant="caption" sx={{ minWidth: 60 }}>
                        {styleName}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={score}
                        sx={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          bgcolor: alpha(
                            isDark ? styleInfo.darkColor : styleInfo.color,
                            0.2,
                          ),
                          '& .MuiLinearProgress-bar': {
                            bgcolor: isDark
                              ? styleInfo.darkColor
                              : styleInfo.color,
                          },
                        }}
                      />
                      <Typography variant="caption" sx={{ minWidth: 25 }}>
                        {score}%
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
    );
  };

  // Helper to get fatigue style key
  const getFatigueKey = (fatigueResistance) => {
    if (fatigueResistance === 'high') return 'low';
    if (fatigueResistance === 'low') return 'high';
    return 'moderate';
  };

  // Helper to get performance color based on percentage
  const getPerformanceColor = (value) => {
    if (value >= 80) return '#43A047';
    if (value >= 60) return '#FB8C00';
    return '#E53935';
  };

  // Helper to get confidence level
  const getConfidenceLevel = (level) => {
    if (level === 'high') return '#43A047';
    if (level === 'medium') return '#FB8C00';
    return '#9E9E9E';
  };

  // Props reserved for future topic-specific features
  if (topicId || compact) {
    // Reserved
  }

  // Render performance section
  const renderPerformance = () => {
    if (!profile) return null;

    const trend = TREND_ICONS[profile.trend] || TREND_ICONS.stable;
    const TrendIcon = trend.icon;
    const fatigue = FATIGUE_STYLES[getFatigueKey(profile.fatigueResistance)];
    const FatigueIcon = fatigue.icon;

    return (
      <Box sx={{ mb: 2 }}>
        <Box
          onClick={() => toggleSection('performance')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoGraphIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Performance
            </Typography>
          </Box>
          {expandedSections.performance ? (
            <ExpandLessIcon />
          ) : (
            <ExpandMoreIcon />
          )}
        </Box>

        <Collapse in={expandedSections.performance}>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}
          >
            {/* Accuracy */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                textAlign: 'center',
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: getPerformanceColor(profile.overallAccuracy),
                }}
              >
                {profile.overallAccuracy}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Accuracy
              </Typography>
            </Box>

            {/* Retention */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                textAlign: 'center',
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: getPerformanceColor(profile.retentionEstimate),
                }}
              >
                {profile.retentionEstimate}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Retention
              </Typography>
            </Box>

            {/* Trend */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              <TrendIcon sx={{ color: trend.color, fontSize: 20 }} />
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, color: trend.color }}
              >
                {trend.label}
              </Typography>
            </Box>

            {/* Fatigue */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              <FatigueIcon sx={{ color: fatigue.color, fontSize: 20 }} />
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, color: fatigue.color }}
              >
                {fatigue.label}
              </Typography>
            </Box>
          </Box>

          {/* Confidence */}
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Profile confidence:
            </Typography>
            <Chip
              label={profile.confidenceLevel}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                bgcolor: alpha(
                  getConfidenceLevel(profile.confidenceLevel),
                  0.15,
                ),
              }}
            />
            <Typography variant="caption" color="text.secondary">
              ({profile.dataPoints} sessions)
            </Typography>
          </Box>
        </Collapse>
      </Box>
    );
  };

  // Render recommendations section
  const renderRecommendations = () => {
    const allRecommendations = [
      ...(profile?.topRecommendations || []),
      ...adaptations.slice(0, 3),
    ].slice(0, 5);

    if (allRecommendations.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Box
          onClick={() => toggleSection('recommendations')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LightbulbIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Recommendations
            </Typography>
          </Box>
          {expandedSections.recommendations ? (
            <ExpandLessIcon />
          ) : (
            <ExpandMoreIcon />
          )}
        </Box>

        <Collapse in={expandedSections.recommendations}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {allRecommendations.map((rec, index) => {
              const priority = rec.priority || 'medium';
              const priorityColor = PRIORITY_COLORS[priority];

              return (
                <Box
                  key={rec.message || rec.suggestion || `rec-${index}`}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.03)',
                    borderLeft: `3px solid ${priorityColor}`,
                  }}
                >
                  <Box
                    sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
                  >
                    {priority === 'high' ? (
                      <WarningAmberIcon
                        sx={{ color: priorityColor, fontSize: 18, mt: 0.25 }}
                      />
                    ) : (
                      <CheckCircleIcon
                        sx={{ color: priorityColor, fontSize: 18, mt: 0.25 }}
                      />
                    )}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {rec.message || rec.suggestion}
                      </Typography>
                      {rec.action && (
                        <Button
                          size="small"
                          sx={{ mt: 1, p: 0, minWidth: 0, fontSize: '0.75rem' }}
                          onClick={() => onApplyRecommendation?.(rec)}
                        >
                          Apply
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Collapse>
      </Box>
    );
  };

  // Render schedule section
  const renderSchedule = () => {
    if (!schedule) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Optimal Schedule
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                Best time: <strong>{schedule.bestTimeOfDay}</strong>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SpeedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                Session: <strong>{schedule.optimalSessionLength}</strong>
              </Typography>
            </Box>
          </Box>

          {schedule.bestDays?.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Best days:
              </Typography>
              {schedule.bestDays.slice(0, 4).map((day) => (
                <Chip
                  key={day}
                  label={day.slice(0, 3)}
                  size="small"
                  sx={{ height: 20 }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: isDark ? alpha('#1a1a1a', 0.95) : alpha('#fff', 0.95),
        backdropFilter: 'blur(12px)',
        borderRadius: 3,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon sx={{ color: isDark ? '#42A5F5' : '#1E88E5' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
            Adaptive Learning
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <span>
            <IconButton size="small" onClick={loadData} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Content */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}
      {!loading && error && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {error}
          </Typography>
          <Button size="small" onClick={loadData}>
            Retry
          </Button>
        </Box>
      )}
      {!loading && !error && !profile && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <SchoolIcon
            sx={{
              fontSize: 48,
              color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
              mb: 1,
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Complete more learning sessions to see adaptive insights
          </Typography>
        </Box>
      )}
      {!loading && !error && profile && (
        <>
          {renderLearningStyle()}
          {renderPerformance()}
          {renderRecommendations()}
          {renderSchedule()}
        </>
      )}
    </Box>
  );
}
