// Needleman–Wunsch global alignment on word sequences.
//
// Aligns the FULL original paragraph against the FULL learner paragraph,
// so every word from both sequences appears in the rendered alignment
// (with gaps where one side has nothing matching). This matches the
// bioinformatics convention: an end-to-end alignment with insertions /
// deletions shown as gaps, not a trimmed local match.
//
// Scoring:
//   MATCH = +2, MISMATCH = -1, GAP = -1
// NW (unlike Smith-Waterman) disallows the `max(0, …)` reset and always
// traces from M[m][n] to M[0][0], so the entire input is consumed.
//
// Returns:
//   {
//     alignedA: [{ word, gap, match }],   // same length as alignedB
//     alignedB: [{ word, gap, match }],
//     score:    number,                   // NW score
//     totalA:   number,                   // original word counts
//     totalB:   number,
//   }

const MATCH = 2;
const MISMATCH = -1;
const GAP = -1;

export function tokenizeWords(text) {
  if (!text) return [];
  return (text.match(/\S+/g) || []).map((w) => w);
}

function normalize(w) {
  return (w || '').toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
}

function scoreCell(a, b) {
  return normalize(a) === normalize(b) ? MATCH : MISMATCH;
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
      const diag = M[i - 1][j - 1] + scoreCell(wordsA[i - 1], wordsB[j - 1]);
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
      M[i][j] === M[i - 1][j - 1] + scoreCell(wordsA[i - 1], wordsB[j - 1])
    ) {
      const isMatch = normalize(wordsA[i - 1]) === normalize(wordsB[j - 1]);
      alignedA.unshift({ word: wordsA[i - 1], gap: false, match: isMatch });
      alignedB.unshift({ word: wordsB[j - 1], gap: false, match: isMatch });
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
