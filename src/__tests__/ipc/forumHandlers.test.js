const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const ForumDiscussionManager = require('../../main/db/ForumDiscussionManager');

// Mock brainCall — handler tests assert on it; Spine behavior covered elsewhere.
jest.mock('../../main/brain/spine/brainCall', () => jest.fn());
const brainCall = require('../../main/brain/spine/brainCall');

const handlers = require('../../main/ipc/forumHandlers');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(
    fs.readFileSync(path.join(__dirname, '../../..', 'db.sql'), 'utf8'),
  );
  db.exec(`INSERT INTO book (id, name) VALUES (1, 'Walden')`);
  return db;
}

const anchor = {
  bookId: 1,
  chapterId: 'ch-1',
  cfiRange: 'epubcfi(/6/4!/4/2)',
  selectionText: 'consider the lilies',
  pageTextHash: 'hash-1',
};

describe('forumHandlers', () => {
  let db;
  let mgr;
  beforeEach(() => {
    db = makeDb();
    mgr = new ForumDiscussionManager(db);
    handlers.__setDeps({ manager: mgr });
    brainCall.mockReset();
  });
  afterEach(() => {
    db.close();
  });

  test('getOrCreate creates new discussion via seed call on miss', async () => {
    brainCall.mockResolvedValueOnce({
      output: { turns: [{ persona: 'moderator', content: 'Open?' }] },
      callId: 100,
      cost_usd: 0.012,
    });
    const result = await handlers.getOrCreate({
      anchor,
      passageText: 'consider the lilies',
      bookTitle: 'Walden',
      chapterTitle: 'Solitude',
    });
    expect(brainCall).toHaveBeenCalledWith(
      'simulate-forum-seed',
      expect.any(String),
      expect.any(Object),
    );
    expect(result.id).toBeGreaterThan(0);
    expect(result.turns.length).toBe(1);
    expect(result.seedCostUsd).toBeCloseTo(0.012);
  });

  test('getOrCreate returns existing on hit without calling brainCall', async () => {
    mgr.create(
      anchor,
      [{ persona: 'moderator', content: 'cached', ts: 1 }],
      0.005,
    );
    const result = await handlers.getOrCreate({
      anchor,
      passageText: 'consider the lilies',
      bookTitle: 'Walden',
      chapterTitle: 'Solitude',
    });
    expect(brainCall).not.toHaveBeenCalled();
    expect(result.turns[0].content).toBe('cached');
  });

  test('reply appends user turn with cost_usd and persona turns', async () => {
    const created = mgr.create(
      anchor,
      [{ persona: 'moderator', content: 'Open?', ts: 1 }],
      0.005,
    );
    brainCall.mockResolvedValueOnce({
      output: { turns: [{ persona: 'skeptic', content: 'Counter-claim.' }] },
      callId: 101,
      cost_usd: 0.003,
    });
    const updated = await handlers.reply({
      discussionId: created.id,
      userContent: 'What about X?',
      addressedTo: 'skeptic',
    });
    expect(updated.turns.length).toBe(3);
    expect(updated.turns[1]).toMatchObject({
      persona: 'user',
      content: 'What about X?',
      addressedTo: 'skeptic',
      cost_usd: 0.003,
    });
    expect(updated.turns[2]).toMatchObject({
      persona: 'skeptic',
      content: 'Counter-claim.',
    });
  });

  test('listByChapter delegates to manager', async () => {
    mgr.create(anchor, [{ persona: 'moderator', content: 'x', ts: 1 }], 0);
    const list = await handlers.listByChapter({ bookId: 1, chapterId: 'ch-1' });
    expect(list.length).toBe(1);
  });
});
