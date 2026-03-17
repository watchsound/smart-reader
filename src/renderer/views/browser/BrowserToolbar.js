/* eslint-disable prettier/prettier */
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Autocomplete,
  TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import TranslateIcon from '@mui/icons-material/Translate';
import SchoolIcon from '@mui/icons-material/School';
import LinkIcon from '@mui/icons-material/Link';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import LongPressButton from '../../components/Button/LongPressButton';
import './browser.styles.css';

function BrowserToolbar({
  currentUrl,
  filterKey,
  setFilterKey,
  cachedUrls,
  onSearch,
  onBack,
  onForward,
  onSimpleForward,
  onRefresh,
  canGoBack,
  canGoForward,
  forwardChoices,
  onBookmark,
  onCapture,
  isCapturing,
  isBookmarked,
  onReadingLevelChange,
  readingProgress,
  isLoading,
  onToggleParagraphIcons,
  paragraphIconsActive,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [anchorEl, setAnchorEl] = useState(null);
  const [moreAnchorEl, setMoreAnchorEl] = useState(null);
  const urlInputRef = useRef(null);

  const isSecure = currentUrl?.startsWith('https://');

  const handleForwardMenuOpen = (event) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget || event.target);
  };

  const handleForwardMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMoreMenuOpen = (event) => {
    setMoreAnchorEl(event.currentTarget);
  };

  const handleMoreMenuClose = () => {
    setMoreAnchorEl(null);
  };

  const handleUrlSubmit = (event, value) => {
    if (!value) return;
    let url = value;
    if (!url.startsWith('http')) {
      url = `http://${url}`;
    }
    onSearch(url);
  };

  const readingLevels = [
    { level: 1500, label: '4th Grade' },
    { level: 2500, label: '5th Grade' },
    { level: 3500, label: '6th Grade' },
    { level: 4500, label: '7th Grade' },
    { level: 5500, label: '8th Grade' },
    { level: 6500, label: '9th Grade' },
    { level: 7500, label: '10th Grade' },
    { level: 8500, label: '11th Grade' },
    { level: 9500, label: '12th Grade' },
  ];

  return (
    <div className={`browser-toolbar ${isDark ? 'browser-toolbar--dark' : ''}`}>
      {/* Navigation Group */}
      <div className="browser-nav-group">
        <Tooltip title="Go Back" arrow>
          <span>
            <IconButton
              className="browser-nav-btn"
              onClick={onBack}
              disabled={!canGoBack}
              size="small"
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <LongPressButton
          handleNormalPress={onSimpleForward}
          handleLongPress={handleForwardMenuOpen}
          disabled={!canGoForward}
          IconComponent={ArrowForwardIcon}
          tooltip="Go Forward (hold for history)"
        />

        {canGoForward && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleForwardMenuClose}
            transformOrigin={{ horizontal: 'left', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            PaperProps={{
              sx: {
                maxHeight: 300,
                minWidth: 250,
                backdropFilter: 'blur(10px)',
                background: isDark ? 'rgba(40, 44, 52, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              },
            }}
          >
            {forwardChoices.map((url, index) => (
              <MenuItem
                key={index}
                onClick={() => {
                  handleForwardMenuClose();
                  onForward(index);
                }}
              >
                <ListItemIcon>
                  <LinkIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={url}
                  primaryTypographyProps={{
                    sx: {
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 200,
                      fontSize: '13px',
                    },
                  }}
                />
              </MenuItem>
            ))}
          </Menu>
        )}

        <Tooltip title="Refresh" arrow>
          <IconButton className="browser-nav-btn" onClick={onRefresh} size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>

      <div className="browser-toolbar-divider" />

      {/* URL Input Container */}
      <div className="browser-url-container">
        {isSecure ? (
          <LockIcon className="browser-security-icon" sx={{ fontSize: 16 }} />
        ) : (
          <LockOpenIcon className="browser-security-icon browser-security-icon--insecure" sx={{ fontSize: 16 }} />
        )}

        <Autocomplete
          freeSolo
          fullWidth
          options={cachedUrls || []}
          value={filterKey || ''}
          onChange={handleUrlSubmit}
          onInputChange={(e, value) => setFilterKey(value)}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="standard"
              placeholder="Enter URL or search..."
              InputProps={{
                ...params.InputProps,
                disableUnderline: true,
                sx: {
                  fontSize: '14px',
                  '& input': {
                    padding: '4px 0',
                  },
                },
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUrlSubmit(e, filterKey);
                }
              }}
            />
          )}
          sx={{ flex: 1 }}
        />

        <Tooltip title="Search" arrow>
          <IconButton
            size="small"
            onClick={() => handleUrlSubmit(null, filterKey)}
            sx={{ padding: '4px' }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>

      <div className="browser-toolbar-divider" />

      {/* Action Group */}
      <div className="browser-action-group">
        <Tooltip title="Capture Area" arrow>
          <IconButton
            className={`browser-action-btn ${isCapturing ? 'browser-action-btn--active' : ''}`}
            onClick={onCapture}
            size="small"
          >
            <CameraAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={isBookmarked ? 'Bookmarked' : 'Add Bookmark'} arrow>
          <IconButton
            className={`browser-action-btn ${isBookmarked ? 'browser-action-btn--bookmarked' : ''}`}
            onClick={onBookmark}
            size="small"
          >
            {isBookmarked ? (
              <BookmarkIcon fontSize="small" />
            ) : (
              <BookmarkBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title={paragraphIconsActive ? 'Hide Paragraph Actions' : 'Show Paragraph Actions'} arrow>
          <IconButton
            className={`browser-action-btn ${paragraphIconsActive ? 'browser-action-btn--active' : ''}`}
            onClick={onToggleParagraphIcons}
            size="small"
          >
            <AutoAwesomeIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Reading Level" arrow>
          <IconButton
            className="browser-action-btn"
            onClick={handleMoreMenuOpen}
            size="small"
          >
            <SchoolIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={moreAnchorEl}
          open={Boolean(moreAnchorEl)}
          onClose={handleMoreMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: {
              minWidth: 180,
              backdropFilter: 'blur(10px)',
              background: isDark ? 'rgba(40, 44, 52, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            },
          }}
        >
          {readingLevels.map(({ level, label }) => (
            <MenuItem
              key={level}
              onClick={() => {
                handleMoreMenuClose();
                onReadingLevelChange(level);
              }}
            >
              <ListItemIcon>
                <TranslateIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={`For ${label}`} />
            </MenuItem>
          ))}
        </Menu>
      </div>

      {/* Progress Bar */}
      <div className="browser-progress-container">
        <div
          className={`browser-progress-bar ${isLoading ? 'browser-progress-bar--loading' : ''}`}
          style={{ width: isLoading ? undefined : `${readingProgress}%` }}
        />
      </div>
    </div>
  );
}

export default BrowserToolbar;
