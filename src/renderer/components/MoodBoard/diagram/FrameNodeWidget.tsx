// src/renderer/components/MoodBoard/diagram/FrameNodeWidget.tsx
import * as React from 'react';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { FrameNodeModel } from './FrameNodeModel';

export interface FrameNodeWidgetProps {
  node: FrameNodeModel;
  engine: DiagramEngine | { repaintCanvas: () => void };
}

/** Convert #rrggbb or #rgb hex strings to "rgb(r, g, b)" so jsdom and browsers
 *  both expose a normalized value on element.style.borderColor. */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  // eslint-disable-next-line no-bitwise
  return `rgb(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff})`;
}

function FrameNodeWidget({ node, engine }: FrameNodeWidgetProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(node.label);

  // Normalize to rgb() so element.style.borderColor is consistent across
  // jsdom (tests) and real browsers — both keep the value you set, so we
  // set it as rgb up front rather than relying on browser normalization.
  const colorRgb = node.accentColor.startsWith('#')
    ? hexToRgb(node.accentColor)
    : node.accentColor;

  const commit = () => {
    node.label = draft;
    setEditing(false);
    if (engine && typeof engine.repaintCanvas === 'function') {
      engine.repaintCanvas();
    }
  };

  return (
    <div
      data-testid="frame-outer"
      style={{
        position: 'relative',
        width: node.width,
        height: node.height,
        border: `2px solid ${colorRgb}`,
        borderRadius: 12,
        background: `${node.accentColor}10`, // 10% alpha tint
        boxSizing: 'border-box',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -12,
          left: 12,
          padding: '2px 8px',
          background: colorRgb,
          color: 'white',
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 6,
          maxWidth: '80%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'text',
        }}
        onDoubleClick={() => {
          setDraft(node.label);
          setEditing(true);
        }}
      >
        {editing ? (
          <input
            data-testid="frame-label-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              width: '100%',
            }}
          />
        ) : (
          node.label || 'Untitled frame'
        )}
      </div>
    </div>
  );
}

export default FrameNodeWidget;
