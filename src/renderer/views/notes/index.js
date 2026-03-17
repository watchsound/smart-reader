/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Tab,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  LinearProgress,
  Collapse,
  CircularProgress,
  InputBase,
  Badge,
} from '@mui/material';
import TabList from '@mui/lab/TabList';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import { styled, useTheme, alpha } from '@mui/material/styles';

// Icons
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HubIcon from '@mui/icons-material/Hub';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SchoolIcon from '@mui/icons-material/School';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import StyleIcon from '@mui/icons-material/Style';
import StarIcon from '@mui/icons-material/Star';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LinkIcon from '@mui/icons-material/Link';
import ChatIcon from '@mui/icons-material/Chat';
import FolderIcon from '@mui/icons-material/Folder';
import AllInboxIcon from '@mui/icons-material/AllInbox';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

import { useNavigate } from 'react-router-dom';
import NotesUI from './NotesUI';
import NotesLeitnerUI from './NotesLeitnerUI';
import graphApi from '../../api/graphApi';

const MyTabPanel = styled(TabPanel)({
  padding: 0,
  margin: 0,
  height: '100%',
  overflow: 'auto',
});

// Sidebar width
const SIDEBAR_WIDTH = 280;

// Styled components matching Bookmarks view
const SidebarSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const SearchContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
  borderRadius: theme.shape.borderRadius,
  padding: '6px 12px',
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

const CategoryItem = styled(ListItemButton)(({ theme, selected }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: 2,
  padding: '8px 12px',
  transition: 'all 0.15s ease',
  backgroundColor: selected ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
  '&:hover': {
    backgroundColor: selected
      ? alpha(theme.palette.primary.main, 0.16)
      : alpha(theme.palette.primary.main, 0.08),
    transform: 'translateX(4px)',
  },
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

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1.5, 2),
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
}));

const ConceptItem = styled(ListItem)(({ theme }) => ({
  padding: theme.spacing(0.75, 2),
  borderRadius: theme.shape.borderRadius,
  margin: theme.spacing(0.25, 1),
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    transform: 'translateX(4px)',
  },
}));

const MasteryBar = styled(LinearProgress)(({ theme, value }) => {
  const getColor = (v) => {
    if (v >= 80) return theme.palette.success.main;
    if (v >= 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  };
  return {
    height: 6,
    borderRadius: 3,
    backgroundColor: alpha(theme.palette.text.primary, 0.08),
    '& .MuiLinearProgress-bar': {
      backgroundColor: getColor(value),
      borderRadius: 3,
    },
  };
});

// Category definitions
const CATEGORIES = [
  { id: 'all', label: 'All Notes', icon: AllInboxIcon, color: 'primary' },
  { id: 'note', label: 'General Notes', icon: StickyNote2Icon, color: 'warning' },
  { id: 'book', label: 'Book Notes', icon: MenuBookIcon, color: 'info' },
  { id: 'url', label: 'Web Notes', icon: LinkIcon, color: 'success' },
  { id: 'chat', label: 'Chat Notes', icon: ChatIcon, color: 'secondary' },
];

function NotePage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState('1');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Knowledge sidebar section states
  const [knowledgeOpen, setKnowledgeOpen] = useState(true);
  const [relatedConceptsOpen, setRelatedConceptsOpen] = useState(true);
  const [weakConceptsOpen, setWeakConceptsOpen] = useState(false);

  // Data states
  const [relatedConcepts, setRelatedConcepts] = useState([]);
  const [weakConcepts, setWeakConcepts] = useState([]);
  const [stats, setStats] = useState({ mastered: 0, inProgress: 0, weak: 0, total: 0 });

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const loadGraphData = async () => {
    setLoading(true);
    try {
      const graphData = await graphApi.getKnowledgeGraphData();
      if (graphData?.nodes) {
        const sorted = [...graphData.nodes]
          .sort((a, b) => (b.mastery || 0) - (a.mastery || 0))
          .slice(0, 5);
        setRelatedConcepts(sorted);

        const mastered = graphData.nodes.filter((n) => (n.mastery || 0) >= 80).length;
        const weak = graphData.nodes.filter((n) => (n.mastery || 0) < 40).length;
        const inProgress = graphData.nodes.length - mastered - weak;
        setStats({ mastered, inProgress, weak, total: graphData.nodes.length });
      }

      const weakData = await graphApi.getWeakConcepts(3);
      if (weakData?.concepts) {
        setWeakConcepts(weakData.concepts.slice(0, 3));
      }
    } catch (error) {
      console.log('Graph data not available:', error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadGraphData();
  }, []);

  const handleOpenKnowledgeDashboard = () => {
    navigate('/knowledge');
  };

  const renderSidebar = () => (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        height: '100%',
        bgcolor: theme.palette.background.paper,
        borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        display: 'flex',
        flexDirection: 'column',
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
              bgcolor: alpha(theme.palette.primary.main, 0.1),
            }}
          >
            <StickyNote2Icon sx={{ color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Notes
          </Typography>
        </Box>

        {/* Search */}
        <SearchContainer>
          <SearchIcon sx={{ color: theme.palette.text.disabled, mr: 1, fontSize: 18 }} />
          <InputBase
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flex: 1, fontSize: '0.85rem' }}
          />
          {searchQuery && (
            <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25 }}>
              <ClearIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </SearchContainer>
      </SidebarSection>

      {/* Quick Stats */}
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
          Quick Stats
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <QuickFilterChip
            icon={<SchoolIcon sx={{ fontSize: '14px !important' }} />}
            label={`${stats.mastered} Mastered`}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.success.main, 0.1),
              color: theme.palette.success.main,
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
              '& .MuiChip-icon': { color: theme.palette.success.main },
            }}
          />
          <QuickFilterChip
            icon={<TrendingUpIcon sx={{ fontSize: '14px !important' }} />}
            label={`${stats.inProgress} Learning`}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              color: theme.palette.warning.main,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
              '& .MuiChip-icon': { color: theme.palette.warning.main },
            }}
          />
          <QuickFilterChip
            icon={<WarningAmberIcon sx={{ fontSize: '14px !important' }} />}
            label={`${stats.weak} Weak`}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.error.main, 0.1),
              color: theme.palette.error.main,
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
              '& .MuiChip-icon': { color: theme.palette.error.main },
            }}
          />
        </Box>
      </SidebarSection>

      {/* Categories */}
      <Box sx={{ px: 1.5, py: 1.5 }}>
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
          Categories
        </Typography>
        <List dense disablePadding>
          {CATEGORIES.map((cat) => {
            const IconComp = cat.icon;
            return (
              <CategoryItem
                key={cat.id}
                selected={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <IconComp
                    sx={{
                      fontSize: 20,
                      color:
                        selectedCategory === cat.id
                          ? theme.palette.primary.main
                          : theme.palette.text.secondary,
                    }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={cat.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: selectedCategory === cat.id ? 600 : 500,
                    color:
                      selectedCategory === cat.id
                        ? theme.palette.primary.main
                        : theme.palette.text.primary,
                  }}
                />
              </CategoryItem>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ mx: 2 }} />

      {/* Knowledge Section (Collapsible) */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <SectionHeader onClick={() => setKnowledgeOpen(!knowledgeOpen)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HubIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Knowledge Graph
            </Typography>
          </Box>
          {knowledgeOpen ? (
            <ExpandLessIcon sx={{ fontSize: 18 }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 18 }} />
          )}
        </SectionHeader>

        <Collapse in={knowledgeOpen}>
          {loading && <LinearProgress sx={{ height: 2, mx: 2 }} />}

          {/* Top Concepts */}
          <Box>
            <SectionHeader
              onClick={() => setRelatedConceptsOpen(!relatedConceptsOpen)}
              sx={{ py: 1, pl: 3 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LightbulbIcon sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Top Concepts
                </Typography>
              </Box>
              {relatedConceptsOpen ? (
                <ExpandLessIcon sx={{ fontSize: 16 }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 16 }} />
              )}
            </SectionHeader>
            <Collapse in={relatedConceptsOpen}>
              <List dense disablePadding sx={{ pb: 1 }}>
                {relatedConcepts.length === 0 ? (
                  <ListItem>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontStyle: 'italic', px: 1 }}
                    >
                      No concepts found
                    </Typography>
                  </ListItem>
                ) : (
                  relatedConcepts.map((concept) => (
                    <ConceptItem key={concept.id} disablePadding>
                      <ListItemText
                        primary={concept.name}
                        secondary={
                          <MasteryBar
                            variant="determinate"
                            value={concept.mastery || 0}
                            sx={{ mt: 0.5 }}
                          />
                        }
                        primaryTypographyProps={{
                          variant: 'caption',
                          fontWeight: 500,
                          noWrap: true,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          color: theme.palette.text.secondary,
                          ml: 1,
                          fontSize: '0.65rem',
                        }}
                      >
                        {concept.mastery || 0}%
                      </Typography>
                    </ConceptItem>
                  ))
                )}
              </List>
            </Collapse>
          </Box>

          {/* Weak Concepts */}
          <Box>
            <SectionHeader
              onClick={() => setWeakConceptsOpen(!weakConceptsOpen)}
              sx={{ py: 1, pl: 3 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningAmberIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Needs Review
                </Typography>
              </Box>
              {weakConceptsOpen ? (
                <ExpandLessIcon sx={{ fontSize: 16 }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 16 }} />
              )}
            </SectionHeader>
            <Collapse in={weakConceptsOpen}>
              <List dense disablePadding sx={{ pb: 1 }}>
                {weakConcepts.length === 0 ? (
                  <ListItem>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontStyle: 'italic', px: 1 }}
                    >
                      Great job! No weak concepts.
                    </Typography>
                  </ListItem>
                ) : (
                  weakConcepts.map((concept) => (
                    <ConceptItem key={concept.id} disablePadding>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: theme.palette.error.main,
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={concept.name}
                        secondary={concept.reason}
                        primaryTypographyProps={{
                          variant: 'caption',
                          fontWeight: 500,
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption',
                          noWrap: true,
                          fontSize: '0.65rem',
                        }}
                      />
                    </ConceptItem>
                  ))
                )}
              </List>
            </Collapse>
          </Box>
        </Collapse>
      </Box>

      {/* Footer Action */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          bgcolor: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <Box
          onClick={handleOpenKnowledgeDashboard}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            p: 1.5,
            borderRadius: 1.5,
            cursor: 'pointer',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            transition: 'all 0.2s ease',
            '&:hover': {
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.15)} 100%)`,
              transform: 'translateY(-1px)',
            },
          }}
        >
          <HubIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: theme.palette.primary.main }}
          >
            View Full Knowledge Graph
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Toggle Sidebar Button */}
      <IconButton
        onClick={() => setSidebarOpen(!sidebarOpen)}
        sx={{
          position: 'absolute',
          left: sidebarOpen ? SIDEBAR_WIDTH - 12 : -12,
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
        {sidebarOpen ? (
          <ChevronLeftIcon sx={{ fontSize: 16 }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        )}
      </IconButton>

      {/* Left Sidebar */}
      <Box
        sx={{
          width: sidebarOpen ? SIDEBAR_WIDTH : 0,
          minWidth: sidebarOpen ? SIDEBAR_WIDTH : 0,
          transition: 'all 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {sidebarOpen && renderSidebar()}
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <TabContext value={tabValue}>
          <Box
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: theme.palette.background.paper,
              px: 2,
            }}
          >
            <TabList
              onChange={handleTabChange}
              sx={{
                minHeight: 48,
                '& .MuiTab-root': {
                  minHeight: 48,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                },
              }}
            >
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StickyNote2Icon sx={{ fontSize: 18 }} />
                    Notes
                  </Box>
                }
                value="1"
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StyleIcon sx={{ fontSize: 18 }} />
                    Leitner System
                  </Box>
                }
                value="2"
              />
            </TabList>
          </Box>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <MyTabPanel value="1">
              <NotesUI />
            </MyTabPanel>
            <MyTabPanel value="2">
              <NotesLeitnerUI />
            </MyTabPanel>
          </Box>
        </TabContext>
      </Box>
    </Box>
  );
}

export default NotePage;
