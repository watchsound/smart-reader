import React from 'react';

export default function MasterySparkline({ series, width = 320, height = 40 }) {
  if (!series || series.length === 0) {
    return <div style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>No history</div>;
  }
  const xs = series.map(s => s.ts);
  const ys = series.map(s => (typeof s.mastery === 'number' ? s.mastery : 0));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = 0, yMax = Math.max(100, ...ys);
  const pad = 4;
  const xScale = t => pad + ((t - xMin) / Math.max(1, xMax - xMin)) * (width - 2 * pad);
  const yScale = v => height - pad - ((v - yMin) / Math.max(1, yMax - yMin)) * (height - 2 * pad);
  const points = series.map(s => `${xScale(s.ts).toFixed(1)},${yScale(s.mastery || 0).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ background: '#f7f7f9', borderRadius: 4 }}>
      <polyline fill="none" stroke="#69a" strokeWidth="2" points={points} />
      {series.map((s, i) => (
        <circle key={i} cx={xScale(s.ts)} cy={yScale(s.mastery || 0)} r="2" fill="#69a">
          <title>{`${new Date(s.ts).toLocaleString()} — mastery ${s.mastery}, ${s.eventType}`}</title>
        </circle>
      ))}
    </svg>
  );
}
