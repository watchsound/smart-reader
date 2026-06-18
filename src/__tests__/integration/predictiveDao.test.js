jest.mock('../../main/db/dbManager', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
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
    CREATE TABLE brain_call_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      intent TEXT NOT NULL,
      provider TEXT,
      cost_usd REAL DEFAULT 0,
      cache_hit INTEGER DEFAULT 0
    );
  `);
  return { __db: db, getDb: () => db };
});

const dbManagerMock = require('../../main/db/dbManager');
const dao = require('../../main/brain/predictive/predictiveDao');

describe('predictiveDao.aggregateMasteryEventsByCell', () => {
  beforeEach(() => {
    dbManagerMock.__db.exec('DELETE FROM mastery_event; DELETE FROM learning_point; DELETE FROM brain_call_ledger;');
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
    insert.run('lp-v1', 1000, 1, 2, 30, 40, 'director-session');
    insert.run('lp-v1', 1100, 1, 1, 40, 50, 'director-session');
    insert.run('lp-v2', 1200, 1, 2, 30, 35, 'director-session');

    const rows = dao.aggregateMasteryEventsByCell({ fromMs: 0, toMs: 9999 });
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        featureSurface: 'director-session',
        currentBox: 1,
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
    expect(dir.meanCost).toBeCloseTo(0.003, 5);
    expect(dir.p95Cost).toBeCloseTo(0.005, 5);
    expect(dir.n).toBe(3);
  });
});
