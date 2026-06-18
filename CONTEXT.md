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
