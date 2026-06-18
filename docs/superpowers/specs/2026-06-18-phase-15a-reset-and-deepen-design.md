# Phase 15a — Reset & Deepen

**Status:** Shipped — retroactive spec for the design record
**Date:** 2026-06-18
**Direction:** D (Reset & Deepen, of the four Phase-15 candidates)
**Predecessor:** Phase 14a–e (Predictive Engine + consumers)
**Successor:** Phase 15b (anomaly detection)

---

## 1. Premise

No new loop. Production-grade the Phase 9–14 stack at three pain points exposed by shipping the engine + four consumers:

- **15a-1 Provider failover** — engine + 4 surfaces all depend on `brainCall` returning a result. One provider error cascades through all of them.
- **15a-2 p95 latency surfacing** — `duration_ms` has been in the ledger since Phase 9 but was never aggregated. Closes a "we don't see slow paths" telemetry gap.
- **15a-3 Director per-step rationale** — `SessionRunner` records `decision.reasoning` per step into the trace as `kind: 'thought'` events; `SessionSummaryView` filtered only soft-writes, silently dropping the reasoning.

Three discrete sub-items; one direction. Doesn't ship a new user-facing feature, materially raises the stack's reliability + inspectability.

---

## 2. Sub-items shipped

### 15a-1 Provider failover

**Decisions:**

| # | Choice |
|---|--------|
| Fallback chain config | Hardcoded `DEFAULT_CHAIN = ['DeepSeek', 'Kimi', 'ChatGPT']`. User-configurable override is YAGNI for v1. |
| Errors that trigger failover | Network codes (ECONNRESET / ETIMEDOUT / ENETUNREACH / EAI_AGAIN / ECONNABORTED / EPIPE / ENOTFOUND), HTTP 5xx, HTTP 429, HTTP 503. NOT 4xx auth (401/403/404 — same problem on every provider) or schema/parse errors (polyfill already retries same prompt). |
| Retry policy | 1 same-provider retry with 500ms backoff for transient errors, then fail over to next chain entry. Caps total attempts at `1 + N providers`. |
| Cost tracking per attempt | One ledger entry per attempt. New columns `attempt_n`, `failover_reason`, `error`. Failed-attempt rows still record provider name + non-null `error` field. |
| Where it lives | `meteredCall` + `meteredCallJson` (Brain Spine layer). Provider classes stay dumb. |

**Architecture:** `src/main/brain/spine/providerFailover.js` exposes `executeWithFailover({ chain, fn, onAttemptFailed })` and pure `classifyError(err) → 'transient' | 'failover' | 'fatal'`. `meteredCall` + `meteredCallJson` wrap their provider call. v1 chain length is 1 (current provider only) because `AIProviderManager` doesn't yet expose name-based instantiation — extension point documented inline; the same-provider transient-retry path is already the highest-value production win.

**Schema:** `brain_call_ledger` gains `attempt_n` (INTEGER NOT NULL DEFAULT 1), `failover_reason` (TEXT), `error` (TEXT). Picked up via new `SchemaMigrator.ensureColumn` helper that PRAGMAs `table_info` to ALTER idempotently. Closes a gap the original `SchemaMigrator` left open.

### 15a-2 p95 latency surfacing

**Decisions:**

| # | Choice |
|---|--------|
| Aggregation site | New `CallLedgerStore.latencyByIntent(sinceMs)` returns `Array<{intent, n, mean_ms, p50_ms, p95_ms, max_ms}>`. |
| Percentile method | Sort each per-intent bucket in JS and read indices. SQLite has no native `PERCENTILE_CONT`; window-fn emulation is brittle across SQLite versions. |
| Exclusions | `cache_hit = 0` AND `duration_ms IS NOT NULL` AND `error IS NULL` — cache hits aren't real latency; failed-attempt rows from 15a-1 would pollute the success picture. |
| Surface placement | New "Latency" tab in `EconomicsPanel`, between "By Provider" and "By Session". |
| Sort order | p95 desc — worst offenders surface first. |

### 15a-3 Director per-step rationale

**Decision:** Group existing trace events by iteration into a single step row each (`thought`, `tool`, `observation`, `soft-write`, `surface`, `error` → one row). Render in `SessionSummaryView` as an ordered list under "Director rationale, step by step".

No backend changes — data was already in the trace.

---

## 3. Architecture summary

```
src/main/brain/spine/providerFailover.js      ← new
src/main/brain/spine/meteredCall.js           ← wrapped
src/main/brain/spine/meteredCallJson.js       ← wrapped
src/main/db/SchemaMigrator.js                 ← ensureColumn helper
src/main/db/CallLedgerStore.js                ← record() threads new cols; latencyByIntent()
src/main/ipc/callLedgerHandlers.js            ← callLedger:latencyByIntent
src/renderer/api/callLedgerApi.js             ← latencyByIntent
src/renderer/components/brainShell/EconomicsPanel.jsx  ← "Latency" tab
src/renderer/views/aiSession/SessionSummaryView.jsx    ← rationale step list
db.sql                                        ← attempt_n/failover_reason/error columns
```

---

## 4. Success criteria

- 21/21 providerFailover unit tests + 5/5 percentile-math tests + 4938/4938 full unit suite + 222/222 integration + smoke green.
- Two test mocks updated to include `latencyByIntent` method (Economics tests) and use `getAllByText` for symbols now appearing in both Actions list and Rationale list (SessionSummary test).

---

## 5. Out of scope / deferred

- D-item 4: calibration-driven `KAPPA_0` tuning — needs ≥30d real Brier scores.
- D-item 5: predictive model incremental invalidation on new events — 24h cache works fine; marginal payoff.
- Cross-provider chain activation — depends on `AIProviderManager` exposing name-based instantiation.
- Streaming chat retry path.
