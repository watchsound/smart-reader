# MoodBoard Redesign — Concept Canvas Without Losing the Aesthetic

**Date:** 2026-06-22
**Status:** Approved (verbal) — draft spec, awaiting written review.

## Philosophical anchor

**Active learning = passive design.** A designer's moodboard is sense-making by curation — pinning references in space until the designer figures out what they think. A learner can do the same with text-bearing concepts. The cognitive operation is identical; only the downstream artifact differs (a chair vs. an internalized model of Roman history). The aesthetic isn't garnish on top of that — it's the externalization mechanism itself, and a retention mechanism (color-coded clusters become memory hooks; themed boards prime context recall).

Today's MoodBoard fails this on two fronts:

1. **The library (`@projectstorm/react-diagrams`) is a flow-chart engine.** It bakes nodes-with-ports + typed edges as a directed graph. Free spatial arrangement, ad-hoc grouping, and visual collage are not primitives.
2. **Aesthetic is decoration, not first-class.** Cards inherit the note's color. There's no board-level theme, no background imagery, no color zoning, no image-only nodes. So the moodboard never feels like an *artifact*, only a container.

This redesign keeps the MoodBoard name and adds two primitive layers: **Cognitive** (the missing concept-map operations) and **Aesthetic** (the missing collage operations). Together they make the board a real synthesis surface and a real artifact.

## Goal

Make the MoodBoard a surface where the user can:

- Arrange any number of cards freely in 2D, with grouping and typed relations
- Theme the canvas as a whole (palette + background + typography)
- Snapshot/export the result as a shareable image
- Get a meaningfully-structured starter board from the Phase 8b Organize loop
- Have arrangement effort recognized by the Brain as an active-learning signal

…all without replacing the underlying diagram library.

## Scope

**In scope:**
- New diagram primitives: free placement, frame container, typed connectors, sticky-note node, image-only node, multi-select
- New canvas-level layers: board theme, background canvas, color zones
- Phase 8b integration: clusters → labeled frames with starter theme + suggested inter-cluster arrows
- Curation telemetry: board edit dwell + arrangement-count signal feeding `mastery_event`
- PNG/PDF export of the board

**Out of scope:**
- Replacing `@projectstorm/react-diagrams` with tldraw / excalidraw (re-evaluate after v1 ships)
- AI-generated thematic art beyond a small starter palette (deferred to a later phase)
- Sharing to external surfaces (Twitter, etc.)
- Real-time collaborative editing
- Mobile / touch-optimized interaction

## Cognitive primitives

### Free placement
Drop port-snap. `NotePortModel` and its ports/anchors stay in the codebase for legacy boards but new nodes don't register them. Links now attach by **proximity** — the nearest point on the source card's bounding rect to the nearest point on the target's bounding rect. Curve renderer recalculates on drag.

Migration: existing port-linked nodes keep their ports until the user manually reroutes; new boards start port-less.

### Frame container
A new node type: `FrameNodeModel`. A rectangle with a label, an accent color, optional background tint, and a list of `containedNodeIds`. Properties:
- Drag the frame ⇒ all contained nodes translate with it (no parent-child position math; on frame drag, iterate `containedNodeIds` and apply `dx/dy`).
- Resize the frame ⇒ doesn't resize contents.
- A node enters a frame when dropped inside its bounds (and the frame is not currently dragging); leaves when dropped outside. No nesting in v1 (frame inside frame is rejected).
- Render order: frames z-index 0, regular nodes z-index 1+. Frames always behind.

### Typed connectors
`CustomLinkModel` gains a `relationType` field. v1 enum:
- `supports` — solid arrow → (default)
- `contrasts` — red dashed double-headed ↔
- `leads-to` — thick solid arrow →
- `similar` — light gray no-arrow line ─
- `caused-by` — solid arrow ← (reversed)

`CustomLinkSegment` reads `relationType` and chooses stroke / dash / arrowhead / color. Optional `label` field rendered as a small chip at the midpoint of the curve. Right-click a link to cycle types in a popover; default new-link type is `supports`.

### Sticky-note node
A new node type: `StickyNoteNodeModel`. Lightweight free text + color, NOT a Note record. Use case: quick scribbles ("this is the central argument"), captions for frames, transitional notes between clusters. Stored on the board, not in `note` / `learning_point` tables. Schema: `{ id, type: 'sticky', text, color, x, y, width, height, fontFamily? }`.

### Image-only node
A new node type: `ImageNodeModel`. Holds an image (paste from clipboard, file picker, or AI-generated from a future phase). Schema: `{ id, type: 'image', src, x, y, width, height, rotation? }`. `rotation` defaults to 0; v1 doesn't surface a UI for rotating, but the field is reserved.

### Multi-select + bulk move
Lasso (shift-drag on empty canvas) selects all nodes whose bounding rect intersects the lasso rect. Selected set moves together on drag. Selected set deletes together on `Delete` keypress.

## Aesthetic primitives

### Board theme
A new field on the MoodBoard record: `theme`. Schema:

```ts
{
  paletteId: string;   // e.g. 'warm-roman', 'cold-noir', 'austere-mono', 'custom'
  customPalette?: { accent: string; bg: string; ink: string; muted: string };
  fontFamily?: 'serif' | 'sans' | 'mono' | 'display';
  backgroundLayer?: BackgroundLayerSpec;
}
```

The theme is applied at the canvas level (CSS variables on the root diagram container) and inherited by cards/frames/stickies unless they override.

A small built-in palette list (5–7 themes) ships with v1. Phase 8b suggests a palette per cluster type (e.g. vocabulary clusters → austere-mono, narrative clusters → warm-roman).

### Background canvas
A new layer rendered *below* all nodes. Three modes:

1. **None** (default) — theme `bg` color only.
2. **Image** — user-uploaded or book-cover image, blurred to ~10% opacity, cover-fit.
3. **Pattern** — light dot-grid / paper-grain (deterministic SVG, no network), tinted by theme `bg`.

Mode chosen on a per-board basis; the image source stored as a customStorage asset id (same path as note images).

### Color zones
Translucent colored rectangles, drawn below cards but above the background. Properties: `{ id, color, opacity, x, y, width, height, label? }`. Lighter than a Frame — no containment, no labeling weight by default. Use case: wash a region of the canvas in a hue to suggest "this side of the canvas is about cause; this side is about consequence."

Right-click the canvas → "Add color zone" → click-and-drag to draw.

## Architecture

```
src/renderer/components/MoodBoard/
├── diagram/
│   ├── NoteNodeModel.ts          (existing — port registration becomes opt-in)
│   ├── NoteNodeWidget.tsx        (existing — drops port rendering by default)
│   ├── FrameNodeModel.ts         (NEW)
│   ├── FrameNodeWidget.tsx       (NEW)
│   ├── FrameNodeFactory.tsx      (NEW)
│   ├── StickyNoteNodeModel.ts    (NEW)
│   ├── StickyNoteNodeWidget.tsx  (NEW)
│   ├── StickyNoteNodeFactory.tsx (NEW)
│   ├── ImageNodeModel.ts         (NEW)
│   ├── ImageNodeWidget.tsx       (NEW)
│   ├── ImageNodeFactory.tsx      (NEW)
│   ├── CustomLinkModel.js        (existing — gains relationType field)
│   ├── CustomLinkSegment.js      (existing — branches render on relationType)
│   ├── CustomLinkFactory.js      (existing — default relationType: 'supports')
│   ├── ProximityAttach.ts        (NEW — pure: compute nearest edge-points)
│   ├── canvas/
│   │   ├── BoardThemeProvider.tsx (NEW — CSS variables on root)
│   │   ├── BackgroundLayer.tsx    (NEW — rendered below diagram)
│   │   ├── ColorZoneLayer.tsx     (NEW — between background and nodes)
│   │   └── themes.ts              (NEW — built-in palette list)
│   └── selection/
│       ├── LassoSelection.tsx     (NEW — shift-drag on empty canvas)
│       └── useMultiSelectDrag.ts  (NEW — group translate hook)
└── gridLayout/ (existing — untouched in this redesign)
```

### Data model

`MoodBoard` SQLite record (existing) gains:

```sql
ALTER TABLE moodboard ADD COLUMN theme_json TEXT;       -- JSON: { paletteId, customPalette?, fontFamily?, backgroundLayer? }
ALTER TABLE moodboard ADD COLUMN color_zones_json TEXT; -- JSON array of ColorZone
```

Nodes / links / frames / stickies / images / zones all live in the existing per-board JSON blob (no new tables). Schema versioned via a `schemaVersion` field on the board JSON; migration runs lazily on read.

### IPC / API

No new IPC handlers in v1. Existing `moodboard:*` handlers serialize/deserialize the richer JSON transparently. Export-to-PNG is a renderer-only operation (canvas screenshot via `html-to-image`, no main-process roundtrip).

### Curation telemetry

A new emitter in `EpisodeCollector.EVENT_TYPES`: `BOARD_ARRANGED`. Fires when:
- A node is dropped after a drag of >50px, OR
- A link is created/deleted, OR
- A frame's `containedNodeIds` changes

Payload: `{ boardId, nodeCount, frameCount, linkCount, durationMs }`. Brain heartbeat reads recent `BOARD_ARRANGED` episodes per board; if a board has ≥3 events across ≥2 sessions in a 7-day window with total dwell ≥10 min, it emits a `mastery_event` with `source='moodboard-curation'`, `featureSurface='manual-review'`, and a small mastery delta (+2 to +5) applied to learning points contained in the board's cards. Caps at one bonus event per board per week to prevent farming.

### Phase 8b integration

`MoodBoardOrganizerService.createBoardFromCluster` becomes the v2 path. New return shape includes:

```ts
{
  boardId,
  frames: Array<{ id, label, containedNodeIds, color }>,
  suggestedLinks: Array<{ from, to, relationType, label? }>,
  theme: { paletteId },
}
```

Frame labels come from the cluster's dominant domain + a Brain-generated short title (single LLM call, intent `summarize-cluster`, ~50 tokens). Theme is picked deterministically per cluster domain (no LLM call). Suggested links are emitted only when the Brain has signal that two clusters share concepts or contrast — capped at one suggestion per pair, max 5 total per board.

## Phases

**Phase 1 — Cognitive primitives (week 1)**
- Free placement (drop port-snap on new nodes)
- Frame node (model, widget, factory, containment math)
- Typed connectors (CustomLinkModel field + segment branching)
- Sticky-note node
- Multi-select + bulk drag

**Phase 2 — Aesthetic primitives (week 2)**
- Board theme (data + CSS-variable provider + 5 built-in palettes)
- Background canvas (none / image / pattern modes)
- Color zones
- Image-only node

**Phase 3 — Integrations (week 3)**
- Phase 8b → labeled frames + theme + suggested links
- Curation telemetry (`BOARD_ARRANGED` episode + mastery bonus)
- PNG/PDF export

Each phase is its own PR, lands behind the existing route. No feature flag — the surface is already opt-in via navigation; users who don't open it aren't affected.

## Testing

- **Unit tests** (Jest + jsdom):
  - `ProximityAttach.ts` — pure: given two rects, returns nearest edge-point pair. Tabled cases.
  - `FrameNodeModel` containment math — adding/removing nodes, drag-with-frame translation.
  - `CustomLinkSegment` render branches per `relationType` — snapshot test against rendered SVG path strings.
  - `themes.ts` — palette resolution, contrast checks (no white-on-white).
  - Phase 8b cluster → frame mapper.
  - Curation telemetry: episode emit on threshold; mastery bonus emit capped at 1/week/board.

- **Integration tests** (`__tests__/integration/`):
  - Create board → add 3 notes → add frame containing 2 → drag frame → both contained notes translate; the third doesn't.
  - Phase 8b: trigger cluster detection on a seeded `:memory:` DB → assert resulting board JSON has frames + theme + links.

- **Manual visual gate**:
  - Walk through the 3 phases end-to-end on a sample EPUB.
  - Confirm theme palette legibility in both light and dark mode for all 5 starter palettes.
  - Confirm PNG export looks right at 1× and 2× pixel ratios.

- **Renderer suite** stays green.

## Success criteria

- Free placement works without ports; links attach by proximity and re-route on drag.
- A frame containing N cards moves as a unit; cards retain relative positions.
- All 5 `relationType` values render distinguishably; user can change a link's type in <2 clicks.
- A board can be themed in <3 clicks; theme persists and reloads correctly.
- Phase 8b output, fed to a new board, produces visibly-structured frames + a coherent palette without manual cleanup.
- Curation telemetry fires for genuine engagement; mastery bonus appears in `mastery_event` and surfaces in the Brain dashboard.
- PNG export produces a file that visibly matches the on-screen render.
- User feedback: the MoodBoard now feels "worth opening" — qualitative gate, asked at the end of Phase 3.

## Open questions

- **Sticky-note persistence.** v1 stores stickies inside the board JSON blob, not as `note` records. Right call for ephemerality, but it means stickies aren't searchable from the Notes view. Revisit if users start using stickies as notes.
- **Color-zone z-order vs frames.** Both sit below cards; if they overlap, which wins? v1: frames over zones (frame label needs to read). Re-evaluate if zones gain labels in v2.
- **AI-generated background art.** Out of scope for v1. The hook is there (`BackgroundLayerSpec` supports an image source) but generation is deferred. Phase 4 candidate.

## Out of scope (explicit)

- Replacing `@projectstorm/react-diagrams`. Re-evaluate only if the visual ceiling proves limiting after v1 ships.
- Real-time collaborative editing.
- Nesting frames inside frames.
- Rotating cards / arbitrary node rotation.
- Mobile / touch interaction.
- Sharing-to-external (Twitter, Slack, etc.).
- Custom user-defined `relationType` values beyond the v1 enum.
