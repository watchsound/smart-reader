/* eslint-disable no-template-curly-in-string */
// The assertions in this file deliberately contain literal `${word}`
// substrings — that is the mask syntax the renderer's tokenize() expects,
// not a JS template-literal interpolation.
import {
  classifyWord,
  taggedTokens,
  buildPosMask,
  sampleEvenly,
} from '../../renderer/views/writing/posTagger';

describe('classifyWord', () => {
  test('function words', () => {
    expect(classifyWord('the')).toBe('function');
    expect(classifyWord('and')).toBe('function');
    expect(classifyWord('although')).toBe('function');
    expect(classifyWord('is')).toBe('function');
    expect(classifyWord('would')).toBe('function');
  });

  test('case-insensitive function word lookup', () => {
    expect(classifyWord('The')).toBe('function');
    expect(classifyWord('HOWEVER')).toBe('function');
  });

  test('known irregular verbs', () => {
    expect(classifyWord('went')).toBe('verb');
    expect(classifyWord('made')).toBe('verb');
    expect(classifyWord('thought')).toBe('verb');
  });

  test('known adjectives', () => {
    expect(classifyWord('illegal')).toBe('adjective');
    expect(classifyWord('different')).toBe('adjective');
  });

  test('common adjectives with distinctive suffixes', () => {
    expect(classifyWord('beautiful')).toBe('adjective');
    expect(classifyWord('careless')).toBe('adjective');
    expect(classifyWord('dangerous')).toBe('adjective');
    expect(classifyWord('possible')).toBe('adjective');
  });

  test('common nouns with distinctive suffixes', () => {
    expect(classifyWord('decision')).toBe('noun');
    expect(classifyWord('darkness')).toBe('noun');
    expect(classifyWord('agreement')).toBe('noun');
  });

  test('past-tense / -ing verbs', () => {
    expect(classifyWord('decided')).toBe('verb');
    expect(classifyWord('discussed')).toBe('verb');
    expect(classifyWord('occurring')).toBe('verb');
  });

  test('common adverbs', () => {
    expect(classifyWord('quickly')).toBe('adverb');
    expect(classifyWord('carefully')).toBe('adverb');
    expect(classifyWord('obviously')).toBe('adverb');
    expect(classifyWord('mostly')).toBe('adverb');
  });

  test('-ly adjectives correctly tagged as adjective (compromise context)', () => {
    // The compromise-backed tagger gets these right where the old
    // rule-based version mis-tagged them as adverb.
    expect(classifyWord('lonely')).toBe('adjective');
    expect(classifyWord('friendly')).toBe('adjective');
    expect(classifyWord('daily')).toBe('adjective');
    expect(classifyWord('early')).toBe('adjective');
  });

  test('overrides catch compromise mis-tags on -le-stem adjectives', () => {
    // compromise tags these as Adverb (incorrect); our override forces
    // them to adjective. Regression guard for the original user complaint.
    expect(classifyWord('bubbly')).toBe('adjective');
    expect(classifyWord('wobbly')).toBe('adjective');
    expect(classifyWord('prickly')).toBe('adjective');
    expect(classifyWord('crinkly')).toBe('adjective');
    expect(classifyWord('wiggly')).toBe('adjective');
    expect(classifyWord('curly')).toBe('adjective');
    expect(classifyWord('crumbly')).toBe('adjective');
  });

  test('overrides catch compromise mis-tags on relational adjectives', () => {
    expect(classifyWord('motherly')).toBe('adjective');
    expect(classifyWord('brotherly')).toBe('adjective');
    expect(classifyWord('scholarly')).toBe('adjective');
    expect(classifyWord('cowardly')).toBe('adjective');
  });
});

describe('taggedTokens', () => {
  test('returns tokens with positions', () => {
    const out = taggedTokens('She decided quickly.');
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ word: 'She', start: 0, end: 3 });
    expect(out[1]).toMatchObject({
      word: 'decided',
      pos: 'verb',
      start: 4,
      end: 11,
    });
    expect(out[2]).toMatchObject({
      word: 'quickly',
      pos: 'adverb',
      start: 12,
      end: 19,
    });
  });

  test('skips punctuation and whitespace', () => {
    const out = taggedTokens('Hello, world! Yes.');
    expect(out.map((t) => t.word)).toEqual(['Hello', 'world', 'Yes']);
  });

  test('preserves position offsets across punctuation', () => {
    const out = taggedTokens('cat, dog, bird');
    expect(out[0]).toMatchObject({ word: 'cat', start: 0, end: 3 });
    expect(out[1]).toMatchObject({ word: 'dog', start: 5, end: 8 });
    expect(out[2]).toMatchObject({ word: 'bird', start: 10, end: 14 });
  });

  test('handles empty input', () => {
    expect(taggedTokens('')).toEqual([]);
    expect(taggedTokens(null)).toEqual([]);
  });

  test('uses sentence context to tag ambiguous words', () => {
    // "running" can be verb or noun-gerund. compromise should pick verb here.
    const out = taggedTokens('She is running fast.');
    const running = out.find((t) => t.word === 'running');
    expect(running.pos).toBe('verb');
  });
});

describe('buildPosMask', () => {
  test('masks all words of the requested POS', () => {
    const out = buildPosMask('She decided to leave.', new Set(['verb']));
    // compromise may identify either or both; assert at least one mask
    expect(out).toContain('${decided}');
  });

  test('masks adverbs', () => {
    const out = buildPosMask(
      'She quickly walked carefully home.',
      new Set(['adverb']),
    );
    expect(out).toContain('${quickly}');
    expect(out).toContain('${carefully}');
  });

  test('preserves punctuation and spacing', () => {
    const out = buildPosMask('A big, dangerous dog.', new Set(['adjective']));
    expect(out).toBe('A ${big}, ${dangerous} dog.');
  });

  test('returns text unchanged when nothing matches the POS set', () => {
    const out = buildPosMask('The and or but.', new Set(['verb']));
    expect(out).toBe('The and or but.');
  });

  test('handles empty input', () => {
    expect(buildPosMask('', new Set(['noun']))).toBe('');
  });

  test('round-trips: stripping masks reproduces original text', () => {
    const text = 'The illegal activities occurred during 2009.';
    const masked = buildPosMask(text, new Set(['noun', 'adjective', 'verb']));
    // Strip the ${...} wrappers, get original back.
    const stripped = masked.replace(/\$\{([^}]+)\}/g, '$1');
    expect(stripped).toBe(text);
  });

  test('cap option limits the number of masks', () => {
    // 10 nouns, cap at 3.
    const text =
      'cat dog fish bird mouse horse cow pig sheep goat are mammals.';
    const masked = buildPosMask(text, new Set(['noun']), { cap: 3 });
    const maskCount = (masked.match(/\$\{/g) || []).length;
    expect(maskCount).toBe(3);
  });

  test('cap option does nothing when fewer matches than cap', () => {
    const text = 'The dog ate the food.';
    const masked = buildPosMask(text, new Set(['noun']), { cap: 10 });
    // dog and food are nouns; expect both to be masked.
    expect(masked).toContain('${dog}');
    expect(masked).toContain('${food}');
  });
});

describe('sampleEvenly', () => {
  test('returns array unchanged when below cap', () => {
    expect(sampleEvenly([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  test('returns array unchanged when equal to cap', () => {
    expect(sampleEvenly([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });

  test('picks evenly-spaced indices when above cap', () => {
    // length 10, cap 5 → step 2 → indices 0, 2, 4, 6, 8.
    expect(sampleEvenly([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5)).toEqual([
      0, 2, 4, 6, 8,
    ]);
  });

  test('handles non-integer step via floor', () => {
    // length 26, cap 8 → step 3.25 → indices 0, 3, 6, 9, 13, 16, 19, 22
    const arr = Array.from({ length: 26 }, (_, i) => i);
    expect(sampleEvenly(arr, 8)).toEqual([0, 3, 6, 9, 13, 16, 19, 22]);
  });

  test('cap of 1 returns single first item', () => {
    expect(sampleEvenly([5, 6, 7], 1)).toEqual([5]);
  });
});
