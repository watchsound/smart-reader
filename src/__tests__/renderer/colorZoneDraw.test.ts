// src/__tests__/renderer/colorZoneDraw.test.ts
import { createColorZone } from '../../renderer/components/MoodBoard/diagram/canvas/colorZoneDraw';

describe('createColorZone', () => {
  test('forward drag (start top-left, end bottom-right) builds the correct rect', () => {
    const z = createColorZone(
      { x: 10, y: 20 },
      { x: 110, y: 80 },
      '#ffcc80',
    );
    expect(z!.x).toBe(10);
    expect(z!.y).toBe(20);
    expect(z!.width).toBe(100);
    expect(z!.height).toBe(60);
    expect(z!.color).toBe('#ffcc80');
    expect(z!.opacity).toBe(0.2);
    expect(typeof z!.id).toBe('string');
    expect(z!.id.length).toBeGreaterThan(0);
  });

  test('reverse drag normalizes to positive width/height', () => {
    const z = createColorZone({ x: 110, y: 80 }, { x: 10, y: 20 }, '#90caf9');
    expect(z!.x).toBe(10);
    expect(z!.y).toBe(20);
    expect(z!.width).toBe(100);
    expect(z!.height).toBe(60);
  });

  test('zero-size drag (same point) returns null', () => {
    const z = createColorZone({ x: 50, y: 50 }, { x: 50, y: 50 }, '#aaa');
    expect(z).toBeNull();
  });

  test('two successive calls produce different ids', () => {
    const a = createColorZone({ x: 0, y: 0 }, { x: 10, y: 10 }, '#aaa');
    const b = createColorZone({ x: 0, y: 0 }, { x: 10, y: 10 }, '#aaa');
    expect(a!.id).not.toBe(b!.id);
  });
});
