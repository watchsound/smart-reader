/**
 * questWalkHandlers test — re-emits a stored Phase 7 path as a
 * multi-surface-flow Trigger.
 */

describe('questWalkHandlers — quest-walk', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function setup({ store, triggerEmitter }) {
    const handlers = {};
    jest.doMock('electron', () => ({
      ipcMain: {
        handle: (channel, fn) => {
          handlers[channel] = fn;
        },
      },
    }));
    const {
      registerQuestWalkHandlers,
    } = require('../../main/ipc/questWalkHandlers');
    registerQuestWalkHandlers(store, { triggerEmitter });
    return handlers;
  }

  test('emits multi-surface-flow Trigger for phase-7 quest with steps', async () => {
    const state = {
      'quests.items': [
        {
          id: 'q1',
          name: 'X',
          goal: 'g',
          bookIds: [1, 2],
          status: 'active',
          metadata: {
            source: 'phase-7-learning-path',
            pathSteps: [
              { bookId: 1, bookTitle: 'A', reason: 'r1' },
              { bookId: 2, bookTitle: 'B', reason: 'r2' },
            ],
            summary: 'sum',
          },
        },
      ],
    };
    const store = {
      get: (k, d) => (k in state ? state[k] : d),
      set: (k, v) => {
        state[k] = v;
      },
    };
    const triggerEmitter = { emit: jest.fn() };
    const handlers = setup({ store, triggerEmitter });

    const result = await handlers['quest-walk'](null, { questId: 'q1' });
    expect(result).toEqual({ ok: true });
    expect(triggerEmitter.emit).toHaveBeenCalledTimes(1);
    const emitted = triggerEmitter.emit.mock.calls[0][0];
    expect(emitted.unit).toBe('multi-surface-flow');
    expect(emitted.id).toBe('phase7:walk:q1');
    expect(emitted.source).toBe('phase-7-learning-path');
    expect(emitted.payload.questId).toBe('q1');
    expect(emitted.payload.steps).toEqual([
      { view: 'reading/1', payload: expect.objectContaining({ label: 'A' }) },
      { view: 'reading/2', payload: expect.objectContaining({ label: 'B' }) },
    ]);
  });

  test('rejects quest from non-phase-7 source', async () => {
    const state = {
      'quests.items': [
        {
          id: 'q2',
          name: 'manual',
          goal: 'g',
          bookIds: [],
          status: 'active',
          metadata: {},
        },
      ],
    };
    const store = { get: (k, d) => (k in state ? state[k] : d), set: () => {} };
    const triggerEmitter = { emit: jest.fn() };
    const handlers = setup({ store, triggerEmitter });

    const result = await handlers['quest-walk'](null, { questId: 'q2' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/phase-7/);
    expect(triggerEmitter.emit).not.toHaveBeenCalled();
  });

  test('rejects walk for unknown quest', async () => {
    const store = { get: () => [], set: () => {} };
    const triggerEmitter = { emit: jest.fn() };
    const handlers = setup({ store, triggerEmitter });

    const result = await handlers['quest-walk'](null, { questId: 'nope' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  test('rejects walk when quest has no steps', async () => {
    const state = {
      'quests.items': [
        {
          id: 'q3',
          name: 'empty',
          goal: 'g',
          bookIds: [],
          status: 'active',
          metadata: {
            source: 'phase-7-learning-path',
            pathSteps: [],
          },
        },
      ],
    };
    const store = { get: (k, d) => (k in state ? state[k] : d), set: () => {} };
    const triggerEmitter = { emit: jest.fn() };
    const handlers = setup({ store, triggerEmitter });

    const result = await handlers['quest-walk'](null, { questId: 'q3' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/walkable/);
  });
});
