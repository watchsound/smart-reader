# Phase 9d — Renderer-Direct + JSON Bridge

**Date:** 2026-06-17
**Status:** Spec — approved, in flight
**Predecessor:** Plans 9a–9c (Brain Spine + first surfaces + first consumers)
**Successor:** Plan 9e (cluster migrations of the remaining renderer-direct sites)

## 1. Problem

Plan 9c documented two gaps that the Economics Panel cannot see:

- **3 main-process structured-output sites** call `aiProviderManager.generateContentWithJson(...)`. `meteredCall` only handles plain text via `provider.generateContent(prompt)`.
- **~20 renderer-direct sites** across translate / grammar / writing / chat / browser call `aiProviderManager.instanceInRender.generateContent(...)` directly from the renderer process. The Call Ledger is main-process SQLite — renderer-direct calls cannot write without an IPC bridge.

Plan 9d closes the bridge gap structurally so subsequent migrations are one-file-at-a-time edits, and demonstrates the new path with two real migrations.

## 2. Goals

- **G1** — A `meteredCallJson` variant that records cost for main-process JSON sites.
- **G2** — An IPC bridge + renderer client (`spineApi`) so renderer code can route LLM calls through main's metering path.
- **G3** — Two demo migrations (one main-process JSON, one renderer-direct text) proving both code paths end-to-end.
- **G4** — Make future renderer migrations a mechanical find-and-replace: `aiProviderManager.X(...)` → `spineApi.X(...)`.

## 3. Non-goals

- **N1** — Migrate the remaining ~20 renderer-direct sites. Plan 9e.
- **N2** — Wrap streaming chat responses. Needs streaming-aware metering; out of scope.
- **N3** — Remove `aiProviderManager.instanceInRender`. Stays available; new sites should use `spineApi`, old sites unchanged.
- **N4** — Consolidate `meteredCall` and `meteredCallJson` into one polymorphic function. Two ~30-line functions are clearer than one ~80-line one.
- **N5** — Migrate any `brainCall` paths. Plan 9d is exclusively for non-Brain LLM calls (`legacy:<label>` intents).

## 4. Architecture

### 4.1 Call-site dispatch matrix

| Caller | Modality | Entry function | Records as |
|---|---|---|---|
| Main, plain text | `provider.generateContent(prompt)` | `meteredCall(provider, prompt, { legacyLabel })` *(9a)* | `legacy:<label>` |
| Main, structured | `aiProviderManager.generateContentWithJson(prompt, opts)` | **`meteredCallJson(prompt, schema, { legacyLabel })`** | `legacy:<label>` |
| Renderer, plain text | renderer → IPC → main → `meteredCall` | **`spineApi.generateContent(prompt, { label })`** | `legacy:<label>` |
| Renderer, structured | renderer → IPC → main → `meteredCallJson` | **`spineApi.generateContentWithJson(prompt, schema, { label })`** | `legacy:<label>` |

### 4.2 Module layout

```
src/main/brain/spine/
  meteredCallJson.js     — JSON sibling of meteredCall
  index.js               — re-export meteredCallJson

src/main/ipc/
  spineHandlers.js       — single polymorphic channel `spine:meter`

src/renderer/api/
  spineApi.js            — renderer client (.generateContent / .generateContentWithJson)

src/__tests__/spine/
  meteredCallJson.test.js
  spineHandlers.test.js  — round-trip test via mocked ipcMain
```

### 4.3 IPC channel

Single channel `spine:meter`. Payload:

```ts
{
  kind: 'text' | 'json',
  label: string,
  prompt: string,
  schema?: object  // present iff kind === 'json'
}
```

Response: `{ output: string | object, callId: number, error?: string }`. On main-side dispatch failure (no provider, schema invalid, provider throws), `error` is set and `output` is `null`. Renderer wraps the error case as a thrown Promise rejection in `spineApi`.

### 4.4 `spineApi` shape

Mirrors `aiProviderManager`'s shape so cluster migrations are mechanical:

```js
// Before:
const r = await aiProviderManager.generateContent(prompt);
const j = await aiProviderManager.generateContentWithJson(prompt, true);

// After:
const r = await spineApi.generateContent(prompt, { label: 'translate-verb-step' });
const j = await spineApi.generateContentWithJson(prompt, schema, { label: 'translate-main' });
```

Both methods return the bare output (matching what the original methods returned), with `callId` accessible via a second-tuple option for callers that want it.

## 5. Components

### 5.1 `meteredCallJson`

```js
// src/main/brain/spine/meteredCallJson.js
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');
const { instanceInMain: aiProviderManager } = require('../../../commons/service/AIProviderManager');

async function meteredCallJson(prompt, schema, options = {}) {
  const label = options.legacyLabel || 'unknown';
  const provider = aiProviderManager?.currentProvider;
  if (!provider) {
    throw new Error('[meteredCallJson] no AI provider configured');
  }
  const providerName = provider.name || aiProviderManager.currentProviderName || 'unknown';
  const t0 = Date.now();
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
    output_json: typeof output === 'object' ? output : null,
  });
  return { output, callId };
}
```

### 5.2 `spineHandlers`

```js
function register() {
  ipcMain.handle('spine:meter', async (_e, { kind, label, prompt, schema }) => {
    try {
      if (kind === 'json') {
        const { output, callId } = await meteredCallJson(prompt, schema, { legacyLabel: label });
        return { output, callId };
      }
      const provider = aiProviderManager.currentProvider;
      if (!provider) return { output: null, callId: null, error: 'no provider' };
      const { output, callId } = await meteredCall(provider, prompt, { legacyLabel: label });
      return { output, callId };
    } catch (e) {
      return { output: null, callId: null, error: e.message };
    }
  });
}
```

### 5.3 `spineApi`

```js
// src/renderer/api/spineApi.js
const { ipcRenderer } = window.require ? window.require('electron') : require('electron');

const spineApi = {
  async generateContent(prompt, options = {}) {
    const res = await ipcRenderer.invoke('spine:meter', {
      kind: 'text', label: options.label || 'unknown', prompt,
    });
    if (res?.error) throw new Error(res.error);
    return options.withMeta ? res : res.output;
  },
  async generateContentWithJson(prompt, schema, options = {}) {
    const res = await ipcRenderer.invoke('spine:meter', {
      kind: 'json', label: options.label || 'unknown', prompt, schema,
    });
    if (res?.error) throw new Error(res.error);
    return options.withMeta ? res : res.output;
  },
};

export default spineApi;
```

`options.withMeta: true` returns `{ output, callId }`; default returns just `output` to match the migrated call-site shape.

## 6. Demo migrations

### 6.1 Main-process JSON: `AIConceptExtractionService.js:62`

Replace:
```js
const result = await aiProviderManager.generateContentWithJson(prompt, true);
```
with:
```js
const meteredCallJson = require('../brain/spine/meteredCallJson');
const { output: result } = await meteredCallJson(prompt, /* schema */ null, {
  legacyLabel: 'concept-extraction',
});
```

If the original call did not pass a schema (free-form JSON), pass `null` and `meteredCallJson` skips schema validation but still records.

### 6.2 Renderer-direct text: `StepTwoVerbCard.js:63`

Replace:
```js
const r = await aiProviderManager.generateContent(prompt);
```
with:
```js
import spineApi from '../../api/spineApi';
const r = await spineApi.generateContent(prompt, { label: 'translate-verb-step' });
```

Remove `instanceInRender as aiProviderManager` import if no other call site in the file uses it.

## 7. Success criteria

- All Plan 9a–9c tests still pass (regression).
- New tests:
  - `meteredCallJson` records a ledger row with `intent='legacy:concept-extraction'`, `output_json` is the structured object.
  - `spineHandlers` round-trip test via mocked `ipcMain` confirms both `kind: 'text'` and `kind: 'json'` paths reach the ledger.
- Manual: boot app, open Translate → exercise the verb-step (which fires `StepTwoVerbCard`) → confirm Economics Panel shows a `legacy:translate-verb-step` row.
- Bridge round-trip overhead ≤ 50 ms p95.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Schema not JSON-serializable across IPC | Verified: all existing schemas in the codebase are plain objects. |
| Renderer needs provider state beyond `output` | `withMeta: true` returns `{ output, callId }`. If a site needs more, it can call a separate IPC. |
| `aiProviderManager.generateContentWithJson` signature drift between providers | `meteredCallJson` delegates to the manager method as-is; we don't reinterpret the signature. |
| Demo migration breaks an existing test | Each migration is a single-file change; existing tests for that file may need their mocks updated. |
| Boot smoke regresses | `spine:meter` handler is registered alongside `callLedgerHandlers`; same wiring shape. |

## 9. Out of scope / follow-up phases

- **Plan 9e** — migrate remaining renderer-direct call sites cluster by cluster (translate / grammar / writing / browser).
- **Plan 9f (or later)** — streaming-aware metering for chat.
- **Future** — possibly remove `aiProviderManager.instanceInRender` if all renderer sites end up migrated.
