import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import WeaknessChip from '../../renderer/views/translate/WeaknessChip';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('WeaknessChip', () => {
  test('renders bucket label + reason + learner/model phrases', () => {
    const { getByText } = wrap(
      <WeaknessChip
        weakness={{
          bucket: 'tense',
          learner_text: 'has',
          model_text: 'there are',
          reason: 'Use existential there-are for 有.',
        }}
        onSave={() => {}}
      />,
    );
    expect(getByText(/TENSE & ASPECT/i)).toBeTruthy();
    expect(getByText(/Use existential there-are/)).toBeTruthy();
  });

  test('Save button triggers onSave with full weakness object', () => {
    const w = {
      bucket: 'article-number',
      learner_text: 'of library',
      model_text: 'of the library',
      reason: 'Add the definite article.',
    };
    const onSave = jest.fn();
    const { getByText } = wrap(<WeaknessChip weakness={w} onSave={onSave} />);
    fireEvent.click(getByText(/Save as LP/i));
    expect(onSave).toHaveBeenCalledWith(w);
  });

  test('after save, button shows "Saved" and is disabled', () => {
    const w = {
      bucket: 'word-order',
      learner_text: 'a',
      model_text: 'b',
      reason: 'r',
    };
    const { getByText } = wrap(<WeaknessChip weakness={w} onSave={() => {}} />);
    fireEvent.click(getByText(/Save as LP/i));
    expect(getByText(/Saved/i)).toBeTruthy();
  });
});
