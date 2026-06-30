import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(async (prompt, schema, opts) => {
      if (opts.label === 'writing-5w-scaffold') {
        return {
          data: [
            {
              sentenceIndex: 0,
              who: 'library',
              what: 'has books',
              when: '',
              where: 'second floor',
              why: '',
            },
          ],
        };
      }
      if (opts.label === 'translate-paragraph-compare') {
        return {
          modelEnglish: 'There are many books on the second floor.',
          spans: [],
          sentenceComparisons: [],
        };
      }
      return null;
    }),
  },
}));

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('PathBParagraphView reuse boundary', () => {
  test('imports SourcePanel + FiveWRail + ExpressionDiffPanel from /writing', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../renderer/views/translate/PathBParagraphView.jsx',
      ),
      'utf8',
    );
    expect(src).toMatch(/from ['"]\.\.\/writing\/SourcePanel['"]/);
    expect(src).toMatch(/from ['"]\.\.\/writing\/FiveWRail['"]/);
    expect(src).toMatch(/from ['"]\.\.\/writing\/ExpressionDiffPanel['"]/);
  });

  test('renders source paragraph and 5W rail header', async () => {
    // eslint-disable-next-line global-require
    const PathBParagraphView = require('../../renderer/views/translate/PathBParagraphView').default;
    const { container, findByText } = wrap(
      <PathBParagraphView
        source="图书馆的二楼有很多书。学生们来这里学习。"
        language="Chinese"
      />,
    );
    expect(container.textContent).toMatch(/图书馆的二楼有很多书/);
    expect(await findByText(/SCENE \(5W\)/)).toBeTruthy();
  });
});
