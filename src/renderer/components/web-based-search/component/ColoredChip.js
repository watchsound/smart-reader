import React from 'react';
import { Chip } from '@mui/material';

function ColoredChip({ text, color = '#3f51b5' }) {
  return (
    <Chip
      label={text}
      style={{
        backgroundColor: color,
        borderRadius: '25px 0px 25px 25px', // To match the rounded corners from the image
        color: 'white',
        fontSize: '14px', // Adjust size to your preference
        padding: '10px 20px',
      }}
    />
  );
}

export default ColoredChip;
