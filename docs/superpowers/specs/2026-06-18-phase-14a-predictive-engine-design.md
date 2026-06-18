# Phase 14a — Predictive Engine

**Status:** Draft — awaiting user review before plan
**Date:** 2026-06-18
**Predecessor:** Phase 13 (Attribution Layer) — joined `mastery_event` to `brain_call_ledger` via `proximate_call_id` + `feature_surface`
**Successor:** Phase 14b (ROI-ranked Proposal Queue), 14c (Concept ETA sparkline), 14d (Budget Session Planner), 14e (Quest Pacing Forecaster). 14f folds into 14d.

---

## 1. Premise

Phase 13 surfaces **what each LLM-driven mastery move cost in the past**. Phase 14 asks the next question: **what will the next move yield, and what will it cost?**

This is the load-bearing foundation for five consumer features (14b–14f). All five need the same function:

```
predict({ feature_surface, current_box, domain }) → {
  expectedMasteryDelta, deltaStd, pBoxUp, expectedCost, p95Cost, n
}
```

14a builds that function, the calibration evidence that proves it's working, and nothing else. No user-visible surface beyond the calibration report card.

---

## 2. Decisions locked from brainstorm

| # | Decision | Choice | Rejected alternatives |
|---|----------|--------|-----------------------|
| 1 | Phase 14 direction | A — Predictive | B (self-tuning), C (anomaly), D (no new loop), E (other) |
| 2 | Decomposition | 14a (engine) → (14b, 14c) → 14d → 14e; 14f folded into 14d | Single monolithic Phase 14; surface-first |
| 3 | Model class | **Empirical Bayes (Beta-Binomial + Normal-Inverse-Gamma)** with hierarchical shrinkage | Frequentist averages (under-fits sparse cells), Bayesian hierarchical full (over-engineered), GBM (overkill at our data scale, opaque) |
| 4 | Prediction target | **Both** — continuous `expectedMasteryDelta` (NIG) + Bernoulli `pBoxUp` (Beta-Binomial), returned jointly | Continuous only (loses legible "X% chance" headline), Bernoulli only (undersells production-grade events that move mastery without crossing a box boundary) |
| 5 | State vector | **(feature_surface, current_box, domain)** — ~240 cells; hierarchy: cell → (surface, box) → (surface) → global | (surface, box) coarse (under-fits domain), (+recency) sparse early, per-user (n=1 user, YAGNI) |
| 6 | Cost prediction | **Separate** — mean + p95 cost per `feature_surface` from `brain_call_ledger` over rolling 30d window | Joined into EB hierarchy (cost variance dominated by provider/intent, not box/domain) |
| 7 | API shape | **Both** — `predict()` + `rankCandidates()` | predict-only (consumers re-implement ranking), rank-only (loses per-cell debug) |
| 8 | Refresh cadence | **Nightly heartbeat recompute, cache file, on-demand if cache > 24h** | On-read (slow, ~few-second SQL each call), incremental (premature), preset toggles (arbitrary) |
| 9 | Calibration | **Three numbers + reliability diagram in a "Predictions" tab of `BrainDashboardPanel`** | None (engine becomes a black box), full ML eval framework (over-engineered) |
| 10 | File layout | `src/main/brain/predictive/PredictiveEngine.js` + `calibrationReport.js` + IPC + `predictiveApi.js` + UI tab | Inline in `LearningBrainAgent` (pollutes), new top-level route (discoverability) |

---

## 3. Architecture

### 3.1 No schema changes

14a reads `mastery_event` and `brain_call_ledger` only. No new tables, no migrations. The model state is cached in a single JSON file at `<userData>/predictive_model.json` — not a SQL table, because it's regenerated wholesale on each refresh and never queried by id.

If cache file is missing or corrupted, engine recomputes on next call. Failure is recoverable.

### 3.2 The math (concise)

For each cell `c = (surface, box, domain)`:

**Continuous Δmastery (NIG conjugate):**

Observed events in window: `{Δm_1, ..., Δm_n}`. Posterior mean:

```
μ_c = (κ₀·μ₀ + n·m̄_c) / (κ₀ + n)
```

where `(μ₀, κ₀)` is the parent cell's posterior (one level up the hierarchy: `(surface, box)`, then `(surface)`, then global). `κ₀ = 4` (effective prior sample size). `m̄_c` is the sample mean.

Posterior variance (predictive) ~ `σ²_c · (1 + 1/(κ₀+n))`, where `σ²_c` shrinks similarly.

**Bernoulli `pBoxUp` (Beta-Binomial conjugate):**

Observed: `s_c` box-up events out of `n_c`. Parent posterior `(α₀, β₀)`. Posterior mean:

```
p_c = (α₀ + s_c) / (α₀ + β₀ + n_c)
```

`α₀ = 2, β₀ = 2` at the global root (uniform-ish), then propagated down.

**Cost (no hierarchy):**

```
E[cost | surface] = mean(brain_call_ledger.cost_usd) over last 30d
                    where feature_surface attribution matches
p95[cost | surface] = p95 of same
```

Direct surfaces (Director, Comprehension, Production-Grade): use `proximate_call_id` join. Amortized surfaces (MicroCard, Pre-reading): use Phase 13's amortized-cost arithmetic.

**Confidence:** report `n` directly. Consumers display "based on 47 events" or fall back to parent if `n < 10`.

### 3.3 API

```js
// src/main/brain/predictive/PredictiveEngine.js
class PredictiveEngine {
  async predict({ featureSurface, currentBox, domain }) {
    // Returns:
    // {
    //   expectedMasteryDelta: number,    // posterior mean
    //   deltaStd: number,                // posterior std
    //   pBoxUp: number,                  // posterior mean of Bernoulli
    //   expectedCost: number,            // USD
    //   p95Cost: number,                 // USD
    //   n: number,                       // events in the cell
    //   shrinkageLevel: 'cell'|'surface-box'|'surface'|'global',
    //   computedAt: number,              // ms
    // }
  }

  async rankCandidates(candidates /* Array<{ featureSurface, currentBox, domain, ref }> */) {
    // Returns candidates sorted by ROI = expectedMasteryDelta / max(expectedCost, ε),
    // descending. Each entry: { ...candidate, prediction, roi }.
  }

  async refreshModel({ force = false }) {
    // Recomputes model state. Writes to predictive_model.json.
    // Called by heartbeat once/24h or on-demand if cache stale.
  }

  async calibrationReport({ windowDays = 30 }) {
    // Returns:
    // {
    //   reliability: Array<{ bin, predictedDelta, realizedDelta, n }>,
    //   brierScore: number,           // for pBoxUp predictions
    //   coverage: number,             // % recent events with n >= 10 in cell
    //   asOf: number,
    // }
  }
}
```

### 3.4 IPC

| Channel | Handler | Used by |
|---|---|---|
| `predictive:predict` | `engine.predict(args)` | 14c (concept sparkline), 14d (planner), 14e (quest pace) |
| `predictive:rank` | `engine.rankCandidates(candidates)` | 14b (queue re-rank) |
| `predictive:refresh` | `engine.refreshModel({ force })` | Calibration tab "recompute" button |
| `predictive:report` | `engine.calibrationReport({})` | Calibration tab |

Renderer client: `src/renderer/api/predictiveApi.js` mirrors these.

### 3.5 Refresh cadence

`LearningBrainAgent.runHeartbeat` adds a step (after Phase 13 prune):

```js
if (Date.now() - this.lastPredictiveRefresh > 24 * 3600 * 1000) {
  await predictiveEngine.refreshModel({ force: false });
  this.lastPredictiveRefresh = Date.now();
}
```

On-demand: `predict()` checks `computedAt` of cache; if > 24h, refreshes inline before returning. Refresh is bounded to one pass over `mastery_event` + `brain_call_ledger` in the rolling window — measured budget ≤ 3 seconds at 10K-row ledger size.

### 3.6 Calibration report card UI

New tab in `BrainDashboardPanel`: **"Predictions"** (sits next to "Spend & Returns").

Renders three KPI tiles + one reliability diagram:

- **Predicted Δ-mastery vs realized (reliability)** — bin top-10% predictions by predicted delta; plot per-bin predicted vs actual mean as paired bars. SVG, no chart lib. Goal: bars within ±1 mastery point per bin.
- **Brier score** — single number for `pBoxUp`. Goal: ≤ 0.20.
- **Coverage** — % of recent mastery_events where the cell had n ≥ 10. Goal: ≥ 60% after 30d of data.

Stale-cache banner if `computedAt > 24h`. "Recompute now" button calls `predictive:refresh`.

### 3.7 File layout

```
src/main/brain/predictive/
  PredictiveEngine.js          # engine + DAO + refreshModel
  calibrationReport.js         # the report-card computation
  predictiveEnums.js           # shrinkage-level enum, constants (κ₀, α₀, β₀)
src/main/ipc/
  predictiveHandlers.js        # IPC bindings
src/renderer/api/
  predictiveApi.js             # IPC client
src/renderer/components/brainShell/predictions/
  PredictionsTab.jsx           # the calibration report card tab
  ReliabilityDiagram.jsx       # SVG reliability bars
src/__tests__/brain/
  PredictiveEngine.test.js
  calibrationReport.test.js
src/__tests__/ipc/
  predictiveHandlers.test.js
src/__tests__/integration/
  predictive-engine.integration.test.js   # seed events+ledger, refresh, predict, assert
```

---

## 4. Success criteria

**Unit tests:**

- `predict()` returns proper shrinkage for empty cell (falls back to parent).
- `predict()` for a dense cell (n ≥ 30) returns sample-mean within 0.5 of unshrunk.
- `pBoxUp` for an all-success cell → very close to 1; all-fail cell → very close to 0. Empty cell → ≈ 0.5 from prior.
- `rankCandidates()` sorts by ROI descending; ties broken by `expectedMasteryDelta`.
- `refreshModel({ force: true })` writes cache file; subsequent `predict()` reads from cache.
- `calibrationReport()` bins predictions correctly; Brier in [0, 1]; coverage in [0, 1].

**Integration test:**

Seed `mastery_event` with 200 synthetic events across 3 surfaces × 5 boxes × 4 domains + matching `brain_call_ledger` rows. Run `refreshModel`, then `predict` for cells with n=0, n=5, n=30 — assert shrinkage progression. Then `calibrationReport` — assert coverage ≥ 50%.

**Calibration gates (post-launch):**

- Reliability bars within ±1 mastery point per bin on 30d-old data.
- Brier score ≤ 0.20 on the same window.
- Coverage ≥ 60% by 30d after launch (gives 14b–f the green light).

If these gates miss after 30d, downgrade to Decision 3 fallback (frequentist averages) before building 14b.

**Smoke:**

`npm run test:smoke` boots Electron; predictive heartbeat refresh runs once without crash log; cache file appears.

**No regressions:**

All Phase 9–13 tests pass. No new dependencies added to `package.json`.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| EB math wrong / over-shrinks; consumers see flat predictions | Calibration report card surfaces this immediately (reliability bars all same value). Add a "shrinkage level" field per prediction so 14b–f can downweight high-shrinkage outputs in their own UI. |
| Cache file corruption | On parse error, log + delete + recompute. Engine treats missing cache as "recompute on next call." |
| Refresh takes too long at scale (>3s) | Profile during dev with seed data; if >3s, switch to incremental refresh (update only cells touched since `computedAt`) — cleanly retrofittable. |
| `feature_surface='unknown'` swamps the dataset | Already filtered out by Phase 13's lint guard. `predict()` rejects `surface='unknown'` and `'backfill'` inputs explicitly. |
| Cost prediction is wrong because provider mix shifted | Rolling 30d window naturally adapts. Calibration covers cost too: add cost-reliability tile in v2 if drift shows up. |
| Engine called before any data exists (new install) | `predict()` returns global prior + `n=0` + `shrinkageLevel='global'`. Consumers (14b–f) check `n` and degrade gracefully. |

---

## 6. Out of scope

- Per-user shrinkage (n=1 user; revisit when multi-user lands).
- Recency / time-since-last-review state dimension (revisit if calibration shows gap).
- ML regressor (GBM/NN) — not justified at our data scale.
- Anomaly detection (Phase 14 direction C, deferred indefinitely).
- Self-tuning per-intent cost ceilings (Phase 14 direction B, deferred indefinitely).
- All five consumer surfaces (14b–14f) — they are their own specs.
- Real-time cache invalidation on new events — nightly is sufficient.

---

## 7. Open questions

None. All Q1–Q8 decisions locked above.
