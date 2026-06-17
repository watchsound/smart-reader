import React from 'react';

function Strip({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

export default function TopTouchedConceptsTable({ rows, onRowClick }) {
  if (!rows || rows.length === 0) {
    return (
      <Strip title="Top-Touched Concepts">
        <em style={{ color: '#999' }}>No concept-attributed Brain decisions in this window</em>
      </Strip>
    );
  }

  return (
    <Strip title="Top-Touched Concepts">
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Concept</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Domain</th>
            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Decisions</th>
            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Box</th>
            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Mastery</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => onRowClick?.(r)} style={{ cursor: 'pointer' }}>
              <td style={{ padding: '4px 8px' }}>{r.title}</td>
              <td style={{ padding: '4px 8px' }}>{r.domain}</td>
              <td style={{ textAlign: 'center', padding: '4px 8px' }}>{r.decisionCount}</td>
              <td style={{ textAlign: 'center', padding: '4px 8px' }}>{r.box}</td>
              <td style={{ textAlign: 'center', padding: '4px 8px' }}>{r.masteryPct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Strip>
  );
}
