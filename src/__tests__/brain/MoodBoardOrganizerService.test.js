/**
 * MoodBoardOrganizerService Tests — Phase 8 organize loop.
 *
 * Covers:
 *   - cluster detection (groups by bookId + domainType) from the graph backend
 *   - dedup logic (same cluster doesn't re-notify)
 *   - no-session no-op
 *   - clearSuggestion / getSuggestion
 *   - createBoardFromCluster (slice 3) builds notes + board from graph data
 *
 * After the SQLite → graph migration, learning-point reads go through
 * learningPointService.getAll (mocked). SQLite is still used for the
 * `book` name lookup and for the slice-3 note/board creation transaction.
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/user/data') },
}));

// SQLite mocks: only the book-name lookup and the transaction wrapper
// are still used; the learning-point reads moved to learningPointService.
const mockBookStmt = { get: jest.fn(() => null) };
jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn((sql) => {
      if (sql.includes('FROM book')) return mockBookStmt;
      // Fallback no-op for any stray SQL the service may add later —
      // returning a stub keeps `.all()` / `.get()` from throwing.
      return { all: () => [], get: () => null };
    }),
    transaction: jest.fn((fn) => () => fn()),
  },
  getUserIdFromToken: jest.fn(() => 1),
}));

const mockCreateNotification = jest.fn(() => ({ id: 'notif_123' }));
jest.mock('../../main/db/NotificationManager', () => ({
  createNotification: (...args) => mockCreateNotification(...args),
  NOTIFICATION_TYPES: { PROGRESS: 'progress', SYSTEM: 'system' },
  NOTIFICATION_PRIORITIES: { NORMAL: 'normal', HIGH: 'high' },
}));

const mockCreateNote = jest.fn();
jest.mock('../../main/db/NoteJsonManager', () => ({
  createNote: (...args) => mockCreateNote(...args),
}));

const mockCreateMoodBoard = jest.fn();
jest.mock('../../main/db/MoodBoardJsonManager', () => ({
  createMoodBoard: (...args) => mockCreateMoodBoard(...args),
}));

const mockGetAll = jest.fn(async () => ({ items: [] }));
jest.mock('../../main/utils/LearningPointService', () => ({
  __esModule: true,
  default: { getAll: (...args) => mockGetAll(...args) },
}));

const MoodBoardOrganizerService = require('../../main/brain/MoodBoardOrganizerService');

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

// Recent-window timestamp (within last 7 days).
const RECENT_ISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

// Make a graph-shaped LearningPoint with sourceType='book', sourceId as
// stringified bookId. `back` is already a parsed object (matches the
// graph adapter's _parseLearningPointNode output).
const seedPoint = (overrides = {}) => ({
  id: 'lp_1',
  title: 'serendipity',
  front: 'meaning?',
  back: { text: 'a happy accident' },
  domainType: 'vocabulary',
  sourceType: 'book',
  sourceId: '42',
  createdAt: RECENT_ISO,
  ...overrides,
});

const SAMPLE_POINTS = [
  seedPoint({ id: 'lp_1', title: 'serendipity' }),
  seedPoint({ id: 'lp_2', title: 'ephemeral' }),
  seedPoint({ id: 'lp_3', title: 'ineffable' }),
  seedPoint({ id: 'lp_4', title: 'sonder' }),
  seedPoint({ id: 'lp_5', title: 'meraki' }),
  seedPoint({ id: 'lp_6', title: 'kalon' }),
];

describe('MoodBoardOrganizerService', () => {
  let store;
  let service;
  let episodeCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBookStmt.get.mockReturnValue(null);
    mockCreateNotification.mockReturnValue({ id: 'notif_123' });
    mockCreateNote.mockReset();
    mockCreateMoodBoard.mockReset();
    mockGetAll.mockResolvedValue({ items: [] });

    global.shared = {
      store: { get: jest.fn(() => ({ token: 'real-token', id: 1 })) },
    };

    store = makeStore();
    episodeCollector = { record: jest.fn() };
    service = new MoodBoardOrganizerService({ store, episodeCollector });
  });

  describe('detectClusters', () => {
    it('returns empty when no points are in the recent window', async () => {
      mockGetAll.mockResolvedValue({ items: [] });
      const result = await service.detectClusters(1, 'tok');
      expect(result).toEqual([]);
    });

    it('groups by (bookId, domainType) and keeps groups ≥ minClusterSize', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_POINTS });
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      const [cluster] = await service.detectClusters(1, 'tok');

      expect(cluster.bookId).toBe(42);
      expect(cluster.bookTitle).toBe('The Word Lover');
      expect(cluster.domainType).toBe('vocabulary');
      expect(cluster.pointCount).toBe(6);
      expect(cluster.pointIds.sort()).toEqual(
        ['lp_1', 'lp_2', 'lp_3', 'lp_4', 'lp_5', 'lp_6'].sort(),
      );
      // Preview is capped at MAX_TITLES_PREVIEW (3).
      expect(cluster.conceptTitles).toHaveLength(3);
    });

    it('drops groups smaller than minClusterSize', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_POINTS.slice(0, 3) });
      const result = await service.detectClusters(1, 'tok');
      expect(result).toEqual([]);
    });

    it('drops points older than the window', async () => {
      const oldIso = new Date(Date.now() - 30 * 86400000).toISOString();
      const old = SAMPLE_POINTS.map((p) => ({ ...p, createdAt: oldIso }));
      mockGetAll.mockResolvedValue({ items: old });
      const result = await service.detectClusters(1, 'tok');
      expect(result).toEqual([]);
    });

    it('falls back to "Book #ID" when the book row is missing', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_POINTS });
      mockBookStmt.get.mockReturnValue(null);

      const [cluster] = await service.detectClusters(1, 'tok');
      expect(cluster.bookTitle).toBe('Book #42');
    });
  });

  describe('suggestOrganize', () => {
    it('no-ops when no session is signed in', async () => {
      global.shared = { store: { get: jest.fn(() => null) } };
      const result = await service.suggestOrganize(1, null);
      expect(result.reason).toBe('no session');
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.clusters).toEqual([]);
    });

    it('no-ops when no clusters are detected', async () => {
      mockGetAll.mockResolvedValue({ items: [] });
      const result = await service.suggestOrganize(1, 'tok');
      expect(result.created).toBe(0);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('creates a notification and records dedup on first sight', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_POINTS });
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      const result = await service.suggestOrganize(1, 'tok');

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      const [payload, effectiveToken] = mockCreateNotification.mock.calls[0];
      expect(payload.actionUrl).toBe('/moodBoard?organize=42%3Avocabulary');
      expect(payload.title).toContain('6 new vocabulary');
      expect(effectiveToken).toBe('real-token');
      expect(store._raw['moodBoard.organizeSuggestions']).toMatchObject({
        1: {
          '42:vocabulary': expect.objectContaining({
            notificationId: 'notif_123',
            pointCount: 6,
          }),
        },
      });
    });

    it('skips the cluster on a second pass (dedup)', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_POINTS });
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      await service.suggestOrganize(1, 'tok');
      mockCreateNotification.mockClear();

      const result = await service.suggestOrganize(1, 'tok');
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('re-suggests after clearSuggestion frees the dedup slot', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_POINTS });
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      await service.suggestOrganize(1, 'tok');
      service.clearSuggestion(1, 42, 'vocabulary');
      mockCreateNotification.mockClear();

      const result = await service.suggestOrganize(1, 'tok');
      expect(result.created).toBe(1);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    });

    it('emits an ORGANIZE_SUGGESTED episode for analytics', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_POINTS });
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      await service.suggestOrganize(1, 'tok');
      expect(episodeCollector.record).toHaveBeenCalledTimes(1);
      const event = episodeCollector.record.mock.calls[0][0];
      expect(event.eventType).toBe('ORGANIZE_SUGGESTED');
      expect(event.userId).toBe(1);
      expect(event.payload.dedupKey).toBe('42:vocabulary');
      expect(event.payload.bookId).toBe(42);
      expect(event.payload.bookTitle).toBe('The Word Lover');
      expect(event.payload.domainType).toBe('vocabulary');
      expect(event.payload.pointCount).toBe(6);
      expect(event.payload.notificationId).toBe('notif_123');
    });

    it('survives a missing episodeCollector (best-effort)', async () => {
      service = new MoodBoardOrganizerService({ store });
      mockGetAll.mockResolvedValue({ items: SAMPLE_POINTS });
      mockBookStmt.get.mockReturnValue({ name: 'x' });
      const result = await service.suggestOrganize(1, 'tok');
      expect(result.created).toBe(1);
    });
  });

  describe('getSuggestion', () => {
    it('returns null when no suggestion exists', async () => {
      expect(await service.getSuggestion(1, '42:vocabulary', 'tok')).toBeNull();
    });

    it('returns hydrated cluster info when a suggestion exists', async () => {
      store.set('moodBoard.organizeSuggestions', {
        1: {
          '42:vocabulary': {
            notificationId: 'notif_123',
            pointCount: 6,
            createdAt: '2026-06-13T10:00:00Z',
          },
        },
      });
      mockGetAll.mockResolvedValue({ items: SAMPLE_POINTS });
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      const suggestion = await service.getSuggestion(1, '42:vocabulary', 'tok');
      expect(suggestion.bookId).toBe(42);
      expect(suggestion.bookTitle).toBe('The Word Lover');
      expect(suggestion.domainType).toBe('vocabulary');
      expect(suggestion.pointCount).toBe(6);
      expect(suggestion.conceptTitles).toHaveLength(6);
    });

    it('returns null for a malformed dedup key', async () => {
      store.set('moodBoard.organizeSuggestions', {
        1: { 'not-a-valid-key': { createdAt: '2026-06-13T10:00:00Z' } },
      });
      expect(
        await service.getSuggestion(1, 'not-a-valid-key', 'tok'),
      ).toBeNull();
    });
  });

  describe('clearSuggestion', () => {
    it('returns true and removes the record when it exists', () => {
      store.set('moodBoard.organizeSuggestions', {
        1: { '42:vocabulary': { createdAt: 'x' } },
      });
      const ok = service.clearSuggestion(1, 42, 'vocabulary');
      expect(ok).toBe(true);
      const suggestions = store.get('moodBoard.organizeSuggestions');
      expect(suggestions[1]['42:vocabulary']).toBeUndefined();
    });

    it('returns false when no such record exists', () => {
      expect(service.clearSuggestion(1, 99, 'math')).toBe(false);
    });
  });

  describe('createBoardFromCluster', () => {
    const SAMPLE_LP_POINTS = [
      seedPoint({
        id: 'lp_1',
        title: 'serendipity',
        back: { text: 'a happy accident' },
      }),
      seedPoint({
        id: 'lp_2',
        title: 'ephemeral',
        back: { text: 'lasting a very short time' },
      }),
    ];

    beforeEach(() => {
      store.set('moodBoard.organizeSuggestions', {
        1: {
          '42:vocabulary': {
            notificationId: 'notif_123',
            pointIds: ['lp_1', 'lp_2'],
            pointCount: 2,
            createdAt: 'x',
          },
        },
      });
    });

    it('returns error when token is missing', async () => {
      const res = await service.createBoardFromCluster(
        1,
        42,
        'vocabulary',
        null,
      );
      expect(res).toEqual({ error: 'No session token.' });
      expect(mockCreateNote).not.toHaveBeenCalled();
      expect(mockCreateMoodBoard).not.toHaveBeenCalled();
    });

    it('returns error when no learning points match the cluster', async () => {
      mockGetAll.mockResolvedValue({ items: [] });
      const res = await service.createBoardFromCluster(
        1,
        42,
        'vocabulary',
        'tok',
      );
      expect(res.error).toMatch(/No active learning points/);
      expect(mockCreateNote).not.toHaveBeenCalled();
      expect(mockCreateMoodBoard).not.toHaveBeenCalled();
    });

    it('creates one note per learning point, builds layout, returns board', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_LP_POINTS });
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });
      let noteId = 100;
      mockCreateNote.mockImplementation((note) => ({
        ...note,
        id: ++noteId,
      }));
      mockCreateMoodBoard.mockImplementation((board) => ({
        ...board,
        id: 'board_1',
      }));

      const res = await service.createBoardFromCluster(
        1,
        42,
        'vocabulary',
        'tok',
      );

      expect(res.board.id).toBe('board_1');
      expect(res.noteIds).toEqual([101, 102]);

      expect(mockCreateMoodBoard).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Vocabulary from The Word Lover',
          description: expect.stringContaining('2 vocabulary concepts'),
        }),
        'tok',
      );

      const layoutArg = mockCreateMoodBoard.mock.calls[0][0].gridLayout;
      expect(layoutArg.layout.lg).toHaveLength(2);
      expect(layoutArg.layout.lg.map((it) => it.i)).toEqual([101, 102]);

      expect(mockCreateNote).toHaveBeenCalledTimes(2);
      expect(mockCreateNote.mock.calls[0][0]).toMatchObject({
        sourceType: 'learning_point',
        sourceKey: 'lp_1',
      });
      expect(mockCreateNote.mock.calls[0][0].content).toContain('serendipity');
      expect(mockCreateNote.mock.calls[0][0].content).toContain(
        'a happy accident',
      );
    });

    it('clears the dedup record after success', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_LP_POINTS });
      mockCreateNote.mockReturnValue({ id: 999 });
      mockCreateMoodBoard.mockReturnValue({ id: 'board_x' });

      await service.createBoardFromCluster(1, 42, 'vocabulary', 'tok');

      const suggestions = store.get('moodBoard.organizeSuggestions');
      expect(suggestions[1]['42:vocabulary']).toBeUndefined();
    });

    it('preserves the dedup record on failure so the user can retry', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_LP_POINTS });
      mockCreateNote.mockReturnValue({ id: 999 });
      mockCreateMoodBoard.mockImplementation(() => {
        throw new Error('disk full');
      });

      const res = await service.createBoardFromCluster(
        1,
        42,
        'vocabulary',
        'tok',
      );
      expect(res.error).toContain('disk full');

      const suggestions = store.get('moodBoard.organizeSuggestions');
      expect(suggestions[1]['42:vocabulary']).toBeTruthy();
    });

    it('falls back to "Book #ID" when the book row is missing', async () => {
      mockGetAll.mockResolvedValue({ items: SAMPLE_LP_POINTS });
      mockBookStmt.get.mockReturnValue(null);
      mockCreateNote.mockReturnValue({ id: 999 });
      mockCreateMoodBoard.mockReturnValue({ id: 'board_x' });

      await service.createBoardFromCluster(1, 42, 'vocabulary', 'tok');

      const boardArg = mockCreateMoodBoard.mock.calls[0][0];
      expect(boardArg.name).toBe('Vocabulary from Book #42');
    });
  });
});
