/**
 * QuestService — long-lived user-declared learning goals.
 *
 * Plan 2 fork #5. Persists Quests in electron-store under 'quests.items'.
 * A Quest is the user's response to "I want to learn X" — distinct from
 * a Trigger (Brain-initiated proposal) and a Flow (one execution).
 * Quests give the Brain a stable goal to weight Phase 7/8 proposals
 * against. Plan 3 will wire the weighting; Plan 2 just lands the data
 * model + persistence + IPC surface.
 *
 * Quest shape:
 *   {
 *     id          string  — q_<timestamp>_<rand>
 *     name        string  — user-supplied label (e.g. "Learn German B2")
 *     goal        string  — full goal text passed to LearningPathPlanner
 *     bookIds     number[] — books explicitly in scope (may be empty)
 *     status      'active' | 'paused' | 'archived'
 *     createdAt   string  — ISO
 *     updatedAt   string  — ISO
 *     archivedAt  string | null
 *     metadata    object  — free-form (e.g. last associated pathId)
 *   }
 *
 * Quests are not deduplicated — the user can declare overlapping goals
 * (e.g. "Learn German B2" + "Read Goethe"); the Brain weighting will
 * combine signals. Re-creating a Quest with the same name produces a
 * new id.
 */

const STORE_KEY = 'quests.items';

function generateId() {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

class QuestService {
  /**
   * @param {object} store electron-store instance
   */
  constructor(store) {
    this.store = store;
  }

  _getAll() {
    return this.store ? this.store.get(STORE_KEY, []) : [];
  }

  _setAll(items) {
    if (this.store) this.store.set(STORE_KEY, items);
  }

  /**
   * Create a new Quest.
   * @param {{ name: string, goal: string, bookIds?: number[], metadata?: object, userId?: number }} input
   * @returns {object} the created Quest
   */
  create(input) {
    const name = String(input?.name || '').trim();
    const goal = String(input?.goal || '').trim();
    if (!name) return { error: 'name is required' };
    if (!goal) return { error: 'goal is required' };

    const now = new Date().toISOString();
    const quest = {
      id: generateId(),
      name,
      goal,
      bookIds: Array.isArray(input.bookIds)
        ? input.bookIds.filter((b) => typeof b === 'number')
        : [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
      userId: typeof input.userId === 'number' && input.userId > 0 ? input.userId : 1,
    };
    const items = this._getAll();
    items.push(quest);
    this._setAll(items);
    return quest;
  }

  /**
   * Get a single Quest by id.
   * @param {string} id
   * @returns {object | null}
   */
  get(id) {
    return this._getAll().find((q) => q.id === id) || null;
  }

  /**
   * List Quests, optionally filtered by userId and/or status.
   * @param {{ userId?: number, status?: string }} [filter]
   */
  list(filter = {}) {
    const items = this._getAll();
    return items.filter((q) => {
      if (filter.userId && q.userId !== filter.userId) return false;
      if (filter.status && q.status !== filter.status) return false;
      return true;
    });
  }

  /**
   * Update a Quest. Only `name`, `goal`, `bookIds`, `metadata` are mutable
   * via this path. Status transitions use the dedicated methods below to
   * keep timestamps consistent.
   *
   * @param {string} id
   * @param {{ name?: string, goal?: string, bookIds?: number[], metadata?: object }} patch
   */
  update(id, patch) {
    const items = this._getAll();
    const idx = items.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    const current = items[idx];
    const next = {
      ...current,
      name: patch.name !== undefined ? String(patch.name).trim() : current.name,
      goal: patch.goal !== undefined ? String(patch.goal).trim() : current.goal,
      bookIds:
        patch.bookIds !== undefined && Array.isArray(patch.bookIds)
          ? patch.bookIds.filter((b) => typeof b === 'number')
          : current.bookIds,
      metadata:
        patch.metadata && typeof patch.metadata === 'object'
          ? { ...current.metadata, ...patch.metadata }
          : current.metadata,
      updatedAt: new Date().toISOString(),
    };
    items[idx] = next;
    this._setAll(items);
    return next;
  }

  pause(id) {
    return this._transition(id, 'paused');
  }

  resume(id) {
    return this._transition(id, 'active');
  }

  archive(id) {
    const result = this._transition(id, 'archived');
    if (result) result.archivedAt = result.updatedAt;
    return result;
  }

  _transition(id, status) {
    const items = this._getAll();
    const idx = items.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    const next = {
      ...items[idx],
      status,
      updatedAt: new Date().toISOString(),
    };
    items[idx] = next;
    this._setAll(items);
    return next;
  }
}

module.exports = QuestService;
