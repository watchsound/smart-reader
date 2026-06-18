import React from 'react';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';

export default function LensToggle({ value, onChange }) {
  return (
    <ToggleButtonGroup
      value={value} exclusive size="small"
      onChange={(_, v) => v && onChange(v)}
      aria-label="lens"
    >
      <ToggleButton value="attention">Attention</ToggleButton>
      <ToggleButton value="phase">Phase</ToggleButton>
      <ToggleButton value="intent">Intent</ToggleButton>
    </ToggleButtonGroup>
  );
}
