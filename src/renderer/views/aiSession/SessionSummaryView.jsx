import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import sessionApi from '../../api/sessionApi';

export default function SessionSummaryView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trace, setTrace] = useState([]);
  const [traceId, setTraceId] = useState(null);

  useEffect(() => {
    (async () => {
      const result = await sessionApi.getTrace(id);
      // getTrace returns { traceId, events }; accept a plain array too for backwards compat.
      const events = Array.isArray(result) ? result : (result?.events || []);
      const tid = Array.isArray(result) ? null : (result?.traceId || null);
      setTrace(events);
      setTraceId(tid);
    })();
  }, [id]);

  const softWrites = trace.filter(t => t.kind === 'soft-write');
  const endEvent = trace.find(t => t.kind === 'end');
  const iterationCount = Math.max(0, ...trace.map(t => t.iteration || 0));

  // Phase 15a-3: surface per-step rationale. Group thought/tool/observation/
  // soft-write/surface events by iteration so the user sees the Director's
  // reasoning, the tool it chose, and the outcome — together, in order.
  const stepMap = new Map();
  for (const ev of trace) {
    const iter = ev.iteration;
    if (typeof iter !== 'number') continue;
    if (!stepMap.has(iter)) stepMap.set(iter, { iteration: iter });
    const step = stepMap.get(iter);
    if (ev.kind === 'thought') step.thought = ev.payload?.reasoning;
    else if (ev.kind === 'tool') step.tool = ev.payload;
    else if (ev.kind === 'observation') step.observation = ev.payload;
    else if (ev.kind === 'soft-write') step.softWrite = ev.payload;
    else if (ev.kind === 'surface') step.surface = ev.payload;
    else if (ev.kind === 'error') step.error = ev.payload?.message;
  }
  const steps = Array.from(stepMap.values()).sort((a, b) => a.iteration - b.iteration);

  return (
    <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
      <h1>Session complete</h1>
      <div style={{ color: '#666', marginBottom: 24 }}>
        {iterationCount} iterations · ended with {endEvent?.payload?.reason || 'unknown'}
        {traceId && (
          <span style={{ marginLeft: 12 }}>
            <code style={{ fontSize: 11, color: '#999' }}>trace {traceId.slice(0, 8)}</code>
          </span>
        )}
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

      {steps.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Director rationale, step by step</h3>
          <ol style={{ paddingLeft: 20 }}>
            {steps.map((s) => (
              <li key={s.iteration} style={{ marginBottom: 16, lineHeight: 1.45 }}>
                {s.thought && (
                  <div style={{ color: '#374151', fontStyle: 'italic', marginBottom: 4 }}>
                    “{s.thought}”
                  </div>
                )}
                {s.tool && (
                  <div style={{ fontSize: 13 }}>
                    <strong>Tool:</strong> <code>{s.tool.tool}</code>
                    {s.tool.args && Object.keys(s.tool.args).length > 0 && (
                      <span style={{ color: '#666' }}> {JSON.stringify(s.tool.args)}</span>
                    )}
                  </div>
                )}
                {s.surface && (
                  <div style={{ fontSize: 12, color: '#0a6' }}>
                    → opened surface {s.surface.surface || JSON.stringify(s.surface)}
                  </div>
                )}
                {s.observation && (
                  <div style={{ fontSize: 12, color: '#555' }}>
                    → {s.observation.summary || s.observation.tool}
                  </div>
                )}
                {s.softWrite && (
                  <div style={{ fontSize: 12, color: '#06a' }}>
                    ✎ {s.softWrite.tool} {JSON.stringify(s.softWrite.args || {})}
                  </div>
                )}
                {s.error && (
                  <div style={{ fontSize: 12, color: '#c33' }}>! {s.error}</div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
        <button onClick={() => navigate('/')}>Go Home</button>
        <button onClick={() => navigate('/knowledge')}>View Knowledge Dashboard</button>
      </div>
    </div>
  );
}
