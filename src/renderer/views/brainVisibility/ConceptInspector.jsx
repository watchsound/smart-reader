import React, { useEffect, useState } from 'react';
import brainVisibilityApi from '../../api/brainVisibilityApi';
import LineageTimeline from './LineageTimeline';
import MasterySparkline from './MasterySparkline';

export default function ConceptInspector({ learningPointId, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (learningPointId == null) {
      setData(null);
      return;
    }
    brainVisibilityApi.concept({ learningPointId }).then(setData);
  }, [learningPointId]);

  if (learningPointId == null) return null;
  if (!data)
    return (
      <Drawer onClose={onClose}>
        <div style={{ padding: 24 }}>Loading...</div>
      </Drawer>
    );
  if (!data.meta)
    return (
      <Drawer onClose={onClose}>
        <div style={{ padding: 24 }}>Concept not found.</div>
      </Drawer>
    );

  return (
    <Drawer onClose={onClose}>
      <div style={{ padding: 16 }}>
        <h2 style={{ margin: 0 }}>{data.meta.title}</h2>
        <div
          style={{
            display: 'flex',
            gap: 10,
            fontSize: 12,
            color: '#666',
            marginTop: 6,
          }}
        >
          <span style={{ background: '#eef', padding: '2px 8px', borderRadius: 10 }}>
            {data.meta.domain}
          </span>
          <span>box {data.meta.box}</span>
          <span>mastery {data.meta.masteryPct}%</span>
          {data.meta.nextReview && <span>next: {data.meta.nextReview}</span>}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#666',
            margin: '12px 0',
            padding: '6px 0',
            borderTop: '1px solid #eee',
            borderBottom: '1px solid #eee',
          }}
        >
          Cost to date: <strong>${data.costToDate.toFixed(4)}</strong>
        </div>
        {data.boxOverTime && data.boxOverTime.length > 0
          ? <MasterySparkline series={data.boxOverTime} />
          : <span style={{ marginLeft: 12, fontStyle: 'italic', color: '#999', fontSize: 12 }}>(snapshot only)</span>}
        <h3 style={{ fontSize: 14, marginBottom: 8, marginTop: 16 }}>Lineage</h3>
        <LineageTimeline events={data.lineage} />
      </div>
    </Drawer>
  );
}

function Drawer({ children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 480,
        maxWidth: '95vw',
        height: '100vh',
        background: '#fff',
        boxShadow: '-2px 0 12px rgba(0,0,0,0.15)',
        zIndex: 9000,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 8 }}>
        <button
          onClick={onClose}
          aria-label="close"
          style={{ fontSize: 18, background: 'none', border: 0, cursor: 'pointer' }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}
