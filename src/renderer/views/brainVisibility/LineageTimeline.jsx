import React from 'react';

const KIND_LABELS = {
  created: '✨ Created',
  'brain-decision': '🧠 Brain decision',
  'user-review': '👤 Reviewed',
  mastered: '🏆 Mastered',
};

export default function LineageTimeline({ events }) {
  if (!events || events.length === 0)
    return <em style={{ color: '#999' }}>No lineage events</em>;
  return (
    <div>
      {events.map((ev, i) => (
        <div key={i} style={{ padding: 8, borderLeft: '3px solid #9ad', marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: '#888' }}>
            {KIND_LABELS[ev.kind] || ev.kind} · {new Date(ev.ts).toLocaleString()}
          </div>
          <div style={{ fontSize: 13 }}>
            {ev.kind === 'created' && (
              <>
                From <code>{ev.sourceType}</code> / <code>{ev.sourceId}</code>
              </>
            )}
            {ev.kind === 'brain-decision' && (
              <>
                {ev.tool}{' '}
                {ev.sessionId && (
                  <code style={{ fontSize: 11 }}>(session {ev.sessionId.slice(0, 8)})</code>
                )}
              </>
            )}
            {ev.kind === 'user-review' && <>Rating: {ev.rating}</>}
            {ev.kind === 'mastered' && <>Mastery: {ev.finalMastery}%</>}
          </div>
        </div>
      ))}
    </div>
  );
}
