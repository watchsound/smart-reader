# Mindmap Upgrade — Design

**Date:** 2026-06-23
**Status:** spec — pending implementation plan
**Scope:** mindmap surfaces only (Notes / Chat / EPub / PDF / Browser / LearnAbout / CreateAnnotation). MoodBoard (projectstorm) untouched. Knowledge Graph + Learning Path get a mechanical engine upgrade in the same PR but no functional change.

## Summary

The mindmap view ships across ~12 files in SmartReader (Notes, Chat, EPub, PDF, Browser, LearnAbout, CreateAnnotation, UniversalCard, etc.), all rendered through one `MyMindMap` component on ReactFlow v11 with default node styling. AI generates rich mindmap data (typed entities, relations, hierarchy) but the renderer collapses it back to generic boxes. The Universal Card mindmap mode is still a `(Mindmap visualization coming soon)` placeholder. Mindmaps are read-only artifacts — there is no path from a mindmap back into the learning loop (no learning-point linkage, no mastery overlay, no click-to-study).

This spec upgrades the mindmap to a first-class learning surface by (1) replacing the renderer with a single `<MindmapSurface>` built on ReactFlow v12 with custom React node types + elkjs auto-layout, and (2) integrating three learning-loop hooks: **A** mastery-as-color overlay on every node, **B** click-to-study routing into `StudyCardRouter`, **C** one-tap "Save N concepts" persistence into `UnifiedLearningPointManager`.

## Goals

- One renderer (`<MindmapSurface>`) used by every mindmap site in the app.
- Mindmap nodes carry mastery state and re-tint live as the user studies.
- Click any node → study session for that concept.
- One-tap conversion of an AI mindmap into entries in the user's SRS queue.
- Engine upgrade `reactflow@11 → @xyflow/react@12` for the renderer surfaces that already used it (mindmap + Knowledge Graph + Learning Path).

## Non-goals

- Migrating MoodBoard off projectstorm. (Confirmed out of scope.)
- Unifying mindmap with the Knowledge Graph view. They share an engine but stay distinct surfaces.
- Editing the underlying AI-generation prompts. The three coexisting prompt paths (`MindmapSkill`, `getMindMapChatHistoryPrompt`, ad-hoc markdown) keep their behavior; their outputs converge through the new canonical `MindmapData` shape.
- Reaching design parity with mind-elixir / markmap on auto-radial-after-edit feel. Approach 1 was picked precisely because the integration (A+B+C) is the prize, not engine craft.
- Mindmap-as-comprehension-grading surface (option F in brainstorming) and spaced re-encounter via Re-read Queue (option G). Future work.

## Architecture & component layout

One new React component, one new hook, one new main-process service, one engine upgrade.

### `<MindmapSurface>` (new, `src/renderer/components/mindmap/MindmapSurface.tsx`)

The single mindmap renderer for the whole app. Replaces:

- `MyMindMap` (legacy v11 wrapper) — deleted at end of migration.
- `MindmapModal` (legacy modal) — re-implemented as `mode="expanded"` inside the new surface.
- The `(Mindmap visualization coming soon)` placeholder in `CardContentRenderer.MindmapModeRenderer` — replaced by mounting `<MindmapSurface mode="card" />`.

Props:

```ts
{
  data: MindmapData;
  mode: 'inline' | 'expanded' | 'card';
  onNodeClick?: (nodeId: string, lpId?: string) => void;
  onSave?: (lpIds: string[]) => void;
  bookId?: string;
  readOnly?: boolean;
}
```

Mode presets fix sizing + density:

| `mode` | Container | Default editing | Drag enabled | MiniMap | Notes |
|---|---|---|---|---|---|
| `'inline'` | 100% width, 240px height | `readOnly` defaults true | no | no | NoteCard preview, Chat message embed |
| `'card'` | bounded ≤ 360×260 | `readOnly` true | no | no | UniversalCard mindmap mode (replaces "coming soon") |
| `'expanded'` | 100% width, 70vh | `readOnly` false (caller may override) | yes | yes | Modal / detail panel |

Internally owns:

- ReactFlow v12 instance, custom node-type registry (`MindNode`, `MindRootNode`).
- `useMindmapLayout` hook (elk Web Worker).
- Local `collapsedNodes: Set<string>` UI state.
- Mastery snapshot fetched on mount + subscription to `mastery:changed`.
- `SaveConceptsBar` rendered above the canvas when any node lacks `learningPointId`.

### `useMindmapLayout` (new, `src/renderer/components/mindmap/hooks/useMindmapLayout.ts`)

Web Worker wrapping `elkjs`. Input: raw nodes + edges. Output: positioned nodes (x/y assigned by `mrtree` or `radial` algorithm). Re-runs only on structural changes (node add/remove/collapse), never on cosmetic re-render. Layout choice driven by `data.layout` (default `'right-tree'`).

### `MindmapPersistenceService` (new, `src/main/utils/MindmapPersistenceService.js`)

Main-process service. One IPC handler: `mindmap:save-as-learning-points`. Takes `{ mindmapId, bookId, nodes }`, returns `{ lpIds, created, linked }`. Idempotent by `(bookId, lower(text), domain)`.

Renderer-side API client: `src/renderer/api/mindmapApi.js`.

### Engine upgrade

`reactflow ^11.11.4` → `@xyflow/react ^12.x` in `package.json` (and `release/app/package.json` if listed). All current call sites in mindmap + Knowledge Graph + Learning Path get a mechanical import rewrite in the same PR.

### Module shape

```
src/renderer/components/mindmap/
├── MindmapSurface.tsx          (new — the only renderer)
├── SaveConceptsBar.tsx         (new — C-confirm UI)
├── nodes/
│   ├── MindNode.tsx            (new)
│   └── MindRootNode.tsx        (new)
├── hooks/
│   └── useMindmapLayout.ts     (new)
├── layout/
│   └── elk.worker.ts           (new)
├── ContextMenu.tsx             (kept, ported to v12 API; gains "Study this concept" + "Find in graph")
├── style.css                   (kept, pruned)
└── index.ts                    (re-exports MindmapSurface as default)
```

## Data shape — `MindmapData`

Today there are three+ different ad-hoc shapes flowing through `parseMindmapToReactFlow`, `convertToReactFlow`, `convertToReactFlow0`, and the `MindmapSkill` JSON output. We collapse to one canonical shape:

```ts
type MindmapNodeData = {
  text: string;                  // 1-3 word display label
  detail?: string;               // long description (hover/expand)
  sourcePhrase?: string;         // verbatim phrase from source text
  type?: 'concept' | 'person' | 'place' | 'event' | 'object';
  domain?: LearningPointDomain;  // vocab/code/math/knowledge/generic
  level: number;                 // 0 = root, 1 = first ring, ...
  parentId?: string | null;
  collapsed?: boolean;           // initial state only
  learningPointId?: string;      // populated after C-confirm save
  masteryLevel?: number;         // 0-100, hydrated client-side after save (A)
};

type MindmapEdgeData = {
  relation?: string;             // 1-3 word verb/preposition
};

type MindmapData = {
  id: string;                    // stable per-source id
  title: string;
  bookId?: string;
  sourceTextHash?: string;
  rootId: string;
  nodes: Array<{ id: string; data: MindmapNodeData }>;
  edges: Array<{ id: string; source: string; target: string; data?: MindmapEdgeData }>;
  layout?: 'right-tree' | 'radial';
};
```

**Positions are not part of the shape.** They are recomputed by elk on every render. Stored mindmaps then improve as the renderer improves; layout switches work without data migration.

### Legacy adapter

Existing chat-message mindmap payloads (v11 ReactFlow shape: `{nodes:[{id, data:{label}, position}], edges:[...]}`) are converted on load by `legacyToCanonical(legacy) → MindmapData` in `src/commons/utils/content/mindmapUtil.js`. We never write the legacy shape again; we never break old chat history.

## `MindNode` visual contract

Plain React + MUI. No canvas magic.

- **Background tint** = mastery shade (A). `getMasteryBand(domain, level)` maps `masteryLevel` (0-100) to a 5-band alpha ramp on the domain accent color:
  - band 0 (0-19): `alpha(domain, 0.06)`
  - band 1 (20-39): `alpha(domain, 0.15)`
  - band 2 (40-59): `alpha(domain, 0.28)`
  - band 3 (60-79): `alpha(domain, 0.45)`
  - band 4 (80-100): `alpha(domain, 0.62)` + subtle inner glow
  - unlinked (`learningPointId` undefined): neutral `alpha(text.primary, 0.04)`.
- **Left edge stripe** = 4px solid domain accent. Echoes Editorial Premium's `NoteCardSurface` stripe for visual continuity.
- **Top-left icon** = domain icon (book / `</>` / Σ / brain / dot) from `LearningPointDomains`.
- **Body** = `text` truncated to 2 lines.
- **Bottom-right chevron** = collapse toggle. Only rendered when `childCount > 0`.

## A — Mastery overlay

1. `MindmapSurface` mounts with `data: MindmapData`.
2. Collects all `learningPointId` values from `data.nodes`.
3. One batched IPC: `unifiedLearningApi.getMasterySnapshot(lpIds) → Record<lpId, masteryLevel>`.
4. Merges into node props; `MindNode` reads `masteryLevel` and picks one of 5 shade bands.
5. Subscribes to existing `mastery:changed` IPC broadcast. Only affected nodes re-render (memoized `MindNode`). No re-layout.

Nodes without an LP (fresh AI output before save) show the neutral shade.

## B — Click-to-study

`MindNode` body click → `onClick(nodeId, learningPointId)`. Default handler in `MindmapSurface`:

```ts
if (learningPointId) {
  navigate(`/study?lpId=${learningPointId}&source=mindmap&mindmapId=${data.id}`);
} else {
  openNodeDetailPopover(nodeId);  // shows detail + sourcePhrase + "Save this concept"
}
```

`/study` exists (Phase 3 `StudyCardRouter`). `source=mindmap` is new — purely analytic, captured by Phase 13 attribution.

**Right-click on a node** → existing `ContextMenu`. Two new entries:

- **Study this concept** (only when `learningPointId` is set) — same as left-click body.
- **Find in graph** (only when `learningPointId` is set) — navigates to `KnowledgeGraphPanel` filtered on `lpId`.

## C — Persistence (C-confirm)

### `SaveConceptsBar`

Single-line bar above the mindmap canvas, rendered when at least one node lacks `learningPointId`:

> ✨ 8 new concepts in this mindmap — **[ Save to study queue ]** • [ Edit which ]

- **Save to study queue** (primary): calls `mindmapApi.saveAsLearningPoints({ mindmapId, bookId, nodes })`. On success, the bar dismisses and each node gets its `learningPointId` patched in. Mastery snapshot re-fetched: newly-created LPs start at `masteryLevel: 0` (band 0 shade); deduped LPs (existing concept matched in another mindmap/source) hydrate at their existing mastery — so saving a mindmap of already-studied concepts immediately shows the user's progress.
- **Edit which** (secondary): expands to a checklist of nodes. User unchecks any to skip. Saves only the checked subset.

Bar dismissal state per-mindmap in `localStorage` key `mindmap:${id}:dismissed`.

### `MindmapPersistenceService`

```js
class MindmapPersistenceService {
  saveAsLearningPoints({ mindmapId, bookId, nodes }) {
    // 1. Dedup by (bookId, lower(text), domain) — existing match returns existing lpId.
    // 2. Insert missing as new LPs via UnifiedLearningPointManager.upsertBatch:
    //      front: node.text, back: node.detail || node.sourcePhrase,
    //      domain_type: node.domain || 'generic',
    //      source: 'mindmap', source_ref: mindmapId,
    //      box: 0, mastery_level: 0, fully_learned: 0.
    // 3. Insert link rows in mindmap_node_lp_link.
    // 4. Return { lpIds, created, linked }.
  }
}
```

### New SQLite table — `mindmap_node_lp_link`

```sql
CREATE TABLE IF NOT EXISTS mindmap_node_lp_link (
  mindmap_id TEXT NOT NULL,
  node_id    TEXT NOT NULL,
  lp_id      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (mindmap_id, node_id),
  FOREIGN KEY (lp_id) REFERENCES learning_point(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mindmap_link_lp ON mindmap_node_lp_link(lp_id);
```

Added to `db.sql`. Reverse-lookup `lp_id → mindmap_id` powers the "Find in graph" affordance.

### Source attribution

- New LPs created via mindmap save get `source: 'mindmap'`.
- New `feature_surface` enum value `'mindmap-study'` added to `src/commons/model/featureSurface.js`. Phase 13 Spend & Returns ROI tab gains a distinct mindmap-study row.

### Dedup rationale

The key `(bookId, lower(text), domain)` is intentionally imperfect: the same word in two chapters of one book collapses to a single LP. Re-generating the same mindmap from the same chunk and saving again is a no-op (the desired behavior); two LPs for the same concept-in-the-same-book would split FSRS state and corrupt mastery accounting.

## Layout, collapse, interactions

### Layout presets

| `data.layout` | elk config | Use |
|---|---|---|
| `'right-tree'` (default) | `algorithm: 'mrtree'`, `direction: 'RIGHT'`, `spacing.nodeNode: 60`, `spacing.nodeNodeBetweenLayers: 100` | Classic horizontal mindmap |
| `'radial'` | `algorithm: 'radial'`, `spacing.nodeNode: 50` | Center-out radial |

Layout toggle UI lives in the canvas corner. Per-user preference in `customStorage` under `mindmap.layout`. Reflow animated by ReactFlow v12's built-in 200ms transition.

### Collapse / expand

`collapsedNodes: Set<string>` in `MindmapSurface` state. Filter pass before passing to ReactFlow hides descendants of collapsed nodes. Toggle on chevron click → elk re-runs → ReactFlow transitions positions. UI-only state (does not persist with `MindmapData`).

### Gestures

| Gesture | Effect |
|---|---|
| Click node body | `onNodeClick(nodeId, lpId)` — see B |
| Click chevron | Toggle subtree collapse |
| Double-click node | Inline edit `text` (disabled in `readOnly`) |
| Right-click node | ContextMenu (with new entries) |
| Drag node | `expanded` mode only; stored as `userPositionsOverride` |
| Drag from node port | Add child node (`expanded` mode only) |
| Wheel / pinch | Zoom (ReactFlow native) |
| Right-click empty pane | Add free node, Reset layout |
| `Tab` on selected node | Add sibling |
| `Enter` on selected node | Add child |
| `Delete` on selected node | Delete (root protected) |

### Export

- "Slider View" via `impressjs` inherited verbatim from existing `MindmapModal`.
- New: PNG export via `html-to-image` (already in use by MoodBoard `exportBoard.ts`). Button in expanded-mode toolbar.

## Migration plan — one PR, 8 commits

Each commit independently passes typecheck + tests. Order matters.

1. **`feat(mindmap): adopt @xyflow/react v12, mechanical import rewrite`** — bump dep in both `package.json` files; rewrite imports across mindmap + `KnowledgeGraphPanel` + `LearningPathPanel`; adapt any v11 → v12 prop renames. Smoke + manual verification on each surface.
2. **`feat(mindmap): introduce canonical MindmapData shape + legacyToCanonical adapter`** — new `src/commons/model/MindmapData.ts`; `legacyToCanonical()` in `mindmapUtil.js`; unit tests with golden fixtures.
3. **`feat(mindmap): add MindNode + MindRootNode components`** — components + `getMasteryBand(domain, level)` helper in `learningPointExtras.js`; chevron visual; render-only tests.
4. **`feat(mindmap): add useMindmapLayout hook (elk worker)`** — `elkjs` dep; worker; structural-vs-cosmetic discrimination; mocked-worker tests.
5. **`feat(mindmap): add MindmapPersistenceService + DB migration + IPC`** — new `mindmap_node_lp_link` table; service + IPC handler + renderer API client; `'mindmap-study'` enum addition; `:memory:` integration test for save + dedup + idempotent re-save.
6. **`feat(mindmap): introduce MindmapSurface + SaveConceptsBar`** — the unified component with A + B + C wired; renders all three modes; unit + integration tests with mocked IPC.
7. **`feat(mindmap): migrate 6 call sites to MindmapSurface`** — `ChatDetailPanel`, `EPubView`, `PDFView`, `CreateAnnotationPanel`, `CreatePDFAnnotationDialog`, `NoteCard`, `CardContentSwitcher`, `CardContentRenderer` (replace placeholder), `LearnAboutDetailPanel`, `Browser`, `InContextChatPanel`, `CreateNotePanel`. Delete `MyMindMap` + `MindmapModal`. Manual smoke per surface.
8. **`chore(mindmap): remove legacy mindmap utils + dead imports`** — prune unused exports from `mindmapUtil.js` (retain `legacyToCanonical`); update `CLAUDE.md` mindmap section; add glossary entries (see below).

### Rollback

If commit 6 or 7 reveals a regression, revert commits 6–8. Commits 1–5 are backward-compatible (no behavior change yet) and remain landed — incremental escape hatch.

## Testing strategy

### Unit tests

- `mindmapUtil.legacyToCanonical` — golden-file v11 → canonical.
- `getMasteryBand(domain, level)` lookup table.
- `useMindmapLayout` — mocked elk worker, structural-vs-cosmetic discrimination.
- `MindmapPersistenceService.saveAsLearningPoints` — `:memory:` SQLite, dedup, idempotent re-save.

### Integration tests (`src/__tests__/integration/`)

New `mindmap-learning-loop.test.js`:

1. Render `<MindmapSurface>` with AI-generated data.
2. Click "Save to study queue".
3. Assert LP + link rows created.
4. Simulate `mastery:changed` IPC.
5. Assert affected node re-renders with new band.
6. Click node body.
7. Assert navigate called with `lpId` + `source=mindmap`.
8. Re-open same `MindmapData` → assert no new LPs (dedup), node colors hydrated.

### Smoke

`npm run test:smoke` catches Electron boot regressions. Add `MIND_MAP` to `ERROR_PATTERNS` only if a new failure class emerges.

### Manual verification (in PR description)

- [ ] Open old chat mindmap message — renders via `legacyToCanonical`.
- [ ] Generate new mindmap from web search → "Save 8 concepts" → check Knowledge Dashboard for 8 new LPs.
- [ ] Run one study session on a saved LP → reopen mindmap → node shade deeper.
- [ ] Knowledge Graph + Learning Path render after v12 migration.
- [ ] MoodBoard still renders (projectstorm untouched, verifying no shared-dep collision).
- [ ] Inline mindmap inside NoteCard preview fits the 200px footprint.

## Glossary additions for `CONTEXT.md`

```md
## Mindmap (2026-06-23 upgrade)

- **MindmapSurface** — the single mindmap renderer (`src/renderer/components/mindmap/MindmapSurface.tsx`). Replaces `MyMindMap`, `MindmapModal`, and the `(coming soon)` placeholder. Used by every mindmap site in the app via `mode='inline' | 'expanded' | 'card'`. *Not "MindMap", not "MindmapView"*.
- **MindNode** — the custom React node type rendered by MindmapSurface. Carries mastery shade (5-band alpha ramp on domain accent), domain icon + 4px accent stripe, collapse chevron. *Not "MindmapNode" (avoids the `Mindmap` prefix doubling)*.
- **MindmapData** — the canonical mindmap shape (`src/commons/model/MindmapData.ts`). One shape for every mindmap site; legacy v11 ReactFlow JSON converts via `legacyToCanonical`. Stored mindmaps carry no x/y; positions recomputed by elk on every render.
- **Mastery Overlay** — node background tint reflecting `masteryLevel` (0-100), 5-band alpha ramp. Hydrated from `unifiedLearningApi.getMasterySnapshot` and live-updated via `mastery:changed` IPC.
- **Save Concepts Bar** — the bar above the mindmap canvas implementing C-confirm. Single click converts every unsaved node into a Learning Point via `MindmapPersistenceService.saveAsLearningPoints`. Dismissal is per-mindmap.
- **mindmap_node_lp_link** — SQLite table joining `(mindmap_id, node_id) → lp_id`. Enables reopen-with-mastery-hydrated and the "Find in graph" reverse-lookup.
- **`feature_surface: 'mindmap-study'`** — new closed-enum value in `featureSurface.js`. Mastery moves caused by a mindmap-originated study session attribute to this surface in Phase 13 Spend & Returns.
```

## Resolved decisions (Q1–Q5)

| # | Question | Answer |
|---|---|---|
| Q1 | Engine choice | Approach 1: ReactFlow v12 + elkjs + custom `MindNode` |
| Q2 | When does C save fire | C-confirm: "Save N concepts" bar, single click |
| Q3 | Migrate Knowledge Graph + Learning Path to v12 same PR | Yes, mechanical rewrite |
| Q4 | Drop stored x/y positions | Yes, recompute on render |
| Q5 | New `feature_surface` for mindmap-study | Yes, add `'mindmap-study'` |

## Open issues / follow-ups (out of scope this PR)

- **Prompt unification.** Three mindmap-generation paths coexist (`MindmapSkill`, `getMindMapChatHistoryPrompt`, ad-hoc markdown). They all emit data that converges through `MindmapData`, but the prompts themselves still differ. Worth a later pass.
- **Brain-triggered mindmap proposals (option D from brainstorming).** "You read chapter 3 — here's a mindmap of its 8 unknown concepts" via the Orb. Deferred — natural follow-up once A+B+C ship.
- **Mindmap as comprehension surface (option F).** Drag-to-label a mindmap-skeleton instead of free-text Q&A. Bigger swing; not load-bearing.
- **Spaced re-encounter of mindmaps (option G).** Re-read Queue surfaces saved mindmaps for re-walking. Requires defining when a mindmap is "due" — open design question.

## Assumptions made

- Assumed `UnifiedLearningPointManager.upsertBatch` exists. If only single-row `create` exists, this PR adds `upsertBatch` in commit 5. **(critical)** if the unified manager hasn't been built out yet — fallback is per-row insert with a transaction wrapper.
- Assumed `mastery:changed` IPC broadcast already exists (Phase 12 mastery sparklines must use *something*). If it's polling instead, mindmap subscribes via the same path.
- Assumed `LearningPointDomains` palette already drives Phase 12 sparkline colors. The 5-band ramp is new but composes on the existing per-domain accent.
- Assumed legacy chat-history mindmap messages are infrequent enough that on-load `legacyToCanonical` conversion is acceptable. If profile shows otherwise, we'd cache the converted shape back to the message row.
- Assumed v11 → v12 ReactFlow API delta on Knowledge Graph + Learning Path is mechanical (`reactflow` import → `@xyflow/react`, a handful of prop renames). If a deeper API break surfaces, commit 1 is paused and we pin v11 + isolate v12 to the new `<MindmapSurface>` only.

## Discovered issues (not fixed in this change)

- `src/renderer/components/UniversalCard/CardContentRenderer.js:466-470` — `MindmapModeRenderer` ships an unfulfilled `(Mindmap visualization coming soon)` text. Replaced by mounting `<MindmapSurface mode="card" />` in commit 7.
- `src/renderer/views/chat/ChatDetailPanel.js:1184-1210` — three different mindmap-generation paths coexist; this spec lets them converge through `MindmapData` but doesn't unify the prompts themselves.
- `src/renderer/components/mindmap/index.js:28-29` — uses `keywordMap.width+30` / `keywordMap.height+30` to size the canvas. Magic numbers from the legacy layout — replaced by `mode`-driven sizing in `MindmapSurface`.
