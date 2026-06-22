// src/renderer/components/MoodBoard/diagram/StickyNoteNodeWidget.tsx
import * as React from 'react';
import { StickyNoteNodeModel } from './StickyNoteNodeModel';

export interface StickyNoteNodeWidgetProps {
  node: StickyNoteNodeModel;
  engine: { repaintCanvas: () => void };
}

function StickyNoteNodeWidget({ node, engine }: StickyNoteNodeWidgetProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(node.text);

  const commit = () => {
    node.setText(draft);
    setEditing(false);
    if (engine && typeof engine.repaintCanvas === 'function') {
      engine.repaintCanvas();
    }
  };

  return (
    <div
      style={{
        width: node.width,
        height: node.height,
        background: node.color,
        boxShadow: '2px 2px 6px rgba(0,0,0,0.18)',
        padding: 12,
        fontFamily:
          "'Caveat', 'Bradley Hand', 'Comic Sans MS', cursive",
        fontSize: 16,
        color: '#3e2723',
        whiteSpace: 'pre-wrap',
        overflow: 'hidden',
        cursor: 'text',
        boxSizing: 'border-box',
      }}
      onDoubleClick={() => {
        setDraft(node.text);
        setEditing(true);
      }}
    >
      {editing ? (
        <textarea
          data-testid="sticky-textarea"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'inherit',
          }}
        />
      ) : (
        node.text || '(double-click to edit)'
      )}
    </div>
  );
}

export default StickyNoteNodeWidget;
