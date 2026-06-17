# Phase 11 — Brain Visibility

**Date:** 2026-06-17
**Status:** Spec — approved
**Predecessor:** Phase 9 (per-decision Rationale + per-call Economics) + Phase 10 (Director, with `trace_id` linking multi-iteration runs)
**Successor:** Phase 12+ (event-history tables, attributed mastery deltas, predictive recs)

## 1. Problem

Phase 9 made *one decision* visible (RationaleCard) and *one LLM call* visible (EconomicsPanel). Phase 10 made *one session* visible (Director trace). But the long-timescale view — "what has the Brain been doing for me over a week?" and "why am I learning this concept?" — is missing. Without it, users can't tell whether all this AI is moving learning forward, and they have no entry point into the lineage of any single concept.

Phase 11 closes the loop: a Visibility tab in BrainDashboardPanel with an Activity Dashboard (aggregate view) and a Concept Inspector (per-concept drilldown), both read-only over existing data — no new tables.

## 2. Goals

- **G1** — A new "Visibility" tab in `BrainDashboardPanel` (joins existing Rationale + Economics surfaces).
- **G2** — `BrainActivityDashboard` with 4 strips: Mastery snapshot, Brain activity timeline, Recent sessions, Top-touched concepts. Time-window toggle 7d / 30d / 90d.
- **G3** — `ConceptInspector` drawer reachable from session rows + concept rows. Shows concept metadata, lineage timeline (Brain decisions + user reviews + creation), cost-to-date.
- **G4** — A `BrainVisibilityService` in main process aggregating over `brain_call_ledger`, `ai_sessions`, `ai_session_trace`, `learning_point`, plus available SR event source. New IPC channels + renderer client.
- **G5** — Concept attribution via `trace_id`: scan `ai_session_trace.payload_json` for tool args with `learningPointId` → attribute Brain decisions to concepts.
- **G6** — URL-addressable inspector: `/brain-dashboard?inspect=<lpId>` opens the inspector for that concept.

## 3. Non-goals

- **N1** — Historical mastery trajectory line chart. No event history table exists for mastery changes; we'd need to either backfill or instrument going forward. Defer to Phase 12.
- **N2** — Counterfactuals ("what if Brain had picked differently"). Not data we have.
- **N3** — Calendar heatmap (GitHub-style contribution graph). Defer.
- **N4** — Predictive recommendations ("you'll likely struggle with X next"). Defer.
- **N5** — Export to CSV/PDF. Defer.
- **N6** — New event-tracking tables. Phase 11 is purely a consumer of existing data. If something can't be computed from current schema, it gets a "snapshot only" label, not a new write path.

## 4. Architecture

### 4.1 Location & layout

```
BrainDashboardPanel (existing — under /knowledge or its own route)
  Tabs:
    Rationale (existing — Phase 9b)
    Economics (existing — Phase 9b + 10b-3 per-session)
    Visibility (NEW — Phase 11)
      ├── BrainActivityDashboard (main panel)
      │     ├── Time-window toggle [7d 30d 90d]
      │     ├── Mastery Snapshot (chart strip)
      │     ├── Brain Activity Timeline (chart strip)
      │     ├── Recent Sessions (table strip)
      │     └── Top-Touched Concepts (table strip)
      └── ConceptInspector (drawer — slides in from right on row click;
                            also opens via ?inspect=<lpId> URL param)
            ├── Concept Header (title, domain, box, mastery, next review)
            ├── Lineage Timeline (newest first, mixed event types)
            ├── Cost To Date (sum of attributed ledger entries)
            └── Box-over-Time Sparkline (only if data available;
                                         else current-state badge)
```

### 4.2 Data sources

| Need | Source |
|---|---|
| Current mastery by domain/box | `learning_point.mastery_level`, `learning_point.box`, `learning_point.domain_type` |
| Per-day call counts by intent class | `brain_call_ledger` GROUP BY date(ts), intent |
| Session list with cost + iteration | `ai_sessions` JOIN `brain_call_ledger` on trace_id |
| Concept attribution | `ai_session_trace.payload_json` JSON-scan for `learningPointId` |
| User reviews / box changes | `sr_item` table (or `learning_session` analytics — see Phase 8 docs); fallback "snapshot only" if absent |
| Concept creation source | `learning_point.source_type`, `learning_point.source_id`, `learning_point.created_at` |

### 4.3 Concept attribution rule

`trace_id` is the only reliable link between a ledger entry and a concept:

1. For Director sessions: every `ai_session_trace` row has a `payload_json` with the tool name and args. Scan `payload` for `learningPointId`, `lpId`, or similar field. The session's `trace_id` then attributes every `brain_call_ledger` row with that trace_id to the concept.
2. For Phase 4-8 outside-session calls: ledger rows have `trigger_id` pointing to the Trigger; Triggers have context but not always a concept ID. For v1, count these in the timeline aggregate but skip per-concept attribution.

A concept's `costToDate` = sum of `cost_usd` over all ledger rows whose trace_id appears in `ai_session_trace` rows mentioning that `learningPointId`.

### 4.4 BrainVisibilityService API (main process)

```js
// src/main/utils/BrainVisibilityService.js
module.exports = {
  /**
   * Returns the full dashboard payload for a time window.
   * @param {Object} opts
   * @param {'7d'|'30d'|'90d'} opts.window
   * @param {number} opts.userId
   * @returns {Promise<{
   *   mastery: Array<{ domain: string, box: number, count: number }>,
   *   timeline: Array<{ day: string, intentClass: string, count: number, cost: number }>,
   *   sessions: Array<{ id: string, goal: string, startedAt: number, endedAt: number,
   *                     iteration: number, budget: number, status: string,
   *                     totalCost: number, firstTouchedConceptId: number|null }>,
   *   topConcepts: Array<{ id: number, title: string, domain: string,
   *                        decisionCount: number, box: number, masteryPct: number }>,
   * }>}
   */
  async getDashboard({ window, userId }) { ... },

  /**
   * Returns the per-concept inspector payload.
   * @returns {Promise<{
   *   meta: { id, title, domain, box, masteryPct, nextReview, sourceType, sourceId, createdAt },
   *   lineage: Array<LineageEvent>,
   *   costToDate: number,
   *   boxOverTime: Array<{ ts: number, box: number }> | null,
   * }>}
   */
  async getConcept({ learningPointId, userId }) { ... },
};

// LineageEvent variants:
type LineageEvent =
  | { kind: 'created', ts: number, sourceType: string, sourceId: string }
  | { kind: 'brain-decision', ts: number, sessionId: string, tool: string, args: object,
      callId: number|null, costUsd: number|null }
  | { kind: 'user-review', ts: number, rating: string|number, durationMs: number|null,
      box: number|null }
  | { kind: 'mastered', ts: number, finalMastery: number };
```

### 4.5 IPC channels

```
brainVisibility:dashboard  → { window, userId } → DashboardPayload
brainVisibility:concept    → { learningPointId, userId } → ConceptPayload
```

### 4.6 Renderer client

```js
// src/renderer/api/brainVisibilityApi.js
const brainVisibilityApi = {
  dashboard: ({ window = '30d', userId = 1 } = {}) =>
    ipcRenderer.invoke('brainVisibility:dashboard', { window, userId }),
  concept: ({ learningPointId, userId = 1 }) =>
    ipcRenderer.invoke('brainVisibility:concept', { learningPointId, userId }),
};
```

### 4.7 Time-window semantics

- `7d` = `ts >= now - 7*24*60*60*1000`
- `30d` = `now - 30 days`
- `90d` = `now - 90 days`

All timestamps are Unix ms (matches `brain_call_ledger.ts` + `ai_sessions.started_at`). `learning_point.created_at` is stored as ISO string per Phase 3; convert at query time.

### 4.8 Intent classification (for timeline strip)

Group raw intents into 4 visible classes for chart readability:
- **`director`** — `director-session-step`, `director-pull-suggestion`
- **`legacy`** — anything matching `legacy:*`
- **`extraction`** — `concept-extraction`, `concept-enrichment`, related
- **`other`** — everything else

## 5. Components

### 5.1 BrainActivityDashboard (renderer)

```jsx
// src/renderer/views/brainVisibility/BrainActivityDashboard.jsx
function BrainActivityDashboard({ onConceptClick }) {
  const [window, setWindow] = useState('30d');
  const [data, setData] = useState(null);
  useEffect(() => { brainVisibilityApi.dashboard({ window }).then(setData); }, [window]);
  if (!data) return <Loading />;
  return (
    <>
      <WindowToggle value={window} onChange={setWindow} />
      <MasterySnapshotStrip data={data.mastery} />
      <BrainActivityTimelineStrip data={data.timeline} />
      <RecentSessionsTable rows={data.sessions} onRowClick={s => onConceptClick(s.firstTouchedConceptId)} />
      <TopTouchedConceptsTable rows={data.topConcepts} onRowClick={c => onConceptClick(c.id)} />
    </>
  );
}
```

Chart library: use whatever the project already uses for charts (likely Recharts or none — fall back to simple SVG or `<table>` if no library). The strips are functionally tables-with-bars; nothing fancy needed for v1.

### 5.2 ConceptInspector (drawer)

```jsx
// src/renderer/views/brainVisibility/ConceptInspector.jsx
function ConceptInspector({ learningPointId, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (learningPointId == null) return;
    brainVisibilityApi.concept({ learningPointId }).then(setData);
  }, [learningPointId]);
  if (!data) return <Drawer><Loading /></Drawer>;
  return (
    <Drawer onClose={onClose}>
      <ConceptHeader meta={data.meta} costToDate={data.costToDate} />
      {data.boxOverTime ? <BoxSparkline series={data.boxOverTime} /> : <SnapshotBadge box={data.meta.box} />}
      <LineageTimeline events={data.lineage} />
    </Drawer>
  );
}
```

### 5.3 BrainDashboardPanel integration

`BrainDashboardPanel` already has tabs for Rationale + Economics. Add a third tab "Visibility" that mounts `BrainActivityDashboard`. The dashboard's `onConceptClick` callback sets a `selectedConceptId` state that the panel passes to a slide-in `ConceptInspector`. URL sync via React Router's `useSearchParams` for the `inspect` query param.

## 6. Success criteria

- All Phase 9–10 tests pass (regression).
- New tests:
  - `BrainVisibilityService.getDashboard` returns correct counts/sums for a fixture with multiple sessions + ledger entries.
  - `getConcept` attributes the correct ledger entries via trace_id JSON-scan.
  - IPC roundtrip test for both channels.
  - `BrainActivityDashboard` renders all 4 strips given mock data; window toggle re-fetches.
  - `ConceptInspector` renders lineage timeline; opens via prop change.
- Integration test: full dashboard fetch + concept inspect, real `:memory:` SQLite.
- Manual: boot, complete a Director session via Plan 10b-2 UI, open BrainDashboard → Visibility tab, confirm the session appears in Recent Sessions, click a concept, confirm the lineage shows the session's Brain decisions.

## 7. Risks

| Risk | Mitigation |
|---|---|
| `ai_session_trace.payload_json` JSON-scan is slow on large traces | Index `ai_session_trace.session_id` (already exists); cap LIMIT at 200 per dashboard fetch. For concept inspector, only scan traces whose session_id appears in a pre-filtered set. |
| Concept-attribution can't find `learningPointId` for Phase 4-8 calls | v1 marks these in the timeline aggregate but skips per-concept; documented in N6 → Phase 12 extension. |
| `sr_item` / `learning_session` shape varies across project history | The service feature-detects what's available; missing source → `boxOverTime: null` and "snapshot only" badge. |
| Chart library not installed | Use simple SVG bars + `<table>` for v1; Recharts can be added later. |
| Many users on shared install | `userId` is plumbed through every query; defaults to 1 per project convention. |
| Time-window toggle re-fetches whole payload | Acceptable for v1; cache in memory on Tab mount for 30s if needed. |
| `getDashboard` query takes > 500ms p95 | Add EXPLAIN QUERY PLAN check on the 4 inner queries; ensure indexes on `brain_call_ledger.ts`, `ai_sessions.started_at`. |

## 8. Out of scope / follow-up

- **Phase 12 (potential)** — instrument mastery-change events into a new table → real trajectory chart.
- **Phase 12+** — attributed mastery deltas ("12 concepts moved box 1→3 from Director sessions"). Needs event history.
- **Phase 13** — predictive recommendations from cross-session analytics.
- **Outside scope of this whole arc** — counterfactuals, calendar heatmap, export.
