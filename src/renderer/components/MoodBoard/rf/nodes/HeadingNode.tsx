import React, { useState, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';

export interface MbHeadingData {
  text: string;
  level?: 'h1' | 'h2' | 'h3';
}

const FONT_SIZES: Record<string, number> = { h1: 28, h2: 21, h3: 16 };

export function HeadingNode({ id, data, selected }: NodeProps) {
  const rf = useReactFlow();
  const [editing, setEditing] = useState(!(data.text as string));
  const [draft, setDraft] = useState((data.text as string) || '');
  const [hovered, setHovered] = useState(false);

  const level = (data.level as string) || 'h2';
  const fontSize = FONT_SIZES[level] ?? 21;

  const commit = useCallback(() => {
    rf.updateNodeData(id, { text: draft });
    setEditing(false);
  }, [rf, id, draft]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setEditing(false); setDraft((data.text as string) || ''); }
  }, [commit, data.text]);

  const handleDelete = useCallback(() => {
    rf.deleteElements({ nodes: [{ id }] });
  }, [rf, id]);

  const cycleLevel = useCallback(() => {
    const levels = ['h1', 'h2', 'h3'];
    const next = levels[(levels.indexOf(level) + 1) % levels.length];
    rf.updateNodeData(id, { level: next });
  }, [rf, id, level]);

  return (
    <>
      <Handle type="source" position={Position.Top}    id="top"    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left}   id="left"   style={{ opacity: 0 }} />

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => { setDraft((data.text as string) || ''); setEditing(true); }}
        style={{
          position: 'relative',
          padding: '2px 6px',
          display: 'inline-flex',
          alignItems: 'center',
          minWidth: 80,
          outline: selected ? '1.5px dashed rgba(100,120,200,0.4)' : 'none',
          borderRadius: 4,
          background: 'transparent',
        }}
      >
        {editing ? (
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            style={{
              fontSize,
              fontWeight: level === 'h3' ? 600 : 700,
              color: '#1a1a2e',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              width: Math.max(120, draft.length * fontSize * 0.6),
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <span style={{
            fontSize,
            fontWeight: level === 'h3' ? 600 : 700,
            color: '#1a1a2e',
            lineHeight: 1.2,
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
          }}>
            {(data.text as string) || (
              <span style={{ opacity: 0.35, fontWeight: 400, fontSize: fontSize * 0.75 }}>
                Double-click to add heading…
              </span>
            )}
          </span>
        )}

        {/* Hover controls */}
        {hovered && !editing && (
          <div style={{
            position: 'absolute',
            top: -26,
            right: 0,
            display: 'flex',
            gap: 3,
          }}>
            <button
              onClick={cycleLevel}
              title="Change size (H1 → H2 → H3)"
              style={{
                height: 20,
                padding: '0 6px',
                borderRadius: 4,
                border: 'none',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 600,
                color: '#374151',
              }}
            >
              {level.toUpperCase()}
            </button>
            <button
              onClick={handleDelete}
              title="Remove"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                border: 'none',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                fontSize: 12,
                color: '#ef4444',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </>
  );
}
