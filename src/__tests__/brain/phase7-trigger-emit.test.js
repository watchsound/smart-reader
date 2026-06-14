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
    registerLearningPathPlannerHandlers({ triggerEmitter });

    const result = await handlers['learning-path-plan'](
      null,
      { goal: 'Learn German B2', token: 'tok-1' },
    );

    expect(result.summary).toBe('Plan summary');
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
  });

  test('does not emit when plan returns error', async () => {
    const handlers = {};
    jest.doMock('electron', () => ({
      ipcMain: {
        handle: (channel, fn) => { handlers[channel] = fn; },
      },
    }));
    jest.doMock('../../main/db/BookManager', () => ({
      getBooksByCategory: () => [],
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
    registerLearningPathPlannerHandlers({ triggerEmitter });

    const result = await handlers['learning-path-plan'](
      null,
      { goal: 'X', token: 't' },
    );
    expect(result.error).toBe('no books');
    expect(triggerEmitter.emit).not.toHaveBeenCalled();
  });
});
