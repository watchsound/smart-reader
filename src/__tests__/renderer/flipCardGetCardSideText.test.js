/**
 * Pure unit tests for FlipCard.getCardSideText — the helper that
 * extracts front/back text for non-note, non-vocab learning_points
 * (micro-cards from source_type='book', manual LPs, etc.).
 *
 * Defends against the bug we just fixed: FlipCard was passing the
 * learning_point UUID to NoteUI for these cards, which failed silently
 * and rendered blank. The fallback inline render path uses this helper
 * — if it returns empty for a real card shape, the blank card returns.
 *
 * @jest-environment node
 */

const { getCardSideText } = require('../../renderer/components/LeitnerSystem/FlipCard');

describe('getCardSideText', () => {
  it('reads card.cards[0].text for front', () => {
    const card = {
      cards: [{ text: 'What is a closure?' }, { text: 'Function + scope.' }],
    };
    expect(getCardSideText(card, 'front')).toBe('What is a closure?');
  });

  it('reads card.cards[1].text for back', () => {
    const card = {
      cards: [{ text: 'q' }, { text: 'Function + scope.' }],
    };
    expect(getCardSideText(card, 'back')).toBe('Function + scope.');
  });

  it('falls back to card.cards[i].html when text is missing', () => {
    const card = {
      cards: [{ html: '<p>front html</p>' }, { html: '<p>back html</p>' }],
    };
    expect(getCardSideText(card, 'front')).toBe('<p>front html</p>');
    expect(getCardSideText(card, 'back')).toBe('<p>back html</p>');
  });

  it('treats string-shaped cards array entries as raw text', () => {
    const card = { cards: ['just a string', 'another string'] };
    expect(getCardSideText(card, 'front')).toBe('just a string');
    expect(getCardSideText(card, 'back')).toBe('another string');
  });

  it('falls back to card.front / card.back objects when cards is empty', () => {
    const card = {
      front: { text: 'raw front' },
      back: { text: 'raw back' },
    };
    expect(getCardSideText(card, 'front')).toBe('raw front');
    expect(getCardSideText(card, 'back')).toBe('raw back');
  });

  it('falls back to string card.front / card.back', () => {
    const card = { front: 'simple string', back: 'back string' };
    expect(getCardSideText(card, 'front')).toBe('simple string');
    expect(getCardSideText(card, 'back')).toBe('back string');
  });

  it('returns empty string when nothing is present', () => {
    expect(getCardSideText({}, 'front')).toBe('');
    expect(getCardSideText({}, 'back')).toBe('');
  });

  it('handles null / undefined card safely', () => {
    expect(getCardSideText(null, 'front')).toBe('');
    expect(getCardSideText(undefined, 'back')).toBe('');
  });
});
