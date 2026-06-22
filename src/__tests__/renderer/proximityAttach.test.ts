// src/__tests__/renderer/proximityAttach.test.ts
import {
  nearestEdgePoints,
  edgePointsForRect,
} from '../../renderer/components/MoodBoard/diagram/ProximityAttach';

describe('ProximityAttach', () => {
  test('edgePointsForRect returns 4 midpoints of each side', () => {
    const points = edgePointsForRect({ x: 0, y: 0, width: 100, height: 50 });
    expect(points).toEqual(
      expect.arrayContaining([
        { x: 50, y: 0 },   // top mid
        { x: 100, y: 25 }, // right mid
        { x: 50, y: 50 },  // bottom mid
        { x: 0, y: 25 },   // left mid
      ]),
    );
    expect(points).toHaveLength(4);
  });

  test('nearestEdgePoints picks right side of A and left side of B when B is to the right', () => {
    const a = { x: 0, y: 0, width: 100, height: 50 };
    const b = { x: 200, y: 0, width: 100, height: 50 };
    const { from, to } = nearestEdgePoints(a, b);
    expect(from).toEqual({ x: 100, y: 25 }); // right mid of A
    expect(to).toEqual({ x: 200, y: 25 });   // left mid of B
  });

  test('nearestEdgePoints picks top of A and bottom of B when B is above', () => {
    const a = { x: 0, y: 200, width: 100, height: 50 };
    const b = { x: 0, y: 0, width: 100, height: 50 };
    const { from, to } = nearestEdgePoints(a, b);
    expect(from).toEqual({ x: 50, y: 200 }); // top mid of A
    expect(to).toEqual({ x: 50, y: 50 });    // bottom mid of B
  });

  test('nearestEdgePoints is deterministic on tied distances', () => {
    // Two perfectly-aligned rects share equal distance from any pair of sides.
    // The implementation should pick consistently — same input → same output.
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 150, y: 150, width: 100, height: 100 };
    const r1 = nearestEdgePoints(a, b);
    const r2 = nearestEdgePoints(a, b);
    expect(r1).toEqual(r2);
  });
});
