import React from 'react';

const COLORS = { vocabulary: '#69a', concept: '#9c6', code: '#c69', math: '#c96', other: '#999' };

export default function MasteryTrajectoryStrip({ data }) {
  if (!data || data.length === 0) {
    return (
      <Strip title="Mastery Trajectory">
        <em style={{ color: '#999' }}>No mastery events in this window</em>
      </Strip>
    );
  }
  const byDomain = {};
  for (const r of data) {
    if (!byDomain[r.domain]) byDomain[r.domain] = [];
    byDomain[r.domain].push(r);
  }
  const allDays = [...new Set(data.map(d => d.day))].sort();
  const dayIdx = Object.fromEntries(allDays.map((d, i) => [d, i]));
  const width = 400, height = 80, pad = 6;
  const xScale = i => pad + (i / Math.max(1, allDays.length - 1)) * (width - 2 * pad);
  const yScale = m => height - pad - (m / 100) * (height - 2 * pad);
  return (
    <Strip title="Mastery Trajectory">
      <svg width={width} height={height} style={{ background: '#f7f7f9', borderRadius: 4 }}>
        {Object.entries(byDomain).map(([domain, rows]) => {
          const sorted = [...rows].sort((a, b) => a.day < b.day ? -1 : 1);
          const points = sorted.map(r => `${xScale(dayIdx[r.day]).toFixed(1)},${yScale(r.avgMastery).toFixed(1)}`).join(' ');
          return <polyline key={domain} fill="none" stroke={COLORS[domain] || COLORS.other} strokeWidth="2" points={points} />;
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#666', marginTop: 4 }}>
        {Object.keys(byDomain).map(d => (
          <span key={d}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: COLORS[d] || COLORS.other, marginRight: 4 }} />
            {d}
          </span>
        ))}
      </div>
    </Strip>
  );
}

function Strip({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>
      {children}
    </div>
  );
}
