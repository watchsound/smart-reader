// src/__tests__/spine/spineHandlers.test.js
const handlers = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel, fn) => handlers.set(channel, fn),
  },
}));

const mockMetered = jest.fn();
const mockMeteredJson = jest.fn();
jest.mock('../../main/brain/spine/meteredCall', () => (...args) => mockMetered(...args));
jest.mock('../../main/brain/spine/meteredCallJson', () => (...args) => mockMeteredJson(...args));

jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInMain: {
    currentProviderName: 'qwen-plus',
    currentProvider: { name: 'qwen-plus' },
  },
}));

const spineHandlers = require('../../main/ipc/spineHandlers');

beforeEach(() => {
  handlers.clear();
  mockMetered.mockReset();
  mockMeteredJson.mockReset();
  spineHandlers.register();
});

describe('spineHandlers', () => {
  test('text path routes through meteredCall', async () => {
    mockMetered.mockResolvedValue({ output: 'hello', callId: 1 });
    const fn = handlers.get('spine:meter');
    const res = await fn({}, { kind: 'text', label: 'x', prompt: 'say hi' });
    expect(res).toEqual({ output: 'hello', callId: 1 });
    expect(mockMetered).toHaveBeenCalled();
  });

  test('json path routes through meteredCallJson', async () => {
    mockMeteredJson.mockResolvedValue({ output: { foo: 1 }, callId: 2 });
    const fn = handlers.get('spine:meter');
    const schema = { type: 'object' };
    const res = await fn({}, { kind: 'json', label: 'y', prompt: 'p', schema });
    expect(res).toEqual({ output: { foo: 1 }, callId: 2 });
    expect(mockMeteredJson).toHaveBeenCalledWith('p', schema, { legacyLabel: 'y' });
  });

  test('returns error shape on dispatch failure', async () => {
    mockMetered.mockRejectedValue(new Error('boom'));
    const fn = handlers.get('spine:meter');
    const res = await fn({}, { kind: 'text', label: 'x', prompt: 'p' });
    expect(res.error).toBe('boom');
    expect(res.output).toBeNull();
  });
});
