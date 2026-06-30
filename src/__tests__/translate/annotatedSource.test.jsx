import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  AnnotatedSource,
  buildHighlightRanges,
  ROLE_COLORS,
} from '../../renderer/views/translate/ScaffoldRail';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('buildHighlightRanges', () => {
  test('produces a non-overlapping span per S / V / O across multiple clauses', () => {
    const source = '虽然他很忙，他还是来了图书馆';
    const clauses = [
      {
        role: 'concession',
        connectorSource: '虽然',
        subject: { source: '他', english: 'he' },
        verb: { source: '很忙', english: 'is busy' },
        object: { source: '(none)', english: '' },
      },
      {
        role: 'main',
        connectorSource: '',
        subject: { source: '他', english: 'he' }, // same chars; second hit reserved
        verb: { source: '来了', english: 'came to' },
        object: { source: '图书馆', english: 'the library' },
      },
    ];
    const ranges = buildHighlightRanges(source, clauses);
    const labels = ranges.map((r) => ({
      text: source.slice(r.start, r.end),
      role: r.role,
      slot: r.slot,
    }));
    expect(labels).toEqual(
      expect.arrayContaining([
        { text: '虽然', role: 'concession', slot: 'connector' },
        { text: '他', role: 'concession', slot: 'subject' },
        { text: '很忙', role: 'concession', slot: 'verb' },
        { text: '来了', role: 'main', slot: 'verb' },
        { text: '图书馆', role: 'main', slot: 'object' },
      ]),
    );
    // No overlap — every range is strictly after the previous.
    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i].start).toBeGreaterThanOrEqual(ranges[i - 1].end);
    }
  });

  test('skips placeholder slot values like "(implied)" / "(none)" / ""', () => {
    const source = '下雨了';
    const ranges = buildHighlightRanges(source, [
      {
        role: 'main',
        connectorSource: '',
        subject: { source: '(implied)', english: 'it' },
        // The aspect particle 了 attaches to 下 in Chinese — use the
        // contiguous substring that actually appears in the source.
        verb: { source: '下', english: 'rained' },
        object: { source: '(none)', english: '' },
      },
    ]);
    expect(ranges).toHaveLength(1);
    expect(source.slice(ranges[0].start, ranges[0].end)).toBe('下');
  });

  test('paints distinct colors for different clause roles', () => {
    expect(ROLE_COLORS.main).not.toBe(ROLE_COLORS.relative);
    expect(ROLE_COLORS.cause).not.toBe(ROLE_COLORS.concession);
  });
});

describe('AnnotatedSource render', () => {
  test('renders the source text in full and highlights matched substrings', () => {
    const source = '他没去图书馆';
    const { container } = wrap(
      <AnnotatedSource
        source={source}
        clauses={[
          {
            role: 'main',
            connectorSource: '',
            subject: { source: '他', english: 'he' },
            verb: { source: '没去', english: "didn't go" },
            object: { source: '图书馆', english: 'the library' },
          },
        ]}
      />,
    );
    // Full source must still be present even though parts are wrapped.
    expect(container.textContent).toContain(source);
    // At least three highlight spans (S/V/O) — they render as <span>
    // descendants with a borderBottom style + role color.
    const styled = container.querySelectorAll('span');
    expect(styled.length).toBeGreaterThanOrEqual(3);
  });
});
