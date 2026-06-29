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

export const RUNGS = [
  {
    id: 'light',
    label: 'Light',
    glyphEngaged: '●',
    blurb: 'Mask collocations and idioms only.',
  },
  {
    id: 'medium',
    label: 'Medium',
    glyphEngaged: '◐',
    blurb: 'Add discourse markers + key content nouns.',
  },
  {
    id: 'hard',
    label: 'Hard',
    glyphEngaged: '○',
    blurb: 'Keep only sentence skeletons.',
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
