// src/__tests__/spine/BrainContext.test.js
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
