// src/__tests__/renderer/moodboardPhase2.integration.test.ts
import { ImageNodeModel } from '../../renderer/components/MoodBoard/diagram/ImageNodeModel';
import {
  BoardTheme,
  BackgroundLayerSpec,
} from '../../renderer/components/MoodBoard/diagram/types';
import {
  resolvePalette,
  PALETTES,
} from '../../renderer/components/MoodBoard/diagram/canvas/themes';
import { createColorZone } from '../../renderer/components/MoodBoard/diagram/canvas/colorZoneDraw';

describe('MoodBoard Phase 2 integration', () => {
  test('theme + background + color zones + image node compose into a single board payload', () => {
    const theme: BoardTheme = {
      paletteId: 'warm-roman',
      backgroundLayer: { mode: 'pattern', patternKey: 'dot-grid', opacity: 0.12 },
    };
    const zoneA = createColorZone({ x: 0, y: 0 }, { x: 200, y: 100 }, '#ffcc80')!;
    const zoneB = createColorZone({ x: 300, y: 0 }, { x: 500, y: 100 }, '#90caf9')!;
    const image = new ImageNodeModel({
      src: 'data:image/png;base64,FAKEIMG',
      width: 320,
      height: 240,
      rotation: 5,
    });
    image.setPosition(100, 200);

    const payload = {
      nodes: { [image.getID()]: image.serialize() },
      theme,
      colorZones: [zoneA, zoneB],
    };

    expect(resolvePalette(payload.theme)).toEqual(PALETTES['warm-roman']);

    const restored = new ImageNodeModel({});
    restored.deserialize({ data: payload.nodes[image.getID()] });
    expect(restored.src).toBe('data:image/png;base64,FAKEIMG');
    expect(restored.rotation).toBe(5);

    expect(payload.colorZones).toHaveLength(2);
    expect(payload.colorZones[0].id).not.toEqual(payload.colorZones[1].id);
  });

  test('background spec mode "image" carries imageAssetId', () => {
    const spec: BackgroundLayerSpec = {
      mode: 'image',
      imageAssetId: 'data:image/jpeg;base64,Y',
      opacity: 0.15,
    };
    expect(spec.mode).toBe('image');
    expect(spec.imageAssetId).toBeDefined();
  });
});
