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

  // Bug 6: user clicks Discuss before EPubView fires onPageText; discussion
  // is created with chapter_id = NULL. On revisit when chapter is known, the
  // exact-match lookup would miss and a duplicate would be created. The
  // backfill patches the existing row instead.
  describe('chapter backfill on revisit', () => {
    test('cfi-keyed: NULL-chapter row is bound on revisit with chapter', () => {
      // Initial create — no chapter context yet.
      const noChapAnchor = { ...anchor, chapterId: null };
      const created = mgr.create(noChapAnchor, seedTurns, 0.005);
      expect(created.chapterId).toBeNull();

      // Revisit — same cfi, chapter now known.
      const withChapAnchor = { ...anchor, chapterId: 'ch-1' };
      const revisited = mgr.findByAnchor(withChapAnchor);
      expect(revisited).not.toBeNull();
      expect(revisited.id).toBe(created.id);
      expect(revisited.chapterId).toBe('ch-1');

      // Listing by chapter now surfaces the previously-orphan discussion.
      expect(mgr.listByBookChapter(1, 'ch-1').length).toBe(1);
    });

    test('hash-keyed (whole-page): NULL-chapter row is bound on revisit', () => {
      const wpNoChap = {
        bookId: 1,
        chapterId: null,
        cfiRange: null,
        selectionText: null,
        pageTextHash: 'wp-hash',
      };
      const created = mgr.create(wpNoChap, seedTurns, 0);

      const wpWithChap = { ...wpNoChap, chapterId: 'ch-1' };
      const revisited = mgr.findByAnchor(wpWithChap);
      expect(revisited).not.toBeNull();
      expect(revisited.id).toBe(created.id);
      expect(revisited.chapterId).toBe('ch-1');
    });

    test('does not backfill when query chapter is null', () => {
      // If query has no chapter, we should NOT pull in some random NULL-chapter row.
      // (The exact-match branch already handles NULL=NULL.)
      mgr.create({ ...anchor, chapterId: null }, seedTurns, 0);
      const found = mgr.findByAnchor({ ...anchor, chapterId: null });
      expect(found).not.toBeNull();
      // Confirm it's still chapter-null, not silently rewritten.
      expect(found.chapterId).toBeNull();
    });

    test('does not steal rows from a different stored chapter', () => {
      // Discussion stored under chapter ch-other should NOT be returned
      // when querying ch-1, even if cfi matches.
      mgr.create({ ...anchor, chapterId: 'ch-other' }, seedTurns, 0);
      const found = mgr.findByAnchor({ ...anchor, chapterId: 'ch-1' });
      expect(found).toBeNull();
    });
  });
});
