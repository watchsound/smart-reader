// src/renderer/components/MoodBoard/diagram/CustomLinkWidget.js
import React, { useCallback } from 'react';
import CustomLinkSegment from './CustomLinkSegment';
import { RELATION_TYPES } from './types';

function CustomLinkWidget({ link, engine, path }) {
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
      <CustomLinkSegment link={link} path={path} />
      {/* Wide invisible hit-region for right-click cycling. */}
      <path
        data-testid="link-hit"
        d={path}
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
