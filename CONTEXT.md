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

## Note UI (2026-06-22 Editorial Premium upgrade)

- **Editorial Premium** — the v1 visual language for the Note card, shipped 2026-06-22. Replaces MUI's default Card chrome. Defining traits: 14px rounded soft-elevation surface with hairline border, **accent stripe** (4px solid left edge in the note's color) + 30%-width gradient fade, serif highlight quote as the visual hero, monospace meta caption, hover lift (3px translateY + shadow deepen), entry stagger via CSS keyframes. *Not "premium theme", not "card v2".*
- **NoteCardSurface** — the React component that owns Editorial Premium chrome. Wraps the inner `CardHeader / CardContent / CardActions` of `NoteUI`. Replaces the prior `StyledCard`. Accepts `accentColor` + optional `entryDelay` for staggered list entry. Used in all `NoteUI` render paths except inline-edit mode (which keeps the legacy `StyledCard` to avoid editor conflicts).
- **Accent stripe** — the 4px solid left edge bar + fading gradient overlay that gives each Note its color signature on the new card. Replaces the prior flat `backgroundColor: note.color` fill, which washed out text. *Not "color bar", not "left border".*

## Learn About (2026-06-23 embedded presentation)

- **Embedded Presentation** — the live scaled-down Impress.js card embedded in a Learn About message feed. Shows slide 1 with its entrance animation; the iframe has `pointer-events: none` and a transparent click shield expands to the full-screen `ImpressModal`. Stored as `message.type = 'presentation'` with slide-data JSON (not pre-rendered HTML). *Not "Impress card", not "slide thumbnail".*
- **buildImpressHTML** — the HTML-building half of the existing `generateImpressHTML`, extracted so render-time components (`EmbeddedPresentationCard`) can produce the impress.js HTML without re-invoking the AI. Takes pre-resolved slide data + deck metadata, returns the HTML string.

## Note creation (2026-06-21 inline-note design)

- **Quick Note** — inline note created from `CreateAnnotationPanel` via the expand-in-place flow. Saves a Note record alongside the highlight annotation without opening `CreateNoteModal`. Carries only the typed text — no title, tags, image, or summary. *Not "Inline Note", not "Quick Capture".*
- **Full Note** — note created via the existing `CreateNoteModal` (the `CreateNotePanel` form). Has title / tags / image / summary fields. Reachable from `CreateAnnotationPanel` via the "Open full editor →" link when the panel is in expanded state.

## Study Forum (2026-06-27 design)

- **Study Forum** — the simulated multi-persona discussion feature. *Not "community discussion", not "AI forum"*; the word **community** stays reserved for the legacy remote-server path so they aren't conflated.
- **Forum Discussion** — one persisted multi-turn conversation anchored to a Forum Anchor. Owns the turns blob, anchor reference, seed cost, and metadata.
- **Forum Anchor** — `{ bookId, chapterId, cfiRange | null, pageTextHash, selectionText | null }`. Stable key for "where in the book this discussion is about." `cfiRange` is null when the discussion was opened on the whole page; `pageTextHash` covers that case.
- **Persona** — one of the four fixed cast members: **Moderator (Mira)**, **Skeptic (Sam)**, **Synthesizer (Sora)**, **Curious Novice (Noa)**. Defined in `src/commons/model/forumPersonas.js`. *Not "character", not "agent".*
- **Forum Turn** — one persona or user utterance: `{ persona, content, ts, addressedTo?, cost_usd? }`. Lives inside a Forum Discussion's `turns_json`. Append-only.
- **Seed Generation** — initial Spine call (`intent: simulate-forum-seed`) that produces the 6-turn opening discussion.
- **Reply Generation** — every subsequent Spine call (`intent: simulate-forum-reply`) after a user turn. Returns 1-2 persona turns based on the addressed persona + topical relevance.
- **Forum Marker** — gutter chat-bubble icon shown when a chapter has existing Forum Discussions. Click jumps to that discussion in the panel.
- **`feature_surface: 'study-forum'`** — closed-enum value in `featureSurface.js`. Cost moves caused by Study Forum calls attribute to this surface in Phase 13 Spend & Returns.

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
  - **14d — Budget Session Planner** *(2026-06-18 design)* — new "Plan" tab in `BrainDashboardPanel`. User sets time budget (5/15/30/60 min) + dollar budget ($0.05/$0.10/$0.30/$1.00); backend `BudgetSessionPlanner.computePlan` collects (FSRS-due ∪ active-Quest below-mastery-80) lps, scores per applicable surface via the engine, greedy-fills by ROI until either budget exhausts. Returns ranked checklist with `+ΔM / $cost / Nmin / Start →` action mapping (`production-prompt` → ProductionPromptPanel, `director-session` → SessionRunner, `reading-microcard` → reading view). Time constants live in `predictiveEnums.TIME_PER_EVENT_SEC`. Folds in 14f (budget=1 = next-best-action).
  - **14e — Quest Pacing Forecaster** *(2026-06-18 design)* — reuses 14c per-concept projection at Quest scope. `QuestPacingService.computePacing({bookIds})` runs `getConceptProjection` over top-50 most-recently-updated lps in scope, returns max-ETA + bottleneck top-5 + `indeterminateCount`. Bottleneck reason classification: `stalled <Nd>` → `low mastery` → `sparse coverage` → `slow projection` → `in progress`. New `quest-pacing` IPC (lazy, heavier than `quest-progress`). Surfaces inline under each active Quest in `OrbQuestMenu` as `"ETA Nd · X/Y at mastery · Z bottlenecks"` with expandable bottleneck list.

## Phase 15 — Reset & Deepen + Anomaly Detection (2026-06-18 design family)

- **Provider Failover** (Phase 15a-1) — Brain Spine wrap so transient provider errors (429, 5xx, ECONNRESET, ETIMEDOUT) don't kill a `brainCall`. `executeWithFailover({chain, fn, onAttemptFailed})` orchestrator + pure `classifyError(err) → 'transient'|'failover'|'fatal'`. 1 same-provider retry with 500ms backoff for transient; then walks the chain. Per-attempt ledger rows via new `brain_call_ledger` columns `attempt_n` (default 1), `failover_reason`, `error`. New `SchemaMigrator.ensureColumn` helper for idempotent ALTERs. v1 chain length is 1; cross-provider extension waits on name-based instantiation in `AIProviderManager`. *Not "Retry" — retry is the same-provider path; failover is the cross-provider walk.*
- **Latency Tab** (Phase 15a-2) — new tab in `EconomicsPanel` between By Provider and By Session. `CallLedgerStore.latencyByIntent(sinceMs)` returns `{intent, n, mean_ms, p50_ms, p95_ms, max_ms}` per intent; percentiles computed in JS (no PERCENTILE_CONT in SQLite). Excludes cache hits and failed-attempt rows (`error IS NULL`) so retry latency doesn't pollute success picture. Sorted p95 desc — worst offenders first.
- **Director Rationale Step List** (Phase 15a-3) — `SessionSummaryView` groups existing `kind: 'thought' | 'tool' | 'observation' | 'soft-write' | 'surface' | 'error'` trace events by iteration into one step row each; renders as ordered list "Director rationale, step by step." No backend change — data was already in the trace.
- **Anomaly Detection** (Phase 15b) — new "Health" tab in `BrainDashboardPanel` between Plan and Visibility. `BrainAnomalyDetector` runs four threshold-based detectors: `mastery-regression` (drop ≥ 10 in 7d), `zero-roi-spend` (≥$0.05 in 7d, 0 attributed events), `provider-error-spike` (>20% over min 5 calls in 24h), `stalled-quest-concept` (no `mastery_event` in 14d AND mastery < 80). Pure-fn `classifyX` per kind for testability; DB-backed collectors per kind; `runAndPersist` orchestrator + idempotent upsert into `brain_anomaly` table on UNIQUE `(kind, key)`. Heartbeat scan once / 24h via `_lastAnomalyScanTs` throttle. Acknowledge mutes a specific instance for 7d via `acknowledged_at`. Action buttons deep-link via `BrainDashboardPanel`'s new `?tab=` query-param support (one-way URL → state).
- **Brain Anomaly** — single persisted record `(id, kind, key, severity, evidence_json, since_ts, last_seen_ts, acknowledged_at)`. UNIQUE `(kind, key)` so rescan is idempotent. `key` is per-kind unique identifier: lpId for mastery/stalled, intent for spend, provider for errors, `<questId>:<lpId>` for stalled-quest-concept.
- **Anomaly Severity** — `high` (rate ≥ 0.5 or drop ≥ 20 or cost ≥ $0.20), `medium` (above threshold), `low` (unused in v1). Drives card border color in HealthTab.
- **Acknowledge** — Phase 15b action: mute an anomaly instance for `ANOMALY.ACK_TTL_DAYS = 7`. Stale rows (no longer triggering) drop EXCEPT those acknowledged within the window — keeps a soft tombstone so re-trigger inside the silence doesn't surface again.

## Mindmap (2026-06-23 upgrade)

- **MindmapSurface** — the single mindmap renderer (`src/renderer/components/mindmap/MindmapSurface.tsx`). Replaces `MyMindMap`, `MindmapModal`, and the `(coming soon)` placeholder. Used by every mindmap site in the app via `mode='inline' | 'expanded' | 'card'`. *Not "MindMap", not "MindmapView"*.
- **MindNode** — the custom React node type rendered by MindmapSurface. Carries mastery shade (5-band alpha ramp on domain accent), domain icon + 4px accent stripe, collapse chevron. *Not "MindmapNode"*.
- **MindmapData** — the canonical mindmap shape (`src/commons/model/MindmapData.ts`). One shape for every mindmap site; legacy v11 ReactFlow JSON converts via `legacyToCanonical`. Stored mindmaps carry no x/y; positions recomputed by elk on every render.
- **Mastery Overlay** — node background tint reflecting `masteryLevel` (0-100), 5-band alpha ramp on the domain accent. Hydrated from `mindmap:mastery-snapshot` IPC on mount + on window focus.
- **Save Concepts Bar** — bar above the canvas implementing C-confirm. Single click converts every unsaved node into a Learning Point via `MindmapPersistenceService.saveAsLearningPoints`. Dismissal is per-mindmap.
- **mindmap_node_lp_link** — SQLite table joining `(mindmap_id, node_id) → lp_id`. Enables reopen-with-mastery-hydrated and the "Find in graph" reverse-lookup.
- **`feature_surface: 'mindmap-study'`** — closed-enum value in `featureSurface.js`. Mastery moves caused by a mindmap-originated study session attribute to this surface in Phase 13 Spend & Returns.

## Writing Practice (2026-06-29 redesign)

- **Writing Practice** — the `/writing` view, redesigned 2026-06-29 around active reconstruction. The product principle: passive copying doesn't teach language production; comparing your own re-expression to a model does. Three sequenced phases replace the prior 6-step POS cloze flow.
- **Prepare** — Phase 1. One always-mounted `<SourcePanel>` with the model paragraph; the source text persists across all phases. Locking the source unlocks Phases 2 and 3. *This phase also fixed the lose-focus-on-first-keystroke bug from the old `{!text ? input : display}` swap.*
- **Recall Ladder** — Phase 2. Same paragraph rendered with rising masking density across three rungs (Light → Medium → Hard). Each masked token is an inline-input occlusion block, typed (not just clicked) to confirm. *Not "cloze exercise" generically — the laddering is the point.*
- **Rung** — one of `light` / `medium` / `hard`. Light masks collocations + idioms only (~30% hidden); Medium adds discourse markers + key nouns (~60%); Hard keeps only sentence skeletons (~80%). All three are generated in one batched AI call.
- **Compose & Compare** — Phase 3. State A: 5W scaffold visible at top, free-write surface below, original deliberately hidden ("ⓘ Reference original" drawer for emergencies). State B: side-by-side diff (original serif, learner sans) with semantic span coloring + Expression Notes rail.
- **Expression Diff** — the AI output that drives Phase 3 State B. Spans are colored: **green** (equivalent), **amber** (weaker than original), **blue squiggle** (mechanical grammar). Amber spans on each side link via `pair_id` on hover. *Not "grammar check" — grammar is one of three kinds.*
- **Occlusion Block** — the masked-token aesthetic that replaced the prior `___` underscores. Filled background, dashed accent border-bottom, monospace `▓` placeholders sized to the hidden word's letter count.
- **Spine intent labels** — three new labels in [src/commons/utils/AIPrompts.js](src/commons/utils/AIPrompts.js): `writing-recall-ladder` (Phase 2), `writing-5w-scaffold` (Phase 3 entry), `writing-expression-diff` (Compare). Net call count per paragraph dropped from 8 → 3 vs. the legacy flow.

## Translate Page (2026-06-30 redesign)

- **Level Selector** — sidebar control on `/translate` choosing among Path A drill, Path B paragraph, Path C lookup. Persisted per-user via `customStorage.getTranslateLevel/setTranslateLevel`. *Not "mode toggle".*
- **Path A / B / C** — the three flows. **A** = short-sentence attempt + 6-bucket compare. **B** = paragraph compose-and-compare reusing Writing Practice components (`SourcePanel`, `FiveWRail`, `ExpressionDiffPanel`). **C** = quick lookup with the model-built-it breakdown (today's flow minus the `setInterval` reveal theatre, headline at top).
- **Weakness Bucket** — one of six closed-enum categories the `translate-compare` prompt labels learner spans with: `tense` / `word-order` / `article-number` / `preposition-collocation` / `connector-cohesion` / `idiom-register`. Drives chip color, Learning Point `extras.bucket`, and Phase 13 attribution. Defined in [src/renderer/views/translate/buckets.js](src/renderer/views/translate/buckets.js).
- **Scaffold Rail** — Path A's collapsible 2-button hint surface (Reveal SVO / Tense hint). Each click records into `extras.hintsUsed` on the eventual Learning Point. *Not "hint panel".*
- **Path Demotion** — Path C action: clicking *"try this step yourself →"* on a model-built-it step switches the page to Path A with the source pre-filled. (Scaffold pre-reveal mapping deferred — v1.1 polish.)
- **`feature_surface: 'translate-drill'`** — closed-enum value in [src/commons/model/featureSurface.js](src/commons/model/featureSurface.js). Mastery moves caused by Path A/B Learning Point saves attribute to this surface in Phase 13 Spend & Returns. Attention state: `focused-session`. Phase group: `production-prompts`.
- **Spine intent labels** — five new labels in [src/commons/utils/AIPrompts.js](src/commons/utils/AIPrompts.js): `translate-svo-hint`, `translate-tense-hint`, `translate-compare` (Path A), `translate-paragraph-compare` (Path B), `translate-quick` (Path C, reusing the legacy `getTranslatePrompt`). Replaces the retired single `translate-main` label.
