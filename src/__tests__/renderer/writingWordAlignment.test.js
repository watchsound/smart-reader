import { align, tokenizeWords } from '../../renderer/views/writing/wordAlignment';

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

describe('align (Needleman–Wunsch — global)', () => {
  test('identical sentences yield all-match alignment of original length', () => {
    const out = align(
      'the cat sat on the mat',
      'the cat sat on the mat',
    );
    expect(out.alignedA).toHaveLength(6);
    expect(out.alignedB).toHaveLength(6);
    expect(out.alignedA.every((t) => t.match)).toBe(true);
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
    expect(out.alignedA[0].match).toBe(true);
    expect(out.alignedA[1].match).toBe(false);
    expect(out.alignedA[2].match).toBe(true);
  });

  test('insertion in B introduces a gap in A', () => {
    const out = align('the cat sat', 'the big cat sat');
    expect(out.alignedA).toHaveLength(4);
    expect(out.alignedB).toHaveLength(4);
    const gapIdx = out.alignedA.findIndex((t) => t.gap);
    expect(gapIdx).toBeGreaterThanOrEqual(0);
    expect(out.alignedB[gapIdx].word).toBe('big');
  });

  test('insertion in A introduces a gap in B', () => {
    const out = align('the big cat sat', 'the cat sat');
    const gapIdx = out.alignedB.findIndex((t) => t.gap);
    expect(gapIdx).toBeGreaterThanOrEqual(0);
    expect(out.alignedA[gapIdx].word).toBe('big');
  });

  test('disjoint texts are still fully aligned (mismatches all-around)', () => {
    // Unlike Smith–Waterman, NW does NOT bail out — it returns the best
    // global alignment, even if every position is a mismatch or a gap.
    const out = align('apple banana cherry', 'xyz uvw rst');
    expect(out.alignedA.length).toBeGreaterThanOrEqual(3);
    expect(out.alignedB.length).toBe(out.alignedA.length);
    // No position is a match.
    expect(out.alignedA.some((t) => t.match)).toBe(false);
  });

  test('every original word appears in alignedA (in order)', () => {
    const original = 'the quick brown fox jumps';
    const learner = 'a fast red animal leaped';
    const out = align(original, learner);
    const wordsInA = out.alignedA.filter((t) => !t.gap).map((t) => t.word);
    expect(wordsInA).toEqual(original.split(' '));
  });

  test('every learner word appears in alignedB (in order)', () => {
    const original = 'the cat sat';
    const learner = 'a brown cat sat down';
    const out = align(original, learner);
    const wordsInB = out.alignedB.filter((t) => !t.gap).map((t) => t.word);
    expect(wordsInB).toEqual(learner.split(' '));
  });

  test('returns word totals', () => {
    const out = align('a b c', 'a b c d e');
    expect(out.totalA).toBe(3);
    expect(out.totalB).toBe(5);
  });

  test('empty A: every B word appears with gaps in A', () => {
    const out = align('', 'one two three');
    expect(out.alignedA).toHaveLength(3);
    expect(out.alignedA.every((t) => t.gap)).toBe(true);
    expect(out.alignedB.map((t) => t.word)).toEqual(['one', 'two', 'three']);
  });

  test('empty B: every A word appears with gaps in B', () => {
    const out = align('one two three', '');
    expect(out.alignedB).toHaveLength(3);
    expect(out.alignedB.every((t) => t.gap)).toBe(true);
    expect(out.alignedA.map((t) => t.word)).toEqual(['one', 'two', 'three']);
  });

  test('both empty returns empty alignment', () => {
    expect(align('', '')).toEqual({
      alignedA: [],
      alignedB: [],
      score: 0,
      totalA: 0,
      totalB: 0,
    });
  });
});
