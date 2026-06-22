// src/renderer/components/MoodBoard/diagram/canvas/colorZoneDraw.ts
import { ColorZone } from '../types';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `cz-${Date.now()}-${counter}`;
}

export function createColorZone(
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
  opacity = 0.2,
): ColorZone | null {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (width === 0 || height === 0) return null;
  return {
    id: nextId(),
    color,
    opacity,
    x,
    y,
    width,
    height,
  };
}
