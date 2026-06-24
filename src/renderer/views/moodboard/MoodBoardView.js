import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Pagination,
  Button,
  Stack,
  Paper,
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddIcon from '@mui/icons-material/Add';
import PushPinIcon from '@mui/icons-material/PushPin';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SortIcon from '@mui/icons-material/Sort';
import ClearIcon from '@mui/icons-material/Clear';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import CollectionsIcon from '@mui/icons-material/Collections';

import { createMoodBoard, getMoodBoardsByQuery } from '../../api/moodBoardApi';
import moodBoardOrganizerApi from '../../api/moodBoardOrganizerApi';
import { recordEvent } from '../../api/brainApi';
import {
  moodBoardAdded,
  moodBoardHandled,
  noteAdded,
  activeMoodBoardIdSet,
} from '../../store/reducers/moodBoardSlice';
import customStorage from '../../store/customStorage';

import MoodBoardCanvas from '../../components/MoodBoard/rf/MoodBoardCanvas';
import MoodBoardItemCard from './MoodBoardItemCard';
import NotesListPanelInMoodBoard from './NotesListPanelInMoodBoard';
import CreateNoteCell from '../notes/CreateNoteCell';

// Styled components matching Bookmark view
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

const CreateButton = styled(IconButton)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.2),
    transform: 'scale(1.05)',
  },
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontSize: '0.7rem',
  marginBottom: theme.spacing(1),
  paddingLeft: theme.spacing(0.5),
}));

function EmptyState({ icon: Icon, title, subtitle }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
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
        <Icon
          sx={{ fontSize: 40, color: theme.palette.primary.main, opacity: 0.7 }}
        />
      </Box>
      <Typography
        variant="h6"
        sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}
      >
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
        {subtitle}
      </Typography>
    </Box>
  );
}

function MoodBoardView({ moodBoard }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  // State
  const [curMoodBoard, setCurMoodBoard] = useState(moodBoard);
  const [moodBoards, setMoodBoards] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('boards'); // 'boards', 'notes', 'create'
  const [noteQueryStr, setNoteQueryStr] = useState('');
  // Phase 8 organize loop: cluster the brain wants us to organize, if any.
  const [organizeSuggestion, setOrganizeSuggestion] = useState(null);
  const [activeMoodBoardId, setActiveMoodBoardIdLocal] = useState(null);

  const aMoodBoard = useSelector((state) => state.moodBoard.curMoodBoard);

  // On mount: restore persisted active board; auto-create Default Board if none exist.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const initActiveBoard = async () => {
      const result = await getMoodBoardsByQuery('', 1, 100);
      let boards = result?.data || [];

      if (boards.length === 0) {
        const created = await createMoodBoard({
          name: 'Default Board', description: '',
          gridLayout: { layout: { lg: [] } }, diagram: {}, pinned: false,
        });
        if (created) {
          boards = [created];
          dispatch(moodBoardAdded(created));
          customStorage.setActiveMoodBoardId(created.id);
          setActiveMoodBoardIdLocal(created.id);
          dispatch(activeMoodBoardIdSet(created.id));
          setCurMoodBoard(created);
          dispatch(moodBoardHandled(created));
        }
        return;
      }

      const savedId = customStorage.getActiveMoodBoardId();
      const active = (savedId && boards.find((b) => String(b.id) === String(savedId))) || boards[0];
      if (active) {
        setActiveMoodBoardIdLocal(active.id);
        dispatch(activeMoodBoardIdSet(active.id));
        if (!curMoodBoard) {
          setCurMoodBoard(active);
          dispatch(moodBoardHandled(active));
        }
      }
    };
    initActiveBoard();
  }, []);

  // Load mood boards
  useEffect(() => {
    loadMoodBoards();
  }, [searchQuery, page]);

  useEffect(() => {
    if (!moodBoard) return;
    setCurMoodBoard(moodBoard);
  }, [moodBoard]);

  useEffect(() => {
    if (!aMoodBoard) return;
    setCurMoodBoard(aMoodBoard);
  }, [aMoodBoard]);

  // `loadMoodBoards` fires both from the useEffect (searchQuery/page deps)
  // and from create/delete handlers; both paths can overlap. Without a
  // race guard the slower response wins and stale boards appear.
  const loadGenRef = useRef(0);
  const loadMoodBoards = async () => {
    const myGen = loadGenRef.current + 1;
    loadGenRef.current = myGen;
    const result = await getMoodBoardsByQuery(searchQuery, page, 10);
    if (myGen !== loadGenRef.current) return;
    setMoodBoards(result.data || []);
    setTotal(result.total);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
  };

  const handleCreateMoodBoard = async () => {
    const baseName = 'New Mood Board';
    const existingNames = new Set(moodBoards.map((b) => b.name));
    let name = baseName;
    let counter = 2;
    while (existingNames.has(name)) {
      name = `${baseName} ${counter}`;
      counter += 1;
    }
    const newBoard = {
      name,
      description: '',
      gridLayout: { layout: { lg: [] } },
      diagram: {},
      pinned: false,
    };
    const created = await createMoodBoard(newBoard);
    dispatch(moodBoardAdded(created));
    setCurMoodBoard(created);
    dispatch(moodBoardHandled(created));
    loadMoodBoards();
  };

  // Read `?organize=<bookId:domainType>` (set by the brain heartbeat's
  // notification actionUrl) and load the cluster details so we can show
  // an organize banner. Re-runs whenever the search string changes so a
  // freshly-clicked notification overrides any stale state.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dedupKey = params.get('organize');
    if (!dedupKey) {
      setOrganizeSuggestion(null);
      return undefined;
    }
    let cancelled = false;
    moodBoardOrganizerApi
      .getSuggestion(dedupKey)
      .then((res) => {
        if (cancelled) return undefined;
        setOrganizeSuggestion(res?.suggestion || null);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setOrganizeSuggestion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  const clearOrganizeParam = useCallback(() => {
    const params = new URLSearchParams(location.search);
    params.delete('organize');
    const next = params.toString();
    navigate(
      { pathname: location.pathname, search: next ? `?${next}` : '' },
      { replace: true },
    );
  }, [location.search, location.pathname, navigate]);

  const handleAcceptSuggestion = useCallback(async () => {
    if (!organizeSuggestion) return;
    const { bookTitle, domainType, conceptTitles, bookId } = organizeSuggestion;
    try {
      // Phase 8 Slice 3: server creates the board + one note per learning
      // point + clears the dedup record in a single SQLite transaction so
      // we never end up with an empty board on success.
      const res = await moodBoardOrganizerApi.createBoardFromCluster(
        bookId,
        domainType,
      );
      if (!res || res.error || !res.board) {
        // eslint-disable-next-line no-console
        console.error(
          '[MoodBoardView] createBoardFromCluster failed:',
          res?.error,
        );
        return;
      }
      const created = res.board;
      dispatch(moodBoardAdded(created));
      setCurMoodBoard(created);
      dispatch(moodBoardHandled(created));
      // Pair with ORGANIZE_SUGGESTED from the brain heartbeat so
      // analytics can compute suggest → accept conversion AND the
      // population success rate (noteCount per cluster).
      recordEvent.organizeAccepted({
        dedupKey: `${bookId}:${domainType}`,
        bookId,
        bookTitle,
        domainType,
        pointCount: conceptTitles.length,
        newBoardId: created?.id,
        noteCount: Array.isArray(res.noteIds) ? res.noteIds.length : 0,
      });
      loadMoodBoards();
    } finally {
      setOrganizeSuggestion(null);
      clearOrganizeParam();
    }
  }, [organizeSuggestion, dispatch, clearOrganizeParam]);

  const handleDismissSuggestion = useCallback(async () => {
    if (!organizeSuggestion) return;
    const { bookId, domainType, bookTitle, pointCount } = organizeSuggestion;
    try {
      await moodBoardOrganizerApi.clearSuggestion(bookId, domainType);
      recordEvent.organizeDismissed({
        dedupKey: `${bookId}:${domainType}`,
        bookId,
        bookTitle,
        domainType,
        pointCount,
      });
    } finally {
      setOrganizeSuggestion(null);
      clearOrganizeParam();
    }
  }, [organizeSuggestion, clearOrganizeParam]);

  const handleSelectMoodBoard = (board) => {
    setCurMoodBoard(board);
    dispatch(moodBoardHandled(board));
  };

  const handleSetActiveMoodBoard = (board) => {
    setActiveMoodBoardIdLocal(board.id);
    dispatch(activeMoodBoardIdSet(board.id));
    customStorage.setActiveMoodBoardId(board.id);
  };

  const noteSelected = (note) => {
    dispatch(noteAdded(null));
    dispatch(noteAdded(note));
  };

  // Filter and sort mood boards
  const displayedBoards = useMemo(() => {
    let filtered = [...moodBoards];

    if (quickFilter === 'pinned') {
      filtered = filtered.filter((b) => b.pinned);
    }

    if (sortBy === 'recent') {
      filtered.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
    } else if (sortBy === 'oldest') {
      filtered.sort(
        (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      );
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return filtered;
  }, [moodBoards, quickFilter, sortBy]);

  const pinnedCount = moodBoards.filter((b) => b.pinned).length;

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          width: sidebarCollapsed ? 0 : 300,
          minWidth: sidebarCollapsed ? 0 : 300,
          height: '100vh',
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.secondary.main, 0.1),
                }}
              >
                <DashboardIcon sx={{ color: theme.palette.secondary.main }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Mood Boards
              </Typography>
            </Box>
            <Tooltip title="Create new mood board">
              <CreateButton onClick={handleCreateMoodBoard}>
                <AddIcon sx={{ fontSize: 20 }} />
              </CreateButton>
            </Tooltip>
          </Box>

          {/* Search */}
          <SearchContainer>
            <SearchIcon
              sx={{ color: theme.palette.text.disabled, mr: 1, fontSize: 20 }}
            />
            <InputBase
              placeholder="Search boards..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
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

        {/* Tab Navigation */}
        <SidebarSection sx={{ py: 1 }}>
          <ToggleButtonGroup
            value={activeTab}
            exclusive
            onChange={(e, value) => value && setActiveTab(value)}
            size="small"
            sx={{
              width: '100%',
              '& .MuiToggleButton-root': {
                flex: 1,
                border: 'none',
                borderRadius: 1,
                py: 0.75,
                fontSize: '0.75rem',
                fontWeight: 500,
                textTransform: 'none',
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                  },
                },
              },
            }}
          >
            <ToggleButton value="boards">
              <CollectionsIcon sx={{ fontSize: 16, mr: 0.5 }} />
              Boards
            </ToggleButton>
            <ToggleButton value="notes">
              <NoteAddIcon sx={{ fontSize: 16, mr: 0.5 }} />
              Notes
            </ToggleButton>
          </ToggleButtonGroup>
        </SidebarSection>

        {/* Content based on active tab */}
        {activeTab === 'boards' && (
          <>
            {/* Quick Filters */}
            <SidebarSection>
              <SectionLabel>Quick Filters</SectionLabel>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                <QuickFilterChip
                  label="All"
                  size="small"
                  selected={quickFilter === 'all'}
                  onClick={() => setQuickFilter('all')}
                />
                <QuickFilterChip
                  icon={<PushPinIcon sx={{ fontSize: '14px !important' }} />}
                  label={`Pinned (${pinnedCount})`}
                  size="small"
                  selected={quickFilter === 'pinned'}
                  onClick={() => setQuickFilter('pinned')}
                />
              </Box>
            </SidebarSection>

            {/* Mood Boards List */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <SectionLabel sx={{ mb: 0 }}>Your Boards</SectionLabel>
                <Tooltip title="Sort by">
                  <Box
                    component="select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    sx={{
                      appearance: 'none',
                      bgcolor: 'transparent',
                      border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                      borderRadius: 0.5,
                      px: 1,
                      py: 0.25,
                      pr: 2.5,
                      fontSize: '0.7rem',
                      color: theme.palette.text.secondary,
                      cursor: 'pointer',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 4px center',
                      '&:focus': {
                        outline: 'none',
                        borderColor: theme.palette.primary.main,
                      },
                    }}
                  >
                    <option value="recent">Recent</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">By Name</option>
                  </Box>
                </Tooltip>
              </Box>

              {displayedBoards.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                  <DashboardIcon
                    sx={{
                      fontSize: 40,
                      color: alpha(theme.palette.text.secondary, 0.3),
                      mb: 1,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? 'No boards found' : 'No mood boards yet'}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Click + to create one
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {displayedBoards.map((board) => (
                    <MoodBoardItemCard
                      key={board.id}
                      moodBoard={board}
                      isActive={curMoodBoard && curMoodBoard.id === board.id}
                      isActivePinned={String(activeMoodBoardId) === String(board.id)}
                      onSelect={handleSelectMoodBoard}
                      onSetActive={handleSetActiveMoodBoard}
                      onUpdate={loadMoodBoards}
                    />
                  ))}
                </Box>
              )}

              {total > 10 && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mt: 2,
                    mb: 1,
                  }}
                >
                  <Pagination
                    count={Math.ceil(total / 10)}
                    page={page}
                    size="small"
                    onChange={(e, value) => setPage(value)}
                    sx={{
                      '& .MuiPaginationItem-root': {
                        fontSize: '0.75rem',
                      },
                    }}
                  />
                </Box>
              )}
            </Box>
          </>
        )}

        {activeTab === 'notes' && (
          <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1 }}>
            <SectionLabel>Drag notes to board</SectionLabel>
            <SearchContainer sx={{ mb: 1.5 }}>
              <SearchIcon
                sx={{ color: theme.palette.text.disabled, mr: 1, fontSize: 18 }}
              />
              <InputBase
                placeholder="Search notes..."
                value={noteQueryStr}
                onChange={(e) => setNoteQueryStr(e.target.value)}
                sx={{ flex: 1, fontSize: '0.8rem' }}
              />
            </SearchContainer>
            <NotesListPanelInMoodBoard
              query={noteQueryStr}
              noteSelectionHandler={(note) => noteSelected(note)}
            />
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
        <ChevronRightIcon
          sx={{
            fontSize: 16,
            transform: sidebarCollapsed ? 'none' : 'rotate(180deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </IconButton>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {organizeSuggestion && (
          <Paper
            elevation={0}
            sx={{
              m: 2,
              p: 2,
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              background: alpha(theme.palette.primary.main, 0.06),
            }}
          >
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Organize {organizeSuggestion.pointCount} new{' '}
                {organizeSuggestion.domainType} concepts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                From &ldquo;{organizeSuggestion.bookTitle}&rdquo;. The Brain
                noticed you&apos;ve accumulated several concepts here — a
                MoodBoard can help them stick.
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                {organizeSuggestion.conceptTitles.slice(0, 12).map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    size="small"
                    sx={{ fontSize: 11, height: 22 }}
                  />
                ))}
                {organizeSuggestion.conceptTitles.length > 12 && (
                  <Chip
                    label={`+${organizeSuggestion.conceptTitles.length - 12} more`}
                    size="small"
                    sx={{ fontSize: 11, height: 22 }}
                  />
                )}
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                justifyContent="flex-end"
                sx={{ mt: 1 }}
              >
                <Button size="small" onClick={handleDismissSuggestion}>
                  Not now
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleAcceptSuggestion}
                >
                  Create board with these concepts
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}
        {curMoodBoard ? (
          <MoodBoardCanvas curMoodBoard={curMoodBoard} />
        ) : (
          <EmptyState
            icon={DashboardIcon}
            title="No board selected"
            subtitle="Select a mood board from the sidebar or create a new one to get started"
          />
        )}
      </Box>
    </Box>
  );
}

export default MoodBoardView;
