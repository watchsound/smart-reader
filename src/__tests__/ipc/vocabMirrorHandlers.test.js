/**
 * vocabMirrorHandlers — IPC layer that triggers a one-shot, idempotent
 * backfill of legacy vocabulary rows into learning_point. The renderer
 * calls this when the EPUB reading view mounts so the SRS halo always
 * sees the user's full saved vocab (not just rows added after the
 * dual-write landed).
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

const mockBackfill = jest.fn();
jest.mock('../../main/db/VocabularyManager', () => ({
  __esModule: true,
  backfillVocabularyToLearningPoints: mockBackfill,
}));

const mockGetUserIdFromToken = jest.fn();
jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {},
  getUserIdFromToken: mockGetUserIdFromToken,
}));

const {
  registerVocabMirrorHandlers,
} = require('../../main/ipc/vocabMirrorHandlers');

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockHandlers).forEach((k) => delete mockHandlers[k]);
});

describe('vocab-ensure-backfilled IPC', () => {
  it('runs backfill on first invocation for a user and returns the counts', async () => {
    mockGetUserIdFromToken.mockReturnValue(1);
    mockBackfill.mockResolvedValue({
      scanned: 50,
      created: 50,
      skipped: 0,
      errors: 0,
    });
    registerVocabMirrorHandlers(mockIpcMain);

    const result = await mockHandlers['vocab-ensure-backfilled'](
      {},
      'tok-user-1',
    );

    expect(mockBackfill).toHaveBeenCalledTimes(1);
    expect(mockBackfill).toHaveBeenCalledWith('tok-user-1');
    expect(result).toEqual({
      scanned: 50,
      created: 50,
      skipped: 0,
      errors: 0,
    });
  });

  it('idempotent per user-per-session — second invocation skips the backfill', async () => {
    // Once a user has been backfilled this session, calling again must be
    // a no-op. Without this, every chapter render would re-scan the entire
    // vocabulary table (50–5000 rows), running getBySource for each — a
    // measurable IPC tax on the reading hot path.
    mockGetUserIdFromToken.mockReturnValue(7);
    mockBackfill.mockResolvedValue({
      scanned: 5,
      created: 5,
      skipped: 0,
      errors: 0,
    });
    registerVocabMirrorHandlers(mockIpcMain);
    const handler = mockHandlers['vocab-ensure-backfilled'];

    await handler({}, 'tok-user-7');
    const second = await handler({}, 'tok-user-7');

    expect(mockBackfill).toHaveBeenCalledTimes(1);
    expect(second.cached).toBe(true);
  });

  it('does NOT cache for users with invalid sessions (so legitimate retry still works after login)', async () => {
    // Token expired or pre-login: getUserIdFromToken returns -1. We must
    // NOT mark "user -1 backfilled" — when they actually log in, we still
    // want the backfill to run for the real user.
    mockGetUserIdFromToken.mockReturnValue(-1);
    registerVocabMirrorHandlers(mockIpcMain);
    const handler = mockHandlers['vocab-ensure-backfilled'];

    const result = await handler({}, 'bad-token');
    expect(mockBackfill).not.toHaveBeenCalled();
    expect(result).toEqual({
      scanned: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    });

    // After login, getUserIdFromToken returns a real userId — backfill runs.
    mockGetUserIdFromToken.mockReturnValue(7);
    mockBackfill.mockResolvedValue({
      scanned: 1,
      created: 1,
      skipped: 0,
      errors: 0,
    });
    await handler({}, 'good-token');
    expect(mockBackfill).toHaveBeenCalledTimes(1);
  });
});
