/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import { Button, Popover, Box } from '@mui/material';
import SmallButton from '../../Button/SmallButton';

function ColorPicker({
  title,
  colors = ['#FF5733', '#33C1FF', '#8E44AD', '#FFFF00', '#27AE60', '#3C3C3C', '#FFFFFF'],
  colorHandler,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedColor, setSelectedColor] = useState(colors[0]); // Default to first color

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
  const id = open ? 'simple-popover' : undefined;

  return (
    <>
      <SmallButton
        aria-describedby={id}
        variant="contained"
        style={{ backgroundColor: selectedColor, color: selectedColor === '#FFFFFF' ? '#3C3C3C' : '#FFFFFF' }}
        onClick={handleClick}
      >
        {title}
      </SmallButton>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box display="flex" flexDirection="column">
          {colors.map((color) => (
            <Button
              key={color}
              style={{ backgroundColor: color, width: '100px', height: '30px' }}
              onClick={() => handleColorSelect(color)}
            />
          ))}
        </Box>
      </Popover>
    </>
  );
}

export default ColorPicker;
