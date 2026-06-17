/**
 * sessionApi.test.js — Test the renderer-side session API client.
 */

const fakeInvoke = jest.fn().mockResolvedValue({ sessionId: 'sess-1', traceId: 'tr-1' });
const fakeOn = jest.fn();
const fakeRemoveListener = jest.fn();

// sessionApi reads `window.electron.ipcRenderer` at module load. Set it
// up before requiring the module under test.
window.electron = {
  ipcRenderer: {
    invoke: fakeInvoke,
    on: fakeOn,
    removeListener: fakeRemoveListener,
  },
};

const sessionApi = require('../../renderer/api/sessionApi').default;

describe('sessionApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('invokes session:start with userId, questId, goal', async () => {
      const result = await sessionApi.start({ userId: 1, questId: 'q-1', goal: 'learn vocab' });
      expect(result.sessionId).toBe('sess-1');
      expect(result.traceId).toBe('tr-1');
      expect(fakeInvoke).toHaveBeenCalledWith('session:start', {
        userId: 1,
        questId: 'q-1',
        goal: 'learn vocab',
      });
    });
  });

  describe('userResult', () => {
    it('invokes session:userResult with sessionId and result', async () => {
      fakeInvoke.mockResolvedValueOnce({ ok: true });
      const result = await sessionApi.userResult('sess-1', { rating: 3, time: 45 });
      expect(result.ok).toBe(true);
      expect(fakeInvoke).toHaveBeenCalledWith('session:userResult', {
        sessionId: 'sess-1',
        result: { rating: 3, time: 45 },
      });
    });
  });

  describe('cancel', () => {
    it('invokes session:cancel with sessionId', async () => {
      fakeInvoke.mockResolvedValueOnce({ cancelled: true });
      const result = await sessionApi.cancel('sess-1');
      expect(result.cancelled).toBe(true);
      expect(fakeInvoke).toHaveBeenCalledWith('session:cancel', { sessionId: 'sess-1' });
    });
  });

  describe('get', () => {
    it('invokes session:get with sessionId', async () => {
      fakeInvoke.mockResolvedValueOnce({ sessionId: 'sess-1', status: 'active' });
      const result = await sessionApi.get('sess-1');
      expect(result.status).toBe('active');
      expect(fakeInvoke).toHaveBeenCalledWith('session:get', { sessionId: 'sess-1' });
    });
  });

  describe('loadActive', () => {
    it('invokes session:loadActive with no args', async () => {
      fakeInvoke.mockResolvedValueOnce({ sessionId: 'sess-2', status: 'paused' });
      const result = await sessionApi.loadActive();
      expect(result.status).toBe('paused');
      expect(fakeInvoke).toHaveBeenCalledWith('session:loadActive', {});
    });
  });

  describe('undoSoftWrite', () => {
    it('invokes session:undoSoftWrite with sessionId and softWriteId', async () => {
      fakeInvoke.mockResolvedValueOnce({ undone: true });
      const result = await sessionApi.undoSoftWrite('sess-1', 'sw-100');
      expect(result.undone).toBe(true);
      expect(fakeInvoke).toHaveBeenCalledWith('session:undoSoftWrite', {
        sessionId: 'sess-1',
        softWriteId: 'sw-100',
      });
    });
  });

  describe('listCompleted', () => {
    it('invokes session:listCompleted with userId and optional limit', async () => {
      fakeInvoke.mockResolvedValueOnce({ sessions: [] });
      const result = await sessionApi.listCompleted(5, 10);
      expect(result.sessions).toStrictEqual([]);
      expect(fakeInvoke).toHaveBeenCalledWith('session:listCompleted', {
        userId: 5,
        limit: 10,
      });
    });

    it('uses default limit of 20 when not provided', async () => {
      fakeInvoke.mockResolvedValueOnce({ sessions: [] });
      await sessionApi.listCompleted(5);
      expect(fakeInvoke).toHaveBeenCalledWith('session:listCompleted', {
        userId: 5,
        limit: 20,
      });
    });
  });

  describe('getTrace', () => {
    it('invokes session:getTrace with sessionId', async () => {
      fakeInvoke.mockResolvedValueOnce({ traceId: 'tr-1', events: [] });
      const result = await sessionApi.getTrace('sess-1');
      expect(result.traceId).toBe('tr-1');
      expect(fakeInvoke).toHaveBeenCalledWith('session:getTrace', { sessionId: 'sess-1' });
    });
  });

  describe('subscribeTrace', () => {
    it('registers listener for session-scoped channel', () => {
      const handler = jest.fn();
      sessionApi.subscribeTrace('sess-1', handler);
      expect(fakeOn).toHaveBeenCalledWith('session:sess-1:trace', expect.any(Function));
    });

    it('returns unsubscribe function that removes listener', () => {
      const handler = jest.fn();
      const unsubscribe = sessionApi.subscribeTrace('sess-1', handler);
      expect(typeof unsubscribe).toBe('function');

      // Get the listener function that was registered
      const registeredListener = fakeOn.mock.calls[0][1];
      unsubscribe();
      expect(fakeRemoveListener).toHaveBeenCalledWith('session:sess-1:trace', registeredListener);
    });

    it('calls handler with event data when trace event fires', () => {
      const handler = jest.fn();
      sessionApi.subscribeTrace('sess-1', handler);

      // Simulate IPC sending an event
      const registeredListener = fakeOn.mock.calls[0][1];
      const mockEvent = {};
      const mockData = { type: 'answer', value: 'test' };
      registeredListener(mockEvent, mockData);

      expect(handler).toHaveBeenCalledWith(mockData);
    });
  });
});
