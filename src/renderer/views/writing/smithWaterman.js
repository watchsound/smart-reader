// Smith–Waterman local alignment on word sequences.
//
// Given two strings (typically the original paragraph and the learner's
// re-expression), tokenize each into words and find the best-scoring local
// alignment. Match / mismatch / gap penalties are tuned for natural-language
// word matching: matches give meaningful reward, mismatches small penalty,
// gaps a slightly larger penalty so the algorithm prefers paraphrases of
// equal length over heavily inserted/deleted regions.
//
// Returns:
//   {
//     alignedA: [{ word, gap, match }],   // same length as alignedB
//     alignedB: [{ word, gap, match }],
//     score:    number,                   // SW max score
//     totalA:   number,                   // word counts of inputs (for %)
//     totalB:   number,
//   }
//
// gap === true → this slot is a `—` gap, no real word in that side
// match === true → exact case-insensitive word match between A[i] and B[i]

// Tuned for natural-language word matching: a single gap should not
// reset the alignment to zero across a paraphrase's incidental
// insertions/deletions. GAP = -1 lets a one-word insertion survive
// the SW recurrence; GAP = -2 was too aggressive and collapsed
// alignment around any inserted word.
const MATCH = 2;
const MISMATCH = -1;
const GAP = -1;

export function tokenizeWords(text) {
  if (!text) return [];
  // Match runs of non-whitespace, then strip outer punctuation so
  // "decision," compares equal to "decision".
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
  if (m === 0 || n === 0) {
    return {
      alignedA: [],
      alignedB: [],
      score: 0,
      totalA: m,
      totalB: n,
    };
  }

  // H[i][j] = best alignment score ending at A[i-1], B[j-1]
  const H = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  // ptr[i][j] = which neighbor we came from: 'D' diag, 'U' up, 'L' left, 'S' start
  const ptr = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill('S'),
  );

  let maxI = 0;
  let maxJ = 0;
  let maxScore = 0;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const diag = H[i - 1][j - 1] + scoreCell(wordsA[i - 1], wordsB[j - 1]);
      const up = H[i - 1][j] + GAP;
      const left = H[i][j - 1] + GAP;
      const best = Math.max(0, diag, up, left);
      H[i][j] = best;
      if (best === 0) {
        ptr[i][j] = 'S';
      } else if (best === diag) {
        ptr[i][j] = 'D';
      } else if (best === up) {
        ptr[i][j] = 'U';
      } else {
        ptr[i][j] = 'L';
      }
      if (best > maxScore) {
        maxScore = best;
        maxI = i;
        maxJ = j;
      }
    }
  }

  // Traceback from (maxI, maxJ) until H drops to 0.
  const alignedA = [];
  const alignedB = [];
  let i = maxI;
  let j = maxJ;
  while (i > 0 && j > 0 && H[i][j] > 0) {
    const dir = ptr[i][j];
    if (dir === 'D') {
      const isMatch = normalize(wordsA[i - 1]) === normalize(wordsB[j - 1]);
      alignedA.unshift({ word: wordsA[i - 1], gap: false, match: isMatch });
      alignedB.unshift({ word: wordsB[j - 1], gap: false, match: isMatch });
      i -= 1;
      j -= 1;
    } else if (dir === 'U') {
      alignedA.unshift({ word: wordsA[i - 1], gap: false, match: false });
      alignedB.unshift({ word: null, gap: true, match: false });
      i -= 1;
    } else if (dir === 'L') {
      alignedA.unshift({ word: null, gap: true, match: false });
      alignedB.unshift({ word: wordsB[j - 1], gap: false, match: false });
      j -= 1;
    } else {
      break;
    }
  }

  return {
    alignedA,
    alignedB,
    score: maxScore,
    totalA: m,
    totalB: n,
  };
}

export default { align, tokenizeWords };
