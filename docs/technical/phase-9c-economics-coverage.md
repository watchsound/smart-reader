# Phase 9 — Economics Panel Coverage (Final)

## Status

The Brain Spine Economics Panel shows cost telemetry for EVERY LLM call site
in the codebase. Phase 9e completed the renderer-direct + main-process JSON
migration that 9d demonstrated.

## Entry points

- **`brainCall(intent, input, options)`** — Brain-mediated calls (Phase 0–8
  services that use the BrainContext slice catalog).
- **`meteredCall(provider, prompt, options)`** — Main-process plain-text legacy
  calls.
- **`meteredCallJson(prompt, schema, options)`** — Main-process structured-output
  legacy calls.
- **`spineApi.generateContent(prompt, options)`** + **`spineApi.generateContentWithJson(prompt, schema, options)`** — Renderer-direct calls (any feature, via `spine:meter` IPC bridge).

## Labels in use

| Cluster | Label(s) |
|---|---|
| Translate | `translate-verb-step`, `translate-main` |
| Grammar | `grammar-correction-card`, `grammar-main` |
| Writing | `writing-comparison-examples`, `writing-mapping`, `writing-view` |
| Browser | `browser-html-rewrite`, `browser-summary`, `browser-mindmap`, `browser-entity-resolve`, `browser-rewrite` |
| Web Search | `web-search` |
| Chat | `chat-message` |
| MoodBoard | `moodboard-diagram-layout` |
| Impress | `impress-slide-decompose` |
| Main-process JSON | `concept-extraction`, `entity-extraction`, `add-vocabulary` |
| Main-process text | `bookmark-categorize` |

## Not covered (by design)

- **Streaming chat responses** — neither `meteredCall` nor `spineApi` handle
  the streaming code path. Sites using `generateContentStream` (if any) are
  not metered. Adding a streaming variant requires preserving the streaming
  semantics through IPC, which is non-trivial — deferred indefinitely until
  a real cost signal motivates the work.
- **Brain Spine's own internal LLM calls** — `brainCall` records itself.
  `meteredCall` and `meteredCallJson` record themselves. They are intentionally
  the only "metering primitives" that don't need outer wrapping.

## Migration recipe (for future call sites)

For renderer-direct call sites in new code:

```js
import spineApi from '<path>/api/spineApi';

const r = await spineApi.generateContent(prompt, { label: 'feature-name' });
const j = await spineApi.generateContentWithJson(prompt, schema, { label: 'feature-name' });
```

For main-process call sites in new code:

```js
const meteredCall = require('<path>/brain/spine/meteredCall');
const meteredCallJson = require('<path>/brain/spine/meteredCallJson');

const { output: r } = await meteredCall(provider, prompt, { legacyLabel: 'feature-name' });
const { output: j } = await meteredCallJson(prompt, schema, { legacyLabel: 'feature-name' });
```

Pick `label` as a short kebab-case identifier for the feature. The Economics
Panel groups by this label.

## What this enables

Open the Brain Dashboard → Economics Panel. The "By Intent" and "By Provider"
tables now reflect 100% of LLM spend across the application. Total Cost and
Projected/mo chips are accurate. Per-intent cache hit rates show the impact
of Brain-mediated `content-hash` caching where applicable.
