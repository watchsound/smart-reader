/**
 * Covers QuestPacingService.computePacing — the orchestrator left
 * unexercised by questPacing.test.js (which only tests bottleneckReason).
 *
 * Pattern mirrors latencyByIntent.test.js: mock dbManager + the lazily-required
 * conceptProjection so we drive computePacing with deterministic fixtures
 * without spinning up SQLite or PredictiveEngine.
 */

let rows = {};

jest.mock('../../main/db/dbManager', () => ({
  getDb: () => ({
    prepare: (sql) => ({
      all: (...args) => {
        if (/FROM learning_point/i.test(sql) && /WHERE book_id IN/i.test(sql)) {
          return rows.learningPointsByBook || [];
        }
        return [];
      },
      get: (...args) => {
        if (/MAX\(ts\)/i.test(sql)) {
          const learningPointId = args[0];
          const last = (rows.lastEventTsByLp || {})[learningPointId];
          return last ? { lastTs: last } : null;
        }
        return null;
      },
    }),
  }),
}));

const projections = new Map(); // learningPointId -> projection (or thrown null)
jest.mock('../../main/brain/predictive/conceptProjection', () => ({
  getConceptProjection: jest.fn(async ({ learningPoint }) => {
    if (!projections.has(learningPoint.id)) return null;
    return projections.get(learningPoint.id);
  }),
}));

const { computePacing, MASTERY_THRESHOLD, BOTTLENECK_LIMIT } = require('../../main/utils/QuestPacingService');

function lp(id, overrides = {}) {
  return {
    id,
    title: `LP ${id}`,
    box: 1,
    masteryLevel: 0,
    domainType: 'knowledge',
    bookId: 'book-1',
    updatedAt: '2026-06-18T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  rows = {};
  projections.clear();
});

describe('computePacing', () => {
  test('empty bookIds returns zero-state shape', async () => {
    const out = await computePacing({ bookIds: [] });
    expect(out).toEqual({
      conceptsTotal: 0,
      conceptsMastered: 0,
      completionFraction: 0,
      etaDays: null,
      indeterminateCount: 0,
      bottlenecks: [],
      basis: { topNAnalyzed: 0, scopeTotal: 0 },
    });
  });

  test('counts mastered concepts using MASTERY_THRESHOLD (≥80)', async () => {
    rows.learningPointsByBook = [
      lp('a', { masteryLevel: MASTERY_THRESHOLD }),       // mastered (≥80)
      lp('b', { masteryLevel: MASTERY_THRESHOLD - 1 }),   // not (79)
      lp('c', { masteryLevel: 100 }),                      // mastered
      lp('d', { masteryLevel: 0 }),                        // not
    ];
    const out = await computePacing({ bookIds: ['book-1'] });
    expect(out.conceptsTotal).toBe(4);
    expect(out.conceptsMastered).toBe(2);
    expect(out.completionFraction).toBe(0.5);
  });

  test('etaDays is the max across analyzed projections; null projections count as indeterminate', async () => {
    rows.learningPointsByBook = [lp('a'), lp('b'), lp('c')];
    projections.set('a', { etaDays: 5 });
    projections.set('b', { etaDays: 20 });
    // 'c' has no projection → indeterminate
    const out = await computePacing({ bookIds: ['book-1'] });
    expect(out.etaDays).toBe(20);
    expect(out.indeterminateCount).toBe(1);
  });

  test('all-indeterminate yields null etaDays and matching indeterminateCount', async () => {
    rows.learningPointsByBook = [lp('a'), lp('b')];
    // no projections set → both return null
    const out = await computePacing({ bookIds: ['book-1'] });
    expect(out.etaDays).toBeNull();
    expect(out.indeterminateCount).toBe(2);
  });

  test('bottlenecks exclude mastered concepts and rank by (eta desc, mastery asc, stalled desc)', async () => {
    rows.learningPointsByBook = [
      lp('mastered', { masteryLevel: 90 }),     // excluded — mastered
      lp('high-eta', { masteryLevel: 20 }),     // eta 50
      lp('mid-eta',  { masteryLevel: 30 }),     // eta 30, lower mastery wins tiebreak vs same eta? n/a here
      lp('low-eta',  { masteryLevel: 10 }),     // eta 5
    ];
    projections.set('mastered', { etaDays: 1 });
    projections.set('high-eta', { etaDays: 50 });
    projections.set('mid-eta',  { etaDays: 30 });
    projections.set('low-eta',  { etaDays: 5 });

    const out = await computePacing({ bookIds: ['book-1'] });
    expect(out.bottlenecks.map((b) => b.learningPointId)).toEqual([
      'high-eta',
      'mid-eta',
      'low-eta',
    ]);
    expect(out.bottlenecks.find((b) => b.learningPointId === 'mastered')).toBeUndefined();
  });

  test('bottleneck tiebreak: equal etaDays → lower mastery first', async () => {
    rows.learningPointsByBook = [
      lp('a', { masteryLevel: 40 }),
      lp('b', { masteryLevel: 20 }),
    ];
    projections.set('a', { etaDays: 10 });
    projections.set('b', { etaDays: 10 });
    const out = await computePacing({ bookIds: ['book-1'] });
    expect(out.bottlenecks.map((b) => b.learningPointId)).toEqual(['b', 'a']);
  });

  test('bottlenecks capped at BOTTLENECK_LIMIT', async () => {
    rows.learningPointsByBook = Array.from({ length: BOTTLENECK_LIMIT + 3 }, (_, i) =>
      lp(`lp${i}`, { masteryLevel: 10 }),
    );
    for (let i = 0; i < BOTTLENECK_LIMIT + 3; i += 1) {
      projections.set(`lp${i}`, { etaDays: 10 + i }); // distinct etas
    }
    const out = await computePacing({ bookIds: ['book-1'] });
    expect(out.bottlenecks).toHaveLength(BOTTLENECK_LIMIT);
  });

  test('stalledDays computed from MAX(ts) of mastery_event', async () => {
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    rows.learningPointsByBook = [lp('stale', { masteryLevel: 30 })];
    rows.lastEventTsByLp = { stale: sevenDaysAgo };
    projections.set('stale', { etaDays: 15 });
    const out = await computePacing({ bookIds: ['book-1'] });
    expect(out.bottlenecks[0].stalledDays).toBeGreaterThanOrEqual(6);
    expect(out.bottlenecks[0].stalledDays).toBeLessThanOrEqual(7);
  });

  test('basis reports topNAnalyzed and scopeTotal', async () => {
    rows.learningPointsByBook = [lp('a'), lp('b'), lp('c')];
    const out = await computePacing({ bookIds: ['book-1'] });
    expect(out.basis).toEqual({ topNAnalyzed: 3, scopeTotal: 3 });
  });
});
