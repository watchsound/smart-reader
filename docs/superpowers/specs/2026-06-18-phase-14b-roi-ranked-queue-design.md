# Phase 14b — ROI-Ranked Proposal Queue

**Status:** Draft — awaiting user review before plan
**Date:** 2026-06-18
**Predecessor:** Phase 14a (Predictive Engine) — provides `predict({surface, currentBox, domain})` returning `{expectedMasteryDelta, expectedCost, n, shrinkageLevel}`
**Successor:** Phase 14c (Concept ETA sparkline), 14d (Budget Session Planner), 14e (Quest Pacing Forecaster)

---

## 1. Premise

Phase 14a built the Predictive Engine but ships zero user-visible behavior beyond a calibration tab. Phase 14b is the engine's first surgical consumer: re-rank the existing Brain Orb proposal queue so high-ROI proposals (predicted mastery delta ÷ predicted cost) surface first within their priority tier.

No new surface. No new IPC. Renderer-side change only — extend `ProposalQueue` to score each Trigger on insertion, factor that score into the sort comparator, expose it on the proposal card as a subtle chip.

The product statement: **the queue you already see, ordered by what's actually worth your time.**

---

## 2. Decisions locked from brainstorm

| # | Decision | Choice |
|---|----------|--------|
| 1 | Trigger → cell mapping | Per-source map (see §3.2). Phase 8b organize + Triggers without inferable `learning_point` get ROI=null and sort by tier only. |
| 2 | Sort interaction | ROI sorts **within** priority tier, **after** Quest-weighting boost. Order: tier → Quest-boosted → ROI desc → existing tie-breaker. Never demote a high-priority item below a low-priority one. |
| 3 | When ROI is computed | **Insertion-time.** Compute once via `predictiveApi.predict()` when a Trigger enters the queue; cache on the Trigger object. Sort comparator reads the cached value. |
| 4 | Failure handling | If `predict()` throws or returns nothing → cache `roi: null` → skip ROI sort, keep priority-tier position. Engine's `n=0` global fallback (14a) covers most cases without an exception. |
| 5 | UI surface | One `$$$/move` chip on each proposal card in `OrbProposalMenu`. Hover tooltip = `n=<events>` + `<shrinkage level>`. |

---

## 3. Architecture

### 3.1 No schema changes, no IPC additions

14b is renderer-only. Reuses `predictiveApi.predict()` (14a). New module: `src/renderer/brain/triggerToCell.js` (pure function, easily testable).

### 3.2 `triggerToCell` mapping table

```js
// src/renderer/brain/triggerToCell.js
function triggerToCell(trigger) {
  // Returns { featureSurface, currentBox, domain } or null if uncomputable.
  const { source, payload = {} } = trigger;
  const lp = payload.learningPoint || payload.learningPointId
    ? payload.learningPoint || null : null;
  // ...
}
```

| Trigger source | featureSurface | currentBox source | domain source | Notes |
|---|---|---|---|---|
| `learning-path-plan` (Phase 7) | `director-session` | first lp in `payload.bookIds` lookup, fallback box 1 | first lp's `domain_type`, fallback `'knowledge'` | Phase 7 doesn't carry an lp — best-effort. |
| `reread-queue-schedule` (Phase 8a) | `pre-reading-diagnostic` | `payload.learningPoint?.box` if present, else null cell | `payload.learningPoint?.domain_type` if present | If no lp → ROI null. |
| `MoodBoardOrganizerService.suggestOrganize` (Phase 8b) | — | — | — | Organize has no per-event mastery move. ROI null. |
| `production-prompt-schedule` (Phase 8c) | `production-prompt` | `payload.learningPoint.box` | `payload.learningPoint.domain_type` | Always has lp. |
| Director-mode triggers (10b) | `director-session` | from session context if present | from session context | Future-friendly hook. |
| Unknown / unmapped | — | — | — | ROI null. |

`triggerToCell` is the single source of truth. Adding a new trigger source = adding a case here.

### 3.3 ProposalQueue insertion hook

`src/renderer/brain/triggerBus.js` (existing) — extend the push path:

```js
async function enqueue(trigger) {
  // Existing: dedup, ttl check, Quest weighting bookkeeping.
  const cell = triggerToCell(trigger);
  let prediction = null;
  if (cell) {
    try {
      prediction = await predictiveApi.predict(cell);
    } catch (_e) { /* graceful — leave prediction null */ }
  }
  trigger._roi = prediction
    ? { value: prediction.expectedMasteryDelta / Math.max(prediction.expectedCost, 1e-9),
        n: prediction.n, shrinkageLevel: prediction.shrinkageLevel,
        expectedCost: prediction.expectedCost, expectedDelta: prediction.expectedMasteryDelta }
    : null;
  queue.push(trigger);
  queue.sort(compareTriggers);
}
```

`_roi` is renderer-only state, not persisted to the queue snapshot. On rehydrate, ROI is recomputed lazily on next sort or skipped (priority-tier order preserved).

### 3.4 Sort comparator

```js
function compareTriggers(a, b) {
  // 1. Priority tier (existing).
  if (a.priority !== b.priority) return b.priority - a.priority;
  // 2. Quest weighting boost (existing).
  const aQuest = isQuestAligned(a) ? 1 : 0;
  const bQuest = isQuestAligned(b) ? 1 : 0;
  if (aQuest !== bQuest) return bQuest - aQuest;
  // 3. ROI within tier (new). null ROI sorts as 0 (neutral).
  const aRoi = a._roi ? a._roi.value : 0;
  const bRoi = b._roi ? b._roi.value : 0;
  if (aRoi !== bRoi) return bRoi - aRoi;
  // 4. Existing tie-breaker (insertion time).
  return (a.insertedAt || 0) - (b.insertedAt || 0);
}
```

### 3.5 UI

`src/renderer/components/brainShell/OrbProposalMenu.jsx` (or wherever proposals render) — add to each card:

```jsx
{trigger._roi && (
  <Tooltip title={`${trigger._roi.n} events, ${trigger._roi.shrinkageLevel} shrinkage`}>
    <Chip size="small" label={`+${trigger._roi.expectedDelta.toFixed(1)}M / $${trigger._roi.expectedCost.toFixed(4)}`} />
  </Tooltip>
)}
```

Chip is subtle (small variant, no color override). Renders only when ROI is non-null.

---

## 4. Success criteria

**Unit tests:**

- `triggerToCell` returns `null` for organize Triggers; returns correct cell for Phase 8c with lp payload.
- Insertion enriches `_roi` when cell is mappable; leaves it null otherwise.
- `compareTriggers`: high-ROI within same tier sorts above low-ROI. ROI never elevates above higher-priority tier. Quest-aligned never drops below non-aligned in same tier.
- Engine throws → ROI stays null → sort doesn't crash → priority-tier order preserved.

**Integration test:**

Seed `mastery_event` with skewed data (production-prompt has high Δmastery + low cost, reread has low Δmastery + low cost). Refresh model. Inject one Phase 8c trigger + one Phase 8a trigger at same priority. Assert: Phase 8c comes first.

**Manual:**

Boot app with Phase 14a data. Open Orb menu. Proposal cards show `+X.X M / $0.XXX` chip. Hover → tooltip with n + shrinkage. Cards order matches sort logic.

**Regression:** All Phase 9–14a tests pass.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Most Triggers map to null ROI (Phase 7/8a/8b without lp), so re-ranking does nothing visible | Phase 8c always has lp; Phase 7/8a are best-effort but degrade gracefully. Surface the `_roi=null` cases by leaving chip off — user immediately sees what's ROI-ranked vs not. |
| ROI sort surprises user ("why is X above Y?") | Tooltip exposes raw n + shrinkage; reveals when shrinkage is `global` (high uncertainty). User can interpret. |
| predictiveApi.predict latency on insertion blocks queue | `predict()` reads JSON cache; tens of ms. If perf shows up, add timeout in the try/catch and fall through to null. |
| Lp payload schema varies across trigger sources | `triggerToCell` normalizes — handles both `payload.learningPoint` (object) and `payload.learningPointId` (string + DB lookup). For string variants, DB lookup happens main-side via a new lookup API or via the renderer's existing learningPointApi. |

---

## 6. Out of scope

- Predicting ROI for Triggers without a learning_point (Phase 7 path planner with multi-book scope).
- Auto-tuning ROI weights via reinforcement learning.
- A standalone "ROI dashboard" — calibration lives in 14a's Predictions tab.
- Phase 14c–f.

---

## 7. Open questions

None. All Q1–Q5 decisions locked.
