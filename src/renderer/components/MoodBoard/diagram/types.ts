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

// ---------------------------------------------------------------------------
// Phase 2 — Aesthetic primitives
// ---------------------------------------------------------------------------

// Built-in palette identifiers. Add new entries to themes.ts in lockstep
// with this union; 'custom' means the board carries its own palette values.
export const PALETTE_IDS = [
  'warm-roman',
  'cold-noir',
  'austere-mono',
  'golden-vellum',
  'paper-and-ink',
  'custom',
] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

// CSS color literals — the 4 slots every palette must define.
export interface Palette {
  accent: string;  // primary accent color
  bg: string;      // canvas background base color
  ink: string;     // primary text color
  muted: string;   // secondary / meta text color
}

// Typography family choices for board-wide typography override.
export const FONT_FAMILIES = ['serif', 'sans', 'mono', 'display'] as const;
export type FontFamilyChoice = (typeof FONT_FAMILIES)[number];

// Background layer rendering modes.
export type BackgroundMode = 'none' | 'image' | 'pattern';

// Spec for the background canvas underlay.
export interface BackgroundLayerSpec {
  mode: BackgroundMode;
  // For mode='image' — customStorage asset id of the user-uploaded image.
  imageAssetId?: string;
  // For mode='pattern' — built-in pattern key. v1 ships one ('dot-grid');
  // additional patterns may be added without breaking existing boards.
  patternKey?: 'dot-grid' | 'paper-grain';
  // Opacity 0..1 applied to the background layer; default 0.1.
  opacity?: number;
}

// Full board theme record persisted on the MoodBoard JSON.
export interface BoardTheme {
  paletteId: PaletteId;
  customPalette?: Palette;            // populated only when paletteId === 'custom'
  fontFamily?: FontFamilyChoice;      // optional override of system default
  backgroundLayer?: BackgroundLayerSpec;
}

// Default theme assigned to boards that pre-date the field.
export const DEFAULT_BOARD_THEME: BoardTheme = {
  paletteId: 'paper-and-ink',
};

// A color zone: a translucent labeled rectangle drawn below cards but above
// the background. Lighter weight than a Frame; no containment semantics.
export interface ColorZone {
  id: string;
  color: string;
  opacity: number;   // 0..1
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}
