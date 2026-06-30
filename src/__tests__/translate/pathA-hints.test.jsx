import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(async (prompt, schema, opts) => {
      if (opts.label === 'translate-svo-hint') {
        return {
          subject: { source: '二楼', english: 'the second floor' },
          verb: { source: '有', english: 'there are' },
          object: { source: '书', english: 'books' },
        };
      }
      if (opts.label === 'translate-tense-hint') {
        return {
          tense: 'simple-present',
          justification: 'Stative scene with no aspect marker.',
        };
      }
      return null;
    }),
  },
}));

// eslint-disable-next-line global-require
const ScaffoldRail = require('../../renderer/views/translate/ScaffoldRail').default;
const spineApi = require('../../renderer/api/spineApi').default;

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('ScaffoldRail', () => {
  beforeEach(() => {
    spineApi.generateContentWithJson.mockClear();
  });

  test('SVO reveal call records hint and shows english slots', async () => {
    const onHintsChange = jest.fn();
    const { getByText, findByText } = wrap(
      <ScaffoldRail
        source="图书馆的二楼有很多书"
        language="Chinese"
        onHintsChange={onHintsChange}
      />,
    );
    fireEvent.click(getByText(/Reveal SVO/i));
    await findByText(/the second floor/);
    await waitFor(() => {
      expect(onHintsChange).toHaveBeenCalledWith(
        expect.objectContaining({ svo: true }),
      );
    });
  });

  test('Tense hint call records hint and shows tense + justification', async () => {
    const onHintsChange = jest.fn();
    const { getByText, findByText } = wrap(
      <ScaffoldRail
        source="图书馆的二楼有很多书"
        language="Chinese"
        onHintsChange={onHintsChange}
      />,
    );
    fireEvent.click(getByText(/Tense hint/i));
    await findByText(/simple-present/);
    await waitFor(() => {
      expect(onHintsChange).toHaveBeenCalledWith(
        expect.objectContaining({ tense: true }),
      );
    });
  });

  test('uses the correct Spine intent labels', async () => {
    const { getByText, findByText } = wrap(
      <ScaffoldRail
        source="x"
        language="Chinese"
        onHintsChange={() => {}}
      />,
    );
    fireEvent.click(getByText(/Reveal SVO/i));
    await findByText(/the second floor/);
    expect(spineApi.generateContentWithJson).toHaveBeenCalledWith(
      expect.any(String),
      null,
      expect.objectContaining({ label: 'translate-svo-hint' }),
    );
  });
});
