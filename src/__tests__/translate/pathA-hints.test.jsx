import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(async (prompt, schema, opts) => {
      if (opts.label === 'translate-svo-hint') {
        return {
          clauses: [
            {
              role: 'main',
              connectorSource: '',
              connectorEnglishHints: [],
              subject: { source: '(implied)', english: 'there' },
              verb: { source: '有', english: 'are' },
              object: { source: '很多书', english: 'many books' },
              note: 'Existential locative — English needs a dummy "there".',
            },
            {
              role: 'relative',
              connectorSource: '的',
              connectorEnglishHints: ['of', 'on'],
              subject: { source: '二楼', english: 'the second floor' },
              verb: { source: '', english: 'is' },
              object: { source: '图书馆', english: 'of the library' },
              note: 'Use a prepositional phrase, not a relative clause.',
            },
          ],
          overallNote:
            'Existential main + locative postnominal — chain via "on the second floor of the library".',
        };
      }
      if (opts.label === 'translate-verb-options') {
        return {
          verbs: [
            {
              source: '有',
              english_glossary: 'to have / to exist',
              options: [
                {
                  english: 'there are',
                  usage: 'Existential locative.',
                  example: 'There are many books on the second floor.',
                  recommendedForThisSentence: true,
                },
                {
                  english: 'has',
                  usage: 'Possessive — owner subject only.',
                  example: 'The library has many books.',
                },
              ],
            },
          ],
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

  test('SVO reveal renders every clause with role labels (not just main)', async () => {
    const onHintsChange = jest.fn();
    const { getByText, findByText } = wrap(
      <ScaffoldRail
        source="图书馆的二楼有很多书"
        language="Chinese"
        onHintsChange={onHintsChange}
      />,
    );
    fireEvent.click(getByText(/Reveal SVO/i));
    // Main clause AND relative clause both surface — compound/complex sentences
    // were the user's #1 complaint about the old single-clause SVO.
    expect(await findByText(/主句 · main/)).toBeTruthy();
    expect(await findByText(/定语 · relative/)).toBeTruthy();
    expect(await findByText(/Existential locative/)).toBeTruthy();
    await waitFor(() => {
      expect(onHintsChange).toHaveBeenCalledWith(
        expect.objectContaining({ svo: true }),
      );
    });
  });

  test('Verb options reveal lists candidates with usage notes and a "best fit" tag', async () => {
    const onHintsChange = jest.fn();
    const { getByText, findByText, findAllByText } = wrap(
      <ScaffoldRail
        source="图书馆的二楼有很多书"
        language="Chinese"
        onHintsChange={onHintsChange}
      />,
    );
    fireEvent.click(getByText('Verb options'));
    // "there are" appears in two places (option label + example) — use AllByText.
    const matches = await findAllByText(/there are/i);
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(await findByText(/best fit here/i)).toBeTruthy();
    expect(await findByText(/Possessive — owner subject only/)).toBeTruthy();
    await waitFor(() => {
      expect(onHintsChange).toHaveBeenCalledWith(
        expect.objectContaining({ verbs: true }),
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
    await findByText(/主句 · main/);
    expect(spineApi.generateContentWithJson).toHaveBeenCalledWith(
      expect.any(String),
      null,
      expect.objectContaining({ label: 'translate-svo-hint' }),
    );
    fireEvent.click(getByText(/Verb options/i));
    await findByText(/there are/);
    expect(spineApi.generateContentWithJson).toHaveBeenCalledWith(
      expect.any(String),
      null,
      expect.objectContaining({ label: 'translate-verb-options' }),
    );
  });
});
