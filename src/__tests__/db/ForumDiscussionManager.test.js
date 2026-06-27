const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const ForumDiscussionManager = require('../../main/db/ForumDiscussionManager');

function makeDb() {
  const db = new Database(':memory:');
  const schema = fs.readFileSync(
    path.join(__dirname, '../../..', 'db.sql'),
    'utf8',
  );
  db.exec(schema);
  // Book table uses `name`, not `title`.
  db.exec(`INSERT INTO book (id, name) VALUES (1, 'Test Book')`);
  return db;
}

describe('ForumDiscussionManager', () => {
  let db;
  let mgr;
  beforeEach(() => {
    db = makeDb();
    mgr = new ForumDiscussionManager(db);
  });
  afterEach(() => {
    db.close();
  });

  const anchor = {
    bookId: 1,
    chapterId: 'ch-1',
    cfiRange: 'epubcfi(/6/4!/4/2)',
    selectionText: 'consider the lilies',
    pageTextHash: 'abc123',
  };
  const seedTurns = [
    { persona: 'moderator', content: 'Why this passage?', ts: 1 },
    { persona: 'skeptic', content: 'Is that really meaningful?', ts: 2 },
  ];

  test('findByAnchor returns null when none', () => {
    expect(mgr.findByAnchor(anchor)).toBeNull();
  });

  test('create + findByAnchor roundtrip', () => {
    const created = mgr.create(anchor, seedTurns, 0.012);
    expect(created.id).toBeGreaterThan(0);
    expect(created.turns).toEqual(seedTurns);
    expect(created.seedCostUsd).toBeCloseTo(0.012);

    const found = mgr.findByAnchor(anchor);
    expect(found.id).toBe(created.id);
    expect(found.turns).toEqual(seedTurns);
  });

  test('cfiRange takes priority over hash for keyed lookup', () => {
    mgr.create(anchor, seedTurns, 0);
    // Same hash, different cfi → different discussion.
    const other = mgr.create(
      { ...anchor, cfiRange: 'epubcfi(/6/4!/4/4)' },
      seedTurns,
      0,
    );
    expect(other.id).not.toBe(mgr.findByAnchor(anchor).id);
  });

  test('whole-page anchor (null cfiRange) keyed on hash', () => {
    const wpAnchor = { ...anchor, cfiRange: null, selectionText: null };
    mgr.create(wpAnchor, seedTurns, 0);
    expect(mgr.findByAnchor(wpAnchor)).not.toBeNull();
  });

  test('appendTurns appends and updates last_reply_at', () => {
    const created = mgr.create(anchor, seedTurns, 0);
    const before = created.lastReplyAt;
    const newTurn = {
      persona: 'user',
      content: 'I disagree',
      ts: Date.now() + 1000,
      cost_usd: 0.003,
    };
    const updated = mgr.appendTurns(created.id, [newTurn]);
    expect(updated.turns.length).toBe(3);
    expect(updated.turns[2]).toEqual(newTurn);
    expect(updated.lastReplyAt).toBeGreaterThanOrEqual(before);
  });

  test('listByBookChapter returns all matching discussions', () => {
    mgr.create(anchor, seedTurns, 0);
    mgr.create({ ...anchor, cfiRange: 'epubcfi(/6/4!/4/4)' }, seedTurns, 0);
    mgr.create({ ...anchor, chapterId: 'ch-2' }, seedTurns, 0);
    const inCh1 = mgr.listByBookChapter(1, 'ch-1');
    expect(inCh1.length).toBe(2);
  });
});
