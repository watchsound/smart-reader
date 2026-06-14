/**
 * MoodBoardOrganizerService Tests — Phase 8 organize loop.
 *
 * Covers:
 *   - cluster SQL aggregation + hydration
 *   - dedup logic (same cluster doesn't re-notify)
 *   - no-session no-op
 *   - clearSuggestion / getSuggestion
 *
 * Mocks the dbManager + NotificationManager boundaries; the service is
 * a thin orchestrator so this is full behavioral coverage.
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/user/data') },
}));

// Per-test mock control: we override `.all` / `.get` per call.
const mockAggStmt = { all: jest.fn(() => []) };
const mockDetailStmt = { all: jest.fn(() => []) };
const mockBookStmt = { get: jest.fn(() => null) };
const mockClusterStmt = { all: jest.fn(() => []) };

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn((sql) => {
      // Route to the right mock based on SQL fragments.
      if (sql.includes('GROUP BY')) return mockAggStmt;
      if (sql.includes('FROM book')) return mockBookStmt;
      // Slice-3 cluster-detail query: SELECT id, title, front, back,
      // status='active', book_id, domain_type ORDER BY created_at DESC.
      if (sql.includes('front, back')) return mockClusterStmt;
      return mockDetailStmt;
    }),
    // db.transaction(fn) returns a wrapper that runs fn synchronously.
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

const MoodBoardOrganizerService = require('../../main/brain/MoodBoardOrganizerService');

// In-memory electron-store mock — write→read works like the real one.
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

const SAMPLE_CLUSTER_ROW = {
  bookId: 42,
  domainType: 'vocabulary',
  pointCount: 6,
  oldestAt: '2026-06-08T10:00:00Z',
  newestAt: '2026-06-13T10:00:00Z',
};

const SAMPLE_POINTS = [
  { id: 'lp_1', title: 'serendipity' },
  { id: 'lp_2', title: 'ephemeral' },
  { id: 'lp_3', title: 'ineffable' },
  { id: 'lp_4', title: 'sonder' },
  { id: 'lp_5', title: 'meraki' },
  { id: 'lp_6', title: 'kalon' },
];

describe('MoodBoardOrganizerService', () => {
  let store;
  let service;
  let episodeCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAggStmt.all.mockReturnValue([]);
    mockDetailStmt.all.mockReturnValue([]);
    mockBookStmt.get.mockReturnValue(null);
    mockClusterStmt.all.mockReturnValue([]);
    mockCreateNotification.mockReturnValue({ id: 'notif_123' });
    mockCreateNote.mockReset();
    mockCreateMoodBoard.mockReset();

    // Provide a real session so suggestOrganize doesn't short-circuit.
    global.shared = {
      store: { get: jest.fn(() => ({ token: 'real-token', id: 1 })) },
    };

    store = makeStore();
    episodeCollector = { record: jest.fn() };
    service = new MoodBoardOrganizerService({ store, episodeCollector });
  });

  // ----------------------------------------------------------------------
  // detectClusters
  // ----------------------------------------------------------------------

  describe('detectClusters', () => {
    it('returns empty when no aggregation rows match', () => {
      mockAggStmt.all.mockReturnValue([]);
      const result = service.detectClusters(1);
      expect(result).toEqual([]);
    });

    it('hydrates each cluster with pointIds + concept titles + book title', () => {
      mockAggStmt.all.mockReturnValue([SAMPLE_CLUSTER_ROW]);
      mockDetailStmt.all.mockReturnValue(SAMPLE_POINTS);
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      const [cluster] = service.detectClusters(1);

      expect(cluster.bookId).toBe(42);
      expect(cluster.bookTitle).toBe('The Word Lover');
      expect(cluster.domainType).toBe('vocabulary');
      expect(cluster.pointCount).toBe(6);
      expect(cluster.pointIds).toEqual([
        'lp_1',
        'lp_2',
        'lp_3',
        'lp_4',
        'lp_5',
        'lp_6',
      ]);
      // Preview is capped at MAX_TITLES_PREVIEW (3).
      expect(cluster.conceptTitles).toEqual([
        'serendipity',
        'ephemeral',
        'ineffable',
      ]);
    });

    it('falls back to "Book #ID" when the book row is missing', () => {
      mockAggStmt.all.mockReturnValue([SAMPLE_CLUSTER_ROW]);
      mockDetailStmt.all.mockReturnValue(SAMPLE_POINTS);
      mockBookStmt.get.mockReturnValue(null);

      const [cluster] = service.detectClusters(1);
      expect(cluster.bookTitle).toBe('Book #42');
    });
  });

  // ----------------------------------------------------------------------
  // suggestOrganize
  // ----------------------------------------------------------------------

  describe('suggestOrganize', () => {
    it('no-ops when no session is signed in', () => {
      global.shared = { store: { get: jest.fn(() => null) } };
      const result = service.suggestOrganize(1, null);
      expect(result.reason).toBe('no session');
      expect(mockCreateNotification).not.toHaveBeenCalled();
      // Pin zero-state shape: a future refactor that runs cluster
      // detection before the session gate would silently leak data
      // here and the existing reason-only assertion would still pass.
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.clusters).toEqual([]);
    });

    it('no-ops when no clusters are detected', () => {
      mockAggStmt.all.mockReturnValue([]);
      const result = service.suggestOrganize(1, 'tok');
      expect(result.created).toBe(0);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('creates a notification and records dedup on first sight', () => {
      mockAggStmt.all.mockReturnValue([SAMPLE_CLUSTER_ROW]);
      mockDetailStmt.all.mockReturnValue(SAMPLE_POINTS);
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      const result = service.suggestOrganize(1, 'tok');

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      const [payload, effectiveToken] = mockCreateNotification.mock.calls[0];
      expect(payload.actionUrl).toBe(
        '/moodBoard?organize=42%3Avocabulary',
      );
      expect(payload.title).toContain('6 new vocabulary');
      expect(effectiveToken).toBe('real-token'); // uses session, not synthetic
      // Dedup persisted under the right key.
      expect(store._raw['moodBoard.organizeSuggestions']).toMatchObject({
        1: {
          '42:vocabulary': expect.objectContaining({
            notificationId: 'notif_123',
            pointCount: 6,
          }),
        },
      });
    });

    it('skips the cluster on a second pass (dedup)', () => {
      mockAggStmt.all.mockReturnValue([SAMPLE_CLUSTER_ROW]);
      mockDetailStmt.all.mockReturnValue(SAMPLE_POINTS);
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      service.suggestOrganize(1, 'tok'); // first pass — creates
      mockCreateNotification.mockClear();

      const result = service.suggestOrganize(1, 'tok'); // second pass — skip
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('re-suggests after clearSuggestion frees the dedup slot', () => {
      mockAggStmt.all.mockReturnValue([SAMPLE_CLUSTER_ROW]);
      mockDetailStmt.all.mockReturnValue(SAMPLE_POINTS);
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      service.suggestOrganize(1, 'tok'); // create
      service.clearSuggestion(1, 42, 'vocabulary'); // user organized it
      mockCreateNotification.mockClear();

      const result = service.suggestOrganize(1, 'tok'); // re-suggest allowed
      expect(result.created).toBe(1);
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    });

    it('emits an ORGANIZE_SUGGESTED episode for analytics', () => {
      mockAggStmt.all.mockReturnValue([SAMPLE_CLUSTER_ROW]);
      mockDetailStmt.all.mockReturnValue(SAMPLE_POINTS);
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      service.suggestOrganize(1, 'tok');
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

    it('survives a missing episodeCollector (best-effort)', () => {
      service = new MoodBoardOrganizerService({ store }); // no collector
      mockAggStmt.all.mockReturnValue([SAMPLE_CLUSTER_ROW]);
      mockDetailStmt.all.mockReturnValue(SAMPLE_POINTS);
      mockBookStmt.get.mockReturnValue({ name: 'x' });
      const result = service.suggestOrganize(1, 'tok');
      expect(result.created).toBe(1);
      // No throw, notification still created.
    });
  });

  // ----------------------------------------------------------------------
  // getSuggestion / clearSuggestion
  // ----------------------------------------------------------------------

  describe('getSuggestion', () => {
    it('returns null when no suggestion exists', () => {
      expect(service.getSuggestion(1, '42:vocabulary')).toBeNull();
    });

    it('returns hydrated cluster info when a suggestion exists', () => {
      // Seed dedup table directly (simulates a prior suggestOrganize call).
      store.set('moodBoard.organizeSuggestions', {
        1: {
          '42:vocabulary': {
            notificationId: 'notif_123',
            pointCount: 6,
            createdAt: '2026-06-13T10:00:00Z',
          },
        },
      });
      // Re-hydrate point titles + book name.
      mockDetailStmt.all.mockReturnValue(SAMPLE_POINTS);
      mockBookStmt.get.mockReturnValue({ name: 'The Word Lover' });

      const suggestion = service.getSuggestion(1, '42:vocabulary');
      expect(suggestion.bookId).toBe(42);
      expect(suggestion.bookTitle).toBe('The Word Lover');
      expect(suggestion.domainType).toBe('vocabulary');
      expect(suggestion.pointCount).toBe(6);
      expect(suggestion.conceptTitles).toHaveLength(6); // no preview cap here
    });

    it('returns null for a malformed dedup key', () => {
      store.set('moodBoard.organizeSuggestions', {
        1: { 'not-a-valid-key': { createdAt: '2026-06-13T10:00:00Z' } },
      });
      expect(service.getSuggestion(1, 'not-a-valid-key')).toBeNull();
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
      const ok = service.clearSuggestion(1, 99, 'math');
      expect(ok).toBe(false);
    });
  });

  // ----------------------------------------------------------------------
  // createBoardFromCluster (Slice 3)
  // ----------------------------------------------------------------------

  describe('createBoardFromCluster', () => {
    const SAMPLE_LP_ROWS = [
      {
        id: 'lp_1',
        title: 'serendipity',
        front: 'meaning?',
        back: JSON.stringify({ text: 'a happy accident' }),
        domainType: 'vocabulary',
      },
      {
        id: 'lp_2',
        title: 'ephemeral',
        front: 'meaning?',
        back: JSON.stringify({ text: 'lasting a very short time' }),
        domainType: 'vocabulary',
      },
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

    it('returns error when token is missing', () => {
      const res = service.createBoardFromCluster(1, 42, 'vocabulary', null);
      expect(res).toEqual({ error: 'No session token.' });
      expect(mockCreateNote).not.toHaveBeenCalled();
      expect(mockCreateMoodBoard).not.toHaveBeenCalled();
    });

    it('returns error when no learning points match the cluster', () => {
      mockClusterStmt.all.mockReturnValue([]);
      const res = service.createBoardFromCluster(1, 42, 'vocabulary', 'tok');
      expect(res.error).toMatch(/No active learning points/);
      expect(mockCreateNote).not.toHaveBeenCalled();
      expect(mockCreateMoodBoard).not.toHaveBeenCalled();
    });

    it('creates one note per learning point, builds layout, returns board', () => {
      mockClusterStmt.all.mockReturnValue(SAMPLE_LP_ROWS);
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

      const res = service.createBoardFromCluster(1, 42, 'vocabulary', 'tok');

      expect(res.board.id).toBe('board_1');
      expect(res.noteIds).toEqual([101, 102]);

      // Board metadata pulls book title + capitalizes domain.
      expect(mockCreateMoodBoard).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Vocabulary from The Word Lover',
          description: expect.stringContaining('2 vocabulary concepts'),
        }),
        'tok',
      );

      // gridLayout has one tile per note, with `i` set to the note id.
      const layoutArg = mockCreateMoodBoard.mock.calls[0][0].gridLayout;
      expect(layoutArg.layout.lg).toHaveLength(2);
      expect(layoutArg.layout.lg.map((it) => it.i)).toEqual(['101', '102']);

      // Notes carry the learning-point linkage.
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

    it('clears the dedup record after success', () => {
      mockClusterStmt.all.mockReturnValue(SAMPLE_LP_ROWS);
      mockCreateNote.mockReturnValue({ id: 999 });
      mockCreateMoodBoard.mockReturnValue({ id: 'board_x' });

      service.createBoardFromCluster(1, 42, 'vocabulary', 'tok');

      const suggestions = store.get('moodBoard.organizeSuggestions');
      expect(suggestions[1]['42:vocabulary']).toBeUndefined();
    });

    it('preserves the dedup record on failure so the user can retry', () => {
      mockClusterStmt.all.mockReturnValue(SAMPLE_LP_ROWS);
      mockCreateNote.mockReturnValue({ id: 999 });
      mockCreateMoodBoard.mockImplementation(() => {
        throw new Error('disk full');
      });

      const res = service.createBoardFromCluster(1, 42, 'vocabulary', 'tok');
      expect(res.error).toContain('disk full');

      const suggestions = store.get('moodBoard.organizeSuggestions');
      expect(suggestions[1]['42:vocabulary']).toBeTruthy();
    });

    it('falls back to "Book #ID" when the book row is missing', () => {
      mockClusterStmt.all.mockReturnValue(SAMPLE_LP_ROWS);
      mockBookStmt.get.mockReturnValue(null);
      mockCreateNote.mockReturnValue({ id: 999 });
      mockCreateMoodBoard.mockReturnValue({ id: 'board_x' });

      service.createBoardFromCluster(1, 42, 'vocabulary', 'tok');

      const boardArg = mockCreateMoodBoard.mock.calls[0][0];
      expect(boardArg.name).toBe('Vocabulary from Book #42');
    });
  });
});
