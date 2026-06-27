/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
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
import PlaceIcon from '@mui/icons-material/Place';
import ShareIcon from '@mui/icons-material/Share';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import ForumIcon from '@mui/icons-material/Forum';

import join from '../../../commons/utils/content/joinUtil';

import EPubView from './EPubView';
import PDFView from './PDFView';
import BookNotesPanel from './BookNotesPanel';
import SearchResultPane from './SearchResultPane';
import customStorage from '../../store/customStorage';
import { getBookById } from '../../api/booksApi';
import { bookApi } from '../../store/api/bookApiSlice';
import findTocMatch from '../../utils/findTocMatch';
import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';
import CommunityPanel from './CommunityPanel';
import ForumMarkerLayer from './ForumMarkerLayer';
import { buildAnchor, pickDiscussionForPage } from './forumAnchor';
import forumApi from '../../api/forumApi';
import {
  currentBookHandled,
  communityNoteSelected,
} from '../../store/reducers/readerSlice';
import InContextChatPanel from '../../components/chat/InContextChatPanel';
import ErrorBoundary from '../../ErrorBoundary';
import ReadingHeader from './ReadingHeader';
import ReadingControls from './ReadingControls';
import useReadingEpisodes from './hooks/useReadingEpisodes';
import useMicroCardProposals from './hooks/useMicroCardProposals';
import useComprehensionCheck from './hooks/useComprehensionCheck';
import MicroCardChip from './MicroCardChip';
import BookMapPanel from './BookMapPanel';
import ComprehensionPanel from './ComprehensionPanel';
import ChapterConceptsBanner from './ChapterConceptsBanner';
import OnThisPageIndicator from './OnThisPageIndicator';
import { getChapterConcepts, partitionByKnown } from './chapterConceptsLookup';
import { findConceptsInText } from '../../../commons/utils/conceptTextMatcher';
import { pickNewEncounters } from './encounterDedup';
import { mergeConceptsForBook, buildChapterPath } from './bookConceptsView';
import {
  getLearningPathEmptyText,
  getNeedsReviewEmptyText,
} from './knowledgePanelCopy';
import bookDiagnosticApi from '../../api/bookDiagnosticApi';
import conceptApi from '../../api/conceptApi';
import comprehensionApi from '../../api/comprehensionApi';
import rereadQueueApi from '../../api/rereadQueueApi';
import { recordEvent } from '../../api/brainApi';
import './Reading.css';

// ===== Main Container Styles =====
// Root.jsx renders us inside a Box already sized to 'calc(100vh - 64px)'
// (fixed AppBar + Toolbar spacer). Claiming '100vh' here would push the
// bottom — and the absolutely-positioned ReadingControls toolbar inside
// it — past the viewport. Fill the parent instead.
const ReadingViewContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
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

// Sidebar styles matching BookmarksPage. Width is now controlled by the
// surrounding RightCollapsibleLayout so the user can drag-resize it; let the
// sidebar fill whatever width the layout grants.
const ReadingSidebar = styled(Box)(({ theme }) => ({
  width: '100%',
  minWidth: 0,
  height: '100%',
  backgroundColor: theme.palette.background.paper,
  borderLeft: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s ease',
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

  // Propagate `height: 100%` + flex column down the wrapper chain so the
  // inner panels (BookNotesPanel et al.) — which use `flex:1 + overflowY:
  // auto` for their own scroll regions — have a definite parent height
  // to size against. Without this, the chain collapses to content height
  // and the inner scroll never activates.
  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      style={{
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
      {...other}
    >
      {/* Always mount if alwaysMount is true, otherwise only when active */}
      {(isActive || alwaysMount) && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
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
function BookKnowledgePanel({
  bookId,
  bookTitle,
  diagnostic,
  bookConcepts,
  currentChapterName,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [relatedConceptsOpen, setRelatedConceptsOpen] = useState(true);
  const [learningPathOpen, setLearningPathOpen] = useState(true);
  const [weakConceptsOpen, setWeakConceptsOpen] = useState(false);

  const [weakConcepts, setWeakConcepts] = useState([]);
  // Book Concepts + Learning Path are now derived from props (diagnostic +
  // bookConcepts), not from a separate graph fetch — Phase 5's data is the
  // authoritative "what concepts does this book contain" source.
  const mergedConcepts = useMemo(
    () => mergeConceptsForBook(diagnostic, bookConcepts),
    [diagnostic, bookConcepts],
  );
  const chapterPath = useMemo(
    () => buildChapterPath(diagnostic, bookConcepts, currentChapterName),
    [diagnostic, bookConcepts, currentChapterName],
  );
  const [bookStats, setBookStats] = useState({
    concepts: 0,
    mastered: 0,
    progress: 0,
    encountered: 0,
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
      // Weak-concepts feed for the "Needs Review" section. Book-scoped query
      // over the concept table — see ConceptManager.listWeakByBook. The rest
      // of the panel (Book Concepts + Learning Path) is derived from props.
      const token = await customStorage.getToken();
      const weakRows = await conceptApi.listWeakByBook({
        bookId,
        limit: 3,
        token,
      });
      if (isStale()) return;
      setWeakConcepts(Array.isArray(weakRows) ? weakRows : []);
    } catch (error) {
      if (isStale()) return;
      console.log('Knowledge data not available:', error.message);
    }
    if (!isStale()) {
      setLoading(false);
    }
  }, [bookId]);

  // Stats follow the merged concept view — single source of truth so the
  // header chips and the Book Concepts list can never disagree.
  useEffect(() => {
    const total = mergedConcepts.length;
    const mastered = mergedConcepts.filter(
      (c) => c.state === 'mastered',
    ).length;
    const encountered = mergedConcepts.filter(
      (c) => c.state === 'encountered' || c.state === 'mastered',
    ).length;
    const totalMastery = mergedConcepts.reduce(
      (sum, c) => sum + (c.mastery || 0),
      0,
    );
    const progress = total > 0 ? Math.round(totalMastery / total) : 0;
    setBookStats({ concepts: total, mastered, encountered, progress });
  }, [mergedConcepts]);

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
          <Chip
            size="small"
            icon={<PlaceIcon sx={{ fontSize: '12px !important' }} />}
            label={`${bookStats.encountered} Encountered`}
            sx={{
              bgcolor: alpha(theme.palette.secondary.main, 0.1),
              color: theme.palette.secondary.main,
              fontSize: '0.65rem',
              height: 22,
              '& .MuiChip-icon': { color: theme.palette.secondary.main },
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
              {mergedConcepts.length === 0 ? (
                <ListItem>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic', px: 1 }}
                  >
                    Open the Book Map tab to generate concept estimates.
                  </Typography>
                </ListItem>
              ) : (
                mergedConcepts.map((c) => {
                  const conceptStateColor = {
                    mastered: theme.palette.success.main,
                    encountered: theme.palette.secondary.main,
                    familiar: theme.palette.info.main,
                    new: theme.palette.grey[400],
                  };
                  const conceptStateLabel = {
                    mastered: `Mastered · ${Math.round(c.mastery)}%`,
                    encountered: `Encountered ${c.encounterCount}×`,
                    familiar: 'You already know this',
                    new: 'Not yet encountered',
                  };
                  return (
                    <ConceptItem key={c.name} disablePadding>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor:
                            conceptStateColor[c.state] ||
                            theme.palette.grey[400],
                          mr: 1,
                          flexShrink: 0,
                        }}
                      />
                      <ListItemText
                        primary={c.name}
                        secondary={conceptStateLabel[c.state] || ''}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: 500,
                          fontSize: '0.8rem',
                          noWrap: true,
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption',
                          fontSize: '0.65rem',
                        }}
                      />
                    </ConceptItem>
                  );
                })
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
            {chapterPath.chapters.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic' }}
                >
                  {getLearningPathEmptyText(bookStats.concepts)}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ p: 2 }}>
                {/* Aggregate progress strip */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    mb: 1.5,
                  }}
                >
                  <CircularProgress
                    variant="determinate"
                    value={
                      chapterPath.totalConcepts > 0
                        ? Math.round(
                            (chapterPath.totalEncountered /
                              chapterPath.totalConcepts) *
                              100,
                          )
                        : 0
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
                      {chapterPath.totalEncountered}/{chapterPath.totalConcepts}{' '}
                      encountered
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.65rem' }}
                    >
                      {chapterPath.totalMastered} mastered ·{' '}
                      {chapterPath.chapters.length} chapters
                    </Typography>
                  </Box>
                </Box>

                {/* Chapter-by-chapter path */}
                <List dense disablePadding sx={{ py: 0 }}>
                  {chapterPath.chapters.map((ch) => {
                    const bulletByStatus = {
                      past: theme.palette.success.main,
                      current: theme.palette.primary.main,
                      upcoming: theme.palette.grey[400],
                    };
                    const bullet =
                      bulletByStatus[ch.status] || theme.palette.grey[400];
                    return (
                      <ListItem
                        key={ch.title}
                        disablePadding
                        sx={{
                          py: 0.5,
                          opacity: ch.status === 'upcoming' ? 0.65 : 1,
                          bgcolor:
                            ch.status === 'current'
                              ? alpha(theme.palette.primary.main, 0.06)
                              : 'transparent',
                          borderRadius: 1,
                          px: 0.75,
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: bullet,
                            mr: 1,
                            flexShrink: 0,
                          }}
                        />
                        <ListItemText
                          primary={ch.title || '(untitled chapter)'}
                          secondary={
                            ch.total > 0
                              ? `${ch.encountered}/${ch.total} encountered${
                                  ch.mastered > 0
                                    ? ` · ${ch.mastered} mastered`
                                    : ''
                                }`
                              : 'no concepts estimated'
                          }
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontWeight: ch.status === 'current' ? 700 : 500,
                            fontSize: '0.75rem',
                            noWrap: true,
                          }}
                          secondaryTypographyProps={{
                            variant: 'caption',
                            fontSize: '0.65rem',
                          }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
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
                    {getNeedsReviewEmptyText(bookStats.concepts)}
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

  // Reading-controls plumbing: capture the active reader's control API so
  // the floating toolbar's prev/next/zoom controls can drive whichever
  // viewer is mounted. EPub surfaces an epub.js rendition; PDF surfaces a
  // small adapter object ({ prevPage, nextPage, zoomIn, zoomOut }).
  // Held in refs so font-size useEffect doesn't re-render on every change.
  const renditionRef = useRef(null);
  const pdfControlsRef = useRef(null);
  const handleRenditionReady = useCallback((rendition) => {
    renditionRef.current = rendition;
  }, []);
  const handlePdfControlsReady = useCallback((controls) => {
    pdfControlsRef.current = controls;
  }, []);
  const isPdf = book?.format === 'pdf';

  const handlePrevPage = useCallback(() => {
    if (isPdf) pdfControlsRef.current?.prevPage?.();
    else renditionRef.current?.prev?.();
  }, [isPdf]);
  const handleNextPage = useCallback(() => {
    if (isPdf) pdfControlsRef.current?.nextPage?.();
    else renditionRef.current?.next?.();
  }, [isPdf]);

  const handleZoomIn = useCallback(() => {
    if (isPdf) {
      pdfControlsRef.current?.zoomIn?.();
    } else {
      setFontSize((v) => Math.min(150, (v || 100) + 10));
    }
  }, [isPdf]);
  const handleZoomOut = useCallback(() => {
    if (isPdf) {
      pdfControlsRef.current?.zoomOut?.();
    } else {
      setFontSize((v) => Math.max(75, (v || 100) - 10));
    }
  }, [isPdf]);

  // Apply font size to the EPUB rendition. epub.js' themes.fontSize takes
  // any CSS length — '%' keeps proportional sizing in the reader's own theme.
  useEffect(() => {
    const r = renditionRef.current;
    if (!r?.themes?.fontSize) return;
    try {
      r.themes.fontSize(`${fontSize || 100}%`);
    } catch (_) {
      /* rendition may have been torn down between event + effect */
    }
  }, [fontSize]);

  const handleSearchClick = useCallback(() => {
    // Switch the right panel to the Search tab; the user types into the
    // search input there. Redux owns the actual search dispatch.
    setTabValue(1);
  }, []);

  // Handle selection changes from child views
  const handleSelectionChange = useCallback((text) => {
    setSelectedText(text || '');
  }, []);

  // Study Forum: track latest page text + chapter so the floating Discuss
  // button can build a Forum Anchor on click. Stored in refs (not state) —
  // re-rendering on every page turn would re-trigger reading-view effects.
  const lastPageTextRef = useRef('');
  const currentChapterRef = useRef({ id: null, name: null });
  const dispatchForum = useDispatch();
  // Stash the curPage at the moment a discussion is opened so handlePageChange
  // can clear the panel when the user navigates away from that page.
  const forumPageAtOpenRef = useRef(null);
  // Debounce the auto-show listByChapter call so rapid page-flipping doesn't
  // hammer the DB. We only fire after the user has settled on a page for
  // this long. Tunable: bump to 5000 for ultra-conservative, drop to 500 for
  // snappier. 1500ms is the "feels instant once you stop flipping" sweet spot.
  const FORUM_AUTOSHOW_DEBOUNCE_MS = 1500;
  const autoShowTimerRef = useRef(null);
  // Clear any pending auto-show timer when the reading view unmounts so it
  // doesn't fire against a stale dispatcher / book context.
  useEffect(
    () => () => {
      if (autoShowTimerRef.current) clearTimeout(autoShowTimerRef.current);
    },
    [],
  );
  const handleDiscussClick = useCallback(() => {
    if (!book?.id) return;
    const anchor = buildAnchor({
      bookId: book.id,
      chapterId: currentChapterRef.current?.id || null,
      cfiRange: null, // selection-cfi is not tracked at this layer in v1
      selectionText: selectedText && selectedText.trim() ? selectedText : null,
      passageText:
        selectedText && selectedText.trim()
          ? selectedText
          : lastPageTextRef.current,
    });
    const passageText =
      selectedText && selectedText.trim()
        ? selectedText
        : lastPageTextRef.current;
    if (!passageText) return;
    // Stash the page-at-open so handlePageChange knows when to auto-hide.
    forumPageAtOpenRef.current = page?.curPage ?? null;
    dispatchForum(
      communityNoteSelected({
        anchor,
        passageText,
        bookTitle: book.name || '',
        chapterTitle: currentChapterRef.current?.name || '',
      }),
    );
  }, [book, selectedText, dispatchForum, page]);

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

  // Chapter-start concepts banner state (declared above useReadingEpisodes so
  // its onChapterEnter closure can read the latest diagnostic via a ref).
  // `diagnostic` itself is set further down — the ref is synced render-time.
  const latestDiagnosticRef = useRef(null);
  const dismissedChaptersRef = useRef(new Set());
  const [chapterBanner, setChapterBanner] = useState(null);
  // Concepts (from Phase 5 diagnostic) detected in the text the user is
  // currently viewing. Recomputed on each onPageText callback.
  const [onPageConcepts, setOnPageConcepts] = useState([]);
  // Phase 5b — per-session dedup so passive encounters record once per
  // (book, chapter, concept) regardless of how many onPageText callbacks
  // fire for the same view.
  const seenEncountersRef = useRef(new Set());

  const handleChapterEnterForBanner = useCallback(
    ({ chapterId, chapterName }) => {
      if (!chapterId) return;
      if (dismissedChaptersRef.current.has(chapterId)) return;
      const { estimatedConcepts, knownToReader } = getChapterConcepts(
        latestDiagnosticRef.current,
        chapterName,
        chapterId,
      );
      if (estimatedConcepts.length === 0) {
        setChapterBanner(null);
        return;
      }
      const { fresh, familiar } = partitionByKnown({
        estimatedConcepts,
        knownToReader,
      });
      setChapterBanner({ chapterId, chapterName, fresh, familiar });
    },
    [],
  );

  const dismissChapterBanner = useCallback(() => {
    setChapterBanner((prev) => {
      if (prev?.chapterId) dismissedChaptersRef.current.add(prev.chapterId);
      return null;
    });
  }, []);

  // Phase 2: silent reading-behavior collection — feeds the Brain's
  // mastery model for pre-book diagnostic, micro-card, and tutor-mode tuning.
  const { trackPageChange } = useReadingEpisodes({
    bookId: book?.id,
    bookType: book?.format,
    onChapterEnter: handleChapterEnterForBanner,
  });

  // Handle page changes from EPUB/PDF views
  const handlePageChange = useCallback(
    (pageInfo) => {
      setPage(pageInfo);
      trackPageChange(pageInfo);
      // Hide an active Study Forum discussion when the user moves to a
      // different page. The discussion is anchored to a specific spot —
      // showing it on an unrelated page is misleading. Reopening on the
      // original page hits the DB cache (no new LLM cost).
      if (
        forumPageAtOpenRef.current != null &&
        pageInfo?.curPage != null &&
        pageInfo.curPage !== forumPageAtOpenRef.current
      ) {
        forumPageAtOpenRef.current = null;
        dispatchForum(communityNoteSelected(null));
      }
    },
    [trackPageChange, dispatchForum],
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

  // Phase 5: pre-book diagnostic now lives in a permanent sidebar panel
  // (BookMapPanel), not a modal. On first open of any book — EPUB or PDF —
  // we auto-run the diagnostic in the background and the panel reflects
  // whatever data is available (cached, generating, or empty).
  const [tocFromReader, setTocFromReader] = useState(null);
  const [diagnostic, setDiagnostic] = useState(null);
  // Render-time sync so the chapter-enter banner callback (declared earlier)
  // can read the latest diagnostic without a useEffect-cycle lag.
  latestDiagnosticRef.current = diagnostic;
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagErrorMessage, setDiagErrorMessage] = useState('');
  // Phase 6.5 — Concept rows extracted from chapter text (graph-side).
  // Hydrated on book mount + refreshed after each successful chapter
  // extraction so the Book Map panel can overlay confirmed/known status.
  const [bookConcepts, setBookConcepts] = useState([]);
  // Latch — never re-trigger the first-open auto-run more than once per
  // book mount, even if React re-runs the effect with the same deps.
  const diagAutoRanRef = React.useRef(false);

  const handleTocReady = useCallback((rawToc) => {
    setTocFromReader(rawToc || []);
  }, []);

  // Reset on book change. The loader-fresh `book` object is the source of
  // truth for whether this is the first open of THIS book in this session.
  useEffect(() => {
    diagAutoRanRef.current = false;
    setTocFromReader(null);
    setDiagnostic(null);
    setDiagLoading(false);
    setDiagErrorMessage('');
    setBookConcepts([]);
    setChapterBanner(null);
    dismissedChaptersRef.current = new Set();
    setOnPageConcepts([]);
    seenEncountersRef.current = new Set();
  }, [book?.id]);

  // Load extracted Concept rows for this book on mount. The Book Map
  // panel overlays these onto the Phase 5 diagnostic — concepts that
  // are confirmed in the graph get a green "✓" badge / mastered color.
  const reloadBookConcepts = useCallback(async () => {
    if (!book?.id) return;
    try {
      const token = await customStorage.getToken();
      const rows = await conceptApi.listByBook({ bookId: book.id, token });
      setBookConcepts(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.warn('[BookConcepts] list-by-book failed:', err?.message);
    }
  }, [book?.id]);

  useEffect(() => {
    reloadBookConcepts();
  }, [reloadBookConcepts]);

  // Load cached diagnostic on mount so the panel reflects existing data
  // immediately — independent of TOC arrival, which can be slow on big
  // PDFs. If no cached data and the book is on its first open, the
  // auto-run effect below will populate it.
  useEffect(() => {
    if (!book?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = await customStorage.getToken();
        const cached = await bookDiagnosticApi.get({ bookId: book.id, token });
        if (cancelled) return;
        if (cached && !cached.error) setDiagnostic(cached);
      } catch (_) {
        /* ignore — empty panel state is fine */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book?.id]);

  // Core generation routine — used by both the first-open auto-run and the
  // user-driven Generate / Regenerate buttons. `markOpened` is fired on
  // first open regardless so the auto-run only happens once.
  const runDiagnostic = useCallback(async () => {
    if (!book?.id) return;
    setDiagLoading(true);
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
      } else {
        setDiagnostic(result);
        // diagnostic_data was just written on the book row — invalidate
        // the RTK Query cache so the bookshelf readiness chip reflects
        // the new value next time the user navigates back. Without this,
        // the user generates a map here but the bookshelf card shows
        // no chip until a hard reload.
        dispatch(bookApi.util.invalidateTags(['Book']));
      }
    } catch (err) {
      setDiagErrorMessage(err?.message || 'Diagnostic call failed.');
    } finally {
      setDiagLoading(false);
    }
  }, [book, tocFromReader, dispatch]);

  // Auto-run on first open. Requires TOC because the diagnostic needs
  // chapter labels; for PDFs without an outline PDFView emits []. Empty TOC
  // means "no map possible for this book" — surface the empty state rather
  // than burning an AI call on no input.
  useEffect(() => {
    if (diagAutoRanRef.current) return;
    if (!book?.id) return;
    if (!tocFromReader) return; // wait for TOC (or empty array)
    diagAutoRanRef.current = true;

    (async () => {
      try {
        const token = await customStorage.getToken();
        // markOpened is idempotent — second call returns wasFirstOpen:false
        // so re-mounts don't re-trigger the auto-run.
        const opened = await bookDiagnosticApi.markOpened({
          bookId: book.id,
          token,
        });
        if (!opened?.wasFirstOpen) return;
        if (book.firstOpenedAt) return; // belt-and-suspenders
        if (!Array.isArray(tocFromReader) || tocFromReader.length === 0) return;
        // Skip if we already loaded a cached diagnostic from the earlier
        // effect — no point re-running an AI call when fresh data exists.
        if (diagnostic) return;
        await runDiagnostic();
      } catch (err) {
        console.warn('[BookMap] auto-run failed:', err?.message);
      }
    })();
  }, [book, tocFromReader, diagnostic, runDiagnostic]);

  const handleJumpToChapter = useCallback(
    (chapter) => {
      // Chapter-jump only works on EPUB today (we have CFI hrefs in the
      // toc); PDFView's destination resolution would need a separate
      // mapping. The chapter row stays interactive for EPUB only.
      if (!chapter || !renditionRef.current) return;
      if (book?.format !== 'epub') return;
      // The AI is asked to "echo the title" verbatim but real providers
      // drift on whitespace / smart quotes / case. `findTocMatch` widens
      // the lookup in three deterministic stages — exact → normalized →
      // contains — so cosmetic drift doesn't break the jump.
      const tocItem = findTocMatch(tocFromReader || [], chapter.title);
      if (tocItem?.href) {
        try {
          renditionRef.current.display(tocItem.href);
        } catch (_) {
          /* rendition torn down between click + display */
        }
      }
    },
    [book, tocFromReader],
  );

  // Phase 6.5 — fire concept extraction on the FINAL chapter the user
  // read (book close or book change). The comprehension hook only emits
  // pendingOffers on chapter CHANGE, which means the last chapter would
  // otherwise never extract. `onChapterFlushed` is the hook's unmount-
  // safe escape hatch.
  const handleChapterFlushed = useCallback(
    async (snapshot) => {
      if (!snapshot || !snapshot.bookId || !snapshot.textExcerpt) return;
      try {
        const token = await customStorage.getToken();
        const chapterEstimate =
          diagnostic && Array.isArray(diagnostic.chapters)
            ? diagnostic.chapters.find(
                (c) =>
                  c.title === snapshot.chapterName ||
                  c.title === snapshot.chapterId,
              )
            : null;
        await conceptApi.extractChapter({
          bookId: snapshot.bookId,
          bookTitle: book?.name || book?.title || '',
          chapterTitle: snapshot.chapterName,
          chapterId: snapshot.chapterId,
          estimatedConcepts: chapterEstimate?.estimatedConcepts || [],
          chapterText: snapshot.textExcerpt,
          token,
        });
        // Don't reloadBookConcepts here — the panel is unmounting or
        // about to swap books, so the refresh is wasted work. Next
        // mount picks up the new rows via the list-by-book effect.
      } catch (err) {
        console.warn('[ChapterConcepts] flush extract failed:', err?.message);
      }
    },
    [diagnostic, book?.name, book?.title],
  );

  // Phase 6: chapter-end comprehension check (EPUB only for now).
  const {
    trackText: trackComprehensionText,
    pendingOffer: comprehensionOffer,
    dismissOffer: dismissComprehensionOffer,
  } = useComprehensionCheck({
    bookId: book?.id,
    enabled: book?.format === 'epub',
    onChapterFlushed: handleChapterFlushed,
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

      // Phase 6.5 — fire concept extraction in the background using the
      // same accumulated text. Independent of whether the user accepts
      // the comprehension prompt, so the graph is fed either way. Pulls
      // Phase 5's estimatedConcepts for THIS chapter (if any) so the
      // extractor can do confirm/missed reconciliation.
      (async () => {
        try {
          const token = await customStorage.getToken();
          const chapterEstimate =
            diagnostic && Array.isArray(diagnostic.chapters)
              ? diagnostic.chapters.find(
                  (c) =>
                    c.title === comprehensionOffer.chapterName ||
                    c.title === comprehensionOffer.chapterId,
                )
              : null;
          const result = await conceptApi.extractChapter({
            bookId: book?.id,
            bookTitle: book?.name || book?.title || '',
            chapterTitle: comprehensionOffer.chapterName,
            chapterId: comprehensionOffer.chapterId,
            estimatedConcepts: chapterEstimate?.estimatedConcepts || [],
            chapterText: comprehensionOffer.textExcerpt,
            token,
          });
          if (
            result &&
            !result.error &&
            (result.confirmed?.length || result.surprises?.length)
          ) {
            // Reload so BookMapPanel reflects the new graph state.
            reloadBookConcepts();
          }
        } catch (err) {
          console.warn('[ChapterConcepts] extraction failed:', err?.message);
        }
      })();
    }
  }, [
    comprehensionOffer,
    comprPanelOpen,
    book?.id,
    book?.name,
    book?.title,
    diagnostic,
    reloadBookConcepts,
  ]);

  // Tree-view click affordance: user clicks a concept to mark it mastered.
  const handleConceptMasteryToggle = useCallback(
    async (conceptId, currentLevel) => {
      if (!conceptId) return;
      try {
        const token = await customStorage.getToken();
        // Toggle: if already at-or-above the "known" threshold, drop back
        // to the appeared baseline; otherwise jump to 100. Keeps the
        // affordance reversible without a separate "un-master" gesture.
        const targetLevel = (currentLevel || 0) >= 60 ? 5 : 100;
        await conceptApi.setMastery({ conceptId, level: targetLevel, token });
        reloadBookConcepts();
      } catch (err) {
        console.warn('[Concepts] set-mastery failed:', err?.message);
      }
    },
    [reloadBookConcepts],
  );

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
      // Capture latest page text + chapter for the Study Forum Discuss button.
      // EPubView.locationChanged emits `{ chapterId, chapterTitle }` — note
      // chapterTitle, not chapterName.
      lastPageTextRef.current = text.slice(0, 4000);
      if (context?.chapterId || context?.chapterTitle) {
        currentChapterRef.current = {
          id: context.chapterId || currentChapterRef.current.id,
          name: context.chapterTitle || currentChapterRef.current.name,
        };
      }

      // Study Forum auto-show: when the new page has a discussion matching it
      // (selection text appears in the page, or whole-page hash matches),
      // surface that discussion in the panel. Debounced so rapid page-flipping
      // doesn't hit the DB on every turn — only fires once the user settles
      // for FORUM_AUTOSHOW_DEBOUNCE_MS.
      const chapterIdNow = currentChapterRef.current?.id;
      if (book?.id && chapterIdNow) {
        if (autoShowTimerRef.current) {
          clearTimeout(autoShowTimerRef.current);
        }
        const bookIdSnapshot = book.id;
        const chapterIdSnapshot = chapterIdNow;
        const pageTextSnapshot = text;
        autoShowTimerRef.current = setTimeout(() => {
          autoShowTimerRef.current = null;
          // eslint-disable-next-line promise/catch-or-return
          forumApi
            .listByChapter({
              bookId: bookIdSnapshot,
              chapterId: chapterIdSnapshot,
            })
            .then((discussions) => {
              const matched = pickDiscussionForPage(
                discussions,
                pageTextSnapshot,
              );
              if (matched) {
                forumPageAtOpenRef.current = page?.curPage ?? null;
                dispatchForum(communityNoteSelected(matched));
              }
              return null;
            })
            .catch(() => {
              // ignore — auto-show is best-effort
            });
        }, FORUM_AUTOSHOW_DEBOUNCE_MS);
      }
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
      // Live "on this page" indicator — match the full page text (not just
      // the longest paragraph) against the current chapter's pre-extracted
      // concepts. Pure render-derived; no persistence.
      const { estimatedConcepts } = getChapterConcepts(
        latestDiagnosticRef.current,
        context?.curChapter,
        context?.curChapterId,
      );
      const matched = findConceptsInText(text, estimatedConcepts);
      setOnPageConcepts(matched);

      // Phase 5b — persist new encounters. Dedup per session so a sticky
      // page (multiple onPageText callbacks for the same view) records once.
      const bookId = book?.id;
      if (bookId && matched.length > 0) {
        const fresh = pickNewEncounters(
          seenEncountersRef.current,
          bookId,
          context?.curChapterId || '',
          matched,
        );
        if (fresh.length > 0) {
          (async () => {
            try {
              const token = await customStorage.getToken();
              await Promise.all(
                fresh.map((name) =>
                  conceptApi.recordEncounter({
                    bookId,
                    conceptName: name,
                    chapterTitle: context?.curChapter || '',
                    chapterId: context?.curChapterId || '',
                    token,
                  }),
                ),
              );
            } catch (err) {
              console.warn('[Encounter] record failed:', err?.message);
            }
          })();
        }
      }
    },
    [
      processProposalText,
      trackComprehensionText,
      book?.id,
      dispatchForum,
      page,
    ],
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
            label="Book Map"
            icon={<MenuBookIcon sx={{ fontSize: 14, mr: 0.5 }} />}
            iconPosition="start"
            {...a11yProps(3)}
          />
          <StyledTab
            label="Knowledge"
            icon={<HubIcon sx={{ fontSize: 14, mr: 0.5 }} />}
            iconPosition="start"
            {...a11yProps(4)}
          />
          {serverUrl && <StyledTab label="Communities" {...a11yProps(5)} />}
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
          <BookMapPanel
            bookTitle={book?.name || book?.title || ''}
            data={diagnostic}
            concepts={bookConcepts}
            loading={diagLoading}
            errorMessage={diagErrorMessage}
            canGenerate={
              Array.isArray(tocFromReader) && tocFromReader.length > 0
            }
            onGenerate={runDiagnostic}
            onRegenerate={runDiagnostic}
            onConceptClick={handleConceptMasteryToggle}
            // Only EPUB has CFI hrefs we can navigate to — pass the
            // callback only for EPUB so PDF chapter rows don't pretend
            // to be clickable (BookMapPanel uses the prop's presence as
            // the affordance gate).
            onJumpToChapter={
              book?.format === 'epub' ? handleJumpToChapter : undefined
            }
          />
        </CustomTabPanel>
        <CustomTabPanel value={tabValue} index={4}>
          <BookKnowledgePanel
            bookId={book.id}
            bookTitle={book.title}
            diagnostic={diagnostic}
            bookConcepts={bookConcepts}
            currentChapterName={page?.curChapter || ''}
          />
        </CustomTabPanel>
        {serverUrl && (
          <CustomTabPanel value={tabValue} index={5}>
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
          onRenditionReady={handleRenditionReady}
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
            onControlsReady={handlePdfControlsReady}
            onTocReady={handleTocReady}
          />
        </ErrorBoundary>
      )}

      {/* Chapter-start concept preview — surfaces Phase 5's estimatedConcepts
          for the chapter the reader just entered. One-shot per chapter per
          session via dismissedChaptersRef. */}
      {chapterBanner && (
        <ChapterConceptsBanner
          chapterName={chapterBanner.chapterName}
          fresh={chapterBanner.fresh}
          familiar={chapterBanner.familiar}
          onDismiss={dismissChapterBanner}
        />
      )}

      {/* Live "on this page" indicator — bottom-right floating chip group,
          shows the Phase 5 concepts found in the text currently in view. */}
      <OnThisPageIndicator concepts={onPageConcepts} />

      {/* Floating controls */}
      <ReadingControls
        page={page}
        visible={showControls}
        isFullscreen={isFullscreen}
        onFullscreen={handleFullscreen}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onSearch={handleSearchClick}
      />

      {/* Phase 4b: in-reading micro-card proposal chip (EPUB only). */}
      <MicroCardChip
        proposal={currentProposal}
        anchorAccessor={paragraphAnchorRef}
        onAccept={acceptProposal}
        onAcknowledge={acknowledgeProposal}
        onDismiss={dismissProposal}
      />

      {/* Phase 5 — the diagnostic now lives in the Book Map sidebar tab.
          See <BookMapPanel /> in the right panel above. The modal version
          (PreReadingPanel) was retired because it trapped the data behind
          a one-click latch. */}

      {/* Study Forum: in-book gutter markers for existing discussions
          in the current chapter, plus a floating Discuss action button. */}
      <ForumMarkerLayer
        bookId={book?.id}
        chapterId={currentChapterRef.current?.id || null}
      />
      <Tooltip title={selectedText ? 'Discuss selection' : 'Discuss this page'}>
        <IconButton
          onClick={handleDiscussClick}
          sx={{
            position: 'absolute',
            bottom: 80,
            right: 16,
            zIndex: 6,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          <ForumIcon fontSize="small" color="secondary" />
        </IconButton>
      </Tooltip>

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
          heightAdjust="128px"
          resizable
          minWidth={280}
          maxWidth={720}
          storageKey="reading.rightPanelWidth"
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
