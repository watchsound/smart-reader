// Common short words that appear in nearly every paragraph — emitting
// them as claim/evidence would turn the page into colour noise.
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'as',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'has',
  'have',
  'had',
  'do',
  'does',
  'did',
  'not',
  'no',
  'so',
  'if',
  'than',
  'then',
]);

const MIN_LEN = 3;

const normalize = (raw) =>
  String(raw)
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, '')
    .trim();

const addPhraseWords = (phrase, state, seen, items) => {
  String(phrase || '')
    .split(/\s+/)
    .forEach((rawWord) => {
      const norm = normalize(rawWord);
      if (norm.length < MIN_LEN) return;
      if (STOPWORDS.has(norm)) return;
      if (seen.has(norm)) return;
      seen.add(norm);
      items.push({ word: norm, state, intensity: 0 });
    });
};

// eslint-disable-next-line import/prefer-default-export
export const classify = ({ claims = [], evidence = [] } = {}) => {
  const items = [];
  const seen = new Set();
  // Claims first so claim wins on collision (mutual exclusion).
  claims.forEach((c) => addPhraseWords(c, 'claim', seen, items));
  evidence.forEach((e) => addPhraseWords(e, 'evidence', seen, items));
  return items;
};
