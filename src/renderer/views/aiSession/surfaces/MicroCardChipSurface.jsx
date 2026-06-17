import React from 'react';

export default function MicroCardChipSurface({ args, onSubmit }) {
  const p = args.proposal || {};

  return (
    <div style={{ padding: 24, maxWidth: 500, margin: '0 auto' }}>
      <h3>Micro-card proposal</h3>
      <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, marginBottom: 16 }}>
        <strong>{p.headword || p.title || 'Untitled'}</strong>
        <div style={{ color: '#555', marginTop: 6 }}>{p.definition || p.content || ''}</div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => onSubmit({ accepted: true })}>Accept</button>
        <button onClick={() => onSubmit({ accepted: false })}>Dismiss</button>
      </div>
    </div>
  );
}
