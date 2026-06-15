# AI-Driven Shell Design — Brain as Orchestrator

**Date:** 2026-06-14
**Status:** Design, awaiting user approval
**Scope:** Layer 1 — Shell / navigation only. Layer 2 (modalities) and Layer 3 (interaction) are out of scope for this spec.

---

## Problem

SmartReader's current UI is pre-AI-era. The user navigates 21 route-based views (`RightCollapsibleLayout` everywhere) by clicking; the Brain runs a background heartbeat with Phase 0–8 learning loops. The asymmetry is the failure mode: a "learning tool" whose intelligence is invisible to the shell, surfaced only as scattered notifications (MicroCardChip, OrganizeBanner, etc.) bolted onto traditional CRUD views.

The user's complaint: *"the Brain quietly hums underneath."* The shell must give the Brain a body.

## Decisions Locked During Brainstorming

| Fork | Choice |
|------|--------|
| Layer of "AI-driven UI" to address | Shell / navigation (Layer 1) |
| Agency model | C — Brain drives sessions, user owns moments |
| Session shape | D — Reactive proposals (Quest wrapper optional) |
| Presence model | E — Presence Orb + inline chips, single Brain |
| Flow unit | D — Mixed by trigger (Atomic Chip / Inline Sequence / Multi-Surface Flow) |
| Conflict resolution | Orb queue; max one active inline; Quests pre-empt chips |
| Existing routes | Survive as escape hatches via manual menu |

## Concept

The shell becomes the Brain's body. The 21 routes are no longer destinations the user navigates *to*; they are surfaces the Brain walks the user *through* — when a trigger fires. The Brain stays quiet otherwise. The user always has the Orb (pull) and the menu (manual route override).

This is reactive, not coercive. The Brain has a face but not a whistle.

## Architecture

### 1. Brain Presence Orb

A single persistent ambient indicator, anchored in the shell header. The Orb is the Brain's visible body. It has five visual states:

| State | Meaning | Visual |
|-------|---------|--------|
| `idle` | Brain has nothing to surface | low-saturation dot |
| `thinking` | Brain is computing (heartbeat running, structured-output call in flight) | subtle pulse |
| `has-proposal` | At least one Proposal is queued | bloom + saturated color; badge if queue > 1 |
| `mid-flow` | A Flow is currently in progress | distinct ring overlay |
| `uncertain` | Multiple competing Proposals, none clearly best | flicker |

Click = **Pull**: surfaces the top queued Proposal, or — if queue empty — asks Brain to synthesize a "what's next?" suggestion. If even that yields nothing, returns "you're caught up."

Long-press / right-click: opens the Brain Dashboard.

### 2. Trigger Layer

All Brain-driven UI flows go through a single Trigger Bus in the renderer (`renderer/brain/triggerBus.js`). Each Trigger declares:

```ts
type Trigger = {
  id: string;                         // stable id (for dedup)
  source: 'phase-4-micro-card' | 'phase-5-diagnostic' | 'phase-6-comprehension' | ...;
  unit: 'atomic-chip' | 'inline-sequence' | 'multi-surface-flow';
  surfaceTarget: SurfaceSelector;     // where it renders (current paragraph, end of chapter, etc.)
  priority: 'low' | 'normal' | 'high';
  freshness: number;                  // TTL in ms; expires from queue after this
  payload: unknown;                   // unit-specific payload
};
```

Existing Phase 4–8 services emit triggers instead of rendering banners/chips directly. The Trigger Bus owns the Proposal Queue, deduplicates, and feeds the Orb.

Initial trigger catalog:

| Phase | Trigger | Unit | Surface |
|-------|---------|------|---------|
| 4 | micro-card proposal | atomic chip | current paragraph |
| 5 | pre-book diagnostic | inline panel | first-open book |
| 6 | end-of-chapter comprehension | inline sequence | end of chapter |
| 7 | cross-book quest proposal | multi-surface flow | dashboard → reader → reader |
| 8a | spaced re-read | inline sequence | reader |
| 8b | organize cluster detected | atomic banner → handoff | current view → MoodBoard |
| 8c | production prompt | atomic chip | study / reader |

### 3. Flow Unit Contracts

**Atomic Chip** — Single inline element. Accept = render result inline (e.g., the card body, the answer, the link). Dismiss = remove. No persistence beyond the moment. Existing `MicroCardChip` is the reference implementation. Visual variants include chip (inline-text-sized), banner (full-width strip), and card (boxed) — all the same Flow Unit, differing only in presentation.

**Inline Sequence** — Brain owns a panel or inline region within the *current* view for N steps. Each step is itself rendered as an atomic element. The sequence has:
- Progress indicator (`step k of n`)
- Abort button (cleanup, Brain logs incomplete)
- No auto-navigation between views

Existing `ComprehensionPanel` is the closest reference.

**Multi-Surface Flow** — Brain auto-navigates between views. The shell renders a top strip (only during the Flow) showing:
- Flow name
- Current step / total steps
- "Exit" (pauses, resumable from Orb)
- "Abort" (cancels)

Each surface in the flow is a normal SmartReader view, framed as "step N of M of [Flow name]." User state inside the view (scroll, selection, etc.) is preserved on exit.

### 4. Conflict / Queue Resolution

- **One active inline element at a time.** Chip OR Sequence OR Flow — never two simultaneously visible.
- Triggers enqueue into the Proposal Queue.
- **Quests / Multi-Surface Flows pre-empt chips:** if a chip is showing when a higher-priority Flow Trigger arrives, the chip is queued behind.
- Within the same tier: priority + freshness orders.
- Orb shows queue depth as a small badge if queue size > 1.
- Triggers older than their TTL silently expire from the queue.

### 5. Quest Wrapper (optional layer)

User can declare a goal: "learn German B2", "finish *Atomic Habits* with high comprehension". A Quest registers as a long-lived Multi-Surface Flow. While a Quest is active:
- Brain weights triggers by relevance to Quest goals (re-reads from the Quest book outrank re-reads from a one-off book).
- Orb's right-click menu surfaces Quest progress.
- Brain Dashboard shows Quest-as-progress-bar.

Quests are opt-in. Users can use the app indefinitely without declaring one — reactive triggers continue to work.

### 6. Existing Routes — Escape Hatches

- All 21 routes survive, reachable via a top-left **manual menu** ("Library / Notes / Vocabulary / Settings / ...").
- When the user navigates manually, Brain stays in `idle` unless a contextually relevant Trigger fires (e.g., opening a book still fires Phase 5 diagnostic).
- No route deletion.

### 7. New "Home" — Brain Dashboard

The current `home` route is replaced by the Brain Dashboard. Contents:
- Orb's current state, narrated in natural language ("Reading *Atomic Habits* — chapter 3 comprehension check ready")
- Active Quest progress (if any)
- Proposal Queue view (top 3, with "skip" / "do now" affordances)
- Recent Flow history (what the Brain walked the user through today)
- Manual override: link to manual route menu

### 8. Renderer-Side Architecture

```
BrainShell (top-level wrapper, replaces current App route tree shell)
├── BrainOrb (5-state ambient indicator)
├── ManualMenu (route escape hatches)
├── TriggerBus (subscribes to brainApi events; owns Proposal Queue)
├── FlowCoordinator (drives current Flow lifecycle, surface routing)
│   ├── AtomicChipHost
│   ├── InlineSequenceHost
│   └── MultiSurfaceFlowHost (renders top strip + step navigation)
└── <RouterOutlet/>  ← current view (reader, vocab, etc.)
```

### 9. Main-Process Changes

- New IPC: `brain:emitTrigger`, `brain:queueState`, `brain:pullProposal`, `brain:acceptProposal`, `brain:dismissProposal`, `brain:abortFlow`, `brain:pauseFlow`, `brain:resumeFlow`.
- New persistence: Quest state, Proposal Queue snapshot (for resume across launches), Flow history.
- `LearningBrainAgent.runHeartbeat` becomes a Trigger emitter (instead of directly persisting notifications).
- `persistBrainNotifications` retired or repurposed for audit-only logging.

## Verifiable Success Criteria

1. **Orb states render correctly across all 5 states** (visual smoke test; can be verified manually with mocked Brain state)
2. **A Phase 4 micro-card Trigger fires** → an inline Atomic Chip renders at the current paragraph; the Orb badge updates if queue > 1
3. **A Phase 6 comprehension Trigger fires** → an Inline Sequence renders with progress indicator; "abort" cleans up and logs `incomplete`
4. **A user-declared Quest** persists across app restart; Brain proposals are demonstrably weighted by Quest goal
5. **A Multi-Surface Flow** auto-navigates between views, exposes "exit" (pauses), and resumes from Orb without losing intra-view state (scroll, selection)
6. **Two Triggers fire simultaneously** (e.g., comprehension check + organize banner): queue resolves per priority, Orb badge reflects depth, no overlapping inline elements
7. **Manual route navigation** still works; Brain enters `idle` or context-relevant mode based on the surface
8. **Phase 4–8 regressions**: existing loops (MicroCardChip render, organize banner, re-read queue, production prompt, comprehension check) all still function — routed through the Trigger Bus instead of direct DOM rendering
9. **Brain Dashboard `home` route** narrates Orb state in natural language and shows queue + Quest + history

## What Stays

- All 21 view modules and their internals
- `AIProviderManager`, capability registry, polyfills (Phase 0)
- All Brain services (Phase 0–8) — they keep their backends; only their *output channel* changes (trigger emit instead of direct render/persist)
- `RightCollapsibleLayout` inside individual views
- Redux state, existing IPC handlers (additive only)
- SQLite, Kùzu, ChromaDB layers untouched

## What Changes

- New `BrainShell` top-level wrapper
- New `BrainOrb` component (5-state visual primitive — qualifies as a Layer-2 AI-native modality even though this spec is Layer 1)
- New `TriggerBus` + `ProposalQueue` in renderer
- New Flow primitive containers: `AtomicChipHost`, `InlineSequenceHost`, `MultiSurfaceFlowHost`
- Existing Phase 4–8 notification sites refactored to *emit Triggers* via Trigger Bus
- `home` route → `BrainDashboard`
- New IPC surface (`brain:*` listed above)
- New persistence: Quest state, Queue snapshot, Flow history
- `tutorContext.js` consumes Brain Orb state so the chat tutor knows what flow you're in

## Explicit Non-Goals (Out of Scope)

- Multi-agent presence (this spec assumes single Brain only)
- Touch/gesture redesign
- Voice interaction
- Replacing the internals of individual views (still CRUD-shaped inside each — Layer 1 only)
- Mobile / responsive shell
- Replacing the chat-tutor UI (Phase 1) — it composes with the Orb but isn't redesigned here
- Multi-window or multi-monitor shell layout

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Orb becomes ignorable (notification fatigue) | Strict priority + freshness TTL; queue depth visible; uncertain state flickers rather than blooms |
| Multi-Surface Flow disorients user mid-reading | "Exit" is always visible; flows resumable; auto-navigation only on explicit accept |
| Refactoring Phase 4–8 sites introduces regressions | Phase-by-phase migration with integration tests (`npm run test:integration`) gating each step |
| Queue grows unbounded if triggers fire faster than user engages | TTL expiry + max-queue-size eviction (drop lowest priority) |
| Brain Dashboard becomes a dumping ground for everything | Strict slot contract: state line, Quest, top-3 queue, today's history — no growth |
| "uncertain" Orb state's flicker reads as broken UI | Visual design pass before implementation; consider alternate signal (e.g., dual-tone bloom) if flicker tests poorly |

## Assumptions Made

- Assumed *single Brain*, not multi-agent presence. **(critical)** — entire shell model collapses if user wants multiple specialized agents.
- Assumed *reactive default*, not always-on continuous coach. **(critical)** — Quest layer is the closest this gets to always-on.
- Assumed *routes survive as escape hatches*. **(critical)** — design diverges sharply if user wants routes hidden.
- Assumed *Phase 4–8 loops are the source of truth for triggers* (no new Brain services in this spec).
- Assumed *desktop Electron only* — no mobile-shell considerations.
- Assumed *Orb is single-instance* — one per window, anchored in shell header (not floating, not draggable in v1).

## Discovered Issues

- Current `home` route is replaced wholesale; existing home-route content must be triaged for what to keep (likely move into manual menu or Brain Dashboard widgets).
- `persistBrainNotifications` in `LearningBrainAgent` may have downstream consumers (chat tutor, integration tests) that need to migrate to consuming the Trigger Bus.

## Open Questions Deferred to Implementation Plan

- Animation library / approach for Orb state transitions (animation-core integration?)
- Specific keyboard shortcut for Pull (Cmd+K? dedicated key?)
- Whether Brain Dashboard replaces `home` URL or registers as a new `/brain` route with redirect
- Migration order across Phase 4–8 sites
