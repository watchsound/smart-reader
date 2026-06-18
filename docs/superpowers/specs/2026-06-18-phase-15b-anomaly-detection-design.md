# Phase 15b — Anomaly / Regression Detection

**Status:** Shipped — retroactive spec for the design record
**Date:** 2026-06-18
**Direction:** C (Anomaly/regression detection, of the four Phase-15 candidates)
**Predecessor:** Phase 12 (mastery trajectory), Phase 13 (attribution), Phase 15a-1 (per-attempt ledger error column)
**Successor:** none planned

---

## 1. Premise

The first user-visible "save them from silent breakage" surface. After 9 phases of building learning-loop infrastructure, several silent failure modes exist:
- Concepts regressing without anyone noticing
- LLM spend producing no mastery moves
- Provider error spikes degrading the engine
- Concepts inside an active Quest going stale

15b adds a Health tab that scans, persists, and surfaces these. Threshold-based, not statistical — the dataset is too small for confident σ-bounds.

---

## 2. Decisions locked

| # | Decision | Choice |
|---|----------|--------|
| 1 | v1 anomaly classes | Four: `mastery-regression`, `zero-roi-spend`, `provider-error-spike`, `stalled-quest-concept`. Deferred: cell ROI collapse (needs longer baseline), backfill leakage (lint guard already catches), generic Quest pace (14e covers). |
| 2 | Detection model | Threshold-based + comparison. Pure SQL per kind; thresholds in `predictiveEnums.ANOMALY` for single-edit tuning. |
| 3 | Frequency | On-demand "Re-scan" button + nightly heartbeat scan throttled once / 24h via `_lastAnomalyScanTs`. Persisted, so Health tab loads instantly. |
| 4 | Surface placement | New "Health" tab in `BrainDashboardPanel`, between Plan and Visibility. |
| 5 | Per-anomaly actions | `mastery-regression`/`stalled-quest-concept` → Inspect (navigates `/?inspect=<lpId>`). `zero-roi-spend`/`provider-error-spike` → View ROI / View latency (navigates `/?tab=economics`). All → Acknowledge (mutes for 7d). |
| 6 | Schema | Single `brain_anomaly` table — `(id, kind, key, severity, evidence_json, since_ts, last_seen_ts, acknowledged_at)`. UNIQUE `(kind, key)`. |

---

## 3. Detector definitions

| Kind | Condition | Key | Severity |
|------|-----------|-----|----------|
| `mastery-regression` | `(max - latest) ≥ 10` in last 7d | lpId | `high` if drop ≥ 20 else `medium` |
| `zero-roi-spend` | Intent's total cost ≥ $0.05 AND `attributedEventCount = 0` in 7d | intent | `high` if cost ≥ $0.20 else `medium` |
| `provider-error-spike` | `errorCalls/totalCalls > 20%` AND `totalCalls ≥ 5` in 24h | provider | `high` if rate ≥ 50% else `medium` |
| `stalled-quest-concept` | In active Quest scope, lp mastery < 80, no `mastery_event` in 14d (or never) | `<questId>:<lpId>` | `medium` |

All thresholds in `predictiveEnums.ANOMALY` constants.

---

## 4. Architecture

```
src/main/utils/BrainAnomalyDetector.js            ← detectors + persister
src/main/ipc/anomalyHandlers.js                   ← anomaly:list/rescan/acknowledge
src/main/main.ts                                  ← anomalyHandlers.register()
src/main/brain/LearningBrainAgent.js              ← heartbeat hook (24h-throttled)
src/main/brain/predictive/predictiveEnums.js      ← ANOMALY thresholds
src/renderer/api/anomalyApi.js                    ← IPC client
src/renderer/components/brainShell/health/HealthTab.jsx  ← UI
src/renderer/components/brainShell/BrainDashboardPanel.jsx  ← tab slot + ?tab= deep link
db.sql                                            ← brain_anomaly table + indexes
```

**Detector module shape:**

- Pure classifiers (testable without DB): `classifyMasteryRegression`, `classifyZeroRoi`, `classifyProviderErrorSpike`, `classifyStalled`
- Collectors (DB queries): `detectMasteryRegression`, `detectZeroRoiSpend`, `detectProviderErrorSpike`, `detectStalledQuestConcepts(store)`
- `runDetectors({ store })` → flat list of anomalies
- `persistAnomalies(anomalies)` → idempotent upsert via UNIQUE `(kind, key)`. Stale rows (no longer triggered) drop EXCEPT those acknowledged within `ACK_TTL_DAYS = 7`. Returns `{ upserted, removed }`.
- `listAnomalies({ includeAcknowledged })` reads the table; filters out muted instances inside the silence window.
- `acknowledgeAnomaly(id)` sets `acknowledged_at = Date.now()`.
- `runAndPersist({ store })` orchestrates detect+persist for the heartbeat + on-demand rescan.

---

## 5. Persistence semantics

- **Upsert** preserves `acknowledged_at` on existing rows (don't un-mute on re-detect).
- **Stale row** = persisted instance no longer in the latest scan result AND `acknowledged_at` is null or older than 7d → DROP.
- **Tombstone window:** acknowledged within 7d AND still triggering → keep silent. Acknowledged within 7d AND no longer triggering → keep (acts as a soft tombstone so we don't ping-pong).

---

## 6. Success criteria

- 16/16 pure classifier unit tests + 4954/4954 full unit suite + 222/222 integration + smoke green.
- Pre-commit grep verification of all intended files (per `feedback_verify_writes_before_commit` memory).
- Manual: open Health tab — empty state ("All systems normal") if no anomalies; Re-scan button works; action buttons land on the right URL+tab.

---

## 7. Risks / out of scope

| Risk | Mitigation |
|---|---|
| Threshold tuning is hand-picked | All in `predictiveEnums.ANOMALY`; observe user data, adjust in one place. |
| Heartbeat scan slows boot | Throttled to once / 24h via `_lastAnomalyScanTs`. |
| Anomaly noise after data ramp-up | Acknowledge action mutes 7d; bulk-acknowledge could come in 15c if needed. |
| Action button URL drift | `?tab=` deep linking added to `BrainDashboardPanel` in fix commit `b74cbf0` after initial wire used non-existent route shape. |

Out of scope: bulk-acknowledge UI; user-defined thresholds; webhook/notification surfaces; recurrence detection within the silence window.
