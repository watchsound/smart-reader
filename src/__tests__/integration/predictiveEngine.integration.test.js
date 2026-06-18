const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'predictive-int-'));
jest.mock('electron', () => ({ app: { getPath: () => tmp } }));

jest.mock('../../main/db/dbManager', () => {
  const db = new (require('better-sqlite3'))(':memory:');
  db.exec(`
    CREATE TABLE mastery_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learning_point_id TEXT, user_id INTEGER, ts INTEGER, event_type TEXT,
      prev_box INTEGER, new_box INTEGER, prev_mastery REAL, new_mastery REAL,
      rating TEXT, source TEXT, source_ref TEXT, notes TEXT,
      proximate_call_id INTEGER, feature_surface TEXT DEFAULT 'unknown'
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

const { SHRINKAGE_LEVELS } = require('../../main/brain/predictive/predictiveEnums');
const PredictiveEngine = require('../../main/brain/predictive/PredictiveEngine');

function seedDenseDirectorVocab(dbMock) {
  const lp = dbMock.__db.prepare(
    `INSERT OR IGNORE INTO learning_point (id, user_id, domain_type, box, mastery_level) VALUES (?, 1, ?, 1, 30)`
  );
  ['lp-a', 'lp-b', 'lp-c'].forEach((id) => lp.run(id, 'vocabulary'));
  const insCall = dbMock.__db.prepare(`INSERT INTO brain_call_ledger (ts, intent, cost_usd) VALUES (?, ?, ?)`);
  const now = Date.now();
  const cid = insCall.run(now - 1000, 'director-session-step', 0.002).lastInsertRowid;
  const ins = dbMock.__db.prepare(`
    INSERT INTO mastery_event (learning_point_id, user_id, ts, event_type, prev_box, new_box, prev_mastery, new_mastery, source, feature_surface, proximate_call_id)
    VALUES (?, 1, ?, 'review', ?, ?, ?, ?, 'user-review', ?, ?)
  `);
  for (let i = 0; i < 40; i++) {
    ins.run(`lp-${'abc'[i % 3]}`, now - (i + 1) * 60_000, 1, 2, 30, 40 + (i % 3), 'director-session', cid);
  }
}

describe('PredictiveEngine refreshModel', () => {
  beforeEach(() => {
    const dbMock = require('../../main/db/dbManager');
    dbMock.__db.exec('DELETE FROM mastery_event; DELETE FROM learning_point; DELETE FROM brain_call_ledger;');
    const file = path.join(tmp, 'predictive_model.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  test('writes cache file with cells, parents, costs, computedAt', async () => {
    const dbMock = require('../../main/db/dbManager');
    const lp = dbMock.__db.prepare(
      `INSERT INTO learning_point (id, user_id, domain_type, box, mastery_level) VALUES (?, 1, ?, 1, 30)`
    );
    lp.run('lp-1', 'vocabulary');
    dbMock.__db.prepare(`
      INSERT INTO mastery_event (learning_point_id, user_id, ts, event_type, prev_box, new_box, prev_mastery, new_mastery, source, feature_surface)
      VALUES ('lp-1', 1, ?, 'review', 1, 2, 30, 40, 'director-session', 'director-session')
    `).run(Date.now() - 60_000);
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
    const dbMock = require('../../main/db/dbManager');
    dbMock.__db.prepare(
      `INSERT INTO learning_point (id, user_id, domain_type, box, mastery_level) VALUES ('lp-x', 1, 'vocabulary', 1, 30)`
    ).run();
    const engine = new PredictiveEngine();
    await engine.refreshModel({ force: true });
    const first = JSON.parse(fs.readFileSync(path.join(tmp, 'predictive_model.json'), 'utf8'));
    const second = await engine.refreshModel({ force: false });
    expect(second.refreshed).toBe(false);
    const after = JSON.parse(fs.readFileSync(path.join(tmp, 'predictive_model.json'), 'utf8'));
    expect(after.computedAt).toBe(first.computedAt);
  });
});

describe('PredictiveEngine predict', () => {
  beforeEach(() => {
    const dbMock = require('../../main/db/dbManager');
    dbMock.__db.exec('DELETE FROM mastery_event; DELETE FROM learning_point; DELETE FROM brain_call_ledger;');
    const file = path.join(tmp, 'predictive_model.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  test('dense cell returns shrinkageLevel=cell with positive expectedMasteryDelta', async () => {
    const dbMock = require('../../main/db/dbManager');
    seedDenseDirectorVocab(dbMock);
    const engine = new PredictiveEngine();
    await engine.refreshModel({ force: true });
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
    const dbMock = require('../../main/db/dbManager');
    seedDenseDirectorVocab(dbMock);
    const engine = new PredictiveEngine();
    await engine.refreshModel({ force: true });
    const out = await engine.predict({
      featureSurface: 'comprehension', currentBox: 4, domain: 'math',
    });
    expect([SHRINKAGE_LEVELS.SURFACE, SHRINKAGE_LEVELS.GLOBAL]).toContain(out.shrinkageLevel);
    expect(out.n).toBe(0);
  });
});

describe('PredictiveEngine rankCandidates', () => {
  beforeEach(() => {
    const dbMock = require('../../main/db/dbManager');
    dbMock.__db.exec('DELETE FROM mastery_event; DELETE FROM learning_point; DELETE FROM brain_call_ledger;');
    const file = path.join(tmp, 'predictive_model.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  test('sorts by ROI descending and includes prediction + ref', async () => {
    const dbMock = require('../../main/db/dbManager');
    const lp = dbMock.__db.prepare(`INSERT OR IGNORE INTO learning_point (id, user_id, domain_type, box, mastery_level) VALUES (?, 1, ?, 1, 30)`);
    lp.run('a', 'vocabulary'); lp.run('b', 'code');
    const insCall = dbMock.__db.prepare(`INSERT INTO brain_call_ledger (ts, intent, cost_usd) VALUES (?, ?, ?)`);
    const ev = dbMock.__db.prepare(`INSERT INTO mastery_event (learning_point_id, user_id, ts, event_type, prev_box, new_box, prev_mastery, new_mastery, source, feature_surface, proximate_call_id) VALUES (?, 1, ?, 'review', ?, ?, ?, ?, 'user-review', ?, ?)`);
    const now = Date.now();
    const c1 = insCall.run(now - 1000, 'director-session-step', 0.001).lastInsertRowid;
    for (let i = 0; i < 20; i++) ev.run('a', now - (i + 1) * 60_000, 1, 2, 30, 33, 'director-session', c1);
    const c2 = insCall.run(now - 1100, 'production-grade', 0.010).lastInsertRowid;
    for (let i = 0; i < 20; i++) ev.run('b', now - (i + 1) * 60_000, 1, 2, 30, 50, 'production-prompt', c2);

    const engine = new PredictiveEngine();
    await engine.refreshModel({ force: true });
    const ranked = await engine.rankCandidates([
      { featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary', ref: 'A' },
      { featureSurface: 'production-prompt', currentBox: 1, domain: 'code', ref: 'B' },
    ]);
    expect(ranked).toHaveLength(2);
    expect(ranked.every((r) => r.prediction)).toBe(true);
    expect(ranked[0].ref).toBe('A');
  });
});

describe('PredictiveEngine calibrationReport', () => {
  beforeEach(() => {
    const dbMock = require('../../main/db/dbManager');
    dbMock.__db.exec('DELETE FROM mastery_event; DELETE FROM learning_point; DELETE FROM brain_call_ledger;');
    const file = path.join(tmp, 'predictive_model.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

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

describe('PredictiveEngine end-to-end (seed → refresh → predict → report)', () => {
  beforeEach(() => {
    const dbMock = require('../../main/db/dbManager');
    dbMock.__db.exec('DELETE FROM mastery_event; DELETE FROM learning_point; DELETE FROM brain_call_ledger;');
    const file = path.join(tmp, 'predictive_model.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  test('synthetic 3-surface × 5-box × 4-domain corpus exercises hierarchy', async () => {
    const dbMock = require('../../main/db/dbManager');
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
          for (let i = 0; i < 3; i++) {
            const lpId = `lp-${lpCount++}`;
            lpStmt.run(lpId, d, b, 30 + i * 5);
            const ts = Date.now() - (i + 1) * 60_000;
            const cid = callStmt.run(ts - 10, `${s}-step`, 0.001 + boxes.indexOf(b) * 0.0005).lastInsertRowid;
            const newBox = i === 2 ? b + 1 : b;
            evStmt.run(lpId, ts, b, newBox, 30, 30 + 4 + i, s, cid);
          }
        }
      }
    }

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
