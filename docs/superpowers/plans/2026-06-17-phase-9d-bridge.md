# Phase 9d — Bridge Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build `meteredCallJson` + the IPC bridge (`spineHandlers` + `spineApi`) so renderer-direct + main-process JSON LLM call sites can record to the Call Ledger. Migrate two demo sites to prove both paths.

**Architecture:** Two new spine entries on the main side, one polymorphic IPC channel, one renderer client mirroring `aiProviderManager`'s shape. Two demo migrations as proof.

**Spec:** [docs/superpowers/specs/2026-06-17-phase-9d-bridge-design.md](../specs/2026-06-17-phase-9d-bridge-design.md)
**Predecessors:** Plans 9a, 9b, 9c.

---

## File Structure

**Created:**
- `src/main/brain/spine/meteredCallJson.js`
- `src/main/ipc/spineHandlers.js`
- `src/renderer/api/spineApi.js`
- `src/__tests__/spine/meteredCallJson.test.js`
- `src/__tests__/spine/spineHandlers.test.js`

**Modified:**
- `src/main/brain/spine/index.js` — re-export `meteredCallJson`
- `src/main/main.ts` — register `spineHandlers`
- `src/main/utils/AIConceptExtractionService.js` — demo migration 1
- `src/renderer/views/translate/StepTwoVerbCard.js` — demo migration 2
- `docs/technical/phase-9c-economics-coverage.md` — update gap status

---

## Task 1: `meteredCallJson` TDD

**Files:**
- Create: `src/main/brain/spine/meteredCallJson.js`
- Create: `src/__tests__/spine/meteredCallJson.test.js`

### Test

```js
// src/__tests__/spine/meteredCallJson.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
  default: undefined,
}));

const mockGenerateJson = jest.fn();
jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInMain: {
    currentProviderName: 'deepseek-v3',
    currentProvider: {
      name: 'deepseek-v3',
      generateContent: jest.fn(),
    },
    generateContentWithJson: (...args) => mockGenerateJson(...args),
  },
}));

beforeEach(() => {
  testDb = new Database(':memory:');
  const sql = fs
    .readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8')
    .split('\n')
    .filter((l) => !l.includes('"sqlite_sequence"'))
    .join('\n');
  testDb.exec(sql);
  mockGenerateJson.mockReset();
});
afterEach(() => { testDb.close(); });

const meteredCallJson = require('../../main/brain/spine/meteredCallJson');

describe('meteredCallJson', () => {
  test('records a ledger row tagged with legacy:<label> for JSON sites', async () => {
    mockGenerateJson.mockResolvedValue({ concepts: ['duration', 'convexity'] });
    const { output, callId } = await meteredCallJson(
      'extract concepts',
      { type: 'object', properties: { concepts: { type: 'array' } } },
      { legacyLabel: 'concept-extraction' },
    );
    expect(output).toEqual({ concepts: ['duration', 'convexity'] });
    const row = testDb.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.intent).toBe('legacy:concept-extraction');
    expect(row.provider).toBe('deepseek-v3');
    expect(JSON.parse(row.output_json)).toEqual({ concepts: ['duration', 'convexity'] });
  });

  test('throws when provider is null', async () => {
    const { instanceInMain } = require('../../commons/service/AIProviderManager');
    const saved = instanceInMain.currentProvider;
    instanceInMain.currentProvider = null;
    await expect(meteredCallJson('p', null, { legacyLabel: 'x' })).rejects.toThrow(/no AI provider/);
    instanceInMain.currentProvider = saved;
  });

  test('null schema is allowed', async () => {
    mockGenerateJson.mockResolvedValue({ x: 1 });
    const { callId } = await meteredCallJson('any prompt', null, { legacyLabel: 'free-form' });
    expect(callId).toBeGreaterThan(0);
  });
});
```

### Run failing test

```bash
npx jest src/__tests__/spine/meteredCallJson.test.js
```

Expected: FAIL — module not found.

### Implement

```js
// src/main/brain/spine/meteredCallJson.js
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');
const {
  instanceInMain: aiProviderManager,
} = require('../../../commons/service/AIProviderManager');

function summarize(out) {
  if (out == null) return null;
  const s = typeof out === 'string' ? out : JSON.stringify(out);
  return s.length > 500 ? s.slice(0, 500) : s;
}

async function meteredCallJson(prompt, schema, options = {}) {
  const label = options.legacyLabel || 'unknown';
  if (!aiProviderManager?.currentProvider) {
    throw new Error('[meteredCallJson] no AI provider configured');
  }
  const provider = aiProviderManager.currentProvider;
  const providerName = provider.name || aiProviderManager.currentProviderName || 'unknown';

  const t0 = Date.now();
  // The manager's existing JSON method handles schema injection per provider.
  // Some providers ignore the schema arg; that's fine — we still get JSON back.
  const output = await aiProviderManager.generateContentWithJson(prompt, true, schema);
  const duration_ms = Date.now() - t0;

  const prompt_tokens = costEstimator.estimateTokens(prompt);
  const completion_tokens = costEstimator.estimateTokens(output);
  const cost_usd = costEstimator.estimate(providerName, { prompt_tokens, completion_tokens });

  const callId = CallLedgerStore.record({
    intent: `legacy:${label}`,
    ts: Date.now(),
    provider: providerName,
    context_keys: [],
    prompt_tokens,
    completion_tokens,
    cost_usd,
    cache_hit: false,
    cache_key: null,
    duration_ms,
    trigger_id: options.triggerId || null,
    output_summary: summarize(output),
    output_json: output && typeof output === 'object' ? output : null,
  });
  return { output, callId };
}

module.exports = meteredCallJson;
```

### Run, expect PASS, commit

```bash
npx jest src/__tests__/spine/meteredCallJson.test.js
git add src/main/brain/spine/meteredCallJson.js src/__tests__/spine/meteredCallJson.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(spine): meteredCallJson — JSON sibling of meteredCall"
```

---

## Task 2: `spineHandlers` IPC + round-trip test

**Files:**
- Create: `src/main/ipc/spineHandlers.js`
- Create: `src/__tests__/spine/spineHandlers.test.js`

### Test (uses `ipcMain.handle` capture, no real Electron)

```js
// src/__tests__/spine/spineHandlers.test.js
const handlers = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel, fn) => handlers.set(channel, fn),
  },
}));

const mockMetered = jest.fn();
const mockMeteredJson = jest.fn();
jest.mock('../../main/brain/spine/meteredCall', () => (...args) => mockMetered(...args));
jest.mock('../../main/brain/spine/meteredCallJson', () => (...args) => mockMeteredJson(...args));

jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInMain: {
    currentProviderName: 'qwen-plus',
    currentProvider: { name: 'qwen-plus' },
  },
}));

const spineHandlers = require('../../main/ipc/spineHandlers');

beforeEach(() => {
  handlers.clear();
  mockMetered.mockReset();
  mockMeteredJson.mockReset();
  spineHandlers.register();
});

describe('spineHandlers', () => {
  test('text path routes through meteredCall', async () => {
    mockMetered.mockResolvedValue({ output: 'hello', callId: 1 });
    const fn = handlers.get('spine:meter');
    const res = await fn({}, { kind: 'text', label: 'x', prompt: 'say hi' });
    expect(res).toEqual({ output: 'hello', callId: 1 });
    expect(mockMetered).toHaveBeenCalled();
  });

  test('json path routes through meteredCallJson', async () => {
    mockMeteredJson.mockResolvedValue({ output: { foo: 1 }, callId: 2 });
    const fn = handlers.get('spine:meter');
    const schema = { type: 'object' };
    const res = await fn({}, { kind: 'json', label: 'y', prompt: 'p', schema });
    expect(res).toEqual({ output: { foo: 1 }, callId: 2 });
    expect(mockMeteredJson).toHaveBeenCalledWith('p', schema, { legacyLabel: 'y' });
  });

  test('returns error shape on dispatch failure', async () => {
    mockMetered.mockRejectedValue(new Error('boom'));
    const fn = handlers.get('spine:meter');
    const res = await fn({}, { kind: 'text', label: 'x', prompt: 'p' });
    expect(res.error).toBe('boom');
    expect(res.output).toBeNull();
  });
});
```

### Implement

```js
// src/main/ipc/spineHandlers.js
const { ipcMain } = require('electron');
const meteredCall = require('../brain/spine/meteredCall');
const meteredCallJson = require('../brain/spine/meteredCallJson');
const {
  instanceInMain: aiProviderManager,
} = require('../../commons/service/AIProviderManager');

function register() {
  ipcMain.handle('spine:meter', async (_e, { kind, label, prompt, schema }) => {
    try {
      if (kind === 'json') {
        const r = await meteredCallJson(prompt, schema || null, { legacyLabel: label });
        return { output: r.output, callId: r.callId };
      }
      const provider = aiProviderManager?.currentProvider;
      if (!provider) return { output: null, callId: null, error: 'no provider' };
      const r = await meteredCall(provider, prompt, { legacyLabel: label });
      return { output: r.output, callId: r.callId };
    } catch (e) {
      return { output: null, callId: null, error: e?.message || String(e) };
    }
  });
}

module.exports = { register };
```

### Run + commit

```bash
npx jest src/__tests__/spine/spineHandlers.test.js
git add src/main/ipc/spineHandlers.js src/__tests__/spine/spineHandlers.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(spine): spineHandlers IPC bridge for renderer-direct LLM calls"
```

---

## Task 3: `spineApi` renderer client

**Files:**
- Create: `src/renderer/api/spineApi.js`

### Implement

```js
// src/renderer/api/spineApi.js
/**
 * Renderer client for the Brain Spine bridge (Phase 9d).
 *
 * Mirrors `aiProviderManager` shape so cluster migrations are mechanical:
 *   - `aiProviderManager.generateContent(prompt)`         → `spineApi.generateContent(prompt, { label })`
 *   - `aiProviderManager.generateContentWithJson(prompt)` → `spineApi.generateContentWithJson(prompt, schema, { label })`
 *
 * Pass `{ label, withMeta: true }` if you need the `callId` back.
 */
const { ipcRenderer } = window.require ? window.require('electron') : require('electron');

async function invokeBridge(payload) {
  const res = await ipcRenderer.invoke('spine:meter', payload);
  if (res?.error) throw new Error(res.error);
  return res;
}

const spineApi = {
  async generateContent(prompt, options = {}) {
    const res = await invokeBridge({
      kind: 'text',
      label: options.label || 'unknown',
      prompt,
    });
    return options.withMeta ? res : res.output;
  },
  async generateContentWithJson(prompt, schema, options = {}) {
    const res = await invokeBridge({
      kind: 'json',
      label: options.label || 'unknown',
      prompt,
      schema: schema || null,
    });
    return options.withMeta ? res : res.output;
  },
};

export default spineApi;
```

### Commit

```bash
git add src/renderer/api/spineApi.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(spine): spineApi renderer client mirroring aiProviderManager shape"
```

---

## Task 4: Wire `spineHandlers` into main + re-export `meteredCallJson`

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/brain/spine/index.js`

### Step 1: Register handlers in main.ts

Find where `callLedgerHandlers.register()` is called (added in Plan 9a Task 20). Add adjacent:

```ts
const spineHandlers = require('./ipc/spineHandlers');
spineHandlers.register();
```

### Step 2: Re-export from barrel

Open `src/main/brain/spine/index.js` and add `meteredCallJson` to the module.exports object:

```js
module.exports = {
  brainCall: require('./brainCall'),
  meteredCall: require('./meteredCall'),
  meteredCallJson: require('./meteredCallJson'),  // ← new
  // ... rest unchanged
};
```

### Smoke verify

```bash
node -e "const s = require('./src/main/brain/spine'); console.log(typeof s.meteredCallJson)"
```

Expected: `function`.

### Commit

```bash
git add src/main/main.ts src/main/brain/spine/index.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(spine): wire spineHandlers into main; re-export meteredCallJson"
```

---

## Task 5: Demo migration 1 — `AIConceptExtractionService.js:62`

**Files:**
- Modify: `src/main/utils/AIConceptExtractionService.js`

### Step 1: Inspect the call site

```bash
sed -n '50,80p' src/main/utils/AIConceptExtractionService.js
```

Note the method this call lives in (likely `extractConcepts(...)` or similar) and whether it passes a schema to `generateContentWithJson`.

### Step 2: Replace

Find the first call at line ~62:

```js
const result = await aiProviderManager.generateContentWithJson(prompt, true);
```

Replace with:

```js
const meteredCallJson = require('../brain/spine/meteredCallJson');
const { output: result } = await meteredCallJson(
  prompt,
  null, // free-form JSON; provider-native JSON-mode handles shape
  { legacyLabel: 'concept-extraction' },
);
```

If the file has TWO call sites of `generateContentWithJson` (the 9c gap doc said lines 62 AND 130), migrate ONLY the first one for this task. The second call may be in a different method — flag it as a follow-up.

### Step 3: Smoke

```bash
npx jest src/__tests__/spine src/__tests__/integration/spine-end-to-end
```

Expected: still green.

If there's an existing test for AIConceptExtractionService, update its mocks (replace `aiProviderManager.generateContentWithJson` mock with a `meteredCallJson` mock from `'../../main/brain/spine/meteredCallJson'`).

### Commit

```bash
git add src/main/utils/AIConceptExtractionService.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "refactor(concept-extraction): first JSON call routed through meteredCallJson"
```

---

## Task 6: Demo migration 2 — `StepTwoVerbCard.js:63`

**Files:**
- Modify: `src/renderer/views/translate/StepTwoVerbCard.js`

### Step 1: Inspect

```bash
sed -n '50,75p' src/renderer/views/translate/StepTwoVerbCard.js
```

Confirm the call shape at line 63 is `await aiProviderManager.generateContent(prompt)` (plain text).

### Step 2: Replace

```js
// Add at top of file (near other imports):
import spineApi from '../../api/spineApi';
```

```js
// Line 63 replacement:
const r = await spineApi.generateContent(prompt, { label: 'translate-verb-step' });
```

If `aiProviderManager` is unused in the file after this edit, remove its import (`grep -n "aiProviderManager" src/renderer/views/translate/StepTwoVerbCard.js`).

### Step 3: Smoke

```bash
npx jest 2>&1 | tail -10
```

Confirm overall test suite hasn't regressed.

### Commit

```bash
git add src/renderer/views/translate/StepTwoVerbCard.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "refactor(translate): StepTwoVerbCard routes through spineApi (first renderer-direct migration)"
```

---

## Task 7: Update coverage doc

**Files:**
- Modify: `docs/technical/phase-9c-economics-coverage.md`

### Update content

Update the doc to reflect Plan 9d's landing:

- Move the bridge section under "Coverage Plan 9d added" with a check mark
- Update the "Not covered" sections to reflect:
  - Main-process JSON: 2 sites remain (AIConceptExtractionService.js:130, main.ts:601) — first one migrated by Plan 9d
  - Renderer-direct: ~19 sites remain (one migrated by Plan 9d) — list them by file as a checkbox table for Plan 9e to track
- Add a section "How to migrate a renderer-direct call site" with the find-and-replace recipe

### Commit

```bash
git add docs/technical/phase-9c-economics-coverage.md
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "docs(spine): update coverage doc after Plan 9d bridge landing"
```

---

## Task 8: Full regression + done

**Files:** none (verification)

```bash
npx jest src/__tests__/spine src/__tests__/renderer/RationaleCard src/__tests__/renderer/EconomicsPanel src/__tests__/integration/spine-end-to-end src/__tests__/integration/phase4 src/__tests__/integration/phase5 src/__tests__/integration/phase6 src/__tests__/integration/phase7 src/__tests__/brain/ArgumentXrayService src/__tests__/brain/synthesizePullSuggestion
```

Expected: all green. ≥ 75 tests across ≥ 21 suites (69 prior + new meteredCallJson tests + new spineHandlers tests).

No commit needed — verification only.

---

**Done condition:** 7 commits, all spine + integration tests green, the two demo sites confirmed to route through the ledger.
