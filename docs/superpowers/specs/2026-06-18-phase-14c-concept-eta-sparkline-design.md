# Phase 14c — Concept ETA Sparkline

**Status:** Draft — awaiting user review before plan
**Date:** 2026-06-18
**Predecessor:** Phase 12 (Mastery Trajectory — sparkline + `boxOverTime`), Phase 14a (Predictive Engine)
**Successor:** 14d (Budget Session Planner), 14e (Quest Pacing Forecaster)

---

## 1. Premise

Phase 12's `ConceptInspector` sparkline shows where mastery has *been*. Phase 14c extends it with a dashed projection of where mastery is *going* — and a chip with the ETA to mastery 80 when reachable inside the 30-day window.

Single surface, minimal IPC churn, mostly math.

---

## 2. Decisions locked

| # | Decision | Choice |
|---|----------|--------|
| 1 | Projection target | Both: 30-day dashed line + "ETA: N days to mastery 80" chip when threshold is reached inside the window. |
| 2 | Surface selection | Highest-frequency surface for this lp in last 30d → fallback to domain-wide highest-frequency → fallback to `director-session`. |
| 3 | Event rate | Per-concept daily rate from last 14d. Fallback to domain-wide rate if concept has <2 events. Capped at 5/day (defensive). |
| 4 | Sparse-data fallback | Flat projection at current mastery + caption "insufficient data for projection." |
| 5 | UI placement | Extend the existing Phase 12 sparkline with a dashed continuation line, ETA chip floats next to it. |

---

## 3. Architecture

### 3.1 Where the math lives — main side

Backend service: `src/main/brain/predictive/conceptProjection.js`. Pure function plus DB access for event rate. Called inside `BrainVisibilityService.getConcept` so the existing `brainVisibility:concept` IPC stays the only channel.

Shape returned alongside the existing fields:

```js
projection: {
  series: Array<{ day: number /* days from today */, mastery: number, isProjection: true }>,
  etaDays: number | null,         // days from today to reach mastery 80, or null if not reached
  basisSurface: string,           // surface used for predict() call
  basisRate: number,              // events per day used in projection
  shrinkageLevel: 'cell'|'surface-box'|'surface'|'global',
  insufficientData: boolean,      // true → render the caption fallback
}
```

### 3.2 Surface + rate selection

```js
// Step 1: pick surface
const surfaceCounts = SELECT feature_surface, COUNT(*) FROM mastery_event
  WHERE learning_point_id = ? AND ts >= now - 30d
  GROUP BY feature_surface;
let surface = topByCount(surfaceCounts);
if (!surface) {
  // Domain fallback
  const domainSurfaces = SELECT e.feature_surface, COUNT(*) FROM mastery_event e
    JOIN learning_point lp ON lp.id = e.learning_point_id
    WHERE lp.domain_type = ? AND e.ts >= now - 30d
    GROUP BY e.feature_surface;
  surface = topByCount(domainSurfaces) || 'director-session';
}

// Step 2: pick rate
const perConceptEvents = SELECT COUNT(*) FROM mastery_event
  WHERE learning_point_id = ? AND ts >= now - 14d;
let rate = perConceptEvents >= 2 ? perConceptEvents / 14 : null;
if (rate == null) {
  const domainEvents = SELECT COUNT(*) FROM mastery_event e
    JOIN learning_point lp ON lp.id = e.learning_point_id
    WHERE lp.domain_type = ? AND e.ts >= now - 14d;
  // Spread the domain-wide count across the domain's distinct concepts so
  // we don't massively over-project for niche concepts.
  const conceptCount = SELECT COUNT(DISTINCT id) FROM learning_point WHERE domain_type = ?;
  rate = (domainEvents / 14) / Math.max(1, conceptCount);
}
rate = Math.min(rate, 5); // cap defensively
```

### 3.3 Projection math

```js
const cell = { featureSurface: surface, currentBox: lp.box, domain: lp.domain_type };
const pred = await engine.predict(cell);
const dailyDelta = rate * pred.expectedMasteryDelta;
const series = [];
let m = lp.mastery_level;
let etaDays = null;
for (let d = 1; d <= 30; d++) {
  m = Math.min(100, m + dailyDelta);
  series.push({ day: d, mastery: m, isProjection: true });
  if (etaDays == null && m >= 80) etaDays = d;
}
const insufficientData = pred.n === 0 && pred.shrinkageLevel === 'global';
if (insufficientData) {
  // Flatten the series so the chart shows a horizontal line.
  series.forEach((p) => { p.mastery = lp.mastery_level; });
  etaDays = null;
}
return { series, etaDays, basisSurface: surface, basisRate: rate,
         shrinkageLevel: pred.shrinkageLevel, insufficientData };
```

### 3.4 UI changes

`src/renderer/views/brainVisibility/ConceptInspector.jsx` — extend the existing sparkline SVG render path:

- Existing path: solid stroke over `boxOverTime`
- New path: dashed stroke (`stroke-dasharray="3 3"`, lower opacity) over `projection.series`, anchored to the last solid point's coordinates.
- Caption when `insufficientData`: small italic text below sparkline.
- ETA chip when `etaDays != null`: outlined `mui` Chip, label `ETA: ${etaDays}d to 80`, tooltip with `basisSurface`, `basisRate.toFixed(2)/day`, `shrinkageLevel`.

### 3.5 IPC contract

`brainVisibility:concept` (existing) — response shape gains `projection` field. Renderer treats it as optional for backwards compat in case a stale main process is talking to a fresh renderer (the field is just missing → no chip, no dash).

### 3.6 No new tables, no new IPC, no new packages

The math reuses existing data sources. Two added DB queries per concept-inspector load — both indexed (`mastery_event(learning_point_id, ts)` exists from Phase 12). Inline cost on the existing IPC.

---

## 4. Success criteria

**Unit tests (pure-fn projection math):**

- Cell with `expectedDelta=2`, rate=1/day, mastery=30 → series[10].mastery ≈ 50, etaDays=25.
- Cell with `expectedDelta=10`, rate=0.5/day, mastery=78 → etaDays=1.
- `insufficientData` flag triggers flat series + null etaDays.
- Rate cap at 5/day enforced.

**Integration test:**

Seed two concepts with `mastery_event` history. Call `BrainVisibilityService.getConcept` for both. Assert projection.series.length === 30, basisSurface matches seeded data, etaDays present when mastery low + delta steep.

**Manual:**

Open ConceptInspector for a real concept. Sparkline shows solid line for past + dashed line going right. Chip appears when ETA <30d. Tooltip shows surface + rate + shrinkage.

**Regression:** Phase 9–14b tests pass.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Predicted ETA wildly optimistic | Cap rate at 5/day; surface `shrinkageLevel='global'` is the trust signal — tooltip exposes it. |
| Per-concept event rate noisy at low n | Domain-wide fallback already handles n<2; aggregation by `learning_point_id, domain_type` is indexed. |
| Stale predictive_model.json | Phase 14a heartbeat refresh keeps it current; if missing, `engine.predict()` triggers an inline refresh. |
| Sparkline visual clutter from dashed line + chip | Dashed lower opacity + small outlined chip. Caption only when flag triggers. |

---

## 6. Out of scope

- Per-event ETA recomputation in response to a new mastery_event (until next inspector load).
- Multi-surface "what if I switch to X?" comparison.
- Backtesting projection accuracy (calibration covers cell-level, not projection-level).
- 14d / 14e / 14f.

---

## 7. Open questions

None. All Q1–Q5 locked.
