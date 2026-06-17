# Phase 12 — Historical Mastery Trajectory

**Date:** 2026-06-17
**Status:** Spec — approved
**Predecessor:** Phase 11 (Brain Visibility — current-state snapshots + concept-attributed Brain decisions)
**Successor:** Phase 13+ (attributed mastery deltas, predictive recommendations)

## 1. Problem

Phase 11 made the Brain's *recent activity* visible, but the "mastery over time" line — the one chart that would prove "this is working" — is missing because we only have current snapshots, no history. `ConceptInspector` shows a "snapshot only" badge. `BrainActivityDashboard` has no trajectory strip.

Phase 12 closes this by adding a `mastery_event` append-only table, backfilling it from existing review/session data on first boot, and instrumenting every forward write that changes box or mastery. The chart then renders from real history.

## 2. Goals

- **G1** — New `mastery_event` table (append-only, idempotent inserts).
- **G2** — `MasteryEventStore` DAO with `record()`, `queryByConcept(lpId)`, `queryDomainAverages({ window })`.
- **G3** — One-shot backfill job: scan `sr_item` / `learning_session` / `learning_velocity` (whichever exist) → emit events with `source='backfill'`. Idempotent via UNIQUE index.
- **G4** — Boot trigger: if `mastery_event` is empty, run backfill async after main process is ready.
- **G5** — Forward instrumentation in `LearningPointManager` (production-grade, Leitner box change, mastery writes) + Director session userResult (Leitner rating).
- **G6** — `BrainVisibilityService.getConcept` returns real `boxOverTime`; `getDashboard` returns new `masteryTrajectory` slice.
- **G7** — UI: ConceptInspector sparkline; BrainActivityDashboard `MasteryTrajectoryStrip`.

## 3. Non-goals

- **N1** — Replacing the existing `learning_point.box` / `mastery_level` columns. Those stay as the source of truth for current state. `mastery_event` is parallel history.
- **N2** — Reconstructing past mastery for concepts with no source data (no `sr_item` rows, no session events). Those concepts get one `'imported'` event at `learning_point.created_at` showing the current box/mastery, so the inspector has something to render.
- **N3** — Counterfactuals.
- **N4** — Reset / un-do support. Forward writes append-only; no UPDATE / DELETE flows on `mastery_event`.
- **N5** — Real-time UI invalidation on new events. The chart fetches on tab mount + window change; no push.
- **N6** — Backfilling from `brain_call_ledger` or `ai_session_trace` directly — those are signals, not state changes.

## 4. Architecture

### 4.1 Event shape

| field | type | notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `learning_point_id` | TEXT NOT NULL | FK to `learning_point.id` (TEXT) |
| `user_id` | INTEGER NOT NULL | |
| `ts` | INTEGER NOT NULL | Unix ms |
| `event_type` | TEXT NOT NULL | `'review' \| 'box_change' \| 'mastery_change' \| 'reset' \| 'imported'` |
| `prev_box` | INTEGER | nullable |
| `new_box` | INTEGER | nullable |
| `prev_mastery` | REAL | nullable |
| `new_mastery` | REAL | nullable |
| `rating` | TEXT | nullable; one of `'again'`, `'hard'`, `'good'`, `'easy'` for `event_type='review'` |
| `source` | TEXT NOT NULL | `'user-review' \| 'director-session' \| 'backfill' \| 'fsrs' \| 'production-grade'` |
| `source_ref` | TEXT | nullable; session_id / trace_id / sr_item_id etc. |
| `notes` | TEXT | nullable |

Indexes:
- `(learning_point_id, ts)` — concept-history queries.
- `(user_id, ts)` — global / domain rollups.
- UNIQUE `(learning_point_id, ts, event_type, COALESCE(source_ref, ''))` — backfill idempotency.

### 4.2 Backfill rules

For each existing source, on first run:

1. **`sr_item`** (FSRS state) — if exists. For each row: emit `review` event at `last_review_ts` with `rating` (or null if not stored), `source='backfill'`, `source_ref=sr_item.id`, `new_mastery` from current ease/scheduled.
2. **`learning_session`** — for each row touching a `learning_point`: emit `mastery_change` event at session end, `source='backfill'`, `source_ref=session.id`.
3. **`learning_velocity`** — if exists and has timestamped mastery snapshots: emit `mastery_change` per snapshot, `source='backfill'`.
4. **`learning_point` (catchall)** — for every `learning_point` with NO mastery events after backfill: emit one `imported` event at `created_at` with `new_box`, `new_mastery` from current state, `source='backfill'`. This guarantees the inspector always has at least one point to render.

All emits go through the same unique index; re-runs are safe.

### 4.3 Forward writes

| Site | Event |
|---|---|
| `LearningPointManager.applyProductionGrade(lpId, grade)` | `event_type='mastery_change'`, `source='production-grade'`, `prev_mastery` + `new_mastery` |
| `LearningPointManager.advanceLeitnerBox(lpId, dir)` | `event_type='box_change'`, `source='user-review'`, `prev_box` + `new_box` |
| Any other site that writes `learning_point.box` or `mastery_level` | emit `box_change` or `mastery_change` accordingly |
| Director session userResult (Leitner rating) | `event_type='review'`, `source='director-session'`, `source_ref=traceId`, `rating` |

The forward hooks live in the same module as the write — no new event-bus abstraction. Each call site just does the write then `MasteryEventStore.record({...})`.

### 4.4 Service additions

`BrainVisibilityService.getConcept` — change `boxOverTime: null` → real array. Each entry: `{ ts, box, mastery, eventType, source }`. Sorted ascending by `ts`. Includes all events for that lp.

`BrainVisibilityService.getDashboard` — add new slice:
```js
masteryTrajectory: Array<{
  day: string,           // 'YYYY-MM-DD'
  domain: string,
  avgMastery: number,    // average across that domain on that day's events
  eventCount: number,
}>
```

### 4.5 IPC

Both new responses are on the existing channels (`brainVisibility:dashboard`, `brainVisibility:concept`). No new IPC.

### 4.6 UI

- **`MasteryTrajectoryStrip`** (new) — line per domain, x = day, y = avgMastery. Inline SVG (project has no chart lib). Same pattern as `BrainActivityTimelineStrip` from Phase 11: per-day rows, but rendered as lines instead of bars.
- **ConceptInspector** (modify) — replace the "snapshot only" badge with a small inline SVG sparkline showing box + mastery over time. Compact (~40px tall).

## 5. Success criteria

- All Phase 9–11 tests pass.
- New tests:
  - `MasteryEventStore.record` + `queryByConcept` + `queryDomainAverages` (DAO).
  - Backfill idempotency: running backfill twice produces the same row count.
  - Forward write: calling `LearningPointManager.applyProductionGrade` emits an event.
  - Director session userResult emits a `'review'` event when surface = `openLeitnerCard`.
  - `BrainVisibilityService.getConcept` returns non-null `boxOverTime` after backfill.
  - `BrainVisibilityService.getDashboard` returns `masteryTrajectory` slice.
  - UI: `MasteryTrajectoryStrip` renders lines for multiple domains; ConceptInspector sparkline renders given history.
- Integration test: seed two learning points + sr_item + session, run backfill, call `getConcept` → assert chart-ready data.
- Manual: boot app, see backfill log line; open BrainDashboard → Visibility, see Mastery Trajectory strip with real lines; click a concept that's been reviewed, see sparkline replace the snapshot badge.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Backfill slow on large `sr_item` (10k+ rows) | Run async after main ready; batch INSERTs in transactions of 500. |
| `sr_item` schema unknown / varies | Feature-detect required columns; if missing, fall back to `learning_point` catchall only. |
| `learning_velocity` doesn't exist | Skip silently. |
| Forward hook missed at a write site → drift | Audit checklist in commit message of forward-instrumentation task. |
| Multi-user collisions on backfill (concurrent users) | Backfill is keyed by `user_id` + scoped to one user at a time. |
| FK to `learning_point.id` for non-existent concepts (orphans) | `ON DELETE CASCADE`. |
| Unique-index conflicts on `imported` catchall when concept also has `sr_item` rows | The imported event only fires for concepts with NO post-backfill events — checked via subquery. |
| Big `mastery_event` table growth (1M+ rows) | Prune events older than 365 days for users not opted into long-term history. Defer to Phase 13. |
| Time-zone bugs in `day` rollup | Use UTC in `date(ts/1000, 'unixepoch')`; UI displays as-is. |

## 7. Out of scope / follow-up

- **Phase 13 (potential)** — attributed mastery deltas ("12 concepts moved box 1→3 from Director sessions this month"). Requires Phase 12 + cross-table joins.
- **Phase 13+** — predictive recommendations.
- **Future** — opt-in long-term retention + pruning policy.
