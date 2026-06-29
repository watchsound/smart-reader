export const PHASES = [
  {
    id: 'prepare',
    label: 'Prepare',
    meta: '1 PREPARE',
    blurb: 'Read and understand the model.',
  },
  {
    id: 'recall',
    label: 'Recall',
    meta: '2 RECALL',
    blurb: 'Same paragraph, fewer cues at each rung.',
  },
  {
    id: 'compose',
    label: 'Compose',
    meta: '3 COMPOSE',
    blurb: 'Write the same idea in your own words, then compare.',
  },
];

// Six rungs in increasing reconstruction difficulty.
// Rungs 1, 3, 4 are POS-based (deterministic, computed locally).
// Rungs 2, 5, 6 are structure-based (LLM-generated).
export const RUNGS = [
  {
    id: 'adj',
    label: 'Adjectives',
    source: 'pos',
    blurb: 'Descriptive words — the lightest content layer.',
  },
  {
    id: 'connect',
    label: 'Connectives',
    source: 'llm',
    blurb: 'Structural glue — and, but, however, although.',
  },
  {
    id: 'noun',
    label: 'Nouns',
    source: 'pos',
    blurb: 'Subject matter — what the paragraph is about.',
  },
  {
    id: 'verb',
    label: 'Verbs',
    source: 'pos',
    blurb: 'Actions and events.',
  },
  {
    id: 'clause',
    label: 'Clause stems',
    source: 'llm',
    blurb: 'Verbal joints — main verbs with auxiliaries.',
  },
  {
    id: 'subord',
    label: 'Subordinate',
    source: 'llm',
    blurb: 'Whole dependent clauses — the spine remains.',
  },
];

// Single accent (teal); phase intensity steps along this hue.
export const ACCENT = {
  light: { 200: '#7AC5C5', 400: '#0E8A8A', 600: '#085656' },
  dark: { 200: '#9EE5E5', 400: '#5EE0E0', 600: '#2FA8A8' },
};

// Semantic status colors for the Compare view (kept separate from accent).
export const DIFF_COLORS = {
  match: { light: '#2E7D32', dark: '#81C784' },
  weaker: { light: '#E65100', dark: '#FFB74D' },
  grammar: { light: '#1565C0', dark: '#64B5F6' },
};
