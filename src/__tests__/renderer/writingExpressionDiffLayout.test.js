import {
  splitSentences,
  locateSpans,
  clipSpansToSlice,
} from '../../renderer/views/writing/expressionDiffLayout';

describe('splitSentences', () => {
  test('empty text returns empty array', () => {
    expect(splitSentences('')).toEqual([]);
  });

  test('text without terminal punctuation returns one chunk', () => {
    expect(splitSentences('hello world')).toEqual(['hello world']);
  });

  test('single terminated sentence returns one chunk including the period', () => {
    expect(splitSentences('She left.')).toEqual(['She left.']);
  });

  test('two sentences split with trailing whitespace on the first', () => {
    expect(splitSentences('She left. He stayed.')).toEqual([
      'She left. ',
      'He stayed.',
    ]);
  });

  test('multiple terminator characters keep the run together', () => {
    expect(splitSentences('Wait! Really?')).toEqual(['Wait! ', 'Really?']);
  });

  test('chunks fully partition the input — concatenation reproduces text', () => {
    const cases = [
      'e.g. for example, this is fine.',
      'Mr. Smith went home. He paid $3.14 for tea.',
      'Visit https://example.com. Then come back.',
      'No punctuation at all',
      'Trailing whitespace.   ',
      '   Leading whitespace.',
    ];
    cases.forEach((text) => {
      const out = splitSentences(text);
      expect(out.join('')).toBe(text);
    });
  });

  test('abbreviation does not drop characters', () => {
    // Previous regex dropped "e." from "e.g. example".
    const out = splitSentences('e.g. example');
    expect(out.join('')).toBe('e.g. example');
  });

  test('decimal numbers stay intact', () => {
    expect(splitSentences('The cost is $3.14.')).toEqual([
      'The cost is $3.14.',
    ]);
  });

  test('URL with periods stays intact', () => {
    expect(splitSentences('See https://a.b.com. Done.')).toEqual([
      'See https://a.b.com. ',
      'Done.',
    ]);
  });
});

describe('locateSpans', () => {
  test('locates non-overlapping spans by indexOf', () => {
    const text = 'She took a decision quickly.';
    const sideSpans = [
      {
        side: 'original',
        text: 'took a decision',
        kind: 'stronger',
        pair_id: 'p1',
      },
      { side: 'original', text: 'quickly', kind: 'weaker' },
    ];
    const out = locateSpans(text, sideSpans);
    expect(out).toEqual([
      { start: 4, end: 19, kind: 'stronger', pairId: 'p1' },
      { start: 20, end: 27, kind: 'weaker', pairId: null },
    ]);
  });

  test('drops spans whose text is not present in text', () => {
    const out = locateSpans('Hello world', [
      { text: 'missing', kind: 'weaker' },
    ]);
    expect(out).toEqual([]);
  });

  test('first-wins for overlapping spans', () => {
    const text = 'abcabc';
    const sideSpans = [
      { text: 'abc', kind: 'weaker' },
      { text: 'bca', kind: 'weaker' },
    ];
    const out = locateSpans(text, sideSpans);
    // First span occupies 0..3; second starts at 1 (overlap) → dropped.
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ start: 0, end: 3 });
  });
});

describe('clipSpansToSlice', () => {
  const spans = [
    { start: 3, end: 8, kind: 'weaker', pairId: 'p1' },
    { start: 12, end: 14, kind: 'grammar', pairId: null },
  ];

  test('drops spans wholly outside the window', () => {
    expect(clipSpansToSlice(spans, 20, 30)).toEqual([]);
  });

  test('keeps spans wholly inside the window unchanged', () => {
    const out = clipSpansToSlice(spans, 0, 20);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      effectiveStart: 3,
      effectiveEnd: 8,
      kind: 'weaker',
      pairId: 'p1',
    });
  });

  test('clips a span that straddles the right boundary', () => {
    // Span 3..8 with window 0..5 → effective 3..5.
    const out = clipSpansToSlice(spans, 0, 5);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ effectiveStart: 3, effectiveEnd: 5 });
  });

  test('clips a span that straddles the left boundary', () => {
    // Span 3..8 with window 5..15 → effective 5..8. Also includes span 12..14.
    const out = clipSpansToSlice(spans, 5, 15);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ effectiveStart: 5, effectiveEnd: 8 });
    expect(out[1]).toMatchObject({ effectiveStart: 12, effectiveEnd: 14 });
  });

  test('preserves pairId for hover linking after clip', () => {
    const out = clipSpansToSlice(spans, 0, 5);
    expect(out[0].pairId).toBe('p1');
  });
});
