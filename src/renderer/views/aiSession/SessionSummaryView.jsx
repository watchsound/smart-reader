import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import sessionApi from '../../api/sessionApi';

export default function SessionSummaryView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trace, setTrace] = useState([]);

  useEffect(() => {
    (async () => {
      const result = await sessionApi.getTrace(id);
      // getTrace returns { traceId, events } in production; accept a plain array too
      // (the plain-array shape is used in tests and legacy callers).
      setTrace(Array.isArray(result) ? result : (result?.events ?? []));
    })();
  }, [id]);

  const softWrites = trace.filter(t => t.kind === 'soft-write');
  const endEvent = trace.find(t => t.kind === 'end');
  const iterationCount = Math.max(0, ...trace.map(t => t.iteration || 0));

  return (
    <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
      <h1>Session complete</h1>
      <div style={{ color: '#666', marginBottom: 24 }}>
        {iterationCount} iterations · ended with {endEvent?.payload?.reason || 'unknown'}
      </div>

      <h3>Actions taken</h3>
      {softWrites.length === 0 ? (
        <div style={{ color: '#999', fontStyle: 'italic' }}>No persistent actions.</div>
      ) : (
        <ul>
          {softWrites.map((sw, i) => (
            <li key={i}>
              <strong>{sw.payload.tool}</strong>
              {' '}<code style={{ fontSize: 12, color: '#666' }}>{JSON.stringify(sw.payload.args)}</code>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
        <button onClick={() => navigate('/')}>Go Home</button>
        <button onClick={() => navigate('/knowledge')}>View Knowledge Dashboard</button>
      </div>
    </div>
  );
}
