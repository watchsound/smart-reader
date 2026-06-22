// src/renderer/components/MoodBoard/diagram/types.ts

// v1 relation enum for typed connectors. Right-click on a link cycles
// through these in order.
export const RELATION_TYPES = [
  'supports',
  'contrasts',
  'leads-to',
  'similar',
  'caused-by',
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export const DEFAULT_RELATION_TYPE: RelationType = 'supports';

// Rendering spec per relation type. Consumed by CustomLinkSegment.
// stroke = CSS color; dash = SVG stroke-dasharray ('' = solid);
// arrowhead = 'forward' | 'backward' | 'both' | 'none'.
export interface RelationStyle {
  stroke: string;
  strokeWidth: number;
  dash: string;
  arrowhead: 'forward' | 'backward' | 'both' | 'none';
}

export const RELATION_STYLES: Record<RelationType, RelationStyle> = {
  supports: {
    stroke: '#4a4a4a',
    strokeWidth: 2,
    dash: '',
    arrowhead: 'forward',
  },
  contrasts: {
    stroke: '#c62828',
    strokeWidth: 2,
    dash: '6 4',
    arrowhead: 'both',
  },
  'leads-to': {
    stroke: '#1565c0',
    strokeWidth: 3,
    dash: '',
    arrowhead: 'forward',
  },
  similar: {
    stroke: '#9e9e9e',
    strokeWidth: 1.5,
    dash: '',
    arrowhead: 'none',
  },
  'caused-by': {
    stroke: '#6a1b9a',
    strokeWidth: 2,
    dash: '',
    arrowhead: 'backward',
  },
};

// Shape of an axis-aligned bounding rectangle used for proximity attach.
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A single point in canvas-space.
export interface Point {
  x: number;
  y: number;
}
