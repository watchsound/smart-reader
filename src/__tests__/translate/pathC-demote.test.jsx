import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PathCLookupView from '../../renderer/views/translate/PathCLookupView';

const sampleSteps = {
  'step-1': { title: 'SVO', 'sub-verb-obj-list': [], explain: '' },
  'step-2': { title: 'Verbs', 'input-verb-list': [], explain: '' },
  'step-3': { title: 'Scaffold', 'scaffold-options': [], 'best-scaffold': '', explain: '' },
  'step-4': { title: 'Structure', 'sentence-structure': '', explain: '' },
  'step-5': { title: 'Final', output: 'There are books.', explain: '' },
};

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(async (prompt, schema, opts) => {
      if (opts.label === 'translate-quick') return sampleSteps;
      return null;
    }),
  },
}));

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('PathCLookupView', () => {
  test('headline result renders at top after auto-submit', async () => {
    const { getByTestId } = wrap(
      <PathCLookupView source="图书馆的二楼有很多书" language="Chinese" />,
    );
    await waitFor(() => {
      expect(getByTestId('path-c-headline').textContent).toContain('There are books.');
    });
  });

  test('clicking demote on step 3 calls onDemote(3)', async () => {
    const onDemote = jest.fn();
    const { findAllByText } = wrap(
      <PathCLookupView source="图书馆的二楼有很多书" language="Chinese" onDemote={onDemote} />,
    );
    const links = await findAllByText(/try this step yourself/i);
    fireEvent.click(links[2]);
    expect(onDemote).toHaveBeenCalledWith(3);
  });

  test('renders 5 step cards under the headline (no setInterval gating)', async () => {
    const { findByText } = wrap(
      <PathCLookupView source="x" language="Chinese" />,
    );
    expect(await findByText('SVO')).toBeTruthy();
    expect(await findByText('Verbs')).toBeTruthy();
    expect(await findByText('Scaffold')).toBeTruthy();
    expect(await findByText('Structure')).toBeTruthy();
    expect(await findByText('Final')).toBeTruthy();
  });
});
