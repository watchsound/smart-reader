/**
 * ProposalQueue — priority + freshness + dedup + max-size queue.
 * Pure data structure, no I/O. Consumed by TriggerBus.
 *
 * @see commons/brain/triggerTypes for Trigger/Proposal shapes.
 */

const PRIORITY_RANK = { high: 3, normal: 2, low: 1 };

class ProposalQueue {
  /**
   * @param {{ maxSize?: number, now?: () => number }} [opts]
   */
  constructor(opts = {}) {
    this._items = new Map(); // id → Proposal
    this._maxSize = opts.maxSize ?? 32;
    this._now = opts.now ?? (() => Date.now());
  }

  /**
   * @param {import('../../commons/brain/triggerTypes').Trigger} trigger
   * @returns {import('../../commons/brain/triggerTypes').Proposal}
   */
  enqueue(trigger) {
    if (this._items.has(trigger.id)) return this._items.get(trigger.id);
    const proposal = { ...trigger, queuedAt: this._now(), status: 'queued' };
    this._items.set(trigger.id, proposal);
    this._evictIfOverMax();
    return proposal;
  }

  peek() {
    const sorted = this._sortedQueued();
    return sorted[0] ?? null;
  }

  list() {
    return this._sortedQueued();
  }

  size() {
    return this._sortedQueued().length;
  }

  dismiss(id) {
    const p = this._items.get(id);
    if (!p) return null;
    p.status = 'dismissed';
    this._items.delete(id);
    return p;
  }

  purgeExpired() {
    const now = this._now();
    for (const [id, p] of this._items.entries()) {
      if (p.emittedAt + p.freshness < now) {
        p.status = 'expired';
        this._items.delete(id);
      }
    }
  }

  _sortedQueued() {
    return Array.from(this._items.values())
      .filter((p) => p.status === 'queued')
      .sort((a, b) => {
        const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (pr !== 0) return pr;
        return b.emittedAt - a.emittedAt; // newer first inside same tier
      });
  }

  _evictIfOverMax() {
    if (this._items.size <= this._maxSize) return;
    const overage = this._items.size - this._maxSize;
    const victims = Array.from(this._items.values()).sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      return a.emittedAt - b.emittedAt;
    });
    for (let i = 0; i < overage; i += 1) {
      this._items.delete(victims[i].id);
    }
  }
}

module.exports = ProposalQueue;
