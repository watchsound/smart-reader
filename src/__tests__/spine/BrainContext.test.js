// src/__tests__/spine/BrainContext.test.js
const mockGetRecentEpisodes = jest.fn();

jest.mock('../../main/brain', () => ({
  getLearningBrain: () => ({
    episodeCollector: { getRecentEpisodes: mockGetRecentEpisodes },
  }),
}));

const mockListImpl = jest.fn();

jest.mock('../../main/utils/QuestService', () => {
  return jest.fn().mockImplementation(() => ({
    list: mockListImpl,
  }));
});

// electron-store is consumed inside the slice; mock to a no-op so the
// QuestService constructor receives something usable.
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: () => [],
    set: () => {},
  }));
});

const BrainContext = require('../../main/brain/spine/BrainContext');
require('../../main/brain/spine/slices/activeQuest'); // self-registers
require('../../main/brain/spine/slices/currentBook');
require('../../main/brain/spine/slices/recentEpisodes');

describe('BrainContext.activeQuest', () => {
  beforeEach(() => {
    mockListImpl.mockReset();
  });

  test('returns the active quest summary', async () => {
    mockListImpl.mockReturnValue([
      { id: 'q1', name: 'Learn German B2', goal: 'Pass the Goethe B2 exam', bookIds: [10, 11], createdAt: '2026-01-01' },
    ]);
    const result = await BrainContext.buildSlice(['activeQuest'], 1);
    expect(result.activeQuest.name).toBe('Learn German B2');
    expect(result.activeQuest.goal).toBe('Pass the Goethe B2 exam');
    expect(result.activeQuest.bookIds).toEqual([10, 11]);
    expect(mockListImpl).toHaveBeenCalledWith({ userId: 1, status: 'active' });
  });

  test('returns inactive shape when no active quest', async () => {
    mockListImpl.mockReturnValue([]);
    const result = await BrainContext.buildSlice(['activeQuest'], 1);
    expect(result.activeQuest).toEqual({ active: false });
  });
});

describe('BrainContext.currentBook', () => {
  test('takes book context from override (renderer-supplied)', async () => {
    const result = await BrainContext.buildSlice(['currentBook'], 1, {
      currentBook: { bookId: 42, chapterIndex: 3, chapterTitle: 'Bonds' },
    });
    expect(result.currentBook).toEqual({ bookId: 42, chapterIndex: 3, chapterTitle: 'Bonds' });
  });

  test('returns null shape when no override given', async () => {
    const result = await BrainContext.buildSlice(['currentBook'], 1);
    expect(result.currentBook).toEqual({ present: false });
  });
});

describe('BrainContext.recentEpisodes', () => {
  beforeEach(() => { mockGetRecentEpisodes.mockReset(); });

  test('returns last-N episode summaries filtered by userId', async () => {
    mockGetRecentEpisodes.mockResolvedValue([
      { eventType: 'PARAGRAPH_DWELL', userId: 1, timestamp: '2026-06-17T00:00:00Z', sourceContext: { documentId: 'book-1' } },
      { eventType: 'BACKTRACK',       userId: 1, timestamp: '2026-06-17T00:01:00Z', sourceContext: { documentId: 'book-1' } },
      { eventType: 'CHAPTER_ENTERED', userId: 2, timestamp: '2026-06-17T00:02:00Z', sourceContext: { documentId: 'book-9' } },
    ]);
    const result = await BrainContext.buildSlice(['recentEpisodes'], 1);
    expect(result.recentEpisodes.length).toBe(2);
    expect(result.recentEpisodes[0]).toEqual(
      expect.objectContaining({ t: 'PARAGRAPH_DWELL' }),
    );
    expect(mockGetRecentEpisodes).toHaveBeenCalledWith(20);
  });

  test('returns empty array when brain not initialized', async () => {
    mockGetRecentEpisodes.mockResolvedValue([]);
    const result = await BrainContext.buildSlice(['recentEpisodes'], 1);
    expect(result.recentEpisodes).toEqual([]);
  });
});
