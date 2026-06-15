/**
 * Cross-process consistency check. The MicroCardChip (renderer) looks up
 * paragraph DOM elements by the same hash MicroCardProposer (main) embeds
 * in the proposal payload; if they ever drift, the chip silently loses
 * paragraph anchoring and falls back to bottom-right floating.
 */

const { hashParagraph } = require('../../commons/brain/paragraphHash');
const {
  hashParagraph: hashFromProposer,
} = require('../../main/utils/MicroCardProposer');

describe('paragraphHash', () => {
  test('is deterministic for the same input', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    expect(hashParagraph(text)).toBe(hashParagraph(text));
  });

  test('produces different hashes for different inputs', () => {
    expect(hashParagraph('one')).not.toBe(hashParagraph('two'));
  });

  test('normalizes leading/trailing whitespace', () => {
    expect(hashParagraph('hello world')).toBe(hashParagraph('  hello world\n'));
  });

  test('handles empty / null input without throwing', () => {
    expect(hashParagraph('')).toBe(hashParagraph(null));
    expect(hashParagraph(undefined)).toBe(hashParagraph(''));
  });

  test('matches the hash re-exported by MicroCardProposer', () => {
    const samples = [
      'a',
      'The quick brown fox jumps over the lazy dog.',
      '一二三四五六七八九十',
      'Paragraph with\nlinebreaks and  multiple   spaces.',
    ];
    samples.forEach((s) => {
      expect(hashFromProposer(s)).toBe(hashParagraph(s));
    });
  });
});
