import React from 'react';

const DAY = 86_400_000;

export default function MasterySparkline({ series, projection, width = 320, height = 40 }) {
  if (!series || series.length === 0) {
    return <div style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>No history</div>;
  }
  const anchorTs = series[series.length - 1].ts;
  const lastMastery = series[series.length - 1].mastery || 0;
  const projSeries = projection && projection.series && !projection.insufficientData
    ? projection.series.map((p) => ({ ts: anchorTs + p.day * DAY, mastery: p.mastery, isProjection: true }))
    : [];

  const all = series.concat(projSeries);
  const xs = all.map((s) => s.ts);
  const ys = all.map((s) => (typeof s.mastery === 'number' ? s.mastery : 0));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = 0;
  const yMax = Math.max(100, ...ys);
  const pad = 4;
  const xScale = (t) => pad + ((t - xMin) / Math.max(1, xMax - xMin)) * (width - 2 * pad);
  const yScale = (v) => height - pad - ((v - yMin) / Math.max(1, yMax - yMin)) * (height - 2 * pad);

  const histPoints = series
    .map((s) => `${xScale(s.ts).toFixed(1)},${yScale(s.mastery || 0).toFixed(1)}`)
    .join(' ');
  const projPoints = projSeries.length
    ? [
        `${xScale(anchorTs).toFixed(1)},${yScale(lastMastery).toFixed(1)}`,
        ...projSeries.map((s) => `${xScale(s.ts).toFixed(1)},${yScale(s.mastery).toFixed(1)}`),
      ].join(' ')
    : null;

  return (
    <svg width={width} height={height} style={{ background: '#f7f7f9', borderRadius: 4 }}>
      <polyline fill="none" stroke="#69a" strokeWidth="2" points={histPoints} />
      {projPoints && (
        <polyline
          fill="none"
          stroke="#69a"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          points={projPoints}
        />
      )}
      {series.map((s, i) => (
        <circle key={i} cx={xScale(s.ts)} cy={yScale(s.mastery || 0)} r="2" fill="#69a">
          <title>{`${new Date(s.ts).toLocaleString()} — mastery ${s.mastery}, ${s.eventType}`}</title>
        </circle>
      ))}
    </svg>
  );
}
