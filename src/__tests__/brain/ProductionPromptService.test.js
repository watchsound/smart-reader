/**
 * ProductionPromptService Tests — Phase 8 production loop.
 *
 * Covers:
 *   - selectCandidates: graph filter, substantive-text check, dedup exclusion
 *   - schedulePrompt: notification creation, dedup recording, PROMPTED episode
 *   - clearPrompt: dedup removal
 *   - no-session no-op
 *
 * After the SQLite → graph migration: data comes from
 * learningPointService.getAll (mocked here) instead of `db.prepare`.
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/user/data') },
}));

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: { prepare: jest.fn() },
  getUserIdFromToken: jest.fn(() => 1),
}));

const mockCreateNotification = jest.fn(() => ({ id: 'notif_p_123' }));
jest.mock('../../main/db/NotificationManager', () => ({
  createNotification: (...args) => mockCreateNotification(...args),
  NOTIFICATION_TYPES: { PROGRESS: 'progress' },
  NOTIFICATION_PRIORITIES: { NORMAL: 'normal' },
}));

const mockGetAll = jest.fn(async () => ({ items: [] }));
jest.mock('../../main/utils/LearningPointService', () => ({
  __esModule: true,
  default: { getAll: (...args) => mockGetAll(...args) },
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

// Real-looking graph LearningPoint node: sourceType=book, sourceId stringified
// bookId, back as ALREADY-PARSED object (graph adapter parses JSON).
const goodCandidate = (overrides = {}) => ({
  id: 'lp_1',
  title: 'gradient descent',
  back: {
    text: 'An iterative optimization algorithm for finding a local minimum of a differentiable function.',
  },
  masteryLevel: 75,
  reviewCount: 5,
  lastReviewedAt: '2026-06-13T10:00:00Z',
  sourceType: 'book',
  sourceId: '1',
  domainType: 'math',
  ...overrides,
});

describe('ProductionPromptService', () => {
  let store;
  let episodeCollector;
  let svc;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAll.mockResolvedValue({ items: [] });
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
    it('returns the top eligible candidate', async () => {
      mockGetAll.mockResolvedValue({ items: [goodCandidate()] });
      const result = await svc.selectCandidates(1, 'tok', 1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lp_1');
      expect(result[0].bookId).toBe(1);
    });

    it('rejects candidates whose back.text is too short', async () => {
      mockGetAll.mockResolvedValue({
        items: [goodCandidate({ back: { text: 'short.' } })],
      });
      expect(await svc.selectCandidates(1, 'tok', 1)).toEqual([]);
    });

    it('rejects candidates with no back text at all', async () => {
      mockGetAll.mockResolvedValue({
        items: [goodCandidate({ back: {} })],
      });
      expect(await svc.selectCandidates(1, 'tok', 1)).toEqual([]);
    });

    it('rejects candidates below mastery floor', async () => {
      mockGetAll.mockResolvedValue({
        items: [goodCandidate({ masteryLevel: 40 })],
      });
      expect(await svc.selectCandidates(1, 'tok', 1)).toEqual([]);
    });

    it('rejects candidates below review-count floor', async () => {
      mockGetAll.mockResolvedValue({
        items: [goodCandidate({ reviewCount: 1 })],
      });
      expect(await svc.selectCandidates(1, 'tok', 1)).toEqual([]);
    });

    it('rejects candidates with disallowed sourceType', async () => {
      mockGetAll.mockResolvedValue({
        items: [goodCandidate({ sourceType: 'manual' })],
      });
      expect(await svc.selectCandidates(1, 'tok', 1)).toEqual([]);
    });

    it('skips a candidate whose dedup record is within the dedup window', async () => {
      store.set('productionLoop.recentPrompts', {
        1: {
          lp_1: {
            promptedAt: new Date().toISOString(),
            masteryAtPrompt: 75,
          },
        },
      });
      mockGetAll.mockResolvedValue({ items: [goodCandidate()] });
      expect(await svc.selectCandidates(1, 'tok', 1)).toEqual([]);
    });

    it('re-includes a candidate whose dedup record is older than the window', async () => {
      const oldDate = new Date(Date.now() - 30 * 86400000).toISOString();
      store.set('productionLoop.recentPrompts', {
        1: { lp_1: { promptedAt: oldDate, masteryAtPrompt: 60 } },
      });
      mockGetAll.mockResolvedValue({ items: [goodCandidate()] });
      expect(await svc.selectCandidates(1, 'tok', 1)).toHaveLength(1);
    });

    it('caps at the requested limit', async () => {
      mockGetAll.mockResolvedValue({
        items: [
          goodCandidate({ id: 'lp_1' }),
          goodCandidate({ id: 'lp_2' }),
          goodCandidate({ id: 'lp_3' }),
        ],
      });
      expect(await svc.selectCandidates(1, 'tok', 1)).toHaveLength(1);
      expect(await svc.selectCandidates(1, 'tok', 2)).toHaveLength(2);
    });

    it('sorts by mastery DESC then lastReviewedAt DESC', async () => {
      mockGetAll.mockResolvedValue({
        items: [
          goodCandidate({
            id: 'older',
            masteryLevel: 75,
            lastReviewedAt: '2025-01-01T00:00:00Z',
          }),
          goodCandidate({
            id: 'higher',
            masteryLevel: 90,
            lastReviewedAt: '2024-01-01T00:00:00Z',
          }),
          goodCandidate({
            id: 'newer',
            masteryLevel: 75,
            lastReviewedAt: '2026-01-01T00:00:00Z',
          }),
        ],
      });
      const result = await svc.selectCandidates(1, 'tok', 3);
      expect(result.map((r) => r.id)).toEqual(['higher', 'newer', 'older']);
    });
  });

  // ----------------------------------------------------------------------
  // schedulePrompt
  // ----------------------------------------------------------------------

  describe('schedulePrompt', () => {
    it('no-ops when no session is signed in', async () => {
      global.shared = { store: { get: jest.fn(() => null) } };
      const result = await svc.schedulePrompt(1, null);
      expect(result.reason).toBe('no session');
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.candidates).toEqual([]);
      expect(episodeCollector.record).not.toHaveBeenCalled();
    });

    it('no-ops with reason "no candidates" when nothing eligible', async () => {
      mockGetAll.mockResolvedValue({ items: [] });
      const result = await svc.schedulePrompt(1, 'tok');
      expect(result.created).toBe(0);
      expect(result.reason).toBe('no candidates');
    });

    it('creates a notification with the right actionUrl shape', async () => {
      mockGetAll.mockResolvedValue({ items: [goodCandidate()] });
      const result = await svc.schedulePrompt(1, 'tok');

      expect(result.created).toBe(1);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      const [payload, effectiveToken] = mockCreateNotification.mock.calls[0];
      expect(payload.actionUrl).toBe('/knowledge?produce=lp_1');
      expect(payload.title).toContain('gradient descent');
      expect(effectiveToken).toBe('real-token');
    });

    it('records dedup with masteryAtPrompt for analytics later', async () => {
      mockGetAll.mockResolvedValue({ items: [goodCandidate()] });
      await svc.schedulePrompt(1, 'tok');
      const dedup = store._raw['productionLoop.recentPrompts'];
      expect(dedup[1].lp_1).toMatchObject({
        notificationId: 'notif_p_123',
        masteryAtPrompt: 75,
      });
      expect(dedup[1].lp_1.promptedAt).toBeTruthy();
    });

    it('emits a PRODUCTION_PROMPTED episode for analytics', async () => {
      mockGetAll.mockResolvedValue({ items: [goodCandidate()] });
      await svc.schedulePrompt(1, 'tok');
      expect(episodeCollector.record).toHaveBeenCalledTimes(1);
      const event = episodeCollector.record.mock.calls[0][0];
      expect(event.eventType).toBe('PRODUCTION_PROMPTED');
      expect(event.userId).toBe(1);
      expect(event.payload.learningPointId).toBe('lp_1');
      expect(event.payload.masteryLevel).toBe(75);
      expect(event.payload.notificationId).toBe('notif_p_123');
    });

    it('survives a missing episodeCollector (best-effort)', async () => {
      svc = new ProductionPromptService({ store });
      mockGetAll.mockResolvedValue({ items: [goodCandidate()] });
      const result = await svc.schedulePrompt(1, 'tok');
      expect(result.created).toBe(1);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    });

    it('skips dedup entry on createNotification failure', async () => {
      mockGetAll.mockResolvedValue({ items: [goodCandidate()] });
      mockCreateNotification.mockImplementation(() => {
        throw new Error('db down');
      });
      const result = await svc.schedulePrompt(1, 'tok');
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
