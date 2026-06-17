import React, { useEffect, useState } from 'react';
import brainVisibilityApi from '../../api/brainVisibilityApi';
import MasterySnapshotStrip from './MasterySnapshotStrip';
import MasteryTrajectoryStrip from './MasteryTrajectoryStrip';
import BrainActivityTimelineStrip from './BrainActivityTimelineStrip';
import RecentSessionsTable from './RecentSessionsTable';
import TopTouchedConceptsTable from './TopTouchedConceptsTable';

const WINDOWS = ['7d', '30d', '90d'];

export default function BrainActivityDashboard({ onConceptClick }) {
  const [activeWindow, setActiveWindow] = useState('30d');
  const [data, setData] = useState(null);

  useEffect(() => {
    brainVisibilityApi.dashboard({ window: activeWindow }).then(setData);
  }, [activeWindow]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {WINDOWS.map(w => (
          <button
            key={w}
            onClick={() => setActiveWindow(w)}
            style={{
              padding: '4px 12px',
              background: w === activeWindow ? '#9ad' : '#eee',
              color: w === activeWindow ? '#fff' : '#333',
              border: 0,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {w}
          </button>
        ))}
      </div>
      {!data ? (
        <div style={{ color: '#999', padding: 24 }}>Loading...</div>
      ) : (
        <>
          <MasterySnapshotStrip data={data.mastery} />
          <MasteryTrajectoryStrip data={data.masteryTrajectory} />
          <BrainActivityTimelineStrip data={data.timeline} />
          <RecentSessionsTable
            rows={data.sessions}
            onRowClick={s => onConceptClick?.(s.firstTouchedConceptId)}
          />
          <TopTouchedConceptsTable
            rows={data.topConcepts}
            onRowClick={c => onConceptClick?.(c.id)}
          />
        </>
      )}
    </div>
  );
}
