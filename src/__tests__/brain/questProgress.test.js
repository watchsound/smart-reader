/**
 * quest-progress IPC handler test — aggregates a Quest's learning-point
 * counts (via learningPointService → graph backend) and path-step count
 * (from the Quest's persisted metadata.pathSteps).
 */

describe('questHandlers — quest-progress', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function setup({ state, getBySource }) {
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
    jest.doMock('../../main/utils/LearningPointService', () => ({
      __esModule: true,
      default: {
        getBySource:
          getBySource ||
          (async () => []),
      },
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
    // bookId 1 → 7 cards, bookId 2 → 5 cards, bookId 3 → 0 (untouched).
    // Total = 12, booksStarted = 2.
    const getBySource = jest.fn(async (sourceType, sourceId) => {
      if (sourceType !== 'book') return [];
      if (sourceId === '1') return new Array(7).fill({});
      if (sourceId === '2') return new Array(5).fill({});
      return [];
    });
    const handlers = setup({ state, getBySource });
    const result = await handlers['quest-progress'](null, {
      id: 'q1',
      token: 't',
    });
    // Called once per bookId, with stringified ids (matches how the
    // graph schema stores sourceId).
    expect(getBySource).toHaveBeenCalledTimes(3);
    expect(getBySource).toHaveBeenCalledWith('book', '1', 't');
    expect(getBySource).toHaveBeenCalledWith('book', '2', 't');
    expect(getBySource).toHaveBeenCalledWith('book', '3', 't');
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
    const getBySource = jest.fn();
    const handlers = setup({ state, getBySource });
    const result = await handlers['quest-progress'](null, { id: 'q2' });
    expect(getBySource).not.toHaveBeenCalled();
    expect(result).toEqual({
      questId: 'q2',
      learningPointsTotal: 0,
      booksStarted: 0,
      booksTotal: 0,
      pathStepsTotal: 0,
    });
  });

  test('treats a failing per-book lookup as zero for that book', async () => {
    const state = {
      'quests.items': [
        {
          id: 'q3',
          name: 'Mixed',
          goal: 'g',
          status: 'active',
          bookIds: [10, 11],
          userId: 1,
        },
      ],
    };
    const getBySource = async (_t, sourceId) => {
      if (sourceId === '10') return [{}, {}, {}];
      throw new Error('graph down');
    };
    const handlers = setup({ state, getBySource });
    const result = await handlers['quest-progress'](null, {
      id: 'q3',
      token: 't',
    });
    expect(result.learningPointsTotal).toBe(3);
    expect(result.booksStarted).toBe(1);
    expect(result.booksTotal).toBe(2);
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
