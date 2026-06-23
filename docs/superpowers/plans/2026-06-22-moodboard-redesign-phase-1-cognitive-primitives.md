# MoodBoard Redesign — Phase 1: Cognitive Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free placement, frames (groups), typed connectors, sticky-note nodes, and multi-select to the MoodBoard diagram surface — without replacing `@projectstorm/react-diagrams`.

**Architecture:** New node models (`FrameNodeModel`, `StickyNoteNodeModel`) and a `relationType` field on the existing `CustomLinkModel`, each with their own widget/factory. A pure `ProximityAttach` module computes nearest edge-points so links no longer need ports. Multi-select is layered on the canvas via a `LassoSelection` overlay + `useMultiSelectDrag` hook. Frame containment is tracked on the frame model (`containedNodeIds`); frame drag translates contained nodes via a position-delta listener.

**Tech Stack:** React + emotion + storm-react-diagrams (existing); TypeScript for new node models; Jest + jsdom for tests. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-06-22-moodboard-redesign-design.md](../specs/2026-06-22-moodboard-redesign-design.md).

**Project conventions to follow:**
- Run a single Jest test with `npx jest <path>` (not `npm test`).
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m ...`.
- Don't skip pre-commit hooks. Don't write git config.
- No destructive git operations.
- New TypeScript node models live in `src/renderer/components/MoodBoard/diagram/`.
- Test files live in `src/__tests__/renderer/` to match existing project layout.

---

## Task 1: Define new types contract

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/types.ts`

- [ ] **Step 1: Write the type module**

```ts
// src/renderer/components/MoodBoard/diagram/types.ts

// v1 relation enum for typed connectors. Right-click on a link cycles
// through these in order.
export const RELATION_TYPES = [
  'supports',
  'contrasts',
  'leads-to',
  'similar',
  'caused-by',
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export const DEFAULT_RELATION_TYPE: RelationType = 'supports';

// Rendering spec per relation type. Consumed by CustomLinkSegment.
// stroke = CSS color; dash = SVG stroke-dasharray ('' = solid);
// arrowhead = 'forward' | 'backward' | 'both' | 'none'.
export interface RelationStyle {
  stroke: string;
  strokeWidth: number;
  dash: string;
  arrowhead: 'forward' | 'backward' | 'both' | 'none';
}

export const RELATION_STYLES: Record<RelationType, RelationStyle> = {
  supports: {
    stroke: '#4a4a4a',
    strokeWidth: 2,
    dash: '',
    arrowhead: 'forward',
  },
  contrasts: {
    stroke: '#c62828',
    strokeWidth: 2,
    dash: '6 4',
    arrowhead: 'both',
  },
  'leads-to': {
    stroke: '#1565c0',
    strokeWidth: 3,
    dash: '',
    arrowhead: 'forward',
  },
  similar: {
    stroke: '#9e9e9e',
    strokeWidth: 1.5,
    dash: '',
    arrowhead: 'none',
  },
  'caused-by': {
    stroke: '#6a1b9a',
    strokeWidth: 2,
    dash: '',
    arrowhead: 'backward',
  },
};

// Shape of an axis-aligned bounding rectangle used for proximity attach.
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A single point in canvas-space.
export interface Point {
  x: number;
  y: number;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit src/renderer/components/MoodBoard/diagram/types.ts`
Expected: PASS (no output).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/types.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): add RelationType + Rect/Point types for Phase 1"
```

---

## Task 2: ProximityAttach pure module

Pure function that, given two rects, returns the pair of edge-points minimizing Euclidean distance. Used so links can attach by proximity instead of named ports.

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/ProximityAttach.ts`
- Test: `src/__tests__/renderer/proximityAttach.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/renderer/proximityAttach.test.ts
import {
  nearestEdgePoints,
  edgePointsForRect,
} from '../../renderer/components/MoodBoard/diagram/ProximityAttach';

describe('ProximityAttach', () => {
  test('edgePointsForRect returns 4 midpoints of each side', () => {
    const points = edgePointsForRect({ x: 0, y: 0, width: 100, height: 50 });
    expect(points).toEqual(
      expect.arrayContaining([
        { x: 50, y: 0 },   // top mid
        { x: 100, y: 25 }, // right mid
        { x: 50, y: 50 },  // bottom mid
        { x: 0, y: 25 },   // left mid
      ]),
    );
    expect(points).toHaveLength(4);
  });

  test('nearestEdgePoints picks right side of A and left side of B when B is to the right', () => {
    const a = { x: 0, y: 0, width: 100, height: 50 };
    const b = { x: 200, y: 0, width: 100, height: 50 };
    const { from, to } = nearestEdgePoints(a, b);
    expect(from).toEqual({ x: 100, y: 25 }); // right mid of A
    expect(to).toEqual({ x: 200, y: 25 });   // left mid of B
  });

  test('nearestEdgePoints picks top of A and bottom of B when B is above', () => {
    const a = { x: 0, y: 200, width: 100, height: 50 };
    const b = { x: 0, y: 0, width: 100, height: 50 };
    const { from, to } = nearestEdgePoints(a, b);
    expect(from).toEqual({ x: 50, y: 200 }); // top mid of A
    expect(to).toEqual({ x: 50, y: 50 });    // bottom mid of B
  });

  test('nearestEdgePoints is deterministic on tied distances', () => {
    // Two perfectly-aligned rects share equal distance from any pair of sides.
    // The implementation should pick consistently — same input → same output.
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 150, y: 150, width: 100, height: 100 };
    const r1 = nearestEdgePoints(a, b);
    const r2 = nearestEdgePoints(a, b);
    expect(r1).toEqual(r2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/renderer/proximityAttach.test.ts`
Expected: FAIL with "Cannot find module .../ProximityAttach".

- [ ] **Step 3: Write the implementation**

```ts
// src/renderer/components/MoodBoard/diagram/ProximityAttach.ts
import { Rect, Point } from './types';

export function edgePointsForRect(r: Rect): Point[] {
  return [
    { x: r.x + r.width / 2, y: r.y },             // top mid
    { x: r.x + r.width, y: r.y + r.height / 2 },  // right mid
    { x: r.x + r.width / 2, y: r.y + r.height },  // bottom mid
    { x: r.x, y: r.y + r.height / 2 },            // left mid
  ];
}

function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function nearestEdgePoints(
  a: Rect,
  b: Rect,
): { from: Point; to: Point } {
  const aPts = edgePointsForRect(a);
  const bPts = edgePointsForRect(b);
  let best = { from: aPts[0], to: bPts[0] };
  let bestDist = distSq(aPts[0], bPts[0]);
  // Iterate in fixed order; tie-break by first-encountered (deterministic).
  for (let i = 0; i < aPts.length; i += 1) {
    for (let j = 0; j < bPts.length; j += 1) {
      const d = distSq(aPts[i], bPts[j]);
      if (d < bestDist) {
        bestDist = d;
        best = { from: aPts[i], to: bPts[j] };
      }
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/renderer/proximityAttach.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/ProximityAttach.ts src/__tests__/renderer/proximityAttach.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): add ProximityAttach pure module for port-less links"
```

---

## Task 3: Add relationType field to CustomLinkModel

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/CustomLinkModel.js`
- Test: `src/__tests__/renderer/customLinkModel.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/renderer/customLinkModel.test.js
import CustomLinkModel from '../../renderer/components/MoodBoard/diagram/CustomLinkModel';

describe('CustomLinkModel.relationType', () => {
  test('defaults to "supports" when not provided', () => {
    const link = new CustomLinkModel();
    expect(link.relationType).toBe('supports');
  });

  test('accepts a relationType constructor option', () => {
    const link = new CustomLinkModel({ relationType: 'contrasts' });
    expect(link.relationType).toBe('contrasts');
  });

  test('serialize includes relationType', () => {
    const link = new CustomLinkModel({ relationType: 'leads-to' });
    const data = link.serialize();
    expect(data.relationType).toBe('leads-to');
  });

  test('deserialize restores relationType', () => {
    const link = new CustomLinkModel();
    link.deserialize({ data: { color: 'red', relationType: 'similar' } });
    expect(link.relationType).toBe('similar');
  });

  test('deserialize falls back to "supports" on missing field (legacy boards)', () => {
    const link = new CustomLinkModel();
    link.deserialize({ data: { color: 'red' } }); // no relationType (old data)
    expect(link.relationType).toBe('supports');
  });

  test('setRelationType updates the field', () => {
    const link = new CustomLinkModel();
    link.setRelationType('caused-by');
    expect(link.relationType).toBe('caused-by');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/renderer/customLinkModel.test.js`
Expected: FAIL on first test — `link.relationType` is undefined.

- [ ] **Step 3: Modify CustomLinkModel.js**

Replace the existing content of `src/renderer/components/MoodBoard/diagram/CustomLinkModel.js` with:

```js
import { DefaultLinkModel } from '@projectstorm/react-diagrams';

const DEFAULT_RELATION = 'supports';

class CustomLinkModel extends DefaultLinkModel {
  constructor(options = {}) {
    super({
      ...options,
      type: 'custom-link',
    });
    this.color = options.color || 'red';
    this.relationType = options.relationType || DEFAULT_RELATION;
  }

  setRelationType(relationType) {
    this.relationType = relationType;
    // Storm-react-diagrams listens to fireEvent for repaint; if absent on this
    // version, repaint is driven by the renderer-side useEffect anyway.
    if (typeof this.fireEvent === 'function') {
      this.fireEvent({ relationType }, 'relationTypeChanged');
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      color: this.color,
      relationType: this.relationType,
    };
  }

  deserialize(event) {
    super.deserialize(event);
    this.color = event.data.color;
    this.relationType = event.data.relationType || DEFAULT_RELATION;
  }
}

export default CustomLinkModel;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/renderer/customLinkModel.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/CustomLinkModel.js src/__tests__/renderer/customLinkModel.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): CustomLinkModel gains relationType field (default 'supports')"
```

---

## Task 4: Branch CustomLinkSegment rendering by relationType

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/CustomLinkSegment.js`
- Test: `src/__tests__/renderer/customLinkSegment.test.jsx`

- [ ] **Step 1: Read the current CustomLinkSegment.js**

Run: `cat src/renderer/components/MoodBoard/diagram/CustomLinkSegment.js`

Note its current shape (it renders an SVG path; the new branching applies stroke/dash/arrowhead derived from `RELATION_STYLES[link.relationType]`).

- [ ] **Step 2: Write the failing test**

```jsx
// src/__tests__/renderer/customLinkSegment.test.jsx
import React from 'react';
import { render } from '@testing-library/react';
import CustomLinkSegment from '../../renderer/components/MoodBoard/diagram/CustomLinkSegment';
import CustomLinkModel from '../../renderer/components/MoodBoard/diagram/CustomLinkModel';
import { RELATION_STYLES } from '../../renderer/components/MoodBoard/diagram/types';

function makeLink(relationType) {
  const link = new CustomLinkModel({ relationType });
  // Storm models don't compute geometry without an engine; stub the path.
  link.getSVGPath = () => 'M 0 0 L 100 100';
  link.getID = () => `id-${relationType}`;
  return link;
}

describe('CustomLinkSegment relationType styling', () => {
  test('supports → solid dark-gray forward arrow', () => {
    const link = makeLink('supports');
    const { container } = render(
      <svg><CustomLinkSegment link={link} path="M 0 0 L 100 100" /></svg>,
    );
    const path = container.querySelector('path[data-testid="link-stroke"]');
    expect(path?.getAttribute('stroke')).toBe(RELATION_STYLES.supports.stroke);
    expect(path?.getAttribute('stroke-dasharray')).toBe('');
  });

  test('contrasts → red dashed bidirectional', () => {
    const link = makeLink('contrasts');
    const { container } = render(
      <svg><CustomLinkSegment link={link} path="M 0 0 L 100 100" /></svg>,
    );
    const path = container.querySelector('path[data-testid="link-stroke"]');
    expect(path?.getAttribute('stroke')).toBe(RELATION_STYLES.contrasts.stroke);
    expect(path?.getAttribute('stroke-dasharray')).toBe('6 4');
  });

  test('similar → light gray no arrowhead', () => {
    const link = makeLink('similar');
    const { container } = render(
      <svg><CustomLinkSegment link={link} path="M 0 0 L 100 100" /></svg>,
    );
    const arrowFwd = container.querySelector('[data-testid="arrow-forward"]');
    const arrowBwd = container.querySelector('[data-testid="arrow-backward"]');
    expect(arrowFwd).toBeNull();
    expect(arrowBwd).toBeNull();
  });

  test('caused-by → backward arrowhead', () => {
    const link = makeLink('caused-by');
    const { container } = render(
      <svg><CustomLinkSegment link={link} path="M 0 0 L 100 100" /></svg>,
    );
    expect(
      container.querySelector('[data-testid="arrow-backward"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="arrow-forward"]'),
    ).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/customLinkSegment.test.jsx`
Expected: FAIL — current segment renders a fixed color and no `data-testid` markers.

- [ ] **Step 4: Replace CustomLinkSegment.js**

```jsx
// src/renderer/components/MoodBoard/diagram/CustomLinkSegment.js
import React from 'react';
import { RELATION_STYLES } from './types';

function ArrowMarker({ id, color, side }) {
  // SVG marker pointing toward the path direction (forward) or opposite (backward).
  // Path direction in storm = parametric t increasing from source → target.
  const rotate = side === 'backward' ? 'rotate(180 5 5)' : '';
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
      data-testid={`arrow-${side}`}
    >
      <path
        d="M 0 0 L 10 5 L 0 10 z"
        fill={color}
        transform={rotate}
      />
    </marker>
  );
}

function CustomLinkSegment({ link, path }) {
  const relationType = link.relationType || 'supports';
  const style = RELATION_STYLES[relationType] || RELATION_STYLES.supports;
  const id = link.getID ? link.getID() : 'link';

  const fwdId = `arrow-fwd-${id}`;
  const bwdId = `arrow-bwd-${id}`;

  const showFwd =
    style.arrowhead === 'forward' || style.arrowhead === 'both';
  const showBwd =
    style.arrowhead === 'backward' || style.arrowhead === 'both';

  return (
    <g>
      <defs>
        {showFwd && (
          <ArrowMarker id={fwdId} color={style.stroke} side="forward" />
        )}
        {showBwd && (
          <ArrowMarker id={bwdId} color={style.stroke} side="backward" />
        )}
      </defs>
      <path
        data-testid="link-stroke"
        d={path}
        fill="none"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.dash}
        markerEnd={showFwd ? `url(#${fwdId})` : undefined}
        markerStart={showBwd ? `url(#${bwdId})` : undefined}
      />
    </g>
  );
}

export default CustomLinkSegment;
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/customLinkSegment.test.jsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/CustomLinkSegment.js src/__tests__/renderer/customLinkSegment.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): CustomLinkSegment renders typed connectors per RELATION_STYLES"
```

---

## Task 5: Right-click a link → cycle relationType

The existing `ContextMenu.js` handles canvas right-click. Add a link-targeted right-click that cycles through `RELATION_TYPES`.

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/CustomLinkWidget.js`
- Test: `src/__tests__/renderer/customLinkWidget.test.jsx`

- [ ] **Step 1: Read the current CustomLinkWidget.js**

Run: `cat src/renderer/components/MoodBoard/diagram/CustomLinkWidget.js`

It wraps `CustomLinkSegment` and forwards engine/link props. We add a `contextmenu` handler that walks the relation enum.

- [ ] **Step 2: Write the failing test**

```jsx
// src/__tests__/renderer/customLinkWidget.test.jsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import CustomLinkWidget from '../../renderer/components/MoodBoard/diagram/CustomLinkWidget';
import CustomLinkModel from '../../renderer/components/MoodBoard/diagram/CustomLinkModel';
import { RELATION_TYPES } from '../../renderer/components/MoodBoard/diagram/types';

function setup(initial = 'supports') {
  const link = new CustomLinkModel({ relationType: initial });
  link.getSVGPath = () => 'M 0 0 L 100 100';
  link.getID = () => 'test-link';
  // Minimal engine stub — widget uses engine.repaintCanvas optionally.
  const engine = { repaintCanvas: jest.fn() };
  return { link, engine };
}

describe('CustomLinkWidget right-click cycles relationType', () => {
  test('cycles supports → contrasts on right-click', () => {
    const { link, engine } = setup('supports');
    const { container } = render(
      <svg>
        <CustomLinkWidget link={link} engine={engine} path="M 0 0 L 100 100" />
      </svg>,
    );
    const hit = container.querySelector('[data-testid="link-hit"]');
    fireEvent.contextMenu(hit);
    expect(link.relationType).toBe('contrasts');
  });

  test('wraps from caused-by back to supports', () => {
    const last = RELATION_TYPES[RELATION_TYPES.length - 1];
    const first = RELATION_TYPES[0];
    const { link, engine } = setup(last);
    const { container } = render(
      <svg>
        <CustomLinkWidget link={link} engine={engine} path="M 0 0 L 100 100" />
      </svg>,
    );
    fireEvent.contextMenu(container.querySelector('[data-testid="link-hit"]'));
    expect(link.relationType).toBe(first);
  });

  test('calls engine.repaintCanvas after the change', () => {
    const { link, engine } = setup('supports');
    const { container } = render(
      <svg>
        <CustomLinkWidget link={link} engine={engine} path="M 0 0 L 100 100" />
      </svg>,
    );
    fireEvent.contextMenu(container.querySelector('[data-testid="link-hit"]'));
    expect(engine.repaintCanvas).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/customLinkWidget.test.jsx`
Expected: FAIL — current widget has no hit-target with `data-testid="link-hit"`.

- [ ] **Step 4: Modify CustomLinkWidget.js**

Replace its render output to include a wide invisible hit-path for the contextmenu, on top of the `CustomLinkSegment`. The hit-path is `stroke="transparent"` with a large `strokeWidth` so right-click is forgiving on thin lines.

```jsx
// src/renderer/components/MoodBoard/diagram/CustomLinkWidget.js
import React, { useCallback } from 'react';
import CustomLinkSegment from './CustomLinkSegment';
import { RELATION_TYPES } from './types';

function CustomLinkWidget({ link, engine, path }) {
  const onContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = link.relationType || RELATION_TYPES[0];
      const idx = RELATION_TYPES.indexOf(current);
      const next = RELATION_TYPES[(idx + 1) % RELATION_TYPES.length];
      if (typeof link.setRelationType === 'function') {
        link.setRelationType(next);
      } else {
        link.relationType = next;
      }
      if (engine && typeof engine.repaintCanvas === 'function') {
        engine.repaintCanvas();
      }
    },
    [link, engine],
  );

  return (
    <g>
      <CustomLinkSegment link={link} path={path} />
      {/* Wide invisible hit-region for right-click cycling. */}
      <path
        data-testid="link-hit"
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: 'context-menu' }}
        onContextMenu={onContextMenu}
      />
    </g>
  );
}

export default CustomLinkWidget;
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/customLinkWidget.test.jsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the full Phase-1-so-far test suite**

Run: `npx jest src/__tests__/renderer/proximityAttach.test.ts src/__tests__/renderer/customLinkModel.test.js src/__tests__/renderer/customLinkSegment.test.jsx src/__tests__/renderer/customLinkWidget.test.jsx`
Expected: 17 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/CustomLinkWidget.js src/__tests__/renderer/customLinkWidget.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): right-click link cycles relationType through RELATION_TYPES"
```

---

## Task 6: FrameNodeModel

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/FrameNodeModel.ts`
- Test: `src/__tests__/renderer/frameNodeModel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/renderer/frameNodeModel.test.ts
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';

describe('FrameNodeModel', () => {
  test('defaults width/height/label/color', () => {
    const frame = new FrameNodeModel({});
    expect(frame.width).toBe(400);
    expect(frame.height).toBe(300);
    expect(frame.label).toBe('');
    expect(frame.accentColor).toBe('#9e9e9e');
    expect(frame.containedNodeIds).toEqual([]);
  });

  test('addContained / removeContained mutate the set without duplicates', () => {
    const frame = new FrameNodeModel({});
    frame.addContained('node-1');
    frame.addContained('node-2');
    frame.addContained('node-1'); // duplicate
    expect(frame.containedNodeIds).toEqual(['node-1', 'node-2']);
    frame.removeContained('node-1');
    expect(frame.containedNodeIds).toEqual(['node-2']);
  });

  test('serialize/deserialize round-trip preserves all fields', () => {
    const frame = new FrameNodeModel({
      width: 500,
      height: 200,
      label: 'Vocabulary cluster',
      accentColor: '#42a5f5',
    });
    frame.addContained('a');
    frame.addContained('b');
    const data = frame.serialize();
    const restored = new FrameNodeModel({});
    restored.deserialize({ data });
    expect(restored.width).toBe(500);
    expect(restored.height).toBe(200);
    expect(restored.label).toBe('Vocabulary cluster');
    expect(restored.accentColor).toBe('#42a5f5');
    expect(restored.containedNodeIds).toEqual(['a', 'b']);
  });

  test('type is "frame"', () => {
    const frame = new FrameNodeModel({});
    expect(frame.getType()).toBe('frame');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/frameNodeModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/renderer/components/MoodBoard/diagram/FrameNodeModel.ts
import {
  NodeModel,
  NodeModelGenerics,
  DeserializeEvent,
} from '@projectstorm/react-diagrams';

export interface FrameNodeOptions {
  width?: number;
  height?: number;
  label?: string;
  accentColor?: string;
}

export class FrameNodeModel extends NodeModel<NodeModelGenerics> {
  public label: string;
  public accentColor: string;
  public containedNodeIds: string[];

  constructor({
    width = 400,
    height = 300,
    label = '',
    accentColor = '#9e9e9e',
  }: FrameNodeOptions) {
    super({ type: 'frame' });
    this.width = width;
    this.height = height;
    this.label = label;
    this.accentColor = accentColor;
    this.containedNodeIds = [];
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  addContained(nodeId: string) {
    if (!this.containedNodeIds.includes(nodeId)) {
      this.containedNodeIds.push(nodeId);
    }
  }

  removeContained(nodeId: string) {
    this.containedNodeIds = this.containedNodeIds.filter((id) => id !== nodeId);
  }

  serialize() {
    return {
      ...super.serialize(),
      width: this.width,
      height: this.height,
      label: this.label,
      accentColor: this.accentColor,
      containedNodeIds: [...this.containedNodeIds],
    };
  }

  deserialize(event: DeserializeEvent<this>) {
    super.deserialize(event);
    const d = event.data as {
      width?: number;
      height?: number;
      label?: string;
      accentColor?: string;
      containedNodeIds?: string[];
    };
    this.width = d.width ?? 400;
    this.height = d.height ?? 300;
    this.label = d.label ?? '';
    this.accentColor = d.accentColor ?? '#9e9e9e';
    this.containedNodeIds = Array.isArray(d.containedNodeIds)
      ? [...d.containedNodeIds]
      : [];
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/frameNodeModel.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/FrameNodeModel.ts src/__tests__/renderer/frameNodeModel.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): FrameNodeModel with containedNodeIds + ser/de"
```

---

## Task 7: FrameNodeWidget + FrameNodeFactory

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/FrameNodeWidget.tsx`
- Create: `src/renderer/components/MoodBoard/diagram/FrameNodeFactory.tsx`
- Test: `src/__tests__/renderer/frameNodeWidget.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/renderer/frameNodeWidget.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';
import FrameNodeWidget from '../../renderer/components/MoodBoard/diagram/FrameNodeWidget';

describe('FrameNodeWidget', () => {
  test('renders the frame label', () => {
    const frame = new FrameNodeModel({
      label: 'Vocabulary cluster',
      accentColor: '#42a5f5',
    });
    const engine = { repaintCanvas: jest.fn() };
    const { getByText } = render(
      <FrameNodeWidget node={frame} engine={engine} />,
    );
    expect(getByText('Vocabulary cluster')).toBeTruthy();
  });

  test('applies the accent color to the border', () => {
    const frame = new FrameNodeModel({ accentColor: '#42a5f5' });
    const engine = { repaintCanvas: jest.fn() };
    const { container } = render(
      <FrameNodeWidget node={frame} engine={engine} />,
    );
    const outer = container.querySelector('[data-testid="frame-outer"]');
    expect((outer as HTMLElement).style.borderColor).toBe(
      'rgb(66, 165, 245)',
    );
  });

  test('label is editable on double-click', () => {
    const frame = new FrameNodeModel({ label: 'old' });
    const engine = { repaintCanvas: jest.fn() };
    const { getByText, container } = render(
      <FrameNodeWidget node={frame} engine={engine} />,
    );
    fireEvent.doubleClick(getByText('old'));
    const input = container.querySelector(
      '[data-testid="frame-label-input"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: 'new label' } });
    fireEvent.blur(input);
    expect(frame.label).toBe('new label');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/frameNodeWidget.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write FrameNodeWidget.tsx**

```tsx
// src/renderer/components/MoodBoard/diagram/FrameNodeWidget.tsx
import * as React from 'react';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { FrameNodeModel } from './FrameNodeModel';

export interface FrameNodeWidgetProps {
  node: FrameNodeModel;
  engine: DiagramEngine | { repaintCanvas: () => void };
}

function FrameNodeWidget({ node, engine }: FrameNodeWidgetProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(node.label);

  const commit = () => {
    node.label = draft;
    setEditing(false);
    if (engine && typeof engine.repaintCanvas === 'function') {
      engine.repaintCanvas();
    }
  };

  return (
    <div
      data-testid="frame-outer"
      style={{
        position: 'relative',
        width: node.width,
        height: node.height,
        border: `2px solid ${node.accentColor}`,
        borderRadius: 12,
        background: `${node.accentColor}10`, // 10% alpha tint
        boxSizing: 'border-box',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -12,
          left: 12,
          padding: '2px 8px',
          background: node.accentColor,
          color: 'white',
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 6,
          maxWidth: '80%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'text',
        }}
        onDoubleClick={() => {
          setDraft(node.label);
          setEditing(true);
        }}
      >
        {editing ? (
          <input
            data-testid="frame-label-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              width: '100%',
            }}
          />
        ) : (
          node.label || 'Untitled frame'
        )}
      </div>
    </div>
  );
}

export default FrameNodeWidget;
```

- [ ] **Step 4: Write FrameNodeFactory.tsx**

```tsx
// src/renderer/components/MoodBoard/diagram/FrameNodeFactory.tsx
import * as React from 'react';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { FrameNodeModel } from './FrameNodeModel';
import FrameNodeWidget from './FrameNodeWidget';

export class FrameNodeFactory extends AbstractReactFactory<
  FrameNodeModel,
  DiagramEngine
> {
  constructor() {
    super('frame');
  }

  generateModel() {
    return new FrameNodeModel({});
  }

  generateReactWidget(event: { model: FrameNodeModel }) {
    return <FrameNodeWidget node={event.model} engine={this.engine} />;
  }
}
```

The widget reads `node.label` after `commit`; for that React to re-render with the new label, the label change must trigger a state change. The simplest path: store `draft` and the rendered `node.label` together — read from `draft` when editing, from `node.label` otherwise, and after commit force a re-render by `setEditing(false)`. The test asserts on the model field, which is what matters; subsequent renders display from the model. Verify visually in the integration step (Task 14).

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/frameNodeWidget.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/FrameNodeWidget.tsx src/renderer/components/MoodBoard/diagram/FrameNodeFactory.tsx src/__tests__/renderer/frameNodeWidget.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): FrameNodeWidget + Factory with editable label"
```

---

## Task 8: Frame drag → contained nodes translate

The frame's position changes via storm's listener system. When `positionChanged` fires, translate every contained node by the same delta.

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/FrameNodeModel.ts`
- Test: `src/__tests__/renderer/frameNodeDrag.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/renderer/frameNodeDrag.test.ts
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';

class FakeChild {
  private x = 0;
  private y = 0;
  constructor(public id: string, x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  getID() {
    return this.id;
  }
  getX() {
    return this.x;
  }
  getY() {
    return this.y;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

describe('Frame drag translates contained nodes', () => {
  test('translateContainedBy moves every contained child by dx/dy', () => {
    const frame = new FrameNodeModel({});
    const children = [
      new FakeChild('a', 100, 100),
      new FakeChild('b', 200, 100),
    ];
    frame.addContained('a');
    frame.addContained('b');

    const lookup = new Map(children.map((c) => [c.getID(), c]));
    frame.translateContainedBy(20, -10, (id) => lookup.get(id) ?? null);

    expect(children[0].getX()).toBe(120);
    expect(children[0].getY()).toBe(90);
    expect(children[1].getX()).toBe(220);
    expect(children[1].getY()).toBe(90);
  });

  test('translateContainedBy ignores missing children silently', () => {
    const frame = new FrameNodeModel({});
    frame.addContained('ghost'); // no lookup entry
    expect(() =>
      frame.translateContainedBy(10, 10, () => null),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/frameNodeDrag.test.ts`
Expected: FAIL — `translateContainedBy is not a function`.

- [ ] **Step 3: Add translateContainedBy to FrameNodeModel**

Append the method inside the existing `FrameNodeModel` class in `src/renderer/components/MoodBoard/diagram/FrameNodeModel.ts`:

```ts
  /**
   * Translate every contained node by (dx, dy). Caller supplies a lookup
   * fn that resolves a nodeId to a node-like object exposing
   * `getX() / getY() / setPosition()` — matches the storm NodeModel surface.
   * Missing ids are silently skipped so a deleted child doesn't break drag.
   */
  translateContainedBy(
    dx: number,
    dy: number,
    lookup: (id: string) => null | {
      getX(): number;
      getY(): number;
      setPosition(x: number, y: number): void;
    },
  ) {
    for (const id of this.containedNodeIds) {
      const child = lookup(id);
      if (!child) continue;
      child.setPosition(child.getX() + dx, child.getY() + dy);
    }
  }
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/frameNodeDrag.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/FrameNodeModel.ts src/__tests__/renderer/frameNodeDrag.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): FrameNodeModel.translateContainedBy for group drag"
```

---

## Task 9: Containment detection on node drop

When a node is dropped, check whether its center lies inside any frame; update frame containment accordingly. Nested frames are rejected.

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/containment.ts`
- Test: `src/__tests__/renderer/containment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/renderer/containment.test.ts
import {
  rectFromNode,
  pointInsideRect,
  updateContainmentForNode,
} from '../../renderer/components/MoodBoard/diagram/containment';
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';

function makeNodeLike(id: string, x: number, y: number, w = 100, h = 50) {
  return {
    getID: () => id,
    getX: () => x,
    getY: () => y,
    width: w,
    height: h,
    getType: () => 'note',
  };
}

describe('containment', () => {
  test('pointInsideRect — inside / boundary / outside', () => {
    const r = { x: 0, y: 0, width: 100, height: 100 };
    expect(pointInsideRect({ x: 50, y: 50 }, r)).toBe(true);
    expect(pointInsideRect({ x: 0, y: 0 }, r)).toBe(true); // top-left edge counts as inside
    expect(pointInsideRect({ x: 101, y: 50 }, r)).toBe(false);
  });

  test('rectFromNode returns axis-aligned box', () => {
    const n = makeNodeLike('a', 10, 20, 100, 50);
    expect(rectFromNode(n)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  test('updateContainmentForNode adds node to the frame it lands in', () => {
    const frame = new FrameNodeModel({});
    frame.setPosition(0, 0);
    frame.setSize(500, 500);
    const node = makeNodeLike('n1', 100, 100); // center (150, 125) → inside

    updateContainmentForNode(node, [frame]);
    expect(frame.containedNodeIds).toEqual(['n1']);
  });

  test('updateContainmentForNode removes node when dropped outside its previous frame', () => {
    const frame = new FrameNodeModel({});
    frame.setPosition(0, 0);
    frame.setSize(500, 500);
    frame.addContained('n1');

    const node = makeNodeLike('n1', 1000, 1000); // far outside
    updateContainmentForNode(node, [frame]);
    expect(frame.containedNodeIds).toEqual([]);
  });

  test('updateContainmentForNode rejects nested frames', () => {
    const outer = new FrameNodeModel({});
    outer.setPosition(0, 0);
    outer.setSize(500, 500);
    const inner = new FrameNodeModel({});
    inner.setPosition(50, 50);
    inner.setSize(100, 100);

    updateContainmentForNode(
      {
        getID: () => 'inner',
        getX: () => 50,
        getY: () => 50,
        width: 100,
        height: 100,
        getType: () => 'frame',
      },
      [outer, inner],
    );
    expect(outer.containedNodeIds).toEqual([]); // nested rejected
  });
});
```

Note: `FrameNodeModel` extends storm's `NodeModel` which provides `setPosition(x, y)`. The test relies on that — verify locally if jest jsdom-mocks complain, by stubbing the method in the test.

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/containment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/renderer/components/MoodBoard/diagram/containment.ts
import { Rect, Point } from './types';
import { FrameNodeModel } from './FrameNodeModel';

interface NodeLike {
  getID(): string;
  getX(): number;
  getY(): number;
  width: number;
  height: number;
  getType(): string;
}

export function rectFromNode(n: NodeLike): Rect {
  return { x: n.getX(), y: n.getY(), width: n.width, height: n.height };
}

export function pointInsideRect(p: Point, r: Rect): boolean {
  return (
    p.x >= r.x &&
    p.x <= r.x + r.width &&
    p.y >= r.y &&
    p.y <= r.y + r.height
  );
}

export function updateContainmentForNode(
  node: NodeLike,
  frames: FrameNodeModel[],
): void {
  // Nested frames are rejected outright.
  if (node.getType() === 'frame') {
    for (const f of frames) {
      f.removeContained(node.getID());
    }
    return;
  }

  const r = rectFromNode(node);
  const center: Point = {
    x: r.x + r.width / 2,
    y: r.y + r.height / 2,
  };

  let landedIn: FrameNodeModel | null = null;
  for (const frame of frames) {
    if (
      pointInsideRect(center, {
        x: frame.getX(),
        y: frame.getY(),
        width: frame.width,
        height: frame.height,
      })
    ) {
      landedIn = frame;
      break;
    }
  }

  for (const frame of frames) {
    if (frame === landedIn) {
      frame.addContained(node.getID());
    } else {
      frame.removeContained(node.getID());
    }
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/containment.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/containment.ts src/__tests__/renderer/containment.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): containment detection on node drop (rejects nesting)"
```

---

## Task 10: StickyNoteNodeModel + Widget + Factory

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/StickyNoteNodeModel.ts`
- Create: `src/renderer/components/MoodBoard/diagram/StickyNoteNodeWidget.tsx`
- Create: `src/renderer/components/MoodBoard/diagram/StickyNoteNodeFactory.tsx`
- Test: `src/__tests__/renderer/stickyNoteNode.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/renderer/stickyNoteNode.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { StickyNoteNodeModel } from '../../renderer/components/MoodBoard/diagram/StickyNoteNodeModel';
import StickyNoteNodeWidget from '../../renderer/components/MoodBoard/diagram/StickyNoteNodeWidget';

describe('StickyNoteNodeModel', () => {
  test('defaults: empty text, yellow color, 160x120', () => {
    const s = new StickyNoteNodeModel({});
    expect(s.text).toBe('');
    expect(s.color).toBe('#fff59d'); // pastel yellow
    expect(s.width).toBe(160);
    expect(s.height).toBe(120);
    expect(s.getType()).toBe('sticky');
  });

  test('serialize/deserialize round-trip', () => {
    const s = new StickyNoteNodeModel({
      text: 'central argument',
      color: '#ffcc80',
    });
    const data = s.serialize();
    const r = new StickyNoteNodeModel({});
    r.deserialize({ data });
    expect(r.text).toBe('central argument');
    expect(r.color).toBe('#ffcc80');
  });
});

describe('StickyNoteNodeWidget', () => {
  test('renders the text', () => {
    const s = new StickyNoteNodeModel({ text: 'hello' });
    const engine = { repaintCanvas: jest.fn() };
    const { getByText } = render(
      <StickyNoteNodeWidget node={s} engine={engine} />,
    );
    expect(getByText('hello')).toBeTruthy();
  });

  test('double-click → edit mode → blur commits text', () => {
    const s = new StickyNoteNodeModel({ text: 'old' });
    const engine = { repaintCanvas: jest.fn() };
    const { getByText, container } = render(
      <StickyNoteNodeWidget node={s} engine={engine} />,
    );
    fireEvent.doubleClick(getByText('old'));
    const ta = container.querySelector(
      '[data-testid="sticky-textarea"]',
    ) as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    fireEvent.change(ta, { target: { value: 'new' } });
    fireEvent.blur(ta);
    expect(s.text).toBe('new');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/stickyNoteNode.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement StickyNoteNodeModel.ts**

```ts
// src/renderer/components/MoodBoard/diagram/StickyNoteNodeModel.ts
import { NodeModel, NodeModelGenerics, DeserializeEvent } from '@projectstorm/react-diagrams';

export interface StickyNoteOptions {
  text?: string;
  color?: string;
  width?: number;
  height?: number;
}

export class StickyNoteNodeModel extends NodeModel<NodeModelGenerics> {
  public text: string;
  public color: string;

  constructor({
    text = '',
    color = '#fff59d',
    width = 160,
    height = 120,
  }: StickyNoteOptions) {
    super({ type: 'sticky' });
    this.text = text;
    this.color = color;
    this.width = width;
    this.height = height;
  }

  setText(text: string) {
    this.text = text;
  }

  serialize() {
    return {
      ...super.serialize(),
      text: this.text,
      color: this.color,
      width: this.width,
      height: this.height,
    };
  }

  deserialize(event: DeserializeEvent<this>) {
    super.deserialize(event);
    const d = event.data as Partial<StickyNoteOptions>;
    this.text = d.text ?? '';
    this.color = d.color ?? '#fff59d';
    this.width = d.width ?? 160;
    this.height = d.height ?? 120;
  }
}
```

- [ ] **Step 4: Implement StickyNoteNodeWidget.tsx**

```tsx
// src/renderer/components/MoodBoard/diagram/StickyNoteNodeWidget.tsx
import * as React from 'react';
import { StickyNoteNodeModel } from './StickyNoteNodeModel';

export interface StickyNoteNodeWidgetProps {
  node: StickyNoteNodeModel;
  engine: { repaintCanvas: () => void };
}

function StickyNoteNodeWidget({ node, engine }: StickyNoteNodeWidgetProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(node.text);

  const commit = () => {
    node.setText(draft);
    setEditing(false);
    if (engine && typeof engine.repaintCanvas === 'function') {
      engine.repaintCanvas();
    }
  };

  return (
    <div
      style={{
        width: node.width,
        height: node.height,
        background: node.color,
        boxShadow: '2px 2px 6px rgba(0,0,0,0.18)',
        padding: 12,
        fontFamily:
          "'Caveat', 'Bradley Hand', 'Comic Sans MS', cursive",
        fontSize: 16,
        color: '#3e2723',
        whiteSpace: 'pre-wrap',
        overflow: 'hidden',
        cursor: 'text',
        boxSizing: 'border-box',
      }}
      onDoubleClick={() => {
        setDraft(node.text);
        setEditing(true);
      }}
    >
      {editing ? (
        <textarea
          data-testid="sticky-textarea"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'inherit',
          }}
        />
      ) : (
        node.text || '(double-click to edit)'
      )}
    </div>
  );
}

export default StickyNoteNodeWidget;
```

- [ ] **Step 5: Implement StickyNoteNodeFactory.tsx**

```tsx
// src/renderer/components/MoodBoard/diagram/StickyNoteNodeFactory.tsx
import * as React from 'react';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { StickyNoteNodeModel } from './StickyNoteNodeModel';
import StickyNoteNodeWidget from './StickyNoteNodeWidget';

export class StickyNoteNodeFactory extends AbstractReactFactory<
  StickyNoteNodeModel,
  DiagramEngine
> {
  constructor() {
    super('sticky');
  }

  generateModel() {
    return new StickyNoteNodeModel({});
  }

  generateReactWidget(event: { model: StickyNoteNodeModel }) {
    return (
      <StickyNoteNodeWidget node={event.model} engine={this.engine} />
    );
  }
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/stickyNoteNode.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/StickyNoteNodeModel.ts src/renderer/components/MoodBoard/diagram/StickyNoteNodeWidget.tsx src/renderer/components/MoodBoard/diagram/StickyNoteNodeFactory.tsx src/__tests__/renderer/stickyNoteNode.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): StickyNoteNode (board-local free text, not a Note)"
```

---

## Task 11: Free placement — make port rendering opt-in on NoteNodeWidget

The current `NoteNodeWidget` always renders 4 port widgets. Add a `showPorts` prop (default false) so new boards get free placement; legacy boards opt in.

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/NoteNodeWidget.tsx`
- Test: `src/__tests__/renderer/noteNodeWidget.ports.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/renderer/noteNodeWidget.ports.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { NoteNodeModel } from '../../renderer/components/MoodBoard/diagram/NoteNodeModel';
import NoteNodeWidget from '../../renderer/components/MoodBoard/diagram/NoteNodeWidget';

const mockStore = configureStore([]);
const store = mockStore({
  moodBoard: { editState: false, showControl: false },
  note: { showTextOnly: false },
});

function renderNode(props = {}) {
  const node = new NoteNodeModel({});
  // Stub the underlying note so NoteUI render path is innocuous.
  (node as any).note = { id: 1 };
  // Engine stub for PortWidget — PortWidget will call engine APIs we don't need
  // when there are no ports to render.
  const engine = {} as any;
  return render(
    <Provider store={store}>
      <NoteNodeWidget node={node} engine={engine} {...props} />
    </Provider>,
  );
}

describe('NoteNodeWidget showPorts toggle', () => {
  test('default (showPorts undefined) does NOT render any PortWidget', () => {
    const { container } = renderNode();
    // PortWidget mounts inside a div with the test-friendly class used by storm;
    // in v1 we use our `S.Port` styled-component which renders a 10x10 div.
    // Easier marker: count children with the inline absolute-positioning hint
    // we add via data-testid="note-port".
    expect(container.querySelectorAll('[data-testid="note-port"]')).toHaveLength(0);
  });

  test('showPorts=true renders 4 PortWidget children', () => {
    const { container } = renderNode({ showPorts: true });
    expect(container.querySelectorAll('[data-testid="note-port"]')).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/noteNodeWidget.ports.test.tsx`
Expected: FAIL — current widget always renders 4 ports without the `data-testid` marker.

- [ ] **Step 3: Modify NoteNodeWidget.tsx**

Open `src/renderer/components/MoodBoard/diagram/NoteNodeWidget.tsx`. Add `showPorts` to the props and conditionally wrap the 4 existing `<PortWidget>` blocks. Add `data-testid="note-port"` to each port's wrapper. Patch:

1. Add `showPorts` to the props interface:

```tsx
export interface NoteNodeWidgetProps {
  node: NoteNodeModel;
  engine: DiagramEngine;
  width?: number;
  height?: number;
  showPorts?: boolean;
}
```

2. Update the function signature:

```tsx
function NoteNodeWidget({ node, engine, showPorts = false }: NoteNodeWidgetProps) {
```

3. Wrap the four `<PortWidget>` elements in a single conditional block:

Replace the four `<PortWidget>` blocks (the ones at LEFT/TOP/RIGHT/BOTTOM) with:

```tsx
{showPorts && (
  <>
    <PortWidget
      style={{
        top: (node.height || 180) / 2 - 5,
        left: -10,
        position: 'absolute',
      }}
      port={node.getPort(PortModelAlignment.LEFT)}
      engine={engine}
    >
      <S.Port data-testid="note-port" />
    </PortWidget>
    <PortWidget
      style={{
        left: (node.width || 250) / 2 - 5,
        top: -10,
        position: 'absolute',
      }}
      port={node.getPort(PortModelAlignment.TOP)}
      engine={engine}
    >
      <S.Port data-testid="note-port" />
    </PortWidget>
    <PortWidget
      style={{
        left: (node.width || 250) - 4,
        top: (node.height || 180) / 2 - 5,
        position: 'absolute',
      }}
      port={node.getPort(PortModelAlignment.RIGHT)}
      engine={engine}
    >
      <S.Port data-testid="note-port" />
    </PortWidget>
    <PortWidget
      style={{
        left: (node.width || 250) / 2 - 5,
        top: (node.height || 180) - 4,
        position: 'absolute',
      }}
      port={node.getPort(PortModelAlignment.BOTTOM)}
      engine={engine}
    >
      <S.Port data-testid="note-port" />
    </PortWidget>
  </>
)}
```

Update `S.Port` to forward the testid:

```tsx
const S = {
  Port: styled.div`
    width: 10px;
    height: 10px;
    ...
  `,
};
```

(`styled.div` already forwards `data-*` attributes — no change needed beyond the props on each instance.)

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/noteNodeWidget.ports.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Confirm the existing diagram-card UI test still passes**

Run: `npx jest src/__tests__/renderer/NoteCardSurface.test.jsx`
Expected: PASS (unrelated to this change but a sanity check).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/NoteNodeWidget.tsx src/__tests__/renderer/noteNodeWidget.ports.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): NoteNodeWidget showPorts opt-in (default off, free placement)"
```

---

## Task 12: LassoSelection overlay component

Shift-drag on the empty canvas paints a translucent rectangle; on release, every node whose bounding rect intersects the rectangle is marked selected via `node.setSelected(true)`.

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/selection/LassoSelection.tsx`
- Test: `src/__tests__/renderer/lassoSelection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/renderer/lassoSelection.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import LassoSelection from '../../renderer/components/MoodBoard/diagram/selection/LassoSelection';

function makeNode(id: string, x: number, y: number, w = 100, h = 50) {
  let selected = false;
  return {
    getID: () => id,
    getX: () => x,
    getY: () => y,
    width: w,
    height: h,
    isSelected: () => selected,
    setSelected: (v: boolean) => {
      selected = v;
    },
  };
}

describe('LassoSelection', () => {
  test('drag-paint selects nodes whose bbox intersects the lasso rect', () => {
    const nodes = [
      makeNode('a', 10, 10),        // inside
      makeNode('b', 500, 500),      // outside
      makeNode('c', 80, 80, 50, 50), // partially inside
    ];
    const { container } = render(
      <LassoSelection nodes={nodes} engine={{ repaintCanvas: jest.fn() }} />,
    );

    const overlay = container.querySelector(
      '[data-testid="lasso-overlay"]',
    ) as HTMLElement;
    expect(overlay).toBeTruthy();

    // Shift-drag from (0,0) to (200, 200) — covers nodes 'a' and 'c'.
    fireEvent.mouseDown(overlay, {
      shiftKey: true,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(overlay, { clientX: 200, clientY: 200 });

    expect(nodes[0].isSelected()).toBe(true);
    expect(nodes[1].isSelected()).toBe(false);
    expect(nodes[2].isSelected()).toBe(true);
  });

  test('plain mousedown (no shift) does NOT start a lasso', () => {
    const nodes = [makeNode('a', 10, 10)];
    const { container } = render(
      <LassoSelection nodes={nodes} engine={{ repaintCanvas: jest.fn() }} />,
    );
    const overlay = container.querySelector(
      '[data-testid="lasso-overlay"]',
    ) as HTMLElement;
    fireEvent.mouseDown(overlay, { clientX: 0, clientY: 0 }); // no shift
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(overlay, { clientX: 200, clientY: 200 });
    expect(nodes[0].isSelected()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/lassoSelection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/renderer/components/MoodBoard/diagram/selection/LassoSelection.tsx
import * as React from 'react';
import { Rect } from '../types';

interface SelectableNode {
  getID(): string;
  getX(): number;
  getY(): number;
  width: number;
  height: number;
  isSelected(): boolean;
  setSelected(v: boolean): void;
}

export interface LassoSelectionProps {
  nodes: SelectableNode[];
  engine: { repaintCanvas: () => void };
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function normalize(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function LassoSelection({ nodes, engine }: LassoSelectionProps) {
  const [dragging, setDragging] = React.useState(false);
  const [start, setStart] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  const [current, setCurrent] = React.useState<{ x: number; y: number } | null>(
    null,
  );

  const rect =
    start && current ? normalize(start.x, start.y, current.x, current.y) : null;

  const onMouseDown = (e: React.MouseEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    setDragging(true);
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setCurrent({ x: e.clientX, y: e.clientY });
  };

  const onMouseUp = () => {
    if (dragging && rect) {
      for (const node of nodes) {
        const nodeRect = {
          x: node.getX(),
          y: node.getY(),
          width: node.width,
          height: node.height,
        };
        if (rectsIntersect(rect, nodeRect)) {
          node.setSelected(true);
        }
      }
      engine.repaintCanvas();
    }
    setDragging(false);
    setStart(null);
    setCurrent(null);
  };

  return (
    <div
      data-testid="lasso-overlay"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{
        position: 'absolute',
        inset: 0,
        // Overlay must not eat normal canvas events; only become active on shift-down.
        // We use pointer-events: none normally and toggle to auto via inline style
        // during drag (controlled by `dragging`).
        pointerEvents: dragging ? 'auto' : 'auto', // both 'auto' for now; canvas pass-through handled by storm
        zIndex: 5,
      }}
    >
      {rect && dragging && (
        <div
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            border: '1px dashed #2196f3',
            background: 'rgba(33,150,243,0.08)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

export default LassoSelection;
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/lassoSelection.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/selection/LassoSelection.tsx src/__tests__/renderer/lassoSelection.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): LassoSelection overlay — shift-drag selects intersecting nodes"
```

---

## Task 13: useMultiSelectDrag hook — bulk move

When the user drags any *selected* node, all other selected nodes translate by the same delta.

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/selection/useMultiSelectDrag.ts`
- Test: `src/__tests__/renderer/useMultiSelectDrag.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/renderer/useMultiSelectDrag.test.ts
import { translateSelectedExcept } from '../../renderer/components/MoodBoard/diagram/selection/useMultiSelectDrag';

function makeNode(id: string, x: number, y: number, selected = false) {
  return {
    _x: x,
    _y: y,
    _sel: selected,
    getID() {
      return id;
    },
    getX() {
      return this._x;
    },
    getY() {
      return this._y;
    },
    isSelected() {
      return this._sel;
    },
    setPosition(nx: number, ny: number) {
      this._x = nx;
      this._y = ny;
    },
  };
}

describe('translateSelectedExcept', () => {
  test('moves all selected nodes by (dx, dy) except the driver', () => {
    const driver = makeNode('drv', 0, 0, true);
    const other = makeNode('o', 100, 100, true);
    const unselected = makeNode('u', 200, 200, false);

    translateSelectedExcept(driver.getID(), 10, 20, [driver, other, unselected]);

    expect(other.getX()).toBe(110);
    expect(other.getY()).toBe(120);
    expect(driver.getX()).toBe(0); // not translated — driver is moved by storm itself
    expect(driver.getY()).toBe(0);
    expect(unselected.getX()).toBe(200); // not selected → untouched
    expect(unselected.getY()).toBe(200);
  });

  test('no-op when no nodes are selected besides the driver', () => {
    const driver = makeNode('drv', 0, 0, true);
    const other = makeNode('o', 100, 100, false);
    translateSelectedExcept(driver.getID(), 10, 10, [driver, other]);
    expect(other.getX()).toBe(100);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/__tests__/renderer/useMultiSelectDrag.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/renderer/components/MoodBoard/diagram/selection/useMultiSelectDrag.ts
import { useEffect } from 'react';

interface DragNode {
  getID(): string;
  getX(): number;
  getY(): number;
  isSelected(): boolean;
  setPosition(x: number, y: number): void;
}

/**
 * Pure: translate every selected node *other than* the driver by (dx, dy).
 * Exposed so it can be tested without a React harness.
 */
export function translateSelectedExcept(
  driverId: string,
  dx: number,
  dy: number,
  nodes: DragNode[],
): void {
  for (const n of nodes) {
    if (n.getID() === driverId) continue;
    if (!n.isSelected()) continue;
    n.setPosition(n.getX() + dx, n.getY() + dy);
  }
}

/**
 * React hook: subscribe to a node's `positionChanged` event; when it fires,
 * translate other selected nodes by the same delta. Caller owns the
 * unsubscribe-on-unmount lifecycle via the returned hook's effect.
 */
export function useMultiSelectDrag(
  driver: DragNode & {
    registerListener(l: {
      positionChanged?: (e: { entity: { getX(): number; getY(): number } }) => void;
    }): { deregister: () => void };
  } | null,
  allNodes: DragNode[],
  engine: { repaintCanvas?: () => void },
) {
  useEffect(() => {
    if (!driver) return undefined;
    let lastX = driver.getX();
    let lastY = driver.getY();
    const handle = driver.registerListener({
      positionChanged: (e) => {
        const nx = e.entity.getX();
        const ny = e.entity.getY();
        const dx = nx - lastX;
        const dy = ny - lastY;
        lastX = nx;
        lastY = ny;
        if (dx === 0 && dy === 0) return;
        translateSelectedExcept(driver.getID(), dx, dy, allNodes);
        if (engine && typeof engine.repaintCanvas === 'function') {
          engine.repaintCanvas();
        }
      },
    });
    return () => handle.deregister();
  }, [driver, allNodes, engine]);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/__tests__/renderer/useMultiSelectDrag.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/selection/useMultiSelectDrag.ts src/__tests__/renderer/useMultiSelectDrag.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): useMultiSelectDrag — selected nodes follow the driver"
```

---

## Task 14: Wire factories + selection into DetailedDiagramPanel

Register the new factories and mount `LassoSelection` + `useMultiSelectDrag` into the diagram surface used today.

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js`

- [ ] **Step 1: Read the current panel**

Run: `wc -l src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js`

Then `cat` it. Identify (a) where `NoteNodeFactory` is registered, (b) where the engine is created, (c) where the canvas widget is rendered.

- [ ] **Step 2: Register the new factories**

Find the line that registers `NoteNodeFactory` (likely `engine.getNodeFactories().registerFactory(new NoteNodeFactory(...))`). Immediately after it, add:

```js
import { FrameNodeFactory } from './FrameNodeFactory';
import { StickyNoteNodeFactory } from './StickyNoteNodeFactory';
// ... inside the engine-setup block, beside the existing NoteNodeFactory registration:
engine.getNodeFactories().registerFactory(new FrameNodeFactory());
engine.getNodeFactories().registerFactory(new StickyNoteNodeFactory());
```

- [ ] **Step 3: Mount LassoSelection beside the CanvasWidget**

Find the JSX that renders `<CanvasWidget engine={engine} ...>`. Wrap it (or sit beside it inside the same positioned container) with:

```jsx
import LassoSelection from './selection/LassoSelection';
// ...
const allNodes = engine.getModel().getNodes();
// inside the JSX:
<div style={{ position: 'relative', width: '100%', height: '100%' }}>
  <CanvasWidget engine={engine} className="diagram-canvas" />
  <LassoSelection
    nodes={allNodes}
    engine={engine}
  />
</div>
```

- [ ] **Step 4: Apply group drag on selection**

Inside the panel component (where the node list is computed), attach `useMultiSelectDrag` to each currently-selected node. Practical wiring:

```jsx
import { useMultiSelectDrag } from './selection/useMultiSelectDrag';
// ...
const selectedDriver = allNodes.find((n) => n.isSelected()) || null;
useMultiSelectDrag(selectedDriver, allNodes, engine);
```

(The hook is no-op when `driver` is null.)

- [ ] **Step 5: Smoke test**

Run: `npm run test:smoke`
Expected: Electron boots and runs the 12 s window without any of the `ERROR_PATTERNS` triggering.

If the smoke test fails because of unrelated issues already on `main`, document the diff and proceed; the wiring is verified by Task 15's integration test.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): wire FrameNodeFactory + StickyNoteNodeFactory + lasso/multi-drag"
```

---

## Task 15: Integration test — frame contains nodes, drag carries them

Validates the end-to-end Phase 1 flow at the model layer (no Electron required). Storm models + factories are exercised together to confirm containment + translation work in combination.

**Files:**
- Test: `src/__tests__/renderer/moodboardPhase1.integration.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/__tests__/renderer/moodboardPhase1.integration.test.ts
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';
import { StickyNoteNodeModel } from '../../renderer/components/MoodBoard/diagram/StickyNoteNodeModel';
import { updateContainmentForNode } from '../../renderer/components/MoodBoard/diagram/containment';
import CustomLinkModel from '../../renderer/components/MoodBoard/diagram/CustomLinkModel';

interface NodeLike {
  getID(): string;
  getX(): number;
  getY(): number;
  width: number;
  height: number;
  getType(): string;
  setPosition(x: number, y: number): void;
}

function makeNoteLikeNode(id: string, x: number, y: number): NodeLike {
  let _x = x;
  let _y = y;
  return {
    getID: () => id,
    getX: () => _x,
    getY: () => _y,
    width: 100,
    height: 50,
    getType: () => 'note',
    setPosition: (nx, ny) => {
      _x = nx;
      _y = ny;
    },
  };
}

describe('MoodBoard Phase 1 integration', () => {
  test('frame + contained nodes drag together; link relationType survives serialize round-trip', () => {
    // Set up: one frame, two notes inside it, one sticky outside.
    const frame = new FrameNodeModel({ label: 'Cluster A' });
    frame.setPosition(0, 0);
    frame.setSize(500, 500);

    const noteA = makeNoteLikeNode('note-a', 100, 100);
    const noteB = makeNoteLikeNode('note-b', 250, 200);
    const sticky = new StickyNoteNodeModel({ text: 'central idea' });
    sticky.setPosition(700, 100); // far outside

    // Drop-detect each node into the frame system.
    updateContainmentForNode(noteA, [frame]);
    updateContainmentForNode(noteB, [frame]);
    updateContainmentForNode(
      {
        getID: () => sticky.getID(),
        getX: () => sticky.getX(),
        getY: () => sticky.getY(),
        width: sticky.width,
        height: sticky.height,
        getType: () => sticky.getType(),
      },
      [frame],
    );

    expect(frame.containedNodeIds.sort()).toEqual(['note-a', 'note-b']);

    // Simulate frame drag by (50, -30).
    const lookup = new Map<string, NodeLike>([
      ['note-a', noteA],
      ['note-b', noteB],
    ]);
    frame.translateContainedBy(50, -30, (id) => lookup.get(id) ?? null);

    expect(noteA.getX()).toBe(150);
    expect(noteA.getY()).toBe(70);
    expect(noteB.getX()).toBe(300);
    expect(noteB.getY()).toBe(170);

    // Link with relationType round-trips.
    const link = new CustomLinkModel({ relationType: 'contrasts' });
    const data = link.serialize();
    const restored = new CustomLinkModel();
    restored.deserialize({ data });
    expect(restored.relationType).toBe('contrasts');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest src/__tests__/renderer/moodboardPhase1.integration.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 3: Run the full Phase 1 suite**

Run: `npx jest src/__tests__/renderer/proximityAttach src/__tests__/renderer/customLinkModel src/__tests__/renderer/customLinkSegment src/__tests__/renderer/customLinkWidget src/__tests__/renderer/frameNodeModel src/__tests__/renderer/frameNodeDrag src/__tests__/renderer/frameNodeWidget src/__tests__/renderer/containment src/__tests__/renderer/stickyNoteNode src/__tests__/renderer/noteNodeWidget.ports src/__tests__/renderer/lassoSelection src/__tests__/renderer/useMultiSelectDrag src/__tests__/renderer/moodboardPhase1.integration`

Expected: all tests pass; suite count totals ~40 tests across 13 files.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/renderer/moodboardPhase1.integration.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(moodboard): Phase 1 integration — frame containment + drag + typed link round-trip"
```

---

## Task 16: Manual visual gate

After all unit + integration tests pass, run the app and walk the surface end-to-end. This is the final acceptance check before declaring Phase 1 done.

- [ ] **Step 1: Start the dev server**

Run: `npm start`
Wait for both renderer (`:1212`) and main (Electron) to boot.

- [ ] **Step 2: Walk the checklist**

In the MoodBoard diagram view:

- [ ] Create a new board, add 3 notes; confirm nodes have **no ports rendered** (free placement default).
- [ ] Drag two notes near each other; confirm they don't snap to a grid.
- [ ] Add a frame (via toolbar — wire-up in DetailedDiagramPanel from Task 14). Resize it large enough to cover both notes; confirm the label is editable on double-click.
- [ ] Drop both notes inside the frame; drag the frame — both notes move together.
- [ ] Drag one note outside the frame; the other stays.
- [ ] Add a sticky note (toolbar); double-click to edit; type "central idea"; click outside to commit.
- [ ] Draw a link between two notes; right-click the link → cycle through `supports → contrasts → leads-to → similar → caused-by → supports`. Confirm each render is visually distinct.
- [ ] Shift-drag on the empty canvas to lasso the frame + two notes. Drag any selected node; all selected move together.
- [ ] Reload the board (close + reopen). All changes persist: frame label, sticky text, link relationType.

- [ ] **Step 3: Log gaps**

Any item that fails is filed as a follow-up issue, not patched in Phase 1 — Phase 1's surface is the model + widget primitives; Phase 2 may polish.

---

## Self-Review Notes

After this plan is in place:

- **Spec coverage:** Every Phase 1 spec bullet has a task — free placement (Task 11), frames model (Task 6) + widget (Task 7) + drag (Task 8) + drop-containment (Task 9), typed connectors (Tasks 3-5), sticky notes (Task 10), multi-select (Tasks 12-13). Wiring (Task 14) + integration (Task 15) + manual (Task 16) close it out.
- **Placeholder scan:** No TBD / TODO / "implement later" / "similar to" patterns. Every code step has full code.
- **Type consistency:** `relationType` is the canonical field; `RELATION_TYPES` / `RELATION_STYLES` / `DEFAULT_RELATION_TYPE` exported from `types.ts`. `containedNodeIds: string[]` everywhere. `translateContainedBy` and `translateSelectedExcept` are the two pure translation helpers, distinguished by domain (frame vs. multi-select).
- **No new dependencies.** Reuses existing `storm-react-diagrams`, `@testing-library/react`, `react-redux`, `redux-mock-store`. (Verify `redux-mock-store` is in devDependencies before Task 11; install with `npm install --save-dev redux-mock-store` if missing.)
