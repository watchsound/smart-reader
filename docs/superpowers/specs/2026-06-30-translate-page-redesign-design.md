# Translate Page Redesign — Three Level-Driven Paths

**Date:** 2026-06-30
**Status:** Draft — awaiting review
**Affected view:** `src/renderer/views/translate/` (the "Translation" page)

## Goal

Re-aim the Translate page at its real audience — **Chinese (and Japanese) native speakers learning to translate into English** — by replacing today's single passive "watch the AI work" flow with **three level-driven paths** sharing one shell:

- **Path A — Intermediate drill** *(default)* — short-sentence attempt → 6-bucket weakness comparison → Learning Point capture.
- **Path B — Advanced paragraph** — paragraph-length compose-and-compare, reusing the Writing Practice diff stack.
- **Path C — Quick lookup** — closest to today's page: type, get the answer, see the 5-step breakdown — but minus the `setInterval` reveal theatre.

The product principle is the same one the Writing Practice redesign codified ([2026-06-29-writing-practice-redesign.md](2026-06-29-writing-practice-redesign.md)) and the [feedback_language_features_are_expression.md](C:\Users\nihan\.claude\projects\c--Users-nihan-Desktop---AI---smart-e-readers-smart-reader-v2\memory\feedback_language_features_are_expression.md) memory enshrines: **language-production features must be about how you express an idea, not about looking up words.** The Translate page is a Language Production surface (the cluster also covers Writing / Grammar / 5W), and today's incarnation violates that principle.

## Why now

The current page ([TranslateMainPage.js:370-416](src/renderer/views/translate/TranslateMainPage.js#L370-L416)):

1. **Passive consumption.** User types Chinese, watches AI produce English. No attempt is forced; no comparison happens. The user never writes a word of English.
2. **Tense, articles, word-order — barely addressed.** The 5-step prompt ([AIPrompts.js:617](src/commons/utils/AIPrompts.js#L617)) walks SVO → verb options → scaffold → "pick a sentence pattern" → expand. None of those steps confronts the actual hard parts for a Chinese native: **时态** (Chinese has no tense inflection — only 了/着/过 aspect markers), **a/an/the** (no articles in Chinese), **singular/plural -s** (no number morphology), **Chinese 时-地-主-谓-宾 vs English S-V-O-place-time** word order.
3. **2-second `setInterval` step reveal is theatre.** [TranslateMainPage.js:349-360](src/renderer/views/translate/TranslateMainPage.js#L349-L360). Data is already in state when the timer starts; the delay just gates the user's eye. Removing it costs nothing.
4. **History is in-memory only** ([TranslateMainPage.js:284](src/renderer/views/translate/TranslateMainPage.js#L284)) — lost on refresh.
5. **No SRS capture.** Recurring mistakes (the user keeps forgetting articles in the same pattern) are not tracked. No Learning Point is ever created.
6. **One Spine label for all calls.** Today's `label: 'translate-main'` ([TranslateMainPage.js:332](src/renderer/views/translate/TranslateMainPage.js#L332)) collapses every translate call into one Phase 13 bucket. Once paths diverge, per-mode cost attribution requires per-mode intents.

## Visual language (anchors to existing system)

This is the third surface in the **Language Production cluster** (after Writing Practice 2026-06-29 and Grammar). For visual coherence across the cluster, the redesign borrows Writing Practice's **teal accent + intensity ramp** rather than today's primary/secondary purple-blue gradient ([TranslateMainPage.js:127](src/renderer/views/translate/TranslateMainPage.js#L127)).

### Color

Single accent: **teal** (`#0E8A8A` light / `#5EE0E0` dark — matches Writing Practice).

| Surface | Accent | Semantic feel |
|---------|--------|---------------|
| Path A pre-attempt | teal-200 | calm — reading the source |
| Path A composing | teal-400 | active — building an attempt |
| Path A comparing | teal-600 | focused — confronting weaknesses |
| Path B | same teal ramp as Path A (reuses Writing Practice tokens) | — |
| Path C | teal-300 flat — no ramp, since C has no phases | — |

Weakness-bucket colors layered on top of the teal frame:

| Bucket | Color | Rationale |
|--------|-------|-----------|
| Tense & Aspect | `#D97706` amber | Most common error for Chinese natives — high salience. |
| Word Order | `#7C3AED` violet | Distinct from grammar errors; structural. |
| Articles & Number | `#0891B2` cyan | Mechanical, frequent, low-stakes feel. |
| Preposition & Collocation | `#DC2626` red | Often vocabulary-adjacent. |
| Connector & Cohesion | `#059669` green | Discourse-level. |
| Idiom & Register | `#9333EA` purple | Stylistic. |

### Typography

Matches the Writing Practice typography table verbatim — same Editorial-Premium hierarchy across the Language Production cluster.

| Slot | Font stack | Size | Other |
|------|------------|------|-------|
| Model English (Path A diff right column; Path B original column; Path C result top) | `'Source Serif Pro', Georgia, serif` | 18px | line-height 1.8, max-width 680px |
| Source Chinese (small reference banner) | system-ui sans | 14px | muted |
| User attempt textarea | same serif as model | 16px | matches reading rhythm |
| Bucket chip label | `'JetBrains Mono', Menlo, monospace` | 11px | uppercase, 0.5px letter-spacing |
| Step-card body (Path C 5-step breakdown) | system-ui sans | 14px | unchanged from today |

## Architecture

### Shared shell

```
┌───────────────────────────────────────────────────────────────┐
│  Sidebar (280px, collapsible — kept from today)               │
│  ┌─────────────────────┐  ┌──────────────────────────────┐   │
│  │ 🇨🇳 中文 ⇄ 🇬🇧 EN    │  │   Header bar: title + chips  │   │
│  │ ┌─────────────────┐ │  ├──────────────────────────────┤   │
│  │ │ LEVEL           │ │  │                              │   │
│  │ │ ● A drill       │ │  │   [ Active path content ]    │   │
│  │ │ ○ B paragraph   │ │  │                              │   │
│  │ │ ○ C lookup      │ │  │                              │   │
│  │ └─────────────────┘ │  │                              │   │
│  │ History (persisted) │  │                              │   │
│  └─────────────────────┘  └──────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Input panel (Chinese textarea + submit)              │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

**Sidebar additions:**
- **Level selector** — new section between "Translation Direction" and "Progress". Three radio rows: `A · Drill (short sentence)`, `B · Paragraph`, `C · Lookup`. Each row has a one-line subtitle. Persisted via `customStorage.translateLevel`. Defaults to `A` on first visit.
- **History persistence** — replace today's in-memory `useState([])` with electron-store key `translate.history` (last 30 entries, per-level tag so users can scope). New IPC: `translate:history-get / translate:history-append`. Pattern mirrors `RereadQueueService`.

**Sidebar removals:**
- **Progress steps** — only Path C has linear step progress, and it appears in-content under the result. Pull it out of the sidebar.

**Header bar:** keep today's title + `sentence` preview chip. Drop the always-on "Parse Tree" toggle — dependency trees are now Path-C-only and live under their own toggle inside the result area.

**Input panel:** unchanged surface (textarea + send), but the textarea `maxLength` and placeholder change with the level (60-char soft cap + "drill prompt" on A; 600-char soft cap + "paragraph prompt" on B; no cap on C).

### Path A — Intermediate drill

```
┌────────────────────────────────────────────┐
│ Source: 图书馆的二楼有很多书。              │
│                                             │
│ ▸ Reveal SVO   ▸ Tense hint   ▸ Look up    │   (collapsed scaffold rail)
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Your English…                         │   │
│ │                                       │   │
│ └─────────────────────────────────────┘   │
│                            [ Compare → ]   │
└────────────────────────────────────────────┘
```

**Sub-states:**

1. **Empty** — Chinese source textarea (lives in shared input panel). No attempt area until source ≥ 4 chars.
2. **Pre-attempt** — source pinned at top; scaffold rail collapsed; attempt textarea ready.
3. **Composing** — user typing; Compare button disabled until attempt is non-empty.
4. **Compared** — diff view rendered (below).

**Scaffold rail (collapsed by default):**

| Button | Spine intent | Returns | Side effect |
|--------|--------------|---------|-------------|
| Reveal SVO | `translate-svo-hint` | `{ subject, verb, object }` (reuses today's step-1 prompt — just step-1, not the full 5-step) | Sets `hintsUsed.svo = true` on the eventual Learning Point. |
| Tense hint | `translate-tense-hint` | `{ tense: 'past-simple' / 'present-perfect' / ..., justification: '<1 sentence>' }` | Sets `hintsUsed.tense = true`. |
| Vocabulary lookup | (existing Vocabulary flow) | — | Per-token; not metered here. |

Each hint click adds a subtle pill below the rail naming what was revealed. Hints are pedagogical loans, not free — the SRS-side reward calculation should down-weight Learning Points captured after heavy hint use. (Concrete down-weighting is out of scope for this spec; the `hintsUsed` field is the seam.)

**Compare submit** — single `translate-compare` Spine call. Prompt input: `{ source, attempt, level: 'A' }`. Schema:

```json
{
  "modelEnglish": "There are many books on the second floor of the library.",
  "spans": [
    {
      "side": "learner" | "model",
      "text": "<exact substring>",
      "bucket": "tense" | "word-order" | "article-number" | "preposition-collocation" | "connector-cohesion" | "idiom-register",
      "pair_id": "<string, links learner span to model span>",
      "reason": "<1-2 sentences explaining why the model phrasing is stronger>"
    }
  ],
  "stepBreakdown": {
    "step-1": { ... },  // reuses today's getTranslatePrompt schema verbatim, for the "How the model built it" panel
    "step-2": { ... },
    "step-3": { ... },
    "step-4": { ... },
    "step-5": { ... }
  }
}
```

**Diff view layout:**

```
┌────────────────────────────────────────────────┐
│ 图书馆的二楼有很多书。                          │  (source, small grey)
├────────────────────────────────────────────────┤
│ Your English                                    │
│   The second floor of library [has] many books. │  ← amber underline = tense; cyan = article
├────────────────────────────────────────────────┤
│ Model                                            │
│   There are many books on the second floor of   │
│   the library.                                   │
├────────────────────────────────────────────────┤
│ ⊕ Weaknesses (2)                                │
│  ┌──────────────────────────────────────────┐  │
│  │ TENSE   "[has]" → "There are"            │  │
│  │  Chinese 有 is stative; English idiomatic │  │
│  │  uses existential "there are…".          │  │
│  │                          [Save as LP →]  │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ ARTICLE  "of library" → "of the library" │  │
│  │  …                          [Save as LP →]│ │
│  └──────────────────────────────────────────┘  │
├────────────────────────────────────────────────┤
│ ▸ How the model built it (5 steps)              │  (collapsed by default; expands inline)
└────────────────────────────────────────────────┘
```

**Save-as-Learning-Point** click triggers `learningPoint:create` with the new domain (see Data shape).

**No dependency tree** in Path A — replaced by the bucket-tagged diff. The trees were never explained to the user anyway; the diff carries the same structural information with a stronger pedagogical signal.

### Path B — Advanced paragraph

Mirrors Writing Practice **Phase 3 (Compose & Compare)** verbatim:

1. **Source panel** — Chinese paragraph pinned at top using the existing `<SourcePanel>` from `src/renderer/views/writing/`. Locked on submit.
2. **5W rail** — calls existing `langstudy-5w-scaffold` intent. Renders via the existing `<FiveWRail>` component. Reads as a priming step before composing.
3. **Compose** — multi-line English textarea below; source stays visible (locked-SourcePanel pattern).
4. **Compare** — one `translate-paragraph-compare` Spine call (new — sibling of `langstudy-expression-diff`, but takes Chinese source instead of English). Returns the same span schema as Path A but at paragraph scale.
5. **Side-by-side diff** — renders via the existing `<ExpressionDiffPanel>` from `src/renderer/views/writing/`. **Bucket weighting** at this tier emphasizes Cohesion / Idiom-Register / paragraph-level Word-Order — Tense/Article spans render but use lower-saturation versions of their bucket colors. Per-sentence "Save as LP" chips, soft-capped at 5 saves per submit.

**Reuse boundary:** `FiveWRail`, `SourcePanel`, `ExpressionDiffPanel` are imported as-is. Net new code in Path B is essentially the prompt + the bucket-color CSS override + the wrapper view. This keeps the Language Production cluster visually and behaviorally consistent.

### Path C — Quick lookup

Closest to today's page. Differences:

1. **No `setInterval` reveal.** All 5 step cards render at once on receipt of the `translate-quick` response. ([Remove TranslateMainPage.js:349-368](src/renderer/views/translate/TranslateMainPage.js#L349-L368) entirely.)
2. **Final English moves to the top** as the headline, in large serif, with a copy button. Today the answer is buried at the bottom inside step-5.
3. **Dependency-tree toggle stays** but defaults *off*. Only when toggled on does the page fire the second `getNLPAnnotationPrompt` call (today fires it eagerly). This is a real cost saving in C since C is high-volume.
4. **Per-step "try this step yourself →" link.** Click demotes to Path A with the same source pre-filled and the matching scaffold pre-opened (e.g., clicking on step-1's link opens Path A with "Reveal SVO" pre-revealed). This is the path-bridge that lets a curious lookup user upgrade into drill.
5. **No Learning Point capture by default** — Path C is reference, not drill. Vocabulary lookups inside cards still write to the legacy `vocabulary` table (existing behavior preserved).

## Spine intent labels

Today's single label `translate-main` is replaced by five intent labels so Phase 13 Spend & Returns can attribute per-mode cost:

| Intent | Path | Triggered by | Schema |
|--------|------|--------------|--------|
| `translate-svo-hint` | A | Scaffold rail: Reveal SVO | `{ subject, verb, object }` per the SVO portion of [AIPrompts.js:617](src/commons/utils/AIPrompts.js#L617) |
| `translate-tense-hint` | A | Scaffold rail: Tense hint | `{ tense, justification }` |
| `translate-compare` | A | Compare button | The 6-bucket compare schema above; includes the `stepBreakdown` block for the "How the model built it" expandable |
| `translate-paragraph-compare` | B | Compare button | Same span schema; paragraph scope |
| `translate-quick` | C | Submit button | Today's full `getTranslatePrompt` schema |

All five route through `spineApi.generateContentWithJson` ([spineApi.js](src/renderer/api/spineApi.js)) and are caught by Phase 13's attribution layer. The `translate-main` label is removed in the same patch.

## Data shape

### Learning Point domain

New `domain_type: 'translate-weakness'` added to `src/commons/model/LearningPointDomains.ts`. **One domain, bucket in `subDomain`** — keeps the taxonomy short; the bucket also drives UI grouping in dashboards.

```ts
{
  domain_type: 'translate-weakness',
  subDomain: 'tense' | 'word-order' | 'article-number' | 'preposition-collocation' | 'connector-cohesion' | 'idiom-register',
  source: '<the Chinese source fragment>',
  learnerAttempt: '<the user\'s English fragment>',
  modelTarget: '<the model English fragment>',
  reason: '<the AI\'s 1-2 sentence explanation>',
  hintsUsed: { svo?: true, tense?: true, vocabulary?: true },
  sourceLanguage: 'Chinese' | 'Japanese',
}
```

`feature_surface: 'translate-drill'` (new value in the closed enum at [featureSurface.js](src/commons/model/featureSurface.js)) carries through to `mastery_event` for **both Path A and Path B** Learning Point saves — they share the same Language-Production pedagogy and we want Phase 13 ROI to aggregate per-bucket cost-to-mastery across both. The Learning Point itself carries the originating `level` field if downstream surfaces ever need to split A vs B. Path C does not write Learning Points and therefore does not carry this surface.

### History persistence

Electron-store key `translate.history`. Cap 30 entries. Schema per entry:

```ts
{
  id: string,            // uuid
  sourceText: string,    // the Chinese (or Japanese)
  level: 'A' | 'B' | 'C',
  sourceLanguage: 'Chinese' | 'Japanese',
  timestamp: number,     // Date.now()
  resultEnglish?: string // model English from the response (omitted on submission failures)
}
```

IPC handlers `translate:history-get` and `translate:history-append` go in `src/main/ipc/`. No new SQLite table — the volume doesn't justify one.

### Auto-mode-switch policy

Path A's source textarea behaves in three bands:

- **≤ 60 chars** — normal; no UI annotation.
- **61–80 chars** — small muted character counter appears under the textarea ("65 chars · short-sentence drill"). No toast.
- **> 80 chars** — fire a **one-time-per-session** toast: *"Long input — switch to Paragraph mode?"* with `[Switch to B]` / `[Stay]` actions. `[Switch to B]` writes `customStorage.translateLevel = 'B'` and re-renders the path; `[Stay]` records a session flag so the toast never fires again until next launch.

**Never silently switch the level.** The user owns that setting.

## Components

New components in `src/renderer/views/translate/`:

| Component | Path | Purpose |
|-----------|------|---------|
| `TranslateShell.jsx` | shared | Replaces today's `TranslateMainPage.js`. Owns the sidebar + header + input panel + path router. |
| `LevelSelector.jsx` | shared | Sidebar radio group; persists to `customStorage.translateLevel`. |
| `TranslateHistoryList.jsx` | shared | Sidebar history; talks to `translate:history-*` IPC. |
| `PathADrillView.jsx` | A | Owns scaffold rail + attempt area + compare result. |
| `ScaffoldRail.jsx` | A | The 3-button hint rail. Each button is a separate Spine call. |
| `WeaknessChip.jsx` | A/B | Renders one bucket-colored chip with "Save as LP" action. |
| `DiffSpansRenderer.jsx` | A/B | Takes the `spans` array, renders learner-side and model-side with synced hover highlighting (matched on `pair_id`). |
| `ModelBuildPanel.jsx` | A | Wraps today's `StepOneSVOCard` / `StepTwoVerbCard` / `StepThreeSentenceStructureCard` / `StepFourSentenceScaffoldCard` / `StepFiveFinalCard` into one expandable. Renders all five at once. |
| `PathBParagraphView.jsx` | B | Imports Writing Practice's `SourcePanel`, `FiveWRail`, `ExpressionDiffPanel`. |
| `PathCLookupView.jsx` | C | Headline result + ModelBuildPanel + dep-tree toggle. The `setInterval` reveal is dropped. |

Today's per-step card files (`StepOneSVOCard.js`, etc.) are kept and reused by `ModelBuildPanel`. `DependencyTree.js` + `DependencyUtil.js` are kept and used only by Path C.

## Testing

| Test | File | What it asserts |
|------|------|-----------------|
| Level persistence | `__tests__/translate/levelSelector.test.js` | Changing level writes to `customStorage`; reload restores the choice. |
| History persistence | `__tests__/translate/history.test.js` | Submit appends; cap-30 eviction works; reload restores. |
| Path A scaffold accounting | `__tests__/translate/pathA-hints.test.js` | Each scaffold click records into `hintsUsed` on the next Learning Point. |
| Path A compare schema | `__tests__/translate/pathA-compare.test.js` | Mock spine returns the 6-bucket schema; weakness chips render in the right color. |
| Path B reuse | `__tests__/translate/pathB-paragraph.test.js` | `<SourcePanel>` + `<FiveWRail>` + `<ExpressionDiffPanel>` are imported from `views/writing/`. Wrong-path import is a test failure. |
| Path C demotion | `__tests__/translate/pathC-demote.test.js` | Clicking "try this step yourself" on step-1 navigates to Path A with source pre-filled and SVO scaffold pre-revealed. |
| Intent label coverage | `__tests__/spine/translateIntentLabels.test.js` | Submitting in each path fires exactly the listed intent(s). |

No integration test gated on `:memory:` SQLite is added — the page is renderer-only and the Phase 13 attribution test stack already covers `feature_surface` flow.

## Risks

1. **Compare-prompt latency** — bundling `modelEnglish + spans + stepBreakdown` into one `translate-compare` call may push p95 above today's two-call flow. **Mitigation:** measure on first build; if p95 > 4s, split into two parallel calls (`translate-compare-fast` for spans + `translate-compare-steps` for the breakdown) and render the breakdown asynchronously when it arrives.
2. **Bucket misclassification.** The 6-bucket labels are AI-generated; a tense error mislabeled as a word-order error pollutes the Learning Point. **Mitigation:** the "Save as LP" button is *user-initiated*, not automatic — the user has a chance to silently filter mislabels. The bucket appears on the chip in monospace before saving, so the user can see it.
3. **Demote-to-Path-A from Path C** must preserve the source-language toggle and any prior scaffold revelations across the path switch. **Mitigation:** path-switch goes through a single `useTranslateState` hook (new), not direct `setState` cascades.
4. **Visual divergence from today** — users habituated to today's purple gradient may be surprised by teal. **Mitigation:** Language Production cluster coherence (Writing already teal) > local familiarity. Accept the friction.
5. **Path C demotion ergonomics.** Each step's "try this step yourself →" link is a small affordance; in user-testing it may go unnoticed and Path C becomes a dead-end for upgrades. **Mitigation:** if telemetry shows < 1% demote-rate after 4 weeks, promote the affordance to a banner at the result top.

## Open items (deferred — not v1)

- **Hint down-weighting in SRS** — the `hintsUsed` field is captured but the SRS service does not yet consume it. Wait for usage data.
- **Brain Episode emission for Path A submits** — could feed Phase 2 episode stream as a `TRANSLATE_ATTEMPT` event. Skipped in v1; the Learning Point save is the proxy signal.
- **Path A → Phase 7 cross-book** — recurring tense mistakes could feed a learning-path proposal. Wait for Path A telemetry.
- **Japanese support for the 6-bucket taxonomy** — buckets are written with Chinese-native paint points in mind. Japanese paint points (particles, verb conjugation chains, keigo register) overlap with the buckets but not perfectly. Acceptable for v1; revisit if Japanese usage > 10% of translate calls.

## Glossary additions (write to CONTEXT.md)

- **Level Selector** — sidebar control on `/translate` choosing among Path A drill, Path B paragraph, Path C lookup. Persisted per-user. *Not "mode toggle".*
- **Path A / B / C** — the three flows. **A** = short-sentence attempt + 6-bucket compare. **B** = paragraph compose-and-compare reusing Writing Practice components. **C** = quick lookup with the model-built-it breakdown.
- **Weakness Bucket** — one of six closed-enum categories the `translate-compare` prompt labels learner spans with: `tense` / `word-order` / `article-number` / `preposition-collocation` / `connector-cohesion` / `idiom-register`. Drives chip color, Learning Point `subDomain`, and Phase 13 attribution.
- **Scaffold Rail** — Path A's collapsible 3-button hint surface (Reveal SVO / Tense hint / Vocabulary lookup). Each click records into `hintsUsed`. *Not "hint panel".*
- **Path Demotion** — Path C action: clicking *"try this step yourself →"* on a model-built-it step switches the page to Path A with the source pre-filled and the matching scaffold pre-opened.
- **`feature_surface: 'translate-drill'`** — closed-enum value in `featureSurface.js`. Mastery moves caused by Path A weakness saves attribute to this surface in Phase 13 Spend & Returns.

## Out of scope

- Translate-from-English-to-Chinese (the page is one-directional by design).
- Speech / audio input.
- Image-based translation (OCR pipeline).
- Korean source language. (Japanese stays as it is in v1.)
- Replacing the legacy `vocabulary` table with `learning_point` (already deferred per [project_dual_vocab_stores.md](C:\Users\nihan\.claude\projects\c--Users-nihan-Desktop---AI---smart-e-readers-smart-reader-v2\memory\project_dual_vocab_stores.md)).
