/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import { Button, Popover, Box, Typography, Tooltip, IconButton } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import CheckIcon from '@mui/icons-material/Check';

const ColorButton = styled(IconButton)(({ theme, bgcolor }) => ({
  width: 28,
  height: 28,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: bgcolor || 'transparent',
  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
  transition: 'all 0.15s ease',
  '&:hover': {
    transform: 'scale(1.1)',
    boxShadow: `0 2px 8px ${alpha('#000', 0.15)}`,
  },
}));

const ColorSwatch = styled(Box)(({ theme, selected }) => ({
  width: 32,
  height: 32,
  borderRadius: 6,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
  border: selected
    ? `2px solid ${theme.palette.primary.main}`
    : `1px solid ${alpha(theme.palette.divider, 0.2)}`,
  transform: selected ? 'scale(1.1)' : 'scale(1)',
  '&:hover': {
    transform: 'scale(1.15)',
    boxShadow: `0 2px 8px ${alpha('#000', 0.2)}`,
  },
}));

const PRESET_COLORS = [
  // Row 1 - Vibrant
  '#FF5733', '#FF9800', '#FFC107', '#FFEB3B',
  // Row 2 - Greens & Blues
  '#4CAF50', '#00BCD4', '#2196F3', '#3F51B5',
  // Row 3 - Purples & Pinks
  '#9C27B0', '#E91E63', '#F44336', '#795548',
  // Row 4 - Neutrals
  '#607D8B', '#9E9E9E', '#FFFFFF', '#212121',
];

function ColorPicker({
  title,
  colors = PRESET_COLORS,
  colorHandler,
}) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    if (colorHandler) colorHandler(color);
    handleClose();
  };

  const open = Boolean(anchorEl);
  const id = open ? `color-picker-${title}` : undefined;

  // Determine if color is light for contrast
  const isLightColor = (hex) => {
    if (!hex) return true;
    const c = hex.substring(1);
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma > 150;
  };

  return (
    <>
      <Tooltip title={`${title} color`}>
        <ColorButton
          aria-describedby={id}
          onClick={handleClick}
          bgcolor={selectedColor}
          sx={{
            position: 'relative',
            '&::after': selectedColor ? {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              border: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
            } : {},
          }}
        >
          {!selectedColor && (
            <PaletteIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
          )}
        </ColorButton>
      </Tooltip>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            p: 1.5,
            borderRadius: 2,
            boxShadow: `0 4px 20px ${alpha('#000', theme.palette.mode === 'dark' ? 0.4 : 0.15)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontSize: '0.65rem',
            display: 'block',
            mb: 1,
          }}
        >
          {title} Color
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0.75,
          }}
        >
          {colors.map((color) => (
            <ColorSwatch
              key={color}
              selected={selectedColor === color}
              sx={{ bgcolor: color }}
              onClick={() => handleColorSelect(color)}
            >
              {selectedColor === color && (
                <CheckIcon
                  sx={{
                    fontSize: 16,
                    color: isLightColor(color) ? '#333' : '#fff',
                  }}
                />
              )}
            </ColorSwatch>
          ))}
        </Box>

        {/* Clear button */}
        <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Button
            size="small"
            onClick={() => handleColorSelect(null)}
            sx={{
              width: '100%',
              fontSize: '0.7rem',
              textTransform: 'none',
              color: theme.palette.text.secondary,
            }}
          >
            Clear / Default
          </Button>
        </Box>
      </Popover>
    </>
  );
}

export default ColorPicker;
