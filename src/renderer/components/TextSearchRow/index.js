import { useState } from 'react';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useTheme, alpha } from '@mui/material/styles';

import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import ConnectedTvIcon from '@mui/icons-material/ConnectedTv';

function TextSearchRow({
  placeHolder,
  label,
  searchAction,
  createAction,
  searchButton,
  createButton,
  searchTip,
  createTip,
  thirdAction,
  thirdButton,
  thirdTip,
  sx,
}) {
  const theme = useTheme();
  const [filterKey, setFilterKey] = useState('');

  const handleSearch = () => {
    if (searchAction) searchAction(filterKey);
  };

  const handleClear = () => {
    setFilterKey('');
    if (searchAction) searchAction('');
  };

  return (
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
        ...sx,
      }}
    >
      <SearchIcon sx={{ fontSize: 17, color: 'text.disabled', flexShrink: 0 }} />

      <InputBase
        placeholder={placeHolder || label || 'Search…'}
        value={filterKey}
        onChange={(e) => setFilterKey(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        sx={{
          flex: 1,
          fontSize: '0.85rem',
          '& input': { padding: 0 },
        }}
      />

      {filterKey && (
        <Tooltip title="Clear">
          <IconButton size="small" onClick={handleClear} sx={{ p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          </IconButton>
        </Tooltip>
      )}

      {(createAction || thirdAction) && (
        <Box
          sx={{
            width: '1px',
            height: 16,
            bgcolor: alpha(theme.palette.divider, 0.3),
            mx: 0.25,
            flexShrink: 0,
          }}
        />
      )}

      {createAction && (
        <Tooltip title={createTip ?? 'create'}>
          <IconButton
            size="small"
            onClick={() => createAction(filterKey)}
            sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
          >
            {createButton ?? <CreateNewFolderIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      )}

      {thirdAction && (
        <Tooltip title={thirdTip ?? 'action'}>
          <IconButton
            size="small"
            onClick={() => thirdAction(filterKey)}
            sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
          >
            {thirdButton ?? <ConnectedTvIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

export default TextSearchRow;
