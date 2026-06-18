# Phase 13 — Attribution Layer (LLM ROI Surface)

**Status:** Draft — awaiting user review before plan
**Date:** 2026-06-18
**Predecessor:** Phase 12 (Mastery Trajectory) — added `mastery_event` table with `source` + `source_ref` columns
**Successor:** Phase 14+ (predictive recommendations, anomaly detection on attribution data)

---

## 1. Premise

After four phases of building Brain data infrastructure (Phases 9–12 + AI-driven shell), we have:

- **Visibility** (Phase 11) — *what happened* (mastery summary, timeline, sessions, top concepts)
- **Trajectory** (Phase 12) — *how mastery evolved over time* (sparklines + event log)
- **Economics** (Phase 9) — *what we spent* (cost by intent, cost by provider)

We are missing the most load-bearing question: **is the Brain earning its keep?**

Raw cost data ("we spent $X this week on `extract-learning-points`") is half a story without outcome data ("…and that produced Y mastery moves"). Phase 13 closes the loop by joining mastery events to the LLM calls that caused them and surfacing **cost-per-mastery-move** as a first-class lens.

This is not a vanity feature. It directly addresses:

- The user's stated motivation: *"prove Brain is earning its keep."*
- The Phase 9 risk register: *"per-intent cost ceilings should be informed by ROI, not guessed."*
- The Director Mode (Phase 10) credibility gap: *is AI-driven session selection actually more efficient than user-driven Leitner review?*

The product statement: **we don't measure spend, we measure returns.**

---

## 2. Decisions locked from brainstorm

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| 1 | Direction | A3 — cost-per-mastery-move | Rejected A1 (source pie, too familiar) and A2 (per-concept log, secondary drill-down) |
| 2 | Scope | S3 — every Brain-mediated mastery write | Rejected S1 (Director-only, too thin) and S2 (3 sources, leaves long tail untracked) |
| 3 | Lens dimension | Three lenses with toggle/drill: **L3 (attention-state) default → L2 (phase) toggle → L1 (intent) click-through** | Rejected single-lens (no one lens answers every question well) |
| 4 | Attribution algorithm | Hybrid: `proximate_call_id` FK when direct, amortized cost when chained | Rejected time-window proximity matching (unreliable, erodes trust); rejected many-to-many weighting (weights unprincipled) |
| 5 | Surface placement | Restructure `EconomicsPanel` → "Spend & Returns" with 3 tabs: **ROI** (default) / **Spend** / **Sessions** | Rejected new top-level tab (fragments related data), new route (discoverability disaster) |
| 6 | Drill-down behavior | Progressive inline disclosure → side-panel detail → existing `RationaleCard` for proximate call | Rejected modal-only (loses context), navigation-style (loses place) |
| 7 | Time window | Brushable timeline strip, 30d default, URL/localStorage state | Rejected preset toggles (forces arbitrary buckets) |
| 8 | Backfill rows | "Untracked (historical)" bucket, always shown, $0 cost, tooltip explains | Rejected hard-exclude (hides real data), default-hidden toggle (partial truth feels evasive) |

---

## 3. Architecture

### 3.1 Schema additions

```sql
-- Add two columns to existing mastery_event table
ALTER TABLE mastery_event ADD COLUMN proximate_call_id INTEGER
  REFERENCES brain_call_ledger(id);
ALTER TABLE mastery_event ADD COLUMN feature_surface TEXT NOT NULL
  DEFAULT 'unknown';

-- Indices for the JOIN-heavy aggregation queries
CREATE INDEX idx_mastery_event_surface_ts
  ON mastery_event(feature_surface, ts);
CREATE INDEX idx_mastery_event_proximate_call
  ON mastery_event(proximate_call_id) WHERE proximate_call_id IS NOT NULL;
```

Migration safety:

- `ALTER ADD COLUMN` is non-blocking in SQLite for any table size we'll encounter.
- All existing rows get `proximate_call_id=NULL` (correct — we don't know retroactively) and `feature_surface='unknown'` (which the backfill-row migration step will rewrite to `'backfill'`).
- One-shot data migration script (in `MasteryEventBackfill` or a sibling): `UPDATE mastery_event SET feature_surface='backfill' WHERE source='backfill'`. Idempotent.

### 3.2 `feature_surface` enum

Closed set. Lives in `src/main/db/masteryEventEnums.js` (new file, exports the enum + the attention-state mapping).

| Value | Written by | LLM-driven? | L3 attention-state |
|-------|-----------|-------------|---------------------|
| `reading-microcard` | MicroCardProposer accept path | Yes (chained: extract + propose) | `while-reading` |
| `director-session` | SessionRunner Leitner rating handler | Yes (direct: `director-session-step`) | `focused-session` |
| `comprehension` | ComprehensionGradingService grade path | Yes (direct: `grade-comprehension`) | `focused-session` |
| `production-prompt` | LearningPointManager.applyProductionGrade | Yes (direct: `production-grade`) | `focused-session` |
| `pre-reading-diagnostic` | BookDiagnosticService → primer-driven mastery moves | Yes (chained) | `while-reading` |
| `manual-review` | LearningPointManager.updateLeitnerBoxAfterReview (user-driven) | No | `focused-session` |
| `backfill` | MasteryEventBackfill | No | `historical` |
| `unknown` | (catch-all for any new writer that hasn't been tagged yet) | n/a | `historical` |

`unknown` is the lint guard — a CI check (or runtime warn in dev) flags any new write path that defaults to `'unknown'` so we don't silently leak attribution coverage.

### 3.3 Forward instrumentation work

Per attribution algorithm decision, every mastery-event-writing site must:

1. Set `featureSurface` to a closed-enum value.
2. Set `proximateCallId` when a single LLM call directly caused the write (Director, comprehension, production-grade). Otherwise leave null and rely on amortization.

| Surface | Site | Change |
|---------|------|--------|
| Director session | `SessionRunner.js:252` | Add `featureSurface: 'director-session'`. Add `proximateCallId` by querying most-recent `brain_call_ledger` row for this trace_id. |
| Comprehension grading | `ComprehensionGradingService.gradeAnswer` | **Does not currently write `mastery_event`**. Add the write with `featureSurface: 'comprehension'`, `proximateCallId` from the `brainCall` return. |
| Micro-card accept | `MicroCardProposer` accept path (currently writes to `learning_point` only) | Add `mastery_event` write with `featureSurface: 'reading-microcard'`, `proximateCallId=null` (chain too long for direct attribution). |
| Production grade | `LearningPointManager.js:608` | Add `featureSurface: 'production-prompt'`, propagate `proximateCallId` from `applyProductionGrade` caller. |
| User review | `LearningPointManager.js:1050` | Add `featureSurface: 'manual-review'`. `proximateCallId` stays null (no LLM). |
| Backfill | `MasteryEventBackfill.js` (4 sites) | Add `featureSurface: 'backfill'`. |
| Pre-reading diagnostic | `BookDiagnosticService` mastery-move path (verify it has one) | Add `featureSurface: 'pre-reading-diagnostic'` if write exists; if not, skip until Phase 14. |

### 3.4 New service: `AttributionService`

Lives at `src/main/utils/AttributionService.js`. Single-responsibility aggregator. Owned by main process; queried via IPC.

```js
class AttributionService {
  /**
   * Bars for the chart, given a lens and time window.
   * @param {object} opts
   * @param {'attention'|'phase'|'intent'} opts.lens - which grouping
   * @param {number} opts.from - epoch ms inclusive
   * @param {number} opts.to - epoch ms exclusive
   * @param {number} opts.userId
   * @returns {Promise<AttributionBar[]>}
   *   where AttributionBar = {
   *     groupKey: string,            // feature_surface, phase, or intent label
   *     groupLabel: string,          // display name
   *     eventCount: number,          // mastery_events in this group
   *     totalCostUsd: number,        // direct (sum of proximate_call cost) + amortized
   *     costPerEvent: number,        // totalCostUsd / eventCount
   *     directlyAttributedCount: number,  // events with proximate_call_id
   *     amortizedCount: number,      // events without
   *   }
   */
  async getBars({ lens, from, to, userId }) { /* … */ }

  /**
   * Recent events for a specific group, with their proximate calls (if any).
   */
  async getGroupDetail({ lens, groupKey, from, to, userId, limit = 50 }) { /* … */ }

  /**
   * Density strip data: mastery_event count per day across the user's full history.
   * Used by the brushable timeline at the top of the panel.
   */
  async getDensityStrip({ userId }) { /* … */ }
}
```

The amortization arithmetic for groups containing events with no `proximate_call_id`:

```
amortizedCostForGroup =
  sum_over_intents_in_group(
    intent_total_spend_in_window
    × (group_amortized_event_count_for_intent / intent_total_event_count_in_window)
  )
```

The amortization fraction is "share of this intent's mastery moves that came from this group" — preserves $/move sanity when one intent spans multiple groups (rare but possible after Phase 14 reclassifications).

### 3.5 IPC surface

New handlers, registered in `main.ts` alongside Phase 11 visibility handlers:

```js
ipcMain.handle('attribution:bars', (_e, opts) => attributionService.getBars(opts));
ipcMain.handle('attribution:groupDetail', (_e, opts) => attributionService.getGroupDetail(opts));
ipcMain.handle('attribution:densityStrip', (_e, opts) => attributionService.getDensityStrip(opts));
```

Renderer client: `src/renderer/api/attributionApi.js` — same pattern as existing `brainVisibilityApi.js` (uses `window.electron.ipcRenderer`).

### 3.6 Renderer components

```
src/renderer/views/brainVisibility/
  spendReturns/                         # new directory
    SpendReturnsPanel.jsx               # renamed/restructured EconomicsPanel
    tabs/
      ROITab.jsx                        # the new Attribution view
      SpendTab.jsx                      # merged By-Intent + By-Provider (refactored)
      SessionsTab.jsx                   # existing By-Session, untouched
    components/
      AttributionBarChart.jsx           # the bars
      BrushableDensityStrip.jsx         # top timeline
      LensToggle.jsx                    # L3 ↔ L2 ↔ L1
      GroupDetailDrawer.jsx             # side-panel slide-in
      AmortizedBadge.jsx                # marker for amortized rows
```

Existing `EconomicsPanel.jsx` is renamed to `SpendReturnsPanel.jsx` and its internals reorganize. The export name stays `EconomicsPanel` for one release to avoid breaking imports (then renamed in a follow-up).

### 3.7 RationaleCard reuse

Existing `RationaleCard` component (Phase 9) takes a `callId` and renders the call's full BrainContext slice + intent + structured output. `GroupDetailDrawer` event rows with `proximate_call_id` link directly via this — no new modal component for the call-detail view.

### 3.8 L3 attention-state mapping

Static map in `masteryEventEnums.js`:

```js
const ATTENTION_STATE = {
  'reading-microcard': 'while-reading',
  'pre-reading-diagnostic': 'while-reading',
  'director-session': 'focused-session',
  'comprehension': 'focused-session',
  'production-prompt': 'focused-session',
  'manual-review': 'focused-session',
  'backfill': 'historical',
  'unknown': 'historical',
};
```

Three L3 buckets: `while-reading`, `focused-session`, `historical`. `manual-review` lands in `focused-session` because the user *is* focused when reviewing Leitner cards (even though no LLM is involved). `backfill` and `unknown` collapse to `historical` to keep the "Untracked" bucket name internally consistent.

---

## 4. UX walkthrough

1. User opens **Brain Dashboard** → clicks **Spend & Returns** tab.
2. Panel mounts with **ROI** tab selected (default).
3. Top: **density strip** showing mastery_events per day across full history. Default brush selection: trailing 30 days.
4. Below: **bar chart** with 3 bars (one per L3 attention-state group), sorted by `$/move` ascending (most efficient first). Bars show: group name, event count, total cost, **$/move headline**.
5. Top-right of chart: **lens toggle** — `Attention | Phase | Intent`. Switching to `Phase` re-renders bars by L2 grouping (~5 bars). Switching to `Intent` shows L1 directly (~12 bars).
6. User clicks "Focused-session" bar. Bar expands in-place; **L1 sub-bars** (per-intent: `director-session-step`, `grade-comprehension`, `production-grade`, etc.) animate in beneath it.
7. User clicks `grade-comprehension` sub-bar. **Side-panel** slides in from the right showing: surface aggregate stats, list of recent mastery_events with concept name, timestamp, $/this-event, and (where available) a link to the proximate call's `RationaleCard`.
8. User clicks one event → `RationaleCard` opens (existing Phase 9 component) showing what the LLM saw and produced.
9. User brushes density strip to a wider window (e.g. 90 days) → chart recomputes. Untracked bucket grows as the window pushes into pre-Phase-12 territory.

---

## 5. Success criteria

Phase 13 ships when:

- [ ] Every existing `mastery_event` write path sets `feature_surface` to a closed-enum value (not `'unknown'`).
- [ ] Existing rows are backfilled: `source='backfill'` rows have `feature_surface='backfill'` after migration; other historical rows have `feature_surface` derived from `source` where deterministic, else `'unknown'`.
- [ ] All Director session Leitner ratings produce `mastery_event` rows with both `proximate_call_id` AND `feature_surface='director-session'`.
- [ ] Comprehension grading produces `mastery_event` rows (new — didn't before).
- [ ] Micro-card accept produces `mastery_event` rows (new — didn't before).
- [ ] `AttributionService.getBars({lens:'attention', from, to, userId:1})` returns the 3 expected L3 groups with correct counts and $/move.
- [ ] Lens toggle (Attention/Phase/Intent) re-aggregates without re-fetching (or with a cache).
- [ ] Bar drill-down shows L1 sub-bars; sub-bar drill-down opens `GroupDetailDrawer`.
- [ ] `GroupDetailDrawer` rows with `proximate_call_id` link to `RationaleCard`.
- [ ] `GroupDetailDrawer` rows without `proximate_call_id` show `AmortizedBadge` instead of a call link.
- [ ] Density strip is brushable and updates bars on selection change.
- [ ] Brushed window state persists across reloads (URL or localStorage).
- [ ] Backfill events appear as "Untracked (historical)" bar with $0 cost and tooltip.
- [ ] No regression in any existing surface (Visibility tab, Trajectory strip, Economics By-Session tab).
- [ ] Smoke test passes (`npm run test:smoke`).
- [ ] Integration test: synthetic user does a Director session → mastery_event written with both attribution columns → AttributionService.getBars returns it correctly attributed.

---

## 6. Out of scope / follow-up

- **Predictive recommendations** (Phase 14). Uses attribution trend data to suggest "you've been most efficient learning vocab via micro-cards — try the queue."
- **Anomaly detection** (Phase 14+). Flags intent cost spikes or efficiency drops.
- **Multi-user comparison** — no users to compare yet.
- **Pre-reading diagnostic mastery_event writes** — only if `BookDiagnosticService` actually moves mastery directly (verify in plan task 1).
- **Migration of historical `source` values to richer `feature_surface` values** for non-backfill rows (e.g. `'user-review'` → `'manual-review'`). Could be done via a separate one-shot migration script in plan task 2; if too risky, leave as `'unknown'` and reclassify only forward.

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Forward instrumentation regresses an existing service | Each instrumentation change is its own plan task with a TDD-shaped failing test for both *the mastery_event write* and *the existing behavior the service used to do*. |
| Amortization arithmetic produces counterintuitive $/move numbers when an intent's events split across groups | Plan task includes a sanity test with hand-computed expected values. If results are surprising, document the formula in a tooltip on the bar. |
| `ALTER TABLE` on a populated `mastery_event` table on Windows triggers a long lock | Backfill currently caps at ~10K rows; SQLite handles this in <100ms. Smoke-test the migration on a dev DB before shipping. |
| `unknown` becomes a silent bucket that swallows new write paths | CI lint: grep for `MasteryEventStore.record(` calls and fail if any lack a `featureSurface` field. |
| Brushable timeline UX is unfamiliar to user | Add a small "?" tooltip explaining the brush interaction. If usability test (= the user trying it) finds it confusing, fall back to preset toggles in a Phase 13.1 follow-up. |

---

## 8. Estimated scope

| Plan section | Tasks | Notes |
|--------------|-------|-------|
| Schema + enum + migration | 2 | Contract task + migration script |
| AttributionService (with tests) | 3 | getBars, getGroupDetail, getDensityStrip |
| Forward instrumentation | 5 | Director, comprehension, microcard, production, user-review, backfill (collapsed into ~5 tasks since several share patterns) |
| IPC handlers + renderer client | 1 | Pattern-matches Phase 11/12 |
| Renderer components | 6 | SpendReturnsPanel restructure, ROITab, AttributionBarChart, BrushableDensityStrip, LensToggle, GroupDetailDrawer + AmortizedBadge |
| Integration test | 1 | End-to-end: Director session → bars correctly attribute |
| Total | ~18 tasks | Single plan, no need to split |
