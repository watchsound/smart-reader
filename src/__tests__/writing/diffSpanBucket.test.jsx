import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import DiffSpan, { colorFor } from '../../renderer/views/writing/DiffSpan';
import { BUCKET_COLORS } from '../../renderer/views/translate/buckets';
import { DIFF_COLORS } from '../../renderer/views/writing/config';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('DiffSpan colorFor', () => {
  test('without bucket, returns DIFF_COLORS for the kind (backwards compat)', () => {
    expect(colorFor('weaker', null, 'light')).toBe(DIFF_COLORS.weaker.light);
    expect(colorFor('grammar', undefined, 'light')).toBe(DIFF_COLORS.grammar.light);
    expect(colorFor('match', null, 'dark')).toBe(DIFF_COLORS.match.dark);
  });
  test('with bucket, returns BUCKET_COLORS regardless of kind', () => {
    expect(colorFor('weaker', 'tense', 'light')).toBe(BUCKET_COLORS.tense.light);
    expect(colorFor('weaker', 'word-order', 'dark')).toBe(BUCKET_COLORS['word-order'].dark);
  });
  test('with unknown bucket, falls back to DIFF_COLORS', () => {
    expect(colorFor('weaker', 'bogus', 'light')).toBe(DIFF_COLORS.weaker.light);
  });
});

describe('DiffSpan rendering', () => {
  test('renders children with and without bucket prop without crashing', () => {
    const { container: c1 } = wrap(
      <DiffSpan kind="weaker" pairId="p1" hoveredPairId={null} onHoverPair={() => {}}>
        no-bucket
      </DiffSpan>,
    );
    const { container: c2 } = wrap(
      <DiffSpan kind="weaker" bucket="tense" pairId="p2" hoveredPairId={null} onHoverPair={() => {}}>
        with-bucket
      </DiffSpan>,
    );
    expect(c1.textContent).toBe('no-bucket');
    expect(c2.textContent).toBe('with-bucket');
  });
});
