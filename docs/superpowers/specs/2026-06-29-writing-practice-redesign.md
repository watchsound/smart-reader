# Writing Practice Redesign — Recall Ladder + Compose & Compare

**Date:** 2026-06-29
**Status:** Draft — awaiting review
**Affected view:** `src/renderer/views/writing/` (the "Writing Practice" page)

## Goal

Replace the 6-step POS-by-POS cloze flow ("Prepare → Noun → Verb → Prepositions → Collocations → Structure") with a **3-phase active-reconstruction loop** that matches what the feature is actually for: language learners learning *how to express ideas in a new language*, not memorizing vocabulary.

The product principle the redesign serves:
1. Active reconstruction beats passive copying.
2. Memorizing the full original is too hard; learners need **scaffolds that fade**.
3. The real learning payoff is in **comparison** between the learner's own attempt and the original — that is where expression choices get noticed.
4. Therefore: heavy scaffolding belongs **early**, free production + comparison belongs **late**. The current ordering has this backwards.

## Why now

User feedback on the current implementation:
- Order is inverted — the page asks the learner to attempt free reconstruction (the "let me try" sub-flow inside Prepare) *before* the recall scaffolds, when the scaffolds should be priming them.
- The POS gradient (Noun → Verb → Preposition → Collocation → Structure) is not a difficulty ramp — hiding nouns isn't easier than hiding verbs; they're orthogonal categories. The visual stepper implies a progression that does not exist pedagogically.
- POS-level masking misses the point of "expression" — which lives in *how words combine*, not in single words.
- A bug: typing into the Prepare textarea loses focus after the first keystroke because the `{!text ? <input> : <display>}` swap at [WritingView.js:733](src/renderer/views/writing/WritingView.js#L733) unmounts the field as soon as `text` becomes truthy. Only paste works today, and there is no way to edit the source text once committed.

## Visual language (anchors to existing system)

Aligns with the **Editorial Premium** chrome already used by `NoteCardSurface` ([CONTEXT.md:28](CONTEXT.md#L28)) — 14px rounded surfaces, hairline divider borders, 4px accent stripe, soft elevation, no MUI default `Card` chrome.

### Color

Drop the current 6-color rainbow (`STEP_COLORS` at [WritingView.js:52](src/renderer/views/writing/WritingView.js#L52)). Single accent: **teal** (`#0E8A8A` light / `#5EE0E0` dark). The three phases are distinguished by **intensity ramp on the same hue**, not different colors:

| Phase | Accent | Semantic feel |
|-------|--------|---------------|
| Prepare | teal-200 | calm — reading |
| Recall | teal-400 | active — practicing |
| Compose | teal-600 | focused — producing |

Status colors stay semantic only — green for correct, amber for "weaker than original," blue for mechanical grammar fixes.

### Typography

System fonts only (Electron offline-safe).

| Slot | Font stack | Size | Other |
|------|------------|------|-------|
| Model text (source paragraph in Prepare; original column in Compare) | `'Source Serif Pro', Georgia, serif` | 18px | line-height 1.8, max-width 680px |
| UI chrome | `system-ui, -apple-system, 'Segoe UI', sans-serif` | 14px | — |
| Meta (counts, labels, rung names) | `'JetBrains Mono', Menlo, monospace` | 12px | uppercase, 0.5px letter-spacing |
| Mask placeholder | `'JetBrains Mono', monospace` | matches body | fixed-width occlusion block |
| Free-write surface in Compose | same serif as model text | 16px | matches reading rhythm |

### Motion

Purposeful, not decorative.

- Phase transition (tab change): 200ms ease-out crossfade + 8px translateY.
- Mask reveal: 300ms fade with a brief accent flash (teal → resolved color).
- Diff render in Compare: 50ms stagger between sentences so the eye follows.
- Rung swap inside Recall: 200ms crossfade on the paragraph body (no panel change).

### Spatial system

8px base grid. Content column max-width 720px. Two-column at ≥1200px in the Compare state (original left, learner right).

## Architecture

### Phase shell (replaces 6-step sidebar)

```
┌──────────────────────────────────────────────────────────────┐
│  Writing Practice                                             │
│  ─────────────────────────────────────────────────────────   │
│  ⟨ 1 PREPARE ⟩─────⟨ 2 RECALL ⟩─────⟨ 3 COMPOSE ⟩            │
│                                                               │
│  [ active phase content, centered, max-w 720px ]              │
└──────────────────────────────────────────────────────────────┘
```

- Top tab bar replaces the 280px left sidebar. Three pill-shaped segmented tabs with monospace meta labels ("1 PREPARE").
- Locked phases (when source text isn't yet committed) render at 30% opacity with a small lock glyph. Not gray-disabled — disabled-gray reads as broken.
- Forward / back live in the tab bar itself (active tab + arrow affordance). No floating IconButtons in a sidebar footer.

### Phase 1 — Prepare

One panel: a `<SourcePanel>` that always mounts the `<MultilineTextField>` — no mode swap.

- Empty state: serif placeholder ("*Paste a paragraph you want to learn from…*") **inside the field itself**. No separate empty-state hero competing for attention.
- When non-empty: the field stays editable in place. Small monospace `● UNLOCKED` tag at top-right.
- Primary "Continue →" button snapshots the text (`sourceLocked = true`, tag becomes `○ LOCKED`) and unlocks tabs 2 and 3. A pencil glyph reopens.

**This is what kills the input bug.** The `MultilineTextField` never unmounts mid-keystroke; `sourceLocked` controls `readOnly` on the textarea, not whether it exists.

5W generation does **not** happen in Prepare. (It moves to Compose where it serves production.)

### Phase 2 — Recall ladder

One panel, three rungs of the same paragraph, masking density rising monotonically:

| Rung | Shown | Masked | Pedagogical aim |
|------|-------|--------|-----------------|
| **Light** | ~70% | Collocations + idioms only (`made a decision`, `at first glance`) | Recognize the **phrasal moves** of skilled prose |
| **Medium** | ~40% | + discourse markers (`however`, `as a result`) + key content nouns | Reproduce **cohesion patterns** |
| **Hard** | ~20% | Only sentence-opening 1–2 words, connectives, punctuation kept | Near-free recall — last rung before Compose |

`Hard` deliberately stops short of 0% so it stays a recall task. Producing from nothing is what Phase 3 is for.

Layout:

```
┌──────────────────────────────────────────────────────────────┐
│  ●  LIGHT     ◐  MEDIUM     ○  HARD          8 / 8  ✓       │
│  ──────────────────────────────────────────────────────       │
│                                                               │
│   Although the project ▓▓▓▓▓▓▓ behind schedule, the team     │
│   ▓▓▓▓▓ ▓▓▓ delivered everything ▓▓ time. The deadline...    │
│                                                               │
│  ──────────────────────────────────────────────────────       │
│  ↺ Reset           ⤿ Reveal all          Continue to Compose →│
└──────────────────────────────────────────────────────────────┘
```

- Rung selector is a segmented control (top-left). Glyph state `●` (engaged) / `◐` (in progress) / `○` (untouched) tells the learner at a glance what they've practiced.
- Switching rungs re-renders the paragraph in place via 200ms crossfade. No tab change, no spinner.

**Mask aesthetic** — replace the `___` underscores from today's [ParagraphWithHiddenWords.js:209](src/renderer/views/writing/ParagraphWithHiddenWords.js#L209):

Each masked span is an **occlusion block**:
- Background: `alpha(teal, 0.10)` solid, 14px radius.
- Inner content: monospace `▓` blocks matching the hidden word's letter count, alpha 0.35 — gives a length silhouette without leaking letters.
- Border-bottom: 1.5px dashed teal (the dashed style signals "fillable").
- Baseline alignment: occlusion blocks sit on the text baseline cleanly so line-height doesn't jitter when blocks and revealed words coexist.

**Interaction — primary mode is type, not click** (this is the active-production upgrade):

Each occlusion block is a **borderless inline input**, width matching the word's character count.
- Correct on commit (blur / Tab / space): occlusion fades, word resolves in solid teal on tinted bg, soft check flash. Counter ticks up.
- Wrong: 8px horizontal shake (150ms), red dashed underline, hint glyph appears. Single tap on the hint shows **first letter + length** (`T___ _ _____`). Second wrong attempt: amber resolution with the correct word, marked as "shown."
- Per-slot "Reveal" affordance (ⓘ at the top-right of each block) for learners who want a peek without typing.
- Global "Reveal all" / "Reset" remain as escape hatches (bottom-right).

**Transition to Compose** — "Continue to Compose →" is always enabled, but only **glows** (4px outer teal shadow) once at least Medium has reached completion. Nudge, not a gate.

### Phase 3 — Compose & Compare

Two states inside one phase panel.

**State A — Composing.** The learner produces from scaffolding only; the original is hidden.

```
┌──────────────────────────────────────────────────────────────┐
│  COMPOSE  ·  Express the same idea in your own words         │
│  ──────────────────────────────────────────────────────       │
│                                                               │
│  ▾ SCENE (5W)         WHO Anna · WHAT decision · WHEN ...    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Anna had to choose whether…                           │   │
│  │                                                        │   │
│  │ [free-write surface, serif input, line-height 1.8]    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                              42 words         │
│                                                               │
│  ⓘ Reference original          Compare with original  →      │
└──────────────────────────────────────────────────────────────┘
```

- 5W rail at top: collapsed by default to `WHO · WHAT · WHEN · WHERE · WHY` one-liner. Expand reveals the existing `SceneAnalysisDisplay` grid.
- 5W generated **on entering Compose**, not in Prepare. Intent label: `writing-5w-scaffold`.
- The original text is deliberately hidden during Composing. "ⓘ Reference original" opens it in a side drawer for learners genuinely stuck.
- `letmetry` boolean is gone. Composing is the default — no opt-in gate.

**State B — Comparing.** Side-by-side with expression-aware diff.

```
┌──────────────────────────────────────────────────────────────┐
│  ORIGINAL                       │  YOUR VERSION              │
│  ──────────────────────────────  ──────────────────────────  │
│  She took a decision quickly,   │  She made a choice fast,   │
│  knowing the deadline loomed.   │  the deadline was near.    │
│         (serif, 18px)            │       (sans, 16px)         │
└──────────────────────────────────────────────────────────────┘

EXPRESSION NOTES                                       3 upgrades
─────────────────────────────────────────────────────────────
▸  You: "made a choice"   →   Original: "took a decision"
    Take a decision is the standard collocation in formal English.

▸  You: "the deadline was near"  →  "knowing the deadline loomed"
    Participle clause keeps cohesion; "loom" carries threat the
    original sentence builds on.
```

- Diff coloring (semantic, monochrome-friendly):
  - **Green underline** — your phrasing is equivalent / fully acceptable.
  - **Amber highlight** — your phrasing is weaker than the original's. This is where the learning is.
  - **Blue squiggle** — mechanical grammar/spelling. Reuses existing `AnnotatedText` styling.
- Amber spans on each side link on hover: mutual highlight + 1px dashed teal connector line between them.
- Expression Notes rail below replaces today's standalone `ComparisonExercise` + grammar-check pile-up. Single rail, sentence-paired upgrades.

## AI prompts

Two new prompts in [src/commons/utils/AIPrompts.js](src/commons/utils/AIPrompts.js); five existing prompts collapsed.

### New

**`langstudyRecallLadderPrompt(text)`** — one batched call returns all three rungs.

Returns JSON:
```json
{
  "light":  "Although the project ${fell} behind schedule, the team ${still} delivered ${everything on time}…",
  "medium": "Although the project ${fell behind} schedule, ${the team} ${still} delivered ${everything} ${on time}…",
  "hard":   "Although ${the project fell behind schedule, the team still delivered everything on time}…"
}
```

Mask syntax `${…}` matches the existing `ParagraphWithHiddenWords` regex — no parser change.

Spine intent label: `writing-recall-ladder`. Cached on `text` so re-entering Recall is free.

**`langstudyExpressionDiffPrompt(original, learner)`** — one call covers both grammar and expression upgrades.

Returns JSON:
```json
{
  "spans": [
    { "side": "learner", "text": "made a choice", "kind": "weaker", "pair_id": "p1" },
    { "side": "original", "text": "took a decision", "kind": "stronger", "pair_id": "p1" },
    { "side": "learner", "text": "was near", "kind": "weaker", "pair_id": "p2" },
    { "side": "learner", "text": "fast", "kind": "grammar", "note": "use 'quickly' as adverb" }
  ],
  "notes": [
    {
      "pair_id": "p1",
      "learner_phrase": "made a choice",
      "original_phrase": "took a decision",
      "explanation": "Take a decision is the standard collocation in formal English."
    }
  ]
}
```

Spine intent label: `writing-expression-diff`. One round-trip on "Compare →" click.

### Removed (or scoped down)

- `langstudyAnnotatePrompt(curStep)` — five per-POS calls collapse into the single batched ladder prompt above.
- `langstudyGrammarCheckPrompt` — folded into `langstudyExpressionDiffPrompt` (`kind: "grammar"` spans).
- `langstudyComparisonExercise` — folded into `langstudyExpressionDiffPrompt` (the notes section).
- `langstudy5wPrompt` — kept as-is; intent label clarified to `writing-5w-scaffold`.

Net AI call count per paragraph (full flow):
- Today: 5 POS calls + 1 (5W) + 1 (grammar) + 1 (comparison) = **8 calls**.
- After: 1 (recall ladder) + 1 (5W) + 1 (expression diff) = **3 calls**.

## State diff

```diff
- const [activeStep, setActiveStep] = useState(0);              // 0..5
+ const [activePhase, setActivePhase] = useState('prepare');    // 'prepare' | 'recall' | 'compose'
+ const [sourceLocked, setSourceLocked] = useState(false);

  const [text, setText] = useState('');
- const [decorText, setDecorText] = useState(['', '', '', '', '', '']);
+ const [recallVariants, setRecallVariants] = useState({ light: '', medium: '', hard: '' });
+ const [activeRung, setActiveRung] = useState('light');

  const [mywriting, setMywriting] = useState('');
- const [mywritingCheck, setMywritingCheck] = useState('');
- const [mywritingComparison, setMywritingComparison] = useState('');
- const [letmetry, setLetmetry] = useState(false);
+ const [expressionDiff, setExpressionDiff] = useState(null);

- const [lang5w, setLang5w] = useState('');                     // loaded in Prepare
+ const [lang5w, setLang5w] = useState('');                     // loaded on entering Compose
```

## Component breakdown

```
WritingView (orchestrator, slim)
  ├─ PhaseTabBar           NEW — 3-pill segmented control + locked state
  ├─ SourcePanel           NEW — always-mounted textarea + lock toggle (Phase 1)
  ├─ RecallLadder          NEW — segmented rung control + paragraph render (Phase 2)
  │   └─ MaskedToken       NEW — occlusion block + inline input + reveal affordance
  ├─ ComposeCompare        NEW — orchestrates State A ↔ State B (Phase 3)
  │   ├─ FiveWRail         NEW — collapsed/expanded 5W reference
  │   ├─ FreeWriteSurface  reuses MultilineTextField (minimal mode)
  │   └─ ExpressionDiffPanel NEW — side-by-side + Expression Notes rail
  │       └─ DiffSpan      NEW — green/amber/blue span with hover-link
  └─ (removed) ParagraphWithHiddenWords — replaced by RecallLadder + MaskedToken
  └─ (removed) ComparisonExercise — folded into ExpressionDiffPanel
  └─ (removed) ParagraphComparer — folded into ExpressionDiffPanel
  └─ (removed) AnnotatedText (in writing/) — diff rendering moves to DiffSpan
```

Files affected:
- [src/renderer/views/writing/WritingView.js](src/renderer/views/writing/WritingView.js) — large rewrite of the orchestration shell.
- [src/renderer/views/writing/config.js](src/renderer/views/writing/config.js) — replace `steps[]` array with `PHASES` + `RUNGS` metadata.
- [src/renderer/views/writing/ParagraphWithHiddenWords.js](src/renderer/views/writing/ParagraphWithHiddenWords.js) — replaced by `RecallLadder` + `MaskedToken`.
- [src/commons/utils/AIPrompts.js](src/commons/utils/AIPrompts.js) — add `langstudyRecallLadderPrompt`, `langstudyExpressionDiffPrompt`.
- New: `RecallLadder.js`, `MaskedToken.js`, `ComposeCompare.js`, `ExpressionDiffPanel.js`, `DiffSpan.js`, `SourcePanel.js`, `PhaseTabBar.js`, `FiveWRail.js`.

## What we cut

1. Per-POS step pages (Noun / Verb / Prepositions / Collocations / Structure) — replaced by 3 rungs in one panel.
2. 5W "let me try" sub-flow inside Prepare — moved to Compose where it scaffolds production.
3. Rainbow 6-color palette — replaced by teal intensity ramp.
4. 280px left sidebar — replaced by top tab bar.
5. `{!text ? input : display}` mode swap — source of the input bug.
6. `letmetry` opt-in gate — Compose has no opt-in.
7. Five separate AI prompts collapsed into two (see AI prompts section).

## Out of scope (v1)

- Saving a recall-ladder attempt history per paragraph (would enable spaced re-practice via the existing Brain — natural follow-up but not in this redesign).
- Auto-pulling source paragraphs from the current reading view via a paragraph picker (would integrate with Phase 2 reading episodes — natural follow-up).
- Voice / dictation input in Compose.
- Storing the Compose attempt as a `learning_point` of `domain_type='writing'` (depends on Phase 3 domain-aware schema; currently writing is not a tagged domain in `LearningPointDomains.ts`).

## Success criteria

- Typing in the Prepare textarea no longer loses focus after the first keystroke (bug fix verified manually).
- The full flow runs end-to-end on a sample paragraph: Prepare → lock → Recall (cycle through 3 rungs, type-to-fill at least one) → Compose (5W shown, free-write, Compare) → see at least one Expression Note that pairs a learner phrase with an original phrase.
- Per-paragraph AI cost drops from 8 calls to 3 calls (verifiable via the Brain Spine Economics Panel filtered to `writing-*` intent labels).
- Tab bar correctly locks tabs 2 and 3 when `sourceLocked === false`, unlocks them when `true`.
- All existing `STEP_COLORS`-driven rainbow chrome is gone; visual chrome uses only the teal accent + intensity ramp.

## Risks / open questions

- **R1 — Mask rendering with `${…}` syntax inside inline inputs.** Today `ParagraphWithHiddenWords` parses `${word}` into objects and renders as clickable spans. The typed-input upgrade needs an inline `<input>` per mask, width-matched to character count. Auto-resizing inputs inside a paragraph that wraps is finicky; needs a `<span contentEditable>` fallback if `<input>` width measurement is unstable. Validate with a small spike in the implementation plan.
- **R2 — Diff coloring on overlapping spans.** If a learner phrase is both "weaker" (amber) and contains a grammar issue (blue), the renderer needs a layering rule. Default rule: blue squiggle wins (mechanical first), amber highlight as background tint.
- **R3 — Mask quality at Hard rung.** "Only sentence-opening 1–2 words + connectives + punctuation" is a heuristic the LLM must follow consistently. May need few-shot examples in `langstudyRecallLadderPrompt` to keep the rung distinguishable from Medium.
- **R4 — Spine label discoverability.** New labels `writing-recall-ladder`, `writing-5w-scaffold`, `writing-expression-diff` need to land in the Phase 13 `featureSurface.js` if writing attribution is desired. Out of scope for v1 implementation but flag in the implementation plan so the relevant attribution tab stays accurate.

## Reference

- Existing Editorial Premium design language: [docs/superpowers/specs/2026-06-22-note-component-ui-upgrade-design.md](docs/superpowers/specs/2026-06-22-note-component-ui-upgrade-design.md)
- Brain Spine call routing: [docs/technical/phase-9c-economics-coverage.md](docs/technical/phase-9c-economics-coverage.md)
