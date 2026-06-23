/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import { styled, alpha, useTheme } from '@mui/material/styles';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Pagination,
  InputBase,
  IconButton,
  Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import ClearIcon from '@mui/icons-material/Clear';

import NoteUI from '../../components/note/NoteUI';
import {
  cfiChangeHandled,
  notesQueried,
} from '../../store/reducers/readerSlice';
import QuizModal from '../../components/surveyjs/QuizModal';
import { getBookNotes } from '../../api/booksApi';

// Professional styled components
const PanelContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: theme.palette.background.default,
}));

const SearchContainer = styled(Box)(({ theme }) => ({
  padding: '12px 16px',
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const SearchInputWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: alpha(theme.palette.action.hover, 0.5),
  borderRadius: 10,
  padding: '4px 12px',
  transition: 'all 0.2s ease',
  border: `1px solid transparent`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.action.hover, 0.8),
  },
  '&:focus-within': {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.primary.main}`,
    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
  },
}));

const StyledInput = styled(InputBase)(({ theme }) => ({
  flex: 1,
  fontSize: '0.85rem',
  '& input': {
    padding: '6px 0',
  },
  '& input::placeholder': {
    color: theme.palette.text.secondary,
    opacity: 0.7,
  },
}));

const StatsBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  backgroundColor: alpha(theme.palette.primary.main, 0.03),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
}));

const ScrollContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: '8px 12px',
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha(theme.palette.text.primary, 0.15),
    borderRadius: 3,
    '&:hover': {
      backgroundColor: alpha(theme.palette.text.primary, 0.25),
    },
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  textAlign: 'center',
}));

const PaginationContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  padding: '12px 16px',
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

function BookNotesPanel({ sourceKey, width }) {
  const theme = useTheme();
  const [notes, setNotes] = useState([]);
  const [fullNotes, setFullNotes] = useState([]);
  const [openQuizModal, setOpenQuizModal] = useState(false);
  const [quizProblems, setQuizProblems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [notesInPages, setNotesInPages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const bookNotes = useSelector((state) => state.reader.notes);
  const dispatch = useDispatch();

  useEffect(() => {
    setTotal(notes.length);
    const offset = (page - 1) * limit;
    setNotesInPages(notes.slice(offset, offset + limit));
  }, [page, limit, notes]);

  useEffect(() => {
    setFullNotes(bookNotes);
    setNotes(bookNotes);
  }, [bookNotes]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const doLocalFiltering = (query) => {
    setSearchQuery(query);
    if (!query) {
      setNotes(fullNotes);
      return;
    }
    const lowerQuery = query.toLowerCase();
    setNotes(
      fullNotes.filter((m) => {
        if (m.title && m.title.toLowerCase().includes(lowerQuery)) return true;
        if (m.cards?.[0]?.text?.toLowerCase().includes(lowerQuery)) return true;
        if (m.cards?.[1]?.text?.toLowerCase().includes(lowerQuery)) return true;
        if (m.cards?.[2]?.text?.toLowerCase().includes(lowerQuery)) return true;
        return false;
      }),
    );
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setNotes(fullNotes);
  };

  useEffect(() => {
    if (!sourceKey) return;
    async function loadNotes() {
      const v = await getBookNotes(sourceKey);
      dispatch(notesQueried(v));
      setFullNotes(v || []);
      setNotes(v || []);
    }
    loadNotes();
  }, [sourceKey, dispatch]);

  const selectHandler = (note) => {
    dispatch(cfiChangeHandled(note.cfi));
  };

  return (
    <PanelContainer>
      {/* Search Header */}
      <SearchContainer>
        <SearchInputWrapper>
          <SearchIcon
            sx={{
              fontSize: 18,
              color: theme.palette.text.secondary,
              mr: 1,
            }}
          />
          <StyledInput
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => doLocalFiltering(e.target.value)}
          />
          {searchQuery && (
            <IconButton size="small" onClick={handleClearSearch} sx={{ p: 0.5 }}>
              <ClearIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </SearchInputWrapper>
      </SearchContainer>

      {/* Stats Bar */}
      <StatsBar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NoteAltIcon
            sx={{ fontSize: 16, color: theme.palette.primary.main }}
          />
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: theme.palette.text.secondary }}
          >
            {total} note{total !== 1 ? 's' : ''}
          </Typography>
        </Box>
        {searchQuery && (
          <Chip
            label={`"${searchQuery}"`}
            size="small"
            onDelete={handleClearSearch}
            sx={{
              height: 22,
              fontSize: '0.7rem',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              '& .MuiChip-deleteIcon': {
                fontSize: 14,
                color: theme.palette.primary.main,
              },
            }}
          />
        )}
      </StatsBar>

      {/* Notes List */}
      <ScrollContainer>
        {notesInPages.length === 0 ? (
          <EmptyState>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <NoteAltIcon
                sx={{ fontSize: 28, color: theme.palette.primary.main }}
              />
            </Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: theme.palette.text.primary, mb: 0.5 }}
            >
              {searchQuery ? 'No matching notes' : 'No notes yet'}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              {searchQuery
                ? 'Try a different search term'
                : 'Highlight text to create notes'}
            </Typography>
          </EmptyState>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {notesInPages.map((note) => (
              <NoteUI
                key={note.id}
                selectedNoteKey={note.id}
                selectHandler={() => selectHandler(note)}
                showQuizHandler={(quizList) => {
                  setQuizProblems(quizList);
                  setOpenQuizModal(true);
                }}
                compactView
                compactMenu
                customAction={() => {}}
                customActionName=""
                cardWidth={width - 24}
                cardHeight="120"
                useMiniHeight
              />
            ))}
          </Box>
        )}
      </ScrollContainer>

      {/* Pagination */}
      {total > limit && (
        <PaginationContainer>
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            size="small"
            onChange={handlePageChange}
            color="primary"
            sx={{
              '& .MuiPaginationItem-root': {
                fontSize: '0.75rem',
                minWidth: 28,
                height: 28,
              },
            }}
          />
        </PaginationContainer>
      )}

      <QuizModal
        open={openQuizModal}
        quizProblems={quizProblems}
        callback={() => setOpenQuizModal(false)}
        sx={{ minWidth: '360px' }}
      />
    </PanelContainer>
  );
}

export default BookNotesPanel;
