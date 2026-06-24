import React, { useCallback } from 'react';
import {
  BaseEdge,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
const RELATION_TYPES = ['supports', 'contradicts', 'related', 'causes', 'part-of'] as const;
const RELATION_STYLES: Record<string, { stroke: string; strokeWidth: number; dash?: string; arrowhead: 'forward' | 'backward' | 'both' | 'none' }> = {
  supports:    { stroke: '#4ade80', strokeWidth: 2, arrowhead: 'forward' },
  contradicts: { stroke: '#f87171', strokeWidth: 2, dash: '6 3', arrowhead: 'both' },
  related:     { stroke: '#94a3b8', strokeWidth: 1.5, arrowhead: 'none' },
  causes:      { stroke: '#fb923c', strokeWidth: 2, arrowhead: 'forward' },
  'part-of':   { stroke: '#a78bfa', strokeWidth: 1.5, dash: '4 2', arrowhead: 'forward' },
};

export interface MbRelationData {
  relationType?: string;
}

export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const rf = useReactFlow();
  const relationType = (data?.relationType as string) || 'supports';
  const style = RELATION_STYLES[relationType as keyof typeof RELATION_STYLES] || RELATION_STYLES.supports;
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  const markerId = `mb-arrow-${id}`;
  const markerEndId = `mb-arrow-end-${id}`;
  const showFwd = style.arrowhead === 'forward' || style.arrowhead === 'both';
  const showBwd = style.arrowhead === 'backward' || style.arrowhead === 'both';

  const cycleRelationType = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const idx = RELATION_TYPES.indexOf(relationType as typeof RELATION_TYPES[number]);
      const next = RELATION_TYPES[(idx + 1) % RELATION_TYPES.length];
      rf.updateEdgeData(id, { relationType: next });
    },
    [rf, id, relationType],
  );

  return (
    <>
      <defs>
        {showFwd && (
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={style.stroke} />
          </marker>
        )}
        {showBwd && (
          <marker
            id={markerEndId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={style.stroke} />
          </marker>
        )}
      </defs>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.dash || undefined,
        }}
        markerEnd={showFwd ? `url(#${markerId})` : undefined}
        markerStart={showBwd ? `url(#${markerEndId})` : undefined}
        interactionWidth={20}
      />
      {/* Wide invisible hit area for right-click relation cycling */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: 'context-menu' }}
        onContextMenu={cycleRelationType}
      />
    </>
  );
}
