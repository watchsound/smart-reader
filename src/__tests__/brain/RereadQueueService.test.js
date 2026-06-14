/**
 * RereadQueueService Tests — Phase 8 spaced re-reading queue.
 *
 * Pure electron-store-backed service, no SQL. Covers:
 *   - schedule: idempotent per (bookId, chapterId), preserves completed items
 *   - getPending: filters by user, excludes completed, sorts by dueAt
 *   - complete / dismiss: state transitions
 */

const {
  describe,
  it,
  expect,
  beforeEach,
} = require('@jest/globals');

// RereadQueueService is ESM-exported via `export default`, which Babel
// compiles to `module.exports.default`. The other brain services in this
// directory use a dual-export pattern; this one doesn't.
const RereadQueueService = require('../../main/utils/RereadQueueService').default;

const makeStore = () => {
  const data = {};
  return {
    get: jest.fn((key, fallback) =>
      data[key] === undefined ? fallback : data[key],
    ),
    set: jest.fn((key, value) => {
      data[key] = value;
    }),
  };
};

const SAMPLE = {
  bookId: 1,
  bookTitle: 'Crime and Punishment',
  chapterId: 'ch_3',
  chapterName: 'The Confession',
  gaps: ['Raskolnikov motive', 'doubling'],
  score: 35,
  userId: 1,
};

describe('RereadQueueService', () => {
  let store;
  let svc;

  beforeEach(() => {
    store = makeStore();
    svc = new RereadQueueService(store);
  });

  // ----------------------------------------------------------------------
  // schedule
  // ----------------------------------------------------------------------

  describe('schedule', () => {
    it('creates an item with id, scheduledAt, dueAt 2 days out', () => {
      const before = Date.now();
      const item = svc.schedule(SAMPLE);
      const after = Date.now();

      expect(item.id).toMatch(/^rr_/);
      expect(item.bookId).toBe(1);
      expect(item.bookTitle).toBe('Crime and Punishment');
      expect(item.gaps).toEqual(['Raskolnikov motive', 'doubling']);
      expect(item.completedAt).toBeNull();
      expect(item.userId).toBe(1);

      const scheduled = new Date(item.scheduledAt).getTime();
      expect(scheduled).toBeGreaterThanOrEqual(before);
      expect(scheduled).toBeLessThanOrEqual(after);

      const due = new Date(item.dueAt).getTime();
      // 2 days = 172800000 ms, allow ±1s for setDate semantics.
      expect(due - scheduled).toBeGreaterThanOrEqual(2 * 86400000 - 1000);
      expect(due - scheduled).toBeLessThanOrEqual(2 * 86400000 + 1000);
    });

    it('is idempotent per (bookId, chapterId) — updates instead of inserting', () => {
      const first = svc.schedule(SAMPLE);
      const second = svc.schedule({
        ...SAMPLE,
        gaps: ['fresh gap'],
        score: 20,
      });

      // Same id, updated gaps/score.
      expect(second.id).toBe(first.id);
      expect(second.gaps).toEqual(['fresh gap']);
      expect(second.score).toBe(20);

      const pending = svc.getPending(1);
      expect(pending).toHaveLength(1);
    });

    it('does NOT collapse a completed item with a new one — new item inserts', () => {
      const first = svc.schedule(SAMPLE);
      svc.complete(first.id);
      // Re-scheduling the same chapter after completion should insert anew.
      const second = svc.schedule(SAMPLE);
      expect(second.id).not.toBe(first.id);
      // Pending list shows only the new one (the completed item is excluded).
      const pending = svc.getPending(1);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(second.id);
    });
  });

  // ----------------------------------------------------------------------
  // getPending
  // ----------------------------------------------------------------------

  describe('getPending', () => {
    it('returns empty when no items exist', () => {
      expect(svc.getPending(1)).toEqual([]);
    });

    it('excludes completed items', () => {
      const a = svc.schedule({ ...SAMPLE, chapterId: 'ch_1' });
      svc.schedule({ ...SAMPLE, chapterId: 'ch_2' });
      svc.complete(a.id);
      const pending = svc.getPending(1);
      expect(pending).toHaveLength(1);
      expect(pending[0].chapterId).toBe('ch_2');
    });

    it('filters by userId', () => {
      svc.schedule({ ...SAMPLE, userId: 1, chapterId: 'ch_1' });
      svc.schedule({ ...SAMPLE, userId: 2, chapterId: 'ch_2' });
      expect(svc.getPending(1)).toHaveLength(1);
      expect(svc.getPending(2)).toHaveLength(1);
      expect(svc.getPending(99)).toHaveLength(0);
    });

    it('sorts by dueAt ascending (most overdue first)', () => {
      // Schedule three items with manually overridden dueAt via store seed.
      store.set('rereadQueue.items', [
        {
          id: 'a',
          bookId: 1,
          chapterId: 'ch_a',
          userId: 1,
          dueAt: '2026-06-15T00:00:00Z',
          completedAt: null,
        },
        {
          id: 'b',
          bookId: 1,
          chapterId: 'ch_b',
          userId: 1,
          dueAt: '2026-06-13T00:00:00Z',
          completedAt: null,
        },
        {
          id: 'c',
          bookId: 1,
          chapterId: 'ch_c',
          userId: 1,
          dueAt: '2026-06-14T00:00:00Z',
          completedAt: null,
        },
      ]);
      const pending = svc.getPending(1);
      expect(pending.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    });
  });

  // ----------------------------------------------------------------------
  // complete / dismiss
  // ----------------------------------------------------------------------

  describe('complete', () => {
    it('marks the item completedAt and removes it from pending', () => {
      const item = svc.schedule(SAMPLE);
      const completed = svc.complete(item.id);
      expect(completed.completedAt).toBeTruthy();
      expect(svc.getPending(1)).toEqual([]);
    });

    it('returns null when the id is not found', () => {
      expect(svc.complete('nonexistent')).toBeNull();
    });
  });

  describe('dismiss', () => {
    it('removes the item entirely and returns true', () => {
      const item = svc.schedule(SAMPLE);
      expect(svc.dismiss(item.id)).toBe(true);
      // Re-scheduling the same chapter after dismiss inserts fresh (no collapse).
      const fresh = svc.schedule(SAMPLE);
      expect(fresh.id).not.toBe(item.id);
    });

    it('returns false when the id is not found', () => {
      expect(svc.dismiss('nonexistent')).toBe(false);
    });
  });
});
