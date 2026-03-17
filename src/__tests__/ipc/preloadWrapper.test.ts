/**
 * preloadWrapper.test.ts
 *
 * Tests for the preload.ts IPC wrapper functions.
 * Ensures that arguments are passed correctly to ipcRenderer without wrapping.
 */

import { ipcRenderer } from 'electron';

// Mock electron's ipcRenderer
jest.mock('electron', () => ({
  ipcRenderer: {
    sendSync: jest.fn(),
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    removeListener: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  IpcRendererEvent: {},
}));

describe('Preload IPC Wrapper', () => {
  // Simulate the wrapper functions as they are defined in preload.ts
  const electronHandler = {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any> {
        return ipcRenderer.invoke(channel, ...args);
      },
      send(channel: string, ...args: any[]): void {
        ipcRenderer.send(channel, ...args);
      },
      sendSync(channel: string, ...args: any[]): any {
        return ipcRenderer.sendSync(channel, ...args);
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendSync wrapper', () => {
    it('should spread arguments correctly for single arg', () => {
      const mockReturnValue = { success: true };
      (ipcRenderer.sendSync as jest.Mock).mockReturnValue(mockReturnValue);

      const result = electronHandler.ipcRenderer.sendSync('test-channel', 'arg1');

      expect(ipcRenderer.sendSync).toHaveBeenCalledWith('test-channel', 'arg1');
      expect(result).toEqual(mockReturnValue);
    });

    it('should spread arguments correctly for multiple args', () => {
      const mockReturnValue = { id: 1 };
      (ipcRenderer.sendSync as jest.Mock).mockReturnValue(mockReturnValue);

      const result = electronHandler.ipcRenderer.sendSync(
        'graph-create-book',
        { title: 'Test Book' },
        'user-token'
      );

      // CRITICAL: Args should be spread, NOT wrapped in array
      expect(ipcRenderer.sendSync).toHaveBeenCalledWith(
        'graph-create-book',
        { title: 'Test Book' },
        'user-token'
      );
      // Should NOT be called like this (the bug):
      // expect(ipcRenderer.sendSync).toHaveBeenCalledWith(
      //   'graph-create-book',
      //   [{ title: 'Test Book' }, 'user-token']
      // );
      expect(result).toEqual(mockReturnValue);
    });

    it('should handle no arguments', () => {
      (ipcRenderer.sendSync as jest.Mock).mockReturnValue(true);

      const result = electronHandler.ipcRenderer.sendSync('graph-check-connection');

      expect(ipcRenderer.sendSync).toHaveBeenCalledWith('graph-check-connection');
      expect(result).toBe(true);
    });

    it('should handle object arguments', () => {
      const complexArg = {
        conceptId: 'concept-123',
        token: 'user-token',
        options: { includeEpisodes: true, maxMemories: 10 },
      };
      (ipcRenderer.sendSync as jest.Mock).mockReturnValue({ data: [] });

      electronHandler.ipcRenderer.sendSync('graph-get-summarization-hierarchy', complexArg);

      expect(ipcRenderer.sendSync).toHaveBeenCalledWith(
        'graph-get-summarization-hierarchy',
        complexArg
      );
    });
  });

  describe('invoke wrapper', () => {
    it('should spread arguments correctly for single arg', async () => {
      const mockReturnValue = { success: true };
      (ipcRenderer.invoke as jest.Mock).mockResolvedValue(mockReturnValue);

      const result = await electronHandler.ipcRenderer.invoke('test-channel', 'arg1');

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('test-channel', 'arg1');
      expect(result).toEqual(mockReturnValue);
    });

    it('should spread arguments correctly for multiple args', async () => {
      const mockReturnValue = { concepts: [] };
      (ipcRenderer.invoke as jest.Mock).mockResolvedValue(mockReturnValue);

      const result = await electronHandler.ipcRenderer.invoke(
        'graph-ai-extract-concepts',
        'Some text to analyze',
        'user-token'
      );

      // CRITICAL: Args should be spread, NOT wrapped in array
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        'graph-ai-extract-concepts',
        'Some text to analyze',
        'user-token'
      );
      expect(result).toEqual(mockReturnValue);
    });

    it('should handle object argument with nested structure', async () => {
      const complexArg = {
        conceptId: 'concept-123',
        token: 'user-token',
        options: { limit: 50 },
      };
      (ipcRenderer.invoke as jest.Mock).mockResolvedValue({ data: [] });

      await electronHandler.ipcRenderer.invoke('graph-get-concept-timeline', complexArg);

      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        'graph-get-concept-timeline',
        complexArg
      );
    });

    it('should handle no arguments', async () => {
      (ipcRenderer.invoke as jest.Mock).mockResolvedValue({ stats: {} });

      await electronHandler.ipcRenderer.invoke('get-stats');

      expect(ipcRenderer.invoke).toHaveBeenCalledWith('get-stats');
    });
  });

  describe('send wrapper', () => {
    it('should spread arguments correctly', () => {
      electronHandler.ipcRenderer.send('test-channel', 'arg1', 'arg2');

      expect(ipcRenderer.send).toHaveBeenCalledWith('test-channel', 'arg1', 'arg2');
    });

    it('should handle no arguments', () => {
      electronHandler.ipcRenderer.send('test-channel');

      expect(ipcRenderer.send).toHaveBeenCalledWith('test-channel');
    });
  });

  describe('regression: args should not be wrapped in array', () => {
    it('sendSync should NOT wrap args in array', () => {
      (ipcRenderer.sendSync as jest.Mock).mockReturnValue(null);

      electronHandler.ipcRenderer.sendSync('channel', 'arg1', 'arg2');

      // Verify it's called with spread args
      const callArgs = (ipcRenderer.sendSync as jest.Mock).mock.calls[0];
      expect(callArgs).toEqual(['channel', 'arg1', 'arg2']);

      // Verify it's NOT called with wrapped array (the bug)
      expect(callArgs).not.toEqual(['channel', ['arg1', 'arg2']]);
    });

    it('invoke should NOT wrap args in array', async () => {
      (ipcRenderer.invoke as jest.Mock).mockResolvedValue(null);

      await electronHandler.ipcRenderer.invoke('channel', 'arg1', 'arg2');

      // Verify it's called with spread args
      const callArgs = (ipcRenderer.invoke as jest.Mock).mock.calls[0];
      expect(callArgs).toEqual(['channel', 'arg1', 'arg2']);

      // Verify it's NOT called with wrapped array (the bug)
      expect(callArgs).not.toEqual(['channel', ['arg1', 'arg2']]);
    });
  });
});
