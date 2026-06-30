import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
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
    // Reset spineApi mock state so leftover calls from a prior test in this
    // worker can't bleed in and cause act() commit-phase warnings.
    // eslint-disable-next-line global-require
    const spineApi = require('../../renderer/api/spineApi').default;
    if (spineApi?.generateContentWithJson?.mockClear) {
      spineApi.generateContentWithJson.mockClear();
    }
  });

  // Explicit cleanup between tests — testing-library auto-cleanup happens
  // by default but we await it so any setTimeout/promise leftover from the
  // last render has a chance to settle before the next render mounts.
  afterEach(async () => {
    cleanup();
    await new Promise((r) => setTimeout(r, 0));
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

  test('submit mounts the active path view (Path A SOURCE caption visible)', async () => {
    const { findAllByText, getAllByRole, getByLabelText } = wrap(<TranslateShell />);
    fireEvent.change(getAllByRole('textbox')[0], {
      target: { value: '图书馆有书' },
    });
    fireEvent.click(getByLabelText(/Translate/i));
    // PathADrillView renders a "SOURCE" caption above the source text.
    const sourceCaps = await findAllByText(/^SOURCE$/);
    expect(sourceCaps.length).toBeGreaterThan(0);
  });

  test('switching level resets the submitted view', async () => {
    const { findAllByText, queryByText, getAllByRole, getByLabelText } =
      wrap(<TranslateShell />);
    fireEvent.change(getAllByRole('textbox')[0], {
      target: { value: '图书馆有书' },
    });
    fireEvent.click(getByLabelText(/Translate/i));
    await findAllByText(/^SOURCE$/);
    fireEvent.click(getByLabelText(/B · Paragraph/));
    // Wait for the path-switch to fully settle before asserting absence.
    // Without the waitFor, an in-flight commit from the prior path
    // un-mount can race the assertion under parallel jest workers.
    await waitFor(() => {
      expect(queryByText(/^SOURCE$/)).toBeNull();
    });
  });
});
