# Phase 14e — Quest Pacing Forecaster

**Status:** Shipped — retroactive spec for the design record
**Date:** 2026-06-18
**Predecessor:** 14a (Predictive Engine), 14c (Concept ETA projection — reused per-lp)
**Successor:** none in 14 family

---

## 1. Premise

Quests (Phase 9c+ shell layer) carry a long-lived user goal scoped to a set of book IDs. After Phase 14c, every concept under a Quest can project an ETA to mastery 80. Phase 14e rolls those per-concept projections up to a Quest-level forecast: when will the Quest complete at current pace, and which concepts are dragging it?

Surfaces inline under each active Quest in `OrbQuestMenu`. Heavier than `quest-progress` (per-concept projection × N lps) so fetched lazily after the menu list arrives.

---

## 2. Decisions locked

| # | Decision | Choice |
|---|----------|--------|
| 1 | "Quest completion" criterion | All in-scope `learning_point` rows reach mastery ≥ 80. |
| 2 | ETA math | Per-lp `getConceptProjection` → Quest ETA = max(etaDays) across lps where etaDays is defined. Lps with `insufficientData` or null etaDays contribute to `indeterminateCount`. |
| 3 | Bottleneck ranking | Top-5 by (etaDays desc, mastery asc, stalledDays desc). Stalled = no `mastery_event` in last 7d. |
| 4 | Surface placement | New `QuestPacing` line under each active Quest's title in `OrbQuestMenu`. Click expands bottleneck list. |
| 5 | Performance cap | Top-50 most-recently-updated lps in scope. Surface as "estimated from top 50 active concepts" when scope exceeds. |
| 6 | Bottleneck reason classification | `stalled <Nd>` → `low mastery` (< 40) → `sparse coverage` (global/surface shrinkage) → `slow projection` (eta ≥ 25d) → `in progress` |

---

## 3. Architecture

### 3.1 Backend

`src/main/utils/QuestPacingService.js`:

```js
async function computePacing({ bookIds, engine }) {
  const lps = pickLearningPointsInScope(bookIds);
  // ...rank by updated_at, cap to TOP_N_ANALYZED=50
  const projections = await Promise.all(analyzed.map(getConceptProjection));
  // compute max ETA + indeterminateCount + bottleneck top-5
  return {
    conceptsTotal, conceptsMastered, completionFraction,
    etaDays, indeterminateCount,
    bottlenecks: [{ learningPointId, title, etaDays, currentMastery, stalledDays, reason }],
    basis: { topNAnalyzed, scopeTotal },
  };
}
```

Pure-fn `bottleneckReason({ etaDays, masteryLevel, stalledDays, shrinkageLevel })` exported separately for testability.

### 3.2 IPC

New channel `quest-pacing` (sibling of `quest-progress`). Renderer `questApi.getPacing(id)` mirrors.

### 3.3 UI

`OrbQuestMenu` calls `questApi.getPacing` for each active Quest after the list lands. `QuestPacing` component renders:
- One line: `"ETA Nd · X/Y at mastery · Z bottlenecks"`
- Click expands: per-bottleneck `title · mastery N · reason · etaDays`
- No bottlenecks → no expansion affordance

### 3.4 Defensive fields

`Array.isArray(pacing.bottlenecks)` guard, `pacing.basis?.topNAnalyzed ?? 0` optional chaining. Empty/null pacing → render nothing.

---

## 4. Success criteria

- `bottleneckReason` unit tests (6): stalled wins, low mastery, sparse coverage, slow projection, in progress, null stalledDays.
- Smoke green; renderer regression 256/256.
- Manual: open OrbQuestMenu with active Quests, pacing line renders.

---

## 5. Out of scope

- User-configurable completion criterion (mastery ≥ 80 is hardcoded).
- ETA confidence interval (uses max, not p95-of-projections).
- Real-time recompute on new events (lazy fetch on menu open only).
