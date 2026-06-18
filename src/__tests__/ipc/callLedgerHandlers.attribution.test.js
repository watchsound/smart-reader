/**
 * callLedgerHandlers.attribution.test.js
 *
 * Verifies that registerCallLedgerHandlers registers the 3 Phase 13
 * attribution IPC channels alongside the existing cost-query channels.
 */

// ── electron mock ─────────────────────────────────────────────────────────────
const mockHandlers = {};
const mockIpcMain = {
  handle: jest.fn((channel, fn) => {
    mockHandlers[channel] = fn;
  }),
};
jest.mock('electron', () => ({ ipcMain: mockIpcMain }));

// ── CallLedgerStore mock (covers existing channels) ───────────────────────────
jest.mock('../../main/db/CallLedgerStore', () => ({
  findByTriggerId: jest.fn(),
  aggregateByIntent: jest.fn(),
  aggregateByProvider: jest.fn(),
  cacheHitRateByIntent: jest.fn().mockReturnValue(new Map()),
  tracesByCallId: jest.fn(),
  aggregateByTraceId: jest.fn(),
  listSessionTraces: jest.fn(),
}));

// ── AttributionService mock ───────────────────────────────────────────────────
jest.mock('../../main/utils/AttributionService', () => {
  return jest.fn().mockImplementation(() => ({
    getBars: jest.fn().mockResolvedValue([]),
    getGroupDetail: jest.fn().mockResolvedValue({}),
    getDensityStrip: jest.fn().mockResolvedValue([]),
  }));
});

const { registerCallLedgerHandlers } = require('../../main/ipc/callLedgerHandlers');

it('registers 3 attribution channels on callLedgerHandlers', () => {
  const channels = [];
  const ipcMain = { handle: (ch) => channels.push(ch) };
  registerCallLedgerHandlers(ipcMain);
  expect(channels).toEqual(expect.arrayContaining([
    'callLedger:attributionBars',
    'callLedger:attributionGroupDetail',
    'callLedger:attributionDensityStrip',
  ]));
});
