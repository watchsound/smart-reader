import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LevelSelector from '../../renderer/views/translate/LevelSelector';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('LevelSelector', () => {
  test('renders three radios A/B/C with labels', () => {
    const { getByLabelText } = wrap(<LevelSelector level="A" onChange={() => {}} />);
    expect(getByLabelText(/A · Drill/)).toBeTruthy();
    expect(getByLabelText(/B · Paragraph/)).toBeTruthy();
    expect(getByLabelText(/C · Lookup/)).toBeTruthy();
  });

  test('calls onChange with the new level when clicked', () => {
    const onChange = jest.fn();
    const { getByLabelText } = wrap(<LevelSelector level="A" onChange={onChange} />);
    fireEvent.click(getByLabelText(/B · Paragraph/));
    expect(onChange).toHaveBeenCalledWith('B');
  });

  test('marks the current level as selected', () => {
    const { getByLabelText } = wrap(<LevelSelector level="C" onChange={() => {}} />);
    expect(getByLabelText(/C · Lookup/).checked).toBe(true);
    expect(getByLabelText(/A · Drill/).checked).toBe(false);
  });
});
