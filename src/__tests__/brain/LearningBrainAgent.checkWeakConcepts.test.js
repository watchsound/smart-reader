/**
 * LearningBrainAgent — checkWeakConcepts default-deployment path.
 *
 * Production wires the brain with `learningGraphSkill: null` and
 * `neo4jAdapter: graphInterface` (which does NOT expose
 * `detectWeakConcepts`). Both guarded branches skip, and the brain
 * must fall through to learningPointService.getAll (graph-backed) +
 * JS filtering. Previously the fallback ran a raw SQL query on the
 * SQLite `learning_point` table, which the production write path no
 * longer populates — so the fallback returned [] forever.
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/tmp/test') },
}));

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(() => ({
      all: () => [],
      get: () => null,
      run: () => ({}),
    })),
  },
  getUserIdFromToken: jest.fn(() => 1),
}));

const mockGetAll = jest.fn(async () => ({ items: [] }));
jest.mock('../../main/utils/LearningPointService', () => ({
  __esModule: true,
  default: { getAll: (...args) => mockGetAll(...args) },
}));

const LearningBrainAgent = require('../../main/brain/LearningBrainAgent');

const lp = (overrides = {}) => ({
  id: 'lp_1',
  title: 'concept-1',
  masteryLevel: 25,
  reviewCount: 5,
  domainType: 'math',
  ...overrides,
});

describe('LearningBrainAgent.checkWeakConcepts — default-deployment fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAll.mockResolvedValue({ items: [] });
  });

  it('reads from learningPointService when no skill is wired', async () => {
    // Production-shaped wiring: skill is null, neo4jAdapter lacks the
    // detectWeakConcepts method.
    const agent = new LearningBrainAgent({
      learningGraphSkill: null,
      neo4jAdapter: {}, // graphInterface stand-in without the method
    });
    mockGetAll.mockResolvedValue({
      items: [
        lp({ id: 'lp_strong', masteryLevel: 80 }),       // too high — skip
        lp({ id: 'lp_weak_a', masteryLevel: 35 }),       // include
        lp({ id: 'lp_weak_b', masteryLevel: 20 }),       // include (weaker)
        lp({ id: 'lp_few_reviews', masteryLevel: 30, reviewCount: 1 }), // skip
        lp({ id: 'lp_unrated', masteryLevel: 0 }),       // skip — masteryLevel must be > 0
      ],
    });

    const result = await agent.checkWeakConcepts(1, 'tok');

    expect(result.success).toBe(true);
    expect(mockGetAll).toHaveBeenCalledWith('tok', { pageSize: 5000 });
    // Sorted by mastery ASC.
    expect(result.result.weakConcepts.map((c) => c.id)).toEqual([
      'lp_weak_b',
      'lp_weak_a',
    ]);
    // Carries both `title` and the legacy `name` alias.
    expect(result.result.weakConcepts[0].name).toBe(
      result.result.weakConcepts[0].title,
    );
  });

  it('caps at 10 results', async () => {
    const agent = new LearningBrainAgent({});
    mockGetAll.mockResolvedValue({
      items: Array.from({ length: 25 }, (_, i) =>
        lp({ id: `lp_${i}`, masteryLevel: 10 + i }),
      ),
    });

    const result = await agent.checkWeakConcepts(1, 'tok');
    expect(result.result.weakConcepts).toHaveLength(10);
  });

  it('uses the neo4jAdapter when it exposes detectWeakConcepts', async () => {
    const detectWeakConcepts = jest.fn(async () => [
      { id: 'graph_1', name: 'from graph' },
    ]);
    const agent = new LearningBrainAgent({
      learningGraphSkill: null,
      neo4jAdapter: { detectWeakConcepts },
    });

    const result = await agent.checkWeakConcepts(1, 'tok');

    expect(detectWeakConcepts).toHaveBeenCalledWith(10, 'tok');
    expect(mockGetAll).not.toHaveBeenCalled();
    expect(result.result.weakConcepts).toEqual([
      { id: 'graph_1', name: 'from graph' },
    ]);
  });

  it('returns success:false on unexpected error', async () => {
    const agent = new LearningBrainAgent({});
    mockGetAll.mockRejectedValue(new Error('graph down'));
    const result = await agent.checkWeakConcepts(1, 'tok');
    expect(result.success).toBe(false);
    expect(result.error).toBe('graph down');
  });
});
