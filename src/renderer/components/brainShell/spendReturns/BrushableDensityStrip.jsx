/**
 * BrushableDensityStrip
 *
 * Visual idiom mirrors MasteryTrajectoryStrip (SVG rect-per-day, #f7f7f9 background,
 * primary blue fill, inline styles) with an added brush layer: two handle rects let the
 * user drag the time window used by ROITab's attribution bars.
 *
 * Props:
 *   densityData  { day: string (YYYY-MM-DD), count: number }[]
 *   selected     { from: number, to: number }  — epoch-ms window
 *   onChange     (newWindow: { from: number, to: number }) => void
 */
import React, { useState, useEffect, useRef } from 'react';

const STRIP_HEIGHT = 64;
const HANDLE_WIDTH = 6;
const DEFAULT_WIDTH = 640;
const BAR_MAX_H = STRIP_HEIGHT - 12; // 6px top + 6px bottom padding
const DAY_MS = 86_400_000;

// Match MasteryTrajectoryStrip's primary color token (inline, no MUI dependency so tests
// stay lightweight — consistent with the reference file that uses plain inline styles).
const PRIMARY_COLOR = '#4a90d9';

export default function BrushableDensityStrip({ densityData = [], selected, onChange }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  // Use refs for mutable state so window event listeners registered once can read
  // current values without needing to be re-registered on every state change.
  const draggingRef = useRef(null);
  const [dragging, setDragging] = useState(null); // drives re-render only
  const selectedRef = useRef(selected);
  const widthRef = useRef(width);
  const onChangeRef = useRef(onChange);
  const densityDataRef = useRef(densityData);

  // Keep refs in sync on every render
  selectedRef.current = selected;
  widthRef.current = width;
  onChangeRef.current = onChange;
  densityDataRef.current = densityData;

  // Responsive width via ResizeObserver (guard for jsdom/test environments where it's absent)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(120, w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Empty state — mirrors MasteryTrajectoryStrip empty branch
  if (densityData.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          height: STRIP_HEIGHT,
          background: '#f7f7f9',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 12,
          marginBottom: 8,
        }}
      >
        <em style={{ color: '#999', fontSize: 13 }}>No mastery events recorded yet.</em>
      </div>
    );
  }

  // Day-to-timestamp array (UTC midnight)
  const days = densityData.map((d) => Date.parse(d.day + 'T00:00:00Z'));
  const firstDay = days[0];
  const lastDay = days[days.length - 1] + DAY_MS; // exclusive end of last day
  const totalRange = Math.max(DAY_MS, lastDay - firstDay);
  const maxCount = Math.max(1, ...densityData.map((d) => d.count));

  const tsToX = (ts) => ((ts - firstDay) / totalRange) * width;
  const xToTs = (x) => firstDay + (x / width) * totalRange;

  const clampedFrom = Math.max(firstDay, selected?.from ?? firstDay);
  const clampedTo = Math.min(lastDay, selected?.to ?? lastDay);
  const fromX = tsToX(clampedFrom);
  const toX = tsToX(clampedTo);

  // Register window listeners once; read state from refs so they never go stale.
  // This avoids the test-environment timing issue where pointerMove fires before
  // a useEffect([dragging]) would re-register listeners after a state flush.
  useEffect(() => {
    function onMove(e) {
      if (!draggingRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      // In jsdom getBoundingClientRect returns all zeros — treat left=0
      const rectLeft = rect ? rect.left : 0;
      const w = widthRef.current;
      const sel = selectedRef.current;
      const x = Math.max(0, Math.min(w, e.clientX - rectLeft));
      // Recompute xToTs with current refs (densityData may have changed since mount)
      const dd = densityDataRef.current;
      const fd = Date.parse(dd[0]?.day + 'T00:00:00Z') || 0;
      const ld = Date.parse(dd[dd.length - 1]?.day + 'T00:00:00Z') + DAY_MS || DAY_MS;
      const range = Math.max(DAY_MS, ld - fd);
      const ts = fd + (x / w) * range;
      if (draggingRef.current === 'left') {
        onChangeRef.current?.({ from: Math.min(ts, sel.to - DAY_MS), to: sel.to });
      } else {
        onChangeRef.current?.({ from: sel.from, to: Math.max(ts, sel.from + DAY_MS) });
      }
    }

    function onUp() {
      draggingRef.current = null;
      setDragging(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dayWidth = Math.max(1, width / densityData.length - 1);

  return (
    <div ref={containerRef} style={{ width: '100%', marginBottom: 8 }}>
      <svg
        width={width}
        height={STRIP_HEIGHT}
        style={{ display: 'block', background: '#f7f7f9', borderRadius: 4 }}
      >
        {/* Day bars */}
        {densityData.map((d, i) => {
          const x = tsToX(days[i]);
          const barH = d.count === 0 ? 1 : (d.count / maxCount) * BAR_MAX_H;
          const y = STRIP_HEIGHT - barH - 6;
          return (
            <rect
              key={d.day}
              className="density-day"
              x={x}
              y={y}
              width={dayWidth}
              height={barH}
              fill={PRIMARY_COLOR}
              opacity={0.4}
            >
              <title>{`${d.day}: ${d.count} events`}</title>
            </rect>
          );
        })}

        {/* Selection region highlight */}
        <rect
          className="brush-region"
          x={fromX}
          y={0}
          width={Math.max(0, toX - fromX)}
          height={STRIP_HEIGHT}
          fill={PRIMARY_COLOR}
          opacity={0.12}
        />

        {/* Left brush handle */}
        <rect
          className="brush-handle brush-handle-left"
          x={fromX - HANDLE_WIDTH / 2}
          y={0}
          width={HANDLE_WIDTH}
          height={STRIP_HEIGHT}
          fill={PRIMARY_COLOR}
          opacity={0.75}
          rx={2}
          style={{ cursor: 'ew-resize' }}
          onPointerDown={(e) => {
            // setPointerCapture may be absent in jsdom
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
            draggingRef.current = 'left';
            setDragging('left');
          }}
        />

        {/* Right brush handle */}
        <rect
          className="brush-handle brush-handle-right"
          x={toX - HANDLE_WIDTH / 2}
          y={0}
          width={HANDLE_WIDTH}
          height={STRIP_HEIGHT}
          fill={PRIMARY_COLOR}
          opacity={0.75}
          rx={2}
          style={{ cursor: 'ew-resize' }}
          onPointerDown={(e) => {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
            draggingRef.current = 'right';
            setDragging('right');
          }}
        />
      </svg>
    </div>
  );
}
