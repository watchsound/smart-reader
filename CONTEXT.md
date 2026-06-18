# SmartReader Project Glossary

Canonical names for domain concepts. One source of truth — code, docs, and conversation should use these terms verbatim. Variants listed should be avoided.

## Core identity

- **SmartReader** — the product. AI-powered learning tool that uses reading (EPUB / PDF / Word / web) as primary input.
- **Brain** — the always-on background learning service (`LearningBrainAgent`). Runs heartbeats, holds learner state, detects triggers, proposes flows. *Not "AI", not "Assistant", not "Engine".*

## AI-driven shell (2026-06-14 design)

- **Brain Presence Orb** (Orb) — single persistent ambient indicator in the shell header. Visually reflects Brain state. Click = pull ("what should I do now?"). *Not "Avatar", not "Assistant icon", not "Brain button".*
- **Orb State** — one of `idle` / `thinking` / `has-proposal` / `mid-flow` / `uncertain`.
- **Trigger** — an event emitted by a Brain service (Phase 0–8) declaring a proposal is available. Each trigger carries a unit, surface target, priority, and TTL. *Not "Notification", not "Event", not "Suggestion".*
- **Proposal** — a queued, undelivered Trigger awaiting user engagement. Lives in the Proposal Queue.
- **Proposal Queue** — ordered list of pending Proposals, owned by the renderer-side Trigger Bus. Orb badge reflects queue depth.
- **Flow** — an accepted Proposal in execution. Has one of three units:
  - **Atomic Chip** — single inline element; accept→render→dismiss. No multi-step.
  - **Inline Sequence** — multi-step flow within the *current* view. Has progress indicator and abort.
  - **Multi-Surface Flow** — flow that auto-navigates between views. Has exit/pause; resumable from Orb.
- **Quest** — long-lived, user-declared goal (e.g., "learn German B2"). Registers as a persistent Multi-Surface Flow. Weights other Brain proposals. *Not "Goal", not "Plan", not "Path" (path is reserved for cross-book learning paths).*
- **Brain Dashboard** — new content of the `home` route. Surfaces Orb-narrated state, active Quest, Proposal Queue, recent Flow history.
- **Pull** — explicit user action invoking the Brain for a proposal (clicking the Orb). Contrast with **Push** (Brain-initiated proposal via trigger).
- **Escape Hatch** — direct user navigation to one of the 21 existing routes via the manual menu, bypassing Brain orchestration.

## Existing concepts (referenced — not redefined here)

- **Phase 0–8 Loops** — the sequenced learning loops documented in [CLAUDE.md](CLAUDE.md#brain-driven-learning-loops-phase-08).
- **Episode** — a reading-time event recorded by `EpisodeCollector` (Phase 2).
- **Learning Point** — domain-tagged extracted unit of learning (Phase 3).
- **Micro-Card** — Brain-proposed atomic learning card (Phase 4).
- **Comprehension Check** — end-of-chapter generated Q&A (Phase 6).
- **Re-read Queue** — spaced re-reading proposals (Phase 8a).
- **MoodBoard** — visual organize surface; target of Phase 8b organize loop.
- **Production Prompt** — high-mastery generative prompt (Phase 8c).

## Phase 9 — Brain Spine (2026-06-17 design)

- **Brain Spine** (Spine) — the unified LLM access layer. Single path every Brain-mediated LLM call flows through. Owns context injection, intent dispatch, telemetry recording, caching. Lives in `src/main/brain/spine/`. *Not "LLM manager", not "AI service", not "LangChain".*
- **brainCall** — primary spine entry: `brainCall(intent, input, options) → { output, callId }`. Builds the BrainContext slice for the intent, dispatches via existing `AIProviderManager` + `getStructured` polyfill, records to the Call Ledger.
- **meteredCall** — passthrough spine entry for legacy / non-Brain LLM calls. Records cost to the Call Ledger; does *not* inject BrainContext. Used during migration so all LLM spend is visible before every site adopts `brainCall`.
- **BrainContext** — canonical serializable snapshot of learner state: active Quest, current book/chapter, last-N episodes, top-N mastery, recent comprehension scores, recent accept/dismiss patterns. Built on demand, cache-keyable, sliceable by intent.
- **Intent** — declared purpose of a Brain-mediated LLM call (e.g. `extract-learning-points`, `grade-comprehension`, `propose-microcard`, `synthesize-pull-suggestion`). Resolved in the Intent Registry to `{ contextSlices, costCeilingTokens, cachePolicy, schema? }`. *Not "task", not "operation".*
- **Tool** — registered AI-invocable capability with JSON-schema declaration (e.g. `navigate`, `createMicroCard`, `markConceptMastered`). Defined in Phase 9 for forward-compat; first consumed in Phase 10 Director Mode.
- **Call Ledger** — SQLite table `brain_call_ledger` recording every spine call: intent, timestamp, provider, context-slice keys, token counts, cost USD, cache hit/miss, duration, optional triggerId, output summary. Source of truth for Rationale Card + Economics Panel. Pruned at 90 days or 10K rows (LRU).
- **Rationale Card** — expandable UI on every Proposal showing the BrainContext slice + intent + structured output that produced it. Renders from Call Ledger keyed by `trigger_id`. The primary "why this, why now" trust mechanism.
- **Economics Panel** — tab in `BrainDashboardPanel` aggregating Call Ledger: cost by intent, cost by provider, cache hit-rate, projected monthly burn. Last 7/30 day windows.
- **Director Mode** — Phase 10 (not Phase 9): AI-as-Driver mode where the AI selects intents + invokes Tools to drive a session, using BrainContext as global state. Phase 9 defines the seams (Tool registry, Intent declaration) that Phase 10 plugs into.

## Plan 2 + 3 additions (Brain shell expansion)

- **Pull Suggestion** — synthesized "what should I do now?" returned by `LearningBrainAgent.synthesizePullSuggestion` when the user pulls (clicks the Orb) and the queue is empty. Shape: `{ title, body, navigate?, source }` where `source` is `'llm'` or `'deterministic-fallback'`. Surfaced in the `BrainDashboardPanel`.
- **Quest Auto-Creation** — when a Phase 7 cross-book learning-path plan succeeds, the handler creates a `Quest` record with the goal + bookIds from the path steps, broadcasts `quest:changed`, and returns the `questId` to the renderer alongside the path summary. The user can later pause / archive it from the `OrbQuestMenu`.
- **Quest Weighting** — `ProposalQueue` sort respects an active-Quest book-ID set: proposals whose `payload.bookId` (or `step.view = "reading/<id>"`) intersects the set bubble to the top within their priority tier. Set is hydrated on `triggerBus.init()` and refreshed on `quest:changed` IPC events.
- **Phase 4/5/6 in-context exception** — Phase 4 (`microcard-propose`), Phase 5 (`PreReadingPanel`), Phase 6 (`ComprehensionPanel`) deliberately do NOT emit Triggers; their in-context surfaces are natural. The Brain Orb is reserved for chapter-end / cluster / cross-book / cross-context proposals (Phase 7, 8a/b/c) where no obvious in-context attachment exists.
- **Atomic Chip Actions** — `AtomicChipHost` reads optional `payload.actions: Array<{ label, navigate?, primary? }>` and renders them as buttons. Used by Phase 8a/b/c triggers to provide "Open" / "Try it" / "Open MoodBoard" navigation. Engagement (any action click) closes the active flow.
- **Queue Persistence** — the renderer-side `ProposalQueue` snapshots itself to electron-store on every change (`brain:trigger:queue-snapshot`) and rehydrates on `triggerBus.init()` (`brain:trigger:queue-restore`). `queue.purgeExpired()` drops items past TTL after restore.

## Phase 13 — Attribution Layer (2026-06-18 design)

- **Attribution Layer** — Phase 13 surface joining `brain_call_ledger ⋈ mastery_event` to surface cost-per-mastery-move. Implemented as the **ROI** tab of the Spend & Returns Panel (formerly Economics Panel). *Not "attribution tracking" generically; specifically the LLM-ROI lens.*
- **Feature Surface** — closed enum value identifying which product surface caused a mastery move. Stored on `mastery_event.feature_surface`. 8 values: `reading-microcard`, `director-session`, `comprehension`, `production-prompt`, `pre-reading-diagnostic`, `manual-review`, `backfill`, `unknown` (lint guard). Lives in `src/commons/model/featureSurface.js`. *Not "source" — `mastery_event.source` is the older free-text label.*
- **Proximate Call** — when a single LLM call directly produced a mastery move, its ledger row id is stored on `mastery_event.proximate_call_id`. Enables exact $-attribution for the Director / Comprehension / Production-grade paths.
- **Amortized Cost** — for surfaces where causation chains across multiple calls (e.g. micro-card extraction → propose → user-accept), per-event cost = total surface spend in window ÷ surface event count in window. Displayed with an "amortized" badge.
- **Attention State** (L3 lens) — domain-meaningful grouping of feature surfaces: `while-reading`, `focused-session`, `historical`. Default lens on the ROI tab.
- **Phase Group** (L2 lens) — feature-surface grouping aligned with project phases: `reading-loop`, `director`, `comprehension`, `production-prompts`, `diagnostics`, `manual-review`, `historical`.
- **Spend & Returns Panel** — renamed display title of the existing `EconomicsPanel`. File name and import path unchanged. ROI tab is the new default.

## Phase 14 — Predictive Engine + Consumers (2026-06-18 design family)

- **Predictive Engine** (Engine) — Phase 14a foundation. Empirical-Bayes model over `mastery_event ⋈ brain_call_ledger` returning per-cell `{ expectedMasteryDelta, deltaStd, pBoxUp, expectedCost, p95Cost, n, shrinkageLevel }`. Pure backend; no consumer surface beyond its own calibration tab. Lives in `src/main/brain/predictive/`. *Not "Predictor", not "Forecaster", not "Recommender" (those are consumer-surface names).*
- **Mastery Cell** (cell) — the prediction unit: `(feature_surface, current_box, domain)`. ~240 cells in the live taxonomy. Empirical-Bayes shrinkage hierarchy: cell → `(surface, box)` → `(surface)` → global.
- **Shrinkage Level** — discrete tag on every prediction: `'cell' | 'surface-box' | 'surface' | 'global'`. Indicates how much parent-pooling the engine had to do. Consumers use it to downweight low-confidence predictions in their UI.
- **ROI Ranking** — the `rankCandidates()` API: sort candidate `{ surface, box, domain }` triples by `expectedMasteryDelta / max(expectedCost, ε)` descending. First consumed by Phase 14b's queue re-rank. *Not "Cost-Benefit Sort", not "Priority Score".*
- **Calibration Report Card** — Phase 14a's only UI: a "Predictions" tab on `BrainDashboardPanel` showing reliability diagram (predicted vs realized Δmastery), Brier score on `pBoxUp`, and coverage (% of recent events whose cell had `n ≥ 10`). The "is the engine earning its keep" surface; mirrors how the Spend & Returns Panel proved Phase 9–13.
- **Phase 14 consumer surfaces** (forward, each its own future spec):
  - **14b — ROI-Ranked Proposal Queue** *(2026-06-18 design)* — re-weights the existing Orb queue. No new surface. Each Trigger gets a `_roi` field on insertion (computed via `predictiveApi.predict()` over a per-source surface mapping); `ProposalQueue` sort comparator picks ROI **within** priority tier and after Quest weighting. Triggers without an inferable learning_point keep ROI=null and sort by tier only. Mapping table lives in `src/renderer/brain/triggerToCell.js`. UI surface: small `+ΔM / $cost` chip on each proposal card with `n` + shrinkage in the tooltip.
  - **14c — Concept ETA Sparkline** *(2026-06-18 design)* — extends the Phase 12 sparkline with a dashed 30-day projection line and "ETA: Nd to 80" chip when threshold reached. Math lives in `src/main/brain/predictive/conceptProjection.js` and runs inside `BrainVisibilityService.getConcept` (no new IPC). Surface selection: highest-frequency per-concept (last 30d) → domain-wide → `director-session` fallback. Event rate: per-concept (last 14d) → domain-wide → capped at 5/day. Sparse-data → flat line + "insufficient data" caption.
  - **14d — Budget Session Planner** — new surface: "you have 15 min + $0.30, here's the recommended plan." Folds in 14f (next-best-action card with budget=1).
  - **14e — Quest Pacing Forecaster** — per-Quest ETA + bottleneck-concept list in `OrbQuestMenu`.
