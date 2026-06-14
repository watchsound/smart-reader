// Mock the ipcRenderer surface BEFORE requiring triggerBus.
let ipcOnHandlers = {};
const ipcInvoke = jest.fn().mockResolvedValue({ ok: true });
const ipcSend = jest.fn();

beforeEach(() => {
  ipcOnHandlers = {};
  jest.resetModules();
  // Augment jsdom window with electron.ipcRenderer rather than replacing it.
  window.electron = {
    ipcRenderer: {
      on: (channel, cb) => {
        ipcOnHandlers[channel] = cb;
      },
      removeListener: (channel) => {
        delete ipcOnHandlers[channel];
      },
      invoke: ipcInvoke,
      send: ipcSend,
    },
  };
  ipcInvoke.mockClear();
  ipcSend.mockClear();
});

afterEach(() => {
  delete window.electron;
});

const makeTrigger = (over = {}) => ({
  id: 't1',
  source: 'phase-4-micro-card',
  unit: 'atomic-chip',
  surfaceTarget: { kind: 'paragraph', cfi: 'cfi-1' },
  priority: 'normal',
  freshness: 60_000,
  emittedAt: Date.now(),
  payload: {},
  ...over,
});

describe('triggerBus', () => {
  test('receives main-process Triggers and enqueues them', () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    expect(typeof ipcOnHandlers['brain:trigger:push']).toBe('function');

    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    expect(triggerBus.getQueueSnapshot().length).toBe(1);
  });

  test('notifies subscribers when queue changes', () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    const sub = jest.fn();
    triggerBus.subscribe(sub);
    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    expect(sub).toHaveBeenCalled();
  });

  test('orbState derives from queue: idle when empty, has-proposal when not', () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    expect(triggerBus.getOrbState()).toBe('idle');
    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    expect(triggerBus.getOrbState()).toBe('has-proposal');
  });

  test('accept captures proposal snapshot, invokes IPC, removes from queue, sets mid-flow', async () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    ipcOnHandlers['brain:trigger:push'](
      null,
      makeTrigger({ id: 'x', payload: { title: 'Hello' } }),
    );
    await triggerBus.accept('x');
    expect(ipcInvoke).toHaveBeenCalledWith(
      'brain:trigger:accept',
      { proposalId: 'x', source: 'phase-4-micro-card' },
    );
    expect(triggerBus.getQueueSnapshot()).toHaveLength(0);
    expect(triggerBus.getOrbState()).toBe('mid-flow');
    expect(triggerBus.getActiveProposal()).toEqual(
      expect.objectContaining({ id: 'x', payload: { title: 'Hello' } }),
    );
  });

  test('dismiss invokes IPC and removes from queue', async () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    await triggerBus.dismiss('x');
    expect(ipcInvoke).toHaveBeenCalledWith(
      'brain:trigger:dismiss',
      { proposalId: 'x', source: 'phase-4-micro-card' },
    );
    expect(triggerBus.getQueueSnapshot()).toHaveLength(0);
  });

  test('completeActive clears active proposal and returns orb to idle', async () => {
    const triggerBus = require('../../renderer/brain/triggerBus');
    triggerBus.init();
    ipcOnHandlers['brain:trigger:push'](null, makeTrigger({ id: 'x' }));
    await triggerBus.accept('x');
    expect(triggerBus.getOrbState()).toBe('mid-flow');
    triggerBus.completeActive();
    expect(triggerBus.getOrbState()).toBe('idle');
    expect(triggerBus.getActiveProposal()).toBeNull();
  });
});
