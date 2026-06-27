const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const ForumDiscussionManager = require('../../main/db/ForumDiscussionManager');
const forumHandlers = require('../../main/ipc/forumHandlers');

jest.mock('../../main/brain/spine/brainCall', () => jest.fn());
const brainCall = require('../../main/brain/spine/brainCall');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(
    fs.readFileSync(path.join(__dirname, '../../..', 'db.sql'), 'utf8'),
  );
  db.exec(`INSERT INTO book (id, name) VALUES (1, 'Walden')`);
  return db;
}

describe('Study Forum end-to-end', () => {
  let db;
  let mgr;
  beforeEach(() => {
    db = makeDb();
    mgr = new ForumDiscussionManager(db);
    forumHandlers.__setDeps({ manager: mgr });
    brainCall.mockReset();
  });
  afterEach(() => {
    db.close();
  });

  const anchor = {
    bookId: 1,
    chapterId: 'Solitude',
    cfiRange: 'epubcfi(/6/4!/4/2)',
    selectionText: 'I have a great deal of company in my house',
    pageTextHash: 'hash-1',
  };

  test('seed → reply → revisit roundtrip preserves state', async () => {
    brainCall.mockResolvedValueOnce({
      output: {
        turns: [
          {
            persona: 'moderator',
            content: 'What does company mean here?',
          },
          {
            persona: 'skeptic',
            content: 'Strange claim for a solitary chapter.',
          },
        ],
      },
      callId: 1,
      cost_usd: 0.011,
    });

    const created = await forumHandlers.getOrCreate({
      anchor,
      passageText: anchor.selectionText,
      bookTitle: 'Walden',
      chapterTitle: 'Solitude',
    });
    expect(created.turns.length).toBe(2);
    expect(created.seedCostUsd).toBeCloseTo(0.011);

    brainCall.mockResolvedValueOnce({
      output: {
        turns: [
          {
            persona: 'skeptic',
            content: 'Fair point — company of what kind?',
          },
        ],
      },
      callId: 2,
      cost_usd: 0.0025,
    });
    const replied = await forumHandlers.reply({
      discussionId: created.id,
      userContent: 'Maybe trees?',
      addressedTo: 'skeptic',
    });
    expect(replied.turns.length).toBe(4);
    expect(replied.turns[2]).toMatchObject({
      persona: 'user',
      content: 'Maybe trees?',
      addressedTo: 'skeptic',
      cost_usd: 0.0025,
    });
    expect(replied.turns[3].persona).toBe('skeptic');

    // Revisit — same anchor, no new brainCall, returns full thread.
    brainCall.mockClear();
    const revisited = await forumHandlers.getOrCreate({
      anchor,
      passageText: anchor.selectionText,
      bookTitle: 'Walden',
      chapterTitle: 'Solitude',
    });
    expect(brainCall).not.toHaveBeenCalled();
    expect(revisited.id).toBe(created.id);
    expect(revisited.turns.length).toBe(4);
  });

  test('whole-page anchor (null cfi) dedups on pageTextHash', async () => {
    brainCall.mockResolvedValueOnce({
      output: { turns: [{ persona: 'moderator', content: 'p' }] },
      callId: 1,
      cost_usd: 0.01,
    });
    const wpAnchor = { ...anchor, cfiRange: null, selectionText: null };
    const first = await forumHandlers.getOrCreate({
      anchor: wpAnchor,
      passageText: 'whole page text',
      bookTitle: 'B',
      chapterTitle: 'C',
    });
    brainCall.mockClear();
    const second = await forumHandlers.getOrCreate({
      anchor: wpAnchor,
      passageText: 'whole page text',
      bookTitle: 'B',
      chapterTitle: 'C',
    });
    expect(brainCall).not.toHaveBeenCalled();
    expect(second.id).toBe(first.id);
  });
});
