/**
 * srsHaloClassifier — pure-function tests.
 *
 * The classifier maps a learning_point row to one of three SRS halo states:
 *   - 'mastered' (knowledge accretion ✦)
 *   - 'foggy'    (forgetting fog, intensity ∈ [0,1])
 *   - 'learning' (default lexical halo from v1)
 *
 * Priority: mastered > foggy > learning. The same word never gets two states.
 *
 * @jest-environment node
 */

const { classify } = require('../../renderer/utils/srsHaloClassifier');

// Tests use a fixed "now" so overdue arithmetic is deterministic.
const NOW = Date.parse('2026-06-16T12:00:00Z');

describe('srsHaloClassifier.classify', () => {
  it('returns mastered for rows with fully_learned === 1', () => {
    const row = {
      title: 'serendipity',
      fullyLearned: 1,
      box: 5,
      nextReview: '2026-06-01', // overdue, but mastery wins
      intervalDays: 14,
    };
    const result = classify(row, NOW);
    expect(result).toEqual({
      word: 'serendipity',
      state: 'mastered',
      intensity: 0,
    });
  });

  it('returns foggy with intensity = overdueDays / intervalDays for overdue rows', () => {
    // 7 days overdue against a 14-day interval → intensity 0.5 (half-faded).
    // This formula is what makes the visual signal *meaningful*: the fog
    // deepens in proportion to how badly the user has neglected the word,
    // relative to its own interval (not a hardcoded calendar). A word that
    // graduated to box 5 (14-day interval) doesn't fog as fast as one in
    // box 1 (1-day interval) — same days-overdue, different urgency.
    const row = {
      title: 'lugubrious',
      fullyLearned: 0,
      box: 5,
      nextReview: '2026-06-09T12:00:00Z', // exactly 7 days before NOW
      intervalDays: 14,
    };
    const result = classify(row, NOW);
    expect(result.word).toBe('lugubrious');
    expect(result.state).toBe('foggy');
    expect(result.intensity).toBeCloseTo(0.5, 2);
  });

  it('returns learning when the row is in vocab but not yet due (next_review in the future)', () => {
    // The user added this word and is studying it on schedule. No fog yet,
    // no mastery yet — this is the v1 lexical-halo case and must keep the
    // same visual treatment so v1 readers don't see a regression.
    const row = {
      title: 'gossamer',
      fullyLearned: 0,
      box: 3,
      nextReview: '2026-06-20T12:00:00Z', // 4 days AFTER NOW
      intervalDays: 4,
    };
    const result = classify(row, NOW);
    expect(result).toEqual({
      word: 'gossamer',
      state: 'learning',
      intensity: 0,
    });
  });

  it('falls to learning state when nextReview is empty / unparseable', () => {
    // Brand-new vocab learning_points get nextReview = calculateNextReview(1),
    // but if anything upstream produces a null/empty value (legacy data, a
    // failed backfill, a future writer bug), the classifier MUST NOT crash
    // or produce NaN intensity — opacity = 1 - NaN * 0.6 = NaN, which
    // browsers render as fully-opaque OR transparent depending on the
    // engine. Safest default: treat as 'learning' (the harmless v1 halo).
    const row = {
      title: 'unscheduled',
      fullyLearned: 0,
      box: 1,
      nextReview: '',
      intervalDays: 1,
    };
    const result = classify(row, NOW);
    expect(result.state).toBe('learning');
    expect(result.intensity).toBe(0);
  });

  it('caps foggy intensity at 1.0 even when overdueDays >> intervalDays', () => {
    // Without a cap, a word abandoned for years against a 1-day interval
    // would produce intensity ≈ 1000. The renderer uses intensity to compute
    // CSS opacity (1 - intensity * 0.6); values above 1 would push opacity
    // negative and the word would vanish entirely. The cap is what makes
    // forgetting fog *graceful degradation* instead of "your saved words
    // start disappearing from the page."
    const row = {
      title: 'forsaken',
      fullyLearned: 0,
      box: 1,
      nextReview: '2020-01-01T00:00:00Z', // ~6.5 years before NOW
      intervalDays: 1,
    };
    const result = classify(row, NOW);
    expect(result.state).toBe('foggy');
    expect(result.intensity).toBe(1);
  });
});
