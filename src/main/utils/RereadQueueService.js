/**
 * RereadQueueService — Phase 8 spaced re-reading queue.
 *
 * Stores re-read items in electron-store under 'rereadQueue.items'.
 * Each item captures the context from a Phase 6 comprehension result
 * so the Knowledge Dashboard can surface exactly which chapter to re-read
 * and why (the specific gaps the reader missed).
 *
 * Item shape:
 *   {
 *     id          string  — unique id
 *     bookId      number
 *     bookTitle   string
 *     chapterId   string
 *     chapterName string
 *     gaps        string[] — concepts the reader missed (from grading)
 *     score       number   — comprehension score that triggered this item
 *     scheduledAt string   — ISO timestamp
 *     dueAt       string   — ISO timestamp (scheduledAt + intervalDays)
 *     completedAt string | null
 *     userId      number
 *   }
 *
 * Scheduling: first re-read is due after INITIAL_INTERVAL_DAYS days.
 * After completion the item is marked done (not re-scheduled here — the
 * Brain can do graduated scheduling in a future iteration).
 */

const INITIAL_INTERVAL_DAYS = 2;
const STORE_KEY = 'rereadQueue.items';

function generateId() {
  return `rr_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

class RereadQueueService {
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
   * Add a re-read item for a chapter with comprehension gaps.
   * Idempotent per (bookId, chapterId) — updates the existing item if one
   * already exists and is not yet completed.
   *
   * @param {Object} args
   * @param {number} args.bookId
   * @param {string} args.bookTitle
   * @param {string} args.chapterId
   * @param {string} args.chapterName
   * @param {string[]} args.gaps
   * @param {number} args.score
   * @param {number} [args.userId]
   * @returns {Object} the created or updated item
   */
  schedule({ bookId, bookTitle, chapterId, chapterName, gaps, score, userId = 1 }) {
    const now = new Date().toISOString();
    const items = this._getAll();

    const existing = items.find(
      (it) => it.bookId === bookId && it.chapterId === chapterId && !it.completedAt,
    );
    if (existing) {
      // Update gaps + score if a newer comprehension check surfaced different issues
      existing.gaps = gaps;
      existing.score = score;
      existing.scheduledAt = now;
      existing.dueAt = addDays(now, INITIAL_INTERVAL_DAYS);
      this._setAll(items);
      return existing;
    }

    const item = {
      id: generateId(),
      bookId,
      bookTitle,
      chapterId,
      chapterName,
      gaps,
      score,
      scheduledAt: now,
      dueAt: addDays(now, INITIAL_INTERVAL_DAYS),
      completedAt: null,
      userId,
    };
    items.push(item);
    this._setAll(items);
    return item;
  }

  /**
   * List all pending (not completed) re-read items for a user,
   * sorted by dueAt ascending (most overdue first).
   *
   * @param {number} [userId]
   * @returns {Array}
   */
  getPending(userId = 1) {
    const items = this._getAll();
    return items
      .filter((it) => (it.userId || 1) === userId && !it.completedAt)
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  }

  /**
   * Mark a re-read item as completed.
   * @param {string} id
   * @returns {Object|null} the updated item, or null if not found
   */
  complete(id) {
    const items = this._getAll();
    const item = items.find((it) => it.id === id);
    if (!item) return null;
    item.completedAt = new Date().toISOString();
    this._setAll(items);
    return item;
  }

  /**
   * Delete a re-read item (user dismisses it without completing).
   * @param {string} id
   * @returns {boolean}
   */
  dismiss(id) {
    const items = this._getAll();
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return false;
    items.splice(idx, 1);
    this._setAll(items);
    return true;
  }

  /**
   * Remove a re-read item by id — used by UndoRegistry to reverse a scheduleReread call.
   * Semantically equivalent to dismiss(); named separately so undo intent is clear.
   * @param {string} id
   * @returns {boolean}
   */
  unschedule(id) {
    return this.dismiss(id);
  }
}

export default RereadQueueService;
