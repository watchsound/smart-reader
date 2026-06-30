// Closed-enum weakness taxonomy for Path A and Path B comparisons.
// Order is the display order in the weakness list.
export const BUCKETS = [
  'tense',
  'word-order',
  'article-number',
  'preposition-collocation',
  'connector-cohesion',
  'idiom-register',
];

export const BUCKET_LABELS = {
  tense: 'Tense & Aspect',
  'word-order': 'Word Order',
  'article-number': 'Articles & Number',
  'preposition-collocation': 'Preposition & Collocation',
  'connector-cohesion': 'Connector & Cohesion',
  'idiom-register': 'Idiom & Register',
};

// Per spec § "Color" — light/dark hex pair per bucket.
export const BUCKET_COLORS = {
  tense:                     { light: '#D97706', dark: '#F59E0B' },
  'word-order':              { light: '#7C3AED', dark: '#A78BFA' },
  'article-number':          { light: '#0891B2', dark: '#22D3EE' },
  'preposition-collocation': { light: '#DC2626', dark: '#F87171' },
  'connector-cohesion':      { light: '#059669', dark: '#34D399' },
  'idiom-register':          { light: '#9333EA', dark: '#C084FC' },
};

export const isValidBucket = (b) => BUCKETS.includes(b);
