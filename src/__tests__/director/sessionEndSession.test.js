// src/__tests__/director/sessionEndSession.test.js
const tools = require('../../main/brain/spine/tools');

// Reset tools before loading the tool
tools.__reset();

require('../../main/brain/director/tools/endSession');

describe('endSession control tool', () => {
  test('endSession registered with kind=control', () => {
    const desc = tools.descriptors().find(t => t.name === 'endSession');
    expect(desc).toBeDefined();
    expect(desc.kind).toBe('control');
  });

  test('endSession handler returns the reason', async () => {
    const result = await tools.invoke('endSession', { reason: 'goal-satisfied' });
    expect(result).toEqual({ reason: 'goal-satisfied' });
  });

  test('endSession with different reason', async () => {
    const result = await tools.invoke('endSession', { reason: 'no-useful-action' });
    expect(result).toEqual({ reason: 'no-useful-action' });
  });
});
