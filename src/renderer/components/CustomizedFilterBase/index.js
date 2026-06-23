import { useState, useEffect } from 'react';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Rating from '@mui/material/Rating';
import Collapse from '@mui/material/Collapse';
import { useTheme, alpha } from '@mui/material/styles';
import { styled } from '@mui/material/styles';
import TagsInput from 'react-tagsinput';
import { useSelector, useDispatch } from 'react-redux';
import isEqual from 'is-equal';
import watch from 'redux-watch';

import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import StarIcon from '@mui/icons-material/Star';

import store from '../../store/store';
import 'react-tagsinput/react-tagsinput.css';

import {
  filterByKeyHandled,
  filterByStarsHandled,
  filterByTagsHandled,
  showTextOnlyHandled,
} from '../../store/reducers/noteSlice';

const TagsInputClean = styled(TagsInput)(({ theme }) => ({
  backgroundColor: 'transparent',
  border: 'none !important',
  padding: '0 4px',
  fontSize: '0.775rem',
  minHeight: 0,
  '& .react-tagsinput-tag': {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    color: theme.palette.primary.main,
    borderRadius: '4px',
    border: 'none',
    fontSize: '0.72rem',
    padding: '1px 6px',
    margin: '2px',
  },
  '& .react-tagsinput-input': {
    fontSize: '0.775rem',
    color: theme.palette.text.primary,
    width: 80,
  },
}));

function CustomizedFilterBase({ useForSidePane, queryActionCallback }) {
  const theme = useTheme();
  const [filterKey, setFilterKey] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const cachedFilterKey = useSelector((state) => state.note.filterKey);
  const filterStars = useSelector((state) => state.note.filterStars);
  const filterTags = useSelector((state) => state.note.filterTags);
  const dispatch = useDispatch();

  useEffect(() => {
    const w = watch(store.getState, 'note.filterKey', isEqual);
    const unsubscribe = store.subscribe(
      w((newVal) => {
        setTimeout(() => setFilterKey(newVal), 0.5);
      }),
    );
    return () => unsubscribe();
  }, []);

  const search = () => {
    dispatch(filterByKeyHandled(filterKey));
    if (cachedFilterKey === filterKey && queryActionCallback)
      queryActionCallback(filterKey);
  };

  const clearSearch = () => {
    setFilterKey('');
    dispatch(filterByKeyHandled(''));
    if (queryActionCallback) queryActionCallback('');
  };

  const hasActiveFilter = filterStars > 0 || (filterTags && filterTags.length > 0);

  return (
    <Box sx={{ width: '100%', px: 1.5, py: 1 }}>
      {/* Search pill */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: 'transparent',
          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          borderRadius: '20px',
          px: 1.25,
          py: 0.4,
          transition: 'all 0.18s ease',
          '&:focus-within': {
            bgcolor: theme.palette.background.paper,
            borderColor: alpha(theme.palette.primary.main, 0.35),
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.08)}`,
          },
        }}
      >
        <SearchIcon sx={{ fontSize: 17, color: 'text.disabled', flexShrink: 0 }} />

        <InputBase
          placeholder="Search notes…"
          value={filterKey}
          onChange={(e) => setFilterKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          sx={{
            flex: 1,
            fontSize: '0.85rem',
            '& input': { padding: 0 },
          }}
        />

        {filterKey && (
          <IconButton size="small" onClick={clearSearch} sx={{ p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          </IconButton>
        )}

        <Box
          sx={{
            width: '1px',
            height: 16,
            bgcolor: alpha(theme.palette.divider, 0.3),
            mx: 0.25,
          }}
        />

        <Tooltip title="Filters">
          <IconButton
            size="small"
            onClick={() => setShowFilters((v) => !v)}
            sx={{
              p: 0.25,
              color: hasActiveFilter ? 'primary.main' : 'text.disabled',
            }}
          >
            <TuneIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Collapsible filter row */}
      <Collapse in={showFilters}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mt: 0.75,
            px: 1,
          }}
        >
          <StarIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          <Rating
            name="note-rate"
            size="small"
            value={filterStars}
            onChange={(_, newValue) => dispatch(filterByStarsHandled(newValue || 0))}
            sx={{ '& .MuiRating-icon': { fontSize: 16 } }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <TagsInputClean
              tags={[]}
              value={filterTags}
              inputProps={{ placeholder: 'tags…' }}
              onChange={(tags) => dispatch(filterByTagsHandled(tags))}
            />
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

export default CustomizedFilterBase;
