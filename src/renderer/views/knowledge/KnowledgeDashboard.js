/**
 * KnowledgeDashboard.js
 *
 * Simplified to 3 tabs: Graph | Study | Plan
 * Study = Weak Concepts + Re-read Queue side-by-side
 * Plan = Learning Path / Curriculum / Timeline via inner toggle
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme, alpha, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Fade from '@mui/material/Fade';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';

// Icons
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TimelineIcon from '@mui/icons-material/Timeline';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SchoolIcon from '@mui/icons-material/School';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import HubIcon from '@mui/icons-material/Hub';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import RouteIcon from '@mui/icons-material/Route';
import MapIcon from '@mui/icons-material/Map';
import BoltIcon from '@mui/icons-material/Bolt';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MemoryIcon from '@mui/icons-material/Memory';
import ReplayIcon from '@mui/icons-material/Replay';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

// Graph components
import KnowledgeGraphPanel from '../../components/graph/KnowledgeGraphPanel';
import LearningPathPanel from '../../components/graph/LearningPathPanel';
import WeakConceptsPanel from '../../components/graph/WeakConceptsPanel';

// Learning components
import { NotificationsPanel } from '../../components/learning';

// Knowledge components
import MemoryTimelinePanel from '../../components/knowledge/MemoryTimelinePanel';
import CrossBookPathPanel from '../../components/knowledge/CrossBookPathPanel';
import RereadQueuePanel from '../../components/knowledge/RereadQueuePanel';
import ProductionPromptPanel from '../../components/knowledge/ProductionPromptPanel';
import MindmapLibraryPanel from '../../components/mindmap/MindmapLibraryPanel';

// API
import graphApi from '../../api/graphApi';
import { getUnreadCount as fetchUnreadCount } from '../../api/notificationApi';
import { getNotesByQuery } from '../../api/notesApi';

// Color palettes for light mode
const ACCENT_COLORS = {
  primary: { bg: '#E8F5E9', accent: '#4CAF50', glow: 'rgba(76, 175, 80, 0.3)' },
  secondary: {
    bg: '#E3F2FD',
    accent: '#2196F3',
    glow: 'rgba(33, 150, 243, 0.3)',
  },
  warning: { bg: '#FFF3E0', accent: '#FF9800', glow: 'rgba(255, 152, 0, 0.3)' },
  error: { bg: '#FFEBEE', accent: '#F44336', glow: 'rgba(244, 67, 54, 0.3)' },
  purple: { bg: '#F3E5F5', accent: '#9C27B0', glow: 'rgba(156, 39, 176, 0.3)' },
  cyan: { bg: '#E0F7FA', accent: '#00BCD4', glow: 'rgba(0, 188, 212, 0.3)' },
  gold: { bg: '#FFF8E1', accent: '#FFC107', glow: 'rgba(255, 193, 7, 0.3)' },
  indigo: { bg: '#E8EAF6', accent: '#3F51B5', glow: 'rgba(63, 81, 181, 0.3)' },
};

// Color palettes for dark mode
const ACCENT_COLORS_DARK = {
  primary: { bg: '#1B3A1B', accent: '#4CAF50', glow: 'rgba(76, 175, 80, 0.4)' },
  secondary: {
    bg: '#0D2137',
    accent: '#2196F3',
    glow: 'rgba(33, 150, 243, 0.4)',
  },
  warning: { bg: '#2D1B00', accent: '#FF9800', glow: 'rgba(255, 152, 0, 0.4)' },
  error: { bg: '#2D1515', accent: '#F44336', glow: 'rgba(244, 67, 54, 0.4)' },
  purple: { bg: '#2A1B2E', accent: '#9C27B0', glow: 'rgba(156, 39, 176, 0.4)' },
  cyan: { bg: '#0A2A2D', accent: '#00BCD4', glow: 'rgba(0, 188, 212, 0.4)' },
  gold: { bg: '#2D2600', accent: '#FFC107', glow: 'rgba(255, 193, 7, 0.4)' },
  indigo: { bg: '#1A1D2E', accent: '#3F51B5', glow: 'rgba(63, 81, 181, 0.4)' },
};

const DashboardContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  padding: theme.spacing(3),
  background:
    theme.palette.mode === 'dark'
      ? 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)'
      : 'linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 50%, #f0f4f8 100%)',
  position: 'relative',
  overflowX: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      theme.palette.mode === 'dark'
        ? 'radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)'
        : 'radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
}));

const GlassCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'colorKey',
})(({ theme, colorKey = 'secondary' }) => {
  const colors =
    theme.palette.mode === 'dark' ? ACCENT_COLORS_DARK : ACCENT_COLORS;
  const palette = colors[colorKey] || colors.secondary;

  return {
    background:
      theme.palette.mode === 'dark'
        ? `linear-gradient(135deg, ${alpha(palette.bg, 0.8)} 0%, ${alpha(palette.bg, 0.4)} 100%)`
        : `linear-gradient(135deg, ${alpha('#ffffff', 0.9)} 0%, ${alpha('#ffffff', 0.7)} 100%)`,
    backdropFilter: 'blur(12px)',
    borderRadius: 20,
    border: `1px solid ${alpha(palette.accent, 0.2)}`,
    boxShadow:
      theme.palette.mode === 'dark'
        ? `0 8px 32px ${alpha('#000', 0.3)}, inset 0 1px 0 ${alpha('#fff', 0.05)}`
        : `0 8px 32px ${alpha('#000', 0.08)}, inset 0 1px 0 ${alpha('#fff', 0.5)}`,
    overflow: 'hidden',
    position: 'relative',
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow:
        theme.palette.mode === 'dark'
          ? `0 12px 48px ${palette.glow}, inset 0 1px 0 ${alpha('#fff', 0.08)}`
          : `0 12px 48px ${alpha('#000', 0.12)}, inset 0 1px 0 ${alpha('#fff', 0.8)}`,
    },
  };
});

const HeaderBanner = styled(Box)(({ theme }) => ({
  background:
    theme.palette.mode === 'dark'
      ? 'linear-gradient(135deg, #1e3a5f 0%, #2d1b4e 50%, #1a3a4a 100%)'
      : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B8DD6 100%)',
  borderRadius: 24,
  padding: theme.spacing(4),
  color: '#fff',
  position: 'relative',
  overflow: 'hidden',
  marginBottom: theme.spacing(3),
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    right: '-20%',
    width: '400px',
    height: '400px',
    background:
      'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'float 6s ease-in-out infinite',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: '-30%',
    left: '-10%',
    width: '300px',
    height: '300px',
    background:
      'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'float 8s ease-in-out infinite reverse',
  },
  '@keyframes float': {
    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
    '50%': { transform: 'translateY(-20px) rotate(5deg)' },
  },
}));

const StatChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'colorKey',
})(({ theme, colorKey = 'primary' }) => {
  const colors =
    theme.palette.mode === 'dark' ? ACCENT_COLORS_DARK : ACCENT_COLORS;
  const palette = colors[colorKey] || colors.primary;

  return {
    background: `linear-gradient(135deg, ${palette.accent} 0%, ${alpha(palette.accent, 0.7)} 100%)`,
    color: '#fff',
    fontWeight: 600,
    padding: '4px 8px',
    height: 'auto',
    '& .MuiChip-icon': {
      color: '#fff',
    },
    '& .MuiChip-label': {
      padding: '4px 8px',
    },
  };
});

const MetricCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'colorKey',
})(({ theme, colorKey = 'secondary' }) => {
  const colors =
    theme.palette.mode === 'dark' ? ACCENT_COLORS_DARK : ACCENT_COLORS;
  const palette = colors[colorKey] || colors.secondary;

  return {
    background:
      theme.palette.mode === 'dark'
        ? alpha(palette.bg, 0.6)
        : alpha('#fff', 0.8),
    backdropFilter: 'blur(8px)',
    borderRadius: 16,
    padding: theme.spacing(2.5),
    border: `1px solid ${alpha(palette.accent, 0.15)}`,
    transition: 'all 0.25s ease',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      width: 4,
      height: '100%',
      background: `linear-gradient(180deg, ${palette.accent} 0%, ${alpha(palette.accent, 0.5)} 100%)`,
      borderRadius: '4px 0 0 4px',
    },
    '&:hover': {
      transform: 'translateX(4px)',
      boxShadow: `0 8px 24px ${palette.glow}`,
      borderColor: alpha(palette.accent, 0.4),
    },
  };
});

const TabsContainer = styled(Tabs)(({ theme }) => ({
  minHeight: 48,
  flex: 1,
  minWidth: 0,
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: 3,
    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
  },
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '0.95rem',
    minHeight: 48,
    padding: '12px 24px',
    borderRadius: '12px 12px 0 0',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-selected': {
      color: theme.palette.mode === 'dark' ? '#a78bfa' : '#667eea',
    },
  },
}));

function KnowledgeDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme.palette.mode === 'dark';
  const colors = isDark ? ACCENT_COLORS_DARK : ACCENT_COLORS;

  // Phase 8 production loop: notification's actionUrl carries `?produce=<id>`.
  const produceParam = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('produce') || null;
  }, [location.search]);

  const closeProducePanel = useCallback(() => {
    const params = new URLSearchParams(location.search);
    params.delete('produce');
    const next = params.toString();
    navigate(
      { pathname: location.pathname, search: next ? `?${next}` : '' },
      { replace: true },
    );
  }, [location.search, location.pathname, navigate]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  // Plan tab inner view: 'path' | 'curriculum' | 'timeline'
  const [planView, setPlanView] = useState('path');
  const [stats, setStats] = useState({
    concepts: 0,
    mastered: 0,
    inProgress: 0,
    weak: 0,
    averageMastery: 0,
  });
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [weakConcepts, setWeakConcepts] = useState([]);

  // Notification state
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recentNotes, setRecentNotes] = useState([]);
  const [extractingIds, setExtractingIds] = useState(new Set());
  const [extractedIds, setExtractedIds] = useState(new Set());
  const [extractSnack, setExtractSnack] = useState({ open: false, message: '', severity: 'success' });
  const [bulkExtracting, setBulkExtracting] = useState(false);

  const buildNoteText = (note) => {
    const parts = [];
    if (note.title) parts.push(note.title);
    if (note.description) parts.push(note.description);
    if (Array.isArray(note.cards)) {
      note.cards.forEach((c) => {
        if (c.text) parts.push(c.text);
        if (c.front) parts.push(c.front);
        if (c.back) parts.push(c.back);
        if (c.content) parts.push(c.content);
      });
    }
    return parts.join('\n\n').trim();
  };

  const handleBulkExtract = useCallback(async () => {
    const notes = recentNotes.slice(0, 10);
    if (notes.length === 0) {
      setExtractSnack({ open: true, message: 'No notes to extract from.', severity: 'info' });
      return;
    }
    setBulkExtracting(true);
    let totalConcepts = 0;
    let processed = 0;
    let providerMissing = false;
    for (const note of notes) {
      const text = buildNoteText(note);
      if (!text || text.length < 20) continue;
      try {
        const result = await graphApi.aiFullExtraction(text);
        if (result?.nodes?.length) {
          await graphApi.aiSaveExtraction(result.nodes, result.edges || [], note.id, 'Note');
          totalConcepts += result.nodes.length;
          setExtractedIds((prev) => new Set([...prev, note.id]));
        } else if (result?.error === 'no_provider') {
          providerMissing = true;
          break;
        }
        processed++;
      } catch (e) {
        // continue on individual failure
      }
    }
    setBulkExtracting(false);
    if (providerMissing) {
      setExtractSnack({ open: true, message: 'No AI provider configured. Go to Settings to add one.', severity: 'warning' });
      return;
    }
    loadData();
    setExtractSnack({
      open: true,
      message: totalConcepts > 0
        ? `Extracted ${totalConcepts} concepts from ${processed} note${processed !== 1 ? 's' : ''}`
        : 'No concepts found. Try adding more content to your notes.',
      severity: totalConcepts > 0 ? 'success' : 'info',
    });
  }, [recentNotes]);

  const loadRecentNotes = useCallback(async () => {
    try {
      const result = await getNotesByQuery({ query: '', page: 1, limit: 30 });
      const notes = Array.isArray(result) ? result : (result?.data || []);
      notes.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      setRecentNotes(notes);
    } catch (e) {
      console.error('Failed to load recent notes:', e);
    }
  }, []);

  useEffect(() => {
    loadRecentNotes();
  }, [loadRecentNotes]);

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);

      const connected = graphApi.isConnected();
      if (!connected) {
        await graphApi.connect();
      }

      const [graphResult, weakResult] = await Promise.all([
        graphApi.getKnowledgeGraphData(),
        graphApi.detectWeakConcepts(5),
      ]);

      if (graphResult) {
        setGraphData(graphResult);

        const nodes = graphResult.nodes || [];
        const mastered = nodes.filter((n) => n.mastery >= 80).length;
        const inProgress = nodes.filter(
          (n) => n.mastery >= 30 && n.mastery < 80,
        ).length;
        const weak = nodes.filter((n) => n.mastery < 30).length;
        const avgMastery =
          nodes.length > 0
            ? Math.round(
                nodes.reduce((sum, n) => sum + (n.mastery || 0), 0) /
                  nodes.length,
              )
            : 0;

        setStats({
          concepts: nodes.length,
          mastered,
          inProgress,
          weak,
          averageMastery: avgMastery,
        });
      }

      if (weakResult) {
        setWeakConcepts(weakResult);
      }
    } catch (error) {
      console.error('Error loading knowledge data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleConceptSelect = (concept) => {
    setSelectedConcept(concept);
  };

  const loadNotificationCount = useCallback(async () => {
    try {
      const result = await fetchUnreadCount();
      if (result.success) {
        setUnreadCount(result.count);
      }
    } catch (error) {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadNotificationCount();
  }, [loadNotificationCount]);

  const handleNotificationClick = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
    loadNotificationCount();
  };

  const renderProgressRing = (value, size, colorKey) => {
    const palette = colors[colorKey] || colors.primary;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;

    return (
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={alpha(palette.accent, 0.15)}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={palette.accent}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.8s ease',
              filter: `drop-shadow(0 0 6px ${palette.glow})`,
            }}
          />
        </svg>
        <Typography
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontWeight: 700,
            fontSize: size * 0.22,
          }}
        >
          {value}%
        </Typography>
      </Box>
    );
  };

  return (
    <DashboardContainer>
      {/* Header Banner */}
      <HeaderBanner>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <HubIcon sx={{ fontSize: 40, opacity: 0.9 }} />
              <Typography variant="h4" fontWeight={700}>
                Knowledge Dashboard
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Notifications">
                <IconButton
                  onClick={handleNotificationClick}
                  sx={{
                    color: '#fff',
                    background: alpha('#fff', 0.15),
                    '&:hover': { background: alpha('#fff', 0.25) },
                  }}
                >
                  <Badge badgeContent={unreadCount} color="error" max={99}>
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="body1"
              sx={{ opacity: 0.85, maxWidth: 600, mb: 3 }}
            >
              Visualize your learning journey. Track concept mastery, discover
              weak areas, and navigate personalized learning paths powered by
              graph intelligence.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <StatChip
                icon={<PsychologyIcon />}
                label={`${stats.concepts} Concepts`}
                colorKey="secondary"
              />
              <StatChip
                icon={<CheckCircleIcon />}
                label={`${stats.mastered} Mastered`}
                colorKey="primary"
              />
              <StatChip
                icon={<TrendingUpIcon />}
                label={`${stats.averageMastery}% Avg Mastery`}
                colorKey="gold"
              />
            </Box>
          </Grid>
          <Grid
            item
            xs={12}
            md={4}
            sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
          >
            {renderProgressRing(stats.averageMastery, 140, 'gold')}
            <Typography
              variant="caption"
              sx={{ mt: 1, display: 'block', opacity: 0.8 }}
            >
              Overall Mastery
            </Typography>
          </Grid>
        </Grid>
      </HeaderBanner>

      {/* Quick Stats Grid */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <MetricCard colorKey="primary" onClick={() => setActiveTab(0)}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${colors.primary.accent} 0%, ${alpha(colors.primary.accent, 0.7)} 100%)`,
                }}
              >
                <CheckCircleIcon sx={{ color: '#fff', fontSize: 26 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {loading ? <Skeleton width={40} /> : stats.mastered}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Mastered
                </Typography>
              </Box>
            </Box>
          </MetricCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard colorKey="secondary" onClick={() => setActiveTab(0)}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${colors.secondary.accent} 0%, ${alpha(colors.secondary.accent, 0.7)} 100%)`,
                }}
              >
                <TrendingUpIcon sx={{ color: '#fff', fontSize: 26 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {loading ? <Skeleton width={40} /> : stats.inProgress}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  In Progress
                </Typography>
              </Box>
            </Box>
          </MetricCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard colorKey="warning" onClick={() => setActiveTab(1)}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${colors.warning.accent} 0%, ${alpha(colors.warning.accent, 0.7)} 100%)`,
                }}
              >
                <WarningAmberIcon sx={{ color: '#fff', fontSize: 26 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {loading ? <Skeleton width={40} /> : stats.weak}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Needs Work
                </Typography>
              </Box>
            </Box>
          </MetricCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard colorKey="purple" onClick={() => { setActiveTab(2); setPlanView('path'); }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${colors.purple.accent} 0%, ${alpha(colors.purple.accent, 0.7)} 100%)`,
                }}
              >
                <RouteIcon sx={{ color: '#fff', fontSize: 26 }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {loading ? (
                    <Skeleton width={40} />
                  ) : (
                    graphData.edges?.length || 0
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Connections
                </Typography>
              </Box>
            </Box>
          </MetricCard>
        </Grid>
      </Grid>

      {/* Main Content Area */}
      <GlassCard colorKey="secondary" sx={{ p: 0 }}>
        {/* Tabs Header */}
        <Box
          sx={{
            px: 3,
            pt: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <TabsContainer
            value={activeTab}
            onChange={handleTabChange}
          >
            <Tab
              icon={<AccountTreeIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Graph"
            />
            <Tab
              icon={<ReplayIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Study"
            />
            <Tab
              icon={<RouteIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Plan"
            />
            <Tab
              icon={<MapIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Maps"
            />
          </TabsContainer>
          <Tooltip title="Refresh data">
            <span>
              <IconButton onClick={loadData} disabled={refreshing}>
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

        {/* Tab Panels */}
        <Box sx={{ minHeight: 500, p: 3 }}>

          {/* Tab 0: Graph */}
          <Fade in={activeTab === 0} unmountOnExit>
            <Box sx={{ display: activeTab === 0 ? 'block' : 'none' }}>
              {!loading && graphData.nodes.length === 0 && (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    mb: 2,
                    borderRadius: 3,
                    border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                    background: alpha(theme.palette.primary.main, isDark ? 0.04 : 0.02),
                  }}
                >
                  <HubIcon sx={{ fontSize: 48, color: alpha(theme.palette.primary.main, 0.3), mb: 1 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Knowledge graph is empty
                  </Typography>
                  <Typography variant="body2" color="text.disabled" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
                    Extract concepts from your notes to build the graph. Concepts are linked automatically by meaning.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={bulkExtracting ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <AutoAwesomeIcon />}
                    onClick={handleBulkExtract}
                    disabled={bulkExtracting || recentNotes.length === 0}
                    sx={{ borderRadius: 2, textTransform: 'none', mr: 1 }}
                  >
                    {bulkExtracting ? 'Extracting…' : recentNotes.length > 0 ? `Extract from ${Math.min(recentNotes.length, 10)} notes` : 'No notes yet'}
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => navigate('/notes')}
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                  >
                    Open Notes →
                  </Button>
                </Box>
              )}
              <KnowledgeGraphPanel
                graphData={graphData}
                onNodeSelect={handleConceptSelect}
                loading={loading}
                height={500}
              />
            </Box>
          </Fade>

          {/* Tab 1: Study — weak concepts + re-read queue */}
          <Fade in={activeTab === 1} unmountOnExit>
            <Box
              sx={{
                display: activeTab === 1 ? 'flex' : 'none',
                gap: 3,
                flexWrap: { xs: 'wrap', md: 'nowrap' },
                minHeight: 500,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <WeakConceptsPanel
                  weakConcepts={weakConcepts}
                  onConceptSelect={handleConceptSelect}
                  loading={loading}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <RereadQueuePanel />
              </Box>
            </Box>
          </Fade>

          {/* Tab 2: Plan — Learning Path / Curriculum / Timeline */}
          <Fade in={activeTab === 2} unmountOnExit>
            <Box sx={{ display: activeTab === 2 ? 'block' : 'none' }}>
              <Box sx={{ mb: 3 }}>
                <ToggleButtonGroup
                  value={planView}
                  exclusive
                  onChange={(e, v) => { if (v) setPlanView(v); }}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 2.5,
                      borderRadius: '10px !important',
                      border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                      mx: 0.5,
                      '&.Mui-selected': {
                        background: isDark
                          ? alpha('#667eea', 0.25)
                          : alpha('#667eea', 0.1),
                        color: isDark ? '#a78bfa' : '#667eea',
                        borderColor: alpha('#667eea', 0.5),
                      },
                    },
                  }}
                >
                  <ToggleButton value="path">
                    <RouteIcon sx={{ mr: 1, fontSize: 18 }} />
                    Learning Path
                  </ToggleButton>
                  <ToggleButton value="curriculum">
                    <TimelineIcon sx={{ mr: 1, fontSize: 18 }} />
                    Curriculum
                  </ToggleButton>
                  <ToggleButton value="timeline">
                    <MemoryIcon sx={{ mr: 1, fontSize: 18 }} />
                    Timeline
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {planView === 'path' && (
                <LearningPathPanel
                  targetConceptId={selectedConcept?.id}
                  onConceptSelect={handleConceptSelect}
                />
              )}
              {planView === 'curriculum' && <CrossBookPathPanel />}
              {planView === 'timeline' && (
                <MemoryTimelinePanel
                  conceptId={selectedConcept?.id}
                  conceptName={selectedConcept?.name}
                  onConceptSelect={handleConceptSelect}
                  onMemorySelect={() => {}}
                  height={500}
                  showStats
                  showGaps
                />
              )}
            </Box>
          </Fade>

          {/* Tab 3: Maps — saved mindmap library */}
          <Fade in={activeTab === 3} unmountOnExit>
            <Box sx={{ display: activeTab === 3 ? 'block' : 'none' }}>
              <MindmapLibraryPanel />
            </Box>
          </Fade>

        </Box>
      </GlassCard>

      {/* Notifications Popover */}
      <Popover
        open={Boolean(notificationAnchor)}
        anchorEl={notificationAnchor}
        onClose={handleNotificationClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 1,
            borderRadius: 3,
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.4)'
              : '0 8px 32px rgba(0,0,0,0.15)',
          },
        }}
      >
        <NotificationsPanel
          onClose={handleNotificationClose}
          onNotificationClick={(notification) => {
            handleNotificationClose();
            if (notification?.actionUrl) navigate(notification.actionUrl);
          }}
          maxHeight={400}
        />
      </Popover>

      {/* Quick Actions Footer */}
      <Box
        sx={{
          mt: 3,
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Tooltip title="Start a learning session">
          <Box
            onClick={() => navigate('/vocabulary')}
            sx={{
              px: 3,
              py: 1.5,
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              background: `linear-gradient(135deg, ${colors.primary.accent} 0%, ${alpha(colors.primary.accent, 0.8)} 100%)`,
              color: '#fff',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: `0 8px 24px ${colors.primary.glow}`,
              },
            }}
          >
            <BoltIcon />
            <Typography variant="button">Start Learning</Typography>
          </Box>
        </Tooltip>
        <Tooltip title="Take a quiz">
          <Box
            onClick={() => navigate('/quiz')}
            sx={{
              px: 3,
              py: 1.5,
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              background: `linear-gradient(135deg, ${colors.purple.accent} 0%, ${alpha(colors.purple.accent, 0.8)} 100%)`,
              color: '#fff',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: `0 8px 24px ${colors.purple.glow}`,
              },
            }}
          >
            <SchoolIcon />
            <Typography variant="button">Take Quiz</Typography>
          </Box>
        </Tooltip>
        <Tooltip title="Review flashcards">
          <Box
            onClick={() => navigate('/notes')}
            sx={{
              px: 3,
              py: 1.5,
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              background: `linear-gradient(135deg, ${colors.secondary.accent} 0%, ${alpha(colors.secondary.accent, 0.8)} 100%)`,
              color: '#fff',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: `0 8px 24px ${colors.secondary.glow}`,
              },
            }}
          >
            <AutoGraphIcon />
            <Typography variant="button">Review Cards</Typography>
          </Box>
        </Tooltip>
      </Box>

      {/* Phase 8 production loop: floating "explain in your own words" panel. */}
      <ProductionPromptPanel
        open={Boolean(produceParam)}
        learningPointId={produceParam}
        onClose={closeProducePanel}
      />

      {/* Concept extraction feedback */}
      <Snackbar
        open={extractSnack.open}
        autoHideDuration={4000}
        onClose={() => setExtractSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={extractSnack.severity}
          onClose={() => setExtractSnack((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {extractSnack.message}
        </Alert>
      </Snackbar>
    </DashboardContainer>
  );
}

export default KnowledgeDashboard;
