import React, { useEffect, useState } from 'react';

let _learningPointApi = null;
try {
  // eslint-disable-next-line global-require
  _learningPointApi = require('../../../api/learningPointApi').default;
} catch (e) {
  // api unavailable; LeitnerSurface will stay in loading state
}

export default function LeitnerSurface({ args, onSubmit }) {
  const [lp, setLp] = useState(null);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!_learningPointApi) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await _learningPointApi.get(args.learningPointId);
        if (!cancelled) setLp(data);
      } catch (e) {
        // fallback: stay in loading state indefinitely
      }
    })();
    return () => { cancelled = true; };
  }, [args.learningPointId]);

  const rate = (rating) => onSubmit({ rating, durationMs: Date.now() - startedAt });

  if (!lp) {
    return <div style={{ padding: 24 }}>Loading card #{args.learningPointId}...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h2>{lp.title || lp.headword}</h2>
      <div style={{ fontSize: 16, color: '#555', marginBottom: 24 }}>{lp.definition || lp.content}</div>
      <div style={{ display: 'flex', gap: 12 }}>
        {['again', 'hard', 'good', 'easy'].map((r) => (
          <button key={r} onClick={() => rate(r)} style={{ padding: '8px 16px' }}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
