/* eslint-disable react/prop-types */
/* eslint-disable no-nested-ternary */
import { useState, useEffect } from 'react';
import { styled, alpha, useTheme } from '@mui/material/styles';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  InputBase,
  IconButton,
  Chip,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import ArticleIcon from '@mui/icons-material/Article';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';

import {
  searchTextInBookHandled,
  cfiChangeHandled,
  pdfHighlightChangeHandled,
} from '../../store/reducers/readerSlice';
import { truncateString } from '../../../commons/utils/commonUtil';
import customStorage from '../../store/customStorage';

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
  border: '1px solid transparent',
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
  backgroundColor: alpha(theme.palette.info.main, 0.03),
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

const EmptyState = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  textAlign: 'center',
}));

const ResultCard = styled(Paper)(({ theme }) => ({
  padding: '12px 14px',
  marginBottom: 8,
  borderRadius: 10,
  cursor: 'pointer',
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  backgroundColor: theme.palette.background.paper,
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateX(4px)',
    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.12)}`,
    borderColor: alpha(theme.palette.primary.main, 0.3),
    '& .result-icon': {
      color: theme.palette.primary.main,
    },
  },
}));

function SearchResultPane() {
  const theme = useTheme();
  const [searchResult, setSearchResult] = useState([]);
  const [isPDF, setPDF] = useState(false);
  const [book, setBook] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const dispatch = useDispatch();
  const searchTextInBookResult = useSelector(
    (state) => state.reader.searchTextInBookResult,
  );
  const currentBook = useSelector((state) => state.reader.currentBook);

  useEffect(() => {
    if (!currentBook) return;
    setBook(currentBook);
    setPDF(currentBook.format === 'pdf');
  }, [currentBook]);

  useEffect(() => {
    setSearchResult(searchTextInBookResult);
    setIsSearching(false);
  }, [searchTextInBookResult]);

  const search = async (inputText) => {
    if (!inputText || !inputText.trim()) {
      setSearchResult([]);
      return;
    }
    setIsSearching(true);
    setSearchResult([]);
    if (inputText.trim().indexOf(' ') > 0) {
      const r = await customStorage.getBookContentByQuery({
        bookKey: book.id,
        bookType: book.format,
        query: inputText,
      });
      setSearchResult(r || []);
      setIsSearching(false);
    } else {
      dispatch(searchTextInBookHandled(inputText));
    }
  };

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter') {
      search(searchQuery);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResult([]);
  };

  const selectEPubHandler = (cfi) => {
    if (!cfi) return;
    const pos = cfi.indexOf('|');
    if (pos < 0) {
      dispatch(cfiChangeHandled(cfi));
    } else {
      const cfis = cfi.split('|');
      const oneCfi = cfis[cfis.length - 1];
      dispatch(cfiChangeHandled(oneCfi));
    }
  };

  const selectPDFHandler = (highlight) => {
    dispatch(pdfHighlightChangeHandled(highlight));
  };

  const getResultText = (match) => {
    if (isPDF) {
      return match.data
        ? match.data.content?.text || ''
        : match.content?.text || '';
    }
    return match.data?.excerpt || '';
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
            placeholder="Search in book..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchSubmit}
          />
          {searchQuery ? (
            <IconButton size="small" onClick={handleClearSearch} sx={{ p: 0.5 }}>
              <ClearIcon sx={{ fontSize: 16 }} />
            </IconButton>
          ) : (
            <KeyboardReturnIcon
              sx={{ fontSize: 14, color: theme.palette.text.disabled, ml: 0.5 }}
            />
          )}
        </SearchInputWrapper>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1,
            color: theme.palette.text.secondary,
            fontSize: '0.7rem',
          }}
        >
          Press Enter to search • Use spaces for semantic search
        </Typography>
      </SearchContainer>

      {/* Stats Bar */}
      {(searchResult.length > 0 || searchQuery) && (
        <StatsBar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FindInPageIcon
              sx={{ fontSize: 16, color: theme.palette.info.main }}
            />
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: theme.palette.text.secondary }}
            >
              {isSearching
                ? 'Searching...'
                : `${searchResult.length} result${searchResult.length !== 1 ? 's' : ''}`}
            </Typography>
          </Box>
          {searchQuery && (
            <Chip
              label={`"${truncateString(searchQuery, 15)}"`}
              size="small"
              onDelete={handleClearSearch}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                bgcolor: alpha(theme.palette.info.main, 0.1),
                color: theme.palette.info.main,
                '& .MuiChip-deleteIcon': {
                  fontSize: 14,
                  color: theme.palette.info.main,
                },
              }}
            />
          )}
        </StatsBar>
      )}

      {/* Results List */}
      <ScrollContainer>
        {!searchQuery && searchResult.length === 0 ? (
          <EmptyState>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.info.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <SearchIcon
                sx={{ fontSize: 28, color: theme.palette.info.main }}
              />
            </Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: theme.palette.text.primary, mb: 0.5 }}
            >
              Search this book
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              Enter keywords to find passages
            </Typography>
          </EmptyState>
        ) : searchQuery && searchResult.length === 0 && !isSearching ? (
          <EmptyState>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <FindInPageIcon
                sx={{ fontSize: 28, color: theme.palette.warning.main }}
              />
            </Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: theme.palette.text.primary, mb: 0.5 }}
            >
              No results found
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              Try different keywords
            </Typography>
          </EmptyState>
        ) : (
          searchResult.map((match, index) => (
            <ResultCard
              key={match.data?.id || match.key || match.id || index}
              elevation={0}
              onClick={() =>
                isPDF
                  ? selectPDFHandler(match.data || match)
                  : selectEPubHandler(match.data?.cfi)
              }
            >
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ArticleIcon
                    className="result-icon"
                    sx={{
                      fontSize: 16,
                      color: theme.palette.text.secondary,
                      transition: 'color 0.2s ease',
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.82rem',
                      lineHeight: 1.5,
                      color: theme.palette.text.primary,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {truncateString(getResultText(match), 150)}
                  </Typography>
                  {match.data?.pageNumber && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.text.secondary,
                        fontSize: '0.7rem',
                        mt: 0.5,
                        display: 'block',
                      }}
                    >
                      Page {match.data.pageNumber}
                    </Typography>
                  )}
                </Box>
              </Box>
            </ResultCard>
          ))
        )}
      </ScrollContainer>
    </PanelContainer>
  );
}

export default SearchResultPane;
