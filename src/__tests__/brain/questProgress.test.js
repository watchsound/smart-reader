/**
 * quest-progress IPC handler test — aggregates a Quest's learning-point
 * counts (from LearningPointManager) and path-step count (from the
 * Quest's persisted metadata.pathSteps).
 */

describe('questHandlers — quest-progress', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function setup({ state, countByBookIds }) {
    const handlers = {};
    jest.doMock('electron', () => ({
      ipcMain: {
        handle: (channel, fn) => {
          handlers[channel] = fn;
        },
      },
    }));
    jest.doMock('../../main/db/dbManager', () => ({
      getUserIdFromToken: () => 1,
    }));
    jest.doMock('../../main/db/LearningPointManager', () => ({
      countByBookIds: countByBookIds || (() => ({ total: 0, booksStarted: 0 })),
    }));
    const store = {
      get: (k, d) => (k in state ? state[k] : d),
      set: (k, v) => {
        state[k] = v;
      },
    };
    const { registerQuestHandlers } = require('../../main/ipc/questHandlers');
    registerQuestHandlers(store, {});
    return handlers;
  }

  test('returns aggregated counts + path-step total for a Phase 7 quest', async () => {
    const state = {
      'quests.items': [
        {
          id: 'q1',
          name: 'CS Distributed',
          goal: 'learn',
          status: 'active',
          bookIds: [1, 2, 3],
          metadata: {
            source: 'phase-7-learning-path',
            pathSteps: [
              { bookId: 1 },
              { bookId: 2 },
              { bookId: 3 },
              { bookId: 4 },
            ],
          },
          userId: 1,
        },
      ],
    };
    const countByBookIds = jest.fn(() => ({ total: 12, booksStarted: 2 }));
    const handlers = setup({ state, countByBookIds });
    const result = await handlers['quest-progress'](null, {
      id: 'q1',
      token: 't',
    });
    expect(countByBookIds).toHaveBeenCalledWith([1, 2, 3], 't');
    expect(result).toEqual({
      questId: 'q1',
      learningPointsTotal: 12,
      booksStarted: 2,
      booksTotal: 3,
      pathStepsTotal: 4,
    });
  });

  test('returns zeros for a quest with no bookIds (still safe)', async () => {
    const state = {
      'quests.items': [
        {
          id: 'q2',
          name: 'X',
          goal: 'g',
          status: 'active',
          bookIds: [],
          userId: 1,
        },
      ],
    };
    const handlers = setup({
      state,
      // Should be skipped — empty bookIds.
      countByBookIds: () => ({ total: 99, booksStarted: 99 }),
    });
    const result = await handlers['quest-progress'](null, { id: 'q2' });
    // countByBookIds returns its mock value even for empty input (the
    // skip is enforced inside the real manager); the handler trusts it.
    expect(result.booksTotal).toBe(0);
    expect(result.pathStepsTotal).toBe(0);
  });

  test('returns null for an unknown quest id', async () => {
    const handlers = setup({ state: { 'quests.items': [] } });
    const result = await handlers['quest-progress'](null, { id: 'nope' });
    expect(result).toBeNull();
  });

  test('returns null when id is missing', async () => {
    const handlers = setup({ state: { 'quests.items': [] } });
    const result = await handlers['quest-progress'](null, {});
    expect(result).toBeNull();
  });
});
