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

  test('mismatched words appear as adjacent gap pairs (no substitution)', () => {
    // 'cat' vs 'dog' is NOT a same-column substitution — instead the
    // algorithm produces two adjacent columns:
    //   col i:   'cat' / —
    //   col i+1: —     / 'dog'
    // (order of cat-column vs dog-column may vary; both orderings are
    // equivalent under the scoring.)
    const out = align('the cat sat', 'the dog sat');
    expect(out.alignedA).toHaveLength(4);
    expect(out.alignedB).toHaveLength(4);
    expect(out.alignedA[0]).toMatchObject({ word: 'the', match: true });
    expect(out.alignedA[3]).toMatchObject({ word: 'sat', match: true });
    // Middle two columns: one has 'cat' with gap below, the other has gap above with 'dog'.
    const midA = [out.alignedA[1], out.alignedA[2]];
    const midB = [out.alignedB[1], out.alignedB[2]];
    expect(midA.filter((t) => t.word === 'cat')).toHaveLength(1);
    expect(midB.filter((t) => t.word === 'dog')).toHaveLength(1);
    expect(midA.filter((t) => t.gap)).toHaveLength(1);
    expect(midB.filter((t) => t.gap)).toHaveLength(1);
  });

  test('match=true ONLY when both sides at that column are equal', () => {
    // Invariant under no-substitution scoring: match=true iff neither
    // side is a gap AND the words are identical (no synonyms / no
    // mismatched-substitution columns). Disjoint inputs produce a
    // long alignment with zero matches.
    const out = align(
      'the quick brown fox',
      'a fast red animal',
    );
    out.alignedA.forEach((t, i) => {
      const b = out.alignedB[i];
      if (t.match) {
        expect(t.gap).toBe(false);
        expect(b.gap).toBe(false);
        expect(t.word).toBeTruthy();
        expect(b.word).toBeTruthy();
      }
    });
    // No shared word → no matches at all.
    expect(out.alignedA.some((t) => t.match)).toBe(false);
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

  test('disjoint texts: every A word and every B word appears, all gap-paired', () => {
    // Under no-substitution scoring, no two non-matching words share a
    // column. Disjoint inputs (no shared word at all) produce an
    // alignment of length m + n, with each A-word column gap-paired
    // and each B-word column gap-paired.
    const out = align('apple banana cherry', 'xyz uvw rst');
    expect(out.alignedA).toHaveLength(6);
    expect(out.alignedB).toHaveLength(6);
    // No matches.
    expect(out.alignedA.some((t) => t.match)).toBe(false);
    // Every original word appears in A (with gap in B alongside).
    const wordsInA = out.alignedA.filter((t) => !t.gap).map((t) => t.word);
    expect(wordsInA).toEqual(['apple', 'banana', 'cherry']);
    const wordsInB = out.alignedB.filter((t) => !t.gap).map((t) => t.word);
    expect(wordsInB).toEqual(['xyz', 'uvw', 'rst']);
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
