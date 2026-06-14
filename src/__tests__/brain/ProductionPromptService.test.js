/**
 * ProductionPromptService Tests — Phase 8 production loop.
 *
 * Covers:
 *   - selectCandidates: SQL filter, substantive-text check, dedup exclusion
 *   - schedulePrompt: notification creation, dedup recording, PROMPTED episode
 *   - clearPrompt: dedup removal
 *   - no-session no-op
 */

const {
  describe,
  it,
  expect,
  beforeEach,
} = require('@jest/globals');

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/user/data') },
}));

const mockCandidateStmt = { all: jest.fn(() => []) };

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(() => mockCandidateStmt),
  },
  getUserIdFromToken: jest.fn(() => 1),
}));

const mockCreateNotification = jest.fn(() => ({ id: 'notif_p_123' }));
jest.mock('../../main/db/NotificationManager', () => ({
  createNotification: (...args) => mockCreateNotification(...args),
  NOTIFICATION_TYPES: { PROGRESS: 'progress' },
  NOTIFICATION_PRIORITIES: { NORMAL: 'normal' },
}));

const ProductionPromptService = require('../../main/brain/ProductionPromptService');

const makeStore = () => {
  const data = {};
  return {
    get: jest.fn((key, fallback) =>
      data[key] === undefined ? fallback : data[key],
    ),
    set: jest.fn((key, value) => {
      data[key] = value;
    }),
    _raw: data,
  };
};

// Real-looking learning_point row: mastery 75, 5 reviews, book-sourced, with
// substantive back.text. This is the "good candidate" baseline that gets
// mutated in individual tests.
const goodCandidate = (overrides = {}) => ({
  id: 'lp_1',
  title: 'gradient descent',
  back: JSON.stringify({
    text: 'An iterative optimization algorithm for finding a local minimum of a differentiable function.',
  }),
  masteryLevel: 75,
  reviewCount: 5,
  lastReviewedAt: '2026-06-13T10:00:00Z',
  sourceType: 'book',
  bookId: 1,
  domainType: 'math',
  ...overrides,
});

describe('ProductionPromptService', () => {
  let store;
  let episodeCollector;
  let svc;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCandidateStmt.all.mockReturnValue([]);
    mockCreateNotification.mockReturnValue({ id: 'notif_p_123' });

    global.shared = {
      store: { get: jest.fn(() => ({ token: 'real-token', id: 1 })) },
    };

    store = makeStore();
    episodeCollector = { record: jest.fn() };
    svc = new ProductionPromptService({ store, episodeCollector });
  });

  // ----------------------------------------------------------------------
  // selectCandidates
  // ----------------------------------------------------------------------

  describe('selectCandidates', () => {
    it('returns the top eligible candidate', () => {
      mockCandidateStmt.all.mockReturnValue([goodCandidate()]);
      const result = svc.selectCandidates(1, 1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lp_1');
    });

    it('rejects candidates whose back.text is too short', () => {
      mockCandidateStmt.all.mockReturnValue([
        goodCandidate({ back: JSON.stringify({ text: 'short.' }) }),
      ]);
      expect(svc.selectCandidates(1, 1)).toEqual([]);
    });

    it('rejects candidates with no back text at all', () => {
      mockCandidateStmt.all.mockReturnValue([
        goodCandidate({ back: JSON.stringify({}) }),
      ]);
      expect(svc.selectCandidates(1, 1)).toEqual([]);
    });

    it('tolerates non-JSON back strings of sufficient length', () => {
      // Plain-string back (no JSON wrapper) >= 30 chars passes the length check.
      mockCandidateStmt.all.mockReturnValue([
        goodCandidate({
          back: 'a stringified plain text of more than thirty characters long',
        }),
      ]);
      expect(svc.selectCandidates(1, 1)).toHaveLength(1);
    });

    it('skips a candidate whose dedup record is within the dedup window', () => {
      // Seed a fresh dedup record (today).
      store.set('productionLoop.recentPrompts', {
        1: {
          lp_1: {
            promptedAt: new Date().toISOString(),
            masteryAtPrompt: 75,
          },
        },
      });
      mockCandidateStmt.all.mockReturnValue([goodCandidate()]);
      expect(svc.selectCandidates(1, 1)).toEqual([]);
    });

    it('re-includes a candidate whose dedup record is older than the window', () => {
      // 30 days ago is past PRODUCTION_DEDUP_DAYS (21).
      const oldDate = new Date(
        Date.now() - 30 * 86400000,
      ).toISOString();
      store.set('productionLoop.recentPrompts', {
        1: { lp_1: { promptedAt: oldDate, masteryAtPrompt: 60 } },
      });
      mockCandidateStmt.all.mockReturnValue([goodCandidate()]);
      expect(svc.selectCandidates(1, 1)).toHaveLength(1);
    });

    it('caps at the requested limit', () => {
      mockCandidateStmt.all.mockReturnValue([
        goodCandidate({ id: 'lp_1' }),
        goodCandidate({ id: 'lp_2' }),
        goodCandidate({ id: 'lp_3' }),
      ]);
      expect(svc.selectCandidates(1, 1)).toHaveLength(1);
      expect(svc.selectCandidates(1, 2)).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------------------
  // schedulePrompt
  // ----------------------------------------------------------------------

  describe('schedulePrompt', () => {
    it('no-ops when no session is signed in', () => {
      global.shared = { store: { get: jest.fn(() => null) } };
      const result = svc.schedulePrompt(1, null);
      expect(result.reason).toBe('no session');
      expect(mockCreateNotification).not.toHaveBeenCalled();
      // Pin zero-state shape: a future refactor that runs candidate
      // selection or episode emission before the session gate would
      // silently leak data and the reason-only assertion would still pass.
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.candidates).toEqual([]);
      expect(episodeCollector.record).not.toHaveBeenCalled();
    });

    it('no-ops with reason "no candidates" when nothing eligible', () => {
      mockCandidateStmt.all.mockReturnValue([]);
      const result = svc.schedulePrompt(1, 'tok');
      expect(result.created).toBe(0);
      expect(result.reason).toBe('no candidates');
    });

    it('creates a notification with the right actionUrl shape', () => {
      mockCandidateStmt.all.mockReturnValue([goodCandidate()]);
      const result = svc.schedulePrompt(1, 'tok');

      expect(result.created).toBe(1);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      const [payload, effectiveToken] = mockCreateNotification.mock.calls[0];
      expect(payload.actionUrl).toBe('/knowledge?produce=lp_1');
      expect(payload.title).toContain('gradient descent');
      expect(effectiveToken).toBe('real-token');
    });

    it('records dedup with masteryAtPrompt for analytics later', () => {
      mockCandidateStmt.all.mockReturnValue([goodCandidate()]);
      svc.schedulePrompt(1, 'tok');
      const dedup = store._raw['productionLoop.recentPrompts'];
      expect(dedup[1].lp_1).toMatchObject({
        notificationId: 'notif_p_123',
        masteryAtPrompt: 75,
      });
      expect(dedup[1].lp_1.promptedAt).toBeTruthy();
    });

    it('emits a PRODUCTION_PROMPTED episode for analytics', () => {
      mockCandidateStmt.all.mockReturnValue([goodCandidate()]);
      svc.schedulePrompt(1, 'tok');
      expect(episodeCollector.record).toHaveBeenCalledTimes(1);
      const event = episodeCollector.record.mock.calls[0][0];
      expect(event.eventType).toBe('PRODUCTION_PROMPTED');
      expect(event.userId).toBe(1);
      expect(event.payload.learningPointId).toBe('lp_1');
      expect(event.payload.masteryLevel).toBe(75);
      expect(event.payload.notificationId).toBe('notif_p_123');
    });

    it('survives a missing episodeCollector (best-effort)', () => {
      svc = new ProductionPromptService({ store }); // no episodeCollector
      mockCandidateStmt.all.mockReturnValue([goodCandidate()]);
      const result = svc.schedulePrompt(1, 'tok');
      expect(result.created).toBe(1);
      // No throw, notification still created.
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    });

    it('skips dedup entry on createNotification failure', () => {
      mockCandidateStmt.all.mockReturnValue([goodCandidate()]);
      mockCreateNotification.mockImplementation(() => {
        throw new Error('db down');
      });
      const result = svc.schedulePrompt(1, 'tok');
      expect(result.created).toBe(0);
      const dedup = store._raw['productionLoop.recentPrompts'] || {};
      expect(dedup[1]?.lp_1).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------------
  // clearPrompt
  // ----------------------------------------------------------------------

  describe('clearPrompt', () => {
    it('returns true and removes the record when it exists', () => {
      store.set('productionLoop.recentPrompts', {
        1: { lp_1: { promptedAt: 'x' } },
      });
      expect(svc.clearPrompt(1, 'lp_1')).toBe(true);
      const dedup = store._raw['productionLoop.recentPrompts'];
      expect(dedup[1].lp_1).toBeUndefined();
    });

    it('returns false when no such record exists', () => {
      expect(svc.clearPrompt(1, 'lp_missing')).toBe(false);
    });
  });
});
