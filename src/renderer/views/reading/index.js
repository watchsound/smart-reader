/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { styled, alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  CircularProgress,
  Menu,
  MenuItem,
} from '@mui/material';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

// Icons
import HubIcon from '@mui/icons-material/Hub';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SchoolIcon from '@mui/icons-material/School';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ShareIcon from '@mui/icons-material/Share';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DownloadIcon from '@mui/icons-material/Download';

import join from '../../../commons/utils/content/joinUtil';

import EPubView from './EPubView';
import PDFView from './PDFView';
import BookNotesPanel from './BookNotesPanel';
import SearchResultPane from './SearchResultPane';
import customStorage from '../../store/customStorage';
import { getBookById } from '../../api/booksApi';
import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';
import CommunityPanel from './CommunityPanel';
import { currentBookHandled } from '../../store/reducers/readerSlice';
import InContextChatPanel from '../../components/chat/InContextChatPanel';
import ErrorBoundary from '../../ErrorBoundary';
import graphApi from '../../api/graphApi';
import ReadingHeader from './ReadingHeader';
import ReadingControls from './ReadingControls';
import useReadingEpisodes from './hooks/useReadingEpisodes';
import useMicroCardProposals from './hooks/useMicroCardProposals';
import useComprehensionCheck from './hooks/useComprehensionCheck';
import MicroCardChip from './MicroCardChip';
import PreReadingPanel from './PreReadingPanel';
import ComprehensionPanel from './ComprehensionPanel';
import bookDiagnosticApi from '../../api/bookDiagnosticApi';
import comprehensionApi from '../../api/comprehensionApi';
import rereadQueueApi from '../../api/rereadQueueApi';
import { recordEvent } from '../../api/brainApi';
import './Reading.css';

// ===== Main Container Styles =====
const ReadingViewContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  overflow: 'hidden',
}));

const ReadingContentWrapper = styled(Box)(() => ({
  flex: 1,
  display: 'flex',
  position: 'relative',
  overflow: 'hidden',
}));

const ReadingMainContent = styled(Box)(({ theme }) => ({
  flex: 1,
  position: 'relative',
  background:
    theme.palette.mode === 'dark'
      ? theme.palette.background.paper
      : `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
  overflow: 'hidden',
  borderRadius: '0 0 0 12px',
  margin: '0 0 8px 8px',
  boxShadow:
    theme.palette.mode === 'dark'
      ? 'inset 0 0 0 1px rgba(255,255,255,0.05)'
      : 'inset 0 0 0 1px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.04)',
}));

// Page edge effects for book-like appearance
const PageEdgeLeft = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  width: 20,
  background:
    theme.palette.mode === 'dark'
      ? 'linear-gradient(to right, rgba(0,0,0,0.15), transparent)'
      : 'linear-gradient(to right, rgba(0,0,0,0.04), transparent)',
  pointerEvents: 'none',
  zIndex: 2,
}));

const PageEdgeRight = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  right: 0,
  width: 20,
  background:
    theme.palette.mode === 'dark'
      ? 'linear-gradient(to left, rgba(0,0,0,0.15), transparent)'
      : 'linear-gradient(to left, rgba(0,0,0,0.04), transparent)',
  pointerEvents: 'none',
  zIndex: 2,
}));

// Sidebar styles matching BookmarksPage
const ReadingSidebar = styled(Box)(({ theme }) => ({
  width: 340,
  minWidth: 340,
  height: '100%',
  backgroundColor: theme.palette.background.paper,
  borderLeft: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s ease, width 0.3s ease',
}));

// Professional styled tabs matching bookmark view
const StyledTabs = styled(Tabs)(({ theme }) => ({
  minHeight: 44,
  backgroundColor: alpha(theme.palette.primary.main, 0.02),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
    backgroundColor: theme.palette.primary.main,
  },
  '& .MuiTabs-flexContainer': {
    gap: 4,
    paddingLeft: 8,
    paddingRight: 8,
  },
  '& .MuiTabs-scrollButtons': {
    width: 28,
    '&.Mui-disabled': {
      opacity: 0.3,
    },
  },
}));

// Knowledge Panel Styled Components
const KnowledgePanelContainer = styled(Box)(({ theme }) => ({
  height: 'calc(100vh - 110px)',
  display: 'flex',
  flexDirection: 'column',
  background:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.background.paper, 0.7)
      : theme.palette.background.paper,
  overflow: 'hidden',
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
}));

const ConceptItem = styled(ListItem)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius,
  margin: theme.spacing(0.5, 1),
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

const StyledTab = styled((props) => <Tab disableRipple {...props} />)(
  ({ theme }) => ({
    textTransform: 'none',
    minWidth: 'auto',
    minHeight: 36,
    padding: '6px 12px',
    marginTop: 4,
    fontSize: '0.8rem',
    fontWeight: 500,
    borderRadius: '8px 8px 0 0',
    color: theme.palette.text.secondary,
    transition: 'all 0.2s ease',
    '&:hover': {
      color: theme.palette.primary.main,
      backgroundColor: alpha(theme.palette.primary.main, 0.06),
    },
    '&.Mui-selected': {
      color: theme.palette.primary.main,
      fontWeight: 600,
      backgroundColor: theme.palette.background.paper,
      boxShadow: `0 -2px 8px ${alpha(theme.palette.primary.main, 0.1)}`,
    },
    '&.Mui-focusVisible': {
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
    },
    '& .MuiTab-iconWrapper': {
      marginRight: 4,
    },
  }),
);

function CustomTabPanel(props) {
  const { children, value, index, alwaysMount = false, ...other } = props;
  const isActive = value === index;

  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      style={{ display: isActive ? 'block' : 'none' }}
      {...other}
    >
      {/* Always mount if alwaysMount is true, otherwise only when active */}
      {(isActive || alwaysMount) && (
        <Box>
          <Typography component="div">{children}</Typography>
        </Box>
      )}
    </div>
  );
}

CustomTabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
  alwaysMount: PropTypes.bool,
};

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

// Knowledge Panel Component for Reading View
function BookKnowledgePanel({ bookId, bookTitle }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [relatedConceptsOpen, setRelatedConceptsOpen] = useState(true);
  const [learningPathOpen, setLearningPathOpen] = useState(true);
  const [weakConceptsOpen, setWeakConceptsOpen] = useState(false);

  const [relatedConcepts, setRelatedConcepts] = useState([]);
  const [learningPath, setLearningPath] = useState(null);
  const [weakConcepts, setWeakConcepts] = useState([]);
  const [bookStats, setBookStats] = useState({
    concepts: 0,
    mastered: 0,
    progress: 0,
  });

  // Race guard: loadKnowledgeData is invoked from both the auto-load
  // useEffect (when `bookId` changes) and from a manual reload button.
  // Three serial graph queries inside; without this guard a slow earlier
  // run can overwrite a faster later run's stats / concepts / path.
  const loadGenRef = useRef(0);
  const loadKnowledgeData = useCallback(async () => {
    const myGen = loadGenRef.current + 1;
    loadGenRef.current = myGen;
    const isStale = () => myGen !== loadGenRef.current;

    setLoading(true);
    try {
      // Load concepts related to this book
      const graphData = await graphApi.getKnowledgeGraphData({
        sourceKey: bookId,
      });
      if (isStale()) return;
      if (graphData?.nodes) {
        const bookConcepts = graphData.nodes.slice(0, 6);
        setRelatedConcepts(bookConcepts);

        // Calculate book-specific stats
        const mastered = bookConcepts.filter(
          (n) => (n.mastery || 0) >= 80,
        ).length;
        const totalMastery = bookConcepts.reduce(
          (sum, n) => sum + (n.mastery || 0),
          0,
        );
        const avgProgress =
          bookConcepts.length > 0
            ? Math.round(totalMastery / bookConcepts.length)
            : 0;
        setBookStats({
          concepts: bookConcepts.length,
          mastered,
          progress: avgProgress,
        });
      }

      // Load weak concepts for this book
      const weakData = await graphApi.getWeakConcepts(3);
      if (isStale()) return;
      if (weakData?.concepts) {
        setWeakConcepts(weakData.concepts.slice(0, 3));
      }

      // Load learning path
      const pathData = await graphApi.getLearningPath();
      if (isStale()) return;
      if (pathData?.path) {
        setLearningPath(pathData);
      }
    } catch (error) {
      if (isStale()) return;
      console.log('Knowledge data not available:', error.message);
    }
    if (!isStale()) {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (bookId) {
      loadKnowledgeData();
    }
  }, [bookId, loadKnowledgeData]);

  const handleOpenDashboard = () => {
    navigate('/knowledge');
  };

  return (
    <KnowledgePanelContainer>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.2)} 100%)`,
              }}
            >
              <MenuBookIcon
                sx={{ fontSize: 18, color: theme.palette.primary.main }}
              />
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, lineHeight: 1.2 }}
              >
                Book Knowledge
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.65rem' }}
              >
                {bookTitle
                  ? `${bookTitle.substring(0, 20)}...`
                  : 'Current Book'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  size="small"
                  onClick={loadKnowledgeData}
                  disabled={loading}
                >
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Full Dashboard">
              <IconButton size="small" onClick={handleOpenDashboard}>
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Book Stats */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            icon={<HubIcon sx={{ fontSize: '12px !important' }} />}
            label={`${bookStats.concepts} Concepts`}
            sx={{
              bgcolor: alpha(theme.palette.info.main, 0.1),
              color: theme.palette.info.main,
              fontSize: '0.65rem',
              height: 22,
              '& .MuiChip-icon': { color: theme.palette.info.main },
            }}
          />
          <Chip
            size="small"
            icon={<SchoolIcon sx={{ fontSize: '12px !important' }} />}
            label={`${bookStats.mastered} Mastered`}
            sx={{
              bgcolor: alpha(theme.palette.success.main, 0.1),
              color: theme.palette.success.main,
              fontSize: '0.65rem',
              height: 22,
              '& .MuiChip-icon': { color: theme.palette.success.main },
            }}
          />
          <Chip
            size="small"
            icon={<TrendingUpIcon sx={{ fontSize: '12px !important' }} />}
            label={`${bookStats.progress}% Progress`}
            sx={{
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              color: theme.palette.warning.main,
              fontSize: '0.65rem',
              height: 22,
              '& .MuiChip-icon': { color: theme.palette.warning.main },
            }}
          />
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ height: 2 }} />}

      {/* Scrollable Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Related Concepts */}
        <Box>
          <SectionHeader
            onClick={() => setRelatedConceptsOpen(!relatedConceptsOpen)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LightbulbIcon
                sx={{ fontSize: 16, color: theme.palette.warning.main }}
              />
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontSize: '0.8rem' }}
              >
                Book Concepts
              </Typography>
            </Box>
            {relatedConceptsOpen ? (
              <ExpandLessIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            )}
          </SectionHeader>
          <Collapse in={relatedConceptsOpen}>
            <List dense disablePadding sx={{ py: 0.5 }}>
              {relatedConcepts.length === 0 ? (
                <ListItem>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic', px: 1 }}
                  >
                    Take notes to discover concepts in this book.
                  </Typography>
                </ListItem>
              ) : (
                relatedConcepts.map((concept) => (
                  <ConceptItem key={concept.id} disablePadding>
                    <ListItemText
                      primary={concept.name}
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <MasteryBar
                            variant="determinate"
                            value={concept.mastery || 0}
                          />
                        </Box>
                      }
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: 500,
                        fontSize: '0.8rem',
                        noWrap: true,
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.text.secondary,
                        ml: 1,
                        fontSize: '0.7rem',
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

        <Divider sx={{ mx: 2, my: 0.5 }} />

        {/* Learning Path */}
        <Box>
          <SectionHeader onClick={() => setLearningPathOpen(!learningPathOpen)}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoGraphIcon
                sx={{ fontSize: 16, color: theme.palette.info.main }}
              />
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontSize: '0.8rem' }}
              >
                Learning Path
              </Typography>
            </Box>
            {learningPathOpen ? (
              <ExpandLessIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            )}
          </SectionHeader>
          <Collapse in={learningPathOpen}>
            {!learningPath ? (
              <Box sx={{ p: 2 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic' }}
                >
                  Complete more notes to generate a learning path.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ p: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    mb: 1,
                  }}
                >
                  <CircularProgress
                    variant="determinate"
                    value={
                      (learningPath.completedSteps / learningPath.totalSteps) *
                      100
                    }
                    size={28}
                    thickness={4}
                    sx={{ color: theme.palette.primary.main }}
                  />
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, fontSize: '0.8rem' }}
                    >
                      {learningPath.completedSteps}/{learningPath.totalSteps}{' '}
                      Steps
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.65rem' }}
                    >
                      ~{learningPath.estimatedMinutes} min remaining
                    </Typography>
                  </Box>
                </Box>
                {learningPath.nextConcept && (
                  <Chip
                    label={`Next: ${learningPath.nextConcept.name}`}
                    size="small"
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      fontWeight: 500,
                      fontSize: '0.65rem',
                      height: 22,
                    }}
                  />
                )}
              </Box>
            )}
          </Collapse>
        </Box>

        <Divider sx={{ mx: 2, my: 0.5 }} />

        {/* Weak Concepts */}
        <Box>
          <SectionHeader onClick={() => setWeakConceptsOpen(!weakConceptsOpen)}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningAmberIcon
                sx={{ fontSize: 16, color: theme.palette.error.main }}
              />
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontSize: '0.8rem' }}
              >
                Needs Review
              </Typography>
              {weakConcepts.length > 0 && (
                <Chip
                  label={weakConcepts.length}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.6rem',
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    color: theme.palette.error.main,
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              )}
            </Box>
            {weakConceptsOpen ? (
              <ExpandLessIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            )}
          </SectionHeader>
          <Collapse in={weakConceptsOpen}>
            <List dense disablePadding sx={{ py: 0.5 }}>
              {weakConcepts.length === 0 ? (
                <ListItem>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic', px: 1 }}
                  >
                    All concepts are well understood!
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
                        variant: 'body2',
                        fontWeight: 500,
                        fontSize: '0.8rem',
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
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 1.5,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          bgcolor: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <Box
          onClick={handleOpenDashboard}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            p: 1,
            borderRadius: 1,
            cursor: 'pointer',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            transition: 'all 0.2s ease',
            '&:hover': {
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.15)} 100%)`,
            },
          }}
        >
          <HubIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: theme.palette.primary.main }}
          >
            View Full Knowledge Graph
          </Typography>
        </Box>
      </Box>
    </KnowledgePanelContainer>
  );
}

export async function loader({ params }) {
  const book = await getBookById(params.id);
  if (!book) {
    throw new Response('', {
      status: 404,
      statusText: `Book Not Found FOR ${params.id}`,
    });
  }
  let note = null;
  if (params.noteId) {
    note = await customStorage.getNoteById(params.noteId);
  }
  return { book, note };
}

function EReaderPage() {
  const theme = useTheme();
  const navigate = useNavigate();

  // State
  const [tabValue, setTabValue] = React.useState(0);
  const [bookPath, setBookPath] = React.useState('');
  const [serverUrl, setServerUrl] = React.useState('');
  const [selectedText, setSelectedText] = React.useState('');
  const [chatPanelRef, setChatPanelRef] = React.useState(null);
  const [page, setPage] = React.useState({
    curPage: 0,
    totalPages: 0,
    curChapter: '',
    curChapterId: '',
  });
  const [isBookmarked, setIsBookmarked] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState(null);
  const [showControls] = React.useState(true);
  const [fontSize, setFontSize] = React.useState(100);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const { book, note } = useLoaderData();
  const dispatch = useDispatch();

  // Handle selection changes from child views
  const handleSelectionChange = useCallback((text) => {
    setSelectedText(text || '');
  }, []);

  // Handle mindmap results from PDF/EPUB views
  const handleMindMapResult = useCallback(
    (skillResult) => {
      if (chatPanelRef?.addSkillResult) {
        // Switch to AI Bot tab to show the result
        setTabValue(2);
        // Add the skill result to the chat panel
        chatPanelRef.addSkillResult({
          ...skillResult,
          title: 'Mind Map',
        });
      } else {
        console.warn('[MindMap] Chat panel ref not available');
      }
    },
    [chatPanelRef],
  );

  // Callback to receive the chat panel ref
  const handleChatPanelRef = useCallback((ref) => {
    setChatPanelRef(ref);
  }, []);

  // Phase 2: silent reading-behavior collection — feeds the Brain's
  // mastery model for pre-book diagnostic, micro-card, and tutor-mode tuning.
  const { trackPageChange } = useReadingEpisodes({
    bookId: book?.id,
    bookType: book?.format,
  });

  // Handle page changes from EPUB/PDF views
  const handlePageChange = useCallback(
    (pageInfo) => {
      setPage(pageInfo);
      trackPageChange(pageInfo);
    },
    [trackPageChange],
  );

  // Phase 4b: in-reading micro-card proposals (EPUB only for now).
  const {
    currentProposal,
    processText: processProposalText,
    acceptProposal,
    acknowledgeProposal,
    dismissProposal,
  } = useMicroCardProposals({
    bookId: book?.id,
    bookTitle: book?.title,
    enabled: book?.format === 'epub',
  });

  // Phase 5: pre-book diagnostic + primer. Shows once per book on first
  // open. EPUB-only for now (PDF/Word need their own TOC extractors).
  const [tocFromReader, setTocFromReader] = useState(null);
  const [diagPanelOpen, setDiagPanelOpen] = useState(false);
  const [diagPanelState, setDiagPanelState] = useState('offer'); // offer | loading | result | error
  const [diagnostic, setDiagnostic] = useState(null);
  const [diagErrorMessage, setDiagErrorMessage] = useState('');
  // Latch — never re-evaluate "should I open the panel?" within a single
  // session, even if React re-runs the effect with the same dependencies.
  const diagDecidedRef = React.useRef(false);

  const handleTocReady = useCallback((rawToc) => {
    setTocFromReader(rawToc || []);
  }, []);

  // React-Router can swap the book within the same EReaderPage instance
  // (e.g. user opens book A, dismisses panel, then navigates to book B).
  // Reset the latch + transient state so book B gets its own first-open
  // evaluation. The loader-fresh `book` object's firstOpenedAt is the
  // source of truth for whether the panel should show.
  useEffect(() => {
    diagDecidedRef.current = false;
    setTocFromReader(null);
    setDiagPanelOpen(false);
    setDiagnostic(null);
    setDiagErrorMessage('');
  }, [book?.id]);

  // First-open detection — runs once TOC has arrived. We don't gate on
  // book.firstOpenedAt from the loader alone because if a cached diagnostic
  // exists we still want to surface it (rare path: user dismissed before
  // result). The handler checks markOpened.wasFirstOpen as the source of
  // truth and skips the panel otherwise.
  useEffect(() => {
    if (diagDecidedRef.current) return;
    if (!book?.id) return;
    if (book.format !== 'epub') return;
    if (!tocFromReader) return; // wait for TOC
    diagDecidedRef.current = true;

    (async () => {
      const token = await customStorage.getToken();
      // If the book has already been opened before, skip the panel — but
      // still tolerate the race where TOC arrives before markOpened ran by
      // checking the live DB flag (firstOpenedAt) via a quick get.
      if (book.firstOpenedAt) return;
      // Pre-check the cache; if present, we'll just open straight to result.
      let cached = null;
      try {
        cached = await bookDiagnosticApi.get({ bookId: book.id, token });
      } catch (_) {
        /* ignore */
      }
      if (cached && !cached.error) {
        setDiagnostic(cached);
        setDiagPanelState('result');
      } else {
        setDiagPanelState('offer');
      }
      setDiagPanelOpen(true);
    })();
  }, [book, tocFromReader]);

  const handleDiagSkip = useCallback(async () => {
    setDiagPanelOpen(false);
    try {
      const token = await customStorage.getToken();
      await bookDiagnosticApi.markOpened({ bookId: book.id, token });
    } catch (err) {
      console.warn('[PreReadingPanel] markOpened failed:', err);
    }
  }, [book]);

  const handleDiagStartReading = useCallback(async () => {
    setDiagPanelOpen(false);
    try {
      const token = await customStorage.getToken();
      await bookDiagnosticApi.markOpened({ bookId: book.id, token });
    } catch (err) {
      console.warn('[PreReadingPanel] markOpened failed:', err);
    }
  }, [book]);

  const handleDiagRun = useCallback(async () => {
    setDiagPanelState('loading');
    setDiagErrorMessage('');
    try {
      const token = await customStorage.getToken();
      const result = await bookDiagnosticApi.run({
        bookId: book.id,
        token,
        toc: tocFromReader || [],
      });
      if (!result || result.error) {
        setDiagErrorMessage(result?.error || 'Unknown error.');
        setDiagPanelState('error');
      } else {
        setDiagnostic(result);
        setDiagPanelState('result');
      }
    } catch (err) {
      setDiagErrorMessage(err?.message || 'Diagnostic call failed.');
      setDiagPanelState('error');
    }
  }, [book, tocFromReader]);

  // Phase 6: chapter-end comprehension check (EPUB only for now).
  const {
    trackText: trackComprehensionText,
    pendingOffer: comprehensionOffer,
    dismissOffer: dismissComprehensionOffer,
  } = useComprehensionCheck({
    bookId: book?.id,
    enabled: book?.format === 'epub',
  });

  const [comprPanelOpen, setComprPanelOpen] = useState(false);
  const [comprPanelState, setComprPanelState] = useState('offer');
  const [comprQuestion, setComprQuestion] = useState('');
  const [comprGrading, setComprGrading] = useState(null);
  const [comprError, setComprError] = useState('');
  // snapshot of the offer that triggered the current panel session
  const comprOfferRef = React.useRef(null);

  // Open the panel whenever the hook signals a new pending offer
  useEffect(() => {
    if (comprehensionOffer && !comprPanelOpen) {
      comprOfferRef.current = comprehensionOffer;
      setComprPanelState('offer');
      setComprQuestion('');
      setComprGrading(null);
      setComprError('');
      setComprPanelOpen(true);
      recordEvent.comprehensionOffered({
        bookId: book?.id,
        chapterId: comprehensionOffer.chapterId,
        chapterName: comprehensionOffer.chapterName,
      });
    }
  }, [comprehensionOffer, comprPanelOpen, book?.id]);

  const handleComprCheck = useCallback(async () => {
    const offer = comprOfferRef.current;
    if (!offer) return;
    setComprPanelState('loading');
    try {
      const result = await comprehensionApi.generateQuestion({
        chapterTitle: offer.chapterName,
        textExcerpt: offer.textExcerpt,
        bookTitle: book?.name || book?.title || '',
      });
      if (result?.error || !result?.question) {
        setComprError(result?.error || 'Could not generate a question.');
        setComprPanelState('error');
      } else {
        setComprQuestion(result.question);
        setComprPanelState('question');
      }
    } catch (err) {
      setComprError(err?.message || 'Question generation failed.');
      setComprPanelState('error');
    }
  }, [book]);

  const handleComprSubmit = useCallback(
    async (answer) => {
      const offer = comprOfferRef.current;
      if (!offer || !answer) return;
      setComprPanelState('grading');
      try {
        // Phase 13 attribution: pass bookId so the service can pick a
        // representative learning_point from this book to attribute the
        // mastery_event to. Without bookId the service skips the
        // attribution write silently (comprehension cost would not appear
        // in the ROI panel).
        const result = await comprehensionApi.gradeAnswer({
          chapterTitle: offer.chapterName,
          textExcerpt: offer.textExcerpt,
          bookTitle: book?.name || book?.title || '',
          question: comprQuestion,
          answer,
          bookId: book?.id ?? null,
          // Synthetic questionId so the mastery_event dedup index treats each
          // chapter's comprehension as a distinct event. Same chapter graded
          // twice in one session would collide on (lp, ts, type, source_ref)
          // only if the user submits in the same millisecond — acceptable.
          questionId: offer.chapterId
            ? `book-${book?.id ?? 'x'}-chap-${offer.chapterId}`
            : null,
        });
        if (result?.error) {
          setComprError(result.error);
          setComprPanelState('error');
        } else {
          setComprGrading(result);
          setComprPanelState('result');
          recordEvent.comprehensionSubmitted({
            bookId: book?.id,
            chapterId: offer.chapterId,
            chapterName: offer.chapterName,
            score: result.score,
            gaps: result.gaps,
          });
        }
      } catch (err) {
        setComprError(err?.message || 'Grading failed.');
        setComprPanelState('error');
      }
    },
    [book, comprQuestion],
  );

  const handleComprSkip = useCallback(() => {
    const offer = comprOfferRef.current;
    recordEvent.comprehensionSkipped({
      bookId: book?.id,
      chapterId: offer?.chapterId,
      chapterName: offer?.chapterName,
      panelState: comprPanelState,
    });
    setComprPanelOpen(false);
    dismissComprehensionOffer();
  }, [book?.id, comprPanelState, dismissComprehensionOffer]);

  const handleComprDone = useCallback(() => {
    setComprPanelOpen(false);
    dismissComprehensionOffer();
  }, [dismissComprehensionOffer]);

  const handleComprScheduleReread = useCallback(
    async (grading) => {
      const offer = comprOfferRef.current;
      if (!offer) return;
      try {
        await rereadQueueApi.schedule({
          bookId: book?.id,
          bookTitle: book?.name || book?.title || '',
          chapterId: offer.chapterId,
          chapterName: offer.chapterName,
          gaps: grading?.gaps || [],
          score: grading?.score ?? 0,
        });
        recordEvent.rereadScheduled({
          bookId: book?.id,
          chapterId: offer.chapterId,
          chapterName: offer.chapterName,
          gaps: grading?.gaps,
          score: grading?.score,
        });
      } catch (_) {
        // best-effort; don't surface errors for a background scheduling action
      }
      setComprPanelOpen(false);
      dismissComprehensionOffer();
    },
    [book, dismissComprehensionOffer],
  );

  // Phase 4b: anchor accessor for MicroCardChip. EPubView calls
  // `handleParagraphAnchor` on every page-load with a fresh paragraph map +
  // iframe ref so the chip can position itself near the source paragraph.
  // We hold it in a ref (not state) — the chip re-reads it on each layout
  // pass and we don't want re-renders on every page turn.
  const paragraphAnchorRef = useRef(null);
  const handleParagraphAnchor = useCallback((accessor) => {
    paragraphAnchorRef.current = accessor;
  }, []);

  // EPubView emits page text on locationChanged. Pick the longest substantive
  // paragraph from the page and feed it to the proposer (single-flight inside
  // the hook drops overlapping calls).
  const handlePageText = useCallback(
    (text, context) => {
      if (!text) return;
      const paragraphs = text
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      if (paragraphs.length === 0) return;
      const longest = paragraphs.reduce(
        (a, b) => (a.length >= b.length ? a : b),
        '',
      );
      if (longest) {
        processProposalText(longest, context);
        trackComprehensionText(longest, context);
      }
    },
    [processProposalText, trackComprehensionText],
  );

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleBack = () => {
    navigate('/bookshelf');
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // TODO: Save bookmark to storage
  };

  const handleMenuOpen = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    async function t() {
      const url = await customStorage.getServerUrl();
      setServerUrl(url || '');
    }
    t();
  }, []);

  // const openai = useMemo(() => {
  //   return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  // }, [apiKey]);

  // useEffect(() => {
  //   async function t() {
  //     const id = await customStorage.getOpenAIKey();
  //     setApiKey(id);
  //     const m = await customStorage.getChatGPTModel();
  //      setModel(m);
  //   }
  //   t();
  // }, []);
  // const onCaptureComplete = (data) => {
  //   setUseCapture(false);
  // };

  // const bridgeScrollToCFI = (cfi) => {
  //   if (epubViewRef.current) {
  //     epubViewRef.current.scrollToCFI(cfi);
  //   }
  // };

  // const bridgeSearchText = (inputText, callback) => {
  //   console.log(`in bridge inputext = ${inputText}`);
  //   if (epubViewRef.current) {
  //     console.log(`in bridge inputext2 = ${inputText}`);
  //     epubViewRef.current.searchText(inputText, callback);
  //   }
  // };

  React.useEffect(() => {
    if (!book) return;
    async function cdr() {
      // const currentDirectory = await window.electron.ipcRenderer.dirname();
      // setCurdir(currentDirectory);
      // console.log(currentDirectory);
      // setBookPath(`file://${currentDirectory}/../assets/books/alice.epub`);
      let outPath = book.path;
      if (!outPath) {
        const dataPath = await customStorage.getItem('storageLocation');
        outPath = join(
          dataPath,
          `book`,
          `${book.keyInStorage || book.id}.${book.format}`,
        );
      }
      setBookPath(`file://${outPath}`);
      console.log(`file://${outPath}`);
      dispatch(currentBookHandled(book));
      // if (epubViewRef.current) {
      // epubViewRef.current.setBookPath(`file://${outPath}`, book);

      // epubViewRef.current.setBookPath(
      //  `file://${currentDirectory}/../assets/books/alicex.epub`,
      // );
      // }
    }
    cdr();
  }, [book]);

  const rightPanel = (
    <ReadingSidebar>
      {/* Sidebar Header with styled tabs */}
      <Box
        sx={{
          bgcolor: theme.palette.background.paper,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        <StyledTabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons
          allowScrollButtonsMobile
          aria-label="scrollable"
        >
          <StyledTab label="My Notes" {...a11yProps(0)} />
          <StyledTab label="Search" {...a11yProps(1)} />
          <StyledTab label="AI Bot" {...a11yProps(2)} />
          <StyledTab
            label="Knowledge"
            icon={<HubIcon sx={{ fontSize: 14, mr: 0.5 }} />}
            iconPosition="start"
            {...a11yProps(3)}
          />
          {serverUrl && <StyledTab label="Communities" {...a11yProps(4)} />}
        </StyledTabs>
      </Box>

      {/* Tab Panels */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <CustomTabPanel value={tabValue} index={0}>
          <BookNotesPanel sourceKey={book.id} width={340} />
        </CustomTabPanel>
        <CustomTabPanel value={tabValue} index={1}>
          <SearchResultPane />
        </CustomTabPanel>
        <CustomTabPanel value={tabValue} index={2} alwaysMount>
          <InContextChatPanel
            curBook={book}
            selectedText={selectedText}
            onRef={handleChatPanelRef}
          />
        </CustomTabPanel>
        <CustomTabPanel value={tabValue} index={3}>
          <BookKnowledgePanel bookId={book.id} bookTitle={book.title} />
        </CustomTabPanel>
        {serverUrl && (
          <CustomTabPanel value={tabValue} index={4}>
            <CommunityPanel idFromServer={book.idFromServer} />
          </CustomTabPanel>
        )}
      </Box>
    </ReadingSidebar>
  );

  const mainContent = (
    <ReadingMainContent>
      {/* Page edge effects */}
      <PageEdgeLeft />
      <PageEdgeRight />

      {/* Book content */}
      {book.format === 'epub' ? (
        <EPubView
          bookPath={bookPath}
          curBook={book}
          curCfi={note ? note.cfi : ''}
          onSelectionChange={handleSelectionChange}
          onPageChange={handlePageChange}
          onPageText={handlePageText}
          onParagraphAnchor={handleParagraphAnchor}
          onTocReady={handleTocReady}
          onMindMapResult={handleMindMapResult}
        />
      ) : (
        <ErrorBoundary fallback={<p>Something went wrong</p>}>
          <PDFView
            bookPath={bookPath}
            curBook={book}
            curNote={note}
            onSelectionChange={handleSelectionChange}
            onPageChange={handlePageChange}
            onMindMapResult={handleMindMapResult}
          />
        </ErrorBoundary>
      )}

      {/* Floating controls */}
      <ReadingControls
        page={page}
        visible={showControls}
        isFullscreen={isFullscreen}
        onFullscreen={handleFullscreen}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
      />

      {/* Phase 4b: in-reading micro-card proposal chip (EPUB only). */}
      <MicroCardChip
        proposal={currentProposal}
        anchorAccessor={paragraphAnchorRef}
        onAccept={acceptProposal}
        onAcknowledge={acknowledgeProposal}
        onDismiss={dismissProposal}
      />

      {/* Phase 5: pre-book diagnostic + primer (EPUB only, first-open only). */}
      <PreReadingPanel
        open={diagPanelOpen}
        state={diagPanelState}
        diagnostic={diagnostic}
        errorMessage={diagErrorMessage}
        bookTitle={book?.name || book?.title || ''}
        onRun={handleDiagRun}
        onSkip={handleDiagSkip}
        onStartReading={handleDiagStartReading}
      />

      {/* Phase 6: chapter-end comprehension check (EPUB only). */}
      <ComprehensionPanel
        open={comprPanelOpen}
        state={comprPanelState}
        chapterName={comprOfferRef.current?.chapterName || ''}
        question={comprQuestion}
        grading={comprGrading}
        errorMessage={comprError}
        onCheck={handleComprCheck}
        onSkip={handleComprSkip}
        onSubmit={handleComprSubmit}
        onDone={handleComprDone}
        onScheduleReread={handleComprScheduleReread}
      />
    </ReadingMainContent>
  );

  return (
    <ReadingViewContainer data-theme={theme.palette.mode}>
      {/* Header */}
      <ReadingHeader
        book={book}
        page={page}
        onBack={handleBack}
        onBookmark={handleBookmark}
        isBookmarked={isBookmarked}
        onMenuClick={handleMenuOpen}
      />

      {/* Main content area */}
      <ReadingContentWrapper>
        <RightCollapsibleLayout
          rightPanel={rightPanel}
          mainPanel={mainContent}
          rightPanelWidth="340"
        />
      </ReadingContentWrapper>

      {/* Options menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 180,
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 4px 24px rgba(0,0,0,0.4)'
                : '0 4px 24px rgba(0,0,0,0.12)',
          },
        }}
      >
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <InfoOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Book Info</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export Notes</ListItemText>
        </MenuItem>
      </Menu>
    </ReadingViewContainer>
  );
}
export default EReaderPage;
