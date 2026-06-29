// POS tagger backed by the `compromise` NLP library. Used to build
// deterministic (no-LLM) recall-ladder masks for the Adjectives /
// Adverbs / Nouns / Verbs rungs.
//
// Why a library, not hand-curated rules: the previous implementation
// accumulated ~600 lines of hardcoded dictionaries + an exclude list
// that grew with every round of "but this -ly word is actually an
// adjective." compromise is mature, ~250KB minified, runs entirely
// in the renderer, and uses sentence context to disambiguate. It's
// not perfect — a small override set still catches the specific
// false positives compromise consistently misses (bubbly, motherly).

import nlp from 'compromise';

// Words compromise gets wrong consistently and that show up often
// enough to be worth a manual override. Map word -> our POS tag.
// Override wins over whatever compromise returns.
const OVERRIDES = new Map([
  // -le-stem adjectives that compromise tags as adverb
  ['bubbly', 'adjective'],
  ['wobbly', 'adjective'],
  ['prickly', 'adjective'],
  ['crinkly', 'adjective'],
  ['wiggly', 'adjective'],
  ['giggly', 'adjective'],
  ['curly', 'adjective'],
  ['wrinkly', 'adjective'],
  ['crumbly', 'adjective'],
  // -ly relational adjectives
  ['motherly', 'adjective'],
  ['fatherly', 'adjective'],
  ['brotherly', 'adjective'],
  ['sisterly', 'adjective'],
  ['scholarly', 'adjective'],
  ['cowardly', 'adjective'],
  ['priestly', 'adjective'],
]);

// Map a Set of compromise tag strings to our 5-class POS schema.
// Order of checks matters — earlier checks win when multiple tags apply.
function mapTagsToPos(tags) {
  // Function words: determiners, prepositions, conjunctions, pronouns,
  // auxiliaries/copulas/modals. These should never be masked.
  if (
    tags.has('Determiner') ||
    tags.has('Preposition') ||
    tags.has('Conjunction') ||
    tags.has('Pronoun') ||
    tags.has('Modal') ||
    tags.has('Copula') ||
    tags.has('Auxiliary') ||
    tags.has('QuestionWord') ||
    tags.has('Negative')
  ) {
    return 'function';
  }
  // Content classes. Adjective comes before Adverb so a token tagged
  // as both (rare but possible) routes to adjective — the more
  // pedagogically valuable signal.
  if (tags.has('Adjective')) return 'adjective';
  if (tags.has('Adverb')) return 'adverb';
  if (tags.has('Verb')) return 'verb';
  if (tags.has('Noun') || tags.has('ProperNoun')) return 'noun';
  // Unknown content word → noun by default (most English content
  // words are nouns when other signals are absent).
  return 'noun';
}

// Classify a single word in isolation. Provided primarily for unit
// testing — callers that have full text should prefer `taggedTokens`
// since compromise uses sentence context to disambiguate.
export function classifyWord(word) {
  if (!word) return 'noun';
  const lower = word.toLowerCase();
  if (OVERRIDES.has(lower)) return OVERRIDES.get(lower);
  const doc = nlp(word);
  const term = doc.terms().json({ terms: { tags: true } })[0];
  if (!term || !term.terms || term.terms.length === 0) return 'noun';
  const tags = new Set(term.terms[0].tags || []);
  return mapTagsToPos(tags);
}

// Tokenize `text` into word entries with character positions. Uses
// compromise's sentence-level tagging for accuracy, then walks the
// original text to recover exact offsets (compromise doesn't preserve
// them in a way that round-trips with our `${word}` mask renderer).
export function taggedTokens(text) {
  if (!text) return [];
  // Get per-word tags from compromise (sentence context active).
  const doc = nlp(text);
  const json = doc.terms().json({ terms: { tags: true } });
  const tagsByWord = new Map();
  // Sentences can repeat words with different tags. Keep a list per word.
  json.forEach((sentence) => {
    sentence.terms.forEach((t) => {
      const key = (t.text || '').toLowerCase();
      if (!key) return;
      if (!tagsByWord.has(key)) tagsByWord.set(key, []);
      tagsByWord.get(key).push(new Set(t.tags || []));
    });
  });

  // Now walk the original text to find each word's character positions.
  const tokens = [];
  const re = /[A-Za-z][A-Za-z'-]*/g;
  const usedOffsets = new Map(); // word -> next-tag-index to consume
  let m = re.exec(text);
  while (m !== null) {
    const word = m[0];
    const key = word.toLowerCase();
    // Override always wins.
    let pos;
    if (OVERRIDES.has(key)) {
      pos = OVERRIDES.get(key);
    } else {
      const tagList = tagsByWord.get(key) || [];
      const idx = usedOffsets.get(key) || 0;
      const tags = tagList[idx] || new Set();
      usedOffsets.set(key, idx + 1);
      pos = mapTagsToPos(tags);
    }
    tokens.push({
      word,
      pos,
      start: m.index,
      end: m.index + word.length,
    });
    m = re.exec(text);
  }
  return tokens;
}

// Pick `cap` items from `arr`, evenly spaced by index. Used to keep
// the recall task tractable when a POS rung would otherwise mask too
// many words.
export function sampleEvenly(arr, cap) {
  if (arr.length <= cap) return arr;
  const out = [];
  const step = arr.length / cap;
  for (let i = 0; i < cap; i += 1) {
    out.push(arr[Math.floor(i * step)]);
  }
  return out;
}

// Build a `${...}`-masked variant of `text` by masking every word
// whose tagged POS is in `posSet`. `options.cap` bounds the number
// of masks per call; when exceeded, picks evenly-spaced indices.
export function buildPosMask(text, posSet, options = {}) {
  if (!text) return '';
  const { cap = Infinity } = options;
  const tagged = taggedTokens(text);
  let masks = tagged.filter((t) => posSet.has(t.pos));
  if (masks.length === 0) return text;
  if (cap < masks.length) {
    masks = sampleEvenly(masks, cap);
  }
  let out = '';
  let cursor = 0;
  masks.forEach((t) => {
    out += text.slice(cursor, t.start);
    // eslint-disable-next-line no-template-curly-in-string
    out += `\${${t.word}}`;
    cursor = t.end;
  });
  out += text.slice(cursor);
  return out;
}

function maskAtPhrases(text, phrases, cap) {
  const found = [];
  let cursor = 0;
  phrases.forEach((raw) => {
    const clean = (raw || '').replace(/[.,;:!?]+$/, '').trim();
    if (!clean) return;
    const idx = text.indexOf(clean, cursor);
    if (idx >= 0) {
      found.push({ start: idx, end: idx + clean.length });
      cursor = idx + clean.length;
    }
  });
  if (found.length === 0) return text;
  let active = found;
  if (cap < active.length) active = sampleEvenly(active, cap);
  let out = '';
  cursor = 0;
  active.forEach((p) => {
    out += text.slice(cursor, p.start);
    // eslint-disable-next-line no-template-curly-in-string
    out += `\${${text.slice(p.start, p.end)}}`;
    cursor = p.end;
  });
  out += text.slice(cursor);
  return out;
}

// Connectives rung — mask everything compromise tags as Conjunction.
// Pure local, no LLM.
export function buildConnectivesMask(text, options = {}) {
  if (!text) return '';
  const { cap = Infinity } = options;
  return maskAtPhrases(text, nlp(text).match('#Conjunction').out('array'), cap);
}

// Clause-stems rung — mask the multi-word verb phrases compromise
// extracts (verb + auxiliaries / particles). Pure local, no LLM.
export function buildClauseStemsMask(text, options = {}) {
  if (!text) return '';
  const { cap = Infinity } = options;
  return maskAtPhrases(text, nlp(text).verbs().out('array'), cap);
}
