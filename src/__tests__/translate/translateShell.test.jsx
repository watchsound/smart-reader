import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock customStorage BEFORE the shell imports it.
const _store = {};
jest.mock('../../renderer/store/customStorage', () => ({
  __esModule: true,
  default: {
    getTranslateLevel: () => _store.level || 'A',
    setTranslateLevel: (l) => {
      _store.level = l;
    },
    getTranslateHistory: () => _store.history || [],
    appendTranslateHistory: (e) => {
      _store.history = [e, ...(_store.history || [])].slice(0, 30);
    },
  },
}));

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: { generateContentWithJson: jest.fn(async () => null) },
}));

// eslint-disable-next-line global-require
const TranslateShell = require('../../renderer/views/translate/TranslateShell').default;

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('TranslateShell', () => {
  beforeEach(() => {
    Object.keys(_store).forEach((k) => delete _store[k]);
  });

  test('defaults to level A on first mount', () => {
    const { getByLabelText } = wrap(<TranslateShell />);
    expect(getByLabelText(/A · Drill/).checked).toBe(true);
  });

  test('level change persists via customStorage', () => {
    const { getByLabelText } = wrap(<TranslateShell />);
    fireEvent.click(getByLabelText(/C · Lookup/));
    expect(_store.level).toBe('C');
  });

  test('submit appends to history with level and source text', async () => {
    const { getAllByRole, getByLabelText } = wrap(<TranslateShell />);
    const textarea = getAllByRole('textbox')[0];
    fireEvent.change(textarea, { target: { value: '图书馆有书' } });
    const sendBtn = getByLabelText(/Translate/i);
    fireEvent.click(sendBtn);
    await waitFor(() => {
      expect(_store.history?.length).toBe(1);
      expect(_store.history[0].sourceText).toBe('图书馆有书');
      expect(_store.history[0].level).toBe('A');
    });
  });

  test('submit mounts the active path view (stub testid for A)', async () => {
    const { findByTestId, getAllByRole, getByLabelText } = wrap(<TranslateShell />);
    fireEvent.change(getAllByRole('textbox')[0], {
      target: { value: '图书馆有书' },
    });
    fireEvent.click(getByLabelText(/Translate/i));
    expect(await findByTestId('path-a-stub')).toBeTruthy();
  });

  test('switching level resets the submitted view', async () => {
    const { findByTestId, getAllByRole, getByLabelText, queryByTestId } = wrap(<TranslateShell />);
    fireEvent.change(getAllByRole('textbox')[0], {
      target: { value: '图书馆有书' },
    });
    fireEvent.click(getByLabelText(/Translate/i));
    await findByTestId('path-a-stub');
    fireEvent.click(getByLabelText(/B · Paragraph/));
    expect(queryByTestId('path-a-stub')).toBeNull();
    expect(queryByTestId('path-b-stub')).toBeNull();
  });
});
