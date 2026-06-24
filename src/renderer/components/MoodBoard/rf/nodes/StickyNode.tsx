import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';

export interface MbStickyData {
  text: string;
  color: string;
}

const STICKY_COLORS = [
  { value: '#FFF9C4', label: 'Yellow',   shadow: 'rgba(255,230,50,0.35)' },
  { value: '#FFCDD2', label: 'Pink',     shadow: 'rgba(255,100,100,0.25)' },
  { value: '#C8E6C9', label: 'Mint',     shadow: 'rgba(60,180,80,0.25)'  },
  { value: '#BBDEFB', label: 'Blue',     shadow: 'rgba(40,120,255,0.20)' },
  { value: '#E1BEE7', label: 'Lavender', shadow: 'rgba(150,60,200,0.20)' },
];

function shadowForColor(color: string): string {
  const match = STICKY_COLORS.find((c) => c.value === color);
  return match?.shadow ?? 'rgba(0,0,0,0.18)';
}

export function StickyNode({ id, data, selected }: NodeProps) {
  const rf = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState((data.text as string) || '');
  const [hovered, setHovered] = useState(false);

  const currentColor = (data.color as string) || '#FFF9C4';

  const commit = useCallback(() => {
    rf.updateNodeData(id, { text: draft });
    setEditing(false);
  }, [rf, id, draft]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
      if (e.key === 'Escape') { setEditing(false); setDraft((data.text as string) || ''); }
    },
    [commit, data.text],
  );

  const setColor = useCallback(
    (color: string) => rf.updateNodeData(id, { color }),
    [rf, id],
  );

  const handleDelete = useCallback(() => {
    rf.deleteElements({ nodes: [{ id }] });
  }, [rf, id]);

  const shadowColor = shadowForColor(currentColor);

  return (
    <>
      <NodeResizer minWidth={120} minHeight={90} isVisible={selected} />
      <Handle type="source" position={Position.Top}    id="top"    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left}   id="left"   style={{ opacity: 0 }} />

      {/* Color palette — visible when selected */}
      {selected && (
        <div style={{
          position: 'absolute',
          top: -36,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 5,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 20,
          padding: '4px 8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 10,
        }}>
          {STICKY_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              title={c.label}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: c.value,
                border: currentColor === c.value ? '2px solid #374151' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          ))}
        </div>
      )}

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => { setDraft((data.text as string) || ''); setEditing(true); }}
        style={{
          width: '100%',
          height: '100%',
          background: currentColor,
          padding: '10px 12px',
          boxSizing: 'border-box',
          fontSize: 13.5,
          lineHeight: 1.5,
          color: '#2d2d2d',
          overflow: 'hidden',
          borderRadius: 4,
          boxShadow: hovered
            ? `0 8px 20px ${shadowColor}, 0 2px 6px rgba(0,0,0,0.10)`
            : `0 3px 10px ${shadowColor}, 0 1px 3px rgba(0,0,0,0.08)`,
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'box-shadow 0.18s ease, transform 0.18s ease',
          position: 'relative',
          fontFamily: 'inherit',
        }}
      >
        {editing ? (
          <textarea
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              resize: 'none',
              outline: 'none',
              fontSize: 'inherit',
              lineHeight: 'inherit',
              color: 'inherit',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            {(data.text as string) || (
              <span style={{ opacity: 0.45, fontStyle: 'italic', fontSize: 12 }}>
                Double-click to write…
              </span>
            )}
          </span>
        )}

        {/* Delete button on hover */}
        {hovered && !editing && (
          <button
            onClick={handleDelete}
            title="Remove"
            style={{
              position: 'absolute',
              top: 5,
              right: 5,
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              color: '#555',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
    </>
  );
}
