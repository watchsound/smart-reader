// src/renderer/components/MoodBoard/diagram/selection/useMultiSelectDrag.ts
import { useEffect } from 'react';

interface DragNode {
  getID(): string;
  getX(): number;
  getY(): number;
  isSelected(): boolean;
  setPosition(x: number, y: number): void;
}

/**
 * Pure: translate every selected node *other than* the driver by (dx, dy).
 * Exposed so it can be tested without a React harness.
 */
export function translateSelectedExcept(
  driverId: string,
  dx: number,
  dy: number,
  nodes: DragNode[],
): void {
  for (const n of nodes) {
    if (n.getID() === driverId) continue;
    if (!n.isSelected()) continue;
    n.setPosition(n.getX() + dx, n.getY() + dy);
  }
}

/**
 * React hook: subscribe to a node's `positionChanged` event; when it fires,
 * translate other selected nodes by the same delta. Caller owns the
 * unsubscribe-on-unmount lifecycle via the returned hook's effect.
 */
export function useMultiSelectDrag(
  driver: DragNode & {
    registerListener(l: {
      positionChanged?: (e: { entity: { getX(): number; getY(): number } }) => void;
    }): { deregister: () => void };
  } | null,
  allNodes: DragNode[],
  engine: { repaintCanvas?: () => void },
) {
  useEffect(() => {
    if (!driver) return undefined;
    let lastX = driver.getX();
    let lastY = driver.getY();
    const handle = driver.registerListener({
      positionChanged: (e) => {
        const nx = e.entity.getX();
        const ny = e.entity.getY();
        const dx = nx - lastX;
        const dy = ny - lastY;
        lastX = nx;
        lastY = ny;
        if (dx === 0 && dy === 0) return;
        translateSelectedExcept(driver.getID(), dx, dy, allNodes);
        if (engine && typeof engine.repaintCanvas === 'function') {
          engine.repaintCanvas();
        }
      },
    });
    return () => handle.deregister();
  }, [driver, allNodes, engine]);
}
