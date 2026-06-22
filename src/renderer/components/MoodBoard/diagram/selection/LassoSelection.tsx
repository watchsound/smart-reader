// src/renderer/components/MoodBoard/diagram/selection/LassoSelection.tsx
import * as React from 'react';
import { Rect } from '../types';

interface SelectableNode {
  getID(): string;
  getX(): number;
  getY(): number;
  width: number;
  height: number;
  isSelected(): boolean;
  setSelected(v: boolean): void;
}

export interface LassoSelectionProps {
  nodes: SelectableNode[];
  engine: { repaintCanvas: () => void };
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function normalize(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function LassoSelection({ nodes, engine }: LassoSelectionProps) {
  const [dragging, setDragging] = React.useState(false);
  const [start, setStart] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  const [current, setCurrent] = React.useState<{ x: number; y: number } | null>(
    null,
  );

  const rect =
    start && current ? normalize(start.x, start.y, current.x, current.y) : null;

  const onMouseDown = (e: React.MouseEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    setDragging(true);
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setCurrent({ x: e.clientX, y: e.clientY });
  };

  const onMouseUp = () => {
    if (dragging && rect) {
      for (const node of nodes) {
        const nodeRect = {
          x: node.getX(),
          y: node.getY(),
          width: node.width,
          height: node.height,
        };
        if (rectsIntersect(rect, nodeRect)) {
          node.setSelected(true);
        }
      }
      engine.repaintCanvas();
    }
    setDragging(false);
    setStart(null);
    setCurrent(null);
  };

  return (
    <div
      data-testid="lasso-overlay"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{
        position: 'absolute',
        inset: 0,
        // Both branches are 'auto' intentionally — canvas pass-through is
        // handled by storm. Placeholder for a future shift-key-only intercept.
        pointerEvents: dragging ? 'auto' : 'auto',
        zIndex: 5,
      }}
    >
      {rect && dragging && (
        <div
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            border: '1px dashed #2196f3',
            background: 'rgba(33,150,243,0.08)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

export default LassoSelection;
