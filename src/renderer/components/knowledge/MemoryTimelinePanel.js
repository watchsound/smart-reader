/**
 * MemoryTimelinePanel.js
 *
 * Displays a chronological timeline of consolidated memories for concepts.
 * Shows the summarization hierarchy: Concept → Memories → Episodes.
 * Includes memory gap detection and coverage analysis.
 *
 * Part of the Knowledge Dashboard visualization suite.
 */

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme, alpha, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Collapse from '@mui/material/Collapse';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

// Icons
import TimelineIcon from '@mui/icons-material/Timeline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MemoryIcon from '@mui/icons-material/Memory';
import HistoryIcon from '@mui/icons-material/History';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SchoolIcon from '@mui/icons-material/School';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArticleIcon from '@mui/icons-material/Article';
import LayersIcon from '@mui/icons-material/Layers';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';

// API
import graphApi from '../../api/graphApi';

// Styled components
const TimelineContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  paddingLeft: theme.spacing(4),
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    width: 2,
    background:
      theme.palette.mode === 'dark'
        ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.6)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`
        : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.4)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
    borderRadius: 1,
  },
}));

const TimelineNode = styled(Box)(({ theme }) => ({
  position: 'absolute',
  left: -24,
  top: 8,
  width: 24,
  height: 24,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.palette.background.paper,
  border: `2px solid ${theme.palette.primary.main}`,
  boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.3)}`,
  zIndex: 1,
}));

const MemoryCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'colorKey',
})(({ theme, colorKey = 'primary' }) => {
  const colorMap = {
    primary: theme.palette.primary.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
    info: theme.palette.info.main,
  };
  const color = colorMap[colorKey] || colorMap.primary;

  return {
    position: 'relative',
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: 12,
    background:
      theme.palette.mode === 'dark'
        ? alpha(theme.palette.background.paper, 0.6)
        : alpha(theme.palette.background.paper, 0.9),
    border: `1px solid ${alpha(color, 0.2)}`,
    backdropFilter: 'blur(8px)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateX(4px)',
      borderColor: alpha(color, 0.4),
      boxShadow: `0 4px 16px ${alpha(color, 0.15)}`,
    },
  };
});

const EpisodeChip = styled(Chip)(({ theme }) => ({
  height: 24,
  fontSize: '0.7rem',
  '& .MuiChip-icon': {
    fontSize: 14,
  },
}));

const StatBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'colorKey',
})(({ theme, colorKey = 'primary' }) => {
  const colorMap = {
    primary: { bg: '#E8F5E9', accent: '#4CAF50' },
    secondary: { bg: '#E3F2FD', accent: '#2196F3' },
    warning: { bg: '#FFF3E0', accent: '#FF9800' },
    error: { bg: '#FFEBEE', accent: '#F44336' },
  };
  const darkColorMap = {
    primary: { bg: '#1B3A1B', accent: '#4CAF50' },
    secondary: { bg: '#0D2137', accent: '#2196F3' },
    warning: { bg: '#2D1B00', accent: '#FF9800' },
    error: { bg: '#2D1515', accent: '#F44336' },
  };
  const colors =
    theme.palette.mode === 'dark' ? darkColorMap : colorMap;
  const palette = colors[colorKey] || colors.primary;

  return {
    padding: theme.spacing(2),
    borderRadius: 12,
    background: alpha(palette.bg, 0.5),
    border: `1px solid ${alpha(palette.accent, 0.2)}`,
    textAlign: 'center',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: `0 4px 12px ${alpha(palette.accent, 0.2)}`,
    },
  };
});

const GapAlert = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
  borderRadius: 8,
  background:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.warning.main, 0.15)
      : alpha(theme.palette.warning.main, 0.1),
  border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
  marginBottom: theme.spacing(1),
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    background:
      theme.palette.mode === 'dark'
        ? alpha(theme.palette.warning.main, 0.25)
        : alpha(theme.palette.warning.main, 0.15),
  },
}));

// Memory type configuration
const MEMORY_TYPE_CONFIG = {
  concept_session: {
    label: 'Session',
    icon: SchoolIcon,
    color: 'primary',
    description: 'Learning session for a concept',
  },
  daily: {
    label: 'Daily',
    icon: HistoryIcon,
    color: 'secondary',
    description: 'Daily summary across concepts',
  },
  weekly: {
    label: 'Weekly',
    icon: AutoGraphIcon,
    color: 'info',
    description: 'Weekly learning summary',
  },
  cross_concept: {
    label: 'Cross-Concept',
    icon: BubbleChartIcon,
    color: 'warning',
    description: 'Patterns across multiple concepts',
  },
};

// Mastery level configuration
const MASTERY_LEVELS = {
  beginner: { color: 'error', label: 'Beginner', icon: TrendingDownIcon },
  developing: { color: 'warning', label: 'Developing', icon: TrendingUpIcon },
  proficient: { color: 'primary', label: 'Proficient', icon: CheckCircleIcon },
  mastered: { color: 'success', label: 'Mastered', icon: CheckCircleIcon },
};

/**
 * MemoryTimelinePanel Component
 *
 * Displays consolidated memories in a chronological timeline view
 * with expandable details showing source episodes.
 */
function MemoryTimelinePanel({
  conceptId = null,
  conceptName = null,
  onConceptSelect = () => {},
  onMemorySelect = () => {},
  height = 500,
  showStats = true,
  showGaps = true,
}) {
  const theme = useTheme();

  // State
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Data state
  const [hierarchy, setHierarchy] = useState(null);
  const [memories, setMemories] = useState([]);
  const [stats, setStats] = useState(null);
  const [coverage, setCoverage] = useState([]);
  const [gaps, setGaps] = useState([]);
  const [expandedMemories, setExpandedMemories] = useState({});

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [memoryTypeFilter, setMemoryTypeFilter] = useState('all');
  const [gapDaysFilter, setGapDaysFilter] = useState(30);

  // Check if summarization is available
  const [summarizationAvailable, setSummarizationAvailable] = useState(false);

  useEffect(() => {
    const available = graphApi.isSummarizationAvailable();
    setSummarizationAvailable(available);
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    if (!summarizationAvailable) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      // Load data in parallel based on what we need
      const promises = [];

      // Always load stats
      promises.push(graphApi.getSummarizationStats(token));

      if (conceptId) {
        // Load hierarchy for specific concept
        promises.push(
          graphApi.getSummarizationHierarchy(conceptId, {
            includeEpisodes: true,
            maxMemories: 20,
            maxEpisodesPerMemory: 5,
          }, token)
        );
        promises.push(graphApi.getConceptTimeline(conceptId, 50, token));
      } else {
        // Load general coverage and gaps
        promises.push(graphApi.getMemoryCoverage(20, token));
        promises.push(graphApi.findMemoryGaps(gapDaysFilter, token));
      }

      const results = await Promise.all(promises);

      // Process results
      setStats(results[0]?.data || results[0] || null);

      if (conceptId) {
        setHierarchy(results[1]?.data || results[1] || null);
        const timelineData = results[2]?.data || results[2] || [];
        setMemories(Array.isArray(timelineData) ? timelineData : []);
      } else {
        const coverageData = results[1]?.data || results[1] || [];
        setCoverage(Array.isArray(coverageData) ? coverageData : []);
        const gapsData = results[2]?.data || results[2] || [];
        setGaps(Array.isArray(gapsData) ? gapsData : []);
      }
    } catch (err) {
      console.error('[MemoryTimelinePanel] Failed to load data:', err);
      setError(err.message || 'Failed to load memory data');
    } finally {
      setLoading(false);
    }
  }, [conceptId, gapDaysFilter, summarizationAvailable]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Toggle memory expansion
  const toggleMemoryExpand = (memoryId) => {
    setExpandedMemories((prev) => ({
      ...prev,
      [memoryId]: !prev[memoryId],
    }));
  };

  // Load episodes for a memory when expanded
  const loadEpisodesForMemory = async (memoryId) => {
    if (!summarizationAvailable) return;

    try {
      const token = localStorage.getItem('token');
      const result = await graphApi.getSourceEpisodes(memoryId, 10, token);
      const episodes = result?.data || result || [];

      // Update the memory with its episodes
      setMemories((prev) =>
        prev.map((m) => {
          if (m.memory?.id === memoryId || m.id === memoryId) {
            return { ...m, loadedEpisodes: episodes };
          }
          return m;
        })
      );
    } catch (err) {
      console.error('[MemoryTimelinePanel] Failed to load episodes:', err);
    }
  };

  // Filter memories
  const filteredMemories = memories.filter((item) => {
    const memory = item.memory || item;
    const matchesSearch =
      !searchQuery ||
      memory.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.conceptName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      memoryTypeFilter === 'all' || memory.memoryType === memoryTypeFilter;
    return matchesSearch && matchesType;
  });

  // Render memory card
  const renderMemoryCard = (item, index) => {
    const memory = item.memory || item;
    const episodes = item.episodes || item.loadedEpisodes || [];
    const isExpanded = expandedMemories[memory.id];
    const typeConfig = MEMORY_TYPE_CONFIG[memory.memoryType] || MEMORY_TYPE_CONFIG.concept_session;
    const masteryConfig = MASTERY_LEVELS[memory.masteryAssessment] || MASTERY_LEVELS.developing;
    const TypeIcon = typeConfig.icon;
    const MasteryIcon = masteryConfig.icon;

    return (
      <Box key={memory.id || index} sx={{ position: 'relative', pl: 3 }}>
        <TimelineNode>
          <TypeIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
        </TimelineNode>

        <MemoryCard
          colorKey={typeConfig.color}
          onClick={() => toggleMemoryExpand(memory.id)}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                size="small"
                label={typeConfig.label}
                color={typeConfig.color}
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
              {memory.conceptName && (
                <Typography variant="subtitle2" fontWeight={600}>
                  {memory.conceptName}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={masteryConfig.label}>
                <MasteryIcon
                  sx={{
                    fontSize: 18,
                    color: theme.palette[masteryConfig.color]?.main,
                  }}
                />
              </Tooltip>
              <IconButton size="small">
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          {/* Period */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
          >
            {memory.periodStart && memory.periodEnd
              ? `${new Date(memory.periodStart).toLocaleDateString()} - ${new Date(memory.periodEnd).toLocaleDateString()}`
              : memory.createdAt
              ? new Date(memory.createdAt).toLocaleDateString()
              : 'Unknown date'}
          </Typography>

          {/* Summary */}
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {memory.summary?.slice(0, 200)}
            {memory.summary?.length > 200 ? '...' : ''}
          </Typography>

          {/* Metrics chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {memory.episodeCount > 0 && (
              <EpisodeChip
                size="small"
                icon={<LayersIcon />}
                label={`${memory.episodeCount} episodes`}
                variant="outlined"
              />
            )}
            {memory.metrics?.accuracy && (
              <EpisodeChip
                size="small"
                icon={<TrendingUpIcon />}
                label={`${memory.metrics.accuracy}% accuracy`}
                variant="outlined"
                color={memory.metrics.accuracy >= 70 ? 'success' : 'warning'}
              />
            )}
            {memory.learningStyle && (
              <EpisodeChip
                size="small"
                icon={<PsychologyIcon />}
                label={memory.learningStyle}
                variant="outlined"
              />
            )}
          </Box>

          {/* Expanded content */}
          <Collapse in={isExpanded}>
            <Divider sx={{ my: 2 }} />

            {/* Insights */}
            {memory.insights && memory.insights.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Key Insights
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  {(Array.isArray(memory.insights)
                    ? memory.insights
                    : JSON.parse(memory.insights || '[]')
                  ).map((insight, i) => (
                    <Typography
                      key={i}
                      variant="body2"
                      sx={{
                        pl: 2,
                        borderLeft: `2px solid ${theme.palette.primary.main}`,
                        mb: 0.5,
                      }}
                    >
                      {insight}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}

            {/* Recommendations */}
            {memory.recommendations && memory.recommendations.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Recommendations
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  {(Array.isArray(memory.recommendations)
                    ? memory.recommendations
                    : JSON.parse(memory.recommendations || '[]')
                  ).map((rec, i) => (
                    <Alert
                      key={i}
                      severity="info"
                      sx={{ mb: 0.5, py: 0, '& .MuiAlert-message': { py: 0.5 } }}
                    >
                      {rec}
                    </Alert>
                  ))}
                </Box>
              </Box>
            )}

            {/* Source Episodes */}
            {episodes.length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Source Episodes ({episodes.length})
                </Typography>
                <Box sx={{ mt: 1, maxHeight: 200, overflowY: 'auto' }}>
                  {episodes.map((ep, i) => {
                    const episode = ep.episode || ep;
                    return (
                      <Box
                        key={episode.id || i}
                        sx={{
                          p: 1,
                          mb: 0.5,
                          borderRadius: 1,
                          background: alpha(theme.palette.action.hover, 0.5),
                          fontSize: '0.75rem',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 0.5,
                          }}
                        >
                          <Chip
                            size="small"
                            label={episode.eventType?.replace(/_/g, ' ')}
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {episode.timestamp
                              ? new Date(episode.timestamp).toLocaleString()
                              : ''}
                          </Typography>
                        </Box>
                        {episode.payload?.wasCorrect !== undefined && (
                          <Typography variant="caption">
                            {episode.payload.wasCorrect ? '✓ Correct' : '✗ Incorrect'}
                            {episode.payload.newBox && ` → Box ${episode.payload.newBox}`}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Load episodes button if not loaded */}
            {episodes.length === 0 && memory.episodeCount > 0 && (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 1,
                  cursor: 'pointer',
                  color: theme.palette.primary.main,
                  '&:hover': { textDecoration: 'underline' },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  loadEpisodesForMemory(memory.id);
                }}
              >
                <Typography variant="caption">
                  Load {memory.episodeCount} source episodes →
                </Typography>
              </Box>
            )}
          </Collapse>
        </MemoryCard>
      </Box>
    );
  };

  // Render stats overview
  const renderStatsOverview = () => {
    if (!stats) return null;

    return (
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatBox colorKey="primary" sx={{ flex: 1, minWidth: 120 }}>
          <MemoryIcon sx={{ fontSize: 28, color: theme.palette.primary.main, mb: 1 }} />
          <Typography variant="h5" fontWeight={700}>
            {stats.totalMemories || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Memories
          </Typography>
        </StatBox>

        <StatBox colorKey="secondary" sx={{ flex: 1, minWidth: 120 }}>
          <LayersIcon sx={{ fontSize: 28, color: theme.palette.info.main, mb: 1 }} />
          <Typography variant="h5" fontWeight={700}>
            {stats.totalEpisodes || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Episodes
          </Typography>
        </StatBox>

        <StatBox colorKey="warning" sx={{ flex: 1, minWidth: 120 }}>
          <PsychologyIcon sx={{ fontSize: 28, color: theme.palette.warning.main, mb: 1 }} />
          <Typography variant="h5" fontWeight={700}>
            {stats.conceptsCovered || coverage.length || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Concepts
          </Typography>
        </StatBox>

        {stats.byType && (
          <StatBox colorKey="error" sx={{ flex: 1, minWidth: 120 }}>
            <BubbleChartIcon sx={{ fontSize: 28, color: theme.palette.error.main, mb: 1 }} />
            <Typography variant="h5" fontWeight={700}>
              {stats.byType.cross_concept || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Cross-Concept
            </Typography>
          </StatBox>
        )}
      </Box>
    );
  };

  // Render memory gaps
  const renderMemoryGaps = () => {
    if (!showGaps || gaps.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <WarningAmberIcon sx={{ color: theme.palette.warning.main }} />
          <Typography variant="subtitle2" fontWeight={600}>
            Memory Gaps ({gaps.length})
          </Typography>
          <Tooltip title="Concepts that haven't been reviewed recently">
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </Tooltip>
        </Box>

        <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
          {gaps.slice(0, 10).map((gap, i) => (
            <GapAlert
              key={gap.conceptId || i}
              onClick={() => onConceptSelect({ id: gap.conceptId, name: gap.conceptName })}
            >
              <WarningAmberIcon
                sx={{ fontSize: 20, color: theme.palette.warning.main }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  {gap.conceptName || gap.conceptId}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {gap.daysSinceLastMemory} days since last memory
                </Typography>
              </Box>
              <Chip
                size="small"
                label="Review"
                color="warning"
                variant="outlined"
                sx={{ height: 22 }}
              />
            </GapAlert>
          ))}
        </Box>
      </Box>
    );
  };

  // Render coverage overview
  const renderCoverageOverview = () => {
    if (conceptId || coverage.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
          Memory Coverage by Concept
        </Typography>

        {coverage.slice(0, 8).map((item, i) => (
          <Box
            key={item.conceptId || i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 1,
              cursor: 'pointer',
              '&:hover': { opacity: 0.8 },
            }}
            onClick={() =>
              onConceptSelect({ id: item.conceptId, name: item.conceptName })
            }
          >
            <Typography
              variant="body2"
              sx={{ flex: 1, minWidth: 120 }}
              noWrap
            >
              {item.conceptName || item.conceptId}
            </Typography>
            <Box sx={{ flex: 2, mx: 1 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (item.memoryCount / (coverage[0]?.memoryCount || 1)) * 100)}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                  },
                }}
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 60, textAlign: 'right' }}
            >
              {item.memoryCount} memories
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  // Render not available state
  if (!summarizationAvailable) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          p: 4,
        }}
      >
        <MemoryIcon
          sx={{ fontSize: 64, color: 'text.disabled', mb: 2, opacity: 0.5 }}
        />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Memory Timeline Not Available
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
          The memory consolidation system requires Neo4j to be connected and the
          summarization service to be enabled. Please check your graph database
          settings.
        </Typography>
      </Box>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" width="25%" height={80} />
          ))}
        </Box>
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            variant="rounded"
            width="100%"
            height={120}
            sx={{ mb: 2 }}
          />
        ))}
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ height, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header with filters */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 2,
          flexWrap: 'wrap',
        }}
      >
        <TextField
          size="small"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, minWidth: 200 }}
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={memoryTypeFilter}
            label="Type"
            onChange={(e) => setMemoryTypeFilter(e.target.value)}
          >
            <MenuItem value="all">All Types</MenuItem>
            {Object.entries(MEMORY_TYPE_CONFIG).map(([key, config]) => (
              <MenuItem key={key} value={key}>
                {config.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {!conceptId && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Gap Days</InputLabel>
            <Select
              value={gapDaysFilter}
              label="Gap Days"
              onChange={(e) => setGapDaysFilter(e.target.value)}
            >
              <MenuItem value={7}>7 days</MenuItem>
              <MenuItem value={14}>14 days</MenuItem>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={60}>60 days</MenuItem>
            </Select>
          </FormControl>
        )}

        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon
                sx={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Concept header if viewing specific concept */}
      {conceptId && hierarchy && (
        <Box
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2,
            background: alpha(theme.palette.primary.main, 0.08),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            {hierarchy.concept?.name || conceptName || conceptId}
          </Typography>
          {hierarchy.concept?.description && (
            <Typography variant="body2" color="text.secondary">
              {hierarchy.concept.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip
              size="small"
              label={`${hierarchy.memories?.length || filteredMemories.length} memories`}
              icon={<MemoryIcon />}
            />
            {hierarchy.concept?.masteryLevel && (
              <Chip
                size="small"
                label={hierarchy.concept.masteryLevel}
                color={MASTERY_LEVELS[hierarchy.concept.masteryLevel]?.color || 'default'}
              />
            )}
          </Box>
        </Box>
      )}

      {/* Stats Overview */}
      {showStats && renderStatsOverview()}

      {/* Sub-tabs for different views */}
      {!conceptId && (
        <Tabs
          value={activeSubTab}
          onChange={(e, v) => setActiveSubTab(v)}
          sx={{ mb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
        >
          <Tab
            label="Timeline"
            icon={<TimelineIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            sx={{ minHeight: 42 }}
          />
          <Tab
            label="Coverage"
            icon={<AutoGraphIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            sx={{ minHeight: 42 }}
          />
          <Tab
            label="Gaps"
            icon={<WarningAmberIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            sx={{ minHeight: 42 }}
          />
        </Tabs>
      )}

      {/* Scrollable content area */}
      <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
        {/* Timeline View */}
        {(conceptId || activeSubTab === 0) && (
          <>
            {filteredMemories.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <ArticleIcon
                  sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }}
                />
                <Typography color="text.secondary">
                  No memories found
                  {searchQuery && ` matching "${searchQuery}"`}
                </Typography>
              </Box>
            ) : (
              <TimelineContainer>
                {filteredMemories.map((item, index) =>
                  renderMemoryCard(item, index)
                )}
              </TimelineContainer>
            )}
          </>
        )}

        {/* Coverage View */}
        {!conceptId && activeSubTab === 1 && renderCoverageOverview()}

        {/* Gaps View */}
        {!conceptId && activeSubTab === 2 && renderMemoryGaps()}
      </Box>
    </Box>
  );
}

MemoryTimelinePanel.propTypes = {
  conceptId: PropTypes.string,
  conceptName: PropTypes.string,
  onConceptSelect: PropTypes.func,
  onMemorySelect: PropTypes.func,
  height: PropTypes.number,
  showStats: PropTypes.bool,
  showGaps: PropTypes.bool,
};

export default MemoryTimelinePanel;
