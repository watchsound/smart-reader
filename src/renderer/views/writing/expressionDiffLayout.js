// Pure layout helpers for the side-by-side expression diff.
//
// These were originally inlined in ExpressionDiffPanel.js; extracted so the
// regex-and-cursor-math logic is testable in isolation. Two real bugs in the
// inline version motivated the move:
//   1. Abbreviation/decimal sentences silently dropped characters because the
//      previous splitSentences regex did not partition the input.
//   2. Diff spans straddling a sentence boundary rendered their tail in the
//      first sentence AND again in the next, duplicating text on screen.

// Split `text` into sentence-sized chunks that together fully partition the
// input — every character of `text` lives in exactly one returned chunk.
// A boundary is `[.!?]+` followed by whitespace, OR end-of-string. Trailing
// text without terminal punctuation becomes its own final chunk.
export function splitSentences(text) {
  if (!text) return [];
  const out = [];
  const boundaryRe = /[.!?]+(?:\s+|$)/g;
  let start = 0;
  let m = boundaryRe.exec(text);
  while (m !== null) {
    const end = m.index + m[0].length;
    out.push(text.slice(start, end));
    start = end;
    m = boundaryRe.exec(text);
  }
  if (start < text.length) {
    out.push(text.slice(start));
  }
  if (out.length === 0) out.push(text);
  return out;
}

// Find non-overlapping span occurrences in `text`. Returns
// { start, end, kind, pairId } sorted by start, first-wins for overlap.
export function locateSpans(text, sideSpans) {
  const found = sideSpans.reduce((acc, s) => {
    const idx = text.indexOf(s.text);
    if (idx >= 0) {
      acc.push({
        start: idx,
        end: idx + s.text.length,
        kind: s.kind,
        pairId: s.pair_id || null,
      });
    }
    return acc;
  }, []);
  found.sort((a, b) => a.start - b.start);
  const out = [];
  let lastEnd = -1;
  found.forEach((f) => {
    if (f.start >= lastEnd) {
      out.push(f);
      lastEnd = f.end;
    }
  });
  return out;
}

// Return spans clipped to a [sliceStart, sliceEnd) window. A span that
// overlaps the window contributes a piece with effectiveStart/effectiveEnd
// inside [sliceStart, sliceEnd). Spans wholly outside the window are dropped.
// Order preserved (input is already sorted by start).
export function clipSpansToSlice(globalSpans, sliceStart, sliceEnd) {
  return globalSpans
    .filter((s) => s.end > sliceStart && s.start < sliceEnd)
    .map((s) => ({
      ...s,
      effectiveStart: Math.max(s.start, sliceStart),
      effectiveEnd: Math.min(s.end, sliceEnd),
    }));
}
