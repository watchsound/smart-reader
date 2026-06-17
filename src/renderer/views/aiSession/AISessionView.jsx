/**
 * AISessionView — shell for a live AI-directed study session (Phase 10b-2, Task 5).
 *
 * Layout:
 *   Header row: Quest pill (goal), iteration counter, End button
 *   Body:       30% TraceSidebar | 70% SurfaceFrame
 *
 * Navigation: navigates to /ai-session/:id/summary when status reaches
 * 'completed' or 'errored' (SessionSummaryView added in Task 7).
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import sessionApi from '../../api/sessionApi';
import useStudySession from './useStudySession';
import TraceSidebar from './TraceSidebar';
import SurfaceFrame from './SurfaceFrame';

export default function AISessionView() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const {
    trace,
    pendingSurface,
    status,
    iteration,
    submitUserResult,
    cancel,
    undoSoftWrite,
  } = useStudySession(sessionId);

  useEffect(() => {
    (async () => {
      try {
        setMeta(await sessionApi.get(sessionId));
      } catch (e) {
        /* fail silent — header degrades to 'Loading...' */
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    if (status === 'completed' || status === 'errored') {
      navigate(`/ai-session/${sessionId}/summary`, { replace: true });
    }
  }, [status, sessionId, navigate]);

  // Before any trace events arrive (iteration === 0), seed from meta so the
  // counter shows a meaningful value immediately after meta loads.
  const displayIteration = iteration > 0 ? iteration : (meta?.iteration ?? 0);

  const lastThought = [...trace]
    .reverse()
    .find((t) => t.kind === 'thought')?.payload?.reasoning;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* ── Header ── */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span
          style={{
            background: '#9ad',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 12,
          }}
        >
          {meta?.goal || 'Loading...'}
        </span>
        <span style={{ color: '#666', fontSize: 13 }}>
          iter {displayIteration}/{meta?.budget ?? 12}
        </span>
        <span style={{ flex: 1 }} />
        <button onClick={() => cancel()}>End session</button>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <TraceSidebar trace={trace} onUndo={undoSoftWrite} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <SurfaceFrame
            pendingSurface={pendingSurface}
            onSubmit={submitUserResult}
            lastThought={lastThought}
          />
        </div>
      </div>
    </div>
  );
}
