# Learning Module Primitives

A practical reference for building **new AI-driven learning modules** on top of the primitives that shipped with the Writing Practice v2 redesign (2026-06-29). Everything below is generic — designed to work outside `views/writing/` — and covers:

- LLM calls (spine, robust parsing, cost attribution)
- Prompt authoring rules (esp. the simple-English constraint that keeps the tutor L1-agnostic)
- Text analysis primitives (POS, sentence split, alignment, span location)
- Vocabulary integration (local-first with LLM fallback)
- UI patterns you can reuse verbatim
- Visual language conventions
- New-module checklist

Open this doc **before** writing the first line of a new learning module. Pick which primitives you need and adapt; do not re-invent.

## Related docs & memory

- [ai-learning-brain.md](ai-learning-brain.md) — Brain heartbeat, episodes, brain-driven loops
- [skill-system.md](skill-system.md) — Agent Skills, IPC-invoked skills
- [phase-9c-economics-coverage.md](phase-9c-economics-coverage.md) — Spine label conventions for Economics attribution
- **Memory**: `feedback_language_features_are_expression.md` — for language-production features
- **Memory**: `feedback_ollama_always_last_fallback.md` — provider failover chain
- **Memory**: `feedback_simple_english_tutor_output.md` — tutor voice constraint

---

## 1. LLM calls (renderer)

Every LLM call goes through the Brain Spine (Phase 9). Never call an `AIProvider*` class directly from a view — you'll bypass the ledger, timeout, failover, and Economics attribution.

### 1.1 `spineApi.generateContentWithJson`

```js
import spineApi from '../../api/spineApi';

const res = await spineApi.generateContentWithJson(
  yourPromptString,                       // string
  null,                                   // schema (usually null — we use polyfilled JSON mode)
  { label: 'your-feature-intent' },       // shows up in the Economics panel
);
```

You get for free:

- **Failover chain**: `DeepSeek → Kimi → ChatGPT → Ollama` (`src/main/brain/spine/providerFailover.js`). Ollama is the offline safety net — never drop it from the tail (see `feedback_ollama_always_last_fallback.md`).
- **60s per-attempt timeout** at the spine layer. If the whole chain fails, the renderer sees an error within ~3 minutes max — no hang.
- **Cost ledger row** with your intent label. Filter the Economics panel by that label to see spend.
- **Renderer-side error handling**: throws on IPC-bridge errors, so wrap calls in try/catch and surface the message to the user.

### 1.2 Robust JSON parsing

The provider polyfill returns a JS object on success — but empty strings, markdown-wrapped JSON, and malformed JSON all happen in practice. Use this pattern for every parser you write:

```js
const EMPTY = { /* your default shape */ };

function stripCodeFences(s) {
  let out = s.trim();
  if (out.startsWith('```')) {
    out = out
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  return out;
}

export function parseYourShape(input) {
  if (input == null) {
    throw new Error('parseYourShape: expected object, got null');
  }
  let obj = input;
  if (typeof obj === 'string') {
    const cleaned = stripCodeFences(obj);
    if (!cleaned) return EMPTY;         // provider hiccup → empty result, don't throw
    try {
      obj = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`parseYourShape: LLM returned invalid JSON: ${e.message}`);
    }
  }
  if (!obj || typeof obj !== 'object') return EMPTY;
  // …shape-specific validation…
  return { /* validated result */ };
}
```

Reference implementation: [expressionDiffParser.js](../../src/renderer/views/writing/expressionDiffParser.js).

### 1.3 Handling a hung LLM in the UI

If a rung / panel depends on an LLM call, wrap it with a retry affordance rather than an infinite spinner. Reference: `WritingView.js` used to have `retryLlmRungs` — now that all rungs are local, only `ComposeCompare.handleCompare` still has this pattern. Structure:

```js
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const handle = async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await spineApi.generateContentWithJson(...);
    const parsed = parseYourShape(res);
    // Guard against LLM returning nothing usable.
    if (!hasContent(parsed)) {
      setError('The call came back empty. Try again.');
      return;
    }
    // success…
  } catch (err) {
    console.error('feature failed', err);
    setError(err?.message || 'Call failed. Try again.');
  } finally {
    setLoading(false);
  }
};
```

Render `error` below the button in `theme.palette.error.main` so the user sees it.

---

## 2. Prompt authoring

### 2.1 The simple-English constraint (required)

Every prompt whose output includes **tutor-voice free text** (definitions, explanations, gists, examples, notes, corrections, tips) must constrain the output to common everyday English. This makes the app L1-agnostic — accessible to any learner regardless of native language, not just Chinese speakers.

`AIPrompts.js` has a shared `SIMPLE_ENGLISH_CONSTRAINT` constant. Inject it near the top of your prompt:

```js
export const yourPrompt = (input) => `
${SIMPLE_ENGLISH_CONSTRAINT}

You are a language-learning tutor …

Return ONLY a JSON object with this shape:
{
  "explanation": "<in SIMPLE English (B1 level)>",
  ...
}
`;
```

The constraint requires:

- Top-3000 vocabulary only (Voice-of-America Special English level)
- No academic / rare synonyms
- Plain-English gloss in parentheses for unavoidable specialized terms — e.g. `"collocation (words that often appear together)"`
- Short sentences, active voice
- No grammar-jargon barrier terms (say "action word" not "verb" if the term is a barrier)
- **Applies only to tutor-voice output** — verbatim quotes from source text keep their original words

Currently `SIMPLE_ENGLISH_CONSTRAINT` is a module-local `const` inside `AIPrompts.js`. If you're authoring a prompt file elsewhere, add an `export` or import from `AIPrompts` directly.

Full rationale: `feedback_simple_english_tutor_output.md` in project memory.

### 2.2 Structured output shape

Prefer **shallow, flat shapes** over nested trees:

- Provider polyfills handle flat JSON reliably; nested schemas cause more parse failures.
- Downstream parsers stay simple.

If the response naturally groups (sentence-by-sentence, rung-by-rung), that's fine — see `sentenceComparisons` in [langstudyExpressionDiffPrompt](../../src/commons/utils/AIPrompts.js) for a nested-with-fallback pattern.

### 2.3 Backwards-compatible parsers

When the LLM shape evolves, keep the parser accepting BOTH old and new shapes for one release cycle. See `parseExpressionDiff`, which normalizes new `sentenceComparisons` alongside legacy flat `notes`. This prevents a stale-response cache from breaking the UI mid-migration.

### 2.4 Intent labels for Economics attribution

Every `spineApi` call carries a `label`. Convention:

```
<module>-<feature>-<step>
```

Examples in use: `writing-recall-ladder`, `writing-5w-scaffold`, `writing-dictionary-lookup`, `writing-expression-diff`, `writing-compose-scaffolds`. Adding them to `src/commons/model/featureSurface.js` gets you Phase 13 ROI attribution — see [phase-9c-economics-coverage.md](phase-9c-economics-coverage.md).

---

## 3. Text analysis primitives

All primitives are pure JS, unit-tested, and safe to import from any renderer file.

### 3.1 POS tagging & masking — [posTagger.js](../../src/renderer/views/writing/posTagger.js)

```js
import {
  classifyWord,       // (word) → 'function' | 'adjective' | 'adverb' | 'noun' | 'verb'
  taggedTokens,       // (text) → [{ word, pos, start, end }]
  buildPosMask,       // (text, posSet, {cap}) → text with `${word}` masks
  buildConnectivesMask, buildClauseStemsMask, buildSubordinateMask,  // structural variants
  sampleEvenly,       // (arr, cap) → evenly-spaced subset of arr
} from '../../views/writing/posTagger';

// Example: mask up to 8 nouns, evenly distributed across the paragraph.
const masked = buildPosMask(paragraph, new Set(['noun']), { cap: 8 });
// → "The ${dog} ate the ${food} on the ${floor} …"
```

Backed by `compromise` (~250KB, bundled) plus an override map (`OVERRIDES`) for the handful of words it misclassifies (`bubbly`, `motherly`, etc.). Adverb detection uses compromise's `Adverb` tag directly.

### 3.2 Sentence handling — [expressionDiffLayout.js](../../src/renderer/views/writing/expressionDiffLayout.js)

```js
import {
  splitSentences,   // (text) → array that fully partitions text (abbreviations / decimals / URLs safe)
  locateSpans,      // (text, sideSpans) → non-overlapping [{ start, end, kind, pairId }]
  clipSpansToSlice, // (spans, sliceStart, sliceEnd) → spans clipped to a window
} from '../../views/writing/expressionDiffLayout';
```

Use `splitSentences` any time you need to process a paragraph sentence by sentence — regex-based approaches typically drop characters on abbreviations. `locateSpans` + `clipSpansToSlice` are what let per-sentence rendering carry inline highlights.

### 3.3 Word-level alignment — [wordAlignment.js](../../src/renderer/views/writing/wordAlignment.js)

```js
import { align } from '../../views/writing/wordAlignment';

const { alignedA, alignedB, score, totalA, totalB } = align(originalText, learnerText);
// alignedA[i] and alignedB[i] together define column i:
//   { word, gap: boolean, match: boolean }
```

Needleman-Wunsch **global** alignment with **no substitutions** — two words share a column iff they're identical (case + outer-punctuation insensitive). Non-matching pairs are split across adjacent gap-paired columns. Every word from both sequences appears in the returned alignment.

If you want just the visualization, use `<AlignmentView original={a} learner={b} accent={color} />` from [AlignmentView.js](../../src/renderer/views/writing/AlignmentView.js) — includes ResizeObserver-based responsive chunking and per-line ORIGINAL/YOURS labels.

### 3.4 Attempt-matching helper — [maskAttempt.js](../../src/renderer/views/writing/maskAttempt.js)

```js
import { commitMaskAttempt } from '../../views/writing/maskAttempt';

const { ok, hint } = commitMaskAttempt(userTyped, expectedWord);
// ok: boolean
// hint: null when ok=true or attempt is empty;
//       first-letter+length skeleton (e.g. "D_______") when wrong
```

For any "type-to-fill" interaction. Case-insensitive, whitespace-tolerant.

---

## 4. Vocabulary integration

The **legacy `vocabulary` table** is the main-user-path vocabulary store (see `project_dual_vocab_stores.md` in memory). Use it for any feature that captures "words the learner cares about."

### 4.1 Local-first lookup pattern

```js
import customStorage from '../../store/customStorage';

// Step 1: check local (0 LLM calls)
const existing = await customStorage.getVocabularyByName(word);
if (existing?.definition) {
  // Serve saved data instantly.
  return existing;
}

// Step 2: LLM lookup (with paragraph context for sense disambiguation)
const res = await spineApi.generateContentWithJson(
  langstudyDictionaryLookupPrompt(word, surroundingText),
  null,
  { label: 'your-module-dictionary-lookup' },
);

// Step 3: save with the already-fetched data (0 extra LLM calls)
await customStorage.addVocabularyDirect({
  word,
  definition: res.definition,
  example: res.example,
  related: res.related,
});
```

**Never** call `addToVocabulary(text)` after a manual lookup — that path re-runs the LLM prompt server-side, wasting one call per save. `addVocabularyDirect` was added specifically to skip the redundant call.

### 4.2 Drop-in word lookup UI — [WordLookupPopover.js](../../src/renderer/views/writing/WordLookupPopover.js)

```jsx
import WordLookupPopover from '../../views/writing/WordLookupPopover';

<div>
  <YourContent />
  <WordLookupPopover contextText={paragraphAroundSelection} accent={themeAccent} />
</div>
```

Wraps everything: document-level mouseup selection detection, single-word + non-stop-word filtering (via `compromise` tags), popover positioning, LLM lookup, local-first check, "Add to dictionary" flow. Just pass `contextText` (the paragraph the selection came from) so the LLM can disambiguate senses.

---

## 5. UI patterns you can reuse verbatim

Currently these live in `src/renderer/views/writing/` because they were built there. When two consumers exist, move to `src/renderer/components/learning/` (mirrors the `Editorial Premium` pattern from `NoteCardSurface`).

| Component | File | Reuse for |
|-----------|------|-----------|
| `SourcePanel` | `views/writing/SourcePanel.js` | Any always-mounted textarea with lock/unlock semantics. Already accepts `label` + `placeholder` props for reuse. |
| `PhaseTabBar` | `views/writing/PhaseTabBar.js` | Segmented top-tab navigation for multi-stage flows. Consumes a `PHASES` array from `config.js`. |
| `MaskedToken` | `views/writing/MaskedToken.js` | Inline occlusion + typed input + live green/red prefix feedback + auto-resolve on match. |
| `DiffSpan` | `views/writing/DiffSpan.js` | Inline colored span with hover-pair linking. Handles `green/amber/blue` by `kind` prop. |
| `AlignmentView` | `views/writing/AlignmentView.js` | Column-zipped word alignment with responsive chunking. |
| `FiveWRail`, `ComposeScaffolds` | `views/writing/` | Collapsible scaffold block pattern. Look at the shared `ScaffoldBlock` helper in `ComposeScaffolds.js` if you want that primitive alone. |
| `ExpressionDiffPanel` | `views/writing/ExpressionDiffPanel.js` | Sentence-grouped comparison rail with inline highlights and hover-to-top reordering. |

### 5.1 Sentence groups + inline highlights pattern

For any "here's the original, here's the learner's version, here are the differences" surface, use the pattern in [ExpressionDiffPanel.js](../../src/renderer/views/writing/ExpressionDiffPanel.js):

1. LLM returns `spans[]` (colored highlights) + `sentenceComparisons[]` (grouped notes).
2. Render one sentence group at a time. Each group displays:
   - The original sentence with its side='original' spans inlined.
   - The learner sentence with its side='learner' spans inlined.
   - The notes for that sentence pair.
3. Hovering a span pair lifts its whole sentence group to the top of the list (via `useMemo` reorder + stable React keys).

The renderer function `renderSentenceInline` is defined in `ExpressionDiffPanel.js` — clone it or extract to a shared helper if you build a second consumer.

---

## 6. Visual language conventions

Reference: `NoteCardSurface` "Editorial Premium" pattern (see `CONTEXT.md` glossary).

### 6.1 Surface chrome

```jsx
<Box
  sx={{
    bgcolor: theme.palette.background.paper,
    borderRadius: '14px',
    border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
    borderLeft: `4px solid ${accent}`,  // accent stripe on left edge
    overflow: 'hidden',
  }}
>
```

- 14px rounded corners
- 1px hairline border
- 4px accent stripe on left edge
- No shadow for interior panels; soft elevation only for hover states or top-level cards

### 6.2 Color

- **One accent color per module** with intensity ramp per phase (see `config.js` `ACCENT` in writing). Do NOT use a per-item rainbow — that's the anti-pattern the writing v2 redesign fixed.
- **Semantic colors** for diff/status: `theme.palette.success.main` (match), `theme.palette.warning.main` (weaker), `theme.palette.info.main` (grammar). Grammar spans use wavy underline (`textDecorationStyle: 'wavy'`) rather than a solid fill.

### 6.3 Typography

```js
const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const SANS  = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const MONO  = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;
```

- **Model / original text** → SERIF (gravitas, "this is the source of truth")
- **Learner's own text / chrome** → SANS
- **Meta labels** (rung names, counts, tags) → MONO, uppercase, 0.4-0.5px letter-spacing, 0.65-0.72rem
- **Font sizes**: 18px for model text, 14-16px for chrome, 10.5-11.5px (0.65-0.72rem) for meta labels

### 6.4 Motion

- **fadeInUp** keyframe stagger for text reveals (see `RecallLadder.js`): 20ms per word, capped at 800ms total.
- **Phase transitions**: 200ms crossfade.
- **Bloom-on-resolve** (see `MaskedToken.js`): scale 1 → 1.05 → 1 over 400ms with a light color flash.
- **Rung switch**: 200ms crossfade on paragraph body (no unmount).
- **Hovered card lift**: 200-250ms translateY + box-shadow.

### 6.5 Component sizing / spacing

- Content column max-width: 1200px for two-column layouts, 720px for single-column reading.
- Grid gap: `theme.spacing(2)` (16px) for section separation, `theme.spacing(1)` (8px) for inline groups.
- Section padding: `p: 2` (16px) or `p: 2.5` (20px) inside cards.

---

## 7. Persistence

### 7.1 Where things live

- **`vocabulary` table** (SQLite) → legacy but main user path. Use `customStorage.addVocabularyDirect` / `addToVocabulary` / `getVocabularyByName`.
- **`learning_point` with `domain_type='vocabulary'`** → Phase 4 micro-cards only. Don't dual-write (see `project_dual_vocab_stores.md`).
- **`brain_call_ledger`** → written automatically by `meteredCallJson` for every LLM call. Read via Economics Panel — don't write directly.
- **`electron-store`** → for renderer-side preferences / snapshots (e.g. `brainShell.queueSnapshot`).

### 7.2 IPC handler pattern for a new persistence action

```ts
// src/main/main.ts
ipcMain.handle('yourModule:save', async (_e, data, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return false;
  try {
    // ... call your db manager ...
    return result;
  } catch (e) {
    console.log((e as { message?: string }).message || e);
    return false;
  }
});

// src/main/preload.ts (inside the ipcRenderer proxy object)
yourModuleSave(data: any, token: string) {
  return ipcRenderer.invoke('yourModule:save', data, token);
},

// src/renderer/store/customStorage.js
static yourModuleSave(data) {
  if (!this.isLoggedIn()) return null;
  return window.electron.ipcRenderer.yourModuleSave(data, this.getSessionToken());
}
```

Follow the existing token-through-preload pattern — never trust user input for `userId`.

---

## 8. New-module checklist

Before writing your first line of code:

- [ ] Read the relevant memories:
  - Language-production feature? → `feedback_language_features_are_expression.md`
  - Any LLM call at all? → `feedback_ollama_always_last_fallback.md`, `project_provider_portability_required.md`
  - Any tutor-voice output? → `feedback_simple_english_tutor_output.md`
- [ ] Pick your **module intent labels** — `<module>-<feature>-<step>`. List them here.
- [ ] Decide which primitives you'll import (from Sections 3-5 above).
- [ ] For each new prompt: does it inject `SIMPLE_ENGLISH_CONSTRAINT`?
- [ ] For each parser: does it use the empty-string / markdown-fence / try-JSON.parse pattern from Section 1.2?
- [ ] For each spine call site: does its consumer have a visible error state (not a silent failure)?

During implementation:

- [ ] Reuse `SourcePanel`, `PhaseTabBar`, `MaskedToken`, `DiffSpan`, `AlignmentView` where they fit — do NOT re-implement the same UI patterns.
- [ ] Follow the Editorial Premium chrome + one-accent-color-per-module discipline.
- [ ] Add unit tests for every pure helper you write (see `writingSmithWaterman.test.js`, `writingExpressionDiffParser.test.js` for the discipline).

Before shipping:

- [ ] Full `npx jest --testPathPattern=<yourModule>` passes.
- [ ] `npx eslint src/renderer/views/<yourModule>/` clean of non-convention errors.
- [ ] Add glossary entries to `CONTEXT.md` for the new domain terms.
- [ ] If the module introduces a persistent principle (e.g. "this feature-class should behave a certain way"), save it as memory under `feedback_<principle>.md`.

---

## Where these primitives came from

Everything in this doc was extracted from the Writing Practice v2 redesign (spec: [2026-06-29-writing-practice-redesign.md](../superpowers/specs/2026-06-29-writing-practice-redesign.md), plan: [2026-06-29-writing-practice-redesign.md](../superpowers/plans/2026-06-29-writing-practice-redesign.md)). If you find yourself needing something similar to Writing Practice — recall / production / comparison / dictionary lookup — start by reading how that module solved it before designing your own version.
