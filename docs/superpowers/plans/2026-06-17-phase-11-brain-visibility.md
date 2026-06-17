# Phase 11 — Brain Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Land the Brain Visibility tab in BrainDashboardPanel: aggregate Activity Dashboard with 4 chart strips + per-concept Inspector with lineage timeline. Read-only over existing data; no new tables.

**Architecture:** Main-process `BrainVisibilityService` aggregates over `brain_call_ledger`, `ai_sessions`, `ai_session_trace`, `learning_point`. Two IPC channels (`brainVisibility:dashboard` + `brainVisibility:concept`). Renderer client + four chart-strip components + ConceptInspector drawer + tab integration into BrainDashboardPanel.

**Tech Stack:** Node + better-sqlite3 + React. No new deps.

**Conventions:**
- Run single test with `npx jest <path>`.
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit ...`.
- Don't write git config; don't skip pre-commit hooks.
- Stay on `main` branch; no destructive git ops.

**Spec:** [`docs/superpowers/specs/2026-06-17-phase-11-brain-visibility-design.md`](../specs/2026-06-17-phase-11-brain-visibility-design.md)

---

## File Map

**Create**
- `src/main/utils/BrainVisibilityService.js`
- `src/main/ipc/brainVisibilityHandlers.js`
- `src/renderer/api/brainVisibilityApi.js`
- `src/renderer/views/brainVisibility/BrainActivityDashboard.jsx`
- `src/renderer/views/brainVisibility/ConceptInspector.jsx`
- `src/renderer/views/brainVisibility/MasterySnapshotStrip.jsx`
- `src/renderer/views/brainVisibility/BrainActivityTimelineStrip.jsx`
- `src/renderer/views/brainVisibility/RecentSessionsTable.jsx`
- `src/renderer/views/brainVisibility/TopTouchedConceptsTable.jsx`
- `src/renderer/views/brainVisibility/LineageTimeline.jsx`
- `src/__tests__/main/BrainVisibilityService.test.js`
- `src/__tests__/ipc/brainVisibilityHandlers.test.js`
- `src/__tests__/renderer/brainVisibility/BrainActivityDashboard.test.jsx`
- `src/__tests__/renderer/brainVisibility/ConceptInspector.test.jsx`

**Modify**
- `src/main/main.ts` — register brainVisibilityHandlers
- `src/renderer/components/brainShell/BrainDashboardPanel.jsx` — add "Visibility" tab

---

### Task 1: `BrainVisibilityService` skeleton + `getDashboard` aggregation

**Files:**
- Create: `src/main/utils/BrainVisibilityService.js`
- Test: `src/__tests__/main/BrainVisibilityService.test.js`

- [ ] **Step 1: Write failing test**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');
const BrainVisibilityService = require('../../main/utils/BrainVisibilityService');
const CallLedgerStore = require('../../main/db/CallLedgerStore');
const AISessionStore = require('../../main/db/AISessionStore');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  dbManager.__setDb(db);
  return db;
}

test('getDashboard returns mastery + timeline + sessions + topConcepts', async () => {
  const db = freshDb();
  // seed 2 learning points
  db.prepare(`
    INSERT INTO learning_point (user_id, domain_type, title, content, source_type, box, mastery_level, created_at, updated_at)
    VALUES (1, 'vocabulary', 'parse', 'p', 'book', 1, 25, datetime('now'), datetime('now')),
           (1, 'concept', 'lexer', 'l', 'book', 2, 60, datetime('now'), datetime('now'))
  `).run();
  // seed a ledger row + a session
  const now = Date.now();
  CallLedgerStore.record({
    intent: 'director-session-step', ts: now - 86400000, provider: 'deepseek',
    context_keys: [], prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.001,
    cache_hit: false, cache_key: null, duration_ms: 200, trigger_id: null,
    output_summary: 's', output_json: null, trace_id: 'tr-1',
  });
  AISessionStore.persistCompleted({
    id: 'sess-1', userId: 1, questId: null, goal: 'Review weak',
    traceId: 'tr-1', status: 'completed', iteration: 3, budget: 12,
    startedAt: now - 86400000, endedAt: now - 86000000, errorReason: null,
    trace: [
      { iteration: 0, kind: 'tool', payload: { tool: 'openLeitnerCard', args: { learningPointId: 1 } }, ts: now - 86400000 },
    ],
  });
  const r = await BrainVisibilityService.getDashboard({ window: '7d', userId: 1 });
  expect(r.mastery.length).toBeGreaterThan(0);
  expect(r.mastery.some(m => m.domain === 'vocabulary' && m.box === 1)).toBe(true);
  expect(r.timeline.length).toBeGreaterThan(0);
  expect(r.sessions).toHaveLength(1);
  expect(r.sessions[0].id).toBe('sess-1');
  expect(r.sessions[0].totalCost).toBeCloseTo(0.001);
  expect(r.topConcepts[0].id).toBe(1);
  expect(r.topConcepts[0].decisionCount).toBe(1);
});

test('window filters: 7d excludes a session from 30d ago', async () => {
  const db = freshDb();
  const old = Date.now() - 30 * 86400000;
  AISessionStore.persistCompleted({
    id: 's-old', userId: 1, questId: null, goal: 'g', traceId: 't-old',
    status: 'completed', iteration: 1, budget: 12, startedAt: old, endedAt: old + 1000,
    errorReason: null, trace: [],
  });
  const r7 = await BrainVisibilityService.getDashboard({ window: '7d', userId: 1 });
  const r90 = await BrainVisibilityService.getDashboard({ window: '90d', userId: 1 });
  expect(r7.sessions).toHaveLength(0);
  expect(r90.sessions).toHaveLength(1);
});
```

- [ ] **Step 2: Implement `BrainVisibilityService.getDashboard`**

```js
// src/main/utils/BrainVisibilityService.js
const dbManager = require('../db/dbManager');

const WINDOW_MS = { '7d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000 };

function classifyIntent(intent) {
  if (!intent) return 'other';
  if (intent.startsWith('director-')) return 'director';
  if (intent.startsWith('legacy:') || intent.startsWith('legacy-')) return 'legacy';
  if (intent.includes('concept-extraction') || intent.includes('enrichment')) return 'extraction';
  return 'other';
}

async function getDashboard({ window = '30d', userId = 1 }) {
  const db = dbManager.getDb();
  const since = Date.now() - (WINDOW_MS[window] || WINDOW_MS['30d']);

  // 1. Mastery snapshot
  const mastery = db.prepare(`
    SELECT domain_type AS domain, box, COUNT(*) AS count
    FROM learning_point
    WHERE user_id = ?
    GROUP BY domain_type, box
    ORDER BY domain_type, box
  `).all(userId);

  // 2. Timeline (intent classes per day)
  const timelineRaw = db.prepare(`
    SELECT date(ts/1000, 'unixepoch') AS day, intent,
           COUNT(*) AS count, SUM(cost_usd) AS cost
    FROM brain_call_ledger
    WHERE ts >= ?
    GROUP BY day, intent
  `).all(since);
  const timeline = timelineRaw.map(r => ({
    day: r.day,
    intentClass: classifyIntent(r.intent),
    count: r.count,
    cost: r.cost || 0,
  }));

  // 3. Recent sessions
  const sessions = db.prepare(`
    SELECT s.id, s.goal, s.started_at AS startedAt, s.ended_at AS endedAt,
           s.iteration, s.budget, s.status, s.trace_id AS traceId,
           (SELECT COALESCE(SUM(cost_usd), 0) FROM brain_call_ledger WHERE trace_id = s.trace_id) AS totalCost
    FROM ai_sessions s
    WHERE s.user_id = ? AND s.started_at >= ?
    ORDER BY s.started_at DESC
    LIMIT 20
  `).all(userId, since).map(s => ({
    ...s,
    firstTouchedConceptId: firstTouchedConcept(db, s.id),
  }));

  // 4. Top-touched concepts: scan ai_session_trace payloads in window for learningPointId refs
  const topConcepts = topTouchedConcepts(db, userId, since, 20);

  return { mastery, timeline, sessions, topConcepts };
}

function firstTouchedConcept(db, sessionId) {
  const rows = db.prepare(`
    SELECT payload_json FROM ai_session_trace WHERE session_id = ? ORDER BY ts ASC LIMIT 50
  `).all(sessionId);
  for (const r of rows) {
    const payload = safeParseJson(r.payload_json);
    const id = extractLearningPointId(payload);
    if (id != null) return id;
  }
  return null;
}

function topTouchedConcepts(db, userId, since, limit) {
  // Get all session traces in the window
  const rows = db.prepare(`
    SELECT t.payload_json
    FROM ai_session_trace t
    JOIN ai_sessions s ON s.id = t.session_id
    WHERE s.user_id = ? AND s.started_at >= ?
  `).all(userId, since);
  const counts = new Map();
  for (const r of rows) {
    const id = extractLearningPointId(safeParseJson(r.payload_json));
    if (id != null) counts.set(id, (counts.get(id) || 0) + 1);
  }
  // Join with learning_point for metadata
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const result = [];
  for (const [id, decisionCount] of ranked) {
    const lp = db.prepare(`SELECT id, title, domain_type AS domain, box, mastery_level FROM learning_point WHERE id = ?`).get(id);
    if (lp) result.push({ id: lp.id, title: lp.title, domain: lp.domain, decisionCount, box: lp.box, masteryPct: lp.mastery_level });
  }
  return result;
}

function safeParseJson(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function extractLearningPointId(payload) {
  if (!payload) return null;
  if (typeof payload.learningPointId === 'number') return payload.learningPointId;
  if (payload.args && typeof payload.args.learningPointId === 'number') return payload.args.learningPointId;
  return null;
}

module.exports = { getDashboard };
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/main/BrainVisibilityService.test.js`
Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add src/main/utils/BrainVisibilityService.js src/__tests__/main/BrainVisibilityService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-11): BrainVisibilityService.getDashboard aggregation"
```

---

### Task 2: `BrainVisibilityService.getConcept` + lineage

**Files:**
- Modify: `src/main/utils/BrainVisibilityService.js` (add `getConcept`)
- Test: extend `src/__tests__/main/BrainVisibilityService.test.js`

- [ ] **Step 1: Write failing test**

```js
test('getConcept returns meta + lineage + costToDate', async () => {
  const db = freshDb();
  db.prepare(`
    INSERT INTO learning_point (id, user_id, domain_type, title, content, source_type, source_id, box, mastery_level, next_review, created_at, updated_at)
    VALUES (1, 1, 'vocabulary', 'parse', 'to analyze', 'book', 'p-h-abc', 1, 25, '2026-06-20', '2026-06-15', '2026-06-15')
  `).run();
  const now = Date.now();
  CallLedgerStore.record({
    intent: 'director-session-step', ts: now, provider: 'deepseek',
    context_keys: [], prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.002,
    cache_hit: false, cache_key: null, duration_ms: 200, trigger_id: null,
    output_summary: 's', output_json: null, trace_id: 'tr-A',
  });
  AISessionStore.persistCompleted({
    id: 'sX', userId: 1, questId: null, goal: 'g', traceId: 'tr-A',
    status: 'completed', iteration: 1, budget: 12,
    startedAt: now - 1000, endedAt: now, errorReason: null,
    trace: [
      { iteration: 0, kind: 'tool', payload: { tool: 'openLeitnerCard', args: { learningPointId: 1 } }, ts: now - 500 },
    ],
  });
  const r = await BrainVisibilityService.getConcept({ learningPointId: 1, userId: 1 });
  expect(r.meta.title).toBe('parse');
  expect(r.meta.box).toBe(1);
  expect(r.lineage.some(e => e.kind === 'created')).toBe(true);
  expect(r.lineage.some(e => e.kind === 'brain-decision')).toBe(true);
  expect(r.costToDate).toBeCloseTo(0.002);
});

test('getConcept returns null meta for unknown id', async () => {
  freshDb();
  const r = await BrainVisibilityService.getConcept({ learningPointId: 999, userId: 1 });
  expect(r.meta).toBeNull();
});
```

- [ ] **Step 2: Implement `getConcept`**

```js
async function getConcept({ learningPointId, userId = 1 }) {
  const db = dbManager.getDb();
  const lp = db.prepare(`
    SELECT id, title, domain_type AS domain, box, mastery_level AS masteryPct,
           next_review AS nextReview, source_type AS sourceType, source_id AS sourceId,
           created_at AS createdAt
    FROM learning_point WHERE id = ? AND user_id = ?
  `).get(learningPointId, userId);
  if (!lp) return { meta: null, lineage: [], costToDate: 0, boxOverTime: null };

  // Lineage: brain decisions via ai_session_trace JSON scan
  const traceRows = db.prepare(`
    SELECT t.session_id, t.payload_json, t.ts, t.kind
    FROM ai_session_trace t
    JOIN ai_sessions s ON s.id = t.session_id
    WHERE s.user_id = ?
  `).all(userId);
  const decisions = [];
  const traceIds = new Set();
  for (const r of traceRows) {
    const payload = safeParseJson(r.payload_json);
    if (extractLearningPointId(payload) !== learningPointId) continue;
    const session = db.prepare(`SELECT trace_id FROM ai_sessions WHERE id = ?`).get(r.session_id);
    if (session?.trace_id) traceIds.add(session.trace_id);
    decisions.push({
      kind: 'brain-decision',
      ts: r.ts,
      sessionId: r.session_id,
      tool: payload?.tool || r.kind,
      args: payload?.args || null,
      callId: null,
    });
  }

  // costToDate: ledger rows for those trace_ids
  let costToDate = 0;
  if (traceIds.size > 0) {
    const placeholders = [...traceIds].map(() => '?').join(',');
    const costRows = db.prepare(`
      SELECT cost_usd FROM brain_call_ledger WHERE trace_id IN (${placeholders})
    `).all(...traceIds);
    costToDate = costRows.reduce((s, r) => s + (r.cost_usd || 0), 0);
  }

  // Creation event
  const lineage = [
    { kind: 'created', ts: parseTimestamp(lp.createdAt), sourceType: lp.sourceType, sourceId: lp.sourceId },
    ...decisions,
  ].sort((a, b) => b.ts - a.ts);

  return {
    meta: lp,
    lineage,
    costToDate,
    boxOverTime: null,  // v1: no event history; UI shows snapshot badge
  };
}

function parseTimestamp(s) {
  if (!s) return 0;
  if (typeof s === 'number') return s;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

module.exports = { getDashboard, getConcept };
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/main/BrainVisibilityService.test.js`
Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add src/main/utils/BrainVisibilityService.js src/__tests__/main/BrainVisibilityService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-11): BrainVisibilityService.getConcept (meta + lineage + cost)"
```

---

### Task 3: IPC handlers + renderer API client

**Files:**
- Create: `src/main/ipc/brainVisibilityHandlers.js`
- Modify: `src/main/main.ts` — register handlers
- Create: `src/renderer/api/brainVisibilityApi.js`
- Test: `src/__tests__/ipc/brainVisibilityHandlers.test.js`

- [ ] **Step 1: Write failing test**

```js
const { EventEmitter } = require('events');
const ipcMain = new EventEmitter();
ipcMain.handle = function (channel, fn) { this.on(channel, async (e, ...a) => e.reply?.(channel, await fn(e, ...a))); };
jest.mock('electron', () => ({ ipcMain }));

jest.mock('../../main/utils/BrainVisibilityService', () => ({
  getDashboard: jest.fn().mockResolvedValue({ mastery: [], timeline: [], sessions: [], topConcepts: [] }),
  getConcept: jest.fn().mockResolvedValue({ meta: { id: 1 }, lineage: [], costToDate: 0, boxOverTime: null }),
}));
const { register } = require('../../main/ipc/brainVisibilityHandlers');

test('registers both channels', () => {
  register();
  expect(ipcMain.listenerCount('brainVisibility:dashboard')).toBeGreaterThan(0);
  expect(ipcMain.listenerCount('brainVisibility:concept')).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Implement handlers**

```js
// src/main/ipc/brainVisibilityHandlers.js
const { ipcMain } = require('electron');
const BrainVisibilityService = require('../utils/BrainVisibilityService');

function register() {
  ipcMain.handle('brainVisibility:dashboard', async (_e, { window, userId }) =>
    BrainVisibilityService.getDashboard({ window, userId })
  );
  ipcMain.handle('brainVisibility:concept', async (_e, { learningPointId, userId }) =>
    BrainVisibilityService.getConcept({ learningPointId, userId })
  );
}

module.exports = { register };
```

- [ ] **Step 3: Implement renderer client**

```js
// src/renderer/api/brainVisibilityApi.js
const { ipcRenderer } = window.require ? window.require('electron') : require('electron');

const brainVisibilityApi = {
  dashboard: ({ window = '30d', userId = 1 } = {}) =>
    ipcRenderer.invoke('brainVisibility:dashboard', { window, userId }),
  concept: ({ learningPointId, userId = 1 }) =>
    ipcRenderer.invoke('brainVisibility:concept', { learningPointId, userId }),
};

export default brainVisibilityApi;
```

- [ ] **Step 4: Wire into `main.ts`**

Near other handler registrations (after `sessionHandlers.register()`):

```ts
const brainVisibilityHandlers = require('./ipc/brainVisibilityHandlers');
brainVisibilityHandlers.register();
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/ipc/brainVisibilityHandlers.test.js`
Expected: passing.

Smoke: `npm run test:smoke`
Expected: no new flagged lines from these changes (smoke may still fail for the pre-existing main.ts:268 issue — that's separate).

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/brainVisibilityHandlers.js src/main/main.ts src/renderer/api/brainVisibilityApi.js src/__tests__/ipc/brainVisibilityHandlers.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-11): brainVisibilityHandlers IPC + renderer client"
```

---

### Task 4: Four dashboard strip components

**Files:**
- Create: `src/renderer/views/brainVisibility/MasterySnapshotStrip.jsx`
- Create: `src/renderer/views/brainVisibility/BrainActivityTimelineStrip.jsx`
- Create: `src/renderer/views/brainVisibility/RecentSessionsTable.jsx`
- Create: `src/renderer/views/brainVisibility/TopTouchedConceptsTable.jsx`
- Test: `src/__tests__/renderer/brainVisibility/strips.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import MasterySnapshotStrip from '../../../renderer/views/brainVisibility/MasterySnapshotStrip';
import BrainActivityTimelineStrip from '../../../renderer/views/brainVisibility/BrainActivityTimelineStrip';
import RecentSessionsTable from '../../../renderer/views/brainVisibility/RecentSessionsTable';
import TopTouchedConceptsTable from '../../../renderer/views/brainVisibility/TopTouchedConceptsTable';

test('MasterySnapshotStrip renders bars for each domain×box', () => {
  render(<MasterySnapshotStrip data={[
    { domain: 'vocabulary', box: 1, count: 12 },
    { domain: 'vocabulary', box: 2, count: 5 },
    { domain: 'concept', box: 1, count: 3 },
  ]} />);
  expect(screen.getByText(/vocabulary/i)).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
});

test('BrainActivityTimelineStrip groups by day + intent class', () => {
  render(<BrainActivityTimelineStrip data={[
    { day: '2026-06-15', intentClass: 'director', count: 5, cost: 0.005 },
    { day: '2026-06-15', intentClass: 'legacy', count: 3, cost: 0.001 },
  ]} />);
  expect(screen.getByText(/2026-06-15/i)).toBeInTheDocument();
  expect(screen.getByText(/director/i)).toBeInTheDocument();
});

test('RecentSessionsTable rows are clickable', () => {
  const onRowClick = jest.fn();
  render(<RecentSessionsTable rows={[
    { id: 'sess-1', goal: 'Review weak', startedAt: 1000, iteration: 3, budget: 12, status: 'completed', totalCost: 0.002, firstTouchedConceptId: 42 },
  ]} onRowClick={onRowClick} />);
  fireEvent.click(screen.getByText(/Review weak/));
  expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'sess-1' }));
});

test('TopTouchedConceptsTable rows are clickable', () => {
  const onRowClick = jest.fn();
  render(<TopTouchedConceptsTable rows={[
    { id: 7, title: 'parse', domain: 'vocabulary', decisionCount: 5, box: 2, masteryPct: 40 },
  ]} onRowClick={onRowClick} />);
  fireEvent.click(screen.getByText(/parse/));
  expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
});
```

- [ ] **Step 2: Implement `MasterySnapshotStrip.jsx`**

```jsx
import React from 'react';

export default function MasterySnapshotStrip({ data }) {
  if (!data || data.length === 0) return <Strip title="Mastery Snapshot"><em style={{ color: '#999' }}>No data</em></Strip>;
  const domains = [...new Set(data.map(d => d.domain))];
  return (
    <Strip title="Mastery Snapshot">
      <table style={{ width: '100%', fontSize: 12 }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Domain</th>{[1,2,3,4,5].map(b => <th key={b}>Box {b}</th>)}</tr></thead>
        <tbody>
          {domains.map(d => (
            <tr key={d}>
              <td>{d}</td>
              {[1,2,3,4,5].map(b => {
                const row = data.find(x => x.domain === d && x.box === b);
                const count = row?.count || 0;
                return <td key={b} style={{ textAlign: 'center', background: `rgba(40,120,200,${Math.min(0.6, count / 20)})`, color: count > 10 ? '#fff' : '#333' }}>{count || ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Strip>
  );
}
function Strip({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Implement `BrainActivityTimelineStrip.jsx`**

```jsx
import React from 'react';

const COLORS = { director: '#9ad', legacy: '#cae', extraction: '#9c9', other: '#bbb' };

export default function BrainActivityTimelineStrip({ data }) {
  if (!data || data.length === 0) return <Strip title="Brain Activity Timeline"><em style={{ color: '#999' }}>No activity in this window</em></Strip>;
  const byDay = {};
  for (const r of data) {
    if (!byDay[r.day]) byDay[r.day] = { day: r.day, director: 0, legacy: 0, extraction: 0, other: 0, cost: 0 };
    byDay[r.day][r.intentClass] += r.count;
    byDay[r.day].cost += r.cost || 0;
  }
  const days = Object.values(byDay).sort((a, b) => a.day < b.day ? 1 : -1);
  const maxCount = Math.max(1, ...days.map(d => d.director + d.legacy + d.extraction + d.other));
  return (
    <Strip title="Brain Activity Timeline">
      {days.map(d => {
        const total = d.director + d.legacy + d.extraction + d.other;
        return (
          <div key={d.day} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ width: 90, fontSize: 11, color: '#666' }}>{d.day}</div>
            <div style={{ flex: 1, display: 'flex', height: 14 }}>
              {['director', 'legacy', 'extraction', 'other'].map(cls => d[cls] > 0 && (
                <div key={cls} title={`${cls}: ${d[cls]}`} style={{ width: `${(d[cls] / maxCount) * 100}%`, background: COLORS[cls] }} />
              ))}
            </div>
            <div style={{ width: 60, fontSize: 11, color: '#666', textAlign: 'right' }}>{total} · ${d.cost.toFixed(3)}</div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#666', marginTop: 6 }}>
        {Object.entries(COLORS).map(([k, c]) => <span key={k}><span style={{ display: 'inline-block', width: 10, height: 10, background: c, marginRight: 4 }} />{k}</span>)}
      </div>
    </Strip>
  );
}
function Strip({ title, children }) { return <div style={{ marginBottom: 24 }}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>{children}</div>; }
```

- [ ] **Step 4: Implement `RecentSessionsTable.jsx`**

```jsx
import React from 'react';

export default function RecentSessionsTable({ rows, onRowClick }) {
  if (!rows || rows.length === 0) return <Strip title="Recent Sessions"><em style={{ color: '#999' }}>No sessions in this window</em></Strip>;
  return (
    <Strip title="Recent Sessions">
      <table style={{ width: '100%', fontSize: 12 }}>
        <thead><tr><th align="left">Started</th><th align="left">Goal</th><th>Iter</th><th>Cost</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => onRowClick?.(r)} style={{ cursor: 'pointer' }}>
              <td>{new Date(r.startedAt).toLocaleString()}</td>
              <td>{r.goal}</td>
              <td align="center">{r.iteration}/{r.budget}</td>
              <td align="right">${(r.totalCost || 0).toFixed(4)}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Strip>
  );
}
function Strip({ title, children }) { return <div style={{ marginBottom: 24 }}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>{children}</div>; }
```

- [ ] **Step 5: Implement `TopTouchedConceptsTable.jsx`**

```jsx
import React from 'react';

export default function TopTouchedConceptsTable({ rows, onRowClick }) {
  if (!rows || rows.length === 0) return <Strip title="Top-Touched Concepts"><em style={{ color: '#999' }}>No concept-attributed Brain decisions in this window</em></Strip>;
  return (
    <Strip title="Top-Touched Concepts">
      <table style={{ width: '100%', fontSize: 12 }}>
        <thead><tr><th align="left">Concept</th><th>Domain</th><th>Decisions</th><th>Box</th><th>Mastery</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => onRowClick?.(r)} style={{ cursor: 'pointer' }}>
              <td>{r.title}</td>
              <td>{r.domain}</td>
              <td align="center">{r.decisionCount}</td>
              <td align="center">{r.box}</td>
              <td align="center">{r.masteryPct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Strip>
  );
}
function Strip({ title, children }) { return <div style={{ marginBottom: 24 }}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>{children}</div>; }
```

- [ ] **Step 6: Run tests**

Run: `npx jest src/__tests__/renderer/brainVisibility/strips.test.jsx`
Expected: 4 passing.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/views/brainVisibility/ src/__tests__/renderer/brainVisibility/strips.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-11): 4 dashboard strip components"
```

---

### Task 5: `BrainActivityDashboard` container + window toggle

**Files:**
- Create: `src/renderer/views/brainVisibility/BrainActivityDashboard.jsx`
- Test: `src/__tests__/renderer/brainVisibility/BrainActivityDashboard.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fakeApi = {
  dashboard: jest.fn().mockResolvedValue({
    mastery: [{ domain: 'vocabulary', box: 1, count: 5 }],
    timeline: [{ day: '2026-06-15', intentClass: 'director', count: 3, cost: 0.003 }],
    sessions: [{ id: 'sess-1', goal: 'Review', startedAt: 1000, iteration: 2, budget: 12, status: 'completed', totalCost: 0.001, firstTouchedConceptId: 7 }],
    topConcepts: [{ id: 7, title: 'parse', domain: 'vocabulary', decisionCount: 2, box: 1, masteryPct: 30 }],
  }),
};
jest.mock('../../../renderer/api/brainVisibilityApi', () => ({ __esModule: true, default: fakeApi }));

import BrainActivityDashboard from '../../../renderer/views/brainVisibility/BrainActivityDashboard';

test('fetches dashboard on mount with default 30d window', async () => {
  render(<BrainActivityDashboard onConceptClick={jest.fn()} />);
  await waitFor(() => expect(fakeApi.dashboard).toHaveBeenCalledWith({ window: '30d' }));
});

test('window toggle re-fetches', async () => {
  render(<BrainActivityDashboard onConceptClick={jest.fn()} />);
  await waitFor(() => expect(fakeApi.dashboard).toHaveBeenCalledWith({ window: '30d' }));
  fireEvent.click(screen.getByRole('button', { name: /7d/i }));
  await waitFor(() => expect(fakeApi.dashboard).toHaveBeenCalledWith({ window: '7d' }));
});

test('clicking a session row calls onConceptClick with firstTouchedConceptId', async () => {
  const onConceptClick = jest.fn();
  render(<BrainActivityDashboard onConceptClick={onConceptClick} />);
  await screen.findByText(/Review/);
  fireEvent.click(screen.getByText(/Review/));
  expect(onConceptClick).toHaveBeenCalledWith(7);
});

test('clicking a concept row calls onConceptClick with concept id', async () => {
  const onConceptClick = jest.fn();
  render(<BrainActivityDashboard onConceptClick={onConceptClick} />);
  await screen.findByText(/parse/);
  fireEvent.click(screen.getByText(/parse/));
  expect(onConceptClick).toHaveBeenCalledWith(7);
});
```

- [ ] **Step 2: Implement**

```jsx
// src/renderer/views/brainVisibility/BrainActivityDashboard.jsx
import React, { useEffect, useState } from 'react';
import brainVisibilityApi from '../../api/brainVisibilityApi';
import MasterySnapshotStrip from './MasterySnapshotStrip';
import BrainActivityTimelineStrip from './BrainActivityTimelineStrip';
import RecentSessionsTable from './RecentSessionsTable';
import TopTouchedConceptsTable from './TopTouchedConceptsTable';

const WINDOWS = ['7d', '30d', '90d'];

export default function BrainActivityDashboard({ onConceptClick }) {
  const [window, setWindow] = useState('30d');
  const [data, setData] = useState(null);
  useEffect(() => {
    brainVisibilityApi.dashboard({ window }).then(setData);
  }, [window]);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {WINDOWS.map(w => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            style={{
              padding: '4px 12px',
              background: w === window ? '#9ad' : '#eee',
              color: w === window ? '#fff' : '#333',
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
          <BrainActivityTimelineStrip data={data.timeline} />
          <RecentSessionsTable rows={data.sessions} onRowClick={s => onConceptClick?.(s.firstTouchedConceptId)} />
          <TopTouchedConceptsTable rows={data.topConcepts} onRowClick={c => onConceptClick?.(c.id)} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/renderer/brainVisibility/BrainActivityDashboard.test.jsx`
Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/brainVisibility/BrainActivityDashboard.jsx src/__tests__/renderer/brainVisibility/BrainActivityDashboard.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-11): BrainActivityDashboard container + window toggle"
```

---

### Task 6: `ConceptInspector` + `LineageTimeline`

**Files:**
- Create: `src/renderer/views/brainVisibility/ConceptInspector.jsx`
- Create: `src/renderer/views/brainVisibility/LineageTimeline.jsx`
- Test: `src/__tests__/renderer/brainVisibility/ConceptInspector.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fakeApi = {
  concept: jest.fn().mockResolvedValue({
    meta: { id: 7, title: 'parse', domain: 'vocabulary', box: 2, masteryPct: 40, nextReview: '2026-06-20', sourceType: 'book', sourceId: 'p-abc', createdAt: '2026-06-15' },
    lineage: [
      { kind: 'created', ts: 1000, sourceType: 'book', sourceId: 'p-abc' },
      { kind: 'brain-decision', ts: 2000, sessionId: 'sess-1', tool: 'openLeitnerCard', args: { learningPointId: 7 } },
    ],
    costToDate: 0.003,
    boxOverTime: null,
  }),
};
jest.mock('../../../renderer/api/brainVisibilityApi', () => ({ __esModule: true, default: fakeApi }));

import ConceptInspector from '../../../renderer/views/brainVisibility/ConceptInspector';

test('fetches concept on mount; renders header + lineage', async () => {
  render(<ConceptInspector learningPointId={7} onClose={jest.fn()} />);
  await waitFor(() => expect(fakeApi.concept).toHaveBeenCalledWith({ learningPointId: 7 }));
  await screen.findByText(/parse/);
  expect(screen.getByText(/box 2/i)).toBeInTheDocument();
  expect(screen.getByText(/openLeitnerCard/)).toBeInTheDocument();
  expect(screen.getByText(/0\.003/)).toBeInTheDocument();
});

test('null learningPointId: renders nothing', () => {
  const { container } = render(<ConceptInspector learningPointId={null} onClose={jest.fn()} />);
  expect(container.textContent).toBe('');
});

test('onClose fires when close button clicked', async () => {
  const onClose = jest.fn();
  render(<ConceptInspector learningPointId={7} onClose={onClose} />);
  await screen.findByText(/parse/);
  fireEvent.click(screen.getByRole('button', { name: /close|×/i }));
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement `LineageTimeline.jsx`**

```jsx
import React from 'react';

const KIND_LABELS = { created: '✨ Created', 'brain-decision': '🧠 Brain decision', 'user-review': '👤 Reviewed', mastered: '🏆 Mastered' };

export default function LineageTimeline({ events }) {
  if (!events || events.length === 0) return <em style={{ color: '#999' }}>No lineage events</em>;
  return (
    <div>
      {events.map((ev, i) => (
        <div key={i} style={{ padding: 8, borderLeft: '3px solid #9ad', marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: '#888' }}>{KIND_LABELS[ev.kind] || ev.kind} · {new Date(ev.ts).toLocaleString()}</div>
          <div style={{ fontSize: 13 }}>
            {ev.kind === 'created' && <>From <code>{ev.sourceType}</code> / <code>{ev.sourceId}</code></>}
            {ev.kind === 'brain-decision' && <>{ev.tool} {ev.sessionId && <code style={{ fontSize: 11 }}>(session {ev.sessionId.slice(0, 8)})</code>}</>}
            {ev.kind === 'user-review' && <>Rating: {ev.rating}</>}
            {ev.kind === 'mastered' && <>Mastery: {ev.finalMastery}%</>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement `ConceptInspector.jsx`**

```jsx
import React, { useEffect, useState } from 'react';
import brainVisibilityApi from '../../api/brainVisibilityApi';
import LineageTimeline from './LineageTimeline';

export default function ConceptInspector({ learningPointId, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (learningPointId == null) { setData(null); return; }
    brainVisibilityApi.concept({ learningPointId }).then(setData);
  }, [learningPointId]);
  if (learningPointId == null) return null;
  if (!data) return <Drawer onClose={onClose}><div style={{ padding: 24 }}>Loading...</div></Drawer>;
  if (!data.meta) return <Drawer onClose={onClose}><div style={{ padding: 24 }}>Concept not found.</div></Drawer>;
  return (
    <Drawer onClose={onClose}>
      <div style={{ padding: 16 }}>
        <h2 style={{ margin: 0 }}>{data.meta.title}</h2>
        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#666', marginTop: 6 }}>
          <span style={{ background: '#eef', padding: '2px 8px', borderRadius: 10 }}>{data.meta.domain}</span>
          <span>box {data.meta.box}</span>
          <span>mastery {data.meta.masteryPct}%</span>
          {data.meta.nextReview && <span>next: {data.meta.nextReview}</span>}
        </div>
        <div style={{ fontSize: 12, color: '#666', margin: '12px 0', padding: '6px 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
          Cost to date: <strong>${data.costToDate.toFixed(4)}</strong>
          {data.boxOverTime ? null : <span style={{ marginLeft: 12, fontStyle: 'italic' }}>(snapshot only — no event history)</span>}
        </div>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Lineage</h3>
        <LineageTimeline events={data.lineage} />
      </div>
    </Drawer>
  );
}

function Drawer({ children, onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: 480, maxWidth: '95vw', height: '100vh',
      background: '#fff', boxShadow: '-2px 0 12px rgba(0,0,0,0.15)', zIndex: 9000, overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 8 }}>
        <button onClick={onClose} aria-label="close" style={{ fontSize: 18, background: 'none', border: 0, cursor: 'pointer' }}>×</button>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/__tests__/renderer/brainVisibility/ConceptInspector.test.jsx`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/brainVisibility/ConceptInspector.jsx src/renderer/views/brainVisibility/LineageTimeline.jsx src/__tests__/renderer/brainVisibility/ConceptInspector.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-11): ConceptInspector drawer + LineageTimeline"
```

---

### Task 7: Wire "Visibility" tab into `BrainDashboardPanel` + URL param

**Files:**
- Modify: `src/renderer/components/brainShell/BrainDashboardPanel.jsx` (or whichever file holds it — find via grep)
- Test: extend `src/__tests__/renderer/brainShell/` with a visibility-tab smoke test

- [ ] **Step 1: Locate `BrainDashboardPanel`**

Run: `grep -rn "BrainDashboardPanel\|Rationale.*Economics" src/renderer/components/`. Read the component to understand the existing tab structure (likely MUI Tabs).

- [ ] **Step 2: Add Visibility tab**

```jsx
// inside the tabs JSX (existing Rationale + Economics tabs):
<Tab label="Visibility" value="visibility" />

// inside the tab content area:
{activeTab === 'visibility' && (
  <>
    <BrainActivityDashboard onConceptClick={setInspectId} />
    <ConceptInspector learningPointId={inspectId} onClose={() => setInspectId(null)} />
  </>
)}
```

Add state + URL sync:

```jsx
import { useSearchParams } from 'react-router-dom';
import BrainActivityDashboard from '../../views/brainVisibility/BrainActivityDashboard';
import ConceptInspector from '../../views/brainVisibility/ConceptInspector';

const [searchParams, setSearchParams] = useSearchParams();
const [inspectId, setInspectId] = useState(() => {
  const p = searchParams.get('inspect');
  return p ? Number(p) : null;
});
useEffect(() => {
  if (inspectId == null) {
    if (searchParams.has('inspect')) {
      const next = new URLSearchParams(searchParams); next.delete('inspect'); setSearchParams(next, { replace: true });
    }
  } else {
    setSearchParams({ inspect: String(inspectId) }, { replace: true });
  }
}, [inspectId]);
```

(Adapt to whether the parent route supports `useSearchParams` — fall back to plain state if not in a `Router` context.)

- [ ] **Step 3: Smoke test the tab**

```jsx
// src/__tests__/renderer/brainShell/BrainDashboardPanel.visibility.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fakeApi = { dashboard: jest.fn().mockResolvedValue({ mastery: [], timeline: [], sessions: [], topConcepts: [] }) };
jest.mock('../../../renderer/api/brainVisibilityApi', () => ({ __esModule: true, default: fakeApi }));

// Mock the existing rationale + economics IPC clients so the panel can mount
jest.mock('../../../renderer/api/callLedgerApi', () => ({ __esModule: true, default: {
  aggregateByIntent: jest.fn().mockResolvedValue([]),
  aggregateByProvider: jest.fn().mockResolvedValue([]),
  listSessionTraces: jest.fn().mockResolvedValue([]),
} }));

import BrainDashboardPanel from '../../../renderer/components/brainShell/BrainDashboardPanel';

test('Visibility tab renders without crashing', async () => {
  render(<MemoryRouter><BrainDashboardPanel /></MemoryRouter>);
  const tab = screen.queryByRole('tab', { name: /visibility/i });
  if (tab) fireEvent.click(tab);
  // The strip headers should appear
  await screen.findByText(/Mastery Snapshot|Loading/i);
});
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/__tests__/renderer/brainShell/BrainDashboardPanel.visibility.test.jsx`
Expected: passing.

Full regression: `npx jest src/__tests__/renderer/`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/brainShell/BrainDashboardPanel.jsx src/__tests__/renderer/brainShell/BrainDashboardPanel.visibility.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-11): wire Visibility tab into BrainDashboardPanel"
```

---

### Task 8: Integration test — full session → visibility surface

**Files:**
- Create: `src/__tests__/integration/brainVisibilityHappyPath.test.js`

- [ ] **Step 1: Write test**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  dbManager.__setDb(db);
  return db;
}

const CallLedgerStore = require('../../main/db/CallLedgerStore');
const AISessionStore = require('../../main/db/AISessionStore');
const BrainVisibilityService = require('../../main/utils/BrainVisibilityService');

test('end-to-end: completed session shows in dashboard + concept inspector', async () => {
  freshDb();
  // Seed a learning point
  const db = dbManager.getDb();
  db.prepare(`
    INSERT INTO learning_point (id, user_id, domain_type, title, content, source_type, source_id, box, mastery_level, next_review, created_at, updated_at)
    VALUES (1, 1, 'vocabulary', 'parse', 'analyze', 'book', 'p-1', 1, 25, '2026-06-25', '2026-06-15', '2026-06-15')
  `).run();
  // Record a session + ledger
  const now = Date.now();
  CallLedgerStore.record({
    intent: 'director-session-step', ts: now, provider: 'deepseek',
    context_keys: [], prompt_tokens: 100, completion_tokens: 50, cost_usd: 0.002,
    cache_hit: false, cache_key: null, duration_ms: 200, trigger_id: null,
    output_summary: 's', output_json: null, trace_id: 'tr-ZZZ',
  });
  AISessionStore.persistCompleted({
    id: 'sess-ZZZ', userId: 1, questId: null, goal: 'Master parse',
    traceId: 'tr-ZZZ', status: 'completed', iteration: 1, budget: 12,
    startedAt: now, endedAt: now + 1000, errorReason: null,
    trace: [
      { iteration: 0, kind: 'tool', payload: { tool: 'openLeitnerCard', args: { learningPointId: 1 } }, ts: now },
    ],
  });

  const dash = await BrainVisibilityService.getDashboard({ window: '7d', userId: 1 });
  expect(dash.sessions[0].id).toBe('sess-ZZZ');
  expect(dash.topConcepts[0].id).toBe(1);
  expect(dash.topConcepts[0].decisionCount).toBe(1);

  const concept = await BrainVisibilityService.getConcept({ learningPointId: 1, userId: 1 });
  expect(concept.meta.title).toBe('parse');
  expect(concept.lineage.some(e => e.kind === 'brain-decision' && e.sessionId === 'sess-ZZZ')).toBe(true);
  expect(concept.costToDate).toBeCloseTo(0.002);
});
```

- [ ] **Step 2: Run**

Run: `npx jest src/__tests__/integration/brainVisibilityHappyPath.test.js`
Expected: passing.

Full regression: `npx jest`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/brainVisibilityHappyPath.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(phase-11): integration — session → dashboard → concept inspector"
```

---

## Success criteria

- All 8 tasks committed.
- New tests: ≥ 18 across BrainVisibilityService (4), IPC (1), strips (4), dashboard container (4), inspector (3), panel-wire smoke (1), integration (1).
- `npx jest` green; pre-existing smoke failure not introduced by these changes.
- Manual: complete a Director session via 10b-2 UI, open BrainDashboardPanel → Visibility, confirm the session appears in Recent Sessions and the touched concept appears in Top-Touched Concepts. Click the concept → ConceptInspector shows lineage with the session's Brain decision and the correct cost.

**Out of scope:**
- Historical mastery trajectory chart (no event history).
- Attributed mastery deltas.
- Calendar heatmap.
- Predictive recommendations.
- Export.
