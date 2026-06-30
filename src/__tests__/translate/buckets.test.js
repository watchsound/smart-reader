import {
  BUCKETS,
  BUCKET_LABELS,
  BUCKET_COLORS,
  isValidBucket,
} from '../../renderer/views/translate/buckets';

describe('Weakness Buckets', () => {
  test('exactly 6 closed values', () => {
    expect(BUCKETS).toEqual([
      'tense',
      'word-order',
      'article-number',
      'preposition-collocation',
      'connector-cohesion',
      'idiom-register',
    ]);
  });
  test('each bucket has a display label', () => {
    BUCKETS.forEach((b) => {
      expect(BUCKET_LABELS[b]).toBeTruthy();
    });
  });
  test('each bucket has light+dark colors', () => {
    BUCKETS.forEach((b) => {
      expect(BUCKET_COLORS[b].light).toMatch(/^#[0-9A-F]{6}$/i);
      expect(BUCKET_COLORS[b].dark).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
  test('isValidBucket guards', () => {
    expect(isValidBucket('tense')).toBe(true);
    expect(isValidBucket('grammar')).toBe(false);
  });
});
