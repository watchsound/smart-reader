/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RefreshIcon from '@mui/icons-material/Refresh';

function ZoomControls({ engine }) {
  const [zoomLevel, setZoomLevel] = useState(100); // Zoom level in percentage

  const handleZoomIn = () => {
    const newZoom = zoomLevel + 10;
    if (newZoom <= 200) {
      setZoomLevel(newZoom);
      engine.getModel().setZoomLevel(newZoom);
      engine.repaintCanvas();
    }
  };

  const handleZoomOut = () => {
    const newZoom = zoomLevel - 10;
    if (newZoom >= 50) {
      setZoomLevel(newZoom);
      engine.getModel().setZoomLevel(newZoom);
      engine.repaintCanvas();
    }
  };

  const handleReset = () => {
    setZoomLevel(100);
    engine.getModel().setZoomLevel(100);
    engine.repaintCanvas();
  };

  return (
    <>
      <IconButton size="small" onClick={handleZoomOut} aria-label="zoom out">
        <ZoomOutIcon />
      </IconButton>
      <IconButton size="small" onClick={handleReset} aria-label="reset zoom">
        <RefreshIcon />
      </IconButton>
      <IconButton size="small" onClick={handleZoomIn} aria-label="zoom in">
        <ZoomInIcon />
      </IconButton>
    </>
  );
}

export default ZoomControls;
