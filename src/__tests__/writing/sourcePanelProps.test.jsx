import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SourcePanel from '../../renderer/views/writing/SourcePanel';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('SourcePanel props extension', () => {
  test('defaults to "SOURCE PARAGRAPH" label (backwards compat)', () => {
    const { getByText } = wrap(
      <SourcePanel text="" onTextChange={() => {}} sourceLocked={false} accent="#0E8A8A" />,
    );
    expect(getByText('SOURCE PARAGRAPH')).toBeTruthy();
  });
  test('uses custom label when provided', () => {
    const { getByText } = wrap(
      <SourcePanel
        text=""
        onTextChange={() => {}}
        sourceLocked={false}
        accent="#0E8A8A"
        label="中文段落"
      />,
    );
    expect(getByText('中文段落')).toBeTruthy();
  });
  test('uses custom placeholder when provided', () => {
    const { container } = wrap(
      <SourcePanel
        text=""
        onTextChange={() => {}}
        sourceLocked={false}
        accent="#0E8A8A"
        placeholder="请粘贴一段中文..."
      />,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();
    expect(textarea.getAttribute('placeholder')).toBe('请粘贴一段中文...');
  });
  test('defaults to English placeholder when not provided (backwards compat)', () => {
    const { container } = wrap(
      <SourcePanel text="" onTextChange={() => {}} sourceLocked={false} accent="#0E8A8A" />,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea.getAttribute('placeholder')).toMatch(/Paste a paragraph/);
  });
});
