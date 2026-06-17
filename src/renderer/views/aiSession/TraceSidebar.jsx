import React from 'react';

const KIND_LABELS = {
  thought: '💭', tool: '🔧', observation: '👁️',
  surface: '🖥️', 'soft-write': '✍️', error: '⚠️', end: '🏁',
};

const KIND_COLORS = {
  thought: '#9ad', tool: '#cae', observation: '#9c9',
  surface: '#ea9', 'soft-write': '#9ec', error: '#e88', end: '#aaa',
};

function renderPayload(kind, payload) {
  if (!payload) return null;
  if (kind === 'thought') return payload.reasoning || '';
  if (kind === 'tool') return `${payload.tool}(${JSON.stringify(payload.args || {}).slice(0, 50)})`;
  if (kind === 'observation') return payload.summary || '';
  if (kind === 'surface') return `${payload.tool}: awaiting user...`;
  if (kind === 'soft-write') return `${payload.tool}(${JSON.stringify(payload.args || {}).slice(0, 50)})`;
  if (kind === 'error') return payload.message || 'error';
  if (kind === 'end') return `end: ${payload.reason || 'unknown'}`;
  return JSON.stringify(payload);
}

function TraceRow({ event, onUndo }) {
  const { kind, payload, iteration } = event;
  const isSoftWrite = kind === 'soft-write';
  const undone = isSoftWrite && payload.undone;
  return (
    <div
      data-trace-row
      {...(undone ? { 'data-undone': 'true' } : {})}
      style={{
        padding: '6px 10px',
        borderLeft: `3px solid ${KIND_COLORS[kind] || '#888'}`,
        marginBottom: 4,
        opacity: undone ? 0.5 : 1,
        textDecoration: undone ? 'line-through' : 'none',
      }}
    >
      <div style={{ fontSize: 11, color: '#888' }}>
        {KIND_LABELS[kind] || ''} iter {iteration} · {kind}
      </div>
      <div style={{ fontSize: 13 }}>
        {renderPayload(kind, payload)}
      </div>
      {isSoftWrite && !undone && (
        <button onClick={() => onUndo(payload.id)} style={{ fontSize: 11, marginTop: 4 }}>
          Undo
        </button>
      )}
    </div>
  );
}

export default function TraceSidebar({ trace, onUndo }) {
  return (
    <div style={{ width: '30%', minWidth: 280, overflowY: 'auto', padding: 12, background: '#f7f7f9', borderRight: '1px solid #e0e0e0' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>
        Director Trace
      </div>
      {trace.length === 0 && <div style={{ color: '#aaa', fontStyle: 'italic' }}>Waiting for first decision...</div>}
      {trace.map((event, i) => <TraceRow key={i} event={event} onUndo={onUndo} />)}
    </div>
  );
}
