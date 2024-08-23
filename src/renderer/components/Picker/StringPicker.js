// src/components/ColorPicker.js
import React, { useState } from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

/**
 * options:  can be [ string, string ]
 * also can be [
 *   {label, value},...
 * ]
 */
function StringPicker({ title, options, selectedOne, onSelection }) {
  const [selectedOption, setSelectedOption] = useState(
    selectedOne || options[0],
  );
  const [open, setOpen] = useState(false);

  const handleSelectionChange = (event) => {
    const n = event.target.value;
    setSelectedOption(n);
    onSelection(n);
    setOpen(false);
  };

  return (
    <FormControl fullWidth size="small">
      <InputLabel id="picker-label">{title}</InputLabel>
      <Select
        labelId="picker-label"
        value={selectedOption}
        onChange={handleSelectionChange}
        renderValue={(selected) => (
          <Box display="flex" alignItems="center">
            {typeof selected.label === 'undefined' && selected}
            {typeof selected.label !== 'undefined' && selected.label}
          </Box>
        )}
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
      >
        {options.map((option, index) => (
          <MenuItem key={index} value={option}>
            <Box display="flex" alignItems="center">
              {typeof option.label === 'undefined' && option}
              {typeof option.label !== 'undefined' && option.label}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default StringPicker;
