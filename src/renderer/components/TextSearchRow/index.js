import { useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import Tooltip from '@mui/material/Tooltip';
import InputAdornment from '@mui/material/InputAdornment';
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
}) {
  const [filterKey, setFilterKey] = useState('');

  return (
    <Box sx={{ flexGrow: 1, borderStyle: 'none  none solid none',  borderWidth: '1px', }}>
      <TextField
        variant="outlined"
        size="small"
        label={label}
        placeholder={placeHolder}
        value={filterKey}
        onChange={(e) => setFilterKey(e.target.value)}
        sx={{ height: '35px', marginBottom: '5px' }}
        fullWidth
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={searchTip ?? 'search'}>
                <IconButton
                  size="small"
                  onClick={() => {
                    searchAction(filterKey);
                  }}
                  aria-label="search"
                >
                  {searchButton !== undefined && searchButton}
                  {searchButton === undefined && (
                    <SearchIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              {createAction && (
                <Tooltip title={createTip ?? 'create'}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      createAction(filterKey);
                    }}
                    aria-label="create"
                  >
                    {createButton !== undefined && createButton}
                    {createButton === undefined && (
                      <CreateNewFolderIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              )}
              {thirdAction && (
                <Tooltip title={thirdTip ?? 'create'}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      thirdAction(filterKey);
                    }}
                    aria-label="create"
                  >
                    {thirdButton !== undefined && thirdButton}
                    {thirdButton === undefined && (
                      <ConnectedTvIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              )}
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
}

export default TextSearchRow;
