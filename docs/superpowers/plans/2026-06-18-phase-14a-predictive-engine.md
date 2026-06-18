# Phase 14a — Predictive Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the empirical-Bayes engine that returns `{ expectedMasteryDelta, pBoxUp, expectedCost, n, shrinkageLevel }` per `(feature_surface, current_box, domain)` cell, plus a calibration report card UI proving it works. No consumer surfaces (14b–e ship separately).

**Architecture:** Pure backend service in `src/main/brain/predictive/` reading `mastery_event ⋈ brain_call_ledger`. Closed-form Beta-Binomial + Normal-Inverse-Gamma conjugate updates, hierarchical shrinkage (cell → surface-box → surface → global). Model cached as JSON in userData; nightly heartbeat refresh. IPC + renderer client + one `PredictionsTab` in `BrainDashboardPanel`.

**Tech Stack:** Node/Electron, better-sqlite3 (read-only here — no schema changes), Jest. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-06-18-phase-14a-predictive-engine-design.md](../specs/2026-06-18-phase-14a-predictive-engine-design.md).

**Project conventions to follow:**
- Run single Jest tests with `npx jest <path>` (not `npm test`).
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m ...`.
- Don't skip pre-commit hooks. Don't write git config.
- Smoke test via `npm run test:smoke`.
- No destructive git operations.
- All engine code lives in main process; renderer-side restricted to API client + components.
- Open-source-first provider stance; cost examples use DeepSeek baseline (~$0.27/MTok).

---

## Task 1: Define PredictiveEngine contract

**Files:**
- Create: `src/main/brain/predictive/PredictiveEngine.js`
- Create: `src/main/brain/predictive/predictiveEnums.js`

- [ ] **Step 1: Create enum/constants module**

```js
// src/main/brain/predictive/predictiveEnums.js
const SHRINKAGE_LEVELS = Object.freeze({
  CELL: 'cell',
  SURFACE_BOX: 'surface-box',
  SURFACE: 'surface',
  GLOBAL: 'global',
});

// NIG conjugate prior strength (effective prior sample size for continuous Δmastery)
const KAPPA_0 = 4;

// Beta prior (uniform-ish, weakly informative on box-up rate)
const ALPHA_0 = 2;
const BETA_0 = 2;

// Surfaces excluded from prediction (Phase 13 lint guard says 'unknown' is illegal;
// 'backfill' is historical and has no causal model to predict).
const EXCLUDED_SURFACES = Object.freeze(['unknown', 'backfill']);

// Min cell n for "trustworthy" coverage in calibration report.
const COVERAGE_MIN_N = 10;

// Refresh interval — heartbeat refreshes once per 24h unless force.
const REFRESH_INTERVAL_MS = 24 * 3600 * 1000;

// Default rolling window for cost prediction and calibration.
const DEFAULT_WINDOW_DAYS = 30;

module.exports = {
  SHRINKAGE_LEVELS,
  KAPPA_0,
  ALPHA_0,
  BETA_0,
  EXCLUDED_SURFACES,
  COVERAGE_MIN_N,
  REFRESH_INTERVAL_MS,
  DEFAULT_WINDOW_DAYS,
};
```

- [ ] **Step 2: Create engine skeleton with throwing bodies**

```js
// src/main/brain/predictive/PredictiveEngine.js
/**
 * Phase 14a Predictive Engine.
 *
 * Empirical-Bayes model over mastery_event ⋈ brain_call_ledger.
 * Cells: (feature_surface, current_box, domain). Hierarchical shrinkage to
 * (surface, box) → (surface) → global. Cached in userData/predictive_model.json.
 *
 * See docs/superpowers/specs/2026-06-18-phase-14a-predictive-engine-design.md
 */

class PredictiveEngine {
  /**
   * @param {object} args
   * @param {string} args.featureSurface - one of the 8 non-excluded surfaces
   * @param {number} args.currentBox - Leitner box 1..5
   * @param {string} args.domain - learning-point domain
   * @returns {Promise<{
   *   expectedMasteryDelta: number, deltaStd: number, pBoxUp: number,
   *   expectedCost: number, p95Cost: number, n: number,
   *   shrinkageLevel: 'cell'|'surface-box'|'surface'|'global',
   *   computedAt: number,
   * }>}
   */
  async predict(_args) { throw new Error('not implemented'); }

  /**
   * @param {Array<{featureSurface:string,currentBox:number,domain:string,ref?:any}>} candidates
   * @returns {Promise<Array<{prediction:object,roi:number,ref?:any,featureSurface:string,currentBox:number,domain:string}>>}
   */
  async rankCandidates(_candidates) { throw new Error('not implemented'); }

  /**
   * @param {{force?:boolean}} opts
   * @returns {Promise<{refreshed:boolean, cells:number, computedAt:number}>}
   */
  async refreshModel(_opts) { throw new Error('not implemented'); }

  /**
   * @param {{windowDays?:number}} opts
   * @returns {Promise<{
   *   reliability: Array<{bin:number,predictedDelta:number,realizedDelta:number,n:number}>,
   *   brierScore: number, coverage: number, asOf: number,
   * }>}
   */
  async calibrationReport(_opts) { throw new Error('not implemented'); }
}

module.exports = PredictiveEngine;
module.exports.PredictiveEngine = PredictiveEngine;
```

- [ ] **Step 3: Verify file parses**

Run: `node -e "require('./src/main/brain/predictive/PredictiveEngine.js'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/main/brain/predictive/
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): PredictiveEngine contract + enums"
```

---

## Task 2: Boundary test

**Files:**
- Create: `src/__tests__/brain/PredictiveEngine.contract.test.js`

- [ ] **Step 1: Write the failing contract test**

```js
// src/__tests__/brain/PredictiveEngine.contract.test.js
const PredictiveEngine = require('../../main/brain/predictive/PredictiveEngine');

describe('PredictiveEngine contract', () => {
  const engine = new PredictiveEngine();

  test('predict throws not implemented', async () => {
    await expect(engine.predict({
      featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary',
    })).rejects.toThrow(/not implemented/);
  });

  test('rankCandidates throws not implemented', async () => {
    await expect(engine.rankCandidates([])).rejects.toThrow(/not implemented/);
  });

  test('refreshModel throws not implemented', async () => {
    await expect(engine.refreshModel({})).rejects.toThrow(/not implemented/);
  });

  test('calibrationReport throws not implemented', async () => {
    await expect(engine.calibrationReport({})).rejects.toThrow(/not implemented/);
  });
});
```

- [ ] **Step 2: Run — verify it passes (because the throws are real)**

Run: `npx jest src/__tests__/brain/PredictiveEngine.contract.test.js`
Expected: PASS 4/4. This test pins the API surface; it'll need updating as methods are implemented.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/brain/PredictiveEngine.contract.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(phase-14a): pin PredictiveEngine API surface"
```

---

## Task 3: DAO — read mastery events by cell

**Files:**
- Create: `src/main/brain/predictive/predictiveDao.js`
- Create: `src/__tests__/brain/predictiveDao.test.js`

- [ ] **Step 1: Write failing test**

```js
// src/__tests__/brain/predictiveDao.test.js
const Database = require('better-sqlite3');

jest.mock('../../main/db/dbManager', () => {
  const db = new (require('better-sqlite3'))(':memory:');
  db.exec(`
    CREATE TABLE mastery_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learning_point_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      prev_box INTEGER, new_box INTEGER,
      prev_mastery REAL, new_mastery REAL,
      rating TEXT, source TEXT NOT NULL, source_ref TEXT, notes TEXT,
      proximate_call_id INTEGER, feature_surface TEXT NOT NULL DEFAULT 'unknown'
    );
    CREATE TABLE learning_point (
      id TEXT PRIMARY KEY, user_id INTEGER, book_id INTEGER,
      domain_type TEXT, box INTEGER, mastery_level REAL,
      created_at TEXT, updated_at TEXT
    );
  `);
  return { __db: db, getDb: () => db };
});

const dbManagerMock = require('../../main/db/dbManager');
const dao = require('../../main/brain/predictive/predictiveDao');

describe('predictiveDao.aggregateMasteryEventsByCell', () => {
  beforeEach(() => {
    dbManagerMock.__db.exec('DELETE FROM mastery_event; DELETE FROM learning_point;');
  });

  test('returns per-cell aggregates with n, sumDelta, sumDeltaSq, boxUpCount', () => {
    const lp = (id, dom) => dbManagerMock.__db.prepare(
      `INSERT INTO learning_point (id, user_id, domain_type, box, mastery_level)
       VALUES (?, 1, ?, 1, 30)`
    ).run(id, dom);
    lp('lp-v1', 'vocabulary');
    lp('lp-v2', 'vocabulary');

    const insert = dbManagerMock.__db.prepare(`
      INSERT INTO mastery_event
      (learning_point_id, user_id, ts, event_type, prev_box, new_box,
       prev_mastery, new_mastery, source, feature_surface)
      VALUES (?, 1, ?, 'mastery_change', ?, ?, ?, ?, 'user-review', ?)
    `);
    insert.run('lp-v1', 1000, 1, 2, 30, 40, 'director-session'); // +10, box up
    insert.run('lp-v1', 1100, 1, 1, 40, 50, 'director-session'); // +10, box flat
    insert.run('lp-v2', 1200, 1, 2, 30, 35, 'director-session'); // +5, box up

    const rows = dao.aggregateMasteryEventsByCell({ fromMs: 0, toMs: 9999 });
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        featureSurface: 'director-session',
        currentBox: 1, // prev_box
        domain: 'vocabulary',
        n: 3,
        sumDelta: 25,
        boxUpCount: 2,
      }),
    ]));
  });

  test('excludes unknown and backfill surfaces', () => {
    dbManagerMock.__db.prepare(
      `INSERT INTO learning_point (id, user_id, domain_type, box, mastery_level)
       VALUES ('lp-x', 1, 'vocabulary', 1, 30)`
    ).run();
    dbManagerMock.__db.prepare(`
      INSERT INTO mastery_event
      (learning_point_id, user_id, ts, event_type, prev_box, new_box,
       prev_mastery, new_mastery, source, feature_surface)
      VALUES ('lp-x', 1, 500, 'mastery_change', 1, 2, 30, 40, 'backfill', 'backfill')
    `).run();
    const rows = dao.aggregateMasteryEventsByCell({ fromMs: 0, toMs: 9999 });
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL ("module not found" or undefined)**

Run: `npx jest src/__tests__/brain/predictiveDao.test.js`
Expected: FAIL — `aggregateMasteryEventsByCell is not a function` / no such module.

- [ ] **Step 3: Implement DAO**

```js
// src/main/brain/predictive/predictiveDao.js
const dbManager = require('../../db/dbManager');
const { EXCLUDED_SURFACES } = require('./predictiveEnums');

function aggregateMasteryEventsByCell({ fromMs, toMs }) {
  const excluded = EXCLUDED_SURFACES.map(() => '?').join(',');
  const rows = dbManager.getDb().prepare(`
    SELECT
      e.feature_surface AS featureSurface,
      e.prev_box AS currentBox,
      lp.domain_type AS domain,
      COUNT(*) AS n,
      COALESCE(SUM(e.new_mastery - e.prev_mastery), 0) AS sumDelta,
      COALESCE(SUM((e.new_mastery - e.prev_mastery) * (e.new_mastery - e.prev_mastery)), 0) AS sumDeltaSq,
      SUM(CASE WHEN e.new_box > e.prev_box THEN 1 ELSE 0 END) AS boxUpCount
    FROM mastery_event e
    JOIN learning_point lp ON lp.id = e.learning_point_id
    WHERE e.ts >= ? AND e.ts < ?
      AND e.feature_surface NOT IN (${excluded})
      AND e.prev_box IS NOT NULL
      AND e.prev_mastery IS NOT NULL AND e.new_mastery IS NOT NULL
      AND lp.domain_type IS NOT NULL
    GROUP BY e.feature_surface, e.prev_box, lp.domain_type
  `).all(fromMs, toMs, ...EXCLUDED_SURFACES);
  return rows;
}

module.exports = { aggregateMasteryEventsByCell };
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx jest src/__tests__/brain/predictiveDao.test.js`
Expected: PASS 2/2.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/predictive/predictiveDao.js src/__tests__/brain/predictiveDao.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): DAO — aggregate mastery_events by cell"
```

---

## Task 4: DAO — read cost per surface

**Files:**
- Modify: `src/main/brain/predictive/predictiveDao.js` (add `aggregateCostBySurface`)
- Modify: `src/__tests__/brain/predictiveDao.test.js` (add cost tests; extend mock)

- [ ] **Step 1: Extend the in-memory mock with brain_call_ledger**

Add to the `jest.mock` block in the existing test file:

```js
  db.exec(`
    CREATE TABLE brain_call_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      intent TEXT NOT NULL,
      provider TEXT,
      cost_usd REAL DEFAULT 0,
      cache_hit INTEGER DEFAULT 0
    );
  `);
```

- [ ] **Step 2: Write failing test**

Append to `predictiveDao.test.js`:

```js
describe('predictiveDao.aggregateCostBySurface', () => {
  beforeEach(() => {
    dbManagerMock.__db.exec(
      'DELETE FROM mastery_event; DELETE FROM brain_call_ledger; DELETE FROM learning_point;'
    );
  });

  test('returns mean + p95 cost per direct surface via proximate_call_id', () => {
    dbManagerMock.__db.prepare(
      `INSERT INTO learning_point (id, user_id, domain_type, box, mastery_level)
       VALUES ('lp-1', 1, 'vocabulary', 1, 30)`
    ).run();

    const insertCall = dbManagerMock.__db.prepare(
      `INSERT INTO brain_call_ledger (ts, intent, provider, cost_usd)
       VALUES (?, ?, ?, ?)`
    );
    const c1 = insertCall.run(100, 'director-session-step', 'deepseek', 0.001).lastInsertRowid;
    const c2 = insertCall.run(200, 'director-session-step', 'deepseek', 0.003).lastInsertRowid;
    const c3 = insertCall.run(300, 'director-session-step', 'deepseek', 0.005).lastInsertRowid;

    const insertEvent = dbManagerMock.__db.prepare(`
      INSERT INTO mastery_event
      (learning_point_id, user_id, ts, event_type, prev_box, new_box,
       prev_mastery, new_mastery, source, feature_surface, proximate_call_id)
      VALUES ('lp-1', 1, ?, 'review', 1, 2, 30, 40, 'director-session', 'director-session', ?)
    `);
    insertEvent.run(110, c1);
    insertEvent.run(210, c2);
    insertEvent.run(310, c3);

    const rows = dao.aggregateCostBySurface({ fromMs: 0, toMs: 9999 });
    const dir = rows.find((r) => r.featureSurface === 'director-session');
    expect(dir.meanCost).toBeCloseTo(0.003, 5);   // (0.001+0.003+0.005)/3
    expect(dir.p95Cost).toBeCloseTo(0.005, 5);     // exact-3 p95 = top value
    expect(dir.n).toBe(3);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx jest src/__tests__/brain/predictiveDao.test.js`
Expected: FAIL — `aggregateCostBySurface is not a function`.

- [ ] **Step 4: Implement**

Append to `predictiveDao.js`:

```js
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[Math.max(0, idx)];
}

function aggregateCostBySurface({ fromMs, toMs }) {
  // Direct attribution: join via proximate_call_id.
  // Per spec section 3.2, this captures Director / Comprehension / Production-Grade.
  // Amortized surfaces (reading-microcard, pre-reading-diagnostic) are handled
  // by a separate path that splits surface spend evenly across its events;
  // we reuse Phase 13's AttributionService for that in the consumer caller
  // when needed. v1: report directly-attributed cost only and let predict()
  // gracefully report 0 for non-direct surfaces (PRD section 5 "graceful").
  const rows = dbManager.getDb().prepare(`
    SELECT e.feature_surface AS featureSurface, c.cost_usd AS cost
    FROM mastery_event e
    JOIN brain_call_ledger c ON c.id = e.proximate_call_id
    WHERE e.ts >= ? AND e.ts < ?
      AND e.proximate_call_id IS NOT NULL
  `).all(fromMs, toMs);

  const bySurface = new Map();
  for (const r of rows) {
    if (!bySurface.has(r.featureSurface)) bySurface.set(r.featureSurface, []);
    bySurface.get(r.featureSurface).push(r.cost || 0);
  }

  return Array.from(bySurface.entries()).map(([featureSurface, costs]) => {
    costs.sort((a, b) => a - b);
    const mean = costs.reduce((s, v) => s + v, 0) / costs.length;
    return { featureSurface, meanCost: mean, p95Cost: percentile(costs, 0.95), n: costs.length };
  });
}

module.exports.aggregateCostBySurface = aggregateCostBySurface;
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx jest src/__tests__/brain/predictiveDao.test.js`
Expected: PASS all tests.

- [ ] **Step 6: Commit**

```bash
git add src/main/brain/predictive/predictiveDao.js src/__tests__/brain/predictiveDao.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): DAO — direct-attribution cost per surface"
```

---

## Task 5: EB math — continuous Δmastery posterior

**Files:**
- Create: `src/main/brain/predictive/ebMath.js`
- Create: `src/__tests__/brain/ebMath.test.js`

- [ ] **Step 1: Failing test**

```js
// src/__tests__/brain/ebMath.test.js
const { posteriorDelta, posteriorPBoxUp } = require('../../main/brain/predictive/ebMath');

describe('ebMath.posteriorDelta (NIG conjugate)', () => {
  test('empty cell falls back to parent', () => {
    const out = posteriorDelta({ n: 0, sumDelta: 0, sumDeltaSq: 0 }, { mean: 5, var: 4 });
    expect(out.mean).toBe(5);
    expect(out.std).toBeCloseTo(2, 5);
  });

  test('dense cell barely shrinks toward parent', () => {
    const out = posteriorDelta(
      { n: 100, sumDelta: 1000, sumDeltaSq: 12000 }, // sample mean = 10
      { mean: 5, var: 4 },
    );
    // kappa_0=4, n=100: posterior mean = (4*5 + 100*10)/104 ≈ 9.81
    expect(out.mean).toBeCloseTo((4 * 5 + 100 * 10) / 104, 3);
    expect(out.std).toBeGreaterThan(0);
  });

  test('low-n cell shrinks heavily toward parent', () => {
    const out = posteriorDelta(
      { n: 2, sumDelta: 20, sumDeltaSq: 250 }, // sample mean = 10
      { mean: 5, var: 4 },
    );
    expect(out.mean).toBeCloseTo((4 * 5 + 2 * 10) / 6, 3); // ≈ 6.67
  });
});

describe('ebMath.posteriorPBoxUp (Beta-Binomial)', () => {
  test('empty cell ≈ parent', () => {
    const out = posteriorPBoxUp({ n: 0, s: 0 }, { alpha: 6, beta: 4 });
    expect(out.mean).toBeCloseTo(6 / 10, 5);
  });

  test('all-up cell trends to ~1', () => {
    const out = posteriorPBoxUp({ n: 100, s: 100 }, { alpha: 2, beta: 2 });
    expect(out.mean).toBeGreaterThan(0.95);
  });

  test('all-fail cell trends to ~0', () => {
    const out = posteriorPBoxUp({ n: 100, s: 0 }, { alpha: 2, beta: 2 });
    expect(out.mean).toBeLessThan(0.05);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest src/__tests__/brain/ebMath.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/main/brain/predictive/ebMath.js
const { KAPPA_0 } = require('./predictiveEnums');

// NIG-style conjugate update for the predictive distribution of Δmastery.
// Returns posterior mean + predictive std.
//   cell: { n, sumDelta, sumDeltaSq }
//   parent: { mean, var }
function posteriorDelta(cell, parent) {
  const { n, sumDelta, sumDeltaSq } = cell;
  if (!n) {
    return { mean: parent.mean, std: Math.sqrt(parent.var) };
  }
  const sampleMean = sumDelta / n;
  const mean = (KAPPA_0 * parent.mean + n * sampleMean) / (KAPPA_0 + n);
  // Sample variance + parent variance, shrunk by total observations.
  const sampleVar = Math.max(0, sumDeltaSq / n - sampleMean * sampleMean);
  const blendedVar = (KAPPA_0 * parent.var + n * sampleVar) / (KAPPA_0 + n);
  // Predictive std: account for both estimation uncertainty + intrinsic var.
  const std = Math.sqrt(blendedVar * (1 + 1 / (KAPPA_0 + n)));
  return { mean, std };
}

// Beta-Binomial conjugate update.
//   cell: { n, s } where s = number of box-up successes
//   parent: { alpha, beta }
function posteriorPBoxUp(cell, parent) {
  const a = parent.alpha + (cell.s || 0);
  const b = parent.beta + ((cell.n || 0) - (cell.s || 0));
  return { mean: a / (a + b), alpha: a, beta: b };
}

module.exports = { posteriorDelta, posteriorPBoxUp };
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx jest src/__tests__/brain/ebMath.test.js`
Expected: PASS 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/predictive/ebMath.js src/__tests__/brain/ebMath.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): EB conjugate updates (NIG + Beta-Binomial)"
```

---

## Task 6: Hierarchical aggregation

**Files:**
- Create: `src/main/brain/predictive/hierarchy.js`
- Create: `src/__tests__/brain/hierarchy.test.js`

- [ ] **Step 1: Failing test**

```js
// src/__tests__/brain/hierarchy.test.js
const { buildHierarchy } = require('../../main/brain/predictive/hierarchy');

describe('buildHierarchy', () => {
  test('rolls up (surface,box,domain) cells to (surface,box), (surface), and global', () => {
    const cellAggregates = [
      { featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary',
        n: 10, sumDelta: 100, sumDeltaSq: 1100, boxUpCount: 6 },
      { featureSurface: 'director-session', currentBox: 1, domain: 'code',
        n: 4, sumDelta: 24, sumDeltaSq: 160, boxUpCount: 1 },
      { featureSurface: 'director-session', currentBox: 2, domain: 'vocabulary',
        n: 6, sumDelta: 30, sumDeltaSq: 180, boxUpCount: 4 },
      { featureSurface: 'comprehension', currentBox: 1, domain: 'knowledge',
        n: 2, sumDelta: 14, sumDeltaSq: 100, boxUpCount: 1 },
    ];
    const h = buildHierarchy(cellAggregates);
    // (surface, box) for director-session/1: n=14, sumDelta=124, boxUp=7
    const sb = h.surfaceBox.get('director-session|1');
    expect(sb).toMatchObject({ n: 14, sumDelta: 124, boxUpCount: 7 });
    // (surface) for director-session: n=20, sumDelta=154, boxUp=11
    expect(h.surface.get('director-session')).toMatchObject({ n: 20, sumDelta: 154, boxUpCount: 11 });
    // global: n=22, sumDelta=168, boxUp=12
    expect(h.global).toMatchObject({ n: 22, sumDelta: 168, boxUpCount: 12 });
  });

  test('global posterior usable as parent for everything', () => {
    const h = buildHierarchy([]);
    expect(h.global.n).toBe(0);
    expect(h.surface.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest src/__tests__/brain/hierarchy.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

```js
// src/main/brain/predictive/hierarchy.js
const sumAgg = (target, row) => {
  target.n += row.n;
  target.sumDelta += row.sumDelta;
  target.sumDeltaSq += row.sumDeltaSq;
  target.boxUpCount += row.boxUpCount;
  return target;
};

function emptyAgg() { return { n: 0, sumDelta: 0, sumDeltaSq: 0, boxUpCount: 0 }; }

function buildHierarchy(cellAggregates) {
  const surfaceBox = new Map();
  const surface = new Map();
  const global = emptyAgg();
  for (const row of cellAggregates) {
    sumAgg(global, row);
    const sbKey = `${row.featureSurface}|${row.currentBox}`;
    if (!surfaceBox.has(sbKey)) surfaceBox.set(sbKey, emptyAgg());
    sumAgg(surfaceBox.get(sbKey), row);
    if (!surface.has(row.featureSurface)) surface.set(row.featureSurface, emptyAgg());
    sumAgg(surface.get(row.featureSurface), row);
  }
  return { surfaceBox, surface, global };
}

module.exports = { buildHierarchy, emptyAgg };
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx jest src/__tests__/brain/hierarchy.test.js`
Expected: PASS 2/2.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/predictive/hierarchy.js src/__tests__/brain/hierarchy.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): hierarchical roll-up for shrinkage parents"
```

---

## Task 7: refreshModel + cache write

**Files:**
- Modify: `src/main/brain/predictive/PredictiveEngine.js` (replace `refreshModel` body; add cache I/O)
- Modify: `src/__tests__/brain/PredictiveEngine.contract.test.js` (drop the now-stale refreshModel throw test)
- Create: `src/__tests__/brain/PredictiveEngine.refresh.test.js`

- [ ] **Step 1: Failing test**

```js
// src/__tests__/brain/PredictiveEngine.refresh.test.js
const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock electron app.getPath to a tmpdir.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'predictive-'));
jest.mock('electron', () => ({ app: { getPath: () => tmp } }));

// Reuse the DB mock pattern.
jest.mock('../../main/db/dbManager', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE mastery_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT, learning_point_id TEXT, user_id INTEGER,
      ts INTEGER, event_type TEXT, prev_box INTEGER, new_box INTEGER,
      prev_mastery REAL, new_mastery REAL, rating TEXT, source TEXT,
      source_ref TEXT, notes TEXT, proximate_call_id INTEGER,
      feature_surface TEXT DEFAULT 'unknown'
    );
    CREATE TABLE learning_point (
      id TEXT PRIMARY KEY, user_id INTEGER, domain_type TEXT,
      box INTEGER, mastery_level REAL, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE brain_call_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, intent TEXT,
      provider TEXT, cost_usd REAL DEFAULT 0, cache_hit INTEGER DEFAULT 0
    );
  `);
  return { __db: db, getDb: () => db };
});

const dbMock = require('../../main/db/dbManager');
const PredictiveEngine = require('../../main/brain/predictive/PredictiveEngine');

describe('PredictiveEngine.refreshModel', () => {
  beforeEach(() => {
    dbMock.__db.exec('DELETE FROM mastery_event; DELETE FROM learning_point; DELETE FROM brain_call_ledger;');
    const lp = dbMock.__db.prepare(
      `INSERT INTO learning_point (id, user_id, domain_type, box, mastery_level) VALUES (?, 1, ?, 1, 30)`
    );
    lp.run('lp-1', 'vocabulary');
    dbMock.__db.prepare(`
      INSERT INTO mastery_event
      (learning_point_id, user_id, ts, event_type, prev_box, new_box,
       prev_mastery, new_mastery, source, feature_surface)
      VALUES ('lp-1', 1, 1000, 'review', 1, 2, 30, 40, 'director-session', 'director-session')
    `).run();
  });

  test('writes cache file with cells, parents, costs, computedAt', async () => {
    const engine = new PredictiveEngine();
    const out = await engine.refreshModel({ force: true });
    expect(out.refreshed).toBe(true);
    expect(out.cells).toBeGreaterThan(0);
    const file = path.join(tmp, 'predictive_model.json');
    expect(fs.existsSync(file)).toBe(true);
    const cache = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(cache.cells).toBeDefined();
    expect(cache.computedAt).toBeGreaterThan(0);
  });

  test('skips refresh when cache is fresh and force=false', async () => {
    const engine = new PredictiveEngine();
    await engine.refreshModel({ force: true });
    const first = JSON.parse(fs.readFileSync(path.join(tmp, 'predictive_model.json'), 'utf8'));
    const second = await engine.refreshModel({ force: false });
    expect(second.refreshed).toBe(false);
    const after = JSON.parse(fs.readFileSync(path.join(tmp, 'predictive_model.json'), 'utf8'));
    expect(after.computedAt).toBe(first.computedAt);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (not implemented)**

Run: `npx jest src/__tests__/brain/PredictiveEngine.refresh.test.js`
Expected: FAIL — `not implemented`.

- [ ] **Step 3: Drop the refreshModel throw assertion from contract test**

Edit `src/__tests__/brain/PredictiveEngine.contract.test.js` — delete the `test('refreshModel throws not implemented', ...)` block (the method is about to gain a real body).

- [ ] **Step 4: Implement refreshModel + cache I/O**

Replace `refreshModel` in `PredictiveEngine.js` (and add helpers at top):

```js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { REFRESH_INTERVAL_MS, DEFAULT_WINDOW_DAYS } = require('./predictiveEnums');
const { aggregateMasteryEventsByCell, aggregateCostBySurface } = require('./predictiveDao');
const { buildHierarchy } = require('./hierarchy');

function cachePath() {
  return path.join(app.getPath('userData'), 'predictive_model.json');
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), 'utf8'));
  } catch { return null; }
}

function writeCache(payload) {
  const tmp = `${cachePath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, cachePath());
}
```

Replace `refreshModel(_opts)` body with:

```js
  async refreshModel({ force = false } = {}) {
    const cache = readCache();
    if (!force && cache && Date.now() - cache.computedAt < REFRESH_INTERVAL_MS) {
      return { refreshed: false, cells: (cache.cells || []).length, computedAt: cache.computedAt };
    }
    const now = Date.now();
    const fromMs = now - DEFAULT_WINDOW_DAYS * 86_400_000;
    const cellAgg = aggregateMasteryEventsByCell({ fromMs, toMs: now });
    const cost = aggregateCostBySurface({ fromMs, toMs: now });
    const hierarchy = buildHierarchy(cellAgg);
    const payload = {
      cells: cellAgg.map((r) => ({
        ...r, s: r.boxUpCount,
      })),
      surfaceBox: Array.from(hierarchy.surfaceBox.entries()),
      surface: Array.from(hierarchy.surface.entries()),
      global: hierarchy.global,
      cost,
      windowDays: DEFAULT_WINDOW_DAYS,
      computedAt: now,
    };
    writeCache(payload);
    return { refreshed: true, cells: payload.cells.length, computedAt: now };
  }
```

- [ ] **Step 5: Run — expect PASS on refresh test; contract test passes too**

Run: `npx jest src/__tests__/brain/PredictiveEngine.refresh.test.js src/__tests__/brain/PredictiveEngine.contract.test.js`
Expected: PASS all.

- [ ] **Step 6: Commit**

```bash
git add src/main/brain/predictive/PredictiveEngine.js src/__tests__/brain/PredictiveEngine.refresh.test.js src/__tests__/brain/PredictiveEngine.contract.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): refreshModel writes hierarchical cache"
```

---

## Task 8: predict() with shrinkage fallback chain

**Files:**
- Modify: `src/main/brain/predictive/PredictiveEngine.js` (replace `predict`)
- Create: `src/__tests__/brain/PredictiveEngine.predict.test.js`

- [ ] **Step 1: Failing test**

```js
// src/__tests__/brain/PredictiveEngine.predict.test.js
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'predictive-predict-'));
jest.mock('electron', () => ({ app: { getPath: () => tmp } }));
jest.mock('../../main/db/dbManager', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE mastery_event (id INTEGER PRIMARY KEY, learning_point_id TEXT, user_id INTEGER, ts INTEGER, event_type TEXT, prev_box INTEGER, new_box INTEGER, prev_mastery REAL, new_mastery REAL, rating TEXT, source TEXT, source_ref TEXT, notes TEXT, proximate_call_id INTEGER, feature_surface TEXT);
    CREATE TABLE learning_point (id TEXT PRIMARY KEY, user_id INTEGER, domain_type TEXT, box INTEGER, mastery_level REAL, created_at TEXT, updated_at TEXT);
    CREATE TABLE brain_call_ledger (id INTEGER PRIMARY KEY, ts INTEGER, intent TEXT, provider TEXT, cost_usd REAL, cache_hit INTEGER);
  `);
  return { __db: db, getDb: () => db };
});

const PredictiveEngine = require('../../main/brain/predictive/PredictiveEngine');
const { SHRINKAGE_LEVELS } = require('../../main/brain/predictive/predictiveEnums');

function seed(dbMock) {
  const lp = dbMock.__db.prepare(
    `INSERT OR IGNORE INTO learning_point (id, user_id, domain_type, box, mastery_level) VALUES (?, 1, ?, 1, 30)`
  );
  ['lp-a', 'lp-b', 'lp-c'].forEach((id) => lp.run(id, 'vocabulary'));
  const ins = dbMock.__db.prepare(`
    INSERT INTO mastery_event (learning_point_id, user_id, ts, event_type, prev_box, new_box, prev_mastery, new_mastery, source, feature_surface, proximate_call_id)
    VALUES (?, 1, ?, 'review', ?, ?, ?, ?, 'user-review', ?, ?)
  `);
  const insCall = dbMock.__db.prepare(`INSERT INTO brain_call_ledger (ts, intent, cost_usd) VALUES (?, ?, ?)`);
  const cid = insCall.run(1000, 'director-session-step', 0.002).lastInsertRowid;
  // Dense cell for (director-session, box=1, vocabulary)
  for (let i = 0; i < 40; i++) {
    ins.run(`lp-${'abc'[i % 3]}`, 2000 + i, 1, 2, 30, 40 + (i % 3), 'director-session', cid);
  }
}

describe('PredictiveEngine.predict', () => {
  let dbMock; let engine;
  beforeEach(async () => {
    dbMock = require('../../main/db/dbManager');
    dbMock.__db.exec('DELETE FROM mastery_event; DELETE FROM learning_point; DELETE FROM brain_call_ledger;');
    seed(dbMock);
    engine = new PredictiveEngine();
    await engine.refreshModel({ force: true });
  });

  test('dense cell returns shrinkageLevel=cell with positive expectedMasteryDelta', async () => {
    const out = await engine.predict({
      featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary',
    });
    expect(out.shrinkageLevel).toBe(SHRINKAGE_LEVELS.CELL);
    expect(out.expectedMasteryDelta).toBeGreaterThan(8);
    expect(out.pBoxUp).toBeGreaterThan(0.7);
    expect(out.n).toBe(40);
    expect(out.expectedCost).toBeGreaterThan(0);
  });

  test('empty cell falls back through hierarchy', async () => {
    const out = await engine.predict({
      featureSurface: 'comprehension', currentBox: 4, domain: 'math',
    });
    // No comprehension events in seed → falls all the way to global.
    expect([SHRINKAGE_LEVELS.SURFACE, SHRINKAGE_LEVELS.GLOBAL]).toContain(out.shrinkageLevel);
    expect(out.n).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest src/__tests__/brain/PredictiveEngine.predict.test.js`
Expected: FAIL — `not implemented`.

- [ ] **Step 3: Implement predict + shrinkage fallback**

Add to `PredictiveEngine.js`:

```js
const { posteriorDelta, posteriorPBoxUp } = require('./ebMath');
const { SHRINKAGE_LEVELS, ALPHA_0, BETA_0, EXCLUDED_SURFACES } = require('./predictiveEnums');
```

Add helper inside class:

```js
  _aggToParent(agg, fallback = { mean: 0, var: 1 }) {
    if (!agg || !agg.n) return fallback;
    const m = agg.sumDelta / agg.n;
    const v = Math.max(0, agg.sumDeltaSq / agg.n - m * m);
    return { mean: m, var: v };
  }
```

Replace `predict(_args)` with:

```js
  async predict({ featureSurface, currentBox, domain }) {
    if (EXCLUDED_SURFACES.includes(featureSurface)) {
      throw new Error(`predict: featureSurface "${featureSurface}" is excluded`);
    }
    const cache = readCache();
    if (!cache) {
      await this.refreshModel({ force: true });
      return this.predict({ featureSurface, currentBox, domain });
    }
    if (Date.now() - cache.computedAt > REFRESH_INTERVAL_MS) {
      await this.refreshModel({ force: true });
      return this.predict({ featureSurface, currentBox, domain });
    }

    const sbMap = new Map(cache.surfaceBox);
    const sMap = new Map(cache.surface);
    const globalAgg = cache.global;

    // Build parent posteriors bottom-up.
    const globalParent = this._aggToParent(globalAgg);
    const surfaceAgg = sMap.get(featureSurface);
    const surfaceParent = this._aggToParent(surfaceAgg, globalParent);
    const sbAgg = sbMap.get(`${featureSurface}|${currentBox}`);
    const sbParent = this._aggToParent(sbAgg, surfaceParent);

    const cell = cache.cells.find(
      (c) => c.featureSurface === featureSurface && c.currentBox === currentBox && c.domain === domain,
    );

    // Determine shrinkage level used for the leaf.
    let level;
    let cellInput;
    if (cell && cell.n) {
      level = SHRINKAGE_LEVELS.CELL;
      cellInput = cell;
    } else if (sbAgg && sbAgg.n) {
      level = SHRINKAGE_LEVELS.SURFACE_BOX;
      cellInput = { ...sbAgg, s: sbAgg.boxUpCount };
    } else if (surfaceAgg && surfaceAgg.n) {
      level = SHRINKAGE_LEVELS.SURFACE;
      cellInput = { ...surfaceAgg, s: surfaceAgg.boxUpCount };
    } else {
      level = SHRINKAGE_LEVELS.GLOBAL;
      cellInput = { n: 0, sumDelta: 0, sumDeltaSq: 0, s: 0 };
    }

    const deltaPost = posteriorDelta(cellInput, sbParent);
    const pUpPost = posteriorPBoxUp(
      { n: cellInput.n, s: cellInput.s || 0 },
      { alpha: ALPHA_0, beta: BETA_0 },
    );

    const costRow = (cache.cost || []).find((r) => r.featureSurface === featureSurface);
    const expectedCost = costRow ? costRow.meanCost : 0;
    const p95Cost = costRow ? costRow.p95Cost : 0;

    return {
      expectedMasteryDelta: deltaPost.mean,
      deltaStd: deltaPost.std,
      pBoxUp: pUpPost.mean,
      expectedCost,
      p95Cost,
      n: cellInput.n,
      shrinkageLevel: level,
      computedAt: cache.computedAt,
    };
  }
```

Also drop the matching throw assertion from contract test if still present.

- [ ] **Step 4: Run — expect PASS**

Run: `npx jest src/__tests__/brain/PredictiveEngine.predict.test.js`
Expected: PASS 2/2.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/predictive/PredictiveEngine.js src/__tests__/brain/PredictiveEngine.predict.test.js src/__tests__/brain/PredictiveEngine.contract.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): predict() with hierarchical shrinkage fallback"
```

---

## Task 9: rankCandidates()

**Files:**
- Modify: `src/main/brain/predictive/PredictiveEngine.js`
- Create: `src/__tests__/brain/PredictiveEngine.rank.test.js`

- [ ] **Step 1: Failing test**

```js
// src/__tests__/brain/PredictiveEngine.rank.test.js
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'predictive-rank-'));
jest.mock('electron', () => ({ app: { getPath: () => tmp } }));
jest.mock('../../main/db/dbManager', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE mastery_event (id INTEGER PRIMARY KEY, learning_point_id TEXT, user_id INTEGER, ts INTEGER, event_type TEXT, prev_box INTEGER, new_box INTEGER, prev_mastery REAL, new_mastery REAL, rating TEXT, source TEXT, source_ref TEXT, notes TEXT, proximate_call_id INTEGER, feature_surface TEXT);
    CREATE TABLE learning_point (id TEXT PRIMARY KEY, user_id INTEGER, domain_type TEXT, box INTEGER, mastery_level REAL, created_at TEXT, updated_at TEXT);
    CREATE TABLE brain_call_ledger (id INTEGER PRIMARY KEY, ts INTEGER, intent TEXT, provider TEXT, cost_usd REAL, cache_hit INTEGER);
  `);
  return { __db: db, getDb: () => db };
});

const PredictiveEngine = require('../../main/brain/predictive/PredictiveEngine');

describe('rankCandidates', () => {
  test('sorts by ROI descending and includes prediction + ref', async () => {
    const dbMock = require('../../main/db/dbManager');
    const lp = dbMock.__db.prepare(`INSERT OR IGNORE INTO learning_point (id, user_id, domain_type, box, mastery_level) VALUES (?, 1, ?, 1, 30)`);
    lp.run('a', 'vocabulary'); lp.run('b', 'code');
    const insCall = dbMock.__db.prepare(`INSERT INTO brain_call_ledger (ts, intent, cost_usd) VALUES (?, ?, ?)`);
    const ev = dbMock.__db.prepare(`INSERT INTO mastery_event (learning_point_id, user_id, ts, event_type, prev_box, new_box, prev_mastery, new_mastery, source, feature_surface, proximate_call_id) VALUES (?, 1, ?, 'review', ?, ?, ?, ?, 'user-review', ?, ?)`);
    // director-session cheaper, smaller gain per event
    const c1 = insCall.run(1000, 'director-session-step', 0.001).lastInsertRowid;
    for (let i = 0; i < 20; i++) ev.run('a', 2000 + i, 1, 2, 30, 33, 'director-session', c1);
    // production-prompt costlier, bigger gain
    const c2 = insCall.run(1100, 'production-grade', 0.010).lastInsertRowid;
    for (let i = 0; i < 20; i++) ev.run('b', 3000 + i, 1, 2, 30, 50, 'production-prompt', c2);

    const engine = new PredictiveEngine();
    await engine.refreshModel({ force: true });
    const ranked = await engine.rankCandidates([
      { featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary', ref: 'A' },
      { featureSurface: 'production-prompt', currentBox: 1, domain: 'code', ref: 'B' },
    ]);
    expect(ranked).toHaveLength(2);
    expect(ranked.every((r) => r.prediction)).toBe(true);
    // production-prompt: ~20 delta / $0.01 = 2000 ROI
    // director-session: ~3 delta / $0.001 = 3000 ROI → director wins
    expect(ranked[0].ref).toBe('A');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest src/__tests__/brain/PredictiveEngine.rank.test.js`
Expected: FAIL — `not implemented`.

- [ ] **Step 3: Implement**

Replace `rankCandidates(_)` body:

```js
  async rankCandidates(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    const EPS = 1e-9;
    const enriched = await Promise.all(candidates.map(async (c) => {
      const prediction = await this.predict({
        featureSurface: c.featureSurface, currentBox: c.currentBox, domain: c.domain,
      });
      const roi = prediction.expectedMasteryDelta / Math.max(prediction.expectedCost, EPS);
      return { ...c, prediction, roi };
    }));
    enriched.sort((a, b) => {
      if (b.roi !== a.roi) return b.roi - a.roi;
      return b.prediction.expectedMasteryDelta - a.prediction.expectedMasteryDelta;
    });
    return enriched;
  }
```

Drop the matching throw test from contract test.

- [ ] **Step 4: Run — expect PASS**

Run: `npx jest src/__tests__/brain/PredictiveEngine.rank.test.js`
Expected: PASS 1/1.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/predictive/PredictiveEngine.js src/__tests__/brain/PredictiveEngine.rank.test.js src/__tests__/brain/PredictiveEngine.contract.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): rankCandidates by ROI = ΔM / cost"
```

---

## Task 10: calibrationReport

**Files:**
- Create: `src/main/brain/predictive/calibrationReport.js`
- Modify: `src/main/brain/predictive/PredictiveEngine.js`
- Create: `src/__tests__/brain/calibrationReport.test.js`

- [ ] **Step 1: Failing test**

```js
// src/__tests__/brain/calibrationReport.test.js
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'predictive-cal-'));
jest.mock('electron', () => ({ app: { getPath: () => tmp } }));
jest.mock('../../main/db/dbManager', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE mastery_event (id INTEGER PRIMARY KEY, learning_point_id TEXT, user_id INTEGER, ts INTEGER, event_type TEXT, prev_box INTEGER, new_box INTEGER, prev_mastery REAL, new_mastery REAL, rating TEXT, source TEXT, source_ref TEXT, notes TEXT, proximate_call_id INTEGER, feature_surface TEXT);
    CREATE TABLE learning_point (id TEXT PRIMARY KEY, user_id INTEGER, domain_type TEXT, box INTEGER, mastery_level REAL, created_at TEXT, updated_at TEXT);
    CREATE TABLE brain_call_ledger (id INTEGER PRIMARY KEY, ts INTEGER, intent TEXT, provider TEXT, cost_usd REAL, cache_hit INTEGER);
  `);
  return { __db: db, getDb: () => db };
});

const PredictiveEngine = require('../../main/brain/predictive/PredictiveEngine');

describe('calibrationReport', () => {
  test('returns reliability bins, brier score, coverage', async () => {
    const dbMock = require('../../main/db/dbManager');
    const lp = dbMock.__db.prepare(`INSERT OR IGNORE INTO learning_point (id, user_id, domain_type, box, mastery_level) VALUES (?, 1, ?, 1, 30)`);
    lp.run('lp-1', 'vocabulary');
    const ev = dbMock.__db.prepare(`INSERT INTO mastery_event (learning_point_id, user_id, ts, event_type, prev_box, new_box, prev_mastery, new_mastery, source, feature_surface) VALUES ('lp-1', 1, ?, 'review', ?, ?, ?, ?, 'user-review', ?)`);
    for (let i = 0; i < 50; i++) ev.run(Date.now() - i * 60000, 1, 2, 30, 40, 'director-session');

    const engine = new PredictiveEngine();
    await engine.refreshModel({ force: true });
    const report = await engine.calibrationReport({ windowDays: 30 });
    expect(report.reliability.length).toBeGreaterThan(0);
    expect(report.brierScore).toBeGreaterThanOrEqual(0);
    expect(report.brierScore).toBeLessThanOrEqual(1);
    expect(report.coverage).toBeGreaterThanOrEqual(0);
    expect(report.coverage).toBeLessThanOrEqual(1);
    expect(report.asOf).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest src/__tests__/brain/calibrationReport.test.js`
Expected: FAIL — `not implemented`.

- [ ] **Step 3: Implement calibrationReport.js**

```js
// src/main/brain/predictive/calibrationReport.js
const dbManager = require('../../db/dbManager');
const { COVERAGE_MIN_N, EXCLUDED_SURFACES, DEFAULT_WINDOW_DAYS } = require('./predictiveEnums');

// Score each recent event with the model's prediction, then summarize.
async function computeReport(engine, { windowDays = DEFAULT_WINDOW_DAYS } = {}) {
  const now = Date.now();
  const fromMs = now - windowDays * 86_400_000;
  const excluded = EXCLUDED_SURFACES.map(() => '?').join(',');
  const events = dbManager.getDb().prepare(`
    SELECT e.feature_surface AS featureSurface, e.prev_box AS currentBox,
           lp.domain_type AS domain,
           (e.new_mastery - e.prev_mastery) AS delta,
           CASE WHEN e.new_box > e.prev_box THEN 1 ELSE 0 END AS boxUp
    FROM mastery_event e
    JOIN learning_point lp ON lp.id = e.learning_point_id
    WHERE e.ts >= ? AND e.ts < ?
      AND e.feature_surface NOT IN (${excluded})
      AND e.prev_box IS NOT NULL
      AND e.prev_mastery IS NOT NULL AND e.new_mastery IS NOT NULL
      AND lp.domain_type IS NOT NULL
  `).all(fromMs, now, ...EXCLUDED_SURFACES);

  if (events.length === 0) {
    return { reliability: [], brierScore: 0, coverage: 0, asOf: now };
  }

  const predictions = await Promise.all(events.map(async (e) => {
    const p = await engine.predict({
      featureSurface: e.featureSurface, currentBox: e.currentBox, domain: e.domain,
    });
    return { ...e, predictedDelta: p.expectedMasteryDelta, pBoxUp: p.pBoxUp, n: p.n };
  }));

  // Reliability: 5 bins by predicted delta, mean predicted vs mean realized.
  const sorted = [...predictions].sort((a, b) => a.predictedDelta - b.predictedDelta);
  const bins = 5;
  const reliability = [];
  const binSize = Math.max(1, Math.floor(sorted.length / bins));
  for (let i = 0; i < bins; i++) {
    const slice = sorted.slice(i * binSize, i === bins - 1 ? sorted.length : (i + 1) * binSize);
    if (slice.length === 0) continue;
    const mp = slice.reduce((s, r) => s + r.predictedDelta, 0) / slice.length;
    const mr = slice.reduce((s, r) => s + r.delta, 0) / slice.length;
    reliability.push({ bin: i, predictedDelta: mp, realizedDelta: mr, n: slice.length });
  }

  const brier = predictions.reduce(
    (s, r) => s + (r.pBoxUp - r.boxUp) * (r.pBoxUp - r.boxUp), 0,
  ) / predictions.length;

  const covered = predictions.filter((r) => r.n >= COVERAGE_MIN_N).length;
  const coverage = covered / predictions.length;

  return { reliability, brierScore: brier, coverage, asOf: now };
}

module.exports = { computeReport };
```

Wire `calibrationReport` in `PredictiveEngine.js`:

```js
const { computeReport } = require('./calibrationReport');
```

Replace method body:

```js
  async calibrationReport(opts = {}) {
    return computeReport(this, opts);
  }
```

Remove the matching throw test from contract test.

- [ ] **Step 4: Run — expect PASS**

Run: `npx jest src/__tests__/brain/calibrationReport.test.js`
Expected: PASS 1/1.

- [ ] **Step 5: Commit**

```bash
git add src/main/brain/predictive/calibrationReport.js src/main/brain/predictive/PredictiveEngine.js src/__tests__/brain/calibrationReport.test.js src/__tests__/brain/PredictiveEngine.contract.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): calibration report (reliability+Brier+coverage)"
```

---

## Task 11: IPC handlers

**Files:**
- Create: `src/main/ipc/predictiveHandlers.js`
- Modify: `src/main/main.ts` (register handlers near other ipc registrations)
- Create: `src/__tests__/ipc/predictiveHandlers.test.js`

- [ ] **Step 1: Failing test**

```js
// src/__tests__/ipc/predictiveHandlers.test.js
const handlers = require('../../main/ipc/predictiveHandlers');

describe('predictiveHandlers', () => {
  test('exposes the four channels via register()', () => {
    const captured = new Map();
    const fakeIpc = { handle: (channel, fn) => captured.set(channel, fn) };
    handlers.register(fakeIpc, {
      predict: async () => ({ ok: 'predict' }),
      rankCandidates: async () => ({ ok: 'rank' }),
      refreshModel: async () => ({ ok: 'refresh' }),
      calibrationReport: async () => ({ ok: 'report' }),
    });
    expect(captured.has('predictive:predict')).toBe(true);
    expect(captured.has('predictive:rank')).toBe(true);
    expect(captured.has('predictive:refresh')).toBe(true);
    expect(captured.has('predictive:report')).toBe(true);
  });

  test('passes args through to engine methods', async () => {
    const captured = new Map();
    const fakeIpc = { handle: (channel, fn) => captured.set(channel, fn) };
    const engine = {
      predict: jest.fn().mockResolvedValue({ expectedMasteryDelta: 5 }),
      rankCandidates: jest.fn().mockResolvedValue([]),
      refreshModel: jest.fn().mockResolvedValue({ refreshed: true }),
      calibrationReport: jest.fn().mockResolvedValue({ coverage: 0.7 }),
    };
    handlers.register(fakeIpc, engine);
    const args = { featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary' };
    await captured.get('predictive:predict')({}, args);
    expect(engine.predict).toHaveBeenCalledWith(args);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest src/__tests__/ipc/predictiveHandlers.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement handlers**

```js
// src/main/ipc/predictiveHandlers.js
function register(ipcMain, engine) {
  ipcMain.handle('predictive:predict', async (_e, args) => engine.predict(args));
  ipcMain.handle('predictive:rank', async (_e, candidates) => engine.rankCandidates(candidates));
  ipcMain.handle('predictive:refresh', async (_e, opts) => engine.refreshModel(opts || {}));
  ipcMain.handle('predictive:report', async (_e, opts) => engine.calibrationReport(opts || {}));
}

module.exports = { register };
```

- [ ] **Step 4: Wire into main.ts**

Find the section in `src/main/main.ts` where other ipc handler modules are registered (search for `ipcMain.handle` near app.whenReady). Add:

```ts
// Phase 14a Predictive Engine
const PredictiveEngine = require('./brain/predictive/PredictiveEngine');
const predictiveHandlers = require('./ipc/predictiveHandlers');
const predictiveEngine = new PredictiveEngine();
predictiveHandlers.register(ipcMain, predictiveEngine);
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx jest src/__tests__/ipc/predictiveHandlers.test.js`
Expected: PASS 2/2.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/predictiveHandlers.js src/__tests__/ipc/predictiveHandlers.test.js src/main/main.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): IPC channels for predictive engine"
```

---

## Task 12: Renderer predictiveApi

**Files:**
- Create: `src/renderer/api/predictiveApi.js`
- Create: `src/__tests__/renderer/predictiveApi.test.js`

- [ ] **Step 1: Failing test**

```js
// src/__tests__/renderer/predictiveApi.test.js
const api = require('../../renderer/api/predictiveApi');

describe('predictiveApi', () => {
  beforeEach(() => {
    global.window = { electron: { ipcRenderer: {
      invoke: jest.fn().mockResolvedValue({ ok: true }),
    } } };
  });
  afterEach(() => { delete global.window; });

  test('predict invokes predictive:predict', async () => {
    await api.predict({ featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary' });
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith(
      'predictive:predict',
      { featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary' },
    );
  });

  test('rank invokes predictive:rank', async () => {
    await api.rank([{ featureSurface: 'comprehension', currentBox: 2, domain: 'knowledge' }]);
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('predictive:rank', expect.any(Array));
  });

  test('refresh invokes predictive:refresh', async () => {
    await api.refresh({ force: true });
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('predictive:refresh', { force: true });
  });

  test('report invokes predictive:report', async () => {
    await api.report({ windowDays: 30 });
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('predictive:report', { windowDays: 30 });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest src/__tests__/renderer/predictiveApi.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/renderer/api/predictiveApi.js
const invoke = (...args) => window.electron.ipcRenderer.invoke(...args);

const predictiveApi = {
  predict: (args) => invoke('predictive:predict', args),
  rank: (candidates) => invoke('predictive:rank', candidates),
  refresh: (opts) => invoke('predictive:refresh', opts),
  report: (opts) => invoke('predictive:report', opts),
};

module.exports = predictiveApi;
module.exports.default = predictiveApi;
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx jest src/__tests__/renderer/predictiveApi.test.js`
Expected: PASS 4/4.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/api/predictiveApi.js src/__tests__/renderer/predictiveApi.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): renderer predictiveApi client"
```

---

## Task 13: Heartbeat integration

**Files:**
- Modify: `src/main/brain/LearningBrainAgent.js` (add stale-refresh hook in `runHeartbeat`)

- [ ] **Step 1: Locate the heartbeat method**

Run: `npx grep -n "runHeartbeat" src/main/brain/LearningBrainAgent.js`
Expected: a method like `async runHeartbeat(...)`. Note its location.

- [ ] **Step 2: Add predictive refresh near the end of the heartbeat (after Phase 13 prune, before return)**

Insert:

```js
    // Phase 14a: nightly predictive model refresh.
    try {
      const PredictiveEngine = require('./predictive/PredictiveEngine');
      if (!this._predictiveEngine) this._predictiveEngine = new PredictiveEngine();
      await this._predictiveEngine.refreshModel({ force: false });
    } catch (e) {
      console.warn('[Brain] predictive refresh failed:', e && e.message);
    }
```

- [ ] **Step 3: Smoke test**

Run: `npm run test:smoke`
Expected: PASS. No new patterns triggered. Heartbeat ran at least once.

- [ ] **Step 4: Commit**

```bash
git add src/main/brain/LearningBrainAgent.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): heartbeat-driven predictive model refresh"
```

---

## Task 14: PredictionsTab UI

**Files:**
- Create: `src/renderer/components/brainShell/predictions/PredictionsTab.jsx`
- Create: `src/renderer/components/brainShell/predictions/ReliabilityDiagram.jsx`
- Modify: `src/renderer/components/brainShell/BrainDashboardPanel.jsx` (add tab)

- [ ] **Step 1: Implement ReliabilityDiagram**

```jsx
// src/renderer/components/brainShell/predictions/ReliabilityDiagram.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';

export default function ReliabilityDiagram({ reliability }) {
  if (!reliability || reliability.length === 0) {
    return <Typography variant="caption">No data yet.</Typography>;
  }
  const allValues = reliability.flatMap((r) => [r.predictedDelta, r.realizedDelta]);
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  const barH = 18, gap = 4, w = 220;
  const scale = (v) => ((v - min) / range) * w;
  return (
    <Box>
      {reliability.map((r) => (
        <Box key={r.bin} sx={{ mb: 1 }}>
          <Typography variant="caption">Bin {r.bin + 1} (n={r.n})</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ position: 'relative', height: barH, background: '#eef', mb: `${gap}px` }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, height: barH,
                width: `${scale(r.predictedDelta)}px`, background: '#88c' }} />
              <Typography variant="caption" sx={{ position: 'absolute', right: 4 }}>
                predicted {r.predictedDelta.toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ position: 'relative', height: barH, background: '#efe' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, height: barH,
                width: `${scale(r.realizedDelta)}px`, background: '#8c8' }} />
              <Typography variant="caption" sx={{ position: 'absolute', right: 4 }}>
                realized {r.realizedDelta.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Implement PredictionsTab**

```jsx
// src/renderer/components/brainShell/predictions/PredictionsTab.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Stack, Typography, Box, Button, Chip } from '@mui/material';
import predictiveApi from '../../../api/predictiveApi';
import ReliabilityDiagram from './ReliabilityDiagram';

const STALE_MS = 24 * 3600 * 1000;

export default function PredictionsTab() {
  const [report, setReport] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await predictiveApi.report({ windowDays: 30 });
      setReport(r);
      setError(null);
    } catch (e) { setError(e.message || String(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await predictiveApi.refresh({ force: true }); await load(); }
    finally { setRefreshing(false); }
  };

  const stale = report && Date.now() - report.asOf > STALE_MS;

  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      {error && <Typography color="error" variant="caption">{error}</Typography>}
      {stale && (
        <Box sx={{ p: 1, background: '#ffd', borderRadius: 1 }}>
          <Typography variant="caption">Model is more than 24 hours stale.</Typography>
        </Box>
      )}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">Model calibration (30d)</Typography>
        <Button size="small" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Recomputing…' : 'Recompute'}
        </Button>
      </Stack>
      {report && (
        <Stack direction="row" spacing={2}>
          <Chip label={`Brier ${report.brierScore.toFixed(3)}`} />
          <Chip label={`Coverage ${Math.round(report.coverage * 100)}%`} />
        </Stack>
      )}
      {report && <ReliabilityDiagram reliability={report.reliability} />}
    </Stack>
  );
}
```

- [ ] **Step 3: Wire into BrainDashboardPanel**

Find the tab list in `BrainDashboardPanel.jsx` (search for `Tab label`). Add a new tab after Spend & Returns:

```jsx
import PredictionsTab from './predictions/PredictionsTab';
// ...
<Tab label="Predictions" />
// in the panel switch:
{tabIndex === <N> && <PredictionsTab />}
```

Adjust `<N>` to match the position you added. If the panel uses an enum/index map, follow its convention.

- [ ] **Step 4: Smoke test**

Run: `npm run test:smoke`
Expected: PASS. App boots. (UI rendering only verified manually.)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/brainShell/predictions/ src/renderer/components/brainShell/BrainDashboardPanel.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-14a): Predictions tab with reliability diagram + KPIs"
```

---

## Task 15: Integration test (end-to-end engine)

**Files:**
- Create: `src/__tests__/integration/predictive-engine.integration.test.js`

- [ ] **Step 1: Write the test**

```js
// src/__tests__/integration/predictive-engine.integration.test.js
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'predictive-int-'));
jest.mock('electron', () => ({ app: { getPath: () => tmp } }));

jest.mock('../../main/db/dbManager', () => {
  const db = new (require('better-sqlite3'))(':memory:');
  db.exec(`
    CREATE TABLE mastery_event (id INTEGER PRIMARY KEY, learning_point_id TEXT, user_id INTEGER, ts INTEGER, event_type TEXT, prev_box INTEGER, new_box INTEGER, prev_mastery REAL, new_mastery REAL, rating TEXT, source TEXT, source_ref TEXT, notes TEXT, proximate_call_id INTEGER, feature_surface TEXT);
    CREATE TABLE learning_point (id TEXT PRIMARY KEY, user_id INTEGER, domain_type TEXT, box INTEGER, mastery_level REAL, created_at TEXT, updated_at TEXT);
    CREATE TABLE brain_call_ledger (id INTEGER PRIMARY KEY, ts INTEGER, intent TEXT, provider TEXT, cost_usd REAL, cache_hit INTEGER);
  `);
  return { __db: db, getDb: () => db };
});

const { SHRINKAGE_LEVELS } = require('../../main/brain/predictive/predictiveEnums');
const PredictiveEngine = require('../../main/brain/predictive/PredictiveEngine');

function seedSynthetic(dbMock) {
  const surfaces = ['director-session', 'comprehension', 'production-prompt'];
  const domains = ['vocabulary', 'code', 'math', 'knowledge'];
  const boxes = [1, 2, 3, 4, 5];
  const lpStmt = dbMock.__db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, box, mastery_level) VALUES (?, 1, ?, ?, ?)`);
  const callStmt = dbMock.__db.prepare(`INSERT INTO brain_call_ledger (ts, intent, cost_usd) VALUES (?, ?, ?)`);
  const evStmt = dbMock.__db.prepare(`INSERT INTO mastery_event (learning_point_id, user_id, ts, event_type, prev_box, new_box, prev_mastery, new_mastery, source, feature_surface, proximate_call_id) VALUES (?, 1, ?, 'review', ?, ?, ?, ?, 'user-review', ?, ?)`);

  let lpCount = 0;
  for (const s of surfaces) {
    for (const b of boxes) {
      for (const d of domains) {
        // Three events per cell — keeps total small but exercises hierarchy.
        for (let i = 0; i < 3; i++) {
          const lpId = `lp-${lpCount++}`;
          lpStmt.run(lpId, d, b, 30 + i * 5);
          const ts = Date.now() - (i + 1) * 60_000;
          const cid = callStmt.run(ts - 10, `${s}-step`, 0.001 + boxes.indexOf(b) * 0.0005).lastInsertRowid;
          const newBox = i === 2 ? b + 1 : b; // 33% box-up
          evStmt.run(lpId, ts, b, newBox, 30, 30 + 4 + i, s, cid);
        }
      }
    }
  }
}

describe('predictive-engine integration', () => {
  test('seed → refresh → predict cells → calibration report', async () => {
    const dbMock = require('../../main/db/dbManager');
    seedSynthetic(dbMock);

    const engine = new PredictiveEngine();
    const refreshed = await engine.refreshModel({ force: true });
    expect(refreshed.refreshed).toBe(true);
    expect(refreshed.cells).toBeGreaterThan(40);

    const dense = await engine.predict({
      featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary',
    });
    expect([SHRINKAGE_LEVELS.CELL, SHRINKAGE_LEVELS.SURFACE_BOX]).toContain(dense.shrinkageLevel);
    expect(dense.expectedCost).toBeGreaterThan(0);

    const empty = await engine.predict({
      featureSurface: 'pre-reading-diagnostic', currentBox: 2, domain: 'math',
    });
    expect(empty.n).toBe(0);
    expect([SHRINKAGE_LEVELS.GLOBAL, SHRINKAGE_LEVELS.SURFACE]).toContain(empty.shrinkageLevel);

    const report = await engine.calibrationReport({ windowDays: 30 });
    expect(report.reliability.length).toBeGreaterThan(0);
    expect(report.brierScore).toBeGreaterThanOrEqual(0);
    expect(report.coverage).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run**

Run: `npx jest src/__tests__/integration/predictive-engine.integration.test.js`
Expected: PASS 1/1.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/predictive-engine.integration.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(phase-14a): integration — seed → refresh → predict → report"
```

---

## Task 16: Full-suite + smoke verification

- [ ] **Step 1: Run all Phase 14a tests**

Run: `npx jest src/__tests__/brain/ebMath.test.js src/__tests__/brain/hierarchy.test.js src/__tests__/brain/predictiveDao.test.js src/__tests__/brain/PredictiveEngine.contract.test.js src/__tests__/brain/PredictiveEngine.refresh.test.js src/__tests__/brain/PredictiveEngine.predict.test.js src/__tests__/brain/PredictiveEngine.rank.test.js src/__tests__/brain/calibrationReport.test.js src/__tests__/ipc/predictiveHandlers.test.js src/__tests__/renderer/predictiveApi.test.js src/__tests__/integration/predictive-engine.integration.test.js`
Expected: ALL PASS.

- [ ] **Step 2: Full Phase 9–13 regression**

Run: `npm test`
Expected: no new failures vs main. If pre-existing flakes exist, document but do not fix here.

- [ ] **Step 3: Smoke**

Run: `npm run test:smoke`
Expected: PASS. No new crash patterns.

- [ ] **Step 4: No-op verification commit (only if any minor doc/comment edits surfaced)**

If nothing changed, skip. Otherwise:

```bash
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "chore(phase-14a): regression sweep — all green"
```

---

## Task 17: Manual sanity check

- [ ] **Step 1: Boot app**

Run: `npm start`
Expected: app boots; no `[Brain] predictive refresh failed` warning in main log after the first heartbeat (~30s).

- [ ] **Step 2: Open Brain Dashboard → Predictions tab**

Expected: tab renders. With low/no data, Brier and Coverage chips show defaults; reliability section says "No data yet" or shows ≤ 5 bins. "Recompute" button works.

- [ ] **Step 3: Verify cache file**

Check: `<userData>/predictive_model.json` exists after first refresh. Field `computedAt` is recent. (`userData` resolves via electron — for dev, project root.)

- [ ] **Step 4: Mark Phase 14a complete**

Update [CLAUDE.md](../../../CLAUDE.md) Brain-Driven Learning Loops table — add a Phase 14a row:

```
| Phase 14a — Predictive Engine | nightly heartbeat | `brain/predictive/PredictiveEngine` (EB over mastery_event ⋈ brain_call_ledger) | `PredictionsTab` in `BrainDashboardPanel` |
```

Commit:

```bash
git add CLAUDE.md
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "docs(phase-14a): table entry in CLAUDE.md"
```

---

## Self-review

**Spec coverage:** Every spec section maps to a task — schema-free DAO (T3/T4), EB math (T5), hierarchy (T6), refreshModel (T7), predict (T8), rankCandidates (T9), calibrationReport (T10), IPC (T11), renderer API (T12), heartbeat hook (T13), UI (T14), integration test (T15), regression (T16), manual (T17).

**Placeholder scan:** No TBDs, TODOs, "implement later." Every code step shows complete code.

**Type consistency:** API field names (`expectedMasteryDelta`, `deltaStd`, `pBoxUp`, `expectedCost`, `p95Cost`, `n`, `shrinkageLevel`, `computedAt`) appear identically in contract (T1), predict impl (T8), rank impl (T9), report (T10), API client (T12), and UI (T14).

**Architectural-contract-first:** T1 defines the engine interface; T2 pins it via boundary test; T3+ implement against it.

**Karpathy success criteria:** Every task ends with a verifiable check (test pass, command output, file existence, smoke pass).
