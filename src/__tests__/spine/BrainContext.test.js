// src/__tests__/spine/BrainContext.test.js
const mockGetRecentEpisodes = jest.fn();
const mockTopNByMastery = jest.fn();
const mockGetTriggerTelemetry = jest.fn();

jest.mock('../../main/db/LearningPointManager', () => ({
  topNByMastery: mockTopNByMastery,
}));

jest.mock('../../main/brain', () => ({
  getLearningBrain: () => ({
    episodeCollector: { getRecentEpisodes: mockGetRecentEpisodes },
    getTriggerTelemetry: mockGetTriggerTelemetry,
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
require('../../main/brain/spine/slices/mastery');
require('../../main/brain/spine/slices/recentComprehension');
require('../../main/brain/spine/slices/acceptDismissPatterns');

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

describe('BrainContext.mastery', () => {
  beforeEach(() => { mockTopNByMastery.mockReset(); });

  test('returns top-N learning points compacted', async () => {
    mockTopNByMastery.mockReturnValue([
      { concept: 'duration', mastery_level: 78 },
      { concept: 'convexity', mastery_level: 42 },
    ]);
    const result = await BrainContext.buildSlice(['mastery'], 1);
    expect(result.mastery).toEqual([
      { c: 'duration', m: 78 },
      { c: 'convexity', m: 42 },
    ]);
    expect(mockTopNByMastery).toHaveBeenCalledWith(1, 15);
  });
});

describe('BrainContext.recentComprehension', () => {
  test('returns empty array placeholder for Phase 9a', async () => {
    const result = await BrainContext.buildSlice(['recentComprehension'], 1);
    expect(result.recentComprehension).toEqual([]);
  });
});

describe('BrainContext.acceptDismissPatterns', () => {
  beforeEach(() => { mockGetTriggerTelemetry.mockReset(); });

  test('returns per-source accept/dismiss ratios', async () => {
    mockGetTriggerTelemetry.mockReturnValue({
      bySource: {
        'reread-queue-schedule':      { accepted: 2, dismissed: 8 },
        'schedule-production-prompt': { accepted: 5, dismissed: 1 },
      },
    });
    const result = await BrainContext.buildSlice(['acceptDismissPatterns'], 1);
    const p = result.acceptDismissPatterns;
    expect(p['reread-queue-schedule'].acceptRate).toBeCloseTo(0.2, 2);
    expect(p['schedule-production-prompt'].acceptRate).toBeCloseTo(0.833, 2);
  });

  test('returns empty object when telemetry empty', async () => {
    mockGetTriggerTelemetry.mockReturnValue({ bySource: {} });
    const result = await BrainContext.buildSlice(['acceptDismissPatterns'], 1);
    expect(result.acceptDismissPatterns).toEqual({});
  });
});
