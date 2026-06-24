import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';

export interface MbImageData {
  url: string;
  caption?: string;
}

export function ImageNode({ id, data, selected }: NodeProps) {
  const rf = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [editingUrl, setEditingUrl] = useState(!(data.url as string));
  const [urlDraft, setUrlDraft] = useState((data.url as string) || '');
  const [imgError, setImgError] = useState(false);

  const url = data.url as string;
  const caption = data.caption as string | undefined;

  const commitUrl = useCallback(() => {
    if (urlDraft.trim()) {
      rf.updateNodeData(id, { url: urlDraft.trim() });
      setImgError(false);
    }
    setEditingUrl(false);
  }, [rf, id, urlDraft]);

  const handleDelete = useCallback(() => {
    rf.deleteElements({ nodes: [{ id }] });
  }, [rf, id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitUrl();
    if (e.key === 'Escape') setEditingUrl(false);
  }, [commitUrl]);

  return (
    <>
      <NodeResizer minWidth={140} minHeight={120} isVisible={selected} />
      <Handle type="source" position={Position.Top}    id="top"    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left}   id="left"   style={{ opacity: 0 }} />

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#f3f4f6',
          boxShadow: hovered
            ? '0 8px 24px rgba(0,0,0,0.16)'
            : selected
            ? '0 4px 16px rgba(0,0,0,0.12)'
            : '0 2px 8px rgba(0,0,0,0.09)',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'box-shadow 0.18s ease, transform 0.18s ease',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Image area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
          {editingUrl || !url || imgError ? (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 12,
              boxSizing: 'border-box',
            }}>
              <span style={{ fontSize: 28, opacity: 0.4 }}>🖼</span>
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={editingUrl}
                placeholder="Paste image URL…"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onBlur={commitUrl}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  fontSize: 11,
                  padding: '5px 8px',
                  borderRadius: 5,
                  border: '1px solid #d1d5db',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#374151',
                  background: '#fff',
                }}
              />
              {imgError && (
                <span style={{ fontSize: 10, color: '#ef4444' }}>Could not load image</span>
              )}
            </div>
          ) : (
            <img
              src={url}
              alt={caption || ''}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          )}
        </div>

        {/* Caption */}
        {caption && !editingUrl && (
          <div style={{
            padding: '4px 8px',
            fontSize: 11,
            color: '#6b7280',
            background: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            {caption}
          </div>
        )}

        {/* Hover controls */}
        <div style={{
          position: 'absolute',
          top: 6,
          right: 6,
          display: 'flex',
          gap: 4,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
          pointerEvents: hovered ? 'auto' : 'none',
        }}>
          <button
            onClick={() => { setUrlDraft(url || ''); setEditingUrl(true); }}
            title="Change image"
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: 'none',
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#374151',
              padding: 0,
            }}
          >
            ✎
          </button>
          <button
            onClick={handleDelete}
            title="Remove from board"
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: 'none',
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#ef4444',
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}
