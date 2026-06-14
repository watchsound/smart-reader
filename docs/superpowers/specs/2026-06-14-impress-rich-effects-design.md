# Impress.js Rich Effects — Design Spec

**Date:** 2026-06-14
**Status:** v1 (CSS-only catalog) shipped on `feat/impress-rich-effects`. WebGL/Three.js track **deferred** to a future iteration.
**Scope:** Renderer-side — [src/renderer/components/impressjs/](../../../src/renderer/components/impressjs/) and the AI prompt that drives it ([src/commons/utils/AIPrompts.js](../../../src/commons/utils/AIPrompts.js)).

---

## Update 2026-06-14 — WebGL deferred

After the CSS catalog landed, we decided **not to integrate Three.js / WebGL effects in this iteration**. The 4-track architecture, registry pattern, AI orchestration schema, and CSS-only catalog all shipped. The WebGL portions of this spec (Section 3.2, the WebGL rows in Section 4, the bundle size discussion in Section 6, the WebGL acceptance criteria in Section 7) remain on record as the **design target for a future iteration** but are **not implemented in v1**.

**What v1 actually ships:**
- 12 layouts (7 existing + helix, mobius, exploded_text, z_tunnel, page_turn_book)
- 9 CSS typography effects (none, blur_in, typewriter, word_by_word_fade, scramble_decode, letters_from_edges, ink_write, glitch_chromatic, neon_glow_pulse)
- 6 CSS backgrounds (none, gradient_flow, starfield_parallax, dust_motes, ink_wash, cinema_letterbox)
- 5 CSS transitions (default, depth_blur, dissolve, ink_bleed, shatter_rebuild)
- **Total: 32 CSS-only effects** (the 7 WebGL effects originally planned are deferred)

**What v1 deliberately does NOT ship:**
- `three` / `troika-three-text` dependencies — not added to `package.json`
- `SceneManager` / `cameraSync` — not implemented
- 3 WebGL typography effects (`text_3d_extrude`, `text_particle_burst`, `text_liquid_morph`)
- 4 WebGL backgrounds (`nebula_cloud`, `geometry_field`, `data_stream`, `aurora`)
- The lazy-loading WebGL bundle path

**Behavioral consequence:** the AI prompt in [src/commons/utils/AIPrompts.js](../../../src/commons/utils/AIPrompts.js) still advertises the WebGL effect names. If the AI suggests one, `registries.lookup()` returns `null` and the runtime silently no-ops that track for that slide — the slide still renders, just without the requested effect. This is graceful but means the WebGL names should be trimmed from the prompt when convenient (separate follow-up).

---

## 1. Context

### What exists today

SmartReader's Impress feature ([src/renderer/components/impressjs/index.js](../../../src/renderer/components/impressjs/index.js)) takes a paragraph from the reader/browser/notes, decomposes it via the AI provider into sentences, places each sentence as a `<div class="step">` in 3D space, and lets the impress.js engine fly a camera between those positions.

Spatial choreography is provided by [layoutGenerators.js](../../../src/renderer/components/impressjs/layoutGenerators.js), which has 7 layout themes: `spiral`, `linear`, `grid`, `circular`, `depth_zoom`, `random_walk`, `storytelling`. The AI optionally suggests a theme; otherwise a heuristic in `selectLayoutTheme()` picks one based on slide count and content patterns.

### What's missing

The "3D effect" today is **only** the camera flying between fixed slide positions. The slide text itself is static — no animated reveal, no background atmosphere, no transition treatment between slides. The feature feels visually thin compared to what AI-decomposed presentations could be.

### What we're building

A 4-track effect architecture (Layout, Typography, Background, Transition) where the AI orchestrates which effects fire on which slide, on top of a Three.js scene that follows impress.js's camera.

---

## 2. Goals and Non-Goals

### Goals

1. Add **38 composable effects** across 4 orthogonal tracks (12 layouts, 11 typography, 10 backgrounds, 5 transitions).
2. Let the **existing AI decompose call** drive per-slide effect selection by extending its JSON schema. **Zero extra LLM calls.**
3. Introduce **Three.js as a passive background renderer** behind impress.js, with its camera mirroring impress.js's current step transform.
4. Keep the existing 7 layouts and existing AI call shape **fully working** — new fields are additive and optional.
5. Each effect is a **registry entry** with a small descriptor; adding a new effect is one entry, not a refactor.

### Non-goals (v1)

- Sound design / audio-reactive effects. Defer to v2 as a 5th track.
- User-facing effect picker UI (Settings panel override). Defer to v2.
- Replacing impress.js with a CSS3DRenderer-based engine.
- Per-character animation editor or any authoring UI.
- New entry points for invoking Impress (still triggered from the same paragraph-action surfaces).
- Touching the Phase 0 capability registry beyond declaring `impress_rich_effects` as an optional capability.

---

## 3. Architecture

### 3.1 Four orthogonal effect tracks

Each slide gets four independent tracks that compose:

| Track | What it controls | Runtime |
|---|---|---|
| **Layout** | Where slide sits in 3D space + camera arrival angle | impress.js `data-x/y/z/rotate-x/y/z/scale` |
| **Typography** | How text reveals once camera arrives | CSS animations + Web Animations API, fired on `impress:stepenter`; WebGL variants render into the shared Three.js scene |
| **Background** | Atmosphere behind the deck (per slide or global) | CSS gradients + canvas; WebGL variants render into the shared Three.js scene |
| **Transition** | What happens during camera-fly between slides | CSS filters on `.past`/`.future` + hooks on `impress:stepleave`/`stepenter` |

### 3.2 Three.js integration — hybrid + camera sync

**Chosen approach:** Three.js canvas mounted at `z-index: -1` behind impress.js's DOM. A tiny adapter listens for `impress:stepenter`, reads the active step's transform (position + rotation + scale), and mirrors it into a Three.js `PerspectiveCamera` over the same transition duration. Three.js becomes a passive follower; impress.js remains the single source of truth for "what slide are we on".

**Why:** Keeps impress.js's autoplay, keyboard handling, URL-fragment step navigation, and overview mode working without modification. Adding/removing the WebGL layer is a feature flag (`globalMood === 'cinematic'` or any WebGL-only effect present), not a rewrite.

**One scene, two render groups:**
- **Far-z meshes** — background effects (nebula, starfield, geometry field, aurora, data stream).
- **Near-z meshes** — WebGL typography effects (3D text extrude, particle burst, liquid morph), positioned at each slide's location in world space.

Shared lights, fog, and post-processing across both groups.

### 3.3 AI orchestrator — extended JSON schema

The existing `createDecomposeParagraphPrompt` call in [src/commons/utils/AIPrompts.js](../../../src/commons/utils/AIPrompts.js) returns:

```json
{ "layout_theme": "spiral", "data": [{ "content": "..." }, ...] }
```

**New shape — additive, every new field optional:**

```json
{
  "layout_theme": "helix",
  "global_mood": "dramatic",
  "background": "nebula_cloud",
  "data": [
    {
      "content": "...",
      "role": "opening",
      "typography": "blur_in",
      "transition": "default"
    },
    {
      "content": "...",
      "role": "key_concept",
      "typography": "word_by_word_fade",
      "transition": "depth_blur"
    },
    {
      "content": "...",
      "role": "punchline",
      "typography": "scramble_decode",
      "transition": "shatter_rebuild"
    }
  ]
}
```

**Field semantics:**

- `layout_theme` *(string, optional)* — name from layouts registry. Falls back to existing `selectLayoutTheme()` heuristic if omitted or unknown.
- `global_mood` *(enum, optional)* — `calm | dramatic | tech | playful | scholarly | cinematic`. Used as a hint to (a) the background fallback chooser, (b) post-processing intensity (vignette/bloom strength), (c) WebGL on/off if not otherwise required.
- `background` *(string, optional)* — name from backgrounds registry. Applies for the whole deck unless a per-slide `background` is also present (per-slide overrides global).
- `data[].role` *(enum, optional)* — `opening | key_concept | example | quote | data | punchline | closing`. Used by typography fallback chooser when `data[].typography` is absent.
- `data[].typography` *(string, optional)* — name from typography registry. Fallback chain: per-slide → mood + role lookup table → `none` (text appears statically, today's behavior).
- `data[].transition` *(string, optional)* — name from transitions registry. Fallback: per-slide → `default` (camera-only).
- `data[].background` *(string, optional)* — overrides global background for this slide only.

**Prompt update strategy:** The prompt instructs the AI to use the new fields when content warrants, lists the valid values, and explicitly tells it to omit fields when uncertain rather than guess. This keeps the schema lean for smaller/open-source providers where verbose JSON degrades quality.

### 3.4 Module shape

```
src/renderer/components/impressjs/
  index.js                # existing entry, extended to wire registries + Three.js
  reactimpress.js         # existing
  ImpressModal.js         # existing
  layoutGenerators.js     # existing, extended to 12 layouts
  effects/
    registries.js         # central lookup: name -> effect descriptor
    cssEffects.js         # CSS typography + backgrounds + transitions
    fallbackTables.js     # mood+role -> effect name (used when AI omits fields)
    webgl/
      SceneManager.js     # one shared Three.js scene; lazy-instantiated
      cameraSync.js       # mirrors impress.js camera -> Three camera
      typography3d.js     # 3 WebGL text effects
      backgrounds3d.js    # 4 WebGL atmospheres
```

Each registry entry is a small descriptor:

```js
{
  name: 'scramble_decode',
  track: 'typography',
  requiresWebGL: false,
  mood: ['dramatic', 'tech'],
  apply: (slideEl, opts) => { /* attach animation, return cleanup */ },
}
```

The runtime resolver:
1. Reads the AI JSON.
2. For each slide, for each track, looks up the named effect in the registry.
3. If unknown name → log warning, fall back via `fallbackTables.js`.
4. If `requiresWebGL: true` for any effect anywhere → lazy-instantiate `SceneManager` and load Three.js bundle.
5. Wires effect `apply()` callbacks to impress.js lifecycle events.

---

## 4. Full effect catalog (v1)

### 4.1 Layout track (12 total — extends [layoutGenerators.js](../../../src/renderer/components/impressjs/layoutGenerators.js))

**Existing (7):** `spiral`, `linear`, `grid`, `circular`, `depth_zoom`, `random_walk`, `storytelling`.

**New (5):**

| Name | Description |
|---|---|
| `helix` | Slides spiral up a vertical axis (DNA-like); camera ascends |
| `mobius` | Half-twist loop returning inverted; last slide reads upside-down then re-rights |
| `exploded_text` | Slide letters scatter into space, camera passes through, letters reconverge on the next slide |
| `z_tunnel` | Slides recede straight down +Z; camera dollies through, perspective gives infinite-corridor feel |
| `page_turn_book` | Slides arranged as book spreads; camera "turns pages" with binding-axis rotation |

### 4.2 Typography track (11 total)

**CSS (8):**

| Name | Description |
|---|---|
| `none` | Static text (today's behavior) |
| `typewriter` | Character-by-character reveal with blinking caret |
| `word_by_word_fade` | Words fade in staggered, ~80ms apart |
| `scramble_decode` | Matrix-style letter scramble resolving to text |
| `blur_in` | Text starts heavily blurred + transparent, sharpens |
| `letters_from_edges` | Each letter flies from a random screen edge to its position |
| `ink_write` | SVG handwriting-stroke reveal (text rendered as outlines, stroked over time) |
| `glitch_chromatic` | RGB-split + jitter, settles to clean text |
| `neon_glow_pulse` | Text outlines glow; pulse once on arrival |

**WebGL (3):**

| Name | Description |
|---|---|
| `text_3d_extrude` | Letters extrude as 3D geometry (Troika Text); camera reveals depth on arrival |
| `text_particle_burst` | Outgoing slide's letters disintegrate into ~5k GPU particles; particles re-form as incoming slide's letters |
| `text_liquid_morph` | Fragment-shader liquid distortion morphing one slide's text into the next |

### 4.3 Background track (10 total)

**CSS (6):**

| Name | Description |
|---|---|
| `none` | Default (current behavior) |
| `gradient_flow` | Animated CSS conic gradient, slow rotation |
| `starfield_parallax` | Canvas-rendered starfield, parallax with impress camera |
| `dust_motes` | Canvas particles drifting slowly, soft bokeh |
| `ink_wash` | SVG noise + slow drift, monochrome wash |
| `cinema_letterbox` | Black bars top/bottom + vignette pulse on dramatic slides |

**WebGL (4):**

| Name | Description |
|---|---|
| `nebula_cloud` | Volumetric fragment shader, slow drift, mood-tinted color |
| `geometry_field` | Slow-floating wireframe primitives (cubes, dodecahedra) with depth-of-field bokeh |
| `data_stream` | Matrix-style falling glyphs with true z-depth |
| `aurora` | Animated gradient mesh, perlin-noise warped |

### 4.4 Transition track (5 total)

| Name | Description |
|---|---|
| `default` | Camera-fly only (current behavior) |
| `depth_blur` | Past and future slides blur by distance from active step |
| `dissolve` | Cross-fade overlap with previous slide during camera fly |
| `ink_bleed` | Radial mask wipe between slides |
| `shatter_rebuild` | Outgoing slide breaks into fragments and reassembles into incoming slide |

---

## 5. Backward compatibility and degradation

### 5.1 AI omits new fields

If the AI returns only the legacy `{ layout_theme, data: [{ content }] }` shape, behavior is identical to today: existing layout selection, no typography animation, no background, no transitions. Verified by the integration test that pins today's prompt + today's expected output.

### 5.2 AI returns unknown effect name

Logged as a warning. Resolver falls back via `fallbackTables.js` (mood + role → known effect). If `global_mood` and `role` are also absent, falls back to `none` / `default` for that track.

### 5.3 WebGL unavailable

The presentation runs inside `window.open(...)` (or an Electron `BrowserWindow` if popup is blocked). `SceneManager` does a one-time `WebGLRenderingContext` probe on first invocation. If unavailable:
- All `requiresWebGL: true` effects are replaced with their CSS fallback via `fallbackTables.js`.
- A one-line console warning is logged.
- Three.js bundle is **not** loaded — no wasted bytes.

### 5.4 Per-provider capability degradation

The Phase 0 capability registry on `AIProviderInterface` gets a new optional capability flag `impress_rich_effects_schema`. Providers that don't reliably produce the extended JSON (small Ollama models, older Baidu models) mark this `false` and the orchestrator uses the legacy prompt for them. Default for unknown providers: `true` (try the new schema; if AI omits fields, degradation in §5.1 handles it).

---

## 6. Bundle and performance

### 6.1 Bundle

- **Three.js core:** ~150KB gzip
- **Troika Text** (for 3D extruded text): ~80KB gzip
- **Total addition:** ~230KB gzip to the presentation window only

Loaded **lazily** via dynamic `import()` inside `SceneManager.js`, triggered only when at least one WebGL effect is selected for the current deck. The main SmartReader app bundle is untouched.

### 6.2 Performance budget

- **Steady-state framerate target:** 60fps on integrated Intel UHD-class GPUs.
- **Typography effect duration:** ≤ 1.5s per slide (matches impress.js default `data-transition-duration="1000"`).
- **Particle counts:** capped at 5000 for `text_particle_burst`, 2000 for `dust_motes`, 800 for `geometry_field`.
- **WebGL post-processing:** disabled when `global_mood` is `calm` or `scholarly` (saves a render pass).

---

## 7. Acceptance criteria

A reviewer can validate v1 by checking each of these.

### 7.1 Backward compatibility

- [ ] Opening Impress on the same paragraph as before the change produces a presentation indistinguishable from today's when the AI omits the new schema fields.
- [ ] The 7 existing layouts (`spiral` … `storytelling`) all still resolve and render correctly.

### 7.2 Effect catalog

- [ ] All 38 effects (12 + 11 + 10 + 5) are registered in `effects/registries.js` and discoverable by name.
- [ ] Each effect has at least a minimal unit-test asserting it can be applied to a stub slide element without throwing.

### 7.3 AI integration

- [ ] The extended JSON schema is documented in the prompt and accepted by the AI's structured-output path.
- [ ] An end-to-end integration test feeds a fixture paragraph, mocks the AI response to use 3 typography names + 1 background + 1 transition, and asserts the rendered HTML contains the expected class/data attributes for each.

### 7.4 Three.js integration

- [ ] When zero WebGL effects are selected, Three.js bundle is **not** loaded (verified by inspecting network/bundle activity in the presentation window devtools).
- [ ] When any WebGL effect is selected, Three.js loads lazily, `SceneManager` boots, and the Three.js camera tracks impress.js's camera within ≤ 50ms of each `stepenter` event.
- [ ] On a system with `WebGLRenderingContext === undefined`, presentation falls back gracefully to CSS effects (logged warning, no crash, no missing visuals).

### 7.5 Performance

- [ ] A 10-slide deck with `nebula_cloud` background + `text_3d_extrude` typography + `shatter_rebuild` transitions holds ≥ 30fps on an integrated Intel UHD-class GPU in Electron.

---

## 8. Open questions

None at this stage. All architectural decisions resolved:

1. **Track decomposition:** 4 orthogonal tracks. ✅
2. **WebGL allowed:** yes, via Three.js. ✅
3. **Integration shape:** hybrid + camera sync (option C). ✅
4. **Bundle (~230KB gzip in presentation window only, lazy-loaded):** approved. ✅
5. **Backward compat strategy:** additive optional fields + graceful degradation. ✅
6. **Scope of v1:** full 38-effect catalog. ✅

Implementation-phase decisions (file naming, exact prompt wording, exact CSS keyframes, exact shader code) deferred to the writing-plans output.

---

## 9. Next step

Invoke the `writing-plans` skill to produce a step-by-step implementation plan grounded in this spec.
