const TriggerEmitter = require('../../main/brain/TriggerEmitter');

describe('TriggerEmitter', () => {
  test('sends brain:trigger:push to provided webContents', () => {
    const send = jest.fn();
    const webContents = { send };
    const emitter = new TriggerEmitter({ getWebContents: () => webContents });
    const trigger = {
      id: 'phase4:para:cfi-1',
      source: 'phase-4-micro-card',
      unit: 'atomic-chip',
      surfaceTarget: { kind: 'paragraph', cfi: 'cfi-1' },
      priority: 'normal',
      freshness: 60_000,
      payload: { term: 'foo' },
    };
    emitter.emit(trigger);
    expect(send).toHaveBeenCalledWith(
      'brain:trigger:push',
      expect.objectContaining({
        id: 'phase4:para:cfi-1',
        emittedAt: expect.any(Number),
      }),
    );
  });

  test('no-op when webContents is null (renderer not ready)', () => {
    const emitter = new TriggerEmitter({ getWebContents: () => null });
    expect(() => emitter.emit({ id: 'x' })).not.toThrow();
  });

  test('defaults missing freshness to 5 minutes', () => {
    const send = jest.fn();
    const emitter = new TriggerEmitter({ getWebContents: () => ({ send }) });
    emitter.emit({
      id: 'x',
      source: 's',
      unit: 'atomic-chip',
      surfaceTarget: { kind: 'global' },
      priority: 'normal',
      payload: {},
    });
    expect(send.mock.calls[0][1].freshness).toBe(5 * 60 * 1000);
  });
});
