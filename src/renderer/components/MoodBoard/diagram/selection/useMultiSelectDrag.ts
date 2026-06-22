// src/renderer/components/MoodBoard/diagram/selection/useMultiSelectDrag.ts
import { useEffect, useRef } from 'react';

export interface DragNode {
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
 * translate other selected nodes by the same delta.
 *
 * `allNodes` is read through a ref so a new array reference on each render
 * does not retrigger the effect (which would deregister mid-drag and reset
 * the delta-tracking state). Only `driver` and `engine` identity changes
 * cause re-subscription.
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
  const allNodesRef = useRef(allNodes);
  // Sync the ref every render so the listener always sees the latest array
  // without needing to re-subscribe.
  allNodesRef.current = allNodes;

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
        translateSelectedExcept(driver.getID(), dx, dy, allNodesRef.current);
        if (engine && typeof engine.repaintCanvas === 'function') {
          engine.repaintCanvas();
        }
      },
    });
    return () => handle.deregister();
  }, [driver, engine]); // allNodes intentionally omitted; read via ref
}
