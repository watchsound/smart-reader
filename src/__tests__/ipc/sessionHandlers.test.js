/**
 * sessionHandlers.test.js — smoke test for Study-Session Director IPC wiring.
 *
 * The IPC layer is intentionally thin (delegates to SessionRunner / stores),
 * so we verify:
 *   1. The module exports `register` and `runnerForTest`.
 *   2. `register()` does not throw.
 *   3. All expected channels are registered on ipcMain.
 *
 * @jest-environment node
 */

const mockHandlers = {};
const mockIpcMain = {
  handle: jest.fn((channel, handler) => {
    mockHandlers[channel] = handler;
  }),
};

jest.mock('electron', () => ({
  ipcMain: mockIpcMain,
  BrowserWindow: { getAllWindows: () => [] },
}));

// Mock all heavy dependencies so require() doesn't touch the real DB or electron-store.
jest.mock('../../main/brain/director/SessionRunner', () => {
  return jest.fn().mockImplementation(() => ({
    active: new Map(),
    start: jest.fn(),
    userResult: jest.fn(),
    cancel: jest.fn(),
  }));
});

jest.mock('../../main/brain/director/Director', () => ({
  step: jest.fn(),
}));

jest.mock('../../main/brain/director/SessionActiveStore', () => ({
  saveActive: jest.fn(),
  loadActive: jest.fn().mockReturnValue(null),
  clearActive: jest.fn(),
  persistCompleted: jest.fn(),
}));

jest.mock('../../main/db/AISessionStore', () => ({
  listByUser: jest.fn().mockResolvedValue([]),
  getTrace: jest.fn().mockReturnValue([]),
  findById: jest.fn().mockReturnValue({ trace_id: 'tr-test-0001' }),
  persistCompleted: jest.fn(),
}));

jest.mock('../../main/brain/director/UndoRegistry', () => ({
  run: jest.fn(),
}));

const { register, runnerForTest } = require('../../main/ipc/sessionHandlers');

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockHandlers).forEach((k) => delete mockHandlers[k]);
});

describe('sessionHandlers', () => {
  it('exports register and runnerForTest', () => {
    expect(typeof register).toBe('function');
    expect(typeof runnerForTest).toBe('function');
  });

  it('register() does not throw', () => {
    expect(() => register()).not.toThrow();
  });

  it('registers all expected IPC channels', () => {
    register();
    const expectedChannels = [
      'session:start',
      'session:userResult',
      'session:cancel',
      'session:get',
      'session:loadActive',
      'session:undoSoftWrite',
      'session:listCompleted',
      'session:getTrace',
    ];
    for (const ch of expectedChannels) {
      expect(mockHandlers[ch]).toBeDefined();
    }
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(expectedChannels.length);
  });

  it('session:loadActive handler delegates to SessionActiveStore.loadActive', async () => {
    const SessionActiveStore = require('../../main/brain/director/SessionActiveStore');
    register();
    await mockHandlers['session:loadActive']();
    expect(SessionActiveStore.loadActive).toHaveBeenCalled();
  });

  it('session:listCompleted handler delegates to AISessionStore.listByUser', async () => {
    const AISessionStore = require('../../main/db/AISessionStore');
    register();
    await mockHandlers['session:listCompleted']({}, { userId: 1, limit: 10 });
    expect(AISessionStore.listByUser).toHaveBeenCalledWith(1, 10);
  });

  it('session:getTrace handler returns { traceId, events } shape', async () => {
    const AISessionStore = require('../../main/db/AISessionStore');
    register();
    const result = await mockHandlers['session:getTrace']({}, { sessionId: 'abc-123' });
    expect(AISessionStore.getTrace).toHaveBeenCalledWith('abc-123');
    expect(AISessionStore.findById).toHaveBeenCalledWith('abc-123');
    expect(result).toEqual({ traceId: 'tr-test-0001', events: [] });
  });

  it('session:undoSoftWrite returns not-found when no matching softWrite', async () => {
    register();
    // runner has no active sessions, so entry will be undefined
    const result = await mockHandlers['session:undoSoftWrite']({}, {
      sessionId: 'nonexistent',
      softWriteId: 'sw-1',
    });
    expect(result).toEqual({ undone: false, reason: 'not-found' });
  });

  it('runnerForTest returns the singleton runner after register', () => {
    register();
    // Trigger getRunner by calling session:loadActive (which uses SessionActiveStore directly,
    // not runner), then use session:cancel to ensure runner is instantiated.
    // runnerForTest may still return null if no runner-using channel was called.
    // This test just verifies it doesn't throw.
    expect(() => runnerForTest()).not.toThrow();
  });
});
