import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(async (prompt, schema, opts) => {
      if (opts.label === 'translate-compare') {
        return {
          modelEnglish:
            'There are many books on the second floor of the library.',
          spans: [
            {
              side: 'learner',
              text: 'has',
              bucket: 'tense',
              kind: 'weaker',
              pair_id: 'p1',
              reason: 'Use existential there-are for 有.',
            },
            {
              side: 'model',
              text: 'There are',
              bucket: 'tense',
              kind: 'weaker',
              pair_id: 'p1',
              reason: 'Use existential there-are for 有.',
            },
          ],
          stepBreakdown: {
            'step-1': { title: 'SVO', 'sub-verb-obj-list': [], explain: '' },
            'step-2': { title: 'Verbs', 'input-verb-list': [], explain: '' },
            'step-3': {
              title: 'Scaffold',
              'scaffold-options': [],
              'best-scaffold': '',
              explain: '',
            },
            'step-4': { title: 'Structure', 'sentence-structure': '', explain: '' },
            'step-5': {
              title: 'Final',
              output: 'There are many books on the second floor of the library.',
              explain: '',
            },
          },
        };
      }
      return null;
    }),
  },
}));

const createMock = jest.fn(async () => ({ id: 'lp-1' }));
jest.mock('../../renderer/api/learningPointApi', () => ({
  __esModule: true,
  default: { create: (...args) => createMock(...args) },
}));

// eslint-disable-next-line global-require
const PathADrillView = require('../../renderer/views/translate/PathADrillView').default;

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('PathADrillView', () => {
  beforeEach(() => {
    createMock.mockClear();
  });

  test('renders source and attempt textarea', () => {
    const { getByText, getByPlaceholderText } = wrap(
      <PathADrillView source="图书馆的二楼有很多书" language="Chinese" />,
    );
    expect(getByText(/图书馆的二楼有很多书/)).toBeTruthy();
    expect(getByPlaceholderText(/your english/i)).toBeTruthy();
  });

  test('Compare submit renders weakness chip with model phrase', async () => {
    const { getByPlaceholderText, getByText, findByText } = wrap(
      <PathADrillView source="图书馆的二楼有很多书" language="Chinese" />,
    );
    fireEvent.change(getByPlaceholderText(/your english/i), {
      target: { value: 'The library has books on second floor.' },
    });
    fireEvent.click(getByText(/^Compare$/));
    expect(await findByText(/TENSE & ASPECT/i)).toBeTruthy();
    expect(await findByText(/Use existential there-are/)).toBeTruthy();
  });

  test('Save-as-LP invokes learningPointApi.create with language extras + translate-drill surface', async () => {
    const { getByPlaceholderText, getByText, findByText } = wrap(
      <PathADrillView source="图书馆的二楼有很多书" language="Chinese" />,
    );
    fireEvent.change(getByPlaceholderText(/your english/i), {
      target: { value: 'The library has books on second floor.' },
    });
    fireEvent.click(getByText(/^Compare$/));
    const saveBtn = await findByText(/Save as LP/i);
    fireEvent.click(saveBtn);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const call = createMock.mock.calls[0][0];
    expect(call.domain).toBe('language');
    expect(call.featureSurface).toBe('translate-drill');
    expect(call.extras.bucket).toBe('tense');
    expect(call.extras.sourceLang).toBe('zh-Hans');
    expect(call.extras.targetLang).toBe('en-US');
    expect(call.extras.learnerAttempt).toBe('has');
    expect(call.extras.modelTarget).toBe('There are');
  });
});
