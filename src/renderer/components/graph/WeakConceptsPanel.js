/**
 * WeakConceptsPanel.js
 *
 * A professionally styled panel displaying concepts that need more practice
 * based on mastery level, error rates, and learning patterns.
 * Features glass-morphism design, smooth animations, and intuitive visual hierarchy.
 */

import React, { useState, useEffect } from 'react';
import { useTheme, alpha } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';

import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import SchoolIcon from '@mui/icons-material/School';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import PsychologyIcon from '@mui/icons-material/Psychology';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import BoltIcon from '@mui/icons-material/Bolt';

import graphApi from '../../api/graphApi';
import customStorage from '../../store/customStorage';

// Color palettes for mastery levels - Light mode
const MASTERY_COLORS = [
  { bg: '#FFEBEE', accent: '#E53935', icon: '#C62828', glow: 'rgba(229, 57, 53, 0.3)' }, // Critical (0-20%)
  { bg: '#FFF3E0', accent: '#FB8C00', icon: '#E65100', glow: 'rgba(251, 140, 0, 0.3)' }, // Low (20-40%)
  { bg: '#FFF8E1', accent: '#FDD835', icon: '#F9A825', glow: 'rgba(253, 216, 53, 0.3)' }, // Moderate (40-60%)
  { bg: '#E8F5E9', accent: '#43A047', icon: '#2E7D32', glow: 'rgba(67, 160, 71, 0.3)' }, // Good (60-80%)
  { bg: '#E3F2FD', accent: '#1E88E5', icon: '#1565C0', glow: 'rgba(30, 136, 229, 0.3)' }, // Excellent (80-100%)
];

// Dark mode color palette
const MASTERY_COLORS_DARK = [
  { bg: '#2D1515', accent: '#EF5350', icon: '#E57373', glow: 'rgba(239, 83, 80, 0.25)' },
  { bg: '#2D1B00', accent: '#FFA726', icon: '#FFB74D', glow: 'rgba(255, 167, 38, 0.25)' },
  { bg: '#2D2600', accent: '#FFEE58', icon: '#FFF176', glow: 'rgba(255, 238, 88, 0.25)' },
  { bg: '#1B3A1B', accent: '#66BB6A', icon: '#81C784', glow: 'rgba(102, 187, 106, 0.25)' },
  { bg: '#0D2137', accent: '#42A5F5', icon: '#64B5F6', glow: 'rgba(66, 165, 245, 0.25)' },
];

// Reason type styling
const REASON_STYLES = {
  lowMastery: { color: '#E53935', darkColor: '#EF5350', icon: TrendingDownIcon, label: 'Low Mastery' },
  highErrors: { color: '#FB8C00', darkColor: '#FFA726', icon: ErrorOutlineIcon, label: 'High Errors' },
  blocking: { color: '#1E88E5', darkColor: '#42A5F5', icon: BlockIcon, label: 'Blocking Progress' },
};

// Get color based on mastery percentage
function getMasteryColorIndex(mastery) {
  if (mastery < 20) return 0;
  if (mastery < 40) return 1;
  if (mastery < 60) return 2;
  if (mastery < 80) return 3;
  return 4;
}

export default function WeakConceptsPanel({
  onConceptSelect,
  onStartPractice,
  limit = 10,
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [weakConcepts, setWeakConcepts] = useState([]);
  const [errorProneTopics, setErrorProneTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hoveredItem, setHoveredItem] = useState(null);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorPalette = isDark ? MASTERY_COLORS_DARK : MASTERY_COLORS;

  const token = customStorage.getSessionToken();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [weak, errorProne] = await Promise.all([
        graphApi.detectWeakConcepts(limit, token),
        graphApi.getErrorProneTopics(30, token),
      ]);
      setWeakConcepts(weak || []);
      setErrorProneTopics(errorProne || []);
    } catch (e) {
      setError(e.message || 'Failed to load weak concepts');
    } finally {
      setLoading(false);
    }
  };

  const handleConceptClick = (concept) => {
    if (onConceptSelect) {
      onConceptSelect(concept);
    }
  };

  const handleStartPractice = (concept, e) => {
    e?.stopPropagation();
    if (onStartPractice) {
      onStartPractice(concept);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <Box
        sx={{
          p: 3,
          borderRadius: '16px',
          background: isDark
            ? 'rgba(30, 33, 38, 0.85)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress
            size={40}
            thickness={4}
            sx={{
              color: '#1E88E5',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
          <Typography
            variant="body2"
            sx={{ mt: 2, color: 'text.secondary', fontWeight: 500 }}
          >
            Analyzing your learning patterns...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box
        sx={{
          p: 3,
          borderRadius: '16px',
          background: isDark
            ? 'rgba(30, 33, 38, 0.85)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha('#E53935', 0.3)}`,
          textAlign: 'center',
        }}
      >
        <ErrorOutlineIcon
          sx={{ fontSize: 48, color: '#E53935', opacity: 0.8, mb: 2 }}
        />
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          sx={{
            borderRadius: '20px',
            textTransform: 'none',
            borderColor: '#E53935',
            color: '#E53935',
            '&:hover': {
              borderColor: '#C62828',
              background: alpha('#E53935', 0.08),
            },
          }}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: '16px',
        background: isDark
          ? 'rgba(30, 33, 38, 0.85)'
          : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
        overflow: 'hidden',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.4)'
          : '0 4px 24px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Header Section */}
      <Box
        sx={{
          p: 2,
          background: isDark
            ? 'linear-gradient(135deg, rgba(255, 167, 38, 0.15) 0%, rgba(239, 83, 80, 0.15) 100%)'
            : 'linear-gradient(135deg, rgba(255, 167, 38, 0.12) 0%, rgba(229, 57, 53, 0.12) 100%)',
          borderBottom: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.06)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #FB8C00 0%, #E53935 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(251, 140, 0, 0.4)',
            }}
          >
            <AutoGraphIcon sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, lineHeight: 1.2 }}
            >
              Areas to Improve
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Focus your practice here
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh analysis">
          <IconButton
            size="small"
            onClick={loadData}
            sx={{
              background: alpha(isDark ? '#fff' : '#000', 0.05),
              '&:hover': {
                background: alpha(isDark ? '#fff' : '#000', 0.1),
                transform: 'rotate(180deg)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tab Navigation */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          p: 1.5,
          borderBottom: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.06)}`,
        }}
      >
        {[
          { label: 'Weak', count: weakConcepts.length, icon: TrendingDownIcon, color: '#E53935' },
          { label: 'Error Prone', count: errorProneTopics.length, icon: LocalFireDepartmentIcon, color: '#FB8C00' },
        ].map((tab, index) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === index;
          return (
            <Box
              key={tab.label}
              onClick={() => setActiveTab(index)}
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                py: 1,
                px: 2,
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isActive
                  ? alpha(tab.color, isDark ? 0.2 : 0.12)
                  : 'transparent',
                color: isActive ? tab.color : 'text.secondary',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.8125rem',
                '&:hover': {
                  background: alpha(tab.color, isDark ? 0.15 : 0.08),
                },
              }}
            >
              <TabIcon sx={{ fontSize: 18 }} />
              <span>{tab.label}</span>
              <Box
                sx={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: '10px',
                  background: isActive ? tab.color : alpha(tab.color, 0.2),
                  color: isActive ? 'white' : tab.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  px: 0.75,
                }}
              >
                {tab.count}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Content Area */}
      <Box sx={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Weak Concepts Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 1.5 }}>
            {weakConcepts.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {weakConcepts.map((concept, index) => {
                  const masteryLevel = concept.masteryLevel || 0;
                  const colorIndex = getMasteryColorIndex(masteryLevel);
                  const colors = colorPalette[colorIndex];
                  const reasonStyle = REASON_STYLES[concept.reason] || REASON_STYLES.lowMastery;
                  const ReasonIcon = reasonStyle.icon;
                  const isHovered = hoveredItem === `weak-${concept.id}`;

                  return (
                    <Box
                      key={concept.id}
                      onMouseEnter={() => setHoveredItem(`weak-${concept.id}`)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => handleConceptClick(concept)}
                      sx={{
                        display: 'flex',
                        alignItems: 'stretch',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        background: theme.palette.background.paper,
                        border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
                        transition: 'all 0.2s ease-in-out',
                        animation: `slideIn 0.3s ease ${index * 0.05}s both`,
                        '@keyframes slideIn': {
                          from: { opacity: 0, transform: 'translateX(-10px)' },
                          to: { opacity: 1, transform: 'translateX(0)' },
                        },
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow: `0 4px 20px ${colors.glow}`,
                          borderColor: alpha(colors.accent, 0.4),
                        },
                      }}
                    >
                      {/* Left accent stripe */}
                      <Box
                        sx={{
                          width: 4,
                          background: `linear-gradient(180deg, ${colors.accent} 0%, ${alpha(colors.accent, 0.6)} 100%)`,
                          borderRadius: '12px 0 0 12px',
                        }}
                      />

                      {/* Icon section */}
                      <Box
                        sx={{
                          width: 56,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: colors.bg,
                          position: 'relative',
                        }}
                      >
                        <ReasonIcon
                          sx={{
                            fontSize: 24,
                            color: colors.icon,
                            transition: 'transform 0.2s ease',
                            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                          }}
                        />
                      </Box>

                      {/* Content section */}
                      <Box sx={{ flex: 1, py: 1.5, px: 2, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {concept.name}
                          </Typography>
                          <Box
                            sx={{
                              px: 1,
                              py: 0.25,
                              borderRadius: '6px',
                              background: alpha(isDark ? reasonStyle.darkColor : reasonStyle.color, 0.15),
                              color: isDark ? reasonStyle.darkColor : reasonStyle.color,
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {reasonStyle.label}
                          </Box>
                        </Box>

                        {/* Mastery bar */}
                        <Box sx={{ mb: 0.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              Mastery
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 600, color: colors.icon }}
                            >
                              {Math.round(masteryLevel)}%
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              height: 6,
                              borderRadius: 3,
                              background: alpha(isDark ? '#fff' : '#000', 0.1),
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              sx={{
                                height: '100%',
                                width: `${masteryLevel}%`,
                                borderRadius: 3,
                                background: `linear-gradient(90deg, ${colors.accent} 0%, ${alpha(colors.accent, 0.7)} 100%)`,
                                transition: 'width 0.5s ease',
                              }}
                            />
                          </Box>
                        </Box>

                        {concept.domain && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <PsychologyIcon sx={{ fontSize: 12 }} />
                            {concept.domain}
                          </Typography>
                        )}
                      </Box>

                      {/* Action button */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          pr: 1.5,
                          opacity: isHovered ? 1 : 0,
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        <Tooltip title="Practice now">
                          <IconButton
                            size="small"
                            onClick={(e) => handleStartPractice(concept, e)}
                            sx={{
                              width: 36,
                              height: 36,
                              background: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
                              color: 'white',
                              boxShadow: '0 4px 12px rgba(30, 136, 229, 0.4)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #1976D2 0%, #0D47A1 100%)',
                                transform: 'scale(1.1)',
                              },
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <PlayArrowIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 6,
                  px: 3,
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(67, 160, 71, 0.15) 0%, rgba(46, 182, 125, 0.15) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#43A047' }} />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Great job!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No weak concepts found. Keep up the excellent work!
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Error Prone Topics Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 1.5 }}>
            {errorProneTopics.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {errorProneTopics.map((topic, index) => {
                  const errorRate = Math.round(
                    ((topic.errorCount || 0) / (topic.totalAttempts || 1)) * 100
                  );
                  const isHovered = hoveredItem === `error-${topic.id}`;
                  const severityColor =
                    errorRate > 50 ? '#E53935' : errorRate > 30 ? '#FB8C00' : '#FDD835';
                  const severityColorDark =
                    errorRate > 50 ? '#EF5350' : errorRate > 30 ? '#FFA726' : '#FFEE58';

                  return (
                    <Box
                      key={topic.id}
                      onMouseEnter={() => setHoveredItem(`error-${topic.id}`)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => handleConceptClick(topic)}
                      sx={{
                        display: 'flex',
                        alignItems: 'stretch',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        background: theme.palette.background.paper,
                        border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
                        transition: 'all 0.2s ease-in-out',
                        animation: `slideIn 0.3s ease ${index * 0.05}s both`,
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow: `0 4px 20px ${alpha(severityColor, 0.3)}`,
                          borderColor: alpha(severityColor, 0.4),
                        },
                      }}
                    >
                      {/* Left accent stripe */}
                      <Box
                        sx={{
                          width: 4,
                          background: `linear-gradient(180deg, ${isDark ? severityColorDark : severityColor} 0%, ${alpha(isDark ? severityColorDark : severityColor, 0.6)} 100%)`,
                          borderRadius: '12px 0 0 12px',
                        }}
                      />

                      {/* Icon section */}
                      <Box
                        sx={{
                          width: 56,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: alpha(isDark ? severityColorDark : severityColor, 0.12),
                          position: 'relative',
                        }}
                      >
                        <LocalFireDepartmentIcon
                          sx={{
                            fontSize: 24,
                            color: isDark ? severityColorDark : severityColor,
                            transition: 'transform 0.2s ease',
                            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                          }}
                        />
                      </Box>

                      {/* Content section */}
                      <Box sx={{ flex: 1, py: 1.5, px: 2, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 0.75,
                          }}
                        >
                          {topic.name}
                        </Typography>

                        {/* Stats row */}
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <ErrorOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
                            <Typography variant="caption" color="error">
                              {topic.errorCount || 0} errors
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <BoltIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {topic.totalAttempts || 0} attempts
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              px: 1,
                              py: 0.25,
                              borderRadius: '6px',
                              background: alpha(isDark ? severityColorDark : severityColor, 0.15),
                              color: isDark ? severityColorDark : severityColor,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                            }}
                          >
                            {errorRate}% error rate
                          </Box>
                        </Box>
                      </Box>

                      {/* Action button */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          pr: 1.5,
                          opacity: isHovered ? 1 : 0,
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        <Tooltip title="Practice now">
                          <IconButton
                            size="small"
                            onClick={(e) => handleStartPractice(topic, e)}
                            sx={{
                              width: 36,
                              height: 36,
                              background: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
                              color: 'white',
                              boxShadow: '0 4px 12px rgba(30, 136, 229, 0.4)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #1976D2 0%, #0D47A1 100%)',
                                transform: 'scale(1.1)',
                              },
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <PlayArrowIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 6,
                  px: 3,
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(67, 160, 71, 0.15) 0%, rgba(46, 182, 125, 0.15) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#43A047' }} />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Excellent accuracy!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No error-prone topics in the last 30 days
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Footer with CTA */}
      {(weakConcepts.length > 0 || errorProneTopics.length > 0) && (
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
            background: alpha(isDark ? '#fff' : '#000', 0.02),
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => {
              const concept = weakConcepts[0] || errorProneTopics[0];
              if (concept) handleStartPractice(concept);
            }}
            sx={{
              borderRadius: '24px',
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              py: 1.25,
              background: 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)',
              boxShadow: '0 4px 16px rgba(67, 160, 71, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #388E3C 0%, #1B5E20 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(67, 160, 71, 0.5)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            Start Practice Session
          </Button>
        </Box>
      )}
    </Box>
  );
}
