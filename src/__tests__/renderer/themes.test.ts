// src/__tests__/renderer/themes.test.ts
import {
  PALETTES,
  resolvePalette,
} from '../../renderer/components/MoodBoard/diagram/canvas/themes';
import {
  PALETTE_IDS,
  DEFAULT_BOARD_THEME,
} from '../../renderer/components/MoodBoard/diagram/types';

describe('themes', () => {
  test('PALETTES has an entry for every built-in PaletteId except "custom"', () => {
    for (const id of PALETTE_IDS) {
      if (id === 'custom') continue;
      expect(PALETTES[id]).toBeDefined();
      expect(PALETTES[id].accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PALETTES[id].bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PALETTES[id].ink).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PALETTES[id].muted).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test('resolvePalette returns the palette for a built-in id', () => {
    const p = resolvePalette({ paletteId: 'warm-roman' });
    expect(p).toEqual(PALETTES['warm-roman']);
  });

  test('resolvePalette returns customPalette when paletteId is "custom"', () => {
    const custom = {
      accent: '#abcdef',
      bg: '#fedcba',
      ink: '#000000',
      muted: '#666666',
    };
    const p = resolvePalette({ paletteId: 'custom', customPalette: custom });
    expect(p).toEqual(custom);
  });

  test('resolvePalette falls back to DEFAULT_BOARD_THEME palette when custom is missing', () => {
    const p = resolvePalette({ paletteId: 'custom' }); // no customPalette
    type BuiltInId = Exclude<typeof DEFAULT_BOARD_THEME.paletteId, 'custom'>;
    expect(p).toEqual(PALETTES[DEFAULT_BOARD_THEME.paletteId as BuiltInId]);
  });
});
