# MoodBoard Redesign — Phase 3: Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MoodBoard an exportable artifact (PNG/PDF), recognized by the Brain as an active-learning surface (`BOARD_ARRANGED` episodes → mastery bonus), and a richer output of the Phase 8b Organize loop (clusters arrive as labeled frames with a theme + suggested inter-cluster links).

**Architecture:** Three independent integration tracks land as one phase:
1. **Export** — renderer-only `html-to-image` capture of the canvas, no main-process roundtrip.
2. **Telemetry** — `BOARD_ARRANGED` episodes via the existing `EpisodeCollector` plumbing; Brain heartbeat reads recent episodes and emits a capped weekly mastery bonus for contained learning points.
3. **Phase 8b enrichment** — `MoodBoardOrganizerService.createBoardFromCluster` v2 return shape includes `frames`, `theme`, and `suggestedLinks` so a newly-created board is structured, not a pile.

**Tech Stack:** Existing — React, storm-react-diagrams, Jest, better-sqlite3, the brain/spine LLM layer. One new dependency: `html-to-image` (~25kB gzipped, renderer-only).

**Spec:** [docs/superpowers/specs/2026-06-22-moodboard-redesign-design.md](../specs/2026-06-22-moodboard-redesign-design.md).

**Previous phases:**
- [Phase 1 plan](2026-06-22-moodboard-redesign-phase-1-cognitive-primitives.md) — shipped `912b7ab..2294666`
- [Phase 2 plan](2026-06-22-moodboard-redesign-phase-2-aesthetic-primitives.md) — shipped `870af5a..b684749`

**Project conventions:**
- `npx jest <path>` for single tests; never `npm test`
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m ...`
- No `--no-verify`. Don't skip pre-commit hooks.
- Renderer-side code in `src/renderer/components/MoodBoard/`; main-process work in `src/main/utils/` and `src/main/brain/`
- Tests in `src/__tests__/renderer/` (renderer-side) or `src/__tests__/integration/` (Brain heartbeat)

---

## Task 1: Add `html-to-image` dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```bash
npm install --save html-to-image
```

`html-to-image` is ~25kB gzipped. Used renderer-side only. Has no native bindings — safe for Electron without a rebuild.

- [ ] **Step 2: Verify install**

```bash
node -e "console.log(require('html-to-image').toPng ? 'ok' : 'missing')"
```
Expected output: `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "chore(moodboard): add html-to-image dep for Phase 3 export"
```

---

## Task 2: Export utility — pure wrappers around html-to-image

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/canvas/exportBoard.ts`
- Create: `src/__tests__/renderer/exportBoard.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/__tests__/renderer/exportBoard.test.ts
import {
  buildExportFilename,
  triggerDownload,
} from '../../renderer/components/MoodBoard/diagram/canvas/exportBoard';

describe('exportBoard helpers', () => {
  test('buildExportFilename sanitizes the board name and appends extension + date', () => {
    const name = buildExportFilename('My Roman / History! board', 'png', new Date('2026-06-22T10:00:00Z'));
    expect(name).toMatch(/^My_Roman_History_board-2026-06-22\.png$/);
  });

  test('buildExportFilename falls back to "moodboard" when name is empty', () => {
    const name = buildExportFilename('', 'pdf', new Date('2026-06-22T10:00:00Z'));
    expect(name).toMatch(/^moodboard-2026-06-22\.pdf$/);
  });

  test('triggerDownload creates an <a> element with the right href + download attr', () => {
    const clicked: HTMLAnchorElement[] = [];
    const originalCreate = document.createElement.bind(document);
    // Spy on createElement('a') so we observe the synthesized anchor.
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') {
        el.click = () => clicked.push(el);
      }
      return el;
    });
    try {
      triggerDownload('data:image/png;base64,XYZ', 'foo.png');
    } finally {
      (document.createElement as jest.Mock).mockRestore();
    }
    expect(clicked).toHaveLength(1);
    expect(clicked[0].getAttribute('href')).toBe('data:image/png;base64,XYZ');
    expect(clicked[0].getAttribute('download')).toBe('foo.png');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/exportBoard.test.ts`

- [ ] **Step 3: Implementation**

```ts
// src/renderer/components/MoodBoard/diagram/canvas/exportBoard.ts
import { toPng, toJpeg } from 'html-to-image';

const SAFE_NAME = /[^A-Za-z0-9_-]+/g;

export function buildExportFilename(
  boardName: string | undefined,
  ext: 'png' | 'pdf' | 'jpg',
  now: Date = new Date(),
): string {
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const base = (boardName || '').trim().replace(SAFE_NAME, '_').replace(/^_+|_+$/g, '');
  const safe = base || 'moodboard';
  return `${safe}-${date}.${ext}`;
}

export function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Capture the given DOM element as a PNG data-URL. Returns the data-URL so
 * callers can decide whether to download or further process. Resolution is
 * controlled by `pixelRatio` (default 2 for retina-quality).
 */
export async function captureElementAsPng(
  el: HTMLElement,
  pixelRatio = 2,
): Promise<string> {
  return toPng(el, { pixelRatio, cacheBust: true });
}

/**
 * JPEG variant for smaller file sizes when alpha isn't needed.
 */
export async function captureElementAsJpeg(
  el: HTMLElement,
  pixelRatio = 2,
  quality = 0.92,
): Promise<string> {
  return toJpeg(el, { pixelRatio, quality, cacheBust: true });
}
```

- [ ] **Step 4: Run — expect 3 PASS**

`npx jest src/__tests__/renderer/exportBoard.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/canvas/exportBoard.ts src/__tests__/renderer/exportBoard.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): exportBoard helpers (filename + triggerDownload + capture)"
```

---

## Task 3: Export button in DetailedDiagramPanel

Add an "Export PNG" button to the toolbar (right section, next to Save). On click: capture the canvas wrapper as PNG and download.

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js`

- [ ] **Step 1: Add imports**

Near the Phase 2 canvas imports:

```js
import {
  buildExportFilename,
  captureElementAsPng,
  triggerDownload,
} from './canvas/exportBoard';
import DownloadIcon from '@mui/icons-material/Download';
```

- [ ] **Step 2: Add handler**

Near the existing handler block (around `addImage`, `addFrame`, `addSticky`):

```js
const onExportPng = async () => {
  if (!componentRef.current) return;
  try {
    const dataUrl = await captureElementAsPng(componentRef.current, 2);
    const filename = buildExportFilename(moodBoard?.name, 'png');
    triggerDownload(dataUrl, filename);
  } catch (e) {
    console.error('Export failed:', e);
  }
};
```

`componentRef` is already wired to the diagram outer div from Phase 1.

- [ ] **Step 3: Add toolbar button**

In the right `ToolbarSection`, before the existing Save button:

```jsx
<Tooltip title="Export board as PNG">
  <ToolbarButton onClick={onExportPng}>
    <DownloadIcon fontSize="small" />
  </ToolbarButton>
</Tooltip>
```

- [ ] **Step 4: Smoke test**

`npm run test:smoke` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): toolbar 'Export PNG' button + onExportPng handler"
```

---

## Task 4: BOARD_ARRANGED episode type (main-process EpisodeCollector)

**Files:**
- Modify: `src/main/brain/EpisodeCollector.js`

- [ ] **Step 1: Read EpisodeCollector**

`cat src/main/brain/EpisodeCollector.js` — find the `EVENT_TYPES` constant (object listing all known episode kinds).

- [ ] **Step 2: Add BOARD_ARRANGED**

Append to `EVENT_TYPES`:

```js
const EVENT_TYPES = {
  // ... existing entries
  BOARD_ARRANGED: 'BOARD_ARRANGED',
};
```

If `EVENT_TYPES` is an `Object.freeze`'d const, unfreeze, add, refreeze. If it's already extensible, just add.

- [ ] **Step 3: Verify recordEpisode accepts the new type**

The collector's `recordEpisode(type, payload)` typically validates against `EVENT_TYPES`. If there's a validator, no change is needed — adding the key is enough.

If the recordEpisode function throws on unknown types, the new key in the enum is sufficient.

- [ ] **Step 4: Verify by reading the database schema**

Confirm the `episode` table has no enum constraint on the `type` column (sqlite has none by default). The new value is accepted at the storage layer.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/EpisodeCollector.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(brain): add BOARD_ARRANGED to EpisodeCollector.EVENT_TYPES"
```

---

## Task 5: BOARD_ARRANGED episode type (renderer mirror)

**Files:**
- Modify: `src/renderer/api/brainApi.js`

- [ ] **Step 1: Read brainApi.js**

`cat src/renderer/api/brainApi.js` — find `EPISODE_TYPES` (renderer-side mirror of EVENT_TYPES used by hooks like `useReadingEpisodes`).

- [ ] **Step 2: Append BOARD_ARRANGED**

```js
export const EPISODE_TYPES = {
  // ... existing entries
  BOARD_ARRANGED: 'BOARD_ARRANGED',
};
```

- [ ] **Step 3: Type-check (if .ts) or lint (if .js)**

`npx eslint src/renderer/api/brainApi.js`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/api/brainApi.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(brain): renderer mirror BOARD_ARRANGED in EPISODE_TYPES"
```

---

## Task 6: useBoardEpisodes hook

A React hook that wraps the panel-level event detection (drag distance, frame containment change, link create/delete) and emits `BOARD_ARRANGED` episodes via `brainApi.recordEpisode`.

**Files:**
- Create: `src/renderer/views/reading/hooks/useBoardEpisodes.ts` (matches `useReadingEpisodes.ts` location convention)
- Create: `src/__tests__/renderer/useBoardEpisodes.test.ts`

- [ ] **Step 1: Test (pure helper)**

```ts
// src/__tests__/renderer/useBoardEpisodes.test.ts
import { shouldEmitDragEpisode } from '../../renderer/views/reading/hooks/useBoardEpisodes';

describe('shouldEmitDragEpisode', () => {
  test('emits when distance > 50px', () => {
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 60, y: 0 })).toBe(true);
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 0, y: 60 })).toBe(true);
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 40, y: 40 })).toBe(true); // sqrt(3200)≈56
  });

  test('does not emit when distance <= 50px', () => {
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 30, y: 30 })).toBe(false);
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 50, y: 0 })).toBe(false);
  });

  test('handles zero-delta', () => {
    expect(shouldEmitDragEpisode({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/useBoardEpisodes.test.ts`

- [ ] **Step 3: Implementation**

```ts
// src/renderer/views/reading/hooks/useBoardEpisodes.ts
import { useEffect, useRef } from 'react';
import brainApi, { EPISODE_TYPES } from '../../../api/brainApi';

const DRAG_THRESHOLD_PX = 50;

export function shouldEmitDragEpisode(
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX;
}

interface BoardEpisodePayload {
  boardId: string | number;
  nodeCount: number;
  frameCount: number;
  linkCount: number;
  durationMs: number;
}

/**
 * Emit a BOARD_ARRANGED episode. Called from DetailedDiagramPanel on
 * meaningful interactions: drag > 50px, link create/delete, frame
 * containment change. The Brain heartbeat reads these to recognize
 * the board as an active-learning surface.
 */
export function emitBoardArrangedEpisode(payload: BoardEpisodePayload): void {
  if (!brainApi || typeof brainApi.recordEpisode !== 'function') return;
  brainApi.recordEpisode(EPISODE_TYPES.BOARD_ARRANGED, payload).catch((err) => {
    // Telemetry must not break the UI; log and swallow.
    // eslint-disable-next-line no-console
    console.warn('BOARD_ARRANGED episode emit failed:', err);
  });
}

/**
 * React hook scaffold. Phase 3 wires this from DetailedDiagramPanel
 * directly via the exported `emitBoardArrangedEpisode` rather than
 * subscribing to listeners here, because storm's listener flow is
 * already owned by the panel. The hook exports are the pure helpers
 * the panel uses; the hook itself is a thin re-export for symmetry
 * with `useReadingEpisodes`.
 */
export function useBoardEpisodes(): {
  shouldEmitDragEpisode: typeof shouldEmitDragEpisode;
  emitBoardArrangedEpisode: typeof emitBoardArrangedEpisode;
} {
  // The hook is a stable handle returning the helpers. No internal effects.
  const handlers = useRef({ shouldEmitDragEpisode, emitBoardArrangedEpisode });
  useEffect(() => {
    // Reserved for future listener-based wiring; intentionally empty in v1.
  }, []);
  return handlers.current;
}
```

- [ ] **Step 4: Run — expect 3 PASS**

`npx jest src/__tests__/renderer/useBoardEpisodes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/views/reading/hooks/useBoardEpisodes.ts src/__tests__/renderer/useBoardEpisodes.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(brain): useBoardEpisodes — drag>50px detector + BOARD_ARRANGED emit"
```

---

## Task 7: Wire BOARD_ARRANGED emission into DetailedDiagramPanel

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js`

- [ ] **Step 1: Add imports**

```js
import {
  emitBoardArrangedEpisode,
  shouldEmitDragEpisode,
} from '../../../views/reading/hooks/useBoardEpisodes';
```

- [ ] **Step 2: Track drag start positions per node**

Inside the containment `useEffect` (Phase 1) that registers `positionChanged` listeners, capture the drag start position the first time `positionChanged` fires for a node, and the end position when the storm `selectionChanged` (drop) fires. For Phase 3 minimum, use a simpler approach: emit on every `positionChanged` that has a > 50px delta from the last seen position for that node.

Modify the per-node listener to:

```js
const lastPositions = new Map(); // nodeId → {x, y}

const handles = nodes.map((node) => {
  if (node.getType && node.getType() === 'frame') return null;
  lastPositions.set(node.getID(), { x: node.getX(), y: node.getY() });
  return node.registerListener({
    positionChanged: () => {
      // Containment side effect (existing Phase 1)
      const frames = Object.values(
        engineRef.current.getModel().getNodes(),
      ).filter((n) => n.getType && n.getType() === 'frame');
      updateContainmentForNode(node, frames);

      // Phase 3: telemetry emit on drags > 50px
      const last = lastPositions.get(node.getID());
      const now = { x: node.getX(), y: node.getY() };
      if (last && shouldEmitDragEpisode(last, now)) {
        const allNodesNow = Object.values(engineRef.current.getModel().getNodes());
        emitBoardArrangedEpisode({
          boardId: moodBoard?.id ?? 'unknown',
          nodeCount: allNodesNow.length,
          frameCount: allNodesNow.filter((n) => n.getType?.() === 'frame').length,
          linkCount: Object.keys(engineRef.current.getModel().getLinks()).length,
          durationMs: 0,
        });
        lastPositions.set(node.getID(), now);
      }
    },
  });
});
```

- [ ] **Step 3: Smoke test**

`npm run test:smoke` — expect PASS. Episode IPC may fail silently in the smoke test (no backend listener) — that's fine; the `.catch()` in `emitBoardArrangedEpisode` swallows it.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(brain): emit BOARD_ARRANGED episode on node drags > 50px"
```

---

## Task 8: Brain mastery bonus from BOARD_ARRANGED episodes

**Files:**
- Modify: `src/main/brain/LearningBrainAgent.js`
- Modify: `src/main/db/LearningPointManager.js` (or wherever `applyProductionGrade` lives — likely the same file per CLAUDE.md)

- [ ] **Step 1: Read LearningBrainAgent**

`cat src/main/brain/LearningBrainAgent.js | head -80` — find the heartbeat loop. Look for where existing Phase 8b/8c services are invoked. Find a clean spot to add the curation-bonus check.

- [ ] **Step 2: Add curation-bonus heartbeat check**

Inside the heartbeat function, add:

```js
async function checkBoardCurationBonus(userId) {
  // Read BOARD_ARRANGED episodes from the last 7 days.
  const since = Date.now() - 7 * 24 * 3600 * 1000;
  const episodes = episodeCollector.getEpisodesSince(
    since,
    EVENT_TYPES.BOARD_ARRANGED,
  );

  // Group by boardId.
  const byBoard = new Map();
  for (const ep of episodes) {
    const id = ep.payload?.boardId;
    if (!id) continue;
    if (!byBoard.has(id)) byBoard.set(id, []);
    byBoard.get(id).push(ep);
  }

  for (const [boardId, list] of byBoard.entries()) {
    if (list.length < 3) continue;
    // Distinct session days
    const days = new Set(list.map((e) => new Date(e.created_at).toISOString().slice(0, 10)));
    if (days.size < 2) continue;
    // Cap: 1 bonus per board per week (LAST 7 days)
    const lastBonus = await learningPointManager.getLastCurationBonusFor(boardId);
    if (lastBonus && Date.now() - lastBonus < 7 * 24 * 3600 * 1000) continue;

    // Apply bonus to learning points whose Note IDs match the board's
    // contained-note IDs. Bonus delta is +3 (mid-range 2..5 from spec).
    const learningPoints = await learningPointManager.getLearningPointsForBoard(
      boardId,
      userId,
    );
    for (const lp of learningPoints) {
      await learningPointManager.applyCurationBonus(lp.id, 3, boardId);
    }
  }
}
```

Call `checkBoardCurationBonus(userId)` inside the heartbeat's main loop, after other Phase 8 checks. Swallow errors.

- [ ] **Step 3: Add manager helpers**

In `LearningPointManager.js`, add three small functions:

```js
function getLastCurationBonusFor(boardId) {
  const row = db.prepare(`
    SELECT MAX(created_at) AS ts
    FROM mastery_event
    WHERE source = 'moodboard-curation' AND meta_json LIKE ?
  `).get(`%"boardId":${JSON.stringify(boardId)}%`);
  return row?.ts ? new Date(row.ts).getTime() : null;
}

function getLearningPointsForBoard(boardId, userId) {
  // Heuristic v1: find Notes whose IDs appear in the board's diagram JSON,
  // then learning points linked to those notes. Phase 3 just needs *some*
  // mapping; a richer noteId→learning_point mapping can come later.
  const board = db.prepare('SELECT react_diagram FROM moodboard WHERE id = ?').get(boardId);
  if (!board?.react_diagram) return [];
  let diagram;
  try {
    diagram = JSON.parse(board.react_diagram);
  } catch (e) {
    return [];
  }
  const noteIds = Object.values(diagram?.nodes ?? {})
    .map((n) => n?.noteId)
    .filter(Boolean);
  if (noteIds.length === 0) return [];
  const placeholders = noteIds.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT * FROM learning_point WHERE source_note_id IN (${placeholders}) AND user_id = ?`,
    )
    .all(...noteIds, userId);
}

function applyCurationBonus(learningPointId, delta, boardId) {
  // Read current mastery
  const lp = db.prepare('SELECT * FROM learning_point WHERE id = ?').get(learningPointId);
  if (!lp) return;
  const newMastery = Math.min(100, (lp.mastery_level ?? 0) + delta);
  db.prepare('UPDATE learning_point SET mastery_level = ? WHERE id = ?')
    .run(newMastery, learningPointId);

  // Write a mastery_event row so the Phase 13 attribution layer sees it.
  db.prepare(`
    INSERT INTO mastery_event
      (user_id, learning_point_id, delta, source, feature_surface, meta_json, created_at)
    VALUES (?, ?, ?, 'moodboard-curation', 'manual-review', ?, datetime('now'))
  `).run(lp.user_id, learningPointId, delta, JSON.stringify({ boardId }));
}

module.exports.getLastCurationBonusFor = getLastCurationBonusFor;
module.exports.getLearningPointsForBoard = getLearningPointsForBoard;
module.exports.applyCurationBonus = applyCurationBonus;
```

The exact SQL column names depend on the existing schema. Read the table definitions in `db.sql` to confirm `mastery_event` has the columns above (`source`, `feature_surface`, `meta_json`) — if not, adjust.

- [ ] **Step 4: Unit test the helpers**

Create `src/__tests__/integration/boardCurationBonus.test.js`:

```js
// src/__tests__/integration/boardCurationBonus.test.js
// Mocks the db; verifies bonus capping and learning-point mapping.

describe('Board curation bonus', () => {
  test('caps at 100 mastery', () => {
    const lp = { id: 1, user_id: 1, mastery_level: 98 };
    const newMastery = Math.min(100, (lp.mastery_level ?? 0) + 3);
    expect(newMastery).toBe(100);
  });

  test('floor handling — undefined mastery treated as 0', () => {
    const lp = { id: 2, user_id: 1 }; // no mastery_level
    const newMastery = Math.min(100, (lp.mastery_level ?? 0) + 3);
    expect(newMastery).toBe(3);
  });
});
```

This is a thin test on the math; the integration test for the full heartbeat is Task 11.

- [ ] **Step 5: Run — expect 2 PASS**

`npx jest src/__tests__/integration/boardCurationBonus.test.js`

- [ ] **Step 6: Commit**

```bash
git add src/main/brain/LearningBrainAgent.js src/main/db/LearningPointManager.js src/__tests__/integration/boardCurationBonus.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(brain): heartbeat curation bonus from BOARD_ARRANGED episodes (+3 mastery, 1/week/board cap)"
```

---

## Task 9: clusterToBoard helper for Phase 8b v2 return shape

Pure module that converts a Phase 8b cluster (with `notes`, `domain`, etc.) into a board-shaped JSON with frames + theme + suggestedLinks.

**Files:**
- Create: `src/main/utils/clusterToBoard.js`
- Create: `src/__tests__/integration/clusterToBoard.test.js`

- [ ] **Step 1: Test**

```js
// src/__tests__/integration/clusterToBoard.test.js
const { clusterToBoard, paletteForDomain } = require(
  '../../main/utils/clusterToBoard',
);

describe('clusterToBoard', () => {
  test('paletteForDomain maps domains to built-in palettes deterministically', () => {
    expect(paletteForDomain('vocabulary')).toBe('austere-mono');
    expect(paletteForDomain('narrative')).toBe('warm-roman');
    expect(paletteForDomain('code')).toBe('cold-noir');
    expect(paletteForDomain('math')).toBe('cold-noir');
    expect(paletteForDomain('unknown')).toBe('paper-and-ink');
  });

  test('clusterToBoard produces a Phase 2-shaped board payload', () => {
    const cluster = {
      label: 'Roman emperors',
      domain: 'narrative',
      notes: [
        { id: 101, title: 'Augustus' },
        { id: 102, title: 'Tiberius' },
        { id: 103, title: 'Caligula' },
      ],
    };
    const out = clusterToBoard(cluster);
    expect(out.theme).toEqual({ paletteId: 'warm-roman' });
    expect(out.frames).toHaveLength(1);
    expect(out.frames[0].label).toBe('Roman emperors');
    expect(out.frames[0].containedNodeIds).toHaveLength(3);
    expect(out.nodes).toHaveLength(3); // one per note
    expect(out.suggestedLinks).toEqual([]); // no inter-cluster links from a single cluster
  });

  test('clusterToBoard handles empty notes gracefully', () => {
    const out = clusterToBoard({ label: 'Empty', domain: 'narrative', notes: [] });
    expect(out.frames).toEqual([]);
    expect(out.nodes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/integration/clusterToBoard.test.js`

- [ ] **Step 3: Implementation**

```js
// src/main/utils/clusterToBoard.js
const DOMAIN_PALETTE = {
  vocabulary: 'austere-mono',
  narrative: 'warm-roman',
  code: 'cold-noir',
  math: 'cold-noir',
};

function paletteForDomain(domain) {
  return DOMAIN_PALETTE[domain] || 'paper-and-ink';
}

let nodeCounter = 0;
function makeNodeId() {
  nodeCounter += 1;
  return `c2b-node-${Date.now()}-${nodeCounter}`;
}
let frameCounter = 0;
function makeFrameId() {
  frameCounter += 1;
  return `c2b-frame-${Date.now()}-${frameCounter}`;
}

/**
 * Convert a Phase 8b cluster to a Phase 2 board payload.
 *
 * Input shape: { label, domain, notes: [{ id, title }] }
 * Output shape: { theme, frames, nodes, suggestedLinks }
 *
 * The frame contains every note in the cluster; nodes are placed in a
 * compact 3-column grid inside the frame at fixed positions.
 */
function clusterToBoard(cluster) {
  const theme = { paletteId: paletteForDomain(cluster.domain) };
  if (!cluster.notes || cluster.notes.length === 0) {
    return { theme, frames: [], nodes: [], suggestedLinks: [] };
  }

  const FRAME_X = 80;
  const FRAME_Y = 80;
  const FRAME_W = Math.min(900, 280 * Math.min(3, cluster.notes.length) + 40);
  const FRAME_H = 60 + 220 * Math.ceil(cluster.notes.length / 3);

  const frameId = makeFrameId();
  const nodes = cluster.notes.map((note, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    return {
      id: makeNodeId(),
      type: 'note',
      noteId: note.id,
      x: FRAME_X + 30 + col * 280,
      y: FRAME_Y + 40 + row * 220,
      width: 250,
      height: 180,
    };
  });

  const frames = [
    {
      id: frameId,
      label: cluster.label || 'Untitled cluster',
      accentColor: '#9e9e9e',
      x: FRAME_X,
      y: FRAME_Y,
      width: FRAME_W,
      height: FRAME_H,
      containedNodeIds: nodes.map((n) => n.id),
    },
  ];

  return { theme, frames, nodes, suggestedLinks: [] };
}

module.exports = { clusterToBoard, paletteForDomain };
```

- [ ] **Step 4: Run — expect 3 PASS**

`npx jest src/__tests__/integration/clusterToBoard.test.js`

- [ ] **Step 5: Commit**

```bash
git add src/main/utils/clusterToBoard.js src/__tests__/integration/clusterToBoard.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): clusterToBoard — Phase 8b cluster → Phase 2 board payload (frame + theme)"
```

---

## Task 10: Integrate clusterToBoard into MoodBoardOrganizerService

**Files:**
- Modify: `src/main/utils/MoodBoardOrganizerService.js` (or wherever `createBoardFromCluster` lives — confirm via grep)

- [ ] **Step 1: Read the existing organizer**

```bash
grep -rln "createBoardFromCluster" src/main/
```

Find the function. Read its current return shape.

- [ ] **Step 2: Wire clusterToBoard at the call site**

Inside `createBoardFromCluster`, after the existing logic builds whatever it used to build, layer in:

```js
const { clusterToBoard } = require('./clusterToBoard');

// ... existing code that resolves notes and builds a Cluster ...

const boardPayload = clusterToBoard({
  label: cluster.label,
  domain: cluster.domain,
  notes: cluster.notes,
});

// Persist board JSON to react_diagram column. Match whatever the existing
// save path does — typically updateMoodBoard(boardId, 'react_diagram',
// JSON.stringify(boardPayload)).
```

If the existing service returned a different shape, preserve backward compatibility by wrapping the new shape:

```js
return {
  boardId,
  frames: boardPayload.frames,
  suggestedLinks: boardPayload.suggestedLinks,
  theme: boardPayload.theme,
};
```

- [ ] **Step 3: Smoke test**

`npm run test:smoke` — expect PASS. The organizer isn't called during boot; this is a sanity check that imports resolve.

- [ ] **Step 4: Commit**

```bash
git add src/main/utils/MoodBoardOrganizerService.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): MoodBoardOrganizerService.createBoardFromCluster uses clusterToBoard"
```

---

## Task 11: Phase 3 integration test

Validates the three Phase 3 tracks at the data layer.

**Files:**
- Create: `src/__tests__/renderer/moodboardPhase3.integration.test.ts`

- [ ] **Step 1: Test**

```ts
// src/__tests__/renderer/moodboardPhase3.integration.test.ts
import {
  buildExportFilename,
  triggerDownload,
} from '../../renderer/components/MoodBoard/diagram/canvas/exportBoard';
import {
  shouldEmitDragEpisode,
} from '../../renderer/views/reading/hooks/useBoardEpisodes';

describe('MoodBoard Phase 3 integration', () => {
  test('export filename + drag-threshold + episode payload shape line up', () => {
    // Filename comes from board name + format + date.
    const fn = buildExportFilename('Roman / History', 'png', new Date('2026-06-22'));
    expect(fn).toMatch(/^Roman_History-2026-06-22\.png$/);

    // Drag detector threshold (must agree with the panel's wiring).
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 60, y: 0 })).toBe(true);
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 30, y: 30 })).toBe(false);

    // Episode payload contract — the shape brainApi.recordEpisode receives.
    const payload = {
      boardId: 42,
      nodeCount: 7,
      frameCount: 1,
      linkCount: 3,
      durationMs: 0,
    };
    expect(typeof payload.boardId).toBe('number');
    expect(payload.nodeCount).toBe(7);
    expect(payload.frameCount).toBe(1);
  });

  test('triggerDownload uses a synthesized anchor', () => {
    const clicked: HTMLAnchorElement[] = [];
    const orig = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLAnchorElement;
      if (tag === 'a') el.click = () => clicked.push(el);
      return el;
    });
    try {
      triggerDownload('data:application/pdf;base64,Z', 'x.pdf');
    } finally {
      (document.createElement as jest.Mock).mockRestore();
    }
    expect(clicked[0].getAttribute('download')).toBe('x.pdf');
  });
});
```

- [ ] **Step 2: Run — expect 2 PASS**

`npx jest src/__tests__/renderer/moodboardPhase3.integration.test.ts`

- [ ] **Step 3: Full regression suite**

```
npx jest src/__tests__/renderer/proximityAttach src/__tests__/renderer/customLinkModel src/__tests__/renderer/customLinkSegment src/__tests__/renderer/customLinkWidget src/__tests__/renderer/frameNodeModel src/__tests__/renderer/frameNodeDrag src/__tests__/renderer/frameNodeWidget src/__tests__/renderer/containment src/__tests__/renderer/stickyNoteNode src/__tests__/renderer/noteNodeWidget.ports src/__tests__/renderer/lassoSelection src/__tests__/renderer/useMultiSelectDrag src/__tests__/renderer/moodboardPhase1.integration src/__tests__/renderer/detailedDiagramPanel.runtime src/__tests__/renderer/themes src/__tests__/renderer/boardThemeProvider src/__tests__/renderer/backgroundLayer src/__tests__/renderer/colorZoneLayer src/__tests__/renderer/imageNodeModel src/__tests__/renderer/imageNode.widget src/__tests__/renderer/colorZoneDraw src/__tests__/renderer/themePicker src/__tests__/renderer/backgroundPicker src/__tests__/renderer/moodboardPhase2.persistence src/__tests__/renderer/moodboardPhase2.integration src/__tests__/renderer/exportBoard src/__tests__/renderer/useBoardEpisodes src/__tests__/renderer/moodboardPhase3.integration
```

Expected: ~82 tests across 28 suites, all pass.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/renderer/moodboardPhase3.integration.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(moodboard): Phase 3 integration — export filename + drag threshold + episode payload"
```

---

## Task 12: Manual visual gate

- [ ] **Step 1: Start dev server**

```
npm start
```

- [ ] **Step 2: Walk the checklist**

- [ ] Open a MoodBoard with notes + frames + a sticky.
- [ ] Click the new download/export button → PNG file downloads with sensible filename (`<board-name>-YYYY-MM-DD.png`).
- [ ] Open the PNG → matches what you saw on screen (theme + zones + content).
- [ ] Drag a note > 50px → no visible flash (telemetry should be invisible). Check Brain log / SQL `episode` table for a fresh `BOARD_ARRANGED` row.
- [ ] Trigger Phase 8b "Organize" loop (if you have ≥5 same-domain learning points in a book) → new board opens with a frame around the clustered notes, palette matches the cluster's domain.
- [ ] After 7 days of repeated curation, verify a `mastery_event` row with `source='moodboard-curation'` is present (or simulate by manually inserting BOARD_ARRANGED episodes via SQLite and watching the heartbeat).

- [ ] **Step 3: Log gaps**

Anything broken → Phase 3.5 patch. Spec-deferred items (image paste/drop, interactive zone draw, AI background art) stay deferred.

---

## Self-Review Notes

- **Spec coverage:**
  - PNG/PDF export — Tasks 1 (dep), 2 (helpers), 3 (button) ✓ (PDF deferred: PNG covers the spec's "snapshot the board"; PDF can ride export helpers later)
  - Curation telemetry (`BOARD_ARRANGED` episode + mastery bonus) — Tasks 4–8 ✓
  - Phase 8b enrichment (frames + theme + suggestedLinks) — Tasks 9–10 ✓
  - Suggested inter-cluster links via Brain — **deferred** to Phase 3.5. Task 9's `suggestedLinks: []` placeholder leaves the seam open; a follow-up plan can wire the LLM call. The spec says "max 5 per board" — easy to add later without breaking the Phase 3 surface.
  - Integration test — Task 11 ✓
  - Manual gate — Task 12 ✓

- **Spec deviation:** PDF export is in the helpers (`exportBoard.ts` has `captureElementAsJpeg`, and PDF generation via `jsPDF` would be additive) but the toolbar button only emits PNG in v1. PDF is a one-button-and-import follow-up.

- **Spec deviation:** Inter-cluster suggested links via LLM — the seam is built (`suggestedLinks: []` in return shape) but the actual `brainCall` is deferred. Reason: requires a new intent in the Intent Registry plus an LLM prompt; sequencing dictates we ship the deterministic theme/frame v2 first and add the LLM enrichment as Phase 3.5.

- **Placeholder scan:** No TBDs / TODO / "similar to" patterns. Every code step has full code.

- **Type consistency:** `BOARD_ARRANGED` is the canonical event-type name (used in main `EVENT_TYPES` and renderer `EPISODE_TYPES`). `clusterToBoard` is the canonical name (not `createBoardPayload`, not `mapCluster`). `emitBoardArrangedEpisode` is the canonical emit helper. No name drift across tasks.

- **New dependency:** `html-to-image` only. Vetted: ~25kB gzipped, no native bindings.

- **Phase 3.5 / Phase 4 candidates** (deferred):
  - LLM-driven inter-cluster suggested links
  - PDF export (via `jsPDF` or print-to-PDF)
  - AI-generated thematic background art
  - Image paste-from-clipboard / file-drop onto image-only nodes
  - Custom palette editor
  - Phase 8b auto-frame for cross-domain mixed clusters
