import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import DiffSpansRenderer from '../../renderer/views/translate/DiffSpansRenderer';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('DiffSpansRenderer', () => {
  const learnerText = 'The library has many books on second floor.';
  const modelText = 'There are many books on the second floor of the library.';
  const spans = [
    { side: 'learner', text: 'has', bucket: 'tense', kind: 'weaker', pair_id: 'p1', reason: '...' },
    { side: 'model', text: 'There are', bucket: 'tense', kind: 'weaker', pair_id: 'p1', reason: '...' },
    {
      side: 'learner',
      text: 'on second floor',
      bucket: 'article-number',
      kind: 'weaker',
      pair_id: 'p2',
      reason: '...',
    },
    {
      side: 'model',
      text: 'on the second floor',
      bucket: 'article-number',
      kind: 'weaker',
      pair_id: 'p2',
      reason: '...',
    },
  ];

  test('renders both sides with their full text', () => {
    const { container, getByText } = wrap(
      <DiffSpansRenderer learnerText={learnerText} modelText={modelText} spans={spans} />,
    );
    expect(container.textContent).toContain('The library has many books');
    expect(container.textContent).toContain('There are many books');
    expect(getByText(/YOUR ENGLISH/i)).toBeTruthy();
    expect(getByText(/MODEL ENGLISH/i)).toBeTruthy();
  });

  test('renders no spans gracefully', () => {
    const { container } = wrap(
      <DiffSpansRenderer learnerText="a" modelText="b" spans={[]} />,
    );
    expect(container.textContent).toContain('a');
    expect(container.textContent).toContain('b');
  });
});
