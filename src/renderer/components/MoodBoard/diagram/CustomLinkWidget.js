// src/renderer/components/MoodBoard/diagram/CustomLinkWidget.js
import React, { useCallback } from 'react';
import CustomLinkSegment from './CustomLinkSegment';
import { RELATION_TYPES } from './types';
import { nearestEdgePoints } from './ProximityAttach';

function CustomLinkWidget({ link, engine, path }) {
  // Compute a proximity-routed path (nearest card-edge to nearest card-edge)
  // instead of relying on port positions. Falls back to the storm-supplied
  // `path` prop if either node is unavailable (e.g. link still being dragged).
  const sourceNode = link.getSourcePort?.()?.getNode?.();
  const targetNode = link.getTargetPort?.()?.getNode?.();
  let computedPath = path;
  if (sourceNode && targetNode) {
    const a = {
      x: sourceNode.getX(),
      y: sourceNode.getY(),
      width: sourceNode.width ?? 0,
      height: sourceNode.height ?? 0,
    };
    const b = {
      x: targetNode.getX(),
      y: targetNode.getY(),
      width: targetNode.width ?? 0,
      height: targetNode.height ?? 0,
    };
    const { from, to } = nearestEdgePoints(a, b);
    computedPath = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  const onContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = link.relationType || RELATION_TYPES[0];
      const idx = RELATION_TYPES.indexOf(current);
      const next = RELATION_TYPES[(idx + 1) % RELATION_TYPES.length];
      if (typeof link.setRelationType === 'function') {
        link.setRelationType(next);
      } else {
        link.relationType = next;
      }
      if (engine && typeof engine.repaintCanvas === 'function') {
        engine.repaintCanvas();
      }
    },
    [link, engine],
  );

  return (
    <g>
      <CustomLinkSegment link={link} path={computedPath} />
      {/* Wide invisible hit-region for right-click cycling. */}
      <path
        data-testid="link-hit"
        d={computedPath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: 'context-menu' }}
        onContextMenu={onContextMenu}
      />
    </g>
  );
}

export default CustomLinkWidget;
