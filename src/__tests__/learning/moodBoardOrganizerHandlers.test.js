/**
 * moodBoardOrganizerHandlers.test.js
 *
 * IPC contract tests for Phase 8 MoodBoard organize-loop handlers.
 * Pins the symmetric {ok, cleared} contract on clear-suggestion so a
 * future refactor can't reintroduce the conflation bug (where "no
 * record existed" was misreported as "operation failed").
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

// Stub the service so handler tests focus on contract translation,
// not service logic (which has its own dedicated test file).
const mockGetSuggestion = jest.fn();
const mockClearSuggestion = jest.fn();
jest.mock('../../main/brain/MoodBoardOrganizerService', () => {
  return jest.fn().mockImplementation(() => ({
    getSuggestion: mockGetSuggestion,
    clearSuggestion: mockClearSuggestion,
  }));
});

const { ipcMain } = require('electron');
const {
  registerMoodBoardOrganizerHandlers,
} = require('../../main/ipc/moodBoardOrganizerHandlers');

describe('moodBoardOrganizerHandlers', () => {
  const handlers = {};

  beforeAll(() => {
    ipcMain.handle.mockImplementation((channel, fn) => {
      handlers[channel] = fn;
    });
    registerMoodBoardOrganizerHandlers({});
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // moodboard-organizer-get-suggestion
  // ----------------------------------------------------------------------

  describe('moodboard-organizer-get-suggestion', () => {
    it('returns suggestion:null when dedupKey is missing', async () => {
      const res = await handlers['moodboard-organizer-get-suggestion']({}, {});
      expect(res).toEqual({ suggestion: null });
      expect(mockGetSuggestion).not.toHaveBeenCalled();
    });

    it('delegates to service and wraps the result', async () => {
      const fakeSuggestion = {
        dedupKey: '42:vocabulary',
        bookId: 42,
        bookTitle: 'The Word Lover',
        domainType: 'vocabulary',
        pointIds: ['lp_1', 'lp_2'],
        conceptTitles: ['serendipity', 'ephemeral'],
        pointCount: 2,
      };
      mockGetSuggestion.mockResolvedValue(fakeSuggestion);

      const res = await handlers['moodboard-organizer-get-suggestion'](
        {},
        { dedupKey: '42:vocabulary', token: 'tok' },
      );
      // The handler now passes the token through so the service can fetch
      // points from the graph backend.
      expect(mockGetSuggestion).toHaveBeenCalledWith(1, '42:vocabulary', 'tok');
      expect(res).toEqual({ suggestion: fakeSuggestion });
    });

    it('returns suggestion:null when service finds no record', async () => {
      mockGetSuggestion.mockResolvedValue(null);
      const res = await handlers['moodboard-organizer-get-suggestion'](
        {},
        { dedupKey: 'missing', token: 'tok' },
      );
      expect(res).toEqual({ suggestion: null });
    });
  });

  // ----------------------------------------------------------------------
  // moodboard-organizer-clear-suggestion
  // ----------------------------------------------------------------------

  describe('moodboard-organizer-clear-suggestion', () => {
    it('returns ok:false when bookId is missing', () => {
      const res = handlers['moodboard-organizer-clear-suggestion'](
        {},
        { domainType: 'vocabulary', token: 'tok' },
      );
      expect(res.ok).toBe(false);
      expect(mockClearSuggestion).not.toHaveBeenCalled();
    });

    it('returns ok:false when domainType is missing', () => {
      const res = handlers['moodboard-organizer-clear-suggestion'](
        {},
        { bookId: 42, token: 'tok' },
      );
      expect(res.ok).toBe(false);
      expect(mockClearSuggestion).not.toHaveBeenCalled();
    });

    it('clears the record and returns ok:true cleared:true', () => {
      mockClearSuggestion.mockReturnValue(true);
      const res = handlers['moodboard-organizer-clear-suggestion'](
        {},
        { bookId: 42, domainType: 'vocabulary', token: 'tok' },
      );
      expect(mockClearSuggestion).toHaveBeenCalledWith(1, 42, 'vocabulary');
      expect(res).toEqual({ ok: true, cleared: true });
    });

    it('returns ok:true cleared:false when no record existed (idempotent)', () => {
      // Regression guard: prior contract returned {ok: false} which
      // misreported a successful no-op as a failure. The Phase 8
      // organize banner's "Not now" button hits this path whenever the
      // user clicks dismiss after the dedup has already been cleared
      // (e.g. the brain heartbeat re-suggested in the meantime).
      mockClearSuggestion.mockReturnValue(false);
      const res = handlers['moodboard-organizer-clear-suggestion'](
        {},
        { bookId: 99, domainType: 'math', token: 'tok' },
      );
      expect(res).toEqual({ ok: true, cleared: false });
    });

    it('coerces bookId to Number before calling service', () => {
      // Defensive coercion: the renderer's main path (MoodBoardView)
      // passes bookId as a Number from organizeSuggestion.bookId, where
      // the service's getSuggestion already coerced it. But other
      // callers (tests, scripts, future code) might pass a string —
      // and the service's strict-equality dedup check would silently
      // miss every record. The handler must coerce regardless of
      // caller well-behavedness.
      mockClearSuggestion.mockReturnValue(true);
      handlers['moodboard-organizer-clear-suggestion'](
        {},
        { bookId: '42', domainType: 'vocabulary', token: 'tok' },
      );
      expect(mockClearSuggestion).toHaveBeenCalledWith(
        1,
        42, // number, not '42'
        'vocabulary',
      );
    });
  });
});
