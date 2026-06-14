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
});
