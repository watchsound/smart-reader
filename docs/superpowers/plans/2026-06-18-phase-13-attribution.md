# Phase 13 — Attribution Layer (LLM ROI Surface) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add two attribution columns to `mastery_event` (`proximate_call_id`, `feature_surface`); instrument every mastery write path; build `AttributionService` (3 aggregation methods); restructure `EconomicsPanel` → "Spend & Returns" with new **ROI** tab as default; preserve Spend + Sessions tabs.

**Architecture:** The premise is that *we don't measure spend, we measure returns*. The Attribution panel joins `brain_call_ledger ⋈ mastery_event` and surfaces **cost-per-mastery-move** by lens (L3 attention-state default → L2 phase toggle → L1 intent drill-down). Hybrid attribution: strict FK (`proximate_call_id`) where causation is direct; amortized cost (`surface_spend / surface_events`) where chained. Non-LLM and pre-Phase-12 events appear as "Untracked (historical)" $0 baseline.

**Tech Stack:** Node + better-sqlite3 + React + MUI. No new deps. Reuse Phase 9 `RationaleCard` for drill-down call detail.

**Conventions:**
- Run single test with `npx jest <path> --no-coverage`.
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit ...`.
- Don't write git config; don't skip pre-commit hooks.
- Stay on `main`; no destructive git ops.
- Use `window.electron.ipcRenderer` in renderer API files (NOT `require('electron')` — webpack `__dirname` bug).
- Smoke-check after main-process changes with `npm run test:smoke`.

**Spec:** [`docs/superpowers/specs/2026-06-18-phase-13-attribution-design.md`](../specs/2026-06-18-phase-13-attribution-design.md)

---

## File Map

**Create**
- `src/main/db/masteryEventEnums.js` — closed `featureSurface` enum + `ATTENTION_STATE` map
- `src/main/utils/AttributionService.js` — aggregation service (3 methods)
- `src/main/ipc/attributionHandlers.js` — 3 IPC handlers
- `src/renderer/api/attributionApi.js` — IPC client
- `src/renderer/components/brainShell/spendReturns/SpendReturnsPanel.jsx` — restructured panel
- `src/renderer/components/brainShell/spendReturns/tabs/ROITab.jsx`
- `src/renderer/components/brainShell/spendReturns/tabs/SpendTab.jsx`
- `src/renderer/components/brainShell/spendReturns/tabs/SessionsTab.jsx` — extracted from existing
- `src/renderer/components/brainShell/spendReturns/components/AttributionBarChart.jsx`
- `src/renderer/components/brainShell/spendReturns/components/LensToggle.jsx`
- `src/renderer/components/brainShell/spendReturns/components/BrushableDensityStrip.jsx`
- `src/renderer/components/brainShell/spendReturns/components/GroupDetailDrawer.jsx`
- `src/renderer/components/brainShell/spendReturns/components/AmortizedBadge.jsx`
- `src/__tests__/db/masteryEventEnums.test.js`
- `src/__tests__/utils/AttributionService.test.js`
- `src/__tests__/ipc/attributionHandlers.test.js`
- `src/__tests__/renderer/attributionApi.test.js`
- `src/__tests__/integration/attributionHappyPath.test.js`

**Modify**
- `db.sql` — `ALTER`-equivalent: drop+recreate is the project's pattern, but `mastery_event` was just added in Phase 12; we extend its CREATE block in-place
- `src/main/db/MasteryEventStore.js` — `record()` accepts `proximateCallId` + `featureSurface`; column list extended
- `src/main/brain/director/SessionRunner.js:252` — add `featureSurface` + `proximateCallId`
- `src/main/db/LearningPointManager.js:608` — add `featureSurface: 'production-prompt'` + caller-supplied `proximateCallId`
- `src/main/db/LearningPointManager.js:1050` — add `featureSurface: 'manual-review'`
- `src/main/utils/MasteryEventBackfill.js` — add `featureSurface: 'backfill'` to all 4 sites
- `src/main/utils/ComprehensionGradingService.js` — NEW `mastery_event` write on grade-induced mastery move
- `src/main/utils/MicroCardProposer.js` — NEW `mastery_event` write on accept
- `src/main/main.ts` — register attribution IPC handlers
- `src/renderer/components/brainShell/EconomicsPanel.jsx` — replaced by SpendReturnsPanel; thin shim re-export for compat
- Wherever `EconomicsPanel` is mounted (likely `BrainDashboardPanel`) — switch import to `SpendReturnsPanel` after Task 14

---

### Task 1: Schema — extend `mastery_event` with attribution columns

**Files:** Modify: `db.sql`

- [ ] **Step 1: Find the existing `mastery_event` block**

Run: `grep -n "CREATE TABLE \"mastery_event\"" db.sql`
Expected: returns one line number (Phase 12 added it).

- [ ] **Step 2: Add two columns + two indices**

In `db.sql`, replace the `mastery_event` CREATE TABLE block with:

```sql
CREATE TABLE "mastery_event" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "learning_point_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "ts" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "prev_box" INTEGER,
  "new_box" INTEGER,
  "prev_mastery" REAL,
  "new_mastery" REAL,
  "rating" TEXT,
  "source" TEXT NOT NULL,
  "source_ref" TEXT,
  "notes" TEXT,
  "proximate_call_id" INTEGER,
  "feature_surface" TEXT NOT NULL DEFAULT 'unknown',
  FOREIGN KEY ("learning_point_id") REFERENCES "learning_point" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("proximate_call_id") REFERENCES "brain_call_ledger" ("id") ON DELETE SET NULL
);
CREATE INDEX "idx_mastery_event_lp_ts" ON "mastery_event" ("learning_point_id", "ts");
CREATE INDEX "idx_mastery_event_user_ts" ON "mastery_event" ("user_id", "ts");
CREATE INDEX "idx_mastery_event_surface_ts" ON "mastery_event" ("feature_surface", "ts");
CREATE INDEX "idx_mastery_event_proximate_call" ON "mastery_event" ("proximate_call_id")
  WHERE "proximate_call_id" IS NOT NULL;
CREATE UNIQUE INDEX "idx_mastery_event_dedup" ON "mastery_event" (
  "learning_point_id", "ts", "event_type", COALESCE("source_ref", '')
);
```

- [ ] **Step 3: Verify the SQL parses**

Run:
```bash
node -e "const fs=require('fs');const sql=fs.readFileSync('db.sql','utf8');const Database=require('better-sqlite3');const db=new Database(':memory:');db.exec(sql);const cols=db.prepare(\"PRAGMA table_info('mastery_event')\").all();console.log(cols.filter(c=>['proximate_call_id','feature_surface'].includes(c.name)));"
```
Expected: two rows shown, `feature_surface` with `dflt_value: \"'unknown'\"`, `proximate_call_id` nullable INTEGER.

- [ ] **Step 4: Commit**
```bash
git add db.sql
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): mastery_event attribution columns + indices"
```

---

### Task 2: Closed enum + attention-state map (contract task)

**Files:**
- Create: `src/main/db/masteryEventEnums.js`
- Create: `src/__tests__/db/masteryEventEnums.test.js`

- [ ] **Step 1: Write the failing test**

`src/__tests__/db/masteryEventEnums.test.js`:
```js
const {
  FEATURE_SURFACES,
  ATTENTION_STATE,
  PHASE_GROUP,
  isValidFeatureSurface,
} = require('../../main/db/masteryEventEnums');

describe('masteryEventEnums', () => {
  it('exports closed feature_surface enum with 8 values', () => {
    expect(FEATURE_SURFACES).toEqual([
      'reading-microcard',
      'director-session',
      'comprehension',
      'production-prompt',
      'pre-reading-diagnostic',
      'manual-review',
      'backfill',
      'unknown',
    ]);
  });

  it('maps every feature_surface to an attention-state', () => {
    FEATURE_SURFACES.forEach((s) => {
      expect(['while-reading', 'focused-session', 'historical']).toContain(ATTENTION_STATE[s]);
    });
  });

  it('maps every feature_surface to a phase group', () => {
    FEATURE_SURFACES.forEach((s) => {
      expect(typeof PHASE_GROUP[s]).toBe('string');
      expect(PHASE_GROUP[s].length).toBeGreaterThan(0);
    });
  });

  it('isValidFeatureSurface returns true for enum values, false otherwise', () => {
    expect(isValidFeatureSurface('director-session')).toBe(true);
    expect(isValidFeatureSurface('not-a-thing')).toBe(false);
    expect(isValidFeatureSurface(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Verify it fails**

Run: `npx jest src/__tests__/db/masteryEventEnums.test.js --no-coverage`
Expected: `Cannot find module '../../main/db/masteryEventEnums'`.

- [ ] **Step 3: Implement**

`src/main/db/masteryEventEnums.js`:
```js
/**
 * Closed feature_surface enum + attention-state and phase-group lenses
 * for Phase 13 Attribution Layer. Any new mastery-write site must add
 * its feature_surface here AND choose the right attention-state.
 * The 'unknown' value exists only as a lint guard — it should never be
 * written intentionally; tests fail the build if a mastery_event row
 * lands with feature_surface='unknown'.
 */

const FEATURE_SURFACES = [
  'reading-microcard',
  'director-session',
  'comprehension',
  'production-prompt',
  'pre-reading-diagnostic',
  'manual-review',
  'backfill',
  'unknown',
];

const ATTENTION_STATE = {
  'reading-microcard': 'while-reading',
  'pre-reading-diagnostic': 'while-reading',
  'director-session': 'focused-session',
  'comprehension': 'focused-session',
  'production-prompt': 'focused-session',
  'manual-review': 'focused-session',
  'backfill': 'historical',
  'unknown': 'historical',
};

const PHASE_GROUP = {
  'reading-microcard': 'reading-loop',
  'pre-reading-diagnostic': 'diagnostics',
  'director-session': 'director',
  'comprehension': 'comprehension',
  'production-prompt': 'production-prompts',
  'manual-review': 'manual-review',
  'backfill': 'historical',
  'unknown': 'historical',
};

const isValidFeatureSurface = (s) => FEATURE_SURFACES.includes(s);

module.exports = { FEATURE_SURFACES, ATTENTION_STATE, PHASE_GROUP, isValidFeatureSurface };
```

- [ ] **Step 4: Test passes**

Run: `npx jest src/__tests__/db/masteryEventEnums.test.js --no-coverage`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**
```bash
git add src/main/db/masteryEventEnums.js src/__tests__/db/masteryEventEnums.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): feature_surface enum + attention/phase lens maps"
```

---

### Task 3: `MasteryEventStore.record()` accepts new fields

**Files:**
- Modify: `src/main/db/MasteryEventStore.js`
- Modify: `src/__tests__/db/MasteryEventStore.test.js` (likely exists; if not, create)

- [ ] **Step 1: Add the failing test**

Append to `src/__tests__/db/MasteryEventStore.test.js` (or create with standard `freshDb()` helper if missing):

```js
describe('record() — Phase 13 attribution', () => {
  it('persists proximate_call_id and feature_surface when supplied', () => {
    freshDb();
    // Insert a real call_ledger row so FK is satisfied
    const callId = dbManager.getDb().prepare(`
      INSERT INTO brain_call_ledger (intent, ts, provider, cost_usd, cache_hit)
      VALUES ('director-session-step', ?, 'deepseek', 0.0042, 0)
    `).run(Date.now()).lastInsertRowid;

    MasteryEventStore.record({
      learningPointId: 'lp-1',
      userId: 1,
      ts: Date.now(),
      eventType: 'review',
      source: 'director-session',
      sourceRef: 'trace-xyz',
      featureSurface: 'director-session',
      proximateCallId: callId,
    });

    const row = dbManager.getDb().prepare(
      `SELECT proximate_call_id, feature_surface FROM mastery_event WHERE learning_point_id='lp-1'`
    ).get();
    expect(row.feature_surface).toBe('director-session');
    expect(row.proximate_call_id).toBe(callId);
  });

  it('defaults feature_surface to "unknown" if omitted (lint guard)', () => {
    freshDb();
    MasteryEventStore.record({
      learningPointId: 'lp-2',
      userId: 1,
      ts: Date.now(),
      eventType: 'review',
      source: 'legacy',
    });
    const row = dbManager.getDb().prepare(
      `SELECT feature_surface FROM mastery_event WHERE learning_point_id='lp-2'`
    ).get();
    expect(row.feature_surface).toBe('unknown');
  });
});
```

(If the test file doesn't yet exist, scaffold using the Phase 12 `masteryTrajectoryHappyPath.test.js` `freshDb()` pattern: drop+recreate from `db.sql`.)

- [ ] **Step 2: Verify it fails**

Run: `npx jest src/__tests__/db/MasteryEventStore.test.js --no-coverage`
Expected: fails — current INSERT doesn't include the two new columns.

- [ ] **Step 3: Update `MasteryEventStore.record()`**

In `src/main/db/MasteryEventStore.js`, replace the INSERT in `record()` with:

```js
function record(ev) {
  const db = dbManager.getDb();
  try {
    db.prepare(`
      INSERT INTO mastery_event
        (learning_point_id, user_id, ts, event_type,
         prev_box, new_box, prev_mastery, new_mastery,
         rating, source, source_ref, notes,
         proximate_call_id, feature_surface)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ev.learningPointId, ev.userId, ev.ts, ev.eventType,
      ev.prevBox    ?? null, ev.newBox     ?? null,
      ev.prevMastery ?? null, ev.newMastery ?? null,
      ev.rating     ?? null, ev.source,
      ev.sourceRef  ?? null, ev.notes      ?? null,
      ev.proximateCallId ?? null,
      ev.featureSurface  ?? 'unknown',
    );
  } catch (e) {
    if (/UNIQUE constraint failed/i.test(e.message)) return;
    throw e;
  }
}
```

Also update the JSDoc comment to document the two new optional fields.

- [ ] **Step 4: Test passes**

Run: `npx jest src/__tests__/db/MasteryEventStore.test.js --no-coverage`
Expected: all `record()` tests pass, including the 2 new ones.

- [ ] **Step 5: Commit**
```bash
git add src/main/db/MasteryEventStore.js src/__tests__/db/MasteryEventStore.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): MasteryEventStore.record accepts attribution fields"
```

---

### Task 4: `AttributionService` interface contract (no impl)

**Files:**
- Create: `src/main/utils/AttributionService.js` (skeleton only — methods throw `not implemented`)
- Create: `src/__tests__/utils/AttributionService.test.js` (contract test only — verifies shape)

- [ ] **Step 1: Write the contract test**

`src/__tests__/utils/AttributionService.test.js`:
```js
const AttributionService = require('../../main/utils/AttributionService');

describe('AttributionService — contract', () => {
  it('exports a class with three async methods', () => {
    const svc = new AttributionService();
    expect(typeof svc.getBars).toBe('function');
    expect(typeof svc.getGroupDetail).toBe('function');
    expect(typeof svc.getDensityStrip).toBe('function');
  });

  it('every method returns a Promise', () => {
    const svc = new AttributionService();
    const args = { lens: 'attention', from: 0, to: Date.now(), userId: 1 };
    expect(svc.getBars(args).catch(() => {})).toBeInstanceOf(Promise);
    expect(svc.getGroupDetail({ ...args, groupKey: 'x' }).catch(() => {})).toBeInstanceOf(Promise);
    expect(svc.getDensityStrip({ userId: 1 }).catch(() => {})).toBeInstanceOf(Promise);
  });
});
```

- [ ] **Step 2: Verify it fails**

Run: `npx jest src/__tests__/utils/AttributionService.test.js --no-coverage`
Expected: `Cannot find module`.

- [ ] **Step 3: Create skeleton**

`src/main/utils/AttributionService.js`:
```js
/**
 * AttributionService — joins brain_call_ledger ⋈ mastery_event to surface
 * cost-per-mastery-move grouped by lens (attention-state / phase / intent).
 *
 * Three methods power the Spend & Returns → ROI tab:
 *   getBars         — top-level bars for selected lens + window
 *   getGroupDetail  — drill-down: events + proximate calls for one group
 *   getDensityStrip — daily mastery_event count for the brushable timeline
 */

const dbManager = require('../db/dbManager');
const { ATTENTION_STATE, PHASE_GROUP } = require('../db/masteryEventEnums');

class AttributionService {
  /**
   * @param {object} opts
   * @param {'attention'|'phase'|'intent'} opts.lens
   * @param {number} opts.from   epoch ms inclusive
   * @param {number} opts.to     epoch ms exclusive
   * @param {number} opts.userId
   * @returns {Promise<Array<{
   *   groupKey: string,
   *   groupLabel: string,
   *   eventCount: number,
   *   totalCostUsd: number,
   *   costPerEvent: number,
   *   directlyAttributedCount: number,
   *   amortizedCount: number,
   * }>>}
   */
  async getBars(_opts) {
    throw new Error('AttributionService.getBars: not implemented (Task 5)');
  }

  /**
   * @param {object} opts
   * @param {'attention'|'phase'|'intent'} opts.lens
   * @param {string} opts.groupKey  the bar that was clicked
   * @param {number} opts.from
   * @param {number} opts.to
   * @param {number} opts.userId
   * @param {number} [opts.limit=50]
   * @returns {Promise<{
   *   group: { key: string, label: string, totalCostUsd: number, eventCount: number },
   *   events: Array<{
   *     learningPointId: string,
   *     ts: number,
   *     featureSurface: string,
   *     proximateCallId: number|null,
   *     intent: string|null,
   *     eventCostUsd: number,
   *     amortized: boolean,
   *   }>
   * }>}
   */
  async getGroupDetail(_opts) {
    throw new Error('AttributionService.getGroupDetail: not implemented (Task 6)');
  }

  /**
   * @param {object} opts
   * @param {number} opts.userId
   * @returns {Promise<Array<{ day: string, count: number }>>}  // day = 'YYYY-MM-DD' UTC
   */
  async getDensityStrip(_opts) {
    throw new Error('AttributionService.getDensityStrip: not implemented (Task 7)');
  }
}

module.exports = AttributionService;
```

- [ ] **Step 4: Test passes**

Run: `npx jest src/__tests__/utils/AttributionService.test.js --no-coverage`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/AttributionService.js src/__tests__/utils/AttributionService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): AttributionService contract"
```

---

### Task 5: `AttributionService.getBars` implementation

**Files:**
- Modify: `src/main/utils/AttributionService.js`
- Modify: `src/__tests__/utils/AttributionService.test.js`

- [ ] **Step 1: Add failing tests**

Append a `describe('getBars', ...)` block with three cases:

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbManager = require('../../main/db/dbManager');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  dbManager.__setDb(db);
  return db;
}

function insertCall(db, intent, costUsd, ts) {
  return db.prepare(`
    INSERT INTO brain_call_ledger (intent, ts, provider, cost_usd, cache_hit)
    VALUES (?, ?, 'deepseek', ?, 0)
  `).run(intent, ts, costUsd).lastInsertRowid;
}

function insertEvent(db, lpId, ts, surface, callId = null) {
  // Ensure the learning_point row exists (FK)
  db.prepare(`INSERT OR IGNORE INTO learning_point (id, user_id, term, domain_type)
              VALUES (?, 1, ?, 'vocabulary')`).run(lpId, lpId);
  db.prepare(`
    INSERT INTO mastery_event
      (learning_point_id, user_id, ts, event_type, source,
       feature_surface, proximate_call_id)
    VALUES (?, 1, ?, 'review', 'test', ?, ?)
  `).run(lpId, ts, surface, callId);
}

describe('getBars', () => {
  it('returns 3 bars for lens=attention with correct counts', async () => {
    const db = freshDb();
    const ts = Date.now();
    const callA = insertCall(db, 'director-session-step', 0.01, ts);
    insertEvent(db, 'lp-a', ts, 'director-session', callA);  // focused-session
    insertEvent(db, 'lp-b', ts, 'reading-microcard');          // while-reading (amortized)
    insertEvent(db, 'lp-c', ts, 'backfill');                   // historical

    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'attention', from: ts - 1000, to: ts + 1000, userId: 1,
    });
    const byKey = Object.fromEntries(bars.map((b) => [b.groupKey, b]));
    expect(byKey['focused-session'].eventCount).toBe(1);
    expect(byKey['focused-session'].totalCostUsd).toBeCloseTo(0.01);
    expect(byKey['while-reading'].eventCount).toBe(1);
    expect(byKey['historical'].eventCount).toBe(1);
    expect(byKey['historical'].totalCostUsd).toBe(0);
  });

  it('amortizes cost across surfaces without proximate_call_id', async () => {
    const db = freshDb();
    const ts = Date.now();
    // Two reading-microcard events; two extract calls in same window
    insertCall(db, 'extract-learning-points', 0.04, ts);
    insertCall(db, 'extract-learning-points', 0.06, ts);
    insertEvent(db, 'lp-a', ts, 'reading-microcard');
    insertEvent(db, 'lp-b', ts, 'reading-microcard');

    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'phase', from: ts - 1000, to: ts + 1000, userId: 1,
    });
    const readingLoop = bars.find((b) => b.groupKey === 'reading-loop');
    // Both calls' cost amortized across both events: $0.10 / 2 = $0.05/move
    expect(readingLoop.totalCostUsd).toBeCloseTo(0.10);
    expect(readingLoop.costPerEvent).toBeCloseTo(0.05);
    expect(readingLoop.amortizedCount).toBe(2);
    expect(readingLoop.directlyAttributedCount).toBe(0);
  });

  it('filters by [from, to) window', async () => {
    const db = freshDb();
    insertEvent(db, 'lp-a', 1000, 'director-session');
    insertEvent(db, 'lp-b', 5000, 'director-session');
    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'attention', from: 2000, to: 6000, userId: 1,
    });
    expect(bars.find((b) => b.groupKey === 'focused-session').eventCount).toBe(1);
  });
});
```

- [ ] **Step 2: Verify failures**

Run: `npx jest src/__tests__/utils/AttributionService.test.js --no-coverage`
Expected: 3 new tests fail with "not implemented" errors.

- [ ] **Step 3: Implement `getBars`**

Replace the throwing `getBars` body with:

```js
async getBars({ lens, from, to, userId }) {
  const db = dbManager.getDb();

  // Pull all events in window, joined with their proximate call's cost + intent.
  const rows = db.prepare(`
    SELECT
      e.id, e.feature_surface AS surface, e.proximate_call_id AS callId,
      c.cost_usd AS proximateCost,
      c.intent  AS intent
    FROM mastery_event e
    LEFT JOIN brain_call_ledger c ON c.id = e.proximate_call_id
    WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ?
  `).all(userId, from, to);

  // For amortization: pull all ledger rows in window, by intent, totals.
  const intentSpendRows = db.prepare(`
    SELECT intent, SUM(cost_usd) AS total
    FROM brain_call_ledger
    WHERE ts >= ? AND ts < ?
    GROUP BY intent
  `).all(from, to);
  const intentSpend = Object.fromEntries(intentSpendRows.map((r) => [r.intent, r.total || 0]));

  // Count events per surface (used by amortization denominators)
  const surfaceCounts = {};
  rows.forEach((r) => {
    surfaceCounts[r.surface] = (surfaceCounts[r.surface] || 0) + 1;
  });

  // Build a map surface -> direct cost + amortized cost components
  const surfaceCost = {};  // { surface: { direct, amortized, direct_n, amortized_n } }
  const surfaceIntents = {};  // { surface: Set<intent> } from direct attributions
  rows.forEach((r) => {
    if (!surfaceCost[r.surface]) {
      surfaceCost[r.surface] = { direct: 0, amortized: 0, direct_n: 0, amortized_n: 0 };
      surfaceIntents[r.surface] = new Set();
    }
    if (r.callId != null && r.proximateCost != null) {
      surfaceCost[r.surface].direct += r.proximateCost;
      surfaceCost[r.surface].direct_n += 1;
      surfaceIntents[r.surface].add(r.intent);
    } else {
      surfaceCost[r.surface].amortized_n += 1;
    }
  });

  // Amortization: for each surface with amortized_n > 0, attribute a slice of
  // each intent's residual spend (intent_total minus already-direct-attributed
  // portion within this surface, clamped >=0). The slice weight is
  // surface.amortized_n / total_unattributed_events_in_window_for_that_intent.
  // We compute it pragmatically: for each surface, divide intent_total across
  // surfaces that have amortized_n events. Simplification: amortize each
  // intent's full window total proportionally to amortized_n across the
  // 3 amortizing surfaces (reading-microcard, pre-reading-diagnostic).
  //
  // For v1 we use a simpler heuristic: each amortizing surface gets a share
  // of intent spend proportional to its amortized_n vs the total amortized_n
  // across all surfaces (no per-intent weighting). This is documented in the
  // spec as "amortized = surface_spend / surface_events".
  const totalAmortizedEvents = Object.values(surfaceCost)
    .reduce((s, v) => s + v.amortized_n, 0);
  const totalAmortizingSpend = Object.entries(intentSpend)
    .filter(([intent]) => !this._isDirectlyAttributedIntent(intent))
    .reduce((s, [, v]) => s + v, 0);

  Object.entries(surfaceCost).forEach(([surface, v]) => {
    if (v.amortized_n > 0 && totalAmortizedEvents > 0) {
      v.amortized = totalAmortizingSpend * (v.amortized_n / totalAmortizedEvents);
    }
  });

  // Group by lens
  const lensMap = lens === 'attention' ? ATTENTION_STATE
                : lens === 'phase'     ? PHASE_GROUP
                : null;  // 'intent' uses a different path

  const groups = {};
  Object.entries(surfaceCost).forEach(([surface, v]) => {
    const key = lensMap ? lensMap[surface] : surface;
    if (!groups[key]) groups[key] = { eventCount: 0, totalCostUsd: 0, direct_n: 0, amortized_n: 0 };
    groups[key].eventCount += v.direct_n + v.amortized_n;
    groups[key].totalCostUsd += v.direct + v.amortized;
    groups[key].direct_n += v.direct_n;
    groups[key].amortized_n += v.amortized_n;
  });

  return Object.entries(groups).map(([key, g]) => ({
    groupKey: key,
    groupLabel: this._labelFor(lens, key),
    eventCount: g.eventCount,
    totalCostUsd: g.totalCostUsd,
    costPerEvent: g.eventCount > 0 ? g.totalCostUsd / g.eventCount : 0,
    directlyAttributedCount: g.direct_n,
    amortizedCount: g.amortized_n,
  })).sort((a, b) => a.costPerEvent - b.costPerEvent);
}

_isDirectlyAttributedIntent(intent) {
  // Intents that always carry their own proximate_call_id → not amortized.
  return [
    'director-session-step',
    'grade-comprehension',
    'production-grade',
  ].includes(intent);
}

_labelFor(lens, key) {
  if (lens === 'attention') {
    return {
      'while-reading': 'While reading',
      'focused-session': 'Focused session',
      'historical': 'Untracked (historical)',
    }[key] || key;
  }
  if (lens === 'phase') {
    return {
      'reading-loop': 'Reading loop',
      'diagnostics': 'Pre-reading diagnostics',
      'director': 'Director sessions',
      'comprehension': 'Comprehension grading',
      'production-prompts': 'Production prompts',
      'manual-review': 'Manual review',
      'historical': 'Untracked (historical)',
    }[key] || key;
  }
  return key;  // intent labels are just the intent strings
}
```

- [ ] **Step 4: Tests pass**

Run: `npx jest src/__tests__/utils/AttributionService.test.js --no-coverage`
Expected: all `getBars` tests pass.

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/AttributionService.js src/__tests__/utils/AttributionService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): AttributionService.getBars with amortization"
```

---

### Task 6: `AttributionService.getGroupDetail` implementation

**Files:**
- Modify: `src/main/utils/AttributionService.js`
- Modify: `src/__tests__/utils/AttributionService.test.js`

- [ ] **Step 1: Add failing test**

Append:
```js
describe('getGroupDetail', () => {
  it('returns events + proximate calls for a group, sorted by ts desc', async () => {
    const db = freshDb();
    const ts = Date.now();
    const cA = insertCall(db, 'director-session-step', 0.012, ts);
    insertEvent(db, 'lp-a', ts, 'director-session', cA);
    insertEvent(db, 'lp-b', ts - 1000, 'director-session');  // amortized

    const svc = new AttributionService();
    const detail = await svc.getGroupDetail({
      lens: 'attention', groupKey: 'focused-session',
      from: ts - 10_000, to: ts + 1000, userId: 1,
    });

    expect(detail.group.key).toBe('focused-session');
    expect(detail.events.length).toBe(2);
    expect(detail.events[0].learningPointId).toBe('lp-a');  // newest first
    expect(detail.events[0].proximateCallId).toBe(cA);
    expect(detail.events[0].amortized).toBe(false);
    expect(detail.events[1].amortized).toBe(true);
  });
});
```

- [ ] **Step 2: Verify fail**
Run: `npx jest src/__tests__/utils/AttributionService.test.js --no-coverage`

- [ ] **Step 3: Implement**

Add to `AttributionService.js`:
```js
async getGroupDetail({ lens, groupKey, from, to, userId, limit = 50 }) {
  const db = dbManager.getDb();
  const lensMap = lens === 'attention' ? ATTENTION_STATE
                : lens === 'phase'     ? PHASE_GROUP
                : null;
  const surfacesInGroup = lensMap
    ? Object.keys(lensMap).filter((s) => lensMap[s] === groupKey)
    : null;  // intent lens uses a different filter

  let rows;
  if (lens === 'intent') {
    rows = db.prepare(`
      SELECT e.learning_point_id AS learningPointId, e.ts, e.feature_surface AS featureSurface,
             e.proximate_call_id AS proximateCallId, c.intent, c.cost_usd AS proximateCost
      FROM mastery_event e
      LEFT JOIN brain_call_ledger c ON c.id = e.proximate_call_id
      WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ? AND c.intent = ?
      ORDER BY e.ts DESC
      LIMIT ?
    `).all(userId, from, to, groupKey, limit);
  } else {
    const placeholders = surfacesInGroup.map(() => '?').join(',');
    rows = db.prepare(`
      SELECT e.learning_point_id AS learningPointId, e.ts, e.feature_surface AS featureSurface,
             e.proximate_call_id AS proximateCallId, c.intent, c.cost_usd AS proximateCost
      FROM mastery_event e
      LEFT JOIN brain_call_ledger c ON c.id = e.proximate_call_id
      WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ? AND e.feature_surface IN (${placeholders})
      ORDER BY e.ts DESC
      LIMIT ?
    `).all(userId, from, to, ...surfacesInGroup, limit);
  }

  // Aggregate group totals via getBars + filter
  const bars = await this.getBars({ lens, from, to, userId });
  const groupBar = bars.find((b) => b.groupKey === groupKey)
    || { eventCount: 0, totalCostUsd: 0, groupLabel: groupKey };

  const events = rows.map((r) => ({
    learningPointId: r.learningPointId,
    ts: r.ts,
    featureSurface: r.featureSurface,
    proximateCallId: r.proximateCallId,
    intent: r.intent || null,
    eventCostUsd: r.proximateCost != null
      ? r.proximateCost
      : (groupBar.eventCount > 0 ? groupBar.totalCostUsd / groupBar.eventCount : 0),
    amortized: r.proximateCallId == null,
  }));

  return {
    group: {
      key: groupKey,
      label: groupBar.groupLabel,
      totalCostUsd: groupBar.totalCostUsd,
      eventCount: groupBar.eventCount,
    },
    events,
  };
}
```

- [ ] **Step 4: Test passes**
Run: `npx jest src/__tests__/utils/AttributionService.test.js --no-coverage`

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/AttributionService.js src/__tests__/utils/AttributionService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): AttributionService.getGroupDetail"
```

---

### Task 7: `AttributionService.getDensityStrip` implementation

**Files:**
- Modify: `src/main/utils/AttributionService.js`
- Modify: `src/__tests__/utils/AttributionService.test.js`

- [ ] **Step 1: Add failing test**

```js
describe('getDensityStrip', () => {
  it('returns mastery_event counts per UTC day, oldest first', async () => {
    const db = freshDb();
    const day1 = Date.UTC(2026, 5, 1, 12, 0, 0);
    const day2 = Date.UTC(2026, 5, 2, 12, 0, 0);
    insertEvent(db, 'lp-1', day1, 'director-session');
    insertEvent(db, 'lp-2', day1, 'director-session');
    insertEvent(db, 'lp-3', day2, 'reading-microcard');
    const svc = new AttributionService();
    const strip = await svc.getDensityStrip({ userId: 1 });
    expect(strip.length).toBe(2);
    expect(strip[0]).toEqual({ day: '2026-06-01', count: 2 });
    expect(strip[1]).toEqual({ day: '2026-06-02', count: 1 });
  });
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**
```js
async getDensityStrip({ userId }) {
  const db = dbManager.getDb();
  const rows = db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS count
    FROM mastery_event
    WHERE user_id = ?
    GROUP BY day
    ORDER BY day ASC
  `).all(userId);
  return rows.map((r) => ({ day: r.day, count: r.count }));
}
```

- [ ] **Step 4: Test passes**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/AttributionService.js src/__tests__/utils/AttributionService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): AttributionService.getDensityStrip"
```

---

### Task 8: Instrument Director — featureSurface + proximateCallId

**Files:**
- Modify: `src/main/brain/director/SessionRunner.js` (around line 252)
- Modify: `src/__tests__/brain/SessionRunner.test.js` (or create targeted unit test)

- [ ] **Step 1: Failing test**

In an appropriate SessionRunner test file (or new `src/__tests__/brain/SessionRunner.attribution.test.js`):

```js
it('records mastery_event with featureSurface and proximateCallId for Director Leitner rating', async () => {
  // Arrange: fake brain_call_ledger row for this trace
  const traceId = 'trace-test-1';
  const callId = insertCall(db, 'director-session-step', 0.005, Date.now());
  db.prepare(`UPDATE brain_call_ledger SET trace_id = ? WHERE id = ?`).run(traceId, callId);

  // Act: simulate the Leitner rating arm of the runner
  await simulateRunnerLeitnerRating({ traceId, learningPointId: 'lp-x', rating: 3, userId: 1 });

  // Assert
  const ev = db.prepare(
    `SELECT feature_surface, proximate_call_id FROM mastery_event WHERE learning_point_id='lp-x'`
  ).get();
  expect(ev.feature_surface).toBe('director-session');
  expect(ev.proximate_call_id).toBe(callId);
});
```

(The test harness will need to import the runner or a helper that exercises the Leitner branch — match the structure of existing SessionRunner tests.)

- [ ] **Step 2: Verify fail**
Run: `npx jest src/__tests__/brain/SessionRunner.attribution.test.js --no-coverage`

- [ ] **Step 3: Update SessionRunner.js**

Around line 252, replace the `MasteryEventStore.record({...})` call:

```js
if (decision.tool === 'openLeitnerCard' && userResult?.rating != null) {
  try {
    const MasteryEventStore = require('../../db/MasteryEventStore');
    // Look up the most recent ledger row for this trace to attach as proximate_call_id.
    const dbManager = require('../../db/dbManager');
    const callRow = dbManager.getDb().prepare(`
      SELECT id FROM brain_call_ledger
      WHERE trace_id = ? ORDER BY ts DESC LIMIT 1
    `).get(state.traceId);
    MasteryEventStore.record({
      learningPointId: decision.args?.learningPointId,
      userId: state.userId,
      ts: Date.now(),
      eventType: 'review',
      rating: String(userResult.rating),
      source: 'director-session',
      sourceRef: state.traceId,
      featureSurface: 'director-session',
      proximateCallId: callRow ? callRow.id : null,
    });
  } catch (_e) { /* never break the session loop */ }
}
```

- [ ] **Step 4: Test passes**

- [ ] **Step 5: Commit**
```bash
git add src/main/brain/director/SessionRunner.js src/__tests__/brain/SessionRunner.attribution.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): Director SessionRunner sets featureSurface + proximateCallId"
```

---

### Task 9: Instrument `LearningPointManager` writes (production-grade + manual-review)

**Files:**
- Modify: `src/main/db/LearningPointManager.js` (around lines 608 + 1050)
- Modify: `src/__tests__/main/LearningPointManager.masteryEvent.test.js`

- [ ] **Step 1: Failing test additions**

```js
it('applyProductionGrade writes featureSurface=production-prompt', async () => {
  // ... arrange + act ...
  const ev = db.prepare(`SELECT feature_surface FROM mastery_event WHERE learning_point_id=?`).get('lp-1');
  expect(ev.feature_surface).toBe('production-prompt');
});

it('updateLeitnerBoxAfterReview writes featureSurface=manual-review', async () => {
  // ...
  expect(ev.feature_surface).toBe('manual-review');
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Update both write sites**

`LearningPointManager.js:608` — add `featureSurface: 'production-prompt'` (and `proximateCallId: opts?.proximateCallId ?? null` — extend `applyProductionGrade` signature so callers can pass it; for now any existing caller passes null).

`LearningPointManager.js:1050` — add `featureSurface: 'manual-review'`. No `proximateCallId` (manual review is not LLM-mediated).

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/db/LearningPointManager.js src/__tests__/main/LearningPointManager.masteryEvent.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): LearningPointManager mastery_event writes tagged with featureSurface"
```

---

### Task 10: Instrument backfill writes + lint guard for new writers

**Files:**
- Modify: `src/main/utils/MasteryEventBackfill.js` (4 sites — all 4 currently write `source: 'backfill'`)
- Create: `src/__tests__/utils/masteryEventBackfill.attribution.test.js`
- Create: `src/__tests__/lint/masteryEventCallSites.test.js`

- [ ] **Step 1: Failing tests**

Attribution test: insert a fake `sr_item` row, run backfill, assert resulting `mastery_event` row has `feature_surface='backfill'`.

Lint guard test:
```js
const fs = require('fs'); const path = require('path');
const glob = require('glob');

it('every MasteryEventStore.record call site passes featureSurface', () => {
  const files = glob.sync(path.join(__dirname, '../../main/**/*.js'));
  const violations = [];
  files.forEach((file) => {
    const src = fs.readFileSync(file, 'utf8');
    // Find each MasteryEventStore.record( call and check the call body
    const re = /MasteryEventStore\.record\s*\(\s*\{([^}]+)\}/gms;
    let m; while ((m = re.exec(src)) !== null) {
      if (!/featureSurface\s*:/.test(m[1])) {
        violations.push(`${file}: record() without featureSurface`);
      }
    }
  });
  expect(violations).toEqual([]);
});
```

- [ ] **Step 2: Verify fail** (4 backfill sites missing `featureSurface`)

- [ ] **Step 3: Update all 4 backfill sites** — add `featureSurface: 'backfill'`.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/MasteryEventBackfill.js src/__tests__/utils/masteryEventBackfill.attribution.test.js src/__tests__/lint/masteryEventCallSites.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): backfill tagged + lint guard for featureSurface"
```

---

### Task 11: NEW write — `ComprehensionGradingService` emits mastery_event

**Files:**
- Modify: `src/main/utils/ComprehensionGradingService.js`
- Modify: `src/__tests__/utils/ComprehensionGradingService.test.js` (or add new file if not present)

- [ ] **Step 1: Failing test**

```js
it('after gradeAnswer succeeds, writes mastery_event with featureSurface=comprehension', async () => {
  const result = await service.gradeAnswer({
    questionId: 'q-1', userId: 1, learningPointId: 'lp-1', answerText: '...', token: 't'
  });
  expect(result.gradeAffected).toBe(true);
  const ev = db.prepare(
    `SELECT feature_surface, proximate_call_id FROM mastery_event WHERE learning_point_id='lp-1' ORDER BY ts DESC LIMIT 1`
  ).get();
  expect(ev.feature_surface).toBe('comprehension');
  expect(ev.proximate_call_id).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Verify fail** (currently doesn't write).

- [ ] **Step 3: Add the write**

In `gradeAnswer`, after the existing mastery-update logic, insert a `MasteryEventStore.record(...)` call with:
- `eventType: 'mastery_change'`
- `prevBox` / `newBox` / `prevMastery` / `newMastery` from the existing update
- `source: 'comprehension-grade'`
- `featureSurface: 'comprehension'`
- `proximateCallId`: returned `callId` from the `brainCall('grade-comprehension', ...)` that produced the grade
- `sourceRef`: question_id

- [ ] **Step 4: Test passes**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/ComprehensionGradingService.js src/__tests__/utils/ComprehensionGradingService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): ComprehensionGradingService emits mastery_event"
```

---

### Task 12: NEW write — `MicroCardProposer` emits mastery_event on accept

**Files:**
- Modify: `src/main/utils/MicroCardProposer.js`
- Modify: `src/__tests__/utils/MicroCardProposer.test.js`

- [ ] **Step 1: Failing test**

```js
it('on accept-then-promote, writes mastery_event with featureSurface=reading-microcard', async () => {
  await proposer.accept({ proposalId: 'p-1', userId: 1 });
  const ev = db.prepare(
    `SELECT feature_surface, proximate_call_id FROM mastery_event ORDER BY ts DESC LIMIT 1`
  ).get();
  expect(ev.feature_surface).toBe('reading-microcard');
  expect(ev.proximate_call_id).toBeNull();  // chained — no direct call
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Update accept path** — after a successful learning_point write following acceptance, also emit `mastery_event` with `featureSurface: 'reading-microcard'`, `proximateCallId: null`. Use `eventType: 'mastery_change'` with `prev_box=null, new_box=1, prev_mastery=null, new_mastery=0` (or whatever the initial state is) — represents the *entry* of a concept into the mastery system.

- [ ] **Step 4: Test passes**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/MicroCardProposer.js src/__tests__/utils/MicroCardProposer.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): MicroCardProposer accept emits mastery_event"
```

---

### Task 13: IPC bridge — attribution handlers + renderer client

**Files:**
- Create: `src/main/ipc/attributionHandlers.js`
- Create: `src/renderer/api/attributionApi.js`
- Modify: `src/main/main.ts` (register the handlers, importing alongside the existing visibility handlers)
- Create: `src/__tests__/ipc/attributionHandlers.test.js`
- Create: `src/__tests__/renderer/attributionApi.test.js`

- [ ] **Step 1: Handler test — mocks ipcMain.handle, asserts 3 channels registered**

```js
const { registerAttributionHandlers } = require('../../main/ipc/attributionHandlers');
it('registers 3 channels', () => {
  const channels = [];
  const ipcMain = { handle: (ch) => channels.push(ch) };
  registerAttributionHandlers(ipcMain);
  expect(channels.sort()).toEqual([
    'attribution:bars', 'attribution:densityStrip', 'attribution:groupDetail',
  ].sort());
});
```

- [ ] **Step 2: Renderer client test** — set up `window.electron = { ipcRenderer: { invoke } }` and assert each method invokes the right channel with the right payload.

- [ ] **Step 3: Implement both files**

`src/main/ipc/attributionHandlers.js`:
```js
const AttributionService = require('../utils/AttributionService');

const registerAttributionHandlers = (ipcMain) => {
  const svc = new AttributionService();
  ipcMain.handle('attribution:bars', (_e, opts) => svc.getBars(opts));
  ipcMain.handle('attribution:groupDetail', (_e, opts) => svc.getGroupDetail(opts));
  ipcMain.handle('attribution:densityStrip', (_e, opts) => svc.getDensityStrip(opts));
};

module.exports = { registerAttributionHandlers };
```

`src/renderer/api/attributionApi.js`:
```js
const { ipcRenderer } = window.electron || {};

const attributionApi = {
  bars(opts)           { return ipcRenderer.invoke('attribution:bars', opts); },
  groupDetail(opts)    { return ipcRenderer.invoke('attribution:groupDetail', opts); },
  densityStrip(userId) { return ipcRenderer.invoke('attribution:densityStrip', { userId }); },
};

export default attributionApi;
```

`src/main/main.ts`: add import + call alongside `registerBrainVisibilityHandlers`.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Smoke**
```bash
npm run test:smoke
```
Expected PASS.

- [ ] **Step 6: Commit**
```bash
git add src/main/ipc/attributionHandlers.js src/renderer/api/attributionApi.js src/main/main.ts src/__tests__/ipc/attributionHandlers.test.js src/__tests__/renderer/attributionApi.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): attribution IPC handlers + renderer client"
```

---

### Task 14: Restructure `EconomicsPanel` → `SpendReturnsPanel` (rename, tab order, default to ROI)

**Files:**
- Create: `src/renderer/components/brainShell/spendReturns/SpendReturnsPanel.jsx`
- Create: `src/renderer/components/brainShell/spendReturns/tabs/SessionsTab.jsx` (extract from existing EconomicsPanel "By Session" tab — keep behavior identical)
- Modify: `src/renderer/components/brainShell/EconomicsPanel.jsx` — replace with a thin shim that imports + re-exports `SpendReturnsPanel` so existing import sites don't break.
- Modify: `src/__tests__/renderer/EconomicsPanel.test.jsx` — update assertions to the new structure (tab labels change, default selection changes).

- [ ] **Step 1: Failing test (panel structure)**

```jsx
import SpendReturnsPanel from '../../renderer/components/brainShell/spendReturns/SpendReturnsPanel';
// ...mock attributionApi + callLedgerApi...
it('mounts with ROI tab selected by default', async () => {
  render(<SpendReturnsPanel />);
  await waitFor(() => screen.getByRole('tab', { name: /ROI/i, selected: true }));
});
it('has 3 tabs in order: ROI / Spend / Sessions', () => {
  render(<SpendReturnsPanel />);
  const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
  expect(tabs.slice(0, 3)).toEqual(['ROI', 'Spend', 'Sessions']);
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

`SpendReturnsPanel.jsx`:
```jsx
import React, { useState } from 'react';
import { Paper, Tabs, Tab } from '@mui/material';
import ROITab from './tabs/ROITab';
import SpendTab from './tabs/SpendTab';
import SessionsTab from './tabs/SessionsTab';

export default function SpendReturnsPanel() {
  const [tab, setTab] = useState('roi');
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab value="roi" label="ROI" />
        <Tab value="spend" label="Spend" />
        <Tab value="sessions" label="Sessions" />
      </Tabs>
      {tab === 'roi' && <ROITab />}
      {tab === 'spend' && <SpendTab />}
      {tab === 'sessions' && <SessionsTab />}
    </Paper>
  );
}
```

`SessionsTab.jsx` — extract the existing "By Session" rendering from `EconomicsPanel.jsx` verbatim.

Replace `EconomicsPanel.jsx` body with:
```jsx
// Thin shim — Phase 13 renamed this panel. Re-export so existing imports still work.
export { default } from './spendReturns/SpendReturnsPanel';
```

Create `ROITab.jsx` and `SpendTab.jsx` as **stubs** for now (placeholder text or empty Paper) — Tasks 15-17 fill them in.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/renderer/components/brainShell/EconomicsPanel.jsx src/renderer/components/brainShell/spendReturns/ src/__tests__/renderer/EconomicsPanel.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): SpendReturnsPanel restructure — ROI/Spend/Sessions tabs, ROI default"
```

---

### Task 15: SpendTab — merge By-Intent + By-Provider with internal toggle

**Files:**
- Modify: `src/renderer/components/brainShell/spendReturns/tabs/SpendTab.jsx`
- Modify: `src/__tests__/renderer/EconomicsPanel.test.jsx` (extend with SpendTab assertions)

- [ ] **Step 1: Failing test** — SpendTab shows a `Group by: [Intent | Provider]` ToggleButtonGroup; switching the toggle re-renders the table.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement** — Port the existing By-Intent and By-Provider tables from `EconomicsPanel.jsx` (lines ~50–167 in the legacy file) into one component with a `groupBy` state that picks which to render.

- [ ] **Step 4: Test passes**

- [ ] **Step 5: Commit**
```bash
git add src/renderer/components/brainShell/spendReturns/tabs/SpendTab.jsx src/__tests__/renderer/EconomicsPanel.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): SpendTab merges By-Intent + By-Provider with toggle"
```

---

### Task 16: ROITab — bars + lens toggle + drill-down hooks

**Files:**
- Modify: `src/renderer/components/brainShell/spendReturns/tabs/ROITab.jsx`
- Create: `src/renderer/components/brainShell/spendReturns/components/AttributionBarChart.jsx`
- Create: `src/renderer/components/brainShell/spendReturns/components/LensToggle.jsx`
- Create: `src/__tests__/renderer/ROITab.test.jsx`

- [ ] **Step 1: Failing tests**

- LensToggle: renders 3 buttons (Attention / Phase / Intent); calls `onChange` when clicked.
- AttributionBarChart: given `bars` prop, renders one bar per group with label, $/move headline, total cost, count.
- ROITab: on mount, fetches bars via mocked `attributionApi.bars`; switches lens reloads.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

- `LensToggle.jsx` — MUI `ToggleButtonGroup` with values `attention`, `phase`, `intent`. Default `attention`.
- `AttributionBarChart.jsx` — for each bar, render a row: label, MUI `LinearProgress` of (cost / maxCost), and the $/move headline. Click handler on each row → calls `props.onBarClick(groupKey)`.
- `ROITab.jsx`:
  ```jsx
  function ROITab() {
    const [lens, setLens] = useState('attention');
    const [window, setWindow] = useState({ from: Date.now() - 30*86400000, to: Date.now() });
    const [bars, setBars] = useState([]);
    const [expanded, setExpanded] = useState(null);  // groupKey or null

    useEffect(() => {
      attributionApi.bars({ lens, ...window, userId: 1 }).then(setBars);
    }, [lens, window]);

    return (
      <Stack spacing={2}>
        <LensToggle value={lens} onChange={setLens} />
        <AttributionBarChart bars={bars} expandedKey={expanded} onBarClick={setExpanded} />
        {/* BrushableDensityStrip arrives in Task 17 */}
        {/* GroupDetailDrawer arrives in Task 18 */}
      </Stack>
    );
  }
  ```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/renderer/components/brainShell/spendReturns/tabs/ROITab.jsx src/renderer/components/brainShell/spendReturns/components/AttributionBarChart.jsx src/renderer/components/brainShell/spendReturns/components/LensToggle.jsx src/__tests__/renderer/ROITab.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): ROITab with AttributionBarChart + LensToggle"
```

---

### Task 17: `BrushableDensityStrip` — brushable timeline + window state

**Files:**
- Create: `src/renderer/components/brainShell/spendReturns/components/BrushableDensityStrip.jsx`
- Modify: `src/renderer/components/brainShell/spendReturns/tabs/ROITab.jsx` (mount the strip + wire window state to URL/localStorage)
- Create: `src/__tests__/renderer/BrushableDensityStrip.test.jsx`

- [ ] **Step 1: Failing test**

- Strip renders one bar per day from `densityStrip` prop.
- A `brushed` highlight reflects `selectedRange` prop.
- `onRangeChange` fires when the user drags the brush.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

Use d3-scale (already in repo? check; if not, use a hand-rolled mapping — single-day buckets make this trivial). Render an SVG with one `<rect>` per day height-scaled by `count / maxCount`. Two handle `<rect>`s for the brush; `pointer-events` for drag.

In ROITab: persist `window` to `localStorage` (`'phase13.window'`) and rehydrate on mount.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/renderer/components/brainShell/spendReturns/components/BrushableDensityStrip.jsx src/renderer/components/brainShell/spendReturns/tabs/ROITab.jsx src/__tests__/renderer/BrushableDensityStrip.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): BrushableDensityStrip with persisted window"
```

---

### Task 18: `GroupDetailDrawer` + `AmortizedBadge` + RationaleCard wiring

**Files:**
- Create: `src/renderer/components/brainShell/spendReturns/components/GroupDetailDrawer.jsx`
- Create: `src/renderer/components/brainShell/spendReturns/components/AmortizedBadge.jsx`
- Modify: `src/renderer/components/brainShell/spendReturns/tabs/ROITab.jsx` (wire bar click → drawer → RationaleCard)
- Create: `src/__tests__/renderer/GroupDetailDrawer.test.jsx`

- [ ] **Step 1: Failing tests**

- Drawer opens when `open=true` and shows group header + events list from `attributionApi.groupDetail`.
- Each event row shows learning_point_id, ts, eventCostUsd.
- Rows with `amortized=true` render `<AmortizedBadge />` (small chip with tooltip).
- Rows with `proximateCallId` render a clickable link that fires `onOpenRationale(callId)`.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

`AmortizedBadge.jsx` — MUI `Chip` size="small" label="amortized" with `Tooltip` "$ shared across this surface's events; no single call attributable."

`GroupDetailDrawer.jsx` — MUI `Drawer anchor="right"`. Fetches detail on mount via `attributionApi.groupDetail`. Renders a list of events; click "amortized" rows opens nothing; click directly-attributed rows fires `props.onOpenRationale(callId)`.

In `ROITab`, wire: clicking a top-level bar expands it (already in Task 16); clicking an L1 sub-bar opens the drawer for that intent's groupKey. The drawer's `onOpenRationale` callback opens the existing `RationaleCard` modal — import from wherever it lives (`src/renderer/components/brainShell/RationaleCard.jsx` or similar; verify path).

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Smoke**
```bash
npm run test:smoke
```

- [ ] **Step 6: Commit**
```bash
git add src/renderer/components/brainShell/spendReturns/components/GroupDetailDrawer.jsx src/renderer/components/brainShell/spendReturns/components/AmortizedBadge.jsx src/renderer/components/brainShell/spendReturns/tabs/ROITab.jsx src/__tests__/renderer/GroupDetailDrawer.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): GroupDetailDrawer + AmortizedBadge + RationaleCard wiring"
```

---

### Task 19: End-to-end integration test

**Files:**
- Create: `src/__tests__/integration/attributionHappyPath.test.js`

- [ ] **Step 1: Write the integration test**

Sequence: freshDb → insert a fake user + book + learning_point → simulate a Director session that produces a `brain_call_ledger` row + a `mastery_event` row with `featureSurface='director-session'` and `proximateCallId=that-row` → simulate a comprehension grade (call + mastery_event) → simulate a micro-card accept (mastery_event with `featureSurface='reading-microcard'`, no proximate call).

Then: `await new AttributionService().getBars({ lens: 'attention', from: 0, to: now+1, userId: 1 })` and assert:
- Exactly 2 groups present: `while-reading` and `focused-session`.
- `focused-session.eventCount === 2`, `focused-session.totalCostUsd` ≈ sum of director + comprehension proximate costs.
- `while-reading.amortizedCount === 1`.

Then: `getGroupDetail({ lens: 'attention', groupKey: 'focused-session', ... })` and assert the events list contains the right rows with the right `proximateCallId`s.

Then: `getDensityStrip({ userId: 1 })` and assert one day with count 3.

- [ ] **Step 2: Verify pass**
Run: `npx jest src/__tests__/integration/attributionHappyPath.test.js --no-coverage` (will need `npm run test:integration` if better-sqlite3 ABI conflicts).

- [ ] **Step 3: Commit**
```bash
git add src/__tests__/integration/attributionHappyPath.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(phase-13): integration — multi-source attribution end-to-end"
```

---

## Self-Review Checklist (run before declaring done)

- [ ] All 19 commits land on `main` cleanly (no force, no rebase, no amend).
- [ ] `npm run test:smoke` PASSES after Tasks 13 and 18 (the two main-process touches).
- [ ] No `mastery_event` row in the test DB ends up with `feature_surface='unknown'` after the integration test (lint guard catches any new write-site that forgets).
- [ ] The thin shim at `EconomicsPanel.jsx` keeps any existing import working.
- [ ] CONTEXT.md needs an entry: `Attribution / Feature Surface / Lens / Spend & Returns Panel / Amortized Cost`. Add as a follow-up commit after Task 19.
