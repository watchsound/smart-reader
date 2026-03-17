import React, { useState, useEffect, useMemo } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import {
  Box,
  Typography,
  IconButton,
  InputBase,
  Chip,
  Tooltip,
  Collapse,
  Badge,
  LinearProgress,
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import CastForEducationIcon from '@mui/icons-material/CastForEducation';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ClearIcon from '@mui/icons-material/Clear';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SchoolIcon from '@mui/icons-material/School';
import ScienceIcon from '@mui/icons-material/Science';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BiotechIcon from '@mui/icons-material/Biotech';
import CalculateIcon from '@mui/icons-material/Calculate';
import PublicIcon from '@mui/icons-material/Public';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

import LearnAboutDetailPanel from './LearnAboutDetailPanel';
import { learnAboutHandled } from '../../store/reducers/chatSlice';
import customStorage from '../../store/customStorage';

// Styled Components matching Bookmarks style
const SearchContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
  borderRadius: theme.shape.borderRadius,
  padding: '4px 12px',
  transition: 'all 0.2s ease',
  border: '1px solid transparent',
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
  border: `1px solid ${
    selected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3)
  }`,
  color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: selected
      ? alpha(theme.palette.primary.main, 0.16)
      : alpha(theme.palette.text.primary, 0.04),
  },
}));

// Topic Card Color Schemes
const TOPIC_COLORS = [
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' },
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' },
  { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100' },
  { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' },
  { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828' },
  { bg: '#E0F7FA', accent: '#00BCD4', icon: '#00838F' },
  { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00' },
  { bg: '#FCE4EC', accent: '#E91E63', icon: '#AD1457' },
  { bg: '#E8EAF6', accent: '#3F51B5', icon: '#283593' },
  { bg: '#F1F8E9', accent: '#8BC34A', icon: '#558B2F' },
];

const TOPIC_COLORS_DARK = [
  { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  { bg: '#2D1B00', accent: '#FF9800', icon: '#FFB74D' },
  { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
  { bg: '#2D1515', accent: '#F44336', icon: '#E57373' },
  { bg: '#0A2A2D', accent: '#00BCD4', icon: '#4DD0E1' },
  { bg: '#2D2600', accent: '#FFC107', icon: '#FFD54F' },
  { bg: '#2D1520', accent: '#E91E63', icon: '#F06292' },
  { bg: '#1A1D2E', accent: '#3F51B5', icon: '#7986CB' },
  { bg: '#1D2A15', accent: '#8BC34A', icon: '#AED581' },
];

// Topic Icons mapping
const TOPIC_ICONS = {
  science: ScienceIcon,
  math: CalculateIcon,
  psychology: PsychologyIcon,
  biology: BiotechIcon,
  education: SchoolIcon,
  default: PublicIcon,
};

function getIconForTopic(description) {
  if (!description) return PublicIcon;
  const lower = description.toLowerCase();
  if (
    lower.includes('science') ||
    lower.includes('physics') ||
    lower.includes('chemistry')
  )
    return ScienceIcon;
  if (lower.includes('math') || lower.includes('calcul')) return CalculateIcon;
  if (lower.includes('psych') || lower.includes('mind')) return PsychologyIcon;
  if (lower.includes('bio') || lower.includes('life')) return BiotechIcon;
  if (
    lower.includes('learn') ||
    lower.includes('educat') ||
    lower.includes('school')
  )
    return SchoolIcon;
  return PublicIcon;
}

function getColorIndex(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % TOPIC_COLORS.length;
}

// Topic Card Component
function TopicCard({ topic, onClick, onDelete, isActive, theme }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const isDark = theme.palette.mode === 'dark';
  const colorPalette = isDark ? TOPIC_COLORS_DARK : TOPIC_COLORS;
  const colorIndex = getColorIndex(topic.description);
  const colors = colorPalette[colorIndex];
  const IconComponent = getIconForTopic(topic.description);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        height: 64,
        borderRadius: '10px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: isActive
          ? alpha(colors.accent, 0.12)
          : theme.palette.background.paper,
        border: `1px solid ${
          isActive ? colors.accent : alpha(theme.palette.divider, 0.08)
        }`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateX(4px)',
          boxShadow: isDark
            ? `0 4px 20px ${alpha('#000', 0.4)}`
            : `0 4px 20px ${alpha('#000', 0.1)}`,
          borderColor: alpha(colors.accent, 0.4),
        },
      }}
    >
      {/* Left Icon Section */}
      <Box
        sx={{
          width: 56,
          minWidth: 56,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          bgcolor: colors.bg,
          borderRadius: '10px 0 0 10px',
        }}
      >
        <IconComponent sx={{ fontSize: 24, color: colors.icon }} />
        {/* Accent stripe */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            bgcolor: colors.accent,
            borderRadius: '10px 0 0 10px',
          }}
        />
      </Box>

      {/* Content Section */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 1.5,
          py: 1,
          minWidth: 0,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.85rem',
            color: isActive ? colors.accent : theme.palette.text.primary,
          }}
        >
          {topic.description || 'Untitled Topic'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
          <AccessTimeIcon
            sx={{ fontSize: 12, color: theme.palette.text.disabled }}
          />
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.disabled, fontSize: '0.7rem' }}
          >
            {formatDate(topic.createdAt)}
          </Typography>
        </Box>
      </Box>

      {/* Delete button on hover */}
      {isHovered && onDelete && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            pr: 1,
          }}
        >
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(topic.id);
              }}
              sx={{
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  color: theme.palette.error.main,
                },
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

function LearnAboutView({ chat }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // State
  const [topics, setTopics] = useState([]);
  const [curChat, setCurChat] = useState(chat);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);

  const aChat = useSelector((state) => state.chat.curChat);

  // Load topics (learn about chats) on mount
  useEffect(() => {
    async function loadTopics() {
      setLoading(true);
      try {
        const chats = await customStorage.jsonLearnAboutChats();
        setTopics(chats || []);
      } catch (error) {
        console.error('Failed to load topics:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTopics();
  }, []);

  useEffect(() => {
    if (!chat) return;
    setCurChat(chat);
  }, [chat]);

  useEffect(() => {
    if (!aChat) return;
    setCurChat(aChat);
    // Refresh topics list
    async function refreshTopics() {
      const chats = await customStorage.jsonLearnAboutChats();
      setTopics(chats || []);
    }
    refreshTopics();
  }, [aChat]);

  // Handlers
  const handleSearch = async (query) => {
    if (query.trim()) {
      const filtered = topics.filter(
        (t) =>
          t.description &&
          t.description.toLowerCase().includes(query.toLowerCase()),
      );
      setTopics(filtered);
    } else {
      const chats = await customStorage.jsonLearnAboutChats();
      setTopics(chats || []);
    }
  };

  const handleClearSearch = async () => {
    setSearchQuery('');
    const chats = await customStorage.jsonLearnAboutChats();
    setTopics(chats || []);
  };

  const handleTopicClick = (topic) => {
    setCurChat(topic);
    dispatch(learnAboutHandled(topic));
  };

  const handleDeleteTopic = async (id) => {
    await customStorage.deleteChatById(id);
    setTopics((prev) => prev.filter((t) => t.id !== id));
    if (curChat && curChat.id === id) {
      setCurChat(null);
    }
  };

  const handleNewTopic = () => {
    setCurChat(null);
    dispatch(learnAboutHandled(null));
  };

  // Filter topics
  const displayedTopics = useMemo(() => {
    let filtered = [...topics];
    if (quickFilter === 'recent') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter((t) => new Date(t.createdAt) >= weekAgo);
    }
    // Sort by most recent
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return filtered;
  }, [topics, quickFilter]);

  const recentCount = topics.filter((t) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(t.createdAt) >= weekAgo;
  }).length;

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
        position: 'relative',
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
                width: 36,
                height: 36,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }}
            >
              <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Learn About
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.disabled }}
              >
                AI-powered exploration
              </Typography>
            </Box>
            <Tooltip title="New Topic">
              <IconButton
                size="small"
                onClick={handleNewTopic}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                  },
                }}
              >
                <AddIcon
                  sx={{ fontSize: 18, color: theme.palette.primary.main }}
                />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Search */}
          <SearchContainer>
            <SearchIcon
              sx={{ color: theme.palette.text.disabled, mr: 1, fontSize: 20 }}
            />
            <InputBase
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              sx={{ flex: 1, fontSize: '0.875rem' }}
            />
            {searchQuery && (
              <IconButton
                size="small"
                onClick={handleClearSearch}
                sx={{ p: 0.25 }}
              >
                <ClearIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </SearchContainer>
        </SidebarSection>

        {/* Quick Filters */}
        <SidebarSection>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1,
            }}
          >
            Filter
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <QuickFilterChip
              label="All"
              size="small"
              selected={quickFilter === 'all'}
              onClick={() => setQuickFilter('all')}
            />
            <QuickFilterChip
              icon={<HistoryIcon sx={{ fontSize: '14px !important' }} />}
              label={`Recent (${recentCount})`}
              size="small"
              selected={quickFilter === 'recent'}
              onClick={() => setQuickFilter('recent')}
            />
          </Box>
        </SidebarSection>

        {/* Topics List */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1,
              px: 0.5,
            }}
          >
            Your Topics ({displayedTopics.length})
          </Typography>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {displayedTopics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onClick={() => handleTopicClick(topic)}
                onDelete={handleDeleteTopic}
                isActive={curChat && curChat.id === topic.id}
                theme={theme}
              />
            ))}
          </Box>

          {!loading && displayedTopics.length === 0 && (
            <Box
              sx={{
                textAlign: 'center',
                py: 4,
                color: theme.palette.text.disabled,
              }}
            >
              <CastForEducationIcon
                sx={{ fontSize: 40, opacity: 0.3, mb: 1 }}
              />
              <Typography variant="body2">No topics yet</Typography>
              <Typography variant="caption">
                Start exploring to create one
              </Typography>
            </Box>
          )}
        </Box>
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
          <ChevronRightIcon
            sx={{ fontSize: 16, transform: 'rotate(180deg)' }}
          />
        )}
      </IconButton>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
          height: '100%',
        }}
      >
        <LearnAboutDetailPanel chatId={curChat?.id || ''} />
      </Box>
    </Box>
  );
}

export default LearnAboutView;
