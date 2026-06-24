# Embedded Presentation in Learn About — Design

**Date:** 2026-06-23
**Status:** Design approved, plan pending

## Goal

Add an embedded Impress.js presentation card to the Learn About feed, generated automatically alongside the existing mindmap. The card shows a **live, scaled-down preview** of the presentation (slide 1 with entrance animation playing) and expands to the existing full-screen `ImpressModal` on click.

## Motivation

Learn About currently renders mindmap, vocabulary, tap-to-reveal, interactive list, and related topics. Impress is one of SmartReader's distinctive AI-enabled UI surfaces (Word-constellation cluster — AI-enabled UI as product, not decoration), but is reachable only from EPubView, Browser, and CreatePDFAnnotationDialog. Embedding it into Learn About lets the user see and launch a cinematic summary of any topic they research.

## Non-Goals

- No in-card navigation (the scaled iframe can't remap click coordinates correctly). Full interaction happens in the existing full-screen modal.
- No new IPC handlers. Reuses `spineApi.generateContentWithJson`.
- No changes to the existing Impress full-screen modal, layout themes, or effects.

## Glossary additions (CONTEXT.md)

- **Embedded Presentation** — the live scaled Impress.js card embedded in a Learn About message feed. Shows slide 1 with its entrance animation, expands to the full-screen `ImpressModal` on click. Stored as `message.type = 'presentation'`. *Not "Impress card", not "slide thumbnail".*
- **buildImpressHTML** — the HTML-building half of the existing `generateImpressHTML`, extracted so it can be called from a render-time component without re-invoking the AI. Takes pre-fetched slide data + deck metadata, returns the impress.js HTML string.

## Architecture

### Data flow

```
LearnAboutDetailPanel.submit()
  └─→ web summary (existing)
       ├─→ mindmap AI call (existing)
       └─→ NEW: presentation AI call
            ├─→ createDecomposeParagraphPrompt(summaryText)
            ├─→ spineApi.generateContentWithJson(...)
            │    label: 'impress-slide-decompose'
            ├─→ { layout_theme, global_mood, background, data: [slides] }
            └─→ createMessage({ type: 'presentation',
                                content: JSON.stringify(slideData) })

Render time (switch case 'presentation'):
  EmbeddedPresentationCard(slideData)
    └─→ useEffect → buildImpressHTML(slideData) → htmlContent
         └─→ <iframe srcDoc={htmlContent} style={scaled}>
              + transparent click overlay → opens ImpressModal
```

### Storage

The DB stores **slide data JSON only**, not the rendered HTML. The HTML (which includes inline CSS, runtime bundle, etc., potentially 50-100 KB) is rebuilt at render time from the slide data (~3-8 KB). Trade-off chosen: keep DB small; pay a small render-time cost (one IPC call for `getAssetRootPath` plus HTML string concatenation, ~50 ms).

## Components

### 1. `buildImpressHTML` — extract from `generateImpressHTML`

**Location:** `src/renderer/components/impressjs/index.js`

The existing `generateImpressHTML({ paragraph })` does two things:
1. AI decomposition (if input is a string)
2. HTML assembly (layouts, effects, slide markup, asset paths)

Refactor: extract step 2 into a new exported function `buildImpressHTML(slideData)`. `generateImpressHTML` becomes a thin wrapper that does step 1 then calls `buildImpressHTML`.

**Signature:**
```js
export async function buildImpressHTML(slideData) {
  // slideData: { layout_theme, global_mood, background, data: [...slides] }
  // Returns: HTML string, or null if data has no slides
}
```

**Why this signature:** matches the shape produced by `createDecomposeParagraphPrompt`. No AI call inside. Async because of the `getAssetRootPath` IPC call.

### 2. `EmbeddedPresentationCard` — new component

**Location:** `src/renderer/components/impressjs/EmbeddedPresentationCard.js`

**Props:**
- `slideData` — the stored JSON (parsed from `message.content`)

**State:**
- `htmlContent: string | null` — built lazily in `useEffect`
- `modalOpen: boolean`

**Render layout:**
- MUI `Card` with dark background
- CardHeader: `🎞 Presentation · N slides` + `IconButton(⤢)` (right-aligned)
- CardContent (relative-positioned container, 400×250):
  - `<iframe srcDoc={htmlContent} sandbox="allow-scripts allow-same-origin">` styled `width: 960px; height: 600px; transform: scale(0.417); transform-origin: top left; pointer-events: none; border: 0`
  - Transparent `<div>` absolutely positioned over the iframe, captures clicks
- Click on overlay OR click on `⤢` → `setModalOpen(true)`
- Renders `<ImpressModal open={modalOpen} onClose={...} htmlContent={htmlContent} />` (same content)
- While `htmlContent === null`: render MUI `Skeleton variant="rectangular"` at 400×250

**Fallback:** if `slideData?.data?.length` is 0 or `buildImpressHTML` returns null → render a dark card with header + "Presentation unavailable" text (no iframe). This is the Option B degraded view.

### 3. `LearnAboutDetailPanel.js` — two additions

**Add to `submit()` flow (around line 1320 where mindmap is generated):**

After the web summary is built and before/parallel-to the mindmap call:

```js
// Generate presentation slide data
try {
  const slideData = await spineApi.generateContentWithJson(
    createDecomposeParagraphPrompt(summaryText),
    null,
    { label: 'impress-slide-decompose' },
  );
  if (slideData?.data?.length > 0) {
    const pMessage = await createMessage({
      chatId: curChatId,
      content: JSON.stringify(slideData),
      type: 'presentation',
      role: 'user',
      createdAt: new Date(),
    });
    messagesCached.push(pMessage);
    setMessages([...messagesCached]);
  }
} catch (err) {
  console.error('[LearnAbout] presentation generation failed:', err);
}
```

The empty-slides guard mirrors the mindmap fix (no empty messages stored).

**Add to render switch (around line 1568):**

```jsx
case 'presentation':
  return (
    <Grow in key={index}>
      <Box>
        <EmbeddedPresentationCard slideData={jsonObj} />
      </Box>
    </Grow>
  );
```

Plus the import of `EmbeddedPresentationCard`.

## Why the iframe needs `pointer-events: none`

A CSS-transformed iframe scales visually but mouse coordinates still register at the iframe's natural (unscaled) coordinate space. A click at visual (100, 50) on the card maps to iframe coordinate (240, 120) — Impress.js navigation would misfire. Disabling pointer events on the iframe and using a transparent click overlay to launch the full-screen modal sidesteps this without coordinate remapping math.

Impress.js entrance animations (`blur_in`, `typewriter`, etc.) play automatically when the first slide becomes active, so the card still shows live motion even though the iframe is non-interactive.

## Error handling

| Failure | Handling |
|---------|----------|
| AI returns no slides (`data: []`) | Skip `createMessage` — no `presentation` message stored. Mirrors the mindmap empty-guard fix. |
| AI call throws | `console.error` + continue. Other Learn About cards still render. |
| `buildImpressHTML` returns null | Card renders fallback ("Presentation unavailable"). |
| Iframe fails to load impress.js scripts | Visual: blank dark iframe. User can still click overlay → modal opens → same problem appears at full screen. No special handling — same failure mode as existing Impress users see today. |

## Testing

| What | How |
|------|-----|
| `buildImpressHTML(validSlideData)` returns an HTML string containing the expected slide count | Unit test in `src/__tests__/components/impressjs/buildImpressHTML.test.js`. Mock `window.electron.ipcRenderer.getAssetRootPath`. |
| `buildImpressHTML(emptyData)` returns null | Same test file. |
| `EmbeddedPresentationCard` renders skeleton initially, then iframe after `useEffect` settles | RTL test in `src/__tests__/components/impressjs/EmbeddedPresentationCard.test.js`. Mock `buildImpressHTML` to resolve with a stub HTML. Use `waitFor` to assert the iframe appears. |
| Card click opens modal | RTL test: click the overlay → assert `ImpressModal` rendered (mock the modal as a no-op div with a test id). |
| Fallback renders when `slideData.data` is empty | RTL test. |
| Existing `generateImpressHTML({ paragraph: string })` still works end-to-end | Manual smoke test in EPubView reading flow. No unit test (existing function isn't unit-tested today). |

UI feature verification (per CLAUDE.md: Playwright incompatible with current Electron):
1. Run `npm start`, open Learn About, submit any topic
2. Confirm a `presentation` card appears in the feed after the summary loads
3. Confirm the card shows a live animated slide 1
4. Click anywhere on the card → confirm full-screen `ImpressModal` opens and navigation works (arrow keys)
5. Press Escape → modal closes, card still visible

## Success criteria

1. Submitting a Learn About topic produces a `presentation` message in the feed alongside the existing `mindmap` message
2. The embedded card shows a live scaled iframe with slide 1's entrance animation playing
3. Clicking the card body or the `⤢` icon opens the full-screen `ImpressModal` and arrow-key navigation works
4. No `presentation` message is stored when the AI returns zero slides (parallel to the mindmap empty-guard fix)
5. All existing Impress callsites (`EPubView`, `Browser`, `CreatePDFAnnotationDialog`) continue to work — the `generateImpressHTML` refactor is non-breaking
6. `npm test` passes, including new unit tests for `buildImpressHTML` and `EmbeddedPresentationCard`

## Out of scope

- Auto-advancing slides in the embedded preview (requires postMessage protocol with impress.js iframe — adds complexity for marginal value)
- Per-message regeneration ("regenerate this presentation" button) — can be added later
- Saving the presentation as a standalone artifact (Note / MoodBoard) — existing message save patterns can be reused later
- A separate Impress trigger in the Brain Orb / Trigger system — Learn About generates it inline, not via Brain

## File touchlist

- **Modify:** `src/renderer/components/impressjs/index.js` (extract `buildImpressHTML`)
- **Add:** `src/renderer/components/impressjs/EmbeddedPresentationCard.js`
- **Modify:** `src/renderer/views/learnabout/LearnAboutDetailPanel.js` (generation + render case + import)
- **Add:** `src/__tests__/components/impressjs/buildImpressHTML.test.js`
- **Add:** `src/__tests__/components/impressjs/EmbeddedPresentationCard.test.js`
- **Modify:** `CONTEXT.md` (add Embedded Presentation + buildImpressHTML terms)
- **Modify:** `CLAUDE.md` (one-line mention under Views & Feature Modules → Learn About if anywhere; otherwise leave existing prose alone)
