// src/__tests__/director/SessionRunner.test.js
// brainCall must be mocked before Director is required to avoid Electron DB bootstrap
jest.mock('../../main/brain/spine/brainCall', () => jest.fn());

jest.mock('../../main/brain/spine/tools', () => {
  const REG = new Map(), HND = new Map();
  return {
    register: (n, d) => REG.set(n, { ...d, name: n }),
    registerHandler: (n, h) => HND.set(n, h),
    invoke: (n, a, ctx) => HND.get(n)(a, ctx),
    descriptors: () => Array.from(REG.values()).map(t => ({ name: t.name, kind: t.kind, description: t.description, argsSchema: t.argsSchema })),
    get: (n) => REG.get(n),
    __reset: () => { REG.clear(); HND.clear(); },
  };
});
const tools = require('../../main/brain/spine/tools');
const Director = require('../../main/brain/director/Director');
const SessionRunner = require('../../main/brain/director/SessionRunner');

beforeEach(() => {
  tools.__reset();
  tools.register('readA', { kind: 'read', description: 'd', argsSchema: {} });
  tools.registerHandler('readA', async () => [{ x: 1 }]);
  tools.register('writeA', { kind: 'soft-write', description: 'd', argsSchema: {} });
  tools.registerHandler('writeA', async () => ({ callId: 11, swExtraId: 'sw-1' }));
  tools.register('surfaceA', { kind: 'surface', description: 'd', argsSchema: {} });
  tools.registerHandler('surfaceA', async (a, ctx) => ctx.awaitUserResult({ tool: 'surfaceA', args: a }));
  tools.register('endSession', { kind: 'control', description: 'd', argsSchema: {} });
  tools.registerHandler('endSession', async ({ reason }) => ({ reason }));
});

const stubStore = () => {
  const state = {};
  return {
    saveActive: jest.fn(s => { state.active = JSON.parse(JSON.stringify(s)); }),
    loadActive: jest.fn(() => state.active),
    clearActive: jest.fn(() => { delete state.active; }),
    persistCompleted: jest.fn(),
  };
};

test('unknown tool: counted as error; 3 consecutive end session', async () => {
  jest.spyOn(Director, 'step').mockResolvedValue({ tool: 'doesNotExist', args: {}, reasoning: 'oops' });
  const store = stubStore();
  const broadcast = jest.fn();
  const runner = new SessionRunner({ store, director: Director, broadcast });
  const { sessionId } = await runner.start({ userId: 1, goal: 'g' });
  await runner.waitForCompletion(sessionId);
  const final = store.persistCompleted.mock.calls[0][0];
  expect(final.status).toBe('errored');
  expect(final.errorReason).toMatch(/unknown tool/);
});

test('budget exhausted forces endSession', async () => {
  let i = 0;
  jest.spyOn(Director, 'step').mockImplementation(async () => ({
    tool: 'readA', args: {}, reasoning: `iter ${i++}`,
  }));
  const store = stubStore();
  const runner = new SessionRunner({ store, director: Director, broadcast: jest.fn() });
  const { sessionId } = await runner.start({ userId: 1, goal: 'g' });
  await runner.waitForCompletion(sessionId);
  const final = store.persistCompleted.mock.calls[0][0];
  expect(final.iteration).toBe(12);
  expect(final.status).toBe('completed');
  expect(final.trace.at(-1).kind).toBe('end');
  expect(final.trace.at(-1).payload.reason).toBe('budget-exhausted');
});

test('user cancel resolves pending surface and ends session', async () => {
  const decisions = [{ tool: 'surfaceA', args: {}, reasoning: 'show' }];
  jest.spyOn(Director, 'step').mockImplementation(async () => decisions.shift() || { tool: 'endSession', args: { reason: 'done' }, reasoning: '' });
  const store = stubStore();
  const runner = new SessionRunner({ store, director: Director, broadcast: jest.fn() });
  const { sessionId } = await runner.start({ userId: 1, goal: 'g' });
  setTimeout(() => runner.cancel(sessionId), 30);
  await runner.waitForCompletion(sessionId);
  const final = store.persistCompleted.mock.calls[0][0];
  expect(final.status).toBe('completed');
});

test('happy path: read → surface → soft-write → endSession', async () => {
  const decisions = [
    { tool: 'readA', args: {}, reasoning: 'gather' },
    { tool: 'surfaceA', args: { x: 1 }, reasoning: 'show' },
    { tool: 'writeA', args: { y: 2 }, reasoning: 'schedule' },
    { tool: 'endSession', args: { reason: 'done' }, reasoning: 'wrap' },
  ];
  jest.spyOn(Director, 'step').mockImplementation(async () => decisions.shift());

  const store = stubStore();
  const broadcast = jest.fn();
  const runner = new SessionRunner({ store, director: Director, broadcast });

  const { sessionId } = await runner.start({ userId: 1, goal: 'Test session' });

  // simulate user result before the surface step's awaitUserResult resolves
  setTimeout(() => runner.userResult(sessionId, { rating: 'easy', durationMs: 500 }), 50);

  await runner.waitForCompletion(sessionId);

  const completed = store.persistCompleted.mock.calls[0][0];
  expect(completed.status).toBe('completed');
  expect(completed.iteration).toBeGreaterThanOrEqual(3);
  const kinds = completed.trace.map(t => t.kind);
  expect(kinds).toContain('thought');
  expect(kinds).toContain('observation');
  expect(kinds).toContain('surface');
  expect(kinds).toContain('soft-write');
  expect(kinds).toContain('end');
});
