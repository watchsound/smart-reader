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
