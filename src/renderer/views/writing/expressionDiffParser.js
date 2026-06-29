export const VALID_SIDES = new Set(['learner', 'original']);
export const VALID_KINDS = new Set(['match', 'weaker', 'stronger', 'grammar']);

export function parseExpressionDiff(input) {
  let obj = input;
  if (typeof obj === 'string') {
    obj = JSON.parse(obj);
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error(`parseExpressionDiff: expected object, got ${typeof obj}`);
  }

  const rawSpans = Array.isArray(obj.spans) ? obj.spans : [];
  const spans = rawSpans.filter(
    (s) =>
      s &&
      typeof s.text === 'string' &&
      VALID_SIDES.has(s.side) &&
      VALID_KINDS.has(s.kind),
  );

  // Sentence-grouped comparisons (new shape). Each entry pairs an original
  // sentence with the learner's corresponding sentence and lists the notes
  // explaining the expression upgrades for THAT pair.
  const rawSentenceComps = Array.isArray(obj.sentenceComparisons)
    ? obj.sentenceComparisons
    : [];
  const sentenceComparisons = rawSentenceComps
    .filter(
      (sc) =>
        sc &&
        typeof sc.originalSentence === 'string' &&
        typeof sc.learnerSentence === 'string',
    )
    .map((sc) => ({
      sentenceIndex:
        typeof sc.sentenceIndex === 'number' ? sc.sentenceIndex : null,
      originalSentence: sc.originalSentence,
      learnerSentence: sc.learnerSentence,
      notes: Array.isArray(sc.notes)
        ? sc.notes.filter(
            (n) =>
              n &&
              typeof n.pair_id === 'string' &&
              typeof n.learner_phrase === 'string' &&
              typeof n.original_phrase === 'string' &&
              typeof n.explanation === 'string',
          )
        : [],
    }));

  // Legacy flat notes — kept for backwards compatibility with older
  // responses that haven't migrated to the sentence-grouped shape.
  const rawNotes = Array.isArray(obj.notes) ? obj.notes : [];
  const notes = rawNotes.filter(
    (n) =>
      n &&
      typeof n.pair_id === 'string' &&
      typeof n.learner_phrase === 'string' &&
      typeof n.original_phrase === 'string' &&
      typeof n.explanation === 'string',
  );

  return { spans, sentenceComparisons, notes };
}

export default { parseExpressionDiff, VALID_SIDES, VALID_KINDS };
