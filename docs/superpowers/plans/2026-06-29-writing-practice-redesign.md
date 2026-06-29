# Writing Practice Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6-step POS-by-POS cloze flow in [src/renderer/views/writing/](src/renderer/views/writing/) with a 3-phase active-reconstruction loop (Prepare / Recall / Compose), introduce an expression-aware diff in Compose, and fix the source-text input bug.

**Architecture:** Pure helpers (mask-attempt commit, recall-ladder parser, expression-diff parser) ship first with unit tests. Two new AI prompts collapse five existing ones. Components are built bottom-up: leaves (`MaskedToken`, `DiffSpan`) before composites (`RecallLadder`, `ExpressionDiffPanel`) before the orchestrator rewrite (`WritingView`). Dead files removed at the end.

**Tech Stack:** React 18 + MUI 5, Jest for unit tests, Brain Spine bridge (`spineApi.generateContentWithJson`) for AI calls.

**Spec:** [docs/superpowers/specs/2026-06-29-writing-practice-redesign.md](../specs/2026-06-29-writing-practice-redesign.md) (commit `be0aeea`)

**Divergences from spec discovered during plan drafting:**
- Spec mentions removing `AnnotatedText.js`; verified it's only used internally by writing/ (no external consumers). Removal is safe.
- Verified `langstudyComparisonExerciseMore` (referenced by the to-be-removed `ComparisonExercise.js`) has no other consumers, so it can be removed alongside.
- `GrammarCheckSkill.js` has a comment referencing `langstudyComparisonExercise` but no import — comment will be left alone (removing prompts won't break the skill).
- Spec says system fonts only; the codebase has no `'Source Serif Pro'` fallback chain registered today. Plan ships the stack as `'Source Serif Pro', Georgia, 'Times New Roman', serif` — `Georgia` is the actual fallback that will render on Windows without the paid font (matches [2026-06-22-note-component-ui-upgrade-design.md](../specs/2026-06-22-note-component-ui-upgrade-design.md) precedent).
- Plan keeps `langstudy5wPrompt` as-is (spec called this out). All other `langstudy*` prompts used only by the writing view get removed at the end.

---

## File map

**Created:**
- `src/renderer/views/writing/maskAttempt.js` — pure: compare typed attempt to expected word
- `src/renderer/views/writing/recallLadderParser.js` — pure: AI JSON → `{ light, medium, hard }`
- `src/renderer/views/writing/expressionDiffParser.js` — pure: AI JSON → `{ spans, notes }`
- `src/renderer/views/writing/PhaseTabBar.js` — 3-pill segmented control with locked state
- `src/renderer/views/writing/SourcePanel.js` — always-mounted textarea + lock toggle (Phase 1)
- `src/renderer/views/writing/MaskedToken.js` — single occlusion-block + inline-input cell
- `src/renderer/views/writing/RecallLadder.js` — rung selector + paragraph render (Phase 2)
- `src/renderer/views/writing/FiveWRail.js` — collapsed-by-default 5W reference
- `src/renderer/views/writing/DiffSpan.js` — green/amber/blue span with hover pair-id link
- `src/renderer/views/writing/ExpressionDiffPanel.js` — side-by-side + Expression Notes rail
- `src/renderer/views/writing/ComposeCompare.js` — State A/B orchestrator (Phase 3)
- `src/__tests__/renderer/writingMaskAttempt.test.js`
- `src/__tests__/renderer/writingRecallLadderParser.test.js`
- `src/__tests__/renderer/writingExpressionDiffParser.test.js`

**Modified:**
- `src/renderer/views/writing/WritingView.js` — orchestrator rewrite
- `src/renderer/views/writing/config.js` — replace `steps[]` with `PHASES` + `RUNGS`
- `src/renderer/views/writing/MultilineTextField.js` — verify controlled-component contract; no API change
- `src/commons/utils/AIPrompts.js` — add two prompts; remove four obsolete ones

**Deleted (after orchestrator rewrite):**
- `src/renderer/views/writing/ParagraphWithHiddenWords.js` (folded into `RecallLadder` + `MaskedToken`)
- `src/renderer/views/writing/ParagraphComparer.js` (folded into `ExpressionDiffPanel`)
- `src/renderer/views/writing/ComparisonExercise.js` (folded into `ExpressionDiffPanel`)
- `src/renderer/views/writing/AnnotatedText.js` (folded into `DiffSpan`)
- `src/renderer/views/writing/WritingStepper.js` (legacy stepper, not used by new shell)
- `src/renderer/views/writing/AlignmentDisplay.js` (only consumer was the deleted flow)
- `src/renderer/views/writing/globalAlign.js` (only consumer was the deleted flow)

---

## Task 1: Define `config.js` phase + rung contract

**Files:**
- Modify: `src/renderer/views/writing/config.js`

- [ ] **Step 1: Replace the file contents**

```js
// src/renderer/views/writing/config.js

export const PHASES = [
  {
    id: 'prepare',
    label: 'Prepare',
    meta: '1 PREPARE',
    blurb: 'Read and understand the model.',
  },
  {
    id: 'recall',
    label: 'Recall',
    meta: '2 RECALL',
    blurb: 'Same paragraph, fewer cues at each rung.',
  },
  {
    id: 'compose',
    label: 'Compose',
    meta: '3 COMPOSE',
    blurb: 'Write the same idea in your own words, then compare.',
  },
];

export const RUNGS = [
  {
    id: 'light',
    label: 'Light',
    glyphEngaged: '●',
    blurb: 'Mask collocations and idioms only.',
  },
  {
    id: 'medium',
    label: 'Medium',
    glyphEngaged: '◐',
    blurb: 'Add discourse markers + key content nouns.',
  },
  {
    id: 'hard',
    label: 'Hard',
    glyphEngaged: '○',
    blurb: 'Keep only sentence skeletons.',
  },
];

// Single accent (teal); phase intensity steps along this hue.
export const ACCENT = {
  light: { 200: '#7AC5C5', 400: '#0E8A8A', 600: '#085656' },
  dark:  { 200: '#9EE5E5', 400: '#5EE0E0', 600: '#2FA8A8' },
};

// Semantic status colors for the Compare view (kept separate from accent).
export const DIFF_COLORS = {
  match:   { light: '#2E7D32', dark: '#81C784' },  // green
  weaker:  { light: '#E65100', dark: '#FFB74D' },  // amber
  grammar: { light: '#1565C0', dark: '#64B5F6' },  // blue
};
```

- [ ] **Step 2: Verify the legacy `steps` and `stepsInfo` exports are gone**

```bash
grep -n "^export const steps" src/renderer/views/writing/config.js
```
Expected: no output.

- [ ] **Step 3: Run lint to make sure no consumers still import the old names**

```bash
npm run lint -- src/renderer/views/writing/
```
Expected: lint will surface the broken imports in `WritingView.js` (lines `import { steps, stepsInfo } from './config'`). That is expected — `WritingView.js` is rewritten in Task 14. Take note of the failure but don't fix it yet.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/writing/config.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): replace step config with phase/rung metadata"
```

---

## Task 2: Pure helper — `maskAttempt`

The recall-ladder's typed-input commits go through this. Pure function — easy to test, easy to tune.

**Files:**
- Create: `src/renderer/views/writing/maskAttempt.js`
- Create: `src/__tests__/renderer/writingMaskAttempt.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/renderer/writingMaskAttempt.test.js
const { commitMaskAttempt } = require('../../renderer/views/writing/maskAttempt');

describe('commitMaskAttempt', () => {
  test('exact match returns ok=true', () => {
    expect(commitMaskAttempt('decision', 'decision')).toEqual({
      ok: true,
      hint: null,
    });
  });

  test('case-insensitive match returns ok=true', () => {
    expect(commitMaskAttempt('Decision', 'decision')).toEqual({
      ok: true,
      hint: null,
    });
  });

  test('trailing/leading whitespace ignored', () => {
    expect(commitMaskAttempt('  decision  ', 'decision').ok).toBe(true);
  });

  test('empty attempt returns ok=false with no hint', () => {
    expect(commitMaskAttempt('', 'decision')).toEqual({
      ok: false,
      hint: null,
    });
  });

  test('wrong attempt returns ok=false with first-letter+length hint', () => {
    expect(commitMaskAttempt('choice', 'decision')).toEqual({
      ok: false,
      hint: 'D_______',  // 'D' + 7 underscores (length 8)
    });
  });

  test('hint preserves leading capitalization of expected', () => {
    expect(commitMaskAttempt('apple', 'Banana').hint).toBe('B_____');
  });

  test('multi-word expected: hint shows word-by-word skeleton', () => {
    expect(commitMaskAttempt('took the choice', 'made a decision').hint).toBe(
      'M___ _ D_______',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- writingMaskAttempt
```
Expected: FAIL — `Cannot find module '../../renderer/views/writing/maskAttempt'`.

- [ ] **Step 3: Implement the helper**

```js
// src/renderer/views/writing/maskAttempt.js

function normalize(s) {
  return (s || '').trim().toLowerCase();
}

function skeletonForWord(word) {
  if (!word) return '';
  return word[0] + '_'.repeat(Math.max(0, word.length - 1));
}

function buildHint(expected) {
  return expected
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? part : skeletonForWord(part)))
    .join('');
}

function commitMaskAttempt(attempt, expected) {
  const a = normalize(attempt);
  const e = normalize(expected);
  if (a === e) return { ok: true, hint: null };
  if (!a) return { ok: false, hint: null };
  return { ok: false, hint: buildHint(expected) };
}

module.exports = { commitMaskAttempt };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- writingMaskAttempt
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/writing/maskAttempt.js src/__tests__/renderer/writingMaskAttempt.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): commitMaskAttempt pure helper + tests"
```

---

## Task 3: Pure helper — `recallLadderParser`

Validates the AI response shape for the batched recall-ladder call and surfaces a clear error if the LLM dropped a rung.

**Files:**
- Create: `src/renderer/views/writing/recallLadderParser.js`
- Create: `src/__tests__/renderer/writingRecallLadderParser.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/renderer/writingRecallLadderParser.test.js
const {
  parseRecallLadder,
} = require('../../renderer/views/writing/recallLadderParser');

describe('parseRecallLadder', () => {
  test('valid response returns the 3 rungs', () => {
    const input = {
      light: 'Although the project ${fell} behind schedule…',
      medium: 'Although the project ${fell behind} schedule…',
      hard: 'Although ${the project fell behind schedule…}',
    };
    expect(parseRecallLadder(input)).toEqual(input);
  });

  test('missing rung throws', () => {
    expect(() =>
      parseRecallLadder({ light: 'a', medium: 'b' }),
    ).toThrow(/missing rung: hard/i);
  });

  test('non-string rung throws', () => {
    expect(() =>
      parseRecallLadder({ light: 'a', medium: 'b', hard: 42 }),
    ).toThrow(/rung "hard" must be a string/i);
  });

  test('null input throws', () => {
    expect(() => parseRecallLadder(null)).toThrow(/expected object/i);
  });

  test('string input (raw JSON) is parsed', () => {
    const json = JSON.stringify({
      light: 'a', medium: 'b', hard: 'c',
    });
    expect(parseRecallLadder(json)).toEqual({ light: 'a', medium: 'b', hard: 'c' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- writingRecallLadderParser
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

```js
// src/renderer/views/writing/recallLadderParser.js

const RUNG_IDS = ['light', 'medium', 'hard'];

function parseRecallLadder(input) {
  let obj = input;
  if (typeof obj === 'string') {
    obj = JSON.parse(obj);
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error('parseRecallLadder: expected object, got ' + typeof obj);
  }
  for (const rung of RUNG_IDS) {
    if (!(rung in obj)) {
      throw new Error(`parseRecallLadder: missing rung: ${rung}`);
    }
    if (typeof obj[rung] !== 'string') {
      throw new Error(`parseRecallLadder: rung "${rung}" must be a string`);
    }
  }
  return { light: obj.light, medium: obj.medium, hard: obj.hard };
}

module.exports = { parseRecallLadder, RUNG_IDS };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- writingRecallLadderParser
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/writing/recallLadderParser.js src/__tests__/renderer/writingRecallLadderParser.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): recallLadderParser + tests"
```

---

## Task 4: Pure helper — `expressionDiffParser`

Same shape-validation discipline for the Compare AI call.

**Files:**
- Create: `src/renderer/views/writing/expressionDiffParser.js`
- Create: `src/__tests__/renderer/writingExpressionDiffParser.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/renderer/writingExpressionDiffParser.test.js
const {
  parseExpressionDiff,
} = require('../../renderer/views/writing/expressionDiffParser');

describe('parseExpressionDiff', () => {
  test('valid response normalizes spans + notes', () => {
    const input = {
      spans: [
        { side: 'learner', text: 'made a choice', kind: 'weaker', pair_id: 'p1' },
        { side: 'original', text: 'took a decision', kind: 'stronger', pair_id: 'p1' },
        { side: 'learner', text: 'fast', kind: 'grammar', note: "use 'quickly'" },
      ],
      notes: [
        {
          pair_id: 'p1',
          learner_phrase: 'made a choice',
          original_phrase: 'took a decision',
          explanation: 'Take a decision is the standard collocation.',
        },
      ],
    };
    const result = parseExpressionDiff(input);
    expect(result.spans).toHaveLength(3);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].pair_id).toBe('p1');
  });

  test('drops spans with unknown side', () => {
    const input = {
      spans: [
        { side: 'learner', text: 'a', kind: 'weaker' },
        { side: 'banana', text: 'b', kind: 'weaker' },
      ],
      notes: [],
    };
    expect(parseExpressionDiff(input).spans).toHaveLength(1);
  });

  test('drops spans with unknown kind', () => {
    const input = {
      spans: [
        { side: 'learner', text: 'a', kind: 'mystery' },
        { side: 'learner', text: 'b', kind: 'grammar' },
      ],
      notes: [],
    };
    expect(parseExpressionDiff(input).spans).toHaveLength(1);
    expect(parseExpressionDiff(input).spans[0].kind).toBe('grammar');
  });

  test('missing notes defaults to empty array', () => {
    expect(parseExpressionDiff({ spans: [] }).notes).toEqual([]);
  });

  test('string (raw JSON) is parsed', () => {
    const out = parseExpressionDiff('{"spans":[],"notes":[]}');
    expect(out).toEqual({ spans: [], notes: [] });
  });

  test('null input throws', () => {
    expect(() => parseExpressionDiff(null)).toThrow(/expected object/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- writingExpressionDiffParser
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

```js
// src/renderer/views/writing/expressionDiffParser.js

const VALID_SIDES = new Set(['learner', 'original']);
const VALID_KINDS = new Set(['match', 'weaker', 'stronger', 'grammar']);

function parseExpressionDiff(input) {
  let obj = input;
  if (typeof obj === 'string') {
    obj = JSON.parse(obj);
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error('parseExpressionDiff: expected object, got ' + typeof obj);
  }
  const rawSpans = Array.isArray(obj.spans) ? obj.spans : [];
  const spans = rawSpans.filter(
    (s) =>
      s &&
      typeof s.text === 'string' &&
      VALID_SIDES.has(s.side) &&
      VALID_KINDS.has(s.kind),
  );
  const rawNotes = Array.isArray(obj.notes) ? obj.notes : [];
  const notes = rawNotes.filter(
    (n) =>
      n &&
      typeof n.pair_id === 'string' &&
      typeof n.learner_phrase === 'string' &&
      typeof n.original_phrase === 'string' &&
      typeof n.explanation === 'string',
  );
  return { spans, notes };
}

module.exports = { parseExpressionDiff, VALID_SIDES, VALID_KINDS };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- writingExpressionDiffParser
```
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/writing/expressionDiffParser.js src/__tests__/renderer/writingExpressionDiffParser.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): expressionDiffParser + tests"
```

---

## Task 5: Add the two new AI prompts

**Files:**
- Modify: `src/commons/utils/AIPrompts.js`

- [ ] **Step 1: Append the two new prompts at the bottom of `AIPrompts.js`**

Append (do not replace) this block to the end of the file:

```js
// === Writing Practice v2 (2026-06-29 redesign) ===

export const langstudyRecallLadderPrompt = (text) => `
Generate three masked versions of the paragraph below for a language-learning recall exercise.
Wrap each masked span with \${} so the renderer can detect them.

Return ONLY a JSON object with three string fields:
  - "light":  hide ONLY collocations and idioms (e.g., "made a decision", "at first glance").
              Roughly 30% of the paragraph hidden.
  - "medium": light + discourse markers (however, as a result) + key content nouns.
              Roughly 60% of the paragraph hidden.
  - "hard":   keep ONLY the first 1-2 words of each sentence, connectives, and punctuation.
              Roughly 80% of the paragraph hidden. Everything else inside one or two \${} spans per sentence.

Example output shape:
{
  "light":  "Although the project \${fell} behind schedule, the team \${still delivered} on time.",
  "medium": "Although the project \${fell behind} schedule, \${the team still delivered} on time.",
  "hard":   "Although \${the project fell behind schedule}, the team \${still delivered on time}."
}

Paragraph:
${text}
`;

export const langstudyExpressionDiffPrompt = (original, learner) => `
You are a language-learning tutor. Compare the LEARNER's paragraph against the ORIGINAL.
Surface where the LEARNER's expression is weaker than the ORIGINAL (collocation, idiom, register, cohesion),
and where it has mechanical grammar issues.

Return ONLY a JSON object with this shape:
{
  "spans": [
    { "side": "learner"|"original", "text": "<exact substring>", "kind": "match"|"weaker"|"stronger"|"grammar", "pair_id": "<string, only for weaker↔stronger pairs>", "note": "<optional, only for grammar kind>" }
  ],
  "notes": [
    { "pair_id": "<matches a span pair>", "learner_phrase": "...", "original_phrase": "...", "explanation": "1-2 sentences on why the original phrasing is stronger." }
  ]
}

Pair each "weaker" learner span with the corresponding "stronger" original span via the same pair_id (p1, p2, ...).
Do NOT include "match" spans unless they are deliberate paraphrases worth praising; default to omitting them.
Each note's "explanation" must be ONE pedagogical reason (collocation rule, idiom, register, cohesion device) — not a generic "the original is better."

ORIGINAL:
${original}

LEARNER:
${learner}
`;
```

- [ ] **Step 2: Verify both prompts are exported**

```bash
grep -n "langstudyRecallLadderPrompt\|langstudyExpressionDiffPrompt" src/commons/utils/AIPrompts.js
```
Expected: two `export const ...` matches.

- [ ] **Step 3: Commit**

```bash
git add src/commons/utils/AIPrompts.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): add recall-ladder and expression-diff AI prompts"
```

---

## Task 6: `SourcePanel` — Prepare phase + bug fix

The textarea that always stays mounted. Owns `text` + `sourceLocked` lifecycle. This is where the lose-focus-on-first-keystroke bug dies.

**Files:**
- Create: `src/renderer/views/writing/SourcePanel.js`

- [ ] **Step 1: Implement the component**

```jsx
// src/renderer/views/writing/SourcePanel.js
import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MultilineTextField from './MultilineTextField';

const SERIF_STACK = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const MONO_STACK = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function SourcePanel({
  text,
  onTextChange,
  sourceLocked,
  onLock,
  onUnlock,
  accent,
}) {
  const theme = useTheme();
  const placeholder =
    'Paste a paragraph you want to learn from. The model text is the anchor for the next two phases.';

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        borderLeft: `4px solid ${accent}`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          sx={{
            fontFamily: MONO_STACK,
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.palette.text.secondary,
          }}
        >
          SOURCE PARAGRAPH
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontFamily: MONO_STACK,
              fontSize: '0.72rem',
              color: sourceLocked ? accent : theme.palette.text.disabled,
            }}
          >
            {sourceLocked ? '○ LOCKED' : '● UNLOCKED'}
          </Typography>
          {sourceLocked ? (
            <Tooltip title="Edit source">
              <IconButton size="small" onClick={onUnlock}>
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Box>
      </Box>

      <Box
        sx={{
          p: 2.5,
          fontFamily: SERIF_STACK,
          fontSize: '18px',
          lineHeight: 1.8,
          color: theme.palette.text.primary,
          maxWidth: 680,
        }}
      >
        <MultilineTextField
          initialText={text}
          placeholder={placeholder}
          onTextChange={sourceLocked ? () => {} : onTextChange}
          colors={{ accent }}
          minimal
        />
      </Box>

      {!sourceLocked && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Typography
            component="button"
            disabled={!text || !text.trim()}
            onClick={onLock}
            sx={{
              fontFamily: MONO_STACK,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              border: 'none',
              borderRadius: 1,
              background: text && text.trim() ? accent : alpha(accent, 0.3),
              color: '#fff',
              cursor: text && text.trim() ? 'pointer' : 'not-allowed',
              px: 2,
              py: 0.75,
              opacity: text && text.trim() ? 1 : 0.5,
            }}
          >
            Continue →
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default SourcePanel;
```

- [ ] **Step 2: Verify `MultilineTextField` plays nicely as the controlled inner**

Read [src/renderer/views/writing/MultilineTextField.js:50-63](src/renderer/views/writing/MultilineTextField.js#L50-L63). The local-state-with-resync pattern means: when `initialText` changes (e.g., on every parent re-render with the same `text`), the field's internal state is overwritten with the same value — a no-op. This is fine. The field never unmounts, which is the only requirement for the bug fix.

If the executor finds typing feels janky during smoke testing (Task 16), the cleanest follow-up is to make `MultilineTextField` fully controlled (`value={initialText}` directly, no internal `text` state). Out of scope for this task; flag as a Discovered Issue.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/views/writing/SourcePanel.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): SourcePanel — always-mounted source textarea"
```

---

## Task 7: `PhaseTabBar` — top tab bar replacing the sidebar

**Files:**
- Create: `src/renderer/views/writing/PhaseTabBar.js`

- [ ] **Step 1: Implement the component**

```jsx
// src/renderer/views/writing/PhaseTabBar.js
import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import LockIcon from '@mui/icons-material/Lock';
import { PHASES } from './config';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function PhaseTabBar({ activePhase, sourceLocked, onChange, accent }) {
  const theme = useTheme();

  return (
    <Box
      role="tablist"
      aria-label="Writing Practice phases"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 3,
        py: 2,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: theme.palette.background.paper,
      }}
    >
      {PHASES.map((phase, idx) => {
        const isActive = phase.id === activePhase;
        const isLocked = idx > 0 && !sourceLocked;

        return (
          <Tooltip
            key={phase.id}
            title={isLocked ? 'Lock the source paragraph first' : phase.blurb}
            arrow
          >
            <Box
              role="tab"
              aria-selected={isActive}
              aria-disabled={isLocked}
              onClick={() => {
                if (isLocked) return;
                onChange(phase.id);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: 999,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.3 : 1,
                bgcolor: isActive ? alpha(accent, 0.12) : 'transparent',
                color: isActive ? accent : theme.palette.text.primary,
                border: `1px solid ${isActive ? accent : 'transparent'}`,
                transition: 'all 200ms ease-out',
                '&:hover': {
                  bgcolor: isLocked
                    ? 'transparent'
                    : isActive
                      ? alpha(accent, 0.16)
                      : alpha(accent, 0.06),
                },
              }}
            >
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {phase.meta}
              </Typography>
              {isLocked ? <LockIcon sx={{ fontSize: 14 }} /> : null}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

export default PhaseTabBar;
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/views/writing/PhaseTabBar.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): PhaseTabBar — segmented tab bar with locked state"
```

---

## Task 8: `MaskedToken` — single occlusion-block + inline input

The interactive cell of the Recall ladder. Each `${word}` from the AI's masked paragraph becomes one of these.

**Files:**
- Create: `src/renderer/views/writing/MaskedToken.js`

- [ ] **Step 1: Implement the component**

```jsx
// src/renderer/views/writing/MaskedToken.js
import React, { useRef, useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import { commitMaskAttempt } from './maskAttempt';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
`;

const reveal = (accent) => keyframes`
  0%   { background-color: ${alpha(accent, 0.4)}; transform: scale(1.04); }
  100% { background-color: ${alpha(accent, 0.10)}; transform: scale(1); }
`;

function MaskedToken({ expected, accent, onResolved }) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | wrong | revealed | correct
  const [hint, setHint] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);
  const inputRef = useRef(null);

  const widthCh = Math.max(expected.length, 3);

  const handleCommit = () => {
    if (status === 'correct' || status === 'revealed') return;
    const result = commitMaskAttempt(value, expected);
    if (result.ok) {
      setStatus('correct');
      setHint(null);
      onResolved && onResolved('correct');
      return;
    }
    if (!value) return; // empty blur does nothing
    const nextWrong = wrongCount + 1;
    setWrongCount(nextWrong);
    setHint(result.hint);
    if (nextWrong >= 2) {
      setStatus('revealed');
      setValue(expected);
      onResolved && onResolved('revealed');
    } else {
      setStatus('wrong');
      // brief shake, then return to idle so user can try again
      setTimeout(() => setStatus('idle'), 200);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      handleCommit();
    }
  };

  const peek = () => {
    setStatus('revealed');
    setValue(expected);
    onResolved && onResolved('revealed');
  };

  const isResolved = status === 'correct' || status === 'revealed';

  // Background fill mimics an occlusion block; baseline aligned with surrounding text.
  return (
    <Tooltip
      title={isResolved ? '' : hint || 'Type the missing word, then Tab or Enter'}
      placement="top"
      arrow
      enterDelay={400}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'baseline',
          mx: '2px',
          px: '6px',
          minWidth: `${widthCh}ch`,
          borderRadius: '6px',
          backgroundColor: alpha(accent, 0.10),
          borderBottom: isResolved
            ? `1.5px solid ${accent}`
            : `1.5px dashed ${alpha(accent, 0.6)}`,
          color: isResolved
            ? status === 'revealed'
              ? theme.palette.warning.main
              : accent
            : theme.palette.text.primary,
          fontWeight: isResolved ? 600 : 500,
          fontFamily: isResolved ? 'inherit' : MONO,
          animation:
            status === 'wrong'
              ? `${shake} 150ms ease-in-out`
              : status === 'correct'
                ? `${reveal(accent)} 300ms ease-out`
                : 'none',
          position: 'relative',
        }}
      >
        <input
          ref={inputRef}
          value={value}
          disabled={isResolved}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKey}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            width: `${widthCh}ch`,
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'inherit',
            fontWeight: 'inherit',
            textAlign: isResolved ? 'left' : 'center',
            cursor: isResolved ? 'default' : 'text',
          }}
          aria-label={
            isResolved
              ? `revealed: ${expected}`
              : hint
                ? `try again. Hint: ${hint}`
                : 'masked word'
          }
        />
        {!isResolved && (
          <VisibilityIcon
            onClick={peek}
            sx={{
              fontSize: 12,
              ml: 0.5,
              cursor: 'pointer',
              opacity: 0.5,
              '&:hover': { opacity: 1 },
            }}
            aria-label="reveal this word"
          />
        )}
      </Box>
    </Tooltip>
  );
}

export default MaskedToken;
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/views/writing/MaskedToken.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): MaskedToken — typed-input occlusion cell"
```

---

## Task 9: `RecallLadder` — Phase 2 panel

Drives the 3 rungs over one source paragraph; renders the masked text by tokenizing `${…}` spans into `MaskedToken`s.

**Files:**
- Create: `src/renderer/views/writing/RecallLadder.js`

- [ ] **Step 1: Implement the component**

```jsx
// src/renderer/views/writing/RecallLadder.js
import React, { useMemo, useState } from 'react';
import { Box, Typography, Tooltip, Fade } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { RUNGS } from './config';
import MaskedToken from './MaskedToken';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function tokenize(text) {
  const re = /\$\{(.*?)\}/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
    out.push({ kind: 'mask', value: m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

function RecallLadder({
  variants,         // { light, medium, hard }
  loading,          // true while AI fetch in flight
  accent,
  onAllResolved,    // (rungId) => void — called when current rung's last token resolves
  onContinue,       // () => void — Continue to Compose
}) {
  const theme = useTheme();
  const [activeRung, setActiveRung] = useState('light');
  const [rungProgress, setRungProgress] = useState({ light: 0, medium: 0, hard: 0 });

  const masked = variants[activeRung] || '';
  const tokens = useMemo(() => tokenize(masked), [masked]);
  const totalMasks = tokens.filter((t) => t.kind === 'mask').length;
  const resolved = rungProgress[activeRung] || 0;

  const handleResolved = () => {
    setRungProgress((prev) => {
      const next = { ...prev, [activeRung]: (prev[activeRung] || 0) + 1 };
      if ((next[activeRung] || 0) >= totalMasks && totalMasks > 0) {
        onAllResolved && onAllResolved(activeRung);
      }
      return next;
    });
  };

  const mediumComplete = (rungProgress.medium || 0) > 0; // glow nudge

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        borderLeft: `4px solid ${accent}`,
        overflow: 'hidden',
      }}
    >
      {/* rung selector */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {RUNGS.map((rung) => {
            const isActive = rung.id === activeRung;
            const done = rungProgress[rung.id] || 0;
            return (
              <Tooltip key={rung.id} title={rung.blurb} arrow>
                <Box
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveRung(rung.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 999,
                    cursor: 'pointer',
                    bgcolor: isActive ? alpha(accent, 0.12) : 'transparent',
                    color: isActive ? accent : theme.palette.text.primary,
                    border: `1px solid ${isActive ? accent : 'transparent'}`,
                    '&:hover': {
                      bgcolor: isActive ? alpha(accent, 0.16) : alpha(accent, 0.06),
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '0.9rem' }}>
                    {done > 0 ? rung.glyphEngaged : '○'}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: MONO,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {rung.label}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.72rem',
            color: theme.palette.text.secondary,
          }}
        >
          {resolved} / {totalMasks} {resolved === totalMasks && totalMasks > 0 ? '✓' : ''}
        </Typography>
      </Box>

      {/* paragraph */}
      <Box
        sx={{
          p: 3,
          fontFamily: SERIF,
          fontSize: '18px',
          lineHeight: 2,
          maxWidth: 680,
          minHeight: 200,
          color: theme.palette.text.primary,
        }}
      >
        {loading ? (
          <Typography color="text.secondary">Preparing ladder…</Typography>
        ) : (
          <Fade in key={activeRung} timeout={200}>
            <Box>
              {tokens.map((t, i) =>
                t.kind === 'text' ? (
                  <span key={`t${i}`}>{t.value}</span>
                ) : (
                  <MaskedToken
                    key={`m${i}-${activeRung}`}
                    expected={t.value}
                    accent={accent}
                    onResolved={handleResolved}
                  />
                ),
              )}
            </Box>
          </Fade>
        )}
      </Box>

      {/* footer */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 2,
        }}
      >
        <Typography
          component="button"
          onClick={onContinue}
          sx={{
            fontFamily: MONO,
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            border: 'none',
            borderRadius: 1,
            background: accent,
            color: '#fff',
            cursor: 'pointer',
            px: 2,
            py: 0.75,
            boxShadow: mediumComplete ? `0 0 0 4px ${alpha(accent, 0.25)}` : 'none',
            transition: 'box-shadow 250ms ease-out',
          }}
        >
          Continue to Compose →
        </Typography>
      </Box>
    </Box>
  );
}

export default RecallLadder;
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/views/writing/RecallLadder.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): RecallLadder — 3-rung Phase 2 panel"
```

---

## Task 10: `FiveWRail` — collapsed-by-default 5W reference

**Files:**
- Create: `src/renderer/views/writing/FiveWRail.js`

- [ ] **Step 1: Implement the component**

```jsx
// src/renderer/views/writing/FiveWRail.js
import React, { useState } from 'react';
import { Box, Typography, Collapse, IconButton } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

const SLOTS = [
  { key: 'who',   label: 'Who',   icon: '👤' },
  { key: 'what',  label: 'What',  icon: '📝' },
  { key: 'when',  label: 'When',  icon: '🕐' },
  { key: 'where', label: 'Where', icon: '📍' },
  { key: 'why',   label: 'Why',   icon: '💡' },
];

function firstScene(data) {
  if (!data) return null;
  if (Array.isArray(data?.data) && data.data.length > 0) return data.data[0];
  if (typeof data === 'object') return data;
  return null;
}

function FiveWRail({ lang5w, accent }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const scene = firstScene(lang5w);

  const inline = SLOTS.map((s) => {
    const val = scene && scene[s.key] ? scene[s.key] : '—';
    return `${s.label.toUpperCase()} ${val}`;
  }).join(' · ');

  return (
    <Box
      sx={{
        bgcolor: alpha(accent, 0.06),
        borderRadius: '14px',
        border: `1px solid ${alpha(accent, 0.2)}`,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          cursor: 'pointer',
        }}
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: accent,
          }}
        >
          SCENE (5W)
        </Typography>
        <Typography
          sx={{
            flex: 1,
            fontSize: '0.85rem',
            color: theme.palette.text.secondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {open ? '' : inline}
        </Typography>
        <IconButton size="small">
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box
          sx={{
            px: 2,
            pb: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 1.5,
          }}
        >
          {SLOTS.map(({ key, label, icon }) => (
            <Box
              key={key}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(accent, 0.08),
                border: `1px solid ${alpha(accent, 0.15)}`,
              }}
            >
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: accent,
                  mb: 0.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {icon} {label}
              </Typography>
              <Typography
                sx={{ fontSize: '0.85rem', color: theme.palette.text.primary }}
              >
                {(scene && scene[key]) || '—'}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

export default FiveWRail;
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/views/writing/FiveWRail.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): FiveWRail — collapsed-by-default 5W reference"
```

---

## Task 11: `DiffSpan` — colored inline span with hover pair-link

**Files:**
- Create: `src/renderer/views/writing/DiffSpan.js`

- [ ] **Step 1: Implement the component**

```jsx
// src/renderer/views/writing/DiffSpan.js
import React from 'react';
import { Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { DIFF_COLORS } from './config';

function colorFor(kind, mode) {
  if (kind === 'grammar') return DIFF_COLORS.grammar[mode];
  if (kind === 'weaker') return DIFF_COLORS.weaker[mode];
  if (kind === 'stronger') return DIFF_COLORS.weaker[mode]; // pair-mate of weaker
  return DIFF_COLORS.match[mode];
}

function DiffSpan({ kind, pairId, hoveredPairId, onHoverPair, children }) {
  const theme = useTheme();
  const mode = theme.palette.mode;
  const color = colorFor(kind, mode);
  const isPaired = pairId && hoveredPairId === pairId;

  // Layering rule (spec R2): grammar squiggle wins, weaker/stronger highlight as bg tint.
  const styles =
    kind === 'grammar'
      ? {
          textDecoration: 'underline',
          textDecorationStyle: 'wavy',
          textDecorationColor: alpha(color, 0.7),
          padding: '0 2px',
        }
      : kind === 'match'
        ? {
            borderBottom: `1.5px solid ${alpha(color, 0.6)}`,
          }
        : {
            backgroundColor: isPaired ? alpha(color, 0.25) : alpha(color, 0.12),
            borderRadius: '3px',
            padding: '0 4px',
            transition: 'background-color 150ms ease-out',
          };

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

- [ ] **Step 2: Commit**

```bash
git add src/renderer/views/writing/DiffSpan.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): DiffSpan — colored inline span with pair link"
```

---

## Task 12: `ExpressionDiffPanel` — side-by-side + Expression Notes rail

Renders the diff over the original + learner text. Walks each text once, inserting `DiffSpan` for spans on that side; everything else is plain text.

**Files:**
- Create: `src/renderer/views/writing/ExpressionDiffPanel.js`

- [ ] **Step 1: Implement the component**

```jsx
// src/renderer/views/writing/ExpressionDiffPanel.js
import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import DiffSpan from './DiffSpan';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

// Find non-overlapping span occurrences in `text`. Returns array of
// { start, end, kind, pairId } sorted by start, dropping overlaps (first-wins).
function locateSpans(text, sideSpans) {
  const found = [];
  for (const s of sideSpans) {
    const idx = text.indexOf(s.text);
    if (idx >= 0) {
      found.push({
        start: idx,
        end: idx + s.text.length,
        kind: s.kind,
        pairId: s.pair_id || null,
      });
    }
  }
  found.sort((a, b) => a.start - b.start);
  const out = [];
  let lastEnd = -1;
  for (const f of found) {
    if (f.start >= lastEnd) {
      out.push(f);
      lastEnd = f.end;
    }
  }
  return out;
}

function renderSide(text, sideSpans, fontStack, hoveredPairId, onHoverPair) {
  const spans = locateSpans(text, sideSpans);
  const out = [];
  let last = 0;
  spans.forEach((s, i) => {
    if (s.start > last) {
      out.push(<span key={`t${i}`}>{text.slice(last, s.start)}</span>);
    }
    out.push(
      <DiffSpan
        key={`s${i}`}
        kind={s.kind}
        pairId={s.pairId}
        hoveredPairId={hoveredPairId}
        onHoverPair={onHoverPair}
      >
        {text.slice(s.start, s.end)}
      </DiffSpan>,
    );
    last = s.end;
  });
  if (last < text.length) out.push(<span key="tend">{text.slice(last)}</span>);
  return (
    <Box sx={{ fontFamily: fontStack, fontSize: '17px', lineHeight: 1.8 }}>
      {out}
    </Box>
  );
}

function ExpressionDiffPanel({ original, learner, diff, accent }) {
  const theme = useTheme();
  const [hoveredPairId, setHoveredPairId] = useState(null);
  const originalSpans = (diff?.spans || []).filter((s) => s.side === 'original');
  const learnerSpans = (diff?.spans || []).filter((s) => s.side === 'learner');

  const upgradeCount = (diff?.notes || []).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}
      >
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            borderRadius: '14px',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            borderLeft: `4px solid ${accent}`,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: theme.palette.text.secondary,
              }}
            >
              ORIGINAL
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            {renderSide(
              original,
              originalSpans,
              SERIF,
              hoveredPairId,
              setHoveredPairId,
            )}
          </Box>
        </Box>

        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            borderRadius: '14px',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            borderLeft: `4px solid ${alpha(accent, 0.4)}`,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: theme.palette.text.secondary,
              }}
            >
              YOUR VERSION
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            {renderSide(
              learner,
              learnerSpans,
              SANS,
              hoveredPairId,
              setHoveredPairId,
            )}
          </Box>
        </Box>
      </Box>

      {/* Expression Notes rail */}
      {(diff?.notes || []).length > 0 && (
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            borderRadius: '14px',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            p: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: theme.palette.text.secondary,
              }}
            >
              EXPRESSION NOTES
            </Typography>
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.72rem',
                color: theme.palette.text.secondary,
              }}
            >
              {upgradeCount} upgrade{upgradeCount === 1 ? '' : 's'}
            </Typography>
          </Box>
          {diff.notes.map((n) => {
            const isHovered = hoveredPairId === n.pair_id;
            return (
              <Box
                key={n.pair_id}
                onMouseEnter={() => setHoveredPairId(n.pair_id)}
                onMouseLeave={() => setHoveredPairId(null)}
                sx={{
                  borderLeft: `3px solid ${isHovered ? accent : alpha(accent, 0.3)}`,
                  pl: 1.5,
                  py: 1,
                  mb: 1,
                  bgcolor: isHovered ? alpha(accent, 0.04) : 'transparent',
                  transition: 'all 150ms ease-out',
                }}
              >
                <Typography sx={{ fontSize: '0.9rem' }}>
                  You: <em>"{n.learner_phrase}"</em>  →  Original:{' '}
                  <em>"{n.original_phrase}"</em>
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    color: theme.palette.text.secondary,
                    mt: 0.5,
                  }}
                >
                  {n.explanation}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export default ExpressionDiffPanel;
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/views/writing/ExpressionDiffPanel.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): ExpressionDiffPanel — side-by-side + notes rail"
```

---

## Task 13: `ComposeCompare` — Phase 3 orchestrator

State A (composing) vs State B (comparing) inside one panel. Owns the Compose AI call + 5W call.

**Files:**
- Create: `src/renderer/views/writing/ComposeCompare.js`

- [ ] **Step 1: Implement the component**

```jsx
// src/renderer/views/writing/ComposeCompare.js
import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Drawer,
  IconButton,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import MultilineTextField from './MultilineTextField';
import FiveWRail from './FiveWRail';
import ExpressionDiffPanel from './ExpressionDiffPanel';
import spineApi from '../../api/spineApi';
import {
  langstudy5wPrompt,
  langstudyExpressionDiffPrompt,
} from '../../../commons/utils/AIPrompts';
import { parseExpressionDiff } from './expressionDiffParser';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function ComposeCompare({ originalText, accent }) {
  const theme = useTheme();
  const [lang5w, setLang5w] = useState(null);
  const [mywriting, setMywriting] = useState('');
  const [stage, setStage] = useState('compose'); // 'compose' | 'compare'
  const [diff, setDiff] = useState(null);
  const [loading5w, setLoading5w] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [refOpen, setRefOpen] = useState(false);

  // Load 5W once per source text.
  useEffect(() => {
    let cancelled = false;
    async function go() {
      if (!originalText || lang5w) return;
      setLoading5w(true);
      try {
        const res = await spineApi.generateContentWithJson(
          `${langstudy5wPrompt}\n ${originalText}`,
          null,
          { label: 'writing-5w-scaffold' },
        );
        if (!cancelled) setLang5w(res);
      } catch (err) {
        console.error('5W fetch failed', err);
      } finally {
        if (!cancelled) setLoading5w(false);
      }
    }
    go();
    return () => {
      cancelled = true;
    };
  }, [originalText]);

  const handleCompare = async () => {
    if (!mywriting.trim() || !originalText) return;
    setLoadingDiff(true);
    try {
      const res = await spineApi.generateContentWithJson(
        langstudyExpressionDiffPrompt(originalText, mywriting),
        null,
        { label: 'writing-expression-diff' },
      );
      setDiff(parseExpressionDiff(res));
      setStage('compare');
    } catch (err) {
      console.error('Expression diff failed', err);
    } finally {
      setLoadingDiff(false);
    }
  };

  const wordCount = mywriting.trim() ? mywriting.trim().split(/\s+/).length : 0;
  const minWords = 10;
  const canCompare = wordCount >= minWords && !loadingDiff;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {stage === 'compose' && (
        <>
          {loading5w ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} sx={{ color: accent }} />
              <Typography variant="body2" color="text.secondary">
                Pulling the scene…
              </Typography>
            </Box>
          ) : (
            <FiveWRail lang5w={lang5w} accent={accent} />
          )}

          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              borderRadius: '14px',
              border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              borderLeft: `4px solid ${accent}`,
              p: 2,
              fontFamily: SERIF,
            }}
          >
            <MultilineTextField
              initialText={mywriting}
              placeholder="Express the same idea in your own words…"
              onTextChange={setMywriting}
              colors={{ accent }}
              minimal
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 1,
              }}
            >
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: '0.72rem',
                  color: theme.palette.text.secondary,
                }}
              >
                {wordCount} word{wordCount === 1 ? '' : 's'}
                {wordCount < minWords ? ` · ${minWords - wordCount} more to compare` : ''}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton size="small" onClick={() => setRefOpen(true)}>
                  <InfoOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography
                  component="button"
                  disabled={!canCompare}
                  onClick={handleCompare}
                  sx={{
                    fontFamily: MONO,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    border: 'none',
                    borderRadius: 1,
                    background: canCompare ? accent : alpha(accent, 0.3),
                    color: '#fff',
                    cursor: canCompare ? 'pointer' : 'not-allowed',
                    px: 2,
                    py: 0.75,
                    opacity: canCompare ? 1 : 0.5,
                  }}
                >
                  {loadingDiff ? 'Comparing…' : 'Compare with original →'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </>
      )}

      {stage === 'compare' && diff && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: theme.palette.text.secondary,
              }}
            >
              COMPARING
            </Typography>
            <Typography
              component="button"
              onClick={() => setStage('compose')}
              sx={{
                fontFamily: MONO,
                fontSize: '0.72rem',
                background: 'transparent',
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                color: theme.palette.text.secondary,
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                cursor: 'pointer',
              }}
            >
              ← Edit my version
            </Typography>
          </Box>
          <ExpressionDiffPanel
            original={originalText}
            learner={mywriting}
            diff={diff}
            accent={accent}
          />
        </>
      )}

      <Drawer
        anchor="right"
        open={refOpen}
        onClose={() => setRefOpen(false)}
        PaperProps={{ sx: { width: 420, p: 3 } }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: '0.72rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            REFERENCE ORIGINAL
          </Typography>
          <IconButton size="small" onClick={() => setRefOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Typography sx={{ fontFamily: SERIF, fontSize: '17px', lineHeight: 1.8 }}>
          {originalText}
        </Typography>
      </Drawer>
    </Box>
  );
}

export default ComposeCompare;
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/views/writing/ComposeCompare.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): ComposeCompare — Phase 3 orchestrator"
```

---

## Task 14: Rewrite `WritingView` orchestrator

Replaces the 905-line current implementation with a slim shell.

**Files:**
- Modify: `src/renderer/views/writing/WritingView.js`

- [ ] **Step 1: Replace the file contents**

```jsx
// src/renderer/views/writing/WritingView.js
import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PhaseTabBar from './PhaseTabBar';
import SourcePanel from './SourcePanel';
import RecallLadder from './RecallLadder';
import ComposeCompare from './ComposeCompare';
import { ACCENT, PHASES } from './config';
import { langstudyRecallLadderPrompt } from '../../../commons/utils/AIPrompts';
import { parseRecallLadder } from './recallLadderParser';
import spineApi from '../../api/spineApi';

function WritingView() {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';

  const [activePhase, setActivePhase] = useState('prepare');
  const [text, setText] = useState('');
  const [sourceLocked, setSourceLocked] = useState(false);
  const [recallVariants, setRecallVariants] = useState({ light: '', medium: '', hard: '' });
  const [recallLoading, setRecallLoading] = useState(false);

  const phaseIdx = PHASES.findIndex((p) => p.id === activePhase);
  const intensityKey = phaseIdx === 0 ? 200 : phaseIdx === 1 ? 400 : 600;
  const accent = ACCENT[mode][intensityKey];

  // Fetch the recall ladder when first entering Recall.
  useEffect(() => {
    let cancelled = false;
    async function go() {
      if (
        activePhase !== 'recall' ||
        !sourceLocked ||
        !text ||
        recallVariants.light
      ) {
        return;
      }
      setRecallLoading(true);
      try {
        const res = await spineApi.generateContentWithJson(
          langstudyRecallLadderPrompt(text),
          null,
          { label: 'writing-recall-ladder' },
        );
        if (!cancelled) setRecallVariants(parseRecallLadder(res));
      } catch (err) {
        console.error('Recall ladder fetch failed', err);
      } finally {
        if (!cancelled) setRecallLoading(false);
      }
    }
    go();
    return () => {
      cancelled = true;
    };
  }, [activePhase, sourceLocked, text, recallVariants.light]);

  const handleLock = () => {
    if (!text.trim()) return;
    setSourceLocked(true);
    setActivePhase('recall');
  };

  const handleUnlock = () => {
    setSourceLocked(false);
    setRecallVariants({ light: '', medium: '', hard: '' });
    setActivePhase('prepare');
  };

  const handleTextChange = (next) => {
    setText(next);
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      <PhaseTabBar
        activePhase={activePhase}
        sourceLocked={sourceLocked}
        onChange={setActivePhase}
        accent={accent}
      />
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          py: 3,
          px: { xs: 2, md: 3 },
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 1200 }}>
          {activePhase === 'prepare' && (
            <SourcePanel
              text={text}
              onTextChange={handleTextChange}
              sourceLocked={sourceLocked}
              onLock={handleLock}
              onUnlock={handleUnlock}
              accent={accent}
            />
          )}
          {activePhase === 'recall' && (
            <RecallLadder
              variants={recallVariants}
              loading={recallLoading}
              accent={accent}
              onContinue={() => setActivePhase('compose')}
            />
          )}
          {activePhase === 'compose' && (
            <ComposeCompare originalText={text} accent={accent} />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default WritingView;
```

- [ ] **Step 2: Run lint to verify**

```bash
npm run lint -- src/renderer/views/writing/
```
Expected: no errors from the writing folder. Old files (ParagraphWithHiddenWords, ComparisonExercise, …) may still lint clean because they exist as unused files — that's fine; they're deleted in Task 15.

- [ ] **Step 3: Run unit tests to confirm no regressions**

```bash
npm test -- writing
```
Expected: 3 test suites (mask attempt, recall ladder parser, expression diff parser) pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/writing/WritingView.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(writing): rewrite WritingView as 3-phase shell"
```

---

## Task 15: Delete dead files + obsolete prompts

**Files:**
- Delete: `src/renderer/views/writing/ParagraphWithHiddenWords.js`
- Delete: `src/renderer/views/writing/ParagraphComparer.js`
- Delete: `src/renderer/views/writing/ComparisonExercise.js`
- Delete: `src/renderer/views/writing/AnnotatedText.js`
- Delete: `src/renderer/views/writing/WritingStepper.js`
- Delete: `src/renderer/views/writing/AlignmentDisplay.js`
- Delete: `src/renderer/views/writing/globalAlign.js`
- Modify: `src/commons/utils/AIPrompts.js`

- [ ] **Step 1: Confirm none of the deletables are imported outside writing/**

```bash
grep -RE "ParagraphWithHiddenWords|ParagraphComparer|ComparisonExercise|AnnotatedText|WritingStepper|globalAlign|AlignmentDisplay" src --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" | grep -v "src/renderer/views/writing/" | grep -v "src/__tests__/"
```
Expected: no output.

- [ ] **Step 2: Delete the files**

```bash
git rm src/renderer/views/writing/ParagraphWithHiddenWords.js \
       src/renderer/views/writing/ParagraphComparer.js \
       src/renderer/views/writing/ComparisonExercise.js \
       src/renderer/views/writing/AnnotatedText.js \
       src/renderer/views/writing/WritingStepper.js \
       src/renderer/views/writing/AlignmentDisplay.js \
       src/renderer/views/writing/globalAlign.js
```

- [ ] **Step 3: Remove the obsolete prompts from `AIPrompts.js`**

Open [src/commons/utils/AIPrompts.js](src/commons/utils/AIPrompts.js) and delete:
- The constants `langstudyNoun`, `langstudyVerb`, `langstudyPreposition`, `langstudyCommon`, `langstudyStructure` (lines 6–10).
- The named export `langstudyAnnotatePrompt` (wherever it lives — search for `export const langstudyAnnotatePrompt`).
- The named exports `langstudyGrammarCheckPrompt`, `langstudyComparisonExercise`, `langstudyComparisonExerciseMore` (search each by name).

Keep `langstudy5wPrompt`. Keep the two new prompts from Task 5.

- [ ] **Step 4: Verify no remaining references**

```bash
grep -RE "langstudyAnnotatePrompt|langstudyGrammarCheckPrompt|langstudyComparisonExercise|langstudyComparisonExerciseMore|langstudyNoun|langstudyVerb|langstudyPreposition|langstudyCommon|langstudyStructure" src --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
```
Expected: no output. (The unimported comment in `GrammarCheckSkill.js` mentions `langstudyComparisonExercise` in a `/* */` — that's prose, ignore.) If the grep surfaces hits in non-deleted files, fix those imports before continuing.

- [ ] **Step 5: Run lint + tests**

```bash
npm run lint
npm test -- writing
```
Expected: lint clean, 3 writing-related suites pass.

- [ ] **Step 6: Commit**

```bash
git add -A src/renderer/views/writing/ src/commons/utils/AIPrompts.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "chore(writing): remove legacy POS-step flow + obsolete prompts"
```

---

## Task 16: Manual smoke test + final verification

Code correctness has been verified by tests; this task verifies feature correctness.

- [ ] **Step 1: Start the app**

```bash
npm start
```
Expected: webpack dev server boots on :1212, Electron window opens.

- [ ] **Step 2: Navigate to Writing Practice**

Open the menu / route the user reaches the writing view from today. The 3-pill tab bar should appear at the top with `1 PREPARE` filled (teal), `2 RECALL` and `3 COMPOSE` greyed out with a lock glyph.

- [ ] **Step 3: Verify the bug fix**

In the source textarea, **type** (not paste) the following character by character:

```
The quick brown fox jumps over the lazy dog.
```

Expected: every keystroke is captured. The field never loses focus. Word count updates as you type.

- [ ] **Step 4: Lock the source**

Click "Continue →". Expected: tag flips to `○ LOCKED`, the `2 RECALL` tab activates, and the page renders the Recall ladder with a "Preparing ladder…" message that resolves in a few seconds into the masked Light variant.

- [ ] **Step 5: Try the recall ladder**

Click into a masked token, type the expected word, press Tab. Expected: occlusion fades to teal text on tinted bg with a brief flash. Counter (top-right) ticks up.

Switch to Medium and Hard rungs. Expected: same paragraph re-renders with different masking; previous rung's progress persists (the glyph stays `●`).

- [ ] **Step 6: Continue to Compose**

Click "Continue to Compose →". Expected: `3 COMPOSE` tab activates. 5W rail loads at top (briefly shows "Pulling the scene…", then a one-line `WHO · WHAT · WHEN · WHERE · WHY` summary). Free-write textarea below.

- [ ] **Step 7: Write and compare**

Write a re-expression of the original paragraph (≥10 words). Click "Compare with original →".

Expected: side-by-side appears. Original (serif, left) and learner (sans, right). Amber-highlighted phrases on the learner side; on hover the matching original phrase highlights and a connector forms (via the Expression Notes rail below mutually highlighting).

If the LLM returned zero notes, the rail just doesn't render — verify by writing a near-verbatim copy. If notes appear, click into one to verify the explanation text reads naturally.

- [ ] **Step 8: Edit-my-version round trip**

Click "← Edit my version". Expected: returns to State A with your text intact. Click "Compare with original →" again — a fresh AI call fires.

- [ ] **Step 9: Source unlock**

Go back to `1 PREPARE`. Click the pencil glyph (top-right of the source panel). Expected: source becomes editable; tag flips back to `● UNLOCKED`; recall variants reset (re-fetch on next Recall entry).

- [ ] **Step 10: Verify AI call count**

Open the Brain Spine Economics Panel (`/knowledge` → Brain Dashboard → Spend & Returns). Filter by labels starting with `writing-`. Expected three intent labels — `writing-recall-ladder`, `writing-5w-scaffold`, `writing-expression-diff` — and a total of 3 calls for the smoke-tested paragraph (1 per intent).

- [ ] **Step 11: Final commit + push if everything looks good**

If smoke passed, nothing more to commit (Tasks 1–15 already covered all code). If you found a smoke-only fix, commit it with a `fix(writing)` prefix.

- [ ] **Step 12: Update CLAUDE.md if architecture-relevant**

The redesign keeps the writing view's external footprint identical (still routed the same way, same place in the menu). No CLAUDE.md change needed unless the Phase-9 economics coverage doc ([docs/technical/phase-9c-economics-coverage.md](docs/technical/phase-9c-economics-coverage.md)) needs the new intent labels added — check whether old `writing-mapping` / `writing-view` labels appear there and update if so.

---

## Self-review

Completed before plan handoff:

**Spec coverage** — every spec section has a corresponding task:
- 3-phase shell + tab bar → Tasks 1, 7, 14
- SourcePanel + bug fix → Task 6
- Recall ladder 3 rungs + occlusion blocks + typed input → Tasks 2, 8, 9
- 5W rail (moved to Compose) → Task 10
- Expression-aware diff → Tasks 4, 11, 12
- ComposeCompare Phase 3 → Task 13
- AI prompts collapsed → Tasks 5, 15
- Teal accent ramp → Task 1 (`ACCENT` export), consumed everywhere
- Dead-code removal → Task 15
- Manual smoke success criteria → Task 16

**Type consistency** — `PHASES` / `RUNGS` / `ACCENT` / `DIFF_COLORS` names match across all tasks; `parseRecallLadder` / `parseExpressionDiff` exported names match consumers in Tasks 9, 13; `commitMaskAttempt` matches usage in Task 8.

**Placeholders** — no "TBD" / "TODO" / "similar to" / "appropriate" hand-waves. Each component task carries the full code body. Each test task carries the actual test code and the expected pass/fail outcome.

**Spec → plan deltas** (already in the Divergences section) are accurate to what was discovered during plan drafting.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-29-writing-practice-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
