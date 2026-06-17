import React from 'react';

function Strip({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

export default function MasterySnapshotStrip({ data }) {
  if (!data || data.length === 0) {
    return <Strip title="Mastery Snapshot"><em style={{ color: '#999' }}>No data</em></Strip>;
  }

  const domains = [...new Set(data.map(d => d.domain))];

  return (
    <Strip title="Mastery Snapshot">
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Domain</th>
            {[1, 2, 3, 4, 5].map(b => (
              <th key={b} style={{ textAlign: 'center', padding: '4px 8px' }}>Box {b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {domains.map(d => (
            <tr key={d}>
              <td style={{ padding: '4px 8px' }}>{d}</td>
              {[1, 2, 3, 4, 5].map(b => {
                const row = data.find(x => x.domain === d && x.box === b);
                const count = row?.count || 0;
                return (
                  <td
                    key={b}
                    style={{
                      textAlign: 'center',
                      padding: '4px 8px',
                      background: `rgba(40,120,200,${Math.min(0.6, count / 20)})`,
                      color: count > 10 ? '#fff' : '#333',
                    }}
                  >
                    {count || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Strip>
  );
}
