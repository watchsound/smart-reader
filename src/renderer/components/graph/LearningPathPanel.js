/**
 * LearningPathPanel.js
 *
 * A professionally styled panel displaying a personalized learning path
 * for a target concept, with prerequisites visualization and progress tracking.
 * Features glass-morphism design, smooth animations, and intuitive navigation.
 */

import React, { useState, useEffect } from 'react';
import { useTheme, alpha } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SchoolIcon from '@mui/icons-material/School';
import RefreshIcon from '@mui/icons-material/Refresh';
import TimelineIcon from '@mui/icons-material/Timeline';
import RouteIcon from '@mui/icons-material/Route';
import FlagIcon from '@mui/icons-material/Flag';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import StarIcon from '@mui/icons-material/Star';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import graphApi from '../../api/graphApi';
import customStorage from '../../store/customStorage';

// Color palettes for progress stages - Light mode
const STAGE_COLORS = [
  { bg: '#E3F2FD', accent: '#1E88E5', icon: '#1565C0', glow: 'rgba(30, 136, 229, 0.3)' },
  { bg: '#F3E5F5', accent: '#8E24AA', icon: '#6A1B9A', glow: 'rgba(142, 36, 170, 0.3)' },
  { bg: '#E8F5E9', accent: '#43A047', icon: '#2E7D32', glow: 'rgba(67, 160, 71, 0.3)' },
  { bg: '#FFF8E1', accent: '#FFB300', icon: '#FF8F00', glow: 'rgba(255, 179, 0, 0.3)' },
  { bg: '#FCE4EC', accent: '#D81B60', icon: '#AD1457', glow: 'rgba(216, 27, 96, 0.3)' },
];

// Dark mode color palette
const STAGE_COLORS_DARK = [
  { bg: '#0D2137', accent: '#42A5F5', icon: '#64B5F6', glow: 'rgba(66, 165, 245, 0.25)' },
  { bg: '#2A1B2E', accent: '#AB47BC', icon: '#CE93D8', glow: 'rgba(171, 71, 188, 0.25)' },
  { bg: '#1B3A1B', accent: '#66BB6A', icon: '#81C784', glow: 'rgba(102, 187, 106, 0.25)' },
  { bg: '#2D2600', accent: '#FFCA28', icon: '#FFD54F', glow: 'rgba(255, 202, 40, 0.25)' },
  { bg: '#2D1520', accent: '#EC407A', icon: '#F48FB1', glow: 'rgba(236, 64, 122, 0.25)' },
];

// Difficulty styling
const DIFFICULTY_STYLES = {
  beginner: { color: '#43A047', darkColor: '#66BB6A', label: 'Beginner' },
  intermediate: { color: '#1E88E5', darkColor: '#42A5F5', label: 'Intermediate' },
  advanced: { color: '#8E24AA', darkColor: '#AB47BC', label: 'Advanced' },
  expert: { color: '#D81B60', darkColor: '#EC407A', label: 'Expert' },
};

export default function LearningPathPanel({
  targetConceptId,
  targetConceptName,
  onConceptSelect,
  onStartLearning,
}) {
  const [learningPath, setLearningPath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [hoveredStep, setHoveredStep] = useState(null);
  const [expandedStep, setExpandedStep] = useState(null);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorPalette = isDark ? STAGE_COLORS_DARK : STAGE_COLORS;

  const token = customStorage.getSessionToken();

  useEffect(() => {
    if (targetConceptId) {
      loadLearningPath();
    }
  }, [targetConceptId]);

  const loadLearningPath = async () => {
    if (!targetConceptId) return;

    setLoading(true);
    setError('');
    try {
      const result = await graphApi.getPersonalizedLearningPath(
        targetConceptId,
        token,
      );
      if (result) {
        setLearningPath(result);
        const firstUncompleted = result.path?.findIndex(
          (c) => c.masteryLevel < 70,
        );
        setActiveStep(firstUncompleted >= 0 ? firstUncompleted : 0);
        setExpandedStep(firstUncompleted >= 0 ? firstUncompleted : null);
      } else {
        setError('Could not generate learning path');
      }
    } catch (e) {
      setError(e.message || 'Failed to load learning path');
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = () => {
    if (!learningPath?.path?.length) return 0;
    const completed = learningPath.path.filter(
      (c) => c.masteryLevel >= 70,
    ).length;
    return Math.round((completed / learningPath.path.length) * 100);
  };

  const handleConceptClick = (concept) => {
    if (onConceptSelect) {
      onConceptSelect(concept);
    }
  };

  const handleStartLearning = (concept, e) => {
    e?.stopPropagation();
    if (onStartLearning) {
      onStartLearning(concept);
    }
  };

  const toggleExpand = (index) => {
    setExpandedStep(expandedStep === index ? null : index);
  };

  // Empty state - no target concept selected
  if (!targetConceptId) {
    return (
      <Box
        sx={{
          borderRadius: '16px',
          background: isDark
            ? 'rgba(30, 33, 38, 0.85)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
          p: 4,
          textAlign: 'center',
          boxShadow: isDark
            ? '0 4px 24px rgba(0, 0, 0, 0.4)'
            : '0 4px 24px rgba(0, 0, 0, 0.08)',
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: isDark
              ? 'linear-gradient(135deg, rgba(66, 165, 245, 0.15) 0%, rgba(171, 71, 188, 0.15) 100%)'
              : 'linear-gradient(135deg, rgba(30, 136, 229, 0.12) 0%, rgba(142, 36, 170, 0.12) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <RouteIcon
            sx={{
              fontSize: 40,
              color: isDark ? '#64B5F6' : '#1E88E5',
              opacity: 0.8,
            }}
          />
        </Box>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
          Select a Learning Goal
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose a concept to view its personalized learning path
        </Typography>
      </Box>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          borderRadius: '16px',
          background: isDark
            ? 'rgba(30, 33, 38, 0.85)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
          p: 4,
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
            Building your learning path...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        sx={{
          borderRadius: '16px',
          background: isDark
            ? 'rgba(30, 33, 38, 0.85)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha('#E53935', 0.3)}`,
          p: 3,
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
          onClick={loadLearningPath}
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

  const progressPct = getProgressPercentage();

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
            ? 'linear-gradient(135deg, rgba(66, 165, 245, 0.15) 0%, rgba(171, 71, 188, 0.15) 100%)'
            : 'linear-gradient(135deg, rgba(30, 136, 229, 0.12) 0%, rgba(142, 36, 170, 0.12) 100%)',
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
              background: 'linear-gradient(135deg, #1E88E5 0%, #8E24AA 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(30, 136, 229, 0.4)',
            }}
          >
            <RouteIcon sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, lineHeight: 1.2 }}
            >
              Learning Path
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your journey to mastery
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh path">
          <span>
            <IconButton
              size="small"
              onClick={loadLearningPath}
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
          </span>
        </Tooltip>
      </Box>

      {/* Target Concept Card */}
      <Box
        sx={{
          mx: 2,
          mt: 2,
          p: 2,
          borderRadius: '12px',
          background: isDark
            ? 'linear-gradient(135deg, rgba(255, 202, 40, 0.12) 0%, rgba(255, 167, 38, 0.08) 100%)'
            : 'linear-gradient(135deg, rgba(255, 179, 0, 0.12) 0%, rgba(255, 152, 0, 0.08) 100%)',
          border: `1px solid ${alpha(isDark ? '#FFCA28' : '#FFB300', 0.3)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(255, 179, 0, 0.4)',
          }}
        >
          <FlagIcon sx={{ color: 'white', fontSize: 24 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Target Goal
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {targetConceptName || learningPath?.targetConcept?.name || 'Unknown'}
          </Typography>
        </Box>
        <StarIcon sx={{ color: isDark ? '#FFCA28' : '#FFB300', fontSize: 24 }} />
      </Box>

      {/* Progress Section */}
      <Box sx={{ mx: 2, mt: 2 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: '12px',
            background: alpha(isDark ? '#42A5F5' : '#1E88E5', 0.08),
            border: `1px solid ${alpha(isDark ? '#42A5F5' : '#1E88E5', 0.2)}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon
                sx={{ fontSize: 18, color: isDark ? '#42A5F5' : '#1E88E5' }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Overall Progress
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: isDark ? '#42A5F5' : '#1E88E5',
              }}
            >
              {progressPct}%
            </Typography>
          </Box>

          {/* Progress bar */}
          <Box
            sx={{
              height: 10,
              borderRadius: 5,
              background: alpha(isDark ? '#fff' : '#000', 0.1),
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${progressPct}%`,
                borderRadius: 5,
                background: progressPct === 100
                  ? 'linear-gradient(90deg, #43A047 0%, #2E7D32 100%)'
                  : 'linear-gradient(90deg, #1E88E5 0%, #8E24AA 100%)',
                transition: 'width 0.5s ease',
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  animation: 'shimmer 2s infinite',
                },
                '@keyframes shimmer': {
                  '0%': { transform: 'translateX(-100%)' },
                  '100%': { transform: 'translateX(100%)' },
                },
              }}
            />
          </Box>

          {/* Stats row */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              mt: 1.5,
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: '#43A047' }} />
              <Typography variant="caption" color="text.secondary">
                {learningPath?.path?.filter((c) => c.masteryLevel >= 70).length || 0} completed
              </Typography>
            </Box>
            {learningPath?.estimatedMinutes && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  ~{learningPath.estimatedMinutes} min remaining
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Learning Path Steps */}
      <Box sx={{ p: 2, maxHeight: 350, overflowY: 'auto' }}>
        {learningPath?.path?.length > 0 ? (
          <Box sx={{ position: 'relative', pl: 3 }}>
            {/* Vertical line connector */}
            <Box
              sx={{
                position: 'absolute',
                left: 11,
                top: 20,
                bottom: 20,
                width: 2,
                background: `linear-gradient(180deg, ${alpha(isDark ? '#42A5F5' : '#1E88E5', 0.3)} 0%, ${alpha(isDark ? '#AB47BC' : '#8E24AA', 0.3)} 100%)`,
                borderRadius: 1,
              }}
            />

            {learningPath.path.map((concept, index) => {
              const isMastered = concept.masteryLevel >= 70;
              const isActive = index === activeStep;
              const isExpanded = expandedStep === index;
              const isHovered = hoveredStep === index;
              const colors = colorPalette[index % colorPalette.length];
              const difficultyStyle = DIFFICULTY_STYLES[concept.difficulty] || DIFFICULTY_STYLES.intermediate;

              return (
                <Box
                  key={concept.id}
                  onMouseEnter={() => setHoveredStep(index)}
                  onMouseLeave={() => setHoveredStep(null)}
                  onClick={() => {
                    handleConceptClick(concept);
                    toggleExpand(index);
                  }}
                  sx={{
                    position: 'relative',
                    mb: 1.5,
                    cursor: 'pointer',
                    animation: `fadeSlideIn 0.3s ease ${index * 0.08}s both`,
                    '@keyframes fadeSlideIn': {
                      from: { opacity: 0, transform: 'translateY(10px)' },
                      to: { opacity: 1, transform: 'translateY(0)' },
                    },
                  }}
                >
                  {/* Step indicator dot */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -22,
                      top: 14,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: isMastered
                        ? 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)'
                        : isActive
                          ? `linear-gradient(135deg, ${colors.accent} 0%, ${alpha(colors.accent, 0.7)} 100%)`
                          : theme.palette.background.paper,
                      border: isMastered || isActive
                        ? 'none'
                        : `2px solid ${alpha(isDark ? '#fff' : '#000', 0.2)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isMastered
                        ? '0 2px 8px rgba(67, 160, 71, 0.4)'
                        : isActive
                          ? `0 2px 8px ${colors.glow}`
                          : 'none',
                      transition: 'all 0.2s ease',
                      transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                      zIndex: 1,
                    }}
                  >
                    {isMastered ? (
                      <CheckCircleIcon sx={{ fontSize: 16, color: 'white' }} />
                    ) : isActive ? (
                      <PlayArrowIcon sx={{ fontSize: 14, color: 'white' }} />
                    ) : (
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'text.secondary',
                        }}
                      >
                        {index + 1}
                      </Typography>
                    )}
                  </Box>

                  {/* Step card */}
                  <Box
                    sx={{
                      borderRadius: '12px',
                      background: theme.palette.background.paper,
                      border: `1px solid ${alpha(isDark ? '#fff' : '#000', isHovered ? 0.15 : 0.08)}`,
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                      boxShadow: isHovered ? `0 4px 16px ${colors.glow}` : 'none',
                      transform: isHovered ? 'translateX(4px)' : 'none',
                    }}
                  >
                    {/* Card header */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        background: isActive ? colors.bg : 'transparent',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 0.5,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: isActive ? 700 : 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {concept.name}
                          </Typography>
                          {isMastered && (
                            <CheckCircleIcon
                              sx={{ fontSize: 16, color: '#43A047' }}
                            />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              px: 0.75,
                              py: 0.25,
                              borderRadius: '4px',
                              background: alpha(
                                isMastered
                                  ? '#43A047'
                                  : isDark
                                    ? colors.accent
                                    : colors.accent,
                                0.15
                              ),
                              color: isMastered
                                ? '#43A047'
                                : colors.icon,
                              fontSize: '0.65rem',
                              fontWeight: 600,
                            }}
                          >
                            {Math.round(concept.masteryLevel || 0)}% mastery
                          </Box>
                          {concept.difficulty && (
                            <Box
                              sx={{
                                px: 0.75,
                                py: 0.25,
                                borderRadius: '4px',
                                background: alpha(
                                  isDark ? difficultyStyle.darkColor : difficultyStyle.color,
                                  0.12
                                ),
                                color: isDark ? difficultyStyle.darkColor : difficultyStyle.color,
                                fontSize: '0.65rem',
                                fontWeight: 500,
                              }}
                            >
                              {difficultyStyle.label}
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Action button */}
                      {!isMastered && (
                        <Tooltip title="Start learning">
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) => handleStartLearning(concept, e)}
                              sx={{
                                width: 32,
                                height: 32,
                                background: isActive
                                  ? `linear-gradient(135deg, ${colors.accent} 0%, ${alpha(colors.accent, 0.8)} 100%)`
                                  : alpha(colors.accent, 0.15),
                                color: isActive ? 'white' : colors.icon,
                                '&:hover': {
                                  background: `linear-gradient(135deg, ${colors.accent} 0%, ${alpha(colors.accent, 0.8)} 100%)`,
                                  color: 'white',
                                  transform: 'scale(1.1)',
                                },
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <PlayArrowIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>

                    {/* Expandable content */}
                    {isExpanded && concept.description && (
                      <Box
                        sx={{
                          px: 1.5,
                          pb: 1.5,
                          pt: 0,
                          borderTop: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.06)}`,
                          animation: 'expandIn 0.2s ease',
                          '@keyframes expandIn': {
                            from: { opacity: 0, maxHeight: 0 },
                            to: { opacity: 1, maxHeight: 100 },
                          },
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', pt: 1 }}
                        >
                          {concept.description}
                        </Typography>
                        {concept.domain && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              mt: 1,
                            }}
                          >
                            <SchoolIcon
                              sx={{ fontSize: 12, color: 'text.secondary' }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {concept.domain}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              px: 3,
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(67, 160, 71, 0.15) 0%, rgba(46, 182, 125, 0.15) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <LockOpenIcon sx={{ fontSize: 32, color: '#43A047' }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              No prerequisites needed!
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              You can start learning this concept directly
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={(e) =>
                handleStartLearning(
                  { id: targetConceptId, name: targetConceptName },
                  e
                )
              }
              sx={{
                borderRadius: '20px',
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                background: 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)',
                boxShadow: '0 4px 12px rgba(67, 160, 71, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #388E3C 0%, #1B5E20 100%)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              Start Learning
            </Button>
          </Box>
        )}
      </Box>

      {/* Next Suggestion Footer */}
      {learningPath?.nextConcept && (
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
            background: alpha(isDark ? '#fff' : '#000', 0.02),
          }}
        >
          <Box
            onClick={() => handleStartLearning(learningPath.nextConcept)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 1.5,
              borderRadius: '10px',
              background: alpha(isDark ? '#42A5F5' : '#1E88E5', 0.08),
              border: `1px solid ${alpha(isDark ? '#42A5F5' : '#1E88E5', 0.2)}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: alpha(isDark ? '#42A5F5' : '#1E88E5', 0.15),
                transform: 'translateX(4px)',
              },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowForwardIcon sx={{ color: 'white', fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Suggested Next
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {learningPath.nextConcept.name}
              </Typography>
            </Box>
            <Button
              size="small"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: isDark ? '#42A5F5' : '#1E88E5',
              }}
            >
              Learn Now
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
