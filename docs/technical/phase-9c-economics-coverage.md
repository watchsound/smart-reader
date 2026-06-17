# Phase 9c — Economics Panel Coverage

## Status

The Brain Spine Economics Panel (`src/renderer/components/brainShell/EconomicsPanel.jsx`)
shows cost telemetry for every LLM call that flows through:

- `brainCall(intent, input, options)` — all Phase 0–8 Trigger-producing services
  (migrated in Plan 9b + the Phase 9c specials: `argument-xray`,
  `synthesize-pull-suggestion`).
- `meteredCall(provider, prompt, options)` — plain-text calls
  (`createBookmarkUtils.js` + others migrated via spine bridge).
- `meteredCallJson(prompt, schema, opts)` — main-process structured-output calls.
- `spine:meter` IPC bridge — renderer-to-main metered LLM dispatch via `spineApi`.

## What Plan 9d added

Plan 9d shipped the renderer-to-main metering infrastructure for JSON and
non-JSON calls:

- **`meteredCallJson(prompt, schema, opts)`** in `src/main/brain/spine/meteredCall.js`
  — Runs structured-output LLM calls on the main process, writes the ledger row
  with full cost telemetry, returns `{ output, callId }`.

- **`spine:meter` IPC handler** — Main-process handler that accepts `{ label, prompt, schema? }`
  from the renderer and dispatches through `meteredCall` or `meteredCallJson`.

- **`spineApi` renderer client** — New `src/renderer/api/spineApi.js` mirroring
  `AIProviderManager` shape: `generateContent(prompt, opts)` and
  `generateContentWithJson(prompt, schema, opts)`. Both accept a `label` option
  (kebab-case identifier for the call site).

- **2 demo migrations:**
  - Main-process JSON: `AIConceptExtractionService.js:62`
    (concept extraction, now metered).
  - Renderer-direct: `StepTwoVerbCard.js:63`
    (translate verb step, now calls `spineApi.generateContentWithJson`).

## Not covered

The following LLM call sites bypass the Call Ledger. Their cost is
NOT visible in the Economics Panel:

### Main-process JSON sites (2 remaining)
- [ ] `src/main/utils/AIConceptExtractionService.js:130` — `generateContentWithJson(...)`
- [ ] `src/main/main.ts:601` — `aiProviderManager.generateContentWithJson(...)`

### Renderer-direct sites (~19 remaining)
- Translate (2 remaining, 1 migrated)
- Grammar (2 sites)
- Writing (5 sites)
- Chat (streaming + non-streaming)
- Browser (study-enhancer, rewrite-helper, smart-summary)
- Web-based-search (~2 sites)

These call `aiProviderManager.instanceInRender.generateContent(...)` directly
from the renderer process. Without an IPC bridge, they cannot write `brain_call_ledger`.

## How to migrate a renderer-direct call site

Find the direct call to `aiProviderManager.instanceInRender` and replace it
with the `spineApi` client:

```js
// Before:
import aiProviderManager from '...aiProviderManager';
const r = await aiProviderManager.instanceInRender.generateContent(prompt);
const j = await aiProviderManager.instanceInRender.generateContentWithJson(prompt, schema, true);

// After:
import spineApi from '../../api/spineApi'; // adjust path as needed
const r = await spineApi.generateContent(prompt, { label: 'feature-name' });
const j = await spineApi.generateContentWithJson(prompt, schema, { label: 'feature-name' });
```

**Label naming:** Use a short kebab-case identifier specific to the feature
(e.g., `translate-verb-step`, `grammar-correction`, `smart-summary-rewrite`).

## Next phase — Plan 9e

Recommended migration order (one feature cluster per PR):

1. **Translate** — 2 remaining call sites
2. **Grammar** — 2 call sites
3. **Writing** — 5 call sites
4. **Browser** — ~5 call sites (study-enhancer, rewrite-helper, smart-summary)
5. **Web-based-search** — ~2 call sites

After Plan 9e completes, all main-process and renderer-direct LLM calls will be
metered and visible in the Economics Panel.
