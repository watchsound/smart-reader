/* eslint-disable no-template-curly-in-string */
// The assertions in this file deliberately contain literal `${word}`
// substrings — that is the mask syntax the renderer's tokenize() expects,
// not a JS template-literal interpolation.
import {
  classifyWord,
  taggedTokens,
  buildPosMask,
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
});

describe('taggedTokens', () => {
  test('returns tokens with positions', () => {
    const out = taggedTokens('She decided quickly.');
    expect(out).toEqual([
      { word: 'She', pos: 'function', start: 0, end: 3 },
      { word: 'decided', pos: 'verb', start: 4, end: 11 },
      { word: 'quickly', pos: 'noun', start: 12, end: 19 },
      // "quickly" ends in -ly which is usually adverb, but our tagger has no
      // -ly rule; -ly word defaults to noun. Acceptable for v1.
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
});
