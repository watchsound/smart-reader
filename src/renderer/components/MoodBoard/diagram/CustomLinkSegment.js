// src/renderer/components/MoodBoard/diagram/CustomLinkSegment.js
import React from 'react';
import { RELATION_STYLES } from './types';

function ArrowMarker({ id, color, side }) {
  // SVG marker pointing toward the path direction. orient="auto-start-reverse"
  // handles both directions: at markerEnd the arrow points toward the target;
  // at markerStart it auto-flips to point toward the source.
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
      data-testid={`arrow-${side}`}
    >
      <path
        d="M 0 0 L 10 5 L 0 10 z"
        fill={color}
      />
    </marker>
  );
}

function CustomLinkSegment({ link, path }) {
  const relationType = link.relationType || 'supports';
  const style = RELATION_STYLES[relationType] || RELATION_STYLES.supports;
  const id = link.getID ? link.getID() : 'link';

  const fwdId = `arrow-fwd-${id}`;
  const bwdId = `arrow-bwd-${id}`;

  const showFwd =
    style.arrowhead === 'forward' || style.arrowhead === 'both';
  const showBwd =
    style.arrowhead === 'backward' || style.arrowhead === 'both';

  return (
    <g>
      <defs>
        {showFwd && (
          <ArrowMarker id={fwdId} color={style.stroke} side="forward" />
        )}
        {showBwd && (
          <ArrowMarker id={bwdId} color={style.stroke} side="backward" />
        )}
      </defs>
      <path
        data-testid="link-stroke"
        d={path}
        fill="none"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.dash}
        markerEnd={showFwd ? `url(#${fwdId})` : undefined}
        markerStart={showBwd ? `url(#${bwdId})` : undefined}
      />
    </g>
  );
}

export default CustomLinkSegment;
