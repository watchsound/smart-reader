/**
 * argumentXrayHandlers — IPC for Argument Skeleton X-ray (#13).
 *
 * Renderer sends a paragraph; main process runs ArgumentXrayService
 * (cached) and returns {claims, evidence} arrays of verbatim phrases
 * that the renderer matches against source words.
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
}));

const mockAnalyze = jest.fn();
jest.mock('../../main/utils/ArgumentXrayService', () => ({
  __esModule: true,
  ArgumentXrayService: jest.fn().mockImplementation(() => ({
    analyze: mockAnalyze,
  })),
}));

const {
  registerArgumentXrayHandlers,
} = require('../../main/ipc/argumentXrayHandlers');

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockHandlers).forEach((k) => delete mockHandlers[k]);
});

describe('argument-xray-analyze IPC', () => {
  it('routes paragraph + token to ArgumentXrayService.analyze and returns the result', async () => {
    mockAnalyze.mockResolvedValue({
      claims: ['power corrupts'],
      evidence: ['Roman Republic'],
    });
    registerArgumentXrayHandlers(mockIpcMain);

    const result = await mockHandlers['argument-xray-analyze'](
      {},
      { paragraph: 'Power corrupts; see the Roman Republic.', token: 'tok' },
    );

    expect(mockAnalyze).toHaveBeenCalledWith(
      'Power corrupts; see the Roman Republic.',
      'tok',
    );
    expect(result).toEqual({
      claims: ['power corrupts'],
      evidence: ['Roman Republic'],
    });
  });

  it('returns {error} when paragraph is missing or empty (no LLM call)', async () => {
    // Defensive on the IPC boundary: a renderer bug that triggers
    // X-ray on an empty selection should NOT bill the LLM. The renderer
    // can catch the error or just no-op visually.
    registerArgumentXrayHandlers(mockIpcMain);

    const empty = await mockHandlers['argument-xray-analyze'](
      {},
      { paragraph: '   ', token: 'tok' },
    );
    const missing = await mockHandlers['argument-xray-analyze'](
      {},
      { token: 'tok' },
    );

    expect(mockAnalyze).not.toHaveBeenCalled();
    expect(empty.error).toBeTruthy();
    expect(missing.error).toBeTruthy();
  });
});
