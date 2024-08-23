// ThemeToggleButton.js
import React from 'react';
import Switch from '@mui/material/Switch';
import { useTheme } from '../../ThemeContext';

function ThemeToggleButton() {
  const { themeMode, toggleTheme } = useTheme();
  return (
    <Switch
      checked={themeMode === 'dark'}
      onChange={toggleTheme}
      name="themeToggle"
      inputProps={{ 'aria-label': 'toggle theme' }}
    />
  );
}

export default ThemeToggleButton;
