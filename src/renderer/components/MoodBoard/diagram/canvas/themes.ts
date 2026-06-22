// src/renderer/components/MoodBoard/diagram/canvas/themes.ts
import {
  BoardTheme,
  Palette,
  PaletteId,
  DEFAULT_BOARD_THEME,
} from '../types';

// v1 built-in palettes. Color values chosen for AA contrast between ink and
// bg under a quick visual check; tune via `themes.test.ts` if a contrast
// regression is reported. Hex format is mandatory (the test enforces it) so
// alpha-suffix concatenation elsewhere (`color + '10'`) works predictably.
export const PALETTES: Record<Exclude<PaletteId, 'custom'>, Palette> = {
  'warm-roman': {
    accent: '#b85c38',
    bg: '#f6ecd9',
    ink: '#3a2618',
    muted: '#8a6b4d',
  },
  'cold-noir': {
    accent: '#5a9bd5',
    bg: '#1a1f2b',
    ink: '#e8eef4',
    muted: '#8a93a4',
  },
  'austere-mono': {
    accent: '#444444',
    bg: '#f4f4f4',
    ink: '#1a1a1a',
    muted: '#777777',
  },
  'golden-vellum': {
    accent: '#c79a4b',
    bg: '#fdf6e3',
    ink: '#3b3225',
    muted: '#9c8569',
  },
  'paper-and-ink': {
    accent: '#2c3e50',
    bg: '#fafaf6',
    ink: '#1c2b3a',
    muted: '#6c7a89',
  },
};

export function resolvePalette(theme: BoardTheme): Palette {
  if (theme.paletteId === 'custom') {
    if (theme.customPalette) return theme.customPalette;
    return PALETTES[DEFAULT_BOARD_THEME.paletteId as Exclude<PaletteId, 'custom'>];
  }
  return PALETTES[theme.paletteId];
}
