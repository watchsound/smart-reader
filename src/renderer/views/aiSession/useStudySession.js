/**
 * useStudySession — manages local UI state for a running AI study session (Phase 10b-2).
 *
 * Subscribes to the trace stream for `sessionId` via sessionApi and accumulates
 * events into `trace[]`. Special event kinds are promoted to top-level state so
 * consumers never have to scan the trace themselves:
 *   - `openSurface`  → pendingSurface (cleared on submitUserResult)
 *   - `end`          → status 'completed' + endReason
 *   - `error` (fatal)→ status 'errored'  + endReason
 *
 * Exposes submitUserResult / cancel / undoSoftWrite as stable callbacks that
 * delegate straight to sessionApi; no local optimistic state is applied here —
 * the next trace event from the director is the source of truth.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import sessionApi from '../../api/sessionApi';

export default function useStudySession(sessionId) {
  const [trace, setTrace] = useState([]);
  const [pendingSurface, setPendingSurface] = useState(null);
  const [status, setStatus] = useState('active');
  const [endReason, setEndReason] = useState(null);
  const [iteration, setIteration] = useState(0);
  // traceRef keeps the accumulated list in sync without stale-closure issues
  const traceRef = useRef([]);

  useEffect(() => {
    if (!sessionId) return undefined;

    const unsubscribe = sessionApi.subscribeTrace(sessionId, (event) => {
      traceRef.current = [...traceRef.current, event];
      setTrace(traceRef.current);

      if (typeof event.iteration === 'number') setIteration(event.iteration);

      if (event.kind === 'openSurface') {
        setPendingSurface(event.payload);
      }

      if (event.kind === 'end') {
        setStatus('completed');
        setEndReason(event.payload?.reason ?? null);
      }

      if (event.kind === 'error' && event.payload?.fatal) {
        setStatus('errored');
        setEndReason(event.payload?.message ?? null);
      }
    });

    return unsubscribe;
  }, [sessionId]);

  const submitUserResult = useCallback(async (result) => {
    if (!sessionId) return;
    await sessionApi.userResult(sessionId, result);
    setPendingSurface(null);
  }, [sessionId]);

  const cancel = useCallback(
    () => sessionApi.cancel(sessionId),
    [sessionId],
  );

  const undoSoftWrite = useCallback(
    (softWriteId) => sessionApi.undoSoftWrite(sessionId, softWriteId),
    [sessionId],
  );

  return { trace, pendingSurface, status, endReason, iteration, submitUserResult, cancel, undoSoftWrite };
}
