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
    expect(classifyWord('main')).toBe('adjective');
  });

  test('adjective suffixes', () => {
    expect(classifyWord('beautiful')).toBe('adjective');
    expect(classifyWord('careless')).toBe('adjective');
    expect(classifyWord('dangerous')).toBe('adjective');
    expect(classifyWord('creative')).toBe('adjective');
    expect(classifyWord('possible')).toBe('adjective');
    expect(classifyWord('feasible')).toBe('adjective');
  });

  test('noun suffixes', () => {
    expect(classifyWord('decision')).toBe('noun');
    expect(classifyWord('conflation')).toBe('noun');
    expect(classifyWord('darkness')).toBe('noun');
    expect(classifyWord('agreement')).toBe('noun');
    expect(classifyWord('community')).toBe('noun');
    expect(classifyWord('terrorism')).toBe('noun');
  });

  test('verb suffixes', () => {
    expect(classifyWord('decided')).toBe('verb');
    expect(classifyWord('discussed')).toBe('verb');
    expect(classifyWord('occurring')).toBe('verb');
  });

  test('unknown content words default to noun', () => {
    expect(classifyWord('xyzzy')).toBe('noun');
    expect(classifyWord('Freenet')).toBe('noun');
  });

  test('adverbs by -ly heuristic', () => {
    expect(classifyWord('quickly')).toBe('adverb');
    expect(classifyWord('carefully')).toBe('adverb');
    expect(classifyWord('obviously')).toBe('adverb');
    expect(classifyWord('happily')).toBe('adverb');
    expect(classifyWord('really')).toBe('adverb');
    expect(classifyWord('mostly')).toBe('adverb');
  });

  test('-ly false positives stay as noun', () => {
    expect(classifyWord('family')).toBe('noun');
    expect(classifyWord('jelly')).toBe('noun');
    expect(classifyWord('rally')).toBe('noun');
    expect(classifyWord('reply')).toBe('noun');
  });

  test('-ly adjectives in exclude set stay as noun (not adverb)', () => {
    // These are adjectives but our exclude set keeps them as the default
    // noun rather than mis-tagging adverb. Accepted tradeoff.
    expect(classifyWord('lonely')).toBe('noun');
    expect(classifyWord('friendly')).toBe('noun');
    expect(classifyWord('daily')).toBe('noun');
  });

  test('-ly words shorter than 5 chars default to noun (too ambiguous)', () => {
    expect(classifyWord('fly')).toBe('noun');
    expect(classifyWord('ugly')).toBe('noun');
  });

  test('known adjectives ending in -ly hit dict before adverb rule', () => {
    // `early` is in KNOWN_ADJECTIVES, so it short-circuits before
    // reaching the -ly adverb heuristic.
    expect(classifyWord('early')).toBe('adjective');
  });
});

describe('taggedTokens', () => {
  test('returns tokens with positions', () => {
    const out = taggedTokens('She decided quickly.');
    expect(out).toEqual([
      { word: 'She', pos: 'function', start: 0, end: 3 },
      { word: 'decided', pos: 'verb', start: 4, end: 11 },
      { word: 'quickly', pos: 'adverb', start: 12, end: 19 },
    ]);
  });

  test('skips punctuation and whitespace', () => {
    const out = taggedTokens('Hello, world! Yes.');
    expect(out.map((t) => t.word)).toEqual(['Hello', 'world', 'Yes']);
  });

  test('preserves position offsets across punctuation', () => {
    const out = taggedTokens('a, b, c');
    expect(out[0]).toMatchObject({ word: 'a', start: 0, end: 1 });
    expect(out[1]).toMatchObject({ word: 'b', start: 3, end: 4 });
    expect(out[2]).toMatchObject({ word: 'c', start: 6, end: 7 });
  });

  test('handles empty input', () => {
    expect(taggedTokens('')).toEqual([]);
    expect(taggedTokens(null)).toEqual([]);
  });
});

describe('buildPosMask', () => {
  test('masks all words of the requested POS', () => {
    const out = buildPosMask('She decided to leave.', new Set(['verb']));
    expect(out).toBe('She ${decided} to ${leave}.');
  });

  test('masks adverbs', () => {
    const out = buildPosMask(
      'She quickly walked carefully home.',
      new Set(['adverb']),
    );
    expect(out).toBe('She ${quickly} walked ${carefully} home.');
  });

  test('preserves punctuation and spacing', () => {
    const out = buildPosMask('A big, dangerous dog.', new Set(['adjective']));
    expect(out).toBe('A ${big}, ${dangerous} dog.');
  });

  test('multiple POS in one call', () => {
    const out = buildPosMask(
      'The dog ate the food.',
      new Set(['noun', 'verb']),
    );
    expect(out).toBe('The ${dog} ${ate} the ${food}.');
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
    const text = 'cat and dog.';
    const masked = buildPosMask(text, new Set(['noun']), { cap: 10 });
    expect(masked).toBe('${cat} and ${dog}.');
  });

  test('cap-sampled masks are spatially distributed (not clustered)', () => {
    // 12 distinct nouns, cap 4 → step 3 → indices 0, 3, 6, 9.
    const nouns = [
      'alpha',
      'bravo',
      'charlie',
      'delta',
      'echo',
      'foxtrot',
      'golf',
      'hotel',
      'india',
      'juliet',
      'kilo',
      'lima',
    ];
    const text = `${nouns.join(' ')}.`;
    const masked = buildPosMask(text, new Set(['noun']), { cap: 4 });
    // Expected masks at indices 0, 3, 6, 9: alpha, delta, golf, juliet.
    expect(masked).toContain('${alpha}');
    expect(masked).toContain('${delta}');
    expect(masked).toContain('${golf}');
    expect(masked).toContain('${juliet}');
    // bravo / charlie should NOT be masked (skipped by sampling).
    expect(masked).not.toContain('${bravo}');
    expect(masked).not.toContain('${charlie}');
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
    // length 26 (the user's noun count), cap 8 → step 3.25
    // floor(0*3.25)=0, floor(1*3.25)=3, floor(2*3.25)=6, floor(3*3.25)=9,
    // floor(4*3.25)=13, floor(5*3.25)=16, floor(6*3.25)=19, floor(7*3.25)=22
    const arr = Array.from({ length: 26 }, (_, i) => i);
    expect(sampleEvenly(arr, 8)).toEqual([0, 3, 6, 9, 13, 16, 19, 22]);
  });

  test('cap of 1 returns single first item', () => {
    expect(sampleEvenly([5, 6, 7], 1)).toEqual([5]);
  });
});
