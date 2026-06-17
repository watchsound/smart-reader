# Phase 12 — Historical Mastery Trajectory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Land the `mastery_event` table + DAO + idempotent backfill + forward instrumentation + BrainVisibilityService updates + UI sparkline & trajectory strip. Hybrid event source (C): backfill from existing review tables on first run, instrument every forward write.

**Architecture:** Append-only event log keyed by `(learning_point_id, ts, event_type, source_ref)` for idempotency. Backfill scans `sr_item`, `learning_session`, `learning_velocity` (whichever exist) + catchall imported event per learning_point. Forward hooks in `LearningPointManager` write sites and the Director session userResult path. BrainVisibilityService consumes for `boxOverTime` (concept) and `masteryTrajectory` (dashboard).

**Tech Stack:** Node + better-sqlite3 + React. No new deps.

**Conventions:**
- Run single test with `npx jest <path>`.
- Commit with `git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit ...`.
- Don't write git config; don't skip pre-commit hooks.
- Stay on `main` branch; no destructive git ops.

**Spec:** [`docs/superpowers/specs/2026-06-17-phase-12-mastery-trajectory-design.md`](../specs/2026-06-17-phase-12-mastery-trajectory-design.md)

---

## File Map

**Create**
- `src/main/db/MasteryEventStore.js`
- `src/main/utils/MasteryEventBackfill.js`
- `src/renderer/views/brainVisibility/MasteryTrajectoryStrip.jsx`
- `src/renderer/views/brainVisibility/MasterySparkline.jsx`
- `src/__tests__/db/MasteryEventStore.test.js`
- `src/__tests__/utils/MasteryEventBackfill.test.js`
- `src/__tests__/main/LearningPointManager.masteryEvent.test.js`
- `src/__tests__/integration/masteryTrajectoryHappyPath.test.js`

**Modify**
- `db.sql` — add `mastery_event` table + 3 indexes
- `src/main/db/LearningPointManager.js` — instrument forward writes
- `src/main/brain/director/SessionRunner.js` — emit on Leitner rating
- `src/main/main.ts` — kick off backfill on boot
- `src/main/utils/BrainVisibilityService.js` — `getConcept.boxOverTime` real; `getDashboard.masteryTrajectory` slice
- `src/__tests__/main/BrainVisibilityService.test.js` — extend
- `src/renderer/views/brainVisibility/ConceptInspector.jsx` — render sparkline
- `src/renderer/views/brainVisibility/BrainActivityDashboard.jsx` — mount trajectory strip

---

### Task 1: `mastery_event` table

**Files:** Modify: `db.sql`

- [ ] **Step 1: Add DROP**

In preamble DROP block, after `DROP TABLE IF EXISTS "ai_session_trace";`:
```sql
DROP TABLE IF EXISTS "mastery_event";
```

- [ ] **Step 2: Add CREATE TABLE + indexes**

After the `ai_session_trace` CREATE block:

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
  FOREIGN KEY ("learning_point_id") REFERENCES "learning_point" ("id") ON DELETE CASCADE
);
CREATE INDEX "idx_mastery_event_lp_ts" ON "mastery_event" ("learning_point_id", "ts");
CREATE INDEX "idx_mastery_event_user_ts" ON "mastery_event" ("user_id", "ts");
CREATE UNIQUE INDEX "idx_mastery_event_dedup" ON "mastery_event" (
  "learning_point_id", "ts", "event_type", COALESCE("source_ref", '')
);
```

- [ ] **Step 3: Verify**

Run: `node -e "const fs=require('fs');const sql=fs.readFileSync('db.sql','utf8');const Database=require('better-sqlite3');const db=new Database(':memory:');db.exec(sql);console.log('OK', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='mastery_event'\").get());"`
Expected: `OK { name: 'mastery_event' }`

- [ ] **Step 4: Commit**

```bash
git add db.sql
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-12): mastery_event table + dedup index"
```

---

### Task 2: `MasteryEventStore` DAO

**Files:**
- Create: `src/main/db/MasteryEventStore.js`
- Test: `src/__tests__/db/MasteryEventStore.test.js`

- [ ] **Step 1: Write failing test**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');
const MasteryEventStore = require('../../main/db/MasteryEventStore');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  // Seed user + lp for FK
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-1', 1, 'vocabulary', 'parse', '{}', '{}', 'book', 1, 25, datetime('now'), datetime('now'))`).run();
  dbManager.__setDb(db);
  return db;
}

test('record + queryByConcept', () => {
  freshDb();
  MasteryEventStore.record({
    learningPointId: 'lp-1', userId: 1, ts: 1000, eventType: 'review',
    rating: 'good', newBox: 2, prevBox: 1, source: 'user-review', sourceRef: 'sr-1',
  });
  const events = MasteryEventStore.queryByConcept('lp-1');
  expect(events).toHaveLength(1);
  expect(events[0].eventType).toBe('review');
  expect(events[0].rating).toBe('good');
});

test('record idempotency: duplicate (lp, ts, type, source_ref) ignored', () => {
  freshDb();
  const args = {
    learningPointId: 'lp-1', userId: 1, ts: 1000, eventType: 'review',
    rating: 'good', source: 'user-review', sourceRef: 'sr-1',
  };
  MasteryEventStore.record(args);
  MasteryEventStore.record(args);
  expect(MasteryEventStore.queryByConcept('lp-1')).toHaveLength(1);
});

test('queryDomainAverages returns per-day per-domain average mastery', () => {
  freshDb();
  const dayMs = 86400000;
  MasteryEventStore.record({ learningPointId: 'lp-1', userId: 1, ts: 1700000000000, eventType: 'mastery_change', newMastery: 40, source: 'backfill' });
  MasteryEventStore.record({ learningPointId: 'lp-1', userId: 1, ts: 1700000000000 + dayMs, eventType: 'mastery_change', newMastery: 60, source: 'user-review' });
  const rows = MasteryEventStore.queryDomainAverages({ userId: 1, since: 1700000000000 - dayMs });
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0].domain).toBe('vocabulary');
  expect(typeof rows[0].avgMastery).toBe('number');
});

test('isEmpty returns true on fresh DB, false after insert', () => {
  freshDb();
  expect(MasteryEventStore.isEmpty()).toBe(true);
  MasteryEventStore.record({ learningPointId: 'lp-1', userId: 1, ts: 1000, eventType: 'imported', newBox: 1, newMastery: 25, source: 'backfill' });
  expect(MasteryEventStore.isEmpty()).toBe(false);
});
```

- [ ] **Step 2: Implement**

```js
// src/main/db/MasteryEventStore.js
const dbManager = require('./dbManager');

function record(ev) {
  const db = dbManager.getDb();
  try {
    db.prepare(`
      INSERT INTO mastery_event
        (learning_point_id, user_id, ts, event_type,
         prev_box, new_box, prev_mastery, new_mastery,
         rating, source, source_ref, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ev.learningPointId, ev.userId, ev.ts, ev.eventType,
      ev.prevBox ?? null, ev.newBox ?? null,
      ev.prevMastery ?? null, ev.newMastery ?? null,
      ev.rating ?? null, ev.source, ev.sourceRef ?? null,
      ev.notes ?? null,
    );
  } catch (e) {
    if (/UNIQUE constraint failed.*idx_mastery_event_dedup/i.test(e.message)) return;
    throw e;
  }
}

function queryByConcept(learningPointId) {
  const db = dbManager.getDb();
  return db.prepare(`
    SELECT id, learning_point_id AS learningPointId, user_id AS userId, ts,
           event_type AS eventType, prev_box AS prevBox, new_box AS newBox,
           prev_mastery AS prevMastery, new_mastery AS newMastery,
           rating, source, source_ref AS sourceRef, notes
    FROM mastery_event WHERE learning_point_id = ? ORDER BY ts ASC
  `).all(learningPointId);
}

function queryDomainAverages({ userId, since }) {
  const db = dbManager.getDb();
  return db.prepare(`
    SELECT date(me.ts/1000, 'unixepoch') AS day,
           lp.domain_type AS domain,
           AVG(me.new_mastery) AS avgMastery,
           COUNT(*) AS eventCount
    FROM mastery_event me
    JOIN learning_point lp ON lp.id = me.learning_point_id
    WHERE me.user_id = ? AND me.ts >= ? AND me.new_mastery IS NOT NULL
    GROUP BY day, domain
    ORDER BY day ASC, domain ASC
  `).all(userId, since);
}

function isEmpty() {
  const db = dbManager.getDb();
  const r = db.prepare(`SELECT COUNT(*) AS c FROM mastery_event`).get();
  return (r?.c || 0) === 0;
}

module.exports = { record, queryByConcept, queryDomainAverages, isEmpty };
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/db/MasteryEventStore.test.js`
Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add src/main/db/MasteryEventStore.js src/__tests__/db/MasteryEventStore.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-12): MasteryEventStore DAO + idempotent insert"
```

---

### Task 3: Backfill job (idempotent)

**Files:**
- Create: `src/main/utils/MasteryEventBackfill.js`
- Test: `src/__tests__/utils/MasteryEventBackfill.test.js`

- [ ] **Step 1: Read existing tables to know what's available**

Run: `grep -n "CREATE TABLE.*sr_item\|CREATE TABLE.*learning_session\|CREATE TABLE.*learning_velocity" db.sql`. Determine which exist + their columns.

- [ ] **Step 2: Write failing test**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');
const MasteryEventStore = require('../../main/db/MasteryEventStore');
const { backfill } = require('../../main/utils/MasteryEventBackfill');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  dbManager.__setDb(db);
  return db;
}

test('backfill emits one imported event per learning_point with no other events', async () => {
  const db = freshDb();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at) VALUES
    ('lp-1', 1, 'vocabulary', 'parse', '{}', '{}', 'book', 2, 40, '2026-06-15', '2026-06-15'),
    ('lp-2', 1, 'concept',    'lexer', '{}', '{}', 'book', 1, 25, '2026-06-15', '2026-06-15')`).run();
  await backfill({ userId: 1 });
  expect(MasteryEventStore.queryByConcept('lp-1').length).toBeGreaterThanOrEqual(1);
  expect(MasteryEventStore.queryByConcept('lp-2').length).toBeGreaterThanOrEqual(1);
});

test('backfill is idempotent: second run does not duplicate', async () => {
  const db = freshDb();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-1', 1, 'vocabulary', 'parse', '{}', '{}', 'book', 2, 40, '2026-06-15', '2026-06-15')`).run();
  await backfill({ userId: 1 });
  const c1 = MasteryEventStore.queryByConcept('lp-1').length;
  await backfill({ userId: 1 });
  expect(MasteryEventStore.queryByConcept('lp-1').length).toBe(c1);
});

test('backfill skips silently if no learning_point rows', async () => {
  freshDb();
  await expect(backfill({ userId: 1 })).resolves.not.toThrow();
});
```

- [ ] **Step 3: Implement**

```js
// src/main/utils/MasteryEventBackfill.js
const dbManager = require('../db/dbManager');
const MasteryEventStore = require('../db/MasteryEventStore');

function parseTs(s) {
  if (!s) return Date.now();
  if (typeof s === 'number') return s;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

function tableExists(db, name) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
}

async function backfill({ userId = 1 } = {}) {
  const db = dbManager.getDb();

  // 1. sr_item → review events (best-effort: schema varies)
  if (tableExists(db, 'sr_item')) {
    const cols = db.prepare(`PRAGMA table_info(sr_item)`).all().map(c => c.name);
    if (cols.includes('item_id') && cols.includes('user_id')) {
      const rows = db.prepare(`SELECT * FROM sr_item WHERE user_id = ?`).all(userId);
      for (const r of rows) {
        MasteryEventStore.record({
          learningPointId: String(r.item_id),
          userId,
          ts: parseTs(r.last_review_ts || r.updated_at || r.created_at),
          eventType: 'review',
          newMastery: r.ease_factor ? Math.round(r.ease_factor * 25) : null,
          source: 'backfill',
          sourceRef: `sr-${r.id || r.item_id}`,
        });
      }
    }
  }

  // 2. learning_session — emit one mastery_change at session end if rows exist
  if (tableExists(db, 'learning_session')) {
    const cols = db.prepare(`PRAGMA table_info(learning_session)`).all().map(c => c.name);
    if (cols.includes('learning_point_id') && cols.includes('end_time')) {
      const rows = db.prepare(`SELECT * FROM learning_session WHERE user_id = ? AND end_time IS NOT NULL`).all(userId);
      for (const r of rows) {
        MasteryEventStore.record({
          learningPointId: String(r.learning_point_id),
          userId,
          ts: parseTs(r.end_time),
          eventType: 'mastery_change',
          source: 'backfill',
          sourceRef: `ls-${r.id}`,
        });
      }
    }
  }

  // 3. Catchall: emit one `imported` event per learning_point with NO mastery_event yet
  const orphans = db.prepare(`
    SELECT lp.id, lp.box, lp.mastery_level, lp.created_at
    FROM learning_point lp
    WHERE lp.user_id = ?
      AND NOT EXISTS (SELECT 1 FROM mastery_event me WHERE me.learning_point_id = lp.id)
  `).all(userId);
  for (const lp of orphans) {
    MasteryEventStore.record({
      learningPointId: lp.id,
      userId,
      ts: parseTs(lp.created_at),
      eventType: 'imported',
      newBox: lp.box,
      newMastery: lp.mastery_level,
      source: 'backfill',
      sourceRef: `imp-${lp.id}`,
    });
  }
}

module.exports = { backfill };
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/__tests__/utils/MasteryEventBackfill.test.js`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/main/utils/MasteryEventBackfill.js src/__tests__/utils/MasteryEventBackfill.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-12): idempotent backfill from sr_item / learning_session / catchall"
```

---

### Task 4: Boot wiring — run backfill once on app ready

**Files:** Modify: `src/main/main.ts`

- [ ] **Step 1: Read main.ts boot sequence**

Find where post-handlers register and the brain heartbeat starts (search for `runHeartbeat` or `LearningBrainAgent`).

- [ ] **Step 2: Add boot hook**

After all handlers are registered (after `brainVisibilityHandlers.register()` from Phase 11), add:

```ts
// Phase 12: backfill mastery_event on first boot.
const MasteryEventStore = require('./db/MasteryEventStore');
const { backfill: backfillMastery } = require('./utils/MasteryEventBackfill');
setImmediate(async () => {
  try {
    if (MasteryEventStore.isEmpty()) {
      console.log('[phase-12] mastery_event empty → running backfill');
      await backfillMastery({ userId: 1 });
      console.log('[phase-12] backfill complete');
    }
  } catch (e) {
    console.warn('[phase-12] backfill failed (continuing):', e.message);
  }
});
```

- [ ] **Step 3: Smoke**

Run: `npm run test:smoke`
Expected: PASS or the same pre-existing failure (boot not crashing on new code).

- [ ] **Step 4: Commit**

```bash
git add src/main/main.ts
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-12): wire mastery_event backfill at app boot"
```

---

### Task 5: Forward instrumentation in `LearningPointManager` + SessionRunner

**Files:**
- Modify: `src/main/db/LearningPointManager.js`
- Modify: `src/main/brain/director/SessionRunner.js`
- Test: `src/__tests__/main/LearningPointManager.masteryEvent.test.js`

- [ ] **Step 1: Locate write sites**

Run: `grep -n "applyProductionGrade\|advanceLeitnerBox\|UPDATE learning_point SET\(box\|mastery_level\)" src/main/db/LearningPointManager.js`. Identify every write to `learning_point.box` or `learning_point.mastery_level`.

- [ ] **Step 2: Write failing test**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');
const LearningPointManager = require('../../main/db/LearningPointManager');
const MasteryEventStore = require('../../main/db/MasteryEventStore');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-1', 1, 'vocabulary', 'parse', '{}', '{}', 'book', 1, 25, datetime('now'), datetime('now'))`).run();
  dbManager.__setDb(db);
  return db;
}

test('applyProductionGrade emits a mastery_change event', () => {
  freshDb();
  LearningPointManager.applyProductionGrade('lp-1', 80);
  const events = MasteryEventStore.queryByConcept('lp-1');
  expect(events.some(e => e.eventType === 'mastery_change' && e.source === 'production-grade')).toBe(true);
});
```

(Adapt the test signature to the actual `applyProductionGrade` API surfaced by the manager. If the method signature differs, mirror it.)

- [ ] **Step 3: Instrument `LearningPointManager.applyProductionGrade`**

Find the function and add the event emit at the end:

```js
function applyProductionGrade(learningPointId, grade, opts = {}) {
  const db = dbManager.getDb();
  const before = db.prepare(`SELECT mastery_level FROM learning_point WHERE id = ?`).get(learningPointId);
  // ...existing UPDATE...
  const after = db.prepare(`SELECT mastery_level, user_id FROM learning_point WHERE id = ?`).get(learningPointId);
  try {
    const MasteryEventStore = require('./MasteryEventStore');
    MasteryEventStore.record({
      learningPointId,
      userId: after.user_id,
      ts: Date.now(),
      eventType: 'mastery_change',
      prevMastery: before?.mastery_level,
      newMastery: after?.mastery_level,
      source: 'production-grade',
      sourceRef: opts.sourceRef || null,
    });
  } catch (e) { /* never break the primary write */ }
  // existing return
}
```

(Adapt to actual file shape — preserve all existing behavior; only ADD the event emit.)

Do the same for `advanceLeitnerBox` (or whatever advances `box`), emitting `event_type='box_change'`.

- [ ] **Step 4: Instrument Director session userResult on Leitner**

In `src/main/brain/director/SessionRunner.js`, in the surface dispatch where `userResult` arrives for `openLeitnerCard`:

```js
// Inside the surface result handling for openLeitnerCard
if (tool.name === 'openLeitnerCard' && userResult?.rating != null) {
  try {
    const MasteryEventStore = require('../../db/MasteryEventStore');
    MasteryEventStore.record({
      learningPointId: decision.args?.learningPointId,
      userId: state.userId,
      ts: Date.now(),
      eventType: 'review',
      rating: userResult.rating,
      source: 'director-session',
      sourceRef: state.traceId,
    });
  } catch (e) { /* swallow */ }
}
```

(Adapt to actual SessionRunner shape — look for where `userResult` is consumed for surface tools.)

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/main/LearningPointManager.masteryEvent.test.js src/__tests__/director/SessionRunner.test.js`
Expected: passing (no regression in the SessionRunner tests).

- [ ] **Step 6: Commit**

```bash
git add src/main/db/LearningPointManager.js src/main/brain/director/SessionRunner.js src/__tests__/main/LearningPointManager.masteryEvent.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-12): forward-instrument LearningPointManager + Director Leitner rating"
```

---

### Task 6: `BrainVisibilityService` updates

**Files:**
- Modify: `src/main/utils/BrainVisibilityService.js`
- Test: extend `src/__tests__/main/BrainVisibilityService.test.js`

- [ ] **Step 1: Write failing test**

```js
test('getConcept boxOverTime returns array of {ts, box, mastery} after events', async () => {
  const db = freshDb();
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-X', 1, 'vocabulary', 't', '{}', '{}', 'book', 1, 25, datetime('now'), datetime('now'))`).run();
  const MasteryEventStore = require('../../main/db/MasteryEventStore');
  MasteryEventStore.record({ learningPointId: 'lp-X', userId: 1, ts: 1000, eventType: 'imported', newBox: 1, newMastery: 25, source: 'backfill' });
  MasteryEventStore.record({ learningPointId: 'lp-X', userId: 1, ts: 2000, eventType: 'mastery_change', newMastery: 40, source: 'production-grade' });
  const r = await BrainVisibilityService.getConcept({ learningPointId: 'lp-X', userId: 1 });
  expect(Array.isArray(r.boxOverTime)).toBe(true);
  expect(r.boxOverTime).toHaveLength(2);
  expect(r.boxOverTime[0].ts).toBe(1000);
  expect(r.boxOverTime[1].mastery).toBe(40);
});

test('getDashboard includes masteryTrajectory slice', async () => {
  const db = freshDb();
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-X', 1, 'vocabulary', 't', '{}', '{}', 'book', 1, 25, datetime('now'), datetime('now'))`).run();
  const MasteryEventStore = require('../../main/db/MasteryEventStore');
  const now = Date.now();
  MasteryEventStore.record({ learningPointId: 'lp-X', userId: 1, ts: now, eventType: 'mastery_change', newMastery: 50, source: 'user-review' });
  const r = await BrainVisibilityService.getDashboard({ window: '7d', userId: 1 });
  expect(Array.isArray(r.masteryTrajectory)).toBe(true);
  expect(r.masteryTrajectory.length).toBeGreaterThan(0);
  expect(r.masteryTrajectory[0].domain).toBe('vocabulary');
});
```

- [ ] **Step 2: Update `getConcept`**

Replace `boxOverTime: null` with:

```js
const MasteryEventStore = require('../db/MasteryEventStore');
const events = MasteryEventStore.queryByConcept(learningPointId);
const boxOverTime = events.map(e => ({
  ts: e.ts,
  box: e.newBox ?? null,
  mastery: e.newMastery ?? null,
  eventType: e.eventType,
  source: e.source,
}));
```

Return: `{ meta: lp, lineage, costToDate, boxOverTime }`.

- [ ] **Step 3: Update `getDashboard`**

Add to the parallel fetches:

```js
const masteryTrajectory = MasteryEventStore.queryDomainAverages({ userId, since });
```

Return: `{ mastery, timeline, sessions, topConcepts, masteryTrajectory }`.

- [ ] **Step 4: Run tests**

Run: `npx jest src/__tests__/main/BrainVisibilityService.test.js`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/main/utils/BrainVisibilityService.js src/__tests__/main/BrainVisibilityService.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-12): BrainVisibilityService consumes mastery_event"
```

---

### Task 7: UI — `MasterySparkline` + `MasteryTrajectoryStrip` + integrate

**Files:**
- Create: `src/renderer/views/brainVisibility/MasterySparkline.jsx`
- Create: `src/renderer/views/brainVisibility/MasteryTrajectoryStrip.jsx`
- Modify: `src/renderer/views/brainVisibility/ConceptInspector.jsx`
- Modify: `src/renderer/views/brainVisibility/BrainActivityDashboard.jsx`
- Test: `src/__tests__/renderer/brainVisibility/masteryUI.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import MasterySparkline from '../../../renderer/views/brainVisibility/MasterySparkline';
import MasteryTrajectoryStrip from '../../../renderer/views/brainVisibility/MasteryTrajectoryStrip';

test('MasterySparkline renders an SVG with N polyline points for N events', () => {
  const series = [
    { ts: 1000, box: 1, mastery: 25, eventType: 'imported', source: 'backfill' },
    { ts: 2000, box: 1, mastery: 40, eventType: 'mastery_change', source: 'user-review' },
    { ts: 3000, box: 2, mastery: 55, eventType: 'mastery_change', source: 'production-grade' },
  ];
  const { container } = render(<MasterySparkline series={series} />);
  const polyline = container.querySelector('polyline');
  expect(polyline).toBeInTheDocument();
  expect(polyline.getAttribute('points').split(' ').length).toBe(3);
});

test('MasterySparkline renders empty state for empty series', () => {
  render(<MasterySparkline series={[]} />);
  expect(screen.getByText(/no history/i)).toBeInTheDocument();
});

test('MasteryTrajectoryStrip groups by domain into one line each', () => {
  const data = [
    { day: '2026-06-15', domain: 'vocabulary', avgMastery: 30, eventCount: 2 },
    { day: '2026-06-16', domain: 'vocabulary', avgMastery: 45, eventCount: 1 },
    { day: '2026-06-15', domain: 'concept', avgMastery: 60, eventCount: 1 },
  ];
  const { container } = render(<MasteryTrajectoryStrip data={data} />);
  expect(screen.getByText(/vocabulary/i)).toBeInTheDocument();
  expect(screen.getByText(/concept/i)).toBeInTheDocument();
  expect(container.querySelectorAll('polyline').length).toBe(2);
});
```

- [ ] **Step 2: Implement `MasterySparkline.jsx`**

```jsx
import React from 'react';

export default function MasterySparkline({ series, width = 320, height = 40 }) {
  if (!series || series.length === 0) {
    return <div style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>No history</div>;
  }
  const xs = series.map(s => s.ts);
  const ys = series.map(s => (typeof s.mastery === 'number' ? s.mastery : 0));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = 0, yMax = Math.max(100, ...ys);
  const pad = 4;
  const xScale = t => pad + ((t - xMin) / Math.max(1, xMax - xMin)) * (width - 2 * pad);
  const yScale = v => height - pad - ((v - yMin) / Math.max(1, yMax - yMin)) * (height - 2 * pad);
  const points = series.map(s => `${xScale(s.ts).toFixed(1)},${yScale(s.mastery || 0).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ background: '#f7f7f9', borderRadius: 4 }}>
      <polyline fill="none" stroke="#69a" strokeWidth="2" points={points} />
      {series.map((s, i) => (
        <circle key={i} cx={xScale(s.ts)} cy={yScale(s.mastery || 0)} r="2" fill="#69a">
          <title>{`${new Date(s.ts).toLocaleString()} — mastery ${s.mastery}, ${s.eventType}`}</title>
        </circle>
      ))}
    </svg>
  );
}
```

- [ ] **Step 3: Implement `MasteryTrajectoryStrip.jsx`**

```jsx
import React from 'react';

const COLORS = { vocabulary: '#69a', concept: '#9c6', code: '#c69', math: '#c96', other: '#999' };

export default function MasteryTrajectoryStrip({ data }) {
  if (!data || data.length === 0) {
    return <Strip title="Mastery Trajectory"><em style={{ color: '#999' }}>No mastery events in this window</em></Strip>;
  }
  const byDomain = {};
  for (const r of data) {
    if (!byDomain[r.domain]) byDomain[r.domain] = [];
    byDomain[r.domain].push(r);
  }
  const allDays = [...new Set(data.map(d => d.day))].sort();
  const dayIdx = Object.fromEntries(allDays.map((d, i) => [d, i]));
  const width = 400, height = 80, pad = 6;
  const xScale = i => pad + (i / Math.max(1, allDays.length - 1)) * (width - 2 * pad);
  const yScale = m => height - pad - (m / 100) * (height - 2 * pad);
  return (
    <Strip title="Mastery Trajectory">
      <svg width={width} height={height} style={{ background: '#f7f7f9', borderRadius: 4 }}>
        {Object.entries(byDomain).map(([domain, rows]) => {
          const sorted = [...rows].sort((a, b) => a.day < b.day ? -1 : 1);
          const points = sorted.map(r => `${xScale(dayIdx[r.day]).toFixed(1)},${yScale(r.avgMastery).toFixed(1)}`).join(' ');
          return <polyline key={domain} fill="none" stroke={COLORS[domain] || COLORS.other} strokeWidth="2" points={points} />;
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#666', marginTop: 4 }}>
        {Object.keys(byDomain).map(d => (
          <span key={d}><span style={{ display: 'inline-block', width: 10, height: 10, background: COLORS[d] || COLORS.other, marginRight: 4 }} />{d}</span>
        ))}
      </div>
    </Strip>
  );
}
function Strip({ title, children }) { return <div style={{ marginBottom: 24 }}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{title}</h3>{children}</div>; }
```

- [ ] **Step 4: Integrate sparkline into `ConceptInspector`**

In `ConceptInspector.jsx`, replace the `(snapshot only — no event history)` badge with:

```jsx
{data.boxOverTime && data.boxOverTime.length > 0
  ? <MasterySparkline series={data.boxOverTime} />
  : <span style={{ marginLeft: 12, fontStyle: 'italic', color: '#999', fontSize: 12 }}>(snapshot only)</span>}
```

Add import at top: `import MasterySparkline from './MasterySparkline';`

- [ ] **Step 5: Integrate strip into `BrainActivityDashboard`**

In `BrainActivityDashboard.jsx`, add the strip between `MasterySnapshotStrip` and `BrainActivityTimelineStrip`:

```jsx
<MasterySnapshotStrip data={data.mastery} />
<MasteryTrajectoryStrip data={data.masteryTrajectory} />
<BrainActivityTimelineStrip data={data.timeline} />
```

Add import: `import MasteryTrajectoryStrip from './MasteryTrajectoryStrip';`

- [ ] **Step 6: Run tests**

Run: `npx jest src/__tests__/renderer/brainVisibility/`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/views/brainVisibility/MasterySparkline.jsx src/renderer/views/brainVisibility/MasteryTrajectoryStrip.jsx src/renderer/views/brainVisibility/ConceptInspector.jsx src/renderer/views/brainVisibility/BrainActivityDashboard.jsx src/__tests__/renderer/brainVisibility/masteryUI.test.jsx
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "feat(phase-12): MasterySparkline + MasteryTrajectoryStrip + integration"
```

---

### Task 8: Integration test — backfill + forward + service + UI data shape

**Files:** Create: `src/__tests__/integration/masteryTrajectoryHappyPath.test.js`

- [ ] **Step 1: Write test**

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');
const MasteryEventStore = require('../../main/db/MasteryEventStore');
const { backfill } = require('../../main/utils/MasteryEventBackfill');
const BrainVisibilityService = require('../../main/utils/BrainVisibilityService');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  dbManager.__setDb(db);
  return db;
}

test('backfill + forward event → BrainVisibilityService surfaces both', async () => {
  const db = freshDb();
  db.prepare(`INSERT INTO learning_point (id, user_id, domain_type, title, front, back, source_type, box, mastery_level, created_at, updated_at)
              VALUES ('lp-T', 1, 'vocabulary', 'parse', '{}', '{}', 'book', 1, 25, '2026-06-15', '2026-06-15')`).run();
  await backfill({ userId: 1 });
  // Simulate a forward write
  MasteryEventStore.record({
    learningPointId: 'lp-T', userId: 1, ts: Date.now(),
    eventType: 'mastery_change', prevMastery: 25, newMastery: 55,
    source: 'production-grade', sourceRef: 'pg-1',
  });
  const concept = await BrainVisibilityService.getConcept({ learningPointId: 'lp-T', userId: 1 });
  expect(concept.boxOverTime.length).toBeGreaterThanOrEqual(2);
  expect(concept.boxOverTime[concept.boxOverTime.length - 1].mastery).toBe(55);

  const dash = await BrainVisibilityService.getDashboard({ window: '90d', userId: 1 });
  expect(Array.isArray(dash.masteryTrajectory)).toBe(true);
});
```

- [ ] **Step 2: Run + regression**

Run: `npx jest src/__tests__/integration/masteryTrajectoryHappyPath.test.js`
Expected: passing.

Then: `npx jest`
Expected: green (modulo pre-existing flakes).

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/masteryTrajectoryHappyPath.test.js
git -c user.email=nihanning@hotmail.com -c user.name=watchsound commit -m "test(phase-12): integration — backfill + forward → dashboard + concept"
```

---

## Success criteria

- All 8 tasks committed.
- New tests pass: MasteryEventStore (4), Backfill (3), LearningPointManager mastery event (1+), BrainVisibilityService extended (2), UI (3), integration (1). ≥ 14 new tests.
- `npx jest` green.
- Manual: boot, watch for `[phase-12] backfill complete` log. Open BrainDashboard → Visibility. Mastery Trajectory strip shows lines per domain. Click a concept → sparkline replaces the snapshot badge.

**Out of scope:**
- Attributed mastery deltas (Phase 13).
- Predictive recommendations (Phase 13+).
- Pruning policy for `mastery_event` (deferred).
