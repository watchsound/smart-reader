// src/__tests__/director/tools.test.js
const mockTopNByMastery = jest.fn();
jest.mock('../../main/db/LearningPointManager', () => ({
  topNByMastery: mockTopNByMastery,
}));

const mockGetRecentEpisodes = jest.fn();
jest.mock('../../main/brain', () => ({
  getLearningBrain: () => ({
    episodeCollector: { getRecentEpisodes: mockGetRecentEpisodes },
  }),
}));

jest.mock('../../main/utils/QuestService', () => {
  return jest.fn().mockImplementation(() => ({ list: jest.fn().mockReturnValue([]) }));
});
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({ get: () => [], set: () => {} }));
});

const tools = require('../../main/brain/spine/tools');
require('../../main/brain/director/tools/topUnmasteredConcepts');
require('../../main/brain/director/tools/recentEpisodeSummary');
require('../../main/brain/director/tools/currentQuestProgress');

describe('director tools', () => {
  test('topUnmasteredConcepts returns concepts under 60 mastery', async () => {
    mockTopNByMastery.mockReturnValue([
      { concept: 'duration', mastery_level: 40 },
      { concept: 'convexity', mastery_level: 75 },
      { concept: 'yield-curve', mastery_level: 30 },
    ]);
    const r = await tools.invoke('topUnmasteredConcepts', { limit: 5 });
    expect(r.concepts).toEqual(['duration', 'yield-curve']);
  });

  test('recentEpisodeSummary returns count + summary', async () => {
    const now = Date.now();
    mockGetRecentEpisodes.mockResolvedValue([
      { eventType: 'PARAGRAPH_DWELL', timestamp: new Date(now - 1 * 86400e3).toISOString() },
      { eventType: 'BACKTRACK', timestamp: new Date(now - 2 * 86400e3).toISOString() },
      { eventType: 'PARAGRAPH_DWELL', timestamp: new Date(now - 30 * 86400e3).toISOString() },
    ]);
    const r = await tools.invoke('recentEpisodeSummary', { days: 7 });
    expect(r.count).toBe(2);
    expect(r.summary).toMatch(/PARAGRAPH_DWELL/);
  });

  test('currentQuestProgress with no active quest', async () => {
    const r = await tools.invoke('currentQuestProgress', {});
    expect(r).toEqual({ active: false });
  });
});
