# AI-Driven Shell — Skeleton + Phase 4 Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Brain-as-orchestrator shell skeleton — Presence Orb, Trigger Bus, Proposal Queue, Atomic Chip Flow — and migrate Phase 4 (micro-card) as the proof that the architecture works end-to-end. Subsequent plans add Inline Sequence, Multi-Surface Flow, Quest layer, and Phase 5–8 migration.

**Architecture:** Phase 4–8 services emit Triggers (instead of rendering DOM directly). Triggers flow via IPC to a renderer-side Trigger Bus that owns a Proposal Queue. A single Brain Presence Orb in the shell header reflects queue state. A Flow Coordinator routes accepted Proposals to the right Flow Unit host (this plan: Atomic Chip only). All 21 routes survive as escape hatches.

**Tech Stack:** React 18, MUI, react-router-dom (`createHashRouter`), Electron IPC (`ipcMain` + `webContents.send` + `window.electron.ipcRenderer`), Jest 29 + `@testing-library/react`, electron-store, JSDoc typedefs for shared contracts.

**Scope of this plan (Plan 1):** Tasks 1–27. Spec criteria 1, 2, 6 (partial), 7, 8 (Phase 4 only), 9.

**Deferred to Plan 2:** InlineSequenceHost, MultiSurfaceFlowHost, Quest layer, migration of Phase 5–8 trigger sites, "uncertain" Orb state visual polish.

**Reference spec:** [`docs/superpowers/specs/2026-06-14-ai-driven-shell-design.md`](../specs/2026-06-14-ai-driven-shell-design.md)

**Glossary:** [`CONTEXT.md`](../../../CONTEXT.md) — use the canonical terms (Brain, Orb, Trigger, Proposal, Flow, Quest, Pull, Push, Escape Hatch).

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `src/commons/brain/triggerTypes.js` | JSDoc typedefs for Trigger / Proposal / Flow / OrbState (shared contracts, no runtime code) |
| `src/main/brain/TriggerEmitter.js` | Main-process helper that ships Triggers to the renderer via `webContents.send` |
| `src/main/ipc/triggerBusHandlers.js` | IPC handlers for `brain:trigger:*` (emit, queue-state, pull, accept, dismiss) |
| `src/renderer/brain/triggerBus.js` | Renderer-side singleton: subscribes to main, owns Proposal Queue, exposes pub/sub |
| `src/renderer/brain/proposalQueue.js` | Priority + freshness + dedup + max-size queue (pure data structure, no I/O) |
| `src/renderer/brain/useBrainState.js` | React hook exposing Orb state + queue snapshot from `triggerBus` |
| `src/renderer/components/brainShell/BrainShell.jsx` | Top-level wrapper: Orb + ManualMenu + FlowCoordinator + RouterOutlet slot |
| `src/renderer/components/brainShell/BrainOrb.jsx` | 5-state ambient indicator (visual primitive) |
| `src/renderer/components/brainShell/ManualMenu.jsx` | Dropdown of the 21 routes (escape hatches) |
| `src/renderer/components/brainShell/FlowCoordinator.jsx` | Decides which Flow Unit host to mount based on active Proposal |
| `src/renderer/components/brainShell/AtomicChipHost.jsx` | Renders an Atomic Chip Flow inline at its surface target |
| `src/renderer/views/brainDashboard/index.jsx` | New `/` route content (Brain Dashboard, minimal) |
| `src/__tests__/brain/triggerEmitter.test.js` | Main-process TriggerEmitter unit test |
| `src/__tests__/renderer/proposalQueue.test.js` | Queue logic unit test |
| `src/__tests__/renderer/triggerBus.test.js` | Bus pub/sub + queue integration test |
| `src/__tests__/renderer/BrainOrb.test.jsx` | 5-state render test |
| `src/__tests__/renderer/BrainShell.test.jsx` | Shell composition smoke test |
| `src/__tests__/integration/phase4-trigger-migration.integration.test.js` | End-to-end: Phase 4 trigger → AtomicChip render |

### Modified files

| Path | Change |
|------|--------|
| `src/renderer/main.jsx` | Wrap router output in `<BrainShell>`; register new `/` route to `BrainDashboard`; move old home content registration to `/library-home` |
| `src/renderer/api/brainApi.js` | Add `emitTriggerFromRenderer`, `acceptProposal`, `dismissProposal`, `subscribeTriggers`, `getQueueState` |
| `src/main/main.ts` | Register `triggerBusHandlers`; pass `mainWindow.webContents` into `TriggerEmitter` |
| `src/main/brain/LearningBrainAgent.js` | (Phase 4 only) replace direct `persistBrainNotifications` call for micro-card path with `triggerEmitter.emit(...)` |
| `src/main/utils/MicroCardProposer.js` | Inject `triggerEmitter`; emit Trigger instead of (or in addition to — flagged) direct chip dispatch |
| `src/renderer/views/reading/MicroCardChip.js` | Refactor: render path triggered by FlowCoordinator's AtomicChipHost, not by `useMicroCardProposals` hook directly |
| `src/renderer/views/reading/hooks/useMicroCardProposals.js` | Stop dispatching chip directly; emit a renderer-side Trigger registration if local-only proposals still apply, OR remove if all proposals now come from main |
| `src/renderer/routes/index.jsx` | If this is the current home content: re-register as `/library-home`; new `/` is `BrainDashboard` |

---

## Phase A — Shared Contracts and Queue Primitives

### Task 1: Define shared Trigger / Proposal / Flow / OrbState typedefs

**Files:**
- Create: `src/commons/brain/triggerTypes.js`

- [ ] **Step 1: Create the typedef file**

```js
// src/commons/brain/triggerTypes.js
/**
 * Shared JSDoc typedefs for the Brain-driven shell.
 * Imported by both main and renderer processes — no runtime exports.
 *
 * @module commons/brain/triggerTypes
 */

/**
 * @typedef {'atomic-chip' | 'inline-sequence' | 'multi-surface-flow'} FlowUnit
 */

/**
 * @typedef {'low' | 'normal' | 'high'} TriggerPriority
 */

/**
 * @typedef {'idle' | 'thinking' | 'has-proposal' | 'mid-flow' | 'uncertain'} OrbState
 */

/**
 * Where a Trigger should render. The shape is unit-dependent.
 * For atomic-chip: `{ kind: 'paragraph', cfi: string }` or `{ kind: 'global' }`.
 * For inline-sequence: `{ kind: 'view', view: string }`.
 * For multi-surface-flow: `{ kind: 'flow', steps: Array<{ view: string, payload?: object }> }`.
 *
 * @typedef {object} SurfaceTarget
 * @property {string} kind
 * @property {string} [cfi]
 * @property {string} [view]
 * @property {Array<object>} [steps]
 */

/**
 * @typedef {object} Trigger
 * @property {string} id                Stable dedup id, e.g. `phase4:para:${cfi}`
 * @property {string} source            Trigger source tag, e.g. `phase-4-micro-card`
 * @property {FlowUnit} unit
 * @property {SurfaceTarget} surfaceTarget
 * @property {TriggerPriority} priority
 * @property {number} freshness         TTL in ms after emission
 * @property {number} emittedAt         epoch ms
 * @property {object} payload           unit-specific payload
 */

/**
 * A queued Trigger awaiting user engagement.
 * @typedef {Trigger & { queuedAt: number, status: 'queued' | 'active' | 'dismissed' | 'expired' }} Proposal
 */

/**
 * @typedef {object} FlowState
 * @property {string} proposalId
 * @property {FlowUnit} unit
 * @property {'running' | 'paused' | 'completed' | 'aborted'} status
 * @property {number} [step]            current step for sequence/multi-surface
 * @property {number} [totalSteps]
 */

module.exports = {};
```

- [ ] **Step 2: Verify file parses**

Run: `node -e "require('./src/commons/brain/triggerTypes.js')"`
Expected: no error, no output.

- [ ] **Step 3: Commit**

```bash
git add src/commons/brain/triggerTypes.js
git commit -m "feat(brain-shell): define Trigger/Proposal/Flow/OrbState typedefs"
```

---

### Task 2: ProposalQueue — write the failing test

**Files:**
- Test: `src/__tests__/renderer/proposalQueue.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/renderer/proposalQueue.test.js
const ProposalQueue = require('../../renderer/brain/proposalQueue');

const makeTrigger = (over = {}) => ({
  id: 'phase4:para:cfi-1',
  source: 'phase-4-micro-card',
  unit: 'atomic-chip',
  surfaceTarget: { kind: 'paragraph', cfi: 'cfi-1' },
  priority: 'normal',
  freshness: 60_000,
  emittedAt: Date.now(),
  payload: { term: 'foo' },
  ...over,
});

describe('ProposalQueue', () => {
  test('enqueues a trigger and reports queue depth', () => {
    const q = new ProposalQueue();
    q.enqueue(makeTrigger());
    expect(q.size()).toBe(1);
    expect(q.peek().id).toBe('phase4:para:cfi-1');
  });

  test('dedupes by trigger id', () => {
    const q = new ProposalQueue();
    q.enqueue(makeTrigger({ id: 'x' }));
    q.enqueue(makeTrigger({ id: 'x' }));
    expect(q.size()).toBe(1);
  });

  test('orders by priority then freshness', () => {
    const q = new ProposalQueue();
    q.enqueue(makeTrigger({ id: 'a', priority: 'low', emittedAt: 100 }));
    q.enqueue(makeTrigger({ id: 'b', priority: 'high', emittedAt: 200 }));
    q.enqueue(makeTrigger({ id: 'c', priority: 'normal', emittedAt: 300 }));
    expect(q.peek().id).toBe('b');
    q.dismiss('b');
    expect(q.peek().id).toBe('c');
  });

  test('expires triggers past freshness TTL', () => {
    const q = new ProposalQueue({ now: () => 10_000 });
    q.enqueue(makeTrigger({ id: 'old', freshness: 100, emittedAt: 0 }));
    q.enqueue(makeTrigger({ id: 'fresh', freshness: 100_000, emittedAt: 9_000 }));
    q.purgeExpired();
    expect(q.size()).toBe(1);
    expect(q.peek().id).toBe('fresh');
  });

  test('evicts lowest-priority when above max size', () => {
    const q = new ProposalQueue({ maxSize: 2 });
    q.enqueue(makeTrigger({ id: 'a', priority: 'low' }));
    q.enqueue(makeTrigger({ id: 'b', priority: 'normal' }));
    q.enqueue(makeTrigger({ id: 'c', priority: 'high' }));
    expect(q.size()).toBe(2);
    expect(q.list().map((p) => p.id).sort()).toEqual(['b', 'c']);
  });

  test('dismiss removes by id and marks status', () => {
    const q = new ProposalQueue();
    q.enqueue(makeTrigger({ id: 'x' }));
    const dismissed = q.dismiss('x');
    expect(dismissed.status).toBe('dismissed');
    expect(q.size()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/renderer/proposalQueue.test.js`
Expected: FAIL with `Cannot find module '../../renderer/brain/proposalQueue'`.

- [ ] **Step 3: Commit failing test**

```bash
git add src/__tests__/renderer/proposalQueue.test.js
git commit -m "test(brain-shell): proposalQueue boundary tests (failing)"
```

---

### Task 3: ProposalQueue — implement

**Files:**
- Create: `src/renderer/brain/proposalQueue.js`

- [ ] **Step 1: Write the implementation**

```js
// src/renderer/brain/proposalQueue.js
/**
 * ProposalQueue — priority + freshness + dedup + max-size queue.
 * Pure data structure, no I/O. Consumed by TriggerBus.
 *
 * @see commons/brain/triggerTypes for Trigger/Proposal shapes.
 */

const PRIORITY_RANK = { high: 3, normal: 2, low: 1 };

class ProposalQueue {
  /**
   * @param {{ maxSize?: number, now?: () => number }} [opts]
   */
  constructor(opts = {}) {
    this._items = new Map(); // id → Proposal
    this._maxSize = opts.maxSize ?? 32;
    this._now = opts.now ?? (() => Date.now());
  }

  /**
   * @param {import('../../commons/brain/triggerTypes').Trigger} trigger
   * @returns {import('../../commons/brain/triggerTypes').Proposal}
   */
  enqueue(trigger) {
    if (this._items.has(trigger.id)) return this._items.get(trigger.id);
    const proposal = { ...trigger, queuedAt: this._now(), status: 'queued' };
    this._items.set(trigger.id, proposal);
    this._evictIfOverMax();
    return proposal;
  }

  peek() {
    const sorted = this._sortedQueued();
    return sorted[0] ?? null;
  }

  list() {
    return this._sortedQueued();
  }

  size() {
    return this._sortedQueued().length;
  }

  dismiss(id) {
    const p = this._items.get(id);
    if (!p) return null;
    p.status = 'dismissed';
    this._items.delete(id);
    return p;
  }

  purgeExpired() {
    const now = this._now();
    for (const [id, p] of this._items.entries()) {
      if (p.emittedAt + p.freshness < now) {
        p.status = 'expired';
        this._items.delete(id);
      }
    }
  }

  _sortedQueued() {
    return Array.from(this._items.values())
      .filter((p) => p.status === 'queued')
      .sort((a, b) => {
        const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (pr !== 0) return pr;
        return b.emittedAt - a.emittedAt; // newer first inside same tier
      });
  }

  _evictIfOverMax() {
    if (this._items.size <= this._maxSize) return;
    // Drop lowest-priority, oldest first
    const overage = this._items.size - this._maxSize;
    const victims = Array.from(this._items.values()).sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      return a.emittedAt - b.emittedAt;
    });
    for (let i = 0; i < overage; i += 1) {
      this._items.delete(victims[i].id);
    }
  }
}

module.exports = ProposalQueue;
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx jest src/__tests__/renderer/proposalQueue.test.js`
Expected: PASS (6/6 tests).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/brain/proposalQueue.js
git commit -m "feat(brain-shell): ProposalQueue with priority/freshness/dedup/max-size"
```

---

### Task 4: TriggerBus — write the failing test

**Files:**
- Test: `src/__tests__/renderer/triggerBus.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/renderer/triggerBus.test.js
// Mock the ipcRenderer surface BEFORE requiring triggerBus.
let ipcOnHandlers = {};
const ipcInvoke = jest.fn().mockResolvedValue({ ok: true });
const ipcSend = jest.fn();

beforeEach(() => {
  ipcOnHandlers = {};
  jest.resetModules();
  global.window = {
    electron: {
      ipcRenderer: {
        on: (channel, cb) => {
          ipcOnHandlers[channel] = cb;
        },
        removeListener: (channel) => {
          delete ipcOnHandlers[channel];
        },
        invoke: ipcInvoke,
        send: ipcSend,
      },
    },
  };
  ipcInvoke.mockClear();
  ipcSend.mockClear();
});

const makeTrigger = (over = {}) => ({
  id: 't1',
  source: 'phase-4-micro-card',
  unit: 'atomic-chip',
  surfaceTarget: { kind: 'paragraph', cfi: 'cfi-1' },
  priority: 'normal',
  freshness: 60_000,
  emittedAt: Date.now(),
  payload: {},
  ...over,
});

describe('triggerBus', () => {
  test('receives main-process Triggers and enqueues them', () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    expect(typeof ipcOnHandlers['brain:trigger:push']).toBe('function');

    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    expect(triggerBus.getQueueSnapshot().length).toBe(1);
  });

  test('notifies subscribers when queue changes', () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    const sub = jest.fn();
    triggerBus.subscribe(sub);
    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    expect(sub).toHaveBeenCalled();
  });

  test('orbState derives from queue: idle when empty, has-proposal when not', () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    expect(triggerBus.getOrbState()).toBe('idle');
    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    expect(triggerBus.getOrbState()).toBe('has-proposal');
  });

  test('accept invokes IPC and removes from queue', async () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    await triggerBus.accept('x');
    expect(ipcInvoke).toHaveBeenCalledWith('brain:trigger:accept', 'x');
    expect(triggerBus.getQueueSnapshot()).toHaveLength(0);
  });

  test('dismiss invokes IPC and removes from queue', async () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    await triggerBus.dismiss('x');
    expect(ipcInvoke).toHaveBeenCalledWith('brain:trigger:dismiss', 'x');
    expect(triggerBus.getQueueSnapshot()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/renderer/triggerBus.test.js`
Expected: FAIL with `Cannot find module '../../renderer/brain/triggerBus'`.

- [ ] **Step 3: Commit failing test**

```bash
git add src/__tests__/renderer/triggerBus.test.js
git commit -m "test(brain-shell): triggerBus pub/sub + IPC boundary tests (failing)"
```

---

### Task 5: TriggerBus — implement

**Files:**
- Create: `src/renderer/brain/triggerBus.js`

- [ ] **Step 1: Write the implementation**

```js
// src/renderer/brain/triggerBus.js
/**
 * TriggerBus — renderer-side singleton that subscribes to main-process
 * Trigger emissions, owns the ProposalQueue, and exposes pub/sub for
 * the Orb, FlowCoordinator, and Brain Dashboard.
 *
 * Lifecycle: init() once from BrainShell mount.
 */

const ProposalQueue = require('./proposalQueue');

const queue = new ProposalQueue();
const subscribers = new Set();
let initialized = false;
let activeProposalId = null;

function notify() {
  subscribers.forEach((cb) => {
    try {
      cb({
        queue: queue.list(),
        orbState: getOrbState(),
        activeProposalId,
      });
    } catch (e) {
      // Subscriber errors must not crash the bus.
      // eslint-disable-next-line no-console
      console.error('[triggerBus] subscriber error', e);
    }
  });
}

function getOrbState() {
  if (activeProposalId) return 'mid-flow';
  const size = queue.size();
  if (size === 0) return 'idle';
  return 'has-proposal';
}

function init() {
  if (initialized) return;
  const ipc = window.electron?.ipcRenderer;
  if (!ipc) {
    // eslint-disable-next-line no-console
    console.warn('[triggerBus] ipcRenderer unavailable; bus is inert.');
    return;
  }
  ipc.on('brain:trigger:push', (_evt, trigger) => {
    queue.enqueue(trigger);
    notify();
  });
  initialized = true;
}

function subscribe(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function getQueueSnapshot() {
  return queue.list();
}

async function accept(proposalId) {
  const ipc = window.electron?.ipcRenderer;
  if (ipc) await ipc.invoke('brain:trigger:accept', proposalId);
  activeProposalId = proposalId;
  // Accept removes from queue; flow lifecycle takes over.
  queue.dismiss(proposalId);
  notify();
}

async function dismiss(proposalId) {
  const ipc = window.electron?.ipcRenderer;
  if (ipc) await ipc.invoke('brain:trigger:dismiss', proposalId);
  queue.dismiss(proposalId);
  notify();
}

function completeActive() {
  activeProposalId = null;
  notify();
}

async function pull() {
  // Returns top proposal if queue non-empty; else asks main for a synthesized suggestion.
  const top = queue.peek();
  if (top) return top;
  const ipc = window.electron?.ipcRenderer;
  if (!ipc) return null;
  return ipc.invoke('brain:trigger:pull');
}

module.exports = {
  init,
  subscribe,
  getQueueSnapshot,
  getOrbState,
  accept,
  dismiss,
  completeActive,
  pull,
};
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx jest src/__tests__/renderer/triggerBus.test.js`
Expected: PASS (5/5 tests).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/brain/triggerBus.js
git commit -m "feat(brain-shell): TriggerBus subscribes to main, owns ProposalQueue"
```

---

## Phase B — IPC and Main-Process TriggerEmitter

### Task 6: TriggerEmitter — write the failing test

**Files:**
- Test: `src/__tests__/brain/triggerEmitter.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/brain/triggerEmitter.test.js
const TriggerEmitter = require('../../main/brain/TriggerEmitter');

describe('TriggerEmitter', () => {
  test('sends brain:trigger:push to provided webContents', () => {
    const send = jest.fn();
    const webContents = { send };
    const emitter = new TriggerEmitter({ getWebContents: () => webContents });
    const trigger = {
      id: 'phase4:para:cfi-1',
      source: 'phase-4-micro-card',
      unit: 'atomic-chip',
      surfaceTarget: { kind: 'paragraph', cfi: 'cfi-1' },
      priority: 'normal',
      freshness: 60_000,
      payload: { term: 'foo' },
    };
    emitter.emit(trigger);
    expect(send).toHaveBeenCalledWith(
      'brain:trigger:push',
      expect.objectContaining({ id: 'phase4:para:cfi-1', emittedAt: expect.any(Number) }),
    );
  });

  test('no-op when webContents is null (renderer not ready)', () => {
    const emitter = new TriggerEmitter({ getWebContents: () => null });
    expect(() => emitter.emit({ id: 'x' })).not.toThrow();
  });

  test('defaults missing freshness to 5 minutes', () => {
    const send = jest.fn();
    const emitter = new TriggerEmitter({ getWebContents: () => ({ send }) });
    emitter.emit({ id: 'x', source: 's', unit: 'atomic-chip', surfaceTarget: { kind: 'global' }, priority: 'normal', payload: {} });
    expect(send.mock.calls[0][1].freshness).toBe(5 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/brain/triggerEmitter.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Commit failing test**

```bash
git add src/__tests__/brain/triggerEmitter.test.js
git commit -m "test(brain-shell): TriggerEmitter boundary tests (failing)"
```

---

### Task 7: TriggerEmitter — implement

**Files:**
- Create: `src/main/brain/TriggerEmitter.js`

- [ ] **Step 1: Write the implementation**

```js
// src/main/brain/TriggerEmitter.js
/**
 * TriggerEmitter — main-process helper used by Brain services
 * (MicroCardProposer, BookDiagnosticService, ComprehensionGradingService,
 * RereadQueueService, MoodBoardOrganizerService, ProductionPromptService,
 * LearningPathPlannerService) to ship Triggers to the renderer.
 *
 * Replaces the legacy `persistBrainNotifications` path for shell-driven flows.
 */

const DEFAULT_FRESHNESS_MS = 5 * 60 * 1000;

class TriggerEmitter {
  /**
   * @param {{ getWebContents: () => Electron.WebContents | null }} deps
   */
  constructor({ getWebContents }) {
    this._getWebContents = getWebContents;
  }

  /**
   * @param {Omit<import('../../commons/brain/triggerTypes').Trigger, 'emittedAt'> & { freshness?: number }} trigger
   */
  emit(trigger) {
    const wc = this._getWebContents();
    if (!wc) return; // Renderer not ready; trigger drops (TODO: queue-on-main in Plan 2).
    const enriched = {
      freshness: DEFAULT_FRESHNESS_MS,
      ...trigger,
      emittedAt: Date.now(),
    };
    wc.send('brain:trigger:push', enriched);
  }
}

module.exports = TriggerEmitter;
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx jest src/__tests__/brain/triggerEmitter.test.js`
Expected: PASS (3/3 tests).

- [ ] **Step 3: Commit**

```bash
git add src/main/brain/TriggerEmitter.js
git commit -m "feat(brain-shell): TriggerEmitter ships triggers to renderer"
```

---

### Task 8: triggerBus IPC handlers

**Files:**
- Create: `src/main/ipc/triggerBusHandlers.js`
- Modify: `src/main/main.ts` (registration only)

- [ ] **Step 1: Write the handlers**

```js
// src/main/ipc/triggerBusHandlers.js
/**
 * IPC handlers for the renderer-side TriggerBus.
 * - brain:trigger:accept   — record acceptance; future: spawn server-side flow state
 * - brain:trigger:dismiss  — record dismissal; feed back into Brain learning
 * - brain:trigger:pull     — synthesize "what's next?" when queue empty
 */

const { ipcMain } = require('electron');

function registerTriggerBusHandlers(services = {}) {
  const { brain } = services;

  ipcMain.handle('brain:trigger:accept', async (_evt, proposalId) => {
    if (brain?.recordProposalEvent) {
      await brain.recordProposalEvent({ proposalId, kind: 'accept' });
    }
    return { ok: true };
  });

  ipcMain.handle('brain:trigger:dismiss', async (_evt, proposalId) => {
    if (brain?.recordProposalEvent) {
      await brain.recordProposalEvent({ proposalId, kind: 'dismiss' });
    }
    return { ok: true };
  });

  ipcMain.handle('brain:trigger:pull', async () => {
    if (brain?.synthesizePullSuggestion) {
      return brain.synthesizePullSuggestion();
    }
    return null;
  });
}

module.exports = { registerTriggerBusHandlers };
```

- [ ] **Step 2: Register handlers in `main.ts`**

Find the section in `src/main/main.ts` where other IPC handlers are registered (search for `registerBrainHandlers` or `registerMicroCardHandlers`). Add **after** the existing brain handler registration:

```ts
// In src/main/main.ts, near other registerXxxHandlers calls:
const { registerTriggerBusHandlers } = require('./ipc/triggerBusHandlers');
registerTriggerBusHandlers({ brain });
```

Also instantiate `TriggerEmitter` and attach it to `brain` so services can reach it:

```ts
// In src/main/main.ts, AFTER mainWindow creation, BEFORE service initialization:
const TriggerEmitter = require('./brain/TriggerEmitter');
const triggerEmitter = new TriggerEmitter({
  getWebContents: () => (mainWindow?.webContents ?? null),
});
// Pass triggerEmitter into brain initialization (e.g., initializeLearningBrain({ ..., triggerEmitter })).
```

The exact integration point depends on the brain init function signature in `src/main/brain/index.js`. If `initializeLearningBrain` does not yet accept `triggerEmitter`, add it as an additional service in this same task.

- [ ] **Step 3: Add `recordProposalEvent` + `synthesizePullSuggestion` stubs on LearningBrainAgent**

In `src/main/brain/LearningBrainAgent.js`, add two methods (stubs in Plan 1, real logic in Plan 2):

```js
// Append to LearningBrainAgent.prototype (or class body):
async recordProposalEvent({ proposalId, kind }) {
  // TODO Plan 2: persist to learnerProfileManager for trigger-quality learning.
  // For Plan 1, just log.
  console.log('[brain] proposal event', { proposalId, kind });
}

async synthesizePullSuggestion() {
  // TODO Plan 2: synthesize via LLM based on current learner state.
  // For Plan 1, return a placeholder so the contract holds.
  return null;
}
```

- [ ] **Step 4: Smoke check that the app still boots**

Run: `npm run test:smoke`
Expected: PASS (no new boot crash patterns).

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/triggerBusHandlers.js src/main/main.ts src/main/brain/LearningBrainAgent.js
git commit -m "feat(brain-shell): IPC handlers + TriggerEmitter wiring + Brain stubs"
```

---

### Task 9: Extend brainApi.js for renderer

**Files:**
- Modify: `src/renderer/api/brainApi.js`

- [ ] **Step 1: Read the existing file head and tail to find the export shape**

Run: `cat src/renderer/api/brainApi.js | head -20 && echo '---' && tail -20 src/renderer/api/brainApi.js`
Expected: confirms `module.exports = brainApi` or `export default brainApi`.

- [ ] **Step 2: Add new methods to the `brainApi` object**

Inside the existing `brainApi` object, add these methods (location: after existing methods, before the export):

```js
  // ==================== Trigger Bus (shell) ====================
  /**
   * Subscribe to incoming Triggers from main.
   * @param {(trigger: import('../../commons/brain/triggerTypes').Trigger) => void} cb
   * @returns {() => void} unsubscribe
   */
  subscribeTriggers(cb) {
    const handler = (_evt, trigger) => cb(trigger);
    ipcRenderer?.on('brain:trigger:push', handler);
    return () => ipcRenderer?.removeListener?.('brain:trigger:push', handler);
  },

  /**
   * @param {string} proposalId
   */
  async acceptProposal(proposalId) {
    return ipcRenderer?.invoke('brain:trigger:accept', proposalId);
  },

  /**
   * @param {string} proposalId
   */
  async dismissProposal(proposalId) {
    return ipcRenderer?.invoke('brain:trigger:dismiss', proposalId);
  },

  /**
   * Pull a synthesized "what's next?" proposal when queue is empty.
   */
  async pullProposal() {
    return ipcRenderer?.invoke('brain:trigger:pull');
  },
```

- [ ] **Step 3: Smoke check**

Run: `npm run lint -- src/renderer/api/brainApi.js`
Expected: no errors (or only pre-existing ones).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/api/brainApi.js
git commit -m "feat(brain-shell): extend brainApi with trigger subscribe/accept/dismiss/pull"
```

---

## Phase C — BrainOrb

### Task 10: BrainOrb render test — 5 states

**Files:**
- Test: `src/__tests__/renderer/BrainOrb.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/renderer/BrainOrb.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BrainOrb from '../../renderer/components/brainShell/BrainOrb';

describe('BrainOrb', () => {
  test.each([
    ['idle', 'orb-idle'],
    ['thinking', 'orb-thinking'],
    ['has-proposal', 'orb-has-proposal'],
    ['mid-flow', 'orb-mid-flow'],
    ['uncertain', 'orb-uncertain'],
  ])('renders %s state with class %s', (state, cls) => {
    const { container } = render(<BrainOrb state={state} queueDepth={0} />);
    expect(container.querySelector(`.${cls}`)).toBeTruthy();
  });

  test('shows queue depth badge when > 1', () => {
    render(<BrainOrb state="has-proposal" queueDepth={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('hides badge when queueDepth <= 1', () => {
    render(<BrainOrb state="has-proposal" queueDepth={1} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('calls onClick when clicked (pull)', () => {
    const onClick = jest.fn();
    render(<BrainOrb state="idle" queueDepth={0} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /brain/i }));
    expect(onClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/__tests__/renderer/BrainOrb.test.jsx`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Commit failing test**

```bash
git add src/__tests__/renderer/BrainOrb.test.jsx
git commit -m "test(brain-shell): BrainOrb 5-state render tests (failing)"
```

---

### Task 11: BrainOrb implementation

**Files:**
- Create: `src/renderer/components/brainShell/BrainOrb.jsx`

- [ ] **Step 1: Write the component**

```jsx
// src/renderer/components/brainShell/BrainOrb.jsx
import React from 'react';
import { Box, Tooltip } from '@mui/material';

/**
 * BrainOrb — single ambient indicator reflecting Brain state.
 * Visual variants live in CSS classes (orb-{state}); design polish is
 * deliberately minimal here (qualifies as Layer-2 modality and will get
 * proper animation work in a follow-up).
 *
 * @param {object} props
 * @param {import('../../../commons/brain/triggerTypes').OrbState} props.state
 * @param {number} props.queueDepth
 * @param {() => void} [props.onClick]
 * @param {() => void} [props.onContextMenu]
 */
export default function BrainOrb({ state, queueDepth = 0, onClick, onContextMenu }) {
  const stateClass = `orb-${state}`;
  const label = `Brain — ${state}${queueDepth > 1 ? ` (${queueDepth} pending)` : ''}`;
  return (
    <Tooltip title={label} placement="bottom">
      <Box
        role="button"
        aria-label={label}
        tabIndex={0}
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={stateClass}
        sx={{
          position: 'relative',
          width: 24,
          height: 24,
          borderRadius: '50%',
          cursor: 'pointer',
          backgroundColor: {
            idle: '#c8c8c8',
            thinking: '#9bb8ff',
            'has-proposal': '#6c8cff',
            'mid-flow': '#4a6bff',
            uncertain: '#ffb14a',
          }[state] || '#c8c8c8',
          transition: 'background-color 200ms ease, transform 200ms ease',
          animation: {
            thinking: 'orb-pulse 1.4s ease-in-out infinite',
            'has-proposal': 'orb-bloom 0.6s ease-out',
            uncertain: 'orb-flicker 0.9s ease-in-out infinite',
          }[state] || 'none',
          '@keyframes orb-pulse': {
            '0%, 100%': { transform: 'scale(1)' },
            '50%': { transform: 'scale(1.15)' },
          },
          '@keyframes orb-bloom': {
            '0%': { transform: 'scale(1)' },
            '50%': { transform: 'scale(1.3)' },
            '100%': { transform: 'scale(1)' },
          },
          '@keyframes orb-flicker': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.6 },
          },
        }}
      >
        {queueDepth > 1 && (
          <Box
            role="status"
            sx={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 16,
              height: 16,
              borderRadius: '8px',
              backgroundColor: '#ff5252',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {queueDepth}
          </Box>
        )}
        {state === 'mid-flow' && (
          <Box
            sx={{
              position: 'absolute',
              top: -3,
              left: -3,
              right: -3,
              bottom: -3,
              borderRadius: '50%',
              border: '2px solid rgba(74,107,255,0.4)',
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx jest src/__tests__/renderer/BrainOrb.test.jsx`
Expected: PASS (8 cases — 5 from test.each + 3 specific).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/brainShell/BrainOrb.jsx
git commit -m "feat(brain-shell): BrainOrb component with 5 visual states"
```

---

### Task 12: useBrainState hook

**Files:**
- Create: `src/renderer/brain/useBrainState.js`

- [ ] **Step 1: Write the hook**

```js
// src/renderer/brain/useBrainState.js
import { useEffect, useState } from 'react';
import triggerBus from './triggerBus';

/**
 * useBrainState — exposes Orb state + queue snapshot from the singleton TriggerBus.
 * Initializes the bus on first call.
 *
 * @returns {{ orbState: import('../../commons/brain/triggerTypes').OrbState, queue: Array<import('../../commons/brain/triggerTypes').Proposal>, activeProposalId: string | null }}
 */
export default function useBrainState() {
  const [snapshot, setSnapshot] = useState(() => ({
    queue: triggerBus.getQueueSnapshot(),
    orbState: triggerBus.getOrbState(),
    activeProposalId: null,
  }));

  useEffect(() => {
    triggerBus.init();
    const unsub = triggerBus.subscribe(setSnapshot);
    return unsub;
  }, []);

  return snapshot;
}
```

- [ ] **Step 2: Smoke check (no test yet — covered by BrainShell test below)**

Run: `node -e "require('./src/renderer/brain/useBrainState.js')"` will fail because of JSX/React imports under raw Node. Skip — the hook is exercised by the BrainShell test.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/brain/useBrainState.js
git commit -m "feat(brain-shell): useBrainState hook bridges triggerBus to React"
```

---

## Phase D — BrainShell wrapper, ManualMenu, mount

### Task 13: ManualMenu component

**Files:**
- Create: `src/renderer/components/brainShell/ManualMenu.jsx`

- [ ] **Step 1: Write the component**

```jsx
// src/renderer/components/brainShell/ManualMenu.jsx
import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router-dom';

/**
 * ManualMenu — escape-hatch dropdown listing the 21 routes.
 * Always available regardless of Brain state.
 */
const ROUTES = [
  { label: 'Library Snapshot (old home)', path: '/library-home' },
  { label: 'Bookshelf', path: '/bookshelf' },
  { label: 'Bookmarks', path: '/bookmarks' },
  { label: 'Notes', path: '/notes' },
  { label: 'Chats', path: '/chats' },
  { label: 'Browser', path: '/browser' },
  { label: 'Vocabulary', path: '/vocabulary' },
  { label: 'Translate', path: '/translate' },
  { label: 'Writing', path: '/writing' },
  { label: 'Grammar', path: '/grammar' },
  { label: 'Quiz', path: '/quiz' },
  { label: 'MoodBoard', path: '/moodboard' },
  { label: 'Learn About', path: '/learnabout' },
  { label: 'Knowledge', path: '/knowledge' },
  { label: 'Study', path: '/study' },
  { label: 'Calendar', path: '/calendar' },
  { label: 'Learning Plan', path: '/learning' },
  { label: 'Settings', path: '/settings' },
];

export default function ManualMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();

  const open = (e) => setAnchorEl(e.currentTarget);
  const close = () => setAnchorEl(null);
  const go = (path) => {
    close();
    navigate(path);
  };

  return (
    <>
      <Tooltip title="Open route menu">
        <IconButton
          aria-label="manual route menu"
          onClick={open}
          size="small"
        >
          <MenuIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close}>
        {ROUTES.map((r) => (
          <MenuItem key={r.path} onClick={() => go(r.path)}>
            {r.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/brainShell/ManualMenu.jsx
git commit -m "feat(brain-shell): ManualMenu — dropdown of 21 routes"
```

> **Note:** Routes listed above match the directories under `src/renderer/views/`. Verify the route paths match what is actually registered in `src/renderer/main.jsx` before continuing — adjust the path strings if `main.jsx` uses different prefixes (`/reading/:id` vs `/reading`, etc.). For Plan 1 we only need the menu to *open* each section; deep links can be refined later.

---

### Task 14: FlowCoordinator stub (Atomic Chip only)

**Files:**
- Create: `src/renderer/components/brainShell/FlowCoordinator.jsx`

- [ ] **Step 1: Write the stub**

```jsx
// src/renderer/components/brainShell/FlowCoordinator.jsx
import React from 'react';
import AtomicChipHost from './AtomicChipHost';

/**
 * FlowCoordinator — routes an active Proposal to its Flow Unit host.
 * Plan 1: only `atomic-chip` is implemented; sequence and multi-surface
 * are deferred to Plan 2 (returns null with console.warn).
 *
 * @param {object} props
 * @param {import('../../../commons/brain/triggerTypes').Proposal | null} props.proposal
 */
export default function FlowCoordinator({ proposal }) {
  if (!proposal) return null;
  switch (proposal.unit) {
    case 'atomic-chip':
      return <AtomicChipHost proposal={proposal} />;
    case 'inline-sequence':
    case 'multi-surface-flow':
      // eslint-disable-next-line no-console
      console.warn('[FlowCoordinator] unit not yet implemented:', proposal.unit);
      return null;
    default:
      return null;
  }
}
```

- [ ] **Step 2: Commit (test follows after AtomicChipHost exists)**

```bash
git add src/renderer/components/brainShell/FlowCoordinator.jsx
git commit -m "feat(brain-shell): FlowCoordinator (atomic-chip only in Plan 1)"
```

---

### Task 15: AtomicChipHost

**Files:**
- Create: `src/renderer/components/brainShell/AtomicChipHost.jsx`

- [ ] **Step 1: Write the host**

```jsx
// src/renderer/components/brainShell/AtomicChipHost.jsx
import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Stack } from '@mui/material';
import triggerBus from '../../brain/triggerBus';

/**
 * AtomicChipHost — renders a single Atomic Chip Proposal.
 * The chip is anchored either inline at its surface target (paragraph CFI)
 * or globally as a floating chip in the bottom-right.
 *
 * Plan 1 uses the floating-global fallback only; in-place anchoring at
 * EPUB paragraph CFIs requires reader-integration and is deferred.
 *
 * @param {object} props
 * @param {import('../../../commons/brain/triggerTypes').Proposal} props.proposal
 */
export default function AtomicChipHost({ proposal }) {
  const [expanded, setExpanded] = useState(false);

  const dismiss = () => {
    triggerBus.dismiss(proposal.id);
    triggerBus.completeActive();
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        maxWidth: 360,
        p: 2,
        zIndex: 1300,
      }}
    >
      <Stack spacing={1}>
        <Typography variant="overline" sx={{ opacity: 0.6 }}>
          {proposal.source}
        </Typography>
        <Typography variant="body2">
          {proposal.payload?.title || 'New proposal from Brain'}
        </Typography>
        {expanded && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {proposal.payload?.body || JSON.stringify(proposal.payload, null, 2)}
          </Typography>
        )}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Less' : 'More'}
          </Button>
          <Button size="small" onClick={dismiss}>
            Dismiss
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/brainShell/AtomicChipHost.jsx
git commit -m "feat(brain-shell): AtomicChipHost (floating fallback variant)"
```

---

### Task 16: BrainShell composition test

**Files:**
- Test: `src/__tests__/renderer/BrainShell.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/__tests__/renderer/BrainShell.test.jsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let ipcOnHandlers = {};

beforeEach(() => {
  ipcOnHandlers = {};
  jest.resetModules();
  global.window = {
    electron: {
      ipcRenderer: {
        on: (channel, cb) => {
          ipcOnHandlers[channel] = cb;
        },
        removeListener: (channel) => {
          delete ipcOnHandlers[channel];
        },
        invoke: jest.fn().mockResolvedValue({ ok: true }),
      },
    },
  };
});

describe('BrainShell', () => {
  test('renders Orb in idle state when no triggers', () => {
    const BrainShell = require('../../renderer/components/brainShell/BrainShell').default;
    render(
      <MemoryRouter>
        <BrainShell>
          <div>child content</div>
        </BrainShell>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  test('renders manual menu button', () => {
    const BrainShell = require('../../renderer/components/brainShell/BrainShell').default;
    render(
      <MemoryRouter>
        <BrainShell>
          <div>child</div>
        </BrainShell>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/manual route menu/i)).toBeInTheDocument();
  });

  test('updates Orb to has-proposal when trigger pushed', () => {
    const BrainShell = require('../../renderer/components/brainShell/BrainShell').default;
    render(
      <MemoryRouter>
        <BrainShell>
          <div>child</div>
        </BrainShell>
      </MemoryRouter>,
    );
    expect(typeof ipcOnHandlers['brain:trigger:push']).toBe('function');
    act(() => {
      ipcOnHandlers['brain:trigger:push'](null, {
        id: 't1',
        source: 'phase-4-micro-card',
        unit: 'atomic-chip',
        surfaceTarget: { kind: 'global' },
        priority: 'normal',
        freshness: 60_000,
        emittedAt: Date.now(),
        payload: { title: 'Pick this up' },
      });
    });
    expect(screen.getByLabelText(/Brain — has-proposal/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx jest src/__tests__/renderer/BrainShell.test.jsx`
Expected: FAIL with `Cannot find module '../../renderer/components/brainShell/BrainShell'`.

- [ ] **Step 3: Commit failing test**

```bash
git add src/__tests__/renderer/BrainShell.test.jsx
git commit -m "test(brain-shell): BrainShell composition test (failing)"
```

---

### Task 17: BrainShell implementation

**Files:**
- Create: `src/renderer/components/brainShell/BrainShell.jsx`

- [ ] **Step 1: Write the wrapper**

```jsx
// src/renderer/components/brainShell/BrainShell.jsx
import React from 'react';
import { Box, AppBar, Toolbar, Typography } from '@mui/material';
import BrainOrb from './BrainOrb';
import ManualMenu from './ManualMenu';
import FlowCoordinator from './FlowCoordinator';
import useBrainState from '../../brain/useBrainState';
import triggerBus from '../../brain/triggerBus';

/**
 * BrainShell — top-level wrapper that gives the Brain a body in the UI.
 *
 * Layout:
 *   AppBar  →  [ManualMenu]  ...  [BrainOrb]
 *   <child content (the active route)>
 *   <FlowCoordinator (active Proposal renders here)>
 */
export default function BrainShell({ children }) {
  const { orbState, queue, activeProposalId } = useBrainState();
  const activeProposal = activeProposalId
    ? queue.find((p) => p.id === activeProposalId) || null
    : null;

  const onOrbClick = async () => {
    const top = queue[0];
    if (top) {
      await triggerBus.accept(top.id);
    } else {
      const synthesized = await triggerBus.pull();
      // eslint-disable-next-line no-console
      console.log('[BrainShell] pull result:', synthesized);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <ManualMenu />
          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: 16 }}>
            SmartReader
          </Typography>
          <BrainOrb
            state={orbState}
            queueDepth={queue.length}
            onClick={onOrbClick}
          />
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, position: 'relative' }}>{children}</Box>
      <FlowCoordinator proposal={activeProposal} />
    </Box>
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx jest src/__tests__/renderer/BrainShell.test.jsx`
Expected: PASS (3/3).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/brainShell/BrainShell.jsx
git commit -m "feat(brain-shell): BrainShell wrapper composes Orb + ManualMenu + FlowCoordinator"
```

---

### Task 18: Mount BrainShell at top of router tree

**Files:**
- Modify: `src/renderer/main.jsx`

- [ ] **Step 1: Read current router setup**

Run: `cat src/renderer/main.jsx`
Note the current `createHashRouter` configuration and where children are listed.

- [ ] **Step 2: Wrap the existing layout's element with `<BrainShell>`**

The router uses `Root` as the layout (`src/renderer/routes/root.jsx`). Edit `routes/root.jsx` — wrap its returned tree in `<BrainShell>`:

```jsx
// src/renderer/routes/root.jsx — at the top:
import BrainShell from '../components/brainShell/BrainShell';

// ...existing imports...

export default function Root() {
  // ...existing setup...
  return (
    <BrainShell>
      {/* existing Root content */}
      <Outlet />
    </BrainShell>
  );
}
```

The exact existing content of `Root` must be preserved — wrap *around* it, not *instead of* it. If `Root` already renders the AppBar/Layout, integrate `BrainShell` such that its AppBar replaces the existing one (or accept double-AppBar temporarily and document in a follow-up).

> **Caveat for the executing engineer:** the codebase's current `Root` shell may already have its own AppBar/navigation. Before mounting `BrainShell` as written, read `src/renderer/routes/root.jsx` in full and decide whether to: (a) replace the existing AppBar, (b) tuck the Orb into the existing AppBar instead of using `BrainShell`'s, or (c) keep both temporarily. Option (b) is preferred for minimum disruption — extract Orb + ManualMenu and inject into existing AppBar.

- [ ] **Step 3: Smoke test boot**

Run: `npm run test:smoke`
Expected: PASS, no new crash patterns.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/routes/root.jsx
git commit -m "feat(brain-shell): mount BrainShell at router root"
```

---

## Phase E — Phase 4 Migration (Proof)

### Task 19: MicroCardProposer emits Triggers

**Files:**
- Modify: `src/main/utils/MicroCardProposer.js`

- [ ] **Step 1: Read the current proposer**

Run: `grep -n "function\|class\|module.exports\|emit\|notify\|persistBrainNotifications" src/main/utils/MicroCardProposer.js | head -40`
Note the existing emit/dispatch surface.

- [ ] **Step 2: Accept `triggerEmitter` in constructor; emit Triggers**

Modify the proposer to receive a `triggerEmitter` in its constructor/factory and call `triggerEmitter.emit(...)` at the point where it currently signals a proposal. The exact location depends on the existing code — search for `proposal` or `propose` or `notify` in the file. The minimum addition:

```js
// In MicroCardProposer.js constructor:
constructor(deps) {
  // ...existing deps...
  this._triggerEmitter = deps.triggerEmitter || null;
}

// At the point a proposal is finalized:
_emitTrigger(proposal) {
  if (!this._triggerEmitter) return;
  this._triggerEmitter.emit({
    id: `phase4:para:${proposal.cfi || proposal.paragraphId}`,
    source: 'phase-4-micro-card',
    unit: 'atomic-chip',
    surfaceTarget: { kind: 'paragraph', cfi: proposal.cfi },
    priority: 'normal',
    freshness: 5 * 60 * 1000,
    payload: {
      title: proposal.title || proposal.term,
      body: proposal.body || proposal.snippet,
      term: proposal.term,
      cfi: proposal.cfi,
    },
  });
}
```

Call `_emitTrigger(proposal)` from the existing path that currently sends the proposal to the renderer.

- [ ] **Step 3: Wire `triggerEmitter` into the proposer in `main.ts`**

In `src/main/main.ts`, find where `MicroCardProposer` is instantiated. Pass `triggerEmitter` into it:

```ts
const microCardProposer = new MicroCardProposer({
  // ...existing args...
  triggerEmitter,
});
```

- [ ] **Step 4: Update or add a unit test that confirms emit happens**

Add to `src/__tests__/brain/triggerEmitter.test.js` (or a new `src/__tests__/learning/microCardProposer.trigger.test.js` if separation matters):

```js
test('MicroCardProposer emits phase-4 trigger via TriggerEmitter', () => {
  const send = jest.fn();
  const TriggerEmitter = require('../../main/brain/TriggerEmitter');
  const triggerEmitter = new TriggerEmitter({ getWebContents: () => ({ send }) });
  const MicroCardProposer = require('../../main/utils/MicroCardProposer');
  const proposer = new MicroCardProposer({
    // pass whatever minimal deps the constructor requires; mock as needed
    triggerEmitter,
  });
  proposer._emitTrigger({ cfi: 'cfi-a', title: 'Foo', body: 'bar', term: 'foo' });
  expect(send).toHaveBeenCalledWith(
    'brain:trigger:push',
    expect.objectContaining({
      id: 'phase4:para:cfi-a',
      source: 'phase-4-micro-card',
      unit: 'atomic-chip',
    }),
  );
});
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/brain/triggerEmitter.test.js`
Expected: PASS (all cases including the new one).

- [ ] **Step 6: Commit**

```bash
git add src/main/utils/MicroCardProposer.js src/main/main.ts src/__tests__/brain/triggerEmitter.test.js
git commit -m "feat(phase-4-migration): MicroCardProposer emits Triggers via TriggerEmitter"
```

---

### Task 20: Reader-side — wire AtomicChipHost to FlowCoordinator

**Files:**
- Modify: `src/renderer/views/reading/hooks/useMicroCardProposals.js`
- Modify: `src/renderer/views/reading/MicroCardChip.js`

- [ ] **Step 1: Inspect the existing hook**

Run: `cat src/renderer/views/reading/hooks/useMicroCardProposals.js`
Note how the hook currently surfaces proposals (likely via local state + direct `<MicroCardChip>` mount in the reader view).

- [ ] **Step 2: Decide migration shape**

For Plan 1 the **goal** is for Phase 4 proposals to flow through TriggerBus → AtomicChipHost (the global floating variant), not through the existing in-place chip mount. The simplest migration:

1. **Stop** local-state proposal dispatch in `useMicroCardProposals` (the chip render is now driven by the global FlowCoordinator).
2. **Keep** any in-reader-only side-effects (e.g., paragraph highlighting) since those are part of the Layer-2 modality, not the shell.

Edit the hook to no-op the chip render and add a comment explaining the migration:

```js
// In useMicroCardProposals.js — at the point where chip state is set:
// NOTE: Phase 4 proposals are now surfaced by the global Brain Trigger Bus
// via AtomicChipHost (see docs/superpowers/specs/2026-06-14-ai-driven-shell-design.md).
// Local chip dispatch is retained only for backwards-compat during migration; remove once acceptance test passes.
```

- [ ] **Step 3: Add the Plan-1 acceptance integration test (next task)**

(Task 21 covers it; this task just sets up the hook for it.)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/reading/hooks/useMicroCardProposals.js src/renderer/views/reading/MicroCardChip.js
git commit -m "refactor(phase-4-migration): wire micro-card chip render through global FlowCoordinator"
```

---

### Task 21: Phase 4 end-to-end integration test

**Files:**
- Create: `src/__tests__/integration/phase4-trigger-migration.integration.test.js`

- [ ] **Step 1: Write the test**

```js
// src/__tests__/integration/phase4-trigger-migration.integration.test.js
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let ipcOnHandlers = {};
const ipcInvoke = jest.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  ipcOnHandlers = {};
  jest.resetModules();
  global.window = {
    electron: {
      ipcRenderer: {
        on: (channel, cb) => { ipcOnHandlers[channel] = cb; },
        removeListener: (channel) => { delete ipcOnHandlers[channel]; },
        invoke: ipcInvoke,
      },
    },
  };
  ipcInvoke.mockClear();
});

test('Phase 4 trigger → BrainShell Orb blooms → user accepts → AtomicChipHost renders → dismiss removes', async () => {
  const BrainShell = require('../../renderer/components/brainShell/BrainShell').default;
  render(
    <MemoryRouter>
      <BrainShell>
        <div data-testid="route-content">reading view</div>
      </BrainShell>
    </MemoryRouter>,
  );

  // 1. Initially idle.
  expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument();

  // 2. Main process emits a Phase 4 trigger.
  act(() => {
    ipcOnHandlers['brain:trigger:push'](null, {
      id: 'phase4:para:cfi-1',
      source: 'phase-4-micro-card',
      unit: 'atomic-chip',
      surfaceTarget: { kind: 'paragraph', cfi: 'cfi-1' },
      priority: 'normal',
      freshness: 5 * 60 * 1000,
      emittedAt: Date.now(),
      payload: { title: 'Pick this up', body: 'definition snippet', term: 'foo' },
    });
  });

  // 3. Orb reflects has-proposal.
  expect(screen.getByLabelText(/Brain — has-proposal/)).toBeInTheDocument();

  // 4. Click the orb to accept (top of queue).
  await act(async () => {
    screen.getByLabelText(/Brain — has-proposal/).click();
  });

  // 5. IPC accept fired.
  expect(ipcInvoke).toHaveBeenCalledWith('brain:trigger:accept', 'phase4:para:cfi-1');

  // 6. AtomicChipHost is now rendered.
  expect(screen.getByText('Pick this up')).toBeInTheDocument();

  // 7. Dismiss the chip.
  await act(async () => {
    screen.getByRole('button', { name: /dismiss/i }).click();
  });
  expect(ipcInvoke).toHaveBeenCalledWith('brain:trigger:dismiss', 'phase4:para:cfi-1');
  expect(screen.queryByText('Pick this up')).toBeNull();
  expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest src/__tests__/integration/phase4-trigger-migration.integration.test.js`
Expected: PASS.

> **Known shimming concern:** `BrainShell` tracks `activeProposalId` via `triggerBus.accept(id)` which sets it inside the bus. `useBrainState` reflects it via `subscribe`. Verify the active proposal is rendered by `FlowCoordinator`. If the snapshot does not carry the full proposal object, fix the snapshot shape to include `activeProposal` directly. The Test 4 step (`AtomicChipHost is rendered`) is the canary — if it fails, that's the bug to fix.

- [ ] **Step 3: Fix the `activeProposal` snapshot — capture before dismissal**

The integration test will fail at the "AtomicChipHost is rendered" assertion because `accept()` dismisses the proposal from the queue before any consumer can read its payload. Fix by capturing the proposal *before* dismissal.

In `src/renderer/brain/triggerBus.js`:

Add a module-level internal field at the top, near `let activeProposalId = null;`:

```js
let _activeProposalSnapshot = null;
```

Replace `accept`:

```js
async function accept(proposalId) {
  const captured = queue.list().find((p) => p.id === proposalId) || null;
  const ipc = window.electron?.ipcRenderer;
  if (ipc) await ipc.invoke('brain:trigger:accept', proposalId);
  activeProposalId = proposalId;
  _activeProposalSnapshot = captured;
  queue.dismiss(proposalId);
  notify();
}
```

Replace `completeActive`:

```js
function completeActive() {
  activeProposalId = null;
  _activeProposalSnapshot = null;
  notify();
}
```

Replace `notify`:

```js
function notify() {
  const snapshot = {
    queue: queue.list(),
    orbState: getOrbState(),
    activeProposalId,
    activeProposal: _activeProposalSnapshot,
  };
  subscribers.forEach((cb) => {
    try { cb(snapshot); } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[triggerBus] subscriber error', e);
    }
  });
}
```

Then update `src/renderer/components/brainShell/BrainShell.jsx` to read `activeProposal` directly from the snapshot:

```jsx
const { orbState, queue, activeProposal } = useBrainState();
// remove the activeProposalId / queue.find(...) logic
// ...
<FlowCoordinator proposal={activeProposal} />
```

Re-run the integration test:

Run: `npx jest src/__tests__/integration/phase4-trigger-migration.integration.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/brain/triggerBus.js src/renderer/components/brainShell/BrainShell.jsx src/__tests__/integration/phase4-trigger-migration.integration.test.js
git commit -m "test(phase-4-migration): end-to-end trigger → Orb → Chip integration green"
```

---

## Phase F — Brain Dashboard (minimal)

### Task 22: Triage current home content — move to `/library-home`

**Files:**
- Modify: `src/renderer/main.jsx` (route registration)
- Move: existing home component from `/` to `/library-home`

- [ ] **Step 1: Read current home route registration**

Run: `grep -n 'home\|HomeView\|index.tsx' src/renderer/main.jsx`
Note the path it's registered under.

- [ ] **Step 2: Re-register the existing home component at `/library-home`**

Edit `src/renderer/main.jsx` to register the existing home component under `/library-home`:

```jsx
// In the createHashRouter children config, find the entry for `path: ''` or `path: '/'`.
// Change it from:
//   { path: '', element: <HomeView /> }
// to two entries:
{ path: '', element: <BrainDashboard /> },
{ path: 'library-home', element: <HomeView /> },
```

Make sure to import both `BrainDashboard` (next task creates it) and the existing `HomeView`.

- [ ] **Step 3: Commit (will break temporarily until BrainDashboard exists — that's Task 23)**

```bash
git add src/renderer/main.jsx
git commit -m "refactor(brain-shell): move existing home content to /library-home (BrainDashboard placeholder)"
```

---

### Task 23: BrainDashboard (minimal)

**Files:**
- Create: `src/renderer/views/brainDashboard/index.jsx`

- [ ] **Step 1: Write the dashboard**

```jsx
// src/renderer/views/brainDashboard/index.jsx
import React from 'react';
import { Box, Typography, Paper, Stack, Button, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useBrainState from '../../brain/useBrainState';
import triggerBus from '../../brain/triggerBus';

/**
 * BrainDashboard — minimal home replacement.
 * Surfaces Orb-narrated state, top-3 queue, and link to library snapshot.
 * Full Quest progress + Flow history are deferred to Plan 2.
 */
export default function BrainDashboard() {
  const { orbState, queue } = useBrainState();
  const navigate = useNavigate();

  const stateLine = {
    idle: 'Nothing pressing — you can pick a book or pull a suggestion.',
    thinking: 'Brain is computing…',
    'has-proposal': `You have ${queue.length} proposal${queue.length === 1 ? '' : 's'} ready.`,
    'mid-flow': 'You are in the middle of a flow.',
    uncertain: 'Brain has several proposals and is deciding which to surface first.',
  }[orbState] || '';

  return (
    <Box sx={{ p: 4, maxWidth: 880, margin: '0 auto' }}>
      <Typography variant="h4" sx={{ mb: 1 }}>Brain Dashboard</Typography>
      <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
        {stateLine}
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Pending Proposals</Typography>
        {queue.length === 0 ? (
          <Typography color="text.secondary">No pending proposals.</Typography>
        ) : (
          <Stack spacing={1}>
            {queue.slice(0, 3).map((p) => (
              <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip size="small" label={p.priority} />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {p.source}: {p.payload?.title || p.id}
                </Typography>
                <Button size="small" onClick={() => triggerBus.accept(p.id)}>Do now</Button>
                <Button size="small" onClick={() => triggerBus.dismiss(p.id)}>Skip</Button>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            Looking for the old home view (stats, quick actions)?
          </Typography>
          <Button onClick={() => navigate('/library-home')}>Library Snapshot</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
```

- [ ] **Step 2: Smoke test boot**

Run: `npm run test:smoke`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/views/brainDashboard/index.jsx
git commit -m "feat(brain-shell): BrainDashboard (minimal) replaces home route"
```

---

### Task 24: BrainDashboard test

**Files:**
- Test: `src/__tests__/renderer/BrainDashboard.test.jsx`

- [ ] **Step 1: Write the test**

```jsx
// src/__tests__/renderer/BrainDashboard.test.jsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let ipcOnHandlers = {};

beforeEach(() => {
  ipcOnHandlers = {};
  jest.resetModules();
  global.window = {
    electron: {
      ipcRenderer: {
        on: (channel, cb) => { ipcOnHandlers[channel] = cb; },
        removeListener: (channel) => { delete ipcOnHandlers[channel]; },
        invoke: jest.fn().mockResolvedValue({ ok: true }),
      },
    },
  };
});

test('BrainDashboard renders idle state-line when empty', () => {
  const BrainDashboard = require('../../renderer/views/brainDashboard').default;
  render(
    <MemoryRouter>
      <BrainDashboard />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Nothing pressing/)).toBeInTheDocument();
  expect(screen.getByText(/No pending proposals/)).toBeInTheDocument();
});

test('BrainDashboard lists queued proposals when triggers fire', () => {
  const BrainDashboard = require('../../renderer/views/brainDashboard').default;
  render(
    <MemoryRouter>
      <BrainDashboard />
    </MemoryRouter>,
  );
  act(() => {
    ipcOnHandlers['brain:trigger:push'](null, {
      id: 't1',
      source: 'phase-4-micro-card',
      unit: 'atomic-chip',
      surfaceTarget: { kind: 'global' },
      priority: 'high',
      freshness: 60_000,
      emittedAt: Date.now(),
      payload: { title: 'Pick this up' },
    });
  });
  expect(screen.getByText(/phase-4-micro-card: Pick this up/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run**

Run: `npx jest src/__tests__/renderer/BrainDashboard.test.jsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/renderer/BrainDashboard.test.jsx
git commit -m "test(brain-shell): BrainDashboard renders state-line + queue"
```

---

## Phase G — Final Verification

### Task 25: Run all unit + integration tests

- [ ] **Step 1: Unit tests**

Run: `npm test -- --testPathIgnorePatterns=integration`
Expected: all green; no new failures vs. baseline. If pre-existing failures show up, note them in the commit message but don't block.

- [ ] **Step 2: Integration tests**

Run: `npm run test:integration`
Expected: all green, including new `phase4-trigger-migration.integration.test.js`.

- [ ] **Step 3: Smoke test**

Run: `npm run test:smoke`
Expected: PASS, no new boot-crash patterns.

- [ ] **Step 4: Commit (only if any test files needed adjustment in this verification pass)**

```bash
git add -p   # selectively
git commit -m "test: stabilize after brain-shell skeleton + Phase 4 migration"
```

---

### Task 26: Manual UI walkthrough

> Auto mode does not exempt UI verification — the implementing engineer must use the feature in a browser before declaring done.

- [ ] **Step 1: Launch dev**

Run (two terminals):
- Terminal 1: `npm run start:renderer`
- Terminal 2: `npm run start:main`

Or single: `npm start`

- [ ] **Step 2: Visual checks**

Verify each:
- [ ] App boots; new home is BrainDashboard with "Nothing pressing" state-line.
- [ ] BrainOrb visible in top-right of AppBar; idle gray.
- [ ] ManualMenu (hamburger) opens; clicking a route navigates to it.
- [ ] `/library-home` shows the old home content.
- [ ] Open a book → Phase 4 trigger fires (read a paragraph long enough to cross the proposer threshold) → Orb blooms blue with badge if queue grew.
- [ ] Click the Orb → AtomicChipHost appears (floating bottom-right) with the proposal payload.
- [ ] Click Dismiss → chip disappears, Orb returns to idle.
- [ ] Right-click the Orb → (Plan 1: no menu yet — verified no JS crash; Plan 2 adds Quest progress).

- [ ] **Step 3: Document any issues found**

For each issue: file path, description, severity. Do NOT fix during this pass — file as follow-ups.

---

### Task 27: Final cleanup + documentation

**Files:**
- Modify: `CLAUDE.md` (one new paragraph)

- [ ] **Step 1: Add a short paragraph to CLAUDE.md under the Brain-Driven Learning Loops section**

Add immediately after the existing Phase 8c row in the table:

```markdown
## AI-Driven Shell (Plan 1 — skeleton)

A reactive shell layer landed in 2026-06 wraps all routes in a `BrainShell` (`src/renderer/components/brainShell/`). Phase 4–8 services emit Triggers via `TriggerEmitter` (`src/main/brain/TriggerEmitter.js`); the renderer `triggerBus` enqueues them as Proposals and the `BrainOrb` reflects state in the AppBar. Only Phase 4 (micro-card → Atomic Chip) is migrated in Plan 1; Plan 2 adds Inline Sequence + Multi-Surface Flow + Quest layer + migration of Phase 5–8 trigger sources. See [`docs/superpowers/specs/2026-06-14-ai-driven-shell-design.md`](docs/superpowers/specs/2026-06-14-ai-driven-shell-design.md) for the full design and [`CONTEXT.md`](CONTEXT.md) for the glossary.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document AI-driven shell skeleton (Plan 1) in CLAUDE.md"
```

---

## Verifiable Success Criteria (Plan 1 scope only)

After Task 27, the following must be true:

- [ ] **`npm test` passes** including the new `proposalQueue.test.js`, `triggerBus.test.js`, `triggerEmitter.test.js`, `BrainOrb.test.jsx`, `BrainShell.test.jsx`, `BrainDashboard.test.jsx`.
- [ ] **`npm run test:integration` passes** including `phase4-trigger-migration.integration.test.js`.
- [ ] **`npm run test:smoke` passes** — no new boot-crash patterns.
- [ ] **Manual walkthrough (Task 26) — every checkbox green.**
- [ ] **No regression in existing Phase 4 micro-card flow** — proposals still surface; the rendering path is just different.
- [ ] **All 21 routes still reachable** via the ManualMenu dropdown.
- [ ] **The current home route shows BrainDashboard;** old home content is at `/library-home`.

## What's Explicitly Out of Plan 1

- Inline Sequence Host
- Multi-Surface Flow Host (and the top strip)
- Quest data model, persistence, IPC
- Quest-aware trigger weighting
- Phase 5, 6, 7, 8a, 8b, 8c migration to TriggerEmitter
- `tutorContext.js` reading Orb state
- "uncertain" Orb state visual polish (basic flicker only)
- In-place anchored Atomic Chip at paragraph CFI (using floating-global only)
- Main-process queue snapshot persistence across launches
- Animation-core integration for Orb transitions

These are Plan 2 scope.

## Risk Notes for the Implementing Engineer

1. **`Root` shell integration** (Task 18 caveat) is the most architecture-sensitive step. If the existing root layout conflicts with `BrainShell`, choose option (b) from Task 18: inject Orb + ManualMenu into the existing AppBar rather than replacing it. Document the decision in the commit message.
2. **`MicroCardProposer` emit point** (Task 19) requires reading the existing proposer carefully. The proposer may already dispatch through a different channel (e.g., directly to renderer). Add the new emit *alongside* the existing path first, verify the integration test passes, then remove the old path in a follow-up commit. This avoids a regression window.
3. **`activeProposal` snapshot bug** (Task 21 Step 3) is anticipated — the queue dismisses the accepted proposal, so the active flow loses its payload unless captured separately. The fix is documented inline.
4. **Auto mode does not remove the UI walkthrough requirement** (Task 26). UI features cannot be claimed complete without a browser verification pass.
