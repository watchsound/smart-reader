import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TranslateHistoryList from '../../renderer/views/translate/TranslateHistoryList';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('TranslateHistoryList', () => {
  test('renders entries with source text + level chip', () => {
    const entries = [
      { id: '1', sourceText: '图书馆的二楼有很多书', level: 'A', sourceLanguage: 'Chinese', timestamp: 1 },
      { id: '2', sourceText: '他昨天去了图书馆', level: 'C', sourceLanguage: 'Chinese', timestamp: 2 },
    ];
    const { getByText } = wrap(<TranslateHistoryList entries={entries} onSelect={() => {}} />);
    expect(getByText('图书馆的二楼有很多书')).toBeTruthy();
    expect(getByText('他昨天去了图书馆')).toBeTruthy();
  });

  test('calls onSelect with the clicked entry', () => {
    const entries = [
      { id: '1', sourceText: 'hello', level: 'A', sourceLanguage: 'Chinese', timestamp: 1 },
    ];
    const onSelect = jest.fn();
    const { getByText } = wrap(<TranslateHistoryList entries={entries} onSelect={onSelect} />);
    fireEvent.click(getByText('hello'));
    expect(onSelect).toHaveBeenCalledWith(entries[0]);
  });

  test('empty list shows "No recent translations"', () => {
    const { getByText } = wrap(<TranslateHistoryList entries={[]} onSelect={() => {}} />);
    expect(getByText(/no recent translations/i)).toBeTruthy();
  });
});
