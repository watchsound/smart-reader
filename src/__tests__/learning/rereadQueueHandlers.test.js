/**
 * rereadQueueHandlers.test.js
 *
 * IPC contract tests for Phase 8 spaced re-reading queue handlers.
 * Pins the four channel contracts including the symmetric {ok, dismissed}
 * shape on dismiss so a future refactor can't reintroduce the conflation
 * bug (where "no record existed" was misreported as "operation failed").
 */

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: { prepare: jest.fn() },
  getUserIdFromToken: jest.fn(() => 1),
}));

// Service is `export default` only — mock the constructor so handler
// tests can inspect method calls.
const mockSchedule = jest.fn();
const mockGetPending = jest.fn();
const mockComplete = jest.fn();
const mockDismiss = jest.fn();
jest.mock('../../main/utils/RereadQueueService', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    schedule: mockSchedule,
    getPending: mockGetPending,
    complete: mockComplete,
    dismiss: mockDismiss,
  })),
}));

const { ipcMain } = require('electron');
const {
  registerRereadQueueHandlers,
} = require('../../main/ipc/rereadQueueHandlers');

describe('rereadQueueHandlers', () => {
  const handlers = {};

  beforeAll(() => {
    ipcMain.handle.mockImplementation((channel, fn) => {
      handlers[channel] = fn;
    });
    registerRereadQueueHandlers({});
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // reread-queue-schedule
  // ----------------------------------------------------------------------

  describe('reread-queue-schedule', () => {
    it('passes payload through to service with normalized gaps/score', () => {
      mockSchedule.mockReturnValue({ id: 'rr_1', completedAt: null });
      const payload = {
        bookId: 1,
        bookTitle: 'Crime and Punishment',
        chapterId: 'ch_3',
        chapterName: 'The Confession',
        gaps: ['motive', 'doubling'],
        score: 35,
        token: 'tok',
      };
      const res = handlers['reread-queue-schedule']({}, payload);

      expect(mockSchedule).toHaveBeenCalledWith({
        bookId: 1,
        bookTitle: 'Crime and Punishment',
        chapterId: 'ch_3',
        chapterName: 'The Confession',
        gaps: ['motive', 'doubling'],
        score: 35,
        userId: 1,
      });
      expect(res).toEqual({ id: 'rr_1', completedAt: null });
    });

    it('coerces non-array gaps to empty array', () => {
      mockSchedule.mockReturnValue({ id: 'rr_1' });
      handlers['reread-queue-schedule'](
        {},
        {
          bookId: 1,
          chapterId: 'ch_1',
          gaps: 'not an array',
          score: 50,
          token: 'tok',
        },
      );
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ gaps: [] }),
      );
    });

    it('coerces non-number score to 0', () => {
      mockSchedule.mockReturnValue({ id: 'rr_1' });
      handlers['reread-queue-schedule'](
        {},
        {
          bookId: 1,
          chapterId: 'ch_1',
          gaps: [],
          score: 'not a number',
          token: 'tok',
        },
      );
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ score: 0 }),
      );
    });
  });

  // ----------------------------------------------------------------------
  // reread-queue-get
  // ----------------------------------------------------------------------

  describe('reread-queue-get', () => {
    it('returns pending items from service', () => {
      const items = [
        { id: 'rr_1', dueAt: '2026-06-15T00:00:00Z' },
        { id: 'rr_2', dueAt: '2026-06-14T00:00:00Z' },
      ];
      mockGetPending.mockReturnValue(items);
      const res = handlers['reread-queue-get']({}, { token: 'tok' });
      expect(mockGetPending).toHaveBeenCalledWith(1);
      expect(res).toEqual(items);
    });

    it('returns empty array when service throws (best-effort)', () => {
      mockGetPending.mockImplementation(() => {
        throw new Error('store unavailable');
      });
      const res = handlers['reread-queue-get']({}, { token: 'tok' });
      expect(res).toEqual([]);
    });
  });

  // ----------------------------------------------------------------------
  // reread-queue-complete
  // ----------------------------------------------------------------------

  describe('reread-queue-complete', () => {
    it('returns the updated item when complete succeeds', () => {
      const item = { id: 'rr_1', completedAt: '2026-06-14T10:00:00Z' };
      mockComplete.mockReturnValue(item);
      const res = handlers['reread-queue-complete']({}, { id: 'rr_1' });
      expect(mockComplete).toHaveBeenCalledWith('rr_1');
      expect(res).toEqual(item);
    });

    it('returns {error} when no such item', () => {
      mockComplete.mockReturnValue(null);
      const res = handlers['reread-queue-complete'](
        {},
        { id: 'missing' },
      );
      expect(res).toEqual({ error: 'Item not found.' });
    });
  });

  // ----------------------------------------------------------------------
  // reread-queue-dismiss
  // ----------------------------------------------------------------------

  describe('reread-queue-dismiss', () => {
    it('returns ok:false when id is missing', () => {
      const res = handlers['reread-queue-dismiss']({}, {});
      expect(res).toEqual({ ok: false });
      expect(mockDismiss).not.toHaveBeenCalled();
    });

    it('returns ok:true dismissed:true when an item was removed', () => {
      mockDismiss.mockReturnValue(true);
      const res = handlers['reread-queue-dismiss']({}, { id: 'rr_1' });
      expect(mockDismiss).toHaveBeenCalledWith('rr_1');
      expect(res).toEqual({ ok: true, dismissed: true });
    });

    it('returns ok:true dismissed:false when no item existed (idempotent)', () => {
      // Regression guard for the conflation bug: prior contract returned
      // {ok: false} which misreported a successful no-op as a failure.
      // Reachable in practice from the RereadQueuePanel via:
      //   1. Rapid double-click on Dismiss before the first await resolves
      //   2. Complete-then-Dismiss race on the same row before the panel's
      //      setItems removes it from local state
      // (No other code path mutates the queue — the brain heartbeat
      // doesn't touch it; only the panel calls dismiss.)
      mockDismiss.mockReturnValue(false);
      const res = handlers['reread-queue-dismiss'](
        {},
        { id: 'already-gone' },
      );
      expect(res).toEqual({ ok: true, dismissed: false });
    });
  });
});
