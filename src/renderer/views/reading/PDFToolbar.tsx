import React, { useState } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';

// Icons
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import PrintIcon from '@mui/icons-material/Print';

interface ToolbarProps {
  setPdfScaleValue: (value: number) => void;
}

// Styled toolbar container
const ToolbarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 16px',
  background: theme.palette.mode === 'dark'
    ? `linear-gradient(to bottom, ${theme.palette.background.paper}, ${alpha(theme.palette.background.paper, 0.95)})`
    : `linear-gradient(to bottom, ${theme.palette.background.paper}, ${alpha(theme.palette.background.paper, 0.98)})`,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  gap: 8,
  zIndex: 10,
  minHeight: 41,
}));

const ToolbarButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: 6,
  color: theme.palette.text.secondary,
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
  },
}));

const ToolbarDivider = styled(Divider)(({ theme }) => ({
  height: 20,
  margin: '0 8px',
  backgroundColor: alpha(theme.palette.divider, 0.3),
}));

const ZoomChip = styled(Chip)(({ theme }) => ({
  height: 24,
  fontSize: '0.75rem',
  fontWeight: 600,
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
  color: theme.palette.primary.main,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  cursor: 'pointer',
  '& .MuiChip-label': {
    padding: '0 8px',
  },
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
  },
}));

function Toolbar({ setPdfScaleValue }: ToolbarProps) {
  const theme = useTheme();
  const [zoom, setZoom] = useState<number | null>(null);

  const zoomIn = () => {
    if (zoom) {
      if (zoom < 4) {
        setPdfScaleValue(zoom + 0.1);
        setZoom(zoom + 0.1);
      }
    } else {
      setPdfScaleValue(1);
      setZoom(1);
    }
  };

  const zoomOut = () => {
    if (zoom) {
      if (zoom > 0.2) {
        setPdfScaleValue(zoom - 0.1);
        setZoom(zoom - 0.1);
      }
    } else {
      setPdfScaleValue(1);
      setZoom(1);
    }
  };

  const resetZoom = () => {
    setPdfScaleValue(1);
    setZoom(null);
  };

  return (
    <ToolbarContainer>
      {/* Zoom Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="Zoom out">
          <ToolbarButton onClick={zoomOut} size="small">
            <ZoomOutIcon sx={{ fontSize: 18 }} />
          </ToolbarButton>
        </Tooltip>

        <ZoomChip
          label={zoom ? `${(zoom * 100).toFixed(0)}%` : 'Auto'}
          onClick={resetZoom}
          size="small"
        />

        <Tooltip title="Zoom in">
          <ToolbarButton onClick={zoomIn} size="small">
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </ToolbarButton>
        </Tooltip>
      </Box>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* Additional controls */}
      <Tooltip title="Fit to page">
        <ToolbarButton onClick={resetZoom} size="small">
          <FitScreenIcon sx={{ fontSize: 18 }} />
        </ToolbarButton>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      {/* Right side controls */}
      <Tooltip title="Print">
        <ToolbarButton size="small">
          <PrintIcon sx={{ fontSize: 18 }} />
        </ToolbarButton>
      </Tooltip>
    </ToolbarContainer>
  );
}

export default Toolbar;
