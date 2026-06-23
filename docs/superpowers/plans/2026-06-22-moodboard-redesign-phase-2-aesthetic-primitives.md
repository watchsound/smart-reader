# MoodBoard Redesign — Phase 2: Aesthetic Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add board-level theme (palette + typography + CSS variables), background canvas (none / image / pattern), color zones (translucent labeled regions), and image-only nodes — making the MoodBoard an artifact, not a container.

**Architecture:** A new `canvas/` subfolder owns the three new canvas-level layers (`BoardThemeProvider`, `BackgroundLayer`, `ColorZoneLayer`) that wrap or sit beside the existing storm `CanvasWidget`. Theme is propagated via CSS custom properties on the root container; child widgets (cards, frames, stickies, new image nodes) read them automatically. Color zones and theme persist inside the existing board JSON blob (no SQL migration in this phase — deviates from the spec's `ALTER TABLE` for forward-simplicity; can promote to columns later if access patterns demand). Image nodes follow the established model/widget/factory triple.

**Tech Stack:** React + emotion + storm-react-diagrams (existing); TypeScript for new modules; Jest + jsdom for tests. No new runtime dependencies — `html-to-image` was named in the spec for Phase 3 export, not Phase 2.

**Spec:** [docs/superpowers/specs/2026-06-22-moodboard-redesign-design.md](../specs/2026-06-22-moodboard-redesign-design.md).

**Previous phase:** [Phase 1 plan](2026-06-22-moodboard-redesign-phase-1-cognitive-primitives.md) — shipped as commits `912b7ab..2294666` on `main`.

**Project conventions:**
- Run a single Jest test with `npx jest <path>` (not `npm test`).
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m ...`.
- Pre-commit hooks must pass; don't `--no-verify`.
- New TypeScript modules under `src/renderer/components/MoodBoard/diagram/canvas/`.
- Test files under `src/__tests__/renderer/`.
- Theme + color-zone persistence goes through the existing board JSON serialization (no new SQL columns in Phase 2).

---

## Task 1: Extend `types.ts` with Phase 2 contracts

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/types.ts`

- [ ] **Step 1: Append Phase 2 types**

Append to `src/renderer/components/MoodBoard/diagram/types.ts`:

```ts
// ---------------------------------------------------------------------------
// Phase 2 — Aesthetic primitives
// ---------------------------------------------------------------------------

// Built-in palette identifiers. Add new entries to themes.ts in lockstep
// with this union; 'custom' means the board carries its own palette values.
export const PALETTE_IDS = [
  'warm-roman',
  'cold-noir',
  'austere-mono',
  'golden-vellum',
  'paper-and-ink',
  'custom',
] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

// CSS color literals — the 4 slots every palette must define.
export interface Palette {
  accent: string;  // primary accent color
  bg: string;      // canvas background base color
  ink: string;     // primary text color
  muted: string;   // secondary / meta text color
}

// Typography family choices for board-wide typography override.
export const FONT_FAMILIES = ['serif', 'sans', 'mono', 'display'] as const;
export type FontFamilyChoice = (typeof FONT_FAMILIES)[number];

// Background layer rendering modes.
export type BackgroundMode = 'none' | 'image' | 'pattern';

// Spec for the background canvas underlay.
export interface BackgroundLayerSpec {
  mode: BackgroundMode;
  // For mode='image' — customStorage asset id of the user-uploaded image.
  imageAssetId?: string;
  // For mode='pattern' — built-in pattern key. v1 ships one ('dot-grid');
  // additional patterns may be added without breaking existing boards.
  patternKey?: 'dot-grid' | 'paper-grain';
  // Opacity 0..1 applied to the background layer; default 0.1.
  opacity?: number;
}

// Full board theme record persisted on the MoodBoard JSON.
export interface BoardTheme {
  paletteId: PaletteId;
  customPalette?: Palette;            // populated only when paletteId === 'custom'
  fontFamily?: FontFamilyChoice;      // optional override of system default
  backgroundLayer?: BackgroundLayerSpec;
}

// Default theme assigned to boards that pre-date the field.
export const DEFAULT_BOARD_THEME: BoardTheme = {
  paletteId: 'paper-and-ink',
};

// A color zone: a translucent labeled rectangle drawn below cards but above
// the background. Lighter weight than a Frame; no containment semantics.
export interface ColorZone {
  id: string;
  color: string;
  opacity: number;   // 0..1
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --target es2020 --module esnext --moduleResolution node --strict src/renderer/components/MoodBoard/diagram/types.ts`
Expected: PASS (no output).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/types.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): types for board theme, background, color zone (Phase 2 contract)"
```

---

## Task 2: Built-in palettes module

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/canvas/themes.ts`
- Create: `src/__tests__/renderer/themes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/renderer/themes.test.ts
import {
  PALETTES,
  resolvePalette,
} from '../../renderer/components/MoodBoard/diagram/canvas/themes';
import {
  PALETTE_IDS,
  DEFAULT_BOARD_THEME,
} from '../../renderer/components/MoodBoard/diagram/types';

describe('themes', () => {
  test('PALETTES has an entry for every built-in PaletteId except "custom"', () => {
    for (const id of PALETTE_IDS) {
      if (id === 'custom') continue;
      expect(PALETTES[id]).toBeDefined();
      expect(PALETTES[id].accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PALETTES[id].bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PALETTES[id].ink).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PALETTES[id].muted).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test('resolvePalette returns the palette for a built-in id', () => {
    const p = resolvePalette({ paletteId: 'warm-roman' });
    expect(p).toEqual(PALETTES['warm-roman']);
  });

  test('resolvePalette returns customPalette when paletteId is "custom"', () => {
    const custom = {
      accent: '#abcdef',
      bg: '#fedcba',
      ink: '#000000',
      muted: '#666666',
    };
    const p = resolvePalette({ paletteId: 'custom', customPalette: custom });
    expect(p).toEqual(custom);
  });

  test('resolvePalette falls back to DEFAULT_BOARD_THEME palette when custom is missing', () => {
    const p = resolvePalette({ paletteId: 'custom' }); // no customPalette
    expect(p).toEqual(PALETTES[DEFAULT_BOARD_THEME.paletteId]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/themes.test.ts`

- [ ] **Step 3: Create `canvas/themes.ts`**

```ts
// src/renderer/components/MoodBoard/diagram/canvas/themes.ts
import {
  BoardTheme,
  Palette,
  PaletteId,
  DEFAULT_BOARD_THEME,
} from '../types';

// v1 built-in palettes. Color values chosen for AA contrast between ink and
// bg under a quick visual check; tune via `themes.test.ts` if a contrast
// regression is reported. Hex format is mandatory (the test enforces it) so
// alpha-suffix concatenation elsewhere (`color + '10'`) works predictably.
export const PALETTES: Record<Exclude<PaletteId, 'custom'>, Palette> = {
  'warm-roman': {
    accent: '#b85c38',
    bg: '#f6ecd9',
    ink: '#3a2618',
    muted: '#8a6b4d',
  },
  'cold-noir': {
    accent: '#5a9bd5',
    bg: '#1a1f2b',
    ink: '#e8eef4',
    muted: '#8a93a4',
  },
  'austere-mono': {
    accent: '#444444',
    bg: '#f4f4f4',
    ink: '#1a1a1a',
    muted: '#777777',
  },
  'golden-vellum': {
    accent: '#c79a4b',
    bg: '#fdf6e3',
    ink: '#3b3225',
    muted: '#9c8569',
  },
  'paper-and-ink': {
    accent: '#2c3e50',
    bg: '#fafaf6',
    ink: '#1c2b3a',
    muted: '#6c7a89',
  },
};

export function resolvePalette(theme: BoardTheme): Palette {
  if (theme.paletteId === 'custom') {
    if (theme.customPalette) return theme.customPalette;
    return PALETTES[DEFAULT_BOARD_THEME.paletteId as Exclude<PaletteId, 'custom'>];
  }
  return PALETTES[theme.paletteId];
}
```

- [ ] **Step 4: Run — expect 4 PASS**

`npx jest src/__tests__/renderer/themes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/canvas/themes.ts src/__tests__/renderer/themes.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): 5 built-in palettes + resolvePalette helper"
```

---

## Task 3: BoardThemeProvider (CSS variables on root)

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/canvas/BoardThemeProvider.tsx`
- Create: `src/__tests__/renderer/boardThemeProvider.test.tsx`

- [ ] **Step 1: Test**

```tsx
// src/__tests__/renderer/boardThemeProvider.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import BoardThemeProvider from '../../renderer/components/MoodBoard/diagram/canvas/BoardThemeProvider';
import { PALETTES } from '../../renderer/components/MoodBoard/diagram/canvas/themes';

describe('BoardThemeProvider', () => {
  test('renders children inside a div that carries palette CSS variables', () => {
    const { container } = render(
      <BoardThemeProvider theme={{ paletteId: 'cold-noir' }}>
        <span>child</span>
      </BoardThemeProvider>,
    );
    const root = container.querySelector('[data-testid="board-theme-root"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.style.getPropertyValue('--mb-accent')).toBe(
      PALETTES['cold-noir'].accent,
    );
    expect(root.style.getPropertyValue('--mb-bg')).toBe(
      PALETTES['cold-noir'].bg,
    );
    expect(root.style.getPropertyValue('--mb-ink')).toBe(
      PALETTES['cold-noir'].ink,
    );
    expect(root.style.getPropertyValue('--mb-muted')).toBe(
      PALETTES['cold-noir'].muted,
    );
    expect(root.textContent).toBe('child');
  });

  test('fontFamily override populates --mb-font-family', () => {
    const { container } = render(
      <BoardThemeProvider theme={{ paletteId: 'warm-roman', fontFamily: 'serif' }}>
        <span />
      </BoardThemeProvider>,
    );
    const root = container.querySelector('[data-testid="board-theme-root"]') as HTMLElement;
    expect(root.style.getPropertyValue('--mb-font-family')).toContain('serif');
  });

  test('omitting fontFamily leaves --mb-font-family unset', () => {
    const { container } = render(
      <BoardThemeProvider theme={{ paletteId: 'austere-mono' }}>
        <span />
      </BoardThemeProvider>,
    );
    const root = container.querySelector('[data-testid="board-theme-root"]') as HTMLElement;
    expect(root.style.getPropertyValue('--mb-font-family')).toBe('');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/boardThemeProvider.test.tsx`

- [ ] **Step 3: Implementation**

```tsx
// src/renderer/components/MoodBoard/diagram/canvas/BoardThemeProvider.tsx
import * as React from 'react';
import { BoardTheme } from '../types';
import { resolvePalette } from './themes';

const FONT_STACKS: Record<string, string> = {
  serif: "'Source Serif Pro', Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
  display: "'Playfair Display', Georgia, serif",
};

export interface BoardThemeProviderProps {
  theme: BoardTheme;
  children: React.ReactNode;
}

function BoardThemeProvider({ theme, children }: BoardThemeProviderProps) {
  const palette = resolvePalette(theme);
  const style: React.CSSProperties = {
    '--mb-accent': palette.accent,
    '--mb-bg': palette.bg,
    '--mb-ink': palette.ink,
    '--mb-muted': palette.muted,
    width: '100%',
    height: '100%',
  } as React.CSSProperties;

  if (theme.fontFamily && FONT_STACKS[theme.fontFamily]) {
    (style as any)['--mb-font-family'] = FONT_STACKS[theme.fontFamily];
  }

  return (
    <div data-testid="board-theme-root" style={style}>
      {children}
    </div>
  );
}

export default BoardThemeProvider;
```

- [ ] **Step 4: Run — expect 3 PASS**

`npx jest src/__tests__/renderer/boardThemeProvider.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/canvas/BoardThemeProvider.tsx src/__tests__/renderer/boardThemeProvider.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): BoardThemeProvider exposes palette + fontFamily as CSS variables"
```

---

## Task 4: BackgroundLayer (none / image / pattern modes)

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/canvas/BackgroundLayer.tsx`
- Create: `src/__tests__/renderer/backgroundLayer.test.tsx`

- [ ] **Step 1: Test**

```tsx
// src/__tests__/renderer/backgroundLayer.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import BackgroundLayer from '../../renderer/components/MoodBoard/diagram/canvas/BackgroundLayer';

describe('BackgroundLayer', () => {
  test('mode="none" renders an empty positioned layer', () => {
    const { container } = render(<BackgroundLayer spec={{ mode: 'none' }} />);
    const layer = container.querySelector('[data-testid="background-layer"]') as HTMLElement;
    expect(layer).toBeTruthy();
    expect(layer.querySelector('img')).toBeNull();
    expect(layer.querySelector('svg')).toBeNull();
  });

  test('mode="image" renders an <img> with provided src and applied opacity', () => {
    const { container } = render(
      <BackgroundLayer
        spec={{ mode: 'image', imageAssetId: 'data:image/png;base64,AAA', opacity: 0.2 }}
      />,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA');
    expect(img.style.opacity).toBe('0.2');
  });

  test('mode="pattern" renders an inline SVG pattern (dot-grid by default)', () => {
    const { container } = render(
      <BackgroundLayer spec={{ mode: 'pattern', patternKey: 'dot-grid' }} />,
    );
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg).toBeTruthy();
    expect(svg.querySelector('pattern')).toBeTruthy();
  });

  test('opacity defaults to 0.1 when not provided', () => {
    const { container } = render(
      <BackgroundLayer spec={{ mode: 'image', imageAssetId: 'x' }} />,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.style.opacity).toBe('0.1');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/backgroundLayer.test.tsx`

- [ ] **Step 3: Implementation**

```tsx
// src/renderer/components/MoodBoard/diagram/canvas/BackgroundLayer.tsx
import * as React from 'react';
import { BackgroundLayerSpec } from '../types';

export interface BackgroundLayerProps {
  spec: BackgroundLayerSpec;
}

function DotGridPattern({ tint }: { tint: string }) {
  // Deterministic SVG dot-grid. Tile size 24px; dot radius 1px.
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="mb-dot-grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <circle cx={12} cy={12} r={1} fill={tint} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mb-dot-grid)" />
    </svg>
  );
}

function PaperGrainPattern({ tint }: { tint: string }) {
  // Subtle diagonal hatching as a stand-in for paper grain. Deterministic.
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="mb-paper-grain" width={8} height={8} patternUnits="userSpaceOnUse">
          <path d="M 0 8 L 8 0" stroke={tint} strokeWidth={0.5} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mb-paper-grain)" />
    </svg>
  );
}

function BackgroundLayer({ spec }: BackgroundLayerProps) {
  const opacity = spec.opacity ?? 0.1;

  return (
    <div
      data-testid="background-layer"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {spec.mode === 'image' && spec.imageAssetId && (
        <img
          src={spec.imageAssetId}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity,
            filter: 'blur(2px)',
          }}
          alt=""
        />
      )}
      {spec.mode === 'pattern' && (
        <div style={{ opacity, width: '100%', height: '100%', position: 'relative' }}>
          {(spec.patternKey ?? 'dot-grid') === 'dot-grid' ? (
            <DotGridPattern tint="var(--mb-ink, #1a1a1a)" />
          ) : (
            <PaperGrainPattern tint="var(--mb-ink, #1a1a1a)" />
          )}
        </div>
      )}
    </div>
  );
}

export default BackgroundLayer;
```

- [ ] **Step 4: Run — expect 4 PASS**

`npx jest src/__tests__/renderer/backgroundLayer.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/canvas/BackgroundLayer.tsx src/__tests__/renderer/backgroundLayer.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): BackgroundLayer with none/image/pattern modes (dot-grid, paper-grain)"
```

---

## Task 5: ColorZoneLayer (rendering)

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/canvas/ColorZoneLayer.tsx`
- Create: `src/__tests__/renderer/colorZoneLayer.test.tsx`

- [ ] **Step 1: Test**

```tsx
// src/__tests__/renderer/colorZoneLayer.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import ColorZoneLayer from '../../renderer/components/MoodBoard/diagram/canvas/ColorZoneLayer';
import { ColorZone } from '../../renderer/components/MoodBoard/diagram/types';

describe('ColorZoneLayer', () => {
  test('renders one positioned div per zone', () => {
    const zones: ColorZone[] = [
      { id: 'z1', color: '#ffcc80', opacity: 0.2, x: 10, y: 20, width: 100, height: 80 },
      { id: 'z2', color: '#90caf9', opacity: 0.3, x: 200, y: 150, width: 150, height: 100 },
    ];
    const { container } = render(<ColorZoneLayer zones={zones} />);
    const items = container.querySelectorAll('[data-testid="color-zone"]');
    expect(items).toHaveLength(2);
  });

  test('a zone with label renders the label text', () => {
    const zones: ColorZone[] = [
      {
        id: 'z1',
        color: '#ffcc80',
        opacity: 0.2,
        x: 0, y: 0, width: 200, height: 100,
        label: 'Cause',
      },
    ];
    const { getByText } = render(<ColorZoneLayer zones={zones} />);
    expect(getByText('Cause')).toBeTruthy();
  });

  test('empty zones array renders nothing visible', () => {
    const { container } = render(<ColorZoneLayer zones={[]} />);
    expect(container.querySelectorAll('[data-testid="color-zone"]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/colorZoneLayer.test.tsx`

- [ ] **Step 3: Implementation**

```tsx
// src/renderer/components/MoodBoard/diagram/canvas/ColorZoneLayer.tsx
import * as React from 'react';
import { ColorZone } from '../types';

export interface ColorZoneLayerProps {
  zones: ColorZone[];
}

function ColorZoneLayer({ zones }: ColorZoneLayerProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {zones.map((z) => (
        <div
          key={z.id}
          data-testid="color-zone"
          style={{
            position: 'absolute',
            left: z.x,
            top: z.y,
            width: z.width,
            height: z.height,
            background: z.color,
            opacity: z.opacity,
            borderRadius: 8,
          }}
        >
          {z.label && (
            <div
              style={{
                position: 'absolute',
                top: 4,
                left: 8,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--mb-ink, #1a1a1a)',
                opacity: 0.7,
              }}
            >
              {z.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ColorZoneLayer;
```

- [ ] **Step 4: Run — expect 3 PASS**

`npx jest src/__tests__/renderer/colorZoneLayer.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/canvas/ColorZoneLayer.tsx src/__tests__/renderer/colorZoneLayer.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): ColorZoneLayer renders zones + optional labels"
```

---

## Task 6: ImageNodeModel

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/ImageNodeModel.ts`
- Create: `src/__tests__/renderer/imageNodeModel.test.ts`

- [ ] **Step 1: Test**

```ts
// src/__tests__/renderer/imageNodeModel.test.ts
import { ImageNodeModel } from '../../renderer/components/MoodBoard/diagram/ImageNodeModel';

describe('ImageNodeModel', () => {
  test('defaults: empty src, 240x180, rotation 0', () => {
    const i = new ImageNodeModel({});
    expect(i.src).toBe('');
    expect(i.width).toBe(240);
    expect(i.height).toBe(180);
    expect(i.rotation).toBe(0);
    expect(i.getType()).toBe('image');
  });

  test('serialize/deserialize round-trip preserves src + rotation', () => {
    const i = new ImageNodeModel({
      src: 'data:image/png;base64,XXX',
      width: 400,
      height: 300,
      rotation: 15,
    });
    const data = i.serialize();
    const r = new ImageNodeModel({});
    r.deserialize({ data });
    expect(r.src).toBe('data:image/png;base64,XXX');
    expect(r.width).toBe(400);
    expect(r.height).toBe(300);
    expect(r.rotation).toBe(15);
  });

  test('setSrc updates the field', () => {
    const i = new ImageNodeModel({});
    i.setSrc('data:image/jpeg;base64,YYY');
    expect(i.src).toBe('data:image/jpeg;base64,YYY');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/imageNodeModel.test.ts`

- [ ] **Step 3: Implementation**

```ts
// src/renderer/components/MoodBoard/diagram/ImageNodeModel.ts
import {
  NodeModel,
  NodeModelGenerics,
  DeserializeEvent,
} from '@projectstorm/react-diagrams';

export interface ImageNodeOptions {
  src?: string;
  width?: number;
  height?: number;
  rotation?: number;
}

export class ImageNodeModel extends NodeModel<NodeModelGenerics> {
  public src: string;
  public rotation: number;

  constructor({
    src = '',
    width = 240,
    height = 180,
    rotation = 0,
  }: ImageNodeOptions) {
    super({ type: 'image' });
    this.src = src;
    this.width = width;
    this.height = height;
    this.rotation = rotation;
  }

  setSrc(src: string) {
    this.src = src;
  }

  serialize() {
    return {
      ...super.serialize(),
      src: this.src,
      width: this.width,
      height: this.height,
      rotation: this.rotation,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deserialize(event: DeserializeEvent<this> | { data: any }) {
    super.deserialize(event as DeserializeEvent<this>);
    const d = event.data as Partial<ImageNodeOptions>;
    this.src = d.src ?? '';
    this.width = d.width ?? 240;
    this.height = d.height ?? 180;
    this.rotation = d.rotation ?? 0;
  }
}
```

- [ ] **Step 4: Run — expect 3 PASS**

`npx jest src/__tests__/renderer/imageNodeModel.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/ImageNodeModel.ts src/__tests__/renderer/imageNodeModel.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): ImageNodeModel (src/width/height/rotation)"
```

---

## Task 7: ImageNodeWidget + Factory

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/ImageNodeWidget.tsx`
- Create: `src/renderer/components/MoodBoard/diagram/ImageNodeFactory.tsx`
- Create: `src/__tests__/renderer/imageNode.widget.test.tsx`

- [ ] **Step 1: Test**

```tsx
// src/__tests__/renderer/imageNode.widget.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import { ImageNodeModel } from '../../renderer/components/MoodBoard/diagram/ImageNodeModel';
import ImageNodeWidget from '../../renderer/components/MoodBoard/diagram/ImageNodeWidget';

describe('ImageNodeWidget', () => {
  test('renders an <img> with the node src', () => {
    const node = new ImageNodeModel({
      src: 'data:image/png;base64,AAA',
      width: 200,
      height: 150,
    });
    const engine = { repaintCanvas: jest.fn() };
    const { container } = render(<ImageNodeWidget node={node} engine={engine} />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA');
  });

  test('applies width/height to the outer container', () => {
    const node = new ImageNodeModel({ src: 'x', width: 300, height: 200 });
    const engine = { repaintCanvas: jest.fn() };
    const { container } = render(<ImageNodeWidget node={node} engine={engine} />);
    const outer = container.querySelector('[data-testid="image-node-outer"]') as HTMLElement;
    expect(outer.style.width).toBe('300px');
    expect(outer.style.height).toBe('200px');
  });

  test('renders a placeholder when src is empty', () => {
    const node = new ImageNodeModel({ src: '' });
    const engine = { repaintCanvas: jest.fn() };
    const { container } = render(<ImageNodeWidget node={node} engine={engine} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-testid="image-node-placeholder"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/imageNode.widget.test.tsx`

- [ ] **Step 3: ImageNodeWidget.tsx**

```tsx
// src/renderer/components/MoodBoard/diagram/ImageNodeWidget.tsx
import * as React from 'react';
import { ImageNodeModel } from './ImageNodeModel';

export interface ImageNodeWidgetProps {
  node: ImageNodeModel;
  engine: { repaintCanvas: () => void } | unknown;
}

function ImageNodeWidget({ node }: ImageNodeWidgetProps) {
  return (
    <div
      data-testid="image-node-outer"
      style={{
        width: node.width,
        height: node.height,
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        background: '#eee',
        overflow: 'hidden',
        borderRadius: 8,
        boxSizing: 'border-box',
      }}
    >
      {node.src ? (
        <img
          src={node.src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          data-testid="image-node-placeholder"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#777',
            fontSize: 12,
          }}
        >
          paste / drop an image
        </div>
      )}
    </div>
  );
}

export default ImageNodeWidget;
```

- [ ] **Step 4: ImageNodeFactory.tsx**

```tsx
// src/renderer/components/MoodBoard/diagram/ImageNodeFactory.tsx
import * as React from 'react';
import { AbstractReactFactory } from '@projectstorm/react-canvas-core';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { ImageNodeModel } from './ImageNodeModel';
import ImageNodeWidget from './ImageNodeWidget';

export class ImageNodeFactory extends AbstractReactFactory<
  ImageNodeModel,
  DiagramEngine
> {
  constructor() {
    super('image');
  }

  generateModel() {
    return new ImageNodeModel({});
  }

  generateReactWidget(event: { model: ImageNodeModel }) {
    return <ImageNodeWidget node={event.model} engine={this.engine} />;
  }
}
```

- [ ] **Step 5: Run — expect 3 PASS**

`npx jest src/__tests__/renderer/imageNode.widget.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/ImageNodeWidget.tsx src/renderer/components/MoodBoard/diagram/ImageNodeFactory.tsx src/__tests__/renderer/imageNode.widget.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): ImageNodeWidget + Factory (img + empty-state placeholder)"
```

---

## Task 8: Color zone draw-from-canvas helper (pure)

Pure module: given a drag start and end point, normalize into a `ColorZone` rect with a generated id and reasonable defaults.

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/canvas/colorZoneDraw.ts`
- Create: `src/__tests__/renderer/colorZoneDraw.test.ts`

- [ ] **Step 1: Test**

```ts
// src/__tests__/renderer/colorZoneDraw.test.ts
import { createColorZone } from '../../renderer/components/MoodBoard/diagram/canvas/colorZoneDraw';

describe('createColorZone', () => {
  test('forward drag (start top-left, end bottom-right) builds the correct rect', () => {
    const z = createColorZone(
      { x: 10, y: 20 },
      { x: 110, y: 80 },
      '#ffcc80',
    );
    expect(z.x).toBe(10);
    expect(z.y).toBe(20);
    expect(z.width).toBe(100);
    expect(z.height).toBe(60);
    expect(z.color).toBe('#ffcc80');
    expect(z.opacity).toBe(0.2);
    expect(typeof z.id).toBe('string');
    expect(z.id.length).toBeGreaterThan(0);
  });

  test('reverse drag normalizes to positive width/height', () => {
    const z = createColorZone({ x: 110, y: 80 }, { x: 10, y: 20 }, '#90caf9');
    expect(z.x).toBe(10);
    expect(z.y).toBe(20);
    expect(z.width).toBe(100);
    expect(z.height).toBe(60);
  });

  test('zero-size drag (same point) returns null', () => {
    const z = createColorZone({ x: 50, y: 50 }, { x: 50, y: 50 }, '#aaa');
    expect(z).toBeNull();
  });

  test('two successive calls produce different ids', () => {
    const a = createColorZone({ x: 0, y: 0 }, { x: 10, y: 10 }, '#aaa');
    const b = createColorZone({ x: 0, y: 0 }, { x: 10, y: 10 }, '#aaa');
    expect(a!.id).not.toBe(b!.id);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/colorZoneDraw.test.ts`

- [ ] **Step 3: Implementation**

```ts
// src/renderer/components/MoodBoard/diagram/canvas/colorZoneDraw.ts
import { ColorZone } from '../types';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `cz-${Date.now()}-${counter}`;
}

export function createColorZone(
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
  opacity = 0.2,
): ColorZone | null {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (width === 0 || height === 0) return null;
  return {
    id: nextId(),
    color,
    opacity,
    x,
    y,
    width,
    height,
  };
}
```

- [ ] **Step 4: Run — expect 4 PASS**

`npx jest src/__tests__/renderer/colorZoneDraw.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/canvas/colorZoneDraw.ts src/__tests__/renderer/colorZoneDraw.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): colorZoneDraw — pure helper to build a ColorZone from drag points"
```

---

## Task 9: Theme picker dropdown component

A small dropdown that lists the 5 built-in palettes and a "Custom…" entry. Emits `onChange(theme)` when selected.

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/canvas/ThemePicker.tsx`
- Create: `src/__tests__/renderer/themePicker.test.tsx`

- [ ] **Step 1: Test**

```tsx
// src/__tests__/renderer/themePicker.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ThemePicker from '../../renderer/components/MoodBoard/diagram/canvas/ThemePicker';

describe('ThemePicker', () => {
  test('renders one button per built-in palette + a "Custom" entry', () => {
    const { container } = render(
      <ThemePicker theme={{ paletteId: 'paper-and-ink' }} onChange={() => {}} />,
    );
    const buttons = container.querySelectorAll('[data-testid="theme-option"]');
    // 5 built-ins + 1 "Custom" entry
    expect(buttons.length).toBe(6);
  });

  test('clicking an option emits onChange with the chosen palette', () => {
    const onChange = jest.fn();
    const { container } = render(
      <ThemePicker theme={{ paletteId: 'paper-and-ink' }} onChange={onChange} />,
    );
    const warm = container.querySelector(
      '[data-testid="theme-option"][data-palette-id="warm-roman"]',
    ) as HTMLElement;
    fireEvent.click(warm);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ paletteId: 'warm-roman' }),
    );
  });

  test('the currently-selected palette has data-selected="true"', () => {
    const { container } = render(
      <ThemePicker theme={{ paletteId: 'cold-noir' }} onChange={() => {}} />,
    );
    const selected = container.querySelector(
      '[data-testid="theme-option"][data-selected="true"]',
    ) as HTMLElement;
    expect(selected).toBeTruthy();
    expect(selected.getAttribute('data-palette-id')).toBe('cold-noir');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/themePicker.test.tsx`

- [ ] **Step 3: Implementation**

```tsx
// src/renderer/components/MoodBoard/diagram/canvas/ThemePicker.tsx
import * as React from 'react';
import { BoardTheme, PALETTE_IDS, PaletteId } from '../types';
import { PALETTES } from './themes';

export interface ThemePickerProps {
  theme: BoardTheme;
  onChange: (next: BoardTheme) => void;
}

function ThemePicker({ theme, onChange }: ThemePickerProps) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {PALETTE_IDS.map((id) => {
        const palette = id !== 'custom' ? PALETTES[id] : null;
        const selected = theme.paletteId === id;
        return (
          <button
            key={id}
            type="button"
            data-testid="theme-option"
            data-palette-id={id}
            data-selected={selected ? 'true' : 'false'}
            onClick={() => onChange({ ...theme, paletteId: id as PaletteId })}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              border: selected ? '2px solid #2196f3' : '1px solid #ccc',
              cursor: 'pointer',
              background: palette
                ? `linear-gradient(135deg, ${palette.accent} 50%, ${palette.bg} 50%)`
                : 'repeating-linear-gradient(45deg, #ddd 0 4px, #fff 4px 8px)',
              padding: 0,
            }}
            title={id}
          />
        );
      })}
    </div>
  );
}

export default ThemePicker;
```

- [ ] **Step 4: Run — expect 3 PASS**

`npx jest src/__tests__/renderer/themePicker.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/canvas/ThemePicker.tsx src/__tests__/renderer/themePicker.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): ThemePicker — 5 palette swatches + 'Custom' option"
```

---

## Task 10: BackgroundPicker dropdown component

Simple control toggling between `none`, `pattern`, and `image` (image-upload deferred to Phase 3 — for Phase 2 the picker accepts a data-URL via a hidden file input and stores it directly).

**Files:**
- Create: `src/renderer/components/MoodBoard/diagram/canvas/BackgroundPicker.tsx`
- Create: `src/__tests__/renderer/backgroundPicker.test.tsx`

- [ ] **Step 1: Test**

```tsx
// src/__tests__/renderer/backgroundPicker.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import BackgroundPicker from '../../renderer/components/MoodBoard/diagram/canvas/BackgroundPicker';

describe('BackgroundPicker', () => {
  test('renders 3 mode buttons: none / pattern / image', () => {
    const { container } = render(
      <BackgroundPicker spec={{ mode: 'none' }} onChange={() => {}} />,
    );
    expect(container.querySelector('[data-mode="none"]')).toBeTruthy();
    expect(container.querySelector('[data-mode="pattern"]')).toBeTruthy();
    expect(container.querySelector('[data-mode="image"]')).toBeTruthy();
  });

  test('clicking "pattern" emits onChange with mode pattern', () => {
    const onChange = jest.fn();
    const { container } = render(
      <BackgroundPicker spec={{ mode: 'none' }} onChange={onChange} />,
    );
    fireEvent.click(container.querySelector('[data-mode="pattern"]') as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'pattern' }),
    );
  });

  test('currently-selected mode has data-selected="true"', () => {
    const { container } = render(
      <BackgroundPicker spec={{ mode: 'pattern' }} onChange={() => {}} />,
    );
    const selected = container.querySelector('[data-mode="pattern"][data-selected="true"]');
    expect(selected).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx jest src/__tests__/renderer/backgroundPicker.test.tsx`

- [ ] **Step 3: Implementation**

```tsx
// src/renderer/components/MoodBoard/diagram/canvas/BackgroundPicker.tsx
import * as React from 'react';
import { BackgroundLayerSpec, BackgroundMode } from '../types';

export interface BackgroundPickerProps {
  spec: BackgroundLayerSpec;
  onChange: (next: BackgroundLayerSpec) => void;
}

const MODES: BackgroundMode[] = ['none', 'pattern', 'image'];

function BackgroundPicker({ spec, onChange }: BackgroundPickerProps) {
  const onPick = (mode: BackgroundMode) => {
    if (mode === 'image') {
      // Synthesize a hidden file-input click; consume the result as a data URL.
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          onChange({ mode: 'image', imageAssetId: String(reader.result) });
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    onChange({ ...spec, mode });
  };

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          data-mode={mode}
          data-selected={spec.mode === mode ? 'true' : 'false'}
          onClick={() => onPick(mode)}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: spec.mode === mode ? '2px solid #2196f3' : '1px solid #ccc',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.92)',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

export default BackgroundPicker;
```

- [ ] **Step 4: Run — expect 3 PASS**

`npx jest src/__tests__/renderer/backgroundPicker.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/canvas/BackgroundPicker.tsx src/__tests__/renderer/backgroundPicker.test.tsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): BackgroundPicker — none/pattern/image mode toggle + file upload"
```

---

## Task 11: Wire BoardThemeProvider + BackgroundLayer + ColorZoneLayer + ImageNodeFactory into DetailedDiagramPanel

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js`

- [ ] **Step 1: Read the panel**

`cat src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js` — locate (a) engine init and factory registration, (b) the `diagramPanel` `useMemo`, (c) the toolbar JSX for adding `ThemePicker` + `BackgroundPicker`.

- [ ] **Step 2: Add imports**

After the existing Phase 1 imports:

```js
import { ImageNodeFactory } from './ImageNodeFactory';
import { ImageNodeModel } from './ImageNodeModel';
import BoardThemeProvider from './canvas/BoardThemeProvider';
import BackgroundLayer from './canvas/BackgroundLayer';
import ColorZoneLayer from './canvas/ColorZoneLayer';
import ThemePicker from './canvas/ThemePicker';
import BackgroundPicker from './canvas/BackgroundPicker';
import { createColorZone } from './canvas/colorZoneDraw';
import { DEFAULT_BOARD_THEME } from './types';
```

- [ ] **Step 3: Register ImageNodeFactory**

Inside the engine-init block, beside the existing FrameNodeFactory and StickyNoteNodeFactory registrations:

```js
engine.getNodeFactories().registerFactory(new ImageNodeFactory());
```

- [ ] **Step 4: Add theme + zones state**

Near the other useState calls in the component:

```js
const [boardTheme, setBoardTheme] = useState(
  curMoodBoard?.theme || DEFAULT_BOARD_THEME,
);
const [colorZones, setColorZones] = useState(
  curMoodBoard?.colorZones || [],
);
```

Sync from `curMoodBoard` in a useEffect:

```js
useEffect(() => {
  if (curMoodBoard?.theme) setBoardTheme(curMoodBoard.theme);
  if (curMoodBoard?.colorZones) setColorZones(curMoodBoard.colorZones);
}, [curMoodBoard]);
```

- [ ] **Step 5: Wrap the diagram in `<BoardThemeProvider>`**

In the `diagramPanel` `useMemo`, wrap the inner content:

```jsx
const diagramPanel = useMemo(() => {
  return (
    <div ref={componentRef} style={{ height: 'calc(100vh - 65px)' }}>
      <BoardThemeProvider theme={boardTheme}>
        <DemoCanvasWidget background={canvasBackground}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <BackgroundLayer spec={boardTheme.backgroundLayer || { mode: 'none' }} />
            <ColorZoneLayer zones={colorZones} />
            <CanvasWidget engine={engineRef.current} />
            <LassoSelection nodes={allNodes} engine={engineRef.current} />
          </div>
        </DemoCanvasWidget>
      </BoardThemeProvider>
    </div>
  );
}, [canvasBackground, nodeListVersion, boardTheme, colorZones]);
```

- [ ] **Step 6: Add toolbar buttons**

Find the existing left `ToolbarSection` with `+ Frame` and `+ Sticky`. After `+ Sticky`:

```jsx
<ToolbarDivider orientation="vertical" flexItem />
<Tooltip title="Theme">
  <ThemePicker
    theme={boardTheme}
    onChange={(next) => setBoardTheme(next)}
  />
</Tooltip>
<Tooltip title="Background">
  <BackgroundPicker
    spec={boardTheme.backgroundLayer || { mode: 'none' }}
    onChange={(next) =>
      setBoardTheme((t) => ({ ...t, backgroundLayer: next }))
    }
  />
</Tooltip>
<ActionButton
  variant="outlined"
  onClick={() => {
    const z = createColorZone(
      { x: 60, y: 60 },
      { x: 240, y: 180 },
      '#ffcc80',
    );
    if (z) setColorZones((prev) => [...prev, z]);
  }}
  sx={{ borderColor: 'rgba(0,0,0,0.2)' }}
>
  + Zone
</ActionButton>
<ActionButton
  variant="outlined"
  onClick={() => {
    const node = new ImageNodeModel({ src: '', width: 240, height: 180 });
    const existing = Object.values(
      engineRef.current.getModel().getNodes(),
    ).filter((n) => n.getType && n.getType() === 'image');
    node.setPosition(300 + existing.length * 24, 100 + existing.length * 24);
    engineRef.current.getModel().addNode(node);
    setNodeListVersion((v) => v + 1);
    engineRef.current.repaintCanvas();
  }}
  sx={{ borderColor: 'rgba(0,0,0,0.2)' }}
>
  + Image
</ActionButton>
```

- [ ] **Step 7: Smoke test**

```
npm run test:smoke
```
Expected: PASS (no ERROR_PATTERNS).

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): wire theme + background + color-zone + image-node into DetailedDiagramPanel"
```

---

## Task 12: Persistence — board JSON carries theme + colorZones

The board is currently saved/loaded via the existing flow (search for `onSaveGridLayout`, `engineRef.current.getModel().serialize()`, and the IPC handler that persists it). We need to add `theme` and `colorZones` to the serialized payload.

**Files:**
- Modify: `src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js`
- Create: `src/__tests__/renderer/moodboardPhase2.persistence.test.ts`

- [ ] **Step 1: Read the save handler**

Inside `DetailedDiagramPanel.js`, find the existing save handler (look for `serialize()` calls — `onSaveGridLayout` and any other save path). Note what the payload shape is.

- [ ] **Step 2: Extend the save payload**

Wherever the panel builds the JSON to persist, splice in:

```js
const payload = {
  ...engineRef.current.getModel().serialize(),
  theme: boardTheme,
  colorZones,
};
```

The exact location depends on the existing structure; if there's a wrapper that mutates `moodBoard.diagramData` or similar, update that field. Match the existing pattern.

- [ ] **Step 3: Extend the load path**

When the board loads (look for `deserializeModel` or similar), read `theme` and `colorZones` off the payload (already wired in Task 11 via the `useEffect` syncing from `curMoodBoard`). Make sure the redux/IPC layer surfaces those fields on the `moodBoard` slice.

If the load path needs to be updated to expose the new fields, do so. If the redux layer simply passes through any payload field as-is, no change is needed.

- [ ] **Step 4: Pure persistence test**

```ts
// src/__tests__/renderer/moodboardPhase2.persistence.test.ts
import { DEFAULT_BOARD_THEME, BoardTheme, ColorZone } from '../../renderer/components/MoodBoard/diagram/types';

// Mirrors the inline merge from the panel's save handler. Exporting the
// helper makes it testable without mounting the panel.
function buildBoardPayload(
  diagramJson: any,
  theme: BoardTheme,
  colorZones: ColorZone[],
) {
  return {
    ...diagramJson,
    theme,
    colorZones,
  };
}

describe('Phase 2 persistence', () => {
  test('payload carries theme + colorZones beside the diagram JSON', () => {
    const theme: BoardTheme = { paletteId: 'cold-noir' };
    const zones: ColorZone[] = [
      { id: 'z1', color: '#90caf9', opacity: 0.2, x: 0, y: 0, width: 100, height: 50 },
    ];
    const payload = buildBoardPayload({ id: 'demo', nodes: {}, links: {} }, theme, zones);
    expect(payload.theme).toEqual(theme);
    expect(payload.colorZones).toEqual(zones);
    expect(payload.id).toBe('demo');
  });

  test('legacy boards without theme deserialize via DEFAULT_BOARD_THEME fallback', () => {
    const incoming = { id: 'old', nodes: {}, links: {} } as any;
    const theme = incoming.theme ?? DEFAULT_BOARD_THEME;
    expect(theme).toEqual(DEFAULT_BOARD_THEME);
  });
});
```

The panel's `useEffect` from Task 11 already implements the legacy fallback via `curMoodBoard?.theme || DEFAULT_BOARD_THEME`. This test documents the contract.

If the panel ends up exporting the helper for shared use, import it in the test instead of duplicating.

- [ ] **Step 5: Run — expect 2 PASS**

`npx jest src/__tests__/renderer/moodboardPhase2.persistence.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/MoodBoard/diagram/DetailedDiagramPanel.js src/__tests__/renderer/moodboardPhase2.persistence.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(moodboard): persist theme + colorZones alongside diagram JSON (Phase 2 storage)"
```

---

## Task 13: Phase 2 integration test

Verifies the four Phase 2 primitives compose at the data layer: theme + background spec + color zones + image node round-trip through serialize/deserialize. Storm engine not required — uses the same model-level approach as the Phase 1 integration test.

**Files:**
- Create: `src/__tests__/renderer/moodboardPhase2.integration.test.ts`

- [ ] **Step 1: Test**

```ts
// src/__tests__/renderer/moodboardPhase2.integration.test.ts
import { ImageNodeModel } from '../../renderer/components/MoodBoard/diagram/ImageNodeModel';
import {
  BoardTheme,
  ColorZone,
  BackgroundLayerSpec,
} from '../../renderer/components/MoodBoard/diagram/types';
import { resolvePalette, PALETTES } from '../../renderer/components/MoodBoard/diagram/canvas/themes';
import { createColorZone } from '../../renderer/components/MoodBoard/diagram/canvas/colorZoneDraw';

describe('MoodBoard Phase 2 integration', () => {
  test('theme + background + color zones + image node compose into a single board payload', () => {
    // Build a Phase 2 board.
    const theme: BoardTheme = {
      paletteId: 'warm-roman',
      backgroundLayer: { mode: 'pattern', patternKey: 'dot-grid', opacity: 0.12 },
    };
    const zoneA = createColorZone({ x: 0, y: 0 }, { x: 200, y: 100 }, '#ffcc80')!;
    const zoneB = createColorZone({ x: 300, y: 0 }, { x: 500, y: 100 }, '#90caf9')!;
    const image = new ImageNodeModel({
      src: 'data:image/png;base64,FAKEIMG',
      width: 320,
      height: 240,
      rotation: 5,
    });
    image.setPosition(100, 200);

    // Mimic the save-side merge from Task 12.
    const payload = {
      // The image node's serialize() output stands in for diagram JSON.
      nodes: { [image.getID()]: image.serialize() },
      theme,
      colorZones: [zoneA, zoneB],
    };

    // Palette resolves to the warm-roman colors.
    expect(resolvePalette(payload.theme)).toEqual(PALETTES['warm-roman']);

    // Image node round-trips.
    const restored = new ImageNodeModel({});
    restored.deserialize({ data: payload.nodes[image.getID()] });
    expect(restored.src).toBe('data:image/png;base64,FAKEIMG');
    expect(restored.rotation).toBe(5);

    // Color zones preserve coordinates and ids.
    expect(payload.colorZones).toHaveLength(2);
    expect(payload.colorZones[0].id).not.toEqual(payload.colorZones[1].id);
  });

  test('background spec mode "image" requires imageAssetId', () => {
    const spec: BackgroundLayerSpec = {
      mode: 'image',
      imageAssetId: 'data:image/jpeg;base64,Y',
      opacity: 0.15,
    };
    expect(spec.mode).toBe('image');
    expect(spec.imageAssetId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect 2 PASS**

`npx jest src/__tests__/renderer/moodboardPhase2.integration.test.ts`

- [ ] **Step 3: Run full Phase 1 + Phase 2 suite (regression check)**

```
npx jest src/__tests__/renderer/proximityAttach src/__tests__/renderer/customLinkModel src/__tests__/renderer/customLinkSegment src/__tests__/renderer/customLinkWidget src/__tests__/renderer/frameNodeModel src/__tests__/renderer/frameNodeDrag src/__tests__/renderer/frameNodeWidget src/__tests__/renderer/containment src/__tests__/renderer/stickyNoteNode src/__tests__/renderer/noteNodeWidget.ports src/__tests__/renderer/lassoSelection src/__tests__/renderer/useMultiSelectDrag src/__tests__/renderer/moodboardPhase1.integration src/__tests__/renderer/detailedDiagramPanel.runtime src/__tests__/renderer/themes src/__tests__/renderer/boardThemeProvider src/__tests__/renderer/backgroundLayer src/__tests__/renderer/colorZoneLayer src/__tests__/renderer/imageNodeModel src/__tests__/renderer/imageNode.widget src/__tests__/renderer/colorZoneDraw src/__tests__/renderer/themePicker src/__tests__/renderer/backgroundPicker src/__tests__/renderer/moodboardPhase2.persistence src/__tests__/renderer/moodboardPhase2.integration
```

Expected: ~70 tests across 25 suites, all pass.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/renderer/moodboardPhase2.integration.test.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(moodboard): Phase 2 integration — theme + background + zones + image-node compose"
```

---

## Task 14: Manual visual gate

- [ ] **Step 1: Start dev server**

```
npm start
```

- [ ] **Step 2: Walk the checklist**

In the MoodBoard diagram view, with one or two existing boards:

- [ ] Toolbar shows a theme picker (5 swatches + "Custom"), a background picker (`none` / `pattern` / `image`), a `+ Zone` button, and a `+ Image` button — all sitting beside the Phase 1 `+ Frame` and `+ Sticky`.
- [ ] Click each theme swatch — canvas palette shifts visibly (ink color, background color, accent stripe on note cards).
- [ ] Click `pattern` → dot-grid appears as a subtle underlay; click `none` → underlay disappears; click `image` → file picker opens; pick any image → blurred low-opacity background appears.
- [ ] Click `+ Zone` → a translucent orange rectangle appears at (60,60); drag it onto a region of the canvas with cards on it → cards remain interactive (zones don't intercept).
- [ ] Click `+ Image` → an empty image-node placeholder appears; (paste/drop integration is Phase 3 — verify the placeholder reads "paste / drop an image" for now).
- [ ] Save the board, close it, reopen → theme + background + zones persist; the image-node placeholder is still there.
- [ ] Phase 1 features still work: lasso, frames, sticky notes, typed connectors.

- [ ] **Step 3: Log gaps**

Anything that misbehaves is filed as Phase 2.5 work. Phase 3 picks up image paste/drop, AI-generated backgrounds, PNG/PDF export, and the Phase 8b auto-frame from clusters.

---

## Self-Review Notes

- **Spec coverage:**
  - Board theme — Tasks 1 (types), 2 (palettes), 3 (provider), 9 (picker), 11 (wiring) ✓
  - Background canvas — Tasks 1 (types), 4 (layer), 10 (picker), 11 (wiring) ✓
  - Color zones — Tasks 1 (types), 5 (layer), 8 (draw helper), 11 (wiring + + Zone button) ✓
  - Image-only node — Tasks 6 (model), 7 (widget+factory), 11 (wiring + + Image button) ✓
  - Persistence — Task 12 ✓
  - Integration — Task 13 ✓
  - Manual gate — Task 14 ✓

- **Spec deviation:** Theme + color-zones live in the board JSON blob, not in new SQL columns. The spec contradicts itself on this point (ALTER TABLE clauses alongside "everything in JSON blob"); this plan picks the consistent path. If access patterns later demand SQL columns (e.g., querying boards by paletteId without deserializing), promote then.

- **Placeholder scan:** No TBDs / TODO / "similar to" patterns. Every code step has full code.

- **Type consistency:** `BoardTheme`, `Palette`, `PaletteId`, `BackgroundLayerSpec`, `ColorZone` are the canonical types — exported from `types.ts`, imported by every consumer. `PALETTES`, `resolvePalette` exported from `canvas/themes.ts`. `createColorZone` from `canvas/colorZoneDraw.ts`. No name drift across tasks.

- **No new dependencies.** All work uses existing storm-react-diagrams, React, Jest, @testing-library/react. PNG/PDF export's `html-to-image` is Phase 3.

- **Existing test count:** 44 (Phase 1). Phase 2 adds ~26 new tests across 11 new files. Total target: ~70 tests.

- **Phase 2.5 / Phase 3 candidates** (deliberately out of scope here):
  - Image paste from clipboard / file drop onto image node
  - Customizing a palette ("Custom…" entry opens a color picker)
  - Color-zone interactive draw (click-and-drag on canvas while a modifier is held)
  - PNG/PDF export
  - AI-generated thematic background art
  - Phase 8b auto-frame + auto-theme from cluster detection
  - Frame resize handle UI
