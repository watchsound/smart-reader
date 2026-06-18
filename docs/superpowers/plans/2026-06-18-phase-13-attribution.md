# Phase 13 — Attribution Layer (LLM ROI Surface) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add two attribution columns to `mastery_event` (`proximate_call_id`, `feature_surface`); instrument every mastery write path through a single helper; extend `CallLedgerStore` with the JOIN-heavy aggregations; layer `AttributionService` over it for amortization logic; add ROI as the new **default tab** of the existing `EconomicsPanel` (no rename, no shim); reuse `MasteryTrajectoryStrip` for the brushable density timeline.

**Architecture:** The premise is *we don't measure spend, we measure returns*. The Attribution panel JOINs `brain_call_ledger ⋈ mastery_event` and surfaces **cost-per-mastery-move** by lens (L3 attention-state default → L2 phase toggle → L1 intent drill-down). Hybrid attribution: strict FK (`proximate_call_id`) where causation is direct; amortized cost (`surface_spend / surface_events`) where chained. Non-LLM and pre-Phase-12 events appear as "Untracked (historical)" $0 baseline.

**Integration principles (locked from review of v1 plan):**

1. **Additive, not parallel.** New aggregations extend `CallLedgerStore` + `callLedgerApi` rather than introducing a parallel store/api. Matches Phase 10b-3's tab-addition precedent on `EconomicsPanel`.
2. **One source of truth for the enum.** `featureSurface` lives in `src/commons/model/` so both main and renderer import the same constant.
3. **DRY the lookup.** Every mastery-write site goes through `masteryEventRecorder.recordWithProximateCall(...)` — no hand-rolled trace-id lookups.
4. **Reuse existing visual language.** Density strip extends the `MasteryTrajectoryStrip` (Phase 12) visual pattern, doesn't invent a new look.
5. **AttributionService is a thin layer.** It owns only the amortization arithmetic; raw SQL aggregation lives in `CallLedgerStore`.

**Tech Stack:** Node + better-sqlite3 + React + MUI. No new deps. Reuse Phase 9 `RationaleCard` for call-detail drill-down.

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
- `src/commons/model/featureSurface.js` — enum + ATTENTION_STATE + PHASE_GROUP + isValidFeatureSurface (single source of truth, main + renderer import)
- `src/main/db/masteryEventRecorder.js` — helper: `recordWithProximateCall({ traceId, surface, ...eventFields })`
- `src/main/utils/AttributionService.js` — amortization wrapper over CallLedgerStore
- `src/renderer/components/brainShell/spendReturns/ROITab.jsx` — new tab content (lives in subfolder under brainShell, alongside `EconomicsPanel.jsx`)
- `src/renderer/components/brainShell/spendReturns/AttributionBarChart.jsx`
- `src/renderer/components/brainShell/spendReturns/LensToggle.jsx`
- `src/renderer/components/brainShell/spendReturns/BrushableDensityStrip.jsx` — extends MasteryTrajectoryStrip visual pattern
- `src/renderer/components/brainShell/spendReturns/GroupDetailDrawer.jsx`
- `src/renderer/components/brainShell/spendReturns/AmortizedBadge.jsx`
- `src/__tests__/commons/featureSurface.test.js`
- `src/__tests__/db/masteryEventRecorder.test.js`
- `src/__tests__/utils/AttributionService.test.js`
- `src/__tests__/db/CallLedgerStore.attribution.test.js`
- `src/__tests__/lint/masteryEventCallSites.test.js`
- `src/__tests__/renderer/ROITab.test.jsx`
- `src/__tests__/renderer/BrushableDensityStrip.test.jsx`
- `src/__tests__/renderer/GroupDetailDrawer.test.jsx`
- `src/__tests__/integration/attributionHappyPath.test.js`

**Modify**
- `db.sql` — extend `mastery_event` CREATE TABLE block with 2 new columns + 2 indices
- `src/main/db/MasteryEventStore.js` — `record()` accepts `proximateCallId` + `featureSurface`
- `src/main/db/CallLedgerStore.js` — add `aggregateAttribution`, `attributionGroupDetail`, `attributionDensityStrip` (raw SQL only)
- `src/main/ipc/callLedgerHandlers.js` — register 3 new IPC channels
- `src/renderer/api/callLedgerApi.js` — add 3 client methods
- `src/main/brain/director/SessionRunner.js:252` — call helper instead of MasteryEventStore directly
- `src/main/db/LearningPointManager.js:608` + `:1050` — call helper
- `src/main/utils/MasteryEventBackfill.js` — call helper at all 4 sites
- `src/main/utils/ComprehensionGradingService.js` — NEW mastery_event write via helper
- `src/main/utils/MicroCardProposer.js` — NEW mastery_event write via helper
- `src/renderer/components/brainShell/EconomicsPanel.jsx` — add ROI tab as **default**, change displayed title from "Economics" to "Spend & Returns"; tab order: ROI / By Intent / By Provider / By Session
- `CONTEXT.md` — add Attribution / Feature Surface / Attention State / Spend & Returns Panel / Amortized Cost entries (Phase 13 section)

**Note: no `EconomicsPanel` rename, no shim, no `attributionApi`, no parallel handlers.**

---

### Task 1: Schema extension + backfill row data migration

**Files:** Modify: `db.sql`

- [ ] **Step 1: Locate the existing `mastery_event` CREATE block**

Run: `grep -n 'CREATE TABLE "mastery_event"' db.sql`
Expected: returns one line number.

- [ ] **Step 2: Replace the CREATE TABLE block with the extended version**

Replace the `mastery_event` block with:

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

- [ ] **Step 3: Verify the SQL parses cleanly**

Run:
```bash
node -e "const fs=require('fs');const sql=fs.readFileSync('db.sql','utf8');const Database=require('better-sqlite3');const db=new Database(':memory:');db.exec(sql);const cols=db.prepare(\"PRAGMA table_info('mastery_event')\").all();console.log(cols.filter(c=>['proximate_call_id','feature_surface'].includes(c.name)));"
```
Expected: two rows shown, `feature_surface` with `dflt_value: \"'unknown'\"`, `proximate_call_id` nullable INTEGER.

- [ ] **Step 4: Verify backfill UPDATE works on existing data**

The `feature_surface DEFAULT 'unknown'` covers fresh boots. For existing installations with Phase 12 backfill rows already in the DB, the Phase 12 backfill service (Task 12 of this plan) will re-tag them on the next heartbeat. No separate one-shot migration script is needed because:

- `MasteryEventBackfill` runs on every app boot
- After Task 12 lands, its 4 record-sites all pass `featureSurface: 'backfill'`
- Existing pre-Phase-13 rows with `feature_surface='unknown'` get re-inserted with the proper surface — the UNIQUE dedup index on `(learning_point_id, ts, event_type, source_ref)` silently absorbs the duplicate, **but** the existing 'unknown' row stays. To handle this, add a one-shot `UPDATE` in the boot path. See sub-step below.

Add the migration UPDATE to `db.sql` immediately after the index definitions:

```sql
-- Phase 13 backfill data migration: tag existing Phase-12 backfill rows.
-- Idempotent: re-running this on already-tagged rows is a no-op.
UPDATE mastery_event SET feature_surface = 'backfill'
  WHERE source = 'backfill' AND feature_surface = 'unknown';
```

Re-run the parse verification:
```bash
node -e "const fs=require('fs');const sql=fs.readFileSync('db.sql','utf8');const Database=require('better-sqlite3');const db=new Database(':memory:');db.exec(sql);console.log('OK');"
```
Expected: `OK`.

- [ ] **Step 5: Commit**
```bash
git add db.sql
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): mastery_event attribution columns + indices + backfill migration"
```

---

### Task 2: `featureSurface` enum in `commons/model` (single source of truth)

**Files:**
- Create: `src/commons/model/featureSurface.js`
- Create: `src/__tests__/commons/featureSurface.test.js`

- [ ] **Step 1: Write the failing test**

`src/__tests__/commons/featureSurface.test.js`:
```js
const {
  FEATURE_SURFACES,
  ATTENTION_STATE,
  PHASE_GROUP,
  isValidFeatureSurface,
} = require('../../commons/model/featureSurface');

describe('featureSurface enum', () => {
  it('exports closed set of 8 values', () => {
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

  it('maps every surface to one of 3 attention states', () => {
    FEATURE_SURFACES.forEach((s) => {
      expect(['while-reading', 'focused-session', 'historical']).toContain(ATTENTION_STATE[s]);
    });
  });

  it('maps every surface to a non-empty phase group', () => {
    FEATURE_SURFACES.forEach((s) => {
      expect(typeof PHASE_GROUP[s]).toBe('string');
      expect(PHASE_GROUP[s].length).toBeGreaterThan(0);
    });
  });

  it('isValidFeatureSurface returns true for enum values', () => {
    expect(isValidFeatureSurface('director-session')).toBe(true);
    expect(isValidFeatureSurface('not-a-thing')).toBe(false);
    expect(isValidFeatureSurface(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Verify fail**
Run: `npx jest src/__tests__/commons/featureSurface.test.js --no-coverage`
Expected: `Cannot find module`.

- [ ] **Step 3: Implement**

`src/commons/model/featureSurface.js`:
```js
/**
 * Phase 13 Attribution: closed feature_surface enum + lens maps.
 * Lives in commons so both main process (writers) and renderer
 * (lens toggle UI) import the same source of truth.
 *
 * 'unknown' is a LINT GUARD — never write it intentionally; the
 * masteryEventCallSites lint test fails the build if a record() call
 * omits featureSurface.
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

- [ ] **Step 4: Tests pass**
Run: `npx jest src/__tests__/commons/featureSurface.test.js --no-coverage`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**
```bash
git add src/commons/model/featureSurface.js src/__tests__/commons/featureSurface.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): featureSurface enum in commons/model (main+renderer share)"
```

---

### Task 3: `MasteryEventStore.record()` accepts new fields

**Files:**
- Modify: `src/main/db/MasteryEventStore.js`
- Modify (or create): `src/__tests__/db/MasteryEventStore.test.js`

- [ ] **Step 1: Add the failing test cases**

Append to the existing `MasteryEventStore.test.js` (or scaffold using Phase 12's `freshDb()` pattern):

```js
describe('record() — Phase 13 attribution fields', () => {
  it('persists proximate_call_id + feature_surface when supplied', () => {
    freshDb();
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

  it('defaults feature_surface to "unknown" when omitted', () => {
    freshDb();
    MasteryEventStore.record({
      learningPointId: 'lp-2', userId: 1, ts: Date.now(),
      eventType: 'review', source: 'legacy',
    });
    const row = dbManager.getDb().prepare(
      `SELECT feature_surface FROM mastery_event WHERE learning_point_id='lp-2'`
    ).get();
    expect(row.feature_surface).toBe('unknown');
  });
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Update the INSERT**

In `src/main/db/MasteryEventStore.js`, replace the INSERT in `record()`:
```js
db.prepare(`
  INSERT INTO mastery_event
    (learning_point_id, user_id, ts, event_type,
     prev_box, new_box, prev_mastery, new_mastery,
     rating, source, source_ref, notes,
     proximate_call_id, feature_surface)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  ev.learningPointId, ev.userId, ev.ts, ev.eventType,
  ev.prevBox ?? null, ev.newBox ?? null,
  ev.prevMastery ?? null, ev.newMastery ?? null,
  ev.rating ?? null, ev.source,
  ev.sourceRef ?? null, ev.notes ?? null,
  ev.proximateCallId ?? null,
  ev.featureSurface ?? 'unknown',
);
```

Update JSDoc to document the two new optional fields.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/db/MasteryEventStore.js src/__tests__/db/MasteryEventStore.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): MasteryEventStore.record accepts attribution fields"
```

---

### Task 4: `masteryEventRecorder` helper (DRY trace→callId lookup)

**Files:**
- Create: `src/main/db/masteryEventRecorder.js`
- Create: `src/__tests__/db/masteryEventRecorder.test.js`

- [ ] **Step 1: Failing test**

`src/__tests__/db/masteryEventRecorder.test.js`:
```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbManager = require('../../main/db/dbManager');
const recorder = require('../../main/db/masteryEventRecorder');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  db.prepare(`INSERT INTO learning_point (id, user_id, term, domain_type)
              VALUES ('lp-1', 1, 'word', 'vocabulary')`).run();
  dbManager.__setDb(db);
  return db;
}

describe('masteryEventRecorder', () => {
  it('looks up most recent ledger row for trace_id and stamps proximate_call_id', () => {
    const db = freshDb();
    const older = db.prepare(`INSERT INTO brain_call_ledger
      (intent, ts, provider, cost_usd, cache_hit, trace_id)
      VALUES ('director-session-step', 1000, 'deepseek', 0.01, 0, 'tr-A')`).run().lastInsertRowid;
    const newer = db.prepare(`INSERT INTO brain_call_ledger
      (intent, ts, provider, cost_usd, cache_hit, trace_id)
      VALUES ('director-session-step', 2000, 'deepseek', 0.02, 0, 'tr-A')`).run().lastInsertRowid;

    recorder.recordWithProximateCall({
      traceId: 'tr-A',
      surface: 'director-session',
      learningPointId: 'lp-1',
      userId: 1,
      ts: 3000,
      eventType: 'review',
      source: 'director-session',
      sourceRef: 'tr-A',
    });

    const row = db.prepare(
      `SELECT proximate_call_id, feature_surface FROM mastery_event WHERE learning_point_id='lp-1'`
    ).get();
    expect(row.proximate_call_id).toBe(newer);
    expect(row.feature_surface).toBe('director-session');
  });

  it('passes proximate_call_id=null when traceId is null/undefined', () => {
    freshDb();
    recorder.recordWithProximateCall({
      traceId: null,
      surface: 'reading-microcard',
      learningPointId: 'lp-1',
      userId: 1,
      ts: 1000,
      eventType: 'mastery_change',
      source: 'microcard-accept',
    });
    const row = dbManager.getDb().prepare(
      `SELECT proximate_call_id, feature_surface FROM mastery_event WHERE learning_point_id='lp-1'`
    ).get();
    expect(row.proximate_call_id).toBeNull();
    expect(row.feature_surface).toBe('reading-microcard');
  });

  it('passes proximate_call_id=null when no ledger row matches the trace', () => {
    freshDb();
    recorder.recordWithProximateCall({
      traceId: 'tr-nonexistent',
      surface: 'director-session',
      learningPointId: 'lp-1',
      userId: 1,
      ts: 1000,
      eventType: 'review',
      source: 'director-session',
    });
    const row = dbManager.getDb().prepare(
      `SELECT proximate_call_id FROM mastery_event WHERE learning_point_id='lp-1'`
    ).get();
    expect(row.proximate_call_id).toBeNull();
  });
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

`src/main/db/masteryEventRecorder.js`:
```js
/**
 * masteryEventRecorder — single DRY helper for Phase 13 attribution writes.
 *
 * Every mastery-event write site goes through this helper instead of calling
 * MasteryEventStore.record directly. It:
 *   1. Looks up the most recent brain_call_ledger row for the given trace_id
 *      (if any) to populate proximate_call_id.
 *   2. Stamps the supplied feature_surface.
 *   3. Delegates to MasteryEventStore.record.
 *
 * Callers without a traceId (e.g. micro-card accept — chained, no direct
 * proximate call) pass traceId: null and get proximate_call_id: null.
 */
const dbManager = require('./dbManager');
const MasteryEventStore = require('./MasteryEventStore');
const { isValidFeatureSurface } = require('../../commons/model/featureSurface');

function lookupProximateCallId(traceId) {
  if (!traceId) return null;
  const row = dbManager.getDb().prepare(
    `SELECT id FROM brain_call_ledger WHERE trace_id = ? ORDER BY ts DESC LIMIT 1`
  ).get(traceId);
  return row ? row.id : null;
}

/**
 * @param {object} args
 * @param {string|null} args.traceId    — trace_id to look up; null skips lookup
 * @param {string}      args.surface    — feature_surface enum value
 * @param {string}      args.learningPointId
 * @param {number}      args.userId
 * @param {number}      args.ts
 * @param {string}      args.eventType  — 'review' | 'mastery_change' | etc.
 * @param {string}      args.source     — legacy source label
 * @param {string|null} [args.sourceRef]
 * @param {number|null} [args.prevBox]
 * @param {number|null} [args.newBox]
 * @param {number|null} [args.prevMastery]
 * @param {number|null} [args.newMastery]
 * @param {string|null} [args.rating]
 * @param {string|null} [args.notes]
 * @param {number|null} [args.explicitCallId]  — optional: skip lookup, use this directly
 */
function recordWithProximateCall(args) {
  if (!isValidFeatureSurface(args.surface)) {
    console.warn(`[masteryEventRecorder] invalid surface "${args.surface}" — coerced to 'unknown'`);
  }
  const proximateCallId = args.explicitCallId != null
    ? args.explicitCallId
    : lookupProximateCallId(args.traceId);

  MasteryEventStore.record({
    learningPointId: args.learningPointId,
    userId: args.userId,
    ts: args.ts,
    eventType: args.eventType,
    prevBox: args.prevBox,
    newBox: args.newBox,
    prevMastery: args.prevMastery,
    newMastery: args.newMastery,
    rating: args.rating,
    source: args.source,
    sourceRef: args.sourceRef,
    notes: args.notes,
    proximateCallId,
    featureSurface: args.surface,
  });
}

module.exports = { recordWithProximateCall };
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/db/masteryEventRecorder.js src/__tests__/db/masteryEventRecorder.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): masteryEventRecorder helper (DRY proximate-call lookup)"
```

---

### Task 5: Extend `CallLedgerStore` with attribution aggregations (raw SQL)

**Files:**
- Modify: `src/main/db/CallLedgerStore.js`
- Create: `src/__tests__/db/CallLedgerStore.attribution.test.js`

This adds **three** aggregation functions that match the existing `aggregateByIntent` / `aggregateByProvider` pattern. AttributionService (Task 6+) calls them; no parallel store.

- [ ] **Step 1: Failing tests**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbManager = require('../../main/db/dbManager');
const CallLedgerStore = require('../../main/db/CallLedgerStore');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  dbManager.__setDb(db);
  return db;
}

function insCall(db, intent, costUsd, ts, traceId = null) {
  return db.prepare(`INSERT INTO brain_call_ledger
    (intent, ts, provider, cost_usd, cache_hit, trace_id)
    VALUES (?, ?, 'deepseek', ?, 0, ?)`).run(intent, ts, costUsd, traceId).lastInsertRowid;
}
function insEv(db, lpId, ts, surface, callId = null) {
  db.prepare(`INSERT OR IGNORE INTO learning_point (id, user_id, term, domain_type)
              VALUES (?, 1, ?, 'vocabulary')`).run(lpId, lpId);
  db.prepare(`INSERT INTO mastery_event
    (learning_point_id, user_id, ts, event_type, source, feature_surface, proximate_call_id)
    VALUES (?, 1, ?, 'review', 'test', ?, ?)`).run(lpId, ts, surface, callId);
}

describe('CallLedgerStore — attribution aggregations', () => {
  describe('aggregateAttribution', () => {
    it('returns per-surface rows with direct + amortized cost components', () => {
      const db = freshDb();
      const ts = 1000;
      const callA = insCall(db, 'director-session-step', 0.01, ts);
      insEv(db, 'lp-1', ts, 'director-session', callA);  // direct
      insCall(db, 'extract-learning-points', 0.04, ts);  // amortizable
      insEv(db, 'lp-2', ts, 'reading-microcard');         // amortized
      insEv(db, 'lp-3', ts, 'reading-microcard');         // amortized

      const rows = CallLedgerStore.aggregateAttribution({
        userId: 1, fromMs: 0, toMs: 9999,
      });
      const bySurface = Object.fromEntries(rows.map((r) => [r.feature_surface, r]));
      expect(bySurface['director-session'].direct_cost_usd).toBeCloseTo(0.01);
      expect(bySurface['director-session'].direct_event_count).toBe(1);
      expect(bySurface['director-session'].amortized_event_count).toBe(0);
      expect(bySurface['reading-microcard'].direct_cost_usd).toBe(0);
      expect(bySurface['reading-microcard'].amortized_event_count).toBe(2);
    });

    it('exposes per-intent residual spend (for amortization denominator)', () => {
      const db = freshDb();
      insCall(db, 'extract-learning-points', 0.1, 1000);
      insCall(db, 'extract-learning-points', 0.2, 1500);
      const result = CallLedgerStore.intentSpendInWindow({ fromMs: 0, toMs: 9999 });
      expect(result['extract-learning-points']).toBeCloseTo(0.3);
    });
  });

  describe('attributionGroupDetail', () => {
    it('returns events filtered by feature_surface list, newest first', () => {
      const db = freshDb();
      const callA = insCall(db, 'director-session-step', 0.005, 2000);
      insEv(db, 'lp-a', 2000, 'director-session', callA);
      insEv(db, 'lp-b', 1000, 'director-session');

      const events = CallLedgerStore.attributionGroupDetail({
        userId: 1, fromMs: 0, toMs: 9999,
        surfaces: ['director-session'],
        limit: 50,
      });
      expect(events.length).toBe(2);
      expect(events[0].learning_point_id).toBe('lp-a');
      expect(events[0].proximate_call_id).toBe(callA);
      expect(events[0].intent).toBe('director-session-step');
      expect(events[1].proximate_call_id).toBeNull();
    });
  });

  describe('attributionDensityStrip', () => {
    it('returns one row per UTC day with count, oldest first', () => {
      const db = freshDb();
      const day1 = Date.UTC(2026, 5, 1, 12);
      const day2 = Date.UTC(2026, 5, 2, 12);
      insEv(db, 'lp-1', day1, 'director-session');
      insEv(db, 'lp-2', day1, 'director-session');
      insEv(db, 'lp-3', day2, 'reading-microcard');
      const strip = CallLedgerStore.attributionDensityStrip({ userId: 1 });
      expect(strip).toEqual([
        { day: '2026-06-01', count: 2 },
        { day: '2026-06-02', count: 1 },
      ]);
    });
  });
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement (append to CallLedgerStore.js, follow existing style)**

```js
/**
 * Phase 13 Attribution: per-surface aggregation in [fromMs, toMs).
 * Returns one row per feature_surface present in the window with:
 *   - direct_cost_usd, direct_event_count: events with proximate_call_id set
 *   - amortized_event_count: events without (cost computed downstream)
 */
function aggregateAttribution({ userId, fromMs, toMs }) {
  const db = DBManager.getDb();
  return db.prepare(`
    SELECT
      e.feature_surface,
      SUM(CASE WHEN e.proximate_call_id IS NOT NULL THEN COALESCE(c.cost_usd, 0) ELSE 0 END) AS direct_cost_usd,
      SUM(CASE WHEN e.proximate_call_id IS NOT NULL THEN 1 ELSE 0 END) AS direct_event_count,
      SUM(CASE WHEN e.proximate_call_id IS NULL THEN 1 ELSE 0 END) AS amortized_event_count
    FROM mastery_event e
    LEFT JOIN brain_call_ledger c ON c.id = e.proximate_call_id
    WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ?
    GROUP BY e.feature_surface
  `).all(userId, fromMs, toMs);
}

/**
 * Total cost_usd per intent within [fromMs, toMs). Used as the amortization
 * spend pool for surfaces whose calls cannot be directly attributed.
 */
function intentSpendInWindow({ fromMs, toMs }) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT intent, SUM(CASE WHEN cache_hit = 0 THEN cost_usd ELSE 0 END) AS total
    FROM brain_call_ledger
    WHERE ts >= ? AND ts < ?
    GROUP BY intent
  `).all(fromMs, toMs);
  return Object.fromEntries(rows.map((r) => [r.intent, r.total || 0]));
}

/**
 * Per-surface drill-down: events + their proximate call (intent + cost) if any.
 */
function attributionGroupDetail({ userId, fromMs, toMs, surfaces, intent, limit = 50 }) {
  const db = DBManager.getDb();
  if (intent) {
    return db.prepare(`
      SELECT e.learning_point_id, e.ts, e.feature_surface, e.proximate_call_id,
             c.intent, c.cost_usd AS proximate_cost_usd
      FROM mastery_event e
      LEFT JOIN brain_call_ledger c ON c.id = e.proximate_call_id
      WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ? AND c.intent = ?
      ORDER BY e.ts DESC LIMIT ?
    `).all(userId, fromMs, toMs, intent, limit);
  }
  const placeholders = surfaces.map(() => '?').join(',');
  return db.prepare(`
    SELECT e.learning_point_id, e.ts, e.feature_surface, e.proximate_call_id,
           c.intent, c.cost_usd AS proximate_cost_usd
    FROM mastery_event e
    LEFT JOIN brain_call_ledger c ON c.id = e.proximate_call_id
    WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ?
      AND e.feature_surface IN (${placeholders})
    ORDER BY e.ts DESC LIMIT ?
  `).all(userId, fromMs, toMs, ...surfaces, limit);
}

/**
 * Daily mastery_event count for the brushable density timeline.
 */
function attributionDensityStrip({ userId }) {
  const db = DBManager.getDb();
  return db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS count
    FROM mastery_event
    WHERE user_id = ?
    GROUP BY day
    ORDER BY day ASC
  `).all(userId);
}

// Update module.exports at the bottom:
module.exports = {
  // ... existing exports ...
  aggregateAttribution,
  intentSpendInWindow,
  attributionGroupDetail,
  attributionDensityStrip,
};
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/db/CallLedgerStore.js src/__tests__/db/CallLedgerStore.attribution.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): CallLedgerStore attribution aggregations (raw SQL)"
```

---

### Task 6: `AttributionService` contract (amortization layer)

**Files:**
- Create: `src/main/utils/AttributionService.js`
- Create: `src/__tests__/utils/AttributionService.test.js`

AttributionService is a **thin amortization wrapper** over CallLedgerStore. Owns: amortization arithmetic + lens grouping + label resolution. Does NOT own raw SQL.

- [ ] **Step 1: Contract test**

```js
const AttributionService = require('../../main/utils/AttributionService');

describe('AttributionService — contract', () => {
  it('exports a class with 3 async methods', () => {
    const svc = new AttributionService();
    expect(typeof svc.getBars).toBe('function');
    expect(typeof svc.getGroupDetail).toBe('function');
    expect(typeof svc.getDensityStrip).toBe('function');
  });
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement skeleton**

```js
const CallLedgerStore = require('../db/CallLedgerStore');
const { ATTENTION_STATE, PHASE_GROUP } = require('../../commons/model/featureSurface');

class AttributionService {
  async getBars(_opts)         { throw new Error('not implemented — Task 7'); }
  async getGroupDetail(_opts)  { throw new Error('not implemented — Task 8'); }
  async getDensityStrip(opts)  { return CallLedgerStore.attributionDensityStrip(opts); }
}

module.exports = AttributionService;
```

(`getDensityStrip` is trivial — delegates straight through. No separate task.)

- [ ] **Step 4: Test passes**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/AttributionService.js src/__tests__/utils/AttributionService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): AttributionService contract — thin layer over CallLedgerStore"
```

---

### Task 7: `AttributionService.getBars` — amortization + lens grouping

**Files:**
- Modify: `src/main/utils/AttributionService.js`
- Modify: `src/__tests__/utils/AttributionService.test.js`

- [ ] **Step 1: Failing tests**

Use the same `freshDb` / `insCall` / `insEv` pattern as Task 5. Append:

```js
describe('getBars', () => {
  it('lens=attention groups surfaces into 3 attention-state bars', async () => {
    const db = freshDb();
    const ts = 1000;
    const cA = insCall(db, 'director-session-step', 0.01, ts);
    insEv(db, 'lp-a', ts, 'director-session', cA);  // focused-session direct
    insEv(db, 'lp-b', ts, 'reading-microcard');     // while-reading amortized
    insEv(db, 'lp-c', ts, 'backfill');              // historical

    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'attention', from: 0, to: 9999, userId: 1,
    });
    const byKey = Object.fromEntries(bars.map((b) => [b.groupKey, b]));
    expect(byKey['focused-session'].eventCount).toBe(1);
    expect(byKey['focused-session'].totalCostUsd).toBeCloseTo(0.01);
    expect(byKey['while-reading'].eventCount).toBe(1);
    expect(byKey['historical'].eventCount).toBe(1);
    expect(byKey['historical'].totalCostUsd).toBe(0);
  });

  it('amortizes intent spend across surfaces with no proximate_call_id', async () => {
    const db = freshDb();
    const ts = 1000;
    insCall(db, 'extract-learning-points', 0.04, ts);
    insCall(db, 'extract-learning-points', 0.06, ts);
    insEv(db, 'lp-a', ts, 'reading-microcard');
    insEv(db, 'lp-b', ts, 'reading-microcard');
    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'phase', from: 0, to: 9999, userId: 1,
    });
    const readingLoop = bars.find((b) => b.groupKey === 'reading-loop');
    expect(readingLoop.totalCostUsd).toBeCloseTo(0.10);
    expect(readingLoop.costPerEvent).toBeCloseTo(0.05);
    expect(readingLoop.amortizedCount).toBe(2);
    expect(readingLoop.directlyAttributedCount).toBe(0);
  });

  it('filters by [from, to) window', async () => {
    const db = freshDb();
    insEv(db, 'lp-a', 1000, 'director-session');
    insEv(db, 'lp-b', 5000, 'director-session');
    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'attention', from: 2000, to: 6000, userId: 1,
    });
    expect(bars.find((b) => b.groupKey === 'focused-session').eventCount).toBe(1);
  });

  it('sorts bars by costPerEvent ascending (most-efficient first)', async () => {
    const db = freshDb();
    const c1 = insCall(db, 'director-session-step', 0.50, 1000);
    insEv(db, 'lp-1', 1000, 'director-session', c1);  // expensive
    const c2 = insCall(db, 'grade-comprehension', 0.05, 1000);
    insEv(db, 'lp-2', 1000, 'comprehension', c2);     // cheap
    const svc = new AttributionService();
    const bars = await svc.getBars({
      lens: 'phase', from: 0, to: 9999, userId: 1,
    });
    expect(bars[0].costPerEvent).toBeLessThan(bars[bars.length - 1].costPerEvent);
  });
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement `getBars`**

```js
async getBars({ lens, from, to, userId }) {
  const perSurface = CallLedgerStore.aggregateAttribution({ userId, fromMs: from, toMs: to });
  const intentSpend = CallLedgerStore.intentSpendInWindow({ fromMs: from, toMs: to });

  // Intents that already carry a proximate_call_id and so should NOT be
  // double-counted into the amortization pool.
  const DIRECT_INTENTS = new Set([
    'director-session-step',
    'grade-comprehension',
    'production-grade',
  ]);
  const totalAmortizingSpend = Object.entries(intentSpend)
    .filter(([intent]) => !DIRECT_INTENTS.has(intent))
    .reduce((s, [, v]) => s + v, 0);
  const totalAmortizedEvents = perSurface.reduce((s, r) => s + (r.amortized_event_count || 0), 0);

  // Build the per-surface cost model: direct + amortized share
  const surfaceCost = {};
  perSurface.forEach((r) => {
    const amortized = (totalAmortizedEvents > 0 && r.amortized_event_count > 0)
      ? totalAmortizingSpend * (r.amortized_event_count / totalAmortizedEvents)
      : 0;
    surfaceCost[r.feature_surface] = {
      eventCount: (r.direct_event_count || 0) + (r.amortized_event_count || 0),
      totalCostUsd: (r.direct_cost_usd || 0) + amortized,
      direct_n: r.direct_event_count || 0,
      amortized_n: r.amortized_event_count || 0,
    };
  });

  // Group by lens
  const lensMap = lens === 'attention' ? ATTENTION_STATE
                : lens === 'phase'     ? PHASE_GROUP
                : null;  // intent lens groups by underlying intent — uses different path

  if (lens === 'intent') {
    // For intent lens, re-query attribution by intent rather than by surface.
    // This is the L1 drill-down view; not a roll-up of surfaces.
    return this._barsByIntent({ userId, from, to });
  }

  const groups = {};
  Object.entries(surfaceCost).forEach(([surface, v]) => {
    const key = lensMap[surface] || 'unknown';
    if (!groups[key]) groups[key] = { eventCount: 0, totalCostUsd: 0, direct_n: 0, amortized_n: 0 };
    groups[key].eventCount += v.eventCount;
    groups[key].totalCostUsd += v.totalCostUsd;
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

async _barsByIntent({ userId, from, to }) {
  const dbManager = require('../db/dbManager');
  const rows = dbManager.getDb().prepare(`
    SELECT c.intent AS intent, COUNT(*) AS event_count,
           SUM(c.cost_usd) AS total_cost_usd
    FROM mastery_event e
    JOIN brain_call_ledger c ON c.id = e.proximate_call_id
    WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ?
    GROUP BY c.intent
  `).all(userId, from, to);

  return rows.map((r) => ({
    groupKey: r.intent,
    groupLabel: r.intent,
    eventCount: r.event_count,
    totalCostUsd: r.total_cost_usd || 0,
    costPerEvent: r.event_count > 0 ? (r.total_cost_usd || 0) / r.event_count : 0,
    directlyAttributedCount: r.event_count,
    amortizedCount: 0,
  })).sort((a, b) => a.costPerEvent - b.costPerEvent);
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
  return key;
}
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/AttributionService.js src/__tests__/utils/AttributionService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): AttributionService.getBars (amortization + lens grouping)"
```

---

### Task 8: `AttributionService.getGroupDetail`

**Files:**
- Modify: `src/main/utils/AttributionService.js`
- Modify: `src/__tests__/utils/AttributionService.test.js`

- [ ] **Step 1: Failing test**

```js
describe('getGroupDetail', () => {
  it('returns events for a group with per-event cost (direct or amortized)', async () => {
    const db = freshDb();
    const ts = 2000;
    const cA = insCall(db, 'director-session-step', 0.012, ts);
    insEv(db, 'lp-a', ts, 'director-session', cA);
    insEv(db, 'lp-b', ts - 1000, 'director-session');

    const svc = new AttributionService();
    const detail = await svc.getGroupDetail({
      lens: 'attention', groupKey: 'focused-session',
      from: 0, to: 9999, userId: 1,
    });
    expect(detail.group.key).toBe('focused-session');
    expect(detail.events.length).toBe(2);
    expect(detail.events[0].learningPointId).toBe('lp-a');
    expect(detail.events[0].proximateCallId).toBe(cA);
    expect(detail.events[0].amortized).toBe(false);
    expect(detail.events[1].amortized).toBe(true);
  });
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

```js
async getGroupDetail({ lens, groupKey, from, to, userId, limit = 50 }) {
  const lensMap = lens === 'attention' ? ATTENTION_STATE
                : lens === 'phase'     ? PHASE_GROUP
                : null;

  const rows = lens === 'intent'
    ? CallLedgerStore.attributionGroupDetail({
        userId, fromMs: from, toMs: to, intent: groupKey, limit,
      })
    : CallLedgerStore.attributionGroupDetail({
        userId, fromMs: from, toMs: to,
        surfaces: Object.keys(lensMap).filter((s) => lensMap[s] === groupKey),
        limit,
      });

  const bars = await this.getBars({ lens, from, to, userId });
  const groupBar = bars.find((b) => b.groupKey === groupKey)
    || { eventCount: 0, totalCostUsd: 0, groupLabel: groupKey };
  const amortizedUnitCost = groupBar.eventCount > 0
    ? groupBar.totalCostUsd / groupBar.eventCount : 0;

  return {
    group: {
      key: groupKey,
      label: groupBar.groupLabel,
      totalCostUsd: groupBar.totalCostUsd,
      eventCount: groupBar.eventCount,
    },
    events: rows.map((r) => ({
      learningPointId: r.learning_point_id,
      ts: r.ts,
      featureSurface: r.feature_surface,
      proximateCallId: r.proximate_call_id,
      intent: r.intent || null,
      eventCostUsd: r.proximate_cost_usd != null ? r.proximate_cost_usd : amortizedUnitCost,
      amortized: r.proximate_call_id == null,
    })),
  };
}
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/AttributionService.js src/__tests__/utils/AttributionService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): AttributionService.getGroupDetail"
```

---

### Task 9: Instrument Director SessionRunner via helper

**Files:**
- Modify: `src/main/brain/director/SessionRunner.js` (around line 252)
- Create: `src/__tests__/brain/SessionRunner.attribution.test.js`

- [ ] **Step 1: Failing test**

```js
it('Director Leitner rating writes mastery_event with featureSurface + proximateCallId via helper', async () => {
  const db = freshDb();
  const traceId = 'trace-1';
  const callId = db.prepare(`INSERT INTO brain_call_ledger
    (intent, ts, provider, cost_usd, cache_hit, trace_id)
    VALUES ('director-session-step', ?, 'deepseek', 0.005, 0, ?)`
  ).run(Date.now(), traceId).lastInsertRowid;

  await simulateRunnerLeitnerRating({
    traceId, learningPointId: 'lp-x', rating: 3, userId: 1,
  });

  const ev = db.prepare(
    `SELECT feature_surface, proximate_call_id FROM mastery_event WHERE learning_point_id='lp-x'`
  ).get();
  expect(ev.feature_surface).toBe('director-session');
  expect(ev.proximate_call_id).toBe(callId);
});
```

(`simulateRunnerLeitnerRating` is a thin test-only helper that calls into the same code path SessionRunner takes when a Leitner rating arrives — match style of existing SessionRunner tests in `src/__tests__/brain/`.)

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Update SessionRunner.js (around line 252)**

Replace the existing `MasteryEventStore.record({...})` block with:

```js
if (decision.tool === 'openLeitnerCard' && userResult?.rating != null) {
  try {
    const recorder = require('../../db/masteryEventRecorder');
    recorder.recordWithProximateCall({
      traceId: state.traceId,
      surface: 'director-session',
      learningPointId: decision.args?.learningPointId,
      userId: state.userId,
      ts: Date.now(),
      eventType: 'review',
      rating: String(userResult.rating),
      source: 'director-session',
      sourceRef: state.traceId,
    });
  } catch (_e) { /* never break the session loop */ }
}
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/brain/director/SessionRunner.js src/__tests__/brain/SessionRunner.attribution.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): Director instrumentation via masteryEventRecorder"
```

---

### Task 10: Instrument `LearningPointManager` (production-prompt + manual-review)

**Files:**
- Modify: `src/main/db/LearningPointManager.js` (lines 608 + 1050)
- Create: `src/__tests__/main/LearningPointManager.attribution.test.js`

- [ ] **Step 1: Failing tests**

```js
it('applyProductionGrade writes featureSurface=production-prompt via helper', async () => {
  await LearningPointManager.applyProductionGrade({
    id: 'lp-1', userId: 1, /* ... grade payload ... */,
    proximateTraceId: 'trace-pp-1',
  });
  const ev = db.prepare(`SELECT feature_surface, proximate_call_id FROM mastery_event WHERE learning_point_id='lp-1'`).get();
  expect(ev.feature_surface).toBe('production-prompt');
});

it('updateLeitnerBoxAfterReview writes featureSurface=manual-review', async () => {
  await LearningPointManager.updateLeitnerBoxAfterReview('lp-2', 1, 3, /* ... */);
  const ev = db.prepare(`SELECT feature_surface FROM mastery_event WHERE learning_point_id='lp-2'`).get();
  expect(ev.feature_surface).toBe('manual-review');
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Update both sites**

At `LearningPointManager.js:608` (production grade write site), replace direct `MasteryEventStore.record({...})` with helper call:
```js
const recorder = require('./masteryEventRecorder');
recorder.recordWithProximateCall({
  traceId: opts?.proximateTraceId || null,  // extend function signature to accept this
  surface: 'production-prompt',
  learningPointId: id,
  userId,
  ts: Date.now(),
  eventType: 'mastery_change',
  prevBox: current.box,
  newBox: nextBox,
  prevMastery: current.masteryLevel,
  newMastery: nextMastery,
  source: 'production-grade',
});
```

At `LearningPointManager.js:1050` (user-review write site):
```js
const recorder = require('./masteryEventRecorder');
recorder.recordWithProximateCall({
  traceId: null,  // manual review has no LLM call
  surface: 'manual-review',
  learningPointId: id,
  userId,
  ts: Date.now(),
  eventType: 'box_change',
  prevBox: point.box,
  newBox,
  prevMastery: point.mastery_level ?? null,
  newMastery: masteryLevel,
  rating: String(rating),
  source: 'user-review',
});
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/db/LearningPointManager.js src/__tests__/main/LearningPointManager.attribution.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): LearningPointManager instrumentation via helper"
```

---

### Task 11: Instrument `MasteryEventBackfill` + lint guard

**Files:**
- Modify: `src/main/utils/MasteryEventBackfill.js` (4 sites)
- Create: `src/__tests__/lint/masteryEventCallSites.test.js`
- Modify (extend): `src/__tests__/utils/MasteryEventBackfill.test.js`

- [ ] **Step 1: Failing tests**

Backfill side (extend existing test): assert resulting `mastery_event` rows have `feature_surface='backfill'`.

Lint guard (`src/__tests__/lint/masteryEventCallSites.test.js`):
```js
const fs = require('fs');
const path = require('path');
const glob = require('glob');

it('every main-process MasteryEventStore.record call goes through masteryEventRecorder', () => {
  const files = glob.sync(path.join(__dirname, '../../main/**/*.js'));
  const violations = [];
  files.forEach((file) => {
    // Allow the recorder helper itself to call MasteryEventStore.record directly.
    if (file.endsWith('masteryEventRecorder.js')) return;
    if (file.endsWith('MasteryEventStore.js')) return;
    const src = fs.readFileSync(file, 'utf8');
    if (/MasteryEventStore\.record\s*\(/.test(src)) {
      violations.push(`${file}: direct MasteryEventStore.record call — should use masteryEventRecorder.recordWithProximateCall`);
    }
  });
  expect(violations).toEqual([]);
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Update all 4 backfill sites**

Replace each `MasteryEventStore.record({...})` in `MasteryEventBackfill.js` with `recorder.recordWithProximateCall({...})`, passing `traceId: null, surface: 'backfill'`.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/MasteryEventBackfill.js src/__tests__/lint/masteryEventCallSites.test.js src/__tests__/utils/MasteryEventBackfill.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): backfill via helper + lint guard for new write sites"
```

---

### Task 12: NEW write — `ComprehensionGradingService` emits mastery_event

**Files:**
- Modify: `src/main/utils/ComprehensionGradingService.js`
- Modify: `src/__tests__/utils/ComprehensionGradingService.test.js`

- [ ] **Step 1: Failing test**

```js
it('gradeAnswer emits mastery_event with featureSurface=comprehension when grade moves mastery', async () => {
  const result = await service.gradeAnswer({
    questionId: 'q-1', userId: 1, learningPointId: 'lp-1',
    answerText: 'a good answer', token: 't',
  });
  expect(result.gradeAffected).toBe(true);
  const ev = db.prepare(
    `SELECT feature_surface, proximate_call_id FROM mastery_event
     WHERE learning_point_id='lp-1' ORDER BY ts DESC LIMIT 1`
  ).get();
  expect(ev.feature_surface).toBe('comprehension');
  expect(ev.proximate_call_id).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Add the write**

In `gradeAnswer`, after the existing mastery-update logic:

```js
const recorder = require('../db/masteryEventRecorder');
recorder.recordWithProximateCall({
  traceId,  // from the brainCall('grade-comprehension', ...) options.traceId
  surface: 'comprehension',
  learningPointId,
  userId,
  ts: Date.now(),
  eventType: 'mastery_change',
  prevBox: prev.box, newBox: next.box,
  prevMastery: prev.mastery, newMastery: next.mastery,
  source: 'comprehension-grade',
  sourceRef: questionId,
});
```

(If `gradeAnswer` doesn't currently surface a traceId from the brainCall, extend the brainCall options to include one, then propagate.)

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/ComprehensionGradingService.js src/__tests__/utils/ComprehensionGradingService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): ComprehensionGradingService emits mastery_event via helper"
```

---

### Task 13: NEW write — `MicroCardProposer` accept emits mastery_event

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

- [ ] **Step 3: Add the write in accept path**

After successful learning_point write following acceptance:
```js
const recorder = require('../db/masteryEventRecorder');
recorder.recordWithProximateCall({
  traceId: null,                       // chained — no single proximate call
  surface: 'reading-microcard',
  learningPointId: newLpId,
  userId,
  ts: Date.now(),
  eventType: 'mastery_change',
  prevBox: null,
  newBox: 1,
  prevMastery: null,
  newMastery: 0,
  source: 'microcard-accept',
});
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/main/utils/MicroCardProposer.js src/__tests__/utils/MicroCardProposer.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): MicroCardProposer accept emits mastery_event via helper"
```

---

### Task 14: IPC — extend `callLedgerHandlers` + `callLedgerApi`

**Files:**
- Modify: `src/main/ipc/callLedgerHandlers.js`
- Modify: `src/renderer/api/callLedgerApi.js`
- Modify (or create): `src/__tests__/ipc/callLedgerHandlers.attribution.test.js`

No new attributionHandlers file. No new attributionApi file. The Attribution IPC lives alongside its sibling cost queries.

- [ ] **Step 1: Failing tests**

Handlers test asserts 3 new channels registered:
```js
it('registers 3 attribution channels on callLedgerHandlers', () => {
  const channels = [];
  const ipcMain = { handle: (ch) => channels.push(ch) };
  registerCallLedgerHandlers(ipcMain);
  expect(channels).toEqual(expect.arrayContaining([
    'callLedger:attributionBars',
    'callLedger:attributionGroupDetail',
    'callLedger:attributionDensityStrip',
  ]));
});
```

Renderer api test: set up `window.electron = { ipcRenderer: { invoke } }` (per project pattern); assert `callLedgerApi.attributionBars(...)` invokes the right channel.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

In `callLedgerHandlers.js`, add:
```js
const AttributionService = require('../utils/AttributionService');
const attribution = new AttributionService();

ipcMain.handle('callLedger:attributionBars', (_e, opts) => attribution.getBars(opts));
ipcMain.handle('callLedger:attributionGroupDetail', (_e, opts) => attribution.getGroupDetail(opts));
ipcMain.handle('callLedger:attributionDensityStrip', (_e, opts) => attribution.getDensityStrip(opts));
```

In `callLedgerApi.js`, append to the exported object:
```js
attributionBars(opts) {
  return window.electron.ipcRenderer.invoke('callLedger:attributionBars', opts);
},
attributionGroupDetail(opts) {
  return window.electron.ipcRenderer.invoke('callLedger:attributionGroupDetail', opts);
},
attributionDensityStrip(userId) {
  return window.electron.ipcRenderer.invoke('callLedger:attributionDensityStrip', { userId });
},
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Smoke**
```bash
npm run test:smoke
```
Expected PASS.

- [ ] **Step 6: Commit**
```bash
git add src/main/ipc/callLedgerHandlers.js src/renderer/api/callLedgerApi.js src/__tests__/ipc/callLedgerHandlers.attribution.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): attribution IPC on callLedger (no parallel api)"
```

---

### Task 15: `ROITab` + `LensToggle` + `AttributionBarChart` + mount in `EconomicsPanel`

**Files:**
- Create: `src/renderer/components/brainShell/spendReturns/ROITab.jsx`
- Create: `src/renderer/components/brainShell/spendReturns/LensToggle.jsx`
- Create: `src/renderer/components/brainShell/spendReturns/AttributionBarChart.jsx`
- Modify: `src/renderer/components/brainShell/EconomicsPanel.jsx` — add **ROI** as new tab + set as **default** + change displayed title to "Spend & Returns"
- Create: `src/__tests__/renderer/ROITab.test.jsx`

This is the additive integration — no rename, no shim. The tab order becomes: **ROI** (new default) / By Intent (existing) / By Provider (existing) / By Session (existing Phase 10b-3).

- [ ] **Step 1: Failing tests**

```jsx
// ROITab.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import ROITab from '../../renderer/components/brainShell/spendReturns/ROITab';

jest.mock('../../renderer/api/callLedgerApi', () => ({
  attributionBars: jest.fn().mockResolvedValue([
    { groupKey: 'focused-session', groupLabel: 'Focused session',
      eventCount: 5, totalCostUsd: 0.05, costPerEvent: 0.01,
      directlyAttributedCount: 5, amortizedCount: 0 },
    { groupKey: 'while-reading', groupLabel: 'While reading',
      eventCount: 3, totalCostUsd: 0.06, costPerEvent: 0.02,
      directlyAttributedCount: 0, amortizedCount: 3 },
  ]),
  attributionDensityStrip: jest.fn().mockResolvedValue([]),
}));

it('renders one row per bar with label and $/move', async () => {
  render(<ROITab />);
  await waitFor(() => screen.getByText('Focused session'));
  expect(screen.getByText(/\$0\.01\s*\/\s*move/)).toBeInTheDocument();
  expect(screen.getByText(/\$0\.02\s*\/\s*move/)).toBeInTheDocument();
});

it('LensToggle switches between Attention / Phase / Intent', async () => {
  render(<ROITab />);
  const phaseBtn = await screen.findByRole('button', { name: /Phase/i });
  phaseBtn.click();
  await waitFor(() =>
    expect(require('../../renderer/api/callLedgerApi').attributionBars).toHaveBeenCalledWith(
      expect.objectContaining({ lens: 'phase' }),
    ),
  );
});
```

Test for EconomicsPanel showing the new tab + default + title:
```jsx
it('EconomicsPanel shows ROI tab first and selects it by default', () => {
  render(<EconomicsPanel />);
  const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
  expect(tabs[0]).toBe('ROI');
  expect(screen.getByRole('tab', { name: 'ROI', selected: true })).toBeInTheDocument();
  expect(screen.getByText('Spend & Returns')).toBeInTheDocument();  // new title
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

`LensToggle.jsx`:
```jsx
import { ToggleButtonGroup, ToggleButton } from '@mui/material';

export default function LensToggle({ value, onChange }) {
  return (
    <ToggleButtonGroup
      value={value} exclusive size="small"
      onChange={(_, v) => v && onChange(v)}
    >
      <ToggleButton value="attention">Attention</ToggleButton>
      <ToggleButton value="phase">Phase</ToggleButton>
      <ToggleButton value="intent">Intent</ToggleButton>
    </ToggleButtonGroup>
  );
}
```

`AttributionBarChart.jsx` — for each bar, MUI row with: label, `LinearProgress` proportional to `cost / maxCost`, headline `$X / move`, count chip. `onBarClick(groupKey)` on row click.

`ROITab.jsx`:
```jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Stack, Typography } from '@mui/material';
import callLedgerApi from '../../../api/callLedgerApi';
import LensToggle from './LensToggle';
import AttributionBarChart from './AttributionBarChart';

const DAY = 86_400_000;

export default function ROITab() {
  const [lens, setLens] = useState(() =>
    localStorage.getItem('phase13.lens') || 'attention');
  const [window, setWindow] = useState(() => {
    const saved = localStorage.getItem('phase13.window');
    if (saved) try { return JSON.parse(saved); } catch (_e) {}
    return { from: Date.now() - 30 * DAY, to: Date.now() };
  });
  const [bars, setBars] = useState([]);

  useEffect(() => { localStorage.setItem('phase13.lens', lens); }, [lens]);
  useEffect(() => { localStorage.setItem('phase13.window', JSON.stringify(window)); }, [window]);

  const refresh = useCallback(async () => {
    setBars(await callLedgerApi.attributionBars({
      lens, from: window.from, to: window.to, userId: 1,
    }) || []);
  }, [lens, window]);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      <LensToggle value={lens} onChange={setLens} />
      <AttributionBarChart bars={bars} />
      {/* BrushableDensityStrip arrives in Task 16 */}
      {/* GroupDetailDrawer arrives in Task 17 */}
    </Stack>
  );
}
```

`EconomicsPanel.jsx` modifications:
- Change the title `<Typography>` from "Economics" to "Spend & Returns".
- Add `<Tab value="roi" label="ROI" />` as the **first** tab.
- Default `viewTab` initial state from `'intent'` → `'roi'`.
- Add conditional rendering: `{viewTab === 'roi' && <ROITab />}` above the existing By Intent / By Provider / By Session table rendering.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/renderer/components/brainShell/spendReturns/ROITab.jsx src/renderer/components/brainShell/spendReturns/LensToggle.jsx src/renderer/components/brainShell/spendReturns/AttributionBarChart.jsx src/renderer/components/brainShell/EconomicsPanel.jsx src/__tests__/renderer/ROITab.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): ROI as new default tab in EconomicsPanel (Spend & Returns)"
```

---

### Task 16: `BrushableDensityStrip` extending `MasteryTrajectoryStrip` visual pattern

**Files:**
- Create: `src/renderer/components/brainShell/spendReturns/BrushableDensityStrip.jsx`
- Modify: `src/renderer/components/brainShell/spendReturns/ROITab.jsx` (mount strip above bars; window-state drives bars refresh)
- Create: `src/__tests__/renderer/BrushableDensityStrip.test.jsx`

Reference: `src/renderer/views/brainVisibility/MasteryTrajectoryStrip.jsx` — match the SVG-rect-per-day visual idiom. The new component adds two draggable brush handles + selection highlight on top.

- [ ] **Step 1: Failing tests**

```jsx
it('renders one rect per day in densityData', () => {
  const data = [
    { day: '2026-06-01', count: 5 },
    { day: '2026-06-02', count: 3 },
  ];
  const { container } = render(
    <BrushableDensityStrip densityData={data} selected={{ from: ..., to: ... }} onChange={jest.fn()} />
  );
  expect(container.querySelectorAll('rect.density-day').length).toBe(2);
});

it('fires onChange when brush handle is dragged', () => {
  const onChange = jest.fn();
  // ... simulate pointer events on handle ...
  expect(onChange).toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

- Open `src/renderer/views/brainVisibility/MasteryTrajectoryStrip.jsx` for visual reference.
- Match its `<svg>` shell, dimensions, color tokens, and tooltip pattern.
- Render `<rect class="density-day">` per data point, height scaled by `count / maxCount`.
- Overlay two `<rect class="brush-handle">` at `selected.from` / `selected.to` positions; one `<rect class="brush-region">` between them with semi-opaque fill.
- Pointer events: `pointerdown` on handle, `pointermove` on window, `pointerup` releases — emit new `{from, to}` on each move.

`ROITab.jsx` change:
```jsx
import BrushableDensityStrip from './BrushableDensityStrip';
const [density, setDensity] = useState([]);
useEffect(() => {
  callLedgerApi.attributionDensityStrip(1).then((rows) => setDensity(rows || []));
}, []);
// in render, above LensToggle:
<BrushableDensityStrip densityData={density} selected={window} onChange={setWindow} />
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**
```bash
git add src/renderer/components/brainShell/spendReturns/BrushableDensityStrip.jsx src/renderer/components/brainShell/spendReturns/ROITab.jsx src/__tests__/renderer/BrushableDensityStrip.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): BrushableDensityStrip matching MasteryTrajectoryStrip visuals"
```

---

### Task 17: `GroupDetailDrawer` + `AmortizedBadge` + RationaleCard drill-down

**Files:**
- Create: `src/renderer/components/brainShell/spendReturns/GroupDetailDrawer.jsx`
- Create: `src/renderer/components/brainShell/spendReturns/AmortizedBadge.jsx`
- Modify: `src/renderer/components/brainShell/spendReturns/ROITab.jsx`
- Modify: `src/renderer/components/brainShell/spendReturns/AttributionBarChart.jsx` (expand-in-place sub-bars on click)
- Create: `src/__tests__/renderer/GroupDetailDrawer.test.jsx`

- [ ] **Step 1: Failing tests**

```jsx
it('Drawer opens on bar click with group label + event rows', async () => {
  render(<ROITab />);
  await waitFor(() => screen.getByText('Focused session'));
  screen.getByText('Focused session').click();  // expands sub-bars
  // ... click a sub-bar → drawer opens ...
  await waitFor(() => screen.getByRole('presentation'));  // Drawer
  expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
});

it('amortized event row shows AmortizedBadge', async () => {
  // ... mount drawer with events: [{ amortized: true, ... }] ...
  expect(screen.getByText(/amortized/i)).toBeInTheDocument();
});

it('clicking a direct-attributed event opens RationaleCard via callId', async () => {
  const onOpenRationale = jest.fn();
  // ... mount drawer with onOpenRationale prop ...
  // click event row with proximateCallId
  expect(onOpenRationale).toHaveBeenCalledWith(expect.any(Number));
});
```

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement**

`AmortizedBadge.jsx`:
```jsx
import { Chip, Tooltip } from '@mui/material';
export default function AmortizedBadge() {
  return (
    <Tooltip title="Cost shared across this surface's events — no single call directly attributable.">
      <Chip size="small" label="amortized" variant="outlined" />
    </Tooltip>
  );
}
```

`GroupDetailDrawer.jsx`:
```jsx
import React, { useEffect, useState } from 'react';
import { Drawer, List, ListItem, ListItemText, Typography, Stack } from '@mui/material';
import callLedgerApi from '../../../api/callLedgerApi';
import AmortizedBadge from './AmortizedBadge';

export default function GroupDetailDrawer({ open, onClose, lens, groupKey, window, userId, onOpenRationale }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    if (!open) return;
    callLedgerApi.attributionGroupDetail({
      lens, groupKey, from: window.from, to: window.to, userId,
    }).then(setDetail);
  }, [open, lens, groupKey, window]);
  if (!detail) return <Drawer open={open} onClose={onClose} anchor="right" />;
  return (
    <Drawer open={open} onClose={onClose} anchor="right">
      <Stack sx={{ p: 2, width: 420 }}>
        <Typography variant="h6">{detail.group.label}</Typography>
        <Typography variant="caption">
          {detail.group.eventCount} events · ${detail.group.totalCostUsd.toFixed(4)}
        </Typography>
        <List>
          {detail.events.map((ev) => (
            <ListItem
              key={`${ev.learningPointId}-${ev.ts}`}
              onClick={() => !ev.amortized && onOpenRationale(ev.proximateCallId)}
              sx={{ cursor: ev.amortized ? 'default' : 'pointer' }}
            >
              <ListItemText
                primary={ev.learningPointId}
                secondary={new Date(ev.ts).toLocaleString()}
              />
              {ev.amortized ? <AmortizedBadge /> : <Typography variant="caption">${ev.eventCostUsd.toFixed(4)}</Typography>}
            </ListItem>
          ))}
        </List>
      </Stack>
    </Drawer>
  );
}
```

`AttributionBarChart.jsx` enhancement: track `expandedKey`; when a bar is clicked, expand it and fetch L1 sub-bars via `callLedgerApi.attributionBars({ lens: 'intent', ... })` filtered to that group's surfaces. On sub-bar click, fire `onIntentSubBarClick(intent)`.

`ROITab.jsx`: manage `drawerState = { open, lens, groupKey }`. Pass `onIntentSubBarClick = (intent) => setDrawerState({ open: true, lens: 'intent', groupKey: intent })`. Pass `onOpenRationale = (callId) => /* mount existing RationaleCard */`.

For `RationaleCard` integration: verify its import path (likely `src/renderer/components/brainShell/RationaleCard.jsx`); if a modal-style mount component doesn't exist yet, render conditionally inside `ROITab` keyed on `selectedCallId`.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Smoke**
```bash
npm run test:smoke
```

- [ ] **Step 6: Commit**
```bash
git add src/renderer/components/brainShell/spendReturns/GroupDetailDrawer.jsx src/renderer/components/brainShell/spendReturns/AmortizedBadge.jsx src/renderer/components/brainShell/spendReturns/ROITab.jsx src/renderer/components/brainShell/spendReturns/AttributionBarChart.jsx src/__tests__/renderer/GroupDetailDrawer.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): GroupDetailDrawer + AmortizedBadge + RationaleCard wiring"
```

---

### Task 18: End-to-end integration test + CONTEXT.md update

**Files:**
- Create: `src/__tests__/integration/attributionHappyPath.test.js`
- Modify: `CONTEXT.md` — add Phase 13 glossary entries

- [ ] **Step 1: Integration test**

Sequence in one test file:
1. `freshDb` from `db.sql`.
2. Insert fake user + book + 3 learning_points.
3. Simulate Director session: insert `brain_call_ledger` row + helper-record a `mastery_event` with `featureSurface='director-session'` and matching `proximateCallId`.
4. Simulate Comprehension grade: insert another `brain_call_ledger` row + helper-record a `mastery_event` with `featureSurface='comprehension'` and matching `proximateCallId`.
5. Simulate Micro-card accept: helper-record a `mastery_event` with `featureSurface='reading-microcard'` and `proximateCallId=null`.
6. Call `new AttributionService().getBars({ lens: 'attention', from: 0, to: now+1, userId: 1 })`.
7. Assert: 2 groups present (focused-session, while-reading), correct counts, correct totalCostUsd, while-reading is fully amortized.
8. Call `getGroupDetail({ lens: 'attention', groupKey: 'focused-session', ... })`.
9. Assert: 2 events, both with `proximateCallId` set, `amortized: false`.
10. Call `getDensityStrip({ userId: 1 })`. Assert one day with count 3.

- [ ] **Step 2: Run via `npm run test:integration`**

Run: `npm run test:integration -- attributionHappyPath`
Expected: PASS. (The test:integration wrapper handles the better-sqlite3 ABI swap.)

- [ ] **Step 3: Update CONTEXT.md**

Add a new section to `CONTEXT.md` (per project glossary format), preferably after the existing Phase 9 Brain Spine block:

```markdown
## Phase 13 — Attribution Layer (2026-06-18 design)

- **Attribution Layer** — Phase 13 surface joining `brain_call_ledger ⋈ mastery_event` to surface cost-per-mastery-move. Implemented as the **ROI** tab of the Spend & Returns Panel (formerly Economics Panel). *Not "attribution tracking" generically; specifically the LLM-ROI lens.*
- **Feature Surface** — closed enum value identifying which product surface caused a mastery move. Stored on `mastery_event.feature_surface`. 8 values: `reading-microcard`, `director-session`, `comprehension`, `production-prompt`, `pre-reading-diagnostic`, `manual-review`, `backfill`, `unknown` (lint guard). Lives in `src/commons/model/featureSurface.js`. *Not "source" — `mastery_event.source` is the older free-text label.*
- **Proximate Call** — when a single LLM call directly produced a mastery move, its ledger row id is stored on `mastery_event.proximate_call_id`. Enables exact $-attribution for the Director / Comprehension / Production-grade paths.
- **Amortized Cost** — for surfaces where causation chains across multiple calls (e.g. micro-card extraction → propose → user-accept), per-event cost = total surface spend in window ÷ surface event count in window. Displayed with an "amortized" badge.
- **Attention State** (L3 lens) — domain-meaningful grouping of feature surfaces: `while-reading`, `focused-session`, `historical`. Default lens on the ROI tab.
- **Phase Group** (L2 lens) — feature-surface grouping aligned with project phases: `reading-loop`, `director`, `comprehension`, `production-prompts`, `diagnostics`, `manual-review`, `historical`.
- **Spend & Returns Panel** — renamed display title of the existing `EconomicsPanel`. File name and import path unchanged.
```

- [ ] **Step 4: Commit (one commit for test + docs)**
```bash
git add src/__tests__/integration/attributionHappyPath.test.js CONTEXT.md
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-13): integration test + CONTEXT.md glossary update"
```

---

## Self-Review Checklist (run before declaring done)

- [ ] All 18 commits land on `main` cleanly (no force, no rebase, no amend).
- [ ] `npm run test:smoke` PASSES after Tasks 14 and 17 (the two main-process touches that could break boot).
- [ ] No `mastery_event` row ends up with `feature_surface='unknown'` after the integration test (lint guard catches new write sites that forgot the helper).
- [ ] `EconomicsPanel.jsx` file path unchanged — no import sites broken.
- [ ] No new file named `attributionApi.js` or `attributionHandlers.js` exists — all attribution IPC lives on `callLedgerHandlers` / `callLedgerApi`.
- [ ] All mastery-write sites go through `masteryEventRecorder.recordWithProximateCall` — `MasteryEventStore.record` is called only by the recorder and (legally) by its own file.
- [ ] `featureSurface.js` is the **only** location of the enum + lens maps; main + renderer both import from there.
- [ ] `BrushableDensityStrip` visual idiom matches `MasteryTrajectoryStrip` (SVG `<rect>`-per-day, same color tokens).
- [ ] CONTEXT.md has the Phase 13 glossary block.

---

## Changes from v1 plan (for reviewer reference)

The first draft of this plan had 19 tasks. After integration review, 5 issues were caught and fixed:

| Issue | v1 approach | v2 approach |
|-------|-------------|-------------|
| EconomicsPanel rename + shim | Rename to SpendReturnsPanel, thin re-export shim | Keep file + import path, change displayed title inline (Phase 10b-3 precedent) |
| Parallel `attributionApi` + `attributionHandlers` | New IPC bridge + renderer client | Extend existing `callLedgerHandlers` + `callLedgerApi` (matches `aggregateByIntent` pattern) |
| Hand-rolled trace lookup in 5 sites | Each site has 4-line lookup query | Single `masteryEventRecorder.recordWithProximateCall(...)` helper |
| Missing data migration for existing backfill rows | Dropped from plan | `UPDATE mastery_event SET feature_surface='backfill' WHERE source='backfill'` in `db.sql` |
| Enum location | `src/main/db/masteryEventEnums.js` (main-only) | `src/commons/model/featureSurface.js` (main + renderer share) |
| Density strip with no visual reference | New strip, no design tie | Explicitly extends `MasteryTrajectoryStrip` visual pattern |
| CONTEXT.md as self-review item | Buried in checklist | Real task step (Task 18) |

Task count: 18 (down from 19 — `getDensityStrip` collapsed into the contract task since CallLedgerStore now owns the raw SQL).
