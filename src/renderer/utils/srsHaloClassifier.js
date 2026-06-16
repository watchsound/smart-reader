const MS_PER_DAY = 86_400_000;

// eslint-disable-next-line import/prefer-default-export
export const classify = (row, nowMs) => {
  if (row.fullyLearned === 1) {
    return { word: row.title, state: 'mastered', intensity: 0 };
  }
  const nextReviewMs = Date.parse(row.nextReview);
  // Explicit: an unparseable / empty nextReview falls to learning (intensity 0).
  // Comparing nowMs to NaN is also false, but relying on that is brittle to
  // future refactors. Guard the foggy branch on a finite parse result.
  if (Number.isFinite(nextReviewMs) && nowMs > nextReviewMs) {
    const overdueDays = (nowMs - nextReviewMs) / MS_PER_DAY;
    const intensity = Math.min(1, overdueDays / (row.intervalDays || 1));
    return { word: row.title, state: 'foggy', intensity };
  }
  return { word: row.title, state: 'learning', intensity: 0 };
};
