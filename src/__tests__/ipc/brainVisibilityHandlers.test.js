/**
 * src/__tests__/ipc/brainVisibilityHandlers.test.js
 * Test suite for Phase 11 brainVisibilityHandlers IPC registration
 */

const { EventEmitter } = require('events');

// Mock ipcMain before requiring handlers
const ipcMain = new EventEmitter();
ipcMain.handle = function (channel, fn) {
  this.on(channel, async (e, ...args) => {
    const result = await fn(e, ...args);
    e.reply?.(channel, result);
  });
};

jest.mock('electron', () => ({ ipcMain }));

// Mock BrainVisibilityService
jest.mock('../../main/utils/BrainVisibilityService', () => ({
  getDashboard: jest.fn().mockResolvedValue({
    mastery: [],
    timeline: [],
    sessions: [],
    topConcepts: [],
  }),
  getConcept: jest.fn().mockResolvedValue({
    meta: { id: 1 },
    lineage: [],
    costToDate: 0,
    boxOverTime: null,
  }),
}));

const { register } = require('../../main/ipc/brainVisibilityHandlers');

describe('brainVisibilityHandlers', () => {
  beforeEach(() => {
    ipcMain.removeAllListeners();
  });

  it('registers brainVisibility:dashboard channel', () => {
    register();
    expect(ipcMain.listenerCount('brainVisibility:dashboard')).toBeGreaterThan(0);
  });

  it('registers brainVisibility:concept channel', () => {
    register();
    expect(ipcMain.listenerCount('brainVisibility:concept')).toBeGreaterThan(0);
  });

  it('both channels are registered after register() call', () => {
    register();
    const dashboardCount = ipcMain.listenerCount('brainVisibility:dashboard');
    const conceptCount = ipcMain.listenerCount('brainVisibility:concept');
    expect(dashboardCount).toBeGreaterThan(0);
    expect(conceptCount).toBeGreaterThan(0);
  });
});
