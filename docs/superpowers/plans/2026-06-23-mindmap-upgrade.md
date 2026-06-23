# Mindmap Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SmartReader's naive ReactFlow-v11 mindmap with a single `<MindmapSurface>` on `@xyflow/react` v12 + `elkjs` auto-layout, and wire three learning-loop integrations: per-node mastery overlay (A), click-to-study routing (B), one-tap "Save N concepts" persistence into the learning-point store (C).

**Architecture:** One new React component owns every mindmap render in the app, layout runs in a Web Worker, persistence goes through a new main-process `MindmapPersistenceService` that uses the existing `learningPointService.createLearningPointsBatch` API + a new `mindmap_node_lp_link` join table for reopen-with-mastery-hydration. The 12 current call sites converge through one canonical `MindmapData` shape; a legacy adapter handles old chat-history payloads in place.

**Tech Stack:** TypeScript, React 18, `@xyflow/react` v12, `elkjs`, MUI v5, Electron IPC, better-sqlite3, Jest.

**Spec:** [docs/superpowers/specs/2026-06-23-mindmap-upgrade-design.md](../specs/2026-06-23-mindmap-upgrade-design.md)

---

## Decisions confirmed during brainstorming

| # | Question | Answer |
|---|---|---|
| Q1 | Engine choice | Approach 1: `@xyflow/react` v12 + `elkjs` + custom `MindNode` |
| Q2 | When C fires | C-confirm: "Save N concepts" bar, one click |
| Q3 | Migrate KG + Learning Path to v12 same PR | Yes — mechanical rewrite |
| Q4 | Drop stored x/y positions | Yes — recompute on every render |
| Q5 | New `feature_surface: 'mindmap-study'` | Yes |

## Critical API corrections (spec → reality)

| Spec said | Reality | Action |
|---|---|---|
| `UnifiedLearningPointManager.upsertBatch` | `learningPointService.createLearningPointsBatch(points, token)` returns `{ created, errors, ... }` | Use the real method; do dedup ourselves via `getBySource('mindmap', mindmapId)` before insert. |
| `mastery:changed` IPC broadcast already exists | No such broadcast exists | Re-fetch mastery snapshot on `MindmapSurface` mount + on `window.focus`. Add real broadcast only if future demand justifies it. |
| `'mindmap'` is a valid `source_type` | `SOURCE_TYPES` enum is `{BOOK, URL, CHAT, MANUAL, IMPORT, MIGRATION}` | Add `MINDMAP: 'mindmap'` to `SOURCE_TYPES` in commit 5. |
| `LearningPointDomain` is one union | TS union has 13 values; `LIVE_WRITABLE_DOMAINS` (writes-allowed) is 6 values (`vocabulary`, `knowledge`, `math`, `reading`, `language`, `skill`) | `MindmapNodeData.domain` validates/coerces to `LIVE_WRITABLE_DOMAINS` before insert; unknown → `'knowledge'` (the project's generic-concept domain). |
| `getMasterySnapshot(lpIds)` IPC exists | No such IPC | New IPC `mindmap:mastery-snapshot` added in commit 5; thin wrapper around `learningPointService.getLearningPointById` over the requested ids. |

---

## File map

### Created
| Path | Purpose |
|---|---|
| `src/commons/model/MindmapData.ts` | Canonical `MindmapData` / `MindmapNodeData` / `MindmapEdgeData` TS types + `coerceToLiveDomain()` helper. |
| `src/commons/utils/content/mindmapMigration.ts` | `legacyToCanonical(legacy)` adapter; **no other functions added here** — leave `mindmapUtil.js` legacy parsers alone until commit 8. |
| `src/commons/utils/masteryRamp.ts` | `getMasteryBand(domain, level): { tint, glow }` helper. Shared by `MindNode` and Phase 12 sparkline if desired (not required). |
| `src/renderer/components/mindmap/MindmapSurface.tsx` | The single mindmap renderer. |
| `src/renderer/components/mindmap/SaveConceptsBar.tsx` | C-confirm UI. |
| `src/renderer/components/mindmap/nodes/MindNode.tsx` | Custom React node — mastery overlay, domain accent, chevron. |
| `src/renderer/components/mindmap/nodes/MindRootNode.tsx` | Centered/larger variant for `rootId`. |
| `src/renderer/components/mindmap/hooks/useMindmapLayout.ts` | elk Web Worker hook. |
| `src/renderer/components/mindmap/layout/elk.worker.ts` | elk worker entrypoint. |
| `src/renderer/api/mindmapApi.js` | Renderer-side IPC client. |
| `src/main/utils/MindmapPersistenceService.js` | Dedup + batch-create + link rows. |
| `src/main/ipc/mindmapIpc.js` | `mindmap:save-as-learning-points` + `mindmap:mastery-snapshot` IPC handlers. |
| `src/__tests__/learning/MindmapPersistenceService.test.js` | Unit tests for dedup + create + link. |
| `src/__tests__/integration/mindmap-learning-loop.test.js` | End-to-end: render → save → mastery hydrate → click. |
| `src/__tests__/commons/mindmapMigration.test.ts` | Golden-file legacy → canonical. |
| `src/__tests__/commons/masteryRamp.test.ts` | Band lookup table. |

### Modified
| Path | Why |
|---|---|
| `package.json` (root + `release/app/package.json`) | `reactflow ^11.11.4` → `@xyflow/react ^12.x`; add `elkjs ^0.9.x`. |
| `db.sql` | Add `mindmap_node_lp_link` table + index. |
| `src/main/utils/LearningPointService.js` | Add `'mindmap'` to `SOURCE_TYPES`. |
| `src/commons/model/featureSurface.js` | Add `'mindmap-study'` to `FEATURE_SURFACES`, `ATTENTION_STATE` (`focused-session`), `PHASE_GROUP` (`production-prompts` or new `'mindmap'` — picked in Task 5.1). |
| `src/renderer/components/graph/KnowledgeGraphPanel.js` | `reactflow` → `@xyflow/react`. |
| `src/renderer/components/graph/LearningPathPanel.js` | Same. |
| `src/renderer/components/mindmap/ContextMenu.tsx` | Port to v12 + add "Study this concept" / "Find in graph". |
| `src/main/main.ts` | Register `mindmapIpc` handlers. |
| `src/main/preload.ts` | Expose `mindmap` API. |
| The 12 call sites (commit 7) | Swap to `<MindmapSurface>`. |
| `CLAUDE.md` | Update mindmap section + add Phase row (commit 8). |
| `CONTEXT.md` | Add glossary block (commit 8). |

### Deleted (at end)
| Path | Reason |
|---|---|
| `src/renderer/components/mindmap/index.js` (old `MyMindMap`) | Replaced by `MindmapSurface`. |
| `src/renderer/components/mindmap/MindmapModal.tsx` | Folded into `MindmapSurface mode="expanded"`. |
| `convertToReactFlow`, `convertToReactFlow0` in `mindmapUtil.js` | Unused after migration. |

---

## Commit 1 — Adopt `@xyflow/react` v12

### Task 1.1: Bump engine dependency

**Files:**
- Modify: `package.json`
- Modify: `release/app/package.json` (only if `reactflow` is listed there too)

- [ ] **Step 1: Verify current version**

```bash
grep -n "reactflow" package.json release/app/package.json
```

Expected: `"reactflow": "^11.11.4"` somewhere; possibly absent in `release/app/package.json`.

- [ ] **Step 2: Replace `reactflow` with `@xyflow/react` in `package.json`**

In `package.json` `dependencies`, change:

```json
"reactflow": "^11.11.4",
```

to:

```json
"@xyflow/react": "^12.3.0",
```

If `release/app/package.json` also lists `reactflow`, do the same swap there.

- [ ] **Step 3: Add `elkjs`**

In root `package.json` `dependencies`, add:

```json
"elkjs": "^0.9.3",
```

- [ ] **Step 4: Install + native-rebuild if needed**

```bash
npm install
```

Expected: install succeeds. No native rebuild needed (`elkjs` is pure JS). If `better-sqlite3` warnings appear, see the README's known-environment-constraints — these are pre-existing.

### Task 1.2: Rewrite imports in mindmap component

**Files:**
- Modify: `src/renderer/components/mindmap/index.js`
- Modify: `src/renderer/components/mindmap/MindmapModal.tsx`

- [ ] **Step 1: Rewrite `index.js`**

Replace:

```js
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  updateEdge,
  Position,
} from 'reactflow';
// ...
import 'reactflow/dist/base.css';
```

with:

```js
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge as updateEdge, // v12 rename
  Position,
} from '@xyflow/react';
// ...
import '@xyflow/react/dist/base.css';
```

Note v12 ships `ReactFlow` as a named export only (no default).

- [ ] **Step 2: Rewrite `MindmapModal.tsx`**

Same swap. No `updateEdge` here so no `reconnectEdge` alias needed.

- [ ] **Step 3: Visual smoke**

```bash
npm start
```

Wait for renderer to compile. Open a chat with a stored mindmap message and confirm it still renders. Pan/zoom/minimap functional. Note any console errors.

### Task 1.3: Rewrite imports in graph panels

**Files:**
- Modify: `src/renderer/components/graph/KnowledgeGraphPanel.js`
- Modify: `src/renderer/components/graph/LearningPathPanel.js`

- [ ] **Step 1: For each file, rewrite the import block**

Each file: change `from 'reactflow'` → `from '@xyflow/react'` and `'reactflow/dist/base.css'` → `'@xyflow/react/dist/base.css'`. Apply the named-import shape (no default `ReactFlow`).

- [ ] **Step 2: Address v12 API renames if used in either file**

Search both files for: `updateEdge`, `connectionMode`, `nodeTypes` registration. Confirm:
- `updateEdge` → `reconnectEdge`
- `nodeTypes` prop now requires stable reference (memoize outside component if not already)
- `useReactFlow` hook unchanged

If the search returns no matches for the renamed APIs, no further change needed.

- [ ] **Step 3: Run them in the app**

`npm start`. Open the Knowledge Dashboard's graph panel and the cross-book Learning Path panel. Confirm both render. Note console errors.

### Task 1.4: Commit

- [ ] **Step 1: Stage + commit**

```bash
git add package.json release/app/package.json package-lock.json \
  src/renderer/components/mindmap/index.js \
  src/renderer/components/mindmap/MindmapModal.tsx \
  src/renderer/components/graph/KnowledgeGraphPanel.js \
  src/renderer/components/graph/LearningPathPanel.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "$(cat <<'EOF'
feat(mindmap): adopt @xyflow/react v12 + add elkjs dep

Mechanical migration from reactflow@11 to @xyflow/react@12 across mindmap +
Knowledge Graph + Learning Path. Functional behavior unchanged. updateEdge
renamed to reconnectEdge. Adds elkjs as new dep (consumed in commit 4).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Verify smoke**

```bash
npm run test:smoke
```

Expected: completes 12s without new error patterns. If new patterns appear, investigate before continuing.

---

## Commit 2 — Canonical `MindmapData` shape + legacy adapter

### Task 2.1: Define the contract

**Files:**
- Create: `src/commons/model/MindmapData.ts`

- [ ] **Step 1: Write the type file**

```ts
import type { LearningDomain } from './LearningPointDomains';

export const MINDMAP_NODE_TYPES = ['concept', 'person', 'place', 'event', 'object'] as const;
export type MindmapNodeType = (typeof MINDMAP_NODE_TYPES)[number];

export const MINDMAP_LAYOUTS = ['right-tree', 'radial'] as const;
export type MindmapLayout = (typeof MINDMAP_LAYOUTS)[number];

export interface MindmapNodeData {
  text: string;
  detail?: string;
  sourcePhrase?: string;
  type?: MindmapNodeType;
  domain?: LearningDomain;
  level: number;
  parentId?: string | null;
  collapsed?: boolean;
  learningPointId?: string;
  masteryLevel?: number;
}

export interface MindmapEdgeData {
  relation?: string;
}

export interface MindmapData {
  id: string;
  title: string;
  bookId?: string;
  sourceTextHash?: string;
  rootId: string;
  nodes: Array<{ id: string; data: MindmapNodeData }>;
  edges: Array<{ id: string; source: string; target: string; data?: MindmapEdgeData }>;
  layout?: MindmapLayout;
}

const LIVE_WRITABLE: ReadonlyArray<LearningDomain> = [
  'vocabulary', 'knowledge', 'math', 'reading', 'language', 'skill',
];

export function coerceToLiveDomain(d: LearningDomain | undefined): LearningDomain {
  if (d && LIVE_WRITABLE.includes(d)) return d;
  return 'knowledge';
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: passes (no callers yet).

### Task 2.2: Write the failing migration test

**Files:**
- Create: `src/__tests__/commons/mindmapMigration.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { legacyToCanonical } from '../../commons/utils/content/mindmapMigration';
import type { MindmapData } from '../../commons/model/MindmapData';

describe('legacyToCanonical', () => {
  it('converts a v11 ReactFlow payload to canonical MindmapData', () => {
    const legacy = {
      width: 600,
      height: 400,
      nodes: [
        { id: 'root', data: { label: 'Photosynthesis' }, position: { x: 0, y: 0 } },
        { id: 'n1', data: { label: 'Chlorophyll', detail: 'pigment' }, position: { x: 200, y: 50 } },
        { id: 'n2', data: { label: 'CO2' }, position: { x: 200, y: 150 } },
      ],
      edges: [
        { id: 'e1', source: 'root', target: 'n1', label: 'requires' },
        { id: 'e2', source: 'root', target: 'n2', label: 'consumes' },
      ],
    };
    const result: MindmapData = legacyToCanonical(legacy, 'msg-123');
    expect(result.id).toBe('msg-123');
    expect(result.rootId).toBe('root');
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes[0]).toEqual({
      id: 'root',
      data: expect.objectContaining({ text: 'Photosynthesis', level: 0, parentId: null }),
    });
    expect(result.nodes[1].data.parentId).toBe('root');
    expect(result.nodes[1].data.detail).toBe('pigment');
    expect(result.edges[0]).toEqual(
      expect.objectContaining({ source: 'root', target: 'n1', data: { relation: 'requires' } }),
    );
  });

  it('handles empty legacy data', () => {
    const result = legacyToCanonical({ nodes: [], edges: [] }, 'empty-id');
    expect(result.rootId).toBe('');
    expect(result.nodes).toEqual([]);
  });

  it('derives level from edge graph when no explicit level field', () => {
    const legacy = {
      nodes: [
        { id: 'r', data: { label: 'Root' } },
        { id: 'a', data: { label: 'Child' } },
        { id: 'b', data: { label: 'Grandchild' } },
      ],
      edges: [
        { id: 'e1', source: 'r', target: 'a' },
        { id: 'e2', source: 'a', target: 'b' },
      ],
    };
    const result = legacyToCanonical(legacy, 'id');
    const aNode = result.nodes.find((n) => n.id === 'a');
    const bNode = result.nodes.find((n) => n.id === 'b');
    expect(aNode?.data.level).toBe(1);
    expect(bNode?.data.level).toBe(2);
    expect(bNode?.data.parentId).toBe('a');
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npx jest src/__tests__/commons/mindmapMigration.test.ts
```

Expected: FAIL — cannot resolve `mindmapMigration`.

### Task 2.3: Implement the adapter

**Files:**
- Create: `src/commons/utils/content/mindmapMigration.ts`

- [ ] **Step 1: Write the implementation**

```ts
import type { MindmapData, MindmapNodeData } from '../../../commons/model/MindmapData';

interface LegacyNode {
  id: string;
  data?: { label?: string; detail?: string };
  position?: { x: number; y: number };
}
interface LegacyEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
}
interface LegacyMindmap {
  width?: number;
  height?: number;
  nodes: LegacyNode[];
  edges: LegacyEdge[];
}

export function legacyToCanonical(legacy: LegacyMindmap, fallbackId: string): MindmapData {
  const nodes = legacy.nodes ?? [];
  const edges = legacy.edges ?? [];

  if (nodes.length === 0) {
    return { id: fallbackId, title: '', rootId: '', nodes: [], edges: [] };
  }

  const parentOf = new Map<string, string>();
  edges.forEach((e) => parentOf.set(e.target, e.source));

  const childrenOf = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
    childrenOf.get(e.source)!.push(e.target);
  });

  const rootId = nodes.find((n) => !parentOf.has(n.id))?.id ?? nodes[0].id;

  const levelOf = new Map<string, number>([[rootId, 0]]);
  const queue: string[] = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const lvl = levelOf.get(id)!;
    (childrenOf.get(id) ?? []).forEach((c) => {
      if (!levelOf.has(c)) {
        levelOf.set(c, lvl + 1);
        queue.push(c);
      }
    });
  }

  const canonicalNodes = nodes.map((n) => {
    const data: MindmapNodeData = {
      text: n.data?.label ?? '',
      detail: n.data?.detail,
      level: levelOf.get(n.id) ?? 1,
      parentId: parentOf.get(n.id) ?? (n.id === rootId ? null : rootId),
    };
    return { id: n.id, data };
  });

  const canonicalEdges = edges.map((e, i) => ({
    id: e.id ?? `e${i}`,
    source: e.source,
    target: e.target,
    data: e.label ? { relation: e.label } : undefined,
  }));

  return {
    id: fallbackId,
    title: canonicalNodes.find((n) => n.id === rootId)?.data.text ?? '',
    rootId,
    nodes: canonicalNodes,
    edges: canonicalEdges,
  };
}
```

- [ ] **Step 2: Run tests until they pass**

```bash
npx jest src/__tests__/commons/mindmapMigration.test.ts
```

Expected: 3 tests PASS.

### Task 2.4: Commit

- [ ] **Step 1**

```bash
git add src/commons/model/MindmapData.ts \
  src/commons/utils/content/mindmapMigration.ts \
  src/__tests__/commons/mindmapMigration.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "$(cat <<'EOF'
feat(mindmap): canonical MindmapData shape + legacyToCanonical adapter

Single TS contract for every mindmap surface. legacyToCanonical converts
v11 ReactFlow JSON (still in old chat-history messages) to the canonical
shape at load time — old payloads never break. coerceToLiveDomain forces
node domains into the 6-value LIVE_WRITABLE_DOMAINS subset before write.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 3 — Custom node components + mastery ramp helper

### Task 3.1: Write the ramp helper + test

**Files:**
- Create: `src/commons/utils/masteryRamp.ts`
- Create: `src/__tests__/commons/masteryRamp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { getMasteryBand, MASTERY_BANDS } from '../../commons/utils/masteryRamp';

describe('getMasteryBand', () => {
  it('returns band 0 (faint) for unlinked nodes', () => {
    const b = getMasteryBand('knowledge', undefined);
    expect(b.bandIndex).toBe(0);
    expect(b.tint).toMatch(/rgba|#/);
  });
  it('returns band 0 for mastery 0-19', () => {
    expect(getMasteryBand('knowledge', 0).bandIndex).toBe(0);
    expect(getMasteryBand('knowledge', 19).bandIndex).toBe(0);
  });
  it('returns band 4 for mastery 80-100', () => {
    expect(getMasteryBand('knowledge', 80).bandIndex).toBe(4);
    expect(getMasteryBand('knowledge', 100).bandIndex).toBe(4);
  });
  it('exposes 5 bands', () => {
    expect(MASTERY_BANDS).toHaveLength(5);
  });
});
```

```bash
npx jest src/__tests__/commons/masteryRamp.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
import type { LearningDomain } from '../../commons/model/LearningPointDomains';

export const MASTERY_BANDS = [
  { range: [0, 19], alpha: 0.06, glow: false },
  { range: [20, 39], alpha: 0.15, glow: false },
  { range: [40, 59], alpha: 0.28, glow: false },
  { range: [60, 79], alpha: 0.45, glow: false },
  { range: [80, 100], alpha: 0.62, glow: true },
] as const;

const DOMAIN_HEX: Record<LearningDomain, string> = {
  vocabulary: '#3b82f6',
  knowledge: '#8b5cf6',
  math: '#ef4444',
  reading: '#f59e0b',
  language: '#10b981',
  skill: '#06b6d4',
  programming: '#6366f1',
  physics: '#dc2626',
  chemistry: '#16a34a',
  biology: '#22c55e',
  history: '#a16207',
  geography: '#0891b2',
  custom: '#64748b',
};

function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

export function getMasteryBand(domain: LearningDomain | undefined, level: number | undefined) {
  const hex = (domain && DOMAIN_HEX[domain]) || DOMAIN_HEX.custom;
  if (level == null) {
    return { bandIndex: 0, tint: 'rgba(100,100,100,0.04)', glow: false, accent: hex };
  }
  const bandIndex = MASTERY_BANDS.findIndex((b) => level >= b.range[0] && level <= b.range[1]);
  const safe = bandIndex < 0 ? 0 : bandIndex;
  const { alpha, glow } = MASTERY_BANDS[safe];
  const { r, g, b } = hexToRgb(hex);
  return {
    bandIndex: safe,
    tint: `rgba(${r},${g},${b},${alpha})`,
    glow,
    accent: hex,
  };
}
```

- [ ] **Step 3: Run tests until they pass**

```bash
npx jest src/__tests__/commons/masteryRamp.test.ts
```

Expected: PASS.

> Note: if `LearningPointDomains.ts` already exports a domain color palette, replace `DOMAIN_HEX` here with an import from there. Quick check: `grep -n "color\|hex\|palette" src/commons/model/LearningPointDomains.ts`. If no palette exists, keep `DOMAIN_HEX` local and add a Discovered-Issue note in the PR description.

### Task 3.2: Create `MindNode` component

**Files:**
- Create: `src/renderer/components/mindmap/nodes/MindNode.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React, { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getMasteryBand } from '../../../../commons/utils/masteryRamp';
import type { MindmapNodeData } from '../../../../commons/model/MindmapData';

export interface MindNodeRuntimeData extends MindmapNodeData {
  onActivate: (nodeId: string, lpId?: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  childCount: number;
  isCollapsed: boolean;
}

function MindNodeImpl({ id, data, selected }: NodeProps<MindNodeRuntimeData>) {
  const band = getMasteryBand(data.domain, data.masteryLevel);
  const handleClick = useCallback(() => {
    data.onActivate(id, data.learningPointId);
  }, [id, data]);
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      data.onToggleCollapse(id);
    },
    [id, data],
  );

  return (
    <Box
      onClick={handleClick}
      sx={{
        position: 'relative',
        minWidth: 120,
        maxWidth: 220,
        padding: '8px 12px 8px 16px',
        borderRadius: '10px',
        background: band.tint,
        border: selected ? `2px solid ${band.accent}` : `1px solid rgba(0,0,0,0.08)`,
        boxShadow: band.glow ? `0 0 0 2px ${band.accent}33` : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        '&:hover': { boxShadow: `0 2px 8px ${band.accent}22` },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 4,
          borderRadius: '10px 0 0 10px',
          backgroundColor: band.accent,
        }}
      />
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, lineHeight: 1.25, display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {data.text}
      </Typography>
      {data.childCount > 0 && (
        <Tooltip title={data.isCollapsed ? 'Expand subtree' : 'Collapse subtree'}>
          <IconButton
            size="small"
            onClick={handleToggle}
            sx={{ position: 'absolute', right: 2, bottom: 2, padding: '2px' }}
          >
            {data.isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
}

export const MindNode = memo(MindNodeImpl);
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- src/renderer/components/mindmap/nodes/MindNode.tsx
```

Expected: no errors.

### Task 3.3: Create `MindRootNode` component

**Files:**
- Create: `src/renderer/components/mindmap/nodes/MindRootNode.tsx`

- [ ] **Step 1: Write a thin variant**

```tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Box, Typography } from '@mui/material';
import type { MindNodeRuntimeData } from './MindNode';

function MindRootNodeImpl({ data }: NodeProps<MindNodeRuntimeData>) {
  return (
    <Box
      sx={{
        minWidth: 160, maxWidth: 260,
        padding: '12px 18px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.18))',
        border: '2px solid rgba(99,102,241,0.55)',
        boxShadow: '0 2px 10px rgba(99,102,241,0.2)',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'center' }}>
        {data.text}
      </Typography>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
}

export const MindRootNode = memo(MindRootNodeImpl);
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- src/renderer/components/mindmap/nodes/MindRootNode.tsx
```

Expected: no errors.

### Task 3.4: Commit

```bash
git add src/commons/utils/masteryRamp.ts \
  src/__tests__/commons/masteryRamp.test.ts \
  src/renderer/components/mindmap/nodes/MindNode.tsx \
  src/renderer/components/mindmap/nodes/MindRootNode.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "$(cat <<'EOF'
feat(mindmap): MindNode + MindRootNode + 5-band mastery ramp

MindNode is the per-concept React node: domain-accent left stripe, mastery
tint background, collapse chevron when childCount > 0. masteryRamp.ts
maps (domain, level) -> { bandIndex, tint, glow, accent } with 5 alpha
bands. Wiring (click handlers, collapse) lands in commit 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 4 — elk Web Worker layout hook

### Task 4.1: Write the worker entrypoint

**Files:**
- Create: `src/renderer/components/mindmap/layout/elk.worker.ts`

- [ ] **Step 1: Implement**

```ts
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.addEventListener('message', async (e: MessageEvent) => {
  const { id, graph } = e.data as { id: string; graph: any };
  try {
    const result = await elk.layout(graph);
    (self as unknown as Worker).postMessage({ id, ok: true, result });
  } catch (err: any) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: err?.message ?? String(err) });
  }
});
```

- [ ] **Step 2: Confirm webpack treats `.worker.ts` correctly**

Search for existing worker conventions:

```bash
grep -rn "new Worker\|worker-loader" .erb/configs/ src/
```

If a `.worker.ts` convention is in use, this file follows it. If not, the hook in 4.2 instantiates the worker with `new Worker(new URL('./layout/elk.worker.ts', import.meta.url))` which webpack 5 supports natively.

### Task 4.2: Write the hook

**Files:**
- Create: `src/renderer/components/mindmap/hooks/useMindmapLayout.ts`

- [ ] **Step 1: Implement**

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MindmapData, MindmapLayout } from '../../../../commons/model/MindmapData';

interface PositionedNode {
  id: string;
  position: { x: number; y: number };
}

const ELK_OPTIONS: Record<MindmapLayout, Record<string, string>> = {
  'right-tree': {
    'elk.algorithm': 'mrtree',
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': '60',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  },
  radial: {
    'elk.algorithm': 'radial',
    'elk.spacing.nodeNode': '50',
  },
};

export function useMindmapLayout(data: MindmapData, visibleIds: Set<string>) {
  const [positioned, setPositioned] = useState<PositionedNode[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../layout/elk.worker.ts', import.meta.url));
    return () => workerRef.current?.terminate();
  }, []);

  const graph = useMemo(() => {
    const nodes = data.nodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => ({ id: n.id, width: 200, height: 60 }));
    const edges = data.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }));
    return {
      id: 'root',
      layoutOptions: ELK_OPTIONS[data.layout ?? 'right-tree'],
      children: nodes,
      edges,
    };
  }, [data.nodes, data.edges, data.layout, visibleIds]);

  useEffect(() => {
    if (!workerRef.current) return;
    const myId = ++reqId.current;
    setIsLayouting(true);
    const handler = (e: MessageEvent) => {
      if (e.data.id !== myId) return;
      setIsLayouting(false);
      if (e.data.ok) {
        setPositioned(
          (e.data.result.children ?? []).map((n: any) => ({
            id: n.id,
            position: { x: n.x ?? 0, y: n.y ?? 0 },
          })),
        );
      }
    };
    workerRef.current.addEventListener('message', handler);
    workerRef.current.postMessage({ id: myId, graph });
    return () => workerRef.current?.removeEventListener('message', handler);
  }, [graph]);

  return { positioned, isLayouting };
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- src/renderer/components/mindmap/hooks/useMindmapLayout.ts
```

Expected: no errors. If unused-variable warnings, prefix with `_`.

### Task 4.3: Commit

```bash
git add src/renderer/components/mindmap/layout/elk.worker.ts \
  src/renderer/components/mindmap/hooks/useMindmapLayout.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "$(cat <<'EOF'
feat(mindmap): useMindmapLayout hook backed by elk Web Worker

mrtree (right-tree) + radial layouts. Worker runs off main thread to avoid
jank on dense mindmaps. Layout re-runs only on structural changes (nodes,
edges, visibleIds, layout type) — cosmetic re-renders never trigger it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 5 — Persistence service + DB migration + IPC

### Task 5.1: Add `'mindmap'` source + `'mindmap-study'` feature surface

**Files:**
- Modify: `src/main/utils/LearningPointService.js`
- Modify: `src/commons/model/featureSurface.js`

- [ ] **Step 1: Add `MINDMAP` to `SOURCE_TYPES`**

In `LearningPointService.js`, locate the `SOURCE_TYPES` declaration and add:

```js
const SOURCE_TYPES = {
  BOOK: 'book',
  URL: 'url',
  CHAT: 'chat',
  MANUAL: 'manual',
  IMPORT: 'import',
  MIGRATION: 'migration',
  MINDMAP: 'mindmap',  // <-- new
};
```

If `validateLearningPoint` checks `sourceType` membership, the addition above will satisfy it. Confirm by reading the surrounding code.

- [ ] **Step 2: Add `'mindmap-study'` to `featureSurface.js`**

```js
const FEATURE_SURFACES = [
  'reading-microcard',
  'director-session',
  'comprehension',
  'production-prompt',
  'pre-reading-diagnostic',
  'manual-review',
  'mindmap-study',  // <-- new
  'backfill',
  'unknown',
];

const ATTENTION_STATE = {
  // ... existing
  'mindmap-study': 'focused-session',
  // ... existing
};

const PHASE_GROUP = {
  // ... existing
  'mindmap-study': 'production-prompts',  // closest existing phase group
  // ... existing
};
```

Place the new entries in line with the existing entries (do not reorder).

- [ ] **Step 3: Run the mastery-call-sites lint test if one exists**

```bash
npx jest src/__tests__/lint 2>/dev/null || true
grep -rn "masteryEventCallSites\|isValidFeatureSurface" src/__tests__/ | head -5
```

If a lint test references `FEATURE_SURFACES`, run it and confirm it still passes. If not, no action.

### Task 5.2: Add `mindmap_node_lp_link` table to `db.sql`

**Files:**
- Modify: `db.sql`

- [ ] **Step 1: Append the table**

Locate the end of the file's CREATE-TABLE block and append:

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

> If the project uses `SchemaMigrator` (per CLAUDE.md Phase 15a-1 added `ensureColumn`) for incremental schema, also call `SchemaMigrator.ensureTable('mindmap_node_lp_link', '<CREATE statement>')` from `DatabaseInitializer.js` so existing user DBs get the table on next boot. Check `src/main/db/DatabaseInitializer.js` for the migration pattern in use.

- [ ] **Step 2: Boot the app once and verify the table exists**

```bash
npm start
```

In dev, the database initializer logs every CREATE. Look for `mindmap_node_lp_link` in the logs, then stop the app (Ctrl-C).

### Task 5.3: Write the persistence service test

**Files:**
- Create: `src/__tests__/learning/MindmapPersistenceService.test.js`

- [ ] **Step 1: Write failing test**

```js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const MindmapPersistenceService = require('../../main/utils/MindmapPersistenceService');

describe('MindmapPersistenceService', () => {
  let db;
  let learningPointServiceMock;
  let svc;

  beforeEach(() => {
    db = new Database(':memory:');
    const ddl = fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8');
    db.exec(ddl);

    const createdIds = [];
    learningPointServiceMock = {
      createLearningPointsBatch: jest.fn(async (points) => {
        const ids = points.map((_, i) => `lp-mock-${createdIds.length + i}`);
        ids.forEach((id) => createdIds.push(id));
        return { created: points.length, ids };
      }),
      getBySource: jest.fn(async () => []),
    };

    svc = new MindmapPersistenceService({ db, learningPointService: learningPointServiceMock });
  });

  afterEach(() => db.close());

  it('creates LPs for every node and writes link rows', async () => {
    const nodes = [
      { id: 'n1', data: { text: 'photosynthesis', domain: 'knowledge' } },
      { id: 'n2', data: { text: 'chlorophyll', domain: 'knowledge' } },
    ];
    const result = await svc.saveAsLearningPoints({
      mindmapId: 'm1',
      bookId: 'b1',
      nodes,
      token: 'tok',
    });
    expect(result.lpIds).toHaveLength(2);
    expect(learningPointServiceMock.createLearningPointsBatch).toHaveBeenCalledTimes(1);
    const linkRows = db.prepare('SELECT * FROM mindmap_node_lp_link').all();
    expect(linkRows).toHaveLength(2);
    expect(linkRows[0].mindmap_id).toBe('m1');
  });

  it('is idempotent on re-save (no new LPs, no duplicate links)', async () => {
    const nodes = [{ id: 'n1', data: { text: 'photosynthesis', domain: 'knowledge' } }];
    await svc.saveAsLearningPoints({ mindmapId: 'm1', bookId: 'b1', nodes, token: 'tok' });
    learningPointServiceMock.createLearningPointsBatch.mockClear();
    await svc.saveAsLearningPoints({ mindmapId: 'm1', bookId: 'b1', nodes, token: 'tok' });
    expect(learningPointServiceMock.createLearningPointsBatch).not.toHaveBeenCalled();
    const linkRows = db.prepare('SELECT * FROM mindmap_node_lp_link').all();
    expect(linkRows).toHaveLength(1);
  });

  it('coerces unknown domain to knowledge before batch insert', async () => {
    const nodes = [{ id: 'n1', data: { text: 'foo', domain: 'physics' } }]; // not in LIVE_WRITABLE
    await svc.saveAsLearningPoints({ mindmapId: 'm2', bookId: 'b1', nodes, token: 'tok' });
    const call = learningPointServiceMock.createLearningPointsBatch.mock.calls[0][0];
    expect(call[0].domainType).toBe('knowledge');
  });
});
```

```bash
npx jest src/__tests__/learning/MindmapPersistenceService.test.js
```

Expected: FAIL — service not implemented.

### Task 5.4: Implement `MindmapPersistenceService`

**Files:**
- Create: `src/main/utils/MindmapPersistenceService.js`

- [ ] **Step 1: Implement**

```js
const LIVE_WRITABLE_DOMAINS = ['vocabulary', 'knowledge', 'math', 'reading', 'language', 'skill'];

function coerceDomain(d) {
  if (d && LIVE_WRITABLE_DOMAINS.includes(d)) return d;
  return 'knowledge';
}

class MindmapPersistenceService {
  constructor({ db, learningPointService }) {
    this.db = db;
    this.lps = learningPointService;
  }

  /**
   * Idempotent: same (mindmapId, nodeId) keeps the same lpId on re-save.
   * Dedup is by (mindmapId, nodeId) — re-generating a mindmap with new node
   * ids yields new LPs (acceptable; we trust the caller's nodeId stability).
   */
  async saveAsLearningPoints({ mindmapId, bookId, nodes, token }) {
    if (!nodes || nodes.length === 0) return { lpIds: [], created: 0, linked: 0 };

    const existing = this.db
      .prepare('SELECT node_id, lp_id FROM mindmap_node_lp_link WHERE mindmap_id = ?')
      .all(mindmapId);
    const existingByNode = new Map(existing.map((r) => [r.node_id, r.lp_id]));

    const toCreate = nodes.filter((n) => !existingByNode.has(n.id));

    if (toCreate.length === 0) {
      return {
        lpIds: nodes.map((n) => existingByNode.get(n.id)).filter(Boolean),
        created: 0,
        linked: 0,
      };
    }

    const points = toCreate.map((n) => ({
      front: n.data.text,
      back: n.data.detail || n.data.sourcePhrase || n.data.text,
      itemType: 'card',
      domainType: coerceDomain(n.data.domain),
      sourceType: 'mindmap',
      sourceId: mindmapId,
      tags: bookId ? [`book:${bookId}`] : [],
    }));

    const batchResult = await this.lps.createLearningPointsBatch(points, token);
    const createdIds = batchResult.ids || [];
    if (createdIds.length !== toCreate.length) {
      // Partial failure — record only what came back.
    }

    const insert = this.db.prepare(
      `INSERT INTO mindmap_node_lp_link (mindmap_id, node_id, lp_id, created_at)
       VALUES (?, ?, ?, ?)`,
    );
    const now = Date.now();
    const linkTx = this.db.transaction((rows) => {
      rows.forEach((r) => insert.run(r.mindmap_id, r.node_id, r.lp_id, now));
    });
    linkTx(
      toCreate.map((n, i) => ({
        mindmap_id: mindmapId,
        node_id: n.id,
        lp_id: createdIds[i],
      })),
    );

    const allLpIds = nodes.map((n) => existingByNode.get(n.id) || createdIds[toCreate.indexOf(n)]);
    return { lpIds: allLpIds, created: createdIds.length, linked: createdIds.length };
  }

  /**
   * Returns { lpId: masteryLevel } for the supplied ids. Misses are omitted.
   */
  async getMasterySnapshot(lpIds, token) {
    if (!lpIds || lpIds.length === 0) return {};
    const out = {};
    for (const id of lpIds) {
      // eslint-disable-next-line no-await-in-loop
      const lp = await this.lps.getLearningPointById(id, token);
      if (lp && typeof lp.masteryLevel === 'number') {
        out[id] = lp.masteryLevel;
      }
    }
    return out;
  }
}

module.exports = MindmapPersistenceService;
```

- [ ] **Step 2: Run tests until they pass**

```bash
npx jest src/__tests__/learning/MindmapPersistenceService.test.js
```

Expected: 3 tests PASS.

### Task 5.5: Add IPC handlers + renderer API client

**Files:**
- Create: `src/main/ipc/mindmapIpc.js`
- Create: `src/renderer/api/mindmapApi.js`
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`

- [ ] **Step 1: IPC handlers**

```js
// src/main/ipc/mindmapIpc.js
const { ipcMain } = require('electron');
const MindmapPersistenceService = require('../utils/MindmapPersistenceService');

let svc = null;

function registerMindmapIpc({ db, learningPointService }) {
  svc = new MindmapPersistenceService({ db, learningPointService });

  ipcMain.handle('mindmap:save-as-learning-points', async (_e, { mindmapId, bookId, nodes, token }) => {
    return svc.saveAsLearningPoints({ mindmapId, bookId, nodes, token });
  });

  ipcMain.handle('mindmap:mastery-snapshot', async (_e, { lpIds, token }) => {
    return svc.getMasterySnapshot(lpIds, token);
  });
}

module.exports = { registerMindmapIpc };
```

- [ ] **Step 2: Wire in `main.ts`**

Inside the IPC setup block (look for similar `register*Ipc({...})` calls — there are many; place this one near the LP-related ones), add:

```ts
import { registerMindmapIpc } from './ipc/mindmapIpc';
// ... later, with the other register calls:
registerMindmapIpc({ db, learningPointService });
```

Use whatever variable names are already in scope for the SQLite handle and the `learningPointService` singleton. Match the existing style.

- [ ] **Step 3: Expose in preload**

In `preload.ts`, locate the existing API surface object (search for `contextBridge.exposeInMainWorld` or the equivalent pattern) and add:

```ts
mindmap: {
  saveAsLearningPoints: (payload) => ipcRenderer.invoke('mindmap:save-as-learning-points', payload),
  masterySnapshot: (payload) => ipcRenderer.invoke('mindmap:mastery-snapshot', payload),
},
```

Match indentation + naming style of the surrounding entries.

- [ ] **Step 4: Renderer client**

```js
// src/renderer/api/mindmapApi.js
export async function saveAsLearningPoints({ mindmapId, bookId, nodes, token }) {
  return window.electron.mindmap.saveAsLearningPoints({ mindmapId, bookId, nodes, token });
}

export async function masterySnapshot({ lpIds, token }) {
  return window.electron.mindmap.masterySnapshot({ lpIds, token });
}
```

- [ ] **Step 5: Boot the app, manually trigger one IPC**

```bash
npm start
```

In the renderer devtools console:

```js
await window.electron.mindmap.masterySnapshot({ lpIds: [], token: 'whatever' });
```

Expected: `{}` (no thrown error).

### Task 5.6: Commit

```bash
git add src/main/utils/LearningPointService.js \
  src/commons/model/featureSurface.js \
  db.sql \
  src/main/utils/MindmapPersistenceService.js \
  src/main/ipc/mindmapIpc.js \
  src/renderer/api/mindmapApi.js \
  src/main/main.ts \
  src/main/preload.ts \
  src/__tests__/learning/MindmapPersistenceService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "$(cat <<'EOF'
feat(mindmap): MindmapPersistenceService + DB table + IPC

Adds 'mindmap' to LearningPointService SOURCE_TYPES and 'mindmap-study'
to featureSurface enum (Phase 13 ROI gains a new lens row).
mindmap_node_lp_link table stores (mindmapId, nodeId) -> lpId so reopen
hydrates existing mastery and re-save is a no-op. IPC handlers
mindmap:save-as-learning-points + mindmap:mastery-snapshot exposed via
preload.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 6 — `MindmapSurface` + `SaveConceptsBar`

### Task 6.1: Write `SaveConceptsBar`

**Files:**
- Create: `src/renderer/components/mindmap/SaveConceptsBar.tsx`

- [ ] **Step 1: Implement**

```tsx
import React, { useState } from 'react';
import { Box, Button, Checkbox, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { MindmapData } from '../../../commons/model/MindmapData';

interface Props {
  data: MindmapData;
  unsavedNodeIds: string[];
  onSave: (nodeIds: string[]) => Promise<void>;
  onDismiss: () => void;
}

export function SaveConceptsBar({ data, unsavedNodeIds, onSave, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(unsavedNodeIds));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Array.from(selected));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{
      position: 'sticky', top: 0, zIndex: 5,
      px: 2, py: 1,
      background: 'rgba(99,102,241,0.08)',
      borderBottom: '1px solid rgba(99,102,241,0.18)',
    }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <AutoAwesomeIcon fontSize="small" sx={{ color: '#6366f1' }} />
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {unsavedNodeIds.length} new concepts in this mindmap
        </Typography>
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          disabled={saving || selected.size === 0}
        >
          {saving ? 'Saving…' : `Save ${selected.size} to study queue`}
        </Button>
        <Button size="small" onClick={() => setExpanded((x) => !x)}>
          {expanded ? 'Done' : 'Edit which'}
        </Button>
        <IconButton size="small" onClick={onDismiss}><CloseIcon fontSize="small" /></IconButton>
      </Stack>
      {expanded && (
        <Stack sx={{ mt: 1, maxHeight: 160, overflowY: 'auto' }}>
          {unsavedNodeIds.map((id) => {
            const node = data.nodes.find((n) => n.id === id);
            if (!node) return null;
            return (
              <Stack key={id} direction="row" alignItems="center" spacing={1}>
                <Checkbox size="small" checked={selected.has(id)} onChange={() => toggle(id)} />
                <Typography variant="body2">{node.data.text}</Typography>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- src/renderer/components/mindmap/SaveConceptsBar.tsx
```

### Task 6.2: Write `MindmapSurface`

**Files:**
- Create: `src/renderer/components/mindmap/MindmapSurface.tsx`
- Modify: `src/renderer/components/mindmap/ContextMenu.tsx` (port to v12 API; this file existed pre-v12)

- [ ] **Step 1: Port `ContextMenu.tsx` to v12**

Open the file. Replace any `from 'reactflow'` import with `from '@xyflow/react'`. No prop-shape changes expected. Add two new menu entries at the bottom:

```tsx
{lpId && (
  <>
    <MenuItem onClick={() => onAction('study', lpId)}>Study this concept</MenuItem>
    <MenuItem onClick={() => onAction('find-in-graph', lpId)}>Find in graph</MenuItem>
  </>
)}
```

Where `onAction` and `lpId` are passed in by the parent. Adjust the existing ContextMenu API surface as needed; if `onAction` doesn't exist, add it.

- [ ] **Step 2: Implement `MindmapSurface.tsx`**

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { Box } from '@mui/material';
import { MindNode, MindNodeRuntimeData } from './nodes/MindNode';
import { MindRootNode } from './nodes/MindRootNode';
import { SaveConceptsBar } from './SaveConceptsBar';
import { useMindmapLayout } from './hooks/useMindmapLayout';
import { legacyToCanonical } from '../../../commons/utils/content/mindmapMigration';
import * as mindmapApi from '../../api/mindmapApi';
import type { MindmapData } from '../../../commons/model/MindmapData';

const NODE_TYPES = { mind: MindNode, mindRoot: MindRootNode };

interface Props {
  data: MindmapData | any;     // accepts legacy shape too
  mode?: 'inline' | 'expanded' | 'card';
  bookId?: string;
  readOnly?: boolean;
  onNodeClick?: (nodeId: string, lpId?: string) => void;
}

const MODE_SIZE: Record<NonNullable<Props['mode']>, { width: string | number; height: string | number }> = {
  inline:   { width: '100%', height: 240 },
  card:     { width: 360, height: 260 },
  expanded: { width: '100%', height: '70vh' },
};

function looksLegacy(d: any): boolean {
  return !!d?.nodes?.[0]?.data && 'label' in d.nodes[0].data && !('text' in d.nodes[0].data);
}

export default function MindmapSurface({
  data: rawData, mode = 'inline', bookId, readOnly, onNodeClick,
}: Props) {
  const navigate = useNavigate();
  const data: MindmapData = useMemo(
    () => (looksLegacy(rawData) ? legacyToCanonical(rawData, rawData?.id ?? `m-${Date.now()}`) : rawData),
    [rawData],
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [linkedIds, setLinkedIds] = useState<Record<string, string>>(
    () => Object.fromEntries(
      data.nodes
        .filter((n) => n.data.learningPointId)
        .map((n) => [n.id, n.data.learningPointId!]),
    ),
  );
  const [barDismissed, setBarDismissed] = useState(
    () => localStorage.getItem(`mindmap:${data.id}:dismissed`) === '1',
  );

  // Mastery hydration: on mount + on window focus.
  const tokenRef = useRef<string>('TODO-session-token');
  useEffect(() => {
    const fetchMastery = async () => {
      const lpIds = Object.values(linkedIds);
      if (lpIds.length === 0) return;
      const snap = await mindmapApi.masterySnapshot({ lpIds, token: tokenRef.current });
      setMastery(snap);
    };
    fetchMastery();
    window.addEventListener('focus', fetchMastery);
    return () => window.removeEventListener('focus', fetchMastery);
  }, [linkedIds]);

  // Children-of map for collapse semantics.
  const childrenOf = useMemo(() => {
    const m = new Map<string, string[]>();
    data.edges.forEach((e) => {
      if (!m.has(e.source)) m.set(e.source, []);
      m.get(e.source)!.push(e.target);
    });
    return m;
  }, [data.edges]);

  const visibleIds = useMemo(() => {
    const hidden = new Set<string>();
    const walk = (id: string) => {
      if (collapsed.has(id)) {
        (childrenOf.get(id) ?? []).forEach((c) => { hidden.add(c); walk(c); });
      } else {
        (childrenOf.get(id) ?? []).forEach(walk);
      }
    };
    walk(data.rootId);
    return new Set(data.nodes.map((n) => n.id).filter((id) => !hidden.has(id)));
  }, [data.nodes, data.rootId, collapsed, childrenOf]);

  const { positioned } = useMindmapLayout(data, visibleIds);

  const handleActivate = useCallback(
    (nodeId: string, lpId?: string) => {
      if (onNodeClick) return onNodeClick(nodeId, lpId);
      if (lpId) {
        navigate(`/study?lpId=${encodeURIComponent(lpId)}&source=mindmap&mindmapId=${encodeURIComponent(data.id)}`);
      }
    },
    [onNodeClick, navigate, data.id],
  );

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  }, []);

  const rfNodes = useMemo(() => {
    const posMap = new Map(positioned.map((p) => [p.id, p.position]));
    return data.nodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => {
        const lpId = linkedIds[n.id];
        const runtime: MindNodeRuntimeData = {
          ...n.data,
          learningPointId: lpId,
          masteryLevel: lpId ? mastery[lpId] : undefined,
          childCount: (childrenOf.get(n.id) ?? []).length,
          isCollapsed: collapsed.has(n.id),
          onActivate: handleActivate,
          onToggleCollapse: handleToggleCollapse,
        };
        return {
          id: n.id,
          type: n.id === data.rootId ? 'mindRoot' : 'mind',
          position: posMap.get(n.id) ?? { x: 0, y: 0 },
          data: runtime,
        };
      });
  }, [data.nodes, data.rootId, visibleIds, positioned, linkedIds, mastery, collapsed, childrenOf, handleActivate, handleToggleCollapse]);

  const rfEdges = useMemo(
    () => data.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.data?.relation })),
    [data.edges, visibleIds],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);
  useEffect(() => setNodes(rfNodes), [rfNodes, setNodes]);
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges]);

  const unsavedNodeIds = useMemo(
    () => data.nodes.filter((n) => !linkedIds[n.id]).map((n) => n.id),
    [data.nodes, linkedIds],
  );
  const showBar = !readOnly && !barDismissed && unsavedNodeIds.length > 0;

  const handleSave = async (nodeIds: string[]) => {
    const nodesToSave = data.nodes
      .filter((n) => nodeIds.includes(n.id))
      .map((n) => ({ id: n.id, data: n.data }));
    const res = await mindmapApi.saveAsLearningPoints({
      mindmapId: data.id, bookId, nodes: nodesToSave, token: tokenRef.current,
    });
    const newLinks = { ...linkedIds };
    nodesToSave.forEach((n, i) => {
      const lpId = res.lpIds?.[i];
      if (lpId) newLinks[n.id] = lpId;
    });
    setLinkedIds(newLinks);
  };

  const handleDismiss = () => {
    localStorage.setItem(`mindmap:${data.id}:dismissed`, '1');
    setBarDismissed(true);
  };

  const size = MODE_SIZE[mode];

  return (
    <Box sx={{ width: size.width, height: size.height, display: 'flex', flexDirection: 'column' }}>
      {showBar && (
        <SaveConceptsBar
          data={data}
          unsavedNodeIds={unsavedNodeIds}
          onSave={handleSave}
          onDismiss={handleDismiss}
        />
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          nodesDraggable={mode === 'expanded' && !readOnly}
          panOnDrag
          zoomOnScroll
        >
          <Background />
          {mode === 'expanded' && <Controls />}
          {mode === 'expanded' && <MiniMap pannable zoomable />}
        </ReactFlow>
      </Box>
    </Box>
  );
}
```

> Token handling caveat: `tokenRef` is a placeholder. The codebase already has a session-token pattern — check `src/renderer/api/brainApi.js` for how it obtains the token (likely `window.electron.session.token()` or via Redux). Replace the placeholder with that.

- [ ] **Step 3: Lint**

```bash
npm run lint -- src/renderer/components/mindmap/MindmapSurface.tsx
```

Address any errors.

### Task 6.3: Integration test

**Files:**
- Create: `src/__tests__/integration/mindmap-learning-loop.test.js`

- [ ] **Step 1: Write the test**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const MindmapPersistenceService = require('../../main/utils/MindmapPersistenceService');

describe('mindmap learning loop (main-process integration)', () => {
  let db;
  let svc;
  let mockLPService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));

    const lpStore = new Map();
    mockLPService = {
      createLearningPointsBatch: jest.fn(async (points) => {
        const ids = [];
        points.forEach((p, i) => {
          const id = `lp-${lpStore.size + i}`;
          lpStore.set(id, { id, masteryLevel: 0, ...p });
          ids.push(id);
        });
        return { created: points.length, ids };
      }),
      getLearningPointById: jest.fn(async (id) => lpStore.get(id) ?? null),
    };
    svc = new MindmapPersistenceService({ db, learningPointService: mockLPService });
  });

  afterEach(() => db.close());

  it('save → re-open → mastery snapshot reflects current store', async () => {
    const nodes = [
      { id: 'n1', data: { text: 'photosynthesis', domain: 'knowledge' } },
      { id: 'n2', data: { text: 'chlorophyll', domain: 'knowledge' } },
    ];
    const saved = await svc.saveAsLearningPoints({ mindmapId: 'm1', bookId: 'b1', nodes, token: 't' });
    expect(saved.lpIds).toHaveLength(2);

    // Simulate a study session lifting mastery on n1's lp:
    const targetLp = saved.lpIds[0];
    mockLPService.getLearningPointById = jest.fn(async (id) => ({
      id,
      masteryLevel: id === targetLp ? 60 : 0,
    }));

    // Re-open same mindmap: same lp ids, mastery now reflects study.
    const snap = await svc.getMasterySnapshot(saved.lpIds, 't');
    expect(snap[targetLp]).toBe(60);
    expect(snap[saved.lpIds[1]]).toBe(0);

    // Second save = no-op.
    mockLPService.createLearningPointsBatch.mockClear();
    await svc.saveAsLearningPoints({ mindmapId: 'm1', bookId: 'b1', nodes, token: 't' });
    expect(mockLPService.createLearningPointsBatch).not.toHaveBeenCalled();
  });
});
```

```bash
npx jest src/__tests__/integration/mindmap-learning-loop.test.js
```

Expected: PASS (service exists from commit 5).

### Task 6.4: Commit

```bash
git add src/renderer/components/mindmap/SaveConceptsBar.tsx \
  src/renderer/components/mindmap/MindmapSurface.tsx \
  src/renderer/components/mindmap/ContextMenu.tsx \
  src/__tests__/integration/mindmap-learning-loop.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "$(cat <<'EOF'
feat(mindmap): MindmapSurface + SaveConceptsBar — the unified renderer

One component handles every mindmap surface in the app via mode prop.
Wires A (mastery overlay via mastery-snapshot IPC, refresh on mount +
window.focus), B (click-to-study via /study?source=mindmap navigation),
C (SaveConceptsBar dispatching mindmap:save-as-learning-points).
Legacy v11 payloads converted on the fly via legacyToCanonical.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 7 — Migrate 12 call sites

Each task below is one file. **For every task: open file, find the existing mindmap render (search for `MyMindMap`, `MindmapModal`, or `parseMindmapToReactFlow`), replace with `<MindmapSurface data={...} mode={...} bookId={...} />`, run the app, open the affected surface, verify it renders.** Pick `mode` per the table below.

| Site (file) | Mode |
|---|---|
| `src/renderer/views/chat/ChatDetailPanel.js` | `'inline'` (chat message) |
| `src/renderer/components/chat/InContextChatPanel.js` | `'inline'` |
| `src/renderer/components/chat/CreateNotePanel.tsx` | `'inline'` |
| `src/renderer/views/reading/EPubView.js` | `'expanded'` (panel) |
| `src/renderer/views/reading/PDFView.js` | `'expanded'` |
| `src/renderer/views/reading/CreateAnnotationPanel.js` | `'inline'` |
| `src/renderer/views/reading/CreatePDFAnnotationDialog.js` | `'inline'` |
| `src/renderer/views/notes/NoteCard.js` | `'card'` |
| `src/renderer/components/note/CardContentSwitcher.js` | `'card'` |
| `src/renderer/views/learnabout/LearnAboutDetailPanel.js` | `'expanded'` |
| `src/renderer/views/browser/Browser.js` | `'inline'` |
| `src/renderer/components/UniversalCard/CardContentRenderer.js` | `'card'` (replace `(coming soon)` placeholder) |

### Task 7.1: Migrate `ChatDetailPanel.js`

**Files:**
- Modify: `src/renderer/views/chat/ChatDetailPanel.js`

- [ ] **Step 1: Locate current mindmap rendering**

```bash
grep -n "MyMindMap\|parseMindmapToReactFlow\|case 'mindmap'" src/renderer/views/chat/ChatDetailPanel.js
```

Read the surrounding ~30 lines around each match.

- [ ] **Step 2: Swap import and render**

Replace:

```js
import MyMindMap from '../../components/mindmap';
import parseMindmapToReactFlow, { /* ... */ } from '../../../commons/utils/content/mindmapUtil';
```

with:

```js
import MindmapSurface from '../../components/mindmap/MindmapSurface';
```

Replace the `<MyMindMap keywordMap={...} descriptionMap={...} />` usage with:

```js
<MindmapSurface
  data={JSON.parse(message.content)}
  mode="inline"
  bookId={currentBookId}
  readOnly={message.role !== 'user'}
/>
```

(Where `currentBookId` comes from whatever scope already provides book context — search for `bookId` references in surrounding code.)

- [ ] **Step 3: Run and verify**

```bash
npm start
```

Open a chat that already has a `type: 'mindmap'` message. Verify it renders. Then trigger a new mindmap generation and verify the new one renders with the SaveConceptsBar.

- [ ] **Step 4: Commit-pending — defer to end of commit 7**

Do not commit per-file. Stage and commit at the end of commit 7 as a single commit.

### Tasks 7.2 — 7.12

Repeat the pattern of Task 7.1 for each remaining file in the table. For each:

1. Grep for `MyMindMap` / `MindmapModal` / `parseMindmapToReactFlow` in the file.
2. Replace import with `import MindmapSurface from '<correct relative path>/components/mindmap/MindmapSurface'`.
3. Replace render with `<MindmapSurface data={...} mode="<from table>" bookId={...} readOnly={...} />`.
4. Run the app, open the surface, verify render.
5. For `CardContentRenderer.js` (Task 7.12), delete the `(Mindmap visualization coming soon)` text and mount `<MindmapSurface data={mindmapData} mode="card" />` instead.

### Task 7.13: Delete legacy files

**Files:**
- Delete: `src/renderer/components/mindmap/index.js` (the old `MyMindMap` default export)
- Delete: `src/renderer/components/mindmap/MindmapModal.tsx`
- Create: `src/renderer/components/mindmap/index.ts` (re-export `MindmapSurface` so existing `import MyMindMap from '../../components/mindmap'` patterns continue to resolve through one redirect)

- [ ] **Step 1: Replace the old index**

```ts
// src/renderer/components/mindmap/index.ts
export { default } from './MindmapSurface';
export { default as MindmapSurface } from './MindmapSurface';
```

- [ ] **Step 2: Delete the legacy files**

```bash
rm src/renderer/components/mindmap/MindmapModal.tsx
```

(The old `index.js` becomes redundant once `index.ts` is in place — webpack picks the `.ts` over the `.js` if the `.js` still exists, but it's cleaner to also delete it.)

```bash
rm src/renderer/components/mindmap/index.js
```

- [ ] **Step 3: Smoke**

```bash
npm start
```

Click through each of the 12 surfaces and confirm no broken-import errors.

### Task 7.14: Commit

```bash
git add src/renderer/views/chat/ChatDetailPanel.js \
  src/renderer/components/chat/InContextChatPanel.js \
  src/renderer/components/chat/CreateNotePanel.tsx \
  src/renderer/views/reading/EPubView.js \
  src/renderer/views/reading/PDFView.js \
  src/renderer/views/reading/CreateAnnotationPanel.js \
  src/renderer/views/reading/CreatePDFAnnotationDialog.js \
  src/renderer/views/notes/NoteCard.js \
  src/renderer/components/note/CardContentSwitcher.js \
  src/renderer/views/learnabout/LearnAboutDetailPanel.js \
  src/renderer/views/browser/Browser.js \
  src/renderer/components/UniversalCard/CardContentRenderer.js \
  src/renderer/components/mindmap/index.ts
git rm src/renderer/components/mindmap/index.js src/renderer/components/mindmap/MindmapModal.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "$(cat <<'EOF'
feat(mindmap): migrate 12 call sites to MindmapSurface

Every mindmap surface in the app now routes through one component.
CardContentRenderer's "(Mindmap visualization coming soon)" placeholder
is finally fulfilled. Legacy MyMindMap and MindmapModal deleted.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 8 — Cleanup, docs, glossary

### Task 8.1: Prune `mindmapUtil.js`

**Files:**
- Modify: `src/commons/utils/content/mindmapUtil.js`

- [ ] **Step 1: Identify dead exports**

```bash
grep -rn "parseMindmapToReactFlow\|convertToReactFlow\|convertToReactFlow0\|removeStartEndSymbolLines" src/ --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx"
```

For each function name, check that the only matches are in `mindmapUtil.js` itself plus historic/legacy tests. If a call still exists outside, leave the function in place.

- [ ] **Step 2: Delete unused exports**

For each function with no remaining callers, delete its declaration + the corresponding `export` line.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: pass.

### Task 8.2: Update `CONTEXT.md`

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Append the new glossary block**

Append at the end of `CONTEXT.md`:

```md
## Mindmap (2026-06-23 upgrade)

- **MindmapSurface** — the single mindmap renderer (`src/renderer/components/mindmap/MindmapSurface.tsx`). Replaces `MyMindMap`, `MindmapModal`, and the `(coming soon)` placeholder. Used by every mindmap site in the app via `mode='inline' | 'expanded' | 'card'`. *Not "MindMap", not "MindmapView"*.
- **MindNode** — the custom React node type rendered by MindmapSurface. Carries mastery shade (5-band alpha ramp on domain accent), domain icon + 4px accent stripe, collapse chevron. *Not "MindmapNode"*.
- **MindmapData** — the canonical mindmap shape (`src/commons/model/MindmapData.ts`). One shape for every mindmap site; legacy v11 ReactFlow JSON converts via `legacyToCanonical`. Stored mindmaps carry no x/y; positions recomputed by elk on every render.
- **Mastery Overlay** — node background tint reflecting `masteryLevel` (0-100), 5-band alpha ramp. Hydrated from `mindmap:mastery-snapshot` IPC on mount + on window focus.
- **Save Concepts Bar** — bar above the canvas implementing C-confirm. Single click converts every unsaved node into a Learning Point via `MindmapPersistenceService.saveAsLearningPoints`. Dismissal is per-mindmap.
- **mindmap_node_lp_link** — SQLite table joining `(mindmap_id, node_id) → lp_id`. Enables reopen-with-mastery-hydrated and the "Find in graph" reverse-lookup.
- **`feature_surface: 'mindmap-study'`** — closed-enum value in `featureSurface.js`. Mastery moves caused by a mindmap-originated study session attribute to this surface in Phase 13 Spend & Returns.
```

### Task 8.3: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Edit the mindmap section**

Replace the line in the architecture summary that mentions `MyMindMap` with a one-line reference to `MindmapSurface` and a link to the spec doc. Single-line change.

### Task 8.4: Final manual verification

- [ ] **Step 1: Manual verification checklist**

```bash
npm start
```

Tick each item:

- [ ] Open an old chat with a stored mindmap message — renders.
- [ ] Generate new mindmap from web search → click "Save N concepts" → check Knowledge Dashboard for new LPs.
- [ ] Run one study session on a saved LP → reopen mindmap → that node shade is deeper.
- [ ] Knowledge Graph + Learning Path render.
- [ ] MoodBoard still renders (projectstorm untouched).
- [ ] Inline mindmap inside NoteCard fits the 200px footprint.

### Task 8.5: Commit

```bash
git add src/commons/utils/content/mindmapUtil.js CONTEXT.md CLAUDE.md
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "$(cat <<'EOF'
chore(mindmap): prune legacy utils + glossary + CLAUDE.md update

Removes parseMindmapToReactFlow / convertToReactFlow / convertToReactFlow0
now that no caller remains. legacyToCanonical kept for old chat-history
payloads. CONTEXT.md gains mindmap glossary; CLAUDE.md points at the new
MindmapSurface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review — spec coverage

| Spec section | Implemented in |
|---|---|
| `<MindmapSurface>` + replaces `MyMindMap`/`MindmapModal`/`(coming soon)` | Tasks 6.2, 7.12, 7.13 |
| `useMindmapLayout` (elk worker) | Tasks 4.1, 4.2 |
| `MindmapPersistenceService` + IPC | Tasks 5.4, 5.5 |
| Engine upgrade reactflow@11 → @xyflow/react@12 | Task 1.1, 1.2, 1.3 |
| Mode presets (`inline`/`expanded`/`card`) | Task 6.2 (`MODE_SIZE`) |
| `MindmapData` canonical shape | Task 2.1 |
| `legacyToCanonical` adapter | Tasks 2.2, 2.3 |
| `MindNode` visual contract (mastery shading, accent stripe, chevron) | Tasks 3.1, 3.2 |
| Mastery overlay (A) — hydrate + live update | Task 6.2 (mount + window.focus refetch) |
| Click-to-study (B) — `/study?source=mindmap` | Task 6.2 (`handleActivate`) |
| ContextMenu "Study this concept" + "Find in graph" | Task 6.2 step 1 |
| `SaveConceptsBar` C-confirm | Task 6.1, wired in 6.2 |
| `mindmap_node_lp_link` table | Task 5.2 |
| Dedup by `(mindmapId, nodeId)` | Task 5.4 |
| `'mindmap'` source + `'mindmap-study'` feature_surface | Task 5.1 |
| Layout right-tree / radial | Task 4.2 (`ELK_OPTIONS`) |
| Collapse semantics | Task 6.2 (`visibleIds` filter) |
| Migration commits + rollback path | Commits 1–8 mirror spec commit shape |
| Testing strategy (unit + integration + smoke) | Tasks 2.2, 3.1, 5.3, 6.3, plus existing `npm run test:smoke` |
| Glossary additions | Task 8.2 |

### Type consistency check

- `MindmapData`, `MindmapNodeData`, `MindmapEdgeData` referenced in Tasks 2, 6 — types defined in Task 2.1. ✓
- `MindNodeRuntimeData` exported from MindNode (Task 3.2), imported by MindRootNode (Task 3.3) and MindmapSurface (Task 6.2). ✓
- `saveAsLearningPoints({ mindmapId, bookId, nodes, token })` — same shape in service (5.4), IPC handler (5.5), renderer API client (5.5), MindmapSurface call site (6.2). ✓
- `masterySnapshot({ lpIds, token })` — same shape across service / IPC / client / surface. ✓
- `learningPointService.createLearningPointsBatch(points, token)` — method signature from the actual codebase (confirmed via read), used in 5.4. ✓
- `featureSurface` arrays (`FEATURE_SURFACES`, `ATTENTION_STATE`, `PHASE_GROUP`) extended in 5.1 — all three maps updated together to satisfy the lint guard. ✓

### Placeholder scan

- "TBD" / "TODO" — only in step 6.2 step 2 token caveat ("TODO-session-token"), explicitly called out as a placeholder for the engineer to wire to the real session-token source. Not a plan placeholder; it's an inline directive.
- Per-task action: every step has runnable code/commands.

### Assumptions Made

- Assumed `@xyflow/react@^12.3.0` is API-compatible enough that mechanical rewrite + a single `reconnectEdge` rename suffices for the KG + Learning Path migration. **(critical)** if v12 broke `connectionMode`, `nodeTypes` stability requirements, or selection state — those would surface during Task 1.3 manual verification.
- Assumed the project uses webpack 5's native `new Worker(new URL(...))` syntax (matches the `.erb` toolchain). If a worker-loader convention is in use, Task 4.2's instantiation needs adjustment.
- Assumed `MindmapPersistenceService.test.js` can read `db.sql` from the project root and run the entire DDL on `:memory:`. If `db.sql` already includes references that better-sqlite3 can't execute, the test harness has to selectively run only the relevant CREATE statements.
- Assumed the session-token wiring pattern in `brainApi.js` or similar exposes a sync or near-sync token accessor the renderer can read on mount — replacing the `tokenRef` placeholder in MindmapSurface. **(critical)** if the token is only available via Redux store or async resolve — that requires moving the mastery fetch into a `useEffect` that waits for the token.

### Discovered Issues

- `src/commons/model/LearningPointDomains.ts:46` — comment notes 5 fragmented domain enums; per-domain color palette may not exist. Task 3.1's `DOMAIN_HEX` is local until that consolidation lands; the duplication is intentional and should be removed in a future cleanup.
- `src/main/utils/LearningPointService.js:399-435` — `createLearningPoint` returns `{ error }` or the created LP without surfacing `lpId` explicitly. `createLearningPointsBatch` (line 444) returns `{ created, errors, ... }` — the spec uses `ids` field; if `graphInterface.createLearningPointsBatch` doesn't return `ids`, Task 5.4 needs to call `getBySource('mindmap', mindmapId)` post-insert to recover the ids. Verify shape during Task 5.3 integration test failure if it surfaces.
- `src/renderer/components/UniversalCard/CardContentRenderer.js:466-470` — `(Mindmap visualization coming soon)` placeholder ships in production today. Replaced in Task 7.12.

---

## Execution
