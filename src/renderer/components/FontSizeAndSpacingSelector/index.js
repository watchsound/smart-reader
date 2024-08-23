// src/components/FontSizeAndSpacingSelector.js
import React, { useState } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Slider,
} from '@mui/material';

function FontSizeAndSpacingSelector({ onFontSizeChange, onSpacingChange }) {
  const [fontSize, setFontSize] = useState(16);
  const [spacing, setSpacing] = useState(1.3);
  const [open, setOpen] = useState(false);

  const handleFontSizeChange = (event, newValue) => {
    setFontSize(newValue);
    onFontSizeChange(newValue);
  };

  const handleSpacingChange = (event, newValue) => {
    setSpacing(newValue);
    onSpacingChange(newValue);
  };

  return (
    <FormControl fullWidth size="small">
      <InputLabel id="font-size-spacing-selector-label">
        Font Size & Spacing
      </InputLabel>
      <Select
        labelId="font-size-spacing-selector-label"
        value=""
        onChange={() => {}}
        renderValue={() => `${fontSize}px / ${spacing}`}
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        MenuProps={{
          PaperProps: {
            style: {
              padding: 20,
              width: 300,
            },
          },
        }}
      >
        <Box>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={2}
          >
            <span>Font Size: {fontSize}px</span>
          </Box>
          <Slider
            value={fontSize}
            onChange={handleFontSizeChange}
            aria-labelledby="font-size-slider"
            step={1}
            marks
            min={10}
            max={30}
            valueLabelDisplay="auto"
          />
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mt={2}
            mb={2}
          >
            <span>Line Spacing: {spacing}</span>
          </Box>
          <Slider
            value={spacing}
            onChange={handleSpacingChange}
            aria-labelledby="line-spacing-slider"
            step={0.1}
            marks
            min={0.6}
            max={2.1}
            valueLabelDisplay="auto"
          />
        </Box>
      </Select>
    </FormControl>
  );
}

export default FontSizeAndSpacingSelector;
