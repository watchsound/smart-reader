import { align, tokenizeWords } from '../../renderer/views/writing/smithWaterman';

describe('tokenizeWords', () => {
  test('splits on whitespace', () => {
    expect(tokenizeWords('the quick brown fox')).toEqual([
      'the', 'quick', 'brown', 'fox',
    ]);
  });
  test('keeps punctuation attached to words', () => {
    expect(tokenizeWords('Hello, world!')).toEqual(['Hello,', 'world!']);
  });
  test('empty / null inputs return []', () => {
    expect(tokenizeWords('')).toEqual([]);
    expect(tokenizeWords(null)).toEqual([]);
  });
});

describe('align', () => {
  test('identical sentences yield all-match alignment', () => {
    const { alignedA, alignedB, score } = align(
      'the cat sat on the mat',
      'the cat sat on the mat',
    );
    expect(alignedA).toHaveLength(6);
    expect(alignedB).toHaveLength(6);
    expect(alignedA.every((t) => t.match)).toBe(true);
    expect(alignedB.every((t) => t.match)).toBe(true);
    expect(score).toBeGreaterThan(0);
  });

  test('case-insensitive matching', () => {
    const out = align('The Cat Sat', 'the cat sat');
    expect(out.alignedA.every((t) => t.match)).toBe(true);
  });

  test('trailing punctuation does not break the match', () => {
    const out = align('decision', 'decision,');
    expect(out.alignedA[0].match).toBe(true);
    expect(out.alignedB[0].match).toBe(true);
  });

  test('mismatched word in the middle stays in alignment', () => {
    const out = align('the cat sat', 'the dog sat');
    expect(out.alignedA).toHaveLength(3);
    expect(out.alignedB).toHaveLength(3);
    expect(out.alignedA[0].match).toBe(true);  // the
    expect(out.alignedA[1].match).toBe(false); // cat / dog mismatch
    expect(out.alignedA[2].match).toBe(true);  // sat
  });

  test('insertion in B introduces a gap in A', () => {
    const out = align('the cat sat', 'the big cat sat');
    // Aligned length 4. A has a gap where "big" sits.
    expect(out.alignedA).toHaveLength(4);
    expect(out.alignedB).toHaveLength(4);
    const gapPositions = out.alignedA
      .map((t, i) => (t.gap ? i : -1))
      .filter((x) => x >= 0);
    expect(gapPositions).toHaveLength(1);
    expect(out.alignedB[gapPositions[0]].word).toBe('big');
  });

  test('insertion in A introduces a gap in B', () => {
    const out = align('the big cat sat', 'the cat sat');
    const gapPositions = out.alignedB
      .map((t, i) => (t.gap ? i : -1))
      .filter((x) => x >= 0);
    expect(gapPositions).toHaveLength(1);
    expect(out.alignedA[gapPositions[0]].word).toBe('big');
  });

  test('completely disjoint texts return empty alignment (local!)', () => {
    // Smith-Waterman is LOCAL: with no matching words anywhere, traceback
    // stops at zero immediately.
    const out = align('apple banana cherry', 'xyz uvw rst');
    expect(out.alignedA).toEqual([]);
    expect(out.alignedB).toEqual([]);
    expect(out.score).toBe(0);
  });

  test('returns word totals for percentage display', () => {
    const out = align('a b c', 'a b c d e');
    expect(out.totalA).toBe(3);
    expect(out.totalB).toBe(5);
  });

  test('empty inputs return empty alignment without crash', () => {
    expect(align('', 'anything')).toEqual({
      alignedA: [],
      alignedB: [],
      score: 0,
      totalA: 0,
      totalB: 1,
    });
    expect(align(null, null).alignedA).toEqual([]);
  });
});
