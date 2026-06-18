/**
 * ProposalQueue — priority + freshness + dedup + max-size queue.
 * Pure data structure, no I/O. Consumed by TriggerBus.
 *
 * @see commons/brain/triggerTypes for Trigger/Proposal shapes.
 */

const PRIORITY_RANK = { high: 3, normal: 2, low: 1 };

/**
 * Walk a proposal's payload and return the set of bookIds it references.
 * Atomic chip / inline sequence carry payload.bookId. Multi-surface flow
 * embeds bookIds in step.view = "reading/<id>".
 */
function extractBookIds(proposal) {
  const ids = new Set();
  const direct = proposal?.payload?.bookId;
  if (typeof direct === 'number') ids.add(direct);
  const steps = Array.isArray(proposal?.payload?.steps)
    ? proposal.payload.steps
    : [];
  steps.forEach((s) => {
    const v = s?.view || '';
    const m = /^reading\/(\d+)/.exec(String(v).replace(/^\/+/, ''));
    if (m) ids.add(Number(m[1]));
  });
  return ids;
}

class ProposalQueue {
  /**
   * @param {{ maxSize?: number, now?: () => number, getQuestBookIds?: () => Set<number> }} [opts]
   *
   * `getQuestBookIds`, when provided, is consulted on every sort: any
   * proposal whose payload references one of the returned book IDs is
   * bubbled above proposals of the same priority tier that don't. The
   * getter is called lazily so the queue always sees the current Quest
   * context without needing explicit invalidation.
   */
  constructor(opts = {}) {
    this._items = new Map(); // id → Proposal
    this._maxSize = opts.maxSize ?? 32;
    this._now = opts.now ?? (() => Date.now());
    this._getQuestBookIds = opts.getQuestBookIds ?? (() => new Set());
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
    const questBooks = this._getQuestBookIds();
    const isQuestAligned = (p) => {
      if (!questBooks || questBooks.size === 0) return false;
      const ids = extractBookIds(p);
      for (const id of ids) if (questBooks.has(id)) return true;
      return false;
    };
    return Array.from(this._items.values())
      .filter((p) => p.status === 'queued')
      .sort((a, b) => {
        // Priority tier first — quests never beat genuinely-higher-priority items.
        const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (pr !== 0) return pr;
        // Quest-aligned items bubble to the top within the same tier.
        const aQ = isQuestAligned(a);
        const bQ = isQuestAligned(b);
        if (aQ !== bQ) return bQ ? 1 : -1;
        // Phase 14b: ROI within tier, after quest weighting. Null ROI is
        // treated as 0 (neutral) so non-mappable triggers don't get
        // demoted purely for lacking a predictive signal.
        const aRoi = (a._roi && typeof a._roi.value === 'number') ? a._roi.value : 0;
        const bRoi = (b._roi && typeof b._roi.value === 'number') ? b._roi.value : 0;
        if (aRoi !== bRoi) return bRoi - aRoi;
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
