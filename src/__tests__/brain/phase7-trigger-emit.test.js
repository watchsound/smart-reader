/**
 * Phase 7 (cross-book learning-path planner) trigger emission test.
 * Verifies that a successful plan emits a multi-surface-flow Trigger
 * shaped for MultiSurfaceFlowHost.
 */

// Mock both BookManager and the planner service before requiring the handler.
jest.mock('../../main/db/BookManager', () => ({
  getBooksByCategory: jest.fn(() => [{ id: 1, name: 'A' }]),
}));
jest.mock('../../main/utils/LearningPathPlannerService', () => ({
  __esModule: true,
  default: {
    plan: jest.fn().mockResolvedValue({
      summary: 'Plan summary',
      pathSteps: [
        { bookId: 1, bookTitle: 'Book One', reason: 'foundations' },
        { bookId: 2, bookTitle: 'Book Two', reason: 'advanced' },
        { bookTitle: 'Skipped — no bookId' },
      ],
    }),
  },
}));
jest.mock('electron', () => {
  const handlers = {};
  return {
    ipcMain: {
      handle: (channel, fn) => { handlers[channel] = fn; },
      _handlers: handlers,
    },
  };
});

describe('learningPathPlannerHandlers — Phase 7 trigger emit', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('emits a multi-surface-flow trigger when plan succeeds', async () => {
    // Re-mock electron with a fresh handlers map for this test.
    const handlers = {};
    jest.doMock('electron', () => ({
      ipcMain: {
        handle: (channel, fn) => { handlers[channel] = fn; },
      },
    }));
    jest.doMock('../../main/db/BookManager', () => ({
      getBooksByCategory: () => [{ id: 1, name: 'A' }],
    }));
    jest.doMock('../../main/db/dbManager', () => ({
      getUserIdFromToken: () => 1,
    }));
    jest.doMock('../../main/utils/LearningPathPlannerService', () => ({
      __esModule: true,
      default: {
        plan: jest.fn().mockResolvedValue({
          summary: 'Plan summary',
          pathSteps: [
            { bookId: 1, bookTitle: 'Book One', reason: 'foundations' },
            { bookId: 2, bookTitle: 'Book Two', reason: 'advanced' },
            { bookTitle: 'No id' }, // filtered out
          ],
        }),
      },
    }));

    const {
      registerLearningPathPlannerHandlers,
    } = require('../../main/ipc/learningPathPlannerHandlers');
    const triggerEmitter = { emit: jest.fn() };
    // In-memory electron-store double for Quest auto-creation.
    const state = {};
    const store = {
      get: (k, d) => (k in state ? state[k] : d),
      set: (k, v) => {
        state[k] = v;
      },
    };
    const send = jest.fn();
    registerLearningPathPlannerHandlers({
      triggerEmitter,
      store,
      getWebContents: () => ({ send }),
    });

    const result = await handlers['learning-path-plan'](
      null,
      { goal: 'Learn German B2', token: 'tok-1' },
    );

    expect(result.summary).toBe('Plan summary');
    expect(result.questId).toMatch(/^q_/);
    // Quest got persisted with both bookIds.
    expect(state['quests.items']).toHaveLength(1);
    expect(state['quests.items'][0].bookIds).toEqual([1, 2]);
    // Renderer notified so triggerBus refreshes weighting context.
    expect(send).toHaveBeenCalledWith('quest:changed');

    expect(triggerEmitter.emit).toHaveBeenCalledTimes(1);

    const emitted = triggerEmitter.emit.mock.calls[0][0];
    expect(emitted.unit).toBe('multi-surface-flow');
    expect(emitted.source).toBe('phase-7-learning-path');
    expect(emitted.id).toContain('Learn German B2');
    expect(emitted.payload.steps).toHaveLength(2); // bookId-less step filtered
    expect(emitted.payload.steps[0]).toEqual({
      view: 'reading/1',
      payload: expect.objectContaining({ label: 'Book One' }),
    });
    expect(emitted.payload.questId).toBe(result.questId);
  });

  test('does not emit or create a quest when plan returns error', async () => {
    const handlers = {};
    jest.doMock('electron', () => ({
      ipcMain: {
        handle: (channel, fn) => { handlers[channel] = fn; },
      },
    }));
    jest.doMock('../../main/db/BookManager', () => ({
      getBooksByCategory: () => [],
    }));
    jest.doMock('../../main/db/dbManager', () => ({
      getUserIdFromToken: () => 1,
    }));
    jest.doMock('../../main/utils/LearningPathPlannerService', () => ({
      __esModule: true,
      default: {
        plan: jest.fn().mockResolvedValue({ error: 'no books' }),
      },
    }));

    const {
      registerLearningPathPlannerHandlers,
    } = require('../../main/ipc/learningPathPlannerHandlers');
    const triggerEmitter = { emit: jest.fn() };
    const state = {};
    const store = {
      get: (k, d) => (k in state ? state[k] : d),
      set: (k, v) => {
        state[k] = v;
      },
    };
    registerLearningPathPlannerHandlers({ triggerEmitter, store });

    const result = await handlers['learning-path-plan'](
      null,
      { goal: 'X', token: 't' },
    );
    expect(result.error).toBe('no books');
    expect(triggerEmitter.emit).not.toHaveBeenCalled();
    expect(state['quests.items']).toBeUndefined();
  });
});
