// src/__tests__/director/UndoRegistry.test.js
const UndoRegistry = require('../../main/brain/director/UndoRegistry');

beforeEach(() => UndoRegistry.__reset());

test('register + run reversal handler', async () => {
  const reverse = jest.fn().mockResolvedValue({ undone: true });
  UndoRegistry.register('myTool', reverse);
  const result = await UndoRegistry.run('myTool', { id: 42 });
  expect(reverse).toHaveBeenCalledWith({ id: 42 });
  expect(result).toEqual({ undone: true });
});

test('unknown tool returns undone:false', async () => {
  const result = await UndoRegistry.run('nonexistent', {});
  expect(result).toEqual({ undone: false, reason: 'no-handler' });
});

test('handler throwing returns undone:false with reason', async () => {
  UndoRegistry.register('boom', () => { throw new Error('busted'); });
  const result = await UndoRegistry.run('boom', {});
  expect(result.undone).toBe(false);
  expect(result.reason).toMatch(/busted/);
});
