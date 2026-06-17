# Phase 10b-2 — Study-Session Director UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make Plan 10b-1's headless SessionRunner usable by a real user. New `/ai-session/:id` route with live TraceSidebar, SurfaceFrame that renders one of four purpose-built session surfaces, start + summary dialogs, BrainOrb right-click integration, crash-recovery resume.

**Architecture:** Renderer talks to main via `sessionApi` (Plan 10b-1). Each tool kind dispatches to a renderer concern:
- Reads/soft-writes: shown in TraceSidebar as the SessionRunner broadcasts them; user doesn't interact.
- Surfaces: SessionRunner broadcasts `{ kind: 'openSurface', payload: { tool, args } }`; SurfaceFrame renders the matching adapter; adapter calls `sessionApi.userResult(sessionId, result)` on completion.
- Control (endSession): broadcast → navigate to SessionSummaryView.

**Scope note (purpose-built surfaces, NOT canonical ones):** Each surface adapter (Leitner, Comprehension, MicroCardChip, MoodBoard) is a thin component purpose-built for `/ai-session`. It does NOT embed the full canonical UI from `/study`, `EPubView`, or `/moodboard`. Canonical-surface integration is Plan 10b-3.

**Tech Stack:** React + Redux Toolkit + React Router (existing project setup). Material-UI (or whatever the project uses — verify by reading existing views).

**Conventions:**
- Run single test with `npx jest <path>`.
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit ...`.
- Don't write git config; don't skip pre-commit hooks.
- Stay on `main` branch; no destructive git ops.

**Spec:** [`docs/superpowers/specs/2026-06-17-phase-10b-study-session-director-design.md`](../specs/2026-06-17-phase-10b-study-session-director-design.md)
**Foundation plan:** [`docs/superpowers/plans/2026-06-17-phase-10b-1-session-foundation.md`](2026-06-17-phase-10b-1-session-foundation.md)

---

## File Map

**Create**
- `src/renderer/views/aiSession/AISessionView.jsx`
- `src/renderer/views/aiSession/TraceSidebar.jsx`
- `src/renderer/views/aiSession/SurfaceFrame.jsx`
- `src/renderer/views/aiSession/SessionStartDialog.jsx`
- `src/renderer/views/aiSession/SessionSummaryView.jsx`
- `src/renderer/views/aiSession/surfaces/LeitnerSurface.jsx`
- `src/renderer/views/aiSession/surfaces/ComprehensionSurface.jsx`
- `src/renderer/views/aiSession/surfaces/MicroCardChipSurface.jsx`
- `src/renderer/views/aiSession/surfaces/MoodBoardSurface.jsx`
- `src/renderer/views/aiSession/useStudySession.js`
- `src/__tests__/renderer/aiSession/AISessionView.test.jsx`
- `src/__tests__/renderer/aiSession/TraceSidebar.test.jsx`
- `src/__tests__/renderer/aiSession/SurfaceFrame.test.jsx`
- `src/__tests__/renderer/aiSession/useStudySession.test.js`

**Modify**
- One renderer routing file (find via `grep -rn "Route path" src/renderer/`; likely `Root.jsx` or `App.jsx`)
- `src/renderer/components/brainShell/BrainOrb.jsx` (or wherever right-click menu is wired) — new "Start AI Session" item
- `src/renderer/components/brainShell/BrainShell.jsx` (or equivalent) — resume pill on mount

---

### Task 1: `useStudySession` hook — state, trace subscription, lifecycle

**Files:**
- Create: `src/renderer/views/aiSession/useStudySession.js`
- Test: `src/__tests__/renderer/aiSession/useStudySession.test.js`

- [ ] **Step 1: Write failing test**

```js
// src/__tests__/renderer/aiSession/useStudySession.test.js
import { renderHook, act } from '@testing-library/react';

const fakeApi = {
  subscribeTrace: jest.fn(),
  get: jest.fn().mockResolvedValue({ id: 's1', goal: 'g', iteration: 0, budget: 12, trace: [], pendingSurface: null }),
  userResult: jest.fn(),
  cancel: jest.fn(),
  undoSoftWrite: jest.fn(),
};
jest.mock('../../../renderer/api/sessionApi', () => ({ default: fakeApi }));

import useStudySession from '../../../renderer/views/aiSession/useStudySession';

test('subscribes to trace on mount, unsubscribes on unmount', () => {
  const unsubscribe = jest.fn();
  fakeApi.subscribeTrace.mockReturnValue(unsubscribe);
  const { unmount } = renderHook(() => useStudySession('s1'));
  expect(fakeApi.subscribeTrace).toHaveBeenCalledWith('s1', expect.any(Function));
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});

test('appends trace events to state', () => {
  let handler;
  fakeApi.subscribeTrace.mockImplementation((id, fn) => { handler = fn; return jest.fn(); });
  const { result } = renderHook(() => useStudySession('s1'));
  act(() => handler({ sessionId: 's1', kind: 'thought', iteration: 0, payload: { reasoning: 'starting' } }));
  expect(result.current.trace).toHaveLength(1);
  expect(result.current.trace[0].kind).toBe('thought');
});

test('openSurface event sets pendingSurface', () => {
  let handler;
  fakeApi.subscribeTrace.mockImplementation((id, fn) => { handler = fn; return jest.fn(); });
  const { result } = renderHook(() => useStudySession('s1'));
  act(() => handler({ sessionId: 's1', kind: 'openSurface', payload: { tool: 'openLeitnerCard', args: { learningPointId: 42 } } }));
  expect(result.current.pendingSurface).toEqual({ tool: 'openLeitnerCard', args: { learningPointId: 42 } });
});

test('end event sets status to completed', () => {
  let handler;
  fakeApi.subscribeTrace.mockImplementation((id, fn) => { handler = fn; return jest.fn(); });
  const { result } = renderHook(() => useStudySession('s1'));
  act(() => handler({ sessionId: 's1', kind: 'end', iteration: 5, payload: { reason: 'done' } }));
  expect(result.current.status).toBe('completed');
  expect(result.current.endReason).toBe('done');
});

test('submitUserResult delegates to sessionApi.userResult and clears pendingSurface', async () => {
  let handler;
  fakeApi.subscribeTrace.mockImplementation((id, fn) => { handler = fn; return jest.fn(); });
  const { result } = renderHook(() => useStudySession('s1'));
  act(() => handler({ sessionId: 's1', kind: 'openSurface', payload: { tool: 'openLeitnerCard', args: {} } }));
  await act(async () => result.current.submitUserResult({ rating: 'easy' }));
  expect(fakeApi.userResult).toHaveBeenCalledWith('s1', { rating: 'easy' });
  expect(result.current.pendingSurface).toBe(null);
});
```

- [ ] **Step 2: Implement**

```js
// src/renderer/views/aiSession/useStudySession.js
import { useEffect, useState, useCallback, useRef } from 'react';
import sessionApi from '../../api/sessionApi';

export default function useStudySession(sessionId) {
  const [trace, setTrace] = useState([]);
  const [pendingSurface, setPendingSurface] = useState(null);
  const [status, setStatus] = useState('active');
  const [endReason, setEndReason] = useState(null);
  const [iteration, setIteration] = useState(0);
  const traceRef = useRef([]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const unsubscribe = sessionApi.subscribeTrace(sessionId, (event) => {
      traceRef.current = [...traceRef.current, event];
      setTrace(traceRef.current);
      if (typeof event.iteration === 'number') setIteration(event.iteration);
      if (event.kind === 'openSurface') setPendingSurface(event.payload);
      if (event.kind === 'end') {
        setStatus('completed');
        setEndReason(event.payload?.reason || null);
      }
      if (event.kind === 'error' && event.payload?.fatal) {
        setStatus('errored');
        setEndReason(event.payload?.message || null);
      }
    });
    return unsubscribe;
  }, [sessionId]);

  const submitUserResult = useCallback(async (result) => {
    if (!sessionId) return;
    await sessionApi.userResult(sessionId, result);
    setPendingSurface(null);
  }, [sessionId]);

  const cancel = useCallback(() => sessionApi.cancel(sessionId), [sessionId]);
  const undoSoftWrite = useCallback((softWriteId) => sessionApi.undoSoftWrite(sessionId, softWriteId), [sessionId]);

  return { trace, pendingSurface, status, endReason, iteration, submitUserResult, cancel, undoSoftWrite };
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/renderer/aiSession/useStudySession.test.js`
Expected: 5 passing.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/aiSession/useStudySession.js src/__tests__/renderer/aiSession/useStudySession.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-2): useStudySession hook for trace subscription + lifecycle"
```

---

### Task 2: `TraceSidebar` — live trace stream with Undo

**Files:**
- Create: `src/renderer/views/aiSession/TraceSidebar.jsx`
- Test: `src/__tests__/renderer/aiSession/TraceSidebar.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import TraceSidebar from '../../../renderer/views/aiSession/TraceSidebar';

const sampleTrace = [
  { kind: 'thought', iteration: 0, payload: { reasoning: 'starting review' } },
  { kind: 'tool', iteration: 0, payload: { tool: 'topUnmasteredConcepts' } },
  { kind: 'observation', iteration: 0, payload: { summary: '[5 concepts]' } },
  { kind: 'soft-write', iteration: 1, payload: { id: 'sw-1', tool: 'scheduleReread', args: { chapterId: 'ch-3' }, undone: false } },
  { kind: 'end', iteration: 5, payload: { reason: 'done' } },
];

test('renders trace events grouped by iteration', () => {
  render(<TraceSidebar trace={sampleTrace} onUndo={jest.fn()} />);
  expect(screen.getByText(/starting review/i)).toBeInTheDocument();
  expect(screen.getByText(/topUnmasteredConcepts/i)).toBeInTheDocument();
  expect(screen.getByText(/scheduleReread/i)).toBeInTheDocument();
});

test('soft-write rows show Undo button; clicking it calls onUndo with id', () => {
  const onUndo = jest.fn();
  render(<TraceSidebar trace={sampleTrace} onUndo={onUndo} />);
  const undoBtn = screen.getByRole('button', { name: /undo/i });
  fireEvent.click(undoBtn);
  expect(onUndo).toHaveBeenCalledWith('sw-1');
});

test('undone soft-writes show as struck-through and disable Undo', () => {
  const traceWithUndone = sampleTrace.map(e =>
    e.kind === 'soft-write' ? { ...e, payload: { ...e.payload, undone: true } } : e
  );
  render(<TraceSidebar trace={traceWithUndone} onUndo={jest.fn()} />);
  const row = screen.getByText(/scheduleReread/i).closest('[data-trace-row]');
  expect(row).toHaveAttribute('data-undone', 'true');
});
```

- [ ] **Step 2: Implement**

```jsx
// src/renderer/views/aiSession/TraceSidebar.jsx
import React from 'react';

const KIND_LABELS = {
  thought: '💭', tool: '🔧', observation: '👁️',
  surface: '🖥️', 'soft-write': '✍️', error: '⚠️', end: '🏁',
};

function TraceRow({ event, onUndo }) {
  const { kind, payload, iteration } = event;
  const isSoftWrite = kind === 'soft-write';
  const undone = isSoftWrite && payload.undone;
  return (
    <div
      data-trace-row
      data-undone={undone || undefined}
      style={{
        padding: '6px 10px',
        borderLeft: `3px solid ${KIND_COLORS[kind] || '#888'}`,
        marginBottom: 4,
        opacity: undone ? 0.5 : 1,
        textDecoration: undone ? 'line-through' : 'none',
      }}
    >
      <div style={{ fontSize: 11, color: '#888' }}>
        {KIND_LABELS[kind] || ''} iter {iteration} · {kind}
      </div>
      <div style={{ fontSize: 13 }}>
        {renderPayload(kind, payload)}
      </div>
      {isSoftWrite && !undone && (
        <button onClick={() => onUndo(payload.id)} style={{ fontSize: 11, marginTop: 4 }}>
          Undo
        </button>
      )}
    </div>
  );
}

const KIND_COLORS = {
  thought: '#9ad', tool: '#cae', observation: '#9c9',
  surface: '#ea9', 'soft-write': '#9ec', error: '#e88', end: '#aaa',
};

function renderPayload(kind, payload) {
  if (!payload) return null;
  if (kind === 'thought') return payload.reasoning || '';
  if (kind === 'tool') return `${payload.tool}(${JSON.stringify(payload.args || {}).slice(0, 50)})`;
  if (kind === 'observation') return payload.summary || '';
  if (kind === 'surface') return `${payload.tool}: awaiting user...`;
  if (kind === 'soft-write') return `${payload.tool}(${JSON.stringify(payload.args || {}).slice(0, 50)})`;
  if (kind === 'error') return payload.message || 'error';
  if (kind === 'end') return `end: ${payload.reason || 'unknown'}`;
  return JSON.stringify(payload);
}

export default function TraceSidebar({ trace, onUndo }) {
  return (
    <div style={{ width: '30%', minWidth: 280, overflowY: 'auto', padding: 12, background: '#f7f7f9', borderRight: '1px solid #e0e0e0' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>
        Director Trace
      </div>
      {trace.length === 0 && <div style={{ color: '#aaa', fontStyle: 'italic' }}>Waiting for first decision...</div>}
      {trace.map((event, i) => <TraceRow key={i} event={event} onUndo={onUndo} />)}
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/renderer/aiSession/TraceSidebar.test.jsx`
Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/aiSession/TraceSidebar.jsx src/__tests__/renderer/aiSession/TraceSidebar.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-2): TraceSidebar live trace + Undo on soft-writes"
```

---

### Task 3: Surface adapters — 4 thin components

**Files:**
- Create: `src/renderer/views/aiSession/surfaces/LeitnerSurface.jsx`
- Create: `src/renderer/views/aiSession/surfaces/ComprehensionSurface.jsx`
- Create: `src/renderer/views/aiSession/surfaces/MicroCardChipSurface.jsx`
- Create: `src/renderer/views/aiSession/surfaces/MoodBoardSurface.jsx`
- Test: `src/__tests__/renderer/aiSession/surfaces.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import LeitnerSurface from '../../../renderer/views/aiSession/surfaces/LeitnerSurface';
import ComprehensionSurface from '../../../renderer/views/aiSession/surfaces/ComprehensionSurface';
import MicroCardChipSurface from '../../../renderer/views/aiSession/surfaces/MicroCardChipSurface';
import MoodBoardSurface from '../../../renderer/views/aiSession/surfaces/MoodBoardSurface';

jest.mock('../../../renderer/api/learningPointApi', () => ({
  default: { get: jest.fn().mockResolvedValue({ id: 42, title: 'parse', definition: 'to analyze' }) },
}), { virtual: true });

test('LeitnerSurface: rating buttons fire onSubmit with rating', async () => {
  const onSubmit = jest.fn();
  render(<LeitnerSurface args={{ learningPointId: 42 }} onSubmit={onSubmit} />);
  await screen.findByText(/parse/i);
  fireEvent.click(screen.getByRole('button', { name: /easy/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ rating: 'easy' }));
});

test('ComprehensionSurface: submit fires onSubmit with answer', () => {
  const onSubmit = jest.fn();
  render(<ComprehensionSurface args={{ bookId: 1, chapterId: 'ch-3' }} onSubmit={onSubmit} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'my answer' } });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ answer: 'my answer' }));
});

test('MicroCardChipSurface: accept fires onSubmit with accepted=true', () => {
  const onSubmit = jest.fn();
  render(<MicroCardChipSurface args={{ proposal: { headword: 'parse' } }} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: /accept/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ accepted: true }));
});

test('MoodBoardSurface: dismiss fires onSubmit with dismissed=true', () => {
  const onSubmit = jest.fn();
  render(<MoodBoardSurface args={{ boardId: 7 }} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: /done|close|dismiss/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dismissed: true }));
});
```

- [ ] **Step 2: Implement `LeitnerSurface.jsx`**

```jsx
import React, { useEffect, useState } from 'react';

export default function LeitnerSurface({ args, onSubmit }) {
  const [lp, setLp] = useState(null);
  const [startedAt] = useState(() => Date.now());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = (await import('../../../api/learningPointApi')).default;
        const data = await api.get(args.learningPointId);
        if (!cancelled) setLp(data);
      } catch (e) { /* fallback below */ }
    })();
    return () => { cancelled = true; };
  }, [args.learningPointId]);

  const rate = (rating) => onSubmit({ rating, durationMs: Date.now() - startedAt });

  if (!lp) return <div style={{ padding: 24 }}>Loading card #{args.learningPointId}...</div>;
  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h2>{lp.title || lp.headword}</h2>
      <div style={{ fontSize: 16, color: '#555', marginBottom: 24 }}>{lp.definition || lp.content}</div>
      <div style={{ display: 'flex', gap: 12 }}>
        {['again', 'hard', 'good', 'easy'].map(r => (
          <button key={r} onClick={() => rate(r)} style={{ padding: '8px 16px' }}>{r}</button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `ComprehensionSurface.jsx`**

```jsx
import React, { useState } from 'react';

export default function ComprehensionSurface({ args, onSubmit }) {
  const [answer, setAnswer] = useState('');
  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h2>Comprehension check</h2>
      <div style={{ color: '#666', marginBottom: 12 }}>
        Book {args.bookId}, chapter {args.chapterId}
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={6}
        style={{ width: '100%', padding: 8, fontSize: 14, marginBottom: 12 }}
        placeholder="Summarize the key idea of this chapter..."
      />
      <button onClick={() => onSubmit({ answer, durationMs: 0 })} disabled={!answer.trim()}>
        Submit
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Implement `MicroCardChipSurface.jsx`**

```jsx
import React from 'react';

export default function MicroCardChipSurface({ args, onSubmit }) {
  const p = args.proposal || {};
  return (
    <div style={{ padding: 24, maxWidth: 500, margin: '0 auto' }}>
      <h3>Micro-card proposal</h3>
      <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6, marginBottom: 16 }}>
        <strong>{p.headword || p.title || 'Untitled'}</strong>
        <div style={{ color: '#555', marginTop: 6 }}>{p.definition || p.content || ''}</div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => onSubmit({ accepted: true })}>Accept</button>
        <button onClick={() => onSubmit({ accepted: false })}>Dismiss</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `MoodBoardSurface.jsx`**

```jsx
import React, { useState } from 'react';

export default function MoodBoardSurface({ args, onSubmit }) {
  const [startedAt] = useState(() => Date.now());
  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h2>MoodBoard #{args.boardId}</h2>
      <div style={{ color: '#666', marginBottom: 12 }}>
        Review and organize the concepts on this board, then click Done.
      </div>
      <iframe
        title="moodboard-preview"
        src={`#/moodboard/${args.boardId}`}
        style={{ width: '100%', height: 400, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12 }}
      />
      <button onClick={() => onSubmit({ dismissed: true, dwellMs: Date.now() - startedAt })}>
        Done
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npx jest src/__tests__/renderer/aiSession/surfaces.test.jsx`
Expected: 4 passing. If the `learningPointApi` mock fails because the module doesn't exist, change the mock to use `{ virtual: true }` (already in test) AND make LeitnerSurface tolerant of failure (renders fallback).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/views/aiSession/surfaces/ src/__tests__/renderer/aiSession/surfaces.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-2): 4 session surface adapters (purpose-built)"
```

---

### Task 4: `SurfaceFrame` — dispatch by tool name

**Files:**
- Create: `src/renderer/views/aiSession/SurfaceFrame.jsx`
- Test: `src/__tests__/renderer/aiSession/SurfaceFrame.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen } from '@testing-library/react';
import SurfaceFrame from '../../../renderer/views/aiSession/SurfaceFrame';

test('no pendingSurface: shows Thinking state', () => {
  render(<SurfaceFrame pendingSurface={null} onSubmit={jest.fn()} lastThought="picking next move" />);
  expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  expect(screen.getByText(/picking next move/i)).toBeInTheDocument();
});

test('openLeitnerCard pendingSurface renders LeitnerSurface', () => {
  render(
    <SurfaceFrame
      pendingSurface={{ tool: 'openLeitnerCard', args: { learningPointId: 1 } }}
      onSubmit={jest.fn()}
    />
  );
  expect(screen.getByText(/Loading card #1/i)).toBeInTheDocument();
});

test('unknown surface tool: shows error', () => {
  render(
    <SurfaceFrame pendingSurface={{ tool: 'doesNotExist', args: {} }} onSubmit={jest.fn()} />
  );
  expect(screen.getByText(/unknown surface/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement**

```jsx
import React from 'react';
import LeitnerSurface from './surfaces/LeitnerSurface';
import ComprehensionSurface from './surfaces/ComprehensionSurface';
import MicroCardChipSurface from './surfaces/MicroCardChipSurface';
import MoodBoardSurface from './surfaces/MoodBoardSurface';

const SURFACES = {
  openLeitnerCard: LeitnerSurface,
  openComprehensionPanel: ComprehensionSurface,
  openMicroCardChip: MicroCardChipSurface,
  openMoodBoard: MoodBoardSurface,
};

export default function SurfaceFrame({ pendingSurface, onSubmit, lastThought }) {
  if (!pendingSurface) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Thinking...</div>
        {lastThought && <div style={{ fontSize: 13, color: '#bbb', maxWidth: 400, textAlign: 'center' }}>{lastThought}</div>}
      </div>
    );
  }
  const Surface = SURFACES[pendingSurface.tool];
  if (!Surface) {
    return <div style={{ padding: 24, color: '#c33' }}>Unknown surface: {pendingSurface.tool}</div>;
  }
  return <Surface args={pendingSurface.args} onSubmit={onSubmit} />;
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/renderer/aiSession/SurfaceFrame.test.jsx`
Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/aiSession/SurfaceFrame.jsx src/__tests__/renderer/aiSession/SurfaceFrame.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-2): SurfaceFrame dispatches by tool name"
```

---

### Task 5: `AISessionView` shell + route registration

**Files:**
- Create: `src/renderer/views/aiSession/AISessionView.jsx`
- Modify: the renderer routing file (locate via grep for `<Route` in `src/renderer/`)
- Test: `src/__tests__/renderer/aiSession/AISessionView.test.jsx`

- [ ] **Step 1: Locate routing file**

Run: `grep -rn "<Route" src/renderer/ | head -20`. Find the file that wires the major routes (`/study`, `/reading`, `/knowledge`, etc.). Likely `Root.jsx`, `App.jsx`, or `routes.jsx`.

- [ ] **Step 2: Write failing test**

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const fakeApi = {
  subscribeTrace: jest.fn().mockReturnValue(() => {}),
  get: jest.fn().mockResolvedValue({ id: 's1', goal: 'Review weak vocab', iteration: 3, budget: 12 }),
  userResult: jest.fn(),
  cancel: jest.fn(),
};
jest.mock('../../../renderer/api/sessionApi', () => ({ default: fakeApi }));
import AISessionView from '../../../renderer/views/aiSession/AISessionView';

test('renders goal pill + iteration counter + End button', async () => {
  render(
    <MemoryRouter initialEntries={['/ai-session/s1']}>
      <Routes><Route path="/ai-session/:id" element={<AISessionView />} /></Routes>
    </MemoryRouter>
  );
  await screen.findByText(/Review weak vocab/);
  expect(screen.getByText(/3.*12/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /end/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Implement**

```jsx
// src/renderer/views/aiSession/AISessionView.jsx
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
  const { trace, pendingSurface, status, iteration, submitUserResult, cancel, undoSoftWrite } = useStudySession(sessionId);

  useEffect(() => {
    (async () => {
      try { setMeta(await sessionApi.get(sessionId)); } catch (e) { /* fail silent */ }
    })();
  }, [sessionId]);

  useEffect(() => {
    if (status === 'completed' || status === 'errored') {
      navigate(`/ai-session/${sessionId}/summary`, { replace: true });
    }
  }, [status, sessionId, navigate]);

  const lastThought = [...trace].reverse().find(t => t.kind === 'thought')?.payload?.reasoning;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ background: '#9ad', color: '#fff', padding: '4px 10px', borderRadius: 12, fontSize: 12 }}>
          {meta?.goal || 'Loading...'}
        </span>
        <span style={{ color: '#666', fontSize: 13 }}>
          iter {iteration}/{meta?.budget || 12}
        </span>
        <span style={{ flex: 1 }} />
        <button onClick={() => cancel()}>End session</button>
      </div>
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
```

- [ ] **Step 4: Register the route**

In the routing file from Step 1, add:

```jsx
import AISessionView from './views/aiSession/AISessionView';
import SessionSummaryView from './views/aiSession/SessionSummaryView';
// ...
<Route path="/ai-session/:id" element={<AISessionView />} />
<Route path="/ai-session/:id/summary" element={<SessionSummaryView />} />
```

Adjust import paths to match the routing file's location.

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/renderer/aiSession/AISessionView.test.jsx`
Expected: passing.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/views/aiSession/AISessionView.jsx src/__tests__/renderer/aiSession/AISessionView.test.jsx <routing-file>
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-2): AISessionView shell + /ai-session/:id route"
```

---

### Task 6: `SessionStartDialog` — Quest or AI-pick goal

**Files:**
- Create: `src/renderer/views/aiSession/SessionStartDialog.jsx`
- Test: `src/__tests__/renderer/aiSession/SessionStartDialog.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import SessionStartDialog from '../../../renderer/views/aiSession/SessionStartDialog';

const fakeSessionApi = { start: jest.fn().mockResolvedValue({ sessionId: 'sX', traceId: 't1' }) };
jest.mock('../../../renderer/api/sessionApi', () => ({ default: fakeSessionApi }));

test('with active Quest: shows quest-anchored start', () => {
  render(<SessionStartDialog open onClose={jest.fn()} activeQuest={{ id: 1, title: 'Master React' }} userId={1} />);
  expect(screen.getByText(/Master React/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /start session/i })).toBeInTheDocument();
});

test('without active Quest: shows free-text goal input', () => {
  render(<SessionStartDialog open onClose={jest.fn()} activeQuest={null} userId={1} />);
  expect(screen.getByPlaceholderText(/what do you want/i)).toBeInTheDocument();
});

test('clicking Start invokes sessionApi.start with Quest', async () => {
  const onClose = jest.fn();
  render(<SessionStartDialog open onClose={onClose} activeQuest={{ id: 1, title: 'Master React' }} userId={1} />);
  fireEvent.click(screen.getByRole('button', { name: /start session/i }));
  await screen.findByText(/starting/i).catch(() => {});
  expect(fakeSessionApi.start).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, questId: 1 }));
});
```

- [ ] **Step 2: Implement**

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sessionApi from '../../api/sessionApi';

export default function SessionStartDialog({ open, onClose, activeQuest, userId }) {
  const [goal, setGoal] = useState('');
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  if (!open) return null;

  const startWithQuest = async () => {
    setStarting(true);
    try {
      const r = await sessionApi.start({
        userId,
        questId: activeQuest?.id || null,
        goal: activeQuest?.title || goal || 'Open study session',
      });
      onClose?.();
      navigate(`/ai-session/${r.sessionId}`);
    } catch (e) {
      setStarting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 480, width: '90%' }}>
        <h2 style={{ marginTop: 0 }}>Start an AI session</h2>
        {activeQuest ? (
          <>
            <div style={{ marginBottom: 16 }}>
              Active Quest: <strong>{activeQuest.title}</strong>
            </div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
              The AI will conduct a study session toward this Quest's goal.
            </div>
          </>
        ) : (
          <>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>No active Quest. Set a session goal:</div>
            <input
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="What do you want from this session?"
              style={{ width: '100%', padding: 8, marginBottom: 16, fontSize: 14 }}
            />
          </>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={starting}>Cancel</button>
          <button onClick={startWithQuest} disabled={starting || (!activeQuest && !goal.trim())}>
            {starting ? 'Starting...' : 'Start session'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/renderer/aiSession/SessionStartDialog.test.jsx`
Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/aiSession/SessionStartDialog.jsx src/__tests__/renderer/aiSession/SessionStartDialog.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-2): SessionStartDialog (Quest or free-text goal)"
```

---

### Task 7: `SessionSummaryView` — end-of-session recap

**Files:**
- Create: `src/renderer/views/aiSession/SessionSummaryView.jsx`
- Test: `src/__tests__/renderer/aiSession/SessionSummaryView.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const sampleTrace = [
  { kind: 'thought', iteration: 0, payload: { reasoning: 'start' } },
  { kind: 'soft-write', iteration: 1, payload: { tool: 'scheduleReread', args: { chapterId: 'ch-3' } } },
  { kind: 'soft-write', iteration: 2, payload: { tool: 'createMicroCard', args: {} } },
  { kind: 'end', iteration: 5, payload: { reason: 'done' } },
];
const fakeApi = { getTrace: jest.fn().mockResolvedValue(sampleTrace) };
jest.mock('../../../renderer/api/sessionApi', () => ({ default: fakeApi }));
import SessionSummaryView from '../../../renderer/views/aiSession/SessionSummaryView';

test('shows goal + soft-write list + end reason', async () => {
  render(
    <MemoryRouter initialEntries={['/ai-session/s1/summary']}>
      <Routes><Route path="/ai-session/:id/summary" element={<SessionSummaryView />} /></Routes>
    </MemoryRouter>
  );
  await screen.findByText(/Session complete/i);
  expect(screen.getByText(/scheduleReread/)).toBeInTheDocument();
  expect(screen.getByText(/createMicroCard/)).toBeInTheDocument();
  expect(screen.getByText(/done/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement**

```jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import sessionApi from '../../api/sessionApi';

export default function SessionSummaryView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trace, setTrace] = useState([]);
  useEffect(() => {
    (async () => setTrace(await sessionApi.getTrace(id)))();
  }, [id]);

  const softWrites = trace.filter(t => t.kind === 'soft-write');
  const endEvent = trace.find(t => t.kind === 'end');
  const iterationCount = Math.max(0, ...trace.map(t => t.iteration || 0));

  return (
    <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
      <h1>Session complete</h1>
      <div style={{ color: '#666', marginBottom: 24 }}>
        {iterationCount} iterations · ended with {endEvent?.payload?.reason || 'unknown'}
      </div>

      <h3>Actions taken</h3>
      {softWrites.length === 0 ? (
        <div style={{ color: '#999', fontStyle: 'italic' }}>No persistent actions.</div>
      ) : (
        <ul>
          {softWrites.map((sw, i) => (
            <li key={i}>
              <strong>{sw.payload.tool}</strong>
              {' '}<code style={{ fontSize: 12, color: '#666' }}>{JSON.stringify(sw.payload.args)}</code>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
        <button onClick={() => navigate('/')}>Done</button>
        <button onClick={() => navigate('/knowledge')}>View Knowledge Dashboard</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/renderer/aiSession/SessionSummaryView.test.jsx`
Expected: passing.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/aiSession/SessionSummaryView.jsx src/__tests__/renderer/aiSession/SessionSummaryView.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-2): SessionSummaryView end-of-session recap"
```

---

### Task 8: BrainOrb integration — start menu entry + resume pill

**Files:**
- Modify: `src/renderer/components/brainShell/BrainOrb.jsx` (or wherever the right-click menu is wired)
- Modify: `src/renderer/components/brainShell/BrainShell.jsx` (or equivalent — where global Brain state lives)
- Test: `src/__tests__/renderer/aiSession/orbMenuIntegration.test.jsx` (smoke level only)

- [ ] **Step 1: Locate existing right-click menu**

Run: `grep -rn "OrbQuestMenu\|onContextMenu" src/renderer/components/brainShell/`. Find the component that renders the right-click menu (likely `OrbQuestMenu.jsx` per CLAUDE.md). Read it to understand the menu-item shape.

- [ ] **Step 2: Add "Start AI Session" menu item**

In the orb menu component, add a new menu item. On click:
1. Read `activeQuest` (likely from Redux or passed prop).
2. Open `SessionStartDialog` (lift `dialogOpen` state into the menu's parent if needed).

```jsx
// inside the menu items array or JSX
<MenuItem onClick={() => setSessionDialogOpen(true)}>
  Start AI Session
</MenuItem>
```

And in the parent component:

```jsx
import SessionStartDialog from '../../views/aiSession/SessionStartDialog';
// ...
<SessionStartDialog
  open={sessionDialogOpen}
  onClose={() => setSessionDialogOpen(false)}
  activeQuest={activeQuest}
  userId={userId}
/>
```

- [ ] **Step 3: Add resume pill — on BrainShell mount, check `sessionApi.loadActive()`**

```jsx
// In BrainShell.jsx or equivalent
import sessionApi from '../../api/sessionApi';
const [resumeSessionId, setResumeSessionId] = useState(null);
useEffect(() => {
  (async () => {
    const active = await sessionApi.loadActive();
    if (active && active.status === 'active') setResumeSessionId(active.id);
  })();
}, []);
// Render conditionally near the Orb:
{resumeSessionId && (
  <button
    onClick={() => navigate(`/ai-session/${resumeSessionId}`)}
    style={{ padding: '4px 10px', fontSize: 12, background: '#fc6', borderRadius: 12 }}
  >
    Resume session
  </button>
)}
```

- [ ] **Step 4: Smoke test for menu integration**

```jsx
// src/__tests__/renderer/aiSession/orbMenuIntegration.test.jsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Smoke: just confirm OrbQuestMenu (or its containing component) imports SessionStartDialog without error.
test('orb menu module loads with session-dialog import', () => {
  jest.isolateModules(() => {
    expect(() => require('../../../renderer/components/brainShell/OrbQuestMenu')).not.toThrow();
  });
});
```

(Adjust path to the actual file modified.)

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/renderer/aiSession/`
Expected: all aiSession tests passing.

- [ ] **Step 6: Smoke**

Run: `npm run test:smoke`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/brainShell/ src/__tests__/renderer/aiSession/orbMenuIntegration.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-10b-2): BrainOrb menu + resume pill for AI sessions"
```

---

## Success criteria (Plan 10b-2)

- All 8 tasks committed.
- New tests: useStudySession (5), TraceSidebar (3), surfaces (4), SurfaceFrame (3), AISessionView (1+), SessionStartDialog (3), SessionSummaryView (1+), orb-menu smoke (1). Total ≥ 21 new tests.
- `/ai-session/:id` route renders the full shell (header + 30% TraceSidebar + 70% SurfaceFrame).
- `/ai-session/:id/summary` shows the recap.
- BrainOrb right-click menu has a "Start AI Session" entry.
- Sessions can be resumed if active when the app boots.
- `npx jest` green; `npm run test:smoke` green.

**Out of scope (deferred to Plan 10b-3):**
- Canonical-surface integration (full StudyCardRouter / ComprehensionPanel / MoodBoardView embedding).
- Goal-proposal Director one-shot when no Quest exists (currently uses free-text input).
- Real DB writes for `createMicroCard` / `scheduleProductionPrompt` (still stubbed from 10b-1).
- `rereadQueueSingleton.init(store)` wiring in main.ts.
- EconomicsPanel showing per-session aggregation by trace_id.
- Multi-session queue.
