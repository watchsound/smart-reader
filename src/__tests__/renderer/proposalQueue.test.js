const ProposalQueue = require('../../renderer/brain/proposalQueue');

const makeTrigger = (over = {}) => ({
  id: 'phase4:para:cfi-1',
  source: 'phase-4-micro-card',
  unit: 'atomic-chip',
  surfaceTarget: { kind: 'paragraph', cfi: 'cfi-1' },
  priority: 'normal',
  freshness: 60_000,
  emittedAt: Date.now(),
  payload: { term: 'foo' },
  ...over,
});

describe('ProposalQueue', () => {
  test('enqueues a trigger and reports queue depth', () => {
    const q = new ProposalQueue();
    q.enqueue(makeTrigger());
    expect(q.size()).toBe(1);
    expect(q.peek().id).toBe('phase4:para:cfi-1');
  });

  test('dedupes by trigger id', () => {
    const q = new ProposalQueue();
    q.enqueue(makeTrigger({ id: 'x' }));
    q.enqueue(makeTrigger({ id: 'x' }));
    expect(q.size()).toBe(1);
  });

  test('orders by priority then freshness', () => {
    const q = new ProposalQueue();
    q.enqueue(makeTrigger({ id: 'a', priority: 'low', emittedAt: 100 }));
    q.enqueue(makeTrigger({ id: 'b', priority: 'high', emittedAt: 200 }));
    q.enqueue(makeTrigger({ id: 'c', priority: 'normal', emittedAt: 300 }));
    expect(q.peek().id).toBe('b');
    q.dismiss('b');
    expect(q.peek().id).toBe('c');
  });

  test('expires triggers past freshness TTL', () => {
    const q = new ProposalQueue({ now: () => 10_000 });
    q.enqueue(makeTrigger({ id: 'old', freshness: 100, emittedAt: 0 }));
    q.enqueue(makeTrigger({ id: 'fresh', freshness: 100_000, emittedAt: 9_000 }));
    q.purgeExpired();
    expect(q.size()).toBe(1);
    expect(q.peek().id).toBe('fresh');
  });

  test('evicts lowest-priority when above max size', () => {
    const q = new ProposalQueue({ maxSize: 2 });
    q.enqueue(makeTrigger({ id: 'a', priority: 'low' }));
    q.enqueue(makeTrigger({ id: 'b', priority: 'normal' }));
    q.enqueue(makeTrigger({ id: 'c', priority: 'high' }));
    expect(q.size()).toBe(2);
    expect(q.list().map((p) => p.id).sort()).toEqual(['b', 'c']);
  });

  test('dismiss removes by id and marks status', () => {
    const q = new ProposalQueue();
    q.enqueue(makeTrigger({ id: 'x' }));
    const dismissed = q.dismiss('x');
    expect(dismissed.status).toBe('dismissed');
    expect(q.size()).toBe(0);
  });

  test('quest weighting bubbles quest-aligned items within priority tier', () => {
    const questBooks = new Set([42]);
    const q = new ProposalQueue({
      getQuestBookIds: () => questBooks,
    });
    // Two normal-priority items: one matches the quest book, one doesn't.
    q.enqueue(
      makeTrigger({
        id: 'unrelated',
        priority: 'normal',
        emittedAt: 200,
        payload: { bookId: 7 },
      }),
    );
    q.enqueue(
      makeTrigger({
        id: 'questy',
        priority: 'normal',
        emittedAt: 100,
        payload: { bookId: 42 },
      }),
    );
    // Quest-aligned item wins even though it's older.
    expect(q.peek().id).toBe('questy');
  });

  test('quest weighting respects priority tiers (high still beats quest-aligned-normal)', () => {
    const questBooks = new Set([42]);
    const q = new ProposalQueue({
      getQuestBookIds: () => questBooks,
    });
    q.enqueue(
      makeTrigger({
        id: 'high-unrelated',
        priority: 'high',
        emittedAt: 100,
        payload: { bookId: 7 },
      }),
    );
    q.enqueue(
      makeTrigger({
        id: 'normal-quest',
        priority: 'normal',
        emittedAt: 200,
        payload: { bookId: 42 },
      }),
    );
    expect(q.peek().id).toBe('high-unrelated');
  });

  test('quest weighting extracts bookId from multi-surface-flow steps', () => {
    const questBooks = new Set([99]);
    const q = new ProposalQueue({
      getQuestBookIds: () => questBooks,
    });
    q.enqueue(
      makeTrigger({
        id: 'unrelated',
        priority: 'normal',
        emittedAt: 100,
        payload: { bookId: 7 },
      }),
    );
    q.enqueue(
      makeTrigger({
        id: 'flow-quest',
        priority: 'normal',
        emittedAt: 50,
        unit: 'multi-surface-flow',
        payload: {
          steps: [{ view: 'reading/99' }, { view: 'vocabulary' }],
        },
      }),
    );
    expect(q.peek().id).toBe('flow-quest');
  });
});
