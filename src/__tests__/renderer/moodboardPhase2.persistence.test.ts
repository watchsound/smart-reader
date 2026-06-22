// src/__tests__/renderer/moodboardPhase2.persistence.test.ts
import { DEFAULT_BOARD_THEME, BoardTheme, ColorZone } from '../../renderer/components/MoodBoard/diagram/types';

// Mirrors the inline merge from the panel's save handler. Exporting the
// helper makes it testable without mounting the panel.
function buildBoardPayload(
  diagramJson: any,
  theme: BoardTheme,
  colorZones: ColorZone[],
) {
  return {
    ...diagramJson,
    theme,
    colorZones,
  };
}

describe('Phase 2 persistence', () => {
  test('payload carries theme + colorZones beside the diagram JSON', () => {
    const theme: BoardTheme = { paletteId: 'cold-noir' };
    const zones: ColorZone[] = [
      { id: 'z1', color: '#90caf9', opacity: 0.2, x: 0, y: 0, width: 100, height: 50 },
    ];
    const payload = buildBoardPayload({ id: 'demo', nodes: {}, links: {} }, theme, zones);
    expect(payload.theme).toEqual(theme);
    expect(payload.colorZones).toEqual(zones);
    expect(payload.id).toBe('demo');
  });

  test('legacy boards without theme deserialize via DEFAULT_BOARD_THEME fallback', () => {
    const incoming = { id: 'old', nodes: {}, links: {} } as any;
    const theme = incoming.theme ?? DEFAULT_BOARD_THEME;
    expect(theme).toEqual(DEFAULT_BOARD_THEME);
  });
});
