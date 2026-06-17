# Phase 9c — Economics Panel Coverage

## Status

The Brain Spine Economics Panel (`src/renderer/components/brainShell/EconomicsPanel.jsx`)
shows cost telemetry for every LLM call that flows through:

- `brainCall(intent, input, options)` — all Phase 0–8 Trigger-producing services
  (migrated in Plan 9b + the Phase 9c specials: `argument-xray`,
  `synthesize-pull-suggestion`).
- `meteredCall(provider, prompt, options)` — currently only the plain-text
  `createBookmarkUtils.js` site.

## Not covered

The following LLM call sites bypass the Call Ledger entirely. Their cost is
NOT visible in the Economics Panel:

### Main-process structured-output sites (3)
- `src/main/main.ts:601` — `aiProviderManager.generateContentWithJson(...)`
- `src/main/utils/AIConceptExtractionService.js:62` — `generateContentWithJson(...)`
- `src/main/utils/AIConceptExtractionService.js:130` — `generateContentWithJson(...)`

These can be instrumented once a `meteredCallStructured` variant exists
(or once they migrate through `brainCall` with a proper Intent and schema).

### Renderer-direct sites (~20)
- `src/renderer/views/translate/*` (3 call sites)
- `src/renderer/views/grammar/*` (2 call sites)
- `src/renderer/views/writing/*` (5 call sites)
- `src/renderer/views/chat/*` (streaming + non-streaming)
- `src/renderer/views/browser/*` (study-enhancer, rewrite-helper, smart-summary)
- `src/renderer/components/web-based-search/*`

These call `aiProviderManager.instanceInRender.generateContent(...)` directly
from the renderer process. Since `brain_call_ledger` is a main-process SQLite
table, these sites cannot record without an IPC bridge.

## Recommended next steps (Plan 9d or Phase 10)

1. Add an IPC handler `spine:meteredCall(label, providerPrompt) → { output, callId }`
   that runs the LLM call on the main side and writes the ledger row.
2. Update a renderer-side helper `import { meter } from 'api/spineApi'`
   to wrap renderer-direct calls.
3. Migrate the renderer view files one cluster at a time
   (translate → grammar → writing → chat → browser).
4. For structured-output JSON sites, add a `meteredCallStructured` variant
   in `src/main/brain/spine/meteredCall.js`.
