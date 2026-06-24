import React, { useState, useEffect } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import {
  Box,
  Typography,
  IconButton,
  InputBase,
  Divider,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Badge,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import SchoolIcon from '@mui/icons-material/School';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StarIcon from '@mui/icons-material/Star';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ClearIcon from '@mui/icons-material/Clear';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import PsychologyIcon from '@mui/icons-material/Psychology';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import LeitnerSystem from '../../components/LeitnerSystem/LeitnerSystem';
import VocabularyListView from './VocabularyListView';
import customStorage from '../../store/customStorage';
import { getBySource, ensureVocabBackfilled } from '../../api/learningPointApi';

// Color palette for Leitner boxes - representing learning progress
const BOX_COLORS = [
  { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828', name: 'New' }, // Box 1 - Red (new/difficult)
  { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100', name: 'Learning' }, // Box 2 - Orange
  { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00', name: 'Reviewing' }, // Box 3 - Amber
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32', name: 'Familiar' }, // Box 4 - Green
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0', name: 'Mastered' }, // Box 5 - Blue
];

const BOX_COLORS_DARK = [
  { bg: '#2D1515', accent: '#F44336', icon: '#EF9A9A', name: 'New' },
  { bg: '#2D1B00', accent: '#FF9800', icon: '#FFB74D', name: 'Learning' },
  { bg: '#2D2600', accent: '#FFC107', icon: '#FFD54F', name: 'Reviewing' },
  { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784', name: 'Familiar' },
  { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6', name: 'Mastered' },
];

// Styled components matching Bookmarks view
const SearchContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
  borderRadius: theme.shape.borderRadius,
  padding: '4px 12px',
  transition: 'all 0.2s ease',
  border: `1px solid transparent`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.text.primary, 0.06),
  },
  '&:focus-within': {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
  },
}));

const SidebarSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const QuickFilterChip = styled(Chip)(({ theme, selected }) => ({
  height: 28,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  border: `1px solid ${selected
    ? theme.palette.primary.main
    : alpha(theme.palette.divider, 0.3)}`,
  color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: selected
      ? alpha(theme.palette.primary.main, 0.16)
      : alpha(theme.palette.text.primary, 0.04),
  },
}));

const StatCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'colorAccent',
})(({ theme, colorAccent }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius * 1.5,
  backgroundColor: alpha(colorAccent || theme.palette.primary.main, 0.08),
  border: `1px solid ${alpha(colorAccent || theme.palette.primary.main, 0.15)}`,
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: alpha(colorAccent || theme.palette.primary.main, 0.12),
    transform: 'translateY(-2px)',
  },
}));

const EmptyState = ({ icon: Icon, title, subtitle }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 300,
        textAlign: 'center',
        px: 4,
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          mb: 3,
        }}
      >
        <Icon sx={{ fontSize: 40, color: theme.palette.primary.main, opacity: 0.7 }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
        {subtitle}
      </Typography>
    </Box>
  );
};

function VocabularyView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorPalette = isDark ? BOX_COLORS_DARK : BOX_COLORS;

  const addVocabulary = useSelector((state) => state.vocabulary.addVocabulary);

  // Resolve the mirrored learning_point for the vocabulary so processReview uses
  // the correct LP id. Falls back to a vocab-format card if the mirror hasn't run yet.
  const [addItem, setAddItem] = useState(null);
  useEffect(() => {
    if (!addVocabulary) {
      setAddItem(null);
      return;
    }
    async function resolveLP() {
      const token = await customStorage.getToken();
      const results = await getBySource('vocabulary', String(addVocabulary.id), token);
      if (results && results.length > 0) {
        setAddItem(results[0]);
      } else {
        // Mirror not yet written — use vocab shape; review won't persist until mirror runs
        setAddItem({
          id: addVocabulary.id,
          domain_type: 'vocabulary',
          item_type: 'word',
          source_type: 'vocabulary',
          source_id: String(addVocabulary.id),
          title: addVocabulary.word,
          front: { text: addVocabulary.word || '' },
          back: { text: addVocabulary.definition || addVocabulary.detail || '' },
          box: addVocabulary.leitnerItem?.box || 1,
          review_count: addVocabulary.leitnerItem?.skips || 0,
          fully_learned: (addVocabulary.leitnerItem?.fullLearned || addVocabulary.leitnerItem?.fullyLearned) ? 1 : 0,
          next_review: addVocabulary.leitnerItem?.nextReview || null,
          extras: {
            relatedWords: addVocabulary.relatedWords || '',
            example: addVocabulary.example || '',
          },
        });
      }
    }
    resolveLP();
  }, [addVocabulary]);

  // Clicked box number (1-5) to filter Leitner cards; null = show all due
  const [boxFilter, setBoxFilter] = useState(null);
  // Incremented after backfill to trigger LeitnerSystem reload
  const [refreshToken, setRefreshToken] = useState(0);

  // Mirror any un-backfilled vocabulary rows to learning_point on first visit.
  // Idempotent on main side (one-shot per session), so safe to call every mount.
  useEffect(() => {
    async function runBackfill() {
      const token = await customStorage.getToken();
      await ensureVocabBackfilled(token);
      setRefreshToken((n) => n + 1);
    }
    runBackfill();
  }, []);

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('boxes'); // 'boxes' | 'words'
  const [quickFilter, setQuickFilter] = useState('review'); // 'review' or 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    dueToday: 0,
    mastered: 0,
    boxCounts: [0, 0, 0, 0, 0],
  });

  // Load statistics
  useEffect(() => {
    async function loadStats() {
      try {
        const dueResult = await customStorage.getVocabulariesByDueReview({
          dueTime: new Date(),
          page: 0,
          limit: 1000,
        });
        const allResult = await customStorage.getVocabulariesByQuery({
          query: '',
          page: 0,
          limit: 1000,
        });

        const allVocabs = allResult?.data || [];
        const boxCounts = [0, 0, 0, 0, 0];
        let mastered = 0;

        allVocabs.forEach((v) => {
          const box = v.leitnerItem?.box || 1;
          if (box >= 1 && box <= 5) {
            boxCounts[box - 1]++;
          }
          if (v.leitnerItem?.fullyLearned) {
            mastered++;
          }
        });

        setStats({
          total: allResult?.total || 0,
          dueToday: dueResult?.total || 0,
          mastered,
          boxCounts,
        });
      } catch (e) {
        console.error('Failed to load vocabulary stats:', e);
      }
    }
    loadStats();
  }, [addVocabulary]);

  const progressPercentage = stats.total > 0
    ? Math.round((stats.mastered / stats.total) * 100)
    : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          width: sidebarCollapsed ? 0 : 300,
          minWidth: sidebarCollapsed ? 0 : 300,
          height: '100%',
          bgcolor: theme.palette.background.paper,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar Header */}
        <SidebarSection sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }}
            >
              <SchoolIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Vocabulary
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Leitner Flashcards
              </Typography>
            </Box>
          </Box>

          {/* Search */}
          <SearchContainer>
            <SearchIcon sx={{ color: theme.palette.text.disabled, mr: 1, fontSize: 20 }} />
            <InputBase
              placeholder="Search words..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1, fontSize: '0.875rem' }}
            />
            {searchQuery && (
              <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25 }}>
                <ClearIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </SearchContainer>
        </SidebarSection>

        {/* Learning Progress */}
        <SidebarSection>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1.5,
            }}
          >
            Learning Progress
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {stats.mastered} of {stats.total} mastered
              </Typography>
              <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                {progressPercentage}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPercentage}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.success.main})`,
                },
              }}
            />
          </Box>

          {/* Quick Stats */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <StatCard colorAccent={theme.palette.warning.main} sx={{ flex: 1 }}>
              <AccessTimeIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
                  {stats.dueToday}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Due Today
                </Typography>
              </Box>
            </StatCard>
            <StatCard colorAccent={theme.palette.success.main} sx={{ flex: 1 }}>
              <EmojiEventsIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
                  {stats.mastered}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Mastered
                </Typography>
              </Box>
            </StatCard>
          </Box>
        </SidebarSection>

        {/* Tab Bar */}
        <Tabs
          value={sidebarTab}
          onChange={(_, v) => setSidebarTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            '& .MuiTab-root': { minHeight: 36, fontSize: '0.75rem', fontWeight: 600, py: 0 },
          }}
        >
          <Tab label="Boxes" value="boxes" />
          <Tab label={`Words (${stats.total})`} value="words" />
        </Tabs>

        {/* Tab: Leitner Boxes */}
        {sidebarTab === 'boxes' && (
          <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1 }}>
            {colorPalette.map((boxColor, index) => {
              const boxNum = index + 1;
              const isSelected = boxFilter === boxNum;
              return (
                <Box
                  key={index}
                  onClick={() => setBoxFilter(isSelected ? null : boxNum)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    mb: 1,
                    borderRadius: 2,
                    bgcolor: boxColor.bg,
                    border: `1px solid ${isSelected ? boxColor.accent : alpha(boxColor.accent, 0.2)}`,
                    outline: isSelected ? `2px solid ${alpha(boxColor.accent, 0.4)}` : 'none',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateX(4px)',
                      boxShadow: `0 2px 8px ${alpha(boxColor.accent, 0.2)}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(boxColor.accent, 0.15),
                    }}
                  >
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: boxColor.icon }}>
                      {index + 1}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: boxColor.icon }}>
                      {boxColor.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: alpha(boxColor.icon, 0.7) }}>
                      {index === 0 && 'Review daily'}
                      {index === 1 && 'Every 2 days'}
                      {index === 2 && 'Every 4 days'}
                      {index === 3 && 'Every week'}
                      {index === 4 && 'Every 2 weeks'}
                    </Typography>
                  </Box>
                  <Chip
                    label={stats.boxCounts[index]}
                    size="small"
                    sx={{
                      height: 24,
                      minWidth: 32,
                      fontWeight: 700,
                      bgcolor: alpha(boxColor.accent, 0.15),
                      color: boxColor.icon,
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        )}

        {/* Tab: Word List */}
        {sidebarTab === 'words' && (
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 1.5, pt: 1, pb: 0.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <QuickFilterChip
                icon={<AccessTimeIcon sx={{ fontSize: '14px !important' }} />}
                label={`For Review (${stats.dueToday})`}
                size="small"
                selected={quickFilter === 'review'}
                onClick={() => setQuickFilter('review')}
              />
              <QuickFilterChip
                icon={<Inventory2Icon sx={{ fontSize: '14px !important' }} />}
                label={`All Words (${stats.total})`}
                size="small"
                selected={quickFilter === 'all'}
                onClick={() => setQuickFilter('all')}
              />
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <VocabularyListView isReviewDue={quickFilter === 'review'} searchQuery={searchQuery} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Toggle Sidebar Button */}
      <IconButton
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        sx={{
          position: 'absolute',
          left: sidebarCollapsed ? 8 : 288,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: 24,
          height: 48,
          borderRadius: '0 4px 4px 0',
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderLeft: 'none',
          transition: 'left 0.2s ease',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        {sidebarCollapsed ? (
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 16, transform: 'rotate(180deg)' }} />
        )}
      </IconButton>

      {/* Main Content - Leitner System */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
        {/* Header Bar */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Leitner Flashcard System
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats.dueToday > 0
                  ? `${stats.dueToday} cards waiting for review`
                  : 'All caught up! Great job!'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<TrendingUpIcon />}
              label={`${progressPercentage}% Complete`}
              sx={{
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: theme.palette.success.main,
                fontWeight: 600,
                '& .MuiChip-icon': { color: theme.palette.success.main },
              }}
            />
          </Box>
        </Box>

        {/* Leitner Cards Area */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            p: 3,
            '&::-webkit-scrollbar': {
              width: 6,
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: alpha(theme.palette.text.primary, 0.1),
              borderRadius: 3,
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: alpha(theme.palette.text.primary, 0.2),
            },
          }}
        >
          {stats.dueToday === 0 && stats.total === 0 ? (
            <EmptyState
              icon={SchoolIcon}
              title="No vocabulary yet"
              subtitle="Add words from the sidebar to start building your vocabulary with spaced repetition learning"
            />
          ) : (
            <LeitnerSystem
              addItem={addItem}
              boxFilter={boxFilter}
              refreshToken={refreshToken}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default VocabularyView;
