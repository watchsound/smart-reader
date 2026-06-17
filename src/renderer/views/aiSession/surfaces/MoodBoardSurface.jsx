import React, { useState } from 'react';

export default function MoodBoardSurface({ args, onSubmit }) {
  const [startedAt] = useState(() => Date.now());

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h2>MoodBoard #{args.boardId}</h2>
      <div style={{ color: '#666', marginBottom: 12 }}>
        Review and organize the concepts on this board, then click Done.
      </div>
      <iframe
        title="moodboard-preview"
        src={`#/moodboard/${args.boardId}`}
        style={{ width: '100%', height: 400, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12 }}
      />
      <button onClick={() => onSubmit({ dismissed: true, dwellMs: Date.now() - startedAt })}>
        Done
      </button>
    </div>
  );
}
