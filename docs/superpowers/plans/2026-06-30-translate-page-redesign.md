# Translate Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/translate` into three level-driven paths (A drill / B paragraph / C lookup) so Chinese (and Japanese) native speakers learn to confront the real hard parts of translating into English — tense, word order, articles, prepositions, cohesion, idiom — instead of passively watching the AI work.

**Architecture:** Re-shell the page around a `Level Selector` whose three values mount three independent path views. Path A captures the user's own English attempt and compares it against a model translation, AI-tagging weaknesses against a closed 6-bucket taxonomy. Path B reuses three components from the existing Writing Practice page (`SourcePanel`, `FiveWRail`, `ExpressionDiffPanel`) for paragraph-scale compose-and-compare. Path C is today's flow minus the `setInterval` theatre, with the model English headlined at top and per-step demote links into Path A. Each path emits its own Spine intent label so Phase 13 Spend & Returns can attribute per-mode cost. Path A & B weakness saves write Learning Points via the existing `language` domain with bucket info in extras.

**Tech Stack:** React 18 + MUI 5 + Electron 26, better-sqlite3 (Learning Points), electron-store (level + history), Brain Spine (`spineApi.generateContentWithJson`), Jest unit tests.

---

## Spec → plan deltas (read these before starting)

1. **Learning Point domain choice.** The spec proposed inventing `domain_type: 'translate-weakness'`. The plan instead uses the **existing `'language'` domain** with extended `LanguagePatternExtras`. Reason: `LearningPointDomains.ts:18-46` documents five fragmented `DOMAIN_TYPES` lists across the codebase; adding a new value requires touching `LearningPointService.js` LIVE + `LearningPointManager.js` + `brainApi.js` + `DomainDetectionSkill.js` + `LearningPointDomains.ts`. The existing `'language'` domain's `LanguagePatternExtras` already carries `sourceLang / targetLang / pattern / examples / commonErrors` — exactly the shape we need. The bucket goes in extras; the domain stays `'language'`. This is the YAGNI choice.

2. **History persistence — no new IPC.** Spec proposed `translate:history-get` / `translate:history-append` IPC handlers. The plan instead uses **`customStorage.getItem('translate.history')` / `setItem('translate.history', json)`** — same electron-store, no new IPC. Pattern matches `getReaderConfig` ([customStorage.js:1609](src/renderer/store/customStorage.js#L1609)).

3. **Level persistence.** Same as above — `customStorage.getItem('translate.level')` / `setItem('translate.level', ...)`. No new IPC.

4. **DiffSpan extension.** The existing `<DiffSpan>` ([writing/DiffSpan.js:6-10](src/renderer/views/writing/DiffSpan.js#L6-L10)) only knows 4 `kind` values via `DIFF_COLORS`. The plan extends `DiffSpan` with an optional `bucket` prop and adds a `BUCKET_COLORS` map. Original 4 `kind` values keep working unchanged for Writing Practice.

5. **SourcePanel reuse.** The existing `<SourcePanel>` ([writing/SourcePanel.js:81-82](src/renderer/views/writing/SourcePanel.js#L81-L82)) hardcodes label "SOURCE PARAGRAPH" and an English placeholder. Path B requires both to be configurable; the plan adds optional `label` and `placeholder` props with current values as defaults — fully backwards compatible.

6. **Learning Point creation IPC.** No existing renderer-callable IPC creates a single ad-hoc learning point (the existing handlers are bulk-import paths — `learning-point-import-file` / `learning-point-from-vocabulary`). The plan adds **one new IPC handler** `learning-point-create` and **one new api client** `learningPointApi.create()`.

---

## File structure

**New files**

| Path | Responsibility |
|------|----------------|
| `src/renderer/views/translate/TranslateShell.jsx` | Top-level page — sidebar + header + input panel + path router. Replaces `TranslateMainPage.js`. |
| `src/renderer/views/translate/LevelSelector.jsx` | Sidebar radio group; persists to `customStorage`. |
| `src/renderer/views/translate/TranslateHistoryList.jsx` | Persisted history list. |
| `src/renderer/views/translate/PathADrillView.jsx` | Path A surface — scaffold rail + attempt area + compare result. |
| `src/renderer/views/translate/PathBParagraphView.jsx` | Path B surface — wraps writing components. |
| `src/renderer/views/translate/PathCLookupView.jsx` | Path C surface — today's flow, restructured. |
| `src/renderer/views/translate/ScaffoldRail.jsx` | Path A hint rail (3 buttons). |
| `src/renderer/views/translate/WeaknessChip.jsx` | One bucket-colored chip + Save-as-LP action. |
| `src/renderer/views/translate/DiffSpansRenderer.jsx` | Path A diff side-by-side renderer with synced hover. |
| `src/renderer/views/translate/ModelBuildPanel.jsx` | Wraps the existing 5 step cards as one expandable. |
| `src/renderer/views/translate/buckets.js` | Closed 6-bucket enum + colors + display labels. |
| `src/renderer/api/learningPointApi.js` | Renderer client for `learning-point-create`. |
| `src/__tests__/translate/levelSelector.test.js` | Level persistence test. |
| `src/__tests__/translate/history.test.js` | History persistence + cap-30 eviction. |
| `src/__tests__/translate/pathA-hints.test.js` | Scaffold-rail hint accounting. |
| `src/__tests__/translate/pathA-compare.test.js` | Compare schema rendering. |
| `src/__tests__/translate/pathB-paragraph.test.js` | Reuse boundary test. |
| `src/__tests__/translate/pathC-demote.test.js` | Demote-to-A behavior. |
| `src/__tests__/translate/buckets.test.js` | Bucket enum integrity. |

**Modified files**

| Path | What changes |
|------|--------------|
| `src/commons/model/featureSurface.js` | Add `'translate-drill'` to enum + lens maps. |
| `src/commons/model/LearningPointDomains.ts` | Extend `LanguagePatternExtras` with bucket+attempt+target+reason+hintsUsed. |
| `src/commons/utils/AIPrompts.js` | Add 4 new prompts (`getSvoHintPrompt`, `getTenseHintPrompt`, `getTranslateComparePrompt`, `getTranslateParagraphComparePrompt`). |
| `src/renderer/views/writing/SourcePanel.js` | Add optional `label` + `placeholder` props. |
| `src/renderer/views/writing/DiffSpan.js` | Extend with optional `bucket` prop + `BUCKET_COLORS`. |
| `src/renderer/views/translate/index.js` | Mount `TranslateShell` instead of `TranslateMainPage`. |
| `src/main/ipc/learningPlanHandlers.js` | Add `learning-point-create` handler. |
| `CONTEXT.md` | Glossary additions per spec §"Glossary additions". |

**Deleted file**

| Path | Reason |
|------|--------|
| `src/renderer/views/translate/TranslateMainPage.js` | Replaced by `TranslateShell.jsx`. |

`src/renderer/views/translate/{StepOneSVOCard,StepTwoVerbCard,StepThreeSentenceStructureCard,StepFourSentenceScaffoldCard,StepFiveFinalCard,DependencyTree,DependencyUtil,PromptUtil}.js` are **kept and reused** by `ModelBuildPanel` and `PathCLookupView`.

---

## Phase 0 — Foundations (contracts before behavior)

### Task 0.1: Add `'translate-drill'` to `featureSurface`

**Files:**
- Modify: `src/commons/model/featureSurface.js`
- Test: `src/__tests__/featureSurface/translateDrillEnum.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/featureSurface/translateDrillEnum.test.js
const {
  FEATURE_SURFACES,
  ATTENTION_STATE,
  PHASE_GROUP,
  isValidFeatureSurface,
} = require('../../commons/model/featureSurface');

describe('featureSurface: translate-drill', () => {
  test('is a valid surface', () => {
    expect(isValidFeatureSurface('translate-drill')).toBe(true);
    expect(FEATURE_SURFACES).toContain('translate-drill');
  });
  test('has attention-state focused-session', () => {
    expect(ATTENTION_STATE['translate-drill']).toBe('focused-session');
  });
  test('has phase-group production-prompts', () => {
    expect(PHASE_GROUP['translate-drill']).toBe('production-prompts');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/featureSurface/translateDrillEnum.test.js`
Expected: FAIL — `translate-drill` not in `FEATURE_SURFACES`.

- [ ] **Step 3: Add the surface to the enum + both lens maps**

Modify `src/commons/model/featureSurface.js`:

```js
const FEATURE_SURFACES = [
  'reading-microcard',
  'director-session',
  'comprehension',
  'production-prompt',
  'pre-reading-diagnostic',
  'manual-review',
  'mindmap-study',
  'study-forum',
  'translate-drill',     // <-- add
  'backfill',
  'unknown',
];

const ATTENTION_STATE = {
  // ... existing entries unchanged
  'study-forum': 'focused-session',
  'translate-drill': 'focused-session',   // <-- add
  backfill: 'historical',
  unknown: 'historical',
};

const PHASE_GROUP = {
  // ... existing entries unchanged
  'study-forum': 'production-prompts',
  'translate-drill': 'production-prompts', // <-- add
  backfill: 'historical',
  unknown: 'historical',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/featureSurface/translateDrillEnum.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commons/model/featureSurface.js src/__tests__/featureSurface/translateDrillEnum.test.js
git commit -m "feat(featureSurface): add translate-drill enum value"
```

---

### Task 0.2: Define the closed 6-bucket Weakness Bucket enum

**Files:**
- Create: `src/renderer/views/translate/buckets.js`
- Create: `src/__tests__/translate/buckets.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/translate/buckets.test.js
import {
  BUCKETS,
  BUCKET_LABELS,
  BUCKET_COLORS,
  isValidBucket,
} from '../../renderer/views/translate/buckets';

describe('Weakness Buckets', () => {
  test('exactly 6 closed values', () => {
    expect(BUCKETS).toEqual([
      'tense',
      'word-order',
      'article-number',
      'preposition-collocation',
      'connector-cohesion',
      'idiom-register',
    ]);
  });
  test('each bucket has a display label', () => {
    BUCKETS.forEach((b) => {
      expect(BUCKET_LABELS[b]).toBeTruthy();
    });
  });
  test('each bucket has light+dark colors', () => {
    BUCKETS.forEach((b) => {
      expect(BUCKET_COLORS[b].light).toMatch(/^#[0-9A-F]{6}$/i);
      expect(BUCKET_COLORS[b].dark).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
  test('isValidBucket guards', () => {
    expect(isValidBucket('tense')).toBe(true);
    expect(isValidBucket('grammar')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/buckets.test.js`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the enum + colors**

Create `src/renderer/views/translate/buckets.js`:

```js
// Closed-enum weakness taxonomy for Path A and Path B comparisons.
// Order is the display order in the weakness list.
export const BUCKETS = [
  'tense',
  'word-order',
  'article-number',
  'preposition-collocation',
  'connector-cohesion',
  'idiom-register',
];

export const BUCKET_LABELS = {
  tense: 'Tense & Aspect',
  'word-order': 'Word Order',
  'article-number': 'Articles & Number',
  'preposition-collocation': 'Preposition & Collocation',
  'connector-cohesion': 'Connector & Cohesion',
  'idiom-register': 'Idiom & Register',
};

// Per spec §"Color" — light/dark hex pair per bucket.
export const BUCKET_COLORS = {
  tense:                     { light: '#D97706', dark: '#F59E0B' },
  'word-order':              { light: '#7C3AED', dark: '#A78BFA' },
  'article-number':          { light: '#0891B2', dark: '#22D3EE' },
  'preposition-collocation': { light: '#DC2626', dark: '#F87171' },
  'connector-cohesion':      { light: '#059669', dark: '#34D399' },
  'idiom-register':          { light: '#9333EA', dark: '#C084FC' },
};

export const isValidBucket = (b) => BUCKETS.includes(b);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/buckets.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/buckets.js src/__tests__/translate/buckets.test.js
git commit -m "feat(translate): closed 6-bucket weakness taxonomy"
```

---

### Task 0.3: Extend `LanguagePatternExtras` for translate weaknesses

**Files:**
- Modify: `src/commons/model/LearningPointDomains.ts`
- Test: `src/__tests__/learning/languagePatternExtras.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/learning/languagePatternExtras.test.ts
import { emptyExtrasFor, LanguagePatternExtras } from '../../commons/model/LearningPointDomains';

describe('LanguagePatternExtras for translate weaknesses', () => {
  test('accepts translate-weakness fields', () => {
    const extras: LanguagePatternExtras = {
      sourceLang: 'zh-Hans',
      targetLang: 'en-US',
      pattern: 'Existential there-is for stative 有',
      bucket: 'tense',
      learnerAttempt: 'The library has many books on second floor.',
      modelTarget: 'There are many books on the second floor of the library.',
      reason: '有 maps to existential "there are…"',
      hintsUsed: { svo: true, tense: false, vocabulary: false },
    };
    expect(extras.bucket).toBe('tense');
    expect(extras.hintsUsed?.svo).toBe(true);
  });
  test('emptyExtrasFor("language") returns required keys', () => {
    const e = emptyExtrasFor('language');
    expect(e.sourceLang).toBe('');
    expect(e.targetLang).toBe('');
    expect(e.pattern).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/learning/languagePatternExtras.test.ts`
Expected: FAIL — `bucket`, `learnerAttempt`, `modelTarget`, `reason`, `hintsUsed` not on `LanguagePatternExtras`.

- [ ] **Step 3: Extend the interface**

Modify `src/commons/model/LearningPointDomains.ts:130-136`:

```ts
/** Language patterns (grammar / sentence structure), NOT vocab words. */
export interface LanguagePatternExtras {
  sourceLang: string; // BCP-47 (e.g. 'zh-Hans')
  targetLang: string; // BCP-47 (e.g. 'en-US')
  pattern: string; // The grammar/structure rule
  examples?: Array<{ source: string; target: string; note?: string }>;
  commonErrors?: string[];

  // Added 2026-06-30 for Translate Page Path A/B weakness capture.
  // Closed enum — see src/renderer/views/translate/buckets.js.
  bucket?:
    | 'tense'
    | 'word-order'
    | 'article-number'
    | 'preposition-collocation'
    | 'connector-cohesion'
    | 'idiom-register';
  /** The user's English fragment that triggered the weakness. */
  learnerAttempt?: string;
  /** The model's English fragment that the learner's attempt is being compared against. */
  modelTarget?: string;
  /** 1-2 sentence AI explanation of why the model phrasing is stronger. */
  reason?: string;
  /** Which Path A scaffold buttons the user revealed before composing. */
  hintsUsed?: { svo?: boolean; tense?: boolean; vocabulary?: boolean };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/learning/languagePatternExtras.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commons/model/LearningPointDomains.ts src/__tests__/learning/languagePatternExtras.test.ts
git commit -m "feat(LearningPointDomains): extend LanguagePatternExtras for translate weaknesses"
```

---

### Task 0.4: Extend `<DiffSpan>` with optional `bucket` prop

**Files:**
- Modify: `src/renderer/views/writing/DiffSpan.js`
- Test: `src/__tests__/writing/diffSpanBucket.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/writing/diffSpanBucket.test.jsx
import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import DiffSpan from '../../renderer/views/writing/DiffSpan';

const theme = createTheme({ palette: { mode: 'light' } });

function wrap(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('DiffSpan bucket extension', () => {
  test('renders without bucket using existing kind colors (backwards compat)', () => {
    const { container } = wrap(
      <DiffSpan kind="weaker" pairId="p1" hoveredPairId={null} onHoverPair={() => {}}>
        test
      </DiffSpan>,
    );
    const span = container.querySelector('span');
    // weaker → light orange tint
    expect(span.getAttribute('style')).toMatch(/rgb\(230, 81, 0\)|#E65100/i);
  });
  test('renders with bucket="tense" using tense color override', () => {
    const { container } = wrap(
      <DiffSpan
        kind="weaker"
        bucket="tense"
        pairId="p1"
        hoveredPairId={null}
        onHoverPair={() => {}}
      >
        test
      </DiffSpan>,
    );
    const span = container.querySelector('span');
    // tense light = #D97706
    expect(span.getAttribute('style')).toMatch(/rgb\(217, 119, 6\)|#D97706/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/writing/diffSpanBucket.test.jsx`
Expected: FAIL — bucket prop is ignored, both renders use weaker color.

- [ ] **Step 3: Extend DiffSpan**

Modify `src/renderer/views/writing/DiffSpan.js`:

```js
import React from 'react';
import { Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { DIFF_COLORS } from './config';
import { BUCKET_COLORS } from '../translate/buckets';

function colorFor(kind, bucket, mode) {
  if (bucket && BUCKET_COLORS[bucket]) return BUCKET_COLORS[bucket][mode];
  if (kind === 'grammar') return DIFF_COLORS.grammar[mode];
  if (kind === 'weaker' || kind === 'stronger') return DIFF_COLORS.weaker[mode];
  return DIFF_COLORS.match[mode];
}

function DiffSpan({ kind, bucket, pairId, hoveredPairId, onHoverPair, children }) {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';
  const color = colorFor(kind, bucket, mode);
  const isPaired = pairId && hoveredPairId === pairId;

  let styles;
  if (kind === 'grammar') {
    styles = {
      textDecoration: 'underline',
      textDecorationStyle: 'wavy',
      textDecorationColor: alpha(color, 0.7),
      padding: '0 2px',
    };
  } else if (kind === 'match') {
    styles = {
      borderBottom: `1.5px solid ${alpha(color, 0.6)}`,
    };
  } else {
    styles = {
      backgroundColor: isPaired ? alpha(color, 0.25) : alpha(color, 0.12),
      borderRadius: '3px',
      padding: '0 4px',
      transition: 'background-color 150ms ease-out',
    };
  }

  return (
    <Box
      component="span"
      onMouseEnter={() => pairId && onHoverPair && onHoverPair(pairId)}
      onMouseLeave={() => pairId && onHoverPair && onHoverPair(null)}
      sx={styles}
    >
      {children}
    </Box>
  );
}

export default DiffSpan;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/writing/diffSpanBucket.test.jsx`
Expected: PASS (2 tests).

Also run existing Writing-Practice tests to confirm no regression:

Run: `npx jest src/__tests__/renderer/writing 2>/dev/null || npx jest src/renderer/views/writing -i`
Expected: PASS (existing tests untouched).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/writing/DiffSpan.js src/__tests__/writing/diffSpanBucket.test.jsx
git commit -m "feat(DiffSpan): optional bucket prop overrides kind colors"
```

---

### Task 0.5: Extend `<SourcePanel>` with optional `label` + `placeholder` props

**Files:**
- Modify: `src/renderer/views/writing/SourcePanel.js`
- Test: `src/__tests__/writing/sourcePanelProps.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/writing/sourcePanelProps.test.jsx
import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SourcePanel from '../../renderer/views/writing/SourcePanel';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('SourcePanel props extension', () => {
  test('defaults to "SOURCE PARAGRAPH" label (backwards compat)', () => {
    const { getByText } = wrap(
      <SourcePanel text="" onTextChange={() => {}} sourceLocked={false} accent="#0E8A8A" />,
    );
    expect(getByText('SOURCE PARAGRAPH')).toBeTruthy();
  });
  test('uses custom label when provided', () => {
    const { getByText } = wrap(
      <SourcePanel
        text=""
        onTextChange={() => {}}
        sourceLocked={false}
        accent="#0E8A8A"
        label="中文段落"
      />,
    );
    expect(getByText('中文段落')).toBeTruthy();
  });
  test('uses custom placeholder when provided', () => {
    const { container } = wrap(
      <SourcePanel
        text=""
        onTextChange={() => {}}
        sourceLocked={false}
        accent="#0E8A8A"
        placeholder="请粘贴一段中文..."
      />,
    );
    // MultilineTextField renders the placeholder somewhere in the DOM
    expect(container.textContent).toMatch(/请粘贴一段中文/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/writing/sourcePanelProps.test.jsx`
Expected: FAIL — label is always "SOURCE PARAGRAPH"; placeholder ignored.

- [ ] **Step 3: Add the optional props**

Modify `src/renderer/views/writing/SourcePanel.js`:

```js
function SourcePanel({
  text,
  onTextChange,
  sourceLocked,
  onLock,
  onUnlock,
  accent,
  label = 'SOURCE PARAGRAPH',
  placeholder = 'Paste a paragraph you want to learn from. The model text is the anchor for the next two phases.',
}) {
  // ...
  // Replace hardcoded label at line ~81:
  //   SOURCE PARAGRAPH  →  {label}
  // Replace `const placeholder = '...'` declaration at line ~30 — delete it
  // (the prop now shadows).
```

Apply both substitutions in the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/writing/sourcePanelProps.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/writing/SourcePanel.js src/__tests__/writing/sourcePanelProps.test.jsx
git commit -m "feat(SourcePanel): optional label and placeholder props"
```

---

### Task 0.6: Add level + history accessors to `customStorage`

**Files:**
- Modify: `src/renderer/store/customStorage.js`
- Test: `src/__tests__/translate/customStorageTranslate.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/translate/customStorageTranslate.test.js
import customStorage from '../../renderer/store/customStorage';

// Minimal ipcRenderer mock — store value in-memory.
const _store = {};
window.electron = {
  ipcRenderer: {
    getStoreValue: (k) => _store[k] ?? null,
    setStoreValue: (k, v) => { _store[k] = v; },
  },
};

describe('customStorage translate helpers', () => {
  beforeEach(() => { Object.keys(_store).forEach((k) => delete _store[k]); });

  test('translateLevel default is "A"', () => {
    expect(customStorage.getTranslateLevel()).toBe('A');
  });
  test('translateLevel persists', () => {
    customStorage.setTranslateLevel('B');
    expect(customStorage.getTranslateLevel()).toBe('B');
  });
  test('translateHistory empty default', () => {
    expect(customStorage.getTranslateHistory()).toEqual([]);
  });
  test('appendTranslateHistory pushes newest-first, caps at 30', () => {
    for (let i = 0; i < 35; i += 1) {
      customStorage.appendTranslateHistory({
        id: `id-${i}`,
        sourceText: `text ${i}`,
        level: 'A',
        sourceLanguage: 'Chinese',
        timestamp: i,
      });
    }
    const h = customStorage.getTranslateHistory();
    expect(h).toHaveLength(30);
    expect(h[0].id).toBe('id-34');  // newest first
    expect(h[29].id).toBe('id-5');  // oldest kept
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/customStorageTranslate.test.js`
Expected: FAIL — helpers don't exist.

- [ ] **Step 3: Add the helpers**

Append to `src/renderer/store/customStorage.js` (before the final `}` closing the class):

```js
  // ===== Translate page (2026-06-30 redesign) =====

  static getTranslateLevel() {
    const v = window.electron.ipcRenderer.getStoreValue('translate.level');
    return v === 'A' || v === 'B' || v === 'C' ? v : 'A';
  }

  static setTranslateLevel(level) {
    if (level !== 'A' && level !== 'B' && level !== 'C') return;
    window.electron.ipcRenderer.setStoreValue('translate.level', level);
  }

  static getTranslateHistory() {
    const v = window.electron.ipcRenderer.getStoreValue('translate.history');
    if (!v) return [];
    try {
      const parsed = typeof v === 'string' ? JSON.parse(v) : v;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static appendTranslateHistory(entry) {
    const list = customStorage.getTranslateHistory();
    const next = [entry, ...list].slice(0, 30);
    window.electron.ipcRenderer.setStoreValue(
      'translate.history',
      JSON.stringify(next),
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/customStorageTranslate.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/store/customStorage.js src/__tests__/translate/customStorageTranslate.test.js
git commit -m "feat(customStorage): translate level + history accessors"
```

---

## Phase 1 — IPC + api client for single Learning Point creation

### Task 1.1: Add `learning-point-create` IPC handler

**Files:**
- Modify: `src/main/ipc/learningPlanHandlers.js`
- Test: `src/__tests__/main/learningPointCreateIpc.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/main/learningPointCreateIpc.test.js
// Mock LearningPointService.add — we're just testing the IPC handler shape.
jest.mock('../../main/utils/LearningPointService', () => ({
  add: jest.fn(async (input) => ({ id: 'lp-mock', ...input })),
}));

const LearningPointService = require('../../main/utils/LearningPointService');
const { ipcMain } = require('electron');
const { registerLearningPlanHandlers } = require('../../main/ipc/learningPlanHandlers');

describe('learning-point-create IPC', () => {
  let handlers;
  beforeAll(() => {
    handlers = {};
    ipcMain.handle = jest.fn((name, fn) => { handlers[name] = fn; });
    registerLearningPlanHandlers({});  // pass empty deps; handler in question doesn't need them
  });
  test('handler exists', () => {
    expect(handlers['learning-point-create']).toBeDefined();
  });
  test('handler creates a learning point with extras', async () => {
    const result = await handlers['learning-point-create'](null, {
      domain: 'language',
      content: '有 → there are',
      extras: {
        sourceLang: 'zh-Hans',
        targetLang: 'en-US',
        pattern: 'Existential there-is for stative 有',
        bucket: 'tense',
        learnerAttempt: 'The library has',
        modelTarget: 'There are',
        reason: 'Stative 有 idiomatically uses existential there-is.',
        hintsUsed: { svo: true },
      },
    });
    expect(LearningPointService.add).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('lp-mock');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/main/learningPointCreateIpc.test.js`
Expected: FAIL — `learning-point-create` handler not registered.

- [ ] **Step 3: Add the handler**

Inside the `registerLearningPlanHandlers` function in `src/main/ipc/learningPlanHandlers.js`, add (alongside existing `ipcMain.handle('learning-point-import-file', ...)`):

```js
  ipcMain.handle('learning-point-create', async (event, params) => {
    // Single ad-hoc Learning Point creation. Used by Translate Path A/B
    // weakness-save buttons and by future surfaces that need ONE LP, not
    // a bulk import.
    const LearningPointService = require('../utils/LearningPointService');
    const { domain, content, extras, featureSurface } = params || {};
    return LearningPointService.add({
      domainType: domain || 'language',
      content,
      extras: extras || {},
      featureSurface: featureSurface || 'translate-drill',
    });
  });
```

If `registerLearningPlanHandlers` isn't already exported, export it. If the file uses inline handler registration at module load, add the handler to that block instead — match the file's existing style.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/main/learningPointCreateIpc.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/learningPlanHandlers.js src/__tests__/main/learningPointCreateIpc.test.js
git commit -m "feat(ipc): learning-point-create single-LP handler"
```

---

### Task 1.2: Add `learningPointApi.create` renderer client

**Files:**
- Create: `src/renderer/api/learningPointApi.js`
- Test: `src/__tests__/translate/learningPointApi.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/translate/learningPointApi.test.js
import learningPointApi from '../../renderer/api/learningPointApi';

const invoke = jest.fn(async () => ({ id: 'lp-x' }));
window.electron = { ipcRenderer: { invoke } };

describe('learningPointApi.create', () => {
  test('routes to learning-point-create with payload', async () => {
    const result = await learningPointApi.create({
      domain: 'language',
      content: 'pattern: existential there-is',
      extras: { bucket: 'tense' },
    });
    expect(invoke).toHaveBeenCalledWith('learning-point-create', expect.objectContaining({
      domain: 'language',
      content: 'pattern: existential there-is',
      extras: { bucket: 'tense' },
    }));
    expect(result.id).toBe('lp-x');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/learningPointApi.test.js`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create the client**

Create `src/renderer/api/learningPointApi.js`:

```js
const { ipcRenderer } = window.electron || {};

const learningPointApi = {
  /**
   * Create a single ad-hoc Learning Point. Used by Translate Path A/B
   * weakness-save buttons.
   *
   * @param {Object} payload
   * @param {string} payload.domain          - LearningDomain (e.g. 'language')
   * @param {string} payload.content         - Short canonical content (the pattern / rule / target phrase)
   * @param {Object} payload.extras          - Domain-specific extras (LanguagePatternExtras for 'language')
   * @param {string} [payload.featureSurface] - Defaults to 'translate-drill'
   * @returns {Promise<{id: string}>}
   */
  async create(payload) {
    return ipcRenderer.invoke('learning-point-create', payload);
  },
};

export default learningPointApi;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/learningPointApi.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/api/learningPointApi.js src/__tests__/translate/learningPointApi.test.js
git commit -m "feat(api): learningPointApi.create renderer client"
```

---

## Phase 2 — New AI prompts (Spine intents)

### Task 2.1: Add four new prompt functions to `AIPrompts.js`

**Files:**
- Modify: `src/commons/utils/AIPrompts.js`
- Test: `src/__tests__/translate/translatePrompts.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/translate/translatePrompts.test.js
import {
  getSvoHintPrompt,
  getTenseHintPrompt,
  getTranslateComparePrompt,
  getTranslateParagraphComparePrompt,
} from '../../commons/utils/AIPrompts';

describe('Translate prompt functions', () => {
  test('getSvoHintPrompt embeds source', () => {
    const p = getSvoHintPrompt('图书馆的二楼有很多书', 'Chinese');
    expect(p).toMatch(/图书馆的二楼有很多书/);
    expect(p).toMatch(/subject/i);
    expect(p).toMatch(/verb/i);
    expect(p).toMatch(/object/i);
  });
  test('getTenseHintPrompt embeds source + asks for tense', () => {
    const p = getTenseHintPrompt('他昨天去了图书馆', 'Chinese');
    expect(p).toMatch(/他昨天去了图书馆/);
    expect(p).toMatch(/tense/i);
    expect(p).toMatch(/justification/i);
  });
  test('getTranslateComparePrompt embeds source + attempt + 6 buckets', () => {
    const p = getTranslateComparePrompt(
      '图书馆的二楼有很多书',
      'The library has books on second floor',
      'Chinese',
    );
    expect(p).toMatch(/图书馆的二楼有很多书/);
    expect(p).toMatch(/The library has books on second floor/);
    ['tense', 'word-order', 'article-number', 'preposition-collocation', 'connector-cohesion', 'idiom-register'].forEach((b) => {
      expect(p).toMatch(new RegExp(b));
    });
    expect(p).toMatch(/stepBreakdown/);  // includes the 5-step block
  });
  test('getTranslateParagraphComparePrompt embeds source paragraph + sentence-level', () => {
    const p = getTranslateParagraphComparePrompt('图书馆。二楼有书。', 'Library. There are books.', 'Chinese');
    expect(p).toMatch(/sentenceComparisons/);
    expect(p).toMatch(/paragraph/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/translatePrompts.test.js`
Expected: FAIL — none of the functions exist.

- [ ] **Step 3: Add the prompts**

Append to `src/commons/utils/AIPrompts.js` (before the final `module.exports`):

```js
// === Translate Page Redesign (2026-06-30) ===

const getSvoHintPrompt = (sentence, language) => `
You are a language expert helping a learner translate from ${language} to English.

Identify the subject, verb, and object of the ${language} sentence below. If the sentence has multiple sub-clauses, return only the MAIN clause's SVO.

Return ONLY a JSON object with this shape:
{
  "subject": { "source": "<the ${language} subject>", "english": "<idiomatic English translation>" },
  "verb":    { "source": "<the ${language} verb>",    "english": "<idiomatic English verb phrase>" },
  "object":  { "source": "<the ${language} object>",  "english": "<idiomatic English object>" }
}

If a slot is implied but not explicit in the source (common in ${language}), still fill the English with the implied form.

Sentence: ${sentence}
`;

const getTenseHintPrompt = (sentence, language) => `
You are a language expert helping a ${language}-native speaker translate to English.

The ${language} sentence below does not mark tense morphologically. Decide what English tense fits the scene the sentence describes.

Return ONLY a JSON object:
{
  "tense": "<one of: simple-present, present-continuous, present-perfect, present-perfect-continuous, simple-past, past-continuous, past-perfect, past-perfect-continuous, simple-future, future-continuous, future-perfect, conditional>",
  "justification": "<one sentence explaining which clue in the ${language} sentence points to this tense — usually an aspect marker (了/着/过), an adverb of time, or the discourse context>"
}

Sentence: ${sentence}
`;

const getTranslateComparePrompt = (sentence, attempt, language) => `
You are a translation tutor. Compare the LEARNER's English attempt against a high-quality model translation of the ${language} sentence below.

For each WEAKNESS in the learner's English, label it with ONE of these six closed buckets:
- "tense" — wrong tense or aspect mapping (especially of ${language} aspect markers like 了/着/过)
- "word-order" — element in wrong English slot (time/place adverbials, S-V-O position, attributive clause placement)
- "article-number" — missing/wrong a/an/the, missing plural -s
- "preposition-collocation" — wrong preposition or weak verb-noun pairing
- "connector-cohesion" — missing because/although/while etc. that ${language} parataxis often omits
- "idiom-register" — word-for-word translation of an idiom, or register mismatch

Also produce the 5-step pedagogical breakdown of how the MODEL English was built (same shape as the existing translate prompt).

Return ONLY a JSON object:
{
  "modelEnglish": "<the model translation>",
  "spans": [
    {
      "side": "learner" | "model",
      "text": "<exact substring of side's text>",
      "bucket": "tense" | "word-order" | "article-number" | "preposition-collocation" | "connector-cohesion" | "idiom-register",
      "kind": "weaker",
      "pair_id": "<string, links learner side to model side for hover-pairing>",
      "reason": "<1-2 sentences explaining why the model phrasing is stronger; phrase as advice the learner can apply>"
    }
  ],
  "stepBreakdown": {
    "step-1": { "title": "...", "sub-verb-obj-list": [...], "explain": "..." },
    "step-2": { "title": "...", "input-verb-list": [...], "explain": "..." },
    "step-3": { "title": "...", "scaffold-options": [...], "best-scaffold": "...", "explain": "..." },
    "step-4": { "title": "...", "sentence-structure": "...", "explain": "..." },
    "step-5": { "title": "...", "output": "<the model English>", "explain": "..." }
  }
}

${language} sentence: ${sentence}
Learner's English: ${attempt}
`;

const getTranslateParagraphComparePrompt = (paragraph, attempt, language) => `
You are a translation tutor. Compare the LEARNER's English paragraph against a model translation of the ${language} paragraph below.

Label weaknesses against the SAME 6-bucket taxonomy as the sentence-level prompt:
- "tense", "word-order", "article-number", "preposition-collocation", "connector-cohesion", "idiom-register"

At paragraph scale, give EXTRA weight to:
- "connector-cohesion" (${language} parataxis often drops connectors English requires)
- "idiom-register" (style consistency across sentences)
- paragraph-level "word-order" (information flow, topic-comment shifts)

Group weaknesses by sentence so the UI can render side-by-side per sentence.

Return ONLY a JSON object:
{
  "modelEnglish": "<the model translation paragraph>",
  "spans": [ /* same span shape as sentence-level */ ],
  "sentenceComparisons": [
    {
      "sentenceIndex": <0-based>,
      "originalSentence": "<the ${language} sentence>",
      "modelSentence": "<the model English sentence>",
      "learnerSentence": "<the learner's English sentence>",
      "notes": [
        { "pair_id": "<links to spans>", "learner_phrase": "...", "model_phrase": "...", "explanation": "..." }
      ]
    }
  ]
}

${language} paragraph: ${paragraph}
Learner's English: ${attempt}
`;

module.exports.getSvoHintPrompt = getSvoHintPrompt;
module.exports.getTenseHintPrompt = getTenseHintPrompt;
module.exports.getTranslateComparePrompt = getTranslateComparePrompt;
module.exports.getTranslateParagraphComparePrompt = getTranslateParagraphComparePrompt;
```

Also add to the existing `module.exports = { ... }` block at the bottom of the file, in the same style as the existing exports.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/translatePrompts.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commons/utils/AIPrompts.js src/__tests__/translate/translatePrompts.test.js
git commit -m "feat(AIPrompts): 4 prompts for translate redesign (svo/tense/compare/paragraph)"
```

---

## Phase 3 — Path C (build first — smallest blast radius, validates shell)

### Task 3.1: Create `ModelBuildPanel.jsx` wrapping the existing 5 step cards

**Files:**
- Create: `src/renderer/views/translate/ModelBuildPanel.jsx`
- Test: `src/__tests__/translate/modelBuildPanel.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/modelBuildPanel.test.jsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ModelBuildPanel from '../../renderer/views/translate/ModelBuildPanel';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const sampleSteps = {
  'step-1': { title: 'SVO', 'sub-verb-obj-list': [{ subject: { input: 'a', english: 'A' }, verb: { input: 'b', english: ['B'] }, object: { input: 'c', english: 'C' } }], explain: 'e1' },
  'step-2': { title: 'Verbs', 'input-verb-list': [{ 'input-verb': 'b', 'english-verb-options': ['B'] }], explain: 'e2' },
  'step-3': { title: 'Scaffold', 'scaffold-options': ['x', 'y'], 'best-scaffold': 'x', explain: 'e3' },
  'step-4': { title: 'Structure', 'sentence-structure': 'simple', explain: 'e4' },
  'step-5': { title: 'Final', output: 'A B C', explain: 'e5' },
};

describe('ModelBuildPanel', () => {
  test('renders all 5 cards at once (no setInterval)', () => {
    const { getByText } = wrap(
      <ModelBuildPanel steps={sampleSteps} originalTokens={[]} language="Chinese" />,
    );
    expect(getByText('SVO')).toBeTruthy();
    expect(getByText('Verbs')).toBeTruthy();
    expect(getByText('Scaffold')).toBeTruthy();
    expect(getByText('Structure')).toBeTruthy();
    expect(getByText('Final')).toBeTruthy();
  });
  test('calls onDemote(stepNumber) when "try this step yourself" link clicked', () => {
    const onDemote = jest.fn();
    const { getAllByText } = wrap(
      <ModelBuildPanel steps={sampleSteps} originalTokens={[]} language="Chinese" onDemote={onDemote} />,
    );
    const links = getAllByText(/try this step yourself/i);
    expect(links.length).toBe(5);
    fireEvent.click(links[0]);
    expect(onDemote).toHaveBeenCalledWith(1);
    fireEvent.click(links[2]);
    expect(onDemote).toHaveBeenCalledWith(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/modelBuildPanel.test.jsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/renderer/views/translate/ModelBuildPanel.jsx`:

```jsx
import React from 'react';
import { Box, Typography, Link } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import StepOneSVOCard from './StepOneSVOCard';
import StepTwoVerbCard from './StepTwoVerbCard';
import StepThreeSentenceStructureCard from './StepThreeSentenceStructureCard';
import StepFourSentenceScaffoldCard from './StepFourSentenceScaffoldCard';
import StepFiveFinalCard from './StepFiveFinalCard';

const StepWrap = ({ index, onDemote, children }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: theme.palette.background.paper,
        p: 2,
        mb: 1.5,
      }}
    >
      {children}
      {onDemote && (
        <Box sx={{ mt: 1.5, textAlign: 'right' }}>
          <Link
            component="button"
            type="button"
            onClick={() => onDemote(index)}
            sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}
          >
            try this step yourself →
          </Link>
        </Box>
      )}
    </Box>
  );
};

function ModelBuildPanel({ steps, originalTokens, language, onDemote }) {
  if (!steps) return null;
  return (
    <Box>
      <StepWrap index={1} onDemote={onDemote}>
        <StepOneSVOCard
          originalTokens={originalTokens || []}
          title={steps['step-1'].title}
          subVerbObjList={steps['step-1']['sub-verb-obj-list']}
          explain={steps['step-1'].explain}
        />
      </StepWrap>
      <StepWrap index={2} onDemote={onDemote}>
        <StepTwoVerbCard
          language={language}
          originalTokens={originalTokens || []}
          title={steps['step-2'].title}
          inputVerbList={steps['step-2']['input-verb-list']}
          explain={steps['step-2'].explain}
        />
      </StepWrap>
      <StepWrap index={3} onDemote={onDemote}>
        <StepFourSentenceScaffoldCard
          title={steps['step-3'].title}
          scaffoldOptions={steps['step-3']['scaffold-options']}
          explain={steps['step-3'].explain}
        />
      </StepWrap>
      <StepWrap index={4} onDemote={onDemote}>
        <StepThreeSentenceStructureCard
          title={steps['step-4'].title}
          sentenceStructure={steps['step-4']['sentence-structure']}
          explain={steps['step-4'].explain}
        />
      </StepWrap>
      <StepWrap index={5} onDemote={onDemote}>
        <StepFiveFinalCard
          title={steps['step-5'].title}
          output={steps['step-5'].output}
          explain={steps['step-5'].explain}
        />
      </StepWrap>
    </Box>
  );
}

export default ModelBuildPanel;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/modelBuildPanel.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/ModelBuildPanel.jsx src/__tests__/translate/modelBuildPanel.test.jsx
git commit -m "feat(translate): ModelBuildPanel wraps 5 step cards, supports demote-to-A"
```

---

### Task 3.2: Create `PathCLookupView.jsx`

**Files:**
- Create: `src/renderer/views/translate/PathCLookupView.jsx`
- Test: `src/__tests__/translate/pathC-demote.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/pathC-demote.test.jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PathCLookupView from '../../renderer/views/translate/PathCLookupView';

// Mock spineApi so we don't hit IPC
jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(async (prompt, schema, opts) => {
      if (opts.label === 'translate-quick') {
        return {
          'step-1': { title: 'SVO', 'sub-verb-obj-list': [], explain: '' },
          'step-2': { title: 'Verbs', 'input-verb-list': [], explain: '' },
          'step-3': { title: 'Scaffold', 'scaffold-options': [], 'best-scaffold': '', explain: '' },
          'step-4': { title: 'Structure', 'sentence-structure': '', explain: '' },
          'step-5': { title: 'Final', output: 'There are books.', explain: '' },
        };
      }
      return null;
    }),
  },
}));

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('PathCLookupView', () => {
  test('renders headline result at top after submit', async () => {
    const onSubmit = jest.fn();
    const onDemote = jest.fn();
    const { getByText, getByTestId } = wrap(
      <PathCLookupView
        source="图书馆的二楼有很多书"
        language="Chinese"
        onDemote={onDemote}
      />,
    );
    // Auto-submits on mount when source is non-empty.
    await waitFor(() => {
      expect(getByTestId('path-c-headline').textContent).toContain('There are books.');
    });
  });
  test('demote link from step 3 calls onDemote(3)', async () => {
    const onDemote = jest.fn();
    const { findAllByText } = wrap(
      <PathCLookupView source="图书馆的二楼有很多书" language="Chinese" onDemote={onDemote} />,
    );
    const links = await findAllByText(/try this step yourself/i);
    fireEvent.click(links[2]);  // step 3
    expect(onDemote).toHaveBeenCalledWith(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/pathC-demote.test.jsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/renderer/views/translate/PathCLookupView.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import spineApi from '../../api/spineApi';
import { getTranslatePrompt, getNLPAnnotationPrompt } from '../../../commons/utils/AIPrompts';
import { getTokenAndDependencies } from './DependencyUtil';
import DependencyTree from './DependencyTree';
import ModelBuildPanel from './ModelBuildPanel';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;

function PathCLookupView({ source, language, onDemote }) {
  const theme = useTheme();
  const [steps, setSteps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDep, setShowDep] = useState(false);
  const [depTokens, setDepTokens] = useState([]);
  const [depEdges, setDepEdges] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!source || source.trim().length === 0) return;
      setLoading(true);
      try {
        const result = await spineApi.generateContentWithJson(
          getTranslatePrompt(source.trim(), language),
          null,
          { label: 'translate-quick' },
        );
        if (!cancelled) setSteps(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [source, language]);

  const fetchDepTree = async () => {
    if (depTokens.length > 0 || !steps?.['step-5']?.output) return;
    const ann = await spineApi.generateContentWithJson(
      getNLPAnnotationPrompt(steps['step-5'].output),
      null,
      { label: 'translate-quick-nlp' },
    );
    if (ann) {
      const { t, d } = getTokenAndDependencies(ann);
      setDepTokens(t);
      setDepEdges(d);
    }
  };

  const headline = steps?.['step-5']?.output;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {loading && !headline && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Translating…
        </Typography>
      )}
      {headline && (
        <Box
          sx={{
            p: 3,
            mb: 3,
            borderRadius: '14px',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          }}
        >
          <Typography
            data-testid="path-c-headline"
            sx={{ fontFamily: SERIF, fontSize: '22px', lineHeight: 1.5, color: theme.palette.text.primary }}
          >
            {headline}
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Tooltip title="Copy">
              <IconButton size="small" onClick={() => navigator.clipboard?.writeText(headline)}>
                <ContentCopyIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Chip
              icon={<AccountTreeIcon sx={{ fontSize: 16 }} />}
              label={showDep ? 'Hide parse tree' : 'Parse tree'}
              size="small"
              onClick={() => {
                if (!showDep) fetchDepTree();
                setShowDep(!showDep);
              }}
            />
          </Box>
        </Box>
      )}
      {showDep && depTokens.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2, pb: 4, overflowX: 'auto' }}>
          <DependencyTree tokens={depTokens} dependencies={depEdges} />
        </Box>
      )}
      {steps && (
        <ModelBuildPanel
          steps={steps}
          originalTokens={[]}
          language={language}
          onDemote={onDemote}
        />
      )}
    </Box>
  );
}

export default PathCLookupView;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/pathC-demote.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/PathCLookupView.jsx src/__tests__/translate/pathC-demote.test.jsx
git commit -m "feat(translate): PathCLookupView — headline at top, no setInterval, demote link"
```

---

## Phase 4 — Shared shell

### Task 4.1: Create `LevelSelector.jsx`

**Files:**
- Create: `src/renderer/views/translate/LevelSelector.jsx`
- Test: `src/__tests__/translate/levelSelector.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/levelSelector.test.jsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LevelSelector from '../../renderer/views/translate/LevelSelector';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('LevelSelector', () => {
  test('renders three radios A/B/C with labels', () => {
    const { getByLabelText } = wrap(<LevelSelector level="A" onChange={() => {}} />);
    expect(getByLabelText(/A · Drill/)).toBeTruthy();
    expect(getByLabelText(/B · Paragraph/)).toBeTruthy();
    expect(getByLabelText(/C · Lookup/)).toBeTruthy();
  });
  test('calls onChange with new level when clicked', () => {
    const onChange = jest.fn();
    const { getByLabelText } = wrap(<LevelSelector level="A" onChange={onChange} />);
    fireEvent.click(getByLabelText(/B · Paragraph/));
    expect(onChange).toHaveBeenCalledWith('B');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/levelSelector.test.jsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/renderer/views/translate/LevelSelector.jsx`:

```jsx
import React from 'react';
import { Box, Typography, Radio, RadioGroup, FormControlLabel } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

const LEVELS = [
  { id: 'A', label: 'A · Drill', subtitle: 'Short sentence — attempt + compare' },
  { id: 'B', label: 'B · Paragraph', subtitle: 'Paragraph compose-and-compare' },
  { id: 'C', label: 'C · Lookup', subtitle: 'Show the answer + breakdown' },
];

function LevelSelector({ level, onChange }) {
  const theme = useTheme();
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: theme.palette.text.disabled,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'block',
          mb: 1,
        }}
      >
        Level
      </Typography>
      <RadioGroup
        value={level}
        onChange={(e) => onChange(e.target.value)}
        sx={{ gap: 0.5 }}
      >
        {LEVELS.map((opt) => (
          <FormControlLabel
            key={opt.id}
            value={opt.id}
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{opt.label}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary }}>
                  {opt.subtitle}
                </Typography>
              </Box>
            }
            sx={{
              m: 0,
              p: 0.5,
              borderRadius: 1,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
            }}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}

export default LevelSelector;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/levelSelector.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/LevelSelector.jsx src/__tests__/translate/levelSelector.test.jsx
git commit -m "feat(translate): LevelSelector sidebar radio group"
```

---

### Task 4.2: Create `TranslateHistoryList.jsx`

**Files:**
- Create: `src/renderer/views/translate/TranslateHistoryList.jsx`
- Test: `src/__tests__/translate/history.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/history.test.jsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TranslateHistoryList from '../../renderer/views/translate/TranslateHistoryList';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('TranslateHistoryList', () => {
  test('renders entries with truncated source text', () => {
    const entries = [
      { id: '1', sourceText: '图书馆的二楼有很多书', level: 'A', sourceLanguage: 'Chinese', timestamp: 1 },
      { id: '2', sourceText: '他昨天去了图书馆', level: 'C', sourceLanguage: 'Chinese', timestamp: 2 },
    ];
    const { getByText } = wrap(<TranslateHistoryList entries={entries} onSelect={() => {}} />);
    expect(getByText(/图书馆的二楼有很多书/)).toBeTruthy();
    expect(getByText(/他昨天去了图书馆/)).toBeTruthy();
  });
  test('calls onSelect with the clicked entry', () => {
    const entries = [
      { id: '1', sourceText: 'hello', level: 'A', sourceLanguage: 'Chinese', timestamp: 1 },
    ];
    const onSelect = jest.fn();
    const { getByText } = wrap(<TranslateHistoryList entries={entries} onSelect={onSelect} />);
    fireEvent.click(getByText('hello'));
    expect(onSelect).toHaveBeenCalledWith(entries[0]);
  });
  test('empty list shows "No recent translations"', () => {
    const { getByText } = wrap(<TranslateHistoryList entries={[]} onSelect={() => {}} />);
    expect(getByText(/no recent translations/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/history.test.jsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/renderer/views/translate/TranslateHistoryList.jsx`:

```jsx
import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';

function TranslateHistoryList({ entries, onSelect }) {
  const theme = useTheme();
  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      <Typography
        variant="caption"
        sx={{
          color: theme.palette.text.disabled,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'block',
          mb: 1,
          px: 0.5,
        }}
      >
        <HistoryIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
        Recent
      </Typography>
      {(!entries || entries.length === 0) ? (
        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ px: 0.5, fontSize: '0.8rem' }}
        >
          No recent translations
        </Typography>
      ) : (
        entries.map((item) => (
          <Box
            key={item.id}
            onClick={() => onSelect(item)}
            sx={{
              p: 1,
              mb: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
            }}
          >
            <Chip
              label={item.level}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
            />
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.8rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {item.sourceText}
            </Typography>
          </Box>
        ))
      )}
    </Box>
  );
}

export default TranslateHistoryList;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/history.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/TranslateHistoryList.jsx src/__tests__/translate/history.test.jsx
git commit -m "feat(translate): TranslateHistoryList sidebar component"
```

---

### Task 4.3: Create `TranslateShell.jsx` with Path C wired

**Files:**
- Create: `src/renderer/views/translate/TranslateShell.jsx`
- Modify: `src/renderer/views/translate/index.js`
- Test: `src/__tests__/translate/translateShell.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/translateShell.test.jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TranslateShell from '../../renderer/views/translate/TranslateShell';

// Mock customStorage so we don't hit ipcRenderer
const _store = {};
jest.mock('../../renderer/store/customStorage', () => ({
  __esModule: true,
  default: {
    getTranslateLevel: () => _store.level || 'A',
    setTranslateLevel: (l) => { _store.level = l; },
    getTranslateHistory: () => _store.history || [],
    appendTranslateHistory: (e) => { _store.history = [e, ...(_store.history || [])].slice(0, 30); },
  },
}));

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: { generateContentWithJson: jest.fn(async () => null) },
}));

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('TranslateShell', () => {
  beforeEach(() => { Object.keys(_store).forEach((k) => delete _store[k]); });

  test('defaults to level A on first mount', () => {
    const { getByLabelText } = wrap(<TranslateShell />);
    const aRadio = getByLabelText(/A · Drill/);
    expect(aRadio.checked).toBe(true);
  });
  test('level change persists', () => {
    const { getByLabelText } = wrap(<TranslateShell />);
    fireEvent.click(getByLabelText(/C · Lookup/));
    expect(_store.level).toBe('C');
  });
  test('submit appends to history', async () => {
    const { getByLabelText, getByRole } = wrap(<TranslateShell />);
    const textarea = getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '图书馆有书' } });
    const sendBtn = getByLabelText(/Translate/i);
    fireEvent.click(sendBtn);
    await waitFor(() => {
      expect(_store.history?.length).toBe(1);
      expect(_store.history[0].sourceText).toBe('图书馆有书');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/translateShell.test.jsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/renderer/views/translate/TranslateShell.jsx`:

```jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Tooltip, Snackbar, Alert,
} from '@mui/material';
import { useTheme, alpha, styled } from '@mui/material/styles';
import { v4 as uuid } from 'uuid';
import SendIcon from '@mui/icons-material/Send';
import TranslateIcon from '@mui/icons-material/Translate';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

import customStorage from '../../store/customStorage';
import { LanguageModel } from '../../../commons/model/DataTypes';
import LevelSelector from './LevelSelector';
import TranslateHistoryList from './TranslateHistoryList';
import PathADrillView from './PathADrillView';
import PathBParagraphView from './PathBParagraphView';
import PathCLookupView from './PathCLookupView';

const SendButton = styled(IconButton)(({ theme, disabled }) => ({
  width: 48,
  height: 48,
  borderRadius: 12,
  backgroundColor: disabled ? alpha(theme.palette.primary.main, 0.1) : theme.palette.primary.main,
  color: disabled ? theme.palette.text.disabled : '#fff',
  '&:hover': {
    backgroundColor: disabled ? alpha(theme.palette.primary.main, 0.1) : theme.palette.primary.dark,
  },
}));

const PLACEHOLDERS = {
  A: { Chinese: '短句 — 输入一个中文句子练习翻译...', Japanese: '短文を入力してください...' },
  B: { Chinese: '段落 — 粘贴一整段中文...', Japanese: '段落を貼り付けてください...' },
  C: { Chinese: '输入需要翻译的中文...', Japanese: '日本語の文を入力してください...' },
};

function TranslateShell() {
  const theme = useTheme();
  const [level, setLevelState] = useState('A');
  const [language, setLanguage] = useState(LanguageModel.Chinese);
  const [content, setContent] = useState('');
  const [submittedSource, setSubmittedSource] = useState(null);
  const [history, setHistory] = useState([]);
  const [alert, setAlert] = useState(null);
  const [toastShown, setToastShown] = useState(false);

  useEffect(() => {
    setLevelState(customStorage.getTranslateLevel());
    setHistory(customStorage.getTranslateHistory());
  }, []);

  const handleLevelChange = (next) => {
    setLevelState(next);
    customStorage.setTranslateLevel(next);
    setSubmittedSource(null);  // reset path content on level switch
  };

  const handleHistorySelect = (entry) => {
    setContent(entry.sourceText);
    if (entry.level !== level) handleLevelChange(entry.level);
    setLanguage(entry.sourceLanguage === 'Japanese' ? LanguageModel.Japanese : LanguageModel.Chinese);
  };

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setAlert({ severity: 'warning', message: 'Please enter a sentence to translate' });
      return;
    }
    // Auto-mode-switch toast for Path A long inputs
    if (level === 'A' && trimmed.length > 80 && !toastShown) {
      setToastShown(true);
      setAlert({
        severity: 'info',
        message: 'Long input — switch to Paragraph mode?',
        action: { label: 'Switch to B', onClick: () => handleLevelChange('B') },
      });
      return;
    }
    const entry = {
      id: uuid(),
      sourceText: trimmed,
      level,
      sourceLanguage: language === LanguageModel.Japanese ? 'Japanese' : 'Chinese',
      timestamp: Date.now(),
    };
    customStorage.appendTranslateHistory(entry);
    setHistory(customStorage.getTranslateHistory());
    setSubmittedSource(trimmed);
  };

  const onContentChange = (e) => setContent(e.currentTarget.value);
  const toggleLanguage = () => setLanguage((p) =>
    p === LanguageModel.Chinese ? LanguageModel.Japanese : LanguageModel.Chinese,
  );

  const langLabel = language === LanguageModel.Chinese ? '🇨🇳 中文' : '🇯🇵 日本語';

  const handleDemoteFromC = (stepNumber) => {
    handleLevelChange('A');
    // PathADrillView will pick up the same source via submittedSource.
    // stepNumber maps to scaffold reveal: 1 → SVO, 2 → tense (verbs imply tense in Chinese)
    // Pre-reveal handled via initialHints prop passed below.
  };

  const charBand = useMemo(() => {
    const n = content.trim().length;
    if (n === 0 || level !== 'A') return null;
    if (n <= 60) return null;
    if (n <= 80) return { tone: 'muted', text: `${n} chars · short-sentence drill` };
    return { tone: 'warn', text: `${n} chars · consider Paragraph mode` };
  }, [content, level]);

  return (
    <Box sx={{ display: 'flex', height: '100%', bgcolor: theme.palette.background.default, overflow: 'hidden' }}>
      {/* Sidebar */}
      <Box
        sx={{
          width: 280,
          minWidth: 280,
          bgcolor: theme.palette.background.paper,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: theme.palette.primary.main,
            }}
          >
            <TranslateIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Translation</Typography>
            <Typography variant="caption" color="text.secondary">Step-by-step learning</Typography>
          </Box>
        </Box>
        <Box sx={{ p: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
          <Box
            onClick={toggleLanguage}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              p: 1, borderRadius: 1, cursor: 'pointer',
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{langLabel}</Typography>
            <SwapHorizIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>🇬🇧 English</Typography>
          </Box>
        </Box>
        <Box sx={{ p: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
          <LevelSelector level={level} onChange={handleLevelChange} />
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TranslateHistoryList entries={history} onSelect={handleHistorySelect} />
        </Box>
      </Box>

      {/* Main */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          {submittedSource ? (
            <>
              {level === 'A' && (
                <PathADrillView source={submittedSource} language={language} />
              )}
              {level === 'B' && (
                <PathBParagraphView source={submittedSource} language={language} />
              )}
              {level === 'C' && (
                <PathCLookupView
                  source={submittedSource}
                  language={language}
                  onDemote={handleDemoteFromC}
                />
              )}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', pt: 8, opacity: 0.7 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                {{ A: 'Drill — attempt + compare', B: 'Paragraph — compose + compare', C: 'Lookup' }[level]}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter a {language === LanguageModel.Japanese ? 'Japanese' : 'Chinese'} sentence below.
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ p: 2.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`, bgcolor: theme.palette.background.paper }}>
          <Box sx={{ maxWidth: 900, mx: 'auto', display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <Box sx={{ flex: 1 }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={level === 'B' ? 8 : 4}
                value={content}
                onChange={onContentChange}
                placeholder={PLACEHOLDERS[level][language === LanguageModel.Japanese ? 'Japanese' : 'Chinese']}
                variant="outlined"
                onKeyDown={(e) => {
                  if (e.code === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              {charBand && (
                <Typography
                  variant="caption"
                  sx={{ mt: 0.5, display: 'block', color: charBand.tone === 'warn' ? theme.palette.warning.main : theme.palette.text.disabled }}
                >
                  {charBand.text}
                </Typography>
              )}
            </Box>
            <Tooltip title="Translate">
              <SendButton
                aria-label="Translate"
                onClick={submit}
                disabled={!content.trim()}
              >
                <SendIcon sx={{ fontSize: 22 }} />
              </SendButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={!!alert}
        autoHideDuration={6000}
        onClose={() => setAlert(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {alert && (
          <Alert
            severity={alert.severity}
            onClose={() => setAlert(null)}
            action={alert.action ? (
              <Typography
                component="button"
                onClick={() => { alert.action.onClick(); setAlert(null); }}
                sx={{ color: 'inherit', cursor: 'pointer', fontWeight: 600, border: 'none', bgcolor: 'transparent' }}
              >
                {alert.action.label}
              </Typography>
            ) : null}
          >
            {alert.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}

export default TranslateShell;
```

Also replace `src/renderer/views/translate/index.js`:

```js
import React from 'react';
import TranslateShell from './TranslateShell';

function TranslatePage() {
  return (
    <div className="main note__main">
      <TranslateShell />
    </div>
  );
}
export default TranslatePage;
```

Note: this introduces references to `PathADrillView` and `PathBParagraphView` which don't exist yet. Add temporary stub files so the import resolves:

```jsx
// src/renderer/views/translate/PathADrillView.jsx (stub — replaced in Phase 5)
import React from 'react';
function PathADrillView({ source }) {
  return <div data-testid="path-a-stub">Path A: {source}</div>;
}
export default PathADrillView;
```

```jsx
// src/renderer/views/translate/PathBParagraphView.jsx (stub — replaced in Phase 6)
import React from 'react';
function PathBParagraphView({ source }) {
  return <div data-testid="path-b-stub">Path B: {source}</div>;
}
export default PathBParagraphView;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/translateShell.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/TranslateShell.jsx src/renderer/views/translate/index.js src/renderer/views/translate/PathADrillView.jsx src/renderer/views/translate/PathBParagraphView.jsx src/__tests__/translate/translateShell.test.jsx
git commit -m "feat(translate): TranslateShell with level router, Path C wired live, A+B stubbed"
```

---

## Phase 5 — Path A (the core)

### Task 5.1: Create `ScaffoldRail.jsx` with three hint buttons

**Files:**
- Create: `src/renderer/views/translate/ScaffoldRail.jsx`
- Test: `src/__tests__/translate/pathA-hints.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/pathA-hints.test.jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ScaffoldRail from '../../renderer/views/translate/ScaffoldRail';

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(async (prompt, schema, opts) => {
      if (opts.label === 'translate-svo-hint') {
        return {
          subject: { source: '二楼', english: 'the second floor' },
          verb: { source: '有', english: 'there are' },
          object: { source: '书', english: 'books' },
        };
      }
      if (opts.label === 'translate-tense-hint') {
        return { tense: 'simple-present', justification: 'Stative scene with no aspect marker.' };
      }
      return null;
    }),
  },
}));

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('ScaffoldRail', () => {
  test('SVO reveal call records hint and shows result', async () => {
    const onHintsChange = jest.fn();
    const { getByText, findByText } = wrap(
      <ScaffoldRail source="图书馆的二楼有很多书" language="Chinese" onHintsChange={onHintsChange} />,
    );
    fireEvent.click(getByText(/Reveal SVO/i));
    await findByText(/the second floor/);
    expect(onHintsChange).toHaveBeenCalledWith(expect.objectContaining({ svo: true }));
  });
  test('Tense hint call records hint and shows tense', async () => {
    const onHintsChange = jest.fn();
    const { getByText, findByText } = wrap(
      <ScaffoldRail source="图书馆的二楼有很多书" language="Chinese" onHintsChange={onHintsChange} />,
    );
    fireEvent.click(getByText(/Tense hint/i));
    await findByText(/simple-present/);
    expect(onHintsChange).toHaveBeenCalledWith(expect.objectContaining({ tense: true }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/pathA-hints.test.jsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/renderer/views/translate/ScaffoldRail.jsx`:

```jsx
import React, { useState } from 'react';
import { Box, Typography, Button, Collapse, CircularProgress } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import LightbulbIcon from '@mui/icons-material/LightbulbOutlined';
import spineApi from '../../api/spineApi';
import { getSvoHintPrompt, getTenseHintPrompt } from '../../../commons/utils/AIPrompts';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function ScaffoldRail({ source, language, onHintsChange, initialHints = {} }) {
  const theme = useTheme();
  const [hints, setHints] = useState(initialHints);
  const [svoData, setSvoData] = useState(null);
  const [tenseData, setTenseData] = useState(null);
  const [loading, setLoading] = useState({ svo: false, tense: false });

  const recordHint = (kind) => {
    const next = { ...hints, [kind]: true };
    setHints(next);
    onHintsChange?.(next);
  };

  const revealSvo = async () => {
    if (svoData || loading.svo) return;
    setLoading((p) => ({ ...p, svo: true }));
    try {
      const r = await spineApi.generateContentWithJson(
        getSvoHintPrompt(source, language === 'Japanese' || language?.includes?.('Japanese') ? 'Japanese' : 'Chinese'),
        null,
        { label: 'translate-svo-hint' },
      );
      if (r) {
        setSvoData(r);
        recordHint('svo');
      }
    } finally {
      setLoading((p) => ({ ...p, svo: false }));
    }
  };

  const revealTense = async () => {
    if (tenseData || loading.tense) return;
    setLoading((p) => ({ ...p, tense: true }));
    try {
      const r = await spineApi.generateContentWithJson(
        getTenseHintPrompt(source, language === 'Japanese' || language?.includes?.('Japanese') ? 'Japanese' : 'Chinese'),
        null,
        { label: 'translate-tense-hint' },
      );
      if (r) {
        setTenseData(r);
        recordHint('tense');
      }
    } finally {
      setLoading((p) => ({ ...p, tense: false }));
    }
  };

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: alpha(theme.palette.primary.main, 0.03),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LightbulbIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
        <Typography
          sx={{ fontFamily: MONO, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.palette.text.secondary }}
        >
          Scaffold
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" onClick={revealSvo} disabled={loading.svo}>
          {loading.svo ? <CircularProgress size={14} /> : 'Reveal SVO'}
        </Button>
        <Button size="small" variant="outlined" onClick={revealTense} disabled={loading.tense}>
          {loading.tense ? <CircularProgress size={14} /> : 'Tense hint'}
        </Button>
        {/* Vocabulary lookup is wired via existing Vocabulary surface — out of scope here. */}
      </Box>
      <Collapse in={!!svoData}>
        {svoData && (
          <Box sx={{ mt: 1.5, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.6), fontSize: '0.8rem' }}>
            <Typography sx={{ fontSize: '0.75rem', mb: 0.5, fontWeight: 600 }}>SVO</Typography>
            <div>Subject: <em>{svoData.subject.source}</em> → {svoData.subject.english}</div>
            <div>Verb: <em>{svoData.verb.source}</em> → {svoData.verb.english}</div>
            <div>Object: <em>{svoData.object.source}</em> → {svoData.object.english}</div>
          </Box>
        )}
      </Collapse>
      <Collapse in={!!tenseData}>
        {tenseData && (
          <Box sx={{ mt: 1.5, p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.6), fontSize: '0.8rem' }}>
            <Typography sx={{ fontSize: '0.75rem', mb: 0.5, fontWeight: 600 }}>Tense</Typography>
            <div><strong>{tenseData.tense}</strong></div>
            <div style={{ color: theme.palette.text.secondary }}>{tenseData.justification}</div>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

export default ScaffoldRail;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/pathA-hints.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/ScaffoldRail.jsx src/__tests__/translate/pathA-hints.test.jsx
git commit -m "feat(translate): ScaffoldRail with SVO + Tense reveal buttons"
```

---

### Task 5.2: Create `WeaknessChip.jsx`

**Files:**
- Create: `src/renderer/views/translate/WeaknessChip.jsx`
- Test: `src/__tests__/translate/weaknessChip.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/weaknessChip.test.jsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import WeaknessChip from '../../renderer/views/translate/WeaknessChip';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('WeaknessChip', () => {
  test('renders bucket label + reason + learner phrase', () => {
    const { getByText } = wrap(
      <WeaknessChip
        weakness={{
          bucket: 'tense',
          learner_text: 'has',
          model_text: 'there are',
          reason: 'Use existential there-are for 有.',
        }}
        onSave={() => {}}
      />,
    );
    expect(getByText(/TENSE & ASPECT/i)).toBeTruthy();
    expect(getByText(/Use existential there-are/)).toBeTruthy();
  });
  test('Save button triggers onSave with full weakness object', () => {
    const w = { bucket: 'article-number', learner_text: 'of library', model_text: 'of the library', reason: 'Add the definite article.' };
    const onSave = jest.fn();
    const { getByText } = wrap(<WeaknessChip weakness={w} onSave={onSave} />);
    fireEvent.click(getByText(/Save as LP/i));
    expect(onSave).toHaveBeenCalledWith(w);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/weaknessChip.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/renderer/views/translate/WeaknessChip.jsx`:

```jsx
import React, { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import { BUCKET_LABELS, BUCKET_COLORS } from './buckets';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function WeaknessChip({ weakness, onSave }) {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';
  const color = BUCKET_COLORS[weakness.bucket]?.[mode] || theme.palette.warning.main;
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(weakness);
    setSaved(true);
  };

  return (
    <Box
      sx={{
        borderRadius: '12px',
        border: `1px solid ${alpha(color, 0.4)}`,
        borderLeft: `4px solid ${color}`,
        bgcolor: alpha(color, 0.04),
        p: 1.5,
        mb: 1,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Typography
          sx={{ fontFamily: MONO, fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px' }}
        >
          {BUCKET_LABELS[weakness.bucket]?.toUpperCase() || weakness.bucket}
        </Typography>
        <Button
          size="small"
          variant={saved ? 'contained' : 'outlined'}
          color="primary"
          startIcon={saved ? <CheckIcon /> : null}
          onClick={handleSave}
          disabled={saved}
          sx={{ fontSize: '0.7rem', textTransform: 'none' }}
        >
          {saved ? 'Saved' : 'Save as LP'}
        </Button>
      </Box>
      <Typography sx={{ fontSize: '0.85rem', mb: 0.5 }}>
        <em>&ldquo;{weakness.learner_text}&rdquo;</em>
        {' → '}
        <strong><em>&ldquo;{weakness.model_text}&rdquo;</em></strong>
      </Typography>
      <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}>
        {weakness.reason}
      </Typography>
    </Box>
  );
}

export default WeaknessChip;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/weaknessChip.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/WeaknessChip.jsx src/__tests__/translate/weaknessChip.test.jsx
git commit -m "feat(translate): WeaknessChip with bucket-colored stripe and Save-as-LP"
```

---

### Task 5.3: Create `DiffSpansRenderer.jsx`

**Files:**
- Create: `src/renderer/views/translate/DiffSpansRenderer.jsx`
- Test: `src/__tests__/translate/diffSpansRenderer.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/diffSpansRenderer.test.jsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import DiffSpansRenderer from '../../renderer/views/translate/DiffSpansRenderer';

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('DiffSpansRenderer', () => {
  const learnerText = 'The library has many books on second floor.';
  const modelText = 'There are many books on the second floor of the library.';
  const spans = [
    { side: 'learner', text: 'has', bucket: 'tense', kind: 'weaker', pair_id: 'p1', reason: '...' },
    { side: 'model', text: 'There are', bucket: 'tense', kind: 'weaker', pair_id: 'p1', reason: '...' },
    { side: 'learner', text: 'on second floor', bucket: 'article-number', kind: 'weaker', pair_id: 'p2', reason: '...' },
    { side: 'model', text: 'on the second floor', bucket: 'article-number', kind: 'weaker', pair_id: 'p2', reason: '...' },
  ];

  test('renders both sides with the source learner + model text', () => {
    const { getByText, container } = wrap(
      <DiffSpansRenderer learnerText={learnerText} modelText={modelText} spans={spans} />,
    );
    expect(container.textContent).toMatch(/The library has many books/);
    expect(container.textContent).toMatch(/There are many books/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/diffSpansRenderer.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/renderer/views/translate/DiffSpansRenderer.jsx`:

```jsx
import React, { useState, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import DiffSpan from '../writing/DiffSpan';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function locate(text, sideSpans) {
  // For each span, find its first occurrence in `text` and produce sorted intervals.
  const located = sideSpans
    .map((s) => {
      const idx = text.indexOf(s.text);
      return idx >= 0 ? { ...s, start: idx, end: idx + s.text.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
  // Drop overlaps — keep the earlier-starting one.
  const out = [];
  let cursor = 0;
  for (const s of located) {
    if (s.start < cursor) continue;
    out.push(s);
    cursor = s.end;
  }
  return out;
}

function renderSide(text, sideSpans, fontStack, hoveredPairId, onHoverPair) {
  const located = locate(text, sideSpans);
  const out = [];
  let cursor = 0;
  located.forEach((s, i) => {
    if (s.start > cursor) {
      out.push(<span key={`t${i}`}>{text.slice(cursor, s.start)}</span>);
    }
    out.push(
      <DiffSpan
        key={`s${i}`}
        kind={s.kind || 'weaker'}
        bucket={s.bucket}
        pairId={s.pair_id}
        hoveredPairId={hoveredPairId}
        onHoverPair={onHoverPair}
      >
        {s.text}
      </DiffSpan>,
    );
    cursor = s.end;
  });
  if (cursor < text.length) {
    out.push(<span key="tend">{text.slice(cursor)}</span>);
  }
  return <Box sx={{ fontFamily: fontStack, fontSize: '17px', lineHeight: 1.8 }}>{out}</Box>;
}

function DiffSpansRenderer({ learnerText, modelText, spans }) {
  const theme = useTheme();
  const [hoveredPairId, setHoveredPairId] = useState(null);
  const learnerSpans = useMemo(() => spans.filter((s) => s.side === 'learner'), [spans]);
  const modelSpans = useMemo(() => spans.filter((s) => s.side === 'model'), [spans]);

  const SideBox = ({ title, font, text, sideSpans }) => (
    <Box
      sx={{
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: theme.palette.background.paper,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
        <Typography
          sx={{ fontFamily: MONO, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.palette.text.secondary, fontWeight: 600 }}
        >
          {title}
        </Typography>
      </Box>
      <Box sx={{ p: 2 }}>{renderSide(text, sideSpans, font, hoveredPairId, setHoveredPairId)}</Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <SideBox title="YOUR ENGLISH" font={SANS} text={learnerText} sideSpans={learnerSpans} />
      <SideBox title="MODEL ENGLISH" font={SERIF} text={modelText} sideSpans={modelSpans} />
    </Box>
  );
}

export default DiffSpansRenderer;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/diffSpansRenderer.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/DiffSpansRenderer.jsx src/__tests__/translate/diffSpansRenderer.test.jsx
git commit -m "feat(translate): DiffSpansRenderer with bucket-colored side-by-side spans"
```

---

### Task 5.4: Wire Path A end-to-end in `PathADrillView.jsx`

**Files:**
- Modify: `src/renderer/views/translate/PathADrillView.jsx` (replacing the stub)
- Test: `src/__tests__/translate/pathA-compare.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/pathA-compare.test.jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PathADrillView from '../../renderer/views/translate/PathADrillView';

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(async (prompt, schema, opts) => {
      if (opts.label === 'translate-compare') {
        return {
          modelEnglish: 'There are many books on the second floor of the library.',
          spans: [
            { side: 'learner', text: 'has', bucket: 'tense', kind: 'weaker', pair_id: 'p1', reason: 'Use existential there-are for 有.' },
            { side: 'model', text: 'There are', bucket: 'tense', kind: 'weaker', pair_id: 'p1' },
          ],
          stepBreakdown: {
            'step-1': { title: 'SVO', 'sub-verb-obj-list': [], explain: '' },
            'step-2': { title: 'Verbs', 'input-verb-list': [], explain: '' },
            'step-3': { title: 'Scaffold', 'scaffold-options': [], 'best-scaffold': '', explain: '' },
            'step-4': { title: 'Structure', 'sentence-structure': '', explain: '' },
            'step-5': { title: 'Final', output: 'There are many books on the second floor of the library.', explain: '' },
          },
        };
      }
      return null;
    }),
  },
}));

const createMock = jest.fn(async () => ({ id: 'lp-1' }));
jest.mock('../../renderer/api/learningPointApi', () => ({
  __esModule: true,
  default: { create: (...args) => createMock(...args) },
}));

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('PathADrillView', () => {
  beforeEach(() => { createMock.mockClear(); });

  test('renders source and attempt textarea', () => {
    const { getByText, getByPlaceholderText } = wrap(
      <PathADrillView source="图书馆的二楼有很多书" language="Chinese" />,
    );
    expect(getByText(/图书馆的二楼有很多书/)).toBeTruthy();
    expect(getByPlaceholderText(/your english/i)).toBeTruthy();
  });
  test('Compare submit renders weakness chip with model phrase', async () => {
    const { getByPlaceholderText, getByText, findByText } = wrap(
      <PathADrillView source="图书馆的二楼有很多书" language="Chinese" />,
    );
    fireEvent.change(getByPlaceholderText(/your english/i), {
      target: { value: 'The library has books on second floor.' },
    });
    fireEvent.click(getByText(/^Compare/));
    expect(await findByText(/TENSE & ASPECT/i)).toBeTruthy();
    expect(await findByText(/Use existential there-are/)).toBeTruthy();
  });
  test('Save-as-LP invokes learningPointApi.create with language extras + translate-drill surface', async () => {
    const { getByPlaceholderText, getByText, findByText } = wrap(
      <PathADrillView source="图书馆的二楼有很多书" language="Chinese" />,
    );
    fireEvent.change(getByPlaceholderText(/your english/i), {
      target: { value: 'The library has books on second floor.' },
    });
    fireEvent.click(getByText(/^Compare/));
    const saveBtn = await findByText(/Save as LP/i);
    fireEvent.click(saveBtn);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const call = createMock.mock.calls[0][0];
    expect(call.domain).toBe('language');
    expect(call.featureSurface).toBe('translate-drill');
    expect(call.extras.bucket).toBe('tense');
    expect(call.extras.sourceLang).toBe('zh-Hans');
    expect(call.extras.targetLang).toBe('en-US');
    expect(call.extras.learnerAttempt).toBe('has');
    expect(call.extras.modelTarget).toBe('There are');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/pathA-compare.test.jsx`
Expected: FAIL — current `PathADrillView.jsx` is the stub.

- [ ] **Step 3: Implement**

Replace `src/renderer/views/translate/PathADrillView.jsx`:

```jsx
import React, { useState, useMemo } from 'react';
import { Box, Typography, TextField, Button, Collapse, CircularProgress } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import spineApi from '../../api/spineApi';
import learningPointApi from '../../api/learningPointApi';
import { getTranslateComparePrompt } from '../../../commons/utils/AIPrompts';
import { LanguageModel } from '../../../commons/model/DataTypes';
import ScaffoldRail from './ScaffoldRail';
import DiffSpansRenderer from './DiffSpansRenderer';
import WeaknessChip from './WeaknessChip';
import ModelBuildPanel from './ModelBuildPanel';
import { BUCKETS } from './buckets';

function langTag(language) {
  return language === LanguageModel.Japanese ? 'Japanese' : 'Chinese';
}

function bcp47Source(language) {
  return language === LanguageModel.Japanese ? 'ja-JP' : 'zh-Hans';
}

function PathADrillView({ source, language }) {
  const theme = useTheme();
  const [attempt, setAttempt] = useState('');
  const [hints, setHints] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const compare = async () => {
    if (!attempt.trim() || loading) return;
    setLoading(true);
    try {
      const r = await spineApi.generateContentWithJson(
        getTranslateComparePrompt(source, attempt.trim(), langTag(language)),
        null,
        { label: 'translate-compare' },
      );
      if (r) setResult(r);
    } finally {
      setLoading(false);
    }
  };

  const weaknesses = useMemo(() => {
    if (!result?.spans) return [];
    // Group by pair_id, gather learner_text + model_text + reason + bucket.
    const byPair = {};
    result.spans.forEach((s) => {
      if (!s.pair_id) return;
      const p = byPair[s.pair_id] || { bucket: s.bucket, pair_id: s.pair_id, reason: s.reason };
      if (s.side === 'learner') p.learner_text = s.text;
      if (s.side === 'model') p.model_text = s.text;
      if (s.reason) p.reason = s.reason;
      if (s.bucket) p.bucket = s.bucket;
      byPair[s.pair_id] = p;
    });
    return Object.values(byPair)
      .filter((w) => BUCKETS.includes(w.bucket))
      .sort((a, b) => BUCKETS.indexOf(a.bucket) - BUCKETS.indexOf(b.bucket));
  }, [result]);

  const handleSave = async (w) => {
    await learningPointApi.create({
      domain: 'language',
      content: `${w.bucket}: ${w.model_text}`,
      extras: {
        sourceLang: bcp47Source(language),
        targetLang: 'en-US',
        pattern: w.reason || '',
        bucket: w.bucket,
        learnerAttempt: w.learner_text,
        modelTarget: w.model_text,
        reason: w.reason || '',
        hintsUsed: hints,
      },
      featureSurface: 'translate-drill',
    });
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box
        sx={{
          p: 2, mb: 2, borderRadius: '14px',
          bgcolor: alpha(theme.palette.text.primary, 0.04),
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.disabled, mb: 0.5 }}>
          SOURCE
        </Typography>
        <Typography sx={{ fontSize: '15px' }}>{source}</Typography>
      </Box>
      <Box sx={{ mb: 2 }}>
        <ScaffoldRail source={source} language={langTag(language)} onHintsChange={setHints} />
      </Box>
      {!result && (
        <Box>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            placeholder="Your English…"
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={compare}
              disabled={!attempt.trim() || loading}
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
            >
              Compare
            </Button>
          </Box>
        </Box>
      )}
      {result && (
        <Box>
          <DiffSpansRenderer
            learnerText={attempt.trim()}
            modelText={result.modelEnglish}
            spans={result.spans || []}
          />
          <Box sx={{ mt: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1.5, fontWeight: 700 }}
            >
              Weaknesses ({weaknesses.length})
            </Typography>
            {weaknesses.map((w) => (
              <WeaknessChip key={w.pair_id} weakness={w} onSave={handleSave} />
            ))}
            {weaknesses.length === 0 && (
              <Typography variant="body2" color="text.secondary">No issues found — strong attempt.</Typography>
            )}
          </Box>
          <Box sx={{ mt: 3 }}>
            <Button
              size="small"
              variant="text"
              onClick={() => setShowBreakdown((v) => !v)}
            >
              {showBreakdown ? 'Hide' : 'Show'} how the model built it
            </Button>
            <Collapse in={showBreakdown}>
              <Box sx={{ mt: 2 }}>
                <ModelBuildPanel
                  steps={result.stepBreakdown}
                  originalTokens={[]}
                  language={langTag(language)}
                />
              </Box>
            </Collapse>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default PathADrillView;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/pathA-compare.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/PathADrillView.jsx src/__tests__/translate/pathA-compare.test.jsx
git commit -m "feat(translate): Path A wired — scaffold + attempt + compare + LP save"
```

---

## Phase 6 — Path B (largely composition)

### Task 6.1: Wire Path B in `PathBParagraphView.jsx`

**Files:**
- Modify: `src/renderer/views/translate/PathBParagraphView.jsx` (replacing the stub)
- Test: `src/__tests__/translate/pathB-paragraph.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/translate/pathB-paragraph.test.jsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PathBParagraphView from '../../renderer/views/translate/PathBParagraphView';

jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(async (prompt, schema, opts) => {
      if (opts.label === 'writing-5w-scaffold') {
        return { data: [{ sentenceIndex: 0, who: 'library', what: 'has books', when: '', where: 'second floor', why: '' }] };
      }
      if (opts.label === 'translate-paragraph-compare') {
        return {
          modelEnglish: 'There are many books on the second floor of the library.',
          spans: [],
          sentenceComparisons: [],
        };
      }
      return null;
    }),
  },
}));

const theme = createTheme({ palette: { mode: 'light' } });
const wrap = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('PathBParagraphView reuse boundary', () => {
  test('imports SourcePanel + FiveWRail + ExpressionDiffPanel from /writing', () => {
    // Static import-path assertion: open the module and check its source for the import line.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../renderer/views/translate/PathBParagraphView.jsx'),
      'utf8',
    );
    expect(src).toMatch(/from ['"]\.\.\/writing\/SourcePanel['"]/);
    expect(src).toMatch(/from ['"]\.\.\/writing\/FiveWRail['"]/);
    expect(src).toMatch(/from ['"]\.\.\/writing\/ExpressionDiffPanel['"]/);
  });
  test('renders source paragraph and 5W rail', async () => {
    const { findByText, container } = wrap(
      <PathBParagraphView source="图书馆的二楼有很多书。学生们来这里学习。" language="Chinese" />,
    );
    expect(container.textContent).toMatch(/图书馆的二楼有很多书/);
    await findByText(/SCENE \(5W\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/translate/pathB-paragraph.test.jsx`
Expected: FAIL — stub doesn't reuse those components.

- [ ] **Step 3: Implement**

Replace `src/renderer/views/translate/PathBParagraphView.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { Box, TextField, Button, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SourcePanel from '../writing/SourcePanel';
import FiveWRail from '../writing/FiveWRail';
import ExpressionDiffPanel from '../writing/ExpressionDiffPanel';
import learningPointApi from '../../api/learningPointApi';
import spineApi from '../../api/spineApi';
import { langstudy5WScaffoldPrompt, getTranslateParagraphComparePrompt } from '../../../commons/utils/AIPrompts';
import { LanguageModel } from '../../../commons/model/DataTypes';

const ACCENT = '#0E8A8A';
const langTag = (lang) => (lang === LanguageModel.Japanese ? 'Japanese' : 'Chinese');
const bcp47 = (lang) => (lang === LanguageModel.Japanese ? 'ja-JP' : 'zh-Hans');

function PathBParagraphView({ source, language }) {
  const theme = useTheme();
  const [lang5w, setLang5w] = useState(null);
  const [attempt, setAttempt] = useState('');
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const sourceLabel = language === LanguageModel.Japanese ? '日本語段落' : '中文段落';

  // Fetch 5W on mount
  useEffect(() => {
    let cancelled = false;
    async function fetch5w() {
      const r = await spineApi.generateContentWithJson(
        langstudy5WScaffoldPrompt(source),
        null,
        { label: 'writing-5w-scaffold' },
      );
      if (!cancelled && r) setLang5w(r);
    }
    fetch5w();
    return () => { cancelled = true; };
  }, [source]);

  const compare = async () => {
    if (!attempt.trim() || loading) return;
    setLoading(true);
    try {
      const r = await spineApi.generateContentWithJson(
        getTranslateParagraphComparePrompt(source, attempt.trim(), langTag(language)),
        null,
        { label: 'translate-paragraph-compare' },
      );
      if (r) setDiff(r);
    } finally {
      setLoading(false);
    }
  };

  // Save any sentence-level note as a Learning Point (called from caller-side
  // chips inside the diff panel — for v1 we surface a single "save all"
  // button beneath the diff to keep this slim).
  const saveAllNotes = async () => {
    if (!diff?.sentenceComparisons) return;
    let saved = 0;
    for (const group of diff.sentenceComparisons) {
      for (const n of (group.notes || [])) {
        if (saved >= 5) return;
        await learningPointApi.create({
          domain: 'language',
          content: `${n.pair_id}: ${n.model_phrase || ''}`,
          extras: {
            sourceLang: bcp47(language),
            targetLang: 'en-US',
            pattern: n.explanation || '',
            bucket: n.bucket || 'idiom-register',
            learnerAttempt: n.learner_phrase,
            modelTarget: n.model_phrase,
            reason: n.explanation,
          },
          featureSurface: 'translate-drill',
        });
        saved += 1;
      }
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SourcePanel
        text={source}
        onTextChange={() => {}}
        sourceLocked
        accent={ACCENT}
        label={sourceLabel}
        placeholder=""
      />
      <FiveWRail lang5w={lang5w} accent={ACCENT} />
      {!diff && (
        <Box>
          <TextField
            fullWidth
            multiline
            minRows={6}
            maxRows={14}
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            placeholder="Your English paragraph…"
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={compare}
              disabled={!attempt.trim() || loading}
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
            >
              Compare
            </Button>
          </Box>
        </Box>
      )}
      {diff && (
        <Box>
          <ExpressionDiffPanel
            original={diff.modelEnglish}
            learner={attempt.trim()}
            diff={diff}
            accent={ACCENT}
          />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" variant="outlined" onClick={saveAllNotes}>
              Save up to 5 notes as Learning Points
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default PathBParagraphView;
```

Note: `langstudy5WScaffoldPrompt` should already exist in `AIPrompts.js` from the Writing Practice redesign. If it's not exported by name, grep first and adjust the import. The fallback name to look for is one of `langstudy5WScaffoldPrompt` / `langstudyFiveWPrompt` / `langstudy5wScaffoldPrompt`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/translate/pathB-paragraph.test.jsx`
Expected: PASS (2 tests).

If the 5W prompt name differs, also run a quick grep to confirm:
Run: `npx grep -n "langstudy.*[Ss]caffold" src/commons/utils/AIPrompts.js`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/translate/PathBParagraphView.jsx src/__tests__/translate/pathB-paragraph.test.jsx
git commit -m "feat(translate): Path B paragraph wired via writing components reuse"
```

---

## Phase 7 — Cleanup + verification

### Task 7.1: Remove the legacy `TranslateMainPage.js`

**Files:**
- Delete: `src/renderer/views/translate/TranslateMainPage.js`

- [ ] **Step 1: Confirm nothing else imports it**

Run: `npx grep -rn "TranslateMainPage" src --include='*.js' --include='*.jsx' --include='*.tsx'`
Expected: only the test file (already deleted via path A test) or zero hits. If `index.js` still references it, that's a prior task that didn't land — return and fix Task 4.3.

- [ ] **Step 2: Delete the file and verify**

```bash
git rm src/renderer/views/translate/TranslateMainPage.js
npm run lint
```

Expected: lint passes.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(translate): remove legacy TranslateMainPage"
```

---

### Task 7.2: Add CONTEXT.md glossary entries

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Append the new section**

Append to `CONTEXT.md` (after the `Writing Practice (2026-06-29 redesign)` section):

```markdown
## Translate Page (2026-06-30 redesign)

- **Level Selector** — sidebar control on `/translate` choosing among Path A drill, Path B paragraph, Path C lookup. Persisted per-user via `customStorage.getTranslateLevel/setTranslateLevel`. *Not "mode toggle".*
- **Path A / B / C** — the three flows. **A** = short-sentence attempt + 6-bucket compare. **B** = paragraph compose-and-compare reusing Writing Practice components (`SourcePanel`, `FiveWRail`, `ExpressionDiffPanel`). **C** = quick lookup with the model-built-it breakdown.
- **Weakness Bucket** — one of six closed-enum categories the `translate-compare` prompt labels learner spans with: `tense` / `word-order` / `article-number` / `preposition-collocation` / `connector-cohesion` / `idiom-register`. Drives chip color, Learning Point `extras.bucket`, and Phase 13 attribution. Defined in [src/renderer/views/translate/buckets.js](src/renderer/views/translate/buckets.js).
- **Scaffold Rail** — Path A's collapsible 2-button hint surface (Reveal SVO / Tense hint). Each click records into `extras.hintsUsed` on the eventual Learning Point. *Not "hint panel".*
- **Path Demotion** — Path C action: clicking *"try this step yourself →"* on a model-built-it step switches the page to Path A with the source pre-filled (scaffold pre-reveal mapping is a v1.1 polish — see plan §"Open items").
- **`feature_surface: 'translate-drill'`** — closed-enum value in `featureSurface.js`. Mastery moves caused by Path A/B Learning Point saves attribute to this surface in Phase 13 Spend & Returns. Attention state: `focused-session`. Phase group: `production-prompts`.
- **Spine intent labels** — five new labels in `src/commons/utils/AIPrompts.js`: `translate-svo-hint`, `translate-tense-hint`, `translate-compare` (Path A), `translate-paragraph-compare` (Path B), `translate-quick` (Path C). Replaces the legacy single `translate-main` label.
```

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs(CONTEXT): translate redesign glossary entries"
```

---

### Task 7.3: Run full test suite + smoke test

- [ ] **Step 1: Run all translate-related tests**

```bash
npx jest src/__tests__/translate src/__tests__/writing/diffSpanBucket src/__tests__/writing/sourcePanelProps src/__tests__/learning/languagePatternExtras src/__tests__/featureSurface/translateDrillEnum src/__tests__/main/learningPointCreateIpc
```

Expected: ALL pass.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run smoke test**

```bash
npm run test:smoke
```

Expected: pass (boot Electron 12s, no known crash patterns).

- [ ] **Step 4: Open the app, hit `/translate`, verify each level**

```bash
npm start
```

In the running app:
- Sidebar shows three levels, A selected by default.
- Type `图书馆的二楼有很多书` → submit on A → scaffold rail appears, attempt box visible.
- Type an English attempt → Compare → diff renders with bucket-colored spans + at least one weakness chip → Save as LP succeeds (no error in console).
- Switch to C → submit same source → headline result appears at top, 5 step cards below (rendered immediately, no 2s reveal), per-step demote link present.
- Switch to B → paste a longer Chinese paragraph → 5W rail loads → write English → Compare → side-by-side diff renders.

- [ ] **Step 5: Final commit (only if any tweaks needed)**

If the smoke check surfaces tweaks, fix them in focused commits — do not amend prior commits (per [feedback_no_destructive_git.md](C:\Users\nihan\.claude\projects\c--Users-nihan-Desktop---AI---smart-e-readers-smart-reader-v2\memory\feedback_no_destructive_git.md)).

---

## Open items (deferred — not v1)

These are intentional gaps for follow-up:

- **Scaffold pre-reveal on Path C → Path A demotion.** v1 demotes with source pre-filled but does NOT pre-open the matching scaffold (e.g., clicking demote on step-1 should pre-reveal SVO). The seam is in `TranslateShell.handleDemoteFromC(stepNumber)` and `PathADrillView`'s `initialHints` prop. Wire in a v1.1 polish task.
- **Per-sentence save in Path B.** v1 has a "save up to 5 notes" button; per-note Save chips inline in the diff need a `WeaknessChip`-style integration into `ExpressionDiffPanel`. Defer to v1.1.
- **Hint down-weighting in SRS.** `extras.hintsUsed` is captured but `SpacedRepetitionService` does not yet consume it. Wait for usage data.
- **Phase 14 ROI / Quest weighting hookups for `translate-drill`.** The new feature_surface is on the closed enum; predictive engine consumption is a Phase 14b/c follow-up.
- **Brain Episode emission for Path A submits.** Out of scope; the Learning Point save is the proxy signal.
- **Japanese tuning.** The 6-bucket prompt is Chinese-shaped (mentions 了/着/过 explicitly). When Japanese usage rises, swap to a Japanese-shaped prompt selecting on `language`.

---

## Self-review notes (in-spec checklist completed by author)

1. **Spec coverage** — every section of the spec maps to at least one task: Goal (Phases 3–6), Visual language (Tasks 0.2 BUCKET_COLORS), Architecture shared shell (Phase 4), Paths A/B/C (Phases 3, 5, 6), Spine intent labels (Phase 2), Data shape — LP domain (Task 0.3 with delta), History persistence (Task 0.6 with delta), Auto-mode-switch policy (Task 4.3), Components (10 of 10 covered across Phases 3–6), Risks (mitigations live in Open items and Task 5.4's stepBreakdown bundling decision).
2. **Placeholder scan** — no "TBD" / "TODO" / vague "add error handling" steps. Every implementation step includes the actual code.
3. **Type consistency** — `bucket` enum used identically across Tasks 0.2 / 0.3 / 0.4 / 2.1 / 5.2 / 5.4. `hintsUsed` shape `{ svo?, tense?, vocabulary? }` consistent across Tasks 0.3 / 5.1 / 5.4. `featureSurface: 'translate-drill'` literal consistent across Tasks 0.1 / 1.1 / 5.4 / 6.1. `learningPointApi.create` signature consistent across Tasks 1.2 / 5.4 / 6.1.
