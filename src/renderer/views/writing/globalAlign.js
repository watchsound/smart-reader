/* eslint-disable prettier/prettier */
export default function globalAlign(paragraph1, paragraph2) {
  const words1 = ['', ...paragraph1.split(/\s+/)];
  const words2 = ['', ...paragraph2.split(/\s+/)];
  const n = words1.length;
  const m = words2.length;
  const scoreMatrix = Array.from({ length: n }, () => Array(m).fill(0));

  // Initialize the scoring matrix
  for (let i = 1; i < n; i++) {
    scoreMatrix[i][0] = i * -1; // Penalty for deletions
  }
  for (let j = 1; j < m; j++) {
    scoreMatrix[0][j] = j * -1; // Penalty for insertions
  }

  // Fill the matrix
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const matchScore = words1[i] === words2[j] ? 1 : -1;
      const match = scoreMatrix[i - 1][j - 1] + matchScore;
      const deleteWord = scoreMatrix[i - 1][j] - 1; // Penalty for deletions
      const insertWord = scoreMatrix[i][j - 1] - 1; // Penalty for insertions
      scoreMatrix[i][j] = Math.max(match, deleteWord, insertWord);
    }
  }

  // Traceback to find the alignment
  const alignment = [];
  let i = n - 1;
  let j = m - 1;

  while (i > 0 && j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      scoreMatrix[i][j] ===
        scoreMatrix[i - 1][j - 1] + (words1[i] === words2[j] ? 1 : -1)
    ) {
      alignment.unshift({
        word1: words1[i],
        word2: words2[j],
        match: words1[i] === words2[j],
      });
      i--;
      j--;
    } else if (i > 0 && scoreMatrix[i][j] === scoreMatrix[i - 1][j] - 1) {
      alignment.unshift({ word1: words1[i], word2: '', match: false });
      i--;
    } else {
      alignment.unshift({ word1: '', word2: words2[j], match: false });
      j--;
    }
  }

  // Handle any remaining words
  while (i > 0) {
    alignment.unshift({ word1: words1[i], word2: '', match: false });
    i--;
  }
  while (j > 0) {
    alignment.unshift({ word1: '', word2: words2[j], match: false });
    j--;
  }

  return { score: scoreMatrix[n - 1][m - 1], alignment };
}
