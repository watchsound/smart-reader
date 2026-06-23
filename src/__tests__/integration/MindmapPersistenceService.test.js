const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const MindmapPersistenceService = require('../../main/utils/MindmapPersistenceService');

/**
 * Slice db.sql down to just the tables MindmapPersistenceService touches.
 * Full db.sql contains constructs (e.g. multi-statement triggers, FTS5
 * virtual tables) that may not be portable across better-sqlite3 versions
 * in :memory:. The service only reads/writes `mindmap_node_lp_link` (and
 * relies on `learning_point` existing for the FK target), so the minimum
 * viable schema is those two tables.
 */
function loadMinimalSchema() {
  const dbSql = fs.readFileSync(
    path.join(__dirname, '../../../db.sql'),
    'utf8',
  );
  const out = [];

  // Pull the mindmap_node_lp_link CREATE + its index.
  const linkMatch = dbSql.match(
    /CREATE TABLE IF NOT EXISTS mindmap_node_lp_link[\s\S]*?\);[\s\S]*?CREATE INDEX IF NOT EXISTS idx_mindmap_link_lp[^;]+;/,
  );
  if (linkMatch) out.push(linkMatch[0]);

  // The FK target needs to exist. Stand up a minimal learning_point
  // table — just enough for the FK to resolve. We don't actually insert
  // into it in this test (the LP creation is mocked).
  out.push(`
    CREATE TABLE IF NOT EXISTS learning_point (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      title TEXT,
      created_at TEXT
    );
  `);

  return out.join('\n');
}

describe('MindmapPersistenceService', () => {
  let db;
  let learningPointServiceMock;
  let svc;

  beforeEach(() => {
    db = new Database(':memory:');
    // Explicitly disable FK enforcement. The FK on
    // mindmap_node_lp_link.lp_id -> learning_point(id) would otherwise
    // require us to seed real learning_point rows for every mock LP id,
    // which leaks the LP schema into a service-level test that only
    // exercises link-table mechanics. Production runs with FKs at the
    // SQLite default (off) anyway — see dbManager.js which only enables
    // `journal_mode = WAL` and never `foreign_keys = ON`.
    db.pragma('foreign_keys = OFF');
    db.exec(loadMinimalSchema());

    const createdIds = [];
    learningPointServiceMock = {
      createLearningPointsBatch: jest.fn(async (points) => {
        const ids = points.map(
          (_, i) => `lp-mock-${createdIds.length + i}`,
        );
        ids.forEach((id) => createdIds.push(id));
        return { created: points.length, ids };
      }),
      getBySource: jest.fn(async () => []),
      getLearningPointById: jest.fn(async () => null),
    };

    svc = new MindmapPersistenceService({
      db,
      learningPointService: learningPointServiceMock,
    });
  });

  afterEach(() => db.close());

  it('creates LPs for every node and writes link rows', async () => {
    const nodes = [
      { id: 'n1', data: { text: 'photosynthesis', domain: 'knowledge' } },
      { id: 'n2', data: { text: 'chlorophyll', domain: 'knowledge' } },
    ];
    const result = await svc.saveAsLearningPoints({
      mindmapId: 'm1',
      bookId: 'b1',
      nodes,
      token: 'tok',
    });
    expect(result.lpIds).toHaveLength(2);
    expect(
      learningPointServiceMock.createLearningPointsBatch,
    ).toHaveBeenCalledTimes(1);
    const linkRows = db
      .prepare('SELECT * FROM mindmap_node_lp_link')
      .all();
    expect(linkRows).toHaveLength(2);
    expect(linkRows[0].mindmap_id).toBe('m1');
  });

  it('is idempotent on re-save (no new LPs, no duplicate links)', async () => {
    const nodes = [
      { id: 'n1', data: { text: 'photosynthesis', domain: 'knowledge' } },
    ];
    await svc.saveAsLearningPoints({
      mindmapId: 'm1',
      bookId: 'b1',
      nodes,
      token: 'tok',
    });
    learningPointServiceMock.createLearningPointsBatch.mockClear();
    await svc.saveAsLearningPoints({
      mindmapId: 'm1',
      bookId: 'b1',
      nodes,
      token: 'tok',
    });
    expect(
      learningPointServiceMock.createLearningPointsBatch,
    ).not.toHaveBeenCalled();
    const linkRows = db
      .prepare('SELECT * FROM mindmap_node_lp_link')
      .all();
    expect(linkRows).toHaveLength(1);
  });

  it('coerces unknown domain to knowledge before batch insert', async () => {
    const nodes = [{ id: 'n1', data: { text: 'foo', domain: 'physics' } }];
    await svc.saveAsLearningPoints({
      mindmapId: 'm2',
      bookId: 'b1',
      nodes,
      token: 'tok',
    });
    const call =
      learningPointServiceMock.createLearningPointsBatch.mock.calls[0][0];
    expect(call[0].domainType).toBe('knowledge');
  });
});
