import { Rect, Point } from './types';

export function edgePointsForRect(r: Rect): Point[] {
  return [
    { x: r.x + r.width / 2, y: r.y },             // top mid
    { x: r.x + r.width, y: r.y + r.height / 2 },  // right mid
    { x: r.x + r.width / 2, y: r.y + r.height },  // bottom mid
    { x: r.x, y: r.y + r.height / 2 },            // left mid
  ];
}

function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function nearestEdgePoints(
  a: Rect,
  b: Rect,
): { from: Point; to: Point } {
  const aPts = edgePointsForRect(a);
  const bPts = edgePointsForRect(b);
  let best = { from: aPts[0], to: bPts[0] };
  let bestDist = distSq(aPts[0], bPts[0]);
  // Iterate in fixed order; tie-break by first-encountered (deterministic).
  for (let i = 0; i < aPts.length; i += 1) {
    for (let j = 0; j < bPts.length; j += 1) {
      const d = distSq(aPts[i], bPts[j]);
      if (d < bestDist) {
        bestDist = d;
        best = { from: aPts[i], to: bPts[j] };
      }
    }
  }
  return best;
}
