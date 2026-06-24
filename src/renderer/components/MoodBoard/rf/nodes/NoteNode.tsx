import React, { useCallback, useState } from 'react';
import { Handle, Position, NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';
import { useDispatch } from 'react-redux';
import { useGetNoteByIdQuery } from '../../../../store/api/noteApiSlice';
import { diagramNoteHandled } from '../../../../store/reducers/moodBoardSlice';

export interface MbNoteData {
  noteId: number;
}

// Strip HTML tags and collapse whitespace for plain-text excerpt.
// Exported for unit testing.
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function NoteNode({ id, data, selected }: NodeProps) {
  const rf = useReactFlow();
  const dispatch = useDispatch();
  const [hovered, setHovered] = useState(false);

  const { data: noteResult } = useGetNoteByIdQuery(data.noteId as number);
  const note = noteResult?.note ?? null;

  const handleDelete = useCallback(() => {
    rf.deleteElements({ nodes: [{ id }] });
  }, [rf, id]);

  const handleOpen = useCallback(() => {
    if (note) dispatch(diagramNoteHandled(note));
  }, [dispatch, note]);

  // Derive display content
  const title = note?.title || 'Untitled Note';
  // Prefer html (TipTap rich-text output) over text (raw markdown / plain);
  // both need HTML stripping since old notes stored markdown-converted HTML in text too.
  const rawText = note?.cards?.[0]?.html || note?.cards?.[0]?.text || '';
  const excerpt = stripHtml(rawText).slice(0, 160);
  const accentColor = note?.color || '#2c3e50';
  const tags: string[] = note?.tags ?? [];

  return (
    <>
      <NodeResizer minWidth={180} minHeight={110} isVisible={selected} />
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
          background: '#ffffff',
          borderRadius: 8,
          boxShadow: hovered
            ? '0 8px 24px rgba(0,0,0,0.14)'
            : selected
            ? '0 4px 16px rgba(0,0,0,0.12)'
            : '0 2px 8px rgba(0,0,0,0.09)',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'box-shadow 0.18s ease, transform 0.18s ease',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Left accent stripe */}
        <div style={{
          width: 4,
          flexShrink: 0,
          background: accentColor,
          borderRadius: '8px 0 0 8px',
        }} />

        {/* Content area */}
        <div style={{
          flex: 1,
          padding: '10px 12px 10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflow: 'hidden',
          minWidth: 0,
        }}>
          {/* Title */}
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#1a1a2e',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
          }}>
            {title}
          </div>

          {/* Excerpt */}
          {excerpt && (
            <div style={{
              fontSize: 11.5,
              color: '#6b7280',
              lineHeight: 1.45,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              fontFamily: 'inherit',
            }}>
              {excerpt}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 3,
              marginTop: 'auto',
              paddingTop: 4,
            }}>
              {tags.slice(0, 3).map((tag) => (
                <span key={tag} style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: `${accentColor}18`,
                  color: accentColor,
                  fontWeight: 500,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hover action buttons */}
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
            onClick={handleOpen}
            title="Open note"
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
              color: '#374151',
              padding: 0,
            }}
          >
            ↗
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
