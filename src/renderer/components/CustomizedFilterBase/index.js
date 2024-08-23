import { useState, useRef, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import InputBase from '@mui/material/InputBase';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import TextField from '@mui/material/TextField';
import Rating from '@mui/material/Rating';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import { useSelector, useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import isEqual from 'is-equal';
import watch from 'redux-watch';
import Tooltip from '@mui/material/Tooltip';
import TagsInput from 'react-tagsinput';
import { styled } from '@mui/material/styles';
import store from '../../store/store';

import 'react-tagsinput/react-tagsinput.css';
import './nodefilter-styles.module.css';

import {
  filterByKeyHandled,
  filterByStarsHandled,
  filterByTagsHandled,
  showTextOnlyHandled,
} from '../../store/reducers/noteSlice';
import { isEmpty } from '../../../commons/utils/commonUtil';

const TagsInputNoBorder = styled(TagsInput)({
  backgroundColor: '#fff0',
  border: '1px solid #0000 !important',
  overflow: 'hidden',
  paddingLeft: '5px',
  alignItems: 'center',
});

function CustomizedFilterBase({ useForSidePane, queryActionCallback }) {
  // const filterBy = useSelector((state) => state.note.filterBy);
  const [filterKey, setFilterKey] = useState('');
  const cachedFilterKey = useSelector((state) => state.note.filterKey);
  const filterStars = useSelector((state) => state.note.filterStars);
  const filterTags = useSelector((state) => state.note.filterTags);
  const showTextOnly = useSelector((state) => state.note.showTextOnly);
  // const inputRef = useRef();
  const dispatch = useDispatch();

  useEffect(() => {
    const w = watch(store.getState, 'note.filterKey', isEqual);
    const unsubscribe = store.subscribe(
      w((newVal, oldVal, objectPath) => {
        setTimeout(() => {
          // if (!isEmpty(newVal))
          setFilterKey(newVal);
        }, 0.5);
      }),
    );
    return () => unsubscribe();
  }, []);

  function search() {
    dispatch(filterByKeyHandled(filterKey));
    if (cachedFilterKey === filterKey && queryActionCallback)
      queryActionCallback(filterKey);
  }

  if (useForSidePane)
    return (
      <Box
        sx={{
          flexGrow: 1,
          width: '100%',
          borderStyle: 'none  none solid none',
          borderWidth: '1px',
        }}
      >
        <div className="two_end_container">
          <div className="two_end_start" style={{ border: 'none' }}>
            <TextField
              variant="outlined"
              size="small"
              label="Search Notes"
              // sx={{ ml: 1, flex: 1 }}
              value={filterKey}
              sx={{ height: '35px', marginBottom: '5px' }}
              onChange={(e) => setFilterKey(e.target.value)}
              InputProps={{
                'aria-label': 'Search Notes By Keywords',
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Search">
                      <IconButton
                        size="small"
                        onClick={() => {
                          search();
                        }}
                        aria-label="search"
                      >
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Toggle Controls">
                      <IconButton
                        size="small"
                        onClick={() => {
                          dispatch(showTextOnlyHandled(!showTextOnly));
                        }}
                        aria-label="search"
                      >
                        <BuildCircleIcon
                          fontSize="small"
                          color={showTextOnly ? 'primary' : 'action'}
                        />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </div>
        </div>
      </Box>
    );
  return (
    <Box sx={{ flexGrow: 1, width: '100%', border: 'none' }}>
      <div className="two_end_container">
        <div className="two_end_start" style={{ border: 'none' }}>
          <TextField
            variant="outlined"
            size="small"
            label="Search Notes"
            // sx={{ ml: 1, flex: 1 }}
            value={filterKey}
            sx={{ height: '35px', marginBottom: '5px', border: 'none' }}
            onChange={(e) => setFilterKey(e.target.value)}
            InputProps={{
              'aria-label': 'Search Notes By Keywords',
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => {
                      search();
                    }}
                    aria-label="search"
                  >
                    <SearchIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      dispatch(showTextOnlyHandled(!showTextOnly));
                    }}
                    aria-label="search"
                  >
                    <BuildCircleIcon
                      fontSize="small"
                      color={showTextOnly ? 'primary' : 'action'}
                    />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </div>
        <div className="two_end_end" style={{ border: 'none' }}>
          <div className="two_end_container">
            <div className="two_end_start" style={{ border: 'none' }}>
              <TagsInputNoBorder
                tags={[]}
                value={filterTags}
                onChange={(tags) => {
                  dispatch(filterByTagsHandled(tags));
                }}
              />
            </div>
            <div
              className="two_end_end"
              style={{ display: 'flex', alignItems: 'center', border: 'none' }}
            >
              <Rating
                name="note-rate"
                size="small"
                value={filterStars}
                onChange={(event, newValue) => {
                  dispatch(filterByStarsHandled(newValue || 0));
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Box>
  );
}

export default CustomizedFilterBase;
