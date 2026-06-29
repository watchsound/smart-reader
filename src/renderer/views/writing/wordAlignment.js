// Needleman–Wunsch global alignment on word sequences with NO
// SUBSTITUTIONS — only IDENTICAL words can share a column.
//
// Why no substitutions: in proper sequence alignment, two elements that
// happen to occupy the same column are considered EQUIVALENT at that
// position. For language learning, we want the eye to read each column
// as 'same word' — not 'different words that happen to align by virtue
// of being in the same position.' Mismatches therefore appear as
// adjacent gap-paired columns (A's word with gap below; gap above with
// B's word) rather than as a single substitution column.
//
// Scoring:
//   MATCH = +2  (only allowed diag step — requires actual equality)
//   GAP   = -1
//   Mismatch is disallowed: diag is set to -Infinity when the two words
//   don't match, forcing the algorithm to pick a gap step instead.
//
// Returns:
//   {
//     alignedA: [{ word, gap, match }],   // same length as alignedB
//     alignedB: [{ word, gap, match }],
//     score:    number,
//     totalA:   number,
//     totalB:   number,
//   }
// In the returned alignment, match===true iff neither side at that column
// is a gap AND the two words are equal (case + outer-punctuation
// insensitive). Non-matching pairs are split across two columns (a
// word-with-gap-below column adjacent to a gap-with-word-below column),
// so a non-gap cell whose counterpart IS a gap has match===false.

const MATCH = 2;
const GAP = -1;

export function tokenizeWords(text) {
  if (!text) return [];
  return (text.match(/\S+/g) || []).map((w) => w);
}

function normalize(w) {
  return (w || '').toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
}

function isEqualWord(a, b) {
  return normalize(a) === normalize(b);
}

// Diag step is allowed only when the two words are equal; otherwise
// -Infinity, so Math.max picks the gap path.
function diagScore(a, b) {
  return isEqualWord(a, b) ? MATCH : -Infinity;
}

export function align(textOrWordsA, textOrWordsB) {
  const wordsA = Array.isArray(textOrWordsA)
    ? textOrWordsA
    : tokenizeWords(textOrWordsA);
  const wordsB = Array.isArray(textOrWordsB)
    ? textOrWordsB
    : tokenizeWords(textOrWordsB);
  const m = wordsA.length;
  const n = wordsB.length;

  if (m === 0 && n === 0) {
    return { alignedA: [], alignedB: [], score: 0, totalA: 0, totalB: 0 };
  }
  if (m === 0) {
    return {
      alignedA: wordsB.map(() => ({ word: null, gap: true, match: false })),
      alignedB: wordsB.map((w) => ({ word: w, gap: false, match: false })),
      score: n * GAP,
      totalA: 0,
      totalB: n,
    };
  }
  if (n === 0) {
    return {
      alignedA: wordsA.map((w) => ({ word: w, gap: false, match: false })),
      alignedB: wordsA.map(() => ({ word: null, gap: true, match: false })),
      score: m * GAP,
      totalA: m,
      totalB: 0,
    };
  }

  // M[i][j] = best NW score aligning A[0..i-1] with B[0..j-1].
  // Linear gap penalty on the init borders.
  const M = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) M[i][0] = i * GAP;
  for (let j = 1; j <= n; j += 1) M[0][j] = j * GAP;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const diag =
        M[i - 1][j - 1] + diagScore(wordsA[i - 1], wordsB[j - 1]);
      const up = M[i - 1][j] + GAP; // gap in B
      const left = M[i][j - 1] + GAP; // gap in A
      M[i][j] = Math.max(diag, up, left);
    }
  }

  // Traceback from (m, n) to (0, 0). Prefer DIAG over equivalent gap
  // paths so the visual alignment keeps matches contiguous when possible.
  const alignedA = [];
  const alignedB = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      isEqualWord(wordsA[i - 1], wordsB[j - 1]) &&
      M[i][j] === M[i - 1][j - 1] + MATCH
    ) {
      // Diag step only taken when the words actually match.
      alignedA.unshift({ word: wordsA[i - 1], gap: false, match: true });
      alignedB.unshift({ word: wordsB[j - 1], gap: false, match: true });
      i -= 1;
      j -= 1;
    } else if (i > 0 && M[i][j] === M[i - 1][j] + GAP) {
      alignedA.unshift({ word: wordsA[i - 1], gap: false, match: false });
      alignedB.unshift({ word: null, gap: true, match: false });
      i -= 1;
    } else {
      alignedA.unshift({ word: null, gap: true, match: false });
      alignedB.unshift({ word: wordsB[j - 1], gap: false, match: false });
      j -= 1;
    }
  }

  return {
    alignedA,
    alignedB,
    score: M[m][n],
    totalA: m,
    totalB: n,
  };
}

export default { align, tokenizeWords };
