import React from 'react';

const COLORS = {
  director: '#9ad',
  legacy: '#cae',
  extraction: '#9c9',
  other: '#bbb',
};

const CLASSES = ['director', 'legacy', 'extraction', 'other'];

function Strip({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

export default function BrainActivityTimelineStrip({ data }) {
  if (!data || data.length === 0) {
    return (
      <Strip title="Brain Activity Timeline">
        <em style={{ color: '#999' }}>No activity in this window</em>
      </Strip>
    );
  }

  const byDay = {};
  for (const r of data) {
    if (!byDay[r.day]) {
      byDay[r.day] = { day: r.day, director: 0, legacy: 0, extraction: 0, other: 0, cost: 0 };
    }
    const cls = CLASSES.includes(r.intentClass) ? r.intentClass : 'other';
    byDay[r.day][cls] += r.count;
    byDay[r.day].cost += r.cost || 0;
  }

  const days = Object.values(byDay).sort((a, b) => (a.day < b.day ? 1 : -1));
  const maxCount = Math.max(1, ...days.map(d => d.director + d.legacy + d.extraction + d.other));

  return (
    <Strip title="Brain Activity Timeline">
      {days.map(d => {
        const total = d.director + d.legacy + d.extraction + d.other;
        return (
          <div key={d.day} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ width: 90, fontSize: 11, color: '#666' }}>{d.day}</div>
            <div style={{ flex: 1, display: 'flex', height: 14 }}>
              {CLASSES.map(cls =>
                d[cls] > 0 ? (
                  <div
                    key={cls}
                    title={`${cls}: ${d[cls]}`}
                    style={{ width: `${(d[cls] / maxCount) * 100}%`, background: COLORS[cls] }}
                  />
                ) : null
              )}
            </div>
            <div style={{ width: 80, fontSize: 11, color: '#666', textAlign: 'right' }}>
              {total} · ${d.cost.toFixed(3)}
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#666', marginTop: 6 }}>
        {Object.entries(COLORS).map(([k, c]) => (
          <span key={k}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                background: c,
                marginRight: 4,
              }}
            />
            {k}
          </span>
        ))}
      </div>
    </Strip>
  );
}
