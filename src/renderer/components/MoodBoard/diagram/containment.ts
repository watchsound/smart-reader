// src/renderer/components/MoodBoard/diagram/containment.ts
import { Rect, Point } from './types';
import { FrameNodeModel } from './FrameNodeModel';

interface NodeLike {
  getID(): string;
  getX(): number;
  getY(): number;
  width: number;
  height: number;
  getType(): string;
}

export function rectFromNode(n: NodeLike): Rect {
  return { x: n.getX(), y: n.getY(), width: n.width, height: n.height };
}

export function pointInsideRect(p: Point, r: Rect): boolean {
  return (
    p.x >= r.x &&
    p.x <= r.x + r.width &&
    p.y >= r.y &&
    p.y <= r.y + r.height
  );
}

export function updateContainmentForNode(
  node: NodeLike,
  frames: FrameNodeModel[],
): void {
  // Nested frames are rejected outright.
  if (node.getType() === 'frame') {
    for (const f of frames) {
      f.removeContained(node.getID());
    }
    return;
  }

  const r = rectFromNode(node);
  const center: Point = {
    x: r.x + r.width / 2,
    y: r.y + r.height / 2,
  };

  let landedIn: FrameNodeModel | null = null;
  for (const frame of frames) {
    if (
      pointInsideRect(center, {
        x: frame.getX(),
        y: frame.getY(),
        width: frame.width,
        height: frame.height,
      })
    ) {
      landedIn = frame;
      break;
    }
  }

  for (const frame of frames) {
    if (frame === landedIn) {
      frame.addContained(node.getID());
    } else {
      frame.removeContained(node.getID());
    }
  }
}
