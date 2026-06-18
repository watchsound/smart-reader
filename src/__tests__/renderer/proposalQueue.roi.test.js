const ProposalQueue = require('../../renderer/brain/proposalQueue');

function tr(id, priority, opts = {}) {
  return {
    id,
    priority,
    source: 'production-prompt-schedule',
    payload: opts.payload || {},
    emittedAt: opts.emittedAt || 1000,
    freshness: 1_000_000,
    _roi: opts.roi != null
      ? { value: opts.roi, n: 30, shrinkageLevel: 'cell', expectedCost: 0.001, expectedDelta: opts.roi * 0.001 }
      : null,
  };
}

describe('ProposalQueue ROI sort (Phase 14b)', () => {
  test('within same priority tier, high ROI sorts above low ROI', () => {
    const q = new ProposalQueue();
    q.enqueue(tr('lo', 'normal', { roi: 1000 }));
    q.enqueue(tr('hi', 'normal', { roi: 5000 }));
    const ids = q.list().map((p) => p.id);
    expect(ids).toEqual(['hi', 'lo']);
  });

  test('high-priority item with low ROI still beats low-priority with high ROI', () => {
    const q = new ProposalQueue();
    q.enqueue(tr('hp', 'high', { roi: 1 }));
    q.enqueue(tr('lp', 'low',  { roi: 9999 }));
    const ids = q.list().map((p) => p.id);
    expect(ids).toEqual(['hp', 'lp']);
  });

  test('quest-aligned item beats higher-ROI non-aligned in same tier', () => {
    const q = new ProposalQueue({ getQuestBookIds: () => new Set([42]) });
    q.enqueue(tr('quest',  'normal', { payload: { bookId: 42 }, roi: 100 }));
    q.enqueue(tr('noquest', 'normal', { payload: { bookId: 7 }, roi: 9999 }));
    const ids = q.list().map((p) => p.id);
    expect(ids).toEqual(['quest', 'noquest']);
  });

  test('null ROI sorts as 0 (neutral), positive ROI beats it within tier', () => {
    const q = new ProposalQueue();
    q.enqueue(tr('null',   'normal', { roi: null }));
    q.enqueue(tr('pos',    'normal', { roi: 100 }));
    const ids = q.list().map((p) => p.id);
    expect(ids).toEqual(['pos', 'null']);
  });

  test('all-null ROIs fall back to emittedAt ordering', () => {
    const q = new ProposalQueue();
    q.enqueue(tr('older', 'normal', { roi: null, emittedAt: 1000 }));
    q.enqueue(tr('newer', 'normal', { roi: null, emittedAt: 2000 }));
    const ids = q.list().map((p) => p.id);
    expect(ids).toEqual(['newer', 'older']);
  });
});
