import React from 'react';

function Strip({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

export default function RecentSessionsTable({ rows, onRowClick }) {
  if (!rows || rows.length === 0) {
    return (
      <Strip title="Recent Sessions">
        <em style={{ color: '#999' }}>No sessions in this window</em>
      </Strip>
    );
  }

  return (
    <Strip title="Recent Sessions">
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Started</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Goal</th>
            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Iter</th>
            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Cost</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => onRowClick?.(r)} style={{ cursor: 'pointer' }}>
              <td style={{ padding: '4px 8px' }}>{new Date(r.startedAt).toLocaleString()}</td>
              <td style={{ padding: '4px 8px' }}>{r.goal}</td>
              <td style={{ textAlign: 'center', padding: '4px 8px' }}>{r.iteration}/{r.budget}</td>
              <td style={{ textAlign: 'right', padding: '4px 8px' }}>${(r.totalCost || 0).toFixed(4)}</td>
              <td style={{ padding: '4px 8px' }}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Strip>
  );
}
