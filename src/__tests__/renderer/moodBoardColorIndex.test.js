/**
 * Regression test for getColorIndex receiving a numeric SQLite id.
 *
 * Root cause: mood_board.id is INTEGER AUTOINCREMENT → JS number.
 * (number).length === undefined, so the hash loop never ran → always returned 0
 * (green) for every board.
 */
import { getColorIndex } from '../../renderer/views/moodboard/MoodBoardItemCard';

describe('getColorIndex', () => {
  const PALETTE_SIZE = 10; // CARD_COLORS.length

  it('returns 0 for falsy inputs', () => {
    expect(getColorIndex(null)).toBe(0);
    expect(getColorIndex(undefined)).toBe(0);
    expect(getColorIndex('')).toBe(0);
  });

  it('returns a value in [0, PALETTE_SIZE) for a numeric id', () => {
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const idx = getColorIndex(id);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(PALETTE_SIZE);
    }
  });

  it('produces different indices for different numeric ids (boards get distinct colors)', () => {
    const indices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(getColorIndex);
    // At least 3 distinct values among 10 boards; with a good hash most will differ
    const unique = new Set(indices);
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });

  it('is consistent — same input always returns same index', () => {
    expect(getColorIndex(42)).toBe(getColorIndex(42));
    expect(getColorIndex('my board')).toBe(getColorIndex('my board'));
  });

  it('string and numeric representations of the same id return the same index', () => {
    expect(getColorIndex(7)).toBe(getColorIndex('7'));
    expect(getColorIndex(123)).toBe(getColorIndex('123'));
  });
});
