const handlers = require('../../main/ipc/predictiveHandlers');

describe('predictiveHandlers', () => {
  test('exposes the four channels via register()', () => {
    const captured = new Map();
    const fakeIpc = { handle: (channel, fn) => captured.set(channel, fn) };
    handlers.register(fakeIpc, {
      predict: async () => ({ ok: 'predict' }),
      rankCandidates: async () => ({ ok: 'rank' }),
      refreshModel: async () => ({ ok: 'refresh' }),
      calibrationReport: async () => ({ ok: 'report' }),
    });
    expect(captured.has('predictive:predict')).toBe(true);
    expect(captured.has('predictive:rank')).toBe(true);
    expect(captured.has('predictive:refresh')).toBe(true);
    expect(captured.has('predictive:report')).toBe(true);
  });

  test('passes args through to engine methods', async () => {
    const captured = new Map();
    const fakeIpc = { handle: (channel, fn) => captured.set(channel, fn) };
    const engine = {
      predict: jest.fn().mockResolvedValue({ expectedMasteryDelta: 5 }),
      rankCandidates: jest.fn().mockResolvedValue([]),
      refreshModel: jest.fn().mockResolvedValue({ refreshed: true }),
      calibrationReport: jest.fn().mockResolvedValue({ coverage: 0.7 }),
    };
    handlers.register(fakeIpc, engine);
    const args = { featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary' };
    await captured.get('predictive:predict')({}, args);
    expect(engine.predict).toHaveBeenCalledWith(args);
    await captured.get('predictive:rank')({}, [args]);
    expect(engine.rankCandidates).toHaveBeenCalledWith([args]);
    await captured.get('predictive:refresh')({}, { force: true });
    expect(engine.refreshModel).toHaveBeenCalledWith({ force: true });
    await captured.get('predictive:report')({}, { windowDays: 30 });
    expect(engine.calibrationReport).toHaveBeenCalledWith({ windowDays: 30 });
  });
});
