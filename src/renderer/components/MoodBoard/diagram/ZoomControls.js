/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import { Box, IconButton, Typography, Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';

const ZoomButton = styled(IconButton)(({ theme }) => ({
  width: 28,
  height: 28,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: 'transparent',
  color: theme.palette.text.secondary,
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.text.primary, 0.04),
    color: theme.palette.text.primary,
  },
  '&:disabled': {
    color: theme.palette.text.disabled,
  },
}));

const ZoomIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 40,
  height: 24,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
  padding: '0 6px',
}));

function ZoomControls({ engine }) {
  const theme = useTheme();
  const [zoomLevel, setZoomLevel] = useState(100);

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 10, 200);
    setZoomLevel(newZoom);
    engine.getModel().setZoomLevel(newZoom);
    engine.repaintCanvas();
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 10, 25);
    setZoomLevel(newZoom);
    engine.getModel().setZoomLevel(newZoom);
    engine.repaintCanvas();
  };

  const handleReset = () => {
    setZoomLevel(100);
    engine.getModel().setZoomLevel(100);
    engine.repaintCanvas();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Tooltip title="Zoom out">
        <span>
          <ZoomButton
            size="small"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 25}
            aria-label="zoom out"
          >
            <ZoomOutIcon sx={{ fontSize: 18 }} />
          </ZoomButton>
        </span>
      </Tooltip>

      <Tooltip title="Click to reset to 100%">
        <ZoomIndicator
          onClick={handleReset}
          sx={{ cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.08) } }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 500,
              fontSize: '0.7rem',
              color: theme.palette.text.secondary,
            }}
          >
            {zoomLevel}%
          </Typography>
        </ZoomIndicator>
      </Tooltip>

      <Tooltip title="Zoom in">
        <span>
          <ZoomButton
            size="small"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 200}
            aria-label="zoom in"
          >
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </ZoomButton>
        </span>
      </Tooltip>

      <Tooltip title="Fit to center">
        <ZoomButton size="small" onClick={handleReset} aria-label="center view">
          <CenterFocusStrongIcon sx={{ fontSize: 16 }} />
        </ZoomButton>
      </Tooltip>
    </Box>
  );
}

export default ZoomControls;
