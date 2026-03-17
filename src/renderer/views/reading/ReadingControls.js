/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Popover from '@mui/material/Popover';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

// Icons
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ListIcon from '@mui/icons-material/List';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import FormatLineSpacingIcon from '@mui/icons-material/FormatLineSpacing';

// Styled floating container
const FloatingToolbar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  borderRadius: 12,
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(12px)',
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)'
      : '0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(29,28,29,0.08)',
  transition: 'opacity 0.2s ease, transform 0.2s ease',
  zIndex: 100,
  '&:hover': {
    transform: 'translateX(-50%) translateY(-2px)',
  },
}));

const ToolbarDivider = styled(Divider)(({ theme }) => ({
  height: 24,
  margin: '0 4px',
  backgroundColor: alpha(theme.palette.divider, 0.3),
}));

const ControlButton = styled(IconButton)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 8,
  color: theme.palette.text.secondary,
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
  },
  '&.active': {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    color: theme.palette.primary.main,
  },
}));

// Navigation pill for page controls
const NavigationPill = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '4px 8px',
  borderRadius: 20,
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
}));

function ReadingControls({
  page,
  onPrevPage,
  onNextPage,
  onTocToggle,
  onSearch,
  onZoomIn,
  onZoomOut,
  onFullscreen,
  isFullscreen,
  fontSize,
  onFontSizeChange,
  visible = true,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [settingsAnchor, setSettingsAnchor] = useState(null);

  const handleSettingsOpen = (event) => {
    setSettingsAnchor(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchor(null);
  };

  const settingsOpen = Boolean(settingsAnchor);

  if (!visible) return null;

  return (
    <>
      <FloatingToolbar
        sx={{
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        {/* Table of Contents */}
        <Tooltip title="Table of Contents">
          <ControlButton onClick={onTocToggle}>
            <ListIcon sx={{ fontSize: 20 }} />
          </ControlButton>
        </Tooltip>

        {/* Search */}
        <Tooltip title="Search in book">
          <ControlButton onClick={onSearch}>
            <SearchIcon sx={{ fontSize: 20 }} />
          </ControlButton>
        </Tooltip>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Navigation */}
        <NavigationPill>
          <Tooltip title="Previous page">
            <span>
              <IconButton
                size="small"
                onClick={onPrevPage}
                disabled={page?.curPage <= 1}
                sx={{
                  width: 28,
                  height: 28,
                  color: theme.palette.primary.main,
                  '&:disabled': {
                    color: alpha(theme.palette.text.primary, 0.25),
                  },
                }}
              >
                <NavigateBeforeIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              color: theme.palette.primary.main,
              minWidth: 48,
              textAlign: 'center',
            }}
          >
            {page?.curPage || 1} / {page?.totalPages || 1}
          </Typography>
          <Tooltip title="Next page">
            <span>
              <IconButton
                size="small"
                onClick={onNextPage}
                disabled={page?.curPage >= page?.totalPages}
                sx={{
                  width: 28,
                  height: 28,
                  color: theme.palette.primary.main,
                  '&:disabled': {
                    color: alpha(theme.palette.text.primary, 0.25),
                  },
                }}
              >
                <NavigateNextIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </NavigationPill>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Zoom Controls */}
        <Tooltip title="Zoom out">
          <ControlButton onClick={onZoomOut}>
            <ZoomOutIcon sx={{ fontSize: 20 }} />
          </ControlButton>
        </Tooltip>
        <Tooltip title="Zoom in">
          <ControlButton onClick={onZoomIn}>
            <ZoomInIcon sx={{ fontSize: 20 }} />
          </ControlButton>
        </Tooltip>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Settings */}
        <Tooltip title="Reading settings">
          <ControlButton onClick={handleSettingsOpen}>
            <SettingsIcon sx={{ fontSize: 20 }} />
          </ControlButton>
        </Tooltip>

        {/* Fullscreen */}
        <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          <ControlButton onClick={onFullscreen}>
            {isFullscreen ? (
              <FullscreenExitIcon sx={{ fontSize: 20 }} />
            ) : (
              <FullscreenIcon sx={{ fontSize: 20 }} />
            )}
          </ControlButton>
        </Tooltip>
      </FloatingToolbar>

      {/* Settings Popover */}
      <Popover
        open={settingsOpen}
        anchorEl={settingsAnchor}
        onClose={handleSettingsClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 2,
            width: 280,
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.4)'
              : '0 8px 32px rgba(0,0,0,0.15)',
          },
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
          Reading Settings
        </Typography>

        {/* Font Size */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TextFieldsIcon
              sx={{ fontSize: 18, color: theme.palette.text.secondary }}
            />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Font Size
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              A
            </Typography>
            <Slider
              value={fontSize || 100}
              onChange={(e, value) => onFontSizeChange?.(value)}
              min={75}
              max={150}
              step={5}
              sx={{
                flex: 1,
                '& .MuiSlider-thumb': {
                  width: 16,
                  height: 16,
                },
                '& .MuiSlider-track': {
                  height: 4,
                },
                '& .MuiSlider-rail': {
                  height: 4,
                },
              }}
            />
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
            >
              A
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              display: 'block',
              textAlign: 'center',
              mt: 0.5,
            }}
          >
            {fontSize || 100}%
          </Typography>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Line Spacing */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FormatLineSpacingIcon
              sx={{ fontSize: 18, color: theme.palette.text.secondary }}
            />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Line Spacing
            </Typography>
          </Box>
          <ToggleButtonGroup
            value="normal"
            exclusive
            size="small"
            fullWidth
            sx={{
              '& .MuiToggleButton-root': {
                fontSize: '0.75rem',
                py: 0.5,
                textTransform: 'none',
              },
            }}
          >
            <ToggleButton value="compact">Compact</ToggleButton>
            <ToggleButton value="normal">Normal</ToggleButton>
            <ToggleButton value="relaxed">Relaxed</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Popover>
    </>
  );
}

export default ReadingControls;
