const {
  pickDiscussionForPage,
  passageHash,
} = require('../../renderer/views/reading/forumAnchor');

describe('pickDiscussionForPage', () => {
  const pageText = 'I have a great deal of company in my house, especially in the morning.';

  test('returns null on empty inputs', () => {
    expect(pickDiscussionForPage([], pageText)).toBeNull();
    expect(pickDiscussionForPage(null, pageText)).toBeNull();
    expect(pickDiscussionForPage([{ id: 1, selectionText: 'x' }], '')).toBeNull();
    expect(pickDiscussionForPage([{ id: 1, selectionText: 'x' }], null)).toBeNull();
  });

  test('matches selection whose text appears in the page', () => {
    const discussions = [
      {
        id: 1,
        selectionText: 'great deal of company',
        pageTextHash: 'irrelevant',
        lastReplyAt: 100,
      },
    ];
    const matched = pickDiscussionForPage(discussions, pageText);
    expect(matched?.id).toBe(1);
  });

  test('does not match selection whose text is not in the page', () => {
    const discussions = [
      {
        id: 1,
        selectionText: 'something completely different',
        pageTextHash: 'irrelevant',
        lastReplyAt: 100,
      },
    ];
    expect(pickDiscussionForPage(discussions, pageText)).toBeNull();
  });

  test('matches whole-page discussion by hash when no selection match', () => {
    const discussions = [
      {
        id: 1,
        selectionText: null,
        pageTextHash: passageHash(pageText),
        lastReplyAt: 100,
      },
    ];
    expect(pickDiscussionForPage(discussions, pageText)?.id).toBe(1);
  });

  test('whole-page hash mismatch returns null', () => {
    const discussions = [
      {
        id: 1,
        selectionText: null,
        pageTextHash: 'wrong-hash',
        lastReplyAt: 100,
      },
    ];
    expect(pickDiscussionForPage(discussions, pageText)).toBeNull();
  });

  test('selection match takes priority over whole-page match', () => {
    const discussions = [
      {
        id: 1,
        selectionText: null,
        pageTextHash: passageHash(pageText),
        lastReplyAt: 200,
      },
      {
        id: 2,
        selectionText: 'great deal of company',
        pageTextHash: 'irrelevant',
        lastReplyAt: 100, // older
      },
    ];
    // The selection match wins even though it's older.
    expect(pickDiscussionForPage(discussions, pageText)?.id).toBe(2);
  });

  test('among multiple selection matches, picks most recent', () => {
    const discussions = [
      {
        id: 1,
        selectionText: 'great deal',
        lastReplyAt: 50,
      },
      {
        id: 2,
        selectionText: 'in the morning',
        lastReplyAt: 200,
      },
      {
        id: 3,
        selectionText: 'company in my house',
        lastReplyAt: 150,
      },
    ];
    expect(pickDiscussionForPage(discussions, pageText)?.id).toBe(2);
  });
});
